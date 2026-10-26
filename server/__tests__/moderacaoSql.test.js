// A 0004_moderacao.sql num Postgres de verdade (opcional): roda só com
//   DODGE_PG="-h /caminho/do/socket -p 5432 -U postgres" npm test
// (mesmo esquema do progressoSql.test.js: banco descartável dodge_teste_moderacao,
// "auth"/"storage" de mentira). Confere: as migrations 0001–0004 rodam duas
// vezes; denunciar (sem si mesmo, sem duplicata aberta, limite por dia, foto só
// de quem tem foto); o navegador não lê denúncia nenhuma; o filtro de nomes do
// banco é igual ao do JS e vale no atualizar_perfil.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { nomeOfensivo } from '../../src/lib/palavrasBloqueadas.js'

const ARGS = process.env.DODGE_PG ? process.env.DODGE_PG.split(/\s+/).filter(Boolean) : null
const BANCO = 'dodge_teste_moderacao'
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
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const comoNavegador = (sql, quem) => `begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid(quem)}'; ${sql}; commit;`
const comoAnonimo = (sql) => `begin; set local role anon; ${sql}; commit;`
const denunciar = (de, para, tipo = 'nome', motivo = 'nome ofensivo') => comoNavegador(`select public.denunciar('${uid(para)}', '${tipo}', '${motivo}')`, de)

test('as listas do banco e do JS são as mesmas', () => {
  const sql = execFileSync('cat', [migration('0004_moderacao')], { encoding: 'utf8' })
  const lista = (re) => [...re.exec(sql)[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1])
  return import('../../src/lib/palavrasBloqueadas.js').then((js) => {
    assert.deepEqual(lista(/any \(array\[([^\]]+)\]\)/), js.PALAVRAS_EXATAS)
    assert.deepEqual(lista(/unnest\(array\[([^\]]+)\]\) as p/), js.PALAVRAS_CONTIDAS)
  })
})

test('0004 no Postgres (duas vezes): denunciar, RLS e filtro de nomes', { skip: !ARGS && 'defina DODGE_PG para rodar no Postgres' }, () => {
  psql(`drop database if exists ${BANCO}`, 'postgres')
  psql(`create database ${BANCO}`, 'postgres')
  try {
    psql(STUB)
    for (let vez = 0; vez < 2; vez++) for (const n of ['0001_contas', '0002_amigos', '0003_progresso', '0004_moderacao']) arquivo(migration(n))
    for (let i = 1; i <= 13; i++) psql(`insert into auth.users (id, raw_user_meta_data) values ('${uid(i)}', '{"full_name":"Jogador ${i}"}')`)

    // ---- filtro de nomes: o banco e o JS concordam ----
    const nomes = ['Caralho', 'c.a.r.a.l.h.o', 'xcaralhox', 'Put4', 'puta_x', 'Computador', 'Disputa', 'Ana Maria', 'João', 'F D P', 'fdp', 'Hitler99', 'Shit', 'Shiitake', 'cuzão', 'Cuzao', 'Assassino', 'Analista', 'Pqp', 'n1gger', 'Kris', 'Susie 2000', 'Scunthorpe', 'Rapedo', 'Rape', 'dick_pro', 'Dickens', 'Bostoniano', 'Bosta']
    for (const nome of nomes) assert.equal(psql(`select public.nome_ofensivo('${nome}')`), nomeOfensivo(nome) ? 't' : 'f', `nome_ofensivo(${nome})`)
    assert.equal(nomeOfensivo('Computador'), false)
    assert.equal(nomeOfensivo('Caralho'), true)

    // atualizar_perfil barra o nome ofensivo e deixa o normal
    assert.match(falha(comoNavegador(`select public.atualizar_perfil('Caralho')`, 1)), /não é permitido/)
    assert.match(falha(comoNavegador(`select public.atualizar_perfil('c4r4lh0')`, 1)), /não é permitido/)
    assert.match(psql(comoNavegador(`select (public.atualizar_perfil('Computador')).nome_exibicao`, 1)), /Computador/)

    // ---- denunciar ----
    const id = psql(denunciar(1, 2)).split('\n').find((l) => /^[0-9a-f-]{36}$/.test(l))
    assert.ok(id, 'devolve o id da denúncia')
    assert.equal(psql(`select estado || '/' || tipo || '/' || (revisada_em is null) from public.denuncias where id = '${id}'`), 'aberta/nome/true')
    assert.match(falha(denunciar(1, 2)), /já denunciou isso/) // a mesma, aberta
    psql(denunciar(3, 2)) // outra pessoa pode
    assert.match(falha(denunciar(1, 1)), /a si mesmo/)
    assert.match(falha(denunciar(1, 2, 'xingamento')), /tipo de denúncia inválido/)
    assert.match(falha(denunciar(1, 4, 'nome', 'ab')), /diga o motivo/)
    assert.match(falha(denunciar(1, 4, 'nome', 'x'.repeat(201))), /diga o motivo/)
    assert.match(falha(denunciar(1, 99)), /jogador não encontrado|não encontrado/)
    assert.match(falha(denunciar(1, 4, 'foto')), /não tem foto/) // 4 não tem foto
    psql(`update public.perfis set avatar_tipo = 'enviado', avatar_url = 'https://x/y.webp' where id = '${uid(4)}'`)
    psql(denunciar(1, 4, 'foto'))
    assert.match(falha(denunciar(1, 4, 'foto')), /já denunciou isso/)
    // revisada a denúncia, dá para denunciar de novo
    psql(`update public.denuncias set estado = 'rejeitada', revisada_em = now(), revisor = 'teste' where id = '${id}'`)
    psql(denunciar(1, 2))
    // estado/revisão incoerentes não passam do constraint
    assert.ok(falha(`update public.denuncias set estado = 'aceita' where denunciante = '${uid(3)}'`), 'aceita sem revisada_em não pode')

    // limite por dia: o usuário 1 já fez 4 (2 nome + 1 foto + 1 repetida depois da revisão)
    const feitas = Number(psql(`select count(*) from public.denuncias where denunciante = '${uid(1)}'`))
    assert.equal(feitas, 3)
    for (let alvo = 5; alvo <= 11; alvo++) psql(denunciar(1, alvo)) // chega a 10
    assert.match(falha(denunciar(1, 12)), /denúncias demais/)
    // o limite é por quem denuncia
    psql(denunciar(13, 12))

    // ---- RLS: ninguém lê pelo navegador ----
    assert.match(falha(comoNavegador(`select * from public.denuncias`, 1)), /permission denied/)
    assert.match(falha(comoNavegador(`select * from public.denuncias`, 2)), /permission denied/)
    assert.match(falha(comoNavegador(`insert into public.denuncias (denunciante, denunciado, tipo, motivo) values ('${uid(1)}', '${uid(2)}', 'nome', 'abc')`, 1)), /permission denied/)
    assert.match(falha(comoNavegador(`update public.denuncias set estado = 'aceita'`, 1)), /permission denied/)
    assert.match(falha(comoAnonimo(`select public.denunciar('${uid(2)}', 'nome', 'abc')`)), /permission denied/)
    // quem não está logado (sem jwt) não denuncia
    assert.match(falha(`begin; set local role authenticated; select public.denunciar('${uid(2)}', 'nome', 'abc'); commit;`), /precisa estar logado/)
    // o servidor (service_role) lê e revisa (no Supabase de verdade o service_role já tem tudo por padrão)
    psql('grant all on all tables in schema public to service_role')
    assert.equal(psql(`begin; set local role service_role; select count(*) from public.denuncias where estado = 'aberta'; commit;`).split('\n').pop(), String(Number(psql(`select count(*) from public.denuncias where estado = 'aberta'`))))
  } finally {
    psql(`drop database if exists ${BANCO} with (force)`, 'postgres')
  }
})
