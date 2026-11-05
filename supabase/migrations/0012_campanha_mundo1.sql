-- CAMPANHA, Mundo 1: "A Floresta de Papel" virou "A Casa Silenciosa" (docs/campanha.md). Só os
-- NOMES dos três cosméticos do mundo mudam; os ids continuam os da 0011 (o inventário de quem já
-- ganhou guarda o id, e a concessão em conceder_campanha procura por `campanha = 'mundo1'`).
-- O catálogo não tem coluna de descrição: o texto de cada item fica no navegador
-- (src/game/campanha/mundos/mundo1.js, `descricao`). A cor também (só desenho).
--
--   titulo.andarilho_papel   "Andarilho de Papel"  -> "Quem Deixou a Luz Acesa"   (vencer o chefe)
--   moldura.floresta_papel   "Floresta de Papel"   -> "Vitral Silencioso"         (vencer o chefe)
--   verso.folha_dobrada      "Folha Dobrada"       -> "Porta Entreaberta"         (3 estrelas em tudo)
--
-- Idempotente: rodar de novo não muda nada; se a 0011 ainda não semeou algum item, ele nasce aqui
-- com os mesmos campos da 0011 (o mesmo "quando").

insert into public.catalogo_itens (id, tipo, nome, nivel_requerido, padrao, exclusivo, campanha, campanha_quando) values
  ('titulo.andarilho_papel', 'titulo', 'Quem Deixou a Luz Acesa', public.nivel_exclusivo(), false, false, 'mundo1', 'mundo'),
  ('moldura.floresta_papel', 'moldura', 'Vitral Silencioso', public.nivel_exclusivo(), false, false, 'mundo1', 'mundo'),
  ('verso.folha_dobrada', 'verso', 'Porta Entreaberta', public.nivel_exclusivo(), false, false, 'mundo1', 'estrelas')
on conflict (id) do update
  set nome = excluded.nome,
      tipo = excluded.tipo,
      nivel_requerido = excluded.nivel_requerido,
      padrao = excluded.padrao,
      exclusivo = excluded.exclusivo,
      campanha = excluded.campanha,
      campanha_quando = excluded.campanha_quando;
