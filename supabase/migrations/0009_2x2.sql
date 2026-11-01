-- Fase 5E: XP do 2x2 (duas equipes de 2; docs/online.md "2x2")
--
-- O que muda (o PVP 1x1, o CO-OP de 2, o CO-OP de 3–4 e o todos contra todos continuam exatamente iguais):
--   1. conceder_recompensa, só no '2x2': o limite diário "por par" conta contra CADA ADVERSÁRIO com conta
--      (o parceiro não conta). A repetição de uma partida é a do par mais repetido hoje: quantas partidas
--      de 2x2 com XP eu já joguei hoje com aquele adversário no time oposto. O "oponente" gravado na
--      concessão é o 1º adversário com conta (senão o 1º adversário convidado).
--   2. O XP é o de sempre: participação (+40) para todos que jogaram até o fim e a vitória (+20) para os
--      DOIS do time vencedor (o resultado de cada lado vem do time, server/partidas.js); empate = só a
--      participação.
--
-- Depende de 0003, 0005, 0006 e 0007. Pode rodar de novo: "or replace".
-- NUNCA edite as migrations antigas: elas já rodaram em produção.

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
  v_rep2 integer;
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
      -- uma linha por conta (com 3 ou 4 lados o join dá várias): o "oponente" do limite
      -- diário é o primeiro outro lado com conta (senão o primeiro convidado). Com 2 lados
      -- só existe um outro lado: igual à 0005
      select distinct on (pp.user_id) pp.user_id, pp.resultado, pp.colocacao, op.user_id as oponente, op.ref as oponente_ref
        from public.partida_participantes pp
        left join public.partida_participantes op on op.partida_id = pp.partida_id and op.lado <> pp.lado
               -- 2x2: só os do outro time são "oponentes"
               and (v_p.modo <> '2x2' or op.time is distinct from pp.time)
       where pp.partida_id = p_partida and pp.user_id is not null
       order by pp.user_id, (op.user_id is null), op.lado
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
        -- 2x2: contra CADA adversário com conta (vale o par mais repetido hoje)
        if v_p.modo = '2x2' then
          select max(x.cnt) into v_rep2
            from (
              select (select count(*)
                        from public.concessoes c
                        join public.partidas pc on pc.id = c.partida_id
                        join public.partida_participantes eu on eu.partida_id = c.partida_id and eu.user_id = v_r.user_id
                        join public.partida_participantes ele on ele.partida_id = c.partida_id and ele.user_id = adv.user_id
                       where c.user_id = v_r.user_id
                         and c.xp > 0
                         and c.criada_em >= v_dia
                         and pc.modo = '2x2'
                         and ele.time is distinct from eu.time) as cnt
                from public.partida_participantes adv
                join public.partida_participantes me on me.partida_id = adv.partida_id and me.user_id = v_r.user_id
               where adv.partida_id = p_partida
                 and adv.user_id is not null
                 and adv.time is distinct from me.time
            ) x;
          if v_rep2 is not null then
            v_rep := v_rep2;
          end if;
        end if;
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
          v_xp := public.xp_participacao() + case when v_r.resultado = 'vitoria' then public.xp_vitoria() else 0 end
                 -- todos contra todos: o 2º lugar também ganha um bônus (o 1º é a vitória)
                 + case when v_p.modo = 'ffa' and v_r.resultado = 'derrota' and v_r.colocacao = 2 then public.xp_ffa_segundo() else 0 end;
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

-- ---------- permissões ----------

revoke all on function public.conceder_recompensa(uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.conceder_recompensa(uuid) to service_role;
  end if;
end;
$$;
