import { FONTE } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { flash } from '../../../effects/flash.js'
import { shake } from '../../../effects/shake.js'

// TELA AZUL: o PC da caixa dá pau. De vez em quando (cada caixa no seu
// tempo) a tela chuvisca um instante, aí vem a TELA AZUL: a pista inteira
// CONGELA (passo = 0: coração, caixa, ataque e balas param, ninguém toma dano
// porque nada anda), com a mensagem de erro e a porcentagem subindo. Depois
// "reinicia": tela preta com o logo, a tela azul some aos poucos mostrando
// tudo ainda parado (dá para ver onde estão as balas antes de voltar) e o
// ataque continua de onde parou.
// Justo: congelado ninguém leva dano; e quando volta o coração ganha
// INVENCIVEL_MS de i-frames (piscando), para não voltar já em cima de uma bala.
// A CPU congela junto (passo vale para a pista toda).

const PRIMEIRA_MS = { min: 1800, max: 2600 } // a primeira pane (a outra caixa vem depois)
const DEFASAGEM_MS = { min: 1500, max: 2300 } // a segunda caixa trava depois da primeira
const ENTRE_MS = { min: 4600, max: 6400 } // entre uma pane e outra na mesma caixa
const CHUVISCO_MS = 280 // a tela falha antes (ainda rodando: é o aviso)
const AZUL_MS = { min: 1000, max: 1300 }
const REINICIA_MS = 420 // tela preta com o logo
const REVELA_MS = 300 // a tela azul some aos poucos (tudo ainda parado)
const INVENCIVEL_MS = 480
const AZUL = 0x1a5fd0

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  let ativo = false
  let t = 0
  let panes = 0
  let caixas = [] // por pista: { pista, j, fase, ate, proxima, tela, chuvisco }

  const dono = (j) => arena.donoDaPista?.(j) ?? j
  const congelada = (cx) => cx.fase === 'azul' || cx.fase === 'reinicia' || cx.fase === 'revela'

  // a tela azul inteira (container recortado na caixa, por cima de tudo nela)
  const montarTela = (pista) => {
    const l = pista.caixa.limites
    const w = l.width
    const h = l.height
    const c = arena.add.container(l.left, l.top).setDepth(15)
    const azul = arena.add.graphics()
    azul.fillStyle(AZUL, 1).fillRect(0, 0, w, h)
    // "QR code" de mentirinha
    const qr = Math.min(28, h * 0.2)
    const qx = 12
    const qy = h - qr - 10
    azul.fillStyle(0xffffff, 1).fillRect(qx, qy, qr, qr)
    azul.fillStyle(AZUL, 1)
    const n = 7
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) if ((i * 7 + k * 13 + i * k) % 3 === 0) azul.fillRect(qx + 2 + (i * (qr - 4)) / n, qy + 2 + (k * (qr - 4)) / n, (qr - 4) / n, (qr - 4) / n)
    const grande = Math.round(Math.min(34, h * 0.22))
    const triste = arena.add.text(12, 8, ':(', { fontFamily: FONTE, fontSize: `${grande}px`, color: '#ffffff' })
    const msg = arena.add.text(12, 12 + grande, 'Seu PC encontrou um problema e precisa ser reiniciado.', { fontFamily: FONTE, fontSize: '10px', color: '#ffffff', wordWrap: { width: w - 24 }, lineSpacing: 2 })
    const pct = arena.add.text(12, msg.y + msg.height + 6, '0% concluído', { fontFamily: FONTE, fontSize: '10px', color: '#ffffff' })
    const codigo = arena.add.text(qx + qr + 6, qy + 2, 'Código de parada:\nDODGE_EXCEPTION', { fontFamily: FONTE, fontSize: '8px', color: '#cfe0ff', lineSpacing: 2 })
    // tela preta do reinício: logo de 4 quadradinhos + "Reiniciando"
    const preta = arena.add.container(0, 0).setVisible(false)
    const fundo = arena.add.graphics()
    fundo.fillStyle(0x000000, 1).fillRect(0, 0, w, h)
    const cores = [0xf25022, 0x7fba00, 0x00a4ef, 0xffb900]
    cores.forEach((cor, i) => fundo.fillStyle(cor, 1).fillRect(w / 2 - 11 + (i % 2) * 12, h / 2 - 26 + Math.floor(i / 2) * 12, 10, 10))
    const reiniciando = arena.add.text(w / 2, h / 2 + 12, 'Reiniciando', { fontFamily: FONTE, fontSize: '10px', color: '#ffffff' }).setOrigin(0.5)
    preta.add([fundo, reiniciando])
    c.add([azul, triste, msg, pct, codigo, preta])
    c.setAlpha(0)
    pista.caixa.recortar(c)
    return { c, pct, preta, reiniciando }
  }

  // chuvisco: faixas horizontais claras e escuras piscando (o aviso)
  const desenharChuvisco = (cx) => {
    const g = cx.chuvisco
    g.clear()
    if (cx.fase !== 'chuvisco') return
    const l = cx.pista.caixa.limites
    for (let k = 0; k < 7; k++) {
      const y = l.top + sorte() * l.height
      const alt = 2 + sorte() * 6
      g.fillStyle(sorte() < 0.5 ? 0xffffff : AZUL, 0.25 + sorte() * 0.35)
      g.fillRect(l.left + sorte() * l.width * 0.3, y, l.width * (0.4 + sorte() * 0.6), alt)
    }
  }

  const travar = (cx) => {
    cx.fase = 'azul'
    cx.ate = t + entre(AZUL_MS.min, AZUL_MS.max)
    cx.inicioAzul = t
    panes++
    cx.tela?.c.destroy()
    cx.tela = montarTela(cx.pista)
    cx.tela.c.setAlpha(1)
    tocar(arena, 'telaAzul')
    shake(arena, 120, 0.004)
  }

  const voltar = (cx) => {
    cx.fase = 'normal'
    cx.proxima = t + entre(ENTRE_MS.min, ENTRE_MS.max)
    cx.tela?.c.destroy()
    cx.tela = null
    // i-frames na volta (piscando), para não voltar já dentro de uma bala
    const c = cx.pista.coracoes[0]
    if (c?.ativo && !arena.ko?.[dono(cx.j)]) {
      c.invencivelMs = Math.max(c.invencivelMs, INVENCIVEL_MS)
      flash(arena, c.sprite, INVENCIVEL_MS)
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      const primeira = entre(PRIMEIRA_MS.min, PRIMEIRA_MS.max)
      const quem = sorte() < 0.5 ? 0 : 1
      caixas = arena.pistas.map((pista, j) => {
        const chuvisco = arena.add.graphics().setDepth(14)
        pista.caixa.recortar(chuvisco)
        return { pista, j, fase: 'normal', ate: 0, proxima: primeira + (j === quem ? 0 : entre(DEFASAGEM_MS.min, DEFASAGEM_MS.max)), tela: null, chuvisco }
      })
    },

    // travada (azul, reiniciando ou revelando): a pista inteira não anda
    passo(j, delta) {
      if (!ativo) return delta
      const cx = caixas[j]
      return cx && congelada(cx) ? 0 : delta
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      for (const cx of caixas) {
        const { pista } = cx
        const pode = pista.atacando && !arena.ko?.[dono(cx.j)]
        if (cx.fase === 'normal' && t >= cx.proxima) {
          if (pode) {
            cx.fase = 'chuvisco'
            cx.ate = t + CHUVISCO_MS
            tocar(arena, 'travou')
          } else cx.proxima = t + 500
        } else if (cx.fase === 'chuvisco' && t >= cx.ate) travar(cx)
        else if (cx.fase === 'azul') {
          const k = Math.min(1, (t - cx.inicioAzul) / (cx.ate - cx.inicioAzul))
          cx.tela.pct.setText(`${Math.min(100, Math.floor(k * 100))}% concluído`)
          if (t >= cx.ate) {
            cx.fase = 'reinicia'
            cx.ate = t + REINICIA_MS
            cx.tela.preta.setVisible(true)
            tocar(arena, 'reiniciar')
          }
        } else if (cx.fase === 'reinicia') {
          cx.tela.reiniciando.setText(`Reiniciando${'.'.repeat(1 + (Math.floor(t / 120) % 3))}`)
          if (t >= cx.ate) {
            cx.fase = 'revela'
            cx.ate = t + REVELA_MS
            cx.tela.preta.setVisible(false)
          }
        } else if (cx.fase === 'revela') {
          // o azul some aos poucos: dá para ver as balas paradas antes de voltar
          cx.tela.c.setAlpha(Math.max(0, (cx.ate - t) / REVELA_MS) * 0.85)
          if (t >= cx.ate) voltar(cx)
        }
        // o ataque acabou no meio da pane: destrava
        if (congelada(cx) && !pista.rodando) voltar(cx)
        desenharChuvisco(cx)
      }
    },

    estadoDebug() {
      return { t: Math.round(t), panes, caixas: caixas.map((cx) => ({ fase: cx.fase, proxima: Math.round(cx.proxima) })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const cx of caixas) {
        cx.tela?.c.destroy()
        cx.chuvisco.destroy()
      }
      caixas = []
    },
  }
}
