# Boss semanal (Fase 4E)

Toda **segunda-feira 00:00 de São Paulo** entra um chefe novo. O boss semanal é **sempre uma EXPEDIÇÃO**
(lacaios → melhoria → tenente → melhoria → ele; ver "Expedição semanal"). **Completar** a expedição semanal no
CO-OP online (2 a 4 jogadores) dá o **troféu exclusivo daquela semana**, uma vez por conta. O troféu leva a semana no id e
**nunca volta**. Quem não jogou numa semana não perde nada (sem sequência, sem punição): só não leva o
troféu daquela semana. O XP normal do CO-OP e o XP da Expedição (por luta vencida, o bônus de completar, o baú do
dia e o verso exclusivo na 1ª vez) valem como em qualquer expedição.

## Semana, agenda e troféu (`src/lib/semanal.js`)

- **Id da semana**: `AAAA-Sxx`, a semana ISO (segunda a domingo) da data local de
  `America/Sao_Paulo`. A virada é o primeiro instante da segunda no fuso, calculado com `Intl` (vale com
  ou sem horário de verão: o teste cobre a meia-noite pulada de 2018-11-04 e a hora repetida de 2019).
- **O relógio é o do servidor**: o `bemvindo` leva `semanal { semana, chefe, trofeu, restanteMs }` e
  `semanalInfo` pede de novo (o lobby pede sozinho quando a contagem zera). O navegador só conta o tempo.
- **Agenda**: `AGENDA = ['escuridao', 'ladra']`; a semana N (N = 0 na semana de 2026-11-02) é
  `AGENDA[N % AGENDA.length]`. Para pôr mais chefes, acrescente no fim (e o troféu em `SEMANAIS`).
- **Troféu**: `<tipo>.semanal_<ano>_<número>` (ex.: `titulo.semanal_2026_45`). O tipo gira a cada volta
  do chefe (título, moldura, verso), o nome leva a semana ("Ouvido Absoluto S45/26"). `trofeuDoId(id)`
  reconstrói tudo pelo id (a Coleção e os versos usam isso: `itemDoCatalogo` em `src/lib/progresso.js`).

## Onde aparece

- **ONLINE** (`scenes/Lan.js`): o cartão **BOSS SEMANAL** à direita do JOGAR (→ do JOGAR chega nele):
  arte do chefe, nome, a mecânica em até 6 palavras, "troca em 3d 04h" e "troféu: <nome>" com cadeado ou
  ✓ ("complete a expedição para levar"). A cria a sala do boss. Na sala, o MODO do dono tem a opção BOSS SEMANAL.
- **Sala do boss** (`server/lan.js`): `criar {semanal: true}` / `salaSemanal {valor}`. É CO-OP de 2 a 4:
  o modo segue o tamanho (`coop` com 2, `coop4` com 3–4). Trocar o modo tira o boss. A escolha de party
  pula a Selecao (o chefe é o da semana) e a Dificuldade (agora "EXPEDIÇÃO SEMANAL: ESCOLHA O NÍVEL") não volta;
  dali o host leva todos para o mapa da expedição (`Expedicao`, com o cartão COMO FUNCIONA na 1ª vez).
- **Modo Party**: **BOSS SEMANAL** é mais um cartão da votação do modo (só CO-OP; `party/regras.js`
  `opcoesDeModo(n, { semanal })`). Ganhar pula a votação do chefe (`party {acao: 'modo', modo: 'coop4',
  semanal: true}`).
- **Contra a CPU** (offline ou sem sala): a Selecao da EXPEDIÇÃO (ModoCoop → EXPEDIÇÃO) mostra o boss da semana
  como 6ª carta, com a faixa "SEMANAL S47/26" (o da sala online, ou o do relógio daqui). É a mesma expedição, **sem
  troféu** (o troféu é validado no servidor). A SORTEADA nunca sorteia um semanal.
- **Não existe mais luta solta** contra o boss semanal: a Dificuldade transforma qualquer pedido do chefe da semana
  (sala, party, Selecao) numa expedição (`Dificuldade.init`: `CHEFES[chefe].semanal` → modo `expedicao`).
- **Coleção**: aba **TROFÉUS SEMANAIS** (os ganhos, a semana mais nova primeiro, e o da semana atual com
  cadeado); equipam como os outros. **Perfil**: a linha "troféus semanais".

## Recompensa (servidor + `supabase/migrations/0010_boss_semanal.sql` e `0018_expedicao_semanal.sql`)

1. A partida nasce marcada com a semana do relógio do servidor (`sala.semanalFixo`): virou a semana no
   meio da luta, vale a semana em que ela começou.
2. A expedição inteira é uma partida só. No fim (`ExpedicaoFim`) cada PC relata o resultado do CO-OP com `semana`
   (a da sala, que a arena guarda nas 3 lutas da expedição semanal) e `expedicao { chefe, lutas, sorteada }`.
3. O XP é decidido como sempre (CO-OP de 2: os dois concordam; de 3–4: o host decide e a maioria
   confere). Depois do `conceder_recompensa`, `ladosDoTrofeu` (`server/partidas.js`) escolhe quem leva:
   decisão **validada**, **≥ 60 s** e **≥ 2 rodadas**, lado com **conta**, resultado **vitória**, o relato
   dizendo a **mesma semana** e a **expedição do chefe da semana completa** (`completouExpedicaoDe`: o chefão da
   semana e as 3 lutas). Convidado, contestada, curta, derrota, outra semana ou expedição pela metade: nada. O XP
   da expedição sai como em qualquer outra (`expedicaoDaPartida` → `conceder_expedicao`, 0017 + 0018).
4. `conceder_trofeu_semanal(partida, semana, item, tipo, nome)` (só o servidor; recriado na 0018 para também
   exigir a expedição semanal completa no relato) confere tudo de novo no banco, cria o item no catálogo (`exclusivo`, `semana`, nível 1000: a trilha de níveis nunca entrega) e
   grava `trofeus_semanais` (chave conta + semana: **uma vez por conta**; de novo devolve `novo = false`).
   RLS: cada um lê só os seus; ninguém do navegador escreve.
5. A `recompensa` traz `trofeu { id, semana, novo }`; a faixa de XP da Vitoria mostra "TROFÉU SEMANAL" e o
   item entra na Coleção na hora.

## ESCURIDÃO (semana 0, 2, 4...) — `coop/chefes/escuridao.js`, `coop/semanal/escuridao.js`, `pistas.js`, `escuridaoRegra.js`

Inspirado na estátua do Gerson: **desvie pelo som**.

- A caixa fica quase preta (95%): cada PC vê só o **próprio coração**, com um brilho fraco; os corações
  dos aliados ficam por baixo do escuro; a faixa de aproximação desliga.
- **Pistas de som** (contexto de áudio único, `pistaSonora` em `audio.js`), relativas ao **meu** coração:
  panorâmica = posição horizontal (meia caixa já é o lado todo), altura = posição vertical (2 oitavas,
  agudo em cima), um **tique que acelera** com a urgência (520 → 70 ms) e um **timbre por ataque**:
  chuva = chiado, laser = zumbido de serra, bomba = tambor grave, o resto = sino; os de assinatura dela:
  mão da sombra = tambor, olhar = zumbido, velas = chiado, eco = sino (`pistas.js` `TIMBRES`). Urgência = o
  maior entre a proximidade (150 px) e o tempo até chegar (1,6 s); uma bala ainda avisando soa ~0,6 s antes de
  valer. No máximo **4 vozes**, as mais urgentes.
- **Aliado acertado**: um bipe curto de duas notas vindo do lado do coração dele.
- **Clarões** a cada 4,2–6,5 s mostram as balas por 0,5 s. Com "clarões" desligados ou "reduzir
  animações": sem clarão branco, o escuro só clareia num brilho roxo.
- **Acessibilidade**: preferência **"Pistas visuais no lugar do som"** (Config): setas na borda da caixa
  na direção de cada bala, mais fortes quanto mais perto. Liga sozinha na luta com os efeitos no 0 (e
  avisa). Antes da primeira luta, uma vez por navegador: "USE FONE DE OUVIDO".

### Regra CO-OP 2.0: OLHOS NO BREU (`coop/semanal/escuridaoRegra.js`)

*"Olhos se abrem no escuro: fiquem em cima deles para fechar e encher a QUEBRA!"*

- Em cada esquiva, **olhos** da Escuridão abrem no quadro, um de cada vez (2 na fase 1, 3 nas fases 2 e 3, +1
  por jogador além de 2). Eles **brilham por cima do breu** (roxo, íris vermelha) e **sussurram** do lado
  deles (um sino grave na panorâmica das pistas de som).
- Um coração parado **em cima** de um olho aberto o fecha com a própria luz: o **anel dourado** enche em 1,15 s
  sozinho e **na metade com dois juntos** (`luzPorMs`, no máximo x2). Cada olho fechado: **+13 de QUEBRA** e
  **1,5% do HP** dela de golpe.
- Fechar **todos** os olhos da esquiva: **"O BREU RECUA!"** e um clarão (o escuro abre e mostra as balas).
- **Prévia**: olho que ficou **aberto** no fim da esquiva deixa a **próxima rodada no escuro**: nela a prévia
  da carta de depois vira **"?" NO ESCURO** (gancho `previa` da regra, `coop/regraChefe.js`). O SUPER e o
  ATORDOADO continuam aparecendo.
- Fase 2: os olhos **piscam** (fechados 0,65 s a cada 2,35 s: a luz só pega aberto). Fase 3: os olhos **andam**
  (24 px/s, quicando nas bordas).
- Rede: os olhos saem do `api.rng` (iguais em todos os PCs) e andam por uma função do tempo; quem está em cima
  vem das zonas da API (o PC dono do coração decide e repassa); quem decide que o olho **fechou** é o PC dono do
  **menor** coração em cima (`api.enviar('fechou')`, com a rodada): a QUEBRA e o golpe entram uma vez em cada PC.
  Sem mensagem nova, sem PROTOCOLO novo.
- CPU aliada: vai para o olho aberto mais perto (`alvoDoBot`), o que já junta a dupla no mesmo olho.

### Ataques de assinatura (`attacks/escuridao*.js`)

No escuro as **balas ficam escondidas**, mas o **aviso brilha por cima do breu** (profundidade
`AVISO_NO_ESCURO`, 9,55): a sombra se denuncia pela própria luz. Todos com a semente do ataque, zonas de perigo
para a CPU e escala por nível (ritmo) e por fase (as opções da carta).

| Ataque | O que faz | Aviso (mín.) | Justiça |
|---|---|---|---|
| `escuridaoMaos` MÃOS DA SOMBRA | uma poça borbulha na borda, na linha de um coração; a mão estica pela faixa até 78–82% da caixa, abre os dedos (que voam devagar) e volta | a faixa acende 0,7 s | `alcance` < 1: o fundo da faixa é seguro; a faixa tem 26 px |
| `escuridaoEco` ECO | um sino balança num canto escuro (longe dos corações) e toca um anel de notas com uma **brecha** marcada em verde; o eco toca do lado **espelhado** da caixa, com a brecha espelhada | o sino 0,65 s | brecha de 0,9 rad (72 px quando o anel chega) |
| `escuridaoOlhar` O OLHAR | um olho enorme se abre na borda de cima; o feixe do olhar varre um leque (do lado mais longo para o meio) e, com `vaivem`, volta; com `lagrimas`, gotas caem embaixo dele | o leque acende 0,8 s | o arco é < 0,8π: sempre sobra um lado; a ponta anda no máximo a fuga do coração; um olho por vez |
| `escuridaoVelas` VELAS QUE SE APAGAM | velas acendem longe dos corações (as únicas luzes do breu); a chama treme, o anel fecha e ela apaga estourando em estilhaços (com `segunda`, um 2º anel defasado) | a chama treme 0,8 s | nasce a 70 px dos corações; até 9 estilhaços (a brecha a 90 px passa da lacuna mínima) |

| Fase (HP) | Cartas |
|---|---|
| 1 (100%) | ♠ Mão da Sombra · ♦ Sino no Escuro · ♣ Velas · ♠ Zumbido · ♥ Respirar Fundo |
| 2 (60%) | ♠ O Olhar · ♣ Velório · ♦ Eco Duplo · ♠ Mãos no Breu · ♥ Silêncio |
| 3 (30%) | ♠ Olhar Fixo (vaivém e lágrimas) · ♣ Apagão · ♦ Coro de Sinos · ♠ Abraço da Sombra · ♥ Breu Eterno |

SUPER *Breu Total*: o olho varre, as mãos saem da poça e as velas apagam, tudo no escuro.

## LADRA DE CARTAS (semana 1, 3, 5...) — `coop/chefes/ladra.js`, `coop/semanal/ladra.js`, `ladraCena.js`, `ladraRegra.js`

- Começo de **cada rodada**: ela **rouba uma carta** (2 a K; nunca Ás nem SUPER) da mão do próximo
  jogador de pé do **rodízio**; a luva dela vai até o personagem e volta com a carta. Até 4 roubadas.
- A **cada duas rodadas** (ou com 4 na mão) a carta virada dela é a roubada **mais antiga**, jogada contra
  o time com o efeito da carta virado:

  | naipe roubado | o que ela faz |
  |---|---|
  | ♠ golpe | cartas bumerangue miradas nos corações (mais e mais rápidas quanto maior o valor) |
  | ♦ atraso | **adianta** as balas (o ♦ do jogador atrasa o chefe; o dela acelera o dobro) |
  | ♣ armadilha | cartas-bomba no espelho dos corações (mais bombas quanto maior o valor) |
  | ♥ cura | ela se cura (4 × valor, dobrado como toda cura de chefe) e manda o ataque fraquinho |

  Jogada (ou anulada, refletida, roubada pelo A♣, varrida), a carta volta ao **descarte do dono**.
- **Recuperar**: cada **♣** de quem joga pega a ladra e devolve a **última** roubada para a **mão** do
  dono; um **SUPER** devolve **todas**; e, na esquiva, a regra **PEGA LADRA!** (abaixo).
- A mão dela fica **virada para cima** em cima dela (valor, naipe e a cor da vaga do dono); a **marcada** (a mais
  antiga, a próxima que ela joga) pulsa.
- **Prévia**: em vez do antigo "carta roubada?", a prévia mostra **qual** roubada ela vai jogar: *"ROUBADA do
  P1: 7♠"* (`previaDoChefe` tipo `roubada`, `coop/coop2.js`).
- Grupo de 3–4: a vida e o resto escalam por `GRUPO[n]` como nos outros chefes.

### Regra CO-OP 2.0: PEGA LADRA! (`coop/semanal/ladraRegra.js`)

*"A carta marcada foge pelo quadro: encostem nela para devolver ao dono e encher a QUEBRA!"*

- Na esquiva, a carta **marcada** (a roubada mais antiga: a da prévia, a que ela vai jogar) **foge pelo quadro**:
  desce do alto, zanza num zigue-zague (Lissajous) e, depois de uma janela (3,8 s; 3,6; 3,3), volta voando para
  ela. É a carta de verdade (valor, naipe, a borda na cor do dono), com o brilho laranja e "PEGA!".
- **Encostar** nela devolve a carta para a **mão do dono** (`recuperarRoubada`) e enche **+16 de QUEBRA**
  ("RECUPERADA! P1"). Ela nunca é mais rápida que o coração (85 / 100 / 120 px/s; o coração anda 180).
- Fase 2: fogem as **duas** mais antigas. Fase 3: elas **correm mais**.
- Rede: as cartas saem de `estado.chefe.roubadas` (igual em todos os PCs, `api.chefe()`) e andam por uma função
  do tempo da esquiva (`planejarFuga`/`posicaoDaFuga`, sorteio do `api.rng`); o toque é decidido pelo PC dono do
  coração (a API repassa) e a devolução sai do mesmo estado em todos. Sem PROTOCOLO novo.
- CPU aliada: corre atrás da carta que foge (`alvoDoBot`); com um feixe do **ALARME** chegando, atravessa pelo
  vão primeiro (`alvoDoAlarme`, que o `medirChefes.mjs` também passa ao bot).

### Ataques de assinatura (`attacks/ladra*.js`)

| Ataque | O que faz | Aviso (mín.) | Justiça |
|---|---|---|---|
| `ladraTruque` TRUQUE DAS TRÊS CARTAS | ela abre as cartas no alto (a **dama ♥** e as **bombas**), vira, embaralha em arcos (cada troca 10% mais rápida) e, quando param, chove naipe nas colunas das bombas | as colunas das bombas acendem 0,6 s (e quem seguiu a dama já sabe) | a coluna da dama tem 84–112 px; um truque por vez |
| `ladraBumerangue` CARTAS BUMERANGUE | a trilha pontilhada sai da borda na direção de um coração; a carta entra girando, freia no fim da trilha e **volta** pelo mesmo caminho | a trilha 0,5 s | a carta nasce fora e para antes da borda do outro lado; a zona vale a ida e a volta |
| `ladraAlarme` ALARME | o alarme do cofre: **feixes de segurança** atravessam a caixa devagar, cada um com um **vão** (verde); com `deriva` o vão escorrega; com `cruzado`, um de cada eixo | a borda pisca 0,6 s | vão de 66 px; o feixe anda a ~62 px/s (o coração, 180) |
| `ladraEspelho` A CÓPIA | o vulto dela aparece no **espelho** de um coração (o ponto do outro lado do centro) e larga cartas-bomba (em rajada, sempre no espelho do mesmo coração); o pavio queima e a carta estoura em 4 ou 8 naipes | o pavio 0,8 s | os naipes saem da carta; com 8, a brecha a 80 px passa da lacuna mínima |

O alarme **nunca** vem junto com o bumerangue (a carta mirada no coração passaria pelo único vão do feixe).

| Fase (HP) | Cartas |
|---|---|
| 1 (100%) | ♠ Bater Carteira · ♦ Truque das Três Cartas · ♣ Alarme · ♠ Leque de Facas · ♥ Contar o Lucro |
| 2 (60%) | ♦ Truque Rápido · ♣ Alarme Cruzado · ♠ A Cópia · ♠ Mão Leve · ♥ Esconderijo |
| 3 (30%) | ♦ Quatro Cartas (4 cartas, 1 dama) · ♣ Cofre Blindado (o vão escorrega) · ♠ Grande Cópia · ♠ Chuva de Cartas · ♥ Fuga |

SUPER *Grande Golpe*: a cópia larga cartas-bomba no seu espelho enquanto as cartas bumerangue voam.

## Expedição semanal

Pedido do dono: "Quero que todos os bosses semanais sejam expedição." O boss da semana é **sempre** a 3ª luta de uma
[Expedição](coop-cartas.md#expedição): **lacaios → melhoria (votem) → tenente → melhoria → o chefe da semana**, com o
HP passando de uma luta para a outra, a cura entre as lutas, as relíquias e o aperto de cada etapa
(`ETAPA_EXPEDICAO`). Não há mais luta solta contra ele.

| Semanal | Lacaios (`<chefe>Lacaios`) | Tenente (`<chefe>Tenente`) | Chefão |
|---|---|---|---|
| Escuridão | **Sombrinhas**: gotas de breu soprando a vela; mãozinhas, sininho e velas leves, **sem** breu nem regra | **O Apaga-Velas**: a sombra de cartola e olho só com o apagador de velas; **com o breu** (`escuro`) e OLHOS NO BREU leve (1 olho, 2 na fase 2, fecha em 0,95 s) | Escuridão |
| Ladra | **Pivetes**: três pivetes de capuz; bumerangue, truque e sirene leves, **sem** roubo nem regra | **O Receptador**: o comprador de muamba de sobretudo aberto; **com o roubo** (`ladra`) e PEGA LADRA! leve (só a marcada, mais devagar e por mais tempo) | Ladra |

- Todos `expedicao: true` e `oculto: true` (fora de `ORDEM_CHEFES`, de `SEMANAIS` e da SORTEADA), em `coop/chefes/`,
  com a arte de densidade 2 em `arte/semanais.js` (`SEMANAIS_EXPEDICAO`, juntos no `EXPEDICAO` de `arte/expedicao.js`).
- `coop/expedicao.js`: `LUTAS.escuridao` / `LUTAS.ladra`, `SEMANAIS_EXPEDICAO`, `ehExpedicaoSemanal(exp)` e
  `criarExpedicao({ ..., semana })` (a semana `AAAA-Sxx` fica na expedição).
- **Entrada**: a `Dificuldade` transforma o chefe da semana numa expedição (de onde vier: sala do boss, party ou
  Selecao) e mostra "EXPEDIÇÃO SEMANAL: ESCOLHA O NÍVEL" e "boss semanal · S47/26"; dali o mapa (`Expedicao`) com o
  cartão COMO FUNCIONA A EXPEDIÇÃO na 1ª vez. O mapa diz **EXPEDIÇÃO SEMANAL · S47/26**. Contra a CPU, a 6ª carta da
  Selecao da expedição (faixa SEMANAL). A revanche do fim mantém o semanal e a semana.
- **Rede**: igual à Expedição de sempre (2 jogadores na `CoopArena`, 3–4 na `CoopArenaN`, os votos pelo canal, o
  host leva todos com `irParaCena`); a arena guarda a semana nas 3 lutas (`registry 'semanal'` quando o chefão da
  expedição é o da semana). Sem mensagem nova: PROTOCOLO igual.
- **Recompensa**: o XP da expedição (por luta vencida, o bônus de completar, o baú do dia por chefão) e, na 1ª
  expedição completa contra cada semanal, o **verso exclusivo** (`verso.exp_breu` "Breu Absoluto" da Escuridão,
  `verso.exp_cofre` "Cofre Arrombado" da Ladra, desenhados em `cosmeticos/versos.js`). O **troféu da semana** só sai
  completando a expedição semanal (ver "Recompensa"). Banco: `0018_expedicao_semanal.sql` (docs/supabase.md 2.12).

## Dificuldade e arte

Boss semanal é o **desafio da semana**: fica na ponta dura da [dificuldade do CO-OP](coop-cartas.md#dificuldade-do-co-op).
A QUEBRA, o ATORDOADO, a FINALIZAÇÃO, o resgate e as cartas de dupla ficam como nos outros chefes.

**Medido** (`medirChefes.mjs` 6–8 sementes por carta, `simularCoop.mjs` 300 partidas; "média" = dois bots normais,
"mista" = um perfeito e um normal; antes = `8e33b06`):

| | antes | depois |
|---|---|---|
| Escuridão: acertos/rodada no MÉDIO (normal · perfeito) | 0,21 · 0,01 (79% das rodadas sem dano, 1,1 bala/s a 76 px/s) | 0,90 · 0,10 (40% sem dano) |
| Ladra: acertos/rodada no MÉDIO (normal · perfeito) | 0,79 · 0,10 (44% sem dano) | 0,79 · 0,18 (47% sem dano) |
| dano por acerto no MÉDIO, média das cartas (Escuridão / Ladra) | 6,8 / 7,6 | ~21 / ~27 |
| luta solta, dupla média, F / M / D (Escuridão) | 100 / 100 / 100% | 100 / 97 / 37% |
| luta solta, dupla média, F / M / D (Ladra) | 100 / 100 / 100% | 100 / 78 / 34% |
| luta solta, dupla mista, M / D (Escuridão · Ladra) | 100 / 100 · 100 / 100% | 100 / 100 · 99 / 83% |
| **expedição semanal completa**, dupla média, F / M / D (Escuridão) | — | 100 / **87** / **20%** |
| **expedição semanal completa**, dupla média, F / M / D (Ladra) | — | 100 / **62** / **21%** |
| expedição semanal completa, dupla mista, M / D (Escuridão · Ladra) | — | 100 / 96 · 99 / 70% |

Os números do jogo: Escuridão `hp` 280 → 520, `danoBala` 9 → 15, `desafio` 0,72/0,62 → 0,98/0,95, `niveis` MÉDIO
velocidade x1,08, densidade x1,12, dano x1,7, HP x1,15 e DIFÍCIL dano x1,8, HP x1,15; Ladra `hp` 270 → 520,
`danoBala` 10 → 16, `desafio` 1,12/1,12 (não tinha), MÉDIO velocidade x1,05, densidade x1,12, dano x2,1, HP x1,25 e
DIFÍCIL dano x1,9, HP x1,15. Lacaios (260 HP, dano 11) e tenentes (420 HP, dano 13) seguem os da Expedição; o chefão
leva o aperto da etapa (`ETAPA_EXPEDICAO.chefao`: HP x1,3, dano x1,2, SUPER a cada 7 rodadas).

A simulação não tem as regras (fechar olhos e pegar a carta fujona enchem a QUEBRA e ajudam o time) nem o **escuro**
(o bot vê tudo; quem joga só vê os avisos e ouve as pistas): por isso a Escuridão fica um pouco acima da Ladra na luta
solta. **No navegador o chefão semanal é bem mais duro que na simulação** (a CPU aliada e o bot correm atrás dos olhos e
da carta fujona, no meio das balas): com o MÉDIO a dano x2,5–2,7 a dupla caiu no chefão nas 4 expedições (as duas
primeiras lutas sempre vencidas); por isso o MÉDIO baixou (Escuridão dano x1,7 e HP x1,15, Ladra dano x2,1), e aí as
expedições das duas foram completas no navegador (Escuridão 6:04 com HP 78 e 98; Ladra 7:42 com HP 90 e 46). A
simulação fica otimista (62–87% no MÉDIO); poucas expedições no navegador não dão um número, mas o chefão continua
sendo a luta que decide, na ponta dura como desafio da semana. No DIFÍCIL a dupla média quase sempre perde;
o FÁCIL continua acessível.

**Arte**: os dois foram redesenhados em pixel art de **densidade 2** (`arte/semanais.js`, com o pintor de
`arte/pintor.js`: rampas de 4 tons, contorno escuro e 3 quadros de animação parada), como os chefões do CO-OP:
a **Escuridão** é um vulto de fumaça com um olho enorme, a boca de dentes, olhinhos que piscam pelo corpo, braços
de sombra com garras e fiapos que sobem; a **Ladra** tem capuz, máscara de dominó, cachecol laranja ao vento, o
leque de cartas erguido e o saco do roubo com uma moeda. Todas as telas usam `escalaDe` (texturas.js).

## Testes e dev

- `src/lib/__tests__/semanal.test.js` (virada, horário de verão, agenda, troféus),
  `server/__tests__/semanal.test.js` (protocolo, sala, troféu uma vez, nada sem validação),
  `server/__tests__/semanalSql.test.js` (0010 no Postgres com `DODGE_PG`), `server/__tests__/expedicaoSql.test.js`
  (0017 + 0018: o verso e o baú da Ladra, o troféu só para quem completou), `coop/__tests__/semanaisRegra.test.js`
  (as duas regras, os baralhos e a expedição semanal),
  `coop/__tests__/pistas.test.js` (mapeamento das pistas e das setas), `coop/__tests__/ladra.test.js`,
  `party/__tests__/semanal.test.js`.
- Dev: `ONLINE=1 DODGE_CONTAS_FALSAS=1 DODGE_SEMANA=1 npm run dev` liga contas de teste e o banco falso
  (`server/contasFalsas.js`) e adianta a agenda N semanas; no navegador
  `window.debugConta.fingir({ id: '<uuid>', nome: 'ANA' })`. Na arena: `coopArena.escuridao.estadoDebug()` /
  `.clarao()`, `coopArena.ladra.cartas()`.

## O que os próximos chefes reaproveitam (Gêmeos Opostos etc.)

A agenda e os troféus (só acrescentar em `AGENDA` e `SEMANAIS`), a sala/party/validação/migration (nada
muda), o formato de chefe com `semanal: true` (fora da Selecao), os ganchos de arena por bandeira
(`escuro`, `ladra`: um módulo `ligar…(cena, …)` que se desliga no shutdown) e as regras puras chamadas de
`coop/regras.js` (como o roubo). As pistas de som/setas servem para qualquer chefe "às cegas".
