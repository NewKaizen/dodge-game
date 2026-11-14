import { tocar } from '../../../../audio.js'
import { particulas } from '../../../../effects/particulas.js'
import { contextoDoCafe, rngFilho } from './util.js'
import { texturasDoMenu } from './arte.js'
import { MENU, PRATOS, proximoPratoDoDia, planejarPrato, entre } from './planos.js'

// MENU DO DIA: um quadro-negro em cima de cada caixa mostra o PRATO DO DIA. As balas viram
// pratos (croissant, baguete, queijo, sopa de cebola, macaron) que cruzam a caixa; só o prato
// do dia é bom: encostar nele CURA (3% do HP máximo, mínimo 2, com um respiro de 0,9 s entre
// curas) e o prato some; qualquer outro machuca como uma bala normal (4 de dano). O quadro
// muda a cada ~6,8 s: nos últimos 0,8 s ele pisca e, na hora da troca, todos os pratos viram
// inofensivos por 0,5 s (ninguém leva dano por uma troca que não deu tempo de ler).
// Os dois quadros mostram o mesmo prato (o sorteio do dia vem da rodada); cada caixa tem o seu
// ritmo de pratos (filho do rng). Em rede só o dono do coração cura (arena.curarCoracao).
// A CPU não corre atrás de pratos (os bons são inofensivos para ela, e ela os pega de passagem).
// terminar() apaga os quadros e os pratos que sobraram.

const AVISO_TROCA_MS = 800
const GRACA_MS = 500

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const ctx = contextoDoCafe(arena)
  let ativo = false
  let t = 0
  let doDia = 'croissant'
  let trocaEm = 0 // t em que o prato muda
  let graca = 0 // até este t nenhum prato machuca
  const sorteDoDia = rngFilho(sorte)
  // por pista: { pista, sorte, proximo, pratos: [{ b, id }], quadro: { g, titulo, nome, icone }, curouEm }
  let lados = []

  const nomeDe = (id) => PRATOS.find((p) => p.id === id)?.nome ?? id

  const desenharQuadro = (s) => {
    const l = s.pista.caixa.limites
    const q = s.quadro
    const x = l.centerX
    const y = Math.max(86, l.top - 30)
    const avisando = t >= trocaEm - AVISO_TROCA_MS
    const pisca = avisando && Math.sin(t / 55) > 0
    const w = 168
    const h = 34
    q.g.clear()
    q.g.fillStyle(0x000000, 0.35).fillRoundedRect(x - w / 2 + 2, y - h / 2 + 3, w, h, 4)
    q.g.fillStyle(pisca ? 0xffe9a0 : 0x7a4a24, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 4)
    q.g.fillStyle(0x203428, 1).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, 2)
    q.g.lineStyle(1, 0xffffff, 0.25)
    q.g.lineBetween(x - w / 2 + 8, y + h / 2 - 7, x + w / 2 - 8, y + h / 2 - 7)
    q.titulo.setPosition(x + 14, y - 8).setText(avisando ? 'TROCA O PRATO!' : 'PRATO DO DIA').setColor(avisando ? '#ffd870' : '#bfe8c8')
    q.nome.setPosition(x + 14, y + 6).setText(nomeDe(doDia))
    q.icone.setPosition(x - w / 2 + 24, y).setTexture(`cafe-prato-${doDia}`)
  }

  const trocarPrato = () => {
    doDia = proximoPratoDoDia(sorteDoDia, doDia)
    trocaEm = t + MENU.trocaMs / aceleracao
    graca = t + GRACA_MS
    tocar(arena, 'clique')
    for (const s of lados) {
      arena.tweens.add({ targets: s.quadro.icone, scale: { from: 1.9, to: 1 }, duration: 260, ease: 'Back.easeOut' })
      s.quadro.nome.setScale(1.3)
      arena.tweens.add({ targets: s.quadro.nome, scale: 1, duration: 220 })
    }
  }

  const criarPrato = (s, j) => {
    const pista = ctx.pistaViva(j)
    if (!pista) return
    const p = planejarPrato(s.sorte, pista.caixa.limites, doDia)
    const b = pista.balas.criar({
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
      raio: MENU.raio,
      dano: MENU.dano,
      textura: `cafe-prato-${p.id}`,
      tamanho: 28,
      pulso: 0.04,
      girar: (s.sorte() - 0.5) * 1.6,
      entrando: true,
      origem: 'bonus-menu',
    })
    s.pratos.push({ b, id: p.id })
  }

  const comer = (s, j, prato, c) => {
    const { b } = prato
    b.morta = true
    b.sprite.setVisible(false)
    particulas(arena, b.x, b.y, { cor: 0x7fe08a, quantidade: 8, velocidade: 90, vida: 500 })
    tocar(arena, 'cura')
    if (t - s.curouEm < MENU.curaIntervaloMs) return
    s.curouEm = t
    ctx.curar(j, MENU.cura)
    const txt = ctx.texto(c.x, c.y - 18, 'NHAM!', { cor: '#9aff9a', tamanho: 11 })
    arena.tweens.add({ targets: txt, y: txt.y - 16, alpha: 0, duration: 700, onComplete: () => txt.destroy() })
  }

  const mexerNosPratos = (s, j) => {
    const c = ctx.coracao(j)
    s.pratos = s.pratos.filter((p) => !p.b.morta && p.b.sprite?.scene)
    const emGraca = t < graca
    for (const prato of s.pratos) {
      const { b } = prato
      if (b.idade < b.aviso) continue
      const bom = prato.id === doDia
      b.inofensiva = bom || emGraca
      b.sprite.setAlpha(emGraca && !bom ? 0.55 : 1)
      if (bom && c && Math.hypot(b.x - c.x, b.y - c.y) <= b.raio + 7) comer(s, j, prato, c)
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      texturasDoMenu(arena)
      doDia = proximoPratoDoDia(sorteDoDia, null)
      trocaEm = MENU.trocaMs / aceleracao
      graca = 0
      lados = arena.pistas.map((pista) => {
        const filho = rngFilho(sorte)
        const g = ctx.naTela(arena.add.graphics().setDepth(60))
        const titulo = ctx.texto(0, 0, 'PRATO DO DIA', { cor: '#bfe8c8', tamanho: 8, profundidade: 61 })
        const nome = ctx.texto(0, 0, '', { cor: '#ffffff', tamanho: 10, profundidade: 61 })
        const icone = ctx.naTela(arena.add.image(0, 0, `cafe-prato-${doDia}`).setDepth(61).setScale(1))
        const s = { pista, sorte: filho, proximo: entre(filho, MENU.primeiro.min, MENU.primeiro.max), pratos: [], quadro: { g, titulo, nome, icone }, curouEm: -1e9 }
        desenharQuadro(s)
        return s
      })
      ctx.instrucao('SÓ O PRATO DO DIA CURA!', { cor: '#bfe8c8' })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      if (t >= trocaEm) trocarPrato()
      lados.forEach((s, j) => {
        if (ctx.pistaViva(j)) {
          s.proximo -= delta
          if (s.proximo <= 0) {
            s.proximo = entre(s.sorte, MENU.intervaloMs.min, MENU.intervaloMs.max) / aceleracao
            criarPrato(s, j)
          }
        }
        mexerNosPratos(s, j)
        desenharQuadro(s)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), doDia, pratos: lados.map((s) => s.pratos.map((p) => p.id)) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const s of lados) for (const p of s.pratos) p.b.morta = true
      lados = []
      ctx.limpar()
    },
  }
}
