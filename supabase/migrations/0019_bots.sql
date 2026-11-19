-- BOTS DO JOGAR RÁPIDO (docs/online.md "Bots do Jogar Rápido", docs/supabase.md "0019"): perfis de jogadores
-- que o SERVIDOR controla, para a fila casual de PVP 1x1 não ficar vazia. Para quem joga, um bot é igual a
-- uma conta de gente: o mesmo perfil (public.perfis), as mesmas estatísticas, o mesmo inventário, o mesmo
-- XP e nível (ganhos pela MESMA conceder_recompensa das partidas), legível pelas mesmas consultas e RLS.
--
-- Como fica escondido:
--   * cada bot é uma linha em auth.users SEM e-mail, telefone, senha ou identidade (ninguém entra nela; o
--     banimento eterno é só garantia) e, pelo gatilho da 0001 (criar_perfil_novo_usuario), ganha o perfil e as
--     estatísticas como qualquer conta. O auth.users não é visível ao navegador;
--   * a marca "é bot" (a faixa de jogo, os personagens preferidos, quanto ele joga) mora SÓ em public.bots:
--     RLS ligada, NENHUMA policy e sem grant para anon/authenticated (o navegador não lê nem sabe que existe;
--     o servidor usa a service_role). Nenhuma função que o navegador chama olha para public.bots.
--
-- Funções (só o servidor, service_role):
--   criar_bot(p_spec jsonb) -> uuid          um bot novo (o servidor gera o apelido, o nível e os cosméticos:
--                                            server/bots/perfil.js); confere tudo de novo aqui
--   bots_listar() -> jsonb                   [{ bot: {...}, perfil: {...} }] dos bots ativos
--   bot_perfil(p_user uuid) -> jsonb         o perfil atual de um bot (depois de uma partida)
--   bot_atividade(p_user, p_partidas, p_vitorias, p_xp) -> jsonb
--                                            a "vida fora da fila": partidas que o bot jogou por aí (o servidor
--                                            sorteia de tempos em tempos); soma XP, nível, itens da trilha e
--                                            estatísticas, como uma partida de verdade somaria
--
-- O espelho é server/supabase/fake.js (criar_bot, bots_listar, bot_perfil, bot_atividade); os testes conferem.
-- Para tirar todos os bots: `delete from auth.users where id in (select user_id from public.bots);` (o perfil, as
-- estatísticas, o inventário e a linha em public.bots vão junto, em cascata).
-- Depende de 0001–0016. Pode rodar de novo: "if not exists" / "or replace" / "drop ... if exists".
-- NUNCA edite as migrations antigas: elas já rodaram em produção.

-- ---------- a tabela que só o servidor vê ----------

create table if not exists public.bots (
  user_id uuid primary key references public.perfis (id) on delete cascade,
  faixa text not null,
  q real not null,
  favoritos text[] not null default '{}',
  atividade real not null default 4, -- partidas por dia (a média da "vida fora da fila")
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atividade_em timestamptz not null default now()
);
alter table public.bots drop constraint if exists bots_faixa_valida;
alter table public.bots add constraint bots_faixa_valida check (faixa in ('iniciante', 'casual', 'medio', 'bom', 'muito_bom'));
alter table public.bots drop constraint if exists bots_q_valido;
alter table public.bots add constraint bots_q_valido check (q >= 0 and q <= 1);
alter table public.bots drop constraint if exists bots_favoritos_validos;
alter table public.bots add constraint bots_favoritos_validos check (cardinality(favoritos) <= 4);
alter table public.bots drop constraint if exists bots_atividade_valida;
alter table public.bots add constraint bots_atividade_valida check (atividade >= 0 and atividade <= 48);

alter table public.bots enable row level security;
-- (nenhuma policy de propósito: anon e authenticated não leem nem escrevem)
revoke all on table public.bots from public, anon, authenticated;

-- ---------- criar um bot ----------

-- p_spec: { nome, faixa, q, xp, partidas, vitorias, favoritos: [id], favorito, dias_de_conta, atividade,
--           avatar_tipo: 'padrao' | 'jogo', avatar_id, itens: [id do catálogo], equipar: { tipo: id } }
create or replace function public.criar_bot(p_spec jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_nome text := public.normalizar_nome(p_spec ->> 'nome');
  v_faixa text := p_spec ->> 'faixa';
  v_q real := coalesce((p_spec ->> 'q')::real, 0.5);
  v_xp integer := least(greatest(coalesce((p_spec ->> 'xp')::integer, 0), 0), 200000);
  v_nivel integer;
  v_partidas integer := least(greatest(coalesce((p_spec ->> 'partidas')::integer, 0), 0), 100000);
  v_vitorias integer;
  v_dias integer := least(greatest(coalesce((p_spec ->> 'dias_de_conta')::integer, 30), 0), 3650);
  v_quando timestamptz;
  v_avatar_tipo text := coalesce(p_spec ->> 'avatar_tipo', 'padrao');
  v_avatar_id text := p_spec ->> 'avatar_id';
  v_favoritos text[];
  v_favorito text := p_spec ->> 'favorito';
  v_tipo text;
  v_item text;
begin
  if v_nome is null then
    raise exception 'nome de bot inválido' using errcode = '22023';
  end if;
  if v_faixa is null or v_faixa not in ('iniciante', 'casual', 'medio', 'bom', 'muito_bom') then
    raise exception 'faixa inválida' using errcode = '22023';
  end if;
  v_nivel := public.nivel_do_xp(v_xp);
  v_vitorias := least(greatest(coalesce((p_spec ->> 'vitorias')::integer, 0), 0), v_partidas);
  v_quando := now() - make_interval(days => v_dias, secs => floor(random() * 86400)::integer);
  select coalesce(array_agg(f), '{}') into v_favoritos
    from (select jsonb_array_elements_text(coalesce(p_spec -> 'favoritos', '[]'::jsonb)) as f limit 4) x
   where f ~ '^[a-z0-9_]{1,16}$';
  if v_favorito is not null and v_favorito !~ '^[a-z0-9_]{1,16}$' then
    v_favorito := null;
  end if;
  if v_avatar_tipo not in ('padrao', 'jogo') then
    v_avatar_tipo := 'padrao';
  end if;
  if v_avatar_tipo = 'padrao' then
    v_avatar_id := null;
  end if;

  -- a conta: sem e-mail, telefone, senha ou identidade (não dá para entrar nela). O gatilho da 0001 cria o
  -- perfil (com a tag gerada do apelido) e as estatísticas, como para qualquer conta
  insert into auth.users (id, raw_user_meta_data) values (v_id, jsonb_build_object('full_name', v_nome));
  -- as colunas do Auth do Supabase que existirem (o banco de teste tem um auth.users mínimo)
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'aud') then
    execute 'update auth.users set aud = $2, role = $2 where id = $1' using v_id, 'authenticated';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'created_at') then
    execute 'update auth.users set created_at = $2, updated_at = $2 where id = $1' using v_id, v_quando;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'banned_until') then
    execute 'update auth.users set banned_until = $2 where id = $1' using v_id, 'infinity'::timestamptz;
  end if;
  if not exists (select 1 from public.perfis where id = v_id) then
    perform public.criar_perfil(v_id, jsonb_build_object('full_name', v_nome));
  end if;

  update public.perfis
     set nome_exibicao = v_nome,
         avatar_tipo = v_avatar_tipo,
         avatar_id = v_avatar_id,
         xp = v_xp,
         nivel = v_nivel,
         criado_em = v_quando
   where id = v_id;

  -- os itens: a trilha toda até o nível (como a conceder_recompensa daria) e os do baú que o servidor sorteou
  insert into public.inventario (user_id, item_id, obtido_em)
  select v_id, ci.id, v_quando + (now() - v_quando) * random()
    from public.catalogo_itens ci
   where not ci.padrao and ci.nivel_requerido <= v_nivel
  on conflict do nothing;
  insert into public.inventario (user_id, item_id, obtido_em)
  select v_id, ci.id, v_quando + (now() - v_quando) * random()
    from public.catalogo_itens ci
   where ci.bau and ci.id in (select jsonb_array_elements_text(coalesce(p_spec -> 'itens', '[]'::jsonb)))
  on conflict do nothing;
  -- equipados (só o que ele tem: a equipar_conta confere)
  for v_tipo, v_item in select key, value #>> '{}' from jsonb_each(coalesce(p_spec -> 'equipar', '{}'::jsonb)) loop
    begin
      perform public.equipar_conta(v_id, v_tipo, v_item);
    exception when others then
      null; -- item que não serve: fica o padrão
    end;
  end loop;

  insert into public.estatisticas_basicas (usuario_id) values (v_id) on conflict (usuario_id) do nothing;
  update public.estatisticas_basicas
     set partidas = v_partidas, vitorias = v_vitorias, personagem_favorito = coalesce(v_favorito, v_favoritos[1])
   where usuario_id = v_id;

  insert into public.bots (user_id, faixa, q, favoritos, atividade, criado_em, atividade_em)
  values (v_id, v_faixa, least(greatest(v_q, 0), 1), v_favoritos, least(greatest(coalesce((p_spec ->> 'atividade')::real, 4), 0), 48), now(), now());
  return v_id;
end;
$$;

-- ---------- ler ----------

create or replace function public.bots_listar()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('bot', to_jsonb(b), 'perfil', to_jsonb(p)) order by b.criado_em, b.user_id), '[]'::jsonb)
    from public.bots b
    join public.perfis p on p.id = b.user_id
   where b.ativo;
$$;

create or replace function public.bot_perfil(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(p) from public.perfis p join public.bots b on b.user_id = p.id where p.id = p_user;
$$;

-- ---------- a vida fora da fila ----------

-- p_partidas partidas jogadas "por aí", p_vitorias delas vencidas, p_xp de XP. Só para bots (uma conta de gente
-- nunca passa por aqui) e com teto (no máximo 20 partidas e 60 XP por partida de uma vez).
create or replace function public.bot_atividade(p_user uuid, p_partidas integer, p_vitorias integer, p_xp integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.perfis;
  v_partidas integer := least(greatest(coalesce(p_partidas, 0), 0), 20);
  v_vitorias integer;
  v_xp integer;
  v_total integer;
  v_nivel integer;
begin
  if not exists (select 1 from public.bots where user_id = p_user) then
    raise exception 'não é um bot' using errcode = '42501';
  end if;
  v_vitorias := least(greatest(coalesce(p_vitorias, 0), 0), v_partidas);
  v_xp := least(greatest(coalesce(p_xp, 0), 0), v_partidas * (public.xp_participacao() + public.xp_vitoria()));
  select * into v_perfil from public.perfis where id = p_user for update;
  if not found then
    raise exception 'perfil não encontrado' using errcode = 'P0002';
  end if;
  v_total := least(v_perfil.xp::bigint + v_xp, 2000000000)::integer;
  v_nivel := public.nivel_do_xp(v_total);
  update public.perfis set xp = v_total, nivel = v_nivel where id = p_user;
  insert into public.inventario (user_id, item_id)
  select p_user, ci.id from public.catalogo_itens ci
   where not ci.padrao and ci.nivel_requerido <= v_nivel
  on conflict do nothing;
  insert into public.estatisticas_basicas (usuario_id) values (p_user) on conflict (usuario_id) do nothing;
  update public.estatisticas_basicas
     set partidas = partidas + v_partidas, vitorias = vitorias + v_vitorias
   where usuario_id = p_user;
  update public.bots set atividade_em = now() where user_id = p_user;
  return jsonb_build_object('xp_total', v_total, 'nivel', v_nivel, 'partidas', v_partidas, 'vitorias', v_vitorias);
end;
$$;

-- ---------- quem pode chamar ----------

revoke all on function public.criar_bot(jsonb) from public, anon, authenticated;
revoke all on function public.bots_listar() from public, anon, authenticated;
revoke all on function public.bot_perfil(uuid) from public, anon, authenticated;
revoke all on function public.bot_atividade(uuid, integer, integer, integer) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.criar_bot(jsonb) to service_role;
    grant execute on function public.bots_listar() to service_role;
    grant execute on function public.bot_perfil(uuid) to service_role;
    grant execute on function public.bot_atividade(uuid, integer, integer, integer) to service_role;
    grant all on table public.bots to service_role;
  end if;
end;
$$;
