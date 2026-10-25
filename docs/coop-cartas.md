# CO-OP de cartas

O CO-OP continua sendo um modo separado do PVP, mas agora usa a mesma mecânica
de cartas: os dois jogadores (ou 1 jogador + CPU aliada) jogam cartas juntos
contra um chefe que também joga cartas. O chefe aparece no meio da mesa, com o
fundo maluco dele atrás, e os personagens da party ficam nos cantos reagindo.

Fluxo: Menu → CO-OP → EscolhaParty → Selecao (chefe) → Dificuldade (nível) →
**CoopArena** → Vitoria / GameOver (A: revanche na CoopArena). Numa sala (LAN
ou ONLINE) a arena roda no PC de cada um: ver "CO-OP em rede" em
[rede-pvp.md](rede-pvp.md).

## Quadro único

Pedido do dono: "ser um quadro só: o ataque do chefe vai para os dois, que
dividem um quadro único, para ser justo com os dois". O chefe joga **UMA carta
por rodada** e o ataque dela roda num **quadro único** no meio da mesa, embaixo
do chefe, com os dois corações dentro: os dois desviam do **mesmo** ataque.

- O quadro (`coop/quadro.js`) tem 336 x 180 (a caixa de um jogador no PvP tem
  220 x 170) e fica embaixo do chefe; na esquiva as mãos descem até sumir, e
  embaixo dele fica uma linha com o nome do ataque e o dano por acerto. Os
  corações começam lado a lado (P1 à esquerda, P2 à direita); sozinho no quadro,
  no meio. A borda é branca (é dos dois) e pisca na cor de quem levou o acerto.
- A carta do chefe (a intenção) fica embaixo dele, com o naipe à vista e o nome
  (ATAQUE, CONTROLE...) do lado; na revelação mostra o nome e o dano por acerto.
- As cartas de ataque dos jogadores ficam **carregando** no canto de cada um, em
  cima do personagem; os avisos de cada um (CAIU!, CONTROLES INVERTIDOS!,
  ESCUDO!) também ficam no canto dele.
- **O que mexe na carta do chefe vale para os dois**: A♠ reflete, A♦ anula, A♣
  rouba, o SUPER de um jogador varre (não o SUPER do chefe) e o ♦ deixa o ataque
  mais lento. **O resto é de cada um**: escudo (o dano por acerto de cada um sai
  com o escudo dele), dano, grazes, desvio perfeito, combo de perfeitos e CRÍTICO.
- **Quem está caído não está no quadro** (o coração dele some). Fica no quadro
  quem estava de pé quando o chefe mostrou a carta: quem levanta na rodada (cura
  de copas, A♥) entra no próximo. Quem cai no meio da esquiva some do quadro e o
  outro continua; o quadro para quando não sobra ninguém nele.
- **Miras**: os ataques que miram "o coração" (`a.alvo()` em
  `attacks/contexto.js`) alternam entre os dois corações de pé, um tiro para
  cada; as escolhas que fogem dos corações (`a.pontoLonge`, as bombas, o
  carrossel) olham os dois. A CPU aliada desvia no mesmo quadro (EsquivaBot, no
  coração dela).

## Rodada

1. **Início**: energia (como no PvP: 3, depois +2, teto 10), mãos completas (5).
   Se alguém está de pé, o chefe compra e mostra **uma carta virada** (a
   *intenção*, para os dois), com o naipe à vista: ♠ ataque, ♦ controle, ♣
   armadilha, ♥ ele se cura.
2. **Escolha**: os dois escolhem juntos (igual ao PvP: ←/→, A, B, PASSAR, relógio).
3. **Revelação**: as cartas dos jogadores e a do chefe viram.
4. **Arremesso**: o quadro abre e a carta do chefe voa para ele (refletida,
   anulada, roubada ou varrida, ela sai da mesa e ninguém desvia). As cartas de
   ataque dos jogadores ficam **carregando** no canto de cada um.
5. **Esquiva**: os dois desviam do ataque no quadro. Grazes dão energia (e
   carregam a ♣ armadilha). Quem zerar o HP **cai**. Desvio perfeito (de cada
   um) dá energia pela carta do chefe, como no PvP, multiplicada pelo **combo de
   perfeitos** (ver abaixo).
6. **Contra-ataque**: com o quadro fechado, as cartas carregadas voam no chefe.
   - desvio perfeito (passou pelo ataque sem levar dano): **CRÍTICO ×1,5**
     (fixo: o combo de perfeitos multiplica só a energia, não o golpe)
   - os dois atacam com o mesmo naipe: **COMBO ×1,25**; mesmo valor: **PAR ×1,5**
   - os dois jogam SUPER na mesma rodada: **SUPER COMBO** — juntos tiram 40%
     (FÁCIL), 45% (MÉDIO) ou 50% (DIFÍCIL) do HP máximo do chefe (os dois efeitos
     acontecem juntos em cima do chefe e fecham numa explosão). Forte, mas não
     acaba a luta: ver "SUPER no chefe" abaixo
   - quem caiu na esquiva perde o golpe
7. **Fim**: chefe a 0 → vitória; os dois caídos → game over. Troca de fase do
   chefe (fala de entrada, fundo mais agitado, cartas novas no baralho dele).

## Combo de perfeitos

Igual ao PvP (`docs/pvp-regras.md`, mesmas funções de `pvp/regras.js`,
reexportadas em `coop/regras.js`: `registrarPerfeitoCombo`, `quebrarSequencia`,
`COMBO_PERFEITO`). Cada jogador (e a CPU aliada) tem a sua sequência de rodadas
seguidas com desvio perfeito:

- 1º perfeito x1, 2º seguido x2, 3º x3, 4º em diante **x4** (teto). A energia
  do perfeito pela carta do chefe (2-8 +1, 9-Q +2, K/SUPER +3) é multiplicada,
  sempre respeitando o teto de 10.
- **Quebra**: qualquer acerto (`aplicarDanoCoop`); cair também zera.
- **Não conta e não quebra**: rodada sem quadro para ele (caído, carta do chefe
  roubada, anulada, refletida ou varrida pelo SUPER) e o quadro com a carta de
  copas do chefe (o ataque fraquinho não dá energia de perfeito). Nesse caso o
  CRÍTICO ainda vale se passou sem levar dano.
- O **CRÍTICO ×1,5** do contra-ataque continua igual com qualquer combo.

Visual e som são os da arena PvP: "PERFEITO x2!", "PERFEITO x3!!"... maiores e
mais brilhantes, aplausos sobrepostos, mais fogos e confete, tremida leve; o
combo atual fica no HUD de cada um e um "COMBO QUEBROU" pequeno avisa quando
quebra. `coopArena.estadoDebug()` traz `perfeitos`, `combos`, `acertosRodada`
e `jogadores[j].sequencia`.

## Cartas dos jogadores contra o chefe

| Carta | Efeito no CO-OP |
|---|---|
| ♠ espadas | golpe forte: 8 + 3,2 × valor (2 → 14, K → 50) |
| ♦ ouros | golpe médio (5 + 2,2 × valor) e **atrasa** o ataque do chefe, para os dois (balas 15% mais lentas; Q/K: 25%). Dois ♦ não somam: vale o mais forte |
| ♣ paus | golpe 6 + 2,5 × valor, **+6% por graze** na esquiva (até +60%) |
| ♥ copas | suporte: **cura e escudo valem para os dois** (o texto da carta no CO-OP avisa: `descricaoCoop` em `coop/regras.js`); energia e compra para quem jogou. Cura **levanta** o parceiro caído |
| ★ SUPER | custa **8** no CO-OP (10 no PvP); animação do personagem, golpe de **33% do HP máximo do chefe** (mínimo 60) com o efeito dele em cima do chefe (espadas, machado, fogo, gelo, lâminas, ondas de choque, buraco negro) e **varre** o ataque do chefe do quadro (para os dois). O texto da carta na luta mostra o número de verdade |
| A♠ Espelho | o ataque do chefe volta e acerta ele (golpe = 3 acertos da carta); ninguém desvia. Sem nada para refletir: golpe de um 7♠ (o eco) |
| A♦ Anular | cancela o ataque do chefe (ninguém desvia) e tira 2 da carga do SUPER dele |
| A♣ Roubo | rouba o ataque do chefe (ninguém desvia) e +2 de energia para quem jogou |
| A♥ Segunda chance | os dois curam 25% e ninguém cai nesta rodada (levanta quem caiu) |

O SUPER do chefe não pode ser anulado, refletido, roubado nem varrido.

Mais de um na mesma rodada: o SUPER varre primeiro, depois Espelho, Anular e
Roubo (vale o primeiro que pega a carta). O que chega depois ainda faz o resto:
o 2º Espelho vira o eco, o 2º Anular ainda tira carga, o 2º Roubo ainda dá a
energia.

## SUPER no chefe

Pedido do dono: "2 SUPERs nos chefes não podem matar instantaneamente, mas
também não podem dar pouco dano". Antes o SUPER era 180 fixo e o SUPER COMBO
×1,5 em cada (540, 810 com CRÍTICO): matava qualquer chefe de HP cheio no FÁCIL
e no MÉDIO (de 141% a 225% do HP) e quase todos no DIFÍCIL (Queen morria, King
e Coronel sobravam com 7 HP); um SUPER sozinho tirava 56–75% do HP no FÁCIL.

Agora tudo é fração do HP máximo do chefe (que já vem com o nível), em
`COOP` (`coop/regras.js`: `danoDoSuper`, `fracaoDoCombo`, `limiteDoSuper`):

| | FÁCIL | MÉDIO | DIFÍCIL |
|---|---|---|---|
| SUPER sozinho (`superGolpe`, piso `superPiso` 60) | 33% | 33% | 33% |
| SUPER COMBO, os dois juntos (`superCombo`, metade em cada) | 40% | 45% | 50% |

- **Teto**: o SUPER da rodada (um ou os dois, com CRÍTICO e GUARDA) nunca passa
  do SUPER COMBO do nível. O CRÍTICO do SUPER só acontece na rodada do SUPER do
  chefe (fora dela a caixa é varrida e não há esquiva).
- **Não acaba a luta**: chefe com mais da metade do HP (`superFinaliza`) aguenta
  qualquer SUPER com pelo menos 10% do HP (`superSobra`); a arena mostra
  "AGUENTOU!". Do HP cheio, o combo deixa o chefe com 50–60%.
- **Não pula fase**: o SUPER avança no máximo uma fase do chefe (o chefe fica
  acima do limite da fase depois da próxima).
- **Pode finalizar**: com o chefe já na metade ou menos, o combo acaba a luta
  (é o golpe de fim de luta da dupla que guardou energia junto).
- O combo escala com o nível porque as lutas do DIFÍCIL são duas vezes mais
  longas (10–14 rodadas contra 4–9): metade da barra lá é menos decisiva do que
  40% numa luta de 5 rodadas do FÁCIL.
- Os limites só cortam o SUPER (`limitado: true` no golpe); a carta comum do
  parceiro na mesma rodada bate inteira.
- Troca honesta: dois SUPER em rodadas separadas somam 66%, mais que o combo
  (40–50%); o combo entrega o dano de uma vez e varre as duas caixas na mesma
  rodada. O SUPER sozinho continua bem acima da melhor carta (K♠: 50, ou 75 com
  CRÍTICO; o SUPER vai de 79 no King FÁCIL a 214 no Jevil DIFÍCIL).

Do HP cheio (antes → depois):

| Chefe | HP F / M / D | combo antes | combo depois (sobra) |
|---|---|---|---|
| King | 240 / 288 / 547 | mata / mata / sobra 7 (crítico mata) | 96 (144) / 130 (158) / 274 (273) |
| Queen | 270 / 324 / 436 | mata / mata / mata | 108 (162) / 146 (178) / 218 (218) |
| Jevil | 310 / 372 / 648 | mata / mata / sobra 108 (crítico mata) | 124 (186) / 167 (205) / 323 (325) |
| Coronel | 320 / 384 / 547 | mata / mata / sobra 7 (crítico mata) | 128 (192) / 172 (212) / 273 (274) |

## Chefe

- Baralho por fase (`src/game/coop/chefes/<id>.js`): cada fase do chefe embaralha
  cartas novas. Cada carta tem naipe, valor, nome e ataque (da biblioteca `attacks/`).
- ♥ do chefe: ele se cura e/ou levanta a **guarda** (o próximo contra-ataque
  causa menos dano) e manda só um ataque fraco (no quadro, nos dois). A cura é
  o **dobro** da escrita na carta (`COOP.curaChefe`): ele joga uma carta por
  rodada em vez de duas, então cura com a metade da frequência; assim a cura
  por rodada continua a mesma de antes.
- Dano por bala: `danoBala` do chefe, escalado pelo valor da carta e pelo nível.
- **SUPER do chefe** (★): a carga sobe 1 por rodada desde o começo e enche a
  cada **10 rodadas** (rodada 10, 20...): a carta da rodada é o SUPER, no
  quadro dos dois. O alto da mesa mostra quantas rodadas faltam.
- HP próprio do modo cartas (`hp` no baralho do chefe) × nível:
  King 240, Queen 270, Jevil 310, Coronel 320 no FÁCIL.
- Dano por bala das cartas do chefe: `danoBala` × 0,45 (2) a 0,75 (K); SUPER × 0,9;
  o ataque fraquinho do ♥ × 0,3; tudo × o dano do nível × 1,1 no quadro
  (`COOP.danoQuadro`, ver "Quadro único: o equilíbrio").
- **Nível da luta** (`nivelDoChefe(chefe, nivel)` em `coop/chefes/index.js`):
  `NIVEIS[nivel]` (`constants.js`) vezes o ajuste do chefe naquele nível
  (`niveis` no arquivo do chefe). Vale para ritmo (velocidade e densidade das
  balas), teto de velocidade, dano e HP. Hoje só o DIFÍCIL tem ajuste por chefe:

  | DIFÍCIL | ritmo (vel./dens./teto) | dano | HP | por acerto (carta mais forte / SUPER) |
  |---|---|---|---|---|
  | base (`NIVEIS.dificil`) | ×1,45 / ×1,6 / ×1,3 | ×2 | ×1,9 | |
  | King | base × 1,5 / 1,7 / 1,4 | base × 1,8 | base × 1,2 (547) | 20 / 25 |
  | Queen | base × 0,97 / 0,95 / 1 | base | base × 0,85 (436) | 18 / 22 |
  | Jevil | base × 1,15 / 1,25 / 1,1 | base × 1,15 | base × 1,1 (648) | 25 / 30 |
  | Coronel | base | base × 1,1 | base × 0,9 (547) | 22 / 26 |

  A dificuldade vem do RITMO (balas mais rápidas e densas), não de dano
  inflado: nenhum acerto passa de ~30 (os personagens têm 80 a 110 de HP; os
  números já trazem o × 1,1 do quadro).

### Balanceamento medido (`scripts/balanceamento/`)

`medirChefes.mjs` roda cada carta de cada chefe numa caixa do tamanho da
arena, com o ritmo, o teto e o dano de verdade de cada nível. O EsquivaBot
desvia como um jogador "perfeito" (bot difícil) e como um "médio" (bot normal),
e a medição guarda os acertos de cada rodada. `simularCoop.mjs` joga partidas
inteiras com as regras e a CPU aliada, sorteando os acertos de cada caixa
dessas amostras.

Vitórias no DIFÍCIL (600 partidas por linha; antes do ajuste → depois):

| Chefe | Dupla perfeita | Um de cada | Dupla média |
|---|---|---|---|
| King | 100% → 100% | 100% → 91% | 100% → 19% |
| Queen | 100% → 100% | 99% → 81% | 51% → 13% |
| Jevil | 100% → 94% | 100% → 71% | 72% → 7% |
| Coronel | 100% → 89% | 98% → 55% | 55% → 2% |

Coronel com o TRÂNSITO (caminhonete estilo Frogger: faixas em fila, vãos
garantidos, faróis avisando e ré com luz de freio) e o FORCADO novo (estoca
de cima/de baixo, crava e espirra palha); "Atropela e Espeta" é o forcado
estocando no meio do trânsito. Esses ataques já apertam sozinhos, então o
Coronel não tem ritmo extra no DIFÍCIL.

Depois do SUPER novo (seção "SUPER no chefe"; `simularCoop.mjs` com 600
partidas por linha, medição nova de `medirChefes.mjs` com 6 sementes; antes →
depois). FÁCIL e MÉDIO ficam em 96–100% para as duplas perfeita e mista; as
mudanças maiores são nas linhas apertadas da dupla média:

| Chefe | perfeita F / M / D | mista F / M / D | média F / M / D |
|---|---|---|---|
| King | 100 / 100 / 100 → igual | 100 / 100 / 95 → igual | 100 / 100 / 28 → igual |
| Queen | 100 / 100 / 100 → igual | 100 / 100 / 98 → 100 / 100 / 97 | 100 / 96 / 22 → 100 / 96 / 15 |
| Jevil | 100 / 100 / 94 → 100 / 100 / 93 | 100 / 100 / 64 → 100 / 100 / 68 | 100 / 99 / 2 → 100 / 99 / 3 |
| Coronel | 100 / 100 / 96 → igual | 100 / 100 / 70 → igual | 96 / 56 / 1 → 96 / 43 / 1 |

As lutas ficam de 0,2 a 1 rodada mais longas (o SUPER sozinho do FÁCIL/MÉDIO
era 47–75% do HP). Na simulação o SUPER COMBO sai pouco (a CPU não combina com o
parceiro: 0,01–0,06 por luta); nenhum SUPER matou chefe acima da metade do HP
nem pulou fase (antes: até 4% das lutas acabavam num combo vindo de mais da metade do HP).

Lutas de ~9 a 14 rodadas. A dupla "perfeita" (o bot difícil desviando) erra
quase nada; "um de cada" é o mais parecido com uma dupla de gente.
FÁCIL e MÉDIO não mudaram.

### Quadro único: o equilíbrio

Cada um continua desviando de um ataque por rodada, mas o chefe gasta metade
das cartas, e o que mexe na carta dele (A♠, A♦, A♣, SUPER) agora protege os
dois. Medido antes de mexer em números (`medirChefes.mjs` com `MODO=caixa`, a
caixa antiga de um coração, e `MODO=quadro`, os dois corações no quadro, cada um
com o seu bot; 6 sementes, então 6 amostras por carta e nível na caixa e 12 no
quadro):

- **Acertos por coração**: no quadro maior, com os mirados alternando entre os
  dois, cada coração levava em média 23% menos acertos (de −4% a −50% por chefe,
  nível e bot; só uma linha subiu;
  ex.: Coronel MÉDIO/médio 1,70 → 1,38, King DIFÍCIL/perfeito 0,36 → 0,18). Com
  `QUADRO.ritmo.densidade` 1,3 (30% mais balas) voltou à faixa da caixa antiga
  (King/Queen/Jevil de −10% a +25%, Coronel ainda −5% a −20%).
- **Só a regra nova** (a mesma taxa de acertos de antes): a dupla média ganhava
  bem mais no DIFÍCIL (King 31% → 55%, Queen 26% → 52%), porque um Ás ou um
  SUPER tira o ataque dos dois e o chefe cura metade das vezes.
- Ajustes: o chefe cura o **dobro** por carta ♥ (`COOP.curaChefe` 2: a cura dele
  por rodada fica a de antes), o ataque no quadro tem **30% mais densidade**
  (`QUADRO.ritmo`) e o acerto no quadro dói **10% a mais** (`COOP.danoQuadro`
  1,1). A CPU aliada dá mais valor aos Ases quando o parceiro está no quadro
  (tirar o ataque protege os dois).

Vitórias (`simularCoop.mjs`, 600 partidas por linha; caixas antigas →
quadro único com os ajustes):

| Chefe | perfeita F / M / D | mista F / M / D | média F / M / D |
|---|---|---|---|
| King | 100 / 100 / 100 → igual | 100 / 100 / 99 → 100 / 100 / 97 | 100 / 100 / 31 → 100 / 100 / 26 |
| Queen | 100 / 100 / 100 → igual | 100 / 100 / 99 → 100 / 100 / 96 | 100 / 98 / 26 → 100 / 93 / 27 |
| Jevil | 100 / 100 / 91 → 100 / 100 / 90 | 100 / 100 / 65 → 100 / 100 / 79 | 100 / 98 / 3 → 100 / 98 / 13 |
| Coronel | 100 / 100 / 100 → igual | 100 / 100 / 88 → 100 / 100 / 97 | 98 / 66 / 1 → 99 / 86 / 13 |

Rodadas por luta quase iguais (King FÁCIL 4,3 → 4,8; Jevil DIFÍCIL misto 12,7 →
12,6). King e Queen ficaram onde estavam; Jevil e Coronel ficaram um pouco mais
vencíveis para a dupla média e a mista no DIFÍCIL (a dupla média ainda perde
quase sempre), e o Coronel MÉDIO saiu do aperto da dupla média (66% → 86%).
Nenhum chefe ficou fácil para quem não desvia bem.

Todos os números ficam em `COOP` e `GOLPE` (`coop/regras.js`), `DANO_CHEFE`
(`coop/cartasChefe.js`), `NIVEIS` (`constants.js`) e `niveis` de cada chefe.

## Caídos

HP 0 → cai: não joga cartas e não entra no quadro (o coração dele some). Volta
sozinho depois de 2 rodadas (30% do HP), ou antes, com uma cura de copas do
parceiro (aí entra no quadro na rodada seguinte).

## Arquivos

| Arquivo | O que faz |
|---|---|
| `src/game/coop/regras.js` | regras puras (testáveis em Node): partida, a carta do chefe, resolução, o quadro, golpes, caídos, fases |
| `src/game/coop/quadro.js` | a geometria do quadro único (e o aperto extra dele), usada pela arena e pela medição |
| `src/game/coop/chefes/` | os 4 chefes: dados (nome, arte, música, falas, tema) e baralho por fase |
| `src/game/coop/cartasChefe.js` | cartas do chefe → ataque (com a biblioteca injetada) |
| `src/game/coop/superNoChefe.js` | o efeito de cada SUPER em cima do chefe |
| `src/game/coop/bot.js` | CPU aliada (1 jogador) |
| `src/game/scenes/CoopArena.js` | a cena (estende a PvpArena: mesma escolha de cartas) |
| `src/game/coop/ArenaRedeCoop.js` | a ponte da partida em rede (estende `pvp/rede/ArenaRede.js`) |
| `src/game/coop/__tests__/` | testes |

## Testes

- `npm test` roda também `src/game/coop/__tests__/` (regras do quadro único,
  cartas dos chefes, CPU aliada, a geometria do quadro e uma partida simulada até
  o fim contra cada chefe).
- No navegador (dev): `window.coopArena` (`estadoDebug()`, com `quadro`:
  carta, destino, quem está nele e o dano de cada um; `setHp(j, hp)`,
  `setHpChefe(hp)`, `forcarMao(j, ids)`, `setEnergia(j, n)`). Em rede valem nos
  dois PCs.
- Balanceamento: com o jogo rodando, `node scripts/balanceamento/medirChefes.mjs
  chefes.json` (modo quadro) e `node scripts/balanceamento/simularCoop.mjs
  chefes.json 600`.
