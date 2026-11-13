// VERSOS ILUSTRADOS (cosmético, 0016; docs/cosmeticos.md): o verso das SUAS cartas, desenhado por código. Sem
// Phaser (os testes usam uma cena de mentira). Cada verso é pintado UMA vez por jogo numa textura de canvas
// (pintura.js) e cada carta virada só põe uma imagem dela (nada é redesenhado a cada quadro).
//
//   VERSOS_ILUSTRADOS                    [{ id, nome, raridade }] (ids do registro 'verso-<x>'; o banco é 'verso.<x>')
//   desenharVerso(scene, carta, id)      true = pôs o desenho em carta.verso; erro sobe (a ponte pega e a Carta
//                                        desenha o verso liso de sempre)
//   texturaVerso(scene, id)              -> chave | null
//   previaVerso(scene, id, x, y, tam)    uma carta virada com o verso, balançando de leve -> { destroy() }
//   temRenderizadorVerso(id)
//
// Os versos antigos (Clássico, Estrelado, Carmesim, Dourado, os semanais...) continuam lisos, na cor do item
// (pvp/versos.js corDoVerso): só os do baú têm desenho.
import { TAU, cartao, estrela, florSakura, folhaBordo, semente, textura } from './pintura.js'
import { ligarAtualizacao, reduzido } from './util.js'

export const VERSOS_ILUSTRADOS = [
  { id: 'verso-noite-estrelada', nome: 'Lua e Estrelas', raridade: 'comum' },
  { id: 'verso-circuito', nome: 'Placa de Circuito', raridade: 'comum' },
  { id: 'verso-patinhas', nome: 'Patinhas de Gato', raridade: 'comum' },
  { id: 'verso-aboboras', nome: 'Abóboras', raridade: 'comum' },
  { id: 'verso-lago-koi', nome: 'Lago das Carpas', raridade: 'raro' },
  { id: 'verso-vitral', nome: 'Vitral', raridade: 'raro' },
  { id: 'verso-cervo-nara', nome: 'Cervo de Nara', raridade: 'raro' },
  { id: 'verso-fliperama', nome: 'Fliperama', raridade: 'raro' },
  { id: 'verso-filigrana', nome: 'Filigrana Vitoriana', raridade: 'epico' },
  { id: 'verso-onda', nome: 'Onda do Mar', raridade: 'epico' },
  { id: 'verso-dragao-pixel', nome: 'Dragão de Pixel', raridade: 'epico' },
  { id: 'verso-galaxia', nome: 'Galáxia', raridade: 'lendario' },
]

const TW = 210
const TH = 300
// a área da arte (dentro do aro): em unidades da carta de referência (70 x 100)
const A = { x: -31.4, y: -46.4, w: 62.8, h: 92.8, r: 3.4 }

const elipse = (c, x, y, rx, ry, a = 0) => {
  c.beginPath()
  c.ellipse(x, y, rx, ry, a, 0, TAU)
  c.fill()
}
const circulo = (c, x, y, r) => elipse(c, x, y, r, r)
const poli = (c, cor, pts) => {
  c.fillStyle = cor
  c.beginPath()
  pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](...p))
  c.closePath()
  c.fill()
}
const radial = (c, x, y, r, paradas) => {
  const g = c.createRadialGradient(x, y, 0, x, y, r)
  for (const [k, cor] of paradas) g.addColorStop(k, cor)
  return g
}
const vertical = (c, y0, y1, paradas) => {
  const g = c.createLinearGradient(0, y0, 0, y1)
  for (const [k, cor] of paradas) g.addColorStop(k, cor)
  return g
}
const fundo = (c, estilo) => {
  c.fillStyle = estilo
  c.fillRect(-36, -51, 72, 102)
}

// ---------- as artes (em unidades da carta, já recortadas na área da arte) ----------

const ARTES = {
  'verso-noite-estrelada': {
    aro: '#c8a848',
    pintar(c) {
      const ceu = vertical(c, -50, 50, [[0, '#0a1038'], [0.6, '#1a2a70'], [1, '#2c3f8c']])
      fundo(c, ceu)
      const rnd = semente(101)
      for (let i = 0; i < 90; i++) {
        c.fillStyle = `rgba(255,250,220,${0.35 + rnd() * 0.6})`
        circulo(c, -32 + rnd() * 64, -47 + rnd() * 70, 0.15 + rnd() * 0.35)
      }
      c.fillStyle = 'rgba(255,250,220,0.95)'
      for (const [x, y, r] of [[-20, -36, 1.8], [-24, -8, 1.3], [21, -2, 1.5], [-6, -26, 1], [24, -40, 1.1], [-12, 6, 0.9]]) {
        estrela(c, x, y, r, 4, 0.22)
        c.fill()
      }
      // a lua crescente com halo
      c.fillStyle = radial(c, 7, -20, 20, [[0, 'rgba(255,240,180,0.45)'], [0.5, 'rgba(255,240,180,0.12)'], [1, 'rgba(255,240,180,0)']])
      circulo(c, 7, -20, 20)
      c.save()
      c.beginPath()
      c.arc(7, -20, 10, 0, TAU)
      c.clip()
      c.fillStyle = '#fbf0c4'
      c.fillRect(-4, -31, 22, 22)
      c.fillStyle = 'rgba(220,200,140,0.5)'
      circulo(c, 3, -17, 1.6)
      circulo(c, 6, -24, 1)
      c.fillStyle = ceu
      circulo(c, 12, -24, 9)
      c.restore()
      // nuvens
      c.fillStyle = 'rgba(170,180,255,0.14)'
      for (const [x, y, rx] of [[-14, 14, 16], [12, 20, 18], [-2, 26, 22]]) elipse(c, x, y, rx, 3.4)
      // morros e uma casinha com a janela acesa
      c.fillStyle = '#16205a'
      c.beginPath()
      c.moveTo(-36, 36)
      c.bezierCurveTo(-20, 22, -2, 26, 10, 32)
      c.bezierCurveTo(20, 28, 30, 26, 36, 30)
      c.lineTo(36, 51)
      c.lineTo(-36, 51)
      c.fill()
      c.fillStyle = '#0b1036'
      c.beginPath()
      c.moveTo(-36, 42)
      c.bezierCurveTo(-14, 32, 10, 40, 36, 36)
      c.lineTo(36, 51)
      c.lineTo(-36, 51)
      c.fill()
      poli(c, '#0b1036', [[10, 30], [16, 25], [22, 30], [22, 37], [10, 37]])
      c.fillStyle = '#ffd86a'
      c.fillRect(14.6, 31, 2.6, 2.6)
    },
  },

  'verso-circuito': {
    aro: '#d8b048',
    pintar(c) {
      fundo(c, vertical(c, -50, 50, [[0, '#0f4a32'], [1, '#0a3424']]))
      const rnd = semente(202)
      // trilhas de cobre (retas com uma dobra de 45°) e os furos
      c.lineCap = 'round'
      c.lineJoin = 'round'
      const trilha = (pts) => {
        c.strokeStyle = 'rgba(0,0,0,0.25)'
        c.lineWidth = 1.3
        c.beginPath()
        pts.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x + 0.3, y + 0.3))
        c.stroke()
        c.strokeStyle = '#c98c3c'
        c.lineWidth = 0.9
        c.beginPath()
        pts.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x, y))
        c.stroke()
        const [ex, ey] = pts[0]
        c.fillStyle = '#e8b868'
        circulo(c, ex, ey, 1.3)
        c.fillStyle = '#0c3a28'
        circulo(c, ex, ey, 0.5)
      }
      for (let i = 0; i < 22; i++) {
        const lado = i % 4
        const k = -1 + ((i >> 2) + rnd()) / 6 * 2
        let x = lado === 0 ? -30 : lado === 1 ? 30 : k * 26
        let y = lado === 2 ? -45 : lado === 3 ? 45 : k * 40
        const alvoX = (lado === 0 ? -1 : lado === 1 ? 1 : k) * 12
        const alvoY = (lado === 2 ? -1 : lado === 3 ? 1 : k) * 12
        const pts = [[x, y]]
        const meio = 0.35 + rnd() * 0.3
        if (lado < 2) {
          x = x + (alvoX - x) * meio
          pts.push([x, y])
          const d = Math.min(Math.abs(alvoY - y), Math.abs(alvoX - x))
          x += Math.sign(alvoX - x) * d
          y += Math.sign(alvoY - y) * d
          pts.push([x, y])
          pts.push([alvoX, y])
        } else {
          y = y + (alvoY - y) * meio
          pts.push([x, y])
          const d = Math.min(Math.abs(alvoY - y), Math.abs(alvoX - x))
          x += Math.sign(alvoX - x) * d
          y += Math.sign(alvoY - y) * d
          pts.push([x, y])
          pts.push([x, alvoY])
        }
        trilha(pts)
      }
      // componentes pequenos (resistores, capacitores) com a serigrafia branca
      c.strokeStyle = 'rgba(240,240,230,0.7)'
      c.lineWidth = 0.3
      for (const [x, y, w, h] of [[-26, -36, 6, 3], [18, -38, 5, 3], [-27, 30, 3, 6], [22, 32, 6, 3], [-8, 30, 5, 3], [6, -32, 4, 4]]) {
        c.strokeRect(x - 0.6, y - 0.6, w + 1.2, h + 1.2)
        c.fillStyle = w > h ? '#3a3a42' : '#7a5a2a'
        c.fillRect(x, y, w, h)
        c.fillStyle = '#c0c0c8'
        c.fillRect(x, y, 0.8, h)
        c.fillRect(x + w - 0.8, y, 0.8, h)
      }
      // o chip do meio com os naipes impressos
      c.fillStyle = 'rgba(0,0,0,0.35)'
      c.fillRect(-12, -11, 25, 25)
      c.fillStyle = '#c0c0ca'
      for (let k = -9; k <= 9; k += 3) {
        c.fillRect(k - 0.5, -14, 1, 3)
        c.fillRect(k - 0.5, 11, 1, 3)
        c.fillRect(-14, k - 0.5, 3, 1)
        c.fillRect(11, k - 0.5, 3, 1)
      }
      c.fillStyle = '#17191f'
      cartao(c, -12, -12, 24, 24, 1.2)
      c.fill()
      c.fillStyle = '#2a2d36'
      c.fillRect(-10, -10, 20, 20)
      c.fillStyle = 'rgba(255,255,255,0.12)'
      circulo(c, -8, -8, 1)
      c.fillStyle = '#e8e8f0'
      c.font = '3px monospace'
      c.textAlign = 'center'
      c.fillText('DDG-01', 0, 8)
      c.fillStyle = '#ff6a7a'
      c.font = '6px serif'
      c.fillText('♥♦', 0, -1.5)
      c.fillStyle = '#e8e8f0'
      c.fillText('♠♣', 0, 4.5)
    },
  },

  'verso-patinhas': {
    aro: '#fff2f6',
    pintar(c) {
      fundo(c, vertical(c, -50, 50, [[0, '#f7b0c8'], [1, '#ec88aa']]))
      const pata = (x, y, s, a, cor) => {
        c.save()
        c.translate(x, y)
        c.rotate(a)
        c.fillStyle = cor
        elipse(c, 0, 1.2 * s, 2.6 * s, 2.1 * s)
        for (const [px, py, r] of [[-2.4, -1.6, 0.95], [-0.85, -2.9, 1], [0.85, -2.9, 1], [2.4, -1.6, 0.95]]) elipse(c, px * s, py * s, r * s, r * 1.15 * s)
        c.restore()
      }
      for (let linha = 0; linha < 9; linha++) {
        for (let col = 0; col < 5; col++) {
          const x = -28 + col * 14 + (linha % 2 ? 7 : 0)
          const y = -44 + linha * 11.5
          pata(x, y, 1.15, (linha % 2 ? 0.35 : -0.35), linha % 2 ? 'rgba(255,255,255,0.75)' : 'rgba(200,80,130,0.35)')
        }
      }
      // medalhão com a carinha do gato
      c.fillStyle = '#fff4f8'
      circulo(c, 0, -2, 14)
      c.strokeStyle = '#d8628e'
      c.lineWidth = 1
      c.beginPath()
      c.arc(0, -2, 14, 0, TAU)
      c.stroke()
      c.strokeStyle = 'rgba(216,98,142,0.5)'
      c.lineWidth = 0.4
      c.beginPath()
      c.arc(0, -2, 12.2, 0, TAU)
      c.stroke()
      poli(c, '#3a2a3a', [[-8.6, -6], [-7.6, -14], [-2.6, -8.6]])
      poli(c, '#3a2a3a', [[8.6, -6], [7.6, -14], [2.6, -8.6]])
      poli(c, '#f4a0bc', [[-7.6, -7.4], [-7.2, -11.6], [-4.4, -8.6]])
      poli(c, '#f4a0bc', [[7.6, -7.4], [7.2, -11.6], [4.4, -8.6]])
      c.fillStyle = '#3a2a3a'
      elipse(c, 0, 0, 9, 7.6)
      c.fillStyle = '#c8f070'
      elipse(c, -3.4, -1.4, 1.7, 1.9)
      elipse(c, 3.4, -1.4, 1.7, 1.9)
      c.fillStyle = '#1a1018'
      elipse(c, -3.4, -1.3, 0.6, 1.5)
      elipse(c, 3.4, -1.3, 0.6, 1.5)
      c.fillStyle = '#ffffff'
      circulo(c, -3, -2.2, 0.4)
      circulo(c, 3.8, -2.2, 0.4)
      poli(c, '#f48aa8', [[-1, 1.6], [1, 1.6], [0, 2.8]])
      c.strokeStyle = 'rgba(255,255,255,0.75)'
      c.lineWidth = 0.3
      c.beginPath()
      for (const s of [-1, 1]) {
        c.moveTo(s * 2.4, 2.6)
        c.lineTo(s * 10, 1.6)
        c.moveTo(s * 2.4, 3.2)
        c.lineTo(s * 10, 4)
      }
      c.stroke()
      c.strokeStyle = '#f4a0bc'
      c.lineWidth = 0.4
      c.beginPath()
      c.moveTo(-1.2, 3.8)
      c.quadraticCurveTo(0, 4.8, 0, 3.4)
      c.quadraticCurveTo(0, 4.8, 1.2, 3.8)
      c.stroke()
    },
  },

  'verso-aboboras': {
    aro: '#ff8a1a',
    pintar(c) {
      fundo(c, vertical(c, -50, 50, [[0, '#14082a'], [0.7, '#3a1650'], [1, '#4a1c4a']]))
      const rnd = semente(404)
      for (let i = 0; i < 40; i++) {
        c.fillStyle = `rgba(255,240,220,${0.3 + rnd() * 0.5})`
        circulo(c, -32 + rnd() * 64, -47 + rnd() * 50, 0.15 + rnd() * 0.3)
      }
      c.fillStyle = radial(c, 16, -32, 16, [[0, 'rgba(255,240,190,0.5)'], [1, 'rgba(255,240,190,0)']])
      circulo(c, 16, -32, 16)
      c.fillStyle = '#fff0c0'
      circulo(c, 16, -32, 7)
      c.fillStyle = 'rgba(220,200,150,0.5)'
      circulo(c, 13.5, -33, 1.2)
      circulo(c, 18, -29.5, 0.9)
      // morcegos
      const morcego = (x, y, s) => {
        c.save()
        c.translate(x, y)
        c.scale(s, s)
        c.fillStyle = '#0a0412'
        c.beginPath()
        c.moveTo(0, -1)
        c.quadraticCurveTo(-3, -3.4, -6.4, -2)
        c.quadraticCurveTo(-5.2, -1.2, -5.4, 0.2)
        c.quadraticCurveTo(-4.4, -0.6, -3.4, 0.4)
        c.quadraticCurveTo(-2.4, -0.4, -1.2, 0.8)
        c.lineTo(0, 1.4)
        c.lineTo(1.2, 0.8)
        c.quadraticCurveTo(2.4, -0.4, 3.4, 0.4)
        c.quadraticCurveTo(4.4, -0.6, 5.4, 0.2)
        c.quadraticCurveTo(5.2, -1.2, 6.4, -2)
        c.quadraticCurveTo(3, -3.4, 0, -1)
        c.fill()
        circulo(c, 0, -0.6, 1)
        c.restore()
      }
      morcego(-16, -34, 1.1)
      morcego(-4, -26, 0.75)
      morcego(6, -40, 0.6)
      // o chão
      c.fillStyle = '#16081e'
      c.beginPath()
      c.moveTo(-36, 30)
      c.bezierCurveTo(-16, 22, 12, 26, 36, 22)
      c.lineTo(36, 51)
      c.lineTo(-36, 51)
      c.fill()
      // as abóboras (gomos, cabinho e a cara acesa)
      const abobora = (x, y, rx, ry, cara) => {
        c.fillStyle = 'rgba(0,0,0,0.35)'
        elipse(c, x, y + ry * 0.9, rx * 1.05, ry * 0.25)
        const gomo = (dx, w, cor) => {
          c.fillStyle = cor
          elipse(c, x + dx * rx, y, rx * w, ry)
        }
        gomo(-0.5, 0.55, '#d85a08')
        gomo(0.5, 0.55, '#d85a08')
        gomo(-0.22, 0.5, '#f07a14')
        gomo(0.22, 0.5, '#f07a14')
        gomo(0, 0.42, '#ff9426')
        c.strokeStyle = 'rgba(120,40,0,0.45)'
        c.lineWidth = 0.35
        for (const dx of [-0.42, -0.14, 0.14, 0.42]) {
          c.beginPath()
          c.ellipse(x + dx * rx, y, rx * 0.12, ry * 0.92, 0, -Math.PI / 2, Math.PI / 2, dx > 0)
          c.stroke()
        }
        poli(c, '#4a6a2a', [[x - 1, y - ry + 0.6], [x - 0.6, y - ry - 3.2], [x + 1.4, y - ry - 3.6], [x + 1, y - ry + 0.6]])
        if (!cara) return
        c.save()
        c.shadowColor = '#ffd040'
        c.shadowBlur = 8
        const luz = '#ffe066'
        poli(c, luz, [[x - rx * 0.5, y - ry * 0.12], [x - rx * 0.22, y - ry * 0.5], [x - rx * 0.1, y - ry * 0.08]])
        poli(c, luz, [[x + rx * 0.5, y - ry * 0.12], [x + rx * 0.22, y - ry * 0.5], [x + rx * 0.1, y - ry * 0.08]])
        poli(c, luz, [[x - 1, y + ry * 0.05], [x + 1, y + ry * 0.05], [x, y - ry * 0.18]])
        const boca = [[-0.6, 0.25], [-0.42, 0.42], [-0.3, 0.3], [-0.15, 0.5], [0, 0.36], [0.15, 0.5], [0.3, 0.3], [0.42, 0.42], [0.6, 0.25], [0.4, 0.62], [-0.4, 0.62]]
        poli(c, luz, boca.map(([a, b]) => [x + a * rx, y + b * ry]))
        c.restore()
      }
      abobora(-19, 36, 8.5, 7, false)
      abobora(20, 37, 8, 6.6, true)
      abobora(0, 22, 13.5, 11, true)
      // um fiapo de teia no canto
      c.strokeStyle = 'rgba(230,230,255,0.35)'
      c.lineWidth = 0.25
      for (let k = 1; k <= 3; k++) {
        c.beginPath()
        c.arc(-32, -47, k * 4, 0, Math.PI / 2)
        c.stroke()
      }
      for (let a = 0; a <= Math.PI / 2 + 0.01; a += Math.PI / 8) {
        c.beginPath()
        c.moveTo(-32, -47)
        c.lineTo(-32 + Math.cos(a) * 13, -47 + Math.sin(a) * 13)
        c.stroke()
      }
    },
  },

  'verso-lago-koi': {
    aro: '#d8c08a',
    pintar(c) {
      fundo(c, radial(c, 0, 0, 60, [[0, '#2f97a4'], [0.6, '#1a6a80'], [1, '#0d3a52']]))
      const rnd = semente(505)
      // ondinhas
      c.strokeStyle = 'rgba(255,255,255,0.13)'
      c.lineWidth = 0.35
      for (const [x, y] of [[-14, -26], [16, 22], [-18, 30]]) {
        for (let k = 1; k <= 4; k++) {
          c.beginPath()
          c.ellipse(x, y, k * 3.2, k * 1.6, 0, 0, TAU)
          c.stroke()
        }
      }
      // luz no fundo da água
      c.strokeStyle = 'rgba(200,255,255,0.08)'
      c.lineWidth = 0.6
      for (let i = 0; i < 9; i++) {
        const y = -44 + i * 11
        c.beginPath()
        c.moveTo(-34, y)
        for (let x = -34; x <= 34; x += 4) c.lineTo(x, y + Math.sin(x * 0.4 + i) * 1.2)
        c.stroke()
      }
      // vitórias-régias
      const folha = (x, y, r, a) => {
        c.fillStyle = 'rgba(0,0,0,0.2)'
        elipse(c, x + 0.6, y + 0.8, r, r * 0.85)
        c.fillStyle = '#3c9a4c'
        c.beginPath()
        c.moveTo(x, y)
        c.ellipse(x, y, r, r * 0.85, 0, a + 0.35, a + TAU - 0.05)
        c.closePath()
        c.fill()
        c.strokeStyle = 'rgba(20,80,30,0.5)'
        c.lineWidth = 0.25
        for (let k = 0; k < 7; k++) {
          const b = a + 0.6 + (k * (TAU - 0.8)) / 7
          c.beginPath()
          c.moveTo(x, y)
          c.lineTo(x + Math.cos(b) * r * 0.9, y + Math.sin(b) * r * 0.75)
          c.stroke()
        }
      }
      folha(-20, -34, 7, 0.4)
      folha(22, -30, 5, 2.2)
      folha(20, 34, 7.5, 4)
      folha(-22, 36, 5.5, 5.4)
      folha(-26, 4, 4, 1)
      florSakura(c, -20, -35, 3, 0.2, '#ffb0d0', '#ffe060')
      florSakura(c, 21, 33, 2.6, 0.7, '#ffc8dc', '#ffe060')
      // as duas carpas, uma correndo atrás da outra
      const carpa = (x, y, ang, s, corpo, mancha) => {
        c.save()
        c.translate(x, y)
        c.rotate(ang)
        c.scale(s, s)
        c.fillStyle = 'rgba(0,0,0,0.18)'
        elipse(c, 1, 1.4, 8, 3.2)
        // rabo
        c.fillStyle = corpo
        c.beginPath()
        c.moveTo(-6.5, 0)
        c.quadraticCurveTo(-10, -4, -12.5, -3.4)
        c.quadraticCurveTo(-10.6, 0, -12.5, 3.4)
        c.quadraticCurveTo(-10, 4, -6.5, 0)
        c.fill()
        // nadadeiras
        c.globalAlpha = 0.85
        elipse(c, 1, -3.2, 2.4, 1, -0.6)
        elipse(c, 1, 3.2, 2.4, 1, 0.6)
        c.globalAlpha = 1
        // corpo
        c.beginPath()
        c.moveTo(8, 0)
        c.bezierCurveTo(7, -3.4, -2, -3.6, -7, 0)
        c.bezierCurveTo(-2, 3.6, 7, 3.4, 8, 0)
        c.fill()
        c.fillStyle = mancha
        elipse(c, 3.6, -0.6, 2.4, 1.6, 0.3)
        elipse(c, -2, 0.8, 2, 1.3, -0.2)
        c.fillStyle = '#101010'
        circulo(c, 6, -1.2, 0.45)
        circulo(c, 6, 1.2, 0.45)
        c.restore()
      }
      carpa(4, -10, 0.25, 1.15, '#ff7a28', '#fff4ec')
      carpa(-4, 12, Math.PI + 0.25, 1.15, '#f6f2ea', '#e2382a')
      // brilhos na água
      c.fillStyle = 'rgba(255,255,255,0.5)'
      for (let i = 0; i < 10; i++) {
        estrela(c, -30 + rnd() * 60, -44 + rnd() * 88, 0.5 + rnd() * 0.6, 4, 0.25)
        c.fill()
      }
    },
  },

  'verso-vitral': {
    aro: '#3a3040',
    pintar(c) {
      fundo(c, '#141018')
      const rnd = semente(606)
      const joias = ['#2a5ad8', '#d83a4a', '#3ab070', '#f0a030', '#8a3ad0', '#2a9ad8', '#e8c840', '#c8306a']
      // o fundo de cacos (grade torta)
      const N = 6
      const M = 9
      const p = []
      for (let j = 0; j <= M; j++) {
        p.push([])
        for (let i = 0; i <= N; i++) {
          const borda = i === 0 || j === 0 || i === N || j === M
          p[j].push([-34 + (i * 68) / N + (borda ? 0 : (rnd() - 0.5) * 5), -50 + (j * 100) / M + (borda ? 0 : (rnd() - 0.5) * 5)])
        }
      }
      for (let j = 0; j < M; j++) {
        for (let i = 0; i < N; i++) {
          const cor = joias[Math.floor(rnd() * joias.length)]
          c.globalAlpha = 0.65
          poli(c, cor, [p[j][i], p[j][i + 1], p[j + 1][i + 1], p[j + 1][i]])
          c.globalAlpha = 1
          c.strokeStyle = '#141018'
          c.lineWidth = 1
          c.beginPath()
          c.moveTo(...p[j][i])
          c.lineTo(...p[j][i + 1])
          c.lineTo(...p[j + 1][i + 1])
          c.lineTo(...p[j + 1][i])
          c.closePath()
          c.stroke()
        }
      }
      // a rosácea
      const cx = 0
      const cy = -2
      c.fillStyle = '#141018'
      circulo(c, cx, cy, 29)
      const anel = (r0, r1, n, cores, giro = 0) => {
        for (let k = 0; k < n; k++) {
          const a0 = giro + (k * TAU) / n
          const a1 = giro + ((k + 1) * TAU) / n
          c.fillStyle = cores[k % cores.length]
          c.beginPath()
          c.arc(cx, cy, r1, a0 + 0.04, a1 - 0.04)
          c.arc(cx, cy, r0, a1 - 0.04, a0 + 0.04, true)
          c.closePath()
          c.fill()
        }
      }
      // pétalas em arco (pontudas)
      for (let k = 0; k < 12; k++) {
        const a = (k * TAU) / 12
        c.save()
        c.translate(cx, cy)
        c.rotate(a)
        c.fillStyle = joias[k % 2 ? 0 : 4]
        c.beginPath()
        c.moveTo(-3.6, -19.5)
        c.quadraticCurveTo(-4, -25, 0, -28)
        c.quadraticCurveTo(4, -25, 3.6, -19.5)
        c.closePath()
        c.fill()
        c.fillStyle = 'rgba(255,255,255,0.18)'
        elipse(c, -1.2, -24, 0.8, 2.2)
        c.restore()
      }
      anel(11.5, 19, 12, ['#3ab070', '#f0a030', '#2a9ad8', '#c8306a'], 0.13)
      anel(5.5, 11, 8, ['#2a5ad8', '#d83a4a'])
      c.fillStyle = '#f0c040'
      circulo(c, cx, cy, 5)
      c.fillStyle = '#d83a4a'
      estrela(c, cx, cy, 3.6, 8, 0.5)
      c.fill()
      c.strokeStyle = '#141018'
      c.lineWidth = 0.9
      for (const r of [5, 11, 19]) {
        c.beginPath()
        c.arc(cx, cy, r, 0, TAU)
        c.stroke()
      }
      // a luz atravessando o vidro
      const brilho = c.createLinearGradient(-34, -50, 34, 50)
      brilho.addColorStop(0, 'rgba(255,255,255,0.22)')
      brilho.addColorStop(0.45, 'rgba(255,255,255,0)')
      brilho.addColorStop(1, 'rgba(255,255,255,0.08)')
      fundo(c, brilho)
    },
  },

  'verso-cervo-nara': {
    aro: '#f0c070',
    pintar(c) {
      fundo(c, vertical(c, -50, 50, [[0, '#ffc77a'], [0.45, '#f08070'], [1, '#6a3a7a']]))
      c.fillStyle = radial(c, 0, -10, 24, [[0, 'rgba(255,245,200,0.9)'], [0.4, 'rgba(255,230,170,0.5)'], [1, 'rgba(255,230,170,0)']])
      circulo(c, 0, -10, 24)
      c.fillStyle = '#fff2c8'
      circulo(c, 0, -10, 8.5)
      // morros e um portão (torii) bem longe
      c.fillStyle = 'rgba(150,60,100,0.55)'
      c.beginPath()
      c.moveTo(-36, 12)
      c.bezierCurveTo(-20, 2, -6, 8, 6, 6)
      c.bezierCurveTo(18, 4, 28, 10, 36, 6)
      c.lineTo(36, 51)
      c.lineTo(-36, 51)
      c.fill()
      c.fillStyle = '#7a2a4a'
      c.fillRect(17, -2, 1.1, 9)
      c.fillRect(24, -2, 1.1, 9)
      c.fillRect(15.6, -1.4, 10.8, 1)
      poli(c, '#7a2a4a', [[14.6, -3.6], [27.4, -3.6], [26.6, -2.4], [15.4, -2.4]])
      // o cervo (silhueta)
      const s = '#2a1424'
      c.fillStyle = s
      elipse(c, -3, 25, 10, 5.6)
      elipse(c, 5.4, 18, 3, 6.4, 0.45)
      elipse(c, 8.6, 12.6, 3.6, 2.6, 0.2)
      elipse(c, 11.4, 13.8, 2, 1.4, 0.25)
      poli(c, s, [[6, 10.6], [3.4, 8], [6.6, 10]])
      poli(c, s, [[-12, 24], [-13.8, 20], [-11, 22]])
      for (const [x, dx] of [[-10, -1], [-6, 0.6], [2, -0.6], [5, 0.8]]) {
        c.fillRect(x - 0.8, 28, 1.6, 14)
        c.fillRect(x - 0.8 + dx, 40, 1.8, 2)
      }
      c.strokeStyle = s
      c.lineWidth = 0.9
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(8, 10.4)
      c.quadraticCurveTo(7, 5, 4.6, 1.6)
      c.moveTo(7.4, 6.4)
      c.lineTo(4.6, 5.4)
      c.moveTo(6, 3.6)
      c.lineTo(8.4, 1.4)
      c.moveTo(9.4, 10.4)
      c.quadraticCurveTo(11.4, 5.6, 13.4, 3)
      c.moveTo(10.6, 7)
      c.lineTo(13.6, 7)
      c.stroke()
      // grama
      c.fillStyle = s
      c.beginPath()
      c.moveTo(-36, 44)
      for (let x = -36; x <= 36; x += 2) c.lineTo(x, 42 - (x % 4 ? 0 : 2.4))
      c.lineTo(36, 51)
      c.lineTo(-36, 51)
      c.fill()
      // folhas de bordo caindo
      const rnd = semente(707)
      const cores = ['#e04a2a', '#f08a30', '#c82a3a', '#f0b040']
      for (let i = 0; i < 13; i++) {
        c.fillStyle = cores[i % cores.length]
        folhaBordo(c, -30 + rnd() * 60, -44 + rnd() * 80, 1.6 + rnd() * 2.2, rnd() * TAU)
      }
    },
  },

  'verso-fliperama': {
    aro: '#3affc8',
    pintar(c) {
      fundo(c, vertical(c, -50, 50, [[0, '#0e0322'], [0.55, '#2a0a4a'], [1, '#14052a']]))
      const rnd = semente(808)
      for (let i = 0; i < 50; i++) {
        c.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`
        c.fillRect(-32 + rnd() * 64, -47 + rnd() * 50, 0.5, 0.5)
      }
      // o sol listrado
      c.save()
      c.beginPath()
      c.arc(0, 0, 15, 0, TAU)
      c.clip()
      c.fillStyle = vertical(c, -15, 15, [[0, '#ffe23a'], [0.55, '#ff7a3a'], [1, '#ff2a8a']])
      c.fillRect(-16, -16, 32, 32)
      c.fillStyle = '#2a0a4a'
      for (let k = 0; k < 6; k++) c.fillRect(-16, 2 + k * 2.4, 32, 0.5 + k * 0.28)
      c.restore()
      // o chão de grade em perspectiva (neon)
      c.fillStyle = '#14052a'
      c.fillRect(-36, 9, 72, 42)
      c.save()
      c.shadowColor = '#ff3af0'
      c.shadowBlur = 5
      c.strokeStyle = '#ff4af4'
      c.lineWidth = 0.4
      for (let k = 0; k < 9; k++) {
        const y = 9 + Math.pow(k / 8, 1.8) * 40
        c.beginPath()
        c.moveTo(-36, y)
        c.lineTo(36, y)
        c.stroke()
      }
      for (let k = -8; k <= 8; k++) {
        c.beginPath()
        c.moveTo(k * 1.6, 9)
        c.lineTo(k * 12, 51)
        c.stroke()
      }
      c.restore()
      c.fillStyle = '#ff4af4'
      c.fillRect(-36, 8.6, 72, 0.6)
      // o alienzinho de pixel
      const mapa = ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...']
      const px = 1.5
      c.fillStyle = '#3affc8'
      c.save()
      c.shadowColor = '#3affc8'
      c.shadowBlur = 6
      mapa.forEach((l, j) => [...l].forEach((v, i) => v === 'X' && c.fillRect(-8.25 + i * px, -40 + j * px, px, px)))
      c.restore()
      // tiros e um coraçãozinho de vida
      c.fillStyle = '#ffe23a'
      c.fillRect(-0.4, -26, 0.8, 3)
      c.fillRect(-14.4, -30, 0.8, 3)
      c.fillStyle = '#ffffff'
      c.font = '3.6px monospace'
      c.textAlign = 'center'
      c.fillText('PRESS START', 0, 41)
      c.fillStyle = '#ff3a6a'
      c.fillText('♥♥♥', -22, -42)
      c.fillStyle = '#3affc8'
      c.fillText('1UP', 22, -42)
    },
  },

  'verso-filigrana': {
    aro: '#e0b860',
    pintar(c) {
      fundo(c, radial(c, 0, 0, 60, [[0, '#5e1a2e'], [1, '#34091a']]))
      // damasco discreto no fundo
      c.fillStyle = 'rgba(20,0,8,0.35)'
      for (let j = -5; j <= 5; j++) {
        for (let i = -3; i <= 3; i++) {
          const x = i * 12 + (j % 2 ? 6 : 0)
          const y = j * 10
          c.beginPath()
          c.moveTo(x, y - 3.4)
          c.quadraticCurveTo(x + 2.4, y, x, y + 3.4)
          c.quadraticCurveTo(x - 2.4, y, x, y - 3.4)
          c.fill()
        }
      }
      const ouro = '#e6c06a'
      // um quarto do arabesco; os outros três são o espelho
      const quarto = () => {
        c.strokeStyle = ouro
        c.fillStyle = ouro
        c.lineWidth = 0.7
        c.lineCap = 'round'
        // voluta grande
        c.beginPath()
        c.moveTo(2, 16)
        c.bezierCurveTo(8, 18, 16, 24, 14, 32)
        c.bezierCurveTo(13, 37, 7, 37, 7.6, 33)
        c.bezierCurveTo(8, 30.4, 11, 31, 10.6, 33)
        c.stroke()
        c.beginPath()
        c.moveTo(14, 26)
        c.bezierCurveTo(20, 22, 26, 26, 25, 32)
        c.bezierCurveTo(24, 36, 19.6, 35, 20.4, 32)
        c.stroke()
        c.beginPath()
        c.moveTo(13, 16)
        c.bezierCurveTo(20, 10, 27, 12, 27, 18)
        c.bezierCurveTo(27, 21, 23.6, 21.4, 23.6, 19)
        c.stroke()
        // folhinhas e pérolas
        for (const [x, y, a] of [[17, 20, 0.6], [11, 26, -0.4], [22, 28, 1.2], [6, 22, 0.2]]) elipse(c, x, y, 1.6, 0.7, a)
        c.fillStyle = '#f4ead8'
        for (const [x, y] of [[9, 36.6], [22.4, 35.4], [28.4, 22], [4, 16.6], [27.8, 40.2], [29.6, 44]]) circulo(c, x, y, 0.55)
        // o leque do canto
        c.strokeStyle = ouro
        c.lineWidth = 0.45
        for (let a = 0; a <= Math.PI / 2 + 0.01; a += Math.PI / 10) {
          c.beginPath()
          c.moveTo(31, 46)
          c.lineTo(31 - Math.cos(a) * 7, 46 - Math.sin(a) * 7)
          c.stroke()
        }
        c.beginPath()
        c.arc(31, 46, 7, Math.PI, Math.PI * 1.5)
        c.stroke()
      }
      for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        c.save()
        c.scale(sx, sy)
        quarto()
        c.restore()
      }
      // moldura dupla
      c.strokeStyle = ouro
      c.lineWidth = 0.6
      cartao(c, -29.4, -44.4, 58.8, 88.8, 2.6)
      c.stroke()
      c.lineWidth = 0.25
      cartao(c, -28.2, -43.2, 56.4, 86.4, 2.2)
      c.stroke()
      // o medalhão com o coração de rubi
      c.fillStyle = '#2a0612'
      elipse(c, 0, 0, 11, 14)
      c.strokeStyle = ouro
      c.lineWidth = 1
      c.beginPath()
      c.ellipse(0, 0, 11, 14, 0, 0, TAU)
      c.stroke()
      c.lineWidth = 0.35
      c.beginPath()
      c.ellipse(0, 0, 9.4, 12.4, 0, 0, TAU)
      c.stroke()
      c.fillStyle = '#f4ead8'
      for (let k = 0; k < 20; k++) {
        const a = (k * TAU) / 20
        circulo(c, Math.cos(a) * 12.4, Math.sin(a) * 15.6, 0.45)
      }
      c.fillStyle = radial(c, -1.4, -2.4, 9, [[0, '#ff6a7a'], [0.5, '#c8203a'], [1, '#6a0818']])
      c.beginPath()
      c.moveTo(0, 7)
      c.bezierCurveTo(-9, 1, -6, -8, 0, -3.6)
      c.bezierCurveTo(6, -8, 9, 1, 0, 7)
      c.fill()
      c.fillStyle = 'rgba(255,255,255,0.55)'
      elipse(c, -2.6, -2.6, 1.3, 0.8, -0.6)
      // o broche (a ponte do medalhão)
      c.fillStyle = ouro
      elipse(c, 0, -14.6, 2.4, 1.4)
      elipse(c, 0, 14.6, 2.4, 1.4)
    },
  },

  'verso-onda': {
    aro: '#16346a',
    pintar(c) {
      fundo(c, vertical(c, -50, 50, [[0, '#f4ead2'], [1, '#e8dab8']]))
      // o sol e dois passarinhos
      c.fillStyle = '#d8402a'
      circulo(c, 16, -32, 6.5)
      c.strokeStyle = '#3a2a2a'
      c.lineWidth = 0.4
      for (const [x, y] of [[-6, -38], [0, -42]]) {
        c.beginPath()
        c.moveTo(x - 1.6, y - 0.6)
        c.quadraticCurveTo(x - 0.6, y - 1, x, y)
        c.quadraticCurveTo(x + 0.6, y - 1, x + 1.6, y - 0.6)
        c.stroke()
      }
      // a onda grande: corpo azul com listras, a crista enrolando e as "garrinhas" de espuma
      const corpo = () => {
        c.beginPath()
        c.moveTo(-36, 51)
        c.lineTo(-36, 4)
        c.bezierCurveTo(-33, -16, -18, -32, 0, -30)
        c.bezierCurveTo(12, -29, 19, -19, 14, -11)
        c.bezierCurveTo(11, -6, 4, -8, 5, -13)
        c.bezierCurveTo(6, -17, 1, -19, -3, -15)
        c.bezierCurveTo(-11, -6, -8, 18, 36, 26)
        c.lineTo(36, 51)
        c.closePath()
      }
      c.fillStyle = vertical(c, -32, 50, [[0, '#2a5a9a'], [0.5, '#16346a'], [1, '#0c2048']])
      corpo()
      c.fill()
      c.save()
      corpo()
      c.clip()
      c.strokeStyle = 'rgba(140,180,230,0.45)'
      c.lineWidth = 0.45
      for (let k = 1; k <= 7; k++) {
        c.beginPath()
        c.moveTo(-36, 8 + k * 4)
        c.bezierCurveTo(-30, -8 + k * 5, -16, -22 + k * 5, -2, -20 + k * 4)
        c.stroke()
      }
      c.restore()
      // espuma da crista
      c.strokeStyle = '#ffffff'
      c.lineWidth = 1.2
      c.beginPath()
      c.moveTo(-34, -2)
      c.bezierCurveTo(-30, -18, -17, -30, 0, -30)
      c.bezierCurveTo(12, -29, 19, -19, 14, -11)
      c.bezierCurveTo(11, -6, 4, -8, 5, -13)
      c.stroke()
      c.fillStyle = '#ffffff'
      for (let k = 0; k < 9; k++) {
        const t = k / 8
        const x = -26 + t * 40 - Math.pow(t, 3) * 4
        const y = -20 - Math.sin(t * Math.PI) * 10 + t * 4
        c.beginPath()
        c.moveTo(x, y)
        c.quadraticCurveTo(x + 2.2, y - 3.4, x + 3.6, y - 1.6)
        c.quadraticCurveTo(x + 2.2, y - 1.2, x + 1.6, y + 0.4)
        c.closePath()
        c.fill()
      }
      // respingos
      const rnd = semente(1001)
      for (let i = 0; i < 26; i++) circulo(c, -4 + rnd() * 28, -36 + rnd() * 18, 0.25 + rnd() * 0.5)
      // a onda pequena da frente
      c.fillStyle = '#2a5a9a'
      c.beginPath()
      c.moveTo(-36, 51)
      c.lineTo(-36, 34)
      c.bezierCurveTo(-26, 24, -14, 26, -10, 32)
      c.bezierCurveTo(-6, 26, 6, 28, 10, 36)
      c.bezierCurveTo(16, 30, 28, 30, 36, 36)
      c.lineTo(36, 51)
      c.closePath()
      c.fill()
      c.strokeStyle = '#ffffff'
      c.lineWidth = 0.8
      c.beginPath()
      c.moveTo(-36, 34)
      c.bezierCurveTo(-26, 24, -14, 26, -10, 32)
      c.moveTo(-10, 32)
      c.bezierCurveTo(-6, 26, 6, 28, 10, 36)
      c.moveTo(10, 36)
      c.bezierCurveTo(16, 30, 28, 30, 36, 36)
      c.stroke()
      c.strokeStyle = 'rgba(200,220,250,0.5)'
      c.lineWidth = 0.35
      for (let k = 1; k <= 3; k++) {
        c.beginPath()
        c.moveTo(-36, 34 + k * 4)
        c.bezierCurveTo(-20, 28 + k * 4, 0, 32 + k * 4, 36, 36 + k * 4)
        c.stroke()
      }
    },
  },

  'verso-dragao-pixel': {
    aro: '#f0c030',
    pixel: true,
    pintar(c) {
      fundo(c, radial(c, 0, -6, 60, [[0, '#6a1c1c'], [1, '#240808']]))
      const rnd = semente(1111)
      // brasas e estrelinhas de pixel
      for (let i = 0; i < 30; i++) {
        c.fillStyle = i % 3 ? 'rgba(255,160,60,0.5)' : 'rgba(255,240,200,0.6)'
        c.fillRect(Math.round(-32 + rnd() * 64), Math.round(-46 + rnd() * 60), 1, 1)
      }
      const cores = { R: '#c83a3a', r: '#8a2020', G: '#3ac860', D: '#1a7a3a', Y: '#f0d060', W: '#ffffff', K: '#140404', O: '#ff8a1a', F: '#ffe040' }
      const mapa = [
        '......RR..................',
        '.....RRRR.....GG..........',
        '....RrRRRR...GGGG.........',
        '...RRrRRRRR.GGWKGG........',
        '..RRRrRRRRR.GGGGGGGGOO.F..',
        '..RRRRrRRRRGGGGGGWGOOFFOF.',
        '...RRRRrRRGGGGG....OO.F.O.',
        '....RRRRGGGGGG............',
        '.....RGGGGYYGG............',
        '....GGGGGYYYGG............',
        '...GGGGGYYYYGG............',
        '..GGDGGGYYYYGG............',
        '..GGDGGGYYYYGGG...........',
        '.GG.DGGGGYYGGGG...........',
        'GG..GGGGGGGGGDG...........',
        'G...GGDGGGGGGDG...........',
        'GG..GG.GGG.GGG............',
        '.GGGG..DD..DD.............',
        '..GG...KK..KK.............',
      ]
      const px = 2.2
      const x0 = -28.6
      const y0 = -26
      const cheio = (i, j) => {
        const v = mapa[j]?.[i]
        return v && v !== '.' && v !== 'O' && v !== 'F'
      }
      // contorno escuro (1 pixel em volta) e depois as cores
      c.fillStyle = '#140404'
      mapa.forEach((l, j) => [...l].forEach((_, i) => {
        if (cheio(i, j)) return
        if (cheio(i - 1, j) || cheio(i + 1, j) || cheio(i, j - 1) || cheio(i, j + 1)) c.fillRect(x0 + i * px, y0 + j * px, px, px)
      }))
      mapa.forEach((l, j) => [...l].forEach((v, i) => {
        if (v === '.') return
        c.fillStyle = cores[v]
        c.fillRect(x0 + i * px, y0 + j * px, px + 0.02, px + 0.02)
      }))
      // o tesouro de moedas embaixo
      for (let k = 0; k < 60; k++) {
        const x = Math.round((-26 + rnd() * 52) / 1.6) * 1.6
        const topo = 30 + Math.abs(x) * 0.28
        const y = Math.round((topo + rnd() * (44 - topo)) / 1.6) * 1.6
        c.fillStyle = k % 4 ? '#f0c030' : '#ffe890'
        c.fillRect(x, y, 1.6, 1.6)
        c.fillStyle = '#a07010'
        c.fillRect(x, y + 1.2, 1.6, 0.4)
      }
      c.fillStyle = '#3ac8f0'
      c.fillRect(-12, 34, 1.6, 1.6)
      c.fillStyle = '#ff3a6a'
      c.fillRect(10.4, 36, 1.6, 1.6)
      // moldura tracejada de pixel
      c.fillStyle = '#f0c030'
      for (let x = -30; x < 30; x += 4) {
        c.fillRect(x, -45, 2, 1)
        c.fillRect(x, 44, 2, 1)
      }
      for (let y = -44; y < 44; y += 4) {
        c.fillRect(-30, y, 1, 2)
        c.fillRect(29, y, 1, 2)
      }
    },
  },

  'verso-galaxia': {
    aro: '#b48cff',
    pintar(c) {
      fundo(c, '#05030f')
      c.save()
      c.globalCompositeOperation = 'lighter'
      for (const [x, y, r, cor] of [[-16, -26, 26, 'rgba(110,40,170,0.35)'], [18, 20, 26, 'rgba(40,80,200,0.32)'], [6, -6, 18, 'rgba(200,60,140,0.25)'], [-18, 30, 16, 'rgba(60,160,200,0.2)']]) {
        c.fillStyle = radial(c, x, y, r, [[0, cor], [1, 'rgba(0,0,0,0)']])
        circulo(c, x, y, r)
      }
      // os braços da espiral (pontinhos somados)
      const rnd = semente(1212)
      const cores = [[255, 240, 220], [180, 200, 255], [210, 150, 255], [255, 150, 210], [140, 220, 255]]
      c.save()
      c.translate(0, -4)
      c.rotate(-0.45)
      for (let i = 0; i < 1100; i++) {
        const t = Math.pow(rnd(), 0.8)
        const braco = i % 2
        const ang = t * 4.4 + braco * Math.PI + (rnd() - 0.5) * (0.5 + t * 0.4)
        const r = 1.5 + t * 27 + (rnd() - 0.5) * 2.4
        const x = Math.cos(ang) * r
        const y = Math.sin(ang) * r * 0.6
        const [cr, cg, cb] = t < 0.18 ? cores[0] : cores[1 + Math.floor(rnd() * 4)]
        c.fillStyle = `rgba(${cr},${cg},${cb},${0.25 + rnd() * 0.45})`
        c.beginPath()
        c.arc(x, y, 0.15 + rnd() * 0.45, 0, TAU)
        c.fill()
      }
      c.fillStyle = radial(c, 0, 0, 10, [[0, 'rgba(255,250,235,0.95)'], [0.35, 'rgba(255,220,200,0.45)'], [1, 'rgba(255,200,220,0)']])
      elipse(c, 0, 0, 10, 6.5)
      c.restore()
      // estrelas e alguns brilhos com cruz
      for (let i = 0; i < 120; i++) {
        c.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.6})`
        c.beginPath()
        c.arc(-33 + rnd() * 66, -49 + rnd() * 98, 0.12 + rnd() * 0.28, 0, TAU)
        c.fill()
      }
      for (const [x, y, r] of [[-22, -38, 2.4], [24, -30, 1.8], [-24, 34, 2], [22, 40, 1.6], [12, -42, 1.2]]) {
        c.fillStyle = 'rgba(255,255,255,0.9)'
        estrela(c, x, y, r, 4, 0.18)
        c.fill()
        c.fillStyle = radial(c, x, y, r * 1.6, [[0, 'rgba(200,220,255,0.6)'], [1, 'rgba(200,220,255,0)']])
        circulo(c, x, y, r * 1.6)
      }
      c.restore()
    },
  },
}

// o verso inteiro: borda escura, o aro na cor do verso, a arte recortada e um filete claro
function pintarVerso(arte) {
  return (c, w, h) => {
    c.save()
    c.translate(w / 2, h / 2)
    c.scale(w / 70, h / 100)
    c.fillStyle = '#2a2238'
    cartao(c, -35, -50, 70, 100, 6)
    c.fill()
    c.fillStyle = arte.aro
    cartao(c, -33.8, -48.8, 67.6, 97.6, 5)
    c.fill()
    c.fillStyle = 'rgba(0,0,0,0.25)'
    cartao(c, -32, -47, 64, 94, 3.8)
    c.fill()
    c.save()
    cartao(c, A.x, A.y, A.w, A.h, A.r)
    c.clip()
    arte.pintar(c)
    c.restore()
    c.strokeStyle = 'rgba(255,255,255,0.35)'
    c.lineWidth = 0.35
    cartao(c, A.x + 1.2, A.y + 1.2, A.w - 2.4, A.h - 2.4, A.r - 0.8)
    c.stroke()
    c.restore()
  }
}

export const temRenderizadorVerso = (id) => Boolean(ARTES[id])

export function texturaVerso(scene, id) {
  const arte = ARTES[id]
  if (!arte) return null
  return textura(scene, `verso-arte-${id}`, TW, TH, pintarVerso(arte), { pixel: Boolean(arte.pixel) })
}

export function desenharVerso(scene, carta, id) {
  if (!ARTES[id] || !carta?.verso) return false
  const chave = texturaVerso(scene, id)
  if (!chave) return false
  const img = scene.add.image(0, 0, chave).setDisplaySize(carta.largura ?? 70, carta.altura ?? 100)
  carta.verso.add(img)
  return true
}

export function previaVerso(scene, id, x, y, tamanho = 96) {
  const chave = texturaVerso(scene, id)
  if (!chave) return { destroy() {} }
  const largura = Math.round(tamanho * 0.62)
  const img = scene.add.image(x, y, chave).setDisplaySize(largura, Math.round((largura * 10) / 7))
  const lig = ligarAtualizacao(scene, (t) => {
    if (!img.active) return false
    if (!reduzido()) img.setRotation(Math.sin(t / 900) * 0.05)
  }, () => img.active && img.destroy())
  return { destroy: () => lig.destroy() }
}
