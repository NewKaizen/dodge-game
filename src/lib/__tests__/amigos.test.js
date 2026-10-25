import { test } from 'node:test'
import assert from 'node:assert/strict'
import { get } from 'svelte/store'
import { agrupar, amigos, perfilDaLinha, aoMensagem, MAX_CONVITES_NA_TELA } from '../amigos.js'
import { aoServidor } from '../lan/rede.js'

const linha = (relacao, id, extra = {}) => ({ relacao, id, tag: `${id}#1000`, nome_exibicao: id.toUpperCase(), avatar_tipo: 'padrao', avatar_id: null, avatar_url: null, titulo_equipado: null, nivel: 2, xp: 10, desde: '2026-10-25T00:00:00Z', ...extra })

test('agrupar: separa amigos, pedidos recebidos e enviados', () => {
  const g = agrupar([linha('amigo', 'ana'), linha('recebido', 'beto'), linha('enviado', 'caio'), linha('amigo', 'dani'), linha('estranho', 'x')])
  assert.deepEqual(g.amigos.map((p) => p.id), ['ana', 'dani'])
  assert.deepEqual(g.recebidos.map((p) => p.id), ['beto'])
  assert.deepEqual(g.enviados.map((p) => p.id), ['caio'])
  assert.deepEqual(agrupar(null), { amigos: [], recebidos: [], enviados: [] })
})

test('perfilDaLinha: só o público, com avatar normalizado', () => {
  const p = perfilDaLinha(linha('amigo', 'ana', { avatar_tipo: 'jogo', avatar_id: 'kris' }))
  assert.deepEqual(p.avatar, { tipo: 'jogo', id: 'kris', url: null })
  assert.equal(p.nome, 'ANA')
  assert.equal(p.tag, 'ana#1000')
  assert.equal(p.xp, undefined)
  // avatar inválido cai no padrão
  assert.equal(perfilDaLinha(linha('amigo', 'x', { avatar_tipo: 'jogo', avatar_id: 'hacker' })).avatar.tipo, 'padrao')
})

test('o store começa vazio e sem ninguém online', () => {
  const s = get(amigos)
  assert.deepEqual([s.amigos, s.convites, s.presenca], [[], [], {}])
  assert.equal(typeof aoServidor, 'function')
})

test('mensagens do servidor: presença, convites e queda da conexão', () => {
  aoMensagem({ t: 'presencas', mapa: { a: 'disponivel', b: 'em_partida' } })
  aoMensagem({ t: 'presenca', id: 'a', status: 'offline' })
  assert.deepEqual(get(amigos).presenca, { b: 'em_partida' })

  const de = { id: 'u1', tag: 'ana#1000', nome: 'ANA', avatar: { tipo: 'padrao' } }
  aoMensagem({ t: 'convite', id: 'c1', de, modo: 'pvp', expiraEm: 1, restanteMs: 60_000 })
  aoMensagem({ t: 'convite', id: 'c1', de, modo: 'pvp', restanteMs: 60_000 }) // repetido
  assert.equal(get(amigos).convites.length, 1)
  const resta = get(amigos).convites[0].ate - Date.now()
  assert.ok(resta > 59_000 && resta <= 60_000)
  for (const id of ['c2', 'c3', 'c4', 'c5']) aoMensagem({ t: 'convite', id, de, modo: 'pvp' })
  assert.equal(get(amigos).convites.length, MAX_CONVITES_NA_TELA, 'não enche a tela')
  aoMensagem({ t: 'conviteFim', id: 'c1' })
  assert.equal(get(amigos).convites.some((c) => c.id === 'c1'), false)

  aoMensagem({ t: 'conviteNegado', msg: 'esse amigo não está disponível' })
  assert.equal(get(amigos).erro, 'esse amigo não está disponível')
  aoMensagem({ t: 'conviteEnviado', id: 'x', para: 'u9' })
  assert.ok(get(amigos).pendentes.u9)
  aoMensagem({ t: 'conviteResposta', id: 'x', para: 'u9', resultado: 'recusado' })
  assert.equal(get(amigos).pendentes.u9, undefined)
  assert.match(get(amigos).aviso, /recusou/)

  aoMensagem({ t: '_fechou' })
  assert.deepEqual([get(amigos).presenca, get(amigos).convites], [{}, []])
})
