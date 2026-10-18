// Ataques exclusivos das cartas de noelle (uma entrada por ataque, com prefixo 'noelle').
// As receitas de pvp/baralhos/noelle.js chamam A.noelleFlocoAfiado(...) etc.
// Sprites e sons: pvp/habilidades/sprites/noelle.js (gerados por scripts/habilidades/noelle.py).
//
// Regra geral destes ataques: os projéteis nascem FORA da caixa e entram (a
// entrada pela borda é o aviso: nada de bala piscando parada nem "!"), e tudo
// que pode variar é sorteado com a semente (lado, posição, instante, mirada),
// para não dar para decorar.
import { definirAtaque } from '../definir.js'
import { ATAQUE, CORACAO } from '../../constants.js'
import { lacunasLivres } from '../validacao.js'
import { tocar } from '../../audio.js'
import { particulas } from '../../effects/particulas.js'

const T = (nome) => `hab-noelle-${nome}` // textura
const S = T // som
const AVISO_MIN = ATAQUE.telegrafoMs
const fator = (a) => a.balas.fatorVelocidade ?? 1
const vivas = (lista) => lista.filter((b) => !b.morta)

// Direção "para dentro" de cada borda (0 cima, 1 direita, 2 baixo, 3 esquerda)
const PARA_DENTRO = [
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 0],
]

// Bala some aos poucos e deixa de machucar (cravada na parede, monte derretendo...)
function sumir(a, b, ms = 260) {
  b.inofensiva = true
  b.vx = b.vy = b.ax = b.ay = 0
  b.girar = 0
  a.cena.tweens.add({ targets: b.sprite, alpha: 0, duration: ms, onComplete: () => (b.morta = true) })
}

// Escolhe posições em [ini, fim] (largura `largura` cada) até sobrar uma lacuna >= lacunaMinima.
// `fixo`: uma posição que sempre entra (a mirada no coração)
function escolherFaixas(a, ini, fim, quantidade, largura, fixo = null, distancia = largura) {
  let xs = []
  for (let tentativa = 0; tentativa < 14; tentativa++) {
    xs = fixo === null ? [] : [Math.min(fim - largura / 2, Math.max(ini + largura / 2, fixo))]
    for (let k = 0; k < 20 && xs.length < quantidade; k++) {
      const x = a.aleatorio(ini + largura / 2, fim - largura / 2)
      if (xs.every((o) => Math.abs(o - x) >= distancia)) xs.push(x)
    }
    if (temLacuna(a, ini, fim, xs, largura)) return xs
  }
  // não achou: tira posições (nunca a mirada) até sobrar a lacuna
  while (xs.length > 1 && !temLacuna(a, ini, fim, xs, largura)) xs.pop()
  return xs
}

function temLacuna(a, ini, fim, xs, largura) {
  const livres = lacunasLivres(ini, fim, xs.map((x) => [x - largura / 2, x + largura / 2]))
  return Math.max(0, ...livres.map(([p, q]) => q - p)) >= a.lacunaMinima + 4
}

// Sorteia se a leva mira no coração (chance `p`), sem passar de 2 levas seguidas sem mirar
// (no lugar do acumulador de ritmo fixo: a mirada não cai sempre na mesma leva)
function sortearMira(a, estado, p) {
  const sim = (estado.semMirar ?? 0) >= 2 || a.aleatorio(0, 1) < p
  estado.semMirar = sim ? 0 : (estado.semMirar ?? 0) + 1
  return sim
}

// Borda sorteada (`lado`) sem repetir a mesma mais de 2 vezes seguidas: na 3ª, troca por outra de `todos`
function sortearLado(a, estado, lado, todos) {
  if (lado === estado.lado && estado.repetido >= 1) lado = a.escolher(todos.filter((l) => l !== lado))
  estado.repetido = lado === estado.lado ? (estado.repetido ?? 0) + 1 : 0
  estado.lado = lado
  return lado
}

export default {
  // ♠ FLOCO AFIADO: flocos de lâminas curvas entram girando por bordas sorteadas,
  // param um instante logo dentro da caixa ("afiando"), disparam no coração e se
  // cravam na parede do outro lado.
  noelleFlocoAfiado: definirAtaque({
    nome: 'noelleFlocoAfiado',
    padrao: { duracao: 5000, intervalo: 900, quantidade: 2, velocidade: 180, entrada: 85, afiar: 300, raio: 6 },
    iniciar(a, cfg) {
      let lado = a.inteiro(0, 3)
      a.aCada(cfg.intervalo, () => {
        for (let k = 0; k < cfg.quantidade; k++) {
          lado = (lado + a.inteiro(1, 3)) % 4 // cada floco de uma borda sorteada (nunca a mesma da anterior)
          const deQual = lado
          // o primeiro sai na hora; os outros num instante sorteado da leva (sem ritmo fixo)
          a.depois(k === 0 ? 0 : a.aleatorio(90, cfg.intervalo * 0.45), () => flocoAfiado(a, cfg, deQual))
        }
      })
    },
  }),

  // ♠ GRANIZO: pedras de gelo pesadas despencam de cima da caixa (sem guia: a
  // pedra entrando é o aviso), em instantes sorteados, algumas com um desvio de
  // lado; no chão estouram em lascas que pulam para os dois lados.
  noelleGranizo: definirAtaque({
    nome: 'noelleGranizo',
    padrao: { duracao: 5500, intervalo: 750, quantidade: 3, velocidade: 270, raio: 7, lascas: 4, mirar: 0.6, deriva: 28, escalonar: 280 },
    iniciar(a, cfg) {
      const estado = {}
      a.aCada(cfg.intervalo, () => {
        const l = a.caixa
        const fixo = sortearMira(a, estado, cfg.mirar) ? a.alvo().x : null
        // (as pedras caem em instantes diferentes, então a "parede" de uma leva é folgada)
        const xs = escolherFaixas(a, l.left + 4, l.right - 4, cfg.quantidade, cfg.raio * 2 + 4, fixo, 42)
        a.parede({ eixo: 'x', ocupados: xs.map((x) => [x - cfg.raio - 2, x + cfg.raio + 2]) })
        xs.forEach((x, k) => {
          const mirada = fixo !== null && k === 0
          a.depois(mirada ? 0 : a.aleatorio(0, cfg.escalonar), () => pedraDeGranizo(a, cfg, x, mirada))
        })
      })
    },
  }),

  // ♦ VENTO GÉLIDO: rajadas de vento de um lado sorteado (os riscos de vento avisam
  // a direção); na rajada o vento EMPURRA o coração e carrega estilhaços de geada
  // que entram pela borda de onde ele sopra.
  noelleVentoGelido: definirAtaque({
    nome: 'noelleVentoGelido',
    padrao: { duracao: 5000, periodo: 2100, aviso: 650, rajada: 1250, empurrao: 60, tiros: 230, velocidade: 165, mirar: 0.3 },
    iniciar(a, cfg) {
      const aviso = Math.max(AVISO_MIN, cfg.aviso)
      const estado = { sentido: a.aleatorio(0, 1) < 0.5 ? 1 : -1, soprando: false, rajada: 0, primeira: true }
      // a rajada termina antes do aviso da próxima (o período real é dividido pela densidade)
      const rajada = Math.max(600, Math.min(cfg.rajada, cfg.periodo / a.ritmo.densidade - aviso - 150))

      a.aoAtualizar((dt) => {
        if (!estado.soprando) return
        const passo = estado.sentido * cfg.empurrao * fator(a) * (dt / 1000)
        for (const c of a.coracoes) {
          if (!c.ativo) continue
          c.x += passo
          c.ajustar()
        }
      })

      a.aCada(
        cfg.periodo,
        () => {
          // o lado da rajada é sorteado (costuma virar, mas pode soprar de novo do mesmo lado)
          if (!estado.primeira && a.aleatorio(0, 1) < 0.7) estado.sentido = -estado.sentido
          estado.primeira = false
          const sentido = estado.sentido
          tocar(a.cena, S('vento'))
          const id = ++estado.rajada
          riscosDeVento(a, sentido, aviso, 0.35)
          a.depois(aviso, () => {
            estado.soprando = true
            a.tremer(120, 0.003)
            riscosDeVento(a, sentido, rajada, 0.9)
            const tiros = Math.max(2, Math.floor(rajada / cfg.tiros))
            for (let k = 0; k < tiros; k++) {
              const quando = Math.max(0, k * cfg.tiros + (k ? a.aleatorio(-0.3, 0.3) * cfg.tiros : 0))
              const mirado = k === 0 || a.aleatorio(0, 1) < cfg.mirar
              a.depois(quando, () => estilhacoDoVento(a, cfg, sentido, mirado))
            }
            a.depois(rajada, () => {
              if (estado.rajada === id) estado.soprando = false
            })
          })
        },
        Infinity,
        200,
      )
    },
  }),

  // ♦ RAIO DE GELO: um orbe de cristal desliza de fora para a borda, mira o
  // coração (só um fio fino marca a mira) e dispara um raio; a linha por onde o
  // raio passou CONGELA em cristais por um instante.
  noelleRaioDeGelo: definirAtaque({
    nome: 'noelleRaioDeGelo',
    padrao: { duracao: 5500, intervalo: 1200, aviso: 560, feixe: 260, congelado: 600, espessura: 12 },
    iniciar(a, cfg) {
      const aviso = Math.max(AVISO_MIN, cfg.aviso)
      a.aCada(
        cfg.intervalo,
        () => {
          const l = a.caixa
          const alvo = a.alvo()
          // o orbe vem de fora por uma borda sorteada, longe do coração
          let lado = 0
          let p = null
          for (let k = 0; k < 10; k++) {
            lado = a.inteiro(0, 3)
            p = pontoNaBorda(a, l, lado, 6)
            if (Math.hypot(p.x - alvo.x, p.y - alvo.y) > 90) break
          }
          const [nx, ny] = PARA_DENTRO[lado]
          const ang = Math.atan2(alvo.y - p.y, alvo.x - p.x)
          const comp = alcanceAteABorda(l, p.x, p.y, ang)
          const fim = { x: p.x + Math.cos(ang) * comp, y: p.y + Math.sin(ang) * comp }
          a.lacuna(espacoDoOutroLado(l, p, ang) - cfg.espessura / 2, 'lado livre do raio congelado')

          const orbe = a.decoracao(
            a.cena.add
              .image(p.x - nx * 22, p.y - ny * 22, T('cristal'))
              .setDepth(6)
              .setScale(1.4),
          )
          a.cena.tweens.add({ targets: orbe, x: p.x, y: p.y, duration: 200, ease: 'Cubic.easeOut' })
          a.cena.tweens.add({ targets: orbe, angle: 360, duration: aviso, ease: 'Cubic.easeIn' })
          a.aviso({ tipo: 'linha', x1: p.x, y1: p.y, x2: fim.x, y2: fim.y, espessura: 2, ms: aviso }, () => {
            tocar(a.cena, S('raio'))
            a.tremer(90, 0.003)
            const feixe = a.bala({
              x: (p.x + fim.x) / 2,
              y: (p.y + fim.y) / 2,
              comprimento: comp,
              espessura: cfg.espessura,
              angulo: ang,
              textura: T('feixe'),
              jaAvisada: true,
              atravessa: true,
              vida: cfg.feixe,
              pulso: 0,
            })
            feixe.sprite.setDisplaySize(comp, 14)
            // a linha congela: cristais de gelo ficam no lugar do raio
            a.depois(cfg.feixe - 60, () => {
              for (let d = 8; d < comp - 4; d += 13) {
                a.bala({
                  x: p.x + Math.cos(ang) * d,
                  y: p.y + Math.sin(ang) * d,
                  raio: 5,
                  textura: T('geada'),
                  tamanho: 12,
                  jaAvisada: true,
                  atravessa: true,
                  vida: cfg.congelado,
                  pulso: 0.04,
                  atualizar: (b) => {
                    if (b.vida < 160 && !b.inofensiva) sumir(a, b, 150)
                  },
                })
              }
            })
            a.depois(cfg.feixe + cfg.congelado - 100, () => {
              particulas(a.cena, (p.x + fim.x) / 2, (p.y + fim.y) / 2, { cor: 0xd6f6ff, quantidade: 12, velocidade: 120, vida: 300 })
            })
            a.cena.tweens.add({ targets: orbe, alpha: 0, scale: 0.4, duration: 220, delay: cfg.feixe })
          })
        },
        Infinity,
        250,
      )
    },
  }),

  // ♦ INVERNO ETERNO: hexágonos de gelo entram por bordas sorteadas rumo ao coração
  // e, a cada sopro do inverno (em instantes que variam), TUDO congela no ar (a
  // caixa embranquece, a geada dos cantos cresce e não volta); os cristais parados
  // piscam antes de descongelar e seguir viagem.
  noelleInvernoEterno: definirAtaque({
    nome: 'noelleInvernoEterno',
    padrao: { duracao: 7000, intervalo: 560, velocidade: 100, ciclo: 1750, congelado: 950, piscar: 420 },
    iniciar(a, cfg) {
      const piscar = Math.max(AVISO_MIN, cfg.piscar)
      const estado = { congelado: false, cristais: [], cantos: criarCantos(a) }

      a.aCada(cfg.intervalo, () => {
        if (estado.congelado) return
        const l = a.caixa
        const alvo = a.alvo()
        const lado = a.inteiro(0, 3)
        const p = pontoNaBorda(a, l, lado, -a.aleatorio(10, 26))
        const ang = Math.atan2(alvo.y - p.y, alvo.x - p.x) + a.aleatorio(-0.3, 0.3)
        const b = a.bala({
          x: p.x,
          y: p.y,
          raio: 5,
          textura: T('eterno'),
          quadro: 0,
          tamanho: 14,
          jaAvisada: true,
          vx: Math.cos(ang) * cfg.velocidade,
          vy: Math.sin(ang) * cfg.velocidade,
          girar: 4,
        })
        estado.cristais.push(b)
      })

      // os sopros não caem sempre no mesmo compasso (±15% do ciclo)
      for (let ms = cfg.ciclo * a.aleatorio(0.55, 0.8); ms + cfg.congelado < cfg.duracao; ms += cfg.ciclo * a.aleatorio(0.85, 1.15)) {
        a.depois(ms, () => congelarTudo(a, estado))
        a.depois(ms + cfg.congelado - piscar, () => vivas(estado.cristais).forEach((b) => (b.piscar = true)))
        a.depois(ms + cfg.congelado, () => descongelar(a, estado))
      }
    },
  }),

  // ♣ PINGENTES: pingentes se soltam do teto OU de uma parede lateral (sorteado a
  // cada leva): a ponta aparece saindo da parede, treme e o pingente dispara
  // acelerando até a parede oposta, onde fica CRAVADO um tempo, como um espeto.
  noellePingentes: definirAtaque({
    nome: 'noellePingentes',
    padrao: { duracao: 5000, intervalo: 1100, quantidade: 3, soltar: 380, gravidade: 1000, cravado: 1300, mirar: 0.6, laterais: 0.5 },
    iniciar(a, cfg) {
      const estado = {}
      const lados = {}
      a.aCada(cfg.intervalo, () => {
        const l = a.caixa
        // de onde se soltam: teto ou uma das laterais (nunca 3 levas seguidas da mesma parede)
        const lado = sortearLado(a, lados, a.aleatorio(0, 1) < cfg.laterais ? a.escolher([1, 3]) : 0, [0, 1, 3])
        const vertical = lado === 0
        const [ini, fim] = vertical ? [l.left + 4, l.right - 4] : [l.top + 4, l.bottom - 4]
        const alvo = a.alvo()
        const fixo = sortearMira(a, estado, cfg.mirar) ? (vertical ? alvo.x : alvo.y) : null
        const ps = escolherFaixas(a, ini, fim, cfg.quantidade, 14, fixo, 34)
        a.parede({ eixo: vertical ? 'x' : 'y', ocupados: ps.map((p) => [p - 7, p + 7]) })
        tocar(a.cena, 'estalo')
        ps.forEach((p, k) => a.depois(k === 0 ? 0 : a.aleatorio(0, 220), () => pingente(a, cfg, lado, p)))
      })
    },
  }),

  // ♣ ESTALACTITES: estalactites enormes CRESCEM de uma parede sorteada a cada leva
  // (teto, chão ou laterais) até uma profundidade, ficam um tempo e recolhem. Sem
  // área piscando: a ponta aparece na parede e treme antes de crescer. Nunca
  // cruzam umas com as outras, e cada uma só nasce se o coração tiver por onde sair
  // a tempo (e um espaço livre de verdade para onde ir).
  noelleEstalactites: definirAtaque({
    nome: 'noelleEstalactites',
    padrao: { duracao: 5500, intervalo: 1400, quantidade: 3, aviso: 600, crescer: 420, manter: 1000, recolher: 420, mirar: 0.6 },
    iniciar(a, cfg) {
      const aviso = Math.max(AVISO_MIN, cfg.aviso)
      const comprimento = 126
      const total = cfg.crescer + cfg.manter + cfg.recolher
      const ativas = [] // { r: retângulo na profundidade máxima, ate: a.tempo em que já recolheu }
      const estado = {}
      const lados = {}
      a.aCada(
        cfg.intervalo,
        () => {
          const l = a.caixa
          for (let i = ativas.length - 1; i >= 0; i--) if (ativas[i].ate <= a.tempo) ativas.splice(i, 1)
          const lado = sortearLado(a, lados, a.inteiro(0, 3), [0, 1, 2, 3])
          const vertical = lado === 0 || lado === 2 // cresce do teto ou do chão
          const extensao = vertical ? l.height : l.width // da parede até a oposta
          const ini = vertical ? l.left : l.top
          const largura = vertical ? l.width : l.height
          const faixas = Math.max(4, Math.floor(largura / 30))
          const passo = largura / faixas
          const maxProf = Math.min(150, extensao - (a.lacunaMinima + 6))
          a.lacuna(extensao - maxProf, 'faixa livre além das estalactites')

          const candidatas = []
          if (sortearMira(a, estado, cfg.mirar)) {
            const alvo = a.alvo()
            const i = Math.min(faixas - 1, Math.max(0, Math.floor(((vertical ? alvo.x : alvo.y) - ini) / passo)))
            // a mirada vai até perto da parede oposta: ficar parado não salva (é só uma faixa: dá um passo pro lado)
            candidatas.push({ i, prof: extensao - 6 })
          }
          const ordem = [...Array(faixas).keys()]
          for (let k = ordem.length - 1; k > 0; k--) {
            const j = a.inteiro(0, k)
            ;[ordem[k], ordem[j]] = [ordem[j], ordem[k]]
          }
          for (const i of ordem) if (!candidatas.some((c) => c.i === i)) candidatas.push({ i, prof: a.aleatorio(extensao * 0.3, maxProf) })

          const escolhidas = []
          for (const c of candidatas) {
            if (escolhidas.length >= cfg.quantidade) break
            const pos = ini + passo * (c.i + 0.5)
            const r = retanguloDaEstalactite(l, lado, pos, c.prof)
            const outras = [...ativas.map((e) => e.r), ...escolhidas.map((e) => e.r)]
            if (outras.some((o) => cruza(o, r, 4))) continue
            if (!daParaSair(a, outras, r, aviso + cfg.crescer * 0.5)) continue
            escolhidas.push({ pos, prof: c.prof, r })
          }
          if (!escolhidas.length) return
          tocar(a.cena, S('estalactite'))
          for (const e of escolhidas) {
            ativas.push({ r: e.r, ate: a.tempo + aviso + total + 300 })
            // instante sorteado dentro da leva (não crescem todas juntas)
            const atraso = escolhidas.length > 1 ? a.aleatorio(0, 160) : 0
            a.depois(atraso, () => pontaDaEstalactite(a, cfg, lado, e.pos, e.prof, Math.max(comprimento, e.prof + 6), aviso, total))
          }
        },
        Infinity,
        200,
      )
    },
  }),

  // ♣ AVALANCHE: a montanha estremece e bolas de neve entram rolando por bordas
  // sorteadas, já vindo para o coração. Elas fazem curva atrás dele (curva pesada:
  // um passo para o lado na hora certa faz a bola passar reto), CRESCEM enquanto
  // rolam e, quando batem numa parede, se espatifam em torrões de neve que voltam
  // para dentro da caixa.
  noelleAvalanche: definirAtaque({
    nome: 'noelleAvalanche',
    padrao: {
      duracao: 6500,
      intervalo: 1300,
      velocidade: 120,
      maxima: 175,
      aceleracao: 90,
      curva: 1.9,
      perseguir: 1100,
      raioInicial: 8,
      raioFinal: 17,
      crescimento: 0.045,
      torroes: 6,
      velocidadeTorrao: 120,
    },
    iniciar(a, cfg) {
      tocar(a.cena, S('avalanche'))
      a.tremer(220, 0.004)
      a.lacuna(Math.min(a.caixa.width, a.caixa.height) - cfg.raioFinal * 2, 'espaço ao lado da bola de neve')
      let lado = a.inteiro(0, 3)
      a.aCada(
        cfg.intervalo,
        () => {
          // a próxima bola vem de outra borda, num instante sorteado da leva
          lado = (lado + a.inteiro(1, 3)) % 4
          const deQual = lado
          a.depois(a.aleatorio(0, cfg.intervalo * 0.3), () => bolaDeNeve(a, cfg, deQual))
        },
        Infinity,
        120,
      )
    },
  }),
}

// ---------- ajudantes ----------

// Ponto numa das bordas da caixa (0 cima, 1 direita, 2 baixo, 3 esquerda); `dentro` < 0 = fora
function pontoNaBorda(a, l, lado, dentro) {
  const m = 14
  if (lado === 0) return { x: a.aleatorio(l.left + m, l.right - m), y: l.top + dentro }
  if (lado === 1) return { x: l.right - dentro, y: a.aleatorio(l.top + m, l.bottom - m) }
  if (lado === 2) return { x: a.aleatorio(l.left + m, l.right - m), y: l.bottom - dentro }
  return { x: l.left + dentro, y: a.aleatorio(l.top + m, l.bottom - m) }
}

// Distância de (x, y) até sair da caixa na direção `ang`
function alcanceAteABorda(l, x, y, ang) {
  const dx = Math.cos(ang)
  const dy = Math.sin(ang)
  const ts = []
  if (dx > 1e-6) ts.push((l.right - x) / dx)
  if (dx < -1e-6) ts.push((l.left - x) / dx)
  if (dy > 1e-6) ts.push((l.bottom - y) / dy)
  if (dy < -1e-6) ts.push((l.top - y) / dy)
  return Math.max(20, Math.min(...ts) + 6)
}

// Maior distância de um canto da caixa até a reta do raio (o espaço que sobra ao lado dele)
function espacoDoOutroLado(l, p, ang) {
  const nx = -Math.sin(ang)
  const ny = Math.cos(ang)
  const cantos = [
    [l.left, l.top],
    [l.right, l.top],
    [l.left, l.bottom],
    [l.right, l.bottom],
  ]
  return Math.max(...cantos.map(([x, y]) => Math.abs((x - p.x) * nx + (y - p.y) * ny)))
}

// Coração ativo mais perto de (x, y)
function coracaoMaisPerto(a, x, y) {
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
  return melhor
}

// ---------- Floco Afiado ----------

function flocoAfiado(a, cfg, lado) {
  const l = a.caixa
  const alvo = a.alvo()
  const fora = a.aleatorio(10, 24)
  // nasce fora, longe do coração (o ponto de entrada não pode ser em cima dele)
  let p = pontoNaBorda(a, l, lado, -fora)
  for (let t = 0; t < 8 && Math.hypot(p.x - alvo.x, p.y - alvo.y) < 80; t++) p = pontoNaBorda(a, l, lado, -fora)
  const [nx, ny] = PARA_DENTRO[lado]
  const parada = fora + a.aleatorio(8, 16) // px andados até parar (já dentro da caixa)
  const afiar = cfg.afiar * a.aleatorio(0.75, 1.35) // quanto tempo gira parado antes do disparo
  tocar(a.cena, S('floco'))
  a.bala({
    x: p.x,
    y: p.y,
    raio: cfg.raio,
    textura: T('floco'),
    tamanho: 20,
    jaAvisada: true,
    vx: nx * cfg.entrada,
    vy: ny * cfg.entrada,
    girar: 16,
    pulso: 0.05,
    atualizar: (b, dt) => {
      if (b.cravado) return
      if (!b.lancado) {
        if (b.afiando === undefined) {
          if ((b.x - p.x) * nx + (b.y - p.y) * ny < parada) return
          b.afiando = 0 // parou dentro da caixa: gira no lugar
          b.vx = b.vy = 0
          return
        }
        b.afiando += dt * fator(a)
        if (b.afiando < afiar) return
        // mira na hora do disparo (depois de girar no lugar)
        b.lancado = true
        const alvo = a.alvo()
        const ang = Math.atan2(alvo.y - b.y, alvo.x - b.x)
        b.vx = Math.cos(ang) * cfg.velocidade
        b.vy = Math.sin(ang) * cfg.velocidade
        return
      }
      const c = a.caixa
      const r = b.raio
      const bateu = (b.x - r < c.left && b.vx < 0) || (b.x + r > c.right && b.vx > 0) || (b.y - r < c.top && b.vy < 0) || (b.y + r > c.bottom && b.vy > 0)
      if (!bateu) return
      // crava na parede: para, para de girar e derrete
      b.cravado = true
      b.x = Math.min(c.right - r + 3, Math.max(c.left + r - 3, b.x))
      b.y = Math.min(c.bottom - r + 3, Math.max(c.top + r - 3, b.y))
      particulas(a.cena, b.x, b.y, { cor: 0xd6f6ff, quantidade: 5, velocidade: 70, vida: 220 })
      sumir(a, b, 420)
    },
  })
}

// ---------- Granizo ----------

function pedraDeGranizo(a, cfg, x, mirada) {
  const l = a.caixa
  // nasce acima da caixa e já entra caindo (a mirada cai reta na coluna do coração)
  const y0 = l.top - a.aleatorio(12, 34)
  const altura = l.bottom - cfg.raio - y0
  const v0 = cfg.velocidade * 0.5
  const g = (cfg.velocidade ** 2 - v0 ** 2) / (2 * altura)
  const vx = mirada ? 0 : a.aleatorio(-cfg.deriva, cfg.deriva)
  a.bala({
    x,
    y: y0,
    raio: cfg.raio,
    textura: T('granizo'),
    tamanho: 17,
    jaAvisada: true,
    vx,
    vy: v0,
    ay: g,
    girar: 2 + vx / 10,
    pulso: 0.02,
    atualizar: (b) => {
      const c = a.caixa
      // desvio de lado: bate na parede e volta
      if ((b.x - b.raio < c.left && b.vx < 0) || (b.x + b.raio > c.right && b.vx > 0)) b.vx = -b.vx
      if (b.y + b.raio < c.bottom) return
      b.morta = true
      estourarGranizo(a, cfg, b.x, c.bottom - 4)
    },
  })
}

function estourarGranizo(a, cfg, x, y) {
  tocar(a.cena, S('granizo'))
  a.tremer(70, 0.003)
  particulas(a.cena, x, y, { cor: 0xe0f8ff, quantidade: 6, velocidade: 90, vida: 220 })
  // lascas para os dois lados, com força e ângulo sorteados (metade de cada lado)
  const primeiro = a.aleatorio(0, 1) < 0.5 ? 1 : -1
  for (let k = 0; k < cfg.lascas; k++) {
    const lado = k % 2 ? -primeiro : primeiro
    const vx = lado * a.aleatorio(25, 85)
    const vy = -a.aleatorio(120, 175)
    a.bala({
      x: x + lado * 3,
      y,
      raio: 3,
      textura: T('lasca'),
      tamanho: 8,
      jaAvisada: true,
      vx,
      vy,
      ay: 560,
      girar: 9 * lado,
      pulso: 0,
      vida: a.aleatorio(480, 620),
    })
  }
}

// ---------- Vento Gélido ----------

// Riscos de vento passando pela caixa na direção do sopro (só visual)
function riscosDeVento(a, sentido, ms, alfa) {
  const n = Math.max(3, Math.round(ms / 140))
  for (let k = 0; k < n; k++) {
    a.depois(k * (ms / n), () => {
      const c = a.caixa
      const y = a.aleatorio(c.top + 6, c.bottom - 6)
      const x0 = sentido > 0 ? c.left - 24 : c.right + 24
      const risco = a.decoracao(
        a.cena.add
          .image(x0, y, T('vento'))
          .setDepth(3)
          .setAlpha(alfa)
          .setFlipX(sentido < 0),
      )
      a.cena.tweens.add({
        targets: risco,
        x: x0 + sentido * (c.width + 48),
        duration: 520,
        onComplete: () => risco.destroy(),
      })
    })
  }
}

// Estilhaço de geada: nasce fora, do lado de onde o vento sopra (a rajada já avisou)
function estilhacoDoVento(a, cfg, sentido, mirado) {
  const l = a.caixa
  const y = mirado ? Math.min(l.bottom - 6, Math.max(l.top + 6, a.alvo().y)) : a.aleatorio(l.top + 6, l.bottom - 6)
  const fora = a.aleatorio(12, 34)
  a.bala({
    x: sentido > 0 ? l.left - fora : l.right + fora,
    y,
    comprimento: 16,
    espessura: 5,
    angulo: sentido > 0 ? 0 : Math.PI,
    textura: T('rajada'),
    jaAvisada: true,
    vx: sentido * cfg.velocidade * a.aleatorio(0.9, 1.1),
    vy: a.aleatorio(-14, 14),
    pulso: 0,
  })
}

// ---------- Inverno Eterno ----------

function criarCantos(a) {
  const l = a.caixa
  return [
    [l.left, l.top, false, false],
    [l.right, l.top, true, false],
    [l.left, l.bottom, false, true],
    [l.right, l.bottom, true, true],
  ].map(([x, y, fx, fy]) =>
    a.decoracao(
      a.cena.add
        .image(x, y, T('canto'))
        .setOrigin(fx ? 1 : 0, fy ? 1 : 0)
        .setFlip(fx, fy)
        .setDepth(2)
        .setScale(0.5)
        .setAlpha(0.35),
    ),
  )
}

function congelarTudo(a, estado) {
  estado.congelado = true
  estado.geada = (estado.geada ?? 0) + 1
  tocar(a.cena, S('congelar'))
  a.tremer(110, 0.003)
  const l = a.caixa
  const veu = a.decoracao(a.cena.add.rectangle(l.centerX, l.centerY, l.width, l.height, 0xeaf7ff).setAlpha(0.45).setDepth(3))
  a.cena.tweens.add({ targets: veu, alpha: 0.12, duration: 380 })
  estado.veu = veu
  // a geada dos cantos cresce a cada sopro e não volta (o inverno é eterno)
  const escala = Math.min(1.6, 0.5 + 0.3 * estado.geada)
  estado.cantos.forEach((c) => a.cena.tweens.add({ targets: c, scale: escala, alpha: 0.75, duration: 300 }))
  for (const b of vivas(estado.cristais)) {
    b.guardado = { vx: b.vx, vy: b.vy, girar: b.girar }
    b.vx = b.vy = 0
    b.girar = 0
    b.sprite.setFrame(1)
  }
}

function descongelar(a, estado) {
  estado.congelado = false
  if (estado.veu) a.cena.tweens.add({ targets: estado.veu, alpha: 0, duration: 200 })
  for (const b of vivas(estado.cristais)) {
    b.piscar = false
    b.sprite.setAlpha(1)
    if (!b.guardado) continue
    b.vx = b.guardado.vx
    b.vy = b.guardado.vy
    b.girar = b.guardado.girar
    b.guardado = null
    b.sprite.setFrame(0)
  }
  estado.cristais = vivas(estado.cristais)
}

// ---------- Pingentes ----------

// Um pingente da parede `lado` (0 teto, 1 direita, 3 esquerda) na posição `pos`
// (x para o teto, y para as laterais): nasce fora, a ponta sai da parede tremendo
// por `soltar` ms e ele dispara acelerando até cravar na parede oposta.
function pingente(a, cfg, lado, pos) {
  const l = a.caixa
  const [nx, ny] = PARA_DENTRO[lado]
  const meio = 13 // metade do comprimento
  const vertical = lado === 0
  const fora = meio + 4 // corpo inteiro fora, a ponta a 4 px da parede
  const x0 = vertical ? pos : lado === 1 ? l.right + fora : l.left - fora
  const y0 = vertical ? l.top - fora : pos
  const saida = 40 // px/s enquanto a ponta sai da parede
  const b = a.bala({
    x: x0,
    y: y0,
    largura: vertical ? 8 : 26,
    altura: vertical ? 26 : 8,
    textura: T('pingente'),
    tamanho: 30,
    jaAvisada: true,
    vx: nx * saida,
    vy: ny * saida,
    pulso: 0,
    atualizar: (b, dt) => {
      const c = a.caixa
      if (b.cravado) {
        if (b.vida < 220 && !b.inofensiva) sumir(a, b, 200)
        return
      }
      if (!b.solto) {
        b.t = (b.t ?? 0) + dt * fator(a)
        // tremidinha enquanto se solta (de lado)
        const tremor = Math.sin(b.t / 22) * 0.8
        if (vertical) b.x = pos + tremor
        else b.y = pos + tremor
        if (b.t < b.soltar) return
        b.solto = true
        if (vertical) b.x = pos
        else b.y = pos
        b.ax = nx * cfg.gravidade
        b.ay = ny * cfg.gravidade
        tocar(a.cena, 'estalo')
        return
      }
      // chegou na parede oposta? crava e vira um espeto parado
      const frente = vertical ? b.y + meio >= c.bottom : lado === 3 ? b.x + meio >= c.right : b.x - meio <= c.left
      if (!frente) return
      b.cravado = true
      b.vx = b.vy = b.ax = b.ay = 0
      if (vertical) b.y = c.bottom - 9
      else b.x = lado === 3 ? c.right - 9 : c.left + 9
      b.vida = cfg.cravado
      a.tremer(60, 0.002)
      const px = vertical ? b.x : lado === 3 ? c.right - 2 : c.left + 2
      const py = vertical ? c.bottom - 2 : b.y
      particulas(a.cena, px, py, { cor: 0xd6f6ff, quantidade: 6, velocidade: 80, vida: 240 })
    },
  })
  // cada pingente se solta num tempo um pouco diferente
  b.soltar = cfg.soltar * a.aleatorio(0.85, 1.2)
  // o sprite aponta para baixo: nas laterais gira para apontar para dentro
  if (!vertical) b.sprite.setRotation(lado === 3 ? -Math.PI / 2 : Math.PI / 2)
}

// ---------- Estalactites ----------

// Retângulo que a estalactite ocupa na profundidade máxima (com folga do coração)
function retanguloDaEstalactite(l, lado, pos, prof) {
  const meia = 5 + CORACAO.hitbox + 1 // meia espessura + coração
  const fundo = prof + CORACAO.hitbox
  if (lado === 0) return { x0: pos - meia, x1: pos + meia, y0: l.top, y1: l.top + fundo }
  if (lado === 2) return { x0: pos - meia, x1: pos + meia, y0: l.bottom - fundo, y1: l.bottom }
  if (lado === 3) return { x0: l.left, x1: l.left + fundo, y0: pos - meia, y1: pos + meia }
  return { x0: l.right - fundo, x1: l.right, y0: pos - meia, y1: pos + meia }
}

function cruza(p, q, folga = 0) {
  return p.x0 < q.x1 + folga && q.x0 < p.x1 + folga && p.y0 < q.y1 + folga && q.y0 < p.y1 + folga
}

const smooth = (u) => u * u * (3 - 2 * u)

const dentroDe = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1

// Justiça da estalactite nova `novo` (com as `outras` que estarão lá): cada
// coração precisa, andando em volta das outras, sair da faixa da nova em até
// `ms` (com metade da velocidade, de folga) e chegar num espaço livre de pelo
// menos uma lacuna mínima ao quadrado. Busca em largura numa grade de 6 px.
function daParaSair(a, outras, novo, ms) {
  const l = a.caixa
  const passo = 6
  const colunas = Math.max(1, Math.floor(l.width / passo))
  const linhas = Math.max(1, Math.floor(l.height / passo))
  const centro = (i) => ({ x: l.left + ((i % colunas) + 0.5) * passo, y: l.top + (Math.floor(i / colunas) + 0.5) * passo })
  const bloqueada = new Uint8Array(colunas * linhas)
  const naNova = new Uint8Array(colunas * linhas)
  for (let i = 0; i < bloqueada.length; i++) {
    const { x, y } = centro(i)
    bloqueada[i] = outras.some((r) => dentroDe(r, x, y)) ? 1 : 0
    naNova[i] = dentroDe(novo, x, y) ? 1 : 0
  }
  const vizinhos = (i) => {
    const cx = i % colunas
    const out = []
    if (cx > 0) out.push(i - 1)
    if (cx < colunas - 1) out.push(i + 1)
    if (i >= colunas) out.push(i - colunas)
    if (i < colunas * (linhas - 1)) out.push(i + colunas)
    return out
  }
  const alcance = Math.max(2, Math.floor(((CORACAO.velocidadePadrao * 0.5 * ms) / 1000) / passo))
  const espacoMinimo = Math.ceil((a.lacunaMinima / passo) ** 2)
  for (const c of a.coracoes) {
    if (!c.ativo) continue
    const cx = Math.min(colunas - 1, Math.max(0, Math.floor((c.x - l.left) / passo)))
    const cy = Math.min(linhas - 1, Math.max(0, Math.floor((c.y - l.top) / passo)))
    const inicio = cy * colunas + cx
    if (bloqueada[inicio]) continue // já está em cima de outra (não dá para julgar)
    // 1) até onde ele chega a tempo, desviando das outras: alguma célula fora da nova?
    const dist = new Map([[inicio, 0]])
    const fila = [inicio]
    const saidas = []
    for (let k = 0; k < fila.length; k++) {
      const i = fila[k]
      if (!naNova[i]) saidas.push(i)
      if (dist.get(i) >= alcance) continue
      for (const v of vizinhos(i)) {
        if (bloqueada[v] || dist.has(v)) continue
        dist.set(v, dist.get(i) + 1)
        fila.push(v)
      }
    }
    if (!saidas.length) return false
    // 2) o espaço livre (sem a nova e sem as outras) em volta dessas saídas é grande o bastante?
    const visto = new Uint8Array(colunas * linhas)
    const f2 = saidas.filter((i) => !visto[i] && (visto[i] = 1))
    for (let k = 0; k < f2.length && f2.length < espacoMinimo; k++) {
      for (const v of vizinhos(f2[k])) {
        if (visto[v] || bloqueada[v] || naNova[v]) continue
        visto[v] = 1
        f2.push(v)
      }
    }
    if (f2.length < espacoMinimo) return false
  }
  return true
}

// A ponta da estalactite aparece na parede e treme por `aviso` ms (decoração,
// não machuca); então ela cresce até `prof`, fica e recolhe.
function pontaDaEstalactite(a, cfg, lado, pos, prof, comprimento, aviso, total) {
  const l = a.caixa
  const [nx, ny] = PARA_DENTRO[lado]
  const ang = Math.atan2(ny, nx) // a textura aponta da base (esquerda) para a ponta (direita)
  const espiada = 7 // px da ponta para dentro da caixa durante o aviso
  const parede = pontoDaParede(l, lado, pos)
  const centro = (ponta) => ({ x: parede.x + nx * (ponta - comprimento / 2), y: parede.y + ny * (ponta - comprimento / 2) })
  const c0 = centro(espiada)
  const ponta = a.decoracao(
    a.cena.add
      .image(c0.x, c0.y, T('estalactite'))
      .setRotation(ang)
      .setDisplaySize(comprimento * 1.05, 22)
      .setDepth(5),
  )
  // tremor de lado e farelo de gelo caindo da parede
  a.cena.tweens.add({ targets: ponta, x: c0.x + ny * 0.9, y: c0.y + nx * 0.9, duration: 45, yoyo: true, repeat: -1 })
  particulas(a.cena, parede.x + nx * 3, parede.y + ny * 3, { cor: 0xbfe8ff, quantidade: 4, velocidade: 40, vida: 260 })
  a.depois(aviso, () => {
    a.cena.tweens.killTweensOf(ponta)
    ponta.destroy()
    crescerEstalactite(a, cfg, lado, pos, prof, comprimento, total, espiada)
  })
}

// Ponto da parede `lado` na posição `pos` (x no teto/chão, y nas laterais)
function pontoDaParede(l, lado, pos) {
  if (lado === 0) return { x: pos, y: l.top }
  if (lado === 2) return { x: pos, y: l.bottom }
  if (lado === 3) return { x: l.left, y: pos }
  return { x: l.right, y: pos }
}

function crescerEstalactite(a, cfg, lado, pos, prof, comprimento, total, espiada) {
  const [nx, ny] = PARA_DENTRO[lado]
  const parede = pontoDaParede(a.caixa, lado, pos)
  // centro do segmento com a ponta a `ponta` px da parede
  const centro = (ponta) => ({ x: parede.x + nx * (ponta - comprimento / 2), y: parede.y + ny * (ponta - comprimento / 2) })
  const c0 = centro(espiada)
  const b = a.bala({
    x: c0.x,
    y: c0.y,
    comprimento,
    espessura: 10,
    angulo: Math.atan2(ny, nx),
    textura: T('estalactite'),
    jaAvisada: true,
    atravessa: true,
    pulso: 0,
    atualizar: (b, dt) => {
      b.t = (b.t ?? 0) + dt * fator(a)
      let k
      // cresce começando devagar (dá para ver a ponta saindo e reagir) e freia no fim
      if (b.t < cfg.crescer) k = smooth(b.t / cfg.crescer)
      else if (b.t < cfg.crescer + cfg.manter) k = 1
      else k = Math.max(0, 1 - (b.t - cfg.crescer - cfg.manter) / cfg.recolher)
      // cresce da espiada até `prof`; ao recolher volta para dentro da parede
      const alcance = b.t < cfg.crescer ? espiada + (prof - espiada) * k : prof * k
      const c = centro(alcance)
      // tremidinha enquanto está estendida
      const tremor = k === 1 ? Math.sin(b.t / 30) * 0.6 : 0
      b.x = c.x + ny * tremor
      b.y = c.y + nx * tremor
      if (b.t >= total) b.morta = true
    },
  })
  // só estica no comprimento (a espessura do desenho continua a da colisão)
  b.sprite.setDisplaySize(comprimento * 1.05, 22)
  particulas(a.cena, parede.x + nx * 2, parede.y + ny * 2, { cor: 0xbfe8ff, quantidade: 5, velocidade: 60, vida: 220 })
}

// ---------- Avalanche ----------

// Bola de neve: nasce fora da borda `lado`, entra rolando rumo ao coração, faz
// curva atrás dele por `perseguir` ms (giro limitado e, nesse tempo, mais devagar
// que o coração: a.limitarPerseguidor), cresce com o caminho e se espatifa na
// primeira parede em que bater depois de entrar.
function bolaDeNeve(a, cfg, lado) {
  const l = a.caixa
  const alvo = a.alvo()
  const fora = cfg.raioInicial + a.aleatorio(6, 18)
  let p = pontoNaBorda(a, l, lado, -fora)
  for (let k = 0; k < 8 && Math.hypot(p.x - alvo.x, p.y - alvo.y) < 110; k++) p = pontoNaBorda(a, l, lado, -fora)
  // entra mirando o coração com um desvio sorteado (a curva corrige... ou não)
  const ang0 = Math.atan2(alvo.y - p.y, alvo.x - p.x) + a.aleatorio(-0.35, 0.35)
  const curva = cfg.curva * a.aleatorio(0.85, 1.15)
  a.tremer(90, 0.002)
  a.bala({
    x: p.x,
    y: p.y,
    raio: cfg.raioInicial,
    textura: T('bola'),
    tamanho: cfg.raioInicial * 2.3,
    jaAvisada: true,
    vx: Math.cos(ang0) * cfg.velocidade,
    vy: Math.sin(ang0) * cfg.velocidade,
    pulso: 0.02,
    atualizar: (b, dt) => {
      const s = (dt / 1000) * fator(a)
      b.t = (b.t ?? 0) + dt * fator(a)
      let v = Math.hypot(b.vx, b.vy)
      // neve grudando: cresce com o caminho rolado
      b.rolado = (b.rolado ?? 0) + v * s
      if (b.base === undefined) b.base = b.escalaX
      b.raio = Math.min(cfg.raioFinal, cfg.raioInicial + b.rolado * cfg.crescimento)
      b.escalaX = b.escalaY = (b.base * b.raio) / cfg.raioInicial
      // rola: gira conforme anda (mais devagar quanto maior)
      b.girar = ((b.vx >= 0 ? 1 : -1) * v) / (b.raio * 1.6)
      // curva pesada atrás do coração mais perto, só no começo; depois segue reto
      let rumo = Math.atan2(b.vy, b.vx)
      const c = coracaoMaisPerto(a, b.x, b.y)
      if (c && b.t < cfg.perseguir) {
        let d = Math.atan2(c.y - b.y, c.x - b.x) - rumo
        d = Math.atan2(Math.sin(d), Math.cos(d))
        rumo += Math.max(-curva * s, Math.min(curva * s, d))
      }
      v = Math.min(cfg.maxima, v + (cfg.aceleracao * dt) / 1000)
      // enquanto faz curva atrás do coração, rola mais devagar que ele (teto de fuga):
      // correndo de lado ela não alcança; depois, já reta, pode embalar até `maxima`
      if (b.t < cfg.perseguir) v = a.limitarPerseguidor(v)
      b.vx = Math.cos(rumo) * v
      b.vy = Math.sin(rumo) * v
      const cx = a.caixa
      const r = b.raio
      if (!b.entrou) {
        const m = Math.min(r, 10) // o centro já bem dentro da caixa
        if (b.x - m > cx.left && b.x + m < cx.right && b.y - m > cx.top && b.y + m < cx.bottom) b.entrou = true
        return
      }
      // bateu numa parede: espatifa em torrões que voltam para dentro
      let n = null
      if (b.x - r <= cx.left && b.vx < 0) n = [1, 0]
      else if (b.x + r >= cx.right && b.vx > 0) n = [-1, 0]
      else if (b.y - r <= cx.top && b.vy < 0) n = [0, 1]
      else if (b.y + r >= cx.bottom && b.vy > 0) n = [0, -1]
      if (!n) return
      b.morta = true
      espatifar(a, cfg, b.x, b.y, r, n)
    },
  })
}

function espatifar(a, cfg, x, y, raio, [nx, ny]) {
  const l = a.caixa
  tocar(a.cena, S('espatifar'))
  a.tremer(120, 0.004)
  // o ponto do impacto, colado na parede
  const px = Math.min(l.right - 4, Math.max(l.left + 4, x - nx * (raio - 4)))
  const py = Math.min(l.bottom - 4, Math.max(l.top + 4, y - ny * (raio - 4)))
  particulas(a.cena, px, py, { cor: 0xffffff, quantidade: 12, velocidade: 110, vida: 300 })
  // montinho de neve na parede (só visual, derrete)
  const monte = a.decoracao(
    a.cena.add
      .image(px - nx * 1, py - ny * 1, T('monte'))
      .setRotation(Math.atan2(nx, -ny))
      .setScale(raio / 9)
      .setDepth(4),
  )
  a.cena.tweens.add({ targets: monte, alpha: 0, duration: 500, delay: 700, onComplete: () => monte.destroy() })
  // torrões em leque para dentro; um deles vai no coração se ele estiver na frente
  const normal = Math.atan2(ny, nx)
  const alvo = a.alvo()
  const paraAlvo = Math.atan2(alvo.y - py, alvo.x - px)
  const desvio = Math.atan2(Math.sin(paraAlvo - normal), Math.cos(paraAlvo - normal))
  const n = cfg.torroes
  for (let k = 0; k < n; k++) {
    let ang = normal + (-1.15 + (2.3 * (k + a.aleatorio(0.15, 0.85))) / n)
    if (k === 0 && Math.abs(desvio) < 1.2) ang = paraAlvo
    const v = cfg.velocidadeTorrao * (k === 0 ? 1 : a.aleatorio(0.7, 1))
    // saem devagar e aceleram (dá para ver o leque abrindo)
    a.bala({
      x: px + Math.cos(ang) * 4,
      y: py + Math.sin(ang) * 4,
      raio: 4,
      textura: T('torrao'),
      tamanho: 10,
      jaAvisada: true,
      vx: Math.cos(ang) * v * 0.45,
      vy: Math.sin(ang) * v * 0.45,
      ax: Math.cos(ang) * v * 1.8,
      ay: Math.sin(ang) * v * 1.8,
      girar: a.aleatorio(-8, 8),
      pulso: 0,
      atualizar: (b) => {
        // depois de chegar na velocidade, segue reto
        if (b.ax && Math.hypot(b.vx, b.vy) >= v) b.ax = b.ay = 0
      },
    })
  }
}
