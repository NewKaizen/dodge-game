# Campanha (modo história, single-player)

Menu → **CAMPANHA**. Uma história com diálogos, **um personagem por mundo**, jogada contra a CPU.
Só **online e com conta**: o servidor precisa ver a partida para que o XP e os cosméticos valham.
Convidado (ou sem servidor de contas) vê o mapa com o aviso "Entre com sua conta para jogar a
campanha!".

| Peça | Onde |
| --- | --- |
| Regras dos mundos (fases, oponentes, regra especial, metas) | `src/game/campanha/mundos/mundoN.js` |
| Textos (diálogos, escolhas, cenário e tema de cada fase) | `src/game/campanha/mundos/mundoN.textos.js` |
| Cenário sombrio (puro, com semente) e o desenho em Phaser | `src/game/campanha/cenario.js`, `desenharCenario.js` |
| Mapa da escada (puro) · ecos na tela · texto sem ligadura | `src/game/campanha/mapa.js` · `eco.js` · `texto.js` |
| Música | `scripts/musica/campanha.mjs` → `public/assets/musicas/campanha.mid`, `campanha2.mid` |
| Ataques puros (com semente) e o registro `atacavelNoServidor` | `src/game/campanha/ataques.js` |
| Esquiva em passo fixo (navegador e servidor) | `src/game/campanha/simulacao.js` |
| Posições do coração: formato e plausibilidade | `src/game/campanha/amostras.js` |
| A partida (sobre `pvp/regras.js`), estrelas | `src/game/campanha/partida.js` |
| Motor dos diálogos | `src/game/campanha/dialogo.js` (a caixa: `CaixaDeDialogo.js`) |
| XP (espelho do banco) | `src/game/campanha/recompensas.js` |
| Servidor (roda a partida) | `server/campanha.js` (ligado em `server/lan.js`) |
| Banco | `supabase/migrations/0011_campanha.sql` (e `0012_campanha_mundo1.sql`: os nomes do Mundo 1) |
| Navegador | `src/lib/campanha.js`, cenas `Campanha` (mapa), `CampanhaArena`, `CampanhaFim` |

## Mundo 1: "A Casa Silenciosa" (Kris)

Na noite do Festival das Luzes, a cidade apaga de uma vez e as vozes somem. Uma sombra, **o
Silêncio** (feita de tudo o que ninguém teve coragem de dizer), prende os amigos de Kris dentro das
próprias lembranças: a sala de aula, o corredor, o ginásio, a rua, a sala de estar. As portas da casa
levam até eles. Cada luta é contra um amigo **possuído** (o eco, apagado) e o Silêncio fala por ele;
vencer **liberta** o amigo, que volta com cor, entra na turma e **sobe a escada junto** (aparece atrás
da Kris no diálogo e na partida, torce durante a luta e grita na virada do chefe). No último quarto,
o do irmão que foi embora sem se despedir, o Silêncio está grudado em Asriel. O clímax: Kris, que não
fala o mundo inteiro, diz **uma** frase ("Volta pra casa."), as luzes da cidade voltam e o telefone
toca. A história é original; os personagens são os do jogo.

| Fase | Lugar (cenário) | Preso | Regra especial | Golpe do oponente (`assinatura`) | ★ rodadas |
| --- | --- | --- | --- | --- | --- |
| 1 A Sala de Aula | `sala` | Ralsei | só cartas ♠ | Mariposas | 9 |
| 2 O Corredor que Fecha | `corredor` | Noelle | a caixa perde 10% por rodada | Estilhaços (gelo) / Olhares | 7 |
| 3 O Ginásio Vazio | `ginasio` | Berdly | o ataque que você mandou volta (`eco`) | Feixes de luz (holofotes) | 8 |
| 4 A Rua de Volta | `rua` | Susie | começa com 0 de energia | Feixes (faróis) / Paredes | 8 |
| 5 A Sala Onde Chove | `chuva` | Dess | todo ataque vem de cima | Cinzas / Olhares | 9 |
| 6 O Último Quarto (chefe) | `quarto` | Asriel | `duplo`; `virada` na metade do HP (cura 20%, caixa deita, a turma grita); **`furia`** com 30% do HP depois da virada (ataques mais fortes e longos), uma vez | Mariposas / Feixes / Estilhaços (depois da virada: Estilhaços / Feixes) | 12 |

**Golpe do oponente** (`fase.assinatura`, `campanha/ataques.js` `comAssinatura`): o ataque que a CPU
manda na **sua** caixa troca o modelo do naipe pelo golpe de quem está do outro lado, um por rodada em
rodízio; o SUPER e o segundo modelo do `duplo` continuam; na fase do `eco`, o eco tem a vez. Cada
fase fica com cara própria.

Os ataques são seis modelos simuláveis: **Cinzas que caem** (`chuva`), **Paredes com uma fresta**
(`galhos`), **Olhares** (`sementes`), **Mariposas** (`redemoinho`) e os novos **Feixes de luz**
(`feixes`: retângulos que cruzam a caixa, o primeiro na linha do coração, piscando 760 ms antes de
acender por 420 ms; dois da mesma leva a pelo menos 74 px) e **Estilhaços** (`estilhacos`: um cristal
que brilha 650 ms longe do coração e estoura em leque). Com `soDeCima`, feixes viram paredes e
estilhaços viram cinzas.

**Falas durante a luta** (`luta` nos textos, só sabor, no navegador): `inicio`, `ferido` (oponente com
metade do HP), `quase` (1/4), `voceMal` (você com 35%), `perfeito` (desviou de tudo). Balões nos cantos
de baixo: o oponente e o Silêncio à direita, os amigos libertados à esquerda (só fala quem já está
livre). Na tela ainda: "PERFEITO!" ao zerar os acertos, o dano no oponente subindo, a turma pulando, a
barra do chefe violeta depois da virada e vermelha na fúria.

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
até N rodadas (a coluna acima). A CPU da campanha é a do PvP (`pvp/bot.js` e `pvp/botEsquiva.js`),
com o HP da fase (`fatorHpCpu`) e levando 1,35× o dano por acerto (fases de 5 a 9 rodadas). O
coração anda sempre a 180 px/s na campanha (o ajuste de velocidade do painel não vale: o servidor
confere a velocidade).

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

## Anti-trapaça: o servidor vê a partida

No PVP em rede o host decide e o servidor só compara relatos (`docs/rede-pvp.md`, `server/partidas.js`);
como o plano da Fase 6 lembra, "acordo entre clientes não comprova" nada. Na campanha não há outro
cliente: quem **roda a partida é o servidor** (`server/campanha.js` + `campanha/partida.js`):

1. **Mão, energia, HP e CPU no servidor.** O baralho, a compra, a energia, a jogada da CPU, a
   resolução da rodada (Ases, escudo, roubo) e o dano usam `pvp/regras.js` no servidor. A carta que o
   navegador manda é conferida com a mão e a energia **do servidor** e com a regra da fase; carta
   fora da mão, sem energia ou fora da regra é recusada (`campanhaErro {motivo: 'carta'}`) e a rodada
   continua.
2. **Semente dos ataques no servidor.** Cada caixa recebe `{ modelos, forca, duracao, semente, caixa,
   dano }`; o navegador monta o mesmo roteiro (`campanha/ataques.js`) para desenhar.
3. **Posições do coração.** Durante a esquiva o navegador manda as posições (~20 Hz: uma amostra a
   cada 50 ms do relógio da simulação, em pedaços de 250 ms; lista plana `[t, x, y, ...]`, x/y em
   décimos de px). O servidor confere **toda** esquiva (`validarAmostras`): formato; tempo crescente;
   primeira amostra no ponto de partida; intervalo máximo de 260 ms e mínimo de 10 ms; taxa média
   entre ~4 e 100 Hz; dentro da caixa (com a metade do coração); velocidade até 180 px/s + 3% (+0,8 px);
   salto muito acima disso = **teleporte**; a última amostra perto do fim do ataque (`curta`); e o
   **relógio do servidor**: nenhuma amostra pode ser de um instante que ele ainda não viu
   (`futuro`, folga de 400 ms) e a esquiva não pode terminar antes da duração (`rapida_demais`).
4. **Acertos refeitos no servidor.** Com as amostras (posição interpolada; o alvo das balas miradas
   é a última amostra, que o navegador também usa), o servidor roda a mesma simulação
   (`simularComAmostras`) e conta os acertos com uma hitbox 1,2 px mais generosa (só acerto claro).
   O dano é `max(acertos do servidor, acertos relatados)`: o relato do navegador **só pode piorar
   para ele**, então mandar "não levei nada" não salva ninguém. Relato acima do possível (um acerto a
   cada 850 ms de invencibilidade) é suspeito. A esquiva da **CPU** é decidida inteira no servidor
   (`simularCpu`, com sorteio de semente) e vai para o navegador só para desenhar.
5. **Suspeita = sem recompensa.** Qualquer falha acima encerra a corrida como `suspeita`, com o
   motivo no log do servidor (`[campanha] corrida … suspeita (teleporte)`) e no banco
   (`campanha_corridas.motivo`). Nada cai: erro interno também vira `suspeita` ('erro').
6. **Concessão uma vez.** `conceder_campanha(corrida, …)` (só `service_role`) grava a corrida (o id é
   a âncora da idempotência), confere de novo o desbloqueio (fase anterior vencida; senão vira
   `suspeita`/'bloqueada') e aplica o teto do dia.

### O que é verificado e o que não é

| Ataque | Verificado no servidor? |
| --- | --- |
| `chuva` (folhas que caem acelerando, 1 em 3 na coluna do coração) | **sim**: acertos refeitos |
| `galhos` (paredes com um vão, de lado ou de cima) | **sim** |
| `sementes` (miradas, paradas com a linha por 700 ms) | **sim** |
| `redemoinho` (papéis pelas bordas, girando) | **sim** |
| `feixes` (retângulos parados que avisam e acendem) | **sim** |
| `estilhacos` (cristal que avisa e estoura em leque) | **sim** |
| ataques do PvP (`attacks/*`, com Phaser) | não simuláveis no servidor hoje: a campanha **não usa nenhum**. O caminho existe em `concluirEsquiva` (`verificado: false`): vale o relato do navegador, conferido (formato, plausibilidade das posições, teto de acertos) |

Todas as cartas de todos os baralhos viram um desses quatro modelos na campanha (♠ galhos, ♦
sementes, ♣ redemoinho, ♥ chuva fraca, SUPER galhos + sementes); o chefe junta dois. O teste
`campanha/__tests__/simulacao.test.js` confere que as balas andam igual às do jogo (`manual/onda.js`,
que já é conferido contra as classes `Balas`/`Heart` reais) e a **paridade**: o servidor, só com as
amostras, refaz os acertos do navegador (em 60 de 64 esquivas de teste exatamente iguais, nunca mais
que o navegador; exato quando o coração anda em linha reta).

### Limites (o que isto não resolve)

- **Bot no navegador.** A semente e o roteiro são conhecidos pelo navegador (ele precisa desenhar):
  um cliente adulterado pode calcular um caminho perfeito e mandá-lo em tempo real. As posições são
  plausíveis e o servidor aceita. Isso dá estrelas e XP de campanha, que têm teto diário; não dá
  vantagem sobre outra pessoa. Para o ranqueado (Fase 6) isto continua sendo a hipótese a medir.
- **Coração invulnerável não existe mais aqui**: o dano é do servidor. Mas um cliente pode
  "desviar" melhor que um humano (acima).
- **Diferença de amostragem.** A 20 Hz o servidor não vê cada curva: por isso a hitbox mais
  generosa e o "vale o maior". Num caso raro o servidor conta um acerto a menos que a tela (nunca a
  mais, na medição).
- **Queda de conexão**: a corrida é **abandonada** na hora (sem recompensa, registrada como
  `abandono`). Retomar uma esquiva no meio exigiria confiar no relógio do navegador; é
  single-player e curta, então a opção simples e segura é recomeçar a fase.

## Protocolo (versão 16)

`campanha {acao}` do navegador; respostas `campanha*` do servidor (ver o topo de `server/campanha.js`):
`progresso` → `campanhaProgresso {fases, escolhas, xpHoje, teto}` · `comecar {mundo, fase}` →
`campanhaInicio {corrida, rodada}` · `carta {corrida, carta|null}` → `campanhaEsquiva {jogadas,
efeitos, ataque, ataqueCpu, cpuAmostras, eu, cpu}` · `posicoes {corrida, rodada, seq, a}` ·
`fimEsquiva {corrida, rodada, acertos}` → `campanhaRodada {resumo, proxima}` e, no fim,
`campanhaFim {resultado, motivo, estrelas, xpGanho, xpTotal, nivelAntes, nivelDepois, itensNovos,
melhorEstrelas, primeira}` · `escolha {mundo, chave, valor}` · `desistir {corrida}`. Sem a carta em
3 minutos, ou sem o fim da esquiva até 20 s depois da duração: `abandono`.

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

1. `src/game/campanha/mundos/mundo2.js` com `{ id: 2, nome, personagem, fases: [...], recompensas }`
   (formato no topo de `mundo1.js`; a última fase é o chefe). Use as regras que já existem
   (`soNaipe`, `caixaEncolhe`, `eco`, `energiaInicial`, `soDeCima`, `duplo`, `virada`, `furia`) e dê a cada fase uma `assinatura` ou crie uma em
   `campanha/partida.js` (com teste).
2. `mundo2.textos.js` com `antes`, `depois`, `derrota` e `luta` de cada fase, o `cenario` (um tema de
   `campanha/cenario.js`, ou um novo lá, com teste) e o `tema` (a regra dita no tom do mundo); e
   `titulo`, `resumo`, `virada`, `viradaFalas`, `furia`, `furiaFala`, `ecos`, `cenarioMapa`. Siga o guia de tom e estilo acima.
3. Registre os dois em `mundos/index.js`.
4. Prefira ataques simuláveis (`ataques.js`); um modelo novo entra no registro com teste de
   paridade e de justiça (`simulacao.test.js`).
5. Migration nova (não edite a 0011): `campanha_fases(2)` e os cosméticos no catálogo com
   `campanha = 'mundo2'`. O `mundos.test.js` confere o número de fases e os itens.
6. O mapa (`scenes/Campanha.js`) recebe `{ mundo: 2 }`; o desbloqueio do mundo 2 depende do chefe do
   mundo 1 (ainda a fazer, com a seleção de mundos).
