import { definirAtaque } from './definir.js'
import { ATAQUE } from '../constants.js'

// Estocadas. Identidade: ritmo de "pare e corra" em pares. Uma linha pisca na
// fileira do coração (aviso); a lança entra pela lateral de mansinho (só a
// ponta aparece, é a "carga") e então dispara de uma vez. Logo depois vem o
// eco: outra lança do lado oposto, numa fileira vizinha, e só então a calmaria.
//
//   carga           ms em que a lança só rasteja para dentro antes de disparar
//   eco             ms entre a estocada e o eco (0 desliga o eco)
//   deslocamento    distância (px) entre a fileira da estocada e a do eco
//   mirar           a estocada usa a fileira de um coração (alterna entre jogadores)
//   caixa           as estocadas entram num "corredor": caixa larga e baixa (aviso antes de mudar)
//
// `intervalo` continua sendo o tempo médio entre lanças: o ciclo (estocada +
// eco) dura 2 × intervalo, então a quantidade de lanças por segundo não muda.
export default definirAtaque({
  nome: 'sides',
  padrao: {
    duracao: 5000,
    intervalo: 900,
    velocidade: 220,
    comprimento: 44,
    espessura: 8,
    aviso: 500,
    mirar: true,
    carga: 260,
    eco: 380,
    deslocamento: 36,
    caixa: { largura: 280, altura: 120 },
  },
  iniciar(a, cfg) {
    const l = a.caixa
    const clampY = (y) => Math.min(Math.max(y, l.top + cfg.espessura), l.bottom - cfg.espessura)

    const lanca = (daEsquerda, y, aviso) => {
      a.aviso({ tipo: 'linha', x1: l.left, y1: y, x2: l.right, y2: y, espessura: cfg.espessura, ms: aviso }, () => {
        const dir = daEsquerda ? 1 : -1
        a.bala({
          // nasce com a ponta 10px dentro da caixa: a carga é visível
          x: daEsquerda ? l.left - cfg.comprimento / 2 + 10 : l.right + cfg.comprimento / 2 - 10,
          y,
          vx: dir * cfg.velocidade * 0.2,
          largura: cfg.comprimento,
          altura: cfg.espessura,
          forma: 'barra',
          jaAvisada: true,
          atualizar: (b) => {
            if (b.idade >= cfg.carga) b.vx = dir * cfg.velocidade
          },
        })
      })
    }

    const ciclo = cfg.eco > 0 ? cfg.intervalo * 2 : cfg.intervalo
    a.aCada(
      ciclo,
      (i) => {
        const daEsquerda = i % 2 === 0
        const alvoY = cfg.mirar ? a.alvo().y : a.aleatorio(l.top, l.bottom)
        const y = clampY(alvoY)
        lanca(daEsquerda, y, cfg.aviso)

        if (cfg.eco > 0) {
          // o eco vai para o lado do meio da caixa que sobra para a fileira
          const sinal = y > l.centerY ? -1 : 1
          const yEco = clampY(y + sinal * cfg.deslocamento)
          a.depois(cfg.eco, () => lanca(!daEsquerda, yEco, Math.max(ATAQUE.telegrafoMs, cfg.aviso * 0.85)))
        }
      },
      Infinity,
      300,
    )
  },
})
