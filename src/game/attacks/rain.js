import { definirAtaque } from './definir.js'

// Chuva de gravidade. Identidade: a gota NÃO cai a velocidade constante. Ela
// nasce logo acima da caixa e entra devagar (a entrada pela borda é o aviso:
// nada pisca), vai acelerando e chega a `velocidade` só no fundo da caixa.
// Além disso as gotas caem em cascatas inclinadas: cada gota fica uma faixa ao
// lado da anterior, desenhando uma diagonal. O tamanho de cada cascata, o
// sentido dela e um leve desvio de cada gota dentro da faixa são sorteados
// (com semente): a chuva nunca cai igual duas vezes.
//
//   partida   fração da velocidade final com que a gota entra (0.4 = 40%)
//   cascata   tamanho médio da diagonal (cada uma sorteia de cascata - 1 a cascata + 1 gotas)
//   caixa     a chuva cai num "poço": caixa estreita e alta (aviso antes de mudar)
//   mirar     fração das cascatas que passam pela faixa do coração (a gota do
//             meio da diagonal cai em cima dele). Ficar parado deixa de ser
//             seguro; as gotas entram devagar no topo, dá tempo de sair.
export default definirAtaque({
  nome: 'rain',
  padrao: { duracao: 5000, intervalo: 220, velocidade: 140, raio: 6, girar: 3, forma: null, partida: 0.4, cascata: 5, mirar: 0.5, caixa: { largura: 150, altura: 190 } },
  iniciar(a, cfg) {
    const largura = 30
    let faixa = 0
    let sentido = 1
    let restantes = 0 // gotas que ainda faltam na cascata atual
    // acumulador: `mirar` vira a fração de cascatas miradas; a fase sorteada
    // muda QUAIS cascatas são miradas de uma rodada para outra
    let mira = a.aleatorio(0, 1)

    a.aCada(cfg.intervalo, (i) => {
      const l = a.caixa // relida a cada gota: a caixa pode ter mudado de largura
      const faixas = Math.max(2, Math.floor(l.width / largura))
      // as faixas dividem a caixa inteira (a sobra não vira um corredor seguro na beirada)
      const passo = l.width / faixas

      if (restantes <= 0) {
        const media = Math.max(1, Math.round(cfg.cascata))
        restantes = Math.max(1, media + (media > 1 ? a.inteiro(-1, 1) : 0))
        faixa = a.inteiro(0, faixas - 1)
        // começa a diagonal indo para o lado com mais espaço (às vezes não)
        sentido = faixa < faixas / 2 ? 1 : -1
        if (a.aleatorio(0, 1) < 0.25) sentido = -sentido
        mira += Number(cfg.mirar) || 0
        if (mira >= 1) {
          mira -= 1
          // cascata mirada: começa algumas faixas antes, para a gota do meio cair na faixa do coração
          const doCoracao = Math.min(faixas - 1, Math.max(0, Math.floor((a.alvo().x - l.left) / passo)))
          sentido = doCoracao < faixas / 2 ? -1 : 1 // vem do lado com mais espaço
          faixa = Math.min(faixas - 1, Math.max(0, doCoracao - sentido * Math.floor((restantes - 1) / 2)))
        }
      } else {
        faixa += sentido
      }
      restantes--
      if (faixa < 0 || faixa > faixas - 1) {
        sentido = -sentido
        faixa = Math.min(Math.max(faixa, 0), faixas - 1)
      }

      // v² = v0² + 2·g·h  ->  aceleração que faz a gota chegar ao fundo com `velocidade`
      const v0 = cfg.velocidade * cfg.partida
      const altura = Math.max(40, l.height)
      const gravidade = (cfg.velocidade ** 2 - v0 ** 2) / (2 * altura)

      a.bala({
        // leve desvio dentro da faixa: a diagonal não fica num trilho fixo
        x: l.left + passo / 2 + faixa * passo + a.aleatorio(-0.2, 0.2) * passo,
        y: l.top - cfg.raio - 2, // nasce logo acima da caixa e entra caindo
        vy: v0,
        ay: gravidade,
        raio: cfg.raio,
        girar: cfg.girar,
        forma: cfg.forma ?? a.forma(i),
        entrando: true,
      })
    })
  },
})
