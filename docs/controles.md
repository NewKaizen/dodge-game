# Controles

O jogo se liga ao primeiro controle que o jogador usar, **sem nenhum botão para clicar**. Teclado, controle físico (gamepad) e joystick serial (Arduino) podem estar ligados ao mesmo tempo.

| Controle | Como liga | O que ainda exige clique |
| --- | --- | --- |
| Teclado | A primeira tecla do jogo (WASD, setas, Espaço, Enter, C, P, Esc, as remapeadas) apertada na página. Direções valem na hora; a primeira A/B/C só "acorda" | Nada |
| Controle físico | O primeiro botão apertado (o navegador só mostra o controle à página depois disso). Mexer só o analógico não liga | Nada |
| Joystick serial | Ao abrir a página, o jogo reabre sozinho a porta já autorizada (`navigator.serial.getPorts`) e religa quando o cabo é plugado de novo (evento `connect`) | **O primeiro pareamento**: o navegador só abre a lista de portas (`requestPort`) com um gesto do jogador. CONFIGURAÇÕES → GAMEPAD → CONECTAR JOYSTICK SERIAL (A no teclado) |

Navegador sem Web Serial (Firefox, Safari): a opção CONECTAR JOYSTICK SERIAL nem aparece.

A barra de cima da página mostra só um resumo discreto ("controles: teclado · controle") e o botão de tela cheia (tecla F). Antes de qualquer entrada, o menu inicial fica apagado e pede "aperte uma tecla ou um botão do controle".

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
- Ao desconectar e religar, o mesmo controle (mesmo id e índice) volta na mesma vaga ("CONTROLE RECONECTADO").

## Foco e desconexão

Em partida **local** (CO-OP ou PvP contra a CPU/mesmo PC), o jogo **pausa sozinho** quando a janela perde o foco, a aba fica escondida, um controle é desconectado ou o joystick serial é desplugado; a tela de pausa diz o motivo. Para voltar, CONTINUAR (a pausa não some sozinha, para ninguém ser pego de surpresa). Partida em rede não pausa.

## Remapear (CONFIGURAÇÕES)

- **CONTROLES**: teclas do teclado, por jogador (como antes).
- **GAMEPAD**: A · CONFIRMAR, B · VOLTAR e PAUSA (A na linha, depois aperte o botão novo do controle; qualquer tecla cancela), ZONA MORTA do analógico (barra, 10% a 80%), CONECTAR JOYSTICK SERIAL e RESTAURAR PADRÃO. O painel mostra quais controles estão em uso.

Ficam no navegador, em `dodge-preferencias`: `botoesPad` (`null` ou `{ A: [...], B: [...], C: [...] }` com índices de botão, validado em [src/game/gamepad.js](../src/game/gamepad.js)) e `zonaMorta` (número de 0.1 a 0.8). Valor inválido volta ao padrão.

## Onde está o código

- [src/game/gamepad.js](../src/game/gamepad.js): leitura pura do controle (zona morta, borda, mapa de botões).
- [src/game/fontes.js](../src/game/fontes.js): fontes ligadas, tecla que liga o teclado e vagas dos jogadores.
- [src/lib/gamepad.js](../src/lib/gamepad.js): laço por quadro com `navigator.getGamepads`, manda `JOY`/`BTN` ao protocolo.
- [src/lib/simulador.js](../src/lib/simulador.js) (`armarTeclado`) e [src/lib/serial.js](../src/lib/serial.js) (`vigiarSerial`).
- [src/game/entrada.js](../src/game/entrada.js): liga tudo no início e emite `entrada-perdida` (as arenas locais pausam, `Controles.onPerdaDeFoco`).
- Testes: `src/game/__tests__/{gamepad,fontes}.test.js`, `src/lib/__tests__/{gamepad,simulador}.test.js`.
