# Cosméticos: sons de dano, efeitos de carta, lançamentos e molduras animadas

Tudo é desenhado/sintetizado por código (nenhum asset externo). Código em `src/game/cosmeticos/`.

## Contrato (`registro.js`)

| Export | O que faz |
| --- | --- |
| `SONS_DANO`, `EFEITOS_CARTA`, `LANCAMENTOS`, `MOLDURAS_ANIMADAS` | listas `{ id, nome, raridade, arquivo? }`; o índice 0 é o padrão grátis |
| `tocarSomDano(scene, id)` | toca o som do golpe (id desconhecido = padrão); no máximo 1 a cada 45 ms |
| `aplicarEfeitoCarta(scene, alvo, id)` | efeito permanente que segue a carta/objeto; devolve `{ destroy() }` |
| `animarLancamento(scene, { x, y, alvoX, alvoY, cor }, id)` | floreio de até 900 ms; `Promise` que sempre resolve (`escala` opcional encolhe a animação, para miniaturas) |
| `desenharMoldura(scene, x, y, tamanho, id)` | `Container` com a moldura (quadrada, fora da área `tamanho`) |
| `previa(scene, tipo, id, x, y, tamanho)` | miniatura em loop (`'som'`, `'efeito'`, `'lancamento'` ou `'moldura'`); a do som tem `tocar()` |
| `temRenderizador(tipo, id)` | usado nos testes de integridade |

Raridades: `comum`, `raro`, `epico`, `lendario`. Ids em kebab-case ASCII, estáveis (o servidor guarda o id).

Regras comuns: tudo é movido pelo evento `update` da cena (sem tweens/timers soltos); `destroy()` e o
`shutdown` da cena removem ouvintes e objetos; no máximo 40 partículas por efeito
(`util.MAX_PARTICULAS`), cortadas pelo nível gráfico e por "reduzir animações"
(`acessibilidade.fatores().particulas`, `preferencias.menosMovimento()`); as texturas brancas `cosm-*`
são criadas uma vez por jogo (`textures.exists`). Um quadro que lança erro desliga só aquele efeito.

## Catálogo

**Sons de dano** (síntese Web Audio, até 400 ms): `dano-padrao` (padrão), `dano-latido`, `dano-pato`,
`dano-moeda`, `dano-boing` (comuns), `dano-buzina`, `dano-miau`, `dano-vidro`, `dano-laser`,
`dano-pum` (raros), `dano-sino` (épico), `dano-cabra` (lendário).

**Efeitos de carta**: `efeito-nenhum` (padrão), `efeito-brilho`, `efeito-bolhas`, `efeito-folhas`
(comuns), `efeito-sombra`, `efeito-eletrico`, `efeito-estrelas` (raros), `efeito-chamas`,
`efeito-pixel-fogo`, `efeito-arco-iris` (épicos), `efeito-holografico` (lendário).

**Lançamentos**: `lancamento-padrao` (padrão), `lancamento-explosao`, `lancamento-confete` (comuns),
`lancamento-raio`, `lancamento-sakura` (raros), `lancamento-tsunami`, `lancamento-meteoro`,
`lancamento-arco-iris-borboletas` (épicos), `lancamento-buraco-negro` (lendário).

**Molduras animadas**: `moldura-nenhuma` (padrão), `moldura-anim-coracoes`, `moldura-anim-slime`
(comuns), `moldura-anim-glitch`, `moldura-anim-estrelas`, `moldura-anim-neon`, `moldura-anim-gelo`
(raros), `moldura-anim-fogo`, `moldura-anim-arco-iris` (épicos), `moldura-anim-gerson`,
`moldura-anim-galaxia` (lendários).

Os versos de carta (`pvp/versos.js`) ganharam `realcarVerso()`: as cores escuras do catálogo
sobem de luminosidade e saturação (mesmo matiz) para o verso aparecer bem na mesa.

## Como usar um som seu

1. Ponha o arquivo (ogg, mp3 ou wav, curto, volume normalizado) em `public/sons/dano/`.
2. Em `registro.js`, na entrada do id (ou numa entrada nova) em `SONS_DANO`, acrescente
   `arquivo: 'sons/dano/meu-som.ogg'`.
3. Pronto: o arquivo substitui a síntese e é baixado só na primeira vez que o som toca (nesse meio
   tempo toca a versão sintetizada, ou o padrão se o id não tiver receita).

Uma entrada nova só com `arquivo` (sem receita em `sons.js`) é válida para os testes.

## Como criar outro efeito visual

Adicione uma função em `EFEITOS_DEF` (`efeitos.js`), `LANCAMENTOS_DEF` (`lancamentos.js`) ou `DEF`
(`molduras.js`) e uma entrada em `registro.js`. Use `enxame()` (piscina fixa de partículas) e os
`Graphics` `g` (normal) e `ga` (aditivo) que a estrutura entrega limpos a cada quadro.
Não use `setScaleX/Y` (não existem no Phaser 4): use `setScale(x, y)`.

## Galeria (dev)

`npm run dev`, depois no console do navegador `window.debugGaleria()` (ou `debugGaleria('efeito', 1)`).
Setas: esquerda/direita mudam a página, cima/baixo o tipo; `Z` toca o próximo som ou repete os
lançamentos; `X` troca o fundo (escuro, claro, verde); clique num som para ouvi-lo; `B` ou Esc sai.

## Testes

`src/game/__tests__/cosmeticos.test.js`: integridade do registro (ids únicos, padrão no índice 0,
raridades, renderizador de cada id), duração dos sons, limpeza de ouvintes e objetos de cada efeito
(cena de mentira que registra o que é criado), limites de partículas e modo "reduzir animações".

## Estilos de carta (frente) e versos ilustrados (0016)

Dois cosméticos novos, os dois do **baú** (ids em [cosmeticos-ids.md](cosmeticos-ids.md)):

- **Estilo da frente** (`perfis.frente_equipada`, aba **ESTILOS DE CARTA** da Coleção): como a face das SUAS cartas é
  desenhada. A disposição nunca muda (valor e naipe nos dois cantos, miolo, faixa do nome, gema de custo, o "×" de
  bloqueada, a moldura arco-íris e a janela do ★ SUPER): só o papel, as cores, o traço dos naipes e os enfeites. O
  vermelho (copas/ouros) e o escuro (espadas/paus) continuam distintos em todos (no Dark Mode o "escuro" vira um branco
  gelo e o vermelho um rosa neon) e o formato de cada naipe é sempre o mesmo (a pista para quem não distingue cores).
  `frente-classica` (padrão), `frente-mal-desenhada`, `frente-jornal` (comuns), `frente-pixel`, `frente-sakura`,
  `frente-cervos-nara`, `frente-dark` (raros), `frente-aquarela`, `frente-origami`, `frente-holografica` (épicos),
  `frente-tarot` (lendário: numeral romano do valor, moldura dourada, sol, lua e estrelas, faixa de título).
- **Versos ilustrados** (o slot de verso de sempre, `perfis.verso_equipado`; aba VERSOS): `verso-noite-estrelada`,
  `verso-circuito`, `verso-patinhas`, `verso-aboboras` (comuns), `verso-lago-koi`, `verso-vitral`, `verso-cervo-nara`,
  `verso-fliperama` (raros), `verso-filigrana`, `verso-onda`, `verso-dragao-pixel` (épicos), `verso-galaxia`
  (lendário). Os versos antigos (Clássico, Estrelado, Carmesim, Dourado, semanais, campanha) continuam lisos, na cor.

| Peça | Onde |
| --- | --- |
| Pintura em canvas (texturas de uma vez por jogo) | `src/game/cosmeticos/pintura.js` |
| Estilos: fundos, temas, naipes, animação, miniatura, prévia | `src/game/cosmeticos/frentes.js` (`desenharFrente(scene, carta, id)`) |
| Versos ilustrados | `src/game/cosmeticos/versos.js` (`desenharVerso(scene, carta, id)`) |
| A Carta | `entities/Carta.js`: opções `frente` e `arteVerso`; `montarFrente(tema)` é a disposição única |
| Ponte (try/catch) | `cosmeticosSlots.js`: `frenteNaCarta`, `versoNaCarta`, `miniaturaDe`, `classeCarta` |

**Contrato do tema** (`montarFrente(tema)`): `cores` (as de `CORES_CARTA` que mudam: `vermelho`, `escuro`, `papel`,
`ouro`...), `fundo(ctx)` (põe a imagem da textura), `naipe(g, naipe, x, y, r, cor, alpha, invertido, ctx)`,
`miolo(ctx, cy)` (true = desenhou), `faixa(ctx, fy, fh)`, `nome { cor, stroke }`, `rotulo { cor(naipe), stroke }`,
`torto` (rad), `decorar(ctx)`, `sobre(ctx)` e `animar(ctx) -> { destroy() }`. Qualquer erro (no estilo, numa textura)
faz a Carta limpar a frente e desenhar a clássica; um verso que falha vira o liso na cor do item. **Um cosmético nunca
quebra a partida.**

**Desempenho**: o fundo de cada estilo e cada verso são pintados UMA vez por jogo numa textura de canvas (210 x 300,
3 px por unidade: as cartas ampliadas continuam nítidas) e cada carta só põe uma imagem. Os naipes e a faixa são
`Graphics` parados. Só a **Sakura** (4 pétalas caindo atrás dos naipes) e a **Holográfica** (o brilho que passa)
animam, por um ouvinte de `update` que some com a carta (`preDestroy`) e com a cena; com "reduzir animações" ficam
paradas. Nada fica pendurado entre aberturas de cena (as texturas são do jogo, não da cena).

**Online**: o estilo viaja em `conta.cosmeticos.frente` (PROTOCOLO 19) e as arenas passam `frente` à `Mao` e às cartas
reveladas/da prévia (o seu estilo aparece nas suas cartas para todos); o verso ilustrado viaja no `conta.verso` de
sempre (`pvp/versos.js` `artesDosVersosDaPartida`, `rede.js` `artesDosVersos`).

**Galeria (dev)**: `window.debugGaleria('frente', n)` mostra 2 estilos por página com 7 cartas de amostra (Ás, 7, 10
com nome comprido, 4 de paus, Q, K bloqueado e ★ SUPER); `window.debugGaleria('verso')`, 6 versos por página. Para ver
na arena com a conta de teste (`DODGE_CONTAS_FALSAS=1`): `window.debugConta.fingir({...})`, depois
`window.debugConta.vestir({ frente_equipada: 'frente.sakura', verso_equipado: 'verso.galaxia' })` (só a tela) e
`window.debugConta.ganhar(['frente.tarot'])` (o inventário mostrado na Coleção).

Testes: `src/game/__tests__/cartasEstilos.test.js` (todo estilo e verso pinta num canvas de mentira, uma textura por
jogo, todos os naipes e valores, vermelho x escuro, animação que some com a carta e com a cena, "reduzir animações"),
`cosmeticosSlots.test.js` (o erro cai na clássica), `src/lib/__tests__/cosmeticos.test.js` (JS = inserts da 0015 +
0016), `server/__tests__/baus.test.js` (o estilo viaja pelo lobby; só equipa o que tem) e `bausSql.test.js` (Postgres).
