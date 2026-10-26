# Fase 1: checklist de lançamento e roteiro do teste restrito

> Os 8 critérios abaixo estão **reconstruídos a partir dos entregáveis 1A–1E**
> (`docs/plano-agentes.md`): o texto original do roadmap não está no
> repositório. Se o roadmap tiver redação diferente, ajuste esta lista e mantenha
> a coluna "como verificar".

Legenda: **auto** = coberto por `npm test` (nome do teste entre aspas);
**pg** = precisa de Postgres local (`DODGE_PG`, veja `docs/supabase.md`);
**manual** = passo a passo com duas contas Google; **real** = só dá para
confirmar com o Supabase e o Render de verdade.

## Antes de tudo: ordem das migrations

No SQL Editor do Supabase (projeto de **teste** primeiro, depois produção com
backup: `docs/operacao.md`), nesta ordem. Todas rodam de novo sem estragar:

1. `0001_contas.sql`: perfis, tag, avatar, bucket `avatares`
2. `0002_amigos.sql`: pedidos, amizades, bloqueios
3. `0003_progresso.sql`: partidas, XP, níveis, inventário
4. `0004_moderacao.sql`: denúncias e filtro de nomes (**nova na 1E**)

Variáveis no Render: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY` (e, se quiser, `METRICAS_MIN`, padrão 15).

## Os 8 critérios

| # | Critério | Como verificar |
| --- | --- | --- |
| 1 | **Login com Google e perfil persistente**: entrar, nome com `#tag`, avatar do jogo ou foto, a sessão volta ao recarregar | auto: "token válido: valida antes das boas-vindas e usa o nome do perfil"; "nome: aceita letras com acento…" · pg: `progressoSql` (0001 duas vezes) · **real**: entrar com a conta, mudar nome e avatar, recarregar a página (continua logado) |
| 2 | **Foto segura**: só PNG/JPEG/WebP, recodificada em WebP 256×256 sem metadados; o navegador nunca escreve no bucket | auto: "sucesso: WebP 256x256 sem metadados em avatares/<id>.webp e perfil atualizado"; "bytes mágicos que não batem com o Content-Type: 415"; "grande demais: 413"; "limite: 5 envios por minuto por usuário" · **manual**: subir uma foto com GPS e conferir no bucket que o arquivo tem 256×256 |
| 3 | **Amigos**: pedido pela tag, aceitar/recusar, remover, bloquear, presença só para amigos | auto: `amigos.test.js` ("presença: só os amigos veem…", "bloqueio: some a presença nos dois sentidos…", "relações: lê amizades…") · pg: 0002 duas vezes · **manual**: duas contas se adicionam e uma bloqueia a outra |
| 4 | **Jogar com amigos**: convite com expiração (60 s), entrar na sala do amigo, link/código | auto: "convidar: cria a sala, manda o convite e aceitar põe o amigo na sala"; "convite expira em 60 s…"; "limite de convites: 5 por minuto…"; `salaLink.test.js` · **manual**: convidar pela lista AMIGOS, aceitar, jogar uma partida; repetir pelo código na tela ONLINE → JOGAR COM AMIGOS |
| 5 | **Jogar Rápido**: fila 1x1, cancelar, confirmação dupla, sala automática, oferta de CPU, revanche, convidado sem XP | auto: `fila.test.js` ("pareia, os dois confirmam…", "um recusa…", "tempo esgotado…", "revanche: os dois aceitam"), `filaCliente.test.js` · **manual**: duas janelas (uma convidada) em JOGAR RÁPIDO; esperar 30 s sozinho e ver "JOGAR CONTRA A CPU" |
| 6 | **XP, níveis e Coleção só do servidor**: idempotente, regras de elegibilidade, itens por nível, equipar | auto: `partidas.test.js` ("os dois concordam: validada…", "farm com o mesmo amigo…", "relatos simultâneos não concedem duas vezes…", "convidado nunca ganha XP…"), `progresso.test.js` · pg: "migrations 0001–0003 … conceder_recompensa" · **manual**: uma partida de 60 s+ entre duas contas (+60 / +40 XP) e equipar um item na Coleção |
| 7 | **Moderação e abuso**: denunciar nome/foto, revisão pelo CLI, limites de taxa, chave secreta só no servidor | auto: `moderar.test.js` (aceitar foto/nome, rejeitar, erros), `moderacao.test.js`, "limite por endereço: token falso…", "config: … a pública nunca tem a service_role", "nome ofensivo…" · pg: `moderacaoSql.test.js` (limite diário, duplicata aberta, RLS fechada) · **manual**: denunciar um amigo de teste, rodar `npm run moderar -- listar` e `aceitar` (`docs/moderacao.md`) |
| 8 | **Conexão e mensagens**: queda nunca deixa ninguém preso na fila ou na sala; todo erro diz o que fazer; métricas mínimas | auto: "desconectar procurando ou pareado não deixa ninguém preso", "sala casual: quem sai fecha a sala para o outro", "host saindo fecha a sala…", `mensagensRede.test.js` (servidor ligando, lotado, conta não confirmada, queda na fila e na sala), `metricas.test.js` · **manual**: matar o servidor no meio de uma partida e ver a mensagem + reconexão; **real**: achar a linha `[metricas]` no log do Render |

Itens que **só** a conta e o servidor reais confirmam: login Google de ponta a
ponta, as migrations no projeto de produção, a foto na CDN, o `[metricas]` no
Render, o X-Forwarded-For atrás do proxy e o cold start do plano grátis.

## Roteiro do teste restrito (6 a 10 pessoas conhecidas)

Duração: uma sessão de ~1 hora marcada, mais três dias de uso solto. Antes:
projeto de produção com as 4 migrations, backup feito, site aberto 2 minutos
antes (o Render grátis dorme).

### O que pedir a cada pessoa (nesta ordem)

1. Abrir o link, **entrar com o Google**, escolher um nome e um avatar (ou foto).
2. Adicionar **uma pessoa do grupo** pela tag e aceitar os pedidos que chegarem.
3. **Convidar um amigo** pela lista AMIGOS e jogar uma partida PVP.
4. Entrar em **JOGAR RÁPIDO** com o grupo todo ao mesmo tempo (a fila só mostra
   valor com mais de 2 pessoas) e ver se acham par.
5. Jogar até **ganhar XP**, abrir a **COLEÇÃO** e equipar algo.
6. Pedir **revanche** uma vez, e **sair no meio** de uma partida de propósito.
7. Fechar a aba no meio da fila ou da sala e voltar (reconexão).
8. Denunciar um perfil combinado de teste ("Teste Ofensivo", foto de teste).

### O que observar (anote, não corrija na hora)

- **Onde travou ou ficou em dúvida** (quem perguntou "e agora?"): tela e momento.
- **Tempo de espera na fila** de cada um (compare com o p50/p90 da linha `[metricas]`).
- **Mensagens**: alguma que não deu para entender ou que não disse o que fazer.
- **Lag** na partida (o ping aparece na barra: direto ou pelo servidor?).
- **XP**: veio o valor certo? Veio nas duas contas? Abandono avisou?
- **Convites e presença**: chegou rápido? Algum amigo aparece offline estando online?
- **Foto**: tempo para subir, falhas, aparece para os outros?
- **Denúncia**: chegou no `listar`? A revisão levou quanto tempo?
- Erros no log do Render (`docs/operacao.md`) durante a sessão.

### Perguntas de 2 minutos no fim

1. Em que momento você quase desistiu?
2. Achou fácil chegar em "jogar com um amigo" e em "jogar rápido"?
3. Entendeu o que aconteceu quando algo deu errado (queda, fila, abandono)?
4. Faltou algo que você esperava (aviso de pedido, JOGAR RÁPIDO no menu inicial…)?
5. Você jogaria de novo amanhã? Chamaria alguém?

### Depois

Junte as anotações num único documento, separe **bug**, **confusão** e
**pedido**, e traga os 3 maiores para a consolidação (lista em
`docs/plano-agentes.md`). Repita o ritual semanal do roadmap (seção 10) com o
mesmo grupo.
