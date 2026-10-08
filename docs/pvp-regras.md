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
| Kris | Alma Determinada | estocadas + colunas de espada → lasers alternados numa caixa apertada → forcado + rajadas miradas |
| Susie | Machado Colossal | pisões → machado gigante com faíscas → dinamite (bombas + chão rachado) |
| Ralsei | Valsa Real | carrossel de anéis → anel + divisores → espiral de copas |
| Noelle | Inverno Absoluto | neve em cascata → raios de gelo verticais → pingentes + anel de gelo |
| Berdly | Furacão Genial | vento da esquerda → estocadas numa caixa apertada → lasers em cruz + mira |
| Dess | Turnê Final | ondas sonoras → bolas quicando → palco explosivo |
| Asriel | Supernova Arco-Íris | chuva de estrelas → espiral + chuva → Caos Final (com tempo para o colapso explodir) |

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
| ♦ ouros | controle | balas até 20% mais rápidas, caixa menor (210×170 → 160×135), Q/K invertem os controles durante o ataque todo | 2 + 0,45 × valor (3 a 8) |
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

## Bonus rounds (a cada 3 rodadas)

Nas rodadas 3, 6, 9... (`BONUS` em `pvp/bonus.js`) uma roleta sorteia um evento caótico **depois** que os dois escolhem as cartas (no Duelo, a carta escolhida vira a arma, sem gastar energia), que nunca repete o da rodada bônus anterior. Só caos, sem prêmio: ninguém ganha nada a mais, e o dano continua valendo. Nos eventos de esquiva, as duas caixas abrem mesmo que ninguém tenha atacado.

| Evento | Cartas | O que acontece |
|---|---|---|
| Chuva de explosões | normais | bombas com mira caem nas duas caixas e explodem em área |
| Modo festa | normais | bola de discoteca, holofotes, confete e balões que estouram |
| Mundo de ponta-cabeça | normais | a tela gira 180° (os controles não, aí que mora o caos) |
| Apagão | normais | escuridão: só se enxerga em volta do coração (com relâmpagos de vez em quando) |
| Gravidade maluca | normais | uma gravidade puxa o coração e muda de lado a cada ~2 s, com aviso |
| Coração trocado | normais | os corações trocam de caixa: cada um desvia do próprio ataque |
| PC da escola | normais | as caixas ficam pixeladas (baixa resolução) e rodam a 6–14 FPS, aos trancos; de vez em quando o PC trava ("Não está respondendo") |
| Aquário | normais | as caixas enchem de água: tudo em câmera lenta, o coração boia (segure ↓ para afundar) e tem inércia de água |
| Cogumelo maluco | normais | o coração alterna entre GIGANTE (hitbox enorme, música grave) e MINI (hitbox mínima, música aguda), com pisca-pisca de aviso |
| Dança da estátua | normais | a música PARA de repente, sem aviso: balas e ataque congelam, o coração não. Um holofote de vigia PERSEGUE o coração de cada um (é mais lento: dá para fugir); quem se mexer com a luz em cima do coração é PEGO (30% do HP máximo, uma vez por parada). Mexer fora da luz pode. A música volta e tudo descongela |
| Pista de gelo | normais | o coração escorrega: demora para acelerar, demora para frear e desliza quando você solta |
| Terremoto | normais | a terra treme (ronco de aviso antes): a tela sacode, o coração é empurrado e pedras caem do teto das caixas |
| Cartas malucas | viram outras | na revelação cada carta vira uma carta sorteada de qualquer personagem (mesmo custo); o SUPER não vira (é imparável). Depois da rodada o baralho volta ao normal |
| Duelo | viram armas | a carta escolhida vira a arma, sem gastar energia. Uma caixa só para os dois: ♥ tiro, ♠ espada, ♦ bumerangue, ♣ explosão (3 bombas em leque com estilhaços). Mira automática: é só se mexer e apertar A; o valor da carta aumenta o dano. Passar dá uma arma sorteada, fraca |

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
| Noelle | suporte gélido | 85 | 19 + ★ | 4 | 7 | 4 | 4 | Q♠ Nevasca, K♦ Inverno Eterno, J♣ Avalanche, J♥ Anjo da Neve · ★ Inverno Absoluto |
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
| Ralsei | anéis, carrossel, divisores, espiral | copas/bola verdes |
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

A carta mais difícil do jogo agora é o K♠ Show de Rock da Dess (3 acertos no bot médio, ~40 de dano), fora deste ajuste.
