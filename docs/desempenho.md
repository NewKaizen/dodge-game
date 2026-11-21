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

Ainda não medido nesta árvore: rode `npm run perf -- --saida=perf-resultados/baseline/medir-js.json` e `npm run perf:check -- --atualizar` (o orçamento está com `passoMs: null` até lá). Os números de referência do plano (mesma máquina, mesmo piloto) estão no plano de otimização, seção 1.
