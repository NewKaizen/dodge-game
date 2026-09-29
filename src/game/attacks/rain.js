import { definirAtaque } from './definir.js'

// Chuva de gravidade. Identidade: a gota NÃO cai a velocidade constante. Ela
// nasce piscando no topo (aviso), sai devagar e vai acelerando, chegando a
// `velocidade` só no fundo da caixa. Além disso as gotas caem em cascatas
// inclinadas: cada gota fica uma faixa ao lado da anterior, desenhando uma
// diagonal que muda de sentido a cada `cascata` gotas.
//
//   partida   fração da velocidade final com que a gota sai (0.4 = 40%)
//   cascata   quantas gotas formam uma diagonal antes de recomeçar noutra faixa
//   caixa     a chuva cai num "poço": caixa estreita e alta (aviso antes de mudar)
export default definirAtaque({
  nome: 'rain',
  padrao: { duracao: 5000, intervalo: 220, velocidade: 140, raio: 6, girar: 3, forma: null, partida: 0.4, cascata: 5, caixa: { largura: 150, altura: 190 } },
  iniciar(a, cfg) {
    const largura = 30
    let faixa = 0
    let sentido = 1

    a.aCada(cfg.intervalo, (i) => {
      const l = a.caixa // relida a cada gota: a caixa pode ter mudado de largura
      const faixas = Math.max(2, Math.floor(l.width / largura))
      const folga = (l.width - faixas * largura) / 2

      if (i % cfg.cascata === 0) {
        faixa = a.inteiro(0, faixas - 1)
        // começa a diagonal indo para o lado com mais espaço
        sentido = faixa < faixas / 2 ? 1 : -1
        if (a.aleatorio(0, 1) < 0.25) sentido = -sentido
      } else {
        faixa += sentido
      }
      if (faixa < 0 || faixa > faixas - 1) {
        sentido = -sentido
        faixa = Math.min(Math.max(faixa, 0), faixas - 1)
      }

      // v² = v0² + 2·g·h  ->  aceleração que faz a gota chegar ao fundo com `velocidade`
      const v0 = cfg.velocidade * cfg.partida
      const altura = Math.max(40, l.height - cfg.raio * 2)
      const gravidade = (cfg.velocidade ** 2 - v0 ** 2) / (2 * altura)

      a.bala({
        x: l.left + folga + largura / 2 + faixa * largura,
        y: l.top + cfg.raio + 2,
        vy: v0,
        ay: gravidade,
        raio: cfg.raio,
        girar: cfg.girar,
        forma: cfg.forma ?? a.forma(i),
      })
    })
  },
})
