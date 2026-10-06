// Nota final da luta (tela de vitória) e formato do tempo. Os números vêm de
// CoopArena.resumo().
// ---------- nota final ----------
// Pontuação de 0 a 100, começando em 60:
//   - dano recebido: até -45 (proporcional ao HP total da party; sem dano = +10)
//   - turnos: -2 por turno acima de 8 (até -16)
//   - quem terminou caído: -6 cada
//   + grazes: +0,5 cada (até +12)   + combos e pares: +3 cada (até +12)
//   + nível: MÉDIO +8, DIFÍCIL +16
// S >= 90   A >= 75   B >= 55   C abaixo
const RANKS = [
  { letra: 'S', minimo: 90, cor: 0xffe040, texto: '#ffe040', frase: 'Perfeição absoluta!' },
  { letra: 'A', minimo: 75, cor: 0x3cff6a, texto: '#3cff6a', frase: 'Excelente luta!' },
  { letra: 'B', minimo: 55, cor: 0x6dd0ff, texto: '#6dd0ff', frase: 'Bom trabalho!' },
  { letra: 'C', minimo: -Infinity, cor: 0xff8a1a, texto: '#ff8a1a', frase: 'Vitória suada!' },
]

const BONUS_NIVEL = { facil: 0, medio: 8, dificil: 16 }

export function calcularRank(r) {
  let pontos = 60
  const hpMax = Math.max(1, r.hpMaxParty || 1)
  if (r.danoRecebido <= 0) pontos += 10
  else pontos -= Math.min(45, (r.danoRecebido / hpMax) * 45)
  pontos -= Math.min(16, Math.max(0, r.turnos - 8) * 2)
  pontos -= (r.caidosNoFim ?? 0) * 6
  pontos += Math.min(12, r.grazes * 0.5)
  pontos += Math.min(12, r.combos * 3)
  pontos += BONUS_NIVEL[r.nivel] ?? 0
  pontos = Math.round(Math.max(0, Math.min(100, pontos)))
  return { pontos, ...RANKS.find((k) => pontos >= k.minimo) }
}

// 83500 ms -> '1:23'
export function formatarTempo(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
