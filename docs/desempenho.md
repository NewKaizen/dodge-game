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
