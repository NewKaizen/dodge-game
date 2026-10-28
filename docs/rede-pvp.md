# Partida em rede (cada um joga no próprio PC)

Numa sala (LAN ou ONLINE), nos dois modos (**PVP** e **CO-OP**), o jogo roda **nos dois PCs**. Cada um desvia na própria caixa sem atraso nenhum; pela rede vão só as decisões (carta escolhida, dano levado, resultado da rodada) e a posição do coração para desenhar a caixa do outro. A maior parte deste documento é do PVP; as regras de autoridade valem para os dois modos, e as telas do CO-OP em volta da arena estão em [Telas do CO-OP](#telas-do-co-op-em-volta-da-arena). (O CO-OP numa sala usava o "Remote Play": o jogo só no host e a imagem para o convidado. Não é mais usado, [lan.md](lan.md).)

## Peças

| Peça | O quê |
| --- | --- |
| `src/lib/lan/canal.js` | O canal da partida (lógica pura, testada): mensagens **confiáveis em ordem** (`enviar`/`receber`/`ao`) e **rápidas** (`enviarRapido`, a última vale). As confiáveis vão numeradas dentro de uma **sessão** de quem manda e ganham **recibo** (`_ok`); sem recibo em 1 s vão de novo (uma que se perdeu no WebRTC fechando ou no servidor não trava a partida). Parceiro novo, ou o mesmo que saiu e voltou: `reiniciar()` abre outra sessão, do 0 (antes a numeração continuava e o outro esperava a mensagem 0 para sempre: tela preta no convidado). O **reenvio** (e o recibo de uma repetida) vai sempre **pelo servidor**, o caminho garantido: um canal direto aberto que não entrega nada não trava a troca de cena. |
| `src/lib/lan/vigiaDireto.js` | O canal direto está entregando? (lógica pura, testada). Com o WebRTC aberto, cada lado manda um `_vivo` pelo direto a cada 1 s e o outro responde `_vivoOk` **pelo servidor**; sem resposta há 3,5 s o direto está **mudo** e `enviarRapido` (`lib/lan/transmissao.js`) manda tudo pelo servidor até ela voltar. Visto com o convidado no **Brave com os escudos ligados**: o canal abria, o host mandava a cena por ele e o convidado nunca recebia (tela parada). |
| `src/game/rede.js` | Liga o canal no transporte (WebRTC direto, ou o servidor quando ele falha), diz se a partida é em rede (`emRede()`), qual é o meu lado (`meuLado()`: host 0, convidado 1) e faz o host mandar nas trocas de cena (`irParaCena`). Vigia a sala: se o outro sai no meio, cada um volta ao lobby (ou ao menu, se a sala caiu); quando o parceiro muda, reinicia a sessão do canal. Se alguém **cai** no meio, segura a partida e a retoma no começo da rodada ([Fase 2D](#queda-de-conexão-no-meio-da-partida-fase-2d)). O convidado parado 20 s na tela preta (a cena do host não chegou) sai da sala com o aviso "não deu para sincronizar com o host: voltando ao lobby". |
| `src/lib/lan/religar.js` | Recuperação de conexão (Fase 2D, lógica pura, testada): as tentativas de voltar com espera crescente dentro da janela de 20 s, a chave de retomada no `sessionStorage` (por aba) e o texto do aviso. Ver [Queda de conexão no meio da partida](#queda-de-conexão-no-meio-da-partida-fase-2d). |
| `src/game/religando.js` | A cena `Religando`: o aviso por cima da partida parada ("o outro jogador caiu — esperando até 20 s…" / "reconectando…", com a contagem). |
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

- **Lobby** (`Lan.js`): o **COMEÇAR PARTIDA** do host marca a partida (`iniciarPartida()`) e, depois do "VALENDO!", faz `irParaCena(this, 'PvpEscolha')` (no CO-OP, `'EscolhaParty'`). O convidado vê o "VALENDO!" quando a sala aparece marcada e espera a cena chegar (a tela ASSISTINDO do "Remote Play" não existe mais). Se o convidado sai nesse meio-tempo, o host fica no lobby.
- **PvpEscolha**: `cursor` com `{ tela: 'escolha', indice }` (índice na grade) a cada movimento e de novo a cada 300 ms (quem abriu a tela depois do outro, ou perdeu uma rápida, acerta em seguida). Confirmar manda `personagem` e é definitivo. **B antes de alguém confirmar** volta os dois ao lobby: no host é `irParaCena(this, 'Lan')`; no convidado vai `voltarLobby` e o host faz o mesmo (com alguém confirmado, B só faz o som de erro). Com os dois confirmados, cada PC passa o "P1 VS P2" e o host faz `irParaCena(this, 'PvpVoto', { p1, p2 })` (p1 = o do host, p2 = o do convidado).
- **PvpVoto**: `cursor` com `{ tela: 'voto', indice }` (índice nos cartões, o "?" é o último) e `voto` com `{ arena }` (definitivo). O fundo e o painel seguem o **meu** cursor. Só o host conta o tempo e apura: `apuracao` = `{ votos, arena, contagem, empatadas, sorteios }` (os votos que valeram + o resultado de `apurarVotos`); o convidado troca os votos dele por esses (um voto que chegou no host depois do tempo fica de fora) e passa a mesma animação. No fim o host faz `irParaCena(this, 'PvpArena', { p1, p2, arena, semente })`, com uma semente nova (`rede:<hora>`).
- **PvpResultado**: em rede (e em qualquer partida ONLINE) só tem **A: VOLTAR AO LOBBY**. O A do host faz `irParaCena(this, 'Lan')`; o A do convidado manda `voltarLobby` e o host faz o mesmo, mesmo que ainda esteja na animação. A cena Lan do host desmarca a partida (`encerrarPartida()`), e a sala continua aberta para outra partida (o convidado marca **ESTOU PRONTO!** de novo).
- **Imagem parada**: o host não manda vídeo nem som pelo WebRTC, em nenhum modo (`transmissao.js` tira as faixas com `replaceTrack(null)` e solta a captura do canvas; a imagem reserva também para). A conexão continua: o canal de dados direto é o da partida e o ping vem dela. A barra de cima mostra "partida em rede".

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

## Queda de conexão no meio da partida (Fase 2D)

Vale para PVP e CO-OP, LAN e ONLINE, enquanto a sala está **em partida** (da escolha de personagem ao resultado). No lobby e na fila, cair continua tirando na hora.

**Servidor** (`server/lan.js`): o `bemvindo` traz uma **chave de retomada** (`retomada`: 24 bytes aleatórios, uma por conexão, trocada a cada volta). Quem cai fica na sala por **20 s** (`RETOMADA_MS`): o membro vem com `caiu` (ms que faltam) e a partida (o registro do XP) continua com ele. Uma conexão nova com `ola {retomar: chave}` e a **mesma conta** (ou convidado nos dois) ocupa a vaga: é o **mesmo cliente** (mesmo id, mesmo papel, a mesma partida, o mesmo lado no relato do resultado), e o `bemvindo` vem com `retomado: true`. Se o servidor ainda não tinha visto a conexão velha cair, a nova assume e a velha é fechada (nunca dois sockets na mesma vaga; o que a velha mandar depois é ignorado). Chave errada, de outra conta, já usada ou vencida: `retomadaNegada` com o motivo, e a conexão segue como uma nova (fora da sala). No máximo 20 tentativas por minuto por endereço.

**Não voltou em 20 s**: sai como se tivesse saído na hora da queda.
- **Convidado**: abandono, com as regras de sempre (`server/partidas.js`): quem ficou leva a vitória se ninguém relatou; a duração vai até a queda.
- **Host**: sem migração. A sala fecha ("o host não voltou a tempo: a partida acabou sem XP e sem derrota para ninguém") e a partida acaba **encerrada**, `motivo_termino = 'host_caiu'`: ninguém ganha XP nem perde, e ninguém leva crédito de abandono.

**Resultado e queda**: um relato mandado antes da queda vale uma vez (o repetido depois da volta não muda nada). Quem caiu e voltou ainda relata (só quem **saiu** de vez deixa de relatar). Um relato que o cliente tentou mandar com a conexão caída sai na volta, uma vez só.

**Cliente** (`lib/lan/rede.js`): a conexão caiu no meio da partida: o lobby **não sai da sala** (`religando: { ate }`) e tenta voltar sozinho (250 ms, 750 ms, 1,5 s, 2,5 s e depois a cada 3 s) até a janela acabar. O outro caiu: `outroCaiu: { id, nome, ate }` (do `caiu` da sala). A janela acabou sem volta: sai da sala com o aviso "a conexão caiu e não voltou a tempo".

**Jogo** (`game/rede.js`): durante a janela, nos **dois** PCs, as cenas da partida ficam paradas (`scene.pause`), os botões travados e a cena `Religando` mostra quem caiu e a contagem. A partida em rede continua sem pausa fora disso. Na volta:
- **Arena (PVP e CO-OP)**: o **host** volta a partida para o **começo da rodada atual**. O host guarda o **ponto de retomada** no começo de cada rodada, antes de iniciá-la (`ArenaRede.guardarPonto`: o `estado` das regras, que tem HP, energia, mãos, baralhos, a fase do chefe e o RNG, e os extras da arena: estatísticas, último bônus). Ele descarta a sessão do canal do outro (`canal.descartar`: o que ainda estava no caminho era da rodada velha), abre a dele de novo (`reiniciar`) e abre a arena nos dois com `irParaCena` e os dados de sempre mais `retomada` (o ponto). O convidado recebe a `cena` com `retomada: true`, abre outra sessão do canal e os dois trocam o estado novo pelo do ponto (`aplicarRetomada`), pulam a abertura e começam a rodada: a mão sai igual (o RNG é o do ponto). Caiu antes da primeira rodada: a arena começa do zero.
- **Escolha, voto, seleção, dificuldade**: a mesma cena abre de novo nos dois (com os dados com que abriu).
- **Resultado, Vitória, Game Over, lobby**: só continuam de onde estavam (o canal segue a mesma sessão).
- O convidado espera a cena da retomada no máximo 10 s (`ESPERA_CENA_MS`); sem ela, sai da sala com "não deu para sincronizar com o host".
- A conexão direta (WebRTC) não é refeita: se ela não volta sozinha, as mensagens vão pelo servidor (o vigia do canal direto percebe em ~3 s).

| Mensagem | Sentido | Dados |
| --- | --- | --- |
| `ola` | cliente → servidor | `{ ..., retomar?: chave }` |
| `bemvindo` | servidor → cliente | `{ ..., retomada: chave nova, retomado?: true, retomadaNegada?: motivo }` |
| `sala` | servidor → cliente | cada membro com `caiu: ms que faltam \| null` |
| `cena` (canal) | host → conv. | `{ chave, dados: { ..., retomada: { estado, extra } }, retomada: true }` |

Testando: `node --test server/__tests__/retomada.test.js` (a máquina de estados do servidor, com relógio falso), `src/lib/__tests__/religar.test.js`, `canal.test.js` (descartar) e `src/game/pvp/__tests__/retomadaArena.test.js` (o ponto e a mesma mão). Com duas abas: no dev, fechar o WebSocket do lobby de uma delas no meio da rodada (ou deixar o navegador offline por uns segundos) mostra o aviso nas duas e, na volta, a rodada recomeça; fora mais de 20 s, a regra do host/convidado acima.

## Salas de N e host da partida (Fase 5A)

A base para os modos de 3 e 4 (CO-OP 3–4, todos contra todos, 2x2). Nenhum modo novo
ainda: os de 2 (PVP 1x1 e CO-OP de 2) continuam iguais, só passam pelo caminho novo.

**Sala** (`server/lan.js`): o tamanho vem do modo (`MODOS_SALA`: `pvp`/`coop` = 2,
`coop4` e `ffa` 3–4, `2x2` = 4; o `coop4` abre desde a 5B e o `ffa` desde a 5D, o `2x2` ainda é "em breve": a sala aceita, a partida
não abre). Cada membro tem uma **vaga** 0..N-1 (o dono é a 0; quem entra pega a menor
livre). Na partida a vaga não muda (a retomada da 2D volta para a mesma); no lobby, quem
sai faz as outras descerem (0..n-1 sem buracos: num modo de 2 o convidado é sempre a 1).
Pronto é por membro; o dono tira qualquer um (←→ no TIRAR); convites e o link enchem as
vagas livres. O dono não troca para um modo menor que a sala. A fila do JOGAR RÁPIDO
continua 1x1.

**Dono x host da partida.** O **dono** (quem criou) cuida do lobby: modo, tirar,
convidar, COMEÇAR, fechar. O **host da partida** (`papel: 'host'`) é a autoridade e o
centro da estrela. No COMEÇAR o servidor faz a **eleição** (`server/eleicao.js`): manda
`eleicao {id, ms}` a todos, cada um responde `medicao {id, diretos}` (o RTT das ligações
diretas abertas e entregando, `transmissao.medidas()`), e em até 1,5 s (ou quando todos
responderam) decide pelo placar:

- ligação(h, o) = o RTT direto entre os dois (o menor relato) ou, sem direto, o caminho
  pelo servidor: ping(h) + ping(o) + 15 ms;
- atraso de cada par na estrela de h (só ida): h–o = ligação/2; a–b = (ligação(h,a) +
  ligação(h,b))/2 (a → h → b);
- **pontos(h) = (pior par + média dos pares)/2 + 40 ms × quedas de h nesta sala**.

Fica o dono se faltam medidas para ele, se a sala tem menos de 2 ou se o melhor não ganha
dele por mais de **30 ms** (trocar o centro custa religar a estrela); empate entre outros,
a menor vaga. Com 2 jogadores a ligação é a mesma nos dois sentidos: decide a
estabilidade e, no empate, fica o dono. Quem não tem nenhuma medida (sem ping, sem
direto) não concorre. Eleito: o servidor marca a partida, a sala mostra
`eleito {id, nome, motivo}` ("HOST DA PARTIDA: nome" no lobby, "HOST" no cartão) e manda
`comecar {salaId}` só para ele; o Lan dele faz o "VALENDO!" e `irParaCena` como sempre
(os outros veem a sala marcada e esperam a cena). O host **não muda** no meio da partida
nem na revanche (`partida` sem `eleicao` marca na hora, como antes); a próxima partida
saindo do lobby elege de novo. O host eleito saindo no lobby devolve o centro ao dono;
saindo (ou não voltando em 20 s) no meio da partida, a sala fecha como na 2D. A casual
não elege (o host vem da regra do ping da fila).

**Lado e vaga** (`game/rede.js`): `meuIndice()` é a vaga (estável). `meuLado()` continua
o lado dos modos de 2: 0 no host da partida (P1), 1 no convidado. Com a eleição os dois
podem ser diferentes (o eleito pode ser a vaga 1): os modos de 2 usam `meuLado`/
`souHostDaRede`, os de N vão usar `meuIndice` e `participantesDaPartida()` (`{ indice, id,
nome, conta, cor, host, dono, caiu }`, com a cor da vaga de `game/vagas.js`).

**Transporte em estrela** (`lib/lan/transmissao.js`): o host tem um `RTCPeerConnection`
por convidado (canal de dados, vigia do canal mudo e ping de cada um); o convidado só tem
o do host. Sem direto (ou direto mudo) com alguém, as mensagens dele vão pelo servidor,
que repassa em estrela: do convidado só para o host; do host para todos ou para um
(`para {dados, a}`). **Um convidado nunca fala com outro**: o host repassa o que for
preciso. A imagem do antigo "Remote Play" saiu (ninguém mostrava mais nada).

**Canal** (`lib/lan/canal.js`, com `destinos`): uma sessão, numeração e recibos **por
parceiro**; `enviar` = para todos (uma cópia numerada para cada um), `enviarPara(id, ...)`
para um, `receber(tipo, chave, { de })`, `ao(tipo, fn(dados, chave, de))`. A rápida igual
para todos sai uma vez só (`enviarTodos`: o direto de cada um, ou uma mensagem só pelo
servidor). Um convidado lento ou caído não segura os outros: o reenvio é por parceiro.

**Troca de cena** (`lib/lan/sincCena.js`): `irParaCena` manda `cena {chave, dados, n}`;
cada convidado responde `cenaOk {n, chave}` ao abrir. O host sabe quem está na cena e quem
atrasou (`sincCena.estado()`, `debugRede.sinc()`). A tela preta de 20 s continua por
convidado (cada um sai sozinho se a cena não chega).

**Queda numa sala de 3 ou 4**: caiu um **convidado**: a partida dos outros não para
(Religando só aparece para ele); só a vaga dele espera os 20 s e depois sai (abandono,
como sempre). Voltou: o host manda a cena atual **só para ele** (`dadosRetomadaPara(id)`
da ponte da arena, quando o modo tiver; senão os dados com que a cena abriu) e recomeça a
sessão do canal dele. Caiu o **host** (ou fui eu que caí): todos param, como na 2D. Salas
de 2: tudo como antes.

| Mensagem | Sentido | Dados |
| --- | --- | --- |
| `partida` | dono → servidor | `{ valor: true, eleicao: true }` (o COMEÇAR da sala de amigos) |
| `eleicao` | servidor → todos | `{ id, ms }`: mande as medidas |
| `medicao` | todos → servidor | `{ id, diretos: { idDoMembro: rtt } }` |
| `comecar` | servidor → host eleito | `{ salaId }` |
| `sala` | servidor → todos | `{ ..., max, dono, eleicao, eleito, membros: [{ ..., vaga, papel, dono }] }` |
| `cena` (canal) | host → conv. | `{ chave, dados, n, retomada? }` |
| `cenaOk` (canal) | conv. → host | `{ n, chave }` |

Testando: `node --test server/__tests__/salaN.test.js server/__tests__/eleicao.test.js
src/lib/__tests__/estrela.test.js server/__tests__/partidasN.test.js`. No navegador (dev),
com 4 abas: o dono escolhe `CO-OP 3–4` (já abre; os "em breve" `ffa` e `2x2` no dev podem ser escolhidos),
os outros entram pelo código; `pedirPartida()` (de `lib/lan/rede.js`) faz a eleição sem
abrir cena; no host, `irParaCena(cena, 'Config')` e `debugRede.sinc()` mostram as
confirmações; `debugRede.carga({ segundos, hz })` nas 4 abas mede o tráfego (abaixo).

## Orçamento de performance (Fase 5A)

Medido com 4 abas do Chromium (Playwright, `--use-gl=swiftshader`) numa sala de 4 no
mesmo PC, servidor de dev local (`ONLINE=1 vite`), com `debugRede.carga({ segundos: 10,
hz: 30 })` nas quatro ao mesmo tempo: cada convidado manda o coração 30 vezes por segundo
(rápida) e um `dano` confiável a cada 2 s; o host junta os quatro corações e manda **um
pacote** por tick para todos (a rápida igual para todos) e repassa cada `dano` para cada
convidado (confiável, com recibo). É o tráfego de uma rodada de esquiva do CO-OP 3–4 com
o host como centro (o PVP de 2 de hoje manda ~30 corações/s de cada lado). Script:
`quatro.cjs` (no scratchpad da sessão; cria a sala, faz a eleição, troca de cena com
confirmação, mede e derruba um convidado).

| | Direto (WebRTC com os 3) | Só pelo servidor (sem WebRTC) |
| --- | --- | --- |
| Host: mensagens/s mandadas · recebidas | 97 · 103 | 36 · 97 |
| Host: banda mandada | 25,8 KB/s (pelos 3 diretos) | 9,1 KB/s (o pacote sai **uma vez** e o servidor repassa) |
| Convidado: mandadas · recebidas | 32 · 34 por s (3,8 KB/s · 8,6 KB/s) | igual, pelo servidor |
| Servidor (relé) por sala de 4 | ~1 KB/s (sinais, `_vivoOk`) | entra ~20 KB/s (host 9 + 3 × 3,8), sai ~37 KB/s (3 × 8,6 + recibos/danos ao host 11) ≈ **0,5 Mbit/s** |
| CPU do host (thread principal) | +1,3 pontos (4,0% → 5,3% com o jogo dormindo) | +2,7 pontos (3,0% → 5,7%) |
| Eleição (do COMEÇAR à sala marcada) | 0,4–1,2 s | 0,9 s |

- A CPU da rede é pequena perto do desenho: com o jogo desenhando o lobby, a thread
  principal já fica em ~98% no swiftshader (GL por software). Num PC fraco o gargalo é o
  desenho, não a estrela. A conta de 4 corações na tela e 3 caixas espelho é da 5B.
- Sem o pacote junto, o host mandaria 4 corações × 3 convidados = 360 msg/s; juntando, são
  90/s (30/s por convidado). **Regra para a 5B: o host junta o estado rápido de todos num
  pacote por tick.**
- Pelo servidor, o custo de uma sala de 4 é ~0,5 Mbit/s e ~130 msg/s no servidor: o plano
  grátis do Render aguenta algumas salas dessas, não centenas. A rota direta tira quase
  tudo do servidor; por isso o vigia de cada ligação continua valendo.
- TURN: hoje o relé do servidor é o caminho garantido (funciona sempre, com +1 ida e volta
  ao servidor). Um TURN só vale a pena quando houver muitas salas de 4 pelo relé (custo de
  banda do servidor) ou quando o atraso pelo servidor (ping do host + ping do convidado)
  passar de ~150 ms para muita gente; dá para ligar sem mudar código (`TURN_URL`, `TURN_USUARIO`, `TURN_SENHA`, docs/online.md).

## Telas do CO-OP em volta da arena

Lobby → `EscolhaParty` → `Selecao` (chefe) → `Dificuldade` (nível) → `CoopArena` → `Vitoria` / `GameOver` → lobby. As mesmas regras de autoridade: o host troca as cenas (`irParaCena`), o convidado pede. Fora da sala tudo é como antes (1 jogador + CPU, 2 jogadores no mesmo PC).

| Tipo | De → para | Dados |
| --- | --- | --- |
| `cursor` (rápida) | os dois (`party`) / host → conv. (`chefe`, `nivel`) | `{ tela, indice }`: `tela` = `'party'` (índice na grade de personagens), `'chefe'` (em `ORDEM_CHEFES`) ou `'nivel'` (em `ORDEM_NIVEIS`) |
| `personagem` | os dois | `{ id }`: confirmei este personagem da party |
| `confirmou` | host → conv. | `{ tela, indice }`: o host confirmou o chefe (`'chefe'`) ou o nível (`'nivel'`) neste índice |
| `voltarLobby` | conv. → host | `{}` (como no PVP: B na EscolhaParty antes de alguém confirmar, A na Vitoria/GameOver) |

- **EscolhaParty**: cada PC escolhe o personagem do **próprio** lado (`meuLado()`). O cursor vai como `cursor` `{ tela: 'party' }` a cada movimento e de novo a cada 300 ms; confirmar manda `personagem` e é definitivo. Na party não pode repetir: se os dois confirmam o **mesmo** ao mesmo tempo, **vale o do host** (a regra é a mesma nos dois PCs: o host ignora o `personagem` do convidado igual ao dele; o convidado, quando chega o do host igual ao seu, perde o dele e vê "o P1 pegou ... primeiro: escolha outro"). B antes de alguém confirmar volta os dois ao lobby (no convidado, `voltarLobby`). Com os dois confirmados, cada PC grava a party no registry e o host faz `irParaCena(this, 'Selecao', { party: [p1, p2], chefe })` (`chefe`: o da última luta no host, para os dois cursores começarem no mesmo lugar).
- **Selecao** e **Dificuldade**: quem escolhe é o **host**. O cursor dele vai como `cursor` (`'chefe'` / `'nivel'`, a cada movimento e a cada 300 ms) e o A como `confirmou`, para o convidado passar a mesma confirmação (na Dificuldade, a mesma entrada na batalha). A/B do convidado só fazem o som de erro (o texto da tela diz que o host está escolhendo). B do host volta uma tela nos dois: Selecao → `irParaCena(this, 'EscolhaParty')`; Dificuldade → `irParaCena(this, 'Selecao', { chefe, party })`. A do host: Selecao → `irParaCena(this, 'Dificuldade', { chefe, party, nivel })`; Dificuldade, no fim da entrada → `irParaCena(this, 'CoopArena', { chefe, nivel, party: [p1, p2], semente: 'rede:<hora>' })` e a cena `Entrada` por cima. No convidado a `Entrada` abre quando a `cena` da arena chega (a Dificuldade escuta a `cena` e põe a `Entrada` na fila do gerenciador de cenas, que roda depois da troca).
- **A party vai nos dados da cena** (o registry é de cada PC): `Selecao`, `Dificuldade` e `CoopArena` recebem `party`. A `Selecao` e a `Dificuldade` também gravam a party que chegou no registry `'party'` (a `Vitoria` desenha a party do registry). Fora da rede a party também vai nos dados (sempre: sem dados o Phaser repete os da última vez que a cena abriu).
- **Vitoria** e **GameOver**: em rede (e em qualquer partida ONLINE) só tem **A: VOLTAR AO LOBBY**, como na `PvpResultado`. Quem abre as duas nos dois PCs é a arena, com `irParaCena` e os dados de sempre (`{ chefe, estatisticas }`; o GameOver também `hpChefe`, `hpMaxChefe`). O A do host faz `irParaCena(this, 'Lan')`; o do convidado manda `voltarLobby` e o host faz o mesmo, mesmo no meio da animação.

## Testando

- `ONLINE=1 npx vite --port <porta> --strictPort` liga o jogo com o lobby online.
- CO-OP: com a sala no CO-OP, `debugRede.iniciar('EscolhaParty')` (ou `'CoopArena', { chefe, nivel, party: [p1, p2] }`) no host abre a tela nos dois; `debugJogo.dadosCena('CoopArena')` nas duas abas mostra os dados que chegaram.
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

## CO-OP de 3 e 4 em rede (Fase 5B)

O `PROTOCOLO` subiu para **9** (`server/lan.js` e `lib/lan/rede.js`): o `coop4` deixou de ser "em breve" e passou a registrar XP; um cliente velho não entra mais na sala.

A `CoopArenaN` (`scenes/CoopArenaN.js`) e a ponte dela (`coop/ArenaRedeCoopN.js`) são o CO-OP de 3 e 4 sobre a estrela da 5A. As
regras de autoridade são as do CO-OP de 2 (o **host da partida decide toda regra**: a carta do chefe, a mira, a resolução, o
contra-ataque, a fase e o fim; **cada PC é dono do PRÓPRIO coração**: anda e colide aqui e manda o que lhe aconteceu), mas
**um convidado nunca fala com outro**: o que um precisa ver do outro passa pelo host, que repassa. A ponte é lógica pura
(sem Phaser) e testada com canais de verdade numa estrela em memória (`coop/__tests__/redeN.test.js`).

| Tipo | Chave | De → para | Dados |
| --- | --- | --- | --- |
| `inicio` | rodada | host → todos | `{ estado, eventos }`: o host marca quem caiu da rede / saiu (`definirPresenca`), tira a carta do chefe e a **mira** (rodízio) |
| `jogada` | rodada | conv. → host | `{ jogada, r }`: a minha carta (ou `null`); uma por rodada |
| `pronto` | rodada | host → todos | `{ j, r }`: o jogador `j` já escolheu (o PRONTO do cartão; ninguém vê a carta antes da revelação) |
| `resolucao` | rodada | host → todos | `{ jogadas, resultado, estado }`: o host espera as jogadas de **quem está** (até o relógio + 4 s; quem não jogou a tempo ou caiu da rede passa) |
| `coracao` (rápida) | | conv. → host | `{ x, y, r }`: o MEU coração no quadro |
| `coracoes` (rápida) | | host → todos | `{ r, c: [[vaga, x, y], ...] }`: **um pacote por tick** com todos os corações (5A: "o host junta o estado rápido num pacote") |
| `dano` / `graze` | | dono → host → todos | `{ lado, dano \| n, r }`: o host confere que `lado` é a vaga de quem mandou, repassa na mesma ordem e aplica; o dono não aplica de volta |
| `fimEsquiva` | | dono → host → todos | `{ acertos, ko, lado, r }`: o quadro acabou aqui; o dano e o graze do dono chegam antes (canal em ordem) |
| `contra` · `fimRodada` | rodada | host → todos | como no CO-OP de 2; `fimRodada` traz `resgatados` (rodada limpa) |
| `resultadoPronto` | rodada | conv. → host | a animação do fim acabou; o host espera os convidados que estão e abre a `Vitoria`/`GameOver` |
| `debug` (dev) | | todos | `forcarMao`/`setHp`/`setEnergia`/`setHpChefe` valem em todos os PCs |

Fim da esquiva: cada PC espera o `fimEsquiva` de todos que estavam no quadro e **não esperam quem caiu da rede** (até 15 s
no máximo); o host só calcula os golpes depois (todo dano dos outros já chegou). Antes da arena, a `EscolhaPartyN` usa
`cursor` (rápida, ao host), `personagem {id}` (o pedido), `partyEstado {c, k}` (rápida, do host a cada 250 ms: a party de
verdade e os cursores) e `voltarLobby`.

**Queda de um convidado na luta** (5A: `dadosRetomadaPara`): a sala segue; o host marca `ausente`, **derruba o jogador na hora** (HP 0: volta caído, sem escapar do dano do chefe) e ninguém espera por ele.
Quando ele volta, o `game/rede.js` manda a cena só para ele, com `retomada: { estado (o de agora do host), entrando: true }`: a
arena dele troca o estado, mostra a luta como está e **só entra na rodada seguinte** (espera o `inicio` depois do estado que
recebeu e ignora `dano`/`graze`/`fimEsquiva` das rodadas até ali) ainda **caído**, com o aviso "voltou caído: precisa de resgate" (evento `voltouCaido`). Quem esgota os 20 s sai (`saiu`).

**Orçamento (5A) na prática**: o pacote `coracoes` sai uma vez por tick para todos (~30/s), cada convidado manda ~30
`coracao`/s ao host, e os `dano`/`graze`/`fimEsquiva` são confiáveis (poucos por rodada), como na carga de teste da 5A. O desenho
(4 corações com forma e nome, 4 cartões de HUD, 3 caixas espelho que não existem: o quadro é um só) é o gasto de CPU: o HUD é
um `container` de gráficos simples e só a MINHA mão tem 5 cartas na tela.

Testando: `node --test src/game/coop/__tests__/redeN.test.js src/game/coop/__tests__/grupoN.test.js src/game/coop/__tests__/partyN.test.js`.
No navegador (dev), com 4 abas: o dono cria a sala, `mudarModo('coop4')`, os outros `entrarCodigo`, `alternarPronto()` e `pedirPartida()`
(o host eleito faz o "VALENDO!" e abre a escolha de party); depois **Espaço** em cada aba confirma o personagem (a 1ª tecla
de A/B/C só acorda o teclado: aperte Q uma vez antes), o host escolhe o chefe e o nível. `debugJogo.set({ acelerar: 3, invencivel: true })`
acelera a luta; `coopArena.setHpChefe(0)` no host termina na rodada seguinte; `coopArena.setHp(j, 8)` leva a party à derrota;
`coopArena.estadoDebug()` mostra a mira, os corações (`espelho`, `mirado`), os `prontos` e o estado de cada jogador.

## Todos contra todos (Fase 5D)

O `PROTOCOLO` subiu para **10** (`server/lan.js` e `lib/lan/rede.js`): o `ffa` deixou de ser "em breve", registra XP e o relato
`resultado` aceita `colocacoes` (as vagas do 1º ao último). Um cliente velho não entra mais na sala.

A `PvpArenaN` e a ponte dela (`pvp/rede/ArenaRedeN.js`, que **estende** a `coop/ArenaRedeCoopN.js`) usam a estrela da 5A com as
mesmas regras de autoridade: o **host da partida decide** o rodízio, a resolução, o ataque inteiro de quem está sem conexão, a
eliminação e o fim; **cada PC é dono do PRÓPRIO coração**. A diferença para o CO-OP 3–4 é que há **uma caixa por jogador**
(`pistas[vaga]`): cada PC roda todas as caixas com a mesma semente (`<semente>:<rodada>:<vaga>`); a minha é de verdade e as dos outros
são espelho (`pista.espelho`), com o coração de cada uma andando pelo pacote `coracoes` que o host junta (um por tick para todos).

| Tipo | Chave | De → para | Dados |
| --- | --- | --- | --- |
| `inicio` | rodada | host → todos | `{ estado, eventos }`: o estado traz `alvos` (o rodízio, anunciado antes da escolha) e `ausentes`; eventos `voltou {j}` / `saiu {j}` |
| `jogada` · `pronto` · `resolucao` | rodada | como no CO-OP 3–4 | o host espera só quem está **vivo e com conexão** (`precisaJogar`) |
| `coracao` / `coracoes` (rápidas) · `dano` · `graze` · `fimEsquiva` | | como no CO-OP 3–4 | `dano {lado, dano, r}`: o acerto no coração da vaga `lado`; cada PC credita o dano a quem mandou a caixa (`caixas[lado].de`) |
| `fimRodada` | rodada | host → todos | `{ estado, eliminados, fim, restam, ausentes: [{ j, dano }] }` |
| `resultadoPronto` | rodada | conv. → host | o replay acabou aqui; o host abre a `PvpResultadoN` em todos |
| `escolhaFim` / `aceiteFim` / `voltarLobby` | | conv. → host / host → todos | o fim da 2E para N: cada vaga escolhe; o host repassa `{ escolhas }` e, com todos de acordo, leva todos |

**Queda:** um convidado que cai não para os outros (5A). O host o trata como **ausente**: ninguém espera a jogada nem o
`fimEsquiva` dele, a caixa dele não abre ("SEM CONEXÃO: leva o ataque inteiro") e no fim da rodada o host aplica o ataque inteiro
(`aplicarAusente`); a energia da rodada ele não ganha. Voltou: `dadosRetomadaPara` (o estado de agora, `entrando`) e ele entra na
rodada seguinte com o HP que tem. Não voltou em 20 s: o host o **elimina no tick em que a vaga sai** (`eliminarFfa 'saiu'`, colocação
daquele momento). O host que cai: todos param e a rodada recomeça na volta (2D: `guardarPonto` no começo de cada rodada).

Testando: `node --test src/game/pvp/__tests__/ffa.test.js src/game/pvp/__tests__/redeFfa.test.js src/game/pvp/__tests__/fimDePartidaN.test.js
server/__tests__/ffaXp.test.js`. No navegador: ver o fim de [pvp-regras.md](pvp-regras.md#todos-contra-todos).

## Escolha às cegas no online

O `PROTOCOLO` subiu para **12** (`server/lan.js` e `lib/lan/rede.js`): a `resolucao` passou a levar as jogadas e as cartas de verdade. Regra em
[pvp-regras.md](pvp-regras.md#escolha-às-cegas-no-online); lógica em `pvp/sigilo.js`.

O host sabe tudo (roda as regras), mas **até as jogadas travarem nenhuma mensagem leva ao convidado o id de uma carta do host**; a mão, o monte e o descarte dos outros nunca vão de verdade:

| Mensagem | O que vai |
| --- | --- |
| `jogada` do host (antes de travar) | a **ficha** da carta (a carta virada que sai da mão do host); a do convidado vai só ao host |
| `inicio` / `resolucao` / `fimRodada` (`estado`) | `mascararEstado(estado, vaga)`: a mão, o monte e o descarte dos outros viram `{ id: ficha, oculta: true, personagem }` (só a contagem e a ordem servem); o RNG dos baralhos dos outros e o das regras vão como `{ s: 0 }`; o `historico` leva fichas no lugar dos ids que não são do convidado |
| `resolucao` (travadas) | `jogadas`: as de verdade. `resultado` (`mascararResultado(r, vaga)`): `jogadas[j].carta`, `caixas[k].carta`, `trocas` e `armas[j].carta` dos outros são a **carta real** (`cartaRevelada`) só com o `id` trocado pela ficha (é por ele que a mão virada acha a carta que saiu); `efeitos[j]` dos outros (compradas, roubada) com fichas |
| `cena` (`irParaCena`, retomada 2D e volta de vaga 5A) | `mascararCenaPara(dados, id)`: `retomada.estado` visto por quem recebe |

- **1x1** (`pvp/rede/ArenaRede.js`): um convidado só; o convidado não refaz o `iniciarRodada` para conferir (o estado dele não tem as cartas do outro).
- **Todos contra todos** (`pvp/rede/ArenaRedeN.js`): o `inicio`, a `resolucao` e o `fimRodada` saem **um por convidado** (`canal.enviarPara`), cada um com a versão daquela vaga.
- **CO-OP de 2** (`coop/ArenaRedeCoop.js`, `esconderCartas = false`) e o PVP local/vs CPU: nada muda.
- **Fichas**: `criarFichas()` no host, por ponte (a mesma carta tem a mesma ficha enquanto a arena existe). Ficha e id não têm relação nenhuma. Na revelação a arena troca a carta virada da mão pela carta de verdade no mesmo lugar (`PvpArena.cartaDeVerdade`).
- **Baralhos**: no começo da partida o host embaralha os montes de novo com `Math.random` (`embaralharEscondido`): com a semente da partida, que viaja na `cena`, o convidado refaria a ordem do baralho do outro.
- Nos **dois** PCs a tela usa o resultado visto daqui (`verResultado`, também no host) e a mão do outro virada (`verMao`).
- O host vê o id da jogada do convidado no fio (ele é quem resolve); a tela dele só mostra "<nome> já escolheu ✓" até a revelação.

Testando: `node --test src/game/pvp/__tests__/sigilo.test.js` (nada de carta do host antes de travar, carta real depois, mão sempre escondida, 1x1 e N).
