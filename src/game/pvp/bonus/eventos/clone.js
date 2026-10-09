import { FONTE } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { ESCALA } from '../../../arte/texturas.js'
import { particulas } from '../../../effects/particulas.js'
import { MODOS_CLONE, espelhar } from '../../bonusInformatica.js'

// CTRL+C CTRL+V: alguém copiou e colou o coração. Em cada caixa aparece um
// CLONE ESPELHADO do coração (selecionado com o tracejado "formiguinha" de
// sempre): ele anda junto, mas refletido no eixo do meio da caixa (o eixo
// aparece tracejado). Bala que pegar no clone conta como acerto no DONO (o
// dano normal da bala, com os i-frames de sempre); graze no clone também vale.
// De tempos em tempos o espelho muda (lados -> cima/baixo -> centro): antes,
// o lugar novo pisca por AVISO_MS ("CTRL+V") e, depois de colado, o clone fica
// CARENCIA_MS sem machucar (piscando) para ninguém tomar dano de surpresa.
// A colisão do clone usa o caminho normal das balas (Balas.colidir +
// Pista.acertou). A CPU não sabe do clone: desvia só com o coração dela.

const COLA_MS = 700 // o clone nasce depois do aviso inicial
const TROCA_MS = { min: 5000, max: 7000 } // de quanto em quanto tempo o espelho muda
const AVISO_MS = 700 // o lugar novo pisca antes de colar
const CARENCIA_MS = 380 // colado agora: ainda não machuca
const COR_SELECAO = 0xffffff
const ROTULO = { lados: 'ESPELHO: LADOS', cimaBaixo: 'ESPELHO: CIMA/BAIXO', centro: 'ESPELHO: CENTRO' }

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  let ativo = false
  let t = 0
  let clones = [] // por pista
  let acertos = 0
  let textos = []

  const dono = (j) => arena.donoDaPista?.(j) ?? j

  const etiqueta = (pista, x0, y0, conteudo, cor = '#7affc8') => {
    const l = pista.caixa.limites
    const x = Math.min(Math.max(x0, l.left + 60), l.right - 60)
    const y = Math.max(y0, l.top + 10)
    const txt = arena.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: '11px', color: cor, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(14)
    pista.caixa.recortar(txt)
    textos.push(txt)
    arena.tweens.add({ targets: txt, y: y - 8, alpha: 0, delay: 500, duration: 300, onComplete: () => txt.destroy() })
    return txt
  }

  const criarClone = (pista, j) => {
    const real = pista.coracoes[0]
    const sprite = arena.add.image(0, 0, 'coracao').setScale(ESCALA.coracao).setTint(real.cor).setDepth(10).setAlpha(0)
    const selecao = arena.add.graphics().setDepth(9)
    const eixo = arena.add.graphics().setDepth(2)
    pista.caixa.recortar(sprite, selecao, eixo)
    const modo = MODOS_CLONE[Math.floor(sorte() * MODOS_CLONE.length)]
    // o "coração" que as balas enxergam (Balas.tocar usa ativo, x, y, hitbox, graze)
    const alvo = { ativo: false, x: 0, y: 0, hitbox: real.hitbox, graze: real.graze }
    return { pista, j, sprite, selecao, eixo, alvo, modo, novo: null, colaEm: COLA_MS, carenciaAte: COLA_MS + CARENCIA_MS, trocaEm: COLA_MS + entre(TROCA_MS.min, TROCA_MS.max), avisado: false, colado: false }
  }

  // retângulo tracejado andando (seleção de "copiar")
  const formiguinhas = (g, x, y, lado, alpha) => {
    const passo = 3
    const fase = Math.floor(t / 60) % (passo * 2)
    g.fillStyle(COR_SELECAO, alpha)
    const borda = []
    for (let k = 0; k < lado; k++) borda.push([x + k, y], [x + lado, y + k], [x + lado - k, y + lado], [x, y + lado - k])
    borda.forEach(([px, py], i) => {
      if ((Math.floor(i / 4) + fase) % (passo * 2) < passo) g.fillRect(px, py, 1, 1)
    })
  }

  const desenharEixo = (cl, l, alpha) => {
    const g = cl.eixo
    g.clear()
    if (alpha <= 0) return
    g.fillStyle(0x7affc8, alpha)
    if (cl.modo === 'lados' || cl.modo === 'centro') for (let y = l.top + 2; y < l.bottom; y += 8) g.fillRect(l.centerX - 0.5, y, 1, 4)
    if (cl.modo === 'cimaBaixo' || cl.modo === 'centro') for (let x = l.left + 2; x < l.right; x += 8) g.fillRect(x, l.centerY - 0.5, 4, 1)
  }

  const acertouClone = (cl) => (_alvo, bala) => {
    const real = cl.pista.coracoes[0]
    if (real.invencivel || t < cl.carenciaAte) return false
    if (!cl.pista.acertou(real, bala)) return false
    acertos++
    particulas(arena, cl.alvo.x, cl.alvo.y, { cor: real.cor, quantidade: 10, velocidade: 110 })
    etiqueta(cl.pista, cl.alvo.x, cl.alvo.y - 16, 'NO CLONE!', '#ff8a8a')
    cl.sprite.setScale(ESCALA.coracao * (real.tamanho ?? 1) * 1.9)
    arena.tweens.add({ targets: cl.sprite, scale: ESCALA.coracao * (real.tamanho ?? 1), duration: 180, ease: 'Back.easeOut' })
    return true
  }

  const grazeouClone = (cl) => (_alvo, bala) => {
    const real = cl.pista.coracoes[0]
    if (real.invencivel || t < cl.carenciaAte) return
    cl.pista.grazeou(real, bala)
  }

  const atualizarClone = (cl) => {
    const { pista } = cl
    const real = pista.coracoes[0]
    const l = pista.caixa.limites
    const vivo = real?.ativo && !arena.ko?.[dono(cl.j)] && pista.rodando
    // troca do espelho: avisa no lugar novo, depois cola
    if (t >= cl.trocaEm - AVISO_MS && !cl.novo) {
      const opcoes = MODOS_CLONE.filter((m) => m !== cl.modo)
      cl.novo = opcoes[Math.floor(sorte() * opcoes.length)]
    }
    if (t >= cl.trocaEm && cl.novo) {
      cl.modo = cl.novo
      cl.novo = null
      cl.carenciaAte = t + CARENCIA_MS
      cl.trocaEm = t + entre(TROCA_MS.min, TROCA_MS.max)
      if (vivo) {
        tocar(arena, 'clonar')
        const p = espelhar(cl.modo, l, real.x, real.y)
        etiqueta(pista, p.x, p.y - 18, ROTULO[cl.modo])
      }
    }
    if (!cl.colado && t >= cl.colaEm) {
      cl.colado = true
      if (vivo) {
        tocar(arena, 'clonar')
        const p = espelhar(cl.modo, l, real.x, real.y)
        etiqueta(pista, p.x, p.y - 18, 'CTRL+V')
      }
    }
    cl.selecao.clear()
    if (!vivo) {
      cl.alvo.ativo = false
      cl.sprite.setAlpha(0)
      desenharEixo(cl, l, 0)
      return
    }
    const tam = real.tamanho ?? 1
    const lado = Math.round(22 * tam)
    // aviso do lugar novo (antes de colar)
    const previa = cl.novo ?? (!cl.colado ? cl.modo : null)
    if (previa) {
      const p = espelhar(previa, l, real.x, real.y)
      if (Math.floor(t / 90) % 2) formiguinhas(cl.selecao, Math.round(p.x - lado / 2), Math.round(p.y - lado / 2), lado, 0.9)
    }
    if (!cl.colado) {
      cl.alvo.ativo = false
      cl.sprite.setAlpha(0)
      desenharEixo(cl, l, 0.12)
      return
    }
    const p = espelhar(cl.modo, l, real.x, real.y)
    cl.alvo.x = p.x
    cl.alvo.y = p.y
    cl.alvo.hitbox = real.hitbox
    cl.alvo.graze = real.graze
    cl.alvo.ativo = true
    const carencia = t < cl.carenciaAte
    // o clone pisca junto com o coração (i-frames) e na carência
    const piscando = carencia && Math.floor(t / 70) % 2
    cl.sprite.setPosition(p.x, p.y).setAlpha((piscando ? 0.25 : 0.85) * real.sprite.alpha)
    if (!arena.tweens.isTweening(cl.sprite)) cl.sprite.setScale(ESCALA.coracao * tam)
    formiguinhas(cl.selecao, Math.round(p.x - lado / 2), Math.round(p.y - lado / 2), lado, 0.75)
    desenharEixo(cl, l, 0.22)
    // as balas da pista no clone (o caminho normal: i-frames, graze, dano do dono)
    if (pista.atacando && !carencia) pista.balas.colidir([cl.alvo], acertouClone(cl), grazeouClone(cl))
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      clones = arena.pistas.map((pista, j) => criarClone(pista, j))
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      for (const cl of clones) atualizarClone(cl)
    },

    estadoDebug() {
      return { t: Math.round(t), acertos, clones: clones.map((cl) => ({ modo: cl.modo, ativo: cl.alvo.ativo, x: Math.round(cl.alvo.x), y: Math.round(cl.alvo.y) })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const cl of clones) {
        cl.alvo.ativo = false
        arena.tweens.killTweensOf(cl.sprite)
        cl.sprite.destroy()
        cl.selecao.destroy()
        cl.eixo.destroy()
      }
      clones = []
      textos.forEach((x) => x.scene && x.destroy())
      textos = []
    },
  }
}
