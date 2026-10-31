// Regras do TODOS CONTRA TODOS (1x1x1x1, 3 e 4 jogadores online; Fase 5D, docs/pvp-regras.md
// "Todos contra todos"). Lógica pura (sem Phaser), testada em __tests__/ffa.test.js. As cartas, a
// energia, o dano, a cura, os grazes e o combo de perfeitos são os do 1x1 (pvp/regras.js): cada par
// atacante -> alvo da rodada resolve como um duelo de 1x1, só que o alvo de cada um vem do RODÍZIO.
//
//   const estado = criarPartidaFfa({ personagens: ['kris', 'susie', 'ralsei', 'dess'], semente })
//   iniciarRodadaFfa(estado, { ausentes })     energia + mãos; estado.alvos = o rodízio da rodada
//   resolverRodadaFfa(estado, jogadas)         jogadas[vaga] = id da carta | null; -> { caixas, efeitos, ... }
//   aplicarDanoFfa(estado, j, dano, de)        um acerto no coração de j (de = quem mandou a caixa)
//   aplicarAusente(estado, j, caixa, jaLevou)  quem está sem conexão leva o ataque inteiro
//   eliminarFfa(estado, j, motivo)             'saiu' (os 20 s da queda acabaram): eliminado na hora
//   fimDaRodadaFfa(estado)                     -> { eliminados, fim, motivo }
//   classificacao(estado)                      [vaga do 1º, do 2º, ...] (o relato `colocacoes` do servidor)
//
// RODÍZIO (anunciado ANTES da escolha): os vivos em ordem de vaga, v[0..n-1]; na rodada r cada um ataca
// v[(i + passo) mod n], com passo = 1 + (r - 1) mod (n - 1). Como o passo nunca é 0 (nem múltiplo de n),
// é uma permutação sem ponto fixo: cada um ataca exatamente UM e recebe exatamente UM ataque (nada de
// "todos no líder"). Com 3 vivos é sempre um ciclo (para a direita, depois para a esquerda); com 4 o passo
// 2 faz duas duplas (A↔C, B↔D); com 2 vivos é o 1x1 (os dois se atacam).

import { PERSONAGENS } from '../data/personagens.js'
import { criarBaralho, completarMao, comprar, descartar, tirarDaMao, criarRng, inteiro, MAO } from './baralho.js'
import { especialDaCarta, efeitosDaCarta, resumoDoAtaque, ehSuper } from './cartas.js'
import { ENERGIA, PVP, hpInicial, podeJogar, aplicarDano, curar } from './regras.js'

// minimo/maximo   jogadores na partida
// morteSubita     a partir desta rodada o dano por bala de toda caixa é ×fatorMorteSubita (a partida não se arrasta)
// limiteRodadas   no fim desta rodada a partida acaba: quem está vivo é classificado pelo HP (depois o dano causado)
// acertosAusente  quem está SEM CONEXÃO leva o ataque que vinha para ele como este tanto de acertos
export const FFA = { minimo: 3, maximo: 4, morteSubita: 15, fatorMorteSubita: 1.5, limiteRodadas: 24, acertosAusente: 3 }

const ids = (n) => Array.from({ length: n }, (_, j) => `p${j + 1}`)

export function criarPartidaFfa({ personagens, semente = 'ffa' }) {
  const n = personagens.length
  if (n < 2 || n > 4) throw new Error('todos contra todos: de 2 a 4 jogadores')
  const nomes = ids(n)
  return {
    modo: 'ffa',
    n,
    semente: String(semente),
    rodada: 0,
    fase: 'inicio',
    rng: criarRng(`${semente}:partida`),
    jogadores: personagens.map((personagem, j) => {
      const hp = PERSONAGENS[personagem] ? hpInicial(personagem) : 90
      return {
        id: nomes[j],
        personagem,
        hp,
        hpMax: hp,
        energia: 0,
        grazes: 0,
        escudo: null,
        protegido: false,
        sequencia: 0,
        maiorSequencia: 0,
        danoCausado: 0,
        danoRecebido: 0,
        eliminado: null, // { rodada, ordem, motivo: 'ko' | 'saiu' }
        ausente: false,
        baralho: criarBaralho(personagem, `${semente}:${nomes[j]}`),
      }
    }),
    alvos: Array(n).fill(null),
    ausentes: [],
    eliminacoes: 0, // conta os "lotes" de eliminação (quem cai na mesma rodada fica no mesmo lote)
    vencedor: null,
    fim: null, // null | 'ko' | 'limite'
    historico: [],
  }
}

export const vivos = (estado) => estado.jogadores.map((jog, j) => (jog.eliminado ? -1 : j)).filter((j) => j >= 0)

// o rodízio: alvos[vaga] = a vaga que ela ataca (null = eliminada). Ver o topo do arquivo
export function alvosDoRodizio(lista, rodada, n = Math.max(0, ...lista) + 1) {
  const alvos = Array(n).fill(null)
  const k = lista.length
  if (k < 2) return alvos
  const passo = 1 + ((Math.max(1, rodada) - 1) % (k - 1))
  lista.forEach((j, i) => (alvos[j] = lista[(i + passo) % k]))
  return alvos
}

// quem ataca a vaga j nesta rodada (-1: ninguém)
export const atacanteDe = (estado, j) => estado.alvos.indexOf(j)

// Começo da rodada. `ausentes`: quem está sem conexão (não ganha energia nesta rodada: quem cai não
// leva vantagem). Os eliminados ficam de fora de tudo
export function iniciarRodadaFfa(estado, { ausentes = [] } = {}) {
  if (estado.fim) return estado
  estado.rodada++
  const lista = vivos(estado)
  estado.ausentes = lista.filter((j) => ausentes.includes(j))
  for (const j of lista) {
    const jog = estado.jogadores[j]
    jog.ausente = estado.ausentes.includes(j)
    jog.protegido = false
    if (!jog.ausente) jog.energia = estado.rodada === 1 ? ENERGIA.inicial : Math.min(ENERGIA.maxima, jog.energia + ENERGIA.porRodada)
    completarMao(jog.baralho, MAO.tamanho)
  }
  estado.alvos = alvosDoRodizio(lista, estado.rodada, estado.n)
  estado.fase = 'escolha'
  return estado
}

const idDaJogada = (jogada) => (jogada == null ? null : typeof jogada === 'string' ? jogada : jogada.carta ?? null)
const mandaAtaque = (carta) => carta && especialDaCarta(carta) !== 'segundaChance'
const novoEfeito = () => ({ cura: 0, escudo: null, energia: 0, compradas: [], roubou: null, perdeu: null, segundaChance: false, apoiou: null })
const montarCaixa = (carta, de, refletida, dono = de) => ({ carta, de, dono, refletida, escudo: null, ...resumoDoAtaque(carta) })

// quem pode jogar nesta rodada (vivo e com conexão)
// (no 2x2, pvp/dupla.js, quem está CAÍDO também não joga)
export const joga = (estado, j) => !estado.jogadores[j].eliminado && !estado.jogadores[j].ausente && !estado.jogadores[j].caido

// Resolve a rodada (o host). jogadas[vaga] = id | null. Quem não joga (eliminado, sem conexão) passa SEM
// o bônus de passar. Valida tudo antes de mudar o estado. Por par atacante -> alvo, como no 1x1:
//   1. paga a energia e descarta (quem passa ganha +1)
//   2. ♦ Anular de X cancela a carta de quem ATACA X (o SUPER não)
//   3. ♥ suporte em quem jogou
//   4. ataques: a carta de cada um vai para a caixa do SEU alvo. ♠ Espelho de X PASSA ADIANTE o ataque
//      que vinha para X: ele vai para o alvo de X (no lugar do eco) e não chega em X; sem ataque para
//      passar (ou o de quem ataca é Espelho/SUPER/copas), X manda o eco. Assim cada um continua
//      recebendo no máximo UM ataque
//   5. morte súbita (rodada >= FFA.morteSubita): dano ×FFA.fatorMorteSubita; depois o escudo de quem recebe
//   6. ♣ Roubo de X pega uma carta da mão do alvo de X
// opcoes (o 2x2, pvp/dupla.js): apoio[j] = em quem vai a cura/escudo/Segunda chance do ♥ de j (o padrão é j;
// a energia e a compra ficam sempre com j); fatorDano[j] = multiplica o dano da caixa que j manda
export function resolverRodadaFfa(estado, jogadas, opcoes = {}) {
  if (estado.fim) throw new Error('a partida já acabou')
  const n = estado.n
  const entrada = Array.from({ length: n }, (_, j) => (joga(estado, j) ? idDaJogada(jogadas[j]) : null))
  entrada.forEach((id, j) => {
    const v = podeJogar(estado, j, id)
    if (!v.ok) throw new Error(`jogada inválida do ${estado.jogadores[j].id}: ${v.motivo}`)
  })
  const eventos = []
  const efeitos = Array.from({ length: n }, novoEfeito)
  const alvos = estado.alvos

  // 1. paga e descarta
  const cartas = entrada.map((id, j) => {
    const jog = estado.jogadores[j]
    if (id === null) {
      if (joga(estado, j)) {
        jog.energia = Math.min(ENERGIA.maxima, jog.energia + ENERGIA.passar)
        efeitos[j].energia += ENERGIA.passar
        eventos.push(`${jog.id} passou a vez`)
      }
      return null
    }
    const carta = descartar(jog.baralho, id)
    jog.energia -= carta.custo
    eventos.push(`${jog.id} jogou ${carta.nome}`)
    return carta
  })
  const especiais = cartas.map(especialDaCarta)

  // 2. anular: o alvo de a jogou Anular -> a carta de a não vale
  const anulada = cartas.map((c, a) => Boolean(c) && alvos[a] != null && especiais[alvos[a]] === 'anular' && Boolean(cartas[alvos[a]]) && !ehSuper(c))
  const valendo = (j) => (cartas[j] && !anulada[j] ? cartas[j] : null)

  // 3. suporte
  for (let j = 0; j < n; j++) {
    const carta = valendo(j)
    if (!carta) continue
    const jog = estado.jogadores[j]
    const q = carta.naipe === 'copas' && Number.isInteger(opcoes.apoio?.[j]) ? opcoes.apoio[j] : j
    const quem = estado.jogadores[q]
    if (q !== j) efeitos[j].apoiou = q
    if (especiais[j] === 'segundaChance') {
      const cura = curar(estado, q, Math.round(quem.hpMax * PVP.segundaChance))
      quem.protegido = true
      efeitos[j].cura += cura
      efeitos[j].segundaChance = true
      continue
    }
    const sup = carta.naipe === 'copas' ? efeitosDaCarta(carta) : null
    if (!sup) continue
    if (sup.cura) efeitos[j].cura += curar(estado, q, sup.cura)
    if (sup.escudo) {
      quem.escudo = Math.min(quem.escudo ?? 1, sup.escudo)
      efeitos[j].escudo = quem.escudo
    }
    if (sup.energia) {
      const antes = jog.energia
      jog.energia = Math.min(ENERGIA.maxima, jog.energia + sup.energia)
      efeitos[j].energia += jog.energia - antes
    }
    if (sup.compra) efeitos[j].compradas.push(...comprar(jog.baralho, sup.compra).map((c) => c.id))
  }

  // 4. ataques: sai[a] = o que a manda para o alvo dele
  const sai = Array(n).fill(null)
  for (let a = 0; a < n; a++) {
    const carta = valendo(a)
    if (alvos[a] == null || !mandaAtaque(carta) || especiais[a] === 'espelho') continue
    sai[a] = montarCaixa(carta, a, false)
  }
  for (let a = 0; a < n; a++) {
    const carta = valendo(a)
    if (alvos[a] == null || !mandaAtaque(carta) || especiais[a] !== 'espelho') continue
    const p = atacanteDe(estado, a)
    const doOutro = p >= 0 ? valendo(p) : null
    if (doOutro && mandaAtaque(doOutro) && especiais[p] !== 'espelho' && !ehSuper(doOutro)) {
      sai[a] = montarCaixa(doOutro, a, true, p) // passa adiante: o ataque de p vai para o alvo de a
      sai[p] = null
      eventos.push(`${estado.jogadores[a].id} passou adiante ${doOutro.nome}`)
    } else sai[a] = montarCaixa(carta, a, false) // eco
  }
  const caixas = Array(n).fill(null)
  sai.forEach((caixa, a) => caixa && (caixas[alvos[a]] = caixa))

  // 5. morte súbita e escudo de quem recebe
  const forte = estado.rodada >= FFA.morteSubita
  caixas.forEach((caixa, j) => {
    if (!caixa) return
    const fator = (forte ? FFA.fatorMorteSubita : 1) * (opcoes.fatorDano?.[caixa.de] ?? 1)
    if (fator !== 1) caixa.dano = Math.ceil(caixa.dano * fator)
    const jog = estado.jogadores[j]
    if (jog.escudo == null) return
    caixa.escudo = jog.escudo
    caixa.dano = Math.max(1, Math.ceil(caixa.dano * jog.escudo))
    jog.escudo = null
  })

  // 6. roubo do alvo
  for (let j = 0; j < n; j++) {
    if (!valendo(j) || especiais[j] !== 'roubo' || alvos[j] == null) continue
    const roubada = roubar(estado, j, alvos[j])
    efeitos[j].roubou = roubada?.id ?? null
    efeitos[alvos[j]].perdeu = roubada?.id ?? null
  }

  estado.fase = 'esquiva'
  const resultado = {
    rodada: estado.rodada,
    alvos: [...alvos],
    morteSubita: forte,
    jogadas: cartas.map((c, j) => ({ carta: c, especial: especiais[j], anulada: anulada[j], passou: !c, super: ehSuper(c), fora: !joga(estado, j) })),
    caixas,
    efeitos,
    eventos,
  }
  estado.historico.push({ rodada: estado.rodada, alvos: [...alvos], cartas: cartas.map((c) => c?.id ?? null), caixas: caixas.map((c) => (c ? { carta: c.carta.id, de: c.de, dano: c.dano } : null)) })
  if (estado.historico.length > 40) estado.historico.shift()
  return resultado
}

function roubar(estado, j, de) {
  const vitima = estado.jogadores[de].baralho
  if (!vitima.mao.length) return null
  const alvo = vitima.mao[inteiro(estado.rng, 0, vitima.mao.length - 1)]
  const carta = tirarDaMao(vitima, alvo.id)
  const ladrao = estado.jogadores[j].baralho
  const usados = new Set([...ladrao.monte, ...ladrao.mao, ...ladrao.descarte].map((c) => c.id))
  let id = carta.id
  for (let k = 1; usados.has(id); k++) id = `${carta.id}~r${k}`
  const nova = { ...carta, id }
  if (ladrao.mao.length < MAO.maxima) ladrao.mao.push(nova)
  else ladrao.descarte.push(nova)
  return nova
}

// Um acerto no coração de j vindo da caixa de `de` (o dano já vem com escudo e morte súbita). Devolve o
// dano efetivo (o Ás de copas segura em 1 HP). Eliminado não leva mais nada
export function aplicarDanoFfa(estado, j, dano, de = null) {
  const jog = estado.jogadores[j]
  if (jog.eliminado) return 0
  const efetivo = aplicarDano(estado, j, dano)
  jog.danoRecebido += efetivo
  if (de != null && de !== j && estado.jogadores[de]) estado.jogadores[de].danoCausado += efetivo
  return efetivo
}

// Quem está SEM CONEXÃO não esquiva: o ataque que vinha para ele vale como FFA.acertosAusente acertos
// (menos o que ele já levou nesta rodada antes de cair). Devolve o dano efetivo
export function danoAusente(caixa) {
  return caixa ? caixa.dano * FFA.acertosAusente : 0
}

export function aplicarAusente(estado, j, caixa, jaLevou = 0) {
  const falta = Math.max(0, danoAusente(caixa) - jaLevou)
  return falta ? aplicarDanoFfa(estado, j, falta, caixa.de) : 0
}

// Eliminado agora (lote próprio: a colocação vale "neste momento"). motivo 'ko' | 'saiu'
export function eliminarFfa(estado, j, motivo = 'ko', ordem = null) {
  const jog = estado.jogadores[j]
  if (jog.eliminado) return false
  jog.eliminado = { rodada: estado.rodada, ordem: ordem ?? ++estado.eliminacoes, motivo }
  jog.ausente = false
  jog.escudo = null
  return true
}

// Fim da esquiva (o host): quem zerou o HP sai (todos da rodada no MESMO lote) e a partida acaba com 1
// vivo (ou 0: os últimos caíram juntos) ou no limite de rodadas
export function fimDaRodadaFfa(estado) {
  for (const jog of estado.jogadores) jog.protegido = false
  const caidos = vivos(estado).filter((j) => estado.jogadores[j].hp <= 0)
  if (caidos.length) {
    const ordem = ++estado.eliminacoes
    for (const j of caidos) eliminarFfa(estado, j, 'ko', ordem)
  }
  const restam = vivos(estado)
  let fim = null
  if (restam.length <= 1) fim = 'ko'
  else if (estado.rodada >= FFA.limiteRodadas) fim = 'limite'
  estado.fim = fim
  estado.fase = fim ? 'fim' : 'inicio'
  if (fim) estado.vencedor = classificacao(estado)[0]
  return { eliminados: caidos, fim, restam }
}

// A classificação final, do 1º ao último: quem caiu DEPOIS fica na frente (vivo = na frente de todos);
// empate (o mesmo lote, ou os vivos no limite) pelo HP que sobrou, depois o dano causado, depois o menor
// dano recebido e por último a vaga (a ordem é sempre estrita: o servidor recebe uma permutação)
export function classificacao(estado) {
  const chave = (j) => {
    const jog = estado.jogadores[j]
    return [jog.eliminado ? jog.eliminado.ordem : Infinity, Math.max(0, jog.hp), jog.danoCausado, -jog.danoRecebido, -j]
  }
  return estado.jogadores
    .map((_, j) => j)
    .sort((a, b) => {
      const ka = chave(a)
      const kb = chave(b)
      for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]
      return 0
    })
}

// a colocação (1..n) de cada vaga
export const colocacoes = (estado) => {
  const ordem = classificacao(estado)
  return estado.jogadores.map((_, j) => ordem.indexOf(j) + 1)
}

// o texto do rodízio da rodada: "ANA → BETO · BETO → CAIO · CAIO → ANA"
export function textoDosAlvos(alvos, nome) {
  return alvos.map((alvo, j) => (alvo == null ? null : `${nome(j)} → ${nome(alvo)}`)).filter(Boolean).join(' · ')
}
