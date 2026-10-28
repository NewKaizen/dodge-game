// Escolha às cegas no PVP online (só até a revelação) (pvp/sigilo.js) e o que o host manda a cada convidado
// (pvp/rede/ArenaRede.js no 1x1, pvp/rede/ArenaRedeN.js no todos contra todos):
// node --test src/game/pvp/__tests__/sigilo.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CARTAS } from '../cartas.js'
import { criarFichas, cartaOculta, cartaRevelada, mascararEstado, mascararResultado, mascararDadosDeCena, idsDeCartaEm } from '../sigilo.js'
import { criarPartida, iniciarRodada, resolverRodada, fimDaRodada, ENERGIA } from '../regras.js'
import { criarPartidaFfa, iniciarRodadaFfa, resolverRodadaFfa } from '../ffa.js'
import ArenaRede from '../rede/ArenaRede.js'
import ArenaRedeN from '../rede/ArenaRedeN.js'
import ArenaRedeCoop from '../../coop/ArenaRedeCoop.js'

const todas = Object.values(CARTAS).flat()
const TODOS_OS_IDS = todas.map((c) => c.id)
// as cartas que estão no baralho da vaga (uma roubada do outro passa a ser dela: aí ela vê inteira)
const doBaralho = (estado, j) => {
  const b = estado.jogadores[j].baralho
  return new Set([...b.monte, ...b.mao, ...b.descarte].map((c) => c.id.split('~')[0]))
}
const semAsMinhas = (ids, estado, j) => ids.filter((id) => !doBaralho(estado, j).has(id))

// ---------- a carta revelada e as fichas ----------
test('a carta revelada é a de verdade (nome, valor, naipe), só com a ficha no lugar do id', () => {
  const ficha = criarFichas()
  for (const c of todas) {
    const r = cartaRevelada(c, ficha)
    assert.notEqual(r.id, c.id)
    assert.equal(r.id, ficha(c.id))
    assert.ok(!r.oculta)
    assert.deepEqual({ ...r, id: c.id }, c)
    assert.equal(cartaRevelada(cartaOculta(c, ficha), ficha).oculta, true, 'a da mão virada continua virada')
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
    assert.ok(visto.jogadores[0].baralho.mao.every((c) => c.oculta && c.custo === undefined))
    assert.deepEqual(idsDeCartaEm(estado, doP1).length > 0, true, '(o original fica com tudo)')
  }
})

test('1x1: o resultado visto por cada um tem a carta REAL do outro (nome e valor), com a ficha no id; a minha fica inteira', () => {
  const { lista } = partida1x1()
  const ficha = criarFichas()
  for (const { res } of lista) {
    for (const eu of [0, 1]) {
      const visto = mascararResultado(res, eu, ficha)
      const outra = visto.jogadas[1 - eu]
      const real = res.jogadas[1 - eu].carta
      if (real) {
        assert.equal(outra.carta.nome, real.nome)
        assert.equal(outra.carta.valor, real.valor)
        assert.equal(outra.carta.naipe, real.naipe)
        assert.equal(outra.carta.id, ficha(real.id))
        assert.ok(!outra.carta.oculta && !('categoria' in outra.carta))
      }
      if (res.jogadas[eu].carta) assert.equal(visto.jogadas[eu].carta.id, res.jogadas[eu].carta.id, 'a minha continua inteira')
      visto.caixas.forEach((c, k) => c && assert.equal(c.dano, res.caixas[k].dano) && assert.equal(c.carta.nome, res.caixas[k].carta.nome))
    }
  }
})

test('FFA: o estado visto por cada vaga não tem id de carta dos outros; o resultado traz as cartas jogadas de verdade', () => {
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
      const visto = mascararResultado(res, eu, ficha)
      visto.jogadas.forEach((jog, j) => jog?.carta && assert.equal(jog.carta.nome, res.jogadas[j].carta.nome, `resultado, vaga ${eu}, jogada ${j}`))
    }
  }
})

test('dados de cena: a retomada vai mascarada (o estado), sem id de carta do outro', () => {
  const { e } = partida1x1(4)
  const visto = mascararDadosDeCena({ retomada: { estado: e, extra: {} } }, 1, criarFichas())
  assert.deepEqual(idsDeCartaEm(visto, CARTAS.kris.map((c) => c.id)), [])
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

test('1x1 em rede: ANTES de travar nada que o host manda tem a carta dele; DEPOIS a resolução leva a carta de verdade', async () => {
  const canal = canalFalso()
  const estado = criarPartida({ p1: 'kris', p2: 'susie', semente: 'fio' })
  const arena = { estado, saindo: false, sys: { settings: { data: { p1: 'kris', p2: 'susie' } } }, comecarRodada: () => iniciarRodada(estado), bonusPendente: null, extrasRetomada: () => ({}) }
  const rede = new ArenaRede(arena, { canal, meuLado: 0, souHost: true })
  const doHost = CARTAS.kris.map((c) => c.id)
  for (let r = 0; r < 10 && !estado.vencedor; r++) {
    canal.saidas.length = 0
    await rede.iniciarRodada()
    estado.jogadores.forEach((j) => (j.energia = ENERGIA.maxima))
    const minha = estado.jogadores[0].baralho.mao[r % 5].id
    rede.enviarJogada(minha)
    // escolha às cegas: o que foi ao convidado até aqui (inicio, jogada) não tem carta nenhuma do host
    assert.ok(canal.saidas.some((m) => m.tipo === 'jogada'))
    for (const m of canal.saidas) assert.deepEqual(idsDeCartaEm(m.dados, semAsMinhas(doHost, estado, 1)), [], `${m.tipo} antes de travar, rodada ${r}`)
    const jogadas = [minha, estado.jogadores[1].baralho.mao[0].id]
    const decisao = resolverRodada(estado, ...jogadas)
    canal.saidas.length = 0
    rede.enviarResolucao(jogadas, { bonus: null, adiado: false, resultado: decisao })
    // travou: a resolução leva as jogadas de verdade e a carta de verdade do host (id = ficha)
    const msg = canal.saidas.find((m) => m.tipo === 'resolucao').dados
    assert.deepEqual(msg.jogadas, jogadas)
    const carta = msg.resultado.jogadas[0].carta
    assert.equal(carta.nome, decisao.jogadas[0].carta.nome)
    assert.equal(carta.valor, decisao.jogadas[0].carta.valor)
    assert.notEqual(carta.id, minha)
    assert.ok(!carta.oculta && !('categoria' in carta))
    // (a mão, o monte e o descarte dele continuam escondidos)
    const mao = msg.estado.jogadores[0].baralho
    assert.ok([...mao.mao, ...mao.monte, ...mao.descarte].every((c) => c.oculta))
    await rede.fimDaRodada()
  }
  // a cena (retomada / resultado) vai mascarada
  assert.deepEqual(idsDeCartaEm(rede.mascararCenaPara(rede.dadosRetomada(), 'convidado'), semAsMinhas(doHost, estado, 1)), [])
  rede.destruir()
})

test('1x1 em rede: no host a mão do outro fica virada e a carta dele revelada é a real; no CO-OP nada se esconde', () => {
  const estado = criarPartida({ p1: 'kris', p2: 'susie', semente: 'ver' })
  iniciarRodada(estado)
  const arena = { estado, saindo: false, sys: { settings: { data: {} } } }
  const rede = new ArenaRede(arena, { canal: canalFalso(), meuLado: 0, souHost: true })
  assert.ok(rede.verMao(1, estado.jogadores[1].baralho.mao).every((c) => c.oculta))
  assert.deepEqual(rede.verMao(0, estado.jogadores[0].baralho.mao), estado.jogadores[0].baralho.mao)
  const r = resolverRodada(estado, estado.jogadores[0].baralho.mao[0].id, estado.jogadores[1].baralho.mao[0].id)
  const visto = rede.verResultado(r)
  assert.equal(visto.jogadas[1].carta.nome, r.jogadas[1].carta.nome)
  assert.ok(!visto.jogadas[1].carta.oculta)
  assert.notEqual(visto.jogadas[1].carta.id, r.jogadas[1].carta.id, 'o id é a ficha da carta virada na mão')
  assert.equal(visto.jogadas[0].carta.id, r.jogadas[0].carta.id)
  const coop = new ArenaRedeCoop(arena, { canal: canalFalso(), meuLado: 0, souHost: true })
  assert.equal(coop.esconderCartas, false)
  assert.equal(coop.verMao(1, estado.jogadores[1].baralho.mao), estado.jogadores[1].baralho.mao)
  assert.equal(coop.verResultado(r), r)
  rede.destruir()
  coop.destruir()
})

test('FFA em rede: antes de travar ninguém recebe carta; a resolução de cada um leva as cartas jogadas de verdade', async () => {
  const canal = canalFalso()
  const pers = ['kris', 'susie', 'ralsei', 'dess']
  const estado = criarPartidaFfa({ personagens: pers, semente: 'fio-ffa' })
  const membros = pers.map((_, k) => ({ id: `v${k}`, indice: k, nome: `V${k}`, caiu: null }))
  const arena = { estado, saindo: false, sys: { settings: { data: {} } }, acertosRodada: [0, 0, 0, 0], ko: [], extrasRetomada: () => ({}) }
  const rede = new ArenaRedeN(arena, { canal, meuIndice: 0, souHost: true, participantes: () => membros })
  const dos = (vaga) => semAsMinhas(pers.filter((_, k) => k !== vaga).flatMap((p) => CARTAS[p].map((c) => c.id)), estado, vaga)
  for (let r = 0; r < 6; r++) {
    canal.saidas.length = 0
    await rede.iniciarRodada()
    estado.jogadores.forEach((j) => (j.energia = ENERGIA.maxima))
    for (const m of canal.saidas) assert.deepEqual(idsDeCartaEm(m.dados, dos(membros.find((x) => x.id === m.para).indice)), [], `${m.tipo} antes de travar`)
    const jogadas = estado.jogadores.map((j) => j.baralho.mao[0].id)
    const res = resolverRodadaFfa(estado, jogadas)
    canal.saidas.length = 0
    rede.enviarResolucao(jogadas, res)
    for (const m of canal.saidas.filter((x) => x.tipo === 'resolucao')) {
      const vaga = membros.find((x) => x.id === m.para).indice
      assert.deepEqual(m.dados.jogadas, jogadas)
      m.dados.resultado.jogadas.forEach((jog, j) => jog?.carta && assert.equal(jog.carta.nome, res.jogadas[j].carta.nome, `vaga ${vaga} vê a jogada ${j}`))
      assert.deepEqual(idsDeCartaEm(m.dados.estado, dos(vaga)), [], 'o estado continua sem as mãos dos outros')
    }
    await rede.fimDaRodada([])
  }
  const cena = rede.mascararCenaPara({ retomada: { estado } }, 'v2')
  assert.deepEqual(idsDeCartaEm(cena, ['kris', 'susie', 'dess'].flatMap((p) => CARTAS[p].map((c) => c.id))), [])
  rede.destruir()
})

test('nenhum texto de categoria sobrou no código das cenas e da carta', async () => {
  const { readFileSync } = await import('node:fs')
  for (const f of ['../../entities/Carta.js', '../../scenes/PvpArena.js', '../../scenes/PvpArenaN.js', '../../scenes/PvpResultado.js']) {
    const txt = readFileSync(new URL(f, import.meta.url), 'utf8')
    assert.ok(!/CATEGORIA|categoria|definirCategoria|mostrarSelo\b/.test(txt), f)
  }
})

test('a semente da partida não refaz o baralho do outro: o host embaralha de novo e o RNG dele não viaja', async () => {
  const { embaralharEscondido } = await import('../sigilo.js')
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
