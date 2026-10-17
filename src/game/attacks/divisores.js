import { definirAtaque } from './definir.js'

// Projéteis que entram pelo topo (nascem logo acima da caixa: a entrada é o
// aviso) em direção a um coração e, depois de piscar (aviso da divisão), se
// dividem em `filhos` menores abertos em leque. O ponto de entrada e o giro do
// leque são sorteados (com semente).
export default definirAtaque({
  nome: 'divisores',
  padrao: { duracao: 6000, intervalo: 1100, velocidade: 110, divideEm: 900, filhos: 3, abertura: 0.55, velocidadeFilhos: 150, raio: 9, forma: null },
  iniciar(a, cfg) {
    const l = a.caixa
    const avisoDivisao = Math.min(400, cfg.divideEm)

    a.aCada(cfg.intervalo, (i) => {
      const x = l.left + l.width * a.aleatorio(0.15, 0.85)
      const y = l.top - cfg.raio - 2
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
        entrando: true,
        atualizar: (mae) => {
          const t = mae.idade - mae.aviso
          if (t >= cfg.divideEm - avisoDivisao) mae.piscar = true
          if (t < cfg.divideEm || dividida || mae.morta || mae.inofensiva) return
          dividida = true
          mae.morta = true
          const torto = a.aleatorio(-0.2, 0.2) * cfg.abertura // o leque não abre sempre igual
          for (let k = 0; k < cfg.filhos; k++) {
            const ang = dir + torto + (k - (cfg.filhos - 1) / 2) * cfg.abertura
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
