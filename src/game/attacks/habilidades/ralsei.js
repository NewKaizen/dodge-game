import { definirAtaque } from '../definir.js'
import { ATAQUE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { particulas } from '../../effects/particulas.js'

// Ataques exclusivos das cartas de Ralsei (prefixo 'ralsei'). Magia fofa na
// aparência, perigosa de verdade. Sprites em scripts/habilidades/ralsei.py.
//
//   ralseiEstrelaGentil   ♠ estrelas cadentes miradas, com rastro de brilhos que fica no ar
//   ralseiCoroEstrelas    ♠ um coro de estrelas no alto canta em sequência (vai e volta),
//                           cada uma solta estrelinhas miradas; no fim da volta, o coro inteiro
//   ralseiCancaoNinar     ♦ as notas de uma canção de ninar atravessam a caixa pela pauta
//   ralseiFeiticoSono     ♦ trios de "Z" sobem do chão em zigue-zague e crescem
//   ralseiBolinho         ♣ cupcakes no chão: a vela queima, estouram num chafariz de
//                           granulado e a cereja voa em arco no coração
//   ralseiFiosLa          ♣ novelos rolam quicando e desenrolam um fio que fica no rastro
//   ralseiLacoFita        ♣ uma fita em laço se aperta em direção ao nó; foge pelo vão
//
// Justiça: tudo nasce piscando (aviso das balas, >= ATAQUE.telegrafoMs) ou sai
// de algo que já piscou (rastro da estrela, fio do novelo, granulado do bolinho);
// os vãos entre notas e o vão do laço são declarados com a.lacuna.

const T = 'hab-ralsei-'
const fv = (a) => a.balas.fatorVelocidade ?? 1
const limitar = (v, min, max) => Math.min(max, Math.max(min, v))
const suave = (p) => p * p * (3 - 2 * p)

// distância de (x, y) até a borda da caixa andando na direção ang
function ateABorda(l, x, y, ang) {
  const dx = Math.cos(ang)
  const dy = Math.sin(ang)
  const tx = dx > 1e-6 ? (l.right - x) / dx : dx < -1e-6 ? (l.left - x) / dx : Infinity
  const ty = dy > 1e-6 ? (l.bottom - y) / dy : dy < -1e-6 ? (l.top - y) / dy : Infinity
  return Math.max(0, Math.min(tx, ty))
}

// ---------- ♠ Estrela Gentil ----------
// Estrelas cadentes nascem no alto (piscando, com a linha do caminho
// desenhada) e caem miradas no coração, deixando um rastro de brilhos que
// fica parado no ar por `rastro` ms: depois de desviar, não volte pelo rastro.
const ralseiEstrelaGentil = definirAtaque({
  nome: 'ralseiEstrelaGentil',
  padrao: { duracao: 5000, intervalo: 1100, velocidade: 170, raio: 7, aviso: 500, rastro: 550, passoRastro: 11, porVez: 1 },
  iniciar(a, cfg) {
    const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)

    const brilho = (x, y) =>
      a.bala({
        x,
        y,
        raio: 3,
        textura: `${T}faisca`,
        quadro: a.inteiro(0, 2),
        tamanho: 9,
        vy: 10,
        girar: 2,
        pulso: 0.25,
        jaAvisada: true,
        vida: cfg.rastro,
        atualizar: (b) => b.sprite.setAlpha(limitar((b.vida / cfg.rastro) * 1.6, 0.25, 1)),
      })

    const lancar = (n) => {
      const l = a.caixa
      const lado = n % 2 ? 1 : -1
      const x = l.centerX + lado * a.aleatorio(l.width * 0.12, l.width * 0.42)
      const y = l.top + cfg.raio + 2
      const alvo = a.alvo()
      const ang = Math.atan2(Math.max(24, alvo.y - y), alvo.x - x) // sempre para baixo
      const alcance = ateABorda(l, x, y, ang)
      // caminho da estrela (some quando ela parte)
      const linha = a.decoracao(a.cena.add.graphics().setDepth(4))
      linha.lineStyle(2, 0xffe48a, 0.6)
      linha.lineBetween(x, y, x + Math.cos(ang) * alcance, y + Math.sin(ang) * alcance)
      a.cena.tweens.add({ targets: linha, alpha: 0.25, duration: 90, yoyo: true, repeat: -1 })
      let partiu = false
      let andado = 0
      let ultimo = { x, y }
      a.bala({
        x,
        y,
        vx: Math.cos(ang) * cfg.velocidade,
        vy: Math.sin(ang) * cfg.velocidade,
        raio: cfg.raio,
        textura: `${T}estrela`,
        quadro: 0,
        tamanho: cfg.raio * 2.7,
        aviso,
        girar: 5,
        vida: ((alcance + 30) / (cfg.velocidade * fv(a))) * 1000,
        atualizar: (b) => {
          if (!partiu) {
            partiu = true
            a.cena.tweens.killTweensOf(linha)
            linha.setVisible(false)
            tocar(a.cena, 'hab-ralsei-estrela')
          }
          b.sprite.setFrame(Math.floor(b.idade / 90) % 2)
          andado += Math.hypot(b.x - ultimo.x, b.y - ultimo.y)
          ultimo = { x: b.x, y: b.y }
          while (andado >= cfg.passoRastro) {
            andado -= cfg.passoRastro
            brilho(b.x, b.y)
          }
        },
      })
    }

    let n = 0
    a.aCada(cfg.intervalo, () => {
      for (let k = 0; k < cfg.porVez; k++) lancar(n++)
    }, Infinity, 200)
  },
})

// ---------- ♠ Coro de Estrelas ----------
// Um coro de estrelinhas (olhos fechados, cantando) fica na borda de cima.
// Elas cantam uma de cada vez, numa onda que vai e volta pelo coro, e cada
// nota cantada é uma rajada de estrelinhas miradas no coração. No fim de cada
// volta (força alta) o coro inteiro canta junto: uma estrelinha de cada
// cantora, todas convergindo para onde o coração estava.
const ralseiCoroEstrelas = definirAtaque({
  nome: 'ralseiCoroEstrelas',
  padrao: { duracao: 6000, cantores: 5, intervalo: 450, velocidade: 150, voz: 3, abertura: 0.3, raio: 8, raioVoz: 4.5, coroCheio: true, aviso: 600 },
  iniciar(a, cfg) {
    const l = a.caixa
    const n = cfg.cantores
    const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
    const coro = []
    for (let k = 0; k < n; k++) {
      const x = l.left + (l.width * (k + 0.5)) / n
      const y0 = l.top + cfg.raio + 4
      const fase = k * 0.9
      const est = a.bala({
        x,
        y: y0,
        raio: cfg.raio,
        textura: `${T}coro`,
        quadro: 0,
        tamanho: cfg.raio * 2.6,
        aviso,
        pulso: 0.04,
        vida: cfg.duracao + 1500,
        // balança devagar, no ritmo da música
        atualizar: (b) => {
          b.y = y0 + Math.sin(b.idade / 260 + fase) * 2
          if (b.cantaAte && b.idade > b.cantaAte) {
            b.cantaAte = 0
            b.sprite.setFrame(0)
          }
        },
      })
      coro.push(est)
    }

    const cantar = (est, voz, abertura) => {
      if (est.morta) return
      est.sprite.setFrame(1)
      est.cantaAte = est.idade + 320
      const alvo = a.alvo()
      const dir = Math.atan2(alvo.y - est.y, alvo.x - est.x)
      for (let j = 0; j < voz; j++) {
        const ang = dir + (j - (voz - 1) / 2) * abertura
        a.bala({
          x: est.x + Math.cos(dir) * (cfg.raio + 4),
          y: est.y + Math.sin(dir) * (cfg.raio + 4),
          vx: Math.cos(ang) * cfg.velocidade,
          vy: Math.sin(ang) * cfg.velocidade,
          raio: cfg.raioVoz,
          textura: `${T}voz`,
          quadro: (j + coro.indexOf(est)) % 2,
          tamanho: cfg.raioVoz * 2.6,
          girar: 4,
        })
      }
    }

    // ordem da onda: 0, 1, ..., n-1, n-2, ..., 1 (vai e volta)
    const ordem = [...Array(n).keys(), ...[...Array(Math.max(0, n - 2)).keys()].map((k) => n - 2 - k)]
    a.aCada(cfg.intervalo, (i) => {
      const passo = i % (ordem.length + (cfg.coroCheio ? 1 : 0))
      if (passo === ordem.length) {
        // o coro inteiro canta junto
        tocar(a.cena, 'hab-ralsei-coro')
        coro.forEach((est) => cantar(est, 1, 0))
        return
      }
      if (passo % 2 === 0) tocar(a.cena, 'hab-ralsei-coro')
      cantar(coro[ordem[passo]], cfg.voz, cfg.abertura)
    }, Infinity, aviso + 100)
  },
})

// ---------- ♦ Canção de Ninar ----------
// Uma pauta aparece na caixa e as notas de uma canção de ninar (a de Brahms)
// atravessam de um lado para o outro, cada uma na altura da sua nota: a
// melodia sobe e desce e é preciso passar entre as notas. Com força, uma
// segunda voz toca a melodia espelhada vindo do outro lado.
const MELODIA = [2, 2, 4, 2, 2, 4, 2, 4, 7, 6, 5, 5, 4, -1, 1, 2, 3, 1, 2, 3, 1, 3, 6, 5, 4, 6, 7, -1]
const ralseiCancaoNinar = definirAtaque({
  nome: 'ralseiCancaoNinar',
  padrao: { duracao: 5000, velocidade: 105, espaco: 66, vozes: 2, raio: 6 },
  iniciar(a, cfg) {
    const l = a.caixa
    const graus = 7
    const margem = cfg.raio + 8
    const passoY = (l.height - 2 * margem) / graus
    const yDoGrau = (g) => l.bottom - margem - g * passoY

    // a pauta (5 linhas, decoração)
    const pauta = a.decoracao(a.cena.add.graphics().setDepth(2))
    pauta.lineStyle(1, 0xd6d2ff, 0.22)
    for (let k = 1; k <= 5; k++) {
      const y = yDoGrau(k * 1.25 + 0.25)
      pauta.lineBetween(l.left, y, l.right, y)
    }

    // distância entre notas seguidas (no espaço, já com o ritmo da carta)
    a.lacuna(cfg.espaco - 2 * cfg.raio, 'espaço entre as notas')
    const passo = (cfg.espaco * 1000 * a.ritmo.densidade) / (cfg.velocidade * fv(a))

    for (let voz = 0; voz < cfg.vozes; voz++) {
      const daEsquerda = voz % 2 === 0
      const sentido = daEsquerda ? 1 : -1
      a.aCada(
        passo,
        (i) => {
          const g0 = MELODIA[(i + voz * 7) % MELODIA.length]
          if (g0 < 0) return // pausa da frase
          const g = daEsquerda ? g0 : graus - g0
          const x = daEsquerda ? l.left + cfg.raio + 2 : l.right - cfg.raio - 2
          const balanco = a.aleatorio(0, Math.PI * 2)
          a.bala({
            x,
            y: yDoGrau(g),
            vx: sentido * cfg.velocidade,
            raio: cfg.raio,
            textura: `${T}nota`,
            quadro: voz % 2,
            tamanho: cfg.raio * 2.8,
            pulso: 0.1,
            vida: ((l.width + 20) / (cfg.velocidade * fv(a))) * 1000,
            atualizar: (b) => b.sprite.setRotation(Math.sin(b.idade / 170 + balanco) * 0.3),
          })
        },
        Infinity,
        200 + voz * (passo / 2),
      )
    }
  },
})

// ---------- ♦ Feitiço de Sono ----------
// Roncos mágicos: trios de "Z" (do menor para o maior) brotam do chão e sobem
// em zigue-zague, crescendo enquanto sobem. Parte dos roncos nasce embaixo do
// coração (com um desvio), o resto em qualquer lugar.
const ralseiFeiticoSono = definirAtaque({
  nome: 'ralseiFeiticoSono',
  padrao: { duracao: 6000, intervalo: 850, velocidade: 65, trio: 3, espacoZ: 260, amplitude: 15, periodoZ: 950, mirar: 0.5, raioMin: 4, raioMax: 8 },
  iniciar(a, cfg) {
    let mira = 0.5

    const zzz = (x0, k) => {
      const l = a.caixa
      const y = l.bottom - cfg.raioMin - 2
      let fase = k * 0.18
      const tamanho = cfg.raioMin * 2.6
      let unidade = null
      a.bala({
        x: x0,
        y,
        vy: -cfg.velocidade,
        raio: cfg.raioMin,
        textura: `${T}zzz`,
        tamanho,
        pulso: 0.06,
        vida: ((l.height + 30) / (cfg.velocidade * fv(a))) * 1000,
        atualizar: (b, dt) => {
          unidade ??= b.escalaX / cfg.raioMin
          fase += (dt * fv(a)) / cfg.periodoZ
          // onda triangular: o caminho desenha um Z atrás do outro
          const tri = 2 * Math.abs(2 * (fase - Math.floor(fase + 0.5))) - 1
          b.x = x0 + tri * cfg.amplitude
          const subiu = limitar((y - b.y) / (l.height * 0.75), 0, 1)
          b.raio = cfg.raioMin + (cfg.raioMax - cfg.raioMin) * subiu
          b.escalaX = b.escalaY = unidade * b.raio
          b.sprite.setRotation(-0.2 + tri * 0.18)
        },
      })
    }

    a.aCada(cfg.intervalo, () => {
      const l = a.caixa
      mira += cfg.mirar
      const perto = mira >= 1
      if (perto) mira -= 1
      const m = cfg.amplitude + cfg.raioMax + 4
      const x0 = perto ? limitar(a.alvo().x + a.aleatorio(-22, 22), l.left + m, l.right - m) : a.aleatorio(l.left + m, l.right - m)
      particulas(a.cena, x0, l.bottom - 4, { cor: 0xd6d2ff, quantidade: 6, velocidade: 40, vida: 400 })
      for (let k = 0; k < cfg.trio; k++) a.depois(k * cfg.espacoZ, () => zzz(x0, k))
    }, Infinity, 150)
  },
})

// ---------- ♣ Bolinho Explosivo ----------
// Cupcakes aparecem no chão da caixa (parte deles do lado do coração). A vela
// vai queimando; quando acaba, o bolinho estoura: um chafariz de granulado sobe
// e cai de volta com a gravidade, e a cereja do topo voa em arco até onde o
// coração estava.
const ralseiBolinho = definirAtaque({
  nome: 'ralseiBolinho',
  padrao: { duracao: 5000, intervalo: 1600, contagem: 1300, granulos: 8, velocidade: 190, gravidade: 300, abertura: 1.7, mirar: 0.6, voo: 850, raio: 9 },
  iniciar(a, cfg) {
    let mira = 0.5
    const contagem = Math.max(ATAQUE.telegrafoMs * 2, cfg.contagem)

    const estourar = (x, y) => {
      tocar(a.cena, 'hab-ralsei-bolinho')
      particulas(a.cena, x, y, { cor: 0xffbad6, quantidade: 14, velocidade: 130 })
      for (let j = 0; j < cfg.granulos; j++) {
        const ang = -Math.PI / 2 + (j / Math.max(1, cfg.granulos - 1) - 0.5) * cfg.abertura + a.aleatorio(-0.08, 0.08)
        const v = cfg.velocidade * a.aleatorio(0.75, 1.1)
        a.bala({
          x,
          y: y - 6,
          vx: Math.cos(ang) * v,
          vy: Math.sin(ang) * v,
          ay: cfg.gravidade,
          raio: 3.5,
          textura: `${T}granulado`,
          quadro: j % 4,
          tamanho: 10,
          girar: 9,
          pulso: 0,
          jaAvisada: true,
        })
      }
      // a cereja: arco (com gravidade) que cai onde o coração estava
      const alvo = a.alvo()
      const voo = cfg.voo / 1000
      a.bala({
        x,
        y: y - 10,
        vx: (alvo.x - x) / voo,
        vy: (alvo.y - (y - 10)) / voo - 0.5 * cfg.gravidade * voo,
        ay: cfg.gravidade,
        raio: 5,
        textura: `${T}cereja`,
        tamanho: 12,
        girar: 3,
        pulso: 0.05,
        jaAvisada: true,
      })
    }

    a.aCada(cfg.intervalo, () => {
      const l = a.caixa
      mira += cfg.mirar
      const plantado = mira >= 1
      if (plantado) mira -= 1
      const y = l.bottom - 12
      const m = 16
      let x
      if (plantado) {
        const alvo = a.alvo()
        const lado = alvo.x - l.left < 50 ? 1 : l.right - alvo.x < 50 ? -1 : a.aleatorio(0, 1) < 0.5 ? -1 : 1
        x = limitar(alvo.x + lado * a.aleatorio(36, 60), l.left + m, l.right - m)
      } else x = a.aleatorio(l.left + m, l.right - m)

      // contagem: um círculo pulsando em volta do bolinho (some no estouro)
      const anel = a.decoracao(a.cena.add.graphics().setDepth(4))
      anel.lineStyle(2, 0xffbad6, 0.8)
      anel.strokeCircle(x, y, 22)
      a.cena.tweens.add({ targets: anel, alpha: 0.3, duration: 120, yoyo: true, repeat: -1 })
      let estourou = false
      a.bala({
        x,
        y,
        raio: cfg.raio,
        textura: `${T}bolinho`,
        quadro: 0,
        tamanho: 25,
        aviso: ATAQUE.telegrafoMs,
        pulso: 0.05,
        vida: contagem,
        atualizar: (b) => {
          const p = b.idade / contagem
          b.sprite.setFrame(p < 0.45 ? 0 : p < 0.75 ? 1 : p < 0.9 ? 2 : 3)
          if (p >= 1 && !estourou) {
            estourou = true
            b.morta = true
            a.cena.tweens.killTweensOf(anel)
            anel.setVisible(false)
            estourar(b.x, b.y)
          }
        },
      })
    }, Infinity, 200)
  },
})

// ---------- ♣ Fios de Lã ----------
// Novelos de lã entram por uma borda e rolam quicando pela caixa. A ponta do
// fio fica presa onde o novelo nasceu e ele vai desenrolando: o fio estica
// atrás do novelo (até `comprimento` px; depois a ponta é arrastada) e
// machuca como o próprio novelo.
const ralseiFiosLa = definirAtaque({
  nome: 'ralseiFiosLa',
  padrao: { duracao: 5000, intervalo: 1900, velocidade: 125, quiques: 2, comprimento: 100, pedaco: 9, raio: 7, espessura: 4 },
  iniciar(a, cfg) {
    const pedacos = Math.max(2, Math.round(cfg.comprimento / cfg.pedaco))

    a.aCada(cfg.intervalo, (i) => {
      const l = a.caixa
      const borda = [0, 2, 1, 3][i % 4] // esquerda, direita, cima, baixo
      const m = 22
      const x = borda === 0 ? l.left + cfg.raio + 1 : borda === 2 ? l.right - cfg.raio - 1 : a.aleatorio(l.left + m, l.right - m)
      const y = borda === 1 ? l.top + cfg.raio + 1 : borda === 3 ? l.bottom - cfg.raio - 1 : a.aleatorio(l.top + m, l.bottom - m)
      const alvo = a.alvo()
      const ang = Math.atan2(alvo.y - y, alvo.x - x) + a.aleatorio(-0.35, 0.35)
      const cor = i % 2
      const trajeto = [{ x, y }] // do nó (onde nasceu) até o novelo
      const fios = []

      // posiciona os pedaços do fio ao longo do trajeto, do novelo para trás;
      // os que passam do trajeto ainda estão enrolados no nó (onde ele nasceu)
      const esticar = () => {
        let k = 0
        let andado = 0
        for (let j = trajeto.length - 1; j > 0 && k < fios.length; j--) {
          const p = trajeto[j]
          const q = trajeto[j - 1]
          const seg = Math.hypot(p.x - q.x, p.y - q.y)
          while (k < fios.length && (k + 0.5) * cfg.pedaco <= andado + seg) {
            const r = seg > 0 ? ((k + 0.5) * cfg.pedaco - andado) / seg : 0
            fios[k].x = p.x + (q.x - p.x) * r
            fios[k].y = p.y + (q.y - p.y) * r
            fios[k].angulo = Math.atan2(p.y - q.y, p.x - q.x)
            k++
          }
          andado += seg
        }
        for (; k < fios.length; k++) {
          fios[k].x = trajeto[0].x
          fios[k].y = trajeto[0].y
        }
        // passou do comprimento: a ponta presa é arrastada (descarta o começo do trajeto)
        const precisa = cfg.comprimento + cfg.pedaco
        let total = 0
        for (let j = 1; j < trajeto.length; j++) total += Math.hypot(trajeto[j].x - trajeto[j - 1].x, trajeto[j].y - trajeto[j - 1].y)
        while (trajeto.length > 2) {
          const s0 = Math.hypot(trajeto[1].x - trajeto[0].x, trajeto[1].y - trajeto[0].y)
          if (total - s0 < precisa) break
          total -= s0
          trajeto.shift()
        }
      }

      const novelo = a.bala({
        x,
        y,
        vx: Math.cos(ang) * cfg.velocidade,
        vy: Math.sin(ang) * cfg.velocidade,
        raio: cfg.raio,
        textura: `${T}novelo`,
        quadro: cor,
        tamanho: cfg.raio * 2.5,
        quicar: cfg.quiques,
        girar: 7,
        pulso: 0.04,
        atualizar: (b) => {
          if (!fios.length) {
            for (let k = 0; k < pedacos; k++) {
              fios.push(
                a.bala({
                  x,
                  y,
                  comprimento: cfg.pedaco + 1,
                  espessura: cfg.espessura,
                  angulo: 0,
                  textura: `${T}fio`,
                  quadro: cor,
                  jaAvisada: true,
                  atualizar: (f) => {
                    if (novelo.morta) f.morta = true
                  },
                }),
              )
            }
          }
          const ult = trajeto[trajeto.length - 1]
          if (Math.hypot(b.x - ult.x, b.y - ult.y) >= 2) trajeto.push({ x: b.x, y: b.y })
          esticar()
        },
      })
    }, Infinity, 200)
  },
})

// ---------- ♣ Laço de Fita ----------
// Uma fita cor-de-rosa forma um laço em volta do coração, com o nó (um lacinho)
// de um lado e a ponta solta do outro (o vão). O laço pisca e então se APERTA
// em direção ao nó, como um cordão puxado: o vão vem varrendo a caixa até o
// nó e é por ele que se escapa. O lacinho fica no chão um tempo depois.
const ralseiLacoFita = definirAtaque({
  nome: 'ralseiLacoFita',
  padrao: { duracao: 6000, intervalo: 2300, raio: 58, vao: 116, aviso: 650, tempoApertar: 1300, pedaco: 13, espessura: 6, lacoFica: 900, aperto: 0.9 },
  iniciar(a, cfg) {
    const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
    const R = cfg.raio
    const meioVao = Math.asin(Math.min(1, cfg.vao / (2 * R)))
    // o vão (corda) encolhe junto com o laço; o coração passa por ele mais ou menos na metade do aperto
    a.lacuna((cfg.vao - 2 * (1 + cfg.espessura / 2)) * (1 - cfg.aperto * 0.5), 'vão da fita no meio do aperto')

    a.aCada(cfg.intervalo, (i) => {
      const l = a.caixa
      const alvo = a.alvo()
      // centro um pouco deslocado do coração: parado, ele não fica no caminho do vão
      const desvio = a.aleatorio(0, Math.PI * 2)
      const cx = limitar(alvo.x + Math.cos(desvio) * 22, l.left + 12, l.right - 12)
      const cy = limitar(alvo.y + Math.sin(desvio) * 22, l.top + 12, l.bottom - 12)
      // nó dentro da caixa
      let angNo = a.aleatorio(0, Math.PI * 2)
      for (let k = 0; k < 16; k++) {
        const nx = cx + Math.cos(angNo) * R
        const ny = cy + Math.sin(angNo) * R
        if (nx > l.left + 14 && nx < l.right - 14 && ny > l.top + 14 && ny < l.bottom - 14) break
        angNo = a.aleatorio(0, Math.PI * 2)
      }
      const no = { x: cx + Math.cos(angNo) * R, y: cy + Math.sin(angNo) * R }

      // a fita: o círculo menos o arco do vão (do lado oposto ao nó)
      const arco = Math.PI * 2 - 2 * meioVao
      const n = Math.max(6, Math.ceil((arco * R) / cfg.pedaco))
      const comp = (arco * R) / n + 2
      const inicio = angNo + Math.PI + meioVao
      for (let j = 0; j < n; j++) {
        const fi = inicio + ((j + 0.5) / n) * arco
        const px = cx + Math.cos(fi) * R
        const py = cy + Math.sin(fi) * R
        let escala = null
        a.bala({
          x: px,
          y: py,
          comprimento: comp,
          espessura: cfg.espessura,
          angulo: fi + Math.PI / 2,
          textura: `${T}fita`,
          aviso,
          atravessa: true,
          vida: cfg.tempoApertar + 60,
          atualizar: (b) => {
            escala ??= b.sprite.scaleX
            const p = limitar((b.idade - b.aviso) / cfg.tempoApertar, 0, 1)
            const k = 1 - cfg.aperto * suave(p)
            b.x = no.x + (px - no.x) * k
            b.y = no.y + (py - no.y) * k
            b.comprimento = comp * k
            b.sprite.setScale(escala * k, escala)
          },
        })
      }

      // o nó (lacinho): aperta junto e fica no chão um pouco depois
      let puxou = false
      a.bala({
        x: no.x,
        y: no.y,
        raio: 7,
        textura: `${T}laco`,
        tamanho: 22,
        aviso,
        pulso: 0.06,
        vida: cfg.tempoApertar + cfg.lacoFica,
        atualizar: (b) => {
          if (!puxou) {
            puxou = true
            tocar(a.cena, 'hab-ralsei-fita')
          }
          b.sprite.setRotation(Math.sin(b.idade / 90) * 0.15)
          if (b.vida < 300) b.sprite.setAlpha(Math.max(0.2, b.vida / 300))
        },
      })
    }, Infinity, 200)
  },
})

export default {
  ralseiEstrelaGentil,
  ralseiCoroEstrelas,
  ralseiCancaoNinar,
  ralseiFeiticoSono,
  ralseiBolinho,
  ralseiFiosLa,
  ralseiLacoFita,
}
