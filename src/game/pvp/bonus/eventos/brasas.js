import Phaser from 'phaser'
import { TEMPOS } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { flashTela } from '../../../effects/flash.js'
import { ignorarNasCaixas } from '../../../recorte.js'
import { misturar } from '../../../arte/pixelCanvas.js'
import { etiqueta } from './arteColiseu.js'

// CHÃO EM BRASAS: o contrário da DANÇA DA ESTÁTUA. A areia das caixas virou
// brasa: ficar PARADO queima. Cada coração tem uma barra de CALOR (embaixo da
// caixa) que sobe enquanto ele está parado (anda menos que PARADO_PX_S) e
// desce enquanto ele se mexe. O aviso vem com folga: a partir de AVISO a
// barra pisca, sai fumaça do coração, a brasa embaixo dele acende e chia.
// Barra cheia: QUEIMOU (dano pequeno e fixo, DANO_HP do HP máximo, mínimo 2;
// i-frames normais) e o calor volta para DEPOIS_DE_QUEIMAR. É só continuar se
// mexendo. O calor só sobe com o ataque da caixa rodando (não no respiro).
// A CPU: quando o calor passa de CPU_REAGE, ela dá uma voltinha (joy()).
// terminar() apaga as brasas e as barras.

const SOBE_MS = 1600 // parado: de 0 a cheio
const DESCE_MS = 1100 // andando: de cheio a 0
const PARADO_PX_S = 28 // abaixo disso conta como parado
const AVISO = 0.55
const DEPOIS_DE_QUEIMAR = 0
const DANO_HP = 0.035
const CPU_REAGE = 0.4
const BRASAS = 46 // pontinhos de brasa por caixa
const BARRA = { largura: 120, altura: 7 }

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  // por pista: { pista, calor, ultimo, chao, brilho, barra, rotulo, pontos, ultimaFumaca, ultimoChiado, alertado }
  let lados = []
  const vivos = new Set()

  const guardar = (o) => {
    vivos.add(o)
    o.once?.('destroy', () => vivos.delete(o))
    return o
  }

  const dono = (j) => arena.donoDaPista?.(j) ?? j

  const queimar = (s, j) => {
    const quem = dono(j)
    const hpMax = arena.estado?.jogadores?.[quem]?.hpMax ?? 100
    const dano = Math.max(2, Math.round(hpMax * DANO_HP))
    s.calor = DEPOIS_DE_QUEIMAR
    const c = s.pista.coracoes[0]
    if (!c?.ativo || c.invencivel) return
    if (!arena.acertou(quem, dano)) return
    c.tomarDano(TEMPOS.invencivelMs)
    tocar(arena, 'queimou')
    flashTela(arena, 0xff6020, 0.18, 220)
    shake(arena, 160, 0.005)
    // labareda subindo do coração
    for (let k = 0; k < 9; k++) {
      const f = guardar(arena.add.triangle(c.x + (sorte() - 0.5) * 18, c.y + 4, 0, 10, 4, 0, 8, 10, k % 2 ? 0xffb030 : 0xff4a10).setDepth(11))
      s.pista.caixa.recortar(f)
      arena.tweens.add({ targets: f, y: f.y - 18 - sorte() * 16, scaleY: 1.6, alpha: 0, duration: 380 + sorte() * 200, onComplete: () => f.destroy() })
    }
    const l = s.pista.caixa.limites
    const txt = guardar(etiqueta(arena, Phaser.Math.Clamp(c.x, l.left + 46, l.right - 46), Math.max(l.top + 14, c.y - 24), 'QUEIMOU!', { cor: '#ff8030', tamanho: 18, pista: s.pista }))
    arena.tweens.add({ targets: txt, scale: { from: 1.5, to: 1 }, duration: 180, ease: 'Back.easeOut' })
    arena.tweens.add({ targets: txt, y: txt.y - 10, alpha: 0, delay: 600, duration: 300, onComplete: () => txt.destroy() })
  }

  const fumaca = (s, c) => {
    const p = guardar(arena.add.circle(c.x + (sorte() - 0.5) * 8, c.y - 4, 2 + sorte() * 2, 0x605048, 0.6).setDepth(11))
    s.pista.caixa.recortar(p)
    arena.tweens.add({ targets: p, y: p.y - 14 - sorte() * 10, x: p.x + (sorte() - 0.5) * 10, scale: 2.2, alpha: 0, duration: 500, onComplete: () => p.destroy() })
  }

  // piso: degradê vermelho-escuro e rachaduras; os pontos de brasa pulsam
  const desenharChao = (s) => {
    const l = s.pista.caixa.limites
    const g = s.chao
    g.clear()
    g.fillGradientStyle(0x3a0e04, 0x3a0e04, 0x6a1a06, 0x6a1a06, 0.55, 0.55, 0.75, 0.75)
    g.fillRect(l.left, l.top, l.width, l.height)
    g.lineStyle(1, 0xff6a20, 0.35)
    for (const r of s.rachas) g.strokePoints(r.map(([fx, fy]) => ({ x: l.left + fx * l.width, y: l.top + fy * l.height })))
    for (const p of s.pontos) {
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t / p.ritmo + p.fase))
      g.fillStyle(p.cor, a).fillRect(Math.round(l.left + p.fx * l.width), Math.round(l.top + p.fy * l.height), p.tam, p.tam)
    }
  }

  const desenharCalor = (s) => {
    const l = s.pista.caixa.limites
    const c = s.pista.coracoes[0]
    // brasa acendendo embaixo do coração conforme o calor (luz macia, por baixo
    // do coração: ele continua visível por cima)
    if (c?.ativo && s.calor > 0.05) {
      const raio = 14 + s.calor * 16
      s.brilho.setVisible(true).setPosition(c.x, c.y + 3).setDisplaySize(raio * 2.4, raio * 2.4).setAlpha(0.2 + s.calor * 0.5)
    } else s.brilho.setVisible(false)
    // barra de calor embaixo da caixa
    const x = l.centerX - BARRA.largura / 2
    const y = l.bottom + 10
    const alerta = s.calor >= AVISO
    const pisca = alerta && Math.sin(t / 60) > 0
    const corNum = alerta ? (pisca ? 0xffffff : 0xff3010) : misturar(0xffc040, 0xff6a10, s.calor / AVISO)
    s.barra.clear()
    s.barra.fillStyle(0x000000, 0.75).fillRect(x - 2, y - 2, BARRA.largura + 4, BARRA.altura + 4)
    s.barra.fillStyle(0x3a1a10, 1).fillRect(x, y, BARRA.largura, BARRA.altura)
    s.barra.fillStyle(corNum, 1).fillRect(x, y, BARRA.largura * Math.min(1, s.calor), BARRA.altura)
    s.barra.lineStyle(1, 0xffffff, 0.5).lineBetween(x + BARRA.largura * AVISO, y - 1, x + BARRA.largura * AVISO, y + BARRA.altura + 1)
    s.rotulo.setPosition(x - 6, y + BARRA.altura / 2).setColor(alerta ? (pisca ? '#ffffff' : '#ff4020') : '#ffb060')
    s.rotulo.setText(alerta ? 'MEXA-SE!' : 'CALOR')
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      tocar(arena, 'chiado')
      lados = arena.pistas.map((pista) => {
        const chao = guardar(arena.add.graphics().setDepth(2))
        const brilho = guardar((arena.textures.exists('bonus-holofote') ? arena.add.image(0, 0, 'bonus-holofote') : arena.add.circle(0, 0, 16, 0xffffff)).setDepth(3).setBlendMode(Phaser.BlendModes.ADD))
        brilho.setTint?.(0xff6a20)
        pista.caixa.recortar(chao, brilho)
        const barra = guardar(arena.add.graphics().setDepth(70))
        const rotulo = guardar(etiqueta(arena, 0, 0, 'CALOR', { cor: '#ffb060', tamanho: 10 }).setOrigin(1, 0.5).setDepth(70))
        ignorarNasCaixas(arena, barra)
        const pontos = Array.from({ length: BRASAS }, () => ({
          fx: sorte(),
          fy: sorte(),
          tam: sorte() < 0.3 ? 2 : 1,
          cor: sorte() < 0.5 ? 0xffa030 : 0xff5010,
          ritmo: 180 + sorte() * 400,
          fase: sorte() * 6.3,
        }))
        const rachas = Array.from({ length: 6 }, () => {
          let x = sorte()
          let y = sorte()
          return Array.from({ length: 4 }, () => {
            x = Math.min(1, Math.max(0, x + (sorte() - 0.5) * 0.25))
            y = Math.min(1, Math.max(0, y + (sorte() - 0.5) * 0.25))
            return [x, y]
          })
        })
        return { pista, calor: 0, ultimo: null, chao, brilho, barra, rotulo, pontos, rachas, ultimaFumaca: 0, ultimoChiado: 0, alertado: false }
      })
    },

    // CPU: esquentou? dá uma voltinha (sem atrapalhar a esquiva quando ela já está andando)
    joy(j, joy) {
      if (!ativo || dono(j) !== arena.cpu) return joy
      const s = lados[j]
      if (!s || s.calor < CPU_REAGE || Math.hypot(joy.x, joy.y) > 40) return joy
      return { x: Math.cos(t / 260) * 80, y: Math.sin(t / 260) * 80 }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((s, j) => {
        const c = s.pista.coracoes[0]
        const valendo = c?.ativo && s.pista.atacando && !s.pista.ataque?.desarmado && !arena.ko?.[dono(j)]
        if (valendo) {
          const andou = s.ultimo ? Math.hypot(c.x - s.ultimo.x, c.y - s.ultimo.y) : 0
          const velocidade = (andou * 1000) / Math.max(1, delta)
          if (velocidade < PARADO_PX_S) s.calor = Math.min(1, s.calor + delta / SOBE_MS)
          else s.calor = Math.max(0, s.calor - delta / DESCE_MS)
          if (s.calor >= AVISO) {
            if (!s.alertado) {
              s.alertado = true
              tocar(arena, 'chiado')
            }
            if (t - s.ultimaFumaca > 70) {
              s.ultimaFumaca = t
              fumaca(s, c)
            }
          } else s.alertado = false
          if (s.calor >= 1) queimar(s, j)
        } else s.calor = Math.max(0, s.calor - delta / DESCE_MS)
        s.ultimo = c?.ativo ? { x: c.x, y: c.y } : null
        desenharChao(s)
        desenharCalor(s)
      })
    },

    estadoDebug() {
      return { calor: lados.map((s) => Math.round(s.calor * 100) / 100) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      lados = []
      for (const o of [...vivos]) {
        arena.tweens?.killTweensOf(o)
        o.destroy()
      }
      vivos.clear()
    },
  }
}
