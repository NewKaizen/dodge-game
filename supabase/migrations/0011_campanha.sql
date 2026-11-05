-- CAMPANHA (modo história, single-player): progresso, corridas, escolhas e cosméticos do mundo
-- (docs/campanha.md, docs/supabase.md "0011").
--
-- Quem escreve o quê:
--   * o servidor Node (service_role) RODA a partida da campanha (server/campanha.js): mão, energia,
--     CPU, sementes dos ataques e os acertos refeitos a partir das posições do coração. No fim ele
--     chama conceder_campanha(corrida, conta, ...) UMA vez por corrida;
--   * o navegador só LÊ o próprio progresso (RLS) — e nem precisa: o servidor manda pelo lobby.
--
--   1. campanha_progresso: uma linha por conta, mundo e fase (melhor estrela 0–3, vencida, vitórias).
--   2. campanha_escolhas: as escolhas dos diálogos (só mudam falas: nunca a partida).
--   3. campanha_corridas: cada corrida que terminou (vitória, derrota, suspeita ou abandono), com o
--      motivo e o que foi concedido. O id da corrida é a âncora da idempotência: chamar de novo
--      devolve o que já foi concedido, sem somar nada.
--   4. catalogo_itens ganha `campanha` ('mundo1'...) e `campanha_quando` ('mundo' = vencer o chefe pela
--      primeira vez; 'estrelas' = 3 estrelas em todas as fases do mundo). Os itens da campanha têm
--      nivel_requerido nivel_exclusivo() (1000): a trilha de níveis nunca os entrega. Ficam com
--      exclusivo = false (o `exclusivo` da 0010 é o troféu SEMANAL e exige a semana).
--   5. XP (espelho em src/game/campanha/recompensas.js; o teste confere os números):
--        primeira vitória na fase 40 (no chefe 80) · +10 por estrela nova acima da melhor ·
--        vencer de novo sem estrela nova 10 · teto de 300 XP da campanha por dia (São Paulo).
--      Derrota, suspeita e abandono: 0. O desbloqueio é conferido de novo aqui (fase 1, ou a
--      anterior vencida): fora disso a corrida vira 'suspeita' ('bloqueada').
--
-- Depende de 0001, 0003 e 0010. Pode rodar de novo: "if not exists" / "or replace" / "on conflict".
-- NUNCA edite as migrations antigas: elas já rodaram em produção.

-- ---------- constantes ----------

create or replace function public.campanha_xp_primeira() returns integer
language sql immutable set search_path = '' as $$ select 40 $$;
create or replace function public.campanha_xp_primeira_chefe() returns integer
language sql immutable set search_path = '' as $$ select 80 $$;
create or replace function public.campanha_xp_estrela() returns integer
language sql immutable set search_path = '' as $$ select 10 $$;
create or replace function public.campanha_xp_repeticao() returns integer
language sql immutable set search_path = '' as $$ select 10 $$;
create or replace function public.campanha_xp_dia() returns integer
language sql immutable set search_path = '' as $$ select 300 $$;

-- quantas fases cada mundo tem (a última é a do chefe). Espelho de src/game/campanha/mundos/*.js
create or replace function public.campanha_fases(p_mundo integer) returns integer
language sql immutable set search_path = '' as $$
  select case p_mundo when 1 then 6 else 0 end
$$;

-- ---------- tabelas ----------

create table if not exists public.campanha_progresso (
  user_id uuid not null references public.perfis (id) on delete cascade,
  mundo smallint not null check (mundo between 1 and 99),
  fase smallint not null check (fase between 1 and 99),
  estrelas smallint not null default 0 check (estrelas between 0 and 3),
  concluida boolean not null default false,
  vitorias integer not null default 0 check (vitorias >= 0),
  melhor_rodadas integer check (melhor_rodadas is null or melhor_rodadas between 1 and 999),
  primeira_em timestamptz,
  atualizada_em timestamptz not null default now(),
  primary key (user_id, mundo, fase)
);

create table if not exists public.campanha_escolhas (
  user_id uuid not null references public.perfis (id) on delete cascade,
  mundo smallint not null check (mundo between 1 and 99),
  escolhas jsonb not null default '{}'::jsonb check (jsonb_typeof(escolhas) = 'object' and pg_column_size(escolhas) <= 2048),
  atualizada_em timestamptz not null default now(),
  primary key (user_id, mundo)
);

create table if not exists public.campanha_corridas (
  id uuid primary key,
  user_id uuid not null references public.perfis (id) on delete cascade,
  mundo smallint not null check (mundo between 1 and 99),
  fase smallint not null check (fase between 1 and 99),
  resultado text not null check (resultado in ('vitoria', 'derrota', 'suspeita', 'abandono')),
  motivo text check (motivo is null or char_length(motivo) <= 32),
  estrelas smallint not null default 0 check (estrelas between 0 and 3),
  rodadas integer check (rodadas is null or rodadas between 0 and 999),
  duracao_s integer check (duracao_s is null or duracao_s between 0 and 86400),
  xp integer not null default 0 check (xp >= 0),
  xp_motivo text check (xp_motivo is null or char_length(xp_motivo) <= 32),
  itens jsonb not null default '[]'::jsonb,
  xp_total integer,
  nivel_antes integer,
  nivel_depois integer,
  primeira boolean not null default false,
  melhor_estrelas smallint,
  criada_em timestamptz not null default now()
);
create index if not exists campanha_corridas_user_dia_idx on public.campanha_corridas (user_id, criada_em);

-- ---------- catálogo: os cosméticos do mundo ----------

alter table public.catalogo_itens add column if not exists campanha text;
alter table public.catalogo_itens add column if not exists campanha_quando text;
alter table public.catalogo_itens drop constraint if exists catalogo_campanha_formato;
alter table public.catalogo_itens add constraint catalogo_campanha_formato check (
  (campanha is null and campanha_quando is null)
  or (campanha ~ '^mundo[0-9]{1,2}$' and campanha_quando in ('mundo', 'estrelas') and not padrao and not exclusivo and nivel_requerido > 99)
);

insert into public.catalogo_itens (id, tipo, nome, nivel_requerido, padrao, exclusivo, campanha, campanha_quando) values
  ('titulo.andarilho_papel', 'titulo', 'Andarilho de Papel', public.nivel_exclusivo(), false, false, 'mundo1', 'mundo'),
  ('moldura.floresta_papel', 'moldura', 'Floresta de Papel', public.nivel_exclusivo(), false, false, 'mundo1', 'mundo'),
  ('verso.folha_dobrada', 'verso', 'Folha Dobrada', public.nivel_exclusivo(), false, false, 'mundo1', 'estrelas')
on conflict (id) do update
  set tipo = excluded.tipo,
      nome = excluded.nome,
      nivel_requerido = excluded.nivel_requerido,
      padrao = excluded.padrao,
      exclusivo = excluded.exclusivo,
      campanha = excluded.campanha,
      campanha_quando = excluded.campanha_quando;

-- ---------- leitura (o servidor manda ao navegador pelo lobby) ----------

create or replace function public.progresso_campanha(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'fases', coalesce((
      select jsonb_agg(jsonb_build_object('mundo', p.mundo, 'fase', p.fase, 'estrelas', p.estrelas, 'concluida', p.concluida) order by p.mundo, p.fase)
        from public.campanha_progresso p where p.user_id = p_user
    ), '[]'::jsonb),
    'escolhas', coalesce((
      select jsonb_object_agg(e.mundo::text, e.escolhas) from public.campanha_escolhas e where e.user_id = p_user
    ), '{}'::jsonb),
    'xp_hoje', coalesce((
      select sum(c.xp) from public.campanha_corridas c
       where c.user_id = p_user
         and c.criada_em >= (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo'
    ), 0)
  )
$$;

-- uma escolha de diálogo (chave e valor curtos; no máximo 32 chaves por mundo)
create or replace function public.campanha_escolher(p_user uuid, p_mundo integer, p_chave text, p_valor text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_chave !~ '^[a-z_]{1,24}$' or p_valor !~ '^[a-z_]{1,24}$' or public.campanha_fases(p_mundo) = 0 then
    raise exception 'escolha inválida' using errcode = '22023';
  end if;
  if not exists (select 1 from public.perfis where id = p_user) then
    return;
  end if;
  insert into public.campanha_escolhas (user_id, mundo, escolhas) values (p_user, p_mundo, jsonb_build_object(p_chave, p_valor))
  on conflict (user_id, mundo) do update
    set escolhas = case
          when public.campanha_escolhas.escolhas ? p_chave or (select count(*) from jsonb_object_keys(public.campanha_escolhas.escolhas)) < 32
            then public.campanha_escolhas.escolhas || jsonb_build_object(p_chave, p_valor)
          else public.campanha_escolhas.escolhas
        end,
        atualizada_em = now();
end;
$$;

-- ---------- a concessão (só o servidor) ----------

create or replace function public.conceder_campanha(
  p_corrida uuid,
  p_user uuid,
  p_mundo integer,
  p_fase integer,
  p_resultado text,
  p_motivo text,
  p_estrelas integer,
  p_rodadas integer,
  p_duracao_s integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.campanha_corridas;
  v_perfil public.perfis;
  v_prog public.campanha_progresso;
  v_resultado text := p_resultado;
  v_motivo text := left(p_motivo, 32);
  v_estrelas integer := least(greatest(coalesce(p_estrelas, 0), 0), 3);
  v_primeira boolean;
  v_antes integer;
  v_novas integer;
  v_xp integer := 0;
  v_xp_motivo text;
  v_hoje integer;
  v_total integer;
  v_nivel integer;
  v_itens jsonb := '[]'::jsonb;
  v_extra jsonb;
  v_fases integer := public.campanha_fases(p_mundo);
  v_dia timestamptz := (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
begin
  if p_resultado is null or p_resultado not in ('vitoria', 'derrota', 'suspeita', 'abandono') then
    raise exception 'resultado inválido' using errcode = '22023';
  end if;
  if v_fases = 0 or p_fase is null or p_fase < 1 or p_fase > v_fases then
    raise exception 'fase inválida' using errcode = '22023';
  end if;

  -- trava a conta: corridas da mesma pessoa terminando juntas não furam o teto do dia
  perform pg_advisory_xact_lock(hashtextextended('campanha:' || p_user::text, 0));

  select * into v_c from public.campanha_corridas where id = p_corrida;
  if found then
    -- já concedida: devolve o que foi (nada soma de novo)
    return jsonb_build_object('xp_ganho', v_c.xp, 'xp_total', v_c.xp_total, 'nivel_antes', v_c.nivel_antes, 'nivel_depois', v_c.nivel_depois,
      'itens_novos', v_c.itens, 'motivo', coalesce(v_c.xp_motivo, v_c.resultado), 'estrelas', v_c.estrelas, 'melhor_estrelas', v_c.melhor_estrelas,
      'primeira', v_c.primeira, 'resultado', v_c.resultado, 'repetida', true);
  end if;

  select * into v_perfil from public.perfis where id = p_user for update;
  if not found then
    raise exception 'perfil não encontrado' using errcode = 'P0002';
  end if;

  -- a fase estava liberada? (o servidor já conferiu; aqui é a segunda trava)
  if v_resultado = 'vitoria' and p_fase > 1 and not exists (
    select 1 from public.campanha_progresso p where p.user_id = p_user and p.mundo = p_mundo and p.fase = p_fase - 1 and p.concluida
  ) then
    v_resultado := 'suspeita';
    v_motivo := 'bloqueada';
  end if;

  if v_resultado <> 'vitoria' then
    insert into public.campanha_corridas (id, user_id, mundo, fase, resultado, motivo, estrelas, rodadas, duracao_s, xp, xp_motivo, xp_total, nivel_antes, nivel_depois)
    values (p_corrida, p_user, p_mundo, p_fase, v_resultado, v_motivo, 0, p_rodadas, least(greatest(p_duracao_s, 0), 86400), 0, v_resultado, v_perfil.xp, v_perfil.nivel, v_perfil.nivel);
    return jsonb_build_object('xp_ganho', 0, 'xp_total', v_perfil.xp, 'nivel_antes', v_perfil.nivel, 'nivel_depois', v_perfil.nivel,
      'itens_novos', '[]'::jsonb, 'motivo', v_resultado, 'estrelas', 0, 'melhor_estrelas', null, 'primeira', false, 'resultado', v_resultado);
  end if;

  select * into v_prog from public.campanha_progresso where user_id = p_user and mundo = p_mundo and fase = p_fase for update;
  v_primeira := not found or not v_prog.concluida;
  v_antes := coalesce(v_prog.estrelas, 0);
  v_novas := greatest(0, v_estrelas - v_antes);

  -- o XP (o mesmo cálculo de xpDaCorrida em src/game/campanha/recompensas.js)
  v_xp := v_novas * public.campanha_xp_estrela();
  v_xp_motivo := case when v_novas > 0 then 'estrelas' else 'repeticao' end;
  if v_primeira then
    v_xp := v_xp + case when p_fase = v_fases then public.campanha_xp_primeira_chefe() else public.campanha_xp_primeira() end;
    v_xp_motivo := 'primeira';
  elsif v_novas = 0 then
    v_xp := public.campanha_xp_repeticao();
  end if;
  select coalesce(sum(c.xp), 0) into v_hoje from public.campanha_corridas c where c.user_id = p_user and c.criada_em >= v_dia;
  if v_xp > greatest(0, public.campanha_xp_dia() - v_hoje) then
    v_xp := greatest(0, public.campanha_xp_dia() - v_hoje);
    v_xp_motivo := 'teto_dia';
  end if;

  insert into public.campanha_progresso (user_id, mundo, fase, estrelas, concluida, vitorias, melhor_rodadas, primeira_em)
  values (p_user, p_mundo, p_fase, v_estrelas, true, 1, nullif(greatest(coalesce(p_rodadas, 0), 0), 0), now())
  on conflict (user_id, mundo, fase) do update
    set estrelas = greatest(public.campanha_progresso.estrelas, excluded.estrelas),
        concluida = true,
        vitorias = public.campanha_progresso.vitorias + 1,
        melhor_rodadas = least(coalesce(public.campanha_progresso.melhor_rodadas, excluded.melhor_rodadas), excluded.melhor_rodadas),
        primeira_em = coalesce(public.campanha_progresso.primeira_em, now()),
        atualizada_em = now();

  v_total := least(v_perfil.xp::bigint + v_xp, 2000000000)::integer;
  v_nivel := public.nivel_do_xp(v_total);
  update public.perfis set xp = v_total, nivel = v_nivel where id = p_user;

  -- a trilha de níveis (como em conceder_recompensa)
  with novos as (
    insert into public.inventario (user_id, item_id)
    select p_user, ci.id from public.catalogo_itens ci
     where not ci.padrao and ci.nivel_requerido <= v_nivel
    on conflict do nothing
    returning item_id
  )
  select coalesce(jsonb_agg(n.item_id order by n.item_id), '[]'::jsonb) into v_itens from novos n;

  -- os cosméticos do mundo: vencer o chefe pela primeira vez · 3 estrelas em todas as fases
  with ganhos as (
    insert into public.inventario (user_id, item_id)
    select p_user, ci.id from public.catalogo_itens ci
     where ci.campanha = 'mundo' || p_mundo
       and ((ci.campanha_quando = 'mundo' and p_fase = v_fases)
         or (ci.campanha_quando = 'estrelas' and (select count(*) from public.campanha_progresso p where p.user_id = p_user and p.mundo = p_mundo and p.estrelas = 3) >= v_fases))
    on conflict do nothing
    returning item_id
  )
  select coalesce(jsonb_agg(g.item_id order by g.item_id), '[]'::jsonb) into v_extra from ganhos g;
  v_itens := v_itens || v_extra;

  insert into public.campanha_corridas (id, user_id, mundo, fase, resultado, motivo, estrelas, rodadas, duracao_s, xp, xp_motivo, itens, xp_total, nivel_antes, nivel_depois, primeira, melhor_estrelas)
  values (p_corrida, p_user, p_mundo, p_fase, 'vitoria', v_motivo, v_estrelas, p_rodadas, least(greatest(p_duracao_s, 0), 86400), v_xp, v_xp_motivo, v_itens, v_total, v_perfil.nivel, v_nivel, v_primeira, greatest(v_antes, v_estrelas));

  return jsonb_build_object('xp_ganho', v_xp, 'xp_total', v_total, 'nivel_antes', v_perfil.nivel, 'nivel_depois', v_nivel,
    'itens_novos', v_itens, 'motivo', v_xp_motivo, 'estrelas', v_estrelas, 'melhor_estrelas', greatest(v_antes, v_estrelas),
    'primeira', v_primeira, 'resultado', 'vitoria');
end;
$$;

-- ---------- permissões e RLS ----------

alter table public.campanha_progresso enable row level security;
alter table public.campanha_escolhas enable row level security;
alter table public.campanha_corridas enable row level security;
revoke all on table public.campanha_progresso, public.campanha_escolhas, public.campanha_corridas from anon, authenticated;
grant select on table public.campanha_progresso, public.campanha_escolhas, public.campanha_corridas to authenticated;
drop policy if exists campanha_progresso_leitura on public.campanha_progresso;
create policy campanha_progresso_leitura on public.campanha_progresso for select to authenticated using (user_id = auth.uid());
drop policy if exists campanha_escolhas_leitura on public.campanha_escolhas;
create policy campanha_escolhas_leitura on public.campanha_escolhas for select to authenticated using (user_id = auth.uid());
drop policy if exists campanha_corridas_leitura on public.campanha_corridas;
create policy campanha_corridas_leitura on public.campanha_corridas for select to authenticated using (user_id = auth.uid());

revoke all on function public.campanha_xp_primeira() from public, anon, authenticated;
revoke all on function public.campanha_xp_primeira_chefe() from public, anon, authenticated;
revoke all on function public.campanha_xp_estrela() from public, anon, authenticated;
revoke all on function public.campanha_xp_repeticao() from public, anon, authenticated;
revoke all on function public.campanha_xp_dia() from public, anon, authenticated;
revoke all on function public.campanha_fases(integer) from public, anon, authenticated;
revoke all on function public.progresso_campanha(uuid) from public, anon, authenticated;
revoke all on function public.campanha_escolher(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.conceder_campanha(uuid, uuid, integer, integer, text, text, integer, integer, integer) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.progresso_campanha(uuid) to service_role;
    grant execute on function public.campanha_escolher(uuid, integer, text, text) to service_role;
    grant execute on function public.conceder_campanha(uuid, uuid, integer, integer, text, text, integer, integer, integer) to service_role;
    grant all on table public.campanha_progresso, public.campanha_escolhas, public.campanha_corridas to service_role;
  end if;
end;
$$;
