# Bonus rounds do PvP (visual)

Regras puras (qual rodada é bônus, sorteio, cartas malucas, armas do duelo):
`src/game/pvp/bonus.js`. Esta pasta tem o que aparece na tela.

```
pvp/bonus/
  anuncio.js          roleta "BONUS ROUND!" que sorteia o evento na frente de todo mundo
                      (depois da escolha das cartas; música abaixa e rola o som de cassino)
  eventos/index.js    EFEITOS = { explosoes, festa, pontaCabeca, apagao, gravidade, trocado }
  eventos/<id>.js     um evento que bagunça a ESQUIVA normal (cartas 'normal')
  Duelo.js            o evento 'duelo' (substitui arremesso + esquiva)
  botDuelo.js         a CPU do duelo
```

`malucas` não tem arquivo de efeito: a arena faz a animação de transformar a
carta na revelação (usa `transformarMalucas`/`desfazerMalucas` de bonus.js).

## Arena (PvpArena.js) -> evento de esquiva

Cada `eventos/<id>.js` exporta por padrão uma função:

```js
export default function criar(arena, { rng, rodada, aceleracao }) {
  // rng: () => número 0..1 com semente (repetível)
  return {
    comecar() {},          // as caixas já estão abertas e os ataques começando
    atualizar(delta) {},   // todo frame da esquiva (delta em ms, já com debug.acelerar)
    joy(j, joy) { return joy }, // opcional: muda o joystick {x, y} (-100..100) do lado j
    terminar() {},         // fim da esquiva (ou saída da cena): DESFAZ TUDO (objetos, câmeras, tweens, timers)
  }
}
```

O que o evento pode usar da arena:

- `arena.pistas[j]` (`pvp/Pista.js`): `caixa.limites` (Rectangle, atualizado no lugar),
  `caixa.camera` (câmera de recorte da caixa), `caixa.recortar(...objetos)` (objeto só
  aparece dentro da caixa j), `coracoes[0]` (Heart: `x`, `y`, `ativo`, `sprite`),
  `balas.criar({...})` (bala com colisão/graze/dano normais; opções em
  `entities/Bullets.js`; morre sozinha no `pista.parar()`), `atacando`, `rodando`.
- `arena.acertou(j, dano)`: dano direto no lado j (sem i-frames; prefira balas).
- `arena.coracoesTrocados = true` (CORAÇÃO TROCADO): o coração de cada jogador passa a
  valer na pista do outro (`arena.donoDaPista(j)` / `arena.pistaDe(p)`): joystick, dano,
  graze, K.O. e ♦ Q/K seguem o coração. Desligue no `terminar()`.
- `arena.ko[j]`, `arena.cpu` (índice da CPU ou null), `arena.cameras.main`,
  `arena.add`, `arena.tweens`, `arena.time` (todos do Phaser).
- `tocar(arena, nome)` (`game/audio.js`), `shake`, `flashTela`, `particulas`,
  `fogoArtificio`, `canhoesConfete`, `chuvaConfete` (`game/effects/`).
- Objeto de tela (fora das caixas): `ignorarNasCaixas(arena, obj)` (`game/recorte.js`),
  senão as câmeras das caixas também desenham ele.

Profundidades: fundo -10, caixas 1, balas 5, coração 10, cartas 20-80, HUD ~70,
banner 96. Efeito por cima de tudo: 95.

## Texturas (PNG em public/assets/sprites/bonus/, registradas em assets.js)

Sempre teste `arena.textures.exists(chave)` e tenha um plano B (forma simples).

| chave | o que é |
|---|---|
| `bonus-explosao-0` … `bonus-explosao-7` | quadros da explosão, coloridos (não pintar) |
| `bonus-alvo` | mira/alvo branca (pintar com setTint) |
| `bonus-bomba` | bomba preta com pavio aceso, colorida |
| `bonus-bola-disco` | bola de discoteca, colorida |
| `bonus-balao` | balão branco (pintar) |
| `bonus-tiro` | projétil branco (pintar) |
| `bonus-espada` | lâmina branca na horizontal, cabo à esquerda (pintar) |
| `bonus-bumerangue` | bumerangue branco (pintar) |
| `bonus-seta` | seta branca apontando para a DIREITA (pintar) |
| `bonus-selo` | logo "BONUS ROUND!" colorido |
| `bonus-holofote` | círculo branco com borda suave (luz do apagão / festa) |

## Sons (sintetizados em audio.js; `tocar(arena, nome)`)

Na roleta o anúncio chama `abaixarMusica()` / `restaurarMusica()` (audio.js).

`bonusRound`, `roleta`, `roletaFim`, `explosaoGrande`, `festa`, `virarMundo`,
`apagao`, `gravidade`, `trocar`, `maluca`, `roletaGiro`, `tiro`, `espadada`, `bumerangue`,
`pavio`, `duelo`, `trovao` (estalo + ronco ~2,5 s), `aplausos` (palmas + "uhuu", ~1,6 s:
DESVIO PERFEITO), `superAtivar` e `superCorte` (carta SUPER).

Outros recursos de audio.js usados pelos eventos:

- `somContinuo(arena, 'chuva')` -> `{ parar(ms = 400) }`: som sintetizado em loop
  (volume dos efeitos, entra e sai em fade) até chamar `parar()`. O APAGÃO liga a chuva
  no `comecar()` e para no `terminar()`; a cada relâmpago toca `trovao` 150–400 ms
  depois do clarão. Com o som desligado devolve um `parar()` vazio.
- `reforcarGrave(db = 0, ms = 400)`: realce de graves (lowshelf ~180 Hz) na música .mid.
  O MODO FESTA pede `reforcarGrave(9)` no começo e `reforcarGrave(0)` ao encerrar
  (fica valendo até alguém pedir 0: sempre desfaça no `terminar()`).
- `tocarMusicaEspecial(arena, nome)` / `voltarMusicaNormal(arena)`: música da carta
  SUPER (pausa a de batalha e volta de onde parou; ver public/assets/musicas/LEIA-ME.txt).
