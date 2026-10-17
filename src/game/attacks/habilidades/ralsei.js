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
//   ralseiLacoFita        ♣ uma fita em laço se aperta em volta do coração; foge pelo vão
//   ralseiEmprestimo      ♣ (A♣) estrelas presas numa fitinha, como ioiô: vão até onde o
//                           coração estava, fazem uma reverência e voltam pelo mesmo caminho
//
// Justiça: os projéteis nascem fora da caixa e entram (a própria entrada é o
// aviso) ou saem de algo que já está à vista (rastro da estrela, fio do novelo,
// granulado do bolinho); a fita do laço se enrola e pisca antes de apertar.
// Lados, ordens e posições são sorteados com a semente do ataque. Os vãos entre
// notas e o vão do laço são declarados com a.lacuna.

const T = 'hab-ralsei-'
const fv = (a) => a.balas.fatorVelocidade ?? 1
const limitar = (v, min, max) => Math.min(max, Math.max(min, v))
const suave = (p) => p * p * (3 - 2 * p)

// As quatro paredes vistas de dentro: normal para dentro (n), eixo ao longo
// dela (ao), trecho [ini, fim], ponto(u, d) a d px para dentro (d < 0 = fora)
// e rot, a rotação que deixa "em pé" nela um sprite desenhado em pé no chão.
const LADOS = ['baixo', 'cima', 'esquerda', 'direita']
function parede(l, lado) {
  const deitada = lado === 'baixo' || lado === 'cima'
  const n = { baixo: { x: 0, y: -1 }, cima: { x: 0, y: 1 }, esquerda: { x: 1, y: 0 }, direita: { x: -1, y: 0 } }[lado]
  const borda = { baixo: l.bottom, cima: l.top, esquerda: l.left, direita: l.right }[lado]
  return {
    lado,
    n,
    ao: deitada ? 'x' : 'y',
    ini: deitada ? l.left : l.top,
    fim: deitada ? l.right : l.bottom,
    ponto: (u, d) => (deitada ? { x: u, y: borda + n.y * d } : { x: borda + n.x * d, y: u }),
    rot: { baixo: 0, cima: Math.PI, esquerda: Math.PI / 2, direita: -Math.PI / 2 }[lado],
  }
}

// ângulo `ang` corrigido para apontar para dentro da caixa a partir da parede de normal n
// (pelo menos `minimo` de cosseno com a normal)
function paraDentro(ang, n, minimo = 0.3) {
  const base = Math.atan2(n.y, n.x)
  const d = Math.atan2(Math.sin(ang - base), Math.cos(ang - base))
  const max = Math.acos(minimo)
  return base + limitar(d, -max, max)
}

// distância de (x, y) até a borda da caixa andando na direção ang
function ateABorda(l, x, y, ang) {
  const dx = Math.cos(ang)
  const dy = Math.sin(ang)
  const tx = dx > 1e-6 ? (l.right - x) / dx : dx < -1e-6 ? (l.left - x) / dx : Infinity
  const ty = dy > 1e-6 ? (l.bottom - y) / dy : dy < -1e-6 ? (l.top - y) / dy : Infinity
  return Math.max(0, Math.min(tx, ty))
}

// ---------- ♠ Estrela Gentil ----------
// Estrelas cadentes entram por cima da caixa (de um ponto sorteado, de um lado
// ou do outro do coração) e caem miradas nele, deixando um rastro de brilhos
// que fica parado no ar por `rastro` ms: depois de desviar, não volte pelo
// rastro. Sem linha de caminho: a estrela entrando é o aviso.
const ralseiEstrelaGentil = definirAtaque({
  nome: 'ralseiEstrelaGentil',
  padrao: { duracao: 5000, intervalo: 1100, velocidade: 170, raio: 7, rastro: 550, passoRastro: 11, porVez: 1 },
  iniciar(a, cfg) {
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

    const lancar = () => {
      const l = a.caixa
      const alvo = a.alvo()
      const lado = a.escolher([-1, 1])
      const x = limitar(alvo.x + lado * a.aleatorio(l.width * 0.12, l.width * 0.45), l.left - 10, l.right + 10)
      const y = l.top - cfg.raio - a.aleatorio(6, 20) // fora da caixa, em cima
      const ang = Math.atan2(Math.max(40, alvo.y - y), alvo.x - x) // sempre para baixo
      const alcance = ateABorda(l, x, y, ang)
      tocar(a.cena, 'hab-ralsei-estrela')
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
        jaAvisada: true,
        girar: 5,
        vida: ((alcance + 30) / (cfg.velocidade * fv(a))) * 1000,
        atualizar: (b) => {
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

    a.aCada(cfg.intervalo, () => {
      // as do mesmo lançamento saem com um pouquinho de diferença
      for (let k = 0; k < cfg.porVez; k++) a.depois(k * a.aleatorio(90, 220), lancar)
    }, Infinity, 200)
  },
})

// ---------- ♠ Coro de Estrelas ----------
// Um coro de estrelinhas (olhos fechados, cantando) desce de fora da caixa e
// fica na borda de cima, cada uma num lugar um pouco sorteado. Elas cantam uma
// de cada vez, numa onda que vai e volta pelo coro (começando de uma cantora e
// num sentido sorteados a cada frase), e cada nota cantada é uma rajada de
// estrelinhas miradas no coração. No fim de cada frase (força alta) o coro
// inteiro canta junto: uma estrelinha de cada cantora, todas convergindo para
// onde o coração estava.
const ralseiCoroEstrelas = definirAtaque({
  nome: 'ralseiCoroEstrelas',
  padrao: { duracao: 6000, cantores: 5, intervalo: 450, velocidade: 150, voz: 3, abertura: 0.3, raio: 8, raioVoz: 4.5, coroCheio: true, entrada: 450 },
  iniciar(a, cfg) {
    const l = a.caixa
    const n = cfg.cantores
    const coro = []
    for (let k = 0; k < n; k++) {
      const x = l.left + (l.width * (k + 0.5 + a.aleatorio(-0.18, 0.18))) / n
      const y0 = l.top + cfg.raio + 4 + a.aleatorio(0, 6)
      const yFora = l.top - cfg.raio - 6
      const fase = a.aleatorio(0, Math.PI * 2)
      const atraso = a.aleatorio(0, 120)
      const est = a.bala({
        x,
        y: yFora,
        raio: cfg.raio,
        textura: `${T}coro`,
        quadro: 0,
        tamanho: cfg.raio * 2.6,
        jaAvisada: true,
        pulso: 0.04,
        vida: cfg.duracao + 1500,
        // desce para o lugar e balança devagar, no ritmo da música
        atualizar: (b) => {
          const q = limitar((b.idade - atraso) / cfg.entrada, 0, 1)
          b.y = yFora + (y0 - yFora) * suave(q) + Math.sin(b.idade / 260 + fase) * 2 * q
          if (b.cantaAte && b.idade > b.cantaAte) {
            b.cantaAte = 0
            b.sprite.setFrame(0)
            b.escalaX = b.escalaY = b.base
          }
        },
      })
      est.base = est.escalaX
      coro.push(est)
    }

    const cantar = (est, voz, abertura) => {
      if (est.morta) return
      est.sprite.setFrame(1)
      est.escalaX = est.escalaY = est.base * 1.25 // incha ao cantar
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

    // uma frase: a onda começa numa cantora sorteada, num sentido sorteado, e vai e
    // volta pelo coro (2n - 2 notas, quicando nas pontas); fecha com o coro cheio
    const fila = []
    const novaFrase = () => {
      let k = a.inteiro(0, n - 1)
      let d = a.escolher([1, -1])
      for (let passo = 0; passo < Math.max(1, 2 * n - 2); passo++) {
        fila.push(k)
        if (k + d < 0 || k + d > n - 1) d = -d
        k += d
      }
      if (cfg.coroCheio) fila.push('todos')
    }
    let cantadas = 0
    a.aCada(cfg.intervalo, () => {
      if (!fila.length) novaFrase()
      const vez = fila.shift()
      if (vez === 'todos') {
        // o coro inteiro canta junto
        tocar(a.cena, 'hab-ralsei-coro')
        coro.forEach((est) => cantar(est, 1, 0))
        return
      }
      if (cantadas++ % 2 === 0) tocar(a.cena, 'hab-ralsei-coro')
      cantar(coro[vez], cfg.voz, cfg.abertura)
    }, Infinity, cfg.entrada + 250)
  },
})

// ---------- ♦ Canção de Ninar ----------
// Uma pauta aparece na caixa e as notas de uma canção de ninar (a de Brahms)
// entram por um lado (sorteado) e atravessam a caixa, cada uma na altura da
// sua nota: a melodia sobe e desce e é preciso passar entre as notas. Cada vez
// a canção começa num ponto sorteado da melodia (e às vezes um grau abaixo).
// Com força, uma segunda voz toca a melodia espelhada vindo do outro lado.
const MELODIA = [2, 2, 4, 2, 2, 4, 2, 4, 7, 6, 5, 5, 4, -1, 1, 2, 3, 1, 2, 3, 1, 3, 6, 5, 4, 6, 7, -1]
const ralseiCancaoNinar = definirAtaque({
  nome: 'ralseiCancaoNinar',
  padrao: { duracao: 5000, velocidade: 105, espaco: 66, vozes: 2, raio: 7 },
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
    const primeiraDaEsquerda = a.escolher([true, false])

    for (let voz = 0; voz < cfg.vozes; voz++) {
      const daEsquerda = (voz % 2 === 0) === primeiraDaEsquerda
      const sentido = daEsquerda ? 1 : -1
      const inicio = a.inteiro(0, MELODIA.length - 1)
      const tom = a.escolher([0, 0, -1]) // às vezes a voz canta um grau abaixo
      a.aCada(
        passo,
        (i) => {
          const g0 = MELODIA[(i + inicio) % MELODIA.length]
          if (g0 < 0) return // pausa da frase
          const g = limitar(daEsquerda ? g0 + tom : graus - g0 - tom, 0, graus)
          const x = daEsquerda ? l.left - cfg.raio - 8 : l.right + cfg.raio + 8 // nasce fora e entra
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
            jaAvisada: true,
            vida: ((l.width + 2 * cfg.raio + 36) / (cfg.velocidade * fv(a))) * 1000,
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
// Roncos mágicos: trios de "Z" (do menor para o maior) entram por baixo do
// chão e sobem em zigue-zague, crescendo enquanto sobem. Parte dos roncos
// (sorteada, `mirar`) nasce embaixo do coração (com um desvio), o resto em
// qualquer lugar.
const ralseiFeiticoSono = definirAtaque({
  nome: 'ralseiFeiticoSono',
  padrao: { duracao: 6000, intervalo: 850, velocidade: 65, trio: 3, espacoZ: 260, amplitude: 15, periodoZ: 950, mirar: 0.5, raioMin: 4, raioMax: 8 },
  iniciar(a, cfg) {
    const zzz = (x0, k, fase0) => {
      const l = a.caixa
      const y = l.bottom + cfg.raioMin + 6 // fora da caixa, embaixo do chão
      let fase = fase0 + k * 0.18
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
        jaAvisada: true,
        vida: ((l.height + 50) / (cfg.velocidade * fv(a))) * 1000,
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
      const perto = a.aleatorio(0, 1) < cfg.mirar
      const m = cfg.amplitude + cfg.raioMax + 4
      const x0 = perto ? limitar(a.alvo().x + a.aleatorio(-22, 22), l.left + m, l.right - m) : a.aleatorio(l.left + m, l.right - m)
      const fase0 = a.aleatorio(0, 1) // o zigue-zague começa para um lado ou para o outro
      particulas(a.cena, x0, l.bottom - 4, { cor: 0xd6d2ff, quantidade: 6, velocidade: 40, vida: 400 })
      for (let k = 0; k < cfg.trio; k++) a.depois(k * cfg.espacoZ, () => zzz(x0, k, fase0))
    }, Infinity, 150)
  },
})

// ---------- ♣ Bolinho Explosivo ----------
// Cupcakes deslizam de fora da caixa e grudam numa parede sorteada (chão, teto
// ou laterais; parte deles na altura do coração). A vela vai queimando; quando
// acaba, o bolinho estoura: um chafariz de granulado sai da parede para dentro
// da caixa e cai com a gravidade, e a cereja do topo voa em arco até onde o
// coração estava. Sem círculo de contagem: a vela é o relógio.
const ralseiBolinho = definirAtaque({
  nome: 'ralseiBolinho',
  padrao: { duracao: 5000, intervalo: 1600, contagem: 1300, granulos: 8, velocidade: 190, gravidade: 300, abertura: 1.7, mirar: 0.6, voo: 850, raio: 9, entrada: 240 },
  iniciar(a, cfg) {
    const contagem = Math.max(ATAQUE.telegrafoMs * 2, cfg.contagem)

    const estourar = (x, y, n) => {
      tocar(a.cena, 'hab-ralsei-bolinho')
      particulas(a.cena, x, y, { cor: 0xffbad6, quantidade: 14, velocidade: 130 })
      const base = Math.atan2(n.y, n.x) // o chafariz sai da parede para dentro
      // do teto o granulado já sai a favor da gravidade: mais devagar
      const forca = n.y > 0 ? 0.6 : 1
      for (let j = 0; j < cfg.granulos; j++) {
        const ang = base + (j / Math.max(1, cfg.granulos - 1) - 0.5) * cfg.abertura + a.aleatorio(-0.08, 0.08)
        const v = cfg.velocidade * forca * a.aleatorio(0.75, 1.1)
        a.bala({
          x: x + n.x * 6,
          y: y + n.y * 6,
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
      const cx = x + n.x * 10
      const cy = y + n.y * 10
      a.bala({
        x: cx,
        y: cy,
        vx: (alvo.x - cx) / voo,
        vy: (alvo.y - cy) / voo - 0.5 * cfg.gravidade * voo,
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
      const p = parede(l, a.escolher(LADOS))
      const plantado = a.aleatorio(0, 1) < cfg.mirar
      const m = 16
      let u
      if (plantado) {
        const alvo = a.alvo()
        const uAlvo = p.ao === 'x' ? alvo.x : alvo.y
        const lado = uAlvo - p.ini < 50 ? 1 : p.fim - uAlvo < 50 ? -1 : a.escolher([-1, 1])
        u = limitar(uAlvo + lado * a.aleatorio(36, 60), p.ini + m, p.fim - m)
      } else u = a.aleatorio(p.ini + m, p.fim - m)
      const fora = p.ponto(u, -14)
      const lugar = p.ponto(u, 12)

      // a CPU lê a contagem do bolinho (o estouro sai da parede para dentro)
      a.zonaPerigo({ tipo: 'circulo', x: lugar.x + p.n.x * 12, y: lugar.y + p.n.y * 12, raio: 34 }, { ms: cfg.entrada + contagem, dura: 300 })
      let estourou = false
      const bolinho = a.bala({
        ...fora,
        raio: cfg.raio,
        textura: `${T}bolinho`,
        quadro: 0,
        tamanho: 25,
        jaAvisada: true,
        pulso: 0.05,
        vida: cfg.entrada + contagem + 100,
        atualizar: (b) => {
          // entra deslizando e gruda na parede
          const e = suave(limitar(b.idade / cfg.entrada, 0, 1))
          b.x = fora.x + (lugar.x - fora.x) * e
          b.y = fora.y + (lugar.y - fora.y) * e
          const q = (b.idade - cfg.entrada) / contagem
          b.sprite.setFrame(q < 0.45 ? 0 : q < 0.75 ? 1 : q < 0.9 ? 2 : 3)
          if (q >= 1 && !estourou) {
            estourou = true
            b.morta = true
            estourar(b.x, b.y, p.n)
          }
        },
      })
      bolinho.sprite.setRotation(p.rot)
    }, Infinity, 200)
  },
})

// ---------- ♣ Fios de Lã ----------
// Novelos de lã entram por uma borda sorteada (de fora da caixa) e rolam
// quicando pela caixa, mirando perto do coração. A ponta do fio fica presa
// onde o novelo nasceu e ele vai desenrolando: o fio estica
// atrás do novelo (até `comprimento` px; depois a ponta é arrastada) e
// machuca como o próprio novelo.
const ralseiFiosLa = definirAtaque({
  nome: 'ralseiFiosLa',
  padrao: { duracao: 5000, intervalo: 1900, velocidade: 125, quiques: 2, comprimento: 100, pedaco: 9, raio: 7, espessura: 4 },
  iniciar(a, cfg) {
    const pedacos = Math.max(2, Math.round(cfg.comprimento / cfg.pedaco))

    let anterior = null
    a.aCada(cfg.intervalo, () => {
      const l = a.caixa
      const p = parede(l, a.escolher(LADOS.filter((lado) => lado !== anterior)))
      anterior = p.lado
      const m = 22
      const { x, y } = p.ponto(a.aleatorio(p.ini + m, p.fim - m), -(cfg.raio + 8)) // nasce fora e entra
      const alvo = a.alvo()
      const ang = paraDentro(Math.atan2(alvo.y - y, alvo.x - x) + a.aleatorio(-0.35, 0.35), p.n)
      const cor = a.inteiro(0, 1)
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
        jaAvisada: true,
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
// O lacinho (o nó) voa de fora da caixa até perto do coração e dele a fita
// cor-de-rosa se enrola num laço em volta do coração, com a ponta solta do
// outro lado (o vão). A fita pisca (`aviso`) e então se APERTA em direção ao
// nó, como um cordão puxado: o vão vem varrendo a caixa até o nó e é por ele
// que se escapa. O vão aponta para um dos lados com mais caixa livre
// (sorteado entre eles). Quando o laço fecha, o lacinho estoura em `faiscas`
// (uma no coração) e fica no chão um tempo.
const ralseiLacoFita = definirAtaque({
  nome: 'ralseiLacoFita',
  padrao: { duracao: 6000, intervalo: 2300, raio: 58, vao: 70, aviso: 650, enrolar: 220, voo: 240, tempoApertar: 1300, pedaco: 13, espessura: 6, lacoFica: 900, aperto: 0.9, faiscas: 0, velocidadeFaisca: 120 },
  iniciar(a, cfg) {
    const aviso = Math.max(ATAQUE.telegrafoMs, cfg.aviso)
    const R = cfg.raio
    const meioVao = Math.asin(Math.min(1, cfg.vao / (2 * R)))
    // o laço aperta em direção ao centro: o vão (corda) encolhe junto; é preciso sair por ele logo no começo
    a.lacuna(cfg.vao - cfg.espessura, 'vão da fita quando ela começa a apertar')
    const inicioAperto = cfg.enrolar + aviso // ms (idade do nó) em que o laço começa a apertar
    const aperto = (dt) => 1 - cfg.aperto * suave(limitar(dt / cfg.tempoApertar, 0, 1))

    const estouro = (x, y) => {
      if (!(cfg.faiscas > 0)) return
      const alvo = a.alvo()
      const base = Math.atan2(alvo.y - y, alvo.x - x)
      for (let k = 0; k < cfg.faiscas; k++) {
        const ang = base + (k * Math.PI * 2) / cfg.faiscas
        a.bala({
          x,
          y,
          vx: Math.cos(ang) * cfg.velocidadeFaisca,
          vy: Math.sin(ang) * cfg.velocidadeFaisca,
          raio: 3.5,
          textura: `${T}faisca`,
          quadro: k % 3,
          tamanho: 10,
          girar: 3,
          jaAvisada: true,
          vida: 2200,
        })
      }
    }

    a.aCada(cfg.intervalo, () => {
      const l = a.caixa
      const alvo = a.alvo()
      // centro um pouco deslocado do coração (parado, ele fica no caminho da fita)
      const desvio = a.aleatorio(0, Math.PI * 2)
      const cx = limitar(alvo.x + Math.cos(desvio) * 22, l.left + 12, l.right - 12)
      const cy = limitar(alvo.y + Math.sin(desvio) * 22, l.top + 12, l.bottom - 12)
      // o vão aponta para um dos lados com mais caixa livre (nunca para a parede); o nó fica do lado oposto
      const dirs = [...Array(16).keys()].map((k) => {
        const ang = (k / 16) * Math.PI * 2
        return { ang, livre: ateABorda(l, cx, cy, ang) }
      })
      const maior = Math.max(...dirs.map((d) => d.livre))
      const angVao = a.escolher(dirs.filter((d) => d.livre >= maior * 0.7)).ang + a.aleatorio(-0.15, 0.15)
      const angNo = angVao + Math.PI
      const no = { x: cx + Math.cos(angNo) * R, y: cy + Math.sin(angNo) * R }

      // o nó entra voando pela borda mais perto dele
      const lado = [
        ['esquerda', no.x - l.left],
        ['direita', l.right - no.x],
        ['cima', no.y - l.top],
        ['baixo', l.bottom - no.y],
      ].sort((p, q) => p[1] - q[1])[0][0]
      const pn = parede(l, lado)
      const fora = pn.ponto(pn.ao === 'x' ? no.x : no.y, -14)
      const voo = Math.min(cfg.voo, cfg.enrolar + aviso)
      let puxou = false
      a.bala({
        ...fora,
        raio: 7,
        textura: `${T}laco`,
        tamanho: 22,
        jaAvisada: true,
        pulso: 0.06,
        vida: inicioAperto + cfg.tempoApertar + cfg.lacoFica,
        atualizar: (b) => {
          if (b.idade < voo) {
            const e = suave(b.idade / voo)
            b.x = fora.x + (no.x - fora.x) * e
            b.y = fora.y + (no.y - fora.y) * e
            b.sprite.setRotation((1 - e) * 4)
            return
          }
          const dt = b.idade - inicioAperto
          if (dt >= 0 && !puxou) {
            puxou = true
            tocar(a.cena, 'hab-ralsei-fita')
          }
          if (dt >= cfg.tempoApertar && !b.estourou) {
            b.estourou = true
            estouro(b.x, b.y)
          }
          const k = aperto(Math.max(0, dt))
          b.x = cx + Math.cos(angNo) * R * k
          b.y = cy + Math.sin(angNo) * R * k
          b.sprite.setRotation(Math.sin(b.idade / 90) * 0.15)
          if (b.vida < 300) b.sprite.setAlpha(Math.max(0.2, b.vida / 300))
        },
      })

      // a fita: o círculo menos o arco do vão, enrolando a partir do nó (dos dois lados)
      const arco = Math.PI * 2 - 2 * meioVao
      const n = Math.max(6, Math.ceil((arco * R) / cfg.pedaco))
      const comp = (arco * R) / n + 2
      const inicio = angVao + meioVao
      for (let j = 0; j < n; j++) {
        const fi = inicio + ((j + 0.5) / n) * arco
        // distância (0 a 1) do pedaço até o nó, ao longo da fita
        const doNo = Math.abs((j + 0.5) / n - 0.5) * 2
        const quando = cfg.enrolar * doNo
        a.depois(quando, () => {
          let escala = null
          a.bala({
            x: cx + Math.cos(fi) * R,
            y: cy + Math.sin(fi) * R,
            comprimento: comp,
            espessura: cfg.espessura,
            angulo: fi + Math.PI / 2,
            textura: `${T}fita`,
            aviso: aviso + cfg.enrolar - quando, // todos passam a valer juntos
            atravessa: true,
            vida: cfg.tempoApertar + 60,
            atualizar: (b) => {
              escala ??= b.sprite.scaleX
              const k = aperto(b.idade - b.aviso)
              b.x = cx + Math.cos(fi) * R * k
              b.y = cy + Math.sin(fi) * R * k
              b.comprimento = comp * k
              b.sprite.setScale(escala * k, escala)
            },
          })
        })
      }
    }, Infinity, 200)
  },
})

// ---------- ♣ Empréstimo Educado (A♣) ----------
// "Com licença, posso pegar emprestado?" Estrelas presas numa fitinha espiam
// por trás das paredes do lado (num ponto sorteado; a estrela aparecendo na
// borda é o aviso, sem linha de caminho) e saem como ioiô: vão até onde o
// coração estava (freando),
// fazem uma reverência e VOLTAM pelo mesmo caminho, acelerando, devolvendo o
// lugar. A fita fica esticada o tempo todo entre a parede e a estrela: ela
// mostra por onde a estrela vai voltar (a fita em si não machuca).
// Com `juros`, na reverência a estrela solta faíscas devagar em cruz.
//
// Justiça: a estrela fica `espiar` ms meio para fora da parede (inofensiva lá
// fora) antes de sair; a volta é pelo mesmo caminho, marcado pela fita.
//
//   intervalo, porVez   ms entre lançamentos; estrelas por lançamento (a 2ª sai
//                       do outro lado, `atraso` ms depois, mirando de novo);
//                       o lado da 1ª é sorteado
//   velocidade          px/s médios na ida (a volta é um pouco mais rápida)
//   parada              ms da reverência no ponto do empréstimo
//   juros               faíscas soltas na reverência (0 desliga)
const ralseiEmprestimo = definirAtaque({
  nome: 'ralseiEmprestimo',
  padrao: { duracao: 5000, intervalo: 1300, porVez: 1, atraso: 380, velocidade: 190, parada: 380, juros: 0, velocidadeJuros: 70, raio: 8, espiar: 560 },
  iniciar(a, cfg) {
    const COR_FITA = 0x7fe0a0

    const lancar = (daEsquerda) => {
      const l = a.caixa
      const m = cfg.raio + 4
      // a estrela espia com o centro para fora da parede (só a pontinha aparece)
      const ox = daEsquerda ? l.left - cfg.raio + 3 : l.right + cfg.raio - 3
      const oy = l.top + m + a.aleatorio(0, l.height - 2 * m)
      const alvo0 = a.alvo()
      if (Math.hypot(alvo0.x - ox, alvo0.y - oy) < 40) return
      const fita = a.decoracao(a.cena.add.graphics().setDepth(3))
      let relogio = 0
      let fase = 'espiar'
      let curvou = false
      let dx = ox
      let dy = oy
      let ida = 1
      let volta = 1
      a.bala({
        x: ox,
        y: oy,
        raio: cfg.raio,
        textura: `${T}estrela`,
        quadro: 0,
        tamanho: cfg.raio * 2.7,
        jaAvisada: true,
        atualizar: (b, dt) => {
          relogio += dt * fv(a)
          let p = 0
          if (fase === 'espiar') {
            // balança na borda; no fim mira onde o coração está e sai
            b.sprite.setRotation(Math.sin(relogio / 60) * 0.3)
            if (relogio >= cfg.espiar) {
              const alvo = a.alvo()
              dx = limitar(alvo.x, l.left + m, l.right - m)
              dy = limitar(alvo.y, l.top + m, l.bottom - m)
              ida = (Math.hypot(dx - ox, dy - oy) / cfg.velocidade) * 1000 * 1.4 // ease-out: sai rápido e freia
              volta = ida * 0.8
              fase = 'ida'
              relogio = 0
              tocar(a.cena, 'hab-ralsei-estrela')
            }
          } else if (fase === 'ida') {
            const q = Math.min(1, relogio / ida)
            p = 1 - (1 - q) * (1 - q)
            b.sprite.rotation += dt * 0.012
            if (q >= 1) {
              fase = 'parada'
              relogio = 0
            }
          } else if (fase === 'parada') {
            p = 1
            // a reverência: inclina para a frente e volta, piscando o olhinho
            const q = Math.min(1, relogio / cfg.parada)
            b.sprite.setRotation(Math.sin(q * Math.PI) * 0.6 * (daEsquerda ? 1 : -1))
            b.sprite.setFrame(q > 0.3 && q < 0.7 ? 1 : 0)
            if (!curvou && q > 0.4) {
              curvou = true
              pagarJuros(b.x, b.y)
            }
            if (q >= 1) {
              fase = 'volta'
              relogio = 0
            }
          } else {
            const q = Math.min(1, relogio / volta)
            p = 1 - q * q
            b.sprite.rotation -= dt * 0.015
            if (q >= 1) {
              b.morta = true
              particulas(a.cena, ox, oy, { cor: 0xa8f0c0, quantidade: 6 })
            }
          }
          b.x = ox + (dx - ox) * p
          b.y = oy + (dy - oy) * p
          fita.clear().lineStyle(2, COR_FITA, 0.55).lineBetween(ox, oy, b.x, b.y)
          if (b.morta) fita.destroy()
        },
      })
    }

    // juros: faíscas lentas em cruz (giram um pouco a cada empréstimo)
    let giro = 0
    const pagarJuros = (x, y) => {
      if (!(cfg.juros > 0)) return
      giro += 0.5
      for (let k = 0; k < cfg.juros; k++) {
        const ang = giro + (k * Math.PI * 2) / cfg.juros
        a.bala({
          x: x + Math.cos(ang) * 6,
          y: y + Math.sin(ang) * 6,
          vx: Math.cos(ang) * cfg.velocidadeJuros,
          vy: Math.sin(ang) * cfg.velocidadeJuros,
          raio: 3.5,
          textura: `${T}faisca`,
          quadro: k % 3,
          tamanho: 10,
          girar: 3,
          jaAvisada: true,
          vida: 2200,
        })
      }
    }

    a.aCada(cfg.intervalo, () => {
      const lado = a.escolher([true, false])
      lancar(lado)
      for (let k = 1; k < cfg.porVez; k++) a.depois(cfg.atraso * k, () => lancar(k % 2 ? !lado : lado))
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
  ralseiEmprestimo,
}
