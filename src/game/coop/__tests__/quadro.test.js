// node --test src/game/coop/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QUADRO, inicioDoCoracao } from '../quadro.js'
import { LARGURA, ALTURA, CORACAO } from '../../constants.js'

const limites = { x: QUADRO.x - QUADRO.largura / 2, y: QUADRO.y - QUADRO.altura / 2, width: QUADRO.largura, height: QUADRO.altura }
limites.bottom = limites.y + limites.height

test('o quadro único cabe no campo, embaixo do chefe e acima do nome do ataque', () => {
  const { campo, faixa } = QUADRO
  assert.ok(limites.x >= campo.esquerda && limites.x + limites.width <= campo.direita)
  assert.ok(limites.y >= campo.topo && limites.bottom <= campo.base)
  // o sprite do chefe (no meio da mesa, y 196, escala 4) termina por volta de y 250
  assert.ok(campo.topo >= 250, `o quadro sobe até ${campo.topo}: cobre o chefe`)
  assert.ok(campo.base <= ALTURA - 20, 'sobra uma linha embaixo para o nome do ataque')
  // a faixa de aproximação contém o campo e não sai da tela
  assert.ok(faixa.esquerda <= campo.esquerda && faixa.direita >= campo.direita && faixa.topo <= campo.topo && faixa.base >= campo.base)
  assert.ok(faixa.esquerda >= 0 && faixa.direita <= LARGURA && faixa.base <= ALTURA)
  // maior que a caixa de um jogador (220 x 170 no PvP)
  assert.ok(QUADRO.largura > 220 && QUADRO.altura >= 170)
})

test('os dois corações começam lado a lado, dentro do quadro e longe um do outro', () => {
  const a = inicioDoCoracao(limites, 0)
  const b = inicioDoCoracao(limites, 1)
  assert.ok(a.x < b.x)
  assert.equal(a.y, b.y)
  assert.ok(b.x - a.x > CORACAO.graze * 4)
  for (const p of [a, b]) assert.ok(p.x > limites.x && p.x < limites.x + limites.width && p.y < limites.bottom && p.y > limites.y)
})
