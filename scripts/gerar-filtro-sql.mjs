// Gera supabase/migrations/0008_filtro_palavras.sql a partir dos dados do filtro
// (src/lib/filtro/*.js). Rode depois de mexer em ptbr.js:
//   node scripts/gerar-filtro-sql.mjs          grava o arquivo
//   node scripts/gerar-filtro-sql.mjs --stdout só imprime (o teste usa isto)
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { RegExpMatcher, assignIncrementingIds } from 'obscenity'
import { dadosDoFiltro, ORIGEM, DESTINO } from '../src/lib/filtro/matcher.js'

const aspas = (s) => `'${s.replaceAll("'", "''")}'`
const lista = (itens) => `array[\n      ${itens.map(aspas).join(',\n      ')}\n    ]`

// \b do JS vira \y no Postgres (o \b dele é backspace); o resto do regex é igual
const regexes = (termos) =>
  new RegExpMatcher({ blacklistedTerms: assignIncrementingIds(termos) }).blacklistedTerms.map((t) => t.regExp.source.replaceAll('\\b', '\\y'))
const unicos = (a) => [...new Set(a)]

export function gerarSql() {
  const d = dadosDoFiltro()
  const permitidas = unicos([...d.limites.whitelistedTerms, ...d.colados.whitelistedTerms]).map((t) => t.toLowerCase().replace(/ +/g, ' '))
  // o translate() do banco: letras a mais em ORIGEM sem par em DESTINO são apagadas (JS: "." e "*")
  const origem = ORIGEM + '.*'
  const destino = DESTINO
  return `-- 0008_filtro_palavras.sql: filtro de palavrões com lista grande (pt-BR + inglês).
-- GERADO por scripts/gerar-filtro-sql.mjs: não edite à mão; mexa em
-- src/lib/filtro/ptbr.js e rode "node scripts/gerar-filtro-sql.mjs".
-- Pode rodar de novo: "create or replace". Não mexe em 0001-0007.
--
-- Substitui nome_ofensivo() (0004), que as RPCs criar_perfil/atualizar_perfil
-- (0005) e o gatilho de perfis já chamam: nenhuma delas muda.
--
-- Mesma normalização do JS (src/lib/filtro/matcher.js): minúsculas, sem acento,
-- "leet" desfeito (0 1 3 4 5 7 @ $), "_" e 2 6 8 9 viram espaço, "." e "*"
-- somem, letras repetidas juntadas (b e o l s g r aceitam duas seguidas).
--   limites: expressões regulares sobre o texto com espaços (palavra inteira)
--   colados: o mesmo, mas só com as letras ("c.a.r.a.l.h.o", "c a r a l h o")
--   permitidas: texto inocente que sai antes de comparar ("cacetinho")
-- Não cobre o que o JS cobre com caracteres "parecidos" de outros alfabetos
-- (confusables do obscenity): o JS já barra antes, no cadastro e no servidor.
create or replace function public.nome_ofensivo(p_nome text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with a as (
    -- sem acento/leet, sem pontos, espaços juntos
    select regexp_replace(
             translate(lower(coalesce(p_nome, '')), ${aspas(origem)}, ${aspas(destino)}),
             ' +', ' ', 'g'
           ) as t
  ),
  limpo as (
    -- o texto inocente da lista "permitidas" vira '#'
    select regexp_replace(a.t, ${aspas(`(${permitidas.join('|')})`)}, '#', 'g') as t from a
  ),
  n as (
    -- letras repetidas: b e o l s g r aceitam duas seguidas; as outras, uma
    select
      regexp_replace(regexp_replace(limpo.t, '([^beolsgr])\\1+', '\\1', 'g'), '([beolsgr])\\1{2,}', '\\1\\1', 'g') as limites,
      regexp_replace(regexp_replace(regexp_replace(limpo.t, '[^a-z#]', '', 'g'), '([^beolsgr])\\1+', '\\1', 'g'), '([beolsgr])\\1{2,}', '\\1\\1', 'g') as colados
    from limpo
  )
  select
    exists (select 1 from unnest(${lista(unicos(regexes(d.limites.blacklistedTerms)))}) as r where n.limites ~ r)
    or exists (select 1 from unnest(${lista(unicos(regexes(d.colados.blacklistedTerms)))}) as r where n.colados ~ r)
  from n;
$$;
`
}

if (process.argv.includes('--stdout')) process.stdout.write(gerarSql())
else {
  const destinoArquivo = fileURLToPath(new URL('../supabase/migrations/0008_filtro_palavras.sql', import.meta.url))
  writeFileSync(destinoArquivo, gerarSql())
  console.log('gerado', destinoArquivo)
}
