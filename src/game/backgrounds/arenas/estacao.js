import Phaser from 'phaser'
import { LARGURA, ALTURA, CENTRO_X } from '../../constants.js'
import { criarSorte, criarTextura, limitar, fbm3, retArredondado } from './arteFundos.js'

// ESTAÇÃO ESPACIAL: o salão de uma estação em órbita, olhando pela janela panorâmica.
// Camadas, de trás para a frente:
//   - o espaço (textura fixa: degradê, nebulosas e estrelinhas) e três camadas de estrelas
//     em PARALAXE (a estação se move: cada camada corre numa velocidade) que piscam;
//   - o Sol, um clarão no canto de cima, e a TERRA no meio de baixo, girando devagar (uma volta
//     em ~7 min: 20 quadros de uma esfera sombreada, com dois vizinhos em fusão para ficar
//     suave), com atmosfera, nuvens, continentes e luzes das cidades no lado da noite;
//   - coisas FLUTUANDO e passando pela janela: um astronauta preso por um cabo à comporta,
//     um satélite com painéis solares e uma caixa de carga, girando devagar;
//   - a estrutura (textura fixa): pilares das bordas com a COMPORTA (AIRLOCK) na esquerda e o
//     painel de controle na direita, a viga de cima com as luzes da janela, o console de baixo
//     e o reflexo do vidro;
//   - as luzes que PISCAM dos consoles, o osciloscópio do painel, a luz da comporta (verde,
//     de vez em quando âmbar piscando com a sirene) e a vinheta.
// O miolo (entre as caixas e atrás delas) é só espaço e planeta: o detalhe fica nas bordas.

const TERRA = { x: CENTRO_X, y: 408, raio: 218, quadros: 20, lado: 256, periodoMs: 420000 }
const SOL = { x: 800, y: 70 }
const PILAR = 62

const LEDS_DIREITA = Array.from({ length: 24 }, (_, i) => ({ x: 810 + (i % 3) * 14, y: 206 + Math.floor(i / 3) * 14 }))
const LEDS_BAIXO = Array.from({ length: 30 }, (_, i) => ({ x: 120 + i * 20.5 + (i % 2) * 2, y: 462 + (i % 3) * 5 }))
const CORES_LED = [0x40ff90, 0x40d0ff, 0xffc040, 0xff5a50, 0x9a7aff]

// ---------- a Terra ----------
// Um mapa 512x256 (continentes e nuvens por ruído 3D, sem emenda) e uma esfera sombreada por quadro
function gerarTerra(scene) {
  const chaves = Array.from({ length: TERRA.quadros }, (_, k) => `arena-estacao-terra-${k}`)
  if (scene.textures.exists(chaves[0])) return chaves
  const W = 512
  const H = 256
  const terra = new Float32Array(W * H)
  const nuvem = new Float32Array(W * H)
  for (let v = 0; v < H; v++) {
    const lat = (v / H - 0.5) * Math.PI
    for (let u = 0; u < W; u++) {
      const lon = (u / W) * Math.PI * 2
      const px = Math.cos(lat) * Math.cos(lon)
      const py = Math.sin(lat)
      const pz = Math.cos(lat) * Math.sin(lon)
      terra[v * W + u] = fbm3(px * 2.1 + 7, py * 2.1 + 7, pz * 2.1 + 7, 5)
      nuvem[v * W + u] = fbm3(px * 3.2 + 31, py * 5.2 + 31, pz * 3.2 + 31, 4)
    }
  }
  const N = TERRA.lado
  // por pixel: longitude/latitude e luz (fixos), só a rotação muda de quadro para quadro
  const lonBase = new Float32Array(N * N)
  const vIdx = new Int16Array(N * N).fill(-1)
  const luz = new Float32Array(N * N)
  const borda = new Float32Array(N * N)
  const tau = -0.38
  const L = { x: -0.5, y: -0.42, z: 0.76 }
  const nl = Math.hypot(L.x, L.y, L.z)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const nx = (i + 0.5 - N / 2) / (N / 2)
      const ny = (j + 0.5 - N / 2) / (N / 2)
      const r2 = nx * nx + ny * ny
      if (r2 >= 1) continue
      const nz = Math.sqrt(1 - r2)
      const x2 = nx * Math.cos(tau) - ny * Math.sin(tau)
      const y2 = nx * Math.sin(tau) + ny * Math.cos(tau)
      const k = j * N + i
      lonBase[k] = Math.atan2(nz, x2)
      vIdx[k] = Math.min(H - 1, Math.max(0, Math.floor((Math.asin(limitar(-y2, -1, 1)) / Math.PI + 0.5) * H)))
      luz[k] = limitar((nx * L.x + ny * L.y + nz * L.z) / nl, -1, 1)
      borda[k] = Math.sqrt(r2)
    }
  }
  chaves.forEach((chave, q) => {
    const rot = (q / TERRA.quadros) * Math.PI * 2
    criarTextura(scene, chave, N, N, (g) => {
      const img = g.createImageData(N, N)
      const d = img.data
      for (let k = 0; k < N * N; k++) {
        if (vIdx[k] < 0) continue
        const v = vIdx[k]
        const u = Math.floor((((lonBase[k] + rot) / (Math.PI * 2)) % 1 + 1) % 1 * W) % W
        const uc = Math.floor((((lonBase[k] + rot * 1.18) / (Math.PI * 2)) % 1 + 1) % 1 * W) % W
        const e = terra[v * W + u]
        const c = nuvem[v * W + uc]
        const lat = Math.abs(v / H - 0.5) * Math.PI
        let r
        let gg
        let b
        const terraFirme = e > 0.545
        if (terraFirme) {
          const h = (e - 0.545) / 0.2
          if (lat > 1.28 || h > 0.85) [r, gg, b] = [232, 238, 244]
          else if (h > 0.5) [r, gg, b] = [128, 108, 70]
          else if (h > 0.18) [r, gg, b] = [64, 126, 58]
          else [r, gg, b] = [100, 140, 70]
        } else {
          const p = limitar((e - 0.3) / 0.25, 0, 1)
          ;[r, gg, b] = [10 + 28 * p, 36 + 66 * p, 84 + 88 * p]
        }
        if (lat > 1.36 && !terraFirme) [r, gg, b] = [214, 226, 238] // gelo do polo
        // nuvens
        const nv = limitar((c - 0.5) * 3.2, 0, 0.88)
        r += (246 - r) * nv
        gg += (248 - gg) * nv
        b += (252 - b) * nv
        // luz: dia, terminador alaranjado e noite com luzes de cidade
        const dl = luz[k]
        const dia = limitar(dl * 1.25 + 0.12, 0, 1)
        const sombra = 0.1 + 0.95 * dia ** 0.85
        r *= sombra
        gg *= sombra
        b *= sombra
        if (dl > -0.08 && dl < 0.22) {
          const t = 1 - Math.abs(dl - 0.07) / 0.15
          r += 46 * t * (1 - nv * 0.5)
          gg += 14 * t
        }
        if (dl < 0.05 && terraFirme && e < 0.66) {
          const cidade = ((k * 2654435761) >>> 0) / 4294967296
          if (cidade > 0.955) {
            const f = limitar((0.05 - dl) * 8, 0, 1)
            r += 255 * f
            gg += 190 * f
            b += 90 * f
          }
        }
        // atmosfera: um véu azul-claro na borda do lado iluminado
        const rim = borda[k] ** 6
        const aura = rim * (0.35 + 0.65 * dia)
        r += (110 - r) * aura * 0.8
        gg += (190 - gg) * aura * 0.8
        b += (255 - b) * aura * 0.8
        const alpha = limitar((1 - borda[k]) * N * 0.5, 0, 1)
        d[k * 4] = limitar(r, 0, 255)
        d[k * 4 + 1] = limitar(gg, 0, 255)
        d[k * 4 + 2] = limitar(b, 0, 255)
        d[k * 4 + 3] = alpha * 255
      }
      g.putImageData(img, 0, 0)
    })
  })
  return chaves
}

// ---------- texturas fixas ----------
function texturaEspaco(scene) {
  return criarTextura(scene, 'arena-estacao-espaco', LARGURA, ALTURA, (g) => {
    const sorte = criarSorte(77)
    const grad = g.createLinearGradient(0, 0, 0, ALTURA)
    grad.addColorStop(0, '#02030a')
    grad.addColorStop(0.55, '#050a1c')
    grad.addColorStop(1, '#0a1230')
    g.fillStyle = grad
    g.fillRect(0, 0, LARGURA, ALTURA)
    // nebulosas: manchas suaves
    const manchas = [
      [180, 150, 260, '90,60,170', 0.16],
      [660, 260, 300, '40,90,190', 0.14],
      [420, 60, 200, '170,60,130', 0.09],
      [90, 380, 200, '40,130,170', 0.1],
    ]
    for (const [x, y, r, cor, a] of manchas) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r)
      rg.addColorStop(0, `rgba(${cor},${a})`)
      rg.addColorStop(1, `rgba(${cor},0)`)
      g.fillStyle = rg
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }
    g.fillStyle = 'rgba(255,255,255,0.5)'
    for (let i = 0; i < 160; i++) g.fillRect(Math.floor(sorte() * LARGURA), Math.floor(sorte() * ALTURA), 1, 1)
  })
}

function texturaAtmosfera(scene) {
  const n = 640
  return criarTextura(scene, 'arena-estacao-atmosfera', n, n, (g) => {
    const rg = g.createRadialGradient(n / 2, n / 2, (TERRA.raio - 6) * 1, n / 2, n / 2, TERRA.raio + 64)
    rg.addColorStop(0, 'rgba(110,190,255,0.55)')
    rg.addColorStop(0.3, 'rgba(70,140,255,0.22)')
    rg.addColorStop(1, 'rgba(40,90,255,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, n, n)
  })
}

function texturaBrilho(scene) {
  return criarTextura(scene, 'arena-estacao-brilho', 128, 128, (g) => {
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    rg.addColorStop(0, 'rgba(255,255,255,1)')
    rg.addColorStop(0.25, 'rgba(255,255,255,0.4)')
    rg.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, 128, 128)
  })
}

// a estrutura da estação (por cima do espaço e do planeta)
function texturaEstrutura(scene) {
  return criarTextura(scene, 'arena-estacao-estrutura', LARGURA, ALTURA, (g) => {
    const metal = (x, y, w, h, horizontal = true) => {
      const gr = horizontal ? g.createLinearGradient(x, y, x, y + h) : g.createLinearGradient(x, y, x + w, y)
      gr.addColorStop(0, '#2c3446')
      gr.addColorStop(0.5, '#1c2230')
      gr.addColorStop(1, '#10141e')
      g.fillStyle = gr
      g.fillRect(x, y, w, h)
    }
    const parafuso = (x, y) => {
      g.fillStyle = '#4a5468'
      g.beginPath()
      g.arc(x, y, 1.8, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#0c0f16'
      g.fillRect(x - 0.5, y - 1.4, 1, 2.8)
    }
    // viga de cima
    metal(0, 0, LARGURA, 54)
    g.fillStyle = '#0a0d14'
    g.fillRect(0, 50, LARGURA, 6)
    g.fillStyle = '#4a5878'
    g.fillRect(0, 48, LARGURA, 1)
    for (let x = 90; x < LARGURA - 80; x += 60) {
      g.fillStyle = '#07090f'
      retArredondado(g, x, 12, 40, 14, 4)
      g.fill()
      g.fillStyle = 'rgba(120,200,255,0.28)'
      retArredondado(g, x + 2, 14, 36, 10, 3)
      g.fill()
      parafuso(x - 8, 19)
    }
    // pilares das bordas
    for (const lado of [0, 1]) {
      const x0 = lado ? LARGURA - PILAR : 0
      metal(x0, 0, PILAR, ALTURA, false)
      if (lado) {
        const inv = g.createLinearGradient(x0, 0, x0 + PILAR, 0)
        inv.addColorStop(0, '#10141e')
        inv.addColorStop(1, '#2c3446')
        g.fillStyle = inv
        g.fillRect(x0, 0, PILAR, ALTURA)
      }
      const xi = lado ? x0 : x0 + PILAR - 2
      g.fillStyle = '#5a6a8c'
      g.fillRect(xi, 0, 2, ALTURA)
      g.fillStyle = '#05070c'
      g.fillRect(lado ? x0 - 3 : x0 + PILAR + 1, 0, 3, ALTURA)
      for (let y = 70; y < ALTURA; y += 56) {
        g.fillStyle = 'rgba(0,0,0,0.5)'
        g.fillRect(x0, y, PILAR, 2)
        g.fillStyle = 'rgba(120,140,180,0.2)'
        g.fillRect(x0, y + 2, PILAR, 1)
        parafuso(x0 + 8, y + 8)
        parafuso(x0 + PILAR - 8, y + 8)
      }
    }
    // COMPORTA (esquerda): moldura com listras de perigo, porta, janelinha e roda
    const cx = 31
    g.fillStyle = '#0a0c12'
    retArredondado(g, 6, 140, 50, 170, 6)
    g.fill()
    for (let k = 0; k < 14; k++) {
      g.fillStyle = k % 2 ? '#14161c' : '#e8b820'
      g.fillRect(8 + (k % 2 ? 0 : 0), 142 + k * 6, 4, 6)
      g.fillRect(50, 142 + k * 6, 4, 6)
    }
    metal(14, 146, 34, 158)
    g.fillStyle = '#3a455c'
    g.fillRect(14, 146, 34, 2)
    g.strokeStyle = '#0a0c12'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(cx, 148)
    g.lineTo(cx, 302)
    g.stroke()
    // vigia redonda
    g.fillStyle = '#05070e'
    g.beginPath()
    g.arc(cx, 200, 12.5, 0, Math.PI * 2)
    g.fill()
    const vidro = g.createRadialGradient(cx - 3, 197, 1, cx, 200, 11)
    vidro.addColorStop(0, '#2a4a8a')
    vidro.addColorStop(1, '#06102a')
    g.fillStyle = vidro
    g.beginPath()
    g.arc(cx, 200, 10, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.8)'
    g.fillRect(cx - 4, 196, 1.4, 1.4)
    g.fillRect(cx + 3, 203, 1, 1)
    g.strokeStyle = '#5a6a8c'
    g.lineWidth = 2
    g.beginPath()
    g.arc(cx, 200, 12, 0, Math.PI * 2)
    g.stroke()
    // roda de abrir
    g.strokeStyle = '#8a98b4'
    g.lineWidth = 3
    g.beginPath()
    g.arc(cx, 258, 14, 0, Math.PI * 2)
    g.stroke()
    g.lineWidth = 2.5
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3
      g.beginPath()
      g.moveTo(cx - Math.cos(a) * 14, 258 - Math.sin(a) * 14)
      g.lineTo(cx + Math.cos(a) * 14, 258 + Math.sin(a) * 14)
      g.stroke()
    }
    g.fillStyle = '#c0cae0'
    g.beginPath()
    g.arc(cx, 258, 3.4, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#05070c'
    retArredondado(g, cx - 12, 154, 24, 12, 3)
    g.fill()
    // PAINEL de controle (direita): tela, botões, alavancas
    const px = LARGURA - PILAR + 6
    g.fillStyle = '#0a0c12'
    retArredondado(g, px - 2, 112, 54, 230, 6)
    g.fill()
    metal(px, 116, 50, 222)
    g.fillStyle = '#02060c'
    retArredondado(g, px + 4, 124, 42, 52, 4)
    g.fill()
    g.strokeStyle = '#4a5878'
    g.lineWidth = 1.5
    retArredondado(g, px + 4, 124, 42, 52, 4)
    g.stroke()
    for (let k = 0; k < 3; k++) {
      g.fillStyle = '#05070c'
      g.fillRect(px + 8 + k * 12, 290, 8, 36)
      g.fillStyle = k % 2 ? '#c05050' : '#8a98b4'
      g.fillRect(px + 7 + k * 12, 296 + k * 8, 10, 6)
    }
    for (const [x, y] of [[px + 12, 276], [px + 38, 276]]) {
      g.fillStyle = '#05070c'
      g.beginPath()
      g.arc(x, y, 7, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#8a98b4'
      g.lineWidth = 1.5
      g.beginPath()
      g.arc(x, y, 5, 0, Math.PI * 2)
      g.moveTo(x, y)
      g.lineTo(x + 3, y - 3)
      g.stroke()
    }
    // console de baixo: faixa inclinada com a fileira de luzes
    g.fillStyle = '#0a0d14'
    g.beginPath()
    g.moveTo(PILAR - 3, ALTURA)
    g.lineTo(PILAR + 40, 446)
    g.lineTo(LARGURA - PILAR - 40, 446)
    g.lineTo(LARGURA - PILAR + 3, ALTURA)
    g.closePath()
    g.fill()
    const cons = g.createLinearGradient(0, 446, 0, ALTURA)
    cons.addColorStop(0, '#2a3248')
    cons.addColorStop(1, '#0c1018')
    g.fillStyle = cons
    g.beginPath()
    g.moveTo(PILAR, ALTURA)
    g.lineTo(PILAR + 44, 450)
    g.lineTo(LARGURA - PILAR - 44, 450)
    g.lineTo(LARGURA - PILAR, ALTURA)
    g.closePath()
    g.fill()
    g.strokeStyle = '#5a6a8c'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(PILAR + 44, 450)
    g.lineTo(LARGURA - PILAR - 44, 450)
    g.stroke()
    for (let x = PILAR + 70; x < LARGURA - PILAR - 60; x += 38) {
      g.fillStyle = '#05070c'
      retArredondado(g, x, 456, 26, 11, 3)
      g.fill()
    }
    // reflexo do vidro: duas faixas diagonais bem fracas
    g.fillStyle = 'rgba(180,220,255,0.035)'
    g.beginPath()
    g.moveTo(180, 56)
    g.lineTo(260, 56)
    g.lineTo(130, 440)
    g.lineTo(50, 440)
    g.closePath()
    g.fill()
    g.beginPath()
    g.moveTo(300, 56)
    g.lineTo(330, 56)
    g.lineTo(220, 440)
    g.lineTo(190, 440)
    g.closePath()
    g.fill()
  })
}

function texturaVinheta(scene) {
  return criarTextura(scene, 'arena-estacao-vinheta', LARGURA, ALTURA, (g) => {
    const rg = g.createRadialGradient(CENTRO_X, ALTURA / 2, 180, CENTRO_X, ALTURA / 2, 560)
    rg.addColorStop(0, 'rgba(0,0,8,0)')
    rg.addColorStop(1, 'rgba(0,0,8,0.62)')
    g.fillStyle = rg
    g.fillRect(0, 0, LARGURA, ALTURA)
  })
}

// ---------- coisas que flutuam ----------
function texturaAstronauta(scene) {
  return criarTextura(scene, 'arena-estacao-astronauta', 72, 90, (g) => {
    g.fillStyle = '#c8d0dc'
    retArredondado(g, 14, 30, 16, 34, 6) // mochila
    g.fill()
    g.fillStyle = '#e8ecf4'
    retArredondado(g, 24, 26, 30, 38, 10) // tronco
    g.fill()
    g.fillStyle = '#d4dae6'
    retArredondado(g, 30, 60, 11, 24, 5) // perna
    g.fill()
    retArredondado(g, 41, 60, 11, 22, 5)
    g.fill()
    g.fillStyle = '#9aa4b8'
    g.fillRect(30, 80, 11, 6)
    g.fillRect(41, 78, 11, 6)
    g.fillStyle = '#e8ecf4'
    retArredondado(g, 46, 30, 20, 9, 4.5) // braço de frente
    g.fill()
    retArredondado(g, 22, 40, 8, 20, 4) // braço de trás
    g.fill()
    g.fillStyle = '#e8483c'
    g.fillRect(28, 44, 22, 3)
    g.fillStyle = '#4ac0ff'
    g.fillRect(32, 50, 6, 4)
    g.fillStyle = '#f2f4fa'
    g.beginPath()
    g.arc(42, 18, 14, 0, Math.PI * 2) // capacete
    g.fill()
    const visor = g.createLinearGradient(32, 10, 52, 28)
    visor.addColorStop(0, '#f4d878')
    visor.addColorStop(0.5, '#c88a20')
    visor.addColorStop(1, '#6a3a08')
    g.fillStyle = visor
    retArredondado(g, 34, 10, 19, 15, 7)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.7)'
    g.fillRect(37, 12, 6, 2)
    g.strokeStyle = '#8a94a8'
    g.lineWidth = 1.5
    g.beginPath()
    g.arc(42, 18, 14, 0, Math.PI * 2)
    g.stroke()
  })
}

function texturaSatelite(scene) {
  return criarTextura(scene, 'arena-estacao-satelite', 96, 44, (g) => {
    for (const x of [2, 62]) {
      g.fillStyle = '#17306a'
      g.fillRect(x, 8, 32, 28)
      g.strokeStyle = '#6a8ad8'
      g.lineWidth = 1
      for (let k = 1; k < 4; k++) {
        g.beginPath()
        g.moveTo(x + k * 8, 8)
        g.lineTo(x + k * 8, 36)
        g.stroke()
      }
      g.beginPath()
      g.moveTo(x, 22)
      g.lineTo(x + 32, 22)
      g.stroke()
    }
    g.fillStyle = '#d8b040'
    g.fillRect(34, 12, 28, 20)
    g.fillStyle = '#a07820'
    g.fillRect(34, 12, 28, 3)
    g.fillStyle = '#c8cdd8'
    g.fillRect(46, 2, 4, 10)
    g.beginPath()
    g.arc(48, 3, 4, Math.PI, 0)
    g.fill()
    g.fillStyle = '#ff4a40'
    g.fillRect(38, 24, 3, 3)
  })
}

function texturaCaixa(scene) {
  return criarTextura(scene, 'arena-estacao-caixa', 44, 44, (g) => {
    g.fillStyle = '#6a7a96'
    retArredondado(g, 4, 4, 36, 36, 4)
    g.fill()
    g.strokeStyle = '#2a3448'
    g.lineWidth = 2
    retArredondado(g, 4, 4, 36, 36, 4)
    g.stroke()
    g.fillStyle = '#e8b820'
    for (let k = 0; k < 4; k++) g.fillRect(8 + k * 8, 28, 4, 8)
    g.fillStyle = '#2a3448'
    g.fillRect(10, 10, 24, 12)
    g.fillStyle = '#4ac0ff'
    g.fillRect(12, 13, 10, 2)
    g.fillRect(12, 17, 16, 2)
  })
}

export default function estacao(scene, objetos) {
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }
  const ADD = Phaser.BlendModes.ADD

  add(scene.add.image(0, 0, texturaEspaco(scene)).setOrigin(0))

  // estrelas em paralaxe: 3 camadas (longe, meio, perto)
  const sorte = criarSorte(4242)
  const camadas = [
    { n: 70, vel: 3, tam: 1, alpha: 0.55 },
    { n: 40, vel: 8, tam: 1.5, alpha: 0.75 },
    { n: 18, vel: 20, tam: 2, alpha: 0.95 },
  ].map((c) => ({ ...c, estrelas: Array.from({ length: c.n }, () => ({ x: sorte() * LARGURA, y: 58 + sorte() * (ALTURA - 100), fase: sorte() * 6.28, cor: sorte() < 0.15 ? 0xffd8a0 : sorte() < 0.3 ? 0xa8c8ff : 0xffffff })) }))
  const gEstrelas = add(scene.add.graphics())

  // o Sol: clarão no canto de cima (pulsa devagar) com um reflexo comprido
  const sol = add(scene.add.image(SOL.x, SOL.y, texturaBrilho(scene)).setDisplaySize(360, 360).setBlendMode(ADD).setTint(0xffe8b0).setAlpha(0.55))
  const solNucleo = add(scene.add.image(SOL.x, SOL.y, texturaBrilho(scene)).setDisplaySize(90, 90).setBlendMode(ADD).setTint(0xffffff))
  const raioSol = add(scene.add.image(SOL.x, SOL.y, texturaBrilho(scene)).setDisplaySize(900, 22).setBlendMode(ADD).setTint(0xffd890).setAlpha(0.22))

  // a Terra
  const quadros = gerarTerra(scene)
  const atmosfera = add(scene.add.image(TERRA.x, TERRA.y, texturaAtmosfera(scene)).setBlendMode(ADD))
  const esc = (TERRA.raio * 2) / TERRA.lado
  const terraA = add(scene.add.image(TERRA.x, TERRA.y, quadros[0]).setScale(esc))
  const terraB = add(scene.add.image(TERRA.x, TERRA.y, quadros[1]).setScale(esc).setAlpha(0))

  // objetos flutuando pela janela
  const astronauta = add(scene.add.image(0, 0, texturaAstronauta(scene)).setScale(0.8).setVisible(false))
  const satelite = add(scene.add.image(0, 0, texturaSatelite(scene)).setScale(0.85).setVisible(false))
  const caixa = add(scene.add.image(0, 0, texturaCaixa(scene)).setScale(0.9).setVisible(false))
  const cabo = add(scene.add.graphics())
  const flutuantes = [
    { obj: astronauta, tipo: 'astronauta', periodo: 78000, atraso: 4000, y: 92, amp: 10, giro: 0.12, dir: 1 },
    { obj: satelite, tipo: 'satelite', periodo: 64000, atraso: 30000, y: 322, amp: 14, giro: 0.05, dir: -1 },
    { obj: caixa, tipo: 'caixa', periodo: 52000, atraso: 52000, y: 306, amp: 20, giro: 0.35, dir: 1 },
  ]

  // a estrutura e as luzes
  add(scene.add.image(0, 0, texturaEstrutura(scene)).setOrigin(0))
  const gLuzes = add(scene.add.graphics())
  const ledEstado = [...LEDS_DIREITA, ...LEDS_BAIXO].map((p, i) => ({ ...p, periodo: 500 + ((i * 337) % 1700), fase: (i * 911) % 2000, cor: CORES_LED[i % CORES_LED.length] }))
  add(scene.add.image(0, 0, texturaVinheta(scene)).setOrigin(0))

  const desenharTerra = (tempo) => {
    const vol = ((tempo / TERRA.periodoMs) % 1) * TERRA.quadros
    const k = Math.floor(vol)
    terraA.setTexture(quadros[k % TERRA.quadros])
    terraB.setTexture(quadros[(k + 1) % TERRA.quadros]).setAlpha(vol - k)
  }

  return {
    atualizar(dt, estado) {
      const t = estado.tempo
      desenharTerra(t)
      atmosfera.setAlpha(0.8 + 0.2 * Math.sin(t / 2600))
      sol.setAlpha(0.5 + 0.1 * Math.sin(t / 1800))
      solNucleo.setScale(0.7 + 0.03 * Math.sin(t / 900))
      raioSol.setAlpha(0.2 + 0.05 * Math.sin(t / 1300))

      // estrelas: correm para a esquerda (a estação anda) e piscam
      gEstrelas.clear()
      for (const c of camadas) {
        for (const e of c.estrelas) {
          e.x -= (c.vel * dt) / 1000
          if (e.x < -2) e.x += LARGURA + 4
          const piscar = 0.6 + 0.4 * Math.sin(t / (500 + c.vel * 30) + e.fase)
          gEstrelas.fillStyle(e.cor, c.alpha * piscar)
          gEstrelas.fillRect(Math.round(e.x), Math.round(e.y), c.tam, c.tam)
        }
      }

      // coisas flutuando: cada uma atravessa a janela devagar, girando
      cabo.clear()
      for (const f of flutuantes) {
        const ciclo = f.periodo
        const p = ((t - f.atraso) % ciclo + ciclo) % ciclo / ciclo
        const ativo = t >= f.atraso && p < 0.82
        f.obj.setVisible(ativo)
        if (!ativo) continue
        const q = p / 0.82
        const x = f.dir > 0 ? -60 + q * (LARGURA + 120) : LARGURA + 60 - q * (LARGURA + 120)
        const y = f.y + Math.sin(t / 3100 + f.atraso) * f.amp
        f.obj.setPosition(x, y).setRotation(t / 1000 * f.giro + f.atraso)
        if (f.tipo === 'astronauta') {
          // o cabo sai da comporta (esquerda) e faz uma barriga até o astronauta
          const mx = (x + 54) / 2
          const my = Math.max(y, 225) + 40 + Math.sin(t / 900) * 6
          cabo.lineStyle(2, 0xdde4f4, 0.75)
          cabo.beginPath()
          cabo.moveTo(54, 228)
          const passos = 22
          for (let s = 1; s <= passos; s++) {
            const u = s / passos
            cabo.lineTo((1 - u) ** 2 * 54 + 2 * (1 - u) * u * mx + u * u * x, (1 - u) ** 2 * 228 + 2 * (1 - u) * u * my + u * u * y)
          }
          cabo.strokePath()
        }
      }

      // luzes dos consoles
      gLuzes.clear()
      for (const l of ledEstado) {
        const ligada = Math.floor((t + l.fase) / l.periodo) % 3 !== 0
        gLuzes.fillStyle(l.cor, ligada ? 0.95 : 0.12)
        gLuzes.fillRect(l.x, l.y, 5, 3)
        if (ligada) {
          gLuzes.fillStyle(l.cor, 0.16)
          gLuzes.fillRect(l.x - 2, l.y - 2, 9, 7)
        }
      }
      // osciloscópio do painel: duas ondas verdes correndo
      gLuzes.lineStyle(1.5, 0x40ff90, 0.9)
      gLuzes.beginPath()
      for (let i = 0; i <= 38; i += 2) {
        const y = 150 + Math.sin(i * 0.5 + t / 160) * 11 * (0.6 + 0.4 * Math.sin(t / 900)) + Math.sin(i * 1.3 + t / 90) * 3
        if (i === 0) gLuzes.moveTo(808 + i, y)
        else gLuzes.lineTo(808 + i, y)
      }
      gLuzes.strokePath()
      gLuzes.lineStyle(1, 0x40ff90, 0.2)
      gLuzes.strokeRect(806, 128, 40, 44)
      gLuzes.lineBetween(806, 150, 846, 150)
      // luz da comporta: verde parada; a cada ~24 s fica âmbar piscando com o giroflex
      const alerta = ((t + 6000) % 24000) < 4200
      const pisca = Math.sin(t / 110) > 0
      const luz = alerta ? 0xffa020 : 0x40ff90
      gLuzes.fillStyle(luz, alerta ? (pisca ? 1 : 0.25) : 0.9)
      gLuzes.fillCircle(31, 160, 4)
      gLuzes.fillStyle(luz, alerta ? (pisca ? 0.3 : 0.05) : 0.2)
      gLuzes.fillCircle(31, 160, 11)
      if (alerta) {
        const a = t / 140
        gLuzes.fillStyle(0xffb040, 0.2)
        gLuzes.fillTriangle(31, 160, 31 + Math.cos(a) * 34, 160 + Math.sin(a) * 34, 31 + Math.cos(a + 0.4) * 34, 160 + Math.sin(a + 0.4) * 34)
      }
    },
  }
}
