// Ataques exclusivos das cartas de dess (uma entrada por ataque, com prefixo 'dess'):
//   dessExemplo: definirAtaque({ nome: 'dessExemplo', padrao: {...}, iniciar(a, cfg) {...} })
// As receitas de pvp/baralhos/dess.js chamam A.dessExemplo(...).
//
// Sprites e sons: pvp/habilidades/sprites/dess.js (gerados por scripts/habilidades/dess.py).
import { definirAtaque } from '../definir.js'
import { CORES } from '../../constants.js'
import { tocar } from '../../audio.js'
import { particulas } from '../../effects/particulas.js'

const T = (nome) => `hab-dess-${nome}`
const fator = (a) => a.balas.fatorVelocidade ?? 1
const limitar = (v, min, max) => Math.min(Math.max(v, min), max)
const ROSA = 0xff5070
const CORES_SHOW = [0xff5070, 0xffb03a, 0xffe14a, 0xff9ad0]

// fantasma que some (rastro de movimento), recortado na caixa
function rastro(a, textura, x, y, { rotacao = 0, escala = 1, alfa = 0.4, ms = 200, flipX = false } = {}) {
  const img = a.decoracao(a.cena.add.image(x, y, textura).setDepth(4).setRotation(rotacao).setScale(escala).setAlpha(alfa).setFlipX(flipX))
  a.cena.tweens.add({ targets: img, alpha: 0, duration: ms, onComplete: () => img.destroy() })
}

// Desloca a bala na direção (nx, ny) para o deslocamento novo (guarda o anterior em b.desloc)
function deslocar(b, nx, ny, novo) {
  const d = novo - (b.desloc ?? 0)
  b.x += nx * d
  b.y += ny * d
  b.desloc = novo
}

// Ponto de uma borda da caixa: lado 'top' | 'bottom' | 'left' | 'right', u de 0 a 1, m = margem para dentro
function pontoDaBorda(l, lado, u, m) {
  if (lado === 'top') return { x: l.left + u * l.width, y: l.top + m }
  if (lado === 'bottom') return { x: l.left + u * l.width, y: l.bottom - m }
  if (lado === 'left') return { x: l.left + m, y: l.top + u * l.height }
  return { x: l.right - m, y: l.top + u * l.height }
}
const PARA_DENTRO = { top: Math.PI / 2, bottom: -Math.PI / 2, left: 0, right: Math.PI }

// ---------- ♠ Nota Solta ----------
// Colcheias escapam pelas bordas (piscando antes) e flutuam até o coração
// balançando de um lado para o outro, como uma nota que se soltou da música.
const dessNotaSolta = definirAtaque({
  nome: 'dessNotaSolta',
  padrao: { duracao: 5000, intervalo: 600, velocidade: 110, raio: 6, aviso: 480, balanco: 12, frequencia: 2.2, mirar: 0.7 },
  iniciar(a, cfg) {
    let mira = 0.5
    const lados = ['top', 'left', 'right', 'top', 'right', 'left', 'bottom']
    a.aCada(cfg.intervalo, (i) => {
      const l = a.caixa
      const lado = lados[i % lados.length]
      const p = pontoDaBorda(l, lado, a.aleatorio(0.12, 0.88), cfg.raio + 3)
      mira += cfg.mirar
      let dir = PARA_DENTRO[lado] + a.aleatorio(-0.6, 0.6)
      if (mira >= 1) {
        mira -= 1
        const alvo = a.alvo()
        dir = Math.atan2(alvo.y - p.y, alvo.x - p.x)
      }
      const nx = -Math.sin(dir)
      const ny = Math.cos(dir)
      const fase0 = a.aleatorio(0, Math.PI * 2)
      particulas(a.cena, p.x, p.y, { cor: ROSA, quantidade: 5, velocidade: 60, vida: 300 })
      a.bala({
        x: p.x,
        y: p.y,
        vx: Math.cos(dir) * cfg.velocidade,
        vy: Math.sin(dir) * cfg.velocidade,
        raio: cfg.raio,
        textura: T('nota'),
        tamanho: 19,
        pulso: 0.05,
        aviso: cfg.aviso,
        atualizar: (b, dt) => {
          b.fase = (b.fase ?? fase0) + (dt / 1000) * Math.PI * 2 * cfg.frequencia * fator(a)
          deslocar(b, nx, ny, cfg.balanco * (Math.sin(b.fase) - Math.sin(fase0)))
          b.sprite.setRotation(0.35 * Math.cos(b.fase))
        },
      })
    })
  },
})

// ---------- ♠ Taco de Beisebol ----------
// Um taco gira preso na parede (lado alternado, na altura do coração) e varre
// meia-volta. Antes, o meio-círculo que ele alcança pisca e o taco aparece
// piscando na posição de partida. Fora do alcance (o resto da caixa) é seguro.
const dessTaco = definirAtaque({
  nome: 'dessTaco',
  padrao: { duracao: 5000, intervalo: 1300, comprimento: 130, espessura: 14, aviso: 600, varrida: 460 },
  iniciar(a, cfg) {
    a.aCada(cfg.intervalo, (i) => {
      const l = a.caixa
      const esquerda = i % 2 === 0
      const descer = Math.floor(i / 2) % 2 === 0
      const L = Math.min(cfg.comprimento, l.width - a.lacunaMinima - 6)
      a.lacuna(l.width - L, 'fora do alcance do taco')
      const alvo = a.alvo()
      const px = esquerda ? l.left - 2 : l.right + 2
      const py = limitar(alvo.y, l.top + 24, l.bottom - 24)
      // ângulo do taco (de quem está na esquerda; a direita espelha)
      const [a0, a1] = descer ? [-Math.PI / 2, Math.PI / 2] : [Math.PI / 2, -Math.PI / 2]
      const angulo = (p) => {
        const th = a0 + (a1 - a0) * p
        return esquerda ? th : Math.PI - th
      }
      const suave = (p) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p))

      a.aviso({ tipo: 'circulo', x: px, y: py, raio: L + cfg.espessura / 2, ms: cfg.aviso })
      a.depois(cfg.aviso, () => tocar(a.cena, T('tacada')))
      const ang0 = angulo(0)
      a.bala({
        x: px + (Math.cos(ang0) * L) / 2,
        y: py + (Math.sin(ang0) * L) / 2,
        comprimento: L,
        espessura: cfg.espessura,
        angulo: ang0,
        textura: T('taco'),
        tamanho: L * 1.04,
        aviso: cfg.aviso,
        atravessa: true,
        atualizar: (b, dt) => {
          b.prog = (b.prog ?? 0) + (dt / cfg.varrida) * fator(a)
          const p = Math.min(1, b.prog)
          const ang = angulo(suave(p))
          b.angulo = ang
          b.x = px + (Math.cos(ang) * L) / 2
          b.y = py + (Math.sin(ang) * L) / 2
          if (p < 1) rastro(a, T('taco'), b.x, b.y, { rotacao: ang, escala: b.sprite.scaleX, alfa: 0.3, ms: 160 })
          else if ((b.prog - 1) * cfg.varrida > 140) b.morta = true
        },
      })
    })
  },
})

// ---------- ♠ Home Run ----------
// Do "home plate" (borda de baixo) um taco rebate a bola com força: a linha
// do voo pisca antes e a bola atravessa a caixa toda, rápida, até sumir.
const dessHomeRun = definirAtaque({
  nome: 'dessHomeRun',
  padrao: { duracao: 5000, intervalo: 1100, velocidade: 330, raio: 7, aviso: 560, bolas: 1, abertura: 0.5 },
  iniciar(a, cfg) {
    a.aCada(cfg.intervalo, (i) => {
      const l = a.caixa
      const alvo = a.alvo()
      const bx = limitar(alvo.x + (i % 2 ? 1 : -1) * a.aleatorio(30, 80), l.left + 16, l.right - 16)
      const by = l.bottom - 8
      const cima = -Math.PI / 2
      const desvio = limitar(Math.atan2(alvo.y - by, alvo.x - bx) - cima, -1.05, 1.05)
      for (let k = 0; k < cfg.bolas; k++) {
        const dir = cima + desvio + (k - (cfg.bolas - 1) / 2) * cfg.abertura
        const vx = Math.cos(dir)
        const vy = Math.sin(dir)
        a.aviso({ tipo: 'linha', x1: bx, y1: by, x2: bx + vx * 420, y2: by + vy * 420, espessura: cfg.raio * 2 + 6, ms: cfg.aviso }, () => {
          if (k === 0) rebater(a, bx, by)
          a.bala({
            x: bx,
            y: by,
            vx: vx * cfg.velocidade,
            vy: vy * cfg.velocidade,
            raio: cfg.raio,
            textura: T('bola'),
            tamanho: cfg.raio * 2.5,
            girar: 14,
            jaAvisada: true,
            atualizar: (b, dt) => {
              b.rastro = (b.rastro ?? 0) + dt
              if (b.rastro < 35) return
              b.rastro = 0
              rastro(a, T('bola'), b.x, b.y, { escala: b.sprite.scaleX, alfa: 0.35, ms: 220 })
            },
          })
        })
      }
    })
  },
})

// a tacada que manda a bola: o taco gira no home plate e um estalo aparece
function rebater(a, x, y) {
  tocar(a.cena, T('rebatida'))
  const taco = a.decoracao(a.cena.add.image(x - 6, y + 2, T('taco')).setDepth(6).setScale(0.75).setOrigin(0.08, 0.5).setRotation(Math.PI + 0.5))
  a.cena.tweens.add({ targets: taco, rotation: Math.PI * 2 - 0.2, duration: 110, onComplete: () => a.cena.tweens.add({ targets: taco, alpha: 0, duration: 220, onComplete: () => taco.destroy() }) })
  const estalo = a.decoracao(a.cena.add.image(x, y - 4, T('impacto')).setDepth(7).setScale(0.5))
  a.cena.tweens.add({ targets: estalo, scale: 1.3, alpha: 0, duration: 260, onComplete: () => estalo.destroy() })
  particulas(a.cena, x, y, { cor: 0xffe050, quantidade: 8, velocidade: 140, vida: 260 })
}

// ---------- ♠ Solo de Guitarra ----------
// A guitarra corre pela parede tocando a melodia: cada nota longa é uma fila
// de notinhas que atravessa a caixa numa "corda" (faixa); a melodia sobe e
// desce de faixa a cada tempo. A boca de cada faixa pisca antes de a nota
// sair. A cada frase as faixas andam meia altura (não dá para ficar parado
// entre duas) e, a cada duas frases, a guitarra troca de lado.
const dessSolo = definirAtaque({
  nome: 'dessSolo',
  padrao: { duracao: 6000, batida: 260, cadencia: 65, velocidade: 170, raio: 5, aviso: 450, faixas: 6, frase: 8, pausa: 1 },
  iniciar(a, cfg) {
    const guitarra = a.decoracao(a.cena.add.image(a.caixa.right - 6, a.caixa.centerY, T('guitarra')).setDepth(6).setRotation(Math.PI / 2).setAlpha(0))
    let faixa = a.inteiro(0, cfg.faixas - 1)
    const passos = [-2, -1, 1, 2, 1, -1, 3, -3]
    const ciclo = cfg.frase + cfg.pausa

    a.aCada(cfg.batida, (k) => {
      const frase = Math.floor(k / ciclo)
      if (k % ciclo >= cfg.frase) return // pausa no fim da frase
      const l = a.caixa
      const direita = Math.floor(frase / 2) % 2 === 0
      const meio = frase % 2 ? 0.5 : 0
      const margem = 12
      const espaco = (l.height - 2 * margem) / (cfg.faixas - 1)
      faixa += a.escolher(passos)
      if (faixa < 0) faixa = -faixa
      if (faixa > cfg.faixas - 1 - (meio ? 1 : 0)) faixa = Math.max(0, 2 * (cfg.faixas - 1 - (meio ? 1 : 0)) - faixa)
      const y = l.top + margem + (faixa + meio) * espaco
      const sinal = direita ? -1 : 1
      const boca = direita ? l.right - 8 : l.left + 8
      const cor = CORES_SHOW[frase % CORES_SHOW.length]

      a.aviso({ tipo: 'linha', x1: boca, y1: y, x2: boca + sinal * 60, y2: y, espessura: cfg.raio * 2 + 4, cor, ms: cfg.aviso }, () => {
        a.cena.tweens.killTweensOf(guitarra)
        guitarra.setAlpha(1).setFlipY(!direita)
        a.cena.tweens.add({ targets: guitarra, x: direita ? l.right - 6 : l.left + 6, y, duration: 70 })
        const notas = Math.max(2, Math.round(cfg.batida / cfg.cadencia))
        a.aCada(
          cfg.cadencia,
          () =>
            a.bala({
              x: boca,
              y,
              vx: sinal * cfg.velocidade,
              raio: cfg.raio,
              textura: T('notas'),
              tamanho: 14,
              cor,
              pulso: 0.12,
              jaAvisada: true,
            }),
          notas,
          0,
        )
      })
    })
  },
})

// ---------- ♦ Microfonia ----------
// Um microfone encosta na parede e a faixa dele pisca; então sai um agudo
// serrilhado (faíscas em zigue-zague bem rápido) atravessando a faixa.
const dessMicrofonia = definirAtaque({
  nome: 'dessMicrofonia',
  padrao: { duracao: 5000, intervalo: 1200, aviso: 560, velocidade: 300, amplitude: 9, periodo: 110, faiscas: 10, cadencia: 28, raio: 5, espessura: 30, quantidade: 1 },
  iniciar(a, cfg) {
    const disparar = (lado) => {
      const l = a.caixa
      const alvo = a.alvo()
      const meia = cfg.espessura / 2
      const vertical = lado === 'top'
      const p = vertical ? limitar(alvo.x, l.left + meia, l.right - meia) : limitar(alvo.y, l.top + meia, l.bottom - meia)
      a.parede({ eixo: vertical ? 'x' : 'y', ocupados: [[p - meia, p + meia]] })
      const boca = vertical ? { x: p, y: l.top + 10 } : { x: lado === 'left' ? l.left + 10 : l.right - 10, y: p }
      const dir = PARA_DENTRO[lado]
      const mic = a.decoracao(
        a.cena.add
          .image(boca.x - Math.cos(dir) * 4, boca.y - Math.sin(dir) * 4, T('microfone'))
          .setDepth(6)
          .setRotation(dir + Math.PI / 2),
      )
      a.cena.tweens.add({ targets: mic, angle: mic.angle + 6, duration: 45, yoyo: true, repeat: -1 })
      const linha = vertical ? { x1: p, y1: l.top, x2: p, y2: l.bottom } : { x1: l.left, y1: p, x2: l.right, y2: p }
      a.aviso({ tipo: 'linha', ...linha, espessura: cfg.espessura, ms: cfg.aviso }, () => {
        tocar(a.cena, T('microfonia'))
        a.depois(cfg.faiscas * cfg.cadencia + 200, () => {
          a.cena.tweens.killTweensOf(mic)
          a.cena.tweens.add({ targets: mic, alpha: 0, duration: 200, onComplete: () => mic.destroy() })
        })
        const nx = -Math.sin(dir)
        const ny = Math.cos(dir)
        // zigue-zague: cada faísca fica num degrau da onda triangular (0, +A, 0, -A...) e treme rápido
        const tri = (f) => (2 / Math.PI) * Math.asin(Math.sin(f))
        a.aCada(
          cfg.cadencia,
          (k) => {
            const d0 = cfg.amplitude * 0.8 * tri((k * Math.PI) / 2)
            const fase0 = k * 1.3
            a.bala({
              x: boca.x + nx * d0,
              y: boca.y + ny * d0,
              vx: Math.cos(dir) * cfg.velocidade,
              vy: Math.sin(dir) * cfg.velocidade,
              raio: cfg.raio,
              textura: T('chiado'),
              tamanho: 12,
              pulso: 0.2,
              jaAvisada: true,
              atualizar: (b, dt) => {
                b.fase = (b.fase ?? fase0) + (dt / cfg.periodo) * Math.PI * 2 * fator(a)
                b.desloc = b.desloc ?? d0
                deslocar(b, nx, ny, d0 + cfg.amplitude * 0.2 * Math.sin(b.fase))
                b.sprite.setFlipY(Math.sin(b.fase) > 0)
              },
            })
          },
          cfg.faiscas,
          0,
        )
      })
    }

    a.aCada(cfg.intervalo, (i) => {
      const lado = i % 3 === 2 ? 'top' : i % 2 ? 'right' : 'left'
      disparar(lado)
      if (cfg.quantidade > 1) disparar(lado === 'top' ? (i % 2 ? 'left' : 'right') : 'top')
    })
  },
})

// ---------- ♦ Palheta ----------
// Palhetada alternada: uma varrida de palhetas sai da borda de cima (para
// baixo), uma depois da outra, todas giradas para o coração; a próxima vem
// de baixo (para cima). Cada palheta pisca na borda antes de voar.
const dessPalheta = definirAtaque({
  nome: 'dessPalheta',
  padrao: { duracao: 5000, intervalo: 1000, palhetas: 4, cadencia: 70, velocidade: 170, raio: 6, aviso: 450, abertura: 110 },
  iniciar(a, cfg) {
    a.aCada(cfg.intervalo, (i) => {
      const l = a.caixa
      const alvo = a.alvo()
      let lado = i % 2 ? 'bottom' : 'top'
      // coração colado nessa borda: a palhetada vem da outra
      if (lado === 'top' && alvo.y - l.top < 55) lado = 'bottom'
      else if (lado === 'bottom' && l.bottom - alvo.y < 55) lado = 'top'
      const n = cfg.palhetas
      const ida = i % 4 < 2 ? 1 : -1 // varre da esquerda para a direita ou ao contrário
      tocar(a.cena, T('palheta'))
      a.aCada(
        cfg.cadencia,
        (k) => {
          const kk = ida > 0 ? k : n - 1 - k
          const x = limitar(alvo.x - cfg.abertura / 2 + (kk * cfg.abertura) / (n - 1), l.left + 10, l.right - 10)
          const y = lado === 'top' ? l.top + cfg.raio + 2 : l.bottom - cfg.raio - 2
          const dir = Math.atan2(alvo.y - y, alvo.x - x)
          a.bala({
            x,
            y,
            vx: Math.cos(dir) * cfg.velocidade,
            vy: Math.sin(dir) * cfg.velocidade,
            raio: cfg.raio,
            textura: T('palheta'),
            tamanho: 16,
            girar: 9 * ida,
            aviso: cfg.aviso,
          })
        },
        n,
        0,
      )
    })
  },
})

// ---------- ♦ Feedback ----------
// O som entra em loop entre duas caixas de som: um pulso sai de uma parede
// (piscando antes), atravessa a caixa e, ao chegar na outra parede, volta
// MAIS ALTO (mais comprido e mais rápido). A cada volta ele pisca de novo na
// parede antes de sair. Sempre sobra um vão por cima ou por baixo.
const dessFeedback = definirAtaque({
  nome: 'dessFeedback',
  padrao: { duracao: 6000, intervalo: 1700, velocidade: 150, altura: 40, cresce: 14, acelera: 1.12, passagens: 3, largura: 10, aviso: 520, avisoVolta: 420 },
  iniciar(a, cfg) {
    const vao = a.lacunaMinima + 4

    const passagem = (lado, y, n, h, v) => {
      const l = a.caixa
      const x = lado === 'left' ? l.left + cfg.largura / 2 : l.right - cfg.largura / 2
      const sinal = lado === 'left' ? 1 : -1
      // a caixa de som que solta o pulso
      const caixa = a.decoracao(
        a.cena.add
          .image(lado === 'left' ? l.left + 6 : l.right - 6, y, T('caixasom'))
          .setDepth(6)
          .setScale(0.2, Math.max(0.9, h / 26))
          .setFlipX(lado === 'right'),
      )
      a.cena.tweens.add({ targets: caixa, scaleX: 0.8, duration: 120, yoyo: true, repeat: 1, onComplete: () => a.cena.tweens.add({ targets: caixa, alpha: 0, duration: 300, onComplete: () => caixa.destroy() }) })
      tocar(a.cena, T('grave'))
      const b = a.bala({
        x,
        y,
        vx: sinal * v,
        largura: cfg.largura,
        altura: h,
        textura: T('pulso'),
        aviso: n === 0 ? cfg.aviso : cfg.avisoVolta,
        atravessa: true,
        atualizar: (bala) => {
          const fim = sinal > 0 ? bala.x >= a.caixa.right - cfg.largura / 2 : bala.x <= a.caixa.left + cfg.largura / 2
          if (!fim) return
          bala.morta = true
          if (n + 1 < cfg.passagens) passagem(lado === 'left' ? 'right' : 'left', y, n + 1, h + cfg.cresce, v * cfg.acelera)
        },
      })
      b.sprite.setDisplaySize(cfg.largura * 1.6, h * 1.04)
      b.escalaX = b.sprite.scaleX
      b.escalaY = b.sprite.scaleY
    }

    a.aCada(cfg.intervalo, (i) => {
      const l = a.caixa
      const alvo = a.alvo()
      const hMax = cfg.altura + cfg.cresce * (cfg.passagens - 1)
      a.lacuna(l.height - hMax, 'vão do feedback')
      // centro no coração, mas sempre deixando um vão de `vao` px por cima ou por baixo
      let c = limitar(alvo.y, l.top + hMax / 2, l.bottom - hMax / 2)
      const cima = c - hMax / 2 - l.top
      const baixo = l.bottom - c - hMax / 2
      if (Math.max(cima, baixo) < vao) c = cima <= baixo ? l.bottom - vao - hMax / 2 : l.top + vao + hMax / 2
      a.parede({ eixo: 'y', ocupados: [[c - hMax / 2, c + hMax / 2]] })
      passagem(i % 2 ? 'right' : 'left', c, 0, cfg.altura, cfg.velocidade)
    })
  },
})

// ---------- ♣ Bomba de Fumaça ----------
// Latas de fumaça caem (o pavio pisca no chão) e viram nuvens que ficam no
// chão e cobrem a vista (o coração aparece meio apagado por baixo). Escondidas
// na fumaça, brasas acendem (piscando POR CIMA da nuvem) e saem devagar.
const dessFumaca = definirAtaque({
  nome: 'dessFumaca',
  padrao: { duracao: 5000, intervalo: 1700, pavio: 700, nuvem: 2600, brasas: 6, velocidade: 75, raio: 4, aviso: 460, espalha: 24, perto: 64, mirar: 0.5 },
  iniciar(a, cfg) {
    let mira = 0.5

    const pontoPerto = (alvo) => {
      const l = a.caixa
      const m = 24
      let melhor = null
      for (let k = 0; k < 12; k++) {
        const ang = a.aleatorio(0, Math.PI * 2)
        const p = { x: limitar(alvo.x + Math.cos(ang) * cfg.perto, l.left + m, l.right - m), y: limitar(alvo.y + Math.sin(ang) * cfg.perto, l.top + m, l.bottom - m) }
        const d = Math.hypot(p.x - alvo.x, p.y - alvo.y)
        if (d >= cfg.perto * 0.8) return p
        if (!melhor || d > melhor.d) melhor = { ...p, d }
      }
      return melhor
    }

    a.aCada(cfg.intervalo, () => {
      mira += cfg.mirar
      const plantada = mira >= 1
      if (plantada) mira -= 1
      const p = plantada ? pontoPerto(a.alvo()) : a.pontoLonge(70, 24)
      const lata = a.decoracao(a.cena.add.image(p.x, p.y - 30, T('lata')).setDepth(6).setScale(1.2).setAlpha(0))
      a.cena.tweens.add({ targets: lata, y: p.y, alpha: 1, duration: 220, ease: 'Quad.easeIn' })
      a.cena.tweens.add({ targets: lata, angle: 14, duration: 70, yoyo: true, repeat: -1, delay: 220 })

      a.aviso({ tipo: 'circulo', x: p.x, y: p.y, raio: 22, ms: cfg.pavio }, () => {
        a.cena.tweens.killTweensOf(lata)
        lata.destroy()
        tocar(a.cena, T('fumaca'))
        nuvem(a, p, cfg)
        const cadencia = (cfg.nuvem - 600) / cfg.brasas
        a.aCada(
          cadencia,
          (k) => {
            const ang = a.aleatorio(0, Math.PI * 2)
            const r = a.aleatorio(0, cfg.espalha * 0.6)
            const x = p.x + Math.cos(ang) * r
            const y = p.y + Math.sin(ang) * r
            const alvo = a.alvo()
            const dir = k === 0 ? Math.atan2(alvo.y - y, alvo.x - x) : a.aleatorio(0, Math.PI * 2)
            const b = a.bala({
              x,
              y,
              vx: Math.cos(dir) * cfg.velocidade,
              vy: Math.sin(dir) * cfg.velocidade,
              raio: cfg.raio,
              textura: T('brasa'),
              tamanho: 11,
              pulso: 0.2,
              aviso: cfg.aviso,
              vida: 3200,
            })
            b.sprite.setDepth(12) // por cima da fumaça
          },
          cfg.brasas,
          150,
        )
      })
    })
  },
})

// nuvem de fumaça: alguns tufos por cima do coração (meio transparentes), por baixo das brasas
function nuvem(a, p, cfg) {
  particulas(a.cena, p.x, p.y, { cor: 0xd0c8d8, quantidade: 10, velocidade: 90, vida: 350 })
  for (let k = 0; k < 6; k++) {
    const ang = (k / 6) * Math.PI * 2 + a.aleatorio(-0.4, 0.4)
    const r = k === 0 ? 0 : a.aleatorio(cfg.espalha * 0.5, cfg.espalha)
    const escala = a.aleatorio(1.1, 1.5)
    const tufo = a.decoracao(
      a.cena.add
        .image(p.x + Math.cos(ang) * r * 0.4, p.y + Math.sin(ang) * r * 0.4, T('fumaca'))
        .setDepth(11)
        .setScale(escala * 0.4)
        .setAlpha(0)
        .setRotation(a.aleatorio(0, Math.PI * 2)),
    )
    a.cena.tweens.add({ targets: tufo, x: p.x + Math.cos(ang) * r, y: p.y + Math.sin(ang) * r, scale: escala, alpha: 0.6, duration: 280, ease: 'Quad.easeOut' })
    a.cena.tweens.add({ targets: tufo, scale: escala * 1.25, x: `+=${a.aleatorio(-8, 8)}`, y: `-=${a.aleatorio(2, 10)}`, duration: cfg.nuvem, delay: 280 })
    a.cena.tweens.add({ targets: tufo, alpha: 0, duration: 450, delay: cfg.nuvem, onComplete: () => tufo.destroy() })
  }
}

// ---------- ♣ Amplificador ----------
// Amplificadores são largados nas bordas, virados para o coração. O cone do
// som pisca enquanto ele esquenta; depois ele bate o grave no tempo: frentes
// de onda curvas saem pelo cone e se abrem conforme andam (até `maximo` px).
const dessAmplificador = definirAtaque({
  nome: 'dessAmplificador',
  padrao: { duracao: 5500, intervalo: 1500, aquece: 650, pulsos: 3, batida: 380, velocidade: 130, abertura: 0.32, boca: 18, maximo: 92, espessura: 8 },
  iniciar(a, cfg) {
    const lados = ['bottom', 'left', 'right', 'bottom', 'top', 'right', 'left']
    a.aCada(cfg.intervalo, (i) => {
      const l = a.caixa
      const alvo = a.alvo()
      let lado = lados[i % lados.length]
      const distancia = { top: alvo.y - l.top, bottom: l.bottom - alvo.y, left: alvo.x - l.left, right: l.right - alvo.x }
      if (distancia[lado] < 60) lado = Object.entries(distancia).sort((p, q) => q[1] - p[1])[0][0]
      const p = pontoDaBorda(l, lado, a.aleatorio(0.2, 0.8), 10)
      const normal = PARA_DENTRO[lado]
      const dir = normal + limitar(Math.atan2(alvo.y - p.y, alvo.x - p.x) - normal, -0.85, 0.85)
      a.lacuna(l.height - cfg.maximo, 'lado da frente de onda')

      const amp = a.decoracao(a.cena.add.image(p.x, p.y, T('amp')).setDepth(6).setRotation(dir + Math.PI / 2).setScale(0))
      a.cena.tweens.add({ targets: amp, scale: 0.85, duration: 180, ease: 'Back.easeOut' })
      const cone = desenharCone(a, p, dir, cfg)
      a.cena.tweens.add({ targets: cone, alpha: 0.3, duration: 90, yoyo: true, repeat: -1 })
      a.depois(cfg.aquece, () => {
        a.cena.tweens.killTweensOf(cone)
        cone.setAlpha(0.35)
      })

      a.aCada(
        cfg.batida,
        (k) => {
          tocar(a.cena, T('grave'))
          a.cena.tweens.add({ targets: amp, scale: 1, duration: 70, yoyo: true })
          const largura = (d) => Math.min(cfg.maximo, 18 + 2 * d * cfg.abertura)
          const x0 = p.x + Math.cos(dir) * cfg.boca
          const y0 = p.y + Math.sin(dir) * cfg.boca
          const b = a.bala({
            x: x0,
            y: y0,
            vx: Math.cos(dir) * cfg.velocidade,
            vy: Math.sin(dir) * cfg.velocidade,
            comprimento: largura(0),
            espessura: cfg.espessura,
            angulo: dir - Math.PI / 2,
            textura: T('arco'),
            jaAvisada: true, // nasce dentro do cone que piscou
            atravessa: true,
            atualizar: (bala) => {
              const d = Math.hypot(bala.x - x0, bala.y - y0) + cfg.boca
              bala.comprimento = largura(d)
              bala.sprite.setDisplaySize(bala.comprimento * 1.05, cfg.espessura * 1.6)
            },
          })
          b.sprite.setDisplaySize(b.comprimento * 1.05, cfg.espessura * 1.6)
          if (k === cfg.pulsos - 1) {
            a.depois(300, () => {
              a.cena.tweens.killTweensOf([amp, cone])
              a.cena.tweens.add({ targets: [amp, cone], alpha: 0, duration: 250, onComplete: () => (amp.destroy(), cone.destroy()) })
            })
          }
        },
        cfg.pulsos,
        cfg.aquece,
      )
    })
  },
})

// o cone por onde o som do amplificador sai (aviso, recortado na caixa)
function desenharCone(a, p, dir, cfg) {
  const g = a.decoracao(a.cena.add.graphics().setDepth(4))
  const meio = Math.atan(cfg.abertura)
  const alcance = 320
  const b0 = 9 / Math.cos(meio) // a boca já tem ~18 px de largura
  const pts = [
    { x: p.x + Math.cos(dir - Math.PI / 2) * b0, y: p.y + Math.sin(dir - Math.PI / 2) * b0 },
    { x: p.x + Math.cos(dir - meio) * alcance, y: p.y + Math.sin(dir - meio) * alcance },
    { x: p.x + Math.cos(dir + meio) * alcance, y: p.y + Math.sin(dir + meio) * alcance },
    { x: p.x + Math.cos(dir + Math.PI / 2) * b0, y: p.y + Math.sin(dir + Math.PI / 2) * b0 },
  ]
  g.fillStyle(CORES.aviso, 0.2)
  g.lineStyle(2, CORES.aviso, 0.8)
  g.fillPoints(pts, true)
  g.strokePoints(pts, true)
  return g
}

// ---------- ♣ Cabos Enrolados ----------
// Cabos de guitarra se esticam de uma parede à outra (plugue nas pontas),
// enrolados em curvas. Cada cabo pisca inteiro antes de valer e depois fica
// no chão serpenteando por um tempo. Horizontais e verticais se alternam.
const dessCabos = definirAtaque({
  nome: 'dessCabos',
  padrao: { duracao: 6000, intervalo: 1300, vida: 2400, aviso: 560, passo: 9, raio: 4, amplitude: 11, ondas: 2.5, serpenteia: 2.4, maxCabos: 3, distancia: 56 },
  iniciar(a, cfg) {
    const vivos = [] // { horizontal, p1, p2, fim }

    a.aCada(cfg.intervalo, (i) => {
      const l = a.caixa
      for (let k = vivos.length - 1; k >= 0; k--) if (vivos[k].fim <= a.tempo) vivos.splice(k, 1)
      if (vivos.length >= cfg.maxCabos) return
      const horizontal = i % 2 === 0
      const alvo = a.alvo()
      const [ini, fim] = horizontal ? [l.top + 14, l.bottom - 14] : [l.left + 14, l.right - 14]
      const paralelos = vivos.filter((c) => c.horizontal === horizontal)
      // pontas longe das pontas dos cabos paralelos (sem prender o coração numa fresta)
      let e1 = null
      let e2 = null
      for (let tentativa = 0; tentativa < 10; tentativa++) {
        e1 = a.aleatorio(ini, fim)
        if (tentativa < 6 && i % 3 !== 2) {
          // passa pelo coração: a segunda ponta continua a reta que sai de e1 e cruza o coração
          const [c, d, alc] = horizontal ? [alvo.y, alvo.x - l.left, l.width] : [alvo.x, alvo.y - l.top, l.height]
          e2 = limitar(e1 + ((c - e1) * alc) / Math.max(30, d), ini, fim)
        } else e2 = a.aleatorio(ini, fim)
        if (paralelos.every((c) => Math.abs(c.e1 - e1) >= cfg.distancia && Math.abs(c.e2 - e2) >= cfg.distancia)) break
      }
      const p1 = horizontal ? { x: l.left, y: e1 } : { x: e1, y: l.top }
      const p2 = horizontal ? { x: l.right, y: e2 } : { x: e2, y: l.bottom }
      vivos.push({ horizontal, e1, e2, fim: a.tempo + cfg.aviso + cfg.vida + 800 })
      esticarCabo(a, cfg, p1, p2)
    })
  },
})

function esticarCabo(a, cfg, p1, p2) {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const comp = Math.hypot(dx, dy)
  const nx = -dy / comp
  const ny = dx / comp
  const n = Math.ceil(comp / cfg.passo)
  const fase0 = a.aleatorio(0, Math.PI * 2)
  const ondas = cfg.ondas + a.aleatorio(-0.5, 0.5)
  const desvio = (s, fase) => cfg.amplitude * Math.sqrt(Math.sin(Math.PI * s)) * Math.sin(Math.PI * 2 * ondas * s + fase)

  // plugues nas pontas, apontando para dentro
  const ang = Math.atan2(dy, dx)
  const plugues = [
    a.decoracao(a.cena.add.image(p1.x, p1.y, T('plugue')).setDepth(6).setRotation(ang).setAlpha(0.5)),
    a.decoracao(a.cena.add.image(p2.x, p2.y, T('plugue')).setDepth(6).setRotation(ang + Math.PI).setAlpha(0.5)),
  ]
  a.depois(cfg.aviso, () => plugues.forEach((pl) => pl.setAlpha(1)))
  a.depois(cfg.aviso + cfg.vida, () => a.cena.tweens.add({ targets: plugues, alpha: 0, duration: 250, onComplete: () => plugues.forEach((pl) => pl.destroy()) }))

  for (let k = 1; k < n; k++) {
    const s = k / n
    const d0 = desvio(s, fase0)
    a.bala({
      x: p1.x + dx * s + nx * d0,
      y: p1.y + dy * s + ny * d0,
      raio: cfg.raio,
      textura: T('cabo'),
      tamanho: cfg.raio * 2.4,
      pulso: 0,
      aviso: cfg.aviso,
      vida: cfg.vida,
      atravessa: true,
      atualizar: (b, dt) => {
        b.fase = (b.fase ?? fase0) + (dt / 1000) * cfg.serpenteia * fator(a)
        b.desloc = b.desloc ?? d0
        deslocar(b, nx, ny, desvio(s, b.fase))
      },
    })
  }
}

// ---------- ♠ Show de Rock ----------
// A caixa vira a ESTRADA DE NOTAS do show (estilo Guitar Hero): 4 cordas
// coloridas e uma linha de palco embaixo. No ritmo da música (uma batida a
// cada `batida` ms) cai um ACORDE: notas em todas as cordas menos a(s)
// livre(s). A corda livre anda no máximo uma casa por batida (com chance
// `troca` de andar): sempre dá para acompanhar dançando. Nos refrões (a cada `pirotecnia` batidas) uma
// labareda de pirotecnia sobe do palco numa corda longe da livre (pisca antes).
// Com `colcheias`, no contratempo cai mais uma nota solta, numa corda que não
// é a livre de agora nem a da próxima batida (o caminho continua existindo).
//
// Justiça: cada corda tem mais que LACUNA_MINIMA de largura; entre dois
// acordes sobra mais que a lacuna na vertical (velocidade x batida); as notas
// nascem piscando (aviso normal de bala); a pirotecnia nunca cai na corda
// livre nem nas vizinhas dela, e a corda livre não muda enquanto ela queima.
const dessShow = definirAtaque({
  nome: 'dessShow',
  padrao: { duracao: 6000, cordas: 4, batida: 480, velocidade: 150, livres: 1, pirotecnia: 8, troca: 0.66, colcheias: false, avisoFogo: 560, raio: 7 },
  iniciar(a, cfg) {
    const geo = () => {
      const l = a.caixa
      return { l, w: l.width / cfg.cordas, x: (k) => l.left + (k + 0.5) * (l.width / cfg.cordas) }
    }
    a.lacuna(geo().w, 'corda livre do show')
    a.lacuna(cfg.velocidade * (cfg.batida / 1000) - cfg.raio * 2, 'espaço entre dois acordes')

    // a estrada: cordas coloridas, palco embaixo pulsando na batida
    const estrada = a.decoracao(a.cena.add.graphics().setDepth(1))
    let pulso = 0
    a.aoAtualizar((dt) => {
      pulso = Math.max(0, pulso - dt / 260)
      const { l, w } = geo()
      estrada.clear().fillStyle(0x1a0c1c, 0.55).fillRect(l.left, l.top, l.width, l.height)
      for (let k = 0; k < cfg.cordas; k++) {
        const cor = CORES_SHOW[k % CORES_SHOW.length]
        estrada.lineStyle(2, cor, 0.35).lineBetween(l.left + (k + 0.5) * w, l.top, l.left + (k + 0.5) * w, l.bottom)
        if (k > 0) estrada.lineStyle(1, 0xffffff, 0.12).lineBetween(l.left + k * w, l.top, l.left + k * w, l.bottom)
      }
      estrada.fillStyle(ROSA, 0.25 + 0.55 * pulso).fillRect(l.left, l.bottom - 6, l.width, 6)
    })

    // a primeira corda livre é a do coração (ninguém começa encurralado)
    let livre = limitar(Math.floor((a.alvo().x - geo().l.left) / geo().w), 0, cfg.cordas - 1)
    let proxima = livre // a corda livre da próxima batida (decidida uma batida antes, para as colcheias)
    let fogoAte = -1
    a.aCada(
      cfg.batida,
      (i) => {
        const { l, w, x } = geo()
        pulso = 1
        if (i % 2 === 0) tocar(a.cena, T('palheta'))
        // a corda livre anda no máximo uma casa (parada enquanto a pirotecnia queima)
        // (`troca` = chance de ela mudar de corda; nas bordas, volta para dentro)
        livre = proxima
        proxima = livre
        if (a.tempo + cfg.batida >= fogoAte && a.aleatorio(0, 1) < cfg.troca) {
          const passo = livre === 0 ? 1 : livre === cfg.cordas - 1 ? -1 : a.escolher([-1, 1])
          proxima = limitar(livre + passo, 0, cfg.cordas - 1)
        }
        // contratempo: uma nota solta fora do caminho (nem a livre de agora, nem a próxima)
        if (cfg.colcheias) {
          const fora = [...Array(cfg.cordas).keys()].filter((k) => k !== livre && k !== proxima)
          const agora = livre
          const depois = proxima
          if (fora.length)
            a.depois(cfg.batida / 2, () => {
              const g = geo()
              const k = a.escolher(fora.filter((c) => c !== agora && c !== depois))
              if (k === undefined) return
              a.bala({ x: g.x(k), y: g.l.top + cfg.raio + 2, vy: cfg.velocidade, raio: cfg.raio - 1, textura: T('nota'), tamanho: 16, cor: 0xffffff, pulso: 0.06 })
            })
        }
        const livresAgora = new Set([livre])
        while (livresAgora.size < Math.min(cfg.livres, cfg.cordas - 1)) livresAgora.add(a.inteiro(0, cfg.cordas - 1))
        const ocupados = []
        for (let k = 0; k < cfg.cordas; k++) {
          if (livresAgora.has(k)) continue
          ocupados.push([l.left + k * w, l.left + (k + 1) * w])
          a.bala({
            x: x(k),
            y: l.top + cfg.raio + 2,
            vy: cfg.velocidade,
            raio: cfg.raio,
            textura: T('nota'),
            tamanho: 20,
            cor: CORES_SHOW[k % CORES_SHOW.length],
            pulso: 0.06,
          })
        }
        a.parede({ eixo: 'x', ocupados })

        // refrão: pirotecnia numa corda longe da livre
        if (cfg.pirotecnia > 0 && i > 0 && i % cfg.pirotecnia === 0) {
          const longe = [...Array(cfg.cordas).keys()].filter((k) => Math.abs(k - livre) >= 2)
          if (!longe.length) return
          const k = a.escolher(longe)
          const aviso = Math.max(560, cfg.avisoFogo)
          fogoAte = a.tempo + aviso + 500
          a.aviso({ tipo: 'area', x: l.left + k * w + 3, y: l.top, largura: w - 6, altura: l.height, ms: aviso, cor: 0xff8a3a }, () => {
            const g = geo()
            tocar(a.cena, T('grave'))
            a.cena.cameras.main.shake(140, 0.005)
            a.bala({
              x: g.x(k),
              y: g.l.centerY,
              largura: g.w - 10,
              altura: g.l.height,
              forma: 'barra',
              cor: 0xff8a3a,
              jaAvisada: true,
              atravessa: true,
              vida: 440,
              pulso: 0.15,
              atualizar: (b) => {
                if (b.vida < 160) {
                  b.inofensiva = true
                  b.sprite.setAlpha(Math.max(0, b.vida / 160))
                }
              },
            })
            for (let n = 0; n < 4; n++) particulas(a.cena, g.x(k), g.l.bottom - n * (g.l.height / 4), { cor: n % 2 ? 0xffe14a : 0xff8a3a, quantidade: 6, velocidade: 120, vida: 380 })
          })
        }
      },
      Infinity,
      200,
    )
  },
})

export default { dessShow, dessNotaSolta, dessTaco, dessHomeRun, dessSolo, dessMicrofonia, dessPalheta, dessFeedback, dessFumaca, dessAmplificador, dessCabos }
