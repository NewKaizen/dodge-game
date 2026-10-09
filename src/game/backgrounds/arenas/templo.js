import Phaser from 'phaser'
import { LARGURA } from '../../constants.js'
import { gerarArteTemplo, TEMPLO, P, N_CHAMAS } from './temploArte.js'

// TEMPLO: o salão de um templo antigo em ruínas (arte em temploArte.js).
// Camadas, de trás para a frente:
//   - o salão (textura fixa): teto com o buraco do sol, paredes, colunas
//     sumindo no escuro, chão de lajotas, o ídolo no nicho e o altar;
//   - o feixe de sol que entra pelo buraco e cai no ídolo, com a poeira
//     dourada flutuando dentro dele (mais visível na luz) e uma pedrinha
//     que às vezes se solta da viga quebrada;
//   - a frente (colunas das bordas + viga com hieróglifos), que balança uns
//     pixels em relação ao salão (parallax);
//   - as tochas: chama em quadros, brilho quente oscilando e faíscas subindo;
//   - de tempos em tempos uma ONDA DOURADA: os olhos do ídolo e o disco solar
//     acendem e a luz corre pelos hieróglifos da viga, do meio para as pontas,
//     e desce pelas colunas;
//   - cipós balançando, morcegos que às vezes saem pelo buraco e a vinheta.
// O meio da tela (atrás das caixas) é só pedra escura: o brilho fica no
// vão entre as caixas, nas bordas e no alto.

const ONDA = { periodo: 9000, duracao: 2600, largura: 0.16 } // ms; "ordem" dos glifos (TEMPLO.glifos)
const POEIRA = 46
const FEIXE = { x: 316, y: 52 } // onde o feixe sai (pixels do jogo)
const MORCEGOS_MS = { min: 13000, max: 22000 }
const PEDRINHA_MS = { min: 5000, max: 9000 }

// pixels da arte -> pixels do jogo
const px = (v) => v * P

// ruído suave (soma de senos) para o tremor das tochas: 0..1
const tremor = (t, fase) => 0.5 + 0.25 * Math.sin(t / 97 + fase) + 0.15 * Math.sin(t / 41 + fase * 2.3) + 0.1 * Math.sin(t / 23 + fase * 0.7)

export default function templo(scene, objetos) {
  gerarArteTemplo(scene)
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }
  const sorte = Phaser.Math.RND
  const ADD = Phaser.BlendModes.ADD

  add(scene.add.image(0, 0, 'arena-templo-fundo').setOrigin(0).setScale(P))

  // ---------- luz do sol ----------
  const feixes = [
    add(scene.add.image(FEIXE.x, FEIXE.y, 'arena-templo-feixe').setOrigin(65 / 150, 0).setBlendMode(ADD).setTint(0xffd890)),
    add(scene.add.image(FEIXE.x + 4, FEIXE.y - 10, 'arena-templo-feixe').setOrigin(65 / 150, 0).setScale(1.3, 1.05).setBlendMode(ADD).setTint(0xffc060)),
  ]
  const poca = add(scene.add.image(px(TEMPLO.altar.x) + 6, px(TEMPLO.altar.y), 'arena-templo-brilho').setDisplaySize(170, 34).setBlendMode(ADD).setTint(0xffd070))
  const poeira = Array.from({ length: POEIRA }, (_, i) => ({
    obj: add(scene.add.rectangle(0, 0, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1, 0xffeab8).setOrigin(0)),
    u: sorte.realInRange(-1, 1),
    v: sorte.frac(),
    vel: sorte.realInRange(0.012, 0.03), // fração do feixe por segundo (desce devagar)
    fase: sorte.realInRange(0, 6.28),
  }))

  // pedrinha que se solta da viga quebrada
  const pedrinha = add(scene.add.rectangle(0, 0, 2, 2, 0x9c7a48).setOrigin(0).setVisible(false))
  const poeirinha = Array.from({ length: 4 }, () => add(scene.add.rectangle(0, 0, 2, 2, 0x7a5c35).setOrigin(0).setVisible(false)))
  let queda = null // { x, y, vy, chao } | null
  let proximaPedrinha = sorte.between(PEDRINHA_MS.min, PEDRINHA_MS.max) / 2

  // ---------- camada da frente (parallax) ----------
  const frente = add(scene.add.image(0, 0, 'arena-templo-frente').setOrigin(0).setScale(P))

  // ---------- hieróglifos e o ídolo (onda dourada) ----------
  const glifos = TEMPLO.glifos.map((g) => ({
    ...g,
    obj: add(scene.add.image(px(g.x - 1), px(g.y - 1), `arena-templo-glifo-${g.forma}`).setOrigin(0).setScale(P).setBlendMode(ADD).setAlpha(0)),
  }))
  const disco = add(scene.add.image(px(TEMPLO.disco.x), px(TEMPLO.disco.y), 'arena-templo-brilho').setDisplaySize(84, 84).setBlendMode(ADD).setTint(0xffc040).setAlpha(0))
  const olhos = TEMPLO.olhos.map((o) => add(scene.add.rectangle(px(o.x), px(o.y), 4, 2, 0xffe070).setOrigin(0).setBlendMode(ADD)))

  // ---------- tochas ----------
  const tochas = TEMPLO.tochas.map((t, i) => {
    const x = px(t.x) + 1
    const y = px(t.y + 2)
    return {
      ...t,
      x,
      y,
      fase: i * 1.9,
      halo: add(scene.add.image(x, y - 10, 'arena-templo-brilho').setDisplaySize(150, 150).setBlendMode(ADD).setTint(0xff7a28)),
      nucleo: add(scene.add.image(x, y - 12, 'arena-templo-brilho').setDisplaySize(40, 46).setBlendMode(ADD).setTint(0xffc060)),
      chama: add(scene.add.image(x, y + 2, 'arena-templo-chama-0').setOrigin(0.5, 1).setScale(P)),
      quadro: 0,
      trocaEm: 0,
      faiscas: Array.from({ length: 3 }, (_, k) => ({
        obj: add(scene.add.rectangle(0, 0, 2, 2, k ? 0xffa030 : 0xffe070).setOrigin(0).setBlendMode(ADD)),
        idade: (k * 700) / 3,
        vida: 700,
        dx: 0,
      })),
    }
  })

  // ---------- cipós balançando ----------
  const cipos = [
    { x: 283, y: 58, n: 22, fase: 0 },
    { x: 293, y: 66, n: 12, fase: 1.3 },
    { x: 349, y: 62, n: 17, fase: 2.1 },
    { x: 359, y: 56, n: 26, fase: 0.6 },
    { x: 12, y: 112, n: 18, fase: 1.7, frente: true },
    { x: 40, y: 110, n: 12, fase: 2.9, frente: true },
    { x: 628, y: 112, n: 20, fase: 0.9, frente: true },
    { x: 600, y: 110, n: 10, fase: 2.4, frente: true },
  ].map((c) => ({ ...c, folhas: Array.from({ length: c.n }, (_, i) => (i * 7 + c.n) % 5 === 0) }))
  const gCipos = add(scene.add.graphics())

  // ---------- morcegos ----------
  const morcegos = Array.from({ length: 3 }, () => ({ obj: add(scene.add.image(0, 0, 'arena-templo-morcego-0').setScale(P).setVisible(false)), voando: false }))
  let proximoBando = sorte.between(MORCEGOS_MS.min, MORCEGOS_MS.max) / 2

  add(scene.add.image(0, 0, 'arena-templo-vinheta').setOrigin(0).setScale(P))

  // ---------- animação ----------

  const atualizarPoeira = (dt, t) => {
    for (const d of poeira) {
      d.v += (d.vel * dt) / 1000
      d.u += Math.sin(t / 1700 + d.fase) * 0.00012 * dt
      if (d.v > 1 || Math.abs(d.u) > 1) {
        d.v = d.v > 1 ? 0 : d.v
        d.u = sorte.realInRange(-0.9, 0.9)
      }
      // mesma forma do feixe (gerarFeixe): centro andando para a direita, largura crescendo
      const y = FEIXE.y + d.v * 250
      const meio = FEIXE.x + 20 * d.v
      const larg = 70 + 60 * d.v
      const brilho = 0.5 + 0.5 * Math.sin(t / 380 + d.fase * 3)
      d.obj.setPosition(Math.round(meio + (d.u * larg) / 2), Math.round(y))
      d.obj.setAlpha((0.15 + 0.6 * brilho) * (1 - d.u * d.u) * (1 - d.v * 0.55))
    }
  }

  const atualizarPedrinha = (dt) => {
    proximaPedrinha -= dt
    if (!queda && proximaPedrinha <= 0) {
      proximaPedrinha = sorte.between(PEDRINHA_MS.min, PEDRINHA_MS.max)
      const esquerda = sorte.frac() < 0.5
      queda = { x: esquerda ? px(TEMPLO.quebra.esq) - 2 : px(TEMPLO.quebra.dir) + 2, y: px(TEMPLO.quebra.y) - 2, vy: 0, chao: px(TEMPLO.altar.y) - 4 + sorte.between(0, 6) }
      pedrinha.setVisible(true)
    }
    if (queda) {
      queda.vy += (520 * dt) / 1000
      queda.y += (queda.vy * dt) / 1000
      pedrinha.setPosition(Math.round(queda.x), Math.round(queda.y))
      if (queda.y >= queda.chao) {
        pedrinha.setVisible(false)
        poeirinha.forEach((p, k) => {
          p.setPosition(queda.x, queda.chao).setVisible(true).setAlpha(0.8)
          scene.tweens.add({ targets: p, x: queda.x + (k - 1.5) * 6, y: queda.chao - 4 - (k % 2) * 3, alpha: 0, duration: 420, onComplete: () => p.setVisible(false) })
        })
        queda = null
      }
    }
  }

  const atualizarTochas = (dt, t, ox) => {
    for (const q of tochas) {
      const k = tremor(t, q.fase)
      const dx = q.frente ? ox : 0
      q.halo.setPosition(q.x + dx, q.y - 10).setAlpha(0.16 + 0.12 * k)
      q.halo.setDisplaySize(140 + 22 * k, 140 + 22 * k)
      q.nucleo.setPosition(q.x + dx, q.y - 12).setAlpha(0.3 + 0.25 * k)
      q.trocaEm -= dt
      if (q.trocaEm <= 0) {
        q.trocaEm = 70 + sorte.between(0, 70)
        q.quadro = (q.quadro + 1 + sorte.between(0, N_CHAMAS - 2)) % N_CHAMAS
        q.chama.setTexture(`arena-templo-chama-${q.quadro}`)
      }
      q.chama.setPosition(q.x + dx, q.y + 2).setScale(P, P * (0.9 + 0.2 * k))
      for (const f of q.faiscas) {
        f.idade += dt
        if (f.idade >= f.vida) {
          f.idade = 0
          f.vida = 500 + sorte.between(0, 600)
          f.dx = sorte.realInRange(-8, 8)
        }
        const p = f.idade / f.vida
        f.obj.setPosition(Math.round(q.x + dx + f.dx * p + Math.sin(t / 120 + f.vida) * 2), Math.round(q.y - 20 - p * 34)).setAlpha(1 - p)
      }
    }
  }

  const atualizarOnda = (t, ox) => {
    const fase = t % ONDA.periodo
    const ativa = fase < ONDA.duracao
    const frenteOnda = -0.25 + (fase / ONDA.duracao) * 1.75 // de antes do ídolo até o pé das colunas
    const luz = (ordem) => {
      if (!ativa) return 0
      const d = frenteOnda - ordem
      const pico = Math.max(0, 1 - Math.abs(d) / ONDA.largura)
      const rastro = d > 0 ? Math.exp(-d / 0.3) * 0.45 : 0
      return Math.max(pico, rastro) * Math.min(1, (ONDA.duracao - fase) / 500)
    }
    for (const g of glifos) g.obj.setPosition(px(g.x - 1) + (g.frente ? ox : 0), px(g.y - 1)).setAlpha(0.05 + 0.9 * luz(g.ordem))
    const idolo = luz(-0.12)
    // os olhos do ídolo nunca apagam de todo: brilham fraquinho e pulsam devagar
    const respira = 0.3 + 0.15 * Math.sin(t / 900)
    olhos.forEach((o) => o.setAlpha(Math.min(1, respira + idolo)))
    disco.setAlpha(0.08 + 0.4 * idolo)
  }

  const atualizarCipos = (t, ox) => {
    gCipos.clear()
    for (const c of cipos) {
      const dx0 = c.frente ? ox : 0
      for (let i = 0; i < c.n; i++) {
        const k = i / c.n
        const x = Math.round(c.x + dx0 + Math.sin(t / 1300 + c.fase + i * 0.18) * 4 * k * k)
        const y = c.y + i * 2
        gCipos.fillStyle(i % 3 ? 0x1f4022 : 0x142218, 1).fillRect(x, y, 2, 2)
        if (c.folhas[i]) gCipos.fillStyle(0x33622a, 1).fillRect(x + (i % 2 ? 2 : -2), y, 2, 2)
        if (c.folhas[i] && i % 2) gCipos.fillStyle(0x58903a, 1).fillRect(x + 4, y - 2, 2, 2)
      }
    }
  }

  const atualizarMorcegos = (dt, t) => {
    proximoBando -= dt
    if (proximoBando <= 0) {
      proximoBando = sorte.between(MORCEGOS_MS.min, MORCEGOS_MS.max)
      const lado = sorte.frac() < 0.5 ? -1 : 1
      morcegos.forEach((m, k) => {
        if (k > 0 && sorte.frac() < 0.4) return
        Object.assign(m, { voando: true, x: px(TEMPLO.buraco.x) + sorte.between(-20, 20), y: 8 + k * 4, vx: lado * (110 + sorte.between(0, 50)), atraso: k * 260, fase: sorte.realInRange(0, 6) })
      })
    }
    for (const m of morcegos) {
      if (!m.voando) continue
      if (m.atraso > 0) {
        m.atraso -= dt
        continue
      }
      m.x += (m.vx * dt) / 1000
      m.y += (12 * dt) / 1000
      const bater = Math.floor(t / 90 + m.fase) % 2
      m.obj
        .setVisible(true)
        .setTexture(`arena-templo-morcego-${bater}`)
        .setPosition(Math.round(m.x), Math.round(m.y + Math.sin(t / 160 + m.fase) * 5))
      if (m.x < -20 || m.x > LARGURA + 20) {
        m.voando = false
        m.obj.setVisible(false)
      }
    }
  }

  return {
    atualizar(dt, estado) {
      const t = estado.tempo
      // parallax: a frente balança até 2 px enquanto o salão fica parado
      const ox = Math.round(Math.sin(t / 3100) * 2)
      frente.setX(ox)
      // o sol "respira" devagar (nuvens passando lá fora)
      const sol = 0.75 + 0.15 * Math.sin(t / 2300) + 0.1 * Math.sin(t / 830)
      feixes[0].setAlpha(0.26 * sol)
      feixes[1].setAlpha(0.12 * (1.6 - sol))
      poca.setAlpha(0.32 * sol)
      atualizarPoeira(dt, t)
      atualizarPedrinha(dt)
      atualizarTochas(dt, t, ox)
      atualizarOnda(t, ox)
      atualizarCipos(t, ox)
      atualizarMorcegos(dt, t)
    },
  }
}
