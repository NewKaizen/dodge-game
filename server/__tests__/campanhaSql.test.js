// A 0011 (CAMPANHA) num Postgres de verdade (opcional): roda só com
//   DODGE_PG="-h /caminho/do/socket -p 5432 -U postgres" npm test
// (cria e apaga o banco dodge_teste_campanha). Sem a variável, pula. Roda 0001–0011 DUAS vezes e
// confere: primeira vitória + estrelas, repetição, teto do dia, idempotência pela corrida, fase
// bloqueada vira suspeita, os cosméticos do mundo (chefe e 3 estrelas), a trilha de níveis nunca os
// entrega, e o navegador só lê o que é seu e não chama a concessão.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { XP_PRIMEIRA, XP_PRIMEIRA_CHEFE, XP_ESTRELA, XP_REPETICAO, XP_CAMPANHA_DIA } from '../../src/game/campanha/recompensas.js'

const ARGS = process.env.DODGE_PG ? process.env.DODGE_PG.split(/\s+/).filter(Boolean) : null
const BANCO = 'dodge_teste_campanha'
const MIGRATIONS = ['0001_contas', '0002_amigos', '0003_progresso', '0004_moderacao', '0005_pendencias', '0006_n_jogadores', '0007_ffa', '0008_filtro_palavras', '0009_2x2', '0010_boss_semanal', '0011_campanha']
const migration = (n) => fileURLToPath(new URL(`../../supabase/migrations/${n}.sql`, import.meta.url))
const psql = (sql, banco = BANCO) => execFileSync('psql', [...ARGS, '-d', banco, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
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
const corrida = (n) => `30000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const conceder = (n, fase, estrelas, { user = A, resultado = 'vitoria' } = {}) =>
  psql(`select (r ->> 'xp_ganho') || ':' || (r ->> 'motivo') || ':' || (r ->> 'resultado') from (select public.conceder_campanha('${corrida(n)}', '${user}', 1, ${fase}, '${resultado}', null, ${estrelas}, 6, 120) r) x`)
const comoNavegador = (sql, uid = A) => `begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}'; ${sql}; commit;`

test('0011 no Postgres (duas vezes): progresso, XP, teto, idempotência e cosméticos da campanha', { skip: !ARGS && 'defina DODGE_PG para rodar no Postgres' }, () => {
  psql(`drop database if exists ${BANCO}`, 'postgres')
  psql(`create database ${BANCO}`, 'postgres')
  try {
    psql(STUB)
    for (let vez = 0; vez < 2; vez++) for (const n of MIGRATIONS) arquivo(migration(n))
    psql(`insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"full_name":"Ana"}'), ('${B}', '{"full_name":"Beto"}')`)

    // primeira vitória com 2 estrelas; de novo a mesma corrida: nada soma
    assert.equal(conceder(1, 1, 2), `${XP_PRIMEIRA + 2 * XP_ESTRELA}:primeira:vitoria`)
    assert.equal(conceder(1, 1, 3), `${XP_PRIMEIRA + 2 * XP_ESTRELA}:primeira:vitoria`)
    assert.equal(psql(`select xp from public.perfis where id = '${A}'`), String(XP_PRIMEIRA + 2 * XP_ESTRELA))
    // estrela nova; repetição; derrota e suspeita não dão nada
    assert.equal(conceder(2, 1, 3), `${XP_ESTRELA}:estrelas:vitoria`)
    assert.equal(conceder(3, 1, 3), `${XP_REPETICAO}:repeticao:vitoria`)
    assert.equal(conceder(4, 2, 0, { resultado: 'derrota' }), '0:derrota:derrota')
    assert.equal(conceder(5, 2, 0, { resultado: 'suspeita' }), '0:suspeita:suspeita')
    // fase 3 sem a 2 vencida: suspeita ('bloqueada'), nem progresso nem XP
    assert.equal(conceder(6, 3, 3), '0:suspeita:suspeita')
    assert.equal(psql(`select motivo from public.campanha_corridas where id = '${corrida(6)}'`), 'bloqueada')
    assert.equal(psql(`select count(*) from public.campanha_progresso where user_id = '${A}' and fase = 3`), '0')

    // o mundo todo com 3 estrelas: o teto do dia corta o XP; o chefe dá título + moldura, 3★ em tudo dá o verso
    for (let f = 2; f <= 6; f++) conceder(10 + f, f, 3)
    assert.equal(psql(`select sum(xp) from public.campanha_corridas where user_id = '${A}'`), String(XP_CAMPANHA_DIA))
    assert.ok(Number(psql(`select count(*) from public.campanha_corridas where xp_motivo = 'teto_dia'`)) >= 1)
    assert.equal(psql(`select string_agg(item_id, ',' order by item_id) from public.inventario where user_id = '${A}' and item_id in ('titulo.andarilho_papel', 'moldura.floresta_papel', 'verso.folha_dobrada')`), 'moldura.floresta_papel,titulo.andarilho_papel,verso.folha_dobrada')
    assert.equal(psql(`select count(*) from public.campanha_progresso where user_id = '${A}' and estrelas = 3`), '6')
    // o progresso que o servidor manda ao navegador
    const p = JSON.parse(psql(`select public.progresso_campanha('${A}')`))
    assert.equal(p.fases.length, 6)
    assert.equal(p.xp_hoje, XP_CAMPANHA_DIA)
    assert.ok(XP_PRIMEIRA * 5 + XP_PRIMEIRA_CHEFE + 18 * XP_ESTRELA > XP_CAMPANHA_DIA)

    // escolhas dos diálogos
    psql(`select public.campanha_escolher('${A}', 1, 'lapis', 'verde')`)
    psql(`select public.campanha_escolher('${A}', 1, 'lapis', 'vermelho')`)
    assert.equal(JSON.parse(psql(`select public.progresso_campanha('${A}')`)).escolhas['1'].lapis, 'vermelho')
    assert.match(falha(`select public.campanha_escolher('${A}', 1, 'Lápis!', 'x')`), /escolha inválida/)
    assert.match(falha(`select public.conceder_campanha('${corrida(99)}', '${A}', 1, 7, 'vitoria', null, 3, 5, 60)`), /fase inválida/)

    // a trilha de níveis nunca entrega cosmético da campanha (nível 1000)
    psql(`update public.perfis set xp = 999999 where id = '${B}'`)
    assert.equal(conceder(30, 1, 1, { user: B }).split(':')[2], 'vitoria')
    assert.equal(psql(`select count(*) from public.inventario where user_id = '${B}' and item_id in ('titulo.andarilho_papel', 'moldura.floresta_papel', 'verso.folha_dobrada')`), '0')
    assert.match(falha(`insert into public.catalogo_itens (id, tipo, nome, nivel_requerido, campanha, campanha_quando) values ('titulo.mundo_falso', 'titulo', 'x', 5, 'mundo1', 'mundo')`), /catalogo_campanha_formato/)

    // navegador: lê só o que é seu, não chama a concessão nem escreve no progresso
    assert.equal(psql(comoNavegador(`select count(*) from public.campanha_progresso`)), '6')
    assert.equal(psql(comoNavegador(`select count(*) from public.campanha_progresso`, B)), '1')
    assert.equal(psql(comoNavegador(`select count(*) from public.campanha_corridas`, B)), '1')
    assert.match(falha(comoNavegador(`select public.conceder_campanha('${corrida(98)}', '${A}', 1, 1, 'vitoria', null, 3, 5, 60)`)), /permission denied/)
    assert.match(falha(comoNavegador(`select public.progresso_campanha('${A}')`)), /permission denied/)
    assert.match(falha(comoNavegador(`insert into public.campanha_progresso (user_id, mundo, fase, estrelas, concluida) values ('${A}', 1, 1, 3, true)`)), /permission denied/)
    assert.match(falha(comoNavegador(`update public.campanha_progresso set estrelas = 3`, B)), /permission denied/)
    // o título do mundo equipa como os outros
    assert.equal(psql(comoNavegador(`select titulo_equipado from public.equipar('titulo', 'titulo.andarilho_papel')`)), 'titulo.andarilho_papel')
  } finally {
    psql(`drop database if exists ${BANCO}`, 'postgres')
  }
})
