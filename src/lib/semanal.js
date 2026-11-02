// BOSS SEMANAL (Fase 4E, docs/boss-semanal.md): a semana, a agenda dos chefes e o troféu
// exclusivo de cada semana. Lógica pura, igual no servidor e no navegador (testada em
// src/lib/__tests__/semanal.test.js). O relógio que vale é SEMPRE o do servidor: o navegador
// só mostra o que o servidor mandou (bemvindo.semanal, sala.semanal) e conta o tempo que falta.
//
//   semanaDe(ms)           { id: 'AAAA-Sxx', indice, inicio, fim } da semana que contém o instante
//                          (vira na segunda 00:00 de America/Sao_Paulo, com ou sem horário de verão)
//   chefeDaSemana(indice)  AGENDA[indice % AGENDA.length]
//   trofeuDaSemana(sem)    { id, tipo, nome, cor, semana, chefe, exclusivo: true } (único daquela semana)
//   trofeuDoId(id)         o mesmo, a partir do id (null se não for troféu semanal)
//   infoSemanal(ms)        { semana, indice, chefe, mecanica, trofeu, termina, restanteMs } (o que o servidor manda)
//   textoRestante(ms)      '3d 04h' · '05h 12m' · '12m 03s'
//
// A semana 0 da agenda é a que começa na segunda 2026-11-02 (ESCURIDÃO); a 1 é a LADRA DE CARTAS e
// assim por diante. Para pôr mais chefes, acrescente o id no fim de AGENDA (e o troféu em TROFEUS):
// as semanas que já passaram não mudam de troféu, porque o troféu leva a semana no id.
export const FUSO = 'America/Sao_Paulo'
export const AGENDA = ['escuridao', 'ladra']
export const DIA_MS = 86_400_000
const SEGUNDA_REFERENCIA = Date.UTC(2026, 10, 2) / DIA_MS // 2026-11-02 (dia número, local)
const TIPOS_TROFEU = ['titulo', 'moldura', 'verso']

// nome do chefe, a mecânica em até 6 palavras e os troféus (nome por tipo; cor das molduras/versos)
export const SEMANAIS = {
  escuridao: { nome: 'Escuridão', mecanica: 'desvie pelo som, no escuro', cor: '#8a7cff', trofeus: { titulo: 'Ouvido Absoluto', moldura: 'Breu', verso: 'Eclipse' }, cores: { moldura: '#8a7cff', verso: '#0d0a24' } },
  ladra: { nome: 'Ladra de Cartas', mecanica: 'ela rouba e joga suas cartas', cor: '#ff7a3d', trofeus: { titulo: 'Mão Leve', moldura: 'Cofre', verso: 'Baralho Roubado' }, cores: { moldura: '#ff9a3d', verso: '#3a1608' } },
}

// ---------- calendário no fuso ----------

let formato = null
function partesLocais(ms) {
  formato ??= new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  const p = Object.fromEntries(formato.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return { ano: Number(p.year), mes: Number(p.month), dia: Number(p.day), hora: Number(p.hour) % 24, minuto: Number(p.minute), segundo: Number(p.second) }
}
// dia número (dias desde 1970-01-01) da data local do instante
const diaLocal = (ms) => {
  const p = partesLocais(ms)
  return Date.UTC(p.ano, p.mes - 1, p.dia) / DIA_MS
}
// a diferença do relógio local para o UTC naquele instante (ms)
const desvio = (ms) => {
  const p = partesLocais(ms)
  return Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo) - Math.floor(ms / 1000) * 1000
}
// segunda = 0 ... domingo = 6 (1970-01-01 foi quinta)
const diaDaSemana = (dia) => (((dia + 3) % 7) + 7) % 7

// o primeiro instante do dia local `dia` (meia-noite; se a meia-noite não existe por causa de
// um horário de verão que pula 00:00 -> 01:00, o primeiro instante que existe naquele dia)
export function inicioDoDia(dia) {
  const utc = dia * DIA_MS
  let t = utc - desvio(utc)
  t = utc - desvio(t)
  // caiu no dia anterior (meia-noite pulada): anda até entrar no dia
  for (let i = 0; i < 4 && diaLocal(t) < dia; i++) {
    const p = partesLocais(t)
    t += ((24 - p.hora) * 60 - p.minuto) * 60_000 - p.segundo * 1000
  }
  // ainda dá para voltar sem sair do dia (meia-noite repetida): o primeiro instante
  while (diaLocal(t - 3_600_000) === dia) t -= 3_600_000
  return t
}

// semana ISO (segunda a domingo) do dia local
function semanaIso(segunda) {
  const quinta = segunda + 3
  const ano = new Date(quinta * DIA_MS).getUTCFullYear()
  const primeiro = Date.UTC(ano, 0, 1) / DIA_MS
  return { ano, numero: Math.floor((quinta - primeiro) / 7) + 1 }
}
const dois = (n) => String(n).padStart(2, '0')

export function semanaDe(ms) {
  const hoje = diaLocal(ms)
  const segunda = hoje - diaDaSemana(hoje)
  const { ano, numero } = semanaIso(segunda)
  return { id: `${ano}-S${dois(numero)}`, ano, numero, indice: Math.round((segunda - SEGUNDA_REFERENCIA) / 7), segunda, inicio: inicioDoDia(segunda), fim: inicioDoDia(segunda + 7) }
}

// a segunda (dia número) da semana ISO `numero` de `ano`
function segundaDaSemanaIso(ano, numero) {
  const jan4 = Date.UTC(ano, 0, 4) / DIA_MS
  return jan4 - diaDaSemana(jan4) + (numero - 1) * 7
}

export const ID_SEMANA = /^(\d{4})-S(\d{2})$/
export function semanaDoId(id) {
  const m = ID_SEMANA.exec(String(id ?? ''))
  if (!m) return null
  const ano = Number(m[1])
  const numero = Number(m[2])
  if (numero < 1 || numero > 53) return null
  const segunda = segundaDaSemanaIso(ano, numero)
  if (semanaIso(segunda).numero !== numero) return null // semana 53 que o ano não tem
  return { id, ano, numero, indice: Math.round((segunda - SEGUNDA_REFERENCIA) / 7), segunda, inicio: inicioDoDia(segunda), fim: inicioDoDia(segunda + 7) }
}

// ---------- agenda e troféu ----------

const modulo = (n, m) => ((n % m) + m) % m
export const chefeDaSemana = (indice) => AGENDA[modulo(indice, AGENDA.length)]

export function trofeuDaSemana(semana) {
  const chefe = chefeDaSemana(semana.indice)
  const def = SEMANAIS[chefe]
  // cada vez que o chefe volta, o troféu é de outro tipo (título, moldura, verso...), e sempre com a semana no id
  const tipo = TIPOS_TROFEU[modulo(Math.floor(semana.indice / AGENDA.length), TIPOS_TROFEU.length)]
  const nome = `${def.trofeus[tipo]} S${dois(semana.numero)}/${String(semana.ano).slice(2)}`
  return { id: `${tipo}.semanal_${semana.ano}_${dois(semana.numero)}`, tipo, nome, cor: def.cores[tipo] ?? null, semana: semana.id, chefe, exclusivo: true }
}

const ID_TROFEU = /^(titulo|moldura|verso)\.semanal_(\d{4})_(\d{2})$/
export const ehTrofeuSemanal = (id) => ID_TROFEU.test(String(id ?? ''))
export function trofeuDoId(id) {
  const m = ID_TROFEU.exec(String(id ?? ''))
  if (!m) return null
  const semana = semanaDoId(`${m[2]}-S${m[3]}`)
  if (!semana) return null
  const t = trofeuDaSemana(semana)
  return t.id === id ? t : null
}

export function infoSemanal(agora = Date.now()) {
  const s = semanaDe(agora)
  const chefe = chefeDaSemana(s.indice)
  return { semana: s.id, indice: s.indice, chefe, nome: SEMANAIS[chefe].nome, mecanica: SEMANAIS[chefe].mecanica, trofeu: trofeuDaSemana(s), termina: s.fim, restanteMs: Math.max(0, s.fim - agora) }
}

// o que chegou do servidor, limpo (null: não serve)
export function lerInfoSemanal(m) {
  if (!m || typeof m !== 'object' || !ID_SEMANA.test(m.semana) || !SEMANAIS[m.chefe]) return null
  const semana = semanaDoId(m.semana)
  if (!semana || chefeDaSemana(semana.indice) !== m.chefe) return null
  const restanteMs = Math.max(0, Math.min(8 * DIA_MS, Number(m.restanteMs) || 0))
  return { semana: m.semana, indice: semana.indice, chefe: m.chefe, nome: SEMANAIS[m.chefe].nome, mecanica: SEMANAIS[m.chefe].mecanica, trofeu: trofeuDaSemana(semana), restanteMs }
}

export function textoRestante(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d) return `${d}d ${dois(h)}h`
  if (h) return `${dois(h)}h ${dois(m)}m`
  return `${dois(m)}m ${dois(s % 60)}s`
}
