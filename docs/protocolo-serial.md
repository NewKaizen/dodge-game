# Protocolo serial

Uma mensagem por linha (terminada em `\n`), 9600 baud. O número do jogador (`1` ou `2`) é opcional; sem ele, vale o jogador 1.

| Comando | Formato                   | Exemplo         | Descrição                                          |
|---------|---------------------------|-----------------|----------------------------------------------------|
| `JOY`   | `JOY [jogador] <x> <y>`   | `JOY 2 -40 100` | Posição do joystick, cada eixo de -100 a 100       |
| `BTN`   | `BTN [jogador] <A\|B\|C>` | `BTN 1 A`       | Botão apertado (envie só na hora que apertar)     |

- `A` confirma (menus, escolha de personagem, chefe e carta); `B` cancela/volta (na mão de cartas, desfaz ou vai para o PASSAR).
- `C` abre/fecha o menu de pause nas arenas (continuar, configurações, recomeçar a luta, sair da luta). `BTN START` e `BTN PAUSE` também valem como `C`. No teclado: `C` ou `Esc` (jogador 1), `P` (jogador 2).
- Nas telas de vitória e game over: `A` luta de novo com o mesmo chefe, `B` volta para a seleção de chefe.
- A direção do `JOY` também navega nos menus (precisa passar de 50 em algum eixo).
- `JOY` pode ser enviado continuamente ou só quando mudar.
- No modo 1 jogador, os comandos de qualquer jogador controlam o jogador 1.

O simulador de teclado ([src/lib/simulador.js](../src/lib/simulador.js)) gera exatamente essas linhas.
