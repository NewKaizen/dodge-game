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

Peças: `pvp/bonus/redeDuelo.js` (Duelo), `pvp/bonus/redeCopia.js` (Copia) e `pvp/bonus/redeMinigame.js` (o interpolador do coração do outro e as mensagens da rodada, lógica pura testada em `__tests__/redeMinigame.test.js`). Com `rede: null` o Duelo e a Copia não criam nada disso.

| Tipo | Chave | De → para | Dados |
| --- | --- | --- | --- |
| `dueloPronto` | rodada | os dois | `{}`: abri a caixa do duelo (quem chega primeiro espera o outro para o 3-2-1) |
| `dueloCoracao` (rápida) | | os dois | `{ r, t, x, y, vx, vy }`: meu coração, ~30 por segundo (`r` = rodada, `t` = meu relógio em ms) |
| `dueloAtaque` | rodada | os dois | `{ arma, id, ... }`: ataquei. `tiro { x, y, angulo }`, `espada { angulo, lado }`, `bumerangue { x, y, dx, dy, ate }`, `explosao { x0, y0, alvos, giros }`. O outro cria a mesma arma (réplica) com o mesmo `id` |
| `dueloDano` | rodada | vítima → outro | `{ de, dano, x, y, ref }`: levei este golpe (`ref` = id do tiro/golpe que acertou). Só o enfeite e o placar do duelo: o **HP** vai pela mensagem `dano` da arena |
| `dueloRebate` | rodada | dono da espada → dono da arma | `{ id, tipo }`: minha espada quebrou o seu tiro (`tiro`) / virou o seu bumerangue (`bumerangue`) |
| `dueloFim` | rodada | os dois | `{ motivo }` (`'tempo'` ou `'ko'`): a luta acabou para mim |
| `copiaPronto` | rodada | os dois | `{}`: abri a janela da cópia (quem chega primeiro espera o outro para o 3-2-1) |
| `copiaApertos` (rápida) | | os dois | `{ r, n }`: quantos A eu apertei até agora (cumulativo) |
| `copiaFinal` | rodada | os dois | `{ apertos, motivo }`: acabou para mim, com este total (`'tempo'` ou `'cheio'`) |
| `copiaResultado` | rodada | host → conv. | `{ apertos, cabo, vencedor, quantia, perdeu, ganhou, energias, motivo }` (`energias`: a dos dois **antes** da cópia, para a animação) |

**Duelo**

- Cada PC simula só o **próprio** coração (movimento, i-frames, empurrão) e manda a posição. O do outro anda pelas posições que chegam, desenhado um pouco no passado (interpolado entre duas amostras). O atraso do desenho se ajusta à variação da rede (no mínimo 60 ms além do caminho mais rápido) e muda aos poucos (o relógio do desenho anda entre 0,7x e 1,3x): o coração do outro nunca pula nem volta para trás.
- Ataque: a arma sai **aqui na hora** e vai `dueloAtaque`; lá ela vira réplica, com os mesmos números (mira, alvos das bombas, giro dos estilhaços). Cada projétil tem `id` (`lado:n`, as bombas `lado:n:k`, os estilhaços `...:k`).
- **A vítima decide** (`duelo.decide(j)`: o coração `j` é daqui?). Cada PC confere golpes só no coração daqui (inclusive das réplicas das armas do outro) e chama `arena.acertou(meuLado, dano)`; o golpe no coração do outro nunca é conferido aqui. Aceito o golpe, o duelo manda `dueloDano`; lá ele só faz o enfeite (partículas, borda, piscar), conta o placar do duelo (`acertos`, `dano`) e some com o tiro que acertou.
- **Espada**: a espada daqui acerta o coração do outro só no PC dele (a réplica dela lá). O **aparo** (quebrar tiros/estilhaços, virar o bumerangue) é de quem segura a espada: ela protege o dono, que é a vítima daqueles projéteis. A espada daqui apara as réplicas e manda `dueloRebate`; o dono da arma quebra/vira a de verdade. A réplica da espada do outro não apara nada aqui.
- **Empurrão**: quem leva o golpe se empurra no próprio PC; o outro vê pela posição.
- **Bomba**: as duas explodem igual (mesmos alvos e giros); o dano é de quem estiver no raio, conferido por ele.
- **Começo**: cada um manda `dueloPronto` ao abrir a caixa e espera o do outro (até 10 s; sem resposta, segue sozinho). Os dois começam o 3-2-1 com a diferença de uma ida da rede.
- **Fim**: o tempo de cada um corre no próprio PC. Quem acaba (tempo, ou o K.O. depois da folga de `DUELO.fimMs`) manda `dueloFim`, e o outro acaba na hora quando ele chega. O `rodar()` só resolve depois do `dueloFim` do outro (até 6 s): como o canal é em ordem, aí já chegou todo dano que ele levou, e o resultado (`acertos`, `dano`, `ko`, `motivo`) sai igual nos dois. O K.O. vale quando o HP zera, venha o dano daqui ou de lá (a arena chama `duelo.nocaute(j)`); com algum K.O. o motivo é `'ko'` nos dois.
- Replay do K.O.: igual ao local (o gravador fotografa os objetos do duelo, réplicas inclusive, e as posições dos dois corações como aparecem aqui).

**CTRL+C CTRL+V**

- Cada PC conta só os **próprios** A (sem atraso) e manda o total (`copiaApertos`); o cabo na tela é a diferença dos dois totais (`caboDaCopia` em `pvp/bonus.js`), com o do outro chegando um pouco atrasado.
- Começo como no duelo (`copiaPronto`). Quando o tempo acaba ou a barra enche **na tela de um**, ele manda `copiaFinal` com o total dele e o outro acaba na hora quando ele chega.
- **Só o host apura**: espera o `copiaFinal` do convidado (até 4 s; sem ele, vale o último total que chegou), calcula com os dois totais (`apurarCopia`), aplica `copiarEnergia` e manda `copiaResultado`. O convidado espera o resultado (até 8 s) e mostra o mesmo (barra, `×n`, quem copiou, as gemas voando nos HUDs) **sem aplicar regra**: o `estado` dele só muda quando a arena sincroniza no fim da rodada. Sem resultado (o host sumiu), mostra "erro ao copiar".

**O outro sumiu**: toda espera tem timeout e o `parar()` (cena trocada por `game/rede.js` quando a sala cai) solta todas; o `rodar()` sempre resolve.

### Contrato entre a arena (B) e o duelo (C)

- A arena cria `new Duelo(arena, { ..., rede })` / `new Copia(arena, { ..., rede })` com `rede = emRede() ? { canal, meuLado: meuLado(), souHost: souHostDaRede(), rodada } : null`. Com `rede: null` tudo funciona como antes (local e contra a CPU).
- Em rede, o duelo só chama `arena.acertou(j, dano)` para `j === meuLado` (o coração daqui). A arena (B) manda o `dano` para o outro PC e aplica o dano que chega dele. O duelo nunca aplica dano no coração do outro (o `dueloDano` dele é só enfeite e placar do duelo).
- O `dano` da arena precisa ir pelo canal confiável (`canal.enviar`): assim ele chega antes do `dueloFim` de quem levou, e o HP no fim do duelo é igual nos dois.
- `arena.nocaute(j)` e `duelo.nocaute(j)` continuam como estão: a arena chama quando o HP zera, venha o dano daqui ou de lá.
- O botão A em rede chega como `duelo.atacar(meuLado)` (a Controles já manda todo botão daqui para o meu lado); o duelo ignora o A do outro lado.
- Na cópia, o convidado não muda o `estado`: a arena sincroniza no fim da rodada (o HUD dele já mostra a energia certa pela animação).

## Testando

- `ONLINE=1 npx vite --port <porta> --strictPort` liga o jogo com o lobby online.
- Duas abas (dois contextos do Playwright) entram na mesma sala pelo código. No host, `debugRede.iniciar('PvpArena', { p1: 'kris', p2: 'susie' })` abre a arena em rede nos dois, pulando as telas antes.
- `debugRede.atraso(150, 50)` nas duas abas simula internet ruim (150 ms + até 50 de variação em cada sentido). **Todo o PVP precisa funcionar assim**: o coração de cada um responde na hora, e só o que vem do outro chega atrasado.
- `window.pvpArena` (dev) tem `estadoDebug()`, `forcarMao`, `setHp`, `forcarBonus(id)`.
- Os testes `npm test` continuam passando; a lógica pura nova ganha teste em `__tests__`.
