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
//   mirar     fração das cascatas que passam pela faixa do coração (a gota do
//             meio da diagonal cai em cima dele). Ficar parado deixa de ser
//             seguro; as gotas piscam no topo e saem devagar, dá tempo de sair.
export default definirAtaque({
  nome: 'rain',
  padrao: { duracao: 5000, intervalo: 220, velocidade: 140, raio: 6, girar: 3, forma: null, partida: 0.4, cascata: 5, mirar: 0.5, caixa: { largura: 150, altura: 190 } },
  iniciar(a, cfg) {
    const largura = 30
    let faixa = 0
    let sentido = 1
    let mira = 0 // acumulador: `mirar` vira um ritmo fixo de cascatas miradas

    a.aCada(cfg.intervalo, (i) => {
      const l = a.caixa // relida a cada gota: a caixa pode ter mudado de largura
      const faixas = Math.max(2, Math.floor(l.width / largura))
      // as faixas dividem a caixa inteira (a sobra não vira um corredor seguro na beirada)
      const passo = l.width / faixas

      if (i % cfg.cascata === 0) {
        faixa = a.inteiro(0, faixas - 1)
        // começa a diagonal indo para o lado com mais espaço
        sentido = faixa < faixas / 2 ? 1 : -1
        if (a.aleatorio(0, 1) < 0.25) sentido = -sentido
        mira += Number(cfg.mirar) || 0
        if (mira >= 1) {
          mira -= 1
          // cascata mirada: começa algumas faixas antes, para a gota do meio cair na faixa do coração
          const doCoracao = Math.min(faixas - 1, Math.max(0, Math.floor((a.alvo().x - l.left) / passo)))
          sentido = doCoracao < faixas / 2 ? -1 : 1 // vem do lado com mais espaço
          faixa = Math.min(faixas - 1, Math.max(0, doCoracao - sentido * Math.floor((cfg.cascata - 1) / 2)))
        }
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
        x: l.left + passo / 2 + faixa * passo,
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
