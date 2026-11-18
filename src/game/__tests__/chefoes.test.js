import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHEFOES, QUADROS_IDLE } from '../arte/chefoes.js'
import { pintor } from '../arte/pintor.js'
import { EXPEDICAO } from '../arte/expedicao.js'

// Os chefões do CO-OP (arte/chefoes.js) aparecem na escala 2 centrados em y 196 na arena: o desenho tem de caber
// entre o texto do SUPER do chefe (em cima) e o quadro da esquiva (embaixo), e os quadros da animação parada
// precisam ter o mesmo tamanho (Inimigo.js só troca a textura)
test('cada chefão: quadros do mesmo tamanho, cores válidas e o desenho dentro da faixa da arena', () => {
  for (const [id, desenhar] of Object.entries(CHEFOES)) {
    const quadros = Array.from({ length: QUADROS_IDLE }, (_, q) => desenhar(q))
    const [l, a] = [quadros[0][0].length, quadros[0].length]
    assert.ok(l >= 40 && l <= 64, `${id}: largura ${l}`)
    assert.equal(a, 72, `${id}: altura`)
    for (const [q, g] of quadros.entries()) {
      assert.equal(g.length, a, `${id} q${q}`)
      assert.ok(g.every((linha) => linha.length === l), `${id} q${q}: linhas do mesmo tamanho`)
      assert.ok(g.flat().every((c) => c === null || /^#[0-9a-f]{6}$/.test(c)), `${id} q${q}: cor inválida`)
      const usadas = g.map((linha, y) => (linha.some(Boolean) ? y : -1)).filter((y) => y >= 0)
      assert.ok(usadas[0] >= 1 && usadas.at(-1) <= 67, `${id} q${q}: linhas ${usadas[0]}..${usadas.at(-1)}`)
    }
    // os quadros mudam alguma coisa (senão não há animação)
    assert.notDeepEqual(quadros[0], quadros[1], `${id}: quadro 1 igual ao 0`)
  }
})

// Os lacaios e os tenentes da Expedição (arte/expedicao.js): mesma altura e mesma linha do chão dos chefões, e o
// tamanho conta a hierarquia (o grupo de lacaios é mais baixo que o tenente, que é mais baixo que o chefão)
const LACAIOS = ['king-lacaios', 'queen-lacaios', 'jevil-lacaios', 'lacaios', 'escuridao-lacaios', 'ladra-lacaios']
const TENENTES = ['king-cavaleiro', 'queen-firewall', 'jevil-mestre', 'caminhaoCompactador', 'escuridao-apagavelas', 'ladra-receptador']
test('expedição: lacaios e tenentes em densidade 2, quadros iguais e o desenho no chão dos chefões', () => {
  assert.deepEqual(Object.keys(EXPEDICAO).sort(), [...LACAIOS, ...TENENTES].sort())
  for (const [chave, desenhar] of Object.entries(EXPEDICAO)) {
    const quadros = Array.from({ length: QUADROS_IDLE }, (_, q) => desenhar(q))
    const [l, a] = [quadros[0][0].length, quadros[0].length]
    // o grupo de lacaios cabe entre as cartas da mesa (até 96 x 2 px); o tenente é mais estreito que ele
    assert.ok(l <= (LACAIOS.includes(chave) ? 96 : 60), `${chave}: largura ${l}`)
    assert.equal(a, 72, `${chave}: altura`)
    for (const [q, g] of quadros.entries()) {
      assert.ok(g.every((linha) => linha.length === l), `${chave} q${q}: linhas do mesmo tamanho`)
      assert.ok(g.flat().every((c) => c === null || /^#[0-9a-f]{6}$/.test(c)), `${chave} q${q}: cor inválida`)
      const usadas = g.map((linha, y) => (linha.some(Boolean) ? y : -1)).filter((y) => y >= 0)
      assert.ok(usadas[0] >= 1 && usadas.at(-1) <= 67 && usadas.at(-1) >= 63, `${chave} q${q}: linhas ${usadas[0]}..${usadas.at(-1)}`)
      // o contorno não encosta na borda da textura (senão fica cortado)
      assert.ok(g.every((linha) => !linha[0] && !linha[l - 1]), `${chave} q${q}: encosta na borda`)
      if (LACAIOS.includes(chave)) assert.ok(usadas[0] >= 14, `${chave} q${q}: lacaios altos demais (${usadas[0]})`)
      else assert.ok(usadas[0] <= 10, `${chave} q${q}: tenente baixo demais (${usadas[0]})`)
    }
    assert.notDeepEqual(quadros[0], quadros[1], `${chave}: quadro 1 igual ao 0`)
  }
})

test('pintor: contorno só por fora e deslocamento', () => {
  const p = pintor(6, 6, { dx: 1, dy: 1 })
  p.preencher(p.ret(1, 1, 2, 2), '#ffffff')
  p.contorno('#000000')
  assert.equal(p.grade[2][2], '#ffffff')
  assert.equal(p.grade[3][3], '#ffffff')
  assert.equal(p.grade[1][2], '#000000')
  assert.equal(p.grade[1][1], null) // sem diagonais
  assert.equal(p.grade[2][4], '#000000')
})
