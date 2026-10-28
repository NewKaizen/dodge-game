// Filtro de palavrões do chat e dos nomes de exibição (docs/moderacao.md).
// O motor é a biblioteca `obscenity` (src/lib/filtro/matcher.js) com o
// dicionário em inglês dela mais a lista em português do Brasil de
// src/lib/filtro/ptbr.js. O banco confere os nomes de novo (nome_ofensivo() em
// supabase/migrations/0008_filtro_palavras.sql, GERADA por
// scripts/gerar-filtro-sql.mjs a partir dos mesmos dados).
//
//   nomeOfensivo(texto)    true se o texto tem palavrão (nomes de exibição)
//   censurarTexto(texto)   troca cada trecho ofensivo por asteriscos do mesmo
//                          tamanho e deixa o resto da mensagem igual (chat)
//
// Ambos aceitam { leves: true } para incluir os xingamentos brandos (LEVES),
// que por padrão passam.
import { temPalavrao, censurar } from './filtro/matcher.js'

export const nomeOfensivo = (texto, opcoes) => temPalavrao(texto, opcoes)
export const censurarTexto = (texto, opcoes) => censurar(texto, opcoes)
