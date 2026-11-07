// O pouco do Phaser que os ATAQUES e as BALAS usam (attacks/*, entities/Bullets.js), em JavaScript
// puro: assim a biblioteca de ataques roda no Node sem Phaser (o servidor da campanha simula os ataques
// reais das cartas: campanha/ataqueReal.js). Tudo aqui faz EXATAMENTE o que o Phaser faz
// (__tests__/phaserPuro.test.js confere contra o Phaser de verdade).
//
//   limitar(v, min, max)        Phaser.Math.Clamp
//   embrulharAngulo(a)          Phaser.Math.Angle.Wrap (-π..π)
//   contem(retangulo, x, y)     Phaser.Geom.Rectangle.Contains
//   new Aleatorio([semente])    Phaser.Math.RandomDataGenerator (mesma sequência para a mesma semente)
//   MISTURA_ADD                 Phaser.BlendModes.ADD
export const MISTURA_ADD = 1

export const limitar = (v, min, max) => Math.max(min, Math.min(max, v))

export function embrulharAngulo(a) {
  const min = -Math.PI
  const r = Math.PI - min
  return min + ((((a - min) % r) + r) % r)
}

export function contem(r, x, y) {
  if (r.width <= 0 || r.height <= 0) return false
  return r.x <= x && r.x + r.width >= x && r.y <= y && r.y + r.height >= y
}

// porte fiel do RandomDataGenerator do Phaser (Alea, de Johannes Baagøe)
export class Aleatorio {
  constructor(sementes) {
    this.c = 1
    this.s0 = 0
    this.s1 = 0
    this.s2 = 0
    this.n = 0
    this.signs = [-1, 1]
    if (sementes) this.sow(sementes)
  }
  rnd() {
    const t = 2091639 * this.s0 + this.c * 2.3283064365386963e-10
    this.c = t | 0
    this.s0 = this.s1
    this.s1 = this.s2
    this.s2 = t - this.c
    return this.s2
  }
  hash(dado) {
    let h
    let n = this.n
    const s = dado.toString()
    for (let i = 0; i < s.length; i++) {
      n += s.charCodeAt(i)
      h = 0.02519603282416938 * n
      n = h >>> 0
      h -= n
      h *= n
      n = h >>> 0
      h -= n
      n += h * 0x100000000
    }
    this.n = n
    return (n >>> 0) * 2.3283064365386963e-10
  }
  sow(sementes) {
    this.n = 0xefc8249d
    this.s0 = this.hash(' ')
    this.s1 = this.hash(' ')
    this.s2 = this.hash(' ')
    this.c = 1
    for (let i = 0; i < sementes.length && sementes[i] != null; i++) {
      const s = sementes[i]
      this.s0 -= this.hash(s)
      this.s0 += ~~(this.s0 < 0)
      this.s1 -= this.hash(s)
      this.s1 += ~~(this.s1 < 0)
      this.s2 -= this.hash(s)
      this.s2 += ~~(this.s2 < 0)
    }
  }
  integer() {
    return this.rnd() * 0x100000000
  }
  frac() {
    return this.rnd() + ((this.rnd() * 0x200000) | 0) * 1.1102230246251565e-16
  }
  real() {
    return this.integer() + this.frac()
  }
  integerInRange(min, max) {
    return Math.floor(this.realInRange(0, max - min + 1) + min)
  }
  between(min, max) {
    return Math.floor(this.realInRange(0, max - min + 1) + min)
  }
  realInRange(min, max) {
    return this.frac() * (max - min) + min
  }
  normal() {
    return 1 - 2 * this.frac()
  }
  pick(lista) {
    return lista[this.integerInRange(0, lista.length - 1)]
  }
  sign() {
    return this.pick(this.signs)
  }
  weightedPick(lista) {
    return lista[~~(Math.pow(this.frac(), 2) * (lista.length - 0.5) + 0.5)]
  }
  angle() {
    return this.integerInRange(-180, 180)
  }
  rotation() {
    return this.realInRange(-3.1415926, 3.1415926)
  }
  shuffle(lista) {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(this.frac() * (i + 1))
      const x = lista[j]
      lista[j] = lista[i]
      lista[i] = x
    }
    return lista
  }
}
