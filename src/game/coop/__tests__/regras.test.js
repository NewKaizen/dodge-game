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
  danoComEscudo,
  lentidaoDoOuros,
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
// a carta que o chefe vai jogar no quadro nesta rodada
function intencao(estado, valor, naipe = 'espadas') {
  const c = CARTAS_CHEFES[estado.chefe.id].fases[0].find((x) => x.naipe === naipe) ?? CARTAS_CHEFES[estado.chefe.id].fases[0][0]
  estado.chefe.intencao = { ...c, valor }
  return estado.chefe.intencao
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

test('partida nova: HP do chefe pelo nível, sem intenção', () => {
  const e = nova({ nivel: 'dificil' })
  assert.equal(e.chefe.hp, Math.round(CHEFES.king.hp * nivelDoChefe('king', 'dificil').hp))
  assert.equal(e.chefe.intencao, null)
  assert.equal(e.jogadores[0].personagem, 'kris')
})

test('nível do chefe: NIVEIS vezes o ajuste do chefe naquele nível', () => {
  const ajuste = CHEFES.king.niveis?.dificil ?? {}
  const nivel = nivelDoChefe('king', 'dificil')
  for (const k of ['velocidade', 'densidade', 'velocidadeMax', 'dano', 'hp']) assert.equal(nivel[k], NIVEIS.dificil[k] * (ajuste[k] ?? 1))
  assert.equal(nivelDoChefe('king', 'facil').hp, NIVEIS.facil.hp * (CHEFES.king.niveis?.facil?.hp ?? 1))
  assert.equal(nivelDoChefe('king', 'dificil').rotulo, NIVEIS.dificil.rotulo)
})

test('início da rodada: energia, mãos e UMA carta do chefe para a rodada', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  assert.equal(e.rodada, 1)
  assert.equal(e.jogadores[0].energia, 3)
  assert.equal(e.jogadores[0].baralho.mao.length, 5)
  assert.ok(e.chefe.intencao)
  assert.equal(e.chefe.intencoes, undefined)
  // o chefe gasta uma carta por rodada: o monte dele anda de uma em uma
  const monte = e.chefe.monte.length
  resolverRodadaCoop(e, null, null)
  fimDaRodadaCoop(e)
  iniciarRodadaCoop(e)
  assert.equal(e.chefe.monte.length, monte - 1)
})

test('ataque vira golpe e a carta do chefe vai para o quadro, nos dois', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  const id = naMao(e, 0, 'kris-espadas-9')
  intencao(e, 5)
  const r = resolverRodadaCoop(e, id, null)
  assert.equal(r.golpes[0].base, GOLPE.espadas(9))
  assert.equal(r.golpes[1], null)
  assert.equal(r.destino, 'quadro')
  assert.ok(r.quadro.dano > 0)
  // o mesmo ataque, o mesmo dano nos dois (sem escudo)
  assert.deepEqual(r.quadro.jogadores, [true, true])
  assert.deepEqual(r.quadro.danos, [r.quadro.dano, r.quadro.dano])
  assert.equal(r.quadro.carta.id, r.intencao.id)
  assert.equal(e.chefe.intencao, null)
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

  // o escudo é de cada um: o dano por acerto de cada um sai com o escudo dele
  const x = nova()
  iniciarRodadaCoop(x)
  intencao(x, 9)
  const escudo = naMao(x, 0, 'kris-copas-7')
  const rx = resolverRodadaCoop(x, escudo, null)
  assert.ok(rx.quadro.escudos[0] && rx.quadro.escudos[1])
  for (const j of [0, 1]) assert.equal(rx.quadro.danos[j], danoComEscudo(rx.quadro.dano, rx.quadro.escudos[j]))
  assert.ok(rx.quadro.danos[0] < rx.quadro.dano)
  // gasto neste ataque
  assert.equal(x.jogadores[0].escudo, null)
  assert.equal(x.jogadores[1].escudo, null)
})

test('escudo só de um: só o dano dele cai', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  intencao(e, 9)
  e.jogadores[1].escudo = 0.5
  const r = resolverRodadaCoop(e, null, null)
  assert.equal(r.quadro.danos[0], r.quadro.dano)
  assert.equal(r.quadro.danos[1], danoComEscudo(r.quadro.dano, 0.5))
  assert.deepEqual(r.quadro.escudos, [null, 0.5])
  assert.equal(danoComEscudo(1, 0.1), 1) // nunca menos que 1
  assert.equal(danoComEscudo(9, null), 9)
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

test('caído fica fora do quadro e volta sozinho depois de algumas rodadas', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  aplicarDanoCoop(e, 1, 999)
  resolverRodadaCoop(e, null, null)
  fimDaRodadaCoop(e)
  iniciarRodadaCoop(e)
  intencao(e, 6)
  const r = resolverRodadaCoop(e, null, null)
  assert.deepEqual(r.quadro.jogadores, [true, false])
  assert.equal(r.quadro.danos[1], null)
  fimDaRodadaCoop(e)
  iniciarRodadaCoop(e)
  for (let k = 0; k < COOP.retornoRodadas - 1; k++) {
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

test('quem levanta nesta rodada (cura de copas) entra só no próximo quadro', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  aplicarDanoCoop(e, 1, 999)
  fimDaRodadaCoop(e)
  iniciarRodadaCoop(e)
  intencao(e, 6)
  const id = naMao(e, 0, 'kris-copas-10')
  const r = resolverRodadaCoop(e, id, null)
  assert.equal(r.efeitos[1].levantou, true)
  assert.deepEqual(r.quadro.jogadores, [true, false])
})

test('Espelho: o ataque do chefe volta nele e ninguém desvia', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  intencao(e, 9)
  const espelho = naMao(e, 1, 'susie-espadas-1')
  const r = resolverRodadaCoop(e, null, espelho)
  assert.equal(r.destino, 'refletida')
  assert.equal(r.quadro, null)
  assert.equal(r.golpes[1].tipo, 'espelho')
  assert.ok(r.golpes[1].base > 0)
  // dois Espelhos: a carta volta uma vez só, o segundo vira o eco
  const d = nova()
  iniciarRodadaCoop(d)
  intencao(d, 9)
  const r2 = resolverRodadaCoop(d, naMao(d, 0, 'kris-espadas-1'), naMao(d, 1, 'susie-espadas-1'))
  assert.equal(r2.golpes[0].tipo, 'espelho')
  assert.equal(r2.golpes[1].tipo, 'eco')
  assert.equal(r2.golpes[1].base, GOLPE.espadas(7))
})

test('Anular cancela o ataque dos dois e tira carga; Roubo rouba e dá energia', () => {
  const a = nova()
  iniciarRodadaCoop(a)
  a.chefe.carga = 3
  intencao(a, 9)
  const ra = resolverRodadaCoop(a, naMao(a, 0, 'kris-ouros-1'), null)
  assert.equal(ra.destino, 'anulada')
  assert.equal(ra.quadro, null)
  assert.equal(a.chefe.carga, 3 - COOP.anularCarga)

  const b = nova()
  iniciarRodadaCoop(b)
  intencao(b, 9)
  const roubo = naMao(b, 1, 'susie-paus-1')
  b.jogadores[1].energia = 4
  const rb = resolverRodadaCoop(b, null, roubo)
  assert.equal(rb.destino, 'roubada')
  assert.equal(rb.quadro, null)
  assert.equal(rb.efeitos[1].roubou, true)
  assert.equal(b.jogadores[1].energia, 4 - carta(roubo).custo + COOP.rouboEnergia)

  // Anular e Roubo juntos: o Anular pega a carta (vem antes), o Roubo ainda dá a energia
  const c = nova()
  iniciarRodadaCoop(c)
  intencao(c, 9)
  const rc = resolverRodadaCoop(c, naMao(c, 0, 'kris-ouros-1'), naMao(c, 1, 'susie-paus-1'))
  assert.equal(rc.destino, 'anulada')
  assert.equal(rc.efeitos[1].roubou, false)
  assert.equal(rc.efeitos[1].energia, COOP.rouboEnergia)
})

test('SUPER de jogador varre o ataque do quadro para os dois', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  intencao(e, 11)
  const sup = e.jogadores[0].baralho.monte.find((c) => c.valor === 14)
  e.jogadores[0].baralho.mao.push(sup)
  e.jogadores[0].energia = COOP.custoSuper
  const r = resolverRodadaCoop(e, sup.id, null)
  assert.equal(r.destino, 'varrida')
  assert.equal(r.quadro, null)
  assert.equal(r.golpes[0].tipo, 'super')
})

test('SUPER do chefe: carga cheia, uma carta só (o quadro dos dois) e imparável', () => {
  const e = nova()
  e.chefe.fase = 1
  e.chefe.carga = e.chefe.cargaMax - 1
  iniciarRodadaCoop(e)
  assert.equal(e.chefe.intencao.valor, 14)
  assert.equal(e.chefe.carga, 0)
  const espelho = naMao(e, 0, 'kris-espadas-1')
  const anular = naMao(e, 1, 'susie-ouros-1')
  const r = resolverRodadaCoop(e, espelho, anular)
  assert.equal(r.destino, 'quadro')
  assert.deepEqual(r.quadro.jogadores, [true, true])
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
  // HP cheio: os dois juntos tiram o SUPER COMBO do nível (metade cada) e o chefe aguenta
  const total = lista.reduce((t, g) => t + g.dano, 0)
  assert.ok(Math.abs(total - e.chefe.hpMax * COOP.superCombo.facil) <= 1, `combo ${total}`)
  assert.ok(total < e.chefe.hp)
  // só um SUPER: sem combo
  assert.equal(comboDosGolpes([r.golpes[0], null]), null)
})

test('♦ deixa o ataque do chefe mais lento para os dois; Q/K mais ainda; não soma', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  intencao(e, 5)
  const r = resolverRodadaCoop(e, naMao(e, 0, 'kris-ouros-5'), null)
  assert.ok(r.quadro.lento)
  assert.equal(r.quadro.ritmo.velocidade, COOP.lentidao)
  assert.equal(lentidaoDoOuros(5), COOP.lentidao)
  assert.equal(lentidaoDoOuros(12), COOP.lentidaoForte)
  // os dois com ♦: vale o mais forte (Q/K), sem somar
  const d = nova()
  iniciarRodadaCoop(d)
  intencao(d, 5)
  const r2 = resolverRodadaCoop(d, naMao(d, 0, 'kris-ouros-12'), naMao(d, 1, 'susie-ouros-7'))
  assert.equal(r2.quadro.ritmo.velocidade, COOP.lentidaoForte)
  assert.ok(r2.efeitos[0].lento && r2.efeitos[1].lento)
})

test('♥ do chefe cura ele e levanta a guarda', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  e.chefe.hp = 100
  const cura = CARTAS_CHEFES.king.fases[1].find((c) => c.naipe === 'copas')
  e.chefe.intencao = { ...cura }
  const r = resolverRodadaCoop(e, null, null)
  // uma carta por rodada: ele cura com a metade da frequência e o dobro (COOP.curaChefe)
  assert.equal(r.chefe.cura, Math.round(CHEFES.king.fases[1].cartas.find((c) => c[0] === 'copas')[4].cura * COOP.curaChefe))
  assert.equal(e.chefe.guarda, 0.6)
  assert.ok(r.quadro.dano > 0) // o ataque fraquinho, nos dois
  assert.deepEqual(r.quadro.jogadores, [true, true])
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
      // cada um no quadro leva dois acertos
      const q = res.quadro
      if (q) [0, 1].forEach((j) => q.jogadores[j] && [1, 2].forEach(() => aplicarDanoCoop(e, j, q.danos[j])))
      calcularGolpes(e, res.golpes, [{ grazes: 3 }, { grazes: 3 }]).forEach((g) => aplicarGolpe(e, g.dano))
      fim = fimDaRodadaCoop(e).vencedor
    }
    assert.ok(fim, `${chefe}: a luta não acabou`)
  }
})

test('as cartas dos jogadores trazem o texto do CO-OP', () => {
  const e = nova()
  const todas = e.jogadores.flatMap((jog) => jog.baralho.monte)
  assert.ok(todas.every((c) => c.descricao === descricaoCoop(c, { hpMax: e.chefe.hpMax, nivel: e.nivel })))
  assert.match(descricaoCoop(carta('kris-copas-10')), /VOCÊ E NO PARCEIRO.*levanta/)
  assert.match(descricaoCoop(carta('kris-copas-7')), /DOIS/)
  assert.match(descricaoCoop(carta('kris-copas-1')), /PARCEIRO/)
  assert.match(descricaoCoop(carta('kris-espadas-9')), new RegExp(`golpe de ${GOLPE.espadas(9)}`))
  // o que mexe na carta do chefe fala do quadro dos dois
  assert.match(descricaoCoop(carta('kris-paus-1')), /rouba o ataque do chefe/)
  assert.match(descricaoCoop(carta('kris-ouros-12')), /mais lento para os dois/)
  // a carta original do PvP não muda
  assert.doesNotMatch(CARTAS.kris.find((c) => c.id === 'kris-copas-10').descricao, /PARCEIRO/)
})
