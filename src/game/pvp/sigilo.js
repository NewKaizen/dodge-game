// Cartas escondidas SÓ ATÉ A REVELAÇÃO no PVP ONLINE (1x1 em sala de amigos e partida rápida, e o todos
// contra todos; docs/pvp-regras.md "Escolha às cegas no online"). Lógica pura, testada em
// __tests__/sigilo.test.js. O PVP local (mesmo PC) e o vs CPU não passam por aqui.
//
//   - A escolha é simultânea e às cegas: enquanto alguém escolhe, ninguém vê a carta do outro (a jogada do
//     host vai ao convidado como FICHA, e o do convidado só vai ao host). Só aparece "<nome> já escolheu".
//   - Todos confirmaram (as jogadas travadas): o host manda as jogadas de verdade e o resultado com a carta
//     real de cada um (nome, valor, ataque), e dali em diante tudo se mostra como no jogo original.
//   - A MÃO, o monte e o descarte do outro continuam escondidos (viram fichas), o tempo todo.
//
// No fio, o host (que roda as regras e sabe tudo) manda a cada convidado o estado visto por ele
// (mascararEstado): as cartas dele como são; as dos outros viram
//   oculta     { id: ficha, oculta: true, personagem }       (mão, monte, descarte)
// `ficha` é um apelido sorteado por partida (criarFichas): o mesmo para a mesma carta enquanto a ponte
// existe (a mão virada do outro anima direito e a carta jogada é achada nela), sem relação com o id. A
// carta jogada, já revelada (cartaRevelada), é a carta de verdade, só que com o id = ficha.

// Apelidos de carta da partida: ficha(id) -> 'c' + 7 letras sorteadas, sempre o mesmo para o mesmo id
export function criarFichas(sorte = Math.random) {
  const mapa = new Map()
  const usadas = new Set()
  const nova = () => {
    let f
    do f = `c${Math.floor(sorte() * 36 ** 7).toString(36).padStart(7, '0')}`
    while (usadas.has(f))
    usadas.add(f)
    return f
  }
  const ficha = (id) => {
    if (id == null) return null
    if (usadas.has(id)) return id // já é uma ficha
    if (!mapa.has(id)) mapa.set(id, nova())
    return mapa.get(id)
  }
  ficha.ehFicha = (id) => usadas.has(id)
  return ficha
}

export function cartaOculta(carta, ficha) {
  if (!carta) return carta
  if (carta.oculta) return { id: carta.id, oculta: true, personagem: carta.personagem }
  return { id: ficha(carta.id), oculta: true, personagem: carta.personagem }
}

// a carta jogada, já revelada: a de verdade (a frente, o nome, o valor, o ataque), com a ficha no lugar do
// id (é por ele que a mão virada do outro acha a carta que saiu dela)
export function cartaRevelada(carta, ficha) {
  if (!carta || carta.oculta) return carta
  return { ...carta, id: ficha(carta.id) }
}

// O host embaralha os montes de novo com um sorteio que só ele tem (no lugar da semente da partida, que
// os dois PCs conhecem: com ela o convidado refaria a ordem do baralho do outro) e troca os RNGs das
// regras. Só no começo da partida em rede; a retomada (2D) volta do ponto que o host guardou
export function embaralharEscondido(estado, sorte = Math.random) {
  const u32 = () => Math.floor(sorte() * 2 ** 32) >>> 0
  for (const jog of estado.jogadores) {
    const monte = jog.baralho.monte
    for (let i = monte.length - 1; i > 0; i--) {
      const k = Math.floor(sorte() * (i + 1))
      ;[monte[i], monte[k]] = [monte[k], monte[i]]
    }
    jog.baralho.rng = { s: u32() }
  }
  estado.rng = { s: u32() }
  return estado
}

const mascararId = (id, ficha) => (id == null ? id : ficha(id))

// os ids de carta que a vaga `eu` pode ver no estado (as do baralho dela, em qualquer pilha)
function idsDe(estado, eu) {
  const b = estado?.jogadores?.[eu]?.baralho
  return new Set(b ? [...b.monte, ...b.mao, ...b.descarte].map((c) => c.id) : [])
}

// O estado das regras (pvp/regras.js ou pvp/ffa.js) visto pela vaga `eu`: cópia nova, o original fica
export function mascararEstado(estado, eu, ficha) {
  if (!estado) return estado
  const meus = idsDe(estado, eu)
  const copia = structuredClone(estado)
  copia.jogadores.forEach((jog, j) => {
    if (j === eu || !jog.baralho) return
    for (const pilha of ['monte', 'mao', 'descarte']) jog.baralho[pilha] = (jog.baralho[pilha] ?? []).map((c) => cartaOculta(c, ficha))
    jog.baralho.rng = { s: 0 } // (com o RNG do baralho dava para refazer os reembaralhos dele)
  })
  copia.rng = { s: 0 } // o das regras (roubo) é só do host
  const ver = (id) => (id == null || meus.has(id) ? id : ficha(id))
  copia.historico = (copia.historico ?? []).map((h) => ({
    ...h,
    ...(h.cartas && { cartas: h.cartas.map(ver) }),
    ...(h.caixas && { caixas: h.caixas.map((c) => (c ? { ...c, carta: ver(c.carta) } : c)) }),
  }))
  return copia
}

// O resultado da rodada (resolverRodada / resolverRodadaFfa / resolverDuelo / resolverCopia) visto por `eu`
export function mascararResultado(r, eu, ficha) {
  if (!r) return r
  const copia = structuredClone(r)
  const revelar = (carta, dono) => (dono === eu ? carta : cartaRevelada(carta, ficha))
  copia.jogadas = (copia.jogadas ?? []).map((jog, j) => (jog ? { ...jog, carta: revelar(jog.carta, j) } : jog))
  if (copia.caixas) copia.caixas = copia.caixas.map((c) => (c ? { ...c, carta: revelar(c.carta, c.dono ?? c.de) } : c))
  if (copia.efeitos)
    copia.efeitos = copia.efeitos.map((ef, j) =>
      !ef || j === eu ? ef : { ...ef, compradas: (ef.compradas ?? []).map((id) => mascararId(id, ficha)), roubou: mascararId(ef.roubou, ficha), perdeu: mascararId(ef.perdeu, ficha) },
    )
  if (copia.trocas) copia.trocas = copia.trocas.map((t, j) => (!t || j === eu ? t : { de: cartaRevelada(t.de, ficha), para: cartaRevelada(t.para, ficha) }))
  if (copia.armas) copia.armas = copia.armas.map((a, j) => (!a || j === eu ? a : { ...a, carta: a.carta ? cartaRevelada(a.carta, ficha) : a.carta }))
  return copia
}

// A jogada que vai para os outros: a ficha da carta (a carta virada na mão de quem jogou) ou null
export const mascararJogada = (id, ficha) => (id == null ? null : ficha(id))

// Os dados de uma cena que o host manda (irParaCena, retomada da 2D/5A) vistos por `eu`: o estado da retomada
export function mascararDadosDeCena(dados, eu, ficha) {
  if (!dados || typeof dados !== 'object') return dados
  const copia = { ...dados }
  if (copia.retomada?.estado) {
    copia.retomada = { ...copia.retomada, estado: mascararEstado(copia.retomada.estado, eu, ficha) }
  }
  return copia
}

// (testes e conferência) os ids de carta de verdade que aparecem em qualquer lugar de `dados`
export function idsDeCartaEm(dados, ids) {
  const achados = new Set()
  const texto = JSON.stringify(dados ?? null)
  for (const id of ids) if (texto.includes(`"${id}"`) || texto.includes(`"${id}~`)) achados.add(id)
  return [...achados]
}
