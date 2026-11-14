import Phaser from 'phaser'
import { LARGURA, ALTURA, CENTRO_X } from '../../constants.js'
import { criarSorte, criarTextura, misturar, limitar } from './arteFundos.js'

// CIDADE GRANDE: o skyline numa avenida, do fim da tarde até a noite (um ciclo de ~2 min:
// dia -> entardecer -> noite -> volta). Camadas, de trás para a frente:
//   - o CÉU, que muda de cor (faixas de degradê calculadas a cada quadro), o sol que desce
//     atrás dos prédios, as estrelas e a lua que aparecem à noite e as nuvens que passam;
//   - o skyline de longe e o de perto (texturas cinza, TINGIDAS pela hora do dia) com as
//     JANELAS: cada uma acende quando escurece (a hora é diferente para cada janela) e, de
//     noite, algumas apagam e acendem sozinhas;
//   - dois OUTDOORS gigantes nas coberturas, trocando de propaganda (xícara, pizza,
//     equalizador), e o aviso de néon que pisca;
//   - a AVENIDA lá embaixo: carros em quatro faixas com faróis e lanternas, que PARAM nos
//     SEMÁFOROS (verde, amarelo, vermelho) e formam fila; os postes acendem ao escurecer;
//   - um HELICÓPTERO que cruza o céu de vez em quando (luz vermelha piscando e, de noite,
//     o facho do holofote), e a vinheta.
// O miolo (atrás das caixas) é só céu e skyline: o movimento forte fica na avenida e nas bordas.

const CICLO_MS = 120000
const CHAO = 296 // topo da avenida
const FAIXAS = [
  { y: 310, dir: 1, v: 70 },
  { y: 322, dir: 1, v: 96 },
  { y: 336, dir: -1, v: 84 },
  { y: 348, dir: -1, v: 62 },
]
const PARADA = 346 // onde os carros param (coordenada ao longo da viagem, de cada lado: perto do meio)
const SEMAFORO = { verde: 7000, amarelo: 1500, vermelho: 5500 }
const CORES_CARRO = [0xe8c020, 0xd83a30, 0x3a7ae0, 0xe8e8f0, 0x2a2a34, 0x40c070, 0xf08030, 0x9a5ad8]

// paleta do céu por hora: [topo, horizonte] em 3 pontos (dia, entardecer, noite)
const CEU = [
  [0x4a8ad8, 0xffd8a0],
  [0x3a2a6a, 0xff7a48],
  [0x050a20, 0x1c2c58],
]

// hora do dia: 0 = dia, 1 = noite (suave, ida e volta)
const horaDo = (t) => 0.5 - 0.5 * Math.cos((t / CICLO_MS) * Math.PI * 2)

function paleta(p, i) {
  // p 0..1 -> entre dia(0) / entardecer(0.5) / noite(1)
  const k = p < 0.5 ? p * 2 : (p - 0.5) * 2
  return p < 0.5 ? misturar(CEU[0][i], CEU[1][i], k) : misturar(CEU[1][i], CEU[2][i], k)
}

// ---------- os prédios (pura: a mesma lista desenha a textura e acende as janelas) ----------
function construirPredios(semente, { minTopo, maxTopo, largMin, largMax, passoJ, bordaTopo = 0, x0 = -10, x1 = LARGURA + 10 }) {
  const sorte = criarSorte(semente)
  const lista = []
  let x = x0
  while (x < x1) {
    const w = Math.round(largMin + sorte() * (largMax - largMin))
    let topo = Math.round(minTopo + sorte() * (maxTopo - minTopo))
    if (bordaTopo && (x < 110 || x + w > LARGURA - 110)) topo = bordaTopo // as coberturas das bordas seguram os outdoors
    const b = { x, w, topo, janelas: [], antena: sorte() < 0.35, degrau: sorte() < 0.3 }
    for (let wy = topo + 9; wy < CHAO - 8; wy += passoJ.y) {
      for (let wx = x + 5; wx < x + w - passoJ.w - 2; wx += passoJ.x) {
        b.janelas.push({ x: wx, y: wy, w: passoJ.w, h: passoJ.h, th: sorte(), quente: sorte() < 0.78, pisca: sorte() < 0.05 })
      }
    }
    lista.push(b)
    x += w + Math.round(sorte() * 3)
  }
  return lista
}

const LONGE = { semente: 91, minTopo: 150, maxTopo: 250, largMin: 30, largMax: 56, passoJ: { x: 8, y: 11, w: 3, h: 5 } }
const PERTO = { semente: 17, bordaTopo: 206, minTopo: 190, maxTopo: 262, largMin: 52, largMax: 92, passoJ: { x: 11, y: 14, w: 5, h: 7 } }

function desenharPredios(g, predios, { base, topoCor, detalhe }) {
  for (const b of predios) {
    const grad = g.createLinearGradient(b.x, b.topo, b.x + b.w, CHAO)
    grad.addColorStop(0, topoCor)
    grad.addColorStop(1, base)
    g.fillStyle = grad
    g.fillRect(b.x, b.topo, b.w, CHAO - b.topo + 2)
    // lado sombreado
    g.fillStyle = 'rgba(0,0,0,0.18)'
    g.fillRect(b.x + b.w * 0.7, b.topo, b.w * 0.3, CHAO - b.topo + 2)
    if (b.degrau) {
      g.fillStyle = topoCor
      g.fillRect(b.x + b.w * 0.22, b.topo - 12, b.w * 0.56, 13)
      g.fillStyle = 'rgba(0,0,0,0.18)'
      g.fillRect(b.x + b.w * 0.6, b.topo - 12, b.w * 0.18, 13)
    }
    if (b.antena) {
      g.fillStyle = detalhe
      g.fillRect(b.x + b.w / 2 - 1, b.topo - (b.degrau ? 34 : 24), 2, b.degrau ? 22 : 24)
    }
    // linhas dos andares, bem fracas
    g.fillStyle = 'rgba(255,255,255,0.05)'
    for (let y = b.topo + 4; y < CHAO; y += 22) g.fillRect(b.x, y, b.w, 1)
  }
}

function texturaSkyline(scene, chave, cfg, estilo) {
  return criarTextura(scene, chave, LARGURA, ALTURA, (g) => desenharPredios(g, construirPredios(cfg.semente, cfg), estilo))
}

// as estruturas: coberturas dos outdoors, caixa-d'água, e a avenida
function texturaFrente(scene) {
  return criarTextura(scene, 'arena-cidade-frente', LARGURA, ALTURA, (g) => {
    // painéis dos outdoors (a moldura e as pernas; o conteúdo é animado)
    for (const x of [14, LARGURA - 98]) {
      g.fillStyle = '#20242e'
      g.fillRect(x + 12, 176, 4, 28)
      g.fillRect(x + 66, 176, 4, 28)
      g.fillStyle = '#10131a'
      g.fillRect(x - 2, 116, 88, 62)
      g.fillStyle = '#4a5468'
      g.fillRect(x - 2, 116, 88, 3)
      g.fillRect(x - 2, 175, 88, 3)
      g.fillRect(x - 2, 116, 3, 62)
      g.fillRect(x + 83, 116, 3, 62)
      // luminárias em cima
      for (let k = 0; k < 4; k++) {
        g.fillStyle = '#2a2e38'
        g.fillRect(x + 8 + k * 20, 108, 10, 5)
      }
    }
    // avenida: calçada, asfalto, faixas
    const calc = g.createLinearGradient(0, CHAO - 4, 0, CHAO + 8)
    calc.addColorStop(0, '#4a4e5e')
    calc.addColorStop(1, '#2a2d38')
    g.fillStyle = calc
    g.fillRect(0, CHAO - 4, LARGURA, 12)
    g.fillStyle = '#6a6e80'
    g.fillRect(0, CHAO - 4, LARGURA, 2)
    const asf = g.createLinearGradient(0, CHAO + 8, 0, ALTURA)
    asf.addColorStop(0, '#22252e')
    asf.addColorStop(0.3, '#16181f')
    asf.addColorStop(1, '#0b0c10')
    g.fillStyle = asf
    g.fillRect(0, CHAO + 8, LARGURA, ALTURA - CHAO - 8)
    // sarjeta e canteiro central
    g.fillStyle = '#d8c850'
    g.fillRect(0, 328, LARGURA, 2)
    g.fillRect(0, 331, LARGURA, 2)
    g.fillStyle = 'rgba(255,255,255,0.4)'
    for (let x = 6; x < LARGURA; x += 26) {
      g.fillRect(x, 317, 12, 1.5)
      g.fillRect(x + 13, 343, 12, 1.5)
    }
    // faixa de pedestres no meio
    g.fillStyle = 'rgba(255,255,255,0.35)'
    for (let y = 308; y < 354; y += 5) g.fillRect(CENTRO_X - 10, y, 20, 3)
    // mureta de concreto com refletores, ciclovia e calçada de frente
    g.fillStyle = '#5a5e6c'
    g.fillRect(0, 358, LARGURA, 9)
    g.fillStyle = '#7a7e8e'
    g.fillRect(0, 358, LARGURA, 2)
    for (let x = 0; x < LARGURA; x += 48) {
      g.fillStyle = '#3a3e4a'
      g.fillRect(x + 46, 358, 2, 9)
      g.fillStyle = (x / 48) % 2 ? '#e8c020' : '#d83a30'
      g.fillRect(x + 20, 361, 8, 3)
    }
    g.fillStyle = '#1c3a3a'
    g.fillRect(0, 367, LARGURA, 26)
    g.fillStyle = 'rgba(255,255,255,0.3)'
    for (let x = 4; x < LARGURA; x += 30) g.fillRect(x, 380, 14, 1.5)
    const calcada = g.createLinearGradient(0, 393, 0, ALTURA)
    calcada.addColorStop(0, '#3a3c4a')
    calcada.addColorStop(1, '#16171e')
    g.fillStyle = calcada
    g.fillRect(0, 393, LARGURA, ALTURA - 393)
    g.fillStyle = '#6a6c7c'
    g.fillRect(0, 393, LARGURA, 2)
    g.strokeStyle = 'rgba(255,255,255,0.07)'
    g.lineWidth = 1
    for (let x = 0; x < LARGURA; x += 38) {
      g.beginPath()
      g.moveTo(x, 395)
      g.lineTo(x - 18, ALTURA)
      g.stroke()
    }
  })
}

function texturaBrilho(scene) {
  return criarTextura(scene, 'arena-cidade-brilho', 128, 128, (g) => {
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    rg.addColorStop(0, 'rgba(255,255,255,1)')
    rg.addColorStop(0.3, 'rgba(255,255,255,0.35)')
    rg.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, 128, 128)
  })
}

function texturaVinheta(scene) {
  return criarTextura(scene, 'arena-cidade-vinheta', LARGURA, ALTURA, (g) => {
    const rg = g.createRadialGradient(CENTRO_X, ALTURA / 2, 200, CENTRO_X, ALTURA / 2, 560)
    rg.addColorStop(0, 'rgba(0,0,10,0)')
    rg.addColorStop(1, 'rgba(0,0,10,0.55)')
    g.fillStyle = rg
    g.fillRect(0, 0, LARGURA, ALTURA)
  })
}

export default function cidade(scene, objetos) {
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }
  const ADD = Phaser.BlendModes.ADD
  const sorte = Math.random
  const brilho = texturaBrilho(scene)

  // céu (faixas), sol, lua, estrelas
  const gCeu = add(scene.add.graphics())
  const estrelas = Array.from({ length: 70 }, (_, i) => ({ x: (i * 211) % LARGURA, y: 60 + ((i * 97) % 190), f: i * 1.9 }))
  const gEstrelas = add(scene.add.graphics())
  const sol = add(scene.add.image(CENTRO_X + 40, 200, brilho).setDisplaySize(260, 260).setBlendMode(ADD).setTint(0xffd890))
  const solNucleo = add(scene.add.image(CENTRO_X + 40, 200, brilho).setDisplaySize(64, 64).setBlendMode(ADD).setTint(0xfff4d0))
  const lua = add(scene.add.circle(CENTRO_X - 120, 120, 17, 0xf0f0e0).setAlpha(0))
  const luaHalo = add(scene.add.image(CENTRO_X - 120, 120, brilho).setDisplaySize(120, 120).setBlendMode(ADD).setTint(0xb8c8ff).setAlpha(0))
  const gNuvens = add(scene.add.graphics())
  const nuvens = Array.from({ length: 7 }, (_, i) => ({ x: i * 130, y: 78 + (i % 4) * 34, w: 70 + (i % 3) * 36, v: 3 + (i % 4) * 1.6 }))

  // skyline
  const longe = add(scene.add.image(0, 0, texturaSkyline(scene, 'arena-cidade-longe', LONGE, { base: '#7c88ac', topoCor: '#a8b4d4', detalhe: '#7a84a4' })).setOrigin(0))
  const prediosLonge = construirPredios(LONGE.semente, LONGE)
  const gJanelasLonge = add(scene.add.graphics())
  const perto = add(scene.add.image(0, 0, texturaSkyline(scene, 'arena-cidade-perto', PERTO, { base: '#383c58', topoCor: '#5a6088', detalhe: '#4a4e6c' })).setOrigin(0))
  const prediosPerto = construirPredios(PERTO.semente, PERTO)
  const gJanelas = add(scene.add.graphics())
  const frente = add(scene.add.image(0, 0, texturaFrente(scene)).setOrigin(0))
  const gOutdoor = add(scene.add.graphics())
  const brilhoHorizonte = add(scene.add.image(CENTRO_X, CHAO - 10, brilho).setDisplaySize(900, 140).setBlendMode(ADD).setTint(0xff8a50).setAlpha(0.3))

  // postes de luz ao longo da calçada
  const postes = Array.from({ length: 9 }, (_, i) => ({ x: 40 + i * 100 }))
  const gAvenida = add(scene.add.graphics())

  // carros
  const carros = []
  FAIXAS.forEach((f, fi) => {
    const n = 5
    for (let k = 0; k < n; k++) carros.push({ faixa: fi, s: (k / n) * (LARGURA + 120) - 60 + sorte() * 30, v: f.v, len: 20 + Math.floor(sorte() * 3) * 5, cor: CORES_CARRO[Math.floor(sorte() * CORES_CARRO.length)], tipo: sorte() < 0.18 ? 'onibus' : 'carro' })
  })
  const ciclistas = [{ x: 100, v: 38, cor: 0xff5a5a }, { x: 520, v: -30, cor: 0x5ad0ff }, { x: 760, v: 44, cor: 0xffd23a }]
  const pedestres = Array.from({ length: 9 }, (_, i) => ({ x: (i * 97) % LARGURA, v: (i % 2 ? -1 : 1) * (14 + (i % 3) * 6), camada: i % 3, fase: i * 1.7, cor: CORES_CARRO[i % CORES_CARRO.length] }))
  const gHelicoptero = add(scene.add.graphics())
  const gVapor = add(scene.add.graphics())

  add(scene.add.image(0, 0, texturaVinheta(scene)).setOrigin(0))

  // estado do semáforo: 'verde' | 'amarelo' | 'vermelho'
  const semaforo = (t) => {
    const c = t % (SEMAFORO.verde + SEMAFORO.amarelo + SEMAFORO.vermelho)
    return c < SEMAFORO.verde ? 'verde' : c < SEMAFORO.verde + SEMAFORO.amarelo ? 'amarelo' : 'vermelho'
  }

  let ultimaPisca = 0
  const estadoJanelas = new Map()

  const desenharJanelas = (g, predios, noite, t, escala) => {
    g.clear()
    for (const b of predios) {
      for (const j of b.janelas) {
        // acende quando a noite passa do limite dela; algumas tremem
        let nivel = limitar((noite - j.th * 0.8) * 6, 0, 1)
        if (j.pisca && noite > 0.7) nivel *= Math.sin(t / 700 + j.x) > -0.2 ? 1 : 0.1
        const chave = `${j.x},${j.y}`
        const extra = estadoJanelas.get(chave)
        if (extra !== undefined && noite > 0.6) nivel = extra
        if (nivel <= 0.02) continue
        g.fillStyle(j.quente ? 0xffd070 : 0xa8e0ff, 0.85 * nivel * escala)
        g.fillRect(j.x, j.y, j.w, j.h)
      }
    }
  }

  const desenharOutdoor = (g, t, noite) => {
    g.clear()
    for (const [lado, x] of [[0, 14], [1, LARGURA - 98]]) {
      const ciclo = Math.floor(t / 4500 + lado * 1.3) % 3
      const f = (t % 4500) / 4500
      const w = 80
      const h = 56
      const px = x
      const py = 119
      g.fillStyle(ciclo === 0 ? 0x2a1a0e : ciclo === 1 ? 0x0e1a2a : 0x180e2a, 1)
      g.fillRect(px, py, w, h)
      if (ciclo === 0) {
        // xícara de café com vapor subindo
        g.fillStyle(0xfff0e0, 1)
        g.fillRoundedRect(px + 24, py + 24, 30, 22, 5)
        g.fillRect(px + 52, py + 28, 8, 4)
        g.fillRect(px + 56, py + 28, 4, 12)
        g.fillStyle(0x5a2a10, 1)
        g.fillRect(px + 26, py + 26, 26, 5)
        g.fillStyle(0xffd070, 0.7)
        for (let k = 0; k < 3; k++) g.fillRect(px + 30 + k * 8, py + 8 + ((f * 20 + k * 6) % 14), 2, 10)
      } else if (ciclo === 1) {
        // fatia de pizza
        g.fillStyle(0xf0b840, 1)
        g.fillTriangle(px + 40, py + 48, px + 14, py + 12, px + 66, py + 12)
        g.fillStyle(0xd4482a, 1)
        g.fillRect(px + 14, py + 10, 52, 5)
        g.fillStyle(0xc02a20, 1)
        for (const [dx, dy] of [[34, 22], [46, 24], [40, 34]]) g.fillCircle(px + dx, py + dy, 3)
      } else {
        // equalizador animado
        for (let k = 0; k < 8; k++) {
          const a = 8 + (Math.sin(t / 200 + k * 1.3) * 0.5 + 0.5) * 36
          g.fillStyle(k % 2 ? 0xff4aa0 : 0x40e0ff, 1)
          g.fillRect(px + 6 + k * 9, py + h - 4 - a, 6, a)
        }
      }
      // luz das luminárias em cima e brilho do painel
      g.fillStyle(0xffffff, 0.08 + 0.1 * noite)
      g.fillRect(px, py, w, h)
      g.fillStyle(0xfff0c0, 0.5 + 0.5 * noite)
      for (let k = 0; k < 4; k++) g.fillRect(px + 10 + k * 20, 113, 6, 2)
    }
  }

  const desenharAvenida = (t, noite, dt) => {
    const g = gAvenida
    g.clear()
    // postes
    for (const p of postes) {
      g.fillStyle(0x2a2e3a, 1)
      g.fillRect(p.x - 1, CHAO - 34, 2, 34)
      g.fillRect(p.x - 1, CHAO - 34, 10, 2)
      const luz = limitar((noite - 0.35) * 3, 0, 1)
      g.fillStyle(luz > 0.05 ? 0xffe8a0 : 0x8a8e98, 1)
      g.fillRect(p.x + 7, CHAO - 33, 5, 3)
      if (luz > 0.05) {
        g.fillStyle(0xffd890, 0.14 * luz)
        g.fillTriangle(p.x + 9, CHAO - 30, p.x - 14, CHAO + 8, p.x + 32, CHAO + 8)
        g.fillStyle(0xffd890, 0.22 * luz)
        g.fillCircle(p.x + 9, CHAO - 31, 9)
      }
    }
    // semáforos (um para cada sentido), nas calçadas do meio
    const estado = semaforo(t)
    for (const x of [PARADA + 8, LARGURA - PARADA - 8]) {
      g.fillStyle(0x20242e, 1)
      g.fillRect(x - 1, CHAO - 40, 3, 40)
      g.fillStyle(0x0c0e14, 1)
      g.fillRoundedRect(x - 5, CHAO - 56, 11, 30, 3)
      const luz = (dy, ligada, cor) => {
        g.fillStyle(ligada ? cor : 0x2a2a30, 1)
        g.fillCircle(x, CHAO - 50 + dy, 3)
        if (ligada) {
          g.fillStyle(cor, 0.22)
          g.fillCircle(x, CHAO - 50 + dy, 9)
        }
      }
      luz(0, estado === 'vermelho', 0xff3a30)
      luz(9, estado === 'amarelo', 0xffd030)
      luz(18, estado === 'verde', 0x40e060)
    }

    // ciclistas na ciclovia e pedestres na calçada
    for (const [i, c] of ciclistas.entries()) {
      c.x += (c.v * dt) / 1000
      if (c.x > LARGURA + 40) c.x = -40
      if (c.x < -40) c.x = LARGURA + 40
      const x = c.x
      const y = 381 + (i % 2) * 6
      const pedal = t / 110 + i
      g.lineStyle(1.5, 0x10121a, 1)
      g.strokeCircle(x - 6, y + 3, 4)
      g.strokeCircle(x + 6, y + 3, 4)
      g.lineBetween(x - 6, y + 3, x, y - 3)
      g.lineBetween(x, y - 3, x + 6, y + 3)
      g.fillStyle(c.cor, 1)
      g.fillRect(x - 2, y - 11, 4, 8)
      g.fillStyle(0xe8c8a0, 1)
      g.fillCircle(x, y - 14, 2.4)
      g.lineStyle(1.5, 0x10121a, 1)
      g.lineBetween(x, y - 4, x + Math.cos(pedal) * 3, y + 2 + Math.sin(pedal) * 2)
    }
    for (const p of pedestres) {
      p.x += (p.v * dt) / 1000
      if (p.x > LARGURA + 20) p.x = -20
      if (p.x < -20) p.x = LARGURA + 20
      const y = 432 + p.camada * 22
      const passo = Math.sin(t / 170 + p.fase) * 3
      g.fillStyle(0x0a0b10, 0.85)
      g.fillRect(p.x - 3, y - 14, 6, 11)
      g.fillCircle(p.x, y - 18, 3)
      g.fillRect(p.x - 3, y - 3, 2, 8 + passo)
      g.fillRect(p.x + 1, y - 3, 2, 8 - passo)
      g.fillStyle(p.cor, 0.9)
      g.fillRect(p.x - 3, y - 14, 6, 4)
    }

    // carros: andam, param no vermelho, formam fila
    for (let fi = 0; fi < FAIXAS.length; fi++) {
      const f = FAIXAS[fi]
      const fila = carros.filter((c) => c.faixa === fi).sort((a, b) => b.s - a.s) // do da frente para o de trás
      fila.forEach((c, i) => {
        const frente = fila[i - 1]
        let alvo = f.v
        // semáforo: do lado de cá da linha de parada
        if (estado !== 'verde') {
          const falta = PARADA - (c.s + c.len / 2)
          if (falta > -2 && falta < 70) alvo = estado === 'amarelo' && falta < 14 ? alvo : Math.max(0, Math.min(alvo, falta * 1.4))
        }
        // não bate no da frente
        if (frente) {
          const gap = frente.s - frente.len / 2 - (c.s + c.len / 2) - 4
          alvo = Math.min(alvo, Math.max(0, gap * 2.2))
        }
        c.v += (alvo - c.v) * Math.min(1, dt / 220)
        c.s += (c.v * dt) / 1000
        if (c.s > LARGURA + 80) {
          c.s = -80 - sorte() * 60
          c.cor = CORES_CARRO[Math.floor(sorte() * CORES_CARRO.length)]
          c.tipo = sorte() < 0.18 ? 'onibus' : 'carro'
          c.len = c.tipo === 'onibus' ? 40 : 20 + Math.floor(sorte() * 3) * 5
        }
        const x = f.dir > 0 ? c.s : LARGURA - c.s
        const y = f.y
        const d = f.dir
        const comp = c.len
        // sombra, corpo, janelas, rodas
        g.fillStyle(0x000000, 0.35)
        g.fillEllipse(x, y + 5, comp + 2, 4)
        g.fillStyle(c.cor, 1)
        g.fillRoundedRect(x - comp / 2, y - 6, comp, c.tipo === 'onibus' ? 11 : 8, 2.5)
        if (c.tipo === 'carro') g.fillRoundedRect(x - comp * 0.3 + d * -1, y - 10, comp * 0.55, 6, 2)
        g.fillStyle(0x16202e, 0.9)
        if (c.tipo === 'onibus') for (let k = 0; k < 5; k++) g.fillRect(x - comp / 2 + 3 + k * 7, y - 4, 5, 4)
        else g.fillRect(x - comp * 0.24 - d * 0, y - 9, comp * 0.4, 4)
        g.fillStyle(0x08080c, 1)
        g.fillCircle(x - comp * 0.3, y + 3, 2.2)
        g.fillCircle(x + comp * 0.3, y + 3, 2.2)
        // faróis (frente) e lanternas (trás): somam luz à noite e quando freia
        const frenando = c.v < f.v * 0.5
        const faroX = x + d * (comp / 2)
        const lanX = x - d * (comp / 2)
        g.fillStyle(0xfff4c0, 1)
        g.fillRect(faroX - (d > 0 ? 1.5 : 0), y - 3, 1.5, 2.5)
        g.fillStyle(frenando ? 0xff4040 : 0xc02020, 1)
        g.fillRect(lanX - (d > 0 ? 0 : 1.5), y - 3, 1.5, 2.5)
        if (noite > 0.25) {
          g.fillStyle(0xfff0b0, 0.16 * noite * 1.4)
          g.fillTriangle(faroX, y - 2, faroX + d * 46, y - 8, faroX + d * 46, y + 6)
          g.fillStyle(0xff3030, (frenando ? 0.4 : 0.2) * noite * 1.3)
          g.fillCircle(lanX, y - 2, frenando ? 6 : 4)
        } else if (frenando) {
          g.fillStyle(0xff3030, 0.3)
          g.fillCircle(lanX, y - 2, 4)
        }
      })
    }
  }

  const desenharHelicoptero = (t, noite) => {
    const g = gHelicoptero
    g.clear()
    const ciclo = 30000
    const c = (t - 6000) % ciclo
    if (t < 6000 || c > 11000) return
    const k = c / 11000
    const x = -30 + k * (LARGURA + 60)
    const y = 92 + Math.sin(k * 6) * 5
    // facho do holofote (de noite) apontando para a avenida
    if (noite > 0.45) {
      g.fillStyle(0xdde8ff, 0.14 * limitar((noite - 0.45) * 3, 0, 1))
      g.fillTriangle(x + 6, y + 6, x - 22 + Math.sin(t / 900) * 24, CHAO + 40, x + 44 + Math.sin(t / 900) * 24, CHAO + 40)
    }
    g.fillStyle(0x15181f, 1)
    g.fillEllipse(x, y, 26, 11)
    g.fillRect(x - 24, y - 2, 18, 3) // cauda
    g.fillRect(x - 24, y - 7, 3, 8)
    g.fillRect(x - 1, y - 8, 2, 3) // mastro
    const giro = Math.sin(t / 22)
    g.lineStyle(2, 0x2a2e3a, 0.9)
    g.lineBetween(x - 20 * giro, y - 9, x + 20 * giro, y - 9)
    g.lineStyle(1, 0x15181f, 1)
    g.lineBetween(x - 8, y + 8, x + 8, y + 8)
    g.fillStyle(0x6ab0e0, 0.85)
    g.fillEllipse(x + 6, y - 1, 9, 6)
    const pisca = Math.sin(t / 200) > 0.4
    g.fillStyle(0xff3030, pisca ? 1 : 0.2)
    g.fillCircle(x - 24, y - 8, 2)
    if (pisca) {
      g.fillStyle(0xff3030, 0.28)
      g.fillCircle(x - 24, y - 8, 8)
    }
    g.fillStyle(0x40ff90, pisca ? 0.2 : 1)
    g.fillCircle(x + 2, y + 6, 1.6)
  }

  const fumacas = Array.from({ length: 14 }, (_, i) => ({ x: 60 + i * 56, idade: i * 400, vida: 4000 + (i % 3) * 600 }))

  return {
    atualizar(dt, estado) {
      const t = estado.tempo
      const noite = horaDo(t)

      // céu: faixas de degradê entre o topo e o horizonte
      gCeu.clear()
      const topo = paleta(noite, 0)
      const horiz = paleta(noite, 1)
      const faixas = 28
      for (let i = 0; i < faixas; i++) {
        const k = i / (faixas - 1)
        gCeu.fillStyle(misturar(topo, horiz, k ** 1.6), 1)
        gCeu.fillRect(0, (i * CHAO) / faixas, LARGURA, CHAO / faixas + 1)
      }
      gCeu.fillStyle(misturar(horiz, 0x0a0a14, 0.5), 1)
      gCeu.fillRect(0, CHAO, LARGURA, ALTURA - CHAO)

      // sol desce atrás do skyline; lua e estrelas aparecem
      const solY = 150 + noite * 190
      sol.setPosition(CENTRO_X + 40, solY).setAlpha(limitar(1.2 - noite * 1.5, 0, 1) * 0.8)
      solNucleo.setPosition(CENTRO_X + 40, solY).setAlpha(limitar(1.4 - noite * 1.7, 0, 1))
      const luaA = limitar((noite - 0.55) * 2.4, 0, 1)
      lua.setAlpha(luaA).setPosition(CENTRO_X - 130, 130 - noite * 18)
      luaHalo.setAlpha(luaA * 0.5).setPosition(CENTRO_X - 130, 130 - noite * 18)
      gEstrelas.clear()
      const ea = limitar((noite - 0.55) * 2.2, 0, 1)
      if (ea > 0) {
        for (const e of estrelas) {
          gEstrelas.fillStyle(0xffffff, ea * (0.5 + 0.5 * Math.sin(t / 600 + e.f)))
          gEstrelas.fillRect(e.x, e.y, 1.5, 1.5)
        }
      }
      // nuvens com a cor do entardecer
      gNuvens.clear()
      const corNuvem = misturar(misturar(0xffffff, 0xff9a6a, limitar(noite * 2, 0, 1)), 0x2a3a6a, limitar(noite * 2 - 1, 0, 1))
      for (const n of nuvens) {
        n.x += (n.v * dt) / 1000
        if (n.x > LARGURA + n.w) n.x = -n.w
        gNuvens.fillStyle(corNuvem, 0.4)
        gNuvens.fillEllipse(n.x, n.y, n.w, 11)
        gNuvens.fillEllipse(n.x + 14, n.y - 4, n.w * 0.6, 9)
      }

      // os prédios pegam a cor da hora
      const tinta = (claro) => misturar(misturar(claro, 0xffb890, 0.5 * (1 - Math.abs(noite - 0.4) * 2.2 > 0 ? 1 - Math.abs(noite - 0.4) * 2.2 : 0)), 0x141c3a, limitar(noite * 1.3, 0, 1))
      longe.setTint(misturar(tinta(0xd0d8f0), horiz, 0.35))
      perto.setTint(tinta(0xb8bcd0))
      brilhoHorizonte.setAlpha(0.35 * (1 - Math.abs(noite - 0.4) * 2) + 0.05).setTint(misturar(0xff8a50, 0x6a7aff, limitar(noite * 1.4 - 0.4, 0, 1)))
      frente.setTint(misturar(0xffffff, 0x6a6a9a, limitar(noite * 1.2, 0, 1)))

      // janelas: algumas apagam/acendem sozinhas de noite
      if (t - ultimaPisca > 450) {
        ultimaPisca = t
        for (let k = 0; k < 3; k++) {
          const b = prediosPerto[Math.floor(sorte() * prediosPerto.length)]
          const j = b.janelas[Math.floor(sorte() * b.janelas.length)]
          if (j) estadoJanelas.set(`${j.x},${j.y}`, sorte() < 0.5 ? 0 : 1)
        }
        if (estadoJanelas.size > 40) estadoJanelas.delete(estadoJanelas.keys().next().value)
      }
      desenharJanelas(gJanelasLonge, prediosLonge, noite, t, 0.7)
      desenharJanelas(gJanelas, prediosPerto, noite, t, 1)
      desenharOutdoor(gOutdoor, t, noite)
      desenharAvenida(t, noite, dt)
      desenharHelicoptero(t, noite)

      // fumaça saindo de bueiros na avenida
      gVapor.clear()
      for (const f of fumacas.slice(0, 5)) {
        f.idade += dt
        if (f.idade > f.vida) f.idade -= f.vida
        const u = f.idade / f.vida
        gVapor.fillStyle(0xe8e0f0, 0.14 * (1 - u))
        gVapor.fillCircle(f.x + Math.sin(f.idade / 500) * 5, CHAO + 54 - u * 22, 4 + u * 9)
      }
    },
  }
}
