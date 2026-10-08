import Phaser from 'phaser'
import { definirAtaque } from '../definir.js'
import { ATAQUE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { particulas } from '../../effects/particulas.js'

// Ataques exclusivos das cartas de Asriel (os golpes do God of Hyperdeath).
// As receitas de pvp/baralhos/asriel.js chamam A.asriel<Golpe>(...).
// Sprites/sons: 'hab-asriel-*' (pvp/habilidades/sprites/asriel.js, gerados por
// scripts/habilidades/asriel.py).
//
//   asrielStarBlazing     estrelas grandes caem na diagonal e estouram em 5 estrelinhas
//   asrielChaosSaber      a espada do caos corta METADE da caixa num arco (a outra é a fuga)
//   asrielChaosBuster     dois canhões rastreiam o coração, travam a mira e disparam rajadas;
//                         a cada `carregado` rajadas, um tiro carregado (feixe)
//   asrielHyperGoner      caveira de bode no alto: a boca suga losangos que vêm das bordas
//                         em linha reta (o coração NÃO é puxado; isso é do SUPER)
//   asrielShockerBreaker  relâmpagos caem em colunas (às vezes em corrente) e soltam faíscas no chão
//   asrielTempoParado     o tempo para: as estrelas congelam no ar, ponteiros cercam o coração,
//                         e tudo volta a andar junto quando o relógio retoma
//   asrielEstrelaCadente  estrelas cadentes riscam a caixa e deixam poeira parada no rastro
//   asrielChuvaMeteoros   meteoros caem nos pontos marcados: cratera em brasa + lascas
//   asrielSupernova       estrelas incham, colapsam e explodem numa área, soltando nebulosas
//
// Justiça: tudo que fere pisca >= ATAQUE.telegrafoMs (a.bala) ou vem depois de
// um a.aviso; paredes declaram a rota de fuga (a.parede / a.lacuna).

const TAU = Math.PI * 2
const S = (nome) => `hab-asriel-${nome}`
const fator = (a) => a.balas.fatorVelocidade ?? 1
const limitar = (v, min, max) => Math.min(Math.max(v, min), max)

// O aviso de `ms` cabe antes do fim da onda? (conta as pausas de respiro que
// ainda vêm, em que os timers ficam parados). Evita aviso piscando sem golpe.
function cabe(a, ms) {
  let extra = 0
  const r = a.respiro
  if (r) {
    const rel = a.tempo - r.origem
    for (const [ini, fim] of r.pausas) if (fim > rel) extra += fim - Math.max(ini, rel)
  }
  return a.tempo + ms + extra <= a.fim
}

// pedaço [t0, t1] da reta p + d·t que fica dentro do retângulo l
function recortarReta(l, p, d) {
  let t0 = -Infinity
  let t1 = Infinity
  for (const [pos, dir, min, max] of [
    [p.x, d.x, l.left, l.right],
    [p.y, d.y, l.top, l.bottom],
  ]) {
    if (Math.abs(dir) < 1e-6) continue
    const u = (min - pos) / dir
    const v = (max - pos) / dir
    t0 = Math.max(t0, Math.min(u, v))
    t1 = Math.min(t1, Math.max(u, v))
  }
  return [t0, t1]
}

// acumulador: `mirar` (0..1) vira um ritmo fixo de golpes mirados no coração
function mirador(mirar) {
  let acc = 0.5
  return () => {
    acc += Number(mirar) || 0
    if (acc < 1) return false
    acc -= 1
    return true
  }
}

// ---------------------------------------------------------------------------
// ♠ Star Blazing: estrelas grandes caem na diagonal (o sentido muda a cada 4)
// e, na altura marcada, piscam e estouram em 5 estrelinhas, uma por ponta.
// As miradas estouram logo acima do coração.
const asrielStarBlazing = definirAtaque({
  nome: 'asrielStarBlazing',
  padrao: { duracao: 5000, intervalo: 700, velocidade: 110, velocidadeFilhos: 110, mirar: 0.5, raio: 9 },
  iniciar(a, cfg) {
    const mirada = mirador(cfg.mirar)
    // no estouro, as estrelinhas saem a 72° uma da outra: a 55 px do centro já ficam a > 60 px
    a.lacuna(2 * 55 * Math.sin(Math.PI / 5) - 9, 'vão entre as estrelinhas do estouro')
    a.aCada(cfg.intervalo, (i) => {
      const l = a.caixa
      const lado = Math.floor(i / 4) % 2 ? -1 : 1
      const ang = Math.PI / 2 - lado * 0.45
      let bx
      let by
      if (mirada()) {
        const alvo = a.alvo()
        bx = limitar(alvo.x + a.aleatorio(-12, 12), l.left + 15, l.right - 15)
        by = limitar(alvo.y - a.aleatorio(48, 64), l.top + 22, l.bottom - 30)
      } else {
        bx = a.aleatorio(l.left + 15, l.right - 15)
        by = a.aleatorio(l.top + l.height * 0.3, l.top + l.height * 0.7)
      }
      const sy = l.top - 14
      const dist = (by - sy) / Math.sin(ang)
      const sx = bx - Math.cos(ang) * dist
      let estourou = false
      a.bala({
        x: sx,
        y: sy,
        vx: Math.cos(ang) * cfg.velocidade,
        vy: Math.sin(ang) * cfg.velocidade,
        raio: cfg.raio,
        textura: S('estrela-grande'),
        tamanho: 25,
        girar: 1.4 * lado,
        pulso: 0.05,
        vida: 6000,
        atualizar: (m) => {
          if (estourou || m.morta || m.inofensiva) return
          // pisca o último ATAQUE.telegrafoMs antes de estourar
          const falta = (by - m.y) / Math.max(1, m.vy * fator(a))
          if (falta * 1000 < ATAQUE.telegrafoMs) m.piscar = true
          if (m.y < by) return
          estourou = true
          m.morta = true
          tocar(a.cena, 'estouro')
          particulas(a.cena, m.x, m.y, { cor: 0xfff07a, quantidade: 10, velocidade: 120, vida: 300 })
          const rot = m.sprite.rotation - Math.PI / 2
          for (let k = 0; k < 5; k++) {
            const d = rot + (k * TAU) / 5
            a.bala({
              x: m.x,
              y: m.y,
              vx: Math.cos(d) * cfg.velocidadeFilhos,
              vy: Math.sin(d) * cfg.velocidadeFilhos,
              raio: 4.5,
              textura: S('estrelinhas'),
              quadro: (i + k) % 6,
              tamanho: 12,
              girar: 5,
              jaAvisada: true,
              vida: 3000,
            })
          }
        },
      })
    })
  },
})

// ---------------------------------------------------------------------------
// ♠ Chaos Saber: a espada do caos aparece encostada numa borda, a metade da
// caixa onde o coração está pisca, e a espada corta essa metade num arco de
// 90° (o cabo fica fixo no meio da borda). Os cortes alternam entre dividir
// a caixa na vertical (esquerda/direita) e na horizontal (cima/baixo). Com
// `duplo`, a cada 3 cortes vem um segundo na outra metade, colado (um X).
// A espada solta `faiscas` na linha do meio, que andam para a metade segura.
const OPOSTA = { esquerda: 'direita', direita: 'esquerda', cima: 'baixo', baixo: 'cima' }

const asrielChaosSaber = definirAtaque({
  nome: 'asrielChaosSaber',
  padrao: { duracao: 6000, aviso: 600, golpe: 400, pausa: 400, duplo: false, faiscas: 2, velocidadeFaisca: 95, espessura: 14 },
  iniciar(a, cfg) {
    const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
    let k = 0

    const proximo = () => {
      if (!cabe(a, aviso + cfg.golpe)) return
      const l = a.caixa
      const alvo = a.alvo()
      const vertical = k % 2 === 0
      const metade = vertical ? (alvo.x < l.centerX ? 'esquerda' : 'direita') : alvo.y < l.centerY ? 'cima' : 'baixo'
      const duplo = cfg.duplo && k % 3 === 2
      k++
      golpear(metade, () => {
        if (duplo && cabe(a, aviso + cfg.golpe)) golpear(OPOSTA[metade], () => a.depois(cfg.pausa, proximo))
        else a.depois(cfg.pausa, proximo)
      })
    }

    const golpear = (metade, aoTerminar) => {
      const l = a.caixa
      const g = geometriaCorte(l, metade, a.escolher([0, 1]))
      const vertical = metade === 'esquerda' || metade === 'direita'
      a.parede({ eixo: vertical ? 'x' : 'y', ocupados: [g.faixa] })
      // a espada já aparece (apagada) no começo do arco
      const espada = a.decoracao(
        a.cena.add
          .image(g.p.x + (Math.cos(g.a0) * g.L) / 2, g.p.y + (Math.sin(g.a0) * g.L) / 2, S('sabre'))
          .setDepth(6)
          .setRotation(g.a0)
          .setScale((g.L * 1.05) / 128)
          .setAlpha(0.5),
      )
      a.aviso({ ...g.area, ms: aviso }, () => {
        espada.setVisible(false)
        tocar(a.cena, S('corte'))
        let terminou = false
        a.bala({
          x: espada.x,
          y: espada.y,
          comprimento: g.L,
          espessura: cfg.espessura,
          angulo: g.a0,
          textura: S('sabre'),
          tamanho: g.L * 1.05,
          jaAvisada: true,
          atravessa: true,
          pulso: 0,
          vida: cfg.golpe + 160,
          atualizar: (b) => {
            // arco linear (sem aceleração): a ponta nunca pula o coração entre dois quadros
            const p = Math.min(1, (b.idade * fator(a)) / cfg.golpe)
            const th = g.a0 + (g.a1 - g.a0) * p
            b.angulo = th
            b.x = g.p.x + (Math.cos(th) * g.L) / 2
            b.y = g.p.y + (Math.sin(th) * g.L) / 2
            if (p < 1 || terminou) return
            terminou = true
            rastro(a, g)
            if (!b.inofensiva && a.tempo <= a.fim) faiscas(a, cfg, g, l, vertical)
            aoTerminar()
          },
        })
      })
    }

    a.depois(0, proximo)
  },
})

// cabo fixo `p` (fora da caixa, no meio de uma borda) e o arco a0 -> a1 que
// cobre a metade inteira; `alt` escolhe a borda do cabo (cima/baixo ou esquerda/direita)
function geometriaCorte(l, metade, alt) {
  const cx = l.centerX
  const cy = l.centerY
  let p
  let a0
  let a1
  let rect
  if (metade === 'esquerda' || metade === 'direita') {
    const esq = metade === 'esquerda'
    p = alt ? { x: cx, y: l.bottom + 4 } : { x: cx, y: l.top - 4 }
    a0 = esq ? Math.PI : 0
    a1 = alt ? (esq ? 1.5 * Math.PI : -Math.PI / 2) : Math.PI / 2
    rect = esq ? [l.left, l.top, cx - l.left, l.height] : [cx, l.top, l.right - cx, l.height]
  } else {
    const cima = metade === 'cima'
    p = alt ? { x: l.right + 4, y: cy } : { x: l.left - 4, y: cy }
    a0 = cima ? -Math.PI / 2 : Math.PI / 2
    a1 = alt ? (cima ? -Math.PI : Math.PI) : 0
    rect = cima ? [l.left, l.top, l.width, cy - l.top] : [l.left, cy, l.width, l.bottom - cy]
  }
  const [x, y, w, h] = rect
  const L = Math.max(...[[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([qx, qy]) => Math.hypot(qx - p.x, qy - p.y))) + 6
  const vertical = metade === 'esquerda' || metade === 'direita'
  return {
    p,
    a0,
    a1,
    L,
    area: { tipo: 'area', x, y, largura: w, altura: h },
    faixa: vertical ? [x, x + w] : [y, y + h],
    seguro: vertical ? { x: metade === 'esquerda' ? l.right : l.left, y: cy } : { x: cx, y: metade === 'cima' ? l.bottom : l.top },
  }
}

// rastro do corte: o setor varrido brilha e some
function rastro(a, g) {
  const gr = a.decoracao(a.cena.add.graphics().setDepth(4))
  gr.fillStyle(0xfff07a, 0.3)
  gr.slice(g.p.x, g.p.y, g.L, g.a0, g.a1, g.a1 < g.a0)
  gr.fillPath()
  gr.lineStyle(3, 0xff8ad8, 0.7)
  gr.beginPath()
  gr.arc(g.p.x, g.p.y, g.L - 4, g.a0, g.a1, g.a1 < g.a0)
  gr.strokePath()
  a.cena.tweens.add({ targets: gr, alpha: 0, duration: 320, onComplete: () => gr.setVisible(false) })
}

// faíscas na linha do corte (onde a espada parou), andando para a metade segura
function faiscas(a, cfg, g, l, vertical) {
  const n = cfg.faiscas
  if (!n) return
  const d = { x: Math.cos(g.a1), y: Math.sin(g.a1) }
  let nrm = { x: -d.y, y: d.x }
  if (nrm.x * (g.seguro.x - g.p.x) + nrm.y * (g.seguro.y - g.p.y) < 0) nrm = { x: -nrm.x, y: -nrm.y }
  const comp = vertical ? l.height : l.width
  for (let k = 0; k < n; k++) {
    const s = 4 + ((k + 0.5 + a.aleatorio(-0.15, 0.15)) / n) * comp
    const desvio = a.aleatorio(-0.4, 0.4)
    const vx = nrm.x * Math.cos(desvio) - nrm.y * Math.sin(desvio)
    const vy = nrm.x * Math.sin(desvio) + nrm.y * Math.cos(desvio)
    a.bala({
      x: g.p.x + d.x * s,
      y: g.p.y + d.y * s,
      vx: vx * cfg.velocidadeFaisca,
      vy: vy * cfg.velocidadeFaisca,
      raio: 4.5,
      textura: S('estrelinhas'),
      quadro: k % 6,
      tamanho: 11,
      girar: 6,
      vida: 3200,
    })
  }
}

// ---------------------------------------------------------------------------
// ♠ Chaos Buster: dois canhões (um em cada metade da caixa) mudam de lugar
// pela borda, seguem o coração com o cano, TRAVAM a mira (a linha pisca) e
// disparam uma rajada de plasma nessa linha. A cada `carregado` rajadas de um
// canhão, ele carrega e solta um feixe grosso na linha travada.
const asrielChaosBuster = definirAtaque({
  nome: 'asrielChaosBuster',
  padrao: { duracao: 6000, ciclo: 1700, rajada: 3, velocidade: 190, aviso: 480, mira: 420, carregado: 3, feixe: 420 },
  iniciar(a, cfg) {
    const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
    const canhoes = [0, 1].map((lado) => {
      const l = a.caixa
      const img = a.decoracao(a.cena.add.image(lado ? l.right - 20 : l.left + 20, l.top + 9, S('canhao')).setDepth(6).setAlpha(0))
      return { lado, img, ang: Math.PI / 2, rastrear: true, volta: 0 }
    })
    a.aoAtualizar((dt) => {
      for (const c of canhoes) {
        if (c.rastrear) {
          const alvo = a.alvo()
          const alvoAng = Math.atan2(alvo.y - c.img.y, alvo.x - c.img.x)
          const dif = Phaser.Math.Angle.Wrap(alvoAng - c.ang)
          c.ang += dif * Math.min(1, dt / 90)
        }
        c.img.setRotation(c.ang)
      }
    })

    const posicao = (c) => {
      const l = a.caixa
      const noTopo = c.volta % 2 === 0
      if (noTopo) return { x: c.lado ? a.aleatorio(l.centerX + 18, l.right - 20) : a.aleatorio(l.left + 20, l.centerX - 18), y: l.top + 9 }
      return { x: c.lado ? l.right - 9 : l.left + 9, y: a.aleatorio(l.top + 22, l.centerY + 15) }
    }

    const volta = (c) => {
      if (!cabe(a, 300 + cfg.mira + aviso + 200)) return
      const p = posicao(c)
      c.rastrear = true
      a.cena.tweens.add({ targets: c.img, x: p.x, y: p.y, alpha: 1, duration: 280, ease: 'Sine.easeInOut' })
      const carregado = cfg.carregado > 0 && c.volta % cfg.carregado === cfg.carregado - 1
      c.volta++
      a.depois(280 + cfg.mira, () => {
        c.rastrear = false
        const ang = c.ang
        const d = { x: Math.cos(ang), y: Math.sin(ang) }
        const boca = { x: c.img.x + d.x * 15, y: c.img.y + d.y * 15 }
        const l = a.caixa
        const [, t1] = recortarReta(l, boca, d)
        const fim = { x: boca.x + d.x * Math.max(0, t1), y: boca.y + d.y * Math.max(0, t1) }
        const ms = carregado ? aviso + 220 : aviso
        if (carregado) {
          tocar(a.cena, S('carga'))
          particulas(a.cena, boca.x, boca.y, { cor: 0xff8ad8, quantidade: 8, velocidade: 50, vida: ms })
        }
        a.aviso({ tipo: 'linha', x1: boca.x, y1: boca.y, x2: fim.x, y2: fim.y, espessura: carregado ? 22 : 10, ms }, () => {
          if (carregado) feixe(a, cfg, boca, ang, l)
          else for (let j = 0; j < cfg.rajada; j++) a.depois(j * 85, () => tiro(a, cfg, boca, d, j))
          a.cena.tweens.add({ targets: c.img, x: c.img.x - d.x * 4, y: c.img.y - d.y * 4, duration: 60, yoyo: true })
          a.depois(carregado ? cfg.feixe : cfg.rajada * 85, () => a.depois(Math.max(0, cfg.ciclo - (280 + cfg.mira + ms)), () => volta(c)))
        })
      })
    }

    a.depois(0, () => volta(canhoes[0]))
    a.depois(cfg.ciclo / 2, () => volta(canhoes[1]))
  },
})

function tiro(a, cfg, boca, d, j) {
  tocar(a.cena, S('tiro'))
  const b = a.bala({
    x: boca.x,
    y: boca.y,
    vx: d.x * cfg.velocidade,
    vy: d.y * cfg.velocidade,
    raio: 4.5,
    textura: S('tiro'),
    tamanho: 15,
    pulso: 0.04,
    jaAvisada: true,
    vida: 2500,
  })
  b.sprite.setRotation(Math.atan2(d.y, d.x)).setTint([0xffffff, 0xffd0f0, 0xd0e8ff][j % 3])
}

function feixe(a, cfg, boca, ang, l) {
  tocar(a.cena, 'laser')
  const D = Math.hypot(l.width, l.height) * 1.2
  const b = a.bala({
    x: boca.x + (Math.cos(ang) * D) / 2,
    y: boca.y + (Math.sin(ang) * D) / 2,
    comprimento: D,
    espessura: 16,
    angulo: ang,
    textura: S('feixe'),
    jaAvisada: true,
    atravessa: true,
    pulso: 0,
    vida: cfg.feixe,
  })
  b.sprite.setDisplaySize(D, 24)
  particulas(a.cena, boca.x, boca.y, { cor: 0xffffff, quantidade: 10, velocidade: 140, vida: 260 })
}

// ---------------------------------------------------------------------------
// ♠ Hyper Goner: a caveira de bode abre a boca no alto da caixa e SUGA:
// losangos arco-íris piscam nas bordas e vão em linha reta para a boca,
// acelerando (a sucção). Uma fração nasce na borda certa para a linha até a
// boca passar pelo coração. Encostar na boca (o vórtice) também fere.
const asrielHyperGoner = definirAtaque({
  nome: 'asrielHyperGoner',
  padrao: { duracao: 6000, intervalo: 420, porVez: 2, velocidade: 65, aceleracao: 110, mirar: 0.5 },
  iniciar(a, cfg) {
    const l = a.caixa
    const cx = l.centerX
    const caveira = a.decoracao(a.cena.add.image(cx, l.top + 24, S('caveira'), 0).setDepth(3).setAlpha(0))
    a.cena.tweens.add({ targets: caveira, alpha: 1, duration: 300 })
    const boca = { x: cx, y: l.top + 40 }
    const vortice = a.decoracao(a.cena.add.graphics().setDepth(2))
    let giro = 0
    a.aoAtualizar((dt) => {
      giro += dt / 1000
      vortice.clear()
      for (let k = 0; k < 3; k++) {
        vortice.lineStyle(2, [0xff8ad8, 0x9ad8ff, 0xfff07a][k], 0.5)
        vortice.beginPath()
        vortice.arc(boca.x, boca.y, 10 + k * 5 + Math.sin(giro * 6 + k) * 2, giro * (3 + k), giro * (3 + k) + 2.2)
        vortice.strokePath()
      }
    })
    a.depois(0, () => caveira.setFrame(1))
    a.aviso({ tipo: 'circulo', x: boca.x, y: boca.y, raio: 14, ms: 500 }, () => {
      const b = a.bala({ x: boca.x, y: boca.y, raio: 11, jaAvisada: true, atravessa: true, vida: cfg.duracao + 3000 })
      b.sprite.setVisible(false)
    })
    // a caveira "ruge": fecha e abre a boca de tempos em tempos (só visual)
    a.aCada(1500, () => {
      caveira.setFrame(0)
      a.cena.tweens.add({ targets: caveira, scale: 1.08, duration: 90, yoyo: true })
      a.depois(160, () => caveira.setFrame(1))
    })

    const m = 6
    const pontoBorda = () => {
      const lados = [
        ['esq', l.height - 12],
        ['dir', l.height - 12],
        ['baixo', l.width - 12],
        ['topo', l.width / 2 - 52],
      ]
      const total = lados.reduce((s, [, c]) => s + c, 0)
      let sorteio = a.aleatorio(0, total)
      const [lado] = lados.find(([, c]) => (sorteio -= c) <= 0) ?? lados[2]
      if (lado === 'esq') return { x: l.left + m, y: a.aleatorio(l.top + m, l.bottom - m) }
      if (lado === 'dir') return { x: l.right - m, y: a.aleatorio(l.top + m, l.bottom - m) }
      if (lado === 'baixo') return { x: a.aleatorio(l.left + m, l.right - m), y: l.bottom - m }
      const x = a.aleatorio(0, l.width / 2 - 52)
      return { x: a.escolher([l.left + m + x, l.right - m - x]), y: l.top + m }
    }
    // ponto da borda na reta boca -> coração (o losango passa por cima dele)
    const pontoMirado = () => {
      const alvo = a.alvo()
      const dx = alvo.x - boca.x
      const dy = alvo.y - boca.y
      const dist = Math.hypot(dx, dy)
      if (dist < 20) return null
      const d = { x: dx / dist, y: dy / dist }
      const [, t1] = recortarReta({ left: l.left + m, right: l.right - m, top: l.top + m, bottom: l.bottom - m }, boca, d)
      const p = { x: boca.x + d.x * t1, y: boca.y + d.y * t1 }
      if (Math.abs(p.x - cx) < 40 && p.y < l.top + 12) return null // atrás da caveira
      return { ...p, perto: Math.hypot(p.x - alvo.x, p.y - alvo.y) < 30 }
    }

    const mirada = mirador(cfg.mirar)
    a.aCada(cfg.intervalo, (i) => {
      for (let k = 0; k < cfg.porVez; k++) {
        const p = (k === 0 && mirada() && pontoMirado()) || pontoBorda()
        const dx = boca.x - p.x
        const dy = boca.y - p.y
        const dist = Math.hypot(dx, dy) || 1
        const d = { x: dx / dist, y: dy / dist }
        const b = a.bala({
          x: p.x,
          y: p.y,
          vx: d.x * cfg.velocidade,
          vy: d.y * cfg.velocidade,
          ax: d.x * cfg.aceleracao,
          ay: d.y * cfg.aceleracao,
          raio: 4.5,
          textura: S('diamantes'),
          quadro: (i * cfg.porVez + k) % 6,
          tamanho: 14,
          pulso: 0.1,
          // nasceu colado no coração: pisca mais um pouco
          aviso: p.perto ? ATAQUE.telegrafoMs + 250 : ATAQUE.telegrafoMs,
          vida: 5000,
          atualizar: (bala) => {
            if (Math.hypot(bala.x - boca.x, bala.y - boca.y) < 10 || (bala.x - boca.x) * d.x + (bala.y - boca.y) * d.y > 0) bala.morta = true
          },
        })
        b.sprite.setRotation(Math.atan2(d.y, d.x) + Math.PI / 2)
      }
    })
  },
})

// ---------------------------------------------------------------------------
// ♦ Shocker Breaker: relâmpagos caem em colunas que piscam antes (a primeira
// no coração). A cada `cadeia` golpes, uma corrente: 3 colunas seguidas,
// uma depois da outra, varrendo a caixa a partir do coração. Cada raio solta
// faíscas que correm pelo chão para os dois lados.
const asrielShockerBreaker = definirAtaque({
  nome: 'asrielShockerBreaker',
  padrao: { duracao: 5000, intervalo: 1200, quantidade: 1, largura: 22, aviso: 600, raio: 260, faiscas: true, velocidadeFaisca: 100, cadeia: 3 },
  iniciar(a, cfg) {
    const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
    const meia = cfg.largura / 2
    const faixa = (x) => [x - meia, x + meia]

    const cair = (x) => {
      const l = a.caixa
      tocar(a.cena, S('trovao'))
      const b = a.bala({
        x,
        y: l.centerY,
        largura: cfg.largura * 0.75,
        altura: l.height + 8,
        textura: S('raio'),
        quadro: 0,
        jaAvisada: true,
        atravessa: true,
        vida: cfg.raio,
        atualizar: (r) => r.sprite.setFrame(Math.floor(r.idade / 60) % 2),
      })
      b.sprite.setDisplaySize(cfg.largura * 1.3, l.height + 8)
      particulas(a.cena, x, l.bottom - 4, { cor: 0xfff07a, quantidade: 8, velocidade: 120, vida: 260 })
      if (!cfg.faiscas) return
      for (const s of [-1, 1]) {
        a.bala({
          x: x + s * 6,
          y: l.bottom - 6,
          vx: s * cfg.velocidadeFaisca,
          raio: 4.5,
          textura: S('faisca'),
          quadro: 0,
          tamanho: 12,
          jaAvisada: true,
          vida: 2200,
          atualizar: (f) => f.sprite.setFrame(Math.floor(f.idade / 80) % 2),
        })
      }
    }

    const golpe = (x) => {
      const l = a.caixa
      a.aviso({ tipo: 'area', x: x - meia, y: l.top, largura: cfg.largura, altura: l.height, ms: aviso, cor: 0xfff07a }, () => cair(x))
    }

    // maior trecho livre da caixa (em x) com essas colunas
    const maiorLacuna = (xs) => {
      const l = a.caixa
      const ocupados = xs.map(faixa).sort((p, q) => p[0] - q[0])
      let cursor = l.left
      let maior = 0
      for (const [p, q] of ocupados) {
        maior = Math.max(maior, p - cursor)
        cursor = Math.max(cursor, q)
      }
      return Math.max(maior, l.right - cursor)
    }

    a.aCada(cfg.intervalo, (i) => {
      if (!cabe(a, aviso)) return
      const l = a.caixa
      const alvo = a.alvo()
      const presa = (x) => limitar(x, l.left + meia, l.right - meia)
      if (cfg.cadeia && i % cfg.cadeia === cfg.cadeia - 1) {
        // corrente: começa no coração e vai para o lado com mais espaço; numa
        // caixa apertada a 3ª coluna sai se ela não deixar uma rota de fuga
        const sentido = alvo.x < l.centerX ? 1 : -1
        const xs = [0, 1, 2].map((k) => presa(alvo.x + sentido * k * 48))
        while (xs.length > 1 && maiorLacuna(xs) < a.lacunaMinima) xs.pop()
        a.parede({ eixo: 'x', ocupados: xs.map(faixa) })
        xs.forEach((x, k) => a.depois(k * 200, () => golpe(x)))
        return
      }
      let xs = []
      for (let tentativa = 0; tentativa < 10; tentativa++) {
        xs = Array.from({ length: cfg.quantidade }, (_, k) => presa(k === 0 ? alvo.x : a.aleatorio(l.left, l.right)))
        if (maiorLacuna(xs) >= a.lacunaMinima) break
      }
      a.parede({ eixo: 'x', ocupados: xs.map(faixa) })
      xs.forEach(golpe)
    })
  },
})

// ---------------------------------------------------------------------------
// ♦ Tempo Parado: estrelas entram pelas bordas mirando o coração. A cada
// `fluxo` ms o tempo PARA: o relógio aparece, a caixa fica azulada, toda
// estrela congela no ar (cinza) e ponteiros de relógio aparecem em volta do
// coração (piscando, apontados para onde ele estava, com uma brecha de 90°).
// O coração ainda anda: é a hora de sair do cerco. Nos últimos
// ATAQUE.telegrafoMs as estrelas congeladas piscam e, quando o tempo volta,
// tudo anda de uma vez (estrelas no rumo de antes, ponteiros no alvo).
const asrielTempoParado = definirAtaque({
  nome: 'asrielTempoParado',
  padrao: { duracao: 6000, fluxo: 1400, parada: 1200, intervalo: 330, velocidade: 120, ponteiros: 5, distancia: 60, velocidadePonteiro: 170 },
  iniciar(a, cfg) {
    const parada = Math.max(ATAQUE.telegrafoMs + 300, cfg.parada)
    const l = a.caixa
    const estado = { parado: false }
    let minhas = []

    const relogio = a.decoracao(a.cena.add.image(l.centerX, l.centerY, S('relogio')).setDepth(2).setAlpha(0.16).setScale(1.7))
    const ponteiroDecor = (comp, alfa) => a.decoracao(a.cena.add.image(l.centerX, l.centerY, S('ponteiro')).setDepth(2).setOrigin(0.08, 0.5).setScale(comp / 24).setAlpha(alfa))
    const grande = ponteiroDecor(40, 0.3)
    const pequeno = ponteiroDecor(26, 0.3).setRotation(-1.2)
    const veu = a.decoracao(a.cena.add.rectangle(l.centerX, l.centerY, l.width + 8, l.height + 8, 0x9ad8ff, 0.18).setDepth(4).setVisible(false))
    a.aoAtualizar((dt) => {
      if (estado.parado) return // o relógio também para
      grande.rotation += (dt / 1000) * 2.6 * fator(a)
      pequeno.rotation += (dt / 1000) * 0.5 * fator(a)
    })

    a.aCada(cfg.intervalo, (i) => {
      if (estado.parado) return
      const borda = a.inteiro(0, 3)
      const m = 7
      const x = borda === 1 ? l.right - m : borda === 3 ? l.left + m : a.aleatorio(l.left + m, l.right - m)
      const y = borda === 0 ? l.top + m : borda === 2 ? l.bottom - m : a.aleatorio(l.top + m, l.bottom - m)
      const alvo = a.alvo()
      const ang = Math.atan2(alvo.y - y, alvo.x - x) + a.aleatorio(-0.3, 0.3)
      minhas.push(
        a.bala({
          x,
          y,
          vx: Math.cos(ang) * cfg.velocidade,
          vy: Math.sin(ang) * cfg.velocidade,
          raio: 5,
          textura: S('estrelinhas'),
          quadro: i % 6,
          tamanho: 13,
          girar: 4,
          vida: 4500,
        }),
      )
    })

    // cerco de ponteiros: arco de 270° (brecha de 90°) a `distancia` do coração
    const arco = TAU * 0.75
    a.lacuna(2 * cfg.distancia * Math.sin((TAU - arco) / 2), 'brecha no cerco de ponteiros')
    a.lacuna(2 * cfg.distancia * Math.sin(arco / (cfg.ponteiros - 1) / 2) - 8, 'vão entre dois ponteiros')

    const parar = () => {
      if (!cabe(a, parada)) return
      estado.parado = true
      tocar(a.cena, S('tique'))
      veu.setVisible(true)
      relogio.setAlpha(0.55)
      grande.setAlpha(0.8)
      pequeno.setAlpha(0.8)
      minhas = minhas.filter((b) => !b.morta)
      const congeladas = minhas
      for (const b of congeladas) {
        b.congelada = { vx: b.vx, vy: b.vy, ax: b.ax, ay: b.ay, girar: b.girar }
        b.vx = b.vy = b.ax = b.ay = b.girar = 0
        b.sprite.setTint(0x8f9cc8)
      }
      const alvo = a.alvo()
      const base = a.aleatorio(0, TAU)
      const n = cfg.ponteiros
      for (let k = 0; k < n; k++) {
        const ang = base + (k / (n - 1)) * arco
        const p = {
          x: limitar(alvo.x + Math.cos(ang) * cfg.distancia, l.left + 10, l.right - 10),
          y: limitar(alvo.y + Math.sin(ang) * cfg.distancia, l.top + 10, l.bottom - 10),
        }
        if (Math.hypot(p.x - alvo.x, p.y - alvo.y) < 36) continue // a parede empurrou para perto demais
        const dir = Math.atan2(alvo.y - p.y, alvo.x - p.x)
        a.bala({
          x: p.x,
          y: p.y,
          vx: Math.cos(dir) * cfg.velocidadePonteiro,
          vy: Math.sin(dir) * cfg.velocidadePonteiro,
          comprimento: 20,
          espessura: 5,
          angulo: dir,
          textura: S('ponteiro'),
          tamanho: 22,
          aviso: parada, // pisca o tempo parado inteiro e sai quando o tempo volta
          vida: 3000,
        })
      }
      a.depois(parada - ATAQUE.telegrafoMs, () => {
        for (const b of congeladas) b.piscar = true
        a.cena.tweens.add({ targets: relogio, alpha: 0.85, duration: 80, yoyo: true, repeat: 2 })
      })
      a.depois(parada, () => retomar(congeladas))
    }

    const retomar = (congeladas) => {
      estado.parado = false
      tocar(a.cena, S('retomar'))
      veu.setVisible(false)
      relogio.setAlpha(0.16)
      grande.setAlpha(0.3)
      pequeno.setAlpha(0.3)
      for (const b of congeladas) {
        if (b.morta || !b.congelada) continue
        Object.assign(b, b.congelada)
        b.congelada = null
        b.piscar = false
        b.sprite.clearTint()
        if (!b.inofensiva) b.sprite.setAlpha(1)
      }
      a.depois(cfg.fluxo, parar)
    }

    a.depois(cfg.fluxo, parar)
  },
})

// ---------------------------------------------------------------------------
// ♣ Estrela Cadente: uma linha diagonal pisca (a primeira de cada tantas
// passa pelo coração) e uma estrela com cauda risca a caixa por ela. No
// rastro fica poeira de estrela parada, cintilando, por `vidaPoeira` ms
// (armadilha): grãos a `espaco` px um do outro, sempre passáveis.
const asrielEstrelaCadente = definirAtaque({
  nome: 'asrielEstrelaCadente',
  padrao: { duracao: 5000, intervalo: 1100, aviso: 600, velocidade: 250, espaco: 58, raioPoeira: 3.5, vidaPoeira: 2000, mirar: 0.6 },
  iniciar(a, cfg) {
    const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
    const mirada = mirador(cfg.mirar)
    a.lacuna(cfg.espaco - 2 * cfg.raioPoeira, 'vão entre a poeira do rastro')
    a.aCada(cfg.intervalo, () => {
      if (!cabe(a, aviso)) return
      const l = a.caixa
      const q = mirada() ? a.alvo() : { x: a.aleatorio(l.left + 25, l.right - 25), y: a.aleatorio(l.top + 25, l.bottom - 25) }
      const inclinacao = a.aleatorio(0.35, 0.85)
      const ang = a.escolher([1, -1]) > 0 ? inclinacao : Math.PI - inclinacao
      const d = { x: Math.cos(ang), y: Math.sin(ang) }
      const [t0, t1] = recortarReta(l, q, d)
      const entrada = { x: q.x + d.x * t0, y: q.y + d.y * t0 }
      const saida = { x: q.x + d.x * t1, y: q.y + d.y * t1 }
      const comp = t1 - t0
      a.aviso({ tipo: 'linha', x1: entrada.x, y1: entrada.y, x2: saida.x, y2: saida.y, espessura: 14, ms: aviso, cor: 0xfff07a }, () => {
        tocar(a.cena, S('cadente'))
        const recuo = 30
        const inicio = { x: entrada.x - d.x * recuo, y: entrada.y - d.y * recuo }
        let proxima = recuo + cfg.espaco * a.aleatorio(0.3, 0.7)
        const b = a.bala({
          x: inicio.x,
          y: inicio.y,
          vx: d.x * cfg.velocidade,
          vy: d.y * cfg.velocidade,
          raio: 6,
          textura: S('cadente'),
          tamanho: 40,
          pulso: 0,
          jaAvisada: true,
          atravessa: true,
          vida: 4000,
          atualizar: (s) => {
            const andou = Math.hypot(s.x - inicio.x, s.y - inicio.y)
            if (andou > recuo + comp + 60) s.morta = true
            while (andou >= proxima && proxima <= recuo + comp - 6) {
              const p = { x: inicio.x + d.x * proxima, y: inicio.y + d.y * proxima }
              proxima += cfg.espaco
              if (s.inofensiva || a.tempo > a.fim) continue
              poeira(a, cfg, p)
            }
          },
        })
        b.sprite.setOrigin(0.82, 0.5).setRotation(ang)
      })
    })
  },
})

function poeira(a, cfg, p) {
  a.bala({
    x: p.x,
    y: p.y,
    raio: cfg.raioPoeira,
    textura: S('poeira'),
    quadro: 0,
    tamanho: 9,
    pulso: 0.2,
    jaAvisada: true,
    vida: cfg.vidaPoeira,
    atualizar: (b) => {
      b.sprite.setFrame(Math.floor(b.idade / 160) % 2)
      if (b.vida < 300 && !b.inofensiva) b.sprite.setAlpha(Math.max(0.2, b.vida / 300))
    },
  })
}

// ---------------------------------------------------------------------------
// ♣ Chuva de Meteoros: o ponto de impacto pisca (círculo) enquanto o meteoro
// desce na diagonal até ele (o meteoro no céu não fere; quem avisa é o
// círculo). No impacto: a área inteira fere por um instante, fica uma
// cratera em brasa (armadilha) e saltam lascas de rocha em arco.
const asrielChuvaMeteoros = definirAtaque({
  nome: 'asrielChuvaMeteoros',
  padrao: { duracao: 5500, intervalo: 900, queda: 850, raioImpacto: 20, lascas: 3, velocidadeLasca: 120, gravidade: 280, cratera: 1600, mirar: 0.5 },
  iniciar(a, cfg) {
    const queda = Math.max(ATAQUE.telegrafoMs, cfg.queda)
    const mirada = mirador(cfg.mirar)
    const caindo = []
    a.aoAtualizar((dt) => {
      for (const m of caindo) {
        if (m.feito) continue
        m.relogio += dt
        const k = Math.min(1, m.relogio / queda)
        m.img.setPosition(m.de.x + (m.p.x - m.de.x) * k, m.de.y + (m.p.y - m.de.y) * k)
        m.img.setScale(0.7 + 0.6 * k).setFrame(Math.floor(m.relogio / 80) % 2)
      }
    })

    a.aCada(cfg.intervalo, (i) => {
      if (!cabe(a, queda)) return
      const l = a.caixa
      const margem = 18
      let p
      if (mirada()) {
        const alvo = a.alvo()
        p = { x: limitar(alvo.x + a.aleatorio(-14, 14), l.left + margem, l.right - margem), y: limitar(alvo.y + a.aleatorio(-14, 14), l.top + margem, l.bottom - margem) }
      } else {
        p = a.pontoLonge(45, margem)
      }
      const sentido = Math.floor(i / 5) % 2 ? -1 : 1
      const ang = Math.PI / 2 - sentido * 0.6
      const de = { x: p.x - Math.cos(ang) * 130, y: p.y - Math.sin(ang) * 130 }
      const img = a.decoracao(a.cena.add.image(de.x, de.y, S('meteoro'), 0).setDepth(6).setRotation(ang).setScale(0.7))
      const m = { img, de, p, relogio: 0, feito: false }
      caindo.push(m)
      a.aviso({ tipo: 'circulo', x: p.x, y: p.y, raio: cfg.raioImpacto, ms: queda, cor: 0xff8a3a }, () => {
        m.feito = true
        img.setVisible(false)
        impacto(a, cfg, p, i)
      })
    })
  },
})

function impacto(a, cfg, p, i) {
  tocar(a.cena, 'impacto')
  particulas(a.cena, p.x, p.y, { cor: 0xffa23a, quantidade: 14, velocidade: 150, vida: 340 })
  const golpe = a.bala({ x: p.x, y: p.y, raio: cfg.raioImpacto - 2, jaAvisada: true, atravessa: true, vida: 150 })
  golpe.sprite.setVisible(false)
  a.bala({
    x: p.x,
    y: p.y,
    raio: 8,
    textura: S('cratera'),
    quadro: 0,
    tamanho: 24,
    pulso: 0.04,
    jaAvisada: true,
    atravessa: true,
    vida: cfg.cratera,
    atualizar: (b) => {
      b.sprite.setFrame(Math.floor(b.idade / 130) % 2)
      if (b.vida < 300 && !b.inofensiva) b.sprite.setAlpha(Math.max(0.2, b.vida / 300))
    },
  })
  const n = cfg.lascas
  for (let k = 0; k < n; k++) {
    const ang = -Math.PI / 2 + (k - (n - 1) / 2) * 0.8 + a.aleatorio(-0.15, 0.15)
    a.bala({
      x: p.x,
      y: p.y,
      vx: Math.cos(ang) * cfg.velocidadeLasca,
      vy: Math.sin(ang) * cfg.velocidadeLasca,
      ay: cfg.gravidade,
      raio: 3.5,
      textura: S('rochas'),
      quadro: (i + k) % 3,
      tamanho: 9,
      girar: 8,
      jaAvisada: true,
      vida: 2400,
    })
  }
}

// ---------------------------------------------------------------------------
// ♣ Supernova: uma estrela nasce (perto do coração ou longe dele) e incha
// como uma gigante vermelha (o corpo dela fere e cresce), enquanto o raio da
// explosão pisca em volta. No fim ela colapsa num ponto e explode: a área
// inteira fere por um instante e sobram nuvens de nebulosa à deriva
// (armadilha que se espalha devagar).
const asrielSupernova = definirAtaque({
  nome: 'asrielSupernova',
  padrao: { duracao: 6000, intervalo: 1900, crescer: 1450, raioEstrela: 16, raioExplosao: 50, nebulosas: 5, velocidadeNebulosa: 36, vidaNebulosa: 2200, mirar: 0.6 },
  iniciar(a, cfg) {
    const crescer = Math.max(ATAQUE.telegrafoMs + 400, cfg.crescer)
    const mirada = mirador(cfg.mirar)
    const estrelas = []
    // relógio próprio de cada estrela (para junto com os timers no respiro)
    a.aoAtualizar((dt) => estrelas.forEach((e) => (e.relogio += dt)))

    a.aCada(cfg.intervalo, (i) => {
      if (!cabe(a, crescer)) return
      const l = a.caixa
      const R = cfg.raioExplosao
      let c
      if (mirada()) {
        const alvo = a.alvo()
        const ang = a.aleatorio(0, TAU)
        const d = a.aleatorio(28, 40)
        c = { x: limitar(alvo.x + Math.cos(ang) * d, l.left + 20, l.right - 20), y: limitar(alvo.y + Math.sin(ang) * d, l.top + 20, l.bottom - 20) }
      } else {
        c = a.pontoLonge(R, 20)
      }
      const e = { relogio: 0, x: c.x, y: c.y, b: null }
      estrelas.push(e)
      const colapso = 260
      e.b = a.bala({
        x: c.x,
        y: c.y,
        raio: 5,
        textura: S('gigante'),
        quadro: 0,
        tamanho: 13,
        pulso: 0.06,
        atravessa: true,
        vida: crescer + 3000,
        atualizar: (b) => {
          const t = e.relogio
          const cresce = crescer - colapso
          const inicio = ATAQUE.telegrafoMs
          let r
          if (t < cresce) {
            const k = limitar((t - inicio) / (cresce - inicio), 0, 1)
            r = 5 + (cfg.raioEstrela - 5) * k
            b.sprite.setFrame(Math.min(2, Math.floor(k * 3)))
          } else {
            r = cfg.raioEstrela + (3 - cfg.raioEstrela) * Math.min(1, (t - cresce) / colapso)
            b.sprite.setTint(0xffe8e8)
          }
          b.raio = r
          b.escalaX = b.escalaY = (r * 2.6) / 32
        },
      })
      a.aviso({ tipo: 'circulo', x: c.x, y: c.y, raio: R, ms: crescer, cor: 0xff4a5a }, () => explodir(a, cfg, e, estrelas, i))
    })
  },
})

function explodir(a, cfg, e, estrelas, i) {
  estrelas.splice(estrelas.indexOf(e), 1)
  if (e.b) e.b.morta = true
  const R = cfg.raioExplosao
  tocar(a.cena, S('nova'))
  particulas(a.cena, e.x, e.y, { cor: 0xffffff, quantidade: 18, velocidade: 170, vida: 380 })
  const clarao = a.decoracao(a.cena.add.image(e.x, e.y, S('clarao')).setDepth(6).setScale(0.2).setBlendMode(Phaser.BlendModes.ADD))
  a.cena.tweens.add({ targets: clarao, scale: (R * 2) / 64, duration: 140, ease: 'Cubic.easeOut' })
  a.cena.tweens.add({ targets: clarao, alpha: 0, delay: 140, duration: 320, onComplete: () => clarao.setVisible(false) })
  const golpe = a.bala({ x: e.x, y: e.y, raio: R, jaAvisada: true, atravessa: true, vida: 220 })
  golpe.sprite.setVisible(false)
  const n = cfg.nebulosas
  const base = a.aleatorio(0, TAU)
  for (let k = 0; k < n; k++) {
    const ang = base + (k * TAU) / n + a.aleatorio(-0.2, 0.2)
    const v = cfg.velocidadeNebulosa * a.aleatorio(0.8, 1.2)
    a.bala({
      x: e.x + Math.cos(ang) * R * 0.45,
      y: e.y + Math.sin(ang) * R * 0.45,
      vx: Math.cos(ang) * v,
      vy: Math.sin(ang) * v,
      raio: 5,
      textura: S('nebulosa'),
      quadro: (i + k) % 3,
      tamanho: 14,
      girar: 1,
      pulso: 0.12,
      jaAvisada: true,
      vida: cfg.vidaNebulosa,
      atualizar: (b) => {
        if (b.vida < 400 && !b.inofensiva) b.sprite.setAlpha(Math.max(0.2, b.vida / 400))
      },
    })
  }
}

export default {
  asrielStarBlazing,
  asrielChaosSaber,
  asrielChaosBuster,
  asrielHyperGoner,
  asrielShockerBreaker,
  asrielTempoParado,
  asrielEstrelaCadente,
  asrielChuvaMeteoros,
  asrielSupernova,
}
