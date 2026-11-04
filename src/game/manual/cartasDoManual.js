import { ATAQUE } from '../constants.js'
import { CARTAS, ataqueDaCarta } from '../pvp/cartas.js'
import { criarPartida, iniciarRodada, resolverRodada, fimDaRodada, motivoBloqueio, ENERGIA } from '../pvp/regras.js'

// As cartas das páginas 3 e 4 do Manual do Ralsei, com as REGRAS REAIS (lógica pura, sem Phaser).
// Nada de carta inventada: as cartas são as do baralho do Ralsei (pvp/cartas.js), e jogar, pagar,
// bloquear e passar passam pelas funções do PvP de verdade (pvp/regras.js) numa partida de verdade.
//
//   cartaDoManual(id)              a carta real (cópia) pelo id
//   criarMesa({ mao, energia, energiaFixa })   uma partida real (criarPartida + iniciarRodada) com a mão fixa:
//     mesa.energia                 a energia do jogador agora
//     mesa.cartas                  as cartas da mão (sempre as mesmas, na mesma ordem)
//     mesa.bloqueio(id)            motivoBloqueio de verdade: null ou { codigo, motivo, curto }
//     mesa.jogar(id)               resolverRodada(estado, id, passar): paga o custo e devolve
//                                  { ok, carta, caixa, gasto } (caixa = a do adversário, que a arena roda)
//                                  ou { ok: false, bloqueio } sem mudar nada
//     mesa.passar()                resolverRodada(estado, passar, passar) + fimDaRodada + iniciarRodada:
//                                  { antes, depoisDePassar, depois, ganhoPassar, ganhoRodada }
//   planoDaVitrine(caixa, ataques) o que a vitrine (manual/vitrine.js) roda: o ataque de
//                                  ataqueDaCarta (como a arena: ataqueDaCartaNoJogo), na caixa fixa,
//                                  com o dano e o ritmo da caixa e o respiro inicial de Pista.rodar
//
// A mão volta igual depois de cada jogada (é um tutorial: dá para tentar de novo); com energiaFixa
// (página 3, que ainda não fala de energia) a energia também volta depois de pagar. A partida não acaba:
// ninguém toma dano (o ataque cai no boneco de treino).

export const PERSONAGEM_DO_MANUAL = 'ralsei'

// página 3: três cartas baratas, de ataques bem diferentes (cair de cima, atravessar de lado, estourar)
export const MAO_P3 = ['ralsei-espadas-5', 'ralsei-ouros-4', 'ralsei-paus-3']
export const CHUVA_P3 = 'ralsei-espadas-5' // Estrela Gentil: "estrelas cadentes entram por cima"

// página 4: custos diferentes (1, 3 e o SUPER, 10) e a energia que não dá para a do meio
export const MAO_P4 = ['ralsei-paus-3', 'ralsei-espadas-9', 'ralsei-espadas-14']
export const CARA_P4 = 'ralsei-espadas-9' // Coro de Estrelas (custa 3)
export const ENERGIA_P4 = 2

// o desenho de giz no miolo de cada carta (manual/ilustracoes.js desenhoDaCarta), pelo ataque dela
export const DESENHO_DA_CARTA = {
  'ralsei-espadas-5': 'estrela',
  'ralsei-ouros-4': 'ninar',
  'ralsei-paus-3': 'bolinho',
  'ralsei-espadas-9': 'coro',
  'ralsei-espadas-14': 'super',
}

const TODAS = Object.values(CARTAS).flat()

export function cartaDoManual(id) {
  const c = TODAS.find((x) => x.id === id)
  if (!c) throw new Error(`carta desconhecida no manual: ${id}`)
  return { ...c }
}

export function criarMesa({ mao, energia = ENERGIA.maxima, energiaFixa = false, semente = 'manual-do-ralsei' } = {}) {
  const ids = [...mao]
  const estado = criarPartida({ p1: PERSONAGEM_DO_MANUAL, p2: PERSONAGEM_DO_MANUAL, semente })
  iniciarRodada(estado)
  const jog = estado.jogadores[0]
  jog.energia = energia
  // a mão do tutorial é sempre a mesma (tira do monte as que vão para a mão: nada repetido)
  const fixarMao = () => {
    const b = jog.baralho
    b.mao = ids.map(cartaDoManual)
    b.monte = b.monte.filter((c) => !ids.includes(c.id))
  }
  fixarMao()

  return {
    estado,
    ids,
    get energia() {
      return jog.energia
    },
    get cartas() {
      return jog.baralho.mao
    },
    bloqueio: (id) => motivoBloqueio(estado, 0, id),
    jogar(id) {
      const bloqueio = motivoBloqueio(estado, 0, id)
      if (bloqueio) return { ok: false, bloqueio }
      const antes = jog.energia
      const r = resolverRodada(estado, id, null)
      fimDaRodada(estado)
      fixarMao()
      const gasto = antes - jog.energia
      if (energiaFixa) jog.energia = antes
      return { ok: true, carta: r.caixas[1].carta, caixa: r.caixas[1], gasto }
    },
    passar() {
      const antes = jog.energia
      resolverRodada(estado, null, null)
      const depoisDePassar = jog.energia
      fimDaRodada(estado)
      iniciarRodada(estado)
      fixarMao()
      return { antes, depoisDePassar, depois: jog.energia, ganhoPassar: depoisDePassar - antes, ganhoRodada: jog.energia - depoisDePassar }
    },
  }
}

// O plano da vitrine: o MESMO ataque que a arena montaria para esta caixa (PvpArena: ataqueDaCartaNoJogo(
// caixa.carta) + pista.rodar(ataque, { dano: caixa.dano, ritmo: caixa.ritmo })), só que na caixa fixa
// (o cartão do boneco não muda de forma). `ataques` = attacks/index.js (injetada: testável em Node).
export function planoDaVitrine(caixa, ataques, { semente } = {}) {
  const carta = caixa.carta
  return {
    carta,
    ataque: ataqueDaCarta(carta, { ataques, caixaFixa: true }),
    dano: caixa.dano,
    ritmo: caixa.ritmo,
    semente: semente ?? `manual:vitrine:${carta.id}`,
    inicio: ATAQUE.respiroMs, // Pista.rodar: max(respiroMs, preparo da caixa); a caixa fixa não prepara
  }
}

export { ENERGIA }
