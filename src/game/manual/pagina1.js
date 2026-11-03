import { CORACAO } from '../constants.js'

// Página 1 do Manual do Ralsei, "Este é o seu coração" (+ um gostinho da página 2):
// a máquina de estados e as regras, SEM Phaser (testada em __tests__/pagina1.test.js). A cena
// (scenes/ManualRalsei.js) só desenha em cima disto e repassa o joystick e o botão A.
//
//   intro -> desenhando -> marcas -> desviar -> (tentarDeNovo -> desviar)* -> concluida -> virando -> fim
//
//   intro        Ralsei fala (FALAS_INTRO); A passa para a próxima fala
//   desenhando   o giz desenha a caixa, o coração e as marcas (progresso em p.desenho); sozinho
//   marcas       o jogador leva o coração até as 3 marcas (qualquer ordem)
//   desviar      PREPARO_MS de aviso e depois as balas lentas; sobreviver SOBREVIVER_MS
//   tentarDeNovo acertou: fala de incentivo e recomeça SÓ a parte das balas (RETRY_MS, ou A)
//   concluida    adesivo "PÁGINA 1 ✓"; A vira a página
//   virando      a cena anima a virada e chama p.terminouDeVirar()
//   fim          página 2 ainda não existe ("continua…")
//
// REGRAS REAIS: o movimento do coração é o de entities/Heart.js (vetor limitado a 1, velocidade em px/s,
// preso à caixa) e o acerto é o de entities/Bullets.js (folga = distância ao centro - raio; acerta se
// folga <= CORACAO.hitbox). O desenho de giz (manual/giz.js) NUNCA entra aqui: o tremor do traço não
// muda onde a bala acerta.

export const ETAPAS = ['intro', 'desenhando', 'marcas', 'desviar', 'tentarDeNovo', 'concluida', 'virando', 'fim']

export const FALAS_INTRO = [
  'Olá! Eu sou o Ralsei. Fiz este manualzinho à mão, só para você.',
  'Este é o seu coração. É ele que você move. Só o miolo dele leva dano.',
  'Vou desenhar a caixa onde ele vive. Lá dentro, quem manda é você!',
]

export const SOBREVIVER_MS = 8000
export const PREPARO_MS = 1100
export const RETRY_MS = 1000
export const DESENHO_MS = { caixa: [0, 1300], coracao: [1100, 2000], marcas: [1800, 2500], total: 2700 }
export const RAIO_MARCA = 15 // distância (centro do coração até o centro da marca) que conta como "chegou"
export const RAIO_BALA = 8

export const INCENTIVOS = [
  'Quase! Tenta de novo?',
  'Foi por pouco! Vamos de novo?',
  'Sem pressa. Só a parte das bolinhas: de novo?',
  'Dica: ande para o lado quando uma vier na sua direção.',
  'Você está pegando o jeito. Mais uma vez?',
]

// onde ficam as marcas, em fração da caixa (esquerda->direita, cima->baixo)
export const MARCAS = [
  { fx: 0.2, fy: 0.3, forma: 'estrela' },
  { fx: 0.8, fy: 0.3, forma: 'x' },
  { fx: 0.5, fy: 0.8, forma: 'estrela' },
]

// as 6 balas: quando nascem (ms depois do fim do preparo), por qual lado, em que fração da borda,
// velocidade (px/s) e se miram no coração (mira = direção fixada no nascimento, nunca persegue)
export const BALAS = [
  { t: 0, lado: 'esq', f: 0.3, v: 78, mira: false },
  { t: 1200, lado: 'dir', f: 0.7, v: 82, mira: true },
  { t: 2400, lado: 'cima', f: 0.3, v: 76, mira: false },
  { t: 3500, lado: 'baixo', f: 0.72, v: 80, mira: true },
  { t: 4600, lado: 'esq', f: 0.65, v: 84, mira: true },
  { t: 5700, lado: 'dir', f: 0.32, v: 80, mira: false },
]

// Movimento do Heart.update: joy -100..100, vetor limitado a 1 (diagonal não é mais rápida), preso à caixa
export function moverCoracao(coracao, joy, velocidade, dt, caixa, meio = CORACAO.tamanho / 2) {
  let dx = (joy?.x ?? 0) / 100
  let dy = (joy?.y ?? 0) / 100
  const m = Math.hypot(dx, dy)
  if (m > 1) {
    dx /= m
    dy /= m
  }
  const passo = velocidade * (dt / 1000)
  coracao.x = Math.min(Math.max(coracao.x + dx * passo, caixa.esquerda + meio), caixa.direita - meio)
  coracao.y = Math.min(Math.max(coracao.y + dy * passo, caixa.topo + meio), caixa.base - meio)
}

// folga de uma bala redonda ao ponto (Balas.folga): negativa = o ponto está dentro dela
export const folgaDaBala = (b, px, py) => Math.hypot(px - b.x, py - b.y) - b.raio

// A bala acerta o miolo do coração? (Balas.tocar: só vale com a bala já na caixa)
export const balaAcerta = (b, coracao, hitbox = CORACAO.hitbox) => folgaDaBala(b, coracao.x, coracao.y) <= hitbox

// A bala inteira ainda está fora da caixa? (Balas.foraDaCaixa, para o círculo)
export const balaFora = (b, caixa) => b.x + b.raio < caixa.esquerda || b.x - b.raio > caixa.direita || b.y + b.raio < caixa.topo || b.y - b.raio > caixa.base

// A marca foi alcançada pelo centro do coração?
export const marcaAlcancada = (m, coracao, raio = RAIO_MARCA) => Math.hypot(coracao.x - m.x, coracao.y - m.y) <= raio

export const fatorAssistencia = (falhas) => Math.max(0.6, 1 - 0.1 * falhas) // depois de errar, as balas ficam um pouco mais lentas

const faixa = (t, [a, b]) => Math.min(1, Math.max(0, (t - a) / (b - a)))

export function criarPagina1({ caixa, velocidade = CORACAO.velocidadePadrao, hitbox = CORACAO.hitbox } = {}) {
  const cx = (caixa.esquerda + caixa.direita) / 2
  const cy = (caixa.topo + caixa.base) / 2
  const larg = caixa.direita - caixa.esquerda
  const alt = caixa.base - caixa.topo

  const p = {
    caixa,
    velocidade,
    hitbox,
    etapa: 'intro',
    falaIdx: 0,
    tempoEtapa: 0,
    desenho: { caixa: 0, coracao: 0, marcas: 0 },
    coracao: { x: cx, y: cy },
    marcas: MARCAS.map((m) => ({ x: caixa.esquerda + m.fx * larg, y: caixa.topo + m.fy * alt, forma: m.forma, pega: false })),
    balas: [],
    decorrido: 0, // ms de desvio já sobrevividos (depois do preparo)
    proxima: 0, // índice da próxima bala a nascer
    falhas: 0,
    tentativa: 1,
    eventos: [],

    // A (ou qualquer "avançar" manual). Devolve true se mudou algo.
    avancar() {
      if (p.etapa === 'intro') {
        if (p.falaIdx < FALAS_INTRO.length - 1) {
          p.falaIdx++
          p.eventos.push({ tipo: 'fala' })
        } else irPara('desenhando')
        return true
      }
      if (p.etapa === 'tentarDeNovo') {
        p.reiniciarDesvio()
        return true
      }
      if (p.etapa === 'concluida') {
        irPara('virando')
        return true
      }
      return false
    },

    terminouDeVirar() {
      if (p.etapa === 'virando') irPara('fim')
    },

    reiniciarDesvio() {
      p.balas = []
      p.decorrido = 0
      p.proxima = 0
      p.tentativa++
      p.coracao.x = cx
      p.coracao.y = cy
      irPara('desviar')
    },

    // dt em ms, joy do jogador (-100..100)
    tick(dt, joy) {
      dt = Math.min(Math.max(dt, 0), 50)
      p.tempoEtapa += dt
      if (p.etapa === 'desenhando') {
        p.desenho.caixa = faixa(p.tempoEtapa, DESENHO_MS.caixa)
        p.desenho.coracao = faixa(p.tempoEtapa, DESENHO_MS.coracao)
        p.desenho.marcas = faixa(p.tempoEtapa, DESENHO_MS.marcas)
        if (p.tempoEtapa >= DESENHO_MS.total) irPara('marcas')
      } else if (p.etapa === 'marcas') {
        moverCoracao(p.coracao, joy, p.velocidade, dt, caixa)
        p.marcas.forEach((m, i) => {
          if (m.pega || !marcaAlcancada(m, p.coracao)) return
          m.pega = true
          p.eventos.push({ tipo: 'marca', indice: i, total: p.marcas.filter((x) => x.pega).length })
        })
        if (p.marcas.every((m) => m.pega)) irPara('desviar')
      } else if (p.etapa === 'desviar') {
        moverCoracao(p.coracao, joy, p.velocidade, dt, caixa)
        const emJogo = p.tempoEtapa > PREPARO_MS
        if (emJogo) {
          p.decorrido += dt
          while (p.proxima < BALAS.length && p.decorrido >= BALAS[p.proxima].t) nascer(BALAS[p.proxima++])
        }
        andarBalas(dt)
        if (emJogo && p.balas.some((b) => !balaFora(b, caixa) && balaAcerta(b, p.coracao, p.hitbox))) {
          p.falhas++
          p.eventos.push({ tipo: 'acerto', falhas: p.falhas })
          irPara('tentarDeNovo')
        } else if (p.decorrido >= SOBREVIVER_MS) {
          p.balas = []
          irPara('concluida')
        }
      } else if (p.etapa === 'tentarDeNovo') {
        if (p.tempoEtapa >= RETRY_MS) p.reiniciarDesvio()
      }
    },

    // fração 0..1 do desvio já sobrevivido (a barra de progresso)
    get progressoDesvio() {
      return Math.min(1, p.decorrido / SOBREVIVER_MS)
    },
    get marcasPegas() {
      return p.marcas.filter((m) => m.pega).length
    },
    get fala() {
      return falaDaEtapa(p)
    },
    drenar() {
      const e = p.eventos
      p.eventos = []
      return e
    },
  }

  function irPara(etapa) {
    p.etapa = etapa
    p.tempoEtapa = 0
    p.eventos.push({ tipo: 'etapa', etapa })
    if (etapa === 'desenhando') p.desenho = { caixa: 0, coracao: 0, marcas: 0 }
    if (etapa === 'marcas') p.desenho = { caixa: 1, coracao: 1, marcas: 1 }
  }

  function nascer(def) {
    const folga = RAIO_BALA + 2
    const f = fatorAssistencia(p.falhas)
    let x
    let y
    let dx
    let dy
    if (def.lado === 'esq' || def.lado === 'dir') {
      x = def.lado === 'esq' ? caixa.esquerda - folga : caixa.direita + folga
      y = caixa.topo + def.f * alt
      dx = def.lado === 'esq' ? 1 : -1
      dy = 0
    } else {
      x = caixa.esquerda + def.f * larg
      y = def.lado === 'cima' ? caixa.topo - folga : caixa.base + folga
      dx = 0
      dy = def.lado === 'cima' ? 1 : -1
    }
    if (def.mira) {
      const mx = p.coracao.x - x
      const my = p.coracao.y - y
      const m = Math.hypot(mx, my) || 1
      dx = mx / m
      dy = my / m
    }
    p.balas.push({ x, y, vx: dx * def.v * f, vy: dy * def.v * f, raio: RAIO_BALA, semente: p.balas.length + p.proxima * 7 })
  }

  function andarBalas(dt) {
    for (const b of p.balas) {
      b.x += b.vx * (dt / 1000)
      b.y += b.vy * (dt / 1000)
    }
    // some quando passou bem do outro lado
    p.balas = p.balas.filter((b) => b.x > caixa.esquerda - 60 && b.x < caixa.direita + 60 && b.y > caixa.topo - 60 && b.y < caixa.base + 60)
  }

  return p
}

// o texto do balão de fala do Ralsei agora (uma instrução de cada vez)
export function falaDaEtapa(p) {
  switch (p.etapa) {
    case 'intro':
      return FALAS_INTRO[p.falaIdx]
    case 'desenhando':
      return 'Deixa eu rabiscar aqui… a caixa… e o seu coração!'
    case 'marcas':
      return `Leve o coração até as marcas. Faltam ${p.marcas.length - p.marcasPegas}!`
    case 'desviar':
      return `Agora desvie das bolinhas por ${SOBREVIVER_MS / 1000} segundos!`
    case 'tentarDeNovo':
      return INCENTIVOS[(p.falhas - 1) % INCENTIVOS.length]
    case 'concluida':
    case 'virando':
      return 'Você conseguiu! A página 1 está completa.'
    default:
      return 'Esta página ainda não foi desenhada… continua!'
  }
}
