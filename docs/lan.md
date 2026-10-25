# Modo LAN (dois PCs na mesma rede)

Menu → **ONLINE** (com a página servida pelo `npm run lan` o lobby é o da LAN; pela internet, veja [online.md](online.md)). Um PC cria a sala (o **host**, P1, coração vermelho) e o outro entra (o **convidado**, P2, coração amarelo). Vale para o **PVP** e para o **CO-OP**, com todas as telas do jogo.

## Como ligar

Nos dois PCs (Chrome ou Edge):

```sh
npm install
npm run lan        # compila e serve o jogo na rede: http://<ip-do-pc>:5180
```

O terminal mostra os endereços. Dá para fazer de dois jeitos:

- **Cada PC roda o seu `npm run lan`** e abre `http://localhost:5180`. As salas de um aparecem sozinhas no lobby do outro (descoberta por broadcast UDP, porta 47777).
- **Só o host roda.** O outro PC abre no navegador o endereço que o host mostra (`http://192.168.x.x:5180`; ele também aparece no lobby, na sala vazia).

Porta diferente: `PORTA=5181 npm run lan`. Se o Windows perguntar, libere o Node no firewall (rede privada). No desenvolvimento, `npm run dev` também tem o lobby (e `npm run dev -- --host` deixa o outro PC entrar).

## Lobby

- **Salas**: seu nome (A para editar), **+ CRIAR SALA**, as salas achadas na rede (modo, vagas, "JOGANDO") e **CONECTAR POR IP…** (ex.: `192.168.0.10` ou `192.168.0.10:5180`; se o PC de lá tiver uma sala só, já entra nela).
- **Sala**: os dois jogadores com ping e se estão prontos, o **chat** (CONVERSAR) e as ações. O host escolhe o **MODO** (←/→) e começa com **COMEÇAR PARTIDA** quando o convidado marcou **ESTOU PRONTO!**. O host também pode tirar o convidado; **B** sai da sala (no host, fecha a sala).
- Os textos (nome, IP, chat) se digitam pelo teclado: Enter confirma, Esc cancela.
- Música própria: `public/assets/musicas/lobby.mid` (sem ele, a do menu). O nome no canto vem de `ASSETS.tituloMusicaLobby` em `src/game/assets.js`. O `lobby.mid` que está lá é provisório, gerado por `scripts/lobby/gerar_lobby_mid.mjs`.

Na sala, o teclado inteiro de cada um comanda o próprio lado (o host é o P1, o convidado o P2) e o "Jogadores" da barra de cima fica travado. Na partida não tem pausa (pausar travaria o outro). Quando a partida acaba (B na escolha de personagem antes de alguém confirmar, ou o fim da partida), os dois voltam ao lobby da sala, que continua aberta.

## Como funciona

Nos dois modos, **cada um joga no próprio PC** (partida em rede, [rede-pvp.md](rede-pvp.md)). O jogo roda nos dois PCs; pela rede vão só as decisões (personagem, voto, chefe, nível, carta, dano, resultado) e o que for preciso para desenhar o outro (a posição do coração, o cursor). O host manda nas trocas de tela e nos sorteios; no CO-OP é ele quem escolhe o chefe e o nível (o convidado vê o cursor dele andando). No fim, **A: VOLTAR AO LOBBY** (sem revanche).

```
PC do host                         servidor (server/lan.js)                  PC do convidado
jogo inteiro ◀════════ WebRTC direto: canal de dados da partida + ping ════════▶ jogo inteiro
             ◀── sinais do WebRTC; e as mensagens, se o canal direto não abrir ──▶
```

- `server/lan.js`: salas, chat, ping e o repasse das mensagens (WebSocket em `/lan`); anuncia e acha salas de outros servidores por UDP. Troca os nomes `xxxx.local` que o navegador põe nos candidatos do WebRTC pelo IP de verdade (muita rede bloqueia mDNS). `server/index.js` serve o `dist/`; o `vite.config.js` liga o mesmo lobby no `dev`/`preview`.
- `src/lib/lan/rede.js`: conexão com o servidor e o estado do lobby (store `lan`).
- `src/lib/lan/transmissao.js`: a conexão WebRTC direta, com o canal de dados da partida e o ping. Se não conectar, as mensagens vão pelo servidor ("pelo servidor" no ping).
- `src/lib/lan/canal.js` e `src/game/rede.js`: o canal da partida em rede e as trocas de cena ([rede-pvp.md](rede-pvp.md)).
- `src/lib/lan/controleRemoto.js`: na sala, o teclado inteiro é um jogador só (o deste PC).
- `src/game/scenes/Lan.js`: a tela do lobby.

**Não usado hoje** (sobra do "Remote Play", quando o CO-OP rodava só no host e o convidado assistia): o vídeo e o som do `transmissao.js` (as faixas ainda entram na conexão, mas ficam sempre paradas com `replaceTrack(null)`; a imagem reserva por JPEG também não manda nada) e o `src/lib/lan/audioTap.js`, que copiava o som do jogo para mandar junto com a imagem.

## Problemas comuns

- **"servidor LAN não encontrado"**: a página não veio de um `npm run lan`/`npm run dev` (ex.: arquivo aberto direto ou outro servidor).
- **A sala do outro PC não aparece**: a rede pode bloquear broadcast (Wi-Fi de escola/empresa, "isolamento de cliente"). Use **CONECTAR POR IP** ou abra o endereço do host direto.
- **"pelo servidor" no ping**: o WebRTC não passou (firewall bloqueando UDP) e as mensagens da partida dão a volta pelo servidor. O jogo continua, com o que vem do outro chegando mais atrasado; libere o navegador no firewall.
- Os dois PCs precisam da **mesma versão** do jogo se cada um roda o próprio servidor.
