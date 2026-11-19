// A 0019 (BOTS DO JOGAR RÁPIDO) num Postgres de verdade (opcional): roda só com
//   DODGE_PG="-h /caminho/do/socket -p 5432 -U postgres" npm test
// (cria e apaga o banco dodge_teste_bots). Sem a variável, pula. Roda 0001–0019 (a 0019 duas vezes) e confere:
// o bot nasce como uma conta qualquer (perfil com tag, estatísticas, a trilha no inventário, os cosméticos
// equipados só se ele tem), o navegador LÊ o perfil do bot como lê o de qualquer um, mas NÃO vê public.bots
// nem chama as funções do servidor, o XP de uma partida contra o bot sai pela conceder_recompensa de sempre
// (para os dois), a vida fora da fila só vale para bots e tem teto, e apagar o bot leva tudo junto.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { nivelDoXp, itensAte } from '../../src/lib/progresso.js'

const ARGS = process.env.DODGE_PG ? process.env.DODGE_PG.split(/\s+/).filter(Boolean) : null
const BANCO = 'dodge_teste_bots'
const TODAS = ['0001_contas', '0002_amigos', '0003_progresso', '0004_moderacao', '0005_pendencias', '0006_n_jogadores', '0007_ffa', '0008_filtro_palavras', '0009_2x2', '0010_boss_semanal', '0011_campanha', '0012_campanha_mundo1', '0013_desafio_diario', '0014_conquistas_maestria', '0015_baus_cosmeticos', '0016_cartas_estilos', '0017_expedicao', '0018_expedicao_semanal', '0019_bots']
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
const comoNavegador = (sql, uid = A) => `begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}'; ${sql}; commit;`
const comoServidor = (sql) => `begin; set local role service_role; ${sql}; commit;`
const spec = (extra = {}) =>
  JSON.stringify({
    nome: 'CapivaraBraba',
    faixa: 'medio',
    q: 0.5,
    xp: 1500,
    partidas: 30,
    vitorias: 14,
    favoritos: ['susie', 'kris'],
    favorito: 'susie',
    dias_de_conta: 40,
    atividade: 5,
    avatar_tipo: 'jogo',
    avatar_id: 'king',
    itens: ['som.latido'],
    equipar: { titulo: 'titulo.esquivador', moldura: 'moldura.bronze', som: 'som.latido', efeito: 'efeito.chamas' },
    ...extra,
  })

test('migration 0019 no Postgres (duas vezes): bots iguais a contas, escondidos do navegador', { skip: !ARGS && 'defina DODGE_PG para rodar no Postgres' }, () => {
  psql(`drop database if exists ${BANCO}`, 'postgres')
  psql(`create database ${BANCO}`, 'postgres')
  try {
    psql(STUB)
    for (const n of TODAS) arquivo(migration(n))
    arquivo(migration('0019_bots')) // de novo: idempotente
    psql(`insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"full_name":"Ana"}')`)

    // 1) o servidor cria o bot: uma conta como as outras
    const id = psql(comoServidor(`select public.criar_bot('${spec()}')`))
    assert.match(id, /^[0-9a-f-]{36}$/)
    const nivel = nivelDoXp(1500)
    assert.equal(psql(`select nome_exibicao || '|' || nivel || '|' || xp || '|' || avatar_tipo || '|' || avatar_id from public.perfis where id = '${id}'`), `CapivaraBraba|${nivel}|1500|jogo|king`)
    assert.match(psql(`select tag from public.perfis where id = '${id}'`), /^capivarabrab#\d{4}$/)
    assert.ok(Number(psql(`select extract(day from now() - criado_em) from public.perfis where id = '${id}'`)) >= 39, 'a conta "nasceu" há um tempo')
    assert.equal(psql(`select partidas || '/' || vitorias || '/' || personagem_favorito from public.estatisticas_basicas where usuario_id = '${id}'`), '30/14/susie')
    const trilha = itensAte(nivel).map((i) => i.id)
    for (const item of trilha) assert.equal(psql(`select count(*) from public.inventario where user_id = '${id}' and item_id = '${item}'`), '1', item)
    assert.equal(psql(`select count(*) from public.inventario where user_id = '${id}' and item_id = 'som.latido'`), '1', 'o item do baú sorteado')
    // equipados: o que ele tem; o efeito que ele NÃO tem fica no padrão
    assert.equal(psql(`select titulo_equipado || '|' || moldura_equipada || '|' || som_equipado || '|' || coalesce(efeito_equipado, '-') from public.perfis where id = '${id}'`), 'titulo.esquivador|moldura.bronze|som.latido|-')
    assert.equal(psql(`select faixa || '|' || q || '|' || array_to_string(favoritos, ',') from public.bots where user_id = '${id}'`), 'medio|0.5|susie,kris')
    // nome que não serve (o filtro das contas) e faixa inválida
    assert.match(falha(comoServidor(`select public.criar_bot('${spec({ nome: 'a' })}')`)), /nome de bot inválido/)
    assert.match(falha(comoServidor(`select public.criar_bot('${spec({ faixa: 'deus' })}')`)), /faixa inválida/)

    // 2) o navegador lê o perfil e as estatísticas do bot como os de qualquer um...
    assert.equal(psql(comoNavegador(`select nome_exibicao from public.perfis where id = '${id}'`)), 'CapivaraBraba')
    assert.equal(psql(comoNavegador(`select partidas from public.estatisticas_basicas where usuario_id = '${id}'`)), '30')
    // ...mas não vê que ele é bot
    assert.match(falha(comoNavegador('select count(*) from public.bots')), /permission denied/)
    assert.match(falha(`begin; set local role anon; select count(*) from public.bots; commit;`), /permission denied/)
    for (const chamada of [`public.bots_listar()`, `public.bot_perfil('${id}')`, `public.criar_bot('${spec({ nome: 'OutroBot' })}')`, `public.bot_atividade('${id}', 1, 1, 60)`])
      assert.match(falha(comoNavegador(`select ${chamada}`)), /permission denied/, chamada)
    // o servidor lista
    const lista = JSON.parse(psql(comoServidor('select public.bots_listar()::text')))
    assert.equal(lista.length, 1)
    assert.equal(lista[0].perfil.id, id)
    assert.equal(lista[0].bot.faixa, 'medio')
    assert.equal(JSON.parse(psql(comoServidor(`select public.bot_perfil('${id}')::text`))).tag, psql(`select tag from public.perfis where id = '${id}'`))
    assert.equal(psql(comoServidor(`select coalesce(public.bot_perfil('${A}')::text, 'nada')`)), 'nada', 'perfil de gente não sai por aqui')

    // 3) pedido de amizade para o bot: fica pendente como qualquer outro
    psql(comoNavegador(`select public.enviar_pedido_amizade((select tag from public.perfis where id = '${id}'))`))
    assert.equal(psql(`select count(*) from public.pedidos_amizade where para = '${id}'`), '1')

    // 4) a partida contra o bot: o XP de sempre, para os dois
    const P = '40000000-0000-0000-0000-000000000001'
    psql(`select public.registrar_partida('${P}', 'pvp', 22, 'casual', '${JSON.stringify([{ lado: 0, user_id: A }, { lado: 1, user_id: id }])}')`)
    psql(`select public.encerrar_partida('${P}', 'validada', 0, 'normal', 180, 6, '${JSON.stringify([{ lado: 0, resultado: 'vitoria', personagem: 'kris' }, { lado: 1, resultado: 'derrota', personagem: 'susie' }])}')`)
    const xp = psql(`select string_agg(case when usuario = '${A}' then 'ana' else 'bot' end || ':' || xp_ganho || ':' || motivo, ',' order by xp_ganho desc) from public.conceder_recompensa('${P}')`)
    assert.equal(xp, 'ana:60:vitoria,bot:40:derrota')
    assert.equal(psql(`select xp from public.perfis where id = '${id}'`), '1540')
    assert.equal(psql(`select partidas || '/' || vitorias from public.estatisticas_basicas where usuario_id = '${id}'`), '31/14')

    // 5) a vida fora da fila: só bot, com teto
    const r = JSON.parse(psql(comoServidor(`select public.bot_atividade('${id}', 50, 60, 99999)::text`)))
    assert.equal(r.partidas, 20, 'no máximo 20 de uma vez')
    assert.equal(r.vitorias, 20)
    assert.equal(r.xp_total, 1540 + 20 * 60)
    assert.match(falha(comoServidor(`select public.bot_atividade('${A}', 1, 1, 60)`)), /não é um bot/)

    // 6) apagar o bot leva tudo junto (o perfil, as estatísticas, o inventário e a marca)
    psql(`delete from auth.users where id in (select user_id from public.bots)`)
    for (const [tabela, coluna] of [['perfis', 'id'], ['estatisticas_basicas', 'usuario_id'], ['inventario', 'user_id'], ['bots', 'user_id']]) assert.equal(psql(`select count(*) from public.${tabela} where ${coluna} = '${id}'`), '0', tabela)
  } finally {
    psql(`drop database if exists ${BANCO}`, 'postgres')
  }
})
