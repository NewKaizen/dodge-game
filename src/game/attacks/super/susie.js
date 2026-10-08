import { definirAtaque } from '../definir.js'
import { lacunasLivres } from '../validacao.js'
import { tocar } from '../../audio.js'
import { shake } from '../../effects/shake.js'
import { particulas } from '../../effects/particulas.js'

// SUPER de Susie: DEMOLIÇÃO TOTAL. O chão da caixa vira um piso de lajotas e
// a Susie põe tudo abaixo, em dois atos:
//
//   1. Machadadas (vista de cima): a sombra de um machado GIGANTE cresce sobre
//      a coluna de lajotas onde o coração está, e o machado despenca do alto
//      da tela. A pancada vale na coluna inteira, o machado fica CRAVADO no
//      chão (cabeça e cabo machucam), o tranco empurra os corações para longe,
//      pedras de entulho piscam e saem quicando para os lados e as lajotas
//      racham e DESABAM em buracos (a coluna toda, menos uma "ponte", e uma
//      vizinha). Depois a Susie arranca o machado e os buracos se fecham.
//   2. Rude Buster: meias-luas de energia roxa varrem a caixa de uma borda à
//      outra. As faixas que vão ser varridas piscam antes (o vão fica apagado):
//      vão embaixo, vão em cima, vão no meio, vão do outro lado da caixa e,
//      por fim, uma de cima para baixo com o vão do outro lado da caixa.
//
// Justiça:
//   - a coluna da machadada pisca `aviso` ms (sombra crescendo) antes de valer;
//     o machado cravado e as pedras ficam dentro dela; as pedras ainda piscam
//     `avisoPedra` ms antes de voar;
//   - cada lajota racha e pisca `avisoBuraco` ms antes de desabar; a coluna
//     sempre deixa uma lajota inteira de ponte (a.parede valida);
//   - o empurrão é curto (velocidade x ms ~ 25 px) e dá para andar contra ele;
//   - o Rude Buster telegrafa as faixas que vai varrer; o vão tem pelo menos
//     LACUNA_MINIMA (+ folga) e a.parede valida.
//
// Config (objetos parciais completam com o padrão):
//   machadadas  { inicios, aviso, cravado, pedras, velocidadePedra, avisoPedra, avisoBuraco, buraco }
//   buster      { inicios, aviso, avisoFinal, velocidade, lacuna }
//   empurrao    { velocidade, ms }
const PADRAO = {
  machadadas: { inicios: [150, 1150, 2150, 3150], aviso: 620, cravado: 900, pedras: 4, velocidadePedra: 125, avisoPedra: 420, avisoBuraco: 560, buraco: 1600 },
  buster: { inicios: [4400, 5200, 6000, 6800, 7650], aviso: 600, avisoFinal: 750, velocidade: 310, lacuna: 60 },
  empurrao: { velocidade: 110, ms: 220 },
}

// de onde vem cada Rude Buster e onde fica o vão
const PLANOS = [
  { de: 'esquerda', vao: 'baixo' },
  { de: 'direita', vao: 'cima' },
  { de: 'esquerda', vao: 'meio' },
  { de: 'direita', vao: 'longe' },
  { de: 'cima', vao: 'longe' },
]

const T = (nome) => `super-susie-${nome}`
const ROXO = 0xb05cff
const MAGENTA = 0xff6edc
const AMARELO = 0xffe14a

// geometria do sprite do machado (60x104, scripts/super/susie.py)
const MACHADO = { largura: 60, altura: 104, cabeca: { x: 32, y: 25, largura: 42, altura: 26 }, cabo: { x: 21, y: 66, largura: 6, altura: 60 } }

const limitar = (v, min, max) => Math.min(Math.max(v, min), max)

export default definirAtaque({
  nome: 'superSusie',
  padrao: { duracao: 9000, machadadas: {}, buster: {}, empurrao: {} },
  iniciar(a, cfg) {
    const M = { ...PADRAO.machadadas, ...cfg.machadadas }
    const B = { ...PADRAO.buster, ...cfg.buster }
    const E = { ...PADRAO.empurrao, ...cfg.empurrao }
    const estado = { seguidores: [], empurroes: [] }
    const chao = criarChao(a)

    a.aoAtualizar((dt) => atualizar(a, estado, E, dt))
    M.inicios.forEach((t) => a.depois(t, () => machadada(a, M, chao, estado)))
    B.inicios.forEach((t, i) => a.depois(t, () => rudeBuster(a, B, i, i === B.inicios.length - 1, estado)))
  },
})

// ---------- o chão de lajotas ----------

function criarChao(a) {
  const l = a.caixa
  const colunas = Math.max(3, Math.floor(l.width / 48))
  const linhas = Math.max(2, Math.floor(l.height / 50))
  const tw = l.width / colunas
  const th = l.height / linhas
  const lajes = []
  for (let c = 0; c < colunas; c++) {
    lajes.push([])
    for (let r = 0; r < linhas; r++) {
      const img = a.decoracao(a.cena.add.image(l.left + (c + 0.5) * tw, l.top + (r + 0.5) * th, T('laje')).setDepth(1).setDisplaySize(tw, th).setAlpha(0))
      const base = { x: img.scaleX, y: img.scaleY }
      // o piso se monta em diagonal
      a.cena.tweens.add({ targets: img, alpha: 0.5, duration: 220, delay: (c + r) * 45 })
      lajes[c].push({ img, base, ocupada: false })
    }
  }
  return { x: l.left, y: l.top, colunas, linhas, tw, th, lajes }
}

// ---------- ato 1: machadadas ----------

function machadada(a, M, chao, estado) {
  const l = a.caixa
  const alvo = a.alvo()
  const c = limitar(Math.floor((alvo.x - chao.x) / chao.tw), 0, chao.colunas - 1)
  const x0 = chao.x + c * chao.tw
  const cx = x0 + chao.tw / 2
  const cy = l.centerY
  // o machado cabe na coluna: a cabeça tem a largura dela
  const esc = Math.min((l.height * 0.92) / MACHADO.altura, (chao.tw - 4) / 46)
  const sx = cx - (MACHADO.cabeca.x - MACHADO.largura / 2) * esc
  const px = (x) => sx + (x - MACHADO.largura / 2) * esc
  const py = (y) => cy + (y - MACHADO.altura / 2) * esc

  a.aviso({ tipo: 'area', x: x0 + 2, y: l.top, largura: chao.tw - 4, altura: l.height, ms: M.aviso })
  // a sombra cresce: o machado está caindo lá do alto
  const sombra = a.decoracao(a.cena.add.image(sx, cy, T('machado')).setTint(0x000000).setDepth(3).setAlpha(0).setScale(esc * 0.45))
  a.cena.tweens.add({ targets: sombra, alpha: 0.6, scale: esc, duration: M.aviso, ease: 'Quad.easeIn' })
  // e despenca "da câmera" para dentro da caixa
  const machado = a.decoracao(a.cena.add.image(sx, cy - 24, T('machado')).setDepth(7).setAlpha(0).setScale(esc * 3.4).setAngle(-40))
  a.cena.tweens.add({ targets: machado, alpha: 1, scale: esc, angle: 0, y: cy, delay: M.aviso - 260, duration: 260, ease: 'Quad.easeIn' })
  a.depois(M.aviso - 260, () => tocar(a.cena, 'superCorte'))

  a.depois(M.aviso, () => {
    tocar(a.cena, 'super-susie-pancada')
    shake(a.cena, 200, 0.012)
    a.cena.tweens.add({ targets: sombra, alpha: 0, duration: 120 })
    const est = a.decoracao(a.cena.add.image(cx, py(MACHADO.cabeca.y), T('impacto')).setDepth(8).setScale(0.6))
    a.cena.tweens.add({ targets: est, scale: 2.2, alpha: 0, angle: 40, duration: 320, ease: 'Quad.easeOut' })
    particulas(a.cena, cx, py(MACHADO.cabeca.y), { cor: MAGENTA, quantidade: 14, velocidade: 170, vida: 380 })

    // a pancada vale na coluna inteira (só um instante)...
    invisivel(a.bala({ x: cx, y: cy, largura: chao.tw - 6, altura: l.height, jaAvisada: true, atravessa: true, vida: 180, pulso: 0 }))
    // ...e o machado fica cravado: cabeça e cabo machucam até ser arrancado
    const { cabeca, cabo } = MACHADO
    invisivel(a.bala({ x: px(cabeca.x), y: py(cabeca.y), largura: cabeca.largura * esc, altura: cabeca.altura * esc, jaAvisada: true, atravessa: true, vida: M.cravado, pulso: 0 }))
    invisivel(a.bala({ x: px(cabo.x), y: py(cabo.y), largura: cabo.largura * esc, altura: cabo.altura * esc, jaAvisada: true, atravessa: true, vida: M.cravado, pulso: 0 }))
    a.cena.tweens.add({ targets: machado, angle: 4, duration: 45, yoyo: true, repeat: 4 }) // vibrando no chão

    // o tranco empurra os corações para longe da coluna
    for (const coracao of a.coracoes) {
      if (!coracao.ativo || Math.abs(coracao.x - cx) > chao.tw * 1.6) continue
      estado.empurroes.push({ coracao, dx: Math.sign(coracao.x - cx) || 1, restante: null })
    }

    entulho(a, M, cx, l)
    desabar(a, M, chao, c)

    // a Susie arranca o machado (volta girando para cima, sem dano)
    a.depois(M.cravado, () => {
      a.cena.tweens.killTweensOf(machado)
      a.cena.tweens.add({ targets: machado, y: cy - 60, scale: esc * 2.8, angle: c % 2 ? 220 : -220, alpha: 0, duration: 380, ease: 'Quad.easeIn' })
      particulas(a.cena, cx, cy, { cor: ROXO, quantidade: 8, velocidade: 90, vida: 300 })
    })
  })
}

// pedras de entulho: piscam dentro da coluna atingida e saem quicando para os lados
function entulho(a, M, cx, l) {
  const n = Math.round(M.pedras)
  const primeiro = a.escolher([-1, 1])
  for (let k = 0; k < n; k++) {
    const lado = k % 2 ? -primeiro : primeiro
    const y = l.top + ((k + 0.5) * l.height) / n + a.aleatorio(-8, 8)
    a.bala({
      x: cx + lado * 6,
      y,
      raio: 5,
      textura: T('pedra'),
      quadro: k % 4,
      tamanho: 14,
      aviso: M.avisoPedra,
      vx: lado * M.velocidadePedra * a.aleatorio(0.85, 1.15),
      vy: a.aleatorio(-40, 40),
      quicar: 1,
      vida: 2200,
      girar: 7 * lado,
    })
  }
}

// a coluna desaba (menos uma lajota de ponte) e racha uma lajota vizinha
function desabar(a, M, chao, c) {
  const ponte = a.inteiro(0, chao.linhas - 1)
  const lista = []
  for (let r = 0; r < chao.linhas; r++) if (r !== ponte) lista.push([c, r])
  const lado = c === 0 ? 1 : c === chao.colunas - 1 ? -1 : a.escolher([-1, 1])
  lista.push([c + lado, a.inteiro(0, chao.linhas - 1)])
  a.parede({ eixo: 'y', lacunas: [[chao.y + ponte * chao.th, chao.y + (ponte + 1) * chao.th]] })
  const som = { tocou: false }
  lista.forEach(([cc, r], i) => a.depois(100 + i * 70, () => rachar(a, M, chao, cc, r, som)))
}

function rachar(a, M, chao, c, r, som) {
  const laje = chao.lajes[c][r]
  if (laje.ocupada) return
  laje.ocupada = true
  const x = chao.x + (c + 0.5) * chao.tw
  const y = chao.y + (r + 0.5) * chao.th
  const racha = a.decoracao(a.cena.add.image(x, y, T('racha')).setDepth(2).setDisplaySize(chao.tw, chao.th))
  a.cena.tweens.add({ targets: racha, alpha: 0.35, duration: 90, yoyo: true, repeat: -1 })
  a.aviso({ tipo: 'area', x: x - chao.tw / 2 + 3, y: y - chao.th / 2 + 3, largura: chao.tw - 6, altura: chao.th - 6, ms: M.avisoBuraco }, () => {
    if (!som.tocou) {
      som.tocou = true
      tocar(a.cena, 'super-susie-desaba')
    }
    a.cena.tweens.killTweensOf(racha)
    racha.destroy()
    // a lajota cai no abismo...
    a.cena.tweens.add({ targets: laje.img, scaleX: laje.base.x * 0.4, scaleY: laje.base.y * 0.4, angle: a.aleatorio(-30, 30), alpha: 0, duration: 260, ease: 'Quad.easeIn' })
    const b = a.bala({ x, y, largura: chao.tw - 14, altura: chao.th - 14, textura: T('buraco'), jaAvisada: true, atravessa: true, vida: M.buraco, pulso: 0 })
    b.sprite.setDisplaySize(chao.tw - 2, chao.th - 2)
    particulas(a.cena, x, y, { cor: ROXO, quantidade: 6, velocidade: 70, vida: 320 })
    // ...e volta quando o buraco fecha (mesmo relógio da bala)
    a.cena.tweens.add({
      targets: laje.img,
      scaleX: laje.base.x,
      scaleY: laje.base.y,
      angle: 0,
      alpha: 0.5,
      delay: M.buraco - 60,
      duration: 200,
      ease: 'Back.Out',
      onComplete: () => (laje.ocupada = false),
    })
  })
}

// ---------- ato 2: Rude Buster ----------

function rudeBuster(a, B, i, final, estado) {
  const l = a.caixa
  const plano = PLANOS[i % PLANOS.length]
  const vertical = plano.de === 'cima'
  const sentido = plano.de === 'direita' ? -1 : 1
  const aviso = final ? B.avisoFinal : B.aviso
  const vao = Math.max(B.lacuna, a.lacunaMinima + 8)
  // eixo transversal (onde fica o vão) e as faixas que a meia-lua cobre
  const [ini, fim] = vertical ? [l.left, l.right] : [l.top, l.bottom]
  const meio = (ini + fim) / 2
  let centro = meio
  if (plano.vao === 'baixo') centro = fim - vao / 2
  else if (plano.vao === 'cima') centro = ini + vao / 2
  else if (plano.vao === 'longe') {
    const alvo = a.alvo()
    centro = (vertical ? alvo.x : alvo.y) < meio ? fim - vao / 2 - 6 : ini + vao / 2 + 6
  }
  const vaos = [[centro - vao / 2, centro + vao / 2]]
  const faixas = lacunasLivres(ini, fim, vaos).filter(([p, q]) => q - p > 8)
  a.parede({ eixo: vertical ? 'x' : 'y', lacunas: vaos })

  // carregando: as faixas piscam e a meia-lua aparece na borda de entrada
  const cargas = []
  for (const [p, q] of faixas) {
    a.aviso(vertical ? { tipo: 'area', x: p, y: l.top, largura: q - p, altura: l.height, ms: aviso } : { tipo: 'area', x: l.left, y: p, largura: l.width, altura: q - p, ms: aviso })
    const s = (q - p + 10) / 112
    const borda = vertical ? l.top : sentido > 0 ? l.left : l.right
    const pos = (p + q) / 2
    const img = meiaLua(a, s, vertical, sentido).setAlpha(0.25)
    if (vertical) img.setPosition(pos, borda - 6 * s)
    else img.setPosition(borda - sentido * 6 * s, pos)
    a.cena.tweens.add({ targets: img, alpha: 0.8, duration: 80, yoyo: true, repeat: -1 })
    cargas.push(img)
  }
  a.cena.tweens.add({ targets: cargas, scale: '*=1.06', duration: aviso, ease: 'Sine.easeIn' })

  a.depois(aviso, () => {
    for (const img of cargas) {
      a.cena.tweens.killTweensOf(img)
      img.destroy()
    }
    tocar(a.cena, 'super-susie-buster')
    if (final) tocar(a.cena, 'super-susie-pancada')
    shake(a.cena, final ? 260 : 140, final ? 0.012 : 0.006)
    for (const [p, q] of faixas) disparar(a, B, estado, p, q, vertical, sentido, final)
  })
}

// imagem da meia-lua virada para o sentido da varredura
function meiaLua(a, s, vertical, sentido) {
  const img = a.decoracao(a.cena.add.image(0, 0, T('buster'), 0).setDepth(6).setScale(s))
  if (vertical) img.setRotation(Math.PI / 2)
  else if (sentido < 0) img.setFlipX(true)
  return img
}

// Uma meia-lua: a colisão são bolinhas invisíveis ao longo do arco do sprite
// (mesma curva de scripts/super/susie.py) e a imagem segue a primeira delas
function disparar(a, B, estado, p, q, vertical, sentido, final) {
  const l = a.caixa
  const s = (q - p + 10) / 112
  const v = B.velocidade * (final ? 1.1 : 1)
  const dir = vertical ? { x: 0, y: 1 } : { x: sentido, y: 0 }
  const perp = vertical ? { x: 1, y: 0 } : { x: 0, y: 1 }
  const pos = (p + q) / 2
  // centro do sprite começa fora da caixa, encostado na borda de entrada
  const recuo = 20 * s + 2
  const c0 = vertical ? { x: pos, y: l.top - recuo } : { x: sentido > 0 ? l.left - recuo : l.right + recuo, y: pos }
  const percurso = (vertical ? l.height : l.width) + 2 * recuo + 20
  const vida = (percurso / v) * 1000 + 100

  const n = Math.max(3, Math.ceil((q - p) / 9))
  let ancora = null
  for (let k = 0; k < n; k++) {
    const u = -0.9 + (1.8 * k) / (n - 1)
    const base = Math.max(0, 1 - u * u)
    const frente = 6 + 30 * base ** 0.8
    const espessura = 2 + 16 * base ** 0.9
    const ao = (frente - espessura / 2 - 20) * s
    const tr = u * 56 * s
    const b = a.bala({
      x: c0.x + dir.x * ao + perp.x * tr,
      y: c0.y + dir.y * ao + perp.y * tr,
      raio: Math.max(3, (espessura / 2) * s * 0.9),
      vx: dir.x * v,
      vy: dir.y * v,
      jaAvisada: true, // as faixas piscaram durante a carga
      atravessa: true,
      vida,
      pulso: 0,
    })
    invisivel(b)
    if (!ancora) ancora = b
  }
  const img = meiaLua(a, s, vertical, sentido).setPosition(c0.x, c0.y)
  estado.seguidores.push({ ancora, img, dx: c0.x - ancora.x, dy: c0.y - ancora.y, t: 0, rastro: 0, final })
  particulas(a.cena, c0.x + dir.x * recuo, c0.y + dir.y * recuo, { cor: MAGENTA, quantidade: 10, velocidade: 140, vida: 320 })
}

// ---------- por frame: meias-luas seguindo as balas e empurrões ----------

function atualizar(a, estado, E, dt) {
  for (const f of estado.seguidores) {
    if (f.ancora.morta) {
      f.img.setVisible(false)
      continue
    }
    f.img.setPosition(f.ancora.x + f.dx, f.ancora.y + f.dy)
    f.t += dt
    f.img.setFrame(Math.floor(f.t / 70) % 3)
    f.rastro -= dt
    if (f.rastro <= 0) {
      // rastro de imagens roxas que somem
      f.rastro = 55
      const eco = a.decoracao(
        a.cena.add
          .image(f.img.x, f.img.y, T('buster'), f.img.frame.name)
          .setDepth(5)
          .setScale(f.img.scaleX, f.img.scaleY)
          .setRotation(f.img.rotation)
          .setFlipX(f.img.flipX)
          .setTint(f.final ? AMARELO : ROXO)
          .setAlpha(0.45),
      )
      a.cena.tweens.add({ targets: eco, alpha: 0, duration: 220, onComplete: () => eco.destroy() })
    }
  }
  estado.seguidores = estado.seguidores.filter((f) => !f.ancora.morta)

  for (const e of estado.empurroes) {
    if (e.restante === null) e.restante = E.ms
    e.restante -= dt
    if (!e.coracao.ativo) continue
    e.coracao.x += (e.dx * E.velocidade * dt) / 1000
    e.coracao.ajustar()
  }
  estado.empurroes = estado.empurroes.filter((e) => e.restante > 0)
}

// bala só de colisão: o desenho é do machado / da meia-lua
function invisivel(b) {
  b.sprite.setVisible(false)
  return b
}
