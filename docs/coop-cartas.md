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
   energia (e carregam a ♣ armadilha). Quem zerar o HP **cai**.
6. **Contra-ataque**: com as caixas fechadas, as cartas carregadas voam no chefe.
   - desvio perfeito (passou pelo ataque sem levar dano): **CRÍTICO ×1,5**
   - os dois atacam com o mesmo naipe: **COMBO ×1,25**; mesmo valor: **PAR ×1,5**
   - quem caiu na esquiva perde o golpe
7. **Fim**: chefe a 0 → vitória; os dois caídos → game over. Troca de fase do
   chefe (fala de entrada, fundo mais agitado, cartas novas no baralho dele).

## Cartas dos jogadores contra o chefe

| Carta | Efeito no CO-OP |
|---|---|
| ♠ espadas | golpe forte: 6 + 2,6 × valor (2 → 11, K → 40) |
| ♦ ouros | golpe médio (4 + 1,8 × valor) e **atrasa** a carta do chefe na sua caixa (balas 15% mais lentas; Q/K atrasam as duas caixas) |
| ♣ paus | golpe 5 + 2 × valor, **+6% por graze** na esquiva (até +60%) |
| ♥ copas | suporte: **cura e escudo valem para os dois** (o texto da carta no CO-OP avisa: `descricaoCoop` em `coop/regras.js`); energia e compra para quem jogou. Cura **levanta** o parceiro caído |
| ★ SUPER | animação do personagem, golpe de 60 e **varre** a carta do chefe da sua caixa |
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
- **SUPER do chefe** (★): a partir da 2ª fase, uma barra de carga sobe 1 por
  rodada; cheia, o chefe joga o SUPER nas duas caixas ao mesmo tempo.
- HP próprio do modo cartas (`hp` no baralho do chefe) × nível (`NIVEIS.hp`):
  King 340, Queen 420, Jevil 500, Coronel 520 no FÁCIL.
- Dano por bala das cartas do chefe: `danoBala` × 0,6 (2) a 1,0 (K); SUPER × 1,1;
  o ataque fraquinho do ♥ × 0,35; tudo × `NIVEIS.dano`.

Todos os números ficam em `COOP` e `GOLPE` (`coop/regras.js`) e `DANO_CHEFE`
(`coop/cartasChefe.js`).

## Caídos

HP 0 → cai: não joga cartas e o chefe não mira nele. Volta sozinho depois de 2
rodadas (30% do HP), ou antes, com uma cura de copas do parceiro.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `src/game/coop/regras.js` | regras puras (testáveis em Node): partida, intenções, resolução, golpes, caídos, fases |
| `src/game/coop/chefes/` | os 4 chefes: dados (nome, arte, música, falas, tema) e baralho por fase |
| `src/game/coop/cartasChefe.js` | cartas do chefe → ataque (com a biblioteca injetada) |
| `src/game/coop/bot.js` | CPU aliada (1 jogador) |
| `src/game/scenes/CoopArena.js` | a cena (estende a PvpArena: mesma escolha de cartas) |
| `src/game/coop/__tests__/` | testes |

## Testes

- `npm test` roda também `src/game/coop/__tests__/` (regras, cartas dos chefes,
  CPU aliada e uma partida simulada até o fim contra cada chefe).
- No navegador (dev): `window.coopArena` (`estadoDebug()`, `setHp(j, hp)`,
  `setHpChefe(hp)`, `forcarMao(j, ids)`).
