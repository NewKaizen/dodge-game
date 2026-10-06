// Personagens jogáveis (CO-OP e PvP). O sprite é a textura de mesmo id
// (arte/sprites.js); o baralho de cada um fica em pvp/baralhos/<id>.js.
//   cor   nome, faixa das cartas, barra de HP
//   hp    HP nas arenas de cartas (pvp/regras.js hpInicial)
export const PERSONAGENS = {
  kris: { nome: 'Kris', cor: 0x4aa8ff, hp: 90 },
  susie: { nome: 'Susie', cor: 0xb05cff, hp: 110 },
  ralsei: { nome: 'Ralsei', cor: 0x6be08a, hp: 80 },
  noelle: { nome: 'Noelle', cor: 0xa8eaff, hp: 85 },
  berdly: { nome: 'Berdly', cor: 0xd8f05a, hp: 95 },
  dess: { nome: 'Dess', cor: 0xff5070, hp: 100 },
  asriel: { nome: 'Asriel', cor: 0xffb03a, hp: 100 },
}
