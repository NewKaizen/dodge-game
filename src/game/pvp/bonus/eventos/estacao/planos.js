// Regras PURAS (sem Phaser) das 8 rodadas bônus da ESTAÇÃO ESPACIAL: SEM ATRITO, BURACO DE MINHOCA, RADAR,
// ÓRBITA, POLARIDADE, OXIGÊNIO, RAIO TRATOR e MANUTENÇÃO. Cada evento do jogo (semAtrito.js, minhoca.js...)
// só desenha e liga estas contas ao coração e às balas; o que precisa ser justo e repetível pela semente
// (tempos, posições, forças, quem tem polaridade) está aqui e é testado em __tests__/eventosEstacao.test.js.
//
// Convenções: ms para tempo, px para distância, "joy" = unidades do joystick (-100..100: 100 = a velocidade
// normal do coração), `sorte` = () => 0..1 (o rng da rodada, igual nos dois PCs em rede).

export const REF_CAIXA = { largura: 220, altura: 170 }

const entre = (sorte, a, b) => a + sorte() * (b - a)
const limitar = (v, min, max) => Math.max(min, Math.min(max, v))
const DOIS_PI = Math.PI * 2
const mod = (a) => ((a % DOIS_PI) + DOIS_PI) % DOIS_PI

// ---------- 1. SEM ATRITO ----------
// O joystick vira EMPUXO: o coração ganha velocidade e continua deslizando (arrasto quase nulo). Frear é
// empurrar no sentido contrário. Velocidade máxima um pouco abaixo da normal. Nas paredes ele quica de leve.
export const SEM_ATRITO = { acelera: 125, vmax: 90, arrasto: 0.12, quique: 0.35 }

// v: velocidade atual { x, y } em unidades de joy. Devolve a nova.
export function passoSemAtrito(v, joy, dtMs, cfg = SEM_ATRITO) {
  const s = dtMs / 1000
  let jx = (joy?.x ?? 0) / 100
  let jy = (joy?.y ?? 0) / 100
  const m = Math.hypot(jx, jy)
  if (m > 1) {
    jx /= m
    jy /= m
  }
  const amort = Math.exp(-cfg.arrasto * s)
  let vx = (v.x + jx * cfg.acelera * s) * amort
  let vy = (v.y + jy * cfg.acelera * s) * amort
  const vel = Math.hypot(vx, vy)
  if (vel > cfg.vmax) {
    vx *= cfg.vmax / vel
    vy *= cfg.vmax / vel
  }
  return { x: vx, y: vy }
}

// Quica de leve na parede: `pos` = centro do coração, `l` = caixa, `meio` = metade do coração.
export function quicarNasBordas(v, pos, l, meio, quique = SEM_ATRITO.quique) {
  let { x, y } = v
  if (pos.x <= l.left + meio + 0.6 && x < 0) x = -x * quique
  else if (pos.x >= l.right - meio - 0.6 && x > 0) x = -x * quique
  if (pos.y <= l.top + meio + 0.6 && y < 0) y = -y * quique
  else if (pos.y >= l.bottom - meio - 0.6 && y > 0) y = -y * quique
  return { x, y }
}

// Quanto tempo (ms) e quanto espaço (px, com o coração a 180 px/s) para parar freiando com tudo da velocidade máxima
export function frenagem(cfg = SEM_ATRITO, velocidadePx = 180) {
  const k = velocidadePx / 100
  return { ms: (cfg.vmax / cfg.acelera) * 1000, px: ((cfg.vmax * cfg.vmax) / (2 * cfg.acelera)) * k }
}

// ---------- 2. BURACO DE MINHOCA ----------
// As bordas da caixa se ligam: sair por cima = entrar por baixo, esquerda <-> direita. Vale para o coração e
// para as balas (cada bala só atravessa UMA vez: sem acumular balas na caixa).
export const MINHOCA = { folga: 6, saltosPorBala: 1, brilhoMs: 420 }

// Centro do coração passou da borda: reaparece do outro lado (mesma distância da borda oposta).
export function embrulharCentro(x, y, l) {
  const w = l.right - l.left
  const h = l.bottom - l.top
  let nx = x
  let ny = y
  let saltou = null
  if (x < l.left) {
    nx = x + w
    saltou = 'esquerda'
  } else if (x > l.right) {
    nx = x - w
    saltou = 'direita'
  }
  if (y < l.top) {
    ny = y + h
    saltou = saltou ? `${saltou}+cima` : 'cima'
  } else if (y > l.bottom) {
    ny = y - h
    saltou = saltou ? `${saltou}+baixo` : 'baixo'
  }
  return { x: nx, y: ny, saltou }
}

// Bala INTEIRA fora da caixa por um lado: ela reaparece entrando pelo lado oposto (de fora, como qualquer bala
// que chega). meioX/meioY = metade do tamanho dela em cada eixo.
export function embrulharBala(x, y, meioX, meioY, l) {
  const w = l.right - l.left
  const h = l.bottom - l.top
  let nx = x
  let ny = y
  let saiu = null
  if (x - meioX > l.right) {
    nx = x - w - 2 * meioX
    saiu = 'direita'
  } else if (x + meioX < l.left) {
    nx = x + w + 2 * meioX
    saiu = 'esquerda'
  }
  if (y - meioY > l.bottom) {
    ny = y - h - 2 * meioY
    saiu = saiu ? `${saiu}+baixo` : 'baixo'
  } else if (y + meioY < l.top) {
    ny = y + h + 2 * meioY
    saiu = saiu ? `${saiu}+cima` : 'cima'
  }
  return { x: nx, y: ny, saiu }
}

// Metade do tamanho de uma bala (de Bullets.js) em cada eixo
export function meiaExtensao(b) {
  if (b.tipo === 'retangulo') return { x: (b.largura ?? 0) / 2, y: (b.altura ?? b.largura ?? 0) / 2 }
  if (b.tipo === 'segmento') {
    const c = (b.comprimento ?? 0) / 2
    const e = (b.espessura ?? 8) / 2
    return { x: Math.abs(Math.cos(b.angulo ?? 0)) * c + e, y: Math.abs(Math.sin(b.angulo ?? 0)) * c + e }
  }
  return { x: b.raio ?? 6, y: b.raio ?? 6 }
}

// ---------- 3. RADAR ----------
// A caixa fica escura. Um feixe gira e, onde passa, REVELA as balas por um instante (o brilho vai sumindo).
// O coração é sempre visível e as balas coladas nele (proximidade) também: ninguém leva bala "do nada".
export const RADAR = { voltaMs: 1800, rastroMs: 1150, proximidade: 30, visivelAcima: 0.12 }

// Ângulo do feixe no tempo t (começa apontando para cima, gira no sentido horário da tela)
export const anguloDoFeixe = (t, cfg = RADAR) => mod((t / cfg.voltaMs) * DOIS_PI - Math.PI / 2)

// O feixe, indo do ângulo a0 ao a1 neste frame, passou por `alvo`? (intervalo (a0, a1], com a volta)
export function feixeVarreu(a0, a1, alvo) {
  const passo = mod(a1 - a0)
  const ate = mod(alvo - a0)
  return ate > 0 && ate <= passo
}

// 0..1: o brilho da bala `t - tPing` ms depois de o feixe passar nela (null/undefined = nunca)
export function brilhoDoPing(t, tPing, cfg = RADAR) {
  if (tPing == null) return 0
  const k = (t - tPing) / cfg.rastroMs
  if (k < 0 || k >= 1) return 0
  return (1 - k) ** 1.5
}

// Quanto tempo uma bala fica "no escuro" entre dois toques do feixe (pior caso)
export function escuroMaximoMs(cfg = RADAR) {
  const k = 1 - cfg.visivelAcima ** (1 / 1.5) // o brilho passa de visivelAcima por k * rastroMs
  return Math.max(0, cfg.voltaMs - k * cfg.rastroMs)
}

// ---------- 4. ÓRBITA ----------
// Um planetinha no meio da caixa puxa as balas (que curvam em volta, e são engolidas se caírem nele) e o
// coração (puxão no joystick, sempre menor que a velocidade dele: dá para sair). Encostar no planeta machuca.
export const ORBITA = { raio: 13, gm: 6.2e5, aMax: 720, alcance: 150, moleza: 16, puxa: 58, alcancePuxa: 92, subidaMs: 900, avisoMs: 800, dano: 5 }

// Aceleração (px/s²) sobre a bala em (px, py); `forca` 0..1 (sobe no começo)
export function aceleracaoOrbital(px, py, cx, cy, forca = 1, cfg = ORBITA) {
  const dx = cx - px
  const dy = cy - py
  const d = Math.hypot(dx, dy)
  if (d > cfg.alcance || d < 0.001) return { ax: 0, ay: 0 }
  const a = Math.min(cfg.aMax, cfg.gm / Math.max(d, cfg.moleza) ** 2) * forca
  return { ax: (dx / d) * a, ay: (dy / d) * a }
}

// Puxão no joystick do coração (unidades de joy) rumo ao planeta
export function puxaoDoCoracao(x, y, cx, cy, forca = 1, cfg = ORBITA) {
  const dx = cx - x
  const dy = cy - y
  const d = Math.hypot(dx, dy)
  if (d >= cfg.alcancePuxa || d < 0.001) return { x: 0, y: 0 }
  const m = cfg.puxa * (1 - d / cfg.alcancePuxa) * forca
  return { x: (dx / d) * m, y: (dy / d) * m }
}

export const engolida = (bx, by, raioBala, cx, cy, cfg = ORBITA) => Math.hypot(bx - cx, by - cy) < cfg.raio * 0.85 + raioBala * 0.3

// ---------- 5. POLARIDADE ----------
// Coração e balas têm polaridade (+ ou −). IGUAIS se repelem, OPOSTAS se atraem (a força cai com a distância).
// A inverte a do coração (recarga curta). Todas as balas continuam machucando.
export const POLARIDADE = { alcance: 86, forca: 520, recargaMs: 220, cpuReacaoMs: { min: 240, max: 480 } }

// Polaridade (+1 / −1) da i-ésima bala vista na rodada: uma função só do índice e da semente, igual nos dois PCs
export function polDoIndice(i, semente = 0) {
  let h = (Math.imul(i + 1, 0x9e3779b1) ^ Math.imul((semente | 0) + 7, 0x85ebca6b)) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d) >>> 0
  h ^= h >>> 12
  h = Math.imul(h, 0x297a2d39) >>> 0
  h ^= h >>> 15
  return h & 1 ? 1 : -1
}

// Aceleração (px/s²) sobre a bala em (bx, by) por causa do coração em (cx, cy)
export function aceleracaoPolar(polCoracao, polBala, bx, by, cx, cy, cfg = POLARIDADE) {
  const dx = cx - bx
  const dy = cy - by
  const d = Math.hypot(dx, dy)
  if (d >= cfg.alcance || d < 1) return { ax: 0, ay: 0 }
  const mag = cfg.forca * (1 - d / cfg.alcance)
  const sinal = polCoracao === polBala ? -1 : 1 // iguais: para longe do coração; opostas: para ele
  return { ax: (sinal * dx * mag) / d, ay: (sinal * dy * mag) / d }
}

// A CPU escolhe a polaridade que mais AFASTA as balas que vêm (pol = +1 ou −1 de cada bala)
export function polaridadeDaCpu(coracao, balas, atual, cfg = POLARIDADE) {
  let pontos = 0 // > 0: a polaridade +1 repele melhor
  const alcance = cfg.alcance * 1.15
  for (const b of balas) {
    if (b.morta || b.inofensiva || !b.pol) continue
    const dx = coracao.x - b.x
    const dy = coracao.y - b.y
    const d = Math.hypot(dx, dy)
    if (d >= alcance) continue
    const vindo = (b.vx ?? 0) * dx + (b.vy ?? 0) * dy > 0 // anda na direção do coração
    pontos += (1 - d / alcance) * (vindo ? 1.6 : 0.6) * b.pol
  }
  if (Math.abs(pontos) < 0.05) return atual
  return pontos > 0 ? 1 : -1
}

// ---------- 6. OXIGÊNIO ----------
// Uma barra de O₂ por caixa esvazia sozinha. Bolhas de oxigênio (avisadas) aparecem e a recarregam quando o
// coração encosta. Barra vazia = dano PEQUENO a cada tickMs (sobre os i-frames de sempre).
export const OXIGENIO = {
  inicial: 0.75,
  drenaMs: 5600, // cheia -> vazia (um ataque dura uns 4 a 8 s)
  bolha: 0.45, // quanto cada bolha recarrega
  tickMs: 1500,
  danoPct: 0.02,
  danoMin: 1,
  avisoMs: 700,
  vidaMs: 4200,
  raio: 11,
  primeiraMs: 800,
  intervaloMs: { min: 1500, max: 2300 },
  total: 12,
  margem: 0.15,
  maxVivas: 2,
}

export function planoBolhas(sorte, { total = OXIGENIO.total } = {}) {
  const lista = []
  let em = OXIGENIO.primeiraMs
  for (let i = 0; i < total; i++) {
    const anterior = lista[i - 1]
    let fx
    let fy
    for (let tentativa = 0; tentativa < 12; tentativa++) {
      fx = entre(sorte, OXIGENIO.margem, 1 - OXIGENIO.margem)
      fy = entre(sorte, OXIGENIO.margem, 1 - OXIGENIO.margem)
      if (!anterior || Math.hypot((fx - anterior.fx) * REF_CAIXA.largura, (fy - anterior.fy) * REF_CAIXA.altura) >= 70) break
    }
    lista.push({ em: Math.round(em), fx: Math.round(fx * 1000) / 1000, fy: Math.round(fy * 1000) / 1000 })
    em += entre(sorte, OXIGENIO.intervaloMs.min, OXIGENIO.intervaloMs.max)
  }
  return lista
}

export const drenarO2 = (o2, dtMs, cfg = OXIGENIO) => Math.max(0, o2 - dtMs / cfg.drenaMs)
export const recarregarO2 = (o2, cfg = OXIGENIO) => Math.min(1, o2 + cfg.bolha)
export const danoDoSufoco = (hpMax, cfg = OXIGENIO) => Math.max(cfg.danoMin, Math.round((hpMax ?? 100) * cfg.danoPct))

// ---------- 7. RAIO TRATOR ----------
// A perto de uma bala (alcance) AGARRA ela com o raio; A de novo LANÇA na caixa do OPONENTE (avisada, vem em
// linha reta pela borda virada para você). Uma bala segurada não machuca; solta sozinha depois de segurarMaxMs.
// (O jogo só manda o aperto do botão, sem "segurar e soltar": por isso A pega e A de novo lança.)
export const TRATOR = {
  alcance: 60,
  orbita: 26,
  segurarMaxMs: 3400,
  recargaMs: 700,
  avisoMs: 650,
  velocidade: 215,
  raioMin: 5,
  raioMax: 10,
  tamanhoMax: 22, // retângulos até este lado também se agarram
  dano: 5,
  emVooMax: 2, // lançadas ainda voando na caixa de um jogador
  cpuEsperaMs: { min: 500, max: 1300 },
}

export function podeAgarrar(b, cfg = TRATOR) {
  if (!b || b.morta || b.inofensiva || b.marcaPlaneta || b.segurada) return false
  if ((b.idade ?? 0) < (b.aviso ?? 0)) return false
  if (b.tipo === 'circulo') return (b.raio ?? 6) <= cfg.raioMax * 1.5
  if (b.tipo === 'retangulo') return Math.max(b.largura ?? 0, b.altura ?? 0) <= cfg.tamanhoMax
  return false
}

// A bala agarrável mais perto de (cx, cy) dentro do alcance (distância até a borda dela); null se nenhuma
export function escolherAlvoDoRaio(lista, cx, cy, cfg = TRATOR) {
  let melhor = null
  let menor = cfg.alcance
  for (const b of lista) {
    if (!podeAgarrar(b, cfg)) continue
    const tam = b.tipo === 'circulo' ? b.raio ?? 6 : Math.max(b.largura ?? 0, b.altura ?? 0) / 2
    const d = Math.hypot(b.x - cx, b.y - cy) - tam
    if (d < menor) {
      menor = d
      melhor = b
    }
  }
  return melhor
}

export const raioDoArremesso = (b, cfg = TRATOR) => limitar(b.tipo === 'circulo' ? b.raio ?? 6 : Math.max(b.largura ?? 0, b.altura ?? 0) / 2, cfg.raioMin, cfg.raioMax)

// O arremesso na caixa de destino `l`: entra pela borda virada para quem lançou (`sentido` +1 = vem da
// esquerda e anda para a direita; −1 = o contrário), na altura do alvo (presa dentro da caixa)
export function arremesso(l, sentido, yAlvo, raio, cfg = TRATOR) {
  const y = limitar(yAlvo, l.top + raio + 6, l.bottom - raio - 6)
  const x = sentido > 0 ? l.left - raio - 1 : l.right + raio + 1
  return { x, y, vx: sentido * cfg.velocidade, vy: 0, raio, aviso: cfg.avisoMs, dano: cfg.dano }
}

// Sentido do arremesso de quem está na pista `k` (P1 à esquerda lança para a direita)
export const sentidoDoArremesso = (k) => (k === 0 ? 1 : -1)

// ---------- 8. MANUTENÇÃO ----------
// Painéis piscam na caixa. Ficar em cima de um por repararMs o conserta; consertado vira um ESCUDO fixo que
// barra as balas até o fim da rodada (a bala some ao encostar). Sair do painel faz o conserto regredir.
export const MANUTENCAO = { quantos: 4, w: 38, h: 28, repararMs: 1000, perde: 2.2, primeiraMs: 400, intervaloMs: 700, margem: 16, folga: 3, vao: 22 }

// Painéis (centros em fração da caixa): um em cada QUADRANTE da caixa (sorteado dentro dele, com vão de `vao` px
// até a linha do meio), então nunca se encostam e sobra espaço para o coração passar. A ordem de aparição é sorteada.
export function planoPaineis(sorte, ref = REF_CAIXA, cfg = MANUTENCAO) {
  const meioW = ref.largura / 2
  const meioH = ref.altura / 2
  const folgaX = cfg.vao / 2
  const quadrantes = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]
  for (let i = quadrantes.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(sorte() * (i + 1)))
    ;[quadrantes[i], quadrantes[j]] = [quadrantes[j], quadrantes[i]]
  }
  return quadrantes.slice(0, cfg.quantos).map(([qx, qy], i) => {
    const x0 = qx ? meioW + folgaX + cfg.w / 2 : cfg.margem + cfg.w / 2
    const x1 = qx ? ref.largura - cfg.margem - cfg.w / 2 : meioW - folgaX - cfg.w / 2
    const y0 = qy ? meioH + folgaX + cfg.h / 2 : cfg.margem + cfg.h / 2
    const y1 = qy ? ref.altura - cfg.margem - cfg.h / 2 : meioH - folgaX - cfg.h / 2
    const cx = entre(sorte, x0, x1)
    const cy = entre(sorte, y0, y1)
    return {
      em: Math.round(cfg.primeiraMs + i * cfg.intervaloMs),
      fx: Math.round((cx / ref.largura) * 1000) / 1000,
      fy: Math.round((cy / ref.altura) * 1000) / 1000,
    }
  })
}

// O centro do coração está em cima do painel (centro px, py)?
export const emCimaDoPainel = (cx, cy, px, py, cfg = MANUTENCAO) => Math.abs(cx - px) <= cfg.w / 2 + cfg.folga && Math.abs(cy - py) <= cfg.h / 2 + cfg.folga

// 0..1 do conserto depois de dtMs: sobe parado em cima, desce (mais rápido) fora
export function passoReparo(progresso, dentro, dtMs, cfg = MANUTENCAO) {
  const d = dtMs / cfg.repararMs
  return limitar(progresso + (dentro ? d : -d * cfg.perde), 0, 1)
}

// A bala `b` (formato de Bullets.js) encosta no escudo do painel em (px, py)? Balas enormes (feixes, paredes,
// lâminas longas) NÃO são barradas: elas são desenhadas com vãos e atravessar o escudo as quebraria.
export const TAMANHO_MAX_BARRADA = 80
export function barradaPeloEscudo(b, px, py, cfg = MANUTENCAO) {
  const meioW = cfg.w / 2
  const meioH = cfg.h / 2
  if (b.tipo === 'circulo') {
    const dx = Math.max(Math.abs(b.x - px) - meioW, 0)
    const dy = Math.max(Math.abs(b.y - py) - meioH, 0)
    return Math.hypot(dx, dy) <= (b.raio ?? 6) * 0.85
  }
  if (b.tipo === 'retangulo') {
    if (Math.max(b.largura ?? 0, b.altura ?? 0) > TAMANHO_MAX_BARRADA) return false
    return Math.abs(b.x - px) <= meioW + (b.largura ?? 0) * 0.4 && Math.abs(b.y - py) <= meioH + (b.altura ?? b.largura ?? 0) * 0.4
  }
  if ((b.comprimento ?? 0) > TAMANHO_MAX_BARRADA) return false
  return Math.abs(b.x - px) <= meioW + (b.comprimento ?? 0) * 0.25 && Math.abs(b.y - py) <= meioH + (b.comprimento ?? 0) * 0.25
}
