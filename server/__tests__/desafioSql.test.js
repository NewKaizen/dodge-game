// A 0013 (DESAFIO DIÁRIO) e a 0014 (CONQUISTAS e MAESTRIA) num Postgres de verdade (opcional): roda só com
//   DODGE_PG="-h /caminho/do/socket -p 5432 -U postgres" npm test
// (cria e apaga o banco dodge_teste_desafio). Sem a variável, pula. Roda 0001–0014 DUAS vezes e confere:
// os números iguais aos do navegador, a recompensa do dia UMA vez (repetida, outra corrida, em paralelo),
// o recorde, o dia fora da janela, o cosmético da semana, os recordes dos amigos (sem bloqueado), a
// maestria (teto do dia, cosméticos do nível), as conquistas só novas e o navegador só lendo o que é seu.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { XP_DESAFIO, DIAS_COSMETICO_SEMANA, VERSAO_DESAFIO, MAX_AMIGOS_RECORDE } from '../../src/lib/desafio.js'
import { ITENS_MAESTRIA, IDS_CONQUISTAS, MAESTRIA_TETO_DIA, nivelDaMaestria, pontosDeMaestria } from '../../src/lib/conquistas.js'

const ARGS = process.env.DODGE_PG ? process.env.DODGE_PG.split(/\s+/).filter(Boolean) : null
const BANCO = 'dodge_teste_desafio'
const MIGRATIONS = ['0001_contas', '0002_amigos', '0003_progresso', '0004_moderacao', '0005_pendencias', '0006_n_jogadores', '0007_ffa', '0008_filtro_palavras', '0009_2x2', '0010_boss_semanal', '0011_campanha', '0012_campanha_mundo1', '0013_desafio_diario', '0014_conquistas_maestria']
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
const C = '00000000-0000-0000-0000-00000000000c'
const corrida = (n) => `40000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const HOJE = `public.desafio_hoje()`
const conceder = (n, { user = A, resultado = 'vitoria', pontos = 1500, dia = HOJE, item = 'null', tipo = 'null' } = {}) =>
  `select (r ->> 'xp_ganho') || ':' || (r ->> 'motivo') || ':' || (r ->> 'recorde') from (select public.conceder_desafio('${corrida(n)}', '${user}', ${dia}, ${VERSAO_DESAFIO}, '${resultado}', null, ${pontos}, 6, 2, 120, ${item}, ${tipo}, 'Cosmético') r) x`
const comoNavegador = (sql, uid = A) => `begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}'; ${sql}; commit;`

test('0013 + 0014 no Postgres (duas vezes): desafio diário, conquistas e maestria', { skip: !ARGS && 'defina DODGE_PG para rodar no Postgres' }, async () => {
  psql(`drop database if exists ${BANCO}`, 'postgres')
  psql(`create database ${BANCO}`, 'postgres')
  try {
    psql(STUB)
    for (let vez = 0; vez < 2; vez++) for (const n of MIGRATIONS) arquivo(migration(n))
    psql(`insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"full_name":"Ana"}'), ('${B}', '{"full_name":"Beto"}'), ('${C}', '{"full_name":"Cris"}')`)

    // os números são os do navegador (src/lib/desafio.js e src/lib/conquistas.js)
    assert.equal(psql(`select public.desafio_xp() || ':' || public.desafio_dias_semana() || ':' || public.desafio_versao() || ':' || public.desafio_max_amigos() || ':' || public.maestria_teto_dia()`), `${XP_DESAFIO}:${DIAS_COSMETICO_SEMANA}:${VERSAO_DESAFIO}:${MAX_AMIGOS_RECORDE}:${MAESTRIA_TETO_DIA}`)
    for (const p of [0, 1, 9, 10, 29, 30, 99, 100, 449, 450, 9999]) assert.equal(psql(`select public.maestria_nivel(${p})`), String(nivelDaMaestria(p)), `nível de ${p}`)
    for (const r of ['vitoria', 'derrota', 'empate', 'participacao', 'abandono', 'contestada']) assert.equal(psql(`select public.maestria_pontos('${r}')`), String(pontosDeMaestria(r)))
    assert.equal(psql(`select array_to_string(public.conquistas_ids(), ',')`), IDS_CONQUISTAS.join(','))
    assert.equal(
      psql(`select string_agg(id || '=' || nome || ':' || maestria_personagem || ':' || maestria_nivel, '|' order by id) from public.catalogo_itens where maestria_personagem is not null`),
      [...ITENS_MAESTRIA].sort((a, b) => (a.id < b.id ? -1 : 1)).map((i) => `${i.id}=${i.nome}:${i.personagem}:${i.maestria}`).join('|'),
    )
    assert.equal(psql(`select public.desafio_semana('2026-11-09') || ',' || public.desafio_semana('2026-11-08') || ',' || public.desafio_semana('2027-01-01')`), '2026-S46,2026-S45,2026-S53')

    // ---------- DESAFIO DIÁRIO ----------
    // primeira vitória do dia: XP; a mesma corrida de novo: o mesmo, nada soma
    assert.equal(psql(conceder(1)), `${XP_DESAFIO}:desafio:1500`)
    assert.equal(psql(conceder(1, { pontos: 9000 })), `${XP_DESAFIO}:desafio:1500`)
    // outra corrida no mesmo dia: 0 XP (repetição livre), mas o recorde sobe; derrota pior não baixa
    assert.equal(psql(conceder(2, { pontos: 1800 })), '0:repeticao:1800')
    assert.equal(psql(conceder(3, { resultado: 'derrota', pontos: 400 })), '0:derrota:1800')
    assert.equal(psql(conceder(4, { resultado: 'suspeita', pontos: 99999 })), '0:suspeita:1800')
    assert.equal(psql(`select xp from public.perfis where id = '${A}'`), String(XP_DESAFIO))
    assert.equal(psql(`select count(*) from public.desafio_concluidos where user_id = '${A}'`), '1')
    // ontem ainda vale (corrida que virou a meia-noite); anteontem e amanhã, não
    assert.equal(psql(conceder(5, { dia: `${HOJE} - 1` })).split(':')[0], String(XP_DESAFIO))
    assert.match(falha(conceder(6, { dia: `${HOJE} - 2` })), /dia inválido/)
    assert.match(falha(conceder(7, { dia: `${HOJE} + 1` })), /dia inválido/)
    assert.match(falha(`select public.conceder_desafio('${corrida(8)}', '${A}', ${HOJE}, 99, 'vitoria', null, 1, 1, 0, 1, null, null, null)`), /versão inválida/)

    // em PARALELO: duas corridas do Beto vencendo ao mesmo tempo dão o XP uma vez só
    const r = await Promise.all([10, 11, 12].map((n) => psqlAsync(conceder(n, { user: B, pontos: 1000 + n }))))
    assert.equal(r.filter((x) => x.startsWith(`${XP_DESAFIO}:`)).length, 1, r.join(' | '))
    assert.equal(psql(`select xp from public.perfis where id = '${B}'`), String(XP_DESAFIO))
    assert.equal(psql(`select pontos from public.desafio_recordes where user_id = '${B}' and dia = ${HOJE}`), '1012')

    // o cosmético da semana: o Cris vence em 3 outros dias desta semana; no 4º, o item (só se o id for o da semana)
    const semana = psql(`select public.desafio_semana(${HOJE})`)
    const item = `'verso.diario_${semana.replace('-S', '_')}'`
    const outros = psql(`select string_agg(d::text, ',') from (select (date_trunc('week', ${HOJE})::date + k) d from generate_series(0, 6) k) x where d <> ${HOJE}`).split(',').slice(0, DIAS_COSMETICO_SEMANA - 1)
    for (const d of outros) psql(`insert into public.desafio_concluidos (user_id, dia, semana) values ('${C}', '${d}', '${semana}')`)
    assert.equal(psql(conceder(20, { user: C, item: `'verso.diario_1999_01'`, tipo: `'verso'` })).split(':')[0], String(XP_DESAFIO))
    assert.equal(psql(`select count(*) from public.desafio_semanas where user_id = '${C}'`), '0') // id errado: nada
    psql(`delete from public.desafio_concluidos where user_id = '${C}' and dia = ${HOJE}`)
    psql(`delete from public.desafio_corridas where user_id = '${C}'`)
    psql(`delete from public.desafio_recordes where user_id = '${C}'`)
    const comItem = JSON.parse(psql(`select public.conceder_desafio('${corrida(21)}', '${C}', ${HOJE}, ${VERSAO_DESAFIO}, 'vitoria', null, 700, 6, 0, 100, ${item}, 'verso', 'Alvorada')`))
    assert.equal(comItem.cosmetico_novo, item.slice(1, -1))
    assert.ok(comItem.itens_novos.includes(item.slice(1, -1)))
    assert.equal(comItem.dias_semana, DIAS_COSMETICO_SEMANA)
    assert.equal(psql(`select nivel_requerido || ':' || exclusivo || ':' || semana from public.catalogo_itens where id = ${item}`), `1000:true:${semana}`)

    // os recordes dos amigos: só amizade, sem bloqueio
    psql(`insert into public.amizades (a, b) values ('${A}', '${B}'), ('${A}', '${C}')`)
    let est = JSON.parse(psql(`select public.desafio_estado('${A}', ${HOJE})`))
    assert.deepEqual(est.amigos.map((x) => [x.id, x.pontos]), [[B, 1012], [C, 700]])
    assert.equal(est.recorde.pontos, 1800)
    assert.equal(est.concluido, true)
    psql(`insert into public.bloqueios (quem, bloqueado) values ('${C}', '${A}')`)
    est = JSON.parse(psql(`select public.desafio_estado('${A}', ${HOJE})`))
    assert.deepEqual(est.amigos.map((x) => x.id), [B])
    assert.equal(JSON.parse(psql(`select public.desafio_estado('${B}', ${HOJE})`)).amigos.length, 1) // o Beto vê a Ana

    // ---------- MAESTRIA e CONQUISTAS ----------
    const evento = (ref, resultado, personagem = 'kris', user = A) => JSON.parse(psql(`select public.registrar_evento_conta('${user}', '${ref}', 'partida', 'pvp', '${personagem}', '${resultado}')`))
    const e1 = evento('partida:00000001', 'vitoria')
    assert.equal(e1.novo, true)
    assert.equal(e1.maestria.pontos, 3)
    assert.equal(evento('partida:00000001', 'vitoria').novo, false) // repetido: nada soma
    assert.equal(psql(`select pontos from public.maestria where user_id = '${A}' and personagem = 'kris'`), '3')
    // o teto do dia por personagem
    for (let i = 2; i <= 15; i++) evento(`partida:${String(i).padStart(8, '0')}`, 'vitoria')
    assert.equal(psql(`select pontos from public.maestria where user_id = '${A}' and personagem = 'kris'`), String(MAESTRIA_TETO_DIA))
    // personagem que não existe: sem maestria (o evento conta para o resumo)
    const e2 = evento('partida:99999999', 'vitoria', 'goku')
    assert.equal(e2.maestria, null)
    assert.equal(e2.resumo.vitorias, 16)
    // o título do nível 5 chega com a maestria (a trilha de níveis nunca entrega)
    psql(`update public.maestria set pontos = 99 where user_id = '${A}' and personagem = 'kris'`)
    psql(`delete from public.conta_eventos where user_id = '${A}'`)
    const e3 = evento('campanha:0000000a', 'vitoria')
    assert.equal(e3.maestria.nivel_depois, 5)
    assert.deepEqual(e3.itens_novos, ['titulo.maestria_kris'])
    psql(`update public.perfis set xp = 999999 where id = '${B}'`)
    assert.equal(psql(conceder(30, { user: B })).split(':')[1], 'repeticao')
    assert.equal(psql(`select count(*) from public.inventario where user_id = '${B}' and item_id like '%maestria%'`), '0')
    // conquistas: só ids conhecidos, só as novas
    assert.equal(psql(`select array_to_string(public.desbloquear_conquistas('${A}', array['bom_dia', 'primeira_vitoria', 'inventada', 'bom_dia']), ',')`), 'bom_dia,primeira_vitoria')
    assert.equal(psql(`select array_to_string(public.desbloquear_conquistas('${A}', array['bom_dia', 'coruja']), ',')`), 'coruja')
    const da = JSON.parse(psql(`select public.conquistas_da_conta('${A}')`))
    assert.deepEqual(da.conquistas.map((c) => c.id), ['bom_dia', 'coruja', 'primeira_vitoria'])
    assert.equal(da.maestria[0].personagem, 'kris')

    // navegador: lê só o que é seu e não chama nada do servidor
    assert.equal(psql(comoNavegador(`select count(*) from public.desafio_recordes`)), '2')
    assert.equal(psql(comoNavegador(`select count(*) from public.conquistas`, B)), '0')
    assert.equal(psql(comoNavegador(`select count(*) from public.maestria`)), '1')
    assert.match(falha(comoNavegador(`select count(*) from public.conta_eventos`)), /permission denied/)
    assert.match(falha(comoNavegador(conceder(40))), /permission denied/)
    assert.match(falha(comoNavegador(`select public.desafio_estado('${A}', ${HOJE})`)), /permission denied/)
    assert.match(falha(comoNavegador(`select public.registrar_evento_conta('${A}', 'partida:77777777', 'partida', 'pvp', 'kris', 'vitoria')`)), /permission denied/)
    assert.match(falha(comoNavegador(`select public.desbloquear_conquistas('${A}', array['coruja'])`)), /permission denied/)
    assert.match(falha(comoNavegador(`insert into public.conquistas (user_id, conquista) values ('${A}', 'lenda_da_mesa')`)), /permission denied/)
    assert.match(falha(comoNavegador(`update public.maestria set pontos = 9999`)), /permission denied/)
    // o título da maestria equipa como os outros
    assert.equal(psql(comoNavegador(`select titulo_equipado from public.equipar('titulo', 'titulo.maestria_kris')`)), 'titulo.maestria_kris')
  } finally {
    psql(`drop database if exists ${BANCO}`, 'postgres')
  }
})
