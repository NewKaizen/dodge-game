// EXPEDIÇÃO do CO-OP (docs/coop-cartas.md "Expedição"): 3 lutas seguidas, sem voltar ao menu.
//
//   [1] LACAIOS  ->  escolha  ->  [2] TENENTE  ->  escolha  ->  [3] CHEFÃO
//
// Entre as lutas o time vê 3 cartas de melhoria (relíquias, coop/reliquias.js), cada um vota (←/→ + A), a
// maioria leva (empate: o voto de quem está com MENOS HP; ninguém votou até o relógio acabar: a sugestão da
// CPU) e o time recupera CURA_ENTRE do HP máximo (quem caiu volta com isso). O HP passa de uma luta para a
// outra (criarPartidaCoop({ hp, reliquias })). Caiu numa luta: a expedição acaba ali.
//
// Lógica pura e serializável (JSON): o estado vai nos dados das cenas (e pela rede, com irParaCena). Nada aqui
// usa Math.random: a oferta sai da semente da expedição (igual em todos os PCs).
//
//   criarExpedicao({ chefe, nivel, party, semente })   chefe: 'king' | 'queen' | 'jevil' | 'coronel' | 'sorteada'
//   dadosDaLuta(exp)                                    os dados da CoopArena/CoopArenaN da luta atual
//   terminarLuta(exp, { vitoria, hp, hpMax })           -> exp com fase 'escolha' (oferta pronta) ou 'fim'
//   gerarOferta(semente, no, ja)                        3 ids de relíquia sem repetir (e sem as que o time já tem)
//   resolverVotos(votos, { hp, sugestao })              -> { escolha, motivo: 'maioria' | 'empate' | 'tempo' }
//   votoDaCpu(oferta, { hp })                           o voto da CPU aliada (defesa quando o time está machucado)
//   curaEntreLutas(hp, hpMax)                           -> [hp depois] (+CURA_ENTRE do máx; quem caiu volta com isso)
//   escolherReliquia(exp, id)                           acumula a relíquia, cura e passa para a próxima luta
import { criarRng, aleatorio } from '../pvp/baralho.js'
import { IDS_RELIQUIAS, RELIQUIAS } from './reliquias.js'

export const ETAPAS = ['lacaios', 'tenente', 'chefao']
export const NOME_ETAPA = { lacaios: 'LACAIOS', tenente: 'TENENTE', chefao: 'CHEFÃO' }
export const CHEFOES = ['king', 'queen', 'jevil', 'coronel']
export const SORTEADA = 'sorteada'
// as 3 lutas de cada chefão (ids de coop/chefes/index.js)
export const LUTAS = {
  king: { lacaios: 'kingLacaios', tenente: 'kingTenente', chefao: 'king' },
  queen: { lacaios: 'queenLacaios', tenente: 'queenTenente', chefao: 'queen' },
  jevil: { lacaios: 'jevilLacaios', tenente: 'jevilTenente', chefao: 'jevil' },
  coronel: { lacaios: 'coronelLacaios', tenente: 'coronelTenente', chefao: 'coronel' },
}
export const CURA_ENTRE = 0.35 // o time recupera 35% do HP máximo entre as lutas
export const OFERTA = 3 // cartas por escolha
export const VOTO_MS = 20_000 // o relógio da escolha (acabou: vale o que foi votado, ou a sugestão)

const rngDe = (semente) => {
  const rng = criarRng(semente)
  return () => aleatorio(rng)
}

// A rota da expedição: as 3 lutas (ids) e de que chefão cada uma vem. SORTEADA: os lacaios de um chefão, o
// tenente de outro e um chefão surpresa (os três diferentes), pela semente
export function rotaDa(chefe, semente) {
  if (chefe !== SORTEADA) {
    const c = LUTAS[chefe] ? chefe : 'king'
    return { chefao: c, origem: [c, c, c], lutas: ETAPAS.map((e) => LUTAS[c][e]) }
  }
  const r = rngDe(`${semente}:sorteada`)
  const bolsa = [...CHEFOES]
  const tirar = () => bolsa.splice(Math.floor(r() * bolsa.length), 1)[0]
  const origem = [tirar(), tirar(), tirar()] // lacaios, tenente, chefão
  return { chefao: origem[2], origem, lutas: ETAPAS.map((e, k) => LUTAS[origem[k]][e]) }
}

export function criarExpedicao({ chefe = 'king', nivel = 'facil', party = [], semente = `exp:${Date.now()}` } = {}) {
  const sorteada = chefe === SORTEADA
  const rota = rotaDa(sorteada ? SORTEADA : chefe, semente)
  return {
    v: 1,
    semente: String(semente),
    escolhido: sorteada ? SORTEADA : rota.chefao, // o que o time escolheu no menu
    chefao: rota.chefao, // o chefão da luta final (as recompensas são dele)
    sorteada,
    origem: rota.origem,
    lutas: rota.lutas,
    nivel,
    party: [...party],
    no: 0, // a luta atual (0, 1, 2)
    fase: 'luta', // 'luta' | 'escolha' | 'fim'
    hp: null, // o HP de cada um depois da última luta (null = cheio)
    hpMax: null,
    reliquias: [],
    oferta: [],
    vencidas: 0, // lutas vencidas
    resultado: null, // 'vitoria' | 'derrota' (no fim)
    inicio: null, // (a cena marca: Date.now() da 1ª luta) para a duração
    tempos: [], // ms de cada luta vencida
    rodadas: 0, // rodadas somadas das lutas (vai no relato do resultado)
  }
}

// os dados da cena da luta atual (CoopArena / CoopArenaN): o HP e as relíquias acumuladas vão junto
export function dadosDaLuta(exp) {
  return {
    chefe: exp.lutas[exp.no],
    nivel: exp.nivel,
    party: [...exp.party],
    semente: `${exp.semente}:luta${exp.no}`,
    hp: exp.hp ? [...exp.hp] : null,
    reliquias: [...exp.reliquias],
    expedicao: exp,
  }
}

export const etapaAtual = (exp) => ETAPAS[exp.no]
export const ultimaLuta = (exp) => exp.no >= ETAPAS.length - 1

// O fim de uma luta: hp/hpMax = o de cada jogador no fim (caído = 0). Vitória na última = expedição completa.
export function terminarLuta(exp, { vitoria, hp = null, hpMax = null, tempoMs = null, rodadas = 0 } = {}) {
  const e = { ...exp, rodadas: (exp.rodadas ?? 0) + Math.max(0, rodadas | 0), hp: Array.isArray(hp) ? hp.map((x) => Math.max(0, Math.round(x ?? 0))) : exp.hp, hpMax: Array.isArray(hpMax) ? [...hpMax] : exp.hpMax, tempos: [...(exp.tempos ?? [])] }
  if (!vitoria) return { ...e, fase: 'fim', resultado: 'derrota', oferta: [] }
  e.vencidas = exp.no + 1
  if (tempoMs != null) e.tempos.push(Math.round(tempoMs))
  if (ultimaLuta(exp)) return { ...e, fase: 'fim', resultado: 'vitoria', oferta: [] }
  return { ...e, fase: 'escolha', oferta: gerarOferta(exp.semente, exp.no, exp.reliquias) }
}

// 3 relíquias diferentes que o time ainda não tem, pela semente e pela escolha (no): igual em todos os PCs
export function gerarOferta(semente, no, ja = [], n = OFERTA) {
  const r = rngDe(`${semente}:oferta:${no}`)
  const bolsa = IDS_RELIQUIAS.filter((id) => !ja.includes(id))
  const oferta = []
  while (oferta.length < n && bolsa.length) oferta.push(bolsa.splice(Math.floor(r() * bolsa.length), 1)[0])
  return oferta
}

// +CURA_ENTRE do HP máximo para cada um; quem caiu (0) volta com isso
export function curaEntreLutas(hp, hpMax) {
  if (!Array.isArray(hp)) return null
  return hp.map((x, j) => {
    const max = hpMax?.[j] ?? x
    return Math.min(max, Math.max(0, x ?? 0) + Math.round(max * CURA_ENTRE))
  })
}

// A CPU aliada vota com bom senso: com o time machucado (HP médio < 55%) uma de defesa; senão ataque/equipe.
// Empate: a primeira na ordem da preferência, depois a da esquerda
export function votoDaCpu(oferta, { hp = null, hpMax = null } = {}) {
  if (!oferta?.length) return 0
  const fracs = Array.isArray(hp) ? hp.map((x, j) => (hpMax?.[j] ? x / hpMax[j] : 1)) : [1]
  const media = fracs.reduce((t, x) => t + x, 0) / fracs.length
  const ordem = media < 0.55 ? ['defesa', 'equipe', 'ataque'] : ['ataque', 'equipe', 'defesa']
  let melhor = 0
  oferta.forEach((id, k) => {
    const a = ordem.indexOf(RELIQUIAS[id]?.tipo ?? 'equipe')
    const b = ordem.indexOf(RELIQUIAS[oferta[melhor]]?.tipo ?? 'equipe')
    if (a < b) melhor = k
  })
  return melhor
}

// Os votos ([índice da carta | null] por jogador) -> a carta escolhida.
//   maioria   a carta com mais votos
//   empate    entre as mais votadas, a do jogador com MENOS HP (fração; empate de HP: o de menor vaga)
//   tempo     ninguém votou: a sugestão (o voto da CPU)
// hp/hpMax: o de cada jogador (fração = hp / hpMax)
export function resolverVotos(votos, { hp = null, hpMax = null, sugestao = 0, n = OFERTA } = {}) {
  const validos = (votos ?? []).map((v) => (Number.isInteger(v) && v >= 0 && v < n ? v : null))
  const contagem = Array(n).fill(0)
  validos.forEach((v) => v != null && contagem[v]++)
  const max = Math.max(...contagem)
  if (max === 0) return { escolha: Math.min(Math.max(0, sugestao | 0), n - 1), motivo: 'tempo', contagem }
  const empatadas = contagem.map((c, k) => (c === max ? k : -1)).filter((k) => k >= 0)
  if (empatadas.length === 1) return { escolha: empatadas[0], motivo: 'maioria', contagem }
  const frac = (j) => (Array.isArray(hp) && hpMax?.[j] ? (hp[j] ?? 0) / hpMax[j] : 1)
  const quem = validos
    .map((v, j) => ({ v, j }))
    .filter(({ v }) => v != null && empatadas.includes(v))
    .sort((a, b) => frac(a.j) - frac(b.j) || a.j - b.j)[0]
  return { escolha: quem.v, motivo: 'empate', contagem, desempate: quem.j }
}

// a relíquia escolhida entra (acumula), o time se cura e a próxima luta começa
export function escolherReliquia(exp, id) {
  if (exp.fase !== 'escolha') return exp
  const reliquias = RELIQUIAS[id] && !exp.reliquias.includes(id) ? [...exp.reliquias, id] : [...exp.reliquias]
  return { ...exp, reliquias, hp: curaEntreLutas(exp.hp, exp.hpMax), oferta: [], no: exp.no + 1, fase: 'luta' }
}

// a expedição chegou de outro PC / de dados velhos: só o que faz sentido
export function expedicaoValida(exp) {
  return Boolean(exp && exp.v === 1 && Array.isArray(exp.lutas) && exp.lutas.length === 3 && Number.isInteger(exp.no) && exp.no >= 0 && exp.no < 3 && Array.isArray(exp.reliquias))
}

// o resumo para o relato do resultado (server/partidas.js): o chefão e quantas lutas o time venceu
export const relatoDaExpedicao = (exp) => ({ chefe: exp.chefao, lutas: Math.max(0, Math.min(3, exp.vencidas | 0)), sorteada: Boolean(exp.sorteada) })
