// CONQUISTAS e MAESTRIA pelos caminhos do servidor (server/conquistas.js): a concessão de uma partida
// PVP (server/partidas.js) e o fim de uma corrida da campanha (server/campanha.js) disparam o evento da
// conta UMA vez; o personagem do relato vira maestria (só cosmético); convidado e servidor sem banco não
// disparam nada.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, PROTOCOLO } from '../lan.js'
import { criarRegistro } from '../partidas.js'
import { criarConquistas, msgConquistas } from '../conquistas.js'
import { criarSupabaseFalso } from '../supabase/fake.js'
import { desviarNoQuadro } from '../../src/game/campanha/__tests__/apoioQuadro.js'

function relogioFalso(t = Date.UTC(2026, 10, 11, 15, 0, 0)) {
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
  for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r))
}

function montar({ contas = ['ana', 'beto'], semBanco = false } = {}) {
  const relogio = relogioFalso()
  const id = (nome) => `00000000-0000-4000-8000-${String(contas.indexOf(nome) + 1).padStart(12, '0')}`
  const perfis = contas.map((n) => ({ id: id(n), tag: `${n}#1000`, nome_exibicao: n.toUpperCase(), avatar_tipo: 'padrao', nivel: 1, xp: 0 }))
  const sb = criarSupabaseFalso({ perfis, agora: relogio.agora })
  const autenticar = async (token) => {
    const nome = token.replace(/^token-/, '')
    return contas.includes(nome) ? { id: id(nome), perfil: perfis.find((p) => p.id === id(nome)) } : null
  }
  const lobby = criarLobby({ online: true, agora: relogio.agora, agendar: relogio.agendar, autenticar, registro: semBanco ? null : criarRegistro(sb), log: () => {} })
  let n = 0
  const entrar = async (nome) => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)) }
    const c = lobby.conectar(ws, `10.0.0.${++n}`)
    const p = { c, recebidas, mandar: (m) => lobby.receber(c, JSON.stringify(m)), ultima: (t) => recebidas.filter((m) => m.t === t).at(-1), todas: (t) => recebidas.filter((m) => m.t === t) }
    p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: nome.toUpperCase(), ...(contas.includes(nome) && { token: `token-${nome}` }) })
    await esperar()
    return p
  }
  return { relogio, sb, lobby, entrar, id }
}

async function partidaPvp(m, a = 'ana', b = 'beto') {
  const host = await m.entrar(a)
  const conv = await m.entrar(b)
  host.mandar({ t: 'criar' })
  conv.mandar({ t: 'entrar', codigo: host.ultima('sala').sala.codigo })
  host.mandar({ t: 'partida', valor: true })
  const partidaId = host.ultima('sala').sala.partidaId
  return { host, conv, partidaId }
}

test('partida PVP validada: o vencedor ganha a conquista e a maestria do personagem do relato; repetir não soma', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partidaPvp(m)
  m.relogio.andar(120_000)
  host.mandar({ t: 'resultado', partidaId, vencedorLado: 0, rodadas: 5, duracao: 120, personagem: 'kris' })
  conv.mandar({ t: 'resultado', partidaId, vencedorLado: 0, rodadas: 5, duracao: 120, personagem: 'susie' })
  await esperar()
  const c = host.ultima('conquistas')
  assert.deepEqual(c.novas, ['primeira_vitoria'])
  assert.equal(c.maestria.personagem, 'kris')
  const maestria = (u, p) => m.sb.tabelas.maestria.find((x) => x.user_id === m.id(u) && x.personagem === p)?.pontos
  assert.equal(maestria('ana', 'kris'), 3)
  assert.equal(maestria('beto', 'susie'), 1)
  // quem perdeu não tem conquista nova: nenhuma mensagem
  assert.equal(conv.todas('conquistas').length, 0)
  // relato repetido depois da decisão: nada soma
  host.mandar({ t: 'resultado', partidaId, vencedorLado: 0, rodadas: 5, duracao: 120, personagem: 'kris' })
  await esperar()
  assert.equal(maestria('ana', 'kris'), 3)
  assert.equal(m.sb.tabelas.conta_eventos.length, 2)
  // a Coleção pede o estado (com limite de um pedido a cada 2 s)
  host.mandar({ t: 'conquistas' })
  host.mandar({ t: 'conquistas' })
  await esperar()
  assert.equal(host.todas('conquistasEstado').length, 1)
  assert.deepEqual(host.ultima('conquistasEstado').conquistas.map((x) => x.id), ['primeira_vitoria'])
})

test('personagem inventado no relato: a partida vale, a maestria não', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partidaPvp(m)
  m.relogio.andar(120_000)
  host.mandar({ t: 'resultado', partidaId, vencedorLado: 1, rodadas: 5, duracao: 120, personagem: 'goku' })
  conv.mandar({ t: 'resultado', partidaId, vencedorLado: 1, rodadas: 5, duracao: 120, personagem: 'chara_1' })
  await esperar()
  assert.equal(m.sb.tabelas.maestria.length, 0)
  assert.equal(m.sb.tabelas.conta_eventos.length, 2)
  assert.deepEqual(conv.ultima('conquistas').novas, ['primeira_vitoria'])
})

test('convidado e servidor sem banco: nenhum evento, sem erro', async () => {
  const m = montar({ contas: ['ana'] })
  const { host, conv, partidaId } = await partidaPvp(m, 'ana', 'zeca')
  m.relogio.andar(120_000)
  host.mandar({ t: 'resultado', partidaId, vencedorLado: 1, rodadas: 5, duracao: 120, personagem: 'kris' })
  conv.mandar({ t: 'resultado', partidaId, vencedorLado: 1, rodadas: 5, duracao: 120, personagem: 'kris' })
  await esperar()
  assert.deepEqual(m.sb.tabelas.conta_eventos.map((e) => e.user_id), [m.id('ana')])
  conv.mandar({ t: 'conquistas' })
  await esperar()
  assert.equal(conv.ultima('conquistasEstado').convidado, true)
  const sem = criarConquistas({ registro: null })
  assert.equal(await sem.evento('u', 'partida:12345678', { tipo: 'partida', resultado: 'vitoria' }), null)
  assert.deepEqual(await sem.estado('u'), { conquistas: [], maestria: [] })
  assert.equal(msgConquistas(null), null)
  assert.equal(msgConquistas({ novas: [], itensNovos: [] }), null)
})

test('a campanha: vencer a 1ª porta dá a primeira vitória e a maestria da Kris', async () => {
  const m = montar({ contas: ['ana'] })
  const ana = await m.entrar('ana')
  ana.mandar({ t: 'campanha', acao: 'comecar', mundo: 1, fase: 1 })
  await esperar()
  const melhor = (v) => v.eu.mao.filter((x) => v.eu.jogaveis.includes(x.id) && x.naipe !== 'copas').sort((a, b) => b.custo - a.custo)[0]?.id ?? null
  for (let i = 0; i < 40 && !ana.ultima('campanhaFim'); i++) {
    const corrida = ana.ultima('campanhaInicio').corrida
    const v = ana.ultima('campanhaRodada')?.proxima ?? ana.ultima('campanhaInicio').rodada
    const antes = ana.todas('campanhaEsquiva').length
    ana.mandar({ t: 'campanha', acao: 'carta', corrida, carta: melhor(v) })
    await esperar()
    const e = ana.todas('campanhaEsquiva')[antes]
    let seq = 0
    let t0 = 0
    const r = e.esquiva?.jogadores[0]
      ? desviarNoQuadro(e.esquiva, {
          aoPedaco(pedaco, t) {
            m.relogio.andar(t - t0)
            t0 = t
            if (pedaco.length) ana.mandar({ t: 'campanha', acao: 'posicoes', corrida, rodada: e.rodada, seq: seq++, a: pedaco })
          },
        })
      : { acertos: 0 }
    m.relogio.andar(200)
    ana.mandar({ t: 'campanha', acao: 'fimEsquiva', corrida, rodada: e.rodada, acertos: r.acertos })
    await esperar()
  }
  assert.equal(ana.ultima('campanhaFim').resultado, 'vitoria')
  const c = ana.ultima('conquistas')
  assert.ok(c.novas.includes('primeira_vitoria'), JSON.stringify(c))
  assert.equal(c.maestria.personagem, 'kris')
  assert.equal(m.sb.tabelas.conta_eventos[0].ref.startsWith('campanha:'), true)
})
