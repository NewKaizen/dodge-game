// DESAFIO DIÁRIO (Fase 4A, docs/desafio-diario.md): o dia, a definição do desafio de cada dia, os
// pontos e o cosmético da semana. Lógica pura, igual no servidor e no navegador. O relógio que vale é
// SEMPRE o do servidor (o navegador só mostra o que o servidor mandou e conta o tempo que falta).
//
//   diaDoDesafio(ms)        { id: 'AAAA-MM-DD', numero, semana: 'AAAA-Sxx', inicio, fim, restanteMs }
//                           (vira à meia-noite de America/Sao_Paulo, a mesma regra do XP e do semanal)
//   desafioDoDia(id)        a definição do dia: { id, versao, semente, personagem, chefe, nivel, aliado,
//                           regra, modificador, nome, ... } (mesma para todo mundo; null se o id não serve)
//   faseDoDesafio(def)      a "fase" no formato da campanha (campanha/luta.js) para o servidor rodar
//   pontosDoDesafio(r)      os pontos de uma corrida (o servidor calcula com o que ELE viu)
//   cosmeticoDaSemana(sem)  { id, tipo, nome, cor, semana, diario: true } o cosmético raro da semana
//   cosmeticoDoId(id)       o mesmo, a partir do id (null se não for do desafio)
//
// Mudou a versão (VERSAO_DESAFIO) = muda o desafio de todos os dias dali em diante (a semente leva a
// versão). Os números do XP também estão no banco (0013_desafio_diario.sql): mude os dois.
import { semanaDe, semanaDoId, diaLocal, inicioDoDia, DIA_MS } from './semanal.js'

export const VERSAO_DESAFIO = 1
export const XP_DESAFIO = 60 // a recompensa principal: uma vez por dia, na primeira vitória
export const DIAS_COSMETICO_SEMANA = 4 // dias com o desafio vencido na semana (seg–dom) para o cosmético
export const MAX_AMIGOS_RECORDE = 20

const dois = (n) => String(n).padStart(2, '0')
export const ID_DIA = /^(\d{4})-(\d{2})-(\d{2})$/

// ---------- o dia ----------

const idDoNumero = (numero) => {
  const d = new Date(numero * DIA_MS)
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`
}
export function numeroDoDia(id) {
  const m = ID_DIA.exec(String(id ?? ''))
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const numero = t / DIA_MS
  return idDoNumero(numero) === id ? numero : null
}

export function diaDoDesafio(ms = Date.now()) {
  const numero = diaLocal(ms)
  const inicio = inicioDoDia(numero)
  const fim = inicioDoDia(numero + 1)
  return { id: idDoNumero(numero), numero, semana: semanaDe(ms).id, inicio, fim, restanteMs: Math.max(0, fim - ms) }
}

// a semana ISO (segunda a domingo) do dia
export function semanaDoDia(id) {
  const numero = numeroDoDia(id)
  return numero == null ? null : semanaDe(inicioDoDia(numero) + 12 * 3_600_000).id
}

// ---------- o sorteio do dia ----------

function rngDe(texto) {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619) >>> 0
  let s = h
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const escolher = (rng, lista) => lista[Math.floor(rng() * lista.length)]

// quem você joga (o baralho é o dele) e quem pode ser a CPU aliada
export const PERSONAGENS_DESAFIO = ['kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel']
// os chefes cujos ataques o servidor refaz (os da campanha; o titã fica de fora)
export const CHEFES_DESAFIO = ['c_ralsei', 'c_noelle', 'c_berdly', 'c_susie', 'c_dess']
// as regras da campanha que valem para qualquer baralho (campanha/luta.js)
export const REGRAS_DESAFIO = [
  { id: 'nenhuma', regra: {}, texto: '' },
  { id: 'encolhe', regra: { caixaEncolhe: 0.05 }, texto: 'O quadro encolhe a cada rodada.' },
  { id: 'eco', regra: { eco: true }, texto: 'Tudo ecoa: o ataque do chefe vem com o ataque leve dele junto.' },
  { id: 'sem_energia', regra: { energiaInicial: 0 }, texto: 'Você começa sem energia.' },
]
// os modificadores do dia (campanha/luta.js; a escuridão é só desenho: o servidor não precisa dela)
export const MODIFICADORES = {
  veloz: { nome: 'VELOZ', texto: 'Os ataques vêm 20% mais rápidos.', velocidade: 1.2 },
  denso: { nome: 'DENSO', texto: 'Os ataques têm 20% mais balas.', densidade: 1.2 },
  por_um_fio: { nome: 'POR UM FIO', texto: 'Você começa com metade do HP.', vida: 0.5 },
  escuridao: { nome: 'ESCURIDÃO', texto: 'O quadro fica no escuro: só a luz em volta do coração.', escuro: true },
}
export const IDS_MODIFICADOR = Object.keys(MODIFICADORES)

const NOMES_DIA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

export function desafioDoDia(id) {
  const numero = numeroDoDia(id)
  if (numero == null) return null
  const semente = `desafio:v${VERSAO_DESAFIO}:${id}`
  const rng = rngDe(semente)
  const personagem = escolher(rng, PERSONAGENS_DESAFIO)
  const chefe = escolher(rng, CHEFES_DESAFIO)
  const aliado = rng() < 0.6 ? escolher(rng, PERSONAGENS_DESAFIO.filter((p) => p !== personagem)) : null
  const regra = escolher(rng, REGRAS_DESAFIO)
  // sozinho(a) é mais duro: sem POR UM FIO e sempre no fácil (medido em docs/desafio-diario.md)
  const modificador = escolher(rng, aliado ? IDS_MODIFICADOR : IDS_MODIFICADOR.filter((m) => m !== 'por_um_fio'))
  // com aliada, um em cada três dias é no nível médio (os outros, fácil): nunca o difícil
  const nivel = aliado && rng() < 1 / 3 ? 'medio' : 'facil'
  const semana = (((numero + 3) % 7) + 7) % 7
  return {
    id,
    versao: VERSAO_DESAFIO,
    semente,
    personagem,
    chefe,
    nivel,
    aliado,
    regra: regra.id,
    modificador,
    metaRodadas: 12,
    nome: `Desafio de ${NOMES_DIA[semana]}`,
  }
}

// o texto das regras do dia (na tela)
export function descreverDesafio(def) {
  if (!def) return []
  const linhas = []
  const r = REGRAS_DESAFIO.find((x) => x.id === def.regra)
  if (r?.texto) linhas.push(r.texto)
  const m = MODIFICADORES[def.modificador]
  if (m) linhas.push(`${m.nome}: ${m.texto}`)
  return linhas
}

// a "fase" no formato da campanha (mundos/mundo1.js) para campanha/luta.js
export function faseDoDesafio(def) {
  const r = REGRAS_DESAFIO.find((x) => x.id === def.regra)?.regra ?? {}
  const m = MODIFICADORES[def.modificador] ?? {}
  return {
    n: 0,
    id: 'desafio',
    nome: def.nome,
    oponente: null,
    inimigo: def.chefe,
    nivel: def.nivel,
    aliado: def.aliado,
    metaRodadas: def.metaRodadas,
    regra: { ...r },
    modificador: { velocidade: m.velocidade ?? 1, densidade: m.densidade ?? 1, vida: m.vida ?? 1, escuro: Boolean(m.escuro) },
  }
}

// o que chegou do servidor, limpo: só vale se for exatamente o desafio daquele dia
export function lerDesafio(m) {
  if (!m || typeof m !== 'object') return null
  const def = desafioDoDia(m.id)
  if (!def || m.versao !== def.versao) return null
  return def
}

// ---------- pontos ----------

// os pontos de uma corrida, com o que o SERVIDOR viu (dano no chefe, acertos refeitos, grazes, HP)
//   { vitoria, rodadas, acertos, grazes, perfeitos, hpFracao, chefeFracao }
export function pontosDoDesafio({ vitoria = false, rodadas = 0, acertos = 0, grazes = 0, perfeitos = 0, hpFracao = 0, chefeFracao = 0 } = {}) {
  const lim = (x, a, b) => Math.min(b, Math.max(a, Number(x) || 0))
  let p = Math.round(500 * lim(chefeFracao, 0, 1))
  if (vitoria) p += 1000 + Math.round(400 * lim(hpFracao, 0, 1)) + 25 * Math.max(0, 15 - lim(rodadas, 0, 99))
  p += 30 * lim(perfeitos, 0, 99) + 2 * lim(grazes, 0, 200) - 10 * lim(acertos, 0, 999)
  return Math.max(0, Math.round(p))
}

// ---------- o cosmético da semana ----------

const TIPOS = ['verso', 'moldura', 'titulo']
const NOMES = {
  verso: ['Alvorada', 'Ampulheta', 'Calendário de Bolso'],
  moldura: ['Aurora', 'Meio-Dia', 'Crepúsculo'],
  titulo: ['Bom Dia, Mesa', 'Relógio Interno', 'Sol de Toda Manhã'],
}
const CORES = { verso: ['#3a1f0a', '#1f2a3a', '#2a0f2f'], moldura: ['#ff9f5a', '#ffe36a', '#b36aff'] }
const ID_COSMETICO = /^(titulo|moldura|verso)\.diario_(\d{4})_(\d{2})$/

export function cosmeticoDaSemana(semanaId) {
  const s = semanaDoId(semanaId)
  if (!s) return null
  const k = ((s.indice % 9) + 9) % 9
  const tipo = TIPOS[k % 3]
  const variante = Math.floor(k / 3)
  return { id: `${tipo}.diario_${s.ano}_${dois(s.numero)}`, tipo, nome: `${NOMES[tipo][variante]} S${dois(s.numero)}/${String(s.ano).slice(2)}`, cor: CORES[tipo]?.[variante] ?? null, semana: s.id, diario: true }
}
export const ehCosmeticoDiario = (id) => ID_COSMETICO.test(String(id ?? ''))
export function cosmeticoDoId(id) {
  const m = ID_COSMETICO.exec(String(id ?? ''))
  if (!m) return null
  const c = cosmeticoDaSemana(`${m[2]}-S${m[3]}`)
  return c?.id === id ? c : null
}
