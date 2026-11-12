// A 0015 (BAÚS e SLOTS NOVOS) num Postgres de verdade (opcional): roda só com
//   DODGE_PG="-h /caminho/do/socket -p 5432 -U postgres" npm test
// (cria e apaga o banco dodge_teste_baus). Sem a variável, pula. Roda 0001–0015 DUAS vezes e confere: os
// números e o catálogo iguais aos do navegador (src/lib/cosmeticos.js), cada fonte UMA vez (repetida e em
// paralelo) e conferida, abrir_bau igual ao rolarBau do JS com os mesmos números (pena, duplicado, XP extra),
// o mesmo baú nunca abre duas vezes (nem em paralelo), o teto de XP, o nível novo dá baú, equipar só o que
// tem e o navegador só lendo o que é seu (sem chamar nada do servidor).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import * as C from '../../src/lib/cosmeticos.js'

const ARGS = process.env.DODGE_PG ? process.env.DODGE_PG.split(/\s+/).filter(Boolean) : null
const BANCO = 'dodge_teste_baus'
const MIGRATIONS = ['0001_contas', '0002_amigos', '0003_progresso', '0004_moderacao', '0005_pendencias', '0006_n_jogadores', '0007_ffa', '0008_filtro_palavras', '0009_2x2', '0010_boss_semanal', '0011_campanha', '0012_campanha_mundo1', '0013_desafio_diario', '0014_conquistas_maestria', '0015_baus_cosmeticos']
const migration = (n) => fileURLToPath(new URL(`../../supabase/migrations/${n}.sql`, import.meta.url))
const psql = (sql, banco = BANCO) => execFileSync('psql', [...ARGS, '-d', banco, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const psqlAsync = (sql) => new Promise((ok, erro) => execFile('psql', [...ARGS, '-d', BANCO, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], { encoding: 'utf8' }, (e, out) => (e ? erro(e) : ok(out.trim()))))
const arquivo = (caminho) => execFileSync('psql', [...ARGS, '-d', BANCO, '-v', 'ON_ERROR_STOP=1', '-q', '-f', caminho], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const falha = (sql) => {
  try {
    psql(sql)
  } catch (e) {
    return String(e.stderr)
  }
  return null
}
const STUB = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create schema storage;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit int, allowed_mime_types text[]);
grant usage on schema public, auth to anon, authenticated, service_role;
`
const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
const comoNavegador = (sql, uid = A) => `begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}'; ${sql}; commit;`
const arr = (u) => `array[${u.join(',')}]::integer[]`
const conceder = (fonte, ref, user = A) => `select (public.conceder_bau('${user}', '${fonte}', ${ref == null ? 'null' : `'${ref}'`}) ->> 'novo')`
const abrir = (u, user = A, bau = 'null') => JSON.parse(psql(`select public.abrir_bau('${user}', ${bau}, ${arr(u)})::text`))
const fechados = (user = A) => Number(psql(`select count(*) from public.baus where user_id = '${user}' and aberto_em is null`))

test('0015 no Postgres (duas vezes): baús, slots novos e equipar', { skip: !ARGS && 'defina DODGE_PG para rodar no Postgres' }, async () => {
  psql(`drop database if exists ${BANCO}`, 'postgres')
  psql(`create database ${BANCO}`, 'postgres')
  try {
    psql(STUB)
    for (let vez = 0; vez < 2; vez++) for (const n of MIGRATIONS) arquivo(migration(n))
    psql(`insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"full_name":"Ana"}'), ('${B}', '{"full_name":"Beto"}')`)

    // ---------- os números e o catálogo são os do navegador ----------
    assert.equal(psql(`select public.bau_escala() || ':' || public.bau_pity() || ':' || public.bau_chance_xp_extra() || ':' || public.bau_xp_teto_dia() || ':' || public.bau_sorteio_tamanho()`), `${C.ESCALA}:${C.PITY}:${C.CHANCE_XP_EXTRA}:${C.BAU_XP_TETO_DIA}:${C.SORTEIO_TAMANHO}`)
    for (const u of [0, 1, 499_999, 500_000, 599_999, 600_000, 849_999, 850_000, 879_999, 880_000, 979_999, 980_000, 999_999]) {
      assert.equal(psql(`select public.bau_raridade(${u})`), C.raridadeDoSorteio(u), `raridade ${u}`)
      assert.equal(psql(`select public.bau_quantidade(${u})`), String(C.quantidadeDoSorteio(u)), `quantidade ${u}`)
    }
    for (const r of C.RARIDADES) assert.equal(psql(`select public.bau_xp_bonus('${r}') || ':' || public.bau_xp_duplicado('${r}')`), `${C.XP_BONUS[r]}:${C.XP_DUPLICADO[r]}`)
    assert.equal(psql(`select array_to_string(public.bau_conquistas(), ',')`), C.CONQUISTAS_COM_BAU.join(','))
    assert.equal(
      psql(`select string_agg(id || '=' || tipo || ':' || nome || ':' || raridade, '|' order by id collate "C") from public.catalogo_itens where bau`),
      [...C.ITENS_BAU].sort((a, b) => (a.id < b.id ? -1 : 1)).map((i) => `${i.id}=${i.tipo}:${i.nome}:${i.raridade}`).join('|'),
    )
    for (const r of C.RARIDADES) assert.equal(psql(`select string_agg(id, ',' order by id collate "C") from public.catalogo_itens where bau and raridade = '${r}'`), C.POOL_BAU[r].join(','), `pool ${r}`)
    // um item do baú nunca sai pela trilha
    assert.equal(psql(`select count(*) from public.catalogo_itens where bau and nivel_requerido <= 99`), '0')

    // ---------- conceder: cada chave uma vez, a fonte conferida ----------
    const par = await Promise.all([1, 2, 3, 4].map(() => psqlAsync(conceder('dia', null))))
    assert.equal(par.filter((x) => x === 'true').length, 1, par.join(','))
    assert.equal(psql(conceder('dia', null)), 'false')
    assert.match(falha(conceder('nivel', '2')), /ainda não chegou/)
    psql(`update public.perfis set nivel = 4, xp = 400 where id = '${A}'`)
    assert.equal(psql(conceder('nivel', '2')), 'true')
    assert.equal(psql(conceder('nivel', '02')), 'false', 'mesma chave')
    assert.match(falha(conceder('nivel', '1')), /ainda não chegou/)
    assert.match(falha(conceder('desafio', '2026-11-12')), /desafio não vencido/)
    assert.match(falha(conceder('semanal', '2026-S46')), /boss semanal não vencido/)
    assert.match(falha(conceder('conquista', 'primeira_vitoria')), /conquista sem baú/)
    psql(`insert into public.conquistas (user_id, conquista) values ('${A}', 'primeira_vitoria'), ('${A}', 'intocavel')`)
    assert.equal(psql(conceder('conquista', 'primeira_vitoria')), 'true')
    assert.match(falha(conceder('conquista', 'intocavel')), /conquista sem baú/)
    assert.match(falha(conceder('compra', 'x')), /fonte inválida/)
    assert.equal(fechados(), 3)

    // ---------- abrir: igual ao rolarBau do JS com os mesmos números ----------
    assert.match(falha(`select public.abrir_bau('${A}', null, array[1,2,3]::integer[])`), /sorteio inválido/)
    assert.match(falha(`select public.abrir_bau('${A}', null, ${arr(Array(10).fill(C.ESCALA))})`), /sorteio inválido/)
    psql(`update public.perfis set nivel = 60, xp = 0 where id = '${A}'`)
    for (let n = 3; n <= 60; n++) psql(conceder('nivel', String(n)))
    let desde = 0
    const tem = new Set(psql(`select coalesce(string_agg(item_id, ','), '') from public.inventario where user_id = '${A}'`).split(',').filter(Boolean))
    const seq = Array.from({ length: 45 }, (_, i) => Array.from({ length: C.SORTEIO_TAMANHO }, (_, k) => (i * 7919 + k * 104_729 + i * k * 31) % C.ESCALA))
    seq[3] = Array(10).fill(0) // o pior: 1 comum
    seq[4] = [999_999, 0, 0, 0, 0, 999_999, 0, 0, 999_999, 0] // 3 comuns, o mesmo índice: duplicados no mesmo baú
    let xp = 0
    for (const [n, u] of seq.entries()) {
      const esperado = C.rolarBau(u, { desdeEpico: desde, possui: (id) => tem.has(id) })
      const r = abrir(u)
      assert.equal(r.aberto, true)
      assert.deepEqual(r.recompensas, esperado.recompensas.map((x) => ({ ...x })), `baú ${n}`)
      assert.equal(r.pity, esperado.pity, `pena ${n}`)
      assert.equal(r.desde_epico, esperado.desdeEpico)
      for (const x of esperado.recompensas) if (x.tipo === 'item') tem.add(x.id)
      desde = esperado.desdeEpico
      xp += r.xp_ganho
      assert.ok(r.xp_ganho <= r.xp_sorteado)
    }
    assert.ok(xp <= C.BAU_XP_TETO_DIA, 'teto do dia')
    assert.ok(xp >= C.BAU_XP_TETO_DIA - 200, 'o teto foi alcançado')
    assert.equal(psql(`select xp from public.perfis where id = '${A}'`), String(xp))
    // a pena com o pior sorteio: depois de 9 sem épico, o 10º é épico
    psql(`update public.baus_contas set desde_epico = 9 where user_id = '${A}'`)
    const pena = abrir(Array(10).fill(0))
    assert.equal(pena.recompensas[0].raridade, 'epico')
    assert.equal(pena.pity, true)
    assert.equal(pena.desde_epico, 0)

    // o mesmo baú de novo: o mesmo resultado, nada soma; de outra conta: erro
    const id = psql(`select id from public.baus where user_id = '${A}' and aberto_em is not null order by aberto_em limit 1`)
    const antes = psql(`select abertos || ':' || (select xp from public.perfis where id = '${A}') from public.baus_contas where user_id = '${A}'`)
    const rep = abrir(Array(10).fill(5), A, `'${id}'`)
    assert.equal(rep.repetido, true)
    assert.equal(psql(`select abertos || ':' || (select xp from public.perfis where id = '${A}') from public.baus_contas where user_id = '${A}'`), antes)
    assert.match(falha(`select public.abrir_bau('${B}', '${id}', ${arr(Array(10).fill(5))})`), /baú não existe/)
    assert.equal(abrir(Array(10).fill(5), B).aberto, false, 'Beto não tem baú')

    // em PARALELO: cada pedido abre um baú diferente
    psql(`update public.perfis set nivel = 8 where id = '${B}'`)
    for (let n = 2; n <= 8; n++) psql(conceder('nivel', String(n), B))
    const par2 = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9].map(() => psqlAsync(`select public.abrir_bau('${B}', null, ${arr(Array(10).fill(123_456))}) ->> 'bau_id'`)))
    const ids = par2.filter(Boolean)
    assert.equal(ids.length, 7)
    assert.equal(new Set(ids).size, 7)
    assert.equal(psql(`select abertos from public.baus_contas where user_id = '${B}'`), '7')

    // XP do baú que sobe de nível: a trilha entrega e o nível novo vira baú
    psql(`delete from public.baus where user_id = '${B}'; update public.perfis set xp = 95, nivel = 1 where id = '${B}'; insert into public.inventario (user_id, item_id) select '${B}', id from public.catalogo_itens where bau on conflict do nothing`)
    psql(`update public.perfis set nivel = 2 where id = '${B}'`)
    psql(conceder('nivel', '2', B))
    psql(`update public.perfis set nivel = 1 where id = '${B}'`)
    const sobe = abrir(Array(10).fill(0), B)
    assert.equal(sobe.recompensas[0].tipo, 'duplicado')
    assert.equal(sobe.nivel_depois, 2)
    assert.equal(psql(`select count(*) from public.baus where user_id = '${B}' and chave = 'nivel:2'`), '1', 'a chave do nível já existia: não duplica')

    // ---------- equipar (o navegador): só o que tem ----------
    assert.match(falha(comoNavegador(`select public.equipar('som', 'som.cabra')`)) ?? '', /ainda não tem|item inválido/)
    const meuSom = [...tem].find((x) => x.startsWith('som.'))
    if (meuSom) {
      psql(comoNavegador(`select public.equipar('som', '${meuSom}')`))
      assert.equal(psql(`select som_equipado from public.perfis where id = '${A}'`), meuSom)
    }
    assert.match(falha(comoNavegador(`select public.equipar('efeito', 'som.latido')`)), /item inválido/)
    psql(comoNavegador(`select public.equipar('som', null)`))
    assert.equal(psql(`select coalesce(som_equipado, 'nada') from public.perfis where id = '${A}'`), 'nada')
    // os tipos de sempre continuam iguais
    assert.match(falha(comoNavegador(`select public.equipar('moldura', 'moldura.ouro')`)), /ainda não tem/)
    psql(comoNavegador(`select public.equipar('titulo', 'titulo.novato')`))

    // ---------- o navegador não chama nada do servidor e só lê o que é seu ----------
    for (const f of [`public.conceder_bau('${A}', 'dia', null)`, `public.abrir_bau('${A}', null, ${arr(Array(10).fill(0))})`, `public.baus_estado('${A}')`, `public.equipar_conta('${A}', 'som', null)`])
      assert.match(falha(comoNavegador(`select ${f}`)), /permission denied/, f)
    assert.match(falha(comoNavegador(`insert into public.baus (user_id, fonte, chave) values ('${A}', 'dia', 'dia:x')`)), /permission denied/)
    assert.match(falha(comoNavegador(`update public.baus_contas set desde_epico = 9`)), /permission denied/)
    assert.equal(psql(comoNavegador(`select count(*) from public.baus where user_id <> '${A}'`)), '0')
    assert.ok(Number(psql(comoNavegador(`select count(*) from public.baus`))) > 0)
    const est = JSON.parse(psql(`select public.baus_estado('${A}')::text`))
    assert.equal(est.fechados, fechados())
  } finally {
    psql(`drop database if exists ${BANCO}`, 'postgres')
  }
})
