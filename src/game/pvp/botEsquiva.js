// Esquiva da CPU no PvP: devolve o "joystick" ({ x, y } de -100 a 100) que
// move o coração do bot na pista dele. Lógica pura (sem Phaser).
//
//   const esquiva = new EsquivaBot({ nivel: 'normal' })
//   todo frame:  joy = esquiva.joy(dt, { coracao, limites, balas, velocidade, fatorVelocidade, velocidadeMax, invertido })
//
// A cada `decidirMs` o bot testa 16 direções e ficar parado: simula as balas
// em linha reta (com aceleração) por `horizonteMs` e dá nota a cada caminho
// pelo quanto ele passa perto delas (perigo agora pesa mais que perigo
// depois), mais um empurrão leve para longe das paredes e para o centro.
// Balas ainda telegrafando ficam paradas e só contam depois do aviso.
// Os níveis erram de propósito: reagem mais devagar, enxergam menos à frente
// e às vezes escolhem uma direção qualquer.
//
// coracao: { x, y, hitbox }   limites: { left, right, top, bottom }
// balas: lista de Bullets.js (usa tipo, x, y, vx, vy, ax, ay, raio, largura,
//        altura, comprimento, espessura, angulo, girar, idade, aviso, inofensiva, morta)

// decidirMs   de quanto em quanto tempo reavalia (tempo de reação)
// horizonteMs quanto à frente simula
// margem      folga extra (px) além da hitbox que o bot tenta manter
// erro        chance de, numa decisão, ir para uma direção sorteada
// confusao    controles invertidos: chance extra de errar (o bot também se atrapalha)
// lapso       chance, a cada decisão, de "se distrair" e seguir na mesma direção
// lapsoMs     por quanto tempo (é o que faz a CPU tomar dano como gente)
export const NIVEIS_ESQUIVA = {
  facil: { decidirMs: 200, horizonteMs: 240, margem: 2, erro: 0.25, confusao: 0.4, lapso: 0.1, lapsoMs: 650 },
  normal: { decidirMs: 130, horizonteMs: 330, margem: 5, erro: 0.1, confusao: 0.25, lapso: 0.05, lapsoMs: 500 },
  dificil: { decidirMs: 70, horizonteMs: 520, margem: 9, erro: 0.02, confusao: 0.08, lapso: 0.008, lapsoMs: 300 },
}

const PASSO_MS = 35 // passo da simulação
const MEIO = 8 // metade do coração (CORACAO.tamanho / 2): o centro não passa daqui na parede
const DIRECOES = [{ x: 0, y: 0 }, ...Array.from({ length: 16 }, (_, k) => ({ x: Math.cos((k * Math.PI) / 8), y: Math.sin((k * Math.PI) / 8) }))]

// Distância entre um ponto e a borda da bala (negativa = dentro). Igual a Balas.folga.
export function folgaBala(b, px, py, x = b.x, y = b.y, angulo = b.angulo) {
  if (b.tipo === 'circulo') return Math.hypot(px - x, py - y) - b.raio
  if (b.tipo === 'retangulo') {
    const dx = Math.max(Math.abs(px - x) - b.largura / 2, 0)
    const dy = Math.max(Math.abs(py - y) - b.altura / 2, 0)
    return Math.hypot(dx, dy)
  }
  const cos = Math.cos(angulo)
  const sin = Math.sin(angulo)
  const rx = px - x
  const ry = py - y
  const t = Math.max(-b.comprimento / 2, Math.min(b.comprimento / 2, rx * cos + ry * sin))
  return Math.hypot(rx - t * cos, ry - t * sin) - b.espessura / 2
}

// Posição da bala daqui a `ms` (null se ainda não vale ou já não machuca)
function preverBala(b, ms, fator, vmax) {
  if (b.morta || b.inofensiva) return null
  const espera = Math.max(0, (b.aviso ?? 0) - (b.idade ?? 0))
  if (ms < espera) return null // ainda telegrafando: inofensiva
  const s = (ms - Math.max(0, espera)) / 1000
  const vx0 = (b.vx ?? 0) * fator
  const vy0 = (b.vy ?? 0) * fator
  const ax = (b.ax ?? 0) * fator
  const ay = (b.ay ?? 0) * fator
  let vx = vx0 + ax * s
  let vy = vy0 + ay * s
  const v = Math.hypot(vx, vy)
  // teto de velocidade: aproxima andando na velocidade média limitada
  let dx = vx0 * s + 0.5 * ax * s * s
  let dy = vy0 * s + 0.5 * ay * s * s
  if (v > vmax && s > 0) {
    const media = Math.hypot(dx, dy) / s
    if (media > vmax) {
      dx *= vmax / media
      dy *= vmax / media
    }
  }
  return { x: b.x + dx, y: b.y + dy, angulo: (b.angulo ?? 0) + (b.tipo === 'segmento' ? (b.girar ?? 0) * s : 0) }
}

export class EsquivaBot {
  constructor({ nivel = 'normal', sorte = Math.random } = {}) {
    this.cfg = NIVEIS_ESQUIVA[nivel] ?? NIVEIS_ESQUIVA.normal
    this.sorte = sorte
    this.espera = 0
    this.direcao = { x: 0, y: 0 }
  }

  // reinicia entre rodadas (o bot não "lembra" a direção da rodada anterior)
  reiniciar() {
    this.espera = 0
    this.direcao = { x: 0, y: 0 }
  }

  joy(dt, situacao) {
    this.espera -= dt
    if (this.espera <= 0) {
      this.espera = this.cfg.decidirMs
      // distraído: mantém a direção de antes por um tempo, sem olhar as balas
      if (this.sorte() < this.cfg.lapso) this.espera = this.cfg.lapsoMs
      else this.direcao = this.decidir(situacao)
    }
    let { x, y } = this.direcao
    // a arena inverte o joystick do dono da pista: o bot compensa (quando não se atrapalha)
    if (situacao.invertido) {
      x = -x
      y = -y
    }
    return { x: Math.round(x * 100), y: Math.round(y * 100) }
  }

  decidir({ coracao, limites, balas, velocidade = 180, fatorVelocidade = 1, velocidadeMax = Infinity, invertido = false }) {
    const chanceErro = this.cfg.erro + (invertido ? this.cfg.confusao : 0)
    if (this.sorte() < chanceErro) return DIRECOES[1 + Math.floor(this.sorte() * 16)]
    const ativas = balas.filter((b) => !b.morta && !b.inofensiva)
    const seguro = (coracao.hitbox ?? 5) + this.cfg.margem
    const passos = Math.max(1, Math.round(this.cfg.horizonteMs / PASSO_MS))
    const cx = (limites.left + limites.right) / 2
    const cy = (limites.top + limites.bottom) / 2
    const meiaLargura = Math.max(1, (limites.right - limites.left) / 2 - MEIO)
    const meiaAltura = Math.max(1, (limites.bottom - limites.top) / 2 - MEIO)

    // previsão das balas em cada passo (a mesma para todas as direções)
    const previsoes = []
    for (let k = 1; k <= passos; k++) {
      const ms = k * PASSO_MS
      previsoes.push(ativas.map((b) => [b, preverBala(b, ms, fatorVelocidade, velocidadeMax)]).filter(([, p]) => p))
    }

    let melhor = DIRECOES[0]
    let menor = Infinity
    for (const d of DIRECOES) {
      let x = coracao.x
      let y = coracao.y
      let custo = 0
      for (let k = 0; k < passos; k++) {
        x = Math.max(limites.left + MEIO, Math.min(limites.right - MEIO, x + d.x * velocidade * (PASSO_MS / 1000)))
        y = Math.max(limites.top + MEIO, Math.min(limites.bottom - MEIO, y + d.y * velocidade * (PASSO_MS / 1000)))
        const peso = 1 / (1 + k * 0.35) // perigo próximo pesa mais
        for (const [b, p] of previsoes[k]) {
          const folga = folgaBala(b, x, y, p.x, p.y, p.angulo)
          if (folga < seguro) custo += (seguro - folga) ** 2 * peso * (folga <= (coracao.hitbox ?? 5) ? 6 : 1)
        }
      }
      // fim do caminho: longe das paredes e perto do centro (mais espaço para fugir depois)
      const nx = (x - cx) / meiaLargura
      const ny = (y - cy) / meiaAltura
      custo += (nx * nx + ny * ny) * 4
      if (Math.abs(nx) > 0.85 || Math.abs(ny) > 0.85) custo += 10
      // leve preferência por continuar o movimento (menos tremedeira)
      if (d.x !== this.direcao.x || d.y !== this.direcao.y) custo += 0.5
      if (custo < menor) {
        menor = custo
        melhor = d
      }
    }
    return melhor
  }
}
