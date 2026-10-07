# Dodge

Jogo de esquiva estilo Deltarune/Undertale com cartas, feito com Svelte + Phaser 4. Dois modos:

- **CO-OP**: a dupla (ou 1 jogador + CPU aliada) contra um chefe que também joga cartas. Regras em [docs/coop-cartas.md](docs/coop-cartas.md).
- **PVP**: um contra o outro (ou contra a CPU). Regras em [docs/pvp-regras.md](docs/pvp-regras.md).

Controle: joystick pela porta serial ([docs/protocolo-serial.md](docs/protocolo-serial.md)) ou o simulador de teclado da página.

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # regras do PvP, do CO-OP e fichas do Grimório (node --test)
npm run build
```

- Ataques e músicas: [docs/ataques.md](docs/ataques.md).
- Arte e sons gerados por script: `scripts/` (Python + Pillow).

## Grimório (CARTAS no menu)

Tela para estudar as cartas: **Menu → CARTAS** (`src/game/scenes/Grimorio.js`).

- Em cima, as páginas: os 7 personagens (o baralho vale no PvP e no CO-OP) e os 4 chefes do CO-OP. **↑/↓** troca de página.
- Embaixo, todas as cartas da página num leque, por naipe (no chefe, por fase), com o SUPER no fim. **←/→** escolhe a carta (segure para correr).
- A carta em foco aparece grande, com custo, dano por bala, balas mais rápidas (♦) e se inverte os controles, mais o texto do **PvP** e o do **CO-OP** (no chefe: o ataque por extenso e como responder a ele).
- À direita, a **prévia**: a mesma caixa da arena roda o ataque da carta em loop, com a CPU desviando e o placar de acertos e grazes. **A** passa o coração para você (A ou B devolve para a CPU). O Ás de copas não manda ataque, então só tem a descrição.
- **B** volta ao menu. A tela lembra a página e a carta de onde você saiu.

Textos e prévias saem de `src/game/grimorio/fichas.js` (lógica pura, testada em `src/game/grimorio/__tests__/`).
