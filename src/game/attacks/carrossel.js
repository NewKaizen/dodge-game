import { definirAtaque } from './definir.js'

// Carrossel: anéis de balas girando em volta do centro da caixa, cada um com
// um vão, "respirando" juntos (a faixa entre os anéis mantém a largura).
export default definirAtaque({
  nome: 'carrossel',
  padrao: {
    duracao: 6500,
    aneis: [
      { raio: 42, quantidade: 8, giro: 1.1 },
      { raio: 112, quantidade: 18, giro: -0.8 },
    ],
    vaos: 2,
    respira: 8,
    periodo: 1600,
    raioBala: 7,
    aviso: 600,
  },
  iniciar(a, cfg) {
    const { centerX: cx, centerY: cy } = a.caixa
    const rb = cfg.raioBala

    // rotas de fuga: miolo, faixas entre anéis e vão de cada anel
    a.lacuna(2 * (cfg.aneis[0].raio - rb), 'miolo do carrossel')
    for (let k = 1; k < cfg.aneis.length; k++) {
      a.lacuna(cfg.aneis[k].raio - cfg.aneis[k - 1].raio - 2 * rb, 'faixa entre anéis')
    }

    cfg.aneis.forEach((anel, k) => {
      const passo = (Math.PI * 2) / anel.quantidade
      a.lacuna(cfg.vaos * passo * anel.raio - 2 * rb, `vão do anel ${k + 1}`)
      for (let j = cfg.vaos; j < anel.quantidade; j++) {
        const ang0 = j * passo + k * 0.5
        a.bala({
          x: cx + Math.cos(ang0) * anel.raio,
          y: cy + Math.sin(ang0) * anel.raio,
          raio: rb,
          forma: a.forma(j + k),
          aviso: cfg.aviso,
          atravessa: true,
          girar: 3,
          atualizar: (b) => {
            const t = (b.idade - b.aviso) / 1000
            const r = anel.raio + Math.sin((t * Math.PI * 2 * 1000) / cfg.periodo) * cfg.respira
            const ang = ang0 + anel.giro * t
            b.x = cx + Math.cos(ang) * r
            b.y = cy + Math.sin(ang) * r
          },
        })
      }
    })
  },
})
