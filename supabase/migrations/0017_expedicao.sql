-- EXPEDIÇÃO do CO-OP (docs/coop-cartas.md "Expedição", docs/baus.md, docs/supabase.md "0017"):
-- 3 lutas seguidas (lacaios -> tenente -> chefão) numa partida de CO-OP em rede (2 a 4 jogadores). As
-- recompensas a mais, por cima do XP de sempre da partida (conceder_recompensa não muda):
--   * XP por luta vencida (expedicao_xp_luta()) e um bônus por completar (expedicao_xp_completa()), com um teto
--     por dia (expedicao_xp_teto_dia(), o dia de São Paulo);
--   * ao completar: chance de BAÚ (o servidor sorteia com crypto.randomInt; a fonte nova 'expedicao' de
--     conceder_bau, chave 'expedicao:<dia>:<chefão>': no máximo 1 por dia por chefão);
--   * na PRIMEIRA expedição completa contra cada chefão: o verso exclusivo dele (uma vez por conta).
--
-- Quem escreve o quê:
--   * o servidor Node (service_role) decide a partida como sempre (server/partidas.js: os relatos dos PCs
--     concordam -> 'validada') e, se os relatos trazem a mesma expedição, chama conceder_expedicao(partida,
--     chefão, lutas) UMA vez. O banco confere tudo de novo: partida de CO-OP 'validada', duração mínima por
--     luta, e para cada conta o relato DELA dizendo o mesmo chefão e pelo menos as mesmas lutas (o relato
--     fica em partida_participantes.relato, 0003). Chamar de novo devolve o que já foi (a chave
--     (partida, conta) de expedicoes), sem somar nada;
--   * o navegador só LÊ as próprias linhas (RLS) — e nem precisa: o servidor manda na recompensa.
--
--   1. catalogo_itens: os 4 versos exclusivos (verso.exp_*), nivel_requerido nivel_exclusivo() (a trilha nunca
--      entrega), fora do baú (bau = false), com a coluna nova `expedicao` (o chefão).
--   2. expedicoes: cada expedição concedida, por conta (a âncora da idempotência e o teto do dia).
--   3. expedicoes_chefes: a 1ª expedição completa de cada conta contra cada chefão (a trava do verso).
--   4. baus: a fonte 'expedicao' (o check da fonte e o formato da chave mudam) e conceder_bau confere que a
--      conta completou a expedição daquele chefão naquele dia.
--
-- Sem a 0017 o jogo entra e joga normal: o servidor loga o erro de conceder_expedicao e segue com o XP de
-- sempre (a expedição só não rende o extra).
-- Depende de 0001, 0003, 0006, 0010, 0013 e 0015. Pode rodar de novo: "if not exists" / "or replace" /
-- "on conflict". NUNCA edite as migrations antigas: elas já rodaram em produção.

-- ---------- constantes (espelho em src/lib/expedicao.js; o teste confere) ----------

create or replace function public.expedicao_xp_luta() returns integer
language sql immutable set search_path = '' as $$ select 15 $$;
create or replace function public.expedicao_xp_completa() returns integer
language sql immutable set search_path = '' as $$ select 40 $$;
create or replace function public.expedicao_xp_teto_dia() returns integer
language sql immutable set search_path = '' as $$ select 255 $$;
create or replace function public.expedicao_duracao_luta_s() returns integer
language sql immutable set search_path = '' as $$ select 60 $$;
create or replace function public.expedicao_chefes() returns text[]
language sql immutable set search_path = '' as $$ select array['king', 'queen', 'jevil', 'coronel'] $$;
-- o verso exclusivo de cada chefão (o espelho é ITENS_EXPEDICAO em src/lib/cosmeticos.js)
create or replace function public.expedicao_item(p_chefe text) returns text
language sql immutable set search_path = '' as $$
  select case p_chefe when 'king' then 'verso.exp_tabuleiro' when 'queen' then 'verso.exp_sinal'
    when 'jevil' then 'verso.exp_dado' when 'coronel' then 'verso.exp_reciclador' else null end
$$;

-- ---------- catálogo: os versos exclusivos ----------

alter table public.catalogo_itens add column if not exists expedicao text;
alter table public.catalogo_itens drop constraint if exists catalogo_expedicao_formato;
alter table public.catalogo_itens add constraint catalogo_expedicao_formato check (
  expedicao is null or (expedicao in ('king', 'queen', 'jevil', 'coronel') and not padrao and not bau and not exclusivo and nivel_requerido > 99)
);

-- o espelho é ITENS_EXPEDICAO em src/lib/cosmeticos.js (o teste confere id, tipo, nome e chefão)
insert into public.catalogo_itens (id, tipo, nome, nivel_requerido, padrao, exclusivo, raridade, bau, expedicao) values
  ('verso.exp_tabuleiro', 'verso', 'Tabuleiro Real', public.nivel_exclusivo(), false, false, 'lendario', false, 'king'),
  ('verso.exp_sinal', 'verso', 'Sinal Cheio', public.nivel_exclusivo(), false, false, 'lendario', false, 'queen'),
  ('verso.exp_dado', 'verso', 'Dado do Caos', public.nivel_exclusivo(), false, false, 'lendario', false, 'jevil'),
  ('verso.exp_reciclador', 'verso', 'Reciclador', public.nivel_exclusivo(), false, false, 'lendario', false, 'coronel')
on conflict (id) do update
  set tipo = excluded.tipo,
      nome = excluded.nome,
      nivel_requerido = excluded.nivel_requerido,
      padrao = excluded.padrao,
      exclusivo = excluded.exclusivo,
      raridade = excluded.raridade,
      bau = excluded.bau,
      expedicao = excluded.expedicao;

-- ---------- tabelas ----------

create table if not exists public.expedicoes (
  partida_id uuid not null references public.partidas (id) on delete cascade,
  user_id uuid not null references public.perfis (id) on delete cascade,
  chefe text not null check (chefe in ('king', 'queen', 'jevil', 'coronel')),
  lutas smallint not null check (lutas between 0 and 3),
  completa boolean not null default false,
  dia date not null,
  xp integer not null default 0 check (xp >= 0),
  xp_total integer,
  nivel_antes integer,
  nivel_depois integer,
  itens jsonb not null default '[]'::jsonb check (pg_column_size(itens) <= 2048),
  cosmetico text,
  cosmetico_novo boolean not null default false,
  criada_em timestamptz not null default now(),
  primary key (partida_id, user_id)
);
create index if not exists expedicoes_dia_idx on public.expedicoes (user_id, dia);

create table if not exists public.expedicoes_chefes (
  user_id uuid not null references public.perfis (id) on delete cascade,
  chefe text not null check (chefe in ('king', 'queen', 'jevil', 'coronel')),
  partida_id uuid references public.partidas (id) on delete set null,
  item_id text references public.catalogo_itens (id) on delete set null,
  completada_em timestamptz not null default now(),
  primary key (user_id, chefe)
);

-- ---------- a concessão (só o servidor) ----------

-- p_lutas: as lutas vencidas (0..3) que os relatos concordam; 3 com vitória = expedição completa.
-- Devolve uma linha por conta que levou alguma coisa (ou já tinha levado: repetida = true).
create or replace function public.conceder_expedicao(p_partida uuid, p_chefe text, p_lutas integer)
returns table (usuario uuid, xp_ganho integer, xp_total integer, nivel_antes integer, nivel_depois integer, itens_novos jsonb,
  completa boolean, cosmetico text, cosmetico_novo boolean, dia date, bau_hoje boolean, repetida boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_p public.partidas;
  v_r record;
  v_e public.expedicoes;
  v_perfil public.perfis;
  v_hoje date := public.desafio_hoje();
  v_completa boolean;
  v_xp integer;
  v_hoje_xp integer;
  v_total integer;
  v_nivel integer;
  v_itens jsonb;
  v_item text;
  v_novo boolean;
begin
  if p_chefe is null or not (p_chefe = any (public.expedicao_chefes())) then
    raise exception 'chefão inválido' using errcode = '22023';
  end if;
  if p_lutas is null or p_lutas < 0 or p_lutas > 3 then
    raise exception 'lutas inválidas' using errcode = '22023';
  end if;

  select * into v_p from public.partidas where id = p_partida for update;
  if not found then
    raise exception 'partida não existe' using errcode = 'P0002';
  end if;
  -- só CO-OP validada (contestada/encerrada não dão nada), com tempo para as lutas que diz ter vencido
  if v_p.modo not in ('coop', 'coop4')
     or v_p.validacao is distinct from 'validada'
     or v_p.estado not in ('validada', 'recompensada')
     or coalesce(v_p.duracao_s, 0) < greatest(1, p_lutas) * public.expedicao_duracao_luta_s() then
    return;
  end if;

  for v_r in
    select pp.user_id, pp.resultado
      from public.partida_participantes pp
     where pp.partida_id = p_partida
       and pp.user_id is not null
       and pp.resultado in ('vitoria', 'derrota')
       and pp.relato -> 'expedicao' ->> 'chefe' = p_chefe
       and (pp.relato -> 'expedicao' ->> 'lutas') ~ '^[0-3]$'
       and (pp.relato -> 'expedicao' ->> 'lutas')::integer >= p_lutas
     order by pp.user_id
  loop
    -- trava a conta: duas partidas da mesma pessoa terminando juntas não passam do teto
    perform pg_advisory_xact_lock(hashtextextended('expedicao:' || v_r.user_id::text, 0));
    select * into v_e from public.expedicoes e where e.partida_id = p_partida and e.user_id = v_r.user_id;
    if found then
      usuario := v_e.user_id; xp_ganho := v_e.xp; xp_total := v_e.xp_total; nivel_antes := v_e.nivel_antes; nivel_depois := v_e.nivel_depois;
      itens_novos := v_e.itens; completa := v_e.completa; cosmetico := v_e.cosmetico; cosmetico_novo := v_e.cosmetico_novo; dia := v_e.dia;
      bau_hoje := exists (select 1 from public.baus b where b.user_id = v_e.user_id and b.chave = 'expedicao:' || to_char(v_e.dia, 'YYYY-MM-DD') || ':' || v_e.chefe);
      repetida := true;
      return next;
      continue;
    end if;

    select * into v_perfil from public.perfis where id = v_r.user_id for update;
    if not found then
      continue;
    end if;
    v_completa := p_lutas = 3 and v_r.resultado = 'vitoria';
    v_xp := p_lutas * public.expedicao_xp_luta() + case when v_completa then public.expedicao_xp_completa() else 0 end;
    select coalesce(sum(e.xp), 0) into v_hoje_xp from public.expedicoes e where e.user_id = v_r.user_id and e.dia = v_hoje;
    v_xp := least(v_xp, greatest(0, public.expedicao_xp_teto_dia() - v_hoje_xp));
    v_total := v_perfil.xp;
    v_nivel := v_perfil.nivel;
    v_itens := '[]'::jsonb;
    if v_xp > 0 then
      v_total := least(v_perfil.xp::bigint + v_xp, 2000000000)::integer;
      v_nivel := public.nivel_do_xp(v_total);
      update public.perfis set xp = v_total, nivel = v_nivel where id = v_r.user_id;
      -- a trilha de níveis (como em conceder_recompensa)
      with novos as (
        insert into public.inventario (user_id, item_id)
        select v_r.user_id, ci.id from public.catalogo_itens ci
         where not ci.padrao and ci.nivel_requerido <= v_nivel
        on conflict do nothing
        returning item_id
      )
      select coalesce(jsonb_agg(n.item_id order by n.item_id), '[]'::jsonb) into v_itens from novos n;
    end if;

    -- a 1ª expedição completa contra este chefão: o verso exclusivo (uma vez por conta)
    v_item := null;
    v_novo := false;
    if v_completa then
      v_item := public.expedicao_item(p_chefe);
      insert into public.expedicoes_chefes (user_id, chefe, partida_id, item_id) values (v_r.user_id, p_chefe, p_partida, v_item)
      on conflict (user_id, chefe) do nothing;
      if found then
        insert into public.inventario (user_id, item_id) values (v_r.user_id, v_item) on conflict do nothing;
        v_novo := found;
        if v_novo then
          v_itens := v_itens || to_jsonb(v_item);
        end if;
      end if;
    end if;

    insert into public.expedicoes (partida_id, user_id, chefe, lutas, completa, dia, xp, xp_total, nivel_antes, nivel_depois, itens, cosmetico, cosmetico_novo)
    values (p_partida, v_r.user_id, p_chefe, p_lutas, v_completa, v_hoje, v_xp, v_total, v_perfil.nivel, v_nivel, v_itens, v_item, v_novo);

    usuario := v_r.user_id; xp_ganho := v_xp; xp_total := v_total; nivel_antes := v_perfil.nivel; nivel_depois := v_nivel;
    itens_novos := v_itens; completa := v_completa; cosmetico := v_item; cosmetico_novo := v_novo; dia := v_hoje;
    bau_hoje := exists (select 1 from public.baus b where b.user_id = v_r.user_id and b.chave = 'expedicao:' || to_char(v_hoje, 'YYYY-MM-DD') || ':' || p_chefe);
    repetida := false;
    return next;
  end loop;
end;
$$;

-- ---------- baús: a fonte 'expedicao' ----------

alter table public.baus drop constraint if exists baus_fonte_check;
alter table public.baus drop constraint if exists baus_fonte_valida;
alter table public.baus add constraint baus_fonte_valida check (fonte in ('nivel', 'dia', 'desafio', 'semanal', 'conquista', 'expedicao'));
alter table public.baus drop constraint if exists baus_chave_check;
alter table public.baus drop constraint if exists baus_chave_formato;
alter table public.baus add constraint baus_chave_formato check (chave ~ '^[a-z]+:[A-Za-z0-9_:-]{1,40}$');

-- a mesma de 0015 com a fonte nova:
--   expedicao  'expedicao:<AAAA-MM-DD>:<chefão>'  a conta completou a expedição daquele chefão naquele dia
create or replace function public.conceder_bau(p_user uuid, p_fonte text, p_ref text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.perfis;
  v_chave text;
  v_n integer;
  v_novo boolean;
begin
  if p_fonte is null or p_fonte not in ('nivel', 'dia', 'desafio', 'semanal', 'conquista', 'expedicao') then
    raise exception 'fonte inválida' using errcode = '22023';
  end if;
  select * into v_perfil from public.perfis where id = p_user;
  if not found then
    raise exception 'perfil não encontrado' using errcode = 'P0002';
  end if;

  if p_fonte = 'nivel' then
    if p_ref is null or p_ref !~ '^[0-9]{1,3}$' then
      raise exception 'nível inválido' using errcode = '22023';
    end if;
    v_n := p_ref::integer;
    if v_n < 2 or v_n > v_perfil.nivel then
      raise exception 'a conta ainda não chegou nesse nível' using errcode = '22023';
    end if;
    v_chave := 'nivel:' || v_n;
  elsif p_fonte = 'dia' then
    v_chave := 'dia:' || to_char(public.desafio_hoje(), 'YYYY-MM-DD');
  elsif p_fonte = 'desafio' then
    if p_ref is null or p_ref !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or not exists (select 1 from public.desafio_concluidos d where d.user_id = p_user and d.dia = p_ref::date) then
      raise exception 'desafio não vencido' using errcode = '22023';
    end if;
    v_chave := 'desafio:' || p_ref;
  elsif p_fonte = 'semanal' then
    if p_ref is null or p_ref !~ '^[0-9]{4}-S[0-9]{2}$'
       or not exists (select 1 from public.trofeus_semanais t where t.user_id = p_user and t.semana = p_ref) then
      raise exception 'boss semanal não vencido' using errcode = '22023';
    end if;
    v_chave := 'semanal:' || p_ref;
  elsif p_fonte = 'expedicao' then
    if p_ref is null or p_ref !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}:(king|queen|jevil|coronel)$'
       or not exists (select 1 from public.expedicoes e
                       where e.user_id = p_user and e.completa
                         and e.dia = split_part(p_ref, ':', 1)::date and e.chefe = split_part(p_ref, ':', 2)) then
      raise exception 'expedição não completada' using errcode = '22023';
    end if;
    v_chave := 'expedicao:' || p_ref;
  else
    if p_ref is null or not (p_ref = any (public.bau_conquistas()))
       or not exists (select 1 from public.conquistas c where c.user_id = p_user and c.conquista = p_ref) then
      raise exception 'conquista sem baú' using errcode = '22023';
    end if;
    v_chave := 'conquista:' || p_ref;
  end if;

  insert into public.baus (user_id, fonte, chave) values (p_user, p_fonte, v_chave)
  on conflict (user_id, chave) do nothing;
  v_novo := found;
  return jsonb_build_object('novo', v_novo, 'fonte', p_fonte, 'chave', v_chave,
    'fechados', (select count(*) from public.baus b where b.user_id = p_user and b.aberto_em is null));
end;
$$;

-- ---------- permissões e RLS ----------

alter table public.expedicoes enable row level security;
alter table public.expedicoes_chefes enable row level security;
revoke all on table public.expedicoes, public.expedicoes_chefes from anon, authenticated;
grant select on table public.expedicoes, public.expedicoes_chefes to authenticated;
drop policy if exists expedicoes_leitura on public.expedicoes;
create policy expedicoes_leitura on public.expedicoes for select to authenticated using (user_id = auth.uid());
drop policy if exists expedicoes_chefes_leitura on public.expedicoes_chefes;
create policy expedicoes_chefes_leitura on public.expedicoes_chefes for select to authenticated using (user_id = auth.uid());

revoke all on function public.expedicao_xp_luta() from public, anon, authenticated;
revoke all on function public.expedicao_xp_completa() from public, anon, authenticated;
revoke all on function public.expedicao_xp_teto_dia() from public, anon, authenticated;
revoke all on function public.expedicao_duracao_luta_s() from public, anon, authenticated;
revoke all on function public.expedicao_chefes() from public, anon, authenticated;
revoke all on function public.expedicao_item(text) from public, anon, authenticated;
revoke all on function public.conceder_expedicao(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.conceder_bau(uuid, text, text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.conceder_expedicao(uuid, text, integer) to service_role;
    grant execute on function public.conceder_bau(uuid, text, text) to service_role;
    grant all on table public.expedicoes, public.expedicoes_chefes to service_role;
  end if;
end;
$$;
