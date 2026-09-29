import { definirAtaque } from './definir.js'

// Projéteis que vão em direção a um coração e, depois de piscar (aviso da
// divisão), se dividem em `filhos` menores abertos em leque.
export default definirAtaque({
  nome: 'divisores',
  padrao: { duracao: 6000, intervalo: 1100, velocidade: 110, divideEm: 900, filhos: 3, abertura: 0.55, velocidadeFilhos: 150, raio: 9, forma: null },
  iniciar(a, cfg) {
    const l = a.caixa
    const avisoDivisao = Math.min(400, cfg.divideEm)

    a.aCada(cfg.intervalo, (i) => {
      const x = l.left + l.width * (i % 2 ? 0.25 : 0.75) + a.aleatorio(-20, 20)
      const y = l.top + cfg.raio + 2
      const alvo = a.alvo()
      const dir = Math.atan2(alvo.y - y, alvo.x - x)
      const forma = cfg.forma ?? a.forma(i)
      // o tempo da divisão vem do relógio da própria bala (idade), não do
      // relógio do ataque, que para durante os respiros da onda
      let dividida = false
      a.bala({
        x,
        y,
        vx: Math.cos(dir) * cfg.velocidade,
        vy: Math.sin(dir) * cfg.velocidade,
        raio: cfg.raio,
        forma,
        girar: 3,
        atualizar: (mae) => {
          const t = mae.idade - mae.aviso
          if (t >= cfg.divideEm - avisoDivisao) mae.piscar = true
          if (t < cfg.divideEm || dividida || mae.morta || mae.inofensiva) return
          dividida = true
          mae.morta = true
          for (let k = 0; k < cfg.filhos; k++) {
            const ang = dir + (k - (cfg.filhos - 1) / 2) * cfg.abertura
            a.bala({
              x: mae.x,
              y: mae.y,
              vx: Math.cos(ang) * cfg.velocidadeFilhos,
              vy: Math.sin(ang) * cfg.velocidadeFilhos,
              raio: cfg.raio * 0.7,
              forma,
              girar: 5,
              jaAvisada: true,
            })
          }
        },
      })
    })
  },
})
