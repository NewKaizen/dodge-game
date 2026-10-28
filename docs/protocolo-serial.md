# Protocolo serial

Uma mensagem por linha (terminada em `\n`; `\r\n` também vale), texto simples, 9600 baud, campos separados por espaço. O jogo fala com **cada Arduino pela própria porta USB** (Web Serial, só Chrome/Edge). O firmware **não muda**: é o mesmo sketch em todas as placas.

## Topologias

**Uma placa por porta (recomendado).** Grave o mesmo sketch em cada Arduino e plugue cada um numa USB. Não há ligação Arduino ↔ Arduino. O jogo decide qual porta é o jogador 1 e qual é o 2.

```text
Jogo (navegador) ──USB 9600──▶ Arduino A  (jogador 1 ou 2, o jogo escolhe)
                 ──USB 9600──▶ Arduino B  (o outro jogador)
```

**Relé antigo (uma porta só).** O Arduino principal fica na USB e repassa o secundário por SoftwareSerial (o secundário manda `JOY 2`/`BTN 2`). Continua funcionando enquanto só uma porta estiver aberta e ela for o jogador 1.

```text
Jogo ──USB 9600──▶ Arduino principal (P1) ──SoftwareSerial 9600──▶ Arduino secundário (P2)
```

O modo vale pela quantidade de portas abertas: com **2 ou mais** portas é "uma placa por porta"; com **uma** (jogador 1) é o relé.

## Joystick → jogo (controles)

| Comando | Formato                   | Exemplo         | Descrição                                          |
|---------|---------------------------|-----------------|----------------------------------------------------|
| `JOY`   | `JOY [jogador] <x> <y>`   | `JOY 1 -35 80`  | Posição do joystick, cada eixo de -100 a 100 (o Arduino já calibra e aplica a zona morta) |
| `BTN`   | `BTN [jogador] <A\|B\|C>` | `BTN 2 A`       | Botão apertado (envie só na hora que apertar)     |

- O número do jogador (`1` ou `2`) é opcional; sem ele, vale o jogador 1.
- **Uma placa por porta:** toda placa se diz jogador 1 (`JOY 1 ...`, `BTN 1 ...`, e `JOY 1 0 0` ao ligar). O jogo **ignora o número da linha** e o troca pelo jogador da porta antes de interpretar (`JOY 1 10 20` vindo da porta do P2 vira `JOY 2 10 20`), por isso teclado e controle físico continuam se misturando como antes.
- **Relé (uma porta só):** os números `1` e `2` da linha valem como vieram (o principal repassa as linhas do secundário com o `2`).
- `A` confirma (menus, escolha de personagem, chefe e carta); `B` cancela/volta (na mão de cartas, desfaz ou vai para o PASSAR).
- `C` abre/fecha o menu de pause nas arenas (continuar, configurações, recomeçar a luta, sair da luta). `BTN START` e `BTN PAUSE` também valem como `C`. No teclado: `C` ou `Esc` (jogador 1), `P` (jogador 2).
- Nas telas de vitória e game over: `A` luta de novo com o mesmo chefe, `B` volta para a seleção de chefe.
- A direção do `JOY` também navega nos menus (precisa passar de 50 em algum eixo).
- `JOY` pode ser enviado continuamente ou só quando mudar.
- No modo 1 jogador, os comandos de qualquer jogador controlam o jogador 1.
- Linhas desconhecidas (depuração etc.) são ignoradas.

## Jogo → joystick (comandos)

Quem decide o que mandar é [src/lib/saida.js](../src/lib/saida.js) e quem escolhe as portas é [src/lib/joysticks.js](../src/lib/joysticks.js) (só com joystick serial conectado; teclado e controle não mandam nada).

| Quando                         | Linha enviada                      | Para onde                    |
|--------------------------------|------------------------------------|------------------------------|
| Conectou                       | `PING`, depois `MENU` ou `GAME`    | todas as portas abertas      |
| A cada 1 s, enquanto conectado | `PING`                             | todas as portas abertas      |
| Entrou numa luta (PvP ou coop) | `GAME`                             | todas as portas abertas      |
| Saiu da luta (menu, resultado) | `MENU`                             | todas as portas abertas      |
| O HP de um jogador mudou       | `1 VIDA <hpAtual> <hpMaximo>`      | só a porta desse jogador     |
| Jogador levou golpe            | `1 BUZZER` (no máximo um a cada 250 ms) | só a porta desse jogador |
| Botão Desconectar / fechar aba | `DISCONNECT`                       | todas as portas abertas      |

- Com **uma placa por porta**, a linha de um jogador sai com o número **local `1`** (o que o firmware executa na própria placa): o P2 recebe `1 VIDA 150 200` na porta dele, nunca `2 VIDA`. Jogador sem porta (a CPU) não recebe nada.
- No **relé** (uma porta só, jogador 1) as linhas vão como o jogo as pensa: `1 VIDA ...` e `2 VIDA ...`/`2 BUZZER` pela mesma porta; a placa principal executa as do `1` e repassa as do `2` à secundária.
- Quando uma porta abre, fecha ou troca de jogador, o jogo repete `PING`, o estado atual (`MENU`/`GAME`) e o HP.
- `VIDA` leva o **HP real** do personagem, o mesmo da tela (`1 VIDA 150 200` → OLED mostra `HP: 150/200` e enche 75% da barra). O Arduino calcula a porcentagem. O HP vai inteiro, entre `0` e o máximo; com HP máximo inválido nada é enviado. Só sai quando muda, e cada luta começa mandando o HP cheio.
- Os Arduinos mostram `SEM CONEXAO / COM O SERVIDOR` depois de 3 s sem `PING`/`GAME`/`MENU`; por isso o `PING` de 1 em 1 s, para todas as portas (e, no relé, a principal repassa `PING` e `DISCONNECT` à secundária).
- O jogo não manda `LED ...`: o firmware pinta o RGB sozinho pelo estado (vermelho sem conexão, verde no menu, azul piscando na luta).
- O jogo **não manda nada que o firmware não conheça** (não existe comando para dizer "você é o P2"): sem isso o OLED não mostra P1/P2 e a placa continua se chamando jogador 1; quem sabe é só o jogo.
- "Recomeçar a luta" (saída e entrada seguidas) não manda `MENU`/`GAME` de novo, só o HP cheio.

## Qual porta é qual jogador

- A primeira porta pareada/aberta é o **jogador 1**, a segunda o **jogador 2**. A escolha fica salva no navegador (preferência `joysticksSerial`) por porta, com a chave `<vendorId>:<productId>#<índice>` do `getInfo()` do Web Serial; placas idênticas têm o mesmo vendor/product e se distinguem só pela ordem em que o navegador as devolve (`getPorts`, a ordem do pareamento), então é uma identificação aproximada.
- CONFIGURAÇÕES → GAMEPAD → **TROCAR JOGADORES DOS JOYSTICKS** inverte quem é P1 e P2 (vale na hora e fica salvo). Com um joystick só, ele passa a ser o outro jogador.
- Desplugar uma porta desliga só aquela fonte (partida local pausa); plugar de novo a reabre com o mesmo jogador.
- Duas portas abertas são duas fontes distintas: o jogo entra sozinho em 2 jogadores ([controles.md](controles.md)).

## Teclado e controle físico

O teclado ([src/lib/simulador.js](../src/lib/simulador.js)) e o controle físico ([src/lib/gamepad.js](../src/lib/gamepad.js)) geram as mesmas linhas `JOY`/`BTN` e ligam sozinhos (primeira tecla / primeiro botão), ver [controles.md](controles.md). As teclas podem ser trocadas em CONFIGURAÇÕES → CONTROLES, por jogador (preferência `teclas`, [src/game/teclas.js](../src/game/teclas.js)), e os botões do controle em GAMEPAD. O joystick serial não é remapeável.

## Conexão dos joysticks serial

O primeiro pareamento de **cada** placa precisa de um gesto do jogador (CONFIGURAÇÕES → GAMEPAD → CONECTAR JOYSTICK SERIAL, uma vez por joystick; o navegador mostra a lista de portas). Depois o jogo reabre sozinho todas as portas autorizadas ao carregar a página e cada uma quando o cabo é plugado de novo. DESCONECTAR JOYSTICKS SERIAL fecha todos e eles só voltam com um novo pareamento.

## Montagem

Fiação de cada placa como sempre foi (joystick, botões A/B/pause, LED RGB, buzzer, OLED SSD1306 128x32 em I2C), **sem** a ligação Arduino ↔ Arduino. Grave o **mesmo sketch** nas duas (bibliotecas Adafruit_GFX e Adafruit_SSD1306, 9600 baud) e plugue cada uma na sua USB.
