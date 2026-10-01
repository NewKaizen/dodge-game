// Estatísticas da luta, mostradas na tela de vitória.
// A Battle só chama estas funções em pontos-chave (uma linha em cada):
//   iniciarEstatisticas(cena)            no create
//   anotarDano(cena, inimigo, n, crit)   em danoInimigo (antes de tirar o HP)
//   contar(cena, 'campo', n)             dano recebido, grazes, combos, TP gasto...
//   resumoEstatisticas(cena)             no fim, passado para a cena Vitoria

export function iniciarEstatisticas(cena) {
  cena.estatisticas = {
    danoCausado: 0,
    danoRecebido: 0,
    acertosRecebidos: 0,
    maiorGolpe: 0,
    golpes: 0,
    criticos: 0,
    combos: 0,
    grazes: 0,
    tpGasto: 0,
    inicio: cena.time.now,
  }
  return cena.estatisticas
}

export function contar(cena, campo, n = 1) {
  const e = cena.estatisticas
  if (!e || !n) return
  e[campo] = (e[campo] ?? 0) + n
  if (campo === 'danoRecebido') e.acertosRecebidos++
}

// Conta só o dano que realmente saiu do HP (um golpe de 999 num chefe com 20
// de HP vale 20), para os totais não ficarem absurdos
export function anotarDano(cena, inimigo, n, critico = false) {
  const e = cena.estatisticas
  if (!e || !inimigo?.ativo || n <= 0) return
  const efetivo = Math.min(n, Math.max(0, inimigo.hp))
  e.danoCausado += efetivo
  e.maiorGolpe = Math.max(e.maiorGolpe, efetivo)
  e.golpes++
  if (critico) e.criticos++
}

export function resumoEstatisticas(cena) {
  const e = cena.estatisticas ?? iniciarEstatisticas(cena)
  const { inicio, ...contagem } = e
  return {
    ...contagem,
    tempoMs: Math.max(0, cena.time.now - inicio),
    turnos: cena.turno ?? 0,
    nivel: cena.nivel?.id ?? 'facil',
    hpMaxParty: (cena.party ?? []).reduce((soma, m) => soma + m.max, 0),
    caidosNoFim: (cena.party ?? []).filter((m) => m.caido).length,
  }
}

// ---------- nota final ----------
// Pontuação de 0 a 100, começando em 60:
//   - dano recebido: até -45 (proporcional ao HP total da party; sem dano = +10)
//   - turnos: -2 por turno acima de 8 (até -16)
//   - quem terminou caído: -6 cada
//   + grazes: +0,5 cada (até +12)   + combos perfeitos: +3 cada (até +12)
//   + nível: MÉDIO +8, DIFÍCIL +16   + poupar: +5
// S >= 90   A >= 75   B >= 55   C abaixo
export const RANKS = [
  { letra: 'S', minimo: 90, cor: 0xffe040, texto: '#ffe040', frase: 'Perfeição absoluta!' },
  { letra: 'A', minimo: 75, cor: 0x3cff6a, texto: '#3cff6a', frase: 'Excelente luta!' },
  { letra: 'B', minimo: 55, cor: 0x6dd0ff, texto: '#6dd0ff', frase: 'Bom trabalho!' },
  { letra: 'C', minimo: -Infinity, cor: 0xff8a1a, texto: '#ff8a1a', frase: 'Vitória suada!' },
]

const BONUS_NIVEL = { facil: 0, medio: 8, dificil: 16 }

export function calcularRank(r, modo) {
  let pontos = 60
  const hpMax = Math.max(1, r.hpMaxParty || 1)
  if (r.danoRecebido <= 0) pontos += 10
  else pontos -= Math.min(45, (r.danoRecebido / hpMax) * 45)
  pontos -= Math.min(16, Math.max(0, r.turnos - 8) * 2)
  pontos -= (r.caidosNoFim ?? 0) * 6
  pontos += Math.min(12, r.grazes * 0.5)
  pontos += Math.min(12, r.combos * 3)
  pontos += BONUS_NIVEL[r.nivel] ?? 0
  if (modo === 'spare') pontos += 5
  pontos = Math.round(Math.max(0, Math.min(100, pontos)))
  return { pontos, ...RANKS.find((k) => pontos >= k.minimo) }
}

// 83500 ms -> '1:23'
export function formatarTempo(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
