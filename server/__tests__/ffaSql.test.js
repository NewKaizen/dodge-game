// A 0007 (Fase 5D, todos contra todos) num Postgres de verdade (opcional): roda só com
//   DODGE_PG="-h /caminho/do/socket -p 5432 -U postgres" npm test
// (cria e apaga o banco dodge_teste_ffa). Sem a variável, pula. Roda 0001–0007 DUAS vezes e
// confere: o PVP de 2 dá o mesmo XP de antes e, no 'ffa', o 1º ganha participação + vitória,
// o 2º participação + o bônus do 2º lugar e o resto só a participação (uma vez por conta).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ARGS = process.env.DODGE_PG ? process.env.DODGE_PG.split(/\s+/).filter(Boolean) : null
const BANCO = 'dodge_teste_ffa'
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
// lados: ids de conta, ou { ref } para um convidado
const registrar = (n, lados = [A, B], modo = 'pvp') =>
  `select public.registrar_partida('${partida(n)}', '${modo}', 8, 'amigos', '${JSON.stringify(lados.map((u, lado) => ({ ...(typeof u === 'object' && u ? { lado, user_id: null, ref: u.ref } : { lado, user_id: u }), ...(modo === '2x2' && { time: lado % 2 }) })))}');`
const encerrar = (n, { validacao = 'validada', vencedor = 0, duracao = 120, rodadas = 4, resultados = ['vitoria', 'derrota'], colocacoes = null } = {}) =>
  `select public.encerrar_partida('${partida(n)}', '${validacao}', ${vencedor ?? 'null'}, 'normal', ${duracao}, ${rodadas ?? 'null'}, '${JSON.stringify(resultados.map((resultado, lado) => ({ lado, resultado, personagem: lado ? 'susie' : 'kris', ...(colocacoes && { colocacao: colocacoes[lado] }) })))}');`
const conceder = (n) => `select usuario || ':' || xp_ganho || ':' || xp_total || ':' || nivel_depois || ':' || itens_novos::text || ':' || motivo from public.conceder_recompensa('${partida(n)}');`
const comoNavegador = (sql, uid = A) => `begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}'; ${sql}; commit;`

test('0001–0007 no Postgres (duas vezes): o 2º lugar do todos contra todos ganha o bônus', { skip: !ARGS && 'defina DODGE_PG para rodar no Postgres' }, () => {
  psql(`drop database if exists ${BANCO}`, 'postgres')
  psql(`create database ${BANCO}`, 'postgres')
  try {
    psql(STUB)
    for (let vez = 0; vez < 2; vez++) for (const n of ['0001_contas', '0002_amigos', '0003_progresso', '0004_moderacao', '0005_pendencias', '0006_n_jogadores', '0007_ffa']) arquivo(migration(n))
    psql(`insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"full_name":"Ana"}'), ('${B}', '{"full_name":"Beto"}'), ('${C}', '{"full_name":"Caio"}'), ('${D}', '{"full_name":"Duda"}')`)
    assert.equal(psql('select public.xp_ffa_segundo()'), '10')

    // PVP de 2: igual à 0006
    psql(registrar(1) + encerrar(1))
    assert.equal(psql(conceder(1)), `${A}:60:60:1:[]:vitoria\n${B}:40:40:1:[]:derrota`)

    // ffa de 4: C 1º, A 2º, D 3º, B 4º
    psql(registrar(20, [A, B, C, D], 'ffa') + encerrar(20, { vencedor: 2, resultados: ['derrota', 'derrota', 'vitoria', 'derrota'], colocacoes: [2, 4, 1, 3] }))
    const xp = Object.fromEntries(psql(conceder(20)).split('\n').map((l) => [l.split(':')[0], Number(l.split(':')[1])]))
    assert.deepEqual(xp, { [A]: 50, [B]: 40, [C]: 60, [D]: 40 })
    // de novo não soma
    psql(conceder(20))
    assert.equal(psql(`select count(*) from public.concessoes where partida_id = '${partida(20)}'`), '4')

    // ffa de 3: o 2º também ganha
    psql(registrar(21, [B, C, D], 'ffa') + encerrar(21, { vencedor: 0, resultados: ['vitoria', 'derrota', 'derrota'], colocacoes: [1, 2, 3] }))
    assert.deepEqual(psql(conceder(21)).split('\n').map((l) => Number(l.split(':')[1])), [60, 50, 40])

    // o 2x2 não ganha bônus de colocação (nem tem)
    psql(registrar(22, [A, B, C, D], '2x2') + encerrar(22, { vencedor: null, resultados: ['vitoria', 'derrota', 'vitoria', 'derrota'] }))
    assert.deepEqual(psql(conceder(22)).split('\n').map((l) => Number(l.split(':')[1])), [60, 40, 60, 40])
  } finally {
    psql(`drop database if exists ${BANCO}`, 'postgres')
  }
})
