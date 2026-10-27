// Regras do CO-OP de cartas: os dois jogadores (ou jogador + CPU aliada)
// contra um chefe que também joga cartas. Lógica pura (sem Phaser), testável
// em Node. Ver docs/coop-cartas.md.
//
// Mesma base do PvP (pvp/regras.js e pvp/baralho.js): energia, mãos, custos,
// grazes, desvio perfeito. O estado tem o mesmo formato do PvP em
// `jogadores` (as funções de energia do PvP valem aqui) e mais o `chefe`.
//
// QUADRO ÚNICO: o chefe joga UMA carta por rodada (a intenção, com o naipe à
// vista) e o ataque dela roda num quadro só, no meio da mesa, com os dois
// corações dentro: os dois desviam do MESMO ataque. O que mexe na carta do
// chefe (SUPER, A♠, A♦, A♣, a lentidão do ♦) vale para os dois; escudo, dano,
// grazes, desvio perfeito, combo de perfeitos e CRÍTICO continuam POR JOGADOR.
// Quem está caído quando o chefe mostra a carta fica fora do quadro.
//
//   const estado = criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'king', nivel: 'facil', semente })
//   iniciarRodadaCoop(estado)          energia, mãos, quem caiu volta, o chefe mostra a intenção
//   podeJogarCoop(estado, j, id)       { ok, motivo }
//   motivoBloqueioCoop(estado, j, id)  null ou { codigo, motivo, curto } (por que não pode; usado pela tela)
//   const r = resolverRodadaCoop(estado, jogadaP1, jogadaP2)
//     r.destino     o que aconteceu com a carta do chefe: 'quadro' | 'varrida' |
//                   'refletida' | 'anulada' | 'roubada' (null: o chefe não jogou)
//     r.quadro      o ataque que os dois desviam: { carta (do chefe), dano, danos[j],
//                   escudos[j], jogadores[j], ritmo, inverter, lento } ou null
//                   (danos[j] = o dano por acerto em j, já com o escudo dele;
//                   jogadores[j] = j está no quadro)
//     r.golpes[j]   o contra-ataque do jogador j: { carta, tipo, base } ou null
//   ... esquiva: aplicarDanoCoop(estado, j, r.quadro.danos[j]) a cada acerto (HP 0 = caiu),
//       registrarGrazes / registrarPerfeitoCombo do PvP (reexportados aqui)
//       COMBO DE PERFEITOS igual ao PvP: rodadas seguidas com desvio perfeito
//       multiplicam a ENERGIA do perfeito (x1, x2, x3, x4 = COMBO_PERFEITO.teto);
//       todo acerto (aplicarDanoCoop) zera. O CRÍTICO do contra-ataque continua
//       x1,5 fixo: o combo não mexe no golpe
//   const lista = calcularGolpes(estado, r.golpes, desempenho)   desempenho[j] = { perfeito, grazes }
//   lista.forEach((g) => aplicarGolpe(estado, g.dano))
//   fimDaRodadaCoop(estado)            -> { vencedor: 'vitoria' | 'derrota' | null, novaFase }
//
// GRUPOS DE 3 E 4 (Fase 5B, só online: docs/coop-cartas.md "CO-OP de 3 e 4"): o estado
// ganha `n` jogadores (p1..p4) e tudo acima vale para N (`resolverRodadaCoop(estado,
// ...jogadas)` aceita uma jogada por jogador). Com 2 jogadores nada muda. O que o grupo
// acrescenta (regras puras, testadas em __tests__/grupoN.test.js):
//   GRUPO[n]              botões de equilíbrio por tamanho (vida do chefe, densidade e espaço
//                         do quadro, quantos aliados o ♥ alcança); a 5C ajusta
//   escolherMira(estado)  RODÍZIO DE MIRA: com 3 ou mais de pé, o chefe mira em metade deles
//                         (arredondada para cima), os que levaram mira há MAIS tempo; os tiros
//                         mirados (a.alvo()) só vão para esses (estado.chefe.mira, quadro.mira)
//   resgate               RODADA LIMPA: ninguém no quadro levou acerto -> o caído há mais tempo
//                         volta (retornoHp) já no fim da rodada (fimDaRodadaCoop devolve
//                         `resgatados`). O ♥ também levanta (como no CO-OP de 2) e a volta
//                         sozinha continua
//   definirPresenca       quem caiu da rede (`ausente`: não joga, fora do quadro, sem mira) e quem
//                         saiu de vez (`saiu`); a luta segue com os outros
//   combos                COMBO (mesmo naipe) e PAR (mesmo valor) valem para quem combina com
//                         QUALQUER outro; cada jogador a mais no grupo soma +0,10 ao fator;
//                         SUPER COMBO com 2+ SUPER (3 SUPER: teto +25%, 4: +50%)

import { NIVEIS } from '../constants.js'
import { criarBaralho, completarMao, comprar, descartar, cartaNaMao, criarRng, embaralhar, MAO } from '../pvp/baralho.js'
import { ENERGIA, hpInicial, aplicarDano, curar, motivoBloqueio } from '../pvp/regras.js'

// o combo de perfeitos é o mesmo do PvP (mesmo formato de jogadores)
export { COMBO_PERFEITO, multiplicadorPerfeito, registrarPerfeitoCombo, quebrarSequencia } from '../pvp/regras.js'
import { especialDaCarta, efeitosDaCarta, ehSuper } from '../pvp/cartas.js'
import { CHEFES, nivelDoChefe } from './chefes/index.js'
import { CARTAS_CHEFES, faseDoChefe, suporteDoChefe, danoDaCartaChefe, ritmoDaCartaChefe, inverteControles, poderDaCartaChefe } from './cartasChefe.js'


// Números do CO-OP
//   retornoRodadas   quem cai fica de fora tantas rodadas e volta sozinho com retornoHp do HP máx
//   reviverMin       cura de copas que levanta o parceiro: pelo menos esta fração do HP máx dele
//   critico          desvio perfeito multiplica o contra-ataque
//   combo / par      os dois atacam com o mesmo naipe / o mesmo valor
//   grazeArmadilha   ♣: cada graze na esquiva soma esta fração ao golpe (até grazeArmadilhaMax)
//   lentidao         ♦: fator da velocidade das balas do ataque do chefe (o quadro é
//                    dos dois: vale para os dois); ♦ Q/K: lentidaoForte. Não soma: vale o
//                    ♦ mais forte da rodada
//   superGolpe       dano base do SUPER de um jogador: esta fração do HP máximo do
//                    chefe (o HP já vem com o nível), nunca menos que superPiso
//   custoSuper       energia do SUPER no CO-OP (no PvP custa 10)
//   superCombo       os dois jogam SUPER na mesma rodada (SUPER COMBO): juntos tiram esta
//                    fração do HP máximo, por nível (metade em cada SUPER). É também o
//                    TETO do SUPER da rodada (um ou os dois, com CRÍTICO e tudo)
//   superFinaliza    o SUPER só mata o chefe que começou o golpe com até esta fração do
//                    HP máximo; acima disso ele aguenta com pelo menos superSobra. E nunca
//                    pula uma fase inteira do chefe (avança no máximo uma). Ver limiteDoSuper
//   cargaSuper       o SUPER do chefe sai a cada tantas rodadas (a carga sobe 1 por rodada)
//   danoQuadro       multiplica o dano por acerto do ataque do chefe no quadro: lá o A♠,
//                    o A♦, o A♣ e o SUPER de qualquer um dos dois tiram o ataque dos DOIS
//                    (antes cada um protegia só uma caixa); o acerto dói um pouco mais
//                    para a luta continuar com o mesmo perigo (scripts/balanceamento/)
//   curaChefe        multiplica a cura das cartas ♥ do chefe: ele joga UMA carta por
//                    rodada (antes eram duas), então cura com a metade da frequência;
//                    curando o dobro, a cura dele por rodada continua a mesma de antes
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
  lentidaoForte: 0.75,
  superGolpe: 0.33,
  superPiso: 60,
  custoSuper: 8,
  superCombo: { facil: 0.4, medio: 0.45, dificil: 0.5 },
  superFinaliza: 0.5,
  superSobra: 0.1,
  cargaSuper: 10,
  curaChefe: 2,
  danoQuadro: 1.1,
  rouboEnergia: 2,
  anularCarga: 2,
  segundaChance: 0.25,
  comboGrupo: 0.1, // 3+ jogadores no mesmo COMBO/PAR: soma isto ao fator por jogador a mais
  superComboGrupo: 0.25, // 3+ SUPER na mesma rodada: soma isto ao teto do SUPER COMBO por SUPER a mais
}

// Equilíbrio por tamanho do grupo (online, 5B; a 5C mede e ajusta). Mais corações no quadro
// = mais lugares para uma bala acertar, então o chefe aperta em TRÊS frentes, não só na vida:
//   hpChefe      multiplica a vida do chefe (cada jogador a mais bate nele)
//   densidade    multiplica a densidade das balas do quadro (QUADRO.ritmo)
//   espaco       multiplica a largura/altura do quadro (coop/quadro.js, até o campo dele)
//   apoioAliados quantos ALIADOS um ♥ alcança além de quem jogou (2 jogadores: o outro)
//   miraPorRodada fração dos jogadores de pé que o chefe mira por rodada (rodízio)
export const GRUPO = {
  2: { hpChefe: 1, densidade: 1, espaco: { largura: 1, altura: 1 }, apoioAliados: 1, miraPorRodada: 1 },
  3: { hpChefe: 1.35, densidade: 1.15, espaco: { largura: 1.15, altura: 1.04 }, apoioAliados: 2, miraPorRodada: 0.5 },
  4: { hpChefe: 1.7, densidade: 1.3, espaco: { largura: 1.3, altura: 1.08 }, apoioAliados: 2, miraPorRodada: 0.5 },
}
export const MAX_GRUPO = 4
export const grupoDe = (n) => GRUPO[Math.min(MAX_GRUPO, Math.max(2, n))]

// Dano base do contra-ataque de cada naipe, pelo valor da carta
export const GOLPE = {
  espadas: (v) => Math.round(8 + 3.2 * v), // 2 -> 14, 9 -> 37, K -> 50
  ouros: (v) => Math.round(5 + 2.2 * v), // 2 -> 9, K -> 34
  paus: (v) => Math.round(6 + 2.5 * v), // 2 -> 11, K -> 39 (+ grazes)
}
const ECO = 7 // Espelho sem nada para refletir: golpe de um 7♠

// Fator da velocidade das balas que um ♦ de valor v põe no ataque do chefe
export const lentidaoDoOuros = (v) => (v >= 12 ? COOP.lentidaoForte : COOP.lentidao)

// Dano por acerto com o escudo (fração do dano; null = sem escudo), nunca menos que 1
export function danoComEscudo(dano, escudo) {
  return escudo == null ? dano : Math.max(1, Math.ceil(dano * escudo))
}

const pct = (f) => `${Math.round(f * 100)}%`

// Texto da carta no CO-OP (a prévia ampliada mostra este no lugar do texto do PvP).
// luta = { hpMax, nivel, grupo? } do chefe: o SUPER mostra o dano de verdade nesta luta
// (sem ela, como no Guia, mostra as frações do HP); `grupo` (GRUPO[n], 3 e 4 jogadores) troca
// "o parceiro" por "os aliados" nos textos de suporte
export function descricaoCoop(carta, luta = null) {
  if (ehSuper(carta)) {
    const fim = `Com mais da metade do HP, o chefe aguenta.`
    if (!luta) {
      const combos = Object.values(COOP.superCombo)
      return `SUPER: golpe de ${pct(COOP.superGolpe)} do HP do chefe e varre o ataque dele do quadro, para os dois (não o SUPER dele). Os dois na mesma rodada: SUPER COMBO de ${pct(Math.min(...combos))} a ${pct(Math.max(...combos))} (pelo nível)! ${fim}`
    }
    const combo = Math.round(luta.hpMax * fracaoDoCombo(luta.nivel))
    return `SUPER: golpe de ${danoDoSuper(luta)} (${pct(COOP.superGolpe)} do HP do chefe) e varre o ataque dele do quadro, para os dois (não o SUPER dele). Os dois na mesma rodada: SUPER COMBO de ${combo} (${pct(fracaoDoCombo(luta.nivel))})! ${fim}`
  }
  const especial = especialDaCarta(carta)
  if (especial === 'espelho') return `ESPECIAL: o ataque do chefe volta e acerta ele (ninguém desvia). Sem nada para refletir (ou contra o SUPER dele), golpe de ${GOLPE.espadas(ECO)}.`
  if (especial === 'anular') return `ESPECIAL: cancela o ataque do chefe (ninguém desvia) e tira ${COOP.anularCarga} da carga do SUPER dele.`
  if (especial === 'roubo') return `ESPECIAL: rouba o ataque do chefe (ninguém desvia) e você ganha +${COOP.rouboEnergia} de energia.`
  const grupo = luta?.grupo ?? null
  if (especial === 'segundaChance') return grupo ? `ESPECIAL: TODOS curam ${pct(COOP.segundaChance)} do HP máximo e ninguém cai nesta rodada. Levanta os caídos.` : `ESPECIAL: VOCÊ E O PARCEIRO curam ${pct(COOP.segundaChance)} do HP máximo e ninguém cai nesta rodada. Levanta o parceiro caído.`
  const v = carta.valor
  if (carta.naipe === 'espadas') return `Contra-ataque: golpe de ${GOLPE.espadas(v)} no chefe depois da esquiva (CRÍTICO x${COOP.critico} se você não levar dano).`
  if (carta.naipe === 'ouros') return `Contra-ataque: golpe de ${GOLPE.ouros(v)} e o ataque do chefe fica ${pct(1 - lentidaoDoOuros(v))} mais lento para os dois.`
  if (carta.naipe === 'paus') return `Armadilha: golpe de ${GOLPE.paus(v)} no chefe, +${pct(COOP.grazeArmadilha)} a cada graze na esquiva (até +${pct(COOP.grazeArmadilhaMax)}).`
  const ef = efeitosDaCarta(carta) ?? {}
  const partes = []
  const quem = grupo ? `VOCÊ E ${grupo.apoioAliados} ALIADOS (os caídos primeiro, depois os mais feridos)` : 'VOCÊ E NO PARCEIRO'
  if (ef.cura) partes.push(`cura ${ef.cura} HP em ${quem}${grupo ? '; levanta o caído' : ' (levanta o parceiro caído)'}`)
  if (ef.escudo) partes.push(`escudo ${grupo ? 'neles' : 'nos DOIS'}: o próximo ataque causa ${pct(ef.escudo)} do dano`)
  if (ef.energia) partes.push(`+${ef.energia} de energia para você`)
  if (ef.compra) partes.push(`você compra ${ef.compra} carta${ef.compra > 1 ? 's' : ''}`)
  return `Suporte: ${partes.join('; ')}.`
}

const ID_JOGADOR = ['p1', 'p2', 'p3', 'p4']

// ---------- partida ----------

export function criarPartidaCoop({ party, chefe, nivel = 'facil', semente = 'coop' }) {
  const def = CHEFES[chefe]
  if (!def) throw new Error(`chefe sem baralho de cartas: ${chefe}`)
  const niv = nivelDoChefe(chefe, nivel)
  const rng = criarRng(`${semente}:coop`)
  // 2 jogadores (ou 1 + CPU aliada) é o CO-OP de sempre; 3 e 4 são do online (5B)
  const n = Math.min(MAX_GRUPO, Math.max(2, party.length))
  const grupo = n > 2 ? grupoDe(n) : null
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
      sequencia: 0, // combo de perfeitos (pvp/regras.js: registrarPerfeitoCombo)
      maiorSequencia: 0,
      baralho: criarBaralho(personagem, `${semente}:${ID_JOGADOR[j]}`),
    }
  }
  const hpChefe = Math.round(def.hp * niv.hp * (grupo?.hpChefe ?? 1))
  const nivelDaLuta = NIVEIS[nivel] ? nivel : 'facil'
  const comTextoCoop = (jog) => {
    for (const carta of jog.baralho.monte) {
      if (ehSuper(carta)) carta.custo = COOP.custoSuper
      carta.descricao = descricaoCoop(carta, { hpMax: hpChefe, nivel: nivelDaLuta, grupo })
    }
    return jog
  }
  return {
    modo: 'coop',
    semente: String(semente),
    nivel: nivelDaLuta,
    fatorDano: niv.dano,
    rodada: 0,
    fase: 'inicio',
    rng,
    n,
    grupo, // os botões de equilíbrio do tamanho (GRUPO; null com 2 jogadores)
    jogadores: Array.from({ length: n }, (_, j) => comTextoCoop(jogador(party[j] ?? party[0], j))),
    chefe: {
      id: chefe,
      hp: hpChefe,
      hpMax: hpChefe,
      fase: 0,
      guarda: null, // fator do dano do próximo contra-ataque (♥ do chefe)
      carga: 0, // carga do SUPER: cheia a cada COOP.cargaSuper rodadas
      cargaMax: COOP.cargaSuper,
      monte: embaralhar(CARTAS_CHEFES[chefe].fases[0].map((c) => ({ ...c })), rng),
      descarte: [],
      intencao: null, // a carta virada que o chefe vai jogar nesta rodada (no quadro, nos dois)
      mira: null, // (3+ jogadores) quem o chefe mira nesta rodada: índices dos jogadores (escolherMira)
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
  jog.sequencia = 0 // caiu: o combo de perfeitos acaba
  jog.voltaEm = estado.rodada + COOP.retornoRodadas + 1
}

// quem está fora da luta (grupo de 3+): caiu da rede (ausente, volta em até 20 s) ou saiu de vez
const fora = (jog) => Boolean(jog.ausente || jog.saiu)
// os índices dos jogadores (0..n-1)
const indices = (estado) => estado.jogadores.map((_, j) => j)
const emPe = (estado) => indices(estado).filter((j) => !estado.jogadores[j].caido && !fora(estado.jogadores[j]))

// Quem caiu da rede / saiu de vez (grupo de 3+, definido pelo host a cada rodada): fora do
// quadro, sem mira, sem jogar carta; a luta segue com os outros. saiu não volta
export function definirPresenca(estado, { ausentes = [], saiu = [] } = {}) {
  estado.jogadores.forEach((jog, j) => {
    jog.ausente = ausentes.includes(j)
    if (saiu.includes(j)) jog.saiu = true
  })
}

// RODÍZIO DE MIRA (3+ de pé): o chefe mira em `miraPorRodada` dos que estão de pé (metade,
// arredondada para cima), os que levaram mira há MAIS tempo (empate: o mirado menos vezes, depois
// o de menor vaga). Os tiros
// mirados (a.alvo()) só vão para eles; o resto do ataque (áreas, paredes) é para todos. Com 2 ou
// menos de pé, todos. Devolve os índices em ordem e anota a rodada em `ultimaMira`
export function escolherMira(estado) {
  const vivos = emPe(estado)
  if (vivos.length <= 2) return vivos
  const k = Math.max(1, Math.ceil(vivos.length * (estado.grupo?.miraPorRodada ?? 0.5)))
  const jog = (j) => estado.jogadores[j]
  const ordem = [...vivos].sort((a, b) => (jog(a).ultimaMira ?? 0) - (jog(b).ultimaMira ?? 0) || (jog(a).miras ?? 0) - (jog(b).miras ?? 0) || a - b)
  const alvos = ordem.slice(0, k).sort((a, b) => a - b)
  for (const j of alvos) {
    jog(j).ultimaMira = estado.rodada
    jog(j).miras = (jog(j).miras ?? 0) + 1 // desempate: quem foi mirado menos vezes (3 de pé: o P1 não fica sempre com a mira)
  }
  return alvos
}

// Começo da rodada: quem caiu há tempo suficiente volta, energia e mãos (como
// no PvP), a carga do SUPER do chefe sobe e ele escolhe UMA carta para a
// rodada (a intenção: o ataque dela vai no quadro, nos dois). Carga cheia: a
// carta é o SUPER dele. Devolve os eventos ({ tipo, j? }).
export function iniciarRodadaCoop(estado) {
  if (estado.vencedor) return []
  estado.rodada++
  const eventos = []
  estado.jogadores.forEach((jog, j) => {
    if (jog.caido && !jog.saiu && estado.rodada >= jog.voltaEm) {
      levantar(estado, j, jog.hpMax * COOP.retornoHp)
      eventos.push({ tipo: 'voltou', j })
    }
    jog.energia = estado.rodada === 1 ? ENERGIA.inicial : Math.min(ENERGIA.maxima, jog.energia + ENERGIA.porRodada)
    jog.protegido = false
    completarMao(jog.baralho, MAO.tamanho)
  })

  const c = estado.chefe
  c.intencao = null
  c.mira = null
  c.carga = Math.min(c.cargaMax, c.carga + 1)
  if (emPe(estado).length) {
    if (c.carga >= c.cargaMax) {
      c.carga = 0
      c.intencao = { ...CARTAS_CHEFES[c.id].super }
      eventos.push({ tipo: 'superChefe' })
    } else c.intencao = comprarDoChefe(estado)
    if (estado.n > 2) c.mira = escolherMira(estado)
  }
  estado.fase = 'escolha'
  return eventos
}

// ---------- jogadas ----------

const idDaJogada = (jogada) => (jogada == null ? null : typeof jogada === 'string' ? jogada : jogada.carta ?? null)

// Mesmo contrato de pvp/regras.js motivoBloqueio, com o "caído" do CO-OP na frente
export function motivoBloqueioCoop(estado, j, carta) {
  if (estado.jogadores[j].caido) return { codigo: 'caido', motivo: 'caído', curto: 'caído: não joga carta' }
  if (fora(estado.jogadores[j])) return { codigo: 'ausente', motivo: 'fora da luta', curto: 'sem conexão: não joga carta' }
  return motivoBloqueio(estado, j, carta)
}

export function podeJogarCoop(estado, j, jogada) {
  const id = idDaJogada(jogada)
  if (id === null) return { ok: true, motivo: null }
  const bloqueio = motivoBloqueioCoop(estado, j, id)
  return bloqueio ? { ok: false, motivo: bloqueio.motivo, bloqueio } : { ok: true, motivo: null }
}

function novoEfeito() {
  return { cura: 0, escudo: null, energia: 0, compradas: [], levantou: false, segundaChance: false, anulou: false, roubou: false, lento: false }
}

// Resolve a rodada com as duas jogadas reveladas (inválida -> erro, nada muda). Ordem:
//   1. paga a energia e descarta (quem passa ganha ENERGIA.passar)
//   2. ♥ e A♥: cura/escudo nos dois (cura levanta o parceiro caído), energia/compra em quem jogou
//   3. contra a carta do chefe (a do quadro, que é dos dois): o SUPER de um
//      jogador varre, A♠ reflete, A♦ anula, A♣ rouba; vale o primeiro, nessa
//      ordem (o 2º A♠ vira o eco, o 2º A♦ ainda tira carga, o 2º A♣ ainda dá
//      energia). O SUPER do chefe é imparável
//   4. ♥ do chefe que ficou: ele se cura e levanta a guarda
//   5. o quadro (dano de cada um com o próprio escudo; a lentidão do ♦ mais
//      forte) e os golpes
// Fica no quadro quem estava de pé quando o chefe mostrou a carta: quem
// levanta agora (cura, A♥) volta à mesa e entra na próxima.
export function resolverRodadaCoop(estado, ...entradas) {
  if (estado.vencedor) throw new Error('a partida já acabou')
  const todos = indices(estado)
  const jogadas = todos.map((j) => entradas[j])
  jogadas.forEach((jogada, j) => {
    const v = podeJogarCoop(estado, j, jogada)
    if (!v.ok) throw new Error(`jogada inválida do ${ID_JOGADOR[j]}: ${v.motivo}`)
  })
  const c = estado.chefe
  const eventos = []
  const efeitos = todos.map(() => novoEfeito())
  // no quadro: quem estava de pé quando o chefe mostrou a carta (antes das curas desta rodada)
  const noQuadro = estado.jogadores.map((jog) => !jog.caido && !fora(jog))

  // 1. paga e descarta
  const cartas = jogadas.map((jogada, j) => {
    const jog = estado.jogadores[j]
    const id = idDaJogada(jogada)
    if (id === null) {
      if (!jog.caido && !fora(jog)) {
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

  // 2. suporte. Com 2 jogadores o ♥ vale para os dois; num grupo de 3+ alcança quem jogou e
  // até GRUPO[n].apoioAliados aliados (primeiro os caídos, o que caiu há mais tempo; depois o
  // de menor fração de HP). O A♥ vale para todos
  const destinosDoApoio = (j) => {
    if (!estado.grupo) return todos
    const aliados = todos
      .filter((k) => k !== j && !fora(estado.jogadores[k]))
      .sort((x, y) => {
        const a = estado.jogadores[x]
        const b = estado.jogadores[y]
        if (a.caido !== b.caido) return a.caido ? -1 : 1
        if (a.caido) return (a.voltaEm ?? 0) - (b.voltaEm ?? 0) || x - y
        return a.hp / a.hpMax - b.hp / b.hpMax || x - y
      })
      .slice(0, estado.grupo.apoioAliados)
    return [j, ...aliados].sort((x, y) => x - y)
  }
  for (const j of todos) {
    const carta = cartas[j]
    if (!carta) continue
    const jog = estado.jogadores[j]
    if (especiais[j] === 'segundaChance') {
      for (const k of todos) {
        const alvo = estado.jogadores[k]
        if (fora(alvo)) continue
        const cura = Math.round(alvo.hpMax * COOP.segundaChance)
        if (alvo.caido) {
          efeitos[k].cura += levantar(estado, k, cura)
          efeitos[k].levantou = true
        } else efeitos[k].cura += curar(estado, k, cura)
        alvo.protegido = true
      }
      efeitos[j].segundaChance = true
      eventos.push(`${jog.id}: segunda chance para ${estado.grupo ? 'todos' : 'os dois'}`)
      continue
    }
    const sup = carta.naipe === 'copas' && !especiais[j] ? efeitosDaCarta(carta) : null
    if (!sup) continue
    const destinos = destinosDoApoio(j)
    if (sup.cura) {
      for (const k of destinos) {
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
      for (const k of destinos) {
        const alvo = estado.jogadores[k]
        if (alvo.caido) continue
        alvo.escudo = Math.min(alvo.escudo ?? 1, sup.escudo)
        efeitos[k].escudo = alvo.escudo
      }
    }
    if (estado.grupo) efeitos[j].apoio = destinos.filter((k) => k !== j) // os aliados que o ♥ alcançou
    if (sup.energia) {
      const antes = jog.energia
      jog.energia = Math.min(ENERGIA.maxima, jog.energia + sup.energia)
      efeitos[j].energia += jog.energia - antes
    }
    if (sup.compra) efeitos[j].compradas.push(...comprar(jog.baralho, sup.compra).map((x) => x.id))
  }

  // 3. contra a carta do chefe (o SUPER dos jogadores primeiro, depois Espelho, Anular e Roubo)
  const intencao = c.intencao
  let destino = intencao ? 'quadro' : null // 'quadro' | 'varrida' | 'refletida' | 'anulada' | 'roubada'
  const livre = () => destino === 'quadro' && !ehSuper(intencao)
  const golpes = todos.map(() => null)
  for (const j of todos) {
    if (!ehSuper(cartas[j])) continue
    if (livre()) destino = 'varrida'
    golpes[j] = { carta: cartas[j], tipo: 'super', base: danoDoSuper(c) }
  }
  for (const j of todos) {
    if (especiais[j] !== 'espelho') continue
    if (livre()) {
      destino = 'refletida'
      golpes[j] = { carta: cartas[j], tipo: 'espelho', base: poderDaCartaChefe(intencao, estado.fatorDano), refletida: intencao }
    } else golpes[j] = { carta: cartas[j], tipo: 'eco', base: GOLPE.espadas(ECO) }
  }
  for (const j of todos) {
    if (especiais[j] !== 'anular') continue
    if (livre()) destino = 'anulada'
    const antes = c.carga
    c.carga = Math.max(0, c.carga - COOP.anularCarga)
    efeitos[j].anulou = true
    if (antes !== c.carga) eventos.push(`a carga do SUPER do chefe caiu para ${c.carga}`)
  }
  for (const j of todos) {
    if (especiais[j] !== 'roubo') continue
    if (livre()) {
      destino = 'roubada'
      efeitos[j].roubou = true
    }
    const jog = estado.jogadores[j]
    const antes = jog.energia
    jog.energia = Math.min(ENERGIA.maxima, jog.energia + COOP.rouboEnergia)
    efeitos[j].energia += jog.energia - antes
  }
  // golpes das cartas de ataque e a lentidão do ♦ (o ataque é dos dois: vale o ♦ mais forte)
  let lentidao = 1
  for (const j of todos) {
    const carta = cartas[j]
    if (!carta || especiais[j] || ehSuper(carta) || !GOLPE[carta.naipe]) continue
    golpes[j] = { carta, tipo: carta.naipe, base: GOLPE[carta.naipe](carta.valor) }
    if (carta.naipe === 'ouros') {
      lentidao = Math.min(lentidao, lentidaoDoOuros(carta.valor))
      efeitos[j].lento = true
    }
  }

  // 4. ♥ do chefe que ficou na mesa
  let curaChefe = 0
  if (destino === 'quadro') {
    const sup = suporteDoChefe(intencao)
    if (sup) {
      const antes = c.hp
      c.hp = Math.min(c.hpMax, c.hp + Math.round(sup.cura * COOP.curaChefe))
      curaChefe = c.hp - antes
      if (sup.guarda) c.guarda = Math.min(c.guarda ?? 1, sup.guarda)
    }
  }

  // 5. o quadro: o mesmo ataque para todos; o dano por acerto de cada um sai com o escudo dele
  let quadro = null
  if (destino === 'quadro' && noQuadro.some(Boolean)) {
    const ritmo = ritmoDaCartaChefe(intencao)
    if (lentidao < 1) ritmo.velocidade = Math.round(ritmo.velocidade * lentidao * 100) / 100
    const dano = danoDaCartaChefe(intencao, estado.fatorDano * COOP.danoQuadro)
    const escudos = todos.map(() => null)
    const danos = todos.map((j) => {
      if (!noQuadro[j]) return null
      const jog = estado.jogadores[j]
      escudos[j] = jog.escudo ?? null
      jog.escudo = null // o escudo vale para este ataque inteiro e acaba
      return danoComEscudo(dano, escudos[j])
    })
    quadro = { carta: intencao, dano, danos, escudos, jogadores: noQuadro, ritmo, inverter: inverteControles(intencao), lento: lentidao < 1 }
    // a mira do rodízio (3+): só entra quem de fato está no quadro; sem ela, todos
    if (estado.n > 2) quadro.mira = (c.mira ?? []).filter((j) => noQuadro[j])
  }

  // a carta do chefe vai para o descarte dele (o SUPER não)
  if (intencao && !ehSuper(intencao)) c.descarte.push(intencao)
  c.intencao = null
  estado.fase = 'esquiva'
  const resultado = {
    rodada: estado.rodada,
    jogadas: cartas.map((carta, j) => ({ carta, especial: especiais[j], passou: !carta, super: ehSuper(carta) })),
    intencao,
    destino,
    quadro,
    golpes,
    efeitos,
    chefe: { cura: curaChefe, guarda: c.guarda, carga: c.carga },
    eventos,
  }
  estado.historico.push({ rodada: estado.rodada, cartas: cartas.map((x) => x?.id ?? null), chefe: intencao?.id ?? null, destino })
  return resultado
}

// ---------- esquiva ----------

// Um acerto no jogador j (o escudo já vem em quadro.danos[j]). HP 0 = caiu (a não
// ser com a segunda chance). Devolve o dano efetivo.
export function aplicarDanoCoop(estado, j, dano) {
  const jog = estado.jogadores[j]
  if (jog.caido) return 0
  const efetivo = aplicarDano(estado, j, dano)
  if (jog.hp <= 0) derrubar(estado, j)
  return efetivo
}

// ---------- contra-ataque ----------

// O que cada golpe combina com os outros da rodada (só os de quem está de pé):
// [{ tipo: 'par' | 'combo', grupo }] por jogador (null = sem combo). 'par' = mesmo valor que
// outro golpe comum, 'combo' = mesmo naipe; `grupo` = quantos jogadores combinam entre si
// (2 = o combo de sempre; cada um a mais soma COOP.comboGrupo ao fator). Os SUPER têm o
// SUPER COMBO (`supersDaRodada`)
export function combosDosGolpes(golpes, caidos = []) {
  const comum = (g, j) => g && GOLPE[g.tipo] && !caidos[j]
  return golpes.map((g, j) => {
    if (!comum(g, j)) return null
    const outros = golpes.filter((h, k) => k !== j && comum(h, k))
    const par = outros.filter((h) => h.carta.valor === g.carta.valor).length
    if (par) return { tipo: 'par', grupo: par + 1 }
    const naipe = outros.filter((h) => h.carta.naipe === g.carta.naipe).length
    return naipe ? { tipo: 'combo', grupo: naipe + 1 } : null
  })
}

// os golpes de SUPER de quem está de pé (2 ou mais = SUPER COMBO)
const supersDaRodada = (golpes, caidos = []) => golpes.filter((g, j) => g?.tipo === 'super' && !caidos[j])

// Combo da rodada (o rótulo do banner): 'super' (2 ou mais SUPER), 'par' (cartas comuns de mesmo
// valor), 'combo' (mesmo naipe) ou null. `caidos[j]`: o golpe de j não conta
export function comboDosGolpes(golpes, caidos = []) {
  if (supersDaRodada(golpes, caidos).length >= 2) return 'super'
  const lista = combosDosGolpes(golpes, caidos).filter(Boolean)
  if (lista.some((x) => x.tipo === 'par')) return 'par'
  return lista.length ? 'combo' : null
}

// Dano base do SUPER de um jogador contra este chefe: COOP.superGolpe do HP
// máximo (o HP já vem com o nível), nunca menos que COOP.superPiso
export function danoDoSuper(chefe) {
  return Math.max(COOP.superPiso, Math.round(chefe.hpMax * COOP.superGolpe))
}

// Fração do HP máximo que o SUPER COMBO tira neste nível (e o teto de qualquer SUPER). Com 3 ou 4
// SUPER na rodada (grupo de 3+) o teto sobe COOP.superComboGrupo por SUPER a mais
export const fracaoDoCombo = (nivel, supers = 2) => (COOP.superCombo[nivel] ?? COOP.superCombo.facil) * (1 + COOP.superComboGrupo * (Math.max(2, supers) - 2))

// Dano base de CADA SUPER no SUPER COMBO: o combo dividido entre os SUPER (metade, com 2)
export function danoNoCombo(estado, supers = 2) {
  return Math.round((estado.chefe.hpMax * fracaoDoCombo(estado.nivel, supers)) / Math.max(2, supers))
}

// Quanto HP o SUPER desta rodada (um ou os dois do SUPER COMBO, somados) pode
// tirar do chefe, a partir do HP de agora:
//   - no máximo o SUPER COMBO do nível (fracaoDoCombo): nem com CRÍTICO ele acaba a luta
//   - chefe acima de COOP.superFinaliza: ele aguenta com COOP.superSobra do HP máx
//     (abaixo disso o SUPER pode finalizar)
//   - no máximo uma fase: o chefe fica acima do limite da fase depois da próxima
export function limiteDoSuper(estado, supers = 2) {
  const c = estado.chefe
  let piso = c.hp > c.hpMax * COOP.superFinaliza ? Math.ceil(c.hpMax * COOP.superSobra) : 0
  const depois = CHEFES[c.id].fases[c.fase + 2]
  if (depois) piso = Math.max(piso, Math.floor(c.hpMax * depois.hp) + 1)
  return Math.max(0, Math.min(Math.round(c.hpMax * fracaoDoCombo(estado.nivel, supers)), c.hp - piso))
}

// Dano final de cada golpe (não muda o estado). desempenho[j] = { perfeito, grazes }.
// Quem está caído perde o golpe. O SUPER passa pelo limiteDoSuper: se a soma
// dos SUPER da rodada passar dele, cada um é reduzido na mesma proporção e
// vem com limitado: true (o chefe aguentou).
// Devolve [{ j, golpe, dano, falhou, limitado?, multiplicadores: [[nome, fator]] }]
export function calcularGolpes(estado, golpes, desempenho = []) {
  const lista = golpesSemLimite(estado, golpes, desempenho)
  const supers = lista.filter((g) => !g.falhou && g.golpe.tipo === 'super')
  const total = supers.reduce((t, g) => t + g.dano, 0)
  const limite = limiteDoSuper(estado, supers.length)
  if (total > limite) {
    let resto = limite
    supers.forEach((g, k) => {
      g.dano = k === supers.length - 1 ? Math.max(1, resto) : Math.max(1, Math.floor((g.dano * limite) / total))
      resto -= g.dano
      g.limitado = true
    })
  }
  return lista
}

function golpesSemLimite(estado, golpes, desempenho) {
  const caidos = estado.jogadores.map((jog) => jog.caido)
  const combos = combosDosGolpes(golpes, caidos)
  const nSuper = supersDaRodada(golpes, caidos).length
  const guarda = estado.chefe.guarda
  return golpes
    .map((golpe, j) => ({ golpe, j }))
    .filter(({ golpe }) => golpe)
    .map(({ golpe, j }) => {
      if (estado.jogadores[j].caido) return { j, golpe, dano: 0, falhou: true, multiplicadores: [] }
      const d = desempenho[j] ?? {}
      const mult = []
      if (d.perfeito) mult.push(['CRÍTICO', COOP.critico])
      if (golpe.tipo === 'paus' && d.grazes) mult.push([`+${d.grazes} GRAZE`, 1 + Math.min(COOP.grazeArmadilhaMax, d.grazes * COOP.grazeArmadilha)])
      const combo = combos[j]
      const extra = combo ? COOP.comboGrupo * (combo.grupo - 2) : 0 // 2 jogadores: 0 (o combo de sempre)
      if (combo?.tipo === 'par') mult.push(['PAR', Math.round((COOP.par + extra) * 100) / 100])
      if (combo?.tipo === 'combo') mult.push(['COMBO', Math.round((COOP.combo + extra) * 100) / 100])
      if (guarda != null) mult.push(['GUARDA', guarda])
      const fator = mult.reduce((m, [, f]) => m * f, 1)
      // SUPER COMBO: cada SUPER vira a parte dele do combo do nível (no lugar do golpe sozinho)
      const base = golpe.tipo === 'super' && nSuper >= 2 ? danoNoCombo(estado, nSuper) : golpe.base
      return { j, golpe, dano: Math.max(1, Math.round(base * fator)), falhou: false, multiplicadores: mult }
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

// Resgate por RODADA LIMPA (grupo de 3+): se havia quadro e NINGUÉM nele levou acerto, o caído há mais
// tempo volta (COOP.retornoHp do HP máx), já a partir da próxima rodada. `acertos[j]` = acertos de j
// na esquiva; `quadro` = r.quadro da rodada. Devolve os índices que voltaram
export function resgatarPorRodadaLimpa(estado, { quadro, acertos = [] } = {}) {
  if (estado.n <= 2 || !quadro || estado.chefe.hp <= 0) return []
  const noQuadro = indices(estado).filter((j) => quadro.jogadores[j])
  if (!noQuadro.length || noQuadro.some((j) => (acertos[j] ?? 0) > 0 || estado.jogadores[j].caido)) return []
  const caidos = indices(estado)
    .filter((j) => estado.jogadores[j].caido && !fora(estado.jogadores[j]))
    .sort((a, b) => (estado.jogadores[a].voltaEm ?? 0) - (estado.jogadores[b].voltaEm ?? 0) || a - b)
  if (!caidos.length) return []
  levantar(estado, caidos[0], estado.jogadores[caidos[0]].hpMax * COOP.retornoHp)
  return [caidos[0]]
}

// Tira a proteção e a guarda, troca a fase do chefe (o baralho dele passa a
// ser o da fase nova) e vê se a luta acabou. `limpa` = { quadro, acertos } (grupo de 3+: o
// resgate por rodada limpa). Derrota: todos os que ainda estão na luta caíram
export function fimDaRodadaCoop(estado, limpa = null) {
  const c = estado.chefe
  for (const jog of estado.jogadores) jog.protegido = false
  c.guarda = null
  const resgatados = limpa ? resgatarPorRodadaLimpa(estado, limpa) : []
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
  else if (estado.jogadores.every((jog) => jog.caido || fora(jog)) && estado.jogadores.some((jog) => !fora(jog))) vencedor = 'derrota'
  estado.vencedor = vencedor
  estado.fase = vencedor ? 'fim' : 'inicio'
  return estado.n > 2 ? { vencedor, novaFase, resgatados } : { vencedor, novaFase }
}
