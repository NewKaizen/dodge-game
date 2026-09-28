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
