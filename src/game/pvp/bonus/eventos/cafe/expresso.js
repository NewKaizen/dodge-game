import { tocar } from '../../../../audio.js'
import { particulas } from '../../../../effects/particulas.js'
import { fatores } from '../../../../acessibilidade.js'
import { contextoDoCafe, rngFilho } from './util.js'
import { texturasDoMenu } from './arte.js'
import { EXPRESSO, novaCafeina, beber, nivelDeCafeina, fatorDeVelocidade, tremendo, planejarXicara, entre } from './planos.js'

// EXPRESSO: xícaras de expresso aparecem pela caixa (com vapor). Cada uma que o coração BEBE
// (encostando) deixa ele mais rápido por ~5,4 s, e os efeitos se SOMAM (+17% por xícara, até
// 4). Com 4 xícaras fazendo efeito ao mesmo tempo vem a TREMEDEIRA: por ~3,4 s o direcional
// treme (o coração balança sozinho) e o coração chacoalha na tela. A régua embaixo da caixa
// mostra quantas xícaras estão fazendo efeito. Nunca machuca: o risco é perder o controle.
// A CPU vai atrás das xícaras quando não há bala por perto, e para em 3.
// Em rede cada PC só mexe na velocidade do SEU coração (a caixa espelho só mostra).
// terminar() devolve a velocidade do coração e apaga as xícaras e a régua.

const CALDO = 0xffb060

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const ctx = contextoDoCafe(arena)
  let ativo = false
  let t = 0
  // por pista: { pista, sorte, g, regua, rotulo, est, xicaras, proximo, base, ruido, ruidoEm, ultimo }
  let lados = []

  const nascer = (s, j) => {
    const l = s.pista.caixa.limites
    const c = s.pista.coracoes[0]
    const evitar = [...s.xicaras.map((x) => ({ x: x.x, y: x.y })), ...(c?.ativo ? [{ x: c.x, y: c.y }] : [])]
    const p = planejarXicara(s.sorte, l, evitar)
    const img = ctx.naCaixa(s.pista, arena.add.image(p.x, p.y, 'cafe-xicara').setDepth(8).setScale(0.1))
    arena.tweens.add({ targets: img, scale: 1.45, duration: 240, ease: 'Back.easeOut' })
    s.xicaras.push({ x: p.x, y: p.y, t0: t, img, vapor: 0 })
    tocar(arena, 'tique')
  }

  const sumir = (s, x) => {
    arena.tweens.killTweensOf(x.img)
    x.img.destroy()
    s.xicaras = s.xicaras.filter((o) => o !== x)
  }

  const vapor = (s, x) => {
    const p = ctx.naCaixa(s.pista, arena.add.circle(x.x + (Math.random() - 0.5) * 5, x.y - 8, 2, 0xffffff, 0.5).setDepth(8.5))
    arena.tweens.add({ targets: p, y: p.y - 16, x: p.x + (Math.random() - 0.5) * 8, scale: 2, alpha: 0, duration: 700, onComplete: () => p.destroy() })
  }

  const tomar = (s, j, x, c) => {
    const { nivel, passouDoLimite } = beber(s.est, t)
    sumir(s, x)
    particulas(arena, x.x, x.y, { cor: CALDO, quantidade: 8, velocidade: 100, vida: 450 })
    tocar(arena, 'energia')
    const txt = ctx.texto(c.x, c.y - 18, passouDoLimite ? 'TREMEDEIRA!' : `+VELOCIDADE ×${nivel}`, { cor: passouDoLimite ? '#ff9a80' : '#ffd890', tamanho: 11 })
    arena.tweens.add({ targets: txt, y: txt.y - 18, alpha: 0, delay: 350, duration: 500, onComplete: () => txt.destroy() })
    if (passouDoLimite) tocar(arena, 'zumbidoBravo')
  }

  const desenharRegua = (s, nivel, treme) => {
    const l = s.pista.caixa.limites
    const g = s.regua
    const x0 = l.centerX - 4 * 14
    const y = l.bottom + 8
    g.clear()
    g.fillStyle(0x000000, 0.7).fillRoundedRect(x0 - 6, y - 3, 8 * 14 + 12, 15, 4)
    for (let i = 0; i < EXPRESSO.tremeNivel; i++) {
      const x = x0 + i * 28 + 14
      const cheia = i < nivel
      const perigo = i === EXPRESSO.tremeNivel - 1
      g.fillStyle(cheia ? (perigo ? 0xff5a3a : CALDO) : 0x3a2a24, 1).fillRoundedRect(x - 9, y, 18, 9, 3)
      g.lineStyle(1, 0xffffff, cheia ? 0.8 : 0.25).strokeRoundedRect(x - 9, y, 18, 9, 3)
    }
    const pisca = treme && Math.sin(t / 60) > 0
    s.rotulo
      .setPosition(l.centerX, y + 23)
      .setText(treme ? 'TREMEDEIRA!' : nivel ? `CAFEÍNA ×${(fatorDeVelocidade(nivel)).toFixed(2)}` : 'EXPRESSO')
      .setColor(treme ? (pisca ? '#ffffff' : '#ff7a60') : '#ffd890')
  }

  const desenharAura = (s, c, nivel, treme) => {
    const g = s.g
    g.clear()
    if (!c || !nivel) return
    // aura laranja e listras de velocidade atrás do coração
    g.fillStyle(CALDO, 0.1 + 0.04 * nivel).fillCircle(c.x, c.y, 11 + nivel * 1.5)
    g.lineStyle(1.5, treme ? 0xff4a3a : CALDO, 0.7).strokeCircle(c.x, c.y, 11 + nivel * 1.5)
    if (s.ultimo) {
      const dx = c.x - s.ultimo.x
      const dy = c.y - s.ultimo.y
      const d = Math.hypot(dx, dy)
      if (d > 0.3) {
        g.lineStyle(2, 0xffe0b0, 0.55)
        for (const o of [-5, 0, 5]) g.lineBetween(c.x - (dx / d) * 8 - (dy / d) * o, c.y - (dy / d) * 8 + (dx / d) * o, c.x - (dx / d) * (12 + nivel * 4) - (dy / d) * o, c.y - (dy / d) * (12 + nivel * 4) + (dx / d) * o)
      }
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      texturasDoMenu(arena)
      lados = arena.pistas.map((pista) => {
        const filho = rngFilho(sorte)
        return {
          pista,
          sorte: filho,
          g: ctx.naCaixa(pista, arena.add.graphics().setDepth(9)),
          regua: ctx.naTela(arena.add.graphics().setDepth(70)),
          rotulo: ctx.texto(0, 0, 'EXPRESSO', { cor: '#ffd890', tamanho: 9, profundidade: 70 }),
          est: novaCafeina(),
          xicaras: [],
          proximo: entre(filho, EXPRESSO.primeira.min, EXPRESSO.primeira.max),
          base: pista.fatorCoracao,
          ruido: { x: 0, y: 0 },
          ruidoEm: 0,
          ultimo: null,
        }
      })
      ctx.instrucao('BEBA CAFÉ: VAI MAIS RÁPIDO!', { cor: '#ffd890' })
    },

    // tremedeira: o direcional balança sozinho. CPU: vai atrás da xícara mais perto
    joy(j, joy) {
      if (!ativo) return joy
      const s = lados[j]
      const c = ctx.coracao(j)
      if (!s || !c || !ctx.ehMeu(j)) return joy
      let { x, y } = joy
      if (ctx.dono(j) === arena.cpu && nivelDeCafeina(s.est, t) < 3 && s.xicaras.length) {
        const perto = s.pista.balas.lista.some((b) => !b.morta && !b.inofensiva && Math.hypot(b.x - c.x, b.y - c.y) < 56)
        if (!perto) {
          const alvo = s.xicaras.reduce((m, o) => (Math.hypot(o.x - c.x, o.y - c.y) < Math.hypot(m.x - c.x, m.y - c.y) ? o : m))
          const d = Math.hypot(alvo.x - c.x, alvo.y - c.y) || 1
          x = (alvo.x - c.x) / d * 85
          y = (alvo.y - c.y) / d * 85
        }
      }
      if (tremendo(s.est, t)) {
        if (t - s.ruidoEm > 70) {
          s.ruidoEm = t
          const amp = EXPRESSO.tremorJoy * (0.5 + 0.5 * fatores().tremor)
          s.ruido = { x: (Math.random() * 2 - 1) * amp, y: (Math.random() * 2 - 1) * amp }
        }
        x += s.ruido.x
        y += s.ruido.y
      }
      return { x, y }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((s, j) => {
        const c = ctx.coracao(j)
        const viva = ctx.pistaViva(j)
        if (viva) {
          s.proximo -= delta
          if (s.proximo <= 0) {
            s.proximo = entre(s.sorte, EXPRESSO.intervaloMs.min, EXPRESSO.intervaloMs.max) / aceleracao
            if (s.xicaras.length < EXPRESSO.maxNaCaixa) nascer(s, j)
          }
        }
        // vida das xícaras (piscam no fim) e vapor
        for (const x of [...s.xicaras]) {
          const idade = t - x.t0
          if (idade > EXPRESSO.vidaMs || !viva) {
            sumir(s, x)
            continue
          }
          x.img.setAlpha(idade > EXPRESSO.vidaMs - 1300 && Math.sin(t / 60) > 0 ? 0.35 : 1).setY(x.y + Math.sin(t / 260 + x.x) * 1.2)
          if (t - x.vapor > 320) {
            x.vapor = t
            vapor(s, x)
          }
          if (c && viva && Math.hypot(x.x - c.x, x.y - c.y) <= EXPRESSO.raio + 7) tomar(s, j, x, c)
        }
        const nivel = nivelDeCafeina(s.est, t)
        const treme = tremendo(s.est, t)
        if (ctx.ehMeu(j)) s.pista.fatorCoracao = s.base * fatorDeVelocidade(nivel)
        // o coração chacoalha na tela (só o desenho); respeita "reduzir animações"
        if (c && treme && ctx.ehMeu(j)) {
          const px = EXPRESSO.tremorPx * fatores().tremor
          c.sprite.x += (Math.random() * 2 - 1) * px
          c.sprite.y += (Math.random() * 2 - 1) * px
        }
        desenharAura(s, c, nivel, treme)
        s.ultimo = c ? { x: c.x, y: c.y } : null
        desenharRegua(s, nivel, treme)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), nivel: lados.map((s) => nivelDeCafeina(s.est, t)), treme: lados.map((s) => tremendo(s.est, t)), xicaras: lados.map((s) => s.xicaras.length), fator: lados.map((s) => s.pista.fatorCoracao) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const s of lados) s.pista.fatorCoracao = s.base
      lados = []
      ctx.limpar()
    },
  }
}
