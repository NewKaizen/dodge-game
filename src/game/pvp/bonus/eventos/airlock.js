import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { rotulo } from './arteArenasNovas.js'
import { planoAirlock, AIRLOCK } from './planosArenas.js'

// AIRLOCK (ESTAÇÃO ESPACIAL): a comporta de um lado das caixas abre para o vácuo. Primeiro o
// AVISO: a parede daquele lado pisca em vermelho, a luz da comporta gira e aparece
// "DESPRESSURIZANDO" com setas apontando para ela. Depois a comporta abre e a descompressão
// PUXA tudo para aquele lado (o coração também: soma ao joystick, como a GRAVIDADE; dá para
// lutar contra o puxão, que começa fraco e vai ficando forte), com riscos de ar e poeira
// voando para fora; por fim a comporta fecha. Não dá dano: o perigo é o puxão no meio do
// ataque. O plano (planosArenas.js) é o mesmo nas duas caixas e nunca repete o lado.

const COR = 0xff4a3a
const VETOR = { esquerda: { x: -1, y: 0 }, direita: { x: 1, y: 0 }, cima: { x: 0, y: -1 }, baixo: { x: 0, y: 1 } }
const RAMPA_MS = 280 // o puxão cresce até a força cheia

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  let plano = []
  let i = 0 // abertura atual (aviso ou puxão); plano.length = acabou
  let fase = 'espera' // espera | aviso | suga
  let desde = 0
  let visuais = [] // por pista: { g, texto }
  let ar = [] // por pista: partículas de ar [{ u, v, vel, comp }]

  const abertura = () => plano[i]
  const lado = () => VETOR[abertura()?.lado]

  const mudar = (nova) => {
    fase = nova
    desde = t
    if (nova === 'aviso') {
      tocar(arena, 'ventoAviso')
      visuais.forEach((v) => v.texto.setVisible(true))
    } else if (nova === 'suga') {
      tocar(arena, 'rajada')
      visuais.forEach((v) => v.texto.setVisible(false))
    } else visuais.forEach((v) => v.texto.setVisible(false))
  }

  // força do puxão (0..1): sobe na rampa e some no último pedacinho
  const forca = () => {
    if (fase !== 'suga') return 0
    const a = abertura()
    const idade = t - desde
    return Math.min(1, idade / RAMPA_MS) * Math.min(1, Math.max(0, (a.sugaMs / aceleracao - idade) / 150))
  }

  const desenhar = (pista, v, j) => {
    const g = v.g
    g.clear()
    const a = abertura()
    if (!a || fase === 'espera') return
    const l = pista.caixa.limites
    const d = VETOR[a.lado]
    const h = d.x !== 0
    // comporta no meio da parede: retângulo de 64 x 12
    const cx = d.x < 0 ? l.left : d.x > 0 ? l.right : l.centerX
    const cy = d.y < 0 ? l.top : d.y > 0 ? l.bottom : l.centerY
    const pisca = Math.sin((t - desde) / (fase === 'aviso' ? 70 : 140)) > 0
    const k = Math.min(1, (t - desde) / (fase === 'aviso' ? AIRLOCK.avisoMs / aceleracao : RAMPA_MS))
    if (fase === 'aviso') {
      // a parede inteira daquele lado pisca e a luz da comporta gira
      g.fillStyle(COR, pisca ? 0.28 : 0.1)
      if (h) g.fillRect(d.x < 0 ? l.left : l.right - 16, l.top, 16, l.height)
      else g.fillRect(l.left, d.y < 0 ? l.top : l.bottom - 16, l.width, 16)
      // setas apontando para a comporta
      g.lineStyle(3, 0xffb0a0, pisca ? 0.9 : 0.4)
      for (let s = 0; s < 3; s++) {
        const rec = 28 + s * 22 - ((t * 0.05) % 22)
        const px = h ? cx - d.x * rec : cx - 18
        const py = h ? cy - 18 : cy - d.y * rec
        if (h) {
          g.lineBetween(px - d.x * 7, py, px, py + 18)
          g.lineBetween(px, py + 18, px - d.x * 7, py + 36)
        } else {
          g.lineBetween(px, py - d.y * 7, px + 18, py)
          g.lineBetween(px + 18, py, px + 36, py - d.y * 7)
        }
      }
    }
    // a porta: fechada (aviso) tem listras; abrindo vira um vão escuro com estrelas
    const aberta = fase === 'suga' ? Math.min(1, k * 1.4) : 0
    const larg = 64
    const [x0, y0, w, alt] = h ? [d.x < 0 ? l.left - 2 : l.right - 10, cy - larg / 2, 12, larg] : [cx - larg / 2, d.y < 0 ? l.top - 2 : l.bottom - 10, larg, 12]
    g.fillStyle(0x2a3040, 0.95).fillRect(x0, y0, w, alt)
    if (aberta > 0) {
      g.fillStyle(0x02030a, 1)
      if (h) g.fillRect(x0, y0 + (larg / 2) * (1 - aberta), w, larg * aberta)
      else g.fillRect(x0 + (larg / 2) * (1 - aberta), y0, larg * aberta, alt)
      g.fillStyle(0xffffff, 0.9)
      for (let s = 0; s < 4; s++) g.fillRect(h ? x0 + 3 : x0 + 8 + s * 14, h ? y0 + 8 + s * 14 : y0 + 3, 1, 1)
    }
    // sirene: farol giratório vermelho em cima da comporta
    const rx = h ? cx + (d.x < 0 ? 16 : -16) : cx
    const ry = h ? cy : cy + (d.y < 0 ? 16 : -16)
    const ang = (t - desde) / 120
    g.fillStyle(COR, 0.22).fillCircle(rx, ry, 18)
    g.fillStyle(0xff7060, 0.6 + 0.4 * Math.sin(ang * 2)).fillCircle(rx, ry, 5)
    g.fillStyle(0xffd0c0, 0.7).fillTriangle(rx, ry, rx + Math.cos(ang) * 26, ry + Math.sin(ang) * 26, rx + Math.cos(ang + 0.35) * 26, ry + Math.sin(ang + 0.35) * 26)

    // riscos de ar voando para a comporta
    if (fase === 'suga') {
      g.lineStyle(1.5, 0xd8ecff, 0.55 * forca())
      for (const p of ar[j]) {
        // u: andamento no eixo do puxão (1 = a comporta); v: posição de lado
        const x = h ? (d.x > 0 ? l.left + p.u * l.width : l.right - p.u * l.width) : l.left + p.v * l.width
        const y = h ? l.top + p.v * l.height : d.y > 0 ? l.top + p.u * l.height : l.bottom - p.u * l.height
        g.lineBetween(x, y, x - d.x * p.comp, y - d.y * p.comp)
      }
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoAirlock(sorte)
      i = 0
      fase = 'espera'
      desde = 0
      visuais = arena.pistas.map((pista) => {
        const g = arena.add.graphics().setDepth(4)
        pista.caixa.recortar(g)
        const texto = rotulo(arena, 0, 0, 'DESPRESSURIZANDO', { cor: '#ffb0a0', tamanho: 10, pista, profundidade: 12 }).setVisible(false)
        return { g, texto }
      })
      ar = arena.pistas.map(() => Array.from({ length: 16 }, () => ({ u: Math.random(), v: Math.random(), vel: 0.9 + Math.random() * 1.1, comp: 8 + Math.random() * 14 })))
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      const a = abertura()
      if (a) {
        if (fase === 'espera' && t >= a.em / aceleracao) mudar('aviso')
        else if (fase === 'aviso' && t - desde >= a.avisoMs / aceleracao) mudar('suga')
        else if (fase === 'suga' && t - desde >= a.sugaMs / aceleracao) {
          mudar('espera')
          i++
        }
      }
      if (fase === 'suga') {
        shake(arena, 60, 0.0012)
        for (const lista of ar) for (const p of lista) p.u = (p.u + (delta / 1000) * p.vel * 1.4) % 1
      }
      arena.pistas.forEach((pista, j) => {
        const v = visuais[j]
        if (!v) return
        const l = pista.caixa.limites
        const d = lado()
        const y = d ? l.centerY - 22 : l.centerY
        v.texto.setPosition(l.centerX, d?.y > 0 ? l.top + 14 : d?.y < 0 ? l.bottom - 14 : y)
        desenhar(pista, v, j)
      })
    },

    joy(j, joy) {
      if (!ativo || fase !== 'suga' || arena.ko?.[j]) return joy
      const d = lado()
      const f = forca() * AIRLOCK.forca
      const c = (n) => Math.max(-100, Math.min(100, n))
      return { x: c(joy.x + d.x * f), y: c(joy.y + d.y * f) }
    },

    estadoDebug() {
      return { fase, lado: abertura()?.lado ?? null, forca: Math.round(forca() * 100) / 100 }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      fase = 'espera'
      for (const v of visuais) {
        v.g.destroy()
        v.texto.destroy()
      }
      visuais = []
    },
  }
}
