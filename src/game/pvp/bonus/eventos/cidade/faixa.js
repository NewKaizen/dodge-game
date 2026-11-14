import { FONTE, LARGURA } from '../../../../constants.js'
import { registrarZona } from '../../../../attacks/zonas.js'
import { ignorarNasCaixas } from '../../../../recorte.js'
import { planoFaixa, estadoDaFaixa, listraSegura, listraMachuca, FAIXA, fatorDoPlano } from './planos.js'
import { avisoNasCaixas, coracaoDe, ehCpu, pistaViva, tocar } from './util.js'

// FAIXA DE PEDESTRE (CIDADE GRANDE): o chão da caixa é uma faixa de pedestres (listras brancas e pretas).
// O semáforo de pedestres manda: VERMELHO = só as listras BRANCAS são seguras (as pretas queimam);
// VERDE = só as PRETAS. Troca com contagem 3-2-1 (as listras que vão queimar piscam e a contagem aparece
// grande na caixa); logo depois da troca há uma folga curta. Cada listra queimando é uma bala retangular
// parada (dano normal, graze e i-frames como qualquer bala: a CPU enxerga e as zonas que vão queimar
// também são avisadas para ela). Sempre existem listras seguras do lado de qualquer listra (alternam).
// O plano é o mesmo nas duas caixas (semente da rodada).

const DANO = 4
const POS = { x: LARGURA / 2, y: 346 }
const ZONA_AVISO_MS = 1100 // a CPU "vê" a zona que vai queimar esta antecedência antes

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const fator = fatorDoPlano(aceleracao)
  let ativo = false
  let t = 0
  let plano = null
  let visuais = [] // por pista: { pista, g, balas: [], digito }
  let widget = null
  let faseZona = -1 // fase para a qual as zonas da CPU já foram avisadas
  let ultimaContagem = 0
  let ultimaFaseSom = -1
  let avisos = []

  const alturaListra = (l) => l.height / FAIXA.listras

  const garantirBalas = (v, j) => {
    if (!pistaViva(arena, j)) return
    const pista = v.pista
    for (let k = 0; k < FAIXA.listras; k++) {
      if (v.balas[k] && !v.balas[k].morta) continue
      const l = pista.caixa.limites
      const h = alturaListra(l)
      const bala = pista.balas.criar({
        x: l.centerX,
        y: l.top + h * (k + 0.5),
        largura: l.width,
        altura: h * FAIXA.quentaFrac,
        jaAvisada: true,
        atravessa: true,
        dano: DANO,
        origem: 'cid-faixa',
        atualizar: (b) => {
          const lim = pista.caixa.limites
          const al = alturaListra(lim)
          b.x = lim.centerX
          b.y = lim.top + al * (k + 0.5)
          b.largura = lim.width
          b.altura = al * FAIXA.quentaFrac
          b.inofensiva = !pista.atacando || Boolean(pista.ataque?.desarmado) || !listraMachuca(plano, t, k)
        },
      })
      bala.inofensiva = true
      bala.sprite.setVisible(false)
      v.balas[k] = bala
    }
  }

  // a CPU enxerga o que vai queimar
  const avisarCpu = (e, faseIdx) => {
    faseZona = faseIdx
    const proxima = e.proxima
    const duraProxima = FAIXA.faseMs.max
    arena.pistas.forEach((pista, j) => {
      if (!pistaViva(arena, j)) return
      const l = pista.caixa.limites
      const h = alturaListra(l)
      for (let k = 0; k < FAIXA.listras; k++) {
        if (listraSegura(proxima, k)) continue
        registrarZona(pista.balas, { tipo: 'area', x: l.left, y: l.top + h * k, largura: l.width, altura: h }, { ms: e.falta + FAIXA.gracaMs, dura: duraProxima })
      }
    })
  }

  // ---------- desenho ----------
  const desenharCaixa = (v) => {
    const l = v.pista.caixa.limites
    const g = v.g
    const e = estadoDaFaixa(plano, t)
    const h = alturaListra(l)
    g.clear()
    g.fillStyle(0x30333d, 0.78).fillRect(l.left, l.top, l.width, l.height) // asfalto
    const pisca = Math.sin(t / (e.contagem === 1 ? 45 : 85)) > 0
    const q = (h * (1 - FAIXA.quentaFrac)) / 2 // folga em cima e embaixo da parte que queima
    for (let k = 0; k < FAIXA.listras; k++) {
      const y = l.top + h * k
      const branca = k % 2 === 0
      g.fillStyle(branca ? 0xeceff4 : 0x14161c, branca ? 0.92 : 0.94).fillRect(l.left + 3, y + 1, l.width - 6, h - 2)
      const inseguro = !listraSegura(e.luz, k)
      const machuca = listraMachuca(plano, t, k)
      const contando = e.contagem > 0
      const vaiQueimar = !inseguro && contando && !listraSegura(e.proxima, k) // segura agora, queima depois
      const vaiLiberar = inseguro && contando // queima agora, fica segura depois
      const x0 = l.left + 3
      const w = l.width - 6
      if (machuca) {
        g.fillStyle(0xff2a1a, vaiLiberar ? 0.4 : 0.66).fillRect(x0, y + q, w, h - 2 * q)
        g.lineStyle(2, 0xffb0a0, 0.95).strokeRect(x0, y + q, w, h - 2 * q)
        g.lineStyle(1, 0xffd0c0, 0.5)
        for (let x = x0 + 3 + ((t / 25) % 12); x < l.right - 9; x += 12) g.lineBetween(x, y + h - q - 1, x + 6, y + q + 1)
        if (vaiLiberar) g.lineStyle(3, 0x7affc0, pisca ? 1 : 0.2).strokeRect(x0 + 1, y + 2, w - 2, h - 4)
      } else if (inseguro) {
        g.fillStyle(0xff8a50, 0.28).fillRect(x0, y + q, w, h - 2 * q) // folga logo depois da troca (ainda não queima)
      } else if (vaiQueimar) {
        g.fillStyle(0xffa020, pisca ? 0.24 : 0.05).fillRect(x0, y + q, w, h - 2 * q)
        g.lineStyle(2, 0xffb020, pisca ? 1 : 0.3).strokeRect(x0 + 1, y + 2, w - 2, h - 4)
      } else {
        g.lineStyle(1, 0x7affc0, 0.4).strokeRect(x0 + 1, y + 2, w - 2, h - 4)
      }
    }
    // contagem grande no meio da caixa
    v.digito.setPosition(l.centerX, l.centerY)
    if (e.contagem > 0) {
      v.digito.setText(String(e.contagem)).setAlpha(0.7).setColor(e.proxima === 'verde' ? '#7affc0' : '#ff7a6a')
    } else v.digito.setAlpha(0)
  }

  const montarWidget = () => {
    const c = arena.add.container(POS.x, POS.y).setDepth(42)
    const g = arena.add.graphics()
    const nome = arena.add.text(14, 3, '', { fontFamily: FONTE, fontSize: '8px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
    const num = arena.add.text(-3, -2, '', { fontFamily: FONTE, fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5)
    c.add([g, nome, num])
    ignorarNasCaixas(arena, c)
    return { c, g, nome, num }
  }

  const desenharWidget = () => {
    const e = estadoDaFaixa(plano, t)
    const g = widget.g
    g.clear()
    g.fillStyle(0x000000, 0.5).fillRoundedRect(-40, -19, 92, 38, 6)
    g.fillStyle(0x15171c, 1).fillRoundedRect(-41, -21, 92, 38, 6)
    g.lineStyle(2, 0x50586a, 1).strokeRoundedRect(-41, -21, 92, 38, 6)
    const verde = e.luz === 'verde'
    // o bonequinho do semáforo (parado e vermelho / andando e verde)
    const cor = verde ? 0x40e060 : 0xff3a30
    g.fillStyle(cor, 1).fillCircle(-27, -11, 3.5)
    if (verde) {
      g.fillRect(-30, -7, 6, 9)
      g.fillTriangle(-30, 2, -26, 2, -32, 11).fillTriangle(-25, 2, -21, 2, -24, 11)
    } else {
      g.fillRect(-30, -7, 6, 9).fillRect(-29, 2, 2, 9).fillRect(-26, 2, 2, 9)
      g.fillRect(-33, -7, 3, 2).fillRect(-24, -7, 3, 2)
    }
    widget.nome.setText(verde ? 'SÓ PRETAS' : 'SÓ BRANCAS').setColor(verde ? '#7affc0' : '#ff8a7a')
    widget.num.setText(e.contagem > 0 ? String(e.contagem) : '').setColor(e.proxima === 'verde' ? '#7affc0' : '#ff8a7a')
    widget.nome.setPosition(e.contagem > 0 ? 25 : 10, 3)
    widget.num.setPosition(-8, -1)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoFaixa(sorte)
      faseZona = -1
      ultimaContagem = 0
      ultimaFaseSom = -1
      visuais = arena.pistas.map((pista) => {
        const g = arena.add.graphics().setDepth(2)
        const digito = arena.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '46px', color: '#ffffff', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setDepth(9).setAlpha(0)
        pista.caixa.recortar(g, digito)
        return { pista, g, balas: [], digito }
      })
      widget = montarWidget()
      avisos = avisoNasCaixas(arena, 'PISE NA COR CERTA!', { cor: '#ffffff', ms: 1400, atraso: 100 })
      arena.tweens.add({ targets: widget.c, alpha: { from: 0, to: 1 }, y: { from: POS.y + 16, to: POS.y }, duration: 260, ease: 'Back.easeOut' })
    },

    // a CPU, sem bala por perto, anda para o centro da listra segura (e troca de listra na hora da luz mudar)
    joy(j, joy) {
      if (!ativo || !ehCpu(arena, j) || !joy) return joy
      const c = coracaoDe(arena, j)
      const pista = arena.pistas[j]
      if (!c?.ativo || !pistaViva(arena, j)) return joy
      const l = pista.caixa.limites
      const h = alturaListra(l)
      const e = estadoDaFaixa(plano, t)
      // com a troca chegando (menos de 0,5 s) já vale a luz de depois
      const luz = e.contagem > 0 && e.falta < 520 ? e.proxima : e.luz
      let melhor = -1
      for (let k = 0; k < FAIXA.listras; k++) {
        if (!listraSegura(luz, k)) continue
        if (melhor < 0 || Math.abs(l.top + h * (k + 0.5) - c.y) < Math.abs(l.top + h * (melhor + 0.5) - c.y)) melhor = k
      }
      if (melhor < 0) return joy
      const alvoY = l.top + h * (melhor + 0.5)
      const dy = alvoY - c.y
      if (Math.abs(dy) < 2.5) return { x: joy.x, y: 0 }
      return { x: joy.x, y: Math.max(-100, Math.min(100, dy * 12)) }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta * fator
      const e = estadoDaFaixa(plano, t)
      const idx = plano.fases.findIndex((f) => t >= f.em && t < f.fim)
      if (e.contagem > 0 && e.contagem !== ultimaContagem) {
        tocar(arena, e.contagem === 1 ? 'contadorFim' : 'contador')
      }
      ultimaContagem = e.contagem
      if (e.contagem > 0 && e.falta <= ZONA_AVISO_MS + FAIXA.contagemMs && idx !== faseZona) avisarCpu(e, idx)
      if (e.desde < 40 && idx > 0 && idx !== ultimaFaseSom) {
        ultimaFaseSom = idx
        tocar(arena, 'buzina')
      }
      visuais.forEach((v, j) => {
        if (v.pista.destruida) return
        garantirBalas(v, j)
        desenharCaixa(v)
      })
      desenharWidget()
    },

    estadoDebug() {
      const e = plano ? estadoDaFaixa(plano, t) : null
      return { t: Math.round(t), luz: e?.luz, falta: e && Math.round(e.falta), contagem: e?.contagem, quentes: visuais.map((v) => v.balas.filter((b) => b && !b.morta && !b.inofensiva).length) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of visuais) {
        for (const b of v.balas) if (b) b.morta = true
        v.g.destroy()
        v.digito.destroy()
      }
      visuais = []
      if (widget) {
        arena.tweens.killTweensOf(widget.c)
        widget.c.destroy()
      }
      widget = null
      avisos.forEach((a) => a.scene && a.destroy())
      avisos = []
    },
  }
}
