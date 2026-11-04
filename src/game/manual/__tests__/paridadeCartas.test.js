// node --test src/game/manual/__tests__/paridadeCartas.test.js
// As páginas 3 e 4 do Manual do Ralsei usam as REGRAS REAIS das cartas: as cartas do baralho (nada
// inventado), motivoBloqueio, o custo pago por resolverRodada, o ganho de energia de passar e da rodada
// nova, e o mapeamento carta -> ataque (ataqueDaCarta) rodado pelo ContextoAtaque e pela classe Balas de
// verdade (com o Phaser de mentira, só lógica, ligado por module.register).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { ATAQUE } from '../../constants.js'
import { definirAtaque, juntos, sequencia, comCaixa } from '../../attacks/definir.js'
import { CARTAS, ataqueDaCarta, resumoDoAtaque } from '../../pvp/cartas.js'
import { criarPartida, iniciarRodada, resolverRodada, motivoBloqueio, ENERGIA } from '../../pvp/regras.js'
import { criarMesa, cartaDoManual, planoDaVitrine, MAO_P3, MAO_P4, CHUVA_P3, CARA_P4, ENERGIA_P4, DESENHO_DA_CARTA, PERSONAGEM_DO_MANUAL } from '../cartasDoManual.js'
import { criarPagina3 } from '../pagina3.js'
import { criarPagina4 } from '../pagina4.js'
import { cenaDeMentira } from './apoio/cenaDeMentira.mjs'

register('./apoio/ganchos.mjs', import.meta.url) // `phaser` -> Phaser de mentira (só lógica)
globalThis.window ??= {} // audio.js procura o AudioContext (não há: os ataques tocam nada)
const { ataques } = await import('../../attacks/index.js')
const { criarMotorDaVitrine } = await import('../vitrine.js')

const doBaralho = (id) => CARTAS[PERSONAGEM_DO_MANUAL].find((c) => c.id === id)

// uma partida real, montada à parte, com a mesma mão e energia
function partidaReal(mao, energia) {
  const estado = criarPartida({ p1: PERSONAGEM_DO_MANUAL, p2: PERSONAGEM_DO_MANUAL, semente: 'outra' })
  iniciarRodada(estado)
  estado.jogadores[0].energia = energia
  estado.jogadores[0].baralho.mao = mao.map((id) => ({ ...doBaralho(id) }))
  return estado
}

test('as cartas das páginas 3 e 4 são as do baralho do Ralsei (nada inventado)', () => {
  for (const id of [...MAO_P3, ...MAO_P4]) {
    assert.deepEqual(cartaDoManual(id), doBaralho(id), id)
    assert.ok(DESENHO_DA_CARTA[id], `${id}: tem desenho de giz`)
  }
  // página 3: cartas BARATAS de ataque (nenhuma de suporte), de ataques diferentes
  for (const id of MAO_P3) {
    const c = cartaDoManual(id)
    assert.ok(c.custo <= 2, `${id} custa ${c.custo}`)
    assert.notEqual(c.naipe, 'copas')
  }
  assert.equal(new Set(MAO_P3.map((id) => ataqueDaCarta(cartaDoManual(id), { ataques }).nome)).size, 3)
  // página 4: custos diferentes; a do meio não cabe na energia inicial e cabe depois de passar
  const custos = MAO_P4.map((id) => cartaDoManual(id).custo)
  assert.deepEqual(custos, [...custos].sort((a, b) => a - b))
  const cara = cartaDoManual(CARA_P4).custo
  assert.ok(cara > ENERGIA_P4 && cara <= ENERGIA_P4 + ENERGIA.passar + ENERGIA.porRodada)
  assert.throws(() => cartaDoManual('ralsei-espadas-99'))
})

test('bloqueio = motivoBloqueio de uma partida real, em qualquer energia', () => {
  for (let energia = 0; energia <= ENERGIA.maxima; energia++) {
    const mesa = criarMesa({ mao: MAO_P4, energia })
    const real = partidaReal(MAO_P4, energia)
    for (const id of MAO_P4) assert.deepEqual(mesa.bloqueio(id), motivoBloqueio(real, 0, id), `${id} com ${energia}`)
  }
  const p = criarPagina4()
  assert.deepEqual(p.bloqueioDe(1), motivoBloqueio(partidaReal(MAO_P4, ENERGIA_P4), 0, CARA_P4))
})

test('jogar = resolverRodada: paga o custo e manda a MESMA caixa que a arena roda', () => {
  for (const id of [...MAO_P3, CARA_P4]) {
    const mesa = criarMesa({ mao: [id], energia: 5 })
    const real = partidaReal([id], 5)
    const esperado = resolverRodada(real, id, null).caixas[1]
    const j = mesa.jogar(id)
    assert.equal(j.ok, true)
    assert.equal(j.gasto, cartaDoManual(id).custo)
    assert.equal(mesa.energia, real.jogadores[0].energia)
    assert.deepEqual({ ...j.caixa, carta: j.caixa.carta.id }, { ...esperado, carta: esperado.carta.id })
    assert.deepEqual({ dano: j.caixa.dano, ritmo: j.caixa.ritmo, inverterMs: j.caixa.inverterMs }, resumoDoAtaque(cartaDoManual(id)))
    assert.deepEqual(mesa.cartas.map((c) => c.id), [id], 'a mão volta igual (dá para tentar de novo)')
  }
  const mesa = criarMesa({ mao: MAO_P4, energia: ENERGIA_P4 })
  const r = mesa.jogar(CARA_P4)
  assert.equal(r.ok, false)
  assert.equal(r.bloqueio.curto, `falta energia (${ENERGIA_P4}/3)`)
  assert.equal(mesa.energia, ENERGIA_P4)
  const fixa = criarMesa({ mao: MAO_P3, energiaFixa: true })
  fixa.jogar(CHUVA_P3)
  assert.equal(fixa.energia, ENERGIA.maxima, 'página 3: a energia não é o assunto ainda')
})

test('passar = +ENERGIA.passar (resolverRodada) e +ENERGIA.porRodada (iniciarRodada), com o teto', () => {
  for (const energia of [0, 2, 8, 9, 10]) {
    const mesa = criarMesa({ mao: MAO_P4, energia })
    const real = partidaReal(MAO_P4, energia)
    resolverRodada(real, null, null)
    const depoisDePassar = real.jogadores[0].energia
    iniciarRodada(real)
    const e = mesa.passar()
    assert.deepEqual([e.antes, e.depoisDePassar, e.depois], [energia, depoisDePassar, real.jogadores[0].energia], `com ${energia}`)
    assert.equal(e.depoisDePassar, Math.min(ENERGIA.maxima, energia + ENERGIA.passar))
    assert.equal(e.depois, Math.min(ENERGIA.maxima, e.depoisDePassar + ENERGIA.porRodada))
    assert.deepEqual(mesa.cartas.map((c) => c.id), MAO_P4, 'a rodada nova não troca a mão do tutorial')
  }
})

// biblioteca falsa com a forma de attacks/index.js (o definir.js de verdade; só guarda a config)
function falsa() {
  const configs = []
  const falso = (nome) => {
    const padrao = definirAtaque({ nome, padrao: {}, iniciar() {} })
    return (cfg = {}) => {
      configs.push({ nome, cfg })
      return padrao(cfg)
    }
  }
  const A = new Proxy({ juntos, sequencia, comCaixa }, { get: (alvo, nome) => (nome in alvo || typeof nome !== 'string' ? alvo[nome] : (alvo[nome] = falso(nome))) })
  return { A, configs }
}

test('planoDaVitrine: o ataque de ataqueDaCarta (o da arena), com o dano/ritmo da caixa, na caixa fixa', () => {
  for (const id of [...MAO_P3, CARA_P4]) {
    const caixa = criarMesa({ mao: [id] }).jogar(id).caixa
    const a = falsa()
    const b = falsa()
    const plano = planoDaVitrine(caixa, a.A)
    const arena = ataqueDaCarta(caixa.carta, { ataques: b.A })
    assert.deepEqual(a.configs, b.configs, `${id}: a mesma receita, com os mesmos números`)
    assert.equal(plano.ataque.nome, arena.nome)
    assert.equal(plano.ataque.duracao, arena.duracao)
    assert.equal(plano.ataque.caixa, null, 'a lousa não muda de forma')
    assert.equal(plano.dano, caixa.dano)
    assert.deepEqual(plano.ritmo, caixa.ritmo)
    assert.equal(plano.inicio, ATAQUE.respiroMs, 'o respiro inicial de Pista.rodar')
  }
})

// roda o ataque REAL da carta na vitrine e anota cada bala quando nasce
function rodarNaVitrine(id) {
  const plano = planoDaVitrine(criarMesa({ mao: [id] }).jogar(id).caixa, ataques)
  const m = criarMotorDaVitrine(cenaDeMentira())
  m.rodar(plano)
  const l = m.caixa.limites
  const vistas = new Set()
  const nascidas = []
  let t = 0
  let desarmadas = null
  while (m.rodando) {
    m.passo(16)
    t += 16
    for (const b of m.balas.lista) {
      if (vistas.has(b)) continue
      vistas.add(b)
      nascidas.push({ t, x: b.x - l.left, y: b.y - l.top, vx: b.vx, vy: b.vy, raio: b.raio })
    }
    if (desarmadas === null && m.balas.lista.length && m.balas.lista.every((b) => b.inofensiva)) desarmadas = t
  }
  return { plano, nascidas, fim: t, desarmadas, l }
}

test('a vitrine roda o ataque REAL no relógio da Pista: respiro, ataque, desarmar, fim', () => {
  const { plano, nascidas, fim, desarmadas } = rodarNaVitrine(MAO_P3[1])
  assert.ok(nascidas.length > 5)
  assert.ok(nascidas[0].t > plano.inicio, 'nada nasce no respiro inicial')
  const total = plano.inicio + plano.ataque.duracao + ATAQUE.respiroMs
  assert.ok(Math.abs(fim - total) <= 16, `acaba em ${fim} (esperado ${total})`)
  assert.ok(desarmadas >= plano.inicio + plano.ataque.duracao - 16 && desarmadas <= plano.inicio + plano.ataque.duracao + 16, 'desarma no fim do ataque')
})

test('"a carta que faz chover": só a Estrela Gentil faz cair de cima (rodando os ataques de verdade)', () => {
  for (const id of MAO_P3) {
    const { nascidas, l } = rodarNaVitrine(id)
    // os projéteis "de verdade" (não os brilhos do rastro nem os granulados)
    const grandes = nascidas.filter((b) => b.raio >= 6)
    const deCima = grandes.filter((b) => b.y < 0 && b.vy > 0 && b.x > -20 && b.x < l.width + 20)
    if (id === CHUVA_P3) assert.equal(deCima.length, grandes.length, `${id}: tudo cai de cima`)
    else assert.ok(deCima.length < grandes.length / 2, `${id}: não é chuva (${deCima.length} de ${grandes.length} caem de cima)`)
  }
})

test('o boneco é o alvo: os ataques miram nele e passam por ele', () => {
  const plano = planoDaVitrine(criarMesa({ mao: [CHUVA_P3] }).jogar(CHUVA_P3).caixa, ataques)
  const m = criarMotorDaVitrine(cenaDeMentira())
  m.rodar(plano)
  let tocou = 0
  while (m.rodando) {
    m.passo(16)
    if (m.tocando()) tocou++
  }
  assert.ok(tocou > 10, `as estrelas passam pelo boneco (${tocou} quadros)`)
  assert.equal(m.balas.lista.length, 0, 'parou: nada sobra')
})

test('páginas 3 e 4 jogam pela mesa (as mesmas regras): a carta jogada na página é a caixa real', () => {
  const p = criarPagina3()
  while (p.etapa === 'intro') p.avancar()
  p.avancar()
  const [j] = p.drenar().filter((e) => e.tipo === 'jogou')
  const real = partidaReal([MAO_P3[0]], 10)
  assert.deepEqual(j.caixa.dano, resolverRodada(real, MAO_P3[0], null).caixas[1].dano)
})
