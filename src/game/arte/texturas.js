import { SPRITES, CORACAO_MAPA } from './sprites.js'
import { PERSONAGENS } from '../data/personagens.js'

// Escala em que cada sprite de pixel art aparece no jogo
export const ESCALA = { personagem: 3, chefe: 4, coracao: 1.4 }

// Tamanho do "miolo" das texturas de bala (a borda restante é o brilho).
// Uma bala de raio r é desenhada com escala r / RAIO_BALA.
export const RAIO_BALA = 10
const TAM_BALA = 32

// Desenha por código as texturas de GERADORES (personagens, chefes, balas, interface)
export function gerarTexturas(scene) {
  for (const [chave, gerar] of Object.entries(GERADORES)) scene.textures.addCanvas(chave, gerar())
}

// ---------- utilitários de desenho ----------

function tela(largura, altura) {
  const c = document.createElement('canvas')
  c.width = largura
  c.height = altura
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  return [c, g]
}

// Desenha um mapa de pixel art ('.' = transparente)
function pixelArt(mapa, paleta, validar = '') {
  const largura = Math.max(...mapa.map((l) => l.length))
  if (import.meta.env.DEV && validar && mapa.some((l) => l.length !== largura)) {
    console.warn(`[arte] ${validar}: linhas com tamanhos diferentes`)
  }
  const [c, g] = tela(largura, mapa.length)
  mapa.forEach((linha, y) => {
    ;[...linha].forEach((ch, x) => {
      const cor = paleta[ch]
      if (!cor) return
      g.fillStyle = cor
      g.fillRect(x, y, 1, 1)
    })
  })
  return c
}

// Forma branca com brilho, centrada numa tela quadrada
function formaBrilhante(desenhar, tamanho = TAM_BALA) {
  const [c, g] = tela(tamanho, tamanho)
  g.imageSmoothingEnabled = true
  g.translate(tamanho / 2, tamanho / 2)
  g.fillStyle = '#ffffff'
  g.shadowColor = 'rgba(255,255,255,0.95)'
  g.shadowBlur = 5
  g.beginPath()
  desenhar(g, RAIO_BALA)
  g.fill()
  g.shadowBlur = 0
  g.beginPath()
  desenhar(g, RAIO_BALA)
  g.fill()
  return c
}

function poligono(g, pontos) {
  g.moveTo(pontos[0][0], pontos[0][1])
  for (const [x, y] of pontos.slice(1)) g.lineTo(x, y)
  g.closePath()
}

// ---------- formas de bala ----------

const FORMAS = {
  // chama: gota de fogo com a ponta para cima (não gire)
  chama: (g, r) => {
    g.moveTo(0, -r)
    g.bezierCurveTo(r * 0.5, -r * 0.4, r * 0.95, r * 0.1, r * 0.7, r * 0.6)
    g.bezierCurveTo(r * 0.45, r * 1.0, -r * 0.45, r * 1.0, -r * 0.7, r * 0.6)
    g.bezierCurveTo(-r * 0.95, r * 0.1, -r * 0.5, -r * 0.4, 0, -r)
  },
  bola: (g, r) => g.arc(0, 0, r, 0, Math.PI * 2),
  losango: (g, r) => poligono(g, [[0, -r], [r * 0.72, 0], [0, r], [-r * 0.72, 0]]),
  coroa: (g, r) =>
    poligono(g, [
      [-r, r * 0.65],
      [-r, -r * 0.55],
      [-r * 0.5, 0],
      [0, -r],
      [r * 0.5, 0],
      [r, -r * 0.55],
      [r, r * 0.65],
    ]),
  hex: (g, r) =>
    poligono(
      g,
      Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3) * r, Math.sin((i * Math.PI) / 3) * r]),
    ),
  espadas: (g, r) => {
    g.moveTo(0, -r)
    g.bezierCurveTo(r * 0.4, -r * 0.5, r * 1.1, -r * 0.1, r * 0.9, r * 0.35)
    g.bezierCurveTo(r * 0.7, r * 0.75, r * 0.2, r * 0.7, 0, r * 0.35)
    g.bezierCurveTo(-r * 0.2, r * 0.7, -r * 0.7, r * 0.75, -r * 0.9, r * 0.35)
    g.bezierCurveTo(-r * 1.1, -r * 0.1, -r * 0.4, -r * 0.5, 0, -r)
    g.moveTo(0, r * 0.2)
    g.lineTo(r * 0.4, r)
    g.lineTo(-r * 0.4, r)
    g.closePath()
  },
  copas: (g, r) => {
    g.moveTo(0, r * 0.95)
    g.bezierCurveTo(-r * 1.25, 0, -r * 0.95, -r * 1.05, 0, -r * 0.4)
    g.bezierCurveTo(r * 0.95, -r * 1.05, r * 1.25, 0, 0, r * 0.95)
  },
  ouros: (g, r) => {
    g.moveTo(0, -r)
    g.quadraticCurveTo(r * 0.25, -r * 0.25, r * 0.8, 0)
    g.quadraticCurveTo(r * 0.25, r * 0.25, 0, r)
    g.quadraticCurveTo(-r * 0.25, r * 0.25, -r * 0.8, 0)
    g.quadraticCurveTo(-r * 0.25, -r * 0.25, 0, -r)
  },
  paus: (g, r) => {
    const f = r * 0.4
    g.moveTo(f, -r * 0.45)
    g.arc(0, -r * 0.45, f, 0, Math.PI * 2)
    g.moveTo(-r * 0.45 + f, r * 0.12)
    g.arc(-r * 0.45, r * 0.12, f, 0, Math.PI * 2)
    g.moveTo(r * 0.45 + f, r * 0.12)
    g.arc(r * 0.45, r * 0.12, f, 0, Math.PI * 2)
    g.moveTo(0, 0)
    g.lineTo(r * 0.35, r)
    g.lineTo(-r * 0.35, r)
    g.closePath()
  },
}

// Barra neon (lasers, lanças, paredes): miolo de 24x24 numa tela de 32x32
function barra() {
  const [c, g] = tela(TAM_BALA, TAM_BALA)
  g.fillStyle = '#ffffff'
  g.shadowColor = 'rgba(255,255,255,0.9)'
  g.shadowBlur = 4
  g.fillRect(4, 4, 24, 24)
  return c
}

// Lâmina da foice: comprida, afinando nas pontas
function foice() {
  const [c, g] = tela(128, 32)
  g.imageSmoothingEnabled = true
  g.fillStyle = '#ffffff'
  g.shadowColor = 'rgba(255,255,255,0.9)'
  g.shadowBlur = 5
  g.beginPath()
  g.moveTo(4, 16)
  g.quadraticCurveTo(40, 2, 64, 10)
  g.quadraticCurveTo(88, 2, 124, 16)
  g.quadraticCurveTo(88, 30, 64, 22)
  g.quadraticCurveTo(40, 30, 4, 16)
  g.fill()
  return c
}

function bomba() {
  const [c, g] = tela(TAM_BALA, TAM_BALA)
  g.imageSmoothingEnabled = true
  g.fillStyle = '#2a1840'
  g.beginPath()
  g.arc(16, 18, 10, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#6a4aa0'
  g.beginPath()
  g.arc(13, 15, 3, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#c8a060'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(16, 8)
  g.quadraticCurveTo(20, 3, 24, 5)
  g.stroke()
  g.fillStyle = '#ffe040'
  g.fillRect(23, 3, 4, 4)
  return c
}

function degrade(tamanho, paradas) {
  const [c, g] = tela(tamanho, tamanho)
  const grad = g.createRadialGradient(tamanho / 2, tamanho / 2, 0, tamanho / 2, tamanho / 2, tamanho / 2)
  paradas.forEach(([p, cor]) => grad.addColorStop(p, cor))
  g.fillStyle = grad
  g.fillRect(0, 0, tamanho, tamanho)
  return c
}

// ---------- tela de vitória ----------

// Tirinha de confete branca (pintada com tint)
function confete() {
  const [c, g] = tela(4, 8)
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 4, 8)
  g.fillStyle = 'rgba(0,0,0,0.25)' // meia sombra: o giro fica visível
  g.fillRect(0, 5, 4, 3)
  return c
}

// ---------- cartas (entities/Carta.js) ----------

// Halo de carta: retângulo arredondado bem desfocado (pintado com tint, ADD).
// A carta de 70x100 ocupa o miolo; a borda é o brilho que vaza.
function cartaBrilho() {
  const [c, g] = tela(128, 160)
  g.imageSmoothingEnabled = true
  g.fillStyle = '#ffffff'
  g.shadowColor = 'rgba(255,255,255,1)'
  g.shadowBlur = 16
  g.beginPath()
  g.roundRect(29, 30, 70, 100, 10)
  g.fill()
  g.shadowBlur = 24
  g.fill()
  return c
}

// Estrela de 5 pontas branca com brilho
function estrela() {
  const [c, g] = tela(24, 24)
  g.imageSmoothingEnabled = true
  g.translate(12, 12)
  const pontos = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 4 : 10
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pontos.push([Math.cos(a) * r, Math.sin(a) * r])
  }
  g.fillStyle = '#ffffff'
  g.shadowColor = 'rgba(255,255,255,0.9)'
  g.shadowBlur = 4
  g.beginPath()
  poligono(g, pontos)
  g.fill()
  return c
}

// Raio de luz: cunha que abre para cima e some na ponta (a origem fica embaixo)
function raio() {
  const [c, g] = tela(64, 320)
  g.imageSmoothingEnabled = true
  const grad = g.createLinearGradient(0, 320, 0, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.beginPath()
  poligono(g, [[32, 320], [0, 0], [64, 0]])
  g.fill()
  return c
}

function aviso() {
  const [c, g] = tela(16, 16)
  g.fillStyle = '#ffffff'
  poligonoPreenchido(g, [[8, 1], [15, 14], [1, 14]])
  g.fillStyle = '#000000'
  g.fillRect(7, 5, 2, 5)
  g.fillRect(7, 11, 2, 2)
  return c
}

function poligonoPreenchido(g, pontos) {
  g.beginPath()
  poligono(g, pontos)
  g.fill()
}

// Coração do jogador (branco: o jogo pinta com a cor de cada um)
const coracao = () => pixelArt(CORACAO_MAPA, { '#': '#ffffff' })

// ---------- fundos ----------

function tileLosangos() {
  const [c, g] = tela(64, 64)
  g.fillStyle = '#120a24'
  g.fillRect(0, 0, 64, 64)
  const losango = (cx, cy, cor) => {
    g.fillStyle = cor
    poligonoPreenchido(g, [[cx, cy - 16], [cx + 16, cy], [cx, cy + 16], [cx - 16, cy]])
  }
  losango(32, 32, '#2a1650')
  losango(0, 0, '#16204a')
  losango(64, 0, '#16204a')
  losango(0, 64, '#16204a')
  losango(64, 64, '#16204a')
  g.strokeStyle = '#3a2470'
  g.lineWidth = 1
  g.strokeRect(0.5, 0.5, 63, 63)
  return c
}

function cidade(perto) {
  const largura = 320
  const altura = 160
  const [c, g] = tela(largura, altura)
  let x = 0
  let semente = perto ? 7 : 3
  const aleatorio = () => {
    semente = (semente * 16807) % 2147483647
    return semente / 2147483647
  }
  while (x < largura) {
    const w = 18 + Math.floor(aleatorio() * 26)
    const h = (perto ? 60 : 90) + Math.floor(aleatorio() * (perto ? 50 : 60))
    g.fillStyle = perto ? '#070a18' : '#0d1430'
    g.fillRect(x, altura - h, w, h)
    for (let wy = altura - h + 6; wy < altura - 4; wy += 8) {
      for (let wx = x + 3; wx < x + w - 4; wx += 6) {
        if (aleatorio() < 0.45) continue
        g.fillStyle = aleatorio() < 0.5 ? (perto ? '#ff4fc8' : '#40f0ff') : '#1a2a50'
        g.fillRect(wx, wy, 2, 3)
      }
    }
    x += w + 2
  }
  return c
}

// ---------- tabela de geradores (uma entrada por chave de assets.js) ----------

const sprite = (id) => () => pixelArt(SPRITES[id].mapa, SPRITES[id].paleta, id)
const bala = (forma) => () => formaBrilhante(FORMAS[forma])

// Pixel art apoiada no chão: tira as linhas vazias de baixo e completa em cima
// até a altura padrão (o sprite é centrado, então assim os pés de todos ficam
// na mesma linha)
const vaziaLinha = (l) => /^\.*$/.test(l)
function apoiarNoChao(mapa, altura) {
  let fim = mapa.length
  while (fim > 0 && vaziaLinha(mapa[fim - 1])) fim--
  const corpo = mapa.slice(0, fim)
  const vazia = '.'.repeat(Math.max(...mapa.map((l) => l.length)))
  return [...Array(Math.max(0, altura - corpo.length)).fill(vazia), ...corpo]
}
const spriteNoChao = (id, altura) => () => pixelArt(apoiarNoChao(SPRITES[id].mapa, altura), SPRITES[id].paleta, id)
// personagens jogáveis, com os pés na mesma linha
const personagens = Object.fromEntries(Object.keys(PERSONAGENS).map((id) => [id, spriteNoChao(id, 24)]))

const GERADORES = {
  ...personagens,
  king: sprite('king'),
  queen: sprite('queen'),
  jevil: sprite('jevil'),
  coronel: sprite('coronel'),
  // colorida: a caminhonete usa cor 0xffffff na bala para não ser pintada pelo tema
  'bala-caminhonete': sprite('caminhonete'),

  coracao,
  faisca: () => degrade(8, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]),
  brilho: () => degrade(64, [[0, 'rgba(255,255,255,0.9)'], [0.4, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]),
  // vinheta branca (pintada com tint): centro livre, bordas e cantos fechando
  vinheta: () => degrade(128, [[0, 'rgba(255,255,255,0)'], [0.55, 'rgba(255,255,255,0)'], [0.85, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0.9)']]),
  aviso,
  confete,
  estrela,
  'carta-brilho': cartaBrilho,
  raio,

  'bala-bola': bala('bola'),
  'bala-chama': bala('chama'),
  'bala-losango': bala('losango'),
  'bala-coroa': bala('coroa'),
  'bala-hex': bala('hex'),
  'bala-espadas': bala('espadas'),
  'bala-copas': bala('copas'),
  'bala-ouros': bala('ouros'),
  'bala-paus': bala('paus'),
  'bala-barra': barra,
  'bala-foice': foice,
  bomba,

  'fundo-king-losangos': tileLosangos,
  'fundo-queen-cidade': () => cidade(false),
  'fundo-queen-cidade-perto': () => cidade(true),
}
