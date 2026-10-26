// Espera `n` quadros desenhados (evento 'postrender' do Phaser) e chama fn.
// Sem Phaser: só precisa de um emissor com once/off (testado em Node, __tests__/quadros.test.js).
// Devolve a função que cancela a espera.
export function aposQuadros(eventos, n, fn, evento = 'postrender') {
  let restam = Math.max(1, Math.floor(n))
  let cancelado = false
  const tick = () => {
    if (cancelado) return
    if (--restam > 0) return eventos.once(evento, tick)
    fn()
  }
  eventos.once(evento, tick)
  return () => {
    cancelado = true
    eventos.off?.(evento, tick)
  }
}
