// As RECOMPENSAS da campanha (docs/campanha.md). Quem concede é o BANCO
// (supabase/migrations/0011_campanha.sql, conceder_campanha), chamado só pelo servidor; aqui fica o
// espelho em JS (o Supabase falso dos testes e a tela). Mudou um número, mude os dois (o teste
// campanha/__tests__/recompensas.test.js confere).
//
//   xpDaCorrida({ primeira, chefe, estrelasAntes, estrelas, xpHoje })  -> { xp, motivo }
export const XP_PRIMEIRA = 40 // a primeira vez que vence a fase
export const XP_PRIMEIRA_CHEFE = 80 // a primeira vez que vence o chefe do mundo
export const XP_ESTRELA = 10 // cada estrela nova (acima da melhor que a conta já tinha na fase)
export const XP_REPETICAO = 10 // vencer de novo uma fase já vencida (sem estrela nova)
export const XP_CAMPANHA_DIA = 300 // teto de XP da campanha por dia (fuso de São Paulo), tudo somado

// motivo: 'primeira' | 'estrelas' | 'repeticao' | 'teto_dia' (passou do teto: 0 ou parte)
export function xpDaCorrida({ primeira, chefe = false, estrelasAntes = 0, estrelas = 0, xpHoje = 0 }) {
  const novas = Math.max(0, estrelas - estrelasAntes)
  let xp = novas * XP_ESTRELA
  let motivo = novas > 0 ? 'estrelas' : 'repeticao'
  if (primeira) {
    xp += chefe ? XP_PRIMEIRA_CHEFE : XP_PRIMEIRA
    motivo = 'primeira'
  } else if (!novas) xp = XP_REPETICAO
  const sobra = Math.max(0, XP_CAMPANHA_DIA - Math.max(0, xpHoje))
  if (xp > sobra) return { xp: sobra, motivo: 'teto_dia' }
  return { xp, motivo }
}

const MOTIVOS = {
  primeira: 'primeira vitória nesta fase!',
  estrelas: 'estrela nova nesta fase',
  repeticao: 'fase repetida: um pouquinho de XP',
  teto_dia: 'teto de XP da campanha de hoje: o resto volta amanhã',
  derrota: 'sem XP: a fase não foi vencida',
  suspeita: 'o servidor não confirmou esta partida: sem recompensa',
  abandono: 'a partida foi abandonada: sem recompensa',
  indisponivel: 'progresso indisponível neste servidor',
  erro: 'não deu para salvar o progresso agora',
}
export const textoMotivoCampanha = (codigo) => MOTIVOS[codigo] ?? ''
