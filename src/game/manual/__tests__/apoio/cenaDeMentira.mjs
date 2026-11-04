// Uma cena e uma caixa de mentira: cada objeto de tela aceita qualquer chamada (setX(...) etc.) e
// devolve ele mesmo. Só para as classes reais (Balas, Heart) rodarem a lógica delas no Node.
export function objetoDeTela() {
  const alvo = { scaleX: 1, scaleY: 1, alpha: 1, rotation: 0, width: 1, height: 1, visible: true }
  const p = new Proxy(alvo, {
    get(o, k) {
      if (k in o) return o[k]
      return (...args) => {
        if (k === 'setAlpha') o.alpha = args[0]
        if (k === 'setScale') {
          o.scaleX = args[0]
          o.scaleY = args[1] ?? args[0]
        }
        return p
      }
    },
  })
  return p
}

export function cenaDeMentira() {
  const add = new Proxy({}, { get: () => () => objetoDeTela() })
  return { add, tweens: { add() {}, addCounter() {}, killTweensOf() {} }, time: { delayedCall() {} } }
}

// limites no formato do Phaser (Rectangle): left/right/top/bottom + x/y/width/height
export function caixaDeMentira({ esquerda, direita, topo, base }) {
  const limites = { left: esquerda, right: direita, top: topo, bottom: base, x: esquerda, y: topo, width: direita - esquerda, height: base - topo }
  limites.centerX = (esquerda + direita) / 2
  limites.centerY = (topo + base) / 2
  return { limites, aproximar() {}, recortar() {} }
}
