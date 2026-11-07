// O ATAQUE DE VERDADE de uma carta (o mesmo do PvP: ataqueDaCarta + a biblioteca attacks/, rodados pelo
// ContextoAtaque e pela classe Balas reais) caindo na caixa da CPU na campanha (docs/campanha.md).
// Sem Phaser (attacks/ só usa phaserPuro.js), então o SERVIDOR roda isto: a CPU desvia (pvp/botEsquiva.js,
// com sorteio de semente) e é o servidor quem conta os acertos nela. O navegador repete o mesmo ataque,
// com a mesma semente e o coração da CPU andando pelas amostras que o servidor mandou, só para desenhar.
//
//   const e = criarAtaqueReal(cena, { carta, dano, ritmo, semente, coracao })
//     e.passo(dt?)        um passo fixo (PASSO_MS): o ataque, as balas, o acerto no coração
//     e.balas · e.duracao · e.acertos · e.grazes · e.acabou · e.parar()
//   simularCpuReal({ carta, dano, ritmo, semente }, { nivel, semente })
//                       -> { acertos, grazes, amostras (lista plana [t, x, y] em décimos de px), duracao }
//
// A caixa da CPU fica numa região do mundo FORA da tela (CAIXA_REAL): no navegador uma câmera só dela
// mostra a região, reduzida, no canto da arena (como a vitrine do Manual do Ralsei).
import ContextoAtaque from '../attacks/contexto.js'
import Balas from '../entities/Bullets.js'
import { ataques } from '../attacks/index.js'
import { ataqueDaCarta, TEMAS } from '../pvp/cartas.js'
import { ATAQUE, CORACAO, TEMPOS } from '../constants.js'
import { passoDoCoracao } from '../entities/fisica.js'
import { EsquivaBot } from '../pvp/botEsquiva.js'
import { criarRng, aleatorio } from '../pvp/baralho.js'
import { PASSO_MS, MEIO } from './amostras.js'

// a caixa de cada jogador no PvP (a mesma da vitrine e da PvpArena), longe da tela de 854×480
export const CAIXA_REAL = Object.freeze({ x: 6000, y: 3000, largura: 220, altura: 170 })
export const VELOCIDADE_MAX_REAL = 300 // o teto das balas na arena PvP
export const PASSOS_POR_AMOSTRA = 3 // o servidor manda uma posição da CPU a cada 3 passos (48 ms)

export function limitesReais(c = CAIXA_REAL) {
  return { x: c.x, y: c.y, width: c.largura, height: c.altura, left: c.x, top: c.y, right: c.x + c.largura, bottom: c.y + c.altura, centerX: c.x + c.largura / 2, centerY: c.y + c.altura / 2 }
}

export const inicioReal = (l = limitesReais()) => ({ x: l.left + l.width / 2, y: l.bottom - 30 })

// o ataque da carta, do jeito do PvP, numa caixa que não muda de forma (como a vitrine); null = não ataca
export const ataqueRealDaCarta = (carta) => (carta ? ataqueDaCarta(carta, { ataques, caixaFixa: true }) : null)

// uma cena sem tela: todo objeto aceita qualquer chamada e devolve ele mesmo (o servidor não desenha)
function objetoSemTela() {
  const alvo = { x: 0, y: 0, scaleX: 1, scaleY: 1, alpha: 1, rotation: 0, angle: 0, width: 1, height: 1, visible: true, type: 'Nada' }
  const p = new Proxy(alvo, {
    get(o, k) {
      if (k in o) return o[k]
      if (k === 'then') return undefined
      return (...args) => {
        if (k === 'setPosition') {
          o.x = args[0]
          o.y = args[1] ?? args[0]
        }
        if (k === 'setAlpha') o.alpha = args[0]
        return p
      }
    },
    set(o, k, v) {
      o[k] = v
      return true
    },
  })
  return p
}

export function cenaSemTela() {
  const add = new Proxy({}, { get: () => () => objetoSemTela() })
  return {
    add,
    make: add,
    anims: { exists: () => true, create() {} },
    tweens: { add() {}, addCounter() {}, killTweensOf() {}, chain() {} },
    time: { delayedCall() {}, addEvent() {}, now: 0 },
    cache: { audio: { exists: () => false } },
    sound: { play() {}, add: () => objetoSemTela() },
    registry: { get: () => undefined },
    events: { on() {}, once() {}, off() {}, emit() {} },
    cameras: { main: objetoSemTela() },
    textures: { exists: () => true },
    sys: { isActive: () => true },
  }
}

// o ataque rodando: o mesmo relógio da Pista (respiro, o ataque, desarmar no fim)
//   coracao: { x, y } (movido por fora a cada passo). É o MESMO objeto que o ataque enxerga: os ataques
//   que empurram o coração (gelo, gravidade, ímã) mexem nele e chamam coracao.ajustar() (como Heart.js)
export function criarAtaqueReal(cena, { carta, dano, ritmo = {}, semente, limites = limitesReais(), coracao }) {
  const ataque = ataqueRealDaCarta(carta)
  if (!ataque) return null
  const caixa = { limites, recortar() {}, aproximar() {}, tremer() {}, mudarPara: () => false }
  const balas = new Balas(cena, caixa)
  balas.velocidadeMax = VELOCIDADE_MAX_REAL
  const r = { velocidade: 1, densidade: 1, ...ritmo }
  balas.fatorVelocidade = r.velocidade
  const alvo = Object.assign(coracao, {
    ativo: true,
    jogador: 1,
    hitbox: CORACAO.hitbox,
    graze: CORACAO.graze,
    invencivel: 0,
    tamanho: 1,
    // Heart.ajustar: o coração empurrado não sai da caixa
    ajustar() {
      alvo.x = Math.max(limites.left + MEIO, Math.min(limites.right - MEIO, alvo.x))
      alvo.y = Math.max(limites.top + MEIO, Math.min(limites.bottom - MEIO, alvo.y))
    },
  })
  const ctx = new ContextoAtaque({ cena, balas, caixa, coracoes: [alvo], tema: TEMAS[carta.personagem] ?? {}, dano, ritmo: r, semente: String(semente), nome: ataque.nome, velocidadeCoracao: CORACAO.velocidadePadrao })
  const inicio = ATAQUE.respiroMs
  const duracao = inicio + ataque.duracao + ATAQUE.respiroMs
  ctx.depois(inicio, () => ataque.iniciar(ctx.limitar(ataque.duracao)))
  ctx.depois(inicio + ataque.duracao, () => balas.desarmar(ATAQUE.respiroMs))
  const e = {
    nome: ataque.nome,
    balas,
    alvo,
    duracao,
    t: 0,
    acertos: 0,
    grazes: 0,
    get acabou() {
      return e.t >= duracao
    },
    passo() {
      if (e.acabou) return
      const dt = PASSO_MS
      e.t += dt
      if (alvo.invencivel > 0) alvo.invencivel -= dt
      ctx.atualizar(dt)
      balas.atualizar(
        dt,
        [alvo],
        () => {
          if (alvo.invencivel > 0) return false
          alvo.invencivel = TEMPOS.invencivelMs
          e.acertos++
          return true
        },
        () => e.grazes++,
      )
      if (e.acabou) e.parar()
    },
    parar() {
      ctx.limpar()
      balas.limpar()
    },
  }
  return e
}

// O SERVIDOR: a CPU desviando do ataque de verdade da sua carta
export function simularCpuReal({ carta, dano, ritmo, semente }, { nivel = 'facil', velocidade = CORACAO.velocidadePadrao } = {}) {
  const l = limitesReais()
  const c = inicioReal(l)
  const e = criarAtaqueReal(cenaSemTela(), { carta, dano, ritmo, semente, limites: l, coracao: c })
  if (!e) return null
  const rng = criarRng(`${semente}:esquivaReal`)
  const bot = new EsquivaBot({ nivel, sorte: () => aleatorio(rng) })
  const amostras = [0, Math.round(c.x * 10), Math.round(c.y * 10)]
  let k = 0
  while (!e.acabou) {
    const joy = bot.joy(PASSO_MS, { coracao: { x: c.x, y: c.y, hitbox: CORACAO.hitbox }, limites: l, balas: e.balas.lista, zonas: e.balas.zonas ?? [], velocidade, fatorVelocidade: 1, velocidadeMax: VELOCIDADE_MAX_REAL, invertido: false })
    passoDoCoracao(c, joy, velocidade, PASSO_MS, l, MEIO)
    // a posição que vai para o navegador (décimos de px): o servidor usa a mesma, arredondada
    c.x = Math.round(c.x * 10) / 10
    c.y = Math.round(c.y * 10) / 10
    e.passo()
    // empurrado pelo ataque: a posição que vale (e vai na amostra) também é a arredondada
    c.x = Math.round(c.x * 10) / 10
    c.y = Math.round(c.y * 10) / 10
    if (++k % PASSOS_POR_AMOSTRA === 0 || e.acabou) amostras.push(Math.round(e.t), Math.round(c.x * 10), Math.round(c.y * 10))
  }
  return { acertos: e.acertos, grazes: e.grazes, amostras, duracao: e.duracao, nome: e.nome }
}
