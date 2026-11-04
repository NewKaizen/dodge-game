# O Manual Interativo do Ralsei (páginas 1 e 2)

Tutorial em forma de caderno desenhado a giz de cera, jogável. O Ralsei entrega um manual feito à mão; ao virar
a página os desenhos ganham vida e o jogador mexe no coração **dentro da ilustração**, com as regras reais do
jogo. Começou como UMA página para validar a sensação (plano em
[plano-fases-2-6.md](plano-fases-2-6.md#fase-3-manual-interativo-do-ralsei)); agora são duas, com índice e progresso salvo.

Entrada: **Menu → GUIA → MANUAL DO RALSEI** abre o **índice** (cena `GuiaEntrada`, modo `indice`): CONTINUAR
(a primeira página que falta, só quando já há progresso), PÁGINA 1 e PÁGINA 2, com ✓ nas completas e os adesivos
da página 2 na dica. Uma página completa abre do zero ("jogar de novo"); a página 2 pela metade retoma na primeira
mini-lição que falta. `B` sai do manual a qualquer momento (volta ao índice; `B` de novo, ao GUIA e ao Menu). O guia
de antes, "CARTAS E ARENAS", continua intacto na outra opção do GUIA.

Navegação: página 1 → (a folha vira e a página 2 continua do mesmo papel, cena `ManualRalsei2`) → página 2 → (vira)
→ página 3 "continua…" → `A` volta ao índice.

## A página 1, "Este é o seu coração"

| Etapa (`pagina1.js`) | O que acontece |
| --- | --- |
| `intro` | Ralsei fala em 3 balões curtos (A passa; A durante a digitação completa o texto). |
| `desenhando` | O giz desenha a caixa, o coração e as 3 marcas (traço sendo riscado, ~2,7 s). |
| `marcas` | O jogador leva o coração às 3 marcas (estrela, X, estrela), em qualquer ordem. Cada marca vira um adesivo na fileira de cima. Uma seta torta "você!" aponta o coração até a 1ª marca. |
| `desviar` | 1,1 s de aviso e 6 bolinhas lentas (76 a 84 px/s, 3 mirando no coração) por 8 s. Barra de giz mostra o tempo. |
| `tentarDeNovo` | Acertou: risquinhos em volta do coração, fala de incentivo ("Quase! Tenta de novo?") e recomeça **só o desvio** em 1 s (ou já, com A). Cada erro deixa as balas 10% mais lentas (piso 60%). |
| `concluida` | Estrela dourada "PÁGINA 1 ✓" (adesivo metalizado) + confete de coraçõezinhos de papel. A vira a página. |
| `virando` / `fim` | A folha encolhe contra a espiral (0,9 s) com o verso curvando e sombra na página de baixo; atrás dela está a capa da página 2 (`montarCapaDaPagina2`), e a cena `ManualRalsei2` começa dali, sem fade. |

Uma instrução e uma ação de cada vez; botões na barra de baixo conforme o controle em uso (`botoes.js`:
teclado mostra as teclas reais do jogador 1 já remapeadas, controle mostra A/B, joystick serial BOTÃO A/B).

### Regras reais, de uma fonte só

As regras de bala e coração ficam em **`entities/fisica.js`** (puro, sem Phaser): `passoDoCoracao` (o `Heart.update`:
vetor limitado a 1, px/s, preso à caixa), `avisoDaBala`/`balaEntrando` (o telégrafo: parada e inofensiva, ou entrando
pela borda), `andarBala` (arranque, aceleração, teto de velocidade), `quicarNaCaixa`, `longeDaCaixa` (some a 160 px),
`foraDaCaixa` (bala inteira fora não acerta) e `folgaDaBala`/`acerta` (`folga <= hitbox`). **`Balas` (Bullets.js) e
`Heart` chamam essas funções**, e o manual também: `manual/onda.js` é uma "Pista" de bolso (as balas nascem com as
MESMAS opções de `a.bala({...})` e andam pelo mesmo laço de `Balas.atualizar`). As páginas 1 e 2 usam a onda.

`__tests__/paridade.test.js` prova: roda a classe **Balas e o Heart de verdade** (com um Phaser de mentira só de lógica,
`__tests__/apoio/`, ligado por `module.register`) lado a lado com o manual, com o mesmo joystick e dt variados, e confere
a posição de cada bala e do coração a cada quadro, o sumiço e o quadro/bala do acerto (página 1 e os 4 padrões da
página 2, parado, em zigue-zague e desviando bem). O coração mostra o miolo exato da hitbox; **o tremor do giz nunca
entra na colisão**.

## A página 2, "Vamos desviar?"

Ensina a **ler os padrões**, uma ideia de cada vez (`manual/pagina2.js`, puro; padrões em `manual/padroes.js`):

| Mini-lição | O padrão (versão mansa de um ataque de verdade) | Ralsei | Sobreviver |
| --- | --- | --- | --- |
| Chuva de cima | gotas nascem logo acima da caixa e caem acelerando até 95 px/s (`rain.js`: `entrando`, v² = v0² + 2·g·h); 1 em 3 cai na faixa do coração | "olhe para onde elas caem e fique no espaço vazio" | 6 s |
| Linha de lado | uma fileira de bolinhas (22 px entre centros: o coração não passa) entra pela esquerda e varre a caixa a 82 px/s com UM buraco de 66 px (≥ `LACUNA_MINIMA`, conferido com `validacao.lacunasLivres`); o próximo buraco fica a ≥ 70 px do anterior | "procure o buraco!" | 7 s |
| Mira em você | o tiro nasce fora da caixa (numa das 2 bordas mais longe, como `aimed.js`) mirando no coração; fica **parado e inofensivo 950 ms** (opção `aviso`, ≥ `ATAQUE.telegrafoMs`) enquanto uma **linha pontilhada de giz** mostra o caminho exato; depois vai reto a 110 px/s | "quando a linha aparecer, saia do caminho" | 6,5 s |
| Mistura curta | chuva fraquinha, uma fileira da esquerda, 2 tiros, uma fileira da direita (a 1ª já saiu), chuva e 1 tiro | "uma coisa de cada vez" | 10 s |

Fluxo de cada mini-lição: `explicar` (A) → `demo` (o **coração de giz verde do Ralsei** faz a onda curtinha sozinho,
pelo `pilotoDeDesvio`, com as mesmas regras; A pula; a mistura não tem) → `preparar` (1,1 s, o coração já anda) →
`tentar`. Acertou: risquinhos, fala de incentivo da própria mini-lição e recomeça **só ela** (1,4 s ou A), com o mesmo
padrão (mesma semente: dá para aprender). **3 erros na mesma**: `escolha` com ↑/↓ entre "tentar de novo" e "pular
esta parte" (A confirma; vale em qualquer controle). Cada mini-lição feita vira um adesivo redondo (gota, fileira com
buraco, alvo; a mistura ganha estrela dourada) na fileira de cima; pulada fica sem adesivo. No fim, estrela dourada
"PÁGINA 2 ✓" + confete e a folha vira para a página 3 "continua…". Com parte pulada a página também completa (a fala
convida a voltar para pegar o adesivo que faltou).

Ninguém fica parado: os testes (`padroes.test.js`) provam que **ficar parado leva acerto** em toda mini-lição e que o
piloto **sobrevive a todas** em várias sementes (o padrão é justo).

## Progresso salvo

Preferência `manual` em `preferencias.js`, validada por `manual/progresso.js` (lixo salvo vira "nada ainda", nunca
erro): `{ p1: { completa }, p2: { completa, licoes: [null | 'feita' | 'pulada' x4] } }`. A página 1 salva ao concluir;
a 2 salva cada mini-lição (pular nunca apaga um adesivo ganho) e a página ao concluir. `paginaParaRetomar` e
`resumoDoIndice` alimentam o índice.

## Música

`tutorial.mid` ("Caderno do Ralsei", **composição original**): valsa 3/4 de caixinha de música em Fá maior, 96 BPM,
32 compassos (A A' B A'', ~60 s) em loop exato; **celesta** na melodia, **pizzicato** no "um-dois-três" e **piano**
dedilhando o acorde bem baixinho. Toca no GUIA (`GuiaEntrada`) e na página 1. A página 2 toca `tutorial2.mid`: o
mesmo tema a 104 BPM, com **caixinha de música**, colcheia no pizzicato, piano em arpejo e um **glockenspiel**
respondendo (~55 s). Ao abrir "CARTAS E ARENAS" a música do menu volta. Volume: o slider de música, como todas.
Geradas por `scripts/musica/tutorial.mjs` com o escritor de MIDI mínimo `scripts/musica/midi.mjs` (sem dependência);
`src/game/__tests__/musicaTutorial.test.js` confere cabeçalho e trilhas, o loop (toda trilha termina no mesmo tick),
45 a 75 s, a região das notas de cada instrumento, note on/off pareados e que o `.mid` commitado é o que o script gera.

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
| `paginaBase.js` | **a base de toda página** (Phaser + canvas): `garantirPapel` (mesa/folha/espiral), `assar`/`assarCamadas`/`imagemDeCera`, `assarAdesivo`, `assarEstrelaDourada`, `assarLetreiro`, `assarRotulo`, `desenharFita`, `Balao` (digitação pulável), `RalseiDesenhado`, `Confete`, `brilhar`, `virarFolha`, `somDePapel`, e os pedaços jogáveis: `BalasDeGiz` (bolinhas com rastro), `coracaoDeGiz` (miolo exato da hitbox), `riscosDeGolpe`, `barraDeGiz`, `joyDeTodos` |
| `pagina1.js` | a máquina de estados da página 1 (as balas numa `onda`) |
| `onda.js` | a "Pista" de bolso: balas com as opções de `a.bala` e as regras de `entities/fisica.js`; `moverCoracao` |
| `padroes.js` | os roteiros da página 2 (`criarRoteiro`: chuva, linha, mira, mistura; com semente) e o `pilotoDeDesvio` |
| `pagina2.js` | a máquina de estados da página 2 (demo, tentativa, erro, escolha, adesivos, retomar) |
| `progresso.js` | validação e atualização do progresso salvo; o resumo do índice |

Desempenho: tudo o que não muda é **assado uma vez** numa textura de canvas (sementes fixas: reabrir a cena
reaproveita). Por quadro só se troca a textura das variantes (tremidinho a cada 170 ms, `VARIANTES = 3`) e se move
imagens; o "desenhando" repinta uma textura pequena (a área da caixa) por ~2,7 s.

## Acessibilidade

- "reduzir animações": giz parado, Ralsei parado (sem respirar/piscar/pular; as caras mudam), balão inteiro de uma
  vez, virada de página trocada na hora (corte), seta e brilhos parados, sem rastro das bolinhas, sem confete.
  **A linha pontilhada da mira fica** (é informação, não enfeite) e é parada (nunca pisca).
- Clarões desligados: sem confete. O confete segue o nível de "festa" dos gráficos.
- Nenhum clarão (acerto = risquinhos parados). Jogabilidade igual em qualquer ajuste.
- Contraste conferido em `__tests__/cera.test.js` (`contraste.js`): texto ≥ 4,5:1 no balão e no papel; bolinha e
  coração ≥ 3:1 no cartão da caixa.
- Texto em fonte clara com acentos (Verdana/DejaVu, negrito), nunca em letra "de mão".

## Como somar páginas

1. Lógica em `src/game/manual/paginaN.js`, puro, no formato de `criarPagina1`/`criarPagina2`: `etapa`, `tick(dt, joy)`,
   `avancar()`, `fala`, `drenar()` (eventos), mais testes em `__tests__/`. Balas SEMPRE por uma `criarOnda` (as
   regras de `entities/fisica.js`), com as opções de `a.bala`; um padrão novo ganha um caso em `paridade.test.js`.
2. Desenhos novos em `ilustracoes.js` (devolva camadas/traços; nada de Phaser).
3. Cena: use `paginaBase.js` (papel, `Balao`, `RalseiDesenhado`, adesivos, `virarFolha`, `somDePapel`); a página só
   monta o que é dela (cartão, doodles da margem nos lugares livres do seu layout, a ilustração jogável) e
   escolhe a cara do Ralsei com `expressaoDoRalsei` (ou uma regra sua). A página anterior mostra a capa desta atrás da
   folha que vira (exporte um `montarCapaDaPaginaN`) e troca de cena sem fade.
4. Registrar a cena em `config.js` e, se for cena de menu, em `rede.js` (`CENAS_DE_MENU`); somar a página em
   `progresso.js` (`PAGINAS`, formato e validação) e no índice.
5. Cena nova segue o padrão `estadoInicial()` (`__tests__/cenasReaproveitadas.test.js` cobre).

## Antes de produzir mais páginas

- O tremidinho do giz e a linha de dicas ainda são repetidos nas duas cenas (pequenos); dá para subir para a base.
- Testar com 2 pessoas novas (teste de saída da 3A) e anotar onde perguntaram.

## Testes e verificação

`npm test` cobre `manual/__tests__/` (giz, cera, papel, Ralsei e caras, balão/doodles, confete, contraste, máquinas de
estados das páginas 1 e 2, padrões com semente, "dá para passar" e "parado leva acerto", **paridade com Balas/Heart
reais**, progresso e a preferência salva, botões) e `__tests__/musicaTutorial.test.js` (o MIDI).
O fluxo completo foi jogado no navegador (Playwright + Chromium, software GL), normal e com "reduzir animações":
GUIA → índice vazio → página 1 inteira → virada para a página 2 → as 4 mini-lições (um erro de propósito e o recomeço
na chuva; a demo da linha pulada; 3 erros na mira e "pular esta parte"; a mistura) → estrela dourada → página 3
"continua…" → índice com ✓ nas duas → e, noutra aba com progresso parcial salvo, CONTINUAR · PÁGINA 2 retomando na
mini-lição 3 ("Que bom que você voltou!"). Nenhum erro de página.
