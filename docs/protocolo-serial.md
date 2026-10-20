# Protocolo serial

Uma mensagem por linha (terminada em `\n`; `\r\n` também vale), texto simples, 9600 baud, campos separados por espaço. O jogo conversa só com o **Arduino principal** (jogador 1) pela USB (Web Serial); ele é a ponte para o **Arduino secundário** (jogador 2).

```text
Jogo (navegador) ──USB 9600──▶ Arduino principal (P1) ──UART 9600──▶ Arduino secundário (P2)
```

## Joystick → jogo (controles)

| Comando | Formato                   | Exemplo         | Descrição                                          |
|---------|---------------------------|-----------------|----------------------------------------------------|
| `JOY`   | `JOY [jogador] <x> <y>`   | `JOY 1 512 700` | Leitura analógica crua de cada eixo, `0` a `1023` (centro ~`512`) |
| `BTN`   | `BTN [jogador] <A\|B\|C>` | `BTN 2 A`       | Botão apertado (envie só na hora que apertar)     |

- O número do jogador (`1` ou `2`) é opcional; sem ele, vale o jogador 1. O principal repassa as linhas do secundário sem trocar o `2`.
- O jogo converte `0–1023` para `-100..100` ([src/lib/conversao.js](../src/lib/conversao.js)): ±40 em volta do 512 é folga (analógico parado não anda), `0` = esquerda/cima, `1023` = direita/baixo. Joystick montado ao contrário: troque `INVERTER` nesse arquivo.
- `A` confirma (menus, escolha de personagem, chefe e carta); `B` cancela/volta (na mão de cartas, desfaz ou vai para o PASSAR).
- `C` abre/fecha o menu de pause nas arenas (continuar, configurações, recomeçar a luta, sair da luta). `BTN START` e `BTN PAUSE` também valem como `C`. No teclado: `C` ou `Esc` (jogador 1), `P` (jogador 2).
- Nas telas de vitória e game over: `A` luta de novo com o mesmo chefe, `B` volta para a seleção de chefe.
- A direção do `JOY` também navega nos menus (precisa passar de 50 em algum eixo depois da conversão, ~`790` ou ~`235` cru).
- `JOY` pode ser enviado continuamente ou só quando mudar.
- No modo 1 jogador, os comandos de qualquer jogador controlam o jogador 1.
- Linhas desconhecidas (resposta do `PING`, depuração) são ignoradas.

## Jogo → joystick (comandos)

Formato `<jogador> <comando> [argumentos]`; o principal executa os `1 ...` e repassa os `2 ...` ao secundário. Quem decide o que mandar é [src/lib/saida.js](../src/lib/saida.js) (só com o joystick serial conectado; o simulador não manda nada).

| Quando                         | Linhas enviadas                                  |
|--------------------------------|--------------------------------------------------|
| Conectou                       | `1 PING`, depois o estado atual (abaixo)         |
| Entrou numa luta (PvP ou coop) | `1 LED AZUL`, `1 GAME`                           |
| Saiu da luta (menu, resultado) | `1 LED VERDE`, `1 MENU`                          |
| A vida de um jogador mudou     | `<jogador> VIDA <0–100>`                         |
| Jogador levou golpe            | `<jogador> BUZZER` (no P1 também `1 LED VERMELHO` por 300 ms e volta ao azul) |
| Botão Desconectar / fechar aba | `1 LED DESLIGADO`, `1 DISCONNECT`                |

- `VIDA` é a **porcentagem** da vida atual sobre a vida máxima do personagem, inteira e limitada a `0–100` (`40` de `80` → `1 VIDA 50`); vivo nunca vai como `0`. Só sai quando o número muda, e cada luta começa mandando a vida cheia.
- Só os jogadores de verdade recebem `VIDA`/`BUZZER`: no modo 1 jogador o P2 é a CPU e nada vai para o Arduino 2.
- O `BUZZER` toca no máximo uma vez a cada 250 ms por jogador (vários tiros juntos = um apito).
- O LED vai antes do `GAME`/`MENU`: se o firmware tiver rotina própria para o estado (azul piscando no jogo), ela fica valendo.
- "Recomeçar a luta" (saída e entrada seguidas) não manda `MENU`/`GAME` de novo, só a vida cheia.

## Simulador

O simulador de teclado ([src/lib/simulador.js](../src/lib/simulador.js)) gera as mesmas linhas `JOY`/`BTN`, mas com os eixos já em `-100..100`. As teclas dele podem ser trocadas em CONFIGURAÇÕES → CONTROLES, por jogador; ficam salvas no navegador (preferência `teclas`, ver [src/game/teclas.js](../src/game/teclas.js)). O joystick serial não é remapeável.
