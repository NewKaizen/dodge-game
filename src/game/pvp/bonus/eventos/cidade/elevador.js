import { FONTE } from '../../../../constants.js'
import { planoElevador, geometriaElevador, joyDoElevador, prenderNoAndar, corredorMaisPerto } from './planos.js'
import { avisoNasCaixas, coracaoDe, ehCpu, ehEspelho, tocar } from './util.js'

// ELEVADOR (CIDADE GRANDE): a caixa vira um PRÉDIO de 3 ou 4 andares. Em cada andar o coração só anda DE
// LADO (corredor fino); para trocar de andar tem que entrar no POÇO DO ELEVADOR (a coluna prateada) e ali
// sobe e desce. De dentro do poço só dá para sair de lado quando está num corredor (no meio do ar, não).
// Vale igual nas duas caixas (o plano sai da semente: o número de andares e a coluna do poço).
// A CPU, que não conhece o prédio, é guiada: querendo mudar de andar ela vai até o poço; no poço segue
// na vertical até um corredor.

const COR_LUZ = 0xffd38a
const COR_POCO = 0x9fb4d0
const ANDAR_NOME = ['T', '1', '2', '3', '4']

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  let plano = null
  let visuais = [] // por pista: { pista, g, nomes: Text[], aviso }
  let avisos = []
  let ultimoPoco = [] // por pista: o coração estava no poço? (som)

  const geometria = (pista) => geometriaElevador(pista.caixa.limites, plano)

  // ---------- controle ----------
  const guiarCpu = (g, c, joy) => {
    const noPoco = c.x >= g.poco.x0 && c.x <= g.poco.x1
    const querSubir = joy.y < -25
    const querDescer = joy.y > 25
    const cor = corredorMaisPerto(g, c.y)
    const noCorredor = cor.distancia <= g.corredorMeio
    if (!noPoco) {
      if (querSubir || querDescer) return { x: Math.sign(g.poco.cx - c.x) * 100, y: 0 } // vai até o poço
      return joy
    }
    // no poço: no meio do ar continua na vertical; num corredor segue o que o bot quer
    if (!noCorredor) return { x: 0, y: c.y < g.linhas[cor.indice] ? 100 : -100 }
    if (querSubir || querDescer) return { x: Math.sign(g.poco.cx - c.x) * 20, y: joy.y }
    return joy
  }

  // ---------- desenho ----------
  const montarVisual = (pista) => {
    const g = arena.add.graphics().setDepth(2)
    pista.caixa.recortar(g)
    const nomes = Array.from({ length: plano.andares }, () => {
      const tx = arena.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '9px', color: '#cfe0ff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(3)
      pista.caixa.recortar(tx)
      return tx
    })
    return { pista, g, nomes }
  }

  const desenhar = (v) => {
    const l = v.pista.caixa.limites
    const g = v.g
    const geo = geometria(v.pista)
    const c = coracaoDe(arena, arena.pistas.indexOf(v.pista))
    const noPoco = c?.ativo && c.x >= geo.poco.x0 && c.x <= geo.poco.x1
    g.clear()
    // o prédio: fundo azulado e as lajes entre os corredores
    g.fillStyle(0x0c1530, 0.4).fillRect(l.left, l.top, l.width, l.height)
    for (let k = 0; k < geo.linhas.length; k++) {
      const y = geo.linhas[k]
      const m = geo.corredorMeio
      // corredor aceso
      g.fillStyle(COR_LUZ, 0.1).fillRect(l.left, y - m, l.width, m * 2)
      // piso e teto do corredor
      g.fillStyle(0xcfd6e6, 0.5).fillRect(l.left, y + m, l.width, 2)
      g.fillStyle(0x7a86a0, 0.35).fillRect(l.left, y - m - 2, l.width, 2)
      // laje de concreto entre este corredor e o de baixo
      if (k < geo.linhas.length - 1) {
        const topo = y + m + 2
        const base = geo.linhas[k + 1] - m - 2
        g.fillStyle(0x2a3350, 0.5).fillRect(l.left, topo, l.width, Math.max(0, base - topo))
        g.fillStyle(0x3b4668, 0.4)
        for (let x = l.left + 6; x < l.right - 4; x += 14) g.fillRect(x, topo + 2, 7, Math.max(0, base - topo - 4)) // janelinhas escuras
      }
    }
    // o poço: moldura prateada, cabos e a cabine passeando
    const px = geo.poco.x0
    const pw = geo.poco.x1 - geo.poco.x0
    g.fillStyle(0x1a2238, 0.88).fillRect(px, l.top, pw, l.height)
    g.fillStyle(0xdfe8ff, 0.1).fillRect(px + 2, l.top, 3, l.height)
    g.lineStyle(2, noPoco ? 0x7affc0 : COR_POCO, noPoco ? 1 : 0.85).strokeRect(px, l.top + 1, pw, l.height - 2)
    g.lineStyle(1, 0x8fa0c0, 0.7)
    g.lineBetween(geo.poco.cx - 6, l.top, geo.poco.cx - 6, l.bottom)
    g.lineBetween(geo.poco.cx + 6, l.top, geo.poco.cx + 6, l.bottom)
    // cabine decorativa (sobe e desce sozinha, só enfeite)
    const ciclo = (t / 2600) % 2
    const f = ciclo < 1 ? ciclo : 2 - ciclo
    const cabY = l.top + 12 + f * (l.height - 24)
    g.fillStyle(0x54627f, 0.9).fillRect(px + 4, cabY - 9, pw - 8, 18)
    g.fillStyle(0xbfd0ee, 0.9).fillRect(px + 6, cabY - 7, pw - 12, 14)
    g.fillStyle(0x2a3350, 1).fillRect(geo.poco.cx - 0.5, cabY - 7, 1, 14)
    // setas ▲▼ pulsando no poço: aqui dá para mudar de andar
    const pulso = 0.45 + 0.35 * Math.sin(t / 200)
    g.fillStyle(0x7affc0, pulso)
    for (const k of geo.linhas) {
      g.fillTriangle(geo.poco.cx - 5, k - 5, geo.poco.cx + 5, k - 5, geo.poco.cx, k - 12)
      g.fillTriangle(geo.poco.cx - 5, k + 5, geo.poco.cx + 5, k + 5, geo.poco.cx, k + 12)
    }
    // números dos andares na borda esquerda
    v.nomes.forEach((tx, k) => {
      const n = geo.linhas.length - 1 - k // o de baixo é o térreo
      tx.setText(ANDAR_NOME[n]).setPosition(l.left + 8, geo.linhas[k] - geo.corredorMeio + 1).setVisible(geo.poco.x0 > l.left + 20)
    })
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoElevador(sorte)
      visuais = arena.pistas.map(montarVisual)
      ultimoPoco = arena.pistas.map(() => false)
      // o coração nasce no andar de baixo (não no meio do ar)
      arena.pistas.forEach((pista, j) => {
        const c = coracaoDe(arena, j)
        if (!c?.ativo || ehEspelho(arena, j)) return
        const g = geometria(pista)
        c.y = g.linhas[corredorMaisPerto(g, c.y).indice]
        c.posicionar()
      })
      avisos = avisoNasCaixas(arena, 'SÓ MUDA DE ANDAR NO ELEVADOR!', { cor: '#9fd0ff', ms: 1500, atraso: 100 })
      tocar(arena, 'subida')
    },

    joy(j, joy) {
      if (!ativo || !joy) return joy
      const pista = arena.pistas[j]
      const c = coracaoDe(arena, j)
      if (!c?.ativo || ehEspelho(arena, j)) return joy
      const g = geometria(pista)
      const base = ehCpu(arena, j) ? guiarCpu(g, c, joy) : joy
      return joyDoElevador(g, c.x, c.y, base)
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      arena.pistas.forEach((pista, j) => {
        const c = coracaoDe(arena, j)
        if (!c?.ativo || ehEspelho(arena, j)) return
        const g = geometria(pista)
        const r = prenderNoAndar(g, c.x, c.y)
        if (Math.abs(r.x - c.x) > 0.01 || Math.abs(r.y - c.y) > 0.01) {
          c.x = r.x
          c.y = r.y
          c.posicionar()
        }
        if (r.noPoco !== ultimoPoco[j]) {
          ultimoPoco[j] = r.noPoco
          if (r.noPoco) tocar(arena, 'clique')
        }
      })
      for (const v of visuais) desenhar(v)
    },

    estadoDebug() {
      return { t: Math.round(t), andares: plano?.andares, poco: plano?.poco, noPoco: [...ultimoPoco] }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of visuais) {
        v.g.destroy()
        v.nomes.forEach((n) => n.destroy())
      }
      visuais = []
      avisos.forEach((a) => a.scene && a.destroy())
      avisos = []
    },
  }
}
