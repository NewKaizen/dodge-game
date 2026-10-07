import { FONTE, LARGURA } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { ignorarNasCaixas } from '../../../recorte.js'
import { particulas } from '../../../effects/particulas.js'
import { flashTela } from '../../../effects/flash.js'

// BATATINHA FRITA 1, 2, 3!: do nada (só o "1, 2, 3!" rapidinho de aviso) as
// caixas CONGELAM: balas e ataque param no lugar (passo devolve 0). Quem
// continuar mexendo o joystick enquanto a caixa está parada leva dano (uma vez
// por congelamento). Um olho gigante abre no alto da tela vigiando.
// A CPU às vezes se distrai e se mexe também.

const LIVRE = { min: 1700, max: 3300 } // ms andando normal entre um congelamento e outro
const AVISO_MS = 620 // "1, 2, 3!"
const PARADO_MS = 1500 // congelado
const TOLERANCIA = 28 // joystick abaixo disto (de 100) conta como parado
const GRACA_MS = 140 // reflexo: começo do congelamento sem punir
const DANO = 5
const CPU_DISTRAIDA = 0.25 // chance da CPU se mexer num congelamento

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  let estado = 'livre' // 'livre' | 'aviso' | 'parado'
  let mudaEm = 0
  let punidos = [false, false]
  let cpuDistraida = false
  let olho = null
  let textos = []
  let veus = []

  const proximoLivre = () => LIVRE.min + sorte() * (LIVRE.max - LIVRE.min)

  const desenharOlho = (abertura) => {
    olho.clear()
    if (abertura <= 0.02) {
      olho.lineStyle(3, 0xffffff, 1).lineBetween(-34, 0, 34, 0)
      return
    }
    const h = 20 * abertura
    olho.fillStyle(0xffffff, 1).fillEllipse(0, 0, 72, h * 2)
    olho.fillStyle(0xd42340, 1).fillCircle(0, 0, Math.min(13, h))
    olho.fillStyle(0x000000, 1).fillCircle(0, 0, Math.min(6, h * 0.5))
    olho.lineStyle(3, 0x000000, 1).strokeEllipse(0, 0, 72, h * 2)
  }

  const textoTela = (conteudo, cor, tamanho) => {
    const txt = arena.add
      .text(LARGURA / 2, 92, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(95)
    ignorarNasCaixas(arena, txt)
    textos.push(txt)
    arena.tweens.add({ targets: txt, scale: { from: 1.5, to: 1 }, duration: 160, ease: 'Back.easeOut' })
    arena.tweens.add({ targets: txt, alpha: 0, delay: 420, duration: 200, onComplete: () => txt.destroy() })
    return txt
  }

  const avisar = () => {
    estado = 'aviso'
    mudaEm = t + AVISO_MS
    tocar(arena, 'batatinha')
    textoTela('1, 2, 3...', '#ffe040', 18)
  }

  const congelar = () => {
    estado = 'parado'
    mudaEm = t + PARADO_MS
    punidos = [false, false]
    cpuDistraida = sorte() < CPU_DISTRAIDA
    tocar(arena, 'estatua')
    textoTela('ESTÁTUA!', '#7fd8ff', 26)
    veus = arena.pistas.map((pista) => {
      const l = pista.caixa.limites
      const veu = arena.add.rectangle(l.centerX, l.centerY, l.width, l.height, 0x9fd8ff, 0.22).setDepth(12)
      pista.caixa.recortar(veu)
      return veu
    })
    arena.tweens.addCounter({ from: 0, to: 1, duration: 140, onUpdate: (tw) => olho && desenharOlho(tw.getValue()) })
  }

  const soltar = () => {
    estado = 'livre'
    mudaEm = t + proximoLivre()
    veus.forEach((v) => v.destroy())
    veus = []
    arena.tweens.addCounter({ from: 1, to: 0, duration: 160, onUpdate: (tw) => olho && desenharOlho(tw.getValue()) })
  }

  const punir = (j) => {
    punidos[j] = true
    const pista = arena.pistas[j]
    const c = pista.coracoes[0]
    if (!arena.acertou(arena.donoDaPista?.(j) ?? j, DANO)) return
    tocar(arena, 'mexeu')
    flashTela(arena, 0xff3048, 0.18, 160)
    if (c?.ativo) {
      c.tomarDano(500)
      particulas(arena, c.x, c.y, { cor: 0xff3048, quantidade: 14, velocidade: 140 })
      const l = pista.caixa.limites
      const txt = arena.add
        .text(c.x, Math.max(l.top + 12, c.y - 22), 'MEXEU!', { fontFamily: FONTE, fontSize: '13px', color: '#ff5050', stroke: '#000000', strokeThickness: 4 })
        .setOrigin(0.5)
        .setDepth(14)
      pista.caixa.recortar(txt)
      textos.push(txt)
      arena.tweens.add({ targets: txt, y: txt.y - 14, alpha: 0, duration: 700, onComplete: () => txt.destroy() })
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      estado = 'livre'
      mudaEm = 1200
      olho = arena.add.graphics().setDepth(95).setPosition(LARGURA / 2, 52)
      ignorarNasCaixas(arena, olho)
      desenharOlho(0)
    },

    // a CPU obedece (a não ser quando se distrai)
    joy(j, joy) {
      if (!ativo || estado !== 'parado' || j !== arena.cpu || cpuDistraida) return joy
      return { x: 0, y: 0 }
    },

    passo(j, delta, joy) {
      if (!ativo || estado !== 'parado') return delta
      const tempoParado = t - (mudaEm - PARADO_MS)
      const mexendo = Math.hypot(joy?.x ?? 0, joy?.y ?? 0) > TOLERANCIA
      if (mexendo && tempoParado > GRACA_MS && !punidos[j] && !arena.ko?.[j]) punir(j)
      return 0
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      if (t < mudaEm) return
      if (estado === 'livre') avisar()
      else if (estado === 'aviso') congelar()
      else soltar()
    },

    terminar() {
      if (!ativo) return
      ativo = false
      veus.forEach((v) => v.destroy())
      veus = []
      textos.forEach((x) => x.scene && x.destroy())
      textos = []
      olho?.destroy()
      olho = null
    },
  }
}
