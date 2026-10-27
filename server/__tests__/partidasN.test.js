import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decidir, decidirN, lerRelato, criarPartidas, MODOS_PARTIDA, MODOS_COM_XP, timeDoLado } from '../partidas.js'

// Partidas de N lados (Fase 5A): a leitura dos relatos e a política "o host
// decide, conferido pela maioria". Os modos de 2 continuam com decidir() de sempre.

const T0 = 1_000_000
// participantes: [{ relato?, em?, saiu? }] na ordem dos lados (0 = host)
const partida = (modo, lados) => ({
  modo,
  criadaEm: T0,
  participantes: lados.map((l, lado) => ({ lado, time: modo === '2x2' ? timeDoLado(lado) : null, relato: l.relato ?? null, relatadoEm: l.relato ? T0 + (l.em ?? 120_000) : null, saiuEm: l.saiu != null ? T0 + l.saiu : null })),
})
const r = (x) => ({ rodadas: 5, duracao: 120, personagem: 'kris', ...x })
const res = (d) => Object.values(d.resultados)

test('os tamanhos de cada modo e os que dão XP hoje', () => {
  assert.deepEqual(MODOS_PARTIDA.pvp, { min: 2, max: 2 })
  assert.equal(MODOS_PARTIDA.coop4.max, 4)
  assert.equal(MODOS_PARTIDA['2x2'].min, 4)
  assert.deepEqual(MODOS_COM_XP, ['pvp', 'coop'])
  assert.deepEqual([0, 1, 2, 3].map(timeDoLado), [0, 1, 0, 1])
})

test('lerRelato de N: colocações completas, time vencedor, vitória do time', () => {
  const base = { partidaId: 'x', rodadas: 4, duracao: 100, personagem: 'kris' }
  assert.deepEqual(lerRelato({ ...base, colocacoes: [2, 0, 1] }, 'ffa', 3).colocacoes, [2, 0, 1])
  assert.equal(lerRelato({ ...base, colocacoes: [2, 0] }, 'ffa', 3), null, 'falta um lado')
  assert.equal(lerRelato({ ...base, colocacoes: [0, 0, 1] }, 'ffa', 3), null, 'repetido')
  assert.equal(lerRelato({ ...base, colocacoes: [0, 1, 3] }, 'ffa', 3), null, 'lado que não existe')
  assert.equal(lerRelato({ ...base, colocacoes: 'abc' }, 'ffa', 3), null)
  assert.equal(lerRelato({ ...base, vencedorTime: 1 }, '2x2', 4).vencedorTime, 1)
  assert.equal(lerRelato({ ...base, vencedorTime: null }, '2x2', 4).vencedorTime, null)
  assert.equal(lerRelato({ ...base, vencedorTime: 2 }, '2x2', 4), null)
  assert.equal(lerRelato({ ...base, vitoria: true }, 'coop4', 4).vitoria, true)
  assert.equal(lerRelato({ ...base }, 'coop4', 4), null)
  // os de 2 não mudaram
  assert.equal(lerRelato({ ...base, vencedorLado: 1 }, 'pvp').vencedorLado, 1)
  assert.equal(lerRelato({ ...base, vencedorLado: 2 }, 'pvp'), null)
})

test('FFA: todos concordam -> validada, 1º vence, colocação de cada um', () => {
  const c = r({ colocacoes: [2, 0, 3, 1] })
  const d = decidir(partida('ffa', [{ relato: c }, { relato: c }, { relato: c }, { relato: c }]), T0 + 200_000)
  assert.equal(d.validacao, 'validada')
  assert.equal(d.motivo, 'normal')
  assert.equal(d.vencedorLado, 2)
  assert.deepEqual(d.resultados, { 0: 'derrota', 1: 'derrota', 2: 'vitoria', 3: 'derrota' })
  assert.deepEqual(d.colocacoes, { 0: 2, 1: 4, 2: 1, 3: 3 })
  assert.equal(d.duracaoS, 120)
})

test('FFA: o host desempata (metade com ele); sem o host, vale a maioria absoluta', () => {
  const a = r({ colocacoes: [0, 1, 2, 3] })
  const b = r({ colocacoes: [1, 0, 2, 3] })
  // 2 x 2 com o host do lado de "a": vale "a"
  let d = decidirN(partida('ffa', [{ relato: a }, { relato: a }, { relato: b }, { relato: b }]), T0)
  assert.equal(d.validacao, 'validada')
  assert.equal(d.motivo, 'maioria')
  assert.equal(d.vencedorLado, 0)
  // quem discordou leva o resultado oficial (a partida valeu)
  assert.deepEqual(res(d), ['vitoria', 'derrota', 'derrota', 'derrota'])
  // o host sozinho contra 3: contestada
  d = decidirN(partida('ffa', [{ relato: a }, { relato: b }, { relato: b }, { relato: b }]), T0)
  assert.equal(d.validacao, 'contestada')
  assert.deepEqual(res(d), ['contestada', 'contestada', 'contestada', 'contestada'])
  // o host caiu e não relatou: 2 de 3 concordam -> vale
  d = decidirN(partida('ffa', [{}, { relato: b }, { relato: b }, { relato: a }]), T0)
  assert.equal(d.validacao, 'validada')
  assert.equal(d.vencedorLado, 1)
  assert.equal(d.resultados[0], 'sem_relato')
  // o host da partida pode ser outra vaga (eleição da 5A): vale o relato dele
  const eleito = partida('ffa', [{ relato: b }, { relato: a }, { relato: a }, { relato: b }])
  eleito.hostLado = 3
  assert.equal(decidirN(eleito, T0).vencedorLado, 1)
  // empate sem host: contestada
  d = decidirN(partida('ffa', [{}, { relato: b }, { relato: a }, {}]), T0)
  assert.equal(d.validacao, 'contestada')
})

test('N: um relato só é contestado, a não ser que os outros já tenham saído antes dele', () => {
  const v = r({ vitoria: true })
  let d = decidirN(partida('coop4', [{ relato: v }, {}, {}]), T0)
  assert.equal(d.validacao, 'contestada')
  assert.equal(d.motivo, 'relato_unico')
  assert.deepEqual(res(d), ['participacao', 'sem_relato', 'sem_relato'])
  // os outros dois saíram no meio (antes do relato): vale para quem ficou
  d = decidirN(partida('coop4', [{ relato: v, em: 300_000 }, { saiu: 60_000 }, { saiu: 90_000 }]), T0)
  assert.equal(d.validacao, 'validada')
  assert.equal(d.motivo, 'abandono')
  assert.deepEqual(res(d), ['vitoria', 'abandono', 'abandono'])
})

test('N: quem saiu antes do primeiro relato é abandono; os outros jogam o resultado', () => {
  const perdeu = r({ vitoria: false })
  const d = decidirN(partida('coop4', [{ relato: perdeu, em: 200_000 }, { relato: perdeu, em: 201_000 }, { saiu: 50_000 }, { relato: perdeu, em: 199_000 }]), T0)
  assert.equal(d.validacao, 'validada')
  assert.equal(d.motivo, 'abandono')
  assert.deepEqual(res(d), ['derrota', 'derrota', 'abandono', 'derrota'])
  assert.equal(d.duracaoS, 50, 'a duração vai até o primeiro marco (a saída)')
})

test('2x2: o time do vencedor ganha, o outro perde; null é empate', () => {
  let d = decidirN(partida('2x2', [{ relato: r({ vencedorTime: 1 }) }, { relato: r({ vencedorTime: 1 }) }, { relato: r({ vencedorTime: 1 }) }, {}]), T0)
  assert.equal(d.validacao, 'validada')
  assert.equal(d.vencedorTime, 1)
  assert.deepEqual(d.resultados, { 0: 'derrota', 1: 'vitoria', 2: 'derrota', 3: 'sem_relato' })
  d = decidirN(partida('2x2', [{ relato: r({ vencedorTime: null }) }, { relato: r({ vencedorTime: null }) }, {}, {}]), T0)
  assert.deepEqual(res(d), ['empate', 'empate', 'sem_relato', 'sem_relato'])
})

test('N sem relato: host caiu -> encerrada sem XP; senão encerrada (sem vitória por abandono)', () => {
  const p = partida('ffa', [{}, {}, { saiu: 30_000 }])
  assert.equal(decidirN(p, T0).motivo, 'abandono')
  assert.equal(decidirN(p, T0).validacao, 'encerrada')
  assert.deepEqual(res(decidirN(p, T0)), ['sem_relato', 'sem_relato', 'sem_relato'])
  p.hostCaiu = true
  assert.equal(decidirN(p, T0).motivo, 'host_caiu')
})

test('os modos de 2 não passam pela política de N', () => {
  const v0 = r({ vencedorLado: 0 })
  const d = decidir(partida('pvp', [{ relato: v0 }, { relato: v0 }]), T0)
  assert.deepEqual(d.resultados, { 0: 'vitoria', 1: 'derrota' })
  assert.equal(d.colocacoes, undefined)
})

test('registro: modo novo (sem XP ainda) não registra; com 2 de sempre registra', () => {
  const partidas = criarPartidas({ agora: () => T0, agendar: () => () => {} })
  const membros = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, nome: `J${i}`, usuario: null }))
  assert.equal(partidas.iniciar({ id: 's1', modo: 'coop4' }, membros(4)), null)
  assert.equal(partidas.iniciar({ id: 's2', modo: 'pvp' }, membros(3)), null)
  const p = partidas.iniciar({ id: 's3', modo: 'pvp' }, membros(2))
  assert.equal(p.participantes.length, 2)
  assert.deepEqual(p.participantes.map((x) => x.time), [null, null])
  partidas.fechar()
})
