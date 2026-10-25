# Ataques

Os ataques (as balas que caem nas caixas) ficam em `src/game/attacks/`. As cartas do PvP (`pvp/baralhos/`) e as dos chefes do CO-OP (`coop/chefes/`) montam os ataques com essa biblioteca, recebida como `A`.

## Criar um ataque

1. Copie um arquivo de `src/game/attacks/`, por exemplo `rain.js`. Mude `nome`, `padrao` (os valores padrão) e `iniciar(a, cfg)`.
2. Registre o ataque em `src/game/attacks/index.js`.
3. Use-o numa carta: `(A) => A.meuAtaque({ velocidade: 200 })`. Para combinar, use `A.juntos(...)` e `A.sequencia(...)`.

## Regras

A validação confere estas regras no console, em modo dev (`[telegrafo]`, `[rota de fuga]`):

- **Projéteis nascem FORA da caixa e entram.** A entrada pela borda é o aviso: nada de bala surgindo dentro, parada e piscando, nem linha/área riscando a caixa antes ("guia"). O jogo é de reação.
  - Crie a bala uns 8–40 px além da borda (`a.deFora(lado, fracao, recuo)` ajuda), com a velocidade apontando para dentro e `entrando: true` (ou `jaAvisada: true`). Ela vale na hora, sem piscar e sem o marcador "!". Balas a mais de 160 px da caixa somem na hora (o dev avisa).
  - **Faixa de aproximação:** em volta de cada caixa há uma faixa de ~52 px (`FAIXA` em `entities/BattleBox.js`, sem passar do campo da caixa: não invade o HUD nem a outra caixa) onde as balas aparecem meio transparentes enquanto chegam. Por isso prefira nascer a até ~40 px da borda: mais longe, a bala só aparece quando entra na faixa. Enquanto a bala está TODA fora da caixa ela não acerta nem dá graze. Decorações de imagem criadas fora da caixa (`a.decoracao`, ex.: lata, meteoro, amplificador) também aparecem na faixa; véus, fundos e gráficos ficam só dentro da caixa. Eventos que escurecem a caixa desligam a faixa (`caixa.faixaLigada = false`).
  - Sem `aviso`/`jaAvisada`/`entrando`, uma bala que nasce fora com a velocidade (ou aceleração) entrando na caixa já é tratada como `entrando`. `entrando: false` volta ao antigo (parada fora, com "!").
  - Para ser justo sem guia: entrar devagar e acelerar (`partida` da chuva, das colunas, da mira, das brasas) ou espiar na borda e só então disparar (`arranque: { ms, vx, vy }` nas lanças, na foice e no forcado: a ponta aparece na borda e rasteja por `ms`). Os bots leem o `arranque`.
  - Projétil que sai de uma fonte visível dentro da caixa (núcleo da espiral, bomba, ponta do forcado, bala do carrossel carregando) pode nascer dentro com `jaAvisada: true`: a fonte é o aviso (a bomba conta 3-2-1, a bala do carrossel pisca carregando).
  - O que não é projétil (feixe de laser, espinhos do chão, faróis da caminhonete) pode manter um aviso curto e discreto com `a.aviso(forma, depois)`: prefira `estilo: 'pontas'` (só os emissores na borda) ou `estilo: 'fino'` (trinca fina), e crie as balas dentro de `depois` com `jaAvisada: true`.
  - Aviso diegético desenhado à mão (lâmina espiando, bomba contando)? Registre a área com `a.zonaPerigo(forma, { ms })` para a CPU ler (o `a.aviso` já registra sozinho).
  - Sem nada disso, `a.bala()` ainda nasce parada e piscando por 400 ms (`ATAQUE.telegrafoMs`), o mínimo de aviso; o validador reclama (`[telegrafo]`) de aviso menor.
- **Paredes:** declare toda parede com `a.parede({ eixo, lacunas | ocupados })` e toda abertura com `a.lacuna(px)`. A lacuna mínima é 3x o coração (48 px).
- **Sorteios:** use só `a.aleatorio`, `a.inteiro` e `a.escolher`, que têm semente fixa.
- **Nada decorável:** nada de alternância fixa (`i % 2`), posição fixa ou ritmo `k % n`. Sorteie lado, posição, ângulo e tempos (com limites que mantenham a rota de fuga). Os padrões com `mirar` usam um acumulador com fase sorteada: a fração média de balas miradas é a mesma, mas não dá para prever quais.
- **Alvo:** use `a.alvo()`. Com dois corações na mesma caixa (o quadro único do CO-OP) ele alterna entre os dois. Escolha que tenta várias vezes até achar um lugar longe/perto dos corações: dentro de `a.isolado(() => ...)` (em rede o coração do outro chega atrasado; isolado, o resto do ataque continua igual nos dois PCs).
- **Nada de ficar parado:** todo ataque deve ameaçar um coração parado, mirando parte das balas com `a.alvo()`. Vários padrões têm a opção `mirar`.
- **Dá para fugir correndo:** o que persegue o coração ou varre a caixa sem vão (caminhonete, giro da espiral, faixa do carrossel, olho do Kris, labareda do Show, bola da Avalanche enquanto faz curva, pivô do SUPER do Berdly, enxame/cursor/holofote dos eventos) nunca anda mais rápido que `FUGA.perseguidor` (85%) da velocidade do coração de agora, já com o ritmo da carta, do nível e da morte súbita. Use `a.limitarPerseguidor(v)` (v antes do ritmo: o `vx` da bala ou o passo à mão que depois leva `a.balas.fatorVelocidade`) ou `a.tetoPerseguidor()` (px/s reais, para movimento à mão sem o fator); fora dos ataques, `tetoDeFuga(pista.velocidadeCoracao)` de `constants.js`. Projéteis comuns, que se desviam com um passo para o lado, não entram nessa conta.

## Ondas, respiros e caixa dinâmica

- **Onda e respiro:** todo ataque é uma onda. No início e no meio dela o relógio do ataque para (`RESPIRO` em `constants.js`: 350 ms e 450 ms), mas as balas já em voo continuam.
  - `duracao` no padrão é o tempo ativo; as pausas somam.
  - Para desligar num ataque: `rain({ respiro: { meio: 0 } })`.
- **Caixa por ataque:** `caixa: { largura, altura, x?, y? }` no padrão do ataque.
  - Antes da onda, a caixa mostra um aviso e só então muda (`CAIXA_DINAMICA`).
  - `caixa: null` desliga.
  - Em `juntos(...)`, use `comCaixa(forma, juntos(...))`.
  - As formas são pensadas para a caixa de referência `CAIXA` (240x160), e cada Pista escala para o tamanho dela.
- **Velocidade máxima das balas:** `DIFICULDADES` em `constants.js` (pela dificuldade do chefe), mais o aperto geral `DESAFIO`.

## Testar

No navegador, em modo dev, abra uma arena e rode um ataque direto numa caixa:

```js
debugJogo.set({ invencivel: true, acelerar: 2 })
const { ataques } = await import('/src/game/attacks/index.js')
coopArena.pistas[0].rodar(ataques.foice({ varridas: 2 }), { dano: 1 })
```

Para medir a dificuldade (dano que o bot de esquiva leva em cada carta, com várias sementes), com o jogo em `npm run dev`:

```sh
node scripts/balanceamento/medir.mjs depois.json supers 24      # ou cartas / tudo, e um filtro: asriel,dess ou asriel-ouros-13
node scripts/balanceamento/resumo.mjs depois.json antes.json     # tabelas (DETALHE=all lista carta por carta)
```

Os números da última rodada estão em `docs/pvp-regras.md` ("Balanceamento medido com o bot").

Os scripts medem o bot `imbativel` (o "jogador perfeito", que é a CPU IMBATÍVEL do jogo; no JSON fica na chave `dificil`) e o `normal`. A CPU do DIFÍCIL é outro nível, entre os dois (`NIVEIS_ESQUIVA` em `pvp/botEsquiva.js`); para medi-la: `NIVEIS_BOT=imbativel,dificil,normal` (sai na chave `cpuDificil`).

Para os chefes do CO-OP (cada carta em cada nível, e partidas inteiras sorteando os acertos medidos):

```sh
node scripts/balanceamento/medirChefes.mjs chefes.json 6                  # [sementes] [chefes: king,jevil] [niveis: facil,medio,dificil]
node scripts/balanceamento/simularCoop.mjs chefes.json 600                # % de vitória por chefe e nível (dupla perfeita, mista e média)
```

Os números estão em `docs/coop-cartas.md` ("Balanceamento medido").

## Músicas (MIDI)

Solte `<nome>.mid` em `public/assets/musicas/` (veja o `LEIA-ME.txt` de lá). O jogo toca com um soundfont General MIDI (`game/midi.js`, biblioteca spessasynth_lib), em loop e com fade entre as músicas. `debugJogo.musica()` mostra o que está tocando.
