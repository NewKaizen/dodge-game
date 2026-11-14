import { LARGURA, CORACAO, FONTE } from '../../../../constants.js'
import { tocar } from '../../../../audio.js'
import { shake } from '../../../../effects/shake.js'
import { folgaDaBala } from '../../../../entities/fisica.js'
import { ignorarNasCaixas } from '../../../../recorte.js'
import { semLigaduras } from '../../../../campanha/texto.js'
import {
  planoBiscoito, BISCOITO, REGRA_BISCOITO, joyDiagonal, joyEspelho, joyGiro, ehDourada, ESCUDO_DOURADO_MS, PARADO_MS, PARADO_LIMIAR, portal,
} from './planos.js'
import { CORES, dono, escudar, criarVivos, texto, bolha, calmo, limitar } from './comum.js'

// BISCOITO DA SORTE: um biscoito da sorte cai no meio da tela, racha e solta um papelzinho com
// uma REGRA MALUCA que vale para a rodada inteira (sorteada pela semente: igual nos dois PCs).
// Depois que o papel abre, o texto da regra fica em cima de cada caixa. As regras (planos.js):
//   SÓ ANDA NA DIAGONAL    o direcional vira diagonal (andar reto vira zigue-zague)
//   BALA DOURADA DÁ ESCUDO 1 em cada 6 balas é dourada, inofensiva: pegar dá escudo (i-frames)
//   PARADO NÃO LEVA DANO   com o direcional solto o coração fica protegido
//   SETAS ESPELHADAS       esquerda <-> direita (a CPU não é afetada)
//   VELOCIDADE DOBRADA     o coração anda o dobro (pista.fatorCoracao, devolvido no fim)
//   SETAS GIRADAS          um quarto de volta (a CPU não é afetada)
//   AS PAREDES SÃO PORTAIS empurrar a parede leva ao lado oposto (se estiver livre)
// terminar() devolve velocidade, cores e tudo mais.

const CENTRO = { x: LARGURA / 2, y: 214 }
const OURO = 0xffd23a

// pontos de metade de uma elipse (lado = -1 esquerda, 1 direita)
function meia(lado, a, b) {
  const pts = [{ x: 0, y: -b }]
  for (let k = 1; k < 8; k++) {
    const ang = -Math.PI / 2 + (k / 8) * Math.PI
    pts.push({ x: lado * Math.cos(ang) * a, y: Math.sin(ang) * b })
  }
  pts.push({ x: 0, y: b })
  return pts
}

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  const vivos = criarVivos()
  let ativo = false
  let t = 0
  let plano = null
  let regra = null // em vigor
  let gc = null // cookie e papel (tela)
  let papel = null // texto do papel
  let tags = [] // textos fixos em cima de cada caixa
  let gs = [] // efeitos dentro de cada caixa
  let fatores = [] // fatorCoracao antes do evento
  let joys = [{ x: 0, y: 0 }, { x: 0, y: 0 }] // último joystick (depois das regras) de cada caixa
  let parado = [0, 0] // ms com o direcional solto
  let escudoAte = [0, 0]
  let dourada = new WeakMap()
  let contadas = [0, 0]
  let pops = []

  // ---------- cookie e papel ----------

  const desenharBiscoito = (idade) => {
    const g = gc
    g.clear()
    const { x, y } = CENTRO
    const cai = limitar(idade / 420, 0, 1)
    const queda = (1 - cai) * -130 + (cai >= 1 ? 0 : 0)
    const quique = idade > 420 && idade < 620 ? -Math.sin(((idade - 420) / 200) * Math.PI) * 8 : 0
    const inicio = BISCOITO.primeiroMs
    const racha = limitar((idade - inicio) / BISCOITO.rachaMs, 0, 1) // 0..1 balançando até rachar
    const abre = limitar((idade - inicio - BISCOITO.rachaMs) / 420, 0, 1) // metades se afastando
    const sai = limitar((idade - inicio - BISCOITO.rachaMs - 140) / 560, 0, 1) // papel saindo
    const some = limitar((idade - inicio - BISCOITO.rachaMs - BISCOITO.papelMs) / 500, 0, 1)
    const alpha = 1 - some
    if (alpha <= 0) return false
    const balanco = racha > 0 && racha < 1 ? Math.sin(idade / 38) * 3.2 * racha * (calmo() ? 0.3 : 1) : 0
    const cx = x + balanco
    const cy = y + queda + quique
    const a = 28
    const b = 19

    // bandeja escura (o fundo da arena é cheio de detalhes): cresce quando o papel sai
    const larguraBandeja = 96 + 120 * sai
    g.fillStyle(0x12060c, 0.72 * alpha).fillRoundedRect(x - larguraBandeja / 2, cy - 42, larguraBandeja, 84, 16)
    g.lineStyle(2, CORES.ouro, 0.8 * alpha).strokeRoundedRect(x - larguraBandeja / 2, cy - 42, larguraBandeja, 84, 16)
    // sombra no chão
    g.fillStyle(0x000000, 0.25 * alpha).fillEllipse(x, y + 26, a * 2.1, 10)

    // o papelzinho (por trás das metades)
    if (sai > 0) {
      const larg = 176 * sai
      g.fillStyle(0x000000, 0.28 * alpha).fillRoundedRect(cx - larg / 2 + 2, cy - 17 + 3, larg, 36, 3)
      g.fillStyle(CORES.creme, alpha).fillRoundedRect(cx - larg / 2, cy - 17, larg, 36, 3)
      g.lineStyle(2, CORES.vermelho, alpha).strokeRoundedRect(cx - larg / 2, cy - 17, larg, 36, 3)
      g.fillStyle(CORES.vermelho, alpha).fillRect(cx - larg / 2 + 4, cy - 14, Math.max(0, larg - 8), 2).fillRect(cx - larg / 2 + 4, cy + 16, Math.max(0, larg - 8), 2)
    }

    const separa = abre * 40
    const gira = abre * 0.35
    const metade = (lado) => {
      const pts = meia(lado, a, b).map((p) => {
        const c = Math.cos(gira * lado)
        const s = Math.sin(gira * lado)
        return { x: cx + lado * separa + p.x * c - p.y * s, y: cy + abre * 4 + p.x * s + p.y * c }
      })
      g.fillStyle(0xe0a63e, alpha).fillPoints(pts, true)
      g.lineStyle(2, 0x9a5a14, alpha).strokePoints(pts, true)
      // brilho e dobra
      const q = pts.slice(2, 5)
      g.lineStyle(2, 0xf6d98a, 0.8 * alpha).strokePoints(q, false)
    }
    metade(-1)
    metade(1)
    // dobra do biscoito (antes de abrir) e rachaduras
    if (abre < 1) {
      g.lineStyle(2, 0xa86a1c, alpha * (1 - abre)).beginPath().moveTo(cx - 3, cy - b + 2).lineTo(cx + 3, cy).lineTo(cx - 2, cy + b - 2).strokePath()
      if (racha > 0.45) {
        const k = (racha - 0.45) / 0.55
        g.lineStyle(2, 0x5a2e08, alpha).beginPath().moveTo(cx, cy - b).lineTo(cx - 5 * k, cy - b * 0.4).lineTo(cx + 4 * k, cy).lineTo(cx - 6 * k, cy + b * 0.5).lineTo(cx, cy + b).strokePath()
      }
    }
    return { papelX: cx, papelY: cy, sai, alpha }
  }

  // ---------- regras ----------

  const aplicar = (r) => {
    regra = r
    if (r.id === 'turbo') arena.pistas.forEach((p) => (p.fatorCoracao *= 2))
    tocar(arena, 'estouro')
    shake(arena, 160, 0.003)
  }

  const humano = (j) => dono(arena, j) !== arena.cpu

  const joyDaRegra = (j, joy) => {
    if (!regra) return joy
    switch (regra.id) {
      case 'diagonal':
        return joyDiagonal(joy, t)
      case 'espelho':
        return humano(j) ? joyEspelho(joy) : joy
      case 'giro':
        return humano(j) ? joyGiro(joy) : joy
      default:
        return joy
    }
  }

  const gerirDouradas = (j, pista, c) => {
    for (const b of pista.balas.lista) {
      if (b.morta) continue
      if (!dourada.has(b)) {
        const ouro = ehDourada(contadas[j]++, 0)
        dourada.set(b, ouro)
        if (ouro) {
          b.inofensiva = true
          b.sprite.setTint(OURO)
          b.sprite.setScale(b.sprite.scaleX * 1.25, b.sprite.scaleY * 1.25)
          b.escalaX = b.sprite.scaleX
          b.escalaY = b.sprite.scaleY
        }
      }
      if (!dourada.get(b) || !c?.ativo || b.idade < b.aviso) continue
      b.inofensiva = true
      if (folgaDaBala(b, c.x, c.y) <= c.hitbox + 5) {
        b.morta = true
        escudar(c, ESCUDO_DOURADO_MS)
        escudoAte[j] = t + ESCUDO_DOURADO_MS
        pops.push({ j, x: b.x, y: b.y, t0: t })
        tocar(arena, 'escudo')
      }
    }
  }

  const livreParaPortal = (pista) => (x, y) => !pista.balas.lista.some((b) => !b.morta && !b.inofensiva && b.idade >= b.aviso && folgaDaBala(b, x, y) < CORACAO.hitbox + 12)

  // ---------- desenho por caixa ----------

  const desenharCaixa = (j, g) => {
    g.clear()
    const pista = arena.pistas[j]
    const l = pista.caixa.limites
    const c = pista.coracoes[0]
    if (!regra) return
    if (regra.id === 'portais') {
      // bordas que redemoinham: dourado e jade
      const pulso = calmo() ? 0.7 : 0.55 + 0.35 * Math.sin(t / 220)
      for (const [x1, y1, x2, y2] of [[l.left, l.top, l.right, l.top], [l.left, l.bottom, l.right, l.bottom], [l.left, l.top, l.left, l.bottom], [l.right, l.top, l.right, l.bottom]]) {
        g.lineStyle(9, 0x7a40ff, 0.3 * pulso).lineBetween(x1, y1, x2, y2)
        g.lineStyle(3, 0xd8b8ff, 0.95 * pulso).lineBetween(x1, y1, x2, y2)
      }
      // redemoinho nos cantos
      for (const [x, y] of [[l.left, l.top], [l.right, l.top], [l.left, l.bottom], [l.right, l.bottom]]) {
        g.lineStyle(2, 0xffffff, 0.8 * pulso).strokeCircle(x, y, 5 + (calmo() ? 0 : 2 * Math.sin(t / 150)))
      }
    }
    if (regra.id === 'dourado') {
      for (const b of pista.balas.lista) {
        if (b.morta || !dourada.get(b)) continue
        const bril = calmo() ? 0.6 : 0.55 + 0.4 * Math.sin(t / 90 + b.x)
        g.fillStyle(OURO, 0.22 * bril).fillCircle(b.x, b.y, (b.raio ?? 8) + 7)
        g.lineStyle(1.5, 0xffffff, 0.8 * bril).strokeCircle(b.x, b.y, (b.raio ?? 8) + 4)
      }
    }
    if (c?.ativo) {
      const escudo = t < escudoAte[j]
      const quieto = regra.id === 'parado' && parado[j] >= PARADO_MS
      if (escudo) bolha(g, c.x, c.y, 15, OURO, t, Math.min(1, (escudoAte[j] - t) / 400))
      else if (quieto) bolha(g, c.x, c.y, 14, 0x9ad8ff, t, 0.9)
    }
    for (const p of pops) {
      if (p.j !== j) continue
      const k = (t - p.t0) / 420
      if (k > 1) continue
      g.lineStyle(2, OURO, 1 - k).strokeCircle(p.x, p.y, 8 + 22 * k)
    }
  }

  const colocarTags = () => {
    arena.pistas.forEach((p, j) => {
      const l = p.caixa.limites
      tags[j]?.setPosition(l.centerX, l.top - 12)
    })
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoBiscoito(sorte)
      fatores = arena.pistas.map((p) => p.fatorCoracao)
      gc = vivos.guardar(arena.add.graphics().setDepth(94))
      ignorarNasCaixas(arena, gc)
      gs = arena.pistas.map((pista) => {
        const g = vivos.guardar(arena.add.graphics().setDepth(9))
        pista.caixa.recortar(g)
        return g
      })
      papel = vivos.guardar(arena.add.text(CENTRO.x, CENTRO.y, '', { fontFamily: FONTE, fontSize: '10px', color: '#7a1010', align: 'center', wordWrap: { width: 160 }, lineSpacing: 2 }).setOrigin(0.5).setDepth(95).setAlpha(0))
      ignorarNasCaixas(arena, papel)
      tocar(arena, 'cartaDeslizar')
    },

    joy(j, joy) {
      if (!ativo || !regra) return joy
      const saida = joyDaRegra(j, joy)
      joys[j] = saida
      if (regra.id === 'parado') {
        const solto = Math.hypot(joy.x, joy.y) < PARADO_LIMIAR
        parado[j] = solto ? parado[j] + 16 : 0
        if (parado[j] >= PARADO_MS) escudar(arena.pistas[j].coracoes[0], 60)
      }
      return saida
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      const r = desenharBiscoito(t)
      const rachou = t >= plano.em + BISCOITO.rachaMs
      if (r && r.sai > 0 && papel) {
        const final = REGRA_BISCOITO[plano.regra]
        if (!papel.text) {
          papel.setText(semLigaduras(final.texto))
          tocar(arena, 'estalo')
          tocar(arena, 'cartaRevelar')
        }
        papel.setPosition(r.papelX, r.papelY + 1).setAlpha(r.alpha * limitar((r.sai - 0.5) * 2, 0, 1))
      } else if (papel && !r) papel.setAlpha(0)
      if (rachou && !regra) {
        const final = REGRA_BISCOITO[plano.regra]
        aplicar(final)
        tags = arena.pistas.map((p) => {
          const l = p.caixa.limites
          const tx = vivos.guardar(texto(arena, l.centerX, l.top - 12, `${final.texto}`, { cor: '#ffe9a0', tamanho: 10, contorno: 4, profundidade: 96 }))
          tx.setAlpha(0)
          arena.tweens.add({ targets: tx, alpha: 1, scale: { from: 1.7, to: 1 }, duration: 260, ease: 'Back.easeOut' })
          return tx
        })
      }
      if (regra) {
        colocarTags()
        arena.pistas.forEach((pista, j) => {
          const c = pista.coracoes[0]
          gerirDouradas(j, pista, c)
          if (regra.id === 'portais' && c?.ativo) {
            const l = pista.caixa.limites
            const meio = (CORACAO.tamanho * (c.tamanho ?? 1)) / 2
            const p = portal(c, l, meio, joys[j], livreParaPortal(pista))
            if (p.saltou) {
              pops.push({ j, x: c.x, y: c.y, t0: t })
              c.x = p.x
              c.y = p.y
              c.posicionar()
              pops.push({ j, x: c.x, y: c.y, t0: t })
              tocar(arena, 'trocar')
            }
          }
        })
        pops = pops.filter((p) => t - p.t0 < 460)
      }
      gs.forEach((g, j) => desenharCaixa(j, g))
    },

    estadoDebug() {
      return { t: Math.round(t), regra: regra?.id ?? null, sorteada: plano?.regra ?? null, escudoAte: escudoAte.map((x) => Math.round(x)), parado: [...parado], fatores: arena.pistas.map((p) => p.fatorCoracao) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      arena.pistas.forEach((p, j) => (p.fatorCoracao = fatores[j] ?? 1))
      vivos.limpar(arena)
      regra = null
      tags = []
      gs = []
      pops = []
      dourada = new WeakMap()
    },
  }
}
