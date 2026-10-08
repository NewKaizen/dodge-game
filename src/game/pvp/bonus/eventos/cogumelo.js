import { FONTE, corTexto } from '../../../constants.js'
import { tocar, tomMusica } from '../../../audio.js'
import { particulas } from '../../../effects/particulas.js'
import { ESCALA } from '../../../arte/texturas.js'

// COGUMELO MALUCO: os corações alternam entre GIGANTE (hitbox enorme, a
// música fica GRAVE) e MINI (hitbox pequenininha, a música fica AGUDA). Antes
// de cada troca o coração pisca entre os dois tamanhos (o clássico do
// cogumelo) e um cogumelo pula em cima dele. Tudo volta ao normal no fim.

const FASE_MS = 2600 // quanto dura cada tamanho
const PISCA_MS = 520 // o pisca-pisca de aviso antes de trocar
const TAMANHOS = {
  gigante: { fator: 2.3, tom: -6, texto: 'GIGANTE!', som: 'crescer', cor: 0xff5a5a },
  mini: { fator: 0.5, tom: 6, texto: 'MINI!', som: 'encolher', cor: 0x7fd8ff },
}

export default function criar(arena) {
  let ativo = false
  let t = 0
  let atual = null // 'gigante' | 'mini'
  let trocaEm = 0
  let avisos = []

  const coracoes = () => arena.pistas.flatMap((p) => p.coracoes)
  const proximo = () => (atual === 'gigante' ? 'mini' : 'gigante')

  const cogumelo = (pista, cor) => {
    const c = pista.coracoes[0]
    if (!c?.ativo) return
    const g = arena.add.graphics().setDepth(14).setPosition(c.x, c.y - 24).setScale(1.5)
    g.fillStyle(0xfff1d6, 1).fillRect(-4, 0, 8, 8)
    g.fillStyle(cor, 1).fillEllipse(0, 0, 22, 14)
    g.fillStyle(0xffffff, 1).fillCircle(-5, -2, 2.5).fillCircle(5, -1, 2).fillCircle(0, -5, 1.6)
    pista.caixa.recortar(g)
    arena.tweens.add({ targets: g, y: c.y - 48, duration: 520, ease: 'Quad.easeOut' })
    arena.tweens.add({ targets: g, alpha: 0, delay: 320, duration: 200, onComplete: () => g.destroy() })
  }

  const aplicar = (nome) => {
    atual = nome
    const tam = TAMANHOS[nome]
    coracoes().forEach((c) => c.setTamanho(tam.fator))
    tomMusica(tam.tom)
    tocar(arena, tam.som)
    for (const pista of arena.pistas) {
      const c = pista.coracoes[0]
      if (!c?.ativo) continue
      cogumelo(pista, tam.cor)
      particulas(arena, c.x, c.y, { cor: tam.cor, quantidade: 14, velocidade: 140 })
      const l = pista.caixa.limites
      const aviso = arena.add
        .text(l.centerX, l.top + 16, tam.texto, { fontFamily: FONTE, fontSize: '16px', color: corTexto(tam.cor), stroke: '#000000', strokeThickness: 4 })
        .setOrigin(0.5)
        .setDepth(14)
      pista.caixa.recortar(aviso)
      avisos.push(aviso)
      arena.tweens.add({ targets: aviso, scale: { from: 1.6, to: 1 }, duration: 220, ease: 'Back.easeOut' })
      arena.tweens.add({ targets: aviso, alpha: 0, delay: 900, duration: 300, onComplete: () => aviso.destroy() })
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      aplicar('gigante')
      trocaEm = FASE_MS
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      const falta = trocaEm - t
      if (falta <= 0) {
        aplicar(proximo())
        trocaEm = t + FASE_MS
        return
      }
      // aviso: pisca entre o tamanho atual e o próximo
      if (falta < PISCA_MS) {
        const fator = Math.floor(falta / 85) % 2 ? TAMANHOS[atual].fator : TAMANHOS[proximo()].fator
        for (const c of coracoes()) if (c.ativo && !c.invencivel) c.sprite.setScale(ESCALA.coracao * fator)
      }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      coracoes().forEach((c) => c.setTamanho(1))
      tomMusica(0)
      avisos.forEach((a) => a.scene && a.destroy())
      avisos = []
    },
  }
}
