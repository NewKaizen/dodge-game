import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, PROTOCOLO } from '../lan.js'
import { criarRegistro, ladosDoTrofeu } from '../partidas.js'
import { criarSupabaseFalso } from '../supabase/fake.js'
import { infoSemanal } from '../../src/lib/semanal.js'
import { PROTOCOLO as PROTOCOLO_CLIENTE } from '../../src/lib/lan/rede.js'

// BOSS SEMANAL: a semana vem do relógio do servidor, a sala do boss é CO-OP de 2 a 4 e o troféu
// exclusivo sai pela mesma validação do XP do CO-OP (o host decide + maioria), uma vez por conta.

const INICIO = Date.UTC(2026, 10, 4, 15, 0, 0) // quarta da semana 2026-S45 (Escuridão)
function relogioFalso(t = INICIO) {
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

function montar(contas, relogio = relogioFalso()) {
  const id = (nome) => `u-${nome}`
  const perfis = contas.map((n) => ({ id: id(n), tag: `${n}#1000`, nome_exibicao: n.toUpperCase(), avatar_tipo: 'padrao', nivel: 1, xp: 0 }))
  const sb = criarSupabaseFalso({ perfis, agora: relogio.agora })
  const autenticar = async (token) => {
    const nome = token.replace(/^token-/, '').replace(/-\d+$/, '')
    return contas.includes(nome) ? { id: id(nome), perfil: perfis.find((p) => p.id === id(nome)) } : null
  }
  const lobby = criarLobby({ online: true, agora: relogio.agora, agendar: relogio.agendar, autenticar, registro: criarRegistro(sb), log: () => {}, eleicaoMs: 0 })
  let n = 0
  const entrar = async (nome) => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)) }
    const c = lobby.conectar(ws, `10.0.0.${++n}`)
    const p = { nome, recebidas, mandar: (m) => lobby.receber(c, JSON.stringify(m)), ultima: (t) => recebidas.filter((m) => m.t === t).at(-1) }
    p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: nome.toUpperCase(), ...(contas.includes(nome) && { token: `token-${nome}-${++n}` }) })
    await esperar()
    return p
  }
  return { relogio, entrar, sb }
}

async function salaSemanal(m, nomes) {
  const ps = []
  for (const nome of nomes) ps.push(await m.entrar(nome))
  const [host, ...conv] = ps
  host.mandar({ t: 'criar', semanal: true })
  for (const p of conv) p.mandar({ t: 'entrar', codigo: host.ultima('sala').sala.codigo })
  host.mandar({ t: 'partida', valor: true })
  return { ps, host, partidaId: host.ultima('sala').sala.partidaId, sala: host.ultima('sala').sala }
}
const relatar = (p, partidaId, vitoria, extra = {}) => p.mandar({ t: 'resultado', partidaId, vitoria, rodadas: 8, duracao: 300, personagem: 'kris', ...extra })
const SEMANA = infoSemanal(INICIO)

test('protocolo 16 nos dois lados (15 trouxe o boss semanal); o bemvindo traz a semana do relógio do servidor', async () => {
  assert.ok(PROTOCOLO >= 15)
  assert.equal(PROTOCOLO_CLIENTE, PROTOCOLO)
  const m = montar([])
  const p = await m.entrar('ana')
  const b = p.ultima('bemvindo')
  assert.equal(b.semanal.semana, '2026-S45')
  assert.equal(b.semanal.chefe, 'escuridao')
  assert.equal(b.semanal.restanteMs, Date.UTC(2026, 10, 9, 3) - INICIO)
  // na virada (segunda 00:00 de SP) o pedido de novo já traz a outra semana
  m.relogio.andar(b.semanal.restanteMs)
  p.mandar({ t: 'semanalInfo' })
  assert.equal(p.ultima('semanal').semana, '2026-S46')
  assert.equal(p.ultima('semanal').chefe, 'ladra')
})

test('sala do boss semanal: CO-OP de 2 (coop) ou 3–4 (coop4); outro modo tira o boss', async () => {
  const m = montar([])
  const ps = []
  for (const n of ['ana', 'beto', 'caio', 'duda', 'eva']) ps.push(await m.entrar(n))
  ps[0].mandar({ t: 'criar', semanal: true })
  const codigo = ps[0].ultima('sala').sala.codigo
  assert.equal(ps[0].ultima('sala').sala.modo, 'coop')
  assert.equal(ps[0].ultima('sala').sala.max, 4)
  assert.equal(ps[0].ultima('sala').sala.semanal.chefe, 'escuridao')
  ps[1].mandar({ t: 'entrar', codigo })
  assert.equal(ps[0].ultima('sala').sala.modo, 'coop')
  ps[2].mandar({ t: 'entrar', codigo })
  assert.equal(ps[0].ultima('sala').sala.modo, 'coop4')
  ps[3].mandar({ t: 'entrar', codigo })
  ps[4].mandar({ t: 'entrar', codigo })
  assert.match(ps[4].ultima('erro').msg, /cheia/)
  ps[3].mandar({ t: 'sair' })
  ps[2].mandar({ t: 'sair' })
  assert.equal(ps[0].ultima('sala').sala.modo, 'coop')
  ps[0].mandar({ t: 'salaSemanal', valor: false })
  assert.equal(ps[0].ultima('sala').sala.semanal, null)
  ps[0].mandar({ t: 'salaSemanal', valor: true })
  ps[0].mandar({ t: 'modo', modo: 'pvp' })
  assert.equal(ps[0].ultima('sala').sala.semanal, null)
  assert.equal(ps[0].ultima('sala').sala.modo, 'pvp')
})

test('vitória validada: o troféu da semana para quem tem conta, uma vez só; XP normal; convidado nada', async () => {
  const m = montar(['ana', 'beto'])
  const { ps, partidaId } = await salaSemanal(m, ['ana', 'beto', 'caio'])
  await esperar()
  m.relogio.andar(200_000)
  for (const p of ps) relatar(p, partidaId, true, { semana: SEMANA.semana })
  await esperar()
  for (const p of ps.slice(0, 2)) {
    const r = p.ultima('recompensa')
    assert.equal(r.motivo, 'vitoria')
    assert.ok(r.xpGanho > 0)
    assert.deepEqual(r.trofeu, { id: SEMANA.trofeu.id, semana: '2026-S45', novo: true })
  }
  assert.equal(ps[2].ultima('recompensa').trofeu, undefined)
  assert.equal(m.sb.tabelas.trofeus_semanais.length, 2)
  assert.equal(m.sb.tabelas.catalogo_itens[0].exclusivo, true)
  assert.ok(m.sb.tabelas.inventario.some((i) => i.user_id === 'u-ana' && i.item_id === SEMANA.trofeu.id))
  // ganhou de novo na mesma semana: XP sim, troféu não é novo (e não duplica)
  ps[0].mandar({ t: 'partida', valor: false })
  ps[0].mandar({ t: 'partida', valor: true })
  const outra = ps[0].ultima('sala').sala.partidaId
  m.relogio.andar(200_000)
  for (const p of ps) relatar(p, outra, true, { semana: SEMANA.semana })
  await esperar()
  assert.equal(ps[0].ultima('recompensa').partidaId, outra)
  assert.equal(ps[0].ultima('recompensa').trofeu.novo, false)
  assert.equal(m.sb.tabelas.trofeus_semanais.length, 2)
  assert.equal(m.sb.tabelas.inventario.filter((i) => i.item_id === SEMANA.trofeu.id).length, 2)
})

test('sem troféu: derrota, partida curta, discordância, relato de outra semana, sala comum', async () => {
  const casos = [
    ['derrota', (ps, id) => ps.forEach((p) => relatar(p, id, false, { semana: SEMANA.semana })), 200_000],
    ['curta', (ps, id) => ps.forEach((p) => relatar(p, id, true, { semana: SEMANA.semana })), 30_000],
    ['discordam', (ps, id) => ps.forEach((p, i) => relatar(p, id, i === 0, { semana: SEMANA.semana })), 200_000],
    ['outra semana', (ps, id) => ps.forEach((p) => relatar(p, id, true, { semana: '2026-S46' })), 200_000],
  ]
  for (const [nome, fazer, ms] of casos) {
    const m = montar(['ana', 'beto'])
    const { ps, partidaId } = await salaSemanal(m, ['ana', 'beto'])
    m.relogio.andar(ms)
    fazer(ps, partidaId)
    await esperar()
    for (const p of ps) assert.equal(p.ultima('recompensa')?.trofeu, undefined, `${nome}: ${p.nome}`)
    assert.equal(m.sb.tabelas.trofeus_semanais.length, 0, nome)
  }
  // sala de CO-OP comum: o relato com semana não vale nada
  const m = montar(['ana', 'beto'])
  const [a, b] = [await m.entrar('ana'), await m.entrar('beto')]
  a.mandar({ t: 'criar' })
  a.mandar({ t: 'modo', modo: 'coop' })
  b.mandar({ t: 'entrar', codigo: a.ultima('sala').sala.codigo })
  a.mandar({ t: 'partida', valor: true })
  const id = a.ultima('sala').sala.partidaId
  m.relogio.andar(200_000)
  for (const p of [a, b]) relatar(p, id, true, { semana: SEMANA.semana })
  await esperar()
  assert.equal(a.ultima('recompensa').motivo, 'vitoria')
  assert.equal(a.ultima('recompensa').trofeu, undefined)
})

test('a semana fica a do começo da partida (virou no meio: o troféu é o da semana em que começou)', async () => {
  const relogio = relogioFalso(Date.UTC(2026, 10, 9, 2, 58)) // domingo 23:58 em SP
  const m = montar(['ana', 'beto'], relogio)
  const { ps, partidaId, sala } = await salaSemanal(m, ['ana', 'beto'])
  assert.equal(sala.semanal.semana, '2026-S45')
  relogio.andar(300_000) // já é segunda
  assert.equal(ps[0].ultima('sala').sala.semanal.semana, '2026-S45')
  for (const p of ps) relatar(p, partidaId, true, { semana: '2026-S45' })
  await esperar()
  assert.equal(ps[0].ultima('recompensa').trofeu.semana, '2026-S45')
})

test('ladosDoTrofeu: a regra pura (host decide + maioria já na decisão)', () => {
  const p = (extra = {}) => ({
    modo: 'coop4',
    semanal: SEMANA,
    participantes: [
      { lado: 0, usuario: 'a', relato: { semana: SEMANA.semana } },
      { lado: 1, usuario: 'b', relato: { semana: SEMANA.semana } },
      { lado: 2, usuario: null, relato: { semana: SEMANA.semana } },
      { lado: 3, usuario: 'd', relato: { semana: '2026-S44' } },
    ],
    ...extra,
  })
  const d = (extra = {}) => ({ validacao: 'validada', duracaoS: 120, rodadas: 5, resultados: { 0: 'vitoria', 1: 'vitoria', 2: 'vitoria', 3: 'vitoria' }, ...extra })
  assert.deepEqual(ladosDoTrofeu(p(), d()), [0, 1])
  assert.deepEqual(ladosDoTrofeu(p(), d({ validacao: 'contestada' })), [])
  assert.deepEqual(ladosDoTrofeu(p(), d({ duracaoS: 59 })), [])
  assert.deepEqual(ladosDoTrofeu(p(), d({ rodadas: 1 })), [])
  assert.deepEqual(ladosDoTrofeu(p(), d({ resultados: { 0: 'vitoria', 1: 'abandono', 2: 'vitoria', 3: 'vitoria' } })), [0])
  assert.deepEqual(ladosDoTrofeu(p({ semanal: null }), d()), [])
  assert.deepEqual(ladosDoTrofeu(p({ modo: 'pvp' }), d()), [])
})
