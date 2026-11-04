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
| `concluida` | Estrela dourada "PÁGINA 1 ✓" (adesivo metalizado) + confete de coraçõezinhos de papel. A vira a página. |
| `virando` / `fim` | A folha encolhe contra a espiral (0,9 s) com o verso curvando e sombra na página de baixo, e mostra a página 2 placeholder, "continua…". A de novo refaz a página 1. |

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

## Direção de arte: um caderno que o Ralsei fez à mão

Caderno de espiral sobre uma mesa de feltro; papel creme quentinho (grão, fibras, vinheta, pautas, margem vermelha,
dobrinha no canto); tudo desenhado com **giz de cera** de verdade (passadas sobrepostas, pressão variável, grão do
papel "comendo" a cera); fita washi segurando o cartão da caixa; doodles nas sobras (sol sorrindo, nuvem,
coraçõezinhos, estrelinhas, trilha de patinhas); adesivos recortados (borda branca + sombrinha). Paleta de giz
(`cera.PALETA`): verde Ralsei, rosa, azul-céu, amarelo-girassol, lavanda, mais tinta, coração e a bolinha roxa.
Texto de instrução sempre na fonte clara; só o título usa letras "tortinhas" (a mesma fonte, cada letra levemente
girada, com o grão da cera). O miolo da hitbox do coração é pintado à parte, exato e nítido, por cima do giz.

O Ralsei é um desenho original nas cores do sprite do jogo (chapéu e manto verdes, cachecol rosa, pelo branquinho,
óculos redondos como na arte do menu), segurando o giz rosa com que fez o caderno. Faz 5 caras
(`ralsei.expressaoDoRalsei`): **feliz** (padrão), **concentrado** (desenhando, com a pontinha da língua),
**surpreso** (0,9 s depois de um acerto), **incentivo** (piscadinha, no "tenta de novo") e **animado** (1,1 s depois
de cada marca e no fim). Respira, o chapéu balança e ele pisca a cada 2,6 a 5 s.

Juice: o gizinho rosa aparece na ponta do traço no "desenhando", com som de giz arranhando; cada marca vira uma
estrelinha dourada colada na fileira de cima, com brilhinhos; as bolinhas deixam um rastro apagadinho; a virada tem
o "fshhh" de folha. Sons de papel sintetizados no contexto de áudio do jogo (`somDePapel`), no volume de efeitos.

Cuidado técnico: **nenhuma imagem do manual gira** (no Chromium com GL de software, uma imagem girada de leve
perdia triângulos inteiros). Balanço é posição/escala; inclinação (a da estrela final) vai assada no canvas.

## Os módulos (`src/game/manual/`)

Tudo puro (sem Phaser, determinístico por semente, testado em `__tests__/`), menos `paginaBase.js`.

| Arquivo | Faz |
| --- | --- |
| `giz.js` | os TRAÇOS (`[{x, y}, ...]`): `linhaGiz`, `retanguloGiz`, `circuloGiz`, `coracaoGiz`, `estrelaGiz`, `xGiz`, `setaGiz`, `preencherGiz` (hachura), `cortarTracos` (o "desenhando"), `desenharTracos` (num `Graphics`: a barra e os risquinhos de acerto) |
| `cera.js` | pinta traços num **canvas 2D** como giz de cera: `passadasDaCera` (2-3 passadas deslocadas, cor variando, pressão por trecho), `preencherCera` (mancha + hachura em 2 ângulos), `pintarDesenho(ctx, camadas)`, `graoDaCera` + `aplicarGrao` (destination-out), `PALETA` |
| `ralsei.js` | o Ralsei em partes (`partesDoRalsei`: corpo, cabeça, chapéu), `rostoDoRalsei(rng, expressao, {piscando})`, `expressaoDoRalsei(etapa, ultimoEvento)`, `piscaEm` |
| `ilustracoes.js` | coração, bala, marcas (traços + camadas assadas), seta, sublinhado, `contornoDoBalao`/`bordaDoBalao`, `letrasTortas`, `rabiscosDaMargem` (sol, nuvem, coração, estrela, pata) |
| `papel.js` | `gerarPapel` (pixels: grão, fibras, manchas, vinheta), `vinheta`, `fibrasDoPapel`, `furosDaEspiral` |
| `confete.js` | `gerarConfete`, `passoConfete` (gravidade, ar, vai-e-vem), `viradaDaPeca` |
| `paginaBase.js` | **a base de toda página** (Phaser + canvas): `garantirPapel` (mesa/folha/espiral), `assar`/`assarCamadas`/`imagemDeCera`, `assarAdesivo`, `assarEstrelaDourada`, `assarLetreiro`, `desenharFita`, `Balao` (digitação pulável), `RalseiDesenhado`, `Confete`, `brilhar`, `virarFolha`, `somDePapel` |
| `pagina1.js` | a máquina de estados e as regras da página 1 (inalterada pela direção de arte) |

Desempenho: tudo o que não muda é **assado uma vez** numa textura de canvas (sementes fixas: reabrir a cena
reaproveita). Por quadro só se troca a textura das variantes (tremidinho a cada 170 ms, `VARIANTES = 3`) e se move
imagens; o "desenhando" repinta uma textura pequena (a área da caixa) por ~2,7 s.

## Acessibilidade

- "reduzir animações": giz parado, Ralsei parado (sem respirar/piscar/pular; as caras mudam), balão inteiro de uma
  vez, virada de página trocada na hora (corte), seta e brilhos parados, sem rastro das bolinhas, sem confete.
- Clarões desligados: sem confete. O confete segue o nível de "festa" dos gráficos.
- Nenhum clarão (acerto = risquinhos parados). Jogabilidade igual em qualquer ajuste.
- Contraste conferido em `__tests__/cera.test.js` (`contraste.js`): texto ≥ 4,5:1 no balão e no papel; bolinha e
  coração ≥ 3:1 no cartão da caixa.
- Texto em fonte clara com acentos (Verdana/DejaVu, negrito), nunca em letra "de mão".

## Como somar páginas

1. Lógica em `src/game/manual/paginaN.js`, puro, no formato de `criarPagina1`: `etapa`, `tick(dt, joy)`, `avancar()`,
   `fala`, `drenar()` (eventos), mais testes em `__tests__/`.
2. Desenhos novos em `ilustracoes.js` (devolva camadas/traços; nada de Phaser).
3. Cena: use `paginaBase.js` (papel, `Balao`, `RalseiDesenhado`, adesivos, `virarFolha`, `somDePapel`); a página só
   monta o que é dela (cartão, doodles da margem nos lugares livres do seu layout, a ilustração jogável) e
   escolhe a cara do Ralsei com `expressaoDoRalsei` (ou uma regra sua). Falta ainda tirar de `ManualRalsei.js` o
   tremidinho e a barra de dicas para a base.
4. Registrar a cena em `config.js` e, se for cena de menu, em `rede.js` (`CENAS_DE_MENU`).
5. Cena nova segue o padrão `estadoInicial()` (`__tests__/cenasReaproveitadas.test.js` cobre).

## Antes de produzir mais páginas

- Trocar as cópias de regras (`moverCoracao`, `balaAcerta`) por chamadas às classes reais, ou testes que comparem as duas.
- Terminar a base de cena (tremidinho e dicas, acima). Índice, "retomar", pular e salvar progresso (3C) ainda não existem.
- Testar com 2 pessoas novas (teste de saída da 3A) e anotar onde perguntaram.

## Testes e verificação

`npm test` cobre `manual/__tests__/` (giz, cera, papel, Ralsei e caras, balão/doodles, confete, contraste, máquina de
estados, acerto, marcas, hitbox x tremor, botões).
O fluxo completo foi jogado no navegador (Playwright + Chromium, software GL): menu → GUIA → manual → marcas → desvio
(com um erro de propósito) → adesivo → virada, também com "reduzir animações" ligado, antes e depois da direção de
arte (capturas comparadas lado a lado).
