import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, PROTOCOLO, RETOMADA_MS, RETOMADAS_POR_MINUTO } from '../lan.js'
import { criarRegistro, ABANDONO_GRACA_MS } from '../partidas.js'
import { criarSupabaseFalso } from '../supabase/fake.js'
import { XP_PARTICIPACAO, XP_VITORIA } from '../../src/lib/progresso.js'

// Recuperação de conexão (Fase 2D): a máquina de estados da vaga guardada,
// com ws falso e relógio injetado.

function relogioFalso() {
  let t = Date.UTC(2026, 9, 25, 15, 0, 0)
  const timers = new Set()
  return {
    agora: () => t,
    agendar(fn, ms) {
      const x = { fn, quando: t + ms }
      timers.add(x)
      return () => timers.delete(x)
    },
    andar(ms) {
      t += ms
      for (const x of [...timers].sort((a, b) => a.quando - b.quando)) if (x.quando <= t && timers.delete(x)) x.fn()
    },
  }
}

const esperar = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r))
}

const VITORIA = XP_PARTICIPACAO + XP_VITORIA

function montar({ contas = ['ana', 'beto', 'caio'] } = {}) {
  const relogio = relogioFalso()
  const id = (nome) => `u-${nome}`
  const perfis = contas.map((n) => ({ id: id(n), tag: `${n}#1000`, nome_exibicao: n.toUpperCase(), avatar_tipo: 'padrao', nivel: 1, xp: 0 }))
  const sb = criarSupabaseFalso({ perfis, agora: relogio.agora })
  const autenticar = async (token) => {
    const nome = token.replace(/^token-/, '').replace(/-\d+$/, '')
    return contas.includes(nome) ? { id: id(nome), perfil: perfis.find((p) => p.id === id(nome)) } : null
  }
  const logs = []
  const lobby = criarLobby({ online: true, agora: relogio.agora, agendar: relogio.agendar, autenticar, registro: criarRegistro(sb), log: (l) => logs.push(l) })
  let n = 0
  // conta: entra logado com essa conta (null = convidado); retomar: a chave de retomada
  const entrar = async (nome, { conta = nome, retomar = null, ip = '10.0.0.2' } = {}) => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)), terminado: false }
    ws.terminate = () => {
      ws.terminado = true
      ws.readyState = 3
    }
    const c = lobby.conectar(ws, ip)
    const p = {
      c,
      ws,
      recebidas,
      mandar: (m) => lobby.receber(c, JSON.stringify(m), false, ws),
      tipo: (t) => recebidas.filter((m) => m.t === t),
      ultima: (t) => recebidas.filter((m) => m.t === t).at(-1),
      chave: () => recebidas.filter((m) => m.t === 'bemvindo').at(-1)?.retomada,
      // a conexão cai (o servidor vê o close)
      cair: () => {
        ws.readyState = 3
        lobby.desconectar(c, ws)
      },
    }
    const comConta = conta && contas.includes(conta)
    p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: nome.toUpperCase(), ...(comConta && { token: `token-${conta}-${++n}` }), ...(retomar && { retomar }) })
    await esperar()
    return p
  }
  return { lobby, relogio, entrar, logs, sb }
}

// sala de amigos (ou casual) com a partida PVP começada
async function partida(m, { casual = false } = {}) {
  const host = await m.entrar('ana')
  const conv = await m.entrar('beto')
  host.mandar({ t: 'criar' })
  conv.mandar({ t: 'entrar', codigo: host.ultima('sala').sala.codigo })
  const sala = m.lobby.salas.get(host.c.sala)
  if (casual) sala.casual = true
  host.mandar({ t: 'partida', valor: true })
  return { host, conv, partidaId: host.ultima('sala').sala.partidaId, sala }
}

const relatar = (p, partidaId, vencedorLado) => p.mandar({ t: 'resultado', partidaId, vencedorLado, rodadas: 4, duracao: 120, personagem: 'kris' })
const membro = (p, nome) => p.ultima('sala').sala.membros.find((x) => x.nome === nome)

test('o bemvindo traz uma chave de retomada aleatória por conexão (convidado também)', async () => {
  const m = montar()
  const a = await m.entrar('ana')
  const b = await m.entrar('zeca', { conta: null })
  assert.match(a.chave(), /^[\w-]{32}$/)
  assert.match(b.chave(), /^[\w-]{32}$/)
  assert.notEqual(a.chave(), b.chave())
})

test('o convidado cai no meio e volta a tempo: mesma vaga, mesmo lado, o relato vale', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  const chave = conv.chave()
  const idAntes = conv.c.id
  m.relogio.andar(60_000)
  conv.cair()
  assert.ok(membro(host, 'BETO').caiu > 0, 'o host vê que o outro caiu (e quanto falta)')
  assert.equal(host.ultima('sala').sala.membros.length, 2, 'a vaga fica')
  m.relogio.andar(RETOMADA_MS - 1000)
  const volta = await m.entrar('beto', { retomar: chave })
  const bv = volta.ultima('bemvindo')
  assert.equal(bv.retomado, true)
  assert.equal(bv.id, idAntes, 'o mesmo id (o mesmo lado na partida)')
  assert.notEqual(bv.retomada, chave, 'a chave troca a cada retomada')
  assert.equal(membro(host, 'BETO').caiu, null)
  assert.equal(volta.ultima('sala').sala.partidaId, partidaId)
  assert.equal(m.lobby.salas.get(host.c.sala).membros.size, 2)
  // o prazo velho não derruba ninguém depois
  m.relogio.andar(RETOMADA_MS * 2)
  assert.equal(m.lobby.salas.get(host.c.sala).membros.size, 2)
  // a partida segue: o chat e os sinais chegam na conexão nova
  host.mandar({ t: 'para', dados: { tipo: 'rede', k: 'x' } })
  assert.equal(volta.ultima('de').dados.k, 'x')
  relatar(host, partidaId, 0)
  relatar(volta, partidaId, 0)
  await esperar()
  assert.equal(recompensaDe(host).xpGanho, VITORIA)
  assert.equal(recompensaDe(volta).motivo, 'derrota')
  assert.equal(m.sb.tabelas.partidas[0].estado, 'recompensada')
})

const recompensaDe = (p) => p.ultima('recompensa')

test('o convidado cai e não volta em 20 s: abandono (como sair no meio)', async () => {
  const m = montar()
  const { host, conv } = await partida(m)
  m.relogio.andar(80_000)
  conv.cair()
  m.relogio.andar(RETOMADA_MS)
  assert.deepEqual(
    host.ultima('sala').sala.membros.map((x) => x.nome),
    ['ANA'],
    'na sala de amigos o host fica',
  )
  m.relogio.andar(ABANDONO_GRACA_MS)
  await esperar()
  assert.equal(recompensaDe(host).xpGanho, VITORIA)
  assert.equal(recompensaDe(host).motivo, 'vitoria')
  const linha = m.sb.tabelas.partidas[0]
  assert.equal(linha.motivo_termino, 'abandono')
  assert.equal(linha.duracao_s, 80, 'saiu quando caiu')
  // voltar depois do prazo não vale: entra como conexão nova, fora da sala
  const tarde = await m.entrar('beto', { retomar: conv.chave() })
  assert.equal(tarde.ultima('bemvindo').retomado, undefined)
  assert.ok(tarde.ultima('bemvindo').retomadaNegada)
  assert.equal(tarde.c.sala, null)
})

test('sala casual: o convidado cai e volta, a sala não fecha', async () => {
  const m = montar()
  const { host, conv } = await partida(m, { casual: true })
  conv.cair()
  assert.equal(host.ultima('fechada'), undefined)
  const volta = await m.entrar('beto', { retomar: conv.chave() })
  assert.equal(volta.ultima('bemvindo').retomado, true)
  assert.equal(volta.ultima('sala').sala.casual, true)
  assert.equal(host.ultima('fechada'), undefined)
})

test('o host cai e volta a tempo: continua host, a partida segue', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(90_000)
  host.cair()
  assert.ok(membro(conv, 'ANA').caiu > 0)
  assert.equal(conv.ultima('fechada'), undefined)
  m.relogio.andar(5000)
  const volta = await m.entrar('ana', { retomar: host.chave() })
  assert.equal(volta.ultima('bemvindo').retomado, true)
  const sala = volta.ultima('sala').sala
  assert.equal(sala.membros.find((x) => x.nome === 'ANA').papel, 'host')
  assert.equal(sala.emPartida, true)
  assert.equal(sala.partidaId, partidaId)
  relatar(volta, partidaId, 1)
  relatar(conv, partidaId, 1)
  await esperar()
  assert.equal(recompensaDe(conv).xpGanho, VITORIA)
  assert.equal(recompensaDe(volta).motivo, 'derrota')
})

test('o host cai e não volta: a sala fecha, sem XP e sem derrota; o convidado não ganha abandono', async () => {
  const m = montar()
  const { host, conv } = await partida(m)
  m.relogio.andar(90_000)
  host.cair()
  m.relogio.andar(RETOMADA_MS)
  assert.match(conv.ultima('fechada').motivo, /não voltou a tempo/)
  m.relogio.andar(ABANDONO_GRACA_MS)
  await esperar()
  assert.equal(recompensaDe(conv).motivo, 'host_caiu')
  assert.equal(recompensaDe(conv).xpGanho, 0)
  assert.equal(m.sb.tabelas.partidas[0].motivo_termino, 'host_caiu')
  assert.equal(m.sb.tabelas.partidas[0].vencedor_lado, null)
  assert.equal(m.lobby.salas.size, 0)
})

test('chave errada, de outra conta ou de convidado para vaga com conta: recusada, a vaga continua esperando', async () => {
  const m = montar()
  const { host, conv } = await partida(m)
  conv.cair()
  const errada = await m.entrar('beto', { retomar: 'x'.repeat(32) })
  assert.ok(errada.ultima('bemvindo').retomadaNegada)
  assert.equal(errada.c.sala, null)
  // a chave vazou para outra conta: não leva a vaga
  const ladrao = await m.entrar('caio', { retomar: conv.chave() })
  assert.equal(ladrao.ultima('bemvindo').retomadaNegada, 'essa partida é de outra conta')
  const anonimo = await m.entrar('zeca', { conta: null, retomar: conv.chave() })
  assert.equal(anonimo.ultima('bemvindo').retomadaNegada, 'essa partida é de outra conta')
  assert.ok(membro(host, 'BETO').caiu > 0, 'a vaga segue guardada')
  const dono = await m.entrar('beto', { retomar: conv.chave() })
  assert.equal(dono.ultima('bemvindo').retomado, true)
})

test('convidado sem conta também retoma (pela chave)', async () => {
  const m = montar({ contas: ['ana'] })
  const { host, conv } = await partida(m)
  conv.cair()
  const volta = await m.entrar('beto', { conta: null, retomar: conv.chave() })
  assert.equal(volta.ultima('bemvindo').retomado, true)
  assert.equal(membro(host, 'BETO').caiu, null)
})

test('duas retomadas com a mesma chave: só a primeira leva (nunca dois sockets na vaga)', async () => {
  const m = montar()
  const { host, conv } = await partida(m)
  const chave = conv.chave()
  conv.cair()
  const a = await m.entrar('beto', { retomar: chave })
  const b = await m.entrar('beto', { retomar: chave })
  assert.equal(a.ultima('bemvindo').retomado, true)
  assert.ok(b.ultima('bemvindo').retomadaNegada)
  assert.equal(b.c.sala, null)
  host.mandar({ t: 'chat', texto: 'oi' })
  assert.equal(a.ultima('chat').texto, 'oi')
  assert.equal(b.ultima('chat'), undefined)
})

test('o servidor ainda não viu cair: a conexão nova assume e a velha não manda nem derruba mais nada', async () => {
  const m = montar()
  const { host, conv } = await partida(m)
  const volta = await m.entrar('beto', { retomar: conv.chave() })
  assert.equal(volta.ultima('bemvindo').retomado, true)
  assert.equal(conv.ws.terminado, true, 'a conexão velha foi fechada')
  conv.mandar({ t: 'chat', texto: 'fantasma' })
  assert.equal(host.ultima('chat'), undefined, 'mensagem da conexão velha não vale')
  conv.cair() // o close atrasado da velha
  assert.equal(membro(host, 'BETO').caiu, null)
  assert.equal(m.lobby.salas.get(host.c.sala).membros.size, 2)
})

test('relato e queda: o relato antes da queda vale uma vez; o depois da volta não repete', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  relatar(conv, partidaId, 0)
  conv.cair()
  const volta = await m.entrar('beto', { retomar: conv.chave() })
  relatar(volta, partidaId, 1) // repetido (e diferente): não conta
  relatar(host, partidaId, 0)
  await esperar()
  assert.equal(recompensaDe(host).motivo, 'vitoria')
  assert.equal(recompensaDe(volta).motivo, 'derrota')
  assert.equal(m.sb.tabelas.concessoes.length, 2)
})

test('relato durante a janela: quem caiu e voltou ainda relata (não é "quem saiu não relata")', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  conv.cair()
  relatar(host, partidaId, 0)
  m.relogio.andar(4000) // passa a graça do abandono: ele não "saiu"
  await esperar()
  assert.equal(recompensaDe(host), undefined)
  const volta = await m.entrar('beto', { retomar: conv.chave() })
  relatar(volta, partidaId, 0)
  await esperar()
  assert.equal(recompensaDe(host).motivo, 'vitoria')
  assert.equal(recompensaDe(volta).motivo, 'derrota')
})

test('relato pela outra aba da conta durante a janela vale; a vaga expirando depois não vira abandono', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  conv.cair()
  const aba = await m.entrar('beto') // conexão nova sem retomar (outra aba)
  relatar(aba, partidaId, 0)
  relatar(host, partidaId, 0)
  await esperar()
  assert.equal(recompensaDe(host).motivo, 'vitoria')
  assert.equal(recompensaDe(aba).motivo, 'derrota', 'a recompensa vai para a conexão viva da conta')
  m.relogio.andar(RETOMADA_MS)
  await esperar()
  assert.equal(m.sb.tabelas.concessoes.length, 2)
})

test('fora da partida cair tira na hora: fila e lobby não guardam vaga', async () => {
  const m = montar()
  const a = await m.entrar('ana')
  a.mandar({ t: 'fila', acao: 'entrar' })
  assert.equal(m.lobby.fila.estado(a.c), 'procurando')
  a.cair()
  assert.equal(m.lobby.fila.tamanho(), 0)
  assert.equal(m.lobby.clientes.has(a.c.id), false)
  const volta = await m.entrar('ana', { retomar: a.chave() })
  assert.ok(volta.ultima('bemvindo').retomadaNegada)
  // sala sem partida (lobby): host caindo fecha como antes
  const h = await m.entrar('ana')
  const c = await m.entrar('beto')
  h.mandar({ t: 'criar' })
  c.mandar({ t: 'entrar', codigo: h.ultima('sala').sala.codigo })
  h.cair()
  assert.equal(c.ultima('fechada').motivo, 'o host perdeu a conexão: a sala foi fechada')
  assert.equal(m.lobby.retomadas(), 2, 'só as chaves das conexões vivas ficam (volta e c)')
})

test('o host fecha a sala enquanto o convidado está caído: a vaga some e a volta é recusada', async () => {
  const m = montar()
  const { host, conv } = await partida(m)
  conv.cair()
  host.mandar({ t: 'sair' })
  assert.equal(m.lobby.clientes.has(conv.c.id), false)
  const volta = await m.entrar('beto', { retomar: conv.chave() })
  assert.ok(volta.ultima('bemvindo').retomadaNegada)
})

test('tentativas de retomada têm limite por endereço', async () => {
  const m = montar()
  const { conv } = await partida(m)
  conv.cair()
  for (let i = 0; i < RETOMADAS_POR_MINUTO; i++) await m.entrar('beto', { retomar: `errada${i}`.padEnd(32, 'x'), ip: '10.9.9.9' })
  const certa = await m.entrar('beto', { retomar: conv.chave(), ip: '10.9.9.9' })
  assert.equal(certa.ultima('bemvindo').retomadaNegada, 'tentativas demais de voltar: espere um pouco')
  const deOutroLugar = await m.entrar('beto', { retomar: conv.chave(), ip: '10.1.1.1' })
  assert.equal(deOutroLugar.ultima('bemvindo').retomado, true)
})
