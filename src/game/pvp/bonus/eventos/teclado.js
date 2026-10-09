import { FONTE, LARGURA } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { ignorarNasCaixas } from '../../../recorte.js'
import { flashTela } from '../../../effects/flash.js'
import { MAPA_NORMAL, aplicarMapa, sortearMapa, setaResultante } from '../../bonusInformatica.js'

// TECLADO EMBARALHADO: alguém trocou as teclas de lugar no laboratório. As
// setas passam a mandar o coração para OUTRO lado (← vira ↑, ↓ vira →...): uma
// das 7 trocas de bonusInformatica.js (giros e espelhos: seta sempre vira seta).
// De tempos em tempos a troca muda. Justo: um tecladinho entre as caixas
// mostra SEMPRE o mapa atual (cada tecla desenha a seta que ela produz agora;
// as trocadas ficam laranja) e, antes de trocar, AVISO_MS de aviso (as teclas
// tremem, a borda pisca, tique-taque e a barrinha esvaziando).
// Vale igual para os dois jogadores. A CPU também se atrapalha: depois de cada
// troca ela anda com o mapa novo "sem entender" por CPU_APRENDE_MS e aí aprende.

const PRIMEIRA_MS = 1300 // a primeira troca (o aviso já começa logo)
const DURA_MS = { min: 3400, max: 4600 } // quanto tempo cada mapa vale
const AVISO_MS = 1100 // aviso antes de trocar
const CPU_APRENDE_MS = { min: 600, max: 1200 }
const POS = { x: LARGURA / 2, y: 354 } // tecladinho: entre as caixas, acima das mãos
const TECLA = { w: 20, h: 17, gap: 3 }
const LUGAR = { cima: [0, -1], esquerda: [-1, 0], baixo: [0, 0], direita: [1, 0] } // coluna, linha
const ANGULO = { direita: 0, baixo: Math.PI / 2, esquerda: Math.PI, cima: -Math.PI / 2 }

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  let ativo = false
  let t = 0
  let mapa = MAPA_NORMAL
  let trocaEm = PRIMEIRA_MS
  let proximoTique = 0
  let cpuAprendeEm = 0
  let trocas = 0
  let widget = null // { c, base, teclas: { seta: { c, tampa, seta } }, barra, texto }
  let avisos = []

  const dono = (j) => arena.donoDaPista?.(j) ?? j

  // seta desenhada em volta de (0, 0), apontando para `ang`
  const desenharSeta = (g, ang, cor) => {
    g.clear()
    const c = Math.cos(ang)
    const s = Math.sin(ang)
    const p = (x, y) => ({ x: x * c - y * s, y: x * s + y * c })
    g.fillStyle(cor, 1)
    const ponta = [p(6, 0), p(0, -5), p(0, 5)]
    g.fillTriangle(ponta[0].x, ponta[0].y, ponta[1].x, ponta[1].y, ponta[2].x, ponta[2].y)
    const haste = [p(0, -2), p(-6, -2), p(-6, 2), p(0, 2)]
    g.fillPoints(haste, true)
  }

  const montarWidget = () => {
    const c = arena.add.container(POS.x, POS.y).setDepth(42)
    const base = arena.add.graphics()
    const larg = TECLA.w * 3 + TECLA.gap * 2 + 12
    const alt = TECLA.h * 2 + TECLA.gap + 12
    base.fillStyle(0x000000, 0.45).fillRoundedRect(-larg / 2 + 2, -alt / 2 - 4, larg, alt, 4)
    base.fillStyle(0x2a3040, 1).fillRoundedRect(-larg / 2, -alt / 2 - 6, larg, alt, 4)
    base.fillStyle(0x3a4256, 1).fillRect(-larg / 2 + 3, -alt / 2 - 5, larg - 6, 1)
    const borda = arena.add.graphics()
    borda.lineStyle(2, 0xffd040, 1).strokeRoundedRect(-larg / 2 - 2, -alt / 2 - 8, larg + 4, alt + 4, 5)
    borda.setAlpha(0)
    c.add([base, borda])
    const teclas = {}
    for (const [seta, [col, lin]] of Object.entries(LUGAR)) {
      const x = col * (TECLA.w + TECLA.gap)
      const y = lin * (TECLA.h + TECLA.gap) + TECLA.h / 2 - 4
      const tc = arena.add.container(x, y)
      const tampa = arena.add.graphics()
      // tecla: lateral escura embaixo, topo claro
      tampa.fillStyle(0x8a90a0, 1).fillRoundedRect(-TECLA.w / 2, -TECLA.h / 2, TECLA.w, TECLA.h, 3)
      tampa.fillStyle(0xd8dce4, 1).fillRoundedRect(-TECLA.w / 2 + 1, -TECLA.h / 2, TECLA.w - 2, TECLA.h - 4, 3)
      tampa.fillStyle(0xffffff, 0.7).fillRect(-TECLA.w / 2 + 3, -TECLA.h / 2 + 1, TECLA.w - 6, 1)
      const g = arena.add.graphics().setPosition(0, -2)
      tc.add([tampa, g])
      c.add(tc)
      teclas[seta] = { c: tc, seta: g, xBase: x, yBase: y }
    }
    // barrinha do aviso (esvazia até a troca) e o "TROCANDO!"
    const barra = arena.add.graphics()
    const texto = arena.add.text(0, -alt / 2 - 16, '', { fontFamily: FONTE, fontSize: '10px', color: '#ffd040', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
    c.add([barra, texto])
    ignorarNasCaixas(arena, c)
    return { c, borda, teclas, barra, texto, larg, alt }
  }

  const desenharTeclas = () => {
    for (const [seta, tecla] of Object.entries(widget.teclas)) {
      const sai = setaResultante(mapa, seta)
      desenharSeta(tecla.seta, ANGULO[sai], sai === seta ? 0x202838 : 0xe0601a)
    }
  }

  // aviso "TECLADO NOVO!" no alto de cada caixa (some sozinho)
  const avisarCaixas = () => {
    for (const pista of arena.pistas) {
      const l = pista.caixa.limites
      const txt = arena.add.text(l.centerX, l.top + 14, 'TECLADO NOVO!', { fontFamily: FONTE, fontSize: '13px', color: '#ffb060', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(14)
      pista.caixa.recortar(txt)
      avisos.push(txt)
      arena.tweens.add({ targets: txt, scale: { from: 1.5, to: 1 }, duration: 180, ease: 'Back.easeOut' })
      arena.tweens.add({ targets: txt, alpha: 0, delay: 700, duration: 300, onComplete: () => txt.destroy() })
    }
  }

  const trocar = () => {
    mapa = sortearMapa(sorte, mapa)
    trocas++
    trocaEm = t + entre(DURA_MS.min, DURA_MS.max)
    cpuAprendeEm = t + entre(CPU_APRENDE_MS.min, CPU_APRENDE_MS.max)
    tocar(arena, 'embaralhar')
    flashTela(arena, 0xffb060, 0.1, 160)
    avisarCaixas()
    // as setas "viram" (achatam e voltam já com o desenho novo)
    for (const tecla of Object.values(widget.teclas)) {
      arena.tweens.killTweensOf(tecla.seta)
      arena.tweens.add({ targets: tecla.seta, scaleX: 0, duration: 70, yoyo: true, onYoyo: () => desenharTeclas() })
    }
    arena.tweens.add({ targets: widget.c, scale: { from: 1.25, to: 1 }, duration: 220, ease: 'Back.easeOut' })
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      mapa = MAPA_NORMAL
      trocaEm = PRIMEIRA_MS
      widget = montarWidget()
      desenharTeclas()
      arena.tweens.add({ targets: widget.c, alpha: { from: 0, to: 1 }, y: { from: POS.y + 16, to: POS.y }, duration: 260, ease: 'Back.easeOut' })
    },

    joy(j, joy) {
      if (!ativo || !joy) return joy
      // a CPU, depois de aprender o mapa novo, compensa a troca (desvia normal)
      if (dono(j) === arena.cpu && t >= cpuAprendeEm) return joy
      return aplicarMapa(mapa, joy)
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      if (t >= trocaEm) trocar()
      const falta = trocaEm - t
      const avisando = falta <= AVISO_MS
      // aviso: teclas tremendo, borda piscando, tique e barrinha esvaziando
      for (const tecla of Object.values(widget.teclas)) {
        const tremor = avisando ? Math.sin(t / 25 + tecla.xBase) * 1.5 : 0
        tecla.c.setPosition(tecla.xBase + tremor, tecla.yBase + (avisando ? Math.cos(t / 31 + tecla.yBase) : 0))
      }
      widget.borda.setAlpha(avisando ? (Math.floor(t / 110) % 2 ? 1 : 0.25) : 0)
      widget.barra.clear()
      if (avisando) {
        const k = Math.max(0, falta / AVISO_MS)
        widget.barra.fillStyle(0x000000, 0.6).fillRect(-widget.larg / 2, widget.alt / 2 - 3, widget.larg, 4)
        widget.barra.fillStyle(0xffd040, 1).fillRect(-widget.larg / 2, widget.alt / 2 - 3, widget.larg * k, 4)
        widget.texto.setText(`TROCA EM ${Math.max(1, Math.ceil((falta / AVISO_MS) * 3))}`)
        if (t >= proximoTique) {
          proximoTique = t + 260
          tocar(arena, 'teclas')
        }
      } else widget.texto.setText(trocas ? '' : 'SETAS')
    },

    estadoDebug() {
      return { t: Math.round(t), mapa: mapa.id, trocaEm: Math.round(trocaEm), trocas, cpuAprendeu: t >= cpuAprendeEm }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      mapa = MAPA_NORMAL
      if (widget) {
        for (const tecla of Object.values(widget.teclas)) arena.tweens.killTweensOf(tecla.seta)
        arena.tweens.killTweensOf(widget.c)
        widget.c.destroy()
      }
      widget = null
      avisos.forEach((a) => a.scene && a.destroy())
      avisos = []
    },
  }
}
