import Phaser from 'phaser'
import { LARGURA, ALTURA } from '../../constants.js'
import { texturasJardim, NUM_FLORES } from '../../arte/jardim.js'
import { ignorarNasCaixas } from '../../recorte.js'

// JARDIM: um jardim mágico ao entardecer sob SETE SÓIS ("Seven Suns").
// De trás para a frente:
//   céu em faixas (pixel art) do violeta ao dourado, com estrelinhas no alto;
//   os sete sóis num arco suave por cima das caixas (giram e pulsam devagar,
//   cada um no seu ritmo); nuvens rosadas passando;
//   três camadas de colinas (a câmera "respira" de um lado para o outro bem
//   devagar: as camadas da frente andam mais = profundidade);
//   cerquinha, arbustos e girassóis nas laterais (olhando para os sóis);
//   dois canteiros de flores que balançam com o vento (uma onda de vento
//   atravessa da esquerda para a direita, e as pétalas e o pólen vão junto);
//   borboletas voando em curvas e vaga-lumes começando a acender.
// Nada forte atrás das caixas e das cartas: os brilhos ficam na faixa de cima
// (entre o HUD e as caixas), nas laterais e perto do chão, e a arena ainda
// põe o véu da moldura por cima.

const CEU = [0x24173f, 0x2f1a4a, 0x3d1d54, 0x4f2259, 0x63285c, 0x7a2f5e, 0x93385e, 0xab445c, 0xc2545a, 0xd66658, 0xe57b56, 0xef9258, 0xf5aa5e, 0xf8c06a]
const HORIZONTE = 292 // onde o céu acaba atrás das colinas
// sete sóis: deslocamento x do centro, raio e cor (o do meio é o maior e mais claro)
const SOIS = [
  { dx: -292, r: 7, cor: 0xff8a7a },
  { dx: -200, r: 8, cor: 0xffa35a },
  { dx: -100, r: 9, cor: 0xffc65a },
  { dx: 0, r: 11, cor: 0xfff0a8 },
  { dx: 100, r: 9, cor: 0xffc65a },
  { dx: 200, r: 8, cor: 0xffa35a },
  { dx: 292, r: 7, cor: 0xff8a7a },
]
const ARCO = { y: 76, raio: 1060 } // arco dos sóis: topo em y, círculo enorme (curva suave)
const PARALLAX = { longe: 3, meio: 7, perto: 12, periodo: 52000 }
const MARGEM = 40 // as camadas passam da tela para o "respiro" não mostrar a borda

// cor entre a e b (p de 0 a 1)
const misturar = (a, b, p) => {
  const c = (d) => Math.round(((a >> d) & 255) + (((b >> d) & 255) - ((a >> d) & 255)) * p) << d
  return c(16) | c(8) | c(0)
}

// pseudo-aleatório fixo (o fundo é igual toda vez)
function sorteador(semente) {
  let s = semente >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export default function jardim(scene, objetos) {
  texturasJardim(scene)
  const sorte = sorteador(7)
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }

  // ---------- céu ----------
  const ceu = add(scene.add.graphics())
  const faixa = HORIZONTE / CEU.length
  CEU.forEach((cor, i) => {
    ceu.fillStyle(cor, 1)
    ceu.fillRect(0, Math.floor(i * faixa), LARGURA, Math.ceil(faixa) + 1)
  })
  ceu.fillStyle(CEU[CEU.length - 1], 1).fillRect(0, HORIZONTE, LARGURA, ALTURA - HORIZONTE)

  const estrelas = Array.from({ length: 22 }, () => {
    const e = add(scene.add.rectangle(sorte() * LARGURA, 4 + sorte() * 90, 1.5, 1.5, 0xfff2d8))
    return { e, fase: sorte() * Math.PI * 2, v: 0.6 + sorte() * 1.2 }
  })

  // ---------- sete sóis ----------
  const sois = SOIS.map((s, i) => {
    const x = LARGURA / 2 + s.dx
    const y = ARCO.y + ARCO.raio - Math.sqrt(ARCO.raio ** 2 - s.dx ** 2)
    const halo = add(scene.add.image(x, y, 'jardim-brilho').setTint(s.cor).setBlendMode(Phaser.BlendModes.ADD))
    // raios: 12 pontas (longas e curtas alternadas), desenhados uma vez e girados
    const raios = add(scene.add.graphics({ x, y }))
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2
      const comp = s.r * (k % 2 ? 1.75 : 2.35)
      const lado = 0.13
      raios.fillStyle(misturar(s.cor, 0xffffff, 0.3), k % 2 ? 0.45 : 0.6)
      raios.fillTriangle(
        Math.cos(a - lado) * s.r * 1.15, Math.sin(a - lado) * s.r * 1.15,
        Math.cos(a + lado) * s.r * 1.15, Math.sin(a + lado) * s.r * 1.15,
        Math.cos(a) * comp, Math.sin(a) * comp,
      )
    }
    // disco: borda mais escura, miolo claro e um brilhinho no canto
    const disco = add(scene.add.graphics({ x, y }))
    disco.fillStyle(misturar(s.cor, 0xc04a2a, 0.35), 1).fillCircle(0, 0, s.r)
    disco.fillStyle(s.cor, 1).fillCircle(0, 0, s.r - 1.5)
    disco.fillStyle(misturar(s.cor, 0xffffff, 0.55), 1).fillCircle(-s.r * 0.15, -s.r * 0.15, s.r * 0.55)
    disco.fillStyle(0xffffff, 0.9).fillRect(-s.r * 0.5, -s.r * 0.55, 2, 2)
    return { halo, raios, disco, x, y, r: s.r, fase: i * 0.9, giro: (i % 2 ? -1 : 1) * (0.05 + (i % 3) * 0.02) }
  })

  // ---------- nuvens ----------
  const nuvens = Array.from({ length: 5 }, (_, i) => {
    const g = add(scene.add.graphics())
    const larg = 50 + sorte() * 40
    const bolas = 4 + Math.floor(sorte() * 3)
    // sombra embaixo, lado iluminado (pelos sóis) em cima
    for (const [cor, dy, alpha] of [[0xa8506a, 3, 0.55], [0xf0a08a, 0, 0.6], [0xffd0a8, -2, 0.45]]) {
      g.fillStyle(cor, alpha)
      for (let k = 0; k < bolas; k++) {
        const fx = k / (bolas - 1) - 0.5
        g.fillEllipse(fx * larg, dy - Math.cos(fx * Math.PI) * 6 + (cor === 0xffd0a8 ? -2 : 0), larg * 0.42, 14 - Math.abs(fx) * 6)
      }
    }
    return { g, x: (i * 157 + sorte() * 60) % (LARGURA + 160) - 80, y: 128 + sorte() * 80, v: 2.5 + sorte() * 3, larg }
  })

  // ---------- colinas (três camadas) ----------
  const crista = (base, ondas, cor, borda, extra) => {
    const g = add(scene.add.graphics())
    const pontos = []
    for (let x = -MARGEM; x <= LARGURA + MARGEM; x += 6) {
      let y = base
      for (const [a, f, p] of ondas) y += a * Math.sin(x * f + p)
      pontos.push({ x, y })
    }
    g.fillStyle(cor, 1)
    g.fillPoints([...pontos, { x: LARGURA + MARGEM, y: ALTURA }, { x: -MARGEM, y: ALTURA }], true)
    // borda de cima iluminada pelo pôr do sol
    g.lineStyle(2, borda, 0.8)
    g.strokePoints(pontos)
    extra?.(g, pontos)
    return g
  }
  const alturaEm = (pontos, x) => pontos[Math.max(0, Math.min(pontos.length - 1, Math.round((x + MARGEM) / 6)))].y

  const longe = crista(268, [[10, 0.012, 0.4], [6, 0.031, 2.1], [3, 0.07, 1]], 0x8a4a72, 0xd47a7a)
  const meio = crista(300, [[9, 0.017, 1.3], [5, 0.043, 0.2]], 0x3e5a4c, 0x9a8a5a, (g, pontos) => {
    // arvorezinhas redondas no alto da colina do meio
    for (let x = 10; x < LARGURA; x += 34 + ((x * 7) % 23)) {
      const y = alturaEm(pontos, x)
      const r = 5 + ((x * 13) % 5)
      g.fillStyle(0x2a3f34, 1).fillRect(x - 1, y - 4, 2, 6)
      g.fillStyle(0x34503f, 1).fillCircle(x, y - 4 - r, r)
      g.fillStyle(0x6a7a4a, 0.7).fillCircle(x - r * 0.3, y - 5 - r * 1.3, r * 0.45)
    }
  })
  const perto = crista(334, [[5, 0.011, 2.4], [3, 0.029, 0.7]], 0x2c5232, 0x7aa05a, (g, pontos) => {
    // cerquinha de madeira clara (rosada pelo sol) logo atrás dos arbustos
    const topo = (x) => alturaEm(pontos, x) - 2
    g.fillStyle(0xd8b8a0, 1)
    for (let x = -MARGEM; x < LARGURA + MARGEM; x += 13) {
      const y = topo(x)
      g.fillRect(x, y - 15, 4, 17)
      g.fillTriangle(x, y - 15, x + 4, y - 15, x + 2, y - 18)
    }
    g.fillStyle(0xb88a7a, 1)
    for (let x = -MARGEM; x < LARGURA + MARGEM; x += 6) {
      g.fillRect(x, topo(x) - 12, 6, 2)
      g.fillRect(x, topo(x) - 5, 6, 2)
    }
    // arbustos redondos na frente da cerca
    for (let x = -20; x < LARGURA + MARGEM; x += 46 + ((x * 11) % 30)) {
      const y = topo(x) + 4
      for (const [dx, r, cor] of [[-9, 8, 0x234a2a], [8, 9, 0x234a2a], [0, 11, 0x2e5e34], [-4, 5, 0x4f8a4a], [6, 4, 0x4f8a4a]]) {
        g.fillStyle(cor, 1).fillCircle(x + dx, y - r * 0.7 - (cor === 0x4f8a4a ? 5 : 0), r)
      }
      // florzinhas no arbusto
      g.fillStyle(0xff9ad2, 1).fillRect(x - 6, y - 12, 2, 2)
      g.fillStyle(0xfff0a0, 1).fillRect(x + 5, y - 15, 2, 2)
    }
    // chão mais escuro embaixo, com tufos de grama
    g.fillStyle(0x234628, 1).fillRect(-MARGEM, 372, LARGURA + MARGEM * 2, ALTURA - 372)
    g.fillStyle(0x3a6a3a, 1)
    for (let x = -MARGEM; x < LARGURA + MARGEM; x += 9) {
      const y = 350 + ((x * 37) % 120)
      g.fillTriangle(x, y, x + 2, y - 5, x + 4, y)
    }
  })

  // ---------- canteiros ----------
  const canteiros = add(scene.add.graphics())
  for (const [x0, x1] of [[16, 304], [336, 624]]) {
    canteiros.fillStyle(0x3a2418, 1).fillRoundedRect(x0, 378, x1 - x0, 96, 10)
    canteiros.fillStyle(0x5a3a26, 1).fillRoundedRect(x0 + 3, 381, x1 - x0 - 6, 90, 8)
    // pedrinhas na borda do canteiro
    canteiros.fillStyle(0x9a8a7a, 1)
    for (let x = x0 + 6; x < x1 - 4; x += 11) canteiros.fillRoundedRect(x, 375, 8, 5, 2)
  }
  const girassois = []
  for (const [x, alto] of [[22, 1], [46, 0], [LARGURA - 22, 1], [LARGURA - 46, 0]]) {
    const img = add(scene.add.image(x, 382, 'jardim-girassol').setOrigin(0.5, 1).setScale(alto ? 3 : 2.4))
    girassois.push({ img, x, fase: x * 0.1 })
  }
  const flores = []
  for (const [x0, x1] of [[24, 300], [344, 620]]) {
    for (const [y, escala] of [[402, 2], [430, 2.2], [462, 2.4]]) {
      for (let x = x0 + 6; x < x1 - 4; x += 16 + sorte() * 8) {
        const tipo = Math.floor(sorte() * NUM_FLORES)
        const img = add(scene.add.image(x, y + sorte() * 6, `jardim-flor-${tipo}`).setOrigin(0.5, 1).setScale(escala))
        flores.push({ img, x, fase: sorte() * Math.PI * 2, amp: 3 + sorte() * 3 })
      }
    }
  }

  // ---------- vida no ar ----------
  const petalas = Array.from({ length: 28 }, (_, i) => {
    const polen = i % 3 !== 0
    const obj = polen
      ? add(scene.add.rectangle(0, 0, 2, 2, 0xfff0a0).setAlpha(0.55))
      : add(scene.add.image(0, 0, 'jardim-petala').setTint([0xff9ad2, 0xfff6e8, 0xffb0c0][i % 3]).setAlpha(0.8).setScale(1.5))
    return { obj, polen, x: sorte() * LARGURA, y: 90 + sorte() * 380, v: 6 + sorte() * 10, fase: sorte() * 10 }
  })
  const vagalumes = Array.from({ length: 16 }, () => {
    const halo = add(scene.add.image(0, 0, 'jardim-brilho').setTint(0xd8ff6a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.32))
    const ponto = add(scene.add.rectangle(0, 0, 2, 2, 0xf6ffb0))
    return { halo, ponto, x: sorte() * LARGURA, y: 300 + sorte() * 170, fase: sorte() * 20, v: 0.5 + sorte() * 0.6 }
  })
  const borboletas = Array.from({ length: 6 }, (_, i) => {
    const img = add(scene.add.image(0, 0, 'jardim-borboleta').setTint([0xffb84a, 0x8ad8ff, 0xff8ad8, 0xfff07a, 0xc8a0ff, 0xffffff][i]).setScale(1.6))
    return { img, a: 0.05 + sorte() * 0.05, b: 0.08 + sorte() * 0.06, p: sorte() * 10, q: sorte() * 10, bate: 12 + sorte() * 6 }
  })

  let ignorado = false

  return {
    atualizar(dt, estado) {
      // na arena as câmeras das caixas não precisam desenhar o fundo (a caixa é opaca)
      if (!ignorado && scene.caixasDeRecorte?.length) {
        ignorado = true
        ignorarNasCaixas(scene, objetos)
      }
      const ms = estado.tempo
      const t = ms / 1000
      const pan = Math.sin((ms / PARALLAX.periodo) * Math.PI * 2)
      longe.x = pan * PARALLAX.longe
      meio.x = pan * PARALLAX.meio
      perto.x = pan * PARALLAX.perto
      canteiros.x = pan * PARALLAX.perto
      // vento: uma onda que atravessa da esquerda para a direita, mais forte de vez em quando
      const forca = 0.65 + 0.35 * Math.sin(t * 0.37) * Math.sin(t * 0.13)
      const vento = (x) => Math.sin(t * 1.6 - x * 0.012) * forca

      for (const e of estrelas) e.e.setAlpha(0.25 + 0.35 * Math.max(0, Math.sin(t * e.v + e.fase)))
      for (const s of sois) {
        const p = Math.sin(t * 0.9 + s.fase)
        const x = s.x + pan * 1.5
        s.halo.setPosition(x, s.y).setScale((s.r * 5.2 * (1 + p * 0.08)) / 64).setAlpha(0.32 + p * 0.06)
        s.raios.setPosition(x, s.y).setRotation(t * s.giro).setScale(1 + p * 0.1)
        s.disco.setPosition(x, s.y)
      }
      for (const n of nuvens) {
        n.x += (n.v * dt) / 1000
        if (n.x - n.larg > LARGURA + 20) n.x = -n.larg - 20
        n.g.setPosition(n.x + pan * 2, n.y)
      }
      for (const f of flores) f.img.setAngle(vento(f.x) * f.amp + Math.sin(t * 2.3 + f.fase) * 1.5).setX(f.x + pan * PARALLAX.perto)
      for (const g of girassois) g.img.setAngle(vento(g.x) * 3 + Math.sin(t * 0.8 + g.fase) * 1).setX(g.x + pan * PARALLAX.perto)
      for (const p of petalas) {
        p.x += ((p.v + 14 * forca) * dt) / 1000
        p.y += (Math.sin(t * 0.7 + p.fase) * 6 * dt) / 1000
        if (p.x > LARGURA + 6) {
          p.x = -6
          p.y = 90 + ((p.y * 7.3) % 380)
        }
        p.obj.setPosition(p.x, p.y + Math.sin(t * 1.7 + p.fase) * 5)
        if (!p.polen) p.obj.setRotation(t * 2 + p.fase)
      }
      for (const v of vagalumes) {
        // acendendo devagar: piscam de vez em quando (o brilho sobe e desce suave)
        const a = Math.max(0, Math.sin(t * v.v + v.fase)) ** 3
        const x = v.x + Math.sin(t * 0.4 + v.fase) * 14 + pan * PARALLAX.perto
        const y = v.y + Math.sin(t * 0.55 + v.fase * 1.3) * 8
        v.halo.setPosition(x, y).setAlpha(a * 0.55)
        v.ponto.setPosition(x, y).setAlpha(0.25 + a * 0.75)
      }
      for (const b of borboletas) {
        const x = LARGURA / 2 + Math.sin(t * b.a + b.p) * 300 + Math.sin(t * 0.9 + b.q) * 18
        const y = 250 + Math.sin(t * b.b + b.q) * 175 + Math.sin(t * 2.1 + b.p) * 6
        const bate = Math.abs(Math.cos(t * b.bate + b.p))
        b.img.setPosition(x, y).setScale(1.6 * (0.2 + 0.8 * bate), 1.6)
      }
    },
  }
}
