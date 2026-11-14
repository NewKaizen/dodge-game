# Modo PvP de cartas: regras

Lógica pura (sem Phaser), testável em Node:

| Arquivo | O que faz |
|---|---|
| `src/game/pvp/baralho.js` | RNG com semente, embaralhar, comprar, completar a mão, descartar, reembaralhar |
| `src/game/pvp/cartas.js` | baralhos dos 7 personagens, custos, Ases, efeitos de copas, carta → ataque (com `ataques` injetado) |
| `src/game/pvp/regras.js` | partida, energia, validação, `resolverRodada`, dano/cura, vencedor |
| `src/game/pvp/ataquesDasCartas.js` | ponte para o jogo: `ataqueDaCartaNoJogo(carta)` já com `attacks/index.js` |

Testes: `npm test` (ou `node --test src/game/pvp/__tests__/*.test.js`).

## Rodada

1. `iniciarRodada(estado)`: energia (3 na 1ª rodada, +2 nas seguintes, teto 10) e cada mão completa até 5 cartas.
2. Os dois escolhem ao mesmo tempo (`podeJogar` / `cartasJogaveis`). Passar a vez (`null`) sempre pode e dá +1 de energia.
3. `resolverRodada(estado, jogadaP1, jogadaP2)` valida tudo antes de mudar o estado e resolve nesta ordem:
   1. paga a energia e descarta as cartas jogadas;
   2. ♦ Anular cancela a carta do outro (dois Anular: as duas se cancelam), menos o SUPER;
   3. ♥ suporte em quem jogou (cura, escudo, energia, compra) e Ás de copas;
   4. ataques: cada carta vai para a caixa do adversário; ♠ Espelho devolve o ataque do outro para a caixa dele (o SUPER não volta);
   5. o escudo de quem recebe reduz o dano por bala daquele ataque (e é gasto);
   6. ♣ Roubo pega uma carta sorteada da mão do outro.
4. A cena roda `caixas[j]` (o que o jogador j desvia): `{ carta, de, refletida, dano, ritmo, inverterMs, escudo }`. O ataque em si vem de `ataqueDaCartaNoJogo(caixa.carta)` (`null` = caixa calma).
5. Durante a esquiva: `aplicarDano(estado, j, caixa.dano)` a cada acerto (também zera o combo de perfeitos), `registrarGrazes(estado, j, n)` (+1 de energia a cada 5 grazes) e, no fim, `registrarPerfeitoCombo(estado, j, caixa.carta)` se j passou pelo ataque sem levar dano (ver [Combo de perfeitos](#combo-de-perfeitos)).
6. `fimDaRodada(estado)` → `'p1' | 'p2' | 'empate' | null`. HP corrido: perde quem zerar; os dois juntos = empate.

O estado é JSON puro (`structuredClone`/`JSON.stringify` funcionam) e a partida é determinística pela semente (`criarPartida({ p1, p2, semente })`).

## Energia

| Regra | Valor |
|---|---|
| Energia na 1ª rodada | 3 |
| Ganho por rodada | +2 |
| Teto (o que sobra acumula) | 10 |
| Grazes | +1 a cada 5 |
| Passar a vez | +1 |
| Desvio perfeito | +1 a +3 (pela carta do ataque, ver abaixo) × combo de perfeitos (x1 a x4) |

## Dificuldade das cartas

`DIFICULDADE_PVP` em `cartas.js` vale para todas as cartas, em cima do valor de cada uma:

| Ajuste | Valor | O que faz |
|---|---|---|
| `forcaMinima` | 0,3 | piso da força: o 2 já ataca como uma carta mais alta (o K continua com força 1, a validada) |
| `dano` | ×1,3 | dano por bala de todo ataque |
| `velocidade` | ×1,15 | balas mais rápidas (o mesmo aperto do co-op) |
| `densidade` | ×1,2 | disparos mais frequentes (o mesmo aperto do co-op) |

Tudo neutro (`0, 1, 1, 1`) = as cartas como eram antes. As tabelas de dano abaixo são os valores **antes** do ×1,3.

## Contra a CPU (1 jogador)

Com 1 jogador no painel, o P2 é a CPU:

- `src/game/pvp/bot.js` escolhe a carta: dá uma nota a cada carta jogável (ataque = dano × força; copas valem mais com o HP baixo; Ases conforme a energia e a mão do adversário) e passa a vez quando segurar energia libera uma carta bem mais forte.
- `src/game/pvp/botEsquiva.js` desvia: a cada decisão simula as balas um pouco à frente em 17 direções e foge da mais perigosa.
- Nível na tela de escolha com ↑/↓ (fica salvo):

| Nível | Reação | Enxerga à frente | Erra a direção | Distrai |
|---|---|---|---|---|
| fácil | 200 ms | 240 ms | 25% | 10% das decisões, 650 ms |
| normal | 130 ms | 330 ms | 10% | 5%, 500 ms |
| difícil | 70 ms | 520 ms | 2% | quase nunca |

Controles invertidos também confundem a CPU (chance extra de errar).

## Custos

| Valor | 2 a 4 | 5 a 8 | 9, 10, J | Q | K | Ás | ★ SUPER |
|---|---|---|---|---|---|---|---|
| Custo | 1 | 2 | 3 | 4 | 5 | 3 | 10 |

## Carta SUPER (★)

Todo baralho tem **uma** carta SUPER (`valor: 14`, `naipe: 'espadas'`, id `'<personagem>-espadas-14'`), que sai na compra normal. Custa **10** de energia (o teto), então só dá para jogar juntando energia (passar a vez, grazes, desvio perfeito).

- Ataque exclusivo de cada personagem: 3 fases de ~3 s com força 1 (~9 s ativos, mais os respiros), montadas com os padrões que já existem e dentro das faixas já validadas. Dano 13 por bala (já com o ×1,3, o mesmo de um K♠), ritmo padrão, não inverte controles.
- **Imparável**: o ♦ Anular não cancela e o ♠ Espelho não reflete o SUPER. Com Espelho do outro lado, o Espelho manda o eco dele e o SUPER vai normal para a caixa do adversário.
- A carta do adversário continua valendo: os dois atacam.
- Na cena: animação especial (`pvp/super/anuncio.js`) e a música do personagem (`public/assets/musicas/super_<personagem>.mid`, se existir); depois a música de batalha volta de onde parou.
- API em `cartas.js`: `SUPER = { valor: 14, custo: 10 }`, `ehSuper(carta)`, `superDoPersonagem(personagem)` → `{ nome, descricao, cor }`, `nomeDoValor(14) === '★'`. Em `resolverRodada`, cada jogada traz `super: true|false`.
- CPU (`bot.js`): o SUPER tem a nota mais alta de todas; com ele na mão e faltando até 2 rodadas de energia, a CPU passa a vez para juntar energia (a não ser que esteja com menos de 30% de HP).

| Personagem | SUPER | Fases |
|---|---|---|
| Kris | Alma Determinada | tabuleiro (espadas onde a peça ataca, depois também onde o coração vai estar) + rastro de lâminas → eco do caminho + sentenças em X por onde o coração vai estar → cortes finais em X |
| Susie | Machado Colossal | pisões → machado gigante com faíscas → dinamite (bombas + chão rachado) |
| Ralsei | Último Capítulo | sopros de fogo em leque → moldura de espinhos que fecha → sombra do dragão |
| Noelle | SNOWGRAVE | neve + flocos gigantes que estouram → nevasca (rajadas de estilhaços) → redemoinho que persegue + pilares de gelo → túmulo de estilhaços que se fecha e explode |
| Berdly | Prova Irrefutável | redemoinho de lâminas num 8 com páginas miradas (réplicas) → giro dourado → corte final em X |
| Dess | Último Bis | braço de guitarra: levada → refrão → solo (as notas caem no traste para onde o coração vai) → mergulho com 3 ondas de choque |
| Asriel | Singularidade Radiante | vazio que puxa + estrelas em espiral → supernova com 6 anéis e estrelas cadentes miradas entre eles |

## Desvio perfeito

Passar por um ataque inteiro sem levar dano dá aplausos e energia, pela carta daquele ataque (`energiaPerfeito(carta)` / `registrarPerfeito(estado, j, carta)` em `regras.js`, que respeita o teto de 10 e devolve a energia ganha de fato):

| Carta do ataque | Energia |
|---|---|
| 2 a 8 | +1 |
| 9, 10, J, Q | +2 |
| K e SUPER | +3 |
| Ás que manda ataque (Espelho/eco, Anular, Roubo) | +1 |
| copas, Ás de copas, caixa vazia | 0 |

### Combo de perfeitos

Cada jogador tem uma **sequência** (`jog.sequencia`): quantas rodadas **seguidas** ele fez desvio perfeito. A energia do perfeito é multiplicada pelo combo (`registrarPerfeitoCombo(estado, j, carta)` → `{ ganho, base, multiplicador, sequencia }`; `registrarPerfeito` devolve só o `ganho`):

| Perfeito seguido | Multiplicador | Exemplo (9-Q, base +2) |
|---|---|---|
| 1º | x1 | +2 |
| 2º | x2 | +4 |
| 3º | x3 | +6 |
| 4º em diante | x4 (teto, `COMBO_PERFEITO.teto`) | +8 |

- O ganho sempre respeita o teto de energia (10). Com a energia cheia o perfeito **ainda conta** para o combo (ganho 0, "ENERGIA CHEIA!").
- Depois do teto a sequência continua contando (recorde em `jog.maiorSequencia`), mas o multiplicador fica em x4.
- **Quebra:** qualquer acerto (`aplicarDano` chama `quebrarSequencia`), mesmo se o escudo ou a segunda chance zerarem o dano. Vale para a esquiva, os eventos do bonus round e o duelo.
- **Rodada sem caixa para desviar** (o adversário passou, jogou copas ou um Ás de copas, ou o ataque foi anulado): **não conta e não quebra**, a sequência fica como estava. O mesmo para a caixa "só caos" do bonus round e para o duelo sem levar dano.
- Uma chamada por rodada por jogador (cada coração passa por uma caixa só).

Na arena: "PERFEITO!" (x1), "PERFEITO x2!", "PERFEITO x3!!", "PERFEITO x4!!!": o texto cresce e ganha brilho a cada nível (o teto pisca em arco-íris), "+6 ENERGIA (2 x3)". Os aplausos (`aplausos`) se sobrepõem uma vez por nível com atrasos pequenos (plateia maior); x2 ganha os canhões de confete, x3 uma tremida leve, clarão dourado e `estouroFesta`, x4 a chuva de confete e a `fanfarra`. Mais fogos a cada nível (3, 5, 7, 9). O HUD de cada jogador mostra discretamente o combo atual embaixo das gemas ("PERFEITO x3", "PERFEITO x4 MÁX") e, quando um acerto quebra, um "COMBO QUEBROU" pequeno. `pvpArena.estadoDebug()` traz `combos` (multiplicador da rodada) e `jogadores[j].sequencia`.

## Naipes

| Naipe | Tipo | Ataque na caixa do adversário | Dano por bala |
|---|---|---|---|
| ♠ espadas | ataque direto | padrões do personagem escalados pelo valor | 2 + 0,6 × valor (3 a 10) |
| ♦ ouros | controle | balas até 20% mais rápidas, caixa menor (210×170 → 160×135), Q/K invertem os controles durante o ataque todo (menos o Q♦ Tempo Parado e o K♦ Caos Final do Asriel) | 2 + 0,45 × valor (3 a 8) |
| ♣ paus | armadilha | bombas, lasers, colunas, ondas, forcado, chão rachado | 2 + 0,55 × valor (3 a 9) |
| ♥ copas | suporte em quem joga | só um ataque fraquinho (4 s, dano 2) | 2 |

Valor = força: `t = (valor - 2) / 11` vai de 0 (2) a 1 (K). Com `t` maior o ataque fica mais rápido, mais denso, mais longo (4 a 7 s ativos, mais os respiros) e dá mais dano.

Efeitos de copas (cada carta junta um ou mais):

| Efeito | Quanto vale |
|---|---|
| cura | 4 + 1,5 × valor (2 → 7 HP, 10 → 19, K → 24) |
| escudo | o próximo ataque recebido causa 60% do dano (2-6), 50% (7-10), 35% (J-K); não acumula, fica o melhor |
| energia | +1 (2-6), +2 (7-10), +3 (J-K) |
| compra extra | 1 carta (2-8), 2 cartas (9-K); a mão vai até 7 |

## Ataques que obrigam a se mexer

Ficar parado não é mais uma estratégia: quase todo padrão tem uma parte mirada no coração (`mirar` nos ataques, sobe com a força da carta).

- `foice` (Giro do Machado, Machadada, Chaos Saber...): machado bumerangue que mira a faixa do coração, volta pelo outro lado, alterna varridas horizontais e verticais e solta faíscas.
- `forcado`: o forcado de 3 dentes estoca de cima (e de baixo, alternando) na coluna do coração e crava; o vão entre os dentes é seguro e, na cravada, a palha espirra pelos lados. A cada 3 estocadas vem a pinça (um de cima e um de baixo, vãos desencontrados).
- `rachaduras` (Chão Rachado, Dinamite, Emboscada): o chão racha passando pelo coração e solta espinhos; nas cartas fortes, estilhaços.
- `carrossel`: os anéis respiram forte, invertem o giro (piscam antes), o centro persegue o coração e atiram balas miradas.
- `caosFinal` (Caos Final, K♦ do Asriel): estrelas miradas → cruz do caos giratória → anel que colapsa no coração e explode.
- Outros: `rain`, `colunas`, `ondas`, `quicantes`, `bombas` e `anel` miram parte das balas; a `spiral` vem atrás do coração.

## Morte súbita (aceleração)

A cada 5 rodadas (rodadas 5, 10, 15, 20, 25) tudo fica 30% mais rápido, até ×2,5 na rodada 25 (`ACELERACAO` em `constants.js`): balas (velocidade e densidade), relógio da escolha (15 s → até 8 s), animações e música. O coração ganha metade do bônus para continuar dando para desviar. Aparece um aviso "VELOCIDADE ×1,3!" e o selo fica no HUD. No co-op a regra fica desligada (`ACELERACAO.coop = false`; com `true` ela vale por turno do chefe, por cima do `RITMO`).

## Fim da partida: câmera lenta, replay e tela de vitória

Código em `src/game/pvp/fimDePartida/` (o `index.js` explica as peças).

- **Câmera lenta**: no K.O. o jogo congela um instante e passa a andar a 20% por ~2,3 s: as balas se arrastam, a bala do golpe segue atravessando o coração e ele trinca em duas metades e estilhaça devagar (como no Undertale). A tela escurece em volta, as balas perdem a cor e a música fica lenta e abafada. Se o outro também cair nesse meio tempo, é empate (vale de verdade).
- **Replay como transmissão esportiva** (`transmissao.js`): depois, a tela vira TV ao vivo. Uma tarja diagonal na cor da arena com o selo **INSTANT REPLAY** varre a tela (o "● AO VIVO" do canto vira "REPLAY") e por baixo aparece o replay, com o selo do canal (nome da arena) e o placar (rótulo, nome e HP de cada um). Os ~1,5 s antes do golpe passam em velocidade normal (CÂM 1), depois câmera lenta com a câmera fechando no coração de quem vai cair (barras de cinema, "LANCE DECISIVO"), corte para a CÂM 2: close em alta resolução, super câmera lenta (quadros misturados, sem engasgo), o círculo do comentarista sendo desenhado em volta do coração e flashes de fotógrafos. No quadro do golpe: clarão, tranco no zoom, "K.O.!" batendo e o **coração despedaçando** por cima da foto (a mesma quebra da câmera lenta, esticada), e a câmera abre devagar para ver os cacos caindo; confete. Som: torcida crescendo até o golpe (falatório, palmas cada vez mais densas, o "uuuuOOO" subindo de tom, gritos e assobios), a música abafada e mais baixa; no golpe a música corta para o "OHHH!" coletivo e um acorde orquestral; quando o coração estilhaça a torcida explode (berros, palmas, "uhuu", assobios), a música volta com tudo e o juiz apita o fim. Tudo sintetizado em `audio.js` (`SONS_TRANSMISSAO`), sem o chiado/estática da versão em fita. Empate: as duas pistas lado a lado, cada uma com seu close ("K.O. DUPLO!"). O replay usa fotos das caixas tiradas durante a esquiva ou o duelo (`gravador.js`, DynamicTextures em baixa resolução a 30 quadros/s, mais um close em resolução maior em volta do coração nos últimos quadros; o coração fica fora da foto e é desenhado de verdade por cima; nada é re-simulado).
- **Duelo** (rodada bônus): o K.O. dele também ganha câmera lenta e replay. O gravador fotografa a caixa grande do duelo com os dois corações de fora da foto (os dois ganham close, porque ninguém sabe quem vai cair); a TV destaca quem caiu e desenha o outro coração junto. K.O. duplo: as duas telas lado a lado, como no empate das pistas.
- **A ou B duas vezes pula** a câmera lenta e o replay (a torcida some junto). O primeiro aperto só mostra, no canto de baixo, "A / B DE NOVO para pular" com uma barra que esvazia (1,6 s); o segundo, antes de ela acabar, pula. O painel só avisa quando o botão é apertado (não quando solta), por isso não é "segurar". Antes disso há uma carência curta (no duelo, mais longa, porque todo mundo está apertando A para atacar).
- **Tela de vitória** (`PvpResultado`): antes das estatísticas, a entrada do vencedor: faixa diagonal na cor dele, o sprite grande entrando com rastro, o nome enorme batendo com clarão, tremor, confete, fogos e a música da vitória. No empate não tem entrada. A pula, como antes.

## Arenas (votação antes da partida)

Depois da escolha dos lutadores (e do "VS"), os jogadores **votam na arena** (cena `PvpVoto`, dados em `pvp/arenas.js`). Cada um move o próprio coração entre os cartões e vota com A (B desfaz). Ganha a mais votada; **empate = roleta** entre as empatadas; o cartão **"?" (ALEATÓRIA)** vale como voto numa arena sorteada na hora da apuração; acabou o tempo (12 s), quem não votou fica de fora (ninguém votou = roleta entre todas). Contra a CPU só o P1 vota: a CPU segue o voto. A revanche (tela de resultado) e o "recomeçar" do pause mantêm a arena.

Cada arena tem fundo animado próprio (`backgrounds/arenas/`), música própria (`public/assets/musicas/<arena.musica>.mid`; sem o arquivo, toca o `pvp.mid`) e a **sua lista de rodadas bônus** (no mínimo 10; Duelo e Cartas Malucas estão em todas). Um evento pode ter nome próprio numa arena (o Apagão vira TOCHAS no Templo e QUEDA DE ENERGIA na Informática).

| Arena | Música | Bônus |
|---|---|---|
| Castelo | Rude Buster (`pvp.mid`) | os clássicos: explosões, apagão, gravidade, ponta-cabeça, coração trocado, aquário, gelo, terremoto |
| Jardim | Seven Suns (`arena_jardim.mid`) | cogumelo, lago (aquário), chuva de verão, ventania, enxame, vaga-lumes, espirro de pólen, trepadeira |
| Sala de Informática | `arena_informatica.mid` | PC da escola, queda de energia (apagão), pop-ups, lag, teclado embaralhado, Ctrl+C Ctrl+V, tela azul, cursor gigante |
| Palco | `arena_palco.mid` | festa, dança da estátua, pirotecnia (explosões), plateia arremessa, gelo seco, no ritmo, karaokê, mosh |
| Templo | `arena_templo.mid` | terremoto, gravidade, ponta-cabeça, tochas (apagão), pedra rolante, armadilhas, areia movediça, relógio do tempo |
| Coliseu | `arena_coliseu.mid` | coração trocado, arena encolhendo, leões, chuva de lanças, corrida de bigas, chão em brasas, polegar do imperador, rede do reciário |
| Praia | Maré Mansa (`arena_praia.mid`) | **castelo de areia**, **surf**, **sol do meio-dia**, **caça ao tesouro**, **pipa**, **pegadas**, **concha**, **gaivota ladra** (os 8 mudam uma REGRA da esquiva; só existem na Praia) |
| Café Francês | Valsa do Croissant (`arena_cafe.mid`) | **latte art**, **bandeja**, **mímico**, **acordeão**, **pintor**, **menu do dia**, **expresso**, **xadrez** (8 eventos que mudam uma REGRA da esquiva, ver abaixo) |
| Estação Espacial | Órbita Baixa (`arena_estacao.mid`, ambiente em Lá menor) | **sem atrito**, **buraco de minhoca**, **radar**, **órbita**, **polaridade**, **oxigênio**, **raio trator**, **manutenção** (8 bônus próprios, cada um muda uma regra; ver abaixo) |
| Chinatown | Rua das Mil Lanternas (`arena_chinatown.mid`, Ré maior pentatônico) | **biscoito da sorte** (regra maluca sorteada: diagonal, bala dourada dá escudo, parado sem dano, setas espelhadas/giradas, velocidade dobrada, paredes-portais), **hashi** (pauzinhos miram e beliscam), **sombras chinesas** (balas viram sombras maiores e atrasadas), **ábaco** (só anda em hastes; troca nos portões), **mahjong** (par de peças iguais limpa a fileira e dá escudo), **dança do leão** (repita as setas: escudo), **gato da sorte** (pata erguida congela as balas), **cestinha de vapor** (cestos-abrigo cuja tampa estoura) |
| Cidade Grande | Hora do Rush (`arena_cidade.mid`, funk/jazz-hop em Dó) | **trânsito**, **obra**, blecaute (apagão), metrô (terremoto), temporal (chuva), vento entre prédios (ventania), outdoors (pop-ups), hora do rush (mosh), fumaça de escapamento (gelo seco) |

**Praia** (fundo `backgrounds/arenas/praia.js`: enseada ao pôr do sol com ondas rolando, coqueiros, guarda-sóis, caranguejo, gaivotas e veleiros; música bossa-reggae em Dó maior, `scripts/musica/arenasPraiaCafe.mjs`) e **Café Francês** (fundo `cafe.js`: terraço de Paris com marquises, luzinhas, torre de ferro genérica, gato, pombos e acordeonista; valsa musette em Lá menor). Eventos novos (da Praia: ver a tabela logo abaixo; do Café: planos puros e testados em `pvp/bonus/eventos/planosPraiaCafe.js`, desenho em `croissants.js`, `bule.js`, `pombos.js`; todos sorteiam só com o rng da semente da rodada, sempre com aviso >= 400 ms e saída garantida):

| Evento | Arena | O que faz |
|---|---|---|
| Castelo de areia | Praia | o coração deixa uma trilha de blocos de areia (a cada 12 px; no máximo 12, o mais velho cai primeiro). Molhados por 0,45 s, depois duros: BLOQUEIAM balas (cada bala some e o bloco aguenta 2 batidas) por ~5,5 s. O coração atravessa a areia |
| Surf | Praia | a caixa vira mar e uma faixa de crista (58 px) sobe e desce (soma de senóides, no máximo ~0,5x a velocidade do coração; tracejado mostra 0,6 s à frente). Fora dela a barra de queda enche: alerta aos 0,45 s e CAIDÃO (5% do HP) aos 1,7 s; depois 1,3 s de folga. Dentro, a barra desce em dobro |
| Sol do meio-dia | Praia | 2 guarda-sóis passeiam em órbitas lentas (<= 40 px/s); só a sombra (raio 42) protege. Fora dela o calor sobe de 0 a 1 em 2,6 s (alerta na metade) e QUEIMA (4% do HP), voltando a 45%; na sombra desce em 1 s |
| Caça ao tesouro | Praia | um tesouro escondido por caixa (nunca visível); o detector de metais apita de 950 ms (longe) até 130 ms (perto) com ondas saindo do coração e um termômetro frio/quente. Ficar a menos de 15 px por 0,6 s CAVA: cura 6% do HP (cheio: +1 energia). Até 3 por caixa, a 70 px do coração |
| Pipa | Praia | o coração pendurado numa pipa (corda de 94 px) balança como pêndulo: a mola puxa para a pipa, o direcional soma FORÇA (inércia, vai e volta em ~3 s) e a pipa passeia devagar (<= 22 px/s). Qualquer ponto da corda dá para segurar com <= 80% do direcional |
| Pegadas | Praia | as pegadas ficam na areia (2,3 s) e, 2 s depois, um fantasma refaz EXATAMENTE o caminho (posição = a do coração 2 s atrás). Nasce translúcido e inofensivo por 0,7 s; depois machuca (dano 4) |
| Concha | Praia | uma concha gigante abre (0,55 s) e dentro dela o coração fica INVULNERÁVEL (balas passam, sem dano nem graze). Nos últimos 1,1 s ela pisca e fecha; no estalo quem ainda está dentro leva 5% do HP. Fica 1,3 s fechada e reabre >= 80 px dali |
| Gaivota ladra | Praia | a gaivota roda (1,7 a 2,5 s), trava a mira e mostra o anel/sombra no chão por 0,8 s; mergulha e pega quem ainda está no anel (raio 19): rouba 1 de energia (sem energia, arranhão de 3% do HP). Cura e roubo vão ao outro PC pela mensagem `praiaAjuste` |


**Café Francês** (fundo `backgrounds/arenas/cafe.js`; música `arena_cafe.mid`). Os 8 bônus da arena (Duelo e Cartas malucas + estes) **mudam uma regra de como se joga a esquiva**, em vez de só passar balas. Regras puras em `pvp/bonus/eventos/cafe/planos.js` (testes em `__tests__/eventosCafe.test.js`), um arquivo por evento em `pvp/bonus/eventos/cafe/`. Todos os planos saem do rng da rodada (igual nos dois PCs; cada caixa usa um rng filho quando o que ela sorteia depende do tempo dela), têm instrução curta na tela (até 6 palavras), dica no Guia e prévia ao vivo.

| Evento | Regra que muda | Justiça / saída |
|---|---|---|
| Latte art | o coração deixa uma linha de leite (2,8 s). **Fechar um laço** (área ≥ 420 px², caminho ≥ 80 px) apaga as balas lá dentro. Tinta limitada: o tanque dá ~520 px de linha, recarrega 9%/s andando e 42%/s parado, e cada bala apagada devolve 7% | a linha nunca machuca; sem tinta só para de desenhar |
| Bandeja | carrega uma xícara: giro brusco (> 3,6 rad/s), arrancada e freada fazem o **medidor de balanço** subir; cheio, **derrama** (dano 3% do HP máx., mín. 2, e 1,5 s de respiro). As balas andam 8% mais devagar | curva aberta e andar reto nunca derramam; o balanço baixa sozinho; a CPU suaviza o joystick |
| Mímico | **paredes invisíveis** (um dos 5 moldes, espelhado ao acaso). Aparecem fracas por 2,2 s no começo e por 0,9 s quando alguém **encosta** (luva do mímico). O coração desliza pela parede e **as balas quicam nela** | o labirinto nunca parte a caixa (corredores ≥ 26 px) |
| Acordeão | a caixa é o fole: a cada compasso (1,875 s, valsa a 96 bpm) o fole recebe um alvo, **avisa** (faixa vermelha com setas + nota, 0,56 s) e anda (0,56 s), **empurrando** o coração (limite interno, como a Arena encolhendo) | sempre sobra ≥ 96 px livres; o fole anda mais devagar que o coração |
| Pintor | o pintor pinta faixas e manchas (contorno tracejado por 0,8 s; no máx. 34% da caixa e 2 pinceladas). **Tinta molhada (4,3 s) congela a bala** que entra nela: vira obstáculo parado e some quando a tinta seca | a tinta em si não machuca nem prende o coração |
| Menu do dia | as balas viram pratos (croissant, baguete, queijo, sopa, macaron); o quadro mostra o **prato do dia**: encostar nele **cura** (3% do HP máx., mín. 2, 0,9 s de respiro; em rede a cura vai para o outro PC, mensagem `cura`); os outros machucam (4). Troca a cada ~6,8 s com aviso de 0,8 s e 0,5 s em que nada machuca | ~36% dos pratos são o do dia |
| Expresso | xícaras aparecem; **cada café** dá +17% de velocidade por 5,4 s e **soma** (até 4). Com 4 ao mesmo tempo: **tremedeira** de 3,4 s (o direcional balança e o coração chacoalha; "reduzir animações" tira só o chacoalho do desenho) | nunca machuca; a CPU para em 3 |
| Xadrez | o coração é um **cavalo**: não anda, **pula em L** (6 x 4 casas, 8 destinos marcados na hora, o direcional escolhe o mais alinhado, recarga 0,42 s mostrada num anel). No ar (0,15 s) não leva dano | de qualquer casa há ≥ 2 pulos e o tabuleiro todo é alcançável; a CPU pula quando a casa dela vai ficar perigosa |

Os eventos em **negrito** são novos (planos puros em `pvp/bonus/eventos/planosArenas.js`, testes em `__tests__/bonusArenasNovas.test.js`): sorteados pela semente da rodada (igual nos dois PCs), o mesmo plano nas duas caixas, sempre avisados (≥ 400 ms) e com corredor de fuga ≥ 48 px. METEOROS: pedras cruzam as caixas pelo risco vermelho tracejado. AIRLOCK: a comporta de um lado avisa (sirene, parede piscando) e puxa o coração (sem dano). DRAGÃO: serpenteia pelo risco dourado ondulado. LANTERNAS: anel dourado avisa, depois a lanterna acesa sobe balançando. TRÂNSITO: o semáforo amarelo avisa a faixa (faróis acesos), verde = carro, ônibus e moto disparam. OBRA: coluna listrada de amarelo e preto avisa a viga que despenca do guindaste.

**Layout da votação** (`pvp/layoutVoto.js`): até 8 cartões numa fileira; mais que isso vira grade de 2 (até 16) ou 3 fileiras, qualquer número de arenas. ← → andam em fila, ↑ ↓ trocam de fileira, o mouse aponta (passar) e vota (clicar). Músicas geradas por `scripts/musica/arenasNovas.mjs`.

Testes: `scene.start('PvpVoto', { p1, p2 })` ou direto `scene.start('PvpArena', { p1, p2, arena: 'templo' })`.

## Bonus rounds (a cada 3 rodadas)

Nas rodadas 3, 6, 9... (`BONUS` em `pvp/bonus.js`) uma roleta sorteia um evento caótico **depois** que os dois escolhem as cartas (no Duelo, a carta escolhida vira a arma, sem gastar energia; no Ctrl+C Ctrl+V ela só vai para o descarte, também sem gastar energia), que nunca repete o da rodada bônus anterior. A roleta só tem os eventos da arena da partida (veja Arenas). Quase só caos, sem prêmio: ninguém ganha nada a mais e o dano continua valendo. A exceção é o Ctrl+C Ctrl+V, que passa energia de um para o outro. Nos eventos de esquiva, as duas caixas abrem mesmo que ninguém tenha atacado.

| Evento | Cartas | O que acontece |
|---|---|---|
| Chuva de explosões | normais | bombas com mira caem nas duas caixas e explodem em área |
| Modo festa | normais | bola de discoteca, holofotes, confete e balões que estouram |
| Mundo de ponta-cabeça | normais | a tela gira 180° (os controles não, aí que mora o caos) |
| Apagão | normais | escuridão: só se enxerga em volta do coração (com relâmpagos de vez em quando) |
| Gravidade maluca | normais | uma gravidade puxa o coração e muda de lado a cada ~2 s, com aviso |
| Coração trocado | normais | os corações trocam de caixa: cada um desvia do próprio ataque |
| PC da escola | normais | as caixas ficam pixeladas (baixa resolução) e rodam a 6–14 FPS, aos trancos; de vez em quando o PC trava ("Não está respondendo") |
| Aquário | normais | as caixas enchem de água: tudo em câmera lenta leve (×0,82), o coração boia (segure ↓ para afundar) e tem inércia de água |
| Cogumelo maluco | normais | o coração alterna entre GIGANTE (hitbox enorme, música grave) e MINI (hitbox mínima, música aguda), com pisca-pisca de aviso |
| Dança da estátua | normais | a música PARA de repente, sem aviso: balas e ataque congelam, o coração não. Um holofote de vigia PERSEGUE o coração de cada um (é mais lento: dá para fugir); quem se mexer com a luz em cima do coração é PEGO (30% do HP máximo, uma vez por parada). Mexer fora da luz pode. A música volta e tudo descongela |
| Pista de gelo | normais | o coração escorrega: demora para acelerar, demora para frear e desliza quando você solta |
| Terremoto | normais | a terra treme (ronco de aviso antes): a tela sacode, o coração é empurrado e pedras caem do teto das caixas |
| Pop-ups | normais | janelas de propaganda ("VOCÊ GANHOU!", "BAIXE MAIS RAM") abrem por cima das balas (por baixo do coração) e tapam a visão; passar o coração no [X] fecha. Nunca nascem em cima do coração, no máximo 2–3 por caixa, somem sozinhas em 7 s |
| Lag | normais | o direcional chega atrasado 250–400 ms (o ping aparece em cima da caixa); um fantasma do coração mostra para onde ele vai. A CPU também sofre |
| Teclado embaralhado | normais | as setas trocam de lugar (giros e espelhos: seta sempre vira seta) e o mapa muda a cada ~4 s, com 1,1 s de aviso; o tecladinho entre as caixas mostra sempre o mapa atual. A CPU demora um pouco para aprender cada mapa |
| Ctrl+C Ctrl+V | sem custo (descarte) | (Informática) minigame no lugar de arremesso + esquiva: abre uma janela "Copiando energia..." com a barra de progresso disputada em cabo de guerra. 3-2-1-COPIAR! e por 5 s cada aperto de A (Z/espaço do P1, Enter do P2, botão A do joystick) puxa a barra para o seu lado. Quem estiver na frente no fim COPIA (rouba) energia do outro: até 35% da barra = 1, até 70% = 2, mais = 3; 14 apertos de vantagem enchem a barra (100%) e acabam na hora. Empate: ninguém copia. Quem perde não fica negativo e quem copia não passa de 10 (o que não cabe se perde). A CPU aperta como gente (~4/s no fácil, ~5,5/s no normal, ~7/s no difícil) |
| Tela azul | normais | de vez em quando uma caixa chuvisca e dá TELA AZUL: a pista inteira congela (ninguém leva dano), reinicia, mostra tudo parado por um instante e volta com i-frames curtos |
| Cursor gigante | normais | um cursor de mouse enorme persegue o coração (mais devagar que ele), para, mira (anel vermelho fechando, ampulheta) e clica: dano em área. Às vezes clique duplo |
| Pedra rolante (Templo) | normais | ronco, tremor e a faixa por onde a pedra vai passar fica vermelha com setas no sentido dela (~1 s de aviso); aí uma pedra gigante atravessa a caixa rolando (bala, 5 de dano). Às vezes vem uma segunda em outra faixa: sempre sobra um terço da caixa livre |
| Armadilhas (Templo) | normais | placas de pressão no chão (com setas ↔/↕): pisou, clique, a linha dela pisca e ~0,55 s depois dardos saem das duas paredes por ela. De tempos em tempos um padrão de lajes (colunas, faixas, xadrez, borda ou miolo) estala com as pontas brilhando nas frestas (~1 s) e os espinhos sobem por 0,6 s; sempre sobram lajes livres |
| Areia movediça (Templo) | normais | poças de areia surgem (aviso, sem efeito ainda), prendem por uns segundos e secam. Dentro: o coração fica lento (42% no meio, 80% na borda) e é puxado para o centro; sair sempre dá. Não machuca |
| Relógio do tempo (Templo) | normais | um relógio entre as caixas alterna o tempo do ATAQUE entre câmera lenta (×0,5) e acelerado (×1,5), com 1 s de aviso (tique-taque dispara, nome do próximo modo pisca). O coração anda sempre no ritmo normal; a música acompanha um pouco |
| Cartas malucas | viram outras | na revelação cada carta vira uma carta sorteada de qualquer personagem (mesmo custo); o SUPER não vira (é imparável). Depois da rodada o baralho volta ao normal |
| Duelo | viram armas | a carta escolhida vira a arma, sem gastar energia. Uma caixa só para os dois: ♥ tiro, ♠ espada, ♦ bumerangue, ♣ explosão (3 bombas em leque com estilhaços). Mira automática: é só se mexer e apertar A; o valor da carta aumenta o dano. Passar dá uma arma sorteada, fraca |
| Chuva de verão | normais | (Jardim) chove forte: a chuva empurra o coração para baixo (muito nas PANCADAS, avisadas com setas azuis) e poças aparecem no chão da caixa (contorno piscando antes); dentro da poça o coração escorrega como no gelo |
| Ventania | normais | (Jardim) rajadas de vento empurram o coração; antes de cada uma as folhas começam a voar para o lado do vento e uma seta pisca na borda. A direção muda a cada rajada |
| Enxame | normais | (Jardim) um enxame de abelhas passeia pela caixa; quem fica PARADO é notado ("?", depois "!") e perseguido (mais devagar que o coração). Andar um bom pedaço despista; a picada é dano pequeno (3) com i-frames |
| Vaga-lumes | normais | (Jardim) anoitece: as caixas ficam no escuro e só os vaga-lumes iluminam, com bolhas de luz que ANDAM (rondam o coração, soltos); o coração tem só um brilho fraquinho e as balas avisando piscam no escuro |
| Espirro de pólen | normais | (Jardim) o pólen junta em volta do coração: "a..." "a... a..." (uma seta mostra a direção) e ATCHIM: o coração dá um tranco rápido naquela direção |
| Trepadeira | normais | (Jardim) vinhas com espinhos crescem de uma ou duas bordas (a faixa pisca antes) e encolhem a caixa; depois recuam e voltam em outro lado. Encostar na vinha = dano de bala (4) |
| Arena encolhendo (Coliseu) | normais | paliçadas com pontas de ferro entram pelas bordas das caixas (laterais, teto e chão, um canto ou as quatro), seguram e abrem de novo. Aviso: a faixa que vai fechar pisca em vermelho com setas. Não machucam, só empurram o coração; sempre sobra um miolo livre de pelo menos 84×66 px. As balas passam por cima |
| Leões! (Coliseu) | normais | rugido e a faixa por onde o leão vai passar piscando; ele atravessa a caixa correndo (dano 5). Às vezes SALTA: a faixa tem um buraco com um arco tracejado, e quem estiver embaixo do salto não leva nada. Mais para o fim vêm dois de uma vez, em sentidos opostos |
| Chuva de lanças (Coliseu) | normais | ondas de lanças: a sombra no chão cresce onde cada uma vai cair; ela crava (dano 4 na ponta) e fica em pé uns 2,6 s como obstáculo (encostar na haste: dano 3). Sempre espaçadas, no máximo 9 por caixa |
| Corrida de bigas (Coliseu) | normais | a caixa vira pista com 3 faixas de sentidos alternados; bigas atravessam uma ou duas faixas por vez (dano 5), avisadas por poeira na entrada e pela faixa piscando. Sempre sobra pelo menos uma faixa livre |
| Chão em brasas (Coliseu) | normais | o contrário da estátua: ficar PARADO esquenta a barra de CALOR (embaixo da caixa); a partir da metade ela pisca, sai fumaça e chia. Cheia: queima (3,5% do HP máximo, mínimo 2) e volta para 30%. Andando, esfria |
| Polegar do imperador (Coliseu) | normais | o imperador sorteia uma regra numa roleta entre as caixas e mostra o polegar (pra cima = regra boa, pra baixo = ruim): controles invertidos, coração rápido, lento, mini, gigante ou caixa escura. Vale para os dois por ~3 s e ele sorteia outra |
| Rede do reciário (Coliseu) | normais | um gladiador entre as caixas joga a rede, uma caixa por vez: círculo tracejado no chão avisa onde ela cai. Pegou: o coração fica PRESO (bem lento) até sacudir as setas 5 vezes (ou 1,8 s). Não dá dano |
| Plateia arremessa | normais | (Palco) a plateia joga tomates, flores, ursinhos e baldes de pipoca no palco: uma sombra no chão da caixa avisa onde cai (~1 s antes), o objeto cai em cima dela e sai quicando pela caixa até sumir |
| Gelo seco | normais | (Palco) uma fumaça densa sobe do chão e cobre a metade de baixo das caixas, ondulando (com jatos de CO2 de vez em quando); lá dentro as balas viram silhuetas escuras. Só visual, sem dano novo |
| No ritmo | normais | (Palco) o coração só anda na batida (~140 BPM, metade de cada batida); entre as batidas fica parado. Para compensar ele anda mais rápido na janela e as caixas ficam 15% mais lentas. Anel que encolhe até o coração, borda pulsando, compasso e bumbo marcam a batida |
| Karaokê | normais | (Palco) versos da música atravessam as caixas da direita para a esquerda; cada palavra é uma bala (com o "!" de aviso) e acende em rosa ao passar pelo meio da caixa, cantando uma nota. Dá para passar entre as palavras e entre as faixas dos versos |
| Mosh | normais | (Palco) ondas de gente atravessam a caixa numa faixa (metade de cima, de baixo ou o meio) e empurram o coração; antes, a borda de entrada pisca na altura da faixa com setas. Não machuca: o perigo é ser jogado nas balas (dá para resistir ou sair da faixa) |

## Ases (cartas especiais, um por naipe em todo baralho, custo 3)

| Ás | Efeito |
|---|---|
| ♠ Espelho | o ataque que o adversário jogou volta para a caixa DELE. Sem nada para refletir, manda um eco (ataque de espadas força 7). Dois espelhos = dois ecos. |
| ♦ Anular | cancela a carta do adversário inteira (ataque, suporte e especial) e manda um ataque leve de ouros (força 5). |
| ♣ Roubo | rouba 1 carta sorteada da mão do adversário (passa a ser sua) e manda um ataque leve de paus (força 5). |
| ♥ Segunda chance | cura 25% do HP máximo e, nesta rodada, o HP não passa de 1. Não manda ataque. |

## Baralhos

HP de `data/personagens.js` quando o personagem existe lá (Kris 90, Susie 110); senão, o HP de reserva do baralho. Por cima, `PVP.ajusteHp` em `regras.js` ajusta o HP só no PvP (hoje só o Asriel, ×0,9). Toda contagem abaixo é sem o SUPER; cada baralho tem +1 carta ★.

| Personagem | Papel | HP | Cartas | ♠ | ♥ | ♦ | ♣ | Mais fortes (J/Q/K) |
|---|---|---|---|---|---|---|---|---|
| Kris | equilibrado, puxado para controle | 90 | 19 + ★ | 5 | 4 | 6 | 4 | K♠ Lâmina Determinada, J♦ Formação, Q♦ Controle da Alma · ★ Alma Determinada |
| Susie | força bruta | 110 | 19 + ★ | 8 | 3 | 4 | 4 | Q♠ Rude Buster, K♠ Machado Maluco, J♦ Pressão, J♣ Dinamite · ★ Machado Colossal |
| Ralsei | suporte | 80 | 19 + ★ | 3 | 8 | 4 | 4 | J♦ Feitiço de Sono, Q♥ Pacify, K♥ Oração Maior · ★ Valsa Real |
| Noelle | suporte gélido | 85 | 19 + ★ | 4 | 7 | 4 | 4 | Q♠ Nevasca, K♦ Inverno Eterno, J♣ Avalanche, J♥ Anjo da Neve · ★ SNOWGRAVE |
| Berdly | controle | 90 | 19 + ★ | 4 | 4 | 7 | 4 | Q♦ QI Elevado, K♦ Vendaval Supremo, J♣ Ciclone · ★ Furacão Genial |
| Dess | ataque | 100 | 19 + ★ | 7 | 3 | 4 | 5 | J♠ Solo de Guitarra, K♠ Show de Rock, Q♦ Feedback, Q♣ Palco Explosivo · ★ Turnê Final |
| Asriel | equilibrado, com mais figuras | 90 | 20 + ★ | 5 | 5 | 5 | 5 | J♠ Chaos Buster, K♠ Hyper Goner, Q♦ Tempo Parado, K♦ Caos Final, K♣ Supernova, Q♥ Sonho (6 figuras) · ★ Supernova Arco-Íris |

### Balanceamento do Asriel (2026-10-02)

O Asriel ganhava quase toda partida: 12 figuras (J/Q/K em todos os naipes) e 100 de HP. Agora:

- **6 figuras** (ainda mais que qualquer outro), mantendo 5 cartas por naipe:

| Naipe | Antes | Agora |
|---|---|---|
| ♠ | A, 6, J, Q, K | A, 4, 8, J, K |
| ♦ | A, 5, J, Q, K | A, 3, 7, Q, K |
| ♣ | A, 4, J, Q, K | A, 4, 8, 10, K |
| ♥ | A, 7, J, Q, K | A, 5, 8, 10, Q |

- O ♥ Sonho (Q) perdeu o efeito de energia (agora só cura + escudo).
- HP no PvP ×0,9 (`PVP.ajusteHp.asriel` em `regras.js`): 100 → 90. O co-op não muda (`data/personagens.js` fica igual).

Cara própria por personagem (padrões e tema das balas):

| Personagem | Linguagem dos ataques | Balas |
|---|---|---|
| Kris | estocadas, colunas em forma de espada, mira, lasers alternados, forcado | espadas/losango azuis |
| Susie | machado (foice), pisões (colunas), investidas, bombas | hex/bola roxas |
| Ralsei | anéis, carrossel, estrelas de ioiô na fitinha (A♣, Empréstimo Educado), espiral | copas/bola verdes |
| Noelle | neve lenta em cascata, raios de gelo, pingentes | losango/hex azul-gelo |
| Berdly | mira, estocadas, ondas de vento, lasers em cruz | losango/bola ciano |
| Dess | bolas quicando, ondas sonoras, lasers, bombas | ouros/bola laranja |
| Asriel | chuva de estrelas, lâmina do caos, espiral, carrossel, supernova | losango/copas/bola em várias cores |

A lista completa (nome, valor, custo, descrição) sai de `CARTAS` em `cartas.js`.

## Justiça dos ataques

Todas as cartas dos 7 personagens (134) foram rodadas numa caixa de esquiva (ver `docs/ataques.md`, Testar): 0 avisos `[telegrafo]`; 1 aviso `[rota de fuga]` conhecido (Cabos Enrolados, Dess 10♣, lasers — já existia antes da revisão de 2026-10-02). As figuras (J/Q/K) também passaram com o aperto do co-op por cima (velocidade ×1,15, densidade ×1,2). Os SUPERs usam os mesmos padrões com força 1 (as faixas já validadas), só encadeados em 3 fases.

Na medição de 2026-10-07 (abaixo; 79 cartas de ataque e 7 SUPERs, 12 a 24 sementes cada) o validador não deu nenhum aviso. Três avisos antigos sumiram: Zero Absoluto (SUPER da Noelle, sem espaço livre na estrela final), Shocker Breaker (Asriel 3♦, a corrente de 3 raios fechava a caixa apertada) e Caos Final (Asriel K♦, raro, na cruz).

## Balanceamento medido com o bot (2026-10-07)

`scripts/balanceamento/medir.mjs` roda cada carta numa Pista do tamanho da do PvP (220×170), com o ritmo e o dano de verdade da carta (controles invertidos inclusos), e o `EsquivaBot` desviando. Precisa do jogo em `npm run dev` e do Playwright; `resumo.mjs` monta as tabelas.

- **Bot "perfeito"** = nível `dificil`; **bot "médio"** = nível `normal` (reage em 130 ms, erra 10%, se distrai 5%).
- O bot da CPU só enxerga balas. Na medição ele também vê o que um jogador vê: os avisos de área (`a.aviso`), o movimento das balas que andam sozinhas e o disco que uma lâmina varre ao girar em volta de uma ponta. A CPU do jogo não mudou.
- Dano esperado = acertos × dano por bala (o coração fica 850 ms invencível depois de cada acerto). SUPER: 13 por bala.

SUPERs (dano médio por SUPER, 24 sementes; antes → depois):

| SUPER | Bot perfeito | Bot médio | O que mudou |
|---|---|---|---|
| Kris · Alma Determinada | 3 → 3 | 21 → 34 | 6 peças no tabuleiro (eram 4), aviso das casas 750 → 580 ms; rastro mais denso e duradouro; eco nasce 1,4 s atrás (era 1,8) e chega mais perto; 3 cortes finais (eram 2) |
| Susie · Machado Colossal | 5 → 18 | 30 → 37 | 4 machadadas (eram 3), aviso 700 → 620 ms, 4 pedras mais rápidas; 5 Rude Busters (o novo tem o vão do outro lado), meias-luas 280 → 310 px/s |
| Ralsei · Último Capítulo | 16 → 21 | 32 → 40 | 7 chamas por rajada nos sopros (eram 6) |
| Noelle · Zero Absoluto | 29 → 9 | 41 → 39 | sobram 2 placas inteiras na nevasca (era 1: o coração ficava ilhado entre buracos); o buraco machuca só no miolo da placa (beirada de 14 px); a brecha da estrela final mira a placa inteira mais perto e nenhuma lança a atravessa; nevasca com 5 pingentes (eram 4), racha em 560 ms |
| Berdly · Prova Irrefutável | 21 → 18 | 42 → 39 | redemoinho 3,7 → 3,5 rad/s com o 8 mais lento; o giro final pisca o círculo inteiro que vai varrer e a lâmina final é menor (×1,05 em vez de ×1,18); rajadas de páginas um pouco maiores |
| Dess · Último Bis | 22 → 11 | 46 → 39 | ver abaixo |
| Asriel · Singularidade Radiante | 25 → 15 | 49 → 35 | o puxão para antes da borda do vazio (sozinho nunca encosta o coração nele); estrelas da espiral mais espaçadas (560 → 620 ms) e giro máximo 5,5 → 4,2 rad/s |
| **Faixa** | **3 a 29** → **3 a 21** | **21 a 49** → **34 a 40** | |

**2026-10-08: o SUPER da Noelle virou SNOWGRAVE** (o Zero Absoluto saiu). Três
atos: o selo de gelo girando solta flocos em espiral (o núcleo do selo
machuca), a nevasca com paredes de estilhaços com uma brecha que serpenteia,
e o SNOWGRAVE: colunas de gelo em duas levas (ímpares e pares, cada coluna
com mais que a lacuna mínima) e o golpe final, em que só um buraco quadrado
no aviso fica seguro. Medido com 24 sementes: perfeito 2,7, médio **34,1**
(dentro da faixa 34–40 dos outros SUPERs), nenhum aviso do validador.
Cinemática nova em `pvp/super/anuncios/noelle.js` e efeito novo no chefe do
CO-OP (`coop/superNoChefe.js`).

**2026-10-17: SNOWGRAVE recriado** ("muito fácil e previsível"). Agora são
quatro atos que escalam, com o mundo congelando (véu cada vez mais escuro,
geada subindo pelas bordas, neve de fundo seguindo o vento): **I. O frio**
(neve entrando pelo lado do vento, parte mirada, engrossando; flocos gigantes
que atravessam a caixa, param, racham e estouram em estilhaços), **II.
Nevasca** (rajadas de estilhaços espalhadas, com a brecha longe do coração; o
vento inverte uma vez), **III. Redemoinho** (anéis de flocos entram por todas
as bordas e espiralam para um olho de gelo que persegue o coração devagar;
pilares de gelo brotam do chão, teto ou paredes na linha do coração, só a
ponta aparece antes) e **IV. SNOWGRAVE** (o nome cai letra a letra e um túmulo
de estilhaços entra por todas as bordas e se fecha onde o coração estava,
com uma lasca a menos de brecha; ao fechar, o pilar de luz explode e os
estilhaços voltam para todo lado). Nenhum projétil nasce dentro da caixa e
tudo é sorteado com a semente (vento, lados, brechas, olho e giro, pilares,
túmulo). Sprites (pilar, floco gigante, estilhaço, carta nova) e 5 sons novos
em `scripts/super/noelle.py`. Medido com 24 sementes: perfeito 2,7 → **9,8**,
médio 34,1 → **39,5** (os outros 6 SUPERs, na mesma medição: perfeito 3,3 a
21,1, média 14,5; médio 33,6 a 39,5, média 37,1), nenhum aviso do validador.

SUPER da Dess mais justo:

- os avisos dos acordes se sobrepõem (o próximo pisca antes do anterior bater); agora a conta de "sobra um traste livre" soma todos os trastes acesos ao mesmo tempo (antes cada acorde deixava um livre, mas a soma podia acender o braço inteiro);
- a pancada da guitarra no centro, que não tinha aviso, agora pisca enquanto a guitarra cai;
- Solo um pouco mais lento (nota a cada 0,62 tempo, era 0,5) com aviso de 600 ms (era 520) e bend a cada 5 notas;
- a 2ª onda de choque abre o vão perto do da 1ª (até 0,55 rad) e vem 480 ms depois (eram 320 ms com o vão em qualquer lugar).

O Kris continua o SUPER mais fácil para o bot perfeito (é sobre o próprio caminho do coração: quem joga bem nunca é pego); com o bot médio ele ficou na faixa dos outros.

Cartas de ataque (♠ ♦ ♣ de 2 a K, sem Ases; 12 sementes; média por carta):

| Personagem | Cartas | Dano/carta (médio) | Acertos/carta (médio) | Dano/carta (perfeito) |
|---|---|---|---|---|
| Kris | 12 | 7,7 | 0,86 | 0,9 |
| Susie | 13 | 10,0 | 1,13 | 1,5 |
| Ralsei | 8 | 10,3 | 1,26 | 1,5 |
| Noelle | 9 | 7,9 | 0,85 | 1,0 |
| Berdly | 12 | 9,2 | 1,20 | 1,0 |
| Dess | 13 | 12,6 | 1,41 | 2,9 |
| **média dos 6** | | **9,6** | **1,12** | |
| Asriel antes | 12 | 13,2 | 1,42 | 1,4 |
| **Asriel depois** | 12 | **10,2** | **1,12** | 1,3 |

O Asriel ainda dá um pouco mais de dano por carta porque tem mais figuras (o dano por bala sobe com o valor); acertos por carta ficaram na média. O que mudou no baralho dele:

| Carta | Acertos (médio) antes → depois | Mudança |
|---|---|---|
| K♦ Caos Final | 3,4 → 2,1 | estrelas 360 → 420 ms e mais lentas, cruz 1,1 → 0,9 rad/s, tiros a cada 1,2 s (era 1,08), colapso mais lento com 8 estilhaços (eram 10) |
| Q♦ Tempo Parado | 1,9 → 1,4 | estrelas mais espaçadas e lentas, ponteiros 185 → 170 px/s |
| K♠ Hyper Goner | 1,75 → 1,0 | losangos a cada 390 ms (eram 330), um pouco mais lentos |
| 8♠ Chaos Saber | 1,7 → 1,3 | aviso do corte ~560 → ~670 ms (dá tempo de atravessar a caixa), corte duplo só a partir de t = 0,75 |
| 10♣ Raio Caótico | 1,5 → 1,2 | lasers em cruz a cada ~1,5 s (era ~1,3) |
| 3♦ Shocker Breaker | 1,1 → 0,75 | raios mais espaçados; na caixa apertada a corrente perde a 3ª coluna se ela fechar a rota de fuga |

**2026-10-17: Berdly e Asriel de reação, sem guias.** Os projéteis dos dois nascem fora da caixa e entram (a entrada é o aviso; nada de bala parada piscando), e lados, ordens, tempos e quais golpes miram saem dos sorteios com semente (nada para decorar). Berdly: Bicada, Mergulho Aéreo, Correção (a caneta entra pela borda riscando o X) e Pena Armada (as penas voam de fora, cravam, giram atrás do coração e recuam antes de disparar) ficaram sem linhas de aviso. Asriel: Q♦ Tempo Parado e K♦ Caos Final não invertem mais os controles; o Caos Final perdeu a linha e o círculo das estrelas, a linha dos tiros do núcleo (ele incha antes) e o círculo do colapso (o anel entra de fora); Hyper Goner com menos losangos (no K, 2 a cada ~620 ms; eram 3 a cada 390) e cada um fere 60% do dano da carta. Medido (12 sementes, bot médio, acertos/carta antes → depois): Bicada 1,42 → 1,58, Mergulho 0,33 → 0,75, Correção 1,83 → 1,58, Pena Armada 0,25 → 0,92, Hyper Goner 1,0 → 1,08 (dano real ~13 → ~8,7), Tempo Parado 1,42 → 1,5, Caos Final 2,08 → 2,25; média por carta Berdly 1,20 → 1,16, Asriel 1,12 → 1,15.

A carta mais difícil do jogo agora é o K♠ Show de Rock da Dess (3 acertos no bot médio, ~40 de dano), fora deste ajuste.

**2026-10-08: K♠ Show de Rock refeito** (`dessShow` em `attacks/habilidades/dess.js`). Saíram as
paredes do riff com notas teleguiadas; entrou a ESTRADA DE NOTAS do show (estilo Guitar Hero):
4 cordas coloridas, acordes caindo no ritmo com sempre uma corda livre (que anda no máximo uma
casa por batida), colcheias no contratempo fora do caminho livre e pirotecnia no refrão numa
corda longe da livre. Medido (24 sementes): bot médio **~40 → 11,4** (0,88 acerto), perfeito 2,2;
nenhum aviso do validador. Fica na faixa das cartas fortes da Dess (Solo 11, Amplificador 11,
Palco Explosivo 16,5, Feedback 20).

**2026-10-17: Susie e Ralsei revistos** (`attacks/habilidades/susie.js`, `ralsei.js`). Projéteis nascem fora
da caixa e entram (sem piscar parados), e lados, ordens e posições são sorteados com a semente. Medido (12 sementes,
acertos do bot médio, antes → depois):

| Carta | Antes → depois | Mudança |
|---|---|---|
| 6♠ Pisão (Susie) | 1,25 → 1,33 | pisa numa parede sorteada (chão, teto ou lados), altura da onda sorteada; sem faixa de aviso, só a pegada piscando; cascalho entra pela parede oposta (o 1º na linha do coração) |
| 3♦ Encarar | 0,25 → 1,08 | 2–3 olhos, olhadelas miradas enquanto encaram, a rajada travada fecha com um leque de 3 |
| 7♦ Rugido | 0,58 → 0,75 | sem guia do vão; a onda vem de qualquer parede (o vão fica longe da linha do coração quando dá) |
| 5♣ Bomba de Giz | 0,50 → 1,50 | o maço é arremessado de fora (machuca em voo e no chão), pavio menor, 7–8 pedaços (um no coração), 2 por vez na força alta; sem círculo de aviso |
| 3♣ Bolinho Explosivo | 0,50 → 0,42 | cupcakes deslizam para qualquer parede; o chafariz sai da parede; sem círculo de contagem |
| 10♣ Laço de Fita | 1,08 → 1,75 | o nó voa de fora, a fita se enrola e aperta mais rápido, vão menor e sorteado; estoura em faíscas (uma no coração) |
| J♦ Feitiço de Sono | 2,42 → 2,58 | os Z entram por baixo do chão (um pouco mais espaçados para compensar) |
| A♣ Empréstimo Educado | 1,00 → 1,25 | sem linha de caminho: a estrela espia na borda 560 ms e sai |

Médias por carta (bot médio): Susie 1,13 → 1,28, Ralsei 1,26 → 1,35. Nenhum aviso `[telegrafo]`/`[rota de fuga]`.
No Pisão o bot perfeito subiu (0,33 → 1,08 acerto) porque ele não enxerga a pegada (é decoração), só os pilares.

**2026-10-17: cartas da Dess revistas** (`attacks/habilidades/dess.js`, `attacks/super/dess.js`).
Todos os projéteis dela nascem fora da caixa e entram (sem piscar), com lados, ordem e posições
sorteados; quem avisa é o próprio objeto (o taco no home plate, o microfone na parede, a guitarra
na corda, o amplificador na borda). Testado com o coração PARADO (sem bot, 6 posições × 3
sementes): todas as cartas e o SUPER acertam o coração parado.

- 9♠ Home Run: o taco se prepara no home plate e a bola sai de fora mirando onde o coração está na
  hora da tacada (antes, com 2 bolas, as duas abriam em volta do coração e parado ninguém apanhava).
- K♠ Show de Rock: os acordes são gemas que ocupam a corda (ficar na divisa entre duas cordas não
  salva mais); no refrão os acordes param e a labareda (um quarto da caixa) nasce sob o coração e o
  segue pelo palco, mais devagar que ele, trava e sobe.
- 8♦ Palheta: palhetas que perseguem o coração (Asgore/Toriel): fileira lateral que vira para ele,
  cerco que se fecha onde ele estava e chuva que escorrega atrás dele.
- Q♦ Feedback: mais fácil (2 passagens, mais lento, cresce menos, mais espaço entre as ondas).
- 3♣ Bomba de Fumaça: latas arremessadas que estouram num anel de brasas; a nuvem corre com o vento.
- 6♣ Amplificador: sem o cone de guia; o amplificador entra pela borda e vira atrás do coração.
- Q♣ Palco Explosivo: bombas e ondas mais espaçadas (menos dano).
- ★ Último Bis: as notas despencam nos trastes e EXPLODEM no chão (quadros `bonus-explosao-*` +
  som `explosaoGrande`), com estilhaços; sai a faixa inteira do traste que machucava.

Medido (bot médio, acertos por carta, 12 sementes; antes → depois): Home Run 0,33 → 1,17;
Show de Rock 0,92 → 1,33; Palheta 1,25 → 1,67; Feedback 2,00 → 1,42; Fumaça 0,33 → 0,33;
Amplificador 1,58 → 1,75; Palco Explosivo 1,50 → 1,00. SUPER (24 sementes): perfeito 11,4 → 2,7,
médio 38,5 → 32,5. Nenhum aviso do validador.

**Noelle: cartas normais sem guia e com projéteis entrando de fora** (`attacks/habilidades/noelle.js`).
As balas nascem fora da caixa e entram (a entrada é o aviso: nada de bala piscando parada nem "!"),
e lado, posição, instante e mirada são sorteados com a semente (nada de ritmo fixo).

- **8♠ Granizo:** a coluna e o círculo do chão que piscavam saíram. As pedras caem de cima da caixa em instantes sorteados (algumas de viés). Agora são 3 ou 4 por leva, com mais lascas e mais mirada.
- **3♣ Pingentes:** soltam do teto ou de uma parede lateral (sorteado a cada leva). A ponta sai da parede tremendo, e então o pingente dispara até cravar na parede oposta. Agora são 3 ou 4 por leva, com ritmo maior.
- **7♣ Estalactites:** crescem do teto, do chão ou das laterais. No lugar da área piscando, a ponta aparece na parede. O crescimento começa devagar. Duas estalactites nunca se cruzam, e uma só nasce se o coração tiver por onde sair a tempo (busca numa grade de 6 px).
- **J♣ Avalanche (refeita):** bolas de neve entram rolando por bordas sorteadas e fazem curva pesada atrás do coração; o passo para o lado na hora certa faz a bola passar reto. Elas crescem enquanto rolam e se espatifam na parede em torrões que voltam para dentro.
- **Floco Afiado, Vento Gélido, Raio de Gelo, Inverno Eterno:**
  - flocos, estilhaços, orbe e cristais vêm de fora;
  - o lado da rajada é sorteado (não alterna mais);
  - a mira do raio virou um fio fino;
  - os sopros do inverno variam ±15%.

Medido com 12 sementes (acertos por carta; bot médio, antes → depois):

| Carta | Antes | Depois |
|---|---|---|
| Granizo | 0,67 | 1,17 |
| Pingentes | 0,33 | 1,00 |
| Estalactites | 0,50 | 1,25 |
| Avalanche | 1,42 | 1,58 |
| Vento Gélido | 0,08 | 0,42 |
| Raio de Gelo | 1,17 | 1,00 |

Média da Noelle: 0,85 → 1,08. Nenhum aviso do validador. O bot não enxerga a ponta da estalactite saindo da parede (é só decoração), então nessa carta ele leva um pouco mais do que quem joga.

**2026-10-18: SNOWGRAVE mais fraco** (`attacks/super/noelle.js`). Menos projéteis em todos os atos (neve mais
espaçada, 5 estilhaços por floco gigante, rajadas de 3–5, anéis de 5 flocos, túmulo de 7–8 lascas, explosão
de 6) e cada golpe fere 75% do dano do SUPER (`fatorDano`). Medido (12 sementes, dano real por SUPER):
imbatível 6,5 → 2,5, CPU difícil 20,6 → 11,7, bot normal 41,2 → 27,5 (era o SUPER mais forte; agora fica
junto com o Último Bis, o mais fraco).

**2026-11-12: rebalanceamento dos SUPERs** (`attacks/super/*.js`, helper novo `attacks/super/previsao.js`).
Feedback de quem joga: SNOWGRAVE (Noelle), Último Bis (Dess) e Último Capítulo (Ralsei) "esmagam"; Alma
Determinada (Kris), Prova Irrefutável (Berdly) e Singularidade Radiante (Asriel) "não pesam". O Susie ficou como
referência (não mudou). Medido com 48 sementes, antes → depois (dano real por SUPER; bot perfeito = `dificil` no
JSON, médio = `normal`; o "lento" é o bot FÁCIL, reação de 320 ms, usado como termômetro de quem joga com
reflexo de gente: `NIVEIS_BOT=imbativel,normal,facil`):

| SUPER | Bot perfeito | Bot médio | Bot lento (FÁCIL) |
|---|---|---|---|
| Kris · Alma Determinada | 7,3 → 6,2 | 33,3 → 36,0 | 50,4 → 60,9 |
| Susie · Machado Colossal (referência) | 16,8 → 16,8 | 36,6 → 36,6 | 65,5 → 65,5 |
| Ralsei · Último Capítulo | 13,8 → 13,3 | 37,6 → 34,4 | 58,8 → 54,4 |
| Noelle · SNOWGRAVE | 5,7 → 9,2 | 32,2 → 33,3 | 57,4 → 55,0 |
| Berdly · Prova Irrefutável | 15,4 → 14,4 | 37,4 → 38,7 | 47,4 → 52,8 |
| Dess · Último Bis | 3,5 → 4,9 | 29,3 → 32,8 | 51,5 → 52,8 |
| Asriel · Singularidade Radiante | 13,5 → 13,8 | 33,3 → 33,9 | 52,8 → 56,6 |

Os números do bot sozinhos não dizem o que o jogador sente (o bot enxerga todos os avisos, e o Kris/Dess/Noelle
eram os que ele mais desviava), então a regra foi: tirar do Noelle/Dess/Ralsei o que é ilegível ou injusto para
gente (aviso curto, rota de fuga longe, véu escuro, cenário parecido com bala) e pôr a pressão onde o jogador vê
o que vem; no Kris/Berdly/Asriel acrescentar tiros que miram **para onde o coração vai** (previsão do movimento,
`previsao.js`: velocidade suavizada do coração, deslocamento no máximo 56 px, sempre dentro da caixa), sempre com
aviso e com rota de fuga. Tudo é sorteado com a semente do ataque (sem `Math.random`); os corações do CO-OP/2x2 usam a mesma
previsão (o coração mais perto do alvo). Validador: **zero** avisos `[telegrafo]` e `[rota de fuga]` nos 7 SUPERs
(48 sementes × 4 níveis de bot). Dano por bala (13), custo das cartas e protocolo de rede não mudaram; o CO-OP
(`coop/superNoChefe.js`) usa só as texturas e continua igual.

- **Noelle (SNOWGRAVE), mais legível.** Neve mais espaçada (430/270 → 480/320 ms, 35% mirada, era 45%), rajadas
  800/680 ms (eram 650/520) com brecha de 66 px (era 58), anéis do redemoinho 1060/870 ms (eram 950/760) com
  62 px livres em volta do olho (eram 56), flocos mirados a cada 800 ms (760), floco gigante racha 400 ms antes de
  estourar (300), pilar mostra a ponta 580 ms (460), túmulo fecha em 1300 ms (1150). O cenário ficou calmo: véu
  de frio de 0,14–0,50 (era 0,18–0,73 e 0,85 no SNOWGRAVE), branco da nevasca 0,08 (0,2) e a neve de fundo agora
  é só faísca pequena e apagada (antes 1 de cada 5 usava o desenho do floco que machuca). Para o bot perfeito
  não virar passeio, são 5 pilares (eram 3), cada um com a ponta visível por 580 ms.
- **Dess (Último Bis), rota de fuga ao alcance.** Só cai nota em cima do traste do coração se o traste vizinho
  estiver apagado (antes a única rota podia estar a 2–3 trastes, mais longe do que dá para correr em 0,6 s; o
  conjunto final de trastes é conferido de novo, porque um traste novo pode ser justamente o vizinho livre).
  A nota que mira cai no traste para onde o coração anda (previsão) e mira mais (80%/90%, eram 50%/70%) com queda
  mais curta (580/620/520 ms; eram 660/720/600, ainda acima de 400); em compensação saíram o tremor e as fagulhas
  fortes de cada explosão (0,005 → 0,002; 7 → 4), a onda do amplificador (decoração que se confundia com dano),
  e o Mergulho agora tem 3 ondas de choque (480 ms entre elas, o vão fica perto do anterior) com dois acordes
  caindo por baixo. Solo mais denso (nota a cada 0,54 tempo, bend em 45%, era 62% e 20%).
- **Ralsei (Último Capítulo), avisos maiores.** Aviso do sopro 650 → 820 ms, leque mais estreito (π/5 em vez de
  π/4,6) e 6 chamas por rajada (eram 7), 3 rajadas espaçadas em 170 ms (era 100: deixa de ser parede), moldura
  fecha até 66% (72%), brasas a cada 360 ms com 520 ms de aviso (300/420), dragão com aviso de 900 ms (700),
  balanço de 26% da largura (30%) e mais lento (2,9 rad/s, era 3,2): as bordas ficam mais largas para esperar.
- **Kris (Alma Determinada), pressão sem depender do rastro.** Golpes do tabuleiro a cada 620 ms (aviso 540,
  era 700/580) e, do 4º em diante, a peça cai também a partir da casa para onde o coração anda (só se sobrar uma
  casa vizinha livre da casa dele). Fase do eco: 4 **sentenças** (um X de duas linhas finas, aviso 520 ms,
  atravessadas no caminho do coração), que punem quem só roda em círculo ou foge reto; eco nasce 1,25 s atrás
  (era 1,4), chega até 430 ms (era 450) e acelera mais (0,26/s, era 0,24); 4 cortes finais (eram 3), e o 2º em
  diante passam por onde o coração vai estar.
- **Berdly (Prova Irrefutável), cruzamentos mais apertados.** Lâminas maiores (0,34 do lado, era 0,32) e mais
  rápidas (3,7 rad/s, era 3,5). Durante o redemoinho, **réplicas**: uma página pisca 460 ms numa borda (a mais de
  70 px do coração) e sai para onde ele vai estar, a cada ~760 ms (de 3 em 3, duas em leque). O corte final vira
  um X: o 2º feixe cruza o 1º (1,05 rad) e cai 280 ms depois.
- **Asriel (Singularidade Radiante), supernova mais densa.** 6 anéis (eram 5) a cada 640 ms (720) e, entre dois
  anéis, uma **estrela cadente** que pisca 520 ms na parede de lá e cruza a caixa até onde o coração vai estar
  (quem fica encostado na parede esperando a brecha é pego).

Lacunas conhecidas: o bot perfeito continua desviando quase tudo do Kris (6,2) e do Dess (4,9), abaixo da faixa
8–16; o Dess não sobe mais sem tirar justamente a legibilidade que os jogadores pediram (o bot lê todos os trastes
acesos). O Berdly (38,7) ficou um pouco acima de 38 e o Asriel/Noelle/Ralsei na parte de baixo da faixa; com 48
sementes o ruído é de ±2 de dano.

**2026-11-13: SUPER do Asriel mais forte** (`attacks/super/asriel.js`, geometria nova em `attacks/super/asrielGeometria.js`,
testes em `src/game/__tests__/asrielSuper.test.js`). Os jogadores ainda achavam a Singularidade Radiante "mole" (sem
ameaça e sem espetáculo). Medido com 48 sementes (bot perfeito = `dificil` no JSON, médio = `normal`, lento = FÁCIL de
320 ms), antes → depois, com o Susie (referência) ao lado:

| SUPER | Bot perfeito | Bot médio | Bot lento (FÁCIL) |
|---|---|---|---|
| Asriel · Singularidade Radiante | 13,8 → 20,3 | 33,9 → 43,3 | 56,6 → 62,6 |
| Susie · Machado Colossal (referência) | 16,8 | 36,6 | 65,5 |

O bot perfeito e o médio ficaram acima do alvo (16–19 e 38–40) e o lento um pouco abaixo (65–70): neste ataque os três
níveis sobem e descem juntos (a razão lento/médio ficou em ~1,45, a do Susie é 1,8), então não deu para acertar os
três ao mesmo tempo sem tirar legibilidade. Com 48 sementes o ruído é de ±2 de dano. Validador: **zero** avisos
`[telegrafo]` e `[rota de fuga]` (48 sementes × 4 níveis de bot: imbativel, dificil, normal, facil). Dano por bala (13),
custo, protocolo e ajuste de HP do PvP **não mudaram**; o CO-OP (`coop/superNoChefe.js`) só usa as texturas e continua igual.

- **Ato I (O Vazio), mais pressão.** O vazio cresce mais cedo (pulsos em 0/700/1400/2000 ms, aviso 500; eram
  0/1150/2300/3400 e 650) e fica cheio por mais tempo, com um **aro arco-íris** no raio que machuca (o sprite do buraco
  é menor que a hitbox e o jogador não via onde acabava). Espiral com 4 braços (eram 3), uma estrela por braço a cada
  600 ms (620), mais rápida (queda 44 px/s, giro até 5 rad/s). Novo: **4 jatos do vazio**, uma linha fina riscada através do
  ponto para onde o coração vai (`previsao.js`) e, 520 ms depois, uma fileira de 3 estrelas lado a lado corre por ela de
  uma borda à outra (nascem fora da caixa).
- **Ato II (Supernova), sem pausa.** A pausa do meio da onda foi desligada (`respiro.meio = 0`): o colapso (4200 ms)
  vem direto, com clarão, anel de choque e tremor maiores; o 1º anel sai 400 ms depois.
  5 anéis a cada 540 ms (eram 6 a cada 640; o 6º saiu porque os raios finais precisam do campo livre), o último
  duplo, estrelas cadentes miradas entre eles (duas nos últimos), e cada anel dá um clarão e um tremor crescentes, em
  cores diferentes. As estrelas trocam de quadro/cor sem parar (arco-íris).
- **Ato III (Caos Final), novo.** O núcleo da supernova incha e 6 raios coloridos são riscados (aviso 540 ms); cada
  raio dispara uma coluna de 4 estrelas rápidas (290 px/s). Logo que a 1ª onda sai, uma **2ª onda** é riscada nos
  ângulos do meio das fatias da 1ª (aviso 460 ms; a fatia segura vira raio e o raio já passou), e fecha com clarão
  arco-íris. Rota de fuga: raios com folga angular mínima (`asrielGeometria.js`) deixam fatias de ≥ 48 px a 60 px do
  centro; o miolo (raio < 36) nunca é atingido; os anéis já saíram da caixa quando os raios disparam (testado). Os
  clarões respeitam a preferência de clarões/tremor (`fatores()`).
- **Duração:** 9000 → 9800 ms ativos (o Caos Final precisa dos ~800 ms extras para a 2ª onda atravessar a caixa).

## Nome de cada lado (2E)

Na partida o lado é identificado pelo **nome do jogador**, não pelo do personagem (o personagem fica como linha pequena): HUD, abertura, replay do K.O., "… VENCE!" e tela de resultado. Online/LAN: o nome do membro da sala (conta ou convidado, já filtrado pelo servidor). Mesmo PC: P1 = nome da conta logada ou `JOGADOR 1`; P2 = `JOGADOR 2`; contra a CPU, `CPU`. Nomes passam pelo filtro de palavras (`nomeSeguro`) e são cortados em 12 letras com "…". Lógica pura em `src/game/pvp/nomes.js` (`nomeDoJogador(lado, contexto)`).

O motivo de carta bloqueada aparece numa pílula vermelha com texto branco e "×" (a cor do P1 é parecida com o vermelho do bloqueio).

## Todos contra todos

Modo `ffa` (1x1x1x1), **3 ou 4 jogadores**, só **online** em sala de amigos (Fase 5D). Regras puras em `src/game/pvp/ffa.js` (testes em `pvp/__tests__/ffa.test.js`); a arena é `scenes/PvpArenaN.js`, a rede `pvp/rede/ArenaRedeN.js` ([rede-pvp.md](rede-pvp.md#todos-contra-todos-fase-5d)). O PVP 1x1 não muda: são cenas separadas (`PvpEscolhaN` → `PvpArenaN` → `PvpResultadoN`).

**Telas.** Lobby (modo TODOS CONTRA TODOS com 3–4 na sala) → `PvpEscolhaN` (a grade da party do CO-OP 3–4: cada um escolhe o próprio personagem, **sem repetir**, para as caixas ficarem distintas; quem arbitra é o host) → `PvpArenaN` (sem votação de arena: o host sorteia uma, que vale para fundo e música) → `PvpResultadoN`.

**Arena (854×480).** No alto, um cartão por vaga (forma + nome + HP + energia + estado). Embaixo, uma **grade 2×2 com uma caixa por jogador** (220×170, o tamanho do 1x1: os ataques medidos continuam valendo): vaga 0 em cima à esquerda, 1 em cima à direita, 2 embaixo à esquerda, 3 embaixo à direita. Cada célula tem a cor, a forma e o nome do dono (também no coração), o personagem e, à direita da caixa, **quem ataca ela** (uma setinha que chega + a forma e a cor dele, sem nome; na esquiva, a carta e o dano por acerto). No cartão do alto, depois da escolha, o **alvo** de cada um aparece como uma setinha + a forma e a cor dele. Só a minha mão aparece.

**Foco no meu par (`pvp/focoFfa.js`, testes em `pvp/__tests__/focoFfa.test.js`).** A grade é a visão geral (o anúncio desenhado, a escolha, a revelação). Na esquiva a tela vai para o **meu par**:
1. **Anúncio desenhado** (`pvp/anuncioAlvos.js` + `pvp/AnuncioAlvos.js`, testes em `pvp/__tests__/anuncioAlvos.test.js`): sem caixa de texto. Os **sprites** dos jogadores aparecem num losango/triângulo (2x2: time A à esquerda, B à direita, cor do time atrás), cada um com o anel da cor da vaga e a forma da vaga; **setas animadas** (uma a cada ~130 ms, ~1,2 s no total) mostram quem ataca quem. A **minha** seta é grossa, na minha cor e pulsa; a que **vem para mim** é tracejada na cor de quem ataca; as outras ficam apagadas. Só há uma palavra, "VOCÊ", em cima do meu personagem. Caído/eliminado = sprite cinza com X; SEM ALVO = raio de energia no lugar da seta; sem conexão = ícone de sinal cortado (não ataca, mas leva o ataque). No 2x2 meu parceiro tem um coraçãozinho ligando a mim. Espectador: o mesmo desenho, com quem ele segue em destaque. **A ou B** pulam a animação; com **"reduzir animações"** as setas aparecem de uma vez, paradas, por ~0,8 s. Depois o desenho encolhe para o meio da tela e fica como lembrete durante a escolha.
2. **Transição** (`TRANSICAO.ms` = 700 ms, Cubic in-out, com um "whoosh" que sobe): as caixas abrem na grade e vão para o **foco**: a **minha caixa grande no meio-esquerda** (escala 1,42: eu desvio do ataque que vem para mim) e a do **meu alvo menor em cima à direita** (escala 0,62: eu vejo o meu ataque chegar), cada uma com forma, nome na cor da vaga, barra e número de HP e o que ela recebe ("desvie de DUDA: ♦ CONTROLE · 6/acerto"). Os outros encolhem até um **cartão pequeno** embaixo à direita (forma, nome, barra de HP e DESVIANDO / CAÍDO / SEM CONEXÃO / ELIMINADO 4º / SEM ATAQUE) e **a caixa deles não é desenhada**. Só as duas cartas que importam (a que vem para mim e a minha) voam; as outras saem da mesa.
3. **Fim da rodada**: a tela volta à grade (o "whoosh" desce), as caixas fecham e cada célula mostra o **dano da rodada** ("-18 HP", "causou 16" ou "SEM DANO"); depois o anúncio seguinte.
4. **Espectador** (eliminado): o mesmo foco, no par de quem ele segue (←/→ troca com uma transição curta de 320 ms).
5. **Reduzir animações**: **corte seco** no lugar do zoom (e um "whoosh" mais curto e baixo).

É **só apresentação**: as caixas continuam no mesmo lugar do **mundo** (limites, balas, colisão, as posições do coração que viajam pela rede) e todas continuam rodando como antes (a minha de verdade, as dos outros espelho; o dano de cada coração continua sendo decidido no PC do dono). O foco só muda **onde e de que tamanho** a caixa aparece (`BattleBox.setVista`: as câmeras de recorte mostram a região dela em outro lugar, a borda vai junto) ou se ela aparece (`BattleBox.setOculta`: câmeras e borda apagadas, sem parar o ataque). As faíscas e o coração quebrado de uma caixa vão para onde ela aparece (`pontoNaTela`) e somem com ela. O replay do último K.O. continua gravando as caixas escondidas.

**Rodízio de alvos (anunciado ANTES da escolha).** Os vivos em ordem de vaga, `v[0..n-1]`; na rodada `r` cada um ataca `v[(i + passo) mod n]`, com `passo = 1 + (r − 1) mod (n − 1)`. O passo nunca é 0 nem múltiplo de `n`: é uma permutação **sem ponto fixo**, então cada um ataca exatamente **um** e recebe exatamente **um** ataque — não dá para três baterem no líder (anti-foco). Com 3 vivos é sempre um ciclo (direita, esquerda, direita…); com 4, o passo 2 faz duas duplas (A↔C, B↔D); com 2 vivos vira o 1x1. O rodízio é anunciado pelo desenho acima (setas entre os personagens), não por texto.

**Cartas, energia, dano.** Tudo do 1x1 (energia 3/+2/teto 10, passar +1, grazes, desvio perfeito e combo, ♥ suporte em quem joga, escudo, custos, SUPER custando 10), resolvido **por par atacante → alvo** (`resolverRodadaFfa`):

| Carta | No todos contra todos |
| --- | --- |
| ataque (♠ ♦ ♣, figuras) | vai para a caixa do **meu alvo** |
| ♦ Ás Anular | cancela a carta de **quem me ataca** (ataque, suporte e especial; o SUPER não) e manda o ataque leve para o meu alvo |
| ♠ Ás Espelho | **passa adiante** o ataque que vinha para mim: ele vai para o meu alvo (no lugar do eco) e não chega em mim. Sem ataque para passar (passou, copas, Espelho, SUPER), manda o eco ao meu alvo. Assim ninguém recebe dois ataques |
| ♣ Ás Roubo | rouba uma carta da mão do **meu alvo** |
| ♥ Ás Segunda chance | igual (o HP não passa de 1 nesta rodada) |
| SUPER | imparável como no 1x1, vai para o meu alvo |

**Rodadas bônus e eventos: desligados** no todos contra todos. Os eventos de arena desenham coisas **entre duas caixas** (teclado, relógio, imperador, gladiador) e o Duelo, o CTRL+C CTRL+V e o Coração trocado são minigames de exatamente 2; com até 4 caixas abertas a rodada já é caótica. A aceleração a cada 5 rodadas (morte súbita de velocidade) continua.

**Eliminação.** HP 0 no fim da rodada = **eliminado** (quem cai na mesma rodada fica no mesmo lote). A caixa dele não abre mais, ele não está no rodízio e o cartão diz "ELIMINADO 4º". Quem foi eliminado vira **espectador**: "ELIMINADO — assistindo", sem mão; **←/→ escolhe quem seguir** (na grade a borda da célula pisca; na esquiva o foco é o par dele: "ASSISTINDO CAIO").

**Tempo de espectador (limitado e medido).** A partida acaba quando sobra **1 de pé** (ou 0: os últimos caíram juntos). Para ninguém assistir para sempre: a partir da **rodada 15** (`FFA.morteSubita`) o dano por bala de toda caixa é **×1,5**, e no fim da **rodada 24** (`FFA.limiteRodadas`) a partida acaba e quem está vivo é classificado pelo HP. A tela de resultado mostra quantas rodadas cada eliminado assistiu (`espectador`, também no log `[ffa] fim`).

**Classificação** (`classificacao`): quem caiu **depois** fica na frente (vivo à frente de todos); empate (o mesmo lote, ou os vivos no limite) pelo **HP que sobrou**, depois o **dano causado**, depois o **menor dano recebido** e por fim a vaga (a ordem é sempre estrita: é ela que vai para o servidor). Dano causado = o dano efetivo que a caixa que eu mandei fez (Espelho: conta para quem passou adiante; sem conexão: para quem atacou).

**Queda no meio da partida (regra de N: quem cai não leva vantagem).** Enquanto está sem conexão: **não ataca** (passa sem o +1), **não ganha** a energia da rodada, e o ataque que vinha para ele **vale como 3 acertos** cheios (`FFA.acertosAusente`; menos o que ele já tinha levado na rodada), aplicados pelo host no fim da rodada. Voltou: entra na **rodada seguinte** com o HP que tem. Não voltou em **20 s**: é **eliminado na hora** (a colocação é a daquele momento: fica atrás de quem cair depois na mesma rodada). O host que cai: tudo para nos 3–4 PCs e a rodada recomeça na volta (2D), ou a sala fecha sem XP.

**Escolha às cegas:** como em todo PVP online, a carta dos outros só aparece quando todos confirmam (ver [Escolha às cegas no online](#escolha-às-cegas-no-online)).

**Resultado e fim.** A lista do 1º ao último (forma, nome, personagem, dano causado/recebido, HP, quando caiu e quantas rodadas assistiu), o replay do **último K.O.** (câmera lenta + TV; o placar mostra o vencedor e quem caiu por último), a faixa de XP e o fim da 2E para N (`pvp/fimDePartidaN.js`): **REVANCHE** (mesmos personagens e arena) e **TROCAR PERSONAGEM** só com **todos** de acordo (um TROCAR vale para todos; 15 s sem acordo cancela; quem sai da sala não segura os outros), **VOLTAR AO LOBBY** na hora. O host leva todos (`irParaCena`) e abre uma partida nova no servidor (XP novo).

**XP** ([online.md](online.md#todos-contra-todos-fase-5d)): participação 40 para quem jogou até o fim, **1º +20** (vitória), **2º +10** (migration 0007), o resto só a participação.

Testando no navegador (dev, 3 ou 4 abas): o dono cria a sala, `mudarModo('ffa')`, os outros `entrarCodigo`, todos `alternarPronto()` e o dono `pedirPartida()`; na escolha, **Q** (acorda o teclado) e **espaço** em cada aba. Na arena, `debugJogo.set({ acelerar: 2 })` e, no host, `pvpArenaN.setHp(j, 5)` aceleram o fim; `pvpArenaN.estadoDebug()` mostra os alvos, a classificação e as caixas.

## 2x2

Modo `2x2` (duas equipes de 2), **exatamente 4 jogadores**, só **online** em sala de amigos (Fase 5E). Regras puras em
`src/game/pvp/dupla.js` (testes em `pvp/__tests__/dupla.test.js`), por cima das do [todos contra todos](#todos-contra-todos):
a mesma cena (`PvpEscolhaN` → `PvpArenaN` com `modo: '2x2'` → `PvpResultadoN`), a mesma ponte (`ArenaRedeN`) e a mesma
escolha às cegas. O 1x1 e o todos contra todos não mudam.

**Times.** Por vaga da sala, num de 3 arranjos (`src/lib/times2x2.js`): **A = vagas 0+2, B = 1+3** (padrão), A = 0+1 / B = 2+3,
A = 0+3 / B = 1+2. No lobby o **dono** passa ao próximo com **TROCAR TIME** (o servidor guarda `sala.arranjo`; cada cartão do lobby
mostra o time). Na arena os times ficam **juntos em qualquer arranjo** (`lugaresDoTime`): o **TIME A na coluna da esquerda** (células
de cima e de baixo, e os dois cartões do placar à esquerda do relógio) e o **TIME B na da direita**, como no anúncio dos duelos; dentro
do time, a vaga menor em cima. A célula tem o fundo e a borda grossa da cor do time (A azul, B laranja) e a etiqueta
"TIME A · VOCÊ / PARCEIRO / RIVAL" (o papel é de quem olha); o cartão do placar tem a borda do time, um filete na cor dele junta os dois
de cada lado e o relógio mostra "◀ A  B ▶". As cartas reveladas na mesa seguem a mesma ordem. A forma e o nome continuam na cor da vaga.

**Duelos cruzados (anunciados antes da escolha: "DUELOS DA RODADA").** Com os 4 de pé: rodada ímpar **A1×B1 e A2×B2**, rodada
par **A1×B2 e A2×B1** (A1/A2 = os do time em ordem de vaga). Cada duelo é um 1x1: os dois do par atacam um ao outro, com todas as
cartas, a energia, os Ases e o SUPER do 1x1 (♠ Espelho devolve ao oponente, ♦ Anular cancela a carta dele, ♣ Roubo rouba dele).

**Anti-foco.** Ninguém recebe mais de um ataque por rodada. Quando um time tem só **um de pé**, ele enfrenta **um** adversário
(alternando a cada rodada) e o outro adversário fica **SEM ALVO**: ganha **+1 de energia** no começo da rodada e só pode jogar
**♥** (em si ou no parceiro) ou passar.

**Caído e resgate.** HP 0 no fim da rodada = **CAÍDO** (não sai): não joga, não é alvo, não ganha energia, a caixa não abre, a mão
desce e a tela segue o **duelo do parceiro** (←/→ troca quem assistir). O parceiro resgata:
1. **Rodada limpa**: ele tinha ataque na caixa e **não levou nenhum acerto** → no fim da rodada o caído (de uma rodada anterior)
   volta com **30%** do HP ("RODADA LIMPA! X VOLTA").
2. **♥ no caído**: a carta vale nele (cura, escudo, Segunda chance) e ele **levanta na hora** com pelo menos **25%** do HP
   ("LEVANTOU!"). Nos dois casos volta a jogar na rodada seguinte.

**♥ no parceiro.** Ao confirmar um ♥ no 2x2 aparece "♥ EM: ◀ VOCÊ ▶": **←/→** escolhe você ou o parceiro (o parceiro caído vem
selecionado: é o resgate), **A** confirma, **B** volta à mão. A cura, o escudo e a Segunda chance vão no alvo; a **energia e a compra
ficam com quem jogou**. A jogada vai ao host como `{ carta, apoio }`.

**SUPER em dupla.** Os dois do time jogam SUPER na mesma rodada: as duas caixas de SUPER têm **+25% de dano por acerto**
("SUPER EM DUPLA!"). Nada além disso (o bônus é limitado).

**Vitória.** Vence o time cujos **dois adversários estão caídos (ou fora)** no fim da rodada. O resgate vem antes: um caído que
volta pela rodada limpa salva o time. Os **dois times zerados no mesmo fim de rodada = EMPATE**. Morte súbita na rodada 15 e
limite na 24 como no todos contra todos; no limite vence o time com **mais HP somado** (dos de pé), igual = empate.

**Rodadas bônus e eventos: desligados** (como no todos contra todos).

**Queda no meio da partida (quem cai não leva vantagem).** Igual ao todos contra todos: sem conexão não ataca, não ganha a energia
da rodada e o ataque que vinha para ele vale como 3 acertos; volta na rodada seguinte. Não voltou em **20 s**: fica **FORA**
(eliminado; **não dá para resgatar**) e conta como caído para a vitória (o parceiro segue sozinho, com o anti-foco). Host que cai: 2D.

**Câmera.** O foco do todos contra todos: a **minha caixa grande** + a do **meu oponente**; o **parceiro** é o primeiro cartão
pequeno ("PARCEIRO · NOME", HP e DESVIANDO / CAÍDO / SEM ALVO / SEM CONEXÃO), com o "whoosh" nas transições. Caído (ou SEM
ALVO) o foco vai para o duelo do parceiro.

**Resultado.** "TIME A VENCEU!" (ou EMPATE) com os nomes, o time vencedor primeiro (etiqueta do time, dano causado/recebido,
HP, quando caiu). Fim: **REVANCHE**, **TROCAR PERSONAGEM** e **TROCAR TIME** (a revanche com o próximo arranjo) com **todos**
respondendo (vale a maior mudança pedida: personagem > time > revanche; 15 s sem acordo cancela), **VOLTAR AO LOBBY** na hora.

**XP** ([online.md](online.md#2x2-fase-5e)): participação 40 para todos que jogaram até o fim, **+20 para os dois do time
vencedor**, empate só a participação; o limite diário conta contra **cada adversário** (migration 0009).

**Buzzer/vibração:** os ganchos de sempre (golpe de SUPER, K.O./queda pelo HP, vitória do meu time).

Testando no navegador (dev, 4 abas): como no todos contra todos com `mudarModo('2x2')` (e `mudarTimes(1)` para trocar os times);
`pvpArenaN.setHp(j, 1)` no host derruba alguém; `pvpArenaN.estadoDebug()` mostra `times`, `semAlvo`, `caido` e `vencedorTime`.

## Escolha às cegas no online

No **PVP online** (1x1 em sala de amigos e no Jogar Rápido, e o todos contra todos) a escolha é **simultânea e às cegas**: enquanto alguém está escolhendo, **ninguém vê a carta que o outro escolheu** (nem o tipo dela), só "<nome> já escolheu ✓". Quando **todos confirmaram** e as jogadas travam, a rodada começa e a **carta de verdade** de cada um é revelada como no jogo original (a carta vira, nome, valor, ataque); dali em diante o texto da caixa, a coluna "quem ataca", o log, o replay e as estatísticas do resultado mostram as cartas reais. A **mão** do outro (e o monte e o descarte) fica **virada** o tempo todo, sem prévia ampliada; as **minhas** cartas são sempre inteiras para mim. O PVP local (mesmo PC) e o vs CPU não mudam. Lógica em `pvp/sigilo.js` (testes em `pvp/__tests__/sigilo.test.js`).

**No fio** (o host roda as regras e sabe tudo; [rede-pvp.md](rede-pvp.md#escolha-às-cegas-no-online)): até as jogadas travarem o convidado **não recebe o id de nenhuma carta do host** (a jogada do host vai como uma **ficha** sorteada por partida, a carta virada que sai da mão dele; a do convidado só vai ao host). Travadas, o host manda a todos as jogadas e o resultado com a carta de verdade. O host também **embaralha os montes com um sorteio só dele** (a semente da partida, que os dois conhecem, refaria a ordem do baralho do outro); o RNG dos baralhos dos outros não viaja.


## Efeitos visuais dos Ases

Cada Ás de cada personagem ganha um floreio curto (até ~1,2 s), só enfeite: não espera nem atrasa a partida, nunca lança erro (tudo em try/catch), é igual nos dois lados (nada sorteado) e segue "reduzir animações" (vira só o rótulo e um anel). Código: `src/game/pvp/efeitosAses.js` (`tocarEfeitoAs`, `efeitoDoEspecial` na revelação, `efeitoDoReflexo` na devolução do ataque), usado pelas 4 arenas (PvpArena, PvpArenaN, CoopArena, CoopArenaN). O ♠ toca na devolução do ataque (se houver); o ♦ aparece na carta cortada.

| Personagem | ♠ Espelho | ♦ Anular | ♣ Roubo | ♥ Suporte |
|---|---|---|---|---|
| Kris | Reflexo da Lâmina: dois cortes em X | Silêncio: anéis que fecham, "SHHH" | Mão Leve: luva traz uma carta | Determinação: alma vermelha e raios |
| Susie | Revide Selvagem: três garras | Grito: ondas serrilhadas e tremor | Roubar Lanche: luva traz um chocolate | Teimosia: coração finca o pé, poeira |
| Ralsei | Lição Invertida: livro vira de cabeça para baixo | Pacifismo: símbolo da paz | Empréstimo Educado: luva gentil | Abraço Fofo: dois braços abraçam |
| Noelle | Espelho de Gelo: espelho que se estilhaça | Congelar: cristais e geada | Mão Fria: luva gelada | Milagre de Natal: neve e estrela |
| Berdly | Réplica Brilhante: cópia reluzente | Objeção!: balão de quadrinhos, dedo e tremor | Cópia da Prova: scanner e folha copiada | Ego Inabalável: óculos reluzentes |
| Dess | Rebatida: taco de beisebol de pixel-art, "TOC!" e home run | Corta o Som: cabo arrancado da tomada | Pegou Emprestado: luva traz uma palheta | Bis!: holofotes e confete |
| Asriel | Hiper Espelho: prisma arco-íris | Apagar: borracha arco-íris | Pegar Alma: alma vermelha vem até a carta | Salvar: estrela de SAVE |

Conferir no dev: `window.debugGaleria('ases')` (uma página por personagem, Z repete) ou `window.debugPalcoAses('dess', 'espadas')`.

### Estação Espacial: 8 bônus que mudam uma regra

Código em `pvp/bonus/eventos/estacao/` (contas puras em `planos.js`, testes em `__tests__/eventosEstacao.test.js`). Todos avisam com uma frase curta em cima das caixas; a CPU joga todos.

| Bônus | Regra que muda |
|---|---|
| SEM ATRITO | o direcional vira empuxo: o coração desliza e só para se você frear ao contrário (vmax 90, quica de leve) |
| BURACO DE MINHOCA | as bordas se ligam (cima-baixo, esquerda-direita) para o coração e para as balas (cada bala atravessa 1 vez) |
| RADAR | caixa escura; o feixe (1,8 s por volta) revela as balas com um blip que apaga; balas piscando, chegando de fora ou coladas no coração sempre aparecem |
| ÓRBITA | planeta no meio: puxa balas (curvam, são engolidas) e o coração (puxão < direcional); encostar machuca |
| POLARIDADE | coração e balas são + ou −; iguais repelem, opostos atraem; A inverte o seu (recarga 220 ms); polo da bala = função do índice (igual nos 2 PCs); a inversão vai pelo canal `estPolaridade` |
| OXIGÊNIO | barra de O2 esvazia (~5,6 s); bolhas avisadas recarregam; vazia = dano de 2% do HP máx a cada 1,5 s |
| RAIO TRATOR | A perto de uma bala a agarra (inofensiva, orbita o coração); A de novo lança na caixa do oponente (aviso de 650 ms); canal `estTrator` cria a mesma bala no PC do outro |
| MANUTENÇÃO | 4 painéis piscam (1 por quadrante); 1 s em cima conserta e vira escudo que apaga balas até o fim da rodada |

O jogo só recebe o aperto do botão (sem segurar/soltar), por isso o trator é "A pega, A lança".
