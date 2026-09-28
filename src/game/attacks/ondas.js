import { definirAtaque } from './definir.js'

// Paredes neon que atravessam a caixa, uma a cada `intervalo` (ritmo fixo),
// com uma abertura que ondula suavemente (seno) para dar tempo de seguir.
// direcao: 'esquerda' | 'direita' (paredes verticais) ou 'baixo' (horizontais)
export default definirAtaque({
  nome: 'ondas',
  padrao: { duracao: 6000, intervalo: 800, velocidade: 130, abertura: 64, amplitude: 40, passo: 0.8, espessura: 10, direcao: 'esquerda' },
  iniciar(a, cfg) {
    const l = a.caixa
    const meia = cfg.abertura / 2
    a.lacuna(cfg.abertura, 'abertura da onda')

    a.aCada(cfg.intervalo, (i) => {
      const onda = Math.sin(i * cfg.passo) * cfg.amplitude

      if (cfg.direcao === 'baixo') {
        const centro = limitar(l.centerX + onda, l.left + meia, l.right - meia)
        const [ini, fim] = [centro - meia, centro + meia]
        a.parede({ eixo: 'x', lacunas: [[ini, fim]] })
        const y = l.top + cfg.espessura / 2
        barra(a, (l.left + ini) / 2, y, ini - l.left, cfg.espessura, 0, cfg.velocidade)
        barra(a, (fim + l.right) / 2, y, l.right - fim, cfg.espessura, 0, cfg.velocidade)
        return
      }

      const sinal = cfg.direcao === 'esquerda' ? -1 : 1
      const centro = limitar(l.centerY + onda, l.top + meia, l.bottom - meia)
      const [ini, fim] = [centro - meia, centro + meia]
      a.parede({ eixo: 'y', lacunas: [[ini, fim]] })
      const x = sinal < 0 ? l.right - cfg.espessura / 2 : l.left + cfg.espessura / 2
      barra(a, x, (l.top + ini) / 2, cfg.espessura, ini - l.top, sinal * cfg.velocidade, 0)
      barra(a, x, (fim + l.bottom) / 2, cfg.espessura, l.bottom - fim, sinal * cfg.velocidade, 0)
    })
  },
})

function barra(a, x, y, largura, altura, vx, vy) {
  if (largura < 1 || altura < 1) return
  a.bala({ x, y, largura, altura, vx, vy, forma: 'barra' })
}

function limitar(v, min, max) {
  return Math.min(Math.max(v, min), max)
}
