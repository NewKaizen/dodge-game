// Um Phaser de mentira, só com o que entities/Bullets.js, entities/Heart.js e attacks/contexto.js usam
// fora da tela, para rodar as classes REAIS no Node (__tests__/paridade.test.js, vitrine.test.js).
// Nada aqui desenha. O sorteio (RandomDataGenerator) é determinístico pela semente, mas NÃO é o do
// Phaser: os testes conferem propriedades do ataque, nunca a posição sorteada exata.
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

// mulberry32 semeado pelo hash da semente (string)
class RandomDataGenerator {
  constructor(sementes = ['']) {
    let h = 2166136261
    for (const ch of String(sementes[0])) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
    this.s = h >>> 0
  }
  frac() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  realInRange(min, max) {
    return min + this.frac() * (max - min)
  }
  between(min, max) {
    return Math.floor(min + this.frac() * (max - min + 1))
  }
  integer() {
    return Math.floor(this.frac() * 4294967296)
  }
  pick(lista) {
    return lista[Math.floor(this.frac() * lista.length)]
  }
}

class GameObject {}
const GameObjects = { Image: GameObject, Sprite: GameObject, Text: GameObject }

export default { Math: { Clamp, Vector2, RandomDataGenerator, DegToRad: (g) => (g * Math.PI) / 180 }, Geom: { Rectangle }, GameObjects }
