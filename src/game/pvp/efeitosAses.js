// EFEITOS DOS ÁSES: um floreio visual curto (até ~1,2 s) para cada Ás de cada personagem
// (7 personagens x 4 naipes = 28). Só enfeite: nada aqui espera, atrasa ou muda a partida.
//
//   tocarEfeitoAs(cena, personagem, naipe, { x, y, dir, alvo, escala })   dispara e esquece (nunca lança erro)
//   asDaJogada(jogada)           { personagem, naipe } do Ás especial que valeu nesta rodada (ou null)
//   efeitoDoAs(personagem, naipe)  { nome, rotulo, cor, fn } (ou o genérico do naipe, se faltar)
//   EFEITOS_ASES                 a tabela personagem -> naipe -> efeito
//
// Onde: x,y = centro do lugar do efeito (a carta na mesa); dir = +1/-1, para que lado "o outro" está
// (rebater, empurrar); alvo = ponto para onde um ataque devolvido segue; escala = tamanho da carta na
// mesa (1 = carta de 101 px de largura, a da arena 1x1).
//
// Determinístico: nada sorteia (só usa o índice das peças), então os dois lados veem o mesmo. Segue as
// preferências de acessibilidade: com "reduzir animações" vira só o rótulo e um anel parado; tremor,
// clarões e faíscas passam pelos filtros de effects/. Texturas pixel-art são geradas UMA vez (o gerenciador
// de texturas é do jogo todo). Tudo o que cada disparo cria é recolhido ao fim dele ou ao sair da cena.
import { FONTE, LARGURA, ALTURA } from '../constants.js'
import { fatores, quantas } from '../acessibilidade.js'
import { semLigaduras } from '../campanha/texto.js'
import { ignorarNasCaixas } from '../recorte.js'
import { shake } from '../effects/shake.js'
import { tocar } from '../audio.js'

export const NAIPES_ASES = ['espadas', 'ouros', 'paus', 'copas']
export const PERSONAGENS_ASES = ['kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel']

const PROF = 125
const DURACAO_MAX = 1250
const PI = Math.PI
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`
const lerp = (a, b, t) => a + (b - a) * t
const ARCO_IRIS = [0xff4a4a, 0xff9a3a, 0xffe04a, 0x4adf6a, 0x4ab8ff, 0xa06bff]

// ---------- texturas pixel-art (uma vez só) ----------

function sprite(cena, chave, linhas, paleta) {
  const tx = cena.textures
  if (tx.exists(chave)) return chave
  const cv = tx.createCanvas(chave, linhas[0].length, linhas.length)
  const g = cv.getContext()
  linhas.forEach((l, y) => [...l].forEach((ch, x) => {
    if (!paleta[ch]) return
    g.fillStyle = paleta[ch]
    g.fillRect(x, y, 1, 1)
  }))
  cv.refresh()
  cv.setFilter?.(1) // NEAREST: pixel de verdade
  return chave
}

// o taco: 46x13 px, deitado, cabo à esquerda (com fita), cano à direita
function linhasTaco() {
  const W = 46
  const H = 13
  const meio = 6
  const meia = (i) => (i < 3 ? 3 : i < 5 ? 2 : i < 17 ? 2 : i < 31 ? 2 + Math.round(((i - 17) / 14) * 3) : i < 43 ? 5 : i < 45 ? 4 : 3)
  const m = Array.from({ length: H }, () => Array(W).fill('.'))
  for (let i = 0; i < W; i++) {
    const h = meia(i)
    for (let r = -h; r <= h; r++) {
      const borda = r === -h || r === h || i === 0 || i === W - 1
      let ch = 'm'
      if (borda) ch = 'o'
      else if (i >= 5 && i <= 15) ch = (i + r) % 4 === 0 ? 'h' : 'g'
      else if (r === -h + 1) ch = 'l'
      else if (r === h - 1) ch = 's'
      else if (i >= 33 && i <= 34) ch = 'r'
      m[meio + r][i] = ch
    }
  }
  return m.map((l) => l.join(''))
}
const PALETA_TACO = { o: '#2a1608', m: '#d99a52', l: '#f6d59c', s: '#a2642c', g: '#34344c', h: '#5e5e80', r: '#ff8a4a' }

const LINHAS_BOLA = ['..oooo...', '.owwwwwo.', 'owwwwwwwo', 'owrwwwwwo', 'owwrwwwwo', 'owwrwwxwo', 'owrwwwxxo', '.oxxxxxo.', '..oooo...'].map((l) => l)
const PALETA_BOLA = { o: '#3a3a44', w: '#f6f6ee', x: '#c4c4bc', r: '#e03030' }

const TACO = 'ases-taco'
const BOLA = 'ases-bola'

// ---------- caixa de ferramentas de cada disparo ----------

const ativos = new WeakMap() // cena -> Set de disparos vivos

function registrar(cena, d) {
  let s = ativos.get(cena)
  if (!s) {
    s = new Set()
    ativos.set(cena, s)
    cena.events?.once?.('shutdown', () => {
      for (const x of [...s]) x.fim()
      ativos.delete(cena)
    })
  }
  s.add(d)
  return s
}

function criar(cena, op) {
  const objs = new Set()
  const timers = []
  let acabou = false
  const d = {
    cena,
    x: op.x,
    y: op.y,
    dir: op.dir < 0 ? -1 : 1,
    alvo: op.alvo ?? null,
    k: op.escala ?? 1,
    calmo: !fatores().piscar,
    get acabou() {
      return acabou
    },
    // ----- objetos -----
    obj(o) {
      if (acabou) {
        o.destroy?.()
        return o
      }
      objs.add(o)
      o.setDepth?.(PROF)
      ignorarNasCaixas(cena, o)
      return o
    },
    rm(o) {
      if (!o) return
      objs.delete(o)
      cena.tweens?.killTweensOf?.(o)
      if (o.scene || o.active !== false) o.destroy?.()
    },
    g(x = d.x, y = d.y) {
      return d.obj(cena.add.graphics()).setPosition(x, y)
    },
    img(chave, x, y, escala = 1) {
      return d.obj(cena.add.image(x, y, chave)).setScale(escala)
    },
    ret(x, y, w, h, cor, alpha = 1) {
      return d.obj(cena.add.rectangle(x, y, w, h, cor, 1)).setAlpha(alpha)
    },
    txt(x, y, s, { cor = '#ffffff', tam = 18, atraso = 0, ms = 650, rot = 0, borda = 4, pop = true } = {}) {
      const t = d.obj(cena.add.text(x, y, semLigaduras(s), { fontFamily: FONTE, fontSize: `${Math.round(tam * Math.max(0.75, d.k))}px`, color: cor, stroke: '#000000', strokeThickness: borda, align: 'center' }))
        .setOrigin(0.5)
        .setRotation(rot)
        .setAlpha(0)
      d.tw({ targets: t, alpha: 1, scale: { from: pop ? 0.4 : 1, to: 1 }, delay: atraso, duration: 170, ease: 'Back.easeOut' })
      d.some(t, atraso + ms, 220)
      return t
    },
    // ----- tempo -----
    // os callbacks passam por aqui: um erro de enfeite nunca pode subir para o relógio/tweens da cena
    tw(cfg) {
      if (acabou) return null
      const seguro = (f) =>
        f &&
        ((...a) => {
          try {
            return f(...a)
          } catch {
            d.fim()
          }
        })
      const c = { ...cfg }
      for (const k of ['onUpdate', 'onComplete', 'onStart']) if (c[k]) c[k] = seguro(c[k])
      return cena.tweens.add(c)
    },
    em(ms, fn) {
      if (acabou) return
      timers.push(
        cena.time.delayedCall(ms, () => {
          if (acabou) return
          try {
            fn()
          } catch {
            d.fim()
          }
        }),
      )
    },
    // chama fn(p) com p de 0 a 1 (e sempre uma última vez com 1)
    anim(ms, fn, { atraso = 0, ease = 'Linear' } = {}) {
      const v = { p: 0 }
      d.tw({ targets: v, p: 1, delay: atraso, duration: ms, ease, onUpdate: () => !acabou && fn(v.p), onComplete: () => !acabou && fn(1) })
    },
    // (o valor de partida do tween é lido quando ele é criado: o que encadeia na mesma propriedade nasce na hora, com seq/em)
    some(o, atraso = 0, ms = 200) {
      d.em(atraso, () => d.tw({ targets: o, alpha: 0, duration: ms, onComplete: () => d.rm(o) }))
    },
    seq(atraso, cfg) {
      d.em(atraso, () => d.tw(cfg))
    },
    // aparece com "pop" e some
    brotar(o, { atraso = 0, ms = 500, de = 0.3, ate = 1, entrada = 150, saida = 200, ease = 'Back.easeOut' } = {}) {
      o.setAlpha(0).setScale(de)
      d.tw({ targets: o, alpha: 1, scale: ate, delay: atraso, duration: entrada, ease })
      d.some(o, atraso + entrada + ms, saida)
      return o
    },
    // ----- peças prontas -----
    anel(x, y, { cor = 0xffffff, de = 10, ate = 80, ms = 380, larg = 4, atraso = 0, alpha = 0.9 } = {}) {
      const g = d.g(x, y).setBlendMode('ADD')
      g.lineStyle(larg, cor, alpha)
      g.strokeCircle(0, 0, 100)
      g.setAlpha(0).setScale(de / 100)
      d.tw({ targets: g, alpha: 1, delay: atraso, duration: 40 })
      d.tw({ targets: g, scale: ate / 100, delay: atraso, duration: ms, ease: 'Cubic.easeOut' })
      d.some(g, atraso + 40, ms - 40)
      return g
    },
    brilho(x, y, { cor = 0xffffff, r = 50, ms = 300, atraso = 0, alpha = 0.8 } = {}) {
      const g = d.g(x, y).setBlendMode('ADD')
      g.fillStyle(cor, alpha)
      g.fillCircle(0, 0, r)
      g.setAlpha(0).setScale(0.3)
      d.tw({ targets: g, alpha: 1, scale: 1, delay: atraso, duration: ms * 0.35, ease: 'Cubic.easeOut' })
      d.some(g, atraso + ms * 0.35, ms * 0.65)
      return g
    },
    estrela(x, y, { cor = 0xffffff, r = 40, pontas = 4, fino = 0.3, ms = 420, atraso = 0, giro = 0.6, contorno = 0x151515 } = {}) {
      const g = d.g(x, y)
      g.fillStyle(cor, 1)
      g.fillPoints(pontasDe(pontas, r, r * fino), true)
      g.lineStyle(3, contorno, 1)
      g.strokePoints(pontasDe(pontas, r, r * fino), true)
      g.setAlpha(0).setScale(0.2)
      d.tw({ targets: g, alpha: 1, scale: 1, rotation: giro, delay: atraso, duration: ms * 0.4, ease: 'Back.easeOut' })
      d.some(g, atraso + ms * 0.4, ms * 0.6)
      return g
    },
    // linhas de velocidade irradiando de (x,y), em leque centrado em ang
    riscos(x, y, { ang = 0, abre = PI * 2, n = 14, de = 30, ate = 120, cor = 0xffffff, larg = 3, ms = 340, atraso = 0 } = {}) {
      const g = d.g(x, y)
      for (const [w, c] of [[larg + 4, 0x151515], [larg, cor]]) {
        g.lineStyle(w, c, 1)
        for (let i = 0; i < n; i++) {
          const a = ang + (n === 1 ? 0 : (i / (n - 1) - 0.5) * abre)
          const r0 = de + (i % 3) * 8
          const r1 = ate * (0.7 + 0.3 * ((i * 7) % 5) / 4)
          g.lineBetween(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1)
        }
      }
      g.setAlpha(0).setScale(0.55)
      d.tw({ targets: g, alpha: 1, scale: 1.15, delay: atraso, duration: ms * 0.5, ease: 'Cubic.easeOut' })
      d.some(g, atraso + ms * 0.45, ms * 0.55)
      return g
    },
    // explosão de faíscas (como effects/particulas.js, mas o emissor fica na conta deste disparo)
    faiscas(x, y, { cor = 0xffffff, quantidade = 10, velocidade = 120, vida = 450 } = {}) {
      if (d.calmo) return
      const n = quantas(quantidade, fatores().particulas)
      if (n <= 0) return
      const em = d.obj(cena.add.particles(x, y, 'faisca', { speed: { min: velocidade * 0.35, max: velocidade }, angle: { min: 0, max: 360 }, lifespan: vida, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 }, tint: cor, blendMode: 'ADD', emitting: false }))
      em.explode(n)
      d.em(vida + 200, () => d.rm(em))
    },
    tremer(ms = 140, forca = 0.008) {
      shake(cena, ms, forca)
    },
    // clarão de tela (como effects/flash.js, respeitando "clarões" e "reduzir animações"), na conta deste disparo
    clarao(cor = 0xffffff, alpha = 0.22, ms = 140) {
      const f = fatores().clarao
      if (f <= 0) return
      const r = d.obj(cena.add.rectangle(LARGURA / 2, ALTURA / 2, LARGURA, ALTURA, cor, 1)).setAlpha(alpha * f).setDepth(90)
      d.tw({ targets: r, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => d.rm(r) })
    },
    som(nome) {
      tocar(cena, nome)
    },
    fim() {
      if (acabou) return
      acabou = true
      for (const t of timers) t?.remove?.()
      for (const o of [...objs]) {
        try {
          cena.tweens?.killTweensOf?.(o)
          o.destroy?.()
        } catch {
          // já destruído junto com a cena
        }
      }
      objs.clear()
      ativos.get(cena)?.delete(d)
    },
  }
  return d
}

function pontasDe(n, r, ri) {
  const pts = []
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * PI * 2 - PI / 2
    const rr = i % 2 === 0 ? r : ri
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr })
  }
  return pts
}

// coração (alma): duas bolas e um triângulo
function coracao(g, x, y, s, cor, alpha = 1) {
  g.fillStyle(cor, alpha)
  g.fillCircle(x - s * 0.5, y - s * 0.25, s * 0.56)
  g.fillCircle(x + s * 0.5, y - s * 0.25, s * 0.56)
  g.fillTriangle(x - s * 1.04, y - s * 0.02, x + s * 1.04, y - s * 0.02, x, y + s * 1.12)
}

// luva de desenho animado (origem no pulso, aponta para +x). modo: 'dedo' (aponta) | 'garra' (agarra)
function luva(g, cor, modo = 'garra', fecha = 0) {
  const partes = (m, c) => {
    g.fillStyle(c, 1)
    g.fillRoundedRect(-6 - m, -15 - m, 36 + m * 2, 30 + m * 2, 10)
    if (modo === 'dedo') {
      g.fillRoundedRect(20 - m, -9 - m, 38 + m * 2, 12 + m * 2, 6)
      g.fillRoundedRect(4 - m, -24 - m, 20 + m * 2, 13 + m * 2, 6)
    } else {
      const f = lerp(8, 3, fecha)
      for (let i = 0; i < 4; i++) g.fillCircle(32 - fecha * 3, -15 + i * 10, f + m)
      g.fillCircle(14, -23 + fecha * 4, 8 + m)
    }
  }
  partes(3, 0x151515)
  partes(0, cor)
  g.lineStyle(2, 0x151515, 0.8)
  if (modo === 'dedo') {
    g.lineBetween(26, 6, 26, 14)
    g.lineBetween(18, 6, 18, 14)
  } else for (let i = 0; i < 3; i++) g.lineBetween(26, -10 + i * 10, 36, -10 + i * 10)
  g.fillStyle(0xffffff, 0.35)
  g.fillRoundedRect(-2, -11, 22, 6, 3)
}

// itens que as mãos carregam (origem no centro)
function item(g, tipo, cor) {
  if (tipo === 'lanche') {
    g.fillStyle(0x151515, 1)
    g.fillRoundedRect(-17, -11, 34, 22, 3)
    g.fillStyle(0x7a4420, 1)
    g.fillRoundedRect(-15, -9, 30, 18, 2)
    g.lineStyle(2, 0x4a2610, 1)
    g.lineBetween(-5, -9, -5, 9)
    g.lineBetween(5, -9, 5, 9)
    g.lineBetween(-15, 0, 15, 0)
    g.fillStyle(0xe0d0b0, 1)
    g.fillRect(-15, -9, 8, 5)
  } else if (tipo === 'palheta') {
    g.fillStyle(0x151515, 1)
    g.fillTriangle(-17, -13, 17, -13, 0, 19)
    g.fillStyle(cor, 1)
    g.fillTriangle(-13, -10, 13, -10, 0, 14)
    g.fillStyle(0xffffff, 0.45)
    g.fillTriangle(-9, -8, 0, -8, -6, 2)
  } else {
    g.fillStyle(0x151515, 1)
    g.fillRoundedRect(-14, -20, 28, 40, 4)
    g.fillStyle(0xf4f0ff, 1)
    g.fillRoundedRect(-12, -18, 24, 36, 3)
    g.fillStyle(cor, 1)
    g.fillRoundedRect(-9, -15, 18, 30, 2)
    g.fillStyle(0xffffff, 0.8)
    g.fillCircle(0, 0, 4)
  }
}

// um corte curvo (foice) que "se desenha" de ponta a ponta. sinal = direção da diagonal
function corte(d, { x = d.x, y = d.y, sinal = 1, L = 105, cor = 0xffffff, larg = 16, bojo = 22, atraso = 0, ms = 190, rot = 0, segura = 160 } = {}) {
  const g = d.g(x, y).setRotation(rot)
  const dx = sinal / Math.SQRT2
  const dy = 1 / Math.SQRT2
  const nx = -dy
  const ny = dx
  const ponto = (t, lado) => {
    const w = Math.sin(t * PI) * larg * 0.5 * lado
    const b = Math.sin(t * PI) * bojo
    const c = lerp(-L, L, t)
    return { x: dx * c + nx * (b + w), y: dy * c + ny * (b + w) }
  }
  d.anim(ms, (p) => {
    g.clear()
    const cabeca = Math.min(1, p * 1.15)
    const cauda = Math.max(0, p * 1.15 - 0.6)
    if (cabeca <= cauda) return
    const pts = (lado) => {
      const a = []
      for (let i = 0; i <= 14; i++) a.push(ponto(lerp(cauda, cabeca, i / 14), lado))
      return a
    }
    // contorno escuro (mais largo), cor e miolo claro: lê bem sobre a carta branca e sobre o fundo escuro
    for (const [m, c, al] of [[1.5, 0x151515, 0.9], [1, cor, 1], [0.35, 0xffffff, 1]]) {
      g.fillStyle(c, al)
      g.fillPoints([...pts(m), ...pts(-m).reverse()], true)
    }
  }, { atraso, ease: 'Cubic.easeIn' })
  d.some(g, atraso + ms + segura, 220)
  return g
}

// entrega: uma mão (ou outra peça) traz algo até a carta
function entrega(d, { cor, tipo = 'carta', corItem = cor, texto, corTxt = '#ffffff', educado = false, faisca = cor }) {
  const { x, y, k, dir } = d
  const vai = { x: x + dir * 40 * k, y: y - 4 * k }
  const ini = { x: x + dir * 210 * k, y: y - 52 * k }
  const gl = d.g(ini.x, ini.y)
  luva(gl, cor, 'garra', 0.8)
  gl.setScale(1.1 * k * (dir > 0 ? -1 : 1), 1.1 * k)
  const it = d.g(ini.x, ini.y)
  item(it, tipo, corItem)
  it.setScale(k).setRotation(dir * 0.35)
  const dist = educado ? 520 : 330
  const desloc = (p) => {
    const q = p < 0.5 ? lerp(0, 1, p / 0.5) : lerp(1, 1, 0)
    const e = 1 - (1 - q) ** 3
    return { x: lerp(ini.x, vai.x, e), y: lerp(ini.y, vai.y, e) + (educado ? Math.sin(p * PI * 2) * 6 * k : 0) }
  }
  d.anim(dist, (p) => {
    const q = desloc(p)
    gl.setPosition(q.x, q.y)
    it.setPosition(q.x - dir * 38 * k, q.y + 4 * k)
    if (educado) gl.setRotation(Math.sin(p * PI) * 0.25 * dir)
  }, { ease: 'Linear' })
  // a peça entra na carta e a mão solta e recua
  d.em(dist, () => {
    d.tw({ targets: it, scale: 0.05, x: x, y: y, rotation: 0, duration: 180, ease: 'Cubic.easeIn', onComplete: () => d.rm(it) })
    d.brilho(x, y, { cor: faisca, r: 46 * k, ms: 340 })
    d.anel(x, y, { cor: faisca, de: 14 * k, ate: 70 * k, ms: 340 })
    d.faiscas(x, y, { cor: faisca, quantidade: 14, velocidade: 170 })
    d.tw({ targets: gl, x: ini.x, y: ini.y - 30 * k, alpha: 0, duration: 260, delay: 80, ease: 'Cubic.easeIn', onComplete: () => d.rm(gl) })
    d.txt(x, y - 88 * k, texto, { cor: corTxt, tam: 17, ms: 450 })
  })
}

// ---------- os efeitos ----------

// Dess: Rebatida (♠). Um taco de pixel-art rebate o ataque de volta (home run)
function rebatida(d) {
  const { x, y, k, dir } = d
  const bat = sprite(d.cena, TACO, linhasTaco(), PALETA_TACO)
  const bola = sprite(d.cena, BOLA, LINHAS_BOLA, PALETA_BOLA)
  const esc = 3.7 * k
  const Ls = 106 * k // do cabo ao ponto doce
  const ah = -0.3 // ângulo da batida (pouco para cima)
  const AJ = -1.95 // ângulo do preparo (o taco erguido atrás da carta)
  const c0 = { x: x + dir * 24 * k, y: y }
  const pivo = { x: c0.x - dir * Math.cos(ah) * Ls, y: c0.y - Math.sin(ah) * Ls }
  const ang = (a) => dir * a // espelha o giro quando bate para a esquerda
  const taco = d.img(bat, pivo.x, pivo.y, esc).setOrigin(0.07, 0.5)
  if (dir < 0) taco.setScale(-esc, esc)
  taco.setRotation(ang(AJ + 0.25)).setAlpha(0)
  // 1) entra e puxa para trás (preparo), 2) varre, 3) segue o movimento e some
  d.tw({ targets: taco, alpha: 1, duration: 70 })
  d.tw({ targets: taco, rotation: ang(AJ), duration: 120, ease: 'Sine.easeOut' })
  d.tw({ targets: taco, y: pivo.y - 3 * k, duration: 40, delay: 120, yoyo: true, repeat: 1 })
  d.seq(150, { targets: taco, rotation: ang(ah), duration: 100, ease: 'Cubic.easeIn' })
  // rastro da varrida
  const arco = d.g(pivo.x, pivo.y).setBlendMode('ADD')
  d.anim(110, (p) => {
    arco.clear()
    const a0 = lerp(AJ, ah, Math.max(0, p - 0.55))
    const a1 = lerp(AJ, ah, p)
    if (a1 - a0 <= 0.02) return
    for (let i = 0; i < 3; i++) {
      arco.lineStyle(10 - i * 3, i ? 0xffffff : 0xffe6a8, 0.5 + i * 0.2)
      arco.beginPath()
      arco.arc(0, 0, Ls * (0.85 + i * 0.12), dir > 0 ? a0 : PI - a1, dir > 0 ? a1 : PI - a0, false)
      arco.strokePath()
    }
  }, { atraso: 150, ease: 'Cubic.easeIn' })
  d.some(arco, 290, 130)
  // 3) impacto
  d.em(250, () => {
    d.som('hab-dess-tacada')
    d.tremer(150, 0.009)
    d.clarao(0xffffff, 0.12, 110)
    const gi = d.g(c0.x, c0.y).setBlendMode('ADD')
    gi.fillStyle(0xffffff, 1)
    gi.fillPoints(pontasDe(10, 44 * k, 20 * k), true)
    gi.fillStyle(0xffd24a, 1)
    gi.fillPoints(pontasDe(10, 30 * k, 13 * k), true)
    gi.setScale(0.3).setAlpha(1).setRotation(0.2)
    d.tw({ targets: gi, scale: 1.1, rotation: 0.5, duration: 130, ease: 'Cubic.easeOut' })
    d.some(gi, 80, 150)
    d.riscos(c0.x, c0.y, { ang: dir > 0 ? 0 : PI, abre: PI * 0.9, n: 7, de: 46 * k, ate: 150 * k, cor: 0xfff2c0, larg: 4, ms: 300 })
        d.anel(c0.x, c0.y, { cor: 0xffe6a8, de: 14 * k, ate: 90 * k, ms: 300, larg: 5 })
    d.faiscas(c0.x, c0.y, { cor: 0xffd24a, quantidade: 16, velocidade: 240 })
    d.txt(c0.x - dir * 6 * k, c0.y - 78 * k, 'TOC!', { cor: '#ffe05a', tam: 34, rot: dir * -0.12, ms: 480, borda: 6 })
    // a bola: arco de home run até o alvo (ou para fora, no lado do rebatido)
    const fim = d.alvo ?? { x: x + dir * 360 * k, y: y - 60 * k }
    const b = d.img(bola, c0.x, c0.y, 4.6 * k)
    const rastro = d.g(0, 0).setBlendMode('ADD')
    const pos = (p) => ({ x: lerp(c0.x, fim.x, p), y: lerp(c0.y, fim.y, p) - Math.sin(p * PI) * 150 * k })
    const hist = []
    d.anim(520, (p) => {
      const q = pos(p)
      b.setPosition(q.x, q.y).setRotation(p * 14 * dir).setScale(lerp(4.6, 2.4, p) * k)
      hist.push(q)
      if (hist.length > 7) hist.shift()
      rastro.clear()
      hist.forEach((h, i) => {
        rastro.fillStyle(i % 2 ? 0xffe6a8 : 0xffffff, (i + 1) / (hist.length + 2) * 0.8)
        rastro.fillCircle(h.x, h.y, (i + 1) * 1.8 * k)
      })
    }, { ease: 'Quad.easeIn' })
    d.em(540, () => {
      d.rm(b)
      d.rm(rastro)
      d.estrela(fim.x, fim.y, { cor: 0xffe6a8, r: 34 * k, ms: 260 })
    })
  })
  // seguimento e saída do taco
  d.seq(250, { targets: taco, rotation: ang(0.9), duration: 230, ease: 'Cubic.easeOut' })
  d.seq(520, { targets: taco, alpha: 0, duration: 160, onComplete: () => d.rm(taco) })
}

// Dess: Corta o Som (♦). Um cabo é arrancado da tomada; as ondas do som se apagam
function cortaOSom(d) {
  const { x, y, k, dir } = d
  const tom = { x: x - dir * 52 * k, y: y }
  // ondas de som chegando e sendo cortadas
  const ondas = d.g(x, y)
  const cabo = d.g(0, 0)
  const tomada = d.g(tom.x, tom.y)
  tomada.fillStyle(0x151515, 1)
  tomada.fillRoundedRect(-9, -13, 18, 26, 4)
  tomada.fillStyle(0x70708a, 1)
  tomada.fillRoundedRect(-7, -11, 14, 22, 3)
  tomada.fillStyle(0x151515, 1)
  tomada.fillCircle(0, 0, 4)
  tomada.setScale(k)
  const ponta = { x: tom.x - dir * 24 * k, y: tom.y }
  const origem = { x: x - dir * 190 * k, y: y + 60 * k }
  const plugue = d.g(ponta.x, ponta.y)
  plugue.fillStyle(0x151515, 1)
  plugue.fillRoundedRect(-14, -10, 28, 20, 4)
  plugue.fillStyle(0xff8a4a, 1)
  plugue.fillRoundedRect(-12, -8, 24, 16, 3)
  plugue.fillStyle(0xcfd0dc, 1)
  plugue.fillRect(dir * 12, -4, dir * 10 + (dir < 0 ? 0 : 0), 8)
  plugue.setScale(k)
  const desenhaCabo = (p, solto) => {
    cabo.clear()
    cabo.lineStyle(5 * k, 0x151515, 1)
    const ptsDe = (largura) => {
      const pts = []
      for (let i = 0; i <= 18; i++) {
        const t = i / 18
        const bx = lerp(origem.x, plugue.x, t)
        const by = lerp(origem.y, plugue.y, t) + Math.sin(t * PI) * (solto ? 14 : 40) * k - Math.sin(t * PI * 3 + p * 14) * (solto ? 14 * (1 - p) : 3) * k
        pts.push({ x: bx, y: by })
      }
      return pts
    }
    cabo.strokePoints(ptsDe(), false)
    cabo.lineStyle(2.5 * k, 0xff8a4a, 1)
    cabo.strokePoints(ptsDe(), false)
  }
  desenhaCabo(0, false)
  const desenhaOndas = (a, cor) => {
    ondas.clear()
    for (let i = 0; i < 3; i++) {
      ondas.lineStyle(3 * k, cor, a * (1 - i * 0.22))
      ondas.beginPath()
      ondas.arc(0, 0, (46 + i * 22) * k, dir > 0 ? -0.8 : PI - 0.8, dir > 0 ? 0.8 : PI + 0.8, false)
      ondas.strokePath()
    }
  }
  desenhaOndas(0, 0xffc08a)
  d.anim(200, (p) => desenhaOndas(p, 0xffc08a))
  // 220 ms: puxa o cabo (o plugue sai voando para trás), faísca e as ondas morrem
  d.em(220, () => {
    d.tremer(110, 0.006)
    d.estrela(tom.x - dir * 8 * k, tom.y, { cor: 0xffe05a, r: 38 * k, pontas: 8, fino: 0.35, ms: 300 })
    d.faiscas(tom.x, tom.y, { cor: 0xffe05a, quantidade: 12, velocidade: 190 })
    d.txt(x, y - 86 * k, 'ZZT!', { cor: '#ffe05a', tam: 26, rot: -0.08, ms: 440 })
    d.anim(330, (p) => {
      plugue.setPosition(lerp(ponta.x, origem.x, p * p), lerp(ponta.y, origem.y - 10 * k, p * p) - Math.sin(p * PI) * 36 * k).setRotation(dir * p * 3)
      desenhaCabo(p, true)
      plugue.setAlpha(1 - Math.max(0, p - 0.7) / 0.3)
    }, { ease: 'Cubic.easeIn' })
    d.anim(260, (p) => desenhaOndas(1 - p, 0x8a8aa8))
    d.some(cabo, 330, 200)
    d.some(tomada, 420, 220)
    d.some(plugue, 330, 100)
    d.some(ondas, 280, 100)
  })
}

// Dess: Bis! (♥). Holofotes se cruzam, confete e "BIS!"
function bis(d) {
  const { x, y, k } = d
  const cores = [0xff8a4a, 0xffe05a, 0x6dd0ff, 0xff4f8a, 0x7aff8a]
  for (const lado of [-1, 1]) {
    const f = d.g(x + lado * 150 * k, y - 190 * k).setBlendMode('ADD')
    const ang = Math.atan2(190 * k, -lado * 150 * k)
    f.fillStyle(0xfff4c0, 0.28)
    f.fillPoints([{ x: -8 * k, y: 0 }, { x: 8 * k, y: 0 }, { x: Math.cos(ang - PI / 2 + PI / 2) * 0 + (-lado * 150 * k + 46 * k), y: 190 * k + 20 * k }, { x: -lado * 150 * k - 46 * k, y: 190 * k + 20 * k }], true)
    f.fillStyle(0xffffff, 0.45)
    f.fillCircle(0, 0, 11 * k)
    f.setAlpha(0)
    d.tw({ targets: f, alpha: 1, duration: 140, delay: lado > 0 ? 40 : 0 })
    d.some(f, 640, 260)
  }
  d.brilho(x, y, { cor: 0xffe8a0, r: 64 * k, ms: 560, alpha: 0.5 })
  d.estrela(x, y - 2 * k, { cor: 0xffe05a, r: 50 * k, pontas: 5, fino: 0.45, ms: 520, giro: 1.2, atraso: 90 })
  d.txt(x, y - 4 * k, 'BIS!', { cor: '#ff8a4a', tam: 34, ms: 600, atraso: 100, borda: 6, rot: -0.1 })
  // confete: chove em volta da carta
  if (!d.calmo) {
    const n = Math.max(8, Math.round(22 * fatores().festa))
    for (let i = 0; i < n; i++) {
      const bx = x + ((i * 53) % 190 - 95) * k
      const r = d.ret(bx, y - (150 + ((i * 37) % 60)) * k, 6 * k, 10 * k, cores[i % cores.length]).setRotation(i)
      d.tw({ targets: r, y: y + (60 + ((i * 29) % 70)) * k, x: bx + (((i * 17) % 40) - 20) * k, rotation: i + 5, alpha: { from: 1, to: 0.1 }, delay: 120 + (i % 7) * 40, duration: 760, ease: 'Sine.easeIn', onComplete: () => d.rm(r) })
    }
  }
  d.anel(x, y, { cor: 0xffe05a, de: 20 * k, ate: 110 * k, ms: 420, atraso: 60 })
}

// Kris: Reflexo da Lâmina (♠)
function reflexoDaLamina(d) {
  const { x, y, k } = d
  corte(d, { sinal: 1, L: 112 * k, cor: 0x7fd0ff, larg: 18 * k, bojo: 20 * k, ms: 170 })
  corte(d, { sinal: -1, L: 112 * k, cor: 0xffffff, larg: 18 * k, bojo: -20 * k, ms: 170, atraso: 150 })
  d.em(270, () => {
    d.tremer(110, 0.006)
    d.estrela(x, y, { cor: 0xffffff, r: 62 * k, pontas: 4, fino: 0.18, ms: 420, contorno: 0x7fd0ff })
    d.anel(x, y, { cor: 0x7fd0ff, de: 12 * k, ate: 88 * k, ms: 360 })
    d.faiscas(x, y, { cor: 0x9fe0ff, quantidade: 16, velocidade: 210 })
    d.txt(x, y - 92 * k, 'CLANG!', { cor: '#9fe0ff', tam: 22, rot: 0.1, ms: 460 })
  })
}

// Kris: Silêncio (♦)
function silencio(d) {
  const { x, y, k } = d
  const veu = d.ret(x, y, 100 * k, 144 * k, 0x0c0418, 0)
  d.tw({ targets: veu, alpha: 0.62, duration: 160 })
  d.some(veu, 760, 240)
  for (let i = 0; i < 3; i++) d.anel(x, y, { cor: 0x9a7cff, de: 150 * k, ate: 16 * k, ms: 340, atraso: i * 130, larg: 5 - i, alpha: 0.9 })
  d.txt(x, y + 2 * k, '...', { cor: '#d8ccff', tam: 40, atraso: 330, ms: 480, borda: 5 })
  d.txt(x, y - 86 * k, 'SHHH', { cor: '#b9a4ff', tam: 20, atraso: 180, ms: 640 })
  d.em(330, () => d.faiscas(x, y, { cor: 0x9a7cff, quantidade: 8, velocidade: 60, vida: 600 }))
}

// Kris: Determinação (♥). A alma vermelha brilha
function determinacao(d) {
  const { x, y, k } = d
  const raios = d.g(x, y).setBlendMode('ADD')
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2
    raios.fillStyle(0xff5a5a, 0.5)
    raios.fillTriangle(Math.cos(a - 0.07) * 20, Math.sin(a - 0.07) * 20, Math.cos(a + 0.07) * 20, Math.sin(a + 0.07) * 20, Math.cos(a) * (i % 2 ? 78 : 112) * k, Math.sin(a) * (i % 2 ? 78 : 112) * k)
  }
  raios.setAlpha(0).setScale(0.3)
  d.tw({ targets: raios, alpha: 1, scale: 1, rotation: 0.5, duration: 420, ease: 'Cubic.easeOut' })
  d.some(raios, 380, 340)
  const alma = d.g(x, y)
  coracao(alma, 0, 0, 30 * k, 0x151515)
  coracao(alma, 0, 0, 25 * k, 0xffffff)
  coracao(alma, 0, 0, 21 * k, 0xff2a3a)
  coracao(alma, -5 * k, -6 * k, 7 * k, 0xff9a9a, 0.8)
  d.brotar(alma, { ms: 560, de: 0.2, ate: 1.5, entrada: 200 })
  d.seq(200, { targets: alma, scale: 1.25, duration: 130, yoyo: true, repeat: 1 })
  d.seq(200, { targets: alma, y: y - 22 * k, duration: 500, ease: 'Sine.easeOut' })
  d.anel(x, y, { cor: 0xff5a5a, de: 14 * k, ate: 100 * k, ms: 460, atraso: 120, larg: 5 })
  d.faiscas(x, y, { cor: 0xff6a6a, quantidade: 16, velocidade: 130, vida: 700 })
  d.txt(x, y + 82 * k, 'NÃO DESISTA!', { cor: '#ff8a8a', tam: 15, atraso: 220, ms: 560 })
}

// Susie: Revide Selvagem (♠): três garras de machado
function revideSelvagem(d) {
  const { x, y, k } = d
  for (let i = 0; i < 3; i++) corte(d, { x: x + (i - 1) * 34 * k, y: y + (i - 1) * 6 * k, sinal: 1, L: 110 * k, cor: i === 1 ? 0xffffff : 0xd08aff, larg: 15 * k, bojo: 16 * k, ms: 150, atraso: i * 70, rot: -0.15 })
  d.em(330, () => {
    d.tremer(180, 0.012)
    d.clarao(0xc46bff, 0.2, 140)
    d.estrela(x, y, { cor: 0xffd0ff, r: 70 * k, pontas: 8, fino: 0.35, ms: 380 })
    d.riscos(x, y, { n: 12, de: 40 * k, ate: 130 * k, cor: 0xe0a0ff, larg: 4, ms: 320 })
    d.faiscas(x, y, { cor: 0xd08aff, quantidade: 18, velocidade: 240 })
    d.txt(x, y - 92 * k, 'REVIDE!', { cor: '#e0a0ff', tam: 26, rot: -0.1, ms: 460, borda: 5 })
  })
}

// Susie: Grito (♦): ondas serrilhadas
function grito(d) {
  const { x, y, k } = d
  for (let i = 0; i < 3; i++) {
    const g = d.g(x, y).setBlendMode('ADD')
    g.lineStyle(5 - i, i % 2 ? 0xffffff : 0xff6aa8, 0.95)
    g.strokePoints(pontasDe(16, 100, 80), true)
    g.setAlpha(0).setScale(0.15).setRotation(i * 0.2)
    d.tw({ targets: g, alpha: 1, scale: 0.7 * k + i * 0.18, rotation: i * 0.2 + 0.25, delay: i * 120, duration: 380, ease: 'Cubic.easeOut' })
    d.some(g, i * 120 + 120, 280)
  }
  d.tremer(300, 0.011)
  d.clarao(0xff3a7a, 0.16, 180)
  d.txt(x, y - 4 * k, 'GRAAAH!', { cor: '#ff6aa8', tam: 30, ms: 650, borda: 6, rot: -0.08 })
  d.txt(x, y + 66 * k, '!!!', { cor: '#ffffff', tam: 24, atraso: 120, ms: 500 })
  d.faiscas(x, y, { cor: 0xff6aa8, quantidade: 14, velocidade: 220 })
}

// Susie: Teimosia (♥): o coração finca o pé no chão
function teimosia(d) {
  const { x, y, k } = d
  const alma = d.g(x, y - 150 * k)
  coracao(alma, 0, 0, 26 * k, 0xffffff)
  coracao(alma, 0, 0, 22 * k, 0xe040a0)
  coracao(alma, -4 * k, -5 * k, 6 * k, 0xff9ad8, 0.8)
  alma.setAlpha(0)
  d.tw({ targets: alma, alpha: 1, y: y + 6 * k, duration: 230, ease: 'Cubic.easeIn' })
  d.tw({ targets: alma, scaleY: 0.7, scaleX: 1.25, delay: 230, duration: 70, yoyo: true })
  d.some(alma, 640, 240)
  d.em(240, () => {
    d.tremer(140, 0.008)
    d.anel(x, y + 30 * k, { cor: 0xff7ac8, de: 10 * k, ate: 110 * k, ms: 360, larg: 5 })
    for (const lado of [-1, 1]) {
      const p = d.g(x + lado * 20 * k, y + 34 * k)
      p.fillStyle(0xe8d8f0, 0.9)
      p.fillCircle(0, 0, 10 * k)
      p.fillCircle(lado * 9 * k, -5 * k, 7 * k)
      d.tw({ targets: p, x: x + lado * 100 * k, y: y + 18 * k, scale: 1.8, alpha: 0, duration: 440, ease: 'Cubic.easeOut', onComplete: () => d.rm(p) })
    }
    d.txt(x, y - 82 * k, 'HMPF!', { cor: '#ff9ad8', tam: 26, rot: 0.08, ms: 420 })
    d.faiscas(x, y + 20 * k, { cor: 0xff7ac8, quantidade: 12, velocidade: 150 })
  })
}

// Ralsei: Lição Invertida (♠): o livro vira de ponta-cabeça
function licaoInvertida(d) {
  const { x, y, k, dir } = d
  const livro = d.g(x, y)
  livro.fillStyle(0x151515, 1)
  livro.fillRoundedRect(-30, -24, 60, 48, 5)
  livro.fillStyle(0x2f9a5a, 1)
  livro.fillRoundedRect(-27, -21, 54, 42, 4)
  livro.fillStyle(0xf4f0e0, 1)
  livro.fillRect(-22, -16, 22, 32)
  livro.fillRect(2, -16, 22, 32)
  livro.lineStyle(2, 0x2f9a5a, 0.8)
  for (let i = 0; i < 4; i++) {
    livro.lineBetween(-19, -9 + i * 8, -3, -9 + i * 8)
    livro.lineBetween(5, -9 + i * 8, 21, -9 + i * 8)
  }
  livro.fillStyle(0xffe05a, 1)
  livro.fillTriangle(-2, -18, 2, -18, 0, 10)
  livro.setScale(0.2 * k).setAlpha(0)
  d.tw({ targets: livro, alpha: 1, scale: 1.7 * k, duration: 160, ease: 'Back.easeOut' })
  // vira de cabeça para baixo (giro de meia-volta, com um "sobe" no meio)
  d.tw({ targets: livro, rotation: PI * dir, y: y - 18 * k, delay: 180, duration: 340, ease: 'Cubic.easeInOut' })
  d.seq(520, { targets: livro, y, duration: 120, ease: 'Bounce.easeOut' })
  d.some(livro, 720, 200)
  d.em(160, () => d.anel(x, y, { cor: 0x7aff9a, de: 20 * k, ate: 90 * k, ms: 380 }))
  d.em(480, () => {
    d.estrela(x, y, { cor: 0xaaffc0, r: 54 * k, ms: 360, pontas: 4, fino: 0.25 })
    d.faiscas(x, y, { cor: 0x7aff9a, quantidade: 14, velocidade: 170 })
    d.txt(x, y - 82 * k, 'AO CONTRÁRIO!', { cor: '#9affb8', tam: 15, ms: 420 })
  })
}

// Ralsei: Pacifismo (♦): símbolo da paz
function pacifismo(d) {
  const { x, y, k } = d
  const paz = d.g(x, y)
  for (const [w, c] of [[13, 0x1d6a3a], [7, 0xffffff]]) {
    paz.lineStyle(w * k, c, 1)
    paz.strokeCircle(0, 0, 36 * k)
    paz.lineBetween(0, -36 * k, 0, 36 * k)
    paz.lineBetween(0, 0, -26 * k, 26 * k)
    paz.lineBetween(0, 0, 26 * k, 26 * k)
  }
  d.brotar(paz, { ms: 620, de: 0.3, ate: 1, entrada: 220 })
  d.tw({ targets: paz, rotation: 0.2, duration: 900, ease: 'Sine.easeOut' })
  d.brilho(x, y, { cor: 0xd8ffe8, r: 76 * k, ms: 720, alpha: 0.4 })
  for (let i = 0; i < 3; i++) d.anel(x, y, { cor: 0xbaffd0, de: 20 * k, ate: (90 + i * 18) * k, ms: 560, atraso: 160 + i * 150, larg: 3 })
  d.txt(x, y + 78 * k, 'PAZ!', { cor: '#d8ffe8', tam: 22, atraso: 140, ms: 540 })
  d.em(120, () => d.faiscas(x, y, { cor: 0xd8ffe8, quantidade: 10, velocidade: 70, vida: 800 }))
}

// Ralsei: Abraço Fofo (♥): dois braços se fecham em volta
function abracoFofo(d) {
  const { x, y, k } = d
  const g = d.g(0, 0)
  const bracos = (p) => {
    g.clear()
    for (const lado of [-1, 1]) {
      const pts = []
      for (let i = 0; i <= 14; i++) {
        const t = (i / 14) * p
        // curva de Bézier: sobe pela lateral e fecha no peito da carta
        const u = 1 - t
        const px = u * u * 128 + 2 * u * t * 150 + t * t * 8
        const py = u * u * 100 + 2 * u * t * -70 + t * t * 6
        pts.push({ x: x + lado * px * k, y: y + py * k })
      }
      g.lineStyle(24 * k, 0x151515, 1)
      g.strokePoints(pts, false)
      g.lineStyle(17 * k, 0xff9acb, 1)
      g.strokePoints(pts, false)
      const f = pts[pts.length - 1]
      g.fillStyle(0x151515, 1)
      g.fillCircle(f.x, f.y, 15 * k)
      g.fillStyle(0xfff0f8, 1)
      g.fillCircle(f.x, f.y, 11.5 * k)
    }
  }
  d.anim(320, bracos, { ease: 'Cubic.easeOut' })
  d.some(g, 640, 240)
  d.em(320, () => {
    d.tw({ targets: g, scale: 1.0, duration: 80 })
    d.anel(x, y, { cor: 0xff9acb, de: 20 * k, ate: 96 * k, ms: 380 })
    d.faiscas(x, y, { cor: 0xffb0d8, quantidade: 10, velocidade: 140 })
    for (let i = 0; i < 5; i++) {
      const h = d.g(x + (i - 2) * 24 * k, y - 20 * k)
      coracao(h, 0, 0, 8 * k, 0xff7ab8)
      d.tw({ targets: h, y: y - (70 + (i % 3) * 20) * k, alpha: { from: 1, to: 0 }, delay: i * 50, duration: 600, ease: 'Sine.easeOut', onComplete: () => d.rm(h) })
    }
    d.txt(x, y + 84 * k, 'NHÉ~', { cor: '#ffb0d8', tam: 20, ms: 420 })
  })
}

// Noelle: Espelho de Gelo (♠): o espelho se quebra e os cacos voam
function espelhoDeGelo(d) {
  const { x, y, k, dir } = d
  const w = 46 * k
  const h = 62 * k
  const pts = (m) => [{ x: 0, y: -h - m }, { x: w + m, y: -h * 0.45 }, { x: w + m, y: h * 0.45 }, { x: 0, y: h + m }, { x: -w - m, y: h * 0.45 }, { x: -w - m, y: -h * 0.45 }]
  const esp = d.g(x, y)
  esp.fillStyle(0xe8fbff, 1)
  esp.fillPoints(pts(5), true)
  esp.fillStyle(0x7ad0ff, 1)
  esp.fillPoints(pts(0), true)
  esp.fillStyle(0xe8fbff, 0.7)
  esp.fillTriangle(-w * 0.5, -h * 0.7, -w * 0.1, -h * 0.7, -w * 0.9, h * 0.1)
  esp.fillTriangle(w * 0.1, -h * 0.5, w * 0.35, -h * 0.5, -w * 0.1, h * 0.5)
  esp.lineStyle(2, 0x2a6a9a, 1)
  esp.strokePoints(pts(0), true)
  d.brotar(esp, { ms: 90, de: 0.4, ate: 1, entrada: 150 })
  d.em(240, () => {
    d.rm(esp)
    d.tremer(130, 0.008)
    d.clarao(0xc8f0ff, 0.2, 120)
    d.som('espelho')
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2
      const c = d.g(x + Math.cos(a) * 12 * k, y + Math.sin(a) * 12 * k)
      c.fillStyle(i % 2 ? 0xe8fbff : 0x7ad0ff, 0.95)
      c.fillTriangle(-12 * k, 8 * k, 12 * k, 4 * k, 0, -14 * k)
      c.setRotation(a)
      d.tw({ targets: c, x: x + Math.cos(a) * 125 * k + dir * 30 * k, y: y + Math.sin(a) * 105 * k, rotation: a + 4, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => d.rm(c) })
    }
    d.riscos(x, y, { n: 10, de: 20 * k, ate: 100 * k, cor: 0xd8f6ff, ms: 300 })
    d.txt(x, y - 92 * k, 'CRAC!', { cor: '#c8f0ff', tam: 26, rot: -0.1, ms: 420 })
  })
}

// um floco de neve (6 braços) em graphics, origem no centro
function floco(g, r, cor, larg = 3) {
  g.lineStyle(larg, cor, 1)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI
    g.lineBetween(Math.cos(a) * -r, Math.sin(a) * -r, Math.cos(a) * r, Math.sin(a) * r)
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2
    const bx = Math.cos(a) * r * 0.6
    const by = Math.sin(a) * r * 0.6
    g.lineBetween(bx, by, bx + Math.cos(a + 0.7) * r * 0.3, by + Math.sin(a + 0.7) * r * 0.3)
    g.lineBetween(bx, by, bx + Math.cos(a - 0.7) * r * 0.3, by + Math.sin(a - 0.7) * r * 0.3)
  }
}

// Noelle: Congelar (♦)
function congelar(d) {
  const { x, y, k } = d
  const gelo = d.ret(x, y, 100 * k, 144 * k, 0xa8e8ff, 0)
  d.tw({ targets: gelo, alpha: 0.5, duration: 260 })
  d.some(gelo, 720, 240)
  // cristais crescendo das bordas
  const cr = d.g(x, y)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * PI * 2
    const bx = Math.cos(a) * 52 * k * (Math.abs(Math.cos(a)) > 0.7 ? 1 : 0.9)
    const by = Math.sin(a) * 74 * k
    const len = (20 + (i % 3) * 12) * k
    cr.fillStyle(i % 2 ? 0xe8fbff : 0x7ad0ff, 1)
    cr.fillTriangle(bx + Math.cos(a + PI / 2) * 7 * k, by + Math.sin(a + PI / 2) * 7 * k, bx - Math.cos(a + PI / 2) * 7 * k, by - Math.sin(a + PI / 2) * 7 * k, bx + Math.cos(a) * len, by + Math.sin(a) * len)
  }
  cr.setScale(0.3).setAlpha(0)
  d.tw({ targets: cr, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' })
  d.some(cr, 640, 260)
  const fl = d.g(x, y)
  floco(fl, 30 * k, 0xffffff, 4)
  d.brotar(fl, { ms: 560, de: 0.2, ate: 1, atraso: 120 })
  d.tw({ targets: fl, rotation: 1, delay: 120, duration: 800 })
  d.anel(x, y, { cor: 0xc8f0ff, de: 20 * k, ate: 100 * k, ms: 420 })
  d.txt(x, y - 92 * k, 'BRRR!', { cor: '#c8f0ff', tam: 24, rot: 0.08, ms: 520, atraso: 100 })
  d.faiscas(x, y, { cor: 0xc8f0ff, quantidade: 14, velocidade: 120, vida: 700 })
}

// Noelle: Milagre de Natal (♥)
function milagreDeNatal(d) {
  const { x, y, k } = d
  const n = d.calmo ? 4 : 12
  for (let i = 0; i < n; i++) {
    const bx = x + ((i * 47) % 150 - 75) * k
    const f = d.g(bx, y - (110 + (i % 4) * 14) * k)
    floco(f, (6 + (i % 3) * 2) * k, 0xffffff, 2)
    d.tw({ targets: f, y: y + (60 + (i % 3) * 14) * k, x: bx + (((i * 13) % 30) - 15) * k, rotation: 3, alpha: { from: 1, to: 0 }, delay: (i % 6) * 55, duration: 820, ease: 'Sine.easeIn', onComplete: () => d.rm(f) })
  }
  const luz = d.g(x, y - 70 * k)
  luz.fillStyle(0xffe05a, 1)
  luz.fillPoints(pontasDe(5, 26 * k, 11 * k), true)
  luz.lineStyle(3, 0x151515, 1)
  luz.strokePoints(pontasDe(5, 26 * k, 11 * k), true)
  d.brotar(luz, { ms: 560, de: 0.2, ate: 1.1, atraso: 60, entrada: 220 })
  d.tw({ targets: luz, rotation: 0.4, duration: 800 })
  d.brilho(x, y - 70 * k, { cor: 0xffe05a, r: 50 * k, ms: 620, atraso: 80, alpha: 0.5 })
  d.brilho(x, y, { cor: 0x7aff9a, r: 54 * k, ms: 560, atraso: 120, alpha: 0.28 })
  d.faiscas(x, y, { cor: 0xff6a6a, quantidade: 8, velocidade: 120, vida: 600 })
  d.faiscas(x, y, { cor: 0x7aff9a, quantidade: 8, velocidade: 120, vida: 600 })
  d.txt(x, y + 82 * k, 'MILAGRE!', { cor: '#ffe9a0', tam: 20, atraso: 140, ms: 560 })
}

// Berdly: Réplica Brilhante (♠): uma cópia reluzente da carta sai de volta
function replicaBrilhante(d) {
  const { x, y, k, dir } = d
  const r = d.g(x, y).setBlendMode('ADD')
  r.fillStyle(0x7ac8ff, 0.35)
  r.fillRoundedRect(-50 * k, -72 * k, 100 * k, 144 * k, 8)
  r.lineStyle(3, 0xe8f6ff, 1)
  r.strokeRoundedRect(-50 * k, -72 * k, 100 * k, 144 * k, 8)
  r.setAlpha(0)
  d.tw({ targets: r, alpha: 1, duration: 100 })
  d.tw({ targets: r, x: x + dir * 96 * k, scaleX: -0.2, duration: 330, delay: 80, ease: 'Cubic.easeOut' })
  d.seq(420, { targets: r, scaleX: 1, x: x + dir * 40 * k, duration: 260, ease: 'Back.easeOut' })
  d.some(r, 620, 220)
  const brilhos = [[-40, -60], [40, -50], [-30, 54], [44, 60]]
  brilhos.forEach(([bx, by], i) => d.estrela(x + bx * k, y + by * k, { cor: 0xffffff, r: 20 * k, ms: 340, atraso: 100 + i * 90, fino: 0.2, contorno: 0x7ac8ff }))
  d.anel(x, y, { cor: 0x7ac8ff, de: 24 * k, ate: 100 * k, ms: 420, atraso: 200 })
  d.txt(x, y - 92 * k, 'RÉPLICA!', { cor: '#bfe6ff', tam: 22, rot: -0.07, ms: 500, atraso: 120 })
  d.faiscas(x, y, { cor: 0x9fd8ff, quantidade: 12, velocidade: 150 })
}

// Berdly: Objeção! (♦): balão de quadrinhos, dedo em riste e tremor
function objecao(d) {
  const { x, y, k, dir } = d
  const by = y - 104 * k // o balão fica acima da carta (não esconde o nome nem o carimbo)
  const raios = d.g(x, by).setBlendMode('ADD')
  raios.lineStyle(4, 0xffffff, 0.8)
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * PI * 2
    raios.lineBetween(Math.cos(a) * 52 * k, Math.sin(a) * 36 * k, Math.cos(a) * 150 * k, Math.sin(a) * 100 * k)
  }
  raios.setAlpha(0)
  d.tw({ targets: raios, alpha: 0.6, scale: { from: 0.6, to: 1.1 }, duration: 160 })
  d.some(raios, 360, 220)
  const bal = d.g(x, by)
  const pts = (m) => {
    const p = []
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * PI * 2
      const rr = (i % 2 ? 66 : 92) + m
      p.push({ x: Math.cos(a) * rr * 1.1 * k, y: Math.sin(a) * rr * 0.46 * k })
    }
    return p
  }
  bal.fillStyle(0x151515, 1)
  bal.fillPoints(pts(8), true)
  bal.fillStyle(0xffffff, 1)
  bal.fillPoints(pts(0), true)
  bal.lineStyle(3, 0xff3a3a, 1)
  bal.strokePoints(pts(-6), true)
  d.brotar(bal, { ms: 720, de: 2.6, ate: 1, entrada: 120, saida: 220, ease: 'Cubic.easeIn' })
  const tx = d.txt(x, by, 'OBJEÇÃO!', { cor: '#e02020', tam: 22, ms: 820, atraso: 100, borda: 4, rot: -0.06 })
  tx.setScale(1)
  const mao = d.g(x - dir * 130 * k, y - 20 * k)
  luva(mao, 0xffffff, 'dedo')
  mao.setScale(1.2 * k * dir, 1.2 * k).setRotation(dir * -0.45)
  mao.setAlpha(0)
  d.tw({ targets: mao, alpha: 1, x: x - dir * 62 * k, y: y - 44 * k, delay: 150, duration: 150, ease: 'Back.easeOut' })
  d.some(mao, 700, 220)
  d.em(110, () => {
    d.tremer(220, 0.012)
    d.clarao(0xffffff, 0.22, 120)
    d.anel(x, by, { cor: 0xff4a4a, de: 30 * k, ate: 120 * k, ms: 380, larg: 6 })
  })
}

// Berdly: Cópia da Prova (♣): um scanner passa e uma folha copiada sai
function copiaDaProva(d) {
  const { x, y, k, dir } = d
  const barra = d.g(x, y - 74 * k).setBlendMode('ADD')
  barra.fillStyle(0x7aff9a, 0.9)
  barra.fillRect(-60 * k, -3, 120 * k, 6)
  barra.fillStyle(0xffffff, 0.9)
  barra.fillRect(-60 * k, -1, 120 * k, 2)
  barra.fillStyle(0x7aff9a, 0.22)
  barra.fillRect(-60 * k, 6, 120 * k, 40 * k)
  d.tw({ targets: barra, y: y + 74 * k, duration: 380, ease: 'Sine.easeInOut' })
  d.some(barra, 340, 160)
  const f = d.g(x, y)
  f.fillStyle(0x151515, 1)
  f.fillRoundedRect(-30, -40, 60, 80, 3)
  f.fillStyle(0xfdfdf4, 1)
  f.fillRoundedRect(-28, -38, 56, 76, 2)
  f.lineStyle(2, 0x3a5aa0, 0.9)
  for (let i = 0; i < 6; i++) f.lineBetween(-20, -28 + i * 11, 20 - (i % 3) * 7, -28 + i * 11)
  f.fillStyle(0xe03030, 1)
  f.fillCircle(18, 26, 5)
  f.setScale(0.6 * k).setAlpha(0).setRotation(0)
  d.tw({ targets: f, alpha: 1, x: x + dir * 70 * k, y: y + 18 * k, scale: 1.1 * k, rotation: dir * 0.3, delay: 330, duration: 280, ease: 'Back.easeOut' })
  d.some(f, 720, 240)
  d.em(380, () => {
    d.estrela(x + dir * 70 * k, y + 18 * k, { cor: 0x9affb8, r: 28 * k, ms: 300 })
    d.txt(x, y - 94 * k, 'COPIADO!', { cor: '#9affb8', tam: 20, ms: 420, rot: 0.07 })
  })
  d.faiscas(x, y, { cor: 0x7aff9a, quantidade: 10, velocidade: 120 })
}

// Berdly: Ego Inabalável (♥): óculos reluzentes e estrelas douradas
function egoInabalavel(d) {
  const { x, y, k } = d
  const o = d.g(x, y - 6 * k)
  for (const lado of [-1, 1]) {
    o.fillStyle(0x151515, 1)
    o.fillCircle(lado * 27 * k, 0, 24 * k)
    o.fillStyle(0xbfe6ff, 0.9)
    o.fillCircle(lado * 27 * k, 0, 19 * k)
  }
  o.lineStyle(7 * k, 0x151515, 1)
  o.lineBetween(-7 * k, -3 * k, 7 * k, -3 * k)
  d.brotar(o, { ms: 640, de: 0.4, ate: 1, entrada: 200 })
  // o brilho que cruza as lentes
  const reluz = d.g(x - 70 * k, y - 6 * k).setBlendMode('ADD')
  reluz.fillStyle(0xffffff, 0.95)
  reluz.fillPoints([{ x: -4 * k, y: -28 * k }, { x: 10 * k, y: -28 * k }, { x: 2 * k, y: 28 * k }, { x: -12 * k, y: 28 * k }], true)
  reluz.setAlpha(0)
  d.tw({ targets: reluz, alpha: 1, x: x + 70 * k, delay: 260, duration: 380, ease: 'Sine.easeInOut' })
  d.some(reluz, 560, 160)
  d.estrela(x - 50 * k, y - 34 * k, { cor: 0xffffff, r: 26 * k, ms: 380, atraso: 520, fino: 0.18, contorno: 0xffd24a })
  d.estrela(x + 54 * k, y + 30 * k, { cor: 0xffe05a, r: 20 * k, ms: 360, atraso: 600, fino: 0.2 })
  d.anel(x, y, { cor: 0xffd24a, de: 20 * k, ate: 100 * k, ms: 460, atraso: 80 })
  d.txt(x, y + 68 * k, 'INABALÁVEL!', { cor: '#ffe05a', tam: 18, atraso: 200, ms: 520 })
  d.faiscas(x, y, { cor: 0xffd24a, quantidade: 14, velocidade: 150 })
}

// Asriel: Hiper Espelho (♠): um prisma arco-íris devolve a luz
function hiperEspelho(d) {
  const { x, y, k, dir } = d
  const w = 40 * k
  const h = 70 * k
  const p = d.g(x, y)
  const losango = [{ x: 0, y: -h }, { x: w, y: 0 }, { x: 0, y: h }, { x: -w, y: 0 }]
  p.fillStyle(0x151515, 1)
  p.fillPoints(losango.map((q) => ({ x: q.x * 1.12, y: q.y * 1.08 })), true)
  p.fillStyle(0xeaf6ff, 1)
  p.fillPoints(losango, true)
  // faixas de arco-íris dentro do prisma
  ARCO_IRIS.forEach((c, i) => {
    const y0 = lerp(-h, h, i / 6)
    const y1 = lerp(-h, h, (i + 1) / 6)
    const meia = (yy) => w * (1 - Math.abs(yy) / h)
    p.fillStyle(c, 0.85)
    p.fillPoints([{ x: -meia(y0) * 0.86, y: y0 }, { x: meia(y0) * 0.86, y: y0 }, { x: meia(y1) * 0.86, y: y1 }, { x: -meia(y1) * 0.86, y: y1 }], true)
  })
  p.fillStyle(0xffffff, 0.55)
  p.fillTriangle(-w * 0.55, -h * 0.1, -w * 0.2, -h * 0.55, -w * 0.05, -h * 0.1)
  d.brotar(p, { ms: 640, de: 0.2, ate: 1, entrada: 200 })
  // a luz devolvida em leque
  const luz = d.g(x, y).setBlendMode('ADD')
  ARCO_IRIS.forEach((c, i) => {
    const a = (dir > 0 ? 0 : PI) + (i - 2.5) * 0.14 * dir
    luz.lineStyle(7 * k, c, 0.9)
    luz.lineBetween(Math.cos(a) * 36 * k, Math.sin(a) * 36 * k, Math.cos(a) * 230 * k, Math.sin(a) * 230 * k)
  })
  luz.setAlpha(0)
  d.tw({ targets: luz, alpha: 1, scaleX: { from: 0.2, to: 1 }, delay: 200, duration: 220, ease: 'Cubic.easeOut' })
  d.some(luz, 520, 240)
  d.estrela(x, y, { cor: 0xffffff, r: 66 * k, ms: 460, atraso: 190, fino: 0.16, contorno: 0xff9a3a })
  d.anel(x, y, { cor: 0xa06bff, de: 20 * k, ate: 104 * k, ms: 440, atraso: 190 })
  d.txt(x, y - 92 * k, 'HIPER!', { cor: '#ffe9a0', tam: 24, rot: -0.08, ms: 480, atraso: 180 })
  d.faiscas(x, y, { cor: 0xffe05a, quantidade: 14, velocidade: 190 })
}

// Asriel: Apagar (♦): uma borracha arco-íris apaga a carta
function apagar(d) {
  const { x, y, k } = d
  const branco = d.ret(x, y, 100 * k, 144 * k, 0xffffff, 0)
  d.tw({ targets: branco, alpha: 0.7, delay: 120, duration: 360 })
  d.some(branco, 560, 260)
  const tira = d.g(x, y)
  const borracha = d.g(x, y)
  const w = 44
  borracha.fillStyle(0x151515, 1)
  borracha.fillRoundedRect(-w - 3, -17, w * 2 + 6, 34, 6)
  borracha.fillStyle(0xff9ac0, 1)
  borracha.fillRoundedRect(-w, -14, w * 2, 28, 4)
  ARCO_IRIS.forEach((c, i) => {
    borracha.fillStyle(c, 1)
    borracha.fillRect(-w + 12 + i * 12, -14, 12, 28)
  })
  borracha.fillStyle(0xffffff, 0.35)
  borracha.fillRect(-w, -14, w * 2, 5)
  borracha.setScale(k).setRotation(0.5)
  const ini = { x: x - 76 * k, y: y - 66 * k }
  const fim = { x: x + 76 * k, y: y + 66 * k }
  borracha.setAlpha(0)
  d.tw({ targets: borracha, alpha: 1, duration: 60 })
  const vai = (a, b, atraso) =>
    d.anim(190, (p) => {
      const px = lerp(a.x, b.x, p)
      const py = lerp(a.y, b.y, p)
      borracha.setPosition(px, py)
      tira.lineStyle(16 * k, ARCO_IRIS[Math.floor(p * 5.99)], 0.9)
      tira.lineBetween(a.x - x, a.y - y, px - x, py - y)
    }, { atraso, ease: 'Sine.easeInOut' })
  borracha.setPosition(ini.x, ini.y)
  vai(ini, fim, 40)
  vai(fim, { x: ini.x, y: ini.y + 30 * k }, 250)
  d.some(borracha, 520, 200)
  d.some(tira, 520, 260)
  for (let i = 0; i < 9; i++) {
    const m = d.ret(x + ((i * 31) % 80 - 40) * k, y + ((i * 17) % 100 - 50) * k, 5 * k, 5 * k, ARCO_IRIS[i % 6])
    d.tw({ targets: m, y: m.y + 36 * k, x: m.x + (((i * 7) % 20) - 10) * k, alpha: 0, rotation: 2, delay: 180 + i * 35, duration: 420, onComplete: () => d.rm(m) })
  }
  d.txt(x, y - 92 * k, 'APAGADO!', { cor: '#ffffff', tam: 20, rot: 0.07, ms: 460, atraso: 300 })
}

// Asriel: Salvar (♥): a estrela de SAVE
function salvar(d) {
  const { x, y, k } = d
  const col = d.g(x, y).setBlendMode('ADD')
  col.fillStyle(0xfff0a0, 0.35)
  col.fillRect(-26 * k, -190 * k, 52 * k, 380 * k)
  col.fillStyle(0xffffff, 0.45)
  col.fillRect(-9 * k, -190 * k, 18 * k, 380 * k)
  col.setAlpha(0)
  d.tw({ targets: col, alpha: 1, scaleX: { from: 0.1, to: 1 }, duration: 200, ease: 'Cubic.easeOut' })
  d.some(col, 420, 280)
  const e = d.g(x, y)
  e.fillStyle(0x151515, 1)
  e.fillPoints(pontasDe(4, 40 * k, 13 * k), true)
  e.fillStyle(0xffe84a, 1)
  e.fillPoints(pontasDe(4, 34 * k, 10 * k), true)
  e.fillStyle(0xffffff, 0.8)
  e.fillPoints(pontasDe(4, 16 * k, 5 * k), true)
  d.brotar(e, { ms: 560, de: 0.1, ate: 1, entrada: 240 })
  d.tw({ targets: e, rotation: PI, duration: 800, ease: 'Cubic.easeOut' })
  d.anel(x, y, { cor: 0xffe84a, de: 14 * k, ate: 102 * k, ms: 460, atraso: 120, larg: 5 })
  d.txt(x, y + 78 * k, 'SALVO!', { cor: '#fff0a0', tam: 24, atraso: 200, ms: 520 })
  d.faiscas(x, y, { cor: 0xfff0a0, quantidade: 16, velocidade: 150, vida: 700 })
}

// Asriel: Pegar Alma (♣): uma alma vermelha vem até a carta
function pegarAlma(d) {
  const { x, y, k, dir } = d
  const ini = { x: x + dir * 150 * k, y: y - 100 * k }
  const alma = d.g(ini.x, ini.y)
  coracao(alma, 0, 0, 27 * k, 0x151515)
  coracao(alma, 0, 0, 22 * k, 0xffffff)
  coracao(alma, 0, 0, 18 * k, 0xff2a3a)
  coracao(alma, -4 * k, -5 * k, 6 * k, 0xff9a9a, 0.8)
  alma.setAlpha(0)
  const trilha = d.g(0, 0).setBlendMode('ADD')
  const hist = []
  d.tw({ targets: alma, alpha: 1, duration: 80 })
  d.anim(440, (p) => {
    const t = p * p * (3 - 2 * p)
    const px = lerp(ini.x, x, t) + Math.sin(t * PI * 2) * 22 * k
    const py = lerp(ini.y, y, t) - Math.sin(t * PI) * 50 * k
    alma.setPosition(px, py).setScale(1 + Math.sin(p * PI * 6) * 0.08)
    hist.push({ x: px, y: py })
    if (hist.length > 10) hist.shift()
    trilha.clear()
    hist.forEach((h, i) => {
      trilha.fillStyle(0xff4a5a, (i + 1) / (hist.length + 1) * 0.6)
      trilha.fillCircle(h.x, h.y, (i + 1) * 1.6 * k)
    })
  })
  d.some(trilha, 420, 200)
  d.em(440, () => {
    d.tw({ targets: alma, scale: 1.6, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => d.rm(alma) })
    d.brilho(x, y, { cor: 0xff4a5a, r: 56 * k, ms: 400 })
    d.anel(x, y, { cor: 0xff6a7a, de: 14 * k, ate: 96 * k, ms: 400 })
    d.faiscas(x, y, { cor: 0xff4a5a, quantidade: 14, velocidade: 160 })
    d.txt(x, y - 88 * k, 'ALMA!', { cor: '#ff8a9a', tam: 22, ms: 420 })
  })
}

// ---------- a tabela ----------

const ef = (nome, rotulo, cor, fn) => ({ nome, rotulo, cor, fn })

export const EFEITOS_ASES = {
  kris: {
    espadas: ef('Reflexo da Lâmina', 'CLANG!', 0x7fd0ff, reflexoDaLamina),
    ouros: ef('Silêncio', '...', 0x9a7cff, silencio),
    paus: ef('Mão Leve', 'ZIP!', 0x4a7cff, (d) => entrega(d, { cor: 0x5a8aff, tipo: 'carta', corItem: 0x4a7cff, texto: 'ZIP!', corTxt: '#9fc0ff' })),
    copas: ef('Determinação', 'NÃO DESISTA!', 0xff4a4a, determinacao),
  },
  susie: {
    espadas: ef('Revide Selvagem', 'REVIDE!', 0xc46bff, revideSelvagem),
    ouros: ef('Grito', 'GRAAAH!', 0xff6aa8, grito),
    paus: ef('Roubar Lanche', 'NHAC!', 0xc46bff, (d) => entrega(d, { cor: 0xb86aff, tipo: 'lanche', texto: 'NHAC!', corTxt: '#e0a0ff' })),
    copas: ef('Teimosia', 'HMPF!', 0xe040a0, teimosia),
  },
  ralsei: {
    espadas: ef('Lição Invertida', 'AO CONTRÁRIO!', 0x5fe08a, licaoInvertida),
    ouros: ef('Pacifismo', 'PAZ!', 0xd8ffe8, pacifismo),
    paus: ef('Empréstimo Educado', 'COM LICENÇA!', 0x5fe08a, (d) => entrega(d, { cor: 0x6ee89a, tipo: 'carta', corItem: 0x2f9a5a, texto: 'COM LICENÇA!', corTxt: '#9affb8', educado: true })),
    copas: ef('Abraço Fofo', 'NHÉ~', 0xff9acb, abracoFofo),
  },
  noelle: {
    espadas: ef('Espelho de Gelo', 'CRAC!', 0x7ad0ff, espelhoDeGelo),
    ouros: ef('Congelar', 'BRRR!', 0xa8e8ff, congelar),
    paus: ef('Mão Fria', 'GELADO!', 0xa8e8ff, (d) => entrega(d, { cor: 0xbdeeff, tipo: 'carta', corItem: 0x7ad0ff, texto: 'GELADO!', corTxt: '#c8f0ff', faisca: 0xc8f0ff })),
    copas: ef('Milagre de Natal', 'MILAGRE!', 0xffe05a, milagreDeNatal),
  },
  berdly: {
    espadas: ef('Réplica Brilhante', 'RÉPLICA!', 0x7ac8ff, replicaBrilhante),
    ouros: ef('Objeção!', 'OBJEÇÃO!', 0xe02020, objecao),
    paus: ef('Cópia da Prova', 'COPIADO!', 0x7aff9a, copiaDaProva),
    copas: ef('Ego Inabalável', 'INABALÁVEL!', 0xffd24a, egoInabalavel),
  },
  dess: {
    espadas: ef('Rebatida', 'TOC!', 0xffd24a, rebatida),
    ouros: ef('Corta o Som', 'ZZT!', 0xffe05a, cortaOSom),
    paus: ef('Pegou Emprestado', 'EMPRESTADO!', 0xff8a4a, (d) => entrega(d, { cor: 0xff9a5a, tipo: 'palheta', corItem: 0xffd24a, texto: 'EMPRESTADO!', corTxt: '#ffc08a', faisca: 0xffd24a })),
    copas: ef('Bis!', 'BIS!', 0xff8a4a, bis),
  },
  asriel: {
    espadas: ef('Hiper Espelho', 'HIPER!', 0xa06bff, hiperEspelho),
    ouros: ef('Apagar', 'APAGADO!', 0xffffff, apagar),
    paus: ef('Pegar Alma', 'ALMA!', 0xff4a5a, pegarAlma),
    copas: ef('Salvar', 'SALVO!', 0xffe84a, salvar),
  },
}

// o que vale se um dia faltar a entrada de alguém: um anel e o nome do especial
const GENERICO = ef('Especial', '!', 0xfff0a8, (d) => {
  d.anel(d.x, d.y, { cor: 0xfff0a8, de: 14 * d.k, ate: 90 * d.k, ms: 380 })
  d.faiscas(d.x, d.y, { cor: 0xfff0a8, quantidade: 14, velocidade: 160 })
})

export const efeitoDoAs = (personagem, naipe) => EFEITOS_ASES[personagem]?.[naipe] ?? GENERICO

// encerra na hora tudo o que os disparos da cena ainda têm na tela (trocar de página da galeria, p. ex.)
export function limparEfeitosAs(cena) {
  for (const d of [...(ativos.get(cena) ?? [])]) d.fim()
}

// a jogada resolvida (regras.js: { carta, especial, anulada, passou }) -> o Ás que valeu, ou null
export function asDaJogada(jogada) {
  const c = jogada?.carta
  if (!c || jogada.passou || jogada.anulada || c.valor !== 1 || !jogada.especial) return null
  return { personagem: c.personagem, naipe: c.naipe }
}

// versão parada (reduzir animações): só o rótulo e um anel, sem movimento nem faíscas
function versaoCalma(d, e) {
  const { x, y, k } = d
  const g = d.g(x, y)
  g.lineStyle(3, e.cor, 0.8)
  g.strokeCircle(0, 0, 60 * k)
  g.setAlpha(0)
  d.tw({ targets: g, alpha: 1, duration: 160 })
  d.some(g, 520, 200)
  d.txt(x, y - 84 * k, e.rotulo, { cor: hex(e.cor), tam: 18, ms: 520, pop: false })
}

// Dispara o efeito do Ás e esquece: não devolve nada, não espera nada e NUNCA lança.
export function tocarEfeitoAs(cena, personagem, naipe, { x, y, dir = 1, alvo = null, escala = 1 } = {}) {
  try {
    if (!cena?.add || !cena.tweens || !Number.isFinite(x) || !Number.isFinite(y)) return false
    const e = efeitoDoAs(personagem, naipe)
    const d = criar(cena, { x, y, dir, alvo, escala: Math.min(1.3, Math.max(0.5, Number.isFinite(escala) ? escala : 1)) })
    registrar(cena, d)
    d.em(DURACAO_MAX, () => d.fim())
    // o disparo também se encerra sozinho se algo falhar no meio
    try {
      if (d.calmo) versaoCalma(d, e)
      else e.fn(d)
    } catch {
      d.fim()
    }
    return true
  } catch {
    return false
  }
}

// escala do efeito para uma carta na mesa (a da arena 1x1 tem ~101 px de largura = 1)
export const escalaDaCarta = (carta) => {
  const l = (carta?.largura ?? 70) * (carta?.scaleX ?? 1)
  return Number.isFinite(l) && l > 0 ? l / 101 : 1
}

// Na REVELAÇÃO: o Ás que valeu (se for um) ganha o efeito em cima da carta. O ♦ Anular mostra o efeito na carta
// que ele cortou (alvoCarta), o resto na própria carta. adiar = o ♠ vai devolver um ataque logo mais: o efeito
// dele toca na devolução (efeitoDoReflexo), não aqui. Nunca lança.
export function efeitoDoEspecial(cena, jogada, carta, { dir = 1, alvoCarta = null, adiar = false } = {}) {
  try {
    const as = asDaJogada(jogada)
    if (!as || !carta?.scene || (adiar && as.naipe === 'espadas')) return false
    const foco = as.naipe === 'ouros' && alvoCarta?.scene ? alvoCarta : carta
    return tocarEfeitoAs(cena, as.personagem, as.naipe, { x: foco.x, y: foco.y, dir, escala: escalaDaCarta(foco) })
  } catch {
    return false
  }
}

// Na DEVOLUÇÃO de um ataque: o efeito do ♠ do dono do espelho (a jogada dele) em { x, y }, rebatendo para `alvo`
export function efeitoDoReflexo(cena, jogada, onde, { dir = 1, alvo = null, escala = 1 } = {}) {
  try {
    const as = asDaJogada(jogada)
    if (!as || as.naipe !== 'espadas' || !onde) return false
    return tocarEfeitoAs(cena, as.personagem, 'espadas', { x: onde.x, y: onde.y, dir, alvo, escala })
  } catch {
    return false
  }
}
