// CPU do DUELO (bonus round): decide o joystick e quando atacar do lado da
// CPU na caixa única do duelo (pvp/bonus/Duelo.js). Lógica pura (sem Phaser),
// testável em Node.
//
//   const bot = new BotDuelo({ nivel: 'normal', rng })   rng: () => 0..1
//   todo frame:  const { joy, atacar } = bot.atualizar(dt, estado)
//
// ou direto, sem tempo de reação:  decidir(estado, NIVEIS_DUELO.normal, rng)
//
// estado (montado pelo Duelo a cada frame):
//   eu        { x, y, arma, pronto, velocidade, alcance }
//             pronto: a arma pode atacar agora; alcance: até onde a arma chega
//             (espada: o golpe; tiro: a caixa toda; bumerangue/explosao: distância máxima)
//   inimigo   { x, y, arma, pronto, ko, alcance }
//   limites   { left, right, top, bottom }  (área em que o centro do coração anda)
//   perigos   [{ x, y, vx, vy, raio, desdeMs?, ateMs?, peso? }] o que machuca o bot:
//             círculos andando em linha reta; desdeMs/ateMs = janela em que
//             machucam (bomba: só quando explode); peso multiplica o custo
//   hitbox    raio do coração
//
// Como decide: escolhe uma POSIÇÃO-ALVO conforme a arma (espada: colar no
// inimigo; tiro: meia distância; bumerangue: mais perto; explosao: dentro do
// alcance da bomba e, recarregando, longe), testa 16 direções + ficar parado
// simulando os perigos por `horizonteMs` (como pvp/botEsquiva.js) e fica com
// a mais barata. A mira é automática (Duelo.js): ataca quando a arma está
// pronta e o inimigo está no alcance.
// Os níveis erram de propósito: reagem mais devagar, andam errado, hesitam.

// decidirMs   tempo de reação (reavalia de quanto em quanto tempo)
// horizonteMs quanto à frente enxerga os perigos
// margem      folga (px) além da hitbox que tenta manter dos perigos
// medo        peso dos perigos (fácil liga menos para eles)
// erro        chance, por decisão, de andar numa direção sorteada
// gatilho     chance de atacar quando dá (o resto é hesitação)
// lapso       chance, a cada decisão, de "se distrair" e manter o joystick sem olhar nada
// lapsoMs     por quanto tempo (é o que faz a CPU levar golpes como gente)
export const NIVEIS_DUELO = {
  facil: { decidirMs: 230, horizonteMs: 260, margem: 3, medo: 0.55, erro: 0.18, gatilho: 0.4, lapso: 0.14, lapsoMs: 650 },
  normal: { decidirMs: 140, horizonteMs: 380, margem: 6, medo: 0.85, erro: 0.07, gatilho: 0.7, lapso: 0.07, lapsoMs: 480 },
  dificil: { decidirMs: 75, horizonteMs: 520, margem: 9, medo: 1, erro: 0.02, gatilho: 0.95, lapso: 0.015, lapsoMs: 300 },
}

const PASSO_MS = 40
const DIRECOES = [{ x: 0, y: 0 }, ...Array.from({ length: 16 }, (_, k) => ({ x: Math.cos((k * Math.PI) / 8), y: Math.sin((k * Math.PI) / 8) }))]

const limitar = (v, a, b) => Math.max(a, Math.min(b, v))

// Diferença entre dois ângulos, em -PI..PI
export function difAngulo(a, b) {
  let d = (a - b) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

// Onde o bot quer estar (conforme a arma) -> { x, y }
export function alvoDoBot(estado) {
  const { eu, inimigo, limites, perigos = [] } = estado
  const cx = (limites.left + limites.right) / 2
  const cy = (limites.top + limites.bottom) / 2
  if (!inimigo || inimigo.ko) return { x: cx, y: cy }
  const dentro = (p, folga = 10) => p.x >= limites.left + folga && p.x <= limites.right - folga && p.y >= limites.top + folga && p.y <= limites.bottom - folga
  const prender = (p) => ({ x: limitar(p.x, limites.left, limites.right), y: limitar(p.y, limites.top, limites.bottom) })

  // um ponto a `dist` do inimigo, do meu lado (se cair fora da caixa, do lado oposto)
  const aDistancia = (dist) => {
    const dx = eu.x - inimigo.x
    const dy = eu.y - inimigo.y
    const d = Math.hypot(dx, dy) || 1
    const p = { x: inimigo.x + (dx / d) * dist, y: inimigo.y + (dy / d) * dist }
    return prender(dentro(p) ? p : { x: inimigo.x - (dx / d) * dist, y: inimigo.y - (dy / d) * dist })
  }

  // contra espada, armas de longe ficam mais longe
  const recuo = inimigo.arma === 'espada' && eu.arma !== 'espada' ? 50 : 0
  switch (eu.arma) {
    case 'espada': {
      // cola no inimigo (para um pouco antes, na ponta da lâmina)
      const d = Math.hypot(inimigo.x - eu.x, inimigo.y - eu.y) || 1
      const parar = Math.max(0, d - eu.alcance * 0.6)
      if (!eu.pronto) {
        // recarregando: recua um pouco para não levar o troco
        return prender({ x: eu.x - ((inimigo.x - eu.x) / d) * 40, y: eu.y - ((inimigo.y - eu.y) / d) * 40 })
      }
      return { x: eu.x + ((inimigo.x - eu.x) / d) * parar, y: eu.y + ((inimigo.y - eu.y) / d) * parar }
    }
    case 'tiro':
      return aDistancia(130 + recuo)
    case 'bumerangue':
      return aDistancia(limitar(eu.alcance * 0.6, 80, 150) + recuo * 0.6)
    case 'explosao': {
      // bomba minha no chão: fica longe dela (e do inimigo, deixa ele cair)
      const minha = perigos.find((p) => p.bomba && p.minha)
      if (minha || !eu.pronto) {
        const fonte = minha ?? inimigo
        const dx = eu.x - fonte.x
        const dy = eu.y - fonte.y
        const d = Math.hypot(dx, dy) || 1
        return prender({ x: eu.x + (dx / d) * 90, y: eu.y + (dy / d) * 90 })
      }
      return aDistancia(limitar(eu.alcance * 0.6, 100, 170))
    }
    default:
      return { x: cx, y: cy }
  }
}

// Vale atacar agora? (a mira é automática: basta o inimigo estar no alcance)
export function podeAcertar(estado) {
  const { eu, inimigo } = estado
  if (!inimigo || inimigo.ko || !eu.pronto) return false
  const d = Math.hypot(inimigo.x - eu.x, inimigo.y - eu.y)
  switch (eu.arma) {
    case 'espada':
      return d <= eu.alcance + 10
    case 'tiro':
      return d <= 380
    case 'bumerangue':
    case 'explosao':
      return d <= eu.alcance
    default:
      return false
  }
}

// Custo de estar em (x, y) daqui a `ms` por causa dos perigos
function custoPerigo(perigos, x, y, ms, seguro, hitbox) {
  let custo = 0
  const s = ms / 1000
  for (const p of perigos) {
    if (p.desdeMs != null && ms < p.desdeMs) continue
    if (p.ateMs != null && ms > p.ateMs) continue
    const px = p.x + (p.vx ?? 0) * s
    const py = p.y + (p.vy ?? 0) * s
    const folga = Math.hypot(x - px, y - py) - p.raio
    if (folga < seguro) custo += (seguro - folga) ** 2 * (p.peso ?? 1) * (folga <= hitbox ? 6 : 1)
  }
  return custo
}

// Decisão de um instante (pura): -> { joy: { x, y } (-100..100), atacar }
export function decidir(estado, cfg = NIVEIS_DUELO.normal, rng = Math.random, anterior = null) {
  const { eu, inimigo, limites, perigos = [] } = estado
  const hitbox = estado.hitbox ?? 5
  const parado = { joy: { x: 0, y: 0 }, atacar: false }
  if (!eu) return parado

  const atacar = Boolean(inimigo && !inimigo.ko && podeAcertar(estado) && rng() < cfg.gatilho)
  // espada: avança junto com o golpe (golpe mais fundo)
  if (atacar && eu.arma === 'espada') {
    const d = Math.hypot(inimigo.x - eu.x, inimigo.y - eu.y) || 1
    return { joy: { x: Math.round(((inimigo.x - eu.x) / d) * 100), y: Math.round(((inimigo.y - eu.y) / d) * 100) }, atacar }
  }

  if (rng() < cfg.erro) {
    const d = DIRECOES[1 + Math.floor(rng() * 16)]
    return { joy: { x: Math.round(d.x * 100), y: Math.round(d.y * 100) }, atacar }
  }

  const alvo = alvoDoBot(estado)
  const velocidade = eu.velocidade ?? 180
  const seguro = hitbox + cfg.margem
  const passos = Math.max(1, Math.round(cfg.horizonteMs / PASSO_MS))
  const largura = Math.max(1, limites.right - limites.left)
  const altura = Math.max(1, limites.bottom - limites.top)
  const escala = Math.max(largura, altura)

  let melhor = DIRECOES[0]
  let menor = Infinity
  for (const d of DIRECOES) {
    let x = eu.x
    let y = eu.y
    let custo = 0
    for (let k = 1; k <= passos; k++) {
      x = limitar(x + d.x * velocidade * (PASSO_MS / 1000), limites.left, limites.right)
      y = limitar(y + d.y * velocidade * (PASSO_MS / 1000), limites.top, limites.bottom)
      custo += custoPerigo(perigos, x, y, k * PASSO_MS, seguro, hitbox) * cfg.medo / (1 + k * 0.3)
    }
    // bombas que explodem depois do horizonte: já vai saindo do raio
    for (const p of perigos) {
      if (!p.bomba || p.desdeMs == null || p.desdeMs <= cfg.horizonteMs) continue
      const folga = Math.hypot(x - p.x, y - p.y) - p.raio
      if (folga < seguro) custo += (seguro - folga) * 0.5 * cfg.medo
    }
    // ir para o alvo
    const dist = Math.hypot(alvo.x - x, alvo.y - y) / escala
    custo += dist * dist * 60 + dist * 20
    // paredes: cantos prendem
    const nx = ((x - limites.left) / largura) * 2 - 1
    const ny = ((y - limites.top) / altura) * 2 - 1
    if (Math.abs(nx) > 0.92 || Math.abs(ny) > 0.88) custo += 3
    // menos tremedeira: prefere continuar
    if (anterior && (Math.abs(d.x * 100 - anterior.x) > 1 || Math.abs(d.y * 100 - anterior.y) > 1)) custo += 0.4
    if (custo < menor) {
      menor = custo
      melhor = d
    }
  }
  return { joy: { x: Math.round(melhor.x * 100), y: Math.round(melhor.y * 100) }, atacar }
}

// Com tempo de reação: reavalia a cada cfg.decidirMs; entre uma decisão e
// outra mantém o joystick (o ataque só sai no frame da decisão)
export class BotDuelo {
  constructor({ nivel = 'normal', rng = Math.random } = {}) {
    this.cfg = NIVEIS_DUELO[nivel] ?? NIVEIS_DUELO.normal
    this.rng = rng
    this.espera = 0
    this.joy = { x: 0, y: 0 }
  }

  atualizar(dt, estado) {
    this.espera -= dt
    if (this.espera > 0) return { joy: this.joy, atacar: false }
    // um pouco de variação no tempo de reação
    this.espera = this.cfg.decidirMs * (0.8 + this.rng() * 0.4)
    // distraído: segue com o mesmo joystick por um tempo
    if (this.rng() < (this.cfg.lapso ?? 0)) {
      this.espera = this.cfg.lapsoMs
      return { joy: this.joy, atacar: false }
    }
    const r = decidir(estado, this.cfg, this.rng, this.joy)
    this.joy = r.joy
    return r
  }
}
