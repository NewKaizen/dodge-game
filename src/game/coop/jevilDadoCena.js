// O DADO DO CAOS na tela (coop/jevilRegra.js liga): o dado gigante que rola no começo da rodada, a face que caiu
// (ícone + o nome em até 5 palavras), o cartãozinho da regra que fica durante a rodada e a prévia da rodada de
// depois. Só desenho: a lógica mora em coop/jevilDado.js. Sem a cena (testes), nada aqui roda.
import { FONTE, CENTRO_X } from '../constants.js'
import { tocar } from '../audio.js'
import { shake } from '../effects/shake.js'
import { flashTela } from '../effects/flash.js'
import { particulas } from '../effects/particulas.js'
import { semLigaduras } from '../campanha/texto.js'
import { FACES } from './jevilDado.js'

const PROFUNDIDADE = 72
const ROLO = { y: 232, tamanho: 92, tamanhoPequeno: 54 }
const CHIP = { x: 8, atual: 70, largura: 158 }
const estilo = (tamanho, cor = '#ffffff', extra = {}) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, align: 'center', ...extra })
const cor = (c) => `#${c.toString(16).padStart(6, '0')}`

// ---------- o dado e os ícones das faces ----------

// as pintas do dado (1..6) em volta do centro
const PINTAS = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
}

// o corpo do dado: um cubo de frente, com borda grossa e um brilho
function corpoDoDado(g, t, corFace) {
  const r = t * 0.2
  g.clear()
  g.fillStyle(0x000000, 0.35).fillRoundedRect(-t / 2 + 3, -t / 2 + 5, t, t, r)
  g.fillStyle(0xfaf6ff, 1).fillRoundedRect(-t / 2, -t / 2, t, t, r)
  g.fillStyle(corFace, 0.28).fillRoundedRect(-t / 2, t * 0.12, t, t * 0.38, { tl: 0, tr: 0, bl: r, br: r })
  g.lineStyle(Math.max(3, t * 0.06), 0x1c1033, 1).strokeRoundedRect(-t / 2, -t / 2, t, t, r)
  g.fillStyle(0xffffff, 0.8).fillRoundedRect(-t / 2 + t * 0.08, -t / 2 + t * 0.07, t * 0.34, t * 0.07, 3)
}

function pintasDoDado(g, t, pips) {
  g.fillStyle(0x1c1033, 1)
  for (const [px, py] of PINTAS[pips] ?? PINTAS[1]) g.fillCircle(px * t * 0.27, py * t * 0.27, t * 0.075)
}

// O ícone de cada face, desenhado com formas (a fonte pixelada não tem estas setas). (x, y) = centro, r = raio.
export function desenharIcone(g, id, x, y, r, c = FACES[id]?.cor ?? 0xffffff) {
  const contorno = Math.max(2, r * 0.22)
  const linha = (pts, fechar = true) => {
    g.lineStyle(contorno + 3, 0x000000, 0.9).strokePoints(pts, fechar)
    g.lineStyle(contorno, c, 1).strokePoints(pts, fechar)
  }
  const pt = (px, py) => ({ x: x + px * r, y: y + py * r })
  const cheio = (pts) => {
    g.fillStyle(0x000000, 0.9).fillPoints(pts.map((p) => ({ x: x + (p.x - x) * 1.22, y: y + (p.y - y) * 1.22 })), true)
    g.fillStyle(c, 1).fillPoints(pts, true)
  }
  if (id === 'sorte') {
    const pts = []
    for (let k = 0; k <= 24; k++) {
      const t = (k / 24) * Math.PI * 2
      const hx = 16 * Math.sin(t) ** 3
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
      pts.push({ x: x + (hx / 17) * r, y: y + (hy / 17) * r + r * 0.05 })
    }
    cheio(pts)
  } else if (id === 'gravidade') {
    cheio([pt(0, -1), pt(0.95, 0.05), pt(0.38, 0.05), pt(0.38, 0.95), pt(-0.38, 0.95), pt(-0.38, 0.05), pt(-0.95, 0.05)])
  } else if (id === 'rapido') {
    cheio([pt(-1, -0.8), pt(-0.15, 0), pt(-1, 0.8), pt(-1, 0.45), pt(-0.55, 0), pt(-1, -0.45)])
    cheio([pt(0.05, -0.8), pt(0.9, 0), pt(0.05, 0.8), pt(0.05, 0.45), pt(0.5, 0), pt(0.05, -0.45)])
  } else if (id === 'trocados') {
    cheio([pt(-0.95, -0.42), pt(0.2, -0.42), pt(0.2, -0.85), pt(0.95, -0.15), pt(0.2, 0.15), pt(0.2, -0.18), pt(-0.95, -0.18)])
    cheio([pt(0.95, 0.42), pt(-0.2, 0.42), pt(-0.2, 0.85), pt(-0.95, 0.15), pt(-0.2, -0.15), pt(-0.2, 0.18), pt(0.95, 0.18)])
  } else if (id === 'espelhados') {
    cheio([pt(-0.14, -0.85), pt(-0.14, 0.85), pt(-0.98, 0.85)])
    cheio([pt(0.14, -0.85), pt(0.14, 0.85), pt(0.98, 0.85)])
    g.fillStyle(0xffffff, 1)
    for (let k = -3; k <= 3; k += 2) g.fillRect(x - r * 0.04, y + k * r * 0.28 - r * 0.07, r * 0.08, r * 0.14)
  } else if (id === 'umPorVez') {
    cheio([pt(-0.78, -0.85), pt(-0.22, -0.85), pt(-0.22, 0.85), pt(-0.78, 0.85)])
    cheio([pt(0.22, -0.85), pt(0.78, -0.85), pt(0.78, 0.85), pt(0.22, 0.85)])
  } else if (id === 'inclinada') {
    const a = -0.34
    const rot = (px, py) => pt(px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a))
    cheio([rot(-1, -0.28), rot(1, -0.28), rot(1, 0.28), rot(-1, 0.28)])
    linha([pt(-0.95, 0.88), pt(0.95, 0.88)], false)
    cheio([pt(-0.25, 0.62), pt(0.25, 0.62), pt(0, 0.28)])
  }
}

// ---------- o conjunto ----------

// cena: a CoopArena (ou CoopArenaN); opcoes: { pequeno, cor }. Devolve os métodos que a regra usa.
export function criarVisuaisDoDado(cena, { pequeno = false, corTema = 0xffd24c } = {}) {
  const objs = new Set()
  let rolagem = null // { objetos, timers }: o que a rolagem em andamento criou
  let chip = null
  let previa = null
  let previaIds = null
  const graficoTroca = cena.add.graphics().setDepth(PROFUNDIDADE - 2)
  const graficoMarcas = cena.add.graphics().setDepth(11.5)
  objs.add(graficoTroca)
  objs.add(graficoMarcas)
  let alturaAtual = 0 // a altura do cartãozinho da rodada (a prévia fica embaixo dele)
  let vivo = true

  const guardar = (o) => (objs.add(o), o)
  const apagar = (o) => {
    if (!o) return
    cena.tweens.killTweensOf(o)
    objs.delete(o)
    o.destroy?.()
  }

  // o cartãozinho (ícone + nome) de uma ou duas faces; x, y = canto de cima à esquerda
  function montarChip(ids, { x, y, rotulo, apagado = false, largura = CHIP.largura }) {
    const c = cena.add.container(x, y).setDepth(PROFUNDIDADE - 3).setAlpha(0)
    const altura = 16 + ids.length * 22
    const fundo = cena.add.graphics()
    fundo.fillStyle(0x140f24, apagado ? 0.78 : 0.92).fillRoundedRect(0, 0, largura, altura, 6)
    fundo.lineStyle(2, FACES[ids[0]].cor, apagado ? 0.6 : 1).strokeRoundedRect(0, 0, largura, altura, 6)
    c.add(fundo)
    c.add(cena.add.text(5, 3, rotulo, estilo(7, apagado ? '#a89cc8' : cor(corTema), { align: 'left', strokeThickness: 2 })))
    ids.forEach((id, k) => {
      const g = cena.add.graphics()
      desenharIcone(g, id, 14, 25 + k * 22, apagado ? 6.5 : 8)
      c.add(g)
      c.add(cena.add.text(28, 25 + k * 22, semLigaduras(FACES[id].titulo), estilo(apagado ? 7 : 8, apagado ? '#d8d0f0' : '#ffffff', { align: 'left', wordWrap: { width: largura - 32 }, strokeThickness: 2 })).setOrigin(0, 0.5))
    })
    cena.tweens.add({ targets: c, alpha: 1, x: { from: x - 18, to: x }, duration: 260, ease: 'Cubic.easeOut' })
    return guardar(c)
  }

  const visuais = {
    // o dado (ou os dois) rola: cai quicando, as pintas giram, a face vira e mostra o ícone com o nome
    rolar(faces, { sem = false } = {}) {
      if (!vivo) return
      this.limparRolagem()
      this.mostrarChipAtual(faces.map((f) => f.id), { escondido: !sem })
      if (sem) return
      const n = faces.length
      const t = pequeno ? ROLO.tamanhoPequeno : n > 1 ? ROLO.tamanho * 0.82 : ROLO.tamanho
      const largura = n > 1 ? 170 : 240
      const objetos = []
      const timers = []
      const anuncio = cena.add.text(CENTRO_X, ROLO.y - t * 0.95 - 14, n > 1 ? 'CAOS CAOS!' : pequeno ? 'DADINHO!' : 'DADO DO CAOS!', estilo(n > 1 ? 24 : 15, cor(corTema), { strokeThickness: 5 })).setOrigin(0.5).setDepth(PROFUNDIDADE).setAlpha(0).setScale(0.6)
      objetos.push(anuncio)
      cena.tweens.add({ targets: anuncio, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' })
      tocar(cena, 'cartaArremessar')
      faces.forEach((face, k) => {
        const x = CENTRO_X + (n > 1 ? (k === 0 ? -1 : 1) * 96 : 0)
        const c = cena.add.container(x, -80).setDepth(PROFUNDIDADE).setRotation(Math.random() * 3 - 1.5)
        const corpo = cena.add.graphics()
        const pintas = cena.add.graphics()
        const icone = cena.add.graphics().setAlpha(0)
        c.add([corpo, pintas, icone])
        corpoDoDado(corpo, t, FACES[face.id].cor)
        pintasDoDado(pintas, t, 1 + Math.floor(Math.random() * 6))
        const nome = cena.add.text(x, ROLO.y + t / 2 + 14, semLigaduras(FACES[face.id].titulo), estilo(n > 1 ? 11 : pequeno ? 11 : 15, cor(FACES[face.id].cor), { strokeThickness: 5, wordWrap: { width: largura } })).setOrigin(0.5, 0).setDepth(PROFUNDIDADE).setAlpha(0)
        const texto = cena.add.text(x, ROLO.y + t / 2 + (n > 1 ? 48 : pequeno ? 34 : 38), semLigaduras(FACES[face.id].texto), estilo(n > 1 ? 8 : 9, '#ffffff', { strokeThickness: 3, wordWrap: { width: largura } })).setOrigin(0.5, 0).setDepth(PROFUNDIDADE).setAlpha(0)
        objetos.push(c, nome, texto)
        // a queda: quica no "chão" da mesa
        cena.tweens.add({ targets: c, y: ROLO.y, duration: 720, delay: k * 170, ease: 'Bounce.easeOut' })
        cena.tweens.add({ targets: c, rotation: 0, duration: 760, delay: k * 170, ease: 'Cubic.easeOut' })
        // as pintas passam rápido enquanto ele cai
        const giro = cena.time.addEvent({
          delay: 70,
          repeat: Math.round((720 + k * 170) / 70),
          callback: () => {
            if (!c.scene) return
            pintasDoDado(pintas.clear(), t, 1 + Math.floor(Math.random() * 6))
          },
        })
        timers.push(giro)
        const pouso = cena.time.delayedCall(720 + k * 170, () => {
          if (!c.scene) return
          pintas.clear()
          pintasDoDado(pintas, t, face.pips)
          if (k === 0) tocar(cena, 'impacto')
          shake(cena, 140, 0.008)
          particulas(cena, x, ROLO.y + t / 2, { cor: 0xffffff, quantidade: 8, velocidade: 120, vida: 380 })
        })
        timers.push(pouso)
        // a face vira: as pintas viram o ícone e o nome cai
        const vira = cena.time.delayedCall(1080 + k * 170, () => {
          if (!c.scene) return
          tocar(cena, 'combo')
          cena.tweens.add({
            targets: c,
            scaleX: 0.05,
            duration: 110,
            yoyo: true,
            onYoyo: () => {
              pintas.clear()
              icone.clear().setAlpha(1)
              desenharIcone(icone, face.id, 0, 0, t * 0.34)
            },
            onComplete: () => c.setScale(1),
          })
          flashTela(cena, FACES[face.id].cor, 0.12, 180)
          particulas(cena, x, ROLO.y, { cor: FACES[face.id].cor, quantidade: 18, velocidade: 170, vida: 560 })
          cena.tweens.add({ targets: nome, alpha: 1, y: { from: ROLO.y + t / 2 + 4, to: ROLO.y + t / 2 + 14 }, duration: 220, delay: 160, ease: 'Back.easeOut' })
          cena.tweens.add({ targets: texto, alpha: 1, duration: 240, delay: 320 })
        })
        timers.push(vira)
      })
      rolagem = { objetos, timers }
      // depois de ler, tudo voa para o cantinho (o cartãozinho já está lá)
      const fim = cena.time.delayedCall(2900, () => this.recolher(objetos))
      timers.push(fim)
    },

    // o dado some e o cartãozinho da rodada aparece
    recolher(objetos) {
      if (!vivo) return
      objetos.forEach((o) => {
        if (!o.scene) return
        cena.tweens.add({ targets: o, alpha: 0, scale: 0.4, x: CHIP.x + 30, y: CHIP.atual + 20, duration: 340, ease: 'Cubic.easeIn', onComplete: () => o.destroy() })
      })
      chip?.setVisible(true)
      if (chip) cena.tweens.add({ targets: chip, alpha: 1, duration: 200 })
      rolagem = null
    },

    limparRolagem() {
      if (!rolagem) return
      for (const t of rolagem.timers) t.remove?.()
      for (const o of rolagem.objetos) {
        cena.tweens.killTweensOf(o)
        o.destroy?.()
      }
      rolagem = null
    },

    // o cartãozinho "REGRA DA RODADA" (fica até o dado da próxima rodada)
    mostrarChipAtual(ids, { escondido = false } = {}) {
      if (!vivo) return
      apagar(chip)
      alturaAtual = 16 + ids.length * 22
      chip = montarChip(ids, { x: CHIP.x, y: CHIP.atual, rotulo: pequeno ? 'DADINHO' : 'DADO DO CAOS' })
      if (escondido) chip.setVisible(false)
      if (previaIds) this.mostrarPrevia(previaIds)
    },

    // a prévia: o que o dado da rodada de depois vai dar (ids; null = sem prévia)
    mostrarPrevia(ids) {
      if (!vivo) return
      apagar(previa)
      previa = null
      previaIds = ids
      if (!ids?.length) return
      previa = montarChip(ids, { x: CHIP.x, y: CHIP.atual + (alturaAtual ? alturaAtual + 6 : 0), rotulo: 'DADO DEPOIS', apagado: true })
    },

    // um dado "descansando" (o chefe está atordoado: sem dado)
    semDado() {
      apagar(chip)
      chip = null
      this.limparRolagem()
    },

    // o aviso da troca-troca: uma seta de cada coração até o lugar do próximo, piscando; `forca` 0..1 (o quanto falta)
    desenharTroca(setas, forca) {
      graficoTroca.clear()
      if (!setas?.length) return
      const pisca = 0.45 + 0.4 * Math.sin(forca * Math.PI * 9)
      for (const s of setas) {
        const dx = s.x2 - s.x1
        const dy = s.y2 - s.y1
        const d = Math.hypot(dx, dy)
        if (d < 4) continue
        const ux = dx / d
        const uy = dy / d
        graficoTroca.lineStyle(5, 0x000000, pisca * 0.8).lineBetween(s.x1 + ux * 12, s.y1 + uy * 12, s.x2 - ux * 12, s.y2 - uy * 12)
        graficoTroca.lineStyle(2.5, s.cor, pisca + 0.2).lineBetween(s.x1 + ux * 12, s.y1 + uy * 12, s.x2 - ux * 12, s.y2 - uy * 12)
        const ax = s.x2 - ux * 14
        const ay = s.y2 - uy * 14
        graficoTroca.fillStyle(s.cor, pisca + 0.2).fillTriangle(s.x2 - ux * 8, s.y2 - uy * 8, ax - uy * 6, ay + ux * 6, ax + uy * 6, ay - ux * 6)
      }
    },
    limparTroca() {
      graficoTroca.clear()
    },
    estourar(x, y, c = 0xffffff) {
      particulas(cena, x, y, { cor: c, quantidade: 12, velocidade: 130, vida: 420 })
    },

    // UM CORAÇÃO POR VEZ: o que se mexe ganha um anel da cor dele; o parado fica gelado, com o símbolo de pausa em cima
    // (aviso: o parado está prestes a ser o da vez e pisca)
    desenharMarcas(lista) {
      const g = graficoMarcas
      g.clear()
      for (const m of lista) {
        if (m.parado) {
          const a = m.aviso ? 0.55 + 0.45 * Math.sin(cena.time.now / 50) : 1
          g.fillStyle(0x9ad8ff, 0.22 * a).fillCircle(m.x, m.y, 13)
          g.lineStyle(2, 0x9ad8ff, 0.95 * a).strokeCircle(m.x, m.y, 13)
          g.fillStyle(0x000000, 0.8).fillRect(m.x - 6, m.y - 27, 12, 12)
          g.fillStyle(0xffffff, 1).fillRect(m.x - 4, m.y - 25, 3, 8).fillRect(m.x + 1, m.y - 25, 3, 8)
        } else {
          g.lineStyle(3, 0x000000, 0.9).strokeCircle(m.x, m.y, 15)
          g.lineStyle(2, 0xffffff, 1).strokeCircle(m.x, m.y, 15)
          g.lineStyle(1.5, m.cor, 1).strokeCircle(m.x, m.y, 18)
        }
      }
    },
    limparMarcas() {
      graficoMarcas.clear()
    },

    destruir() {
      vivo = false
      this.limparRolagem()
      for (const o of [...objs]) {
        cena.tweens.killTweensOf(o)
        o.destroy?.()
      }
      objs.clear()
      chip = null
      previa = null
    },
  }
  return visuais
}
