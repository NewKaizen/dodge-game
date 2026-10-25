# Modo ONLINE (jogar com os amigos pela internet)

Menu → **ONLINE**. É o mesmo lobby do [modo LAN](lan.md), só que o servidor fica na internet: cada um abre o site no próprio PC, de casa.

1. Na primeira vez o jogo pede o **nome de usuário** (fica salvo no navegador; A no nome muda depois).
2. Um cria a sala (**+ CRIAR SALA**) e vira o **host** (P1). A sala ganha um **código** de 5 letras (ex.: `K7QX2`), que aparece na tela e na barra de cima.
3. O amigo escolhe **ENTRAR COM CÓDIGO…** e digita o código (maiúscula ou minúscula, tanto faz).
4. O resto é igual à LAN: chat, **ESTOU PRONTO!**, o host escolhe o modo (PVP/CO-OP) e começa.

As salas online são privadas: não aparecem em lista nenhuma, só entra quem tem o código.

### Regras da partida online

- **Sem pausa**: o C (e o Esc) não fazem nada durante a partida (pausar travaria o amigo).
- **Sem revanche** (fora do Jogar Rápido, abaixo): no fim, a única opção é **A: VOLTAR AO LOBBY** (do host ou do convidado): os dois voltam para o lobby da sala (que continua aberta), com o chat, e o host começa outra partida quando quiser.
- Se o outro sai no meio, quem ficou volta para o lobby da sala (se a sala cai, volta ao menu); para sair no meio, use **Sair da sala** na barra de cima.

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

### TURN: quando a ligação direta não passa

Com só STUN, a maioria das conexões de casa funciona. Algumas redes (4G, faculdade, empresa, "NAT simétrico") não deixam os dois navegadores se falarem direto: as mensagens da partida passam a dar a volta pelo servidor (ping maior). Um servidor **TURN** resolve: ele repassa os dados quando o caminho direto não existe.

Dá para usar um grátis (ex.: o Open Relay da Metered, com cadastro) ou subir o seu (`coturn`). Depois é só preencher, por exemplo:

```
TURN_URL=turn:seu.turn.com:3478,turns:seu.turn.com:443?transport=tcp
TURN_USUARIO=...
TURN_SENHA=...
```

## Problemas comuns

- **"sem conexão com o servidor"**: o servidor caiu ou está acordando (Render grátis). O jogo tenta de novo sozinho.
- **"não achei a sala …"**: código errado, ou o host já fechou a sala (ela some quando o host sai).
- **Ping alto**: olhe a barra de cima. Se diz **pelo servidor**, a ligação direta não passou e tudo está dando a volta pelo servidor: configure um TURN (acima). Se diz **direto** com ping alto, é a internet de um dos dois (Wi-Fi fraco, download rolando); cabo ajuda muito.
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
- **Link**: **copiar link da sala** gera `https://<site>/?sala=CODIGO`. Quem
  abre (mesmo sem conta) vai direto para a tela ONLINE e entra na sala; o
  código de 5 letras continua valendo.
- **Protocolo**: o lobby subiu para a versão 3 (hoje 4, com a fila do Jogar Rápido abaixo) (`PROTOCOLO` em `server/lan.js`
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
  host leva os dois de novo para a escolha de personagem), **JOGAR NOVAMENTE**
  (sai da sala e volta para a fila) ou **VOLTAR** (menu). Na sala casual, quem
  sai fecha a sala: o outro volta para a tela ONLINE com "o oponente saiu da
  partida" e pode procurar outra.
- Salas de amigos (código, link, convite) continuam como antes: sem revanche,
  só voltar ao lobby da sala.

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
- Desconectar procurando ou com partida achada tira da fila e libera o outro.
  Confirmação atrasada (depois dos 10 s) não vale: "essa partida não vale mais".
- Limite: **30 ações por minuto** (fila, confirmar, revanche) por conexão, além
  do limite geral de mensagens.
- Para a Fase 1D (registro de partidas): a sala casual guarda `casual: true`,
  `participantes` (`usuario` de cada um, ou `convidado: true`) e `criadaEm`.

### Protocolo (versão 4)

| Sentido | Mensagem |
| --- | --- |
| cliente → servidor | `fila {acao: 'entrar'\|'sair'}` · `confirmar {id, aceitar}` · `revanche {aceitar}` |
| servidor → cliente | `fila {estado: 'procurando'\|'fora', desde, esperaMs, convidado, motivo}` · `pareado {id, oponente: {nome, tag?, avatar?, nivel?}, expiraEm, restanteMs}` · `pareadoEstado {id, eu, oponente}` · `pareadoFim {id, voltou, motivo}` · `partidaCasual {salaId, host}` · `filaNegada {msg, estado}` · `revanche {estado: 'pedida'\|'aceita'\|'recusada'\|'expirada'\|'indisponivel', de?, expiraEm?, restanteMs?, host?}` |

A sala ganhou `casual` no `sala {...}` e o `fechada` da sala casual vem com
`casual: true`. `PROTOCOLO` subiu para **4** (`server/lan.js` e
`src/lib/lan/rede.js`): atualize os dois PCs.

### Testar com duas janelas

`ONLINE=1 npm run dev` (ou `npm run online`), abra o jogo em duas janelas (uma
anônima serve de convidado; a outra pode estar logada), use o **SIMULADOR
(TECLADO)** nas duas, ONLINE → JOGAR RÁPIDO nas duas e aceite com A. Para ver a
oferta da CPU, entre só com uma e espere 30 s.
