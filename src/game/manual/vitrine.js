import ContextoAtaque from '../attacks/contexto.js'
import Balas from '../entities/Bullets.js'
import { ATAQUE, CORACAO } from '../constants.js'
import { TEMAS } from '../pvp/cartas.js'

// A VITRINE do Manual do Ralsei (páginas 3 e 4): a caixa do boneco de treino onde a carta jogada solta o
// ATAQUE DE VERDADE dela. Nada de imitação: o ataque é o de ataqueDaCarta (manual/cartasDoManual.js:
// planoDaVitrine), rodado pelo ContextoAtaque e pela classe Balas reais, com o mesmo relógio de
// Pista.rodar (respiro inicial, o ataque, desarmar no fim) e o mesmo tema/dano/ritmo da arena. Só não
// há coração: o alvo (a.alvo()) é o boneco, e ninguém toma dano.
//
// Como as balas reais são sprites do jogo (não giz), elas vivem numa região do mundo FORA da tela
// (MUNDO_VITRINE) e uma câmera só delas mostra essa região em cima do cartão da caixa, já na escala:
// nada vaza para o caderno e o recorte é exato (como a câmera de recorte da BattleBox).
//
//   criarMotorDaVitrine(cena, { alvo })   a parte sem câmera (roda no Node com o Phaser de mentira)
//     motor.rodar(plano)                  começa o ataque do plano (para o anterior)
//     motor.passo(dt)                     um quadro (passos de até 20 ms, como a Pista)
//     motor.tocando(raio)                 há bala valendo encostando no boneco? (o boneco balança)
//     motor.parar()                       some tudo na hora
//   (a câmera fica em manual/vitrineNaTela.js: VitrineDeAtaque)

export const MUNDO_VITRINE = { x: 4000, y: 2000 } // bem longe da tela 854x480
export const CAIXA_VITRINE = { largura: 220, altura: 170 } // a caixa de cada jogador no PvP (PvpArena PISTA)
export const VELOCIDADE_MAX_VITRINE = 300 // o teto das balas na arena PvP (velocidadeMax da Pista)
export const ALVO_VITRINE = { x: 0.5, y: 0.6 } // onde fica o boneco (fração da caixa)

// retângulo no formato de Phaser.Geom.Rectangle (o que os ataques e as balas leem)
export function retanguloDaVitrine(x = MUNDO_VITRINE.x, y = MUNDO_VITRINE.y, largura = CAIXA_VITRINE.largura, altura = CAIXA_VITRINE.altura) {
  return {
    x,
    y,
    width: largura,
    height: altura,
    left: x,
    top: y,
    right: x + largura,
    bottom: y + altura,
    centerX: x + largura / 2,
    centerY: y + altura / 2,
  }
}

export function criarMotorDaVitrine(cena, { limites = retanguloDaVitrine(), alvo } = {}) {
  // a "BattleBox" da vitrine: a caixa não muda de forma (planoDaVitrine usa caixaFixa) e não treme
  const caixa = { limites, recortar() {}, aproximar() {}, tremer() {}, mudarPara: () => false }
  const balas = new Balas(cena, caixa)
  balas.velocidadeMax = VELOCIDADE_MAX_VITRINE
  const ponto = alvo ?? { x: limites.left + limites.width * ALVO_VITRINE.x, y: limites.top + limites.height * ALVO_VITRINE.y }
  const boneco = { ativo: true, jogador: 0, x: ponto.x, y: ponto.y }
  let at = null

  const motor = {
    caixa,
    balas,
    boneco,
    get rodando() {
      return at !== null
    },
    get ataque() {
      return at
    },
    rodar(plano) {
      motor.parar()
      const r = { velocidade: 1, densidade: 1, ...plano.ritmo }
      balas.fatorVelocidade = r.velocidade
      const ataque = plano.ataque
      const ctx = new ContextoAtaque({
        cena,
        balas,
        caixa,
        coracoes: [boneco],
        tema: TEMAS[plano.carta.personagem] ?? {},
        dano: plano.dano,
        ritmo: r,
        semente: plano.semente,
        nome: ataque.nome,
        velocidadeCoracao: CORACAO.velocidadePadrao,
      })
      at = { ctx, nome: ataque.nome, tempo: 0, iniciado: false, restante: plano.inicio + ataque.duracao + ATAQUE.respiroMs }
      const meu = at
      ctx.depois(plano.inicio, () => {
        meu.iniciado = true
        ataque.iniciar(ctx.limitar(ataque.duracao))
      })
      ctx.depois(plano.inicio + ataque.duracao, () => balas.desarmar(ATAQUE.respiroMs))
      return at
    },
    passo(dt) {
      if (!at) return
      const passos = Math.max(1, Math.ceil(dt / 20))
      for (let k = 0; k < passos && at; k++) {
        const d = dt / passos
        at.tempo += d
        at.ctx.atualizar(d)
        balas.atualizar(d, [], () => false, () => {})
        at.restante -= d
        if (at.restante <= 0) motor.parar()
      }
    },
    tocando(raio = 20) {
      return balas.lista.some((b) => !b.inofensiva && b.idade >= b.aviso && Math.hypot(b.x - boneco.x, b.y - boneco.y) <= raio + (b.raio ?? 6))
    },
    parar() {
      if (!at) return
      at.ctx.limpar()
      at = null
      balas.limpar()
      balas.fatorVelocidade = 1
    },
  }
  return motor
}
