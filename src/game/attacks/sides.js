import { definirAtaque } from './definir.js'
import { ATAQUE } from '../constants.js'

// Estocadas. Identidade: ritmo de "pare e corra" em pares. A lança surge na
// lateral, na fileira do coração: só a ponta aparece e rasteja para dentro de
// mansinho (é a "carga", e é o único aviso: nenhuma linha risca a caixa) e
// então dispara de uma vez. Logo depois vem o eco: outra lança do lado oposto,
// numa fileira vizinha, e só então a calmaria. O lado da primeira lança, a
// distância do eco e os tempos variam um pouco a cada par (sorteio com semente).
//
//   carga           ms em que a ponta rasteja na borda antes de disparar
//   aviso           ms somados à carga (metade); era a linha que piscava na fileira
//                   (a carga inteira nunca fica abaixo de ATAQUE.telegrafoMs)
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

    // carga: a ponta aparece na borda e rasteja; o tempo varia um pouco a cada lança
    const lanca = (daEsquerda, y, aviso) => {
      const dir = daEsquerda ? 1 : -1
      const carga = Math.max(ATAQUE.telegrafoMs, (cfg.carga + aviso * 0.5) * a.aleatorio(0.9, 1.15))
      a.bala({
        // nasce fora, com a ponta encostando na borda: o que aparece é a ponta entrando
        x: daEsquerda ? l.left - cfg.comprimento / 2 + 2 : l.right + cfg.comprimento / 2 - 2,
        y,
        vx: dir * cfg.velocidade * 0.2,
        largura: cfg.comprimento,
        altura: cfg.espessura,
        forma: 'barra',
        entrando: true,
        arranque: { ms: carga, vx: dir * cfg.velocidade, vy: 0, rastro: true }, // dispara (os bots já leem)
      })
    }

    const ciclo = cfg.eco > 0 ? cfg.intervalo * 2 : cfg.intervalo
    let lado = a.aleatorio(0, 1) < 0.5
    let repetidas = 0 // o mesmo lado no máximo duas vezes seguidas
    a.aCada(
      ciclo,
      () => {
        // lado sorteado (antes alternava sempre: dava para decorar)
        const troca = repetidas >= 1 || a.aleatorio(0, 1) < 0.5
        repetidas = troca ? 0 : repetidas + 1
        if (troca) lado = !lado
        const daEsquerda = lado
        const alvoY = cfg.mirar ? a.alvo().y : a.aleatorio(l.top, l.bottom)
        const y = clampY(alvoY)
        lanca(daEsquerda, y, cfg.aviso)

        if (cfg.eco > 0) {
          // o eco vai para o lado do meio da caixa que sobra para a fileira
          const sinal = y > l.centerY ? -1 : 1
          const yEco = clampY(y + sinal * cfg.deslocamento * a.aleatorio(0.8, 1.25))
          a.depois(cfg.eco * a.aleatorio(0.85, 1.2), () => lanca(!daEsquerda, yEco, cfg.aviso * 0.85))
        }
      },
      Infinity,
      300,
    )
  },
})
