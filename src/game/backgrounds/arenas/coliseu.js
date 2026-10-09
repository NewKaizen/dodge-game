import { LARGURA, ALTURA } from '../../constants.js'
import { texturaCanvas, misturar, semente } from '../../arte/pixelCanvas.js'

// COLISEU: a arena dos gladiadores ao meio-dia. De trás para a frente:
//   céu azul com o halo do sol no canto, nuvens e pombas passando;
//   o anel de cima (ático) com arcos vazados (o céu aparece pelos arcos),
//   mastros com flâmulas e os toldos listrados do velário balançando;
//   as arquibancadas de pedra em curva (elipses), com escadas, LOTADAS: a
//   plateia em pixel art agita os braços e as bandeirinhas e, de vez em quando,
//   uma "ola" atravessa o estádio;
//   a tribuna do imperador no meio (ele acena às vezes, guardas dos lados);
//   o muro do pódio com estandartes pendurados e os portões dos gladiadores;
//   o chão de areia com as marcas das bigas e do rastelo, uma lança cravada
//   e um escudo caído; poeira dourada flutuando e nuvens de poeira rasteiras.
// Tudo o que é parado vira textura UMA vez (canvas 2D, texturas 'arena-coliseu-*');
// o que mexe são imagens com posição/quadro trocados (a plateia troca de quadro
// a cada PLATEIA_MS, no ritmo "pixel art", e não a cada frame).
// As caixas ficam em cima das arquibancadas e as mãos de cartas em cima da
// areia: nada pisca forte ali, e o véu da arena (moldura.alpha) escurece tudo.

const CX = 320 // centro da elipse da arena (fica abaixo das caixas: as curvas sobem para os lados)
const CY = 338
const PODIO = { a: 430, b: 142, altura: 24 } // onde a areia encontra o muro, e a altura do muro
const DEGRAUS = 7 // fileiras de arquibancada
const DEGRAU = { a: 40, b: 17 } // quanto cada fileira cresce na elipse
const ATICO = 28 // altura do anel de cima
const ESCADAS = [72, 168, 472, 568] // x das escadas entre os setores
const TRIBUNA = { x0: CX - 46, x1: CX + 46, fileiras: 4 } // a plateia não senta atrás da tribuna
const PORTOES = [56, 584]
const BLOCO = 16 // largura de um pedaço da plateia (4 pessoas)
const PLATEIA_MS = 70 // a plateia troca de quadro neste ritmo
const OLA = { primeira: 3500, periodo: 12500, velocidade: 0.24, largura: 48 } // px/ms
const IMPERADOR = { periodo: 9000, acenoMs: 1300 }

const PEDRA = { luz: 0xf2dcb4, clara: 0xe0c296, media: 0xc6a274, sombra: 0x9a7650, escura: 0x6a4e34, funda: 0x3e2c1e }
const AREIA = { longe: 0xc0925a, perto: 0xe0b578, clara: 0xf2d29a, escura: 0xa87a46 }
const CEU = { alto: 0x2f62b8, baixo: 0x8ccaee }
const TUNICAS = [0xc8423a, 0x3a6ac8, 0xe8dcc0, 0x4a9a4a, 0xe0b030, 0x8a4ab0, 0xe07a30, 0x2a9a9a, 0xa83050, 0x3a4a8a, 0xd86aa0]
const PELES = [0xf2c9a0, 0xdca474, 0xb07448, 0x7c4a2a]
const CABELOS = [0x2a1a10, 0x5a3418, 0x8a5a2a, 0x1a1a1a, 0xc89a50]
const BANDEIRAS = [0xff4040, 0xffd040, 0x40a0ff, 0xffffff, 0x60d060]

// ---------- geometria (elipses vistas de cima, de frente) ----------

const yElipse = (a, b, x) => {
  const d = (x - CX) / a
  return CY - b * Math.sqrt(Math.max(0, 1 - d * d))
}
const yAreia = (x) => yElipse(PODIO.a, PODIO.b, x) // pé do muro: começa a areia
// linha k das arquibancadas (0 = alto do muro do pódio, DEGRAUS = base do ático)
const yLinha = (k, x) => yElipse(PODIO.a + 16 + k * DEGRAU.a, PODIO.b + PODIO.altura + k * DEGRAU.b, x)
const yAtico = (x) => yLinha(DEGRAUS, x) - ATICO

// texturas de canvas: arte/pixelCanvas.js (cada uma é pintada uma vez por jogo)
const textura = texturaCanvas

// ---------- texturas ----------

function texturaCeu(scene) {
  return textura(scene, 'arena-coliseu-ceu', LARGURA, 150, (ctx, px) => {
    for (let y = 0; y < 150; y += 2) px(0, y, LARGURA, 2, misturar(CEU.alto, CEU.baixo, Math.min(1, y / 120)))
    // sol forte fora da tela, no canto: halo largo e raios bem suaves
    const halo = ctx.createRadialGradient(560, -30, 10, 560, -30, 260)
    halo.addColorStop(0, 'rgba(255,250,225,0.95)')
    halo.addColorStop(0.18, 'rgba(255,240,190,0.55)')
    halo.addColorStop(0.5, 'rgba(255,230,170,0.15)')
    halo.addColorStop(1, 'rgba(255,230,170,0)')
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, LARGURA, 150)
    px(548, 0, 24, 6, 0xfffbe8)
    px(552, 6, 16, 2, 0xfffbe8)
  })
}

function texturaNuvem(scene, k) {
  const r = semente(40 + k)
  return textura(scene, `arena-coliseu-nuvem-${k}`, 72, 22, (ctx, px) => {
    // bolotas sobrepostas: corpo branco, barriga azulada
    const bolas = Array.from({ length: 5 + k }, (_, i) => ({ x: 10 + i * (52 / (4 + k)) + r() * 6, y: 12 - r() * 6, raio: 5 + r() * 5 }))
    for (const cor of [0xb8daf2, 0xffffff]) {
      for (const b of bolas) {
        const dy = cor === 0xffffff ? -1 : 1
        for (let y = -b.raio; y <= b.raio; y++) {
          const meia = Math.round(Math.sqrt(b.raio * b.raio - y * y))
          px(b.x - meia, b.y + y + dy, meia * 2, 1, cor)
        }
      }
    }
    px(6, 18, 60, 2, 0xb8daf2)
  })
}

// Pedra, arquibancadas, muro, tribuna, areia e marcas: uma imagem só (o céu fica
// transparente, inclusive dentro dos arcos do ático, onde as nuvens passam por trás)
function texturaEstadio(scene) {
  return textura(scene, 'arena-coliseu-estadio', LARGURA, ALTURA, (ctx, px) => {
    const r = semente(7)
    for (let x = 0; x < LARGURA; x++) {
      const topo = Math.round(yAtico(x))
      const baseAtico = Math.round(yLinha(DEGRAUS, x))
      // --- ático: parede com cornija e arcos vazados
      px(x, topo, 1, baseAtico - topo, PEDRA.clara)
      px(x, topo, 1, 2, PEDRA.luz)
      px(x, topo + 2, 1, 1, PEDRA.sombra)
      px(x, baseAtico - 3, 1, 3, PEDRA.sombra)
      const u = (x + 6) % 24 // um arco a cada 24 px
      if (u >= 6 && u < 18) {
        const meio = Math.abs(u - 11.5)
        const curva = 6 - Math.sqrt(Math.max(0, 36 - meio * meio))
        const y0 = Math.round(topo + 6 + curva)
        const y1 = baseAtico - 5
        ctx.clearRect(x, y0, 1, y1 - y0) // o céu aparece pelo arco
        px(x, y0 - 1, 1, 1, PEDRA.sombra)
        if (u === 6 || u === 17) px(x, y0, 1, y1 - y0, PEDRA.media) // espessura do arco
      } else if (u === 4 || u === 19) {
        px(x, topo + 4, 1, baseAtico - topo - 8, PEDRA.luz) // pilastra iluminada
      }
      // mastros do velário (a cada 64 px) com ponta dourada
      if (x % 64 === 30 || x % 64 === 31) {
        px(x, topo - 17, 1, 17, x % 64 === 30 ? 0x7a5230 : 0x50341c)
        px(x, topo - 19, 1, 2, 0xf0c050)
      }

      // --- arquibancadas: cada faixa = espaldar na sombra + beirada do degrau no sol
      for (let k = DEGRAUS - 1; k >= 0; k--) {
        const yA = Math.round(yLinha(k + 1, x))
        const yB = Math.round(yLinha(k, x))
        const longe = k / DEGRAUS // fileiras de cima: mais claras (ar quente/névoa)
        px(x, yA, 1, yB - yA, misturar(PEDRA.sombra, PEDRA.clara, longe * 0.35))
        px(x, yB - 4, 1, 3, misturar(PEDRA.luz, 0xfff4dc, longe * 0.3))
        px(x, yB - 1, 1, 1, PEDRA.escura)
      }
      // escadas e as bocas dos corredores (vomitórios)
      for (const ex of ESCADAS) {
        const dx = x - ex
        if (dx < -4 || dx > 4) continue
        const y0 = Math.round(yLinha(DEGRAUS, x))
        const y1 = Math.round(yLinha(0, x))
        px(x, y0, 1, y1 - y0, dx === -4 || dx === 4 ? PEDRA.sombra : PEDRA.clara)
        if (dx > -4 && dx < 4) for (let y = y0 + 2; y < y1; y += 4) px(x, y, 1, 1, PEDRA.media)
      }
      for (const ex of ESCADAS) {
        const dx = x - ex
        if (dx < -6 || dx > 6) continue
        const yv = Math.round(yLinha(3, x))
        const alto = 9 - Math.round((dx * dx) / 12)
        px(x, yv - alto, 1, alto, PEDRA.funda)
      }

      // --- muro do pódio: mármore com painéis, faixa vermelha e friso dourado
      const yMuro = Math.round(yLinha(0, x))
      const yPe = Math.round(yAreia(x))
      px(x, yMuro, 1, yPe - yMuro, (x % 32 === 0 || x % 32 === 1) ? PEDRA.media : 0xeadcc4)
      px(x, yMuro, 1, 2, 0x9a2a22)
      px(x, yMuro + 2, 1, 1, 0xe0b040)
      px(x, yPe - 2, 1, 2, PEDRA.sombra)
      // portões dos gladiadores: arco escuro com grade
      for (const p of PORTOES) {
        const dx = x - p
        if (dx < -8 || dx > 8) continue
        const alto = yPe - yMuro - 4
        const curva = Math.round(8 - Math.sqrt(Math.max(0, 64 - dx * dx)))
        const y0 = yMuro + 4 + curva
        px(x, y0, 1, yPe - y0, Math.abs(dx) === 8 ? PEDRA.escura : 0x1c120a)
        if (Math.abs(dx) < 8 && (dx + 8) % 3 === 0) px(x, y0 + 1, 1, yPe - y0 - 1, 0x5a4632)
        if (Math.abs(dx) < 8) px(x, yMuro + 4 + Math.round(alto * 0.55), 1, 1, 0x5a4632)
      }

      // --- areia: degradê (longe mais escuro e quente), sombra do muro
      for (let y = yPe; y < ALTURA; y += 2) {
        const p = (y - 190) / (ALTURA - 190)
        px(x, y, 1, 2, misturar(AREIA.longe, AREIA.perto, Math.max(0, Math.min(1, p))))
      }
      for (let s = 0; s < 9; s++) px(x, yPe + s, 1, 1, 0x5a3a1a, 0.32 * (1 - s / 9))
    }

    // grãos de areia
    for (let i = 0; i < 4200; i++) {
      const x = Math.floor(r() * LARGURA)
      const y = Math.floor(yAreia(x) + 2 + r() * (ALTURA - yAreia(x)))
      px(x, y, 1, 1, r() < 0.5 ? AREIA.clara : AREIA.escura, 0.35 + r() * 0.4)
    }
    // marcas das bigas e do rastelo: ovais concêntricos tracejados
    const oval = (s, cor, a, traco, falha, dy = 0) => {
      const passos = Math.round(PODIO.a * s * 4)
      for (let i = 0; i < passos; i++) {
        if (i % (traco + falha) >= traco) continue
        const ang = (i / passos) * Math.PI * 2
        const x = CX + Math.cos(ang) * PODIO.a * s
        const y = CY + dy + Math.sin(ang) * PODIO.b * s
        if (y < yAreia(x) + 4 || y > ALTURA) continue
        px(x, y, 2, 1, cor, a)
      }
    }
    for (const s of [0.86, 0.88]) oval(s, AREIA.escura, 0.5, 40, 6) // rodas da biga (dois sulcos)
    for (const s of [0.6, 0.62]) oval(s, AREIA.escura, 0.45, 26, 9)
    for (const s of [0.38, 0.48, 0.72]) oval(s, AREIA.clara, 0.55, 5, 3) // rastelo
    for (const s of [0.385, 0.485, 0.725]) oval(s, AREIA.escura, 0.35, 5, 3, 1)
    // pegadas
    for (let i = 0; i < 46; i++) {
      const x = 20 + r() * 600
      const y = yAreia(x) + 14 + r() * (ALTURA - yAreia(x) - 20)
      px(x, y, 2, 1, AREIA.escura, 0.6)
      px(x + 3, y + 2, 2, 1, AREIA.escura, 0.6)
    }
    // escudo redondo caído (esquerda) e lança cravada (direita)
    const escudo = (x0, y0) => {
      for (let y = -6; y <= 6; y++) {
        const meia = Math.round(13 * Math.sqrt(1 - (y * y) / 42))
        px(x0 - meia, y0 + y, meia * 2, 1, Math.abs(y) > 4 ? 0xd8a838 : 0xa82a24)
      }
      px(x0 - 3, y0 - 2, 6, 3, 0xf0c860)
      px(x0 - 14, y0 + 6, 28, 2, 0x5a3a1a, 0.35)
    }
    escudo(28, 318)
    for (let i = 0; i < 34; i++) px(616 - i * 0.45, 322 - i, 2, 1, i > 28 ? 0xc8d0d8 : 0x7a5230)
    px(608, 321, 14, 2, 0x5a3a1a, 0.35)
    px(605, 290, 5, 2, 0xc8d0d8)

    // tribuna do imperador: bloco saliente com colunas, toldo roxo e friso dourado
    const t0 = TRIBUNA.x0 + 4
    const t1 = TRIBUNA.x1 - 4
    const yBase = Math.round(yAreia(CX))
    const yPiso = Math.round(yLinha(1, CX)) + 6
    const yTeto = Math.round(yLinha(TRIBUNA.fileiras - 1, CX)) - 4
    px(t0 - 2, yPiso, t1 - t0 + 4, yBase - yPiso, 0xeadcc4) // pódio da tribuna
    px(t0 - 2, yPiso, t1 - t0 + 4, 3, 0xe0b040)
    px(t0 - 2, yPiso + 3, t1 - t0 + 4, 2, 0x9a2a22)
    for (let x = t0 + 6; x < t1 - 4; x += 12) px(x, yPiso + 8, 6, yBase - yPiso - 12, 0xd2c2a4) // painéis
    px(t0, yTeto, t1 - t0, yPiso - yTeto, 0x5a1a2a) // fundo da tribuna (cortina vinho)
    for (let x = t0 + 2; x < t1; x += 4) px(x, yTeto + 4, 1, yPiso - yTeto - 4, 0x6e2236)
    for (const cx of [t0 + 2, t0 + 24, t1 - 28, t1 - 6]) {
      px(cx, yTeto + 4, 4, yPiso - yTeto - 4, 0xf2e6cc) // colunas
      px(cx + 3, yTeto + 4, 1, yPiso - yTeto - 4, 0xc6b294)
      px(cx - 1, yTeto + 3, 6, 2, 0xe0b040)
    }
    px(t0 - 4, yPiso - 3, t1 - t0 + 8, 3, 0xf2e6cc) // balaustrada
    for (let x = t0 - 2; x < t1 + 2; x += 3) px(x, yPiso - 6, 1, 3, 0xf2e6cc)
    px(t0 - 4, yPiso - 7, t1 - t0 + 8, 1, 0xe0b040)
    // toldo roxo com franja dourada e frontão
    for (let i = 0; i < 9; i++) px(t0 - 6 + i * 2, yTeto - 9 + i, t1 - t0 + 12 - i * 4, 1, 0xfff0d0)
    px(t0 - 8, yTeto - 1, t1 - t0 + 16, 4, 0x6a2aa0)
    for (let x = t0 - 8; x < t1 + 8; x += 4) px(x, yTeto + 3, 2, 2, 0xf0c050)
    px(CX - 4, yTeto - 7, 8, 4, 0xe0b040) // águia/medalhão no frontão
  })
}

// Plateia: folha com VARIANTES pedaços de 4 pessoas, 3 quadros cada
// (0 sentado, 1 de pé com os braços para cima = ola, 2 torcendo: um braço / a bandeira do outro lado).
// O pedaço é mais alto que a distância entre as fileiras: a fileira da frente cobre
// a parte de baixo da de trás (só cabeças e ombros aparecem, como numa arquibancada cheia)
const VARIANTES = 12
const ALTURA_PESSOAS = 21
function texturaPlateia(scene) {
  const W = BLOCO
  const H = ALTURA_PESSOAS
  return textura(scene, 'arena-coliseu-plateia', W * 3, H * VARIANTES, (ctx, px, tex) => {
    const r = semente(99)
    for (let v = 0; v < VARIANTES; v++) {
      const pessoas = Array.from({ length: 4 }, (_, i) => ({
        dx: i * 4,
        tunica: TUNICAS[Math.floor(r() * TUNICAS.length)],
        pele: PELES[Math.floor(r() * PELES.length)],
        cabelo: CABELOS[Math.floor(r() * CABELOS.length)],
        alto: Math.floor(r() * 3),
        bandeira: r() < 0.09 ? BANDEIRAS[Math.floor(r() * BANDEIRAS.length)] : null,
        chapeu: r() < 0.1,
      }))
      for (let q = 0; q < 3; q++) {
        const ox = q * W
        const oy = v * H
        // de trás para a frente: as pessoas de índice ímpar ficam um pouco atrás
        for (const i of [1, 3, 0, 2]) {
          const p = pessoas[i]
          const levanta = q === 1 ? 3 : 0
          const x = ox + p.dx
          const yc = oy + 7 - p.alto - levanta - (i % 2) // topo da cabeça
          const escura = misturar(p.tunica, 0x000000, 0.3)
          // ombros/tronco (mais largos que a cabeça) com sombra embaixo
          px(x - 1, yc + 4, 5, oy + H - (yc + 4), p.tunica)
          px(x + 3, yc + 5, 1, oy + H - (yc + 5), escura)
          px(x - 1, yc + 9, 5, oy + H - (yc + 9), escura)
          // cabeça com cabelo e contorno escuro (separa uma pessoa da outra)
          px(x - 1, yc, 5, 5, 0x2a1a10, 0.55)
          px(x, yc, 3, 4, p.pele)
          px(x + 2, yc + 2, 1, 2, misturar(p.pele, 0x000000, 0.2))
          px(x, yc, 3, 1, p.chapeu ? 0xf0e0b0 : p.cabelo)
          px(x + 2, yc + 1, 1, 1, p.chapeu ? 0xf0e0b0 : p.cabelo)
          if (p.chapeu) px(x - 1, yc + 1, 5, 1, 0xd8c890)
          // braços
          const bracoCima = (bx) => px(bx, yc - 3, 1, 6, p.pele)
          if (q === 1) {
            bracoCima(x - 1)
            bracoCima(x + 3)
          } else if (q === 2 && (i + v) % 2 === 0) bracoCima(x + 3)
          // bandeirinha num pauzinho
          if (p.bandeira !== null) {
            const lado = q === 2 ? 1 : -1
            const bx = lado > 0 ? x + 3 : x - 1
            const topo = yc - (q === 1 ? 7 : 5)
            px(bx, topo, 1, 8, 0x5a3a1a)
            px(lado > 0 ? bx + 1 : bx - 3, topo, 3, 2, p.bandeira)
            px(lado > 0 ? bx + 1 : bx - 3, topo + 2, 2, 1, p.bandeira)
          }
        }
        tex.add(`p${v}-${q}`, 0, ox, oy, W, H)
      }
    }
  })
}

// Toldo listrado com a borda de baixo em ondas (pedaço do velário)
function texturaToldo(scene, k) {
  const [a, b] = [
    [0xb8322a, 0xf2e2c4],
    [0xe0a020, 0xb8322a],
    [0x2a5aa8, 0xf2e2c4],
  ][k]
  return textura(scene, `arena-coliseu-toldo-${k}`, 64, 16, (ctx, px) => {
    px(0, 0, 64, 2, 0x5a3a1a)
    for (let x = 0; x < 64; x++) {
      const listra = Math.floor(x / 8) % 2 ? b : a
      const u = x % 8
      const onda = Math.round(Math.sqrt(Math.max(0, 16 - (u - 3.5) * (u - 3.5))))
      px(x, 2, 1, 9 + onda, listra)
      px(x, 9 + onda, 1, 2, misturar(listra, 0x000000, 0.25))
    }
  })
}

function texturaFlamula(scene) {
  return textura(scene, 'arena-coliseu-flamula', 11, 6, (ctx, px) => {
    for (let x = 0; x < 11; x++) {
      const meia = Math.round(3 * (1 - x / 11))
      px(x, 3 - meia, 1, Math.max(1, meia * 2), 0xffffff)
    }
  })
}

// Estandarte vermelho/roxo/dourado: haste, pano com borda, coroa de louros e ponta em V
function texturaEstandarte(scene, k) {
  const pano = [0xa82424, 0x6a2a9a, 0xc88a20][k]
  return textura(scene, `arena-coliseu-estandarte-${k}`, 14, 26, (ctx, px) => {
    px(0, 0, 14, 2, 0xf0c050)
    for (let y = 2; y < 26; y++) {
      if (y <= 20) {
        px(1, y, 12, 1, pano)
        px(1, y, 1, 1, 0xf0c050)
        px(12, y, 1, 1, 0xf0c050)
      } else {
        const corte = y - 20 // ponta em V (rabo de andorinha)
        px(1, y, 6 - corte, 1, pano)
        px(7 + corte, y, 6 - corte, 1, pano)
      }
    }
    px(1, 20, 12, 1, 0xf0c050)
    // coroa de louros
    for (let a = 0; a < 16; a++) {
      const ang = Math.PI * 0.65 + (a / 15) * Math.PI * 1.7
      px(7 + Math.cos(ang) * 4 - 0.5, 11 + Math.sin(ang) * 4 - 0.5, 1, 1, 0xf6d870)
    }
    px(6, 10, 2, 2, 0xf6d870)
  })
}

// Imperador (4 quadros: sentado, acenando, polegar pra cima, polegar pra baixo) e guarda
function texturaImperador(scene) {
  return textura(scene, 'arena-coliseu-imperador', 16 * 4, 20, (ctx, px, tex) => {
    for (let q = 0; q < 4; q++) {
      const o = q * 16
      px(o + 3, 9, 10, 11, 0x7a2ab0) // toga roxa
      px(o + 4, 10, 3, 10, 0xf2e6cc) // faixa branca
      px(o + 5, 4, 6, 6, 0xf2c9a0) // rosto
      px(o + 5, 3, 6, 2, 0xd8d0c0) // cabelo grisalho
      px(o + 4, 3, 1, 3, 0x5aa040) // louros
      px(o + 11, 3, 1, 3, 0x5aa040)
      px(o + 5, 2, 6, 1, 0x7ac050)
      px(o + 6, 6, 1, 1, 0x2a1a10)
      px(o + 9, 6, 1, 1, 0x2a1a10)
      if (q === 0) px(o + 12, 12, 2, 4, 0xf2c9a0)
      else if (q === 1) {
        px(o + 12, 3, 2, 7, 0xf2c9a0)
        px(o + 12, 1, 3, 2, 0xf2c9a0)
      } else {
        const cima = q === 2
        px(o + 12, 6, 3, 4, 0xf2c9a0) // punho
        px(o + 13, cima ? 2 : 10, 1, 4, 0xf2c9a0) // polegar
      }
    }
    for (let q = 0; q < 4; q++) tex.add(`q${q}`, 0, q * 16, 0, 16, 20)
  })
}

function texturaGuarda(scene) {
  return textura(scene, 'arena-coliseu-guarda', 10, 22, (ctx, px) => {
    px(4, 0, 2, 3, 0xd82a2a) // penacho
    px(2, 3, 6, 4, 0xc8b060) // elmo
    px(3, 5, 4, 3, 0xf2c9a0)
    px(2, 8, 6, 10, 0xb03028)
    px(2, 9, 6, 3, 0xc8b060) // couraça
    px(3, 18, 1, 4, 0x6a4a2a)
    px(6, 18, 1, 4, 0x6a4a2a)
    px(9, 0, 1, 22, 0x7a5230) // lança
    px(8, 0, 3, 2, 0xd0d8e0)
  })
}

function texturaPomba(scene) {
  return textura(scene, 'arena-coliseu-pomba', 18, 6, (ctx, px, tex) => {
    // quadro 0 asas em cima, 1 asas embaixo
    px(3, 3, 4, 2, 0xffffff)
    px(0, 0, 3, 3, 0xffffff)
    px(7, 0, 3, 3, 0xffffff)
    px(6, 3, 2, 1, 0xf0a040)
    px(12, 2, 4, 2, 0xffffff)
    px(9, 4, 3, 2, 0xffffff)
    px(16, 4, 2, 2, 0xffffff)
    px(15, 2, 2, 1, 0xf0a040)
    tex.add('a0', 0, 0, 0, 10, 6)
    tex.add('a1', 0, 9, 0, 9, 6)
  })
}

function texturaPoeira(scene) {
  return textura(scene, 'arena-coliseu-poeira', 96, 32, (ctx) => {
    const g = ctx.createRadialGradient(48, 16, 2, 48, 16, 46)
    g.addColorStop(0, 'rgba(246,222,170,0.55)')
    g.addColorStop(1, 'rgba(246,222,170,0)')
    ctx.setTransform(1, 0, 0, 0.34, 0, 10.5)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 96, 96)
  })
}

function texturaSombraTopo(scene) {
  return textura(scene, 'arena-coliseu-sombra-topo', LARGURA, 84, (ctx, px) => {
    for (let y = 0; y < 84; y++) px(0, y, LARGURA, 1, 0x140a06, 0.7 * (1 - y / 84))
  })
}

// ---------- o fundo ----------

export default function coliseu(scene, objetos) {
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }

  // céu, nuvens (atrás do estádio: aparecem por cima e pelos arcos) e pombas
  add(scene.add.image(0, 0, texturaCeu(scene)).setOrigin(0))
  const nuvens = [0, 1, 2].map((k) => ({
    obj: add(scene.add.image(0, 0, texturaNuvem(scene, k)).setOrigin(0).setAlpha(0.95)),
    x: [40, 300, 520][k],
    y: [4, 22, 12][k] + k * 4,
    v: 3 + k * 1.5,
  }))
  const pombas = [0, 1].map(() => add(scene.add.sprite(-40, 0, texturaPomba(scene), 'a0').setVisible(false)))

  add(scene.add.image(0, 0, texturaEstadio(scene)).setOrigin(0))

  // toldos do velário pendurados no ático (entre os mastros) e flâmulas nos mastros
  const toldos = []
  for (let i = 0; i < 10; i++) {
    const x0 = i * 64 + 31
    const x1 = x0 + 64
    const xm = (x0 + x1) / 2
    if (xm > LARGURA + 32) break
    const ang = Math.atan2(yAtico(x1) - yAtico(x0), 64)
    const obj = add(scene.add.image(xm, yAtico(xm) + 1, texturaToldo(scene, i % 3)).setOrigin(0.5, 0).setRotation(ang))
    toldos.push({ obj, ang, fase: i * 0.9 })
  }
  // o primeiro toldo começa antes da tela (entre o mastro de x = -33 e o de 31)
  {
    const ang = Math.atan2(yAtico(31) - yAtico(-33), 64)
    toldos.push({ obj: add(scene.add.image(-1, yAtico(-1) + 1, texturaToldo(scene, 2)).setOrigin(0.5, 0).setRotation(ang)), ang, fase: 4.2 })
  }
  const flamulas = []
  for (let x = 30; x < LARGURA; x += 64) {
    const cor = BANDEIRAS[(x / 64) % BANDEIRAS.length | 0]
    flamulas.push({ obj: add(scene.add.image(x + 1, yAtico(x) - 16, texturaFlamula(scene)).setOrigin(0, 0.5).setTint(cor)), fase: x * 0.07 })
  }

  // plateia: de cima (longe) para baixo (perto), pulando escadas e a tribuna
  texturaPlateia(scene)
  const plateia = []
  const r = semente(1234)
  for (let k = DEGRAUS - 1; k >= 0; k--) {
    for (let x = -BLOCO / 2 + (k % 2) * 6; x < LARGURA + BLOCO; x += BLOCO) {
      const xm = x + BLOCO / 2
      if (ESCADAS.some((e) => Math.abs(xm - e) < BLOCO / 2 + 4)) continue
      if (k < TRIBUNA.fileiras && xm > TRIBUNA.x0 - 6 && xm < TRIBUNA.x1 + 6) continue
      const v = Math.floor(r() * VARIANTES)
      const y = Math.round(yLinha(k, xm)) - 4
      const obj = add(scene.add.image(Math.round(x), y, 'arena-coliseu-plateia', `p${v}-0`).setOrigin(0, 1))
      if (k >= 4) obj.setTint(misturar(0xffffff, 0xd8e4ff, (k - 3) / 4)) // fileiras do fundo: um pouco azuladas
      plateia.push({ obj, v, x: xm, k, y, pose: 0, fase: r() * Math.PI * 2, ritmo: 0.002 + r() * 0.004, animada: r() < 0.55 })
    }
  }

  // imperador e guardas na tribuna
  texturaImperador(scene)
  const yPisoTribuna = Math.round(yLinha(1, CX)) + 6
  const imperador = add(scene.add.sprite(CX, yPisoTribuna - 3, 'arena-coliseu-imperador', 'q0').setOrigin(0.5, 1))
  add(scene.add.image(CX - 30, yPisoTribuna - 1, texturaGuarda(scene)).setOrigin(0.5, 1))
  add(scene.add.image(CX + 30, yPisoTribuna - 1, texturaGuarda(scene)).setOrigin(0.5, 1).setFlipX(true))

  // estandartes no muro do pódio
  const estandartes = [24, 104, 192, 448, 536, 616].map((x, i) => ({
    obj: add(scene.add.image(x, Math.round(yLinha(0, x)) + 3, texturaEstandarte(scene, i % 3)).setOrigin(0.5, 0)),
    fase: i * 1.3,
  }))

  // poeira: grãos dourados flutuando e nuvens de poeira rasteiras na areia
  const graos = Array.from({ length: 34 }, (_, i) => ({
    obj: add(scene.add.rectangle(0, 0, i % 4 ? 1 : 2, i % 4 ? 1 : 2, 0xfff0c8).setAlpha(0.25 + (i % 5) * 0.08)),
    x: (i * 137) % LARGURA,
    y: 90 + ((i * 71) % 380),
    v: 5 + (i % 6) * 2.5,
    fase: i * 0.7,
  }))
  const nuvensPoeira = [0, 1, 2].map((i) => ({
    obj: add(scene.add.image(0, 0, texturaPoeira(scene)).setAlpha(0.5).setScale(1.2 + i * 0.4)),
    x: i * 260,
    y: 250 + i * 70,
    v: 7 + i * 3,
  }))

  // sombra no alto da tela: o HUD (nomes, vida, energia) fica por cima do céu e do
  // ático, e precisa continuar legível
  add(scene.add.image(0, 0, texturaSombraTopo(scene)).setOrigin(0))

  let acumulado = PLATEIA_MS
  let voo = null // { t0, y, v, dir }

  return {
    atualizar(dt, estado) {
      const t = estado.tempo

      for (const n of nuvens) {
        n.x += (n.v * dt) / 1000
        if (n.x > LARGURA + 10) n.x = -80
        n.obj.setPosition(Math.round(n.x), n.y)
      }
      for (const to of toldos) {
        to.obj.setRotation(to.ang + Math.sin(t / 900 + to.fase) * 0.025)
        to.obj.setScale(1, 1 + Math.sin(t / 650 + to.fase) * 0.07)
      }
      for (const f of flamulas) {
        f.obj.setScale(0.7 + 0.3 * Math.abs(Math.sin(t / 240 + f.fase)), 1)
        f.obj.setRotation(Math.sin(t / 380 + f.fase) * 0.15)
      }
      for (const e of estandartes) e.obj.setRotation(Math.sin(t / 1100 + e.fase) * 0.06)
      for (const g of graos) {
        g.x += (g.v * dt) / 1000
        if (g.x > LARGURA + 4) g.x = -4
        g.obj.setPosition(Math.round(g.x), Math.round(g.y + Math.sin(t / 1300 + g.fase) * 6))
      }
      for (const n of nuvensPoeira) {
        n.x += (n.v * dt) / 1000
        if (n.x > LARGURA + 90) n.x = -90
        n.obj.setPosition(n.x, n.y + Math.sin(t / 2000 + n.x / 80) * 4)
      }

      // pombas cruzando o céu a cada ~14 s
      const ciclo = Math.floor(t / 14000)
      if (!voo || voo.ciclo !== ciclo) {
        const rr = semente(ciclo + 5)
        voo = { ciclo, t0: ciclo * 14000 + 2000 + rr() * 4000, y: 30 + rr() * 30, dir: rr() < 0.5 ? 1 : -1 }
      }
      const tv = t - voo.t0
      pombas.forEach((p, i) => {
        const x = voo.dir > 0 ? -20 + tv * 0.07 - i * 16 : LARGURA + 20 - tv * 0.07 + i * 16
        const ativa = tv > 0 && x > -30 && x < LARGURA + 30
        p.setVisible(ativa)
        if (!ativa) return
        p.setFrame(Math.floor(t / 140 + i) % 2 ? 'a0' : 'a1').setFlipX(voo.dir < 0)
        p.setPosition(Math.round(x), Math.round(voo.y + i * 7 + Math.sin(tv / 300 + i) * 3))
      })

      // imperador: acena de tempos em tempos
      const ti = t % IMPERADOR.periodo
      imperador.setFrame(ti > IMPERADOR.periodo - IMPERADOR.acenoMs ? (Math.floor(ti / 220) % 2 ? 'q1' : 'q0') : 'q0')

      // plateia (no ritmo PLATEIA_MS): ola atravessando + torcida espalhada
      acumulado += dt
      if (acumulado < PLATEIA_MS) return
      acumulado %= PLATEIA_MS
      const tOla = t - OLA.primeira
      const frente = tOla >= 0 ? -80 + (tOla % OLA.periodo) * OLA.velocidade : -9999
      for (const p of plateia) {
        const d = Math.abs(p.x + p.k * 8 - frente)
        let pose = 0
        let sobe = 0
        if (d < OLA.largura) {
          pose = 1
          sobe = d < OLA.largura / 2 ? 4 : 2
        } else if (p.animada && Math.sin(t * p.ritmo + p.fase) > 0.55) pose = 2
        if (pose !== p.pose) {
          p.pose = pose
          p.obj.setFrame(`p${p.v}-${pose}`)
        }
        p.obj.y = p.y - sobe
      }
    },
  }
}
