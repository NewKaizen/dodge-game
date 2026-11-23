import Phaser from 'phaser'
import Pista from '../Pista.js'
import { emSilencio } from '../../audio.js'
import { PASSO_MS, lembrarAnterior, aplicarInterpolacao, desfazerInterpolacao } from '../../passoFixo.js'
import { GRAVACAO, PASSO, CORACAO_G, chaveAcerto } from './gravador.js'

// O REPLAY REFEITO A PARTIR DOS DADOS (gravador.js): renderizadores que a TV (transmissao.js) chama a cada
// quadro com o TEMPO de jogo que está no ar. Cada um desenha a caixa daquele instante em duas texturas
// reaproveitadas (a aberta, na resolução de GRAVACAO.escala, e o close em volta do coração), só durante o
// replay. Os corações a TV desenha por cima, com o estado gravado (como antes).
//
//   const r = criarRenderizador(cena, fonte, i)   fonte = gravador.fonte(k), i = o coração em destaque
//   r.preparar(tempo, max)     anda a re-simulação até `tempo` (no máximo `max` tiques neste quadro)
//   r.desenhar(tempo, foco)    { chave, close: { chave, x, y } | null } (foco = { x, y } do coração, no mundo)
//   r.destruir()
//
// PISTA (Ressimulacao): uma pista de mentira com as MESMAS opções da original (mesma caixa, no mesmo lugar do
// mundo), escondida de todas as câmeras da cena, roda o MESMO ataque com a MESMA semente desde o começo, passo
// a passo, com os corações forçados nas posições gravadas e os acertos gravados (a bala que acertou some,
// as outras passam). O que nasce dela é coletado (o evento 'addedtoscene') e desenhado nas texturas, entre as
// duas camadas da foto do ambiente. Sem som (emSilencio). Entre dois tiques as balas são interpoladas, como
// na partida (a câmera lenta da TV fica lisa sem misturar fotos).
//
// DUELO (RenderDuelo): imagens e Graphics "de mentira" refeitos do estado gravado, interpolados entre dois
// quadros de dados.

export function criarRenderizador(cena, fonte, i = 0) {
  if (!fonte) return null
  return fonte.tipo === 'duelo' ? new RenderDuelo(cena, fonte) : new Ressimulacao(cena, fonte, i)
}

const ESCONDIDO = -1 // cameraFilter com todos os bits: nenhuma câmera da cena desenha
let geracao = 0

// Desenha em dt os objetos (já ordenados) e pinta de preto o que ficou fora da caixa
// (l: limites da caixa; x0, y0: canto do mundo da foto; e: escala)
function fotografar(dt, objetos, l, x0, y0, e) {
  const W = dt.width
  const H = dt.height
  const cx0 = Phaser.Math.Clamp(Math.round((l.left - x0) * e), 0, W)
  const cx1 = Phaser.Math.Clamp(Math.round((l.right - x0) * e), 0, W)
  const cy0 = Phaser.Math.Clamp(Math.round((l.top - y0) * e), 0, H)
  const cy1 = Phaser.Math.Clamp(Math.round((l.bottom - y0) * e), 0, H)
  dt.clear()
  dt.fill(0x000000, 1)
  dt.draw(objetos)
  const pretos = [
    [0, 0, W, cy0],
    [0, cy1, W, H - cy1],
    [0, cy0, cx0, cy1 - cy0],
    [cx1, cy0, W - cx1, cy1 - cy0],
  ]
  for (const [x, y, w, h] of pretos) if (w > 0 && h > 0) dt.fill(0x000000, 1, x, y, w, h)
  dt.render()
}

// as duas texturas (aberta e close) de um renderizador
function criarTexturas(cena, campo) {
  const prefixo = `fim-replay-${++geracao}`
  const par = (v) => Math.ceil(v / 2) * 2
  const aberta = cena.textures.addDynamicTexture(`${prefixo}-aberta`, par((campo.direita - campo.esquerda) * GRAVACAO.escala), par((campo.base - campo.topo) * GRAVACAO.escala))
  const { largura, altura, escala } = GRAVACAO.close
  const close = cena.textures.addDynamicTexture(`${prefixo}-close`, Math.round(largura * escala), Math.round(altura * escala))
  for (const dt of [aberta, close]) dt?.setFilter(Phaser.Textures.FilterMode.LINEAR)
  aberta?.camera.setOrigin(0, 0).setZoom(GRAVACAO.escala).setScroll(campo.esquerda, campo.topo)
  close?.camera.setOrigin(0, 0).setZoom(escala)
  return { aberta, close }
}

function removerTexturas(cena, { aberta, close }) {
  for (const dt of [aberta, close]) if (dt && cena.textures?.exists(dt.key)) cena.textures.remove(dt)
}

// a aberta e o close de um quadro: objetos (ordenados), limites da caixa
function desenharQuadro(texturas, campo, objetos, l, foco) {
  const { aberta, close } = texturas
  if (!aberta) return { chave: null, close: null }
  fotografar(aberta, objetos, l, campo.esquerda, campo.topo, GRAVACAO.escala)
  let c = null
  if (foco && close) {
    const { largura, altura, escala } = GRAVACAO.close
    const x = foco.x - largura / 2
    const y = foco.y - altura / 2
    close.camera.setScroll(x, y)
    fotografar(close, objetos, l, x, y, escala)
    c = { chave: close.key, x, y }
  }
  return { chave: aberta.key, close: c }
}

// ---------- a pista refeita ----------

export class Ressimulacao {
  constructor(cena, { pista: original, gravacao, campo, ambiente }, foco = 0) {
    this.cena = cena
    this.trecho = gravacao.trecho
    this.campo = campo
    this.foco = foco
    this.objetos = new Set() // o que a re-simulação criou na cena (vivos)
    this.novos = []
    this.coletando = 0
    this.aoEntrar = (o) => {
      if (!this.coletando || this.objetos.has(o)) return
      this.objetos.add(o)
      this.novos.push(o)
      o.once?.('destroy', () => this.objetos.delete(o))
    }
    cena.events.on('addedtoscene', this.aoEntrar)
    this.texturas = criarTexturas(cena, campo)
    // a foto do ambiente vira duas imagens no lugar do campo (escondidas; só entram nas texturas)
    // (a de baixo logo acima do fundo da caixa, profundidade 1; a de cima por cima de tudo)
    const camada = (chave, profundidade) => chave && cena.add.image(campo.esquerda, campo.topo, chave).setOrigin(0).setScale(1 / ambiente.escala).setDepth(profundidade)
    this.abaixo = ambiente ? camada(ambiente.abaixo, 1.5) : null
    this.acima = ambiente ? camada(ambiente.acima, Infinity) : null
    for (const o of [this.abaixo, this.acima]) if (o) o.cameraFilter = ESCONDIDO

    const t = this.trecho
    this.i = 0 // próximo passo
    this.tempo = -Infinity // o tique em que a re-simulação está (ms)
    this.passoAtual = -1
    this.rodar(() => {
      const p = (this.pista = new Pista(cena, original.opcoes))
      p.aoAcertar = null
      p.aoGraze = null
      p.acertou = (c, b) => this.acertou(c, b)
      p.grazeou = () => {}
      p.aberta = true
      const [x, y, w, h] = t.caixa
      p.caixa.aplicar(x + w / 2, y + h / 2, w, h)
      p.caixa.retangulo.setVisible(true).setScale(1)
      p.coracoes.forEach((c) => (c.ativo = true))
      p.iniciarAtaque(t.ataque, t.opcoes)
    })
    // os corações e a borda de mentira não vão para a foto (a TV desenha os de verdade por cima)
    this.fora = new Set(this.pista.coracoes.flatMap((c) => [c.sprite, c.anel, c.forma, c.tag, c.reticula]).filter(Boolean))
  }

  // roda fn() coletando e escondendo o que ela criar
  rodar(fn) {
    this.coletando++
    try {
      emSilencio(fn)
    } finally {
      this.coletando--
      for (const o of this.novos) o.cameraFilter = ESCONDIDO
      this.novos.length = 0
    }
  }

  acertou(coracao, bala) {
    if (bala.numero === undefined) return false
    // (o pisca do coração vem gravado: aqui só a bala que acertou some)
    return this.trecho.acertos.has(chaveAcerto(this.passoAtual, this.pista.coracoes.indexOf(coracao), bala.numero))
  }

  // um passo gravado: a caixa e os corações como estavam, o resto refeito
  aplicarPasso(i) {
    const t = this.trecho
    const d = t.dados
    const o = i * t.tamanho
    const p = this.pista
    const l = p.caixa.limites
    const lx = d[o + PASSO.lx]
    const ly = d[o + PASSO.ly]
    const lw = d[o + PASSO.lw]
    const lh = d[o + PASSO.lh]
    if (l.x !== lx || l.y !== ly || l.width !== lw || l.height !== lh) p.caixa.aplicar(lx + lw / 2, ly + lh / 2, lw, lh)
    p.velocidade = d[o + PASSO.velocidade]
    p.fatorCoracao = 1
    p.balas.fatorVelocidade = d[o + PASSO.fator]
    p.balas.velocidadeMax = d[o + PASSO.teto]
    p.congelada = d[o + PASSO.congelada] === 1
    p.coracoes.forEach((c, k) => {
      const b = o + PASSO.cabecalho + k * CORACAO_G.tamanho
      c.x = d[b]
      c.y = d[b + 1]
      c.ativo = d[b + 2] === 1
      c.hitbox = d[b + 3]
      c.graze = d[b + 4]
    })
    this.passoAtual = i
    p.simular(d[o + PASSO.dt])
  }

  // anda até o tique que cobre `tempo` (a re-simulação fica no máximo um tique à frente; ver desenhar)
  preparar(tempo, max = Infinity) {
    const t = this.trecho
    let n = 0
    this.rodar(() => {
      while (this.i < t.passos && this.tempo < tempo - 1e-6 && n < max) {
        const tique = t.dados[this.i * t.tamanho + PASSO.tique]
        lembrarAnterior(this.pista.balas.lista) // a posição de antes deste tique (interpolação)
        while (this.i < t.passos && t.dados[this.i * t.tamanho + PASSO.tique] === tique) this.aplicarPasso(this.i++)
        this.tempo = tique * PASSO_MS
        n++
      }
    })
  }

  desenhar(tempo, foco) {
    const chave = `${tempo}|${foco?.x}|${foco?.y}`
    if (chave === this.ultimaChave) return this.ultimo // (o golpe fica parado no mesmo quadro)
    this.ultimaChave = chave
    this.preparar(tempo)
    const p = this.pista
    // entre o tique anterior e o atual, como na partida (passoFixo.js)
    const alfa = Phaser.Math.Clamp(1 - (this.tempo - tempo) / PASSO_MS, 0, 1)
    if (alfa < 1) for (const b of p.balas.lista) if (!b.morta) aplicarInterpolacao(b, [b.sprite], alfa)
    const lista = this.cena.sys.displayList
    const cam = this.texturas.aberta?.camera
    const objetos = [...this.objetos].filter((o) => o.scene && !this.fora.has(o) && o.displayList === lista && o.willRender?.(cam))
    if (this.abaixo) objetos.push(this.abaixo)
    if (this.acima) objetos.push(this.acima)
    objetos.sort((a, b) => a.depth - b.depth)
    this.ultimo = desenharQuadro(this.texturas, this.campo, objetos, p.caixa.limites, foco)
    for (const b of p.balas.lista) desfazerInterpolacao(b)
    return this.ultimo
  }

  destruir() {
    if (this.destruida) return
    this.destruida = true
    this.cena.events.off('addedtoscene', this.aoEntrar)
    this.rodar(() => this.pista?.destruir())
    for (const o of [...this.objetos]) {
      this.cena.tweens?.killTweensOf(o)
      if (o.scene) o.destroy()
    }
    this.objetos.clear()
    this.abaixo?.destroy()
    this.acima?.destroy()
    removerTexturas(this.cena, this.texturas)
  }
}

// ---------- o duelo refeito do estado gravado ----------

export class RenderDuelo {
  constructor(cena, { gravacao, campo }) {
    this.cena = cena
    this.quadros = gravacao.quadros
    this.campo = campo
    this.texturas = criarTexturas(cena, campo)
    this.imagens = []
    this.graficos = []
  }

  preparar() {}

  // o quadro gravado em `tempo` (e o próximo, para interpolar as posições)
  achar(tempo) {
    const qs = this.quadros
    let i = 0
    while (i + 1 < qs.length && qs[i + 1].tempo <= tempo) i++
    const j = Math.min(i + 1, qs.length - 1)
    const frac = j > i ? Phaser.Math.Clamp((tempo - qs[i].tempo) / Math.max(1e-6, qs[j].tempo - qs[i].tempo), 0, 1) : 0
    return { q0: qs[i], q1: qs[j], frac }
  }

  proxy(lista, n, criar) {
    let o = lista[n]
    if (!o) {
      o = lista[n] = criar()
      o.cameraFilter = ESCONDIDO
    }
    return o
  }

  desenhar(tempo, foco) {
    const chave = `${tempo}|${foco?.x}|${foco?.y}`
    if (chave === this.ultimaChave) return this.ultimo
    this.ultimaChave = chave
    const { q0, q1, frac } = this.achar(tempo)
    if (!q0) return { chave: null, close: null }
    const seguinte = new Map(q1.objetos.map((o) => [o.id, o]))
    const objetos = []
    let ni = 0
    let ng = 0
    for (const e of q0.objetos) {
      const f = seguinte.get(e.id) ?? e
      const x = e.x + (f.x - e.x) * frac
      const y = e.y + (f.y - e.y) * frac
      let o
      if (e.t === 'i') {
        if (!this.cena.textures.exists(e.key)) continue
        o = this.proxy(this.imagens, ni++, () => this.cena.add.image(0, 0, '__DEFAULT'))
        o.setTexture(e.key, e.frame).setOrigin(e.ox, e.oy).setFlip(e.fx, e.fy)
        o.setTint(e.tint ?? 0xffffff)
        if (e.tm !== undefined) o.setTintMode(e.tm)
      } else {
        o = this.proxy(this.graficos, ng++, () => this.cena.add.graphics())
        o.commandBuffer = e.cmds
      }
      o.setPosition(x, y).setRotation(e.r).setScale(e.sx, e.sy).setAlpha(e.a).setBlendMode(e.b).setDepth(e.d).setVisible(true)
      objetos.push(o)
    }
    for (let n = ni; n < this.imagens.length; n++) this.imagens[n].setVisible(false)
    for (let n = ng; n < this.graficos.length; n++) this.graficos[n].setVisible(false)
    objetos.sort((a, b) => a.depth - b.depth)
    const c = q0.caixa
    const l = new Phaser.Geom.Rectangle(c.x, c.y, c.largura, c.altura)
    this.ultimo = desenharQuadro(this.texturas, this.campo, objetos, l, foco)
    return this.ultimo
  }

  destruir() {
    for (const o of [...this.imagens, ...this.graficos]) {
      if (o.commandBuffer) o.commandBuffer = []
      o.destroy()
    }
    this.imagens = []
    this.graficos = []
    removerTexturas(this.cena, this.texturas)
  }
}
