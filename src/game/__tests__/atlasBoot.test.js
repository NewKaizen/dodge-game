import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planejarAtlas, LADO_ATLAS, FORA_DO_ATLAS } from '../arte/texturas.js'

// o atlas do boot (arte/texturas.js): todos os desenhos entram, nenhum se cruza (com a borda repetida em volta),
// nada passa da página
test('atlas do boot: prateleiras sem sobreposição, dentro da página', () => {
  const tamanhos = []
  for (let i = 0; i < 300; i++) tamanhos.push({ chave: `k${i}`, w: 4 + ((i * 37) % 120), h: 4 + ((i * 53) % 90) })
  const lugares = planejarAtlas(tamanhos, 512)
  assert.equal(lugares.length, tamanhos.length)
  assert.deepEqual(new Set(lugares.map((l) => l.chave)).size, tamanhos.length)
  const porPagina = new Map()
  for (const l of lugares) {
    assert.ok(l.x >= 1 && l.y >= 1 && l.x + l.w + 1 <= 512 && l.y + l.h + 1 <= 512, `${l.chave} fora da página`)
    const t = tamanhos.find((t) => t.chave === l.chave)
    assert.equal(l.w, t.w)
    assert.equal(l.h, t.h)
    if (!porPagina.has(l.pagina)) porPagina.set(l.pagina, [])
    porPagina.get(l.pagina).push(l)
  }
  assert.ok(porPagina.size > 1, 'muitos desenhos: mais de uma página')
  // com a borda de 1 px de cada um, os retângulos expandidos não se cruzam
  for (const lista of porPagina.values()) {
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i]
        const b = lista[j]
        const cruza = a.x - 1 < b.x + b.w + 1 && b.x - 1 < a.x + a.w + 1 && a.y - 1 < b.y + b.h + 1 && b.y - 1 < a.y + a.h + 1
        assert.ok(!cruza, `${a.chave} cruza ${b.chave}`)
      }
    }
  }
})

test('atlas do boot: a página padrão e as que ficam fora', () => {
  assert.equal(LADO_ATLAS, 2048)
  // lidas como imagem, com filtro próprio ou repetidas (TileSprite): textura própria
  for (const k of ['coracao', 'carta-brilho', 'vinheta', 'fundo-king-losangos']) assert.ok(FORA_DO_ATLAS.has(k), k)
})
