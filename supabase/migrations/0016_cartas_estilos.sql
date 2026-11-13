-- ESTILOS DA FRENTE DA CARTA e VERSOS ILUSTRADOS (docs/cosmeticos.md, docs/cosmeticos-ids.md, docs/baus.md).
-- Cosméticos nunca mudam nada no jogo (regra fixa da Fase 4): só o desenho da carta. Tudo sai do BAÚ (que só
-- se ganha jogando: não existe compra nenhuma).
--
--   1. catalogo_itens: o tipo novo 'frente' (o estilo da face das SUAS cartas) e os itens do baú: 10 estilos
--      de frente e 12 versos ilustrados (tipo 'verso', o slot de verso de sempre). Todos com bau = true e
--      nivel_requerido nivel_exclusivo() (a trilha nunca os entrega); abrir_bau (0015) já sorteia entre todos
--      os itens com bau = true da raridade sorteada: nada mais muda no sorteio.
--   2. perfis.frente_equipada (null = o estilo clássico, de graça).
--   3. equipar_conta / equipar aceitam o tipo 'frente' (só o que a conta TEM, como os outros).
--
-- Depende da 0001, 0003 e 0015. Pode rodar de novo: "if not exists" / "or replace" / "on conflict".
-- NUNCA edite as migrations antigas: elas já rodaram em produção.

-- ---------- catálogo: o tipo novo ----------

alter table public.catalogo_itens drop constraint if exists catalogo_id_formato;
alter table public.catalogo_itens add constraint catalogo_id_formato check (id ~ '^(avatar|titulo|moldura|verso|som|efeito|lancamento|frente)\.[a-z0-9_]{2,24}$');
alter table public.catalogo_itens drop constraint if exists catalogo_tipo_valido;
alter table public.catalogo_itens add constraint catalogo_tipo_valido check (tipo in ('avatar', 'titulo', 'moldura', 'verso', 'som', 'efeito', 'lancamento', 'frente'));

-- o espelho é ITENS_BAU em src/lib/cosmeticos.js (o teste confere id, tipo, nome e raridade)
insert into public.catalogo_itens (id, tipo, nome, nivel_requerido, padrao, exclusivo, raridade, bau) values
  ('frente.mal_desenhada', 'frente', 'Mal Desenhada', public.nivel_exclusivo(), false, false, 'comum', true),
  ('frente.jornal', 'frente', 'Jornal', public.nivel_exclusivo(), false, false, 'comum', true),
  ('frente.pixel', 'frente', 'Pixel 8-bit', public.nivel_exclusivo(), false, false, 'raro', true),
  ('frente.sakura', 'frente', 'Sakura', public.nivel_exclusivo(), false, false, 'raro', true),
  ('frente.cervos_nara', 'frente', 'Cervos de Nara', public.nivel_exclusivo(), false, false, 'raro', true),
  ('frente.dark', 'frente', 'Dark Mode', public.nivel_exclusivo(), false, false, 'raro', true),
  ('frente.aquarela', 'frente', 'Aquarela', public.nivel_exclusivo(), false, false, 'epico', true),
  ('frente.origami', 'frente', 'Origami', public.nivel_exclusivo(), false, false, 'epico', true),
  ('frente.holografica', 'frente', 'Holográfica', public.nivel_exclusivo(), false, false, 'epico', true),
  ('frente.tarot', 'frente', 'Tarot', public.nivel_exclusivo(), false, false, 'lendario', true),
  ('verso.noite_estrelada', 'verso', 'Lua e Estrelas', public.nivel_exclusivo(), false, false, 'comum', true),
  ('verso.circuito', 'verso', 'Placa de Circuito', public.nivel_exclusivo(), false, false, 'comum', true),
  ('verso.patinhas', 'verso', 'Patinhas de Gato', public.nivel_exclusivo(), false, false, 'comum', true),
  ('verso.aboboras', 'verso', 'Abóboras', public.nivel_exclusivo(), false, false, 'comum', true),
  ('verso.lago_koi', 'verso', 'Lago das Carpas', public.nivel_exclusivo(), false, false, 'raro', true),
  ('verso.vitral', 'verso', 'Vitral', public.nivel_exclusivo(), false, false, 'raro', true),
  ('verso.cervo_nara', 'verso', 'Cervo de Nara', public.nivel_exclusivo(), false, false, 'raro', true),
  ('verso.fliperama', 'verso', 'Fliperama', public.nivel_exclusivo(), false, false, 'raro', true),
  ('verso.filigrana', 'verso', 'Filigrana Vitoriana', public.nivel_exclusivo(), false, false, 'epico', true),
  ('verso.onda', 'verso', 'Onda do Mar', public.nivel_exclusivo(), false, false, 'epico', true),
  ('verso.dragao_pixel', 'verso', 'Dragão de Pixel', public.nivel_exclusivo(), false, false, 'epico', true),
  ('verso.galaxia', 'verso', 'Galáxia', public.nivel_exclusivo(), false, false, 'lendario', true)
on conflict (id) do update
  set tipo = excluded.tipo,
      nome = excluded.nome,
      nivel_requerido = excluded.nivel_requerido,
      padrao = excluded.padrao,
      exclusivo = excluded.exclusivo,
      raridade = excluded.raridade,
      bau = excluded.bau;

-- ---------- perfil: o estilo da frente ----------

alter table public.perfis add column if not exists frente_equipada text;
alter table public.perfis drop constraint if exists perfis_frente_tamanho;
alter table public.perfis add constraint perfis_frente_tamanho check (frente_equipada is null or char_length(frente_equipada) <= 40);

-- ---------- equipar (o navegador e o servidor) ----------

-- A mesma da 0015, agora com o tipo 'frente'. p_tipo: 'titulo' | 'moldura' | 'verso' | 'avatar' | 'som' |
-- 'efeito' | 'lancamento' | 'frente'. Só item que a conta tem (inventário) ou padrão. p_item null tira (menos o
-- avatar). O SERVIDOR chama direto (o dev com contas falsas); o navegador chama equipar(), que passa auth.uid().
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
  if p_tipo is null or p_tipo not in ('avatar', 'titulo', 'moldura', 'verso', 'som', 'efeito', 'lancamento', 'frente') then
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
         frente_equipada = case when p_tipo = 'frente' then p_item else frente_equipada end,
         avatar_tipo = case when p_tipo = 'avatar' then 'jogo' else avatar_tipo end,
         avatar_id = case when p_tipo = 'avatar' then split_part(p_item, '.', 2) else avatar_id end
   where id = p_uid
  returning * into v_perfil;
  return v_perfil;
end;
$$;

-- a de sempre (0003/0015): o navegador só equipa na PRÓPRIA conta
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

-- ---------- permissões (o mesmo da 0015) ----------

revoke all on function public.equipar_conta(uuid, text, text) from public, anon, authenticated;
revoke all on function public.equipar(text, text) from public, anon;
grant execute on function public.equipar(text, text) to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.equipar_conta(uuid, text, text) to service_role;
  end if;
end;
$$;
