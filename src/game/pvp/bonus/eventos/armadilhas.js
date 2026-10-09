import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'

// ARMADILHAS (TEMPLO): o chão das caixas está cheio de truques.
//   - PLACAS DE PRESSÃO: aparecem no chão (inofensivas), cada uma com setas
//     entalhadas mostrando a linha que ela protege (↔ ou ↕). Pisou: CLIQUE,
//     a placa afunda, a linha dela pisca em vermelho e as fendas das paredes
//     acendem; um instante depois dardos saem das duas paredes por aquela
//     linha (balas normais, com o "!" de aviso de sempre na parede). Dá tempo
//     de sair da linha. A placa some e outra aparece em outro lugar.
//   - ESPINHOS: de tempos em tempos um padrão de lajes (colunas, faixas,
//     xadrez, borda ou miolo) começa a estalar e as pontas aparecem nas
//     frestas (o aviso); aí os espinhos SOBEM de uma vez e machucam por meio
//     segundo. O padrão sempre deixa lajes livres de pelo menos 3 corações, e
//     é o mesmo nas duas caixas. As áreas são balas retangulares invisíveis
//     ainda avisando (a CPU enxerga e foge delas como de qualquer bala).

const PLACA = { lado: 18, porCaixa: 2, surgeMs: 350, renasceMs: { min: 1100, max: 1900 }, longeCoracao: 46 }
const DARDOS = { avisoMs: 560, vel: 290, porLado: 2, espacoMs: 150, dano: 4, comprimento: 20 }
const ESPINHOS = { primeiro: 1700, periodo: { min: 3500, max: 4300 }, avisoMs: 950, sobeMs: 600, dano: 4, passo: 10 }
const VERMELHO = 0xff3a2a
const PEDRA = 0x6a5236
const TEXTURA_DARDO = 'bonus-templo-dardo'

// padrões de espinhos: retângulos em frações da caixa [x0, y0, x1, y1]
const PADROES = {
  colunasA: [[0, 0, 0.25, 1], [0.5, 0, 0.75, 1]],
  colunasB: [[0.25, 0, 0.5, 1], [0.75, 0, 1, 1]],
  faixasFora: [[0, 0, 1, 0.34], [0, 0.66, 1, 1]],
  faixaMeio: [[0, 0.34, 1, 0.66]],
  xadrez: [0, 1, 2].flatMap((y) => [0, 1, 2, 3].filter((x) => (x + y) % 2 === 0).map((x) => [x / 4, y / 3, (x + 1) / 4, (y + 1) / 3])),
  borda: [[0, 0, 1, 0.24], [0, 0.76, 1, 1], [0, 0.24, 0.2, 0.76], [0.8, 0.24, 1, 0.76]],
  miolo: [[0.26, 0.28, 0.74, 0.72]],
}

// dardo de pixel art apontando para a DIREITA (penas vermelhas, haste, ponta de metal)
function criarTextura(arena) {
  if (arena.textures.exists(TEXTURA_DARDO)) return
  const mapa = ['r............', 'rr.........w.', 'rrhhhhhhhhhww', 'rr.........w.', 'r............']
  const cores = { r: '#c83a2a', h: '#9a7444', w: '#e8e8f0' }
  const c = document.createElement('canvas')
  c.width = mapa[0].length
  c.height = mapa.length
  const g = c.getContext('2d')
  mapa.forEach((linha, y) => [...linha].forEach((ch, x) => {
    if (!cores[ch]) return
    g.fillStyle = cores[ch]
    g.fillRect(x, y, 1, 1)
  }))
  arena.textures.addCanvas(TEXTURA_DARDO, c)
}

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + (b - a) * sorte()
  let ativo = false
  let t = 0
  let caixas = [] // por pista: { pista, g, placas: [{ x, y, eixo, nasceu, pisada, disparoEm, someEm }], renasceEm: [] }
  let espinhos = null // { zonas: [[x0,y0,x1,y1] em frações], inicio, padrao, cliques }
  let proximoEspinho = 0

  const viva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !arena.ko?.[j] ? p : null
  }

  // ---------- placas ----------

  const novaPlaca = (cx) => {
    const l = cx.pista.caixa.limites
    const c = cx.pista.coracoes[0]
    const m = 22
    for (let tentativa = 0; tentativa < 20; tentativa++) {
      const x = entre(l.left + m, l.right - m)
      const y = entre(l.top + m, l.bottom - m)
      if (c?.ativo && Math.hypot(c.x - x, c.y - y) < PLACA.longeCoracao) continue
      if (cx.placas.some((p) => Math.hypot(p.x - x, p.y - y) < 54)) continue
      cx.placas.push({ x, y, eixo: sorte() < 0.5 ? 'h' : 'v', nasceu: t, pisada: false, disparoEm: 0, someEm: Infinity })
      return
    }
  }

  const dispararDardos = (cx, placa) => {
    const pista = cx.pista
    if (!pista.atacando) return
    const l = pista.caixa.limites
    const h = placa.eixo === 'h'
    for (const lado of [-1, 1]) {
      for (let k = 0; k < DARDOS.porLado; k++) {
        // começa fora da caixa (na fenda da parede) e avisa com o "!" de sempre
        const x = h ? (lado < 0 ? l.left - 10 - k * 26 : l.right + 10 + k * 26) : placa.x
        const y = h ? placa.y : lado < 0 ? l.top - 10 - k * 26 : l.bottom + 10 + k * 26
        const angulo = h ? (lado < 0 ? 0 : Math.PI) : lado < 0 ? Math.PI / 2 : -Math.PI / 2
        pista.balas.criar({
          x,
          y,
          comprimento: DARDOS.comprimento,
          espessura: 4,
          angulo,
          vx: h ? -lado * DARDOS.vel : 0,
          vy: h ? 0 : -lado * DARDOS.vel,
          textura: TEXTURA_DARDO,
          aviso: DARDOS.avisoMs + k * DARDOS.espacoMs - (t - placa.pisadaEm),
          dano: DARDOS.dano,
          origem: 'bonus-armadilhas-dardo',
        })
      }
    }
  }

  const pisar = (cx, placa) => {
    placa.pisada = true
    placa.pisadaEm = t
    placa.disparoEm = t + DARDOS.avisoMs
    placa.someEm = t + DARDOS.avisoMs + 600
    tocar(arena, 'clique')
    dispararDardos(cx, placa)
    arena.time.delayedCall(DARDOS.avisoMs, () => ativo && tocar(arena, 'dardo'))
  }

  const desenharPlacas = (cx) => {
    const g = cx.g
    const l = cx.pista.caixa.limites
    const s = PLACA.lado / 2
    for (const p of cx.placas) {
      const surgir = Math.min(1, (t - p.nasceu) / PLACA.surgeMs)
      const sumir = p.pisada ? Math.max(0, 1 - Math.max(0, t - p.disparoEm) / 600) : 1
      const a = surgir * sumir
      if (p.pisada && t < p.disparoEm + 250) {
        // a linha protegida pisca em vermelho e as fendas das paredes acendem
        const pisca = Math.sin(t / 45) > 0 ? 0.32 : 0.14
        g.fillStyle(VERMELHO, pisca)
        if (p.eixo === 'h') g.fillRect(l.left, p.y - 4, l.width, 8)
        else g.fillRect(p.x - 4, l.top, 8, l.height)
        g.fillStyle(0xffb040, 0.9)
        if (p.eixo === 'h') {
          g.fillRect(l.left, p.y - 5, 4, 10)
          g.fillRect(l.right - 4, p.y - 5, 4, 10)
        } else {
          g.fillRect(p.x - 5, l.top, 10, 4)
          g.fillRect(p.x - 5, l.bottom - 4, 10, 4)
        }
      }
      // a placa: laje com moldura e setas entalhadas (afunda quando pisada)
      const afunda = p.pisada ? 2 : 0
      g.fillStyle(0x2a1e14, a).fillRect(p.x - s - 1, p.y - s - 1, PLACA.lado + 2, PLACA.lado + 2)
      g.fillStyle(p.pisada ? 0x6a3a22 : 0xb08a50, a).fillRect(p.x - s, p.y - s + afunda, PLACA.lado, PLACA.lado - afunda)
      g.fillStyle(p.pisada ? 0x8a4a2a : 0xd8b070, a).fillRect(p.x - s, p.y - s + afunda, PLACA.lado, 2)
      g.fillStyle(p.pisada ? 0xff6a3a : 0x5a3e22, a)
      if (p.eixo === 'h') {
        g.fillRect(p.x - 6, p.y - 1 + afunda, 12, 2)
        g.fillTriangle(p.x - 8, p.y + afunda, p.x - 4, p.y - 4 + afunda, p.x - 4, p.y + 4 + afunda)
        g.fillTriangle(p.x + 8, p.y + afunda, p.x + 4, p.y - 4 + afunda, p.x + 4, p.y + 4 + afunda)
      } else {
        g.fillRect(p.x - 1, p.y - 6 + afunda, 2, 12)
        g.fillTriangle(p.x, p.y - 8 + afunda, p.x - 4, p.y - 4 + afunda, p.x + 4, p.y - 4 + afunda)
        g.fillTriangle(p.x, p.y + 8 + afunda, p.x - 4, p.y + 4 + afunda, p.x + 4, p.y + 4 + afunda)
      }
    }
  }

  // ---------- espinhos ----------

  const comecarEspinhos = () => {
    const nomes = Object.keys(PADROES)
    const padrao = nomes[Math.floor(sorte() * nomes.length)]
    espinhos = { padrao, zonas: PADROES[padrao], inicio: t, cliques: 0, caixas: arena.pistas.map((_, j) => Boolean(viva(j))) }
    arena.pistas.forEach((pista, j) => {
      if (!viva(j)) return
      const l = pista.caixa.limites
      for (const [x0, y0, x1, y1] of espinhos.zonas) {
        const w = (x1 - x0) * l.width
        const h = (y1 - y0) * l.height
        // área de dano: bala retangular invisível que avisa junto com as pontas
        const bala = pista.balas.criar({
          x: l.left + ((x0 + x1) / 2) * l.width,
          y: l.top + ((y0 + y1) / 2) * l.height,
          largura: w - 4,
          altura: h - 4,
          aviso: ESPINHOS.avisoMs,
          vida: ESPINHOS.sobeMs,
          atravessa: true,
          dano: ESPINHOS.dano,
          origem: 'bonus-armadilhas-espinhos',
        })
        bala.sprite.setVisible(false)
      }
    })
    // guarda os limites de quando o padrão nasceu: as áreas de dano não mudam com a caixa
    espinhos.limites = arena.pistas.map((p) => ({ left: p.caixa.limites.left, top: p.caixa.limites.top, width: p.caixa.limites.width, height: p.caixa.limites.height }))
  }

  const desenharEspinhos = (cx, j) => {
    if (!espinhos?.caixas[j]) return
    const g = cx.g
    const l = espinhos.limites[j]
    const dt = t - espinhos.inicio
    const subir = ESPINHOS.avisoMs
    const descer = subir + ESPINHOS.sobeMs
    // altura das pontas: só um brilho na fresta (aviso) -> em pé (dano) -> recolhendo
    let altura = 0
    if (dt >= subir && dt < subir + 60) altura = (dt - subir) / 60
    else if (dt >= subir && dt < descer) altura = 1
    else if (dt >= descer) altura = Math.max(0, 1 - (dt - descer) / 160)
    const perigo = dt >= subir && dt < descer
    const espiando = dt < subir
    for (const [x0, y0, x1, y1] of espinhos.zonas) {
      const x = l.left + x0 * l.width
      const y = l.top + y0 * l.height
      const w = (x1 - x0) * l.width
      const h = (y1 - y0) * l.height
      // laje marcada (pisca no aviso, vermelha com os espinhos em pé) e frestas
      const pisca = espiando ? (Math.sin(dt / 55) > 0 ? 0.2 : 0.07) : 0.22
      g.fillStyle(perigo ? VERMELHO : 0xff9a3a, pisca).fillRect(x + 1, y + 1, w - 2, h - 2)
      g.lineStyle(1, espiando ? 0xff9a3a : PEDRA, 0.9).strokeRect(x + 1.5, y + 1.5, w - 3, h - 3)
      const p = ESPINHOS.passo
      let k = 0
      for (let yy = y + p * 0.8; yy < y + h - 2; yy += p) {
        for (let xx = x + p * 0.6; xx < x + w - 2; xx += p) {
          g.fillStyle(0x1a120c, 0.9).fillRect(xx - 3, yy, 6, 2)
          if (espiando) {
            // as pontas brilhando lá dentro da fresta, cada uma num tempo
            if (Math.sin(dt / 70 + k++ * 1.7) > 0.3) g.fillStyle(0xd8dce8, 0.9).fillRect(xx - 1, yy, 2, 1)
            continue
          }
          if (altura <= 0) continue
          const alto = 2 + altura * 10
          g.fillStyle(0xd8dce8, 1).fillTriangle(xx - 3, yy + 1, xx + 3, yy + 1, xx, yy + 1 - alto)
          g.fillStyle(0x8a90a0, 1).fillTriangle(xx, yy + 1, xx + 3, yy + 1, xx, yy + 1 - alto)
        }
      }
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      proximoEspinho = ESPINHOS.primeiro
      criarTextura(arena)
      caixas = arena.pistas.map((pista) => {
        const g = arena.add.graphics().setDepth(2)
        pista.caixa.recortar(g)
        return { pista, g, placas: [], renasceEm: [300, 900] }
      })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      // espinhos: aviso estalando, sobe, recolhe
      if (t >= proximoEspinho) {
        proximoEspinho = t + entre(ESPINHOS.periodo.min, ESPINHOS.periodo.max)
        comecarEspinhos()
      }
      if (espinhos) {
        const dt = t - espinhos.inicio
        if (espinhos.cliques < 3 && dt >= espinhos.cliques * 280) {
          espinhos.cliques++
          tocar(arena, 'clique')
        }
        if (!espinhos.subiu && dt >= ESPINHOS.avisoMs) {
          espinhos.subiu = true
          tocar(arena, 'espinhos')
          shake(arena, 120, 0.004)
        }
        if (dt > ESPINHOS.avisoMs + ESPINHOS.sobeMs + 200) espinhos = null
      }

      caixas.forEach((cx, j) => {
        cx.g.clear()
        const pista = viva(j)
        // placas: renascem, são pisadas, disparam e somem
        cx.placas = cx.placas.filter((p) => t < p.someEm)
        cx.renasceEm = cx.renasceEm.filter((em) => {
          if (t < em) return true
          if (pista && cx.placas.length < PLACA.porCaixa) novaPlaca(cx)
          return false
        })
        while (cx.placas.length + cx.renasceEm.length < PLACA.porCaixa) cx.renasceEm.push(t + entre(PLACA.renasceMs.min, PLACA.renasceMs.max))
        const c = cx.pista.coracoes[0]
        if (pista && c?.ativo) {
          for (const p of cx.placas) {
            if (p.pisada || t - p.nasceu < PLACA.surgeMs) continue
            const s = PLACA.lado / 2 + 2
            if (Math.abs(c.x - p.x) <= s && Math.abs(c.y - p.y) <= s) pisar(cx, p)
          }
        }
        desenharEspinhos(cx, j)
        desenharPlacas(cx)
      })
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const cx of caixas) cx.g.destroy()
      caixas = []
      espinhos = null
    },

    estadoDebug() {
      return {
        placas: caixas.map((cx) => cx.placas.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), eixo: p.eixo, pisada: p.pisada }))),
        espinhos: espinhos ? { padrao: espinhos.padrao, ms: Math.round(t - espinhos.inicio) } : null,
      }
    },
  }
}
