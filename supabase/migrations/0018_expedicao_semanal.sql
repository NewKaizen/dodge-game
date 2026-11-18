-- EXPEDIÇÃO SEMANAL (docs/boss-semanal.md "Expedição semanal", docs/supabase.md "0018"): o BOSS SEMANAL agora é
-- SEMPRE uma expedição (lacaios -> tenente -> o chefe da semana). Esta migration abre a 0017 para os chefes
-- semanais e muda o troféu da 0010:
--   1. expedicao_chefes() e expedicao_item(): + 'escuridao' e 'ladra' (o XP da expedição, o baú do dia por chefão
--      e o verso exclusivo na 1ª expedição completa valem para eles também);
--   2. catalogo_itens: os 2 versos exclusivos novos (verso.exp_breu, verso.exp_cofre) e o check da coluna
--      `expedicao` com os chefes novos;
--   3. expedicoes.chefe e expedicoes_chefes.chefe: os checks (da 0017, com a lista fixa) passam a aceitar os novos;
--   4. conceder_bau: a fonte 'expedicao' confere o chefão por expedicao_chefes() (era a lista fixa da 0017);
--   5. conceder_trofeu_semanal: o troféu da semana só sai para quem COMPLETOU a expedição semanal (o relato dele
--      diz um chefe semanal, semanal_chefes(), e as 3 lutas). O servidor Node confere o mesmo antes
--      (server/partidas.js ladosDoTrofeu: o chefe da semana da partida) e chama do mesmo jeito.
--
-- O espelho é src/lib/expedicao.js (CHEFOES_EXPEDICAO), src/lib/cosmeticos.js (ITENS_EXPEDICAO) e
-- server/supabase/fake.js; os testes conferem. Sem a 0018 o jogo funciona: a expedição semanal só não rende o
-- extra da expedição (conceder_expedicao recusa o chefão) e o troféu sai como na 0010.
-- Depende de 0010 e 0017. Pode rodar de novo: "or replace" / "drop ... if exists" / "on conflict".
-- NUNCA edite as migrations antigas (a 0017 inclusive): elas já rodaram em produção.

-- ---------- constantes ----------

create or replace function public.expedicao_chefes() returns text[]
language sql immutable set search_path = '' as $$ select array['king', 'queen', 'jevil', 'coronel', 'escuridao', 'ladra'] $$;
-- os bosses semanais (a AGENDA de src/lib/semanal.js)
create or replace function public.semanal_chefes() returns text[]
language sql immutable set search_path = '' as $$ select array['escuridao', 'ladra'] $$;
-- o verso exclusivo de cada chefão (o espelho é ITENS_EXPEDICAO em src/lib/cosmeticos.js)
create or replace function public.expedicao_item(p_chefe text) returns text
language sql immutable set search_path = '' as $$
  select case p_chefe when 'king' then 'verso.exp_tabuleiro' when 'queen' then 'verso.exp_sinal'
    when 'jevil' then 'verso.exp_dado' when 'coronel' then 'verso.exp_reciclador'
    when 'escuridao' then 'verso.exp_breu' when 'ladra' then 'verso.exp_cofre' else null end
$$;

-- ---------- catálogo: os versos exclusivos dos semanais ----------

alter table public.catalogo_itens drop constraint if exists catalogo_expedicao_formato;
alter table public.catalogo_itens add constraint catalogo_expedicao_formato check (
  expedicao is null or (expedicao in ('king', 'queen', 'jevil', 'coronel', 'escuridao', 'ladra') and not padrao and not bau and not exclusivo and nivel_requerido > 99)
);

insert into public.catalogo_itens (id, tipo, nome, nivel_requerido, padrao, exclusivo, raridade, bau, expedicao) values
  ('verso.exp_breu', 'verso', 'Breu Absoluto', public.nivel_exclusivo(), false, false, 'lendario', false, 'escuridao'),
  ('verso.exp_cofre', 'verso', 'Cofre Arrombado', public.nivel_exclusivo(), false, false, 'lendario', false, 'ladra')
on conflict (id) do update
  set tipo = excluded.tipo,
      nome = excluded.nome,
      nivel_requerido = excluded.nivel_requerido,
      padrao = excluded.padrao,
      exclusivo = excluded.exclusivo,
      raridade = excluded.raridade,
      bau = excluded.bau,
      expedicao = excluded.expedicao;

-- ---------- tabelas: os checks do chefão ----------

-- (a 0017 criou os checks na coluna, com o nome automático <tabela>_chefe_check)
alter table public.expedicoes drop constraint if exists expedicoes_chefe_check;
alter table public.expedicoes drop constraint if exists expedicoes_chefe_valido;
alter table public.expedicoes add constraint expedicoes_chefe_valido check (chefe in ('king', 'queen', 'jevil', 'coronel', 'escuridao', 'ladra'));
alter table public.expedicoes_chefes drop constraint if exists expedicoes_chefes_chefe_check;
alter table public.expedicoes_chefes drop constraint if exists expedicoes_chefes_chefe_valido;
alter table public.expedicoes_chefes add constraint expedicoes_chefes_chefe_valido check (chefe in ('king', 'queen', 'jevil', 'coronel', 'escuridao', 'ladra'));

-- ---------- baús: a fonte 'expedicao' com os chefes novos ----------

-- a mesma da 0017; só a conferência do chefão mudou (expedicao_chefes() no lugar da lista fixa)
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
    if p_ref is null or p_ref !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}:[a-z]+$'
       or not (split_part(p_ref, ':', 2) = any (public.expedicao_chefes()))
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

-- ---------- o troféu semanal: só quem completou a expedição semanal ----------

-- a mesma da 0010, com a conferência da expedição no relato de cada conta
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
       -- (0018) o boss semanal é sempre uma EXPEDIÇÃO: só quem a completou (o chefão semanal, as 3 lutas)
       and (pp.relato -> 'expedicao' ->> 'chefe') = any (public.semanal_chefes())
       and (pp.relato -> 'expedicao' ->> 'lutas') = '3'
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

-- ---------- permissões ----------

revoke all on function public.expedicao_chefes() from public, anon, authenticated;
revoke all on function public.semanal_chefes() from public, anon, authenticated;
revoke all on function public.expedicao_item(text) from public, anon, authenticated;
revoke all on function public.conceder_bau(uuid, text, text) from public, anon, authenticated;
revoke all on function public.conceder_trofeu_semanal(uuid, text, text, text, text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.conceder_bau(uuid, text, text) to service_role;
    grant execute on function public.conceder_trofeu_semanal(uuid, text, text, text, text) to service_role;
  end if;
end;
$$;
