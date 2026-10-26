# Protocolo serial

Uma mensagem por linha (terminada em `\n`; `\r\n` também vale), texto simples, 9600 baud, campos separados por espaço. O jogo conversa só com o **Arduino principal** (jogador 1) pela USB (Web Serial); ele é a ponte para o **Arduino secundário** (jogador 2).

```text
Jogo (navegador) ──USB 9600──▶ Arduino principal (P1) ──serial 9600──▶ Arduino secundário (P2)
```

## Joystick → jogo (controles)

| Comando | Formato                   | Exemplo         | Descrição                                          |
|---------|---------------------------|-----------------|----------------------------------------------------|
| `JOY`   | `JOY [jogador] <x> <y>`   | `JOY 1 -35 80`  | Posição do joystick, cada eixo de -100 a 100 (o Arduino já calibra e aplica a zona morta) |
| `BTN`   | `BTN [jogador] <A\|B\|C>` | `BTN 2 A`       | Botão apertado (envie só na hora que apertar)     |

- O número do jogador (`1` ou `2`) é opcional; sem ele, vale o jogador 1. O principal repassa as linhas do secundário sem trocar o `2`.
- `A` confirma (menus, escolha de personagem, chefe e carta); `B` cancela/volta (na mão de cartas, desfaz ou vai para o PASSAR).
- `C` abre/fecha o menu de pause nas arenas (continuar, configurações, recomeçar a luta, sair da luta). `BTN START` e `BTN PAUSE` também valem como `C`. No teclado: `C` ou `Esc` (jogador 1), `P` (jogador 2).
- Nas telas de vitória e game over: `A` luta de novo com o mesmo chefe, `B` volta para a seleção de chefe.
- A direção do `JOY` também navega nos menus (precisa passar de 50 em algum eixo).
- `JOY` pode ser enviado continuamente ou só quando mudar.
- No modo 1 jogador, os comandos de qualquer jogador controlam o jogador 1.
- Linhas desconhecidas (depuração etc.) são ignoradas.

## Jogo → joystick (comandos)

Formato `<jogador> <comando> [argumentos]`; o principal executa os `1 ...` e repassa os `2 ...` ao secundário. Quem decide o que mandar é [src/lib/saida.js](../src/lib/saida.js) (só com o joystick serial conectado; teclado e controle não mandam nada).

| Quando                         | Linhas enviadas                                  |
|--------------------------------|--------------------------------------------------|
| Conectou                       | `1 PING`, depois `1 MENU` ou `1 GAME`            |
| A cada 1 s, enquanto conectado | `1 PING`                                         |
| Entrou numa luta (PvP ou coop) | `1 GAME`                                         |
| Saiu da luta (menu, resultado) | `1 MENU`                                         |
| O HP de um jogador mudou       | `<jogador> VIDA <hpAtual> <hpMaximo>`            |
| Jogador levou golpe            | `<jogador> BUZZER` (no máximo um a cada 250 ms)  |
| Botão Desconectar / fechar aba | `1 DISCONNECT`                                   |

- `VIDA` leva o **HP real** do personagem, o mesmo da tela (`1 VIDA 150 200` → OLED mostra `HP: 150/200` e enche 75% da barra). O Arduino calcula a porcentagem. O HP vai inteiro, entre `0` e o máximo; com HP máximo inválido nada é enviado. Só sai quando muda, e cada luta começa mandando o HP cheio.
- Os Arduinos mostram `SEM CONEXAO / COM O SERVIDOR` depois de 3 s sem `PING`/`GAME`/`MENU`; por isso o `PING` de 1 em 1 s. O principal precisa repassar `PING` e `DISCONNECT` ao secundário.
- Só os jogadores de verdade recebem `VIDA`/`BUZZER`: no modo 1 jogador o P2 é a CPU e nada vai para o Arduino 2.
- O jogo não manda `1 LED ...`: o firmware do principal pinta o RGB sozinho pelo estado (vermelho sem conexão, verde no menu, azul piscando na luta) e sobrescreveria a cor.
- "Recomeçar a luta" (saída e entrada seguidas) não manda `MENU`/`GAME` de novo, só o HP cheio.

## Teclado e controle físico

O teclado ([src/lib/simulador.js](../src/lib/simulador.js)) e o controle físico ([src/lib/gamepad.js](../src/lib/gamepad.js)) geram as mesmas linhas `JOY`/`BTN` e ligam sozinhos (primeira tecla / primeiro botão), ver [controles.md](controles.md). As teclas podem ser trocadas em CONFIGURAÇÕES → CONTROLES, por jogador (preferência `teclas`, [src/game/teclas.js](../src/game/teclas.js)), e os botões do controle em GAMEPAD. O joystick serial não é remapeável.

## Conexão do joystick serial

O primeiro pareamento precisa de um gesto do jogador (CONFIGURAÇÕES → GAMEPAD → CONECTAR JOYSTICK SERIAL). Depois o jogo reabre sozinho a porta autorizada ao carregar a página e quando o cabo é plugado de novo.
