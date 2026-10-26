-- Fase 1E: denúncias de nome/foto e filtro de nomes (docs/moderacao.md)
--
-- Quem escreve o quê:
--   * o navegador (chave anon + JWT) só chama denunciar(): a tabela denuncias
--     tem RLS ligado, sem política e sem GRANT. Ninguém lê as denúncias, nem as
--     próprias nem as dos outros;
--   * quem revisa usa o servidor/CLI com a chave secreta (scripts/moderar.js):
--     lista as abertas, aceita (apaga a foto / zera o nome) ou rejeita.
--
-- Depende da 0001_contas.sql (perfis, normalizar_nome, atualizar_perfil).
-- Pode rodar de novo: usa "if not exists"/"or replace".

-- ---------- limites ----------

create or replace function public.limite_denuncias_dia() returns integer
language sql immutable set search_path = '' as $$ select 10 $$;
create or replace function public.motivo_denuncia_max() returns integer
language sql immutable set search_path = '' as $$ select 200 $$;

-- ---------- filtro de nomes ----------

-- As MESMAS listas de src/lib/palavrasBloqueadas.js (o teste confere que são
-- iguais). Compara em minúsculas, sem acento, com o "leet" desfeito (0→o 1→i
-- 3→e 4→a 5→s 7→t @→a $→s); o resto que não é letra vira separador.
--   exatas:    só como palavra inteira ("puta" barra "puta_x", não "computador")
--   contidas:  palavras compridas, valem também coladas e com separadores no meio
create or replace function public.nome_ofensivo(p_nome text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with n as (
    select translate(
             lower(coalesce(p_nome, '')),
             'áàâãäåéèêëíìîïóòôõöúùûüçñý013457@$',
             'aaaaaaeeeeiiiiooooouuuucnyoieastas'
           ) as t
  )
  select
    exists (
      select 1
        from unnest(regexp_split_to_array(n.t, '[^a-z]+')) as palavra
       where palavra = any (array['puta','puto','viado','vadia','cuzao','fdp','pqp','bosta','fuck','fucker','shit','bitch','cunt','dick','cock','pussy','whore','slut','nazi','rape','rapist','kkk'])
    )
    or exists (
      select 1
        from unnest(array['caralho','buceta','arrombado','filhodaputa','vagabundo','nigger','faggot','retarded','hitler','pedofilo','estuprador','punheta']) as p
       where position(p in regexp_replace(n.t, '[^a-z]', '', 'g')) > 0
    )
  from n;
$$;

-- o nome só muda por aqui: agora também barra os nomes da lista
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
    if public.nome_ofensivo(v_nome) then
      raise exception 'esse nome não é permitido: escolha outro' using errcode = '22023';
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

-- ---------- denúncias ----------

create table if not exists public.denuncias (
  id uuid primary key default gen_random_uuid(),
  denunciante uuid not null references public.perfis (id) on delete cascade,
  denunciado uuid not null references public.perfis (id) on delete cascade,
  tipo text not null,
  motivo text not null,
  estado text not null default 'aberta',
  criada_em timestamptz not null default now(),
  revisada_em timestamptz,
  revisor text,

  constraint denuncias_sem_si_mesmo check (denunciante <> denunciado),
  constraint denuncias_tipo check (tipo in ('nome', 'foto')),
  constraint denuncias_estado check (estado in ('aberta', 'aceita', 'rejeitada')),
  constraint denuncias_motivo_tamanho check (char_length(motivo) between 3 and 200),
  constraint denuncias_revisor_tamanho check (revisor is null or char_length(revisor) <= 64),
  constraint denuncias_revisao_coerente check ((estado = 'aberta') = (revisada_em is null))
);

-- uma denúncia aberta por par (quem denuncia, quem é denunciado) e tipo
create unique index if not exists denuncias_uma_aberta_idx
  on public.denuncias (denunciante, denunciado, tipo) where estado = 'aberta';
-- a fila de revisão e o limite por dia
create index if not exists denuncias_estado_idx on public.denuncias (estado, criada_em);
create index if not exists denuncias_denunciante_idx on public.denuncias (denunciante, criada_em);

alter table public.denuncias enable row level security;
revoke all on table public.denuncias from anon, authenticated;
-- sem nenhuma política: só o service_role (CLI de moderação) lê e revisa

-- Denuncia o nome ou a foto de outro jogador, achado pela tag (ex.: joao#4821:
-- é o que o navegador conhece de quem está na sala). Devolve o id da denúncia.
create or replace function public.denunciar(
  p_tag text,
  p_tipo text,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_motivo text := regexp_replace(btrim(coalesce(p_motivo, '')), '\s+', ' ', 'g');
  v_tag text := lower(btrim(coalesce(p_tag, '')));
  v_alvo public.perfis;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'precisa estar logado' using errcode = '28000';
  end if;
  if v_tag !~ '^[a-z0-9]{3,12}#[0-9]{4,6}$' then
    raise exception 'tag inválida: use o formato nome#1234' using errcode = '22023';
  end if;
  if p_tipo is null or p_tipo not in ('nome', 'foto') then
    raise exception 'tipo de denúncia inválido' using errcode = '22023';
  end if;
  if char_length(v_motivo) < 3 or char_length(v_motivo) > public.motivo_denuncia_max() then
    raise exception 'diga o motivo (de 3 a % letras)', public.motivo_denuncia_max() using errcode = '22023';
  end if;
  if v_motivo ~ '[[:cntrl:]]' then
    raise exception 'o motivo tem caracteres inválidos' using errcode = '22023';
  end if;

  select * into v_alvo from public.perfis where tag = v_tag;
  if not found then
    raise exception 'jogador não encontrado' using errcode = 'P0002';
  end if;
  if v_alvo.id = v_uid then
    raise exception 'não dá para denunciar a si mesmo' using errcode = '22023';
  end if;
  if p_tipo = 'foto' and v_alvo.avatar_url is null then
    raise exception 'essa pessoa não tem foto enviada' using errcode = '22023';
  end if;

  -- duas denúncias da mesma pessoa ao mesmo tempo não furam o limite do dia
  perform pg_advisory_xact_lock(hashtextextended('denuncias:' || v_uid::text, 0));

  if (select count(*) from public.denuncias
       where denunciante = v_uid and criada_em > now() - interval '1 day') >= public.limite_denuncias_dia() then
    raise exception 'você já fez denúncias demais hoje (máximo %): tente amanhã', public.limite_denuncias_dia() using errcode = '54000';
  end if;

  begin
    insert into public.denuncias (denunciante, denunciado, tipo, motivo)
    values (v_uid, v_alvo.id, p_tipo, v_motivo)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'você já denunciou isso: a equipe vai analisar' using errcode = '23505';
  end;
  return v_id;
end;
$$;

-- ---------- permissões ----------

revoke all on function public.denunciar(text, text, text) from public, anon;
grant execute on function public.denunciar(text, text, text) to authenticated;
revoke all on function public.limite_denuncias_dia() from public, anon, authenticated;
revoke all on function public.motivo_denuncia_max() from public, anon, authenticated;
revoke all on function public.atualizar_perfil(text, text, text) from public, anon;
grant execute on function public.atualizar_perfil(text, text, text) to authenticated;
