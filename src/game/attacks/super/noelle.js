import { definirAtaque } from '../definir.js'
import { ATAQUE, FONTE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { particulas } from '../../effects/particulas.js'

// SUPER de Noelle: SNOWGRAVE. O frio cresce até o mundo inteiro congelar, em
// quatro atos que escalam (a caixa escurece, a geada sobe pelas bordas e a
// neve de fundo segue o vento de cada ato):
//
//   I. O frio. Começa a nevar: flocos entram pela borda de onde vem o vento
//      (direção sorteada, muda no meio do ato), balançando, e parte deles cai
//      em cima do coração. A neve engrossa com o tempo. FLOCOS GIGANTES
//      atravessam a caixa na direção do coração, param, racham e estouram em
//      estilhaços.
//   II. Nevasca. O vento vira de lado (lado sorteado) e uiva: RAJADAS de
//      estilhaços entram por aquele lado, espalhadas (altura, atraso e
//      velocidade sorteados), com uma brecha que nunca é onde o coração está.
//      Uma vez no meio o vento inverte. Um floco gigante volta.
//   III. Redemoinho. (depois da calmaria do meio) O vento começa a girar em
//      volta de um OLHO de gelo (o selo) que persegue o coração devagar. Anéis
//      de flocos entram por todas as bordas e espiralam para o olho, cada vez
//      mais rápido perto dele; flocos mirados continuam vindo de fora. PILARES
//      de gelo brotam do chão, do teto ou das paredes na linha do coração.
//   IV. SNOWGRAVE. O nome cai letra a letra, o redemoinho para e todo o frio é
//      sugado para onde o coração está: um TÚMULO de estilhaços entra por
//      todas as bordas e se fecha naquele ponto. Quando se fecha, o pilar de
//      luz explode e os estilhaços voam de volta para todo lado.
//
// Nada decorável: direção do vento e quando ele muda, lados das rajadas e
// brechas, de onde vêm os flocos gigantes, onde nasce o olho e para que lado
// ele gira, ângulo dos anéis, lado e hora dos pilares, quantas lascas tem o
// túmulo e onde fica a brecha dele: tudo sorteado com a semente do ataque.
//
// Justiça (nenhum projétil nasce dentro da caixa: todos entram pela borda):
//   - flocos e estilhaços são pequenos e espaçados; a rajada sempre deixa uma
//     brecha >= `folgaRajada` (validada como parede) longe do coração;
//   - o floco gigante PARA e racha `avisoEstouro` ms antes de estourar, e só
//     estoura a >= `estouroFlocao` px do coração (estilhaços a mais que a
//     lacuna mínima um do outro nessa distância);
//   - entre dois flocos de um anel do redemoinho sobra mais que a lacuna a
//     partir de `raioLivre` px do olho; o olho (que machuca) anda devagar;
//   - o pilar mostra a PONTA na borda por `avisoPilar` ms antes de subir
//     (aviso >= telegrafoMs) e ocupa só uma faixa de `larguraPilar` px;
//   - o túmulo leva `convergir` ms para se fechar, tem uma lasca a menos (a
//     brecha) e a explosão nasce no ponto onde ele se fechou.
//
// Config:
//   neve, velocidadeNeve, mirarNeve       a neve (intervalo e velocidade: [começo, fim] do ato I)
//   flocoes                               janelas [de, até] (ms) em que entra um floco gigante
//   velocidadeFlocao, estouroFlocao, avisoEstouro, estilhacosFlocao, velocidadeEstilhaco
//   nevasca                               quando começa o ato II
//   rajada, estilhacosRajada, velocidadeRajada, folgaRajada   as rajadas ([começo, fim] do ato II)
//   redemoinho                            quando começa o ato III
//   anel, flocosAnel, queda, giro, raioLivre, perseguir, mirados   o redemoinho
//                                         (giro = "momento angular": giro / r² rad/s)
//   pilares, avisoPilar, larguraPilar, manterPilar   os pilares (ms aproximados de cada um)
//   snowgrave, convergir, lascasTumulo, explosao, velocidadeExplosao   o ato IV
const TAU = Math.PI * 2

export default definirAtaque({
  nome: 'superNoelle',
  padrao: {
    duracao: 9000,
    neve: [280, 140],
    velocidadeNeve: [70, 105],
    mirarNeve: 0.45,
    flocoes: [
      [450, 900],
      [1500, 2000],
      [3200, 3700],
    ],
    velocidadeFlocao: 64,
    estouroFlocao: 66,
    avisoEstouro: 300,
    estilhacosFlocao: 6,
    velocidadeEstilhaco: 150,
    nevasca: 2600,
    rajada: [530, 400],
    estilhacosRajada: [4, 6],
    velocidadeRajada: [165, 215],
    folgaRajada: 58,
    redemoinho: 4500,
    anel: [800, 600],
    flocosAnel: 6,
    queda: 62,
    giro: 5400,
    raioLivre: 56,
    perseguir: 24,
    mirados: 560,
    pilares: [5500, 6150, 6700],
    avisoPilar: 460,
    larguraPilar: 30,
    manterPilar: 360,
    snowgrave: 7150,
    convergir: 1150,
    lascasTumulo: [8, 9],
    explosao: 8,
    velocidadeExplosao: 175,
  },
  iniciar(a, cfg) {
    garantirTexturas(a.cena)
    const estado = {
      ativo: 0, // tempo ativo (para nas pausas de respiro, como os timers)
      fase: 'frio',
      vento: a.aleatorio(Math.PI / 2 - 0.55, Math.PI / 2 + 0.55), // direção em que a neve voa
      lado: 1,
      olho: null,
      tumulo: null,
    }
    estado.cenario = montarCenario(a, cfg, estado)
    tocar(a.cena, 'snowgraveFrio')
    a.aoAtualizar((dt) => {
      estado.ativo += dt
      andarCenario(a, cfg, estado, dt)
    })

    // ---------- I. o frio ----------
    nevar(a, cfg, estado)
    // o vento vira no meio do ato
    a.depois(a.aleatorio(1100, 1600), () => (estado.vento = a.aleatorio(Math.PI / 2 - 0.6, Math.PI / 2 + 0.6)))
    for (const [de, ate] of cfg.flocoes) a.depois(a.aleatorio(de, ate), () => flocao(a, cfg, estado))

    // ---------- II. nevasca ----------
    a.depois(cfg.nevasca, () => nevasca(a, cfg, estado))

    // ---------- III. redemoinho ----------
    a.depois(cfg.redemoinho, () => redemoinho(a, cfg, estado))
    for (const ms of cfg.pilares) a.depois(ms + a.aleatorio(-90, 90), () => estado.fase === 'redemoinho' && pilar(a, cfg))

    // ---------- IV. SNOWGRAVE ----------
    a.depois(cfg.snowgrave, () => snowgrave(a, cfg, estado))
  },
})

// ---------- texturas (geradas uma vez; o selo e o floco também servem à cinemática e ao CO-OP) ----------

export function garantirTexturas(cena) {
  if (cena.textures.exists('super-noelle-floco')) return
  const g = cena.make.graphics({ x: 0, y: 0 }, false)
  const desenharFloco = (cx, cy, r, espessura) => {
    g.lineStyle(espessura, 0xffffff, 1)
    for (let b = 0; b < 6; b++) {
      const ang = (b * Math.PI) / 3
      const ex = cx + Math.cos(ang) * r
      const ey = cy + Math.sin(ang) * r
      g.lineBetween(cx, cy, ex, ey)
      const mx = cx + Math.cos(ang) * r * 0.55
      const my = cy + Math.sin(ang) * r * 0.55
      g.lineBetween(mx, my, mx + Math.cos(ang + 0.75) * r * 0.38, my + Math.sin(ang + 0.75) * r * 0.38)
      g.lineBetween(mx, my, mx + Math.cos(ang - 0.75) * r * 0.38, my + Math.sin(ang - 0.75) * r * 0.38)
    }
    g.fillStyle(0xffffff, 1).fillCircle(cx, cy, espessura)
  }
  desenharFloco(8, 8, 7, 1.6)
  g.generateTexture('super-noelle-floco', 16, 16)
  g.clear()
  desenharFloco(64, 64, 60, 3)
  g.generateTexture('super-noelle-selo', 128, 128)
  g.destroy()
}

// ---------- utilitários ----------

const limitar = (v, min, max) => Math.max(min, Math.min(max, v))
const lerp = (a, b, t) => a + (b - a) * limitar(t, 0, 1)

// Ponto FORA da caixa de onde uma bala que anda na direção (dx, dy) passa por
// (x, y): volta pela direção até sair da caixa e anda mais `margem` px.
function deFora(l, x, y, dx, dy, margem) {
  const n = Math.hypot(dx, dy) || 1
  const ux = dx / n
  const uy = dy / n
  const tx = ux > 0 ? (x - l.left) / ux : ux < 0 ? (x - l.right) / ux : Infinity
  const ty = uy > 0 ? (y - l.top) / uy : uy < 0 ? (y - l.bottom) / uy : Infinity
  const t = Math.max(0, Math.min(tx, ty)) + margem
  return { x: x - ux * t, y: y - uy * t }
}

// coração ativo mais perto de (x, y)
function maisPerto(a, x, y) {
  let melhor = null
  let d = Infinity
  for (const c of a.coracoes) {
    if (!c.ativo) continue
    const dc = Math.hypot(c.x - x, c.y - y)
    if (dc < d) {
      d = dc
      melhor = c
    }
  }
  return { c: melhor, d }
}

// bala que some aos poucos nos últimos `ms` de vida (já sem machucar)
function sumirNoFim(ms) {
  return (bala) => {
    if (bala.vida < ms) {
      bala.inofensiva = true
      bala.sprite.setAlpha(Math.max(0, bala.vida / ms))
    }
  }
}

// intervalo respeitando a densidade do ritmo (como a.aCada)
const ritmo = (a, ms) => ms / (a.ritmo?.densidade ?? 1)

// ---------- cenário: o mundo congelando ----------

function montarCenario(a, cfg, estado) {
  const l = a.caixa
  const cena = a.cena
  // frio: azul de noite por baixo de tudo, cada vez mais fundo
  const frio = a.decoracao(cena.add.rectangle(l.centerX, l.centerY, l.width, l.height, 0x081f45).setDepth(1).setAlpha(0))
  // branco da nevasca (ato II)
  const branco = a.decoracao(cena.add.rectangle(l.centerX, l.centerY, l.width, l.height, 0xeaf7ff).setDepth(3).setAlpha(0))
  // geada: espinhos de gelo crescendo das bordas para dentro (sorteados uma vez)
  const geada = a.decoracao(cena.add.graphics().setDepth(3))
  const espinhos = []
  for (const lado of ['cima', 'baixo', 'esquerda', 'direita']) {
    const comprimento = lado === 'cima' || lado === 'baixo' ? l.width : l.height
    for (let p = a.aleatorio(0, 6); p < comprimento; p += a.aleatorio(7, 13)) espinhos.push({ lado, p, base: a.aleatorio(5, 10), alto: a.aleatorio(0.35, 1) })
  }
  // neve de fundo (sem colisão): segue o vento, o redemoinho e, no fim, o túmulo
  const flocos = []
  for (let i = 0; i < 46; i++) {
    const f = a.decoracao(
      cena.add
        .image(a.aleatorio(l.left, l.right), a.aleatorio(l.top, l.bottom), i % 5 ? 'faisca' : 'super-noelle-floco')
        .setDepth(2)
        .setTint(0xdff6ff)
        .setAlpha(0)
        .setScale(i % 5 ? a.aleatorio(0.25, 0.6) : a.aleatorio(0.35, 0.6)),
    )
    flocos.push({ f, rapidez: a.aleatorio(0.55, 1.35), fase: a.aleatorio(0, TAU), alfa: a.aleatorio(0.25, 0.6) })
  }
  // o olho do redemoinho: o selo de gelo (aparece no ato III)
  const selo = a.decoracao(cena.add.image(l.centerX, l.centerY, 'super-noelle-selo').setDepth(2).setTint(0xbfe8ff).setAlpha(0).setScale(0.1))
  return { frio, branco, geada, espinhos, flocos, selo, giroSelo: 0, redesenho: 0 }
}

function andarCenario(a, cfg, estado, dt) {
  const l = a.caixa
  const c = estado.cenario
  const s = dt / 1000
  // o frio cresce o ataque todo: veu mais escuro e geada mais alta
  const frio = Math.min(1, estado.ativo / cfg.duracao)
  c.frio.setAlpha(0.18 + 0.55 * frio)
  for (const r of [c.frio, c.branco]) r.setPosition(l.centerX, l.centerY).setSize(l.width, l.height) // a caixa pode mexer
  c.redesenho -= dt
  if (c.redesenho <= 0) {
    c.redesenho = 70
    const alto = 4 + 18 * frio ** 0.8
    c.geada.clear().fillStyle(0xdff6ff, 0.3 + 0.25 * frio)
    for (const e of c.espinhos) {
      const h = alto * e.alto
      if (e.lado === 'cima') c.geada.fillTriangle(l.left + e.p - e.base / 2, l.top, l.left + e.p + e.base / 2, l.top, l.left + e.p, l.top + h)
      else if (e.lado === 'baixo') c.geada.fillTriangle(l.left + e.p - e.base / 2, l.bottom, l.left + e.p + e.base / 2, l.bottom, l.left + e.p, l.bottom - h)
      else if (e.lado === 'esquerda') c.geada.fillTriangle(l.left, l.top + e.p - e.base / 2, l.left, l.top + e.p + e.base / 2, l.left + h, l.top + e.p)
      else c.geada.fillTriangle(l.right, l.top + e.p - e.base / 2, l.right, l.top + e.p + e.base / 2, l.right - h, l.top + e.p)
    }
    c.geada.lineStyle(2 + 3 * frio, 0xeaf7ff, 0.35 + 0.4 * frio).strokeRect(l.left + 1, l.top + 1, l.width - 2, l.height - 2)
  }
  // o selo gira (mais rápido no SNOWGRAVE)
  c.giroSelo += (estado.olho?.sentido ?? 1) * s * (estado.fase === 'snowgrave' ? 4 : 1.4)
  c.selo.setRotation(c.giroSelo)
  if (estado.olho) c.selo.setPosition(estado.olho.x, estado.olho.y)

  // neve de fundo
  const forca = estado.fase === 'frio' ? 40 + 40 * frio : estado.fase === 'nevasca' ? 150 : 90
  for (const n of c.flocos) {
    const f = n.f
    f.setAlpha(Math.min(n.alfa, f.alpha + s))
    let vx
    let vy
    const alvo = estado.tumulo ?? estado.olho
    if (alvo && estado.fase !== 'frio' && estado.fase !== 'nevasca') {
      // girando em volta do olho / sugada pelo túmulo
      const dx = f.x - alvo.x
      const dy = f.y - alvo.y
      const r = Math.max(8, Math.hypot(dx, dy))
      const sugar = estado.tumulo ? 220 : 45
      const girar = estado.tumulo ? 60 : Math.min(260, 6000 / r)
      const sentido = estado.olho?.sentido ?? 1
      vx = (-dy / r) * girar * sentido - (dx / r) * sugar
      vy = (dx / r) * girar * sentido - (dy / r) * sugar
      if (r < 10) recolocar(a, f)
    } else {
      vx = Math.cos(estado.vento) * forca + Math.cos(estado.ativo / 300 + n.fase) * 14
      vy = Math.sin(estado.vento) * forca + Math.sin(estado.ativo / 420 + n.fase) * 6
    }
    f.x += vx * n.rapidez * s
    f.y += vy * n.rapidez * s
    f.rotation += s * n.rapidez
    // saiu da caixa: volta pelo lado de onde vem o vento
    if (f.x < l.left - 6) f.x = l.right + 4
    else if (f.x > l.right + 6) f.x = l.left - 4
    if (f.y < l.top - 6) f.y = l.bottom + 4
    else if (f.y > l.bottom + 6) f.y = l.top - 4
  }
}

function recolocar(a, f) {
  const l = a.caixa
  const lado = Math.floor(Math.random() * 4) // só visual: não gasta a semente
  const p = Math.random()
  f.x = lado < 2 ? l.left + p * l.width : lado === 2 ? l.left : l.right
  f.y = lado < 2 ? (lado === 0 ? l.top : l.bottom) : l.top + p * l.height
}

// ---------- I. o frio: a neve ----------

function nevar(a, cfg, estado) {
  const fimFrio = cfg.redemoinho // a neve linear acompanha os atos I e II
  const proximo = () => {
    if (estado.ativo >= fimFrio || estado.fase === 'redemoinho') return
    const t = estado.ativo / cfg.nevasca
    const mirado = a.aleatorio(0, 1) < cfg.mirarNeve
    floco(a, estado, mirado, lerp(cfg.velocidadeNeve[0], cfg.velocidadeNeve[1], t))
    const intervalo = estado.fase === 'nevasca' ? cfg.neve[0] : lerp(cfg.neve[0], cfg.neve[1], t)
    a.depois(ritmo(a, intervalo * a.aleatorio(0.75, 1.25)), proximo)
  }
  a.depois(250, proximo)
}

// Um floco de neve que entra pela borda de onde vem o vento, balançando.
function floco(a, estado, mirado, velocidade) {
  const l = a.caixa
  const ang = estado.vento + a.aleatorio(-0.22, 0.22)
  const dx = Math.cos(ang)
  const dy = Math.sin(ang)
  const alvo = mirado ? a.alvo() : { x: a.aleatorio(l.left + 6, l.right - 6), y: a.aleatorio(l.top + 6, l.bottom - 6) }
  const p = deFora(l, alvo.x, alvo.y, dx, dy, a.aleatorio(10, 34))
  const v = velocidade * a.aleatorio(0.88, 1.15)
  const fase = a.aleatorio(0, TAU)
  const balanco = a.aleatorio(14, 28)
  a.bala({
    x: p.x,
    y: p.y,
    vx: dx * v,
    vy: dy * v,
    raio: 5,
    textura: 'super-noelle-floco',
    tamanho: 14,
    cor: mirado ? 0xffffff : 0xdff6ff,
    girar: a.aleatorio(-3, 3),
    jaAvisada: true,
    // balança de leve na perpendicular do vento
    atualizar: (b, dt) => {
      const o = Math.cos((b.idade / 1000) * 3.2 + fase) * balanco * (dt / 1000)
      b.x -= dy * o
      b.y += dx * o
    },
  })
}

// ---------- floco gigante ----------

function flocao(a, cfg, estado) {
  if (estado.fase === 'redemoinho' || estado.fase === 'snowgrave') return
  const l = a.caixa
  const alvo = a.alvo()
  // entra por um lado sorteado e atravessa a caixa passando pelo coração
  const ang = a.aleatorio(0, TAU)
  const dx = Math.cos(ang)
  const dy = Math.sin(ang)
  const p = deFora(l, alvo.x, alvo.y, dx, dy, 24)
  const v = cfg.velocidadeFlocao * a.aleatorio(0.9, 1.15)
  const giro = a.escolher([-1.5, 1.5])
  const base = a.aleatorio(0, TAU) // rotação do estouro
  const n = cfg.estilhacosFlocao
  // a `estouroFlocao` px do centro, dois estilhaços vizinhos ficam a mais que a lacuna
  a.lacuna((TAU * cfg.estouroFlocao) / n - 6, 'entre os estilhaços do floco gigante')
  let dentro = 0
  let rachando = -1
  tocar(a.cena, 'super-noelle-tique')
  a.bala({
    x: p.x,
    y: p.y,
    vx: dx * v,
    vy: dy * v,
    raio: 12,
    textura: 'super-noelle-flocao',
    tamanho: 38,
    girar: giro,
    pulso: 0.04,
    jaAvisada: true,
    atravessa: true,
    atualizar: (b, dt) => {
      const lc = a.caixa
      const m = 16
      const estaDentro = b.x > lc.left + m && b.x < lc.right - m && b.y > lc.top + m && b.y < lc.bottom - m
      if (rachando < 0) {
        if (!estaDentro && dentro === 0) return
        dentro += dt
        const { d } = maisPerto(a, b.x, b.y)
        // para perto do coração (mas não em cima), quando vai sair ou depois de um tempo
        if (d < cfg.estouroFlocao + 14 || !estaDentro || dentro > 1500) {
          rachando = 0
          b.vx = 0
          b.vy = 0
          b.girar = giro * 5
          b.sprite.setTint(0xffffff)
          tocar(a.cena, 'super-noelle-quebra')
        }
        return
      }
      // rachando: treme e pisca (o aviso), depois estoura
      rachando += dt
      b.x += Math.sin(rachando * 0.9) * 0.6
      b.sprite.setTint(Math.floor(rachando / 60) % 2 ? 0xffffff : 0x7fc8ff)
      if (rachando >= Math.max(ATAQUE.telegrafoMs * 0.5, cfg.avisoEstouro)) {
        b.morta = true
        estourar(a, b.x, b.y, n, base, cfg.velocidadeEstilhaco, 'super-noelle-estilhaco')
        tocar(a.cena, 'super-noelle-cristal')
        a.tremer(140, 0.006)
        particulas(a.cena, b.x, b.y, { cor: 0xeaf7ff, quantidade: 14, velocidade: 160, vida: 420 })
      }
    },
  })
}

// estilhaços em todas as direções a partir de (x, y)
function estourar(a, x, y, n, base, velocidade, textura, vida = Infinity) {
  for (let k = 0; k < n; k++) {
    const ang = base + (k * TAU) / n
    a.bala({
      x: x + Math.cos(ang) * 10,
      y: y + Math.sin(ang) * 10,
      vx: Math.cos(ang) * velocidade,
      vy: Math.sin(ang) * velocidade,
      comprimento: 15,
      espessura: 5,
      angulo: ang,
      textura,
      tamanho: 20,
      jaAvisada: true,
      vida,
      pulso: 0,
      atualizar: vida < Infinity ? sumirNoFim(160) : undefined,
    })
  }
}

// ---------- II. nevasca ----------

function nevasca(a, cfg, estado) {
  estado.fase = 'nevasca'
  estado.lado = a.escolher([-1, 1])
  ventoDoLado(a, estado)
  tocar(a.cena, 'super-noelle-nevasca')
  a.tremer(220, 0.006)
  a.cena.tweens.add({ targets: estado.cenario.branco, alpha: 0.2, duration: 500 })
  a.lacuna(cfg.folgaRajada, 'brecha da rajada de estilhaços')

  const fim = cfg.redemoinho - 250
  const inverteEm = a.aleatorio(cfg.nevasca + 600, fim - 700)
  let invertido = false
  const proxima = () => {
    if (estado.ativo >= fim) {
      a.cena.tweens.add({ targets: estado.cenario.branco, alpha: 0.06, duration: 400 })
      return
    }
    // o vento inverte uma vez (com um respiro curto antes da 1ª rajada do outro lado)
    if (!invertido && estado.ativo >= inverteEm) {
      invertido = true
      estado.lado *= -1
      ventoDoLado(a, estado)
      tocar(a.cena, 'super-noelle-vento')
      a.depois(320, proxima)
      return
    }
    rajada(a, cfg, estado)
    const t = (estado.ativo - cfg.nevasca) / (fim - cfg.nevasca)
    a.depois(ritmo(a, lerp(cfg.rajada[0], cfg.rajada[1], t) * a.aleatorio(0.85, 1.15)), proxima)
  }
  a.depois(200, proxima)
}

function ventoDoLado(a, estado) {
  // quase horizontal, um pouco para baixo
  estado.vento = estado.lado > 0 ? a.aleatorio(0.05, 0.4) : Math.PI - a.aleatorio(0.05, 0.4)
}

// Uma rajada de estilhaços entrando pelo lado do vento, com uma brecha longe do coração
function rajada(a, cfg, estado) {
  const l = a.caixa
  const lado = estado.lado
  const alvo = a.alvo()
  const meia = cfg.folgaRajada / 2
  // a brecha: sorteada, mas nunca em cima do coração
  let brecha = a.aleatorio(l.top + meia, l.bottom - meia)
  for (let t = 0; t < 8 && Math.abs(brecha - alvo.y) < meia + 10; t++) brecha = a.aleatorio(l.top + meia, l.bottom - meia)
  const n = a.inteiro(cfg.estilhacosRajada[0], cfg.estilhacosRajada[1])
  const ys = []
  // um vem na altura do coração (se não cair na brecha)
  if (Math.abs(alvo.y - brecha) >= meia + 6) ys.push(limitar(alvo.y + a.aleatorio(-6, 6), l.top + 5, l.bottom - 5))
  for (let t = 0; ys.length < n && t < 40; t++) {
    const y = a.aleatorio(l.top + 5, l.bottom - 5)
    if (Math.abs(y - brecha) < meia + 6) continue
    if (ys.some((o) => Math.abs(o - y) < 15)) continue
    ys.push(y)
  }
  a.parede({ eixo: 'y', ocupados: ys.map((y) => [y - 6, y + 6]) })
  for (const y of ys) {
    const v = a.aleatorio(cfg.velocidadeRajada[0], cfg.velocidadeRajada[1])
    const atraso = a.aleatorio(8, 52) // espalhados: rajada, não parede
    a.bala({
      x: lado > 0 ? l.left - atraso : l.right + atraso,
      y,
      vx: lado * v,
      vy: a.aleatorio(-8, 14),
      comprimento: 16,
      espessura: 5,
      angulo: lado > 0 ? 0 : Math.PI,
      textura: 'super-noelle-estilhaco',
      tamanho: 20,
      jaAvisada: true,
      pulso: 0,
    })
  }
  tocar(a.cena, 'super-noelle-tique')
}

// ---------- III. redemoinho ----------

function redemoinho(a, cfg, estado) {
  const l = a.caixa
  estado.fase = 'redemoinho'
  estado.olho = { x: l.centerX + a.aleatorio(-34, 34), y: l.centerY + a.aleatorio(-22, 22), sentido: a.escolher([-1, 1]) }
  tocar(a.cena, 'super-noelle-redemoinho')
  a.tremer(200, 0.005)
  const olho = estado.olho
  const selo = estado.cenario.selo.setPosition(olho.x, olho.y)
  a.cena.tweens.add({ targets: selo, alpha: 0.6, scale: 0.5, duration: 700, ease: 'Back.easeOut' })
  // a partir de `raioLivre` px do olho, dois flocos vizinhos do anel ficam a mais que a lacuna
  a.lacuna((TAU * cfg.raioLivre) / cfg.flocosAnel - 10, 'entre os flocos do redemoinho')

  // o núcleo do olho machuca (pisca antes, como toda bala)
  const nucleo = a.bala({ x: olho.x, y: olho.y, raio: 11, textura: 'super-noelle-flocao', tamanho: 30, cor: 0xbfe8ff, girar: olho.sentido * 3, atravessa: true, pulso: 0.1, aviso: 500 })

  // o olho persegue o coração devagar (nunca colado nas bordas)
  a.aoAtualizar((dt) => {
    if (estado.fase !== 'redemoinho') return
    const lc = a.caixa
    const { c } = maisPerto(a, olho.x, olho.y)
    if (c) {
      const dx = c.x - olho.x
      const dy = c.y - olho.y
      const d = Math.hypot(dx, dy)
      if (d > 1) {
        const passo = Math.min(d, cfg.perseguir * (dt / 1000))
        olho.x += (dx / d) * passo
        olho.y += (dy / d) * passo
      }
    }
    const m = 46
    olho.x = limitar(olho.x, lc.left + m, lc.right - m)
    olho.y = limitar(olho.y, lc.top + m, lc.bottom - m)
    nucleo.x = olho.x
    nucleo.y = olho.y
    if (nucleo.idade < nucleo.aviso) nucleo.sprite.setPosition(olho.x, olho.y)
  })
  estado.nucleo = nucleo

  // anéis de flocos entrando por todas as bordas
  const inicio = estado.ativo
  const fim = cfg.snowgrave
  const proximo = () => {
    if (estado.fase !== 'redemoinho') return
    anel(a, cfg, estado)
    const t = (estado.ativo - inicio) / (fim - inicio)
    a.depois(ritmo(a, lerp(cfg.anel[0], cfg.anel[1], t) * a.aleatorio(0.9, 1.1)), proximo)
  }
  a.depois(250, proximo)
  // flocos mirados de fora: ninguém fica parado longe do olho
  const mirar = () => {
    if (estado.fase !== 'redemoinho') return
    const alvo = a.alvo()
    const ang = a.aleatorio(0, TAU)
    const p = deFora(a.caixa, alvo.x, alvo.y, Math.cos(ang), Math.sin(ang), a.aleatorio(10, 30))
    const v = a.aleatorio(110, 135)
    a.bala({ x: p.x, y: p.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, raio: 5, textura: 'super-noelle-floco', tamanho: 14, cor: 0xffffff, girar: 4, jaAvisada: true })
    a.depois(ritmo(a, cfg.mirados * a.aleatorio(0.8, 1.2)), mirar)
  }
  a.depois(600, mirar)
}

// Um anel de flocos: cada um entra pela borda (na direção dele a partir do olho)
// e espirala para o olho, girando mais rápido quanto mais perto
function anel(a, cfg, estado) {
  const l = a.caixa
  const olho = estado.olho
  const base = a.aleatorio(0, TAU)
  const n = cfg.flocosAnel
  for (let k = 0; k < n; k++) {
    const th0 = base + (k * TAU) / n
    const p = deFora(l, olho.x, olho.y, -Math.cos(th0), -Math.sin(th0), 12)
    const b = a.bala({
      x: p.x,
      y: p.y,
      raio: 5,
      textura: 'super-noelle-floco',
      tamanho: 15,
      cor: 0xdff6ff,
      girar: olho.sentido * 5,
      jaAvisada: true,
      atualizar: (bala, dt) => {
        const s = dt / 1000
        bala.r -= cfg.queda * s
        bala.th += olho.sentido * Math.min(3.4, cfg.giro / (bala.r * bala.r)) * s
        bala.x = olho.x + Math.cos(bala.th) * bala.r
        bala.y = olho.y + Math.sin(bala.th) * bala.r
        if (bala.r < 16) bala.morta = true // engolido pelo olho
      },
    })
    b.r = Math.hypot(p.x - olho.x, p.y - olho.y)
    b.th = th0
  }
}

// Um pilar de gelo na linha do coração: a ponta aparece na borda, depois sobe de uma vez
function pilar(a, cfg) {
  const l = a.caixa
  const alvo = a.alvo()
  const lado = a.escolher(['baixo', 'baixo', 'cima', 'esquerda', 'direita'])
  const vertical = lado === 'baixo' || lado === 'cima'
  const W = cfg.larguraPilar
  const H = (vertical ? l.height : l.width) + 16
  const [min, max] = vertical ? [l.left, l.right] : [l.top, l.bottom]
  const pos = limitar((vertical ? alvo.x : alvo.y) + a.aleatorio(-14, 14), min + W / 2 + 2, max - W / 2 - 2)
  a.lacuna(Math.max(pos - W / 2 - min, max - pos - W / 2), 'ao lado do pilar de gelo')
  const aviso = Math.max(ATAQUE.telegrafoMs, cfg.avisoPilar)
  const PONTA = 12
  const SUBIR = 110
  let subiu = false
  let quebrou = false
  const b = a.bala({
    x: vertical ? pos : l.centerX,
    y: vertical ? l.centerY : pos,
    largura: vertical ? W : H,
    altura: vertical ? H : W,
    textura: 'super-noelle-pilar',
    aviso,
    atravessa: true,
    pulso: 0,
    vida: SUBIR + cfg.manterPilar + 180,
    atualizar: (bala) => {
      const lc = a.caixa
      const t = bala.idade - bala.aviso
      const p = Math.min(1, t / SUBIR)
      const h = PONTA + (H - PONTA) * (1 - (1 - p) ** 3)
      if (lado === 'baixo') bala.y = lc.bottom - h + H / 2
      else if (lado === 'cima') bala.y = lc.top + h - H / 2
      else if (lado === 'esquerda') bala.x = lc.left + h - H / 2
      else bala.x = lc.right - h + H / 2
      if (!subiu) {
        subiu = true
        tocar(a.cena, 'super-noelle-pilar')
        a.tremer(160, 0.008)
        const bx = vertical ? pos : lado === 'esquerda' ? lc.left : lc.right
        const by = vertical ? (lado === 'baixo' ? lc.bottom : lc.top) : pos
        particulas(a.cena, bx, by, { cor: 0xeaf7ff, quantidade: 10, velocidade: 150, vida: 360 })
      }
      if (bala.vida < 180) {
        bala.inofensiva = true
        bala.sprite.setAlpha(Math.max(0, bala.vida / 180))
        if (!quebrou) {
          quebrou = true
          tocar(a.cena, 'super-noelle-quebra')
          particulas(a.cena, bala.x, bala.y, { cor: 0xbfe8ff, quantidade: 12, velocidade: 120, vida: 380 })
        }
      }
    },
  })
  // o sprite: a coluna fina (não a escala uniforme da textura), girada para o lado de onde brota
  b.sprite.setDisplaySize(W * 1.3, H).setRotation({ baixo: 0, cima: Math.PI, esquerda: Math.PI / 2, direita: -Math.PI / 2 }[lado])
  b.escalaX = b.sprite.scaleX
  b.escalaY = b.sprite.scaleY
  // durante o aviso só a ponta aparece na borda (o resto ainda está "no gelo")
  if (lado === 'baixo') b.sprite.y = l.bottom + H / 2 - PONTA
  else if (lado === 'cima') b.sprite.y = l.top - H / 2 + PONTA
  else if (lado === 'esquerda') b.sprite.x = l.left - H / 2 + PONTA
  else b.sprite.x = l.right + H / 2 - PONTA
  tocar(a.cena, 'super-noelle-tique')
}

// ---------- IV. SNOWGRAVE ----------

function snowgrave(a, cfg, estado) {
  const l = a.caixa
  estado.fase = 'snowgrave'
  tocar(a.cena, 'snowgrave')
  a.tremer(380, 0.01)
  a.cena.tweens.add({ targets: estado.cenario.frio, alpha: 0.85, duration: 600 })
  // o olho se apaga e o núcleo deixa de machucar
  if (estado.nucleo) {
    estado.nucleo.inofensiva = true
    a.cena.tweens.add({ targets: estado.nucleo.sprite, alpha: 0, scale: 0.1, duration: 300, onComplete: () => (estado.nucleo.morta = true) })
  }
  nome(a, l)
  a.depois(260, () => tumulo(a, cfg, estado))
}

// SNOWGRAVE caindo letra a letra, em gelo, no alto da caixa
function nome(a, l) {
  const letras = 'SNOWGRAVE'
  const passo = 17
  const x0 = l.centerX - ((letras.length - 1) * passo) / 2
  ;[...letras].forEach((ch, i) => {
    const t = a.decoracao(
      a.cena.add
        .text(x0 + i * passo, l.top - 20, ch, { fontFamily: FONTE, fontSize: '22px', color: '#e6f8ff', stroke: '#0b2a55', strokeThickness: 5 })
        .setOrigin(0.5)
        .setDepth(8)
        .setAlpha(0),
    )
    a.cena.tweens.add({ targets: t, y: l.top + 18, alpha: 1, delay: i * 55, duration: 260, ease: 'Bounce.easeOut' })
    a.cena.tweens.add({ targets: t, alpha: 0.5, delay: 900 + i * 40, duration: 260, yoyo: true, repeat: -1 })
  })
}

// O túmulo: estilhaços entram por todas as bordas e se fecham onde o coração estava
function tumulo(a, cfg, estado) {
  const l = a.caixa
  const alvo = a.alvo()
  const P = { x: limitar(alvo.x, l.left + 10, l.right - 10), y: limitar(alvo.y, l.top + 10, l.bottom - 10) }
  estado.tumulo = P
  tocar(a.cena, 'super-noelle-implosao')
  const n = a.inteiro(cfg.lascasTumulo[0], cfg.lascasTumulo[1])
  const passo = TAU / n
  const base = a.aleatorio(0, TAU)
  const falta = a.inteiro(0, n - 1) // a brecha do túmulo
  const T = cfg.convergir
  a.lacuna(passo * 80 - 6, 'entre as lascas do túmulo (a 80 px do centro)')
  a.lacuna(2 * passo * 60 - 6, 'brecha do túmulo')
  for (let k = 0; k < n; k++) {
    if (k === falta) continue
    const th = base + k * passo + a.aleatorio(-0.05, 0.05)
    const fora = deFora(l, P.x, P.y, -Math.cos(th), -Math.sin(th), a.aleatorio(14, 22))
    a.bala({
      x: fora.x,
      y: fora.y,
      comprimento: 18,
      espessura: 6,
      angulo: th + Math.PI, // ponta para o centro
      textura: 'super-noelle-estilhaco',
      tamanho: 24,
      jaAvisada: true,
      pulso: 0,
      vida: T,
      // anda pelo relógio do próprio estilhaço: todos chegam juntos (sem depender do ritmo)
      atualizar: (b) => {
        const p = Math.min(1, b.idade / T) ** 1.15
        b.x = fora.x + (P.x - fora.x) * p
        b.y = fora.y + (P.y - fora.y) * p
      },
    })
  }
  // o frio se junta no ponto (brilho pequeno, sem desenhar trajetória)
  const brilho = a.decoracao(a.cena.add.image(P.x, P.y, 'super-noelle-floco').setDepth(6).setTint(0xffffff).setAlpha(0).setScale(0.6))
  a.cena.tweens.add({ targets: brilho, alpha: 0.9, scale: 1.6, angle: 360, duration: T, ease: 'Quad.easeIn' })
  a.depois(T, () => {
    brilho.destroy()
    explosao(a, cfg, estado, P, base + passo / 2)
  })
}

function explosao(a, cfg, estado, P, base) {
  const l = a.caixa
  tocar(a.cena, 'snowgraveFim')
  tocar(a.cena, 'super-noelle-estilhaco')
  a.tremer(480, 0.022)
  estado.tumulo = null
  // clarão na caixa inteira e o pilar de luz no ponto
  const clarao = a.decoracao(a.cena.add.rectangle(l.centerX, l.centerY, l.width, l.height, 0xffffff).setDepth(7).setAlpha(0.85))
  a.cena.tweens.add({ targets: clarao, alpha: 0, duration: 560, ease: 'Quad.easeOut' })
  const luz = a.decoracao(a.cena.add.rectangle(P.x, l.centerY, 46, l.height + 20, 0xeaf7ff).setDepth(7).setAlpha(0.95))
  a.cena.tweens.add({ targets: luz, scaleX: 0.05, alpha: 0, duration: 650, ease: 'Cubic.easeIn' })
  const flor = a.decoracao(a.cena.add.image(P.x, P.y, 'super-noelle-flocao').setDepth(7).setScale(1).setAlpha(1))
  a.cena.tweens.add({ targets: flor, scale: 5, alpha: 0, angle: 120, duration: 600, ease: 'Cubic.easeOut' })
  a.cena.tweens.add({ targets: estado.cenario.selo, alpha: 0, scale: 1.6, duration: 500 })
  // o estouro no ponto (quem ficou lá é pego)
  a.bala({ x: P.x, y: P.y, raio: 26, textura: 'super-noelle-impacto', tamanho: 64, jaAvisada: true, atravessa: true, pulso: 0, vida: 300, atualizar: sumirNoFim(140) })
  // os estilhaços voltam para todo lado (entre as direções por onde vieram)
  estourar(a, P.x, P.y, cfg.explosao, base + a.aleatorio(-0.15, 0.15), cfg.velocidadeExplosao, 'super-noelle-estilhaco', 900)
  particulas(a.cena, P.x, P.y, { cor: 0xffffff, quantidade: 26, velocidade: 300, vida: 600, escala: 1.4 })
  particulas(a.cena, P.x, P.y, { cor: 0xbfe8ff, quantidade: 20, velocidade: 200, vida: 700 })
}
