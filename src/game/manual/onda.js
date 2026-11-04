import { CORACAO } from '../constants.js'
import { avisoDaBala, andarBala, quicarNaCaixa, longeDaCaixa, foraDaCaixa, folgaDaBala, acerta, passoDoCoracao } from '../entities/fisica.js'

// Uma "Pista" de bolso para o Manual do Ralsei, SEM Phaser: as balas nascem com as MESMAS opções
// de a.bala({...}) (entities/Bullets.js) e andam/acertam pelas MESMAS regras (entities/fisica.js,
// a fonte única que Balas e Heart usam). __tests__/paridade.test.js roda a classe Balas e o Heart
// reais lado a lado com isto e confere posição a posição, acerto a acerto.
//
//   const o = criarOnda(caixa)          caixa no formato do manual { esquerda, direita, topo, base }
//   o.bala(opcoes)                      cria uma bala (x, y, vx, vy, ax, ay, raio, aviso, entrando, jaAvisada, ...)
//   o.passo(dt, coracao)                anda as balas dt ms; devolve a bala que acertou o coração (ou null)
//   o.lista                             as balas vivas (cada uma: x, y, raio, idade, aviso, extra...)
//   moverCoracao(c, joy, vel, dt, caixa)   o passo do coração (Heart.update)
//
// O que a bala tem a mais para o desenho (o giz, a linha pontilhada do aviso) vai em `extra`:
// nunca entra na colisão.

// a caixa do manual no formato do Phaser (o que fisica.js espera)
export const limitesDe = (c) => ({ left: c.esquerda, right: c.direita, top: c.topo, bottom: c.base })

export function moverCoracao(coracao, joy, velocidade, dt, caixa, meio = CORACAO.tamanho / 2) {
  return passoDoCoracao(coracao, joy, velocidade, dt, limitesDe(caixa), meio)
}

// Os campos de uma bala nova, como Balas.criar monta (só o que vale para regra)
export function novaBala(o, l) {
  const tipo = o.comprimento !== undefined ? 'segmento' : o.largura !== undefined ? 'retangulo' : 'circulo'
  return {
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
    extra: o.extra ?? {},
  }
}

export function criarOnda(caixa, { fatorVelocidade = 1, velocidadeMax = Infinity } = {}) {
  const l = limitesDe(caixa)
  const onda = {
    lista: [],
    criadas: 0,
    bala(o) {
      const b = novaBala(o, l)
      b.id = onda.criadas++
      onda.lista.push(b)
      return b
    },
    // o mesmo laço de Balas.atualizar (sem graze, sem sprite); coracao = { x, y, hitbox } ou null
    passo(dt, coracao = null) {
      let acertou = null
      for (const b of onda.lista) {
        b.idade += dt
        if (b.idade < b.aviso) continue // telegrafando: parada e inofensiva
        andarBala(b, dt, fatorVelocidade, velocidadeMax)
        if (b.quicar > 0) quicarNaCaixa(b, l)
        b.vida -= dt
        if (b.morta || longeDaCaixa(b, l) || b.vida <= 0) {
          b.morta = true
          continue
        }
        if (coracao && !acertou && acerta(b, coracao, l)) acertou = b
      }
      onda.lista = onda.lista.filter((b) => !b.morta)
      return acertou
    },
    perigosa: (b) => !b.morta && b.idade >= b.aviso,
    limpar() {
      onda.lista = []
    },
  }
  return onda
}

export { folgaDaBala, foraDaCaixa }
