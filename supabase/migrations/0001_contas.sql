-- Fase 1A: contas, perfil e foto (docs/supabase.md)
--
-- Quem escreve o quê:
--   * o navegador (chave anon + JWT do usuário) só LÊ perfis/estatísticas e
--     muda o próprio nome e avatar do jogo pela função atualizar_perfil();
--   * o servidor Node (chave service_role) grava a foto enviada (avatar_url)
--     e, a partir da 1D, nível/XP/estatísticas;
--   * tag, nivel, xp e avatar_url nunca são graváveis pelo cliente.
--
-- Rodar no SQL Editor do projeto (ou `supabase db push`). Pode rodar de novo:
-- os comandos usam "if not exists"/"or replace" onde dá.

-- ---------- perfis ----------

create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  -- identificador estável e único (ex.: joao#4821), gerado aqui no banco na
  -- criação da conta; não muda quando o nome de exibição muda
  tag text not null unique,
  nome_exibicao text not null,
  avatar_tipo text not null default 'padrao',
  avatar_id text,
  avatar_url text,
  titulo_equipado text,
  nivel integer not null default 1,
  xp integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint perfis_tag_formato check (tag ~ '^[a-z0-9]{3,12}#[0-9]{4,6}$'),
  constraint perfis_nome_tamanho check (char_length(nome_exibicao) between 3 and 16),
  constraint perfis_nome_limpo check (
    nome_exibicao = btrim(nome_exibicao)
    and nome_exibicao !~ '\s\s'
    and nome_exibicao !~ '[[:cntrl:]]'
  ),
  constraint perfis_avatar_tipo check (avatar_tipo in ('padrao', 'jogo', 'enviado')),
  constraint perfis_avatar_coerente check (
    (avatar_tipo = 'padrao' and avatar_id is null)
    or (avatar_tipo = 'jogo' and avatar_id in ('kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel'))
    or (avatar_tipo = 'enviado' and avatar_url is not null and avatar_id is null)
  ),
  constraint perfis_avatar_url_tamanho check (avatar_url is null or char_length(avatar_url) <= 512),
  constraint perfis_titulo_tamanho check (titulo_equipado is null or char_length(titulo_equipado) <= 32),
  constraint perfis_nivel check (nivel >= 1),
  constraint perfis_xp check (xp >= 0)
);

-- ---------- estatísticas básicas (preenchidas a partir da 1D) ----------

create table if not exists public.estatisticas_basicas (
  usuario_id uuid primary key references public.perfis (id) on delete cascade,
  partidas integer not null default 0 check (partidas >= 0),
  vitorias integer not null default 0 check (vitorias >= 0),
  personagem_favorito text check (personagem_favorito is null or char_length(personagem_favorito) <= 16),
  atualizado_em timestamptz not null default now()
);

-- ---------- atualizado_em ----------

create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists perfis_atualizado_em on public.perfis;
create trigger perfis_atualizado_em before update on public.perfis
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists estatisticas_atualizado_em on public.estatisticas_basicas;
create trigger estatisticas_atualizado_em before update on public.estatisticas_basicas
  for each row execute function public.tocar_atualizado_em();

-- ---------- nome: as mesmas regras do src/lib/contaRegras.js ----------

-- espaços juntados e pontas cortadas; null se não serve
create or replace function public.normalizar_nome(p_nome text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when n ~ '^[[:alnum:] _.-]{3,16}$' then n
    else null
  end
  from (select regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g') as n) as x;
$$;

-- ---------- criação do perfil junto com a conta ----------

create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bruto text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '');
  v_nome text;
  v_base text;
  v_tag text;
  v_tentativa integer := 0;
begin
  -- nome de exibição: o do Google, sem o que a regra não aceita
  v_nome := left(regexp_replace(btrim(regexp_replace(v_bruto, '[^[:alnum:] _.-]', '', 'g')), '\s+', ' ', 'g'), 16);
  v_nome := btrim(v_nome);
  if public.normalizar_nome(v_nome) is null then
    v_nome := 'JOGADOR';
  end if;

  -- base da tag: o primeiro nome sem acento, só a-z0-9
  v_base := lower(split_part(v_nome, ' ', 1));
  v_base := translate(v_base, 'áàâãäåéèêëíìîïóòôõöúùûüçñý', 'aaaaaaeeeeiiiiooooouuuucny');
  v_base := left(regexp_replace(v_base, '[^a-z0-9]', '', 'g'), 12);
  if char_length(v_base) < 3 then
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

  insert into public.perfis (id, tag, nome_exibicao) values (new.id, v_tag, v_nome);
  insert into public.estatisticas_basicas (usuario_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- ---------- o que o próprio usuário pode mudar ----------

-- p_nome: novo nome de exibição (null = não mexe)
-- p_avatar_tipo: 'padrao' | 'jogo' (com p_avatar_id) | 'enviado' (volta para a
-- foto que já foi enviada pelo servidor). null = não mexe.
create or replace function public.atualizar_perfil(
  p_nome text default null,
  p_avatar_tipo text default null,
  p_avatar_id text default null
)
returns public.perfis
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_nome text;
  v_perfil public.perfis;
begin
  if v_uid is null then
    raise exception 'precisa estar logado' using errcode = '28000';
  end if;

  select * into v_perfil from public.perfis where id = v_uid for update;
  if not found then
    raise exception 'perfil não encontrado' using errcode = 'P0002';
  end if;

  if p_nome is not null then
    v_nome := public.normalizar_nome(p_nome);
    if v_nome is null then
      raise exception 'nome inválido: de 3 a 16 letras, números, espaço, _ . -' using errcode = '22023';
    end if;
    v_perfil.nome_exibicao := v_nome;
  end if;

  if p_avatar_tipo is not null then
    if p_avatar_tipo = 'padrao' then
      v_perfil.avatar_tipo := 'padrao';
      v_perfil.avatar_id := null;
    elsif p_avatar_tipo = 'jogo' then
      if p_avatar_id is null or p_avatar_id not in ('kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel') then
        raise exception 'avatar inválido' using errcode = '22023';
      end if;
      v_perfil.avatar_tipo := 'jogo';
      v_perfil.avatar_id := p_avatar_id;
    elsif p_avatar_tipo = 'enviado' then
      if v_perfil.avatar_url is null then
        raise exception 'nenhuma foto enviada' using errcode = '22023';
      end if;
      v_perfil.avatar_tipo := 'enviado';
      v_perfil.avatar_id := null;
    else
      raise exception 'tipo de avatar inválido' using errcode = '22023';
    end if;
  end if;

  update public.perfis
     set nome_exibicao = v_perfil.nome_exibicao,
         avatar_tipo = v_perfil.avatar_tipo,
         avatar_id = v_perfil.avatar_id
   where id = v_uid
  returning * into v_perfil;
  return v_perfil;
end;
$$;

-- ---------- permissões e RLS ----------

alter table public.perfis enable row level security;
alter table public.estatisticas_basicas enable row level security;

-- o Supabase dá tudo para anon/authenticated por padrão: tira e devolve só a leitura
revoke all on table public.perfis from anon, authenticated;
revoke all on table public.estatisticas_basicas from anon, authenticated;
grant select on table public.perfis to authenticated;
grant select on table public.estatisticas_basicas to authenticated;

drop policy if exists perfis_leitura on public.perfis;
create policy perfis_leitura on public.perfis
  for select to authenticated using (true);

drop policy if exists estatisticas_leitura on public.estatisticas_basicas;
create policy estatisticas_leitura on public.estatisticas_basicas
  for select to authenticated using (true);
-- sem políticas de insert/update/delete: só o service_role (servidor) e as
-- funções security definer acima escrevem

revoke all on function public.atualizar_perfil(text, text, text) from public, anon;
grant execute on function public.atualizar_perfil(text, text, text) to authenticated;
revoke all on function public.criar_perfil_novo_usuario() from public, anon, authenticated;
revoke all on function public.normalizar_nome(text) from anon;

-- ---------- Storage: fotos de perfil ----------

-- leitura pública pela URL; nenhuma política de escrita em storage.objects para
-- este bucket: só o servidor (service_role) grava <id do usuário>.webp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 262144, array['image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
