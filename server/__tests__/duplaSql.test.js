// A 0009 (Fase 5E, 2x2) num Postgres de verdade (opcional): roda só com
//   DODGE_PG="-h /caminho/do/socket -p 5432 -U postgres" npm test
// (cria e apaga o banco dodge_teste_2x2). Sem a variável, pula. Roda 0001–0009 DUAS vezes e
// confere: os dois do time vencedor ganham participação + vitória, os outros a participação, e o
// limite diário "por par" conta contra cada ADVERSÁRIO (o parceiro não conta).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ARGS = process.env.DODGE_PG ? process.env.DODGE_PG.split(/\s+/).filter(Boolean) : null
const BANCO = 'dodge_teste_2x2'
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
// duas sessões ao mesmo tempo
const paralelo = (sql) =>
  new Promise((resolve, reject) => {
    const p = spawn('psql', [...ARGS, '-d', BANCO, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql])
    let saida = ''
    p.stdout.on('data', (d) => (saida += d))
    p.on('close', (codigo) => (codigo === 0 ? resolve(saida.trim()) : reject(new Error(`psql saiu com ${codigo}`))))
  })

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
const D = '00000000-0000-0000-0000-00000000000d'
const partida = (n) => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const registrar = (n, lados, modo = '2x2', times = [0, 1, 0, 1]) =>
  `select public.registrar_partida('${partida(n)}', '${modo}', 8, 'amigos', '${JSON.stringify(lados.map((u, lado) => ({ lado, user_id: u, ...(modo === '2x2' && { time: times[lado] }) })))}');`
const encerrar = (n, resultados) =>
  `select public.encerrar_partida('${partida(n)}', 'validada', null, 'normal', 300, 8, '${JSON.stringify(resultados.map((resultado, lado) => ({ lado, resultado, personagem: 'kris' })))}');`
const xpDe = (n) => Object.fromEntries(psql(`select usuario || ':' || xp_ganho from public.conceder_recompensa('${partida(n)}');`).split('\n').map((l) => [l.split(':')[0], Number(l.split(':')[1])]))

test('0001–0009 no Postgres (duas vezes): XP do 2x2 por time e o limite contra cada adversário', { skip: !ARGS && 'defina DODGE_PG para rodar no Postgres' }, () => {
  psql(`drop database if exists ${BANCO}`, 'postgres')
  psql(`create database ${BANCO}`, 'postgres')
  try {
    psql(STUB)
    for (let vez = 0; vez < 2; vez++) for (const n of ['0001_contas', '0002_amigos', '0003_progresso', '0004_moderacao', '0005_pendencias', '0006_n_jogadores', '0007_ffa', '0008_filtro_palavras', '0009_2x2']) arquivo(migration(n))
    psql(`insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"full_name":"Ana"}'), ('${B}', '{"full_name":"Beto"}'), ('${C}', '{"full_name":"Caio"}'), ('${D}', '{"full_name":"Duda"}')`)

    // A e C (time 0) contra B e D: os dois vencedores +20
    psql(registrar(1, [A, B, C, D]) + encerrar(1, ['vitoria', 'derrota', 'vitoria', 'derrota']))
    assert.deepEqual(xpDe(1), { [A]: 60, [B]: 40, [C]: 60, [D]: 40 })
    // o "oponente" gravado é um adversário (nunca o parceiro)
    assert.equal(psql(`select oponente_id from public.concessoes where partida_id = '${partida(1)}' and user_id = '${A}'`), B)
    // empate: só a participação
    psql(registrar(2, [A, B, C, D]) + encerrar(2, ['empate', 'empate', 'empate', 'empate']))
    assert.deepEqual(xpDe(2), { [A]: 40, [B]: 40, [C]: 40, [D]: 40 })
    psql(registrar(3, [A, B, C, D]) + encerrar(3, ['vitoria', 'derrota', 'vitoria', 'derrota']))
    assert.equal(xpDe(3)[A], 60)
    // 4ª com os mesmos adversários: metade
    psql(registrar(4, [A, B, C, D]) + encerrar(4, ['vitoria', 'derrota', 'vitoria', 'derrota']))
    assert.equal(xpDe(4)[A], 30)
    // TROCAR TIME: A e B contra C e D. A já enfrentou D 4 vezes (o par mais repetido): continua metade; o
    // ex-parceiro C não conta como repetição
    psql(registrar(5, [A, B, C, D], '2x2', [0, 0, 1, 1]) + encerrar(5, ['vitoria', 'vitoria', 'derrota', 'derrota']))
    assert.equal(xpDe(5)[A], 30)
    // de novo não soma
    xpDe(5)
    assert.equal(psql(`select count(*) from public.concessoes where partida_id = '${partida(5)}'`), '4')
    // o ffa continua igual (o 2º ganha o bônus)
    psql(registrar(6, [A, B, C], 'ffa') + `select public.encerrar_partida('${partida(6)}', 'validada', 0, 'normal', 300, 8, '[{"lado":0,"resultado":"vitoria","colocacao":1},{"lado":1,"resultado":"derrota","colocacao":2},{"lado":2,"resultado":"derrota","colocacao":3}]');`)
    assert.deepEqual(xpDe(6), { [A]: 60, [B]: 50, [C]: 40 })
  } finally {
    psql(`drop database if exists ${BANCO}`, 'postgres')
  }
})
