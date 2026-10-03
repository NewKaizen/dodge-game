// Regras do modo PvP de cartas: energia, custos, validação de jogada,
// resolução da rodada (Ases especiais e suporte), dano/cura e vencedor.
// Lógica pura (sem Phaser), testável em Node. Ver docs/pvp-regras.md.
//
// O estado é um objeto simples (serializável com JSON). As funções MUDAM o
// estado recebido; para guardar uma cópia, use structuredClone(estado).
//
//   const estado = criarPartida({ p1: 'kris', p2: 'susie', semente: 'sala-7' })
//   iniciarRodada(estado)                         energia + mãos completas (5)
//   podeJogar(estado, 0, 'kris-espadas-9')        { ok, motivo }
//   const r = resolverRodada(estado, 'kris-espadas-9', 'susie-copas-5')
//   r.caixas[0]  o que a caixa do P1 roda: { carta, de, refletida, dano, ritmo, inverterMs }
//                inverterMs > 0: controles invertidos durante o ATAQUE TODO daquela caixa
//                (a arena usa só como "liga"; o valor em ms não limita mais a duração)
//   a "morte súbita" (ACELERACAO em constants.js) usa estado.rodada: a arena
//   acelera tudo a cada 5 rodadas (fatorAceleracao(estado.rodada))
//   ... os dois desviam; a cena chama aplicarDano(estado, j, dano) a cada acerto
//   ... e registrarGrazes(estado, j, n) para a energia dos grazes
//   ... e registrarPerfeito(estado, j, caixa.carta) quando j passa por um ataque sem levar dano
//   fimDaRodada(estado)                           -> vencedor ('p1' | 'p2' | 'empate' | null)
//
// Jogadores são índices: 0 = P1, 1 = P2.

import { PERSONAGENS } from '../data/personagens.js'
import { criarBaralho, completarMao, comprar, descartar, tirarDaMao, cartaNaMao, criarRng, inteiro, MAO } from './baralho.js'
import { CUSTOS, HP_RESERVA, especialDaCarta, efeitosDaCarta, resumoDoAtaque, ehSuper } from './cartas.js'

export { CUSTOS, custoDoValor } from './cartas.js'

// Energia de cada jogador
//   inicial          energia na 1ª rodada
//   porRodada        ganho no começo de cada rodada seguinte
//   maxima           teto (o que sobra acumula até aqui)
//   grazesPorPonto   +1 de energia a cada tantos grazes
//   passar           bônus para quem passa a vez (não joga carta)
export const ENERGIA = { inicial: 3, porRodada: 2, maxima: 10, grazesPorPonto: 5, passar: 1 }

// fatorHp multiplica o HP de PERSONAGENS (ou HP_RESERVA de cartas.js) no PvP
// ajusteHp: multiplicador extra por personagem, só no PvP (balanceamento sem mexer no co-op)
//   asriel 0,9: 100 -> 90 HP (o baralho dele já era o mais forte)
// segundaChance: fração do HP máximo curada pelo Ás de copas
export const PVP = { fatorHp: 1, ajusteHp: { asriel: 0.9 }, segundaChance: 0.25 }

export const ID_JOGADOR = ['p1', 'p2']
const outro = (j) => 1 - j

export function hpInicial(personagem) {
  const base = PERSONAGENS[personagem]?.hp ?? HP_RESERVA[personagem] ?? 100
  return Math.round(base * PVP.fatorHp * (PVP.ajusteHp[personagem] ?? 1))
}

// ---------- partida ----------

export function criarPartida({ p1, p2, semente = 'pvp' }) {
  const jogador = (personagem, j) => {
    const hp = hpInicial(personagem)
    return {
      id: ID_JOGADOR[j],
      personagem,
      hp,
      hpMax: hp,
      energia: 0,
      grazes: 0, // grazes que ainda não viraram energia
      escudo: null, // fator do dano do próximo ataque recebido (copas)
      protegido: false, // Ás de copas: nesta rodada o HP não passa de 1
      baralho: criarBaralho(personagem, `${semente}:${ID_JOGADOR[j]}`),
    }
  }
  return {
    semente: String(semente),
    rodada: 0,
    fase: 'inicio', // 'inicio' | 'escolha' | 'esquiva' | 'fim'
    rng: criarRng(`${semente}:partida`),
    jogadores: [jogador(p1, 0), jogador(p2, 1)],
    vencedor: null,
    historico: [],
  }
}

// Começo da rodada: energia (inicial na 1ª, +porRodada depois) e mãos completas
export function iniciarRodada(estado) {
  if (estado.vencedor) return estado
  estado.rodada++
  for (const jog of estado.jogadores) {
    jog.energia = estado.rodada === 1 ? ENERGIA.inicial : Math.min(ENERGIA.maxima, jog.energia + ENERGIA.porRodada)
    jog.protegido = false
    completarMao(jog.baralho, MAO.tamanho)
  }
  estado.fase = 'escolha'
  return estado
}

// ---------- jogadas ----------

// Jogada: id da carta, { carta: id } ou null (passar a vez)
const idDaJogada = (jogada) => (jogada == null ? null : typeof jogada === 'string' ? jogada : jogada.carta ?? null)

export function podeJogar(estado, j, jogada) {
  const id = idDaJogada(jogada)
  if (id === null) return { ok: true, motivo: null } // passar sempre pode
  const jog = estado.jogadores[j]
  const carta = cartaNaMao(jog.baralho, id)
  if (!carta) return { ok: false, motivo: 'carta não está na mão' }
  if (carta.custo > jog.energia) return { ok: false, motivo: `energia insuficiente (custa ${carta.custo}, tem ${jog.energia})` }
  return { ok: true, motivo: null }
}

export function cartasJogaveis(estado, j) {
  const jog = estado.jogadores[j]
  return jog.baralho.mao.filter((c) => c.custo <= jog.energia)
}

// A carta manda algum ataque? (Ás de copas não manda)
const mandaAtaque = (carta) => carta && especialDaCarta(carta) !== 'segundaChance'

// Resolve a rodada com as duas jogadas reveladas. Valida tudo antes de mudar
// o estado (jogada inválida -> erro, nada muda). Ordem:
//   1. paga a energia e descarta as cartas jogadas (quem passa ganha ENERGIA.passar)
//   2. ♦ Anular cancela a carta do outro (dois Anular: as duas se cancelam)
//   3. ♥ suporte em quem jogou (cura, escudo, energia, compra) e Ás de copas
//   4. ataques: cada carta vai para a caixa do adversário; ♠ Espelho devolve o
//      ataque do outro para a caixa dele (sem nada para devolver, manda um eco)
//   5. o escudo de quem recebe reduz o dano por bala daquele ataque (e é gasto)
//   6. ♣ Roubo pega uma carta sorteada da mão do outro
// SUPER (valor 14) é imparável: o Anular não cancela e o Espelho não reflete
// (com Espelho do outro lado, o Espelho manda o eco dele e o SUPER vai normal).
export function resolverRodada(estado, jogadaP1, jogadaP2) {
  if (estado.vencedor) throw new Error('a partida já acabou')
  const jogadas = [jogadaP1, jogadaP2]
  jogadas.forEach((jogada, j) => {
    const v = podeJogar(estado, j, jogada)
    if (!v.ok) throw new Error(`jogada inválida do ${ID_JOGADOR[j]}: ${v.motivo}`)
  })

  const eventos = []
  const efeitos = [novoEfeito(), novoEfeito()]

  // 1. paga e descarta
  const cartas = jogadas.map((jogada, j) => {
    const jog = estado.jogadores[j]
    const id = idDaJogada(jogada)
    if (id === null) {
      jog.energia = Math.min(ENERGIA.maxima, jog.energia + ENERGIA.passar)
      efeitos[j].energia += ENERGIA.passar
      eventos.push(`${jog.id} passou a vez (+${ENERGIA.passar} energia)`)
      return null
    }
    const carta = descartar(jog.baralho, id)
    jog.energia -= carta.custo
    eventos.push(`${jog.id} jogou ${carta.nome}`)
    return carta
  })
  const especiais = cartas.map(especialDaCarta)

  // 2. anular
  const anulada = [0, 1].map((j) => Boolean(cartas[j]) && especiais[outro(j)] === 'anular' && !ehSuper(cartas[j]))
  anulada.forEach((a, j) => a && eventos.push(`${cartas[j].nome} (${ID_JOGADOR[j]}) foi anulada`))
  const valendo = (j) => (cartas[j] && !anulada[j] ? cartas[j] : null)

  // 3. suporte em quem jogou
  for (const j of [0, 1]) {
    const carta = valendo(j)
    if (!carta) continue
    const jog = estado.jogadores[j]
    if (especiais[j] === 'segundaChance') {
      const cura = curar(estado, j, Math.round(jog.hpMax * PVP.segundaChance))
      jog.protegido = true
      efeitos[j].cura += cura
      efeitos[j].segundaChance = true
      eventos.push(`${jog.id} ganhou uma segunda chance (+${cura} HP)`)
      continue
    }
    const sup = carta.naipe === 'copas' ? efeitosDaCarta(carta) : null
    if (!sup) continue
    if (sup.cura) efeitos[j].cura += curar(estado, j, sup.cura)
    if (sup.escudo) {
      jog.escudo = Math.min(jog.escudo ?? 1, sup.escudo) // não acumula: fica o melhor
      efeitos[j].escudo = jog.escudo
    }
    if (sup.energia) {
      const antes = jog.energia
      jog.energia = Math.min(ENERGIA.maxima, jog.energia + sup.energia)
      efeitos[j].energia += jog.energia - antes
    }
    if (sup.compra) efeitos[j].compradas.push(...comprar(jog.baralho, sup.compra).map((c) => c.id))
  }

  // 4. ataques
  const caixas = [null, null] // caixas[j] = o que o jogador j vai desviar
  const espelho = (j) => valendo(j) && especiais[j] === 'espelho'
  for (const j of [0, 1]) {
    const carta = valendo(j)
    if (!mandaAtaque(carta)) continue
    const adv = outro(j)
    if (especiais[j] === 'espelho') {
      // reflete o ataque do outro (se houver um que dê para refletir); senão, eco
      const doOutro = valendo(adv)
      if (mandaAtaque(doOutro) && especiais[adv] !== 'espelho' && !ehSuper(doOutro)) continue // o reflexo é montado pelo outro lado
      caixas[adv] = montarCaixa(carta, j, false)
      continue
    }
    if (espelho(adv) && !ehSuper(carta)) {
      caixas[j] = montarCaixa(carta, j, true) // volta para quem jogou
      eventos.push(`${cartas[adv].nome} devolveu ${carta.nome} para ${ID_JOGADOR[j]}`)
    } else {
      caixas[adv] = montarCaixa(carta, j, false)
    }
  }

  // 5. escudo de quem recebe
  caixas.forEach((caixa, j) => {
    const jog = estado.jogadores[j]
    if (!caixa || jog.escudo == null) return
    caixa.escudo = jog.escudo
    caixa.dano = Math.max(1, Math.ceil(caixa.dano * jog.escudo))
    jog.escudo = null
  })

  // 6. roubo
  for (const j of [0, 1]) {
    if (!valendo(j) || especiais[j] !== 'roubo') continue
    const roubada = roubar(estado, j)
    efeitos[j].roubou = roubada?.id ?? null
    efeitos[outro(j)].perdeu = roubada?.id ?? null
    if (roubada) eventos.push(`${ID_JOGADOR[j]} roubou ${roubada.nome} de ${ID_JOGADOR[outro(j)]}`)
  }

  estado.fase = 'esquiva'
  const resultado = {
    rodada: estado.rodada,
    jogadas: cartas.map((c, j) => ({ carta: c, especial: especiais[j], anulada: anulada[j], passou: !c, super: ehSuper(c) })),
    caixas,
    efeitos,
    eventos,
  }
  estado.historico.push({
    rodada: estado.rodada,
    cartas: cartas.map((c) => c?.id ?? null),
    anuladas: anulada,
    caixas: caixas.map((c) => (c ? { carta: c.carta.id, de: c.de, refletida: c.refletida, dano: c.dano } : null)),
  })
  return resultado
}

function novoEfeito() {
  return { cura: 0, escudo: null, energia: 0, compradas: [], roubou: null, perdeu: null, segundaChance: false }
}

// O que uma caixa roda: a carta cujo ataque vai ali (montado com ataqueDaCarta),
// quem lançou, se foi refletida, dano por bala, ritmo e controles invertidos
function montarCaixa(carta, de, refletida) {
  return { carta, de, refletida, escudo: null, ...resumoDoAtaque(carta) }
}

// Ladrão j pega uma carta sorteada da mão do outro. A carta passa a ser dele
// (vai para a mão; com a mão cheia, para o descarte). Id repetido ganha sufixo.
function roubar(estado, j) {
  const vitima = estado.jogadores[outro(j)].baralho
  if (!vitima.mao.length) return null
  const alvo = vitima.mao[inteiro(estado.rng, 0, vitima.mao.length - 1)]
  const carta = tirarDaMao(vitima, alvo.id)
  const ladrao = estado.jogadores[j].baralho
  const ids = new Set([...ladrao.monte, ...ladrao.mao, ...ladrao.descarte].map((c) => c.id))
  let id = carta.id
  for (let n = 1; ids.has(id); n++) id = `${carta.id}~r${n}`
  const nova = { ...carta, id }
  if (ladrao.mao.length < MAO.maxima) ladrao.mao.push(nova)
  else ladrao.descarte.push(nova)
  return nova
}

// ---------- HP, energia e fim de jogo ----------

// Aplica o dano de UM acerto (o escudo já vem embutido em caixa.dano).
// Com o Ás de copas ativo, o HP não passa de 1. Devolve o dano efetivo.
export function aplicarDano(estado, j, dano) {
  const jog = estado.jogadores[j]
  const minimo = jog.protegido ? 1 : 0
  const novo = Math.max(minimo, Math.min(jog.hp, jog.hp - Math.max(0, dano)))
  const efetivo = jog.hp - novo
  jog.hp = novo
  return efetivo
}

// Cura até o HP máximo. Devolve quanto curou de fato.
export function curar(estado, j, n) {
  const jog = estado.jogadores[j]
  const antes = jog.hp
  jog.hp = Math.min(jog.hpMax, jog.hp + Math.max(0, n))
  return jog.hp - antes
}

// Grazes da esquiva viram energia (+1 a cada ENERGIA.grazesPorPonto). Devolve a energia ganha.
export function registrarGrazes(estado, j, n = 1) {
  const jog = estado.jogadores[j]
  jog.grazes += n
  let ganho = 0
  while (jog.grazes >= ENERGIA.grazesPorPonto) {
    jog.grazes -= ENERGIA.grazesPorPonto
    if (jog.energia < ENERGIA.maxima) {
      jog.energia++
      ganho++
    }
  }
  return ganho
}

// Desvio perfeito (passar por um ataque inteiro sem levar dano): energia pela
// carta daquele ataque. 2-8 -> 1, 9 a Q -> 2, K e SUPER -> 3, Ás que manda
// ataque (espelho/eco, anular, roubo) -> 1. Copas e caixa vazia (null) -> 0.
export function energiaPerfeito(carta) {
  if (!carta || carta.naipe === 'copas') return 0
  if (ehSuper(carta) || carta.valor === 13) return 3
  if (carta.valor === 1) return especialDaCarta(carta) ? 1 : 0
  if (carta.valor >= 9) return 2
  return carta.valor >= 2 ? 1 : 0
}

// Dá a energia do desvio perfeito ao jogador j (respeita ENERGIA.maxima). Devolve a energia ganha de fato.
export function registrarPerfeito(estado, j, carta) {
  const jog = estado.jogadores[j]
  const ganho = Math.max(0, Math.min(energiaPerfeito(carta), ENERGIA.maxima - jog.energia))
  jog.energia += ganho
  return ganho
}

// 'p1' | 'p2' | 'empate' | null (HP corrido: perde quem zerar; os dois juntos = empate)
export function checarVencedor(estado) {
  const [a, b] = estado.jogadores.map((jog) => jog.hp <= 0)
  if (a && b) return 'empate'
  if (a) return 'p2'
  if (b) return 'p1'
  return null
}

// Fim da esquiva: tira a proteção do Ás de copas e vê se alguém ganhou
export function fimDaRodada(estado) {
  for (const jog of estado.jogadores) jog.protegido = false
  estado.vencedor = checarVencedor(estado)
  estado.fase = estado.vencedor ? 'fim' : 'inicio'
  return estado.vencedor
}
