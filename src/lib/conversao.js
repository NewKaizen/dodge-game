// Contas do protocolo serial com o joystick (docs/protocolo-serial.md). Lógica
// pura, testada em Node (__tests__/conversao.test.js).
//
//   linhaVida(0, 150, 200)   '1 VIDA 150 200' (o OLED mostra HP: 150/200 e a barra)

// HP real do personagem para o OLED: inteiro, não negativo e no máximo o HP
// máximo, que precisa ser maior que zero. O Arduino calcula a % da barra.
// Com valores inválidos devolve null (não manda nada)
export function linhaVida(j, hp, hpMax) {
  const maximo = Math.round(hpMax)
  if (!(maximo > 0) || !Number.isFinite(hp)) return null
  const atual = Math.max(0, Math.min(maximo, Math.round(hp)))
  return `${j + 1} VIDA ${atual} ${maximo}`
}
