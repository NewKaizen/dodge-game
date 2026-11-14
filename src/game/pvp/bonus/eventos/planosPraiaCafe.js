// A parte PURA (sem Phaser) dos bônus das arenas PRAIA e CAFÉ FRANCÊS: sorteios dos
// planos, trajetos e as contas de empurrão. Os eventos (onda.js, caranguejos.js, bola.js,
// croissants.js, bule.js, pombos.js) só desenham e criam as balas em cima destes planos,
// que são testados em Node (pvp/__tests__/praiaCafe.test.js): repetíveis pela semente
// (o `sorte` é o rng do evento, igual nos dois PCs em rede), sempre com aviso e com saída.
//
// `l` é o retângulo da caixa: { left, right, top, bottom, width, height }.

import { CORACAO } from '../../../constants.js'

const entre = (sorte, a, b) => a + (b - a) * sorte()
const limitar = (v, a, b) => Math.max(a, Math.min(b, v))
export const lado = (sorte) => (sorte() < 0.5 ? 1 : -1)

// o coração anda no máximo isto (px/s): a conta de "dá tempo de chegar na saída"
export const VEL_CORACAO = CORACAO.velocidadePadrao

// ---------- ONDA GIGANTE (praia) ----------
// Uma parede de água varre a caixa de um lado ao outro. Sempre sobra um VÃO (a água
// "abre" ali); o vão do onda seguinte fica a no máximo ALCANCE do anterior, para dar
// tempo de chegar até ele durante o aviso.
export const ONDA = { avisoMs: 1300, velocidade: 205, vao: 66, largura: 36, alcance: 74, pausaMs: { min: 1300, max: 1900 }, primeira: { min: 500, max: 1000 } }

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

// ---------- CROISSANTS VOADORES (café) ----------
// Croissants cruzam a caixa ondulando (seno): saem de fora, com aviso. O trajeto
// desenhado no aviso é o mesmo da bala.
export const CROISSANT = { avisoMs: 850, velocidade: 150, raio: 8, amplitude: { min: 22, max: 44 }, freq: { min: 3.2, max: 4.6 }, intervaloMs: { min: 1250, max: 1750 }, primeiro: { min: 450, max: 950 }, folga: 12 }

// { lado, y0, amp, freq, fase }: o y fica sempre dentro da caixa (com folga)
export function planejarCroissant(sorte, l, cfg = CROISSANT) {
  const maxima = Math.max(8, Math.min(cfg.amplitude.max, l.height / 2 - cfg.folga - cfg.raio))
  const amp = entre(sorte, Math.min(cfg.amplitude.min, maxima), maxima)
  const y0 = entre(sorte, l.top + amp + cfg.folga, l.bottom - amp - cfg.folga)
  return { lado: lado(sorte), y0, amp, freq: entre(sorte, cfg.freq.min, cfg.freq.max), fase: entre(sorte, 0, Math.PI * 2) }
}

// posição do croissant `t` ms depois de começar a andar (x0 = onde nasce)
export function posicaoDoCroissant(p, x0, t, cfg = CROISSANT) {
  const s = t / 1000
  return { x: x0 + p.lado * cfg.velocidade * s, y: p.y0 + p.amp * Math.sin(p.fase + p.freq * s) }
}

// ---------- BULE QUENTE (café) ----------
// O bule apita e 2 a 3 nuvens de vapor aparecem em círculos avisados; depois estouram
// (queimam por um instante). Sempre sobra bastante espaço livre e as nuvens não ficam
// coladas umas nas outras nem na borda de um jeito que feche a caixa.
export const BULE = { avisoMs: 1100, vidaMs: 620, raio: { min: 24, max: 31 }, nuvens: { min: 2, max: 3 }, intervaloMs: { min: 1900, max: 2500 }, primeiro: { min: 600, max: 1000 }, ocupacaoMax: 0.36, mirarCoracao: 0.4 }

// [{ x, y, raio }]
export function planejarVapor(sorte, l, coracao = null, cfg = BULE) {
  const quantas = Math.round(entre(sorte, cfg.nuvens.min, cfg.nuvens.max))
  const nuvens = []
  for (let n = 0; n < quantas; n++) {
    const raio = entre(sorte, cfg.raio.min, cfg.raio.max)
    for (let tentativa = 0; tentativa < 12; tentativa++) {
      let x = entre(sorte, l.left + raio, l.right - raio)
      let y = entre(sorte, l.top + raio, l.bottom - raio)
      if (n === 0 && coracao && sorte() < cfg.mirarCoracao) {
        x = limitar(coracao.x, l.left + raio, l.right - raio)
        y = limitar(coracao.y, l.top + raio, l.bottom - raio)
      }
      // afastada das outras: sempre uma folga de ~30 px entre as bordas
      if (nuvens.every((o) => Math.hypot(o.x - x, o.y - y) >= o.raio + raio + 30)) {
        nuvens.push({ x, y, raio })
        break
      }
    }
  }
  return nuvens
}

export const areaDoVapor = (nuvens) => nuvens.reduce((s, n) => s + Math.PI * n.raio * n.raio, 0)

// ---------- POMBOS (café) ----------
// Um bando cruza a caixa em formação (cunha), sempre com um VÃO por onde passar; o vão
// do bando seguinte fica perto do anterior. Os pombos chegam escalonados (cunha).
export const POMBOS = { avisoMs: 1000, velocidade: 185, raio: 7, vao: 62, alcance: 76, passo: 16, escalonaMs: 70, intervaloMs: { min: 1900, max: 2600 }, primeiro: { min: 500, max: 900 } }

// { lado, vaoY, pombos: [{ y, atraso }] }
export function planejarBando(sorte, l, anterior = null, cfg = POMBOS) {
  const minimo = l.top + cfg.vao / 2 + 2
  const maximo = l.bottom - cfg.vao / 2 - 2
  const a = anterior ? Math.max(minimo, anterior.vaoY - cfg.alcance) : minimo
  const b = anterior ? Math.min(maximo, anterior.vaoY + cfg.alcance) : maximo
  const vaoY = entre(sorte, a, Math.max(a, b))
  const topoVao = vaoY - cfg.vao / 2
  const baseVao = vaoY + cfg.vao / 2
  const pombos = []
  // fileiras de PASSO px nas duas faixas cheias (acima e abaixo do vão)
  for (const [y0, y1] of [[l.top, topoVao], [baseVao, l.bottom]]) {
    for (let y = y0 + cfg.raio + 1; y <= y1 - cfg.raio - 1; y += cfg.passo) pombos.push({ y: y + entre(sorte, -1, 1), atraso: 0 })
  }
  // cunha: quanto mais longe do vão, mais tarde o pombo chega
  for (const p of pombos) p.atraso = Math.round((Math.abs(p.y - vaoY) / l.height) * 5 * cfg.escalonaMs)
  return { lado: lado(sorte), vaoY, pombos }
}

// o vão de um bando/onda é seguro: dá para chegar ao centro do vão durante o aviso
// (de qualquer ponto da caixa vindo do vão anterior)
export const alcancavel = (distancia, avisoMs, velocidade = VEL_CORACAO) => (distancia / velocidade) * 1000 <= avisoMs
