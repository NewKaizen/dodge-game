// As REGRAS do DUELO (bonus round) sem Phaser: a caixa, os tempos e as armas. O Duelo.js (a cena) e
// o bot do JOGAR RÁPIDO (server/bots/duelo.js, que luta pelo servidor) usam os mesmos números.
import { CENTRO_X } from '../../constants.js'

export const DUELO = {
  duracaoMs: 15000, // tempo de luta (encurta com a morte súbita, até duracaoMinMs)
  duracaoMinMs: 9000,
  caixa: { x: CENTRO_X, y: 200, largura: 430, altura: 228 }, // dentro de y 74..334
  borda: 4,
  invencivelMs: 700,
  fimMs: 900, // depois de um K.O. a luta ainda corre isso (dá para os dois caírem)
  hitbox: 5, // raio do coração para os golpes do duelo (um pouco maior que CORACAO.hitbox: só o miolo leva dano)
  bufferMs: 160, // A apertado um pouco antes da recarga acabar ainda sai
  contagemMs: 520,
}

// Cada arma. `*Extra` é o que a força 1 (carta mais forte) soma.
//   tiro        projétil reto e rápido; recarga curta; dano pequeno; mira com
//               `antecipa` do movimento do outro (0 = no ponto onde ele está)
//   espada      arco de `arco` graus na frente; preparo curto (telegrafa), depois o golpe;
//               o golpe também DESTRÓI tiros do inimigo e rebate o bumerangue;
//               quem golpeia anda a `lentidao` da velocidade durante o golpe e o
//               acerto empurra o outro `empurrao` px (dá tempo de fugir)
//   bumerangue  vai até o outro (no máximo `distancia`), desacelerando, e volta
//               perseguindo o dono; acerta uma vez na ida e uma na volta;
//               recarga = até voltar (mín. recargaMs)
//   explosao    `bombas` em leque (a do meio cai onde o outro vai estar, com
//               `antecipa` do movimento dele, até `distancia`;
//               as outras a `leque` px dos lados); pavio piscando; cada uma
//               explode em `raio` e solta `estilhacos` em volta (cada um causa
//               `fatorEstilhaco` do dano; a espada quebra). Não machuca o dono.
export const ARMAS_DUELO = {
  tiro: { nome: 'TIRO', recargaMs: 260, velocidade: 300, velocidadeExtra: 90, raio: 5, antecipa: 0.6 },
  espada: { nome: 'ESPADA', recargaMs: 650, alcance: 36, alcanceExtra: 12, arco: 120, preparoMs: 90, golpeMs: 150, lentidao: 0.45, empurrao: 26 },
  bumerangue: { nome: 'BUMERANGUE', recargaMs: 500, distancia: 200, distanciaExtra: 60, velocidade: 400, raio: 8, vidaMaxMs: 3500 },
  explosao: { nome: 'EXPLOSÃO', recargaMs: 900, distancia: 260, vooMs: 280, pavioMs: 600, raio: 50, raioExtra: 10, explosaoMs: 420, bombas: 3, leque: 52, antecipa: 0.7, estilhacos: 5, velocidadeEstilhaco: 190, fatorEstilhaco: 0.6 },
}
