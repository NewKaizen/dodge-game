import { FONTE } from '../../../constants.js'
import { tocar } from '../../../audio.js'

// KARAOKÊ: a letra da música atravessa as caixas como legenda de karaokê, da
// direita para a esquerda (na ordem de leitura). Cada PALAVRA é uma bala
// retangular do tamanho dela (um pouco menor que o desenho, para ser justo),
// com o "!" de sempre na borda por onde ela entra. Entre uma palavra e outra
// há um vão (VAO) por onde o coração passa; os versos correm em faixas
// diferentes (FAIXAS), com espaço livre entre elas.
// Quando uma palavra cruza o meio da caixa ela vai ACENDENDO da esquerda para
// a direita (rosa por cima do branco, como no karaokê) e "canta" uma nota da
// melodia. Fundo da caixa azulado de tela de karaokê, com a linha do cursor.

const FONTE_PX = 16
const VELOCIDADE = 70 // px/s
const VAO = 44 // px entre palavras (o coração tem 16)
const FAIXAS = [0.2, 0.5, 0.8] // altura dos versos, em fração da caixa
const INTERVALO = { min: 2300, max: 3000 } // ms entre versos em cada caixa
const DANO = 3
const CURSOR = 0.5 // onde a palavra acende (fração da largura da caixa)
const LETRAS = [
  'O SHOW NÃO PODE PARAR',
  'DESVIA DESVIA DESVIA',
  'MÃOS PRO ALTO',
  'LÁ LÁ LÁ LÁ',
  'UOU UOU UOU',
  'CORAÇÃO NA CAIXA',
  'TODO MUNDO CANTA',
  'SEGURA ESSA NOTA',
  'MAIS UMA VEZ',
  'PULA PULA PULA',
  'ESSA É PRA VOCÊ',
  'BIS BIS BIS',
]
const MELODIA = [523, 587, 659, 784, 880, 784, 659, 587, 659, 523]
const ESTILO_BASE = { fontFamily: FONTE, fontSize: `${FONTE_PX}px`, color: '#ffffff', stroke: '#1c1c78', strokeThickness: 4 }
const ESTILO_LUZ = { fontFamily: FONTE, fontSize: `${FONTE_PX}px`, color: '#ff5ab0', stroke: '#3a0024', strokeThickness: 4 }

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + (b - a) * sorte()
  let ativo = false
  let t = 0
  let nota = 0
  let ultimaNota = -Infinity
  let visuais = [] // por pista: { j, pista, tela, proximo, faixa, fila: [{ quando, base, luz, w, y }] }
  const textos = new Set() // todos os textos criados (para o terminar)
  const velocidade = VELOCIDADE * aceleracao

  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !arena.ko?.[j] ? p : null
  }

  const texto = (pista, conteudo, estilo) => {
    const txt = arena.add.text(-999, -999, conteudo, estilo).setOrigin(0.5).setDepth(6).setVisible(false)
    pista.caixa.recortar(txt)
    textos.add(txt)
    txt.once('destroy', () => textos.delete(txt))
    return txt
  }

  // a palavra segue a bala e acende ao cruzar o cursor
  const seguir = (b) => {
    const p = b.palavra
    p.base.setPosition(b.x, b.y)
    p.luz.setPosition(b.x, b.y)
    const l = p.pista.caixa.limites
    const cursor = l.left + l.width * CURSOR
    const fracao = Math.max(0, Math.min(1, (cursor - (b.x - p.w / 2)) / p.w))
    p.luz.setCrop(0, 0, Math.ceil(fracao * p.luz.frame.width), p.luz.frame.height)
    if (fracao > 0 && !p.cantou) {
      p.cantou = true
      if (t - ultimaNota > 110) {
        ultimaNota = t
        tocar(arena, 'karaoke', { freq: MELODIA[nota++ % MELODIA.length] })
      }
      arena.tweens.add({ targets: [p.base, p.luz], scale: { from: 1.25, to: 1 }, duration: 200, ease: 'Back.easeOut' })
    }
  }

  const soltarPalavra = (v, item) => {
    const pista = pistaViva(v.j)
    if (!pista) {
      item.base.destroy()
      item.luz.destroy()
      return
    }
    const l = pista.caixa.limites
    const b = pista.balas.criar({
      x: l.right + item.w / 2 + 4,
      y: item.y,
      largura: item.w * 0.92,
      altura: FONTE_PX * 0.72,
      vx: -velocidade,
      dano: DANO,
      cor: 0xffffff,
      atualizar: seguir,
      origem: 'bonus-karaoke',
    })
    b.sprite.setVisible(false)
    b.palavra = { ...item, pista, cantou: false }
    item.base.setVisible(true).setPosition(b.x, b.y)
    item.luz.setVisible(true).setPosition(b.x, b.y).setCrop(0, 0, 0, item.luz.frame.height)
    // a bala sumiu (saiu da caixa, fim do ataque): a palavra some junto
    b.sprite.once('destroy', () => {
      item.base.destroy()
      item.luz.destroy()
    })
  }

  const cantarVerso = (v, j) => {
    const pista = pistaViva(j)
    if (!pista) return
    const l = pista.caixa.limites
    const opcoes = FAIXAS.map((_, k) => k).filter((k) => k !== v.faixa)
    v.faixa = opcoes[Math.floor(sorte() * opcoes.length)]
    const y = Math.round(l.top + l.height * FAIXAS[v.faixa])
    const verso = LETRAS[Math.floor(sorte() * LETRAS.length)]
    let atraso = 0
    for (const palavra of verso.split(' ')) {
      const base = texto(pista, palavra, ESTILO_BASE)
      const luz = texto(pista, palavra, ESTILO_LUZ).setDepth(6.1)
      const w = base.width
      v.fila.push({ quando: t + (atraso / velocidade) * 1000, base, luz, w, y })
      atraso += w + VAO
    }
    tocar(arena, 'karaokeVerso')
  }

  const desenharTela = (v) => {
    const l = v.pista.caixa.limites
    const g = v.tela
    g.clear()
    // tela de karaokê: azul-marinho em cima, roxo embaixo
    g.fillGradientStyle(0x101860, 0x101860, 0x40105a, 0x40105a, 0.5)
    g.fillRect(l.left, l.top, l.width, l.height)
    // linha do cursor (onde as palavras acendem), pontilhada e fraquinha
    const x = Math.round(l.left + l.width * CURSOR)
    g.fillStyle(0xff8ac8, 0.22)
    for (let y = l.top + 10; y < l.bottom - 8; y += 8) g.fillRect(x - 1, y, 2, 4)
    g.fillStyle(0xff5ab0, 0.8)
    g.fillTriangle(x - 5, l.top + 1, x + 5, l.top + 1, x, l.top + 7)
    g.fillTriangle(x - 5, l.bottom - 1, x + 5, l.bottom - 1, x, l.bottom - 7)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      visuais = arena.pistas.map((pista, j) => {
        const tela = arena.add.graphics().setDepth(2)
        pista.caixa.recortar(tela)
        return { j, pista, tela, proximo: j === 0 ? entre(300, 600) : entre(900, 1300), faixa: -1, fila: [] }
      })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      visuais.forEach((v, j) => {
        v.proximo -= delta
        if (v.proximo <= 0) {
          v.proximo = entre(INTERVALO.min, INTERVALO.max) / aceleracao
          cantarVerso(v, j)
        }
        const prontas = v.fila.filter((item) => t >= item.quando)
        v.fila = v.fila.filter((item) => t < item.quando)
        for (const item of prontas) soltarPalavra(v, item)
        desenharTela(v)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), esperando: visuais.map((v) => v.fila.length), textos: textos.size }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of visuais) v.tela.destroy()
      visuais = []
      for (const txt of [...textos]) {
        arena.tweens?.killTweensOf(txt)
        txt.destroy()
      }
      textos.clear()
    },
  }
}
