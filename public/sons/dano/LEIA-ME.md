# Sons de dano (arquivos seus)

Solte aqui um .ogg, .mp3 ou .wav curto (até ~1 s, volume normalizado) e ligue ao cosmético em
`src/game/cosmeticos/registro.js`, na lista `SONS_DANO`:

```js
{ id: 'dano-latido', nome: 'Latido de cachorro', raridade: 'comum', arquivo: 'sons/dano/latido.ogg' },
```

O arquivo SUBSTITUI o som sintetizado desse id. Ele é baixado só na primeira vez que o som toca
(enquanto isso toca a versão sintetizada). Para um som novo, ponha uma entrada nova na lista com
`arquivo` (não precisa de receita). Detalhes em `docs/cosmeticos.md`.
