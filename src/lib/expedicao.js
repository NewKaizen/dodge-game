// RECOMPENSAS da EXPEDIÇÃO do CO-OP (docs/coop-cartas.md "Expedição", docs/baus.md): as constantes que o
// servidor (server/partidas.js) e o navegador (ExpedicaoFim) usam. O espelho no banco é a
// 0017_expedicao.sql (expedicao_xp_luta(), expedicao_xp_completa(), expedicao_xp_teto_dia()); o teste confere.
//
// O servidor só concede o que ele conferiu: a partida de CO-OP em rede VALIDADA (os relatos concordam, como
// o XP de sempre, server/partidas.js decidirCoop/decidirN), com o mesmo chefão e o mesmo número de lutas
// vencidas nos relatos e duração mínima por luta. Fora da rede (contra a CPU aliada) não há recompensa, como
// na luta rápida contra a CPU.
export const XP_EXPEDICAO = { porLuta: 15, completa: 40, tetoDia: 255 } // XP a mais (além do da partida)
export const CHANCE_BAU_EXPEDICAO = 500_000 // em 1.000.000 (50%): ao completar, no máximo 1 baú por dia por chefão
export const ESCALA_BAU_EXPEDICAO = 1_000_000
// (0018: + os BOSSES SEMANAIS, que são sempre uma expedição; docs/boss-semanal.md)
export const CHEFOES_EXPEDICAO = ['king', 'queen', 'jevil', 'coronel', 'escuridao', 'ladra']
// o padrão do chefão na chave do baú ('expedicao:<dia>:<chefão>'): o mesmo do conceder_bau (0018)
export const RE_REF_BAU_EXPEDICAO = new RegExp(`^[0-9]{4}-[0-9]{2}-[0-9]{2}:(${CHEFOES_EXPEDICAO.join('|')})$`)
export const DURACAO_MINIMA_LUTA_S = 60 // cada luta vencida pede pelo menos isto de partida (medido pelo servidor)
export const LUTAS_EXPEDICAO = 3

// a chave do baú (fonte 'expedicao' em conceder_bau): uma por conta, dia e chefão
export const chaveBauExpedicao = (dia, chefe) => `expedicao:${dia}:${chefe}`

// o `expedicao` do relato, limpo (null = não serve)
export function lerExpedicao(x) {
  if (!x || typeof x !== 'object' || !CHEFOES_EXPEDICAO.includes(x.chefe)) return null
  if (!Number.isInteger(x.lutas) || x.lutas < 0 || x.lutas > LUTAS_EXPEDICAO) return null
  return { chefe: x.chefe, lutas: x.lutas, sorteada: Boolean(x.sorteada) }
}

// o XP a mais de UMA expedição (antes do teto do dia, que o banco aplica)
// EXPEDIÇÃO SEMANAL (0018): o relato completou a expedição do chefe da semana (o troféu da semana pede isto)
export const completouExpedicaoDe = (relato, chefe) => Boolean(chefe) && relato?.expedicao?.chefe === chefe && relato.expedicao.lutas === LUTAS_EXPEDICAO

export const xpDaExpedicao = ({ lutas, completa }) => Math.max(0, Math.min(LUTAS_EXPEDICAO, lutas | 0)) * XP_EXPEDICAO.porLuta + (completa ? XP_EXPEDICAO.completa : 0)
