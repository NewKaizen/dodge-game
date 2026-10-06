import Phaser from 'phaser'
import { FONTE } from '../constants.js'
import { tocar } from '../audio.js'
import { GLIFOS, QUADRO, COLUNAS, MIOLO_O } from './sprites/logo.js'

// O título do menu, no canto de cima à esquerda: logo neon com um disco
// girando atrás e o subtítulo.
//
//   const logo = criarLogo(cena, area, { titulo, subtitulo })   area = LOGO de layout.js
//   await logo.entrar({ rapido })    aparece (rapido: sem a animação, ao voltar de outra tela)
//   logo.batida(n)                   pulso da música
//   logo.sair()                      JOGAR: some
//   logo.atualizar(delta)
//
// Profundidades 20-29.
//
// As letras são tubos de neon desenhados em pixel art (scripts/menu/logo.py):
// cada uma tem o quadro aceso, o apagado e o halo (ADD). Atrás, um disco de
// radar centrado no primeiro O, com o anel pontilhado girando devagar e a
// varredura; dentro do O mora a alma vermelha, que bate no compasso.
// Vida: o neon falha de vez em quando (mau contato), o halo pulsa na batida,
// o radar dá um "ping" a cada compasso e, raramente, o letreiro dá um glitch.

const PROF = { disco: 20, anel: 21, halo: 22, letra: 23, fantasma: 24, almaHalo: 24, alma: 25, sub: 26 }
const SOBREPOR = 4 // px: as letras encostam (os contornos escuros se fundem)
const CIANO = 0x3fd6c8
const MAGENTA = 0xff2f9a
const VOLTA_ANEL = 40000 // ms por volta
const VOLTA_VARREDURA = 6000

const sorteio = (a, b) => a + Math.random() * (b - a)

export function criarLogo(cena, area, { titulo, subtitulo }) {
  const topo = area.y + 30 // y do quadro das letras (o desenho começa 14 px abaixo)

  // ---------- letras ----------
  const letras = []
  let cursor = area.x + 4
  for (const ch of titulo.toUpperCase()) {
    if (ch === ' ') {
      cursor += 18
      continue
    }
    const indice = GLIFOS.indexOf(ch)
    let l
    if (indice >= 0) {
      const [c0, c1] = COLUNAS[ch]
      const x = cursor - c0
      l = {
        ch,
        x,
        y: topo,
        img: cena.add.image(x, topo, 'menu-logo-letras', indice).setOrigin(0).setDepth(PROF.letra),
        halo: cena.add.image(x, topo, 'menu-logo-brilho', indice).setOrigin(0).setDepth(PROF.halo).setBlendMode(Phaser.BlendModes.ADD),
        fantasmas: [CIANO, MAGENTA].map((cor) =>
          cena.add.image(x, topo, 'menu-logo-letras', indice).setOrigin(0).setDepth(PROF.fantasma).setBlendMode(Phaser.BlendModes.ADD).setTint(cor).setVisible(false),
        ),
        indice,
        centro: x + (c0 + c1) / 2,
      }
      cursor += c1 - c0 - SOBREPOR
    } else {
      // letra sem desenho: texto no mesmo espírito
      const t = cena.add
        .text(cursor, topo + 50, ch, { fontFamily: FONTE, fontSize: '64px', color: '#ff3d8b', stroke: '#10061c', strokeThickness: 8 })
        .setOrigin(0, 0.5)
        .setDepth(PROF.letra)
      l = { ch, x: cursor, y: topo + 50, img: t, halo: null, fantasmas: [], texto: true, centro: cursor + t.width / 2 }
      cursor += t.width - 2
    }
    l.estado = 'oculta'
    l.seq = [] // falhas: [[estado, ms], ...]
    l.tSeq = 0
    letras.push(l)
  }
  const fimLetras = cursor + SOBREPOR

  // ---------- disco do radar (no miolo do primeiro O) ----------
  const o = letras.find((l) => l.ch === 'O' && !l.texto)
  const centro = o
    ? { x: o.x + MIOLO_O.x, y: o.y + MIOLO_O.y }
    : { x: (letras[1] ?? letras[0])?.centro ?? area.x + 70, y: topo + 50 }
  const disco = cena.add.image(centro.x, centro.y, 'menu-logo-disco').setDepth(PROF.disco)
  const anel = cena.add.image(centro.x, centro.y, 'menu-logo-anel').setDepth(PROF.anel)
  const varredura = cena.add.image(centro.x, centro.y, 'menu-logo-varredura').setDepth(PROF.anel).setBlendMode(Phaser.BlendModes.ADD)
  const ping = cena.add.image(centro.x, centro.y, 'menu-logo-ping').setDepth(PROF.anel).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)

  // ---------- a alma dentro do O ----------
  const alma = o ? cena.add.image(centro.x, centro.y, 'menu-logo-alma').setDepth(PROF.alma) : null
  const almaHalo = o ? cena.add.image(centro.x, centro.y, 'menu-logo-alma-brilho').setDepth(PROF.almaHalo).setBlendMode(Phaser.BlendModes.ADD) : null

  // ---------- subtítulo (ciano, alinhado ao fim das letras) ----------
  const sub = cena.add
    .text(fimLetras - 2, topo + 102, '', { fontFamily: FONTE, fontSize: '14px', color: '#3fd6c8', stroke: '#06121a', strokeThickness: 4 })
    .setOrigin(1, 0.5)
    .setDepth(PROF.sub)
    .setLetterSpacing(2)
    .setShadow(0, 0, '#3fd6c8', 6, false, true)
  sub.setText(subtitulo)
  const larguraSub = sub.width
  sub.setText('')
  const pontos = cena.add.graphics().setDepth(PROF.sub)
  {
    const x0 = fimLetras - 2 - larguraSub - 10
    for (let i = 0; i < 6; i++) {
      pontos.fillStyle(CIANO, 1 - i * 0.14)
      pontos.fillRect(x0 - i * 6, topo + 102, 2, 2)
    }
  }

  // ---------- estado ----------
  const vis = { disco: 0, giro: 0, alma: 0, sub: 0, tudo: 1 }
  let pulso = 0 // 1 na batida, decai
  let tempo = 0
  let ativo = false // vida (falhas, glitch) só depois de entrar
  let saindo = false
  let proximaFalha = sorteio(2500, 6000)
  let proximoGlitch = sorteio(9000, 16000)
  let glitch = 0 // ms restantes do glitch
  let rerolar = 0

  const objetosDoDisco = [disco, anel, varredura]

  function mostrar(l, estado) {
    l.estado = estado
    if (l.texto) {
      l.img.setAlpha(estado === 'oculta' ? 0 : 1).setColor(estado === 'off' ? '#4a2050' : '#ff3d8b')
      if (estado === 'dim') l.img.setAlpha(0.7)
      return
    }
    l.img.setAlpha(estado === 'oculta' ? 0 : estado === 'dim' ? 0.82 : 1)
    l.img.setTexture(estado === 'off' || estado === 'oculta' ? 'menu-logo-apagadas' : 'menu-logo-letras', l.indice)
  }

  // sequência de pisca-pisca numa letra (o último estado fica)
  function piscar(l, seq) {
    l.seq = seq.map((p) => [...p])
    l.tSeq = 0
    mostrar(l, l.seq[0][0])
  }

  const SEQ_ACENDER = [['on', 45], ['off', 60], ['on', 30], ['off', 90], ['dim', 40], ['on', 0]]
  const falhaAleatoria = () => {
    const seq = []
    const n = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) seq.push([Math.random() < 0.7 ? 'off' : 'dim', sorteio(30, 90)], ['on', sorteio(25, 110)])
    seq.push(['on', 0])
    return seq
  }

  function falhar() {
    const desenhadas = letras.filter((l) => !l.texto)
    if (!desenhadas.length) return
    if (Math.random() < 0.15) {
      // o letreiro inteiro pisca junto
      const seq = falhaAleatoria()
      letras.forEach((l) => piscar(l, seq))
    } else {
      const l = desenhadas[Math.floor(Math.random() * desenhadas.length)]
      piscar(l, falhaAleatoria())
    }
    tocar(cena, 'menu-logo-falha')
  }

  function rolarGlitch() {
    letras.forEach((l) => {
      if (l.texto) return
      const afetada = Math.random() < 0.55
      l.fantasmas.forEach((f, k) => {
        if (!afetada) return f.setVisible(false)
        const y0 = Math.floor(sorteio(14, 74))
        const h = Math.floor(sorteio(5, 16))
        const dx = (k === 0 ? -1 : 1) * Math.round(sorteio(3, 8))
        f.setFrame(l.indice).setCrop(0, y0, QUADRO.largura, h).setPosition(l.x + dx, l.y).setAlpha(0.85).setVisible(true)
      })
      l.img.setX(l.x + (afetada ? Math.round(sorteio(-2, 2)) : 0))
      if (l.halo) l.halo.setX(l.img.x)
      if (afetada && Math.random() < 0.25) mostrar(l, 'off')
      else if (l.estado === 'off' && !l.seq.length) mostrar(l, 'on')
    })
  }

  function fimGlitch() {
    letras.forEach((l) => {
      l.fantasmas.forEach((f) => f.setVisible(false))
      if (!l.texto) {
        l.img.setX(l.x)
        l.halo.setX(l.x)
      }
      if (!l.seq.length && l.estado !== 'on') mostrar(l, 'on')
    })
  }

  const esperar = (ms) => new Promise((ok) => cena.time.delayedCall(ms, ok))

  async function entrar({ rapido } = {}) {
    if (rapido) {
      Object.assign(vis, { disco: 1, alma: 1, sub: 1 })
      letras.forEach((l) => mostrar(l, 'on'))
      sub.setText(subtitulo)
      ativo = true
      return
    }
    // o disco abre girando
    cena.tweens.add({ targets: vis, disco: 1, duration: 420, ease: 'Back.easeOut' })
    cena.tweens.add({ targets: vis, giro: { from: -1.4, to: 0 }, duration: 600, ease: 'Cubic.easeOut' })
    await esperar(180)
    // o letreiro aparece apagado e cada letra acende com estalo
    letras.forEach((l) => mostrar(l, 'off'))
    await esperar(140)
    for (const l of letras) {
      piscar(l, SEQ_ACENDER)
      tocar(cena, 'menu-logo-acender')
      await esperar(125)
    }
    await esperar(160)
    // acendeu tudo: um clarão no halo e a alma aparece no O
    pulso = 1.6
    if (alma) {
      tocar(cena, 'menu-logo-alma')
      cena.tweens.add({ targets: vis, alma: { from: 0, to: 1 }, duration: 320, ease: 'Back.easeOut' })
    }
    await esperar(120)
    // o subtítulo é digitado
    vis.sub = 1
    for (let i = 1; i <= subtitulo.length; i++) {
      sub.setText(subtitulo.slice(0, i))
      if (subtitulo[i - 1] !== ' ') await esperar(22)
    }
    ativo = true
  }

  function batida(n) {
    if (saindo) return
    pulso = Math.max(pulso, 1)
    if (n % 4 === 1 && vis.disco > 0.9) {
      cena.tweens.killTweensOf(ping)
      ping.setScale(0.25).setAlpha(0.75)
      cena.tweens.add({ targets: ping, scale: 1.04, alpha: 0, duration: 1100, ease: 'Cubic.easeOut' })
    }
  }

  function sair() {
    if (saindo) return
    saindo = true
    ativo = false
    glitch = 0
    fimGlitch()
    letras.forEach((l) => {
      l.seq = []
      mostrar(l, 'on')
    })
    pulso = 2 // estoura o brilho e some
    tocar(cena, 'menu-logo-falha')
    cena.tweens.add({ targets: vis, tudo: 0, duration: 240, ease: 'Cubic.easeIn' })
  }

  function atualizar(delta) {
    tempo += delta
    pulso *= Math.exp(-delta / 170)

    // giro do radar
    anel.rotation += (delta / VOLTA_ANEL) * Math.PI * 2
    varredura.rotation += (delta / VOLTA_VARREDURA) * Math.PI * 2
    const d = vis.disco * vis.tudo
    const escala = (0.55 + 0.45 * vis.disco) * (saindo ? 1 + (1 - vis.tudo) * 0.15 : 1)
    objetosDoDisco.forEach((obj) => obj.setScale(escala))
    disco.setAlpha(d).setRotation(vis.giro)
    anel.setAlpha(d * (0.7 + 0.3 * Math.min(pulso, 1)))
    varredura.setAlpha(d * 0.55)
    if (saindo) ping.setAlpha(Math.min(ping.alpha, vis.tudo))

    // falhas e glitch
    if (ativo) {
      proximaFalha -= delta
      if (proximaFalha <= 0) {
        falhar()
        proximaFalha = sorteio(3000, 8000)
      }
      proximoGlitch -= delta
      if (proximoGlitch <= 0) {
        glitch = sorteio(180, 300)
        rerolar = 0
        proximoGlitch = sorteio(10000, 18000)
        tocar(cena, 'menu-logo-glitch')
      }
    }
    if (glitch > 0) {
      glitch -= delta
      rerolar -= delta
      if (glitch <= 0) fimGlitch()
      else if (rerolar <= 0) {
        rolarGlitch()
        rerolar = 50
      }
    }

    // letras: sequências de pisca e o halo (tremulando de leve + pulso)
    const tremor = 0.04 * Math.sin(tempo / 37) * Math.sin(tempo / 113)
    const haloBase = Math.min(1, 0.5 + tremor + 0.3 * pulso)
    for (const l of letras) {
      if (l.seq.length) {
        l.tSeq += delta
        while (l.seq.length && l.seq[0][1] > 0 && l.tSeq >= l.seq[0][1]) {
          l.tSeq -= l.seq[0][1]
          l.seq.shift()
          if (l.seq.length) mostrar(l, l.seq[0][0])
        }
        if (l.seq.length && l.seq[0][1] === 0) l.seq = []
      }
      const fator = l.estado === 'on' ? 1 : l.estado === 'dim' ? 0.3 : 0
      if (l.halo) l.halo.setAlpha(haloBase * fator * vis.tudo)
      if (l.estado !== 'oculta') l.img.setAlpha((l.estado === 'dim' ? 0.82 : 1) * vis.tudo)
      if (saindo) {
        const sobe = (1 - vis.tudo) * 6
        l.img.setY(l.y - sobe)
        l.halo?.setY(l.y - sobe)
      }
    }

    // alma: bate na batida
    if (alma) {
      const s = vis.alma * (1 + 0.28 * Math.min(pulso, 1.2))
      alma.setScale(s).setAlpha(Math.min(1, vis.alma) * vis.tudo)
      almaHalo.setScale(0.8 + 0.5 * Math.min(pulso, 1.2)).setAlpha(Math.min(1, vis.alma) * (0.35 + 0.45 * Math.min(pulso, 1)) * vis.tudo)
    }
    sub.setAlpha(vis.sub * vis.tudo * (0.92 + 0.08 * Math.sin(tempo / 300)))
    pontos.setAlpha(vis.sub * vis.tudo)
  }

  // começa tudo invisível (entrar() mostra)
  letras.forEach((l) => mostrar(l, 'oculta'))
  atualizar(0)
  return { entrar, batida, sair, atualizar }
}
