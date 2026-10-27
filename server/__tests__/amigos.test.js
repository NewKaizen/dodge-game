import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { criarLobby, PROTOCOLO } from '../lan.js'
import { criarAutenticador } from '../contas.js'
import { criarRelacoes, CONVITE_MS, CONVITES_POR_MINUTO } from '../amigos.js'
import { criarSupabaseFalso } from '../supabase/fake.js'

const ID = { ana: '11111111-1111-4111-8111-111111111111', beto: '22222222-2222-4222-8222-222222222222', caio: '33333333-3333-4333-8333-333333333333', dani: '44444444-4444-4444-8444-444444444444' }
const perfil = (nome) => ({ id: ID[nome], tag: `${nome}#1000`, nome_exibicao: nome.toUpperCase(), avatar_tipo: 'padrao', avatar_id: null, avatar_url: null, titulo_equipado: null, nivel: 1, xp: 0 })
const LOCAIS = [{ ip: '192.168.0.10', mascara: '255.255.255.0' }]
const esperar = async () => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setImmediate(r))
}

let relogio = 0
// amizades: [['ana','beto'], ...] (a, b na ordem dos ids); bloqueios: [['quem','bloqueado']]
function montar({ amizades = [], bloqueios = [], pedidos = [] } = {}) {
  const usuarios = Object.fromEntries(Object.entries(ID).map(([n, id]) => [`token-${n}`, { id, email: `${n}@exemplo.com` }]))
  const sb = criarSupabaseFalso({ usuarios, perfis: Object.keys(ID).map(perfil) })
  const par = (x, y) => (ID[x] < ID[y] ? { a: ID[x], b: ID[y] } : { a: ID[y], b: ID[x] })
  sb.tabelas.amizades = amizades.map(([x, y]) => par(x, y))
  sb.tabelas.bloqueios = bloqueios.map(([x, y]) => ({ quem: ID[x], bloqueado: ID[y] }))
  sb.tabelas.pedidos_amizade = pedidos.map(([x, y]) => ({ de: ID[x], para: ID[y] }))
  relogio = 1_000_000
  const lobby = criarLobby({ locais: () => LOCAIS, autenticar: criarAutenticador(sb), relacoes: criarRelacoes(sb), agora: () => relogio })
  const conectar = () => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)) }
    const c = lobby.conectar(ws, '192.168.0.2')
    const p = {
      c,
      recebidas,
      mandar: (m) => lobby.receber(c, JSON.stringify(m)),
      tipo: (t) => recebidas.filter((m) => m.t === t),
      ultima: (t) => recebidas.filter((m) => m.t === t).at(-1),
      limpar: () => (recebidas.length = 0),
      sair: () => lobby.desconectar(c),
    }
    return p
  }
  // entra no lobby (com token, se for conta)
  const entrar = async (nome) => {
    const p = conectar()
    p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: nome.toUpperCase(), ...(ID[nome] && { token: `token-${nome}` }) })
    await esperar()
    p.usuario = ID[nome]
    return p
  }
  return { lobby, sb, entrar }
}

const mapa = (p) => p.ultima('presencas')?.mapa

test('protocolo igual nos dois lados (servidor e cliente)', () => {
  assert.ok(PROTOCOLO >= 3)
  const rede = fs.readFileSync(new URL('../../src/lib/lan/rede.js', import.meta.url), 'utf8')
  assert.match(rede, new RegExp(`export const PROTOCOLO = ${PROTOCOLO}\\b`))
})

test('presença: só os amigos veem, e o status acompanha a sala', async () => {
  const { entrar } = montar({ amizades: [['ana', 'beto'], ['ana', 'caio']] })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  const caio = await entrar('caio')
  const dani = await entrar('dani') // conta sem amigos
  const visitante = await entrar('visitante') // convidado

  assert.deepEqual(mapa(ana), {}, 'ana entrou primeiro: ninguém online ainda')
  assert.deepEqual(mapa(beto), { [ID.ana]: 'disponivel' })
  assert.deepEqual(mapa(caio), { [ID.ana]: 'disponivel' }, 'caio não vê o beto')
  assert.deepEqual(ana.tipo('presenca').map((m) => [m.id, m.status]), [[ID.beto, 'disponivel'], [ID.caio, 'disponivel']])
  assert.deepEqual(mapa(dani), {}, 'conta sem amigos recebe só o mapa vazio')
  assert.equal(dani.tipo('presenca').length, 0)
  assert.equal(visitante.tipo('presenca').length + visitante.tipo('presencas').length, 0)
  assert.equal(beto.tipo('presenca').length, 0, 'beto não vê o caio entrar')

  // partida: os amigos da ana veem, os de fora não
  ana.limpar(); beto.limpar(); caio.limpar(); dani.limpar()
  ana.mandar({ t: 'criar' })
  beto.mandar({ t: 'entrar', codigo: [...ana.recebidas].reverse().find((m) => m.t === 'sala').sala.codigo })
  ana.mandar({ t: 'partida', valor: true })
  assert.deepEqual(caio.tipo('presenca').map((m) => [m.id, m.status]), [[ID.ana, 'em_partida']])
  assert.deepEqual(beto.tipo('presenca').map((m) => [m.id, m.status]), [[ID.ana, 'em_partida']])
  assert.deepEqual(ana.tipo('presenca').map((m) => [m.id, m.status]), [[ID.beto, 'em_partida']])
  assert.equal(dani.tipo('presenca').length, 0)
  assert.equal(visitante.tipo('presenca').length, 0)

  // voltou ao lobby da sala
  caio.limpar()
  ana.mandar({ t: 'partida', valor: false })
  assert.deepEqual(caio.tipo('presenca').map((m) => [m.id, m.status]), [[ID.ana, 'disponivel']])

  // desconectou: offline para os amigos
  caio.limpar()
  ana.sair()
  assert.deepEqual(caio.tipo('presenca').map((m) => [m.id, m.status]), [[ID.ana, 'offline']])
  assert.equal(dani.tipo('presenca').length, 0)
})

test('presença: nunca vaza o id do usuário na sala nem para quem não é amigo', async () => {
  const { entrar } = montar({ amizades: [['ana', 'beto']] })
  const ana = await entrar('ana')
  const caio = await entrar('caio')
  ana.mandar({ t: 'criar' })
  caio.mandar({ t: 'entrar', codigo: ana.ultima('sala').sala.codigo })
  const membros = caio.ultima('sala').sala.membros
  assert.equal(membros.find((m) => m.papel === 'host').conta.tag, 'ana#1000', 'a tag aparece para o botão de adicionar')
  assert.doesNotMatch(JSON.stringify(caio.recebidas), new RegExp(`${ID.ana}|${ID.beto}|@exemplo`))
})

test('bloqueio: some a presença nos dois sentidos e barra o convite', async () => {
  const { entrar, sb } = montar({ amizades: [['ana', 'beto']] })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  assert.deepEqual(mapa(beto), { [ID.ana]: 'disponivel' })

  // ana bloqueia o beto (o RPC apaga a amizade e grava o bloqueio) e avisa o servidor
  sb.tabelas.amizades = []
  sb.tabelas.bloqueios = [{ quem: ID.ana, bloqueado: ID.beto }]
  ana.limpar(); beto.limpar()
  ana.mandar({ t: 'amigosMudaram', com: ID.beto })
  await esperar()
  assert.deepEqual(mapa(ana), {})
  assert.deepEqual(beto.tipo('presenca').map((m) => [m.id, m.status]), [[ID.ana, 'offline']])
  assert.equal(beto.tipo('amigosAtualizar').length, 1, 'o beto é avisado para reler a lista')

  // mesmo com a cache velha de um lado, o outro não vê nem convida
  beto.limpar(); ana.limpar()
  ana.mandar({ t: 'criar' })
  ana.mandar({ t: 'partida', valor: true })
  assert.equal(beto.tipo('presenca').length, 0)
  beto.mandar({ t: 'convidar', para: ID.ana })
  assert.equal(beto.ultima('conviteNegado').msg, 'esse amigo não está disponível')
  assert.equal(ana.tipo('convite').length, 0)
})

test('amigosMudaram: só avisa quem tem relação, e no máximo uma vez por segundo', async () => {
  const { entrar } = montar({ pedidos: [['ana', 'beto']] })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  const dani = await entrar('dani')
  ana.mandar({ t: 'amigosMudaram', com: ID.dani })
  await esperar()
  assert.equal(dani.tipo('amigosAtualizar').length, 0, 'estranho não recebe ping')
  relogio += 1500
  ana.mandar({ t: 'amigosMudaram', com: ID.beto })
  ana.mandar({ t: 'amigosMudaram', com: ID.beto }) // dentro do mesmo segundo: ignorado
  await esperar()
  assert.equal(beto.tipo('amigosAtualizar').length, 1)
})

test('convidar: precisa de conta, amizade mútua e amigo online', async () => {
  const { entrar } = montar({ amizades: [['ana', 'beto'], ['ana', 'caio']] })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  const dani = await entrar('dani')
  const visitante = await entrar('visitante')
  const negado = (p) => p.ultima('conviteNegado')?.msg

  visitante.mandar({ t: 'convidar', para: ID.ana })
  assert.match(negado(visitante), /entre com sua conta/)
  beto.mandar({ t: 'convidar', para: ID.dani }) // não é amigo
  assert.equal(negado(beto), 'esse amigo não está disponível')
  dani.mandar({ t: 'convidar', para: ID.ana }) // não é amigo
  assert.equal(negado(dani), 'esse amigo não está disponível')
  ana.mandar({ t: 'convidar', para: ID.caio }) // amigo, mas offline
  assert.equal(negado(ana), 'esse amigo não está disponível')
  ana.mandar({ t: 'convidar', para: 'nao-existe' })
  ana.mandar({ t: 'convidar' })
  ana.mandar({ t: 'convidar', para: ID.ana }) // a si mesmo
  assert.equal(ana.tipo('convite').length + beto.tipo('convite').length + dani.tipo('convite').length, 0)
  assert.equal(ana.c.sala, null, 'convite recusado não cria sala')
  assert.equal(beto.c.sala, null)
})

test('convidar: cria a sala, manda o convite e aceitar põe o amigo na sala', async () => {
  const { entrar, lobby } = montar({ amizades: [['ana', 'beto']] })
  const ana = await entrar('ana')
  const beto = await entrar('beto')

  ana.mandar({ t: 'convidar', para: ID.beto })
  assert.ok(ana.c.sala, 'criou a sala do convite')
  const convite = beto.ultima('convite')
  assert.deepEqual(convite.de, { id: ID.ana, tag: 'ana#1000', nome: 'ANA', avatar: { tipo: 'padrao', id: null, url: null } })
  assert.equal(convite.modo, 'pvp')
  assert.equal(convite.restanteMs, CONVITE_MS)
  assert.equal(convite.expiraEm, relogio + CONVITE_MS)
  assert.equal(ana.ultima('conviteEnviado').id, convite.id)

  // segundo convite para o mesmo amigo enquanto o primeiro está pendente
  ana.mandar({ t: 'convidar', para: ID.beto })
  assert.match(ana.ultima('conviteNegado').msg, /já convidou/)

  beto.mandar({ t: 'responderConvite', id: convite.id, aceitar: true })
  assert.equal(beto.c.sala, ana.c.sala)
  const sala = lobby.salas.get(ana.c.sala)
  assert.equal(sala.membros.size, 2)
  assert.equal(ana.ultima('conviteResposta').resultado, 'aceito')
  assert.equal(beto.ultima('sala').sala.membros.length, 2)

  // o convite só vale uma vez
  beto.mandar({ t: 'responderConvite', id: convite.id, aceitar: true })
  assert.equal(beto.ultima('conviteFim').id, convite.id)
  // e com a sala cheia não dá para convidar outro
  ana.mandar({ t: 'convidar', para: ID.beto })
  assert.match(ana.ultima('conviteNegado').msg, /já está na sua sala/)
})

test('responderConvite: recusar avisa quem convidou e não mexe na sala', async () => {
  const { entrar, lobby } = montar({ amizades: [['ana', 'beto']] })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  ana.mandar({ t: 'convidar', para: ID.beto })
  const { id } = beto.ultima('convite')
  beto.mandar({ t: 'responderConvite', id, aceitar: false })
  assert.equal(ana.ultima('conviteResposta').resultado, 'recusado')
  assert.equal(beto.c.sala, null)
  assert.equal(lobby.salas.get(ana.c.sala).membros.size, 1)
  beto.mandar({ t: 'responderConvite', id, aceitar: true }) // já respondido
  assert.equal(beto.c.sala, null)
})

test('responderConvite: só o destinatário responde', async () => {
  const { entrar } = montar({ amizades: [['ana', 'beto'], ['ana', 'caio']] })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  const caio = await entrar('caio')
  ana.mandar({ t: 'convidar', para: ID.beto })
  const { id } = beto.ultima('convite')
  caio.mandar({ t: 'responderConvite', id, aceitar: true })
  assert.equal(caio.c.sala, null)
  ana.mandar({ t: 'responderConvite', id, aceitar: true })
  assert.equal(ana.c.sala !== null && ana.tipo('sala').at(-1).sala.membros.length, 1)
  beto.mandar({ t: 'responderConvite', id, aceitar: true })
  assert.equal(beto.c.sala, ana.c.sala, 'o beto ainda consegue')
})

test('convite expira em 60 s: avisa os dois e não entra mais', async () => {
  const { entrar, lobby } = montar({ amizades: [['ana', 'beto']] })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  ana.mandar({ t: 'convidar', para: ID.beto })
  const { id } = beto.ultima('convite')
  relogio += CONVITE_MS - 1
  lobby.expirarConvites()
  assert.equal(beto.tipo('conviteFim').length, 0, 'ainda vale')
  relogio += 1
  lobby.expirarConvites()
  assert.equal(beto.ultima('conviteFim').id, id)
  assert.equal(ana.ultima('conviteResposta').resultado, 'expirado')
  beto.mandar({ t: 'responderConvite', id, aceitar: true })
  assert.equal(beto.c.sala, null)
  // depois de expirar dá para convidar de novo
  ana.mandar({ t: 'convidar', para: ID.beto })
  assert.equal(beto.tipo('convite').length, 2)
})

test('convite vencido é recusado mesmo sem ninguém chamar o limpador', async () => {
  const { entrar } = montar({ amizades: [['ana', 'beto']] })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  ana.mandar({ t: 'convidar', para: ID.beto })
  const { id } = beto.ultima('convite')
  relogio += CONVITE_MS + 5
  beto.mandar({ t: 'responderConvite', id, aceitar: true })
  assert.equal(beto.c.sala, null)
  assert.equal(beto.ultima('conviteFim').id, id)
})

test('quem convidou saiu da sala ou desconectou: o convite cai', async () => {
  const { entrar } = montar({ amizades: [['ana', 'beto'], ['ana', 'caio']] })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  const caio = await entrar('caio')
  ana.mandar({ t: 'convidar', para: ID.beto })
  const a = beto.ultima('convite').id
  ana.mandar({ t: 'sair' })
  assert.equal(beto.ultima('conviteFim').id, a)
  beto.mandar({ t: 'responderConvite', id: a, aceitar: true })
  assert.equal(beto.c.sala, null)

  ana.mandar({ t: 'convidar', para: ID.caio })
  const b = caio.ultima('convite').id
  ana.sair() // desconectou
  assert.equal(caio.ultima('conviteFim').id, b)
  caio.mandar({ t: 'responderConvite', id: b, aceitar: true })
  assert.equal(caio.c.sala, null)
})

test('a partida começando cancela os convites; só o host convida; amigo em partida não recebe', async () => {
  const { entrar, lobby } = montar({ amizades: [['ana', 'beto'], ['ana', 'caio'], ['beto', 'caio']] })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  const caio = await entrar('caio')
  ana.mandar({ t: 'convidar', para: ID.beto })
  const { id } = beto.ultima('convite')
  beto.mandar({ t: 'responderConvite', id, aceitar: true })
  // o beto (convidado) não convida
  beto.mandar({ t: 'convidar', para: ID.caio })
  assert.equal(beto.ultima('conviteNegado').msg, 'só o dono da sala pode convidar')
  // sala cheia
  ana.mandar({ t: 'convidar', para: ID.caio })
  assert.equal(ana.ultima('conviteNegado').msg, 'a sala está cheia')
  // o beto sai e a ana convida o caio; a partida começa antes dele responder
  beto.mandar({ t: 'sair' })
  ana.mandar({ t: 'convidar', para: ID.caio })
  const c = caio.ultima('convite').id
  ana.mandar({ t: 'partida', valor: true })
  assert.equal(caio.ultima('conviteFim').id, c)
  // convidar com a sala em partida
  ana.mandar({ t: 'convidar', para: ID.beto })
  assert.match(ana.ultima('conviteNegado').msg, /meio de uma partida/)
  // convidar quem está numa partida
  beto.mandar({ t: 'convidar', para: ID.ana })
  assert.match(beto.ultima('conviteNegado').msg, /numa partida/)
  assert.equal(lobby.salas.size, 1)
})

test('limite de convites: 5 por minuto por quem convida', async () => {
  const { entrar } = montar({ amizades: [['ana', 'beto']] })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  for (let i = 0; i < CONVITES_POR_MINUTO; i++) {
    ana.mandar({ t: 'convidar', para: ID.beto })
    const { id } = beto.ultima('convite')
    beto.mandar({ t: 'responderConvite', id, aceitar: false })
  }
  assert.equal(beto.tipo('convite').length, CONVITES_POR_MINUTO)
  ana.mandar({ t: 'convidar', para: ID.beto })
  assert.match(ana.ultima('conviteNegado').msg, /convites demais/)
  assert.equal(beto.tipo('convite').length, CONVITES_POR_MINUTO)
  relogio += 61_000
  ana.mandar({ t: 'convidar', para: ID.beto })
  assert.equal(beto.tipo('convite').length, CONVITES_POR_MINUTO + 1)
})

test('aceitar depois que a amizade acabou ou o bloqueio chegou não entra na sala', async () => {
  const { entrar, sb } = montar({ amizades: [['ana', 'beto']] })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  ana.mandar({ t: 'convidar', para: ID.beto })
  const { id } = beto.ultima('convite')
  sb.tabelas.amizades = []
  sb.tabelas.bloqueios = [{ quem: ID.beto, bloqueado: ID.ana }]
  beto.mandar({ t: 'amigosMudaram' })
  await esperar()
  assert.equal(ana.ultima('conviteResposta')?.resultado ?? 'nada', 'nada', 'cancelado sem barulho para quem convidou')
  beto.mandar({ t: 'responderConvite', id, aceitar: true })
  assert.equal(beto.c.sala, null)
})

test('sair da conta (ou trocar) tira a presença e os convites', async () => {
  const { entrar } = montar({ amizades: [['ana', 'beto']] })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  ana.mandar({ t: 'convidar', para: ID.beto })
  const { id } = beto.ultima('convite')
  beto.limpar()
  ana.mandar({ t: 'conta', token: null })
  await esperar()
  assert.deepEqual(beto.tipo('presenca').map((m) => [m.id, m.status]), [[ID.ana, 'offline']])
  assert.equal(beto.ultima('conviteFim').id, id)
  beto.mandar({ t: 'convidar', para: ID.ana })
  assert.equal(beto.ultima('conviteNegado').msg, 'esse amigo não está disponível')
})

test('sem Supabase de amigos (relacoes nulo): nada de presença nem convite, o lobby segue', async () => {
  const sb = criarSupabaseFalso({ usuarios: { 'token-ana': { id: ID.ana } }, perfis: [perfil('ana')] })
  const lobby = criarLobby({ locais: () => LOCAIS, autenticar: criarAutenticador(sb), agora: () => relogio })
  const recebidas = []
  const c = lobby.conectar({ readyState: 1, send: (m) => recebidas.push(JSON.parse(m)) }, '192.168.0.2')
  lobby.receber(c, JSON.stringify({ t: 'ola', protocolo: PROTOCOLO, nome: 'A', token: 'token-ana' }))
  await esperar()
  lobby.receber(c, JSON.stringify({ t: 'convidar', para: ID.beto }))
  assert.match(recebidas.find((m) => m.t === 'conviteNegado').msg, /entre com sua conta/)
  lobby.receber(c, JSON.stringify({ t: 'criar' }))
  assert.ok(recebidas.some((m) => m.t === 'sala'))
})

test('relações: lê amizades, bloqueios (nos dois sentidos) e pedidos; erro vira null', async () => {
  const sb = criarSupabaseFalso({ perfis: Object.keys(ID).map(perfil) })
  const a = ID.ana < ID.beto ? { a: ID.ana, b: ID.beto } : { a: ID.beto, b: ID.ana }
  sb.tabelas.amizades = [a, { a: ID.caio, b: ID.dani }]
  sb.tabelas.bloqueios = [{ quem: ID.ana, bloqueado: ID.caio }, { quem: ID.dani, bloqueado: ID.ana }]
  sb.tabelas.pedidos_amizade = [{ de: ID.ana, para: ID.dani }]
  const rel = await criarRelacoes(sb)(ID.ana)
  assert.deepEqual([...rel.amigos], [ID.beto])
  assert.deepEqual([...rel.bloqueios].sort(), [ID.caio, ID.dani].sort())
  assert.deepEqual([...rel.pedidos], [ID.dani])
  sb.falhar.amizades = true
  assert.equal(await criarRelacoes(sb)(ID.ana), null)
})
