import { LARGURA, ALTURA, FONTE } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { ignorarNasCaixas } from '../../../recorte.js'
import { texturasJardim } from '../../../arte/jardim.js'

// VENTANIA (arena JARDIM): rajadas de vento atravessam as caixas e EMPURRAM o
// coração (entra no joystick: dá para fazer força contra, mas anda devagar).
// Cada rajada vem de uma direção sorteada (nunca a mesma da anterior) e é
// AVISADA: antes dela as folhas começam a voar para o lado em que o vento vai
// soprar, riscos de vento aparecem e uma seta pisca na borda para onde ele vai
// empurrar (com o chiado do vento juntando força). Depois a rajada: folhas
// voando rápido, a tela inteira cheia de folhas, e o empurrão.
// A mesma direção nas duas caixas (justo). A CPU sente o vento igual.

const CALMA = { min: 1300, max: 1900 } // ms entre rajadas
const PRIMEIRA = 1000
const AVISO_MS = 850
const RAJADA = { min: 1500, max: 2000 }
const FORCA = 58 // empurrão no joystick (-100..100) no auge da rajada
const SOBE_MS = 220 // o empurrão entra e sai suave
const DESCE_MS = 320
const FOLHAS = { max: 26, telaMax: 30 }
const CORES_FOLHA = [0x7ad35a, 0x5fb04a, 0xf0c040, 0xf08a3a, 0xa8e070]
const DIRECOES = Array.from({ length: 8 }, (_, k) => ({ x: Math.round(Math.cos((k * Math.PI) / 4) * 1000) / 1000, y: Math.round(Math.sin((k * Math.PI) / 4) * 1000) / 1000, k }))

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  let ativo = false
  let t = 0
  let estado = 'calma' // calma | aviso | rajada
  let mudaEm = 0
  let dir = DIRECOES[0]
  let empurrao = 0 // 0..1 (suavizado)
  let visuais = [] // por pista: { pista, riscos, seta, folhas: [] }
  let folhasTela = []
  let riscosTela = null
  let textos = []

  const sortearDirecao = () => {
    const opcoes = DIRECOES.filter((d) => d.k !== dir.k)
    dir = opcoes[Math.floor(sorte() * opcoes.length)]
  }

  // folha nova entrando pelo lado de onde o vento vem: um ponto qualquer da
  // caixa, recuado contra o vento até ficar logo fora da borda (no aviso,
  // algumas já nascem dentro)
  const folha = (l, pista, rapida) => {
    const px = l.left + sorte() * l.width
    const py = l.top + sorte() * l.height
    const ate = (p, d, min, max) => (d > 0 ? (p - (min - 8)) / d : d < 0 ? (max + 8 - p) / -d : Infinity)
    const recuo = Math.min(ate(px, dir.x, l.left, l.right), ate(py, dir.y, l.top, l.bottom)) * (rapida ? 1 : sorte())
    const x = px - dir.x * recuo
    const y = py - dir.y * recuo
    const img = arena.add.image(x, y, 'jardim-folha').setTint(CORES_FOLHA[Math.floor(sorte() * CORES_FOLHA.length)]).setScale(1.6 + sorte() * 0.8).setDepth(3)
    if (pista) pista.caixa.recortar(img)
    else ignorarNasCaixas(arena, img.setDepth(16).setScale(2 + sorte()))
    return { img, x, y, vx: 0, vy: 0, giro: entre(-6, 6), fase: sorte() * 10 }
  }

  // velocidade que o vento quer dar às folhas agora
  const ventoFolhas = () => (estado === 'rajada' ? 300 : estado === 'aviso' ? 70 + ((t - (mudaEm - AVISO_MS)) / AVISO_MS) * 60 : 18)

  const moverFolhas = (lista, delta, l) => {
    const s = delta / 1000
    const alvo = ventoFolhas()
    const perp = { x: -dir.y, y: dir.x }
    const k = Math.min(1, delta / 260)
    return lista.filter((f) => {
      const tremor = Math.sin(t / 140 + f.fase) * (estado === 'rajada' ? 60 : 25)
      // na calmaria as folhas caem devagar, balançando
      const vx = estado === 'calma' ? Math.sin(t / 500 + f.fase) * 20 : dir.x * alvo + perp.x * tremor
      const vy = estado === 'calma' ? 22 : dir.y * alvo + perp.y * tremor
      f.vx += (vx - f.vx) * k
      f.vy += (vy - f.vy) * k
      f.x += f.vx * s
      f.y += f.vy * s
      f.img.setPosition(f.x, f.y).setRotation(f.img.rotation + f.giro * s * (estado === 'rajada' ? 2.5 : 1))
      const fora = f.x < l.left - 40 || f.x > l.right + 40 || f.y < l.top - 40 || f.y > l.bottom + 40
      if (fora) f.img.destroy()
      return !fora
    })
  }

  const avisar = () => {
    tocar(arena, 'ventoAviso')
    for (const v of visuais) {
      const l = v.pista.caixa.limites
      const txt = arena.add
        .text(l.centerX, l.top + 16, 'VENTANIA!', { fontFamily: FONTE, fontSize: '13px', color: '#c8ffb0', stroke: '#000000', strokeThickness: 4 })
        .setOrigin(0.5)
        .setDepth(14)
      v.pista.caixa.recortar(txt)
      textos.push(txt)
      arena.tweens.add({ targets: txt, scale: { from: 1.5, to: 1 }, duration: 200, ease: 'Back.easeOut' })
      arena.tweens.add({ targets: txt, alpha: 0, delay: AVISO_MS, duration: 300, onComplete: () => txt.destroy() })
      // um punhado de folhas já começa a voar (o aviso de verdade)
      for (let k = 0; k < 7; k++) v.folhas.push(folha(l, v.pista, false))
    }
  }

  // riscos de vento (linhas curtas com uma curvinha) indo na direção do vento
  const desenharRiscos = (g, l, qtd, alpha, comp) => {
    g.clear()
    if (alpha <= 0.01) return
    const perp = { x: -dir.y, y: dir.x }
    const vel = estado === 'rajada' ? 0.5 : 0.22
    const meio = Math.hypot(l.width, l.height) / 2
    g.lineStyle(1.5, 0xe8ffe0, alpha)
    for (let k = 0; k < qtd; k++) {
      const faixa = ((k * 0.618) % 1) * 2 - 1
      const anda = ((k * 97 + t * vel) % (meio * 2 + comp)) - meio - comp / 2
      const x = l.centerX + dir.x * anda + perp.x * faixa * meio
      const y = l.centerY + dir.y * anda + perp.y * faixa * meio
      const curva = Math.sin(t / 200 + k) * 3
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + dir.x * comp * 0.6 + perp.x * curva, y + dir.y * comp * 0.6 + perp.y * curva)
      g.lineTo(x + dir.x * comp, y + dir.y * comp)
      g.strokePath()
    }
  }

  // seta piscando na borda para onde o vento vai empurrar
  const desenharSeta = (g, l) => {
    g.clear()
    if (estado !== 'aviso') return
    const pisca = Math.sin(t / 70) > 0 ? 0.95 : 0.35
    const x = l.centerX + dir.x * (l.width / 2 - 22)
    const y = l.centerY + dir.y * (l.height / 2 - 22)
    const a = Math.atan2(dir.y, dir.x)
    const p = (dx, dy) => ({ x: x + Math.cos(a) * dx - Math.sin(a) * dy, y: y + Math.sin(a) * dx + Math.cos(a) * dy })
    g.fillStyle(0xc8ffb0, pisca)
    g.fillPoints([p(-14, -4), p(2, -4), p(2, -10), p(14, 0), p(2, 10), p(2, 4), p(-14, 4)], true)
    g.lineStyle(2, 0x1a3a10, pisca).strokePoints([p(-14, -4), p(2, -4), p(2, -10), p(14, 0), p(2, 10), p(2, 4), p(-14, 4)], true)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      estado = 'calma'
      mudaEm = PRIMEIRA
      texturasJardim(arena)
      sortearDirecao()
      riscosTela = arena.add.graphics().setDepth(16)
      ignorarNasCaixas(arena, riscosTela)
      visuais = arena.pistas.map((pista) => {
        const riscos = arena.add.graphics().setDepth(3)
        const seta = arena.add.graphics().setDepth(9)
        pista.caixa.recortar(riscos, seta)
        return { pista, riscos, seta, folhas: [] }
      })
    },

    joy(j, joy) {
      if (!ativo || empurrao <= 0 || arena.ko?.[j]) return joy
      const c = (v) => Math.max(-100, Math.min(100, v))
      return { x: c(joy.x + dir.x * FORCA * empurrao), y: c(joy.y + dir.y * FORCA * empurrao) }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      if (t >= mudaEm) {
        if (estado === 'calma') {
          sortearDirecao()
          estado = 'aviso'
          mudaEm = t + AVISO_MS
          avisar()
        } else if (estado === 'aviso') {
          estado = 'rajada'
          mudaEm = t + entre(RAJADA.min, RAJADA.max)
          tocar(arena, 'rajada')
        } else {
          estado = 'calma'
          mudaEm = t + entre(CALMA.min, CALMA.max)
        }
      }
      const alvo = estado === 'rajada' ? 1 : 0
      empurrao = alvo ? Math.min(1, empurrao + delta / SOBE_MS) : Math.max(0, empurrao - delta / DESCE_MS)

      for (const v of visuais) {
        const l = v.pista.caixa.limites
        // folhas: poucas caindo na calmaria, cada vez mais no aviso, um monte na rajada
        const chance = estado === 'rajada' ? delta / 28 : estado === 'aviso' ? delta / 110 : delta / 700
        if (v.folhas.length < FOLHAS.max && sorte() < chance) v.folhas.push(estado === 'calma' ? folhaCaindo(l, v.pista) : folha(l, v.pista, true))
        v.folhas = moverFolhas(v.folhas, delta, l)
        const forte = estado === 'rajada' ? 1 : estado === 'aviso' ? 0.5 : 0
        desenharRiscos(v.riscos, l, estado === 'rajada' ? 16 : 7, 0.14 + forte * 0.32, 18 + forte * 26)
        desenharSeta(v.seta, l)
      }
      // a tela toda: folhas e riscos de vento só na rajada (fora das caixas)
      const tela = { left: 0, right: LARGURA, top: 66, bottom: ALTURA, width: LARGURA, height: ALTURA - 66, centerX: LARGURA / 2, centerY: (ALTURA + 66) / 2 }
      if (estado === 'rajada' && folhasTela.length < FOLHAS.telaMax && sorte() < delta / 25) folhasTela.push(folha(tela, null, true))
      folhasTela = moverFolhas(folhasTela, delta, tela)
      desenharRiscos(riscosTela, tela, 22, empurrao * 0.35, 50)
    },

    estadoDebug() {
      return { estado, dir: { x: dir.x, y: dir.y }, empurrao: Number(empurrao.toFixed(2)), folhas: visuais.map((v) => v.folhas.length) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      empurrao = 0
      for (const v of visuais) {
        v.riscos.destroy()
        v.seta.destroy()
        v.folhas.forEach((f) => f.img.destroy())
      }
      visuais = []
      folhasTela.forEach((f) => f.img.destroy())
      folhasTela = []
      riscosTela?.destroy()
      riscosTela = null
      textos.forEach((x) => {
        arena.tweens.killTweensOf(x)
        if (x.scene) x.destroy()
      })
      textos = []
    },
  }

  // na calmaria as folhas caem do alto da caixa
  function folhaCaindo(l, pista) {
    const x = l.left + sorte() * l.width
    const y = l.top - 6
    const img = arena.add.image(x, y, 'jardim-folha').setTint(CORES_FOLHA[Math.floor(sorte() * CORES_FOLHA.length)]).setScale(1.6 + sorte() * 0.8).setDepth(3)
    pista.caixa.recortar(img)
    return { img, x, y, vx: 0, vy: 20, giro: entre(-3, 3), fase: sorte() * 10 }
  }
}
