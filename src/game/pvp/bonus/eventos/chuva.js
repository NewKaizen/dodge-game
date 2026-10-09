import { LARGURA, ALTURA, FONTE } from '../../../constants.js'
import { tocar, somContinuo } from '../../../audio.js'
import { ignorarNasCaixas } from '../../../recorte.js'

// CHUVA DE VERÃO (arena JARDIM): chove forte nas duas caixas. As gotas pesadas
// EMPURRAM o coração para baixo (o tempo todo um pouco; nas PANCADAS, muito:
// antes de cada pancada setas azuis piscam no alto das caixas e o chiado da
// chuva engrossa). E a água junta no chão: POÇAS aparecem (primeiro o
// contorno tracejado piscando e os pingos caindo nele, depois a poça) e,
// DENTRO da poça, o coração escorrega como no gelo (demora para pegar
// velocidade e para frear). As poças secam sozinhas depois de um tempo.
// As poças nascem no mesmo lugar (proporcional) nas duas caixas: é justo.
// Som: chuva contínua do começo ao fim, trovão no começo, "pancada" e o plic-ploc das poças.

const EMPURRA = { leve: 20, forte: 56 } // empurrão para baixo no joystick (-100..100)
const CALMA = { min: 2000, max: 2800 } // ms de chuva leve entre pancadas
const PRIMEIRA = 1600 // ms até a primeira pancada
const AVISO_MS = 750 // setas piscando antes da pancada
const PANCADA = { min: 1500, max: 1900 } // ms de chuva forte
const POCA = {
  max: 2, // poças ao mesmo tempo (por caixa)
  intervalo: { min: 1500, max: 2300 },
  primeira: 900,
  avisoMs: 700, // contorno piscando antes de virar poça
  vida: { min: 4200, max: 5400 }, // ms molhada
  secaMs: 700,
  rx: 0.17, // raios em fração da caixa
  ry: 0.1,
}
const ESCORREGA = { aceleraMs: 420, deslizaMs: 1150 } // dentro da poça (como a PISTA DE GELO)
const AGUA = 0x3a7ad8
const BRILHO = 0xa8d8ff
const GOTA = 0x9ac8ff

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  let ativo = false
  let t = 0
  let ultimoDelta = 16
  let estado = 'calma' // calma | aviso | pancada
  let mudaEm = 0
  let forca = 0 // 0 = chuva leve, 1 = pancada (suaviza a transição)
  let proximaPoca = 0
  let pocas = [] // { fx, fy, nasce, valeEm, secaEm, fim, ondas: [{ fx, fy, t }] }
  let chuva = null
  let veu = null
  let gotasTela = null
  let textos = []
  const velocidade = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]
  let visuais = [] // por pista: { pista, chao, gotas, setas, respingos }
  // gotas da tela toda (fora das caixas): posições fixas que descem com o tempo
  const GOTAS_TELA = Array.from({ length: 70 }, () => ({ x: Math.random() * LARGURA, y: Math.random() * ALTURA, v: 0.8 + Math.random() * 0.5 }))
  const GOTAS_CAIXA = Array.from({ length: 34 }, () => ({ fx: Math.random(), fy: Math.random(), v: 0.8 + Math.random() * 0.4 }))

  const dentro = (p, l, x, y) => {
    const dx = (x - (l.left + p.fx * l.width)) / (POCA.rx * l.width)
    const dy = (y - (l.top + p.fy * l.height)) / (POCA.ry * l.height)
    return dx * dx + dy * dy <= 1
  }
  // a poça escorrega enquanto está molhada (do fim do aviso até a metade da secagem)
  const molhada = (p) => t >= p.valeEm && t < p.secaEm + POCA.secaMs / 2
  const naPoca = (j) => {
    const v = visuais[j]
    const c = v?.pista.coracoes[0]
    if (!c?.ativo) return false
    const l = v.pista.caixa.limites
    return pocas.some((p) => molhada(p) && dentro(p, l, c.x, c.y))
  }

  const novaPoca = () => {
    // longe das outras poças, na metade de baixo (a água escorre para o chão da caixa)
    let melhor = null
    for (let k = 0; k < 8; k++) {
      const p = { fx: entre(0.2, 0.8), fy: entre(0.45, 0.86) }
      p.d = Math.min(9, ...pocas.map((o) => Math.hypot(o.fx - p.fx, (o.fy - p.fy) * 0.8)))
      if (!melhor || p.d > melhor.d) melhor = p
    }
    const vida = entre(POCA.vida.min, POCA.vida.max)
    pocas.push({ fx: melhor.fx, fy: melhor.fy, nasce: t, valeEm: t + POCA.avisoMs, secaEm: t + POCA.avisoMs + vida, fim: t + POCA.avisoMs + vida + POCA.secaMs, ondas: [] })
    tocar(arena, 'poca')
  }

  const avisarPancada = () => {
    tocar(arena, 'pancada')
    for (const v of visuais) {
      const l = v.pista.caixa.limites
      const txt = arena.add
        .text(l.centerX, l.top + 16, 'PANCADA DE CHUVA!', { fontFamily: FONTE, fontSize: '13px', color: '#a8d8ff', stroke: '#000000', strokeThickness: 4 })
        .setOrigin(0.5)
        .setDepth(14)
      v.pista.caixa.recortar(txt)
      textos.push(txt)
      arena.tweens.add({ targets: txt, scale: { from: 1.5, to: 1 }, duration: 200, ease: 'Back.easeOut' })
      arena.tweens.add({ targets: txt, alpha: 0, delay: AVISO_MS + 500, duration: 300, onComplete: () => txt.destroy() })
    }
  }

  const desenharCaixa = (v, delta) => {
    const l = v.pista.caixa.limites
    // poças: aviso (contorno tracejado piscando + pingos), molhada (água, brilho, ondinhas), secando
    v.chao.clear()
    for (const p of pocas) {
      const cx = l.left + p.fx * l.width
      const cy = l.top + p.fy * l.height
      const rx = POCA.rx * l.width
      const ry = POCA.ry * l.height
      if (t < p.valeEm) {
        const k = (t - p.nasce) / POCA.avisoMs
        const pisca = Math.sin(t / 55) > 0 ? 0.9 : 0.35
        v.chao.lineStyle(1.5, BRILHO, pisca)
        for (let a = 0; a < 16; a++) {
          const a0 = (a / 16) * Math.PI * 2
          const a1 = a0 + Math.PI / 16
          v.chao.lineBetween(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry, cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry)
        }
        v.chao.fillStyle(AGUA, 0.35 * k).fillEllipse(cx, cy, rx * 2 * k, ry * 2 * k)
        continue
      }
      const seca = t < p.secaEm ? 1 : Math.max(0, 1 - (t - p.secaEm) / POCA.secaMs)
      const brota = Math.min(1, (t - p.valeEm) / 180)
      const e = seca * (0.85 + 0.15 * brota)
      v.chao.fillStyle(AGUA, 0.5 * seca).fillEllipse(cx, cy, rx * 2 * e, ry * 2 * e)
      v.chao.fillStyle(0x6aa8f0, 0.35 * seca).fillEllipse(cx - rx * 0.1, cy - ry * 0.15, rx * 1.4 * e, ry * 1.1 * e)
      v.chao.lineStyle(1.5, BRILHO, 0.6 * seca).strokeEllipse(cx, cy, rx * 2 * e, ry * 2 * e)
      // reflexo
      v.chao.lineStyle(2, 0xffffff, 0.45 * seca).lineBetween(cx - rx * 0.45, cy - ry * 0.35, cx - rx * 0.1, cy - ry * 0.5)
      // ondinhas dos pingos caindo na poça
      if (sorte() < delta / (90 - forca * 40)) p.ondas.push({ fx: entre(-0.6, 0.6), fy: entre(-0.5, 0.5), t })
      p.ondas = p.ondas.filter((o) => t - o.t < 500)
      for (const o of p.ondas) {
        const k = (t - o.t) / 500
        v.chao.lineStyle(1, 0xffffff, 0.5 * (1 - k) * seca).strokeEllipse(cx + o.fx * rx, cy + o.fy * ry, 3 + k * 12, 1.5 + k * 5)
      }
    }

    // chuva dentro da caixa (fraca o bastante para as balas continuarem saltando aos olhos)
    v.gotas.clear()
    const qtd = Math.round(14 + forca * 20)
    const comp = 7 + forca * 7
    v.gotas.lineStyle(1 + forca * 0.6, GOTA, 0.32 + forca * 0.15)
    for (let k = 0; k < qtd; k++) {
      const g = GOTAS_CAIXA[k]
      const y = l.top + ((g.fy * l.height + t * 0.45 * g.v * (1 + forca * 0.6)) % (l.height + 20)) - 10
      const x = l.left + ((g.fx * l.width + (y - l.top) * 0.18) % l.width)
      v.gotas.lineBetween(x, y, x - comp * 0.18, y - comp)
    }
    // respingos no chão da caixa
    if (sorte() < delta / (60 - forca * 30)) v.respingos.push({ x: l.left + sorte() * l.width, t })
    v.respingos = v.respingos.filter((r) => t - r.t < 260)
    for (const r of v.respingos) {
      const k = (t - r.t) / 260
      const y = r.alto ?? l.bottom - 3
      v.gotas.lineStyle(1, BRILHO, 0.6 * (1 - k))
      v.gotas.lineBetween(r.x, y, r.x - 2 - k * 4, y - 2 - k * 4)
      v.gotas.lineBetween(r.x, y, r.x + 2 + k * 4, y - 2 - k * 4)
    }
    // rastro de água atrás do coração escorregando
    const c = v.pista.coracoes[0]
    const j = visuais.indexOf(v)
    if (c?.ativo && naPoca(j) && Math.hypot(velocidade[j].x, velocidade[j].y) > 30 && sorte() < delta / 40) {
      v.respingos.push({ x: c.x, t, alto: c.y })
    }
    // setas da pancada (aviso)
    v.setas.clear()
    if (estado === 'aviso') {
      const pisca = Math.sin(t / 70) > 0 ? 1 : 0.35
      v.setas.fillStyle(BRILHO, pisca)
      for (const fx of [0.25, 0.5, 0.75]) {
        const x = l.left + fx * l.width
        const y = l.top + 30 + ((t / 4) % 10)
        v.setas.fillRect(x - 2, y - 10, 4, 10)
        v.setas.fillTriangle(x - 7, y, x + 7, y, x, y + 8)
      }
    }
  }

  const desenharTela = () => {
    gotasTela.clear()
    gotasTela.lineStyle(1, GOTA, 0.28 + forca * 0.2)
    const comp = 9 + forca * 8
    for (const g of GOTAS_TELA) {
      const y = (g.y + t * 0.5 * g.v * (1 + forca * 0.6)) % (ALTURA + 30) - 15
      const x = (g.x + y * 0.18) % LARGURA
      gotasTela.lineBetween(x, y, x - comp * 0.18, y - comp)
    }
    veu.setAlpha(0.22 + forca * 0.16)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      estado = 'calma'
      mudaEm = PRIMEIRA - AVISO_MS
      proximaPoca = POCA.primeira
      pocas = []
      chuva = somContinuo(arena, 'chuva')
      tocar(arena, 'trovao')
      veu = arena.add.rectangle(0, 0, LARGURA, ALTURA, 0x18243a).setOrigin(0).setDepth(15).setAlpha(0)
      gotasTela = arena.add.graphics().setDepth(16)
      ignorarNasCaixas(arena, veu, gotasTela)
      visuais = arena.pistas.map((pista, j) => {
        const chao = arena.add.graphics().setDepth(2)
        const gotas = arena.add.graphics().setDepth(3)
        const setas = arena.add.graphics().setDepth(9)
        pista.caixa.recortar(chao, gotas, setas)
        velocidade[j] = { x: 0, y: 0 }
        return { pista, chao, gotas, setas, respingos: [] }
      })
    },

    // na poça: inércia (escorrega); fora dela: firme. A chuva empurra para baixo sempre.
    joy(j, joy) {
      if (!ativo || arena.ko?.[j]) return joy
      const v = velocidade[j]
      if (naPoca(j)) {
        const empurrando = Math.hypot(joy.x, joy.y) > 15
        const k = Math.min(1, ultimoDelta / (empurrando ? ESCORREGA.aceleraMs : ESCORREGA.deslizaMs))
        v.x += (joy.x - v.x) * k
        v.y += (joy.y - v.y) * k
      } else {
        v.x = joy.x
        v.y = joy.y
      }
      const empurra = EMPURRA.leve + (EMPURRA.forte - EMPURRA.leve) * forca
      return { x: v.x, y: Math.max(-100, Math.min(100, v.y + empurra)) }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      ultimoDelta = delta
      if (t >= mudaEm) {
        if (estado === 'calma') {
          estado = 'aviso'
          mudaEm = t + AVISO_MS
          avisarPancada()
        } else if (estado === 'aviso') {
          estado = 'pancada'
          mudaEm = t + entre(PANCADA.min, PANCADA.max)
        } else {
          estado = 'calma'
          mudaEm = t + entre(CALMA.min, CALMA.max)
        }
      }
      // a força sobe rápido na pancada e desce devagar depois
      const alvo = estado === 'pancada' ? 1 : 0
      forca += (alvo - forca) * Math.min(1, delta / (alvo ? 140 : 450))
      if (t >= proximaPoca) {
        proximaPoca = t + entre(POCA.intervalo.min, POCA.intervalo.max)
        if (pocas.length < POCA.max) novaPoca()
      }
      pocas = pocas.filter((p) => t < p.fim)
      for (const v of visuais) desenharCaixa(v, delta)
      desenharTela()
    },

    estadoDebug() {
      return { estado, forca: Number(forca.toFixed(2)), pocas: pocas.map((p) => ({ fx: p.fx, fy: p.fy, molhada: molhada(p) })), naPoca: [0, 1].map(naPoca) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      chuva?.parar(700)
      chuva = null
      veu?.destroy()
      gotasTela?.destroy()
      veu = null
      gotasTela = null
      for (const v of visuais) {
        v.chao.destroy()
        v.gotas.destroy()
        v.setas.destroy()
      }
      visuais = []
      pocas = []
      textos.forEach((x) => {
        arena.tweens.killTweensOf(x)
        if (x.scene) x.destroy()
      })
      textos = []
    },
  }
}
