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
| `inicio` | rodada | host → conv. | `{ estado }` depois de `iniciarRodada` (mãos iguais nos dois) |
| `jogada` | rodada | os dois | `{ jogada }`: id da carta ou `null` (passou; também quando o tempo acaba) |
| `resolucao` | rodada | host → conv. | `{ jogadas, bonus, trocas, resultado, estado }`: o que a rodada deu (evento sorteado, malucas, resultado de `resolverRodada`/`resolverDuelo`/`resolverCopia`) |
| `coracao` (rápida) | | os dois | `{ x, y, ... }` posição do MEU coração na caixa onde ele está |
| `dano` | | dono → outro | `{ lado, dano }` (o outro aplica com as regras: escudo, 2ª chance...) |
| `graze` | | dono → outro | `{ lado, n }` |
| `fimEsquiva` | rodada | os dois | `{ acertos, perfeito, ... }` do meu coração: terminei a minha caixa |
| `fimRodada` | rodada | host → conv. | `{ estado, vencedor }` |
| `resultado` | | host → conv. | dados da `PvpResultado` (vai junto com `irParaCena`) |

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

## Testando

- `ONLINE=1 npx vite --port <porta> --strictPort` liga o jogo com o lobby online.
- Duas abas (dois contextos do Playwright) entram na mesma sala pelo código. No host, `debugRede.iniciar('PvpArena', { p1: 'kris', p2: 'susie' })` abre a arena em rede nos dois, pulando as telas antes.
- `debugRede.atraso(150, 50)` nas duas abas simula internet ruim (150 ms + até 50 de variação em cada sentido). **Todo o PVP precisa funcionar assim**: o coração de cada um responde na hora, e só o que vem do outro chega atrasado.
- `window.pvpArena` (dev) tem `estadoDebug()`, `forcarMao`, `setHp`, `forcarBonus(id)`.
- Os testes `npm test` continuam passando; a lógica pura nova ganha teste em `__tests__`.
