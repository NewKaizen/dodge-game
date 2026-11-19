// A CAIXA DE ESQUIVA do bot do JOGAR RÁPIDO, sem tela (docs/online.md "Bots do Jogar Rápido").
//
// O bot é o convidado de uma partida PVP em rede: cada PC simula a caixa onde está o PRÓPRIO coração
// e manda a posição dele (`coracao`) e o dano que levou (`dano`) para o outro (docs/rede-pvp.md). O
// bot faz o mesmo aqui no servidor: roda o ataque DE VERDADE da carta (attacks/ + entities/Bullets.js,
// que não dependem do Phaser, como a campanha em src/game/campanha/quadro.js) com a MESMA semente que
// a caixa espelho do humano usa (`<semente da partida>:<rodada>:<caixa>`), e o coração anda pelo
// EsquivaBot (src/game/pvp/botEsquiva.js) com os números do nível do bot (server/bots/habilidade.js).
// Por isso o coração do bot na tela do humano desvia das MESMAS balas que ele vê na caixa espelho.
//
//   const cx = criarCaixa({ carta, dano, ritmo, inverterMs, semente, k, aceleracao, esquiva, sorte })
//   cx.passo(dt) -> { acertos: [dano, ...], grazes: n }   um passo (o dono chama de PASSO_MS em PASSO_MS)
//   cx.coracao { x, y } · cx.t · cx.duracao · cx.acabou · cx.parar()
//
// Diferenças conhecidas (só desenho, nunca regra): a caixa aqui não muda de forma (o espelho do
// humano prende a posição na caixa dele: coracao.ajustar) e os efeitos dos eventos bônus não rodam
// aqui (o bot não leva dano deles).
import ContextoAtaque from '../../src/game/attacks/contexto.js'
import Balas from '../../src/game/entities/Bullets.js'
import { ataqueDaCartaNoJogo } from '../../src/game/pvp/ataquesDasCartas.js'
import { TEMAS } from '../../src/game/pvp/cartas.js'
import { preparoCaixa } from '../../src/game/attacks/definir.js'
import { ATAQUE, CORACAO, TEMPOS, LARGURA, ACELERACAO, parteDoFator } from '../../src/game/constants.js'
import { passoDoCoracao } from '../../src/game/entities/fisica.js'
import { EsquivaBot } from '../../src/game/pvp/botEsquiva.js'
import { cenaSemTela } from '../../src/game/campanha/cenaSemTela.js'

export const PASSO_MS = 16
// a caixa do PvP (scenes/PvpArena.js PISTA e CENTROS)
export const PISTA = { largura: 220, altura: 170, y: 198 }
export const CENTROS = [LARGURA / 4, (LARGURA * 3) / 4]
export const VELOCIDADE_MAX_BALA = 300 // velocidadeMax das pistas do PvP
const MEIO = CORACAO.tamanho / 2
// o ataque vazio da rodada bônus sem carta (PvpArena ATAQUE_VAZIO)
export const DURACAO_VAZIA = 5000

export function limitesDaPista(k) {
  const w = PISTA.largura
  const h = PISTA.altura
  const x = Math.round(CENTROS[k] - w / 2)
  const y = Math.round(PISTA.y - h / 2)
  return { x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h, centerX: x + w / 2, centerY: y + h / 2 }
}

// carta: a carta do ataque (null = caixa só com o evento bônus); esquiva: os números do EsquivaBot
export function criarCaixa({ carta = null, dano = 5, ritmo = {}, inverterMs = 0, semente, k = 1, aceleracao = 1, esquiva = null, sorte = Math.random, velocidade = CORACAO.velocidadePadrao }) {
  const cena = cenaSemTela()
  const l = limitesDaPista(k)
  const caixa = { limites: l, recortar() {}, aproximar() {}, tremer() {}, mudarPara: () => false }
  const balas = new Balas(cena, caixa)
  const ataque = carta ? ataqueDaCartaNoJogo(carta) : null
  const r = { velocidade: 1, densidade: 1, ...ritmo }
  r.velocidade *= aceleracao
  r.densidade *= aceleracao
  balas.fatorVelocidade = r.velocidade
  balas.velocidadeMax = VELOCIDADE_MAX_BALA * aceleracao
  const vel = velocidade * parteDoFator(aceleracao, ACELERACAO.coracao)
  const c = { ativo: true, jogador: 0, x: l.centerX, y: l.bottom - 30, hitbox: CORACAO.hitbox, graze: CORACAO.graze, invencivel: 0, tamanho: 1 }
  c.ajustar = () => {
    c.x = Math.max(l.left + MEIO, Math.min(l.right - MEIO, c.x))
    c.y = Math.max(l.top + MEIO, Math.min(l.bottom - MEIO, c.y))
  }
  // o mesmo começo da Pista.rodar: o respiro (ou o aviso da caixa nova), o ataque e o respiro do fim
  const inicio = ataque ? Math.max(ATAQUE.respiroMs, preparoCaixa(null, ataque.caixa)) : ATAQUE.respiroMs
  const duracaoAtaque = ataque ? ataque.duracao : DURACAO_VAZIA
  const duracao = inicio + duracaoAtaque + ATAQUE.respiroMs
  let ctx = null
  if (ataque) {
    ctx = new ContextoAtaque({ cena, balas, caixa, coracoes: [c], tema: TEMAS[carta.personagem] ?? {}, dano, ritmo: r, semente, nome: ataque.nome, velocidadeCoracao: () => vel })
    ctx.depois(inicio, () => ataque.iniciar(ctx.limitar(ataque.duracao)))
    ctx.depois(inicio + ataque.duracao, () => balas.desarmar(ATAQUE.respiroMs))
  }
  const bot = new EsquivaBot({ nivel: 'normal', sorte })
  if (esquiva) bot.cfg = { ...bot.cfg, ...esquiva, avisos: { ...bot.cfg.avisos, ...(esquiva.avisos ?? {}) } }
  const cx = {
    coracao: c,
    limites: l,
    balas,
    t: 0,
    duracao,
    acertos: 0,
    grazes: 0,
    parado: false,
    get acabou() {
      return cx.parado || cx.t >= duracao
    },
    get atacando() {
      return Boolean(ataque) && cx.t >= inicio && cx.t < inicio + duracaoAtaque
    },
    passo(dt = PASSO_MS) {
      const novos = { acertos: [], grazes: 0 }
      if (cx.acabou) return novos
      const invertido = inverterMs > 0 && cx.atacando
      if (c.ativo) {
        const j = bot.joy(dt, { coracao: c, limites: l, balas: balas.lista, zonas: balas.zonas ?? [], velocidade: vel, fatorVelocidade: balas.fatorVelocidade, velocidadeMax: balas.velocidadeMax, invertido })
        // os controles invertidos (♦ Q/K): o bot "aperta" o que acha certo e o coração vai ao contrário
        passoDoCoracao(c, invertido ? { x: -j.x, y: -j.y } : j, vel, dt, l, MEIO)
      }
      if (c.invencivel > 0) c.invencivel -= dt
      cx.t += dt
      if (ctx) ctx.atualizar(dt)
      balas.atualizar(
        dt,
        [c].filter((x) => x.ativo),
        (h, bala) => {
          if (h.invencivel > 0) return false
          h.invencivel = TEMPOS.invencivelMs
          cx.acertos++
          novos.acertos.push(Number.isFinite(bala?.dano) ? bala.dano : dano)
          return true
        },
        (h) => {
          if (h.invencivel > 0) return
          cx.grazes++
          novos.grazes++
        },
      )
      if (cx.acabou) cx.parar()
      return novos
    },
    // o coração caiu (K.O.): para de andar, o ataque segue até a caixa parar
    cair() {
      c.ativo = false
    },
    parar() {
      if (cx.limpo) return
      cx.limpo = true
      cx.parado = true
      ctx?.limpar()
      balas.limpar()
    },
  }
  return cx
}
