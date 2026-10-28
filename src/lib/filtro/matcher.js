// Motor do filtro (docs/moderacao.md): biblioteca `obscenity` (MIT) + as listas
// em ptbr.js. Dois matchers sobre o mesmo texto normalizado:
//   limites  dicionário em inglês do obscenity + EXATAS (palavra inteira)
//   colados  COLADAS, ignorando o que não é letra ("c.a.r.a.l.h.o", "c a r a l h o")
// Normalização (o SQL de 0008 faz a mesma coisa em translate/regexp_replace):
// minúsculas, sem acento, "leet" desfeito, "_" e dígitos sem letra viram
// espaço, "." e "*" removidos, letras repetidas juntadas (b/e/o/l/s/g/r aceitam duas seguidas).
import {
  DataSet, RegExpMatcher, englishDataset, parseRawPattern,
  collapseDuplicatesTransformer, createSimpleTransformer, remapCharactersTransformer, resolveConfusablesTransformer,
  skipNonAlphabeticTransformer, toAsciiLowerCaseTransformer, assignIncrementingIds,
} from 'obscenity'
import { EXATAS, COLADAS, PERMITIDAS, LEVES, EN_REMOVIDAS } from './ptbr.js'

// mesmos conjuntos do translate() do banco (0008)
export const ORIGEM = 'áàâãäåéèêëíìîïóòôõöúùûüçñý013457@$_2689'
export const DESTINO = 'aaaaaaeeeeiiiiooooouuuucnyoieastas     '
const DUPLAS = 'beolsgr'

const remapear = () => {
  const mapa = {}
  ;[...ORIGEM].forEach((c, i) => {
    for (const variante of new Set([c, c.toUpperCase()])) mapa[DESTINO[i]] = (mapa[DESTINO[i]] ?? '') + variante
  })
  return remapCharactersTransformer(mapa)
}
const colapsar = () => collapseDuplicatesTransformer({ defaultThreshold: 1, customThresholds: new Map([...DUPLAS].map((c) => [c, 2])) })
// "p.o.r.r.a": pontos no meio da palavra somem
const semPontos = () => createSimpleTransformer((c) => (c === 46 || c === 42 ? undefined : c))
const base = () => [resolveConfusablesTransformer(), semPontos(), remapear(), toAsciiLowerCaseTransformer()]
const transformadores = {
  limites: () => [...base(), colapsar()],
  colados: () => [...base(), skipNonAlphabeticTransformer(), colapsar()],
}
const transformadoresPermitidas = () => [remapear(), toAsciiLowerCaseTransformer(), collapseDuplicatesTransformer({ defaultThreshold: Number.POSITIVE_INFINITY, customThresholds: new Map([[' ', 1]]) })]

// "porra" -> "po[o]rra": tolera "pooorra" (b/e/o/l repetidos viram duas letras
// no colapso e a duplicada precisa ser opcional no padrão)
export const padraoDe = (termo, { exata }) => {
  let p = ''
  for (let i = 0; i < termo.length; i++) {
    p += termo[i]
    if ('beol'.includes(termo[i]) && termo[i + 1] !== termo[i]) p += `[${termo[i]}]`
  }
  return exata ? `|${p}[s]|` : p
}

const termos = (lista, opcoes) => lista.map((t) => parseRawPattern(padraoDe(t, opcoes)))
const comIds = (padroes) => assignIncrementingIds(padroes)

// Dados dos dois matchers (também usados pelo gerador do SQL).
export function dadosDoFiltro({ leves = false } = {}) {
  const dicionario = new DataSet().addAll(englishDataset).removePhrasesIf((f) => EN_REMOVIDAS.includes(f.metadata?.originalWord)).build()
  const exatas = [...EXATAS, ...(leves ? LEVES : [])]
  return {
    limites: {
      blacklistedTerms: [...dicionario.blacklistedTerms.map((t) => t.pattern), ...termos(exatas, { exata: true })],
      whitelistedTerms: [...dicionario.whitelistedTerms, ...PERMITIDAS],
    },
    colados: { blacklistedTerms: termos(COLADAS, { exata: false }), whitelistedTerms: [...PERMITIDAS] },
  }
}

const construir = ({ leves = false } = {}) => {
  const d = dadosDoFiltro({ leves })
  const montar = (chave) =>
    new RegExpMatcher({
      blacklistedTerms: comIds(d[chave].blacklistedTerms),
      whitelistedTerms: d[chave].whitelistedTerms,
      blacklistMatcherTransformers: transformadores[chave](),
      whitelistMatcherTransformers: transformadoresPermitidas(),
    })
  return [montar('limites'), montar('colados')]
}

const cache = {}
const matchers = (leves) => (cache[leves ? 'leves' : 'padrao'] ??= construir({ leves }))

export const temPalavrao = (texto, { leves = false } = {}) => matchers(leves).some((m) => m.hasMatch(String(texto ?? '')))

// Troca cada trecho achado por asteriscos (um por caractere) e deixa o resto igual.
export function censurar(texto, { leves = false } = {}) {
  const t = String(texto ?? '')
  const trechos = matchers(leves).flatMap((m) => m.getAllMatches(t))
  if (!trechos.length) return t
  let saida = ''
  let i = 0
  for (const c of t) {
    saida += trechos.some((m) => i >= m.startIndex && i <= m.endIndex) ? '*' : c
    i += c.length
  }
  return saida
}
