import { definirAtaque } from './definir.js'

// Brasas. Identidade: o contrário da chuva: o fogo SOBE. Cada brasa nasce
// logo abaixo da caixa e entra subindo devagar (a entrada é o aviso, nada
// pisca), acelera como fagulha no ar quente e sobe balançando de um lado para
// o outro. Em média uma a cada `estouro` brasas (sorteadas) estoura na metade
// da subida em fagulhas para os lados.
//
//   ondulacao   amplitude do balanço (px)
//   frequencia  velocidade do balanço (voltas por segundo)
//   estouro     em média, a cada quantas brasas uma estoura (0 desliga)
//   aviso       ms que a brasa leva para chegar à velocidade cheia (entra a 35% dela)
//   fagulhas    quantas fagulhas saem do estouro
//   mirar       fração das brasas que nascem na coluna do coração (entrando
//               como as outras). Sem isso, os cantos de cima quase nunca
//               eram alcançados e dava para esperar parado.
export default definirAtaque({
  nome: 'brasas',
  padrao: { duracao: 5500, intervalo: 240, velocidade: 120, raio: 7, ondulacao: 18, frequencia: 1.2, estouro: 5, fagulhas: 4, aviso: 450, forma: 'chama', mirar: 0.25 },
  iniciar(a, cfg) {
    let mira = a.aleatorio(0, 1) // acumulador: `mirar` vira a fração de brasas miradas (fase sorteada)
    let estouros = a.aleatorio(0, 1) // idem para as que estouram
    // entra a 35% da velocidade e acelera até ela em `aviso` ms
    const v0 = cfg.velocidade * 0.35
    const subir = (cfg.velocidade - v0) / (Math.max(300, cfg.aviso) / 1000)

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
        const subida = tempoDeSubida(Math.max(0, l.bottom + cfg.raio + 2 - alvo.y), v0, subir, cfg.velocidade)
        const base = a.aleatorio(0, 1) < 0.5 ? Math.asin(s) : Math.PI - Math.asin(s)
        fase = base - subida * cfg.frequencia * Math.PI * 2
      }
      let estoura = false
      if (cfg.estouro > 0) {
        estouros += 1 / cfg.estouro
        if (estouros >= 1) {
          estouros -= 1
          estoura = true
        }
      }
      const alturaEstouro = l.top + l.height * 0.45
      let estourou = false

      a.bala({
        x: x0 + Math.sin(fase) * cfg.ondulacao, // já nasce onde o balanço começa
        y: l.bottom + cfg.raio + 2, // logo abaixo da caixa: entra subindo
        vy: -v0,
        ay: -subir,
        raio: estoura ? cfg.raio * 1.3 : cfg.raio,
        forma: cfg.forma,
        entrando: true,
        pulso: 0.15,
        atualizar: (b) => {
          if (b.ay !== 0 && b.vy <= -cfg.velocidade) {
            b.vy = -cfg.velocidade // velocidade cheia: para de acelerar
            b.ay = 0
          }
          const t = b.idade / 1000
          b.x = x0 + Math.sin(t * cfg.frequencia * Math.PI * 2 + fase) * cfg.ondulacao
          if (!estoura || estourou || b.morta || b.inofensiva) return
          if (b.y < alturaEstouro + 30) b.piscar = true
          if (b.y > alturaEstouro) return
          estourou = true
          b.morta = true
          for (let k = 0; k < cfg.fagulhas; k++) {
            // leque para cima e para os lados, nunca direto para baixo
            const ang = -Math.PI / 2 + (k - (cfg.fagulhas - 1) / 2) * 0.9 + a.aleatorio(-0.15, 0.15)
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

// Segundos para subir `d` px entrando a `v0`, acelerando `acel` até `v`
function tempoDeSubida(d, v0, acel, v) {
  const tAcel = (v - v0) / acel
  const dAcel = v0 * tAcel + (acel * tAcel * tAcel) / 2
  if (d >= dAcel) return tAcel + (d - dAcel) / v
  return (-v0 + Math.sqrt(v0 * v0 + 2 * acel * d)) / acel
}
