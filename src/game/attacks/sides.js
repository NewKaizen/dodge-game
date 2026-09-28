import { definirAtaque } from './definir.js'

// Lanças entrando pelas laterais, alternando esquerda e direita. Uma linha
// pisca na fileira antes de cada lança. Com `mirar`, a fileira é a de um
// dos corações (alternando entre os jogadores).
export default definirAtaque({
  nome: 'sides',
  padrao: { duracao: 5000, intervalo: 900, velocidade: 220, comprimento: 44, espessura: 8, aviso: 500, mirar: true },
  iniciar(a, cfg) {
    const l = a.caixa
    a.aCada(cfg.intervalo, (i) => {
      const daEsquerda = i % 2 === 0
      const alvoY = cfg.mirar ? a.alvo().y : a.aleatorio(l.top, l.bottom)
      const y = Math.min(Math.max(alvoY, l.top + cfg.espessura), l.bottom - cfg.espessura)
      a.aviso({ tipo: 'linha', x1: l.left, y1: y, x2: l.right, y2: y, espessura: cfg.espessura, ms: cfg.aviso }, () => {
        a.bala({
          x: daEsquerda ? l.left - cfg.comprimento / 2 : l.right + cfg.comprimento / 2,
          y,
          vx: daEsquerda ? cfg.velocidade : -cfg.velocidade,
          largura: cfg.comprimento,
          altura: cfg.espessura,
          forma: 'barra',
          jaAvisada: true,
        })
      })
    })
  },
})
