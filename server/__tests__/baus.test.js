// node --test server/__tests__/baus.test.js
// BAÚS no servidor (server/baus.js) com o banco falso (server/supabase/fake.js, o espelho da 0015): cada
// fonte concede UMA vez (repetida e em paralelo), o banco confere a fonte, o sorteio vem daqui (crypto) e as
// regras (pena, duplicado vira XP, teto do dia, nível novo dá baú) ficam no banco; equipar só o que tem; o
// lobby repassa os cosméticos de cada membro e abre os baús com limite; uma partida de verdade dá o baú do dia.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarBaus, sortearPadrao, msgBauGanho } from '../baus.js'
import { criarRegistro, criarPartidas } from '../partidas.js'
import { criarSupabaseFalso } from '../supabase/fake.js'
import { criarLobby, PROTOCOLO } from '../lan.js'
import { criarContasFalsas, BAUS_TESTE } from '../contasFalsas.js'
import { ESCALA, SORTEIO_TAMANHO, PITY, XP_DUPLICADO, BAU_XP_TETO_DIA, POOL_BAU, rolarBau } from '../../src/lib/cosmeticos.js'
import { diaDoDesafio } from '../../src/lib/desafio.js'
import { xpTotalDoNivel } from '../../src/lib/progresso.js'

const A = 'aaaaaaaa-0000-4000-8000-00000000000a'
const B = 'bbbbbbbb-0000-4000-8000-00000000000b'
const T0 = Date.UTC(2026, 10, 12, 15)

function montar({ sortear = sortearPadrao, perfis = [{ id: A, nivel: 1, xp: 0 }, { id: B, nivel: 1, xp: 0 }] } = {}) {
  let agora = T0
  const sb = criarSupabaseFalso({ perfis, agora: () => agora })
  const registro = criarRegistro(sb)
  const logs = []
  const baus = criarBaus({ registro, log: (l) => logs.push(l), sortear })
  return { sb, registro, baus, logs, avancar: (ms) => (agora += ms) }
}

const ruim = () => Array(SORTEIO_TAMANHO).fill(0) // tudo comum, 1 recompensa, o 1º item
const fechados = (sb, u = A) => sb.tabelas.baus.filter((b) => b.user_id === u && b.aberto_em == null).length

test('o sorteio padrão é do crypto: 10 inteiros em [0, ESCALA)', () => {
  const u = sortearPadrao()
  assert.equal(u.length, SORTEIO_TAMANHO)
  assert.ok(u.every((x) => Number.isInteger(x) && x >= 0 && x < ESCALA))
})

test('cada fonte dá UM baú: repetida, em paralelo e o banco conferindo a fonte', async () => {
  const { sb, baus, logs } = montar()
  // baú do dia: uma vez por dia, mesmo em paralelo
  const r = await Promise.all([1, 2, 3, 4].map(() => baus.conceder(A, 'dia', null)))
  assert.equal(r.filter((x) => x.novo).length, 1)
  assert.equal(fechados(sb), 1)
  assert.equal(sb.tabelas.baus[0].chave, `dia:${diaDoDesafio(T0).id}`)
  // nível: só um nível que a conta já alcançou (e >= 2)
  assert.equal(await baus.conceder(A, 'nivel', 3), null, 'nível 3 com a conta no 1: o banco recusa')
  assert.match(logs.at(-1), /ainda não chegou/)
  sb.tabelas.perfis[0].nivel = 4
  const niveis = await baus.depoisDoXp(A, { nivelAntes: 1, nivelDepois: 4 })
  assert.deepEqual(niveis.map((x) => x.fonte), ['nivel', 'nivel', 'nivel'])
  assert.deepEqual((await baus.depoisDoXp(A, { nivelAntes: 1, nivelDepois: 4, jogou: true })).length, 0, 'replay não dá de novo')
  // desafio, semanal e conquista: só com a prova no banco
  assert.equal(await baus.conceder(A, 'desafio', '2026-11-12'), null)
  sb.tabelas.desafio_concluidos.push({ user_id: A, dia: '2026-11-12', semana: '2026-S46' })
  assert.equal((await baus.conceder(A, 'desafio', '2026-11-12')).novo, true)
  assert.equal(await baus.conceder(A, 'semanal', '2026-S46'), null)
  sb.tabelas.trofeus_semanais.push({ user_id: A, semana: '2026-S46', item_id: 'titulo.semanal_2026_46' })
  assert.equal((await baus.conceder(A, 'semanal', '2026-S46')).novo, true)
  sb.tabelas.conquistas.push({ user_id: A, conquista: 'primeira_vitoria' }, { user_id: A, conquista: 'intocavel' })
  const cq = await baus.depoisDoXp(A, { conquistas: ['primeira_vitoria', 'intocavel'] })
  assert.deepEqual(cq.map((x) => x.fonte), ['conquista'], 'só as conquistas da lista dão baú')
  assert.equal(await baus.conceder(A, 'compra', 'x'), null, 'não existe fonte de compra')
  assert.equal(fechados(sb), 1 + 3 + 1 + 1 + 1)
  assert.deepEqual(msgBauGanho(cq), { t: 'bauGanho', fontes: ['conquista'], fechados: 7 })
  assert.equal(msgBauGanho([]), null)
  // sem banco: nada, sem erro
  assert.deepEqual(await criarBaus({ registro: null }).depoisDoXp(A, { jogou: true }), [])
})

test('abrir: sorteia aqui, o banco aplica; o mesmo baú não abre duas vezes', async () => {
  const { sb, baus, registro } = montar({ sortear: ruim })
  await baus.conceder(A, 'dia', null)
  const r = await baus.abrir(A)
  assert.equal(r.aberto, true)
  assert.deepEqual(r.recompensas, [{ tipo: 'item', id: POOL_BAU.comum[0], raridade: 'comum' }])
  assert.ok(sb.tabelas.inventario.some((i) => i.user_id === A && i.item_id === POOL_BAU.comum[0]))
  assert.equal(r.fechados, 0)
  assert.equal((await baus.abrir(A)).aberto, false, 'sem baú fechado')
  // o mesmo baú pelo id: devolve o mesmo resultado, sem somar nada
  const de_novo = await registro.abrirBau(A, r.bauId, ruim())
  assert.equal(de_novo.repetido, true)
  assert.deepEqual(de_novo.recompensas, r.recompensas)
  assert.equal(sb.tabelas.baus_contas[0].abertos, 1)
  // baú de outra conta: não abre
  await baus.conceder(B, 'dia', null)
  const idB = sb.tabelas.baus.find((b) => b.user_id === B).id
  await assert.rejects(registro.abrirBau(A, idB, ruim()), /baú não existe/)
})

test('duplicado vira XP; pena garante épico no 10º; teto de XP do dia; nível novo dá baú', async () => {
  const { sb, baus, avancar } = montar({ sortear: ruim })
  sb.tabelas.perfis[0].nivel = 50
  sb.tabelas.perfis[0].xp = xpTotalDoNivel(50)
  for (let n = 2; n <= 50; n++) await baus.conceder(A, 'nivel', n)
  const res = []
  for (let i = 0; i < 20; i++) res.push(await baus.abrir(A))
  // o 1º é o item; do 2º em diante o mesmo comum é duplicado (+15 XP); o 10º e o 20º são épicos (pena)
  assert.equal(res[0].recompensas[0].tipo, 'item')
  assert.deepEqual(res[1].recompensas[0], { tipo: 'duplicado', id: POOL_BAU.comum[0], raridade: 'comum', xp: XP_DUPLICADO.comum })
  assert.equal(res[9].recompensas[0].raridade, 'epico')
  assert.equal(res[9].pity, true)
  assert.equal(res[19].recompensas[0].raridade, 'epico')
  assert.equal(res[19].recompensas[0].tipo, 'duplicado', 'o mesmo épico de novo')
  assert.equal(res[10].desdeEpico, 1)
  const xpHoje = res.reduce((s, r) => s + r.xpGanho, 0)
  assert.equal(xpHoje, 17 * XP_DUPLICADO.comum + XP_DUPLICADO.epico)
  // o teto do dia: muitos duplicados seguidos param de dar XP no teto
  for (let i = 0; i < 20; i++) res.push(await baus.abrir(A))
  const total = res.reduce((s, r) => s + r.xpGanho, 0)
  assert.ok(total <= BAU_XP_TETO_DIA, `${total}`)
  assert.ok(res.some((r) => r.teto))
  // no dia seguinte volta; e o XP que sobe de nível já cria o baú do nível novo
  avancar(86_400_000)
  sb.tabelas.perfis[0].xp = xpTotalDoNivel(51) - 5
  const antes = sb.tabelas.baus.filter((b) => b.user_id === A).length
  await baus.conceder(A, 'dia', null)
  const r = await baus.abrir(A)
  assert.ok(r.xpGanho > 0)
  assert.equal(r.nivelDepois, 51)
  assert.ok(sb.tabelas.baus.some((b) => b.user_id === A && b.chave === 'nivel:51'))
  assert.equal(sb.tabelas.baus.filter((b) => b.user_id === A).length, antes + 2)
})

test('o banco falso aplica as mesmas regras do rolarBau (o espelho)', async () => {
  const sequencia = Array.from({ length: 40 }, (_, i) => Array.from({ length: SORTEIO_TAMANHO }, (_, k) => (i * 7919 + k * 104_729) % ESCALA))
  let i = 0
  const { sb, baus } = montar({ sortear: () => sequencia[i++] })
  for (let n = 0; n < 40; n++) sb.tabelas.baus.push({ id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, user_id: A, fonte: 'dia', chave: `dia:t${n}`, criado_em: T0 + n, ordem: n, aberto_em: null, xp: 0, resultado: null })
  let desde = 0
  const tem = new Set()
  for (let n = 0; n < 40; n++) {
    const esperado = rolarBau(sequencia[n], { desdeEpico: desde, possui: (id) => tem.has(id) })
    const r = await baus.abrir(A)
    assert.deepEqual(r.recompensas, esperado.recompensas, `baú ${n}`)
    for (const x of esperado.recompensas) if (x.tipo === 'item') tem.add(x.id)
    desde = esperado.desdeEpico
  }
})

test('abrir em PARALELO abre baús diferentes (nenhum duas vezes)', async () => {
  const { sb, baus } = montar()
  sb.tabelas.perfis[0].nivel = 6
  for (let n = 2; n <= 6; n++) await baus.conceder(A, 'nivel', n)
  const r = await Promise.all([1, 2, 3, 4, 5, 6, 7].map(() => baus.abrir(A)))
  const abertos = r.filter((x) => x.aberto)
  assert.equal(abertos.length, 5)
  assert.equal(new Set(abertos.map((x) => x.bauId)).size, 5)
  assert.equal(sb.tabelas.baus_contas[0].abertos, 5)
})

test('equipar: só o que a conta tem, só no tipo certo; null tira', async () => {
  const { sb, registro } = montar()
  await assert.rejects(registro.equiparConta(A, 'som', 'som.latido'), /ainda não tem/)
  sb.tabelas.inventario.push({ user_id: A, item_id: 'som.latido' }, { user_id: A, item_id: 'moldura.anim_fogo' })
  assert.equal((await registro.equiparConta(A, 'som', 'som.latido')).som_equipado, 'som.latido')
  await assert.rejects(registro.equiparConta(A, 'efeito', 'som.latido'), /item inválido/)
  await assert.rejects(registro.equiparConta(A, 'arma', 'som.latido'), /tipo de item inválido/)
  assert.equal((await registro.equiparConta(A, 'moldura', 'moldura.anim_fogo')).moldura_equipada, 'moldura.anim_fogo')
  assert.equal((await registro.equiparConta(A, 'som', null)).som_equipado, null)
  await assert.rejects(registro.equiparConta(B, 'som', 'som.latido'), /ainda não tem/, 'o inventário é de cada um')
})

// ---------- o lobby ----------

function lobbyFalso() {
  let relogio = T0
  const contas = criarContasFalsas({ agora: () => relogio })
  const lobby = criarLobby({ locais: () => [{ ip: '192.168.0.10', mascara: '255.255.255.0' }], autenticar: contas.autenticar, registro: contas.registro, agora: () => relogio })
  const conectar = (token) => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)) }
    const c = lobby.conectar(ws, '192.168.0.2')
    const mandar = (m) => lobby.receber(c, JSON.stringify(m))
    mandar({ t: 'ola', protocolo: PROTOCOLO, nome: 'X', ...(token && { token }) })
    return { c, recebidas, mandar, ultima: (t) => recebidas.filter((m) => m.t === t).at(-1) }
  }
  return { lobby, contas, conectar, avancar: (ms) => (relogio += ms) }
}
const esperar = async (n = 6) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r))
}

test('lobby: estado, abrir (com limite), equipar e os cosméticos na sala (protocolo 18)', async () => {
  assert.equal(PROTOCOLO, 18)
  const { conectar, avancar } = lobbyFalso()
  const ana = conectar(`falsa:${A}:ANA`)
  const beto = conectar(`falsa:${B}:BETO`)
  const convidado = conectar(null)
  await esperar()
  ana.mandar({ t: 'baus', acao: 'estado' })
  convidado.mandar({ t: 'baus', acao: 'estado' })
  convidado.mandar({ t: 'baus', acao: 'abrir' })
  await esperar()
  assert.equal(ana.ultima('bausEstado').fechados, BAUS_TESTE)
  assert.equal(ana.ultima('bausEstado').pity, PITY)
  assert.equal(convidado.ultima('bausEstado').convidado, true)
  assert.equal(convidado.ultima('bausErro').motivo, 'convidado')
  ana.mandar({ t: 'baus', acao: 'abrir' })
  ana.mandar({ t: 'baus', acao: 'abrir' }) // logo em seguida: limite
  await esperar()
  assert.equal(ana.recebidas.filter((m) => m.t === 'bauAberto').length, 1)
  assert.equal(ana.ultima('bausErro').motivo, 'calma')
  const aberto = ana.ultima('bauAberto')
  assert.equal(aberto.fechados, BAUS_TESTE - 1 + (aberto.nivelDepois - aberto.nivelAntes), 'o XP do baú pode subir de nível (+1 baú)')
  assert.ok(aberto.recompensas.length >= 1 && aberto.recompensas.length <= 3)
  // equipar pelo lobby um item que ganhou; um que não tem é recusado
  const item = aberto.recompensas.find((r) => r.tipo === 'item')
  ana.mandar({ t: 'criar' })
  const sala = ana.ultima('sala').sala
  beto.mandar({ t: 'entrar', id: sala.id, codigo: sala.codigo })
  avancar(1000)
  ana.mandar({ t: 'baus', acao: 'equipar', tipo: 'som', item: 'som.cabra' })
  await esperar()
  assert.equal(ana.ultima('equipado').ok, false)
  if (item) {
    const tipo = item.id.split('.')[0]
    avancar(1000)
    ana.mandar({ t: 'baus', acao: 'equipar', tipo, item: item.id })
    await esperar()
    assert.equal(ana.ultima('equipado').ok, true, JSON.stringify(ana.ultima('equipado')))
    // o OUTRO membro da sala vê o cosmético da Ana (se for de um slot que viaja)
    const membroAna = beto.ultima('sala')?.sala.membros.find((m) => m.nome === 'ANA')
    if (['som', 'efeito', 'lancamento'].includes(tipo) || item.id.startsWith('moldura.anim_')) assert.equal(membroAna.conta.cosmeticos[tipo], item.id)
  }
})

test('partida de verdade: o baú do dia chega depois do XP (e o aviso bauGanho)', async () => {
  const sb = criarSupabaseFalso({ perfis: [{ id: A, nivel: 1, xp: 0 }, { id: B, nivel: 1, xp: 0 }], agora: () => T0 })
  const registro = criarRegistro(sb)
  const entregues = []
  let t = T0
  const partidas = criarPartidas({ registro, agora: () => t, agendar: () => () => {}, entregar: (x, msg) => entregues.push([x.usuario, msg]), baus: criarBaus({ registro }) })
  const cliente = (id, usuario) => ({ id, usuario, nome: id })
  const ana = cliente('c1', A)
  const beto = cliente('c2', B)
  const sala = { id: 's1', modo: 'pvp', casual: false, membros: new Set(['c1', 'c2']) }
  partidas.iniciar(sala, [ana, beto])
  await esperar()
  t += 120_000
  partidas.relatar(ana, { partidaId: sala.partidaId, vencedorLado: 0, rodadas: 4, duracao: 120 })
  partidas.relatar(beto, { partidaId: sala.partidaId, vencedorLado: 0, rodadas: 4, duracao: 120 })
  await esperar(20)
  assert.equal(sb.tabelas.baus.filter((b) => b.fonte === 'dia').length, 2, 'um baú do dia para cada um')
  assert.ok(entregues.some(([u, m]) => u === A && m.t === 'bauGanho' && m.fontes.includes('dia')))
})
