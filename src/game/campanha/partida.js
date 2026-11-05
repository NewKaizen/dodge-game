// A PARTIDA da campanha (docs/campanha.md): quem roda é o SERVIDOR (server/campanha.js). Lógica
// pura sobre as regras de sempre (pvp/regras.js): energia, mão, custos, Ases, dano e vencedor. O
// navegador só manda a carta escolhida e as posições do coração; daqui saem a jogada da CPU, os
// ataques (com semente), a esquiva da CPU e o dano de cada lado.
//
//   const c = criarCorrida({ mundo: 1, fase: 1, semente })
//   comecarRodada(c)                -> visão da rodada (a mão, as energias, o que pode jogar)
//   jogar(c, cartaId | null)        -> { ok, motivo } | { ok: true, rodada } (null = passar a vez)
//   concluirEsquiva(c, { amostras, acertosCliente, decorridoMs })
//                                   -> { suspeita: motivo } | { ok: true, ...resumo, vencedor }
//   estrelasDaCorrida(c)            0..3 (só com vitória)
//   descreverRegra(regra)           o texto da regra especial (para a tela)
import { criarPartida, iniciarRodada, podeJogar, resolverRodada, aplicarDano, registrarGrazes, registrarPerfeito, fimDaRodada, curar } from '../pvp/regras.js'
import { escolherJogada } from '../pvp/bot.js'
import { cartaNaMao, criarRng, criarBaralho } from '../pvp/baralho.js'
import { SIMBOLOS, cartasDoPersonagem } from '../pvp/cartas.js'
import { TEMPOS, CORACAO } from '../constants.js'
import { mundoDe, faseDe } from './mundos/index.js'
import { ataqueDaCartaNaCampanha, atacavelNoServidor } from './ataques.js'
import { validarAmostras } from './amostras.js'
import { simularComAmostras, simularCpu, inicioDaCaixa } from './simulacao.js'

// a caixa da campanha (mundo de 854×480): um pouco maior que a das pistas do PvP
export const CAIXA_CAMPANHA = Object.freeze({ esquerda: 232, direita: 492, topo: 150, base: 320 })
export const CAIXA_MINIMA = { largura: 130, altura: 104 }
export const VELOCIDADE_CORACAO = CORACAO.velocidadePadrao // fixa na campanha (o painel não muda)
export const MAX_RODADAS = 30
export const HP_ESTRELA = 0.6 // a 2ª estrela: terminar com pelo menos 60% do HP
export const CURA_VIRADA = 0.2 // o chefe, ao se refazer (a virada), cura isto do HP máximo
// a CPU da campanha leva mais dano por acerto que a do PvP: as fases ficam curtas (5 a 9 rodadas)
export const DANO_NA_CPU = 1.35

// ---------- a caixa de cada rodada ----------

export function caixaDaRodada(fase, rodada, { virou = false } = {}) {
  const b = CAIXA_CAMPANHA
  let largura = b.direita - b.esquerda
  let altura = b.base - b.topo
  const encolhe = fase.regra?.caixaEncolhe ?? 0
  if (encolhe > 0) {
    const k = Math.pow(1 - encolhe, Math.max(0, rodada - 1))
    largura = Math.max(CAIXA_MINIMA.largura, Math.round(largura * k))
    altura = Math.max(CAIXA_MINIMA.altura, Math.round(altura * k))
  }
  if (virou) {
    // a virada: deitada (larga e baixa)
    largura = Math.round((b.direita - b.esquerda) * 1.12)
    altura = Math.max(CAIXA_MINIMA.altura, Math.round((b.base - b.topo) * 0.66))
  }
  const cx = (b.esquerda + b.direita) / 2
  const cy = (b.topo + b.base) / 2
  return { esquerda: Math.round(cx - largura / 2), direita: Math.round(cx + largura / 2), topo: Math.round(cy - altura / 2), base: Math.round(cy + altura / 2) }
}

export function descreverRegra(regra = {}) {
  if (regra.soNaipe) return `Só cartas ${SIMBOLOS[regra.soNaipe]}: o seu baralho nesta fase só tem elas.`
  if (regra.caixaEncolhe) return 'A caixa encolhe a cada rodada.'
  if (regra.eco) return 'O ataque que você mandou volta na sua caixa na rodada seguinte.'
  if (regra.energiaInicial != null) return `Você começa com ${regra.energiaInicial} de energia.`
  if (regra.soDeCima) return 'Todo ataque na sua caixa vem de cima.'
  if (regra.duplo) return 'O chefe manda dois ataques ao mesmo tempo e, na metade do HP, se refaz (cura e a caixa deita).'
  return ''
}

// ---------- corrida ----------

export function criarCorrida({ mundo, fase: n, semente }) {
  const m = mundoDe(mundo)
  const fase = faseDe(mundo, n)
  if (!m || !fase) throw new Error(`fase da campanha não existe: ${mundo}-${n}`)
  const estado = criarPartida({ p1: m.personagem, p2: fase.oponente, semente: `campanha:${semente}` })
  // só um naipe: o baralho da fase só tem esse naipe (a mão nunca trava)
  const naipe = fase.regra?.soNaipe
  if (naipe) estado.jogadores[0].baralho = criarBaralho(m.personagem, `campanha:${semente}:p1`, cartasDoPersonagem(m.personagem).filter((x) => x.naipe === naipe))
  const cpu = estado.jogadores[1]
  cpu.hpMax = Math.max(1, Math.round(cpu.hpMax * (fase.fatorHpCpu ?? 1)))
  cpu.hp = cpu.hpMax
  return {
    mundo: m.id,
    fase,
    semente: String(semente),
    estado,
    rngCpu: criarRng(`campanha:${semente}:cpu`),
    etapa: 'inicio', // inicio | escolha | esquiva | fim
    virou: false,
    ultimoAtaqueJogador: null, // o ataque da carta que você mandou (o eco devolve)
    esquiva: null,
    danoLevado: 0,
    acertosLevados: 0,
    perfeitos: 0,
  }
}

const publicaCarta = (c) => (c ? { id: c.id, personagem: c.personagem, naipe: c.naipe, valor: c.valor, nome: c.nome, descricao: c.descricao, custo: c.custo } : null)

// as cartas que a regra deixa jogar agora (o custo também conta)
export function cartasPermitidas(c) {
  const eu = c.estado.jogadores[0]
  return eu.baralho.mao.filter((carta) => carta.custo <= eu.energia && (!c.fase.regra?.soNaipe || carta.naipe === c.fase.regra.soNaipe))
}

export function visaoDaRodada(c) {
  const [eu, cpu] = c.estado.jogadores
  return {
    rodada: c.estado.rodada,
    caixa: caixaDaRodada(c.fase, c.estado.rodada, { virou: c.virou }),
    eu: { hp: eu.hp, hpMax: eu.hpMax, energia: eu.energia, sequencia: eu.sequencia, mao: eu.baralho.mao.map(publicaCarta), jogaveis: cartasPermitidas(c).map((x) => x.id) },
    cpu: { personagem: cpu.personagem, hp: cpu.hp, hpMax: cpu.hpMax, energia: cpu.energia, nMao: cpu.baralho.mao.length },
    virou: c.virou,
  }
}

export function comecarRodada(c) {
  if (c.etapa === 'fim') throw new Error('a corrida já acabou')
  iniciarRodada(c.estado)
  if (c.estado.rodada === 1 && c.fase.regra?.energiaInicial != null) c.estado.jogadores[0].energia = c.fase.regra.energiaInicial
  c.etapa = 'escolha'
  return visaoDaRodada(c)
}

// o ataque que cai numa caixa (lado 0 = a sua, 1 = a da CPU), pronto para simular
function montarAtaque(c, caixa, lado) {
  if (!caixa) return null
  const regraDoLado = lado === 0 ? { soDeCima: c.fase.regra?.soDeCima, duplo: c.fase.regra?.duplo && caixa.de === 1 } : {}
  let carta = caixa.carta
  // ECO: na sua caixa, o ataque que a CPU manda é o que você mandou na rodada passada
  let base = ataqueDaCartaNaCampanha(carta, regraDoLado)
  if (lado === 0 && c.fase.regra?.eco && caixa.de === 1 && c.ultimoAtaqueJogador) base = { ...c.ultimoAtaqueJogador, soDeCima: Boolean(regraDoLado.soDeCima) }
  if (!base) return null
  return {
    ...base,
    carta: carta.id,
    dano: caixa.dano, // já com o escudo de quem recebe (pvp/regras.js)
    caixa: caixaDaRodada(c.fase, c.estado.rodada, { virou: c.virou }),
    semente: `${c.semente}:r${c.estado.rodada}:${lado}`,
    verificado: base.modelos.every(atacavelNoServidor),
  }
}

export function jogar(c, cartaId) {
  if (c.etapa !== 'escolha') return { ok: false, motivo: 'fora_de_hora' }
  if (cartaId !== null && typeof cartaId !== 'string') return { ok: false, motivo: 'carta_invalida' }
  const eu = c.estado.jogadores[0]
  if (cartaId !== null) {
    const carta = cartaNaMao(eu.baralho, cartaId)
    if (!carta) return { ok: false, motivo: 'fora_da_mao' }
    if (c.fase.regra?.soNaipe && carta.naipe !== c.fase.regra.soNaipe) return { ok: false, motivo: 'regra' }
    const v = podeJogar(c.estado, 0, cartaId)
    if (!v.ok) return { ok: false, motivo: v.bloqueio?.codigo === 'sem-energia' ? 'sem_energia' : 'carta_invalida' }
  }
  const cartaCpu = escolherJogada(c.estado, 1, { nivel: c.fase.nivel, rng: c.rngCpu })
  const r = resolverRodada(c.estado, cartaId, cartaCpu)
  const ataque = montarAtaque(c, r.caixas[0], 0)
  const ataqueCpu = montarAtaque(c, r.caixas[1], 1)
  const cpu = ataqueCpu ? simularCpu(ataqueCpu, { nivel: c.fase.nivel, semente: ataqueCpu.semente, velocidade: VELOCIDADE_CORACAO }) : null
  // o eco guarda o ataque que a SUA carta mandou (refletido ou não)
  const minha = r.jogadas[0].carta
  const meuAtaque = minha && !r.jogadas[0].anulada ? ataqueDaCartaNaCampanha(minha) : null
  c.esquiva = { ataque, ataqueCpu, cpu, rodada: c.estado.rodada }
  if (meuAtaque) c.ultimoAtaqueJogador = meuAtaque
  c.etapa = 'esquiva'
  const [a, b] = c.estado.jogadores
  return {
    ok: true,
    rodada: {
      rodada: c.estado.rodada,
      jogadas: r.jogadas.map((j) => ({ carta: publicaCarta(j.carta), passou: j.passou, anulada: j.anulada, especial: j.especial })),
      efeitos: r.efeitos,
      eventos: r.eventos,
      ataque: semInterno(ataque),
      ataqueCpu: semInterno(ataqueCpu),
      cpuAmostras: cpu?.amostras ?? [],
      eu: { hp: a.hp, hpMax: a.hpMax, energia: a.energia },
      cpu: { hp: b.hp, hpMax: b.hpMax, energia: b.energia },
    },
  }
}

const semInterno = (at) => (at ? { modelos: at.modelos, forca: at.forca, duracao: at.duracao, dano: at.dano, caixa: at.caixa, semente: at.semente, soDeCima: at.soDeCima, verificado: at.verificado } : null)

// no máximo quantos acertos cabem numa esquiva (um a cada TEMPOS.invencivelMs)
export const maxAcertos = (duracao) => Math.ceil(Math.max(0, duracao) / TEMPOS.invencivelMs) + 1

// o fim da esquiva: o servidor confere as amostras, refaz os acertos e aplica o dano
//   amostras: já lidas (amostras.ler) · acertosCliente: quantos acertos o navegador sentiu
//   decorridoMs: relógio do servidor desde que a esquiva foi entregue
export function concluirEsquiva(c, { amostras, acertosCliente = 0, decorridoMs = Infinity }) {
  if (c.etapa !== 'esquiva' || !c.esquiva) return { suspeita: 'fora_de_hora' }
  const { ataque, ataqueCpu, cpu } = c.esquiva
  const duracao = ataque?.duracao ?? 0
  const v = validarAmostras(amostras, { caixa: ataque?.caixa ?? caixaDaRodada(c.fase, c.estado.rodada, { virou: c.virou }), velocidade: VELOCIDADE_CORACAO, duracao, inicio: inicioDaCaixa(ataque?.caixa ?? CAIXA_CAMPANHA), decorridoMs })
  if (!v.ok) return { suspeita: v.motivo }
  const relato = Number.isInteger(acertosCliente) ? acertosCliente : -1
  if (relato < 0 || relato > maxAcertos(duracao)) return { suspeita: 'relato_impossivel' }

  // (a) servidor: os acertos refeitos com as amostras (o piso) · (c) ataque que o servidor não
  // simula: vale o relato do navegador, conferido acima (hoje a campanha não tem nenhum)
  let acertosServidor = 0
  let grazes = 0
  if (ataque && ataque.verificado) {
    const s = simularComAmostras(ataque, amostras)
    acertosServidor = s.acertos
    grazes = s.grazes
  }
  const acertos = ataque ? (ataque.verificado ? Math.max(acertosServidor, relato) : relato) : 0
  const est = c.estado
  let dano = 0
  for (let i = 0; i < acertos; i++) dano += aplicarDano(est, 0, ataque.dano)
  registrarGrazes(est, 0, grazes)
  if (ataque && acertos === 0) {
    registrarPerfeito(est, 0, cartaDoAtaque(c, ataque))
    c.perfeitos++
  }
  c.danoLevado += dano
  c.acertosLevados += acertos

  // a CPU (decidida pelo servidor em jogar())
  let danoCpu = 0
  if (ataqueCpu && cpu) {
    for (let i = 0; i < cpu.acertos; i++) danoCpu += aplicarDano(est, 1, Math.round(ataqueCpu.dano * DANO_NA_CPU))
    registrarGrazes(est, 1, cpu.grazes)
    if (cpu.acertos === 0) registrarPerfeito(est, 1, cartaDoAtaque(c, ataqueCpu))
  }

  // o chefe se refaz na metade do HP (uma vez): a virada
  let virou = false
  const chefe = est.jogadores[1]
  if (c.fase.regra?.virada && !c.virou && chefe.hp > 0 && chefe.hp <= chefe.hpMax / 2) {
    c.virou = virou = true
    curar(est, 1, Math.round(chefe.hpMax * CURA_VIRADA))
  }

  let vencedor = fimDaRodada(est)
  if (!vencedor && est.rodada >= MAX_RODADAS) vencedor = 'p2' // passou do limite: o silêncio vence
  c.esquiva = null
  c.etapa = vencedor ? 'fim' : 'inicio'
  c.vencedor = vencedor
  const [a, b] = est.jogadores
  return {
    ok: true,
    acertos,
    acertosServidor,
    grazes,
    dano,
    cpu: { acertos: cpu?.acertos ?? 0, dano: danoCpu },
    virou,
    vencedor,
    eu: { hp: a.hp, hpMax: a.hpMax, energia: a.energia, sequencia: a.sequencia },
    adversario: { hp: b.hp, hpMax: b.hpMax, energia: b.energia },
  }
}

// a carta cujo ataque caiu na caixa (para a energia do desvio perfeito)
function cartaDoAtaque(c, ataque) {
  const todos = c.estado.jogadores.flatMap((j) => [...j.baralho.descarte, ...j.baralho.mao, ...j.baralho.monte])
  return todos.find((x) => x.id === ataque.carta) ?? null
}

// ★ vencer · ★ terminar com >= 60% do HP · ★ vencer em até metaRodadas rodadas
export function estrelasDaCorrida(c) {
  if (c.vencedor !== 'p1') return 0
  const eu = c.estado.jogadores[0]
  return 1 + (eu.hp / eu.hpMax >= HP_ESTRELA ? 1 : 0) + (c.estado.rodada <= (c.fase.metaRodadas ?? Infinity) ? 1 : 0)
}
