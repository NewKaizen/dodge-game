# Boss semanal (Fase 4E)

Toda **segunda-feira 00:00 de São Paulo** entra um chefe novo. Vencê-lo no CO-OP online (2 a 4
jogadores) dá o **troféu exclusivo daquela semana**, uma vez por conta. O troféu leva a semana no id e
**nunca volta**. Quem não jogou numa semana não perde nada (sem sequência, sem punição): só não leva o
troféu daquela semana. O XP normal do CO-OP continua valendo em toda vitória.

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
  ✓. A cria a sala do boss. Na sala, o MODO do dono tem a opção BOSS SEMANAL.
- **Sala do boss** (`server/lan.js`): `criar {semanal: true}` / `salaSemanal {valor}`. É CO-OP de 2 a 4:
  o modo segue o tamanho (`coop` com 2, `coop4` com 3–4). Trocar o modo tira o boss. A escolha de party
  pula a Selecao (o chefe é o da semana) e a Dificuldade não volta.
- **Modo Party**: **BOSS SEMANAL** é mais um cartão da votação do modo (só CO-OP; `party/regras.js`
  `opcoesDeModo(n, { semanal })`). Ganhar pula a votação do chefe (`party {acao: 'modo', modo: 'coop4',
  semanal: true}`).
- Não existe offline nem na LAN sem conta: o troféu é validado no servidor.
- **Coleção**: aba **TROFÉUS SEMANAIS** (os ganhos, a semana mais nova primeiro, e o da semana atual com
  cadeado); equipam como os outros. **Perfil**: a linha "troféus semanais".

## Recompensa (servidor + `supabase/migrations/0010_boss_semanal.sql`)

1. A partida nasce marcada com a semana do relógio do servidor (`sala.semanalFixo`): virou a semana no
   meio da luta, vale a semana em que ela começou.
2. Cada PC relata o resultado do CO-OP com `semana` (a da sala, que a arena guarda).
3. O XP é decidido como sempre (CO-OP de 2: os dois concordam; de 3–4: o host decide e a maioria
   confere). Depois do `conceder_recompensa`, `ladosDoTrofeu` (`server/partidas.js`) escolhe quem leva:
   decisão **validada**, **≥ 60 s** e **≥ 2 rodadas**, lado com **conta**, resultado **vitória** e o relato
   dizendo a **mesma semana**. Convidado, contestada, curta, derrota ou outra semana: nada.
4. `conceder_trofeu_semanal(partida, semana, item, tipo, nome)` (só o servidor) confere tudo de novo no
   banco, cria o item no catálogo (`exclusivo`, `semana`, nível 1000: a trilha de níveis nunca entrega) e
   grava `trofeus_semanais` (chave conta + semana: **uma vez por conta**; de novo devolve `novo = false`).
   RLS: cada um lê só os seus; ninguém do navegador escreve.
5. A `recompensa` traz `trofeu { id, semana, novo }`; a faixa de XP da Vitoria mostra "TROFÉU SEMANAL" e o
   item entra na Coleção na hora.

## ESCURIDÃO (semana 0, 2, 4...) — `coop/chefes/escuridao.js`, `coop/semanal/escuridao.js`, `pistas.js`

Inspirado na estátua do Gerson: **desvie pelo som**.

- A caixa fica quase preta (95%): cada PC vê só o **próprio coração**, com um brilho fraco; os corações
  dos aliados ficam por baixo do escuro; a faixa de aproximação desliga.
- **Pistas de som** (contexto de áudio único, `pistaSonora` em `audio.js`), relativas ao **meu** coração:
  panorâmica = posição horizontal (meia caixa já é o lado todo), altura = posição vertical (2 oitavas,
  agudo em cima), um **tique que acelera** com a urgência (520 → 70 ms) e um **timbre por ataque**:
  chuva = chiado, laser = zumbido de serra, bomba = tambor grave, o resto = sino. Urgência = o maior entre
  a proximidade (150 px) e o tempo até chegar (1,6 s); uma bala ainda avisando soa ~0,6 s antes de valer.
  No máximo **4 vozes**, as mais urgentes.
- **Aliado acertado**: um bipe curto de duas notas vindo do lado do coração dele.
- **Clarões** a cada 4,2–6,5 s mostram as balas por 0,5 s. Com "clarões" desligados ou "reduzir
  animações": sem clarão branco, o escuro só clareia num brilho roxo.
- **Acessibilidade**: preferência **"Pistas visuais no lugar do som"** (Config): setas na borda da caixa
  na direção de cada bala, mais fortes quanto mais perto. Liga sozinha na luta com os efeitos no 0 (e
  avisa). Antes da primeira luta, uma vez por navegador: "USE FONE DE OUVIDO".
- Justo: padrões mais lentos e espaçados que os outros chefes (`desafio` 0,72 / 0,62), poucos tipos de
  bala.

## LADRA DE CARTAS (semana 1, 3, 5...) — `coop/chefes/ladra.js`, `coop/semanal/ladra.js`, `ladraCena.js`

- Começo de **cada rodada**: ela **rouba uma carta** (2 a K; nunca Ás nem SUPER) da mão do próximo
  jogador de pé do **rodízio**; a luva dela vai até o personagem e volta com a carta. Até 4 roubadas.
- A **cada duas rodadas** (ou com 4 na mão) a carta virada dela é a roubada **mais antiga**, jogada contra
  o time com o efeito da carta virado:

  | naipe roubado | o que ela faz |
  |---|---|
  | ♠ golpe | tiros mirados nos corações (mais rápidos e em rajadas maiores quanto maior o valor) |
  | ♦ atraso | **adianta** as balas (o ♦ do jogador atrasa o chefe; o dela acelera o dobro) |
  | ♣ armadilha | bombas plantadas perto dos corações |
  | ♥ cura | ela se cura (4 × valor, dobrado como toda cura de chefe) e manda o ataque fraquinho |

  Jogada (ou anulada, refletida, roubada pelo A♣, varrida), a carta volta ao **descarte do dono**.
- **Recuperar**: cada **♣** de quem joga pega a ladra e devolve a **última** roubada para a **mão** do
  dono; um **SUPER** devolve **todas**.
- A mão dela fica **virada para cima** em cima dela (valor, naipe e a cor da vaga do dono).
- Grupo de 3–4: a vida e o resto escalam por `GRUPO[n]` como nos outros chefes.

## Testes e dev

- `src/lib/__tests__/semanal.test.js` (virada, horário de verão, agenda, troféus),
  `server/__tests__/semanal.test.js` (protocolo, sala, troféu uma vez, nada sem validação),
  `server/__tests__/semanalSql.test.js` (0010 no Postgres com `DODGE_PG`),
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
