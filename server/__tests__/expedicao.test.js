import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { criarLobby, PROTOCOLO } from '../lan.js'
import { criarRegistro, expedicaoDaPartida, lerRelato } from '../partidas.js'
import { criarSupabaseFalso } from '../supabase/fake.js'
import { PROTOCOLO as PROTOCOLO_CLIENTE } from '../../src/lib/lan/rede.js'
import { XP_EXPEDICAO, xpDaExpedicao, lerExpedicao, CHEFOES_EXPEDICAO, DURACAO_MINIMA_LUTA_S, chaveBauExpedicao } from '../../src/lib/expedicao.js'
import { ITENS_EXPEDICAO, ITENS_BAU, POOL_BAU, FONTES_BAU, arteDoVerso, cosmeticoDaExpedicao } from '../../src/lib/cosmeticos.js'
import { itemDoCatalogo } from '../../src/lib/progresso.js'
import { CHEFOES, SEMANAIS_EXPEDICAO } from '../../src/game/coop/expedicao.js'

// EXPEDIÇÃO (0017): o XP a mais por luta vencida, o bônus de completar, a chance de baú (1 por dia por chefão) e
// o verso exclusivo na 1ª vez contra cada chefão. A mesma validação do XP do CO-OP (os relatos concordam), por
// cima dela o mesmo chefão e as mesmas lutas nos relatos.

const INICIO = Date.UTC(2026, 10, 15, 15, 0, 0)
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

function montar(contas, { sorte = () => true } = {}) {
  const relogio = relogioFalso()
  const id = (nome) => `u-${nome}`
  const perfis = contas.map((n) => ({ id: id(n), tag: `${n}#1000`, nome_exibicao: n.toUpperCase(), avatar_tipo: 'padrao', nivel: 1, xp: 0 }))
  const sb = criarSupabaseFalso({ perfis, agora: relogio.agora })
  const autenticar = async (token) => {
    const nome = token.replace(/^token-/, '').replace(/-\d+$/, '')
    return contas.includes(nome) ? { id: id(nome), perfil: perfis.find((p) => p.id === id(nome)) } : null
  }
  const lobby = criarLobby({ online: true, agora: relogio.agora, agendar: relogio.agendar, autenticar, registro: criarRegistro(sb), log: () => {}, eleicaoMs: 0, sortearBauExpedicao: () => sorte() })
  let n = 0
  const entrar = async (nome) => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)) }
    const c = lobby.conectar(ws, `10.0.0.${++n}`)
    const p = { nome, recebidas, mandar: (m) => lobby.receber(c, JSON.stringify(m)), ultima: (t) => recebidas.filter((m) => m.t === t).at(-1), todas: (t) => recebidas.filter((m) => m.t === t) }
    p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: nome.toUpperCase(), ...(contas.includes(nome) && { token: `token-${nome}-${++n}` }) })
    await esperar()
    return p
  }
  return { relogio, entrar, sb }
}

async function sala(m, nomes) {
  const ps = []
  for (const nome of nomes) ps.push(await m.entrar(nome))
  const [host, ...conv] = ps
  host.mandar({ t: 'criar' })
  host.mandar({ t: 'modo', modo: nomes.length > 2 ? 'coop4' : 'coop' })
  for (const p of conv) p.mandar({ t: 'entrar', codigo: host.ultima('sala').sala.codigo })
  host.mandar({ t: 'partida', valor: true })
  await esperar()
  return { ps, host, partidaId: host.ultima('sala').sala.partidaId }
}
async function novaPartida(host) {
  host.mandar({ t: 'partida', valor: false })
  host.mandar({ t: 'partida', valor: true })
  await esperar()
  return host.ultima('sala').sala.partidaId
}
const relatar = (p, partidaId, vitoria, expedicao) => p.mandar({ t: 'resultado', partidaId, vitoria, rodadas: 24, duracao: 600, personagem: 'kris', ...(expedicao && { expedicao }) })
const completa = (chefe = 'king') => ({ chefe, lutas: 3, sorteada: false })

test('protocolo 23 nos dois lados (a votação do CO-OP; a expedição no relato e na recompensa desde o 22)', () => {
  assert.equal(PROTOCOLO, 23)
  assert.equal(PROTOCOLO_CLIENTE, PROTOCOLO)
})

test('relato: a expedição limpa (chefão conhecido, 0 a 3 lutas)', () => {
  assert.deepEqual(lerRelato({ partidaId: 'x', vitoria: true, expedicao: { chefe: 'queen', lutas: 3, sorteada: 1 } }, 'coop').expedicao, { chefe: 'queen', lutas: 3, sorteada: true })
  assert.equal(lerRelato({ partidaId: 'x', vitoria: true, expedicao: { chefe: 'kingLacaios', lutas: 3 } }, 'coop').expedicao, undefined)
  assert.equal(lerRelato({ partidaId: 'x', vitoria: true, expedicao: { chefe: 'king', lutas: 9 } }, 'coop4').expedicao, undefined)
  assert.equal(lerRelato({ partidaId: 'x', vencedorLado: 0, expedicao: completa() }, 'pvp').expedicao, undefined, 'só CO-OP')
  assert.equal(lerExpedicao(null), null)
  // (0018) + os bosses semanais (sempre uma expedição)
  assert.deepEqual(CHEFOES_EXPEDICAO, [...CHEFOES, ...SEMANAIS_EXPEDICAO])
  assert.deepEqual(lerRelato({ partidaId: 'x', vitoria: true, expedicao: { chefe: 'ladra', lutas: 3 } }, 'coop').expedicao, { chefe: 'ladra', lutas: 3, sorteada: false })
})

test('expedicaoDaPartida: concordância, resultado coerente e duração mínima', () => {
  const p = (relatos, modo = 'coop') => ({ modo, participantes: relatos.map((relato, lado) => ({ lado, relato })) })
  const d = (res, duracaoS = 600, validacao = 'validada') => ({ validacao, resultados: { 0: res, 1: res }, duracaoS })
  const v = (e) => ({ vitoria: true, expedicao: e })
  assert.deepEqual(expedicaoDaPartida(p([v(completa()), v(completa())]), d('vitoria')), { chefe: 'king', lutas: 3, completa: true })
  assert.equal(expedicaoDaPartida(p([v(completa()), v(completa('queen'))]), d('vitoria')), null, 'chefões diferentes')
  assert.equal(expedicaoDaPartida(p([v(completa()), { vitoria: true }]), d('vitoria')), null, 'um relato sem a expedição')
  assert.equal(expedicaoDaPartida(p([v(completa()), v(completa())]), d('vitoria', 600, 'contestada')), null)
  assert.equal(expedicaoDaPartida(p([v(completa()), v(completa())]), d('vitoria', 3 * DURACAO_MINIMA_LUTA_S - 1)), null, 'curta demais para 3 lutas')
  assert.equal(expedicaoDaPartida(p([v({ chefe: 'king', lutas: 2 }), v({ chefe: 'king', lutas: 2 })]), d('vitoria')), null, 'vitória com 2 lutas não fecha')
  // caiu no chefão: 2 lutas, derrota; o menor relato vale
  const der = (l) => ({ vitoria: false, expedicao: { chefe: 'jevil', lutas: l } })
  assert.deepEqual(expedicaoDaPartida(p([der(2), der(1)]), d('derrota')), { chefe: 'jevil', lutas: 1, completa: false })
  assert.equal(expedicaoDaPartida(p([v(completa()), v(completa())], 'pvp'), d('vitoria')), null)
})

test('completa: XP das 3 lutas + bônus, verso exclusivo e baú; na mesma partida repetida, nada a mais', async () => {
  const m = montar(['ana', 'beto'])
  const { ps, partidaId } = await sala(m, ['ana', 'beto'])
  m.relogio.andar(600_000)
  for (const p of ps) relatar(p, partidaId, true, completa('king'))
  await esperar()
  for (const p of ps) {
    const r = p.ultima('recompensa')
    assert.equal(r.motivo, 'vitoria')
    assert.equal(r.expedicao.xp, xpDaExpedicao({ lutas: 3, completa: true }))
    assert.equal(r.expedicao.xp, 3 * XP_EXPEDICAO.porLuta + XP_EXPEDICAO.completa)
    assert.equal(r.expedicao.completa, true)
    assert.equal(r.expedicao.cosmetico, 'verso.exp_tabuleiro')
    assert.equal(r.expedicao.cosmeticoNovo, true)
    assert.equal(r.expedicao.bau, true)
    assert.ok(r.itensNovos.includes('verso.exp_tabuleiro'))
    assert.ok(r.xpGanho > r.expedicao.xp, 'o XP de sempre continua lá')
    assert.ok(p.todas('bauGanho').some((b) => b.fontes.includes('expedicao')))
  }
  assert.equal(m.sb.tabelas.expedicoes.length, 2)
  assert.equal(m.sb.tabelas.baus.filter((b) => b.fonte === 'expedicao').length, 2)
  assert.ok(m.sb.tabelas.baus.some((b) => b.chave === chaveBauExpedicao('2026-11-15', 'king')))
  // a mesma concessão de novo (idempotente): devolve o que já foi, sem somar
  const reg = criarRegistro(m.sb)
  const xpAntes = m.sb.tabelas.perfis.map((x) => x.xp)
  const de2 = await reg.concederExpedicao(partidaId, { chefe: 'king', lutas: 3 })
  assert.ok(de2.every((l) => l.repetida))
  assert.deepEqual(m.sb.tabelas.perfis.map((x) => x.xp), xpAntes)
  assert.equal(m.sb.tabelas.expedicoes.length, 2)
})

test('o baú: no máximo 1 por dia por chefão; o verso: só na 1ª vez contra cada chefão', async () => {
  const m = montar(['ana', 'beto'])
  const { ps, host, partidaId } = await sala(m, ['ana', 'beto'])
  m.relogio.andar(600_000)
  for (const p of ps) relatar(p, partidaId, true, completa('queen'))
  await esperar()
  // de novo contra a Queen no mesmo dia: sem baú, sem verso novo
  const outra = await novaPartida(host)
  m.relogio.andar(600_000)
  for (const p of ps) relatar(p, outra, true, completa('queen'))
  await esperar()
  const r = ps[0].ultima('recompensa')
  assert.equal(r.partidaId, outra)
  assert.equal(r.expedicao.bau, false)
  assert.equal(r.expedicao.bauHoje, true)
  assert.equal(r.expedicao.cosmeticoNovo, false)
  assert.equal(r.expedicao.cosmetico, 'verso.exp_sinal', 'o verso continua sendo o deste chefão (já é seu)')
  assert.equal(m.sb.tabelas.baus.filter((b) => b.fonte === 'expedicao' && b.user_id === 'u-ana').length, 1)
  assert.equal(m.sb.tabelas.inventario.filter((i) => i.user_id === 'u-ana' && i.item_id === 'verso.exp_sinal').length, 1)
  // outro chefão no mesmo dia: baú de novo (outra chave) e o verso dele
  const terceira = await novaPartida(host)
  m.relogio.andar(600_000)
  for (const p of ps) relatar(p, terceira, true, completa('coronel'))
  await esperar()
  assert.equal(ps[0].ultima('recompensa').expedicao.bau, true)
  assert.equal(ps[0].ultima('recompensa').expedicao.cosmetico, 'verso.exp_reciclador')
  assert.equal(m.sb.tabelas.baus.filter((b) => b.fonte === 'expedicao' && b.user_id === 'u-ana').length, 2)
  // no dia seguinte, a Queen dá baú de novo (mas o verso não volta)
  m.relogio.andar(24 * 3600_000)
  const quarta = await novaPartida(host)
  m.relogio.andar(600_000)
  for (const p of ps) relatar(p, quarta, true, completa('queen'))
  await esperar()
  assert.equal(ps[0].ultima('recompensa').expedicao.bau, true)
  assert.equal(ps[0].ultima('recompensa').expedicao.cosmeticoNovo, false)
})

test('azar no sorteio: sem baú (o XP e o verso continuam); o banco recusa baú de expedição não completada', async () => {
  const m = montar(['ana', 'beto'], { sorte: () => false })
  const { ps, partidaId } = await sala(m, ['ana', 'beto'])
  m.relogio.andar(600_000)
  for (const p of ps) relatar(p, partidaId, true, completa('jevil'))
  await esperar()
  const r = ps[0].ultima('recompensa')
  assert.equal(r.expedicao.bau, false)
  assert.equal(r.expedicao.cosmeticoNovo, true)
  assert.equal(m.sb.tabelas.baus.filter((b) => b.fonte === 'expedicao').length, 0)
  const reg = criarRegistro(m.sb)
  await assert.rejects(() => reg.concederBau('u-ana', 'expedicao', '2026-11-15:king'), /expedição não completada/)
  const ok = await reg.concederBau('u-ana', 'expedicao', '2026-11-15:jevil')
  assert.equal(ok.novo, true)
  assert.equal((await reg.concederBau('u-ana', 'expedicao', '2026-11-15:jevil')).novo, false)
})

test('caiu no tenente: XP só da luta vencida, sem bônus, sem baú e sem verso; teto de XP do dia', async () => {
  const m = montar(['ana', 'beto'])
  const { ps, host, partidaId } = await sala(m, ['ana', 'beto'])
  m.relogio.andar(600_000)
  for (const p of ps) relatar(p, partidaId, false, { chefe: 'king', lutas: 1 })
  await esperar()
  const r = ps[0].ultima('recompensa')
  assert.equal(r.motivo, 'derrota')
  assert.deepEqual([r.expedicao.xp, r.expedicao.completa, r.expedicao.bau, r.expedicao.cosmetico], [XP_EXPEDICAO.porLuta, false, false, null])
  // várias completas no dia: o XP a mais para no teto
  let soma = r.expedicao.xp
  for (let k = 0; k < 4; k++) {
    const id = await novaPartida(host)
    m.relogio.andar(600_000)
    for (const p of ps) relatar(p, id, true, completa(CHEFOES[k]))
    await esperar()
    soma += ps[0].ultima('recompensa').expedicao.xp
  }
  assert.equal(soma, XP_EXPEDICAO.tetoDia)
})

test('sem expedição: relatos que discordam, sem expedição, curta ou convidado não ganham nada a mais', async () => {
  const m = montar(['ana'])
  const { ps, host, partidaId } = await sala(m, ['ana', 'beto'])
  m.relogio.andar(600_000)
  relatar(ps[0], partidaId, true, completa('king'))
  relatar(ps[1], partidaId, true, completa('queen'))
  await esperar()
  assert.equal(ps[0].ultima('recompensa').expedicao, undefined)
  assert.ok(ps[0].ultima('recompensa').xpGanho > 0, 'o XP de sempre continua')
  // curta (90 s para 3 lutas)
  const curta = await novaPartida(host)
  m.relogio.andar(90_000)
  for (const p of ps) relatar(p, curta, true, completa('king'))
  await esperar()
  assert.equal(ps[0].ultima('recompensa').partidaId, curta)
  assert.equal(ps[0].ultima('recompensa').expedicao, undefined)
  assert.equal(m.sb.tabelas.expedicoes.length, 0)
  // o convidado (beto, sem conta) nunca ganha
  assert.equal(ps[1].ultima('recompensa')?.expedicao, undefined)
})

test('3 e 4 jogadores (coop4): a mesma regra, para todas as contas', async () => {
  const m = montar(['ana', 'beto', 'caio'])
  const { ps, partidaId } = await sala(m, ['ana', 'beto', 'caio'])
  m.relogio.andar(600_000)
  for (const p of ps) relatar(p, partidaId, true, completa('jevil'))
  await esperar()
  for (const p of ps) assert.equal(p.ultima('recompensa').expedicao.cosmetico, 'verso.exp_dado')
  assert.equal(m.sb.tabelas.expedicoes.length, 3)
})

test('catálogo: os versos exclusivos (JS = 0017 + 0018), fora do baú, com desenho e a fonte de baú nova', () => {
  // (0018: + os versos dos bosses semanais)
  const sql = ['0017_expedicao', '0018_expedicao_semanal'].map((n) => readFileSync(new URL(`../../supabase/migrations/${n}.sql`, import.meta.url), 'utf8')).join('\n')
  const doSql = [...sql.matchAll(/^\s*\('(verso\.exp_[a-z]+)', 'verso', '([^']+)', public\.nivel_exclusivo\(\), false, false, 'lendario', false, '([a-z]+)'\)/gm)].map((x) => `${x[1]}:${x[2]}:${x[3]}`).sort()
  assert.deepEqual(doSql, ITENS_EXPEDICAO.map((i) => `${i.id}:${i.nome}:${i.expedicao}`).sort())
  for (const c of [...CHEFOES, ...SEMANAIS_EXPEDICAO]) {
    const item = cosmeticoDaExpedicao(c)
    assert.ok(item, c)
    assert.match(sql, new RegExp(`when '${c}' then '${item.id.replace('.', '\\.')}'`))
    assert.equal(arteDoVerso(item.id), item.registro)
    assert.equal(itemDoCatalogo(item.id)?.nome, item.nome)
    assert.ok(!ITENS_BAU.some((i) => i.id === item.id) && !Object.values(POOL_BAU).flat().includes(item.id), 'não sai do baú')
  }
  assert.equal(FONTES_BAU.expedicao.chave('2026-11-15:king'), chaveBauExpedicao('2026-11-15', 'king'))
  // as constantes do banco = as do JS
  assert.match(sql, new RegExp(`expedicao_xp_luta\\(\\) returns integer\\s+language sql immutable set search_path = '' as \\$\\$ select ${XP_EXPEDICAO.porLuta} \\$\\$`))
  assert.match(sql, new RegExp(`expedicao_xp_completa\\(\\) returns integer\\s+language sql immutable set search_path = '' as \\$\\$ select ${XP_EXPEDICAO.completa} \\$\\$`))
  assert.match(sql, new RegExp(`expedicao_xp_teto_dia\\(\\) returns integer\\s+language sql immutable set search_path = '' as \\$\\$ select ${XP_EXPEDICAO.tetoDia} \\$\\$`))
  assert.match(sql, new RegExp(`expedicao_duracao_luta_s\\(\\) returns integer\\s+language sql immutable set search_path = '' as \\$\\$ select ${DURACAO_MINIMA_LUTA_S} \\$\\$`))
  // só o servidor concede (SECURITY DEFINER, revogada de anon/authenticated); RLS ligado
  assert.match(sql, /conceder_expedicao\(p_partida uuid, p_chefe text, p_lutas integer\)[\s\S]*?security definer/)
  assert.match(sql, /revoke all on function public\.conceder_expedicao\(uuid, text, integer\) from public, anon, authenticated/)
  assert.match(sql, /alter table public\.expedicoes enable row level security/)
  assert.match(sql, /alter table public\.expedicoes_chefes enable row level security/)
})
