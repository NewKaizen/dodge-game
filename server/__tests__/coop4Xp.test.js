import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, PROTOCOLO, RETOMADA_MS } from '../lan.js'
import { criarRegistro, ABANDONO_GRACA_MS, RELATO_JANELA_MS } from '../partidas.js'
import { criarSupabaseFalso } from '../supabase/fake.js'
import { XP_PARTICIPACAO, XP_VITORIA } from '../../src/lib/progresso.js'

// XP do CO-OP de 3 e 4 (Fase 5B): as mesmas regras de validação da 5A (o host decide, a maioria
// confere), participação para todos + bônus da vitória do time, e o limite diário por PAR de contas.

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

// sala de CO-OP 3–4 com os nomes (o 1º é o host/dono); a partida começa
async function sala(m, nomes) {
  const ps = []
  for (const nome of nomes) ps.push(await m.entrar(nome))
  const [host, ...conv] = ps
  host.mandar({ t: 'criar' })
  host.mandar({ t: 'modo', modo: 'coop4' })
  for (const p of conv) p.mandar({ t: 'entrar', codigo: host.ultima('sala').sala.codigo })
  host.mandar({ t: 'partida', valor: true })
  return { ps, host, conv, partidaId: host.ultima('sala').sala.partidaId }
}
const relatar = (p, partidaId, vitoria, extra = {}) => p.mandar({ t: 'resultado', partidaId, vitoria, rodadas: 8, duracao: 300, personagem: 'kris', ...extra })
const rec = (p) => p.ultima('recompensa')

test('4 jogadores, todos relatam a vitória: participação + bônus para todos (convidado fica sem XP)', async () => {
  const m = montar(['ana', 'beto', 'caio'])
  const { ps, partidaId } = await sala(m, ['ana', 'beto', 'caio', 'duda'])
  assert.match(partidaId, /^[0-9a-f-]{36}$/, 'o modo coop4 registra a partida')
  await esperar()
  assert.deepEqual(m.sb.tabelas.partida_participantes.map((x) => [x.lado, x.user_id]), [[0, 'u-ana'], [1, 'u-beto'], [2, 'u-caio'], [3, null]])
  assert.equal(m.sb.tabelas.partidas[0].modo, 'coop4')
  m.relogio.andar(300_000)
  for (const p of ps) relatar(p, partidaId, true)
  await esperar()
  for (const p of ps.slice(0, 3)) {
    assert.equal(rec(p).xpGanho, VITORIA, p.nome)
    assert.equal(rec(p).motivo, 'vitoria')
  }
  assert.equal(rec(ps[3]).xpGanho, 0)
  assert.equal(rec(ps[3]).motivo, 'convidado')
  assert.equal(m.sb.tabelas.partidas[0].validacao, 'validada')
  assert.equal(m.sb.tabelas.partidas[0].estado, 'recompensada')
})

test('derrota do time: todos ganham só a participação', async () => {
  const m = montar(['ana', 'beto', 'caio'])
  const { ps, partidaId } = await sala(m, ['ana', 'beto', 'caio'])
  m.relogio.andar(200_000)
  for (const p of ps) relatar(p, partidaId, false)
  await esperar()
  for (const p of ps) {
    assert.equal(rec(p).xpGanho, XP_PARTICIPACAO)
    assert.equal(rec(p).motivo, 'derrota')
  }
})

test('o host decide, a maioria confere: host + 1 de 4 vale (host desempata); host sozinho contra 3: contestada', async () => {
  const m = montar(['ana', 'beto', 'caio', 'duda'])
  let { ps, partidaId } = await sala(m, ['ana', 'beto', 'caio', 'duda'])
  m.relogio.andar(300_000)
  relatar(ps[0], partidaId, true)
  relatar(ps[1], partidaId, true)
  relatar(ps[2], partidaId, false)
  relatar(ps[3], partidaId, false)
  await esperar()
  assert.equal(m.sb.tabelas.partidas[0].validacao, 'validada')
  assert.equal(rec(ps[0]).motivo, 'vitoria')
  // o resultado que valeu (o do host) é o do time inteiro, também para quem relatou o contrário
  for (const p of ps) assert.equal(rec(p).motivo, 'vitoria', p.nome)
})

test('o host contra todos: contestada, só a participação para quem relatou', async () => {
  const m = montar(['ana', 'beto', 'caio'])
  const { ps, partidaId } = await sala(m, ['ana', 'beto', 'caio'])
  m.relogio.andar(300_000)
  relatar(ps[0], partidaId, true)
  relatar(ps[1], partidaId, false)
  relatar(ps[2], partidaId, false)
  await esperar()
  assert.equal(m.sb.tabelas.partidas[0].validacao, 'contestada')
  for (const p of ps) {
    assert.equal(rec(p).xpGanho, XP_PARTICIPACAO)
    assert.equal(rec(p).motivo, 'contestada')
  }
})

test('um convidado cai e não volta em 20 s: abandono (sem XP); os outros ganham a vitória', async () => {
  const m = montar(['ana', 'beto', 'caio', 'duda'])
  const { ps, partidaId } = await sala(m, ['ana', 'beto', 'caio', 'duda'])
  m.relogio.andar(60_000)
  ps[3].sair()
  m.relogio.andar(RETOMADA_MS + 100)
  m.relogio.andar(120_000)
  for (const p of ps.slice(0, 3)) relatar(p, partidaId, true)
  await esperar()
  for (const p of ps.slice(0, 3)) assert.equal(rec(p).xpGanho, VITORIA, p.nome)
  assert.equal(rec(ps[3]), undefined, 'quem saiu está fora do jogo e não recebe')
  const lados = m.sb.tabelas.partida_participantes
  assert.equal(lados.find((x) => x.lado === 3).resultado, 'abandono')
  assert.equal(m.sb.tabelas.perfis.find((p) => p.id === 'u-duda').xp, 0)
})

test('ninguém relata e o host cai: encerrada, sem XP e sem derrota', async () => {
  const m = montar(['ana', 'beto', 'caio'])
  const { ps } = await sala(m, ['ana', 'beto', 'caio'])
  m.relogio.andar(80_000)
  ps[0].sair()
  m.relogio.andar(RETOMADA_MS + 100)
  m.relogio.andar(ABANDONO_GRACA_MS + RELATO_JANELA_MS)
  await esperar()
  assert.equal(m.sb.tabelas.partidas[0].estado, 'encerrada')
  assert.equal(m.sb.tabelas.partidas[0].motivo_termino, 'host_caiu')
  assert.equal(m.sb.tabelas.perfis.find((p) => p.id === 'u-beto').xp, 0)
})

test('o limite diário conta por par de contas: 3 cheias, 2 pela metade e depois zero; outro grupo recomeça', async () => {
  const m = montar(['ana', 'beto', 'caio', 'duda', 'eva'])
  const { ps, host } = await sala(m, ['ana', 'beto', 'caio'])
  const ganhos = []
  for (let i = 0; i < 6; i++) {
    if (i) host.mandar({ t: 'partida', valor: true })
    const id = host.ultima('sala').sala.partidaId
    m.relogio.andar(300_000)
    for (const p of ps) relatar(p, id, true)
    await esperar()
    host.mandar({ t: 'partida', valor: false })
    ganhos.push([rec(ps[1]).xpGanho, rec(ps[1]).motivo])
  }
  assert.deepEqual(ganhos, [
    [60, 'vitoria'],
    [60, 'vitoria'],
    [60, 'vitoria'],
    [30, 'repeticao_metade'],
    [30, 'repeticao_metade'],
    [0, 'repeticao'],
  ])
  // o beto, com OUTRA dupla (a duda na vaga 0): é outro par, XP cheio
  const outra = await sala(m, ['duda', 'beto', 'eva'])
  m.relogio.andar(300_000)
  for (const p of outra.ps) relatar(p, outra.partidaId, true)
  await esperar()
  assert.equal(rec(outra.ps[1]).xpGanho, 60)
})
