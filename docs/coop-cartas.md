# CO-OP de cartas

O CO-OP continua sendo um modo separado do PVP, mas agora usa a mesma mecânica
de cartas: os dois jogadores (ou 1 jogador + CPU aliada) jogam cartas juntos
contra um chefe que também joga cartas. O chefe aparece no meio da mesa, com o
fundo maluco dele atrás, e os personagens da party ficam nos cantos reagindo.

Fluxo: Menu → CO-OP → EscolhaParty → Selecao (chefe) → Dificuldade (nível) →
**CoopArena** → Vitoria / GameOver (A: revanche na CoopArena).

## Rodada

1. **Início**: energia (como no PvP: 3, depois +2, teto 10), mãos completas (5).
   O chefe compra e mostra **uma carta virada para cada jogador em pé**, com o
   naipe à vista (a *intenção*: ♠ ataque, ♦ controle, ♣ armadilha, ♥ ele se cura).
2. **Escolha**: os dois escolhem juntos (igual ao PvP: ←/→, A, B, PASSAR, relógio).
3. **Revelação**: as cartas dos jogadores e as do chefe viram.
4. **Arremesso**: cada carta do chefe voa para a caixa do jogador que ela mira.
   As cartas de ataque dos jogadores ficam **carregando** em cima da caixa de
   cada um.
5. **Esquiva**: cada um desvia do ataque do chefe na sua caixa. Grazes dão
   energia (e carregam a ♣ armadilha). Quem zerar o HP **cai**. Desvio
   perfeito dá energia pela carta do chefe, como no PvP, multiplicada pelo
   **combo de perfeitos** (ver abaixo).
6. **Contra-ataque**: com as caixas fechadas, as cartas carregadas voam no chefe.
   - desvio perfeito (passou pelo ataque sem levar dano): **CRÍTICO ×1,5**
     (fixo: o combo de perfeitos multiplica só a energia, não o golpe)
   - os dois atacam com o mesmo naipe: **COMBO ×1,25**; mesmo valor: **PAR ×1,5**
   - os dois jogam SUPER na mesma rodada: **SUPER COMBO ×1,5** em cada SUPER
     (os dois efeitos acontecem juntos em cima do chefe e fecham numa explosão)
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
- **Não conta e não quebra**: rodada sem caixa (caído, carta do chefe roubada,
  anulada ou varrida pelo SUPER) e caixa com a carta de copas do chefe (o ataque
  fraquinho não dá energia de perfeito). Nesse caso o CRÍTICO ainda vale se
  passou sem levar dano.
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
| ♦ ouros | golpe médio (5 + 2,2 × valor) e **atrasa** a carta do chefe na sua caixa (balas 15% mais lentas; Q/K atrasam as duas caixas) |
| ♣ paus | golpe 6 + 2,5 × valor, **+6% por graze** na esquiva (até +60%) |
| ♥ copas | suporte: **cura e escudo valem para os dois** (o texto da carta no CO-OP avisa: `descricaoCoop` em `coop/regras.js`); energia e compra para quem jogou. Cura **levanta** o parceiro caído |
| ★ SUPER | custa **8** no CO-OP (10 no PvP); animação do personagem, golpe de **180** com o efeito dele em cima do chefe (espadas, machado, fogo, gelo, lâminas, ondas de choque, buraco negro) e **varre** a carta do chefe da sua caixa |
| A♠ Espelho | a carta do chefe na sua caixa volta e acerta o chefe |
| A♦ Anular | cancela a carta do chefe na sua caixa e tira 2 da carga do SUPER dele |
| A♣ Roubo | rouba a carta do chefe que ia no parceiro (a caixa dele fica livre) e +2 de energia |
| A♥ Segunda chance | os dois curam 25% e ninguém cai nesta rodada (levanta quem caiu) |

O SUPER do chefe não pode ser anulado, refletido, roubado nem varrido.

## Chefe

- Baralho por fase (`src/game/coop/chefes/<id>.js`): cada fase do chefe embaralha
  cartas novas. Cada carta tem naipe, valor, nome e ataque (da biblioteca `attacks/`).
- ♥ do chefe: ele se cura e/ou levanta a **guarda** (o próximo contra-ataque
  causa menos dano) e manda só um ataque fraco.
- Dano por bala: `danoBala` do chefe, escalado pelo valor da carta e pelo nível.
- **SUPER do chefe** (★): a carga sobe 1 por rodada desde o começo e enche a
  cada **10 rodadas** (rodada 10, 20...): o chefe joga o SUPER nas duas caixas
  ao mesmo tempo. O alto da mesa mostra quantas rodadas faltam.
- HP próprio do modo cartas (`hp` no baralho do chefe) × nível:
  King 240, Queen 270, Jevil 310, Coronel 320 no FÁCIL.
- Dano por bala das cartas do chefe: `danoBala` × 0,45 (2) a 0,75 (K); SUPER × 0,9;
  o ataque fraquinho do ♥ × 0,3; tudo × o dano do nível.
- **Nível da luta** (`nivelDoChefe(chefe, nivel)` em `coop/chefes/index.js`):
  `NIVEIS[nivel]` (`constants.js`) vezes o ajuste do chefe naquele nível
  (`niveis` no arquivo do chefe). Vale para ritmo (velocidade e densidade das
  balas), teto de velocidade, dano e HP. Hoje só o DIFÍCIL tem ajuste por chefe:

  | DIFÍCIL | ritmo (vel./dens./teto) | dano | HP |
  |---|---|---|---|
  | base (`NIVEIS.dificil`) | ×1,45 / ×1,6 / ×1,3 | ×2 | ×1,9 |
  | King | base × 1,5 / 1,7 / 1,4 | base × 2,7 | base × 1,25 (570) |
  | Queen | base | base | base × 0,85 (436) |
  | Jevil | base | base × 2 | base × 1,2 (707) |
  | Coronel | base | base × 2,05 | base × 1,12 (681) |

### Balanceamento medido (`scripts/balanceamento/`)

`medirChefes.mjs` roda cada carta de cada chefe numa caixa do tamanho da
arena, com o ritmo, o teto e o dano de verdade de cada nível. O EsquivaBot
desvia como um jogador "perfeito" (bot difícil) e como um "médio" (bot normal),
e a medição guarda os acertos de cada rodada. `simularCoop.mjs` joga partidas
inteiras com as regras e a CPU aliada, sorteando os acertos de cada caixa
dessas amostras.

Vitórias no DIFÍCIL (600 partidas por linha; antes → depois do ajuste de
2026-10-08):

| Chefe | Dupla perfeita | Um de cada | Dupla média |
|---|---|---|---|
| King | 100% → 96% | 100% → 63% | 100% → 6% |
| Queen | 100% → 78% | 99% → 38% | 51% → 5% |
| Jevil | 100% → 83% | 100% → 44% | 72% → 0% |
| Coronel | 100% → 73% | 98% → 28% | 55% → 0% |

Lutas de ~9 a 11 rodadas. Antes, a dupla perfeita terminava com 80-96% do HP.
FÁCIL e MÉDIO não mudaram.

Todos os números ficam em `COOP` e `GOLPE` (`coop/regras.js`), `DANO_CHEFE`
(`coop/cartasChefe.js`), `NIVEIS` (`constants.js`) e `niveis` de cada chefe.

## Caídos

HP 0 → cai: não joga cartas e o chefe não mira nele. Volta sozinho depois de 2
rodadas (30% do HP), ou antes, com uma cura de copas do parceiro.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `src/game/coop/regras.js` | regras puras (testáveis em Node): partida, intenções, resolução, golpes, caídos, fases |
| `src/game/coop/chefes/` | os 4 chefes: dados (nome, arte, música, falas, tema) e baralho por fase |
| `src/game/coop/cartasChefe.js` | cartas do chefe → ataque (com a biblioteca injetada) |
| `src/game/coop/superNoChefe.js` | o efeito de cada SUPER em cima do chefe |
| `src/game/coop/bot.js` | CPU aliada (1 jogador) |
| `src/game/scenes/CoopArena.js` | a cena (estende a PvpArena: mesma escolha de cartas) |
| `src/game/coop/__tests__/` | testes |

## Testes

- `npm test` roda também `src/game/coop/__tests__/` (regras, cartas dos chefes,
  CPU aliada e uma partida simulada até o fim contra cada chefe).
- No navegador (dev): `window.coopArena` (`estadoDebug()`, `setHp(j, hp)`,
  `setHpChefe(hp)`, `forcarMao(j, ids)`).
