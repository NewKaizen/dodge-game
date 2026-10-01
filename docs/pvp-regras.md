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
   2. ♦ Anular cancela a carta do outro (dois Anular: as duas se cancelam);
   3. ♥ suporte em quem jogou (cura, escudo, energia, compra) e Ás de copas;
   4. ataques: cada carta vai para a caixa do adversário; ♠ Espelho devolve o ataque do outro para a caixa dele;
   5. o escudo de quem recebe reduz o dano por bala daquele ataque (e é gasto);
   6. ♣ Roubo pega uma carta sorteada da mão do outro.
4. A cena roda `caixas[j]` (o que o jogador j desvia): `{ carta, de, refletida, dano, ritmo, inverterMs, escudo }`. O ataque em si vem de `ataqueDaCartaNoJogo(caixa.carta)` (`null` = caixa calma).
5. Durante a esquiva: `aplicarDano(estado, j, caixa.dano)` a cada acerto e `registrarGrazes(estado, j, n)` (+1 de energia a cada 5 grazes).
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

## Custos

| Valor | 2 a 4 | 5 a 8 | 9, 10, J | Q | K | Ás |
|---|---|---|---|---|---|---|
| Custo | 1 | 2 | 3 | 4 | 5 | 3 |

## Naipes

| Naipe | Tipo | Ataque na caixa do adversário | Dano por bala |
|---|---|---|---|
| ♠ espadas | ataque direto | padrões do personagem escalados pelo valor | 2 + 0,6 × valor (3 a 10) |
| ♦ ouros | controle | balas até 20% mais rápidas, caixa menor (210×170 → 160×135), Q/K invertem os controles (1,2 a 2 s) | 2 + 0,45 × valor (3 a 8) |
| ♣ paus | armadilha | bombas, lasers, colunas, ondas, forcado | 2 + 0,55 × valor (3 a 9) |
| ♥ copas | suporte em quem joga | só um ataque fraquinho (4 s, dano 2) | 2 |

Valor = força: `t = (valor - 2) / 11` vai de 0 (2) a 1 (K). Com `t` maior o ataque fica mais rápido, mais denso, mais longo (4 a 7 s ativos, mais os respiros) e dá mais dano.

Efeitos de copas (cada carta junta um ou mais):

| Efeito | Quanto vale |
|---|---|
| cura | 4 + 1,5 × valor (2 → 7 HP, 10 → 19, K → 24) |
| escudo | o próximo ataque recebido causa 60% do dano (2-6), 50% (7-10), 35% (J-K); não acumula, fica o melhor |
| energia | +1 (2-6), +2 (7-10), +3 (J-K) |
| compra extra | 1 carta (2-8), 2 cartas (9-K); a mão vai até 7 |

## Ases (cartas especiais, um por naipe em todo baralho, custo 3)

| Ás | Efeito |
|---|---|
| ♠ Espelho | o ataque que o adversário jogou volta para a caixa DELE. Sem nada para refletir, manda um eco (ataque de espadas força 7). Dois espelhos = dois ecos. |
| ♦ Anular | cancela a carta do adversário inteira (ataque, suporte e especial) e manda um ataque leve de ouros (força 5). |
| ♣ Roubo | rouba 1 carta sorteada da mão do adversário (passa a ser sua) e manda um ataque leve de paus (força 5). |
| ♥ Segunda chance | cura 25% do HP máximo e, nesta rodada, o HP não passa de 1. Não manda ataque. |

## Baralhos

HP de `data/personagens.js` quando o personagem existe lá (Kris 90, Susie 110); senão, o HP de reserva do baralho.

| Personagem | Papel | HP | Cartas | ♠ | ♥ | ♦ | ♣ | Mais fortes (J/Q/K) |
|---|---|---|---|---|---|---|---|---|
| Kris | equilibrado, puxado para controle | 90 | 19 | 5 | 4 | 6 | 4 | K♠ Lâmina Determinada, J♦ Formação, Q♦ Controle da Alma |
| Susie | força bruta | 110 | 19 | 8 | 3 | 4 | 4 | Q♠ Rude Buster, K♠ Machado Maluco, J♦ Pressão, J♣ Dinamite |
| Ralsei | suporte | 80 | 19 | 3 | 8 | 4 | 4 | J♦ Feitiço de Sono, Q♥ Pacify, K♥ Oração Maior |
| Noelle | suporte gélido | 85 | 19 | 4 | 7 | 4 | 4 | Q♠ Nevasca, K♦ Inverno Eterno, J♣ Avalanche, J♥ Anjo da Neve |
| Berdly | controle | 90 | 19 | 4 | 4 | 7 | 4 | Q♦ QI Elevado, K♦ Vendaval Supremo, J♣ Ciclone |
| Dess | ataque | 100 | 19 | 7 | 3 | 4 | 5 | J♠ Solo de Guitarra, K♠ Show de Rock, Q♦ Feedback, Q♣ Palco Explosivo |
| Asriel | equilibrado, cheio de figuras | 95 | 20 | 5 | 5 | 5 | 5 | J/Q/K de todos os naipes (12 figuras) |

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

Todas as cartas dos 7 personagens (134) foram rodadas na batalha co-op com `testarAtaque`, com o ritmo e o tema de cada carta: 0 avisos `[rota de fuga]` ou `[telegrafo]`. As figuras (J/Q/K) também passaram com o aperto do co-op por cima (velocidade ×1,15, densidade ×1,2).
