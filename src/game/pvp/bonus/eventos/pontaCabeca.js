import { LARGURA, ALTURA, FONTE, corTexto } from '../../../constants.js'
import { RES, ajustarCamera } from '../../../resolucao.js'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { ignorarNasCaixas } from '../../../recorte.js'

// MUNDO DE PONTA-CABEÇA: a tela inteira dá um giro dramático e fica de
// cabeça para baixo (180°) durante a esquiva; no fim gira de volta. Os
// controles NÃO mudam: empurrar para a direita leva o coração para a esquerda
// NA TELA (esse é o caos).
//
// Girar só a câmera principal não basta: cada caixa tem a sua câmera de
// recorte (BattleBox.camera, viewport do tamanho da caixa). transformarTela()
// gira/escala as DUAS coisas em volta do centro da tela: a principal e, para
// cada caixa, a viewport vai para onde a caixa aparece girada (o retângulo
// que a envolve) e o scroll é escolhido para o conteúdo bater com a principal.
// A BattleBox refaz a câmera dela (ajustarCamera) quando muda de forma, então
// a transformação é reaplicada todo frame no 'postupdate' (depois de tudo).
//
// transformarTela/restaurarTela também são usadas pelo MODO FESTA (pulso de zoom).

const GIRO_MS = 950 // giro de entrada
const VOLTA_MS = 750 // giro de volta (terminar)
const ZOOM_GIRO = 0.78 // a tela "afasta" no meio do giro

const C = { x: LARGURA / 2, y: ALTURA / 2 }

// Desenha a tela girada `angulo` (rad) e com zoom `zoom` em volta do centro.
// Ponto p do mundo aparece em C + zoom·R(angulo)·(p − C) (unidades do jogo).
//   câmera (origem 0,0): tela = V + zoom·R·(p − scroll)  (V = canto da viewport)
//   => scroll = C + R⁻¹·(V − C) / zoom
export function transformarTela(arena, angulo = 0, zoom = 1) {
  const main = arena.cameras?.main
  if (!main) return
  const e = RES.escala
  const cos = Math.cos(angulo)
  const sin = Math.sin(angulo)
  const scrollDe = (vx, vy) => {
    const dx = vx - C.x
    const dy = vy - C.y
    return [C.x + (cos * dx + sin * dy) / zoom, C.y + (-sin * dx + cos * dy) / zoom]
  }
  const naTela = (px, py) => {
    const dx = px - C.x
    const dy = py - C.y
    return [C.x + zoom * (cos * dx - sin * dy), C.y + zoom * (sin * dx + cos * dy)]
  }

  main.setOrigin(0, 0).setZoom(e * zoom).setRotation(angulo)
  main.setViewport(0, 0, Math.round(LARGURA * e), Math.round(ALTURA * e))
  main.setScroll(...scrollDe(0, 0))

  for (const caixa of arena.caixasDeRecorte ?? []) {
    const l = caixa.limites
    const cantos = [naTela(l.left, l.top), naTela(l.right, l.top), naTela(l.left, l.bottom), naTela(l.right, l.bottom)]
    const x0 = Math.max(0, Math.min(...cantos.map((p) => p[0])))
    const x1 = Math.min(LARGURA, Math.max(...cantos.map((p) => p[0])))
    const y0 = Math.max(0, Math.min(...cantos.map((p) => p[1])))
    const y1 = Math.min(ALTURA, Math.max(...cantos.map((p) => p[1])))
    const vx = Math.round(x0 * e)
    const vy = Math.round(y0 * e)
    const cam = caixa.camera
    cam.setOrigin(0, 0).setZoom(e * zoom).setRotation(angulo)
    cam.setViewport(vx, vy, Math.max(1, Math.round(x1 * e) - vx), Math.max(1, Math.round(y1 * e) - vy))
    cam.setScroll(...scrollDe(vx / e, vy / e))
  }
}

// Câmeras de volta ao normal (o que ajustarCamera/BattleBox.reaplicar fazem)
export function restaurarTela(arena) {
  const main = arena.cameras?.main
  if (!main) return
  ajustarCamera(main).setScroll(0, 0).setRotation(0)
  for (const caixa of arena.caixasDeRecorte ?? []) {
    caixa.reaplicar()
    caixa.camera.setRotation(0)
  }
}

const suave = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2) // Cubic.easeInOut

export default function criar(arena) {
  let fase = 'parado' // 'girando' | 'virado' | 'voltando' | 'parado'
  let t = 0
  let angulo = 0
  let zoom = 1
  let ligado = false
  let rotulos = []
  let relogio = 0

  const aplicar = () => transformarTela(arena, angulo, zoom)

  const desligar = () => {
    if (ligado) {
      arena.events.off('postupdate', aoPosUpdate)
      arena.events.off('shutdown', encerrar)
    }
    ligado = false
  }

  const limparRotulos = () => {
    for (const o of rotulos) {
      arena.tweens?.killTweensOf(o)
      o.destroy()
    }
    rotulos = []
  }

  // fim de verdade: câmeras no lugar, nada sobrando
  const encerrar = () => {
    desligar()
    limparRotulos()
    fase = 'parado'
    angulo = 0
    zoom = 1
    restaurarTela(arena)
  }

  // Animação no relógio do jogo (delta real do loop), depois de tudo do frame
  function aoPosUpdate(_, delta) {
    t += delta
    relogio += delta
    if (fase === 'girando') {
      const k = Math.min(1, t / GIRO_MS)
      angulo = Math.PI * suave(k)
      zoom = 1 - (1 - ZOOM_GIRO) * Math.sin(Math.PI * k)
      if (k >= 1) {
        fase = 'virado'
        angulo = Math.PI
        zoom = 1
        shake(arena, 160, 0.008)
      }
    } else if (fase === 'voltando') {
      const k = Math.min(1, t / VOLTA_MS)
      angulo = Math.PI + Math.PI * suave(k)
      zoom = 1 - (1 - ZOOM_GIRO) * 0.6 * Math.sin(Math.PI * k)
      if (k >= 1) {
        encerrar()
        return
      }
    }
    // rótulos "CIMA" balançando (só enfeite)
    rotulos.forEach((o, i) => o.setRotation(Math.sin(relogio / 260 + i) * 0.12))
    aplicar()
  }

  // Placas engraçadas: escritas "de pé" no mundo, então aparecem de cabeça
  // para baixo na tela (a seta de "CIMA" aponta para o chão)
  const placa = (x, y, cor, tamanho) => {
    const texto = arena.add
      .text(0, tamanho * 0.55, 'CIMA', { fontFamily: FONTE, fontSize: `${tamanho}px`, color: corTexto(cor), stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5)
    const seta = arena.add.graphics()
    const m = tamanho * 0.6
    seta.fillStyle(0x000000, 1).fillTriangle(-m - 3, -m * 0.2 + 2, m + 3, -m * 0.2 + 2, 0, -m * 1.6 - 3)
    seta.fillStyle(cor, 1).fillTriangle(-m, -m * 0.2, m, -m * 0.2, 0, -m * 1.6)
    return arena.add.container(x, y, [seta, texto])
  }

  const criarRotulos = () => {
    const placas = [placa(LARGURA / 2, 372, 0x7fd8ff, 14), placa(24, ALTURA / 2, 0xffe040, 10), placa(LARGURA - 24, ALTURA / 2, 0xffe040, 10)]
    for (const p of placas) {
      p.setDepth(95).setAlpha(0)
      ignorarNasCaixas(arena, p)
      arena.tweens.add({ targets: p, alpha: 1, duration: 300, delay: GIRO_MS * 0.7 })
    }
    rotulos = placas
  }

  return {
    comecar() {
      if (fase !== 'parado') return
      fase = 'girando'
      t = 0
      tocar(arena, 'virarMundo')
      criarRotulos()
      arena.events.on('postupdate', aoPosUpdate)
      // os eventos da cena sobrevivem ao restart: nada pode ficar pendurado
      arena.events.once('shutdown', encerrar)
      ligado = true
    },

    atualizar() {
      // a transformação é aplicada no postupdate (depois das caixas se atualizarem)
    },

    terminar() {
      if (fase === 'parado') return
      const viva = arena.sys?.isActive?.() && !arena.saindo && arena.cameras?.main
      // 2ª chamada no meio da volta, cena saindo ou esquiva curtíssima
      // (ainda no giro de entrada): volta na hora
      if (!viva || fase !== 'virado') {
        encerrar()
        return
      }
      fase = 'voltando'
      t = 0
      tocar(arena, 'virarMundo')
      rotulos.forEach((o) => arena.tweens.add({ targets: o, alpha: 0, duration: 200 }))
    },
  }
}
