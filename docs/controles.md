# Controles

O jogo se liga ao primeiro controle que o jogador usar, **sem nenhum botão para clicar**. Teclado, controle físico (gamepad), joysticks serial (Arduino, um por porta USB) e o **toque na tela** (celular e tablet, seção [Celular / toque](#celular--toque)) podem estar ligados ao mesmo tempo.

| Controle | Como liga | O que ainda exige clique |
| --- | --- | --- |
| Teclado | A primeira tecla do jogo (WASD, setas, Espaço, Enter, C, P, Esc, as remapeadas) apertada na página. Direções valem na hora; a primeira A/B/C só "acorda" | Nada |
| Controle físico | O primeiro botão apertado (o navegador só mostra o controle à página depois disso). Mexer só o analógico não liga | Nada |
| Toque (celular / tablet) | O primeiro toque na tela. Os controles aparecem sozinhos em tela de toque (`pointer: coarse` ou depois de um toque de verdade); com mouse, nunca | Nada |
| Joystick serial (um Arduino por porta USB) | Ao abrir a página, o jogo reabre sozinho **todas** as portas já autorizadas (`navigator.serial.getPorts`) e religa cada uma quando o cabo é plugado de novo (evento `connect`). Cada porta é uma fonte; a 1ª é o jogador 1, a 2ª o jogador 2 | **O primeiro pareamento de cada placa**: o navegador só abre a lista de portas (`requestPort`) com um gesto do jogador. CONFIGURAÇÕES → GAMEPAD → CONECTAR JOYSTICK SERIAL (A no teclado), uma vez por joystick |

Navegador sem Web Serial (Firefox, Safari): a opção CONECTAR JOYSTICK SERIAL nem aparece.

A barra de cima da página mostra só um resumo discreto ("controles: teclado · controle · 2 jogadores") e o botão de tela cheia (tecla F). Não há botão para escolher o número de jogadores: o jogo decide sozinho (seção abaixo). Antes de qualquer entrada, o menu inicial fica apagado e pede "aperte uma tecla ou um botão do controle".

## Celular / toque

O jogo inteiro roda no navegador do celular e do tablet (Chrome do Android e Safari do iPhone/iPad): menus, PVP, CO-OP, Expedição, campanha, online e contas. O toque é **mais uma fonte de entrada** no mesmo modelo das outras: os dedos viram as mesmas linhas `JOY` / `BTN` do protocolo ([protocolo-serial.md](protocolo-serial.md)), então nenhuma cena sabe que é toque. O toque é sempre o **jogador 1** e não conta como 2ª fonte para a detecção de 2 jogadores (dois jogadores no mesmo celular não existe; um controle ligado no celular continua sendo o jogador 1 junto com a tela).

### Os controles na tela

| Onde | O quê |
| --- | --- |
| Lado esquerdo (42% da largura) | **Joystick flutuante**: nasce onde o polegar encosta; arrastando além da borda, a base vem junto. Na caixa ele é **analógico** (`passoDoCoracao` já aceita -100..100 e limita o vetor a 1: diagonais suaves, inclinar pouco anda devagar). Zona morta de 14% do raio e 100% a 85% do raio. Parado, só um lembrete pequeno no canto |
| Direita, embaixo | **A** (grande, 80 px) e **B** (66 px), na diagonal para o polegar |
| Canto de cima à direita | **❚❚ pausa** (o C) e, onde o navegador deixa, **tela cheia**. Ficam em coluna: no celular deitado cabem na faixa preta ao lado do jogo e não cobrem o placar |

- **Menus**: o joystick vira direção digital com **repetição** (segurando: de novo depois de 450 ms e a cada 120 ms) e **histerese** perto da diagonal (a direção não pula entre dois eixos; só troca quando o outro eixo passa com 25% de folga, e só solta abaixo de 60% do limiar). Só vale enquanto o joystick da tela está inclinado: teclado, controle e joystick serial continuam como sempre. As telas que já repetem sozinhas (barras de CONFIGURAÇÕES, Grimório) põem `controles.repetirToque = false`.
- **Toque direto**: um toque rápido (até 450 ms, sem inclinar) no lado do joystick passa para a tela como clique: escolhe a opção do menu inicial, a aba e a linha de CONFIGURAÇÕES e o que mais já aceitava mouse (as outras telas seguem no joystick e no A/B). No resto da tela (fora dos botões) o dedo vai direto para o jogo.
- **Multitoque**: cada dedo é um `pointerId`; o joystick e o A/B funcionam juntos. Um segundo dedo no lado do joystick não rouba o primeiro; dois dedos no mesmo botão apertam uma vez.
- **Vibração**: `navigator.vibrate` de leve ao apertar A/B/C e quando o joystick muda de direção (Android; o iPhone não deixa o site vibrar).
- **Visual**: semitransparente, quadrado com borda branca de 3 px (as caixas do jogo) e contorno preto, fonte pixelada; aperta e acende na cor (A vermelho, B ciano, pausa amarelo).
- Os eventos de toque que nascem nos controles param ali (`preventDefault`): o Phaser ouve os toques da janela inteira e escolheria a opção do menu embaixo do polegar.

CONFIGURAÇÕES → **TOQUE**: **CONTROLES NA TELA** (AUTOMÁTICO / SEMPRE / ESCONDIDOS), **TAMANHO** (70% a 150%), **OPACIDADE** (20% a 90%, padrão 55%), **VIBRAR AO TOCAR** e RESTAURAR PADRÃO. Preferências `toqueControles`, `toqueTamanho`, `toqueOpacidade`, `toqueVibrar` (validadas em `preferencias.js`). Com ESCONDIDOS o toque vai direto para a tela: dá para voltar tocando na linha (a metade da direita avança o valor).

### A página no celular

- **Modo app** (classe `modo-toque` no `<html>`, posta por `lib/toque.js` em tela de toque): some a barra de cima e o rodapé, o palco ocupa a tela inteira menos as **margens seguras** (`env(safe-area-inset-*)`: notch e barra do iPhone; `viewport-fit=cover`). `game/resolucao.js` mede o palco e encaixa o 854x480 sem os passos de 5%.
- **Deitado primeiro**: em pé aparece "GIRE O CELULAR" (e uma partida local pausa, como ao perder o foco: `entrada-perdida`).
- **Tela cheia**: no primeiro toque (o `pointerup`, que é o gesto que o navegador aceita) o jogo pede tela cheia e trava a tela deitada (`screen.orientation.lock('landscape')`, só no Android). Uma vez só; depois, o botão do canto. O Safari do iPhone não tem tela cheia de elemento nem trava: fica a tela "gire" e as margens seguras. No iPad o botão usa `webkitRequestFullscreen`.
- **Sem zoom nem rolagem**: `user-scalable=no` e `maximum-scale=1` no viewport, `gesturestart` cancelado (o Safari ignora o `user-scalable`), `touch-action: none` na área do jogo e `manipulation` no resto, `overscroll-behavior: none` (sem "puxar para recarregar"), sem seleção de texto nem menu de toque longo nos controles.
- **Texto**: as telas que digitam (nome, código da sala, chat, IP; `capturarTexto` em `lib/simulador.js`) abrem, no modo toque, um campo de verdade no alto da tela (`lib/campoToque.js`) com OK e ✕: é ele que chama o teclado da tela. O texto passa pelo mesmo filtro e limite. As telas em Svelte (foto do perfil, recorte) usam botões de 44 px no mínimo com `pointer: coarse`.
- **App na tela inicial (PWA)**: `public/manifest.webmanifest` (`display: fullscreen`, `orientation: landscape`, cor do tema, ícones do coração em `public/icones/`, gerados por `node scripts/gerar-icones-app.mjs`) e `apple-touch-icon`. **Sem service worker** de propósito: nada de build velha em cache.
- **Som**: o celular só libera o áudio num gesto, e no iPhone o gesto que vale é o `touchend`/`pointerup`/`click`. `lib/destravarAudio.js` retoma o contexto único do jogo (efeitos, Phaser e a música) nesses eventos, para sempre (o iPhone deixa o contexto "interrupted" depois de ligação ou bloqueio de tela), e toca um buffer mudo no primeiro. A música toca em elementos `<audio>` ligados ao contexto (`game/musica.js`): o mesmo gesto toca silêncio em cada um deles (`destravarMusica`), porque o iPhone só deixa tocar um `<audio>` que já tocou num gesto. `game/musica.js` também tenta de novo no `pointerup`/`touchend`.
- **Segundo plano** (trocar de app, bloquear a tela): o celular dispara `visibilitychange`; vale o mesmo de uma aba escondida ([rede-pvp.md](rede-pvp.md) "Aba em segundo plano e pausa online"): partida local pausa (`entrada-perdida`), numa sala o jogo continua pelo relógio de fundo com o coração parado e os outros veem AUSENTE. Os dedos são soltos (`blur`, `pagehide`, `visibilitychange`).

### Desempenho

- No modo toque o canvas usa no máximo **1,5** pixel do aparelho por pixel CSS (celulares têm dpr 2,6 a 3) e **1x** com GRÁFICOS no MÍNIMO. Pixel 7 deitado: canvas de 1466x824 para 1100x618.
- Desenhos parados com milhares de comandos de `Graphics` viram textura uma vez só (`arte/assar.js`): o verso e a frente clássica das cartas (de ~3 mil e ~1 mil comandos por carta, refeitos todo quadro) e o piso do CASTELO (~480 losangos; agora só os que a onda de brilho cruza são redesenhados, com triângulos em vez de `fillPoints`/earcut).
- Medido com o Playwright (Chromium sem GPU, desenho em software (SwiftShader): serve para comparar antes/depois, não é o FPS de um celular de verdade), Pixel 7 deitado: esquiva do PVP de **17 para 31 FPS**; com a CPU 4x mais lenta (`Emulation.setCPUThrottlingRate` 4) o menu foi de 12 para 18 FPS e a esquiva fica em ~17 FPS (iPhone 14: menu 21 FPS). No perfil o JavaScript já é pequeno: o resto é o desenho em software, que num aparelho de verdade vai para a GPU.
- Ainda pesado, para depois: outros fundos de arena com `Graphics` redesenhado todo quadro e o gravador do replay do fim de partida (uma foto da caixa por quadro).

### Onde está o código

- [src/game/toque.js](../src/game/toque.js): a conta (joystick, histerese, repetição, multitoque), testada em `src/game/__tests__/toque.test.js`.
- [src/lib/toque.js](../src/lib/toque.js): a fonte `toque`, modo app, tela cheia no 1º toque, "gire", soltar os dedos.
- [src/ui/ControlesToque.svelte](../src/ui/ControlesToque.svelte): o desenho e os ouvintes dos dedos.
- [src/lib/campoToque.js](../src/lib/campoToque.js) (teclado da tela), [src/lib/destravarAudio.js](../src/lib/destravarAudio.js) (som), [src/lib/telaCheia.js](../src/lib/telaCheia.js) (tela cheia + trava deitada).

### Só dá para confirmar num aparelho de verdade

O som no iPhone (o Playwright não emula as regras de áudio do Safari; e a chave de silencioso do iPhone deixa o Web Audio mudo), a tela cheia e a trava deitada no Android (o Chromium sem janela não gira), o teclado da tela abrindo direto ao tocar A (o iPhone só abre com foco dentro do gesto), a vibração, o FPS real (GPU de verdade) e as margens do notch/Dynamic Island.

## Mapa do controle físico (padrão "standard")

| Controle | Ação |
| --- | --- |
| D-pad ou analógico esquerdo | Direções (zona morta 35%, de 10% a 80%) |
| A (0) ou X (2) | A · confirmar |
| B (1) ou Y (3) | B · voltar |
| Start (9) | C · pausa |

Controles fora do padrão usam os mesmos índices de botão; com 8 eixos ou mais, os eixos 6 e 7 viram o D-pad. Se não bater, remapeie. Os botões do D-pad (12 a 15) não podem ser A/B/C.

## Vagas dos jogadores

- O primeiro controle a apertar um botão é o **jogador 1**, o segundo é o **jogador 2** (um terceiro ajuda o jogador 1). Aparece um aviso: "CONTROLE CONECTADO · jogador 1".
- O teclado segue as vagas de sempre: WASD/Espaço = jogador 1, setas/Enter = jogador 2.
- Em modo 1 jogador e em partida em rede (LAN/online), todos os controles comandam o mesmo lado (o seu).
- Quantos jogadores locais há (1 ou 2) o jogo detecta sozinho: ver "Jogadores locais" abaixo.

## Jogadores locais (1 ou 2): detecção automática

`numJogadores` (store `jogo`, [src/lib/estado.js](../src/lib/estado.js)) continua sendo a única fonte da verdade, mas ninguém o escolhe mais num botão. A regra é pura e testada em [src/game/jogadores.js](../src/game/jogadores.js); [entrada.js](../src/game/entrada.js) a aplica (a cada mudança de fonte e a cada 150 ms, porque a cena ativa muda sem avisar).

| Situação | O que acontece |
| --- | --- |
| **Duas fontes distintas ativas**: 2 controles; controle + teclado; 2 joysticks serial; joystick serial + teclado ou + controle | 2 jogadores na hora, com o aviso "JOGADOR 2 ENTROU (controle / teclado / joystick serial)". O teclado inteiro (WASD e setas) conta como **uma** fonte |
| **Só teclado**, duas pessoas no mesmo teclado | Não dá para saber pelas teclas (em 1 jogador os dois conjuntos comandam o jogador 1). Nas telas de escolha do **PVP** e da **party do CO-OP**, o rodapé diz "JOGADOR 2: aperte ENTER (ou A no 2º controle) para entrar": o A do jogador 2 (Enter / Enter do numérico, em `teclas.js` `p2.A`) troca para 2 jogadores e o P2 ganha o seu cursor. Em 2 jogadores, WASD/Espaço = P1 e setas/Enter = P2, como sempre |
| **P2 desiste** (entrou pelo teclado) | Antes de alguém confirmar, o B do jogador 2 (Backspace / Shift direito) volta a 1 jogador ("JOGADOR 2 SAIU"). Depois que alguém confirma, o B só desfaz a escolha, como antes. Com duas fontes de verdade o B não tira o jogador 2 |
| **Durante a partida** | Nunca muda. Só muda em cena livre: Menu e telas de escolha (`CENAS_LIVRES`). Se o 2º controle ligar no meio de uma partida, o número muda quando voltar a uma dessas telas |
| **Fonte que some** (controle desconectado) | Não derruba para 1 no meio do fluxo (escolha de lutador, party): o jogador 2 fica. O número só volta a **1 no menu principal**, e só se não restarem duas fontes. Quem entrou pelo teclado também volta a 1 ao passar pelo menu e entra de novo na próxima escolha. Controle parado ("ocioso") não conta como saída: só a desconexão |
| **Sala LAN/online** | Não é mexida: a sala é sempre "o meu lado" (e a sala tem a sua regra, [src/lib/lan/rede.js](../src/lib/lan/rede.js)) |

Efeito colateral: em 1 jogador, o **Enter** nas telas de escolha do PVP e da party deixou de confirmar e passou a chamar o jogador 2; quem joga sozinho no teclado confirma com Espaço, Z ou E. O rodapé diz "ESPAÇO: confirmar     JOGADOR 2: ENTER (ou A no 2º controle) para entrar" e, no primeiro Enter, um aviso mostra "JOGADOR 2 ENTRANDO: aperte B (Backspace) para cancelar" (2E). O A do **1º** controle e o das teclas do P1 confirmam como sempre.

As telas de escolha mostram os avisos do tipo "info" (controle conectado, jogador 2 entrou) no canto de cima à direita; convite de amigo e pedido de amizade continuam esperando o menu.
- Ao desconectar e religar, o mesmo controle (mesmo id e índice) volta na mesma vaga ("CONTROLE RECONECTADO").

## Vibração do controle (rumble)

O controle físico vibra a cada golpe e nos mesmos avisos por jogador do joystick serial ([lib/saida.js](../src/lib/saida.js) chama [lib/vibracao.js](../src/lib/vibracao.js); as cenas não sabem). Todo modo que avisa o joystick (PVP 1x1, CO-OP, FFA) vibra de graça. Só vibra o controle da vaga do jogador que sofreu o evento (com 1 jogador local, todos os controles); eventos do adversário online nunca chegam aqui.

| Evento | Padrão (antes da intensidade) |
| --- | --- |
| Levou golpe (`levouGolpe`, no máx. 1 a cada 250 ms por jogador) | 120 ms, forte 0,5 / fraca 0,7 |
| K.O. / caído (o HP passou de positivo para 0 em `informarVida`) | 400 ms, forte 1,0 / fraca 0,5 |
| Teste (e padrão "dupla", reservado a momentos grandes) | dois pulsos de 90 ms, 180 ms entre eles |

A intensidade multiplica as duas forças. Para tudo (`reset()`) ao pausar (cena Pausa), ao perder o foco ou esconder a aba, ao desconectar entrada e ao entrar/sair da luta (`GAME`/`MENU`).

CONFIGURAÇÕES → GAMEPAD: **VIBRAÇÃO** (ligada/desligada, padrão ligada), **INTENSIDADE** (25/50/75/100%; padrão automático: 75%, ou 25% se TREMORES estiver reduzido/desligado ou REDUZIR ANIMAÇÕES ligado; o jogador pode mudar) e **TESTAR VIBRAÇÃO** (dois pulsos no controle que apertou A por último; sem motor mostra "este controle não vibra (ou o navegador não deixa)"). RESTAURAR PADRÃO também volta a vibração. Preferências `vibracao` (boolean) e `vibracaoIntensidade` (`null` ou 0.25/0.5/0.75/1), validadas em `preferencias.js`.

### Quando o BUZZER do joystick apita

Só em momentos pontuais, no joystick de quem foi afetado (nunca a cada golpe; CPU/ausente nada; online só o seu lado): **HP abaixo de 25%** (uma vez por luta, rearma ao curar acima de 40%), **K.O./caído** (dois apitos), **golpe de SUPER** (do adversário no PVP/FFA, do chefe no CO-OP) e **vitória** (um apito para quem ganhou). Intervalo mínimo de 1 s por jogador. CONFIGURAÇÕES → GAMEPAD: **BUZZER DO JOYSTICK** (liga/desliga, padrão ligado) e **TESTAR BUZZER** (um apito em cada joystick conectado). Detalhes em [protocolo-serial.md](protocolo-serial.md).

Navegadores: Chrome e Edge usam `gamepad.vibrationActuator.playEffect('dual-rumble', ...)`; se existir, `hapticActuators[0].pulse` serve de reserva. Firefox e Safari costumam não ter nada disso: o jogo não vibra e não dá erro. A lógica pura está em [src/game/vibracao.js](../src/game/vibracao.js), testada em `src/game/__tests__/vibracao.test.js` e `src/lib/__tests__/vibracaoSaida.test.js`.

Pendente (não há gancho em `saida.js` sem mexer nas arenas): vibração de SUPER/SUPER do chefe, vitória da partida, e K.O. no CO-OP clássico (`CoopArena` não chama `informarVida`).

## Foco e desconexão

Em partida **local** (CO-OP ou PvP contra a CPU/mesmo PC), o jogo **pausa sozinho** quando a janela perde o foco, a aba fica escondida, um controle é desconectado ou o joystick serial é desplugado; a tela de pausa diz o motivo. Para voltar, CONTINUAR (a pausa não some sozinha, para ninguém ser pego de surpresa). Partida em rede não pausa.

## Remapear (CONFIGURAÇÕES)

- **CONTROLES**: teclas do teclado, por jogador (como antes).
- **GAMEPAD**: A · CONFIRMAR, B · VOLTAR e PAUSA (A na linha, depois aperte o botão novo do controle; qualquer tecla cancela), ZONA MORTA do analógico (barra, 10% a 80%), CONECTAR JOYSTICK SERIAL (lista os joysticks e o jogador de cada um), TROCAR JOGADORES DOS JOYSTICKS, DESCONECTAR JOYSTICKS SERIAL e RESTAURAR PADRÃO. O painel mostra quais controles estão em uso.

Ficam no navegador, em `dodge-preferencias`: `botoesPad` (`null` ou `{ A: [...], B: [...], C: [...] }` com índices de botão, validado em [src/game/gamepad.js](../src/game/gamepad.js)) e `zonaMorta` (número de 0.1 a 0.8). Valor inválido volta ao padrão.

## Onde está o código

- [src/game/gamepad.js](../src/game/gamepad.js): leitura pura do controle (zona morta, borda, mapa de botões).
- [src/game/fontes.js](../src/game/fontes.js): fontes ligadas, tecla que liga o teclado e vagas dos jogadores.
- [src/lib/gamepad.js](../src/lib/gamepad.js): laço por quadro com `navigator.getGamepads`, manda `JOY`/`BTN` ao protocolo.
- [src/lib/simulador.js](../src/lib/simulador.js) (`armarTeclado`) e [src/lib/serial.js](../src/lib/serial.js) (`vigiarSerial`).
- [src/game/entrada.js](../src/game/entrada.js): liga tudo no início e emite `entrada-perdida` (as arenas locais pausam, `Controles.onPerdaDeFoco`).
- [src/game/jogadores.js](../src/game/jogadores.js) (regra de 1 ou 2 jogadores e o detector) e [src/game/jogadoresLocais.js](../src/game/jogadoresLocais.js) (a ponte com o store, usada pelas telas de escolha).
- Testes: `src/game/__tests__/{gamepad,fontes,jogadores}.test.js`, `src/lib/__tests__/{gamepad,simulador}.test.js`.

## Cartas legíveis (fase 2C)

- **Custo sempre à vista**: além da gema do canto de cima (coberta pela carta vizinha na mão), toda carta tem uma gema pequena com o custo no canto de baixo à esquerda, que fica à vista mesmo com a mão sobreposta.
- **Bloqueada** (custo maior que a energia): a carta escurece, a gema fica vermelha e ganha um selo **×** (forma, não só cor). A carta sob o cursor mostra o motivo no texto de status acima dela, em vermelho: `falta energia (3/5)` (energia que você tem / custo). Apertar A nela mostra o mesmo texto.
- No **CO-OP** vale o mesmo, mais `caído: não joga carta` para quem caiu. No **duelo** (rodada bônus) nada custa, então nada é bloqueado.
- Os motivos vêm de `motivoBloqueio` ([src/game/pvp/regras.js](../src/game/pvp/regras.js); `motivoBloqueioCoop` no [coop/regras.js](../src/game/coop/regras.js)), a mesma função que `podeJogar` usa para aceitar ou recusar a jogada: tela e regra não divergem. Hoje só existem dois motivos nas regras (`sem-energia`, `fora-da-mao`) mais `caido` no CO-OP; "só no turno de ataque" ou "já usada" não são regras do jogo (a carta escolhida aparece como PRONTO!).

## Acessibilidade (CONFIGURAÇÕES → ACESSIBILIDADE)

Três preferências **separadas** (`dodge-preferencias`, validadas em [preferencias.js](../src/game/preferencias.js); valor inválido volta ao padrão), todas lidas por [acessibilidade.js](../src/game/acessibilidade.js):

| Preferência | Valores | O que muda |
| --- | --- | --- |
| `flashes` (CLARÕES) | ligado/desligado | desligado: nenhum clarão de tela (câmera, retângulos, fade para branco na saída do menu vira preto); os avisos de ataque piscam 3x mais devagar (~1,8/s, abaixo do limite de 3/s da WCAG) e duram o mesmo tempo |
| `tremor` (TREMORES) | normal / reduzido (40%) / desligado | tremor de tela, da caixa e do HUD |
| `reduzirMovimento` (REDUZIR ANIMAÇÕES) | ligado/desligado | amansa tudo: tremor no máximo 30%, clarões 25%, zooms, câmeras lentas, piscadas e fundos mais calmos (não liga o que foi desligado) |

`daltonismo` (nenhum, protanopia, deuteranopia, tritanopia) troca avisos e cores dos jogadores. Volumes de música e efeitos ficam em ÁUDIO. A jogabilidade (balas, avisos, hitbox, tempo do aviso) nunca depende dessas preferências.

**Contraste**: [contraste.js](../src/game/contraste.js) calcula a razão WCAG; [contraste.test.js](../src/game/__tests__/contraste.test.js) exige 4,5:1 (3:1 para texto grande e elementos gráficos) nos pares principais: textos do HUD no preto e no painel, cores de jogador em todos os modos de daltonismo, nome na faixa da carta e custo. Ao mudar uma cor do HUD, rode `npm test`.
