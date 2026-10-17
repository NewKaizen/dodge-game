// Esquiva da CPU no PvP: devolve o "joystick" ({ x, y } de -100 a 100) que
// move o coração do bot na pista dele. Lógica pura (sem Phaser).
//
//   const esquiva = new EsquivaBot({ nivel: 'normal' })
//   todo frame:  joy = esquiva.joy(dt, { coracao, limites, balas, zonas, velocidade, fatorVelocidade, velocidadeMax, invertido })
//
// A cada `decidirMs` o bot testa 16 direções e ficar parado: simula as balas
// em linha reta (com aceleração) por `horizonteMs` e dá nota a cada caminho
// pelo quanto ele passa perto delas (perigo agora pesa mais que perigo
// depois), mais um empurrão leve para longe das paredes e para o centro.
// Balas ainda telegrafando ficam paradas e só contam depois do aviso. Balas
// com `arranque` (espiam devagar na borda e depois disparam) são previstas
// já com o disparo.
//
// O bot também LÊ OS AVISOS (o vermelho na tela), como quem joga: as zonas de
// perigo (attacks/zonas.js: a.aviso, a.zonaPerigo, eventos do bônus) e o
// caminho das balas que ainda estão piscando. Terminar o caminho dentro de
// uma zona que vai valer custa mais quanto menos tempo sobra para sair dela
// (e quanto mais fundo se está); zona já valendo pesa como bala. Assim ele
// sai com antecedência pela borda mais perto. Se tudo é perigo, fica com o
// caminho menos ruim (a nota é contínua, nunca trava).
// Os níveis erram de propósito: reagem mais devagar, enxergam menos à frente
// e às vezes escolhem uma direção qualquer; os avisos, o fácil nota tarde e
// só os que estão para estourar, o difícil vê cedo.
//
// coracao: { x, y, hitbox }   limites: { left, right, top, bottom }
// balas: lista de Bullets.js (usa tipo, x, y, vx, vy, ax, ay, raio, largura,
//        altura, comprimento, espessura, angulo, girar, idade, aviso, arranque, inofensiva, morta)
// zonas: lista de zonas de perigo (pista.balas.zonas; ver attacks/zonas.js), opcional
import { folgaZona } from '../attacks/zonas.js'

// decidirMs   de quanto em quanto tempo reavalia (tempo de reação)
// horizonteMs quanto à frente simula
// margem      folga extra (px) além da hitbox que o bot tenta manter
// erro        chance de, numa decisão, ir para uma direção sorteada
// confusao    controles invertidos: chance extra de errar (o bot também se atrapalha)
// adaptaMs    a inversão dura o ataque inteiro: em tanto tempo a confusão cai
//             até CONFUSAO_RESIDUAL dela (o bot "se acostuma", como gente)
// lapso       chance, a cada decisão, de "se distrair" e seguir na mesma direção
// lapsoMs     por quanto tempo (é o que faz a CPU tomar dano como gente)
// avisos (zonas de perigo e balas piscando):
//   reacaoMs   quanto tempo um aviso precisa estar na tela para o bot notar
//   visaoMs    só liga para avisos que valem em até tanto tempo (o resto ainda "não é com ele")
//   peso       quanto o bot respeita o aviso (o fácil arrisca ficar na beirada)
const NIVEIS_ESQUIVA = {
  facil: { decidirMs: 200, horizonteMs: 240, margem: 2, erro: 0.25, confusao: 0.4, adaptaMs: 4000, lapso: 0.1, lapsoMs: 650, avisos: { reacaoMs: 320, visaoMs: 500, peso: 0.5 } },
  normal: { decidirMs: 130, horizonteMs: 330, margem: 5, erro: 0.1, confusao: 0.25, adaptaMs: 2500, lapso: 0.05, lapsoMs: 500, avisos: { reacaoMs: 200, visaoMs: 800, peso: 0.8 } },
  dificil: { decidirMs: 70, horizonteMs: 520, margem: 9, erro: 0.02, confusao: 0.08, adaptaMs: 1500, lapso: 0.008, lapsoMs: 300, avisos: { reacaoMs: 90, visaoMs: 1300, peso: 1 } },
}
const CONFUSAO_RESIDUAL = 0.35

const PASSO_MS = 35 // passo da simulação
const MEIO = 8 // metade do coração (CORACAO.tamanho / 2): o centro não passa daqui na parede
const CAMINHO_PISCANDO_MS = 350 // quanto do caminho de uma bala piscando o bot evita (ms depois de sair)
const FOLGA_URGENCIA_MS = 160 // folga (ms além do necessário para sair) em que a urgência cai à metade
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
  if (b.arranque) {
    // anda devagar até o arranque e dali na velocidade (e aceleração) nova
    const ate = Math.max(0, Math.min(s, (b.arranque.ms - Math.max(0, (b.idade ?? 0) - (b.aviso ?? 0))) / 1000))
    const depois = s - ate
    const { vx: avx, vy: avy, ax: aax = 0, ay: aay = 0 } = b.arranque
    let dx = avx * depois + 0.5 * aax * depois * depois
    let dy = avy * depois + 0.5 * aay * depois * depois
    const media = depois > 0 ? (Math.hypot(dx, dy) / depois) * fator : 0
    if (media > vmax) {
      // teto de velocidade no disparo
      dx *= vmax / media
      dy *= vmax / media
    }
    const x = b.x + ((b.vx ?? 0) * ate + dx) * fator
    const y = b.y + ((b.vy ?? 0) * ate + dy) * fator
    return { x, y, angulo: b.angulo ?? 0 }
  }
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

// Zona de perigo do caminho de uma bala que ainda pisca: ela vai passar por
// ali logo depois do aviso (parada: a própria bala). Mesma forma das zonas.
export function zonaDaBalaPiscando(b, fator = 1) {
  const espera = (b.aviso ?? 0) - (b.idade ?? 0)
  if (b.morta || b.inofensiva || espera <= 0) return null
  const tempo = { falta: espera, idade: b.idade ?? 0, dura: CAMINHO_PISCANDO_MS }
  const s = CAMINHO_PISCANDO_MS / 1000
  const dx = (b.vx ?? 0) * fator * s + 0.5 * (b.ax ?? 0) * fator * s * s
  const dy = (b.vy ?? 0) * fator * s + 0.5 * (b.ay ?? 0) * fator * s * s
  if (b.tipo === 'segmento') {
    const cx = Math.cos(b.angulo ?? 0) * (b.comprimento / 2)
    const cy = Math.sin(b.angulo ?? 0) * (b.comprimento / 2)
    // lâmina parada: a própria lâmina; andando: o meio dela arrastado (largura = a lâmina)
    if (Math.hypot(dx, dy) < 4) return { tipo: 'segmento', x1: b.x - cx, y1: b.y - cy, x2: b.x + cx, y2: b.y + cy, meia: (b.espessura ?? 8) / 2, ...tempo }
    return { tipo: 'segmento', x1: b.x, y1: b.y, x2: b.x + dx, y2: b.y + dy, meia: b.comprimento / 2, ...tempo }
  }
  const meia = b.tipo === 'circulo' ? (b.raio ?? 6) : Math.max(b.largura ?? 0, b.altura ?? 0) / 2
  return { tipo: 'segmento', x1: b.x, y1: b.y, x2: b.x + dx, y2: b.y + dy, meia, ...tempo }
}

// Custo de terminar o caminho em (x, y) daqui a `ms`, com zonas que ainda
// vão valer: quanto mais fundo e menos tempo para sair, pior. velocidade em px/s.
export function custoZonaPendente(z, x, y, { ms, seguro, velocidade, reacaoMs = 0 }) {
  const fundo = seguro - folgaZona(z, x, y)
  if (fundo <= 0) return 0
  const sobra = z.falta - ms // ms até valer, contados do fim do caminho
  if (sobra <= 0) return 0 // já vale no fim do caminho: conta como bala (custoZonaAtiva)
  const sair = (fundo / Math.max(1, velocidade)) * 1000 + reacaoMs
  const folga = sobra - sair
  const urgencia = folga <= 0 ? 1.5 : 1 / (1 + (folga / FOLGA_URGENCIA_MS) ** 2)
  return fundo * fundo * urgencia
}

export class EsquivaBot {
  constructor({ nivel = 'normal', sorte = Math.random } = {}) {
    this.cfg = NIVEIS_ESQUIVA[nivel] ?? NIVEIS_ESQUIVA.normal
    this.sorte = sorte
    this.espera = 0
    this.direcao = { x: 0, y: 0 }
    this.tempoInvertido = 0 // ms seguidos com os controles invertidos
  }

  // reinicia entre rodadas (o bot não "lembra" a direção da rodada anterior)
  reiniciar() {
    this.espera = 0
    this.direcao = { x: 0, y: 0 }
    this.tempoInvertido = 0
  }

  // chance extra de errar agora por causa da inversão (cai com o tempo invertido)
  confusaoAgora() {
    const adapta = this.cfg.adaptaMs ?? 0
    const p = adapta > 0 ? Math.min(1, this.tempoInvertido / adapta) : 0
    return this.cfg.confusao * (1 - p * (1 - CONFUSAO_RESIDUAL))
  }

  joy(dt, situacao) {
    this.tempoInvertido = situacao.invertido ? this.tempoInvertido + dt : 0
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

  // Avisos que o bot enxerga agora: zonas registradas e caminhos de balas
  // piscando que só valem depois do horizonte (antes disso a simulação das
  // balas já cuida delas). Filtrados pela reação e pela visão do nível.
  avisosVisiveis(zonas, balas, fatorVelocidade) {
    const av = this.cfg.avisos
    if (!av) return []
    const vistas = []
    const ve = (z) => z && z.idade >= av.reacaoMs && z.falta <= av.visaoMs && z.falta > -z.dura
    for (const z of zonas ?? []) if (!z.cancelada && ve(z)) vistas.push(z)
    for (const b of balas) {
      if ((b.aviso ?? 0) - (b.idade ?? 0) <= this.cfg.horizonteMs) continue
      const z = zonaDaBalaPiscando(b, fatorVelocidade)
      if (ve(z)) vistas.push(z)
    }
    return vistas
  }

  decidir({ coracao, limites, balas, zonas, velocidade = 180, fatorVelocidade = 1, velocidadeMax = Infinity, invertido = false }) {
    const chanceErro = this.cfg.erro + (invertido ? this.confusaoAgora() : 0)
    if (this.sorte() < chanceErro) return DIRECOES[1 + Math.floor(this.sorte() * 16)]
    const ativas = balas.filter((b) => !b.morta && !b.inofensiva)
    const hitbox = coracao.hitbox ?? 5
    const seguro = hitbox + this.cfg.margem
    const passos = Math.max(1, Math.round(this.cfg.horizonteMs / PASSO_MS))
    const avisos = this.avisosVisiveis(zonas, ativas, fatorVelocidade)
    const pesoAviso = this.cfg.avisos?.peso ?? 0
    const fimMs = passos * PASSO_MS
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
          if (folga < seguro) custo += (seguro - folga) ** 2 * peso * (folga <= hitbox ? 6 : 1)
        }
        // zona que já vale neste passo: igual a uma bala (só que pode ser bem mais funda)
        const ms = (k + 1) * PASSO_MS
        for (const z of avisos) {
          if (z.falta > ms || z.falta <= ms - z.dura) continue
          const folga = folgaZona(z, x, y)
          if (folga < seguro) custo += (seguro - folga) ** 2 * peso * (folga <= hitbox ? 6 : 1) * pesoAviso
        }
      }
      // zonas que ainda vão valer: quanto custa estar aqui no fim do caminho
      for (const z of avisos) custo += custoZonaPendente(z, x, y, { ms: fimMs, seguro, velocidade, reacaoMs: this.cfg.decidirMs }) * 2 * pesoAviso
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
