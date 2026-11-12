// A CAMPANHA no servidor (server/campanha.js pelo lobby de server/lan.js, com o Supabase falso):
// só com conta; o servidor roda a luta (as regras do CO-OP contra o chefe), recusa carta ilegal, confere as posições, decide o dano
// e concede uma vez só; corrida suspeita (teleporte, relato falso, relógio adiantado) não ganha nada.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, PROTOCOLO } from '../lan.js'
import { criarRegistro } from '../partidas.js'
import { criarSupabaseFalso } from '../supabase/fake.js'
import { desviarNoQuadro } from '../../src/game/campanha/__tests__/apoioQuadro.js'
import { limitesDoQuadro } from '../../src/game/campanha/quadro.js'
import { XP_PRIMEIRA, XP_ESTRELA, XP_CAMPANHA_DIA, XP_PRIMEIRA_CHEFE } from '../../src/game/campanha/recompensas.js'
import { MUNDO1 } from '../../src/game/campanha/mundos/mundo1.js'
import { PROTOCOLO as PROTOCOLO_CLIENTE } from '../../src/lib/lan/rede.js'

const INICIO = Date.UTC(2026, 10, 4, 15, 0, 0)
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
  for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r))
}

function montar(contas = ['ana']) {
  const relogio = relogioFalso()
  const id = (nome) => `00000000-0000-4000-8000-${String(contas.indexOf(nome) + 1).padStart(12, '0')}`
  const perfis = contas.map((n) => ({ id: id(n), tag: `${n}#1000`, nome_exibicao: n.toUpperCase(), avatar_tipo: 'padrao', nivel: 1, xp: 0 }))
  const sb = criarSupabaseFalso({ perfis, agora: relogio.agora })
  const logs = []
  const autenticar = async (token) => {
    const nome = token.replace(/^token-/, '')
    return contas.includes(nome) ? { id: id(nome), perfil: perfis.find((p) => p.id === id(nome)) } : null
  }
  const lobby = criarLobby({ online: true, agora: relogio.agora, agendar: relogio.agendar, autenticar, registro: criarRegistro(sb), log: (l) => logs.push(l) })
  let n = 0
  const entrar = async (nome) => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)) }
    const c = lobby.conectar(ws, `10.0.0.${++n}`)
    const p = { nome, c, recebidas, ws, mandar: (m) => lobby.receber(c, JSON.stringify(m)), ultima: (t) => recebidas.filter((m) => m.t === t).at(-1), todas: (t) => recebidas.filter((m) => m.t === t) }
    p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: nome.toUpperCase(), ...(contas.includes(nome) && { token: `token-${nome}` }) })
    await esperar()
    return p
  }
  return { relogio, entrar, sb, lobby, logs, id }
}

const melhor = (v) => v.eu.mao.filter((x) => v.eu.jogaveis.includes(x.id) && x.naipe !== 'copas').sort((a, b) => b.custo - a.custo)[0]?.id ?? null

// uma rodada inteira pela rede: carta -> pedaços de posições no ritmo do relógio -> fim da esquiva
//   mexer(pedaco, t): adultera um pedaço antes de mandar · acertos: o relato (padrão: o que sentiu)
async function rodada(m, p, { carta, piloto = 'bom', mexer, acertos, adiantar = false } = {}) {
  const corrida = p.ultima('campanhaInicio').corrida
  const v = p.ultima('campanhaRodada')?.proxima ?? p.ultima('campanhaInicio').rodada
  const antes = p.todas('campanhaEsquiva').length
  p.mandar({ t: 'campanha', acao: 'carta', corrida, carta: carta === undefined ? melhor(v) : carta })
  await esperar()
  const e = p.todas('campanhaEsquiva')[antes]
  if (!e) return { erro: p.ultima('campanhaErro') }
  let seq = 0
  let relogio = 0
  const esq = e.esquiva
  const r =
    esq && esq.jogadores[0]
      ? desviarNoQuadro(esq, {
          piloto,
          aoPedaco(pedaco, t) {
            if (!adiantar) m.relogio.andar(t - relogio)
            relogio = t
            if (pedaco.length) p.mandar({ t: 'campanha', acao: 'posicoes', corrida, rodada: e.rodada, seq: seq++, a: mexer ? mexer(pedaco, t, esq) : pedaco })
          },
        })
      : { acertos: 0 }
  if (!adiantar) m.relogio.andar(200)
  p.mandar({ t: 'campanha', acao: 'fimEsquiva', corrida, rodada: e.rodada, acertos: acertos ?? r.acertos })
  await esperar()
  return { e, r }
}

async function comecar(m, p, fase = 1) {
  p.mandar({ t: 'campanha', acao: 'comecar', mundo: 1, fase })
  await esperar()
  return p.ultima('campanhaInicio')
}

async function jogarAteOFim(m, p, op = {}) {
  for (let i = 0; i < 40 && !p.ultima('campanhaFim'); i++) await rodada(m, p, op)
  return p.ultima('campanhaFim')
}

test('protocolo 17 nos dois lados', () => {
  assert.equal(PROTOCOLO, 17)
  assert.equal(PROTOCOLO_CLIENTE, PROTOCOLO)
})

test('convidado não joga a campanha; fase bloqueada é recusada', async () => {
  const m = montar(['ana'])
  const convidado = await m.entrar('beto')
  convidado.mandar({ t: 'campanha', acao: 'comecar', mundo: 1, fase: 1 })
  await esperar()
  assert.equal(convidado.ultima('campanhaErro').motivo, 'convidado')
  const ana = await m.entrar('ana')
  ana.mandar({ t: 'campanha', acao: 'comecar', mundo: 1, fase: 2 })
  await esperar()
  assert.equal(ana.ultima('campanhaErro').motivo, 'bloqueada')
  ana.mandar({ t: 'campanha', acao: 'comecar', mundo: 1, fase: 9 })
  await esperar()
  assert.equal(ana.ultima('campanhaErro').motivo, 'fase')
  ana.mandar({ t: 'campanha', acao: 'progresso' })
  await esperar()
  assert.deepEqual(ana.ultima('campanhaProgresso').fases, [])
  assert.equal(ana.ultima('campanhaProgresso').teto, XP_CAMPANHA_DIA)
})

test('a fase 1 inteira pelo servidor: vence, estrelas e XP do banco, o mapa libera a fase 2', async () => {
  const m = montar(['ana'])
  const ana = await m.entrar('ana')
  const ini = await comecar(m, ana)
  assert.ok(ini.corrida)
  assert.equal(ini.rodada.eu.mao.length, 5)
  const fim = await jogarAteOFim(m, ana)
  assert.equal(fim.resultado, 'vitoria', JSON.stringify(fim))
  assert.ok(fim.estrelas >= 1)
  assert.equal(fim.xpGanho, XP_PRIMEIRA + fim.estrelas * XP_ESTRELA)
  assert.equal(fim.primeira, true)
  assert.equal(m.sb.tabelas.perfis[0].xp, fim.xpGanho)
  const prog = ana.ultima('campanhaProgresso')
  assert.deepEqual(prog.fases, [{ mundo: 1, fase: 1, estrelas: fim.estrelas, concluida: true }])
  // agora a fase 2 abre
  const ini2 = await comecar(m, ana, 2)
  assert.notEqual(ini2.corrida, ini.corrida)
  assert.equal(m.lobby.campanha.corridas.size, 1)
})

test('carta ilegal é recusada e a rodada continua', async () => {
  const m = montar(['ana'])
  const ana = await m.entrar('ana')
  const ini = await comecar(m, ana)
  ana.mandar({ t: 'campanha', acao: 'carta', corrida: ini.corrida, carta: 'kris-copas-5' })
  await esperar()
  assert.equal(ana.ultima('campanhaErro').motivo, 'carta')
  const cara = ini.rodada.eu.mao.find((x) => x.custo > ini.rodada.eu.energia)
  if (cara) {
    ana.mandar({ t: 'campanha', acao: 'carta', corrida: ini.corrida, carta: cara.id })
    await esperar()
    assert.equal(ana.ultima('campanhaErro').codigo, 'sem_energia')
  }
  ana.mandar({ t: 'campanha', acao: 'carta', corrida: ini.corrida, carta: { id: 'x' } })
  await esperar()
  assert.equal(ana.todas('campanhaEsquiva').length, 0)
  const { e } = await rodada(m, ana)
  assert.ok(e)
  assert.equal(ana.ultima('campanhaRodada').resumo.ok, true)
})

test('trapaça: posições teletransportadas -> suspeita, sem XP, com o motivo no log e no banco', async () => {
  const m = montar(['ana'])
  const ana = await m.entrar('ana')
  await comecar(m, ana)
  let feito = false
  const tp = (pedaco, t, esq) => {
    if (feito || pedaco.length < 9) return pedaco
    feito = true
    const l = limitesDoQuadro(esq.caixa)
    const a = [...pedaco]
    a[4] = a[4] > ((l.left + l.right) / 2) * 10 ? (l.left + 12) * 10 : (l.right - 12) * 10
    return a
  }
  for (let i = 0; i < 6 && !ana.ultima('campanhaFim'); i++) await rodada(m, ana, { mexer: tp })
  const fim = ana.ultima('campanhaFim')
  assert.equal(fim.resultado, 'suspeita')
  assert.equal(fim.motivo, 'teleporte')
  assert.equal(fim.xpGanho, 0)
  assert.equal(m.sb.tabelas.perfis[0].xp, 0)
  assert.ok(m.logs.some((l) => /suspeita \(teleporte\)/.test(l)))
  assert.equal(m.sb.tabelas.campanha_corridas[0].resultado, 'suspeita')
  assert.equal(m.sb.tabelas.campanha_progresso.length, 0)
})

test('trapaça: relato "não levei nenhum acerto" parado no meio do ataque -> o servidor acha os acertos', async () => {
  const m = montar(['ana'])
  const ana = await m.entrar('ana')
  await comecar(m, ana, 1)
  m.sb.tabelas.campanha_progresso.push(...[1, 2, 3, 4].map((fase) => ({ user_id: m.id('ana'), mundo: 1, fase, estrelas: 1, concluida: true, vitorias: 1 })))
  await comecar(m, ana, 5) // a chuva: tudo de cima
  let acertosServidor = 0
  const fins = ana.todas('campanhaFim').length // a corrida da fase 1 foi abandonada ao começar a 5
  for (let i = 0; i < 5 && ana.todas('campanhaFim').length === fins; i++) {
    await rodada(m, ana, { piloto: 'parado', acertos: 0 })
    acertosServidor += ana.ultima('campanhaRodada')?.resumo?.acertos?.[0] ?? 0
  }
  assert.ok(acertosServidor > 0, 'o servidor achou os acertos que o relato escondeu')
  assert.ok(ana.ultima('campanhaRodada').resumo.eu.hp < ana.ultima('campanhaRodada').resumo.eu.hpMax)
})

test('trapaça: esquiva mais rápida que o relógio do servidor -> suspeita (futuro)', async () => {
  const m = montar(['ana'])
  const ana = await m.entrar('ana')
  await comecar(m, ana)
  for (let i = 0; i < 6 && !ana.ultima('campanhaFim'); i++) await rodada(m, ana, { adiantar: true })
  const fim = ana.ultima('campanhaFim')
  assert.equal(fim.resultado, 'suspeita')
  assert.ok(['futuro', 'rapida_demais'].includes(fim.motivo), fim.motivo)
  assert.equal(fim.xpGanho, 0)
})

test('caiu no meio: a corrida é abandonada (sem recompensa); prazo sem carta também', async () => {
  const m = montar(['ana'])
  const ana = await m.entrar('ana')
  await comecar(m, ana)
  m.lobby.desconectar(ana.c)
  await esperar()
  assert.equal(m.lobby.campanha.corridas.size, 0)
  assert.equal(m.sb.tabelas.campanha_corridas[0].resultado, 'abandono')
  const ana2 = await m.entrar('ana')
  await comecar(m, ana2)
  m.relogio.andar(4 * 60_000)
  await esperar()
  assert.equal(ana2.ultima('campanhaFim').resultado, 'abandono')
  assert.equal(ana2.ultima('campanhaFim').motivo, 'sem_carta')
  assert.equal(m.sb.tabelas.perfis[0].xp, 0)
})

test('concessão idempotente, teto diário e os cosméticos do mundo (chefe e 3 estrelas)', async () => {
  const m = montar(['ana'])
  const reg = criarRegistro(m.sb)
  const u = m.id('ana')
  const c = (id, fase, estrelas, resultado = 'vitoria') => reg.concederCampanha({ corrida: id, usuario: u, mundo: 1, fase, resultado, estrelas, rodadas: 5, duracaoS: 120 })
  const a = await c('00000000-0000-4000-8000-0000000000a1', 1, 2)
  const de2 = await c('00000000-0000-4000-8000-0000000000a1', 1, 3)
  assert.equal(de2.xpGanho, a.xpGanho)
  assert.equal(m.sb.tabelas.perfis[0].xp, XP_PRIMEIRA + 2 * XP_ESTRELA)
  // fase 3 sem a 2: bloqueada no banco também
  assert.equal((await c('00000000-0000-4000-8000-0000000000a2', 3, 3)).resultado, 'suspeita')
  // vence tudo com 3 estrelas: o chefe dá o título e a moldura; as 3 estrelas em tudo, o verso
  let k = 10
  await c(`00000000-0000-4000-8000-0000000000${k++}`, 1, 3)
  for (const f of MUNDO1.fases.slice(1)) await c(`00000000-0000-4000-8000-0000000000${k++}`, f.n, 3)
  const inv = new Set(m.sb.tabelas.inventario.filter((i) => i.user_id === u).map((i) => i.item_id))
  for (const id of ['titulo.andarilho_papel', 'moldura.floresta_papel', 'verso.folha_dobrada']) assert.ok(inv.has(id), id)
  // o teto do dia: a soma da campanha de hoje não passa de XP_CAMPANHA_DIA
  const hoje = m.sb.tabelas.campanha_corridas.reduce((s, x) => s + x.xp, 0)
  assert.equal(hoje, XP_CAMPANHA_DIA)
  assert.ok(XP_PRIMEIRA * 5 + XP_PRIMEIRA_CHEFE + 18 * XP_ESTRELA > XP_CAMPANHA_DIA)
  const extra = await c('00000000-0000-4000-8000-0000000000ff', 2, 3)
  assert.equal(extra.xpGanho, 0)
  assert.equal(extra.motivo, 'teto_dia')
  // no dia seguinte volta
  m.relogio.andar(86_400_000)
  assert.equal((await c('00000000-0000-4000-8000-0000000000fe', 2, 3)).xpGanho, 10)
})

test('escolhas dos diálogos: só as que existem nos textos ficam guardadas', async () => {
  const m = montar(['ana'])
  const ana = await m.entrar('ana')
  ana.mandar({ t: 'campanha', acao: 'escolha', mundo: 1, chave: 'bilhete', valor: 'guardar' })
  ana.mandar({ t: 'campanha', acao: 'escolha', mundo: 1, chave: 'bilhete', valor: 'rasgar' })
  ana.mandar({ t: 'campanha', acao: 'escolha', mundo: 1, chave: 'inventada', valor: 'sim' })
  await esperar()
  ana.mandar({ t: 'campanha', acao: 'progresso' })
  await esperar()
  assert.deepEqual(ana.ultima('campanhaProgresso').escolhas, { 1: { bilhete: 'guardar' } })
})

test('mensagens tortas não derrubam nada', async () => {
  const m = montar(['ana'])
  const ana = await m.entrar('ana')
  for (const x of [{ acao: 'nada' }, { acao: 'carta', corrida: 'x'.repeat(200) }, { acao: 'posicoes', corrida: '12345678', a: 'oi' }, { acao: 'fimEsquiva' }, { acao: 'comecar', mundo: 'a', fase: {} }, { acao: '__proto__' }, { acao: 'toString' }]) ana.mandar({ t: 'campanha', ...x })
  await esperar()
  const ini = await comecar(m, ana)
  ana.mandar({ t: 'campanha', acao: 'posicoes', corrida: ini.corrida, rodada: 1, seq: 5, a: [1, 2, 3] })
  ana.mandar({ t: 'campanha', acao: 'fimEsquiva', corrida: ini.corrida, rodada: 1, acertos: 'muitos' })
  await esperar()
  assert.equal(m.lobby.campanha.corridas.size, 1)
})
