import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// MURALHA DE PEÕES do Chaos King (dificuldade do CO-OP). Uma fileira de peões ocupa a largura toda do tabuleiro
// e MARCHA para baixo, uma casa por batida. Cada fileira tem UMA brecha de duas casas, e a brecha de uma fileira
// nunca fica embaixo da brecha da anterior: a dupla tem de costurar de uma para a outra. A casa para onde os
// peões vão pular acende antes de cada passo. Quando a fileira chega na última casa ela é PROMOVIDA: os peões
// viram coroas, piscam e disparam para cima (as colunas da brecha não atiram).
//
// Justiça: a brecha tem 2 casas (>= LACUNA_MINIMA); as casas do próximo passo ficam acesas o passo inteiro;
// as brechas de fileiras seguidas ficam a no máximo `salto` casas uma da outra (alcançável em uma marcha);
// a promoção pisca `avisoPromocao` ms antes do tiro.
//
//   colunas, linhas   o tabuleiro (8 x 5)
//   passo             ms entre um passo e o próximo (a densidade aperta pela raiz: a.aCadaEvento)
//   fileiras          quantas fileiras entram (uma a cada `entre` passos)
//   promove           0..1: fração dos peões (fora da brecha) que atiram na promoção
//   velocidadeTiro    px/s do tiro da promoção
export default definirAtaque({
  nome: 'kingMuralha',
  padrao: { duracao: 7000, colunas: 8, linhas: 5, passo: 800, entre: 3, fileiras: 5, promove: 0.4, velocidadeTiro: 160, avisoPromocao: 500, salto: 3 },
  iniciar(a, cfg) {
    const geo = () => {
      const l = a.caixa
      const cw = l.width / cfg.colunas
      const ch = l.height / cfg.linhas
      return { l, cw, ch, x: (c) => l.left + cw * (c + 0.5), y: (r) => l.top + ch * (r + 0.5) }
    }
    a.lacuna(geo().cw * 2, 'brecha da muralha')
    const temIcone = Boolean(a.cena.textures?.exists?.('king-p-peao'))
    const fileiras = []
    let brechaAnterior = a.inteiro(0, cfg.colunas - 2)
    let criadas = 0
    const marca = a.decoracao(a.cena.add.graphics().setDepth(3))

    const nova = () => {
      // a brecha: longe da anterior, mas alcançável
      const opcoes = []
      for (let c = 0; c <= cfg.colunas - 2; c++) {
        const d = Math.abs(c - brechaAnterior)
        if (d >= 2 && d <= cfg.salto) opcoes.push(c)
      }
      const brecha = a.escolher(opcoes.length ? opcoes : [0])
      brechaAnterior = brecha
      const { cw, ch, x, l } = geo()
      const pecas = []
      for (let c = 0; c < cfg.colunas; c++) {
        if (c === brecha || c === brecha + 1) continue
        const b = a.bala({
          x: x(c),
          y: l.top - ch / 2,
          largura: cw - 2,
          altura: ch * 0.62,
          ...(temIcone ? { textura: 'king-p-peao', tamanho: ch * 0.9, cor: 0xd8c8ff } : { forma: 'coroa' }),
          atravessa: true,
          jaAvisada: true,
          pulso: 0,
        })
        pecas.push({ b, c })
      }
      fileiras.push({ r: -1, pecas, brecha, alvo: null })
      criadas++
    }

    // a casa para onde cada fileira vai no PRÓXIMO passo fica acesa o tempo todo (mais forte perto do passo)
    const passoReal = cfg.passo / Math.sqrt(Math.max(0.01, a.ritmo.densidade))
    let desdePasso = 0
    a.aoAtualizar((dt) => {
      if (!marca.scene) return
      desdePasso += dt
      marca.clear()
      const { cw, ch, l } = geo()
      const forca = Math.min(1, desdePasso / passoReal)
      for (const f of fileiras) {
        // a peça anda até a casa de destino (deslize curto)
        if (f.alvo != null) {
          for (const p of f.pecas) {
            if (p.b.morta) continue
            const destino = l.top + ch * (f.alvo + 0.5)
            p.b.y += (destino - p.b.y) * Math.min(1, dt / 70)
          }
        }
        const prox = f.r + 1
        if (prox < 0 || prox >= cfg.linhas) continue
        marca.fillStyle(0xff5a6a, 0.12 + 0.22 * forca)
        for (const p of f.pecas) if (!p.b.morta) marca.fillRect(l.left + cw * p.c + 1, l.top + ch * prox + 1, cw - 2, ch - 2)
      }
    })

    const promover = (f) => {
      const { ch, l } = geo()
      tocar(a.cena, 'sino')
      // os peões viram coroas e piscam; uma parte atira para cima
      let sorteio = a.aleatorio(0, 1)
      for (const p of f.pecas) {
        p.b.sprite.setTint?.(0xffd23c)
        sorteio += cfg.promove
        if (sorteio < 1) continue
        sorteio -= 1
        const x0 = p.b.x
        a.aviso({ tipo: 'linha', x1: x0, y1: l.bottom, x2: x0, y2: l.top, espessura: 10, ms: cfg.avisoPromocao, estilo: 'fino', cor: 0xffd23c }, () => {
          a.bala({ x: x0, y: l.bottom - ch * 0.5, vy: -cfg.velocidadeTiro, raio: 7, forma: 'coroa', cor: 0xffd23c, jaAvisada: true })
        })
      }
      a.depois(cfg.avisoPromocao + 80, () => f.pecas.forEach((p) => (p.b.morta = true)))
    }

    let passos = 0
    a.aCadaEvento(
      cfg.passo,
      () => {
        // o passo: cada fileira desce uma casa (a da última casa é promovida)
        for (const f of [...fileiras]) {
          f.r++
          f.alvo = f.r
          if (f.r >= cfg.linhas - 1 && !f.promovida) {
            f.promovida = true
            a.depois(cfg.passo * 0.5, () => promover(f))
          }
          if (f.r >= cfg.linhas) fileiras.splice(fileiras.indexOf(f), 1)
        }
        if (passos % cfg.entre === 0 && criadas < cfg.fileiras) nova()
        passos++
        desdePasso = 0
        // a CPU aliada enxerga a casa do próximo passo (zona de perigo durante o passo inteiro)
        const { cw, ch, l } = geo()
        for (const f of fileiras) {
          const prox = f.r + 1
          if (prox < 0 || prox >= cfg.linhas) continue
          for (const p of f.pecas) a.zonaPerigo({ tipo: 'area', x: l.left + cw * p.c, y: l.top + ch * prox, largura: cw, altura: ch }, { ms: passoReal * 0.6, dura: passoReal * 0.6 })
        }
        tocar(a.cena, 'cartaImpacto')
      },
      Infinity,
      200,
    )
  },
})
