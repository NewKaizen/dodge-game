import Phaser from 'phaser'
import { definirAtaque } from '../definir.js'
import { tocar } from '../../audio.js'
import { shake } from '../../effects/shake.js'
import { particulas } from '../../effects/particulas.js'

// SUPER de Asriel: SINGULARIDADE RADIANTE. A única carta do jogo que mexe no
// coração sem ser bala: a gravidade dele é de verdade.
//
//   I. O Vazio (1ª metade). Um buraco negro nasce no meio da caixa, cresce em
//      pulsos e PUXA o coração para si (o puxão entra direto na posição, como
//      a correnteza de um rio: dá para nadar contra, nunca é mais forte que o
//      coração). Cada pulso aperta o puxão. Estrelas descem em BRAÇOS DE
//      ESPIRAL (um disco de acreção): nascem na borda, giram em volta do
//      vazio cada vez mais rápido conforme chegam perto (como planetas) e
//      somem engolidas por ele.
//   II. A Supernova (2ª metade). O vazio implode e explode: o puxão VIRA
//      empurrão (o coração é jogado contra as paredes) enquanto anéis de
//      estrelas arco-íris se expandem do centro, cada um com uma brecha. A
//      brecha muda de lugar a cada anel: é preciso correr pela borda (contra
//      o empurrão) até ela. O último anel é duplo.
//
// Justiça:
//   - o puxão/empurrão nunca passa de `forcaMax` px/s (o coração anda
//     CORACAO.velocidadePadrao = 180): sempre dá para fugir; só começa depois
//     do primeiro pulso piscar, e para nas pausas de respiro;
//   - o vazio pisca no tamanho novo (`aviso`) antes de cada pulso, e o raio
//     máximo sempre deixa um anel >= lacunaMinima até a borda mais perto;
//   - as estrelas da espiral nascem paradas e piscando (aviso de a.bala); no
//     mesmo braço, duas estrelas seguidas ficam a mais de `lacunaMinima` uma
//     da outra ao longo do caminho;
//   - cada anel da supernova nasce parado e piscando como um círculo de nós
//     com a brecha já visível, e a brecha anda no máximo `passoBrecha` rad
//     de um anel para o outro.
//
// Config: vazio, espiral, nova (objetos parciais completam com PADRAO)
const ARCO = [0xff4a5a, 0xffa23a, 0xffe14a, 0x5ae06a, 0x4ab8ff, 0xa66bff]
const TAU = Math.PI * 2

const PADRAO = {
  vazio: { fracoes: [0.32, 0.55, 0.78, 1], tempos: [0, 1150, 2300, 3400], aviso: 650, margem: 6, forcas: [28, 46, 62, 74] },
  espiral: { bracos: 3, inicio: 500, intervalo: 560, giroBracos: 0.72, velRadial: 34, velTangencial: 70, omegaMax: 5.5, aviso: 520 },
  nova: { aneis: 5, intervalo: 720, estrelas: 18, abertura: 1.25, passoBrecha: 0.85, velocidade: 105, aviso: 520, raioNo: 40, empurrao: 58, duracaoEmpurrao: 3600 },
  forcaMax: 80,
}

export default definirAtaque({
  nome: 'superAsriel',
  padrao: { duracao: 9000, vazio: {}, espiral: {}, nova: {} },
  iniciar(a, cfg) {
    const V = { ...PADRAO.vazio, ...cfg.vazio }
    const S = { ...PADRAO.espiral, ...cfg.espiral }
    const N = { ...PADRAO.nova, ...cfg.nova }
    const forcaMax = cfg.forcaMax ?? PADRAO.forcaMax
    const metade = cfg.duracao / 2
    const l = a.caixa
    const cx = l.centerX
    const cy = l.centerY

    // gravidade: > 0 puxa para o centro, < 0 empurra para fora (px/s)
    const g = { forca: 0, raioVazio: 0, ativo: true }
    a.aoAtualizar((dt) => puxar(a, g, cx, cy, Phaser.Math.Clamp(g.forca, -forcaMax, forcaMax), dt))

    // ---------- I. o vazio cresce e puxa ----------
    const folga = Math.min(l.width, l.height) / 2
    const raioMax = Math.max(20, folga - a.lacunaMinima - V.margem)
    a.lacuna(folga - raioMax, 'anel de fuga em volta do vazio')

    const buraco = a.decoracao(a.cena.add.image(cx, cy, 'super-asriel-buraco', 0).setDepth(3).setScale(0).setAlpha(0))
    a.cena.tweens.add({ targets: buraco, alpha: 1, duration: 200 })
    a.aoAtualizar((dt, t) => buraco.scene && buraco.setFrame(Math.floor(t / 90) % 6))
    const disco = criarDisco(a, cx, cy, Math.hypot(l.width, l.height) / 2)
    a.aoAtualizar((dt) => girarDisco(disco, g, dt))

    const vazio = { bala: null }
    V.tempos.forEach((t, i) => a.depois(t, () => crescerVazio(a, V, cx, cy, raioMax * V.fracoes[i], V.forcas[i], vazio, buraco, g)))

    // braços da espiral: uma estrela por braço a cada `intervalo`; os braços giram devagar
    const n = Math.max(1, Math.floor((metade - S.inicio - 300) / S.intervalo))
    a.aCada(S.intervalo, (i) => {
      for (let k = 0; k < S.bracos; k++) estrelaEspiral(a, S, cx, cy, g, (k * TAU) / S.bracos + i * S.giroBracos, i + k)
    }, n, S.inicio)
    // distância entre duas estrelas seguidas do mesmo braço logo que a nova nasce (na borda):
    // o braço girou `giroBracos`, a anterior andou um pouco para dentro e para frente
    const r0 = Math.hypot(l.width, l.height) / 2
    const T = S.intervalo / 1000
    a.lacuna(Math.hypot(r0 * (S.giroBracos - (S.velTangencial / r0) * T), S.velRadial * T), 'estrelas seguidas no braço da espiral')

    // ---------- II. colapso -> supernova ----------
    a.depois(metade, () => {
      colapsar(a, vazio, buraco, disco, cx, cy, g)
      g.forca = -N.empurrao
      a.depois(N.duracaoEmpurrao, () => (g.forca = 0))
    })
    let brecha = a.aleatorio(0, TAU)
    for (let k = 0; k < N.aneis; k++) {
      const ultimo = k === N.aneis - 1
      a.depois(metade + 380 + k * N.intervalo, () => {
        brecha += a.escolher([-1, 1]) * a.aleatorio(N.passoBrecha * 0.45, N.passoBrecha)
        anelNova(a, N, cx, cy, brecha, k, 0)
        // o último anel é duplo: um segundo anel colado, com a mesma brecha
        if (ultimo) a.depois(170, () => anelNova(a, N, cx, cy, brecha, k + 1, 0.5))
      })
    }
    // a brecha medida onde ela é menor (logo que o anel sai, no raio dos nós)
    a.lacuna(N.abertura * N.raioNo, 'brecha do anel da supernova')
  },
})

// ---------- gravidade de verdade: mexe no coração ----------

function puxar(a, g, cx, cy, forca, dt) {
  if (!forca) return
  const passo = (forca * dt) / 1000
  for (const c of a.coracoes) {
    if (!c.ativo) continue
    const dx = cx - c.x
    const dy = cy - c.y
    const d = Math.hypot(dx, dy)
    if (d < 1) continue
    // puxando: não arrasta para dentro do próprio vazio (para na borda dele)
    const mover = forca > 0 ? Math.min(passo, Math.max(0, d - g.raioVazio)) : passo
    c.x += (dx / d) * mover
    c.y += (dy / d) * mover
    c.ajustar()
  }
}

// ---------- ato I: o vazio ----------

function crescerVazio(a, cfg, cx, cy, raio, forca, estado, buraco, g) {
  a.aviso({ tipo: 'circulo', x: cx, y: cy, raio, ms: cfg.aviso }, () => {
    if (!g.ativo) return
    tocar(a.cena, 'super-asriel-pulso')
    shake(a.cena, 110, 0.005)
    if (estado.bala) {
      estado.bala.inofensiva = true
      estado.bala.vida = 1
    }
    const bala = a.bala({ x: cx, y: cy, raio, jaAvisada: true, atravessa: true, pulso: 0.05, vida: 999999 })
    bala.sprite.setVisible(false) // quem desenha é o buraco (decoração) por baixo
    estado.bala = bala
    g.raioVazio = raio
    g.forca = forca
    const escala = (raio * 2) / buraco.width
    a.cena.tweens.add({ targets: buraco, scaleX: escala, scaleY: escala, duration: 300, ease: 'Back.Out' })
    particulas(a.cena, cx, cy, { cor: 0xd9d9ff, quantidade: 10, velocidade: 100, vida: 320 })
  })
}

// estrela que desce em espiral: raio diminui, e gira mais rápido quanto mais perto
// (velocidade tangencial = L / r, como um planeta), até ser engolida
function estrelaEspiral(a, cfg, cx, cy, g, ang0, i) {
  const l = a.caixa
  const r0 = Math.hypot(l.width, l.height) / 2 + 6
  const L = cfg.velTangencial * r0
  const fator = () => a.balas.fatorVelocidade ?? 1
  const p = { r: r0, ang: ang0 }
  a.bala({
    x: cx + Math.cos(ang0) * r0,
    y: cy + Math.sin(ang0) * r0,
    raio: 6,
    textura: 'super-asriel-estrelas',
    quadro: i % 6,
    tamanho: 17,
    aviso: cfg.aviso,
    girar: 4,
    vida: 9000,
    atualizar: (b, dt) => {
      // o colapso engole o que ainda estava caindo
      if (!g.ativo) {
        b.morta = true
        particulas(a.cena, b.x, b.y, { cor: 0xffffff, quantidade: 3, velocidade: 80, vida: 200 })
        return
      }
      const s = (dt / 1000) * fator()
      p.r -= cfg.velRadial * s
      p.ang += Math.min(cfg.omegaMax, L / (p.r * p.r)) * s
      b.x = cx + Math.cos(p.ang) * p.r
      b.y = cy + Math.sin(p.ang) * p.r
      if (p.r <= g.raioVazio * 0.85 || p.r < 4) {
        b.morta = true
        particulas(a.cena, b.x, b.y, { cor: 0xb8a8ff, quantidade: 4, velocidade: 60, vida: 220 })
      }
    },
  })
}

// disco de acreção: pontinhos decorativos girando para dentro (mostram a força do puxão)
function criarDisco(a, cx, cy, raio) {
  const pontos = []
  for (let k = 0; k < 22; k++) {
    const img = a.decoracao(a.cena.add.image(cx, cy, 'super-asriel-no', 0).setDepth(2).setScale(0.35).setAlpha(0).setTint(ARCO[k % ARCO.length]))
    pontos.push({ img, r: a.aleatorio(raio * 0.3, raio), ang: a.aleatorio(0, TAU) })
  }
  return { pontos, cx, cy, raio }
}

function girarDisco(d, g, dt) {
  if (!d.pontos.length) return
  const forca = Math.max(0, g.forca)
  const s = dt / 1000
  for (const p of d.pontos) {
    p.r -= (10 + forca * 0.9) * s
    p.ang += (40 + forca) / Math.max(20, p.r) * s * 3
    if (p.r <= g.raioVazio + 2) p.r = d.raio
    p.img.setPosition(d.cx + Math.cos(p.ang) * p.r, d.cy + Math.sin(p.ang) * p.r)
    p.img.setAlpha(forca ? Math.min(0.75, 0.2 + forca / 120) : 0)
  }
}

// ---------- transição: o vazio implode ----------

function colapsar(a, estado, buraco, disco, cx, cy, g) {
  g.ativo = false
  g.raioVazio = 0
  if (estado.bala) {
    estado.bala.inofensiva = true
    estado.bala.vida = 1
  }
  for (const p of disco.pontos) a.cena.tweens.add({ targets: p.img, x: cx, y: cy, alpha: 0, duration: 220, ease: 'Cubic.easeIn' })
  disco.pontos = []
  tocar(a.cena, 'super-asriel-colapso')
  shake(a.cena, 260, 0.015)
  a.cena.tweens.killTweensOf(buraco)
  a.cena.tweens.add({ targets: buraco, scale: 0, angle: 280, duration: 260, ease: 'Cubic.easeIn', onComplete: () => buraco.setVisible(false) })
  const nova = a.decoracao(a.cena.add.image(cx, cy, 'super-asriel-nova').setDepth(3).setScale(0).setAlpha(0.95).setBlendMode(Phaser.BlendModes.ADD))
  a.cena.tweens.add({ targets: nova, scale: 1.6, duration: 260, delay: 180, ease: 'Back.Out' })
  a.cena.tweens.add({ targets: nova, scale: 1.25, duration: 600, delay: 440, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  a.depois(380, () => tocar(a.cena, 'super-asriel-estoura'))
  particulas(a.cena, cx, cy, { cor: 0xffffff, quantidade: 26, velocidade: 190, vida: 440 })
}

// ---------- ato II: anéis da supernova ----------

// `estrelas` nós num círculo em volta do centro, menos os da brecha; piscam
// parados e depois saem juntos para fora (o anel cresce mantendo a brecha)
function anelNova(a, cfg, cx, cy, brecha, k, defasagem) {
  const passo = TAU / cfg.estrelas
  tocar(a.cena, 'super-asriel-pulso')
  for (let i = 0; i < cfg.estrelas; i++) {
    const ang = brecha + cfg.abertura / 2 + (defasagem + i) * passo
    // fora da brecha: o anel cobre TAU - abertura
    const rel = (((ang - brecha) % TAU) + TAU) % TAU
    if (rel < cfg.abertura / 2 || rel > TAU - cfg.abertura / 2) continue
    a.bala({
      x: cx + Math.cos(ang) * cfg.raioNo,
      y: cy + Math.sin(ang) * cfg.raioNo,
      vx: Math.cos(ang) * cfg.velocidade,
      vy: Math.sin(ang) * cfg.velocidade,
      raio: 6,
      textura: 'super-asriel-estrelas',
      quadro: (i + k) % 6,
      tamanho: 17,
      aviso: cfg.aviso,
      girar: 6,
      vida: 2600,
    })
  }
}
