import { definirAtaque } from './definir.js'
import { lacunasLivres } from './validacao.js'

// Colunas verticais que caem na caixa. A faixa inteira de cada coluna pisca
// antes (aviso) e as colunas são escolhidas para sempre sobrar uma lacuna
// de pelo menos 3x o coração.
export default definirAtaque({
  nome: 'colunas',
  padrao: { duracao: 5500, intervalo: 1400, quantidade: 2, largura: 22, velocidade: 170, aviso: 550, forma: null },
  iniciar(a, cfg) {
    const l = a.caixa
    const slots = Math.floor(l.width / cfg.largura)
    const passo = cfg.largura - 4
    const porColuna = Math.ceil(l.height / passo) + 1

    a.aCada(cfg.intervalo, (i) => {
      const xs = escolherColunas(a, slots, cfg)
      a.parede({ eixo: 'x', ocupados: xs.map((x) => [x - cfg.largura / 2, x + cfg.largura / 2]) })

      for (const x of xs) {
        a.aviso(
          { tipo: 'area', x: x - cfg.largura / 2, y: l.top, largura: cfg.largura, altura: l.height, ms: cfg.aviso },
          () => {
            for (let k = 0; k < porColuna; k++) {
              a.bala({
                x,
                y: l.top - cfg.largura / 2 - k * passo,
                vy: cfg.velocidade,
                raio: cfg.largura / 2 - 2,
                forma: cfg.forma ?? a.forma(i + k),
                girar: 2,
                pulso: 0.04,
                jaAvisada: true,
              })
            }
          },
        )
      }
    })
  },
})

// Sorteia as colunas (com semente) até sobrar uma lacuna grande o bastante
function escolherColunas(a, slots, cfg) {
  const l = a.caixa
  let xs = []
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const indices = new Set()
    while (indices.size < Math.min(cfg.quantidade, slots)) indices.add(a.inteiro(0, slots - 1))
    xs = [...indices].map((s) => l.left + cfg.largura / 2 + s * cfg.largura)
    const livres = lacunasLivres(l.left, l.right, xs.map((x) => [x - cfg.largura / 2, x + cfg.largura / 2]))
    if (Math.max(0, ...livres.map(([p, q]) => q - p)) >= a.lacunaMinima) break
  }
  return xs
}
