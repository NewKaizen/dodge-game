// A parte PURA (sem Phaser) dos bônus da arena PRAIA (os do CAFÉ FRANCÊS ficam em eventos/cafe/planos.js): sorteios dos
// planos, trajetos e as contas de empurrão. Os eventos (onda.js, caranguejos.js,
// bola.js) só desenham e criam as balas em cima destes planos,
// que são testados em Node (pvp/__tests__/praiaCafe.test.js): repetíveis pela semente
// (o `sorte` é o rng do evento, igual nos dois PCs em rede), sempre com aviso e com saída.
//
// `l` é o retângulo da caixa: { left, right, top, bottom, width, height }.

import { CORACAO } from '../../../constants.js'

const entre = (sorte, a, b) => a + (b - a) * sorte()
export const lado = (sorte) => (sorte() < 0.5 ? 1 : -1)

// o coração anda no máximo isto (px/s): a conta de "dá tempo de chegar na saída"
export const VEL_CORACAO = CORACAO.velocidadePadrao

// ---------- ONDA GIGANTE (praia) ----------
// Uma parede de água varre a caixa de um lado ao outro. Sempre sobra um VÃO (a água
// "abre" ali); o vão do onda seguinte fica a no máximo ALCANCE do anterior, para dar
// tempo de chegar até ele durante o aviso.
export const ONDA = { avisoMs: 1300, velocidade: 205, vao: 66, largura: 44, alcance: 74, pausaMs: { min: 1300, max: 1900 }, primeira: { min: 500, max: 1000 } }

// { lado: 1 (entra pela esquerda) | -1, vaoY: centro do vão }
export function planejarOnda(sorte, l, anterior = null, cfg = ONDA) {
  const minimo = l.top + cfg.vao / 2 + 2
  const maximo = l.bottom - cfg.vao / 2 - 2
  const a = anterior ? Math.max(minimo, anterior.vaoY - cfg.alcance) : minimo
  const b = anterior ? Math.min(maximo, anterior.vaoY + cfg.alcance) : maximo
  return { lado: lado(sorte), vaoY: entre(sorte, a, Math.max(a, b)) }
}

// os blocos de água (faixas verticais) em volta do vão: [{ y0, y1 }]
export function blocosDaOnda(l, vaoY, cfg = ONDA) {
  const topoVao = vaoY - cfg.vao / 2
  const baseVao = vaoY + cfg.vao / 2
  const blocos = []
  if (topoVao - l.top > 2) blocos.push({ y0: l.top, y1: topoVao })
  if (l.bottom - baseVao > 2) blocos.push({ y0: baseVao, y1: l.bottom })
  return blocos
}

// ---------- CARANGUEJOS (praia) ----------
// Anda de lado por uma fileira; de vez em quando PARA, abre as pinças (aviso) e BELISCA
// (a pinça alcança um anel maior em volta do corpo por um instante).
export const CARANGUEJO = { raioCorpo: 8, raioPinca: 24, velocidade: { min: 58, max: 80 }, andaMs: { min: 850, max: 1300 }, abreMs: 520, beliscaMs: 220, fileiras: 3, intervaloMs: { min: 1500, max: 2100 } }

// { lado, y, vel, andaMs: [..] } (a duração de cada caminhada antes de beliscar)
export function planejarCaranguejo(sorte, l, outrosY = [], cfg = CARANGUEJO) {
  let y = entre(sorte, l.top + 16, l.bottom - 16)
  for (let k = 0; k < 8; k++) {
    if (outrosY.every((o) => Math.abs(o - y) >= 40)) break
    y = entre(sorte, l.top + 16, l.bottom - 16)
  }
  return {
    lado: lado(sorte),
    y,
    vel: entre(sorte, cfg.velocidade.min, cfg.velocidade.max),
    andaMs: [entre(sorte, cfg.andaMs.min, cfg.andaMs.max), entre(sorte, cfg.andaMs.min, cfg.andaMs.max), entre(sorte, cfg.andaMs.min, cfg.andaMs.max)],
  }
}

// Em que pé está o caranguejo `idade` ms depois de nascer.
//   { fase: 'anda' | 'abre' | 'belisca', k: índice do ciclo, p: 0..1 dentro da fase, andou: ms andando }
export function faseDoCaranguejo(plano, idade, cfg = CARANGUEJO) {
  let t = idade
  let andou = 0
  for (let k = 0; ; k++) {
    const anda = plano.andaMs[k % plano.andaMs.length]
    if (t < anda) return { fase: 'anda', k, p: t / anda, andou: andou + t }
    t -= anda
    andou += anda
    if (t < cfg.abreMs) return { fase: 'abre', k, p: t / cfg.abreMs, andou }
    t -= cfg.abreMs
    if (t < cfg.beliscaMs) return { fase: 'belisca', k, p: t / cfg.beliscaMs, andou }
    t -= cfg.beliscaMs
  }
}

// x do caranguejo (andou = ms de caminhada acumulada); `x0` é onde ele nasce
export const xDoCaranguejo = (plano, x0, andou) => x0 + plano.lado * plano.vel * (andou / 1000)

// ---------- BOLA DE PRAIA (praia) ----------
// Uma bola quica pela caixa em linha reta (a trajetória NÃO depende do coração: igual
// nos dois PCs em rede). Encostou nela? A bola empurra o coração para longe; não dá
// dano, o perigo é ser jogado nas balas.
export const BOLA = { raio: 15, velocidade: 125, forca: 135, quedaMs: 800, folga: 3 }

export function planejarBola(sorte, l, cfg = BOLA) {
  const x = entre(sorte, l.left + cfg.raio + 6, l.right - cfg.raio - 6)
  const y = entre(sorte, l.top + cfg.raio + 6, l.bottom - cfg.raio - 6)
  // ângulo longe dos eixos (nem só horizontal, nem só vertical)
  const base = entre(sorte, 22, 68) * (Math.PI / 180)
  const quadrante = Math.floor(sorte() * 4)
  const ang = base + (quadrante * Math.PI) / 2
  return { x, y, vx: Math.cos(ang) * cfg.velocidade, vy: Math.sin(ang) * cfg.velocidade }
}

// anda a bola `dt` ms e quica nas paredes da caixa (muda `b` no lugar e devolve true se quicou)
export function andarBola(b, dt, l, cfg = BOLA) {
  let quicou = false
  b.x += (b.vx * dt) / 1000
  b.y += (b.vy * dt) / 1000
  const r = cfg.raio
  if (b.x < l.left + r) {
    b.x = l.left + r
    b.vx = Math.abs(b.vx)
    quicou = true
  } else if (b.x > l.right - r) {
    b.x = l.right - r
    b.vx = -Math.abs(b.vx)
    quicou = true
  }
  if (b.y < l.top + r) {
    b.y = l.top + r
    b.vy = Math.abs(b.vy)
    quicou = true
  } else if (b.y > l.bottom - r) {
    b.y = l.bottom - r
    b.vy = -Math.abs(b.vy)
    quicou = true
  }
  return quicou
}

// Quanto a bola soma ao direcional (-100..100) do coração em (cx, cy): empurrão para
// longe do centro dela, só enquanto encosta. { x, y } (zeros se não encosta)
export function empurraoDaBola(b, cx, cy, hitbox = CORACAO.hitbox, cfg = BOLA) {
  const dx = cx - b.x
  const dy = cy - b.y
  const d = Math.hypot(dx, dy)
  const alcance = cfg.raio + hitbox + cfg.folga
  if (d >= alcance) return { x: 0, y: 0 }
  if (d < 0.001) return { x: cfg.forca, y: 0 }
  return { x: (dx / d) * cfg.forca, y: (dy / d) * cfg.forca }
}

// o vão de um bando/onda é seguro: dá para chegar ao centro do vão durante o aviso
// (de qualquer ponto da caixa vindo do vão anterior)
export const alcancavel = (distancia, avisoMs, velocidade = VEL_CORACAO) => (distancia / velocidade) * 1000 <= avisoMs
