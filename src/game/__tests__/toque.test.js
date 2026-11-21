// node --test src/game/__tests__/toque.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  joystickDoToque,
  arrastarBase,
  direcaoDigital,
  criarRepetidor,
  criarToque,
  RAIO_PADRAO,
  ZONA_MORTA_TOQUE,
  ALCANCE,
  REPETIR_MENU,
  TOQUE_RAPIDO_MS,
  tamanhoToqueValido,
  opacidadeToqueValida,
} from '../toque.js'
import { resumirFontes } from '../fontes.js'
import { contarFontes } from '../jogadores.js'

const O = { x: 100, y: 200 }
const R = RAIO_PADRAO

test('joystick: parado e dentro da zona morta = 0', () => {
  assert.deepEqual(joystickDoToque(O, O), { x: 0, y: 0 })
  assert.deepEqual(joystickDoToque(O, { x: O.x + R * ZONA_MORTA_TOQUE - 0.5, y: O.y }), { x: 0, y: 0 })
})

test('joystick: analógico, a força recomeça do zero na borda da zona morta e chega a 100 antes da borda', () => {
  const zona = R * ZONA_MORTA_TOQUE
  const logoDepois = joystickDoToque(O, { x: O.x + zona + 1, y: O.y })
  assert.ok(logoDepois.x > 0 && logoDepois.x < 10, `sem tranco: ${logoDepois.x}`)
  const meio = joystickDoToque(O, { x: O.x + (zona + R * ALCANCE) / 2, y: O.y })
  assert.ok(Math.abs(meio.x - 50) <= 1, `meio do caminho ~50: ${meio.x}`)
  assert.deepEqual(joystickDoToque(O, { x: O.x + R * ALCANCE, y: O.y }), { x: 100, y: 0 })
  assert.deepEqual(joystickDoToque(O, { x: O.x - R * 3, y: O.y }), { x: -100, y: 0 }) // passou da borda: satura
  assert.deepEqual(joystickDoToque(O, { x: O.x, y: O.y - R }), { x: 0, y: -100 })
})

test('joystick: diagonal suave (vetor <= 100, ângulo mantido), sem -0', () => {
  const d = joystickDoToque(O, { x: O.x + R, y: O.y + R })
  assert.equal(d.x, d.y)
  assert.ok(Math.abs(Math.hypot(d.x, d.y) - 100) <= 1.5, `módulo ~100: ${Math.hypot(d.x, d.y)}`)
  // ângulo qualquer: a direção sai igual à do dedo
  for (const ang of [0.3, 1.1, 2.5, 4, 5.5]) {
    const v = joystickDoToque(O, { x: O.x + Math.cos(ang) * R * 0.6, y: O.y + Math.sin(ang) * R * 0.6 })
    assert.ok(Math.abs(Math.atan2(v.y, v.x) - Math.atan2(Math.sin(ang), Math.cos(ang))) < 0.05, `ângulo ${ang}`)
    assert.ok(Math.hypot(v.x, v.y) <= 101)
  }
  assert.ok(!Object.is(joystickDoToque(O, { x: O.x, y: O.y + R }).x, -0))
  // raio inválido não quebra
  assert.deepEqual(joystickDoToque(O, { x: 500, y: 500 }, { raio: 0 }), { x: 0, y: 0 })
})

test('joystick flutuante: o dedo passou da borda, a base vem junto', () => {
  assert.equal(arrastarBase(O, { x: O.x + R - 1, y: O.y }, R), O)
  const nova = arrastarBase(O, { x: O.x + R + 30, y: O.y }, R)
  assert.deepEqual(nova, { x: O.x + 30, y: O.y })
  const diag = arrastarBase({ x: 0, y: 0 }, { x: 300, y: 400 }, 100) // 500 de distância
  assert.ok(Math.abs(Math.hypot(300 - diag.x, 400 - diag.y) - 100) < 1e-9)
})

test('direção digital (menus): limiar, eixo dominante e histerese perto da diagonal', () => {
  assert.equal(direcaoDigital(0, 0), null)
  assert.equal(direcaoDigital(49, 0), null)
  assert.equal(direcaoDigital(60, 0), 'direita')
  assert.equal(direcaoDigital(-60, 10), 'esquerda')
  assert.equal(direcaoDigital(10, -60), 'cima')
  assert.equal(direcaoDigital(10, 70), 'baixo')
  // segurando direita e escorregando para a diagonal: continua direita
  assert.equal(direcaoDigital(70, 75, 'direita'), 'direita')
  assert.equal(direcaoDigital(60, 74, 'direita'), 'direita')
  // o outro eixo passou com folga: troca
  assert.equal(direcaoDigital(50, 80, 'direita'), 'baixo')
  // só solta bem abaixo do limiar
  assert.equal(direcaoDigital(35, 0, 'direita'), 'direita')
  assert.equal(direcaoDigital(25, 0, 'direita'), null)
  // virou para o lado oposto: troca na hora
  assert.equal(direcaoDigital(-80, 0, 'direita'), 'esquerda')
})

test('repetição dos menus: aperta na hora, repete depois da espera e a cada intervalo, para ao soltar', () => {
  const r = criarRepetidor()
  const { espera, intervalo } = REPETIR_MENU
  assert.equal(r.passo('baixo', 0), 'baixo')
  assert.equal(r.passo('baixo', 16), null)
  assert.equal(r.passo('baixo', espera - 1), null)
  assert.equal(r.passo('baixo', espera), 'baixo')
  assert.equal(r.passo('baixo', espera + intervalo - 1), null)
  assert.equal(r.passo('baixo', espera + intervalo), 'baixo')
  assert.equal(r.passo(null, espera + intervalo + 5), null) // soltou
  assert.equal(r.passo('baixo', 2000), 'baixo') // de novo: na hora
  assert.equal(r.passo('cima', 2010), 'cima') // trocou de direção: na hora
  // quadro muito longo (celular engasgou): uma repetição só, nada de rajada
  const r2 = criarRepetidor({ espera: 100, intervalo: 50 })
  r2.passo('direita', 0)
  assert.equal(r2.passo('direita', 1000), 'direita')
  assert.equal(r2.passo('direita', 1010), null)
})

function novoToque() {
  const linhas = []
  const vibrou = []
  const toque = criarToque({ enviar: (l) => linhas.push(l), vibrar: (t) => vibrou.push(t) })
  return { toque, linhas, vibrou }
}

test('toque: o joystick manda JOY do jogador 1 (só quando muda) e zera ao soltar', () => {
  const { toque, linhas } = novoToque()
  assert.equal(toque.apertar(1, 'joystick', 100, 100, 0), true)
  assert.deepEqual(linhas, []) // encostar não mexe
  toque.mover(1, 100 + R, 100)
  toque.mover(1, 100 + R, 100) // igual: não repete a linha
  assert.deepEqual(linhas, ['JOY 1 100 0'])
  assert.equal(toque.segurando(), true)
  toque.soltar(1, 500)
  assert.deepEqual(linhas, ['JOY 1 100 0', 'JOY 1 0 0'])
  assert.equal(toque.segurando(), false)
  assert.equal(toque.estado().joystick, null)
})

test('toque: multitoque, joystick e A/B ao mesmo tempo, cada dedo com o seu id', () => {
  const { toque, linhas, vibrou } = novoToque()
  toque.apertar(1, 'joystick', 50, 300, 0)
  toque.mover(1, 50, 300 - R) // cima
  toque.apertar(2, 'A', 700, 300, 10) // o polegar direito aperta A sem soltar o joystick
  toque.mover(1, 50 + R, 300) // continua mexendo
  toque.apertar(3, 'B', 650, 350, 20) // e um terceiro dedo no B
  assert.deepEqual(linhas, ['JOY 1 0 -100', 'BTN 1 A', 'JOY 1 100 0', 'BTN 1 B'])
  assert.deepEqual([...toque.estado().botoes].sort(), ['A', 'B'])
  toque.soltar(2, 30) // soltar A não mexe no joystick
  assert.equal(toque.estado().joystick.x, 100)
  assert.deepEqual([...toque.estado().botoes], ['B'])
  // um segundo dedo no lado do joystick não rouba o primeiro
  assert.equal(toque.apertar(4, 'joystick', 80, 300, 40), false)
  toque.mover(4, 80, 300 + R)
  assert.equal(toque.estado().joystick.x, 100)
  assert.ok(vibrou.includes('botao') && vibrou.includes('direcao'))
  toque.soltarTudo()
  assert.equal(linhas.at(-1), 'JOY 1 0 0')
  assert.equal(toque.estado().botoes.size, 0)
})

test('toque: dois dedos no mesmo botão apertam uma vez; alvo desconhecido é ignorado', () => {
  const { toque, linhas } = novoToque()
  toque.apertar(1, 'A', 0, 0)
  toque.apertar(2, 'A', 0, 0)
  toque.apertar(3, 'C', 0, 0)
  toque.apertar(4, 'X', 0, 0)
  assert.deepEqual(linhas, ['BTN 1 A', 'BTN 1 C'])
})

test('toque rápido sem inclinar o joystick vale como toque na tela (escolher no menu)', () => {
  const { toque, linhas } = novoToque()
  toque.apertar(1, 'joystick', 100, 100, 1000)
  toque.mover(1, 102, 101) // tremidinha dentro da zona morta
  assert.deepEqual(toque.soltar(1, 1000 + TOQUE_RAPIDO_MS - 50), { tocou: true })
  assert.deepEqual(linhas, []) // nem JOY saiu
  // segurou demais: não é toque
  toque.apertar(1, 'joystick', 100, 100, 0)
  assert.deepEqual(toque.soltar(1, TOQUE_RAPIDO_MS + 100), { tocou: false })
  // inclinou: não é toque
  toque.apertar(1, 'joystick', 100, 100, 0)
  toque.mover(1, 100 + R, 100)
  toque.mover(1, 100, 100)
  assert.deepEqual(toque.soltar(1, 50), { tocou: false })
  // soltar um dedo que não é do joystick
  assert.deepEqual(toque.soltar(9, 0), { tocou: false })
})

test('toque: raio vem das preferências (TAMANHO) a cada movimento', () => {
  let raio = 40
  const linhas = []
  const toque = criarToque({ enviar: (l) => linhas.push(l), raio: () => raio })
  toque.apertar(1, 'joystick', 0, 0)
  toque.mover(1, 40 * ALCANCE, 0)
  assert.equal(linhas.at(-1), 'JOY 1 100 0')
  raio = 80
  toque.mover(1, 40 * ALCANCE, 0)
  assert.ok(Number(linhas.at(-1).split(' ')[2]) < 60)
})

test('preferências do toque: limites de tamanho e opacidade', () => {
  assert.ok(tamanhoToqueValido(1) && tamanhoToqueValido(0.7) && tamanhoToqueValido(1.5))
  assert.ok(!tamanhoToqueValido(0.5) && !tamanhoToqueValido(2) && !tamanhoToqueValido('1') && !tamanhoToqueValido(NaN))
  assert.ok(opacidadeToqueValida(0.55) && opacidadeToqueValida(0.2) && opacidadeToqueValida(0.9))
  assert.ok(!opacidadeToqueValida(0) && !opacidadeToqueValida(1))
})

test('fonte "toque": liga o jogo como as outras, mas nunca vira o 2º jogador', () => {
  assert.deepEqual(resumirFontes({ toque: true }), { conectado: true, fonte: 'toque' })
  assert.deepEqual(resumirFontes({ toque: true, teclado: true }), { conectado: true, fonte: 'teclado' })
  // o detector de jogadores só conta teclado, controles e joysticks serial
  // (toque + 1 controle = 1 fonte: o controle no celular não chama o 2º jogador por causa da tela)
  assert.equal(contarFontes({ toque: true, teclado: false, pads: 1, serial: 0 }), 1)
})
