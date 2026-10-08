import { FONTE, LARGURA } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { ignorarNasCaixas } from '../../../recorte.js'
import { RES } from '../../../resolucao.js'

// PC DA ESCOLA: as caixas rodam a poucos quadros por segundo (6 a 14 FPS,
// muda o tempo todo) e de vez em quando o PC TRAVA de vez por um instante
// ("Não está respondendo"). O jogo continua no mesmo tempo: a pista só anda
// aos trancos (passo devolve o tempo acumulado de uma vez), então balas e
// coração pulam de um quadro para o outro. Pista.atualizar já divide passos
// grandes em pedaços pequenos: nenhuma bala atravessa o coração.
// Visual: as caixas ficam em BAIXA RESOLUÇÃO (filtro Blocky do Phaser 4 na
// câmera de recorte de cada caixa: blocos de PIXEL px do jogo), linhas de
// monitor velho, contador de FPS amarelo (em cima da caixa, fora do filtro,
// para dar para ler) e a janelinha de erro na travada.
// O filtro sai no terminar().

const FPS = { min: 6, max: 14 }
const TROCA_FPS_MS = 1300 // de quanto em quanto tempo o FPS muda
const TRAVADA = { aCada: { min: 3200, max: 4800 }, dura: { min: 260, max: 420 } }
const AMARELO = '#ffe040'
const PIXEL = 2.5 // lado do "pixel" da tela de baixa resolução, em px do jogo (4 era pixelado demais)

// O canvas desenha na resolução real da tela (resolucao.js): o bloco do
// filtro é em pixels de verdade, então escala junto
const tamanhoBloco = () => Math.max(2, Math.round(PIXEL * RES.escala))

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  let ativo = false
  let t = 0
  let fps = 10
  let trocaEm = 0
  let travadaEm = 0
  let travadaAte = -1
  const acumulado = [0, 0]
  let visuais = [] // por pista: { pista, linhas, contador, filtro }
  let janela = null

  const travada = () => t < travadaAte

  const mostrarJanela = () => {
    janela?.destroy()
    const c = arena.add.container(LARGURA / 2, 54).setDepth(95)
    const g = arena.add.graphics()
    g.fillStyle(0x000000, 0.35).fillRect(-128, -26, 260, 60)
    g.fillStyle(0xd4d0c8, 1).fillRect(-130, -28, 260, 58)
    g.fillStyle(0x0a246a, 1).fillRect(-127, -25, 254, 14)
    g.lineStyle(1, 0xffffff, 1).strokeRect(-130, -28, 260, 58)
    g.fillStyle(0xc0c0c0, 1).fillRect(110, -23, 14, 10)
    const titulo = arena.add.text(-122, -24, 'dodge-game.exe', { fontFamily: FONTE, fontSize: '9px', color: '#ffffff' })
    const x = arena.add.text(113, -25, 'x', { fontFamily: FONTE, fontSize: '9px', color: '#000000' })
    const msg = arena.add.text(0, 10, '(Não está respondendo)', { fontFamily: FONTE, fontSize: '11px', color: '#000000' }).setOrigin(0.5)
    c.add([g, titulo, x, msg])
    ignorarNasCaixas(arena, c)
    janela = c
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      fps = Math.round(entre(FPS.min, FPS.max))
      trocaEm = TROCA_FPS_MS
      travadaEm = entre(TRAVADA.aCada.min, TRAVADA.aCada.max)
      tocar(arena, 'pcLigando')
      visuais = arena.pistas.map((pista) => {
        // linhas de monitor de tubo: listras escuras finas na caixa toda
        // (uma listra a cada 2 "pixels" grandes, para casar com o filtro)
        const linhas = arena.add.graphics().setDepth(12)
        linhas.fillStyle(0x000000, 0.16)
        for (let y = 0; y < 480; y += PIXEL * 2) linhas.fillRect(0, y, LARGURA, PIXEL)
        const contador = arena.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '11px', color: AMARELO, stroke: '#000000', strokeThickness: 3 }).setOrigin(0, 1).setDepth(41)
        pista.caixa.recortar(linhas)
        ignorarNasCaixas(arena, contador)
        // baixa resolução: cada bloco vira a cor do pixel do meio dele
        const filtro = pista.caixa.camera.filters?.internal.addBlocky({ size: tamanhoBloco() }) ?? null
        return { pista, linhas, contador, filtro }
      })
    },

    // a pista só anda quando "fecha um quadro"; na travada, nada anda
    passo(j, delta) {
      if (!ativo) return delta
      acumulado[j] += delta
      if (travada() || acumulado[j] < 1000 / fps) return 0
      const passo = acumulado[j]
      acumulado[j] = 0
      return passo
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      if (t >= trocaEm) {
        fps = Math.round(entre(FPS.min, FPS.max))
        trocaEm = t + TROCA_FPS_MS
      }
      if (t >= travadaEm) {
        travadaAte = t + entre(TRAVADA.dura.min, TRAVADA.dura.max)
        travadaEm = travadaAte + entre(TRAVADA.aCada.min, TRAVADA.aCada.max)
        tocar(arena, 'travou')
        mostrarJanela()
      }
      if (janela && !travada()) {
        janela.destroy()
        janela = null
      }
      const bloco = tamanhoBloco() // a janela pode mudar de tamanho no meio
      for (const v of visuais) {
        if (v.filtro) v.filtro.size.x = v.filtro.size.y = bloco
        const l = v.pista.caixa.limites
        // as listras andam com a caixa, alinhadas aos blocos do filtro
        v.linhas.setPosition(0, l.top % (PIXEL * 2))
        v.contador.setPosition(l.left + 2, l.top - 4).setText(travada() ? 'FPS: 0' : `FPS: ${fps}`)
        v.contador.setColor(travada() || fps < 9 ? '#ff5050' : AMARELO)
      }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of visuais) {
        v.linhas.destroy()
        v.contador.destroy()
        if (v.filtro && !v.pista.destruida) v.pista.caixa.camera.filters.internal.remove(v.filtro)
      }
      visuais = []
      janela?.destroy()
      janela = null
    },
  }
}
