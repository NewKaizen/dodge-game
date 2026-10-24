# PVP em rede (cada um joga no próprio PC)

Numa sala (LAN ou ONLINE) com o modo **PVP**, o jogo roda **nos dois PCs**. Cada um desvia na própria caixa sem atraso nenhum; pela rede vão só as decisões (carta escolhida, dano levado, resultado da rodada) e a posição do coração para desenhar a caixa do outro. O **CO-OP** numa sala continua no "Remote Play" ([lan.md](lan.md)): o jogo no host e a imagem para o convidado.

## Peças

| Peça | O quê |
| --- | --- |
| `src/lib/lan/canal.js` | O canal da partida (lógica pura, testada): mensagens **confiáveis em ordem** (`enviar`/`receber`/`ao`) e **rápidas** (`enviarRapido`, a última vale). |
| `src/game/rede.js` | Liga o canal no transporte (WebRTC direto, ou o servidor quando ele falha), diz se a partida é em rede (`emRede()`), qual é o meu lado (`meuLado()`: host 0, convidado 1) e faz o host mandar nas trocas de cena (`irParaCena`). Vigia a sala: se o outro sai no meio, cada um volta ao lobby (ou ao menu, se a sala caiu). |
| `src/game/controles.js` | Em rede: 2 jogadores, todos os controles daqui comandam o **meu** lado, o outro lado não tem controle aqui, e o C (pausa) não existe. |

## Regras de autoridade (valem para todo o PVP em rede)

1. **O host manda nas trocas de cena.** `irParaCena(this, 'PvpArena', dados)` abre a cena nos dois com os mesmos dados (inclusive a `semente`). O convidado nunca troca de cena sozinho; quando ele quer algo (ex.: voltar ao lobby), pede ao host por uma mensagem.
2. **O host é dono do estado das regras** (`estado` de `pvp/regras.js`, que é JSON puro, com o RNG dentro). Todo **sorteio de regra** (evento bônus, cartas malucas, arma do duelo, apuração da votação) é feito **só no host** e o resultado vai para o convidado. O convidado nunca tira número de RNG de regra por conta própria. Nos pontos de sincronia o host manda uma cópia do `estado` (`structuredClone`) e o convidado troca o dele por ela. Se o dele estava diferente, avisa no console (`console.warn('[rede] estado divergiu', ...)`): é bug, mas o jogo segue certo.
3. **Cada um é dono do próprio coração.** Quem decide se um coração levou dano, grazeou ou fez desvio perfeito é o PC **dono daquele coração**, que simula a caixa onde ele está (no CORAÇÃO TROCADO, a caixa do outro). Ele aplica na hora e manda a mensagem. O outro PC aplica quando ela chega, sem simular colisão para aquele coração.
4. **A caixa do outro é só espelho.** Ela roda o mesmo ataque com a mesma semente (o desenho fica parecido), mas o coração de lá anda pelas posições que chegam (`enviarRapido('coracao', ...)`, ~30 por segundo, interpolado) e **não colide** com nada aqui.
5. **Aleatoriedade só visual** (partículas, tremidas, roleta girando) pode usar `Math.random` ou RNG local à vontade. RNG que afeta o jogo vem do host.
6. **Nada de relógio compartilhado.** Cada PC roda as próprias animações; os dois se encontram em **pontos de sincronia** (`await canal.receber(tipo, chave)`): quem chega primeiro espera o outro.
7. **Confirmar é definitivo** em rede (na escolha de carta, de personagem, no voto): sem B para desfazer depois de mandar.

## Mensagens

`chave` é o número da rodada quando a mensagem é de uma rodada (evita confundir rodadas). Os nomes abaixo são o contrato entre as partes; quem implementa pode acrescentar mensagens, desde que documente aqui.

### Lobby e telas antes da arena (parte A)

| Tipo | De → para | Dados |
| --- | --- | --- |
| `cena` | host → conv. | `{ chave, dados }` (já existe: `irParaCena`) |
| `cursor` (rápida) | os dois | `{ tela, indice }`: onde está o cursor do outro (escolha de personagem, voto, mão de cartas) |
| `personagem` | os dois | `{ id }`: confirmei este personagem |
| `voto` | os dois | `{ arena }`: votei nesta arena |
| `apuracao` | host → conv. | `{ arena, ... }`: resultado da votação (para a animação mostrar o mesmo) |
| `voltarLobby` | conv. → host | `{}`: o convidado apertou para voltar ao lobby (o host decide) |

### Arena (parte B)

| Tipo | Chave | De → para | Dados |
| --- | --- | --- | --- |
| `inicio` | rodada | host → conv. | `{ estado, bonusPendente }` depois de `iniciarRodada` (mãos iguais nos dois) e de decidir se a rodada é bônus (`true`, ou o id forçado por `forcarBonus`) |
| `jogada` | rodada | os dois | `{ jogada }`: id da carta ou `null` (passou; também quando o tempo acaba) |
| `cursor` (rápida) | | os dois | `{ tela: 'arena', indice, passar, r }`: o cursor da minha mão (`r` = rodada) |
| `resolucao` | rodada | host → conv. | `{ jogadas, bonus, adiado, resultado, estado }`: o que a rodada deu (`bonus` = id do evento sorteado ou `null`; `adiado` = bônus empurrado pelo SUPER; `resultado` de `resolverRodada`/`resolverDuelo`/`resolverCopia`, com `resultado.trocas` nas cartas malucas) |
| `coracao` (rápida) | | os dois | `{ x, y, k, r }` posição do MEU coração na caixa `k` onde ele está (`r` = rodada) |
| `dano` | | dono → outro | `{ lado, dano, r }` (o outro aplica com as regras: escudo, 2ª chance...) |
| `graze` | | dono → outro | `{ lado, n, r }` |
| `fimEsquiva` | rodada | os dois | `{ acertos, ko }` do meu coração: terminei a minha caixa (também depois do duelo e do CTRL+C CTRL+V) |
| `fimRodada` | rodada | host → conv. | `{ estado, vencedor }` |
| `resultadoPronto` | rodada | conv. → host | `{}`: o replay do K.O. acabou aqui (o host espera, no máximo 20 s, e abre a `PvpResultado` nos dois com `irParaCena`) |
| `debug` (só no dev) | | os dois | `{ acao, args }`: `forcarMao`/`setHp`/`setEnergia` valem nos dois PCs; `forcarBonus` do convidado vai para o host |

### Duelo e CTRL+C CTRL+V (parte C)

| Tipo | Chave | De → para | Dados |
| --- | --- | --- | --- |
| `dueloPronto` | rodada | os dois | `{}`: abri o duelo (os dois começam o 3-2-1 juntos) |
| `dueloCoracao` (rápida) | | os dois | posição/velocidade do meu coração no duelo |
| `dueloAtaque` | rodada | os dois | `{ arma, x, y, angulo, t }`: ataquei (o outro cria a mesma arma, só de enfeite) |
| `dueloDano` | rodada | vítima → outro | dano que **eu** levei (via `arena.acertou(meuLado, dano)`) |
| `dueloFim` | rodada | os dois | `{ motivo, ... }` acabou para mim |
| `copiaApertos` (rápida) | | os dois | `{ n }`: quantos A eu apertei até agora |
| `copiaFinal` | rodada | os dois | `{ apertos }` |
| `copiaResultado` | rodada | host → conv. | `{ vencedor, quantia, ... }` (só o host aplica `copiarEnergia`) |

### Contrato entre a arena (B) e o duelo (C)

- A arena cria `new Duelo(arena, { ..., rede })` / `new Copia(arena, { ..., rede })` com `rede = emRede() ? { canal, meuLado: meuLado(), souHost: souHostDaRede(), rodada } : null`. Com `rede: null` tudo funciona como antes (local e contra a CPU).
- Em rede, o duelo só chama `arena.acertou(j, dano)` para `j === meuLado` (o coração daqui). A arena (B) manda o `dano` para o outro PC e aplica o dano que chega dele. O duelo nunca aplica dano no coração do outro.
- `arena.nocaute(j)` e `duelo.nocaute(j)` continuam como estão: a arena chama quando o HP zera, venha o dano daqui ou de lá.

## A arena em rede (parte B)

`PvpArena` cria `pvp/rede/ArenaRede.js` (`this.rede`) quando abre com `emRede()`; sem rede `this.rede` é `null` e tudo é como antes (2 locais, CPU, e a `CoopArena`, que estende a `PvpArena` e nunca entra em rede). As peças puras (comparar estados, interpolar o coração do outro) ficam em `pvp/rede/sincronia.js`, testadas em `pvp/__tests__/redeArena.test.js`.

Uma rodada em rede:

1. **inicio**: o host faz `iniciarRodada` e decide se é bônus; manda `inicio`. O convidado faz a mesma conta (só para conferir) e fica com o estado do host.
2. **escolha**: cada um escolhe na própria mão; a mão do outro mostra o cursor dele (`cursor`) e "PRONTO!" quando a `jogada` dele chega (a carta dele vira na mão, como no local). O relógio só passa o **meu** lado. Confirmar é definitivo.
3. **resolução**: o host valida as jogadas (inválida vira passar, com aviso), sorteia o evento bônus, as malucas e a arma do duelo (`rngBonus`, só no host) e resolve; manda `resolucao`. Os dois mostram a mesma roleta e a mesma revelação. A roleta e os efeitos dos eventos (`pvp/bonus/eventos/`) usam RNGs próprios da rodada (`<semente>:roleta:<rodada>`, `<semente>:efeito:<rodada>`): iguais nos dois PCs e sem mexer no `rngBonus` de regra.
4. **esquiva**: cada PC simula a caixa onde está o **seu** coração (no CORAÇÃO TROCADO, a do outro). `acertou`/`grazeou` só valem para o coração daqui (vêm das pistas, dos eventos como ESTÁTUA e BRASAS, e do duelo): aplicam na hora e mandam `dano`/`graze`. O que chega do outro entra em `aplicarAcerto`/`aplicarGraze` (as regras daqui, sem mandar de volta) e o coração espelho pisca; se chegar antes da esquiva começar aqui (o outro está adiantado), espera numa fila até ela começar. A outra caixa tem `pista.espelho = true`: o coração dela não anda pelo joystick nem colide; anda pelas posições de `coracao` (~30/s), 100 ms atrasado e interpolado. ♦ Q/K inverte o joystick do coração daqui (a caixa espelho só mostra o aviso). Quando a minha caixa acaba mando `fimEsquiva` (e o meu coração não leva mais nada nesta rodada); os dois esperam o do outro. Como o canal é em ordem, depois disso os dois têm os mesmos acertos e K.O.s, e o desvio perfeito sai igual.
5. **duelo / CTRL+C CTRL+V**: a arena cria o `Duelo`/`Copia` com `rede` (contrato acima), aplica o `dano` que chega e, no fim, também troca `fimEsquiva`.
6. **fim**: o host faz `fimDaRodada` e manda `fimRodada`; o convidado confere e troca. O K.O. (câmera lenta, replay) acontece nos dois quando o HP zera, venha o dano daqui ou de lá. Depois do "VENCEU!" o convidado manda `resultadoPronto` e fica esperando; o host espera por ele e abre a `PvpResultado` nos dois com os dados de sempre (as estatísticas do host valem: ele aplicou o dano e os grazes dos dois).

Estado divergiu? O convidado avisa no console (`[rede] estado divergiu`, com os caminhos que mudaram) e segue com o do host. Esperas de sincronia param quando a cena sai (`this.saindo`: o outro saiu e `rede.js` tirou os dois da cena) e avisam no console a cada 30 s parados.

## Testando

- `ONLINE=1 npx vite --port <porta> --strictPort` liga o jogo com o lobby online.
- Duas abas (dois contextos do Playwright) entram na mesma sala pelo código. No host, `debugRede.iniciar('PvpArena', { p1: 'kris', p2: 'susie' })` abre a arena em rede nos dois, pulando as telas antes.
- `debugRede.atraso(150, 50)` nas duas abas simula internet ruim (150 ms + até 50 de variação em cada sentido). **Todo o PVP precisa funcionar assim**: o coração de cada um responde na hora, e só o que vem do outro chega atrasado.
- `window.pvpArena` (dev) tem `estadoDebug()` (com `rede: { meuLado, souHost, espelhos }`), `forcarMao`, `setHp`, `setEnergia`, `forcarBonus(id)`. Em rede, chamados num PC valem nos dois (o `forcarBonus` vale na próxima rodada, decidida pelo host).
- Os testes `npm test` continuam passando; a lógica pura nova ganha teste em `__tests__`.
