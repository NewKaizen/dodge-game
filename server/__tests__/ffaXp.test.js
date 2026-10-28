import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, PROTOCOLO, RETOMADA_MS } from '../lan.js'
import { criarRegistro, ABANDONO_GRACA_MS, RELATO_JANELA_MS } from '../partidas.js'
import { criarSupabaseFalso } from '../supabase/fake.js'
import { XP_PARTICIPACAO, XP_VITORIA, XP_SEGUNDO_FFA, xpDaPartida } from '../../src/lib/progresso.js'

// XP do TODOS CONTRA TODOS (Fase 5D): a validação da 5A (o host decide, a maioria confere), participação
// para todos, +vitória para o 1º e +XP_SEGUNDO_FFA para o 2º (0007), quedas e o limite diário.

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

function montar(contas) {
  const relogio = relogioFalso()
  const id = (nome) => `u-${nome}`
  const perfis = contas.map((n) => ({ id: id(n), tag: `${n}#1000`, nome_exibicao: n.toUpperCase(), avatar_tipo: 'padrao', nivel: 1, xp: 0 }))
  const sb = criarSupabaseFalso({ perfis, agora: relogio.agora })
  const autenticar = async (token) => {
    const nome = token.replace(/^token-/, '').replace(/-\d+$/, '')
    return contas.includes(nome) ? { id: id(nome), perfil: perfis.find((p) => p.id === id(nome)) } : null
  }
  const lobby = criarLobby({ online: true, agora: relogio.agora, agendar: relogio.agendar, autenticar, registro: criarRegistro(sb), log: () => {} })
  let n = 0
  const entrar = async (nome) => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)) }
    const c = lobby.conectar(ws, `10.0.0.${++n}`)
    const p = {
      nome,
      recebidas,
      mandar: (m) => lobby.receber(c, JSON.stringify(m)),
      ultima: (t) => recebidas.filter((m) => m.t === t).at(-1),
      sair: () => {
        ws.readyState = 3
        lobby.desconectar(c)
      },
    }
    p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: nome.toUpperCase(), ...(contas.includes(nome) && { token: `token-${nome}-${++n}` }) })
    await esperar()
    return p
  }
  return { relogio, entrar, sb }
}

// sala de todos contra todos com os nomes (o 1º é o host/dono); a partida começa
async function sala(m, nomes) {
  const ps = []
  for (const nome of nomes) ps.push(await m.entrar(nome))
  const [host, ...conv] = ps
  host.mandar({ t: 'criar' })
  host.mandar({ t: 'modo', modo: 'ffa' })
  for (const p of conv) p.mandar({ t: 'entrar', codigo: host.ultima('sala').sala.codigo })
  host.mandar({ t: 'partida', valor: true })
  return { ps, host, conv, partidaId: host.ultima('sala').sala.partidaId }
}
const relatar = (p, partidaId, colocacoes, extra = {}) => p.mandar({ t: 'resultado', partidaId, colocacoes, rodadas: 8, duracao: 300, personagem: 'kris', ...extra })
const rec = (p) => p.ultima('recompensa')

test('o espelho em JS: 1º participação + vitória, 2º + bônus do 2º lugar, o resto participação', () => {
  assert.equal(XP_SEGUNDO_FFA, 10)
  const xp = (resultado, colocacao, modo = 'ffa') => xpDaPartida({ resultado, duracaoS: 300, rodadas: 8, modo, colocacao }).xp
  assert.equal(xp('vitoria', 1), XP_PARTICIPACAO + XP_VITORIA)
  assert.equal(xp('derrota', 2), XP_PARTICIPACAO + XP_SEGUNDO_FFA)
  assert.equal(xp('derrota', 3), XP_PARTICIPACAO)
  assert.equal(xp('derrota', 2, 'coop4'), XP_PARTICIPACAO, 'só no ffa')
  assert.equal(xpDaPartida({ resultado: 'derrota', duracaoS: 300, rodadas: 8, modo: 'ffa', colocacao: 2, repeticoes: 3 }).xp, Math.floor((XP_PARTICIPACAO + XP_SEGUNDO_FFA) / 2))
})

test('4 jogadores, todos relatam a mesma classificação: XP por colocação (convidado sem XP)', async () => {
  const m = montar(['ana', 'beto', 'caio'])
  const { ps, partidaId } = await sala(m, ['ana', 'beto', 'caio', 'duda'])
  assert.match(partidaId, /^[0-9a-f-]{36}$/, 'o modo ffa registra a partida')
  await esperar()
  assert.equal(m.sb.tabelas.partidas[0].modo, 'ffa')
  m.relogio.andar(300_000)
  for (const p of ps) relatar(p, partidaId, [2, 0, 3, 1])
  await esperar()
  assert.equal(rec(ps[2]).xpGanho, XP_PARTICIPACAO + XP_VITORIA)
  assert.equal(rec(ps[2]).motivo, 'vitoria')
  assert.equal(rec(ps[0]).xpGanho, XP_PARTICIPACAO + XP_SEGUNDO_FFA)
  assert.equal(rec(ps[1]).xpGanho, XP_PARTICIPACAO)
  assert.equal(rec(ps[3]).motivo, 'convidado')
  assert.deepEqual(m.sb.tabelas.partida_participantes.map((x) => x.colocacao), [2, 4, 1, 3])
  assert.equal(m.sb.tabelas.partidas[0].vencedor_lado, 2)
})

test('3 jogadores: o host decide e a maioria confere; quem relata o contrário segue a decisão', async () => {
  const m = montar(['ana', 'beto', 'caio'])
  const { ps, partidaId } = await sala(m, ['ana', 'beto', 'caio'])
  m.relogio.andar(300_000)
  relatar(ps[0], partidaId, [1, 0, 2])
  relatar(ps[1], partidaId, [1, 0, 2])
  relatar(ps[2], partidaId, [2, 1, 0])
  await esperar()
  assert.equal(m.sb.tabelas.partidas[0].validacao, 'validada')
  assert.equal(rec(ps[1]).xpGanho, XP_PARTICIPACAO + XP_VITORIA)
  assert.equal(rec(ps[0]).xpGanho, XP_PARTICIPACAO + XP_SEGUNDO_FFA)
  assert.equal(rec(ps[2]).xpGanho, XP_PARTICIPACAO)
})

test('quem caiu e não voltou em 20 s sai como abandono (nada); quem caiu e voltou relata e ganha', async () => {
  const m = montar(['ana', 'beto', 'caio', 'duda'])
  const { ps, partidaId } = await sala(m, ['ana', 'beto', 'caio', 'duda'])
  m.relogio.andar(100_000)
  ps[3].sair() // caiu (a vaga espera 20 s)
  m.relogio.andar(RETOMADA_MS + 1000)
  await esperar()
  m.relogio.andar(200_000)
  for (const p of ps.slice(0, 3)) relatar(p, partidaId, [0, 1, 2, 3])
  await esperar()
  assert.equal(rec(ps[0]).xpGanho, XP_PARTICIPACAO + XP_VITORIA)
  assert.equal(rec(ps[1]).xpGanho, XP_PARTICIPACAO + XP_SEGUNDO_FFA)
  assert.equal(m.sb.tabelas.partida_participantes.find((x) => x.lado === 3).resultado, 'abandono')
})

test('limite diário: a 4ª e a 5ª partida do dia com o mesmo grupo valem metade, a 6ª nada', async () => {
  const m = montar(['ana', 'beto', 'caio'])
  const ganhos = []
  for (let k = 0; k < 6; k++) {
    const { ps, partidaId } = await sala(m, ['ana', 'beto', 'caio'])
    m.relogio.andar(300_000)
    for (const p of ps) relatar(p, partidaId, [0, 1, 2])
    await esperar()
    ganhos.push(rec(ps[0]).xpGanho)
    for (const p of ps) p.sair()
    m.relogio.andar(30_000)
    await esperar()
  }
  const cheio = XP_PARTICIPACAO + XP_VITORIA
  assert.deepEqual(ganhos, [cheio, cheio, cheio, cheio / 2, cheio / 2, 0])
})
