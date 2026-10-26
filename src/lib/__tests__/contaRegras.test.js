import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validarNome, avatarDoPerfil, AVATARES_JOGO } from '../contaRegras.js'

test('nome: aceita letras com acento, números e _ . -', () => {
  assert.deepEqual(validarNome('João'), { ok: true, nome: 'João' })
  assert.deepEqual(validarNome('  ana   maria  '), { ok: true, nome: 'ana maria' })
  assert.deepEqual(validarNome('x_y.z-9'), { ok: true, nome: 'x_y.z-9' })
  assert.equal(validarNome('1234567890123456').ok, true)
})

test('nome: recusa curto, longo e caractere estranho', () => {
  assert.equal(validarNome('ab').ok, false)
  assert.equal(validarNome('   a  ').ok, false)
  assert.equal(validarNome('12345678901234567').ok, false)
  assert.equal(validarNome('<script>').ok, false)
  assert.equal(validarNome('nome\u0000zero').ok, false)
  assert.equal(validarNome('emoji 😀😀').ok, false)
  assert.equal(validarNome(null).ok, false)
  assert.match(validarNome('ab').erro, /pelo menos 3/)
})

test('avatar do perfil cai no padrão quando não serve', () => {
  assert.deepEqual(avatarDoPerfil(null), { tipo: 'padrao', id: null, url: null })
  assert.deepEqual(avatarDoPerfil({ avatar_tipo: 'jogo', avatar_id: 'kris' }), { tipo: 'jogo', id: 'kris', url: null })
  assert.deepEqual(avatarDoPerfil({ avatar_tipo: 'jogo', avatar_id: '../x' }).tipo, 'padrao')
  assert.deepEqual(avatarDoPerfil({ avatar_tipo: 'enviado', avatar_url: null }).tipo, 'padrao')
  assert.equal(avatarDoPerfil({ avatar_tipo: 'enviado', avatar_url: 'https://x/a.webp' }).url, 'https://x/a.webp')
  assert.equal(AVATARES_JOGO.length, 7)
})

test('avatares da trilha de níveis valem no perfil', () => {
  assert.deepEqual(avatarDoPerfil({ avatar_tipo: 'jogo', avatar_id: 'king' }), { tipo: 'jogo', id: 'king', url: null })
})

test('nome ofensivo: a lista barra o óbvio (e as tentativas de disfarce) mas deixa palavras comuns', async () => {
  const { nomeOfensivo } = await import('../palavrasBloqueadas.js')
  for (const ruim of ['Caralho', 'c.a.r.a.l.h.o', 'xxCaralhoxx', 'Put4', 'puta_boy', 'Hitl3r', 'cuzão', 'N1gger']) {
    assert.equal(nomeOfensivo(ruim), true, ruim)
    assert.equal(validarNome(ruim).ok, false, ruim)
  }
  for (const bom of ['Computador', 'Disputa', 'Ana Maria', 'João', 'Shiitake', 'Dickens', 'Analista', 'Kris', 'Susie 2000']) {
    assert.equal(nomeOfensivo(bom), false, bom)
    assert.equal(validarNome(bom).ok, true, bom)
  }
  assert.match(validarNome('Caralho').erro, /não é permitido/)
})
