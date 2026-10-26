# Plano das fases 2 a 6 (agente P2)

Atualizado em 26/10/2026. Complementa `docs/plano-agentes.md`. A Fase 1 (contas, amigos, Jogar Rápido, XP/Coleção, moderação, métricas) está entregue; falta só o teste restrito (`docs/teste-fase1.md`). Cada subentrega abaixo cabe em **um agente por janela de 5 h** (~200–400k tokens), com PR próprio empilhado.

Camadas: **Haiku** = mecânico (textos, checklists, docs); **Sonnet** = padrão; **Opus** = só segurança, netcode/máquinas de estado, economia ou confiança.

## Fatos do código que moldam o plano

- Não existe suporte a gamepad do navegador: a entrada chega pela `bridge` (joystick serial e simulador de teclado) e `controles.js` só entende `A`/`B`/`C` + joystick com limiar 50; `teclas.js` guarda o mapa de teclas.
- Sala online: `MAX_MEMBROS = 2` em `server/lan.js` (l.63; usado em ~6 pontos: criar, entrar, convite, revanche). Host saindo fecha a sala; queda de conexão hoje só avisa e devolve ao menu/lobby (`rede.js` l.200–214), **sem retomada**.
- PVP e CO-OP são P2P (WebRTC com fallback pelo servidor, `transmissao.js`); o host decide o resultado; o servidor só compara relatos (`server/partidas.js`).
- Acessibilidade: `acessibilidade.js` (fatores), `daltonismo.js`, `preferencias.js` (`reduzirMovimento` etc.). Já existem Grimório (`Grimorio.js`, 795 linhas), Guia (`GuiaBonus.js`, com prévias jogáveis) e `Config.js` (1047 linhas).
- Contas/amigos/perfil ainda são Svelte fora do Phaser (ver Consolidação).

## Consolidação x Fase 2

**Recomendação: fundir a Consolidação na Fase 2 como subentrega 2A.** Os dois mexem na mesma camada (cenas Phaser, `menu/layout.js`, foco e navegação por A/B), e a Fase 2 exige "checar legibilidade das telas de conta/perfil/amigos/fila", o que só faz sentido depois de elas estarem dentro do jogo. Fazer a legibilidade antes da Consolidação seria retrabalho; fazer a Consolidação sem o gamepad deixaria o foco/navegação pela metade. A parte de **servidor** da lista (verso equipado pela rede, limite de convidados, XP no CO-OP, bloqueio na sala, filtro do nome do Google) sai da 2A e vai para a **2F** (pacote "pendências de Fase 1"), para não inflar a 2A. Pré-requisito: ler as anotações do teste restrito.

---

## Fase 2: Conforto e apresentação

**Objetivo:** o jogo inteiro (incluindo conta e social) legível em 854×480, jogável com teclado, joystick serial e controle USB, e que se recupera de queda de conexão.
**Pré-requisitos:** Fase 1 entregue; anotações do teste restrito.

| Sub | Escopo | Arquivos prováveis | Modelo | Tokens |
| --- | --- | --- | --- | --- |
| **2A** Consolidação das telas | Perfil, Amigos, Coleção, conta e login como cenas Phaser (Mesa de Cartas); toast de pedido de amizade; JOGAR RÁPIDO no menu inicial; abas FILA/AMIGOS/PERFIL na `Lan`; aviso "convite tirou você da fila"; aviso de XP ao ficar após abandono; checar recorte/fonte em 854×480 | `scenes/Menu.js`, `menu/layout.js`, `scenes/Lan.js`, novas cenas, `src/ui/Conta.svelte`, `src/lib/conta.js` | Sonnet | 350–400k |
| **2B** Controle físico | Gamepad API (`navigator.getGamepads`) entrando na mesma `bridge`/`aoBotao`; vínculo jogador→controle, zona morta, remapeamento de botões em `Config`, pausa do jogo ao perder foco, reconexão do controle; teclado e joystick serial intactos | `controles.js`, `teclas.js`, `bridge.js`, `scenes/Config.js`, `preferencias.js` | Sonnet | 250–350k |
| **2C** Cartas e acessibilidade | Custo e "por que está bloqueada" visíveis nas cartas; revisão de volume, daltonismo e reduzir flashes/tremor (separar "flashes" de "movimento" se hoje forem um só); teste de contraste | `pvp/HudPvp.js`, `pvp/cartas.js`, `acessibilidade.js`, `daltonismo.js`, `Config.js` | Sonnet | 200–300k |
| **2D** Recuperação de conexão | Sessão e estado da sala guardados; janela de religação de **20 s** (proposta); ponto de retomada seguro (início da rodada); regra de queda do host | `server/lan.js`, `server/partidas.js`, `lan/rede.js`, `lan/transmissao.js`, `pvp/rede/ArenaRede.js`, `sincronia.js` | **Opus** | 350–450k |
| **2E** Revanche, troca de personagem, mensagens | Corrigir o que o teste restrito apontou; troca de personagem entre rodadas; textos `MSG_*` | `PvpResultado.js`, `PvpEscolha.js`, `rede.js` (`MSG_*`) | Sonnet (Haiku nos textos) | 200–250k |
| **2F** Pendências de servidor da Fase 1 | Verso equipado pela rede, limite de convidados, bloqueio na sala atual, XP no CO-OP (mesmas regras), filtro do nome do Google, host em aba oculta | `server/lan.js`, `server/partidas.js`, `0005_*.sql`, `progresso.js` | Sonnet (XP: Opus só na migration) | 250–350k |

**Riscos:** Gamepad API varia por navegador (botões "standard" vs. genéricos); 2D tem condição de corrida entre religação e relato de resultado (a regra "um relato por lado" precisa sobreviver); o servidor Render grátis dorme e derruba tudo.
**Decisões antes de começar:**
1. *Fundir Consolidação na 2A?* Padrão: sim.
2. *Mapeamento do controle:* padrão: D-pad/analógico esquerdo move, A/B/Start = A/B/C do teclado, remapeável. Aceita?
3. *Janela de religação:* padrão 20 s. Vale também para a fila? (padrão: não, fila reentra).
4. *Host cai:* padrão: a sala morre, a partida é **encerrada sem XP e sem derrota** para o guest (sem migração de host).
5. *Queda do guest no meio:* padrão: retoma no início da rodada atual se voltar em 20 s; senão conta como abandono (regra atual).
**Teste de saída:** fluxos completos sem cortes de texto; teclado e um controle físico validados; acessibilidade preservada; queda dos dois lados se recupera ou termina de forma previsível (com testes automáticos de máquina de estados).

---

## Fase 3: Manual Interativo do Ralsei

**Objetivo:** tutorial como livro de giz de cera, jogável, que ensina mover, jogar carta e entender energia a quem nunca viu o jogo.
**Pré-requisitos:** 2B (botões por dispositivo), 2C (legibilidade de carta). Independe das fases 4–6 e pode rodar em paralelo à 2D/2E/2F se houver janela.

| Sub | Escopo | Arquivos prováveis | Modelo | Tokens |
| --- | --- | --- | --- | --- |
| **3A** Protótipo de UMA página | Textura de papel, coração de giz, um ataque, instrução, retry, transição; só a página 1 ("seu coração: mova até as marcas"); camada de apresentação própria sobre as regras reais; teste com 2 pessoas | nova `scenes/Manual*.js`, `src/game/manual/`, reuso de `entities/`, `attacks/` | Sonnet | 250–350k |
| **3B** Páginas essenciais 2–4 | Desviar de balas lentas; primeira carta; energia/custo/passar; demo opcional, "tentar de novo", avançar manual, dica contextual, botões por dispositivo | `manual/paginas/*`, `pvp/regras.js` (só leitura) | Sonnet | 300–400k |
| **3C** Página 5 e navegação | Partida assistida contra a CPU; índice, retomar de onde parou (`localStorage`), pular, opção de movimento reduzido; ligação com o Guia e com o Menu; progresso do manual salvo na conta (opcional) | `pvp/bot.js`, `Menu.js`, `GuiaBonus.js`, `preferencias.js` | Sonnet | 250–350k |
| **3D** Páginas extras | Quatro naipes (exemplos PVP e CO-OP), graze, jogar em dupla, ases/SUPER/perfeitos | `manual/paginas/*` | Haiku/Sonnet | 200–300k |

**Riscos:** duplicar regras (divergir do jogo real quando algo mudar) e arte demais para um agente só (usar placeholders desenhados em canvas/SVG primeiro).
**Decisões:** (1) *Arte:* padrão: traço de giz gerado por código (shaders/Graphics) em vez de ilustração externa. (2) *Extensão:* só decidir 3D depois do teste da 3C. (3) *Personagem Ralsei:* direitos/imagem: padrão: silhueta e fala originais, sem arte copiada. (4) *Obrigatório na primeira vez?* Padrão: oferecido, nunca forçado.
**Teste de saída:** 3–5 pessoas novas aprendem a mover, jogar carta e entender energia sem explicação externa (anotar onde perguntaram).

---

## Fase 4: Motivos para voltar

**Objetivo:** razões leves para voltar, sem punir quem faltou e sem dinheiro real.
**Pré-requisitos:** Fase 1D (XP/inventário, servidor concede), 2F (XP no CO-OP) e 2A (telas na Mesa).

| Sub | Escopo | Arquivos prováveis | Modelo | Tokens |
| --- | --- | --- | --- | --- |
| **4A** Desafio diário | Versão + semente + regra de virada de dia (fuso São Paulo, já usado no XP); recorde pessoal primeiro; repetição livre; **uma** recompensa principal concedida uma vez pelo servidor; sem punição por faltar | `0006_desafios.sql`, `server/desafios.js` (novo), `pvp/padroes.js`/`coop/regras.js` (semente), nova cena | **Opus** (concessão idempotente) + Sonnet na cena | 400–500k |
| **4B** Conquistas e maestria | Conquistas por conta; maestria por personagem (nível por personagem); tela na Coleção | `0006`, `server/partidas.js` (gatilhos), `progresso.js`, cena Coleção | Sonnet | 300–400k |
| **4C** Amigos e privacidade | Recordes de amigos, jogadores recentes, opções de privacidade (ocultar presença/recordes) | `server/amigos.js`, `0007_privacidade.sql`, telas de Amigos | Sonnet | 250–300k |
| **4D** Moedas e loja (depois) | Moedas ganhas só jogando; loja só de cosméticos; taxa de ganho validada em planilha antes de codar | `0008_loja.sql`, `server/loja.js` | **Opus** (economia) | 400–500k |
| **4E** Eventos semanais | Reuso de desafios com data; evento da Noelle possível (história narrativa fica fora, escopo próprio) | `server/desafios.js`, cena | Sonnet | 200–300k |

**Riscos:** farm e relógio do cliente (a data **sempre** do servidor); economia inflacionada; desafio com semente que depende de comportamento do cliente (precisa ser determinístico no `rng` do jogo).
**Decisões:** (1) *Virada do dia:* padrão: meia-noite de São Paulo. (2) *Recompensa do desafio:* padrão: XP + um cosmético raro por semana, nada de sequência obrigatória ("streak"). (3) *Maestria:* padrão: nível por personagem sobe com vitórias com ele, sem impacto em gameplay. (4) *Loja:* padrão: adiar até 4A–4C terem dados reais de uso. (5) *Cosméticos nunca afetam gameplay* (regra fixa).
**Teste de saída:** estável ao recarregar; o servidor concede uma vez; metas compreensíveis (perguntar aos testadores o que cada meta significa).

---

## Fase 5: Mais gente jogando junto

**Objetivo:** entregas **separadas**: CO-OP até 4, depois PVP todos-contra-todos 3/4, depois 2x2. Só salas de amigos no início.
**Pré-requisitos:** 2D (recuperação), 2F, métricas da Fase 1E. A 5A é obrigatória antes de qualquer modo.

| Sub | Escopo | Arquivos prováveis | Modelo | Tokens |
| --- | --- | --- | --- | --- |
| **5A** Revisão e base N jogadores | `MAX_MEMBROS` por modo, lado/índice de jogador generalizado (`meuLado()` hoje é 0/1), transporte (malha WebRTC de N, ou estrela pelo host), host saindo, orçamento de performance; **sem** modo novo ainda; relatório de medição | `server/lan.js`, `lan/rede.js`, `lan/transmissao.js`, `game/rede.js`, `pvp/rede/sincronia.js` | **Opus** | 350–450k |
| **5B** CO-OP 3–4: regras | Corações identificáveis (cor/forma/nome) na mesma caixa, sem colisão entre aliados, distribuição da mira, resgate, combos de carta | `coop/ArenaRedeCoop.js`, `coop/regras.js`, `coop/quadro.js`, `Lan.js`, `EscolhaParty.js` | Sonnet | 350–400k |
| **5C** CO-OP 3–4: balanceamento | Densidade, espaço, apoio e SUPERs por tamanho do grupo (não só vida do chefe); recompensas corretas | `coop/chefes/*`, `cartasChefe.js`, `superNoChefe.js`, `bot.js` | Sonnet | 250–350k |
| **5D** PVP todos-contra-todos | Alvo anunciado em rodízio, um ataque recebido por pessoa, ases/eliminação/número ímpar/bônus, tempo de espectador medido | `pvp/regras.js`, `HudPvp.js`, `PvpArena.js`, `fimDePartida/` | **Opus** (máquina de estados) | 400–500k |
| **5E** 2x2 | Dois duelos coordenados com apoio de equipe, condição de vitória, troca de oponente, resgate, anti-foco | `pvp/*`, `PvpArena.js`, `server/partidas.js` | Opus | 400–500k |

**Riscos:** P2P em malha de 4 com NAT pesado (TURN quase obrigatório); `partidas.js` e a tabela `partidas` assumem 2 lados; XP/validação para N relatos; desempenho em PCs fracos.
**Decisões:** (1) *Topologia:* padrão: estrela com o host (mais simples; host é ponto único de falha, já aceito na 2D). (2) *TURN pago/grátis* antes da 5A? Padrão: sim. (3) *Ordem:* padrão: CO-OP 4 → FFA → 2x2, conforme roadmap. (4) *XP em modos grandes:* padrão: participação igual, bônus só para vitória/equipe. (5) *Fila pública* só depois: padrão: não nesta fase.
**Teste de saída (por modo):** partida completa em todos os tamanhos suportados; regras de alvo/apoio explícitas na tela; queda tratada; legível; recompensas corretas.

---

## Fase 6: Competição estruturada

**Objetivo:** ranqueado 1x1 em que o resultado é confiável.
**Pré-requisitos:** 2D, 4C (privacidade), dados reais de abandono/contestadas em `[metricas]`. A confiança vem **antes** do rank público.

| Sub | Escopo | Arquivos prováveis | Modelo | Tokens |
| --- | --- | --- | --- | --- |
| **6A** Modelo de confiança | Documento + protótipo: arbitragem no servidor de carta/energia; hipótese de verificação por posição (medir antes de adotar); tratar divergência e relato ausente; falha de infraestrutura x abandono confirmado | `docs/confianca-ranqueado.md`, `server/partidas.js`, `pvp/rede/*` | **Opus** | 350–450k |
| **6B** Rating e histórico | Rating (ex.: Glicko/Elo simples), histórico, **nível de conta separado do rating**, resultado+rating processados uma vez | `0009_rating.sql`, `server/rating.js`, `fila.js` (modo ranqueado) | **Opus** | 400–500k |
| **6C** Regras publicadas e UI | Regras de início/queda/fim; abandono = derrota; telas de rank/histórico | cenas novas, `docs/regras-ranqueado.md` | Sonnet (Haiku nos textos) | 250–300k |
| **6D** Balanceamento com dados | Métricas por carta/personagem, painel para o dono | `server/metricas.js`, `pvp/habilidades/*`, `bonus/*` | Sonnet | 250–350k |
| **6E** Temporadas (depois) | Reinício parcial, recompensas de fim | `server/rating.js` | Sonnet | 200–300k |

**Riscos:** o servidor não vê o jogo (host decide); acordo entre clientes **não** prova partida legítima; arbitragem de carta/energia não impede coração invulnerável no cliente; verificação por posição é só hipótese. Ranqueado público sem 6A é inaceitável.
**Decisões:** (1) *Abrir só com amigos de teste* (padrão) antes do público. (2) *Aceitar que trapaça por cliente adulterado é risco residual?* Padrão: sim, com denúncia + revisão manual e rank "beta". (3) *Rating:* padrão: Elo simples com K alto nas 10 primeiras. (4) *Abandono = derrota, sem exceção de queda do host?* Padrão: queda confirmada por ambos os lados reverte; infra comprovada anula.
**Teste de saída:** resultado+rating uma vez; divergência/relato ausente tratados; infra distinguida de abandono; modelo de validação documentado.

---

## Ideias futuras (sem compromisso)
Modos de 16 jogadores (Dodge Royale, torneios, raid) exigem arquitetura coordenada pelo servidor (não P2P); evento semanal da Noelle. Regras fixas: sem dinheiro real nem anúncios por ora; cosméticos nunca afetam o jogo; ranqueado abandonou = derrota; não presumir direitos sobre personagens/músicas de terceiros se a distribuição mudar.

## Dependências

```
Fase 1 (feita) ─► teste restrito
        │
        ▼
 2A Consolidação ─┬─► 2B Gamepad ─┬─► 3A ─► 3B ─► 3C ─► 3D     (Manual)
                  ├─► 2C Cartas ──┘
                  ├─► 2D Recuperação ─────────────┐
                  ├─► 2E Revanche/msgs            │
                  └─► 2F Pendências servidor ─┬──┼─► 5A ─► 5B ─► 5C ─► 5D ─► 5E
                                              │   │
                                              ▼   ▼
                                  4A ─► 4B ─► 4C ─► 4D/4E
                                              │
                                  2D + 4C ───►6A ─► 6B ─► 6C ─► 6D ─► 6E
```

## Estimativa de tokens (ordem de grandeza)

| Fase | Subentregas | Total |
| --- | --- | --- |
| 2 | 6 | ~1,6–2,1M |
| 3 | 4 | ~1,0–1,4M |
| 4 | 5 | ~1,55–2,0M |
| 5 | 5 | ~1,75–2,2M |
| 6 | 5 | ~1,45–1,9M |
| **Total** | 25 | **~7,4–9,6M** (≈ 25 janelas de 5 h) |

Regra de controle da Fase 1 continua: se um agente passar de 1,2× a estimativa, para e o escopo é revisto.

## Próximas três subentregas recomendadas

1. **2A** Consolidação das telas.
2. **2B** Controle físico (ou 2F, se o teste restrito mostrar bugs de servidor).
3. **2D** Recuperação de conexão (Opus), depois 2C/2E e então o protótipo 3A.
