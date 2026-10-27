# Modo ONLINE (jogar com os amigos pela internet)

Menu → **ONLINE**. É o mesmo lobby do [modo LAN](lan.md), só que o servidor fica na internet: cada um abre o site no próprio PC, de casa.

1. Na primeira vez o jogo pede o **nome de usuário** (fica salvo no navegador; A no nome muda depois).
2. Um cria a sala (**+ CRIAR SALA**) e vira o **host** (P1). A sala ganha um **código** de 5 letras (ex.: `K7QX2`), que aparece na tela e na barra de cima.
3. O amigo escolhe **ENTRAR COM CÓDIGO…** e digita o código (maiúscula ou minúscula, tanto faz).
4. O resto é igual à LAN: chat, **ESTOU PRONTO!**, o host escolhe o modo (PVP/CO-OP) e começa.

As salas online são privadas: não aparecem em lista nenhuma, só entra quem tem o código.

### Regras da partida online

- **Sem pausa**: o C (e o Esc) não fazem nada durante a partida (pausar travaria o amigo).
- **Fim da partida** (2E; lógica em `pvp/fimDePartidaRede.js`): menu com **REVANCHE** (mesmos personagens e arena), **TROCAR PERSONAGEM** (os dois voltam à escolha e votam a arena de novo) e **VOLTAR AO LOBBY**. Cada um escolhe e vê na hora quem escolheu o quê ("VOCÊ: …" / "OPONENTE: …") com a contagem de 15 s; com os dois de acordo o host leva os dois (`irParaCena`). Um REVANCHE e um TROCAR vira TROCAR. Sem resposta em 15 s a espera é cancelada e dá para escolher de novo. VOLTAR AO LOBBY vale na hora (o do host leva os dois; o do convidado pede ao host). O host abre uma partida nova no servidor (`encerrarPartida` + `iniciarPartida`) para o XP não repetir o `partidaId`.
- Se o outro sai no meio, quem ficou volta para o lobby da sala (se a sala cai, volta ao menu); para sair no meio, use **Sair da sala** na barra de cima.
- **Queda de conexão no meio da partida** (Fase 2D): a partida para nos dois com o aviso "o outro jogador caiu — esperando até 20 s…" (ou "reconectando…" em quem caiu) e o jogo tenta voltar sozinho. Voltou em até **20 s**: a partida recomeça **no começo da rodada** em que caiu. Não voltou: se foi o convidado, conta como abandono (regras abaixo); se foi o host, a sala fecha e a partida acaba **sem XP e sem derrota** para ninguém. Detalhes em [rede-pvp.md](rede-pvp.md#queda-de-conexão-no-meio-da-partida-fase-2d).

### Ping

- **Durante a partida**, no canto de baixo da tela (aparece também em tela cheia): o ping **entre vocês dois**, que é o que vale no jogo. Verde até 80 ms, amarelo até 150, vermelho acima.
- **Na barra de cima**: "partida em rede", o mesmo ping, por onde a ligação passa (**direto**, **por TURN** ou **pelo servidor**) e o ping de cada um até o servidor.
- **No lobby da sala**: o ping de cada um até o servidor e, embaixo, o ping entre vocês.

## Como funciona

Igual à LAN ([lan.md](lan.md)):

- **PVP e CO-OP: o jogo roda no PC de cada um** ([rede-pvp.md](rede-pvp.md)). Cada um joga no próprio PC sem atraso nenhum; pela rede vão só as decisões (personagem, voto, chefe, nível, carta, dano, resultado) e o que for preciso para desenhar o outro (a posição do coração, o cursor). O host manda nas trocas de tela e nos sorteios.

As mensagens vão por um **canal de dados direto** entre os PCs (WebRTC): não dão a volta pelo servidor, que pode estar em outro país. Só se o WebRTC não conectar é que elas passam pelo servidor. A conexão fica ligada só pelo canal e pelo ping: ninguém manda imagem (a imagem do antigo "Remote Play" do CO-OP não é mais usada, [lan.md](lan.md)). Diferenças no online:

- O servidor manda para os navegadores os servidores **STUN** (e **TURN**, se configurado) que o WebRTC usa para atravessar o roteador de casa.
- O servidor limita mensagens por jogador, salas (500) e conexões (1000), para aguentar ficar aberto na internet.

Ninguém sente atraso no próprio coração: o ping só atrasa o que vem do outro.

### Onde fica o servidor

O Render não tem servidor na América do Sul, e o padrão dele é **Oregon** (costa oeste dos EUA, ~180–250 ms do Brasil). Com as mensagens da partida indo direto, isso só pesa no lobby (e na partida quando o canal direto não abre), mas se for criar o serviço de novo, prefira **Virginia** (US East, ~120 ms). O Render não muda a região de um serviço que já existe: precisa criar outro.

## Subir o servidor

Qualquer lugar que rode Node 20.19+ (ou Docker) e aceite WebSocket. O endereço público do site é o que os amigos abrem.

```sh
npm install
npm run online     # compila e liga o servidor online: http://localhost:5180
npm start          # só liga (o dist/ já compilado), como nas hospedagens
```

### Render (grátis, o mais simples)

1. Crie uma conta em [render.com](https://render.com) com o GitHub.
2. **New → Blueprint** e escolha este repositório: o [`render.yaml`](../render.yaml) já diz tudo (build, `npm start`, `/saude`).
3. Pronto: o site fica em `https://dodge-game-xxxx.onrender.com`. Passe o link para os amigos.

No plano grátis o servidor dorme depois de 15 min sem ninguém; o primeiro acesso demora ~1 min para acordar.

### Docker (Railway, Fly.io, VPS…)

```sh
docker build -t dodge .
docker run -p 5180:5180 dodge
```

A porta vem de `PORT` (as hospedagens já põem) ou `PORTA`.

## Configuração (variáveis de ambiente)

| Variável | Para quê |
| --- | --- |
| `PORT` / `PORTA` | porta do servidor (padrão 5180) |
| `ONLINE=1` | o mesmo que `--online` |
| `STUN_URLS` | STUN separados por vírgula (padrão: os do Google) |
| `TURN_URL`, `TURN_USUARIO`, `TURN_SENHA` | servidor **TURN** (veja abaixo) |
| `METRICAS_MIN` | a cada quantos minutos o servidor escreve a linha `[metricas]` no log (padrão 15 online; `0` desliga). Veja "Métricas" no fim |
| `CONFIAR_PROXY` | `1` (padrão no modo online): o limite por endereço do `/api/avatar` usa o `X-Forwarded-For` do proxy (Render). Fora de proxy, deixe desligado |

### TURN: quando a ligação direta não passa

Com só STUN, a maioria das conexões de casa funciona. Algumas redes (4G, faculdade, empresa, "NAT simétrico") não deixam os dois navegadores se falarem direto: as mensagens da partida passam a dar a volta pelo servidor (ping maior). Um servidor **TURN** resolve: ele repassa os dados quando o caminho direto não existe.

Dá para usar um grátis (ex.: o Open Relay da Metered, com cadastro) ou subir o seu (`coturn`). Depois é só preencher, por exemplo:

```
TURN_URL=turn:seu.turn.com:3478,turns:seu.turn.com:443?transport=tcp
TURN_USUARIO=...
TURN_SENHA=...
```

## Problemas comuns

- **"não deu para falar com o servidor: ele pode estar ligando…"**: o servidor caiu ou está acordando (Render grátis, até ~1 minuto) ou a sua internet caiu. O jogo tenta de novo sozinho.
- **"não deu para confirmar a sua conta: você está jogando como convidado"**: a sessão expirou ou o serviço de contas (Supabase) não respondeu. Saia e entre de novo com o Google; sem isso não há XP.
- **"a conexão caiu e você saiu da fila / da sala"**: no lobby e na fila o servidor tira quem perde a conexão (ninguém fica preso); quando reconectar, procure de novo ou entre pelo código. No meio de uma partida a vaga espera 20 s e o jogo volta sozinho (acima).
- **"a conexão caiu e não voltou a tempo"** / **"não deu para voltar à partida: …"**: passaram os 20 s (ou a sala fechou nesse meio-tempo): a partida acabou para você.
- **"não achei a sala …"**: código errado, ou o host já fechou a sala (ela some quando o host sai).
- **Ping alto**: olhe a barra de cima. Se diz **pelo servidor**, a ligação direta não passou e tudo está dando a volta pelo servidor: configure um TURN (acima). Se diz **direto** com ping alto, é a internet de um dos dois (Wi-Fi fraco, download rolando); cabo ajuda muito.
- **Brave**: com os escudos ligados o canal direto (WebRTC) pode abrir sem entregar nada. O jogo percebe em ~3 s e passa tudo pelo servidor (ping maior, mas joga); se mesmo assim travar, desligue os escudos para este site.
- **A partida parou esperando o outro**: a aba do outro precisa ficar visível (o navegador para o jogo numa aba escondida).


## Amigos e convites (contas)

Quem está logado (docs/supabase.md) ganha o botão **AMIGOS** embaixo do jogo.
Convidado joga normalmente, só não tem amigos.

- **Adicionar**: pela tag (`nome#1234`) ou pelo botão **Adicionar amigo** de quem
  está na sua sala (vale também depois da partida, que volta ao lobby da sala).
  Quem recebe aceita, recusa ou bloqueia. Se os dois se pedirem, vira amizade na hora.
- **Presença**: cada amigo aparece como disponível, em partida ou offline. O
  servidor só mostra isso a quem é amigo dos dois lados e sem bloqueio; quem
  não é amigo (ou foi bloqueado) não vê nada. Logado, a conexão com o servidor
  fica aberta mesmo fora da tela ONLINE para a presença e os convites chegarem.
- **Convite**: **Convidar** leva o amigo para a sua sala (cria uma se você não
  estiver em nenhuma; só o host convida). Ele recebe uma notificação com
  contagem e vale **60 s**; ao aceitar, entra na sala e o host escolhe PVP ou
  CO-OP para dois. Limites: 5 convites por minuto por pessoa e 1 pendente por
  amigo. Só dá para aceitar num menu ou no lobby, nunca no meio de uma partida.
- **Bloquear quem está na sua sala** (Fase 2F): na sala, **fora de partida**, quem
  não é o host sai: bloqueou o convidado, ele é tirado; o convidado bloqueou o
  host, é ele quem sai. Os dois recebem o mesmo aviso ("há um bloqueio entre os
  jogadores"), sem dizer quem bloqueou. **No meio da partida** nada muda: vale
  quando o host volta ao lobby. Também não dá para entrar (pelo código) numa sala
  com alguém bloqueado em qualquer direção, e a revanche da casual fecha a sala.
- **Host com a aba escondida** (Fase 2F): a casual já desiste em 15 s se o host não
  começa. Na sala de amigos, o cliente avisa o servidor (`visivel`) quando a aba
  vai para segundo plano; depois de ~4 s o convidado que já está pronto vê "o
  host está com o jogo em segundo plano" no lobby. Se o convidado ficou pronto
  enquanto o host estava fora, ao voltar o host ganha o aviso "TODOS ESTÃO
  PRONTOS" (a partida nunca começa sozinha numa sala de amigos).
- **Link**: **copiar link da sala** gera `https://<site>/?sala=CODIGO`. Quem
  abre (mesmo sem conta) vai direto para a tela ONLINE e entra na sala; o
  código de 5 letras continua valendo.
- **Protocolo**: o lobby subiu para a versão 3 (hoje 8: a fila do Jogar Rápido, o XP, a recuperação de conexão da 2D e as salas de N da 5A) (`PROTOCOLO` em `server/lan.js`
  e `src/lib/lan/rede.js`): atualize os dois PCs. Mensagens novas: `convidar`,
  `responderConvite`, `amigosMudaram` (cliente) e `presencas`, `presenca`,
  `convite`, `conviteEnviado`, `conviteResposta`, `conviteFim`, `conviteNegado`,
  `amigosAtualizar` (servidor).

## Jogar Rápido (fila casual de PVP 1x1)

Menu → **ONLINE** → **JOGAR RÁPIDO** (a primeira opção). Vale para quem tem
conta e para convidado (convidado joga, mas a partida não dá XP: aviso na tela).

- **Procurando**: a tela mostra o tempo de espera; **B** sai da fila. Sair da
  tela ONLINE, entrar numa sala (criar, código, link) ou aceitar convite de
  amigo também tira da fila.
- **Achou**: aparece o oponente (nome e tag; "convidado" se não tem conta) e
  uma contagem de **10 s**. **A** aceita, **B** recusa. Os dois aceitaram: o
  servidor cria a sala sozinho (PVP, marcada como **casual**) e o host já leva
  os dois para a escolha de personagem, como numa sala normal.
- Um recusou ou deixou o tempo acabar: ele sai da fila; o outro volta a
  procurar **na frente da fila**, com o tempo de espera de antes.
- **CPU**: depois de **30 s** sem ninguém, a tela pergunta "Ninguém por enquanto
  — jogar contra a CPU?". Aceitar sai da fila e abre o PVP local contra a CPU
  (sempre dita como CPU, nunca como pessoa). Dá para continuar procurando.
- **Fim da partida**: **REVANCHE** (os dois precisam aceitar em **15 s**; aí o
  host leva os dois direto para a arena, com os mesmos personagens), **TROCAR PERSONAGEM**
  (como na sala de amigos, pelo canal), **JOGAR NOVAMENTE**
  (sai da sala e volta para a fila) ou **VOLTAR** (menu). Na sala casual, quem
  sai fecha a sala: o outro volta para a tela ONLINE com "o oponente saiu da
  partida" e pode procurar outra.
- Salas de amigos (código, link, convite): o mesmo menu do fim da partida
  (REVANCHE, TROCAR PERSONAGEM, VOLTAR AO LOBBY), sem passar pela fila.

### Regras do servidor (`server/fila.js`, `server/lan.js`)

- **FIFO**, sem rating: do mais antigo para o mais novo, cada um pareia com o
  primeiro compatível depois dele. Não pareia a mesma conta (duas abas; a conta
  também não entra duas vezes na fila) nem quem se bloqueou (em qualquer direção).
- Só entra na fila quem não está em sala e não está na fila; uma conta logada
  espera os bloqueios carregarem.
- **Host da sala casual**: o de menor ping até o servidor, se os dois pings são
  conhecidos e a diferença é de pelo menos **30 ms** (o cliente manda o ping
  também enquanto está na fila); senão, quem **confirmou primeiro**. O servidor
  escreve a escolha no log (`[fila] partida rápida ...`).
- **O host não começou** em **15 s** depois da sala casual nascer (aba dele
  escondida, PC travado): a sala fecha, os dois veem "a partida não começou (o
  host não respondeu): procurando outra" e voltam para a fila (o convidado na
  frente). Não conta abandono, e os dois não pareiam um com o outro por 60 s
  (`CASUAL_INICIO_MS`, `EVITAR_PAR_MS` em `server/fila.js`).
- Desconectar procurando ou com partida achada tira da fila e libera o outro.
  Confirmação atrasada (depois dos 10 s) não vale: "essa partida não vale mais".
- Limite: **30 ações por minuto** (fila, confirmar, revanche) por conexão, além
  do limite geral de mensagens.
- Para a Fase 1D (registro de partidas): a sala casual guarda `casual: true`,
  `participantes` (`usuario` de cada um, ou `convidado: true`) e `criadaEm`
  (o registro de verdade está em "XP, níveis e Coleção", abaixo).

### Protocolo (versão 4)

| Sentido | Mensagem |
| --- | --- |
| cliente → servidor | `fila {acao: 'entrar'\|'sair'}` · `confirmar {id, aceitar}` · `revanche {aceitar}` |
| servidor → cliente | `fila {estado: 'procurando'\|'fora', desde, esperaMs, convidado, motivo}` · `pareado {id, oponente: {nome, tag?, avatar?, nivel?}, expiraEm, restanteMs}` · `pareadoEstado {id, eu, oponente}` · `pareadoFim {id, voltou, motivo}` · `partidaCasual {salaId, host}` · `filaNegada {msg, estado}` · `revanche {estado: 'pedida'\|'aceita'\|'recusada'\|'expirada'\|'indisponivel', de?, expiraEm?, restanteMs?, host?}` |

A sala ganhou `casual` no `sala {...}` e o `fechada` da sala casual vem com
`casual: true`. `PROTOCOLO` subiu para **4** (`server/lan.js` e
`src/lib/lan/rede.js`; hoje **8**, com o XP, a recuperação de conexão e as salas de N): atualize os dois PCs.

### Testar com duas janelas

`ONLINE=1 npm run dev` (ou `npm run online`), abra o jogo em duas janelas (uma
anônima serve de convidado; a outra pode estar logada), aperte uma tecla do jogo nas duas (o teclado liga sozinho), ONLINE → JOGAR RÁPIDO nas duas e aceite com A. Para ver a
oferta da CPU, entre só com uma e espere 30 s.

## XP, níveis e Coleção (Fase 1D)

Quem joga **PVP online com conta** (Jogar Rápido ou sala de amigos) ganha XP no
fim da partida, sobe de nível e libera cosméticos. O **CO-OP de 2 jogadores em
sala** também dá XP (Fase 2F, seção abaixo). Convidado joga igual, mas não
ganha nada ("convidado: crie uma conta para ganhar XP"). CPU e PVP/CO-OP local
(dois no mesmo PC) não dão XP.

**O navegador nunca grava XP, nível nem itens.** O caminho é sempre:

1. O host começa a partida (ou a revanche é aceita): o servidor cria o registro
   (`partidas`, com os dois lados e a conta de cada um, tirada do JWT validado
   no `ola`) e põe o `partidaId` na sala.
2. No fim, **cada** PC manda `resultado {partidaId, vencedorLado, rodadas,
   duracao, personagem}` **uma vez** (o cliente guarda os ids já mandados:
   revanche e cena reiniciando não reenviam; o servidor também ignora repetido).
3. O servidor compara os dois relatos com o que ele mesmo sabe (quando a partida
   começou, quem saiu da sala e quando) e decide (`server/partidas.js`).
4. O banco concede (`conceder_recompensa(partida_id)`, só o servidor chama,
   idempotente) e o servidor manda `recompensa` para cada um.
5. A tela de resultado mostra o painel de XP (barra animada, subiu de nível,
   itens novos, próxima recompensa); A/B pula. Sem resposta em ~5 s, mostra o
   motivo (convidado, partida curta, …) e o XP aparece no perfil quando chegar.

### Política de validação

O "fim" para o servidor é o **primeiro relato** que chega; a duração é medida
pelo **relógio do servidor** (do começo até esse fim), nunca a do cliente.

| Situação | Resultado |
| --- | --- |
| os dois relatam e concordam | **validada**: vencedor = participação + bônus; perdedor = participação; empate = participação para os dois |
| os dois relatam e discordam | **contestada**: só participação para os dois, ninguém leva o bônus; vai para o log do servidor |
| só um relata e o outro continua na sala (ou saiu **depois** desse relato) | **contestada**: quem relatou fica só com a participação; o outro, nada. Um cliente sozinho nunca tira a vitória de quem ainda está lá |
| só um relata e o outro saiu **antes** desse relato | **validada** pelo relato de quem ficou; quem saiu não ganha nada (abandono) |
| ninguém relatou e um saiu no meio | **validada**: vitória de quem ficou (participação + bônus); quem saiu, nada |
| ninguém relatou (os dois saíram ou o prazo acabou) | **encerrada**, sem XP |

- Prazo para o segundo relato: **20 s** depois do primeiro. Quem sai da sala sem
  ter relatado dá **3 s** para o relato do outro que podia estar a caminho.
- "Saiu" = saiu da sala ou desconectou por conta própria. Quem **cai** no meio da partida tem 20 s para voltar (Fase 2D); só depois disso conta como saída, na hora da queda. O host que cai e não volta encerra a partida sem XP e sem derrota (`host_caiu`). Quem foi tirado porque
  a sala fechou (o host caiu, o oponente da casual saiu) ou porque o host o
  expulsou depois da partida não conta como abandono (o relato dele ainda vale).
- Abandono na casual não tira XP de ninguém: quem saiu só não ganha nada naquela partida.
- O host não pode expulsar no meio da partida (não vira "vitória por abandono").
- No máximo **10 partidas registradas por minuto** por host (conta ou convidado):
  ligar e desligar a partida sem parar não enche o banco (a partida segue, sem XP).
- Quem saiu da sala sem ter relatado não relata mais depois (nem pela mesma
  conexão nem por outra aba da conta): conta como abandono.
- Partidas de 3 e 4 (Fase 5A): ver [Partidas de N](#partidas-de-n-fase-5a), abaixo.
- Relato repetido não muda nada; relato atrasado (depois da decisão) recebe a
  resposta que já existe. Reconectar com a mesma conta recebe a recompensa no
  cliente novo. Nada disso concede duas vezes: o banco tem `UNIQUE (partida_id,
  user_id)` em `concessoes` e o servidor decide cada partida uma vez só.

### Regras do XP

| Regra | Valor |
| --- | --- |
| participação (partida jogada até o fim) | **40 XP** |
| bônus de vitória (só com resultado confirmado) | **+20 XP** |
| duração mínima (relógio do servidor) | **60 s**, e pelo menos **2 rodadas** quando o resultado diz |
| contra o mesmo oponente no mesmo dia (fuso de São Paulo) | as **3** primeiras valem tudo, a 4ª e a 5ª valem **metade**, depois **0** até o dia seguinte |
| convidado do outro lado | cada **conexão** de convidado é um oponente diferente no limite (Fase 2F); os convidados do **mesmo endereço (IP) da conta** (a aba anônima dela, ou a mesma casa/escola) continuam contando como um só. Teto de **10** partidas com XP por dia contra convidados, todos somados |
| a mesma conta dos dois lados (duas abas) | **0** |

Salas de amigos contam como a casual, com os mesmos limites. Os números moram
nas funções de constante de `supabase/migrations/0003_progresso.sql` (e
`convidados_limite_dia()` na `0005_pendencias.sql`);
`src/lib/progresso.js` é o espelho em JS (um teste confere os dois e esta tabela).

### XP no CO-OP online (Fase 2F)

O CO-OP de **2 jogadores numa sala** (amigos ou LAN) segue o mesmo caminho do PVP
(`server/partidas.js`): o servidor registra a partida quando o host começa (`modo:
'coop'`), os dois PCs mandam `resultado {partidaId, vitoria, rodadas, duracao,
personagem}` **uma vez** (`vitoria` = o time derrotou o chefe; `rodadas` = turnos
da luta) e o banco concede. As telas **Vitoria** e **GameOver** mandam o resultado
e mostram uma faixa de XP (barra, subiu de nível, item novo) com o mesmo prazo de
~5 s do PVP (depois, "XP a caminho": aparece no perfil). Sem sala (CO-OP local ou
com a CPU) não manda nada e não dá XP.

| Situação | Resultado |
| --- | --- |
| os dois relatam e concordam | **validada**: vitória do time = participação + bônus **para os dois**; derrota do time = participação para os dois |
| os dois relatam e discordam | **contestada**: só participação para os dois |
| só um relata e o parceiro continua na sala | **contestada**: quem relatou fica com a participação; o outro, nada |
| só um relata e o parceiro saiu **antes** do relato | **validada** pelo relato de quem ficou; quem saiu, nada |
| ninguém relatou e um saiu / o host caiu / o prazo acabou | **encerrada**, sem XP (diferente do PVP: no CO-OP quem ficou não "vence" ninguém, a luta não acabou) |
| mesma conta nos dois lados · convidado de parceiro | 0 (a conta ganha normalmente com um convidado de parceiro) |

**Números:** os mesmos do PVP, sem constante nova: **40** de participação +
**20** se o time venceu (a derrota paga só os 40), duração mínima **60 s** e pelo
menos **2** rodadas, medidas pelo servidor. O **parceiro** faz o papel do
"oponente" no limite diário (3 partidas cheias, 2 pela metade, depois 0 com o
**mesmo** parceiro no dia), e a contagem é **separada por modo**: CO-OP com a Ana
não gasta o limite do PVP com a Ana (`conceder_recompensa`, migration 0005; o
PVP continua exatamente como antes).

### Curva de níveis

Para passar do nível N ao N+1: **100 + 25 × (N − 1)** XP (máximo: nível 99).
O `perfis.xp` é o total acumulado.

| Nível | XP total | Para o próximo |
| --- | --- | --- |
| 1 | 0 | 100 |
| 2 | 100 | 125 |
| 3 | 225 | 150 |
| 4 | 375 | 175 |
| 5 | 550 | 200 |
| 6 | 750 | 225 |
| 7 | 975 | 250 |
| 8 | 1225 | 275 |
| 9 | 1500 | 300 |
| 10 | 1800 | 325 |
| 11 | 2125 | 350 |
| 12 | 2475 | 375 |
| 13 | 2850 | 400 |
| 14 | 3250 | 425 |
| 15 | 3675 | 450 |

### Trilha de cosméticos (Coleção)

Todo mundo tem o título **Novato**, a moldura **Simples** e o verso **Clássico**.
Um item por nível, do 2 ao 15: título Esquivador (2), moldura Bronze (3), verso
Estrelado (4), avatar King (5), título Duelista (6), moldura Prata (7), verso
Carmesim (8), avatar Queen (9), título Veterano da Mesa (10), moldura Ouro (11),
verso Dourado (12), avatar Jevil (13), título Cartomante (14), moldura Arco-íris (15).

No perfil: **Coleção…** lista tudo (o que tem e o que falta, com o nível) e
equipa título, moldura, verso e avatar (`equipar(tipo, item)`: o banco confere
se a conta tem o item). O título aparece no perfil e a moldura em volta do
avatar. O **verso equipado aparece nas cartas das partidas** (Fase 2F): o
servidor manda o id do verso de cada jogador no membro da sala
(`conta.verso`) e o cliente o troca pela cor do catálogo (`src/game/pvp/versos.js`,
opção `corVerso` da `Carta`/`Mao`): em rede cada um vê o seu verso nas cartas
do seu lado e o do outro nas dele; id desconhecido ou o verso Clássico ficam
com o verso de sempre (a cor do personagem). Em partida local o P1 usa o de quem
está logado. Cosmético nunca muda nada no jogo.

### Partidas de N (Fase 5A)

A base dos modos de 3–4 (`server/partidas.js`; só dão XP os modos em `MODOS_COM_XP`:
`pvp`, `coop` e, desde a 5B, `coop4`; `ffa` e `2x2` ligam o deles quando a partida existir). O lado de
cada um é a **vaga** da sala (0..3); o host da partida pode ser qualquer vaga
(`hostLado`). Cada cliente relata o desfecho inteiro:

| Modo | Relato | Resultado de cada lado |
| --- | --- | --- |
| `coop4` | `{ vitoria }` | o time inteiro: vitória ou derrota |
| `ffa` | `{ colocacoes: [lado, ...] }` (do 1º ao último, todos os lados, sem repetir) | 1º = vitória, o resto derrota; a colocação vai para o banco |
| `2x2` | `{ vencedorTime: 0 \| 1 \| null }` (time = vaga % 2: 0 e 2 contra 1 e 3) | o time vencedor vitória, o outro derrota; `null` = empate |

**Política (o host decide, conferido pela maioria):** vale o desfecho do **host da
partida** se pelo menos **metade** de quem relatou concorda com ele (o host desempata);
sem relato do host, vale o que **mais da metade** relatou. Nos dois casos são precisos
**2 relatos iguais**; senão, **contestada** (quem relatou: só participação). Um relato
só vale se todos os outros já tinham saído antes dele. Quem saiu antes do primeiro
relato: abandono (nada); quem ficou e não relatou: `sem_relato`. Ninguém relatou:
encerrada (`host_caiu` se o host caiu; com 3 ou mais não há "vitória por abandono").
O XP é o de sempre (participação + bônus de vitória, migration 0006).

**CO-OP de 3 e 4 (`coop4`, Fase 5B)**: a mesma validação (o host decide, a maioria confere; `{ vitoria }` do time inteiro),
com estas regras de XP:

- **participação igual para todos** os que ficaram até o fim e **bônus da vitória do time** para todos (o resultado que
  valeu é o do time, também para quem relatou o contrário); derrota do time = só a participação;
- quem **saiu de vez** (ou não voltou em 20 s) é abandono: nada; quem caiu e **voltou** relata e ganha como os outros;
- o limite diário "por parceiro" é por **par de contas**: o banco (0006) escolhe como "oponente" o 1º outro lado com
  conta (senão o 1º convidado), então o 3º/4º dia de jogo com a mesma dupla cai para metade/zero como no CO-OP de 2
  (`repeticao_cheia` 3, `repeticao_limite` 5 por modo) e um grupo com outra dupla de partida recomeça cheio. Convidado
  conta pelo teto de convidados (10 por dia);
- **duração**: em partidas de 3 e 4 a saída de um convidado **não acaba a partida**; a duração vai até o primeiro relato
  (antes valia até a saída e quem seguia jogando depois de um abandono cedo perdia o XP por "partida curta"), e a
  saída de um não abre mais o prazo da decisão (só o primeiro relato, o host voltar ao lobby ou a sala fechar com o host);
- o host que cai fecha a decisão em ~3 s (`encerrada`, `host_caiu`: ninguém ganha nem perde).

Testes: `server/__tests__/coop4Xp.test.js` (sala, banco falso, o limite por par e as quedas) e `partidasN.test.js`.

### Protocolo (versão 5)

| Sentido | Mensagem |
| --- | --- |
| cliente → servidor | `resultado {partidaId, vencedorLado: 0\|1\|null, rodadas, duracao, personagem}` (PVP) · `resultado {partidaId, vitoria: true\|false, rodadas, duracao, personagem}` (CO-OP) |
| cliente → servidor | `visivel {valor: false\|true}` (a aba foi para segundo plano / voltou; Fase 2F) |
| servidor → cliente | `recompensa {partidaId, xpGanho, xpTotal?, nivelAntes?, nivelDepois?, itensNovos?, motivo}` |

`sala {...}` ganhou `partidaId`; cada membro ganhou `conta.verso` (id do verso equipado ou `null`) e
`segundoPlano` (a aba dele está escondida há mais de ~4 s). `motivo` é um código (`vitoria`, `derrota`,
`empate`, `contestada`, `participacao`, `abandono`, `sem_relato`, `curta`,
`repeticao`, `repeticao_metade`, `convidado`, `mesma_conta`, `host_caiu`, `nao_registrada`,
`indisponivel`, `erro`); o texto para o jogador está em `src/lib/progresso.js`.

### Testar com duas contas

Precisa das migrations 0003 e 0005 (docs/supabase.md). `npm run online` (ou `ONLINE=1
npm run dev`), duas janelas com **contas Google diferentes** (uma normal, outra
anônima ou outro navegador), ONLINE → JOGAR RÁPIDO nas duas e joguem uma partida
inteira (mais de 60 s). No fim, o painel mostra +60 (quem venceu) e +40.
Conferir no Supabase: **Table Editor → partidas** (estado `recompensada`),
`concessoes` (uma linha por conta) e `perfis.xp`. Para ver a Coleção, suba o XP
de uma conta à mão no Table Editor só para testar (ex.: `xp = 600`) e jogue mais
uma: os itens até o nível chegam no inventário.

## Hub e mensagens (Fase 1E)

Conta, amigos e coleção são **cenas do jogo** (Fase 2A; antes eram painéis
Svelte por cima dele): `Perfil`, `Amigos` e `Colecao` em `src/game/scenes/`,
no visual da tela de Configurações e navegáveis só com ↑↓←→ + A/B (C e Esc
voltam). Onde cada coisa fica:

| Quero | Onde |
| --- | --- |
| **Jogar rápido** | menu inicial → **JOGAR RÁPIDO** (1ª opção; entra direto na fila), ou ONLINE → JOGAR RÁPIDO |
| **Jogar com amigos** | ONLINE → **JOGAR COM AMIGOS** (cria a sala e dá o código), **ENTRAR COM CÓDIGO…**, ou **AMIGOS** → A no amigo → **CONVIDAR** |
| **Perfil** | menu inicial → **PERFIL** (ou ONLINE → PERFIL): nome, avatar, foto, **ENTRAR COM GOOGLE**, sair |
| **Amigos** | ONLINE → **AMIGOS** (ou PERFIL → AMIGOS): abas AMIGOS / PEDIDOS / BLOQUEADOS (←→) |
| **Coleção** | ONLINE → **COLEÇÃO** (ou PERFIL → COLEÇÃO): abas por tipo, A equipa |
| **Link da sala** | na sala ONLINE: **COPIAR LINK DA SALA** (também em AMIGOS enquanto há sala) |
| **Denunciar** | **AMIGOS** → A na pessoa → **DENUNCIAR…** (docs/moderacao.md) |

JOGAR RÁPIDO e PERFIL só aparecem no menu inicial onde há conta ou o site está
na internet (`siteNaInternet()` ou contas não `indisponivel`); a LAN sem
internet fica com as cinco opções de antes.

### Avisos dentro do jogo

Por cima de qualquer menu (não nas arenas: esperam na fila e saem quando voltar
a um menu): convite de amigo (**A aceita, B recusa**, com a contagem de 60 s),
pedido de amizade recebido, "o convite tirou você da fila", **+XP** de quem
ficou quando o oponente saiu no meio, e erro da conta (login cancelado). A fila
é `src/game/conta/fila.js` (pura, testada); o desenho e as ligações com as
lojas são `src/game/conta/avisos.js`; `Controles.interceptarBotao` deixa o aviso
pegar A/B antes da cena. A foto do perfil continua em Svelte
(`src/ui/FotoModal.svelte` + `RecorteFoto.svelte`, `src/lib/fotoModal.js`):
seletor de arquivo e recorte precisam de DOM.

Os avisos de conexão (servidor ligando ou lotado, conta não confirmada, queda
na fila ou na sala, oponente que saiu) estão em `src/lib/lan/rede.js` (`MSG_*`) e
nos `motivo` de `server/lan.js`; cada um diz o que fazer em seguida.

## Métricas (Fase 1E)

O servidor guarda **só contadores e tempos agregados, na memória**, e escreve
**uma linha JSON no log** a cada `METRICAS_MIN` minutos (padrão 15) e ao receber
o aviso de desligamento (SIGTERM/SIGINT). Janela sem nada não escreve.

```
[metricas] {"motivo":"periodico","de":"...","ate":"...","contadores":{"logins":7,"fila_pares":3,...},"amostras":{"fila_espera_ms":{"n":6,"p50":4200,"p90":31000,"max":31000}}}
```

| Campo | O que conta |
| --- | --- |
| `conexoes`, `logins` | conexões abertas; contas que entraram (ao conectar ou com o lobby aberto) |
| `reconexoes` | a **mesma conta** voltando em até 2 min depois de cair (a memória do "quando caiu" some em 2 min) |
| `fila_entradas`, `fila_pares`, `fila_pares_desfeitos` | entradas na fila, pares formados, pares que não fecharam |
| `fila_espera_ms` | n, p50, p90 e máximo do tempo esperado até achar par (uma amostra por jogador pareado) |
| `partidas_iniciadas`, `partidas_finalizadas`, `partidas_abandonadas`, `partidas_contestadas` | PVP e CO-OP online registradas (revanche abre outra); abandonada = alguém saiu no meio |
| `partidas_quedas`, `partidas_retomadas` | alguém caiu no meio da partida (a vaga ficou guardada) e voltou a tempo (Fase 2D) |
| `revanches_pedidas`, `revanches_aceitas` | pedidos e aceites duplos |
| `avatar_envios_ok`, `avatar_envios_falha`, `avatar_bloqueios_ip` | fotos que subiram, falharam (imagem ruim, Storage) e pedidos barrados pelo limite por endereço |

**O que NÃO é coletado:** nome, tag, conta, e-mail, endereço IP, código ou id de
sala, conteúdo do chat, resultado de cada partida, qualquer coisa por jogador. Os
nomes aceitos estão numa lista fechada em `server/metricas.js` (qualquer outro é
ignorado) e um teste confere que a linha não carrega token, chat nem IP. As
métricas **não vão para o Supabase nem para terceiros**: ficam no log do Render.
O endereço usado no limite do `/api/avatar` fica só na memória, para contar, e
não é gravado.

