// Ataques exclusivos das cartas de dess (uma entrada por ataque, com prefixo 'dess'):
//   dessExemplo: definirAtaque({ nome: 'dessExemplo', padrao: {...}, iniciar(a, cfg) {...} })
// As receitas de pvp/baralhos/dess.js chamam A.dessExemplo(...).
//
// Sprites e sons: pvp/habilidades/sprites/dess.js (gerados por scripts/habilidades/dess.py).
//
// Princípios (valem para todos): os projéteis nascem FORA da caixa e entram
// (`jaAvisada`: a própria entrada pela borda é o aviso, sem piscar nem "!");
// quem dá o aviso é a coisa em si (o taco no home plate, o microfone na
// parede, a guitarra na corda, o amplificador na borda), não linhas ou áreas
// piscando; e nada é fixo: lados, ordem, posições e tempos saem dos sorteios
// com semente (a.aleatorio / a.inteiro / a.escolher). Todo ataque mira parte
// das balas no coração: ficar parado sempre apanha.
import { definirAtaque } from '../definir.js'
import { tocar } from '../../audio.js'
import { particulas } from '../../effects/particulas.js'

const T = (nome) => `hab-dess-${nome}`
const fator = (a) => a.balas.fatorVelocidade ?? 1
const limitar = (v, min, max) => Math.min(Math.max(v, min), max)
const ROSA = 0xff5070
const CORES_SHOW = [0xff5070, 0xffb03a, 0xffe14a, 0xff9ad0]
const LADOS = ['top', 'bottom', 'left', 'right']

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

// Ponto de uma borda da caixa: lado 'top' | 'bottom' | 'left' | 'right', u de 0 a 1,
// m = margem para dentro (negativa = fora da caixa, de onde os projéteis entram)
function pontoDaBorda(l, lado, u, m) {
  if (lado === 'top') return { x: l.left + u * l.width, y: l.top + m }
  if (lado === 'bottom') return { x: l.left + u * l.width, y: l.bottom - m }
  if (lado === 'left') return { x: l.left + m, y: l.top + u * l.height }
  return { x: l.right - m, y: l.top + u * l.height }
}
const PARA_DENTRO = { top: Math.PI / 2, bottom: -Math.PI / 2, left: 0, right: Math.PI }

// distância do ponto p até a borda `lado`
function distanciaDaBorda(l, p, lado) {
  return { top: p.y - l.top, bottom: l.bottom - p.y, left: p.x - l.left, right: l.right - p.x }[lado]
}

// u (0 a 1) da posição p ao longo da borda `lado`
function uDaBorda(l, p, lado) {
  return lado === 'top' || lado === 'bottom' ? (p.x - l.left) / l.width : (p.y - l.top) / l.height
}

// Sorteia um lado de entrada: nunca um em que o coração está colado (a bala
// chegaria sem dar tempo de reagir) e, se der, diferente do anterior
function sortearLado(a, alvo, { lados = LADOS, longe = 50, anterior = null } = {}) {
  const l = a.caixa
  const bons = lados.filter((s) => distanciaDaBorda(l, alvo, s) >= longe)
  const novos = bons.filter((s) => s !== anterior)
  if (novos.length) return a.escolher(novos)
  if (bons.length) return a.escolher(bons)
  return lados.reduce((m, s) => (distanciaDaBorda(l, alvo, s) > distanciaDaBorda(l, alvo, m) ? s : m))
}

// Coração ativo mais perto de (x, y): é quem as balas que perseguem seguem
// (a.alvo() alterna entre os corações a cada chamada, não serve frame a frame)
function maisPerto(a, x, y) {
  let melhor = null
  let d = Infinity
  for (const c of a.coracoes) {
    if (!c.ativo) continue
    const dd = Math.hypot(c.x - x, c.y - y)
    if (dd < d) {
      d = dd
      melhor = c
    }
  }
  return melhor ?? a.alvo()
}

// Contexto cujos timers não param nos respiros da onda (para seguir o relógio de uma bala)
function semRespiro(a) {
  const filho = Object.create(a)
  filho.respiro = null
  return filho
}

// Ponto fora da caixa, `fora` px além da borda, na reta que sai de c com o ângulo ang
function saidaDaCaixa(l, c, ang, fora) {
  const dx = Math.cos(ang)
  const dy = Math.sin(ang)
  const tx = dx > 1e-6 ? (l.right - c.x) / dx : dx < -1e-6 ? (l.left - c.x) / dx : Infinity
  const ty = dy > 1e-6 ? (l.bottom - c.y) / dy : dy < -1e-6 ? (l.top - c.y) / dy : Infinity
  const t = Math.max(0, Math.min(tx, ty)) + fora
  return { x: c.x + dx * t, y: c.y + dy * t, d: t }
}

// ---------- ♠ Nota Solta ----------
// Colcheias escapam por bordas sorteadas (entram de fora) e flutuam até o
// coração balançando de um lado para o outro, como uma nota que se soltou da música.
const dessNotaSolta = definirAtaque({
  nome: 'dessNotaSolta',
  padrao: { duracao: 5000, intervalo: 600, velocidade: 110, raio: 6, fora: 12, balanco: 12, frequencia: 2.2, mirar: 0.7 },
  iniciar(a, cfg) {
    let mira = a.aleatorio(0, 1)
    let anterior = null
    a.aCada(cfg.intervalo, () => {
      const l = a.caixa
      const alvo = a.alvo()
      const lado = sortearLado(a, alvo, { anterior })
      anterior = lado
      const u = a.aleatorio(0.12, 0.88)
      const p = pontoDaBorda(l, lado, u, -cfg.fora)
      mira += cfg.mirar * a.aleatorio(0.8, 1.2)
      let dir = PARA_DENTRO[lado] + a.aleatorio(-0.6, 0.6)
      if (mira >= 1) {
        mira -= 1
        dir = Math.atan2(alvo.y - p.y, alvo.x - p.x)
      }
      const nx = -Math.sin(dir)
      const ny = Math.cos(dir)
      const fase0 = a.aleatorio(0, Math.PI * 2)
      const borda = pontoDaBorda(l, lado, u, 2)
      particulas(a.cena, borda.x, borda.y, { cor: ROSA, quantidade: 5, velocidade: 60, vida: 300 })
      a.bala({
        x: p.x,
        y: p.y,
        vx: Math.cos(dir) * cfg.velocidade,
        vy: Math.sin(dir) * cfg.velocidade,
        raio: cfg.raio,
        textura: T('nota'),
        tamanho: 19,
        pulso: 0.05,
        jaAvisada: true,
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
// Um taco gira preso na parede (lado sorteado, de preferência o mais perto do
// coração, na altura dele) e varre meia-volta, para cima ou para baixo
// (sorteado). Antes ele aparece deitado na parede, piscando, e o meio-círculo
// que ele alcança pisca junto (é uma lâmina fixa: sem esse aviso curto não dá
// para saber até onde ela chega). Fora do alcance (o resto da caixa) é seguro.
const dessTaco = definirAtaque({
  nome: 'dessTaco',
  padrao: { duracao: 5000, intervalo: 1300, comprimento: 130, espessura: 14, aviso: 600, varrida: 460, perto: 0.7 },
  iniciar(a, cfg) {
    a.aCada(cfg.intervalo, () => {
      const l = a.caixa
      const L = Math.min(cfg.comprimento, l.width - a.lacunaMinima - 6)
      a.lacuna(l.width - L, 'fora do alcance do taco')
      const alvo = a.alvo()
      const pertoEsquerda = alvo.x - l.left < l.right - alvo.x
      const esquerda = a.aleatorio(0, 1) < cfg.perto ? pertoEsquerda : !pertoEsquerda
      const descer = a.escolher([true, false])
      const px = esquerda ? l.left - 2 : l.right + 2
      const py = limitar(alvo.y + a.aleatorio(-10, 10), l.top + 24, l.bottom - 24)
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
// No "home plate" (borda de baixo, num ponto sorteado perto do coração) o
// taco aparece e se prepara: é o único aviso. Na tacada, a bola sai de fora
// da caixa mirando onde o coração está NAQUELE instante e atravessa tudo,
// rápida. Com 2 bolas, a segunda vai um pouco para um lado sorteado (fecha
// aquela saída). Parado, apanha; andando na hora da tacada, escapa.
const dessHomeRun = definirAtaque({
  nome: 'dessHomeRun',
  padrao: { duracao: 5000, intervalo: 1100, velocidade: 330, raio: 7, preparo: 520, bolas: 1, abertura: [0.3, 0.45], fora: 10 },
  iniciar(a, cfg) {
    a.aCada(cfg.intervalo, () => {
      const l = a.caixa
      const alvo0 = a.alvo()
      // longe na horizontal só se o coração estiver alto (senão a tacada sairia rasteira demais)
      const desvioMax = limitar((l.bottom - alvo0.y) * 1.4, 24, 90)
      const bx = limitar(alvo0.x + a.escolher([-1, 1]) * a.aleatorio(12, desvioMax), l.left + 16, l.right - 16)
      const taco = prepararTaco(a, bx, l.bottom, cfg.preparo)
      a.depois(cfg.preparo, () => {
        const by = a.caixa.bottom + cfg.fora
        const alvo = a.alvo()
        const base = limitar(Math.atan2(alvo.y - by, alvo.x - bx), -Math.PI + 0.4, -0.4)
        const lado = a.escolher([-1, 1])
        rebater(a, taco, bx, a.caixa.bottom)
        for (let k = 0; k < cfg.bolas; k++) {
          const dir = base + (k === 0 ? 0 : lado * k * a.aleatorio(cfg.abertura[0], cfg.abertura[1]))
          const v = cfg.velocidade * a.aleatorio(0.92, 1.08)
          a.bala({
            x: bx,
            y: by,
            vx: Math.cos(dir) * v,
            vy: Math.sin(dir) * v,
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
        }
      })
    })
  },
})

// o taco aparece no home plate (meio para fora da borda) e vai para trás, preparando
function prepararTaco(a, x, y, ms) {
  const taco = a.decoracao(a.cena.add.image(x - 6, y + 2, T('taco')).setDepth(6).setScale(0.75).setOrigin(0.08, 0.5).setRotation(Math.PI + 0.2).setAlpha(0))
  a.cena.tweens.add({ targets: taco, alpha: 1, duration: 120 })
  a.cena.tweens.add({ targets: taco, rotation: Math.PI + 0.75, duration: ms, ease: 'Sine.easeIn' })
  return taco
}

// a tacada que manda a bola: o taco gira no home plate e um estalo aparece
function rebater(a, taco, x, y) {
  tocar(a.cena, T('rebatida'))
  a.cena.tweens.killTweensOf(taco)
  taco.setAlpha(1)
  a.cena.tweens.add({ targets: taco, rotation: Math.PI * 2 - 0.2, duration: 110, onComplete: () => a.cena.tweens.add({ targets: taco, alpha: 0, duration: 220, onComplete: () => taco.destroy() }) })
  const estalo = a.decoracao(a.cena.add.image(x, y - 4, T('impacto')).setDepth(7).setScale(0.5))
  a.cena.tweens.add({ targets: estalo, scale: 1.3, alpha: 0, duration: 260, onComplete: () => estalo.destroy() })
  particulas(a.cena, x, y, { cor: 0xffe050, quantidade: 8, velocidade: 140, vida: 260 })
}

// ---------- ♠ Solo de Guitarra ----------
// A guitarra corre pela parede tocando a melodia: cada nota longa é uma fila
// de notinhas que entra de fora e atravessa a caixa numa "corda" (faixa); a
// melodia sobe e desce de faixa (passos sorteados) e cada frase começa na
// corda do coração. O aviso é a guitarra deslizando até a corda antes de a
// fila sair. A cada frase as faixas podem andar meia altura e a guitarra pode
// trocar de lado (sorteado: não dá para decorar).
const dessSolo = definirAtaque({
  nome: 'dessSolo',
  padrao: { duracao: 6000, batida: 260, cadencia: 65, velocidade: 170, raio: 5, preparo: 420, desliza: 200, faixas: 6, frase: 8, pausa: 1, fora: 8, troca: 0.5 },
  iniciar(a, cfg) {
    const l0 = a.caixa
    let direita = a.escolher([true, false])
    const guitarra = a.decoracao(a.cena.add.image(direita ? l0.right - 6 : l0.left + 6, l0.centerY, T('guitarra')).setDepth(6).setRotation(Math.PI / 2).setFlipY(!direita).setAlpha(0))
    a.cena.tweens.add({ targets: guitarra, alpha: 1, duration: 200 })
    let faixa = 0
    let meio = 0
    let cor = a.escolher(CORES_SHOW)
    const passos = [-2, -1, 1, 2, 1, -1, 3, -3]
    const ciclo = cfg.frase + cfg.pausa

    a.aCada(cfg.batida, (k) => {
      if (k % ciclo >= cfg.frase) return // pausa no fim da frase
      const l = a.caixa
      const margem = 12
      const espaco = (l.height - 2 * margem) / (cfg.faixas - 1)
      const ultima = cfg.faixas - 1 - (meio ? 1 : 0)
      if (k % ciclo === 0) {
        // frase nova: lado, meia altura e cor sorteados; começa na corda do coração
        if (k > 0 && a.aleatorio(0, 1) < cfg.troca) direita = !direita
        meio = a.escolher([0, 0.5])
        cor = a.escolher(CORES_SHOW.filter((c) => c !== cor))
        faixa = limitar(Math.round((a.alvo().y - l.top - margem) / espaco - meio), 0, cfg.faixas - 1 - (meio ? 1 : 0))
      } else {
        faixa += a.escolher(passos)
        if (faixa < 0) faixa = -faixa
        if (faixa > ultima) faixa = Math.max(0, 2 * ultima - faixa)
      }
      const y = l.top + margem + (faixa + meio) * espaco
      const esta = direita
      const sinal = esta ? -1 : 1
      const corDaNota = cor

      // a guitarra desliza até a corda (o aviso) e então a fila entra de fora
      a.depois(cfg.preparo - cfg.desliza, () => {
        const g = a.caixa
        a.cena.tweens.killTweensOf(guitarra)
        guitarra.setAlpha(1).setFlipY(!esta)
        a.cena.tweens.add({ targets: guitarra, x: esta ? g.right - 6 : g.left + 6, y, duration: cfg.desliza, ease: 'Sine.easeOut' })
      })
      a.depois(cfg.preparo, () => {
        const notas = Math.max(2, Math.round(cfg.batida / cfg.cadencia))
        a.aCada(
          cfg.cadencia,
          () => {
            const g = a.caixa
            a.bala({
              x: esta ? g.right + cfg.fora : g.left - cfg.fora,
              y,
              vx: sinal * cfg.velocidade,
              raio: cfg.raio,
              textura: T('notas'),
              tamanho: 14,
              cor: corDaNota,
              pulso: 0.12,
              jaAvisada: true,
            })
          },
          notas,
          0,
        )
      })
    })
  },
})

// ---------- ♦ Microfonia ----------
// Um microfone desliza de fora até a parede (lado sorteado, na faixa do
// coração) e treme: é o aviso. Então sai um agudo serrilhado (faíscas em
// zigue-zague bem rápido) que entra de fora e atravessa a faixa.
const dessMicrofonia = definirAtaque({
  nome: 'dessMicrofonia',
  padrao: { duracao: 5000, intervalo: 1200, aviso: 560, velocidade: 300, amplitude: 9, periodo: 110, faiscas: 10, cadencia: 28, raio: 5, espessura: 30, quantidade: 1, fora: 8 },
  iniciar(a, cfg) {
    const disparar = (lado) => {
      const l = a.caixa
      const alvo = a.alvo()
      const meia = cfg.espessura / 2
      const vertical = lado === 'top' || lado === 'bottom'
      const p = vertical ? limitar(alvo.x, l.left + meia, l.right - meia) : limitar(alvo.y, l.top + meia, l.bottom - meia)
      a.parede({ eixo: vertical ? 'x' : 'y', ocupados: [[p - meia, p + meia]] })
      const dir = PARA_DENTRO[lado]
      const borda = pontoDaBorda(l, lado, vertical ? (p - l.left) / l.width : (p - l.top) / l.height, 6)
      const mic = a.decoracao(
        a.cena.add
          .image(borda.x - Math.cos(dir) * 30, borda.y - Math.sin(dir) * 30, T('microfone'))
          .setDepth(6)
          .setRotation(dir + Math.PI / 2),
      )
      // entra pela borda e encosta na parede
      a.cena.tweens.add({ targets: mic, x: borda.x - Math.cos(dir) * 4, y: borda.y - Math.sin(dir) * 4, duration: 180, ease: 'Back.easeOut' })
      a.cena.tweens.add({ targets: mic, angle: mic.angle + 6, duration: 45, yoyo: true, repeat: -1, delay: 180 })
      a.depois(cfg.aviso, () => {
        tocar(a.cena, T('microfonia'))
        a.depois(cfg.faiscas * cfg.cadencia + 200, () => {
          a.cena.tweens.killTweensOf(mic)
          a.cena.tweens.add({ targets: mic, alpha: 0, duration: 200, onComplete: () => mic.destroy() })
        })
        const nx = -Math.sin(dir)
        const ny = Math.cos(dir)
        const boca = { x: borda.x - Math.cos(dir) * (6 + cfg.fora), y: borda.y - Math.sin(dir) * (6 + cfg.fora) }
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

    let anterior = null
    a.aCada(cfg.intervalo, () => {
      const alvo = a.alvo()
      const lado = sortearLado(a, alvo, { lados: ['left', 'right', 'top'], longe: 46, anterior })
      anterior = lado
      disparar(lado)
      if (cfg.quantidade > 1) disparar(sortearLado(a, alvo, { lados: ['left', 'right', 'top', 'bottom'].filter((s) => s !== lado), longe: 46 }))
    })
  },
})

// ---------- ♦ Palheta ----------
// Palhetas que PERSEGUEM o coração (como o fogo do Asgore e da Toriel). A
// cada palhetada sai um golpe sorteado (nunca o mesmo duas vezes seguidas):
//   mãos   - uma fileira entra por uma lateral, uma atrás da outra, e cada
//            palheta vira para o coração (com giro limitado) por um tempo;
//   cerco  - palhetas entram de todos os lados ao mesmo tempo e se FECHAM no
//            ponto onde o coração estava (todas chegam juntas); com força
//            alta, um segundo anel, girado, logo atrás;
//   queda  - palhetas caem do alto (ou sobem de baixo) e escorregam de lado
//            atrás do coração.
// Todas nascem fora da caixa. A perseguição tem giro limitado e dura pouco:
// quem anda (e muda de direção na hora certa) escapa; parado, apanha.
const dessPalheta = definirAtaque({
  nome: 'dessPalheta',
  padrao: { duracao: 5000, intervalo: 1000, palhetas: 4, cadencia: 110, velocidade: 165, raio: 6, giro: 2.4, persegue: 800, cerco: 7, aneis: 1, tempoCerco: 1150, deriva: 70, fora: 14 },
  iniciar(a, cfg) {
    let ultimo = null
    a.aCada(cfg.intervalo, () => {
      const golpe = a.escolher(['maos', 'cerco', 'queda'].filter((g) => g !== ultimo))
      ultimo = golpe
      tocar(a.cena, T('palheta'))
      if (golpe === 'maos') palhetaMaos(a, cfg)
      else if (golpe === 'cerco') palhetaCerco(a, cfg)
      else palhetaQueda(a, cfg)
    })
  },
})

// uma palheta (ponta para a direção em que voa); `atualizar` extra opcional
function palheta(a, cfg, x, y, dir, v, atualizar) {
  return a.bala({
    x,
    y,
    vx: Math.cos(dir) * v,
    vy: Math.sin(dir) * v,
    raio: cfg.raio,
    textura: T('palheta'),
    tamanho: 16,
    pulso: 0.04,
    jaAvisada: true,
    atualizar: (b, dt) => {
      atualizar?.(b, dt)
      b.sprite.setRotation(Math.atan2(b.vy, b.vx) - Math.PI / 2) // a ponta (para baixo no sprite) vai na frente
    },
  })
}

// mãos: a fileira entra por uma lateral e cada palheta vira para o coração por `persegue` ms
function palhetaMaos(a, cfg) {
  const l = a.caixa
  const alvo = a.alvo()
  const lado = sortearLado(a, alvo, { lados: ['left', 'right'], longe: 40 })
  const centro = limitar(alvo.y + a.aleatorio(-20, 20), l.top + 20, l.bottom - 20)
  const n = cfg.palhetas
  const ordem = a.escolher([1, -1]) // de cima para baixo ou ao contrário
  a.aCada(
    cfg.cadencia,
    (k) => {
      const g = a.caixa
      const kk = ordem > 0 ? k : n - 1 - k
      const y = limitar(centro + (kk - (n - 1) / 2) * 26 + a.aleatorio(-6, 6), g.top + 8, g.bottom - 8)
      const x = lado === 'left' ? g.left - cfg.fora : g.right + cfg.fora
      const dir = PARA_DENTRO[lado] + a.aleatorio(-0.5, 0.5)
      palheta(a, cfg, x, y, dir, cfg.velocidade, (b, dt) => {
        b.guia = (b.guia ?? 0) + dt
        if (b.guia > cfg.persegue) return
        const c = maisPerto(a, b.x, b.y)
        const atual = Math.atan2(b.vy, b.vx)
        let quer = Math.atan2(c.y - b.y, c.x - b.x) - atual
        quer = Math.atan2(Math.sin(quer), Math.cos(quer))
        const giro = limitar(quer, -cfg.giro * (dt / 1000), cfg.giro * (dt / 1000))
        const v = Math.hypot(b.vx, b.vy)
        b.vx = Math.cos(atual + giro) * v
        b.vy = Math.sin(atual + giro) * v
      })
    },
    n,
    0,
  )
}

// cerco: palhetas de todos os lados chegam juntas onde o coração estava (e seguem reto)
function palhetaCerco(a, cfg) {
  const centro = a.alvo()
  for (let anel = 0; anel < cfg.aneis; anel++) {
    a.depois(anel * 320, () => {
      const l = a.caixa
      const n = cfg.cerco
      const giro0 = a.aleatorio(0, Math.PI * 2)
      for (let k = 0; k < n; k++) {
        const ang = giro0 + (k / n) * Math.PI * 2
        const p = saidaDaCaixa(l, centro, ang, cfg.fora)
        palheta(a, cfg, p.x, p.y, ang + Math.PI, p.d / (cfg.tempoCerco / 1000))
      }
    })
  }
}

// queda: caem do alto (ou sobem de baixo) e escorregam de lado atrás do coração
function palhetaQueda(a, cfg) {
  const l = a.caixa
  const alvo = a.alvo()
  const lado = sortearLado(a, alvo, { lados: ['top', 'bottom'], longe: 40 })
  const n = cfg.palhetas + 1
  const us = Array.from({ length: n }, (_, k) => (k + a.aleatorio(0.15, 0.85)) / n)
  a.aCada(
    cfg.cadencia,
    (k) => {
      const g = a.caixa
      const u = us.splice(a.inteiro(0, us.length - 1), 1)[0] // ordem sorteada
      const p = pontoDaBorda(g, lado, u, -cfg.fora)
      palheta(a, cfg, p.x, p.y, PARA_DENTRO[lado], cfg.velocidade * 0.75, (b, dt) => {
        b.guia = (b.guia ?? 0) + dt
        if (b.guia > cfg.persegue * 1.3) return
        const c = maisPerto(a, b.x, b.y)
        // escorrega de lado até `deriva` px/s, no rumo do coração
        const quer = limitar((c.x - b.x) * 3, -cfg.deriva, cfg.deriva)
        b.vx += limitar(quer - b.vx, -260 * (dt / 1000), 260 * (dt / 1000))
      })
    },
    n,
    0,
  )
}

// ---------- ♦ Feedback ----------
// O som entra em loop entre duas caixas de som: a caixa de som aparece numa
// parede (é o aviso), o pulso entra de fora, atravessa a caixa e, depois de
// sair do outro lado, a outra caixa de som bate e ele volta um pouco MAIS
// ALTO (mais comprido e mais rápido). Sempre sobra um vão por cima ou por baixo.
const dessFeedback = definirAtaque({
  nome: 'dessFeedback',
  padrao: { duracao: 6000, intervalo: 2000, velocidade: 140, altura: 36, cresce: 10, acelera: 1.06, passagens: 2, largura: 10, preparo: 560, pausaVolta: 340, fora: 6 },
  iniciar(a, cfg) {
    const vao = a.lacunaMinima + 6

    // a caixa de som da parede `lado` bate e, `espera` ms depois, solta o pulso (de fora)
    const passagem = (lado, y, n, h, v, espera) => {
      const l = a.caixa
      const sinal = lado === 'left' ? 1 : -1
      const caixa = a.decoracao(
        a.cena.add
          .image(lado === 'left' ? l.left + 6 : l.right - 6, y, T('caixasom'))
          .setDepth(6)
          .setScale(0.2, Math.max(0.9, h / 26))
          .setFlipX(lado === 'right'),
      )
      a.cena.tweens.add({ targets: caixa, scaleX: 0.8, duration: Math.max(60, espera / 4), yoyo: true, repeat: 1, onComplete: () => a.cena.tweens.add({ targets: caixa, alpha: 0, duration: 300, onComplete: () => caixa.destroy() }) })
      a.depois(espera, () => {
        const g = a.caixa
        tocar(a.cena, T('grave'))
        const b = a.bala({
          x: lado === 'left' ? g.left - cfg.largura / 2 - cfg.fora : g.right + cfg.largura / 2 + cfg.fora,
          y,
          vx: sinal * v,
          largura: cfg.largura,
          altura: h,
          textura: T('pulso'),
          jaAvisada: true,
          atravessa: true,
          atualizar: (bala) => {
            const c = a.caixa
            const saiu = sinal > 0 ? bala.x >= c.right + cfg.largura / 2 + 2 : bala.x <= c.left - cfg.largura / 2 - 2
            if (!saiu) return
            bala.morta = true
            if (n + 1 < cfg.passagens) passagem(lado === 'left' ? 'right' : 'left', y, n + 1, h + cfg.cresce, v * cfg.acelera, cfg.pausaVolta)
          },
        })
        b.sprite.setDisplaySize(cfg.largura * 1.6, h * 1.04)
        b.escalaX = b.sprite.scaleX
        b.escalaY = b.sprite.scaleY
      })
    }

    let anterior = null
    a.aCada(cfg.intervalo, () => {
      const l = a.caixa
      const alvo = a.alvo()
      const hMax = cfg.altura + cfg.cresce * (cfg.passagens - 1)
      a.lacuna(l.height - hMax, 'vão do feedback')
      // centro perto do coração (um pouco sorteado), sempre deixando um vão de `vao` px por cima ou por baixo
      let c = limitar(alvo.y + a.aleatorio(-cfg.altura / 4, cfg.altura / 4), l.top + hMax / 2, l.bottom - hMax / 2)
      const cima = c - hMax / 2 - l.top
      const baixo = l.bottom - c - hMax / 2
      if (Math.max(cima, baixo) < vao) c = cima <= baixo ? l.bottom - vao - hMax / 2 : l.top + vao + hMax / 2
      a.parede({ eixo: 'y', ocupados: [[c - hMax / 2, c + hMax / 2]] })
      const lado = sortearLado(a, alvo, { lados: ['left', 'right'], longe: 60, anterior })
      anterior = lado
      passagem(lado, c, 0, cfg.altura, cfg.velocidade, cfg.preparo)
    })
  },
})

// ---------- ♣ Bomba de Fumaça ----------
// Latas de fumaça são ARREMESSADAS de fora (deslizam girando pelo chão até
// parar, perto do coração ou longe dele), chiam um instante e estouram: um
// ANEL de brasas sai da lata (girado ao acaso) e fica uma nuvem que cobre a
// vista e CORRE COM O VENTO (direção sorteada por ataque). Escondidas na
// nuvem, mais brasas acendem (piscando POR CIMA dela) e escapam, algumas
// direto no coração.
const dessFumaca = definirAtaque({
  nome: 'dessFumaca',
  padrao: { duracao: 5000, intervalo: 1700, voo: 480, pavio: 560, nuvem: 2600, brasas: 5, anel: 8, velocidade: 75, velocidadeAnel: 105, raio: 4, aviso: 440, espalha: 24, perto: 64, mirar: 0.5, vento: 16, fora: 16 },
  iniciar(a, cfg) {
    let mira = a.aleatorio(0, 1)
    const angVento = a.aleatorio(0, Math.PI * 2)
    const vento = { x: Math.cos(angVento) * cfg.vento, y: Math.sin(angVento) * cfg.vento }

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
      const l = a.caixa
      mira += cfg.mirar
      const plantada = mira >= 1
      if (plantada) mira -= 1
      const alvo = a.alvo()
      const p = plantada ? pontoPerto(alvo) : a.pontoLonge(70, 24)
      // arremessada da borda mais perto do ponto (sorteando um pouco ao longo dela)
      const lado = a.escolher(LADOS.filter((s) => distanciaDaBorda(l, p, s) <= Math.min(...LADOS.map((t) => distanciaDaBorda(l, p, t))) + 40))
      const ini = pontoDaBorda(l, lado, limitar(uDaBorda(l, p, lado) + a.aleatorio(-0.2, 0.2), 0.05, 0.95), -cfg.fora)
      const lata = a.decoracao(a.cena.add.image(ini.x, ini.y, T('lata')).setDepth(6).setScale(1.2))
      a.cena.tweens.add({ targets: lata, x: p.x, y: p.y, angle: a.escolher([-1, 1]) * a.aleatorio(360, 620), duration: cfg.voo, ease: 'Quad.easeOut' })
      // parou: chia e treme (o pavio)
      a.depois(cfg.voo, () => {
        a.cena.tweens.add({ targets: lata, angle: lata.angle + 14, duration: 60, yoyo: true, repeat: -1 })
        a.aCada(120, () => particulas(a.cena, lata.x, lata.y - 6, { cor: 0xffd060, quantidade: 2, velocidade: 50, vida: 200 }), Math.floor(cfg.pavio / 120), 0)
      })

      a.depois(cfg.voo + cfg.pavio, () => {
        a.cena.tweens.killTweensOf(lata)
        lata.destroy()
        tocar(a.cena, T('fumaca'))
        a.cena.cameras.main.shake(90, 0.003)
        // o estouro: anel de brasas (girado ao acaso), o próprio estouro é o aviso
        const giro0 = a.aleatorio(0, Math.PI * 2)
        for (let k = 0; k < cfg.anel; k++) {
          const ang = giro0 + (k / cfg.anel) * Math.PI * 2
          const b = a.bala({ x: p.x, y: p.y, vx: Math.cos(ang) * cfg.velocidadeAnel, vy: Math.sin(ang) * cfg.velocidadeAnel, raio: cfg.raio, textura: T('brasa'), tamanho: 11, pulso: 0.2, jaAvisada: true, vida: 3000 })
          b.sprite.setDepth(12)
        }
        const centro = nuvem(a, p, cfg, vento)
        const cadencia = (cfg.nuvem - 600) / cfg.brasas
        a.aCada(
          cadencia,
          (k) => {
            const ang = a.aleatorio(0, Math.PI * 2)
            const r = a.aleatorio(0, cfg.espalha * 0.6)
            const x = centro.x + Math.cos(ang) * r
            const y = centro.y + Math.sin(ang) * r
            const alvo = a.alvo()
            const mirada = k === 0 || a.aleatorio(0, 1) < cfg.mirar * 0.6
            const dir = mirada ? Math.atan2(alvo.y - y, alvo.x - x) : a.aleatorio(0, Math.PI * 2)
            const b = a.bala({
              x,
              y,
              vx: Math.cos(dir) * cfg.velocidade,
              vy: Math.sin(dir) * cfg.velocidade,
              raio: cfg.raio,
              textura: T('brasa'),
              tamanho: 11,
              pulso: 0.2,
              aviso: cfg.aviso, // acende escondida na nuvem
              vida: 3200,
            })
            b.sprite.setDepth(12) // por cima da fumaça
          },
          cfg.brasas,
          250,
        )
      })
    })
  },
})

// nuvem de fumaça: tufos por cima do coração (meio transparentes), por baixo
// das brasas, correndo com o vento. Devolve o centro (atualizado todo frame).
function nuvem(a, p, cfg, vento) {
  particulas(a.cena, p.x, p.y, { cor: 0xd0c8d8, quantidade: 10, velocidade: 90, vida: 350 })
  const centro = { x: p.x, y: p.y }
  const tufos = []
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
    tufos.push({ tufo, dx: Math.cos(ang) * r, dy: Math.sin(ang) * r, sobe: a.aleatorio(2, 10) })
    a.cena.tweens.add({ targets: tufo, scale: escala, alpha: 0.6, duration: 280, ease: 'Quad.easeOut' })
    a.cena.tweens.add({ targets: tufo, scale: escala * 1.25, duration: cfg.nuvem, delay: 280 })
    a.cena.tweens.add({ targets: tufo, alpha: 0, duration: 450, delay: cfg.nuvem, onComplete: () => tufo.destroy() })
  }
  let idade = 0
  a.aoAtualizar((dt) => {
    if (idade > cfg.nuvem + 450) return
    idade += dt
    const s = dt / 1000
    const l = a.caixa
    centro.x = limitar(centro.x + vento.x * s, l.left + 10, l.right - 10)
    centro.y = limitar(centro.y + vento.y * s, l.top + 10, l.bottom - 10)
    const abre = Math.min(1, idade / 280)
    for (const t of tufos) if (t.tufo.scene) t.tufo.setPosition(centro.x + t.dx * (0.4 + 0.6 * abre), centro.y + t.dy * (0.4 + 0.6 * abre) - (t.sobe * idade) / cfg.nuvem)
  })
  return centro
}

// ---------- ♣ Amplificador ----------
// Amplificadores são largados nas bordas (entram de fora e encostam na
// parede, num lado sorteado longe do coração), viram para o coração e tremem
// enquanto esquentam. Depois batem o grave no tempo: frentes de onda curvas
// saem pelo cone e se abrem conforme andam (até `maximo` px). A cada batida o
// amplificador vira um pouco atrás do coração. Sem guia: quem avisa é o
// próprio amplificador.
const dessAmplificador = definirAtaque({
  nome: 'dessAmplificador',
  padrao: { duracao: 5500, intervalo: 1500, aquece: 650, pulsos: 3, batida: 380, velocidade: 130, abertura: 0.32, boca: 12, maximo: 92, espessura: 8, vira: 0.25, cone: 0.85 },
  iniciar(a, cfg) {
    let anterior = null
    a.aCada(cfg.intervalo, () => {
      const l = a.caixa
      const alvo = a.alvo()
      const lado = sortearLado(a, alvo, { longe: 60, anterior })
      anterior = lado
      const u = a.aleatorio(0.2, 0.8)
      const p = pontoDaBorda(l, lado, u, 6)
      const fora = pontoDaBorda(l, lado, u, -22)
      const normal = PARA_DENTRO[lado]
      const mirar = (alvoAgora, atual) => {
        const quer = normal + limitar(Math.atan2(alvoAgora.y - p.y, alvoAgora.x - p.x) - normal, -cfg.cone, cfg.cone)
        return atual === undefined ? quer : atual + limitar(quer - atual, -cfg.vira, cfg.vira)
      }
      let dir = mirar(alvo)
      a.lacuna(l.height - cfg.maximo, 'lado da frente de onda')

      const amp = a.decoracao(a.cena.add.image(fora.x, fora.y, T('amp')).setDepth(6).setRotation(dir + Math.PI / 2).setScale(0.85))
      a.cena.tweens.add({ targets: amp, x: p.x, y: p.y, duration: 200, ease: 'Back.easeOut' })
      a.cena.tweens.add({ targets: amp, scaleX: 0.92, duration: 50, yoyo: true, repeat: Math.floor(cfg.aquece / 100) - 2, delay: 200 })
      // a CPU lê para onde o amplificador aponta (o cone que ele vai varrer, com a virada atrás do coração)
      a.zonaPerigo({ tipo: 'leque', x: p.x, y: p.y, raio: 320, angulo: dir, abertura: Math.atan(cfg.abertura) + cfg.vira }, { ms: cfg.aquece, dura: cfg.pulsos * cfg.batida + 400 })

      a.aCada(
        cfg.batida,
        (k) => {
          dir = mirar(maisPerto(a, p.x, p.y), dir)
          tocar(a.cena, T('grave'))
          a.cena.tweens.killTweensOf(amp)
          amp.setPosition(p.x, p.y).setRotation(dir + Math.PI / 2)
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
            jaAvisada: true, // sai do cone do amplificador, que estava ali tremendo
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
              a.cena.tweens.killTweensOf(amp)
              a.cena.tweens.add({ targets: amp, alpha: 0, x: fora.x, y: fora.y, duration: 250, onComplete: () => amp.destroy() })
            })
          }
        },
        cfg.pulsos,
        cfg.aquece,
      )
    })
  },
})

// ---------- ♣ Cabos Enrolados ----------
// Cabos de guitarra se esticam de uma parede à outra (plugue nas pontas),
// enrolados em curvas. Cada cabo pisca inteiro antes de valer e depois fica
// no chão serpenteando por um tempo. Horizontal ou vertical é sorteado (com
// tendência a alternar) e a maioria passa pelo coração.
const dessCabos = definirAtaque({
  nome: 'dessCabos',
  padrao: { duracao: 6000, intervalo: 1300, vida: 2400, aviso: 560, passo: 9, raio: 4, amplitude: 11, ondas: 2.5, serpenteia: 2.4, maxCabos: 3, distancia: 56, mirar: 0.67 },
  iniciar(a, cfg) {
    const vivos = [] // { horizontal, e1, e2, fim }
    let horizontal = a.escolher([true, false])

    a.aCada(cfg.intervalo, () => {
      const l = a.caixa
      for (let k = vivos.length - 1; k >= 0; k--) if (vivos[k].fim <= a.tempo) vivos.splice(k, 1)
      if (vivos.length >= cfg.maxCabos) return
      if (a.aleatorio(0, 1) < 0.7) horizontal = !horizontal
      const alvo = a.alvo()
      const [ini, fim] = horizontal ? [l.top + 14, l.bottom - 14] : [l.left + 14, l.right - 14]
      const paralelos = vivos.filter((c) => c.horizontal === horizontal)
      const passaNoCoracao = a.aleatorio(0, 1) < cfg.mirar
      // pontas longe das pontas dos cabos paralelos (sem prender o coração numa fresta)
      let e1 = null
      let e2 = null
      for (let tentativa = 0; tentativa < 10; tentativa++) {
        e1 = a.aleatorio(ini, fim)
        if (tentativa < 6 && passaNoCoracao) {
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
// cada `batida` ms) entra pelo alto um ACORDE: uma GEMA larga em cada corda
// menos a(s) livre(s) (a gema ocupa a corda quase toda: ficar parado entre
// duas cordas não salva). A corda livre anda no máximo uma casa por batida
// (com chance `troca` de andar): sempre dá para acompanhar dançando. Com
// `colcheias`, no contratempo entra mais uma nota solta, numa corda que não é
// a livre de agora nem a da próxima batida.
//
// REFRÃO (a cada ~`pirotecnia` batidas, sorteado): os acordes param e uma
// LABAREDA de um quarto da caixa sobe do palco SEGUINDO o coração: o
// queimador nasce embaixo dele e corre atrás dele pelo palco (mais devagar
// que o coração) por `persegue` ms, trava por `trava` ms (brilha mais forte)
// e então a labareda sobe e queima a faixa. Depois os acordes voltam com a
// corda livre onde o coração estiver.
//
// Justiça: cada corda tem mais que LACUNA_MINIMA de largura; entre dois
// acordes sobra mais que a lacuna na vertical (velocidade x batida - gema);
// a labareda segue mais devagar que o coração e trava antes de subir; durante
// o refrão não cai acorde (só passam os que já estavam no ar).
const dessShow = definirAtaque({
  nome: 'dessShow',
  padrao: { duracao: 6000, cordas: 4, batida: 480, velocidade: 150, livres: 1, pirotecnia: 6, troca: 0.66, colcheias: false, persegue: 420, trava: 300, seguir: 100, queima: 440, gema: 12, raio: 6, fora: 12 },
  iniciar(a, cfg) {
    const geo = () => {
      const l = a.caixa
      return { l, w: l.width / cfg.cordas, x: (k) => l.left + (k + 0.5) * (l.width / cfg.cordas) }
    }
    const cordaDe = (x) => limitar(Math.floor((x - geo().l.left) / geo().w), 0, cfg.cordas - 1)
    a.lacuna(geo().w, 'corda livre do show')
    a.lacuna(cfg.velocidade * (cfg.batida / 1000) - cfg.gema, 'espaço entre dois acordes')
    a.lacuna(geo().l.width - (geo().w - 6), 'fora da labareda')

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
    let livre = cordaDe(a.alvo().x)
    let proxima = livre // a corda livre da próxima batida (decidida uma batida antes, para as colcheias)
    let folga = 2 // batidas em que a corda vizinha mais perto do coração também fica livre (começo e fim do refrão)
    let fogoAte = -1
    let proximoRefrao = cfg.pirotecnia > 0 ? cfg.pirotecnia + a.inteiro(-1, 1) : Infinity
    a.aCada(
      cfg.batida,
      (i) => {
        const { l, w, x } = geo()
        pulso = 1
        if (i % 2 === 0) tocar(a.cena, T('palheta'))
        if (a.tempo < fogoAte) return // refrão: a labareda manda
        if (fogoAte > 0) {
          // fim do refrão: a corda livre volta para onde o coração foi
          livre = proxima = cordaDe(maisPerto(a, l.centerX, l.bottom).x)
          folga = 2
          fogoAte = -1
        }
        if (i >= proximoRefrao) {
          proximoRefrao = i + cfg.pirotecnia + a.inteiro(-1, 1)
          fogoAte = a.tempo + cfg.persegue + cfg.trava + cfg.queima + 80
          labareda(a, cfg, geo)
          return
        }
        // a corda livre anda no máximo uma casa
        // (`troca` = chance de ela mudar de corda; nas bordas, volta para dentro)
        livre = proxima
        if (folga === 0 && a.aleatorio(0, 1) < cfg.troca) {
          const passo = livre === 0 ? 1 : livre === cfg.cordas - 1 ? -1 : a.escolher([-1, 1])
          proxima = limitar(livre + passo, 0, cfg.cordas - 1)
        }
        // contratempo: uma nota solta fora do caminho (nem a livre de agora, nem a próxima)
        if (cfg.colcheias) {
          const agora = livre
          const depois = proxima
          a.depois(cfg.batida / 2, () => {
            if (a.tempo < fogoAte) return
            const g = geo()
            const fora = [...Array(cfg.cordas).keys()].filter((c) => c !== agora && c !== depois)
            if (!fora.length) return
            const k = a.escolher(fora)
            a.bala({ x: g.x(k) + a.aleatorio(-g.w / 4, g.w / 4), y: g.l.top - cfg.fora, vy: cfg.velocidade, raio: cfg.raio, textura: T('nota'), tamanho: 16, cor: 0xffffff, pulso: 0.06, jaAvisada: true })
          })
        }
        const livresAgora = new Set([livre])
        if (folga > 0) {
          // quem está na divisa entre duas cordas não começa encurralado
          folga--
          const c = maisPerto(a, l.centerX, l.bottom)
          const vizinha = limitar(c.x - (l.left + livre * w) < w / 2 ? livre - 1 : livre + 1, 0, cfg.cordas - 1)
          livresAgora.add(vizinha)
        }
        while (livresAgora.size < Math.min(cfg.livres, cfg.cordas - 1)) livresAgora.add(a.inteiro(0, cfg.cordas - 1))
        const ocupados = []
        for (let k = 0; k < cfg.cordas; k++) {
          if (livresAgora.has(k)) continue
          ocupados.push([l.left + k * w, l.left + (k + 1) * w])
          const b = a.bala({
            x: x(k),
            y: l.top - cfg.fora,
            vy: cfg.velocidade,
            largura: w - 8,
            altura: cfg.gema,
            textura: T('gema'),
            cor: CORES_SHOW[k % CORES_SHOW.length],
            jaAvisada: true,
          })
          b.sprite.setDisplaySize(w - 6, cfg.gema + 4)
          b.escalaX = b.sprite.scaleX
          b.escalaY = b.sprite.scaleY
        }
        a.parede({ eixo: 'x', ocupados })
      },
      Infinity,
      200,
    )
  },
})

// a labareda do refrão: o queimador nasce sob o coração e corre atrás dele
// pelo palco (bala ainda no aviso, invisível: quem aparece é o queimador),
// trava e então a labareda sobe e queima a faixa
function labareda(a, cfg, geo) {
  const { l, w } = geo()
  const largura = w - 6
  const meia = largura / 2
  const c0 = maisPerto(a, l.centerX, l.bottom)
  const aviso = cfg.persegue + cfg.trava
  const b = a.bala({
    x: limitar(c0.x, l.left + meia, l.right - meia),
    y: l.centerY,
    largura,
    altura: l.height,
    forma: 'barra',
    cor: 0xff8a3a,
    aviso,
    atravessa: true,
    vida: cfg.queima,
    pulso: 0.15,
    atualizar: (bala) => {
      if (bala.vida < 160) {
        bala.inofensiva = true
        bala.sprite.setAlpha(Math.max(0, bala.vida / 160))
      }
    },
  })
  b.sprite.setVisible(false)
  // o queimador no palco: brasa larga embaixo da faixa, com faíscas subindo.
  // Anda no relógio da própria bala (b.idade), que não para nos respiros: um
  // aoAtualizar sem respiro, para a labareda nunca valer invisível
  const queimador = a.decoracao(a.cena.add.graphics().setDepth(3))
  let subiu = false
  semRespiro(a).aoAtualizar((dt) => {
    if (subiu || b.morta) return
    const t = b.idade
    const g = a.caixa
    if (t < cfg.persegue) {
      // corre atrás do coração (mais devagar que ele)
      const c = maisPerto(a, b.x, g.bottom)
      const passo = cfg.seguir * fator(a) * (dt / 1000)
      b.x = limitar(b.x + limitar(c.x - b.x, -passo, passo), g.left + meia, g.right - meia)
    }
    const travado = t >= cfg.persegue
    const brilho = travado ? 0.75 + 0.25 * Math.sin(t / 30) : 0.35 + 0.15 * Math.sin(t / 60)
    queimador
      .clear()
      .fillStyle(0xff8a3a, brilho * 0.35)
      .fillRect(b.x - meia, g.bottom - (travado ? 26 : 14), largura, travado ? 26 : 14)
      .fillStyle(0xffe14a, brilho)
      .fillRect(b.x - meia + 4, g.bottom - 5, largura - 8, 5)
    if (Math.floor(t / 70) !== Math.floor((t - dt) / 70)) particulas(a.cena, b.x + a.aleatorio(-meia, meia), g.bottom - 4, { cor: travado ? 0xffe14a : 0xff8a3a, quantidade: travado ? 3 : 1, velocidade: 70, vida: 260 })
    if (t >= aviso) {
      // sobe!
      subiu = true
      queimador.destroy()
      b.sprite.setVisible(true).setPosition(b.x, b.y)
      tocar(a.cena, T('grave'))
      a.cena.cameras.main.shake(140, 0.005)
      for (let n = 0; n < 4; n++) particulas(a.cena, b.x, g.bottom - n * (g.height / 4), { cor: n % 2 ? 0xffe14a : 0xff8a3a, quantidade: 6, velocidade: 120, vida: 380 })
    }
  })
}

export default { dessShow, dessNotaSolta, dessTaco, dessHomeRun, dessSolo, dessMicrofonia, dessPalheta, dessFeedback, dessFumaca, dessAmplificador, dessCabos }
