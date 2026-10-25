# Dodge

Jogo de esquiva estilo Deltarune/Undertale com cartas, feito com Svelte + Phaser 4. Dois modos:

- **CO-OP**: a dupla (ou 1 jogador + CPU aliada) contra um chefe que também joga cartas. Regras em [docs/coop-cartas.md](docs/coop-cartas.md).
- **PVP**: um contra o outro (ou contra a CPU). Regras em [docs/pvp-regras.md](docs/pvp-regras.md).
- **ONLINE**: os dois modos contra (ou com) um amigo pela internet: nome de usuário, sala com código, chat e pronto. Os dois modos rodam no PC de cada um ([docs/rede-pvp.md](docs/rede-pvp.md)). Como subir o servidor em [docs/online.md](docs/online.md).
- **LAN**: o mesmo lobby com o outro jogador em outro PC da mesma rede (salas achadas sozinhas). Como ligar em [docs/lan.md](docs/lan.md).

Controle: joystick pela porta serial ([docs/protocolo-serial.md](docs/protocolo-serial.md)) ou o simulador de teclado da página.

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # regras do PvP, do CO-OP, fichas do Guia e lobby LAN (node --test)
npm run build
npm run lan     # compila e serve o jogo para a rede (modo LAN): http://<ip>:5180
npm run online  # compila e liga o servidor ONLINE (o que vai para a internet)
npm start       # só liga o servidor ONLINE (hospedagem: Render, Docker...)
```

- Ataques e músicas: [docs/ataques.md](docs/ataques.md).
- Arte e sons gerados por script: `scripts/` (Python + Pillow).

## Guia (GUIA no menu)

Tela para estudar o jogo: **Menu → GUIA** (`src/game/scenes/Grimorio.js`; a cena ainda se chama `Grimorio`). Duas seções, que o **↑/↓** percorre em sequência (o nome da seção acende ao lado do título): **CARTAS** e **ARENAS**.

### Cartas

- Em cima, as páginas: os 7 personagens (o baralho vale no PvP e no CO-OP) e os 4 chefes do CO-OP. **↑/↓** troca de página (depois do último chefe vêm as arenas).
- Embaixo, todas as cartas da página num leque, por naipe (no chefe, por fase), com o SUPER no fim. **←/→** escolhe a carta (segure para correr).
- A carta em foco aparece grande, com custo, dano por bala, balas mais rápidas (♦) e se inverte os controles, mais o texto do **PvP** e o do **CO-OP** (no chefe: o ataque por extenso e como responder a ele).
- À direita, a **prévia**: a mesma caixa da arena roda o ataque da carta em loop, com a CPU desviando e o placar de acertos e grazes. **A** passa o coração para você (A ou B devolve para a CPU). O Ás de copas não manda ataque, então só tem a descrição.
- **B** volta ao menu. A tela lembra a página e a carta (ou o evento) de onde você saiu.

### Arenas (as rodadas bônus de cada mapa)

- Uma página por arena do PvP (abas com o nome). O fundo da tela vira o fundo animado da arena, e a janela da direita mostra a arena (nome, descrição, música).
- Embaixo, uma ficha por rodada bônus da arena, na cor do evento: primeiro as que caem em **todas as arenas** (Duelo, Cartas Malucas), depois as **desta arena**. **←/→** escolhe.
- O evento em foco aparece à esquerda: nome (o da arena: no Jardim o Aquário vira LAGO), o que acontece com as cartas, em que outras arenas ele cai, **o que acontece** e **como se virar**.
- **A** abre a **prévia ao vivo** (`src/game/scenes/GuiaBonus.js`): a tela da arena com as duas caixas, um ataque sorteado em cada e o efeito do evento rodando em loop, com a CPU desviando. Lá **←/→** troca de evento, **A** passa a caixa da esquerda para você (A ou B devolve) e **B** volta ao Guia. Duelo e Cartas Malucas não mexem na esquiva, então só têm a descrição.

Textos e prévias saem de `src/game/grimorio/fichas.js` (cartas) e `src/game/grimorio/arenas.js` (arenas: lidas de `pvp/arenas.js` e `pvp/bonus.js`, então evento novo aparece sozinho; as dicas de "como se virar" ficam lá, uma por evento). Lógica pura, testada em `src/game/grimorio/__tests__/`.
