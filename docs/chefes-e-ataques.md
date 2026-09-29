# Chefes, ataques e itens

Tudo que é conteúdo fica em `src/game/data/` e `src/game/attacks/`. Os números de balanceamento ficam no arquivo de cada chefe ou em `src/game/constants.js`.

## Criar um chefe

1. Copie `src/game/data/chefes/king.js` para `src/game/data/chefes/<id>.js` e ajuste:
   - **Números:** `hp`, `defesa` e `danoBala` (dano de cada bala antes da defesa do personagem).
   - **Dificuldade:** `dificuldade`, com o valor `facil`, `medio` ou `dificil`. Ela define a velocidade máxima das balas.
   - **ACTs:** `acts`, uma lista de `{ nome, custoTP?, executar(ctx) }`. O `ctx` está documentado em `Battle.contextoAcao()`: `ctx.mercy`, `ctx.texto`, `ctx.proximoAtaque`, `ctx.agressividade` etc.
   - **Condição e texto do SPARE:** `podePoupar(chefe)` e `textoNaoPoupa(chefe)`.
   - **Fases:** `fases`. Cada fase tem:
     - `hp`: a fase vale quando HP/HP máximo for menor ou igual a esse valor;
     - `entrada`: a fala ao entrar na fase;
     - `falas` e `flavor`;
     - `ataques`: um por turno, em ordem.
   - **Inventário inicial:** `inventario`, no formato `{ idDoItem: quantidade }`.
   - **Balas:** `tema`, com as formas e cores.
2. Registre o chefe em `src/game/data/chefes/index.js` (`CHEFES` e `ORDEM_CHEFES`). Ele aparece sozinho na tela de seleção.
3. O sprite e o fundo podem ser novos ou reaproveitados:
   - **Sprite:** chave de textura em `src/game/assets.js`, com o gerador em `src/game/arte/`.
   - **Fundo:** módulo em `src/game/backgrounds/`, registrado em `backgrounds/index.js`.

## Criar um ataque

1. Copie um arquivo de `src/game/attacks/`, por exemplo `rain.js`. Mude `nome`, `padrao` (os valores padrão) e `iniciar(a, cfg)`.
2. Registre o ataque em `src/game/attacks/index.js`.
3. Use-o em um chefe: `ataques.meuAtaque({ velocidade: 200 })`. Para combinar, use `ataques.juntos(...)` e `ataques.sequencia(...)`.

Regras, que a validação confere no console em modo dev:

- **Aviso antes de causar dano:** toda bala perigosa precisa de pelo menos 400 ms de aviso.
  - Por padrão, `a.bala()` já nasce parada e piscando por esse tempo.
  - Se o ataque desenhar o próprio aviso com `a.aviso(forma, depois)`, crie as balas dentro de `depois` com `jaAvisada: true`.
- **Paredes:** declare toda parede com `a.parede({ eixo, lacunas | ocupados })` e toda abertura com `a.lacuna(px)`. A lacuna mínima é 3x o coração (48 px).
- **Sorteios:** use só `a.aleatorio`, `a.inteiro` e `a.escolher`, que têm semente fixa.
- **Alvos:** use `a.alvo()`, que alterna entre os corações quando há 2 jogadores.

Para testar no console do navegador, durante a batalha e na fase de menu:

```js
testarAtaque(ataques.foice({ varridas: 2 }))
listarAtaques()
testarAtaque(ataquesDoChefe()[0].ataque)   // ataques configurados do chefe atual
debugJogo.set({ invencivel: true, acelerar: 2 })
```

## Criar um item

Adicione uma entrada em `src/game/data/itens.js`: `{ nome, descricao, alvo: 'aliado' | 'party', usar(ctx) }`. Depois coloque o item no `inventario` de algum chefe.

## Ajustar a dificuldade

- **Velocidade máxima das balas por dificuldade:** `DIFICULDADES` em `constants.js`.
- **Por chefe:** `hp`, `defesa`, `danoBala` e as configurações de cada ataque nas `fases`.
- **Regras gerais**, todas em `constants.js`:
  - `ATAQUE`: aviso mínimo, respiro e lacuna mínima;
  - `TP`, `DEFEND` e `FIGHT`;
  - `CORACAO`: hitbox e graze;
  - `RITMO`: limite dos ACTs que mudam a agressividade.

## Trocar arte e som

Todos os assets estão listados em `src/game/assets.js`. Um valor `null` significa que o asset é gerado por código. Para usar um arquivo seu, coloque o caminho relativo a `public/`.

## Ondas, respiros e caixa dinâmica

- **Onda e respiro**: todo ataque é uma onda. No início e no meio dela o relógio do ataque para (`RESPIRO` em `constants.js`, 350ms e 450ms); balas já em voo continuam. `duracao` no padrão é o tempo ativo; as pausas somam. Desligar num ataque: `rain({ respiro: { meio: 0 } })`.
- **Caixa por ataque**: `caixa: { largura, altura, x?, y? }` no padrão do ataque. Antes da onda a caixa mostra um aviso (faixas vermelhas) e só então muda (`CAIXA_DINAMICA`). `caixa: null` desliga. Em `juntos(...)` use `comCaixa(forma, juntos(...))`.
- **Modificadores do próximo ataque**: `ctx.proximoAtaque({ velocidade, densidade, duracao })` (usado por ACTs; DEFEND aplica `DEFEND.proximoAtaque`). Vale só para o próximo ataque, é multiplicativo e fica limitado entre `RITMO.proximoMinimo` e `RITMO.maximo`. `ctx.ritmo` continua sendo o ajuste permanente.
- **Impacto**: dano no coração faz tremor de câmera + flash vermelho + som (`IMPACTO`), proporcionais ao dano; dano no inimigo mostra número flutuante e balanço.
- **Depuração**: `debugJogo.batalha()` devolve o estado da batalha (caixa, modificadores, ataque atual).

## Dificuldade, dano e TP

- **Aperto geral**: `DESAFIO` em `constants.js` multiplica velocidade, densidade e dano de TODOS os chefes (tudo 1 = jogo original).
- **Aperto por chefe**: `desafio: { velocidade, densidade }` no arquivo do chefe, em cima do `DESAFIO`.
- **Dano com 1 jogador**: o coração representa a party inteira; cada acerto sorteia quem apanha (com peso: evita repetir quem acabou de apanhar e puxa para quem tem mais HP). Ver `Battle.escolherAlvo`.
- **TP no FIGHT**: golpe que acerta dá `TP.porGolpe` (metade se foi fraco, `+TP.critico` se crítico).

## Ações com TP dos personagens

Ficam em `src/game/data/personagens.js` (`act.lista`, lista completa no comentário do topo). O TP é reservado quando a ação é escolhida e gasto no começo do turno; ação mais cara que o TP disponível aparece cinza e o menu recusa. A lista do menu rola (setas ▲/▼) quando não cabe.

| Ação | Quem | TP | Efeito |
|---|---|---|---|
| Palavra Amiga | Kris | 20% | +20% MERCY e chefe 5% mais lento (permanente) |
| Plano de Ataque | Kris | 35% | próximo FIGHT de cada um da party: dano x1,6 |
| Formação Escudo | Kris | 60% | próximo turno do chefe: party leva metade do dano; ataque com 15% menos balas |
| Rugido Selvagem | Susie | 25% | próximo ataque 25% mais lento e com a onda mais curta |
| Machado Maluco | Susie | 40% | dano sorteado: 20% → 4, 60% → 20-50, 20% → 80-100 |
| Abraço de Grupo | Susie | 80% | cura 35% do HP máximo de todos (levanta quem caiu) |

Efeitos disponíveis no `ctx` para criar outras:

- `ctx.fortalecer(membro, fator)`: o próximo FIGHT desse membro causa dano x fator. Não acumula (fica o maior) e é gasto no primeiro golpe que acerta (MISS não gasta). Mostra "FORÇA +N%" ao aplicar e "FORÇA xN" ao gastar.
- `ctx.proteger(membro, fator)`: no próximo turno do chefe, o dano que o membro leva é multiplicado por fator (depois do DEFEND). Acaba no fim desse turno, com a etiqueta "O ESCUDO SE DESFEZ".
- `ctx.sortear(min, max)`: inteiro aleatório, para ações caóticas.

## Coronel Caçamba (4º chefe, EXTREMO)

Ataques próprios: `caminhonete` (faixas com farol + buzina, atravessa rápido e volta de ré), `brasas` (fogo que sobe balançando e estoura) e `forcado` (três dentes que entram pela lateral; fuja pelo vão). Arte em `arte/sprites.js` (`coronel`, `caminhonete`), fundo em `backgrounds/coronel.js`.

## Músicas (MIDI)

Solte `<nome>.mid` em `public/assets/musicas/` (selecao, king, queen, jevil, coronel, vitoria). O jogo toca com soundfont General MIDI (`game/midi.js`, lib spessasynth_lib) em loop, com fade entre músicas. `debugJogo.musica()` mostra o que está tocando. Depois de atualizar o projeto rode `npm install` (dependência nova).
