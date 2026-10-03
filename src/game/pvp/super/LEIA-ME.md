# Carta SUPER (visual)

Regras (custo 10, imparável, ataque de ~9 s): `src/game/pvp/cartas.js` e `regras.js`
(`SUPER`, `ehSuper`, `superDoPersonagem`). Esta pasta tem o que aparece na tela.

```
pvp/super/
  anuncio.js   anunciarSuper(arena, { jogador, personagem, carta }): a cena do SUPER (~2,8 s)
  motivos.js   MOTIVOS[personagem](arena, m): a parte da animação que muda por personagem
```

A carta em si (valor 14, moldura arco-íris, estrela e "SUPER") é desenhada em
`entities/Carta.js` (`desenharSuper`).

## Anúncio

1. Tela escurece; uma faixa diagonal na cor do personagem rasga a tela vinda do
   lado de quem jogou (P1 esquerda, P2 direita), com linhas de velocidade (`superCorte`).
2. Clarão + tremor (`superAtivar`): nome do personagem, "SUPER!" e o nome da carta,
   e o motivo do personagem.
3. A faixa sai pelo outro lado e tudo some. Se a cena sair no meio, limpa e resolve.

## Motivos

| Personagem | Motivo |
|---|---|
| Kris | cortes de espada azuis cruzando a tela + a alma vermelha pulsando |
| Susie | machado gigante girando que bate e racha a tela |
| Ralsei | corações e estrelinhas verdes subindo em espiral, anel de luz |
| Noelle | flocos de neve caindo e geada nas bordas |
| Berdly | rajadas de vento vindas do lado dele e penas caindo |
| Dess | holofotes, ondas do amplificador e notas musicais quicando |
| Asriel | anéis arco-íris e três explosões de estrelas coloridas |

Tudo é desenhado com formas (Graphics) e a textura `coracao`: não depende de
glifos da fonte. Profundidades 95–99, sempre fora das caixas (`ignorarNasCaixas`).
Para um personagem novo, escreva a função em `motivos.js` e coloque em `MOTIVOS`
(sem motivo, ele ganha só faíscas na cor dele).
