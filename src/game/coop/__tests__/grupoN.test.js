// CO-OP de 3 e 4 jogadores (Fase 5B): as regras puras de coop/regras.js para N.
// node --test src/game/coop/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COOP,
  GRUPO,
  criarPartidaCoop,
  iniciarRodadaCoop,
  resolverRodadaCoop,
  aplicarDanoCoop,
  calcularGolpes,
  comboDosGolpes,
  aplicarGolpe,
  fimDaRodadaCoop,
  escolherMira,
  definirPresenca,
  resgatarPorRodadaLimpa,
  motivoBloqueioCoop,
  fracaoDoCombo,
  danoNoCombo,
  descricaoCoop,
} from '../regras.js'
import { QUADRO, quadroDoGrupo, inicioDoCoracao } from '../quadro.js'
import { escolherJogadaCoop } from '../bot.js'
import { CARTAS_CHEFES } from '../cartasChefe.js'
import { CARTAS } from '../../pvp/cartas.js'
import { criarRng } from '../../pvp/baralho.js'
import { LARGURA, ALTURA } from '../../constants.js'

const PARTY = ['kris', 'susie', 'ralsei', 'dess']
const nova = (n = 4, opcoes = {}) => criarPartidaCoop({ party: PARTY.slice(0, n), chefe: 'king', semente: 'grupo', ...opcoes })
const carta = (id) => {
  const [p] = id.split('-')
  return { ...CARTAS[p].find((c) => c.id === id) }
}
function naMao(estado, j, id) {
  const jog = estado.jogadores[j]
  jog.baralho.mao.push(carta(id))
  jog.energia = 10
  return id
}
function intencao(estado, valor, naipe = 'espadas') {
  const c = CARTAS_CHEFES[estado.chefe.id].fases[0].find((x) => x.naipe === naipe) ?? CARTAS_CHEFES[estado.chefe.id].fases[0][0]
  estado.chefe.intencao = { ...c, valor }
  return estado.chefe.intencao
}
// garante o SUPER do jogador j na mão (ele pode estar no monte, na mão ou ter sido comprado) e a energia
function comSuper(estado, j) {
  const jog = estado.jogadores[j]
  let sup = jog.baralho.mao.find((c) => c.valor === 14)
  if (!sup) {
    const i = jog.baralho.monte.findIndex((c) => c.valor === 14)
    ;[sup] = jog.baralho.monte.splice(i, 1)
    jog.baralho.mao.push(sup)
  }
  jog.energia = COOP.custoSuper
  return sup.id
}
const passam = (n) => Array(n).fill(null)

test('partida de 3 e 4: ids p1..p4, botões do grupo e vida do chefe escalada', () => {
  const base = nova(2)
  assert.equal(base.n, 2)
  assert.equal(base.grupo, null, 'com 2 jogadores nada muda')
  for (const n of [3, 4]) {
    const e = nova(n)
    assert.equal(e.n, n)
    assert.deepEqual(e.jogadores.map((j) => j.id), ['p1', 'p2', 'p3', 'p4'].slice(0, n))
    assert.deepEqual(e.jogadores.map((j) => j.personagem), PARTY.slice(0, n))
    assert.equal(e.grupo, GRUPO[n])
    assert.equal(e.chefe.hpMax, Math.round(base.chefe.hpMax * GRUPO[n].hpChefe))
  }
  // os botões não são só vida do chefe: densidade, espaço e apoio também sobem com o grupo
  assert.ok(GRUPO[4].hpChefe > GRUPO[3].hpChefe && GRUPO[3].hpChefe > GRUPO[2].hpChefe)
  assert.ok(GRUPO[4].densidade > GRUPO[3].densidade && GRUPO[3].densidade > 1)
  assert.ok(GRUPO[4].espaco.largura > GRUPO[3].espaco.largura && GRUPO[3].espaco.largura > 1)
  assert.ok(GRUPO[3].apoioAliados > GRUPO[2].apoioAliados)
  // o texto das cartas fala dos aliados, não do parceiro
  const copas = nova(3).jogadores[0].baralho.monte.find((c) => c.naipe === 'copas' && c.valor > 1)
  assert.match(copas.descricao, /ALIADOS/)
})

test('o quadro do grupo cresce até o campo e fica com mais balas; 2 jogadores iguais', () => {
  assert.deepEqual(quadroDoGrupo(null), QUADRO)
  for (const n of [3, 4]) {
    const q = quadroDoGrupo(GRUPO[n])
    assert.ok(q.largura > QUADRO.largura && q.largura <= QUADRO.campo.direita - QUADRO.campo.esquerda)
    assert.ok(q.altura >= QUADRO.altura && q.altura <= QUADRO.campo.base - QUADRO.campo.topo)
    assert.ok(q.ritmo.densidade > QUADRO.ritmo.densidade)
    const esq = q.x - q.largura / 2
    assert.ok(esq >= q.campo.esquerda && q.x + q.largura / 2 <= q.campo.direita)
    // os n corações começam em ordem de vaga, separados, dentro do quadro
    const limites = { x: esq, width: q.largura, bottom: q.y + q.altura / 2 }
    const xs = Array.from({ length: n }, (_, k) => inicioDoCoracao(limites, k, n).x)
    assert.deepEqual([...xs].sort((a, b) => a - b), xs)
    for (let k = 1; k < n; k++) assert.ok(xs[k] - xs[k - 1] > 60, `n=${n}: corações muito juntos`)
  }
  assert.ok(LARGURA >= 854 && ALTURA >= 480)
})

test('rodízio de mira: de 4 de pé o chefe mira em 2, e todos levam a mesma quantidade', () => {
  const e = nova(4)
  const conta = [0, 0, 0, 0]
  for (let r = 0; r < 12; r++) {
    iniciarRodadaCoop(e)
    const mira = e.chefe.mira
    assert.equal(mira.length, 2, `rodada ${e.rodada}`)
    assert.deepEqual(mira, [...mira].sort((a, b) => a - b))
    mira.forEach((j) => conta[j]++)
  }
  assert.deepEqual(conta, [6, 6, 6, 6], 'cada um é mirado a cada duas rodadas')
})

test('rodízio de mira: o menos mirado vai primeiro (3 de pé: 2 por rodada, sem repetir seguido)', () => {
  const e = nova(3)
  const miras = []
  for (let r = 0; r < 6; r++) {
    iniciarRodadaCoop(e)
    miras.push(e.chefe.mira)
  }
  assert.deepEqual(miras[0], [0, 1])
  assert.deepEqual(miras[1], [0, 2], 'o P3 nunca foi mirado: entra; empate no P1/P2, o de menor vaga')
  // quem ficou de fora numa rodada entra na seguinte
  for (let r = 1; r < miras.length; r++) {
    const fora = [0, 1, 2].filter((j) => !miras[r - 1].includes(j))
    assert.ok(fora.every((j) => miras[r].includes(j)), `rodada ${r + 1}`)
  }
  const conta = [0, 0, 0]
  miras.forEach((m) => m.forEach((j) => conta[j]++))
  assert.ok(Math.max(...conta) - Math.min(...conta) <= 1, `${conta}`)
})

test('a mira só olha quem está de pé e presente; com 2 ou menos de pé, todos', () => {
  const e = nova(4)
  e.rodada = 3
  e.jogadores[1].caido = true
  definirPresenca(e, { ausentes: [2] })
  // de pé e presentes: 0 e 3 (2 jogadores) -> todos eles
  assert.deepEqual(escolherMira(e), [0, 3])
  e.jogadores[1].caido = false
  e.jogadores[3].saiu = true
  // de pé: 0, 1 (o 2 está ausente, o 3 saiu) -> 2 jogadores, todos
  assert.deepEqual(escolherMira(e), [0, 1])
  // 3 de pé: miram 2, e o ausente nunca entra
  definirPresenca(e, { ausentes: [] })
  e.jogadores[3].saiu = false
  e.jogadores[0].ultimaMira = 9
  e.jogadores[1].ultimaMira = 9
  assert.deepEqual(escolherMira(e).sort(), [2, 3], 'os que levaram mira há mais tempo')
})

test('o ataque no quadro leva a mira (só de quem está no quadro) e o dano de cada um', () => {
  const e = nova(4)
  iniciarRodadaCoop(e)
  intencao(e, 9)
  e.jogadores[3].caido = true // caiu depois da mira: sai do quadro
  const r = resolverRodadaCoop(e, ...passam(4))
  assert.equal(r.destino, 'quadro')
  assert.deepEqual(r.quadro.jogadores, [true, true, true, false])
  assert.equal(r.quadro.danos[3], null)
  assert.deepEqual(r.quadro.mira, [0, 1])
  assert.equal(r.efeitos.length, 4)
  assert.equal(r.golpes.length, 4)
  // 2 jogadores: nada de mira no quadro
  const d = nova(2)
  iniciarRodadaCoop(d)
  intencao(d, 9)
  assert.equal(resolverRodadaCoop(d, null, null).quadro.mira, undefined)
  assert.equal(d.chefe.mira, null)
})

test('resgate: rodada limpa levanta o caído há mais tempo, sem acerto não (nem sem quadro)', () => {
  const e = nova(4)
  iniciarRodadaCoop(e)
  intencao(e, 9)
  // o P2 caiu antes que o P4
  e.jogadores[1].caido = true
  e.jogadores[1].hp = 0
  e.jogadores[1].voltaEm = 5
  e.jogadores[3].caido = true
  e.jogadores[3].hp = 0
  e.jogadores[3].voltaEm = 7
  const r = resolverRodadaCoop(e, ...passam(4))
  // um acerto em quem está no quadro: sem resgate
  assert.deepEqual(resgatarPorRodadaLimpa(e, { quadro: r.quadro, acertos: [0, 0, 1, 0] }), [])
  assert.ok(e.jogadores[1].caido && e.jogadores[3].caido)
  // limpa: volta o P2, com 30% do HP, e o P4 continua caído
  const fim = fimDaRodadaCoop(e, { quadro: r.quadro, acertos: [0, 0, 0, 0] })
  assert.deepEqual(fim.resgatados, [1])
  assert.equal(e.jogadores[1].caido, false)
  assert.equal(e.jogadores[1].hp, Math.round(e.jogadores[1].hpMax * COOP.retornoHp))
  assert.ok(e.jogadores[3].caido)
  // sem quadro (a carta do chefe foi anulada): não vale
  const f = nova(3)
  iniciarRodadaCoop(f)
  f.jogadores[2].caido = true
  f.jogadores[2].voltaEm = 9
  assert.deepEqual(resgatarPorRodadaLimpa(f, { quadro: null, acertos: [] }), [])
  // com 2 jogadores o resgate por rodada limpa não existe (só a cura de copas e a volta sozinha)
  const d = nova(2)
  iniciarRodadaCoop(d)
  intencao(d, 9)
  d.jogadores[1].caido = true
  d.jogadores[1].voltaEm = 9
  const rd = resolverRodadaCoop(d, null, null)
  assert.deepEqual(resgatarPorRodadaLimpa(d, { quadro: rd.quadro, acertos: [0, 0] }), [])
  assert.deepEqual(Object.keys(fimDaRodadaCoop(d)).sort(), ['novaFase', 'vencedor'])
})

test('♥ levanta o aliado caído (o que caiu há mais tempo) e cura o mais ferido; alcança 2 aliados', () => {
  const e = nova(4)
  iniciarRodadaCoop(e)
  intencao(e, 9)
  e.jogadores[2].caido = true
  e.jogadores[2].hp = 0
  e.jogadores[2].voltaEm = 6
  e.jogadores[3].caido = true
  e.jogadores[3].hp = 0
  e.jogadores[3].voltaEm = 9
  e.jogadores[1].hp = 10
  const copas = naMao(e, 0, 'kris-copas-10')
  const r = resolverRodadaCoop(e, copas, null, null, null)
  // alcança 2 aliados: os dois caídos (o P3 e o P4); o P2, ferido, fica de fora
  assert.deepEqual(r.efeitos[0].apoio, [2, 3])
  assert.equal(e.jogadores[2].caido, false)
  assert.equal(e.jogadores[3].caido, false)
  assert.equal(e.jogadores[1].hp, 10)
  // entram só no próximo quadro
  assert.deepEqual(r.quadro.jogadores, [true, true, false, false])
  // sem caído: cura o mais ferido
  const f = nova(4)
  iniciarRodadaCoop(f)
  intencao(f, 9)
  f.jogadores[1].hp = 5
  f.jogadores[3].hp = 20
  const rf = resolverRodadaCoop(f, naMao(f, 0, 'kris-copas-10'), null, null, null)
  assert.deepEqual(rf.efeitos[0].apoio, [1, 3])
  assert.ok(f.jogadores[1].hp > 5 && f.jogadores[3].hp > 20)
})

test('A♥ (segunda chance) vale para todos e levanta os caídos', () => {
  const e = nova(4)
  iniciarRodadaCoop(e)
  intencao(e, 9)
  e.jogadores[3].caido = true
  e.jogadores[3].hp = 0
  e.jogadores[3].voltaEm = 9
  for (const j of [0, 1, 2]) e.jogadores[j].hp = Math.round(e.jogadores[j].hpMax / 2)
  const r = resolverRodadaCoop(e, null, naMao(e, 1, 'susie-copas-1'), null, null)
  assert.ok(r.efeitos.every((ef, j) => ef.cura > 0 || j === 3), 'todos curam')
  assert.equal(e.jogadores[3].caido, false)
  assert.ok(e.jogadores.every((jog) => jog.protegido))
})

test('combos de grupo: 3 do mesmo naipe valem mais que 2; PAR vale por valor; o combo de 2 é o de sempre', () => {
  const e = nova(4)
  iniciarRodadaCoop(e)
  intencao(e, 9)
  const r = resolverRodadaCoop(e, naMao(e, 0, 'kris-espadas-9'), naMao(e, 1, 'susie-espadas-8'), naMao(e, 2, 'ralsei-espadas-5'), null)
  assert.equal(comboDosGolpes(r.golpes), 'combo')
  const lista = calcularGolpes(e, r.golpes, [{}, {}, {}, {}])
  const fator = (g) => g.multiplicadores.find(([n]) => n === 'COMBO')?.[1]
  assert.equal(lista.length, 3)
  for (const g of lista) assert.equal(fator(g), 1.35, 'COMBO 1,25 + 0,10 pelo terceiro jogador')
  // dois do mesmo naipe + um de outro: só os dois combinam
  const f = nova(3)
  iniciarRodadaCoop(f)
  intencao(f, 9)
  const rf = resolverRodadaCoop(f, naMao(f, 0, 'kris-espadas-9'), naMao(f, 1, 'susie-espadas-8'), naMao(f, 2, 'ralsei-paus-3'))
  const lf = calcularGolpes(f, rf.golpes, [{}, {}, {}])
  assert.equal(fator(lf[0]), COOP.combo)
  assert.equal(fator(lf[1]), COOP.combo)
  assert.equal(fator(lf[2]), undefined)
  // PAR: mesmo valor, naipes diferentes
  const g = nova(3)
  iniciarRodadaCoop(g)
  intencao(g, 9)
  const rg = resolverRodadaCoop(g, naMao(g, 0, 'kris-espadas-9'), naMao(g, 1, 'susie-paus-9'), null)
  assert.equal(comboDosGolpes(rg.golpes), 'par')
  calcularGolpes(g, rg.golpes, [{}, {}, {}]).forEach((x) => assert.equal(x.multiplicadores.find(([n]) => n === 'PAR')[1], COOP.par))
  // caído não combina
  assert.equal(comboDosGolpes(rg.golpes, [false, true, false]), null)
})

test('SUPER COMBO com 3 SUPER: teto sobe, cada um leva a sua parte', () => {
  const e = nova(4)
  assert.equal(fracaoDoCombo('facil'), COOP.superCombo.facil)
  assert.equal(fracaoDoCombo('facil', 2), COOP.superCombo.facil)
  assert.ok(Math.abs(fracaoDoCombo('facil', 3) - COOP.superCombo.facil * 1.25) < 1e-9)
  assert.ok(Math.abs(fracaoDoCombo('facil', 4) - COOP.superCombo.facil * 1.5) < 1e-9)
  assert.equal(danoNoCombo(e), Math.round((e.chefe.hpMax * COOP.superCombo.facil) / 2))
  iniciarRodadaCoop(e)
  const ids = [0, 1, 2].map((j) => comSuper(e, j))
  const r = resolverRodadaCoop(e, ...ids, null)
  assert.equal(comboDosGolpes(r.golpes), 'super')
  const lista = calcularGolpes(e, r.golpes)
  assert.equal(lista.length, 3)
  const total = lista.reduce((t, g) => t + g.dano, 0)
  // 3 SUPER: o teto é o combo do nível +25% e o chefe de HP cheio aguenta
  assert.ok(Math.abs(total - e.chefe.hpMax * fracaoDoCombo('facil', 3)) <= 2, `combo ${total}`)
  assert.ok(total < e.chefe.hp)
  // um SUPER sozinho no grupo: sem combo, o golpe de sempre
  const f = nova(4)
  iniciarRodadaCoop(f)
  const rf = resolverRodadaCoop(f, comSuper(f, 0), null, null, null)
  assert.equal(comboDosGolpes(rf.golpes), null)
})

test('presença: ausente e saiu ficam fora do quadro, da mira e da escolha; a luta segue', () => {
  const e = nova(4)
  definirPresenca(e, { ausentes: [1], saiu: [3] })
  iniciarRodadaCoop(e)
  assert.deepEqual(e.chefe.mira, [0, 2], 'só 2 de pé e presentes: todos eles')
  assert.ok(motivoBloqueioCoop(e, 1, null) && motivoBloqueioCoop(e, 1, null).codigo === 'ausente')
  assert.equal(motivoBloqueioCoop(e, 3, null).codigo, 'ausente')
  intencao(e, 9)
  const energia = e.jogadores[1].energia
  const r = resolverRodadaCoop(e, ...passam(4))
  assert.deepEqual(r.quadro.jogadores, [true, false, true, false])
  assert.equal(e.jogadores[1].energia, energia, 'quem está fora não ganha energia de passar')
  // voltou da rede: entra de novo; saiu não volta
  definirPresenca(e, { ausentes: [] })
  assert.equal(e.jogadores[1].ausente, false)
  assert.equal(e.jogadores[3].saiu, true)
  definirPresenca(e, { ausentes: [] })
  assert.equal(e.jogadores[3].saiu, true, 'quem saiu de vez não volta')
})

test('derrota: todos os que ainda estão na luta caíram; o ausente não segura a luta', () => {
  const e = nova(4)
  iniciarRodadaCoop(e)
  definirPresenca(e, { ausentes: [3], saiu: [2] })
  e.jogadores[0].caido = true
  assert.equal(fimDaRodadaCoop(e).vencedor, null)
  e.jogadores[1].caido = true
  assert.equal(fimDaRodadaCoop(e).vencedor, 'derrota')
  // vitória: chefe a zero
  const f = nova(3)
  iniciarRodadaCoop(f)
  f.chefe.hp = 0
  assert.equal(fimDaRodadaCoop(f).vencedor, 'vitoria')
})

test('quem não caiu mas foi aplicado dano: aplicarDanoCoop derruba e o resgate pega', () => {
  const e = nova(3)
  iniciarRodadaCoop(e)
  intencao(e, 9)
  const r = resolverRodadaCoop(e, ...passam(3))
  aplicarDanoCoop(e, 1, 9999)
  assert.ok(e.jogadores[1].caido)
  assert.equal(e.jogadores[1].voltaEm, e.rodada + COOP.retornoRodadas + 1)
  assert.deepEqual(resgatarPorRodadaLimpa(e, { quadro: r.quadro, acertos: [0, 1, 0] }), [], 'houve acerto')
})

test('partida simulada inteira com 3 e 4 bots termina em vitória ou derrota', () => {
  for (const n of [3, 4]) {
    for (const chefe of ['king', 'queen', 'jevil', 'coronel']) {
      const e = criarPartidaCoop({ party: PARTY.slice(0, n), chefe, semente: `sim-${chefe}-${n}` })
      const rng = criarRng('simN')
      let fim = null
      let resgates = 0
      for (let r = 0; r < 120 && !fim; r++) {
        iniciarRodadaCoop(e)
        const jogadas = e.jogadores.map((_, j) => escolherJogadaCoop(e, j, { rng }))
        const res = resolverRodadaCoop(e, ...jogadas)
        const acertos = e.jogadores.map(() => 0)
        const q = res.quadro
        // o quadro é dos n, mas quem a mira escolheu leva um acerto a cada 2 rodadas
        if (q) for (const j of q.mira ?? []) if (e.rodada % 2 === 0) (acertos[j] += 1), aplicarDanoCoop(e, j, q.danos[j])
        calcularGolpes(e, res.golpes, e.jogadores.map(() => ({ grazes: 2 }))).forEach((g) => aplicarGolpe(e, g.dano))
        const f = fimDaRodadaCoop(e, { quadro: q, acertos })
        resgates += f.resgatados.length
        fim = f.vencedor
      }
      assert.ok(fim, `${chefe} com ${n}: a luta não acabou`)
      assert.ok(resgates >= 0)
    }
  }
})

test('o texto das cartas de suporte do grupo fala de aliados', () => {
  const luta = { hpMax: 300, nivel: 'facil', grupo: GRUPO[4] }
  assert.match(descricaoCoop(carta('kris-copas-10'), luta), /2 ALIADOS/)
  assert.match(descricaoCoop(carta('kris-copas-1'), luta), /TODOS/)
  assert.match(descricaoCoop(carta('kris-copas-10')), /VOCÊ E NO PARCEIRO/)
})
