// As migrations num Postgres de verdade (opcional): roda só com
//   DODGE_PG="-h /caminho/do/socket -p 5432 -U postgres" npm test
// (argumentos do psql de um servidor descartável: o teste cria e apaga o banco
// dodge_teste_progresso). Sem a variável, pula. Cria um "auth"/"storage" de
// mentira (o do Supabase), roda 0001–0003 DUAS vezes e confere a
// conceder_recompensa: idempotente, sem corrida, e fechada para o navegador.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ARGS = process.env.DODGE_PG ? process.env.DODGE_PG.split(/\s+/).filter(Boolean) : null
const BANCO = 'dodge_teste_progresso'
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
const partida = (n) => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const registrar = (n, lados = [A, B]) =>
  `select public.registrar_partida('${partida(n)}', 'pvp', 5, 'amigos', '${JSON.stringify(lados.map((u, lado) => ({ lado, user_id: u })))}');`
const encerrar = (n, { validacao = 'validada', vencedor = 0, duracao = 120, rodadas = 4, resultados = ['vitoria', 'derrota'] } = {}) =>
  `select public.encerrar_partida('${partida(n)}', '${validacao}', ${vencedor ?? 'null'}, 'normal', ${duracao}, ${rodadas ?? 'null'}, '${JSON.stringify(resultados.map((resultado, lado) => ({ lado, resultado, personagem: lado ? 'susie' : 'kris' })))}');`
const conceder = (n) => `select usuario || ':' || xp_ganho || ':' || xp_total || ':' || nivel_depois || ':' || itens_novos::text || ':' || motivo from public.conceder_recompensa('${partida(n)}');`
const comoNavegador = (sql, uid = A) => `begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}'; ${sql}; commit;`

test('migrations 0001–0003 no Postgres (duas vezes) e conceder_recompensa', { skip: !ARGS && 'defina DODGE_PG para rodar no Postgres' }, async () => {
  psql(`drop database if exists ${BANCO}`, 'postgres')
  psql(`create database ${BANCO}`, 'postgres')
  try {
    psql(STUB)
    for (let vez = 0; vez < 2; vez++) for (const n of ['0001_contas', '0002_amigos', '0003_progresso']) arquivo(migration(n))
    psql(`insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"full_name":"Ana"}'), ('${B}', '{"full_name":"Beto"}')`)

    // 1) normal: vitória da Ana
    psql(registrar(1) + registrar(1)) // repetido não duplica
    assert.equal(psql(`select count(*) from public.partida_participantes where partida_id = '${partida(1)}'`), '2')
    psql(encerrar(1))
    const primeira = psql(conceder(1))
    assert.equal(primeira, `${A}:60:60:1:[]:vitoria\n${B}:40:40:1:[]:derrota`)
    // de novo: o mesmo resultado, nada somado
    assert.equal(psql(conceder(1)), primeira)
    assert.equal(psql(`select xp from public.perfis where id = '${A}'`), '60')
    assert.equal(psql(`select count(*) from public.concessoes`), '2')
    assert.equal(psql(`select estado || '/' || validacao from public.partidas where id = '${partida(1)}'`), 'recompensada/validada')
    assert.equal(psql(`select partidas || '/' || vitorias || '/' || personagem_favorito from public.estatisticas_basicas where usuario_id = '${A}'`), '1/1/kris')
    // encerrar de novo não mexe numa partida já recompensada
    assert.equal(psql(encerrar(1, { vencedor: 1 })), 'recompensada')

    // 2) concorrência: duas sessões concedendo a mesma partida ao mesmo tempo
    psql(registrar(2) + encerrar(2))
    const [x, y] = await Promise.all([paralelo(conceder(2)), paralelo(conceder(2))])
    assert.equal(x, y)
    assert.equal(psql(`select xp from public.perfis where id = '${A}'`), '120')

    // 3) curta, contestada, convidado
    psql(registrar(3) + encerrar(3, { duracao: 30 }))
    assert.match(psql(conceder(3)), /:0:120:2:\[\]:curta/)
    psql(registrar(4, [A, null]) + encerrar(4, { validacao: 'contestada', vencedor: null, resultados: ['contestada', 'contestada'] }))
    assert.equal(psql(conceder(4)), `${A}:40:160:2:[]:contestada`)

    // 4) limite de repetição contra o mesmo oponente (partida 1 e 2 já contaram 2 com XP)
    const ganhos = []
    for (let n = 5; n <= 8; n++) {
      psql(registrar(n) + encerrar(n))
      ganhos.push(psql(conceder(n)).split('\n')[0].split(':')[1])
    }
    assert.deepEqual(ganhos, ['60', '30', '30', '0'])

    // 5) ainda não terminou: não concede
    psql(registrar(9))
    assert.match(falha(conceder(9)), /ainda não terminou/)

    // 6) o navegador não consegue: conceder, mexer no XP, no inventário, ler partidas
    assert.match(falha(comoNavegador(conceder(1))), /permission denied/)
    assert.match(falha(comoNavegador(registrar(10))), /permission denied/)
    assert.match(falha(comoNavegador(`update public.perfis set xp = 999999 where id = '${A}'`)), /permission denied/)
    assert.match(falha(comoNavegador(`insert into public.inventario (user_id, item_id) values ('${A}', 'titulo.cartomante')`)), /permission denied/)
    assert.match(falha(comoNavegador(`select * from public.partidas`)), /permission denied/)
    // lê só o próprio inventário e o catálogo
    assert.equal(psql(comoNavegador(`select count(*) from public.inventario where user_id = '${A}'`, B)), '0')
    assert.equal(psql(comoNavegador(`select count(*) from public.inventario where user_id <> '${A}'`, A)), '0')
    assert.equal(psql(comoNavegador(`select string_agg(item_id, ',') from public.inventario`, A)), 'titulo.esquivador,moldura.bronze')
    assert.equal(psql(comoNavegador(`select count(*) from public.catalogo_itens`)), '17')

    // 7) equipar: só o que tem (ou padrão)
    assert.match(psql(comoNavegador(`select titulo_equipado from public.equipar('titulo', 'titulo.esquivador')`)), /titulo\.esquivador/)
    assert.match(psql(comoNavegador(`select moldura_equipada from public.equipar('moldura', 'moldura.simples')`)), /moldura\.simples/)
    assert.match(falha(comoNavegador(`select public.equipar('titulo', 'titulo.cartomante')`)), /ainda não tem/)
    assert.match(falha(comoNavegador(`select public.equipar('moldura', 'titulo.esquivador')`)), /item inválido/)
    assert.match(falha(comoNavegador(`select public.equipar('avatar', null)`)), /outro avatar/)
    // avatar da trilha (o Beto não tem; a Ana chega no nível 5 e ganha o King)
    assert.match(falha(comoNavegador(`select public.equipar('avatar', 'avatar.king')`, B)), /ainda não tem/)
    psql(`update public.perfis set xp = 540 where id = '${A}'`)
    psql(registrar(11, [A, null]) + encerrar(11))
    assert.match(psql(conceder(11)), /:5:\["verso\.estrelas", "avatar\.king"\]:vitoria/)
    assert.match(psql(comoNavegador(`select avatar_tipo || '/' || avatar_id from public.equipar('avatar', 'avatar.king')`)), /jogo\/king/)
    psql(comoNavegador(`select public.equipar('titulo', null)`))
    assert.equal(psql(`select coalesce(titulo_equipado, '-') from public.perfis where id = '${A}'`), '-')
  } finally {
    psql(`drop database if exists ${BANCO}`, 'postgres')
  }
})
