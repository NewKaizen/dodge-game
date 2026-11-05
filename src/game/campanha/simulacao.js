// A ESQUIVA da campanha, sem Phaser: as balas de um roteiro (campanha/ataques.js) andando pelas
// regras do jogo (entities/fisica.js, as mesmas de Balas e Heart) num passo FIXO (amostras.PASSO_MS).
// O navegador roda isto para desenhar e sentir os acertos na hora; o servidor roda o MESMO com as
// posições que o navegador mandou e é ele quem decide o dano (docs/campanha.md).
//
//   const s = criarSimulacao(ataque, { hitbox, graze, invencivelMs })
//   s.passo(coracao, alvo)   avança PASSO_MS: nascem as balas até s.t (mirando `alvo`), andam, e o
//                            coração { x, y } leva acerto/graze. Devolve { acertou: bala | null, grazes }
//   s.lista · s.t · s.acertos · s.grazes · s.acabou
//
//   simularComAmostras(ataque, amostras, op)   o servidor: { acertos, grazes } a partir das amostras
//   simularCpu(ataque, op)                     a CPU desvia (pvp/botEsquiva.js) com sorteio de semente:
//                                              { acertos, grazes, amostras } (o navegador repete o desenho)
import { CORACAO, TEMPOS } from '../constants.js'
import { avisoDaBala, andarBala, quicarNaCaixa, longeDaCaixa, foraDaCaixa, folgaDaBala, passoDoCoracao } from '../entities/fisica.js'
import { criarRoteiro, limitesDaCaixa, VELOCIDADE_MAX } from './ataques.js'
import { PASSO_MS, MEIO, criarGravador, ler, alvoNoTempo, posicaoNoTempo } from './amostras.js'
import { EsquivaBot } from '../pvp/botEsquiva.js'
import { criarRng, aleatorio } from '../pvp/baralho.js'

// o servidor é um pouco mais generoso que a tela: só conta o acerto claro (as amostras a ~20 Hz não
// pegam cada curva do coração). O navegador pode contar a mais (aí vale o dele: só piora para ele).
export const FOLGA_HITBOX_SERVIDOR = 1.2

// o coração começa embaixo, no meio (como nas pistas do jogo)
export const inicioDaCaixa = (c) => ({ x: (c.esquerda + c.direita) / 2, y: c.base - 30 })

function novaBala(o, l, id) {
  const tipo = o.comprimento !== undefined ? 'segmento' : o.largura !== undefined ? 'retangulo' : 'circulo'
  return {
    id,
    tipo,
    x: o.x,
    y: o.y,
    vx: o.vx ?? 0,
    vy: o.vy ?? 0,
    ax: o.ax ?? 0,
    ay: o.ay ?? 0,
    raio: o.raio ?? 6,
    largura: o.largura,
    altura: o.altura ?? o.largura,
    comprimento: o.comprimento,
    espessura: o.espessura ?? 8,
    angulo: o.angulo ?? 0,
    girar: o.girar ?? 0,
    vida: o.vida ?? Infinity,
    quicar: o.quicar ?? 0,
    arranque: o.arranque ? { ...o.arranque } : null,
    aviso: avisoDaBala(o, l),
    idade: 0,
    morta: false,
    grazeada: false,
    extra: o.extra ?? {},
  }
}

export function criarSimulacao(ataque, { hitbox = CORACAO.hitbox, graze = CORACAO.graze, invencivelMs = TEMPOS.invencivelMs } = {}) {
  const l = limitesDaCaixa(ataque.caixa)
  const roteiro = criarRoteiro(ataque)
  const fim = ataque.duracao
  const s = {
    lista: [],
    t: 0,
    acertos: 0,
    grazes: 0,
    criadas: 0,
    invencivel: 0,
    get acabou() {
      return s.t >= fim
    },
    passo(coracao, alvo) {
      const dt = PASSO_MS
      s.t += dt
      if (s.invencivel > 0) s.invencivel -= dt
      for (const o of roteiro.gerar(s.t, alvo)) s.lista.push(novaBala(o, l, s.criadas++))
      let acertou = null
      let grazes = 0
      for (const b of s.lista) {
        b.idade += dt
        if (b.idade < b.aviso) continue
        andarBala(b, dt, 1, VELOCIDADE_MAX)
        if (b.quicar > 0) quicarNaCaixa(b, l)
        b.vida -= dt
        if (b.morta || longeDaCaixa(b, l) || b.vida <= 0) {
          b.morta = true
          continue
        }
        if (!coracao || foraDaCaixa(b, l)) continue
        const folga = folgaDaBala(b, coracao.x, coracao.y)
        if (folga <= hitbox) {
          if (s.invencivel <= 0 && !acertou) {
            acertou = b
            b.morta = true
            s.acertos++
            s.invencivel = invencivelMs
          }
        } else if (folga <= graze && !b.grazeada) {
          b.grazeada = true
          grazes++
        }
      }
      s.grazes += grazes
      s.lista = s.lista.filter((b) => !b.morta)
      return { acertou, grazes }
    },
  }
  return s
}

// O SERVIDOR: refaz a esquiva com as amostras (lista plana já lida por amostras.ler)
export function simularComAmostras(ataque, amostras, { inicio = inicioDaCaixa(ataque.caixa), hitbox = CORACAO.hitbox - FOLGA_HITBOX_SERVIDOR } = {}) {
  const s = criarSimulacao(ataque, { hitbox })
  while (s.t < ataque.duracao) {
    const t = s.t + PASSO_MS
    s.passo(posicaoNoTempo(amostras, t, inicio), alvoNoTempo(amostras, t, inicio))
  }
  return { acertos: s.acertos, grazes: s.grazes }
}

// A CPU desviando (o servidor decide; o navegador só desenha com as amostras que vêm junto).
//   op: { nivel, semente, velocidade }
export function simularCpu(ataque, { nivel = 'normal', semente = 'cpu', velocidade = CORACAO.velocidadePadrao } = {}) {
  const rng = criarRng(`${semente}:esquiva`)
  const bot = new EsquivaBot({ nivel, sorte: () => aleatorio(rng) })
  const l = limitesDaCaixa(ataque.caixa)
  const c = inicioDaCaixa(ataque.caixa)
  const s = criarSimulacao(ataque)
  const gravador = criarGravador()
  gravador.registrar(0, c.x, c.y)
  while (s.t < ataque.duracao) {
    const joy = bot.joy(PASSO_MS, { coracao: { x: c.x, y: c.y, hitbox: CORACAO.hitbox }, limites: l, balas: s.lista, zonas: [], velocidade, fatorVelocidade: 1, velocidadeMax: VELOCIDADE_MAX, invertido: false })
    passoDoCoracao(c, joy, velocidade, PASSO_MS, l, MEIO)
    gravador.registrar(s.t + PASSO_MS, c.x, c.y)
    s.passo(c, gravador.ultima())
  }
  return { acertos: s.acertos, grazes: s.grazes, amostras: gravador.lista }
}

export { ler as lerAmostras }

// O NAVEGADOR: a esquiva rodando com o coração de verdade. A cada quadro (dt variável) o coração
// anda pelo joystick e a simulação dá os passos fixos que couberem, com o coração interpolado no
// quadro; as amostras saem do mesmo passo (é o que vai para o servidor).
//   const e = criarEsquivaLocal(ataque, { velocidade, invertido })
//   e.quadro(dt, joy) -> { acertos: n novos, grazes: n novos }   e.coracao · e.sim · e.gravador · e.acabou
export function criarEsquivaLocal(ataque, { velocidade = CORACAO.velocidadePadrao, invertido = false } = {}) {
  const l = limitesDaCaixa(ataque.caixa)
  const c = inicioDaCaixa(ataque.caixa)
  const sim = criarSimulacao(ataque)
  const gravador = criarGravador()
  gravador.registrar(0, c.x, c.y)
  let real = 0
  return {
    coracao: c,
    sim,
    gravador,
    get acabou() {
      return sim.t >= ataque.duracao
    },
    quadro(dt, joy) {
      let acertos = 0
      let grazes = 0
      if (sim.t >= ataque.duracao) return { acertos, grazes }
      const de = { x: c.x, y: c.y }
      const j = invertido && joy ? { x: -joy.x, y: -joy.y } : joy
      passoDoCoracao(c, j, velocidade, dt, l, MEIO)
      const t0 = real
      real += dt
      while (sim.t + PASSO_MS <= real && sim.t < ataque.duracao) {
        const t = sim.t + PASSO_MS
        const k = dt > 0 ? Math.min(1, Math.max(0, (t - t0) / dt)) : 1
        const p = { x: de.x + (c.x - de.x) * k, y: de.y + (c.y - de.y) * k }
        gravador.registrar(t, p.x, p.y)
        const r = sim.passo(p, gravador.ultima())
        if (r.acertou) acertos++
        grazes += r.grazes
      }
      return { acertos, grazes }
    },
  }
}
