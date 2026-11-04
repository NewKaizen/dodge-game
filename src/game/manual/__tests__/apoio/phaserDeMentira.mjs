// Um Phaser de mentira, só com o que entities/Bullets.js e entities/Heart.js usam fora da tela,
// para rodar as classes REAIS no Node (__tests__/paridade.test.js). Nada aqui desenha.
const Clamp = (v, min, max) => Math.max(min, Math.min(max, v))

class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x
    this.y = y
  }
  length() {
    return Math.hypot(this.x, this.y)
  }
  normalize() {
    const m = this.length() || 1
    this.x /= m
    this.y /= m
    return this
  }
}

const Rectangle = { Contains: (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom }

export default { Math: { Clamp, Vector2 }, Geom: { Rectangle } }
