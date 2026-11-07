import { definirAtaque } from './definir.js'

// ARREMESSO DE CARTAS (campanha, o TITÃ: regra `titan`). As cartas da mão de quem joga que NÃO foram
// jogadas viram balas: cada uma aparece embaixo da caixa (o lado da mão, na tela), parada e tremendo
// (aviso), e voa onde o coração estava, quicando uma vez nas paredes. São as cartas em si, não as
// habilidades delas. Cada bala leva `cartaId` (a tela põe a Carta de verdade em cima dela).
//
//   cartas     [{ id }] as cartas arremessadas (na ordem da mão)
//   intervalo  ms entre uma carta e a próxima · aviso: ms parada antes de voar
//   largura, altura   o tamanho da carta (a carta inteira machuca)
export const TAMANHO_CARTA = Object.freeze({ largura: 20, altura: 28 })

export default definirAtaque({
  nome: 'arremesso',
  padrao: { duracao: 2500, cartas: [], intervalo: 420, aviso: 650, velocidade: 190, ...TAMANHO_CARTA, respiro: { inicio: 0, meio: 0 }, caixa: null },
  iniciar(a, cfg) {
    const n = cfg.cartas.length
    cfg.cartas.forEach((c, i) =>
      a.depois(i * cfg.intervalo, () => {
        const l = a.caixa
        const x = l.left + (l.width * (i + 1)) / (n + 1)
        const y = l.bottom + cfg.altura / 2 + 3
        const alvo = a.alvo()
        const d = Math.atan2(alvo.y - y, alvo.x - x) + a.aleatorio(-0.11, 0.11)
        const b = a.bala({ x, y, vx: Math.cos(d) * cfg.velocidade, vy: Math.sin(d) * cfg.velocidade, largura: cfg.largura, altura: cfg.altura, aviso: cfg.aviso, entrando: false, quicar: 1, forma: 'barra' })
        if (b) b.cartaId = String(c.id)
      }),
    )
  },
})

// quanto tempo o arremesso de n cartas leva (a última sai, avisa e cruza a caixa)
export const duracaoDoArremesso = (n, { intervalo = 420, aviso = 650 } = {}) => (n > 0 ? (n - 1) * intervalo + aviso + 900 : 0)
