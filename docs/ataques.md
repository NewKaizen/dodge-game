# Ataques

Os ataques (as balas que caem nas caixas) ficam em `src/game/attacks/`. As cartas do PvP (`pvp/baralhos/`) e as dos chefes do CO-OP (`coop/chefes/`) montam os ataques com essa biblioteca, recebida como `A`.

## Criar um ataque

1. Copie um arquivo de `src/game/attacks/`, por exemplo `rain.js`. Mude `nome`, `padrao` (os valores padrão) e `iniciar(a, cfg)`.
2. Registre o ataque em `src/game/attacks/index.js`.
3. Use-o numa carta: `(A) => A.meuAtaque({ velocidade: 200 })`. Para combinar, use `A.juntos(...)` e `A.sequencia(...)`.

## Regras

A validação confere estas regras no console, em modo dev (`[telegrafo]`, `[rota de fuga]`):

- **Aviso antes de causar dano:** toda bala perigosa precisa de pelo menos 400 ms de aviso.
  - Por padrão, `a.bala()` já nasce parada e piscando por esse tempo.
  - Se o ataque desenhar o próprio aviso com `a.aviso(forma, depois)`, crie as balas dentro de `depois` com `jaAvisada: true`.
- **Paredes:** declare toda parede com `a.parede({ eixo, lacunas | ocupados })` e toda abertura com `a.lacuna(px)`. A lacuna mínima é 3x o coração (48 px).
- **Sorteios:** use só `a.aleatorio`, `a.inteiro` e `a.escolher`, que têm semente fixa.
- **Alvo:** use `a.alvo()`.
- **Nada de ficar parado:** todo ataque deve ameaçar um coração parado, mirando parte das balas com `a.alvo()`. Vários padrões têm a opção `mirar`.

## Ondas, respiros e caixa dinâmica

- **Onda e respiro:** todo ataque é uma onda. No início e no meio dela o relógio do ataque para (`RESPIRO` em `constants.js`: 350 ms e 450 ms), mas as balas já em voo continuam.
  - `duracao` no padrão é o tempo ativo; as pausas somam.
  - Para desligar num ataque: `rain({ respiro: { meio: 0 } })`.
- **Caixa por ataque:** `caixa: { largura, altura, x?, y? }` no padrão do ataque.
  - Antes da onda, a caixa mostra um aviso e só então muda (`CAIXA_DINAMICA`).
  - `caixa: null` desliga.
  - Em `juntos(...)`, use `comCaixa(forma, juntos(...))`.
  - As formas são pensadas para a caixa de referência `CAIXA` (240x160), e cada Pista escala para o tamanho dela.
- **Velocidade máxima das balas:** `DIFICULDADES` em `constants.js` (pela dificuldade do chefe), mais o aperto geral `DESAFIO`.

## Testar

No navegador, em modo dev, abra uma arena e rode um ataque direto numa caixa:

```js
debugJogo.set({ invencivel: true, acelerar: 2 })
const { ataques } = await import('/src/game/attacks/index.js')
coopArena.pistas[0].rodar(ataques.foice({ varridas: 2 }), { dano: 1 })
```

Para medir a dificuldade (dano que o bot de esquiva leva em cada carta, com várias sementes), com o jogo em `npm run dev`:

```sh
node scripts/balanceamento/medir.mjs depois.json supers 24      # ou cartas / tudo, e um filtro: asriel,dess ou asriel-ouros-13
node scripts/balanceamento/resumo.mjs depois.json antes.json     # tabelas (DETALHE=all lista carta por carta)
```

Os números da última rodada estão em `docs/pvp-regras.md` ("Balanceamento medido com o bot").

## Músicas (MIDI)

Solte `<nome>.mid` em `public/assets/musicas/` (veja o `LEIA-ME.txt` de lá). O jogo toca com um soundfont General MIDI (`game/midi.js`, biblioteca spessasynth_lib), em loop e com fade entre as músicas. `debugJogo.musica()` mostra o que está tocando.
