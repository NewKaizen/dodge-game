// A 0006 (Fase 5A) num Postgres de verdade (opcional): roda só com
//   DODGE_PG="-h /caminho/do/socket -p 5432 -U postgres" npm test
// (cria e apaga o banco dodge_teste_n_jogadores). Sem a variável, pula. Roda 0001–0006
// DUAS vezes e confere: os modos de 2 dão o mesmo XP de antes, uma partida de 4 lados
// registra o time e a colocação, e o XP sai UMA vez por conta (a 0005 dava várias linhas).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ARGS = process.env.DODGE_PG ? process.env.DODGE_PG.split(/\s+/).filter(Boolean) : null
const BANCO = 'dodge_teste_n_jogadores'
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

test('0001–0006 no Postgres (duas vezes): 2 lados como antes, 4 lados com time e colocação', { skip: !ARGS && 'defina DODGE_PG para rodar no Postgres' }, () => {
  psql(`drop database if exists ${BANCO}`, 'postgres')
  psql(`create database ${BANCO}`, 'postgres')
  try {
    psql(STUB)
    for (let vez = 0; vez < 2; vez++) for (const n of ['0001_contas', '0002_amigos', '0003_progresso', '0004_moderacao', '0005_pendencias', '0006_n_jogadores']) arquivo(migration(n))
    psql(`insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"full_name":"Ana"}'), ('${B}', '{"full_name":"Beto"}'), ('${C}', '{"full_name":"Caio"}'), ('${D}', '{"full_name":"Duda"}')`)

    // 1) 2 lados: o XP e a repetição de sempre (os mesmos números da 0005)
    psql(registrar(1) + encerrar(1))
    assert.equal(psql(conceder(1)), `${A}:60:60:1:[]:vitoria\n${B}:40:40:1:[]:derrota`)
    const ganhos = []
    for (let n = 2; n <= 6; n++) {
      psql(registrar(n) + encerrar(n))
      ganhos.push(psql(conceder(n)).split('\n')[0].split(':')[1])
    }
    assert.deepEqual(ganhos, ['60', '60', '30', '30', '0'])
    psql(registrar(7, [A, B], 'coop') + encerrar(7, { vencedor: null, resultados: ['vitoria', 'vitoria'] }))
    assert.deepEqual(psql(conceder(7)).split('\n').map((l) => l.split(':').slice(1, 2)[0] + ':' + l.split(':').at(-1)), ['60:vitoria', '60:vitoria'], 'CO-OP de 2: contagem separada do PVP')
    psql(registrar(8, [A, { ref: 'convidado:aaaa' }]) + encerrar(8, { resultados: ['vitoria', 'sem_relato'] }) + conceder(8))
    assert.equal(psql(`select oponente_ref from public.concessoes where partida_id = '${partida(8)}'`), 'convidado:aaaa')

    // 2) 4 lados (todos contra todos): lado 3, colocação, uma concessão por conta
    psql(registrar(20, [A, B, C, { ref: 'convidado:dddd' }], 'ffa') + encerrar(20, { vencedor: 2, resultados: ['derrota', 'derrota', 'vitoria', 'derrota'], colocacoes: [2, 4, 1, 3] }))
    assert.equal(psql(`select string_agg(lado || ':' || coalesce(colocacao::text, '-') || ':' || coalesce(time::text, '-'), ',' order by lado) from public.partida_participantes where partida_id = '${partida(20)}'`), '0:2:-,1:4:-,2:1:-,3:3:-')
    const linhas = psql(conceder(20)).split('\n')
    assert.equal(linhas.length, 3, 'uma linha por conta')
    assert.deepEqual(linhas.map((l) => l.split(':').slice(1, 2)[0]), ['40', '40', '60'])
    assert.equal(psql(`select count(*) from public.concessoes where partida_id = '${partida(20)}'`), '3')
    // o "oponente" de cada um: o primeiro outro lado com conta
    assert.equal(psql(`select oponente_id from public.concessoes where partida_id = '${partida(20)}' and user_id = '${A}'`), B)
    assert.equal(psql(`select oponente_id from public.concessoes where partida_id = '${partida(20)}' and user_id = '${B}'`), A)
    // chamar de novo não soma
    psql(conceder(20))
    assert.equal(psql(`select count(*) from public.concessoes where partida_id = '${partida(20)}'`), '3')

    // 3) 2x2: o time de cada lado
    psql(registrar(21, [A, B, C, D], '2x2') + encerrar(21, { vencedor: null, resultados: ['vitoria', 'derrota', 'vitoria', 'derrota'] }))
    assert.equal(psql(`select string_agg(time::text, ',' order by lado) from public.partida_participantes where partida_id = '${partida(21)}'`), '0,1,0,1')
    assert.equal(psql(conceder(21)).split('\n').length, 4)

    // 4) o que continua barrado: modo e lado que não existem
    assert.match(falha(registrar(30, [A, B], 'battle')), /partidas_modo_check/)
    assert.match(falha(registrar(31, [A, B, C, D, A], 'ffa')), /lado_check/)
    assert.match(falha(comoNavegador(registrar(32, [A, B], 'ffa'))), /permission denied/)
  } finally {
    psql(`drop database if exists ${BANCO}`, 'postgres')
  }
})
