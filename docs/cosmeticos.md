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
