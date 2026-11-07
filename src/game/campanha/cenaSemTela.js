// Uma CENA SEM TELA (sem Phaser): todo objeto aceita qualquer chamada e devolve ele mesmo. É com ela que
// o SERVIDOR roda os ataques de verdade (attacks/ + entities/Bullets.js, que não dependem do Phaser:
// phaserPuro.js) para refazer o quadro da campanha (campanha/quadro.js). Nada aqui desenha.
function objetoSemTela() {
  const alvo = { x: 0, y: 0, scaleX: 1, scaleY: 1, alpha: 1, rotation: 0, angle: 0, width: 1, height: 1, visible: true, type: 'Nada' }
  const p = new Proxy(alvo, {
    get(o, k) {
      if (k in o) return o[k]
      if (k === 'then') return undefined
      return (...args) => {
        if (k === 'setPosition') {
          o.x = args[0]
          o.y = args[1] ?? args[0]
        }
        if (k === 'setAlpha') o.alpha = args[0]
        return p
      }
    },
    set(o, k, v) {
      o[k] = v
      return true
    },
  })
  return p
}

export function cenaSemTela() {
  const add = new Proxy({}, { get: () => () => objetoSemTela() })
  return {
    add,
    make: add,
    anims: { exists: () => true, create() {} },
    tweens: { add() {}, addCounter() {}, killTweensOf() {}, chain() {} },
    time: { delayedCall() {}, addEvent() {}, now: 0 },
    cache: { audio: { exists: () => false } },
    sound: { play() {}, add: () => objetoSemTela() },
    registry: { get: () => undefined },
    events: { on() {}, once() {}, off() {}, emit() {} },
    cameras: { main: objetoSemTela() },
    textures: { exists: () => true },
    sys: { isActive: () => true },
  }
}

