# Desempenho: as ferramentas, o orçamento e como ler os números

Metas (o plano de otimização):

- **144 FPS num Core i3** (a 1x, o passo do Phaser tem que caber em ~3 ms com folga);
- **~50 a 55 FPS na esquiva a 8x de CPU** (o "celular batata");
- **60 FPS a 8x** no Menu, na galeria, na campanha e nas telas de escolha.

Tudo aqui é ferramenta de desenvolvimento: nada muda o jogo nem o visual. As ferramentas
moram em `scripts/perf/`, o resultado das medidas vai para `perf-resultados/` (fora do git) e
o orçamento em [`docs/perf-budget.json`](perf-budget.json).

| Comando | O que faz | Tempo |
|---|---|---|
| `npm run perf` | mede todas as cenas a 1x/4x/8x (modo JS) e grava JSON + tabela | ~20 min |
| `npm run perf -- --rapido` | 6 cenas, janelas de 3 s, sem origens | ~4 min |
| `npm run perf:check` | o portão: passo a 4x, mediana de 3 rodadas, contra o orçamento ±15 % | ~25 min |
| `npm run paridade:base` | fotos determinísticas do `main` (a base) | ~10 min |
| `npm run paridade` | fotos da árvore de trabalho e a diferença pixel a pixel contra a base | ~10 min |
| `node scripts/perf/paridade.mjs autoteste` | a árvore de trabalho fotografada duas vezes: tem que dar 0 | ~20 min |
| `node scripts/perf/boot.mjs` | build numa pasta temporária, tempo até o Menu com a CPU a 4x (mediana de 3) e os pedaços JS | ~3 min |
| `?perf=1` / F9 | o HUD de desempenho no jogo (dev) | |
| `?renderer=canvas` / `?renderer=webgl` | força o renderer (dev) | |

Requisitos: `npm install` (traz `playwright`, `pixelmatch` e `pngjs` das devDependencies) e um
Chromium do Playwright (`npx playwright install chromium`, ou o `PLAYWRIGHT_BROWSERS_PATH` do
ambiente). As ferramentas sobem um `vite` próprio numa porta livre e derrubam no fim: dá para
rodar com o `npm run dev` aberto ao lado (mas não meça com outra coisa pesada rodando: a CPU é
dividida e os números sobem).

## O medidor: `scripts/perf/medir.mjs`

Para cada cena da lista ([`scripts/perf/cenas.mjs`](../scripts/perf/cenas.mjs)): abre o jogo num
Chromium headless, espera o Menu, injeta as sondas ([`sondas.js`](../scripts/perf/sondas.js)),
abre a cena e, em cada taxa de CPU (o throttle do DevTools: 1x, 4x, 8x), grava uma janela de
frames.

As cenas: Menu; PvP na esquiva em CASTELO, CAFÉ, CIDADE, PRAIA, CHINATOWN, ESTAÇÃO e PALCO; a
escolha de cartas do PvP (mãos levantadas, sem relógio); CO-OP na esquiva contra King, Queen,
Jevil, Coronel e ESCURIDÃO (o boss semanal); a primeira luta de uma Expedição (Jevil); a galeria
de cosméticos (estilos de carta e efeitos de carta); o mapa e a luta da campanha.

**O piloto** ([`piloto.mjs`](../scripts/perf/piloto.mjs)) deixa a partida no pior caso estável,
igual ao do plano: `debug.invencivel`, HP que volta a encher (e o chefe do CO-OP que não morre),
toda rodada bônus (`forcarBonus()`), as duas mãos com 10 de energia e as 5 cartas mais altas
(SUPER nas rodadas ímpares), o P1 confirma com Espaço e mexe o coração. No CO-OP ele também fecha
o painel "como funciona" da abertura (senão são 15 s parados).

**O que sai, por cena e por taxa:**

| Campo | O que é |
|---|---|
| fps | frames por segundo entre frames seguidos da fase medida |
| passo (upd/rnd) | ms do passo do Phaser por frame: `scene.update` + `scene.render` |
| p95 | o percentil 95 do passo |
| dc | draw calls WebGL por frame (no Canvas, chamadas de desenho do contexto) |
| gcmd | comandos de Graphics vivos e visíveis: o Phaser re-tessela TODOS a cada frame |
| clears/f | `Graphics.clear()` por frame (Graphics redesenhado) |
| texto/f | `Text.updateText()` por frame (texto re-rasterizado e reenviado) |
| aloc MB/s, GC/s | alocação (degraus positivos do heap) e coletas (quedas > 256 kB) |
| origens | as linhas de código que criaram os Graphics com mais comandos, os textos re-renderizados e os objetos criados por segundo (uma janela de 4 s a 1x com etiquetas) |

Nas arenas só contam os frames da fase pedida (`esquiva` ou `escolha`); a janela cresce (até 4x)
até juntar frames suficientes da fase, porque a 8x a esquiva é curta. As fases que apareceram na
janela vão no JSON (`fases`).

Opções: `--cenas=pvp-cafe,coop` (nome, prefixo ou grupo: `menu`, `pvp`, `coop`, `telas`),
`--taxas=4,8`, `--janela=7000`, `--repeticoes=3`, `--musica=off`, `--sem-origens`,
`--perfil=4` (perfil de CPU com as funções mais caras), `--cheio`, `--viewport=LxA`,
`--renderer=canvas`, `--saida=arquivo.json`. `node scripts/perf/medir.mjs --ajuda` lista tudo.

## Como ler os números (leia antes de comparar)

- **Modo JS (o padrão): viewport 300x300, canvas 214x120.** O Chromium headless rasteriza o
  WebGL em software (SwiftShader) e ainda lê o canvas de volta para a CPU a cada frame. Em
  resolução cheia esse custo é do headless, não do jogo, e esconde tudo. Com o canvas minúsculo o
  raster fica perto de zero e o FPS passa a ser limitado pelo JS + o navegador: é o número que
  corresponde a um celular de CPU fraca.
- **Modo cheio (`--cheio`): 1280x800, canvas 1196x672.** Limitado pela taxa de preenchimento do
  SwiftShader. Serve só para **ordenar overdraw** (camadas e halos ADD): CAFÉ, CIDADE e PRAIA
  aparecem pesadas aqui como numa GPU Mali/Adreno barata. Não compare o FPS daqui com um aparelho.
- **O throttle só freia a thread principal do renderer.** O processo da GPU (SwiftShader) e a
  thread do AudioWorklet (a música) correm na velocidade cheia. A 8x o headless soma uns 10 ms
  por frame de custo que não é do Phaser (rAF, commit, envio do GL, timers): por isso **o portão
  prático de 60 FPS a 8x é um passo de ~6 ms** (~0,8 ms a 1x, ~3 ms a 4x).
- **O passo (update + render) é o número que importa.** FPS a 1x bate no teto de 60 do rAF e
  não mostra nada; a 4x o passo é estável entre rodadas (por isso o portão usa ele); a 8x
  varia mais (GC e cache pioram com o throttle, mais que linear).
- **A música custa na thread principal** (as mensagens do sintetizador): compare sempre com a
  mesma `--musica`. O orçamento mede com música (o jogo de verdade).
- **Ruído:** a mesma cena varia uns 5 a 10 % entre rodadas a 4x, mais a 8x e no Menu. Para
  decidir se uma mudança ajudou, use `--repeticoes=3` ou o `perf:check` (mediana de 3).
- **Uma VM de 4 núcleos ≈ 6 a 10x um Cortex-A53/A55** em JS de uma thread, então 8x é um bom
  substituto de "celular batata".

## O portão: `npm run perf:check` e `docs/perf-budget.json`

O `perf:check` mede as cenas do orçamento 3 vezes (uma sessão nova do navegador por cena e por
rodada), a 4x, no modo JS, com janela de 4 s, e tira a **mediana do passo**. Falha (sai com 1) se
alguma cena passar do orçamento + 15 %; avisa quando uma cena ficou mais de 15 % abaixo (dá para
apertar). Os relatórios vão para `perf-resultados/check-*.md`.

O orçamento começou com os números de HOJE (antes das otimizações), medidos com
`npm run perf:check -- --atualizar`. Cada fase do plano aperta: depois de uma otimização,
`npm run perf:check -- --atualizar` grava as medianas novas (confira o diff do JSON antes de
commitar). A meta final do plano é `metaPassoMs8x` (6 ms a 8x).

Os números são desta máquina (VM de 4 núcleos Xeon, Chromium headless do Playwright 1.63). Noutra
máquina o orçamento não vale: gere um próprio com `--orcamento=outro.json --atualizar`.
`.github/workflows/desempenho.yml` tem um job pronto, **desligado** (só roda pelo botão): num
runner padrão a CPU muda entre execuções, e o orçamento daqui não serve lá (o arquivo explica como
ligar).

## A paridade visual: `scripts/perf/paridade.mjs`

Uma otimização não pode mudar a tela. A paridade fotografa as mesmas cenas do medidor em frames
fixos (30, 120 e 600) e compara pixel a pixel com uma base (`pixelmatch`, limiar 0,1; tolerância
padrão 0,01 % dos pixels por foto).

**O modo determinístico** ([`deterministico.mjs`](../scripts/perf/deterministico.mjs)):

- `Math.random` vira um gerador com semente (mulberry32), ressemeado na hora de abrir a cena;
- o relógio da página (Date, `performance.now`, setTimeout/Interval, rAF) é o relógio falso do
  Playwright: corre normal no boot e **para** antes da cena (numa data fixa: o boss semanal sai
  dela); depois só anda junto com os frames;
- o laço do Phaser dorme (`game.loop.sleep()`) e cada frame é um `game.step(t, 16,667)` chamado
  de fora, depois de o relógio falso andar o mesmo tanto (os tweens leem `Date.now`);
- som desligado (o AudioContext tem relógio real);
- uma cena com carregamento pendente segura o frame até terminar;
- o piloto decide nos mesmos frames (a cada 10), sem `Math.random`;
- a foto é o `toDataURL()` do canvas logo depois do render (sem a página em volta).

Uso:

```sh
npm run paridade:base                 # fotos do main (git archive numa pasta temporária)
npm run paridade                      # fotos da árvore de trabalho + perf-resultados/paridade/atual/relatorio.md
npm run paridade:base -- --ref=abc123 # base de outro ref
npm run paridade -- --cenas=pvp-cafe --quadros=30,120,600,900
```

A comparação usa as mesmas cenas, frames, viewport (960x600, canvas 854x480) e semente da base.
As imagens de diferença (pixels diferentes em vermelho) ficam em
`perf-resultados/paridade/atual/diff/`. Sai com 1 se alguma foto passou da tolerância.

**Prova de determinismo:** `node scripts/perf/paridade.mjs autoteste` fotografa a árvore de
trabalho duas vezes e compara com tolerância ZERO. Resultado no commit do baseline: ver
"Autoteste da paridade" abaixo.

Cuidado: uma mudança que muda a ORDEM ou a QUANTIDADE de chamadas a `Math.random` (mesmo
cosmética) muda tudo o que vem depois na cena; a diferença então não é "visual" de verdade.
O relatório mostra onde a diferença começa (o primeiro frame diferente).

## O HUD de desempenho (`?perf=1` ou F9)

Um quadrinho no canto com FPS, renderer e tamanho do canvas, passo (média e p95), update e
render, draw calls por frame e Graphics visíveis / comandos. É HTML por cima do canvas (não entra
na lista de exibição nem nos draw calls). Liga com `?perf=1` na URL, F9 ou
`debugJogo.hudPerf()` no console.

No celular de verdade: `npm run dev -- --host` e abra `http://IP-do-PC:5173/?perf=1`. O dev é
mais lento que o build (módulos soltos, sem minificar): para medir o build no aparelho,
`VITE_FERRAMENTAS_PERF=1 npm run build && npm run preview -- --host` e `?perf=1`. No build
normal o HUD (e o `?renderer=`) nem vão para o pacote.

## O renderer: `?renderer=canvas|webgl`

Força o renderer do Phaser (no dev, ou num build com `VITE_FERRAMENTAS_PERF=1`). Para comparar:
`npm run perf -- --renderer=canvas`. O Canvas do Phaser 4 não faz tinta (`setTint`), filtros nem
alguns modos de mistura: a tela fica diferente (os corações ficam brancos, por exemplo). Serve
para medir, não para jogar.

## Baseline (antes das otimizações)

Medido no commit `62bc595` (fase 0, sem nenhuma otimização), nesta VM de 4 núcleos, com
`node scripts/perf/medir.mjs --musica=off` (todas as cenas, 1x/4x/8x, janela de 7 s, modo JS). Música
desligada de propósito: a fase 2 (música pré-renderizada) tira o sintetizador, e a música muda os números
de uma rodada para outra. Atenção: outra sessão usava a CPU ao mesmo tempo (carga ~3 a 6 na VM): a 8x os
números variam bastante. O JSON completo e as origens estão em `perf-resultados/baseline/` (fora do git).

| Cena | 1x: fps, passo ms (upd/rnd), p95 | 4x: fps, passo ms (upd/rnd), p95 | 8x: fps, passo ms (upd/rnd), p95 | dc | gcmd | clears/f | texto/f | aloc MB/s | GC/s |
|---|---|---|---|---|---|---|---|---|---|
| Menu | 59.4 fps, 0.9 ms (0.4/0.4), p95 1.5 | 57.6 fps, 4.3 ms (1.8/2.4), p95 10.1 | 57 fps, 6.5 ms (2.6/3.7), p95 14.7 | 35.5 | 684 | 3 | 0 | 18.3 | 2.9 |
| PvP CASTELO, esquiva | 60 fps, 2.5 ms (0.6/1.9), p95 5 | 52.2 fps, 8.8 ms (0.9/7.9), p95 17.6 | 16.3 fps, 37.4 ms (16.3/20.8), p95 67.1 | 102.4 | 6807 | 1 | 0 | 64.3 | 5.3 |
| PvP CAFÉ, esquiva | 48.7 fps, 5.2 ms (1.1/4.1), p95 8.3 | 20.4 fps, 22.3 ms (2.4/19.7), p95 34.9 | 13 fps, 44.3 ms (13/30.9), p95 77.4 | 194.4 | 7923 | 4 | 1.1 | 107.7 | 8.5 |
| PvP CIDADE, esquiva | 58.6 fps, 5.1 ms (1.1/4), p95 8 | 23.8 fps, 24.4 ms (6.5/17.8), p95 50.8 | 11.6 fps, 57.8 ms (19.7/37.4), p95 98.1 | 111.9 | 17142 | 9 | 0 | 188 | 7.7 |
| PvP PRAIA, esquiva | 55.8 fps, 6 ms (1.2/4.8), p95 9.4 | 26.5 fps, 23.4 ms (2.8/20.5), p95 35.3 | 11.8 fps, 58.5 ms (15.7/42.5), p95 109.6 | 99.7 | 34818 | 9 | 1.1 | 238.4 | 10.1 |
| PvP CHINATOWN, esquiva | 55.3 fps, 4.8 ms (1.1/3.6), p95 8.7 | 29.7 fps, 17.5 ms (2.5/14.9), p95 31.5 | 16.7 fps, 37.2 ms (10.6/26.2), p95 63.5 | 109.9 | 9055 | 5 | 1.1 | 121.2 | 7.3 |
| PvP ESTAÇÃO, esquiva (8x: fora da fase esquiva (revelacao)) | 59.6 fps, 3.3 ms (0.9/2.4), p95 6.1 | 49 fps, 9.4 ms (1.3/7.9), p95 15.4 | 15.6 fps, 34.9 ms (12.1/22.5), p95 84.2 | 103.2 | 7689 | 3 | 1.1 | 69 | 5.7 |
| PvP PALCO, esquiva (8x: fora da fase esquiva (escolha)) | 58.6 fps, 3.7 ms (0.8/2.8), p95 6.8 | 49.5 fps, 8.6 ms (1/7.5), p95 14.3 | 18.6 fps, 30.3 ms (9.5/20.7), p95 60.3 | 109.4 | 6389 | 1 | 1.1 | 67.8 | 5.6 |
| PvP CASTELO, escolha de cartas | 60 fps, 2.2 ms (0.1/2.1), p95 4 | 43.6 fps, 10.7 ms (0.6/9.9), p95 19.6 | 35.2 fps, 17 ms (1/15.7), p95 26.8 | 111.5 | 7096 | 1 | 0.1 | 74.4 | 6 |
| CO-OP King, esquiva | 59.9 fps, 2.5 ms (0.3/2.2), p95 5.1 | 51.5 fps, 9.5 ms (1/8.4), p95 18.6 | 27.3 fps, 20.8 ms (2.9/17.6), p95 42.2 | 111 | 6278 | 0 | 0 | 58.3 | 4.7 |
| CO-OP Queen, esquiva | 60 fps, 3 ms (0.4/2.6), p95 5.7 | 44.1 fps, 12.7 ms (1.8/10.8), p95 24.4 | 31.1 fps, 21 ms (3.8/17), p95 37.3 | 114.2 | 7230 | 6.9 | 0.1 | 76.8 | 6.3 |
| CO-OP Jevil, esquiva | 58.5 fps, 4.6 ms (0.5/4), p95 9.6 | 24.8 fps, 23.1 ms (2.6/20.2), p95 45.7 | 17.6 fps, 34.1 ms (5/28.6), p95 58.2 | 121 | 8448 | 5.1 | 0.1 | 95.1 | 7.7 |
| CO-OP Coronel, esquiva | 60 fps, 3.6 ms (0.3/3.3), p95 6.4 | 48.4 fps, 11.7 ms (1/10.5), p95 23.2 | 27 fps, 25.2 ms (3.5/21.5), p95 38.6 | 111.7 | 6306 | 4.1 | 0 | 109.4 | 9.3 |
| CO-OP ESCURIDÃO (semanal), esquiva | 60 fps, 2.7 ms (0.5/2.2), p95 5.7 | 47 fps, 11.2 ms (1.4/9.7), p95 19.7 | 22.7 fps, 28 ms (6.2/21.4), p95 51.6 | 111 | 6009 | 3.5 | 0.1 | 69.2 | 5.7 |
| Expedição (Jevil, fase 1), esquiva | 58.8 fps, 3.6 ms (0.4/3.1), p95 6.4 | 34 fps, 15.2 ms (1.7/13.2), p95 28.6 | 30.8 fps, 19.2 ms (2.1/16.8), p95 31 | 103.3 | 7991 | 2 | 0 | 78.4 | 6.4 |
| Galeria: estilos de carta | 60 fps, 3.3 ms (0.1/3.2), p95 6.4 | 41.5 fps, 11.5 ms (0.5/10.9), p95 17.3 | 23.7 fps, 26.4 ms (1.2/25), p95 47.9 | 111.6 | 26852 | 0 | 0 | 105.6 | 23.3 |
| Galeria: efeitos de carta | 60 fps, 1.3 ms (0.1/1.1), p95 1.9 | 60 fps, 5.3 ms (0.3/4.9), p95 9 | 56.4 fps, 9.4 ms (0.4/8.8), p95 15.8 | 8 | 2232 | 6 | 0 | 60 | 10 |
| Campanha: mapa | 60 fps, 0.8 ms (0.1/0.7), p95 1.6 | 60 fps, 2.1 ms (0.1/1.9), p95 4.2 | 60 fps, 4 ms (0.2/3.7), p95 7.6 | 10 | 4622 | 2 | 0 | 25.9 | 4.4 |
| Campanha: luta | 60 fps, 0.7 ms (0.1/0.6), p95 1.5 | 59.9 fps, 2.7 ms (0.2/2.3), p95 7.1 | 55.7 fps, 4.6 ms (0.4/3.9), p95 9.3 | 15 | 3256 | 1 | 0 | 18.1 | 2.9 |

dc, gcmd, clears, texto, aloc e GC: na taxa 1x. Cenas de arena: só os quadros da fase pedida.

O orçamento (`docs/perf-budget.json`) foi semeado com `npm run perf:check -- --atualizar` no mesmo commit,
**com a música desligada** (`"musica": "off"` no orçamento: o mesmo motivo de cima). As medianas a 4x
saíram mais altas que as da tabela (ex.: CASTELO 17 ms) porque a paridade visual e a outra sessão rodavam
junto: o primeiro orçamento é folgado; a fase 1 aperta com as medidas novas.

### Autoteste da paridade

`node scripts/perf/paridade.mjs autoteste` no commit `62bc595`, com os frames padrão (30, 120, 600 e
**1200**, o 1200 entrou na fase 0 sem autoteste): **76 fotos, 0 diferenças** (19 cenas x 4 frames,
tolerância zero). O modo determinístico continua determinístico com o frame 1200.

A base da paridade da fase 1 é `npm run paridade:base -- --ref=62bc595` (o conserto do Jevil incluído).

## Fase 1 (cartas, HUD, replay, textos e fundos)

O que mudou (commits "Fase 1.x"):

- **1.1 Graphics parados viram texturas assadas** (`arte/assar.js`): `assar`, `assarRegiao` (uma região do
  mundo, a Image fica no lugar do desenho), `trocarAssada*` (troca de estado), e um **LRU**: cada textura
  sabe que cenas a usam; no shutdown de uma cena as que ficaram sem cena viram ociosas e as mais antigas
  são apagadas acima de `LRU.maxOciosas`/`LRU.maxBytes`. Assados: véu, clarão, legenda e rastro da carta,
  as frentes dos ESTILOS cosméticos (antes só a clássica), placa e gemas do HUD, moldura da arena e botão
  PASSAR, as prévias de cosméticos. A tela do VS (`PvpEscolha`) pré-assa as frentes dos dois baralhos.
  **Ficaram Graphics:** a sombra da carta e as gemas de custo (dois estados): assadas, deixavam falhas
  (um retângulo escuro / um buraco no verso de outra carta) na paridade visual; a causa (algo entre
  texturas dinâmicas criadas no meio da partida e cartas em `comprar`/`virar`) não foi achada a tempo.
- **1.2 Replay:** `pvp/fimDePartida/limiar.js` (testado): grava só com vida ≤ 2x o maior dano de um
  acerto (o da carta; com evento de bônus, 30 % da vida máxima), ou sempre na morte súbita. A um golpe do
  K.O. grava a 30 fotos/s; antes disso a 15. A transmissão anda pelo tempo de cada foto. O piloto do
  medidor deixa a vida cheia: nas medidas o gravador fica desligado.
- **1.3 Brilhos das cartas:** pool de Images com a estrela assada, mesmos sorteios na mesma ordem. Um
  `ParticleEmitter` foi tentado e descartado: o emissor sorteia o ângulo com `Math.random` a cada partícula
  (muda o resto da cena) e deixou falhas dentro do container da carta. O pool dos números de dano
  (`effects/numero.js`) também foi descartado: cada `Text` novo sorteia um nome (UUID), e o pool mudava a
  sequência do `Math.random`. `Bullets.js`, `queenPopup.js` e `attacks/contexto.js` não foram mexidos
  (simulação; o ganho medido era pequeno).
- **1.4** `textoSeMudou(t, texto, cor)` e o pisca do CONTROLES INVERTIDOS por visibilidade/alpha:
  texto/f na esquiva = 0 em todas as arenas.
- **1.5/1.6 Fundos:** CIDADE (céu = topo tingido + degradê assado; janelas numa DynamicTexture repintada
  só onde o nível muda, sem string/Map por janela; carros, postes e helicóptero assados), PRAIA (camadas
  assadas, ondinhas em TileSprite, folhas e gaivotas em laços de quadros, ondas grandes em triângulos),
  CAFÉ (Images; marquises, gato e acordeão em laços de 24 quadros; halos parados no chão assado),
  CHINATOWN, ESTAÇÃO, PALCO, CASTELO, Queen e Jevil (espiral assada que gira). Não mexidos: o dragão da
  CHINATOWN, os fios de lanternas, `escuridaoRegra.js` (os olhos) e as três ondas grandes da PRAIA
  (ainda ~9 mil comandos por quadro: o maior resto).

### Antes e depois (medir.mjs --musica=off, mesma VM, outra sessão usando a CPU nas duas)

| Cena | passo 1x (ms) | passo 4x | passo 8x | FPS 8x | dc | gcmd | texto/f | aloc MB/s | meta 8x |
|---|---|---|---|---|---|---|---|---|---|
| Menu | 0.9 → 0.9 | 4.3 → 3.6 | 6.5 → 6.1 | 57 → 58.9 | 35.5 → 35.5 | 684 → 692 | 0 → 0 | 18.3 → 18.1 |  |
| PvP CASTELO, esquiva | 2.5 → 1.6 | 8.8 → 8 | 37.4 → 25.1 | 16.3 → 25.1 | 102.4 → 96.6 | 6807 → 1956 | 0 → 0 | 64.3 → 44.4 | ≤ 12: não |
| PvP CAFÉ, esquiva | 5.2 → 2.4 | 22.3 → 12.9 | 44.3 → 35.2 | 13 → 16.6 | 194.4 → 109.9 | 7923 → 2114 | 1.1 → 0 | 107.7 → 48.9 | ≤ 15: não |
| PvP CIDADE, esquiva | 5.1 → 2.6 | 24.4 → 10.7 | 57.8 → 43.3 | 11.6 → 15.4 | 111.9 → 107.8 | 17142 → 2733 | 0 → 0 | 188 → 63.4 | ≤ 15: não |
| PvP PRAIA, esquiva | 6 → 2.8 | 23.4 → 14.5 | 58.5 → 40.4 | 11.8 → 16.3 | 99.7 → 96.4 | 34818 → 13421 | 1.1 → 0 | 238.4 → 129.8 | ≤ 15: não |
| PvP CHINATOWN, esquiva | 4.8 → 2.3 | 17.5 → 14.1 | 37.2 → 27.9 | 16.7 → 21.6 | 109.9 → 108.7 | 9055 → 3103 | 1.1 → 0 | 121.2 → 68.6 |  |
| PvP ESTAÇÃO, esquiva | 3.3 → 1.9 | 9.4 → 8.5 | 34.9 → 30.5 | 15.6 → 20.5 | 103.2 → 95.2 | 7689 → 2008 | 1.1 → 0 | 69 → 48.3 |  |
| PvP PALCO, esquiva | 3.7 → 2.5 | 8.6 → 13.4 | 30.3 → 23.4 | 18.6 → 26.2 | 109.4 → 101.5 | 6389 → 1818 | 1.1 → 0 | 67.8 → 49.4 |  |
| PvP CASTELO, escolha de cartas | 2.2 → 1.6 | 10.7 → 8 | 17 → 12.8 | 35.2 → 44.1 | 111.5 → 99 | 7096 → 2082 | 0.1 → 0.1 | 74.4 → 45.7 |  |
| CO-OP King, esquiva | 2.5 → 1.9 | 9.5 → 11 | 20.8 → 17.2 | 27.3 → 36 | 111 → 110.9 | 6278 → 2515 | 0 → 0 | 58.3 → 47.3 | ≤ 14: não |
| CO-OP Queen, esquiva | 3 → 2.3 | 12.7 → 9.5 | 21 → 28.3 | 31.1 → 23.2 | 114.2 → 115.5 | 7230 → 2168 | 0.1 → 0.1 | 76.8 → 64.8 | ≤ 14: não |
| CO-OP Jevil, esquiva | 4.6 → 2.3 | 23.1 → 11.8 | 34.1 → 28.9 | 17.6 → 21.9 | 121 → 122.9 | 8448 → 2832 | 0.1 → 0.1 | 95.1 → 78.7 | ≤ 14: não |
| CO-OP Coronel, esquiva | 3.6 → 2.7 | 11.7 → 11.2 | 25.2 → 30.1 | 27 → 22.3 | 111.7 → 111.6 | 6306 → 2520 | 0 → 0 | 109.4 → 97.2 | ≤ 14: não |
| CO-OP ESCURIDÃO (semanal), esquiva | 2.7 → 2.9 | 11.2 → 14.8 | 28 → 30.6 | 22.7 → 22.6 | 111 → 110.4 | 6009 → 2168 | 0.1 → 0 | 69.2 → 57.2 | ≤ 14: não |
| Expedição (Jevil, fase 1), esquiva | 3.6 → 1.8 | 15.2 → 13 | 19.2 → 20 | 30.8 → 31.6 | 103.3 → 105.1 | 7991 → 2342 | 0 → 0 | 78.4 → 60.4 | ≤ 14: não |
| Galeria: estilos de carta | 3.3 → 1.5 | 11.5 → 8 | 26.4 → 14.9 | 23.7 → 39.8 | 111.6 → 106 | 26852 → 2476 | 0 → 0 | 105.6 → 39.4 | ≤ 8: não |
| Galeria: efeitos de carta | 1.3 → 0.8 | 5.3 → 3.6 | 9.4 → 6.3 | 56.4 → 60 | 8 → 9 | 2232 → 780 | 0 → 0 | 60 → 35.5 | ≤ 8: atingida |
| Campanha: mapa | 0.8 → 0.5 | 2.1 → 2.2 | 4 → 4.9 | 60 → 59.9 | 10 → 10 | 4622 → 4622 | 0 → 0 | 25.9 → 26 |  |
| Campanha: luta | 0.7 → 0.4 | 2.7 → 1.6 | 4.6 → 4 | 55.7 → 60 | 15 → 11 | 3256 → 2914 | 0 → 0 | 18.1 → 13 |  |

Leitura: a 1x o passo caiu ~2x nas arenas (0,4 a 2,9 ms: cabe na meta de 144 FPS num Core i3) e os
comandos de Graphics caíram 3 a 10x (galeria 27 mil → 2,5 mil). **As metas de 8x da fase 1 não foram
atingidas** (só a galeria de efeitos): o que sobra é o custo por objeto (~100 draw calls por quadro: um
lote por texto e por troca de textura, cinco câmeras na PvpArena) e, a 8x, o ruído da VM (outra sessão na
CPU: Queen/Coronel/ESCURIDÃO pioraram entre as duas medidas sem mudança que explique). Isso é da fase 3
(BitmapText, atlas, menos câmeras e containers).

### O portão apertado (perf:check --atualizar, 4x, mediana de 3)

| Cena | baseline | fase 1 |
|---|---|---|
| PvP CASTELO esquiva | 17 | 7,1 |
| PvP CAFÉ | 30 | 9,2 |
| PvP CIDADE | 30,2 | 11,9 |
| PvP PRAIA | 35,9 | 13 |
| PvP CHINATOWN | 26,2 | 9,6 |
| PvP ESTAÇÃO | 17,8 | 8,3 |
| PvP PALCO | 21,2 | 9,4 |
| Escolha de cartas | 12,7 | 8,1 |
| CO-OP King / Queen / Jevil / Coronel / ESCURIDÃO | 13,6 / 15,5 / 17,3 / 15,4 / 13,8 | 9 / 9,8 / 11,5 / 15,3 / 10,1 |
| Expedição | 13,1 | 9,4 |
| Galeria estilos / efeitos | 13,9 / 5,5 | 7,2 / 3,7 |

O `docs/perf-budget.json` agora tem as medianas da fase 1 (a base do baseline estava inflada pela carga
da VM; com a CPU mais livre a fase 1 mediu 2 a 3x menos a 4x).

### Paridade visual da fase 1

`npm run paridade` contra `62bc595`: 68 de 76 fotos acima da tolerância, mas nenhuma com divergência de
fluxo (as mesmas fases e cartas nos mesmos frames). O que difere:

- ~1000 px por foto de arena (0,25 %): a linha de baixo das placas do HUD e da moldura cai 1 px acima
  (empate de meio pixel no desenho da textura assada; não deu para desempatar igual à tela);
- os fundos animados: laços de quadros (marquises, gato, acordeão, folhas, gaivotas, rotor) andam em
  degraus de menos de meio pixel; nuvens e carros assados param em pixel inteiro (o `roundPixels` das
  Images); até 0,8 % (CHINATOWN f1200, o vapor por cima do dragão);
- galeria de efeitos (1,2 %): o verso de mentira balança em posição fracionária (a Image assada anda de
  pixel em pixel).

Menu e mapa da campanha: 0 pixels.

## Fase 3 (texto bitmap, atlas, cartas rasas, BATATA, cenas sob demanda)

Base: `3c4749f` (main + fase 0 + fase 2 da música + fase 1). O que mudou (commits "Fase 3.x"):

- **3.1 Texto em fonte bitmap** (`src/game/textoBitmap.js`): `textoJogo(cena, x, y, texto, estilo)` devolve um
  `TextoBitmap` quando o estilo cabe (a fonte do jogo, cor, contorno, align, lineSpacing) e um `Text` de sempre
  quando não. O atlas da fonte é rasterizado **no navegador**, na primeira vez que um tamanho aparece, com o mesmo
  canvas, a mesma fonte e o mesmo desenho do `Text` (contorno de juntas redondas por baixo, preenchimento por cima),
  na resolução da tela (`RES.escala`). Um atlas feito no build (PNG) ficaria preso a uma escala e borraria nas outras
  (1,4x, 2,25x, a BATATA): por isso não há script em `scripts/` para ele. Letras brancas, cor pela tinta (exata
  também nas bordas suavizadas); o contorno é uma segunda camada desenhada inteira antes do preenchimento (como no
  canvas, o contorno de uma letra não cobre a vizinha). Charset: ASCII, acentos do português, `♪ ♫ ♥ ♦ ♣ ♠ ★ × → …`;
  outro caractere é rasterizado na hora. A caixa (largura com o contorno) é a do `Text`, então origens e layouts não
  mudam, e o construtor sorteia o mesmo UUID que um `Text` sortearia (o `Math.random` da cena não muda).
  Usam: o HUD do PvP (nome, HP, energia, combo, velocidade), os números de dano, o topo da arena (rodada, relógio,
  bônus), a faixa, a dica, os avisos e as informações das pistas, as etiquetas que sobem e o contador dos montes.
  **Ficam `Text`:** o status do jogador na escolha (a pílula do bloqueio usa fundo e margem), o que quebra linha
  sozinho (descrição das cartas, diálogos), textos com sombra, os menus e as telas fora da partida.
- **3.2 Atlas do boot** (`arte/texturas.js`): os desenhos pequenos de `gerarTexturas` (personagens, chefões e seus
  quadros, Expedição, balas, peças do King, interface) vão para páginas de 2048 px; cada chave de sempre vira uma
  textura do Phaser com a mesma fonte (a mesma textura da GPU) e o quadro recortado. Pixels idênticos (cópia com
  `drawImage` em posição inteira, 1 px da borda repetido em volta = o clamp da textura sozinha). Ficam fora: as lidas
  como imagem (`coracao`), as de filtro próprio (`carta-brilho`, `vinheta`), as de TileSprite e as maiores que 256 px.
  As imagens carregadas de arquivo (ícones, elenco, sprites das cartas) não entraram: são PNGs com quadros
  (spritesheets) e a ordem de carregamento é do Loader; ficam para a migração de motor.
- **3.3 Menos objetos:** as gemas de custo da carta (gema e marca, os dois estados) viram texturas assadas COM o
  número, as duas prontas quando a carta nasce (a troca de estado é um `setTexture`, nenhuma textura nova no meio da
  partida); o nome e os rótulos de canto vão na textura da frente. Menos 5 `Text` e 2 `Graphics` por carta.
  `filtrarCaixas` (`recorte.js criarFiltroCaixas`) e o filtro da faixa de aproximação (`BattleBox.filtrarFaixa`)
  são incrementais: só os objetos que entraram na cena desde o quadro anterior (`addedtoscene`), e a volta inteira
  só quando o conjunto de câmeras de caixa muda.
- **3.4 Resolução BATATA** (CONFIGURAÇÕES > GRÁFICOS > RESOLUÇÃO): canvas no tamanho do mundo (854x480, escala 1),
  ampliado pela página com `image-rendering: pixelated`, em zoom inteiro quando ele ocupa 85 % do espaço
  (`resEscala.js medirBatata`). `batata.js` liga sozinho com 3 s seguidos abaixo de 50 FPS (não conta o boot, os 4 s
  depois de cada troca de cena, a aba escondida nem navegador automatizado) e mostra um aviso com DESFAZER; quem
  desfaz não recebe de novo (`batataAutomatica`). Só ajuda a GPU (pixels ÷ `RES.escala²`); o JS é o mesmo.
- **3.6 Cenas sob demanda** (`cenasPreguicosas.js`, `config.js CENAS_SOB_DEMANDA`): só o Menu e o que fica por cima
  de qualquer cena (Pausa, Config, Carregando, Religando, BauPopup, Entrada) vão no pacote do boot; o resto chega
  por `import()` na primeira abertura, com o CARREGANDO… por cima se a tela ficou vazia, no mesmo lugar da ordem de
  desenho. A paridade carrega todas antes de congelar o relógio (`window.__carregarTodasAsCenas`).

**Não feito, e por quê:**

- **3.5 Desenho sob demanda nas telas paradas:** implementado (assinatura da lista de exibição + ganchos de
  `clear`/`updateText`/texturas dinâmicas + rede de segurança de 2 quadros/s) e **descartado** depois de medir:
  PvpEscolha, CONFIGURAÇÕES, PERFIL, COLEÇÃO, GRIMÓRIO e a galeria **não são paradas** — todas têm fundo animado (a
  cidade em TileSprite rolando, as linhas de chuva) ou cartas com brilho/faíscas. Em 3,5 s em cada uma, 0 quadros
  pulados: o mecanismo só somava o custo da assinatura. Ganhar aqui exige congelar essas animações (decisão de
  design).
- **Juntar a câmera da faixa de aproximação com a da caixa:** a faixa desenha só as balas que chegam, fora da caixa,
  a 85 % de alpha (a câmera com alpha passa por um framebuffer); a caixa desenha tudo dela a 100 %. Uma câmera só não
  faz as duas coisas sem máscara ou shader (que custam mais) ou sem mudar a composição das balas sobrepostas. Fica
  para a migração (uma câmera, recorte por scissor).
- **Achatar a carta em poucas Images (sem containers):** a carta tem estados animados por partes (o corpo sobe e
  inclina, o véu, o clarão, os brilhos, o flip só no corpo); tirar os containers quer um "transform helper" que
  reescreve as animações de `Carta.js` (1,4 mil linhas) e de quem mexe nelas. A fase 3 tirou os objetos parados de
  dentro deles (textos e gemas) em vez disso.
- **Assar a sombra da carta:** voltou a ser `Graphics` (como na fase 1). A investigação: não é o LRU nem a textura.
  Com a sombra assada (numa textura própria ou na placa do véu tingida), **o verso de cima dos montes perde um
  triângulo** de vez em quando (aparece o preto das sombras de baixo), em quadros alternados, mesmo com a mesma cena
  parada. Some quando um `Graphics` quebra o lote antes do verso, ou quando o número de unidades de textura do lote é
  refeito (`setMaxParallelTextureUnits(1)` e de volta) no meio da cena. Nenhuma textura fica com `batchUnit` sobrando
  no fim do quadro. É um defeito do lote com várias texturas do Phaser 4.2.1 (ou do SwiftShader) em lotes longos;
  o `Graphics` da sombra deixa os lotes curtos. As gemas assadas (que na fase 1 deixavam um buraco) não reproduziram
  o defeito depois de prontas de uma vez no nascimento da carta.
- **Atlas das texturas assadas das cartas** (páginas de DynamicTexture): não feito — deixaria os lotes mais longos,
  justamente o que dispara o defeito acima.
- **Os restos da fase 1 (3.7):** as três ondas grandes da PRAIA (strokePoints de ~150 pontos que mudam a cada quadro:
  sem um Rope ou um shader não há como assar), o dragão e os fios de lanternas da CHINATOWN e os olhos de
  `escuridaoRegra.js` não foram refeitos: cada um é um redesenho do efeito com risco de paridade, e o ganho medido
  é de uma arena só. A fase 3 cuidou dos custos que valem para todas as cenas.
- **Bosses semanais em pedaço próprio:** são ~80 kB de fonte entrelaçados com as regras do CO-OP e os tenentes da
  Expedição (import estático em `coop/regras.js`); a CoopArena inteira já é sob demanda.

### Antes e depois (`3c4749f` → fase 3, `medir.mjs --musica=off`, mesma VM)

**A/B com repetição** (as duas árvores medidas em seguida, `--repeticoes=3 --sem-origens`, mediana das 3 janelas de 7 s; é a tabela para decidir):

| Cena | passo 1x (ms) | passo 4x | passo 8x | FPS 8x | dc |
|---|---|---|---|---|---|
| Menu | 0.9 → 0.8 | 3.9 → 3.3 | 7.4 → 6.3 | 57.4 → 58.9 | 35.6 → 35.6 |
| PvP CASTELO, esquiva | 1.8 → 1.9 | 6.8 → 6.5 | 33.6 → 10.9 | 19.1 → 51 | 93.5 → 65.4 |
| PvP PRAIA, esquiva | 2.8 → 2.4 | 14.6 → 13 | 33.8 → 23.7 | 18.8 → 26.6 | 94.8 → 71.4 |
| PvP CASTELO, escolha de cartas | 1.7 → 1.5 | 8.5 → 6.6 | 27.1 → 12.8 | 23.1 → 45.3 | 98 → 65 |
| CO-OP King, esquiva | 2 → 1.9 | 9.3 → 6.9 | 20.6 → 15.3 | 30.5 → 39.3 | 108.5 → 76.6 |
| Expedição (Jevil, fase 1), esquiva | 2.1 → 1.8 | 8.4 → 8.1 | 22.8 → 14.7 | 27 → 41.3 | 106.4 → 76.4 |
| Galeria: estilos de carta | 1.5 → 1 | 6.8 → 5.4 | 12.2 → 10.3 | 43.8 → 53.1 | 106 → 56 |

**Todas as cenas, uma rodada cada** (`npm run perf -- --musica=off`; a 8x uma rodada só varia ±30 % nesta VM: use para dc, gcmd, textos e alocação, que são estáveis; o passo a 8x daqui não decide nada):

| Cena | passo 1x | passo 4x | passo 8x | FPS 8x | dc | gcmd | textos visíveis | aloc MB/s |
|---|---|---|---|---|---|---|---|---|
| Menu | 0.9 → 1.1 | 4.1 → 3.9 | 7.5 → 8.9 | 57.5 → 53.5 | 35.5 → 35.4 | 684 → 684 | 18 → 18 | 18.4 → 19 |
| PvP CASTELO, esquiva | 2 → 2 | 7.8 → 7.3 | 21 → 22.2 | 29.5 → 29.3 | 89.5 → 64.4 | 1797 → 997 | 69 → 8 | 43.2 → 42.2 |
| PvP CAFÉ, esquiva | 2.1 → 2.1 | 9.5 → 9.4 | 23.5 → 32.3 | 24.9 → 19.5 | 102.4 → 77.4 | 1955 → 1155 | 76 → 15 | 46.8 → 45.7 |
| PvP CIDADE, esquiva | 2.4 → 3.2 | 10.6 → 13.5 | 34 → 27.7 | 19.5 → 23.4 | 108.7 → 84 | 2733 → 1946 | 68 → 8 | 63.7 → 63.1 |
| PvP PRAIA, esquiva | 2.7 → 3 | 12.4 → 13.9 | 46.1 → 34.6 | 15.3 → 19.6 | 96.5 → 71.2 | 13421 → 12621 | 69 → 8 | 128.5 → 128.3 |
| PvP CHINATOWN, esquiva | 2.3 → 2.5 | 10.4 → 10.8 | 29.8 → 32.7 | 21.5 → 20.7 | 101.5 → 76.4 | 2944 → 2144 | 68 → 8 | 67.2 → 66.9 |
| PvP ESTAÇÃO, esquiva | 2 → 1.9 | 8.1 → 9.2 | 28.9 → 35.9 | 22.2 → 19.3 | 95.3 → 70.1 | 2008 → 1208 | 68 → 8 | 48.2 → 47.1 |
| PvP PALCO, esquiva | 2.8 → 2.6 | 12.6 → 14.2 | 33.6 → 24.6 | 19.8 → 25.9 | 101.3 → 76.6 | 1818 → 1018 | 68 → 8 | 49 → 48.5 |
| PvP CASTELO, escolha de cartas | 2 → 1.6 | 7.5 → 6.5 | 17 → 12.6 | 33.6 → 46.4 | 99.5 → 65.8 | 2082 → 1082 | 82 → 11 | 45.8 → 42.4 |
| CO-OP King, esquiva | 2.1 → 1.6 | 8.8 → 8.6 | 21.4 → 25.1 | 29.2 → 26.4 | 111 → 78.6 | 2515 → 1617 | 89 → 19 | 47.6 → 43.9 |
| CO-OP Queen, esquiva | 2.4 → 2.7 | 10.3 → 12.8 | 25.5 → 23 | 25.8 → 28.2 | 115.9 → 83.4 | 2168 → 1168 | 89 → 19 | 64.8 → 61.4 |
| CO-OP Jevil, esquiva | 2.9 → 2.4 | 14.5 → 12.2 | 32.6 → 23.9 | 20.3 → 26.2 | 122.9 → 90.9 | 2832 → 1832 | 94 → 23 | 79.4 → 74.3 |
| CO-OP Coronel, esquiva | 2.7 → 2.8 | 12.5 → 12 | 31.2 → 25.9 | 21.4 → 25.6 | 111.7 → 79.8 | 2600 → 1528 | 91 → 21 | 98.7 → 91.7 |
| CO-OP ESCURIDÃO (semanal), esquiva | 2.4 → 2.4 | 7.4 → 8.2 | 26.5 → 23.3 | 25.3 → 28.9 | 110.1 → 78.2 | 2918 → 1168 | 92 → 20 | 60.4 → 55.8 |
| Expedição (Jevil, fase 1), esquiva | 2.2 → 2 | 9.8 → 11.1 | 27.9 → 25.2 | 22.7 → 21.5 | 105.2 → 77.2 | 2342 → 1342 | 92 → 19 | 60.6 → 57.4 |
| Galeria: estilos de carta | 1.5 → 1.2 | 7.4 → 5.3 | 17.9 → 12.7 | 32.4 → 45.9 | 106 → 56 | 2476 → 984 | 74 → 10 | 39.3 → 30.8 |
| Galeria: efeitos de carta | 0.7 → 0.9 | 3.2 → 3.9 | 6.4 → 8.3 | 59.7 → 57.7 | 9 → 9 | 780 → 780 | 14 → 14 | 35.5 → 30.4 |
| Campanha: mapa | 0.5 → 0.6 | 2.3 → 2.8 | 4.5 → 6.2 | 60 → 60 | 10 → 10 | 4622 → 4622 | 14 → 14 | 26.1 → 26 |
| Campanha: luta | 0.4 → 0.5 | 1.6 → 2 | 4.2 → 3.5 | 59.6 → 60 | 11 → 11 | 2914 → 2914 | 15 → 10 | 13.1 → 13.6 |

**Boot e pacote** (`node scripts/perf/boot.mjs --rodadas=3`: build de produção, `vite preview` local, CPU a 4x,
contexto novo do navegador em cada rodada):

| | antes (`3c4749f`) | fase 3 |
|---|---|---|
| tempo até o Menu a 4x (mediana; rodadas) | 7,9 s (8,5 / 7,8 / 7,9) | 8,2 s (7,7 / 8,2 / 9,4) |
| baixado até o Menu | 8,3 MB | 6,4 MB |
| JS carregado no boot | 4,0 MB (1 pedaço; 1,24 MB gzip) | 2,2 MB (o do Phaser, 1,56 MB, + o principal, 0,54 MB) |
| pedaços JS no pacote | 2 | 98 |

Leitura:

- **Draw calls -25 a -50 %** em todas as cenas de cartas (castelo 94 → 65, galeria 106 → 56), **Graphics -800 a
  -1 750 comandos** por quadro (as gemas das cartas), **textos visíveis 60-80 → 8-15**. A 1x o passo fica em
  1 a 3 ms (meta de 144 FPS num Core i3: sobra).
- **A 8x, com a mediana de 3** (a tabela A/B): castelo na esquiva 33,6 → 10,9 ms (19 → 51 FPS), escolha de cartas
  27 → 12,8 ms (23 → 45 FPS), King 20,6 → 15,3, Expedição 22,8 → 14,7, galeria 12,2 → 10,3, Menu 7,4 → 6,3 ms.
  **A meta de 6 ms a 8x nas telas de menu/galeria/escolha ainda não foi atingida** (escolha 12,8, galeria 10,3; o
  Menu chegou perto: 6,3). O que sobra é custo por objeto (~500 objetos e 130 containers na mesa de cartas) e os
  ~32 lotes que a sombra-Graphics de cada carta força.
- **Boot:** o JS do boot caiu quase pela metade e o download 23 %, mas o tempo até o Menu a 4x não mudou além do
  ruído: ele é dominado por buscar e decodificar os sons e as imagens do Loader e pela compilação do Phaser (que
  continua no boot). O atlas do boot troca ~150 envios de textura por 1, mas eles eram baratos perto disso.
- A rodada única a 8x da tabela de todas as cenas tem cenas que "pioraram" (CAFÉ, ESTAÇÃO): o mesmo commit varia
  ±30 % a 8x nesta VM (comparar a tabela A/B, que mediu o castelo nas duas e deu o contrário). dc, gcmd e textos,
  estáveis, caíram em todas.

### Paridade visual da fase 3

`npm run paridade` contra `3c4749f` (`perf-resultados/paridade/base`): todas as cenas passam pelas mesmas fases
nos mesmos quadros (nenhuma divergência de fluxo nem de `Math.random`). Fotos lado a lado (base | fase 3 | diferença)
no relatório da fase.

- **Menu, mapa da campanha, galeria de efeitos: 0 a 36 pixels** (na tolerância).
- **Arenas PvP e CO-OP: 0,4 a 1,0 %** (1,7 a 4,2 mil pixels por foto), só em texto: os textos em fonte bitmap
  (HUD, topo, avisos das pistas, contadores) põem cada letra na posição de pixel dela, e o canvas do Text põe a
  linha inteira com avanço fracionário: letras andam 1 px e a suavização das bordas muda. O desenho das letras é o
  mesmo (mesmo rasterizador, mesma fonte, mesma escala).
- **Galeria de estilos: 0,84 %** e luta da campanha 0,08 %: o nome e os números das cartas agora são assados na
  textura da frente/da gema; o texto (3x de resolução) é reamostrado uma vez na textura e outra na tela (antes uma só):
  a borda suavizada das letras muda ±1 nível de cinza em volta.

### O portão (perf:check --atualizar, 4x, mediana de 3)

O `perf:check --atualizar` da fase 3 deu medianas **mais altas** que o orçamento da fase 1 em quase todas as cenas,
inclusive nas que a fase 3 não tocou (mapa da campanha 2,3 → 2,9 ms, luta 1,6 → 2,5): a VM estava mais carregada
(outra sessão). Gravar aquilo afrouxaria o portão. O `docs/perf-budget.json` foi apertado **só onde a A/B (as duas
árvores medidas em seguida, mediana de 3) mostrou queda**: Menu 4,4 → 3,3, castelo 7,1 → 6,5, escolha de cartas
8,1 → 6,6, King 9 → 6,9, Expedição 9,4 → 8,1, galeria de estilos 7,2 → 5,4 ms. O resto ficou como estava.
