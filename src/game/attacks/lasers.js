import { definirAtaque } from './definir.js'
import { lacunasLivres } from './validacao.js'
import { tocar } from '../audio.js'

// Lasers: os emissores acendem nas duas bordas da faixa (só as pontas piscam,
// nada risca a caixa) e depois um feixe grosso fica ligado por um instante. O
// feixe não é projétil (liga de uma vez de ponta a ponta), então o emissor na
// borda é o aviso mínimo para ser justo. O primeiro laser mira num coração.
// orientacao: 'horizontal' | 'vertical' | 'alternar' | 'cruz'
//   'alternar' troca de orientação quase sempre, mas às vezes repete (sorteado):
//   não dá para decorar a sequência
export default definirAtaque({
  nome: 'lasers',
  padrao: { duracao: 5500, intervalo: 1200, quantidade: 1, espessura: 26, aviso: 650, feixe: 450, orientacao: 'horizontal', mirar: true },
  iniciar(a, cfg) {
    let ultima = a.escolher(['horizontal', 'vertical'])
    let repetiu = false
    a.aCada(cfg.intervalo, () => {
      let orientacao = cfg.orientacao
      if (orientacao === 'alternar') {
        // troca, ou (1 vez em 4, nunca duas seguidas) repete a anterior
        const repete = !repetiu && a.aleatorio(0, 1) < 0.25
        repetiu = repete
        if (!repete) ultima = ultima === 'vertical' ? 'horizontal' : 'vertical'
        orientacao = ultima
      }
      if (orientacao === 'cruz') {
        disparar(a, cfg, 'horizontal', 1)
        disparar(a, cfg, 'vertical', 1)
      } else {
        disparar(a, cfg, orientacao, cfg.quantidade)
      }
    })
  },
})

function disparar(a, cfg, orientacao, quantidade) {
  const l = a.caixa
  const vertical = orientacao === 'vertical'
  const [ini, fim] = vertical ? [l.left, l.right] : [l.top, l.bottom]
  const meia = cfg.espessura / 2
  const faixa = (p) => [p - meia, p + meia]

  // posições sorteadas até sobrar uma faixa livre de pelo menos 3x o coração
  let posicoes = []
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    posicoes = []
    for (let k = 0; k < quantidade; k++) {
      const alvo = k === 0 && cfg.mirar ? a.alvo() : null
      const p = alvo ? (vertical ? alvo.x : alvo.y) : a.aleatorio(ini + meia, fim - meia)
      posicoes.push(Math.min(Math.max(p, ini + meia), fim - meia))
    }
    const livres = lacunasLivres(ini, fim, posicoes.map(faixa))
    if (Math.max(0, ...livres.map(([p, q]) => q - p)) >= a.lacunaMinima) break
  }
  a.parede({ eixo: vertical ? 'x' : 'y', ocupados: posicoes.map(faixa) })

  for (const p of posicoes) {
    const linha = vertical ? { x1: p, y1: l.top, x2: p, y2: l.bottom } : { x1: l.left, y1: p, x2: l.right, y2: p }
    a.aviso({ tipo: 'linha', ...linha, espessura: cfg.espessura, ms: cfg.aviso, estilo: 'pontas' }, () => {
      tocar(a.cena, 'laser')
      a.bala({
        x: vertical ? p : l.centerX,
        y: vertical ? l.centerY : p,
        largura: vertical ? cfg.espessura : l.width + 8,
        altura: vertical ? l.height + 8 : cfg.espessura,
        forma: 'barra',
        vida: cfg.feixe,
        atravessa: true,
        jaAvisada: true,
      })
    })
  }
}
