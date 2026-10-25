-- Fase 1B: amigos, pedidos de amizade e bloqueios (docs/supabase.md)
--
-- Quem escreve o quê:
--   * o navegador NÃO acessa estas tabelas (RLS ligado, sem política e sem
--     GRANT): só chama as funções abaixo, todas security definer e todas
--     usando auth.uid() (o id nunca vem do cliente como "quem sou eu");
--   * o servidor Node (service_role) LÊ amizades/bloqueios para filtrar a
--     presença e os convites do lobby.
--
-- Depende da 0001_contas.sql (tabela perfis). Pode rodar de novo: usa
-- "if not exists"/"or replace".

-- ---------- tabelas ----------

-- pedido pendente de `de` para `para`
create table if not exists public.pedidos_amizade (
  de uuid not null references public.perfis (id) on delete cascade,
  para uuid not null references public.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (de, para),
  constraint pedidos_sem_si_mesmo check (de <> para)
);
create index if not exists pedidos_amizade_para_idx on public.pedidos_amizade (para);

-- cada amizade é guardada UMA vez, com a < b
create table if not exists public.amizades (
  a uuid not null references public.perfis (id) on delete cascade,
  b uuid not null references public.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (a, b),
  constraint amizades_ordem check (a < b)
);
create index if not exists amizades_b_idx on public.amizades (b);

-- `quem` bloqueou `bloqueado`
create table if not exists public.bloqueios (
  quem uuid not null references public.perfis (id) on delete cascade,
  bloqueado uuid not null references public.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (quem, bloqueado),
  constraint bloqueios_sem_si_mesmo check (quem <> bloqueado)
);
create index if not exists bloqueios_bloqueado_idx on public.bloqueios (bloqueado);

-- ---------- RLS: nada de acesso direto ----------

alter table public.pedidos_amizade enable row level security;
alter table public.amizades enable row level security;
alter table public.bloqueios enable row level security;

revoke all on table public.pedidos_amizade from anon, authenticated;
revoke all on table public.amizades from anon, authenticated;
revoke all on table public.bloqueios from anon, authenticated;
-- sem nenhuma política: só o service_role (servidor) e as funções abaixo

-- ---------- limites ----------

-- (constantes em funções para o servidor e os testes concordarem num lugar só)
create or replace function public.limite_pedidos_enviados() returns integer
language sql immutable set search_path = '' as $$ select 30 $$;
create or replace function public.limite_pedidos_recebidos() returns integer
language sql immutable set search_path = '' as $$ select 100 $$;
create or replace function public.limite_amigos() returns integer
language sql immutable set search_path = '' as $$ select 200 $$;
create or replace function public.limite_bloqueios() returns integer
language sql immutable set search_path = '' as $$ select 500 $$;

-- ---------- ajudantes internos (o navegador não chama) ----------

create or replace function public.contar_amigos(p_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.amizades where a = p_id or b = p_id;
$$;

-- bloqueio em qualquer direção
create or replace function public.ha_bloqueio(p_x uuid, p_y uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bloqueios
     where (quem = p_x and bloqueado = p_y) or (quem = p_y and bloqueado = p_x)
  );
$$;

-- trava o par (x, y) até o fim da transação: dois pedidos cruzados ao mesmo
-- tempo não criam pedido E amizade
create or replace function public.travar_par(p_x uuid, p_y uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended(least(p_x, p_y)::text || ':' || greatest(p_x, p_y)::text, 0));
$$;

-- vira amigos: apaga os pedidos dos dois lados e grava a amizade (a < b)
create or replace function public.fazer_amizade(p_x uuid, p_y uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.contar_amigos(p_x) >= public.limite_amigos() then
    raise exception 'sua lista de amigos está cheia (máximo %)', public.limite_amigos() using errcode = '54000';
  end if;
  if public.contar_amigos(p_y) >= public.limite_amigos() then
    raise exception 'a lista de amigos dessa pessoa está cheia' using errcode = '54000';
  end if;
  delete from public.pedidos_amizade
   where (de = p_x and para = p_y) or (de = p_y and para = p_x);
  insert into public.amizades (a, b) values (least(p_x, p_y), greatest(p_x, p_y))
    on conflict do nothing;
end;
$$;

-- ---------- funções do navegador ----------

-- Pede amizade pela tag (ex.: joao#4821). Se a pessoa já tinha pedido a sua,
-- vira amizade na hora.
-- Devolve { resultado: 'enviado' | 'amigos', id, tag, nome }
create or replace function public.enviar_pedido_amizade(p_tag text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tag text := lower(btrim(coalesce(p_tag, '')));
  v_alvo public.perfis;
begin
  if v_uid is null then
    raise exception 'precisa estar logado' using errcode = '28000';
  end if;
  if v_tag !~ '^[a-z0-9]{3,12}#[0-9]{4,6}$' then
    raise exception 'tag inválida: use o formato nome#1234' using errcode = '22023';
  end if;

  select * into v_alvo from public.perfis where tag = v_tag;
  if not found then
    raise exception 'não achei ninguém com essa tag' using errcode = 'P0002';
  end if;
  if v_alvo.id = v_uid then
    raise exception 'essa tag é a sua' using errcode = '22023';
  end if;

  perform public.travar_par(v_uid, v_alvo.id);

  if exists (select 1 from public.bloqueios where quem = v_uid and bloqueado = v_alvo.id) then
    raise exception 'você bloqueou essa pessoa: desbloqueie antes de pedir amizade' using errcode = '42501';
  end if;
  -- quem foi bloqueado não descobre: a mensagem é a mesma de tag inexistente
  if exists (select 1 from public.bloqueios where quem = v_alvo.id and bloqueado = v_uid) then
    raise exception 'não achei ninguém com essa tag' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.amizades where a = least(v_uid, v_alvo.id) and b = greatest(v_uid, v_alvo.id)) then
    raise exception 'vocês já são amigos' using errcode = '23505';
  end if;
  if exists (select 1 from public.pedidos_amizade where de = v_uid and para = v_alvo.id) then
    raise exception 'você já enviou um pedido para essa pessoa' using errcode = '23505';
  end if;

  -- a pessoa já tinha pedido a sua: aceita direto
  if exists (select 1 from public.pedidos_amizade where de = v_alvo.id and para = v_uid) then
    perform public.fazer_amizade(v_uid, v_alvo.id);
    return jsonb_build_object('resultado', 'amigos', 'id', v_alvo.id, 'tag', v_alvo.tag, 'nome', v_alvo.nome_exibicao);
  end if;

  if (select count(*) from public.pedidos_amizade where de = v_uid) >= public.limite_pedidos_enviados() then
    raise exception 'pedidos demais em aberto (máximo %): cancele algum antes', public.limite_pedidos_enviados() using errcode = '54000';
  end if;
  if (select count(*) from public.pedidos_amizade where para = v_alvo.id) >= public.limite_pedidos_recebidos() then
    raise exception 'essa pessoa já tem pedidos demais: tente mais tarde' using errcode = '54000';
  end if;
  if public.contar_amigos(v_uid) >= public.limite_amigos() then
    raise exception 'sua lista de amigos está cheia (máximo %)', public.limite_amigos() using errcode = '54000';
  end if;

  insert into public.pedidos_amizade (de, para) values (v_uid, v_alvo.id);
  return jsonb_build_object('resultado', 'enviado', 'id', v_alvo.id, 'tag', v_alvo.tag, 'nome', v_alvo.nome_exibicao);
end;
$$;

-- Aceita ou recusa o pedido que `p_de` mandou para mim.
-- Devolve { resultado: 'aceito' | 'recusado', id }
create or replace function public.responder_pedido_amizade(p_de uuid, p_aceitar boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'precisa estar logado' using errcode = '28000';
  end if;
  if p_de is null or p_aceitar is null then
    raise exception 'pedido inválido' using errcode = '22023';
  end if;

  perform public.travar_par(v_uid, p_de);

  if not exists (select 1 from public.pedidos_amizade where de = p_de and para = v_uid) then
    raise exception 'esse pedido não existe mais' using errcode = 'P0002';
  end if;

  if not p_aceitar then
    delete from public.pedidos_amizade where de = p_de and para = v_uid;
    return jsonb_build_object('resultado', 'recusado', 'id', p_de);
  end if;

  if public.ha_bloqueio(v_uid, p_de) then
    delete from public.pedidos_amizade where de = p_de and para = v_uid;
    raise exception 'não dá para aceitar esse pedido' using errcode = '42501';
  end if;

  perform public.fazer_amizade(v_uid, p_de);
  return jsonb_build_object('resultado', 'aceito', 'id', p_de);
end;
$$;

-- Cancela o pedido que EU mandei para `p_para`
create or replace function public.cancelar_pedido_amizade(p_para uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'precisa estar logado' using errcode = '28000';
  end if;
  delete from public.pedidos_amizade where de = v_uid and para = p_para;
end;
$$;

-- Desfaz a amizade (some dos dois lados)
create or replace function public.remover_amigo(p_outro uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'precisa estar logado' using errcode = '28000';
  end if;
  if p_outro is null then
    raise exception 'amigo inválido' using errcode = '22023';
  end if;
  delete from public.amizades where a = least(v_uid, p_outro) and b = greatest(v_uid, p_outro);
end;
$$;

-- Bloqueia: desfaz a amizade e apaga os pedidos nos dois sentidos
create or replace function public.bloquear(p_outro uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'precisa estar logado' using errcode = '28000';
  end if;
  if p_outro is null or p_outro = v_uid then
    raise exception 'não dá para bloquear essa conta' using errcode = '22023';
  end if;
  if not exists (select 1 from public.perfis where id = p_outro) then
    raise exception 'jogador não encontrado' using errcode = 'P0002';
  end if;

  perform public.travar_par(v_uid, p_outro);

  if not exists (select 1 from public.bloqueios where quem = v_uid and bloqueado = p_outro)
     and (select count(*) from public.bloqueios where quem = v_uid) >= public.limite_bloqueios() then
    raise exception 'lista de bloqueados cheia (máximo %)', public.limite_bloqueios() using errcode = '54000';
  end if;

  insert into public.bloqueios (quem, bloqueado) values (v_uid, p_outro) on conflict do nothing;
  delete from public.amizades where a = least(v_uid, p_outro) and b = greatest(v_uid, p_outro);
  delete from public.pedidos_amizade
   where (de = v_uid and para = p_outro) or (de = p_outro and para = v_uid);
end;
$$;

create or replace function public.desbloquear(p_outro uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'precisa estar logado' using errcode = '28000';
  end if;
  delete from public.bloqueios where quem = v_uid and bloqueado = p_outro;
end;
$$;

-- Amigos e pedidos (recebidos e enviados) com o perfil público de cada um.
-- relacao: 'amigo' | 'recebido' (alguém me pediu) | 'enviado' (eu pedi)
create or replace function public.listar_amigos()
returns table (
  relacao text,
  id uuid,
  tag text,
  nome_exibicao text,
  avatar_tipo text,
  avatar_id text,
  avatar_url text,
  titulo_equipado text,
  nivel integer,
  xp integer,
  desde timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.relacao, p.id, p.tag, p.nome_exibicao, p.avatar_tipo, p.avatar_id, p.avatar_url,
         p.titulo_equipado, p.nivel, p.xp, r.desde
    from (
      select 'amigo'::text as relacao, case when am.a = auth.uid() then am.b else am.a end as outro, am.criado_em as desde
        from public.amizades am
       where am.a = auth.uid() or am.b = auth.uid()
      union all
      select 'recebido', pe.de, pe.criado_em
        from public.pedidos_amizade pe
       where pe.para = auth.uid()
      union all
      select 'enviado', pe.para, pe.criado_em
        from public.pedidos_amizade pe
       where pe.de = auth.uid()
    ) r
    join public.perfis p on p.id = r.outro
   order by p.nome_exibicao, p.tag;
$$;

create or replace function public.listar_bloqueados()
returns table (
  id uuid,
  tag text,
  nome_exibicao text,
  avatar_tipo text,
  avatar_id text,
  avatar_url text,
  titulo_equipado text,
  nivel integer,
  xp integer,
  desde timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.tag, p.nome_exibicao, p.avatar_tipo, p.avatar_id, p.avatar_url,
         p.titulo_equipado, p.nivel, p.xp, b.criado_em
    from public.bloqueios b
    join public.perfis p on p.id = b.bloqueado
   where b.quem = auth.uid()
   order by p.nome_exibicao, p.tag;
$$;

-- ---------- permissões das funções ----------

-- ajudantes e constantes: só o dono (e o service_role) chama
revoke all on function public.limite_pedidos_enviados() from public, anon, authenticated;
revoke all on function public.limite_pedidos_recebidos() from public, anon, authenticated;
revoke all on function public.limite_amigos() from public, anon, authenticated;
revoke all on function public.limite_bloqueios() from public, anon, authenticated;
revoke all on function public.contar_amigos(uuid) from public, anon, authenticated;
revoke all on function public.ha_bloqueio(uuid, uuid) from public, anon, authenticated;
revoke all on function public.travar_par(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fazer_amizade(uuid, uuid) from public, anon, authenticated;

-- as que o navegador chama (só logado)
revoke all on function public.enviar_pedido_amizade(text) from public, anon;
revoke all on function public.responder_pedido_amizade(uuid, boolean) from public, anon;
revoke all on function public.cancelar_pedido_amizade(uuid) from public, anon;
revoke all on function public.remover_amigo(uuid) from public, anon;
revoke all on function public.bloquear(uuid) from public, anon;
revoke all on function public.desbloquear(uuid) from public, anon;
revoke all on function public.listar_amigos() from public, anon;
revoke all on function public.listar_bloqueados() from public, anon;
grant execute on function public.enviar_pedido_amizade(text) to authenticated;
grant execute on function public.responder_pedido_amizade(uuid, boolean) to authenticated;
grant execute on function public.cancelar_pedido_amizade(uuid) to authenticated;
grant execute on function public.remover_amigo(uuid) to authenticated;
grant execute on function public.bloquear(uuid) to authenticated;
grant execute on function public.desbloquear(uuid) to authenticated;
grant execute on function public.listar_amigos() to authenticated;
grant execute on function public.listar_bloqueados() to authenticated;
