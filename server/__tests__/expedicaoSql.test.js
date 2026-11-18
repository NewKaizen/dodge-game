// A 0017 (EXPEDIÇÃO) num Postgres de verdade (opcional): roda só com
//   DODGE_PG="-h /caminho/do/socket -p 5432 -U postgres" npm test
// (cria e apaga o banco dodge_teste_expedicao). Sem a variável, pula. Roda 0001–0017 (a 0016 e a 0017 duas vezes)
// e confere: os números iguais aos do navegador (src/lib/expedicao.js), o XP por luta + bônus uma vez por
// partida (repetida e em paralelo), o teto do dia, o verso exclusivo só na 1ª vez contra cada chefão, o baú
// 'expedicao:<dia>:<chefão>' só de expedição completa e uma vez, só CO-OP validada com o relato dizendo a mesma
// expedição, e o navegador só lendo o que é seu (sem chamar nada do servidor).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { XP_EXPEDICAO, DURACAO_MINIMA_LUTA_S } from '../../src/lib/expedicao.js'
import { ITENS_EXPEDICAO } from '../../src/lib/cosmeticos.js'

const ARGS = process.env.DODGE_PG ? process.env.DODGE_PG.split(/\s+/).filter(Boolean) : null
const BANCO = 'dodge_teste_expedicao'
const ANTIGAS = ['0001_contas', '0002_amigos', '0003_progresso', '0004_moderacao', '0005_pendencias', '0006_n_jogadores', '0007_ffa', '0008_filtro_palavras', '0009_2x2', '0010_boss_semanal', '0011_campanha', '0012_campanha_mundo1', '0013_desafio_diario', '0014_conquistas_maestria', '0015_baus_cosmeticos']
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
const partida = (n) => `30000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const registrar = (n, modo = 'coop') => `select public.registrar_partida('${partida(n)}', '${modo}', 22, 'amigos', '${JSON.stringify([{ lado: 0, user_id: A }, { lado: 1, user_id: B }])}');`
const encerrar = (n, { validacao = 'validada', duracao = 600, resultado = 'vitoria', chefe = 'king', lutas = 3, lutasB = lutas, chefeB = chefe, semB = false } = {}) => {
  const exp = (lado) => (lado === 1 && semB ? null : { chefe: lado === 1 ? chefeB : chefe, lutas: lado === 1 ? lutasB : lutas, sorteada: false })
  const lados = [0, 1].map((lado) => ({ lado, resultado, personagem: 'kris', relato: { vitoria: resultado === 'vitoria', ...(exp(lado) && { expedicao: exp(lado) }) } }))
  return `select public.encerrar_partida('${partida(n)}', '${validacao}', null, 'normal', ${duracao}, 24, '${JSON.stringify(lados)}');`
}
const xp = (n) => `select count(*) from public.conceder_recompensa('${partida(n)}');`
const exped = (n, chefe = 'king', lutas = 3) => `select coalesce(string_agg(usuario || ':' || xp_ganho || ':' || completa || ':' || coalesce(cosmetico, '-') || ':' || cosmetico_novo || ':' || repetida, ',' order by usuario), '') from public.conceder_expedicao('${partida(n)}', '${chefe}', ${lutas});`
const jogar = (n, opcoes = {}, chefe = opcoes.chefe ?? 'king', lutas = opcoes.lutas ?? 3) => {
  psql(registrar(n, opcoes.modo))
  psql(encerrar(n, opcoes))
  psql(xp(n))
  return psql(exped(n, chefe, lutas))
}
const hoje = () => psql(`select to_char(public.desafio_hoje(), 'YYYY-MM-DD')`)
const conceder = (ref, user = A) => `select (public.conceder_bau('${user}', 'expedicao', '${ref}') ->> 'novo')`
const comoNavegador = (sql, uid = A) => `begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}'; ${sql}; commit;`

test('0017 e 0018 no Postgres (duas vezes): expedição, verso exclusivo e o baú do dia por chefão', { skip: !ARGS && 'defina DODGE_PG para rodar no Postgres' }, async () => {
  psql(`drop database if exists ${BANCO}`, 'postgres')
  psql(`create database ${BANCO}`, 'postgres')
  try {
    psql(STUB)
    for (let vez = 0; vez < 2; vez++) for (const n of ANTIGAS) arquivo(migration(n))
    for (let vez = 0; vez < 2; vez++) for (const n of ['0016_cartas_estilos', '0017_expedicao']) arquivo(migration(n))
    // (0018 depois da 0017, também duas vezes: rodar a 0017 de novo DEPOIS da 0018 estreitaria o catálogo)
    for (let vez = 0; vez < 2; vez++) arquivo(migration('0018_expedicao_semanal'))
    psql(`insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"full_name":"Ana"}'), ('${B}', '{"full_name":"Beto"}')`)

    // os números e o catálogo são os do navegador
    assert.equal(psql(`select public.expedicao_xp_luta() || ':' || public.expedicao_xp_completa() || ':' || public.expedicao_xp_teto_dia() || ':' || public.expedicao_duracao_luta_s()`), `${XP_EXPEDICAO.porLuta}:${XP_EXPEDICAO.completa}:${XP_EXPEDICAO.tetoDia}:${DURACAO_MINIMA_LUTA_S}`)
    assert.equal(
      psql(`select string_agg(id || ':' || nome || ':' || expedicao || ':' || bau || ':' || nivel_requerido, '|' order by id collate "C") from public.catalogo_itens where expedicao is not null`),
      [...ITENS_EXPEDICAO].sort((a, b) => (a.id < b.id ? -1 : 1)).map((i) => `${i.id}:${i.nome}:${i.expedicao}:false:1000`).join('|'),
    )
    for (const i of ITENS_EXPEDICAO) assert.equal(psql(`select public.expedicao_item('${i.expedicao}')`), i.id)

    // completa contra o King: XP das 3 lutas + bônus, o verso; de novo a mesma partida: repetida, nada a mais
    const xpA0 = Number(psql(`select xp from public.perfis where id = '${A}'`))
    assert.equal(jogar(1), [A, B].map((u) => `${u}:${3 * XP_EXPEDICAO.porLuta + XP_EXPEDICAO.completa}:true:verso.exp_tabuleiro:true:false`).join(','))
    const xpA1 = Number(psql(`select xp from public.perfis where id = '${A}'`))
    assert.ok(xpA1 - xpA0 >= 3 * XP_EXPEDICAO.porLuta + XP_EXPEDICAO.completa)
    assert.equal(psql(exped(1)), [A, B].map((u) => `${u}:${3 * XP_EXPEDICAO.porLuta + XP_EXPEDICAO.completa}:true:verso.exp_tabuleiro:true:true`).join(','))
    assert.equal(Number(psql(`select xp from public.perfis where id = '${A}'`)), xpA1, 'repetida não soma')
    assert.equal(psql(`select count(*) from public.inventario where item_id = 'verso.exp_tabuleiro'`), '2')
    // em paralelo, outra partida: uma concessão por conta
    psql(registrar(2))
    psql(encerrar(2))
    psql(xp(2))
    const par = await Promise.all([1, 2, 3].map(() => psqlAsync(`select count(*) filter (where not repetida) from public.conceder_expedicao('${partida(2)}', 'king', 3)`)))
    assert.equal(par.map(Number).reduce((a, b) => a + b, 0), 2, par.join(','))
    // o verso só na 1ª vez contra o King
    assert.equal(psql(`select string_agg(cosmetico_novo::text, ',') from public.expedicoes where partida_id = '${partida(2)}'`), 'false,false')

    // o baú: só de expedição completa, uma vez por dia por chefão
    const dia = hoje()
    assert.equal(psql(conceder(`${dia}:king`)), 'true')
    assert.equal(psql(conceder(`${dia}:king`)), 'false')
    assert.match(falha(conceder(`${dia}:queen`)) ?? '', /expedição não completada/)
    assert.match(falha(conceder(`${dia}:kingLacaios`)) ?? '', /expedição não completada/)
    assert.match(falha(conceder(`2020-01-01:king`)) ?? '', /expedição não completada/)
    assert.equal(psql(`select chave from public.baus where fonte = 'expedicao' and user_id = '${A}'`), `expedicao:${dia}:king`)
    // a conceder_expedicao avisa que o baú de hoje já saiu
    assert.equal(psql(`select bau_hoje from public.conceder_expedicao('${partida(2)}', 'king', 3) where usuario = '${A}'`), 't')

    // caiu no tenente: só 1 luta, sem bônus, sem verso; o baú não sai
    assert.equal(jogar(3, { resultado: 'derrota', chefe: 'queen', lutas: 1 }), [A, B].map((u) => `${u}:${XP_EXPEDICAO.porLuta}:false:-:false:false`).join(','))
    assert.match(falha(conceder(`${dia}:queen`)) ?? '', /expedição não completada/)

    // sem nada: contestada, curta, PVP, relato sem a expedição, chefão diferente, lutas a mais que o relato
    assert.equal(jogar(4, { validacao: 'contestada', chefe: 'jevil' }), '')
    assert.equal(jogar(5, { duracao: 3 * DURACAO_MINIMA_LUTA_S - 1, chefe: 'jevil' }), '')
    assert.equal(jogar(6, { modo: 'pvp', chefe: 'jevil' }), '')
    // (A já tinha 85 + 85 + 15 hoje: esta para no teto, 255)
    assert.equal(jogar(7, { semB: true, chefe: 'jevil' }), `${A}:${XP_EXPEDICAO.tetoDia - 185}:true:verso.exp_dado:true:false`, 'só quem relatou a expedição')
    assert.equal(jogar(8, { chefeB: 'coronel', chefe: 'coronel', lutasB: 2 }, 'coronel', 3), `${A}:0:true:verso.exp_reciclador:true:false`, 'B relatou só 2 lutas; A já no teto do XP (o verso vem)')
    assert.match(falha(exped(9, 'kingTenente')) ?? '', /chefão inválido/)
    assert.match(falha(exped(9, 'king', 4)) ?? '', /lutas inválidas/)

    // (0018) a EXPEDIÇÃO SEMANAL: o chefe semanal vale na expedição (o verso dele e o baú do dia)
    assert.match(jogar(10, { chefe: 'ladra' }, 'ladra'), /verso\.exp_cofre:true:false$/)
    assert.equal(psql(conceder(`${dia}:ladra`)), 'true')
    assert.match(falha(conceder(`${dia}:escuridao`)) ?? '', /expedição não completada/)
    // o troféu da semana: só quem COMPLETOU a expedição semanal (B venceu, mas o relato dele não tem a expedição)
    psql(registrar(11))
    const semana = '2026-S47'
    const lados = [0, 1].map((lado) => ({ lado, resultado: 'vitoria', personagem: 'kris', relato: { vitoria: true, semana, ...(lado === 0 && { expedicao: { chefe: 'ladra', lutas: 3, sorteada: false } }) } }))
    psql(`select public.encerrar_partida('${partida(11)}', 'validada', null, 'normal', 900, 24, '${JSON.stringify(lados)}');`)
    psql(xp(11))
    assert.equal(psql(`select string_agg(usuario::text, ',') from public.conceder_trofeu_semanal('${partida(11)}', '${semana}', 'titulo.semanal_2026_47', 'titulo', 'Mão Leve S47/26')`), A)
    assert.equal(psql(`select public.semanal_chefes()::text`), '{escuridao,ladra}')

    // o teto do dia: 85 + 85 + 15 + 70 + 0
    assert.equal(psql(`select sum(xp) from public.expedicoes where user_id = '${A}'`), String(XP_EXPEDICAO.tetoDia))
    // (a da Ladra, depois do teto, também saiu com 0 de XP)
    assert.equal(psql(`select count(*) from public.expedicoes where user_id = '${A}' and xp = 0`), '2')

    // o navegador: lê só o que é seu e não chama nada do servidor
    assert.equal(psql(comoNavegador(`select count(*) from public.expedicoes`)), String(psql(`select count(*) from public.expedicoes where user_id = '${A}'`)))
    assert.equal(psql(comoNavegador(`select count(*) from public.expedicoes_chefes`, B)), String(psql(`select count(*) from public.expedicoes_chefes where user_id = '${B}'`)))
    assert.match(falha(comoNavegador(`select * from public.conceder_expedicao('${partida(1)}', 'king', 3)`)) ?? '', /permission denied/)
    assert.match(falha(comoNavegador(`select public.conceder_bau('${A}', 'expedicao', '${dia}:king')`)) ?? '', /permission denied/)
    assert.match(falha(comoNavegador(`insert into public.expedicoes (partida_id, user_id, chefe, lutas, dia) values ('${partida(1)}', '${A}', 'king', 3, now())`)) ?? '', /permission denied/)
  } finally {
    psql(`drop database if exists ${BANCO}`, 'postgres')
  }
})
