// BOSS SEMANAL · ESCURIDÃO: o mapeamento das pistas de som e das pistas visuais (coop/semanal/pistas.js)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pistaDaBala, pistasDasBalas, indicadoresDeBorda, timbreDe, VOZES, TIQUE, FREQ, ALCANCE, AVISO_SOM_MS } from '../semanal/pistas.js'

const caixa = { left: 100, right: 400, top: 100, bottom: 300, width: 300, height: 200 }
const coracao = { x: 250, y: 200 }
const bala = (extra) => ({ tipo: 'circulo', raio: 6, x: 250, y: 200, vx: 0, vy: 0, idade: 1000, aviso: 0, origem: 'aimed', ...extra })

test('panorâmica = posição horizontal em relação ao MEU coração', () => {
  assert.equal(pistaDaBala(bala({ x: 100 }), coracao, caixa).pan, -1)
  assert.equal(pistaDaBala(bala({ x: 400 }), coracao, caixa).pan, 1)
  assert.equal(pistaDaBala(bala({ x: 250, y: 120 }), coracao, caixa).pan, 0)
  assert.ok(Math.abs(pistaDaBala(bala({ x: 325 }), coracao, caixa).pan - 0.5) < 1e-9)
  // outro coração, mesma bala: outra panorâmica (cada PC ouve o seu)
  assert.equal(pistaDaBala(bala({ x: 250 }), { x: 400, y: 200 }, caixa).pan, -1)
})

test('altura do som = posição vertical (acima do coração = agudo), 2 oitavas', () => {
  const alto = pistaDaBala(bala({ y: 100 }), coracao, caixa).freq
  const meio = pistaDaBala(bala({ x: 300, y: 200 }), coracao, caixa).freq
  const baixo = pistaDaBala(bala({ y: 300 }), coracao, caixa).freq
  assert.ok(alto > meio && meio > baixo)
  assert.equal(meio, FREQ.base)
  assert.equal(alto, FREQ.base * 2)
  assert.equal(baixo, FREQ.base / 2)
})

test('o tique acelera conforme a bala se aproxima; parada e longe não soa', () => {
  const longe = pistaDaBala(bala({ x: 100, vx: 120 }), coracao, caixa)
  const perto = pistaDaBala(bala({ x: 200, vx: 120 }), coracao, caixa)
  const colada = pistaDaBala(bala({ x: 245, vx: 120 }), coracao, caixa)
  assert.ok(longe.tiqueMs > perto.tiqueMs && perto.tiqueMs >= colada.tiqueMs)
  assert.equal(colada.tiqueMs, TIQUE.minMs)
  assert.ok(perto.volume > longe.volume)
  // indo embora e fora do alcance: urgência 0 (fora da mistura)
  assert.equal(pistaDaBala(bala({ x: 90, vx: -150 }), coracao, caixa).urgencia, 0)
  assert.equal(pistasDasBalas([bala({ x: 250 - ALCANCE - 20, vx: -150 })], coracao, caixa).length, 0)
})

test('bala avisando (telegrafo) soa antes de chegar: pelo menos AVISO_SOM_MS', () => {
  const p = pistaDaBala(bala({ x: 150, idade: 0, aviso: 400 }), coracao, caixa)
  assert.equal(p.chegaMs, 400 + AVISO_SOM_MS)
  assert.ok(p.urgencia > 0)
})

test('timbre por tipo de ataque', () => {
  assert.equal(timbreDe('rain'), 'chiado')
  assert.equal(timbreDe('lasers'), 'zumbido')
  assert.equal(timbreDe('bombas'), 'tambor')
  assert.equal(timbreDe('rain + lasers'), 'chiado')
  assert.equal(timbreDe('aimed'), 'sino')
  // laser (retângulo): conta o ponto da borda dele mais perto do coração
  const laser = pistaDaBala(bala({ tipo: 'retangulo', largura: 300, altura: 20, x: 250, y: 260, origem: 'lasers' }), coracao, caixa)
  assert.equal(laser.timbre, 'zumbido')
  assert.equal(laser.y, 250)
})

test('limite de vozes: só as VOZES mais urgentes, a mais urgente primeiro', () => {
  const muitas = Array.from({ length: 12 }, (_, i) => bala({ x: 120 + i * 10, vx: 100 }))
  const vozes = pistasDasBalas(muitas, coracao, caixa)
  assert.equal(vozes.length, VOZES)
  for (let i = 1; i < vozes.length; i++) assert.ok(vozes[i - 1].urgencia >= vozes[i].urgencia)
  assert.ok(vozes.every((v) => v.x >= 190), 'as mais perto do coração')
  assert.equal(pistasDasBalas([bala({ x: 200, morta: true })], coracao, caixa).length, 0)
})

test('pistas visuais: a seta fica na borda, na direção da bala, intensidade = urgência', () => {
  const vozes = pistasDasBalas([bala({ x: 150, vx: 100 }), bala({ x: 250, y: 140, vy: 100 })], coracao, caixa)
  const setas = indicadoresDeBorda(vozes, coracao, caixa)
  const esq = setas.find((s) => s.x === caixa.left)
  const cima = setas.find((s) => s.y === caixa.top)
  assert.ok(esq && Math.abs(esq.y - 200) < 1e-6)
  assert.ok(cima && Math.abs(cima.x - 250) < 1e-6)
  for (const [s, v] of setas.map((s, i) => [s, vozes[i]])) assert.equal(s.intensidade, v.urgencia)
})
