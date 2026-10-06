// Ataques exclusivos das cartas de susie (uma entrada por ataque, com prefixo 'susie').
// As receitas de pvp/baralhos/susie.js chamam A.susieCabecada(...) etc.
// Sprites e sons: scripts/habilidades/susie.py (chaves 'hab-susie-*').
//
//   susieCabecada   ♠ Cabeçada: a parede da caixa amassa para dentro na
//                     fileira/coluna do coração (BONK) e solta estrelinhas de
//                     tontura que giram em espiral para fora
//   susiePisao      ♠ Pisão: a pisada faz pilares de pedra subirem do chão em
//                     onda para os dois lados, e cascalho cai do teto
//   susieGiro       ♠ Giro do Machado: o machado de cabo longo dá uma volta
//                     inteira em torno de um eixo (o disco pisca antes)
//   susieEncarar    ♦ Encarar: marcas de raiva na borda da caixa "encaram" o
//                     coração (uma linha de olhar que o segue); quando o olhar
//                     trava, dispara raios amarelos pela linha
//   susieRugido     ♦ Rugido: ondas sonoras atravessam a caixa com um vão e o
//                     grito empurra o coração
//   susieBombaGiz   ♣ Bomba de Giz: gizes amarrados com pavio caem na caixa,
//                     explodem numa nuvem de pó de giz e espalham pedaços de
//                     giz que ficam no chão
import { definirAtaque } from '../definir.js'
import { ATAQUE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { shake } from '../../effects/shake.js'
import { particulas } from '../../effects/particulas.js'

const T = (nome) => `hab-susie-${nome}`
const ROXO = 0xb05cff
const LILAS = 0xd9a0ff
const AMARELO = 0xffe14a
const GIZ = 0xf0ecff

const limitar = (v, min, max) => Math.min(Math.max(v, min), max)

// O aviso de `ms` cabe antes do fim da onda? (conta as pausas de respiro que
// ainda vêm pela frente, em que os timers ficam parados; ver attacks/foice.js)
function cabe(a, ms) {
  let extra = 0
  const r = a.respiro
  if (r) {
    const rel = a.tempo - r.origem
    for (const [ini, fim] of r.pausas) if (fim > rel) extra += fim - Math.max(ini, rel)
  }
  return a.tempo + ms + extra <= a.fim
}

// bala só de colisão (o desenho é outra imagem)
function invisivel(b) {
  b.sprite.setVisible(false)
  return b
}

// ---------- ♠ Cabeçada ----------
//
// A cada `intervalo` a Susie dá uma cabeçada na parede mais perto do
// coração, na altura dele: a faixa pisca (`aviso`), a parede afunda para
// dentro (`profundidade` da caixa, por `cravado` ms) com um BONK e, da ponta
// do amassado, saem `estrelas` estrelinhas de tontura que giram em espiral
// para fora (piscam paradas antes de valer). A outra metade da caixa fica livre.
const susieCabecada = definirAtaque({
  nome: 'susieCabecada',
  padrao: { duracao: 5000, intervalo: 1200, aviso: 600, profundidade: 0.5, largura: 46, cravado: 380, estrelas: 4, raioEstrela: 6, velocidade: 50, voltaEstrela: 80 },
  iniciar(a, cfg) {
    a.aCada(cfg.intervalo, (i) => {
      if (!cabe(a, cfg.aviso)) return
      const l = a.caixa
      const alvo = a.alvo()
      // alterna paredes laterais e chão/teto; dentro do par, a mais perto do coração
      const lateral = i % 2 === 0
      const lado = lateral ? (alvo.x < l.centerX ? -1 : 1) : alvo.y < l.centerY ? -1 : 1
      const vao = lateral ? l.width : l.height // tamanho da caixa na direção da pancada
      const fundo = Math.min(vao * cfg.profundidade, vao - a.lacunaMinima - 8)
      const meia = cfg.largura / 2
      // posição ao longo da parede: a do coração
      const p = lateral ? limitar(alvo.y, l.top + meia, l.bottom - meia) : limitar(alvo.x, l.left + meia, l.right - meia)
      const borda = lateral ? (lado < 0 ? l.left : l.right) : lado < 0 ? l.top : l.bottom
      const dentro = -lado // sentido para dentro da caixa
      const centro = borda + (dentro * fundo) / 2
      const ret = lateral
        ? { x: Math.min(borda, borda + dentro * fundo), y: p - meia, largura: fundo, altura: cfg.largura }
        : { x: p - meia, y: Math.min(borda, borda + dentro * fundo), largura: cfg.largura, altura: fundo }
      a.lacuna(vao - fundo, 'lado livre da cabeçada')

      a.aviso({ tipo: 'area', ...ret, ms: cfg.aviso }, () => {
        tocar(a.cena, 'hab-susie-bonk')
        shake(a.cena, 120, 0.008)
        const cx = lateral ? centro : p
        const cy = lateral ? p : centro
        const b = a.bala({
          x: cx,
          y: cy,
          largura: ret.largura,
          altura: ret.altura,
          textura: T('calombo'),
          jaAvisada: true,
          atravessa: true,
          vida: cfg.cravado,
          pulso: 0,
        })
        // o sprite aponta para +x: gira para apontar para dentro da caixa
        const rot = lateral ? (dentro > 0 ? 0 : Math.PI) : dentro > 0 ? Math.PI / 2 : -Math.PI / 2
        b.sprite.setRotation(rot).setDisplaySize(fundo + 4, cfg.largura + 6)
        const sx = b.sprite.scaleX
        b.sprite.scaleX = sx * 0.3
        a.cena.tweens.add({ targets: b.sprite, scaleX: sx, duration: 70, ease: 'Quad.easeOut' })
        // ponta do amassado: BONK e estrelinhas
        const ponta = { x: lateral ? borda + dentro * fundo : p, y: lateral ? p : borda + dentro * fundo }
        const est = a.decoracao(a.cena.add.image(ponta.x, ponta.y, T('bonk')).setDepth(8).setScale(0.5))
        a.cena.tweens.add({ targets: est, scale: 1.6, alpha: 0, angle: 30, duration: 300, ease: 'Quad.easeOut' })
        particulas(a.cena, ponta.x, ponta.y, { cor: AMARELO, quantidade: 8, velocidade: 120, vida: 300 })
        estrelinhas(a, cfg, ponta, lateral ? { x: dentro, y: 0 } : { x: 0, y: dentro }, i)
      })
    })
  },
})

function estrelinhas(a, cfg, ponta, dir, i) {
  const n = Math.round(cfg.estrelas)
  const sentido = i % 4 < 2 ? 1 : -1
  // o centro da espiral fica um pouco para dentro da caixa
  const c = { x: ponta.x + dir.x * 16, y: ponta.y + dir.y * 16 }
  const r0 = 12
  for (let k = 0; k < n; k++) {
    let ang = (k * Math.PI * 2) / n + i * 0.5
    let r = r0
    a.bala({
      x: c.x + Math.cos(ang) * r,
      y: c.y + Math.sin(ang) * r,
      raio: cfg.raioEstrela,
      textura: T('estrela'),
      quadro: k % 2,
      tamanho: 14,
      aviso: ATAQUE.telegrafoMs,
      vida: 3200,
      pulso: 0.1,
      atualizar: (b, dt) => {
        const s = (dt / 1000) * a.balas.fatorVelocidade
        r += cfg.velocidade * s
        ang += ((cfg.voltaEstrela / Math.max(r, 20)) * s) * sentido // velocidade de lado ~constante
        b.x = c.x + Math.cos(ang) * r
        b.y = c.y + Math.sin(ang) * r
        b.sprite.setFrame(Math.floor(b.idade / 110) % 2)
        if (r > 190) b.morta = true
      },
    })
  }
}

// ---------- ♠ Pisão ----------
//
// Vista de lado: a cada `intervalo` a Susie pisa no chão da caixa. A faixa do
// chão (`altura` da caixa, alternando baixa e alta) pisca junto com a pegada
// rachada; na pisada, pilares de pedra sobem do chão um depois do outro,
// numa onda que corre para os dois lados a `velocidade` px/s. O tremor solta
// `cascalhos` do teto (um em cima do coração), que piscam antes de cair.
// O alto da caixa (>= LACUNA_MINIMA) nunca é atingido pela onda.
const susiePisao = definirAtaque({
  nome: 'susiePisao',
  padrao: { duracao: 5000, intervalo: 1400, aviso: 600, alturas: [0.34, 0.48], velocidade: 150, passo: 16, subida: 110, erguido: 200, cascalhos: 1, velocidadeCascalho: 90, gravidade: 260 },
  iniciar(a, cfg) {
    a.aCada(cfg.intervalo, (i) => {
      if (!cabe(a, cfg.aviso)) return
      const l = a.caixa
      const frac = cfg.alturas[i % cfg.alturas.length]
      const H = Math.min(l.height * frac, l.height - a.lacunaMinima - 14)
      const x0 = a.aleatorio(l.left + 30, l.right - 30)
      a.parede({ eixo: 'y', ocupados: [[l.bottom - H, l.bottom]] })

      const marca = a.decoracao(a.cena.add.image(x0, l.bottom - 6, T('marca')).setDepth(3).setAlpha(0.9))
      a.cena.tweens.add({ targets: marca, alpha: 0.35, duration: 90, yoyo: true, repeat: -1 })
      a.aviso({ tipo: 'area', x: l.left, y: l.bottom - H, largura: l.width, altura: H, ms: cfg.aviso }, () => {
        a.cena.tweens.killTweensOf(marca)
        marca.setAlpha(1)
        a.cena.tweens.add({ targets: marca, alpha: 0, delay: 600, duration: 300 })
        tocar(a.cena, 'hab-susie-pisao')
        shake(a.cena, 160, 0.01)
        particulas(a.cena, x0, l.bottom - 4, { cor: LILAS, quantidade: 12, velocidade: 110, vida: 360 })
        // a onda: um pilar a cada `passo` px, saindo da pegada para os dois lados
        const v = cfg.velocidade * a.balas.fatorVelocidade
        for (let d = 0; d <= l.width; d += cfg.passo) {
          for (const s of d === 0 ? [0] : [-1, 1]) {
            const x = x0 + s * d
            if (x < l.left + 4 || x > l.right - 4) continue
            a.depois((d / v) * 1000, () => pilar(a, cfg, x, H, d / cfg.passo))
          }
        }
      })

      // cascalho do teto: pisca durante o aviso (e um pouco mais) e cai depois da pisada
      const alvo = a.alvo()
      for (let k = 0; k < cfg.cascalhos; k++) {
        const desvio = k === 0 ? 0 : (k % 2 ? 1 : -1) * (60 + 20 * Math.floor((k - 1) / 2))
        let x = alvo.x + desvio
        if (x < l.left + 10 || x > l.right - 10) x = alvo.x - desvio
        a.bala({
          x: limitar(x, l.left + 8, l.right - 8),
          y: l.top + 7,
          raio: 5,
          textura: T('cascalho'),
          quadro: (i + k) % 4,
          tamanho: 12,
          aviso: cfg.aviso + 120,
          vy: cfg.velocidadeCascalho,
          ay: cfg.gravidade,
          girar: 6,
          vida: 2600,
        })
      }
    })
  },
})

// um pilar: sobe do chão (a caixa corta o pedaço de baixo), fica e desce
function pilar(a, cfg, x, H, n) {
  const l = a.caixa
  const total = cfg.subida * 2 + cfg.erguido
  let tempo = 0
  const base = l.bottom + H / 2 // escondido embaixo do chão
  const b = a.bala({
    x,
    y: base,
    largura: cfg.passo - 3,
    altura: H,
    textura: T('pilar'),
    quadro: n % 3,
    jaAvisada: true,
    atravessa: true,
    vida: total + 60,
    pulso: 0,
    atualizar: (bala, dt) => {
      tempo += dt * a.balas.fatorVelocidade
      const f = tempo < cfg.subida ? tempo / cfg.subida : tempo < cfg.subida + cfg.erguido ? 1 : Math.max(0, 1 - (tempo - cfg.subida - cfg.erguido) / cfg.subida)
      bala.y = base - f * H
      if (tempo >= total) bala.morta = true
    },
  })
  b.sprite.setDisplaySize(cfg.passo + 2, H + 8)
}

// ---------- ♠ Giro do Machado ----------
//
// A Susie gira o machado de cabo longo em volta de um eixo perto do coração:
// o disco do giro pisca (`aviso`) com o machado se armando e então ele dá
// `voltas` voltas (cada uma em `volta` ms), deixando um rastro roxo. O cabo e
// a cabeça machucam; bem no eixo (`interno` px) não. O próximo giro só vale
// depois que o anterior termina, e sempre sobra uma faixa livre do lado.
const susieGiro = definirAtaque({
  nome: 'susieGiro',
  padrao: { duracao: 5500, aviso: 650, raio: 66, volta: 1150, voltas: 1.1, interno: 14, raioCabeca: 11, espessuraCabo: 5, folga: 200, deslocamento: 0.45 },
  iniciar(a, cfg) {
    const giro = (k) => {
      if (!cabe(a, cfg.aviso)) return
      const l = a.caixa
      const R = Math.min(cfg.raio, (l.width - a.lacunaMinima - 8) / 2)
      const alvo = a.alvo()
      const desvio = a.aleatorio(0, Math.PI * 2)
      let px = limitar(alvo.x + Math.cos(desvio) * R * cfg.deslocamento, l.left + 10, l.right - 10)
      const py = limitar(alvo.y + Math.sin(desvio) * R * cfg.deslocamento, l.top + 10, l.bottom - 10)
      // sempre sobra uma faixa livre de LACUNA_MINIMA (+ folga) à esquerda ou à direita do disco
      const livre = a.lacunaMinima + 6
      if (Math.max(px - R - l.left, l.right - (px + R)) < livre) {
        px = px - R - l.left >= l.right - (px + R) ? l.left + livre + R : l.right - livre - R
      }
      a.parede({ eixo: 'x', ocupados: [[px - R, px + R]] })
      const sentido = k % 2 ? -1 : 1
      let ang = Math.atan2(alvo.y - py, alvo.x - px) + sentido * Math.PI * 0.6 // começa longe do coração

      // armando: redemoinho no eixo e o machado recuando
      const eixo = a.decoracao(a.cena.add.image(px, py, T('redemoinho')).setDepth(6).setAlpha(0.8))
      a.cena.tweens.add({ targets: eixo, angle: -360 * sentido, duration: 700, repeat: -1 })
      const escala = (R + 4) / 84
      const machado = a.decoracao(a.cena.add.image(px, py, T('giro')).setOrigin(2 / 84, 0.5).setDepth(7).setScale(escala).setRotation(ang).setAlpha(0.45))
      a.cena.tweens.add({ targets: machado, rotation: ang - sentido * 0.35, duration: cfg.aviso, ease: 'Sine.easeOut' })

      a.aviso({ tipo: 'circulo', x: px, y: py, raio: R, ms: cfg.aviso }, () => {
        a.cena.tweens.killTweensOf(machado)
        ang -= sentido * 0.35
        machado.setAlpha(1).setRotation(ang)
        tocar(a.cena, 'hab-susie-giro')
        const fator = a.balas.fatorVelocidade
        const duracao = (cfg.volta * cfg.voltas) / fator
        const w = ((Math.PI * 2) / cfg.volta) * sentido // rad/ms (antes do fator)
        const comp = R - cfg.interno - cfg.raioCabeca
        const posicionar = (cabo, cabeca) => {
          const c = Math.cos(ang)
          const s = Math.sin(ang)
          const m = cfg.interno + comp / 2
          cabo.x = px + c * m
          cabo.y = py + s * m
          cabo.angulo = ang
          cabeca.x = px + c * (R - cfg.raioCabeca)
          cabeca.y = py + s * (R - cfg.raioCabeca)
        }
        const cabo = invisivel(a.bala({ x: px, y: py, comprimento: comp, espessura: cfg.espessuraCabo, angulo: ang, jaAvisada: true, atravessa: true, vida: duracao, pulso: 0 }))
        let rastro = 0
        const cabeca = invisivel(
          a.bala({
            x: px,
            y: py,
            raio: cfg.raioCabeca,
            jaAvisada: true,
            atravessa: true,
            vida: duracao,
            pulso: 0,
            atualizar: (b, dt) => {
              ang += w * dt * a.balas.fatorVelocidade
              posicionar(cabo, b)
              machado.setRotation(ang)
              rastro -= dt
              if (rastro <= 0) {
                rastro = 35
                const eco = a.decoracao(a.cena.add.image(px, py, T('giro')).setOrigin(2 / 84, 0.5).setDepth(5).setScale(escala).setRotation(ang).setTint(ROXO).setAlpha(0.4))
                a.cena.tweens.add({ targets: eco, alpha: 0, duration: 200, onComplete: () => eco.destroy() })
              }
            },
          }),
        )
        posicionar(cabo, cabeca)
        a.depois(duracao, () => {
          a.cena.tweens.killTweensOf(eixo)
          a.cena.tweens.add({ targets: [machado, eixo], alpha: 0, duration: 160 })
          particulas(a.cena, px, py, { cor: ROXO, quantidade: 6, velocidade: 80, vida: 260 })
        })
        // o próximo giro: o aviso dele começa antes, mas só vale depois que este acabou
        a.depois(Math.max(0, duracao + cfg.folga - cfg.aviso), () => giro(k + 1))
      })
    }
    a.depois(0, () => giro(0))
  },
})

// ---------- ♦ Encarar ----------
//
// `olhos` marcas de raiva ficam na borda da caixa e encaram o coração: uma
// linha de olhar pontilhada que o persegue girando no máximo `rastrear` rad/s.
// Depois de `encarar` ms o olhar TRAVA (a linha pisca por `trava` ms, parada)
// e dispara `tiros` raios amarelos por ela. Então a marca troca de lugar
// (para a borda mais longe do coração) e recomeça.
const susieEncarar = definirAtaque({
  nome: 'susieEncarar',
  padrao: { duracao: 5000, olhos: 1, encarar: 700, trava: 450, rastrear: 1.8, tiros: 3, cadencia: 110, velocidade: 190, raio: 4, pausa: 150 },
  iniciar(a, cfg) {
    const g = a.decoracao(a.cena.add.graphics().setDepth(4))
    const olhos = []

    // ponto na borda mais longe do coração (com sorteio ao longo dela)
    const lugar = (j) => {
      const l = a.caixa
      const alvo = a.alvo()
      const lados = [
        ['top', alvo.y - l.top],
        ['bottom', l.bottom - alvo.y],
        ['left', alvo.x - l.left],
        ['right', l.right - alvo.x],
      ].sort((p, q) => q[1] - p[1])
      const lado = lados[j % 2][0]
      const u = a.aleatorio(0.2, 0.8)
      const m = 9
      return {
        top: { x: l.left + u * l.width, y: l.top + m },
        bottom: { x: l.left + u * l.width, y: l.bottom - m },
        left: { x: l.left + m, y: l.top + u * l.height },
        right: { x: l.right - m, y: l.top + u * l.height },
      }[lado]
    }

    const novoOlho = (j) => {
      const p = lugar(j)
      const img = a.decoracao(a.cena.add.image(p.x, p.y, T('raiva')).setDepth(7).setScale(0))
      a.cena.tweens.add({ targets: img, scale: 1.1, duration: 160, ease: 'Back.Out' })
      const alvo = a.alvo()
      const o = { j, x: p.x, y: p.y, img, ang: Math.atan2(alvo.y - p.y, alvo.x - p.x), travado: false, ativo: true }
      olhos[j] = o
      return o
    }

    const ciclo = (j) => {
      if (!cabe(a, cfg.encarar + cfg.trava)) {
        if (olhos[j]) olhos[j].ativo = false
        return
      }
      const o = novoOlho(j)
      a.depois(cfg.encarar, () => {
        o.travado = true
        tocar(a.cena, 'aviso')
        a.cena.tweens.add({ targets: o.img, scale: 1.5, duration: 90, yoyo: true, repeat: 1 })
        const c = Math.cos(o.ang)
        const s = Math.sin(o.ang)
        a.aviso({ tipo: 'linha', x1: o.x, y1: o.y, x2: o.x + c * 320, y2: o.y + s * 320, espessura: 8, cor: AMARELO, ms: cfg.trava }, () => {
          for (let k = 0; k < cfg.tiros; k++) {
            a.depois(k * cfg.cadencia, () => {
              const b = a.bala({
                x: o.x + c * 6,
                y: o.y + s * 6,
                vx: c * cfg.velocidade,
                vy: s * cfg.velocidade,
                raio: cfg.raio,
                textura: T('olhar'),
                tamanho: 18,
                jaAvisada: true,
                vida: 2200,
                pulso: 0,
              })
              b.sprite.setRotation(o.ang)
            })
          }
          a.depois(cfg.tiros * cfg.cadencia + cfg.pausa, () => {
            o.ativo = false
            a.cena.tweens.add({ targets: o.img, scale: 0, alpha: 0, duration: 140 })
            ciclo(j)
          })
        })
      })
    }

    // a linha do olhar segue o coração (girando devagar) até travar
    a.aoAtualizar((dt) => {
      g.clear()
      for (const o of olhos) {
        if (!o?.ativo) continue
        if (!o.travado) {
          const alvo = a.alvo()
          const quer = Math.atan2(alvo.y - o.y, alvo.x - o.x)
          let d = quer - o.ang
          d = Math.atan2(Math.sin(d), Math.cos(d))
          const passo = cfg.rastrear * (dt / 1000)
          o.ang += limitar(d, -passo, passo)
        }
        g.fillStyle(AMARELO, o.travado ? 0.9 : 0.55)
        const c = Math.cos(o.ang)
        const s = Math.sin(o.ang)
        for (let r = 12; r < 300; r += 9) g.fillRect(o.x + c * r - 1, o.y + s * r - 1, 2, 2)
      }
    })

    for (let j = 0; j < cfg.olhos; j++) a.depois(j * ((cfg.encarar + cfg.trava) / cfg.olhos), () => ciclo(j))
  },
})

// ---------- ♦ Rugido ----------
//
// O grito estoura numa parede lateral (alternando os lados): a faixa da
// parede pisca com o vão apagado (`aviso`) e uma onda sonora em arco ')'
// atravessa a caixa a `velocidade` px/s, com um vão de `lacuna` px. Enquanto
// a onda passa, o rugido EMPURRA os corações no sentido dela (`empurrao`
// px/s, menos que a velocidade do coração). Uma onda por vez.
const susieRugido = definirAtaque({
  nome: 'susieRugido',
  padrao: { duracao: 5000, aviso: 500, velocidade: 120, lacuna: 58, passo: 13, curva: 22, empurrao: 50, raio: 6, pausa: 150 },
  iniciar(a, cfg) {
    const empurroes = []
    a.aoAtualizar((dt) => {
      for (const e of empurroes) e.restante -= dt
      const ativos = empurroes.filter((e) => e.restante > 0)
      empurroes.length = 0
      empurroes.push(...ativos)
      if (!ativos.length) return
      const dx = ativos.reduce((soma, e) => soma + e.dir, 0)
      for (const c of a.coracoes) {
        if (!c.ativo) continue
        c.x += (Math.sign(dx) * cfg.empurrao * dt) / 1000
        c.ajustar()
      }
    })

    let primeiro = null
    const rugido = (i) => {
      if (!cabe(a, cfg.aviso)) return
      const l = a.caixa
      const alvo = a.alvo()
      if (primeiro === null) primeiro = alvo.x < l.centerX ? -1 : 1 // começa pela parede mais longe
      const dir = (i % 2 ? -1 : 1) * primeiro // sentido da onda (+1 = para a direita)
      const borda = dir > 0 ? l.left : l.right
      const vao = Math.max(cfg.lacuna, a.lacunaMinima + 6)
      const gc = a.aleatorio(l.top + vao / 2 + 4, l.bottom - vao / 2 - 4)
      const g0 = gc - vao / 2
      const g1 = gc + vao / 2
      a.parede({ eixo: 'y', lacunas: [[g0, g1]] })

      const x = dir > 0 ? l.left : l.right - 14
      a.aviso({ tipo: 'area', x, y: l.top, largura: 14, altura: g0 - l.top, ms: cfg.aviso })
      a.aviso({ tipo: 'area', x, y: g1, largura: 14, altura: l.bottom - g1, ms: cfg.aviso })
      const boca = a.decoracao(a.cena.add.image(borda, l.centerY, T('boca')).setOrigin(0.05, 0.5).setDepth(7).setScale(0.6).setFlipX(dir < 0))
      if (dir < 0) boca.setOrigin(0.95, 0.5)
      a.cena.tweens.add({ targets: boca, scale: 1, duration: 90, yoyo: true, repeat: -1 })

      a.depois(cfg.aviso, () => {
        a.cena.tweens.killTweensOf(boca)
        a.cena.tweens.add({ targets: boca, scale: 1.6, alpha: 0, duration: 260 })
        tocar(a.cena, 'hab-susie-rugido')
        shake(a.cena, 220, 0.006)
        const v = cfg.velocidade
        const travessia = ((l.width + cfg.curva + 30) / (v * a.balas.fatorVelocidade)) * 1000
        empurroes.push({ dir, restante: travessia * 0.85 })
        for (let y = l.top + cfg.passo / 2; y < l.bottom; y += cfg.passo) {
          if (y + cfg.raio + 2 > g0 && y - cfg.raio - 2 < g1) continue // o vão
          // arco: o meio da onda vai na frente
          const u = (y - l.centerY) / (l.height / 2)
          const atras = cfg.curva * u * u
          const b = a.bala({
            x: borda - dir * (8 + atras),
            y,
            vx: dir * v,
            raio: cfg.raio,
            textura: T('som'),
            quadro: Math.round((y - l.top) / cfg.passo) % 2,
            tamanho: 16,
            jaAvisada: true,
            vida: travessia + 200,
            pulso: 0.12,
          })
          b.sprite.setFlipX(dir < 0).setRotation(-dir * Math.atan(2 * cfg.curva * u / (l.height / 2)) * 0.8)
        }
        a.depois(travessia * 0.6 + cfg.pausa, () => rugido(i + 1))
      })
    }
    a.depois(0, () => rugido(0))
  },
})

// ---------- ♣ Bomba de Giz ----------
//
// A cada `intervalo` um maço de gizes amarrados com pavio cai na caixa (metade
// das vezes, `perto` px do coração). O círculo pisca enquanto o pavio queima
// (`pavio` ms) e então: PUF, uma nuvem de pó de giz fica no lugar por `nuvem`
// ms e `fragmentos` pedaços de giz se espalham em cruz (um deles na direção do
// coração), freiam e ficam no chão por `chao` ms antes de sumir.
const susieBombaGiz = definirAtaque({
  nome: 'susieBombaGiz',
  padrao: { duracao: 5000, intervalo: 1600, pavio: 1100, fragmentos: 4, velocidade: 130, alcance: 85, chao: 1100, nuvem: 520, raioNuvem: 22, raioGiz: 4, mirar: 0.5, perto: 58, distancia: 70 },
  iniciar(a, cfg) {
    let mira = 0.5

    const pontoPerto = (alvo) => {
      const l = a.caixa
      const m = 20
      let melhor = null
      for (let tentativa = 0; tentativa < 12; tentativa++) {
        const ang = a.aleatorio(0, Math.PI * 2)
        const p = { x: limitar(alvo.x + Math.cos(ang) * cfg.perto, l.left + m, l.right - m), y: limitar(alvo.y + Math.sin(ang) * cfg.perto, l.top + m, l.bottom - m) }
        const d = Math.hypot(p.x - alvo.x, p.y - alvo.y)
        if (d >= cfg.perto * 0.8) return p
        if (!melhor || d > melhor.d) melhor = { ...p, d }
      }
      return melhor
    }

    a.aCada(cfg.intervalo, (i) => {
      if (!cabe(a, cfg.pavio)) return
      mira += Number(cfg.mirar) || 0
      const plantada = mira >= 1
      if (plantada) mira -= 1
      const alvo = a.alvo()
      const p = plantada ? pontoPerto(alvo) : a.pontoLonge(cfg.distancia, 20)
      const giro = plantada ? Math.atan2(alvo.y - p.y, alvo.x - p.x) : Math.PI / 4 + i * 0.4

      // o maço cai girando e quica no chão
      const bomba = a.decoracao(a.cena.add.image(p.x, p.y - 34, T('bomba'), 0).setDepth(6).setAngle(-140).setScale(1.1))
      a.cena.tweens.add({ targets: bomba, y: p.y, angle: 0, duration: 240, ease: 'Bounce.Out' })
      let quadro = 0
      a.aCada(120, () => bomba.active && bomba.setFrame((quadro = 1 - quadro)), Math.floor(cfg.pavio / 120))
      a.cena.tweens.add({ targets: bomba, scale: 1.3, duration: 140, yoyo: true, repeat: -1, delay: 240 })

      a.aviso({ tipo: 'circulo', x: p.x, y: p.y, raio: cfg.raioNuvem + 4, ms: cfg.pavio }, () => {
        a.cena.tweens.killTweensOf(bomba)
        bomba.setVisible(false)
        tocar(a.cena, 'hab-susie-giz')
        particulas(a.cena, p.x, p.y, { cor: GIZ, quantidade: 18, velocidade: 140, vida: 420 })
        // a nuvem de pó de giz
        const nuvem = a.bala({ x: p.x, y: p.y, raio: cfg.raioNuvem, textura: T('poeira'), tamanho: cfg.raioNuvem * 2.3, jaAvisada: true, atravessa: true, vida: cfg.nuvem, pulso: 0.06, girar: 0.8 })
        nuvem.atualizar = (b) => b.sprite.setAlpha(Math.max(0.2, b.vida / cfg.nuvem))
        // os pedaços de giz: saem em cruz, freiam e ficam no chão
        for (let k = 0; k < cfg.fragmentos; k++) pedaco(a, cfg, p, giro + (k * Math.PI * 2) / cfg.fragmentos, i + k)
      })
    })
  },
})

function pedaco(a, cfg, p, ang, n) {
  const v0 = cfg.velocidade
  const freio = (v0 * v0) / (2 * cfg.alcance) // para em `alcance` px
  let v = v0
  let parado = 0
  let rabisco = 0
  a.bala({
    x: p.x,
    y: p.y,
    raio: cfg.raioGiz,
    textura: T('giz'),
    quadro: n % 3,
    tamanho: 11,
    jaAvisada: true,
    vx: Math.cos(ang) * v0,
    vy: Math.sin(ang) * v0,
    girar: 9,
    vida: 4000,
    pulso: 0,
    atualizar: (b, dt) => {
      const s = (dt / 1000) * a.balas.fatorVelocidade
      if (v > 0) {
        v = Math.max(0, v - freio * s)
        b.vx = Math.cos(ang) * v
        b.vy = Math.sin(ang) * v
        b.girar = (9 * v) / v0
        // rabisco de giz no chão
        rabisco -= dt
        if (rabisco <= 0) {
          rabisco = 45
          const ponto = a.decoracao(a.cena.add.rectangle(b.x, b.y, 2, 2, GIZ).setDepth(2).setAlpha(0.7))
          a.cena.tweens.add({ targets: ponto, alpha: 0, duration: 700, onComplete: () => ponto.destroy() })
        }
        return
      }
      parado += dt
      b.piscar = parado > cfg.chao - 400 // pisca antes de sumir
      if (parado >= cfg.chao) b.morta = true
    },
  })
}

export default { susieCabecada, susiePisao, susieGiro, susieEncarar, susieRugido, susieBombaGiz }
