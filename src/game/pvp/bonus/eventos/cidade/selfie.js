import { FONTE } from '../../../../constants.js'
import { alphaClarao } from '../../../../effects/flash.js'
import { semLigaduras } from '../../../../campanha/texto.js'
import { planoSelfie, estadoDoSelfie, SELFIE, fatorDoPlano } from './planos.js'
import { avisoNasCaixas, coracaoDe, tocar } from './util.js'

// SELFIE (CIDADE GRANDE): o celular de alguém aponta para a caixa: aparece o enquadramento com a contagem
// 3... 2... 1... e então o FLASH: o coração CONGELA no lugar por 0,8 s (o joystick não vale, as balas seguem).
// Dá para se preparar: durante os 1,8 s de contagem (o aviso) o coração anda normal, então fuja do que
// vem na direção dele e pare num cantinho seguro. Uma moldura de polaroide e um anel que esvazia mostram
// quanto falta para descongelar. Mesmo plano nas duas caixas (semente da rodada); a CPU também congela.

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const fator = fatorDoPlano(aceleracao)
  let ativo = false
  let t = 0
  let plano = []
  let visuais = [] // por pista: { pista, g, digito, branco, legenda }
  let ultimoNumero = 0
  let ultimaFoto = null
  let avisos = []

  const montarVisual = (pista) => {
    const g = arena.add.graphics().setDepth(20)
    const digito = arena.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '40px', color: '#ffffff', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setDepth(21).setAlpha(0)
    const legenda = arena.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '11px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(21)
    const l = pista.caixa.limites
    const branco = arena.add.rectangle(l.centerX, l.centerY, 700, 700, 0xffffff, 1).setDepth(45).setAlpha(0)
    pista.caixa.recortar(g, digito, legenda, branco)
    return { pista, g, digito, legenda, branco }
  }

  const cantos = (g, l, k, cor) => {
    // as quatro "quinas" do enquadramento do celular
    const m = 6 + (1 - k) * 14
    const c = 14
    g.lineStyle(3, cor, 1)
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = sx < 0 ? l.left + m : l.right - m
      const y = sy < 0 ? l.top + m : l.bottom - m
      g.lineBetween(x, y, x - sx * c, y)
      g.lineBetween(x, y, x, y - sy * c)
    }
  }

  const desenhar = (v, e) => {
    const l = v.pista.caixa.limites
    const c = coracaoDe(arena, arena.pistas.indexOf(v.pista))
    const g = v.g
    g.clear()
    v.digito.setAlpha(0)
    v.legenda.setText('')
    if (e.fase === 'contagem') {
      const k = (SELFIE.numeroMs * 3 - (e.foto.flashEm - t)) / (SELFIE.numeroMs * 3) // 0..1 ao longo da contagem
      const urgente = e.numero === 1
      cantos(g, l, Math.min(1, k * 2.5), urgente ? 0xff5a4a : 0xffffff)
      // o foco gruda no coração (quadrado que aperta)
      if (c?.ativo) {
        const r = 22 - 8 * k
        g.lineStyle(2, urgente ? 0xff5a4a : 0xfff070, 0.95).strokeRect(c.x - r, c.y - r, r * 2, r * 2)
        g.lineStyle(1, 0xffffff, 0.5).lineBetween(c.x - 4, c.y, c.x + 4, c.y).lineBetween(c.x, c.y - 4, c.x, c.y + 4)
      }
      const n = ((e.foto.flashEm - t) % SELFIE.numeroMs) / SELFIE.numeroMs // 1 -> 0 dentro de cada número
      v.digito.setText(String(e.numero)).setPosition(l.centerX, l.top + 58).setAlpha(0.85 * (0.5 + 0.5 * n)).setScale(1 + (1 - n) * 0.25).setColor(urgente ? '#ff8a7a' : '#ffffff')
      v.legenda.setText(semLigaduras(urgente ? 'SORRIA!' : 'FOTO!')).setPosition(l.centerX, l.top + 26)
      // bolinha de "gravando" do celular
      g.fillStyle(0xff3030, Math.sin(t / 90) > 0 ? 1 : 0.3).fillCircle(l.left + 14, l.top + 14, 3.5)
    } else if (e.fase === 'congelado') {
      const k = e.restante / SELFIE.congelaMs // 1 -> 0
      if (c?.ativo) {
        // moldura de polaroide em volta do coração congelado
        g.fillStyle(0x000000, 0.35).fillRect(c.x - 14, c.y - 13, 28, 32)
        g.fillStyle(0xf4f4ee, 0.95).fillRect(c.x - 15, c.y - 15, 30, 33)
        g.fillStyle(0x1a1c26, 1).fillRect(c.x - 12, c.y - 12, 24, 24)
        g.lineStyle(2, 0xffe070, 1).beginPath().arc(c.x, c.y, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k).strokePath() // quanto falta
      }
      g.lineStyle(2, 0xffffff, 0.5).strokeRect(l.left + 2, l.top + 2, l.width - 4, l.height - 4)
    }
  }

  const flash = () => {
    tocar(arena, 'tvFlash')
    for (const v of visuais) {
      arena.tweens.killTweensOf(v.branco)
      v.branco.setAlpha(alphaClarao(0.9))
      arena.tweens.add({ targets: v.branco, alpha: 0, duration: 260, ease: 'Quad.easeOut' })
      const l = v.pista.caixa.limites
      const t2 = arena.add.text(l.centerX, l.top + 22, semLigaduras('CLIQUE!'), { fontFamily: FONTE, fontSize: '16px', color: '#fff070', stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5).setDepth(46)
      v.pista.caixa.recortar(t2)
      arena.tweens.add({ targets: t2, scale: { from: 1.7, to: 1 }, duration: 160, ease: 'Back.easeOut' })
      arena.tweens.add({ targets: t2, alpha: 0, delay: 500, duration: 260, onComplete: () => t2.destroy() })
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoSelfie(sorte)
      ultimoNumero = 0
      ultimaFoto = null
      visuais = arena.pistas.map(montarVisual)
      avisos = avisoNasCaixas(arena, 'FOTO! O CORAÇÃO CONGELA!', { cor: '#fff070', ms: 1000, atraso: 80 })
    },

    // congelado: o direcional não vale
    joy(j, joy) {
      if (!ativo || !joy) return joy
      return estadoDoSelfie(plano, t).fase === 'congelado' ? { x: 0, y: 0 } : joy
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta * fator
      const e = estadoDoSelfie(plano, t)
      if (e.fase === 'contagem' && e.numero !== ultimoNumero) {
        ultimoNumero = e.numero
        tocar(arena, e.numero === 1 ? 'contadorFim' : 'contador')
      }
      if (e.fase === 'congelado' && e.foto !== ultimaFoto) {
        ultimaFoto = e.foto
        ultimoNumero = 0
        flash()
      }
      for (const v of visuais) if (!v.pista.destruida) desenhar(v, e)
    },

    estadoDebug() {
      return { t: Math.round(t), ...estadoDoSelfie(plano, t), foto: undefined, fotos: plano.length }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of visuais) {
        arena.tweens.killTweensOf(v.branco)
        for (const o of [v.g, v.digito, v.legenda, v.branco]) o.destroy()
      }
      visuais = []
      avisos.forEach((a) => a.scene && a.destroy())
      avisos = []
    },
  }
}
