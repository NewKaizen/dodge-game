# Bonus rounds do PvP (visual)

Regras puras (qual rodada é bônus, sorteio, cartas malucas, armas do duelo):
`src/game/pvp/bonus.js`. Esta pasta tem o que aparece na tela.

```
pvp/bonus/
  anuncio.js          roleta "BONUS ROUND!" que sorteia o evento na frente de todo mundo
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

`bonusRound`, `roleta`, `roletaFim`, `explosaoGrande`, `festa`, `virarMundo`,
`apagao`, `gravidade`, `trocar`, `maluca`, `tiro`, `espadada`, `bumerangue`,
`pavio`, `duelo`.
