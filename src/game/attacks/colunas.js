import { definirAtaque } from './definir.js'
import { lacunasLivres } from './validacao.js'

// Colunas verticais que despencam do alto. Nada pisca na caixa: a coluna
// nasce acima dela e entra devagar, acelerando ao cair (a entrada pelo topo é
// o aviso). As colunas são escolhidas para sempre sobrar uma lacuna de pelo
// menos 3x o coração.
//
//   partida   fração da velocidade com que a coluna entra (acelera até
//             `velocidade` na altura do fundo da caixa)
//   mirar     fração das levas em que uma das colunas cai na faixa do coração
//             (0 = todas sorteadas, 1 = toda leva tem uma coluna mirada). Assim
//             ficar parado não é seguro; a coluna entra devagar, dá tempo de sair.
//   aviso     (compatibilidade: não há mais faixa piscando)
export default definirAtaque({
  nome: 'colunas',
  padrao: { duracao: 5500, intervalo: 1400, quantidade: 2, largura: 22, velocidade: 170, partida: 0.4, aviso: 550, forma: null, mirar: 0.5 },
  iniciar(a, cfg) {
    const l = a.caixa
    const slots = Math.floor(l.width / cfg.largura)
    const passo = cfg.largura - 4
    // a coluna cobre a altura da caixa, mas sem nascer além de 150 px fora
    // (balas a mais de 160 px da caixa são removidas na hora)
    const porColuna = Math.min(Math.ceil(l.height / passo) + 1, Math.floor((150 - cfg.largura / 2) / passo) + 1)
    // acumulador: a fração `mirar` vira o ritmo de levas miradas. A fase é
    // sorteada (muda quais levas são miradas), mas a 1ª leva nunca é mirada,
    // para quem acabou de entrar na caixa
    const taxa = Number(cfg.mirar) || 0
    let mira = a.aleatorio(0, Math.max(0, 1 - taxa) * 0.999)
    // a coluna inteira cai junta (mesma velocidade e aceleração): chega a
    // `velocidade` quando a ponta alcança o fundo da caixa
    const v0 = cfg.velocidade * cfg.partida
    const queda = (cfg.velocidade ** 2 - v0 ** 2) / (2 * Math.max(40, l.height + cfg.largura / 2))

    a.aCada(cfg.intervalo, (i) => {
      mira += taxa
      let fixo = null
      if (mira >= 1) {
        mira -= 1
        const alvo = a.alvo()
        const folga = (l.width - slots * cfg.largura) / 2
        fixo = Math.min(slots - 1, Math.max(0, Math.floor((alvo.x - l.left - folga) / cfg.largura)))
      }
      const xs = escolherColunas(a, slots, cfg, fixo)
      a.parede({ eixo: 'x', ocupados: xs.map((x) => [x - cfg.largura / 2, x + cfg.largura / 2]) })

      for (const x of xs) {
        for (let k = 0; k < porColuna; k++) {
          a.bala({
            x,
            y: l.top - cfg.largura / 2 - k * passo,
            vy: v0,
            ay: queda,
            raio: cfg.largura / 2 - 2,
            forma: cfg.forma ?? a.forma(i + k),
            girar: 2,
            pulso: 0.04,
            entrando: true,
          })
        }
      }
    })
  },
})

// Sorteia as colunas (com semente) até sobrar uma lacuna grande o bastante.
// `fixo`: índice de uma coluna que sempre entra (a mirada no coração)
function escolherColunas(a, slots, cfg, fixo = null) {
  const l = a.caixa
  let xs = []
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const indices = new Set(fixo === null ? [] : [fixo])
    while (indices.size < Math.min(cfg.quantidade, slots)) indices.add(a.inteiro(0, slots - 1))
    // as faixas ficam centradas na caixa: a sobra se divide entre os dois lados
    // (antes ficava toda à direita, e o canto direito nunca levava coluna)
    const folga = (l.width - slots * cfg.largura) / 2
    xs = [...indices].map((s) => l.left + folga + cfg.largura / 2 + s * cfg.largura)
    const livres = lacunasLivres(l.left, l.right, xs.map((x) => [x - cfg.largura / 2, x + cfg.largura / 2]))
    if (Math.max(0, ...livres.map(([p, q]) => q - p)) >= a.lacunaMinima) break
  }
  return xs
}
