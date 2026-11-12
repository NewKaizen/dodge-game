-- DESAFIO DIÁRIO (Fase 4A): um desafio por dia, igual para todo mundo, recorde pessoal, recordes dos
-- amigos e UMA recompensa principal por dia (docs/desafio-diario.md, docs/supabase.md "0013").
--
-- Quem escreve o quê:
--   * o servidor Node (service_role) RODA a corrida do desafio (server/campanha.js, a mesma máquina da
--     campanha: mão, energia, CPU, sementes e os acertos refeitos pelas posições do coração) e calcula
--     os pontos com o que ELE viu (src/lib/desafio.js pontosDoDesafio). No fim chama
--     conceder_desafio(corrida, conta, dia, ...) UMA vez por corrida;
--   * o navegador só LÊ as próprias linhas (RLS) — e nem precisa: o servidor manda pelo lobby
--     (desafio_estado, com os recordes dos amigos de hoje).
--
--   1. desafio_corridas: cada corrida que terminou (o id é a âncora da idempotência: chamar de novo
--      devolve o que já foi, sem somar nada).
--   2. desafio_recordes: o melhor de cada conta em cada dia (vitória ou derrota contam; suspeita e
--      abandono, não).
--   3. desafio_concluidos: o dia em que a conta VENCEU o desafio. A chave (conta, dia) é a trava da
--      recompensa principal: XP uma vez por dia, por mais que repita, reconecte ou mande em paralelo.
--   4. desafio_semanas: o cosmético raro da semana (seg–dom de São Paulo), uma vez por conta, quando ela
--      vence o desafio em desafio_dias_semana() dias daquela semana (sem sequência obrigatória, sem
--      punição por faltar). O item leva a semana no id (verso.diario_2026_46) e nasce no catálogo na
--      primeira concessão, com nivel_requerido 1000 (a trilha de níveis nunca entrega) e exclusivo/semana
--      (o formato da 0010).
--   5. O dia é sempre o do relógio do BANCO e do servidor (meia-noite de America/Sao_Paulo). Uma corrida
--      que começou antes da meia-noite e acabou depois vale para o dia em que começou (p_dia = hoje ou
--      ontem; outro dia: erro).
--
-- Depende de 0001, 0002, 0003 e 0010. Pode rodar de novo: "if not exists" / "or replace" / "on conflict".
-- NUNCA edite as migrations antigas: elas já rodaram em produção.

-- ---------- constantes (espelho em src/lib/desafio.js; o teste confere) ----------

create or replace function public.desafio_xp() returns integer
language sql immutable set search_path = '' as $$ select 60 $$;
create or replace function public.desafio_dias_semana() returns integer
language sql immutable set search_path = '' as $$ select 4 $$;
create or replace function public.desafio_versao() returns integer
language sql immutable set search_path = '' as $$ select 1 $$;
create or replace function public.desafio_max_amigos() returns integer
language sql immutable set search_path = '' as $$ select 20 $$;

-- o dia de hoje em São Paulo · a semana ISO (AAAA-Sxx) de um dia
create or replace function public.desafio_hoje() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;
create or replace function public.desafio_semana(p_dia date) returns text
language sql immutable set search_path = '' as $$ select to_char(p_dia, 'IYYY') || '-S' || to_char(p_dia, 'IW') $$;

-- ---------- tabelas ----------

create table if not exists public.desafio_corridas (
  id uuid primary key,
  user_id uuid not null references public.perfis (id) on delete cascade,
  dia date not null,
  versao integer not null check (versao > 0),
  resultado text not null check (resultado in ('vitoria', 'derrota', 'suspeita', 'abandono')),
  motivo text check (motivo is null or char_length(motivo) <= 32),
  pontos integer not null default 0 check (pontos between 0 and 100000),
  rodadas integer check (rodadas is null or rodadas between 0 and 999),
  acertos integer check (acertos is null or acertos between 0 and 9999),
  duracao_s integer check (duracao_s is null or duracao_s between 0 and 86400),
  xp integer not null default 0 check (xp >= 0),
  xp_motivo text check (xp_motivo is null or char_length(xp_motivo) <= 32),
  itens jsonb not null default '[]'::jsonb,
  xp_total integer,
  nivel_antes integer,
  nivel_depois integer,
  novo_recorde boolean not null default false,
  primeira_hoje boolean not null default false,
  cosmetico_novo text,
  criada_em timestamptz not null default now()
);
create index if not exists desafio_corridas_user_dia_idx on public.desafio_corridas (user_id, dia);

create table if not exists public.desafio_recordes (
  user_id uuid not null references public.perfis (id) on delete cascade,
  dia date not null,
  pontos integer not null check (pontos between 0 and 100000),
  rodadas integer,
  acertos integer,
  corrida_id uuid,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, dia)
);
create index if not exists desafio_recordes_dia_idx on public.desafio_recordes (dia, pontos desc);

create table if not exists public.desafio_concluidos (
  user_id uuid not null references public.perfis (id) on delete cascade,
  dia date not null,
  semana text not null check (semana ~ '^[0-9]{4}-S[0-9]{2}$'),
  xp integer not null default 0 check (xp >= 0),
  corrida_id uuid,
  criado_em timestamptz not null default now(),
  primary key (user_id, dia)
);
create index if not exists desafio_concluidos_semana_idx on public.desafio_concluidos (user_id, semana);

create table if not exists public.desafio_semanas (
  user_id uuid not null references public.perfis (id) on delete cascade,
  semana text not null check (semana ~ '^[0-9]{4}-S[0-9]{2}$'),
  item_id text not null references public.catalogo_itens (id) on delete cascade,
  obtido_em timestamptz not null default now(),
  primary key (user_id, semana)
);

-- ---------- leitura (o servidor manda ao navegador pelo lobby) ----------

-- o estado do dia de uma conta: o recorde, se já venceu hoje, os dias vencidos na semana, o cosmético
-- da semana e o melhor de hoje de cada AMIGO (amizade da 0002, sem bloqueio em nenhuma direção)
create or replace function public.desafio_estado(p_user uuid, p_dia date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'recorde', (select jsonb_build_object('pontos', r.pontos, 'rodadas', r.rodadas, 'acertos', r.acertos)
                  from public.desafio_recordes r where r.user_id = p_user and r.dia = p_dia),
    'concluido', exists (select 1 from public.desafio_concluidos c where c.user_id = p_user and c.dia = p_dia),
    'dias_semana', (select count(*) from public.desafio_concluidos c where c.user_id = p_user and c.semana = public.desafio_semana(p_dia)),
    'cosmetico_ganho', exists (select 1 from public.desafio_semanas s where s.user_id = p_user and s.semana = public.desafio_semana(p_dia)),
    'concluidos', (select count(*) from public.desafio_concluidos c where c.user_id = p_user),
    'amigos', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'tag', x.tag, 'pontos', x.pontos) order by x.pontos desc, x.id)
        from (
          select p.id, p.nome_exibicao as nome, p.tag, r.pontos
            from public.amizades a
            join public.perfis p on p.id = case when a.a = p_user then a.b else a.a end
            join public.desafio_recordes r on r.user_id = p.id and r.dia = p_dia
           where (a.a = p_user or a.b = p_user)
             and not public.ha_bloqueio(p_user, p.id)
           order by r.pontos desc, p.id
           limit public.desafio_max_amigos()
        ) x
    ), '[]'::jsonb)
  )
$$;

-- ---------- a concessão (só o servidor) ----------

create or replace function public.conceder_desafio(
  p_corrida uuid,
  p_user uuid,
  p_dia date,
  p_versao integer,
  p_resultado text,
  p_motivo text,
  p_pontos integer,
  p_rodadas integer,
  p_acertos integer,
  p_duracao_s integer,
  p_item text,
  p_tipo text,
  p_nome text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.desafio_corridas;
  v_perfil public.perfis;
  v_semana text := public.desafio_semana(p_dia);
  v_hoje date := public.desafio_hoje();
  v_conta boolean := p_resultado in ('vitoria', 'derrota');
  v_pontos integer := case when p_resultado in ('vitoria', 'derrota') then least(greatest(coalesce(p_pontos, 0), 0), 100000) else 0 end;
  v_antes integer;
  v_novo_recorde boolean := false;
  v_primeira boolean := false;
  v_xp integer := 0;
  v_motivo text := p_resultado;
  v_total integer;
  v_nivel integer;
  v_itens jsonb := '[]'::jsonb;
  v_cosmetico text;
  v_dias integer;
begin
  if p_resultado is null or p_resultado not in ('vitoria', 'derrota', 'suspeita', 'abandono') then
    raise exception 'resultado inválido' using errcode = '22023';
  end if;
  if p_dia is null or p_dia > v_hoje or p_dia < v_hoje - 1 then
    raise exception 'dia inválido' using errcode = '22023';
  end if;
  if p_versao is distinct from public.desafio_versao() then
    raise exception 'versão inválida' using errcode = '22023';
  end if;

  -- trava a conta: corridas da mesma pessoa terminando juntas não concedem duas vezes
  perform pg_advisory_xact_lock(hashtextextended('desafio:' || p_user::text, 0));

  select * into v_c from public.desafio_corridas where id = p_corrida;
  if found then
    return jsonb_build_object('xp_ganho', v_c.xp, 'xp_total', v_c.xp_total, 'nivel_antes', v_c.nivel_antes, 'nivel_depois', v_c.nivel_depois,
      'itens_novos', v_c.itens, 'motivo', v_c.xp_motivo, 'resultado', v_c.resultado, 'pontos', v_c.pontos, 'novo_recorde', v_c.novo_recorde,
      'primeira_hoje', v_c.primeira_hoje, 'cosmetico_novo', v_c.cosmetico_novo, 'repetida', true,
      'recorde', (select r.pontos from public.desafio_recordes r where r.user_id = p_user and r.dia = v_c.dia),
      'concluido', exists (select 1 from public.desafio_concluidos d where d.user_id = p_user and d.dia = v_c.dia),
      'dias_semana', (select count(*) from public.desafio_concluidos d where d.user_id = p_user and d.semana = public.desafio_semana(v_c.dia)),
      'concluidos', (select count(*) from public.desafio_concluidos d where d.user_id = p_user));
  end if;

  select * into v_perfil from public.perfis where id = p_user for update;
  if not found then
    raise exception 'perfil não encontrado' using errcode = 'P0002';
  end if;
  v_total := v_perfil.xp;
  v_nivel := v_perfil.nivel;

  -- o recorde do dia (vitória ou derrota; o servidor calculou os pontos com o que ele viu)
  if v_conta then
    select r.pontos into v_antes from public.desafio_recordes r where r.user_id = p_user and r.dia = p_dia for update;
    v_novo_recorde := v_antes is null or v_pontos > v_antes;
    if v_novo_recorde then
      insert into public.desafio_recordes (user_id, dia, pontos, rodadas, acertos, corrida_id)
      values (p_user, p_dia, v_pontos, p_rodadas, p_acertos, p_corrida)
      on conflict (user_id, dia) do update
        set pontos = excluded.pontos, rodadas = excluded.rodadas, acertos = excluded.acertos,
            corrida_id = excluded.corrida_id, atualizado_em = now();
    end if;
  end if;

  -- a recompensa principal: a PRIMEIRA vitória do dia (a chave conta+dia garante uma só)
  if p_resultado = 'vitoria' then
    v_motivo := 'repeticao';
    insert into public.desafio_concluidos (user_id, dia, semana, xp, corrida_id)
    values (p_user, p_dia, v_semana, public.desafio_xp(), p_corrida)
    on conflict (user_id, dia) do nothing;
    if found then
      v_primeira := true;
      v_xp := public.desafio_xp();
      v_motivo := 'desafio';
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

      -- o cosmético da semana: dias vencidos nesta semana >= desafio_dias_semana(), uma vez por semana
      select count(*) into v_dias from public.desafio_concluidos d where d.user_id = p_user and d.semana = v_semana;
      if v_dias >= public.desafio_dias_semana()
         and p_tipo in ('titulo', 'moldura', 'verso')
         and p_item = p_tipo || '.diario_' || replace(v_semana, '-S', '_')
         and not exists (select 1 from public.desafio_semanas s where s.user_id = p_user and s.semana = v_semana) then
        insert into public.catalogo_itens (id, tipo, nome, nivel_requerido, padrao, exclusivo, semana)
        values (p_item, p_tipo, left(coalesce(nullif(p_nome, ''), p_item), 32), public.nivel_exclusivo(), false, true, v_semana)
        on conflict (id) do nothing;
        insert into public.desafio_semanas (user_id, semana, item_id) values (p_user, v_semana, p_item);
        insert into public.inventario (user_id, item_id) values (p_user, p_item) on conflict do nothing;
        if found then
          v_itens := v_itens || to_jsonb(p_item);
        end if;
        v_cosmetico := p_item;
      end if;
    end if;
  end if;

  insert into public.desafio_corridas (id, user_id, dia, versao, resultado, motivo, pontos, rodadas, acertos, duracao_s, xp, xp_motivo, itens,
    xp_total, nivel_antes, nivel_depois, novo_recorde, primeira_hoje, cosmetico_novo)
  values (p_corrida, p_user, p_dia, p_versao, p_resultado, left(p_motivo, 32), v_pontos, p_rodadas, p_acertos, least(greatest(p_duracao_s, 0), 86400),
    v_xp, v_motivo, v_itens, v_total, v_perfil.nivel, v_nivel, v_novo_recorde, v_primeira, v_cosmetico);

  return jsonb_build_object('xp_ganho', v_xp, 'xp_total', v_total, 'nivel_antes', v_perfil.nivel, 'nivel_depois', v_nivel,
    'itens_novos', v_itens, 'motivo', v_motivo, 'resultado', p_resultado, 'pontos', v_pontos, 'novo_recorde', v_novo_recorde,
    'primeira_hoje', v_primeira, 'cosmetico_novo', v_cosmetico,
    'recorde', (select r.pontos from public.desafio_recordes r where r.user_id = p_user and r.dia = p_dia),
    'concluido', exists (select 1 from public.desafio_concluidos d where d.user_id = p_user and d.dia = p_dia),
    'dias_semana', (select count(*) from public.desafio_concluidos d where d.user_id = p_user and d.semana = v_semana),
    'concluidos', (select count(*) from public.desafio_concluidos d where d.user_id = p_user));
end;
$$;

-- ---------- permissões e RLS ----------

alter table public.desafio_corridas enable row level security;
alter table public.desafio_recordes enable row level security;
alter table public.desafio_concluidos enable row level security;
alter table public.desafio_semanas enable row level security;
revoke all on table public.desafio_corridas, public.desafio_recordes, public.desafio_concluidos, public.desafio_semanas from anon, authenticated;
grant select on table public.desafio_corridas, public.desafio_recordes, public.desafio_concluidos, public.desafio_semanas to authenticated;
drop policy if exists desafio_corridas_leitura on public.desafio_corridas;
create policy desafio_corridas_leitura on public.desafio_corridas for select to authenticated using (user_id = auth.uid());
drop policy if exists desafio_recordes_leitura on public.desafio_recordes;
create policy desafio_recordes_leitura on public.desafio_recordes for select to authenticated using (user_id = auth.uid());
drop policy if exists desafio_concluidos_leitura on public.desafio_concluidos;
create policy desafio_concluidos_leitura on public.desafio_concluidos for select to authenticated using (user_id = auth.uid());
drop policy if exists desafio_semanas_leitura on public.desafio_semanas;
create policy desafio_semanas_leitura on public.desafio_semanas for select to authenticated using (user_id = auth.uid());

revoke all on function public.desafio_xp() from public, anon, authenticated;
revoke all on function public.desafio_dias_semana() from public, anon, authenticated;
revoke all on function public.desafio_versao() from public, anon, authenticated;
revoke all on function public.desafio_max_amigos() from public, anon, authenticated;
revoke all on function public.desafio_hoje() from public, anon, authenticated;
revoke all on function public.desafio_semana(date) from public, anon, authenticated;
revoke all on function public.desafio_estado(uuid, date) from public, anon, authenticated;
revoke all on function public.conceder_desafio(uuid, uuid, date, integer, text, text, integer, integer, integer, integer, text, text, text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.desafio_estado(uuid, date) to service_role;
    grant execute on function public.conceder_desafio(uuid, uuid, date, integer, text, text, integer, integer, integer, integer, text, text, text) to service_role;
    grant all on table public.desafio_corridas, public.desafio_recordes, public.desafio_concluidos, public.desafio_semanas to service_role;
  end if;
end;
$$;
