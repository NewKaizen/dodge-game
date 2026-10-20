// Contas do protocolo serial com o joystick (docs/protocolo-serial.md). Lógica
// pura, testada em Node (__tests__/conversao.test.js).
//
//   eixoDoAdc(700)            leitura analógica 0–1023 do Arduino -> -100..100 do jogo
//   porcentagemVida(40, 80)   50 (o VIDA que vai para o OLED)

export const ADC_MAX = 1023
export const ADC_CENTRO = 512
// Folga em volta do centro: o analógico parado nunca lê 512 certinho e o
// coração não pode ficar andando sozinho
export const ZONA_MORTA = 40
// Se o joystick estiver montado ao contrário (empurrar para cima desce o
// coração), é só trocar aqui
export const INVERTER = { x: false, y: false }

export function eixoDoAdc(valor, invertido = false) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return 0
  const desvio = Math.max(0, Math.min(ADC_MAX, n)) - ADC_CENTRO
  if (Math.abs(desvio) <= ZONA_MORTA) return 0
  const alcance = (desvio > 0 ? ADC_MAX - ADC_CENTRO : ADC_CENTRO) - ZONA_MORTA
  const eixo = Math.round((Math.sign(desvio) * (Math.abs(desvio) - ZONA_MORTA) * 100) / alcance)
  return invertido ? -eixo : eixo
}

// Vida atual em % inteiro (0–100) da vida máxima do personagem; o Arduino não
// sabe a vida máxima, só desenha a barra. Vivo nunca aparece com 0 (1 de 300
// arredondaria para barra vazia)
export function porcentagemVida(hp, hpMax) {
  if (!(hpMax > 0) || !Number.isFinite(hp) || hp <= 0) return 0
  return Math.max(1, Math.min(100, Math.round((hp / hpMax) * 100)))
}
