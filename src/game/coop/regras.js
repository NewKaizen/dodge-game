// Regras do CO-OP de cartas: os dois jogadores (ou jogador + CPU aliada)
// contra um chefe que também joga cartas. Lógica pura (sem Phaser), testável
// em Node. Ver docs/coop-cartas.md.
//
// Mesma base do PvP (pvp/regras.js e pvp/baralho.js): energia, mãos, custos,
// grazes, desvio perfeito. O estado tem o mesmo formato do PvP em
// `jogadores` (as funções de energia do PvP valem aqui) e mais o `chefe`.
//
//   const estado = criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'king', nivel: 'facil', semente })
//   iniciarRodadaCoop(estado)          energia, mãos, quem caiu volta, o chefe mostra as intenções
//   podeJogarCoop(estado, j, id)       { ok, motivo }
//   const r = resolverRodadaCoop(estado, jogadaP1, jogadaP2)
//     r.caixas[j]   o que o jogador j desvia: { carta (do chefe), dano, ritmo, inverter, escudo, lento } ou null
//     r.golpes[j]   o contra-ataque do jogador j: { carta, tipo, base } ou null
//   ... esquiva: aplicarDanoCoop(estado, j, dano) a cada acerto (HP 0 = caiu),
//       registrarGrazes / registrarPerfeito do PvP
//   const lista = calcularGolpes(estado, r.golpes, desempenho)   desempenho[j] = { perfeito, grazes }
//   lista.forEach((g) => aplicarGolpe(estado, g.dano))
//   fimDaRodadaCoop(estado)            -> { vencedor: 'vitoria' | 'derrota' | null, novaFase }

import { NIVEIS } from '../constants.js'
import { criarBaralho, completarMao, comprar, descartar, cartaNaMao, criarRng, embaralhar, MAO } from '../pvp/baralho.js'
import { ENERGIA, hpInicial, aplicarDano, curar } from '../pvp/regras.js'
import { especialDaCarta, efeitosDaCarta, ehSuper } from '../pvp/cartas.js'
import { BARALHOS_CHEFES } from './chefes/index.js'
import { CARTAS_CHEFES, faseDoChefe, suporteDoChefe, danoDaCartaChefe, ritmoDaCartaChefe, inverteControles, poderDaCartaChefe } from './cartasChefe.js'

export { ENERGIA } from '../pvp/regras.js'
export { registrarGrazes, registrarPerfeito, energiaPerfeito } from '../pvp/regras.js'

// Números do CO-OP
//   retornoRodadas   quem cai fica de fora tantas rodadas e volta sozinho com retornoHp do HP máx
//   reviverMin       cura de copas que levanta o parceiro: pelo menos esta fração do HP máx dele
//   critico          desvio perfeito multiplica o contra-ataque
//   combo / par      os dois atacam com o mesmo naipe / o mesmo valor
//   grazeArmadilha   ♣: cada graze na esquiva soma esta fração ao golpe (até grazeArmadilhaMax)
//   lentidao         ♦: fator da velocidade das balas do chefe na caixa de quem jogou (Q/K: nas duas)
//   superGolpe       dano base do SUPER de um jogador
//   cargaSuper       rodadas para encher a carga do SUPER do chefe (da 2ª fase em diante)
//   rouboEnergia     energia que o A♣ dá
//   anularCarga      quanto o A♦ tira da carga do SUPER do chefe
//   segundaChance    fração do HP máx que o A♥ cura nos dois
export const COOP = {
  retornoRodadas: 2,
  retornoHp: 0.3,
  reviverMin: 0.25,
  critico: 1.5,
  combo: 1.25,
  par: 1.5,
  grazeArmadilha: 0.06,
  grazeArmadilhaMax: 0.6,
  lentidao: 0.85,
  superGolpe: 60,
  cargaSuper: 4,
  rouboEnergia: 2,
  anularCarga: 2,
  segundaChance: 0.25,
}

// Dano base do contra-ataque de cada naipe, pelo valor da carta
export const GOLPE = {
  espadas: (v) => Math.round(6 + 2.6 * v), // 2 -> 11, 9 -> 29, K -> 40
  ouros: (v) => Math.round(4 + 1.8 * v), // 2 -> 8, K -> 27
  paus: (v) => Math.round(5 + 2 * v), // 2 -> 9, K -> 31 (+ grazes)
}
const ECO = 7 // Espelho sem nada para refletir: golpe de um 7♠

const pct = (f) => `${Math.round(f * 100)}%`

// Texto da carta no CO-OP (a prévia ampliada mostra este no lugar do texto do PvP)
export function descricaoCoop(carta) {
  if (ehSuper(carta)) return `SUPER: golpe de ${COOP.superGolpe} no chefe e varre a carta dele da sua caixa (o SUPER do chefe não sai).`
  const especial = especialDaCarta(carta)
  if (especial === 'espelho') return `ESPECIAL: a carta do chefe na sua caixa volta e acerta ele. Sem nada para refletir (ou contra o SUPER dele), golpe de ${GOLPE.espadas(ECO)}.`
  if (especial === 'anular') return `ESPECIAL: cancela a carta do chefe na sua caixa e tira ${COOP.anularCarga} da carga do SUPER dele.`
  if (especial === 'roubo') return `ESPECIAL: rouba a carta do chefe que ia no parceiro (a caixa dele fica livre) e você ganha +${COOP.rouboEnergia} de energia.`
  if (especial === 'segundaChance') return `ESPECIAL: VOCÊ E O PARCEIRO curam ${pct(COOP.segundaChance)} do HP máximo e ninguém cai nesta rodada. Levanta o parceiro caído.`
  const v = carta.valor
  if (carta.naipe === 'espadas') return `Contra-ataque: golpe de ${GOLPE.espadas(v)} no chefe depois da esquiva (CRÍTICO x${COOP.critico} se você não levar dano).`
  if (carta.naipe === 'ouros') return `Contra-ataque: golpe de ${GOLPE.ouros(v)} e a carta do chefe ${v >= 12 ? 'nas DUAS caixas fica' : 'na sua caixa fica'} mais lenta.`
  if (carta.naipe === 'paus') return `Armadilha: golpe de ${GOLPE.paus(v)} no chefe, +${pct(COOP.grazeArmadilha)} a cada graze na esquiva (até +${pct(COOP.grazeArmadilhaMax)}).`
  const ef = efeitosDaCarta(carta) ?? {}
  const partes = []
  if (ef.cura) partes.push(`cura ${ef.cura} HP em VOCÊ E NO PARCEIRO (levanta o parceiro caído)`)
  if (ef.escudo) partes.push(`escudo nos DOIS: o próximo ataque causa ${pct(ef.escudo)} do dano`)
  if (ef.energia) partes.push(`+${ef.energia} de energia para você`)
  if (ef.compra) partes.push(`você compra ${ef.compra} carta${ef.compra > 1 ? 's' : ''}`)
  return `Suporte: ${partes.join('; ')}.`
}

export const ID_JOGADOR = ['p1', 'p2']
const outro = (j) => 1 - j

// ---------- partida ----------

export function criarPartidaCoop({ party, chefe, nivel = 'facil', semente = 'coop' }) {
  const def = BARALHOS_CHEFES[chefe]
  if (!def) throw new Error(`chefe sem baralho de cartas: ${chefe}`)
  const niv = NIVEIS[nivel] ?? NIVEIS.facil
  const rng = criarRng(`${semente}:coop`)
  const jogador = (personagem, j) => {
    const hp = hpInicial(personagem)
    return {
      id: ID_JOGADOR[j],
      personagem,
      hp,
      hpMax: hp,
      energia: 0,
      grazes: 0,
      escudo: null,
      protegido: false,
      caido: false,
      voltaEm: null, // rodada em que volta sozinho (caído)
      baralho: criarBaralho(personagem, `${semente}:${ID_JOGADOR[j]}`),
    }
  }
  const comTextoCoop = (jog) => {
    for (const carta of jog.baralho.monte) carta.descricao = descricaoCoop(carta)
    return jog
  }
  const hpChefe = Math.round(def.hp * niv.hp)
  return {
    modo: 'coop',
    semente: String(semente),
    nivel: NIVEIS[nivel] ? nivel : 'facil',
    fatorDano: niv.dano,
    rodada: 0,
    fase: 'inicio',
    rng,
    jogadores: [comTextoCoop(jogador(party[0], 0)), comTextoCoop(jogador(party[1] ?? party[0], 1))],
    chefe: {
      id: chefe,
      hp: hpChefe,
      hpMax: hpChefe,
      fase: 0,
      guarda: null, // fator do dano do próximo contra-ataque (♥ do chefe)
      carga: 0, // carga do SUPER (da 2ª fase em diante)
      cargaMax: COOP.cargaSuper,
      monte: embaralhar(CARTAS_CHEFES[chefe].fases[0].map((c) => ({ ...c })), rng),
      descarte: [],
      intencoes: [null, null], // carta virada que o chefe vai jogar em cada jogador
    },
    vencedor: null,
    historico: [],
  }
}

function comprarDoChefe(estado) {
  const c = estado.chefe
  if (!c.monte.length) {
    c.monte = embaralhar(c.descarte, estado.rng)
    c.descarte = []
  }
  return c.monte.shift() ?? null
}

function levantar(estado, j, hp) {
  const jog = estado.jogadores[j]
  jog.caido = false
  jog.voltaEm = null
  jog.hp = Math.max(1, Math.min(jog.hpMax, Math.round(hp)))
  return jog.hp
}

function derrubar(estado, j) {
  const jog = estado.jogadores[j]
  jog.caido = true
  jog.hp = 0
  jog.escudo = null
  jog.voltaEm = estado.rodada + COOP.retornoRodadas + 1
}

export const emPe = (estado) => [0, 1].filter((j) => !estado.jogadores[j].caido)

// Começo da rodada: quem caiu há tempo suficiente volta, energia e mãos (como
// no PvP), a carga do SUPER do chefe sobe e ele escolhe uma carta para cada
// jogador em pé (as intenções). Devolve os eventos ({ tipo, j? }).
export function iniciarRodadaCoop(estado) {
  if (estado.vencedor) return []
  estado.rodada++
  const eventos = []
  estado.jogadores.forEach((jog, j) => {
    if (jog.caido && estado.rodada >= jog.voltaEm) {
      levantar(estado, j, jog.hpMax * COOP.retornoHp)
      eventos.push({ tipo: 'voltou', j })
    }
    jog.energia = estado.rodada === 1 ? ENERGIA.inicial : Math.min(ENERGIA.maxima, jog.energia + ENERGIA.porRodada)
    jog.protegido = false
    completarMao(jog.baralho, MAO.tamanho)
  })

  const c = estado.chefe
  c.intencoes = [null, null]
  const alvos = emPe(estado)
  if (c.fase >= 1) c.carga = Math.min(c.cargaMax, c.carga + 1)
  if (c.fase >= 1 && c.carga >= c.cargaMax && alvos.length) {
    c.carga = 0
    for (const j of alvos) c.intencoes[j] = { ...CARTAS_CHEFES[c.id].super }
    eventos.push({ tipo: 'superChefe' })
  } else {
    let anterior = null
    for (const j of alvos) {
      let carta = comprarDoChefe(estado)
      // duas curas na mesma rodada não: a segunda volta para o fundo do monte
      if (carta?.naipe === 'copas' && anterior?.naipe === 'copas') {
        c.monte.push(carta)
        carta = comprarDoChefe(estado)
      }
      c.intencoes[j] = carta
      anterior = carta
    }
  }
  estado.fase = 'escolha'
  return eventos
}

// ---------- jogadas ----------

const idDaJogada = (jogada) => (jogada == null ? null : typeof jogada === 'string' ? jogada : jogada.carta ?? null)

export function podeJogarCoop(estado, j, jogada) {
  const id = idDaJogada(jogada)
  if (id === null) return { ok: true, motivo: null }
  const jog = estado.jogadores[j]
  if (jog.caido) return { ok: false, motivo: 'caído' }
  const carta = cartaNaMao(jog.baralho, id)
  if (!carta) return { ok: false, motivo: 'carta não está na mão' }
  if (carta.custo > jog.energia) return { ok: false, motivo: `energia insuficiente (custa ${carta.custo}, tem ${jog.energia})` }
  return { ok: true, motivo: null }
}

export function cartasJogaveisCoop(estado, j) {
  const jog = estado.jogadores[j]
  if (jog.caido) return []
  return jog.baralho.mao.filter((c) => c.custo <= jog.energia)
}

function novoEfeito() {
  return { cura: 0, escudo: null, energia: 0, compradas: [], levantou: false, segundaChance: false, anulou: false, roubou: null, lento: false }
}

// Resolve a rodada com as duas jogadas reveladas (inválida -> erro, nada muda). Ordem:
//   1. paga a energia e descarta (quem passa ganha ENERGIA.passar)
//   2. ♥ e A♥: cura/escudo nos dois (cura levanta o parceiro caído), energia/compra em quem jogou
//   3. contra as intenções do chefe: SUPER varre a da própria caixa, A♠ reflete
//      a da própria caixa, A♦ anula a da própria caixa, A♣ rouba a do parceiro
//      (o SUPER do chefe é imparável)
//   4. ♥ do chefe que sobrou: ele se cura e levanta a guarda
//   5. caixas (com o escudo de quem recebe e a lentidão do ♦) e golpes
export function resolverRodadaCoop(estado, jogadaP1, jogadaP2) {
  if (estado.vencedor) throw new Error('a partida já acabou')
  const jogadas = [jogadaP1, jogadaP2]
  jogadas.forEach((jogada, j) => {
    const v = podeJogarCoop(estado, j, jogada)
    if (!v.ok) throw new Error(`jogada inválida do ${ID_JOGADOR[j]}: ${v.motivo}`)
  })
  const c = estado.chefe
  const eventos = []
  const efeitos = [novoEfeito(), novoEfeito()]

  // 1. paga e descarta
  const cartas = jogadas.map((jogada, j) => {
    const jog = estado.jogadores[j]
    const id = idDaJogada(jogada)
    if (id === null) {
      if (!jog.caido) {
        jog.energia = Math.min(ENERGIA.maxima, jog.energia + ENERGIA.passar)
        efeitos[j].energia += ENERGIA.passar
      }
      return null
    }
    const carta = descartar(jog.baralho, id)
    jog.energia -= carta.custo
    eventos.push(`${jog.id} jogou ${carta.nome}`)
    return carta
  })
  const especiais = cartas.map(especialDaCarta)

  // 2. suporte
  for (const j of [0, 1]) {
    const carta = cartas[j]
    if (!carta) continue
    const jog = estado.jogadores[j]
    if (especiais[j] === 'segundaChance') {
      for (const k of [0, 1]) {
        const alvo = estado.jogadores[k]
        const cura = Math.round(alvo.hpMax * COOP.segundaChance)
        if (alvo.caido) {
          efeitos[k].cura += levantar(estado, k, cura)
          efeitos[k].levantou = true
        } else efeitos[k].cura += curar(estado, k, cura)
        alvo.protegido = true
      }
      efeitos[j].segundaChance = true
      eventos.push(`${jog.id}: segunda chance para os dois`)
      continue
    }
    const sup = carta.naipe === 'copas' && !especiais[j] ? efeitosDaCarta(carta) : null
    if (!sup) continue
    if (sup.cura) {
      for (const k of [0, 1]) {
        const alvo = estado.jogadores[k]
        if (alvo.caido) {
          if (k === j) continue
          efeitos[k].cura += levantar(estado, k, Math.max(sup.cura, alvo.hpMax * COOP.reviverMin))
          efeitos[k].levantou = true
          eventos.push(`${jog.id} levantou ${alvo.id}`)
        } else efeitos[k].cura += curar(estado, k, sup.cura)
      }
    }
    if (sup.escudo) {
      for (const k of [0, 1]) {
        const alvo = estado.jogadores[k]
        if (alvo.caido) continue
        alvo.escudo = Math.min(alvo.escudo ?? 1, sup.escudo)
        efeitos[k].escudo = alvo.escudo
      }
    }
    if (sup.energia) {
      const antes = jog.energia
      jog.energia = Math.min(ENERGIA.maxima, jog.energia + sup.energia)
      efeitos[j].energia += jog.energia - antes
    }
    if (sup.compra) efeitos[j].compradas.push(...comprar(jog.baralho, sup.compra).map((x) => x.id))
  }

  // 3. contra as intenções do chefe
  const intencoes = [...c.intencoes]
  const destinos = intencoes.map((i) => (i ? 'caixa' : null)) // 'caixa' | 'varrida' | 'refletida' | 'anulada' | 'roubada'
  const livre = (k) => destinos[k] === 'caixa' && !ehSuper(intencoes[k])
  const golpes = [null, null]
  // SUPER dos jogadores primeiro (varre), depois Espelho, Anular e Roubo
  for (const j of [0, 1]) {
    if (!ehSuper(cartas[j])) continue
    if (livre(j)) destinos[j] = 'varrida'
    golpes[j] = { carta: cartas[j], tipo: 'super', base: COOP.superGolpe }
  }
  for (const j of [0, 1]) {
    if (especiais[j] !== 'espelho') continue
    if (livre(j)) {
      destinos[j] = 'refletida'
      golpes[j] = { carta: cartas[j], tipo: 'espelho', base: poderDaCartaChefe(intencoes[j], estado.fatorDano), refletida: intencoes[j] }
    } else golpes[j] = { carta: cartas[j], tipo: 'eco', base: GOLPE.espadas(ECO) }
  }
  for (const j of [0, 1]) {
    if (especiais[j] !== 'anular') continue
    if (livre(j)) destinos[j] = 'anulada'
    const antes = c.carga
    c.carga = Math.max(0, c.carga - COOP.anularCarga)
    efeitos[j].anulou = true
    if (antes !== c.carga) eventos.push(`a carga do SUPER do chefe caiu para ${c.carga}`)
  }
  for (const j of [0, 1]) {
    if (especiais[j] !== 'roubo') continue
    const alvo = livre(outro(j)) ? outro(j) : livre(j) ? j : null
    if (alvo !== null) destinos[alvo] = 'roubada'
    efeitos[j].roubou = alvo
    const jog = estado.jogadores[j]
    const antes = jog.energia
    jog.energia = Math.min(ENERGIA.maxima, jog.energia + COOP.rouboEnergia)
    efeitos[j].energia += jog.energia - antes
  }
  // golpes das cartas de ataque e a lentidão do ♦
  const lento = [false, false]
  for (const j of [0, 1]) {
    const carta = cartas[j]
    if (!carta || especiais[j] || ehSuper(carta) || !GOLPE[carta.naipe]) continue
    golpes[j] = { carta, tipo: carta.naipe, base: GOLPE[carta.naipe](carta.valor) }
    if (carta.naipe === 'ouros') {
      lento[j] = true
      if (carta.valor >= 12) lento[outro(j)] = true
      efeitos[j].lento = true
    }
  }

  // 4. ♥ do chefe que ficou na mesa
  let curaChefe = 0
  for (const k of [0, 1]) {
    if (destinos[k] !== 'caixa') continue
    const sup = suporteDoChefe(intencoes[k])
    if (!sup) continue
    const antes = c.hp
    c.hp = Math.min(c.hpMax, c.hp + sup.cura)
    curaChefe += c.hp - antes
    if (sup.guarda) c.guarda = Math.min(c.guarda ?? 1, sup.guarda)
  }

  // 5. caixas
  const caixas = [0, 1].map((j) => {
    if (destinos[j] !== 'caixa') return null
    const carta = intencoes[j]
    const jog = estado.jogadores[j]
    const ritmo = ritmoDaCartaChefe(carta)
    if (lento[j]) ritmo.velocidade = Math.round(ritmo.velocidade * COOP.lentidao * 100) / 100
    const caixa = { carta, dano: danoDaCartaChefe(carta, estado.fatorDano), ritmo, inverter: inverteControles(carta), escudo: null, lento: lento[j] }
    if (jog.escudo != null) {
      caixa.escudo = jog.escudo
      caixa.dano = Math.max(1, Math.ceil(caixa.dano * jog.escudo))
      jog.escudo = null
    }
    return caixa
  })

  // as cartas do chefe vão para o descarte dele (o SUPER não)
  for (const carta of intencoes) if (carta && !ehSuper(carta)) c.descarte.push(carta)
  c.intencoes = [null, null]
  estado.fase = 'esquiva'
  const resultado = {
    rodada: estado.rodada,
    jogadas: cartas.map((carta, j) => ({ carta, especial: especiais[j], passou: !carta, super: ehSuper(carta) })),
    intencoes,
    destinos,
    caixas,
    golpes,
    efeitos,
    chefe: { cura: curaChefe, guarda: c.guarda, carga: c.carga },
    eventos,
  }
  estado.historico.push({
    rodada: estado.rodada,
    cartas: cartas.map((x) => x?.id ?? null),
    chefe: intencoes.map((x) => x?.id ?? null),
    destinos,
  })
  return resultado
}

// ---------- esquiva ----------

// Um acerto no jogador j (o escudo já vem em caixa.dano). HP 0 = caiu (a não
// ser com a segunda chance). Devolve o dano efetivo.
export function aplicarDanoCoop(estado, j, dano) {
  const jog = estado.jogadores[j]
  if (jog.caido) return 0
  const efetivo = aplicarDano(estado, j, dano)
  if (jog.hp <= 0) derrubar(estado, j)
  return efetivo
}

// ---------- contra-ataque ----------

// Combo da rodada entre os dois golpes de carta comum: 'par' (mesmo valor),
// 'combo' (mesmo naipe) ou null
export function comboDosGolpes(golpes) {
  const [a, b] = golpes
  const comum = (g) => g && GOLPE[g.tipo]
  if (!comum(a) || !comum(b)) return null
  if (a.carta.valor === b.carta.valor) return 'par'
  if (a.carta.naipe === b.carta.naipe) return 'combo'
  return null
}

// Dano final de cada golpe (não muda o estado). desempenho[j] = { perfeito, grazes }.
// Quem está caído perde o golpe. Devolve [{ j, golpe, dano, falhou, multiplicadores: [[nome, fator]] }]
export function calcularGolpes(estado, golpes, desempenho = []) {
  const combo = comboDosGolpes(golpes.map((g, j) => (estado.jogadores[j].caido ? null : g)))
  const guarda = estado.chefe.guarda
  return [0, 1]
    .filter((j) => golpes[j])
    .map((j) => {
      const golpe = golpes[j]
      if (estado.jogadores[j].caido) return { j, golpe, dano: 0, falhou: true, multiplicadores: [] }
      const d = desempenho[j] ?? {}
      const mult = []
      if (d.perfeito) mult.push(['CRÍTICO', COOP.critico])
      if (golpe.tipo === 'paus' && d.grazes) mult.push([`+${d.grazes} GRAZE`, 1 + Math.min(COOP.grazeArmadilhaMax, d.grazes * COOP.grazeArmadilha)])
      if (combo === 'par' && GOLPE[golpe.tipo]) mult.push(['PAR', COOP.par])
      if (combo === 'combo' && GOLPE[golpe.tipo]) mult.push(['COMBO', COOP.combo])
      if (guarda != null) mult.push(['GUARDA', guarda])
      const fator = mult.reduce((m, [, f]) => m * f, 1)
      return { j, golpe, dano: Math.max(1, Math.round(golpe.base * fator)), falhou: false, multiplicadores: mult }
    })
}

// Tira o dano do HP do chefe. Devolve o dano efetivo.
export function aplicarGolpe(estado, dano) {
  const c = estado.chefe
  const antes = c.hp
  c.hp = Math.max(0, c.hp - Math.max(0, dano))
  return antes - c.hp
}

// ---------- fim da rodada ----------

// Tira a proteção e a guarda, troca a fase do chefe (o baralho dele passa a
// ser o da fase nova) e vê se a luta acabou
export function fimDaRodadaCoop(estado) {
  const c = estado.chefe
  for (const jog of estado.jogadores) jog.protegido = false
  c.guarda = null
  let novaFase = null
  if (c.hp > 0) {
    const f = faseDoChefe(c.id, c.hp / c.hpMax)
    if (f > c.fase) {
      c.fase = f
      novaFase = f
      c.monte = embaralhar(CARTAS_CHEFES[c.id].fases[f].map((x) => ({ ...x })), estado.rng)
      c.descarte = []
    }
  }
  let vencedor = null
  if (c.hp <= 0) vencedor = 'vitoria'
  else if (estado.jogadores.every((jog) => jog.caido)) vencedor = 'derrota'
  estado.vencedor = vencedor
  estado.fase = vencedor ? 'fim' : 'inicio'
  return { vencedor, novaFase }
}
