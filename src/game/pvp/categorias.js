// Cartas escondidas no PVP ONLINE (1x1 em sala de amigos e partida rápida, e o todos contra todos):
// ninguém vê a carta EXATA do outro, só a CATEGORIA dela, como as cartas do chefe no CO-OP
// (docs/pvp-regras.md "Cartas escondidas no online"). Lógica pura, testada em
// __tests__/categorias.test.js. O PVP local (mesmo PC) e o vs CPU não passam por aqui.
//
// Categoria = o naipe (o tipo da carta nas regras: cartas.js), com o SUPER à parte:
//   ♠ espadas  ATAQUE      (o Ás ♠ Espelho também: ele manda um ataque, o eco ou o que passou adiante)
//   ♦ ouros    CONTROLE    (o Ás ♦ Anular também: ele controla a carta do outro)
//   ♣ paus     ARMADILHA   (o Ás ♣ Roubo também: a armadilha pega uma carta da mão)
//   ♥ copas    SUPORTE     (cura, escudo, energia, compra; o Ás ♥ Segunda chance também)
//   ★ SUPER    SUPER       (valor 14, uma por baralho)
// O Ás fica na categoria do naipe dele: o efeito especial aparece quando acontece (ESPELHO!, ANULADA!...),
// como o ataque aparece na esquiva.
//
// No fio, o host (que roda as regras e sabe tudo) manda a cada convidado o estado e o resultado VISTOS
// POR ELE (mascararEstado / mascararResultado): as cartas dele como são; as dos outros viram
//   oculta     { id: ficha, oculta: true, personagem }                  (mão, monte, descarte)
//   revelada   { id: ficha, oculta: true, personagem, categoria, naipe, valor, nome,
//                ataque, perfeito }                                      (a carta jogada na rodada)
// `ficha` é um apelido sorteado por partida (criarFichas): o mesmo para a mesma carta enquanto a ponte
// existe (a mão do outro anima direito, a carta jogada é achada na mão virada), sem nenhuma relação com o
// id. `ataque` é o descritor do ataque (cartas.js descritorDoAtaque: a esquiva precisa rodar o ataque, e
// a esquiva mostra o ataque de qualquer jeito) e `perfeito` a energia do desvio perfeito daquela carta.
// `naipe` é o da categoria (o SUPER vai como espadas, valor 14); `nome` é o rótulo da categoria.

import { ehSuper, descritorDoAtaque } from './cartas.js'
import { energiaPerfeito } from './regras.js'

export const CATEGORIAS = {
  ataque: { id: 'ataque', rotulo: 'ATAQUE', icone: '♠', cor: '#ffffff', naipe: 'espadas' },
  controle: { id: 'controle', rotulo: 'CONTROLE', icone: '♦', cor: '#ff5a70', naipe: 'ouros' },
  armadilha: { id: 'armadilha', rotulo: 'ARMADILHA', icone: '♣', cor: '#ffffff', naipe: 'paus' },
  suporte: { id: 'suporte', rotulo: 'SUPORTE', icone: '♥', cor: '#ff5a70', naipe: 'copas' },
  super: { id: 'super', rotulo: 'SUPER', icone: '★', cor: '#ffd23c', corRotulo: '#ff6a4a', naipe: 'espadas' },
}
const POR_NAIPE = { espadas: 'ataque', ouros: 'controle', paus: 'armadilha', copas: 'suporte' }

// a categoria (id de CATEGORIAS) de uma carta (de verdade ou já revelada); null sem carta
export function categoriaDaCarta(carta) {
  if (!carta) return null
  if (carta.categoria) return carta.categoria
  if (ehSuper(carta)) return 'super'
  return POR_NAIPE[carta.naipe] ?? null
}

export const infoCategoria = (carta) => CATEGORIAS[categoriaDaCarta(carta)] ?? null

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

export function cartaRevelada(carta, ficha) {
  if (!carta || carta.oculta) return carta
  const categoria = categoriaDaCarta(carta)
  const info = CATEGORIAS[categoria]
  return {
    id: ficha(carta.id),
    oculta: true,
    personagem: carta.personagem,
    categoria,
    naipe: info.naipe,
    valor: categoria === 'super' ? 14 : null,
    nome: info.rotulo,
    ataque: descritorDoAtaque(carta),
    perfeito: energiaPerfeito(carta),
  }
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
  if (copia.eventos) copia.eventos = [] // (textos do host com o nome das cartas)
  return copia
}

// A jogada que vai para os outros: a ficha da carta (a carta virada na mão de quem jogou) ou null
export const mascararJogada = (id, ficha) => (id == null ? null : ficha(id))

// maiorCarta das estatísticas (PvpResultado): a dos outros vira a categoria
// (lista por vaga, ou o { p1, p2 } da PvpResultado)
export function mascararEstatisticas(lista, eu, ficha) {
  const ver = (e, j) => (j === eu || !e?.maiorCarta ? e : { ...e, maiorCarta: cartaRevelada(e.maiorCarta, ficha) })
  if (Array.isArray(lista)) return lista.map(ver)
  if (lista && typeof lista === 'object' && ('p1' in lista || 'p2' in lista)) return { ...lista, p1: ver(lista.p1, 0), p2: ver(lista.p2, 1) }
  return lista
}

// Os dados de uma cena que o host manda (irParaCena, retomada da 2D/5A) vistos por `eu`: o estado da
// retomada, as estatísticas e a lista de jogadores do resultado
export function mascararDadosDeCena(dados, eu, ficha) {
  if (!dados || typeof dados !== 'object') return dados
  const copia = { ...dados }
  if (copia.retomada?.estado) {
    copia.retomada = { ...copia.retomada, estado: mascararEstado(copia.retomada.estado, eu, ficha) }
    if (copia.retomada.extra?.estatisticas) copia.retomada.extra = { ...copia.retomada.extra, estatisticas: mascararEstatisticas(copia.retomada.extra.estatisticas, eu, ficha) }
  }
  if (copia.estatisticas) copia.estatisticas = mascararEstatisticas(copia.estatisticas, eu, ficha)
  if (Array.isArray(copia.jogadores)) copia.jogadores = mascararEstatisticas(copia.jogadores, eu, ficha)
  return copia
}

// (testes e conferência) os ids de carta de verdade que aparecem em qualquer lugar de `dados`
export function idsDeCartaEm(dados, ids) {
  const achados = new Set()
  const texto = JSON.stringify(dados ?? null)
  for (const id of ids) if (texto.includes(`"${id}"`) || texto.includes(`"${id}~`)) achados.add(id)
  return [...achados]
}
