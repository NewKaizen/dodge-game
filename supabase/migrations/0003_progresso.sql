-- Fase 1D: registro de partidas, XP, níveis, cosméticos e inventário
-- (docs/supabase.md, docs/online.md)
--
-- Quem escreve o quê:
--   * o servidor Node (chave secret/service_role) registra a partida
--     (registrar_partida), grava como ela terminou (encerrar_partida) e só
--     então concede o XP e os itens (conceder_recompensa). As três são
--     security definer e NINGUÉM do navegador pode chamá-las;
--   * o navegador (chave anon + JWT) só LÊ o catálogo e o PRÓPRIO inventário e
--     equipa o que tem pela função equipar();
--   * xp, nivel, inventario e estatisticas_basicas nunca são graváveis pelo cliente.
--
-- Idempotência: a tabela `concessoes` tem UNIQUE (partida_id, user_id) e a
-- partida vira 'recompensada' na mesma transação. Chamar conceder_recompensa
-- de novo (relato repetido, servidor tentando outra vez) devolve o que já foi
-- concedido, sem somar nada.
--
-- Os números (XP, curva, duração mínima, repetição) moram aqui, nas funções
-- de constante; src/lib/progresso.js é o espelho em JS para a tela e os testes
-- (src/lib/__tests__/progresso.test.js confere os dois).
--
-- Depende da 0001_contas.sql (perfis, estatisticas_basicas). Pode rodar de
-- novo: usa "if not exists"/"or replace"/"on conflict".

-- ---------- constantes ----------

create or replace function public.xp_participacao() returns integer
language sql immutable set search_path = '' as $$ select 40 $$;
create or replace function public.xp_vitoria() returns integer
language sql immutable set search_path = '' as $$ select 20 $$;
create or replace function public.duracao_minima_s() returns integer
language sql immutable set search_path = '' as $$ select 60 $$;
create or replace function public.rodadas_minimas() returns integer
language sql immutable set search_path = '' as $$ select 2 $$;
-- contra o MESMO oponente no mesmo dia (fuso de São Paulo): as primeiras
-- repeticao_cheia() valem tudo, até repeticao_limite() valem metade, depois 0
create or replace function public.repeticao_cheia() returns integer
language sql immutable set search_path = '' as $$ select 3 $$;
create or replace function public.repeticao_limite() returns integer
language sql immutable set search_path = '' as $$ select 5 $$;
create or replace function public.nivel_maximo() returns integer
language sql immutable set search_path = '' as $$ select 99 $$;

-- ---------- curva de níveis ----------

-- XP para passar do nível p_nivel ao seguinte: 100 + 25 × (nível − 1)
create or replace function public.xp_para_proximo(p_nivel integer) returns integer
language sql immutable set search_path = '' as $$
  select 100 + 25 * (greatest(coalesce(p_nivel, 1), 1) - 1)
$$;

-- nível de quem tem p_xp de XP no total
create or replace function public.nivel_do_xp(p_xp integer) returns integer
language plpgsql immutable set search_path = '' as $$
declare
  v_nivel integer := 1;
  v_resto integer := greatest(coalesce(p_xp, 0), 0);
begin
  while v_nivel < public.nivel_maximo() and v_resto >= public.xp_para_proximo(v_nivel) loop
    v_resto := v_resto - public.xp_para_proximo(v_nivel);
    v_nivel := v_nivel + 1;
  end loop;
  return v_nivel;
end;
$$;

-- ---------- partidas ----------

-- ciclo de vida: criada → iniciada → encerrada → validada | contestada → recompensada
-- (o servidor já grava como 'iniciada': a partida nasce quando o host começa;
-- 'encerrada' sem passar adiante = ninguém mandou o resultado)
create table if not exists public.partidas (
  id uuid primary key,
  modo text not null default 'pvp' check (modo in ('pvp', 'coop')),
  versao integer not null check (versao > 0), -- PROTOCOLO do lobby
  casual boolean not null default false,
  sala_tipo text not null check (sala_tipo in ('casual', 'amigos')),
  criada_em timestamptz not null default now(),
  iniciada_em timestamptz,
  encerrada_em timestamptz,
  estado text not null default 'criada'
    check (estado in ('criada', 'iniciada', 'encerrada', 'validada', 'contestada', 'recompensada')),
  -- validada | contestada | encerrada: como terminou (fica quando o estado vira 'recompensada')
  validacao text check (validacao is null or validacao in ('validada', 'contestada', 'encerrada')),
  motivo_termino text check (motivo_termino is null or char_length(motivo_termino) <= 32),
  vencedor_lado smallint check (vencedor_lado is null or vencedor_lado in (0, 1)),
  duracao_s integer check (duracao_s is null or duracao_s between 0 and 86400),
  rodadas integer check (rodadas is null or rodadas between 0 and 999)
);
create index if not exists partidas_criada_em_idx on public.partidas (criada_em);

create table if not exists public.partida_participantes (
  partida_id uuid not null references public.partidas (id) on delete cascade,
  lado smallint not null check (lado in (0, 1)), -- 0 = host (P1)
  user_id uuid references public.perfis (id) on delete set null, -- null = convidado (nunca ganha nada)
  personagem text check (personagem is null or personagem ~ '^[a-z0-9_]{1,16}$'),
  resultado text check (resultado is null or resultado in ('vitoria', 'derrota', 'empate', 'contestada', 'participacao', 'abandono', 'sem_relato')),
  relato jsonb check (relato is null or pg_column_size(relato) <= 2048), -- o que o cliente mandou
  relatado_em timestamptz,
  primary key (partida_id, lado)
);
create unique index if not exists partida_participantes_conta_idx
  on public.partida_participantes (partida_id, user_id) where user_id is not null;
create index if not exists partida_participantes_user_idx on public.partida_participantes (user_id);

-- uma linha por conta por partida: a âncora da idempotência
create table if not exists public.concessoes (
  partida_id uuid not null references public.partidas (id) on delete cascade,
  user_id uuid not null references public.perfis (id) on delete cascade,
  xp integer not null check (xp >= 0),
  motivo text not null check (char_length(motivo) <= 32),
  itens jsonb not null default '[]'::jsonb,
  xp_total integer not null,
  nivel_antes integer not null,
  nivel_depois integer not null,
  oponente_id uuid, -- para o limite de repetição (null = convidado: todos contam como um só)
  criada_em timestamptz not null default now(),
  unique (partida_id, user_id)
);
create index if not exists concessoes_user_dia_idx on public.concessoes (user_id, criada_em);

-- ---------- catálogo e inventário ----------

create table if not exists public.catalogo_itens (
  id text primary key check (id ~ '^(avatar|titulo|moldura|verso)\.[a-z0-9_]{2,24}$'),
  tipo text not null check (tipo in ('avatar', 'titulo', 'moldura', 'verso')),
  nome text not null check (char_length(nome) between 1 and 32),
  nivel_requerido integer not null check (nivel_requerido >= 1),
  padrao boolean not null default false, -- todo mundo tem (não entra no inventário)
  constraint catalogo_tipo_do_id check (split_part(id, '.', 1) = tipo)
);

-- trilha fixa (espelho em src/lib/progresso.js, CATALOGO)
insert into public.catalogo_itens (id, tipo, nome, nivel_requerido, padrao) values
  ('titulo.novato', 'titulo', 'Novato', 1, true),
  ('moldura.simples', 'moldura', 'Simples', 1, true),
  ('verso.classico', 'verso', 'Clássico', 1, true),
  ('titulo.esquivador', 'titulo', 'Esquivador', 2, false),
  ('moldura.bronze', 'moldura', 'Bronze', 3, false),
  ('verso.estrelas', 'verso', 'Estrelado', 4, false),
  ('avatar.king', 'avatar', 'King', 5, false),
  ('titulo.duelista', 'titulo', 'Duelista', 6, false),
  ('moldura.prata', 'moldura', 'Prata', 7, false),
  ('verso.carmesim', 'verso', 'Carmesim', 8, false),
  ('avatar.queen', 'avatar', 'Queen', 9, false),
  ('titulo.veterano', 'titulo', 'Veterano da Mesa', 10, false),
  ('moldura.ouro', 'moldura', 'Ouro', 11, false),
  ('verso.dourado', 'verso', 'Dourado', 12, false),
  ('avatar.jevil', 'avatar', 'Jevil', 13, false),
  ('titulo.cartomante', 'titulo', 'Cartomante', 14, false),
  ('moldura.arcoiris', 'moldura', 'Arco-íris', 15, false)
on conflict (id) do update
  set tipo = excluded.tipo,
      nome = excluded.nome,
      nivel_requerido = excluded.nivel_requerido,
      padrao = excluded.padrao;

create table if not exists public.inventario (
  user_id uuid not null references public.perfis (id) on delete cascade,
  item_id text not null references public.catalogo_itens (id) on delete cascade,
  obtido_em timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- ---------- perfil: o que está equipado ----------

alter table public.perfis add column if not exists moldura_equipada text;
alter table public.perfis add column if not exists verso_equipado text;

-- os avatares da trilha (avatar.king -> avatar_id 'king') também valem como avatar 'jogo'
alter table public.perfis drop constraint if exists perfis_avatar_coerente;
alter table public.perfis add constraint perfis_avatar_coerente check (
  (avatar_tipo = 'padrao' and avatar_id is null)
  or (avatar_tipo = 'jogo' and avatar_id in ('kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel', 'king', 'queen', 'jevil'))
  or (avatar_tipo = 'enviado' and avatar_url is not null and avatar_id is null)
);
alter table public.perfis drop constraint if exists perfis_moldura_tamanho;
alter table public.perfis add constraint perfis_moldura_tamanho check (moldura_equipada is null or char_length(moldura_equipada) <= 32);
alter table public.perfis drop constraint if exists perfis_verso_tamanho;
alter table public.perfis add constraint perfis_verso_tamanho check (verso_equipado is null or char_length(verso_equipado) <= 32);

-- ---------- funções do servidor (o navegador não chama) ----------

-- p_participantes: [{ "lado": 0, "user_id": "<uuid>" | null }, ...]
-- Uma conta que não tem perfil vira convidado. Repetir o mesmo p_id não faz nada.
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
  insert into public.partida_participantes (partida_id, lado, user_id)
  select p_id, (e ->> 'lado')::smallint, (select pf.id from public.perfis pf where pf.id = nullif(e ->> 'user_id', '')::uuid)
    from jsonb_array_elements(coalesce(p_participantes, '[]'::jsonb)) e;
end;
$$;

-- Como terminou, decidido pelo servidor Node com os relatos dos dois lados.
-- p_validacao: 'validada' | 'contestada' | 'encerrada' (ninguém relatou)
-- p_participantes: [{ "lado", "resultado", "personagem", "relato", "relatado_em" }, ...]
-- Só sai de 'iniciada'; chamar de novo não muda nada. Devolve o estado.
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
         relatado_em = nullif(e ->> 'relatado_em', '')::timestamptz
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

-- Concede o XP e os itens de uma partida validada ou contestada, uma vez só.
-- Para cada conta da partida: XP (participação + vitória, com os limites),
-- nível, itens novos da trilha, estatísticas. Devolve uma linha por conta.
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
      select pp.user_id, pp.resultado, op.user_id as oponente
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
        select count(*) into v_rep
          from public.concessoes c
         where c.user_id = v_r.user_id
           and c.xp > 0
           and c.criada_em >= v_dia
           and c.oponente_id is not distinct from v_r.oponente;
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
      insert into public.concessoes (partida_id, user_id, xp, motivo, xp_total, nivel_antes, nivel_depois, oponente_id)
      values (p_partida, v_r.user_id, v_xp, v_motivo, v_total, v_perfil.nivel, v_nivel, v_r.oponente)
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

-- ---------- função do navegador ----------

-- Equipa um item do catálogo: p_tipo 'titulo' | 'moldura' | 'verso' | 'avatar'.
-- Só item que a conta tem (inventário) ou padrão. p_item null tira o
-- título/moldura/verso (o avatar volta pelo atualizar_perfil).
create or replace function public.equipar(p_tipo text, p_item text default null)
returns public.perfis
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.catalogo_itens;
  v_perfil public.perfis;
begin
  if v_uid is null then
    raise exception 'precisa estar logado' using errcode = '28000';
  end if;
  if p_tipo is null or p_tipo not in ('avatar', 'titulo', 'moldura', 'verso') then
    raise exception 'tipo de item inválido' using errcode = '22023';
  end if;
  select * into v_perfil from public.perfis where id = v_uid for update;
  if not found then
    raise exception 'perfil não encontrado' using errcode = 'P0002';
  end if;

  if p_item is null then
    if p_tipo = 'avatar' then
      raise exception 'escolha outro avatar no perfil' using errcode = '22023';
    end if;
  else
    select * into v_item from public.catalogo_itens where id = p_item and tipo = p_tipo;
    if not found then
      raise exception 'item inválido' using errcode = '22023';
    end if;
    if not v_item.padrao and not exists (select 1 from public.inventario i where i.user_id = v_uid and i.item_id = p_item) then
      raise exception 'você ainda não tem esse item' using errcode = '42501';
    end if;
  end if;

  update public.perfis
     set titulo_equipado = case when p_tipo = 'titulo' then p_item else titulo_equipado end,
         moldura_equipada = case when p_tipo = 'moldura' then p_item else moldura_equipada end,
         verso_equipado = case when p_tipo = 'verso' then p_item else verso_equipado end,
         avatar_tipo = case when p_tipo = 'avatar' then 'jogo' else avatar_tipo end,
         avatar_id = case when p_tipo = 'avatar' then split_part(p_item, '.', 2) else avatar_id end
   where id = v_uid
  returning * into v_perfil;
  return v_perfil;
end;
$$;

-- ---------- permissões e RLS ----------

alter table public.partidas enable row level security;
alter table public.partida_participantes enable row level security;
alter table public.concessoes enable row level security;
alter table public.catalogo_itens enable row level security;
alter table public.inventario enable row level security;

revoke all on table public.partidas from anon, authenticated;
revoke all on table public.partida_participantes from anon, authenticated;
revoke all on table public.concessoes from anon, authenticated;
revoke all on table public.catalogo_itens from anon, authenticated;
revoke all on table public.inventario from anon, authenticated;
-- partidas, participantes e concessões: sem política nenhuma (só o servidor)

-- catálogo: todo mundo lê
grant select on table public.catalogo_itens to anon, authenticated;
drop policy if exists catalogo_leitura on public.catalogo_itens;
create policy catalogo_leitura on public.catalogo_itens for select to anon, authenticated using (true);

-- inventário: cada um lê só o seu; ninguém escreve (só conceder_recompensa)
grant select on table public.inventario to authenticated;
drop policy if exists inventario_leitura on public.inventario;
create policy inventario_leitura on public.inventario for select to authenticated using (user_id = auth.uid());

-- funções do servidor e constantes: o navegador não executa
revoke all on function public.xp_participacao() from public, anon, authenticated;
revoke all on function public.xp_vitoria() from public, anon, authenticated;
revoke all on function public.duracao_minima_s() from public, anon, authenticated;
revoke all on function public.rodadas_minimas() from public, anon, authenticated;
revoke all on function public.repeticao_cheia() from public, anon, authenticated;
revoke all on function public.repeticao_limite() from public, anon, authenticated;
revoke all on function public.nivel_maximo() from public, anon, authenticated;
revoke all on function public.xp_para_proximo(integer) from public, anon, authenticated;
revoke all on function public.nivel_do_xp(integer) from public, anon, authenticated;
revoke all on function public.registrar_partida(uuid, text, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.encerrar_partida(uuid, text, integer, text, integer, integer, jsonb) from public, anon, authenticated;
revoke all on function public.conceder_recompensa(uuid) from public, anon, authenticated;

revoke all on function public.equipar(text, text) from public, anon;
grant execute on function public.equipar(text, text) to authenticated;

-- o servidor (service_role, no Supabase) chama as três do registro
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.registrar_partida(uuid, text, integer, text, jsonb) to service_role;
    grant execute on function public.encerrar_partida(uuid, text, integer, text, integer, integer, jsonb) to service_role;
    grant execute on function public.conceder_recompensa(uuid) to service_role;
    grant all on table public.partidas, public.partida_participantes, public.concessoes, public.catalogo_itens, public.inventario to service_role;
  end if;
end;
$$;
