# CO-OP de cartas

O CO-OP continua sendo um modo separado do PVP, mas agora usa a mesma mecânica
de cartas: os dois jogadores (ou 1 jogador + CPU aliada) jogam cartas juntos
contra um chefe que também joga cartas. O chefe aparece no meio da mesa, com o
fundo maluco dele atrás, e os personagens da party ficam nos cantos reagindo.

Fluxo: Menu → CO-OP → EscolhaParty → **ModoCoop** (LUTA RÁPIDA ou EXPEDIÇÃO) → Selecao (chefe) → Dificuldade
(nível) → **CoopArena** → Vitoria / GameOver (A: revanche na CoopArena). A EXPEDIÇÃO (3 lutas seguidas) está na
seção [Expedição](#expedição). Numa sala (LAN ou ONLINE) a arena roda no PC de cada um: ver "CO-OP em rede" em
[rede-pvp.md](rede-pvp.md).

## Expedição

Pedido do dono: um modo mais longo (~10–12 min) **sem ficar complexo**: "não torne o modo complexo demais de
entender". Depois da party vem uma escolha clara (`scenes/ModoCoop.js`): **LUTA RÁPIDA** (a luta de sempre, igual
a antes) ou **EXPEDIÇÃO**. Na Selecao da expedição aparecem os 4 chefões e a **SORTEADA** (na mesma fila: os
lacaios de um chefão, o tenente de outro e um chefão surpresa, os três diferentes, pela semente; o chefão fica
"???" no mapa até o time chegar nele). Depois o nível (Dificuldade, o mesmo para as 3 lutas).

```
[1] LACAIOS  →  escolha  →  [2] TENENTE  →  escolha  →  [3] CHEFÃO
```

| Peça | Onde |
|---|---|
| máquina de estados (pura, JSON): rota, oferta, votos, cura, fim | `src/game/coop/expedicao.js` |
| relíquias (as melhorias) e as curas delas | `src/game/coop/reliquias.js` (lidas em `coop/regras.js` e `coop/coop2.js`) |
| escolha do modo | `scenes/ModoCoop.js` |
| mapa + cartão de 1ª vez + votos + cura (entre as lutas) | `scenes/Expedicao.js` (o mapa: `coop/expedicaoCena.js`) |
| fim (até onde chegou, recompensas, revanche) | `scenes/ExpedicaoFim.js` |
| a faixa "EXPEDIÇÃO · LUTA 2 DE 3 · TENENTE" e a saída da luta | `coop/coop2Arena.js` (`faixaDaExpedicao`, `saidaDaExpedicao`), nas duas arenas |
| recompensas (servidor e banco) | `server/partidas.js` (`expedicaoDaPartida`), `src/lib/expedicao.js`, `supabase/migrations/0017_expedicao.sql` |
| versos exclusivos (desenho por código) | `src/lib/cosmeticos.js` (`ITENS_EXPEDICAO`), `src/game/cosmeticos/versos.js` (`VERSOS_EXPEDICAO`) |

**As lutas** são as entradas `expedicao: true` de `CHEFES_DA_EXPEDICAO` (`LUTAS` em `coop/expedicao.js`):
`kingLacaios → kingTenente → king`, `queenLacaios → queenTenente → queen`, `jevilLacaios → jevilTenente → jevil` e
`coronelLacaios → coronelTenente → coronel`. Cada luta abre a `CoopArena` (ou a `CoopArenaN` com 3–4) com os
ganchos da luta que continua: `{ chefe, nivel, party, semente, hp, reliquias, expedicao }` (`dadosDaLuta`). O banner do
começo da luta ganha uma faixa em cima ("EXPEDIÇÃO · LUTA 2 DE 3 · TENENTE" e as melhorias ativas). A vitória que não é a
última diz "LUTA N VENCIDA!" e abre a `Expedicao`; o chefão caído ou o time caído abrem a `ExpedicaoFim`.

**O HP passa** de uma luta para a outra (`terminarLuta` guarda o HP de cada um; caído = 0). **Entre as lutas** o time
recupera **25% do HP máximo** (`CURA_ENTRE`; quem caiu volta com isso; era 35%, ver "Dificuldade do CO-OP") e a tela mostra, embaixo, a barra de cada um,
o "+N de HP na próxima luta" e a barra subindo depois da escolha. **Caiu numa luta: a expedição acaba ali** (a tela do
fim mostra o mapa com um X no nó, quantas lutas o time venceu, REVANCHE ou MENU).

### Entre as lutas: 3 melhorias, votem

A tela (`Expedicao`) tem o **mapa** (3 nós: feito em verde com o "visto", agora em laranja pulsando, depois em
cinza), **3 cartas** de relíquia (uma frase cada), um **relógio** de 20 s e o HP do time. Cada um escolhe com ←/→ e
vota com A (o voto trava; o coraçãozinho na cor do jogador aparece embaixo da carta).

- **Maioria** leva. **Empate**: vale o voto de quem está com **menos HP** (fração do máximo; empate de HP, a vaga
  menor). O **relógio** acabou: valem os votos que chegaram; ninguém votou, a **sugestão da CPU** (`votoDaCpu`).
- Sozinho, a **CPU aliada** vota com bom senso (time com HP médio abaixo de 55%: uma de defesa; senão ataque/equipe).
- A oferta sai da **semente** da expedição e da etapa (`gerarOferta`): 3 diferentes, nunca uma que o time já tem;
  igual em todos os PCs. As melhorias **se acumulam** até o fim da expedição (`estado.reliquias`).
- **Primeira vez neste PC**: antes da 1ª luta, o cartão **COMO FUNCIONA A EXPEDIÇÃO** (3 linhas; A fecha; some
  sozinho em 20 s, 9 s em rede; `localStorage` `dodge:expedicaoVista`).

| Relíquia | Na carta | Efeito (`estado.mods`) |
|---|---|---|
| AMULETO DA DUPLA | A barra de QUEBRA enche 25% mais rápido. | `quebra` ×1,25 |
| LÂMINA AFIADA | Seu ♠ dá +20% de dano. | `naipe.espadas` ×1,2 |
| TREVO DE PAUS | Sua armadilha de ♣ dá +25% de dano. | `naipe.paus` ×1,25 |
| DIAMANTE BRUTO | Seu ♦ dá +25% de dano. | `naipe.ouros` ×1,25 |
| LUVA DE FERRO | Todo golpe do time dá +10% de dano. | `golpe` ×1,1 |
| OLHO DE ÁGUIA | O CRÍTICO bate 20% mais forte. | `critico` ×1,2 |
| ESTRELINHAS | Chefe ATORDOADO leva o dobro nos golpes. | `atordoado` (×1,5 → ×2) |
| MARTELO DE DUPLA | A FINALIZAÇÃO tira o dobro de HP. | `finalizacao` ×2 |
| CASCA GROSSA | O ataque do chefe tira 15% menos. | `danoQuadro` ×0,85 |
| BATERIA EXTRA | Comecem cada luta com +2 de energia. | `energiaInicial` +2 |
| PENA DE FÊNIX | O resgate levanta com 50% do HP. | `retornoHp` 0,5 (resgate, volta sozinho, rodada limpa) |
| LAÇO DE AMIZADE | Grazes curam o parceiro. | `curaGraze`: cada graze (até 6 por rodada) cura 1 no parceiro de pé com menos HP |
| PRESA DE VAMPIRO | Cada CRÍTICO cura 4 HP de quem bateu. | `curaCritico` 4 |

As curas (laço e presa) saem no fim do contra-ataque (`curasDasReliquias`, no máximo 8 por jogador por rodada): o
host calcula, manda no `contra` (`curas`) e o convidado aplica igual (`aplicarCurasDoContra`); a tela mostra "+N".

### Em rede (2, 3 e 4 jogadores)

Tudo vai por id e pela semente: o host leva todos para a `Expedicao` e para cada luta com `irParaCena` (os dados
levam o estado inteiro da expedição). Na escolha cada PC vota pela SUA vaga e manda ao host (`expVoto {s, no, j,
voto}`); o host junta e manda o placar (`expVotos`) e, com todos os votos ou o relógio dele acabando, a decisão
(`expEscolha {escolha, motivo, desempate, votos}`); depois abre a próxima luta em todos. Com **3 e 4** a mesma coisa
na `CoopArenaN` (as lutas da expedição são entradas comuns de `CHEFES`, que a arena do grupo já aceita; o HP e as
relíquias vão pelos mesmos ganchos). PROTOCOLO 22.

### Recompensas (servidor; online com conta)

A expedição em rede é **uma partida só** no servidor (a sala fica em partida da 1ª luta ao fim). No fim, cada PC
manda o resultado de sempre do CO-OP (`resultado {partidaId, vitoria, ...}`) com **`expedicao {chefe, lutas,
sorteada}`** (o chefão e as lutas vencidas). A validação é a mesma do XP do CO-OP (os relatos concordam: `decidirCoop`
/ `decidirN`) e, por cima (`expedicaoDaPartida`): todos os relatos com a mesma expedição (o mesmo chefão; as lutas
valem as menores relatadas), resultado coerente (vitória = 3 lutas) e **60 s de partida por luta vencida**. Aí o
banco (`conceder_expedicao`, 0017) confere tudo de novo, conta por conta, e dá:

| Recompensa | Quanto | Trava |
|---|---|---|
| XP por luta vencida | +15 (`XP_EXPEDICAO.porLuta`) | somado ao XP de sempre da partida |
| bônus de completar | +40 | teto de 255 de XP a mais por dia (`tetoDia`) |
| baú | 50% de chance ao completar (o servidor sorteia, `crypto.randomInt`) | 1 por dia por chefão (`expedicao:<dia>:<chefão>`, [baus.md](baus.md)) |
| verso exclusivo | na **1ª** expedição completa contra cada chefão | uma vez por conta (`expedicoes_chefes`) |

Os 4 versos (desenhados por código, como os versos ilustrados do baú; fora do baú e da trilha): **Tabuleiro Real**
(King: o tabuleiro com casas piscando e a coroa), **Sinal Cheio** (Queen: as 4 barrinhas do Wi-Fi e o fio entre dois
corações), **Dado do Caos** (Jevil: o dado girando e os naipes em espiral) e **Reciclador** (Coronel: as três setas da
reciclagem e a faixa do caminhão). A `recompensa` volta com `expedicao {xp, completa, cosmetico, cosmeticoNovo, bau,
bauHoje}` (o XP a mais já entra no `xpGanho` e na barra) e a `ExpedicaoFim` mostra tudo, com a carta do verso. O baú
ganho também chega pelo pop-up de sempre (a `ExpedicaoFim` está em `CENAS_DO_POPUP`).

**Contra a CPU aliada (fora da rede) não há recompensa**, como na LUTA RÁPIDA contra a CPU: o servidor não vê a
partida local e não há outro relato para conferir. A tela do fim diz isso e mostra o que a expedição online dá.

Testes: `coop/__tests__/expedicao.test.js` (máquina de estados, HP, cura, oferta pela semente, votos, CPU, SORTEADA,
relíquias acumulando e as curas), `server/__tests__/expedicao.test.js` (relato, validação, XP, baú 1 por dia por
chefão, verso uma vez, idempotência, 3–4 jogadores, catálogo JS = 0017) e `expedicaoSql.test.js` (Postgres, com
`DODGE_PG`). No navegador (dev): `window.expedicao.estadoDebug()` na tela entre as lutas e `window.expedicaoFim`.

## CO-OP 2.0

Pedido do dono: "o PvP tá muito legal, mas o CO-OP não chama nem um pouquinho a atenção" e "deixe de um jeito
que não torne o modo complexo demais de entender". Antes o CO-OP era um PvP com chefe: ele mostra uma carta, os
dois desviam, os dois batem, repete; nada pedia trabalho em equipe e as lutas se arrastavam. O CO-OP 2.0 junta
**três ideias simples** (o cartão COMO FUNCIONA da primeira luta tem exatamente estas três linhas) e uma
**prévia**. Nenhum botão novo: tudo funciona com ←/→, A e B e o direcional na esquiva.

| O quê | Em uma frase | Onde |
|---|---|---|
| **QUEBRA** | batam juntos e acertem CRÍTICOS: a barra cheia deixa o chefe **ATORDOADO** | `coop/coop2.js` |
| **RESGATE** | caiu na esquiva? Vira uma alma: o parceiro encosta nela 1 s e te levanta | `coop/resgate.js` |
| **CARTAS DE DUPLA** | ♠ + ♣ PINÇA, ♥ + ♦ BARREIRA, mesmo naipe COMBO, mesmo valor PAR | `coop/coop2.js` |
| prévia | ao lado da carta do chefe, a da PRÓXIMA rodada (menor e apagada) | `regras.js` `previaCoop` |

A tela é a mesma de antes, com três coisas a mais: a **barra de QUEBRA** (laranja, embaixo do HP do chefe), a
**prévia** (uma minicarta com "DEPOIS" e o nome, à esquerda da carta do chefe; some quando o quadro abre) e a
**alma** no quadro quando alguém cai. Um conceito por vez: cada coisa nova aparece com uma dica curta só na
PRIMEIRA vez que acontece neste PC (`coop/dicas.js`, no navegador): "Encoste na alma para levantar o
parceiro!", "Batam juntos e acertem CRÍTICOS para encher a QUEBRA!", a da carta de dupla e a do ATORDOADO.
O cartão COMO FUNCIONA aparece só na primeira luta (A fecha; sozinho some em 15 s, 7 s em rede).

### Intenção 2 rodadas à frente

O chefe já tira do monte a carta da rodada seguinte (`chefe.proxima`): a prévia mostra o naipe, o tipo (ATAQUE,
CONTROLE, ARMADILHA, SE CURA) e o nome. A promessa vale: na rodada seguinte ele joga essa carta, mesmo que a fase
dele mude no meio (a carta da fase velha não volta ao baralho novo). A prévia também avisa: **★ SUPER DO CHEFE!**
(a carga enche na próxima; um A♦ que tira carga desfaz o aviso), **ATORDOADO: não ataca** (a barra encheu) e, na
Ladra, **carta roubada?** (a rodada em que ela pode jogar uma roubada). Determinística: sai do RNG do estado,
igual nos PCs da sala.

### QUEBRA e ATORDOADO

A barra enche com trabalho em equipe (`QUEBRA` em `coop/coop2.js`), somada no fim do contra-ataque
(`resolverContraCoop` em `coop/regras.js`):

| Ação | Pontos |
|---|---|
| os dois (no grupo: 2 ou mais) acertam o chefe na mesma rodada | 20 |
| cada CRÍTICO (passou pela esquiva sem levar dano) | 12 |
| ATAQUE EM PINÇA / BARREIRA DUPLA / COMBO / PAR | 30 / 10 / 15 / 20 |
| cada resgate na hora | 25 |
| a regra do chefe (`api.adicionarQuebra`) | o que ela der |

A barra cheia tem **100** (2 jogadores; +25% por jogador a mais: 125 com 3, 150 com 4). Cheia: **QUEBROU!** e,
na rodada seguinte, o chefe fica **ATORDOADO** (estrelinhas em cima dele): não joga carta (sem quadro, sem
esquiva, a carga do SUPER dele não sobe), os golpes comuns batem **×1,5** e a rodada fecha com a
**FINALIZAÇÃO EM DUPLA** (EM GRUPO com 3–4): os personagens de pé correm até o chefe e batem juntos, **10% do HP
máximo** dele. Depois a barra volta a zero. Com a dupla média no MÉDIO isso acontece ~1 vez por luta.

### Resgate na hora

Quem zera o HP no meio da esquiva deixa uma **alma** (coraçãozinho fantasma na cor dele, com "AJUDA!") no lugar
onde caiu, dentro do quadro. Um parceiro de pé que encosta nela e **fica 1 s** (o anel verde enche) levanta o
caído **ali mesmo**: ele volta com **30% do HP**, o coração reaparece piscando (1,4 s sem levar dano) e continua
a esquiva; o golpe que estava carregando volta a valer e a QUEBRA ganha 25. Saiu de perto: o anel para; longe
mais de 0,3 s, zera. A alma some quando o quadro fecha.

**Regras de voltar, todas com 30%** (`COOP.retornoHp`): o resgate na hora, a volta sozinha depois de 2 rodadas e
a cura de ♥ que levanta (antes o ♥ levantava com 25%; agora `COOP.reviverMin` = 30%). O A♥ (Segunda chance) e a
rodada limpa do grupo continuam como eram.

Em rede cada PC é dono do próprio coração, então só o PC de quem encostou decide que o resgate aconteceu e manda
`resgate` (pelo caminho do dano, antes do `fimEsquiva`); os outros veem o anel encher pelo coração espelho, mas
ele para perto do fim e espera a mensagem. A CPU aliada vai buscar a alma (`EsquivaBot` com `alvo`: desvia e
puxa para lá).

### Cartas de dupla

Combinações de naipe de dois jogadores **na mesma rodada** (no grupo de 3–4: qualquer par conta). Só cartas
comuns (2 a K; Ás especial e SUPER não entram). O nome aparece grande no meio da mesa quando acontece; o Guia
lista as quatro (o texto "NO CO-OP" de cada carta diz com qual ela fecha).

| Dupla | Naipes | Efeito | Quebra |
|---|---|---|---|
| ATAQUE EM PINÇA | ♠ + ♣ | os golpes de ♠ e ♣ batem ×1,3 | 30 |
| BARREIRA DUPLA | ♥ + ♦ | escudo de 50% em todos de pé nesta esquiva (sem quadro, na próxima) | 10 |
| COMBO | mesmo naipe | ×1,25 (como antes) | 15 |
| PAR | mesmo valor | ×1,5 (como antes) | 20 |

Num mesmo golpe as duplas **não se somam**: vale a mais forte (♠9 + ♣9 é PAR ×1,5, não PAR × PINÇA). A CPU
aliada olha a carta em que o parceiro está com o cursor e fecha a dupla quando vale a pena.

### Lutas mais curtas

Medido com as ferramentas de `scripts/balanceamento/` (`medirChefes.mjs` com 3 sementes; `simularCoop.mjs`
agora joga o CO-OP 2.0 inteiro: `resolverContraCoop`, a finalização e o resgate na hora, com 50% de chance de
o parceiro médio chegar na alma) e convertido em minutos por `coop/duracao.js`: o tempo de cada parte da rodada
medido na `CoopArena` (Playwright: início 1,1 s, revelação 2,0, arremesso 0,8, esquiva ~7, contra-ataque 2,4,
fim 0,8) mais **12 s de escolha** (uma dupla de gente que conversa; o relógio dá 15). O alvo era ~4–6 minutos
no MÉDIO com dois jogadores médios. A medição mostrou que as lutas já ficavam entre 3 e 4,5 minutos, mas
**desiguais** (o King acabava em 6 rodadas e o Coronel arrastava quase 10), e que o CO-OP 2.0 sozinho (PINÇA,
ATORDOADO ×1,5, finalização, resgate) encurtava tudo ~20%. O ajuste: **HP de base** (`hp` de cada chefe) para
que todas fiquem perto da mesma duração, com espaço para ~1 QUEBRA por luta:

| Chefe | `hp` (FÁCIL) | MÉDIO, dupla média: rodadas (minutos) antes → depois | vitória antes → depois |
|---|---|---|---|
| King | 240 → 360 | 6,2 (~2,8) → 7,1 (3,0) | 100% → 100% |
| Queen | 270 → 340 | 8,4 (~3,8) → 7,6 (3,3) | 97% → 100% |
| Jevil | 310 → 345 | 8,5 (~3,8) → 7,9 (3,4) | 97% → 100% |
| Coronel | 320 → 350 | 9,7 (~4,4) → 8,2 (3,5) | 91% → 98% |

(minutos "antes" sem as rodadas sem quadro; com a escolha de 15 s inteira e os anúncios de SUPER, as lutas
ficam ~0,5–1 min mais longas: a dupla de gente fica na faixa de 4 minutos, e nenhuma passa de 6.) O teste
`coop/__tests__/duracao.test.js` confere a faixa (3–6 min no MÉDIO, o FÁCIL mais curto) com uma simulação
grossa sem o navegador.

O resto das linhas (`simularCoop.mjs` 300 partidas, antes → depois, vitórias e rodadas):

| | perfeita F / M / D | mista F / M / D | média F / M / D |
|---|---|---|---|
| King | 100/100/100 (4,6 / 5,3 / 8,6 rod) → 100/100/100 (4,8 / 5,6 / 9,4) | 100/100/99 → 100/100/99 | 100/100/58 → 100/100/74 |
| Queen | 100/100/100 (5,4 / 6,3 / 7,8) → igual (5,1 / 6,4 / 7,7) | 100/100/98 → 100/100/100 | 100/97/29 → 100/100/59 |
| Jevil | 100/100/92 (5,7 / 6,7 / 10,1) → 100/100/96 (5,0 / 6,1 / 9,4) | 100/100/82 → 100/100/93 | 100/97/15 → 100/100/22 |
| Coronel | 100/100/100 (6,1 / 6,8 / 9,0) → igual (5,2 / 5,8 / 8,1) | 100/100/99 → 100/100/100 | 99/91/22 → 100/98/53 |

O DIFÍCIL ficou mais vencível para a dupla média (o resgate e o ATORDOADO são exatamente o que ela precisava);
a dupla perfeita e a mista continuam como estavam. A luta da CAMPANHA usa estas regras com `coop2: false`
(`criarPartidaCoop`): nada do CO-OP 2.0 muda lá.

### CO-OP de 3 e 4

Tudo vale na `CoopArenaN` (os mesmos métodos: `coop/coop2Arena.js`, ligados nas duas arenas): a barra cresce
com o grupo (125 / 150), "juntos" pede 2 ou mais acertando, qualquer aliado de pé levanta a alma de qualquer
caído, qualquer par fecha uma carta de dupla e a finalização é EM GRUPO (todos de pé). As mensagens `resgate` e
`regra` vão ao host, que confere o `lado` e repassa, como o `dano` (`coop/ArenaRedeCoopN.js`).

## Regra do chefe (API)

Para os agentes de cada chefe: cada chefe pode ganhar **UMA mecânica própria que dura a luta toda** (tabuleiro de
xadrez, fio de Wi-Fi entre os corações, dado do caos que troca uma regra por rodada, lixo para reciclar que enche
um balde e lança um míssil...). Ela entra no arquivo do chefe (`coop/chefes/<id>.js`) como `regra`, e a arena
(`CoopArena` e `CoopArenaN`) liga sozinha (`coop/regraChefe.js`, `RegraDaLuta`). Simples para o jogador: o banner
do começo da luta mostra o **nome** e **uma frase** (`descricao`, até 90 letras, sem ponto no meio).

```js
// coop/chefes/king.js
regra: {
  id: 'xadrez',
  nome: 'TABULEIRO REAL',
  descricao: 'Casas escuras no quadro dão dano dobrado.',
  fases: { 1: { descricao: 'Agora as casas mudam a cada rodada.' } }, // opcional: aviso na fase nova
  criar(api) {
    let casas = []
    return {
      comecarEsquiva({ carta }) {
        const l = api.limites()
        const r = api.rng('casas') // o MESMO sorteio em todos os PCs
        casas = [0, 1, 2].map(() =>
          api.adicionarZona({ x: l.x + r() * l.width, y: l.y + r() * l.height, largura: 40, altura: 40, cor: 0x202020, alpha: 0.5,
            aoEntrar: (j) => api.dica('casa', 'Casa escura: saia dela!') }),
        )
        api.adicionarItem({ x: l.x + l.width / 2, y: l.y + 20, forma: 'estrela', aoPegar: () => api.adicionarQuebra(15, 'coroa') })
      },
      atualizar(dt) {},
      // troca o ataque de uma carta (A = biblioteca attacks/, padrao = o de sempre); null = o padrão
      ataque(carta, A, padrao) {
        return carta.naipe === 'espadas' ? A.juntos(padrao, A.rain({ intervalo: 900, velocidade: 110 })) : null
      },
      terminar() {},
    }
  },
},
```

**Ganchos** (todos opcionais; rodam em TODOS os PCs, no mesmo ponto da rodada):

| Gancho | Quando |
|---|---|
| `criar(api)` | uma vez, ao abrir a arena (devolve o objeto com os ganchos) |
| `comecar()` | a luta começou (depois do banner da regra) |
| `inicioDaRodada(rodada)` | a carta do chefe já está na mesa |
| `ataque(carta, A, padrao)` | antes do quadro abrir: devolva outro ataque ou `null` |
| `comecarEsquiva({ carta })` · `atualizar(dt)` · `terminarEsquiva()` | o quadro abriu / todo frame da esquiva (ms) / fechou |
| `fimDaRodada({ novaFase })` · `faseNova(f)` | a rodada acabou / o chefe mudou de fase (o texto de `fases[f]` aparece sozinho) |
| `aoMensagem(lado, acao, dados)` | chegou um `api.enviar` (de qualquer PC, também deste) |
| `alvoDoBot(j)` | `{ x, y }` para onde a CPU aliada vai (sem isto: o item mais perto) |
| `terminar()` | a luta acabou (itens, zonas e objetos guardados já são limpos) |

**A API** (`api`):

| | |
|---|---|
| `api.rodada` · `api.n` · `api.nivel` · `api.semente` | leitura |
| `api.rng(tag)` | `() => [0, 1)`: o sorteio da rodada, o mesmo em todos os PCs para a mesma `(semente, rodada, tag)` |
| `api.jogadores()` · `api.coracoes()` · `api.limites()` | o estado (só leitura), `[{ j, x, y, ativo }]`, `{ x, y, width, height }` do quadro |
| `api.adicionarItem({ x, y, raio, cor, forma, rotulo, fica, aoPegar(j, item) })` | item que se pega encostando o coração (some ao pegar; sem `fica`, no fim da esquiva) |
| `api.adicionarZona({ x, y, largura, altura, cor, alpha, fica, aoEntrar(j), aoSair(j) })` | área no quadro |
| `api.removerItem` · `api.removerZona` · `api.itens()` · `api.zonas()` · `api.dentro(zona, x, y)` | |
| `api.adicionarQuebra(pontos, motivo)` | enche a barra de QUEBRA |
| `api.danoNoChefe(dano, motivo)` | golpe extra no chefe (o número aparece) |
| `api.curar(j, hp)` · `api.ferir(j, dano)` · `api.empurrar(j, dx, dy)` | os corações (o acerto passa pelo escudo; empurrar só no PC dono do coração) |
| `api.banner(texto, cor)` · `api.dica(id, texto)` | aviso curto / dica que aparece UMA vez por PC |
| `api.enviar(acao, dados)` | efeito de UM jogador para todos: roda `aoMensagem(lado, acao, dados)` aqui e nos outros |
| `api.meu(j)` | o coração j é simulado neste PC (o meu, ou a CPU aliada daqui)? |
| `api.cena` · `api.guardar(obj)` | enfeite Phaser próprio (guardado é destruído no fim); use pouco |

**Rede (por que a regra é segura com 2 a 4 PCs).** Os ganchos rodam em todos os PCs com o mesmo estado; tudo que
eles fazem tem de sair do estado, do tempo da esquiva ou do `api.rng` (nunca `Math.random`). O que nasce num PC
só é o que um **coração** faz (pegar item, entrar/sair de zona): só o PC dono daquele coração decide, e a API
manda a mensagem `regra` (no caminho do dano, antes do `fimEsquiva` dele); os outros PCs repetem o
`aoPegar`/`aoEntrar`/`aoSair`. Por isso o que o `aoPegar` faz (quebra, dano no chefe, cura) acontece uma vez em
cada PC, igual em todos. Um gancho que quebra só avisa no console (a luta segue).

**Para a Expedição** (3 lutas seguidas: lacaios → tenente → chefão; ver [Expedição](#expedição)): a luta pode
**continuar** de outra. `criarPartidaCoop({ ..., hp: [30, null], reliquias: ['amuleto'] })` (e os mesmos `hp` e
`reliquias` nos dados da cena: `scene.start('CoopArena', { chefe, nivel, party, hp, reliquias })`, também na
`CoopArenaN` e em rede, porque tudo vai por id) começa com o HP que veio de antes (`null` = cheio) e com as
melhorias ativas. Uma relíquia mora em `RELIQUIAS` (`coop/reliquias.js`): `{ id, nome, descricao, aplicar(estado) }`;
o `aplicar` roda uma vez e mexe em `estado.mods` (`golpe`, `quebra`, `danoQuadro`, `energiaInicial`, todos lidos pelas
regras) ou no HP/energia; `estado.reliquias` guarda os ids ativos. Para o tenente "apresentar a regra do chefe de
leve", a Expedição pode passar uma regra própria (um `regra` com números menores) no `def` do tenente.

**Exemplo neutro**: `REGRA_EXEMPLO` (`exemplo`, "ESTRELA CADENTE": uma estrela por esquiva, pegar enche 15 de
QUEBRA, 30 na fase 2). Nenhum chefe usa; os testes (`coop/__tests__/regraChefe.test.js`) e o dev usam:
`debugJogo.jogo.scene.start('CoopArena', { chefe: 'king', nivel: 'medio', regra: 'exemplo' })`.

## Dificuldade do CO-OP

Pedido do dono: "Os bosses ficaram easy demais. O Coronel Caçamba, que era um terror de vencer, agora tá MUITO
fácil. Testei a expedição no hit!" e depois "A quebra está boa. O problema são os ataques" e "Quero ataques
criativos". A QUEBRA, o ATORDOADO, a FINALIZAÇÃO, o resgate e as cartas de dupla ficaram **como estavam**; o que
mudou foi o que o chefe joga no quadro.

**O que deixava fácil** (medido com `medirChefes.mjs`, bot "normal" = jogador médio, no MÉDIO): o Coronel do CO-OP
2.0 soltava **0,7 bala/s a 81 px/s** e a dupla passava **74% das rodadas sem levar nada** (0,31 acerto por
rodada); o Coronel de antes do CO-OP 2.0 soltava **9 balas/s a 146 px/s** (1,73 acerto por rodada, 13% de rodadas
limpas). O tenente dele (Caminhão Compactador) dava 0,06 acerto por rodada (94% limpas). O King tinha perdido o
`desafio` (o aperto próprio) e o dano por bala era 7. Na simulação, a dupla média vencia **100%** das lutas do MÉDIO
de todos os chefes e **100%** das Expedições.

**Ataques de assinatura** (14 novos em `attacks/`, todos com aviso, semente e escala por nível e por fase; cada
chefe os mistura com os de sempre e com a própria regra, ao mesmo tempo):

| Chefe | Ataque | O que faz | Aviso |
|---|---|---|---|
| King | `kingXeque` | linhas da torre (+), do bispo (x) ou da dama (as duas) cruzando no coração; o `eco` repete onde ele vai | a linha acende 0,5–0,85 s |
| King | `kingMuralha` | uma fileira de peões com uma brecha de 2 casas desce casa por casa; a brecha da próxima é outra; na última casa eles viram coroas e atiram para cima | a casa de destino acende; a coluna do tiro pisca |
| King | `kingCavalgada` | o cavalo salta em L e cai onde o coração estava; o casco solta lascas nas direções do L | o alvo fecha na casa de pouso |
| Queen | `queenPopup` | janelas abrem longe dos corações, o X fecha, a janela bate e estoura em pixels | a moldura inteira, 0,7–1 s |
| Queen | `queenCarregando` | barra de progresso na linha/coluna de um coração; em 100% vira laser (com `cruz`, as duas) | 0% → 100% escrito |
| Queen | `queenCursor` | a setinha persegue (no máximo a velocidade de fuga) e clica; o clique estoura em pixels | anel encolhendo na ponta |
| Queen | `queenPulso` | anéis de Wi-Fi que só machucam na batida (compasso fixo, não acelera) | o roteador brilha e faz tique |
| Jevil | `jevilRoleta` | lâminas giram em volta do miolo que passeia; a bolinha para numa fatia e solta um leque de naipes | as lâminas piscam; a fatia acende |
| Jevil | `jevilMalabares` | bombas em arco caem na sombra que cresce e explodem em naipes | a sombra cresce o voo inteiro |
| Jevil | `jevilOrbita` | um anel de losangos gira em volta do coração e fecha; no fim os losangos voam | o anel pisca; sempre tem brecha |
| Coronel | `coronelLatas` | latas caem do alto e quicam no chão perdendo força | entram pela borda |
| Coronel | `coronelRatos` | olhinhos vermelhos na borda e um bando atravessa em fila, ziguezagueando | os olhinhos, 0,65 s |
| Coronel | `coronelTriagem` | 3 colunas (PAPEL, METAL, PLÁSTICO): o lixo só machuca na coluna da cor errada | pisca ao trocar de coluna |
| Coronel | `coronelRe` | BIP BIP: o caminhão entra de ré até o ponto marcado, despeja um leque e arranca | faixa listrada + risco do leque |

Eventos grandes (um xeque, um pop-up, um salto, um bando) usam `a.aCadaEvento` (`attacks/contexto.js`): a densidade
do nível aperta só pela raiz, para os avisos de um evento não se empilharem nos do próximo.

**Os baralhos:** o Coronel voltou a ter **4 fases** (como antes do CO-OP 2.0), a última sem ♥ e com os primos de
caminhonete (`caminhonete`, `brasas`) de volta, e um `desafio` próprio; o lixo MARROM da RECICLAGEM aparece desde a
fase 1 (1, 2, 3, 4 por esquiva). O King tem as peças (`kingOnda`) e, por cima, o `extra` da carta (`kingCartas.js`;
as cartas de XEQUE e de ROQUE ficam sem extra) e o `desafio` de volta. Queen e Jevil ganharam cartas novas em cada
fase. Lacaios e tenentes usam versões leves dos mesmos ataques.

**Dano:** `danoBala` maior em todos (King 7 → 12, Queen 11 → 13, Jevil 13 → 15, Coronel 12 → 15, lacaios e tenentes
+2 a +3) e o ajuste por nível de cada chefe (`niveis`) passou a mexer no MÉDIO também: King MÉDIO dano x2,6 e HP
x1,35; Queen x2; Jevil x1,8; Coronel x2,3 e HP x1,15; no DIFÍCIL King x1,8, Queen x1,4, Jevil x1,3, Coronel x1,6.
O FÁCIL continua o chefe como ele é. (A campanha não muda: `NIVEIS` é o mesmo.)

**Expedição:** cada luta aperta mais (`ETAPA_EXPEDICAO` em `coop/regras.js`, a cena passa `etapa` ao
`criarPartidaCoop`): tenente HP x1,15 e dano x1,1; chefão HP x1,3, dano x1,2 e o SUPER a cada 7 rodadas (não 10). A
cura entre as lutas caiu de 35% para **25%** (`CURA_ENTRE`). Os lacaios e tenentes ganharam dano no MÉDIO (x1,6 e
x1,8) e no DIFÍCIL (x1,25 e x1,35). Rede: a etapa sai da expedição que já vai nos dados da cena (mesma nos PCs).

**Medido** (`medirChefes.mjs` 6 sementes, `simularCoop.mjs` 300 partidas; antes → depois; "média" = dois bots
normais, "mista" = um perfeito e um normal; `EXPEDICAO=1` simula a Expedição inteira):

| Chefe | acertos/rodada no MÉDIO (normal · perfeito) | vitória dupla média F / M / D | vitória mista M / D |
|---|---|---|---|
| King | 0,51 · 0,04 → 1,29 · 0,45 | 100 / 100 / 100 → 100 / 63 / 22 | 100 / 100 → 96 / 87 |
| Queen | 1,06 · 0,03 → 1,47 · 0,39 | 100 / 100 / 88 → 100 / 64 / 21 | 100 / 100 → 99 / 83 |
| Jevil | 1,33 · 0,27 → 1,58 · 0,33 | 100 / 99 / 20 → 99 / 56 / 5 | 100 / 89 → 99 / 61 |
| Coronel | 0,31 · 0,01 → 1,09 · 0,40 | 100 / 100 / 100 → 100 / 62 / 19 | 100 / 100 → 98 / 85 |

Expedição completa, dupla média, MÉDIO: 100% → King 33%, Queen 27%, Jevil 26%, Coronel 24% (DIFÍCIL: 0–5%).
A simulação não tem a regra do chefe (o míssil do Coronel ajuda a dupla; o Wi-Fi da Queen machuca), por isso o
Coronel fica um pouco abaixo de 50% nela. O bot perfeito leva 0,3–0,45 acerto por rodada: luta sem levar nada
ficou praticamente impossível. Testes: `coop/__tests__/duracao.test.js` (o MÉDIO às vezes perde, o FÁCIL é
acessível, o DIFÍCIL derruba mais), `expedicao.test.js` (as etapas) e os baralhos de cada chefe.

## Coronel Caçamba: RECICLAGEM

Pedido do dono: as cartas do Coronel eram "muito difíceis e chatas" (trânsito cheio, parede de brasas, forcado,
sequências longas). Saíram todas; o chefe virou o coletor de lixo, com UMA regra e cartas poucas e avisadas.

**Regra RECICLAGEM** (`coop/coronelRegra.js`, desenho em `coop/coronelCena.js`): *"Lixo VERDE não machuca: peguem
para encher a lixeira e lançar o míssil!"* Parte do lixo que cai no quadro é verde (lata com ♻, halo pulsando):
encostar enche a **LIXEIRA** (barra única da dupla, no HUD ao lado do chefe, 24 gomos, +3 por jogador além de 2).
Cheia, o **MÍSSIL RECICLADO** sobe e bate nele: 8% do HP máximo e +30 de QUEBRA (dois mísseis e meio enchem a
barra). O lixo comum (as cartas) continua machucando; um desvia e atrai o ataque enquanto o outro pega.
Rede: todos os itens da esquiva nascem juntos no `comecarEsquiva` (mesmos ids, escondidos em cima da caixa) e andam
por uma função do tempo; só o PC dono do coração decide o toque; o míssil aplica o dano no impacto ou, no mais
tardar, no `terminarEsquiva` (estado igual em todos os PCs). A CPU aliada mira só o verde (e o vão do compactador).

| Fase (HP) | Itens por esquiva | Cartas |
|---|---|---|
| 1 (100%) | 5 verdes (cada um +2) + 1 marrom | ♠ Caminhão de Lixo · ♣ Chuva de Entulho · ♦ Ratazanas · ♣ Buzinaço · ♥ Pausa pro Café |
| 2 (75%) | 4 verdes + 2 **marrons** (contaminado: machuca; marrom com X vermelho, nunca verde) | ♠ Caminhão Turbo · ♣ Coleta Seletiva · ♦ Buzinaço Forte · ♠ Marcha à Ré · ♥ Chapéu de Palha |
| 3 (50%) | 4 verdes (+3 cada: a lixeira enche mais rápido) + 3 marrons | ♠ Caminhão Duplo · ♣ Compactador · ♦ Triagem Turbo · ♠ Atropela e Despeja · ♥ Pit Stop |
| 4 (25%) | 4 verdes (+3) + 4 marrons | ♠ Engarrafamento · ♣ Lixão em Chamas · ♦ Ratos no Compactador · ♠ Rodeio do Lixo (sem ♥) |

(Dificuldade do CO-OP, seção acima: as cartas viraram combinações com os ataques novos `coronelLatas`,
`coronelRatos`, `coronelTriagem` e `coronelRe`, e a fase 4 com os primos de caminhonete voltou.)

SUPER: *Dia de Coleta* (dois caminhões e entulho, tudo avisado). Ataques novos em `attacks/`:
`coronelCaminhao` (uma faixa acende em amarelo, com setas e buzina, e só depois o caminhão cruza; sempre sobra uma
faixa livre), `coronelEntulho` (a sombra cresce até o tamanho do estrago, ~1 s, e vira o pedregulho),
`coronelBuzinaco` (onda de som que EMPURRA, não machuca; só o PC dono move o coração) e `coronelCompactador` (duas
placas fecham devagar e deixam um vão de 104 px marcado desde o começo; o grupo cabe). Arte original em
`arte/coronelSprites.js` (o caminhão das cartas) e `arte/expedicao.js` (Caminhão Compactador e lacaios).

**Expedição** (não aparecem na seleção: `oculto`/`expedicao`; `scene.start('CoopArena', { chefe: 'coronelLacaios' })`):
- `coronelLacaios` *Turma do Lixão* (~2 min): guaxinins e um saco de lixo num sprite só, 2 fases, sem regra:
  `aimed`, `coronelEntulho`, `coronelLatas` e `coronelRatos`.
- `coronelTenente` *Caminhão Compactador* (~3,5 min): a RECICLAGEM leve (só verde, lixeira de 12 gomos); a marcha à
  ré, a triagem e, na 2ª fase, o compactador duas vezes com vão de 108 px.

Testes: `coop/__tests__/coronelRegra.test.js`.

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

## Boss semanal

Dois chefes fora da Selecao (`semanal: true`), um por semana, só no CO-OP online: a **Escuridão** (desvie pelo
som) e a **Ladra de Cartas** (rouba e joga as suas cartas; ♣ recupera). Regras, acessibilidade e o troféu
exclusivo em [boss-semanal.md](boss-semanal.md).

## Jevil: DADO DO CAOS (CO-OP 2.0)

**A regra** (`coop/jevilRegra.js`, números em `coop/jevilDado.js`, desenho em `coop/jevilDadoCena.js`): *"Um dado
gigante rola a cada rodada e muda a regra para todos"*. No começo da rodada o dado cai quicando, mostra a face (ícone
+ o nome em até 5 palavras + uma linha do que muda) e o resultado fica num cartãozinho à esquerda durante a rodada.
O sorteio sai da **semente** (`rngDaRegra`): é o mesmo nos PCs e a rodada de depois já aparece em **DADO DEPOIS**
(a prévia). Se a fase mudar no meio, a prévia é refeita com o dado novo. Chefe ATORDOADO: sem carta, sem dado.

| Face | O que muda na rodada | Como (rede) |
|---|---|---|
| SORTE! | um coração verde no quadro cura 18 HP de quem pegar (depois que o ataque começou) | item da API; a CPU corre atrás |
| GRAVIDADE INVERTIDA | os corações flutuam para cima (34% da velocidade deles) | `api.empurrar` só no PC dono |
| RÁPIDO E LEVE | balas x1,45 mais rápidas, metade do dano | embrulha o `iniciar` do ataque (`ataque()`) |
| CORAÇÕES TROCADOS | a cada ~3,4 s todos trocam de lugar (seta de aviso 1 s antes, 0,5 s de proteção depois; em 3-4 a troca gira em roda) | posições do quadro, no PC dono |
| CONTROLES ESPELHADOS | esquerda é direita, cima é baixo (o aviso de sempre; o ataque aperta menos) | o `invertido` da arena |
| UM CORAÇÃO POR VEZ | só um anda; a vez alterna a cada 1,5 s; o parado fica gelado, com pausa em cima e **protegido** | o parado volta ao lugar; invencibilidade |
| VENTO MALUCO | um vento muda de lado e empurra os corações; setas em cima do quadro mostram o lado e a força | `api.empurrar` |

Fases: **1** dado leve (SORTE, GRAVIDADE, RÁPIDO E LEVE) · **2** as malucas (TROCADOS, ESPELHADOS, UM POR VEZ, VENTO) ·
**3** CAOS CAOS: dois dados por rodada · **4** dois dados, quase só malucas. Dois dados nunca repetem a face, nem
juntam GRAVIDADE+VENTO, nem as duas faces de controle (ESPELHADOS+UM POR VEZ).

Cartas (a marca dele, carrossel e foice, continua): fase 1 Espadas Dançantes, **Dados Quicantes**, Anel de Copas,
Divisão de Paus, **Chuva de Naipes**, Pipoca (♥) · fase 2 Carrossel, Foice Giratória, Tique-Taque, **Dados Loucos**,
Pirueta (♥) · fase 3 Carrossel Maluco, Lâmina Louca, Chuva de Naipes, BUM!, Gargalhada (♥) · fase 4 Naipes em Fila,
Caos Afiado, Para Sempre, **Dados Malucos**. Os dados que quicam são balas `hex`. Nenhuma carta inverte os controles
sozinha: quem faz isso é a face.

**Expedição** (escondidos da Selecao: `oculto: true`, `expedicao: true`; `CHEFES_DA_EXPEDICAO`):
`scene.start('CoopArena', { chefe: 'jevilLacaios' | 'jevilTenente', ... })`.
- **Lacaios do Jevil** (`chefes/jevilLacaios.js`, sprite `jevil-lacaios`: duas cartas vivas e um palhacinho): sem regra,
  2 fases (cartas vivas, depois os palhacinhos), ataques simples.
- **Mestre de Picadeiro** (`chefes/jevilTenente.js`, sprite `jevil-mestre`): o tenente. Tem o **dadinho** (a mesma regra,
  `criarRegraDoDado({ forca: 0.6, pequeno: true })`) com 3 faces gentis: SORTE!, GRAVIDADE INVERTIDA, RÁPIDO E LEVE,
  com efeitos 40% mais fracos. Os sprites são desenhados em código (`arte/expedicao.js`, densidade 2 com 3 quadros de animação parada).

Balanceamento (MÉDIO, `simularCoop.mjs` com as cartas medidas, sem o efeito do dado): Jevil HP 410 = 2,9 / 3,3 / 3,8 min
(dupla perfeita / mista / média, 100% / 100% / 99% de vitória); lacaios HP 250 = ~2 min; Mestre de Picadeiro HP 380 = 2,4 a 3 min.
Nenhum aviso novo do validador (`[telegrafo]` / `[rota de fuga]`) nas cartas novas.

Testes: `coop/__tests__/jevil.test.js`.

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
| `src/game/coop/coop2.js` · `coop/resgate.js` · `coop/regraChefe.js` · `coop/duracao.js` · `coop/dicas.js` | CO-OP 2.0 (puro): QUEBRA, ATORDOADO, cartas de dupla, prévia; o resgate na hora; a regra do chefe; a duração das lutas; as dicas de 1ª vez |
| `src/game/coop/reliquias.js` · `coop/expedicao.js` · `coop/expedicaoCena.js` · `scenes/ModoCoop.js` · `scenes/Expedicao.js` · `scenes/ExpedicaoFim.js` | a EXPEDIÇÃO: a luta que continua (HP de antes), as relíquias (`estado.mods`), a máquina de estados, o mapa e as telas |
| `src/game/coop/coop2Cena.js` · `coop/coop2Arena.js` | CO-OP 2.0 na tela: a prévia, a barra, as almas, a finalização, o COMO FUNCIONA, as dicas; os métodos que as duas arenas ligam (`ligarCoop2`) |
| `src/game/coop/jevilRegra.js` · `jevilDado.js` · `jevilDadoCena.js` · `chefes/jevilLacaios.js` · `chefes/jevilTenente.js` · `arte/expedicao.js` | Jevil: o DADO DO CAOS, os lacaios e o Mestre de Picadeiro |
| `src/game/coop/__tests__/` | testes |

## Testes

- `npm test` roda também `src/game/coop/__tests__/` (regras do quadro único,
  cartas dos chefes, CPU aliada, a geometria do quadro e uma partida simulada até
  o fim contra cada chefe).
- CO-OP 2.0: `coop2.test.js` (prévia, QUEBRA/ATORDOADO, cartas de dupla, resgate), `regraChefe.test.js` (o ciclo
  de vida da regra, a rede, o sorteio) e `duracao.test.js` (a duração das lutas). No navegador,
  `estadoDebug().coop2` traz a prévia, a barra, as almas, os itens da regra e o `log` do que apareceu na tela
  (`dupla:pinca`, `alma:0`, `resgate:1>0`, `quebrou`, `atordoado`, `finalizacao:N`); `setQuebra(n)` enche a barra.
- No navegador (dev): `window.coopArena` (`estadoDebug()`, com `quadro`:
  carta, destino, quem está nele e o dano de cada um; `setHp(j, hp)`,
  `setHpChefe(hp)`, `forcarMao(j, ids)`, `setEnergia(j, n)`). Em rede valem nos
  dois PCs.
- Balanceamento: com o jogo rodando, `node scripts/balanceamento/medirChefes.mjs
  chefes.json` (modo quadro) e `node scripts/balanceamento/simularCoop.mjs
  chefes.json 600`.

## Queen: SINAL DE WI-FI (CO-OP 2.0)

**Regra** (`regra` em `coop/chefes/queen.js`; lógica pura em `coop/queenWifi.js`, ligação com a API em
`coop/queenRegra.js`, desenho em `coop/queenWifiCena.js`): *"Fiquem pertinho: sem sinal entre os corações, os dois
levam dano."* Cada coração mostra o **raio do sinal** (disco leve) e o fio até o parceiro, com 3 barrinhas (ciano,
amarelo, laranja; fora do raio vira pontilhado vermelho). Sem parceiro no raio por mais que a **carência** (1,4 s, a
barrinha "SEM SINAL" enche), a conexão cai e o coração leva um **tique** (20% do dano por bala do chefe, ~3 HP) a cada
1 s até reconectar. Com 2 jogadores (ou 1 + CPU aliada) os dois caem juntos; com 3 e 4 cada coração só precisa de UM
parceiro no raio (corrente) e quem fica isolado leva o tique. A CPU aliada segue o alcance (`alvoDoBot`). Rede: cada
PC manda só o tique do coração dele (`api.enviar('queda')`); o REBOOT sorteia pelo `api.rng`.

| Fase | Raio | Cartas (naipe valor nome) |
|---|---|---|
| 1 | 150 px | ♠4 Gotas de Ácido (caem ENTRE os corações) · ♣5 Atualização Obrigatória (um muro divide o quadro, vão de 92 px) · ♦6 Laser do Roteador · ♥4 Reiniciar |
| 2 (66%) | 120 px | ♦8 Interferência (empurra cada coração para um lado, setas avisam) · ♠9 Chuva de Ácido · ♣10 Atualização 2.0 (dois muros) · ♥9 Antivírus |
| 3 (33%) | 100 px | ♦12 REBOOT (os corações vão para cantos opostos; reconectar a tempo dá +16 QUEBRA) · ♠11 Interferência Total · ♣13 Atualização Crítica · ♥10 Backup na Nuvem |

Os ataques próprios ficam em `coop/chefes/queenAtaques.js` (`gotas`, `muro`): tudo nasce fora do quadro e entra devagar,
o vão do muro é declarado com `a.parede` (>= 3x o coração) e a coluna nunca nasce a menos de 38 px de um coração.
HP 460 no FÁCIL (simularCoop, MÉDIO: ~3,1 min dupla perfeita, ~3,4 mista, ~3,8 média; os tiques da regra não entram
na simulação).

**Expedição:** `queenLacaios` (Robozinhos e pop-ups: 1 fase, 4 cartas simples, sem regra, HP 230, ~1,7-2,0 min) e
`queenTenente` (O Firewall: a mesma regra em versão leve, raio 190/170, carência 2,2 s, tique a cada 1,3 s, só um
muro por ataque, sem Interferência nem REBOOT; HP 380, ~2,6-3,2 min). Os dois têm `expedicao: true`, ficam fora de
`ORDEM_CHEFES` (a Selecao não lista) e abrem com `scene.start('CoopArena', { chefe: 'queenLacaios' | 'queenTenente' })`.
Sprites desenhados por código em `arte/expedicao.js`. Testes: `coop/__tests__/queenWifi.test.js` e `queenRegra.test.js`.

## Chaos King: TABULEIRO REAL (CO-OP 2.0)

**A regra** (`coop/chefes/kingRegra.js`): *"As peças piscam as casas que vão golpear; no XEQUE, capture a peça para
soltar o parceiro."* O quadro vira um tabuleiro de xadrez (8 x 4 casas; 4 x 4 no Cavaleiro). Cada peça mostra o
ícone e pisca em vermelho as casas que vai golpear (`telegrafoMs` de 560 a 1100 ms) e só depois golpeia: é o aviso
das cartas, e o validador `[telegrafo]` / `[rota de fuga]` fica limpo (os golpes são `jaAvisada` depois do `a.aviso`;
as linhas inteiras da torre passam por `a.parede`).

| Peça | Golpeia |
|---|---|
| peão | as duas diagonais da frente, e marcha uma casa por golpe (3 golpes até o fim) |
| torre | a linha OU a coluna inteira, mirada no coração |
| bispo | as duas diagonais, a partir da borda de cima ou de baixo |
| cavalo | as casas em L (a dele fica livre) |
| rainha | linha + coluna + diagonais; nasce da PROMOÇÃO de um peão (aviso 35% maior) |

**Justiça e rede** (`coop/chefes/kingTabuleiro.js`, puro e testado): cada peça só entra na jogada se sobrar um
REFÚGIO (bloco livre de 2 x 2 casas) ao alcance de cada coração durante o aviso; nada cai nas casas protegidas; ao
menos uma peça mira a casa do coração parado (`a.alvo()` dentro de `a.isolado`). O dano é de balas comuns: cada PC
decide o dos corações dele.

**XEQUE** (cartas `Xeque!`, `Xeque Duplo`, `Xeque da Rainha`; só com 2 ou mais de pé): uma torre (rainha na fase 3)
prende UM coração numa gaiola dourada de 2 x 2 casas (a regra empurra o coração de volta, só no PC dono dele) e
mostra uma contagem 3-2-1: no fim, golpeia a gaiola toda. O parceiro (qualquer outro, no grupo) **captura a torre
pisando na casa dourada dela** (zona da regra, lá em cima, perto dele): o golpe some, a gaiola abre (seta verde = a
saída) e a QUEBRA ganha 25. O aviso vai de 3 s (fase 1) a 2,6 s; a CPU aliada corre para a casa (`alvoDoBot`). A gaiola, a
casa e o preso saem só do estado (`api.rng('xeque')`, quem está de pé, onde cada coração nasce): igual em todos os PCs.

**ROQUE** (fase 3: cartas `Roque` e `Tabuleiro Virado`): "ROQUE!" e, 1,3 s depois, cada coração vai ao ponto
espelhado do tabuleiro (`api.empurrar`, só no PC dono); a primeira peça só avisa depois da troca.

**Cartas por fase** (♠ ataque, ♣ armadilha, ♦ controle, ♥ cura; jogadas em `chefes/kingCartas.js`):

| Fase (HP) | Cartas |
|---|---|
| 1 (100%): peões e torres | ♠3 Peões em Marcha · ♣4 Torre à Vista · ♠6 Torres Gêmeas · ♦5 Xeque! · ♥4 Ajeitar a Coroa |
| 2 (66%): bispos e cavalos | ♠8 Bispos em V · ♣9 Salto do Cavalo · ♠11 Corte Real · ♦10 Xeque Duplo · ♥8 Guarda Real |
| 3 (33%): promoção e roque | ♠10 Promoção · ♣11 Roque · ♠13 Tabuleiro Virado · ♦12 Xeque da Rainha · ♥9 Coroa Reforçada |
| SUPER | Xeque-Mate: torres, bispos, cavalos e a rainha, jogada atrás de jogada |

**Expedição** (`expedicao: true`, fora da `Selecao`; `scene.start('CoopArena', { chefe: 'kingLacaios' | 'kingTenente', ... })`):
- `kingLacaios` (**Lacaios do Rei**, HP 260, sem regra): a torre e dois peões num só sprite (`king-lacaios`); cartas de
  peões e torre, 2 fases. Aquecimento de ~2 min.
- `kingTenente` (**O Cavaleiro**, HP 430): tabuleiro 4 x 4 (a caixa vira 190 x 190) e só cavalos; a regra vem em
  versão leve (`O TABULEIRO`: ler as casas piscando), sem XEQUE nem ROQUE. ~3 min.

Arte por código: `arte/kingSprites.js` (os ícones `king-p-*`) e `arte/expedicao.js` (`king-lacaios`, `king-cavaleiro`). Testes:
`coop/__tests__/kingTabuleiro.test.js`.

Balanceamento (`medirChefes.mjs` + `simularCoop.mjs`, MÉDIO, 300 partidas, zero avisos `[telegrafo]`/`[rota de fuga]`):
chefão 3,0 a 3,7 min (7,5 a 8,8 rodadas, HP 520), lacaios 1,9 a 2,0 min (HP 260), Cavaleiro 2,8 a 3,0 min (HP 430).
A medição não liga a regra: o XEQUE e o ROQUE não entram nas médias (o baralho sem regra joga só as peças).
