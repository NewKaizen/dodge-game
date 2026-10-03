import { definirAtaque } from '../definir.js'
import { ATAQUE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { shake } from '../../effects/shake.js'
import { particulas } from '../../effects/particulas.js'

// SUPER de Kris: ALMA SEM RETORNO. Três regras novas, uma depois da outra,
// todas sobre o CAMINHO do próprio coração:
//
//   I. Xeque (1ª metade). A caixa vira um tabuleiro. O coração deixa um
//      RASTRO de lâminas cravadas: por onde ele passou, depois de piscar,
//      brota uma espadinha (não dá para voltar pelo mesmo caminho). Ao mesmo
//      tempo, espadas gigantes caem nas casas que uma PEÇA de xadrez ataca a
//      partir da casa do coração: cavalo (o L), bispo (as diagonais) ou torre
//      (linha e coluna). O ícone da peça aparece antes e as casas piscam.
//      Sempre sobra uma casa vizinha livre: torre -> diagonal, bispo -> do
//      lado, cavalo -> qualquer vizinha.
//   II. Eco (2ª metade). O tabuleiro some e o ECO da alma (um coração
//      fantasma azul com uma espada girando) nasce onde o coração estava
//      quase 2 s atrás e REFAZ o caminho dele, cada vez mais perto (mas
//      nunca menos de `atrasoMin` atrás). Ele também crava lâminas por onde
//      passa. Ficar parado = o passado alcança você.
//   III. Corte final. O eco para, mira e dá dois cortes que atravessam a
//      caixa inteira (em X), cada um com a linha piscando antes.
//
// Justiça:
//   - toda lâmina do rastro pisca `avisoRastro` (>= telegrafoMs) parada e
//     inofensiva antes de valer, e nasce ATRÁS do coração (no ponto por onde
//     ele passou `passoRastro` px antes). Só nasce em cima dele se ele ficar
//     parado mais de `parado` ms (e ainda pisca antes);
//   - entre duas lâminas do rastro sobra uma fresta (dá para atravessar a
//     trilha com cuidado, nunca é parede);
//   - as casas do tabuleiro têm no mínimo LACUNA_MINIMA de lado (a grade se
//     adapta à caixa) e piscam `avisoCasa` antes da espada cair;
//   - o eco pisca `avisoEco` antes de começar a andar, anda sempre pelo
//     caminho que o coração já fez e fica pelo menos `atrasoMin` ms atrás;
//   - os cortes finais são linhas finas com aviso de `avisoCorte`.
//
// Config:
//   passoRastro    distância percorrida entre duas lâminas do rastro (px)
//   avisoRastro    ms piscando antes da lâmina valer
//   vidaRastro     ms que a lâmina fica cravada
//   parado         ms parado até brotar uma lâmina debaixo do coração
//   golpes         [ms, peça] das espadas no tabuleiro (tempo ativo)
//   avisoCasa      ms de aviso das casas
//   atraso         ms entre o coração e o eco quando ele nasce
//   atrasoMin      o eco nunca chega a menos disso do coração (ms de caminho)
//   aceleracao     quanto o eco acelera por segundo (1 = mesma velocidade do coração)
//   giroEco        rad/s da espada do eco
//   avisoEco, avisoCorte
export default definirAtaque({
  nome: 'superKris',
  padrao: {
    duracao: 9000,
    passoRastro: 30,
    avisoRastro: 450,
    vidaRastro: 1700,
    parado: 1100,
    golpes: [
      [150, 'cavalo'],
      [1200, 'bispo'],
      [2250, 'torre'],
      [3300, 'cavalo'],
    ],
    avisoCasa: 750,
    atraso: 1800,
    atrasoMin: 650,
    aceleracao: 0.14,
    giroEco: 3.4,
    avisoEco: 600,
    avisoCorte: 700,
  },
  iniciar(a, cfg) {
    const metade = cfg.duracao / 2
    const inicioCorte = cfg.duracao - 1450
    let ativo = 0 // tempo ativo da onda (aoAtualizar para nas pausas)

    // por coração: caminho gravado e estado do rastro
    const almas = new Map()
    const daAlma = (c) => {
      if (!almas.has(c)) almas.set(c, { caminho: [], marca: { x: c.x, y: c.y }, ultimaLamina: 0 })
      return almas.get(c)
    }
    const ecos = []

    // ---------- I. tabuleiro + rastro ----------
    const tabuleiro = montarTabuleiro(a)
    for (const [ms, peca] of cfg.golpes) a.depois(ms, () => golpe(a, cfg, tabuleiro, peca))
    a.depois(metade - 250, () => desmontarTabuleiro(a, tabuleiro))

    // ---------- II. eco ----------
    a.depois(metade + 30, () => {
      tocar(a.cena, 'super-kris-pulso')
      for (const c of a.coracoes) {
        if (!c.ativo) continue
        const alma = daAlma(c)
        ecos.push(criarEco(a, cfg, alma, ativo))
      }
    })

    // ---------- III. corte final ----------
    a.depois(inicioCorte, () => {
      for (const e of ecos) pararEco(a, e)
      cortar(a, cfg, ecos, 0)
    })
    a.depois(inicioCorte + 380, () => cortar(a, cfg, ecos, 1))

    a.aoAtualizar((dt) => {
      ativo += dt
      for (const c of a.coracoes) {
        if (!c.ativo) continue
        const alma = daAlma(c)
        alma.caminho.push({ t: ativo, x: c.x, y: c.y })
        if (alma.caminho.length > 900) alma.caminho.splice(0, 300)
        if (ativo < metade - 250) rastro(a, cfg, c, alma, ativo)
      }
      for (const e of ecos) andarEco(a, cfg, e, ativo, dt)
    })
  },
})

// ---------- rastro ----------

function rastro(a, cfg, c, alma, ativo) {
  const andou = Math.hypot(c.x - alma.marca.x, c.y - alma.marca.y)
  if (andou >= cfg.passoRastro) {
    // a lâmina brota onde o coração ESTAVA (passoRastro px atrás)
    cravar(a, cfg, alma.marca.x, alma.marca.y)
    alma.marca = { x: c.x, y: c.y }
    alma.ultimaLamina = ativo
  } else if (ativo - alma.ultimaLamina > cfg.parado) {
    // parado demais: a lâmina brota debaixo dele (pisca antes)
    cravar(a, cfg, c.x, c.y)
    alma.marca = { x: c.x, y: c.y }
    alma.ultimaLamina = ativo
  }
}

function cravar(a, cfg, x, y, vida = cfg.vidaRastro) {
  const aviso = Math.max(ATAQUE.telegrafoMs, cfg.avisoRastro)
  a.bala({
    x,
    y: y - 3,
    largura: 6,
    altura: 13,
    textura: 'super-kris-lamina',
    tamanho: 20,
    aviso,
    vida,
    atravessa: true,
    pulso: 0,
    atualizar: (b) => {
      // some aos poucos no fim (já sem machucar)
      if (b.vida < 160) {
        b.inofensiva = true
        b.sprite.setAlpha(Math.max(0, b.vida / 160))
      }
    },
  })
}

// ---------- tabuleiro ----------

function montarTabuleiro(a) {
  const l = a.caixa
  // casas com pelo menos LACUNA_MINIMA de lado (rota de fuga = uma casa)
  const lado = a.lacunaMinima + 4
  const colunas = Math.max(2, Math.floor(l.width / lado))
  const linhas = Math.max(2, Math.floor(l.height / lado))
  const t = { colunas, linhas, casas: [], x: l.left, y: l.top, w: l.width / colunas, h: l.height / linhas }
  a.lacuna(Math.min(t.w, t.h), 'casa do tabuleiro')
  tocar(a.cena, 'super-kris-tique')
  for (let r = 0; r < linhas; r++) {
    for (let col = 0; col < colunas; col++) {
      const img = a.decoracao(
        a.cena.add
          .image(t.x + (col + 0.5) * t.w, t.y + (r + 0.5) * t.h, 'super-kris-casa', (col + r) % 2)
          .setDisplaySize(t.w, t.h)
          .setDepth(2)
          .setAlpha(0),
      )
      const sx = img.scaleX
      img.scaleX = 0
      // as casas viram uma a uma, em onda diagonal
      a.cena.tweens.add({ targets: img, scaleX: sx, alpha: 0.42, delay: (col + r) * 70, duration: 160, ease: 'Back.Out' })
      t.casas.push(img)
    }
  }
  return t
}

function desmontarTabuleiro(a, t) {
  t.casas.forEach((img, i) => {
    a.cena.tweens.add({ targets: img, scaleY: 0, alpha: 0, delay: (i % t.colunas) * 40, duration: 180 })
  })
}

const PECAS = { cavalo: 0, bispo: 1, torre: 2 }

// casas atacadas por uma peça parada em (c, r)
function casasDaPeca(peca, c, r, colunas, linhas) {
  const dentro = ([x, y]) => x >= 0 && y >= 0 && x < colunas && y < linhas
  const lista = [[c, r]]
  if (peca === 'cavalo') {
    for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) lista.push([c + dx, r + dy])
  } else if (peca === 'bispo') {
    for (let k = 1; k < Math.max(colunas, linhas); k++) for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) lista.push([c + sx * k, r + sy * k])
  } else {
    for (let x = 0; x < colunas; x++) lista.push([x, r])
    for (let y = 0; y < linhas; y++) lista.push([c, y])
  }
  const vistas = new Set()
  return lista.filter(dentro).filter(([x, y]) => !vistas.has(`${x},${y}`) && vistas.add(`${x},${y}`))
}

function golpe(a, cfg, t, peca) {
  const alvo = a.alvo()
  const c = Math.min(t.colunas - 1, Math.max(0, Math.floor((alvo.x - t.x) / t.w)))
  const r = Math.min(t.linhas - 1, Math.max(0, Math.floor((alvo.y - t.y) / t.h)))
  const atacadas = casasDaPeca(peca, c, r, t.colunas, t.linhas)
  const marcadas = new Set(atacadas.map(([x, y]) => `${x},${y}`))
  // rota de fuga: uma casa vizinha (inclusive diagonal) que não cai espada
  let livre = false
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = c + dx
      const y = r + dy
      if ((dx || dy) && x >= 0 && y >= 0 && x < t.colunas && y < t.linhas && !marcadas.has(`${x},${y}`)) livre = true
    }
  }
  a.lacuna(livre ? Math.min(t.w, t.h) : 0, `casa vizinha livre (${peca})`)

  const aviso = Math.max(ATAQUE.telegrafoMs, cfg.avisoCasa)
  const centro = (x, y) => ({ x: t.x + (x + 0.5) * t.w, y: t.y + (y + 0.5) * t.h })

  // a peça aparece em cima da casa do coração: é ela que diz o desenho do golpe
  const p = centro(c, r)
  const icone = a.decoracao(a.cena.add.image(p.x, p.y, 'super-kris-pecas', PECAS[peca]).setDepth(7).setScale(0.5).setAlpha(0))
  a.cena.tweens.add({ targets: icone, scale: 1.6, alpha: 0.95, duration: 160, ease: 'Back.Out' })
  a.cena.tweens.add({ targets: icone, alpha: 0, scale: 2.2, delay: aviso * 0.55, duration: 200 })
  tocar(a.cena, 'super-kris-tique')

  for (const [x, y] of atacadas) {
    const q = centro(x, y)
    // a espada gigante aparece sobre a casa e desce de uma vez no fim do aviso
    const espada = a.decoracao(a.cena.add.image(q.x, q.y - t.h * 0.55, 'super-kris-espada').setDepth(6).setAlpha(0))
    espada.setScale((t.h * 1.05) / espada.height)
    a.cena.tweens.add({ targets: espada, alpha: 0.55, y: q.y - t.h * 0.45, duration: aviso - 90, ease: 'Sine.Out' })
    a.aviso({ tipo: 'area', x: q.x - t.w / 2 + 2, y: q.y - t.h / 2 + 2, largura: t.w - 4, altura: t.h - 4, ms: aviso }, () => {
      a.cena.tweens.killTweensOf(espada)
      espada.setAlpha(1)
      a.cena.tweens.add({ targets: espada, y: q.y - t.h * 0.1, duration: 70, ease: 'Cubic.In' })
      a.cena.tweens.add({ targets: espada, alpha: 0, delay: 260, duration: 220 })
      a.bala({
        x: q.x,
        y: q.y,
        largura: t.w - 6,
        altura: t.h - 6,
        textura: 'super-kris-impacto',
        tamanho: Math.max(t.w, t.h) - 4,
        jaAvisada: true,
        vida: 330,
        atravessa: true,
        pulso: 0,
        atualizar: (b) => {
          if (b.vida < 140) {
            b.inofensiva = true
            b.sprite.setAlpha(Math.max(0, b.vida / 140))
          }
        },
      })
      particulas(a.cena, q.x, q.y, { cor: 0x8fdcff, quantidade: 6, velocidade: 110, vida: 320 })
    })
  }
  a.depois(aviso, () => {
    tocar(a.cena, 'super-kris-crava')
    shake(a.cena, 110, 0.005)
  })
}

// ---------- eco ----------

// posição do caminho gravado no instante t (interpolada)
function pontoNoCaminho(caminho, t) {
  if (!caminho.length) return null
  if (t <= caminho[0].t) return caminho[0]
  for (let i = caminho.length - 1; i > 0; i--) {
    const p = caminho[i - 1]
    const q = caminho[i]
    if (p.t <= t) {
      const k = q.t > p.t ? Math.min(1, (t - p.t) / (q.t - p.t)) : 1
      return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k }
    }
  }
  return caminho[caminho.length - 1]
}

function criarEco(a, cfg, alma, ativo) {
  const aviso = Math.max(ATAQUE.telegrafoMs, cfg.avisoEco)
  const replay = ativo - cfg.atraso
  const p = pontoNoCaminho(alma.caminho, replay) ?? { x: a.caixa.centerX, y: a.caixa.centerY }
  const nucleo = a.bala({ x: p.x, y: p.y, raio: 6, textura: 'super-kris-eco', quadro: 0, tamanho: 20, aviso, atravessa: true, pulso: 0.12 })
  const angulo = -Math.PI / 2
  const espada = a.bala({
    x: p.x + Math.cos(angulo) * ALCANCE_EIXO,
    y: p.y + Math.sin(angulo) * ALCANCE_EIXO,
    comprimento: 44,
    espessura: 7,
    angulo,
    textura: 'super-kris-espada-eco',
    tamanho: 50,
    aviso,
    atravessa: true,
    pulso: 0,
  })
  particulas(a.cena, p.x, p.y, { cor: 0x8fdcff, quantidade: 10, velocidade: 90, vida: 400 })
  return { alma, nucleo, espada, angulo, replay, x: p.x, y: p.y, marca: { x: p.x, y: p.y }, parado: false, nasceu: ativo, aviso }
}

const ALCANCE_EIXO = 29 // distância do eco até o meio da espada

function andarEco(a, cfg, e, ativo, dt) {
  if (e.nucleo.morta || e.espada.morta) return
  e.nucleo.sprite.setFrame(Math.floor(ativo / 140) % 2)
  const s = dt / 1000
  e.angulo += cfg.giroEco * s * (e.parado ? 2.2 : 1)
  if (!e.parado && ativo - e.nasceu >= e.aviso) {
    // refaz o caminho do coração, acelerando, mas nunca mais perto que atrasoMin
    const ritmo = 1 + cfg.aceleracao * ((ativo - e.nasceu - e.aviso) / 1000)
    e.replay = Math.min(e.replay + dt * ritmo, ativo - cfg.atrasoMin)
    const p = pontoNoCaminho(e.alma.caminho, e.replay)
    if (p) {
      e.x = p.x
      e.y = p.y
    }
    // o eco também crava lâminas por onde passa (com aviso, vida curta)
    if (Math.hypot(e.x - e.marca.x, e.y - e.marca.y) >= cfg.passoRastro * 1.4) {
      cravar(a, cfg, e.marca.x, e.marca.y, 1100)
      e.marca = { x: e.x, y: e.y }
    }
  }
  e.nucleo.x = e.x
  e.nucleo.y = e.y
  e.espada.x = e.x + Math.cos(e.angulo) * ALCANCE_EIXO
  e.espada.y = e.y + Math.sin(e.angulo) * ALCANCE_EIXO
  e.espada.angulo = e.angulo
  if (e.espada.idade < e.espada.aviso) e.espada.sprite.setPosition(e.espada.x, e.espada.y).setRotation(e.angulo)
}

// o eco para e deixa de machucar: agora ele só mira os cortes
function pararEco(a, e) {
  e.parado = true
  for (const b of [e.nucleo, e.espada]) {
    b.inofensiva = true
    a.cena.tweens.add({ targets: b.sprite, alpha: 0.45, duration: 200 })
  }
}

// ---------- corte final ----------

function cortar(a, cfg, ecos, i) {
  const l = a.caixa
  const aviso = Math.max(ATAQUE.telegrafoMs, cfg.avisoCorte)
  const alvo = a.alvo()
  const eco = ecos[i % Math.max(1, ecos.length)]
  // o corte sai do eco e passa pelo coração; sem eco (ou colado nele), em diagonal
  let ox = eco?.x ?? l.centerX
  let oy = eco?.y ?? l.centerY
  let ang = Math.atan2(alvo.y - oy, alvo.x - ox)
  if (!eco || Math.hypot(alvo.x - ox, alvo.y - oy) < 20) {
    ox = alvo.x
    oy = alvo.y
    ang = i === 0 ? Math.PI / 4 : -Math.PI / 4
  }
  // segunda lâmina cruza a primeira (o X)
  if (i === 1) ang += 0.35
  const comp = Math.hypot(l.width, l.height) + 40
  const dx = Math.cos(ang) * comp
  const dy = Math.sin(ang) * comp
  tocar(a.cena, 'super-kris-pulso')
  a.aviso({ tipo: 'linha', x1: alvo.x - dx, y1: alvo.y - dy, x2: alvo.x + dx, y2: alvo.y + dy, espessura: 12, ms: aviso }, () => {
    tocar(a.cena, 'super-kris-corte')
    shake(a.cena, 160, 0.008)
    const b = a.bala({
      x: alvo.x,
      y: alvo.y,
      comprimento: comp * 2,
      espessura: 10,
      angulo: ang,
      textura: 'super-kris-corte',
      jaAvisada: true,
      vida: 280,
      atravessa: true,
      pulso: 0,
      atualizar: (bala) => {
        if (bala.vida < 120) {
          bala.inofensiva = true
          bala.sprite.setAlpha(Math.max(0, bala.vida / 120))
        }
      },
    })
    // o rastro de luz é mais fino que a textura ampliada por igual
    b.sprite.setDisplaySize(comp * 2, 26)
    b.escalaX = b.sprite.scaleX
    b.escalaY = b.sprite.scaleY
    particulas(a.cena, alvo.x, alvo.y, { cor: 0xffffff, quantidade: 12, velocidade: 180, vida: 380 })
    // o último corte estilhaça o eco
    if (i === 1) {
      for (const e of ecos) {
        particulas(a.cena, e.x, e.y, { cor: 0x8fdcff, quantidade: 16, velocidade: 160, vida: 500 })
        for (const bala of [e.nucleo, e.espada]) {
          bala.inofensiva = true
          bala.vida = Math.min(bala.vida, 120)
        }
      }
    }
  })
}

