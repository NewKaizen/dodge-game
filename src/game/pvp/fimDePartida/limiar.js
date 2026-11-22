// QUANDO GRAVAR O REPLAY (gravador.js): fotografar a caixa a cada quadro custa caro (todo objeto da
// caixa é desenhado de novo numa textura: ~6 ms por quadro a 8x de CPU, medido; docs/desempenho.md),
// e o replay só aparece depois de um K.O. Então a gravação só fica ligada quando um K.O. é POSSÍVEL
// nesta rodada, e anda mais devagar enquanto ele ainda não está a um golpe de distância.
// Lógica pura (testada em pvp/__tests__/limiarReplay.test.js).
//
//   podeNocautear({ hp, hpMax, dano, morteSubita, bonus })   true = grava
//     hp, hpMax    a vida de quem está na caixa
//     dano         o dano por acerto do ataque desta caixa (0: caixa sem carta)
//     morteSubita  a partida já acelerou (ACELERACAO): grava sempre
//     bonus        a rodada tem evento de bônus (vários dão dano próprio: brasas, estátua, sol...)
//   umGolpe(...)   os mesmos dados: true = o próximo acerto derruba (grava no ritmo cheio)
//   perigoNaPista(arena, pista)   0, 1 ou 2 (o que a fonte do gravador usa: index.js fontePista)
//
// Conservador de propósito: grava com a vida até LIMIAR.fator vezes o maior dano de um acerto. O
// dano dos eventos de bônus não é conhecido de antemão: vale o maior deles (LIMIAR.bonus: a estátua
// tira 30 % da vida máxima). A conta vale a cada quadro, então um golpe que derruba a vida para perto
// do fim liga a gravação no meio da rodada (o K.O. ainda precisa de mais um acerto).
export const LIMIAR = {
  fator: 2,
  bonus: { fracao: 0.3, minimo: 6 },
}

// o maior dano que um acerto pode dar nesta rodada
export function maiorDano({ hpMax = 100, dano = 0, bonus = false } = {}) {
  const doBonus = bonus ? Math.max(LIMIAR.bonus.minimo, Math.ceil(hpMax * LIMIAR.bonus.fracao)) : 0
  return Math.max(dano || 0, doBonus)
}

export function podeNocautear({ hp, hpMax = 100, dano = 0, morteSubita = false, bonus = false } = {}) {
  if (!(hp > 0)) return false // já caiu (ou sem informação de vida: quem chama decide)
  if (morteSubita) return true
  const maior = maiorDano({ hpMax, dano, bonus })
  return maior > 0 && hp <= LIMIAR.fator * maior
}

export function umGolpe({ hp, hpMax = 100, dano = 0, morteSubita = false, bonus = false } = {}) {
  if (!(hp > 0)) return false
  const maior = maiorDano({ hpMax, dano, bonus })
  // na morte súbita o dano por bala também sobe: conta como a um golpe enquanto a vida couber em dois
  return maior > 0 && hp <= maior * (morteSubita ? LIMIAR.fator : 1)
}

// O perigo de K.O. numa pista agora (limiar.js): 0 = ninguém cai nesta rodada (não grava), 1 = pode
// cair (grava a 15 fotos/s), 2 = está a um golpe (30 fotos/s). Os corações da caixa (no CO-OP os dois
// do quadro), a vida de cada dono, o dano por acerto do ataque da caixa, a morte súbita e o bônus.
// Sem informação de vida (outra cena usando a pista): grava sempre, como antes
export function perigoNaPista(arena, pista) {
  const jogadores = arena.estado?.jogadores
  if (!Array.isArray(jogadores)) return 2
  const donos = new Set((pista.coracoes ?? []).map((c) => c.jogador))
  const k = arena.pistas?.indexOf?.(pista) ?? -1
  if (k >= 0 && typeof arena.donoDaPista === 'function') donos.add(arena.donoDaPista(k))
  const dados = {
    dano: pista.ataque?.ctx?.dano ?? 0,
    morteSubita: (arena.aceleracao ?? 1) > 1,
    bonus: Boolean(arena.efeitoBonus ?? arena.temEfeitoBonus),
  }
  let perigo = 0
  for (const j of donos) {
    const jog = jogadores[j]
    if (!jog || typeof jog.hp !== 'number') return 2
    const d = { ...dados, hp: jog.hp, hpMax: jog.hpMax ?? 100 }
    if (umGolpe(d)) return 2
    if (podeNocautear(d)) perigo = 1
  }
  return perigo
}
