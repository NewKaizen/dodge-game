import { LARGURA } from '../../../../constants.js'
import { flashTela } from '../../../../effects/flash.js'
import { planoGps, girarJoy, GIROS, fatorDoPlano } from './planos.js'
import { avisoNasCaixas, ehCpu, tocar } from './util.js'
import { ignorarNasCaixas } from '../../../../recorte.js'

// GPS (CIDADE GRANDE): o direcional GIRA 90° de tempos em tempos. A voz do GPS avisa 850 ms antes
// ("VIRE À DIREITA"/"VIRE À ESQUERDA", balão no alto de cada caixa e o aparelhinho entre as caixas
// com a seta que mostra para onde o CIMA leva agora); na hora o mundo "vira": o que era ↑ passa a
// andar para → (ou ←). A seta no canto de cada caixa mostra o mapa atual o tempo todo. Mesmo plano nas
// duas caixas (semente da rodada). A CPU também se atrapalha: depois de cada giro anda ~0,6–1,2 s
// "sem entender" e então compensa.

const POS = { x: LARGURA / 2, y: 346 }
const CPU_APRENDE_MS = { min: 600, max: 1200 }
const COR_GPS = 0x4fa8ff

// seta grande (triângulo + haste) em volta de (0, 0) apontando para `ang`
function desenharSeta(g, ang, tamanho, cor, alpha = 1) {
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const p = (x, y) => ({ x: (x * c - y * s) * tamanho, y: (x * s + y * c) * tamanho })
  g.fillStyle(cor, alpha)
  const ponta = [p(0.6, 0), p(0.05, -0.5), p(0.05, 0.5)]
  g.fillTriangle(ponta[0].x, ponta[0].y, ponta[1].x, ponta[1].y, ponta[2].x, ponta[2].y)
  g.fillPoints([p(0.1, -0.2), p(-0.55, -0.2), p(-0.55, 0.2), p(0.1, 0.2)], true)
}

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const fator = fatorDoPlano(aceleracao)
  let ativo = false
  let t = 0
  let plano = []
  let orientacao = 0
  let proxima = 0 // próximo giro do plano
  let anunciado = -1
  let cpuAprendeEm = 0
  let widget = null
  let visuais = [] // por pista: { pista, canto, balao, textoBalao, setaBalao }
  let avisos = []

  const angulo = () => -Math.PI / 2 + (orientacao * Math.PI) / 2 // para onde o CIMA leva

  const montarWidget = () => {
    const c = arena.add.container(POS.x, POS.y).setDepth(42)
    const base = arena.add.graphics()
    base.fillStyle(0x000000, 0.5).fillRoundedRect(-33, -21, 68, 44, 7)
    base.fillStyle(0x1a2438, 1).fillRoundedRect(-34, -24, 68, 44, 7)
    base.lineStyle(2, 0x6a7a9a, 1).strokeRoundedRect(-34, -24, 68, 44, 7)
    // mapa: duas ruas cruzadas
    base.fillStyle(0x2c3a58, 1).fillRect(-30, -20, 60, 30)
    base.fillStyle(0x3d4f78, 1).fillRect(-30, -9, 60, 8).fillRect(-4, -20, 8, 30)
    const seta = arena.add.graphics()
    const rotulo = arena.add.text(0, 14, 'GPS', { fontFamily: 'monospace', fontSize: '8px', color: '#9ac8ff' }).setOrigin(0.5)
    c.add([base, seta, rotulo])
    ignorarNasCaixas(arena, c)
    return { c, seta, rotulo }
  }

  const desenharWidget = (pulso = 0) => {
    widget.seta.clear()
    widget.seta.setPosition(0, -6)
    desenharSeta(widget.seta, angulo(), 13 + pulso * 3, COR_GPS)
  }

  const desenharCantos = () => {
    for (const v of visuais) {
      v.canto.clear()
      const l = v.pista.caixa.limites
      v.canto.setPosition(l.left + 14, l.bottom - 14)
      v.canto.fillStyle(0x000000, 0.45).fillCircle(0, 0, 11)
      v.canto.lineStyle(1, COR_GPS, 0.8).strokeCircle(0, 0, 11)
      desenharSeta(v.canto, angulo(), 8, COR_GPS, 0.95)
    }
  }

  const anunciar = (giro) => {
    tocar(arena, 'aviso')
    const frase = GIROS[giro.giro].frase
    for (const v of visuais) {
      const l = v.pista.caixa.limites
      v.balao.setPosition(l.centerX, l.top + 17).setVisible(true).setAlpha(1)
      v.textoBalao.setText(frase.replace('VIRE ', 'VIRE\n'))
      v.balaoFim = giro.em
      arena.tweens.add({ targets: v.balao, scale: { from: 1.35, to: 1 }, duration: 160, ease: 'Back.easeOut' })
    }
    widget.rotulo.setText(frase.includes('DIREITA') ? '→ VIRE' : 'VIRE ←')
    widget.rotulo.setColor('#ffd23a')
  }

  const girar = (giro) => {
    orientacao = giro.orientacao
    cpuAprendeEm = t + CPU_APRENDE_MS.min + sorte() * (CPU_APRENDE_MS.max - CPU_APRENDE_MS.min)
    tocar(arena, 'virarMundo')
    flashTela(arena, COR_GPS, 0.1, 160)
    widget.rotulo.setText('GPS').setColor('#9ac8ff')
    for (const v of visuais) {
      v.balao.setVisible(false)
      v.balaoFim = null
      arena.tweens.add({ targets: v.canto, scale: { from: 1.7, to: 1 }, duration: 220, ease: 'Back.easeOut' })
    }
    arena.tweens.add({ targets: widget.c, scale: { from: 1.25, to: 1 }, duration: 220, ease: 'Back.easeOut' })
    desenharWidget()
    desenharCantos()
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoGps(sorte)
      orientacao = 0
      proxima = 0
      anunciado = -1
      cpuAprendeEm = 0
      widget = montarWidget()
      desenharWidget()
      visuais = arena.pistas.map((pista) => {
        const canto = arena.add.graphics().setDepth(13)
        const balao = arena.add.container(0, 0).setDepth(41).setVisible(false)
        const fundo = arena.add.graphics()
        fundo.fillStyle(0x0d1830, 0.92).fillRoundedRect(-52, -16, 104, 32, 8)
        fundo.lineStyle(2, COR_GPS, 1).strokeRoundedRect(-52, -16, 104, 32, 8)
        fundo.fillStyle(0x0d1830, 0.92).fillTriangle(-6, 16, 6, 16, 0, 24)
        const textoBalao = arena.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '11px', color: '#bfe0ff', align: 'center', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
        balao.add([fundo, textoBalao])
        pista.caixa.recortar(canto, balao)
        return { pista, canto, balao, textoBalao, balaoFim: null }
      })
      desenharCantos()
      avisos = avisoNasCaixas(arena, 'O CONTROLE VAI GIRAR!', { cor: '#9ac8ff', ms: 1300, atraso: 120 })
      arena.tweens.add({ targets: widget.c, alpha: { from: 0, to: 1 }, y: { from: POS.y + 16, to: POS.y }, duration: 260, ease: 'Back.easeOut' })
    },

    joy(j, joy) {
      if (!ativo || !joy || !orientacao) return joy
      if (ehCpu(arena, j) && t >= cpuAprendeEm) return joy // a CPU já "aprendeu" e compensa
      return girarJoy(joy, orientacao)
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta * fator
      const giro = plano[proxima]
      if (giro) {
        if (anunciado < proxima && t >= giro.avisoEm) {
          anunciado = proxima
          anunciar(giro)
        }
        if (t >= giro.em) {
          girar(giro)
          proxima++
        }
      }
      // aviso: a seta do aparelho pulsa e o balão balança até o giro
      const avisando = giro && anunciado === proxima
      if (avisando) {
        desenharWidget(0.5 + 0.5 * Math.sin(t / 60))
        for (const v of visuais) v.balao.setAngle(Math.sin(t / 70) * 2.5)
      }
    },

    estadoDebug() {
      return { t: Math.round(t), orientacao, proxima, plano: plano.slice(0, 3).map((p) => ({ em: Math.round(p.em), giro: p.giro })), cpuAprendeu: t >= cpuAprendeEm }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      orientacao = 0
      if (widget) {
        arena.tweens.killTweensOf(widget.c)
        widget.c.destroy()
      }
      widget = null
      for (const v of visuais) {
        arena.tweens.killTweensOf([v.canto, v.balao])
        v.canto.destroy()
        v.balao.destroy()
      }
      visuais = []
      avisos.forEach((a) => a.scene && a.destroy())
      avisos = []
    },
  }
}
