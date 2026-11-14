import Phaser from 'phaser'
import { LARGURA, ALTURA, CENTRO_X } from '../../constants.js'
import { criarSorte, criarTextura, css, retArredondado } from './arteFundos.js'

// CHINATOWN: uma rua de festa à noite. Camadas, de trás para a frente:
//   - o céu (lua cheia grande, estrelas) com nuvenzinhas rasgadas que passam devagar;
//   - o cenário (textura fixa): prédios ao longe com telhados de pagode e janelas acesas, as
//     fachadas das bordas com sacadas e beirais, o PAIFANG (o portal de três vãos com
//     telhados de telha azul-esverdeada, placa dourada e pilares vermelhos) no meio, o
//     chão molhado de pedras refletindo o neon e as barraquinhas de comida nos cantos;
//   - os LETREIROS de néon (originais, os ideogramas são rabiscos inventados) que piscam, um
//     deles com defeito (falha de vez em quando), e o brilho que cai no chão;
//   - os fios de LANTERNAS vermelhas balançando por cima da rua e de uma borda à outra;
//   - VAPOR saindo das panelas das barraquinhas e do bueiro da rua;
//   - o DRAGÃO DA FESTA, que atravessa a rua de vez em quando (sobe e desce em ondas, com
//     os dançarinos de pernas embaixo);
//   - FOGOS DE ARTIFÍCIO que estouram de vez em quando acima do portal;
//   - a vinheta.
// O miolo (atrás das caixas) é só céu, portal e chão escuro: o detalhe fica nas bordas.

const CHAO_Y = 318
const COR = { vermelho: 0xc8201c, ouro: 0xf0b428, telha: 0x2a8a84, neon: [0xff4a7a, 0x40e0ff, 0xffd040, 0x60ff90] }

// ---------- desenho do cenário ----------

// Telhado de pagode com as pontas viradas para cima
function telhado(g, cx, y, w, h, { telha = '#1f6f72', claro = '#46b0a8', escuro = '#124a4e' } = {}) {
  const ponta = 13
  const L = cx - w / 2
  const R = cx + w / 2
  g.beginPath()
  g.moveTo(cx - w * 0.28, y)
  g.quadraticCurveTo(cx - w * 0.38, y + h * 0.9, L - ponta, y + h * 0.78)
  g.quadraticCurveTo(L - 2, y + h * 1.05, L + 8, y + h)
  g.lineTo(R - 8, y + h)
  g.quadraticCurveTo(R + 2, y + h * 1.05, R + ponta, y + h * 0.78)
  g.quadraticCurveTo(cx + w * 0.38, y + h * 0.9, cx + w * 0.28, y)
  g.closePath()
  const grad = g.createLinearGradient(0, y, 0, y + h)
  grad.addColorStop(0, claro)
  grad.addColorStop(0.5, telha)
  grad.addColorStop(1, escuro)
  g.fillStyle = grad
  g.fill()
  // fileiras de telha
  g.strokeStyle = 'rgba(0,30,34,0.5)'
  g.lineWidth = 1
  for (let k = 1; k < 5; k++) {
    g.beginPath()
    const yy = y + (h * k) / 5
    g.moveTo(cx - w * (0.26 + 0.05 * k), yy)
    g.lineTo(cx + w * (0.26 + 0.05 * k), yy)
    g.stroke()
  }
  // cumeeira dourada
  g.fillStyle = '#e8b428'
  retArredondado(g, cx - w * 0.3, y - 3, w * 0.6, 5, 2.5)
  g.fill()
  // beiral: faixa vermelha e dourada
  g.fillStyle = '#7a1210'
  g.fillRect(L + 6, y + h, w - 12, 5)
  g.fillStyle = '#f0b428'
  g.fillRect(L + 6, y + h + 5, w - 12, 2)
}

// rabisco que parece um ideograma (inventado): traços horizontais, verticais e quadradinhos
function ideograma(g, x, y, s, sorte) {
  const t = Math.max(2, s * 0.14)
  g.lineWidth = t
  g.lineCap = 'round'
  const n = 3 + Math.floor(sorte() * 3)
  for (let k = 0; k < n; k++) {
    const a = sorte()
    g.beginPath()
    if (a < 0.35) {
      const yy = y + s * (0.12 + sorte() * 0.76)
      g.moveTo(x + s * 0.08, yy)
      g.lineTo(x + s * (0.55 + sorte() * 0.37), yy)
    } else if (a < 0.65) {
      const xx = x + s * (0.2 + sorte() * 0.6)
      g.moveTo(xx, y + s * 0.06)
      g.lineTo(xx, y + s * (0.55 + sorte() * 0.4))
    } else if (a < 0.82) {
      g.rect(x + s * 0.18, y + s * (0.15 + sorte() * 0.3), s * 0.5, s * 0.3)
    } else {
      g.moveTo(x + s * 0.8, y + s * 0.1)
      g.lineTo(x + s * 0.2, y + s * 0.9)
    }
    g.stroke()
  }
}

function texturaCeu(scene) {
  return criarTextura(scene, 'arena-chinatown-ceu', LARGURA, ALTURA, (g) => {
    const sorte = criarSorte(1313)
    const grad = g.createLinearGradient(0, 0, 0, ALTURA)
    grad.addColorStop(0, '#07051a')
    grad.addColorStop(0.45, '#1c0b34')
    grad.addColorStop(0.72, '#4a1636')
    grad.addColorStop(1, '#2a0a22')
    g.fillStyle = grad
    g.fillRect(0, 0, LARGURA, ALTURA)
    g.fillStyle = 'rgba(255,255,255,0.7)'
    for (let i = 0; i < 90; i++) g.fillRect(Math.floor(sorte() * LARGURA), Math.floor(sorte() * 230), 1, 1)
    // lua cheia, grande e baixa, com halo
    const lx = 628
    const ly = 150
    const halo = g.createRadialGradient(lx, ly, 20, lx, ly, 150)
    halo.addColorStop(0, 'rgba(255,230,170,0.42)')
    halo.addColorStop(1, 'rgba(255,200,140,0)')
    g.fillStyle = halo
    g.fillRect(lx - 150, ly - 150, 300, 300)
    const lua = g.createRadialGradient(lx - 8, ly - 8, 4, lx, ly, 46)
    lua.addColorStop(0, '#fff6d8')
    lua.addColorStop(1, '#e8c888')
    g.fillStyle = lua
    g.beginPath()
    g.arc(lx, ly, 46, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(160,120,70,0.28)'
    for (const [dx, dy, r] of [[-14, -8, 9], [10, 10, 12], [14, -18, 6], [-18, 16, 5]]) {
      g.beginPath()
      g.arc(lx + dx, ly + dy, r, 0, Math.PI * 2)
      g.fill()
    }
  })
}

function texturaCenario(scene) {
  return criarTextura(scene, 'arena-chinatown-cenario', LARGURA, ALTURA, (g) => {
    const sorte = criarSorte(2468)
    // prédios ao longe (silhuetas roxas com janelas acesas e telhados de pagode)
    for (let k = 0; k < 11; k++) {
      const w = 60 + sorte() * 50
      const x = 100 + k * 62 - sorte() * 20
      const topo = 190 + sorte() * 70
      g.fillStyle = k % 2 ? '#1c0f2e' : '#241238'
      g.fillRect(x, topo, w, CHAO_Y - topo + 4)
      if (k % 3 === 0) telhado(g, x + w / 2, topo - 16, w + 10, 18, { telha: '#2a3a6a', claro: '#4a5a9a', escuro: '#161e44' })
      for (let wy = topo + 10; wy < CHAO_Y - 14; wy += 14) {
        for (let wx = x + 8; wx < x + w - 10; wx += 13) {
          if (sorte() < 0.42) {
            g.fillStyle = sorte() < 0.15 ? 'rgba(255,120,90,0.85)' : 'rgba(255,214,120,0.8)'
            g.fillRect(wx, wy, 5, 7)
          }
        }
      }
    }
    // névoa do fundo da rua
    const nevoa = g.createLinearGradient(0, 200, 0, CHAO_Y)
    nevoa.addColorStop(0, 'rgba(120,40,90,0)')
    nevoa.addColorStop(1, 'rgba(180,70,100,0.4)')
    g.fillStyle = nevoa
    g.fillRect(0, 200, LARGURA, CHAO_Y - 200)

    // chão: pedras molhadas, escurecendo para a frente, com reflexos
    const chao = g.createLinearGradient(0, CHAO_Y, 0, ALTURA)
    chao.addColorStop(0, '#3a1a30')
    chao.addColorStop(0.4, '#1c0c1c')
    chao.addColorStop(1, '#0c0610')
    g.fillStyle = chao
    g.fillRect(0, CHAO_Y, LARGURA, ALTURA - CHAO_Y)
    g.strokeStyle = 'rgba(255,255,255,0.05)'
    g.lineWidth = 1
    for (let y = CHAO_Y + 8; y < ALTURA; y += 11 + (y - CHAO_Y) * 0.06) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(LARGURA, y)
      g.stroke()
    }
    // tapete vermelho no meio da rua (do portal para a frente)
    const tapete = g.createLinearGradient(0, CHAO_Y, 0, ALTURA)
    tapete.addColorStop(0, 'rgba(160,20,30,0.55)')
    tapete.addColorStop(1, 'rgba(120,10,24,0.25)')
    g.fillStyle = tapete
    g.beginPath()
    g.moveTo(CENTRO_X - 70, CHAO_Y)
    g.lineTo(CENTRO_X + 70, CHAO_Y)
    g.lineTo(CENTRO_X + 220, ALTURA)
    g.lineTo(CENTRO_X - 220, ALTURA)
    g.closePath()
    g.fill()

    // ---- fachadas das bordas ----
    for (const lado of [0, 1]) {
      const x0 = lado ? LARGURA - 118 : 0
      const grad = g.createLinearGradient(x0, 0, x0 + 118, 0)
      grad.addColorStop(lado ? 1 : 0, '#1a0a14')
      grad.addColorStop(lado ? 0 : 1, '#3a1220')
      g.fillStyle = grad
      g.fillRect(x0, 40, 118, CHAO_Y - 36)
      // andares, janelas e sacadas
      for (let a = 0; a < 3; a++) {
        const y = 98 + a * 70
        g.fillStyle = '#12060c'
        g.fillRect(x0, y + 54, 118, 8)
        g.fillStyle = '#c8201c'
        g.fillRect(x0, y + 52, 118, 3)
        for (let j = 0; j < 3; j++) {
          const wx = x0 + 10 + j * 36
          g.fillStyle = '#0a0408'
          retArredondado(g, wx, y + 6, 26, 40, 3)
          g.fill()
          const acesa = sorte() < 0.7
          g.fillStyle = acesa ? (sorte() < 0.3 ? 'rgba(255,150,100,0.9)' : 'rgba(255,214,130,0.9)') : '#1a0c14'
          retArredondado(g, wx + 2, y + 8, 22, 36, 2)
          g.fill()
          g.strokeStyle = 'rgba(40,10,10,0.9)'
          g.lineWidth = 1.5
          g.beginPath()
          g.moveTo(wx + 13, y + 8)
          g.lineTo(wx + 13, y + 44)
          g.moveTo(wx + 2, y + 26)
          g.lineTo(wx + 24, y + 26)
          g.stroke()
        }
      }
      // beiral de telha no alto da fachada
      telhado(g, x0 + 59, 20, 150, 26, { telha: '#8a1c20', claro: '#c84040', escuro: '#4a0c10' })
    }

    // ---- o PAIFANG (portal) ----
    const bx = CENTRO_X
    const pilar = (cx, larg) => {
      const grad = g.createLinearGradient(cx - larg / 2, 0, cx + larg / 2, 0)
      grad.addColorStop(0, '#7a1410')
      grad.addColorStop(0.35, '#d83428')
      grad.addColorStop(1, '#8a1812')
      g.fillStyle = grad
      g.fillRect(cx - larg / 2, 150, larg, CHAO_Y + 22 - 150)
      g.fillStyle = '#d8b050'
      g.fillRect(cx - larg / 2 - 2, 150, larg + 4, 4)
      g.fillRect(cx - larg / 2 - 2, 236, larg + 4, 3)
      // base de pedra
      g.fillStyle = '#4a4054'
      g.fillRect(cx - larg / 2 - 5, CHAO_Y + 8, larg + 10, 14)
      g.fillStyle = '#6a6074'
      g.fillRect(cx - larg / 2 - 5, CHAO_Y + 8, larg + 10, 3)
    }
    pilar(bx - 90, 15)
    pilar(bx + 90, 15)
    pilar(bx - 44, 11)
    pilar(bx + 44, 11)
    // vigas e painéis
    g.fillStyle = '#6a0e0e'
    g.fillRect(bx - 100, 150, 200, 16)
    g.fillStyle = '#e8b428'
    g.fillRect(bx - 100, 150, 200, 3)
    g.fillRect(bx - 100, 163, 200, 3)
    // placa central dourada com ideogramas inventados
    g.fillStyle = '#220608'
    retArredondado(g, bx - 38, 168, 76, 34, 4)
    g.fill()
    g.strokeStyle = '#f0c040'
    g.lineWidth = 2.5
    retArredondado(g, bx - 38, 168, 76, 34, 4)
    g.stroke()
    g.strokeStyle = '#ffd860'
    const sp = criarSorte(99)
    for (let k = 0; k < 3; k++) ideograma(g, bx - 33 + k * 24, 173, 22, sp)
    // telhados (3 níveis): o central maior e os laterais
    telhado(g, bx, 112, 128, 38)
    telhado(g, bx - 79, 128, 70, 22)
    telhado(g, bx + 79, 128, 70, 22)
    // enfeites de dragão nas pontas da cumeeira
    g.fillStyle = '#e8b428'
    for (const s of [-1, 1]) {
      g.beginPath()
      g.moveTo(bx + s * 40, 110)
      g.quadraticCurveTo(bx + s * 52, 98, bx + s * 48, 88)
      g.quadraticCurveTo(bx + s * 44, 98, bx + s * 36, 108)
      g.fill()
    }
    // lanternas de pedra e vão aberto (a rua ao longe)
    g.fillStyle = 'rgba(255,170,100,0.06)'
    g.fillRect(bx - 38, 204, 76, CHAO_Y - 202)

    // ---- barraquinhas de comida nos cantos de baixo ----
    for (const lado of [0, 1]) {
      const x0 = lado ? LARGURA - 128 : 8
      // toldo listrado
      for (let k = 0; k < 8; k++) {
        g.fillStyle = k % 2 ? '#f0e4d0' : '#c8201c'
        g.beginPath()
        g.moveTo(x0 + k * 14.4, 330)
        g.lineTo(x0 + (k + 1) * 14.4, 330)
        g.lineTo(x0 + (k + 1) * 14.4 + 1, 346)
        g.lineTo(x0 + k * 14.4 + 1, 346)
        g.fill()
      }
      for (let k = 0; k < 8; k++) {
        g.fillStyle = k % 2 ? '#f0e4d0' : '#c8201c'
        g.beginPath()
        g.arc(x0 + k * 14.4 + 7.2, 346, 7.2, 0, Math.PI)
        g.fill()
      }
      g.fillStyle = '#2a1410'
      g.fillRect(x0 + 2, 346, 4, 64)
      g.fillRect(x0 + 108, 346, 4, 64)
      // bancada com panelas
      g.fillStyle = '#4a2a1c'
      g.fillRect(x0 - 2, 386, 120, 18)
      g.fillStyle = '#7a4a2c'
      g.fillRect(x0 - 2, 386, 120, 4)
      for (const px of [x0 + 24, x0 + 62, x0 + 94]) {
        g.fillStyle = '#10080a'
        retArredondado(g, px - 14, 368, 28, 20, 5)
        g.fill()
        g.fillStyle = '#c8c0b0'
        g.fillRect(px - 16, 366, 32, 3)
      }
      // lâmpadas penduradas no toldo
      for (let k = 0; k < 4; k++) {
        const bxl = x0 + 14 + k * 28
        const halo = g.createRadialGradient(bxl, 356, 1, bxl, 356, 14)
        halo.addColorStop(0, 'rgba(255,230,160,0.9)')
        halo.addColorStop(1, 'rgba(255,170,80,0)')
        g.fillStyle = halo
        g.fillRect(bxl - 14, 342, 28, 28)
      }
    }
  })
}

// letreiro vertical de néon: moldura, ideogramas inventados e brilho (shadowBlur)
function texturaLetreiro(scene, chave, largura, altura, cor, n, semente) {
  return criarTextura(scene, chave, largura, altura, (g) => {
    const sorte = criarSorte(semente)
    g.shadowColor = css(cor, 1)
    g.shadowBlur = 8
    g.fillStyle = 'rgba(10,4,12,0.88)'
    retArredondado(g, 4, 4, largura - 8, altura - 8, 5)
    g.fill()
    g.strokeStyle = css(cor, 1)
    g.lineWidth = 2.4
    retArredondado(g, 5, 5, largura - 10, altura - 10, 5)
    g.stroke()
    const s = largura - 16
    for (let k = 0; k < n; k++) {
      g.strokeStyle = css(cor, 0.95)
      ideograma(g, 8, 10 + k * ((altura - 20) / n), s, sorte)
    }
  })
}

// tigela de macarrão em néon (letreiro redondo) e peixe
function texturaNeonTigela(scene) {
  return criarTextura(scene, 'arena-chinatown-tigela', 76, 64, (g) => {
    g.shadowColor = '#ff4a8a'
    g.shadowBlur = 8
    g.strokeStyle = '#ff6aa8'
    g.lineWidth = 2.6
    g.lineCap = 'round'
    g.beginPath()
    g.arc(38, 28, 22, 0, Math.PI)
    g.closePath()
    g.stroke()
    g.beginPath()
    g.moveTo(30, 40)
    g.lineTo(46, 40)
    g.moveTo(16, 24)
    g.lineTo(60, 24)
    g.stroke()
    g.strokeStyle = '#ffe070'
    for (const dx of [-8, 0, 8]) {
      g.beginPath()
      g.moveTo(38 + dx, 20)
      g.quadraticCurveTo(38 + dx + 5, 12, 38 + dx, 4)
      g.stroke()
    }
    g.strokeStyle = '#40e0ff'
    g.beginPath()
    g.moveTo(54, 4)
    g.lineTo(44, 22)
    g.moveTo(60, 6)
    g.lineTo(48, 22)
    g.stroke()
  })
}

function texturaLanterna(scene) {
  return criarTextura(scene, 'arena-chinatown-lanterna', 28, 40, (g) => {
    g.strokeStyle = '#2a0a0c'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(14, 0)
    g.lineTo(14, 6)
    g.stroke()
    const grad = g.createRadialGradient(14, 20, 2, 14, 20, 14)
    grad.addColorStop(0, '#ff9a58')
    grad.addColorStop(0.55, '#e82a1c')
    grad.addColorStop(1, '#8a0c10')
    g.fillStyle = grad
    g.beginPath()
    g.ellipse(14, 20, 11, 13, 0, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(90,0,0,0.5)'
    g.lineWidth = 1
    for (const k of [0.4, 0.75]) {
      g.beginPath()
      g.ellipse(14, 20, 11 * k, 13, 0, 0, Math.PI * 2)
      g.stroke()
    }
    g.fillStyle = '#e8b830'
    g.fillRect(8, 5, 12, 4)
    g.fillRect(8, 31, 12, 4)
    g.strokeStyle = '#f0c850'
    g.lineWidth = 1.2
    for (const dx of [-3, 0, 3]) {
      g.beginPath()
      g.moveTo(14 + dx, 35)
      g.lineTo(14 + dx * 1.5, 40)
      g.stroke()
    }
  })
}

function texturaBrilho(scene) {
  return criarTextura(scene, 'arena-chinatown-brilho', 128, 128, (g) => {
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    rg.addColorStop(0, 'rgba(255,255,255,1)')
    rg.addColorStop(0.3, 'rgba(255,255,255,0.35)')
    rg.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, 128, 128)
  })
}

function texturaVinheta(scene) {
  return criarTextura(scene, 'arena-chinatown-vinheta', LARGURA, ALTURA, (g) => {
    const rg = g.createRadialGradient(CENTRO_X, ALTURA / 2, 200, CENTRO_X, ALTURA / 2, 560)
    rg.addColorStop(0, 'rgba(10,0,10,0)')
    rg.addColorStop(1, 'rgba(10,0,10,0.6)')
    g.fillStyle = rg
    g.fillRect(0, 0, LARGURA, ALTURA)
  })
}

export default function chinatown(scene, objetos) {
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }
  const ADD = Phaser.BlendModes.ADD
  const sorte = Math.random

  add(scene.add.image(0, 0, texturaCeu(scene)).setOrigin(0))

  // nuvenzinhas rasgadas (elipses translúcidas), passando devagar
  const gNuvens = add(scene.add.graphics())
  const nuvens = Array.from({ length: 6 }, (_, i) => ({ x: i * 160, y: 60 + (i % 3) * 38, w: 90 + (i % 4) * 30, v: 4 + (i % 3) * 2.5 }))

  add(scene.add.image(0, 0, texturaCenario(scene)).setOrigin(0))

  // letreiros de néon: [textura, x, y, cor, quantos ideogramas, semente, brilho extra]
  const defs = [
    { x: 16, y: 118, l: 36, a: 128, cor: 0xff4a7a, n: 4, s: 11 },
    { x: 62, y: 176, l: 30, a: 96, cor: 0x40e0ff, n: 3, s: 22 },
    { x: LARGURA - 52, y: 112, l: 36, a: 132, cor: 0xffd040, n: 4, s: 33 },
    { x: LARGURA - 92, y: 172, l: 30, a: 100, cor: 0x60ff90, n: 3, s: 44 },
  ]
  const letreiros = defs.map((d, i) => {
    const img = add(scene.add.image(d.x, d.y, texturaLetreiro(scene, `arena-chinatown-letreiro-${i}`, d.l, d.a, d.cor, d.n, d.s)).setOrigin(0))
    const luz = add(scene.add.image(d.x + d.l / 2, d.y + d.a / 2, texturaBrilho(scene)).setDisplaySize(d.l * 2.8, d.a * 1.6).setBlendMode(ADD).setTint(d.cor).setAlpha(0.28))
    const chao = add(scene.add.image(d.x + d.l / 2, CHAO_Y + 40 + (i % 2) * 20, texturaBrilho(scene)).setDisplaySize(90, 40).setBlendMode(ADD).setTint(d.cor).setAlpha(0.12))
    return { ...d, img, luz, chao, defeito: i === 1 }
  })
  const tigela = add(scene.add.image(66, 306, texturaNeonTigela(scene)).setOrigin(0.5))
  const tigelaLuz = add(scene.add.image(66, 306, texturaBrilho(scene)).setDisplaySize(100, 80).setBlendMode(ADD).setTint(0xff4a8a).setAlpha(0.2))
  // as lâmpadas dos toldos
  const lampadas = []
  for (const lado of [0, 1]) {
    const x0 = lado ? LARGURA - 128 : 8
    for (let k = 0; k < 4; k++) lampadas.push(add(scene.add.image(x0 + 14 + k * 28, 356, texturaBrilho(scene)).setDisplaySize(40, 40).setBlendMode(ADD).setTint(0xffd080).setAlpha(0.45)))
  }

  // vapor: bolinhas que sobem das panelas e do bueiro
  const fontes = [
    { x: 8 + 24, y: 366 }, { x: 8 + 62, y: 366 }, { x: 8 + 94, y: 366 },
    { x: LARGURA - 128 + 24, y: 366 }, { x: LARGURA - 128 + 62, y: 366 }, { x: LARGURA - 128 + 94, y: 366 },
    { x: 262, y: CHAO_Y + 30 }, { x: 590, y: CHAO_Y + 36 },
  ]
  const gVapor = add(scene.add.graphics())
  const vapor = Array.from({ length: 70 }, (_, i) => ({ f: i % fontes.length, idade: (i * 331) % 3000, vida: 2600 + ((i * 97) % 1200), dx: ((i * 53) % 40) - 20 }))

  // dragão da festa
  const gDragao = add(scene.add.graphics())
  const DRAGAO = { periodo: 42000, comeca: 9000, dura: 17000, segmentos: 15, espaco: 17, y: 336 }

  // fios de lanternas por cima da rua
  const lanternaTex = texturaLanterna(scene)
  const gFios = add(scene.add.graphics())
  const fios = [
    { y0: 62, y1: 62, flecha: 14, n: 16, fase: 0 },
    { y0: 84, y1: 84, flecha: 22, n: 13, fase: 1.7 },
  ].map((f) => ({ ...f, lanternas: Array.from({ length: f.n }, (_, k) => ({ img: add(scene.add.image(0, 0, lanternaTex).setScale(0.8 + (k % 3) * 0.1).setOrigin(0.5, 0.18)), u: (k + 0.5) / f.n, fase: k * 1.37 + f.fase })) }))

  // fogos de artifício
  const gFogos = add(scene.add.graphics())
  let fogos = []
  let proximoFogo = 4000

  add(scene.add.image(0, 0, texturaVinheta(scene)).setOrigin(0))

  const desenharDragao = (t) => {
    gDragao.clear()
    const ciclo = (t - DRAGAO.comeca) % DRAGAO.periodo
    if (t < DRAGAO.comeca || ciclo > DRAGAO.dura) return
    const k = ciclo / DRAGAO.dura
    const xCabeca = -40 + k * (LARGURA + 300)
    const g = gDragao
    for (let s = DRAGAO.segmentos; s >= 0; s--) {
      const x = xCabeca - s * DRAGAO.espaco
      const y = DRAGAO.y + Math.sin(x / 40 + t / 380) * 12
      if (x < -30 || x > LARGURA + 30) continue
      // dançarino: duas perninhas escuras embaixo de cada segmento
      const pas = Math.sin(t / 130 + s) * 3
      g.fillStyle = 0x1a0a10
      g.fillRect(x - 4, y + 12, 3, 12 + pas)
      g.fillRect(x + 2, y + 12, 3, 12 - pas)
      const raio = s === 0 ? 14 : 11 - s * 0.18
      g.fillStyle = s % 2 ? 0xa81418 : 0xd42a22
      g.fillCircle(x, y, raio + 1)
      g.fillStyle = 0xf0b428
      g.fillCircle(x, y + raio * 0.35, raio * 0.5)
      g.fillStyle = 0x2ab070
      g.fillTriangle(x - 3, y - raio, x + 3, y - raio, x, y - raio - 6)
    }
    // cabeça
    const hx = xCabeca
    const hy = DRAGAO.y + Math.sin(hx / 40 + t / 380) * 12
    g.fillStyle = 0xe4302a
    g.fillRoundedRect(hx + 4, hy - 8, 26, 18, 6)
    g.fillStyle = 0xffe8a0
    g.fillRect(hx + 24, hy + 3, 5, 4)
    g.fillStyle = 0xffffff
    g.fillCircle(hx + 12, hy - 8, 4.2)
    g.fillStyle = 0x101010
    g.fillCircle(hx + 13, hy - 8, 2)
    g.fillStyle = 0xf0c030
    g.fillTriangle(hx + 2, hy - 12, hx - 6, hy - 26, hx + 10, hy - 14)
    g.fillStyle = 0xff8a20
    g.fillCircle(hx - 4, hy - 4, 6)
    g.lineStyle(2, 0xf0c030, 0.9)
    g.lineBetween(hx + 28, hy + 2, hx + 42, hy + 10 + Math.sin(t / 150) * 3)
    g.lineBetween(hx + 28, hy, hx + 44, hy - 3 + Math.sin(t / 150) * 3)
  }

  return {
    atualizar(dt, estado) {
      const t = estado.tempo
      // nuvens
      gNuvens.clear()
      for (const n of nuvens) {
        n.x += (n.v * dt) / 1000
        if (n.x > LARGURA + n.w) n.x = -n.w
        gNuvens.fillStyle(0x6a3a6a, 0.22)
        gNuvens.fillEllipse(n.x, n.y, n.w, 9)
        gNuvens.fillStyle(0x9a5a8a, 0.14)
        gNuvens.fillEllipse(n.x + 10, n.y - 3, n.w * 0.6, 6)
      }

      // néons: piscam de leve; o do defeito falha de vez em quando
      for (const l of letreiros) {
        let a = 0.92 + 0.08 * Math.sin(t / 380 + l.x)
        if (l.defeito) {
          const f = (t % 6200) / 6200
          if (f > 0.9 && Math.sin(t / 37) > 0.1) a = 0.12
          else if (f > 0.84 && f < 0.88 && Math.sin(t / 53) > 0) a = 0.3
        }
        l.img.setAlpha(a)
        l.luz.setAlpha(0.3 * a)
        l.chao.setAlpha(0.14 * a)
      }
      const ta = 0.8 + 0.2 * Math.sin(t / 260)
      tigela.setAlpha(ta)
      tigelaLuz.setAlpha(0.22 * ta)
      lampadas.forEach((l, i) => l.setAlpha(0.4 + 0.06 * Math.sin(t / 300 + i * 2)))

      // fios de lanternas: catenária balançando
      gFios.clear()
      for (const f of fios) {
        gFios.lineStyle(1.5, 0x1a0608, 0.9)
        gFios.beginPath()
        for (let x = 0; x <= LARGURA; x += 12) {
          const u = x / LARGURA
          const y = f.y0 + 4 * Math.sin(u * Math.PI) * 0 + f.flecha * Math.sin(u * Math.PI) + Math.sin(t / 900 + u * 4 + f.fase) * 1.5
          if (x === 0) gFios.moveTo(x, y)
          else gFios.lineTo(x, y)
        }
        gFios.strokePath()
        for (const l of f.lanternas) {
          const x = l.u * LARGURA
          const y = f.y0 + f.flecha * Math.sin(l.u * Math.PI) + Math.sin(t / 900 + l.u * 4 + f.fase) * 1.5
          const bal = Math.sin(t / 700 + l.fase) * 0.16
          l.img.setPosition(x + Math.sin(t / 700 + l.fase) * 2.5, y + 14).setRotation(bal)
        }
      }

      // vapor
      gVapor.clear()
      for (const p of vapor) {
        p.idade += dt
        if (p.idade > p.vida) p.idade -= p.vida
        const u = p.idade / p.vida
        const f = fontes[p.f]
        const x = f.x + p.dx * u + Math.sin(p.idade / 400 + p.f) * 5 * u
        const y = f.y - u * (f.y > 340 ? 54 : 70)
        gVapor.fillStyle(0xe8dcea, 0.2 * (1 - u) * Math.min(1, u * 5))
        gVapor.fillCircle(x, y, 4 + u * 11)
      }

      desenharDragao(t)

      // fogos
      proximoFogo -= dt
      if (proximoFogo <= 0) {
        proximoFogo = 4500 + sorte() * 5500
        const cor = COR.neon[Math.floor(sorte() * COR.neon.length)]
        const x = 340 + sorte() * 170
        const y = 84 + sorte() * 70
        fogos.push({ x, y, cor, idade: 0, p: Array.from({ length: 26 }, (_, i) => ({ a: (i / 26) * Math.PI * 2 + sorte() * 0.2, v: 50 + sorte() * 30 })) })
      }
      gFogos.clear()
      for (const f of fogos) {
        f.idade += dt
        const u = f.idade / 1500
        for (const p of f.p) {
          gFogos.fillStyle(f.cor, Math.max(0, 1 - u) * 0.9)
          const r = p.v * (1 - (1 - Math.min(1, u * 1.4)) ** 2)
          gFogos.fillRect(f.x + Math.cos(p.a) * r, f.y + Math.sin(p.a) * r + u * u * 26, 2.2, 2.2)
        }
        if (u < 0.18) {
          gFogos.fillStyle(0xffffff, 0.6 * (1 - u / 0.18))
          gFogos.fillCircle(f.x, f.y, 18 * (1 - u / 0.18) + 2)
        }
      }
      fogos = fogos.filter((f) => f.idade < 1500)
    },
  }
}
