import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, PROTOCOLO, RETOMADA_MS } from '../lan.js'
import { criarRegistro, ABANDONO_GRACA_MS, RELATO_JANELA_MS } from '../partidas.js'
import { criarSupabaseFalso } from '../supabase/fake.js'
import { XP_PARTICIPACAO, XP_VITORIA } from '../../src/lib/progresso.js'

// XP do 2x2 (Fase 5E): a validação da 5A (o host decide, a maioria confere) com o relato { vencedorTime },
// participação para todos e a vitória para os DOIS do time vencedor, o TROCAR TIME (arranjo da sala), quedas
// e o limite diário contra cada adversário (0009; aqui o banco falso, server/supabase/fake.js).

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

// sala de 2x2 com os nomes (o 1º é o dono/host); arranjo: o TROCAR TIME antes de começar
async function sala(m, nomes, arranjo = null) {
  const ps = []
  for (const nome of nomes) ps.push(await m.entrar(nome))
  const [host, ...conv] = ps
  host.mandar({ t: 'criar' })
  host.mandar({ t: 'modo', modo: '2x2' })
  for (const p of conv) p.mandar({ t: 'entrar', codigo: host.ultima('sala').sala.codigo })
  if (arranjo != null) host.mandar({ t: 'times', arranjo })
  host.mandar({ t: 'partida', valor: true })
  return { ps, host, conv, partidaId: host.ultima('sala').sala.partidaId }
}
const relatar = (p, partidaId, vencedorTime) => p.mandar({ t: 'resultado', partidaId, vencedorTime, rodadas: 8, duracao: 300, personagem: 'kris' })
const rec = (p) => p.ultima('recompensa')
const sairTodos = async (m, ps) => {
  for (const p of ps) p.sair()
  m.relogio.andar(30_000)
  await esperar()
}

test('2x2 registra com 4; os dois do time vencedor ganham participação + vitória', async () => {
  const m = montar(['ana', 'beto', 'caio', 'duda'])
  const { ps, partidaId } = await sala(m, ['ana', 'beto', 'caio', 'duda'])
  assert.match(partidaId, /^[0-9a-f-]{36}$/)
  await esperar()
  assert.equal(m.sb.tabelas.partidas[0].modo, '2x2')
  assert.deepEqual(m.sb.tabelas.partida_participantes.map((x) => x.time), [0, 1, 0, 1])
  m.relogio.andar(300_000)
  for (const p of ps) relatar(p, partidaId, 1)
  await esperar()
  assert.deepEqual(ps.map((p) => rec(p).xpGanho), [XP_PARTICIPACAO, VITORIA, XP_PARTICIPACAO, VITORIA])
  assert.equal(rec(ps[1]).motivo, 'vitoria')
})

test('empate: só a participação; o host decide e a maioria confere', async () => {
  const m = montar(['ana', 'beto', 'caio', 'duda'])
  const { ps, partidaId } = await sala(m, ['ana', 'beto', 'caio', 'duda'])
  m.relogio.andar(300_000)
  relatar(ps[0], partidaId, null)
  relatar(ps[1], partidaId, null)
  relatar(ps[2], partidaId, 0)
  await esperar()
  m.relogio.andar(RELATO_JANELA_MS + ABANDONO_GRACA_MS + 1000) // a DUDA não relatou: a janela fecha
  await esperar()
  assert.equal(m.sb.tabelas.partidas[0].validacao, 'validada')
  assert.deepEqual(ps.slice(0, 3).map((p) => rec(p).xpGanho), [XP_PARTICIPACAO, XP_PARTICIPACAO, XP_PARTICIPACAO])
})

test('TROCAR TIME: o dono escolhe o arranjo no lobby (só no 2x2, fora da partida) e ele vale no registro', async () => {
  const m = montar(['ana', 'beto', 'caio', 'duda'])
  const ps = []
  for (const nome of ['ana', 'beto', 'caio', 'duda']) ps.push(await m.entrar(nome))
  const [dono, ...conv] = ps
  dono.mandar({ t: 'criar' })
  dono.mandar({ t: 'times', arranjo: 1 })
  assert.equal(dono.ultima('sala').sala.arranjo, 0, 'fora do 2x2 não muda')
  dono.mandar({ t: 'modo', modo: '2x2' })
  for (const p of conv) p.mandar({ t: 'entrar', codigo: dono.ultima('sala').sala.codigo })
  conv[0].mandar({ t: 'times', arranjo: 1 })
  assert.equal(dono.ultima('sala').sala.arranjo, 0, 'convidado não muda')
  dono.mandar({ t: 'times', arranjo: 7 })
  assert.equal(dono.ultima('sala').sala.arranjo, 0)
  dono.mandar({ t: 'times', arranjo: 1 })
  assert.equal(conv[2].ultima('sala').sala.arranjo, 1)
  dono.mandar({ t: 'partida', valor: true })
  const partidaId = dono.ultima('sala').sala.partidaId
  dono.mandar({ t: 'times', arranjo: 2 })
  assert.equal(dono.ultima('sala').sala.arranjo, 1, 'no meio da partida não muda')
  await esperar()
  assert.deepEqual(m.sb.tabelas.partida_participantes.map((x) => x.time), [0, 0, 1, 1])
  m.relogio.andar(300_000)
  for (const p of ps) relatar(p, partidaId, 0)
  await esperar()
  assert.deepEqual(ps.map((p) => rec(p).xpGanho), [VITORIA, VITORIA, XP_PARTICIPACAO, XP_PARTICIPACAO])
})

test('quem caiu e não voltou em 20 s é abandono (nada); os outros três relatam e ganham', async () => {
  const m = montar(['ana', 'beto', 'caio', 'duda'])
  const { ps, partidaId } = await sala(m, ['ana', 'beto', 'caio', 'duda'])
  m.relogio.andar(100_000)
  ps[3].sair()
  m.relogio.andar(RETOMADA_MS + 1000)
  await esperar()
  m.relogio.andar(200_000)
  for (const p of ps.slice(0, 3)) relatar(p, partidaId, 0)
  await esperar()
  assert.deepEqual(ps.slice(0, 3).map((p) => rec(p).xpGanho), [VITORIA, XP_PARTICIPACAO, VITORIA])
  assert.equal(m.sb.tabelas.partida_participantes.find((x) => x.lado === 3).resultado, 'abandono')
})

test('limite diário contra CADA adversário: o parceiro não conta, o par mais repetido vale', async () => {
  const m = montar(['ana', 'beto', 'caio', 'duda'])
  const ganhos = []
  for (let k = 0; k < 4; k++) {
    const { ps, partidaId } = await sala(m, ['ana', 'beto', 'caio', 'duda'])
    m.relogio.andar(300_000)
    for (const p of ps) relatar(p, partidaId, 0)
    await esperar()
    ganhos.push(rec(ps[0]).xpGanho)
    await sairTodos(m, ps)
  }
  // ANA e CAIO contra BETO e DUDA: a 4ª vale metade
  assert.deepEqual(ganhos, [VITORIA, VITORIA, VITORIA, VITORIA / 2])
  // TROCAR TIME: ANA e BETO contra CAIO e DUDA. ANA já enfrentou DUDA 4 vezes: metade
  const { ps, partidaId } = await sala(m, ['ana', 'beto', 'caio', 'duda'], 1)
  m.relogio.andar(300_000)
  for (const p of ps) relatar(p, partidaId, 0)
  await esperar()
  assert.equal(rec(ps[0]).xpGanho, VITORIA / 2)
  // a concessão grava um ADVERSÁRIO como oponente (nunca o parceiro)
  const ultima = m.sb.tabelas.concessoes.filter((c) => c.user_id === 'u-ana').at(-1)
  assert.equal(ultima.oponente_id, 'u-caio')
})
