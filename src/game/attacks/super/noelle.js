import { definirAtaque } from '../definir.js'
import { ATAQUE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { shake } from '../../effects/shake.js'
import { particulas } from '../../effects/particulas.js'

// SUPER de Noelle: ZERO ABSOLUTO. O chão da caixa vira uma grade de placas de
// gelo que vai sendo CONSUMIDA, sem volta, em três atos:
//
//   I. Geada avança. Pingentes gigantes despencam do teto mirando a placa do
//      coração (ou perto dela): a placa pisca avisando, o pingente cai em
//      cima, racha (segundo aviso, mais curto) e só então quebra de vez —
//      vira um abismo que machuca pelo resto do ataque. Ficar parado demais
//      em cima da MESMA placa também a faz rachar sozinha (o gelo cresce sob
//      os pés de quem não se move). Uma placa quebrada NUNCA volta.
//   II. Nevasca. A caixa embranquece (whiteout) e a neve cai sem parar; os
//      pingentes continuam caindo, agora mais rápido. As placas que ainda
//      estão inteiras pulsam mais fortes que a neve ao redor — são a única
//      rota seguro que sobrou.
//   III. Zero Absoluto. Do centro da caixa saem lanças de gelo em estrela,
//      cada uma com a própria linha de aviso; duas lanças vizinhas ficam de
//      fora (a brecha), sempre perto de onde o coração está quando a estrela
//      começa a avisar.
//
// Justiça:
//   - toda placa pisca (a.aviso) por pelo menos `avisoQueda` ms antes do
//     pingente chegar, e de novo por `avisoRacha` ms (já rachada, visível)
//     antes de quebrar de vez; nunca quebra "no escuro";
//   - uma queda (mirada ou por ficar parado) só acontece se sobrar mais placas
//     inteiras que o mínimo da fase (`minimoSeguras` no Ato I,
//     `minimoSeguraNevasca` na nevasca) — sempre sobra pelo menos uma placa
//     inteira, e cada placa tem lado >= LACUNA_MINIMA;
//   - a estrela final sempre deixa duas lanças vizinhas de fora (a brecha),
//     orientada para perto de onde o coração está quando o aviso começa.
//
// Config:
//   avisoQueda            ms de aviso do pingente caindo até bater na placa
//   avisoRacha            ms da placa já rachada até quebrar de vez
//   parado                ms parado na mesma placa até ela rachar sozinha
//   quedas, quedasNevasca ms de cada pingente mirado (Ato I / nevasca, mais rápida)
//   minimoSeguras         placas inteiras garantidas no Ato I
//   minimoSeguraNevasca   placas inteiras garantidas durante a nevasca
//   nevasca               quando a nevasca começa (ms)
//   fimNevasca            quando a nevasca para (antes do Ato III)
//   raios, avisoEstrela   raios da estrela final e aviso de cada um
export default definirAtaque({
  nome: 'superNoelle',
  padrao: {
    duracao: 9000,
    avisoQueda: 520,
    avisoRacha: 620,
    parado: 1450,
    quedas: [350, 1250, 2150, 3050, 3950, 4800],
    quedasNevasca: [5900, 6500, 7100, 7700],
    minimoSeguras: 3,
    minimoSeguraNevasca: 1,
    nevasca: 5300,
    fimNevasca: 7900,
    raios: 8,
    avisoEstrela: 680,
  },
  iniciar(a, cfg) {
    const grade = montarGrade(a)
    const estado = { nevasca: false, paradas: new Map() }

    cfg.quedas.forEach((ms) => a.depois(ms, () => tentarQueda(a, cfg, grade, estado, false)))
    cfg.quedasNevasca.forEach((ms) => a.depois(ms, () => tentarQueda(a, cfg, grade, estado, true)))

    a.depois(cfg.nevasca, () => iniciarNevasca(a, cfg, grade, estado))
    a.depois(cfg.fimNevasca, () => fimNevasca(a, estado))

    const inicioFinale = Math.max(cfg.fimNevasca + 100, cfg.duracao - cfg.avisoEstrela - 150)
    a.depois(inicioFinale, () => estilhacar(a, cfg, grade))

    a.aoAtualizar((dt) => {
      for (const c of a.coracoes) {
        if (c.ativo) acompanharParado(a, cfg, grade, estado, c, dt)
      }
    })
  },
})

// ---------- a grade de placas ----------

function montarGrade(a) {
  const l = a.caixa
  const lado = a.lacunaMinima + 4 // placas com pelo menos LACUNA_MINIMA de lado
  const colunas = Math.max(2, Math.floor(l.width / lado))
  const linhas = Math.max(2, Math.floor(l.height / lado))
  const g = { colunas, linhas, tiles: [], x: l.left, y: l.top, w: l.width / colunas, h: l.height / linhas }
  a.lacuna(Math.min(g.w, g.h), 'placa de gelo')
  tocar(a.cena, 'super-noelle-tique')
  for (let r = 0; r < linhas; r++) {
    for (let c = 0; c < colunas; c++) {
      const x = g.x + (c + 0.5) * g.w
      const y = g.y + (r + 0.5) * g.h
      const img = a.decoracao(
        a.cena.add
          .image(x, y, 'super-noelle-placa', (c + r) % 2)
          .setDisplaySize(g.w, g.h)
          .setDepth(1)
          .setAlpha(0),
      )
      a.cena.tweens.add({ targets: img, alpha: 0.5, duration: 200, delay: (c + r) * 55, ease: 'Sine.easeOut' })
      g.tiles.push({ img, x, y, w: g.w, h: g.h, c, r, estado: 'sa' })
    }
  }
  return g
}

const tileEm = (g, x, y) => {
  const c = Math.min(g.colunas - 1, Math.max(0, Math.floor((x - g.x) / g.w)))
  const r = Math.min(g.linhas - 1, Math.max(0, Math.floor((y - g.y) / g.h)))
  return g.tiles[r * g.colunas + c]
}

const segurasRestantes = (g) => g.tiles.filter((t) => t.estado === 'sa')

// ---------- ato I + nevasca: pingentes mirados ----------

function tentarQueda(a, cfg, grade, estado, rapido) {
  const minimo = estado.nevasca ? cfg.minimoSeguraNevasca : cfg.minimoSeguras
  const seguras = segurasRestantes(grade)
  if (seguras.length <= minimo) return // nunca derruba abaixo do mínimo da fase
  const alvo = a.alvo()
  seguras.sort((p, q) => Math.hypot(p.x - alvo.x, p.y - alvo.y) - Math.hypot(q.x - alvo.x, q.y - alvo.y))
  const candidatas = seguras.slice(0, Math.min(4, seguras.length))
  const tile = a.escolher(candidatas)
  a.lacuna(seguras.length > 1 ? grade.w : 0, 'placa segura restante')
  cairPingente(a, cfg, grade, tile, rapido)
}

// Fica parado demais na mesma placa: o gelo racha sozinho debaixo do coração
function acompanharParado(a, cfg, grade, estado, c, dt) {
  const tile = tileEm(grade, c.x, c.y)
  let info = estado.paradas.get(c)
  if (!info || info.tile !== tile) {
    estado.paradas.set(c, { tile, tempo: 0 })
    return
  }
  info.tempo += dt
  if (info.tempo < cfg.parado || tile.estado !== 'sa') return
  const minimo = estado.nevasca ? cfg.minimoSeguraNevasca : cfg.minimoSeguras
  if (segurasRestantes(grade).length > minimo) {
    tocar(a.cena, 'super-noelle-tique')
    impactoPingente(a, cfg, grade, tile)
  }
  info.tempo = 0
}

function cairPingente(a, cfg, grade, tile, rapido) {
  tile.estado = 'alvo'
  const aviso = Math.max(ATAQUE.telegrafoMs, rapido ? cfg.avisoQueda * 0.72 : cfg.avisoQueda)
  a.aviso({ tipo: 'area', x: tile.x - tile.w / 2 + 2, y: tile.y - tile.h / 2 + 2, largura: tile.w - 4, altura: tile.h - 4, ms: aviso }, () =>
    impactoPingente(a, cfg, grade, tile),
  )
  const escala = Math.min(tile.w, tile.h, 46) / 16
  const altura = 46 * escala
  const pingente = a.decoracao(
    a.cena.add.image(tile.x, tile.y - altura * 1.25, 'super-noelle-pingente').setDepth(6).setScale(escala).setAlpha(0.95),
  )
  a.cena.tweens.add({ targets: pingente, y: tile.y - altura * 0.3, duration: aviso, ease: 'Cubic.easeIn' })
  tocar(a.cena, 'super-noelle-tique')
  tile._pingente = pingente
}

// pingente atinge a placa: ela racha (segundo aviso, mais curto) antes de quebrar de vez
function impactoPingente(a, cfg, grade, tile) {
  if (tile._pingente) {
    a.cena.tweens.killTweensOf(tile._pingente)
    tile._pingente.destroy()
    tile._pingente = null
  }
  shake(a.cena, 90, 0.004)
  particulas(a.cena, tile.x, tile.y, { cor: 0xbfe8ff, quantidade: 10, velocidade: 140, vida: 300 })
  const estouro = a.decoracao(a.cena.add.image(tile.x, tile.y, 'super-noelle-impacto').setDepth(7).setScale(0.3).setAlpha(0.9))
  a.cena.tweens.add({
    targets: estouro,
    scale: (Math.max(tile.w, tile.h) / 32) * 1.15,
    alpha: 0,
    duration: 260,
    ease: 'Quad.easeOut',
    onComplete: () => estouro.destroy(),
  })

  tile.estado = 'rachando'
  const racha = a.decoracao(
    a.cena.add
      .image(tile.x, tile.y, 'super-noelle-rachadura')
      .setDepth(2)
      .setDisplaySize(tile.w - 4, tile.h - 4)
      .setAlpha(0),
  )
  a.cena.tweens.add({ targets: racha, alpha: 0.95, duration: 110 })
  a.cena.tweens.add({ targets: racha, alpha: 0.45, duration: 110, delay: 110, yoyo: true, repeat: -1 })
  tile._racha = racha

  const avisoQuebra = Math.max(ATAQUE.telegrafoMs, cfg.avisoRacha)
  a.aviso(
    { tipo: 'area', x: tile.x - tile.w / 2 + 2, y: tile.y - tile.h / 2 + 2, largura: tile.w - 4, altura: tile.h - 4, ms: avisoQuebra },
    () => quebrarPlaca(a, tile),
  )
}

// a placa quebra de vez: vira um abismo que machuca pelo resto do ataque (não volta)
function quebrarPlaca(a, tile) {
  if (tile.estado === 'quebrada') return
  tile.estado = 'quebrada'
  tocar(a.cena, 'super-noelle-quebra')
  shake(a.cena, 140, 0.007)
  if (tile._racha) {
    a.cena.tweens.killTweensOf(tile._racha)
    tile._racha.destroy()
    tile._racha = null
  }
  tile.img.setTexture('super-noelle-buraco').setAlpha(0.95)
  particulas(a.cena, tile.x, tile.y, { cor: 0xeaf7ff, quantidade: 14, velocidade: 170, vida: 420 })
  invisivel(a.bala({ x: tile.x, y: tile.y, largura: tile.w - 10, altura: tile.h - 10, jaAvisada: true, atravessa: true, pulso: 0 }))
}

// ---------- ato II: a nevasca ----------

function iniciarNevasca(a, cfg, grade, estado) {
  estado.nevasca = true
  tocar(a.cena, 'super-noelle-vento')
  shake(a.cena, 220, 0.006)
  const l = a.caixa
  const veu = a.decoracao(a.cena.add.rectangle(l.centerX, l.centerY, l.width, l.height, 0xeaf7ff).setAlpha(0).setDepth(3))
  a.cena.tweens.add({ targets: veu, alpha: 0.48, duration: 700 })
  estado.veu = veu

  const neve = a.decoracao(
    a.cena.add.particles(l.centerX, l.top - 8, 'faisca', {
      x: { min: l.left, max: l.right },
      y: l.top - 8,
      quantity: 2,
      frequency: 45,
      lifespan: 1700,
      speedY: { min: 26, max: 64 },
      speedX: { min: -22, max: 22 },
      scale: { start: 0.85, end: 0.4 },
      alpha: { start: 0.85, end: 0 },
      tint: 0xffffff,
      blendMode: 'ADD',
    }),
  )
  neve.setDepth(4)
  estado.neve = neve

  // as placas que sobraram brilham mais forte que a neve: são a rota segura
  for (const t of grade.tiles) {
    if (t.estado !== 'sa') continue
    const brilho = a.cena.tweens.add({ targets: t.img, alpha: 0.95, duration: 260, delay: (t.c + t.r) * 55, yoyo: true, repeat: -1 })
    t._brilho = brilho
  }
}

function fimNevasca(a, estado) {
  estado.neve?.stop?.()
  if (estado.veu) a.cena.tweens.add({ targets: estado.veu, alpha: 0.2, duration: 500 })
}

// ---------- ato III: Zero Absoluto ----------

function estilhacar(a, cfg, grade) {
  const l = a.caixa
  const cx = l.centerX
  const cy = l.centerY
  const raios = cfg.raios
  const passo = (Math.PI * 2) / raios
  const alvo = a.alvo()
  const gapIndex = Math.round(Math.atan2(alvo.y - cy, alvo.x - cx) / passo)
  const aviso = Math.max(ATAQUE.telegrafoMs, cfg.avisoEstrela)
  const comp = Math.hypot(l.width, l.height) / 2 + 24

  tocar(a.cena, 'super-noelle-vento')
  a.lacuna(grade.w, 'brecha do estilhaçamento') // a brecha de 2 raios vizinhos sempre existe
  for (let i = 0; i < raios; i++) {
    const idx = (((i - gapIndex) % raios) + raios) % raios
    if (idx === 0 || idx === 1) continue // a brecha: dois raios vizinhos de fora
    const ang = i * passo
    const x2 = cx + Math.cos(ang) * comp
    const y2 = cy + Math.sin(ang) * comp
    a.aviso({ tipo: 'linha', x1: cx, y1: cy, x2, y2, espessura: 14, ms: aviso }, () => dispararRaio(a, cx, cy, ang, comp))
  }
}

function dispararRaio(a, cx, cy, ang, comp) {
  tocar(a.cena, 'super-noelle-estilhaco')
  shake(a.cena, 170, 0.008)
  const meio = { x: cx + Math.cos(ang) * comp * 0.5, y: cy + Math.sin(ang) * comp * 0.5 }
  a.bala({
    x: meio.x,
    y: meio.y,
    comprimento: comp,
    espessura: 11,
    angulo: ang,
    textura: 'super-noelle-feixe',
    jaAvisada: true,
    vida: 320,
    atravessa: true,
    pulso: 0,
    atualizar: (bala) => {
      if (bala.vida < 140) {
        bala.inofensiva = true
        bala.sprite.setAlpha(Math.max(0, bala.vida / 140))
      }
    },
  })
  particulas(a.cena, cx + Math.cos(ang) * 40, cy + Math.sin(ang) * 40, { cor: 0xeaf7ff, quantidade: 8, velocidade: 150, vida: 320 })
}

// bala só de colisão: o desenho é a textura da placa (buraco) / do feixe
function invisivel(b) {
  b.sprite.setVisible(false)
  return b
}
