import { definirAtaque } from './definir.js'

// Brasas. Identidade: o contrário da chuva: o fogo SOBE. Cada brasa nasce
// piscando no chão da caixa, sobe balançando de um lado para o outro (como
// fagulha no vento) e, a cada `estouro` brasas, uma delas estoura na metade
// da subida em fagulhas para os lados.
//
//   ondulacao   amplitude do balanço (px)
//   frequencia  velocidade do balanço (voltas por segundo)
//   estouro     a cada quantas brasas uma estoura (0 desliga)
//   fagulhas    quantas fagulhas saem do estouro
//   mirar       fração das brasas que nascem na coluna do coração (piscando no
//               chão como as outras). Sem isso, os cantos de cima quase nunca
//               eram alcançados e dava para esperar parado.
export default definirAtaque({
  nome: 'brasas',
  padrao: { duracao: 5500, intervalo: 240, velocidade: 120, raio: 7, ondulacao: 18, frequencia: 1.2, estouro: 5, fagulhas: 4, aviso: 450, forma: 'chama', mirar: 0.25 },
  iniciar(a, cfg) {
    let mira = 0 // acumulador: `mirar` vira um ritmo fixo de brasas miradas

    a.aCada(cfg.intervalo, (i) => {
      const l = a.caixa
      const [min, max] = [l.left + cfg.ondulacao + cfg.raio, l.right - cfg.ondulacao - cfg.raio]
      let x0 = a.aleatorio(min, max)
      let fase = a.aleatorio(0, Math.PI * 2)
      mira += Number(cfg.mirar) || 0
      if (mira >= 1) {
        mira -= 1
        // nasce na coluna do coração: o centro do balanço fica o mais perto
        // possível dele e a fase é acertada para a brasa passar pelo coração
        // quando chegar na altura dele
        const alvo = a.alvo()
        x0 = Math.min(Math.max(alvo.x, min), max)
        const s = Math.min(1, Math.max(-1, (alvo.x - x0) / cfg.ondulacao))
        const subida = Math.max(0, l.bottom - cfg.raio - 2 - alvo.y) / cfg.velocidade
        const base = a.aleatorio(0, 1) < 0.5 ? Math.asin(s) : Math.PI - Math.asin(s)
        fase = base - subida * cfg.frequencia * Math.PI * 2
      }
      const estoura = cfg.estouro > 0 && i % cfg.estouro === cfg.estouro - 1
      const alturaEstouro = l.top + l.height * 0.45
      let estourou = false

      a.bala({
        x: x0 + Math.sin(fase) * cfg.ondulacao, // já nasce onde o balanço começa
        y: l.bottom - cfg.raio - 2,
        vy: -cfg.velocidade,
        raio: estoura ? cfg.raio * 1.3 : cfg.raio,
        forma: cfg.forma,
        aviso: cfg.aviso,
        pulso: 0.15,
        atualizar: (b) => {
          const t = (b.idade - b.aviso) / 1000
          b.x = x0 + Math.sin(t * cfg.frequencia * Math.PI * 2 + fase) * cfg.ondulacao
          if (!estoura || estourou || b.morta || b.inofensiva) return
          if (b.y < alturaEstouro + 30) b.piscar = true
          if (b.y > alturaEstouro) return
          estourou = true
          b.morta = true
          for (let k = 0; k < cfg.fagulhas; k++) {
            // leque para cima e para os lados, nunca direto para baixo
            const ang = -Math.PI / 2 + (k - (cfg.fagulhas - 1) / 2) * 0.9
            a.bala({
              x: b.x,
              y: b.y,
              vx: Math.cos(ang) * cfg.velocidade * 1.1,
              vy: Math.sin(ang) * cfg.velocidade * 1.1 + 40,
              ay: 60,
              raio: cfg.raio * 0.7,
              forma: cfg.forma,
              jaAvisada: true,
            })
          }
        },
      })
    })
  },
})
