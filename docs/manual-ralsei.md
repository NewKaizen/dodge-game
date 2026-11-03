# O Manual Interativo do Ralsei (Fase 3A: protótipo de uma página)

Tutorial em forma de caderno desenhado a giz de cera, jogável. O Ralsei entrega um manual feito à mão; ao virar
a página os desenhos ganham vida e o jogador mexe no coração **dentro da ilustração**, com as regras reais do
jogo. Esta entrega é UMA página, para validar a sensação antes de produzir o livro (plano em
[plano-fases-2-6.md](plano-fases-2-6.md#fase-3-manual-interativo-do-ralsei)).

Entrada: **Menu → GUIA → MANUAL DO RALSEI (prévia)** (a cena `GuiaEntrada` oferece também "CARTAS E ARENAS",
o guia de antes, intacto). `B` volta ao Menu a qualquer momento.

## A página 1, "Este é o seu coração"

| Etapa (`pagina1.js`) | O que acontece |
| --- | --- |
| `intro` | Ralsei fala em 3 balões curtos (A passa; A durante a digitação completa o texto). |
| `desenhando` | O giz desenha a caixa, o coração e as 3 marcas (traço sendo riscado, ~2,7 s). |
| `marcas` | O jogador leva o coração às 3 marcas (estrela, X, estrela), em qualquer ordem. Cada marca vira um adesivo na fileira de cima. Uma seta torta "você!" aponta o coração até a 1ª marca. |
| `desviar` | 1,1 s de aviso e 6 bolinhas lentas (76 a 84 px/s, 3 mirando no coração) por 8 s. Barra de giz mostra o tempo. |
| `tentarDeNovo` | Acertou: risquinhos em volta do coração, fala de incentivo ("Quase! Tenta de novo?") e recomeça **só o desvio** em 1 s (ou já, com A). Cada erro deixa as balas 10% mais lentas (piso 60%). |
| `concluida` | Adesivo "PÁGINA 1 ✓". A vira a página. |
| `virando` / `fim` | A folha encolhe contra a lombada (0,9 s) e mostra a página 2 placeholder, "continua…". A de novo refaz a página 1. |

Uma instrução e uma ação de cada vez; botões na barra de baixo conforme o controle em uso (`botoes.js`:
teclado mostra as teclas reais do jogador 1 já remapeadas, controle mostra A/B, joystick serial BOTÃO A/B).

### Regras reais, camada de apresentação própria

`manual/pagina1.js` é lógica pura (sem Phaser) e **repete** as regras do jogo em vez de criar outras:
`moverCoracao` = `Heart.update` (vetor limitado a 1, px/s do registry `velocidade`, preso à caixa), `balaAcerta` =
`Balas.tocar` (`folga = distância - raio <= CORACAO.hitbox`), `balaFora` = `Balas.foraDaCaixa` (bala inteira fora
da caixa não acerta). O coração mostra o miolo da hitbox (círculo branco de raio `CORACAO.hitbox`). **O tremor do
giz nunca entra na colisão**: a bala acerta por `x/y/raio` e há teste provando que sortear outro giz não muda o acerto.

Risco aceito: são cópias (pequenas) de regras do jogo. Se `Heart`/`Balas` mudarem, `pagina1.js` precisa acompanhar
(a página 2+ deve, se possível, chamar as classes reais; ver "Antes de produzir mais páginas").

## O ajudante de giz (`src/game/manual/giz.js`)

Tudo é **traço**: `[{x, y}, ...]`; um desenho é uma lista de traços. Sem Phaser, determinístico por `criarRng(semente)`
(`pvp/baralho.js`), testado em `__tests__/giz.test.js`.

| Função | Faz |
| --- | --- |
| `linhaGiz(rng, x0, y0, x1, y1, {tracos, tremor, passo, excesso})` | linha tremida, 2 passadas, passando um pouco do fim |
| `retanguloGiz`, `poligonoGiz` | bordas de caixa/balão (cantos que se cruzam) e polígonos |
| `circuloGiz`, `coracaoGiz`, `estrelaGiz`, `xGiz` | formas que não fecham direito (rabinho do giz) |
| `setaGiz(rng, x0, y0, x1, y1)` | seta torta: barriga sorteada e ponta de 2 riscos |
| `preencherGiz(rng, poligono, {espaco, angulo})` | hachura inclinada dentro de um polígono (o "rabisco de preencher") |
| `cortarTracos(tracos, t)` | os primeiros `t` do comprimento: é o que anima o "desenhando" |
| `desenharTracos(g, tracos, {cor, largura, alpha, progresso, grao})` | pinta num `Graphics`: corpo largo translúcido + pressão variável por segmento (`falhaDoGiz`, sem sorteio) |
| `margemDeTremor(t)`, `margemDeLinha(t, e)` | quanto um traço pode sair da forma base (os testes usam isto como limite) |

Tremidinho ("boil"): a cena gera `VARIANTES = 3` desenhos de cada elemento e alterna a cada 170 ms. Com "reduzir
animações" fica só a variante 0 (giz parado).
`papel.js` gera a textura do papel (ruído de valor + grão + bordas escuras; a cena soma pautas e fibras num `CanvasTexture`).
`ilustracoes.js` guarda os desenhos (Ralsei original: chapéu, orelhas caídas, cachecol; coração; bala; marcas; margens).

## Acessibilidade

- "reduzir animações": giz parado, balão inteiro de uma vez, virada de página trocada na hora (corte), seta sem animação.
- Nenhum clarão (acerto = risquinhos parados). Jogabilidade igual em qualquer ajuste.
- Texto em fonte clara com acentos (Verdana/DejaVu, negrito), nunca em letra "de mão".

## Como somar páginas

1. Lógica em `src/game/manual/paginaN.js`, puro, no formato de `criarPagina1`: `etapa`, `tick(dt, joy)`, `avancar()`,
   `fala`, `drenar()` (eventos), mais testes em `__tests__/`.
2. Desenhos novos em `ilustracoes.js` (devolva camadas/traços; nada de Phaser).
3. Cena: hoje `ManualRalsei.js` desenha a página 1 direto. Antes da 2ª página, extrair o que é comum (papel, balão do
   Ralsei, barra de botões, virada de folha, tremidinho) para uma base e deixar cada página só com seu
   `montar()`/`redesenhar()`.
4. Registrar a cena em `config.js` e, se for cena de menu, em `rede.js` (`CENAS_DE_MENU`).
5. Cena nova segue o padrão `estadoInicial()` (`__tests__/cenasReaproveitadas.test.js` cobre).

## Antes de produzir mais páginas

- Trocar as cópias de regras (`moverCoracao`, `balaAcerta`) por chamadas às classes reais, ou testes que comparem as duas.
- Extrair a base de cena (acima). Índice, "retomar", pular e salvar progresso (3C) ainda não existem.
- Testar com 2 pessoas novas (teste de saída da 3A) e anotar onde perguntaram.

## Testes e verificação

`npm test` cobre `manual/__tests__/` (giz, papel, máquina de estados, acerto, marcas, hitbox x tremor, botões).
O fluxo completo foi jogado no navegador (Playwright + Chromium, software GL): menu → GUIA → manual → marcas → desvio
(com um erro de propósito) → adesivo → virada, também com "reduzir animações" ligado.
