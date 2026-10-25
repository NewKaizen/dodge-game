import { LARGURA, ALTURA } from '../constants.js'

// Estrada de terra à noite: céu com estrelas, cerca passando em parallax,
// faixa tracejada correndo e poeira levantando. Na fase final a estrada corre
// mais rápido (estado.velocidade).
export default function coronel(scene, objetos) {
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }
  add(scene.add.rectangle(0, 0, LARGURA, ALTURA, 0x0b0a1a).setOrigin(0))
  add(scene.add.rectangle(0, ALTURA * 0.55, LARGURA, ALTURA * 0.45, 0x241a12).setOrigin(0))
  add(scene.add.rectangle(0, ALTURA * 0.55, LARGURA, 3, 0x4a3420).setOrigin(0))

  const estrelas = Array.from({ length: 54 }, (_, i) =>
    add(scene.add.rectangle((i * 151) % LARGURA, (i * 37) % (ALTURA * 0.5), 2, 2, 0xfff4d0)),
  )
  const lua = add(scene.add.circle(Math.round(LARGURA * 0.27), 42, 18, 0xfff0b8).setAlpha(0.85))

  // cerca (longe) e tracejado da estrada (perto)
  const VOLTA = LARGURA + 80 // as cercas e os traços correm numa volta desse tamanho (menos 0: sem emendas)
  const postes = Array.from({ length: 16 }, (_, i) => ({
    obj: add(scene.add.rectangle(0, ALTURA * 0.55 - 14, 5, 28, 0x5a3e24)),
    x: (i * VOLTA) / 16,
  }))
  const arame = add(scene.add.rectangle(0, ALTURA * 0.55 - 20, LARGURA, 2, 0x6a5238).setOrigin(0))
  const traços = Array.from({ length: 12 }, (_, i) => ({
    obj: add(scene.add.rectangle(0, ALTURA * 0.8, 40, 6, 0xe8c050).setAlpha(0.7)),
    x: (i * VOLTA) / 12,
  }))
  const poeira = Array.from({ length: 32 }, (_, i) => ({
    obj: add(scene.add.circle(0, 0, 2 + (i % 3), 0x8a6a48).setAlpha(0.3)),
    x: (i * 83) % LARGURA,
    y: ALTURA * 0.6 + ((i * 29) % (ALTURA * 0.38)),
    v: 30 + (i % 4) * 15,
  }))

  const envolver = (x) => ((x % VOLTA) + VOLTA) % VOLTA - 40

  return {
    atualizar(dt, estado) {
      const t = estado.tempo / 1000
      const vel = 1 + estado.fase * 0.5
      for (const p of postes) p.obj.setX(envolver(p.x - t * 40 * vel))
      arame.setAlpha(0.8)
      for (const q of traços) q.obj.setX(envolver(q.x - t * 160 * vel))
      for (const d of poeira) {
        d.x -= (d.v * vel * dt) / 1000
        if (d.x < -6) d.x = LARGURA + 6
        d.obj.setPosition(d.x, d.y + Math.sin(t * 2 + d.v) * 3)
      }
      estrelas.forEach((e, i) => e.setAlpha(0.4 + 0.4 * Math.sin(t * 1.5 + i)))
      lua.setAlpha(0.8 + 0.05 * Math.sin(t))
    },
  }
}
