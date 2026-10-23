# Modo LAN (dois PCs na mesma rede)

Menu → **LAN**. Um PC cria a sala (o **host**, P1, coração vermelho) e o outro entra (o **convidado**, P2, coração amarelo). Vale para o **PVP** e para o **CO-OP**, com todas as telas do jogo.

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

Durante a partida o host joga normalmente (o teclado inteiro dele vira o P1, e o "Jogadores" da barra de cima fica travado em 2). Quando o host volta ao menu (B na escolha, SAIR na pausa, fim da partida), ele cai de novo no lobby da sala, e o convidado volta junto.

## Como funciona

Do jeito do "Remote Play": **o jogo roda só no PC do host** e o convidado assiste e joga a distância.

```
convidado                   servidor (server/lan.js)              host
teclado/joystick ──joy/btn──▶  repassa na sala  ──────▶  vira JOY 2 / BTN 2 (protocolo serial)
<video> ◀═══════ WebRTC direto (imagem do canvas + todo o som do jogo) ══════ canvas + áudio
```

- `server/lan.js`: salas, chat, ping e o repasse das mensagens (WebSocket em `/lan`); anuncia e acha salas de outros servidores por UDP. Troca os nomes `xxxx.local` que o navegador põe nos candidatos do WebRTC pelo IP de verdade (muita rede bloqueia mDNS). `server/index.js` serve o `dist/`; o `vite.config.js` liga o mesmo lobby no `dev`/`preview`.
- `src/lib/lan/rede.js`: conexão com o servidor e o estado do lobby (store `lan`).
- `src/lib/lan/transmissao.js`: WebRTC (H.264 de preferência, até 720 linhas, 60 fps). Se não conectar em 7 s, cai na **imagem reserva**: JPEGs a 30 fps pelo WebSocket, sem som.
- `src/lib/lan/audioTap.js`: copia tudo o que toca no contexto de áudio do jogo (o Phaser usa o mesmo contexto do `audio.js`) para mandar junto com a imagem.
- `src/lib/lan/controleRemoto.js`: os controles do convidado viram o jogador 2 no host.
- `src/game/scenes/Lan.js`: a tela do lobby.

Por o jogo rodar num PC só, não existe dessincronia: o convidado vê exatamente o que o host vê, com o atraso da rede (na LAN, poucas dezenas de ms).

## Problemas comuns

- **"servidor LAN não encontrado"**: a página não veio de um `npm run lan`/`npm run dev` (ex.: arquivo aberto direto ou outro servidor).
- **A sala do outro PC não aparece**: a rede pode bloquear broadcast (Wi-Fi de escola/empresa, "isolamento de cliente"). Use **CONECTAR POR IP** ou abra o endereço do host direto.
- **"imagem reserva (sem som)"**: o WebRTC não passou (firewall bloqueando UDP). O jogo continua, mas sem som e com imagem pior; libere o navegador no firewall.
- **A imagem congela**: a aba do host precisa ficar visível (o navegador para de desenhar abas escondidas).
- Os dois PCs precisam da **mesma versão** do jogo se cada um roda o próprio servidor.
