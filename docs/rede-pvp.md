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

Como cada tela usa essas mensagens:

- **Lobby** (`Lan.js`): com o modo PVP, o **COMEÇAR PARTIDA** do host marca a partida (`iniciarPartida()`) e, depois do "VALENDO!", faz `irParaCena(this, 'PvpEscolha')`. O convidado vê o "VALENDO!" quando a sala aparece marcada e espera a cena chegar; no PVP ele nunca fica na tela ASSISTINDO (ela é do CO-OP). Se o convidado sai nesse meio-tempo, o host fica no lobby.
- **PvpEscolha**: `cursor` com `{ tela: 'escolha', indice }` (índice na grade) a cada movimento e de novo a cada 300 ms (quem abriu a tela depois do outro, ou perdeu uma rápida, acerta em seguida). Confirmar manda `personagem` e é definitivo. **B antes de alguém confirmar** volta os dois ao lobby: no host é `irParaCena(this, 'Lan')`; no convidado vai `voltarLobby` e o host faz o mesmo (com alguém confirmado, B só faz o som de erro). Com os dois confirmados, cada PC passa o "P1 VS P2" e o host faz `irParaCena(this, 'PvpVoto', { p1, p2 })` (p1 = o do host, p2 = o do convidado).
- **PvpVoto**: `cursor` com `{ tela: 'voto', indice }` (índice nos cartões, o "?" é o último) e `voto` com `{ arena }` (definitivo). O fundo e o painel seguem o **meu** cursor. Só o host conta o tempo e apura: `apuracao` = `{ votos, arena, contagem, empatadas, sorteios }` (os votos que valeram + o resultado de `apurarVotos`); o convidado troca os votos dele por esses (um voto que chegou no host depois do tempo fica de fora) e passa a mesma animação. No fim o host faz `irParaCena(this, 'PvpArena', { p1, p2, arena, semente })`, com uma semente nova (`rede:<hora>`).
- **PvpResultado**: em rede (e em qualquer partida ONLINE) só tem **A: VOLTAR AO LOBBY**. O A do host faz `irParaCena(this, 'Lan')`; o A do convidado manda `voltarLobby` e o host faz o mesmo, mesmo que ainda esteja na animação. A cena Lan do host desmarca a partida (`encerrarPartida()`), e a sala continua aberta para outra partida (o convidado marca **ESTOU PRONTO!** de novo).
- **Imagem parada**: com a sala no modo PVP o host não manda vídeo nem som pelo WebRTC (`transmissao.js` tira as faixas com `replaceTrack(null)` e solta a captura do canvas; a imagem reserva também para). A conexão continua: o canal de dados direto é o da partida e o ping vem dela. Quando o modo vira CO-OP, a imagem volta sem negociar de novo. A barra de cima mostra "partida em rede" no lugar do estado da imagem.

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

## A arena em rede (parte B)

`PvpArena` cria `pvp/rede/ArenaRede.js` (`this.rede`) quando abre com `emRede()`; sem rede `this.rede` é `null` e tudo é como antes (2 locais e CPU). A `CoopArena` (que estende a `PvpArena`) também entra em rede, com a ponte estendida `coop/ArenaRedeCoop.js`: ver "CO-OP em rede" abaixo. As peças puras (comparar estados, interpolar o coração do outro) ficam em `pvp/rede/sincronia.js`, testadas em `pvp/__tests__/redeArena.test.js`.

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

## CO-OP em rede (a CoopArena)

As telas antes e depois da arena (EscolhaParty, Selecao, Dificuldade, Vitoria, GameOver) são as do CO-OP; a arena abre nos dois com `irParaCena(this, 'CoopArena', { chefe, nivel, party: [p1, p2], semente })` (a `party` vem sempre nos dados: o registry é de cada PC). O CO-OP tem um **quadro único** ([coop-cartas.md](coop-cartas.md)): o chefe joga uma carta por rodada e os dois desviam do mesmo ataque, no mesmo quadro. A `CoopArena` cria `coop/ArenaRedeCoop.js` (estende `pvp/rede/ArenaRede.js`: as esperas, a escolha, o cursor, o `dano`/`graze`, o coração interpolado, o `fimEsquiva` e o `debug` são os mesmos). Sem CPU aliada (são os dois humanos: host P1, convidado P2) e sem pausa.

As mesmas regras de autoridade do PVP:

- **O host decide tudo que é regra**: a carta do chefe (sai do RNG que mora no `estado`, em `iniciarRodadaCoop`), a resolução das jogadas, o contra-ataque (`calcularGolpes`, com o combo), a fase nova do chefe e o fim da luta. O convidado faz as mesmas contas onde dá (só para conferir) e fica com o `estado` do host.
- **Cada PC é dono do PRÓPRIO coração no quadro.** O quadro (a pista 0) tem os dois corações: o meu anda pelo joystick daqui e colide aqui; o do outro tem `coracao.espelho = true` (`pvp/Pista.js`): anda pelas posições que chegam (`coracao`, com `k = 0`, interpolado) e não colide nem grazeia aqui. Quem decide o dano (já com o escudo do dono), os grazes e o desvio perfeito de um coração é o PC dele.
- **O ataque roda nos dois com a mesma semente** (`<semente>:<rodada>:quadro`). Os mirados (`a.alvo()`) olham os dois corações, e o do outro chega um pouco atrasado: o tiro mirado nele pode sair alguns pixels diferente em cada PC (cada um é julgado na própria tela). As escolhas que tentam várias vezes até achar um lugar longe/perto dos corações (`a.pontoLonge`, as bombas, o carrossel) usam `a.isolado()` (`attacks/contexto.js`): gastam sempre um número só da semente, então o resto do ataque continua igual nos dois.
- **Caído**: quem está caído passa sozinho, e o PC dele manda a `jogada` `null` (o outro espera por ela). Quem cai no meio da esquiva some do quadro nos dois (o K.O. vale venha o dano daqui ou de lá).

| Tipo | Chave | De → para | Dados |
| --- | --- | --- | --- |
| `inicio` | rodada | host → conv. | `{ estado, eventos }` depois de `iniciarRodadaCoop` (a carta do chefe já está no `estado`; `eventos`: quem voltou, SUPER do chefe) |
| `jogada` | rodada | os dois | `{ jogada }` (igual ao PVP; o caído manda `null`) |
| `cursor` (rápida) | | os dois | igual ao PVP |
| `resolucao` | rodada | host → conv. | `{ jogadas, resultado, estado }`: `resultado` de `resolverRodadaCoop` (`destino`, `quadro`, `golpes`, `efeitos`...) |
| `coracao` (rápida) | | os dois | `{ x, y, k: 0, r }`: o MEU coração no quadro |
| `dano` | | dono → outro | `{ lado, dano, r }`: o dano por acerto já com o escudo do dono (o outro aplica com `aplicarDanoCoop`) |
| `graze` | | dono → outro | `{ lado, n, r }` |
| `fimEsquiva` | rodada | os dois | `{ acertos, ko }`: o quadro acabou aqui |
| `contra` | rodada | host → conv. | `{ golpes, combo }`: a lista de `calcularGolpes` (com o desempenho dos dois, que já chegou: o `fimEsquiva` do outro vem depois de todo dano/graze dele) e o combo da rodada |
| `fimRodada` | rodada | host → conv. | `{ estado, vencedor, novaFase }` de `fimDaRodadaCoop` |
| `resultadoPronto` | rodada | conv. → host | `{}`: a animação do fim acabou aqui; o host (espera até 20 s) abre a `Vitoria`/`GameOver` nos dois com `irParaCena(this, chave, { chefe, turnos, estatisticas, hpChefe, hpMaxChefe })` (as estatísticas do host valem) |
| `debug` (só no dev) | | os dois | `forcarMao`/`setHp`/`setEnergia`/`setHpChefe` valem nos dois PCs |

Uma rodada: `inicio` → escolha (`jogada`, `cursor`) → `resolucao` → revelação e arremesso iguais nos dois → esquiva (`coracao`, `dano`, `graze`, e os dois trocam `fimEsquiva`) → `contra` → `fimRodada`. O outro saiu no meio: `game/rede.js` tira os dois da cena e toda espera solta (`this.saindo`).

Testando: no host, `debugRede.iniciar('CoopArena', { chefe: 'king', nivel: 'facil', party: ['kris', 'susie'] })` abre a arena nos dois; `window.coopArena.estadoDebug()` traz `rede: { meuLado, souHost, espelhos }` (`espelhos[j]`: o coração j é espelho aqui) e o `quadro`; `forcarMao`/`setHp`/`setEnergia`/`setHpChefe` valem nos dois PCs. Com `debugRede.atraso(150, 50)` nas duas abas o coração de cada um continua respondendo na hora.
