# Modo ONLINE (jogar com os amigos pela internet)

Menu → **ONLINE**. É o mesmo lobby do [modo LAN](lan.md), só que o servidor fica na internet: cada um abre o site no próprio PC, de casa.

1. Na primeira vez o jogo pede o **nome de usuário** (fica salvo no navegador; A no nome muda depois).
2. Um cria a sala (**+ CRIAR SALA**) e vira o **host** (P1). A sala ganha um **código** de 5 letras (ex.: `K7QX2`), que aparece na tela e na barra de cima.
3. O amigo escolhe **ENTRAR COM CÓDIGO…** e digita o código (maiúscula ou minúscula, tanto faz).
4. O resto é igual à LAN: chat, **ESTOU PRONTO!**, o host escolhe o modo (PVP/CO-OP) e começa.

As salas online são privadas: não aparecem em lista nenhuma, só entra quem tem o código.

## Como funciona

Igual à LAN (o "Remote Play"): **o jogo roda só no PC do host**; o convidado recebe a imagem e o som por WebRTC e manda os controles pelo servidor. Diferenças no online:

- O servidor manda para os navegadores os servidores **STUN** (e **TURN**, se configurado) que o WebRTC usa para atravessar o roteador de casa.
- A imagem vai com no máximo **4 Mbps** (na LAN são 12): cabe no upload de uma internet de casa comum.
- Se o WebRTC não conectar em 12 s, cai na **imagem reserva** (JPEG pelo servidor, 15 quadros por segundo, sem som).
- O servidor limita mensagens por jogador, salas (500) e conexões (1000), para aguentar ficar aberto na internet.

O atraso que o convidado sente é o caminho host → convidado (em geral 20–80 ms dentro do Brasil). O host joga sem atraso nenhum.

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

### TURN: quando a imagem cai na reserva

Com só STUN, a maioria das conexões de casa funciona. Algumas redes (4G, faculdade, empresa, "NAT simétrico") não deixam os dois navegadores se falarem direto, e aí o convidado fica na imagem reserva, sem som. Um servidor **TURN** resolve: ele repassa o vídeo quando o caminho direto não existe.

Dá para usar um grátis (ex.: o Open Relay da Metered, com cadastro) ou subir o seu (`coturn`). Depois é só preencher, por exemplo:

```
TURN_URL=turn:seu.turn.com:3478,turns:seu.turn.com:443?transport=tcp
TURN_USUARIO=...
TURN_SENHA=...
```

## Problemas comuns

- **"sem conexão com o servidor"**: o servidor caiu ou está acordando (Render grátis). O jogo tenta de novo sozinho.
- **"não achei a sala …"**: código errado, ou o host já fechou a sala (ela some quando o host sai).
- **"imagem reserva (sem som)"**: o WebRTC não passou. Configure um TURN (acima).
- **A imagem congela**: a aba do host precisa ficar visível.
- **Imagem travando**: a internet do host não está dando conta do upload. Feche downloads/streams no PC do host.
