# Modo ONLINE (jogar com os amigos pela internet)

Menu → **ONLINE**. É o mesmo lobby do [modo LAN](lan.md), só que o servidor fica na internet: cada um abre o site no próprio PC, de casa.

1. Na primeira vez o jogo pede o **nome de usuário** (fica salvo no navegador; A no nome muda depois).
2. Um cria a sala (**+ CRIAR SALA**) e vira o **host** (P1). A sala ganha um **código** de 5 letras (ex.: `K7QX2`), que aparece na tela e na barra de cima.
3. O amigo escolhe **ENTRAR COM CÓDIGO…** e digita o código (maiúscula ou minúscula, tanto faz).
4. O resto é igual à LAN: chat, **ESTOU PRONTO!**, o host escolhe o modo (PVP/CO-OP) e começa.

As salas online são privadas: não aparecem em lista nenhuma, só entra quem tem o código.

### Regras da partida online

- **Sem pausa**: o C (e o Esc) não fazem nada durante a partida (pausar travaria o amigo).
- **Sem revanche**: no fim, a única opção é **A: VOLTAR AO LOBBY** (do host ou do convidado): os dois voltam para o lobby da sala (que continua aberta), com o chat, e o host começa outra partida quando quiser.
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
