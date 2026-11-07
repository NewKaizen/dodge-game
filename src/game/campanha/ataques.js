// Ataques da CAMPANHA (docs/campanha.md): modelos PUROS, sem Phaser, com semente. O servidor
// (server/campanha.js) e o navegador (scenes/CampanhaArena.js) montam o MESMO roteiro de balas a
// partir de { modelo, forca, duracao, semente, caixa }, e as balas andam pelas regras de sempre
// (entities/fisica.js, via campanha/simulacao.js). Por isso o servidor consegue refazer a esquiva
// sozinho a partir das posições do coração e decidir os acertos.
//
//   ATACAVEL_NO_SERVIDOR            os modelos que o servidor simula (o registro `atacavelNoServidor`)
//   atacavelNoServidor(id)          true: o servidor decide os acertos desse ataque
//   criarRoteiro(ataque)            { duracao, gerar(t, alvo) -> opções de bala[] } (t crescente)
//   ataqueDaCartaNaCampanha(carta, { soDeCima, duplo, ... })   a carta -> o ataque (ou null)
//
// O `alvo` que um modelo mira é SEMPRE a última amostra do coração que o navegador mandou
// (campanha/amostras.js): o servidor tem a mesma amostra, então a bala mirada sai igual nos dois.
//
// Regras de justiça (as mesmas do jogo, docs/ataques.md): toda bala nasce FORA da caixa e entra
// (a entrada é o aviso) ou fica parada e inofensiva por >= ATAQUE.telegrafoMs; toda parede deixa
// um buraco >= LACUNA_MINIMA; nada anda mais rápido que VELOCIDADE_MAX.
import { ATAQUE } from '../constants.js'
import { criarRng, aleatorio, inteiro } from '../pvp/baralho.js'
import { LACUNA_MINIMA } from '../attacks/validacao.js'
import { especialDaCarta, ehSuper, forca as forcaDoValor, danoDaCarta } from '../pvp/cartas.js'

export const RAIO = 7
export const ESPACO = 22 // centro a centro numa parede (o coração não passa entre duas bolinhas)
export const BURACO = 64 // o vão de cada parede (px livres, >= LACUNA_MINIMA)
export const AVISO_MIRA = 700 // a semente mirada fica parada (com a linha) antes de voar
export const VELOCIDADE_MAX = 230 // px/s: teto de qualquer bala da campanha
export const LARGURA_FEIXE = 26 // a espessura de um feixe de luz
export const AVISO_FEIXE = 760 // o feixe pisca (inofensivo) antes de acender
export const VIDA_FEIXE = 420 // e fica aceso por isto
export const DISTANCIA_FEIXES = 74 // dois feixes da mesma leva ficam pelo menos isto longe (centro a centro)
export const AVISO_ESTILHACO = 650 // o cristal brilha antes de estourar
export const DISTANCIA_ESTILHACO = 96 // e nasce (se couber) pelo menos isto longe do coração
export const AVISO_GARRA = 560 // a garra fica parada, com a linha do bote, antes de avançar
export const ABERTURA_GARRA = 0.24 // rad entre os dedos da garra (três balas em leque)
export const AVISO_MANDIBULA = 950 // os dentes piscam fora da caixa (com a garganta marcada) antes de fechar
export const GARGANTA = 50 // a faixa livre entre as duas fileiras de dentes (px)
export const MORDIDA_MS = 380 // quanto tempo a boca fica fechada antes de sumir
// o TITÃ (regra.titan): as cartas da SUA mão que você não jogou voam na sua caixa, uma a uma
export const CARTA_BALA = Object.freeze({ largura: 20, altura: 28 }) // a carta inteira machuca
export const AVISO_CARTA = 650 // a carta treme parada embaixo da caixa (com a linha) antes de voar
export const INTERVALO_CARTA = 420 // uma carta a cada tanto
export const VOO_CARTAS = 1100 // depois da última sair, o ataque do titã ainda espera isto
export const DANO_CARTA = 6 // o dano de uma carta quando o titã não jogou nada
// as cartas de mentira dos testes (sem a mão de verdade)
const CARTAS_PADRAO = [1, 2, 3, 4].map((k) => ({ id: `teste-${k}` }))
// quanto o ataque do titã espera as n cartas
export const atrasoDasCartas = (n) => (n > 0 ? 300 + (n - 1) * INTERVALO_CARTA + AVISO_CARTA + VOO_CARTAS : 0)

// força 0..1 -> duração em ms (4 a 7 s, como as cartas do PvP)
export const duracaoDaForca = (f) => Math.round(4000 + 3000 * Math.max(0, Math.min(1, f)))

const lim = (v) => Math.min(VELOCIDADE_MAX, v)

// caixa no formato do manual -> retângulo do Phaser (o que fisica.js espera)
export function limitesDaCaixa(c) {
  return { left: c.esquerda, right: c.direita, top: c.topo, bottom: c.base, width: c.direita - c.esquerda, height: c.base - c.topo }
}

// ---------- peças ----------

function folha(rng, l, alvo, { velocidade, mirar, colunas, ultima }) {
  const passo = l.width / colunas
  let c
  if (mirar) c = Math.min(colunas - 1, Math.max(0, Math.floor((alvo.x - l.left) / passo)))
  else {
    c = inteiro(rng, 0, colunas - 1)
    if (c === ultima.c) c = (c + 1 + inteiro(rng, 0, Math.max(0, colunas - 2))) % colunas
  }
  ultima.c = c
  const v0 = velocidade * 0.42
  const gravidade = (velocidade ** 2 - v0 ** 2) / (2 * Math.max(40, l.height))
  return { x: l.left + passo / 2 + c * passo + (aleatorio(rng) - 0.5) * 0.3 * passo, y: l.top - RAIO - 2, vy: v0, ay: gravidade, raio: RAIO, entrando: true, extra: { tipo: 'folha' } }
}

// o vão de uma parede: longe do anterior, inteiro dentro do eixo
function vaoNovo(rng, min, max, anterior) {
  const a = min + BURACO / 2 + 4
  const b = max - BURACO / 2 - 4
  if (b <= a) return (min + max) / 2
  for (let k = 0; k < 10; k++) {
    const v = a + aleatorio(rng) * (b - a)
    if (anterior === null || Math.abs(v - anterior) >= 60) return v
  }
  return anterior < (a + b) / 2 ? b : a
}

// parede de galhos: entra por um lado e varre a caixa com UM vão (lado: 'esq' | 'dir' | 'cima')
function parede(l, { vao, lado, velocidade }) {
  const v = lim(velocidade)
  const vertical = lado === 'cima'
  const de = vertical ? l.left : l.top
  const ate = vertical ? l.right : l.bottom
  const pos = []
  for (let p = de + RAIO; p <= ate - RAIO + 0.01; p += ESPACO) pos.push(p)
  const livres = pos.filter((p) => p + RAIO <= vao - BURACO / 2 || p - RAIO >= vao + BURACO / 2)
  if (vertical) return livres.map((x) => ({ x, y: l.top - RAIO - 2, vy: v, raio: RAIO, entrando: true, extra: { tipo: 'galho', vao } }))
  const dir = lado === 'esq' ? 1 : -1
  const x = lado === 'esq' ? l.left - RAIO - 2 : l.right + RAIO + 2
  return livres.map((y) => ({ x, y, vx: dir * v, raio: RAIO, entrando: true, extra: { tipo: 'galho', vao } }))
}

// a semente mirada: nasce fora, numa das duas bordas mais longe do coração (só a de cima com soDeCima)
function semente(rng, l, alvo, { velocidade, soDeCima }) {
  const recuo = RAIO + 4
  const lados = soDeCima
    ? [['top', 0]]
    : [
        ['top', alvo.y - l.top],
        ['bottom', l.bottom - alvo.y],
        ['left', alvo.x - l.left],
        ['right', l.right - alvo.x],
      ].sort((p, q) => q[1] - p[1])
  const lado = lados[soDeCima ? 0 : inteiro(rng, 0, 1)][0]
  const t = 0.15 + aleatorio(rng) * 0.7
  const o = {
    top: { x: l.left + t * l.width, y: l.top - recuo },
    bottom: { x: l.left + t * l.width, y: l.bottom + recuo },
    left: { x: l.left - recuo, y: l.top + t * l.height },
    right: { x: l.right + recuo, y: l.top + t * l.height },
  }[lado]
  const a = Math.atan2(alvo.y - o.y, alvo.x - o.x)
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  const v = lim(velocidade)
  return { x: o.x, y: o.y, vx: dx * v, vy: dy * v, raio: RAIO, aviso: Math.max(ATAQUE.telegrafoMs, AVISO_MIRA), extra: { tipo: 'semente', linha: { x: o.x, y: o.y, dx, dy } } }
}

// o redemoinho: papéis entram pelas bordas num ponto que gira em volta da caixa, rumo a um ponto
// perto do meio (nunca parados lá dentro)
function papel(rng, l, k, { velocidade, giro }) {
  const cx = l.left + l.width / 2
  const cy = l.top + l.height / 2
  const ang = giro + k * 0.62
  const r = Math.hypot(l.width, l.height) / 2 + RAIO + 4
  const x = cx + Math.cos(ang) * r
  const y = cy + Math.sin(ang) * r
  const mx = cx + (aleatorio(rng) - 0.5) * l.width * 0.5
  const my = cy + (aleatorio(rng) - 0.5) * l.height * 0.5
  const a = Math.atan2(my - y, mx - x)
  const v = lim(velocidade)
  return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, raio: RAIO - 1, entrando: true, extra: { tipo: 'papel' } }
}

// um feixe de luz: um retângulo que cruza a caixa inteira, parado e AVISANDO (contorno piscando)
// por AVISO_FEIXE ms e depois aceso por VIDA_FEIXE ms (por dentro: 'feixe')
function feixe(l, { vertical, pos }) {
  const meio = LARGURA_FEIXE / 2
  if (vertical) {
    const x = Math.min(l.right - meio, Math.max(l.left + meio, pos))
    return { x, y: l.top + l.height / 2, largura: LARGURA_FEIXE, altura: l.height + 4, aviso: AVISO_FEIXE, vida: VIDA_FEIXE, extra: { tipo: 'feixe', vertical: true } }
  }
  const y = Math.min(l.bottom - meio, Math.max(l.top + meio, pos))
  return { x: l.left + l.width / 2, y, largura: l.width + 4, altura: LARGURA_FEIXE, aviso: AVISO_FEIXE, vida: VIDA_FEIXE, extra: { tipo: 'feixe', vertical: false } }
}

// os estilhaços: um cristal aparece LONGE do coração, brilha (aviso) e estoura em leque
function estilhacos(rng, l, alvo, { velocidade, n }) {
  const m = 26
  let melhor = null
  for (let k = 0; k < 14; k++) {
    const x = l.left + m + aleatorio(rng) * Math.max(1, l.width - 2 * m)
    const y = l.top + m + aleatorio(rng) * Math.max(1, l.height - 2 * m)
    const d = Math.hypot(x - alvo.x, y - alvo.y)
    if (!melhor || d > melhor.d) melhor = { x, y, d }
    if (d >= DISTANCIA_ESTILHACO) break
  }
  const giro = aleatorio(rng) * Math.PI * 2
  const v = lim(velocidade)
  const out = []
  for (let k = 0; k < n; k++) {
    const a = giro + (k * Math.PI * 2) / n
    out.push({ x: melhor.x, y: melhor.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, raio: RAIO - 1, aviso: AVISO_ESTILHACO, extra: { tipo: 'estilhaco', centro: { x: melhor.x, y: melhor.y } } })
  }
  return out
}

// a garra: três dedos em leque, parados fora da caixa (com a linha do bote) e depois avançando rápido
// no lugar onde o coração ESTAVA quando ela apareceu (por dentro: 'garra')
function garra(rng, l, alvo, { velocidade, lado }) {
  const recuo = RAIO + 5
  const t = 0.12 + aleatorio(rng) * 0.76
  const o = {
    top: { x: l.left + t * l.width, y: l.top - recuo },
    bottom: { x: l.left + t * l.width, y: l.bottom + recuo },
    left: { x: l.left - recuo, y: l.top + t * l.height },
    right: { x: l.right + recuo, y: l.top + t * l.height },
  }[lado]
  const a = Math.atan2(alvo.y - o.y, alvo.x - o.x)
  const v = lim(velocidade)
  return [-1, 0, 1].map((k) => {
    const ang = a + k * ABERTURA_GARRA
    return { x: o.x, y: o.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, raio: RAIO - 1, aviso: AVISO_GARRA, entrando: false, extra: { tipo: 'garra', linha: { x: o.x, y: o.y, dx: Math.cos(ang), dy: Math.sin(ang) }, dedo: k } }
  })
}

// a mandíbula: uma fileira de dentes em cima e outra embaixo (fora da caixa, piscando, com a garganta
// marcada); depois fecham até a garganta, ficam fechadas MORDIDA_MS e somem (por dentro: 'dente')
function mandibula(rng, l, { velocidade }) {
  const v = lim(velocidade)
  const g = Math.min(GARGANTA, Math.max(26, l.height - 40))
  const topoG = l.top + 10 + aleatorio(rng) * Math.max(0, l.height - g - 20)
  const baseG = topoG + g
  const faixa = { topo: topoG, base: baseG, esquerda: l.left, direita: l.right }
  const xs = []
  for (let x = l.left + RAIO; x <= l.right - RAIO + 0.01; x += ESPACO) xs.push(x)
  const saida = []
  // de cima: o centro do dente para a RAIO da garganta; de baixo, igual
  const y0 = l.top - RAIO - 2
  const y1 = l.bottom + RAIO + 2
  const tCima = Math.max(0, (topoG - RAIO - y0) / v) * 1000
  const tBaixo = Math.max(0, (y1 - (baseG + RAIO)) / v) * 1000
  for (const x of xs) {
    saida.push({ x, y: y0, vy: v, raio: RAIO, aviso: AVISO_MANDIBULA, entrando: false, arranque: { ms: tCima, vx: 0, vy: 0 }, vida: tCima + MORDIDA_MS, extra: { tipo: 'dente', de: 'cima', faixa } })
    saida.push({ x, y: y1, vy: -v, raio: RAIO, aviso: AVISO_MANDIBULA, entrando: false, arranque: { ms: tBaixo, vx: 0, vy: 0 }, vida: tBaixo + MORDIDA_MS, extra: { tipo: 'dente', de: 'baixo', faixa } })
  }
  return saida
}

// uma carta da sua mão: parada embaixo da caixa (o lado da mão, na tela), tremendo; depois voa no
// lugar onde o coração estava e quica uma vez nas paredes (por dentro: 'carta')
function cartaArremessada(rng, l, alvo, { i, n, id, velocidade }) {
  const x = l.left + (l.width * (i + 1)) / (n + 1)
  const y = l.bottom + CARTA_BALA.altura / 2 + 3
  const a = Math.atan2(alvo.y - y, alvo.x - x) + (aleatorio(rng) - 0.5) * 0.22
  const v = lim(velocidade)
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  return { x, y, vx: dx * v, vy: dy * v, largura: CARTA_BALA.largura, altura: CARTA_BALA.altura, aviso: AVISO_CARTA, entrando: false, quicar: 1, extra: { tipo: 'carta', carta: id, i, linha: { x, y, dx, dy } } }
}

// ---------- os modelos ----------
// eventos(rng, l, p) -> [{ t, gerar(rng, l, alvo) -> opções[] }]   p: { forca, duracao, soDeCima }
const MODELOS = {
  // cinzas que caem acelerando; uma em cada três cai na faixa do coração (por dentro: 'folha')
  chuva: {
    nome: 'Cinzas que caem',
    deCima: true,
    eventos(rng, l, p) {
      const ev = []
      const ultima = { c: -1 }
      const colunas = Math.max(3, Math.floor(l.width / 34))
      const intervalo = 520 - 250 * p.forca
      const velocidade = 110 + 80 * p.forca
      let k = 0
      for (let t = 200; t < p.duracao - 900; t += intervalo + aleatorio(rng) * 80, k++) {
        const mirar = k % 3 === 2
        ev.push({ t, gerar: (r, ll, alvo) => [folha(r, ll, alvo, { velocidade, mirar, colunas, ultima })] })
      }
      return ev
    },
  },
  // paredes com uma fresta, da esquerda e da direita (de cima, com soDeCima) (por dentro: 'galho')
  galhos: {
    nome: 'Paredes com uma fresta',
    eventos(rng, l, p) {
      const ev = []
      const passo = 2500 - 900 * p.forca
      const velocidade = 80 + 55 * p.forca
      let anterior = null
      let n = 0
      for (let t = 300; t < p.duracao - 1300; t += passo, n++) {
        const lado = p.soDeCima ? 'cima' : n % 2 === 0 ? 'esq' : 'dir'
        ev.push({
          t,
          gerar: (r, ll) => {
            anterior = lado === 'cima' ? vaoNovo(r, ll.left, ll.right, anterior) : vaoNovo(r, ll.top, ll.bottom, anterior)
            return parede(ll, { vao: anterior, lado, velocidade })
          },
        })
      }
      return ev
    },
  },
  // olhares que miram no coração (parados com a linha antes de voar) (por dentro: 'semente')
  sementes: {
    nome: 'Olhares',
    eventos(rng, l, p) {
      const ev = []
      const passo = 1450 - 600 * p.forca
      const velocidade = 125 + 85 * p.forca
      for (let t = 350; t < p.duracao - 1300; t += passo) ev.push({ t, gerar: (r, ll, alvo) => [semente(r, ll, alvo, { velocidade, soDeCima: p.soDeCima })] })
      return ev
    },
  },
  // mariposas girando pelas bordas, em volta da luz (por dentro: 'papel')
  redemoinho: {
    nome: 'Mariposas',
    eventos(rng, l, p) {
      const ev = []
      const passo = 330 - 150 * p.forca
      const velocidade = 85 + 60 * p.forca
      const giro = aleatorio(rng) * Math.PI * 2
      let k = 0
      for (let t = 250; t < p.duracao - 900; t += passo, k++) {
        const i = k
        ev.push({ t, gerar: (r, ll) => [papel(r, ll, i, { velocidade, giro })] })
      }
      return ev
    },
  },
  // feixes de luz que cruzam a caixa: o primeiro cai na linha do coração (com aviso), os outros
  // longe dele; alternam de pé e deitados (por dentro: 'feixe')
  feixes: {
    nome: 'Feixes de luz',
    eventos(rng, l, p) {
      const ev = []
      const passo = 1350 - 420 * p.forca
      const quantos = p.forca >= 0.6 ? 2 : 1
      let n = 0
      for (let t = 300; t < p.duracao - AVISO_FEIXE - VIDA_FEIXE; t += passo, n++) {
        const vertical = n % 2 === 0
        ev.push({
          t,
          gerar: (r, ll, alvo) => {
            const [de, ate, mira] = vertical ? [ll.left, ll.right, alvo.x] : [ll.top, ll.bottom, alvo.y]
            const pos = [mira]
            for (let k = 1; k < quantos; k++) {
              let q = null
              for (let j = 0; j < 10 && q === null; j++) {
                const c = de + LARGURA_FEIXE / 2 + aleatorio(r) * Math.max(1, ate - de - LARGURA_FEIXE)
                if (pos.every((x) => Math.abs(x - c) >= DISTANCIA_FEIXES)) q = c
              }
              if (q !== null) pos.push(q)
            }
            return pos.map((x) => feixe(ll, { vertical, pos: x }))
          },
        })
      }
      return ev
    },
  },
  // cristais que estouram em leque, longe do coração (por dentro: 'estilhaco')
  estilhacos: {
    nome: 'Estilhaços',
    eventos(rng, l, p) {
      const ev = []
      const passo = 1600 - 550 * p.forca
      const velocidade = 105 + 70 * p.forca
      const n = 7 + Math.round(3 * p.forca)
      for (let t = 300; t < p.duracao - 1500; t += passo) ev.push({ t, gerar: (r, ll, alvo) => estilhacos(r, ll, alvo, { velocidade, n }) })
      return ev
    },
  },
  // garras que dão o bote em leque, de lados diferentes (por dentro: 'garra')
  garras: {
    nome: 'Garras',
    eventos(rng, l, p) {
      const ev = []
      const passo = 1250 - 430 * p.forca
      const velocidade = 175 + 55 * p.forca
      const lados = ['left', 'top', 'right', 'bottom']
      let n = inteiro(rng, 0, 3)
      for (let t = 300; t < p.duracao - AVISO_GARRA - 900; t += passo) {
        const lado = lados[n++ % 4]
        ev.push({ t, gerar: (r, ll, alvo) => garra(r, ll, alvo, { velocidade, lado }) })
        // forte: uma segunda garra logo depois, do lado oposto
        if (p.forca >= 0.55) {
          const oposto = lados[(n + 1) % 4]
          ev.push({ t: t + 260, gerar: (r, ll, alvo) => garra(r, ll, alvo, { velocidade, lado: oposto }) })
        }
      }
      return ev
    },
  },
  // o titã arremessa as SUAS cartas (as que ficaram na mão), uma a uma, de baixo (por dentro: 'carta')
  cartas: {
    nome: 'Suas cartas',
    eventos(rng, l, p) {
      const lista = p.cartas?.length ? p.cartas : CARTAS_PADRAO
      const velocidade = 170 + 45 * p.forca
      return lista.map((c, i) => ({ t: 300 + i * INTERVALO_CARTA, gerar: (r, ll, alvo) => [cartaArremessada(r, ll, alvo, { i, n: lista.length, id: String(c.id), velocidade })] }))
    },
  },
  // a boca do Silêncio: fecha de cima e de baixo; só a garganta fica livre (por dentro: 'dente')
  mandibula: {
    nome: 'Mandíbula',
    eventos(rng, l, p) {
      const ev = []
      const passo = 2300 - 650 * p.forca
      const velocidade = 120 + 70 * p.forca
      for (let t = 300; t < p.duracao - AVISO_MANDIBULA - 1100; t += passo) ev.push({ t, gerar: (r, ll) => mandibula(r, ll, { velocidade }) })
      return ev
    },
  },
}

// os modelos que o servidor simula sozinho (todos os da campanha, hoje): docs/campanha.md
export const ATACAVEL_NO_SERVIDOR = Object.freeze(Object.keys(MODELOS))
export const atacavelNoServidor = (id) => ATACAVEL_NO_SERVIDOR.includes(id)
export const nomeDoModelo = (id) => MODELOS[id]?.nome ?? id

// soDeCima: troca o modelo por um que só vem de cima
const DE_CIMA = { redemoinho: 'chuva', estilhacos: 'chuva', feixes: 'galhos', garras: 'chuva', mandibula: 'galhos', cartas: 'chuva' }
const deCimaDe = (id) => DE_CIMA[id] ?? id

// ataque = { modelos: [id, ...], forca, duracao, semente, caixa, soDeCima? }
//   vários modelos = todos ao mesmo tempo (o chefe), cada um com a sua semente derivada
//   ataque.cartas: as cartas arremessadas pelo titã (modelo 'cartas'); os outros modelos esperam elas
export function criarRoteiro(ataque) {
  const l = limitesDaCaixa(ataque.caixa)
  const p = { forca: Number(ataque.forca) || 0, duracao: ataque.duracao, soDeCima: Boolean(ataque.soDeCima), cartas: ataque.cartas ?? null }
  const comCartas = !p.soDeCima && ataque.modelos.includes('cartas')
  const atraso = comCartas ? atrasoDasCartas(p.cartas?.length || CARTAS_PADRAO.length) : 0
  const listas = ataque.modelos.map((id, i) => {
    const m = MODELOS[ataque.soDeCima ? deCimaDe(id) : id]
    if (!m) throw new Error(`modelo de ataque desconhecido: ${id}`)
    const rng = criarRng(`${ataque.semente}:${i}:${id}`)
    const eventos = m.eventos(rng, l, p).map((e) => (id === 'cartas' || !atraso ? e : { ...e, t: e.t + atraso }))
    return { rng, eventos: eventos.sort((a, b) => a.t - b.t), prox: 0 }
  })
  return {
    duracao: ataque.duracao,
    gerar(t, alvo) {
      const saida = []
      for (const ls of listas) while (ls.prox < ls.eventos.length && ls.eventos[ls.prox].t <= t) saida.push(...ls.eventos[ls.prox++].gerar(ls.rng, l, alvo))
      return saida
    },
  }
}

// ---------- carta -> ataque ----------

// o naipe decide o modelo; o Ás manda o ataque leve do naipe dele; o SUPER junta dois
const MODELO_DO_NAIPE = { espadas: 'galhos', ouros: 'sementes', paus: 'redemoinho', copas: 'chuva' }
const FORCA_DO_ESPECIAL = { espelho: 7, anular: 5, roubo: 5 }

// O ataque de uma carta na campanha (sem caixa e sem semente: a partida põe), ou null (Ás de copas).
//   regra.soDeCima   todo ataque vem de cima (modelo trocado)
//   regra.duplo      o chefe: dois modelos juntos (o do naipe + chuva/sementes)
export function ataqueDaCartaNaCampanha(carta, regra = {}) {
  if (!carta) return null
  const especial = especialDaCarta(carta)
  if (especial === 'segundaChance') return null
  let modelos
  let f
  if (ehSuper(carta)) {
    modelos = ['galhos', 'sementes']
    f = 1
  } else if (especial) {
    modelos = [MODELO_DO_NAIPE[especial === 'espelho' ? 'espadas' : carta.naipe]]
    f = forcaDoValor(FORCA_DO_ESPECIAL[especial])
  } else if (carta.naipe === 'copas') {
    modelos = ['chuva']
    f = 0.15 // o ataque fraquinho do suporte
  } else {
    modelos = [MODELO_DO_NAIPE[carta.naipe]]
    f = forcaDoValor(carta.valor)
  }
  if (regra.duplo && modelos.length === 1) modelos = [...modelos, modelos[0] === 'chuva' ? 'sementes' : 'chuva']
  return { modelos, forca: Math.round(f * 1000) / 1000, duracao: duracaoDaForca(f) + (modelos.length > 1 ? 1000 : 0), dano: danoDaCarta(carta), soDeCima: Boolean(regra.soDeCima), ...(ehSuper(carta) ? { super: true } : {}) }
}

// A ASSINATURA do oponente (fase.assinatura): o ataque que a CPU manda na SUA caixa troca o modelo
// do naipe pelo golpe de quem está do outro lado (um por rodada, em rodízio, se for uma lista). O
// SUPER e os modelos extras (duplo) continuam. Mesma força; a duração é refeita.
export function comAssinatura(ataque, assinatura, rodada = 1) {
  if (!ataque || !assinatura) return ataque
  const lista = Array.isArray(assinatura) ? assinatura : [assinatura]
  if (!lista.length || ataque.super) return ataque
  // um item da lista pode ser um combo: ['garras', 'chuva'] = os dois juntos
  const m = lista[(Math.max(1, rodada) - 1) % lista.length]
  const proprios = Array.isArray(m) ? m : [m]
  let modelos = [...proprios, ...ataque.modelos.slice(1)]
  modelos = modelos.filter((x, i) => modelos.indexOf(x) === i).slice(0, 3)
  if (modelos.length === 1 && ataque.modelos.length > 1) modelos.push(proprios[0] === 'chuva' ? 'sementes' : 'chuva')
  return { ...ataque, modelos, duracao: duracaoDaForca(ataque.forca) + (modelos.length > 1 ? 1000 : 0) }
}

// O ARREMESSO do titã: as cartas que ficaram na sua mão vêm antes do ataque dele (que espera por elas).
// Sem ataque do titã nesta rodada, só as cartas.
//   cartas: [{ id, ... }] (as que você NÃO jogou) · base: { caixa, semente, dano? }
export function comArremesso(ataque, cartas, base) {
  if (!cartas?.length) return ataque
  const lista = cartas.map((c) => ({ id: String(c.id), personagem: c.personagem, naipe: c.naipe, valor: c.valor }))
  const atraso = atrasoDasCartas(lista.length)
  if (!ataque) return { modelos: ['cartas'], forca: 0.5, duracao: atraso + 700, dano: base.dano ?? DANO_CARTA, soDeCima: false, cartas: lista }
  return { ...ataque, modelos: ['cartas', ...ataque.modelos.filter((m) => m !== 'cartas')], cartas: lista, duracao: ataque.duracao + atraso }
}

// A PRESSÃO da fase (fase.pressao, 0..0.5): o que vem na sua caixa fica mais forte (mais denso e
// rápido) quanto mais funda a escada
export function comPressao(ataque, pressao = 0) {
  if (!ataque || !pressao) return ataque
  const forca = Math.min(1, Math.round((ataque.forca + pressao) * 1000) / 1000)
  return { ...ataque, forca, duracao: duracaoDaForca(forca) + (ataque.modelos.length > 1 ? 1000 : 0) }
}

// A FÚRIA do chefe (regra.furia): mais forte e mais longo
export function comFuria(ataque) {
  if (!ataque) return ataque
  const forca = Math.min(1, Math.round((ataque.forca + 0.3) * 1000) / 1000)
  return { ...ataque, forca, duracao: duracaoDaForca(forca) + (ataque.modelos.length > 1 ? 1000 : 0) + 500 }
}

export { LACUNA_MINIMA }
