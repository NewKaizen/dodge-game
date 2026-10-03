import { ALTURA, CORES, LARGURA } from '../../../constants.js'
import { tocar, somContinuo } from '../../../audio.js'
import { ignorarNasCaixas } from '../../../recorte.js'
import { flashTela } from '../../../effects/flash.js'

// APAGÃO: as luzes caem (pisca-pisca primeiro). Cada caixa fica no escuro,
// menos um círculo de luz suave em volta do coração dela; o resto da tela
// também escurece. Balas telegrafando continuam "piscando" por cima do escuro
// (contorno vermelho), e a cada ~2,5s um relâmpago acende tudo por ~150ms.
// Som: chuva contínua (somContinuo) do começo ao fim e um trovão um pouquinho
// depois de cada relâmpago (a luz chega antes do som, como na vida real).
//
// O escuro de cada caixa é uma imagem preta com um furo suave (textura feita
// uma vez a partir de bonus-holofote, ou de um degradê) que segue o coração,
// mais 4 retângulos pretos em volta dela cobrindo o resto. Tudo recortado na
// caixa (pista.caixa.recortar): a câmera da caixa só mostra o que está dentro,
// então a caixa pode mudar de forma/lugar sem problema.

const ESCURO = 0.94 // alpha do escuro dentro das caixas
const ESCURO_TELA = 0.6 // alpha do véu no resto da tela
const LUZ = 124 // diâmetro (px) do círculo de luz
const PISCA_MS = 700 // pisca-pisca do começo
const RAIO_MIN = 2300 // intervalo entre relâmpagos (sorteado)
const RAIO_MAX = 2800
const MARGEM = 200 // os retângulos passam da tela com folga
const TROVAO_MIN = 150 // atraso (ms) do trovão depois do clarão (sorteado)
const TROVAO_MAX = 400

// Textura 128x128 preta com um furo transparente suave no meio
function texturaLuz(arena) {
  const holofote = arena.textures.exists('bonus-holofote')
  const chave = holofote ? 'bonus-apagao-luz-h' : 'bonus-apagao-luz-g'
  if (arena.textures.exists(chave)) return chave
  const n = 128
  const canvas = document.createElement('canvas')
  canvas.width = n
  canvas.height = n
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, n, n)
  ctx.globalCompositeOperation = 'destination-out'
  if (holofote) {
    ctx.drawImage(arena.textures.get('bonus-holofote').getSourceImage(), 0, 0, n, n)
  } else {
    const grad = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(0.45, 'rgba(0,0,0,1)')
    grad.addColorStop(0.8, 'rgba(0,0,0,0.45)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, n, n)
  }
  arena.textures.addCanvas(chave, canvas)
  return chave
}

// Quanto está escuro (0 = aceso, 1 = apagado) no instante t do pisca-pisca inicial
function piscaInicial(t) {
  if (t < 110) return 0.85
  if (t < 190) return 0
  if (t < 330) return 1
  if (t < 410) return 0.15
  if (t < 470) return 0.9
  if (t < 530) return 0.3
  return Math.min(1, 0.3 + ((t - 530) / (PISCA_MS - 530)) * 0.7)
}

// Escuro durante um relâmpago, `t` ms depois dele (relâmpago duplo e volta)
function relampago(t) {
  if (t < 90) return 0
  if (t < 150) return 0.55
  if (t < 210) return 0
  return Math.min(1, (t - 210) / 260)
}

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  let proximoRaio = 0
  let raioEm = -Infinity
  let trovaoEm = Infinity // quando tocar o trovão do último relâmpago
  let chuva = null // somContinuo('chuva')
  let veu = null
  let escuros = [] // por pista: { pista, luz, bordas[4], avisos }

  const proximoIntervalo = () => RAIO_MIN + sorte() * (RAIO_MAX - RAIO_MIN)

  const posicionar = (e, escuro, tam) => {
    const c = e.pista.coracoes[0]
    // sem coração (caído/escondido): escuro total, o furo vai para longe
    const cx = c?.ativo ? c.x : -10000
    const cy = c?.ativo ? c.y : -10000
    const x0 = Math.round(cx - tam / 2)
    const y0 = Math.round(cy - tam / 2)
    const x1 = x0 + tam
    const y1 = y0 + tam
    const [cima, baixo, esq, dir] = e.bordas
    // retângulos 1x1 esticados com escala; 1px de sobreposição contra frestas com zoom quebrado
    const pos = (r, x, y, w, h) => r.setPosition(x, y).setScale(Math.max(0, w), Math.max(0, h))
    pos(cima, -MARGEM, -MARGEM, LARGURA + MARGEM * 2, y0 + 1 + MARGEM)
    pos(baixo, -MARGEM, y1 - 1, LARGURA + MARGEM * 2, ALTURA + MARGEM - y1 + 1)
    pos(esq, -MARGEM, y0, x0 + 1 + MARGEM, tam)
    pos(dir, x1 - 1, y0, LARGURA + MARGEM - x1 + 1, tam)
    e.luz.setPosition(x0, y0).setDisplaySize(tam, tam)
    e.brilho.setPosition(cx, cy).setDisplaySize(tam * 0.9, tam * 0.9).setAlpha(0.16 * escuro)
    const alpha = ESCURO * escuro
    e.luz.setAlpha(alpha)
    e.bordas.forEach((b) => b.setAlpha(alpha))
  }

  // contornos piscando das balas que ainda estão telegrafando (dá para se preparar no escuro)
  const desenharAvisos = (e, escuro) => {
    const g = e.avisos
    g.clear()
    if (escuro < 0.3) return
    for (const b of e.pista.balas.lista) {
      if (b.morta || b.idade >= b.aviso) continue
      const a = (Math.sin(b.idade / 45) > 0 ? 0.9 : 0.3) * escuro
      g.lineStyle(2, CORES.aviso, a)
      if (b.tipo === 'circulo') g.strokeCircle(b.x, b.y, (b.raio ?? 6) + 2)
      else if (b.tipo === 'retangulo') g.strokeRect(b.x - b.largura / 2, b.y - b.altura / 2, b.largura, b.altura)
      else {
        const cos = Math.cos(b.angulo) * (b.comprimento / 2)
        const sin = Math.sin(b.angulo) * (b.comprimento / 2)
        g.lineBetween(b.x - cos, b.y - sin, b.x + cos, b.y + sin)
      }
      if (b.marcador?.active) {
        g.fillStyle(CORES.aviso, a)
        g.fillTriangle(b.marcador.x, b.marcador.y - 6, b.marcador.x + 5, b.marcador.y + 4, b.marcador.x - 5, b.marcador.y + 4)
      }
    }
  }

  const evento = {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      proximoRaio = PISCA_MS + proximoIntervalo() - 600
      tocar(arena, 'apagao')
      trovaoEm = Infinity
      chuva = somContinuo(arena, 'chuva')
      const chave = texturaLuz(arena)
      // véu da tela (fora das caixas): por baixo dos textos de aviso e do HUD
      veu = arena.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setDepth(15).setAlpha(0)
      ignorarNasCaixas(arena, veu)
      escuros = arena.pistas.map((pista) => {
        // entre as balas (5) e o coração (10): o coração sempre aparece
        const luz = arena.add.image(0, 0, chave).setOrigin(0).setDepth(9.5)
        const bordas = [0, 1, 2, 3].map(() => arena.add.rectangle(0, 0, 1, 1, 0x000000).setOrigin(0).setDepth(9.5))
        const avisos = arena.add.graphics().setDepth(9.6)
        // brilho fraquinho no chão da caixa, para o círculo de luz aparecer mesmo sem balas perto
        const brilho = arena.add.image(0, 0, arena.textures.exists('bonus-holofote') ? 'bonus-holofote' : 'brilho').setTint(0xfff0c0).setDepth(2)
        pista.caixa.recortar(luz, ...bordas, avisos, brilho)
        return { pista, luz, bordas, avisos, brilho }
      })
      evento.atualizar(0)
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      if (t >= proximoRaio) {
        raioEm = t
        proximoRaio = t + proximoIntervalo()
        flashTela(arena, 0xffffff, 0.22, 220)
        trovaoEm = t + TROVAO_MIN + sorte() * (TROVAO_MAX - TROVAO_MIN)
      }
      if (t >= trovaoEm) {
        trovaoEm = Infinity
        tocar(arena, 'trovao')
      }
      let escuro = t < PISCA_MS ? piscaInicial(t) : 1
      escuro = Math.min(escuro, relampago(t - raioEm))
      // a luz "respira" um pouquinho
      const tam = Math.round(LUZ * (1 + Math.sin(t / 260) * 0.035))
      for (const e of escuros) {
        posicionar(e, escuro, tam)
        desenharAvisos(e, escuro)
      }
      veu?.setAlpha(ESCURO_TELA * escuro)
    },

    terminar() {
      if (!ativo) return
      ativo = false
      chuva?.parar(600)
      chuva = null
      trovaoEm = Infinity
      veu?.destroy()
      veu = null
      for (const e of escuros) {
        e.luz.destroy()
        e.bordas.forEach((b) => b.destroy())
        e.avisos.destroy()
        e.brilho.destroy()
      }
      escuros = []
    },
  }
  return evento
}
