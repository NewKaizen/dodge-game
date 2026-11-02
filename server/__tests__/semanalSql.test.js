// A 0010 (BOSS SEMANAL) num Postgres de verdade (opcional): roda só com
//   DODGE_PG="-h /caminho/do/socket -p 5432 -U postgres" npm test
// (cria e apaga o banco dodge_teste_semanal). Sem a variável, pula. Roda 0001–0010 DUAS vezes e confere:
// o troféu da semana sai uma vez por conta, só numa vitória validada de CO-OP com a duração mínima e o
// relato da mesma semana; a trilha de níveis nunca entrega troféu; o navegador só lê os seus e equipa.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ARGS = process.env.DODGE_PG ? process.env.DODGE_PG.split(/\s+/).filter(Boolean) : null
const BANCO = 'dodge_teste_semanal'
const MIGRATIONS = ['0001_contas', '0002_amigos', '0003_progresso', '0004_moderacao', '0005_pendencias', '0006_n_jogadores', '0007_ffa', '0008_filtro_palavras', '0009_2x2', '0010_boss_semanal']
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
const partida = (n) => `20000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const SEMANA = '2026-S45'
const ITEM = 'titulo.semanal_2026_45'
// coop4 com A, B e um convidado; relatos com a semana (o de B pode vir de outra semana)
const registrar = (n, modo = 'coop4') => `select public.registrar_partida('${partida(n)}', '${modo}', 15, 'amigos', '${JSON.stringify([{ lado: 0, user_id: A }, { lado: 1, user_id: B }, { lado: 2, user_id: null, ref: 'convidado' }])}');`
const encerrar = (n, { validacao = 'validada', duracao = 300, rodadas = 6, resultado = 'vitoria', semanaB = SEMANA } = {}) => {
  const lados = [0, 1, 2].map((lado) => ({ lado, resultado, personagem: 'kris', relato: { vitoria: resultado === 'vitoria', semana: lado === 1 ? semanaB : SEMANA } }))
  return `select public.encerrar_partida('${partida(n)}', '${validacao}', null, 'normal', ${duracao}, ${rodadas}, '${JSON.stringify(lados)}');`
}
const xp = (n) => `select count(*) from public.conceder_recompensa('${partida(n)}');`
const trofeu = (n, item = ITEM, semana = SEMANA) => `select coalesce(string_agg(usuario || ':' || item_id || ':' || novo, ',' order by usuario), '') from public.conceder_trofeu_semanal('${partida(n)}', '${semana}', '${item}', '${item.split('.')[0]}', 'Ouvido Absoluto S45/26');`
const comoNavegador = (sql, uid = A) => `begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}'; ${sql}; commit;`

test('0010 no Postgres (duas vezes): troféu semanal uma vez, só em vitória validada', { skip: !ARGS && 'defina DODGE_PG para rodar no Postgres' }, () => {
  psql(`drop database if exists ${BANCO}`, 'postgres')
  psql(`create database ${BANCO}`, 'postgres')
  try {
    psql(STUB)
    for (let vez = 0; vez < 2; vez++) for (const n of MIGRATIONS) arquivo(migration(n))
    psql(`insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"full_name":"Ana"}'), ('${B}', '{"full_name":"Beto"}')`)

    // vitória validada: as duas contas ganham (o convidado não tem conta); de novo não duplica
    psql(registrar(1) + encerrar(1) + xp(1))
    assert.equal(psql(trofeu(1)), `${A}:${ITEM}:true,${B}:${ITEM}:true`)
    assert.equal(psql(trofeu(1)), `${A}:${ITEM}:false,${B}:${ITEM}:false`)
    assert.equal(psql(`select exclusivo || ':' || semana || ':' || nivel_requerido from public.catalogo_itens where id = '${ITEM}'`), `true:${SEMANA}:1000`)
    assert.equal(psql(`select count(*) from public.trofeus_semanais`), '2')
    assert.equal(psql(`select semana from public.partidas where id = '${partida(1)}'`), SEMANA)
    // outra vitória na mesma semana: XP sim, troféu já era (novo = false, uma linha por conta)
    psql(registrar(2) + encerrar(2) + xp(2))
    assert.equal(psql(trofeu(2)), `${A}:${ITEM}:false,${B}:${ITEM}:false`)
    assert.equal(psql(`select count(*) from public.inventario where item_id = '${ITEM}'`), '2')

    // nada: contestada, curta, poucas rodadas, derrota, PVP, relato de outra semana (só B fica de fora)
    const nada = [
      [3, { validacao: 'contestada', resultado: 'contestada' }],
      [4, { duracao: 59 }],
      [5, { rodadas: 1 }],
      [6, { resultado: 'derrota' }],
    ]
    for (const [n, op] of nada) {
      psql(registrar(n) + encerrar(n, op) + xp(n))
      assert.equal(psql(trofeu(n, 'moldura.semanal_2026_46', '2026-S46')), '', JSON.stringify(op))
    }
    psql(registrar(8) + encerrar(8, { semanaB: '2026-S44' }) + xp(8))
    assert.equal(psql(trofeu(8, 'moldura.semanal_2026_46', '2026-S46')), '', 'nenhum relato diz a S46')
    psql(registrar(9) + encerrar(9, { semanaB: '2026-S44' }) + xp(9))
    assert.equal(psql(`select count(*) from public.conceder_trofeu_semanal('${partida(9)}', '${SEMANA}', '${ITEM}', 'titulo', 'x')`), '1', 'só A disse a semana certa')
    // o item tem de ser o da semana
    assert.match(falha(trofeu(1, 'verso.semanal_2026_47')), /troféu inválido/)
    assert.match(falha(trofeu(1, 'titulo.novato')), /troféu inválido/)

    // a trilha de níveis nunca entrega um exclusivo (nível 1000 > 99), nem com XP de sobra
    psql(`update public.perfis set xp = 999999 where id = '${A}'`)
    psql(registrar(10) + encerrar(10) + xp(10))
    assert.equal(psql(`select count(*) from public.inventario where user_id = '${B}' and item_id like '%semanal%'`), '1')
    assert.match(falha(`insert into public.catalogo_itens (id, tipo, nome, nivel_requerido, exclusivo, semana) values ('verso.semanal_2030_01', 'verso', 'x', 5, true, '2030-S01')`), /catalogo_exclusivo_coerente/)

    // navegador: lê só os seus troféus, não chama a concessão, equipa o que tem
    assert.equal(psql(comoNavegador(`select count(*) from public.trofeus_semanais`)), '1')
    assert.match(falha(comoNavegador(trofeu(1))), /permission denied/)
    assert.match(falha(comoNavegador(`insert into public.trofeus_semanais (user_id, semana, item_id) values ('${A}', '2026-S50', '${ITEM}')`)), /permission denied/)
    assert.equal(psql(comoNavegador(`select titulo_equipado from public.equipar('titulo', '${ITEM}')`)), ITEM)
  } finally {
    psql(`drop database if exists ${BANCO}`, 'postgres')
  }
})
