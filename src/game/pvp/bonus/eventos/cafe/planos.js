// Regras PURAS (sem Phaser) dos 8 eventos da arena CAFÉ FRANCÊS. Os arquivos ao lado só
// desenham e ligam isto no jogo; aqui fica o que dá para testar em Node: planos repetíveis
// pela semente (sempre o mesmo rng que a rodada empresta), regras de justiça (aviso, saída
// livre) e a matemática de cada evento (laço de leite, balanço da bandeja, paredes do mímico,
// fole do acordeão, tinta do pintor, prato do dia, cafeína e o cavalo do xadrez).
//
//   LATTE ART      LATTE, atualizarTinta, estenderTrilha, detectarLaco, pontoNoPoligono
//   BANDEJA        BANDEJA, novoBalanco, atualizarBalanco, suavizarJoy
//   MÍMICO         MIMICO, planejarMuros, retangulosDosMuros, empurrarDaParede, quicarNaParede,
//                  cancelarJoyNaParede, conectado
//   ACORDEÃO       ACORDEAO, planejarFole, estadoDoFole, insetsEmPx
//   PINTOR         PINTOR, planejarPincelada, tintaRevelada, dentroDaTinta, areaDaTinta
//   MENU DO DIA    PRATOS, MENU, proximoPratoDoDia, planejarPrato
//   EXPRESSO       EXPRESSO, novaCafeina, beber, nivelDeCafeina, tremendo, fatorDeVelocidade, planejarXicara
//   XADREZ         XADREZ, SALTOS, destinosDoCavalo, escolherSalto, centroDaCelula, celulaDoPonto,
//                  notaDoDestino, escolherSaltoDaCpu, cavaloConectado

export const entre = (sorte, a, b) => a + (b - a) * sorte()
export const inteiroEntre = (sorte, a, b) => a + Math.floor(sorte() * (b - a + 1))
const limitar = (v, a, b) => Math.max(a, Math.min(b, v))
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const suave = (k) => k * k * (3 - 2 * k)

// ===================================================================================
// LATTE ART: o coração desenha uma linha de leite; fechar um laço em volta das balas as apaga
// ===================================================================================

//   tintaPorPx    quanto de tinta (0..1) cada pixel de linha gasta: o tanque cheio dá ~520 px
//   recarga       tinta por segundo andando sem desenhar... (sempre volta devagar)
//   recargaParado idem, com o coração quase parado (recarrega bem mais rápido)
//   fecha         a ponta da linha a até tantos px de um ponto antigo fecha o laço
//   caminhoMin    o laço precisa de tanto caminho (senão qualquer tremida fecharia)
//   areaMin/Max   área (px²) que o laço precisa cercar: pequeno demais é rabisco
//   tintaPorBala  tinta devolvida por bala apagada (premia o laço certeiro)
//   vidaMs        quanto tempo a linha dura antes de sumir
export const LATTE = { tintaPorPx: 1 / 520, recarga: 0.09, recargaParado: 0.42, paradoPxS: 30, passoMin: 3, fecha: 12, caminhoMin: 80, areaMin: 420, areaMax: 24000, tintaPorBala: 0.07, vidaMs: 2800, maxPontos: 240 }

// Tinta depois de um frame: gasta pelo que andou desenhando e recarrega com o tempo
export function atualizarTinta(tinta, { distancia = 0, dtMs, parado = false, desenhando = true }, cfg = LATTE) {
  let t = tinta
  if (desenhando && distancia > 0) t -= distancia * cfg.tintaPorPx
  t += ((parado ? cfg.recargaParado : cfg.recarga) * dtMs) / 1000
  return limitar(t, 0, 1)
}

// Põe o ponto novo no fim da linha (se andou o bastante) e tira os velhos. `quebra` marca um
// corte: a tinta acabou e voltou, o laço não atravessa esse buraco. Devolve true se acrescentou.
export function estenderTrilha(trilha, p, t, { quebra = false } = {}, cfg = LATTE) {
  const ultimo = trilha[trilha.length - 1]
  let acrescentou = false
  if (!ultimo || dist(ultimo, p) >= cfg.passoMin) {
    trilha.push({ x: p.x, y: p.y, t, q: quebra || !ultimo })
    acrescentou = true
  }
  while (trilha.length && t - trilha[0].t > cfg.vidaMs) trilha.shift()
  while (trilha.length > cfg.maxPontos) trilha.shift()
  return acrescentou
}

export function areaDoPoligono(pts) {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

// ponto dentro do polígono (pares/ímpares)
export function pontoNoPoligono(x, y, pts) {
  let dentro = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]
    const b = pts[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro
  }
  return dentro
}

// A ponta da linha (o último ponto) fechou um laço com um trecho antigo? Devolve
// { inicio, poligono, area } do MENOR laço que fecha, ou null. Laço achatado (vai e volta pela
// mesma linha) não conta; a linha cortada pela falta de tinta também não fecha.
export function detectarLaco(trilha, cfg = LATTE) {
  const n = trilha.length
  if (n < 6) return null
  const fim = trilha[n - 1]
  let caminho = 0
  for (let i = n - 2; i >= 0; i--) {
    caminho += dist(trilha[i], trilha[i + 1])
    if (trilha[i + 1].q) break
    if (caminho < cfg.caminhoMin) continue
    if (dist(trilha[i], fim) > cfg.fecha) continue
    const poligono = trilha.slice(i)
    const area = areaDoPoligono(poligono)
    if (area >= cfg.areaMin && area <= cfg.areaMax) return { inicio: i, poligono, area }
  }
  return null
}

// ===================================================================================
// BANDEJA: carregando uma xícara, giro brusco e arrancada/freada derramam
// ===================================================================================

//   giroPorS    giro (rad/s) que ainda é suave; o que passar disso enche o balanço
//   giroPeso    quanto cada radiano de giro BRUSCO enche (1 = derrama)
//   acelPxS2    aceleração (px/s²) que ainda é suave
//   acelPeso    quanto cada "velocidade máxima" de arrancada/freada brusca enche
//   velMin      abaixo disto o coração está parado (não tem direção)
//   decaiPorS   o balanço baixa sozinho andando liso
//   depoisDeDerramar  balanço logo após derramar; recargaMs: tempo sem derramar de novo
//   dano        fração do HP máximo (mínimo 2) de um derrame: pequeno de propósito
export const BANDEJA = { giroPorS: 3.6, giroPeso: 0.33, acelPxS2: 1000, acelPeso: 0.2, velMin: 50, decaiPorS: 0.3, depoisDeDerramar: 0.3, recargaMs: 1500, dano: 0.03, relogioDasBalas: 0.92 }

export const novoBalanco = () => ({ w: 0, ang: null, vel: 0, derramouEm: -1e9 })

const diferencaDeAngulo = (a, b) => {
  let d = a - b
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return d
}

// Um frame do balanço. `passo` = { dx, dy } o que o coração andou (px), dtMs, t (relógio do evento),
// velMax (px/s máximo do coração, para normalizar a arrancada). Muda e devolve { est, derramou }.
export function atualizarBalanco(est, { dx, dy, dtMs, t, velMax = 180 }, cfg = BANDEJA) {
  const dt = Math.max(1, dtMs) / 1000
  const vel = Math.hypot(dx, dy) / dt
  let w = est.w
  // arrancada e freada: mudança de velocidade acima do que é suave
  const dv = Math.abs(vel - est.vel)
  w += (Math.max(0, dv - cfg.acelPxS2 * dt) / velMax) * cfg.acelPeso
  // giro: só tem direção quem anda; o giro SUAVE (até giroPorS) não derrama
  let ang = est.ang
  if (vel >= cfg.velMin) {
    const novo = Math.atan2(dy, dx)
    if (ang !== null) w += Math.max(0, Math.abs(diferencaDeAngulo(novo, ang)) - cfg.giroPorS * dt) * cfg.giroPeso
    ang = novo
  } else ang = null
  w = Math.max(0, w - cfg.decaiPorS * dt)
  est.vel = vel
  est.ang = ang
  est.w = w
  let derramou = false
  if (w >= 1 && t - est.derramouEm >= cfg.recargaMs) {
    derramou = true
    est.derramouEm = t
    est.w = cfg.depoisDeDerramar
  } else if (w > 1) est.w = 1
  return { est, derramou }
}

// Suaviza o joystick da CPU (ela decide a cada ~100 ms e viraria um chacoalho de bandeja)
export function suavizarJoy(atual, alvo, dtMs, porSegundo = 5) {
  const k = 1 - Math.exp((-porSegundo * dtMs) / 1000)
  return { x: atual.x + (alvo.x - atual.x) * k, y: atual.y + (alvo.y - atual.y) * k }
}

// ===================================================================================
// MÍMICO: paredes invisíveis que só aparecem quando alguém esbarra (balas quicam nelas)
// ===================================================================================

//   espessura     grossura da parede (px)
//   avisoInicialMs  no começo as paredes aparecem fracas por este tempo (dá para ver o labirinto)
//   revelaMs      quanto tempo uma parede fica visível depois de um esbarrão
//   raioFolga     o labirinto sempre deixa corredores de pelo menos 2x isto em volta do coração
export const MIMICO = { espessura: 7, avisoInicialMs: 2200, revelaMs: 900, raioFolga: 13 }

// moldes em frações da caixa: [x0, y0, x1, y1] (segmentos retos, horizontais ou verticais)
const MOLDES_MIMICO = [
  // corredores
  [[0.33, 0, 0.33, 0.62], [0.66, 0.38, 0.66, 1]],
  // serpente
  [[0, 0.33, 0.66, 0.33], [0.34, 0.68, 1, 0.68]],
  // L e traço
  [[0.5, 0, 0.5, 0.46], [0, 0.78, 0.32, 0.78]],
  // caixinha de mímico (aberta para baixo)
  [[0.34, 0.3, 0.34, 0.68], [0.66, 0.3, 0.66, 0.68], [0.34, 0.3, 0.66, 0.3]],
  // dentes
  [[0.25, 0, 0.25, 0.5], [0.5, 0.5, 0.5, 1], [0.75, 0, 0.75, 0.5]],
]

// O labirinto da rodada (em frações da caixa; vale igual nas duas caixas e nos dois PCs)
export function planejarMuros(sorte) {
  const molde = MOLDES_MIMICO[inteiroEntre(sorte, 0, MOLDES_MIMICO.length - 1)]
  const flipX = sorte() < 0.5
  const flipY = sorte() < 0.5
  return molde.map(([x0, y0, x1, y1]) => ({
    x0: flipX ? 1 - x0 : x0,
    y0: flipY ? 1 - y0 : y0,
    x1: flipX ? 1 - x1 : x1,
    y1: flipY ? 1 - y1 : y1,
  }))
}

// Retângulos em px dos muros dentro da caixa `l` ({ left, top, width, height })
export function retangulosDosMuros(muros, l, cfg = MIMICO) {
  const e = cfg.espessura / 2
  return muros.map((m) => {
    const ax = l.left + Math.min(m.x0, m.x1) * l.width
    const bx = l.left + Math.max(m.x0, m.x1) * l.width
    const ay = l.top + Math.min(m.y0, m.y1) * l.height
    const by = l.top + Math.max(m.y0, m.y1) * l.height
    return { left: ax - e, right: bx + e, top: ay - e, bottom: by + e }
  })
}

// O coração (raio `raio`) dentro de uma parede é empurrado para fora pelo lado mais perto.
// Devolve { x, y, tocou: índice da parede ou -1 }
export function empurrarDaParede(rects, x, y, raio) {
  let tocou = -1
  for (let passada = 0; passada < 2; passada++) {
    rects.forEach((r, i) => {
      const L = r.left - raio
      const R = r.right + raio
      const T = r.top - raio
      const B = r.bottom + raio
      if (x <= L || x >= R || y <= T || y >= B) return
      const d = [x - L, R - x, y - T, B - y]
      const m = Math.min(...d)
      if (m === d[0]) x = L
      else if (m === d[1]) x = R
      else if (m === d[2]) y = T
      else y = B
      tocou = i
    })
  }
  return { x, y, tocou }
}

// Bala { x, y, vx, vy } de raio `raio` que entrou numa parede rebate nela (muda vx/vy e a
// posição). Devolve o índice da parede ou -1.
export function quicarNaParede(rects, b, raio) {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    const L = r.left - raio
    const R = r.right + raio
    const T = r.top - raio
    const B = r.bottom + raio
    if (b.x <= L || b.x >= R || b.y <= T || b.y >= B) continue
    const d = [b.x - L, R - b.x, b.y - T, B - b.y]
    const m = Math.min(...d)
    if (m === d[0]) {
      b.x = L
      b.vx = -Math.abs(b.vx)
    } else if (m === d[1]) {
      b.x = R
      b.vx = Math.abs(b.vx)
    } else if (m === d[2]) {
      b.y = T
      b.vy = -Math.abs(b.vy)
    } else {
      b.y = B
      b.vy = Math.abs(b.vy)
    }
    return i
  }
  return -1
}

// O joystick que encosta numa parede perde só a parte que empurra para dentro dela: o coração
// desliza ao longo da parede (e a CPU não fica empurrando). Devolve { joy, tocou }.
export function cancelarJoyNaParede(rects, x, y, raio, joy, folga = 1.5) {
  let { x: jx, y: jy } = joy
  let tocou = -1
  rects.forEach((r, i) => {
    const L = r.left - raio - folga
    const R = r.right + raio + folga
    const T = r.top - raio - folga
    const B = r.bottom + raio + folga
    if (x < L || x > R || y < T || y > B) return
    const d = [x - L, R - x, y - T, B - y]
    const m = Math.min(...d)
    if (m === d[0] && jx > 0) (jx = 0), (tocou = i)
    else if (m === d[1] && jx < 0) (jx = 0), (tocou = i)
    else if (m === d[2] && jy > 0) (jy = 0), (tocou = i)
    else if (m === d[3] && jy < 0) (jy = 0), (tocou = i)
  })
  return { joy: { x: jx, y: jy }, tocou }
}

// Todo o espaço livre da caixa (para um coração de raio `raio`) é um pedaço só? E quanto sobra
// livre (0..1)? Grade de `passo` px.
export function conectado(rects, l, raio, passo = 5) {
  const cols = Math.floor(l.width / passo)
  const lins = Math.floor(l.height / passo)
  const livre = (c, r) => {
    const x = l.left + (c + 0.5) * passo
    const y = l.top + (r + 0.5) * passo
    if (x < l.left + raio || x > l.left + l.width - raio || y < l.top + raio || y > l.top + l.height - raio) return false
    return !rects.some((q) => x > q.left - raio && x < q.right + raio && y > q.top - raio && y < q.bottom + raio)
  }
  const vistos = new Set()
  let total = 0
  let inicio = null
  for (let r = 0; r < lins; r++) {
    for (let c = 0; c < cols; c++) {
      if (!livre(c, r)) continue
      total++
      inicio ??= [c, r]
    }
  }
  if (!inicio) return { conectado: false, livre: 0 }
  const fila = [inicio]
  vistos.add(inicio[0] + inicio[1] * cols)
  while (fila.length) {
    const [c, r] = fila.pop()
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nr < 0 || nc >= cols || nr >= lins || vistos.has(nc + nr * cols) || !livre(nc, nr)) continue
      vistos.add(nc + nr * cols)
      fila.push([nc, nr])
    }
  }
  return { conectado: vistos.size === total, livre: total / (cols * lins) }
}

// ===================================================================================
// ACORDEÃO: a caixa estica e aperta na batida da valsa (avisa antes) e empurra o coração
// ===================================================================================

//   compassoMs  uma frase da valsa (3 tempos a 96 bpm)
//   avisoMs     o alvo aparece tracejado este tempo antes do fole começar a andar
//   moveMs      quanto o fole leva para ir ao alvo (devagar: o coração corre mais que ele)
//   livreMin    a largura que NUNCA fecha (px)
//   maxLado     o quanto cada lado entra, no máximo (fração da largura)
export const ACORDEAO = { compassoMs: 1875, avisoMs: 560, moveMs: 560, livreMin: 96, maxLado: 0.34, compassos: 48 }

const ALVOS_FOLE = [
  { e: 0, d: 0 },
  { e: 0.3, d: 0 },
  { e: 0, d: 0.3 },
  { e: 0.2, d: 0.2 },
  { e: 0.34, d: 0.06 },
  { e: 0.06, d: 0.34 },
  { e: 0.14, d: 0.3 },
  { e: 0.3, d: 0.14 },
]

// Uma sequência de alvos (um por compasso): nunca repete o anterior e abre (0,0) de vez em quando
export function planejarFole(sorte, n = ACORDEAO.compassos) {
  const seq = []
  let anterior = -1
  for (let i = 0; i < n; i++) {
    let k
    do k = inteiroEntre(sorte, 0, ALVOS_FOLE.length - 1)
    while (k === anterior)
    anterior = k
    seq.push({ ...ALVOS_FOLE[k] })
  }
  return seq
}

// Quanto cada lado entra, em px, respeitando a largura livre mínima
export function insetsEmPx(alvo, largura, cfg = ACORDEAO) {
  let e = Math.min(alvo.e, cfg.maxLado) * largura
  let d = Math.min(alvo.d, cfg.maxLado) * largura
  const cabe = Math.max(0, largura - cfg.livreMin)
  if (e + d > cabe) {
    const k = cabe / (e + d)
    e *= k
    d *= k
  }
  return { e, d }
}

// O fole no instante t (ms): { e, d } (frações que entram), `aviso` (o alvo da frase, enquanto
// ainda avisa) e a fase. Nada pula: tudo é interpolado.
export function estadoDoFole(t, plano, cfg = ACORDEAO) {
  const compasso = Math.floor(t / cfg.compassoMs)
  const local = t - compasso * cfg.compassoMs
  const atual = plano[compasso % plano.length]
  const anterior = compasso === 0 ? { e: 0, d: 0 } : plano[(compasso - 1) % plano.length]
  if (local < cfg.avisoMs) return { e: anterior.e, d: anterior.d, aviso: atual, fase: 'aviso', compasso, local }
  if (local < cfg.avisoMs + cfg.moveMs) {
    const k = suave((local - cfg.avisoMs) / cfg.moveMs)
    return { e: anterior.e + (atual.e - anterior.e) * k, d: anterior.d + (atual.d - anterior.d) * k, aviso: null, fase: 'move', compasso, local }
  }
  return { e: atual.e, d: atual.d, aviso: null, fase: 'segura', compasso, local }
}

// ===================================================================================
// PINTOR: pinceladas avisadas; bala na tinta molhada congela (e vira obstáculo até secar)
// ===================================================================================

//   avisoMs     o contorno tracejado da pincelada, antes do pincel passar
//   pincelMs    o pincel passando (a tinta aparece aos poucos)
//   molhadoMs   quanto a tinta fica molhada (depois seca: o que congelou nela se desfaz)
//   maxAtivas   pinceladas ao mesmo tempo; areaMax = fração da caixa que pode estar molhada
export const PINTOR = { avisoMs: 800, pincelMs: 520, molhadoMs: 4300, intervaloMs: { min: 1500, max: 2200 }, primeira: { min: 500, max: 900 }, maxAtivas: 2, areaMax: 0.34, faixa: { min: 24, max: 32 }, mancha: { min: 26, max: 36 } }
export const CORES_TINTA = [0xe0443a, 0x3a78e0, 0xf0c030, 0x3ab070, 0xb858d0]

// Uma pincelada nova dentro da caixa `l`: faixa horizontal (da esquerda ou da direita), vertical
// (de cima ou de baixo) ou mancha redonda. `ativas` = as que ainda estão molhadas (para não
// passar da área máxima). Devolve { forma, cor, ... geometria ... } ou null se não cabe.
export function planejarPincelada(sorte, l, ativas = [], cfg = PINTOR) {
  const areaCaixa = l.width * l.height
  const tipo = sorte()
  let p
  if (tipo < 0.34) {
    const h = entre(sorte, cfg.faixa.min, cfg.faixa.max)
    const y = entre(sorte, l.top + h / 2, l.bottom - h / 2)
    const comp = entre(sorte, 0.7, 1) * l.width
    const daEsquerda = sorte() < 0.5
    p = { forma: 'faixa', x: daEsquerda ? l.left : l.right - comp, y: y - h / 2, largura: comp, altura: h, de: daEsquerda ? 'e' : 'd' }
  } else if (tipo < 0.62) {
    const w = entre(sorte, cfg.faixa.min, cfg.faixa.max)
    const x = entre(sorte, l.left + w / 2, l.right - w / 2)
    const comp = entre(sorte, 0.7, 1) * l.height
    const deCima = sorte() < 0.5
    p = { forma: 'faixa', x: x - w / 2, y: deCima ? l.top : l.bottom - comp, largura: w, altura: comp, de: deCima ? 'c' : 'b' }
  } else {
    const r = entre(sorte, cfg.mancha.min, cfg.mancha.max)
    p = { forma: 'mancha', x: entre(sorte, l.left + r, l.right - r), y: entre(sorte, l.top + r, l.bottom - r), raio: r }
  }
  p.cor = CORES_TINTA[inteiroEntre(sorte, 0, CORES_TINTA.length - 1)]
  const molhada = ativas.reduce((s, a) => s + areaDaTinta(a), 0)
  if ((molhada + areaDaTinta(p)) / areaCaixa > cfg.areaMax) return null
  return p
}

export const areaDaTinta = (p) => (p.forma === 'mancha' ? Math.PI * p.raio * p.raio : p.largura * p.altura)

// A parte da pincelada que já está pintada com o pincel em `k` (0..1): a faixa cresce do lado
// de onde o pincel vem; a mancha cresce do centro
export function tintaRevelada(p, k) {
  k = limitar(k, 0, 1)
  if (p.forma === 'mancha') return { ...p, raio: p.raio * k }
  if (p.de === 'e') return { ...p, largura: p.largura * k }
  if (p.de === 'd') return { ...p, x: p.x + p.largura * (1 - k), largura: p.largura * k }
  if (p.de === 'c') return { ...p, altura: p.altura * k }
  return { ...p, y: p.y + p.altura * (1 - k), altura: p.altura * k }
}

// O centro da bala (raio r) está na tinta?
export function dentroDaTinta(p, x, y) {
  if (p.forma === 'mancha') return Math.hypot(x - p.x, y - p.y) <= p.raio
  return x >= p.x && x <= p.x + p.largura && y >= p.y && y <= p.y + p.altura
}

// ===================================================================================
// MENU DO DIA: pratos viram balas; só o prato do dia cura
// ===================================================================================

export const PRATOS = [
  { id: 'croissant', nome: 'CROISSANT' },
  { id: 'baguete', nome: 'BAGUETE' },
  { id: 'queijo', nome: 'QUEIJO' },
  { id: 'sopa', nome: 'SOPA DE CEBOLA' },
  { id: 'macaron', nome: 'MACARON' },
]

//   trocaMs     quanto dura um prato do dia; avisoTrocaMs: o quadro avisa a troca antes
//   probBom     chance de cada prato que chega ser o do dia (para sempre ter cura por perto)
//   cura        fração do HP máximo (mínimo 2) por prato do dia; curaIntervaloMs: respiro entre curas
//   dano        dano do prato que não é o do dia
export const MENU = { trocaMs: 6800, avisoTrocaMs: 1100, intervaloMs: { min: 560, max: 860 }, primeiro: { min: 400, max: 800 }, probBom: 0.36, velocidade: { min: 66, max: 100 }, raio: 10, cura: 0.03, curaIntervaloMs: 900, dano: 4 }

// O prato do dia seguinte (nunca o mesmo do anterior)
export function proximoPratoDoDia(sorte, anterior = null) {
  const opcoes = PRATOS.filter((p) => p.id !== anterior)
  return opcoes[inteiroEntre(sorte, 0, opcoes.length - 1)].id
}

// Um prato chegando: nasce um pouco fora da caixa e cruza em direção a um ponto de dentro.
// `doDia` = o prato do dia (ou o que vale na hora). `bom` = é o prato do dia.
export function planejarPrato(sorte, l, doDia, cfg = MENU) {
  const bom = sorte() < cfg.probBom
  let id = doDia
  if (!bom) {
    const outros = PRATOS.filter((p) => p.id !== doDia)
    id = outros[inteiroEntre(sorte, 0, outros.length - 1)].id
  }
  const lado = inteiroEntre(sorte, 0, 3) // 0 esquerda, 1 direita, 2 cima, 3 baixo
  const margem = cfg.raio + 6
  let x
  let y
  if (lado === 0) [x, y] = [l.left - margem, entre(sorte, l.top + 10, l.bottom - 10)]
  else if (lado === 1) [x, y] = [l.right + margem, entre(sorte, l.top + 10, l.bottom - 10)]
  else if (lado === 2) [x, y] = [entre(sorte, l.left + 10, l.right - 10), l.top - margem]
  else [x, y] = [entre(sorte, l.left + 10, l.right - 10), l.bottom + margem]
  const alvoX = entre(sorte, l.left + l.width * 0.2, l.right - l.width * 0.2)
  const alvoY = entre(sorte, l.top + l.height * 0.2, l.bottom - l.height * 0.2)
  const v = entre(sorte, cfg.velocidade.min, cfg.velocidade.max)
  const d = Math.hypot(alvoX - x, alvoY - y) || 1
  return { id, bom: id === doDia, x, y, vx: ((alvoX - x) / d) * v, vy: ((alvoY - y) / d) * v }
}

// ===================================================================================
// EXPRESSO: cada xícara dá velocidade (acumula); xícara demais = tremedeira
// ===================================================================================

//   bonusPorXicara  quanto cada xícara acelera o coração (fração; acumula até maxNivel)
//   duracaoMs       quanto dura o efeito de CADA xícara
//   tremeNivel      com tantas xícaras fazendo efeito juntas, o coração treme
//   tremeMs         quanto dura a tremedeira depois de passar do limite
//   tremorJoy       quanto o tremor mexe no joystick (±) e tremorPx o balanço do desenho
export const EXPRESSO = { bonusPorXicara: 0.17, maxNivel: 4, duracaoMs: 5400, tremeNivel: 4, tremeMs: 3400, tremorJoy: 38, tremorPx: 1.6, intervaloMs: { min: 1700, max: 2500 }, primeira: { min: 500, max: 900 }, vidaMs: 7000, maxNaCaixa: 2, raio: 9 }

export const novaCafeina = () => ({ expira: [], tremeAte: -1 })

export const nivelDeCafeina = (est, t) => est.expira.filter((e) => e > t).length

export const fatorDeVelocidade = (nivel, cfg = EXPRESSO) => 1 + cfg.bonusPorXicara * Math.min(nivel, cfg.maxNivel)

export const tremendo = (est, t) => est.tremeAte > t

// Bebeu uma xícara em t: devolve { nivel, passouDoLimite }. Limpa as que já passaram.
export function beber(est, t, cfg = EXPRESSO) {
  est.expira = est.expira.filter((e) => e > t)
  est.expira.push(t + cfg.duracaoMs)
  const nivel = est.expira.length
  const passouDoLimite = nivel >= cfg.tremeNivel
  if (passouDoLimite) est.tremeAte = Math.max(est.tremeAte, t + cfg.tremeMs)
  return { nivel, passouDoLimite }
}

// Onde nasce a próxima xícara: dentro da caixa, longe das outras e do coração
export function planejarXicara(sorte, l, evitar = [], cfg = EXPRESSO) {
  let melhor = null
  for (let k = 0; k < 12; k++) {
    const p = { x: entre(sorte, l.left + 22, l.right - 22), y: entre(sorte, l.top + 22, l.bottom - 22) }
    const folga = evitar.reduce((m, o) => Math.min(m, dist(p, o)), 1e9)
    if (!melhor || folga > melhor.folga) melhor = { ...p, folga }
    if (folga > 60) break
  }
  return { x: melhor.x, y: melhor.y }
}

// ===================================================================================
// XADREZ: o coração anda como CAVALO (saltos em L) numa caixa de tabuleiro
// ===================================================================================

//   colunas x linhas   o tabuleiro dentro da caixa (cada casa ~37 x 42 px na caixa padrão)
//   recargaMs          tempo entre um salto e outro; vooMs: o salto no ar (sem acerto)
//   limiarJoy          o quanto o direcional precisa passar para mandar um salto
export const XADREZ = { colunas: 6, linhas: 4, recargaMs: 420, vooMs: 150, limiarJoy: 45, cpuDecideMs: 130 }

export const SALTOS = [
  [1, -2], [2, -1], [2, 1], [1, 2],
  [-1, 2], [-2, 1], [-2, -1], [-1, -2],
]

// Os destinos do cavalo na casa (c, r)
export function destinosDoCavalo(c, r, colunas = XADREZ.colunas, linhas = XADREZ.linhas) {
  const lista = []
  for (const [dc, dr] of SALTOS) {
    const nc = c + dc
    const nr = r + dr
    if (nc >= 0 && nr >= 0 && nc < colunas && nr < linhas) lista.push({ c: nc, r: nr, dc, dr })
  }
  return lista
}

export function centroDaCelula(c, r, l, colunas = XADREZ.colunas, linhas = XADREZ.linhas) {
  return { x: l.left + ((c + 0.5) * l.width) / colunas, y: l.top + ((r + 0.5) * l.height) / linhas }
}

export function celulaDoPonto(x, y, l, colunas = XADREZ.colunas, linhas = XADREZ.linhas) {
  return {
    c: limitar(Math.floor(((x - l.left) / l.width) * colunas), 0, colunas - 1),
    r: limitar(Math.floor(((y - l.top) / l.height) * linhas), 0, linhas - 1),
  }
}

// Qual destino o direcional escolhe: o que aponta mais para onde o joystick aponta (em px, não
// em casas). Empate (direcional reto entre dois pulos): o que fica mais perto do meio do
// tabuleiro. Nada escolhido se o joystick está fraco ou longe de todos (cos < 0,45).
export function escolherSalto(destinos, joy, celula, { limiar = XADREZ.limiarJoy, centro = null } = {}) {
  const m = Math.hypot(joy.x, joy.y)
  if (m < limiar || !destinos.length) return null
  let melhor = null
  for (const d of destinos) {
    const vx = d.dc * celula.w
    const vy = d.dr * celula.h
    const cos = (vx * joy.x + vy * joy.y) / (Math.hypot(vx, vy) * m)
    const peso = centro ? -Math.hypot(centro.x - (d.x ?? 0), centro.y - (d.y ?? 0)) * 1e-4 : 0
    if (cos < 0.45) continue
    if (!melhor || cos > melhor.cos + 1e-6 || (Math.abs(cos - melhor.cos) <= 1e-6 && peso > melhor.peso)) melhor = { d, cos, peso }
  }
  return melhor?.d ?? null
}

// O quanto um ponto é perigoso daqui a `ms`: a menor folga (px) até uma bala que ainda vale
// (negativa = em cima dela). `balas`: [{ x, y, vx, vy, raio, aviso?, idade? }] simples.
export function notaDoDestino(p, balas, { ms = 220, hitbox = 4.2, fator = 1 } = {}) {
  let folga = 1e9
  for (const b of balas) {
    const espera = Math.max(0, (b.aviso ?? 0) - (b.idade ?? 0))
    const s = Math.max(0, ms - espera) / 1000
    const bx = b.x + (b.vx ?? 0) * fator * s
    const by = b.y + (b.vy ?? 0) * fator * s
    const f = Math.hypot(p.x - bx, p.y - by) - (b.raio ?? 6) - hitbox
    if (f < folga) folga = f
  }
  return folga
}

// A CPU: de onde está, qual salto vale a pena? Pula só se o ponto de hoje está em perigo (folga
// < `perigo`) e há um destino bem mais seguro; senão fica. Devolve o destino ou null.
export function escolherSaltoDaCpu(destinos, atual, balas, { perigo = 24, ganho = 10, ms = 300 } = {}) {
  const hoje = notaDoDestino(atual, balas, { ms })
  if (hoje >= perigo) return null
  let melhor = null
  for (const d of destinos) {
    const nota = notaDoDestino(d, balas, { ms: 120 }) // a casa só vale a partir do pouso
    const nota2 = Math.min(nota, notaDoDestino(d, balas, { ms: 420 }))
    if (!melhor || nota2 > melhor.nota) melhor = { d, nota: nota2 }
  }
  return melhor && melhor.nota > hoje + ganho ? melhor.d : null
}

// Do tabuleiro inteiro dá para chegar a qualquer casa pulando? (o cavalo nunca fica preso)
export function cavaloConectado(colunas = XADREZ.colunas, linhas = XADREZ.linhas) {
  const vistos = new Set([0])
  const fila = [[0, 0]]
  while (fila.length) {
    const [c, r] = fila.pop()
    for (const d of destinosDoCavalo(c, r, colunas, linhas)) {
      const k = d.c + d.r * colunas
      if (vistos.has(k)) continue
      vistos.add(k)
      fila.push([d.c, d.r])
    }
  }
  return vistos.size === colunas * linhas
}
