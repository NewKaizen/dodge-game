# Dodge

Jogo de esquiva estilo Deltarune/Undertale com cartas, feito com Svelte + Phaser 4. Dois modos:

- **CO-OP**: a dupla (ou 1 jogador + CPU aliada) contra um chefe que também joga cartas. Regras em [docs/coop-cartas.md](docs/coop-cartas.md).
- **PVP**: um contra o outro (ou contra a CPU). Regras em [docs/pvp-regras.md](docs/pvp-regras.md).

Controle: joystick pela porta serial ([docs/protocolo-serial.md](docs/protocolo-serial.md)) ou o simulador de teclado da página.

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # regras do PvP e do CO-OP (node --test)
npm run build
```

- Ataques e músicas: [docs/ataques.md](docs/ataques.md).
- Arte e sons gerados por script: `scripts/` (Python + Pillow).
