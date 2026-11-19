// Os BOTS do JOGAR RÁPIDO (server/bots/, docs/online.md "Bots do Jogar Rápido"): a faixa e a estimativa do
// jogador, os apelidos e os perfis, as decisões, a fila (8–20 s sem gente: bot), uma partida INTEIRA do bot
// contra um host simulado (o protocolo do navegador: hostSimulado.js), o XP pelo caminho de sempre, a
// validação (um host que forja o HP do bot não leva a vitória) e que o jogador NÃO tem como saber: as
// mensagens que ele recebe numa partida contra bot têm a mesma forma das de uma partida contra gente.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { criarLobby, PROTOCOLO } from '../lan.js'
import { criarContasFalsas } from '../contasFalsas.js'
import { criarMetricas } from '../metricas.js'
import { FAIXAS, ORDEM_FAIXAS, numerosDe, estimarJogador, faixaPara, ajustarRecentes } from '../bots/habilidade.js'
import { gerarApelido, gerarApelidos, apelidoValido } from '../bots/nomes.js'
import { gerarPerfilDeBot, distribuirNiveis } from '../bots/perfil.js'
import { tempoDePensar, caminhoDoCursor, escolherCarta, IDS_PERSONAGENS } from '../bots/decisoes.js'
import { respostaWebRtc, tempoDaEscolha } from '../bots/cerebro.js'
import { criarBots, specDoBanco, botsLigados, LIMIAR_MS } from '../bots/index.js'
import { criarCaixa } from '../bots/esquiva.js'
import { criarDuelo, duracaoDoDuelo } from '../bots/duelo.js'
import { simularPartida } from '../bots/simulacao.js'
import { criarPartida, iniciarRodada } from '../../src/game/pvp/regras.js'
import { CARTAS, resumoDoAtaque } from '../../src/game/pvp/cartas.js'
import { nivelDoXp, itensAte } from '../../src/lib/progresso.js'
import { criarHostSimulado } from './hostSimulado.js'

// sorteio repetível
function sorteio(semente = 1) {
  let s = semente >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function relogioFalso() {
  let t = 1_700_000_000_000
  const timers = new Set()
  return {
    agora: () => t,
    agendar(fn, ms) {
      const x = { fn, quando: t + Math.max(0, ms) }
      timers.add(x)
      return () => timers.delete(x)
    },
    andar(ms) {
      const fim = t + ms
      for (;;) {
        const proximo = [...timers].filter((x) => x.quando <= fim).sort((a, b) => a.quando - b.quando)[0]
        if (!proximo) break
        t = Math.max(t, proximo.quando)
        if (timers.delete(proximo)) proximo.fn()
      }
      t = fim
    },
  }
}
const microtarefas = async () => {
  for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r))
}

// ---------- faixas e estimativa ----------

test('faixas: de iniciante a muito bom, e os números ficam mais fortes com q', () => {
  assert.deepEqual(ORDEM_FAIXAS, ['iniciante', 'casual', 'medio', 'bom', 'muito_bom'])
  const fraco = numerosDe(FAIXAS.iniciante)
  const forte = numerosDe(FAIXAS.muito_bom)
  assert.ok(fraco.esquiva.decidirMs > forte.esquiva.decidirMs, 'o iniciante reage mais devagar')
  assert.ok(fraco.esquiva.erro > forte.esquiva.erro && fraco.esquiva.lapso > forte.esquiva.lapso, 'e erra mais')
  assert.ok(fraco.cartas.ruido > forte.cartas.ruido && fraco.cartas.errar > forte.cartas.errar)
  assert.ok(fraco.copia.ritmo < forte.copia.ritmo)
  assert.ok(fraco.pensarMs[1] > forte.pensarMs[1], 'e pensa mais')
})

test('estimativa do jogador: o nível pesa um pouco, os resultados recentes corrigem', () => {
  const novo = estimarJogador({ nivel: 1 })
  const veterano = estimarJogador({ nivel: 40 })
  assert.ok(novo < veterano)
  assert.equal(faixaPara(novo), 'iniciante', 'quem acabou de chegar pega um bot ganhável')
  const ganhando = estimarJogador({ nivel: 1, recentes: [true, true, true, true, true] })
  const perdendo = estimarJogador({ nivel: 40, recentes: [false, false, false, false, false] })
  assert.ok(ganhando > novo + 0.2, 'ganhou várias: sobe')
  assert.ok(perdendo < veterano - 0.2, 'perdeu várias: desce')
  assert.equal(faixaPara(0.99), 'muito_bom')
  assert.equal(ajustarRecentes(Array(8).fill(false), true).length, 8)
  assert.equal(ajustarRecentes([], true).at(-1), true)
})

// ---------- apelidos e perfis ----------

test('apelidos: válidos, diferentes entre si, sem nome de gente', () => {
  const rng = sorteio(7)
  const lista = gerarApelidos(300, rng)
  assert.equal(lista.length, 300)
  assert.equal(new Set(lista.map((n) => n.toLowerCase())).size, 300)
  for (const n of lista) assert.ok(apelidoValido(n), n)
  // nenhum prenome comum (o gerador só usa bichos, comidas, folclore e coisas)
  const prenomes = /\b(joao|maria|jose|ana|lucas|pedro|gabriel|rafael|felipe|bruno|carlos|paulo|marcos|julia|beatriz|larissa|mateus|gustavo|enzo|miguel|davi|arthur|alice|sophia|laura|helena)\b/i
  for (const n of lista) assert.doesNotMatch(n.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_.]/g, ' '), prenomes, n)
  assert.ok(apelidoValido(gerarApelido(sorteio(3))))
  assert.equal(apelidoValido('ab'), false)
  assert.equal(apelidoValido('nome com acentuação'), false)
})

test('perfil de bot: nível, XP, partidas e cosméticos coerentes (só itens que ele tem)', () => {
  const rng = sorteio(11)
  const niveis = distribuirNiveis(200, rng)
  assert.ok(niveis.filter((n) => n <= 5).length > 30, 'muitos níveis baixos')
  assert.ok(niveis.some((n) => n >= 26), 'alguns altos')
  for (let i = 0; i < 60; i++) {
    const p = gerarPerfilDeBot({ nome: gerarApelido(rng), rng })
    assert.equal(nivelDoXp(p.xp), p.nivel)
    assert.ok(ORDEM_FAIXAS.includes(p.faixa))
    assert.ok(Math.abs(p.q - FAIXAS[p.faixa]) <= 0.05)
    assert.ok(p.vitorias <= p.partidas)
    assert.ok(p.favoritos.every((f) => IDS_PERSONAGENS.includes(f)))
    for (const [tipo, id] of Object.entries(p.equipar)) {
      assert.ok(p.itens.includes(id), `${tipo} equipado sem ter: ${id}`)
      assert.ok(id.startsWith(`${tipo}.`))
    }
    for (const i of itensAte(p.nivel)) assert.ok(p.itens.includes(i.id), 'a trilha toda até o nível')
    if (p.avatar.tipo === 'jogo') assert.ok(p.avatar.id)
    const spec = specDoBanco(p)
    assert.equal(spec.nome, p.nome)
    assert.equal(spec.dias_de_conta, p.diasDeConta)
  }
})

// ---------- decisões ----------

test('decisões: o cursor anda até a carta escolhida, o tempo de pensar respeita o relógio', () => {
  const rng = sorteio(5)
  for (let i = 0; i < 50; i++) {
    const total = 5 + Math.floor(rng() * 3)
    const alvo = Math.floor(rng() * total)
    const caminho = caminhoDoCursor({ inicio: 2, alvo, total }, rng)
    assert.equal(caminho.at(-1).indice, alvo)
    for (let k = 1; k < caminho.length; k++) assert.ok(Math.abs(caminho[k].indice - caminho[k - 1].indice) <= 1, 'uma carta por vez')
    const passar = caminhoDoCursor({ inicio: 2, alvo: -1, total, passar: true }, rng)
    assert.equal(passar.at(-1).passar, true)
  }
  const n = numerosDe(0.5)
  for (let i = 0; i < 200; i++) {
    const ms = tempoDePensar(n.pensarMs, rng, 9000)
    assert.ok(ms >= 250 && ms <= 9000, String(ms))
  }
  assert.equal(tempoDaEscolha(1), 15000)
  assert.ok(tempoDaEscolha(30) < 15000 && tempoDaEscolha(30) >= 8000)
  // a carta: sempre uma jogável (ou passar)
  const estado = criarPartida({ p1: 'kris', p2: 'susie', semente: 'decisoes' })
  iniciarRodada(estado)
  for (let i = 0; i < 40; i++) {
    const id = escolherCarta(estado, 1, numerosDe(rng()).cartas, rng)
    if (id) assert.ok(estado.jogadores[1].baralho.mao.some((c) => c.id === id && c.custo <= estado.jogadores[1].energia))
  }
})

test('a caixa do bot roda o ataque de verdade, com a mesma semente dá o mesmo caminho', () => {
  const carta = Object.values(CARTAS).flat().find((c) => c.naipe === 'espadas' && c.valor === 9)
  const roda = (q) => {
    const cx = criarCaixa({ carta, ...resumoDoAtaque(carta), semente: 'teste:1:1', k: 1, esquiva: numerosDe(q).esquiva, sorte: sorteio(9) })
    const caminho = []
    while (!cx.acabou) {
      cx.passo(16)
      caminho.push(Math.round(cx.coracao.x), Math.round(cx.coracao.y))
    }
    return { caminho, acertos: cx.acertos, duracao: cx.duracao, limites: cx.limites }
  }
  const a = roda(0.5)
  const b = roda(0.5)
  assert.deepEqual(a.caminho, b.caminho)
  assert.ok(a.duracao > 1000)
  for (let i = 0; i < a.caminho.length; i += 2) assert.ok(a.caminho[i] >= a.limites.left && a.caminho[i] <= a.limites.right, 'dentro da caixa')
})

test('o duelo do bot: anda, ataca e leva os golpes das réplicas do humano', () => {
  const d = criarDuelo({ armas: [{ arma: 'tiro', forca: 0.5, dano: 3 }, { arma: 'espada', forca: 0.5, dano: 4 }], cfg: numerosDe(0.6).duelo, sorte: sorteio(2) })
  assert.equal(d.duracao, duracaoDoDuelo(1))
  let ataques = 0
  let golpes = 0
  const humano = { x: d.limites.left + 80, y: (d.limites.top + d.limites.bottom) / 2, vx: 0, vy: 0 }
  for (let t = 0; t < 6000; t += 33) {
    d.humano(humano)
    // o humano atira bem no bot a cada 300 ms
    if (t % 297 === 0) d.replicar({ arma: 'tiro', id: `0:${t}`, x: d.coracao.x - 40, y: d.coracao.y, angulo: 0 })
    const s = d.passo(33)
    ataques += s.ataques.length
    golpes += s.golpes.length
    for (const a of s.ataques) assert.equal(a.arma, 'espada')
  }
  assert.ok(ataques > 0, 'o bot ataca')
  assert.ok(golpes > 0, 'e leva golpe')
})

test('a resposta do WebRTC do bot é bem formada (e nunca conecta: só candidatos .local)', () => {
  const oferta = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\na=mid:0\r\n'
  const { sdp, candidatos } = respostaWebRtc(oferta, sorteio(4))
  assert.match(sdp, /^v=0\r\n/)
  assert.match(sdp, /a=mid:0\r\n/)
  assert.match(sdp, /a=setup:active/)
  assert.match(sdp, /a=fingerprint:sha-256 ([0-9A-F]{2}:){31}[0-9A-F]{2}/)
  assert.ok(candidatos.length >= 1)
  for (const c of candidatos) {
    assert.match(c.candidate, /^candidate:\d+ 1 udp \d+ [0-9a-f-]{36}\.local \d+ typ host/)
    assert.equal(c.sdpMid, '0')
  }
})

// ---------- o lobby com bots ----------

async function montar({ ligado = true, nBots = 8, metricas = null, limiar = 10_000 } = {}) {
  const relogio = relogioFalso()
  const falsas = criarContasFalsas({ agora: relogio.agora })
  const rng = sorteio(21)
  for (const nome of gerarApelidos(nBots, rng)) await falsas.registro.criarBot(specDoBanco(gerarPerfilDeBot({ nome, rng })))
  const logs = []
  const lobby = criarLobby({ online: true, agora: relogio.agora, agendar: relogio.agendar, autenticar: falsas.autenticar, registro: falsas.registro, log: (l) => logs.push(l), metricas: metricas ?? undefined, bots: { ligado, limiarMs: () => limiar, sorte: sorteio(33) } })
  await lobby.bots.carregar()
  const entrar = async (nome, { conta = true, ip = '10.0.0.2' } = {}) => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)) }
    const c = lobby.conectar(ws, ip)
    const p = {
      c,
      ws,
      recebidas,
      mandar: (m) => lobby.receber(c, JSON.stringify(m)),
      ultima: (t) => recebidas.filter((m) => m.t === t).at(-1),
      tipo: (t) => recebidas.filter((m) => m.t === t),
    }
    p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome, ...(conta && { token: `falsa:${crypto.randomUUID()}:${nome}` }) })
    await microtarefas()
    return p
  }
  const andar = async (ms, passo = 20) => {
    for (let t = 0; t < ms; t += passo) {
      relogio.andar(passo)
      await microtarefas()
    }
  }
  return { lobby, relogio, falsas, entrar, andar, logs }
}

test('fila: 8–20 s procurando sem gente, um bot; gente sempre pareia primeiro', async () => {
  assert.deepEqual(LIMIAR_MS, [8000, 20000])
  const { lobby, entrar, andar } = await montar({ limiar: 12_000 })
  const ana = await entrar('ANA')
  ana.mandar({ t: 'fila', acao: 'entrar' })
  await andar(6000)
  const beto = await entrar('BETO')
  beto.mandar({ t: 'fila', acao: 'entrar' })
  assert.equal(ana.ultima('pareado').oponente.nome, 'BETO', 'com gente na fila, gente')
  ana.mandar({ t: 'fila', acao: 'sair' })
  beto.mandar({ t: 'fila', acao: 'sair' })
  await microtarefas()

  const caio = await entrar('CAIO')
  caio.mandar({ t: 'fila', acao: 'entrar' })
  await andar(11_000)
  assert.equal(caio.ultima('pareado'), undefined, 'antes do limiar: procurando')
  for (let i = 0; i < 100 && !caio.ultima('pareado'); i++) await andar(20)
  const par = caio.ultima('pareado')
  assert.ok(par, 'passou do limiar: um bot')
  assert.ok(lobby.ehBot([...lobby.clientes.values()].find((c) => c.nome === par.oponente.nome)))
  assert.deepEqual(Object.keys(par).sort(), ['expiraEm', 'id', 'oponente', 'restanteMs', 't'])
  assert.deepEqual(Object.keys(par.oponente).sort(), ['avatar', 'nivel', 'nome', 'tag'])
  assert.match(par.oponente.tag, /^[a-z0-9]{3,12}#\d{4,6}$/)
  // o bot confirma como gente (não na hora)
  await andar(900)
  assert.ok(!caio.ultima('pareadoEstado')?.oponente, 'ninguém confirma em menos de um segundo')
  caio.mandar({ t: 'confirmar', id: par.id, aceitar: true })
  await andar(7000)
  const casual = caio.ultima('partidaCasual')
  assert.ok(casual, 'o bot confirmou: sala casual')
  assert.equal(casual.host, caio.c.id, 'o jogador é o host')
  const sala = caio.ultima('sala').sala
  const membroBot = sala.membros.find((m) => m.id !== caio.c.id)
  assert.ok(Number.isFinite(membroBot.ping), 'o bot tem ping')
  assert.equal(membroBot.conta.tag, par.oponente.tag)
})

test('o mesmo jogador não pega o mesmo bot duas vezes seguidas; recusar não deixa o bot na fila', async () => {
  const { lobby, entrar, andar } = await montar({ limiar: 9000 })
  const ana = await entrar('ANA')
  const vistos = []
  for (let vez = 0; vez < 3; vez++) {
    ana.mandar({ t: 'fila', acao: 'entrar' })
    await andar(9500)
    const par = ana.ultima('pareado')
    assert.ok(par)
    vistos.push(par.oponente.tag)
    ana.mandar({ t: 'confirmar', id: par.id, aceitar: false })
    await andar(200)
    assert.equal(lobby.fila.tamanho(), 0, 'o bot não volta para a fila')
    assert.equal([...lobby.clientes.values()].filter((c) => lobby.ehBot(c)).length, 0, 'o bot saiu do lobby')
  }
  assert.notEqual(vistos[0], vistos[1])
  assert.notEqual(vistos[1], vistos[2])
})

test('desligado (DODGE_BOTS=0): a fila é só de gente', async () => {
  assert.equal(botsLigados({ DODGE_BOTS: '0' }), false)
  assert.equal(botsLigados({}), true)
  const { entrar, andar } = await montar({ ligado: false })
  const ana = await entrar('ANA')
  ana.mandar({ t: 'fila', acao: 'entrar' })
  await andar(40_000, 100)
  assert.equal(ana.ultima('pareado'), undefined)
  assert.equal(ana.ultima('fila').estado, 'procurando')
})

// Uma partida inteira: o jogador (um host simulado com conta) contra o bot
async function partidaContraBot({ forjar = null, bonus = { 2: 'duelo', 3: 'copia' } } = {}) {
  const linhas = []
  const metricas = criarMetricas({ agora: Date.now, escrever: (l) => linhas.push(l), intervaloMs: 0 })
  const ctx = await montar({ limiar: 8000, metricas })
  const { relogio, entrar, andar } = ctx
  const ana = await entrar('ANA')
  const host = criarHostSimulado({ mandar: ana.mandar, agendar: relogio.agendar, agora: relogio.agora, sorte: sorteio(77), bonus, forjar, eu: () => ana.c.id })
  const enviarOriginal = ana.ws.send
  ana.ws.send = (texto) => {
    enviarOriginal(texto)
    queueMicrotask(() => host.receber(JSON.parse(texto)))
  }
  ana.mandar({ t: 'meuPing', ms: 40 })
  ana.mandar({ t: 'fila', acao: 'entrar' })
  await andar(8100)
  const par = ana.ultima('pareado')
  ana.mandar({ t: 'confirmar', id: par.id, aceitar: true })
  let fim = null
  host.fim.then((f) => (fim = f))
  for (let i = 0; i < 40 && !fim; i++) await andar(30_000, 33)
  // o bot manda o relato dele e sai
  await andar(30_000, 50)
  return { ...ctx, ana, fim, host, par, linhas, metricas }
}

test('partida inteira contra o bot: o protocolo anda até o fim, os dois relatam e o XP é o de sempre', async () => {
  const { fim, falsas, ana, host, lobby, logs, metricas } = await partidaContraBot()
  assert.ok(fim && !fim.erro, JSON.stringify(fim))
  for (const tipo of ['cenaOk', 'personagem', 'jogada', 'fimEsquiva', 'resultadoPronto', 'coracao', 'cursor', 'dueloPronto', 'dueloFim', 'copiaPronto', 'copiaFinal'])
    assert.ok(host.vistos.includes(tipo), `o bot mandou ${tipo}`)
  const t = falsas.sb.tabelas
  const p = t.partidas.at(-1)
  assert.equal(p.estado, 'recompensada')
  assert.equal(p.validacao, 'validada', `os dois relatos batem (${logs.filter((l) => l.includes('[bots]')).join(' | ')})`)
  const conc = t.concessoes.filter((c) => c.partida_id === p.id)
  assert.equal(conc.length, 2, 'o jogador E o bot ganham XP')
  const doBot = conc.find((c) => t.bots.some((b) => b.user_id === c.user_id))
  const doJogador = conc.find((c) => c !== doBot)
  assert.ok(doBot && doJogador)
  assert.ok(doJogador.xp >= 40, 'XP normal para o jogador')
  assert.equal(doJogador.xp, fim.vencedorLado === 0 ? 60 : 40)
  assert.ok(ana.ultima('recompensa'), 'o jogador recebe a recompensa como sempre')
  // a sala fechou (o bot saiu) e o bot não está mais no lobby
  assert.equal(lobby.salas.size, 0)
  assert.equal([...lobby.clientes.values()].filter((c) => lobby.ehBot(c)).length, 0)
  const r = metricas.resumo().contadores
  assert.equal(r.bots_fila_pares, 1)
  assert.equal(r.bots_partidas, 1)
  assert.equal(r.fila_pares, undefined, 'a partida com bot não conta como par de gente')
})

test('validação: um host que forja o HP do bot não leva a vitória (o relato do bot diverge: contestada)', async () => {
  const { fim, falsas, logs } = await partidaContraBot({ forjar: 'hp', bonus: {} })
  assert.ok(fim && !fim.erro)
  assert.equal(fim.vencedorLado, 0, 'o host diz que venceu')
  const p = falsas.sb.tabelas.partidas.at(-1)
  assert.equal(p.validacao, 'contestada')
  const conc = falsas.sb.tabelas.concessoes.filter((c) => c.partida_id === p.id)
  assert.ok(conc.every((c) => c.xp <= 40), 'só participação: ninguém leva o bônus de vitória')
  assert.ok(logs.some((l) => /HP do bot menor/.test(l)))
})

// a FORMA de uma mensagem (as chaves, recursivo), sem os valores (um valor qualquer, null inclusive, é 'v':
// uma conta sem avatar de jogo tem avatar.id null, outra tem o id; as duas são gente)
function forma(v) {
  if (Array.isArray(v)) return ['lista', ...new Set(v.map((x) => JSON.stringify(forma(x))))].sort()
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, forma(v[k])]))
  return 'v'
}

test('indistinguível: o que o jogador recebe numa partida contra bot tem a mesma forma de uma contra gente', async () => {
  // 1) contra o bot
  const { ana, par } = await partidaContraBot({ bonus: {} })
  // 2) contra "gente": o MESMO cérebro numa conexão comum de navegador (com conta), sem nada de bot
  const ctx = await montar({ ligado: false })
  const bia = await ctx.entrar('BIA')
  const host = criarHostSimulado({ mandar: bia.mandar, agendar: ctx.relogio.agendar, agora: ctx.relogio.agora, sorte: sorteio(78), bonus: {}, eu: () => bia.c.id })
  const env = bia.ws.send
  bia.ws.send = (texto) => {
    env(texto)
    queueMicrotask(() => host.receber(JSON.parse(texto)))
  }
  const { criarCerebro } = await import('../bots/cerebro.js')
  const gente = await ctx.entrar('TATUBRABO')
  const cerebro = criarCerebro({ cliente: gente.c, faixa: 'medio', q: 0.5, pingBase: 120, enviar: gente.mandar, agendar: ctx.relogio.agendar, agora: ctx.relogio.agora, sorte: sorteio(5) })
  const envGente = gente.ws.send
  gente.ws.send = (texto) => {
    envGente(texto)
    queueMicrotask(() => cerebro.receber(JSON.parse(texto)))
  }
  bia.mandar({ t: 'meuPing', ms: 40 })
  gente.mandar({ t: 'meuPing', ms: 95 })
  gente.mandar({ t: 'fila', acao: 'entrar' })
  bia.mandar({ t: 'fila', acao: 'entrar' })
  await ctx.andar(500)
  bia.mandar({ t: 'confirmar', id: bia.ultima('pareado').id, aceitar: true })
  let fim = null
  host.fim.then((f) => (fim = f))
  for (let i = 0; i < 40 && !fim; i++) await ctx.andar(30_000, 33)
  await ctx.andar(30_000, 50)
  assert.ok(fim && !fim.erro)

  // cada tipo de mensagem do servidor (e cada tipo do canal da partida) com as formas que apareceram
  const catalogo = (p) => {
    const m = new Map()
    for (const msg of p.recebidas) {
      const chave = msg.t === 'de' ? `de:${msg.dados?.tipo === 'rede' ? `rede:${msg.dados.k}` : msg.dados?.tipo}` : msg.t
      const f = JSON.stringify(forma(msg.t === 'de' && msg.dados?.tipo === 'rede' ? { ...msg, dados: { ...msg.dados, d: forma(msg.dados.d) } } : msg))
      if (!m.has(chave)) m.set(chave, new Set())
      m.get(chave).add(f)
    }
    return m
  }
  const contraBot = catalogo(ana)
  const contraGente = catalogo(bia)
  // tudo o que chegou contra o bot também chega (com a mesma forma) contra gente. Algumas dependem do que
  // aconteceu na partida (o fim, a revanche, o duelo): essas só precisam ser do protocolo de sempre
  const opcionais = ['recompensa', 'conquistas', 'bauGanho', 'revanche', 'de:rede:escolhaFim', 'de:rede:graze', 'de:rede:dano', 'de:rede:cura', 'de:ice', 'de:resposta']
  let comparadas = 0
  for (const [tipo, formas] of contraBot) {
    if (!contraGente.has(tipo)) {
      assert.ok(opcionais.includes(tipo), `${tipo} só aparece contra o bot`)
      continue
    }
    comparadas++
    for (const f of formas) assert.ok(contraGente.get(tipo).has(f), `${tipo} tem outra forma contra o bot: ${f}`)
  }
  assert.ok(comparadas >= 15, `comparou ${comparadas} tipos`)
  // e nenhum valor diz "bot"
  for (const msg of ana.recebidas) assert.doesNotMatch(JSON.stringify(msg), /"bots?"|\bbot\b|faixa|habilidade/i)
  // o oponente da fila: as mesmas chaves que as de um jogador com conta
  assert.deepEqual(Object.keys(par.oponente).sort(), Object.keys(bia.ultima('pareado').oponente).sort())
  cerebro.parar()
})

test('vida fora da fila: o XP e as partidas dos bots crescem sozinhos (com teto)', async () => {
  const relogio = relogioFalso()
  const falsas = criarContasFalsas({ agora: relogio.agora })
  const rng = sorteio(3)
  for (const nome of gerarApelidos(5, rng)) await falsas.registro.criarBot(specDoBanco(gerarPerfilDeBot({ nome, rng })))
  const bots = criarBots({ registro: falsas.registro, ligado: true, agora: relogio.agora, sorte: sorteio(8), conectar: () => null, minimo: 0 })
  await bots.carregar()
  const antes = falsas.sb.tabelas.perfis.map((p) => p.xp)
  relogio.andar(2 * 86_400_000)
  const n = await bots.atividade()
  assert.ok(n > 0)
  const depois = falsas.sb.tabelas.perfis.map((p) => p.xp)
  assert.ok(depois.some((x, i) => x > antes[i]))
  assert.ok(depois.every((x, i) => x - antes[i] <= 20 * 60))
  // um humano não passa pela atividade de bot
  await assert.rejects(falsas.registro.atividadeDeBot(crypto.randomUUID(), { partidas: 1, vitorias: 1, xp: 60 }))
})

test('semear: com o banco vazio o grupo nasce com o alvo de bots, com nomes diferentes', async () => {
  const falsas = criarContasFalsas()
  const bots = criarBots({ registro: falsas.registro, ligado: true, sorte: sorteio(12), conectar: () => null, alvo: 45, minimo: 40 })
  await bots.carregar()
  assert.equal(bots.resumo().total, 45)
  const nomes = falsas.sb.tabelas.perfis.map((p) => p.nome_exibicao.toLowerCase())
  assert.equal(new Set(nomes).size, nomes.length)
  const faixas = new Set(falsas.sb.tabelas.bots.map((b) => b.faixa))
  assert.ok(faixas.size >= 4, 'faixas variadas')
})

test('simulação: com a faixa certa a partida é parelha (o jogador do mesmo q ganha perto da metade)', () => {
  let vitorias = 0
  const n = 10
  for (let i = 0; i < n; i++) if (simularPartida({ qJogador: 0.48, qBot: 0.48, semente: `teste:${i}` }).vencedor === 0) vitorias++
  assert.ok(vitorias >= 2 && vitorias <= 8, `${vitorias}/${n}`)
})
