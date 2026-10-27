# Plano de execução do roadmap por agentes

Atualizado em **25/10/2026**. Complementa o roadmap (fases 1–6). Aqui fica **como** o
trabalho é dividido entre agentes, em que ordem e com que custo aproximado.

## Decisões tomadas

| Tema | Decisão |
| --- | --- |
| Backend | **Supabase**: Auth, Postgres e Storage. O servidor Node atual (`server/`) continua cuidando de salas, fila e relé, e valida o JWT do Supabase. |
| Login | **Somente Google** (OAuth via Supabase). A recuperação de acesso fica com o Google. |
| Convidado | Pode jogar o **casual sem XP**, com aviso "crie conta para salvar progresso". |
| Ambiente | Ainda **não existe** projeto Supabase: código + migrations SQL + testes com **Supabase simulado**. Guia de configuração em `docs/supabase.md` (entregue em 1A). |
| Escopo desta rodada | **Executar a Fase 1**; fases 2–6 recebem só plano detalhado (agente P2). |
| Entrega | **Um PR por subfase**, empilhados (cada PR tem como base o anterior até o merge). |
| Paralelismo | **Moderado**: 1A sozinho → 1B ‖ 1C → 1D → 1E, com revisão ao fim de cada etapa. |

### Regras técnicas fixas para todos os agentes

- A chave `service_role` do Supabase **só existe no servidor Node**; o navegador usa apenas a `anon key` + RLS.
- O XP, os níveis e os itens são concedidos **só pelo servidor** (função SQL `conceder_recompensa(partida_id)` chamada pelo Node, idempotente por `partida_id`).
- Foto enviada: passa pelo Node → `sharp` recodifica para WebP 256×256, remove metadados, limita a 2 MB de entrada e só aceita PNG/JPEG/WebP → grava no Storage. O cliente nunca escreve direto no bucket.
- Os testes rodam com `npm test` (node:test), **sem rede**: o cliente Supabase é injetado e simulado (`server/supabase/fake.js`).
- As novas telas seguem o widescreen 854×480 e a identidade "Mesa de Cartas"; nada de reformular o visual.
- Nada de identificador de modelo em commits, PRs ou código.

## Fluxo de agentes da Fase 1

```
[A0 Reconhecimento] ──► [1A Contas/Perfil/Foto] ──► [R1 Revisão]
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
          [1B Amigos/Convites]              [1C Jogar Rápido]
                     └───────────────┬───────────────┘
                                     ▼
                              [R2 Revisão + merge]
                                     ▼
                  [1D Registro de partidas, XP, níveis, inventário]
                                     ▼
                   [1E Hub, moderação, métricas, integração] ──► [R3 Revisão final]

[P2 Planejamento Fases 2–6] roda em paralelo, em segundo plano, a qualquer momento (só documento).
```

| Agente | Tipo | Branch / PR | Entrega | Tokens (estimativa) |
| --- | --- | --- | --- | --- |
| **A0** Reconhecimento | Explore | — (relatório) | Mapa de `server/lan.js`, `src/game/online.js`, `rede.js`, `src/ui/*`, `menu/`, fluxo de sala/código, cenas de resultado e pontos de integração. Alimenta todos os outros. | ~150k |
| **1A** Contas e perfil | general-purpose | `claude/practical-darwin-nc9pwz` → PR | Migrations (`profiles`, `avatar`, RLS), cliente Supabase no front, login Google, sessão persistente, edição de nome com identificador único (`#tag`), avatares do jogo, upload com recorte/prévia e pipeline `sharp`, perfil com estatísticas básicas, `docs/supabase.md`, testes. | ~600k–900k |
| **R1** Revisão 1A | general-purpose | comentários no PR | Segurança (RLS, upload, JWT), testes, aderência ao layout. Corrige o que achar. | ~200k |
| **1B** Amigos e convites | general-purpose, worktree | `claude/fase1b-amigos` (base 1A) → PR | Tabelas `amizades`/`bloqueios`/`convites`, pedidos, lista com presença (via servidor de salas), convite com expiração, entrar na sala do amigo (PVP/CO-OP 2), link/código, limites de envio. | ~500k–700k |
| **1C** Jogar Rápido | general-purpose, worktree | `claude/fase1c-fila` (base 1A) → PR | Fila casual PVP 1x1 no servidor Node, cancelar, espera visível, confirmação dupla, sala automática, oferta explícita de CPU, revanche com aceite duplo, convidado sem XP, todos os casos de queda/cancelamento com testes. | ~600k–800k |
| **R2** Revisão 1B+1C | general-purpose | merge 1B/1C + comentários | Resolve conflitos entre 1B e 1C (os dois mexem no servidor de salas e no hub), roda tudo e revisa. | ~250k |
| **1D** XP e recompensas | general-purpose, worktree | `claude/fase1d-progresso` → PR | Tabela `partidas` com ciclo de vida (criada→iniciada→encerrada→validada/contestada→recompensada), relato do resultado pelos dois lados, regras de elegibilidade (CPU, sala privada, duração mínima, repetição), `conceder_recompensa` idempotente, curva de níveis, trilha fixa de cosméticos, inventário/equipar, tela de resultado com animação pulável. | ~600k–800k |
| **1E** Integração e lançamento | general-purpose, worktree | `claude/fase1e-hub` → PR | Hub (Jogar Rápido, Jogar com Amigos, Perfil, Coleção), denúncia de nome/foto + fila de revisão, limites de taxa, mensagens de erro/conexão, métricas mínimas, checklist dos critérios de conclusão da Fase 1, roteiro de teste restrito. | ~500k–700k |
| **R3** Revisão final | general-purpose | comentários | Percorre os 8 critérios de conclusão da Fase 1, com testes automatizados e Playwright onde der. | ~250k |
| **P2** Plano fases 2–6 | Plan | `docs/plano-fases-2-6.md` (entra no PR de 1E ou próprio) | Quebra cada fase em tarefas, dependências, riscos e decisões pendentes (seção 11 do roadmap), já considerando o código da Fase 1. | ~150k–250k |

**Total estimado da rodada:** ~4M–5,5M tokens. Cabe no orçamento atual com folga para
retrabalho. As estimativas valem como ordem de grandeza, não como promessa.

### Modelo por agente e ritmo (plano Pro)

| Modelo | Usado em |
| --- | --- |
| **Haiku** | Tarefas mecânicas: guias (`docs/supabase.md`), checklists, textos de UI, rebase de PR empilhado sem conflito. |
| **Sonnet** | Padrão: A0, 1B, 1D (telas/inventário), 1E, P2 e implementação em geral. |
| **Opus** | Só o que é sensível: RLS/JWT/upload da 1A, máquina de estados da fila (1C), `conceder_recompensa` (1D) e a revisão final R3. |

- **Um agente por janela de 5 horas**, sem paralelo; a ordem segue o fluxo acima (1B e 1C viram sequenciais).
- As revisões R1/R2 são absorvidas: cada agente se revisa e roda `npm test` antes do PR; a sessão principal faz a conferência rápida do diff. O R3 continua.
- A sessão principal agenda o retorno a cada 5 horas, retoma do ponto anotado na seção "Progresso" e dispara o próximo agente.

## Progresso

| Etapa | Estado |
| --- | --- |
| A0 Reconhecimento | concluído (`docs/mapa-integracao.md`) |
| 1A Contas e perfil | concluído e validado em produção (NewKaizen/dodge-game#37, #38: chaves novas do Supabase) |
| 1B Amigos e convites | concluído (NewKaizen/dodge-game#39); falta validar com duas contas em produção |
| 1C Jogar Rápido | concluído (NewKaizen/dodge-game#40); falta testar no navegador |
| 1D XP e recompensas | concluído (NewKaizen/dodge-game#41); falta rodar a 0003 e testar com duas contas |
| 1E Integração e lançamento | concluído (NewKaizen/dodge-game#42); falta rodar 0003 e 0004 |
| R3 Revisão final + P2 plano 2–6 | concluído: 5 defeitos corrigidos, plano em `docs/plano-fases-2-6.md` |
| Correções pós-Fase 1 | concluído (NewKaizen/dodge-game#44: tela preta do convidado, CARREGANDO…, nome da conta) |
| 2A Consolidação das telas | concluído (Perfil, Amigos e Coleção como cenas; avisos no jogo; JOGAR RÁPIDO e PERFIL no menu); falta o teste restrito (`docs/teste-fase1.md`) e ver no navegador com contas reais |
| Fase 2 | 2A–2D concluídas (NewKaizen/dodge-game#45, #46, com dois jogadores locais automáticos); concluídas também: 2E (revanche, ajustes do teste com a turma, auditoria de cenas reaproveitadas, cor do P1 x bloqueio) e 2F (pendências do servidor). Decisões: consolidação = 2A; controle padrão Xbox/PS remapeável; religação 20 s; host cai = sem XP e sem derrota; retomada no começo da rodada (recomendadas; podem mudar antes da 2B/2D) **Fase 2 concluída** (NewKaizen/dodge-game#47). |
| Fase 5 (adiantada) | em andamento: 5A base N jogadores (Opus). Decisões do usuário (27/10): ordem 5A → CO-OP 3–4 (5B/5C) → 1x1x1x1 (5D) → 2x2 (5E); **só online** (salas de amigos); topologia **estrela pelo host** (WebRTC ou relé do servidor; TURN opcional). 2E e 2F vêm antes |

### Consolidação (depois das features da Fase 1)

Decisão do usuário: primeiro as features, depois organizar tudo. Itens anotados:

- ~~Trazer perfil, amigos e conta **para dentro do jogo** (cenas/visual da Mesa de Cartas), em vez das barras/overlays Svelte "fora do jogo".~~ Feito na 2A (a foto continua em Svelte: seletor de arquivo e recorte).
- ~~Toast de aviso quando chega pedido de amizade (hoje só selo no botão).~~ Feito na 2A (`src/game/conta/avisos.js`).
- ~~Decidir se bloquear tira o bloqueado da sala atual (hoje não tira).~~ Feito na 2F (fora de partida, quem não é o host sai; no meio da partida vale depois).
- ~~JOGAR RÁPIDO no menu principal (hoje só na tela ONLINE; a arte da Mesa tem 5 vagas).~~ Feito na 2A (7 linhas no espaço escuro da Mesa, sem mexer na arte).
- ~~Avisar quando convidar um amigo tira você da fila (hoje é silencioso).~~ Feito na 2A (aviso ao aceitar um convite estando na fila).
- ~~Partida casual não começa se a aba do host estiver em segundo plano.~~ Casual já desiste em 15 s; salas de amigos: feito na 2F (aviso ao convidado e ao host).
- ~~Aviso de XP para quem fica quando o oponente abandona (hoje só aparece no perfil).~~ Feito na 2A (toast "+XP").
- ~~Aplicar o verso de carta equipado nas partidas (hoje só na Coleção; precisa ir pela rede).~~ Feito na 2F.
- ~~Rever o limite que conta todos os convidados como um único oponente.~~ Feito na 2F (por conexão; mesmo IP da conta = um só).
- ~~XP no CO-OP.~~ Feito na 2F (migration 0005).
- ~~Filtro de nomes também no nome inicial vindo do Google (hoje só ao trocar o nome).~~ Feito na 2F (migration 0005).
- ~~(2E) Auditar cenas reaproveitadas pelo Phaser que guardam estado da partida anterior (o mesmo vício que travava o PvpResultado).~~ Feito na 2E: 13 cenas ganharam `estadoInicial()` + `Object.assign` no começo do `init`/`create`, a Pausa remove o ouvinte de `resume`, e `src/game/__tests__/cenasReaproveitadas.test.js` varre todas as cenas de `config.js` (campos e ouvintes). Pendente da 2F: `Vitoria` e `GameOver` (o teste só avisa).

### Controle de custo

- Cada agente recebe o relatório do A0 e só as seções do roadmap que lhe dizem respeito, sem o documento inteiro.
- Agentes de implementação devolvem um resumo curto (arquivos, decisões, pendências), não o diff.
- Se um agente passar de ~1,2× a estimativa, ele para, relata o motivo e o escopo é revisto antes de continuar.
- As revisões só olham o diff do PR e os testes, sem reler o repositório inteiro.

## O que depende de você (fora do alcance dos agentes)

1. **Criar o projeto Supabase** e seguir o `docs/supabase.md`: rodar as migrations, criar o bucket, ativar o Google.
2. **Credenciais OAuth do Google** no Google Cloud Console, coladas no painel do Supabase.
3. **Variáveis no Render**: `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` (esta última nunca no front).
4. **Revisar e fazer merge** dos PRs na ordem. Os PRs empilhados são rebaseados para a `main` após cada merge.
5. **Teste restrito** com amigos ao fim da 1E (ritual semanal do roadmap, seção 10).

## Critérios de conclusão (Fase 1)

Os 8 itens do roadmap continuam valendo. O R3 marca cada um com a evidência
(teste automatizado, roteiro manual ou "depende do Supabase real").
