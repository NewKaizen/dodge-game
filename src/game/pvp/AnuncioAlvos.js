import { FONTE } from '../constants.js'
import { corDaVaga } from '../vagas.js'
import { desenharForma, formaDaVaga } from '../coop/marcadores.js'
import { ANUNCIO, modeloDoAnuncio, curvaDaSeta, pontoNaCurva, tangenteNaCurva, linhaDoTempo, quadroDoAnuncio } from './anuncioAlvos.js'

// Desenha o anúncio de alvos (lógica em pvp/anuncioAlvos.js): um painel escuro no meio com os personagens (o
// sprite de cada um dentro de um anel da cor da vaga, mais a forma da vaga), as setas animadas e os ícones de
// estado. Depois de ~1,2 s o desenho encolhe e fica no meio da tela, parado, lembrando quem ataca quem.
//
//   const anuncio = new AnuncioAlvos(cena, { ids })     (uma vez, na criação da cena)
//   anuncio.mostrar({ n, dupla, times, alvos, estados, meu, destaque, reduzir }) -> Promise (acaba ao terminar)
//   anuncio.pular()      A ou B: vai direto para o desenho final   ·   anuncio.tocando
//   anuncio.esconder()   some (a revelação das cartas)   ·   anuncio.destruir()
const COR_TIME = [0x4ab0ff, 0xffa040]
const PROFUNDIDADE = 31
const ESCALA_SPRITE = 2.7
const LARGURA_PAINEL = 2 * (ANUNCIO.rx + 78)
const ALTURA_PAINEL = 2 * ANUNCIO.ry + 128

export default class AnuncioAlvos {
  constructor(cena, { ids = [] } = {}) {
    this.cena = cena
    this.ids = ids
    this.raiz = cena.add.container(ANUNCIO.centro.x, ANUNCIO.centro.y).setDepth(PROFUNDIDADE).setVisible(false)
    this.fundo = cena.add.graphics()
    this.camada = cena.add.graphics() // anéis, formas, ícones, elo (parado)
    this.setas = cena.add.graphics() // as setas (redesenhadas a cada quadro)
    this.raiz.add([this.fundo, this.camada, this.setas])
    this.sprites = []
    this.voce = []
    this.modelo = null
    this.tocando = false
    this.t = 0
    this.resolver = null
  }

  mostrar({ reduzir = false, ...dados }) {
    this.finalizar()
    this.modelo = modeloDoAnuncio(dados)
    this.linha = linhaDoTempo(this.modelo.setas.length, { reduzir })
    this.reduzir = reduzir
    this.t = 0
    this.tocando = true
    this.cena.tweens.killTweensOf(this.raiz)
    this.raiz.setPosition(ANUNCIO.centro.x, ANUNCIO.centro.y).setScale(1).setAlpha(0).setVisible(true)
    this.cena.tweens.add({ targets: this.raiz, alpha: 1, duration: reduzir ? 0 : 120 })
    this.montar()
    this.desenharQuadro(quadroDoAnuncio(this.linha, 0))
    return new Promise((resolver) => {
      this.resolver = resolver
    })
  }

  pular() {
    if (!this.tocando) return false
    this.t = this.linha.total
    this.desenharQuadro(quadroDoAnuncio(this.linha, this.t, { pular: true }))
    this.terminar()
    return true
  }

  // chamado todo quadro com o tempo REAL (o anúncio não acelera junto com a partida)
  atualizar(dt) {
    if (!this.tocando) return
    this.t += dt
    this.desenharQuadro(quadroDoAnuncio(this.linha, this.t))
    if (this.t >= this.linha.total) this.terminar()
  }

  // termina o tempo cheio e encolhe para o meio (parado)
  terminar() {
    if (!this.tocando) return
    this.tocando = false
    const m = ANUNCIO.mini
    const resolver = this.resolver
    this.resolver = null
    if (this.reduzir) this.raiz.setPosition(m.x, m.y).setScale(m.escala)
    else this.cena.tweens.add({ targets: this.raiz, x: m.x, y: m.y, scaleX: m.escala, scaleY: m.escala, duration: 220, ease: 'Cubic.easeInOut' })
    resolver?.()
  }

  finalizar() {
    this.tocando = false
    const resolver = this.resolver
    this.resolver = null
    resolver?.()
  }

  esconder() {
    this.finalizar()
    this.cena.tweens.killTweensOf(this.raiz)
    if (!this.raiz.visible) return
    this.cena.tweens.add({ targets: this.raiz, alpha: 0, duration: 160, onComplete: () => this.raiz.setVisible(false) })
  }

  destruir() {
    this.finalizar()
    this.cena.tweens?.killTweensOf(this.raiz)
    this.raiz.destroy()
  }

  // ---------- desenho ----------

  limparSprites() {
    for (const o of [...this.sprites, ...this.voce]) o.destroy()
    this.sprites = []
    this.voce = []
  }

  montar() {
    const m = this.modelo
    this.limparSprites()
    const f = this.fundo
    const g = this.camada
    f.clear()
    g.clear()
    f.fillStyle(0x07050e, 0.84).fillRoundedRect(-LARGURA_PAINEL / 2, -ALTURA_PAINEL / 2, LARGURA_PAINEL, ALTURA_PAINEL, 12)
    f.lineStyle(2, 0xffffff, 0.25).strokeRoundedRect(-LARGURA_PAINEL / 2, -ALTURA_PAINEL / 2, LARGURA_PAINEL, ALTURA_PAINEL, 12)
    const dupla = m.nos[0]?.time != null
    if (dupla) {
      // as duas equipes, cada uma com a cor atrás do seu lado
      for (const t of [0, 1]) {
        const lado = t === 0 ? -1 : 1
        const x = lado * ANUNCIO.rx
        f.fillStyle(COR_TIME[t], 0.2).fillRoundedRect(x - 56, -ALTURA_PAINEL / 2 + 12, 112, ALTURA_PAINEL - 24, 10)
        f.lineStyle(2, COR_TIME[t], 0.8).strokeRoundedRect(x - 56, -ALTURA_PAINEL / 2 + 12, 112, ALTURA_PAINEL - 24, 10)
      }
    }
    // o elo entre eu e o parceiro: linha pontilhada na cor do time e um coração pequeno no meio
    if (m.elo) {
      const [a, b] = m.elo.map((j) => m.nos[j])
      const cor = COR_TIME[a.time]
      const y0 = Math.min(a.y, b.y) + ANUNCIO.raioNo + 4
      const y1 = Math.max(a.y, b.y) - ANUNCIO.raioNo - 4
      g.fillStyle(cor, 0.75)
      for (let y = y0 + 3; y < y1 - 14; y += 8) g.fillRect(a.x - 1, y, 2, 3)
      this.coracao(g, a.x, (a.y + b.y) / 2, 7, cor)
    }
    m.nos.forEach((no) => {
      const cor = corDaVaga(no.vaga)
      const morto = no.estado === 'eliminado' || no.estado === 'caido'
      const alpha = morto ? 0.45 : no.estado === 'semConexao' ? 0.7 : 1
      // anel: grosso e branco por fora em quem está enfatizado
      g.fillStyle(0x000000, 0.55).fillCircle(no.x, no.y, ANUNCIO.raioNo)
      if (no.destaque && !morto) g.lineStyle(3, 0xffffff, 0.95).strokeCircle(no.x, no.y, ANUNCIO.raioNo + 5)
      g.lineStyle(no.destaque ? 5 : 3, morto ? 0x777788 : cor, alpha).strokeCircle(no.x, no.y, ANUNCIO.raioNo)
      // a forma da vaga no canto do anel (a cor nunca é a única pista)
      desenharForma(g, formaDaVaga(no.vaga), no.x + ANUNCIO.raioNo * 0.78, no.y - ANUNCIO.raioNo * 0.78, 7, morto ? 0x777788 : cor, { alpha })
      const id = this.ids[no.vaga]
      if (id && this.cena.textures.exists(id)) {
        const s = this.cena.add.image(no.x, no.y + 1, id).setScale(0)
        if (morto) s.setTint(0x6a6a78).setAlpha(0.7)
        else if (no.estado === 'semConexao') s.setAlpha(0.6)
        this.raiz.add(s)
        s.no = no
        this.sprites.push(s)
      }
      if (no.voce) {
        const t = this.cena.add.text(no.x, no.y - ANUNCIO.raioNo - 12, 'VOCÊ', { fontFamily: FONTE, fontSize: '10px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setAlpha(0)
        this.raiz.add(t)
        this.voce.push(t)
      }
      // ícones de estado
      if (no.icone === 'x') this.cruz(g, no.x, no.y, 17)
      if (no.icone === 'desconectado') this.semSinal(g, no.x + ANUNCIO.raioNo * 0.6, no.y + ANUNCIO.raioNo * 0.7)
      if (no.icone === 'energia') {
        // SEM ALVO: um raio de energia no lugar da seta, do lado do centro do painel
        const lado = no.x < 0 ? 1 : -1
        this.raio(g, no.x + lado * 56, no.y, 1.45, 0x7fd8ff)
      }
    })
    for (const o of this.sprites) this.raiz.bringToTop(o)
    for (const o of this.voce) this.raiz.bringToTop(o)
  }

  desenharQuadro(q) {
    const g = this.setas
    g.clear()
    this.sprites.forEach((s) => {
      const k = q.sprites
      const pop = k < 1 ? 1 + 0.25 * Math.sin(k * Math.PI) : 1
      s.setScale(ESCALA_SPRITE * k * pop)
    })
    this.voce.forEach((t) => t.setAlpha(q.sprites))
    const m = this.modelo
    m.setas.forEach((seta, i) => {
      const p = q.setas[i]
      if (p <= 0) return
      const de = m.nos[seta.de]
      const para = m.nos[seta.para]
      const curva = curvaDaSeta(de, para)
      this.seta(g, curva, p, seta.tipo, corDaVaga(seta.de), q.pulso)
    })
  }

  seta(g, curva, p, tipo, cor, pulso) {
    const estilo = {
      minha: { largura: 6 + 1.5 * pulso, alpha: 1, ponta: 13 + 2 * pulso, tracejada: false, contorno: 3 },
      contraMim: { largura: 4.5, alpha: 1, ponta: 11, tracejada: true, contorno: 2.5 },
      fraca: { largura: 2.5, alpha: 0.38, ponta: 8, tracejada: false, contorno: 0 },
    }[tipo]
    const passos = 22
    const ate = Math.max(1, Math.round(passos * Math.min(1, p)))
    const pts = Array.from({ length: ate + 1 }, (_, i) => pontoNaCurva(curva, (i / passos)))
    const traco = (largura, c, a) => {
      g.lineStyle(largura, c, a)
      if (!estilo.tracejada) {
        g.beginPath()
        g.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
        g.strokePath()
        return
      }
      for (let i = 0; i + 1 < pts.length; i += 2) {
        g.beginPath()
        g.moveTo(pts[i].x, pts[i].y)
        g.lineTo(pts[i + 1].x, pts[i + 1].y)
        g.strokePath()
      }
    }
    // contorno preto por baixo (as setas aparecem sobre qualquer cor)
    if (estilo.contorno) traco(estilo.largura + estilo.contorno * 2, 0x000000, 0.85)
    traco(estilo.largura, cor, estilo.alpha)
    // a ponta: no fim da curva (cresce quando a seta chega) e uma faísca na frente enquanto ela viaja
    const t = Math.min(1, ate / passos)
    const cabeca = pontoNaCurva(curva, t)
    const dir = tangenteNaCurva(curva, Math.max(0.02, t))
    if (p >= 1) {
      this.ponta(g, cabeca, dir, estilo.ponta, cor, estilo.alpha, estilo.contorno > 0)
    } else if (tipo !== 'fraca') {
      g.fillStyle(0xffffff, 1).fillCircle(cabeca.x, cabeca.y, estilo.largura * 0.8)
    } else {
      g.fillStyle(0xffffff, 0.5).fillCircle(cabeca.x, cabeca.y, 2.5)
    }
  }

  ponta(g, p, d, tam, cor, alpha, contorno) {
    const nx = -d.y
    const ny = d.x
    const pts = [
      { x: p.x + d.x * 3, y: p.y + d.y * 3 },
      { x: p.x - d.x * tam + nx * tam * 0.62, y: p.y - d.y * tam + ny * tam * 0.62 },
      { x: p.x - d.x * tam - nx * tam * 0.62, y: p.y - d.y * tam - ny * tam * 0.62 },
    ]
    if (contorno) g.lineStyle(3, 0x000000, 0.9).strokePoints(pts, true)
    g.fillStyle(cor, alpha).fillPoints(pts, true)
  }

  cruz(g, x, y, r) {
    g.lineStyle(7, 0x000000, 0.9)
    g.lineBetween(x - r, y - r, x + r, y + r)
    g.lineBetween(x + r, y - r, x - r, y + r)
    g.lineStyle(4, 0xff4060, 1)
    g.lineBetween(x - r, y - r, x + r, y + r)
    g.lineBetween(x + r, y - r, x - r, y + r)
  }

  // ícone de "sem conexão": o sinal (3 arcos e um ponto) cortado por uma barra
  semSinal(g, x, y) {
    const k = 1.6
    g.fillStyle(0x000000, 0.9).fillCircle(x, y, 12 * k)
    g.lineStyle(2.5, 0xff9a3a, 1)
    for (const r of [4, 7, 10]) {
      g.beginPath()
      g.arc(x, y + 5 * k, r * k, -Math.PI * 0.82, -Math.PI * 0.18)
      g.strokePath()
    }
    g.fillStyle(0xff9a3a, 1).fillCircle(x, y + 5 * k, 1.8 * k)
    g.lineStyle(4, 0xff4060, 1).lineBetween(x - 10 * k, y - 10 * k, x + 10 * k, y + 10 * k)
  }

  raio(g, x, y, k, cor) {
    const pts = [[2, -14], [-6, 1], [-1, 1], [-3, 14], [7, -3], [1, -3], [5, -14]].map(([px, py]) => ({ x: x + px * k, y: y + py * k }))
    g.fillStyle(0x0b2a3a, 0.9).fillCircle(x, y, 15 * k).lineStyle(2, cor, 0.9).strokeCircle(x, y, 15 * k)
    g.lineStyle(2, 0x000000, 1).strokePoints(pts, true)
    g.fillStyle(cor, 1).fillPoints(pts, true)
  }

  coracao(g, x, y, r, cor) {
    g.fillStyle(0x000000, 0.8).fillCircle(x, y, r + 3)
    g.fillStyle(cor, 1)
    g.fillCircle(x - r * 0.5, y - r * 0.25, r * 0.55)
    g.fillCircle(x + r * 0.5, y - r * 0.25, r * 0.55)
    g.fillPoints([{ x: x - r * 1.0, y: y - r * 0.05 }, { x: x + r * 1.0, y: y - r * 0.05 }, { x, y: y + r * 0.95 }], true)
  }
}
