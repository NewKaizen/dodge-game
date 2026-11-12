-- BAÚS e os SLOTS NOVOS de cosmético (docs/baus.md, docs/cosmeticos-ids.md). Cosméticos nunca mudam nada
-- no jogo (regra fixa da Fase 4). O baú só se ganha JOGANDO: não existe compra nenhuma.
--
-- Quem escreve o quê:
--   * o servidor Node (service_role) concede os baús onde ele JÁ sabe do que aconteceu (server/baus.js,
--     chamado de server/partidas.js, server/campanha.js e server/conquistas.js): conceder_bau(conta, fonte,
--     ref). Cada fonte tem uma CHAVE por conta (unique (user_id, chave)): repetir, reconectar ou mandar em
--     paralelo não dá dois baús. O banco confere a fonte de novo:
--       nivel      'nivel:<N>'        a conta já está no nível N (N >= 2): um baú por nível novo
--       dia        'dia:<AAAA-MM-DD>' o "baú do dia" (a 1ª partida terminada do dia; o dia é o do BANCO)
--       desafio    'desafio:<dia>'    a conta venceu o desafio daquele dia (desafio_concluidos, 0013)
--       semanal    'semanal:<semana>' a conta levou o troféu do boss da semana (trofeus_semanais, 0010)
--       conquista  'conquista:<id>'   a conta tem a conquista (0014) e ela está em bau_conquistas()
--   * o servidor ABRE o baú: sorteia os números com crypto.randomInt (Node) e chama abrir_bau(conta, baú,
--     números). As REGRAS moram aqui (raridade, quantidade, pena/pity, duplicado vira XP, teto de XP do dia)
--     e rodam com a conta travada (pg_advisory_xact_lock): dois "abrir" ao mesmo tempo abrem dois baús
--     diferentes ou devolvem o mesmo resultado; o mesmo baú nunca abre duas vezes. src/lib/cosmeticos.js
--     (rolarBau) é o espelho em JS (o teste confere os dois com os mesmos números).
--   * o navegador só LÊ as próprias linhas (RLS) e equipa o que TEM pela equipar() de sempre, agora com os
--     tipos 'som', 'efeito' e 'lancamento' (a moldura animada usa o tipo 'moldura').
--
--   1. catalogo_itens: tipos novos (som, efeito, lancamento), `raridade` e `bau` (o item sai do baú). Os
--      itens do baú têm nivel_requerido nivel_exclusivo() (1000): a trilha de níveis nunca os entrega.
--   2. perfis: som_equipado, efeito_equipado, lancamento_equipado (null = o padrão de graça).
--   3. baus (um por conta e chave) e baus_contas (a pena: baús seguidos sem épico ou melhor).
--
-- Depende de 0001, 0003, 0010, 0013 e 0014. Pode rodar de novo: "if not exists" / "or replace" / "on conflict".
-- NUNCA edite as migrations antigas: elas já rodaram em produção.

-- ---------- constantes (espelho em src/lib/cosmeticos.js; o teste confere) ----------

create or replace function public.bau_escala() returns integer
language sql immutable set search_path = '' as $$ select 1000000 $$;
create or replace function public.bau_pity() returns integer
language sql immutable set search_path = '' as $$ select 10 $$;
create or replace function public.bau_chance_xp_extra() returns integer
language sql immutable set search_path = '' as $$ select 350000 $$;
create or replace function public.bau_xp_teto_dia() returns integer
language sql immutable set search_path = '' as $$ select 500 $$;
create or replace function public.bau_sorteio_tamanho() returns integer
language sql immutable set search_path = '' as $$ select 10 $$;
-- raridade de um número sorteado (0..escala-1): comum 60% · raro 28% · épico 10% · lendário 2%
create or replace function public.bau_raridade(p_u integer) returns text
language sql immutable set search_path = '' as $$
  select case when p_u < 600000 then 'comum' when p_u < 880000 then 'raro' when p_u < 980000 then 'epico' else 'lendario' end
$$;
create or replace function public.bau_nivel_raridade(p_r text) returns integer
language sql immutable set search_path = '' as $$
  select case p_r when 'comum' then 0 when 'raro' then 1 when 'epico' then 2 when 'lendario' then 3 else -1 end
$$;
-- quantas recompensas: 1 (50%), 2 (35%), 3 (15%)
create or replace function public.bau_quantidade(p_u integer) returns integer
language sql immutable set search_path = '' as $$ select case when p_u < 500000 then 1 when p_u < 850000 then 2 else 3 end $$;
create or replace function public.bau_xp_bonus(p_r text) returns integer
language sql immutable set search_path = '' as $$ select case p_r when 'comum' then 25 when 'raro' then 50 when 'epico' then 100 when 'lendario' then 200 else 0 end $$;
create or replace function public.bau_xp_duplicado(p_r text) returns integer
language sql immutable set search_path = '' as $$ select case p_r when 'comum' then 15 when 'raro' then 30 when 'epico' then 60 when 'lendario' then 120 else 0 end $$;
-- as conquistas que dão um baú (uma vez cada)
create or replace function public.bau_conquistas() returns text[]
language sql immutable set search_path = '' as $$
  select array['primeira_vitoria', 'casa_silenciosa', 'cacador_semanal', 'sete_sois', 'mao_firme', 'lenda_da_mesa', 'cadeira_cativa', 'alma_gemea']
$$;

-- ---------- catálogo: tipos novos, raridade e "sai do baú" ----------

alter table public.catalogo_itens drop constraint if exists catalogo_itens_id_check;
alter table public.catalogo_itens drop constraint if exists catalogo_itens_tipo_check;
alter table public.catalogo_itens drop constraint if exists catalogo_id_formato;
alter table public.catalogo_itens add constraint catalogo_id_formato check (id ~ '^(avatar|titulo|moldura|verso|som|efeito|lancamento)\.[a-z0-9_]{2,24}$');
alter table public.catalogo_itens drop constraint if exists catalogo_tipo_valido;
alter table public.catalogo_itens add constraint catalogo_tipo_valido check (tipo in ('avatar', 'titulo', 'moldura', 'verso', 'som', 'efeito', 'lancamento'));
alter table public.catalogo_itens add column if not exists raridade text;
alter table public.catalogo_itens add column if not exists bau boolean not null default false;
alter table public.catalogo_itens drop constraint if exists catalogo_raridade_valida;
alter table public.catalogo_itens add constraint catalogo_raridade_valida check (raridade is null or raridade in ('comum', 'raro', 'epico', 'lendario'));
-- um item do baú tem raridade e nunca sai pela trilha, pela semana nem pela maestria
alter table public.catalogo_itens drop constraint if exists catalogo_bau_coerente;
alter table public.catalogo_itens add constraint catalogo_bau_coerente check (
  not bau or (raridade is not null and not padrao and not exclusivo and maestria_personagem is null and nivel_requerido > 99)
);
create index if not exists catalogo_itens_bau_idx on public.catalogo_itens (raridade) where bau;

-- o espelho é ITENS_BAU em src/lib/cosmeticos.js (o teste confere id, tipo, nome e raridade)
insert into public.catalogo_itens (id, tipo, nome, nivel_requerido, padrao, exclusivo, raridade, bau) values
  ('som.latido', 'som', 'Latido', public.nivel_exclusivo(), false, false, 'comum', true),
  ('som.pato', 'som', 'Quack', public.nivel_exclusivo(), false, false, 'comum', true),
  ('som.buzina', 'som', 'Buzina', public.nivel_exclusivo(), false, false, 'comum', true),
  ('som.boing', 'som', 'Boing', public.nivel_exclusivo(), false, false, 'comum', true),
  ('som.miau', 'som', 'Miau', public.nivel_exclusivo(), false, false, 'raro', true),
  ('som.moeda', 'som', 'Moedinha', public.nivel_exclusivo(), false, false, 'raro', true),
  ('som.sino', 'som', 'Sino', public.nivel_exclusivo(), false, false, 'raro', true),
  ('som.vidro', 'som', 'Vidro Quebrado', public.nivel_exclusivo(), false, false, 'epico', true),
  ('som.cabra', 'som', 'Cabra', public.nivel_exclusivo(), false, false, 'epico', true),
  ('som.laser', 'som', 'Laser', public.nivel_exclusivo(), false, false, 'lendario', true),
  ('efeito.bolhas', 'efeito', 'Bolhas', public.nivel_exclusivo(), false, false, 'comum', true),
  ('efeito.folhas', 'efeito', 'Folhas ao Vento', public.nivel_exclusivo(), false, false, 'comum', true),
  ('efeito.brilho', 'efeito', 'Brilho', public.nivel_exclusivo(), false, false, 'comum', true),
  ('efeito.estrelas', 'efeito', 'Estrelas', public.nivel_exclusivo(), false, false, 'raro', true),
  ('efeito.sombra', 'efeito', 'Sombra', public.nivel_exclusivo(), false, false, 'raro', true),
  ('efeito.arco_iris', 'efeito', 'Arco-íris', public.nivel_exclusivo(), false, false, 'raro', true),
  ('efeito.chamas', 'efeito', 'Chamas', public.nivel_exclusivo(), false, false, 'epico', true),
  ('efeito.eletrico', 'efeito', 'Elétrico', public.nivel_exclusivo(), false, false, 'epico', true),
  ('efeito.pixel_fogo', 'efeito', 'Fogo de Pixel', public.nivel_exclusivo(), false, false, 'epico', true),
  ('efeito.holografico', 'efeito', 'Holográfico', public.nivel_exclusivo(), false, false, 'lendario', true),
  ('lancamento.confete', 'lancamento', 'Confete', public.nivel_exclusivo(), false, false, 'comum', true),
  ('lancamento.sakura', 'lancamento', 'Sakura', public.nivel_exclusivo(), false, false, 'comum', true),
  ('lancamento.raio', 'lancamento', 'Raio', public.nivel_exclusivo(), false, false, 'raro', true),
  ('lancamento.meteoro', 'lancamento', 'Meteoro', public.nivel_exclusivo(), false, false, 'raro', true),
  ('lancamento.explosao', 'lancamento', 'Explosão', public.nivel_exclusivo(), false, false, 'epico', true),
  ('lancamento.tsunami', 'lancamento', 'Tsunami', public.nivel_exclusivo(), false, false, 'epico', true),
  ('lancamento.arco_iris_borboletas', 'lancamento', 'Borboletas de Arco-íris', public.nivel_exclusivo(), false, false, 'lendario', true),
  ('lancamento.buraco_negro', 'lancamento', 'Buraco Negro', public.nivel_exclusivo(), false, false, 'lendario', true),
  ('moldura.anim_coracoes', 'moldura', 'Corações', public.nivel_exclusivo(), false, false, 'comum', true),
  ('moldura.anim_estrelas', 'moldura', 'Estrelas Cadentes', public.nivel_exclusivo(), false, false, 'comum', true),
  ('moldura.anim_gelo', 'moldura', 'Gelo', public.nivel_exclusivo(), false, false, 'comum', true),
  ('moldura.anim_slime', 'moldura', 'Slime', public.nivel_exclusivo(), false, false, 'raro', true),
  ('moldura.anim_neon', 'moldura', 'Neon', public.nivel_exclusivo(), false, false, 'raro', true),
  ('moldura.anim_arco_iris', 'moldura', 'Arco-íris Vivo', public.nivel_exclusivo(), false, false, 'raro', true),
  ('moldura.anim_fogo', 'moldura', 'Fogo', public.nivel_exclusivo(), false, false, 'epico', true),
  ('moldura.anim_glitch', 'moldura', 'Glitch', public.nivel_exclusivo(), false, false, 'epico', true),
  ('moldura.anim_gerson', 'moldura', 'Gerson', public.nivel_exclusivo(), false, false, 'lendario', true),
  ('moldura.anim_galaxia', 'moldura', 'Galáxia', public.nivel_exclusivo(), false, false, 'lendario', true),
  ('titulo.bau_curioso', 'titulo', 'Curioso(a)', public.nivel_exclusivo(), false, false, 'comum', true),
  ('titulo.bau_sortudo', 'titulo', 'Sortudo(a)', public.nivel_exclusivo(), false, false, 'comum', true),
  ('titulo.bau_cacador', 'titulo', 'Caçador(a) de Baús', public.nivel_exclusivo(), false, false, 'raro', true),
  ('titulo.bau_colecionador', 'titulo', 'Colecionador(a)', public.nivel_exclusivo(), false, false, 'raro', true),
  ('titulo.bau_reliquia', 'titulo', 'Relíquia Viva', public.nivel_exclusivo(), false, false, 'epico', true),
  ('titulo.bau_lenda', 'titulo', 'Lenda do Baú', public.nivel_exclusivo(), false, false, 'lendario', true)

on conflict (id) do update
  set tipo = excluded.tipo,
      nome = excluded.nome,
      nivel_requerido = excluded.nivel_requerido,
      padrao = excluded.padrao,
      exclusivo = excluded.exclusivo,
      raridade = excluded.raridade,
      bau = excluded.bau;

-- ---------- perfil: os slots novos ----------

alter table public.perfis add column if not exists som_equipado text;
alter table public.perfis add column if not exists efeito_equipado text;
alter table public.perfis add column if not exists lancamento_equipado text;
alter table public.perfis drop constraint if exists perfis_slots_tamanho;
alter table public.perfis add constraint perfis_slots_tamanho check (
  (som_equipado is null or char_length(som_equipado) <= 40)
  and (efeito_equipado is null or char_length(efeito_equipado) <= 40)
  and (lancamento_equipado is null or char_length(lancamento_equipado) <= 40)
);

-- ---------- tabelas ----------

create table if not exists public.baus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfis (id) on delete cascade,
  fonte text not null check (fonte in ('nivel', 'dia', 'desafio', 'semanal', 'conquista')),
  chave text not null check (chave ~ '^[a-z]+:[A-Za-z0-9_-]{1,40}$'),
  criado_em timestamptz not null default now(),
  aberto_em timestamptz,
  xp integer not null default 0 check (xp >= 0),
  resultado jsonb check (resultado is null or pg_column_size(resultado) <= 4096),
  unique (user_id, chave)
);
create index if not exists baus_fechados_idx on public.baus (user_id, criado_em) where aberto_em is null;
create index if not exists baus_abertos_idx on public.baus (user_id, aberto_em) where aberto_em is not null;

-- a pena (pity): quantos baús seguidos a conta abriu sem nada épico ou melhor
create table if not exists public.baus_contas (
  user_id uuid primary key references public.perfis (id) on delete cascade,
  desde_epico integer not null default 0 check (desde_epico >= 0),
  abertos integer not null default 0 check (abertos >= 0),
  atualizado_em timestamptz not null default now()
);

-- ---------- equipar (o navegador e o servidor) ----------

-- Equipa um item do catálogo na conta p_uid. p_tipo: 'titulo' | 'moldura' | 'verso' | 'avatar' | 'som' |
-- 'efeito' | 'lancamento'. Só item que a conta tem (inventário) ou padrão. p_item null tira (menos o avatar).
-- O SERVIDOR chama direto (o dev com contas falsas); o navegador chama equipar(), que passa auth.uid().
create or replace function public.equipar_conta(p_uid uuid, p_tipo text, p_item text default null)
returns public.perfis
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.catalogo_itens;
  v_perfil public.perfis;
begin
  if p_uid is null then
    raise exception 'precisa estar logado' using errcode = '28000';
  end if;
  if p_tipo is null or p_tipo not in ('avatar', 'titulo', 'moldura', 'verso', 'som', 'efeito', 'lancamento') then
    raise exception 'tipo de item inválido' using errcode = '22023';
  end if;
  select * into v_perfil from public.perfis where id = p_uid for update;
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
    if not v_item.padrao and not exists (select 1 from public.inventario i where i.user_id = p_uid and i.item_id = p_item) then
      raise exception 'você ainda não tem esse item' using errcode = '42501';
    end if;
  end if;

  update public.perfis
     set titulo_equipado = case when p_tipo = 'titulo' then p_item else titulo_equipado end,
         moldura_equipada = case when p_tipo = 'moldura' then p_item else moldura_equipada end,
         verso_equipado = case when p_tipo = 'verso' then p_item else verso_equipado end,
         som_equipado = case when p_tipo = 'som' then p_item else som_equipado end,
         efeito_equipado = case when p_tipo = 'efeito' then p_item else efeito_equipado end,
         lancamento_equipado = case when p_tipo = 'lancamento' then p_item else lancamento_equipado end,
         avatar_tipo = case when p_tipo = 'avatar' then 'jogo' else avatar_tipo end,
         avatar_id = case when p_tipo = 'avatar' then split_part(p_item, '.', 2) else avatar_id end
   where id = p_uid
  returning * into v_perfil;
  return v_perfil;
end;
$$;

-- a mesma de sempre (0003), agora com os tipos novos: o navegador só equipa na PRÓPRIA conta
create or replace function public.equipar(p_tipo text, p_item text default null)
returns public.perfis
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'precisa estar logado' using errcode = '28000';
  end if;
  return public.equipar_conta(auth.uid(), p_tipo, p_item);
end;
$$;

-- ---------- conceder um baú (só o servidor) ----------

-- p_ref: nivel -> o nível ('7'); desafio -> o dia ('2026-11-12'); semanal -> a semana ('2026-S46');
-- conquista -> o id da conquista; dia -> ignorado (o dia é o de hoje no banco).
-- Devolve { novo, fonte, chave, fechados }. Fonte que não confere: erro (o servidor só loga).
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
  if p_fonte is null or p_fonte not in ('nivel', 'dia', 'desafio', 'semanal', 'conquista') then
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

-- ---------- abrir um baú (só o servidor; os números vêm do crypto.randomInt do Node) ----------

-- p_bau null = o fechado mais antigo. p_sorteio: bau_sorteio_tamanho() inteiros em [0, bau_escala()):
--   [1] quantidade · e para cada recompensa k (0, 1, 2): [2+3k] raridade · [3+3k] XP ou item · [4+3k] qual item
-- Regras (as mesmas de rolarBau em src/lib/cosmeticos.js):
--   * a 1ª recompensa é sempre um cosmético; a 2ª e a 3ª têm bau_chance_xp_extra() de ser XP (bau_xp_bonus);
--   * PENA: depois de bau_pity() - 1 baús seguidos sem nada épico ou melhor, a 1ª recompensa é no mínimo épica;
--   * o item é o de índice (número % tamanho) entre os do baú daquela raridade, em ordem de id (collate "C");
--   * já tinha (ou saiu duas vezes no mesmo baú): vira bau_xp_duplicado() XP ("já tinha: +N XP");
--   * o XP dos baús abertos no mesmo dia (São Paulo) soma no máximo bau_xp_teto_dia();
--   * o XP pode subir o nível: a trilha entrega os itens e cada nível novo dá outro baú (fonte 'nivel').
-- Abrir de novo um baú já aberto devolve o mesmo resultado (repetido = true), sem somar nada.
create or replace function public.abrir_bau(p_user uuid, p_bau uuid, p_sorteio integer[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.perfis;
  v_b public.baus;
  v_c public.baus_contas;
  v_dia timestamptz := (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
  v_n integer;
  v_pity boolean;
  v_rar text;
  v_melhor integer := -1;
  v_pool text[];
  v_id text;
  v_saiu text[] := array[]::text[];
  v_rec jsonb := '[]'::jsonb;
  v_soma integer := 0;
  v_hoje integer;
  v_xp integer;
  v_total integer;
  v_nivel integer;
  v_itens jsonb := '[]'::jsonb;
  v_res jsonb;
  k integer;
begin
  if p_sorteio is null or cardinality(p_sorteio) <> public.bau_sorteio_tamanho()
     or exists (select 1 from unnest(p_sorteio) x where x is null or x < 0 or x >= public.bau_escala()) then
    raise exception 'sorteio inválido' using errcode = '22023';
  end if;

  -- trava a conta: dois "abrir" ao mesmo tempo viram um depois do outro (a pena e o inventário ficam certos)
  perform pg_advisory_xact_lock(hashtextextended('bau:' || p_user::text, 0));
  select * into v_perfil from public.perfis where id = p_user for update;
  if not found then
    raise exception 'perfil não encontrado' using errcode = 'P0002';
  end if;

  if p_bau is null then
    select * into v_b from public.baus where user_id = p_user and aberto_em is null order by criado_em, id limit 1 for update;
    if not found then
      return jsonb_build_object('aberto', false, 'motivo', 'sem_bau', 'fechados', 0);
    end if;
  else
    select * into v_b from public.baus where id = p_bau and user_id = p_user for update;
    if not found then
      raise exception 'baú não existe' using errcode = 'P0002';
    end if;
    if v_b.aberto_em is not null then
      return v_b.resultado || jsonb_build_object('repetido', true,
        'fechados', (select count(*) from public.baus b where b.user_id = p_user and b.aberto_em is null));
    end if;
  end if;

  insert into public.baus_contas (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into v_c from public.baus_contas where user_id = p_user for update;

  v_n := public.bau_quantidade(p_sorteio[1]);
  v_pity := v_c.desde_epico >= public.bau_pity() - 1;
  for k in 0 .. v_n - 1 loop
    v_rar := public.bau_raridade(p_sorteio[2 + 3 * k]);
    if k = 0 and v_pity and public.bau_nivel_raridade(v_rar) < public.bau_nivel_raridade('epico') then
      v_rar := 'epico';
    end if;
    v_melhor := greatest(v_melhor, public.bau_nivel_raridade(v_rar));
    select coalesce(array_agg(ci.id order by ci.id collate "C"), array[]::text[]) into v_pool
      from public.catalogo_itens ci where ci.bau and ci.raridade = v_rar;
    if (k > 0 and p_sorteio[3 + 3 * k] < public.bau_chance_xp_extra()) or cardinality(v_pool) = 0 then
      v_rec := v_rec || jsonb_build_array(jsonb_build_object('tipo', 'xp', 'raridade', v_rar, 'xp', public.bau_xp_bonus(v_rar)));
      v_soma := v_soma + public.bau_xp_bonus(v_rar);
      continue;
    end if;
    v_id := v_pool[1 + (p_sorteio[4 + 3 * k] % cardinality(v_pool))];
    if v_id = any (v_saiu) or exists (select 1 from public.inventario i where i.user_id = p_user and i.item_id = v_id) then
      v_rec := v_rec || jsonb_build_array(jsonb_build_object('tipo', 'duplicado', 'id', v_id, 'raridade', v_rar, 'xp', public.bau_xp_duplicado(v_rar)));
      v_soma := v_soma + public.bau_xp_duplicado(v_rar);
    else
      insert into public.inventario (user_id, item_id) values (p_user, v_id) on conflict do nothing;
      v_rec := v_rec || jsonb_build_array(jsonb_build_object('tipo', 'item', 'id', v_id, 'raridade', v_rar));
    end if;
    v_saiu := v_saiu || v_id;
  end loop;

  -- o XP (com o teto do dia dos baús) e o nível
  select coalesce(sum(b.xp), 0) into v_hoje from public.baus b where b.user_id = p_user and b.aberto_em >= v_dia;
  v_xp := least(v_soma, greatest(0, public.bau_xp_teto_dia() - v_hoje));
  v_total := least(v_perfil.xp::bigint + v_xp, 2000000000)::integer;
  v_nivel := public.nivel_do_xp(v_total);
  if v_xp > 0 then
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
    -- cada nível novo, um baú
    for k in v_perfil.nivel + 1 .. v_nivel loop
      insert into public.baus (user_id, fonte, chave) values (p_user, 'nivel', 'nivel:' || k) on conflict (user_id, chave) do nothing;
    end loop;
  end if;

  update public.baus_contas
     set desde_epico = case when v_melhor >= public.bau_nivel_raridade('epico') then 0 else desde_epico + 1 end,
         abertos = abertos + 1,
         atualizado_em = now()
   where user_id = p_user
  returning * into v_c;

  v_res := jsonb_build_object('aberto', true, 'bau_id', v_b.id, 'fonte', v_b.fonte, 'recompensas', v_rec, 'xp_sorteado', v_soma,
    'xp_ganho', v_xp, 'teto', v_xp < v_soma, 'xp_total', v_total, 'nivel_antes', v_perfil.nivel, 'nivel_depois', v_nivel,
    'itens_novos', v_itens, 'pity', v_pity, 'desde_epico', v_c.desde_epico);
  update public.baus set aberto_em = now(), xp = v_xp, resultado = v_res where id = v_b.id;
  return v_res || jsonb_build_object('repetido', false,
    'fechados', (select count(*) from public.baus b where b.user_id = p_user and b.aberto_em is null));
end;
$$;

-- o que a tela dos baús mostra (o servidor manda pelo lobby)
create or replace function public.baus_estado(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'fechados', (select count(*) from public.baus b where b.user_id = p_user and b.aberto_em is null),
    'abertos', coalesce((select c.abertos from public.baus_contas c where c.user_id = p_user), 0),
    'desde_epico', coalesce((select c.desde_epico from public.baus_contas c where c.user_id = p_user), 0),
    'lista', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'fonte', x.fonte, 'chave', x.chave, 'em', x.criado_em) order by x.criado_em, x.id)
        from (select b.id, b.fonte, b.chave, b.criado_em from public.baus b
               where b.user_id = p_user and b.aberto_em is null order by b.criado_em, b.id limit 20) x
    ), '[]'::jsonb)
  )
$$;

-- ---------- permissões e RLS ----------

alter table public.baus enable row level security;
alter table public.baus_contas enable row level security;
revoke all on table public.baus, public.baus_contas from anon, authenticated;
grant select on table public.baus, public.baus_contas to authenticated;
drop policy if exists baus_leitura on public.baus;
create policy baus_leitura on public.baus for select to authenticated using (user_id = auth.uid());
drop policy if exists baus_contas_leitura on public.baus_contas;
create policy baus_contas_leitura on public.baus_contas for select to authenticated using (user_id = auth.uid());

revoke all on function public.bau_escala() from public, anon, authenticated;
revoke all on function public.bau_pity() from public, anon, authenticated;
revoke all on function public.bau_chance_xp_extra() from public, anon, authenticated;
revoke all on function public.bau_xp_teto_dia() from public, anon, authenticated;
revoke all on function public.bau_sorteio_tamanho() from public, anon, authenticated;
revoke all on function public.bau_raridade(integer) from public, anon, authenticated;
revoke all on function public.bau_nivel_raridade(text) from public, anon, authenticated;
revoke all on function public.bau_quantidade(integer) from public, anon, authenticated;
revoke all on function public.bau_xp_bonus(text) from public, anon, authenticated;
revoke all on function public.bau_xp_duplicado(text) from public, anon, authenticated;
revoke all on function public.bau_conquistas() from public, anon, authenticated;
revoke all on function public.equipar_conta(uuid, text, text) from public, anon, authenticated;
revoke all on function public.conceder_bau(uuid, text, text) from public, anon, authenticated;
revoke all on function public.abrir_bau(uuid, uuid, integer[]) from public, anon, authenticated;
revoke all on function public.baus_estado(uuid) from public, anon, authenticated;
revoke all on function public.equipar(text, text) from public, anon;
grant execute on function public.equipar(text, text) to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.equipar_conta(uuid, text, text) to service_role;
    grant execute on function public.conceder_bau(uuid, text, text) to service_role;
    grant execute on function public.abrir_bau(uuid, uuid, integer[]) to service_role;
    grant execute on function public.baus_estado(uuid) to service_role;
    grant all on table public.baus, public.baus_contas to service_role;
  end if;
end;
$$;
