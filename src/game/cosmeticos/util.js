// Ferramentas comuns dos cosméticos visuais (efeitos de carta, lançamentos e molduras).
// Tudo aqui é movido por UM ouvinte do evento 'update' da cena (sem tweens nem timers soltos):
// destruir o efeito (ou a cena fechar) remove o ouvinte e os objetos, sem sobra entre aberturas
// (as cenas do Phaser são reaproveitadas).
//
//   reduzido()                    true com "reduzir animações" ligado (preferencias.js)
//   quantasParticulas(n)          n com o corte do nível gráfico e do "reduzir", nunca mais que MAX_PARTICULAS
//   garantirTexturas(scene)       desenha UMA vez por jogo as texturas brancas 'cosm-*' (scene.textures.exists)
//   ligarAtualizacao(scene, fn)   fn(tempoMs, dtMs) a cada quadro; devolve { destroy() } (e se desliga no shutdown)
//   enxame(...)                   piscina de partículas (imagens) com tamanho fixo
//   hsl(h, s, l) / misturar(a, b, k) / aleatorio
import { fatores, quantas } from '../acessibilidade.js'
import { menosMovimento } from '../preferencias.js'

export const TAU = Math.PI * 2
export const MAX_PARTICULAS = 40
export const ADD = 'ADD'

export const reduzido = () => {
  try {
    return menosMovimento()
  } catch {
    return false
  }
}

export function quantasParticulas(n) {
  let f = 1
  try {
    f = fatores().particulas
  } catch {}
  const q = quantas(n, reduzido() ? Math.min(f, 0.5) : f)
  return Math.max(2, Math.min(MAX_PARTICULAS, q))
}

export const aleatorio = (a = 0, b = 1) => a + Math.random() * (b - a)
export const limitar = (v, a, b) => Math.min(b, Math.max(a, v))
export const mistura = (a, b, k) => a + (b - a) * k

// 0xRRGGBB entre duas cores
export function misturar(a, b, k) {
  const r = Math.round(mistura((a >> 16) & 255, (b >> 16) & 255, k))
  const g = Math.round(mistura((a >> 8) & 255, (b >> 8) & 255, k))
  const bl = Math.round(mistura(a & 255, b & 255, k))
  return (r << 16) | (g << 8) | bl
}

// h em graus (qualquer valor), s e l de 0 a 1 -> 0xRRGGBB
export function hsl(h, s = 1, l = 0.55) {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255)
}

// ---------- texturas ----------
// Todas brancas (pintadas com setTint); criadas uma vez por jogo.
function tela(scene, chave, w, h, desenhar, linear = true) {
  if (scene.textures.exists(chave)) return
  const t = scene.textures.createCanvas(chave, w, h)
  if (!t) return
  desenhar(t.context, w, h)
  t.refresh()
  t.setFilter?.(linear ? 0 : 1) // 0 = LINEAR, 1 = NEAREST (Phaser.Textures.FilterMode)
}

const brilho = (ctx, w, h, miolo = 0.0) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, w * miolo, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

export function garantirTexturas(scene) {
  if (!scene?.textures) return
  tela(scene, 'cosm-glow', 64, 64, (c, w, h) => brilho(c, w, h))
  tela(scene, 'cosm-ponto', 16, 16, (c) => {
    c.fillStyle = '#fff'
    c.beginPath()
    c.arc(8, 8, 7, 0, TAU)
    c.fill()
  })
  tela(scene, 'cosm-quad', 4, 4, (c) => {
    c.fillStyle = '#fff'
    c.fillRect(0, 0, 4, 4)
  }, false)
  tela(scene, 'cosm-estrela', 32, 32, (c) => {
    c.fillStyle = '#fff'
    c.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2
      const r = i % 2 === 0 ? 15 : 3.6
      c[i ? 'lineTo' : 'moveTo'](16 + Math.cos(a) * r, 16 + Math.sin(a) * r)
    }
    c.closePath()
    c.fill()
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 7)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g
    c.fillRect(0, 0, 32, 32)
  })
  tela(scene, 'cosm-chama', 24, 40, (c) => {
    const g = c.createLinearGradient(0, 40, 0, 0)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.8)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g
    c.beginPath()
    c.moveTo(12, 0)
    c.bezierCurveTo(22, 14, 26, 24, 22, 31)
    c.bezierCurveTo(19, 38, 5, 38, 2, 31)
    c.bezierCurveTo(-2, 24, 3, 14, 12, 0)
    c.fill()
  })
  tela(scene, 'cosm-bolha', 24, 24, (c) => {
    c.strokeStyle = '#fff'
    c.lineWidth = 2
    c.beginPath()
    c.arc(12, 12, 9.5, 0, TAU)
    c.stroke()
    c.fillStyle = 'rgba(255,255,255,0.22)'
    c.fill()
    c.fillStyle = '#fff'
    c.beginPath()
    c.arc(8, 8, 2.4, 0, TAU)
    c.fill()
  })
  tela(scene, 'cosm-folha', 24, 24, (c) => {
    c.fillStyle = '#fff'
    c.beginPath()
    c.moveTo(2, 22)
    c.bezierCurveTo(0, 8, 12, 1, 23, 1)
    c.bezierCurveTo(23, 13, 16, 24, 2, 22)
    c.fill()
    c.strokeStyle = 'rgba(0,0,0,0.35)'
    c.lineWidth = 1.5
    c.beginPath()
    c.moveTo(3, 21)
    c.lineTo(18, 6)
    c.stroke()
  })
  tela(scene, 'cosm-petala', 20, 20, (c) => {
    c.fillStyle = '#fff'
    c.beginPath()
    c.moveTo(10, 19)
    c.bezierCurveTo(-3, 11, 2, 0, 10, 4)
    c.bezierCurveTo(18, 0, 23, 11, 10, 19)
    c.fill()
  })
  tela(scene, 'cosm-coracao', 14, 12, (c) => {
    // coração de pixel 7x6 (2px por pixel)
    const mapa = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000']
    c.fillStyle = '#fff'
    mapa.forEach((l, y) => [...l].forEach((v, x) => v === '1' && c.fillRect(x * 2, y * 2, 2, 2)))
  }, false)
  tela(scene, 'cosm-gota', 16, 24, (c) => {
    c.fillStyle = '#fff'
    c.beginPath()
    c.moveTo(8, 0)
    c.bezierCurveTo(10, 8, 15, 12, 15, 17)
    c.bezierCurveTo(15, 22, 1, 22, 1, 17)
    c.bezierCurveTo(1, 12, 6, 8, 8, 0)
    c.fill()
    c.fillStyle = 'rgba(0,0,0,0.18)'
    c.beginPath()
    c.arc(5.5, 16, 2, 0, TAU)
    c.fill()
  })
  tela(scene, 'cosm-borboleta', 32, 24, (c) => {
    c.fillStyle = '#fff'
    for (const s of [-1, 1]) {
      c.beginPath()
      c.ellipse(16 + s * 7, 8, 8, 7, s * 0.5, 0, TAU)
      c.fill()
      c.beginPath()
      c.ellipse(16 + s * 5, 17, 5.5, 5, -s * 0.4, 0, TAU)
      c.fill()
    }
    c.fillStyle = 'rgba(0,0,0,0.55)'
    c.fillRect(15, 5, 2, 15)
  })
  tela(scene, 'cosm-anel', 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 40, 64, 64, 63)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.78, 'rgba(255,255,255,0.9)')
    g.addColorStop(0.9, 'rgba(255,255,255,0.5)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g
    c.fillRect(0, 0, 128, 128)
  })
  tela(scene, 'cosm-lua', 24, 24, (c) => {
    c.fillStyle = '#fff'
    c.beginPath()
    c.arc(12, 12, 10, 0, TAU)
    c.fill()
  })
}

// ---------- ciclo de vida ----------
export const ERROS = [] // erros engolidos pelos quadros (os testes conferem que está vazio)
// fn(tempoMs, dtMs) a cada 'update' da cena. Se fn lançar erro o efeito se desliga sozinho
// (um cosmético quebrado nunca derruba a partida). destroy() é idempotente.
export function ligarAtualizacao(scene, fn, aoDestruir = null) {
  let vivo = true
  let tempo = 0
  const ev = scene.events
  const parar = () => {
    if (!vivo) return
    vivo = false
    ev.off('update', passo)
    ev.off('shutdown', parar)
    ev.off('destroy', parar)
    try {
      aoDestruir?.()
    } catch {}
  }
  const passo = (agora, dt) => {
    const d = limitar(Number.isFinite(dt) ? dt : 16, 0, 100)
    tempo += d
    try {
      if (fn(tempo, d) === false) parar()
    } catch (erro) {
      if (ERROS.length < 20) ERROS.push(erro)
      parar()
    }
  }
  ev.on('update', passo)
  ev.once('shutdown', parar)
  ev.once('destroy', parar)
  passo(0, 0) // o primeiro quadro já sai posicionado (senão os objetos aparecem em (0, 0) por um instante)
  return { destroy: parar, get vivo() { return vivo } }
}

// Piscina fixa de partículas dentro de `pai` (container). Cada uma vive `vida` ms; ao morrer renasce.
//   nascer(p)      define p.x, p.y, p.vx, p.vy, p.vida (ms), p.cor, p.tam... (p.s é a imagem)
//   mover(p, k, dt)  k = idade/vida (0..1); põe posição/alpha/escala em p.s
export function enxame(scene, pai, { n, textura, blend = ADD, nascer, mover, escalonar = true }) {
  const total = Math.min(MAX_PARTICULAS, quantasParticulas(n))
  const lista = []
  for (let i = 0; i < total; i++) {
    const s = scene.add.image(0, 0, textura)
    s.setBlendMode?.(blend)
    pai.add(s)
    const p = { s, idade: 0, vida: 1000, i }
    nascer(p)
    if (escalonar) p.idade = Math.random() * p.vida
    lista.push(p)
  }
  const fator = reduzido() ? 0.55 : 1
  return {
    lista,
    atualizar(dt) {
      for (const p of lista) {
        p.idade += dt * fator
        if (p.idade >= p.vida) {
          p.idade = 0
          nascer(p)
        }
        mover(p, p.idade / p.vida, dt * fator)
      }
    },
  }
}

// posição/tamanho/giro de um objeto qualquer no mundo (a carta pode estar dentro de um container)
export function medir(alvo) {
  let x = alvo.x ?? 0
  let y = alvo.y ?? 0
  let giro = alvo.rotation ?? 0
  let esc = 1
  try {
    const m = alvo.getWorldTransformMatrix?.()
    if (m && Number.isFinite(m.tx)) {
      x = m.tx
      y = m.ty
      giro = m.rotation ?? giro
      esc = m.scaleX ?? 1
    }
  } catch {}
  const w = alvo.largura ?? alvo.displayWidth ?? alvo.width ?? 70
  const h = alvo.altura ?? alvo.displayHeight ?? alvo.height ?? Math.round((w * 10) / 7)
  return { x, y, giro, esc, w: w || 70, h: h || 100 }
}

// Perímetro de um retângulo (centrado) como ponto em [0, 1): usado por bordas e arcos
export function pontoNoPerimetro(w, h, u) {
  const per = 2 * (w + h)
  let d = (((u % 1) + 1) % 1) * per
  if (d < w) return { x: -w / 2 + d, y: -h / 2, nx: 0, ny: -1 }
  d -= w
  if (d < h) return { x: w / 2, y: -h / 2 + d, nx: 1, ny: 0 }
  d -= h
  if (d < w) return { x: w / 2 - d, y: h / 2, nx: 0, ny: 1 }
  d -= w
  return { x: -w / 2, y: h / 2 - d, nx: -1, ny: 0 }
}
