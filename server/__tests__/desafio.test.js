// O DESAFIO DIÁRIO no servidor (server/campanha.js pelo lobby de server/lan.js, com o Supabase falso) e as
// CONQUISTAS/MAESTRIA que ele dispara (server/conquistas.js): o desafio do dia pelo relógio do servidor,
// convidado joga sem nada, a recompensa principal UMA vez (repetição, reconexão, em paralelo), o recorde,
// a virada do dia, o cosmético da semana, os recordes dos amigos e as conquistas no fim.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, PROTOCOLO } from '../lan.js'
import { criarRegistro } from '../partidas.js'
import { criarConquistas } from '../conquistas.js'
import { criarSupabaseFalso } from '../supabase/fake.js'
import { desviarNoQuadro } from '../../src/game/campanha/__tests__/apoioQuadro.js'
import { desafioDoDia, diaDoDesafio, cosmeticoDaSemana, XP_DESAFIO, DIAS_COSMETICO_SEMANA, VERSAO_DESAFIO } from '../../src/lib/desafio.js'
import { MAESTRIA_TETO_DIA } from '../../src/lib/conquistas.js'

// quarta-feira 2026-11-11, meio-dia em São Paulo (o desafio desse dia tem aliada: dá para vencer)
const INICIO = Date.UTC(2026, 10, 11, 15, 0, 0)
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
  for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r))
}

function montar(contas = ['ana'], { inicio = INICIO } = {}) {
  const relogio = relogioFalso(inicio)
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
    const p = { nome, c, recebidas, mandar: (m) => lobby.receber(c, JSON.stringify(m)), ultima: (t) => recebidas.filter((m) => m.t === t).at(-1), todas: (t) => recebidas.filter((m) => m.t === t) }
    p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: nome.toUpperCase(), ...(contas.includes(nome) && { token: `token-${nome}` }) })
    await esperar()
    return p
  }
  return { relogio, entrar, sb, lobby, logs, id }
}

const melhor = (v) => v.eu.mao.filter((x) => v.eu.jogaveis.includes(x.id) && x.naipe !== 'copas').sort((a, b) => b.custo - a.custo)[0]?.id ?? null

async function rodada(m, p, { piloto = 'bom' } = {}) {
  const corrida = p.ultima('campanhaInicio').corrida
  const v = p.ultima('campanhaRodada')?.proxima ?? p.ultima('campanhaInicio').rodada
  const antes = p.todas('campanhaEsquiva').length
  p.mandar({ t: 'campanha', acao: 'carta', corrida, carta: melhor(v) })
  await esperar()
  const e = p.todas('campanhaEsquiva')[antes]
  if (!e) return null
  let seq = 0
  let relogio = 0
  const esq = e.esquiva
  const r =
    esq && esq.jogadores[0]
      ? desviarNoQuadro(esq, {
          piloto,
          aoPedaco(pedaco, t) {
            m.relogio.andar(t - relogio)
            relogio = t
            if (pedaco.length) p.mandar({ t: 'campanha', acao: 'posicoes', corrida, rodada: e.rodada, seq: seq++, a: pedaco })
          },
        })
      : { acertos: 0 }
  m.relogio.andar(200)
  p.mandar({ t: 'campanha', acao: 'fimEsquiva', corrida, rodada: e.rodada, acertos: r.acertos })
  await esperar()
  return e
}

async function jogarDesafio(m, p, op = {}) {
  const fins = p.todas('campanhaFim').length
  p.mandar({ t: 'campanha', acao: 'comecarDesafio', dia: diaDoDesafio(m.relogio.agora()).id })
  await esperar()
  for (let i = 0; i < 40 && p.todas('campanhaFim').length === fins; i++) await rodada(m, p, op)
  return p.ultima('campanhaFim')
}

test('protocolo 17 (desafio diário e conquistas)', () => {
  assert.ok(PROTOCOLO >= 17)
})

test('o desafio do dia: o mesmo para todos, vira à meia-noite de São Paulo', () => {
  // 02:59 UTC de quarta = 23:59 de terça em São Paulo
  assert.equal(diaDoDesafio(Date.UTC(2026, 10, 11, 2, 59, 59)).id, '2026-11-10')
  assert.equal(diaDoDesafio(Date.UTC(2026, 10, 11, 3, 0, 0)).id, '2026-11-11')
  assert.equal(diaDoDesafio(Date.UTC(2026, 10, 11, 2, 59, 59)).restanteMs, 1000)
  assert.deepEqual(desafioDoDia('2026-11-11'), desafioDoDia('2026-11-11'))
  assert.notDeepEqual(desafioDoDia('2026-11-11'), desafioDoDia('2026-11-12'))
})

test('estado do dia: definição pelo relógio do servidor; convidado vê o aviso', async () => {
  const m = montar(['ana'])
  const beto = await m.entrar('beto')
  beto.mandar({ t: 'campanha', acao: 'desafio' })
  await esperar()
  const e = beto.ultima('desafioEstado')
  assert.equal(e.dia, '2026-11-11')
  assert.deepEqual(e.desafio, desafioDoDia('2026-11-11'))
  assert.equal(e.convidado, true)
  assert.equal(e.xp, XP_DESAFIO)
  assert.equal(e.cosmetico.id, cosmeticoDaSemana('2026-S46').id)
  // a campanha continua só com conta
  beto.mandar({ t: 'campanha', acao: 'comecar', mundo: 1, fase: 1 })
  await esperar()
  assert.equal(beto.ultima('campanhaErro').motivo, 'convidado')
})

test('convidado joga o desafio inteiro, mas não ganha nada nem tem recorde', async () => {
  const m = montar(['ana'])
  const beto = await m.entrar('beto')
  const fim = await jogarDesafio(m, beto)
  assert.ok(['vitoria', 'derrota'].includes(fim.resultado), JSON.stringify(fim))
  assert.equal(fim.motivo, 'convidado')
  assert.equal(fim.xpGanho, 0)
  assert.ok(fim.desafio.pontos > 0)
  assert.equal(m.sb.tabelas.desafio_corridas.length, 0)
  assert.equal(m.sb.tabelas.desafio_recordes.length, 0)
})

test('com conta: vence, ganha o XP do dia uma vez; repetir sobe o recorde sem XP; conquistas e maestria chegam', async () => {
  const m = montar(['ana'])
  const ana = await m.entrar('ana')
  const fim = await jogarDesafio(m, ana)
  assert.equal(fim.resultado, 'vitoria', JSON.stringify(fim))
  assert.equal(fim.xpGanho, XP_DESAFIO)
  assert.equal(fim.motivo, 'desafio')
  assert.equal(fim.desafio.primeiraHoje, true)
  assert.equal(fim.desafio.novoRecorde, true)
  assert.equal(fim.desafio.recorde, fim.desafio.pontos)
  assert.equal(m.sb.tabelas.perfis[0].xp, XP_DESAFIO)
  // conquistas: a primeira vitória e o primeiro desafio; a maestria do personagem do dia
  const c = ana.ultima('conquistas')
  assert.ok(c.novas.includes('bom_dia') && c.novas.includes('primeira_vitoria'), JSON.stringify(c))
  assert.equal(c.maestria.personagem, desafioDoDia('2026-11-11').personagem)
  assert.equal(m.sb.tabelas.maestria[0].pontos, 3)
  // de novo (repetição livre): nenhum XP, conquista não repete
  const n = ana.todas('conquistas').length
  const fim2 = await jogarDesafio(m, ana, { piloto: 'medio' })
  assert.equal(fim2.xpGanho, 0)
  assert.equal(m.sb.tabelas.perfis[0].xp, XP_DESAFIO)
  assert.equal(m.sb.tabelas.desafio_concluidos.length, 1)
  assert.equal(m.sb.tabelas.desafio_recordes[0].pontos, Math.max(fim.desafio.pontos, fim2.desafio.pontos))
  const novas = ana.todas('conquistas').slice(n).flatMap((x) => x.novas)
  assert.ok(!novas.includes('bom_dia'))
  // o estado mostra o recorde e o dia concluído
  ana.mandar({ t: 'campanha', acao: 'desafio' })
  await esperar()
  const e = ana.ultima('desafioEstado')
  assert.equal(e.concluido, true)
  assert.equal(e.recorde.pontos, m.sb.tabelas.desafio_recordes[0].pontos)
  assert.equal(e.diasSemana, 1)
  // a Coleção: as conquistas e a maestria da conta
  ana.mandar({ t: 'conquistas' })
  await esperar()
  const ce = ana.ultima('conquistasEstado')
  assert.ok(ce.conquistas.some((x) => x.id === 'bom_dia'))
  assert.equal(ce.maestria[0].personagem, desafioDoDia('2026-11-11').personagem)
})

test('a concessão é idempotente: a mesma corrida de novo e corridas em paralelo dão o XP uma vez', async () => {
  const m = montar(['ana'])
  const reg = criarRegistro(m.sb)
  const u = m.id('ana')
  const dia = '2026-11-11'
  const c = (n, resultado = 'vitoria', pontos = 1000) => reg.concederDesafio({ corrida: `00000000-0000-4000-8000-0000000000${n}`, usuario: u, dia, versao: VERSAO_DESAFIO, resultado, pontos, rodadas: 6, acertos: 1, duracaoS: 100 })
  const [a, b, d] = await Promise.all([c(11), c(12, 'vitoria', 1500), c(13)])
  assert.equal([a, b, d].filter((x) => x.xpGanho === XP_DESAFIO).length, 1)
  const de2 = await c(11)
  assert.equal(de2.xpGanho, a.xpGanho)
  assert.equal(m.sb.tabelas.perfis[0].xp, XP_DESAFIO)
  assert.equal(m.sb.tabelas.desafio_recordes[0].pontos, 1500)
  // dia fora da janela (anteontem) e versão errada: o banco recusa
  await assert.rejects(reg.concederDesafio({ corrida: '00000000-0000-4000-8000-000000000099', usuario: u, dia: '2026-11-09', versao: VERSAO_DESAFIO, resultado: 'vitoria', pontos: 1 }), /dia inválido/)
  await assert.rejects(reg.concederDesafio({ corrida: '00000000-0000-4000-8000-000000000098', usuario: u, dia, versao: 99, resultado: 'vitoria', pontos: 1 }), /versão inválida/)
  // eventos de conquista repetidos (reconexão): a maestria não soma de novo; o teto do dia segura
  const cq = criarConquistas({ registro: reg })
  const r1 = await cq.evento(u, 'partida:aaaaaaaa', { tipo: 'partida', modo: 'pvp', resultado: 'vitoria', personagem: 'susie' })
  const r2 = await cq.evento(u, 'partida:aaaaaaaa', { tipo: 'partida', modo: 'pvp', resultado: 'vitoria', personagem: 'susie' })
  assert.deepEqual(r1.novas, ['primeira_vitoria'])
  assert.deepEqual(r2.novas, [])
  for (let i = 0; i < 20; i++) await cq.evento(u, `partida:bbbbbb${String(i).padStart(2, '0')}`, { tipo: 'partida', modo: 'pvp', resultado: 'vitoria', personagem: 'susie' })
  assert.equal(m.sb.tabelas.maestria.find((x) => x.personagem === 'susie').pontos, MAESTRIA_TETO_DIA)
  // amanhã volta a subir
  m.relogio.andar(86_400_000)
  await cq.evento(u, 'partida:cccccccc', { tipo: 'partida', modo: 'pvp', resultado: 'derrota', personagem: 'susie' })
  assert.equal(m.sb.tabelas.maestria.find((x) => x.personagem === 'susie').pontos, MAESTRIA_TETO_DIA + 1)
})

test('o dia virou com a tela aberta: o servidor recusa o desafio velho e manda o novo', async () => {
  const m = montar(['ana'], { inicio: Date.UTC(2026, 10, 11, 2, 59, 0) }) // 23:59 de terça em São Paulo
  const ana = await m.entrar('ana')
  ana.mandar({ t: 'campanha', acao: 'desafio' })
  await esperar()
  assert.equal(ana.ultima('desafioEstado').dia, '2026-11-10')
  m.relogio.andar(2 * 60_000)
  ana.mandar({ t: 'campanha', acao: 'comecarDesafio', dia: '2026-11-10' })
  await esperar()
  assert.equal(ana.ultima('campanhaErro').motivo, 'virou')
  assert.equal(ana.ultima('desafioEstado').dia, '2026-11-11')
  assert.equal(m.lobby.campanha.corridas.size, 0)
})

test('o cosmético da semana: vencer em DIAS_COSMETICO_SEMANA dias da semana (sem sequência), uma vez', async () => {
  const m = montar(['ana'], { inicio: Date.UTC(2026, 10, 9, 15, 0, 0) }) // segunda
  const reg = criarRegistro(m.sb)
  const u = m.id('ana')
  const semana = diaDoDesafio(m.relogio.agora()).semana
  const item = cosmeticoDaSemana(semana)
  let ultimo
  // segunda, quarta (pulou a terça: sem punição), quinta, domingo
  for (const [i, pulo] of [
    [1, 0],
    [2, 2],
    [3, 1],
    [4, 3],
  ]) {
    m.relogio.andar(pulo * 86_400_000)
    ultimo = await reg.concederDesafio({ corrida: `00000000-0000-4000-8000-00000000010${i}`, usuario: u, dia: diaDoDesafio(m.relogio.agora()).id, versao: VERSAO_DESAFIO, resultado: 'vitoria', pontos: 900, item })
    if (i < DIAS_COSMETICO_SEMANA) assert.equal(ultimo.cosmeticoNovo, null)
  }
  assert.equal(ultimo.diasSemana, DIAS_COSMETICO_SEMANA)
  assert.equal(ultimo.cosmeticoNovo, item.id)
  assert.ok(ultimo.itensNovos.includes(item.id))
  assert.ok(m.sb.tabelas.inventario.some((x) => x.item_id === item.id))
  // a semana seguinte começa do zero
  m.relogio.andar(86_400_000)
  const seg = await reg.concederDesafio({ corrida: '00000000-0000-4000-8000-000000000200', usuario: u, dia: diaDoDesafio(m.relogio.agora()).id, versao: VERSAO_DESAFIO, resultado: 'vitoria', pontos: 900, item: cosmeticoDaSemana(diaDoDesafio(m.relogio.agora()).semana) })
  assert.equal(seg.diasSemana, 1)
})

test('recordes dos amigos de hoje: só amizade, sem bloqueado', async () => {
  const m = montar(['ana', 'beto', 'cris', 'davi'])
  const reg = criarRegistro(m.sb)
  const [ana, beto, cris, davi] = ['ana', 'beto', 'cris', 'davi'].map(m.id)
  const dia = '2026-11-11'
  let k = 0
  const vence = (u, pontos) => reg.concederDesafio({ corrida: `00000000-0000-4000-8000-0000000003${String(k++).padStart(2, '0')}`, usuario: u, dia, versao: VERSAO_DESAFIO, resultado: 'derrota', pontos })
  await vence(beto, 800)
  await vence(cris, 1200)
  await vence(davi, 5000) // não é amigo
  m.sb.tabelas.amizades.push({ a: ana, b: beto }, { a: ana, b: cris })
  const p = await m.entrar('ana')
  p.mandar({ t: 'campanha', acao: 'desafio' })
  await esperar()
  assert.deepEqual(p.ultima('desafioEstado').amigos.map((x) => [x.nome, x.pontos]), [['CRIS', 1200], ['BETO', 800]])
  m.sb.tabelas.bloqueios.push({ quem: cris, bloqueado: ana })
  p.c.pedidoConquistas = 0
  p.mandar({ t: 'campanha', acao: 'desafio' })
  await esperar()
  assert.deepEqual(p.ultima('desafioEstado').amigos.map((x) => x.nome), ['BETO'])
})

test('caiu no meio do desafio: abandono, sem recorde e sem XP', async () => {
  const m = montar(['ana'])
  const ana = await m.entrar('ana')
  ana.mandar({ t: 'campanha', acao: 'comecarDesafio' })
  await esperar()
  await rodada(m, ana)
  m.lobby.desconectar(ana.c)
  await esperar()
  assert.equal(m.lobby.campanha.corridas.size, 0)
  assert.equal(m.sb.tabelas.desafio_corridas[0].resultado, 'abandono')
  assert.equal(m.sb.tabelas.desafio_recordes.length, 0)
  assert.equal(m.sb.tabelas.perfis[0].xp, 0)
})
