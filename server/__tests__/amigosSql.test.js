// A 0002_amigos.sql num Postgres de verdade (opcional): roda só com
//   DODGE_PG="-h /caminho/do/socket -p 5432 -U postgres" npm test
// (mesmo esquema do progressoSql.test.js: banco descartável dodge_teste_amigos,
// "auth"/"storage" de mentira). Confere: 0001–0002 rodam duas vezes; o
// navegador não lê nem escreve as tabelas direto; cada função age só sobre a
// conta do JWT (ninguém aceita, cancela, desfaz ou bloqueia no lugar do outro);
// pedidos cruzados viram amizade; bloqueio some com amizade e pedidos e
// esconde quem bloqueou.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ARGS = process.env.DODGE_PG ? process.env.DODGE_PG.split(/\s+/).filter(Boolean) : null
const BANCO = 'dodge_teste_amigos'
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
const C = '00000000-0000-0000-0000-00000000000c'
const comoNavegador = (sql, uid) => `begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}'; ${sql}; commit;`
const tag = (uid) => psql(`select tag from public.perfis where id = '${uid}'`)
const amizades = () => psql(`select count(*) from public.amizades`)
const pedidos = () => psql(`select coalesce(string_agg(right(de::text, 1) || '>' || right(para::text, 1), ',' order by de, para), '') from public.pedidos_amizade`)

test('0002 no Postgres (duas vezes): só a própria conta mexe nos próprios amigos', { skip: !ARGS && 'defina DODGE_PG para rodar no Postgres' }, () => {
  psql(`drop database if exists ${BANCO}`, 'postgres')
  psql(`create database ${BANCO}`, 'postgres')
  try {
    psql(STUB)
    for (let vez = 0; vez < 2; vez++) for (const n of ['0001_contas', '0002_amigos']) arquivo(migration(n))
    psql(`insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"full_name":"Ana"}'), ('${B}', '{"full_name":"Beto"}'), ('${C}', '{"full_name":"Caio"}')`)

    // tabelas: nada direto pelo navegador
    for (const t of ['amizades', 'pedidos_amizade', 'bloqueios']) {
      assert.match(falha(comoNavegador(`select * from public.${t}`, A)), /permission denied/, t)
    }
    assert.match(falha(comoNavegador(`insert into public.amizades (a, b) values ('${A}', '${B}')`, A)), /permission denied/)
    assert.match(falha(comoNavegador(`delete from public.bloqueios`, A)), /permission denied/)
    // ajudantes internos: o navegador não chama
    assert.match(falha(comoNavegador(`select public.fazer_amizade('${A}', '${B}')`, A)), /permission denied/)
    assert.match(falha(comoNavegador(`select public.ha_bloqueio('${A}', '${B}')`, A)), /permission denied/)
    // sem login, nada
    assert.match(falha(`begin; set local role authenticated; select public.enviar_pedido_amizade('${tag(B)}'); commit;`), /precisa estar logado/)

    // Ana pede a Beto; Caio não aceita no lugar de Beto
    assert.match(psql(comoNavegador(`select public.enviar_pedido_amizade('${tag(B)}')`, A)), /"enviado"/)
    assert.equal(pedidos(), 'a>b')
    assert.match(falha(comoNavegador(`select public.responder_pedido_amizade('${A}', true)`, C)), /não existe mais/)
    assert.equal(amizades(), '0')
    // Caio não cancela o pedido da Ana (só cancela os próprios: não faz nada)
    psql(comoNavegador(`select public.cancelar_pedido_amizade('${B}')`, C))
    assert.equal(pedidos(), 'a>b')
    // Beto pedindo de volta vira amizade na hora (sem pedido sobrando)
    assert.match(psql(comoNavegador(`select public.enviar_pedido_amizade('${tag(A)}')`, B)), /"amigos"/)
    assert.equal(amizades(), '1')
    assert.equal(pedidos(), '')
    assert.equal(psql(comoNavegador(`select string_agg(relacao || ':' || tag, ',') from public.listar_amigos()`, A)), `amigo:${tag(B)}`)
    assert.equal(psql(comoNavegador(`select count(*) from public.listar_amigos()`, C)), '0', 'Caio não vê os amigos dos outros')
    // Caio não desfaz a amizade dos dois
    psql(comoNavegador(`select public.remover_amigo('${A}')`, C))
    assert.equal(amizades(), '1')

    // Beto bloqueia Ana: amizade some e Ana não acha mais Beto pela tag
    psql(comoNavegador(`select public.bloquear('${A}')`, B))
    assert.equal(amizades(), '0')
    assert.match(falha(comoNavegador(`select public.enviar_pedido_amizade('${tag(B)}')`, A)), /não achei ninguém/)
    assert.equal(psql(comoNavegador(`select count(*) from public.listar_bloqueados()`, A)), '0', 'Ana não sabe quem a bloqueou')
    assert.equal(psql(comoNavegador(`select count(*) from public.listar_bloqueados()`, B)), '1')
    // Ana (a bloqueada) não desbloqueia por Beto
    psql(comoNavegador(`select public.desbloquear('${B}')`, A))
    assert.equal(psql(`select count(*) from public.bloqueios`), '1')
    assert.match(falha(comoNavegador(`select public.bloquear('${B}')`, B)), /não dá para bloquear/)
  } finally {
    psql(`drop database if exists ${BANCO} with (force)`, 'postgres')
  }
})
