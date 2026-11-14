// PAUSA ONLINE (scenes/Pausa.js no modo online, docs/rede-pvp.md "Aba em segundo plano e pausa online"):
// o menu fica por cima da partida, que CONTINUA. Enquanto ele está aberto só as cenas dele (a Pausa e a
// Config por cima) leem o controle: os botões e o joystick não chegam à arena, e o coração dela fica
// PARADO (entrada solta), sem a arena saber de nada. Lógica pura (testada em __tests__/travaEntrada.test.js);
// quem consulta é game/controles.js.
//   travarEntrada(cenas)   -> destravar()   (só a última trava vale; destravar uma velha não solta a nova)
//   podeLer(chave)         a cena `chave` recebe botões e joystick agora?
//   entradaTravada()
let entradaSoPara = null

export function travarEntrada(cenas) {
  const trava = new Set(cenas)
  entradaSoPara = trava
  return () => {
    if (entradaSoPara === trava) entradaSoPara = null
  }
}

export const podeLer = (chave) => !entradaSoPara || entradaSoPara.has(chave)
export const entradaTravada = () => entradaSoPara !== null
