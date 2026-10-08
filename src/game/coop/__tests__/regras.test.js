// node --test src/game/coop/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COOP,
  GOLPE,
  criarPartidaCoop,
  iniciarRodadaCoop,
  podeJogarCoop,
  resolverRodadaCoop,
  aplicarDanoCoop,
  calcularGolpes,
  comboDosGolpes,
  aplicarGolpe,
  fimDaRodadaCoop,
  descricaoCoop,
} from '../regras.js'
import { CARTAS_CHEFES, ataqueDaCartaChefe, danoDaCartaChefe, faseDoChefe } from '../cartasChefe.js'
import { CHEFES, nivelDoChefe } from '../chefes/index.js'
import { NIVEIS } from '../../constants.js'
import { escolherJogadaCoop } from '../bot.js'
import { CARTAS } from '../../pvp/cartas.js'
import { criarRng } from '../../pvp/baralho.js'

const IDS = Object.keys(CHEFES)
const nova = (opcoes = {}) => criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'king', semente: 'teste', ...opcoes })
const carta = (id) => {
  const [p] = id.split('-')
  return { ...CARTAS[p].find((c) => c.id === id) }
}
// coloca a carta na mão do jogador j (e energia de sobra)
function naMao(estado, j, id) {
  const jog = estado.jogadores[j]
  jog.baralho.mao.push(carta(id))
  jog.energia = 10
  return id
}
// intenção do chefe na caixa do jogador j
function intencao(estado, j, valor, naipe = 'espadas') {
  const c = CARTAS_CHEFES[estado.chefe.id].fases[0].find((x) => x.naipe === naipe) ?? CARTAS_CHEFES[estado.chefe.id].fases[0][0]
  estado.chefe.intencoes[j] = { ...c, valor }
  return estado.chefe.intencoes[j]
}

// biblioteca falsa de ataques: qualquer A.x(...) devolve { nome: x, ...}
const A = new Proxy({}, { get: (_, nome) => (...args) => ({ nome, args }) })

test('todo chefe tem baralho em todas as fases, com SUPER e ataques montáveis', () => {
  for (const id of IDS) {
    const def = CHEFES[id]
    assert.ok(def.hp > 0 && def.danoBala > 0, id)
    assert.equal(def.fases[0].hp, 1, `${id}: a primeira fase começa em hp 1`)
    const { fases, super: sup } = CARTAS_CHEFES[id]
    assert.equal(fases.length, def.fases.length)
    for (const lista of fases) {
      assert.ok(lista.length >= 3, `${id}: fase com poucas cartas`)
      for (const c of lista) {
        const ataque = ataqueDaCartaChefe(c, { ataques: A })
        assert.ok(ataque, `${c.id} sem ataque`)
        assert.ok(c.valor >= 2 && c.valor <= 13)
      }
    }
    assert.ok(ataqueDaCartaChefe(sup, { ataques: A }))
    assert.equal(sup.valor, 14)
  }
})

test('fase do chefe pelo HP', () => {
  assert.equal(faseDoChefe('king', 1), 0)
  assert.equal(faseDoChefe('king', 0.6), 0)
  assert.equal(faseDoChefe('king', 0.5), 1)
  assert.equal(faseDoChefe('jevil', 0.2), 3)
})

test('dano do chefe sobe com o valor e com o nível', () => {
  const [baixa] = CARTAS_CHEFES.jevil.fases[0]
  const alta = CARTAS_CHEFES.jevil.fases[3].find((c) => c.valor === 13)
  assert.ok(danoDaCartaChefe(alta) > danoDaCartaChefe(baixa))
  assert.ok(danoDaCartaChefe(baixa, 1.5) > danoDaCartaChefe(baixa, 1))
})

test('partida nova: HP do chefe pelo nível, sem intenções', () => {
  const e = nova({ nivel: 'dificil' })
  assert.equal(e.chefe.hp, Math.round(CHEFES.king.hp * nivelDoChefe('king', 'dificil').hp))
  assert.deepEqual(e.chefe.intencoes, [null, null])
  assert.equal(e.jogadores[0].personagem, 'kris')
})

test('nível do chefe: NIVEIS vezes o ajuste do chefe naquele nível', () => {
  const ajuste = CHEFES.king.niveis?.dificil ?? {}
  const nivel = nivelDoChefe('king', 'dificil')
  for (const k of ['velocidade', 'densidade', 'velocidadeMax', 'dano', 'hp']) assert.equal(nivel[k], NIVEIS.dificil[k] * (ajuste[k] ?? 1))
  assert.equal(nivelDoChefe('king', 'facil').hp, NIVEIS.facil.hp * (CHEFES.king.niveis?.facil?.hp ?? 1))
  assert.equal(nivelDoChefe('king', 'dificil').rotulo, NIVEIS.dificil.rotulo)
})

test('início da rodada: energia, mãos e uma intenção para cada um', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  assert.equal(e.rodada, 1)
  assert.equal(e.jogadores[0].energia, 3)
  assert.equal(e.jogadores[0].baralho.mao.length, 5)
  assert.ok(e.chefe.intencoes[0] && e.chefe.intencoes[1])
  // nunca duas curas na mesma rodada
  for (let k = 0; k < 30; k++) {
    const x = nova({ semente: `s${k}` })
    iniciarRodadaCoop(x)
    assert.ok(!(x.chefe.intencoes[0].naipe === 'copas' && x.chefe.intencoes[1].naipe === 'copas'))
  }
})

test('ataque vira golpe e a carta do chefe vai para a caixa', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  const id = naMao(e, 0, 'kris-espadas-9')
  intencao(e, 0, 5)
  const r = resolverRodadaCoop(e, id, null)
  assert.equal(r.golpes[0].base, GOLPE.espadas(9))
  assert.equal(r.golpes[1], null)
  assert.ok(r.caixas[0].dano > 0)
  assert.equal(r.destinos[0], 'caixa')
  assert.equal(e.jogadores[0].energia, 10 - carta(id).custo)
})

test('copas cura os dois e escudo protege os dois', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  e.jogadores[0].hp = 40
  e.jogadores[1].hp = 40
  const cura = naMao(e, 0, 'kris-copas-10')
  const r = resolverRodadaCoop(e, cura, null)
  assert.ok(r.efeitos[0].cura > 0 && r.efeitos[1].cura > 0)
  assert.equal(e.jogadores[0].hp, e.jogadores[1].hp)

  const x = nova()
  iniciarRodadaCoop(x)
  const escudo = naMao(x, 0, 'kris-copas-7')
  const rx = resolverRodadaCoop(x, escudo, null)
  assert.ok(rx.caixas[0].escudo && rx.caixas[1].escudo)
})

test('cura de copas levanta o parceiro caído', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  aplicarDanoCoop(e, 1, 999)
  assert.equal(e.jogadores[1].caido, true)
  assert.equal(podeJogarCoop(e, 1, 'susie-espadas-2').ok, false)
  const id = naMao(e, 0, 'kris-copas-10')
  const r = resolverRodadaCoop(e, id, null)
  assert.equal(r.efeitos[1].levantou, true)
  assert.equal(e.jogadores[1].caido, false)
  assert.ok(e.jogadores[1].hp >= Math.round(e.jogadores[1].hpMax * COOP.reviverMin))
})

test('caído não é mirado e volta sozinho depois de algumas rodadas', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  aplicarDanoCoop(e, 1, 999)
  resolverRodadaCoop(e, null, null)
  fimDaRodadaCoop(e)
  iniciarRodadaCoop(e)
  assert.equal(e.chefe.intencoes[1], null)
  assert.ok(e.chefe.intencoes[0])
  for (let k = 0; k < COOP.retornoRodadas; k++) {
    resolverRodadaCoop(e, null, null)
    fimDaRodadaCoop(e)
    iniciarRodadaCoop(e)
  }
  assert.equal(e.jogadores[1].caido, false)
  assert.equal(e.jogadores[1].hp, Math.round(e.jogadores[1].hpMax * COOP.retornoHp))
})

test('os dois caídos: derrota; chefe zerado: vitória', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  aplicarDanoCoop(e, 0, 999)
  aplicarDanoCoop(e, 1, 999)
  assert.equal(fimDaRodadaCoop(e).vencedor, 'derrota')
  const v = nova()
  iniciarRodadaCoop(v)
  aplicarGolpe(v, 9999)
  assert.equal(fimDaRodadaCoop(v).vencedor, 'vitoria')
})

test('Espelho reflete a carta do chefe; Anular cancela e tira carga; Roubo pega a do parceiro', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  intencao(e, 0, 9)
  intencao(e, 1, 6)
  e.chefe.carga = 3
  const espelho = naMao(e, 0, 'kris-espadas-1')
  const roubo = naMao(e, 1, 'susie-paus-1')
  const r = resolverRodadaCoop(e, espelho, roubo)
  assert.equal(r.destinos[0], 'refletida')
  assert.equal(r.golpes[0].tipo, 'espelho')
  assert.ok(r.golpes[0].base > 0)
  // o parceiro (P1) já refletiu a dele: o Roubo pega a do próprio P2
  assert.equal(r.destinos[1], 'roubada')
  assert.deepEqual(r.caixas, [null, null])

  const a = nova()
  iniciarRodadaCoop(a)
  a.chefe.fase = 1
  a.chefe.carga = 3
  intencao(a, 0, 9)
  const anular = naMao(a, 0, 'kris-ouros-1')
  const ra = resolverRodadaCoop(a, anular, null)
  assert.equal(ra.destinos[0], 'anulada')
  assert.equal(a.chefe.carga, 3 - COOP.anularCarga)
  assert.equal(ra.destinos[1], 'caixa')
})

test('SUPER do chefe: carga cheia nas duas caixas e imparável', () => {
  const e = nova()
  e.chefe.fase = 1
  e.chefe.carga = e.chefe.cargaMax - 1
  iniciarRodadaCoop(e)
  assert.equal(e.chefe.intencoes[0].valor, 14)
  assert.equal(e.chefe.intencoes[1].valor, 14)
  assert.equal(e.chefe.carga, 0)
  const espelho = naMao(e, 0, 'kris-espadas-1')
  const anular = naMao(e, 1, 'susie-ouros-1')
  const r = resolverRodadaCoop(e, espelho, anular)
  assert.equal(r.destinos[0], 'caixa')
  assert.equal(r.destinos[1], 'caixa')
  assert.equal(r.golpes[0].tipo, 'eco')
})

test('SUPER do chefe sai a cada COOP.cargaSuper rodadas, desde a 1ª fase', () => {
  const e = nova()
  const rodadasComSuper = []
  for (let r = 1; r <= COOP.cargaSuper * 2; r++) {
    if (iniciarRodadaCoop(e).some((ev) => ev.tipo === 'superChefe')) rodadasComSuper.push(r)
    resolverRodadaCoop(e, null, null)
    fimDaRodadaCoop(e)
  }
  assert.deepEqual(rodadasComSuper, [COOP.cargaSuper, COOP.cargaSuper * 2])
})

test('SUPER no CO-OP: custo e dano do CO-OP; os dois juntos = SUPER COMBO', () => {
  const e = nova()
  const supers = e.jogadores.map((jog) => jog.baralho.monte.find((c) => c.valor === 14))
  assert.ok(supers.every((c) => c.custo === COOP.custoSuper))
  assert.equal(CARTAS.kris.find((c) => c.valor === 14).custo, 10) // o PvP não muda
  iniciarRodadaCoop(e)
  const ids = supers.map((c, j) => {
    e.jogadores[j].baralho.mao.push(c)
    e.jogadores[j].energia = COOP.custoSuper
    return c.id
  })
  const r = resolverRodadaCoop(e, ...ids)
  assert.equal(comboDosGolpes(r.golpes), 'super')
  const lista = calcularGolpes(e, r.golpes)
  assert.ok(lista.every((g) => g.dano === Math.round(COOP.superGolpe * COOP.superCombo)))
  assert.ok(lista.every((g) => g.multiplicadores.some(([nome]) => nome === 'SUPER COMBO')))
  // só um SUPER: sem combo
  assert.equal(comboDosGolpes([r.golpes[0], null]), null)
})

test('♦ deixa a carta do chefe mais lenta; Q/K nas duas caixas', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  intencao(e, 0, 5)
  intencao(e, 1, 5)
  const id = naMao(e, 0, 'kris-ouros-12')
  const r = resolverRodadaCoop(e, id, null)
  assert.ok(r.caixas[0].lento && r.caixas[1].lento)
  assert.ok(r.caixas[0].ritmo.velocidade < 1)
})

test('♥ do chefe cura ele e levanta a guarda', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  e.chefe.hp = 100
  const cura = CARTAS_CHEFES.king.fases[1].find((c) => c.naipe === 'copas')
  e.chefe.intencoes[0] = { ...cura }
  const r = resolverRodadaCoop(e, null, null)
  assert.ok(r.chefe.cura > 0)
  assert.equal(e.chefe.guarda, 0.6)
  assert.ok(r.caixas[0].dano > 0) // o ataque fraquinho
})

test('golpes: crítico, armadilha, combo, par, guarda e caído', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  const g = (id) => ({ carta: carta(id), tipo: carta(id).naipe, base: GOLPE[carta(id).naipe](carta(id).valor) })
  assert.equal(comboDosGolpes([g('kris-espadas-9'), g('susie-espadas-2')]), 'combo')
  assert.equal(comboDosGolpes([g('kris-espadas-9'), g('kris-ouros-8')]), null)
  const par = [g('kris-paus-7'), g('kris-ouros-8')]
  par[1] = { ...par[1], carta: { ...par[1].carta, valor: 7 } }
  assert.equal(comboDosGolpes(par), 'par')
  const golpes = [g('kris-espadas-9'), g('kris-paus-10')]
  const [a, b] = calcularGolpes(e, golpes, [{ perfeito: true }, { grazes: 5 }])
  assert.equal(a.dano, Math.round(GOLPE.espadas(9) * COOP.critico))
  assert.equal(b.dano, Math.round(GOLPE.paus(10) * (1 + 5 * COOP.grazeArmadilha)))
  e.chefe.guarda = 0.5
  const [c] = calcularGolpes(e, [golpes[0], null])
  assert.equal(c.dano, Math.round(GOLPE.espadas(9) * 0.5))
  e.chefe.guarda = null
  aplicarDanoCoop(e, 1, 999)
  const lista = calcularGolpes(e, golpes)
  assert.equal(lista[1].falhou, true)
  assert.equal(lista[1].dano, 0)
})

test('troca de fase do chefe: baralho da fase nova', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  aplicarGolpe(e, Math.ceil(e.chefe.hpMax * 0.55))
  const { novaFase } = fimDaRodadaCoop(e)
  assert.equal(novaFase, 1)
  assert.ok(e.chefe.monte.every((c) => c.fase === 1))
})

test('CPU aliada: levanta o parceiro caído e joga carta válida', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  aplicarDanoCoop(e, 0, 999)
  naMao(e, 1, 'susie-copas-9')
  const cura = e.jogadores[1].baralho.mao.find((c) => c.naipe === 'copas' && c.valor !== 1)
  const id = escolherJogadaCoop(e, 1, { rng: criarRng('bot') })
  assert.ok(id)
  if (cura) assert.equal(carta(id).naipe, 'copas')
  assert.equal(escolherJogadaCoop(e, 0), null) // caído passa
})

test('partida simulada inteira termina (bots dos dois lados)', () => {
  for (const chefe of IDS) {
    const e = criarPartidaCoop({ party: ['ralsei', 'dess'], chefe, semente: `sim-${chefe}` })
    const rng = criarRng('sim')
    let fim = null
    for (let r = 0; r < 80 && !fim; r++) {
      iniciarRodadaCoop(e)
      const jogadas = [0, 1].map((j) => escolherJogadaCoop(e, j, { rng }))
      const res = resolverRodadaCoop(e, ...jogadas)
      // cada caixa leva dois acertos
      res.caixas.forEach((cx, j) => cx && [1, 2].forEach(() => aplicarDanoCoop(e, j, cx.dano)))
      calcularGolpes(e, res.golpes, [{ grazes: 3 }, { grazes: 3 }]).forEach((g) => aplicarGolpe(e, g.dano))
      fim = fimDaRodadaCoop(e).vencedor
    }
    assert.ok(fim, `${chefe}: a luta não acabou`)
  }
})

test('as cartas dos jogadores trazem o texto do CO-OP', () => {
  const e = nova()
  const todas = e.jogadores.flatMap((jog) => jog.baralho.monte)
  assert.ok(todas.every((c) => c.descricao === descricaoCoop(c)))
  assert.match(descricaoCoop(carta('kris-copas-10')), /VOCÊ E NO PARCEIRO.*levanta/)
  assert.match(descricaoCoop(carta('kris-copas-7')), /DOIS/)
  assert.match(descricaoCoop(carta('kris-copas-1')), /PARCEIRO/)
  assert.match(descricaoCoop(carta('kris-espadas-9')), new RegExp(`golpe de ${GOLPE.espadas(9)}`))
  // a carta original do PvP não muda
  assert.doesNotMatch(CARTAS.kris.find((c) => c.id === 'kris-copas-10').descricao, /PARCEIRO/)
})
