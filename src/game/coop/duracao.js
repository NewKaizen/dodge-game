// Quanto dura uma luta do CO-OP, em segundos, a partir de quantas rodadas ela teve (CO-OP 2.0: o alvo é
// ~4 a 6 minutos no MÉDIO com dois jogadores médios; docs/coop-cartas.md "Lutas mais curtas"). Lógica
// pura: scripts/balanceamento/simularCoop.mjs usa isto para mostrar os minutos de cada linha e o teste
// coop/__tests__/duracao.test.js confere a faixa com uma simulação de partidas.
//
// TEMPO (segundos) medido na CoopArena com a CPU aliada (Playwright, docs/coop-cartas.md): o que cada parte
// da rodada leva na tela, sem contar a escolha (medido: início 1,1 · revelação 2,0 · arremesso 0,8 ·
// contra-ataque 2,4 · fim 0,8; o ataque do chefe dura 4,8 a 8,4 s). A escolha é de gente: a rodada espera
// os DOIS, então `escolha` é a de uma dupla que conversa (o relógio dá 15 s; a CPU leva ~3 s).
//   abertura    a apresentação da luta (uma vez)
//   rodada      início (banner, carta do chefe), revelação, arremesso, contra-ataque e fim, sem a esquiva
//   esquiva     o quadro aberto (o ataque do chefe ~6,5 s, os respiros e o abrir/fechar)
//   semQuadro   a rodada sem esquiva (A♠/A♦/A♣/SUPER tiraram o ataque, ou o chefe está ATORDOADO)
//   finalizacao a FINALIZAÇÃO EM DUPLA (na rodada atordoado) e o QUEBROU! que vem antes
//   faseNova    o aviso da fase nova do chefe
export const TEMPO = {
  abertura: 4.5,
  rodada: 7.5,
  esquiva: 7,
  semQuadro: 1.2,
  finalizacao: 5,
  faseNova: 2.2,
  escolha: 12,
}

// rodadas: quantas rodadas a luta teve; semQuadro: quantas delas sem esquiva; finalizacoes: quantas
// rodadas atordoado; fases: quantas trocas de fase do chefe. escolha: segundos por escolha (gente)
export function estimarDuracaoLuta({ rodadas, semQuadro = 0, finalizacoes = 0, fases = 0, escolha = TEMPO.escolha } = {}) {
  const comQuadro = Math.max(0, rodadas - semQuadro)
  return Math.round(TEMPO.abertura + rodadas * (TEMPO.rodada + escolha) + comQuadro * TEMPO.esquiva + semQuadro * TEMPO.semQuadro + finalizacoes * TEMPO.finalizacao + fases * TEMPO.faseNova)
}

export const minutos = (segundos) => Math.round((segundos / 60) * 10) / 10
