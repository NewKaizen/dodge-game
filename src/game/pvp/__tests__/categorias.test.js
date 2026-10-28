// Cartas escondidas no PVP online (pvp/categorias.js) e o que o host manda a cada convidado
// (pvp/rede/ArenaRede.js no 1x1, pvp/rede/ArenaRedeN.js no todos contra todos):
// node --test src/game/pvp/__tests__/categorias.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { definirAtaque, juntos, sequencia, comCaixa } from '../../attacks/definir.js'
import { CARTAS, ehSuper, ataqueDaCarta, especialDaCarta } from '../cartas.js'
import { CATEGORIAS, categoriaDaCarta, criarFichas, cartaOculta, cartaRevelada, mascararEstado, mascararResultado, mascararDadosDeCena, mascararEstatisticas, idsDeCartaEm } from '../categorias.js'
import { criarPartida, iniciarRodada, resolverRodada, fimDaRodada, energiaPerfeito, ENERGIA } from '../regras.js'
import { criarPartidaFfa, iniciarRodadaFfa, resolverRodadaFfa } from '../ffa.js'
import ArenaRede from '../rede/ArenaRede.js'
import ArenaRedeN from '../rede/ArenaRedeN.js'
import ArenaRedeCoop from '../../coop/ArenaRedeCoop.js'

const falso = (nome) => {
  const padrao = definirAtaque({ nome, padrao: {}, iniciar() {} })
  return (cfg = {}) => ({ ...padrao(cfg), cfg })
}
const A = new Proxy({ juntos, sequencia, comCaixa }, { get: (alvo, nome) => (nome in alvo || typeof nome !== 'string' ? alvo[nome] : (alvo[nome] = falso(nome))) })
const todas = Object.values(CARTAS).flat()
const TODOS_OS_IDS = todas.map((c) => c.id)
// as cartas que estão no baralho da vaga (uma roubada do outro passa a ser dela: aí ela vê inteira)
const doBaralho = (estado, j) => {
  const b = estado.jogadores[j].baralho
  return new Set([...b.monte, ...b.mao, ...b.descarte].map((c) => c.id.split('~')[0]))
}
const semAsMinhas = (ids, estado, j) => ids.filter((id) => !doBaralho(estado, j).has(id))

// ---------- a categoria de cada carta ----------

test('toda carta de todo baralho tem categoria: naipe (o Ás no do naipe dele) ou SUPER', () => {
  const esperado = { espadas: 'ataque', ouros: 'controle', paus: 'armadilha', copas: 'suporte' }
  for (const c of todas) {
    const cat = categoriaDaCarta(c)
    assert.ok(CATEGORIAS[cat], c.id)
    assert.equal(cat, ehSuper(c) ? 'super' : esperado[c.naipe], c.id)
  }
  // os quatro Ases especiais
  const kris = CARTAS.kris
  assert.deepEqual(
    kris.filter((c) => c.valor === 1).map((c) => [especialDaCarta(c), categoriaDaCarta(c)]).sort(),
    [['anular', 'controle'], ['espelho', 'ataque'], ['roubo', 'armadilha'], ['segundaChance', 'suporte']],
  )
  assert.equal(categoriaDaCarta(null), null)
  for (const info of Object.values(CATEGORIAS)) assert.ok(info.rotulo && info.icone && info.cor)
})

test('a carta revelada não tem o id, o valor nem o nome; roda o MESMO ataque e dá a mesma energia de perfeito', () => {
  const ficha = criarFichas()
  for (const c of todas) {
    const r = cartaRevelada(c, ficha)
    assert.notEqual(r.id, c.id)
    assert.equal(r.oculta, true)
    assert.equal(r.nome, CATEGORIAS[r.categoria].rotulo)
    assert.equal(r.valor, ehSuper(c) ? 14 : null)
    assert.deepEqual(idsDeCartaEm(r, TODOS_OS_IDS), [], c.id)
    assert.ok(!JSON.stringify(r).includes(c.nome) || c.nome === r.nome, `${c.id}: o nome não viaja`)
    assert.equal(energiaPerfeito(r), energiaPerfeito(c), c.id)
    const real = ataqueDaCarta(c, { ataques: A })
    const visto = ataqueDaCarta(r, { ataques: A })
    assert.deepEqual(visto && { nome: visto.nome, cfg: visto.cfg }, real && { nome: real.nome, cfg: real.cfg }, c.id)
    assert.equal(cartaRevelada(r, ficha), r, 'revelar de novo não muda')
  }
})

test('fichas: a mesma carta dá a mesma ficha; cartas diferentes, fichas diferentes; ficha não vira outra', () => {
  const ficha = criarFichas()
  const f = TODOS_OS_IDS.map(ficha)
  assert.equal(new Set(f).size, f.length)
  assert.equal(ficha(TODOS_OS_IDS[3]), f[3])
  assert.equal(ficha(f[3]), f[3])
  assert.equal(cartaOculta(cartaOculta(CARTAS.kris[0], ficha), ficha).id, ficha(CARTAS.kris[0].id))
})

// ---------- o estado e o resultado vistos por cada um ----------

function partida1x1(rodadas = 12, semente = 'cat') {
  const e = criarPartida({ p1: 'kris', p2: 'susie', semente })
  const lista = []
  for (let r = 0; r < rodadas && !e.vencedor; r++) {
    iniciarRodada(e)
    e.jogadores.forEach((j) => (j.energia = ENERGIA.maxima))
    const jog = e.jogadores.map((j, k) => j.baralho.mao[(r + k) % j.baralho.mao.length].id)
    const res = resolverRodada(e, jog[0], jog[1])
    lista.push({ estado: structuredClone(e), res, jog })
    fimDaRodada(e)
  }
  return { e, lista }
}

test('1x1: o estado visto pelo P2 não tem nenhum id de carta do P1 (mão, monte, descarte, histórico), e o dele fica igual', () => {
  const { lista } = partida1x1()
  const ficha = criarFichas()
  const doP1 = CARTAS.kris.map((c) => c.id)
  for (const { estado } of lista) {
    const visto = mascararEstado(estado, 1, ficha)
    assert.deepEqual(idsDeCartaEm(visto, doP1), [])
    assert.deepEqual(visto.jogadores[1].baralho, estado.jogadores[1].baralho)
    assert.equal(visto.jogadores[0].baralho.mao.length, estado.jogadores[0].baralho.mao.length)
    assert.ok(visto.jogadores[0].baralho.mao.every((c) => c.oculta && !c.categoria && c.custo === undefined))
    assert.deepEqual(idsDeCartaEm(estado, doP1).length > 0, true, '(o original fica com tudo)')
  }
})

test('1x1: o resultado visto por cada um só tem as cartas dele; a do outro é a categoria', () => {
  const { lista } = partida1x1()
  const ficha = criarFichas()
  for (const { res, estado } of lista) {
    for (const eu of [0, 1]) {
      const deles = semAsMinhas(CARTAS[eu ? 'kris' : 'susie'].map((c) => c.id), estado, eu)
      const visto = mascararResultado(res, eu, ficha)
      assert.deepEqual(idsDeCartaEm(visto, deles), [], `visto por ${eu}`)
      const outra = visto.jogadas[1 - eu]
      if (outra.carta) assert.equal(outra.carta.categoria, categoriaDaCarta(res.jogadas[1 - eu].carta))
      if (res.jogadas[eu].carta) assert.equal(visto.jogadas[eu].carta.id, res.jogadas[eu].carta.id, 'a minha continua inteira')
      visto.caixas.forEach((c, k) => c && assert.equal(c.dano, res.caixas[k].dano))
    }
  }
})

test('FFA: o estado e o resultado vistos por cada vaga não têm id de carta dos outros', () => {
  const pers = ['kris', 'susie', 'ralsei', 'dess']
  const e = criarPartidaFfa({ personagens: pers, semente: 'cat-ffa' })
  const ficha = criarFichas()
  for (let r = 0; r < 8; r++) {
    iniciarRodadaFfa(e)
    e.jogadores.forEach((j) => (j.energia = ENERGIA.maxima))
    const res = resolverRodadaFfa(e, e.jogadores.map((j, k) => j.baralho.mao[(r + k) % j.baralho.mao.length].id))
    for (let eu = 0; eu < 4; eu++) {
      const outros = semAsMinhas(pers.filter((_, k) => k !== eu).flatMap((p) => CARTAS[p].map((c) => c.id)), e, eu)
      assert.deepEqual(idsDeCartaEm(mascararEstado(e, eu, ficha), outros), [], `estado, vaga ${eu}`)
      assert.deepEqual(idsDeCartaEm(mascararResultado(res, eu, ficha), outros), [], `resultado, vaga ${eu}`)
    }
  }
})

test('dados de cena: retomada e estatísticas do resultado (1x1 { p1, p2 } e FFA jogadores[])', () => {
  const { e } = partida1x1(4)
  const ficha = criarFichas()
  const maior = (p) => ({ ...CARTAS[p].find((c) => c.valor === 13) })
  const dados = { retomada: { estado: e, extra: { estatisticas: [{ maiorCarta: maior('kris') }, { maiorCarta: maior('susie') }] } }, estatisticas: { p1: { maiorCarta: maior('kris') }, p2: { maiorCarta: maior('susie') } } }
  const visto = mascararDadosDeCena(dados, 1, ficha)
  assert.deepEqual(idsDeCartaEm(visto, CARTAS.kris.map((c) => c.id)), [])
  assert.equal(visto.estatisticas.p2.maiorCarta.id, 'susie-espadas-13'.replace('espadas', maior('susie').naipe))
  assert.equal(visto.estatisticas.p1.maiorCarta.categoria, categoriaDaCarta(maior('kris')))
  const ffa = mascararEstatisticas([{ maiorCarta: maior('kris') }, { maiorCarta: null }, { maiorCarta: maior('dess') }], 2, ficha)
  assert.equal(ffa[0].maiorCarta.oculta, true)
  assert.equal(ffa[2].maiorCarta.id, maior('dess').id)
})

// ---------- o que a ponte do host põe no fio ----------

function canalFalso() {
  const saidas = []
  return {
    saidas,
    ao: () => () => {},
    enviar: (tipo, chave, dados) => saidas.push({ tipo, chave, dados: structuredClone(dados) }),
    enviarPara: (para, tipo, chave, dados) => saidas.push({ para, tipo, chave, dados: structuredClone(dados) }),
    enviarRapido: () => {},
    receber: async () => null,
  }
}

test('1x1 em rede: nada que o host manda ao convidado tem o id exato de uma carta do host', async () => {
  const canal = canalFalso()
  const estado = criarPartida({ p1: 'kris', p2: 'susie', semente: 'fio' })
  const arena = { estado, saindo: false, sys: { settings: { data: { p1: 'kris', p2: 'susie' } } }, comecarRodada: () => iniciarRodada(estado), bonusPendente: null, extrasRetomada: () => ({ estatisticas: [{ maiorCarta: { ...CARTAS.kris[5] } }, { maiorCarta: null }] }) }
  const rede = new ArenaRede(arena, { canal, meuLado: 0, souHost: true })
  const doHost = CARTAS.kris.map((c) => c.id)
  for (let r = 0; r < 10 && !estado.vencedor; r++) {
    await rede.iniciarRodada()
    estado.jogadores.forEach((j) => (j.energia = ENERGIA.maxima))
    const minha = estado.jogadores[0].baralho.mao[r % 5].id
    rede.enviarJogada(minha)
    const jogadas = [minha, estado.jogadores[1].baralho.mao[0].id]
    rede.enviarResolucao(jogadas, { bonus: null, adiado: false, resultado: resolverRodada(estado, ...jogadas) })
    await rede.fimDaRodada()
  }
  assert.ok(canal.saidas.length >= 30)
  // (uma carta que o convidado roubou do host passa a ser dele: ela pode aparecer inteira)
  for (const m of canal.saidas) assert.deepEqual(idsDeCartaEm(m.dados, semAsMinhas(doHost, estado, 1)), [], `${m.tipo} da rodada ${m.chave}`)
  // a cena (retomada / resultado) também
  assert.deepEqual(idsDeCartaEm(rede.mascararCenaPara(rede.dadosRetomada(), 'convidado'), semAsMinhas(doHost, estado, 1)), [])
  // o convidado vê as próprias cartas
  assert.ok(idsDeCartaEm(canal.saidas.filter((m) => m.tipo === 'inicio').map((m) => m.dados), CARTAS.susie.map((c) => c.id)).length > 0)
  rede.destruir()
})

test('1x1 em rede: no host a mão do outro e a carta dele aparecem escondidas; no CO-OP nada se esconde', () => {
  const estado = criarPartida({ p1: 'kris', p2: 'susie', semente: 'ver' })
  iniciarRodada(estado)
  const arena = { estado, saindo: false, sys: { settings: { data: {} } } }
  const rede = new ArenaRede(arena, { canal: canalFalso(), meuLado: 0, souHost: true })
  assert.ok(rede.verMao(1, estado.jogadores[1].baralho.mao).every((c) => c.oculta))
  assert.deepEqual(rede.verMao(0, estado.jogadores[0].baralho.mao), estado.jogadores[0].baralho.mao)
  const r = resolverRodada(estado, estado.jogadores[0].baralho.mao[0].id, estado.jogadores[1].baralho.mao[0].id)
  const visto = rede.verResultado(r)
  assert.equal(visto.jogadas[1].carta.oculta, true)
  assert.equal(visto.jogadas[0].carta.id, r.jogadas[0].carta.id)
  const coop = new ArenaRedeCoop(arena, { canal: canalFalso(), meuLado: 0, souHost: true })
  assert.equal(coop.esconderCartas, false)
  assert.equal(coop.verMao(1, estado.jogadores[1].baralho.mao), estado.jogadores[1].baralho.mao)
  assert.equal(coop.verResultado(r), r)
  rede.destruir()
  coop.destruir()
})

test('FFA em rede: cada convidado recebe a SUA versão; nenhuma tem carta exata dos outros', async () => {
  const canal = canalFalso()
  const pers = ['kris', 'susie', 'ralsei', 'dess']
  const estado = criarPartidaFfa({ personagens: pers, semente: 'fio-ffa' })
  const membros = pers.map((_, k) => ({ id: `v${k}`, indice: k, nome: `V${k}`, caiu: null }))
  const arena = { estado, saindo: false, sys: { settings: { data: {} } }, acertosRodada: [0, 0, 0, 0], ko: [], extrasRetomada: () => ({}) }
  const rede = new ArenaRedeN(arena, { canal, meuIndice: 0, souHost: true, participantes: () => membros })
  for (let r = 0; r < 6; r++) {
    await rede.iniciarRodada()
    estado.jogadores.forEach((j) => (j.energia = ENERGIA.maxima))
    const jogadas = estado.jogadores.map((j) => j.baralho.mao[0].id)
    rede.enviarResolucao(jogadas, resolverRodadaFfa(estado, jogadas))
    await rede.fimDaRodada([])
  }
  const paraVagas = canal.saidas.filter((m) => m.para)
  assert.ok(paraVagas.length >= 6 * 3 * 3)
  assert.equal(canal.saidas.filter((m) => !m.para && ['inicio', 'resolucao', 'fimRodada'].includes(m.tipo)).length, 0, 'nada disso vai igual para todos')
  for (const m of paraVagas) {
    const vaga = membros.find((x) => x.id === m.para).indice
    const outros = semAsMinhas(pers.filter((_, k) => k !== vaga).flatMap((p) => CARTAS[p].map((c) => c.id)), estado, vaga)
    assert.deepEqual(idsDeCartaEm(m.dados, outros), [], `${m.tipo} para a vaga ${vaga}`)
  }
  const cena = rede.mascararCenaPara({ jogadores: estado.jogadores.map((j) => ({ maiorCarta: { ...CARTAS[j.personagem][4] } })) }, 'v2')
  assert.deepEqual(idsDeCartaEm(cena, ['kris', 'susie', 'dess'].flatMap((p) => CARTAS[p].map((c) => c.id))), [])
  rede.destruir()
})

test('a semente da partida não refaz o baralho do outro: o host embaralha de novo e o RNG dele não viaja', async () => {
  const { embaralharEscondido } = await import('../categorias.js')
  const semente = 'sala-publica'
  const host = criarPartida({ p1: 'kris', p2: 'susie', semente })
  const doConvidado = criarPartida({ p1: 'kris', p2: 'susie', semente }) // o que o convidado consegue calcular
  let x = 0.123
  embaralharEscondido(host, () => (x = (x * 9301 + 0.49297) % 1))
  const ordem = (e) => e.jogadores[0].baralho.monte.map((c) => c.id).join()
  assert.notEqual(ordem(host), ordem(doConvidado))
  assert.deepEqual([...host.jogadores[0].baralho.monte].map((c) => c.id).sort(), doConvidado.jogadores[0].baralho.monte.map((c) => c.id).sort(), 'as mesmas cartas')
  const visto = mascararEstado(host, 1, criarFichas())
  assert.deepEqual(visto.jogadores[0].baralho.rng, { s: 0 })
  assert.deepEqual(visto.rng, { s: 0 })
  assert.deepEqual(visto.jogadores[1].baralho.rng, host.jogadores[1].baralho.rng, 'o meu RNG fica')
})
