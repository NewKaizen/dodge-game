// A LUTA da campanha (docs/campanha.md): um CHEFE como no CO-OP (coop/regras.js, as mesmas regras e as
// mesmas funções), com a Kris e, a partir da fase 2, a última amiga/o último amigo libertado como CPU
// aliada (coop/bot.js). Quem roda é o SERVIDOR (server/campanha.js); o navegador manda a carta e as
// posições do coração. Por cima das regras do CO-OP, as regras de cada fase (mundos/mundo1.js):
//   soNaipe          só cartas desse naipe no seu baralho (e na mão)
//   caixaEncolhe     o quadro perde esta fração da largura e da altura a cada rodada
//   eco              o ataque do chefe vem com o ataque leve dele junto (o ginásio ecoa)
//   energiaInicial   a sua energia na 1ª rodada
//   soDeCima         (os ataques do chefe são todos de cima: está nas cartas dele, campanha/chefes.js)
//   titan            as cartas que você NÃO jogou são arremessadas em você antes do ataque do chefe
//
//   const l = criarLuta({ mundo, fase, semente })
//   const l = criarLuta({ desafio: def, semente })   o DESAFIO DIÁRIO (src/lib/desafio.js): a "fase" sai
//                                    de faseDoDesafio(def), com o modificador do dia por cima das regras:
//     modificador.velocidade / densidade   o ritmo dos ataques do chefe (o quadro refeito usa o mesmo)
//     modificador.vida                     o seu HP (e o máximo) no começo
//     modificador.escuro                   só desenho no navegador (o servidor não precisa)
//   comecarRodada(l)                 -> a visão da rodada (mão, energias, a intenção do chefe)
//   jogar(l, cartaId | null)         -> { ok, motivo } | { ok: true, rodada } (null = passar)
//   concluirEsquiva(l, { amostras, acertosCliente, decorridoMs })
//                                    -> { suspeita: motivo } | { ok: true, ...resumo, vencedor }
//   estrelasDaLuta(l)                0..3 (só com vitória)
import { criarPartidaCoop, definirPresenca, iniciarRodadaCoop, podeJogarCoop, resolverRodadaCoop, aplicarDanoCoop, calcularGolpes, aplicarGolpe, fimDaRodadaCoop, comboDosGolpes, registrarPerfeitoCombo } from '../coop/regras.js'
import { escolherJogadaCoop } from '../coop/bot.js'
import { TIPOS_CHEFE } from '../coop/cartasChefe.js'
import { QUADRO } from '../coop/quadro.js'
import { CHEFES } from '../coop/chefes/index.js'
import { registrarGrazes, energiaPerfeito } from '../pvp/regras.js'
import { cartaNaMao, criarRng } from '../pvp/baralho.js'
import { ehSuper } from '../pvp/cartas.js'
import { TEMPOS } from '../constants.js'
import { mundoDe, faseDe } from './mundos/index.js'
import { validarAmostras } from './amostras.js'
import { faseDoDesafio, pontosDoDesafio } from '../../lib/desafio.js'
import { simularQuadro, duracaoDoQuadro, limitesDoQuadro, inicioNoQuadro, ritmoDoQuadro, velocidadeMaxDoQuadro } from './quadro.js'

export const MAX_RODADAS = 30 // passou disso: o Silêncio vence
export const HP_ESTRELA = 0.6 // a 2ª estrela: terminar com pelo menos 60% do HP
export const QUADRO_MINIMO = { largura: 190, altura: 120 }

// ---------- a luta ----------

export function criarLuta({ mundo, fase: n, semente, desafio = null }) {
  const m = desafio ? { id: 0, personagem: desafio.personagem } : mundoDe(mundo)
  const fase = desafio ? faseDoDesafio(desafio) : faseDe(mundo, n)
  if (!m || !fase) throw new Error(`fase da campanha não existe: ${mundo}-${n}`)
  if (!CHEFES[fase.inimigo]) throw new Error(`chefe da campanha não existe: ${fase.inimigo}`)
  const aliado = fase.aliado ?? null
  const estado = criarPartidaCoop({ party: [m.personagem, aliado ?? m.personagem], chefe: fase.inimigo, nivel: fase.nivel ?? 'facil', semente: `campanha:${semente}` })
  // sozinho (fase 1): a vaga 2 sai da luta (fora do quadro, sem jogar, sem mira)
  if (!aliado) definirPresenca(estado, { saiu: [1] })
  // só um naipe: o seu baralho (o monte) fica só com ele
  const naipe = fase.regra?.soNaipe
  if (naipe) estado.jogadores[0].baralho.monte = estado.jogadores[0].baralho.monte.filter((c) => c.naipe === naipe)
  // o desafio POR UM FIO: você começa com uma parte do HP (e esse é o máximo)
  const vida = fase.modificador?.vida ?? 1
  if (vida !== 1) {
    const eu = estado.jogadores[0]
    eu.hp = eu.hpMax = Math.max(1, Math.round(eu.hpMax * vida))
  }
  return {
    mundo: m.id,
    fase,
    aliado,
    semente: String(semente),
    estado,
    rngAliada: criarRng(`campanha:${semente}:aliada`),
    etapa: 'inicio', // inicio | escolha | esquiva | fim
    esquiva: null,
    vencedor: null,
    perfeitos: 0,
    acertosLevados: 0,
    grazesFeitos: 0,
  }
}

const publicaCarta = (c) => (c ? { id: c.id, personagem: c.personagem, naipe: c.naipe, valor: c.valor, nome: c.nome, descricao: c.descricao, custo: c.custo } : null)

// a caixa da rodada (a regra caixaEncolhe aperta a cada rodada, até o mínimo)
export function caixaDaRodada(fase, rodada) {
  const e = fase.regra?.caixaEncolhe ?? 0
  const k = e > 0 ? Math.pow(1 - e, Math.max(0, rodada - 1)) : 1
  return { largura: Math.max(QUADRO_MINIMO.largura, Math.round(QUADRO.largura * k)), altura: Math.max(QUADRO_MINIMO.altura, Math.round(QUADRO.altura * k)) }
}

// as cartas que você pode jogar agora (a energia, o caído e a regra do naipe)
export function jogaveis(l) {
  const eu = l.estado.jogadores[0]
  const naipe = l.fase.regra?.soNaipe
  return eu.baralho.mao.filter((c) => podeJogarCoop(l.estado, 0, c.id).ok && (!naipe || c.naipe === naipe)).map((c) => c.id)
}

const jogadorPublico = (jog) => ({ personagem: jog.personagem, hp: jog.hp, hpMax: jog.hpMax, energia: jog.energia, caido: jog.caido, escudo: jog.escudo, sequencia: jog.sequencia ?? 0 })

export function visaoDaRodada(l) {
  const e = l.estado
  const [eu, aliada] = e.jogadores
  const c = e.chefe
  const intencao = c.intencao
  return {
    rodada: e.rodada,
    caixa: caixaDaRodada(l.fase, e.rodada),
    eu: { ...jogadorPublico(eu), mao: eu.baralho.mao.map(publicaCarta), jogaveis: jogaveis(l) },
    aliado: l.aliado ? jogadorPublico(aliada) : null,
    // a intenção do chefe: o naipe à vista (a carta é virada); o SUPER dele aparece inteiro
    chefe: { id: c.id, hp: c.hp, hpMax: c.hpMax, fase: c.fase, carga: c.carga, cargaMax: c.cargaMax, intencao: intencao ? { naipe: intencao.naipe, tipo: TIPOS_CHEFE[intencao.naipe], super: ehSuper(intencao), nome: ehSuper(intencao) ? intencao.nome : null } : null },
  }
}

export function comecarRodada(l) {
  if (l.etapa === 'fim') throw new Error('a luta já acabou')
  const eventos = iniciarRodadaCoop(l.estado)
  if (l.estado.rodada === 1 && l.fase.regra?.energiaInicial != null) l.estado.jogadores[0].energia = l.fase.regra.energiaInicial
  l.etapa = 'escolha'
  return { ...visaoDaRodada(l), eventos }
}

// a esquiva da rodada (o que o navegador precisa para rodar o MESMO quadro)
function montarEsquiva(l, r, arremessadas) {
  const e = l.estado
  const fase = l.fase
  let q = r.destino === 'quadro' ? r.quadro : null
  const titan = Boolean(fase.regra?.titan) && arremessadas.length > 0 && !e.jogadores[0].caido
  // o titã arremessa as suas cartas mesmo quando a carta dele saiu da mesa: aí vem o ataque leve dele
  if (!q && titan) {
    const noQuadro = e.jogadores.map((jog) => !jog.caido && !jog.saiu)
    q = { carta: { id: `${fase.inimigo}-leve`, chefe: fase.inimigo, naipe: 'copas', valor: 2, nome: 'Leve' }, danos: noQuadro.map((d) => (d ? Math.max(1, Math.round(CHEFES[fase.inimigo].danoBala * 0.6)) : null)), jogadores: noQuadro, ritmo: { velocidade: 1, densidade: 1 }, inverter: false }
  }
  if (!q) return null
  const esq = {
    chefe: fase.inimigo,
    nivel: e.nivel,
    carta: q.carta,
    cartas: titan ? arremessadas.map((c) => ({ id: c.id })) : null,
    eco: Boolean(fase.regra?.eco),
    danos: q.danos,
    hp: e.jogadores.map((j) => j.hp),
    protegido: e.jogadores.map((j) => Boolean(j.protegido)),
    jogadores: q.jogadores.map((d, j) => Boolean(d) && !e.jogadores[j].saiu),
    caixa: caixaDaRodada(fase, e.rodada),
    ritmo: ritmoDoQuadro(fase.inimigo, e.nivel, { velocidade: (q.ritmo?.velocidade ?? 1) * (fase.modificador?.velocidade ?? 1), densidade: (q.ritmo?.densidade ?? 1) * (fase.modificador?.densidade ?? 1) }),
    velocidadeMax: velocidadeMaxDoQuadro(fase.inimigo, e.nivel),
    inverter: Boolean(q.inverter),
    semente: `${l.semente}:r${e.rodada}:quadro`,
  }
  esq.duracao = duracaoDoQuadro(esq)
  return esq
}

export function jogar(l, cartaId) {
  if (l.etapa !== 'escolha') return { ok: false, motivo: 'fora_de_hora' }
  if (cartaId !== null && typeof cartaId !== 'string') return { ok: false, motivo: 'carta_invalida' }
  const e = l.estado
  const eu = e.jogadores[0]
  if (cartaId !== null) {
    const carta = cartaNaMao(eu.baralho, cartaId)
    if (!carta) return { ok: false, motivo: 'fora_da_mao' }
    if (l.fase.regra?.soNaipe && carta.naipe !== l.fase.regra.soNaipe) return { ok: false, motivo: 'regra' }
    const v = podeJogarCoop(e, 0, cartaId)
    if (!v.ok) return { ok: false, motivo: v.bloqueio?.codigo === 'sem-energia' ? 'sem_energia' : 'carta_invalida' }
  }
  // o TITÃ: as cartas que ficaram na sua mão (a mão inteira, se passou)
  const arremessadas = l.fase.regra?.titan ? eu.baralho.mao.filter((c) => c.id !== cartaId).map(publicaCarta) : []
  const aliada = l.aliado && !e.jogadores[1].caido ? escolherJogadaCoop(e, 1, { rng: l.rngAliada }) : null
  const r = resolverRodadaCoop(e, cartaId, aliada)
  const esq = montarEsquiva(l, r, arremessadas)
  l.esquiva = { r, esq, rodada: e.rodada }
  l.etapa = 'esquiva'
  return {
    ok: true,
    rodada: {
      rodada: e.rodada,
      jogadas: r.jogadas.map((j) => ({ carta: publicaCarta(j.carta), passou: j.passou, especial: j.especial, super: j.super })),
      intencao: r.intencao ? { ...publicaCarta(r.intencao), tipo: TIPOS_CHEFE[r.intencao.naipe] } : null,
      destino: r.destino,
      efeitos: r.efeitos,
      chefeEfeito: r.chefe,
      esquiva: esq,
      arremessadas: esq?.cartas ? arremessadas : [],
      eu: jogadorPublico(e.jogadores[0]),
      aliado: l.aliado ? jogadorPublico(e.jogadores[1]) : null,
      chefe: { hp: e.chefe.hp, hpMax: e.chefe.hpMax },
    },
  }
}

// no máximo quantos acertos cabem numa esquiva (um a cada TEMPOS.invencivelMs)
export const maxAcertos = (duracao) => Math.ceil(Math.max(0, duracao) / TEMPOS.invencivelMs) + 1

// o fim da esquiva: o servidor confere as amostras, refaz o quadro (você e a aliada), aplica o dano,
// os golpes no chefe e o fim da rodada
export function concluirEsquiva(l, { amostras, acertosCliente = 0, decorridoMs = Infinity }) {
  if (l.etapa !== 'esquiva' || !l.esquiva) return { suspeita: 'fora_de_hora' }
  const { r, esq } = l.esquiva
  const e = l.estado
  let acertos = [0, 0]
  let grazes = [0, 0]
  if (esq) {
    const limites = limitesDoQuadro(esq.caixa)
    const caixa = { esquerda: limites.left, direita: limites.right, topo: limites.top, base: limites.bottom }
    const comigo = esq.jogadores[0]
    if (comigo) {
      const v = validarAmostras(amostras, { caixa, duracao: esq.duracao, inicio: inicioNoQuadro(limites, 0, esq.jogadores), decorridoMs })
      if (!v.ok) return { suspeita: v.motivo }
    }
    const relato = Number.isInteger(acertosCliente) ? acertosCliente : -1
    if (relato < 0 || relato > maxAcertos(esq.duracao)) return { suspeita: 'relato_impossivel' }
    const s = simularQuadro(esq, comigo ? amostras : [])
    // o relato do navegador só pode PIORAR para ele (o servidor é o piso)
    acertos = [comigo ? Math.max(s.acertos[0], relato) : 0, s.acertos[1] ?? 0]
    grazes = s.grazes
  }
  // o dano em cada um (o escudo já vem em danos[j])
  const dano = [0, 0]
  for (const j of [0, 1]) for (let k = 0; k < acertos[j]; k++) dano[j] += aplicarDanoCoop(e, j, esq.danos[j] ?? 0)
  for (const j of [0, 1]) if (grazes[j]) registrarGrazes(e, j, grazes[j])
  l.acertosLevados += acertos[0]
  l.grazesFeitos += grazes[0] ?? 0
  // desvio perfeito (cada um): CRÍTICO no golpe e a energia (x combo) se o ataque dá energia
  const perfeito = [0, 1].map((j) => Boolean(esq?.jogadores[j]) && !acertos[j] && !e.jogadores[j].caido)
  const perfeitos = [null, null]
  if (esq && r.quadro && energiaPerfeito(r.quadro.carta))
    for (const j of [0, 1]) {
      if (!perfeito[j]) continue
      perfeitos[j] = registrarPerfeitoCombo(e, j, r.quadro.carta)
      if (j === 0) l.perfeitos++
    }
  // o contra-ataque: as cartas jogadas viram golpes no chefe (as mesmas contas do CO-OP)
  const desempenho = [0, 1].map((j) => ({ perfeito: perfeito[j], grazes: grazes[j] }))
  const golpes = calcularGolpes(e, r.golpes, desempenho)
  const combo = comboDosGolpes(r.golpes.map((g, j) => (e.jogadores[j].caido ? null : g)))
  for (const g of golpes) g.efetivo = g.falhou ? 0 : aplicarGolpe(e, g.dano)
  let { vencedor, novaFase } = fimDaRodadaCoop(e)
  if (!vencedor && e.rodada >= MAX_RODADAS) {
    vencedor = 'derrota'
    e.vencedor = vencedor
  }
  l.vencedor = vencedor
  l.esquiva = null
  l.etapa = vencedor ? 'fim' : 'inicio'
  const [eu, aliada] = e.jogadores
  return {
    ok: true,
    acertos,
    grazes,
    dano,
    perfeito,
    perfeitos: perfeitos.map((p) => (p ? { ganho: p.ganho, multiplicador: p.multiplicador } : null)),
    golpes: golpes.map((g) => ({ j: g.j, tipo: g.golpe.tipo, carta: publicaCarta(g.golpe.carta), dano: g.efetivo, falhou: g.falhou, limitado: Boolean(g.limitado), multiplicadores: g.multiplicadores })),
    combo,
    novaFase,
    vencedor: vencedor === 'vitoria' ? 'p1' : vencedor === 'derrota' ? 'p2' : null,
    eu: jogadorPublico(eu),
    aliado: l.aliado ? jogadorPublico(aliada) : null,
    chefe: { hp: e.chefe.hp, hpMax: e.chefe.hpMax, fase: e.chefe.fase },
  }
}

// ★ vencer · ★ terminar com pelo menos 60% do HP · ★ vencer em até metaRodadas rodadas
export function estrelasDaLuta(l) {
  if (l.vencedor !== 'vitoria') return 0
  const eu = l.estado.jogadores[0]
  return 1 + (eu.hp / eu.hpMax >= HP_ESTRELA ? 1 : 0) + (l.estado.rodada <= (l.fase.metaRodadas ?? Infinity) ? 1 : 0)
}

export function descreverRegra(regra = {}) {
  if (regra.soNaipe) return 'Só cartas de espadas: o seu baralho nesta fase só tem elas.'
  if (regra.caixaEncolhe) return 'O quadro encolhe a cada rodada.'
  if (regra.eco) return 'Tudo ecoa: o ataque do chefe vem com o ataque leve dele junto.'
  if (regra.energiaInicial != null) return `Você começa com ${regra.energiaInicial} de energia.`
  if (regra.soDeCima) return 'Todo ataque do chefe vem de cima.'
  if (regra.titan) return 'O TITÃ: as cartas que você não jogar são arremessadas em você antes do ataque dele.'
  return ''
}

// o resumo do fim da luta que o servidor guarda (o desafio diário e as conquistas): tudo do que ELE viu
export function resumoDaLuta(l) {
  const eu = l.estado.jogadores[0]
  const c = l.estado.chefe
  const r = {
    vitoria: l.vencedor === 'vitoria',
    rodadas: l.estado.rodada,
    acertos: l.acertosLevados,
    grazes: l.grazesFeitos,
    perfeitos: l.perfeitos,
    hpFracao: eu.hpMax > 0 ? Math.max(0, eu.hp) / eu.hpMax : 0,
    chefeFracao: c.hpMax > 0 ? 1 - Math.max(0, c.hp) / c.hpMax : 0,
  }
  return { ...r, pontos: pontosDoDesafio(r) }
}
