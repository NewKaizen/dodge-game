import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarVigiaDireto, MUDO_APOS_MS, VIVO_MS } from '../lan/vigiaDireto.js'

test('canal direto fechado nunca é mudo (tudo já vai pelo servidor)', () => {
  let t = 0
  const v = criarVigiaDireto({ agora: () => t })
  t = 60_000
  assert.equal(v.mudo(), false)
  assert.equal(v.ok(1), false, 'resposta sem canal aberto não vale')
})

test('aberto e respondendo: não é mudo', () => {
  let t = 0
  const v = criarVigiaDireto({ agora: () => t })
  v.abriu()
  for (let i = 0; i < 10; i++) {
    const n = v.vivo()
    t += VIVO_MS
    assert.equal(v.ok(n), true)
    assert.equal(v.mudo(), false)
  }
})

test('aberto sem nenhuma resposta: mudo depois de MUDO_APOS_MS; volta com a resposta', () => {
  let t = 0
  const v = criarVigiaDireto({ agora: () => t })
  v.abriu()
  let n
  for (; t < MUDO_APOS_MS; t += VIVO_MS) {
    assert.equal(v.mudo(), false, 'ainda dentro do prazo')
    n = v.vivo()
  }
  t = MUDO_APOS_MS
  assert.equal(v.mudo(), true)
  // o direto voltou a entregar
  assert.equal(v.ok(n), true)
  assert.equal(v.mudo(), false)
})

test('parou de responder no meio: fica mudo', () => {
  let t = 0
  const v = criarVigiaDireto({ agora: () => t })
  v.abriu()
  v.ok(v.vivo())
  t += MUDO_APOS_MS - 1
  assert.equal(v.mudo(), false)
  t += 1
  assert.equal(v.mudo(), true)
})

test('conexão nova: resposta de um vivo do canal velho não vale', () => {
  let t = 0
  const v = criarVigiaDireto({ agora: () => t })
  v.abriu()
  const velho = v.vivo()
  v.fechou()
  v.abriu()
  t = MUDO_APOS_MS
  assert.equal(v.ok(velho), false)
  assert.equal(v.mudo(), true)
})
