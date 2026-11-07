// O QUADRO da luta da campanha (docs/campanha.md): a caixa grande do CO-OP (coop/quadro.js), onde você
// e a aliada desviam do ataque DE VERDADE da carta do chefe (ataqueDaCartaChefe + a biblioteca
// attacks/, rodados pelo ContextoAtaque e pela classe Balas reais). Em PASSO FIXO (amostras.PASSO_MS),
// o MESMO código no navegador e no servidor:
//   - navegador: o seu coração anda pelo joystick; a cada passo sai a sua posição (a amostra)
//   - servidor: o seu coração anda pelas amostras que chegaram (a mesma posição, passo a passo)
//   - a aliada (CPU) anda pelo EsquivaBot com sorteio de semente, nos dois lados
// Por isso o servidor refaz a esquiva inteira e decide os acertos (o seu e o da aliada).
//
//   const q = criarQuadro(cena, esq, { amostras })   esq: o que o servidor mandou (montarEsquiva)
//   q.passo(joy)        um passo (joy: o joystick do jogador; com `amostras`, ignorado)
//   q.coracoes · q.balas · q.t · q.duracao · q.acabou · q.acertos[j] · q.grazes[j] · q.parar()
//   q.amostras (lista plana [t, x, y] do SEU coração, décimos de px) · q.tirarAmostras() (o pedaço novo)
//   simularQuadro(esq, amostras)  o servidor: { acertos, grazes, aliado: { x, y } } (amostras: ler())
import ContextoAtaque from '../attacks/contexto.js'
import Balas from '../entities/Bullets.js'
import { ataques } from '../attacks/index.js'
import { duracaoDoArremesso } from '../attacks/arremesso.js'
import { ataqueDaCartaChefe } from '../coop/cartasChefe.js'
import { CHEFES, nivelDoChefe } from '../coop/chefes/index.js'
import { QUADRO, inicioDoCoracao } from '../coop/quadro.js'
import { ATAQUE, CORACAO, TEMPOS, DIFICULDADES, DESAFIO } from '../constants.js'
import { passoDoCoracao } from '../entities/fisica.js'
import { EsquivaBot } from '../pvp/botEsquiva.js'
import { criarRng, aleatorio } from '../pvp/baralho.js'
import { PASSO_MS, MEIO, posicaoNoTempo } from './amostras.js'
import { cenaSemTela } from './cenaSemTela.js'

export const VELOCIDADE_CORACAO = CORACAO.velocidadePadrao // fixa na campanha: o servidor confere
export const NIVEL_ALIADA = 'normal' // como a aliada desvia (pvp/botEsquiva.js)

// o retângulo do quadro (formato do Phaser) com a largura/altura da rodada (a caixa pode encolher)
// (arredondado como a BattleBox.aplicar: na tela o quadro É uma BattleBox, e os dois lados têm de ver a
// MESMA caixa, até o meio pixel)
export function limitesDoQuadro({ largura = QUADRO.largura, altura = QUADRO.altura } = {}) {
  const w = Math.round(largura)
  const h = Math.round(altura)
  const x = Math.round(QUADRO.x - w / 2)
  const y = Math.round(QUADRO.y - h / 2)
  return { x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h, centerX: x + w / 2, centerY: y + h / 2 }
}

// o mesmo que a CoopArena: teto de velocidade e ritmo da luta contra este chefe, neste nível
export function velocidadeMaxDoQuadro(chefe, nivel) {
  const def = CHEFES[chefe]
  return DIFICULDADES[def.dificuldade].velocidadeMaxBala * DESAFIO.velocidadeMax * nivelDoChefe(chefe, nivel).velocidadeMax
}

export function ritmoDoQuadro(chefe, nivel, extra = { velocidade: 1, densidade: 1 }) {
  const d = CHEFES[chefe].desafio ?? {}
  const n = nivelDoChefe(chefe, nivel)
  const q = QUADRO.ritmo ?? {}
  return {
    velocidade: DESAFIO.velocidade * n.velocidade * (d.velocidade ?? 1) * (q.velocidade ?? 1) * (extra.velocidade ?? 1),
    densidade: DESAFIO.densidade * n.densidade * (d.densidade ?? 1) * (q.densidade ?? 1) * (extra.densidade ?? 1),
  }
}

// onde cada coração começa: sozinho no quadro, no meio; com a aliada, você à esquerda e ela à direita
export function inicioNoQuadro(l, j, dentro) {
  const n = dentro.filter(Boolean).length
  if (n <= 1) return { x: l.left + l.width / 2, y: l.bottom - 30 }
  const k = dentro.slice(0, j).filter(Boolean).length
  return inicioDoCoracao(l, k, n)
}

// o ataque que roda no quadro: o da carta do chefe na caixa fixa; com cartas arremessadas (o TITÃ),
// elas vêm antes
export function ataqueDoQuadro(esq) {
  let at = ataqueDaCartaChefe(esq.carta, { ataques })
  // o ginásio ecoa (regra eco): o ataque leve do chefe vem junto
  if (esq.eco && esq.carta.naipe !== 'copas') at = ataques.juntos(at, CHEFES[esq.chefe].leve(ataques))
  at = ataques.comCaixa(null, at)
  if (esq.cartas?.length) at = ataques.sequencia(ataques.arremesso({ cartas: esq.cartas, duracao: duracaoDoArremesso(esq.cartas.length) }), at)
  return at
}

// esq: { chefe, nivel, carta (a do chefe, inteira), cartas? (titã), danos[j], hp[j], protegido[j],
//        jogadores[j] (está no quadro), caixa { largura, altura }, ritmo, inverter, semente }
//   caixa: (navegador) a BattleBox do quadro, já com o tamanho da rodada (limites iguais a limitesDoQuadro)
export function criarQuadro(cena, esq, { amostras = null, caixa: caixaDaTela = null } = {}) {
  const l = caixaDaTela?.limites ?? limitesDoQuadro(esq.caixa)
  const caixa = caixaDaTela ?? { limites: l, recortar() {}, aproximar() {}, tremer() {}, mudarPara: () => false }
  const balas = new Balas(cena, caixa)
  balas.velocidadeMax = esq.velocidadeMax ?? velocidadeMaxDoQuadro(esq.chefe, esq.nivel)
  balas.fatorVelocidade = esq.ritmo.velocidade
  const dentro = esq.jogadores
  const coracoes = dentro.map((d, j) => {
    const p = inicioNoQuadro(l, j, dentro)
    const c = {
      ativo: Boolean(d),
      jogador: j,
      x: p.x,
      y: p.y,
      hitbox: CORACAO.hitbox,
      graze: CORACAO.graze,
      invencivel: 0,
      tamanho: 1,
      hp: esq.hp?.[j] ?? Infinity,
      ajustar() {
        c.x = Math.max(l.left + MEIO, Math.min(l.right - MEIO, c.x))
        c.y = Math.max(l.top + MEIO, Math.min(l.bottom - MEIO, c.y))
      },
    }
    return c
  })
  const ataque = ataqueDoQuadro(esq)
  const ctx = new ContextoAtaque({ cena, balas, caixa, coracoes, tema: CHEFES[esq.chefe].tema, dano: esq.danos?.[0] ?? 5, ritmo: esq.ritmo, semente: String(esq.semente), nome: ataque.nome, velocidadeCoracao: VELOCIDADE_CORACAO })
  const inicio = ATAQUE.respiroMs
  const duracao = inicio + ataque.duracao + ATAQUE.respiroMs
  ctx.depois(inicio, () => ataque.iniciar(ctx.limitar(ataque.duracao)))
  ctx.depois(inicio + ataque.duracao, () => balas.desarmar(ATAQUE.respiroMs))
  // a aliada (CPU): desvia com sorteio de semente (igual nos dois lados)
  const rngAliada = criarRng(`${esq.semente}:aliada`)
  const bot = new EsquivaBot({ nivel: esq.nivelAliada ?? NIVEL_ALIADA, sorte: () => aleatorio(rngAliada) })
  const lista = []
  let enviados = 0
  const inicioJogador = { x: coracoes[0].x, y: coracoes[0].y }
  const quantizar = (c) => {
    c.x = Math.round(c.x * 10) / 10
    c.y = Math.round(c.y * 10) / 10
  }
  const q = {
    nome: ataque.nome,
    balas,
    coracoes,
    limites: l,
    duracao,
    t: 0,
    acertos: coracoes.map(() => 0),
    grazes: coracoes.map(() => 0),
    caiu: coracoes.map(() => false),
    amostras: lista,
    get acabou() {
      return q.t >= duracao
    },
    passo(joy) {
      if (q.acabou) return { acertos: [], grazes: [] }
      const dt = PASSO_MS
      const t = q.t + dt
      const eu = coracoes[0]
      // quem começou no quadro manda a posição até o fim, mesmo depois de cair (aí parada): o servidor
      // confere a esquiva inteira, e cair no meio não é encurtar a esquiva
      if (dentro[0]) {
        if (!eu.ativo) {
          // caído: o coração fica onde caiu
        } else if (amostras) {
          const p = posicaoNoTempo(amostras, t, inicioJogador)
          eu.x = p.x
          eu.y = p.y
        } else {
          const j = esq.inverter && joy ? { x: -joy.x, y: -joy.y } : joy
          passoDoCoracao(eu, j, VELOCIDADE_CORACAO, dt, l, MEIO)
        }
        quantizar(eu)
        lista.push(t, Math.round(eu.x * 10), Math.round(eu.y * 10))
      }
      for (const c of coracoes.slice(1)) {
        if (!c.ativo) continue
        const jb = bot.joy(dt, { coracao: c, limites: l, balas: balas.lista, zonas: balas.zonas ?? [], velocidade: VELOCIDADE_CORACAO, fatorVelocidade: balas.fatorVelocidade, velocidadeMax: balas.velocidadeMax, invertido: Boolean(esq.inverter) })
        passoDoCoracao(c, esq.inverter ? { x: -jb.x, y: -jb.y } : jb, VELOCIDADE_CORACAO, dt, l, MEIO)
        quantizar(c)
      }
      for (const c of coracoes) if (c.invencivel > 0) c.invencivel -= dt
      const novos = { acertos: [], grazes: [] }
      q.t = t
      ctx.atualizar(dt)
      balas.atualizar(
        dt,
        coracoes.filter((c) => c.ativo),
        (c) => {
          if (c.invencivel > 0) return false
          c.invencivel = TEMPOS.invencivelMs
          q.acertos[c.jogador]++
          novos.acertos.push(c.jogador)
          // caiu (sem a segunda chance): sai do quadro, o ataque segue com quem ficou
          c.hp -= esq.danos?.[c.jogador] ?? 0
          if (c.hp <= 0 && !esq.protegido?.[c.jogador]) {
            c.ativo = false
            q.caiu[c.jogador] = true
          }
          return true
        },
        (c) => {
          q.grazes[c.jogador]++
          novos.grazes.push(c.jogador)
        },
      )
      if (q.acabou) q.parar()
      return novos
    },
    tirarAmostras() {
      const pedaco = lista.slice(enviados)
      enviados = lista.length
      return pedaco
    },
    parar() {
      ctx.limpar()
      balas.limpar()
    },
  }
  return q
}

// O SERVIDOR: a esquiva inteira com as suas amostras (já lidas) e a aliada desviando
export function simularQuadro(esq, amostras) {
  const q = criarQuadro(cenaSemTela(), esq, { amostras })
  while (!q.acabou) q.passo(null)
  return { acertos: q.acertos, grazes: q.grazes, caiu: q.caiu, duracao: q.duracao }
}

// quanto dura a esquiva (o navegador e o servidor contam igual)
export function duracaoDoQuadro(esq) {
  return ATAQUE.respiroMs * 2 + ataqueDoQuadro(esq).duracao
}
