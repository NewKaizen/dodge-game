import { ATAQUE } from '../constants.js'

// As REGRAS de movimento e colisão das balas e do coração, sem Phaser: a fonte única que
// entities/Bullets.js (Balas) e entities/Heart.js usam, e que o Manual do Ralsei (manual/onda.js)
// usa também. Assim o tutorial nunca "copia" regra: muda aqui, muda nos dois
// (manual/__tests__/paridade.test.js roda as classes reais lado a lado com o manual).
//
// `l` é o retângulo da caixa no formato do Phaser (left, right, top, bottom).
//
//   passoDoCoracao(c, joy, velocidade, dt, l, meio)   Heart.update: joy -100..100, vetor limitado a 1
//   avisoDaBala(o, l)             ms de aviso (parada e inofensiva) de uma bala nova (opções de a.bala)
//   andarBala(b, dt, fator, max)  arranque, aceleração, teto de velocidade e o passo (Balas.atualizar)
//   quicarNaCaixa(b, l)           rebate nas paredes (opção quicar)
//   longeDaCaixa(b, l)            passou MARGEM_FORA px da caixa: some
//   foraDaCaixa(b, l)             a bala INTEIRA ainda está fora da caixa (não acerta nem grazeia)
//   folgaDaBala(b, px, py)        distância do ponto à borda da bala (negativa = dentro)
//   acerta(b, c, l)               a bala acerta o coração c ({ x, y, hitbox })?
//   entrada(l, x, y, vx, vy)      onde a reta entra na caixa · distanciaFora(l, x, y)

export const MARGEM_FORA = 160 // distância fora da caixa em que a bala é removida

const limitar = (v, min, max) => Math.max(min, Math.min(max, v)) // = Phaser.Math.Clamp

// O passo do coração (Heart.update). `meio` = metade do tamanho do coração (não sai da caixa).
export function passoDoCoracao(c, joy, velocidade, dt, l, meio) {
  let dx = (joy?.x ?? 0) / 100
  let dy = (joy?.y ?? 0) / 100
  // Limita o vetor a comprimento 1 para a diagonal não ser mais rápida
  const m = Math.hypot(dx, dy)
  if (m > 1) {
    dx /= m
    dy /= m
  }
  const passo = velocidade * (dt / 1000)
  c.x = limitar(c.x + dx * passo, l.left + meio, l.right - meio)
  c.y = limitar(c.y + dy * passo, l.top + meio, l.bottom - meio)
  return c
}

export const dentroDaCaixa = (l, x, y) => x >= l.left && x <= l.right && y >= l.top && y <= l.bottom

// Quanto (px) o ponto está fora do retângulo (0 = dentro ou na borda)
export function distanciaFora(l, x, y) {
  return Math.max(l.left - x, x - l.right, l.top - y, y - l.bottom, 0)
}

// Ponto em que a reta (x, y) + t·(vx, vy) entra no retângulo
export function entrada(l, x, y, vx, vy) {
  let tMin = 0
  let tMax = Infinity
  for (const [p, v, min, max] of [
    [x, vx, l.left, l.right],
    [y, vy, l.top, l.bottom],
  ]) {
    if (Math.abs(v) < 1e-6) {
      if (p < min || p > max) return { x, y }
      continue
    }
    let t1 = (min - p) / v
    let t2 = (max - p) / v
    if (t1 > t2) [t1, t2] = [t2, t1]
    tMin = Math.max(tMin, t1)
    tMax = Math.min(tMax, t2)
  }
  if (tMin > tMax) return { x, y }
  return { x: x + vx * tMin, y: y + vy * tMin }
}

// A bala é avisada pelo próprio trajeto? (nasce fora da caixa e entra voando; ver Balas.entrando)
export function balaEntrando(o, l) {
  if (o.entrando === false || o.jaAvisada) return false
  if (o.entrando) return true
  if (o.aviso !== undefined || dentroDaCaixa(l, o.x, o.y)) return false
  const vx = o.vx || o.ax || 0
  const vy = o.vy || o.ay || 0
  if (!vx && !vy) return false
  const ponto = entrada(l, o.x, o.y, vx, vy)
  return ponto.x !== o.x || ponto.y !== o.y
}

// ms em que a bala nova fica parada e inofensiva (o telégrafo)
export function avisoDaBala(o, l) {
  return o.jaAvisada || balaEntrando(o, l) ? 0 : (o.aviso ?? ATAQUE.telegrafoMs)
}

// O passo de uma bala já ativa: arranque, aceleração, teto de velocidade, posição e giro
export function andarBala(b, dt, fator = 1, max = Infinity) {
  const s = dt / 1000
  if (b.arranque && b.idade - b.aviso >= b.arranque.ms) {
    b.vx = b.arranque.vx
    b.vy = b.arranque.vy
    if (b.arranque.ax !== undefined) b.ax = b.arranque.ax
    if (b.arranque.ay !== undefined) b.ay = b.arranque.ay
    b.arranque = null
  }
  b.vx += b.ax * s
  b.vy += b.ay * s
  let vx = b.vx * fator
  let vy = b.vy * fator
  const v = Math.hypot(vx, vy)
  if (v > max) {
    vx *= max / v
    vy *= max / v
  }
  b.x += vx * s
  b.y += vy * s
  if (b.tipo === 'segmento') b.angulo += b.girar * s
}

function rebater(b, eixoV, limite, eixo) {
  b[eixoV] = -b[eixoV]
  b[eixo] = limite
  b.quicar--
}

export function quicarNaCaixa(b, l) {
  const r = b.tipo === 'circulo' ? b.raio : 0
  if (b.x - r < l.left && b.vx < 0) rebater(b, 'vx', l.left + r, 'x')
  else if (b.x + r > l.right && b.vx > 0) rebater(b, 'vx', l.right - r, 'x')
  if (b.quicar <= 0) return
  if (b.y - r < l.top && b.vy < 0) rebater(b, 'vy', l.top + r, 'y')
  else if (b.y + r > l.bottom && b.vy > 0) rebater(b, 'vy', l.bottom - r, 'y')
}

export function longeDaCaixa(b, l) {
  const alcance = MARGEM_FORA + (b.comprimento ?? 0) / 2
  return b.x < l.left - alcance || b.x > l.right + alcance || b.y < l.top - alcance || b.y > l.bottom + alcance
}

// A bala inteira ainda está fora da caixa? (pela caixa que envolve a forma dela)
export function foraDaCaixa(b, l) {
  let mx
  let my
  if (b.tipo === 'circulo') mx = my = b.raio
  else if (b.tipo === 'retangulo') {
    mx = b.largura / 2
    my = b.altura / 2
  } else {
    mx = (Math.abs(Math.cos(b.angulo)) * b.comprimento) / 2 + b.espessura / 2
    my = (Math.abs(Math.sin(b.angulo)) * b.comprimento) / 2 + b.espessura / 2
  }
  return b.x + mx < l.left || b.x - mx > l.right || b.y + my < l.top || b.y - my > l.bottom
}

// Distância entre um ponto e a borda da bala (negativa = dentro)
export function folgaDaBala(b, px, py) {
  if (b.tipo === 'circulo') return Math.hypot(px - b.x, py - b.y) - b.raio
  if (b.tipo === 'retangulo') {
    const dx = Math.max(Math.abs(px - b.x) - b.largura / 2, 0)
    const dy = Math.max(Math.abs(py - b.y) - b.altura / 2, 0)
    return Math.hypot(dx, dy)
  }
  const cos = Math.cos(b.angulo)
  const sin = Math.sin(b.angulo)
  const rx = px - b.x
  const ry = py - b.y
  const t = limitar(rx * cos + ry * sin, -b.comprimento / 2, b.comprimento / 2)
  return Math.hypot(rx - t * cos, ry - t * sin) - b.espessura / 2
}

// O acerto de Balas.tocar: só com a bala (em parte) dentro da caixa, pelo miolo do coração
export const acerta = (b, c, l) => !foraDaCaixa(b, l) && folgaDaBala(b, c.x, c.y) <= c.hitbox
