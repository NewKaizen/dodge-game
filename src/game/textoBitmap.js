import Phaser from 'phaser'
import { FONTE } from './constants.js'
import { RES } from './resEscala.js'

// TEXTO EM FONTE BITMAP para o que a partida mostra e muda (HUD, números de dano, faixas, avisos): fase 3.1 do
// plano de otimização (docs/desempenho.md).
//
// Um Text do Phaser é um canvas e uma textura SÓ DELE: cada um quebra o lote de desenho quando passa das 16
// texturas de um lote, e cada setText/setColor re-rasteriza o canvas e reenvia a textura para a GPU. Aqui o texto
// é feito de letras recortadas de um ATLAS de fonte compartilhado (uma textura para todos os textos de todas as
// fontes): trocar o texto ou a cor não desenha nada de novo, e todos entram no mesmo lote.
//
//   const t = textoJogo(cena, x, y, 'texto', { fontFamily: FONTE, fontSize: '12px', color: '#fff', stroke: '#000000', strokeThickness: 3 })
//
// Devolve um TextoBitmap quando o estilo cabe (a fonte do jogo, cor, contorno, align, lineSpacing); senão (quebra
// de linha automática, sombra, fundo, largura fixa, outra fonte) um Text de sempre. O TextoBitmap fala a mesma
// língua do Text no que a partida usa: setText, setColor, setStroke, setFontSize, setAlign, setLineSpacing, text,
// width/height, setOrigin, setTint (como cor)...
//
// O ATLAS é gerado no navegador, na primeira vez que um tamanho é usado, com o MESMO rasterizador do Text (o canvas
// do navegador, a mesma fonte, o mesmo desenho: contorno por baixo, preenchimento por cima, juntas redondas) e na
// RESOLUÇÃO DA TELA (RES.escala): fica tão nítido quanto o Text. Um atlas feito no build (um PNG) ficaria preso a
// uma escala só e borraria nas outras (1,4x, 2,25x...).
// As letras são BRANCAS e a cor vem da tinta (multiplicar branco pela cor dá a cor exata, também nas bordas
// suavizadas). O contorno é uma segunda camada de letras (só o traço), desenhada inteira ANTES do preenchimento:
// como no canvas, o contorno de uma letra nunca cobre o preenchimento da vizinha.
//
// Charset: ASCII, os acentos do português e os símbolos do jogo (♪ ♥ ♦ ♣ ♠ ★ × → ...) já no atlas; qualquer outro
// caractere que aparecer é rasterizado na hora e entra no atlas.
//
// MATH.RANDOM: cada Text novo sorteia um nome (UUID, 31 chamadas). O TextoBitmap sorteia o mesmo nome no lugar,
// para a sequência do Math.random da cena (cosméticos, a paridade visual) não mudar.
export const CHARSET =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~' +
  'ÀÁÂÃÄÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜàáâãäçèéêëìíîïñòóôõöùúûüªº°·×÷' +
  '♪♫♥♦♣♠★☆•…–—“”‘’«»→←↑↓✓✗⚡'
const LADO_PAGINA = 1024
const BORDA = 1 // px vazios em volta de cada letra no atlas (o NEAREST da beira não pega a vizinha)

const paginas = [] // { chave, canvas, ctx, x, y, alturaLinha, sujo }
const fontes = new Map() // chave da fonte -> { dados, contorno: dados (só o traço) }

// ---------- o atlas ----------

// Uma fonte fica inteira numa página (o BitmapText usa uma textura só). A página nova nasce quando a fonte nova não
// cabe no que sobrou da atual (a área estimada do charset; as letras que chegarem depois e não couberem ficam sem
// desenho: não acontece com o texto do jogo).
function paginaPara(scene, areaEstimada) {
  let p = paginas[paginas.length - 1]
  const livre = p ? (LADO_PAGINA - p.y - p.alturaLinha) * LADO_PAGINA + (LADO_PAGINA - p.x) * p.alturaLinha : 0
  if (!p || livre < areaEstimada * 1.3) {
    const canvas = document.createElement('canvas')
    canvas.width = LADO_PAGINA
    canvas.height = LADO_PAGINA
    p = { chave: `fonte-bitmap-${paginas.length}`, canvas, ctx: canvas.getContext('2d'), x: 0, y: 0, alturaLinha: 0, textura: null, sujo: false }
    paginas.push(p)
  }
  if (!p.textura || !scene.textures.exists(p.chave)) p.textura = scene.textures.addCanvas(p.chave, p.canvas)
  return p
}

// um lugar w x h na página (prateleiras); null se não cabe
function lugar(p, w, h) {
  if (p.x + w > LADO_PAGINA) {
    p.x = 0
    p.y += p.alturaLinha
    p.alturaLinha = 0
  }
  if (p.y + h > LADO_PAGINA || w > LADO_PAGINA) return null
  const r = { x: p.x, y: p.y }
  p.x += w
  p.alturaLinha = Math.max(p.alturaLinha, h)
  return r
}

// mede como o Text mede: a mesma fonte, a altura de linha do Phaser (fontSize das métricas + contorno) e o ascent
function metricas(scene, tamanho, contorno) {
  // um Text de rascunho (só para ler as métricas do Phaser): o nome sorteado dele não pode gastar o Math.random
  const sorteio = Math.random
  Math.random = () => 0.5
  try {
    const t = scene.make.text({ x: 0, y: 0, text: 'M', style: { fontFamily: FONTE, fontSize: `${tamanho}px`, strokeThickness: contorno } }, false)
    const m = { ...t.style.metrics }
    t.destroy()
    return m
  } finally {
    Math.random = sorteio
  }
}

function criarFonte(scene, tamanho, contorno, escala) {
  const chave = `fonte:${tamanho}:${contorno}@${escala}`
  if (fontes.has(chave) && scene.sys.cache.bitmapFont.exists(chave)) return chave
  const m = metricas(scene, tamanho, contorno)
  const alturaLinha = m.fontSize + contorno
  const base = (contorno / 2 + m.ascent) // linha de base dentro da célula (como o Text: autoRound depois)
  const dados = { font: chave, size: tamanho, lineHeight: alturaLinha, chars: {} }
  const traco = { font: `${chave}:contorno`, size: tamanho, lineHeight: alturaLinha, chars: {} }
  const fonte = { chave, tamanho, contorno, escala, base, alturaLinha, dados, traco, medidor: null, scene }
  const medidor = document.createElement('canvas').getContext('2d')
  medidor.font = `${tamanho}px ${FONTE}`
  fonte.medidor = medidor
  const camadas = contorno > 0 ? 2 : 1
  const area = [...CHARSET].length * camadas * (Math.ceil((tamanho + contorno) * escala) + BORDA * 2) * (Math.ceil(alturaLinha * escala) + BORDA * 2)
  fonte.pagina = paginaPara(scene, area)
  fontes.set(chave, fonte)
  for (const ch of CHARSET) adicionarLetra(fonte, ch)
  for (const p of paginas) if (p.sujo) refrescar(p)
  scene.sys.cache.bitmapFont.add(chave, { data: dados, texture: fonte.pagina.chave, frame: null, fromAtlas: false })
  scene.sys.cache.bitmapFont.add(`${chave}:contorno`, { data: traco, texture: fonte.pagina.chave, frame: null, fromAtlas: false })
  return chave
}

function refrescar(p) {
  p.textura?.refresh()
  p.sujo = false
}

// rasteriza uma letra (preenchimento e, com contorno, o traço) e põe no atlas
function adicionarLetra(fonte, ch) {
  const codigo = ch.codePointAt(0)
  if (fonte.dados.chars[codigo]) return
  const { tamanho, contorno, escala, alturaLinha, medidor } = fonte
  const avanco = medidor.measureText(ch).width
  const largura = avanco + contorno // a largura de uma linha de 1 letra no Text
  const wpx = Math.max(1, Math.ceil(largura * escala))
  const hpx = Math.max(1, Math.ceil(alturaLinha * escala))
  const camadas = contorno > 0 ? 2 : 1
  // as duas camadas lado a lado na página da fonte (preenchimento, traço)
  const p = fonte.pagina
  const r = lugar(p, (wpx + BORDA * 2) * camadas, hpx + BORDA * 2)
  if (!r) return
  const ctx = p.ctx
  const x0 = r.x + BORDA
  const y0 = r.y + BORDA
  const desenhar = (x, soTraco) => {
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y0, wpx, hpx)
    ctx.clip()
    ctx.translate(x, y0)
    ctx.scale(escala, escala)
    ctx.font = `${tamanho}px ${FONTE}`
    ctx.textBaseline = 'alphabetic'
    ctx.lineWidth = contorno
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#ffffff'
    const lx = Math.round(contorno / 2)
    const ly = Math.round(fonte.base)
    if (soTraco) ctx.strokeText(ch, lx, ly)
    else ctx.fillText(ch, lx, ly)
    ctx.restore()
  }
  desenhar(x0, false)
  if (camadas === 2) desenhar(x0 + wpx + BORDA * 2, true)
  p.sujo = true
  const letra = (x) => ({
    x,
    y: y0,
    width: wpx / escala,
    height: hpx / escala,
    centerX: Math.floor(wpx / 2),
    centerY: Math.floor(hpx / 2),
    xOffset: 0,
    yOffset: 0,
    xAdvance: avanco,
    data: {},
    kerning: kerning(fonte, ch),
    u0: x / LADO_PAGINA,
    v0: 1 - y0 / LADO_PAGINA,
    u1: (x + wpx) / LADO_PAGINA,
    v1: 1 - (y0 + hpx) / LADO_PAGINA,
  })
  fonte.dados.chars[codigo] = letra(x0)
  // (sem contorno a camada do traço nem é desenhada: as medidas são as mesmas)
  fonte.traco.chars[codigo] = camadas === 2 ? letra(x0 + wpx + BORDA * 2) : fonte.dados.chars[codigo]
}

// o kerning do par (anterior, esta), medido na hora em que o BitmapText pergunta (o canvas do Text aplica o da fonte)
function kerning(fonte, ch) {
  const cache = {}
  return new Proxy(cache, {
    get(alvo, k) {
      if (typeof k !== 'string') return undefined
      if (k in alvo) return alvo[k]
      const anterior = String.fromCodePoint(Number(k))
      const m = fonte.medidor
      const v = m.measureText(anterior + ch).width - m.measureText(anterior).width - m.measureText(ch).width
      alvo[k] = Math.abs(v) < 1e-3 ? 0 : v
      return alvo[k]
    },
    has: () => true,
  })
}

function garantirLetras(fonte, texto) {
  let novas = false
  for (const ch of texto) {
    if (ch === '\n' || fonte.dados.chars[ch.codePointAt(0)]) continue
    adicionarLetra(fonte, ch)
    novas = true
  }
  if (novas) refrescar(fonte.pagina)
}

// ---------- a cor (CSS -> número) ----------

const corNumero = (cor, padrao = 0xffffff) => {
  if (typeof cor === 'number') return cor
  if (typeof cor !== 'string') return padrao
  const c = Phaser.Display.Color.ValueToColor(cor)
  return c ? c.color : padrao
}

const px = (v) => (typeof v === 'number' ? v : parseFloat(String(v ?? '16')))

// ---------- o objeto ----------

// A camada do contorno é o próprio TextoBitmap; o preenchimento é um BitmapText que ele desenha logo depois, com a
// mesma posição, rotação, escala, origem, alpha e texto (fora da lista de exibição: não custa nada fora daqui)
export class TextoBitmap extends Phaser.GameObjects.BitmapText {
  constructor(scene, x, y, texto, estilo = {}) {
    const tamanho = px(estilo.fontSize)
    const contorno = estilo.stroke ? (estilo.strokeThickness ?? 0) : 0
    const chave = criarFonte(scene, tamanho, contorno, RES.escala)
    super(scene, x, y, `${chave}:contorno`, '', tamanho, alinhar(estilo.align))
    Phaser.Utils.String.UUID() // o mesmo sorteio que um Text faria (ver o topo)
    this.type = 'TextoBitmap'
    this.estilo = { tamanho, contorno, cor: estilo.color ?? '#ffffff', corContorno: estilo.stroke ?? '#000000', lineSpacing: estilo.lineSpacing ?? 0 }
    this.fonte = fontes.get(chave)
    this.cheio = new Phaser.GameObjects.BitmapText(scene, x, y, chave, '', tamanho, alinhar(estilo.align))
    this.cheio.setTint(corNumero(this.estilo.cor))
    super.setTint(corNumero(this.estilo.corContorno, 0x000000))
    this.setLineSpacing(this.estilo.lineSpacing)
    this.cheio.setLineSpacing(this.estilo.lineSpacing)
    this.setText(texto)
  }

  setText(valor) {
    const texto = Array.isArray(valor) ? valor.join('\n') : String(valor ?? '')
    if (texto === this._text && this.cheio?._text === texto) return this
    if (this.fonte) garantirLetras(this.fonte, texto)
    super.setText(texto)
    this.cheio?.setText(texto)
    return this
  }

  // A linha de um Text mede o texto MAIS a espessura do contorno; a do BitmapText, só os avanços das letras. Aqui a
  // largura ganha o contorno (e a origem é refeita com ela): a mesma caixa do Text, para a origem e os layouts
  getTextBounds(round) {
    const b = this._bounds
    const refaz = this._dirty || round || this.scaleX !== b.scaleX || this.scaleY !== b.scaleY
    super.getTextBounds(round)
    const c = this.estilo?.contorno ?? 0
    if (refaz && c > 0 && this._text) {
      b.local.width += c
      b.global.width += c * this.scaleX
      this._displayOriginX = this.originX * b.local.width
      b.global.x = this.x - this._displayOriginX * this.scaleX
    }
    return b
  }

  get style() {
    return { color: this.estilo.cor, stroke: this.estilo.corContorno, strokeThickness: this.estilo.contorno, fontSize: `${this.estilo.tamanho}px` }
  }

  setColor(cor) {
    this.estilo.cor = cor
    this.cheio.setTint(corNumero(cor))
    return this
  }

  setFill(cor) {
    return this.setColor(cor)
  }

  setStroke(cor, espessura = this.estilo.contorno) {
    this.estilo.corContorno = cor
    super.setTint(corNumero(cor, 0x000000))
    if (espessura !== this.estilo.contorno) {
      this.estilo.contorno = espessura
      this.trocarFonte()
    }
    return this
  }

  setFontSize(tamanho) {
    const t = px(tamanho)
    if (t === this.estilo.tamanho) return this
    this.estilo.tamanho = t
    this.trocarFonte()
    return this
  }

  setAlign(align) {
    this.align = alinhar(align)
    this.cheio.align = this.align
    return this
  }

  setLineSpacing(v) {
    super.setLineSpacing(v)
    this.cheio?.setLineSpacing(v)
    return this
  }

  setResolution() {
    return this // (a resolução é a da fonte: reajustarEscala)
  }

  // a escala da tela mudou (resolucao.js): fontes novas, na resolução nova
  reajustarEscala() {
    this.trocarFonte()
  }

  trocarFonte() {
    const { tamanho, contorno } = this.estilo
    const chave = criarFonte(this.scene, tamanho, contorno, RES.escala)
    this.fonte = fontes.get(chave)
    garantirLetras(this.fonte, this._text)
    this.setFont(`${chave}:contorno`, tamanho)
    this.cheio.setFont(chave, tamanho)
  }

  // (o Phaser chama o render como função solta: o objeto é `src`, não `this`)
  renderWebGL(renderer, src, drawingContext, parentMatrix, ...resto) {
    // primeiro o contorno inteiro, depois o preenchimento (como o canvas do Text)
    if (src.estilo.contorno > 0) BITMAP_RENDER.call(src, renderer, src, drawingContext, parentMatrix, ...resto)
    else src.getTextBounds(false)
    const c = src.cheio
    c.x = src.x
    c.y = src.y
    c.rotation = src.rotation
    c.scaleX = src.scaleX
    c.scaleY = src.scaleY
    c.scrollFactorX = src.scrollFactorX
    c.scrollFactorY = src.scrollFactorY
    c.blendMode = src.blendMode
    if (c._alphaTL !== src._alphaTL || c._alphaBR !== src._alphaBR) c.setAlpha(src._alphaTL, src._alphaTR, src._alphaBL, src._alphaBR)
    if (c.originX !== src.originX || c.originY !== src.originY) c.setOrigin(src.originX, src.originY)
    c.getTextBounds(false) // (refaz a origem dele se o texto mudou; a de verdade é a do contorno, logo abaixo)
    c._displayOriginX = src._displayOriginX
    c._displayOriginY = src._displayOriginY
    BITMAP_RENDER.call(c, renderer, c, drawingContext, parentMatrix, ...resto)
  }

  preDestroy() {
    this.cheio?.destroy()
    this.cheio = null
    super.preDestroy?.()
  }
}

const BITMAP_RENDER = Phaser.GameObjects.BitmapText.prototype.renderWebGL
const alinhar = (align) => (align === 'center' ? 1 : align === 'right' ? 2 : 0)

// o estilo cabe num TextoBitmap?
export function estiloCabe(estilo = {}) {
  if (estilo.fontFamily !== FONTE) return false
  if (estilo.wordWrap || estilo.shadow || estilo.backgroundColor || estilo.fixedWidth || estilo.fixedHeight || estilo.padding) return false
  if (estilo.fontStyle && estilo.fontStyle !== 'normal') return false
  if (estilo.maxLines || estilo.rtl || estilo.baselineX || estilo.baselineY) return false
  if (estilo.align && !['left', 'center', 'right'].includes(estilo.align)) return false
  return Number.isFinite(px(estilo.fontSize))
}

// O texto da partida: TextoBitmap quando dá, Text de sempre quando não dá
export function textoJogo(scene, x, y, texto, estilo = {}) {
  if (!estiloCabe(estilo) || typeof scene?.sys?.cache?.bitmapFont?.add !== 'function' || !globalThis.document) return scene.add.text(x, y, texto, estilo)
  const t = new TextoBitmap(scene, x, y, texto, estilo)
  scene.add.existing(t)
  return t
}
