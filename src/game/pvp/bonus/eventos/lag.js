import Phaser from 'phaser'
import { CORACAO, FONTE } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { ESCALA } from '../../../arte/texturas.js'
import { ignorarNasCaixas } from '../../../recorte.js'
import { lerAtrasado } from '../../bonusInformatica.js'

// LAG: a internet da escola caiu para a discada. O coração obedece ATRASADO:
// o direcional de agora só chega daqui a ATRASO ms (o "ping" varia sozinho
// entre ATRASO.min e ATRASO.max). Vale para a CPU também (ela passa por joy()
// e desvia com informação velha, como gente).
// Para dar para jogar, um FANTASMA do coração (contorno apagado) mostra para
// onde ele VAI, simulando os comandos que ainda estão "na rede". Em cima de
// cada caixa: ícone de wi-fi com 1-2 barrinhas e o PING (amarelo; vermelho
// quando passa de PING_RUIM).

const ATRASO = { min: 250, max: 400 } // ms de atraso do direcional
const ONDA_MS = 1700 // período da variação do ping
const PING_RUIM = 340
const AMARELO = '#ffd040'
const VERMELHO = '#ff5050'

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  let ultimoDelta = 16
  let filas = [[], []] // por pista: comandos "na rede" { t, dt, x, y }
  let fases = [0, 0]
  let visuais = [] // por pista: { pista, wifi, ping, fantasma }

  const atraso = (j) => {
    const k = 0.5 + 0.5 * Math.sin((t / ONDA_MS) * Math.PI * 2 + fases[j]) // 0..1
    const tremido = Math.sin(t / 97 + fases[j] * 3) * 12
    return Phaser.Math.Clamp(ATRASO.min + (ATRASO.max - ATRASO.min) * k + tremido, ATRASO.min, ATRASO.max)
  }

  // wi-fi fraquinho: arcos de 3 tamanhos, só `barras` acesas
  const desenharWifi = (g, x, y, barras, cor) => {
    g.clear()
    for (let k = 0; k < 3; k++) {
      const r = 3 + k * 4
      g.lineStyle(2, k < barras ? cor : 0x3a4250, 1)
      g.beginPath()
      g.arc(x, y, r, Phaser.Math.DegToRad(-135), Phaser.Math.DegToRad(-45))
      g.strokePath()
    }
    g.fillStyle(cor, 1).fillRect(x - 1, y - 1, 3, 3)
  }

  // onde o coração vai parar quando os comandos na fila chegarem
  const prever = (pista, fila, desde) => {
    const c = pista.coracoes[0]
    const l = pista.caixa.limites
    const vel = pista.velocidadeCoracao
    const meio = (CORACAO.tamanho * (c.tamanho ?? 1)) / 2
    let x = c.x
    let y = c.y
    for (const p of fila) {
      if (p.t <= desde) continue
      let dx = p.x / 100
      let dy = p.y / 100
      const n = Math.hypot(dx, dy)
      if (n > 1) {
        dx /= n
        dy /= n
      }
      x = Phaser.Math.Clamp(x + dx * vel * (p.dt / 1000), l.left + meio, l.right - meio)
      y = Phaser.Math.Clamp(y + dy * vel * (p.dt / 1000), l.top + meio, l.bottom - meio)
    }
    return { x, y }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      filas = [[], []]
      fases = [sorte() * Math.PI * 2, sorte() * Math.PI * 2]
      tocar(arena, 'lag')
      visuais = arena.pistas.map((pista) => {
        const wifi = arena.add.graphics().setDepth(41)
        const ping = arena.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '11px', color: AMARELO, stroke: '#000000', strokeThickness: 3 }).setOrigin(1, 1).setDepth(41)
        const fantasma = arena.add.image(0, 0, 'coracao').setScale(ESCALA.coracao).setTint(pista.coracoes[0].cor).setAlpha(0).setDepth(9)
        pista.caixa.recortar(fantasma)
        ignorarNasCaixas(arena, wifi, ping) // fora das caixas: só a câmera principal desenha
        return { pista, wifi, ping, fantasma, consumido: -Infinity }
      })
    },

    // o direcional que chega agora é o de ATRASO ms atrás
    joy(j, joy) {
      if (!ativo) return joy
      const fila = filas[j]
      fila.push({ t, dt: ultimoDelta, x: joy?.x ?? 0, y: joy?.y ?? 0 })
      const saida = lerAtrasado(fila, t - atraso(j))
      if (saida && visuais[j]) visuais[j].consumido = saida.t
      return saida ? { x: saida.x, y: saida.y } : { x: 0, y: 0 }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      ultimoDelta = delta
      visuais.forEach((v, j) => {
        const l = v.pista.caixa.limites
        const ms = Math.round(atraso(j))
        const ruim = ms > PING_RUIM
        const cor = ruim ? VERMELHO : AMARELO
        // a barrinha pisca (conexão caindo)
        const barras = ruim ? (Math.floor(t / 220) % 2 ? 1 : 0) : Math.floor(t / 400) % 3 ? 2 : 1
        desenharWifi(v.wifi, l.right - 92, l.top - 5, barras, Phaser.Display.Color.HexStringToColor(cor).color)
        v.ping.setPosition(l.right - 2, l.top - 3).setText(`PING ${ms}ms`).setColor(cor)
        const c = v.pista.coracoes[0]
        if (!c?.ativo || arena.ko?.[arena.donoDaPista?.(j) ?? j]) {
          v.fantasma.setAlpha(0)
          return
        }
        const alvo = prever(v.pista, filas[j], v.consumido)
        const longe = Math.hypot(alvo.x - c.x, alvo.y - c.y)
        // só aparece quando tem caminho "na rede" (parado, some)
        v.fantasma.setPosition(alvo.x, alvo.y).setScale(ESCALA.coracao * (c.tamanho ?? 1))
        v.fantasma.setAlpha(Math.min(0.4, longe / 30) * (0.75 + 0.25 * Math.sin(t / 90)))
      })
    },

    estadoDebug() {
      return { t: Math.round(t), atraso: [0, 1].map((j) => Math.round(atraso(j))), fila: filas.map((f) => f.length) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of visuais) {
        v.wifi.destroy()
        v.ping.destroy()
        v.fantasma.destroy()
      }
      visuais = []
      filas = [[], []]
    },
  }
}
