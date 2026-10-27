import { test } from 'node:test'
import assert from 'node:assert/strict'
import { luminancia, razaoContraste, passaWcag, misturarSobre, rgb, MINIMO_TEXTO, MINIMO_TEXTO_GRANDE } from '../contraste.js'
import { TEXTO, CORES } from '../constants.js'
import { paletaDaltonismo, MODOS } from '../daltonismo.js'
import { PERSONAGENS } from '../data/personagens.js'
import { TEXTO_JOGADOR } from '../pvp/perfil.js'

// ---------- o helper ----------

test('razões de referência da WCAG', () => {
  assert.equal(razaoContraste('#000000', '#ffffff'), 21)
  assert.equal(razaoContraste(0xffffff, 0xffffff), 1)
  assert.ok(Math.abs(razaoContraste('#767676', '#ffffff') - 4.54) < 0.01, 'o cinza clássico que mal passa no AA')
  assert.ok(Math.abs(razaoContraste('#777', '#fff') - 4.48) < 0.01, 'aceita #rgb')
  assert.equal(razaoContraste('#123456', '#abcdef'), razaoContraste('#abcdef', '#123456'), 'simétrico')
})

test('luminância e conversão de cor', () => {
  assert.equal(luminancia(0x000000), 0)
  assert.equal(luminancia('#ffffff'), 1)
  assert.deepEqual(rgb('#ff8a1a'), [255, 138, 26])
  assert.deepEqual(rgb(0x0b0914), [11, 9, 20])
  assert.throws(() => rgb('azul'), /cor inválida/)
})

test('passaWcag: 4.5 para texto, 3 para texto grande', () => {
  assert.equal(passaWcag(4.5), true)
  assert.equal(passaWcag(4.49), false)
  assert.equal(passaWcag(3.2, { grande: true }), true)
  assert.equal(passaWcag(2.9, { grande: true }), false)
})

test('misturarSobre: alpha 0 = fundo, alpha 1 = frente', () => {
  assert.equal(misturarSobre(0xff0000, 0x0000ff, 1), 0xff0000)
  assert.equal(misturarSobre(0xff0000, 0x0000ff, 0), 0x0000ff)
  assert.equal(misturarSobre(0xffffff, 0x000000, 0.5), 0x808080)
})

// ---------- pares do HUD ----------

const PRETO = 0x000000
const painel = CORES.painel
const exige = (nome, frente, fundo, minimo = MINIMO_TEXTO) => {
  const r = razaoContraste(frente, fundo)
  assert.ok(r >= minimo, `${nome}: ${r.toFixed(2)}:1 (mínimo ${minimo}:1)`)
}

test('textos do jogo (constants.js TEXTO) leem no preto e no painel', () => {
  for (const [nome, cor] of Object.entries(TEXTO)) {
    exige(`TEXTO.${nome} no preto`, cor, PRETO)
    exige(`TEXTO.${nome} no painel`, cor, painel)
  }
})

test('cores soltas do HUD PVP/CO-OP leem no preto (stroke preto de 3px)', () => {
  const hud = {
    'energia (#7fd8ff)': '#7fd8ff',
    'combo (#ffd23c)': '#ffd23c',
    'combo x3 (#ffb02e)': '#ffb02e',
    'combo máx (#ff9ae8)': '#ff9ae8',
    'combo quebrou (#ff6a7a)': '#ff6a7a',
    'velocidade/invertido (#ff9a3a)': '#ff9a3a',
    'treino (#9be7ff)': '#9be7ff',
  }
  for (const [nome, cor] of Object.entries(hud)) exige(nome, cor, PRETO)
})

test('cores de jogador (P1/P2) como texto leem no painel em todos os modos de daltonismo', () => {
  for (const cor of TEXTO_JOGADOR) exige(`TEXTO_JOGADOR ${cor}`, cor, painel)
  for (const modo of MODOS) {
    for (const cor of paletaDaltonismo(modo).textoAlmas) exige(`${modo}: ${cor}`, cor, painel)
  }
})

test('nome do personagem (cor dele) lê no preto da barra', () => {
  for (const [id, p] of Object.entries(PERSONAGENS)) exige(`nome de ${id}`, p.cor, PRETO, MINIMO_TEXTO_GRANDE)
})

test('carta: nome na faixa tingida e o número do custo (com o contorno) leem', () => {
  const PAPEL = 0xfbf6ea
  for (const [id, p] of Object.entries(PERSONAGENS)) exige(`faixa de ${id}`, '#2a2238', misturarSobre(p.cor, PAPEL, 0.2))
  exige('valor vermelho no papel', 0xd42340, PAPEL)
  exige('custo (branco) no contorno azul', '#ffffff', '#06283e')
  exige('custo (branco) no contorno vermelho (bloqueada)', '#ffffff', '#3a0a14')
  exige('selo "×" branco no vermelho', 0xffffff, 0xc81e3c, MINIMO_TEXTO_GRANDE)
})

test('gema de energia vazia: contorno >= 3:1 no preto (elemento gráfico)', () => {
  exige('gemaVazia', CORES.gemaVazia, PRETO, 3)
})

test('status do jogador (cor da alma como texto) lê no painel em todos os modos', () => {
  for (const modo of MODOS) for (const cor of paletaDaltonismo(modo).almas) exige(`${modo}: alma ${cor.toString(16)}`, cor, painel)
})
