// Lista curta de palavras que não podem estar no nome de exibição (Fase 1E,
// moderação: docs/moderacao.md). É só uma rede de proteção contra o óbvio; o
// resto fica com a denúncia. O banco confere de novo (nome_ofensivo() em
// supabase/migrations/0004_moderacao.sql): as duas listas TÊM que ser iguais
// (server/__tests__/moderacao.test.js confere).
//
//   nomeOfensivo(texto)   true se o nome tem uma palavra da lista
//
// Como compara: minúsculas, sem acento, "leet" desfeito (0→o 1→i 3→e 4→a 5→s
// 7→t @→a $→s) e tudo que não é letra vira separador.
//   EXATAS     só vale como palavra inteira ("puta" barra "puta_x", não "computador")
//   CONTIDAS   palavras compridas e sem uso inocente: valem também coladas
//              em outras ("xcaralhox") e com separadores no meio ("c.a.r.a.l.h.o")

export const PALAVRAS_EXATAS = ['puta', 'puto', 'viado', 'vadia', 'cuzao', 'fdp', 'pqp', 'bosta', 'fuck', 'fucker', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut', 'nazi', 'rape', 'rapist', 'kkk']
export const PALAVRAS_CONTIDAS = ['caralho', 'buceta', 'arrombado', 'filhodaputa', 'vagabundo', 'nigger', 'faggot', 'retarded', 'hitler', 'pedofilo', 'estuprador', 'punheta']

// os mesmos conjuntos do translate() do banco
const ORIGEM = 'áàâãäåéèêëíìîïóòôõöúùûüçñý013457@$'
const DESTINO = 'aaaaaaeeeeiiiiooooouuuucnyoieastas'
const MAPA = new Map([...ORIGEM].map((c, i) => [c, DESTINO[i]]))

export function normalizarParaFiltro(texto) {
  return [...String(texto ?? '').toLowerCase()].map((c) => MAPA.get(c) ?? c).join('')
}

export function nomeOfensivo(texto) {
  const n = normalizarParaFiltro(texto)
  const palavras = n.split(/[^a-z]+/).filter(Boolean)
  if (palavras.some((p) => PALAVRAS_EXATAS.includes(p))) return true
  const colado = n.replace(/[^a-z]/g, '')
  return PALAVRAS_CONTIDAS.some((p) => colado.includes(p))
}

// Chat da sala: troca cada palavra da lista por asteriscos do mesmo tamanho
// (o resto da mensagem passa igual). Mesma comparação do nome, só que palavra
// por palavra: "c.a.r.a.l.h.o" junto vira uma palavra só e é pega; espalhado
// por espaços ("c a r a l h o") passa, e aí fica com a denúncia.
export function censurarTexto(texto) {
  return String(texto ?? '').replace(/\S+/g, (pedaco) => {
    const n = normalizarParaFiltro(pedaco)
    const palavras = n.split(/[^a-z]+/).filter(Boolean)
    const colado = n.replace(/[^a-z]/g, '')
    const ruim = palavras.some((p) => PALAVRAS_EXATAS.includes(p)) || PALAVRAS_CONTIDAS.some((p) => colado.includes(p))
    return ruim ? '*'.repeat([...pedaco].length) : pedaco
  })
}
