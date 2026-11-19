// O NÍVEL DE JOGO dos bots do JOGAR RÁPIDO e a estimativa (escondida) de quanto o jogador joga
// (docs/online.md "Bots do Jogar Rápido"). Lógica pura, testada em server/__tests__/bots.test.js.
//
// Uma família só de números, de q = 0 (quem nunca jogou) a q = 1 (o "imbatível" da CPU), para tudo
// o que o bot faz: a esquiva (os números do EsquivaBot, pvp/botEsquiva.js), as cartas (o ruído e a
// paciência do pvp/bot.js, mais um erro de vez em quando), o duelo (pvp/bonus/botDuelo.js), o
// CTRL+C CTRL+V (pvp/bonus/botCopia.js) e o tempo de pensar. Cada FAIXA de bot é um q:
//
//   iniciante 0.10 · casual 0.30 · medio 0.48 · bom 0.66 · muito_bom 0.85
//
// O jogador NUNCA vê nada disso: a faixa mora na tabela do servidor (public.bots, 0019) e a
// estimativa do jogador só na memória do servidor.
//
//   numerosDe(q)                       { esquiva, cartas, duelo, copia, pensarMs }
//   estimarJogador({ nivel, recentes }) q do jogador: o nível da conta + os resultados recentes
//   faixaPara(q)                       a faixa do bot para quem joga em q (a de baixo mais perto)
//   ajustarRecentes(lista, venceu)     o histórico curto (as últimas RECENTES partidas contra bot)

export const FAIXAS = { iniciante: 0.1, casual: 0.3, medio: 0.48, bom: 0.66, muito_bom: 0.85 }
export const ORDEM_FAIXAS = Object.keys(FAIXAS)
export const RECENTES = 8

const lerp = (a, b, q) => a + (b - a) * q
const limitar = (v, a, b) => Math.max(a, Math.min(b, v))

// tudo o que muda com q (q entre 0 e 1)
export function numerosDe(q) {
  const x = limitar(Number(q) || 0, 0, 1)
  return {
    q: x,
    esquiva: {
      decidirMs: Math.round(lerp(270, 70, x)),
      horizonteMs: Math.round(lerp(190, 520, x)),
      margem: lerp(1, 9, x),
      erro: lerp(0.34, 0.02, x),
      confusao: lerp(0.5, 0.08, x),
      adaptaMs: Math.round(lerp(4500, 1500, x)),
      lapso: lerp(0.17, 0.008, x),
      lapsoMs: Math.round(lerp(720, 300, x)),
      avisos: { reacaoMs: Math.round(lerp(420, 90, x)), visaoMs: Math.round(lerp(420, 1300, x)), peso: lerp(0.35, 1, x) },
    },
    cartas: {
      ruido: lerp(0.85, 0.04, x),
      paciencia: lerp(0.1, 1, x),
      // de vez em quando joga uma carta qualquer (gente erra) ou passa sem precisar
      errar: lerp(0.22, 0.01, x),
      passarAToa: lerp(0.1, 0.01, x),
    },
    duelo: {
      decidirMs: Math.round(lerp(260, 60, x)),
      horizonteMs: Math.round(lerp(230, 580, x)),
      margem: lerp(2, 10, x),
      medo: lerp(0.45, 1, x),
      erro: lerp(0.22, 0.01, x),
      gatilho: lerp(0.32, 1, x),
      lapso: lerp(0.16, 0.005, x),
      lapsoMs: Math.round(lerp(700, 250, x)),
    },
    copia: { ritmo: lerp(4.4, 9, x), variacao: lerp(0.32, 0.12, x), cansaco: lerp(0.24, 0.06, x), reacaoMs: [Math.round(lerp(280, 110, x)), Math.round(lerp(520, 200, x))], tropeco: lerp(0.07, 0.008, x), tropecoMs: [Math.round(lerp(220, 100, x)), Math.round(lerp(460, 200, x))] },
    // quanto demora para escolher a carta (ms): [mínimo, típico, máximo]
    pensarMs: [Math.round(lerp(1800, 900, x)), Math.round(lerp(5200, 2600, x)), Math.round(lerp(11500, 8000, x))],
  }
}

export const numerosDaFaixa = (faixa) => numerosDe(FAIXAS[faixa] ?? FAIXAS.medio)

// O jogador: o nível da conta diz um pouco (quem já jogou muito tende a jogar melhor) e os
// resultados recentes contra bots corrigem (+ quem vem ganhando, − quem vem perdendo).
//   nivel     o nível da conta (convidado: 1)
//   recentes  [true | false, ...] do mais velho ao mais novo (true = o jogador venceu)
export function estimarJogador({ nivel = 1, recentes = [] } = {}) {
  const n = Math.max(1, Number(nivel) || 1)
  const base = 0.12 + 0.42 * (1 - Math.exp(-(n - 1) / 14))
  let ajuste = 0
  // os mais novos pesam mais
  recentes.slice(-RECENTES).forEach((venceu, i, lista) => {
    const peso = 0.5 + (0.5 * (i + 1)) / lista.length
    ajuste += (venceu ? 0.07 : -0.07) * peso
  })
  return limitar(base + ajuste, 0.02, 0.98)
}

// a faixa do bot para quem joga em q: a mais forte que não passa de q (+ uma folga pequena);
// quem está abaixo de todas pega a iniciante
export function faixaPara(q, { folga = 0.04 } = {}) {
  let escolhida = ORDEM_FAIXAS[0]
  for (const f of ORDEM_FAIXAS) if (FAIXAS[f] <= q + folga) escolhida = f
  return escolhida
}

export function ajustarRecentes(lista = [], venceu) {
  return [...lista, Boolean(venceu)].slice(-RECENTES)
}
