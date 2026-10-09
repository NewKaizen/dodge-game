import Phaser from 'phaser'
import { FONTE } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'

// CURSOR GIGANTE: um cursor de mouse ENORME entra em cada caixa e persegue o
// coração (mais devagar que ele). De tempos em tempos ele para, vira
// "ocupado" (ampulheta do lado) e mira: um anel vermelho fecha em volta da
// ponta durante AVISO_MS e aí ele CLICA, com dano em área no ponto da ponta.
// Às vezes é clique DUPLO (um segundo clique no mesmo lugar, com aviso também).
// Justo: a área de dano é uma bala redonda normal criada já no começo da mira,
// com `aviso` = AVISO_MS (inofensiva e piscando até lá, igual a qualquer
// telegrafo): os i-frames, o graze e a CPU (que enxerga balas telegrafando)
// funcionam como sempre. O sprite da bala fica invisível: o visual é do evento.

const RAIO = 22 // área do clique (px)
const DANO = 4
const AVISO_MS = 850 // da parada até o clique
const DUPLO = { chance: 0.3, avisoMs: 420 }
const VIDA_CLIQUE = 160 // ms que a área machuca
const SEGUE_MS = { inicio: { min: 1500, max: 2200 }, fim: { min: 900, max: 1400 }, rampaMs: 12000 }
const DESCANSO_MS = 380
const VELOCIDADE = { inicio: 110, fim: 140 } // px/s (o coração anda ~180)
const ESCALA_CURSOR = 3.2
const VERMELHO = 0xff3048

// classic arrow: B = contorno preto, W = branco
const SETA = [
  'B...........', 'BB..........', 'BWB.........', 'BWWB........', 'BWWWB.......', 'BWWWWB......', 'BWWWWWB.....',
  'BWWWWWWB....', 'BWWWWWWWB...', 'BWWWWWWWWB..', 'BWWWWWWWWWB.', 'BWWWWWWBBBBB', 'BWWWBWWB....', 'BWWBBWWB....',
  'BWB..BWWB...', 'BB...BWWB...', 'B.....BWWB..', '......BWWB..', '.......BB...',
]
const AMPULHETA = [
  'BBBBBBBBB', 'BWWWWWWWB', '.BWYYYWB.', '.BWWYWWB.', '..BWYWB..', '...BYB...', '...BWB...', '..BWWWB..', '.BWWYWWB.', '.BWYYYWB.', 'BWYYYYYWB', 'BBBBBBBBB',
]
const CORES = { B: '#101018', W: '#ffffff', Y: '#ffd040' }

function textura(arena, chave, mapa) {
  if (arena.textures.exists(chave)) return chave
  const c = document.createElement('canvas')
  c.width = mapa[0].length
  c.height = mapa.length
  const g = c.getContext('2d')
  mapa.forEach((linha, y) => [...linha].forEach((ch, x) => {
    if (!CORES[ch]) return
    g.fillStyle = CORES[ch]
    g.fillRect(x, y, 1, 1)
  }))
  arena.textures.addCanvas(chave, c)
  return chave
}

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  let ativo = false
  let t = 0
  let cliques = 0
  let cursores = [] // por pista
  const vivos = new Set()

  const guardar = (o) => {
    vivos.add(o)
    o.once?.('destroy', () => vivos.delete(o))
    return o
  }

  const rampa = () => Math.min(1, t / SEGUE_MS.rampaMs)
  const tempoSeguindo = () => {
    const k = rampa()
    return entre(SEGUE_MS.inicio.min + (SEGUE_MS.fim.min - SEGUE_MS.inicio.min) * k, SEGUE_MS.inicio.max + (SEGUE_MS.fim.max - SEGUE_MS.inicio.max) * k) / aceleracao
  }

  const criarCursor = (pista, j) => {
    const l = pista.caixa.limites
    const seta = guardar(arena.add.image(0, 0, textura(arena, 'bonus-cursor-seta', SETA)).setOrigin(0.5 / 12, 0.5 / 19).setScale(ESCALA_CURSOR).setDepth(9).setAlpha(0.95))
    const ampulheta = guardar(arena.add.image(0, 0, textura(arena, 'bonus-cursor-ampulheta', AMPULHETA)).setScale(2).setDepth(9).setVisible(false))
    const mira = guardar(arena.add.graphics().setDepth(4))
    pista.caixa.recortar(seta, ampulheta, mira)
    // entra pelo canto de cima de fora da caixa (o recorte esconde até entrar)
    const lado = j === 0 ? 1 : -1
    return { pista, j, seta, ampulheta, mira, x: lado > 0 ? l.right + 30 : l.left - 30, y: l.top - 40, fase: 'segue', ate: tempoSeguindo() * 0.7, bala: null, alvo: null, duplo: false, proximoTique: 0 }
  }

  const mirar = (cu, duplo = false) => {
    const { pista } = cu
    const l = pista.caixa.limites
    cu.fase = 'mira'
    cu.alvo = { x: Phaser.Math.Clamp(cu.x, l.left + 4, l.right - 4), y: Phaser.Math.Clamp(cu.y, l.top + 4, l.bottom - 4) }
    cu.x = cu.alvo.x
    cu.y = cu.alvo.y
    cu.duplo = duplo
    const aviso = duplo ? DUPLO.avisoMs : AVISO_MS
    cu.avisoMs = aviso
    cu.inicioMira = t
    cu.bala = pista.balas.criar({ x: cu.alvo.x, y: cu.alvo.y, raio: RAIO, aviso, vida: VIDA_CLIQUE, atravessa: true, dano: DANO, cor: VERMELHO, pulso: 0, origem: 'bonus-cursor' })
    cu.bala.sprite.setVisible(false)
    if (duplo) mostrarTexto(cu, 'CLIQUE DUPLO!')
  }

  const mostrarTexto = (cu, conteudo) => {
    const l = cu.pista.caixa.limites
    const txt = guardar(arena.add.text(Phaser.Math.Clamp(cu.alvo.x, l.left + 50, l.right - 50), Math.max(l.top + 12, cu.alvo.y - RAIO - 12), conteudo, { fontFamily: FONTE, fontSize: '11px', color: '#ff8a8a', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(14))
    cu.pista.caixa.recortar(txt)
    arena.tweens.add({ targets: txt, alpha: 0, y: txt.y - 8, delay: 350, duration: 250, onComplete: () => txt.destroy() })
  }

  const clicar = (cu) => {
    cliques++
    tocar(arena, 'clique')
    shake(arena, 70, 0.003)
    // o cursor "afunda" no clique
    arena.tweens.killTweensOf(cu.seta)
    cu.seta.setScale(ESCALA_CURSOR * 0.86)
    arena.tweens.add({ targets: cu.seta, scale: ESCALA_CURSOR, duration: 160, ease: 'Back.easeOut' })
    // onda do clique
    const onda = guardar(arena.add.circle(cu.alvo.x, cu.alvo.y, RAIO * 0.6).setStrokeStyle(3, 0xffffff, 0.9).setDepth(6))
    cu.pista.caixa.recortar(onda)
    arena.tweens.add({ targets: onda, scale: 1.9, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => onda.destroy() })
    const miolo = guardar(arena.add.circle(cu.alvo.x, cu.alvo.y, RAIO, VERMELHO, 0.45).setDepth(4))
    cu.pista.caixa.recortar(miolo)
    arena.tweens.add({ targets: miolo, alpha: 0, duration: 220, onComplete: () => miolo.destroy() })
    cu.bala = null
    if (!cu.duplo && sorte() < DUPLO.chance && cu.pista.atacando) return mirar(cu, true)
    cu.fase = 'descanso'
    cu.ate = t + DESCANSO_MS
  }

  const desenharMira = (cu) => {
    const g = cu.mira
    g.clear()
    if (cu.fase !== 'mira') return
    const k = Math.min(1, (t - cu.inicioMira) / cu.avisoMs)
    // área de perigo enchendo + anel fechando + tracejado girando na borda
    g.fillStyle(VERMELHO, 0.1 + 0.25 * k).fillCircle(cu.alvo.x, cu.alvo.y, RAIO)
    g.lineStyle(2, VERMELHO, 0.9).strokeCircle(cu.alvo.x, cu.alvo.y, RAIO + (1 - k) * RAIO * 1.3)
    g.lineStyle(1, 0xffffff, 0.6)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t / 300
      g.beginPath()
      g.arc(cu.alvo.x, cu.alvo.y, RAIO, a, a + 0.25)
      g.strokePath()
    }
  }

  const atualizarCursor = (cu, delta) => {
    const { pista } = cu
    const c = pista.coracoes[0]
    const l = pista.caixa.limites
    const vivo = pista.rodando && c?.ativo && !arena.ko?.[arena.donoDaPista?.(cu.j) ?? cu.j]
    if (cu.fase === 'segue' || cu.fase === 'descanso') {
      if (vivo) {
        // persegue a ponta até o coração, mais devagar que ele
        const vel = (VELOCIDADE.inicio + (VELOCIDADE.fim - VELOCIDADE.inicio) * rampa()) * aceleracao
        const dx = c.x - cu.x
        const dy = c.y - cu.y
        const d = Math.hypot(dx, dy)
        const passo = (vel * delta) / 1000
        if (d <= passo) {
          cu.x = c.x
          cu.y = c.y
        } else {
          cu.x += (dx / d) * passo
          cu.y += (dy / d) * passo
        }
      }
      if (cu.fase === 'descanso' && t >= cu.ate) {
        cu.fase = 'segue'
        cu.ate = t + tempoSeguindo()
      } else if (cu.fase === 'segue' && t >= cu.ate && vivo && pista.atacando && Phaser.Geom.Rectangle.Contains(l, cu.x, cu.y)) mirar(cu)
    } else if (cu.fase === 'mira') {
      // ampulheta tiquetaqueando até o clique (o clique é quando a bala passa a valer)
      if (t >= cu.proximoTique) {
        cu.proximoTique = t + 200
        tocar(arena, 'ampulheta')
      }
      const b = cu.bala
      if (!b || b.morta || b.idade >= b.aviso || !pista.rodando) clicar(cu)
    }
    const mirando = cu.fase === 'mira'
    cu.seta.setPosition(cu.x, cu.y)
    cu.ampulheta.setVisible(mirando).setPosition(cu.x + 38, cu.y + 16).setAngle(mirando ? Math.sin(t / 120) * 12 : 0)
    desenharMira(cu)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      cursores = arena.pistas.map((pista, j) => criarCursor(pista, j))
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      for (const cu of cursores) atualizarCursor(cu, delta)
    },

    estadoDebug() {
      return { t: Math.round(t), cliques, cursores: cursores.map((cu) => ({ fase: cu.fase, x: Math.round(cu.x), y: Math.round(cu.y) })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const cu of cursores) if (cu.bala && !cu.bala.morta) cu.bala.morta = true
      cursores = []
      for (const o of [...vivos]) {
        arena.tweens?.killTweensOf(o)
        o.destroy()
      }
      vivos.clear()
    },
  }
}
