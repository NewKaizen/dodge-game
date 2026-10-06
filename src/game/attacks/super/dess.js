import { definirAtaque } from '../definir.js'
import { ATAQUE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { shake } from '../../effects/shake.js'
import { particulas } from '../../effects/particulas.js'

// SUPER de Dess: ÚLTIMO BIS. A caixa vira um braço de guitarra com TRASTES
// (faixas verticais, como um Guitar Hero de verdade) e o show tem um PULSO
// fixo: tudo acontece em cima de uma batida (a.aCada no tempo da música), com
// as luzes do palco piscando junto. Quatro partes, cada vez mais rápidas:
//
//   I.   Levada  - um acorde por tempo, num traste só.
//   II.  Refrão  - dois trastes por tempo (power chord), sempre sobrando um.
//   III. Solo    - meio tempo cada nota: uma escala correndo pelo braço, com
//        "bends" (duas notas) de vez em quando.
//   IV.  Mergulho do whammy - a guitarra cai do alto e crava no palco; duas
//        ondas de choque circulares varrem a caixa a partir do impacto.
//
// Justiça:
//   - todo acorde pisca a faixa do traste por `aviso` ms (a nota cai visível
//     por cima, decorativa) antes de valer: a.aviso() + a.parede() (eixo x,
//     ocupados = trastes acesos) garantem que sobra sempre pelo menos um
//     traste inteiro livre (>= a.lacunaMinima: é assim que os trastes nascem);
//   - o acorde em si dura pouco (sai suave: vira inofensivo e desaparece);
//   - a onda de choque final nasce no centro, parada e piscando por
//     `avisoClimax` ms (pode ficar em cima dela à vontade) antes de abrir um
//     vão angular (sorteado perto do coração, nunca embaixo dele) e sair
//     correndo para fora: o vão vale em QUALQUER raio, então dá tempo de se
//     posicionar nele enquanto a onda ainda está parada.
//
// Config:
//   bpm            andamento do show (define o tempo de cada batida)
//   aviso          aviso de cada nota da Levada (ms)
//   avisoAcorde    aviso dos acordes (2 trastes) do Refrão
//   avisoSolo      aviso de cada nota do Solo (mais rápido, mas nunca < telegrafoMs)
//   avisoClimax    aviso das ondas de choque do Mergulho
//   fases          { verso, refrao, solo, climax } ms de cada parte (soma = duracao)
const CORES_SHOW = [0xff5070, 0xffb03a, 0xffe14a, 0xffffff]

export default definirAtaque({
  nome: 'superDess',
  padrao: {
    duracao: 9000,
    bpm: 128,
    aviso: 650,
    avisoAcorde: 720,
    avisoSolo: 520,
    avisoClimax: 650,
    fases: { verso: 2500, refrao: 2500, solo: 2200, climax: 1800 },
  },
  iniciar(a, cfg) {
    const beat = Math.round(60000 / cfg.bpm)
    const palco = montarPalco(a)
    const luzes = montarLuzes(a)
    let k = 0
    const corDoGolpe = () => CORES_SHOW[k++ % CORES_SHOW.length]

    // o pulso do show: as luzes do palco piscam em TODO tempo, do início ao fim
    a.aCada(beat, () => pulsar(a, luzes))

    // ---------- I. Levada: um acorde por tempo ----------
    a.aCada(
      beat,
      () => {
        const lane = escolherTrastes(a, palco, 1, 0.5)[0]
        acorde(a, cfg, palco, [lane], Math.max(ATAQUE.telegrafoMs, cfg.aviso), corDoGolpe())
        ondaAmp(a, a.escolher([-1, 1]))
      },
      Math.max(1, Math.round(cfg.fases.verso / beat)),
    )

    // ---------- II. Refrão: power chord (2 trastes) ----------
    a.depois(cfg.fases.verso, () => {
      let lado = -1
      a.aCada(
        beat,
        () => {
          const trastes = escolherTrastes(a, palco, 2, 0.7)
          acorde(a, cfg, palco, trastes, Math.max(ATAQUE.telegrafoMs, cfg.avisoAcorde), corDoGolpe())
          ondaAmp(a, lado)
          lado *= -1
        },
        Math.max(1, Math.round(cfg.fases.refrao / beat)),
      )
    })

    // ---------- III. Solo: escala correndo pelo braço ----------
    a.depois(cfg.fases.verso + cfg.fases.refrao, () => {
      const meioBeat = beat / 2
      let atual = Math.floor(palco.lanes / 2)
      let dir = 1
      a.aCada(
        meioBeat,
        (i) => {
          atual += dir
          if (atual <= 0 || atual >= palco.lanes - 1) dir *= -1
          const bend = palco.lanes > 3 && i % 5 === 4
          const trastes = bend ? [...new Set([atual, limitar(atual + dir, 0, palco.lanes - 1)])] : [atual]
          acorde(a, cfg, palco, trastes, Math.max(ATAQUE.telegrafoMs, cfg.avisoSolo), corDoGolpe())
        },
        Math.max(1, Math.round(cfg.fases.solo / meioBeat) - 1),
      )
    })

    // ---------- IV. Mergulho do whammy ----------
    a.depois(cfg.fases.verso + cfg.fases.refrao + cfg.fases.solo, () => climax(a, cfg, palco))
  },
})

function limitar(v, min, max) {
  return Math.min(Math.max(v, min), max)
}

// ---------- o palco: trastes verticais do braço da guitarra ----------

function montarPalco(a) {
  const l = a.caixa
  const minimo = a.lacunaMinima + 6
  const lanes = Math.max(3, Math.min(6, Math.floor(l.width / minimo)))
  const larguraReal = l.width / lanes
  a.lacuna(larguraReal, 'traste livre')
  const trastes = []
  for (let i = 0; i < lanes; i++) {
    const x = l.left + (i + 0.5) * larguraReal
    const img = a.decoracao(
      a.cena.add
        .image(x, l.centerY, 'super-dess-traste', i % 2)
        .setDisplaySize(larguraReal - 3, l.height)
        .setDepth(2)
        .setAlpha(0.14),
    )
    trastes.push({ x, img })
  }
  return { lanes, larguraReal, left: l.left, trastes }
}

function trasteDoAlvo(palco, alvo) {
  return limitar(Math.floor((alvo.x - palco.left) / palco.larguraReal), 0, palco.lanes - 1)
}

// sorteia `qtd` trastes ativos (sempre sobra pelo menos 1 traste inteiro livre)
function escolherTrastes(a, palco, qtd, mirar) {
  const total = palco.lanes
  const n = Math.min(qtd, total - 1)
  const indices = new Set()
  if (a.aleatorio(0, 1) < mirar) indices.add(trasteDoAlvo(palco, a.alvo()))
  while (indices.size < n) indices.add(a.inteiro(0, total - 1))
  return [...indices]
}

// ---------- o acorde: a nota cai, o traste acende, o golpe bate ----------

function acorde(a, cfg, palco, lanes, aviso, cor) {
  const l = a.caixa
  a.parede({ eixo: 'x', ocupados: lanes.map((i) => [palco.left + i * palco.larguraReal, palco.left + (i + 1) * palco.larguraReal]) })

  for (const i of lanes) {
    const x = palco.trastes[i].x
    const traste = palco.trastes[i].img
    const nota = a.decoracao(a.cena.add.image(x, l.top - 12, 'super-dess-nota').setDepth(6).setTint(cor).setScale(0).setAlpha(0.95))
    a.cena.tweens.add({ targets: nota, scale: 1.4, y: l.bottom - 10, duration: aviso, ease: 'Cubic.easeIn' })
    a.cena.tweens.add({ targets: nota, angle: 360, duration: aviso, ease: 'Linear' })
    a.cena.tweens.add({ targets: traste, alpha: 0.4, duration: aviso * 0.85, ease: 'Sine.easeIn' })

    a.aviso(
      { tipo: 'area', x: x - palco.larguraReal / 2 + 3, y: l.top, largura: palco.larguraReal - 6, altura: l.height, ms: aviso },
      () => {
        tocar(a.cena, 'super-dess-acorde')
        shake(a.cena, 70, 0.004)
        a.cena.tweens.killTweensOf(nota)
        nota.destroy()
        a.cena.tweens.add({ targets: traste, alpha: 0.14, duration: 220 })
        const golpe = a.bala({
          x,
          y: l.centerY,
          largura: palco.larguraReal - 6,
          altura: l.height - 4,
          textura: 'super-dess-impacto',
          cor,
          jaAvisada: true,
          vida: 220,
          atravessa: true,
          pulso: 0,
          // meio transparente: o coração continua visível através do golpe
          atualizar: (b) => {
            if (b.vida < 110) b.inofensiva = true
            b.sprite.setAlpha(0.72 * Math.min(1, b.vida / 110))
          },
        })
        // o desenho do golpe tem exatamente o tamanho da faixa que machuca (a textura é quadrada)
        golpe.sprite.setDisplaySize(palco.larguraReal - 6, l.height - 4)
        golpe.escalaX = golpe.sprite.scaleX
        golpe.escalaY = golpe.sprite.scaleY
        particulas(a.cena, x, l.centerY, { cor, quantidade: 7, velocidade: 150, vida: 300 })
      },
    )
  }
}

// ---------- palco: luzes pulsando no tempo + ondas do amplificador ----------

function montarLuzes(a) {
  const l = a.caixa
  const cores = [0xff5070, 0xffb03a, 0xffe14a]
  return cores.map((cor, k) => {
    const x = l.left + l.width * (0.2 + k * 0.3)
    const g = a.decoracao(a.cena.add.graphics().setDepth(1).setPosition(x, l.top - 6).setAlpha(0.25))
    g.fillStyle(cor, 0.16)
    g.fillTriangle(0, 0, -l.width * 0.22, l.height + 14, l.width * 0.22, l.height + 14)
    return g
  })
}

function pulsar(a, luzes) {
  for (const g of luzes) a.cena.tweens.add({ targets: g, scaleY: 1.1, duration: 90, yoyo: true, ease: 'Sine.easeOut' })
}

function ondaAmp(a, lado) {
  const l = a.caixa
  const x = lado < 0 ? l.left : l.right
  const g = a.decoracao(a.cena.add.ellipse(x, l.centerY, 8, l.height * 0.55, 0xffb03a, 0.16).setDepth(3))
  a.cena.tweens.add({ targets: g, scaleX: 7, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => g.destroy() })
}

// ---------- IV. mergulho do whammy: a guitarra crava e explode em ondas ----------

function climax(a, cfg, palco) {
  const l = a.caixa
  const cx = l.centerX
  const cy = l.centerY

  for (const t of palco.trastes) a.cena.tweens.add({ targets: t.img, alpha: 0.08, duration: 300 })

  const sombra = a.decoracao(a.cena.add.ellipse(cx, cy, 10, 6, 0x000000, 0.4).setDepth(3))
  a.cena.tweens.add({ targets: sombra, scaleX: 10, scaleY: 4, duration: 420 })
  const guitarra = a.decoracao(
    a.cena.add.image(cx, l.top - 50, 'super-dess-guitarra').setDepth(8).setScale(0.9).setAngle(-16).setAlpha(0.97),
  )
  tocar(a.cena, 'super-dess-mergulho')
  a.cena.tweens.add({ targets: guitarra, y: cy, angle: 0, duration: 420, ease: 'Cubic.easeIn' })

  a.depois(420, () => {
    tocar(a.cena, 'super-dess-estouro')
    shake(a.cena, 220, 0.014)
    particulas(a.cena, cx, cy, { cor: 0xffe14a, quantidade: 22, velocidade: 210, vida: 420 })
    a.cena.tweens.add({ targets: guitarra, angle: 6, duration: 50, yoyo: true, repeat: 6 })
    a.bala({ x: cx, y: cy, raio: 15, textura: 'super-dess-impacto', tamanho: 50, cor: 0xffe14a, jaAvisada: true, atravessa: true, vida: 180, pulso: 0 })
    anelChoque(a, cfg, cx, cy)
  })
  a.depois(420 + 320, () => anelChoque(a, cfg, cx, cy))

  a.depois(cfg.fases.climax - 180, () => {
    a.cena.tweens.add({ targets: guitarra, alpha: 0, scale: 1.3, duration: 260 })
  })
}

// onda de choque circular que nasce no centro (parada, piscando) e sai
// correndo para fora com um vão angular (vale em qualquer raio: dá pra entrar
// nele enquanto a onda ainda está parada, piscando)
function anelChoque(a, cfg, cx, cy) {
  const l = a.caixa
  const alvo = a.alvo()
  const raio = Math.hypot(l.width, l.height) / 2 + 30
  const quantidade = 18
  const abertura = 1.0
  const angAlvo = Math.atan2(alvo.y - cy, alvo.x - cx)
  const vao = angAlvo + a.escolher([-1, 1]) * a.aleatorio(0.8, 1.7)
  a.lacuna(abertura * raio * 0.5, 'vão da onda de choque')
  const aviso = Math.max(ATAQUE.telegrafoMs, cfg.avisoClimax)
  const passo = (Math.PI * 2 - abertura) / (quantidade - 1)
  const vel = raio / 0.8
  tocar(a.cena, 'super-dess-acorde')
  for (let k = 0; k < quantidade; k++) {
    const ang = vao + abertura / 2 + k * passo
    a.bala({
      x: cx,
      y: cy,
      vx: Math.cos(ang) * vel,
      vy: Math.sin(ang) * vel,
      raio: 7,
      textura: 'super-dess-nota',
      tamanho: 18,
      cor: k % 2 ? 0xffb03a : 0xff5070,
      aviso,
      vida: 1000,
      girar: 5,
      atravessa: true,
    })
  }
}
