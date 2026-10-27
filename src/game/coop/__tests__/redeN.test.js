// A ponte do CO-OP de 3 e 4 (coop/ArenaRedeCoopN.js) por canais de verdade numa estrela em memória:
// node --test src/game/coop/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ArenaRedeCoopN from '../ArenaRedeCoopN.js'
import { criarCanal } from '../../../lib/lan/canal.js'
import { criarPartidaCoop, iniciarRodadaCoop, resolverRodadaCoop } from '../regras.js'

const PARTY = ['kris', 'susie', 'ralsei', 'dess']
const espera = (ms = 30) => new Promise((r) => setTimeout(r, ms))

// host H na vaga 2 (o host eleito não é a vaga 0), convidados A (0), B (1) e C (3)
function montar({ n = 4, host = 'H' } = {}) {
  const vagas = { A: 0, B: 1, H: 2, C: 3 }
  const ids = Object.keys(vagas).filter((id) => vagas[id] < n)
  const nos = {}
  let membros = ids.map((id) => ({ id, indice: vagas[id], nome: id, caiu: null }))
  const participantes = () => membros.map((m) => ({ ...m }))
  const entregues = []
  const criar = (id) => {
    const souHost = id === host
    const mandar = (msg, para) => {
      const alvo = souHost ? para : host
      setImmediate(() => nos[alvo]?.canal.entregar(msg))
    }
    const todos = (msg) => membros.filter((m) => m.id !== id).forEach((m) => mandar(msg, m.id))
    const destinos = () => (souHost ? membros.filter((m) => m.id !== id).map((m) => m.id) : [host])
    const canal = criarCanal({ enviarBruto: mandar, enviarReserva: mandar, enviarTodos: souHost ? todos : null, meuId: () => id, destinos })
    const log = { acertos: [], grazes: [], prontos: [] }
    const estado = criarPartidaCoop({ party: PARTY.slice(0, n), chefe: 'king', semente: 'rede-n' })
    const arena = {
      estado,
      saindo: false,
      acertosRodada: Array(n).fill(0),
      ko: Array(n).fill(false),
      sys: { settings: { data: { chefe: 'king' } } },
      pistas: [{ aberta: true, coracoes: Array.from({ length: n }, (_, j) => ({ ativo: true, x: 100 + j * 50, y: 100, espelho: false, ajustar() {}, jogador: j })) }],
      aplicarAcerto: (j, dano) => log.acertos.push([j, dano]),
      aplicarGraze: (j) => log.grazes.push(j),
      marcarPronto: (j) => log.prontos.push(j),
      extrasRetomada: () => ({ estatisticas: [] }),
    }
    const rede = new ArenaRedeCoopN(arena, { canal, meuIndice: vagas[id], souHost, participantes, dev: true })
    nos[id] = { canal, arena, rede, log, vaga: vagas[id] }
  }
  ids.forEach(criar)
  return { nos, ids, host, vivos: () => membros.map((m) => m.id), convidados: ids.filter((i) => i !== host), tirar: (id) => (membros = membros.filter((m) => m.id !== id)), cair: (id) => (membros = membros.map((m) => (m.id === id ? { ...m, caiu: 15000 } : m))), voltar: (id) => (membros = membros.map((m) => (m.id === id ? { ...m, caiu: null } : m))), fechar: () => ids.forEach((i) => nos[i].rede.destruir()) }
}

// começa a rodada: o host manda o `inicio`, os convidados esperam
async function comecar(m) {
  const pend = m.convidados.filter((id) => m.vivos().includes(id)).map((id) => m.nos[id].rede.iniciarRodada())
  await m.nos[m.host].rede.iniciarRodada()
  return Promise.all(pend)
}

test('o host começa a rodada e todos ficam com o mesmo estado, a mesma carta do chefe e a mesma mira', async () => {
  const m = montar()
  const eventos = await comecar(m)
  const h = m.nos.H.arena.estado
  assert.equal(h.rodada, 1)
  assert.equal(h.chefe.mira.length, 2)
  for (const id of m.convidados) {
    const e = m.nos[id].arena.estado
    assert.equal(e.rodada, 1)
    assert.deepEqual(e.chefe.mira, h.chefe.mira)
    assert.equal(e.chefe.intencao?.id, h.chefe.intencao?.id)
  }
  assert.equal(eventos.length, 3)
  m.fechar()
})

test('jogadas: o host junta as de todos (quem não joga a tempo ou não está, passa) e todos veem o PRONTO', async () => {
  const m = montar()
  await comecar(m)
  for (const id of m.ids) m.nos[id].rede.comecarEscolha()
  m.cair('C') // a vaga 3 caiu da rede: o host não espera por ela
  const jogaveis = Object.fromEntries(m.ids.map((id) => [id, m.nos[id].arena.estado.jogadores[m.nos[id].vaga].baralho.mao[0]?.id ?? null]))
  m.nos.A.rede.enviarJogada(jogaveis.A)
  m.nos.B.rede.enviarJogada(null)
  const pronto = m.nos.H.rede.juntarJogadas(50)
  m.nos.H.rede.enviarJogada(jogaveis.H)
  const jogadas = await pronto
  assert.deepEqual(jogadas, [jogaveis.A, null, jogaveis.H, null])
  await espera()
  // os PRONTO chegam a todos (cada um vê quem já escolheu; o dono não recebe o dele de volta)
  assert.deepEqual([...m.nos.A.log.prontos].sort(), [1, 2])
  assert.deepEqual([...m.nos.B.log.prontos].sort(), [0, 2])
  assert.deepEqual([...m.nos.H.log.prontos].sort(), [0, 1, 2])
  m.fechar()
})

test('o host espera um convidado que ainda não jogou (até o tempo) e usa a jogada dele', async () => {
  const m = montar({ n: 3 })
  await comecar(m)
  for (const id of m.ids) m.nos[id].rede.comecarEscolha()
  m.nos.H.rede.enviarJogada(null)
  m.nos.A.rede.enviarJogada(null)
  let pronto = false
  const p = m.nos.H.rede.juntarJogadas(2000).then((j) => ((pronto = true), j))
  await espera(120)
  assert.equal(pronto, false, 'falta o B')
  const carta = m.nos.B.arena.estado.jogadores[1].baralho.mao[0].id
  m.nos.B.rede.enviarJogada(carta)
  assert.deepEqual(await p, [null, carta, null])
  m.fechar()
})

test('dano e graze: o dono manda ao host, que confere, repassa a todos e aplica; ninguém aplica o próprio de volta', async () => {
  const m = montar()
  await comecar(m)
  for (const id of m.ids) m.nos[id].rede.comecarLuta()
  m.nos.A.rede.enviarDano(0, 7)
  m.nos.A.rede.enviarGraze(0)
  m.nos.H.rede.enviarDano(2, 4)
  await espera()
  assert.deepEqual(m.nos.H.log.acertos, [[0, 7]])
  const ordenado = (l) => [...l].sort((a, b) => a[0] - b[0])
  assert.deepEqual(ordenado(m.nos.B.log.acertos), [[0, 7], [2, 4]])
  assert.deepEqual(ordenado(m.nos.C.log.acertos), [[0, 7], [2, 4]])
  assert.deepEqual(m.nos.A.log.acertos, [[2, 4]], 'o A não aplica o próprio acerto de novo')
  assert.deepEqual(m.nos.B.log.grazes, [0])
  assert.deepEqual(m.nos.H.log.grazes, [0])
  // um convidado não fala pelo coração de outro: o host ignora
  m.nos.A.rede.enviar('dano', null, { lado: 1, dano: 99, r: 1 })
  await espera()
  assert.ok(!m.nos.B.log.acertos.some(([j, d]) => d === 99))
  assert.ok(!m.nos.H.log.acertos.some(([j, d]) => d === 99))
  m.fechar()
})

test('dano que chega antes da esquiva começar aqui espera por ela', async () => {
  const m = montar({ n: 3 })
  await comecar(m)
  m.nos.A.rede.comecarLuta()
  m.nos.A.rede.enviarDano(0, 5)
  await espera()
  assert.deepEqual(m.nos.B.log.acertos, [], 'o B ainda não começou a esquiva')
  m.nos.B.rede.comecarLuta()
  assert.deepEqual(m.nos.B.log.acertos, [[0, 5]])
  m.fechar()
})

test('fim da esquiva: cada um espera o fim dos que estão no quadro e dispensa quem caiu da rede', async () => {
  const m = montar()
  await comecar(m)
  const no = [true, true, true, true]
  for (const id of m.ids) m.nos[id].rede.comecarLuta()
  let acabou = 0
  const esperas = m.ids.filter((id) => id !== 'C').map((id) => m.nos[id].rede.esperarFimEsquiva(Promise.resolve(), no).then(() => acabou++))
  await espera(120)
  assert.equal(acabou, 0, 'falta o C avisar que acabou')
  m.cair('C') // o C caiu da rede: ninguém espera mais por ele
  await Promise.all(esperas)
  assert.equal(acabou, 3)
  m.fechar()
})

test('o host junta os corações num pacote: cada um vê os dos outros (não o próprio)', async () => {
  const m = montar()
  await comecar(m)
  const t = []
  for (const id of m.ids) {
    const rede = m.nos[id].rede
    const pista = m.nos[id].arena.pistas[0]
    const meu = pista.coracoes[m.nos[id].vaga]
    meu.x = 300 + m.nos[id].vaga * 10
    meu.y = 200
  }
  for (let k = 0; k < 8; k++) {
    for (const id of m.ids) m.nos[id].rede.atualizar(40)
    await espera(15)
  }
  await espera(150)
  for (const id of m.ids) m.nos[id].rede.atualizar(40)
  for (const id of m.ids) {
    const { vaga, arena } = m.nos[id]
    arena.pistas[0].coracoes.forEach((c, j) => {
      if (j === vaga) return assert.equal(c.espelho, false)
      assert.equal(c.espelho, true, `${id}: o coração ${j} é espelho`)
      assert.ok(Math.abs(c.x - (300 + j * 10)) < 25, `${id}: coração ${j} em x=${c.x}`)
      assert.ok(Math.abs(c.y - 200) < 25, `${id}: coração ${j} em y=${c.y}`)
    })
  }
  void t
  m.fechar()
})

test('quem caiu da rede fica de fora da rodada (ausente) e quem saiu de vez também (saiu)', async () => {
  const m = montar()
  m.cair('B')
  m.tirar('C')
  assert.deepEqual(m.nos.H.rede.presenca(), { ausentes: [1], saiu: [3] })
  await comecar(m)
  const h = m.nos.H.arena.estado
  assert.equal(h.jogadores[1].ausente, true)
  assert.equal(h.jogadores[3].saiu, true)
  assert.deepEqual(h.chefe.mira, [0, 2], 'só os dois que estão de pé e presentes')
  // o convidado recebeu as marcas junto do estado
  assert.equal(m.nos.A.arena.estado.jogadores[1].ausente, true)
  assert.equal(m.nos.A.arena.estado.jogadores[3].saiu, true)
  // voltou: na próxima rodada entra de novo; quem saiu não volta
  m.voltar('B')
  for (const id of ['A', 'B', 'H']) m.nos[id].arena.estado.fase = 'fim'
  await comecar(m)
  assert.equal(m.nos.H.arena.estado.jogadores[1].ausente, false)
  assert.equal(m.nos.H.arena.estado.jogadores[3].saiu, true)
  m.fechar()
})

test('volta de um convidado: recebe o estado de agora e entra na PRÓXIMA rodada, ignorando o resto da atual', async () => {
  const m = montar()
  await comecar(m) // rodada 1 começou
  m.cair('B')
  // o host manda a cena do B de novo: os dados trazem o estado de agora
  const dados = m.nos.H.rede.dadosRetomadaPara('B')
  assert.equal(dados.retomada.entrando, true)
  assert.equal(dados.retomada.estado.rodada, 1)
  assert.equal(dados.chefe, 'king', 'os dados com que a cena abriu')
  // a arena nova do B (o canal dele recomeçou): troca o estado e espera a rodada 2
  const novo = montar().nos.B
  novo.rede.aplicarRetomada(dados.retomada)
  assert.equal(novo.arena.estado.rodada, 1)
  assert.equal(novo.rede.entrouNaRodada, 1)
  // dano da rodada 1 que ainda chega: ignorado
  novo.rede.comecarLuta()
  novo.rede.aoEvento('dano', { lado: 0, dano: 9, r: 1 }, 'H')
  assert.deepEqual(novo.log.acertos, [])
  // a rodada 2 (de quem estava jogando): entra
  novo.rede.arena.estado.fase = 'fim'
  const msg = novo.rede.iniciarRodada()
  novo.canal.entregar({ tipo: 'rede', de: 'H', e: 'x', s: 0, t: 1, k: 'inicio', c: 2, d: { estado: { ...dados.retomada.estado, rodada: 2 }, eventos: [] } })
  assert.deepEqual(await msg, [])
  assert.equal(novo.arena.estado.rodada, 2)
  m.fechar()
})

test('resultado: o host espera os convidados que estão e não os que caíram', async () => {
  const m = montar({ n: 3 })
  await comecar(m)
  m.cair('B')
  let abriu = false
  const p = m.nos.H.rede.prontoParaResultado().then((v) => ((abriu = true), v))
  await espera(80)
  assert.equal(abriu, false, 'falta o A')
  assert.equal(await m.nos.A.rede.prontoParaResultado(), false, 'o convidado só avisa e espera a cena do host')
  assert.equal(await p, true)
  m.fechar()
})

test('a mesma semente dá a mesma rodada em todos os PCs (a carta do chefe vem do RNG do estado do host)', async () => {
  const a = criarPartidaCoop({ party: PARTY, chefe: 'queen', semente: 'igual' })
  const b = criarPartidaCoop({ party: PARTY, chefe: 'queen', semente: 'igual' })
  iniciarRodadaCoop(a)
  iniciarRodadaCoop(b)
  assert.deepEqual(a.chefe.intencao, b.chefe.intencao)
  assert.deepEqual(a.chefe.mira, b.chefe.mira)
  const ra = resolverRodadaCoop(a, null, null, null, null)
  const rb = resolverRodadaCoop(b, null, null, null, null)
  assert.deepEqual(ra.quadro.mira, rb.quadro.mira)
})

test('o host derruba na hora quem cai da rede (mesmo que nunca volte) e avisa "voltou caído" quando volta', async () => {
  const m = montar()
  await comecar(m) // rodada 1
  assert.equal(m.nos.H.arena.estado.jogadores[1].caido, false)
  m.cair('B')
  m.nos.H.rede.atualizar(16) // o tick do host
  const hp = m.nos.H.arena.estado.jogadores[1]
  assert.equal(hp.caido, true)
  assert.equal(hp.hp, 0)
  // voltou: a próxima rodada o mantém caído e manda o evento a todos
  m.voltar('B')
  for (const id of ['A', 'B', 'H']) m.nos[id].arena.estado.fase = 'fim'
  const eventos = await comecar(m)
  assert.equal(m.nos.H.arena.estado.jogadores[1].caido, true)
  assert.equal(m.nos.H.arena.estado.jogadores[1].hp, 0)
  assert.ok(eventos.flat().some((e) => e?.tipo === 'voltouCaido' && e.j === 1))
  assert.equal(m.nos.A.arena.estado.jogadores[1].caido, true)
  m.fechar()
})
