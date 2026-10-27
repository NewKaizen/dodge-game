-- Fase 5A: base para partidas de 3 e 4 jogadores (docs/online.md "Partidas de N")
--
-- O que muda (nada disso mexe no XP do PVP 1x1 nem do CO-OP de 2):
--   1. Modos novos aceitos no registro: 'coop4' (CO-OP de 3–4), 'ffa' (todos contra
--      todos, 3–4) e '2x2'. O servidor Node ainda não registra partidas deles
--      (server/partidas.js MODOS_COM_XP): cada sub-fase liga o seu quando o modo existir.
--   2. Lados de 0 a 3 (lado = a vaga da sala; vencedor_lado também, no 'ffa').
--   3. partida_participantes ganha `time` (0/1, só no 2x2) e `colocacao` (1º a 4º, só
--      no 'ffa'); registrar_partida guarda o time e encerrar_partida a colocação (as
--      chaves são opcionais no JSON: o servidor só manda nos modos de N).
--   4. conceder_recompensa passa a ler UMA linha por conta (com N lados o join com o
--      "outro lado" dava várias). Com 2 lados o resultado é o mesmo da 0005.
--
-- Depende de 0003 (partidas, partida_participantes, concessoes) e 0005 (ref,
-- convidados_limite_dia). Pode rodar de novo: "if exists"/"or replace".
-- NUNCA edite as migrations antigas: elas já rodaram em produção.

-- ---------- modos e lados ----------

alter table public.partidas drop constraint if exists partidas_modo_check;
alter table public.partidas add constraint partidas_modo_check
  check (modo in ('pvp', 'coop', 'coop4', 'ffa', '2x2'));
alter table public.partidas drop constraint if exists partidas_vencedor_lado_check;
alter table public.partidas add constraint partidas_vencedor_lado_check
  check (vencedor_lado is null or vencedor_lado between 0 and 3);
alter table public.partida_participantes drop constraint if exists partida_participantes_lado_check;
alter table public.partida_participantes add constraint partida_participantes_lado_check
  check (lado between 0 and 3);

-- ---------- time (2x2) e colocação (todos contra todos) ----------

alter table public.partida_participantes add column if not exists time smallint;
alter table public.partida_participantes drop constraint if exists partida_participantes_time_check;
alter table public.partida_participantes add constraint partida_participantes_time_check
  check (time is null or time in (0, 1));
alter table public.partida_participantes add column if not exists colocacao smallint;
alter table public.partida_participantes drop constraint if exists partida_participantes_colocacao_check;
alter table public.partida_participantes add constraint partida_participantes_colocacao_check
  check (colocacao is null or colocacao between 1 and 4);

-- ---------- registrar_partida: também o time ----------

-- p_participantes: [{ "lado": 0..3, "user_id": "<uuid>" | null, "ref": "convidado..." | null, "time"?: 0 | 1 }, ...]
create or replace function public.registrar_partida(
  p_id uuid,
  p_modo text,
  p_versao integer,
  p_sala_tipo text,
  p_participantes jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.partidas (id, modo, versao, casual, sala_tipo, estado, iniciada_em)
  values (p_id, coalesce(p_modo, 'pvp'), p_versao, p_sala_tipo = 'casual', p_sala_tipo, 'iniciada', now())
  on conflict (id) do nothing;
  if not found then
    return;
  end if;
  insert into public.partida_participantes (partida_id, lado, user_id, ref, time)
  select p_id,
         (e ->> 'lado')::smallint,
         (select pf.id from public.perfis pf where pf.id = nullif(e ->> 'user_id', '')::uuid),
         case when nullif(e ->> 'user_id', '') is null and (e ->> 'ref') ~ '^convidado(:[a-z0-9]{1,32})?$' then e ->> 'ref' else null end,
         case when (e ->> 'time') in ('0', '1') then (e ->> 'time')::smallint else null end
    from jsonb_array_elements(coalesce(p_participantes, '[]'::jsonb)) e;
end;
$$;

-- ---------- encerrar_partida: também a colocação ----------

-- p_participantes: [{ "lado", "resultado", "personagem", "relato", "relatado_em", "colocacao"?: 1..4 }, ...]
create or replace function public.encerrar_partida(
  p_id uuid,
  p_validacao text,
  p_vencedor_lado integer,
  p_motivo text,
  p_duracao_s integer,
  p_rodadas integer,
  p_participantes jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  select estado into v_estado from public.partidas where id = p_id for update;
  if not found then
    raise exception 'partida não existe' using errcode = 'P0002';
  end if;
  if v_estado <> 'iniciada' then
    return v_estado;
  end if;
  if p_validacao not in ('validada', 'contestada', 'encerrada') then
    raise exception 'validação inválida' using errcode = '22023';
  end if;

  update public.partida_participantes pp
     set resultado = e ->> 'resultado',
         personagem = nullif(e ->> 'personagem', ''),
         relato = case when jsonb_typeof(e -> 'relato') = 'object' then e -> 'relato' else null end,
         relatado_em = nullif(e ->> 'relatado_em', '')::timestamptz,
         colocacao = case when (e ->> 'colocacao') in ('1', '2', '3', '4') then (e ->> 'colocacao')::smallint else null end
    from jsonb_array_elements(coalesce(p_participantes, '[]'::jsonb)) e
   where pp.partida_id = p_id and pp.lado = (e ->> 'lado')::smallint;

  update public.partidas
     set estado = p_validacao,
         validacao = p_validacao,
         vencedor_lado = p_vencedor_lado,
         motivo_termino = left(p_motivo, 32),
         duracao_s = least(greatest(p_duracao_s, 0), 86400),
         rodadas = p_rodadas,
         encerrada_em = now()
   where id = p_id;
  return p_validacao;
end;
$$;

-- ---------- conceder_recompensa: uma linha por conta (N lados) ----------

-- Igual à 0005, menos a escolha do oponente (distinct on). Os valores de XP não mudam.

create or replace function public.conceder_recompensa(p_partida uuid)
returns table (
  usuario uuid,
  xp_ganho integer,
  xp_total integer,
  nivel_antes integer,
  nivel_depois integer,
  itens_novos jsonb,
  motivo text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_p public.partidas;
  v_r record;
  v_perfil public.perfis;
  v_xp integer;
  v_motivo text;
  v_rep integer;
  v_conv integer;
  v_total integer;
  v_nivel integer;
  v_itens jsonb;
  v_dia timestamptz := (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
begin
  -- trava a partida: duas chamadas ao mesmo tempo viram uma depois da outra
  select * into v_p from public.partidas where id = p_partida for update;
  if not found then
    raise exception 'partida não existe' using errcode = 'P0002';
  end if;

  if v_p.estado in ('validada', 'contestada') then
    for v_r in
      -- uma linha por conta (com 3 ou 4 lados o join dá várias): o "oponente" do limite
      -- diário é o primeiro outro lado com conta (senão o primeiro convidado). Com 2 lados
      -- só existe um outro lado: igual à 0005
      select distinct on (pp.user_id) pp.user_id, pp.resultado, op.user_id as oponente, op.ref as oponente_ref
        from public.partida_participantes pp
        left join public.partida_participantes op on op.partida_id = pp.partida_id and op.lado <> pp.lado
       where pp.partida_id = p_partida and pp.user_id is not null
       order by pp.user_id, (op.user_id is null), op.lado
    loop
      -- trava a conta: partidas da mesma pessoa terminando juntas não furam o limite do dia
      perform pg_advisory_xact_lock(hashtextextended('progresso:' || v_r.user_id::text, 0));
      select * into v_perfil from public.perfis where id = v_r.user_id for update;
      if not found then
        continue;
      end if;

      v_xp := 0;
      if v_r.resultado is null or v_r.resultado not in ('vitoria', 'derrota', 'empate', 'contestada', 'participacao') then
        v_motivo := coalesce(v_r.resultado, 'sem_relato');
      elsif coalesce(v_p.duracao_s, 0) < public.duracao_minima_s()
         or (v_p.rodadas is not null and v_p.rodadas < public.rodadas_minimas()) then
        v_motivo := 'curta';
      else
        -- repetição: só conta partidas do MESMO modo (PVP e CO-OP têm contas separadas) contra o
        -- mesmo oponente (a conta, ou a chave do convidado: ver oponente_ref)
        select count(*) into v_rep
          from public.concessoes c
          join public.partidas pc on pc.id = c.partida_id
         where c.user_id = v_r.user_id
           and c.xp > 0
           and c.criada_em >= v_dia
           and pc.modo = v_p.modo
           and c.oponente_id is not distinct from v_r.oponente
           and c.oponente_ref is not distinct from v_r.oponente_ref;
        -- contra convidados (sem conta para identificar) há também um teto por dia, somando todos
        if v_r.oponente is null and v_r.oponente_ref is not null then
          select count(*) into v_conv
            from public.concessoes c
            join public.partidas pc on pc.id = c.partida_id
           where c.user_id = v_r.user_id
             and c.xp > 0
             and c.criada_em >= v_dia
             and pc.modo = v_p.modo
             and c.oponente_id is null
             and c.oponente_ref is not null;
          if v_conv >= public.convidados_limite_dia() then
            v_rep := public.repeticao_limite();
          end if;
        end if;
        if v_rep >= public.repeticao_limite() then
          v_motivo := 'repeticao';
        else
          v_xp := public.xp_participacao() + case when v_r.resultado = 'vitoria' then public.xp_vitoria() else 0 end;
          if v_rep >= public.repeticao_cheia() then
            v_xp := v_xp / 2;
            v_motivo := 'repeticao_metade';
          else
            v_motivo := v_r.resultado;
          end if;
        end if;
      end if;

      v_total := least(v_perfil.xp::bigint + v_xp, 2000000000)::integer;
      v_nivel := public.nivel_do_xp(v_total);
      insert into public.concessoes (partida_id, user_id, xp, motivo, xp_total, nivel_antes, nivel_depois, oponente_id, oponente_ref)
      values (p_partida, v_r.user_id, v_xp, v_motivo, v_total, v_perfil.nivel, v_nivel, v_r.oponente, v_r.oponente_ref)
      on conflict (partida_id, user_id) do nothing;
      if not found then
        continue; -- já concedido: não soma de novo
      end if;

      update public.perfis set xp = v_total, nivel = v_nivel where id = v_r.user_id;

      -- tudo da trilha até o nível novo (pega também item que entrou no catálogo depois)
      with novos as (
        insert into public.inventario (user_id, item_id)
        select v_r.user_id, ci.id from public.catalogo_itens ci
         where not ci.padrao and ci.nivel_requerido <= v_nivel
        on conflict do nothing
        returning item_id
      )
      select coalesce(jsonb_agg(n.item_id order by ci.nivel_requerido, n.item_id), '[]'::jsonb) into v_itens
        from novos n join public.catalogo_itens ci on ci.id = n.item_id;
      if v_itens <> '[]'::jsonb then
        update public.concessoes set itens = v_itens where partida_id = p_partida and user_id = v_r.user_id;
      end if;

      -- estatísticas: conta a partida jogada até o fim (com ou sem XP)
      if v_r.resultado in ('vitoria', 'derrota', 'empate', 'contestada', 'participacao') then
        insert into public.estatisticas_basicas (usuario_id) values (v_r.user_id) on conflict (usuario_id) do nothing;
        update public.estatisticas_basicas eb
           set partidas = eb.partidas + 1,
               vitorias = eb.vitorias + case when v_r.resultado = 'vitoria' then 1 else 0 end,
               personagem_favorito = coalesce((
                 select pp2.personagem
                   from public.partida_participantes pp2
                   join public.partidas p2 on p2.id = pp2.partida_id
                  where pp2.user_id = v_r.user_id
                    and pp2.personagem is not null
                    and pp2.resultado in ('vitoria', 'derrota', 'empate', 'contestada', 'participacao')
                  group by pp2.personagem
                  order by count(*) desc, max(p2.encerrada_em) desc
                  limit 1
               ), eb.personagem_favorito)
         where eb.usuario_id = v_r.user_id;
      end if;
    end loop;
    update public.partidas set estado = 'recompensada' where id = p_partida;
  elsif v_p.estado <> 'recompensada' then
    raise exception 'a partida ainda não terminou (estado %)', v_p.estado using errcode = '55000';
  end if;

  return query
    select c.user_id, c.xp, c.xp_total, c.nivel_antes, c.nivel_depois, c.itens, c.motivo
      from public.concessoes c
     where c.partida_id = p_partida
     order by c.user_id;
end;
$$;

-- ---------- permissões (as mesmas da 0003; "or replace" já mantém, isto só garante) ----------

revoke all on function public.registrar_partida(uuid, text, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.encerrar_partida(uuid, text, integer, text, integer, integer, jsonb) from public, anon, authenticated;
revoke all on function public.conceder_recompensa(uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.registrar_partida(uuid, text, integer, text, jsonb) to service_role;
    grant execute on function public.encerrar_partida(uuid, text, integer, text, integer, integer, jsonb) to service_role;
    grant execute on function public.conceder_recompensa(uuid) to service_role;
  end if;
end;
$$;
