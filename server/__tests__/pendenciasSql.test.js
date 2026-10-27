// A 0005 (Fase 2F) num Postgres de verdade (opcional): roda só com
//   DODGE_PG="-h /caminho/do/socket -p 5432 -U postgres" npm test
// (argumentos do psql de um servidor descartável: o teste cria e apaga o banco
// dodge_teste_pendencias). Sem a variável, pula. Roda 0001–0005 DUAS vezes e confere:
// o nome do Google passando pelo filtro (igual ao JS), o XP do CO-OP (contas de
// repetição por modo) e a chave dos convidados.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { nomeInicialDoGoogle } from '../../src/lib/contaRegras.js'

const ARGS = process.env.DODGE_PG ? process.env.DODGE_PG.split(/\s+/).filter(Boolean) : null
const BANCO = 'dodge_teste_pendencias'
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
// lados: ids de conta, ou { ref } para um convidado
const registrar = (n, lados = [A, B], modo = 'pvp') =>
  `select public.registrar_partida('${partida(n)}', '${modo}', 5, 'amigos', '${JSON.stringify(lados.map((u, lado) => (typeof u === 'object' && u ? { lado, user_id: null, ref: u.ref } : { lado, user_id: u })))}');`
const encerrar = (n, { validacao = 'validada', vencedor = 0, duracao = 120, rodadas = 4, resultados = ['vitoria', 'derrota'] } = {}) =>
  `select public.encerrar_partida('${partida(n)}', '${validacao}', ${vencedor ?? 'null'}, 'normal', ${duracao}, ${rodadas ?? 'null'}, '${JSON.stringify(resultados.map((resultado, lado) => ({ lado, resultado, personagem: lado ? 'susie' : 'kris' })))}');`
const conceder = (n) => `select usuario || ':' || xp_ganho || ':' || xp_total || ':' || nivel_depois || ':' || itens_novos::text || ':' || motivo from public.conceder_recompensa('${partida(n)}');`
const comoNavegador = (sql, uid = A) => `begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}'; ${sql}; commit;`

test('0001–0005 no Postgres (duas vezes): nome do Google filtrado, XP do CO-OP e convidados', { skip: !ARGS && 'defina DODGE_PG para rodar no Postgres' }, () => {
  psql(`drop database if exists ${BANCO}`, 'postgres')
  psql(`create database ${BANCO}`, 'postgres')
  try {
    psql(STUB)
    for (let vez = 0; vez < 2; vez++) for (const n of ['0001_contas', '0002_amigos', '0003_progresso', '0004_moderacao', '0005_pendencias']) arquivo(migration(n))
    psql(`insert into auth.users (id, raw_user_meta_data) values ('${A}', '{"full_name":"Ana"}'), ('${B}', '{"full_name":"Beto"}')`)

    // 1) nome inicial do Google: o banco e o JS (nomeInicialDoGoogle) concordam
    const nomes = ['Ana Clara', 'Caralho', 'Hitler 99', 'c.a.r.a.l.h.o', 'xputax', 'Puta', 'F D P', 'Fulano de Tal Muito Comprido', 'Jo', '', 'Kris_2000', 'p.u.t.a', 'Computador']
    nomes.forEach((nome, i) => {
      const id = `00000000-0000-0000-0000-0000000001${String(i).padStart(2, '0')}`
      psql(`insert into auth.users (id, raw_user_meta_data) values ('${id}', '${JSON.stringify({ full_name: nome }).replace(/'/g, "''")}')`)
      assert.equal(psql(`select nome_exibicao from public.perfis where id = '${id}'`), nomeInicialDoGoogle(nome), `nome do Google: "${nome}"`)
    })
    // a tag nasce do nome já filtrado (nunca da palavra da lista) e o formato continua valendo
    const tags = psql(`select string_agg(tag, ',' order by id) from public.perfis where id::text like '00000000-0000-0000-0000-0000000001%'`).split(',')
    assert.ok(tags.every((t) => /^[a-z0-9]{3,12}#[0-9]{4,6}$/.test(t)), tags.join(' '))
    assert.match(tags[1], /^jogador#/, 'Caralho -> jogador#')
    assert.match(tags[11], /^jogador#/, 'p.u.t.a: nome fica, mas a tag não vira "puta"')
    assert.match(tags[0], /^ana#/)

    // perfil antigo com nome da lista: a 0005 (de novo) troca o nome e não mexe na tag
    psql(`update public.perfis set nome_exibicao = 'Hitler99' where id = '${B}'`)
    const tagB = psql(`select tag from public.perfis where id = '${B}'`)
    arquivo(migration('0005_pendencias'))
    assert.equal(psql(`select nome_exibicao || '/' || tag from public.perfis where id = '${B}'`), `JOGADOR/${tagB}`)

    // 2) CO-OP: concede como o PVP, contagem de repetição separada por modo
    psql(registrar(1, [A, B], 'coop') + encerrar(1, { validacao: 'validada', vencedor: null, resultados: ['vitoria', 'vitoria'] }))
    assert.equal(psql(conceder(1)), `${A}:60:60:1:[]:vitoria\n${B}:60:60:1:[]:vitoria`)
    assert.equal(psql(`select modo from public.partidas where id = '${partida(1)}'`), 'coop')
    const ganhosCoop = []
    for (let n = 2; n <= 6; n++) {
      psql(registrar(n, [A, B], 'coop') + encerrar(n, { vencedor: null, resultados: ['vitoria', 'derrota'] }))
      ganhosCoop.push(psql(conceder(n)).split('\n')[0].split(':')[1])
    }
    // a 1ª já valeu 60; depois mais 2 cheias, 2 pela metade e 0
    assert.deepEqual(ganhosCoop, ['60', '60', '30', '30', '0'])
    // o PVP com o mesmo parceiro começa do zero
    psql(registrar(7) + encerrar(7))
    assert.equal(psql(conceder(7)).split('\n')[0].split(':')[1], '60')
    // coop contestada / curta / sem relato como no PVP
    psql(registrar(8, [A, B], 'coop') + encerrar(8, { duracao: 30, vencedor: null, resultados: ['vitoria', 'vitoria'] }))
    assert.match(psql(conceder(8)), /:0:[0-9]+:[0-9]+:\[\]:curta/)

    // 3) convidados: a chave (ref) separa os convidados; o mesmo 'convidado' junta; teto por dia
    const xpContra = (n, ref) => {
      psql(registrar(n, [A, { ref }]) + encerrar(n, { resultados: ['vitoria', 'sem_relato'] }))
      return psql(conceder(n)).split('\n').find((l) => l.startsWith(A)).split(':')[1]
    }
    assert.equal(psql(`select count(*) from public.partida_participantes where ref is not null`), '0')
    // a conta A já tem 3 partidas PVP de hoje com o Beto; convidados são outro oponente
    const individuais = ['convidado:aaaa', 'convidado:bbbb', 'convidado:cccc'].map((ref, i) => xpContra(20 + i, ref))
    assert.deepEqual(individuais, ['60', '60', '60'], 'cada convidado novo conta do zero')
    const mesmo = [xpContra(30, 'convidado:aaaa'), xpContra(31, 'convidado:aaaa'), xpContra(32, 'convidado:aaaa')]
    assert.deepEqual(mesmo, ['60', '60', '30'], 'o mesmo convidado repetido: 3 cheias no total (a 1ª já foi), depois metade')
    const juntos = [xpContra(40, 'convidado'), xpContra(41, 'convidado'), xpContra(42, 'convidado'), xpContra(43, 'convidado')]
    assert.deepEqual(juntos, ['60', '60', '60', '30'], 'chave "convidado" (mesmo endereço) junta todos num só')
    assert.equal(psql(`select ref from public.partida_participantes where partida_id = '${partida(40)}' and lado = 1`), 'convidado')
    assert.equal(psql(`select oponente_ref from public.concessoes where partida_id = '${partida(40)}'`), 'convidado')
    // ref inválida é ignorada (não vira chave) e conta com user_id não leva ref
    psql(registrar(50, [A, { ref: 'x; drop table' }]))
    assert.equal(psql(`select coalesce(ref, '-') from public.partida_participantes where partida_id = '${partida(50)}' and lado = 1`), '-')
    // teto diário contra convidados (todos somados): 10 com XP hoje
    const usadas = Number(psql(`select count(*) from public.concessoes c join public.partidas p on p.id = c.partida_id where c.user_id = '${A}' and c.xp > 0 and p.modo = 'pvp' and c.oponente_id is null and c.oponente_ref is not null`))
    assert.equal(usadas, 3 + 3 + 4)
    assert.equal(xpContra(60, 'convidado:novo1'), '0', 'passou do teto diário contra convidados')
    assert.match(psql(`select motivo from public.concessoes where partida_id = '${partida(60)}'`), /repeticao/)

    // 4) o navegador não chama nada disso
    assert.match(falha(comoNavegador(`select public.convidados_limite_dia()`)), /permission denied/)
    assert.match(falha(comoNavegador(registrar(70, [A, { ref: 'convidado' }]))), /permission denied/)
    assert.match(falha(comoNavegador(`select public.criar_perfil('${A}', '{}')`)), /permission denied/)
    assert.match(falha(comoNavegador(`select ref from public.partida_participantes`)), /permission denied/)
  } finally {
    psql(`drop database if exists ${BANCO}`, 'postgres')
  }
})
