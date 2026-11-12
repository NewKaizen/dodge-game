// Previsão de movimento do coração, para os SUPERs que miram "para onde ele
// vai" (e não só onde ele está): quem só fica rodando em círculo ou foge em
// linha reta cai na mira. Tudo determinístico: não gasta número da semente.

// Ponto onde o coração estará daqui a `ms`, se mantiver a velocidade de agora.
// O deslocamento é limitado a `maxDist` px e o ponto fica dentro da caixa
// (com `margem`), então a mira nunca sai do alcance de quem está jogando.
export function projetar(ponto, vel, ms, limites, { maxDist = 56, margem = 10 } = {}) {
  let dx = (vel?.vx ?? 0) * (ms / 1000)
  let dy = (vel?.vy ?? 0) * (ms / 1000)
  const d = Math.hypot(dx, dy)
  if (d > maxDist) {
    dx *= maxDist / d
    dy *= maxDist / d
  }
  return {
    x: Math.min(Math.max(ponto.x + dx, limites.left + margem), limites.right - margem),
    y: Math.min(Math.max(ponto.y + dy, limites.top + margem), limites.bottom - margem),
  }
}

// Acompanha a velocidade (px/s, suavizada) de cada coração durante o ataque.
// `prever(ponto, ms)` acha o coração mais perto de `ponto` (normalmente o que
// veio de a.alvo()) e devolve onde ele estará daqui a `ms`.
export function criarPrevisao(a, opcoes) {
  const estado = new Map()
  a.aoAtualizar((dt) => {
    const s = Math.max(1, dt) / 1000
    for (const c of a.coracoes) {
      if (!c.ativo) continue
      const e = estado.get(c) ?? { x: c.x, y: c.y, vx: 0, vy: 0 }
      const k = Math.min(1, dt / 120) // média curta: acompanha a virada sem tremer
      e.vx += ((c.x - e.x) / s - e.vx) * k
      e.vy += ((c.y - e.y) / s - e.vy) * k
      e.x = c.x
      e.y = c.y
      estado.set(c, e)
    }
  })
  return {
    velocidade(ponto) {
      let melhor = null
      let d = Infinity
      for (const c of a.coracoes) {
        const e = c.ativo && estado.get(c)
        if (!e) continue
        const dc = Math.hypot(c.x - ponto.x, c.y - ponto.y)
        if (dc < d) {
          d = dc
          melhor = e
        }
      }
      return melhor ? { vx: melhor.vx, vy: melhor.vy } : { vx: 0, vy: 0 }
    },
    prever(ponto, ms) {
      return projetar(ponto, this.velocidade(ponto), ms, a.caixa, opcoes)
    },
  }
}
