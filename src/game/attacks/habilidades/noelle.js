// Ataques exclusivos das cartas de noelle (uma entrada por ataque, com prefixo 'noelle').
// As receitas de pvp/baralhos/noelle.js chamam A.noelleFlocoAfiado(...) etc.
// Sprites e sons: pvp/habilidades/sprites/noelle.js (gerados por scripts/habilidades/noelle.py).
import { definirAtaque } from '../definir.js'
import { ATAQUE } from '../../constants.js'
import { lacunasLivres } from '../validacao.js'
import { tocar } from '../../audio.js'
import { shake } from '../../effects/shake.js'
import { particulas } from '../../effects/particulas.js'

const T = (nome) => `hab-noelle-${nome}` // textura
const S = T // som
const AVISO_MIN = ATAQUE.telegrafoMs
const fator = (a) => a.balas.fatorVelocidade ?? 1
const vivas = (lista) => lista.filter((b) => !b.morta)

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
    const livres = lacunasLivres(ini, fim, xs.map((x) => [x - largura / 2, x + largura / 2]))
    if (Math.max(0, ...livres.map(([p, q]) => q - p)) >= a.lacunaMinima + 4) break
  }
  return xs
}

export default {
  // ♠ FLOCO AFIADO: flocos de lâminas curvas surgem girando na borda da caixa
  // ("afiando", inofensivos), disparam no coração e se cravam na parede do outro lado.
  noelleFlocoAfiado: definirAtaque({
    nome: 'noelleFlocoAfiado',
    padrao: { duracao: 5000, intervalo: 900, quantidade: 2, velocidade: 180, aviso: 520, raio: 6 },
    iniciar(a, cfg) {
      const aviso = Math.max(AVISO_MIN, cfg.aviso)
      let lado = a.inteiro(0, 3)
      a.aCada(cfg.intervalo, () => {
        const l = a.caixa
        for (let k = 0; k < cfg.quantidade; k++) {
          lado = (lado + 1 + a.inteiro(0, 1)) % 4 // cada floco de uma borda diferente
          const alvo = a.alvo()
          let p = pontoNaBorda(a, l, lado, 9)
          for (let t = 0; t < 8 && Math.hypot(p.x - alvo.x, p.y - alvo.y) < 70; t++) p = pontoNaBorda(a, l, lado, 9)
          tocar(a.cena, S('floco'))
          a.bala({
            x: p.x,
            y: p.y,
            raio: cfg.raio,
            textura: T('floco'),
            tamanho: 20,
            aviso,
            girar: 16,
            pulso: 0.05,
            atualizar: (b) => {
              if (b.cravado) return
              if (!b.lancado) {
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
      })
    },
  }),

  // ♠ GRANIZO: pedras de gelo pesadas despencam rápido (a coluna e o chão piscam
  // antes) e estouram no chão em lascas que pulam um pouco.
  noelleGranizo: definirAtaque({
    nome: 'noelleGranizo',
    padrao: { duracao: 5500, intervalo: 800, quantidade: 2, velocidade: 260, aviso: 480, raio: 7, lascas: 3, mirar: 0.5 },
    iniciar(a, cfg) {
      const aviso = Math.max(AVISO_MIN, cfg.aviso)
      const respingo = 30 // raio da área das lascas no chão
      let mira = 0
      a.aCada(cfg.intervalo, () => {
        const l = a.caixa
        mira += cfg.mirar
        let fixo = null
        if (mira >= 1) {
          mira -= 1
          fixo = a.alvo().x
        }
        const xs = escolherFaixas(a, l.left + 4, l.right - 4, cfg.quantidade, cfg.raio * 2 + 4, fixo, 44)
        a.parede({ eixo: 'x', ocupados: xs.map((x) => [x - cfg.raio - 2, x + cfg.raio + 2]) })
        const y0 = l.top + cfg.raio + 1
        const altura = l.bottom - cfg.raio - y0
        const v0 = cfg.velocidade * 0.45
        const g = (cfg.velocidade ** 2 - v0 ** 2) / (2 * altura)
        const queda = ((2 * altura) / (v0 + cfg.velocidade)) * 1000 / fator(a)
        for (const x of xs) {
          a.aviso({ tipo: 'linha', x1: x, y1: l.top, x2: x, y2: l.bottom, espessura: cfg.raio * 2, ms: aviso })
          // o chão onde as lascas pulam pisca até a pedra chegar
          a.aviso({ tipo: 'circulo', x, y: l.bottom, raio: respingo, ms: aviso + queda })
          a.bala({
            x,
            y: y0,
            raio: cfg.raio,
            textura: T('granizo'),
            tamanho: 17,
            aviso,
            vy: v0,
            ay: g,
            girar: 2,
            pulso: 0.02,
            atualizar: (b) => {
              const c = a.caixa
              if (b.y + b.raio < c.bottom) return
              b.morta = true
              estourarGranizo(a, cfg, b.x, c.bottom - 4, respingo)
            },
          })
        }
      })
    },
  }),

  // ♦ VENTO GÉLIDO: rajadas de vento alternam de lado. Os riscos de vento avisam
  // a direção; na rajada o vento EMPURRA o coração e carrega estilhaços de geada.
  noelleVentoGelido: definirAtaque({
    nome: 'noelleVentoGelido',
    padrao: { duracao: 5000, periodo: 2100, aviso: 650, rajada: 1250, empurrao: 60, tiros: 230, velocidade: 165 },
    iniciar(a, cfg) {
      const aviso = Math.max(AVISO_MIN, cfg.aviso)
      const estado = { sentido: a.aleatorio(0, 1) < 0.5 ? 1 : -1, soprando: false, rajada: 0 }
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
          estado.sentido = -estado.sentido
          const sentido = estado.sentido
          tocar(a.cena, S('vento'))
          const id = ++estado.rajada
          riscosDeVento(a, sentido, aviso, 0.35)
          a.depois(aviso, () => {
            estado.soprando = true
            shake(a.cena, 120, 0.003)
            riscosDeVento(a, sentido, rajada, 0.9)
            const tiros = Math.max(2, Math.floor(rajada / cfg.tiros))
            for (let k = 0; k < tiros; k++) {
              a.depois(k * cfg.tiros, () => estilhacoDoVento(a, cfg, sentido, k === 0))
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

  // ♦ RAIO DE GELO: um orbe de cristal surge na borda, mira o coração e dispara
  // um raio; a linha por onde o raio passou CONGELA em cristais por um instante.
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
          // o orbe nasce na borda, longe do coração
          let p = null
          for (let k = 0; k < 10; k++) {
            p = pontoNaBorda(a, l, a.inteiro(0, 3), 6)
            if (Math.hypot(p.x - alvo.x, p.y - alvo.y) > 90) break
          }
          const ang = Math.atan2(alvo.y - p.y, alvo.x - p.x)
          const comp = alcanceAteABorda(l, p.x, p.y, ang)
          const fim = { x: p.x + Math.cos(ang) * comp, y: p.y + Math.sin(ang) * comp }
          a.lacuna(espacoDoOutroLado(l, p, ang) - cfg.espessura / 2, 'lado livre do raio congelado')

          const orbe = a.decoracao(a.cena.add.image(p.x, p.y, T('cristal')).setDepth(6).setScale(0.4).setAlpha(0))
          a.cena.tweens.add({ targets: orbe, scale: 1.4, alpha: 1, duration: 180 })
          a.cena.tweens.add({ targets: orbe, angle: 360, duration: aviso, ease: 'Cubic.easeIn' })
          a.aviso({ tipo: 'linha', x1: p.x, y1: p.y, x2: fim.x, y2: fim.y, espessura: cfg.espessura + 4, ms: aviso }, () => {
            tocar(a.cena, S('raio'))
            shake(a.cena, 90, 0.003)
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

  // ♦ INVERNO ETERNO: hexágonos de gelo voam para o coração e, a cada sopro do
  // inverno, TUDO congela no ar (a caixa embranquece, a geada dos cantos cresce e
  // não volta); os cristais parados piscam antes de descongelar e seguir viagem.
  noelleInvernoEterno: definirAtaque({
    nome: 'noelleInvernoEterno',
    padrao: { duracao: 7000, intervalo: 560, velocidade: 100, aviso: 460, ciclo: 1750, congelado: 950, piscar: 420 },
    iniciar(a, cfg) {
      const aviso = Math.max(AVISO_MIN, cfg.aviso)
      const piscar = Math.max(AVISO_MIN, cfg.piscar)
      const estado = { congelado: false, cristais: [], cantos: criarCantos(a) }

      a.aCada(cfg.intervalo, () => {
        if (estado.congelado) return
        const l = a.caixa
        const alvo = a.alvo()
        const lado = a.inteiro(0, 3)
        const p = pontoNaBorda(a, l, lado, -10)
        const ang = Math.atan2(alvo.y - p.y, alvo.x - p.x) + a.aleatorio(-0.3, 0.3)
        const b = a.bala({
          x: p.x,
          y: p.y,
          raio: 5,
          textura: T('eterno'),
          quadro: 0,
          tamanho: 14,
          aviso,
          vx: Math.cos(ang) * cfg.velocidade,
          vy: Math.sin(ang) * cfg.velocidade,
          girar: 4,
        })
        estado.cristais.push(b)
      })

      for (let ms = cfg.ciclo * 0.7; ms + cfg.congelado < cfg.duracao; ms += cfg.ciclo) {
        a.depois(ms, () => congelarTudo(a, estado))
        a.depois(ms + cfg.congelado - piscar, () => vivas(estado.cristais).forEach((b) => (b.piscar = true)))
        a.depois(ms + cfg.congelado, () => descongelar(a, estado))
      }
    },
  }),

  // ♣ PINGENTES: pingentes pendurados no teto piscam (a coluna avisa), despencam
  // e ficam CRAVADOS no chão por um tempo, como espetos.
  noellePingentes: definirAtaque({
    nome: 'noellePingentes',
    padrao: { duracao: 5000, intervalo: 1300, quantidade: 2, aviso: 600, gravidade: 950, cravado: 1300, mirar: 0.5 },
    iniciar(a, cfg) {
      const aviso = Math.max(AVISO_MIN, cfg.aviso)
      let mira = 0
      a.aCada(cfg.intervalo, () => {
        const l = a.caixa
        mira += cfg.mirar
        let fixo = null
        if (mira >= 1) {
          mira -= 1
          fixo = a.alvo().x
        }
        const xs = escolherFaixas(a, l.left + 4, l.right - 4, cfg.quantidade, 14, fixo, 34)
        a.parede({ eixo: 'x', ocupados: xs.map((x) => [x - 7, x + 7]) })
        tocar(a.cena, 'estalo')
        for (const x of xs) {
          a.aviso({ tipo: 'area', x: x - 7, y: l.top, largura: 14, altura: l.height, ms: aviso })
          a.bala({
            x,
            y: l.top + 15,
            largura: 8,
            altura: 26,
            textura: T('pingente'),
            tamanho: 30,
            aviso,
            vy: 30,
            ay: cfg.gravidade,
            pulso: 0,
            atualizar: (b) => {
              const c = a.caixa
              if (b.cravado || b.y + 13 < c.bottom) {
                if (b.cravado && b.vida < 220 && !b.inofensiva) sumir(a, b, 200)
                return
              }
              // crava no chão: vira um espeto parado
              b.cravado = true
              b.y = c.bottom - 9
              b.vy = b.ay = 0
              b.vida = cfg.cravado
              shake(a.cena, 60, 0.002)
              particulas(a.cena, b.x, c.bottom - 2, { cor: 0xd6f6ff, quantidade: 6, velocidade: 80, vida: 240 })
            },
          })
        }
      })
    },
  }),

  // ♣ ESTALACTITES: estalactites enormes CRESCEM do teto até uma profundidade
  // (a área pisca antes), ficam um tempo e voltam a recolher. Embaixo sempre
  // sobra uma faixa livre.
  noelleEstalactites: definirAtaque({
    nome: 'noelleEstalactites',
    padrao: { duracao: 5500, intervalo: 1400, quantidade: 3, aviso: 600, crescer: 260, manter: 1000, recolher: 420, mirar: 0.6 },
    iniciar(a, cfg) {
      const aviso = Math.max(AVISO_MIN, cfg.aviso)
      const comprimento = 126
      const ocupadas = new Map() // índice da faixa -> até quando (a.tempo) está ocupada
      let mira = 0
      a.aCada(
        cfg.intervalo,
        () => {
          const l = a.caixa
          const faixas = Math.max(4, Math.floor(l.width / 30))
          const passo = l.width / faixas
          const livreEmbaixo = a.lacunaMinima + 6
          const maxProf = Math.min(comprimento - 6, l.height - livreEmbaixo)
          a.lacuna(l.height - maxProf, 'faixa livre sob as estalactites')
          const livres = [...Array(faixas).keys()].filter((i) => !(ocupadas.get(i) > a.tempo))
          const escolhidas = []
          mira += cfg.mirar
          if (mira >= 1) {
            mira -= 1
            const alvo = a.alvo()
            const i = Math.min(faixas - 1, Math.max(0, Math.floor((alvo.x - l.left) / passo)))
            if (livres.includes(i)) escolhidas.push({ i, prof: Math.min(maxProf, Math.max(alvo.y - l.top + 18, l.height * 0.4)) })
          }
          while (escolhidas.length < Math.min(cfg.quantidade, livres.length)) {
            const i = a.escolher(livres)
            if (escolhidas.some((e) => e.i === i)) continue
            escolhidas.push({ i, prof: a.aleatorio(l.height * 0.3, maxProf) })
          }
          const total = cfg.crescer + cfg.manter + cfg.recolher
          tocar(a.cena, S('estalactite'))
          for (const { i, prof } of escolhidas) {
            ocupadas.set(i, a.tempo + aviso + total + 100)
            const x = l.left + passo * (i + 0.5)
            const largura = 18
            a.aviso({ tipo: 'area', x: x - largura / 2, y: l.top, largura, altura: prof, ms: aviso }, () => crescerEstalactite(a, cfg, x, prof, comprimento, total))
          }
        },
        Infinity,
        200,
      )
    },
  }),

  // ♣ AVALANCHE: a montanha estremece e fileiras de bolas de neve descem rolando,
  // CRESCENDO pelo caminho, cada fileira com a brecha num lugar diferente. Onde
  // a bola bate no chão fica um montinho de neve por um tempo.
  noelleAvalanche: definirAtaque({
    nome: 'noelleAvalanche',
    padrao: { duracao: 6500, intervalo: 1300, velocidade: 95, aceleracao: 120, raioInicial: 6, raioFinal: 11, brecha: 62, aviso: 480, monte: 1100 },
    iniciar(a, cfg) {
      const aviso = Math.max(AVISO_MIN, cfg.aviso)
      let brecha = null
      tocar(a.cena, S('avalanche'))
      a.aCada(
        cfg.intervalo,
        () => {
          const l = a.caixa
          const largura = cfg.brecha
          // a brecha muda de lugar a cada fileira (longe o bastante para obrigar a andar)
          let centro
          for (let k = 0; k < 12; k++) {
            centro = a.aleatorio(l.left + largura / 2 + 2, l.right - largura / 2 - 2)
            if (brecha === null || Math.abs(centro - brecha) > 50) break
          }
          brecha = centro
          const diam = cfg.raioFinal * 2 + 4
          const xs = []
          for (let x = l.left + cfg.raioFinal; x <= l.right - cfg.raioFinal + 1; x += diam) {
            if (Math.abs(x - centro) >= largura / 2 + cfg.raioFinal) xs.push(x)
          }
          a.parede({ eixo: 'x', ocupados: xs.map((x) => [x - cfg.raioFinal, x + cfg.raioFinal]) })
          shake(a.cena, 160, 0.004)
          const y0 = l.top + cfg.raioInicial + 2
          for (const x of xs) {
            a.bala({
              x: x + a.aleatorio(-2, 2),
              y: y0,
              raio: cfg.raioInicial,
              textura: T('bola'),
              tamanho: cfg.raioInicial * 2.3,
              aviso,
              vy: cfg.velocidade,
              ay: cfg.aceleracao,
              girar: 7 * (x < centro ? 1 : -1),
              pulso: 0.03,
              atualizar: (b) => {
                const c = a.caixa
                if (b.base === undefined) b.base = b.escalaX
                const p = Math.min(1, Math.max(0, (b.y - y0) / (c.bottom - y0)))
                b.raio = cfg.raioInicial + (cfg.raioFinal - cfg.raioInicial) * p
                b.escalaX = b.escalaY = (b.base * b.raio) / cfg.raioInicial
                if (b.y + b.raio < c.bottom) return
                b.morta = true
                monteDeNeve(a, cfg, b.x, c.bottom)
              },
            })
          }
        },
        Infinity,
        150,
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

function estourarGranizo(a, cfg, x, y, respingo) {
  tocar(a.cena, S('granizo'))
  shake(a.cena, 70, 0.003)
  particulas(a.cena, x, y, { cor: 0xe0f8ff, quantidade: 6, velocidade: 90, vida: 220 })
  for (let k = 0; k < cfg.lascas; k++) {
    // lascas curtas: ficam dentro do círculo que piscou no chão
    const lado = k % 2 ? 1 : -1
    const vx = lado * a.aleatorio(15, 50)
    const vy = -a.aleatorio(110, 150)
    a.bala({
      x: x + lado * 3,
      y,
      raio: 3,
      textura: T('lasca'),
      tamanho: 8,
      jaAvisada: true,
      vx,
      vy,
      ay: 520,
      girar: 9 * lado,
      pulso: 0,
      vida: (respingo / 50) * 1000 * 0.8,
    })
  }
}

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

function estilhacoDoVento(a, cfg, sentido, mirado) {
  const l = a.caixa
  const y = mirado ? Math.min(l.bottom - 6, Math.max(l.top + 6, a.alvo().y)) : a.aleatorio(l.top + 6, l.bottom - 6)
  a.bala({
    x: sentido > 0 ? l.left - 14 : l.right + 14,
    y,
    comprimento: 16,
    espessura: 5,
    angulo: sentido > 0 ? 0 : Math.PI,
    textura: T('rajada'),
    aviso: Math.max(AVISO_MIN, 420),
    vx: sentido * cfg.velocidade,
    vy: a.aleatorio(-12, 12),
    pulso: 0,
  })
}

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
  shake(a.cena, 110, 0.003)
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

function crescerEstalactite(a, cfg, x, prof, comprimento, total) {
  const l = a.caixa
  const topo = l.top
  // centro do segmento com a ponta em `ponta`
  const centro = (ponta) => ponta - comprimento / 2
  a.bala({
    x,
    y: centro(topo),
    comprimento,
    espessura: 10,
    angulo: Math.PI / 2,
    textura: T('estalactite'),
    jaAvisada: true,
    atravessa: true,
    pulso: 0,
    atualizar: (b, dt) => {
      b.t = (b.t ?? 0) + dt * fator(a)
      let k
      if (b.t < cfg.crescer) k = 1 - (1 - b.t / cfg.crescer) ** 3
      else if (b.t < cfg.crescer + cfg.manter) k = 1
      else k = Math.max(0, 1 - (b.t - cfg.crescer - cfg.manter) / cfg.recolher)
      b.y = centro(topo + prof * k)
      // tremidinha enquanto está estendida
      b.x = x + (k === 1 ? Math.sin(b.t / 30) * 0.6 : 0)
      if (b.t >= total) b.morta = true
    },
  })
  particulas(a.cena, x, topo + 2, { cor: 0xbfe8ff, quantidade: 5, velocidade: 60, vida: 220 })
}

function monteDeNeve(a, cfg, x, chao) {
  particulas(a.cena, x, chao - 4, { cor: 0xffffff, quantidade: 7, velocidade: 90, vida: 260 })
  a.bala({
    x,
    y: chao - 4,
    largura: 18,
    altura: 7,
    textura: T('monte'),
    tamanho: 22,
    jaAvisada: true,
    atravessa: true,
    vida: cfg.monte,
    pulso: 0,
    atualizar: (b) => {
      if (b.vida < 260 && !b.inofensiva) sumir(a, b, 240)
    },
  })
}
