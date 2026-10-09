# Bonus rounds do PvP (visual)

Regras puras (qual rodada é bônus, sorteio, cartas malucas, armas do duelo):
`src/game/pvp/bonus.js`. Esta pasta tem o que aparece na tela.

```
pvp/bonus/
  anuncio.js          roleta "BONUS ROUND!" que sorteia o evento na frente de todo mundo
                      (depois da escolha das cartas; música abaixa e rola o som de cassino)
  eventos/index.js    EFEITOS = { explosoes, festa, pontaCabeca, apagao, gravidade, trocado,
                                 pcEscola, aquario, cogumelo, estatua, gelo, terremoto,
                                 encolhendo, leoes, lancas, bigas, brasas, polegar, rede }
  eventos/arteColiseu.js  arte (texturas de canvas) e utilidades dos eventos do COLISEU
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
    joy(j, joy) { return joy }, // opcional: muda o joystick {x, y} (-100..100) da pista j
    passo(j, delta, joy) { return delta }, // opcional: o relógio da pista j neste frame (ver abaixo)
    terminar() {},         // fim da esquiva (ou saída da cena): DESFAZ TUDO (objetos, câmeras, filtros,
                           // tweens, timers, música, pista.congelada, tamanho do coração)
  }
}
```

Ordem em cada frame (PvpArena.update): para cada pista j, `joy(j, joy)` -> `passo(j, delta, joy)`
-> `pista.atualizar(passo, joy)`; depois `atualizar(delta)` uma vez. Ou seja: em `atualizar`
os corações já andaram neste frame (dá para medir quanto cada um se mexeu).

### Mexendo no tempo de uma pista

Dois jeitos, para coisas diferentes:

- **`passo(j, delta, joy)`**: quanto tempo a pista j anda neste frame, TUDO junto (coração,
  caixa, ataque e balas). `delta` = normal; `delta * 0.72` = câmera lenta (AQUÁRIO);
  `0` = a pista inteira congela, coração junto; devolver o tempo acumulado de uma vez = anda
  aos trancos (PC DA ESCOLA). `Pista.atualizar` divide passos grandes em pedaços de ~20 ms,
  então nenhuma bala atravessa o coração.
- **`pista.congelada = true`**: só o CORAÇÃO anda. Caixa, ataque (`ctx`: timers, padrões,
  a duração do ataque) e balas ficam parados no lugar, mas as balas paradas continuam
  acertando e dando graze (`Balas.colidir`). Quem liga desliga (no `terminar()` também). Ex.:
  DANÇA DA ESTÁTUA. Enfeites que o ataque anima com `cena.tweens` continuam se mexendo.

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
- `pista.caixa.camera.filters.internal.addBlocky({ size })` (filtros de câmera do Phaser 4:
  `addPixelate`, `addBlocky`, `addBlur`...; tire com `filters.internal.remove(filtro)`). O canvas
  desenha na resolução real da tela: tamanhos em pixel do filtro são vezes `RES.escala`
  (`game/resolucao.js`). Ex.: PC DA ESCOLA.
- `coracao.setTamanho(fator)` (Heart): sprite, hitbox, graze e margem da caixa juntos
  (1 = normal). Ex.: COGUMELO MALUCO. Volte para 1 no `terminar()`.
- `arena.estado.jogadores[j].hpMax` (dano proporcional ao HP, ex.: 30% na DANÇA DA ESTÁTUA).
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
DESVIO PERFEITO), `superAtivar` e `superCorte` (carta SUPER), `pcLigando` e `travou` (PC DA
ESCOLA), `tchibum` e `bolha` (AQUÁRIO), `crescer` e `encolher` (COGUMELO), `pego` (alarme da
DANÇA DA ESTÁTUA), `congelar` e `patins` (PISTA DE GELO), `ronco` e `terremoto` (TERREMOTO), `muralha` (ARENA ENCOLHENDO), `rugido` (LEÕES), `assobio` e `cravar`
(CHUVA DE LANÇAS; `cravar` também é o baque das paredes e da rede no chão), `galope` e `relincho` (BIGAS),
`chiado` e `queimou` (BRASAS), `polegarCima` e `polegarBaixo` (POLEGAR), `rede`, `redePegou` e `redeSoltou` (REDE).

Outros recursos de audio.js usados pelos eventos:

- `somContinuo(arena, 'chuva')` -> `{ parar(ms = 400) }`: som sintetizado em loop
  (volume dos efeitos, entra e sai em fade) até chamar `parar()`. O APAGÃO liga a chuva
  no `comecar()` e para no `terminar()`; a cada relâmpago toca `trovao` 150–400 ms
  depois do clarão. Com o som desligado devolve um `parar()` vazio.
- `reforcarGrave(db = 0, ms = 400)`: realce de graves (lowshelf ~180 Hz) na música .mid.
  O MODO FESTA pede `reforcarGrave(9)` no começo e `reforcarGrave(0)` ao encerrar
  (fica valendo até alguém pedir 0: sempre desfaça no `terminar()`).
- `tomMusica(semitons)`: tom da música .mid sem mudar o andamento (keyShift de sistema do
  sintetizador: nenhum reset do .mid desfaz). O COGUMELO pede -6 (gigante) / +6 (mini) e 0 no
  fim. Cada troca corta as notas que estavam soando. Fica valendo até alguém pedir 0.
- `cortarMusica(true/false)`: corte SECO da música (~12 ms, sem fade perceptível) e a volta
  do mesmo ponto. Não briga com o pause do menu (pausar/retomar no meio de um corte não traz a
  música de volta) e vale também para a próxima música: sempre peça `false` no `terminar()`.
  `debugJogo.musica()` mostra `cortada`, `pausada` e `tom`.
- `tocarMusicaEspecial(arena, nome)` / `voltarMusicaNormal(arena)`: música da carta
  SUPER (pausa a de batalha e volta de onde parou; ver public/assets/musicas/LEIA-ME.txt).

## Eventos de esquiva

| id | o que faz | como |
|---|---|---|
| `explosoes` | bombas com mira caem e explodem em área | balas + texturas `bonus-explosao-*` |
| `festa` | bola de discoteca, holofotes, confete, balões | `reforcarGrave(9)` |
| `pontaCabeca` | a tela gira 180° | câmeras |
| `apagao` | escuro com um círculo de luz em volta do coração, relâmpagos | `somContinuo('chuva')` |
| `gravidade` | uma força puxa o coração e troca de lado | `joy` |
| `trocado` | os corações trocam de caixa | `arena.coracoesTrocados` |
| `pcEscola` | caixas pixeladas (filtro Blocky na câmera da caixa), 6–14 FPS aos trancos, travadas com "Não está respondendo" | `passo` + filtro |
| `aquario` | câmera lenta, o coração boia (segure ↓ para afundar), inércia, peixes e bolhas | `passo` (×0,72) + `joy` |
| `cogumelo` | coração GIGANTE (2,3×) / MINI (0,5×) alternando, a música desce/sobe de tom junto | `setTamanho` + `tomMusica` |
| `estatua` | DANÇA DA ESTÁTUA: a música para do nada (`cortarMusica`), as pistas congelam (`pista.congelada`) e um holofote de vigia PERSEGUE o coração em cada caixa (mais lento que ele); quem se mexer sob a luz é PEGO (30% do HP máximo, uma vez por parada; `arena.acertou`). A CPU obedece em ~80% das paradas. `efeitoBonus.estadoDebug()` mostra a parada e as luzes | `cortarMusica` + `congelada` + `joy` (CPU) |
| `gelo` | o coração desliza (inércia no joystick), flocos e reflexos | `joy` |
| `terremoto` | ronco de aviso, tremor, empurrão no coração e pedras caindo (balas) | `joy` + `balas.criar` |
| `encolhendo` | ARENA ENCOLHENDO: paliçadas entram pelas bordas (aviso vermelho com setas), seguram e abrem; só empurram, sempre sobra um miolo livre. O coração usa um retângulo interno como limite (`coracao.caixa` vira `{ limites: interno }` durante o evento; volta no `terminar()`). A CPU é afastada das paredes no `joy` | `coracao.caixa` + `joy` (CPU) |
| `leoes` | LEÕES!: rugido + faixa piscando, o leão atravessa (bala retangular com `aviso`, sprite próprio); no trecho do SALTO a bala fica `inofensiva` (buraco na faixa) | `balas.criar` |
| `lancas` | CHUVA DE LANÇAS: sombra crescendo avisa, a lança crava (ponta = bala redonda curta) e a haste fica como obstáculo um tempo | `balas.criar` |
| `bigas` | CORRIDA DE BIGAS: 3 faixas de sentidos alternados, bigas (balas retangulares) avisadas por poeira; nunca todas as faixas | `balas.criar` |
| `brasas` | CHÃO EM BRASAS: parado esquenta a barra de CALOR, cheia queima (dano pequeno, `arena.acertou`); a CPU dá voltinhas | `joy` (CPU) |
| `polegar` | POLEGAR DO IMPERADOR: roleta de regras com o busto e o polegar; invertido (`joy`), rápido/lento (`pista.fatorCoracao`), mini/gigante (`setTamanho`), caixa escura (véu recortado seguindo o coração). `efeitoBonus.forcarRegra(id)` nos testes | `joy` + `fatorCoracao` + `setTamanho` |
| `rede` | REDE DO RECIÁRIO: gladiador entre as caixas joga a rede (círculo avisado); preso = joystick ×0,16 até sacudir as setas 5× (ou 1,8 s); sem dano. A CPU sacode sozinha | `joy` |
