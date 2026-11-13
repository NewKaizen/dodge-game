# Campanha (modo história, single-player)

Menu → **CAMPANHA**. Uma história com diálogos, **um personagem por mundo**, jogada contra a CPU.
Só **online e com conta**: o servidor precisa ver a partida para que o XP e os cosméticos valham.
Convidado (ou sem servidor de contas) vê o mapa com o aviso "Entre com sua conta para jogar a
campanha!".

| Peça | Onde |
| --- | --- |
| Regras dos mundos (fases, chefe, aliada, regra especial, metas) | `src/game/campanha/mundos/mundoN.js` |
| Textos (diálogos, escolhas, cenário, tema e falas da luta de cada fase) | `src/game/campanha/mundos/mundoN.textos.js` |
| Os CHEFES (formato do CO-OP) | `src/game/campanha/chefes.js` (registrados em `coop/chefes/index.js`, fora da seleção do CO-OP) |
| A luta (regras do CO-OP + as da fase), estrelas | `src/game/campanha/luta.js` (sobre `coop/regras.js`) |
| O quadro em passo fixo (navegador e servidor) | `src/game/campanha/quadro.js` (a cena sem tela do servidor: `cenaSemTela.js`) |
| Ataques novos da biblioteca | `src/game/attacks/garras.js`, `mandibula.js`, `arremesso.js` (attacks/ sem Phaser: `src/game/phaserPuro.js`) |
| Posições do coração: formato e plausibilidade | `src/game/campanha/amostras.js` |
| Cenário sombrio (puro, com semente) e o desenho em Phaser | `src/game/campanha/cenario.js`, `desenharCenario.js` |
| Mapa da escada (puro) · ecos na tela · texto sem ligadura | `src/game/campanha/mapa.js` · `eco.js` · `texto.js` |
| O titã · o medo (véu, batida de coração, sussurros) | `src/game/campanha/tita.js` · `medo.js` |
| Música | `scripts/musica/campanha.mjs` → `campanha.mid`, `campanha2.mid`; `scripts/musica/trilhas.mjs` → `campanha_luta`, `_chefe`, `_virada`, `_libertado`, `_final` |
| Motor dos diálogos | `src/game/campanha/dialogo.js` (a caixa: `CaixaDeDialogo.js`) |
| XP (espelho do banco) | `src/game/campanha/recompensas.js` |
| Servidor (roda a luta) | `server/campanha.js` (ligado em `server/lan.js`) |
| Banco | `supabase/migrations/0011_campanha.sql` (e `0012_campanha_mundo1.sql`: os nomes do Mundo 1) |
| Navegador | `src/lib/campanha.js`, cenas `Campanha` (mapa), `CampanhaArena` (a luta), `CampanhaFim` |

## Mundo 1: "A Casa Silenciosa" (Kris)

Na noite do Festival das Luzes, a cidade apaga de uma vez e as vozes somem. Uma sombra, **o
Silêncio** (feita de tudo o que ninguém teve coragem de dizer), prende os amigos de Kris dentro das
próprias lembranças: a sala de aula, o corredor, o ginásio, a rua, a sala de estar. As portas da casa
levam até eles. Cada luta é contra um amigo **possuído** (o eco, um CHEFE) e o Silêncio fala por ele;
vencer **liberta** o amigo, que volta com cor e **luta do seu lado na próxima porta** (a CPU aliada).
No último quarto, o do irmão que foi embora sem se despedir, o Silêncio engole Asriel e vira um
**titã**. O clímax: Kris, que não fala o mundo inteiro, diz **uma** frase ("Volta pra casa."), as luzes
da cidade voltam e o telefone toca. A história é original; os personagens são os do jogo.

| Fase | Lugar | Chefe (`inimigo`) | Aliada | Regra especial | ★ rodadas |
| --- | --- | --- | --- | --- | --- |
| 1 A Sala de Aula | `sala` | Eco do Ralsei (`c_ralsei`) | — (sozinha) | só cartas ♠ | 9 |
| 2 O Corredor que Fecha | `corredor` | Eco da Noelle (`c_noelle`) | Ralsei | o quadro perde 6% por rodada | 9 |
| 3 O Ginásio Vazio | `ginasio` | Eco do Berdly (`c_berdly`) | Noelle | `eco`: o ataque leve do chefe vem junto | 9 |
| 4 A Rua de Volta | `rua` | Eco da Susie (`c_susie`) | Berdly | começa com 0 de energia | 10 |
| 5 A Sala Onde Chove | `chuva` | Eco da Dess (`c_dess`) | Susie | todo ataque vem de cima | 10 |
| 6 O Último Quarto | `quarto` | **O Titã do Silêncio** (`c_tita`, nível MÉDIO) | Susie | **`titan`**: as cartas que você não jogou voam em você | 14 |

### A luta é um CHEFE do CO-OP

Cada fase é uma luta de chefe com **as regras do CO-OP** (`docs/coop-cartas.md`; as mesmas funções de
`coop/regras.js`): o chefe joga UMA carta por rodada (a **intenção**, virada, com o naipe à vista:
♠ ataque, ♦ controle, ♣ armadilha, ♥ ele se cura), o ataque dela roda no **quadro** grande (336×180),
você (e a aliada) desviam, e depois as cartas jogadas viram **golpes** no chefe (♠ golpe forte, ♦ golpe
que atrasa o chefe, ♣ armadilha que cresce com os grazes, ♥ cura e escudo para os dois, Ases, SUPER,
CRÍTICO no desvio perfeito, COMBO/PAR quando você e a aliada combinam). O chefe tem **fases** (troca
de baralho com uma fala de entrada) e a barra de **SUPER**. Quem cai fica fora 2 rodadas e volta;
derrota só quando todo mundo caiu.

- **A aliada** é a CPU do CO-OP (`coop/bot.js` para as cartas, `pvp/botEsquiva.js` no quadro). Na fase 1
  a vaga dela fica fora da luta (`definirPresenca(saiu: [1])`): você está sozinha.
- **Os ataques** são os da biblioteca do jogo (`attacks/`), rodando no quadro com o `ContextoAtaque` e
  a `Balas` de verdade. Três são novos, feitos para o Silêncio e válidos em qualquer modo:
  **Garras** (`garras`: três dedos em leque que avisam parados fora da caixa e dão o bote), **Mandíbula**
  (`mandibula`: a caixa fica vermelha em cima e embaixo, só a garganta fica livre, e os dentes fecham)
  e o **arremesso** do titã (`arremesso`).
- **A tela** (`scenes/CampanhaArena.js`) segue o CO-OP: o chefe no alto (um eco violeta, ou o titã
  gigante), a intenção ao lado dele, os placares nos cantos (`HudPvp`), a mão grande embaixo (cartas
  de 82 px), as cartas de cada um carregando em cima do personagem e voando no chefe no
  contra-ataque, o quadro na `BattleBox` de verdade (recorte e faixa de aproximação). Enquanto o
  chefe ataca: a borda do quadro pulsa em carmim, as bordas da tela fecham, um coração bate grave e
  sussurros aparecem (`medo.js`; "reduzir animações" tira os sussurros).

Medição (8 lutas por fase; o "jogador" é a CPU de cartas do CO-OP + o `EsquivaBot`): com o desvio
FÁCIL ele vence tudo das fases 1–5 terminando com 50–80% do HP, e o titã o deixa com ~7% (perde 1 em 8);
com o desvio NORMAL, 75–90% nas fases e ~35% no titã. Lutas de 6 a 10 rodadas.

### O chefe é um TITÃ (regra `titan`)

No último quarto o Silêncio engole Asriel e cresce até atravessar o teto: na arena ele é o sprite do
chefe **gigante** (`campanha/tita.js`), em silhueta violeta atrás de tudo, respirando, com dois olhos
que brilham (acendem quando ele ataca; na 2ª fase, rachaduras de luz e a música vira a heroica; na 3ª,
a **fúria**: olhos vermelhos). Ele entra com o nome enorme na tela e fala com **quem joga**, não com a
Kris (a quarta parede: "É VOCÊ. DO OUTRO LADO DA TELA. EU ESTOU VENDO A SUA MÃO.").

**O arremesso**: a cada rodada, as cartas da sua mão que você **não jogou** (a mão inteira, se passou
a vez) são arremessadas em você ANTES do ataque do titã. São as cartas em si, não as habilidades: na
tela, as Cartas de verdade saem da sua mão, ficam tremendo embaixo do quadro com a linha de mira e voam
onde o coração estava, quicando uma vez nas paredes. Por dentro é o ataque `arremesso` (retângulos de
20×28 com `cartaId`, em `A.sequencia` antes do ataque do titã); quem decide quais cartas voam é o
servidor (a mão dele antes da jogada). Se a carta do titã saiu da mesa (Espelho, Anular, Roubo, SUPER),
as cartas voam assim mesmo, com o ataque leve dele. Guardar cartas boas tem preço.

**Música**: `campanha_luta` nas fases, `campanha_chefe` no titã, `campanha_virada` quando ele racha (o
mesmo motivo das fases em maior), `campanha_libertado` quando um amigo volta e `campanha_final` no fim
do mundo (a melodia do mapa em Ré maior). Todas originais, geradas por `scripts/musica/trilhas.mjs`;
`__tests__/musicaTrilhas.test.js` confere loop, andamento e escala. A sua carta SUPER toca a música dela.

**Falas durante a luta** (`luta` nos textos, só sabor, no navegador): `inicio`, `ferido` (chefe com
metade do HP), `quase` (1/4), `voceMal` (você com 35%), `perfeito` (desviou de tudo). Balões nos cantos
de baixo: o chefe e o Silêncio à direita, os amigos à esquerda (só fala quem está na luta ou já livre).

Escolhas (só sabor; são ações, nunca falas): na fase 1, **guardar o bilhete** ou deixá-lo na mesa (o
chefe comenta); na fase 3, **bater palmas** uma vez ou ficar em silêncio (o Silêncio provoca). Ficam
salvas na conta.

### Tom e estilo (guia para os próximos mundos)

- **Vozes roubadas.** Lugares conhecidos que ficaram vazios e tortos, mas com **algo em jogo**: um
  vilão com voz (`quem: 'silencio'`: sem retrato, nome violeta, LETRAS GRANDES, voz grave), amigos
  presos que pedem ajuda e voltam quando você vence. Melancolia no começo, esperança crescendo a cada
  luz acesa. Humor de personagem cabe (Susie e Berdly), sem quebrar o clima. Final que resolve.
- **Kris quase não fala.** As respostas dela são `{ quem: 'kris', texto: '...' }` ou gestos na voz do
  narrador. Escolhas são **ações**, nunca falas entre aspas. Ela fala **uma vez** no mundo, no fim do
  chefe (o clímax). O `mundos.test.js` confere.
- **Narração** curta, no presente. Uma imagem por linha.
- **Ecos e libertos**: quem ainda está preso é eco (apagado); quem já foi libertado (`libertosAte` em
  `mundos/index.js`) fala com cor (`livres` na `CaixaDeDialogo`) e aparece atrás da Kris.
- **Visual "mundo sombrio estilizado"** (`campanha/cenario.js`, puro e com semente): preto com chão
  xadrez fugindo para o escuro, vitrais, portas soltas no ar, escadas impossíveis, feixes finos de
  luz, poeira parada. Cores fortes e poucas: azul-petróleo, carmim, dourado, violeta. **Nada de
  papel ou giz** na campanha (o Manual do Ralsei tem o estilo dele). Na partida o cenário vai com
  `partida: true` (sem o que ficaria atrás do HUD) e um véu escuro.
- **Caixa de diálogo clássica** (`CaixaDeDialogo.js`): preta, borda branca fina, retrato à esquerda,
  texto datilografado devagar (42 ms por letra) com um blip baixo e macio. Os ecos (`ecos: true` no
  texto do mundo): retrato sem cor, brilho frio, nome azul-acinzentado. Na tela os ecos são
  `campanha/eco.js` (sem cor, meio transparentes, com uma imagem dupla que se desencontra devagar).
- **Mapa** (`campanha/mapa.js` + cena `Campanha`): uma escada que desce, uma porta por patamar;
  bloqueada apagada, aberta com uma fresta de luz, a escolhida com um feixe por cima; as estrelas são
  três luzinhas. A abre a porta: o lugar aparece com o eco e a conversa começa ali.
- **Música** original (`scripts/musica/campanha.mjs`): `campanha.mid` no mapa, nos diálogos e no fim
  da fase (piano esparso em Ré menor, cada frase com um eco uma oitava acima e mais baixo, cordas e
  pad); `campanha2.mid` nas fases e no chefe (o mesmo tema com cordas em trêmolo e um tímpano como um
  coração). Mude lá e rode `node scripts/musica/campanha.mjs`.
- **Acessibilidade**: "reduzir animações" (ou gráficos no mínimo) para a poeira, os feixes que
  respiram e as imagens duplas dos ecos, e mostra o texto inteiro; sem clarões, a virada do chefe não
  pisca; o tremor segue o ajuste. Texto mínimo de 9–10 px só em dicas; falas a 18 px.
- **A fonte** junta "fi"/"fl" numa ligadura que parece um "A": todo texto corrido da campanha passa
  por `semLigaduras` (`campanha/texto.js`).

**Estrelas** (calculadas no servidor): ★ vencer · ★ terminar com pelo menos 60% do HP · ★ vencer em
até N rodadas (a coluna acima). O coração anda sempre a 180 px/s na campanha (o ajuste de velocidade
do painel não vale: o servidor confere a velocidade).

## Recompensas (só o servidor concede)

| Regra | Valor |
| --- | --- |
| primeira vitória numa fase | **40 XP** (no chefe **80 XP**) |
| cada estrela nova (acima da melhor da conta na fase) | **10 XP** |
| vencer de novo sem estrela nova | **10 XP** |
| teto da campanha por dia (fuso de São Paulo, tudo somado) | **300 XP** (o resto não vira XP; progresso e estrelas contam igual) |
| derrota, abandono, corrida suspeita | 0 |

Cosméticos exclusivos do Mundo 1 (nível 1000 no catálogo: a trilha de níveis nunca entrega):
vencer o chefe pela primeira vez dá o título **Quem Deixou a Luz Acesa** e a moldura **Vitral
Silencioso**; 3 estrelas em todas as fases dão o verso **Porta Entreaberta**. Os ids são os da 0011
(`titulo.andarilho_papel`, `moldura.floresta_papel`, `verso.folha_dobrada`: o inventário guarda o id);
os nomes de agora vêm da **0012** (`0012_campanha_mundo1.sql`, idempotente). O catálogo do banco não
tem descrição: o texto de cada item fica em `mundo1.js` (`descricao`) e aparece na Coleção. A tela de recompensa mostra o que o
servidor concedeu; a Coleção lista os três (aba do tipo, "CAMPANHA, MUNDO 1").

## Anti-trapaça: o servidor vê a luta

No PVP em rede o host decide e o servidor só compara relatos (`docs/rede-pvp.md`, `server/partidas.js`);
como o plano da Fase 6 lembra, "acordo entre clientes não comprova" nada. Na campanha não há outro
cliente: quem **roda a luta é o servidor** (`server/campanha.js` + `campanha/luta.js`):

1. **Mão, energia, HP, chefe e aliada no servidor.** O baralho, a compra, a energia, a carta do chefe,
   a jogada da aliada, a resolução da rodada (Ases, escudo, roubo, SUPER) e os golpes usam
   `coop/regras.js` no servidor. A carta que o navegador manda é conferida com a mão e a energia
   **do servidor** e com a regra da fase; carta fora da mão, sem energia ou fora da regra é recusada
   (`campanhaErro {motivo: 'carta'}`) e a rodada continua.
2. **A esquiva vem pronta do servidor.** `esquiva = { chefe, carta, cartas?, danos, hp, jogadores,
   caixa, ritmo, velocidadeMax, inverter, semente, duracao }`: o navegador roda o MESMO quadro
   (`campanha/quadro.js`) a partir disso.
3. **Posições do coração, uma por passo.** O quadro anda em passo fixo (16 ms) e o navegador manda a
   sua posição de **cada passo** (lista plana `[t, x, y, ...]`, x/y em décimos de px, em pedaços de
   250 ms). O servidor confere **toda** esquiva (`validarAmostras`): formato; tempo crescente;
   primeira amostra perto do ponto de partida; intervalo máximo de 260 ms e mínimo de 10 ms; taxa
   média; dentro do quadro (com a metade do coração); velocidade até 180 px/s + 3% (+0,8 px); salto
   muito acima disso = **teleporte**; a última amostra perto do fim (`curta`; quem cai no meio
   continua mandando a posição, parada); e o **relógio do servidor**: nenhuma amostra pode ser de um
   instante que ele ainda não viu (`futuro`, folga de 400 ms) e a esquiva não pode terminar antes da
   duração (`rapida_demais`).
4. **O quadro refeito no servidor, exatamente.** Com as posições de cada passo, o servidor roda o
   mesmo quadro (`simularQuadro`: o ataque de verdade, numa cena sem tela) com a aliada desviando
   pelo mesmo sorteio, e conta os acertos e os grazes dos dois. Como as posições são as de cada passo,
   o resultado é **o mesmo** do navegador (`luta.test.js` confere carta por carta). O dano é
   `max(acertos do servidor, acertos relatados)`: o relato só pode piorar para quem relata. Relato
   acima do possível (um acerto a cada 850 ms de invencibilidade) é suspeito.
5. **Suspeita = sem recompensa.** Qualquer falha acima encerra a corrida como `suspeita`, com o
   motivo no log do servidor (`[campanha] corrida … suspeita (teleporte)`) e no banco
   (`campanha_corridas.motivo`). Nada cai: erro interno também vira `suspeita` ('erro').
6. **Concessão uma vez.** `conceder_campanha(corrida, …)` (só `service_role`) grava a corrida (o id é
   a âncora da idempotência), confere de novo o desbloqueio (fase anterior vencida; senão vira
   `suspeita`/'bloqueada') e aplica o teto do dia.

**Por que dá para refazer igual**: a biblioteca `attacks/` e `entities/Bullets.js` não usam o Phaser (o
pouco que usavam está em `phaserPuro.js`, uma cópia fiel conferida contra o Phaser em
`__tests__/phaserPuro.test.js`, inclusive o gerador aleatório: o PvP e o CO-OP não mudam), nenhum
ataque cria bala em animação, e o quadro do navegador é a `BattleBox` com os mesmos limites
arredondados de `limitesDoQuadro`. Todo ataque dos chefes da campanha roda no servidor (`luta.test.js`).

### Limites (o que isto não resolve)

- **Bot no navegador.** A semente e o ataque são conhecidos pelo navegador (ele precisa desenhar):
  um cliente adulterado pode calcular um caminho perfeito e mandá-lo em tempo real. As posições são
  plausíveis e o servidor aceita. Isso dá estrelas e XP de campanha, que têm teto diário; não dá
  vantagem sobre outra pessoa. Para o ranqueado (Fase 6) isto continua sendo a hipótese a medir.
- **Outro navegador, outra matemática.** `Math.sin`/`Math.cos` podem diferir no último bit entre
  motores (Chrome x Firefox): aí a aliada (e um tiro mirado nela) pode sair um pouco diferente do
  servidor. O dano da aliada é sempre o do servidor; o seu é o maior dos dois.
- **Queda de conexão**: a corrida é **abandonada** na hora (sem recompensa, registrada como
  `abandono`). Retomar uma esquiva no meio exigiria confiar no relógio do navegador; é
  single-player, então a opção simples e segura é recomeçar a fase.

## Protocolo (versão 16)

`campanha {acao}` do navegador; respostas `campanha*` do servidor (ver o topo de `server/campanha.js`):
`progresso` → `campanhaProgresso {fases, escolhas, xpHoje, teto}` · `comecar {mundo, fase}` →
`campanhaInicio {corrida, rodada}` · `carta {corrida, carta|null}` → `campanhaEsquiva {rodada, jogadas,
intencao, destino, efeitos, chefeEfeito, esquiva, arremessadas, eu, aliado, chefe}` · `posicoes {corrida, rodada, seq, a}` ·
`fimEsquiva {corrida, rodada, acertos}` → `campanhaRodada {resumo, proxima}` e, no fim,
`campanhaFim {resultado, motivo, estrelas, xpGanho, xpTotal, nivelAntes, nivelDepois, itensNovos,
melhorEstrelas, primeira}` · `escolha {mundo, chave, valor}` · `desistir {corrida}`. Sem a carta em
3 minutos, ou sem o fim da esquiva até 20 s depois da duração: `abandono`.

Pausa e aba escondida: o Esc abre o menu de pausa **por cima** (a luta continua: os prazos acima são do
servidor), com o coração parado; SAIR DA PARTIDA manda o `desistir`. Com a aba escondida a esquiva
continua em passo fixo pelo relógio de fundo e não cai no anti-trapaça
([rede-pvp.md](rede-pvp.md#aba-em-segundo-plano-e-pausa-online)).

## Banco (0011, 0012)

`campanha_progresso` (conta, mundo, fase: melhor estrela, vencida, vitórias, melhor nº de rodadas),
`campanha_escolhas` (jsonb por mundo), `campanha_corridas` (cada corrida que terminou: resultado,
motivo, estrelas, XP concedido, itens). RLS: cada conta lê só as suas linhas; ninguém do navegador
escreve nem chama as funções. `progresso_campanha(conta)` (o servidor manda ao mapa),
`campanha_escolher(...)`, `conceder_campanha(...)`. `catalogo_itens` ganha `campanha` ('mundo1') e
`campanha_quando` ('mundo' | 'estrelas'). A 0012 só renomeia os três cosméticos do Mundo 1 (mesmos
ids). Teste no Postgres (0001–0012, duas vezes): `DODGE_PG=... node --test server/__tests__/campanhaSql.test.js`.

## Testar

- `npm test` (núcleo, servidor, SQL com `DODGE_PG`).
- No navegador: `DODGE_CONTAS_FALSAS=1 npm run dev`, depois no console
  `window.debugConta.fingir({ id: '<uuid>', nome: 'ANA' })` e menu → CAMPANHA. As trapaças de teste
  (só no dev): `window.debugCampanha.trapaca = 'teleporte'` (um salto nas posições: o servidor
  recusa, "PARTIDA NÃO CONFIRMADA", sem XP) ou `'semAcertos'` (relata 0 acertos: o servidor conta os
  dele).

## Como acrescentar um mundo

1. Os chefes em `src/game/campanha/chefes.js` (formato do CO-OP, `campanha: true`; os testes do CO-OP
   conferem todos). Prefira os ataques da biblioteca `attacks/` (rodam no servidor); um ataque novo
   não pode criar bala dentro de animação (tween/onComplete): o servidor não anima.
2. `src/game/campanha/mundos/mundo2.js` com `{ id: 2, nome, personagem, fases: [...], recompensas }`
   (formato no topo de `mundo1.js`: `inimigo`, `nivel`, `aliado`, `regra`; a última fase é o chefe).
   As regras que existem: `soNaipe`, `caixaEncolhe`, `eco`, `energiaInicial`, `soDeCima`, `titan`; uma
   nova entra em `campanha/luta.js` (com teste).
3. `mundo2.textos.js` com `antes`, `depois`, `derrota` e `luta` de cada fase, o `cenario` (um tema de
   `campanha/cenario.js`, ou um novo lá, com teste) e o `tema` (a regra dita no tom do mundo); e
   `titulo`, `resumo`, `virada`, `viradaFalas`, `furia`, `furiaFala`, `ecos`, `cenarioMapa`. Siga o guia
   de tom e estilo acima.
4. Registre os dois em `mundos/index.js`.
5. Migration nova (não edite a 0011): `campanha_fases(2)` e os cosméticos no catálogo com
   `campanha = 'mundo2'`. O `mundos.test.js` confere o número de fases e os itens.
6. O mapa (`scenes/Campanha.js`) recebe `{ mundo: 2 }`; o desbloqueio do mundo 2 depende do chefe do
   mundo 1 (ainda a fazer, com a seleção de mundos).
