import { definirAtaque } from './definir.js'

// Anel (elipse do tamanho da caixa) que fecha em direção ao centro, com uma
// abertura. O anel pisca parado antes de fechar; os cantos da caixa ficam
// fora dele.
export default definirAtaque({
  nome: 'anel',
  padrao: { duracao: 6000, intervalo: 2000, quantidade: 24, abertura: 1.0, tempoFechar: 1400, aviso: 600, raio: 7, forma: null },
  iniciar(a, cfg) {
    const l = a.caixa
    const rx = l.width / 2 - 8
    const ry = l.height / 2 - 8
    const { centerX: cx, centerY: cy } = l
    a.lacuna(cfg.abertura * Math.min(rx, ry), 'abertura do anel')

    a.aCada(cfg.intervalo, (i) => {
      const vao = a.aleatorio(0, Math.PI * 2)
      const passo = (Math.PI * 2 - cfg.abertura) / (cfg.quantidade - 1)
      for (let k = 0; k < cfg.quantidade; k++) {
        const ang = vao + cfg.abertura / 2 + k * passo
        const x = cx + Math.cos(ang) * rx
        const y = cy + Math.sin(ang) * ry
        const s = cfg.tempoFechar / 1000
        a.bala({
          x,
          y,
          vx: (cx - x) / s,
          vy: (cy - y) / s,
          vida: cfg.tempoFechar * 0.88,
          raio: cfg.raio,
          forma: cfg.forma ?? a.forma(i),
          aviso: cfg.aviso,
          girar: 3,
        })
      }
    })
  },
})
