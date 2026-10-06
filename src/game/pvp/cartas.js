// Cartas do modo PvP e o mapeamento carta -> ataque. Lógica pura: este
// arquivo NÃO importa attacks/ (que puxa Phaser/áudio); quem chama passa a
// biblioteca de ataques em `contexto.ataques` (no jogo, use ataquesDasCartas.js).
//
// Formato da carta (o visual e as regras contam com exatamente estes campos):
//   { id, personagem, naipe, valor, nome, descricao, custo }
//   naipe: 'espadas' | 'copas' | 'ouros' | 'paus'
//   valor: 1..14 (1 = Ás, 11 = J, 12 = Q, 13 = K, 14 = SUPER)
//   id:    '<personagem>-<naipe>-<valor>' (ex.: 'kris-espadas-7')
//
// Naipe = tipo de carta:
//   ♠ espadas  ataque direto (mais dano por bala)
//   ♦ ouros    controle: balas mais rápidas (ritmo), caixa menor, controles invertidos (Q/K)
//   ♣ paus     armadilha: bombas, lasers, colunas, ondas, forcado
//   ♥ copas    suporte para QUEM JOGA (cura, escudo, energia, compra extra);
//              manda só um ataque fraquinho para o adversário
// Valor = força: quanto maior, mais rápido, denso e longo (4 a 7 s) e mais dano.
// Ás = carta especial (um por naipe em todo baralho; ver ESPECIAIS e regras.js).
// SUPER (valor 14, ★) = uma por baralho: ataque exclusivo do personagem, custa 10
// (a energia máxima), imparável (♦ Anular não cancela, ♠ Espelho não reflete).

// ---------- tabelas gerais ----------

export const NAIPES = ['espadas', 'copas', 'ouros', 'paus']
export const SIMBOLOS = { espadas: '♠', copas: '♥', ouros: '♦', paus: '♣' }
export const PERSONAGENS_PVP = ['kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel']

// Custo em energia por valor: 2-4 barato, 5-8 médio, 9-10/J alto, Q/K muito alto, Ás especial
export const CUSTOS = { 1: 3, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2, 8: 2, 9: 3, 10: 3, 11: 3, 12: 4, 13: 5, 14: 10 }
export const custoDoValor = (valor) => CUSTOS[valor] ?? 99

export function nomeDoValor(valor) {
  return { 1: 'A', 11: 'J', 12: 'Q', 13: 'K', 14: '★' }[valor] ?? String(valor)
}

// Carta SUPER: uma por baralho (id '<personagem>-espadas-14'), sai na compra normal.
// Custa a energia máxima e é imparável (ver resolverRodada em regras.js).
export const SUPER = { valor: 14, custo: 10 }
export function ehSuper(carta) {
  return carta?.valor === SUPER.valor
}
// Dano por bala do SUPER (já com DIFICULDADE_PVP.dano; o mesmo de um K♠)
const DANO_SUPER = 13
// Cada SUPER tem 3 fases de FASE_SUPER ms ativos (~9 s no total, mais os respiros)
const FASE_SUPER = 3000
const fs = (o = {}) => ({ duracao: FASE_SUPER, ...o })

// Os quatro Ases especiais (mesmo efeito em todo personagem, nome temático muda)
//   espelho          ♠ o ataque que o adversário jogou volta para a caixa DELE
//                      (sem nada para refletir: manda um "eco", ataque de espadas de força 7)
//   anular           ♦ cancela a carta do adversário inteira (ataque, suporte e especial)
//                      e manda um ataque leve de ouros (força 5)
//   roubo            ♣ depois da rodada, rouba 1 carta sorteada da mão do adversário
//                      (ela passa a ser sua) e manda um ataque leve de paus (força 5)
//   segundaChance    ♥ cura 25% do HP máximo e, nesta rodada, o HP não passa de 1
//                      (não dá para perder na rodada em que foi jogada); não manda ataque
const ESPECIAIS = { espadas: 'espelho', ouros: 'anular', paus: 'roubo', copas: 'segundaChance' }
export const especialDaCarta = (carta) => (carta?.valor === 1 ? ESPECIAIS[carta.naipe] : null)

// Força usada pelo ataque que o Ás manda (eco do espelho, anular, roubo)
const VALOR_DO_ESPECIAL = { espelho: 7, anular: 5, roubo: 5 }

// Dificuldade geral do PvP (vale para TODAS as cartas, em cima do valor).
//   forcaMinima   piso da força: a carta 2 já ataca como se fosse mais alta
//                 (o teto continua 1, a força do K, que passou sem avisos de justiça)
//   dano          multiplica o dano por bala de todo ataque
//   velocidade    multiplicam o ritmo de todo ataque; 1,15 e 1,2 são o mesmo
//   densidade     aperto (DESAFIO) do co-op, com o qual as 134 cartas já foram validadas
// Tudo neutro (0, 1, 1, 1) = as cartas como eram antes.
export const DIFICULDADE_PVP = { forcaMinima: 0.3, dano: 1.3, velocidade: 1.15, densidade: 1.2 }

// 0 (valor 2) .. 1 (K): fração da força usada para escalar os ataques (com o piso de DIFICULDADE_PVP)
export const forca = (valor) => {
  const base = Math.min(1, Math.max(0, (valor - 2) / 11))
  const piso = DIFICULDADE_PVP.forcaMinima
  return piso + (1 - piso) * base
}

// ---------- efeitos de copas ----------

// Quanto cada efeito de copas vale, pelo valor da carta
const EFEITOS_COPAS = {
  cura: (v) => ({ cura: Math.round(4 + v * 1.5) }), // 2 -> 7 HP, 10 -> 19, K -> 24
  escudo: (v) => ({ escudo: v <= 6 ? 0.6 : v <= 10 ? 0.5 : 0.35 }), // fator do dano do próximo ataque recebido
  energia: (v) => ({ energia: v <= 6 ? 1 : v <= 10 ? 2 : 3 }),
  compra: (v) => ({ compra: v <= 8 ? 1 : 2 }),
}

function textoEfeitos(efeitos) {
  const partes = []
  if (efeitos.cura) partes.push(`cura ${efeitos.cura} HP`)
  if (efeitos.escudo) partes.push(`o próximo ataque que você receber causa ${Math.round(efeitos.escudo * 100)}% do dano`)
  if (efeitos.energia) partes.push(`+${efeitos.energia} de energia`)
  if (efeitos.compra) partes.push(`compra ${efeitos.compra} carta${efeitos.compra > 1 ? 's' : ''} extra`)
  return partes.join('; ')
}

import { P, TEXTOS } from './padroes.js'
import { BARALHOS } from './baralhos/index.js'

// ---------- montagem das cartas ----------

const TEXTO_ESPECIAL = {
  espelho: 'ESPECIAL: o ataque que o adversário jogou volta para a caixa dele. Sem nada para refletir, manda um eco.',
  anular: 'ESPECIAL: cancela a carta do adversário (ataque, suporte e especial) e manda um ataque leve.',
  roubo: 'ESPECIAL: rouba uma carta sorteada da mão do adversário e manda um ataque leve.',
  segundaChance: 'ESPECIAL: cura 25% do HP máximo e você não pode cair nesta rodada (fica com 1 HP). Não manda ataque.',
}

// Detalhes internos de cada carta (não fazem parte do formato da carta)
const DETALHES = {}

const idDe = (personagem, naipe, valor) => `${personagem}-${naipe}-${valor}`

function montar(personagem) {
  const def = BARALHOS[personagem]
  const normais = def.cartas.map(([naipe, valor, nome, receita, extras = {}]) => {
    const id = idDe(personagem, naipe, valor)
    const especial = valor === 1 ? ESPECIAIS[naipe] : null
    let descricao
    let efeitos = null
    if (especial) {
      descricao = TEXTO_ESPECIAL[especial]
    } else if (naipe === 'copas') {
      efeitos = Object.assign({}, ...receita.map((e) => EFEITOS_COPAS[e](valor)))
      descricao = `Suporte: ${textoEfeitos(efeitos)}. Manda só um ataque fraquinho.`
    } else {
      const texto = def.receitas[receita]?.texto ?? TEXTOS[receita]
      if (!texto) throw new Error(`carta ${id}: receita desconhecida "${receita}"`)
      descricao = `${texto}.`
      if (extras.inverter) descricao += ' Inverte os controles do adversário durante o ataque todo.'
    }
    DETALHES[id] = { receita: especial ? null : naipe === 'copas' ? null : receita, efeitos, especial, inverter: extras.inverter ?? 0 }
    return { id, personagem, naipe, valor, nome, descricao, custo: custoDoValor(valor) }
  })
  // a carta SUPER entra no baralho como as outras
  const id = idDe(personagem, 'espadas', SUPER.valor)
  DETALHES[id] = { receita: null, efeitos: null, especial: null, inverter: 0, super: true }
  const superCarta = { id, personagem, naipe: 'espadas', valor: SUPER.valor, nome: def.super.nome, descricao: `SUPER: ${def.super.texto}. Imparável: não pode ser anulada nem refletida.`, custo: SUPER.custo }
  return [...normais, superCarta]
}

export const CARTAS = Object.fromEntries(Object.keys(BARALHOS).map((p) => [p, montar(p)]))
export const TEMAS = Object.fromEntries(Object.entries(BARALHOS).map(([p, def]) => [p, def.tema]))
export const HP_RESERVA = Object.fromEntries(Object.entries(BARALHOS).map(([p, def]) => [p, def.hp]))

// { nome, descricao, cor } da carta SUPER do personagem (cor = cor do tema do baralho)
export function superDoPersonagem(personagem) {
  const carta = CARTAS[personagem]?.find(ehSuper)
  if (!carta) throw new Error(`personagem sem baralho: ${personagem}`)
  return { nome: carta.nome, descricao: carta.descricao, cor: BARALHOS[personagem].tema.cor }
}

export function cartasDoPersonagem(personagem) {
  const lista = CARTAS[personagem]
  if (!lista) throw new Error(`personagem sem baralho: ${personagem}`)
  return lista.map((c) => ({ ...c }))
}

// Detalhes de uma carta pelos campos (vale também para cópias com id trocado, ex. carta roubada)
function detalhesDaCarta(carta) {
  return DETALHES[idDe(carta.personagem, carta.naipe, carta.valor)] ?? null
}

// Efeitos de copas da carta ({ cura?, escudo?, energia?, compra? }) ou null
export function efeitosDaCarta(carta) {
  return detalhesDaCarta(carta)?.efeitos ?? null
}

// ---------- carta -> ataque ----------

// Dano de cada bala do ataque da carta (antes do escudo de quem recebe)
//   com DIFICULDADE_PVP.dano 1,3: espadas 4..13, paus 4..12, ouros 4..10, copas 3, SUPER 13
export function danoDaCarta(carta) {
  if (ehSuper(carta)) return DANO_SUPER
  const especial = especialDaCarta(carta)
  const valor = especial ? VALOR_DO_ESPECIAL[especial] ?? 0 : carta.valor
  const naipe = especial === 'espelho' ? 'espadas' : carta.naipe
  if (!valor) return 0
  if (naipe === 'copas') return Math.round(2 * DIFICULDADE_PVP.dano)
  const porValor = { espadas: 0.6, paus: 0.55, ouros: 0.45 }[naipe]
  return Math.round((2 + valor * porValor) * DIFICULDADE_PVP.dano)
}

// Multiplicadores de ritmo do ataque (ouros deixa as balas mais rápidas)
// (todas levam o aperto de DIFICULDADE_PVP; ouros ainda acelera até 20% em cima)
export function ritmoDaCarta(carta) {
  const { velocidade, densidade } = DIFICULDADE_PVP
  if (carta.naipe !== 'ouros') return { velocidade, densidade }
  const valor = carta.valor === 1 ? VALOR_DO_ESPECIAL.anular : carta.valor
  return { velocidade: Math.round(velocidade * (1 + 0.2 * forca(valor)) * 100) / 100, densidade }
}

// ms de controles invertidos que o ataque causa na caixa de quem recebe
export function inverterDaCarta(carta) {
  return detalhesDaCarta(carta)?.inverter ?? 0
}

// Ataque (da linguagem de attacks/) que a carta manda para a caixa do adversário.
//   contexto.ataques     biblioteca de attacks/index.js (obrigatória; injetada para testar em Node)
//   contexto.caixaFixa   true: ignora as mudanças de caixa dos padrões (caixa sempre a padrão)
// Devolve null quando a carta não manda ataque (Ás de copas).
export function ataqueDaCarta(carta, contexto = {}) {
  const A = contexto.ataques
  if (!A) throw new Error('ataqueDaCarta: passe contexto.ataques (attacks/index.js)')
  const def = BARALHOS[carta.personagem]
  const det = detalhesDaCarta(carta)
  if (!def || !det) throw new Error(`carta desconhecida: ${carta.id}`)

  let ataque
  if (det.especial === 'segundaChance') return null
  if (det.super) {
    ataque = def.super.criar(A)
  } else if (det.especial) {
    const naipe = det.especial === 'espelho' ? 'espadas' : carta.naipe
    ataque = criarReceita(A, def, def.principal[naipe], forca(VALOR_DO_ESPECIAL[det.especial]))
  } else if (carta.naipe === 'copas') {
    ataque = def.leve(A)
  } else {
    ataque = criarReceita(A, def, det.receita, forca(carta.valor))
  }
  return contexto.caixaFixa ? A.comCaixa(null, ataque) : ataque
}

function criarReceita(A, def, chave, t) {
  const propria = def.receitas[chave]
  if (propria) return propria.criar(A, t)
  return P[chave](A, t)
}

// Tudo que a caixa do adversário precisa para rodar a carta, num objeto
// simples (o ataque em si é montado com ataqueDaCarta na hora de rodar)
export function resumoDoAtaque(carta) {
  return { dano: danoDaCarta(carta), ritmo: ritmoDaCarta(carta), inverterMs: inverterDaCarta(carta) }
}
