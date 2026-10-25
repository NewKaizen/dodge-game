import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, PROTOCOLO } from '../lan.js'
import { criarAutenticador } from '../contas.js'
import { criarSupabaseFalso } from '../supabase/fake.js'

const ID_ANA = '11111111-1111-4111-8111-111111111111'
const PERFIL_ANA = { id: ID_ANA, tag: 'ana#0042', nome_exibicao: 'Ana Clara', avatar_tipo: 'jogo', avatar_id: 'kris', avatar_url: null, titulo_equipado: null, nivel: 3, xp: 120 }
const LOCAIS = [{ ip: '192.168.0.10', mascara: '255.255.255.0' }]

let relogio = 0
function montar(autenticar) {
  const lobby = criarLobby({ locais: () => LOCAIS, autenticar, agora: () => relogio })
  const conectar = (ip = '192.168.0.2') => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)) }
    const c = lobby.conectar(ws, ip)
    const mandar = (m) => lobby.receber(c, JSON.stringify(m))
    return { c, recebidas, mandar, ultima: (t) => recebidas.filter((m) => m.t === t).at(-1) }
  }
  return { lobby, conectar }
}

const esperar = () => new Promise((r) => setImmediate(r))

function autenticadorFalso() {
  const sb = criarSupabaseFalso({ usuarios: { 'token-ana': { id: ID_ANA, email: 'ana@exemplo.com' } }, perfis: [PERFIL_ANA] })
  return { sb, autenticar: criarAutenticador(sb) }
}

test('sem token: entra como convidado na hora (LAN sem conta)', () => {
  const { conectar } = montar(autenticadorFalso().autenticar)
  const p = conectar()
  p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: 'BETO' })
  const b = p.ultima('bemvindo')
  assert.ok(b, 'boas-vindas sem esperar')
  assert.equal(b.conta, null)
  assert.equal(b.contaInvalida, undefined)
  assert.equal(p.c.usuario, null)
  assert.equal(p.c.nome, 'BETO')
})

test('sem autenticar (servidor sem Supabase): token é ignorado, sem aviso de sessão', () => {
  const { conectar } = montar(null)
  const p = conectar()
  p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: 'BETO', token: 'qualquer' })
  assert.equal(p.ultima('bemvindo').conta, null)
  assert.equal(p.ultima('bemvindo').contaInvalida, undefined)
})

test('token válido: valida antes das boas-vindas e usa o nome do perfil', async () => {
  const { conectar } = montar(autenticadorFalso().autenticar)
  const p = conectar()
  p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: 'FINGIDO', token: 'token-ana' })
  assert.equal(p.ultima('bemvindo'), undefined, 'ainda validando')
  assert.equal(p.c.ok, false)
  p.mandar({ t: 'criar' }) // antes de validar: ignorado
  p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: 'DE NOVO' }) // segundo ola: ignorado
  await esperar()
  const b = p.ultima('bemvindo')
  assert.equal(p.recebidas.filter((m) => m.t === 'bemvindo').length, 1)
  assert.equal(b.conta.tag, 'ana#0042')
  assert.equal(b.conta.nome, 'Ana Clara')
  assert.deepEqual(b.conta.avatar, { tipo: 'jogo', id: 'kris', url: null })
  assert.equal(b.conta.nivel, 3)
  assert.equal(b.conta.id, undefined, 'não manda o id do usuário')
  assert.equal(p.c.usuario, ID_ANA)
  assert.equal(p.c.nome, 'Ana Clara')
  assert.equal(p.ultima('sala'), undefined)

  // com conta, o nome do lobby não muda pelo "nome"
  p.mandar({ t: 'nome', nome: 'OUTRO' })
  assert.equal(p.c.nome, 'Ana Clara')

  // a sala mostra o resumo público, sem e-mail nem id
  p.mandar({ t: 'criar' })
  const eu = p.ultima('sala').sala.membros[0]
  assert.equal(eu.nome, 'Ana Clara')
  assert.deepEqual(eu.conta, { tag: 'ana#0042', avatar: { tipo: 'jogo', id: 'kris', url: null }, nivel: 3, titulo: null })
  assert.doesNotMatch(JSON.stringify(p.recebidas), /ana@exemplo|11111111-/)
})

test('token inválido: continua como convidado e avisa', async () => {
  const { conectar } = montar(autenticadorFalso().autenticar)
  const p = conectar()
  p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: 'CAIO', token: 'token-falsificado' })
  await esperar()
  const b = p.ultima('bemvindo')
  assert.equal(b.conta, null)
  assert.equal(b.contaInvalida, true)
  assert.equal(p.c.ok, true)
  assert.equal(p.c.usuario, null)
  assert.equal(p.c.nome, 'CAIO')
  p.mandar({ t: 'criar' })
  assert.ok(p.ultima('sala'), 'convidado joga normal')
})

test('Supabase fora do ar ou autenticar que lança: convidado, sem derrubar', async () => {
  const { sb, autenticar } = autenticadorFalso()
  sb.falhar.getUser = true
  const { conectar } = montar(autenticar)
  const p = conectar()
  p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: 'DANI', token: 'token-ana' })
  await esperar()
  assert.equal(p.ultima('bemvindo').contaInvalida, true)

  const lobby2 = montar(() => {
    throw new Error('boom')
  })
  const q = lobby2.conectar()
  q.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: 'EVA', token: 'x' })
  await esperar()
  assert.equal(q.ultima('bemvindo').conta, null)
})

test('autenticar que demora demais vira convidado (antes do cliente desistir)', async () => {
  const lento = { auth: { getUser: () => new Promise(() => {}) }, from: () => null }
  const autenticar = criarAutenticador(lento, { tempoMs: 20 })
  assert.equal(await autenticar('token'), null)
})

test('desconectou enquanto validava: não manda nada nem quebra', async () => {
  let liberar
  const { lobby, conectar } = montar(() => new Promise((r) => (liberar = r)))
  const p = conectar()
  p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: 'FÁBIO', token: 'token-ana' })
  await esperar()
  lobby.desconectar(p.c)
  liberar({ id: ID_ANA, perfil: PERFIL_ANA })
  await esperar()
  assert.equal(p.recebidas.length, 0)
  assert.equal(lobby.clientes.size, 0)
})

test('"conta" troca a conta sem reconectar (entrou / saiu)', async () => {
  const { conectar } = montar(autenticadorFalso().autenticar)
  const p = conectar()
  p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: 'GIL' })
  p.mandar({ t: 'conta', token: 'token-ana' })
  await esperar()
  assert.equal(p.ultima('conta').conta.tag, 'ana#0042')
  assert.equal(p.c.nome, 'Ana Clara')
  relogio += 1000
  p.mandar({ t: 'conta', token: null })
  assert.equal(p.ultima('conta').conta, null)
  assert.equal(p.c.usuario, null)
  relogio += 1000
  p.mandar({ t: 'conta', token: 'ruim' })
  await esperar()
  assert.equal(p.ultima('conta').contaInvalida, true)
  // martelando: só um por segundo
  const antes = p.recebidas.filter((m) => m.t === 'conta').length
  p.mandar({ t: 'conta', token: 'token-ana' })
  await esperar()
  assert.equal(p.recebidas.filter((m) => m.t === 'conta').length, antes)
})

test('token gigante não vai para o Supabase', async () => {
  const { sb, autenticar } = autenticadorFalso()
  const { conectar } = montar(autenticar)
  const p = conectar()
  p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: 'HUGO', token: 'x'.repeat(5000) })
  await esperar()
  assert.equal(p.ultima('bemvindo').conta, null)
  assert.equal(sb.chamadas.filter((c) => c.op === 'getUser').length, 0)
})
