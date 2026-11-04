import { ATAQUE } from '../constants.js'
import { criarRng, aleatorio, inteiro } from '../pvp/baralho.js'
import { LACUNA_MINIMA, lacunasLivres } from '../attacks/validacao.js'
import { andarBala, folgaDaBala, foraDaCaixa, passoDoCoracao } from '../entities/fisica.js'
import { limitesDe } from './onda.js'

// Os padrões da PÁGINA 2 do Manual do Ralsei ("Vamos desviar?"), sem Phaser e com semente:
// a mesma semente dá sempre as mesmas balas. Cada padrão é um ROTEIRO de balas no formato de
// a.bala({...}) (entities/Bullets.js), as versões mansas de ataques de verdade:
//
//   chuva    gotas que nascem logo acima da caixa e caem acelerando (attacks/rain.js: entrando,
//            gravidade v² = v0² + 2·g·h); parte delas cai na faixa do coração
//   linha    uma fileira de bolinhas que entra de lado e varre a caixa com UM buraco
//            (rota de fuga >= LACUNA_MINIMA, conferida por validacao.lacunasLivres)
//   mira     tiros que miram no coração; antes, uma linha pontilhada mostra o caminho: a bala fica
//            PARADA e inofensiva durante o aviso (opção `aviso` de a.bala, >= ATAQUE.telegrafoMs)
//   mistura  os três, curtinho e ainda gentil
//
//   const r = criarRoteiro('chuva', caixa, { semente, duracao })
//   r.gerar(t, coracao)   as opções de bala que nascem até o ms `t` (chame com t crescente)
//   r.duracao             quanto o jogador precisa sobreviver
//
//   pilotoDeDesvio(balas, coracao, caixa, velocidade)   o joy (-100..100) de quem desvia bem:
//            a demonstração (o coração de giz do Ralsei) e os testes de "dá para passar"

export const RAIO_GOTA = 7
export const RAIO_FILA = 7
export const RAIO_TIRO = 7
export const ESPACO_FILA = 22 // centro a centro: bolinhas de raio 7 com 8 px entre elas (o coração não passa)
export const BURACO = 66 // o buraco da fileira (px livres), bem acima de LACUNA_MINIMA
export const AVISO_MIRA = 950 // ms da linha pontilhada (bala parada) antes do tiro

// as quatro mini-lições: id, quanto sobreviver (ms) e quanto dura a demonstração
export const LICOES = [
  { id: 'chuva', titulo: 'Chuva de cima', duracao: 6000, demo: 3600 },
  { id: 'linha', titulo: 'Linha de lado', duracao: 7000, demo: 4200 },
  { id: 'mira', titulo: 'Mira em você', duracao: 6500, demo: 3800 },
  { id: 'mistura', titulo: 'Mistura curta', duracao: 10000, demo: 0 },
]

// ---------- cada padrão: uma lista de "eventos" { t, gerar(rng, l, coracao) -> opções[] } ----------

function gota(rng, l, coracao, { velocidade = 95, partida = 0.45, mirar = false, colunas = 9, ultima = { c: -1 } } = {}) {
  const passo = l.width / colunas
  let c
  if (mirar) c = Math.min(colunas - 1, Math.max(0, Math.floor((coracao.x - l.left) / passo)))
  else {
    c = inteiro(rng, 0, colunas - 1)
    if (c === ultima.c) c = (c + 1 + inteiro(rng, 0, colunas - 2)) % colunas
  }
  ultima.c = c
  const v0 = velocidade * partida
  const gravidade = (velocidade ** 2 - v0 ** 2) / (2 * l.height)
  return {
    x: l.left + passo / 2 + c * passo + (aleatorio(rng) - 0.5) * 0.3 * passo,
    y: l.top - RAIO_GOTA - 2, // logo acima da caixa: entra caindo (a entrada pela borda é o aviso)
    vy: v0,
    ay: gravidade,
    raio: RAIO_GOTA,
    entrando: true,
    origem: 'manual:chuva',
    extra: { tipo: 'gota' },
  }
}

// a fileira que varre a caixa: bolinhas de cima a baixo, menos as do buraco
export function fileira(l, { buraco, lado = 'esq', velocidade = 82 }) {
  const dir = lado === 'esq' ? 1 : -1
  const x = lado === 'esq' ? l.left - RAIO_FILA - 2 : l.right + RAIO_FILA + 2
  const ys = []
  for (let y = l.top + RAIO_FILA; y <= l.bottom - RAIO_FILA + 0.01; y += ESPACO_FILA) ys.push(y)
  // bolinha que invade o buraco sai: o vão livre (entre bordas) fica >= BURACO
  const livres = ys.filter((y) => y + RAIO_FILA <= buraco - BURACO / 2 || y - RAIO_FILA >= buraco + BURACO / 2)
  return livres.map((y) => ({ x, y, vx: dir * velocidade, raio: RAIO_FILA, entrando: true, origem: 'manual:linha', extra: { tipo: 'fila', buraco } }))
}

// o buraco: longe do anterior (precisa andar até ele), sempre inteiro dentro da caixa
function buracoNovo(rng, l, anterior) {
  const min = l.top + BURACO / 2 + 4
  const max = l.bottom - BURACO / 2 - 4
  for (let k = 0; k < 12; k++) {
    const y = min + aleatorio(rng) * (max - min)
    if (anterior === null || Math.abs(y - anterior) >= 70) return y
  }
  return anterior < (min + max) / 2 ? max : min
}

// o tiro: nasce fora da caixa, numa das 2 bordas mais longe do coração (attacks/aimed.js), mira nele
export function tiro(rng, l, coracao, { velocidade = 110, aviso = AVISO_MIRA } = {}) {
  const recuo = RAIO_TIRO + 4
  const lados = [
    ['top', coracao.y - l.top],
    ['bottom', l.bottom - coracao.y],
    ['left', coracao.x - l.left],
    ['right', l.right - coracao.x],
  ].sort((p, q) => q[1] - p[1])
  const lado = lados[inteiro(rng, 0, 1)][0]
  const t = 0.2 + aleatorio(rng) * 0.6
  const o = {
    top: { x: l.left + t * l.width, y: l.top - recuo },
    bottom: { x: l.left + t * l.width, y: l.bottom + recuo },
    left: { x: l.left - recuo, y: l.top + t * l.height },
    right: { x: l.right + recuo, y: l.top + t * l.height },
  }[lado]
  const a = Math.atan2(coracao.y - o.y, coracao.x - o.x)
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  // parada e inofensiva durante o `aviso` (a linha pontilhada é o telégrafo); depois anda reto
  return { x: o.x, y: o.y, vx: dx * velocidade, vy: dy * velocidade, raio: RAIO_TIRO, aviso: Math.max(ATAQUE.telegrafoMs, aviso), origem: 'manual:mira', extra: { tipo: 'tiro', linha: { x: o.x, y: o.y, dx, dy } } }
}

function eventosDe(id, rng, duracao) {
  const ev = []
  const ultima = { c: -1 }
  if (id === 'chuva') {
    // uma gota a cada ~430 ms; 1 em cada 3 cai na faixa do coração (ficar parado não é seguro)
    let k = 0
    for (let t = 0; t < duracao - 900; t += 380 + aleatorio(rng) * 100, k++) {
      const mirar = k % 3 === 2
      ev.push({ t, gerar: (r, l, c) => [gota(r, l, c, { mirar, ultima })] })
    }
  } else if (id === 'linha') {
    let anterior = null
    for (let t = 300; t < duracao - 1200; t += 2300) {
      ev.push({
        t,
        gerar: (r, l) => {
          anterior = buracoNovo(r, l, anterior)
          return fileira(l, { buraco: anterior, lado: 'esq' })
        },
      })
    }
  } else if (id === 'mira') {
    for (let t = 400; t < duracao - 1400; t += 1350) ev.push({ t, gerar: (r, l, c) => [tiro(r, l, c)] })
  } else if (id === 'mistura') {
    // 0-2,2 s chuva fraquinha · fileira da esquerda · 2 tiros · fileira da direita · chuva e 1 tiro
    for (let t = 0; t < 2200; t += 560) ev.push({ t, gerar: (r, l, c) => [gota(r, l, c, { ultima })] })
    let anterior = null
    ev.push({ t: 2000, gerar: (r, l) => fileira(l, { buraco: (anterior = buracoNovo(r, l, anterior)), lado: 'esq' }) })
    ev.push({ t: 3300, gerar: (r, l, c) => [tiro(r, l, c)] })
    ev.push({ t: 4700, gerar: (r, l, c) => [tiro(r, l, c)] })
    ev.push({ t: 6400, gerar: (r, l) => fileira(l, { buraco: (anterior = buracoNovo(r, l, anterior)), lado: 'dir' }) })
    for (let t = 6800, k = 0; t < duracao - 900; t += 620, k++) ev.push({ t, gerar: (r, l, c) => [gota(r, l, c, { ultima, mirar: k === 2 })] })
    ev.push({ t: 8000, gerar: (r, l, c) => [tiro(r, l, c)] })
  }
  return ev.sort((a, b) => a.t - b.t)
}

export function criarRoteiro(id, caixa, { semente = `manual:p2:${id}`, duracao } = {}) {
  const licao = LICOES.find((x) => x.id === id)
  if (!licao) throw new Error(`padrão desconhecido: ${id}`)
  const dura = duracao ?? licao.duracao
  const rng = criarRng(semente)
  const l = { ...limitesDe(caixa) }
  l.width = l.right - l.left
  l.height = l.bottom - l.top
  const eventos = eventosDe(id, rng, dura)
  let prox = 0
  return {
    id,
    duracao: dura,
    eventos: eventos.length,
    gerar(t, coracao) {
      const saida = []
      while (prox < eventos.length && eventos[prox].t <= t) saida.push(...eventos[prox++].gerar(rng, l, coracao))
      return saida
    },
    get acabou() {
      return prox >= eventos.length
    },
  }
}

// a maior rota de fuga de uma fileira (px livres entre as bolinhas, de cima a baixo da caixa)
export function maiorLacunaDaFileira(balas, l) {
  const livres = lacunasLivres(l.top, l.bottom, balas.map((b) => [b.y - b.raio, b.y + b.raio]))
  return Math.max(0, ...livres.map(([a, b]) => b - a))
}
export { LACUNA_MINIMA }

// ---------- quem desvia bem (a demonstração e os testes) ----------

const DIRECOES = [[0, 0], ...Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)])]
const copia = (b) => ({ ...b, arranque: b.arranque && { ...b.arranque } })

// Para cada direção (ou ficar parado), anda o coração e as balas `horizonte` ms para a frente (as
// mesmas regras de fisica.js) e fica com a direção de maior folga; empate: a que fica mais perto
// do meio da caixa. Devolve o joy (-100..100).
export function pilotoDeDesvio(balas, coracao, caixa, velocidade, { horizonte = 500, passo = 50, hitbox = 4.2, meio = 8 } = {}) {
  const l = limitesDe(caixa)
  const cx = (l.left + l.right) / 2
  const cy = (l.top + l.bottom) / 2 + (l.bottom - l.top) * 0.15
  let melhor = null
  for (const [dx, dy] of DIRECOES) {
    const c = { x: coracao.x, y: coracao.y }
    const bs = balas.map(copia)
    let pior = Infinity
    for (let t = passo; t <= horizonte; t += passo) {
      passoDoCoracao(c, { x: dx * 100, y: dy * 100 }, velocidade, passo, l, meio)
      for (const b of bs) {
        b.idade += passo
        if (b.idade < b.aviso) {
          // telegrafando: a bala vai sair pela linha; quem está nela já conta como "no caminho"
          if (b.extra?.linha) pior = Math.min(pior, folgaDaLinha(b, c) - hitbox + 6 + (b.aviso - b.idade) / 60)
          continue
        }
        andarBala(b, passo)
        if (foraDaCaixa(b, l)) continue
        const f = folgaDaBala(b, c.x, c.y) - hitbox
        pior = Math.min(pior, f + (t / horizonte) * 6) // perto no tempo pesa mais
      }
    }
    const nota = Math.min(pior, 40) - Math.hypot(c.x - cx, c.y - cy) * 0.02 - (dx || dy ? 0.4 : 0)
    if (!melhor || nota > melhor.nota) melhor = { nota, dx, dy }
  }
  return { x: Math.round(melhor.dx * 100), y: Math.round(melhor.dy * 100) }
}

// distância do coração à reta que o tiro vai percorrer (só para frente da origem)
function folgaDaLinha(b, c) {
  const { x, y, dx, dy } = b.extra.linha
  const t = Math.max(0, (c.x - x) * dx + (c.y - y) * dy)
  return Math.hypot(c.x - (x + dx * t), c.y - (y + dy * t)) - b.raio
}
