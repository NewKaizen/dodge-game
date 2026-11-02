-- Fase 4E: BOSS SEMANAL (docs/boss-semanal.md, docs/online.md "Boss semanal")
--
-- Toda segunda 00:00 de São Paulo entra um chefe novo (a agenda e o id AAAA-Sxx da semana moram em
-- src/lib/semanal.js, calculados pelo relógio do SERVIDOR). Vencer o chefe da semana no CO-OP online
-- (2 a 4 jogadores) dá o TROFÉU EXCLUSIVO daquela semana (título, moldura ou verso), uma vez por conta.
-- O troféu leva a semana no id (titulo.semanal_2026_45) e nunca volta. O XP de sempre continua valendo
-- em toda vitória (conceder_recompensa não muda).
--
--   1. catalogo_itens ganha `exclusivo` e `semana`. O item do troféu nasce no catálogo na primeira
--      concessão (a agenda é infinita: não dá para semear todas as semanas) com nivel_requerido
--      nivel_exclusivo() (1000), acima do nível máximo (99): a trilha de níveis (conceder_recompensa,
--      `nivel_requerido <= nível`) nunca entrega um troféu.
--   2. partidas ganha `semana` (a semana da luta, gravada na concessão do troféu).
--   3. trofeus_semanais: uma linha por conta por semana (a âncora da idempotência). RLS: cada um lê só
--      os seus; ninguém do navegador escreve.
--   4. conceder_trofeu_semanal(partida, semana, item, tipo, nome): SÓ o servidor chama, depois do
--      conceder_recompensa. Confere de novo o que o servidor Node já decidiu (server/partidas.js):
--      partida de CO-OP 'validada' (o host decide e a maioria confere), duração e rodadas mínimas do XP,
--      e para cada conta: resultado 'vitoria' e o relato dela dizendo a MESMA semana. Convidado nunca
--      ganha (não tem conta). Chamar de novo não concede duas vezes (devolve novo = false).
--
-- Depende de 0003 e 0006. Pode rodar de novo: "if not exists" / "or replace" / "on conflict".
-- NUNCA edite as migrations antigas: elas já rodaram em produção.

-- ---------- constantes ----------

create or replace function public.nivel_exclusivo() returns integer
language sql immutable set search_path = '' as $$ select 1000 $$;

-- ---------- catálogo e partidas ----------

alter table public.catalogo_itens add column if not exists exclusivo boolean not null default false;
alter table public.catalogo_itens add column if not exists semana text;
alter table public.catalogo_itens drop constraint if exists catalogo_semana_formato;
alter table public.catalogo_itens add constraint catalogo_semana_formato check (semana is null or semana ~ '^[0-9]{4}-S[0-9]{2}$');
-- um item exclusivo é sempre de uma semana e nunca sai pela trilha de níveis
alter table public.catalogo_itens drop constraint if exists catalogo_exclusivo_coerente;
alter table public.catalogo_itens add constraint catalogo_exclusivo_coerente check (not exclusivo or (semana is not null and not padrao and nivel_requerido > 99));

alter table public.partidas add column if not exists semana text;
alter table public.partidas drop constraint if exists partidas_semana_formato;
alter table public.partidas add constraint partidas_semana_formato check (semana is null or semana ~ '^[0-9]{4}-S[0-9]{2}$');

create table if not exists public.trofeus_semanais (
  user_id uuid not null references public.perfis (id) on delete cascade,
  semana text not null check (semana ~ '^[0-9]{4}-S[0-9]{2}$'),
  item_id text not null references public.catalogo_itens (id) on delete cascade,
  partida_id uuid references public.partidas (id) on delete set null,
  obtido_em timestamptz not null default now(),
  primary key (user_id, semana)
);

-- ---------- a concessão (só o servidor) ----------

create or replace function public.conceder_trofeu_semanal(p_partida uuid, p_semana text, p_item text, p_tipo text, p_nome text)
returns table (usuario uuid, item_id text, novo boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_p public.partidas;
  v_r record;
  v_novo boolean;
begin
  if p_semana is null or p_semana !~ '^[0-9]{4}-S[0-9]{2}$' then
    raise exception 'semana inválida' using errcode = '22023';
  end if;
  -- o item é o da semana: <tipo>.semanal_<ano>_<número>
  if p_tipo is null or p_tipo not in ('titulo', 'moldura', 'verso')
     or p_item is distinct from (p_tipo || '.semanal_' || replace(p_semana, '-S', '_')) then
    raise exception 'troféu inválido' using errcode = '22023';
  end if;

  select * into v_p from public.partidas where id = p_partida for update;
  if not found then
    raise exception 'partida não existe' using errcode = 'P0002';
  end if;
  -- só CO-OP validada (contestada/encerrada não dão troféu), com a duração e as rodadas mínimas do XP
  if v_p.modo not in ('coop', 'coop4')
     or v_p.validacao is distinct from 'validada'
     or v_p.estado not in ('validada', 'recompensada')
     or coalesce(v_p.duracao_s, 0) < public.duracao_minima_s()
     or (v_p.rodadas is not null and v_p.rodadas < public.rodadas_minimas()) then
    return;
  end if;
  -- a semana da partida é uma só (a primeira concessão grava)
  if v_p.semana is null then
    update public.partidas set semana = p_semana where id = p_partida;
  elsif v_p.semana <> p_semana then
    return;
  end if;

  insert into public.catalogo_itens (id, tipo, nome, nivel_requerido, padrao, exclusivo, semana)
  values (p_item, p_tipo, left(coalesce(nullif(p_nome, ''), p_item), 32), public.nivel_exclusivo(), false, true, p_semana)
  on conflict (id) do nothing;

  for v_r in
    select pp.user_id
      from public.partida_participantes pp
     where pp.partida_id = p_partida
       and pp.user_id is not null
       and pp.resultado = 'vitoria'
       and pp.relato ->> 'semana' = p_semana
     order by pp.user_id
  loop
    insert into public.trofeus_semanais (user_id, semana, item_id, partida_id)
    values (v_r.user_id, p_semana, p_item, p_partida)
    on conflict (user_id, semana) do nothing;
    v_novo := found;
    insert into public.inventario (user_id, item_id) values (v_r.user_id, p_item) on conflict do nothing;
    usuario := v_r.user_id;
    item_id := p_item;
    novo := v_novo;
    return next;
  end loop;
end;
$$;

-- ---------- permissões e RLS ----------

alter table public.trofeus_semanais enable row level security;
revoke all on table public.trofeus_semanais from anon, authenticated;
grant select on table public.trofeus_semanais to authenticated;
drop policy if exists trofeus_semanais_leitura on public.trofeus_semanais;
create policy trofeus_semanais_leitura on public.trofeus_semanais for select to authenticated using (user_id = auth.uid());

revoke all on function public.nivel_exclusivo() from public, anon, authenticated;
revoke all on function public.conceder_trofeu_semanal(uuid, text, text, text, text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.conceder_trofeu_semanal(uuid, text, text, text, text) to service_role;
    grant all on table public.trofeus_semanais to service_role;
  end if;
end;
$$;
