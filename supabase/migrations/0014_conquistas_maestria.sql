-- CONQUISTAS e MAESTRIA (Fase 4B): conquistas por conta e um nível de maestria por personagem, só
-- cosmético (docs/desafio-diario.md "Conquistas e maestria", docs/supabase.md "0014").
--
-- Quem escreve o quê:
--   * o servidor Node (service_role) só chama estas funções onde ele JÁ sabe da partida
--     (server/conquistas.js): depois da concessão do XP de uma partida (server/partidas.js), no fim de
--     uma corrida da campanha e no fim do desafio diário (server/campanha.js);
--   * o navegador só LÊ as próprias linhas (RLS); a Coleção pede pelo lobby (conquistas_da_conta).
--
--   1. conta_eventos: um evento por conta por partida/corrida (`ref` = 'partida:<id>', 'campanha:<id>',
--      'desafio:<id>'). A chave (conta, ref) é a âncora da idempotência: repetir não soma nada.
--   2. maestria: pontos por conta e personagem. Vitória 3, derrota/empate/participação 1 (o resto 0), com
--      teto de maestria_teto_dia() pontos por personagem por dia (São Paulo). O nível sai de
--      maestria_nivel(pontos) (espelho em src/lib/conquistas.js). O personagem de uma partida PVP/CO-OP
--      vem do relato do navegador (é só cosmético); o da campanha e do desafio, do servidor.
--   3. Os cosméticos da maestria (título no nível 5, moldura no 10) estão no catálogo com
--      `maestria_personagem` e `maestria_nivel` e nivel_requerido nivel_exclusivo() (1000): a trilha de
--      níveis nunca os entrega; registrar_evento_conta entrega quando o nível chega.
--   4. conquistas: (conta, conquista) com a data. QUAIS valem é decidido pelo servidor com as regras
--      puras (src/lib/conquistas.js conquistasDoEvento) e o resumo que registrar_evento_conta devolve;
--      desbloquear_conquistas só aceita ids da lista conquistas_ids() e devolve só as NOVAS.
--
-- Depende de 0001, 0003, 0010 e 0013. Pode rodar de novo: "if not exists" / "or replace" / "on conflict".
-- NUNCA edite as migrations antigas: elas já rodaram em produção.

-- ---------- constantes (espelho em src/lib/conquistas.js; o teste confere) ----------

create or replace function public.maestria_personagens() returns text[]
language sql immutable set search_path = '' as $$ select array['kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel'] $$;
create or replace function public.maestria_niveis() returns integer[]
language sql immutable set search_path = '' as $$ select array[0, 10, 30, 60, 100, 150, 210, 280, 360, 450] $$;
create or replace function public.maestria_teto_dia() returns integer
language sql immutable set search_path = '' as $$ select 30 $$;
create or replace function public.maestria_pontos(p_resultado text) returns integer
language sql immutable set search_path = '' as $$
  select case p_resultado when 'vitoria' then 3 when 'derrota' then 1 when 'empate' then 1 when 'participacao' then 1 else 0 end
$$;
create or replace function public.maestria_nivel(p_pontos integer) returns integer
language sql immutable set search_path = '' as $$
  select greatest(1, (select count(*)::integer from unnest(public.maestria_niveis()) n where n <= greatest(coalesce(p_pontos, 0), 0)))
$$;
create or replace function public.conquistas_ids() returns text[]
language sql immutable set search_path = '' as $$
  select array['primeira_vitoria', 'intocavel', 'casa_silenciosa', 'tres_estrelas', 'elenco_completo', 'dupla_afinada', 'ultimo_de_pe',
    'mesa_cheia', 'cacador_semanal', 'bom_dia', 'sete_sois', 'constancia', 'mao_firme', 'lenda_da_mesa', 'cadeira_cativa', 'alma_gemea',
    'por_um_fio', 'coruja']
$$;

-- ---------- tabelas ----------

create table if not exists public.conta_eventos (
  user_id uuid not null references public.perfis (id) on delete cascade,
  ref text not null check (ref ~ '^[A-Za-z0-9:_-]{8,80}$'),
  tipo text not null check (tipo in ('partida', 'campanha', 'desafio')),
  modo text check (modo is null or char_length(modo) <= 16),
  personagem text check (personagem is null or personagem ~ '^[a-z0-9_]{1,16}$'),
  resultado text check (resultado is null or char_length(resultado) <= 16),
  pontos integer not null default 0 check (pontos >= 0),
  criado_em timestamptz not null default now(),
  primary key (user_id, ref)
);
create index if not exists conta_eventos_user_dia_idx on public.conta_eventos (user_id, personagem, criado_em);

create table if not exists public.maestria (
  user_id uuid not null references public.perfis (id) on delete cascade,
  personagem text not null check (personagem ~ '^[a-z0-9_]{1,16}$'),
  pontos integer not null default 0 check (pontos >= 0),
  partidas integer not null default 0 check (partidas >= 0),
  vitorias integer not null default 0 check (vitorias >= 0),
  atualizada_em timestamptz not null default now(),
  primary key (user_id, personagem)
);

create table if not exists public.conquistas (
  user_id uuid not null references public.perfis (id) on delete cascade,
  conquista text not null check (conquista ~ '^[a-z_]{2,32}$'),
  obtida_em timestamptz not null default now(),
  primary key (user_id, conquista)
);

-- ---------- catálogo: os cosméticos da maestria ----------

alter table public.catalogo_itens add column if not exists maestria_personagem text;
alter table public.catalogo_itens add column if not exists maestria_nivel smallint;
alter table public.catalogo_itens drop constraint if exists catalogo_maestria_formato;
alter table public.catalogo_itens add constraint catalogo_maestria_formato check (
  (maestria_personagem is null and maestria_nivel is null)
  or (maestria_personagem ~ '^[a-z0-9_]{1,16}$' and maestria_nivel between 2 and 10 and not padrao and not exclusivo and nivel_requerido > 99)
);

insert into public.catalogo_itens (id, tipo, nome, nivel_requerido, padrao, exclusivo, maestria_personagem, maestria_nivel) values
  ('titulo.maestria_kris', 'titulo', 'Silêncio que Corta', public.nivel_exclusivo(), false, false, 'kris', 5),
  ('moldura.maestria_kris', 'moldura', 'Aura de Kris', public.nivel_exclusivo(), false, false, 'kris', 10),
  ('titulo.maestria_susie', 'titulo', 'Força Bruta, Coração Mole', public.nivel_exclusivo(), false, false, 'susie', 5),
  ('moldura.maestria_susie', 'moldura', 'Aura de Susie', public.nivel_exclusivo(), false, false, 'susie', 10),
  ('titulo.maestria_ralsei', 'titulo', 'Príncipe Gentil', public.nivel_exclusivo(), false, false, 'ralsei', 5),
  ('moldura.maestria_ralsei', 'moldura', 'Aura de Ralsei', public.nivel_exclusivo(), false, false, 'ralsei', 10),
  ('titulo.maestria_noelle', 'titulo', 'Neve que Não Derrete', public.nivel_exclusivo(), false, false, 'noelle', 5),
  ('moldura.maestria_noelle', 'moldura', 'Aura de Noelle', public.nivel_exclusivo(), false, false, 'noelle', 10),
  ('titulo.maestria_berdly', 'titulo', 'Gênio Autoproclamado', public.nivel_exclusivo(), false, false, 'berdly', 5),
  ('moldura.maestria_berdly', 'moldura', 'Aura de Berdly', public.nivel_exclusivo(), false, false, 'berdly', 10),
  ('titulo.maestria_dess', 'titulo', 'Riff Proibido', public.nivel_exclusivo(), false, false, 'dess', 5),
  ('moldura.maestria_dess', 'moldura', 'Aura de Dess', public.nivel_exclusivo(), false, false, 'dess', 10),
  ('titulo.maestria_asriel', 'titulo', 'Estrela que Volta', public.nivel_exclusivo(), false, false, 'asriel', 5),
  ('moldura.maestria_asriel', 'moldura', 'Aura de Asriel', public.nivel_exclusivo(), false, false, 'asriel', 10)
on conflict (id) do update
  set tipo = excluded.tipo,
      nome = excluded.nome,
      nivel_requerido = excluded.nivel_requerido,
      padrao = excluded.padrao,
      exclusivo = excluded.exclusivo,
      maestria_personagem = excluded.maestria_personagem,
      maestria_nivel = excluded.maestria_nivel;

-- ---------- o resumo da conta (o que as regras das conquistas olham) ----------

create or replace function public.resumo_conquistas(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'partidas', (select count(*) from public.conta_eventos e where e.user_id = p_user and public.maestria_pontos(e.resultado) > 0),
    'vitorias', (select count(*) from public.conta_eventos e where e.user_id = p_user and e.resultado = 'vitoria'),
    'desafios', (select count(*) from public.desafio_concluidos d where d.user_id = p_user),
    'maestria', coalesce((select jsonb_object_agg(m.personagem, m.pontos) from public.maestria m where m.user_id = p_user), '{}'::jsonb)
  )
$$;

-- ---------- o evento (só o servidor) ----------

create or replace function public.registrar_evento_conta(p_user uuid, p_ref text, p_tipo text, p_modo text, p_personagem text, p_resultado text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_personagem text := case when p_personagem = any (public.maestria_personagens()) then p_personagem else null end;
  v_base integer := public.maestria_pontos(p_resultado);
  v_pontos integer := 0;
  v_hoje integer;
  v_dia timestamptz := (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
  v_m public.maestria;
  v_antes integer;
  v_depois integer;
  v_itens jsonb := '[]'::jsonb;
  v_maestria jsonb;
begin
  if p_ref is null or p_ref !~ '^[A-Za-z0-9:_-]{8,80}$' or p_tipo is null or p_tipo not in ('partida', 'campanha', 'desafio') then
    raise exception 'evento inválido' using errcode = '22023';
  end if;
  if not exists (select 1 from public.perfis where id = p_user) then
    raise exception 'perfil não encontrado' using errcode = 'P0002';
  end if;

  -- trava a conta: dois eventos da mesma pessoa juntos não furam o teto do dia
  perform pg_advisory_xact_lock(hashtextextended('conquistas:' || p_user::text, 0));

  if exists (select 1 from public.conta_eventos e where e.user_id = p_user and e.ref = p_ref) then
    return jsonb_build_object('novo', false, 'resumo', public.resumo_conquistas(p_user), 'itens_novos', '[]'::jsonb, 'maestria', null);
  end if;

  if v_personagem is not null and v_base > 0 then
    select coalesce(sum(e.pontos), 0) into v_hoje from public.conta_eventos e
     where e.user_id = p_user and e.personagem = v_personagem and e.criado_em >= v_dia;
    v_pontos := greatest(0, least(v_base, public.maestria_teto_dia() - v_hoje));
  end if;

  insert into public.conta_eventos (user_id, ref, tipo, modo, personagem, resultado, pontos)
  values (p_user, p_ref, p_tipo, left(p_modo, 16), v_personagem, left(p_resultado, 16), v_pontos);

  if v_personagem is not null and v_base > 0 then
    select * into v_m from public.maestria where user_id = p_user and personagem = v_personagem for update;
    v_antes := public.maestria_nivel(coalesce(v_m.pontos, 0));
    insert into public.maestria (user_id, personagem, pontos, partidas, vitorias)
    values (p_user, v_personagem, v_pontos, 1, case when p_resultado = 'vitoria' then 1 else 0 end)
    on conflict (user_id, personagem) do update
      set pontos = public.maestria.pontos + excluded.pontos,
          partidas = public.maestria.partidas + 1,
          vitorias = public.maestria.vitorias + excluded.vitorias,
          atualizada_em = now()
    returning * into v_m;
    v_depois := public.maestria_nivel(v_m.pontos);
    v_maestria := jsonb_build_object('personagem', v_personagem, 'pontos', v_m.pontos, 'nivel_antes', v_antes, 'nivel_depois', v_depois);

    -- os cosméticos do personagem até o nível de agora
    with novos as (
      insert into public.inventario (user_id, item_id)
      select p_user, ci.id from public.catalogo_itens ci
       where ci.maestria_personagem = v_personagem and ci.maestria_nivel <= v_depois
      on conflict do nothing
      returning item_id
    )
    select coalesce(jsonb_agg(n.item_id order by n.item_id), '[]'::jsonb) into v_itens from novos n;
  end if;

  return jsonb_build_object('novo', true, 'resumo', public.resumo_conquistas(p_user), 'itens_novos', v_itens, 'maestria', v_maestria);
end;
$$;

-- as conquistas que o servidor decidiu: grava as que faltam (só ids conhecidos) e devolve as NOVAS
create or replace function public.desbloquear_conquistas(p_user uuid, p_ids text[])
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_novas text[];
begin
  if not exists (select 1 from public.perfis where id = p_user) then
    return array[]::text[];
  end if;
  with novas as (
    insert into public.conquistas (user_id, conquista)
    select p_user, x from (select distinct unnest(coalesce(p_ids, array[]::text[])) as x) ids
     where x = any (public.conquistas_ids())
    on conflict do nothing
    returning conquista
  )
  select coalesce(array_agg(n.conquista order by n.conquista), array[]::text[]) into v_novas from novas n;
  return v_novas;
end;
$$;

-- o que a Coleção mostra (o servidor manda pelo lobby)
create or replace function public.conquistas_da_conta(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'conquistas', coalesce((select jsonb_agg(jsonb_build_object('id', c.conquista, 'em', c.obtida_em) order by c.conquista) from public.conquistas c where c.user_id = p_user), '[]'::jsonb),
    'maestria', coalesce((select jsonb_agg(jsonb_build_object('personagem', m.personagem, 'pontos', m.pontos, 'partidas', m.partidas, 'vitorias', m.vitorias) order by m.personagem) from public.maestria m where m.user_id = p_user), '[]'::jsonb)
  )
$$;

-- ---------- permissões e RLS ----------

alter table public.conta_eventos enable row level security;
alter table public.maestria enable row level security;
alter table public.conquistas enable row level security;
revoke all on table public.conta_eventos, public.maestria, public.conquistas from anon, authenticated;
grant select on table public.maestria, public.conquistas to authenticated;
drop policy if exists maestria_leitura on public.maestria;
create policy maestria_leitura on public.maestria for select to authenticated using (user_id = auth.uid());
drop policy if exists conquistas_leitura on public.conquistas;
create policy conquistas_leitura on public.conquistas for select to authenticated using (user_id = auth.uid());
-- conta_eventos: sem política (só o servidor)

revoke all on function public.maestria_personagens() from public, anon, authenticated;
revoke all on function public.maestria_niveis() from public, anon, authenticated;
revoke all on function public.maestria_teto_dia() from public, anon, authenticated;
revoke all on function public.maestria_pontos(text) from public, anon, authenticated;
revoke all on function public.maestria_nivel(integer) from public, anon, authenticated;
revoke all on function public.conquistas_ids() from public, anon, authenticated;
revoke all on function public.resumo_conquistas(uuid) from public, anon, authenticated;
revoke all on function public.registrar_evento_conta(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.desbloquear_conquistas(uuid, text[]) from public, anon, authenticated;
revoke all on function public.conquistas_da_conta(uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.registrar_evento_conta(uuid, text, text, text, text, text) to service_role;
    grant execute on function public.desbloquear_conquistas(uuid, text[]) to service_role;
    grant execute on function public.conquistas_da_conta(uuid) to service_role;
    grant all on table public.conta_eventos, public.maestria, public.conquistas to service_role;
  end if;
end;
$$;
