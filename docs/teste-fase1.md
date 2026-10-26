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

## Os 8 critérios (do roadmap)

| # | Critério | Como verificar |
| --- | --- | --- |
| 1 | Criar conta, entrar novamente e acessar de outro navegador preserva perfil e progresso. | auto: "token válido: valida antes das boas-vindas e usa o nome do perfil" · pg: 0001–0003 duas vezes · **real**: entrar com o Google, mudar nome/avatar, jogar uma partida, sair, entrar de novo **e** entrar em outro navegador: mesmo perfil, nível e XP |
| 2 | Foto pode ser enviada, recortada, trocada e removida; arquivos inválidos são rejeitados. | auto: "sucesso: WebP 256x256 sem metadados…", "bytes mágicos que não batem com o Content-Type: 415", "grande demais: 413", "limite: 5 envios por minuto…" · **manual**: enviar, recortar, trocar e remover a foto (volta ao avatar padrão); tentar um `.gif` e um arquivo renomeado |
| 3 | Uma conta não edita dados ou equipamentos de outra. | pg: `progressoSql`/`moderacaoSql` (update/insert direto negado, `equipar` só itens próprios, `conceder_recompensa` negada ao navegador) · auto: `/api/avatar` sempre grava em `<uuid do token>.webp` · **manual**: no console do navegador, chamar `atualizar_perfil`/`equipar` — só muda a própria conta |
| 4 | Dois amigos se adicionam, entram na mesma sala e completam PVP e CO-OP para dois. | auto: `amigos.test.js` (convite, presença, bloqueio), `salaLink.test.js` · **manual**: duas contas se adicionam pela tag, um convida pela lista AMIGOS, jogam **uma partida PVP e uma CO-OP** na mesma sala; repetir pelo código/link |
| 5 | Jogar Rápido encontra um par ou oferece uma alternativa clara; cancelamento e falha liberam os dois jogadores. | auto: `fila.test.js` (pareia, um recusa, tempo esgotado, desconectar procurando ou pareado, revanche), `filaCliente.test.js` · **manual**: duas janelas (uma convidada) em JOGAR RÁPIDO; cancelar; fechar uma aba durante a confirmação; esperar 30 s sozinho e ver "JOGAR CONTRA A CPU" |
| 6 | Concluir uma partida entrega XP, nível e recompensa corretos; reenvio e reconexão não duplicam nada. | auto: `partidas.test.js` (validada, contestada, abandono, relatos simultâneos, convidado, farm) · pg: `conceder_recompensa` duas vezes/em paralelo = uma concessão · **manual**: partida de 60 s+ (+60 / +40), recarregar a tela de resultado e reconectar — `concessoes` continua com uma linha por conta |
| 7 | Foto, equipamento, amizades e progresso permanecem na próxima sessão. | **real**: equipar título/moldura, ter um amigo e XP; fechar o navegador e voltar no dia seguinte — tudo igual |
| 8 | Um grupo restrito consegue jogar várias partidas e voltar em outro dia sem intervenção do desenvolvedor. | **real**: o roteiro abaixo, em dois dias diferentes, sem você mexer no banco nem no servidor |

### Além dos critérios (base para lançar, 1E)

- **Moderação**: denunciar nome/foto e revisar pelo CLI — auto: `moderar.test.js`, `moderacao.test.js`; pg: `moderacaoSql.test.js`; manual: `docs/moderacao.md`.
- **Conexão e mensagens**: `mensagensRede.test.js` e os testes de queda da fila/sala; manual: derrubar o servidor no meio de uma partida.
- **Métricas**: `metricas.test.js`; real: a linha `[metricas]` no log do Render.

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
