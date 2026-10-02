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

| Valor | 2 a 4 | 5 a 8 | 9, 10, J | Q | K | Ás |
|---|---|---|---|---|---|---|
| Custo | 1 | 2 | 3 | 4 | 5 | 3 |

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
- `forcado`: o forcado segue a fileira do coração enquanto está parado lá dentro; a cada 3 estocadas vem a pinça (um de cada lado, vãos desencontrados).
- `rachaduras` (Chão Rachado, Dinamite, Emboscada): o chão racha passando pelo coração e solta espinhos; nas cartas fortes, estilhaços.
- `carrossel`: os anéis respiram forte, invertem o giro (piscam antes), o centro persegue o coração e atiram balas miradas.
- `caosFinal` (Caos Final, K♦ do Asriel): estrelas miradas → cruz do caos giratória → anel que colapsa no coração e explode.
- Outros: `rain`, `colunas`, `ondas`, `quicantes`, `bombas` e `anel` miram parte das balas; a `spiral` vem atrás do coração.

## Morte súbita (aceleração)

A cada 5 rodadas (rodadas 5, 10, 15, 20, 25) tudo fica 30% mais rápido, até ×2,5 na rodada 25 (`ACELERACAO` em `constants.js`): balas (velocidade e densidade), relógio da escolha (15 s → até 8 s), animações e música. O coração ganha metade do bônus para continuar dando para desviar. Aparece um aviso "VELOCIDADE ×1,3!" e o selo fica no HUD. No co-op a regra fica desligada (`ACELERACAO.coop = false`; com `true` ela vale por turno do chefe, por cima do `RITMO`).

## Bonus rounds (a cada 3 rodadas)

Nas rodadas 3, 6, 9... (`BONUS` em `pvp/bonus.js`) uma roleta sorteia um evento caótico, que nunca repete o da rodada bônus anterior. Só caos, sem prêmio: ninguém ganha nada a mais, e o dano continua valendo. Nos eventos de esquiva, as duas caixas abrem mesmo que ninguém tenha atacado.

| Evento | Cartas | O que acontece |
|---|---|---|
| Chuva de explosões | normais | bombas com mira caem nas duas caixas e explodem em área |
| Modo festa | normais | bola de discoteca, holofotes, confete e balões que estouram |
| Mundo de ponta-cabeça | normais | a tela gira 180° (os controles não, aí que mora o caos) |
| Apagão | normais | escuridão: só se enxerga em volta do coração (com relâmpagos de vez em quando) |
| Gravidade maluca | normais | uma gravidade puxa o coração e muda de lado a cada ~2 s, com aviso |
| Coração trocado | normais | cada um controla o coração do OUTRO (a CPU tenta te jogar nas balas) |
| Cartas malucas | viram outras | na revelação cada carta vira uma carta sorteada de qualquer personagem (mesmo custo). Depois da rodada o baralho volta ao normal |
| Duelo | viram armas | qualquer carta da mão vale, sem gastar energia. Uma caixa só para os dois: ♥ tiro, ♠ espada, ♦ bumerangue, ♣ explosão (recarga maior, acerta até o dono). A ataca; o valor da carta aumenta o dano. Passar dá uma arma sorteada, fraca |

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

Todas as cartas dos 7 personagens (134) foram rodadas na batalha co-op com `testarAtaque`: 0 avisos `[telegrafo]`; 1 aviso `[rota de fuga]` conhecido (Cabos Enrolados, Dess 10♣, lasers — já existia antes da revisão de 2026-10-02). As figuras (J/Q/K) também passaram com o aperto do co-op por cima (velocidade ×1,15, densidade ×1,2).
