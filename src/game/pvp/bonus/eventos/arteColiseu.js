import { FONTE } from '../../../constants.js'
import { texturaCanvas, misturar } from '../../../arte/pixelCanvas.js'
import { ignorarNasCaixas } from '../../../recorte.js'

// Arte e utilidades dos eventos do COLISEU (leões, lanças, bigas, rede, imperador...).
// As texturas são pintadas em canvas uma vez por jogo (arte/pixelCanvas.js) e
// têm chaves 'coliseu-*'. Funções de textura devolvem a chave.

const PELE = 0xf2c9a0
const CONTORNO = 0x2a1408

// ---------- leão (2 quadros de corrida, virado para a DIREITA) ----------
export function texturaLeao(scene) {
  return texturaCanvas(scene, 'coliseu-leao', 80, 26, (ctx, px, tex) => {
    const CORPO = 0xe2a548
    const SOMBRA = 0xb87a2a
    const BARRIGA = 0xf6d48c
    const JUBA = 0x8a3a12
    const JUBA_LUZ = 0xc0601c
    for (let q = 0; q < 2; q++) {
      const o = q * 40
      const sobe = q ? 1 : 0 // o corpo sobe um pouco no quadro de pernas esticadas
      // rabo com tufo
      px(o + 1, 5 - sobe, 2, 3, JUBA)
      px(o + 3, 6 - sobe, 2, 2, SOMBRA)
      px(o + 5, 7 - sobe, 3, 2, SOMBRA)
      // pernas de trás e da frente (dois quadros de passada)
      const perna = (x, y, alto, cor) => {
        px(o + x, y, 3, alto, cor)
        px(o + x - 1, y + alto - 1, 4, 2, CONTORNO)
      }
      if (q === 0) {
        perna(8, 15, 7, SOMBRA)
        perna(13, 15, 8, CORPO)
        perna(24, 15, 8, SOMBRA)
        perna(28, 15, 7, CORPO)
      } else {
        perna(5, 13, 7, CORPO) // esticada para trás
        perna(10, 14, 6, SOMBRA)
        perna(27, 14, 6, SOMBRA)
        perna(31, 13, 7, CORPO) // esticada para a frente
      }
      // corpo
      px(o + 7, 8 - sobe, 22, 8, CORPO)
      px(o + 8, 7 - sobe, 18, 1, misturar(CORPO, 0xffffff, 0.3))
      px(o + 9, 14 - sobe, 18, 2, BARRIGA)
      px(o + 7, 15 - sobe, 22, 1, SOMBRA)
      // juba (círculo grande) e cara
      for (let y = -8; y <= 8; y++) {
        const meia = Math.round(Math.sqrt(64 - y * y))
        px(o + 28 - meia, 10 + y - sobe, meia * 2, 1, Math.abs(y) > 5 || meia > 6 ? JUBA : JUBA_LUZ)
      }
      px(o + 29, 6 - sobe, 8, 9, CORPO) // focinho
      px(o + 33, 10 - sobe, 5, 4, BARRIGA)
      px(o + 37, 9 - sobe, 2, 2, CONTORNO) // nariz
      px(o + 31, 8 - sobe, 2, 2, CONTORNO) // olho bravo
      px(o + 30, 7 - sobe, 3, 1, JUBA)
      px(o + 34, 14 - sobe, 4, 2, 0x8a1a1a) // boca aberta (rugindo)
      px(o + 34, 14 - sobe, 1, 1, 0xffffff)
      px(o + 37, 14 - sobe, 1, 1, 0xffffff)
    }
    tex.add('l0', 0, 0, 0, 40, 26)
    tex.add('l1', 0, 40, 0, 40, 26)
  })
}

// ---------- lança (ponta para BAIXO, flâmula no alto) ----------
export function texturaLanca(scene) {
  return texturaCanvas(scene, 'coliseu-lanca', 9, 44, (ctx, px) => {
    px(3, 2, 2, 34, 0x8a5a2a) // haste
    px(4, 2, 1, 34, 0x5a3a1a)
    px(5, 3, 4, 3, 0xd82a2a) // flâmula
    px(5, 6, 3, 2, 0xd82a2a)
    px(5, 8, 1, 1, 0xd82a2a)
    px(2, 34, 4, 2, 0xb08a3a) // anel de bronze
    for (let y = 36; y < 44; y++) {
      const meia = Math.max(0, Math.round((44 - y) / 2.6))
      px(4 - meia, y, meia * 2 + 1, 1, y < 40 ? 0xe8eef4 : 0xb8c4d0) // ponta de ferro
    }
    px(3, 1, 3, 2, 0xb08a3a) // contrapeso
  })
}

// ---------- biga: dois cavalos puxando a carruagem com o cocheiro (virada para a DIREITA) ----------
export function texturaBiga(scene) {
  return texturaCanvas(scene, 'coliseu-biga', 140, 34, (ctx, px, tex) => {
    for (let q = 0; q < 2; q++) {
      const o = q * 70
      const cavalo = (dx, dy, cor, sombra) => {
        // pernas galopando
        const pernas = q === 0 ? [[2, 0], [6, 1], [17, 1], [21, 0]] : [[0, -1], [5, 1], [19, 1], [24, -1]]
        for (const [x, inclina] of pernas) {
          px(o + dx + x, dy + 13, 2, 6, sombra)
          px(o + dx + x + inclina, dy + 18, 3, 2, CONTORNO)
        }
        px(o + dx, dy + 6, 24, 8, cor) // corpo
        px(o + dx + 1, dy + 5, 20, 1, misturar(cor, 0xffffff, 0.3))
        px(o + dx, dy + 12, 24, 2, sombra)
        px(o + dx - 3, dy + 6, 4, 3, sombra) // rabo
        px(o + dx + 20, dy - 1, 5, 9, cor) // pescoço
        px(o + dx + 23, dy - 3, 8, 5, cor) // cabeça
        px(o + dx + 29, dy - 1, 2, 3, sombra)
        px(o + dx + 25, dy - 2, 1, 1, CONTORNO)
        px(o + dx + 19, dy - 3, 4, 8, 0x3a2a1a) // crina
        px(o + dx + 22, dy - 5, 2, 2, cor) // orelha
        px(o + dx + 10, dy + 6, 6, 2, 0xd82a2a) // arreio vermelho
        px(o + dx + 26, dy - 1, 4, 1, 0xf0c050)
      }
      cavalo(40, 4, 0x8a5a30, 0x5a3418) // o de trás (mais escuro)
      cavalo(36, 10, 0xece4d4, 0xb8ac98) // o da frente (branco)
      // rédeas
      for (let x = 20; x < 58; x += 2) px(o + x, 10 + Math.round((x - 20) / 12), 1, 1, 0x3a2a1a)
      px(o + 24, 18, 16, 2, 0x5a3418) // timão ligando a carruagem aos cavalos
      px(o + 24, 18, 16, 1, 0x8a5a2a)
      // carruagem vermelha com friso dourado
      px(o + 4, 12, 22, 10, 0xb02a24)
      px(o + 4, 12, 22, 2, 0xf0c050)
      px(o + 4, 20, 22, 2, 0x6a1a14)
      px(o + 10, 15, 6, 3, 0xf0c050) // medalhão
      // cocheiro de elmo e capa
      px(o + 12, 0, 2, 3, 0xd82a2a) // penacho
      px(o + 10, 2, 6, 4, 0xc8b060) // elmo
      px(o + 12, 5, 4, 3, PELE)
      px(o + 10, 8, 7, 5, 0x3a6ac8)
      px(o + 16, 8, 6, 2, PELE) // braço com as rédeas
      px(o + 6, 6, 4, 7, 0xd82a2a) // capa esvoaçando
      px(o + 4, 8, 3, 4, 0xa81a1a)
      // roda (girando: raios em + ou em x)
      const rx = o + 14
      const ry = 25
      for (let y = -7; y <= 7; y++) {
        const meia = Math.round(Math.sqrt(49 - y * y))
        px(rx - meia, ry + y, meia * 2, 1, CONTORNO)
      }
      for (let y = -5; y <= 5; y++) {
        const meia = Math.round(Math.sqrt(25 - y * y))
        px(rx - meia, ry + y, meia * 2, 1, 0x8a5a2a)
      }
      if (q === 0) {
        px(rx - 5, ry, 10, 1, CONTORNO)
        px(rx, ry - 5, 1, 10, CONTORNO)
      } else {
        for (let k = -4; k <= 4; k++) {
          px(rx + k, ry + k, 1, 1, CONTORNO)
          px(rx + k, ry - k, 1, 1, CONTORNO)
        }
      }
      px(rx - 1, ry - 1, 3, 3, 0xf0c050)
    }
    tex.add('b0', 0, 0, 0, 70, 34)
    tex.add('b1', 0, 70, 0, 70, 34)
  })
}

// ---------- rede do reciário (círculo de corda trançada com pesos de chumbo) ----------
export function texturaRede(scene) {
  return texturaCanvas(scene, 'coliseu-rede', 72, 72, (ctx, px) => {
    const R = 34
    const C = 36
    ctx.save()
    ctx.beginPath()
    ctx.arc(C, C, R, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = 'rgba(40,24,8,0.18)'
    ctx.fillRect(0, 0, 72, 72)
    for (let k = -72; k < 72; k += 7) {
      for (let i = 0; i < 72; i++) {
        px(k + i, i, 1, 1, 0xe6d4a6)
        px(k + 72 - i, i, 1, 1, 0xc8b484)
      }
    }
    ctx.restore()
    for (let a = 0; a < 120; a++) {
      const ang = (a / 120) * Math.PI * 2
      px(C + Math.cos(ang) * R - 1, C + Math.sin(ang) * R - 1, 2, 2, 0xf0e2b8)
    }
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2
      px(C + Math.cos(ang) * R - 2, C + Math.sin(ang) * R - 2, 4, 4, 0x6a7078) // pesos
      px(C + Math.cos(ang) * R - 1, C + Math.sin(ang) * R - 2, 2, 1, 0xa8b0b8)
    }
  })
}

// ---------- reciário: gladiador de rede e tridente (2 quadros: segurando / arremessando) ----------
export function texturaReciario(scene) {
  return texturaCanvas(scene, 'coliseu-reciario', 64, 40, (ctx, px, tex) => {
    for (let q = 0; q < 2; q++) {
      const o = q * 32
      // tridente na mão de trás
      px(o + 5, 2, 1, 36, 0x8a5a2a)
      px(o + 3, 2, 1, 4, 0xc8d0d8)
      px(o + 5, 0, 1, 2, 0xc8d0d8)
      px(o + 7, 2, 1, 4, 0xc8d0d8)
      px(o + 3, 5, 5, 1, 0xc8d0d8)
      // corpo
      px(o + 11, 6, 7, 6, PELE) // cabeça
      px(o + 11, 5, 7, 2, 0x3a2a1a) // cabelo
      px(o + 16, 8, 1, 1, CONTORNO)
      px(o + 10, 12, 10, 10, PELE) // tronco
      px(o + 9, 12, 4, 4, 0xc8b060) // ombreira (galerus)
      px(o + 10, 21, 10, 5, 0xf2e6cc) // tanga
      px(o + 10, 21, 10, 2, 0xd8a838) // cinto
      px(o + 11, 26, 3, 10, PELE) // pernas
      px(o + 16, 26, 3, 10, PELE)
      px(o + 10, 35, 5, 3, 0x6a4a2a)
      px(o + 15, 35, 5, 3, 0x6a4a2a)
      px(o + 6, 14, 4, 2, PELE) // braço do tridente
      // braço da rede
      if (q === 0) {
        px(o + 19, 14, 3, 7, PELE)
        px(o + 18, 20, 8, 8, 0xd8c8a0) // rede enrolada
        px(o + 19, 21, 6, 1, 0xa8946a)
        px(o + 19, 24, 6, 1, 0xa8946a)
      } else {
        px(o + 19, 12, 9, 3, PELE) // braço esticado (arremessou)
        px(o + 27, 10, 4, 4, 0xd8c8a0)
      }
    }
    tex.add('r0', 0, 0, 0, 32, 40)
    tex.add('r1', 0, 32, 0, 32, 40)
  })
}

// ---------- imperador (busto grande) e a mão com o polegar ----------
export function texturaImperadorBusto(scene) {
  return texturaCanvas(scene, 'coliseu-imperador-busto', 40, 40, (ctx, px) => {
    px(4, 28, 32, 12, 0x7a2ab0) // toga roxa
    px(8, 28, 6, 12, 0xf2e6cc) // faixa branca
    px(4, 28, 32, 2, 0x9a4ad0)
    px(28, 30, 4, 4, 0xf0c050) // broche
    px(15, 24, 10, 6, 0xe0b088) // pescoço
    px(11, 8, 18, 18, PELE) // cabeça
    px(11, 22, 18, 4, 0xe0b088) // queixo
    px(11, 6, 18, 5, 0xd8d0c0) // cabelo grisalho
    px(9, 10, 3, 8, 0xd8d0c0)
    px(28, 10, 3, 8, 0xd8d0c0)
    // coroa de louros
    for (let x = 8; x < 32; x += 3) {
      px(x, 5 + (x % 2), 3, 2, 0x5aa040)
      px(x + 1, 4 + (x % 2), 1, 1, 0x8ad060)
    }
    px(14, 13, 4, 1, 0x3a2a1a) // sobrancelhas
    px(22, 13, 4, 1, 0x3a2a1a)
    px(15, 15, 2, 2, 0x2a1a10) // olhos
    px(23, 15, 2, 2, 0x2a1a10)
    px(19, 15, 2, 6, 0xe0b088) // nariz
    px(16, 22, 8, 1, 0x8a4a3a) // boca séria
  })
}

export function texturaPolegar(scene) {
  return texturaCanvas(scene, 'coliseu-polegar', 22, 26, (ctx, px) => {
    // punho fechado com o polegar para CIMA (para baixo: flipY)
    px(4, 11, 15, 13, CONTORNO)
    px(5, 12, 13, 11, PELE)
    for (let k = 0; k < 3; k++) px(5, 15 + k * 3, 11, 1, 0xd09a70) // dedos dobrados
    px(16, 13, 2, 9, 0xd09a70)
    px(5, 1, 7, 12, CONTORNO) // polegar
    px(6, 2, 5, 11, PELE)
    px(7, 2, 3, 2, 0xffe8d0) // unha
    px(6, 23, 12, 3, 0x7a2ab0) // punho da toga
  })
}

// ---------- utilidades ----------

// Texto com contorno (fonte do jogo). pista: recorta na caixa; senão é objeto de tela
export function etiqueta(arena, x, y, conteudo, { cor = '#ffffff', tamanho = 16, pista = null, profundidade = 14 } = {}) {
  const txt = arena.add
    .text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: Math.max(3, Math.round(tamanho / 4)) })
    .setOrigin(0.5)
    .setDepth(pista ? profundidade : 95)
  if (pista) pista.caixa.recortar(txt)
  else ignorarNasCaixas(arena, txt)
  return txt
}

// Chão de areia dentro das caixas (os eventos do coliseu acontecem na arena):
// degradê de areia escura (as balas brancas continuam saltando aos olhos),
// grãos e riscos de rastelo. Fica por baixo de tudo (profundidade 2) e só é
// redesenhado quando a caixa muda de tamanho.
//   const chao = chaoDeAreia(arena)   chao.atualizar() todo frame, chao.destruir() no terminar
const GRAOS = Array.from({ length: 90 }, (_, i) => [(i * 0.6180339) % 1, (i * 0.7548776 + 0.3) % 1, i % 3])
export function chaoDeAreia(arena, { alpha = 0.6 } = {}) {
  const lados = arena.pistas.map((pista) => {
    const g = arena.add.graphics().setDepth(2)
    pista.caixa.recortar(g)
    return { pista, g, chave: '' }
  })
  return {
    atualizar() {
      for (const s of lados) {
        const l = s.pista.caixa.limites
        const chave = `${l.x},${l.y},${l.width},${l.height}`
        if (chave === s.chave) continue
        s.chave = chave
        const g = s.g
        g.clear()
        g.fillGradientStyle(0x6e4e2a, 0x6e4e2a, 0x4a3218, 0x4a3218, alpha, alpha, alpha, alpha)
        g.fillRect(l.x, l.y, l.width, l.height)
        g.lineStyle(1, 0x8a6a40, alpha * 0.5)
        for (let k = 1; k < 5; k++) {
          const y = l.y + (l.height * k) / 5
          for (let x = l.x + 4; x < l.right - 4; x += 10) g.lineBetween(x, y + Math.sin(x / 30 + k) * 2, x + 6, y + Math.sin((x + 6) / 30 + k) * 2)
        }
        for (const [fx, fy, tipo] of GRAOS) {
          g.fillStyle(tipo ? 0x8a6a40 : 0x2e1e0c, alpha * 0.8)
          g.fillRect(Math.round(l.x + fx * l.width), Math.round(l.y + fy * l.height), tipo === 2 ? 2 : 1, 1)
        }
      }
    },
    destruir() {
      for (const s of lados) s.g.destroy()
    },
  }
}

// Nuvenzinha de poeira de areia dentro da caixa (bolinhas que sobem e somem)
export function poeirinha(arena, pista, x, y, { quantidade = 5, cor = 0xd8b880, raio = 3, espalha = 14, vivos = null } = {}) {
  for (let k = 0; k < quantidade; k++) {
    const p = arena.add.circle(x + (Math.random() - 0.5) * espalha, y + (Math.random() - 0.5) * espalha * 0.5, raio * (0.6 + Math.random() * 0.7), cor, 0.7).setDepth(3)
    pista.caixa.recortar(p)
    vivos?.add(p)
    arena.tweens.add({
      targets: p,
      x: p.x + (Math.random() - 0.5) * espalha * 1.6,
      y: p.y - 4 - Math.random() * 8,
      scale: 1.8,
      alpha: 0,
      duration: 380 + Math.random() * 260,
      onComplete: () => {
        vivos?.delete(p)
        p.destroy()
      },
    })
  }
}
