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

## CO-OP de 3 e 4 (online, Fase 5B)

Só nas salas de amigos ONLINE: o dono escolhe **CO-OP 3–4** (`coop4`, 3 ou 4 jogadores) no lobby. Com 2
jogadores o CO-OP continua o `coop` de sempre (a `CoopArena`, sem nenhuma mudança). Fluxo:
Lobby → `EscolhaPartyN` → `Selecao` (chefe) → `Dificuldade` (nível) → **`CoopArenaN`** → `Vitoria` / `GameOver` → lobby.
O host da partida (o eleito, [rede-pvp.md](rede-pvp.md)) troca as cenas com `irParaCena` e cada convidado confirma
que abriu (`cenaOk`). As regras são as mesmas deste documento, generalizadas para N em `coop/regras.js`
(`resolverRodadaCoop(estado, ...jogadas)` aceita uma jogada por jogador); o que o grupo acrescenta está abaixo.

- **Party**: cada um escolhe o PRÓPRIO personagem, sem repetir (o baralho de cada personagem é só dele). Quem arbitra é
  o host: o primeiro pedido a chegar leva o personagem e quem perdeu vê "FULANO pegou X primeiro". Confirmar é
  definitivo; com todos confirmados o host leva todos à `Selecao`. A party vai **por vaga** (`party[vaga]`), não por lado.
- **Quadro único com N corações**: o quadro cresce com o grupo (`quadroDoGrupo`, até o campo dele: 3 jogadores
  386×187, 4 jogadores 437×194 contra 336×180 de 2) e os corações começam lado a lado em ordem de vaga.
  Cada coração é identificado por **três pistas, a cor nunca é a única**: a cor da vaga (`game/vagas.js`), uma
  **forma** (P1 círculo, P2 quadrado, P3 triângulo, P4 losango) e o **nome** do jogador em cima dele. Os mesmos
  formato e cor aparecem no cartão do jogador no HUD e na carta revelada. As cores P3/P4 de protanopia,
  deuteranopia e tritanopia foram trocadas na 5B (o P4 era quase igual ao P1 para quem tem protanopia, ΔE 9);
  `src/game/__tests__/coresDasVagas.test.js` confere os quatro modos (ΔE ≥ 40 entre as quatro vagas, longe das
  balas brancas e do aviso, 3:1 contra o fundo).
- **Sem colisão entre aliados**: o coração só leva dano de bala (cada um só se machuca no PC dele); aliados se
  atravessam. O meu coração anda pelo meu joystick e colide aqui; os dos outros são espelho (andam pelas posições que
  chegam, interpoladas) e não colidem aqui.
- **HUD de 4** (854×480): um cartão de 190×62 por jogador no alto (vagas 0 e 1 à esquerda do relógio, 2 e 3 à direita):
  forma + nome, **estado da mão** (ESCOLHENDO / PRONTO / CAÍDO volta em N / SEM CONEXÃO (volta caído) 12s / SAIU), barra e número de HP,
  as 10 gemas de energia, o combo de perfeitos, escudo / 2ª chance e as cartas da mão. O cartão do jogador deste PC
  tem borda grossa e "VOCÊ". Só a MINHA mão aparece na tela (cursor, prévia e PASSAR são só meus): as cartas dos outros
  só viram na revelação, com o nome de cada um em cima.

### Mira do chefe: rodízio

Antes, os ataques mirados (`a.alvo()`) alternavam entre todos. Num grupo de 3 ou mais o chefe **escolhe quem mira** a
cada rodada (`escolherMira`, `coop/regras.js`):

- de pé = não caído, com conexão e que não saiu; com 2 ou menos de pé, mira em todos (como no CO-OP de 2);
- com 3 ou mais de pé, mira em **metade deles, arredondada para cima** (3 de pé: 2; 4 de pé: 2);
- os escolhidos são **os que levaram mira há mais tempo** (`ultimaMira`); empate: o mirado menos vezes, depois a menor vaga.
  Com 4 de pé cada um é mirado a cada duas rodadas; com 3 de pé a diferença entre dois jogadores nunca passa de uma
  mira; quem volta de uma queda ou foi resgatado passa na frente da fila.

Os tiros mirados só vão para os corações dos escolhidos (`ContextoAtaque.mira`, o resto do ataque, como paredes,
chuvas e áreas dos SUPER, é para todos). **A mira aparece antes do ataque**: o nome dos alvos ("ALVO: ANA · CAIO") sai
junto da carta do chefe, os personagens deles ganham "ALVO!" e, quando o quadro abre, cada coração mirado ganha uma mira
girando (anel com 4 pontas) e o nome dos alvos fica na linha de baixo do quadro.

### Resgate e apoio

- **♥ cura e escudo**: com 2 jogadores valem para os dois. Num grupo valem para **quem jogou e até 2 aliados**
  (`GRUPO[n].apoioAliados`): primeiro os caídos (o que caiu há mais tempo), depois os de menor fração de HP. O ♥ continua
  **levantando** o caído (com pelo menos 25% do HP máx). O texto da carta mostra "VOCÊ E 2 ALIADOS (os caídos primeiro,
  depois os mais feridos)" e a revelação mostra "APOIA FULANO+CICRANO". O **A♥ (Segunda chance)** vale para **todos**
  e levanta todos os caídos.
- **Resgate por rodada limpa** (novo, só no grupo): se havia quadro e **ninguém no quadro levou um acerto**, o caído há
  mais tempo volta na hora do fim da rodada, com 30% do HP (`resgatarPorRodadaLimpa`). É o jeito de salvar um aliado só
  com esquiva, sem gastar carta; aparece "RODADA LIMPA! FULANO VOLTA" e "RESGATADO!". Rodada sem quadro (A♠/A♦/A♣/SUPER
  tiraram o ataque) não vale. A volta sozinha depois de 2 rodadas continua.

### Combos de carta no grupo

- **COMBO** (mesmo naipe, ×1,25) e **PAR** (mesmo valor, ×1,5) valem para quem combina com **qualquer outro** golpe comum
  da rodada, cada um com o seu grupo: três espadas valem ×1,35 em cada, quatro ×1,45 (`COOP.comboGrupo` 0,10 por
  jogador a mais). Dois do mesmo naipe e um de outro: só os dois combinam. Caído não combina.
- **SUPER COMBO**: 2 ou mais SUPER na mesma rodada. O teto e a divisão seguem o do CO-OP de 2 (40/45/50% do HP máx por
  nível, dividido entre os SUPER) e sobe `COOP.superComboGrupo` (25%) por SUPER a mais (3 SUPER: +25%; 4: +50%), então o
  terceiro e o quarto SUPER não são jogados fora. O chefe com mais da metade do HP continua aguentando.

### Equilíbrio por tamanho (provisório; a 5C mede e ajusta)

`GRUPO[n]` em `coop/regras.js` (3 e 4 jogadores) mexe em **quatro frentes**, não só na vida do chefe:

| | 2 (como sempre) | 3 | 4 |
|---|---|---|---|
| vida do chefe (`hpChefe`) | ×1 | ×1,60 | ×2,20 |
| densidade das balas do quadro (`densidade`) | ×1 | ×1,15 | ×1,30 |
| espaço do quadro (`espaco`, largura × altura) | 336×180 | ×1,15 × ×1,04 | ×1,30 × ×1,08 |
| aliados que o ♥ alcança (`apoioAliados`) | o outro | 2 | 2 |
| mira por rodada (`miraPorRodada`) | todos | metade | metade |

A vida do chefe sozinha só mantém a **duração** da luta: cada jogador a mais bate nele, então ×1,35/×1,70 deixavam a luta de 4 em
4,7 rodadas (contra 6,5 de 2, no FÁCIL); com ×1,60 e ×2,20 as lutas ficam em 6,6 e 6,1 rodadas (`scripts/balanceamento/simularGrupo.mjs`,
uma simulação grossa com os bots aliados e acertos sorteados, que mostra também que o grupo ainda ganha mais que a dupla: no DIFÍCIL
com muitos acertos a dupla vence 55% e os de 3 e 4 vencem 100%). Por isso densidade, espaço e apoio são os botões que a 5C deve
mexer para dar perigo ao grupo.

A densidade soma à do quadro de 2 (`QUADRO.ritmo`, 30% a mais). Tudo o resto (SUPER do chefe a cada 10 rodadas, dano por
acerto, cura do chefe, `retornoRodadas`) ficou como no CO-OP de 2.

### Queda e volta no meio da luta

Sala de 3 ou 4 (5A): quem cai da rede fica **20 s** na vaga; os outros **não param**. Na hora o cartão dele diz
"SEM CONEXÃO (volta caído) 12s", o personagem fica apagado e o coração some do quadro. A rodada que está rolando termina sem ele (o
host não espera a jogada nem o fim da esquiva dele; jogada = passar, sem energia). O host marca `ausente` no estado a
cada rodada (`definirPresenca`): **fora do quadro, fora da mira, sem carta** (e quem está ausente não segura a
derrota: perde quando todos os que ainda estão na luta caíram).

- **Volta caído (regra anti-fuga)**: quem cai da rede durante a luta é **derrubado na hora** (HP 0, o mesmo estado de
  quem foi nocauteado). Só o host marca (`derrubarAusentes`, a cada tick e no começo da rodada), então vale mesmo que o
  convidado nunca volte e puxar o cabo no meio do SUPER do chefe (ou numa rodada ruim) não desvia o dano: ele não volta
  com o HP de antes. O resgate é o de sempre: rodada limpa (o caído há mais tempo volta com 30%), ♥ e A♥; a volta
  sozinha após `retornoRodadas` não corre enquanto ele está sem conexão. Dentro ou depois dos 20 s é igual (depois,
  `saiu`). Quem já estava caído continua caído. Quem cai da rede não conta como de pé: se os que sobram estão todos
  caídos, a derrota é a de sempre. O CO-OP de 2 e o PVP não mudam.
- **Voltou em 20 s**: o host manda a cena só para ele (`dadosRetomadaPara`, 5A) com o **estado de agora**. Ele vê a luta
  como está (HP, energia, o monte dele) e **entra na próxima rodada** ("VOCÊ VOLTOU! entra na próxima rodada"); o
  que sobrar da rodada atual ele ignora. Ele **continua caído**: na rodada em que entra, todos veem "voltou caído:
  precisa de resgate" (evento `voltouCaido` do `inicio`).
- **Não voltou**: sai da luta de vez (`saiu`: o cartão diz SAIU, o coração e a mira somem e ele não volta); a luta
  continua com os outros e o servidor registra o abandono dele (sem XP, [online.md](online.md)).
- **Caiu o host**: como na 2D, todos param e a rodada volta ao começo (ponto de retomada); sem volta em 20 s a sala fecha.

### Pendências (ideias para a 5C)

- medir as lutas de 3 e 4 (`scripts/balanceamento/` ainda é de 2): vitória por chefe/nível/grupo, rodadas por luta, e ajustar `GRUPO[n]`;
- o SUPER do chefe (carga de 10 rodadas) e a lentidão do ♦ podem escalar com o grupo; hoje não escalam;
- dano por acerto e HP dos personagens nos grupos grandes (cada coração a mais é mais um lugar para uma bala acertar);
- o resgate por rodada limpa pode precisar de um piso (ex.: só 1 resgate a cada 3 rodadas) se virar fácil demais com 4;
- um combo de equipe de verdade (ex.: um naipe de cada: ♠♦♣♥ juntos), hoje só as combinações de naipe e valor;
- a CPU aliada (`bot.js`) já sabe escolher o aliado que mais precisa, mas o modo de 3–4 não tem CPU: dá para completar a
  sala com CPU depois.

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
| `src/game/coop/ArenaRedeCoopN.js` · `scenes/CoopArenaN.js` · `scenes/EscolhaPartyN.js` · `coop/HudCoopN.js` · `coop/partyN.js` · `coop/marcadores.js` | o CO-OP de 3 e 4: ponte em estrela, arena, escolha de party, HUD, party e formas dos corações (5B) |
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
