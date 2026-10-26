# Mapa de integração (Fase 1)

Relatório de reconhecimento (agente A0, 25/10/2026) usado pelos agentes da Fase 1.
Números de linha são aproximados e valem para o commit `6f00aee`.

## Visão geral
- Svelte 5 é só a casca (`App.svelte` → `Conectar.svelte` + `Game.svelte`); menu e telas são cenas Phaser (`src/game/scenes/*`). Não há `import.meta.env.VITE_*` hoje.
- PVP em rede é P2P "lockstep-ish": o HOST (P1) decide o resultado. O servidor não tem autoridade sobre resultado; XP "do servidor" exige que os dois clientes reportem.

## Servidor
- `server/index.js`: HTTP estático + `/saude`; rotas novas (ex. `/api/config`, `/api/avatar`) entram antes do bloco estático. Env: `PORTA|PORT`, `ONLINE`/`--online`, `STUN_URLS`, `TURN_*`. Chama `anexarLan(servidor,{online,ice})`.
- `vite.config.js`: plugin `dodge-lan` anexa o lobby também no `vite dev`.
- `server/lan.js`: WS em `/lan`, heartbeat 5s, token bucket 120 msg/s. `criarLobby()` (l.~94) é puro e testável; dispatch `acoes` por `m.t` (l.~150-290): `ola, nome, listar, criar, entrar, sair, pronto, modo, partida, expulsar, chat, ping, meuPing, para`. Servidor→cliente: `bemvindo, erro, salas, sala, fechada, chat, pong, de`.
- Sala: máx 2, código de 5 chars, host = criador; host saindo fecha a sala.
- `para` = sinalização WebRTC e fallback do canal de jogo (`src/lib/lan/transmissao.js`).
- Encaixes: token JWT em `acoes.ola` (l.~131; ações são síncronas → `receber()` precisa tolerar promise, `c.ok` só após validar); Map `userId→cliente` para presença; ações `convidar`, `fila`, `resultado`; deps injetadas em `criarLobby` (ex. `autenticar`, `supabase`).
- `PROTOCOLO` duplicado: `server/lan.js` l.22 e `src/lib/lan/rede.js` l.15.

## Cliente rede
- `src/lib/lan/rede.js`: store `lan`; `conectar()` l.81 envia `ola` no onopen (l.~118, encaixe do token); `receber(m)` l.~185 (adicionar cases); API `criarSala, entrarCodigo, iniciarPartida, encerrarPartida, enviarAoParceiro...`. Nome em localStorage `dodge-lan-nome`.
- `src/game/rede.js`: `canal`, `meuLado()` (0 host), `irParaCena`, `instalarRede`.
- `src/game/scenes/Lan.js`: `comecar()` l.550 (PVP → `PvpEscolha`, CO-OP → `EscolhaParty`); campos de texto custom (`digitar` l.507).
- Fim PVP: `PvpArena.resultado(vencedor)` l.1710-1748 (1|2|0; `cpu:true` contra bot) → `PvpResultado`. CO-OP: `Vitoria.js`, `GameOver.js`. `src/lib/protocolo.js` é o serial do joystick (ignorar).

## UI
- Menu: `src/game/scenes/Menu.js`, `OPCOES` l.~32; `confirmar()` l.~172; layout em `src/game/menu/layout.js` (5 itens já lotam). Opção barata: abas dentro da cena Lan (FILA / AMIGOS / PERFIL).
- Menus funcionam só com cima/baixo/A (joystick/simulador).
- Login Google/perfil/amigos/coleção (Fase 2A): cenas `Perfil`, `Amigos` e `Colecao` (base em `src/game/conta/`), stores em `src/lib/conta.js` e `src/lib/amigos.js` lidos com `get(store)`. Só a foto continua em Svelte (`src/ui/FotoModal.svelte`). Foto remota no Phaser: `Image` com crossOrigin virando textura (`conta/ui.js`); se falhar, o avatar padrão.
- Preferências: `src/game/preferencias.js` (não guardar sessão aqui).

## Resultado
- `PvpResultado.js` `create` l.78, `montarEtapas` l.~118, `aoBotao` l.~150, `voltarAoLobby` l.168. Painel de XP antes de `liberar()`. Reportar resultado em `PvpArena.resultado()` ou `PvpResultado.create` com flag anti-duplicação.

## Testes
- `npm test` lista diretórios explícitos no `package.json` (novo diretório precisa entrar).
- `server/__tests__/lan.test.js`: ws falsos `{readyState:1,bufferedAmount:0,send}`, `lobby.receber(c, JSON.stringify(m))`, relógio `agora` injetável. Cenas Phaser não são testadas.

## Build/deploy
- `VITE_*` são embutidas no build (Render/Docker precisam no build step) — alternativa: `GET /api/config` pública.
- `render.yaml`: adicionar `SUPABASE_*` (sync:false). Dockerfile multi-stage: deps de servidor em `dependencies`.
- Modo LAN (sem internet) precisa continuar sem login.
