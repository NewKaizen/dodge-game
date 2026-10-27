-- Fase 2F: pendências de servidor da Fase 1 (docs/online.md, docs/supabase.md)
--
-- O que muda:
--   1. XP no CO-OP online (2 jogadores): conceder_recompensa passa a contar a
--      repetição diária por MODO (PVP e CO-OP têm contas separadas; o parceiro é o
--      "oponente" do limite). O PVP continua exatamente como era: todas as
--      concessões antigas são PVP.
--   2. Convidados como oponente: cada conexão de convidado é um oponente (coluna
--      `ref`), exceto os do mesmo endereço da conta (o servidor manda 'convidado'),
--      que continuam contando como um só. Teto de convidados_limite_dia() partidas
--      com XP por dia contra convidados (somando todos).
--   3. Nome inicial vindo do Google passa pelo mesmo filtro de nomes da 0004
--      (nome_ofensivo): ofensivo vira JOGADOR, e a tag nasce do nome já filtrado.
--      Perfis que já existiam e têm nome da lista também viram JOGADOR (a tag
--      não muda).
--
-- Depende de 0001 (perfis, normalizar_nome), 0003 (partidas, concessoes) e
-- 0004 (nome_ofensivo). Pode rodar de novo: "if not exists"/"or replace".
-- NUNCA edite as migrations antigas: elas já rodaram em produção.

-- ---------- limite de convidados ----------

create or replace function public.convidados_limite_dia() returns integer
language sql immutable set search_path = '' as $$ select 10 $$;

-- ---------- colunas novas ----------

-- chave do convidado (null = tem conta): 'convidado' (todos juntos, mesmo endereço
-- da conta) ou 'convidado:<id da conexão>'
alter table public.partida_participantes add column if not exists ref text;
alter table public.partida_participantes drop constraint if exists partida_participantes_ref_formato;
alter table public.partida_participantes add constraint partida_participantes_ref_formato
  check (ref is null or ref ~ '^convidado(:[a-z0-9]{1,32})?$');
alter table public.concessoes add column if not exists oponente_ref text;
alter table public.concessoes drop constraint if exists concessoes_oponente_ref_formato;
alter table public.concessoes add constraint concessoes_oponente_ref_formato
  check (oponente_ref is null or oponente_ref ~ '^convidado(:[a-z0-9]{1,32})?$');

-- ---------- registrar_partida: agora guarda a chave do convidado ----------

-- p_participantes: [{ "lado": 0, "user_id": "<uuid>" | null, "ref": "convidado..." | null }, ...]
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
  insert into public.partida_participantes (partida_id, lado, user_id, ref)
  select p_id,
         (e ->> 'lado')::smallint,
         (select pf.id from public.perfis pf where pf.id = nullif(e ->> 'user_id', '')::uuid),
         case when nullif(e ->> 'user_id', '') is null and (e ->> 'ref') ~ '^convidado(:[a-z0-9]{1,32})?$' then e ->> 'ref' else null end
    from jsonb_array_elements(coalesce(p_participantes, '[]'::jsonb)) e;
end;
$$;

-- ---------- conceder_recompensa: por modo e com a chave do convidado ----------

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
      select pp.user_id, pp.resultado, op.user_id as oponente, op.ref as oponente_ref
        from public.partida_participantes pp
        left join public.partida_participantes op on op.partida_id = pp.partida_id and op.lado <> pp.lado
       where pp.partida_id = p_partida and pp.user_id is not null
       order by pp.user_id
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

-- ---------- nome inicial do Google ----------

create or replace function public.criar_perfil(p_id uuid, p_meta jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bruto text := coalesce(p_meta ->> 'full_name', p_meta ->> 'name', '');
  v_nome text;
  v_base text;
  v_tag text;
  v_tentativa integer := 0;
begin
  -- nome de exibição: o do Google, sem o que a regra não aceita
  v_nome := left(regexp_replace(btrim(regexp_replace(v_bruto, '[^[:alnum:] _.-]', '', 'g')), '\s+', ' ', 'g'), 16);
  v_nome := btrim(v_nome);
  -- sem o que a regra não aceita, ou com palavra da lista de nomes (0004): neutro
  if public.normalizar_nome(v_nome) is null or public.nome_ofensivo(v_nome) then
    v_nome := 'JOGADOR';
  end if;

  -- base da tag: o primeiro nome sem acento, só a-z0-9
  v_base := lower(split_part(v_nome, ' ', 1));
  v_base := translate(v_base, 'áàâãäåéèêëíìîïóòôõöúùûüçñý', 'aaaaaaeeeeiiiiooooouuuucny');
  v_base := left(regexp_replace(v_base, '[^a-z0-9]', '', 'g'), 12);
  -- a tag nasce do nome já filtrado; confere de novo a base (ex.: "p.u.t.a" vira "puta")
  if char_length(v_base) < 3 or public.nome_ofensivo(v_base) then
    v_base := 'jogador';
  end if;

  loop
    v_tentativa := v_tentativa + 1;
    if v_tentativa <= 30 then
      v_tag := v_base || '#' || lpad((floor(random() * 10000))::int::text, 4, '0');
    else
      v_tag := v_base || '#' || lpad((floor(random() * 1000000))::int::text, 6, '0');
    end if;
    exit when not exists (select 1 from public.perfis where tag = v_tag);
    if v_tentativa > 60 then
      raise exception 'não deu para gerar uma tag única';
    end if;
  end loop;

  insert into public.perfis (id, tag, nome_exibicao) values (p_id, v_tag, v_nome)
    on conflict (id) do nothing;
  insert into public.estatisticas_basicas (usuario_id) values (p_id)
    on conflict (usuario_id) do nothing;
end;
$$;

-- perfis criados antes desta migration com nome da lista (só podem ter vindo do Google:
-- trocar o nome já passava pelo filtro). A tag não muda.
update public.perfis set nome_exibicao = 'JOGADOR' where public.nome_ofensivo(nome_exibicao);

-- ---------- permissões (as mesmas da 0003; "or replace" já mantém, isto só garante) ----------

revoke all on function public.convidados_limite_dia() from public, anon, authenticated;
revoke all on function public.registrar_partida(uuid, text, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.conceder_recompensa(uuid) from public, anon, authenticated;
revoke all on function public.criar_perfil(uuid, jsonb) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.registrar_partida(uuid, text, integer, text, jsonb) to service_role;
    grant execute on function public.conceder_recompensa(uuid) to service_role;
  end if;
end;
$$;
