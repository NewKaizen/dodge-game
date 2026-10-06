import { tocar } from '../../../audio.js'

// GRAVIDADE MALUCA: uma "gravidade" puxa os corações para um lado (4 direções
// ou diagonais) e muda a cada ~2s. Antes de mudar, uma seta grande pisca em
// cada caixa apontando para a direção nova (~600ms de aviso). O puxão entra no
// joystick (joy + g * FORCA): dá para lutar contra ele. A CPU também é puxada
// (o bot não sabe da gravidade, e tudo bem).

const FORCA = 55 // quanto a gravidade soma no joystick (-100..100)
const PERIODO = 2000 // ms entre as trocas
const AVISO = 600 // ms de aviso antes de cada troca
const COR = 0x3cff6a
const DIRECOES = Array.from({ length: 8 }, (_, k) => ({ x: Math.round(Math.cos((k * Math.PI) / 4) * 1000) / 1000, y: Math.round(Math.sin((k * Math.PI) / 4) * 1000) / 1000 }))

// Seta na cor `cor` apontando para a DIREITA, centrada, com `tamanho` px de comprimento
function criarSeta(arena, tamanho, cor) {
  const img = arena.add.image(0, 0, 'bonus-seta').setTint(cor)
  img.setScale(tamanho / Math.max(1, img.width))
  return img
}

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  let g = null // gravidade atual { x, y } (null antes da primeira)
  let proxima = null // direção anunciada
  let trocaEm = AVISO // t da próxima troca
  let anunciada = false
  let visuais = [] // por pista: { aviso, marca }

  const sortear = () => {
    const opcoes = DIRECOES.filter((d) => d !== g && d !== proxima)
    return opcoes[Math.floor(sorte() * opcoes.length)] ?? DIRECOES[0]
  }

  const anunciar = () => {
    proxima = sortear()
    anunciada = true
    tocar(arena, 'gravidade')
    for (const v of visuais) v.aviso.setRotation(Math.atan2(proxima.y, proxima.x)).setVisible(true)
  }

  const trocar = () => {
    g = proxima
    proxima = null
    anunciada = false
    for (const v of visuais) {
      v.aviso.setVisible(false)
      v.marca.setRotation(Math.atan2(g.y, g.x)).setVisible(true)
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      visuais = arena.pistas.map((pista) => {
        // aviso: seta grande piscando (por baixo das balas, que importam mais); marca: a gravidade atual, apagadinha no fundo
        const aviso = criarSeta(arena, 120, COR).setDepth(4).setVisible(false)
        const marca = criarSeta(arena, 150, COR).setDepth(2).setAlpha(0.16).setVisible(false)
        pista.caixa.recortar(aviso, marca)
        return { pista, aviso, marca }
      })
      t = 0
      trocaEm = AVISO
      anunciar()
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      if (!anunciada && t >= trocaEm - AVISO) anunciar()
      if (anunciada && t >= trocaEm) {
        trocar()
        trocaEm += PERIODO
      }
      const piscar = Math.sin(t / 55) > 0
      for (const v of visuais) {
        const l = v.pista.caixa.limites
        v.marca.setPosition(l.centerX, l.centerY)
        if (!v.aviso.visible) continue
        // a seta "anda" um pouco na direção nova e pisca
        const k = Math.max(0, Math.min(1, 1 - (trocaEm - t) / AVISO))
        const d = proxima ?? { x: 0, y: 0 }
        v.aviso.setPosition(l.centerX + d.x * 18 * k, l.centerY + d.y * 18 * k).setAlpha(piscar ? 0.85 : 0.35)
      }
    },

    joy(j, joy) {
      if (!ativo || !g || arena.ko?.[j]) return joy
      const c = (v) => Math.max(-100, Math.min(100, v))
      return { x: c(joy.x + g.x * FORCA), y: c(joy.y + g.y * FORCA) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      g = null
      for (const v of visuais) {
        v.aviso.destroy()
        v.marca.destroy()
      }
      visuais = []
    },
  }
}
