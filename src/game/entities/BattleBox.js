import Phaser from 'phaser'
import { CAIXA, CAIXA_DINAMICA, CORES } from '../constants.js'
import { tocar } from '../audio.js'
import { ajustarCamera } from '../resolucao.js'
import { caixasDe, registrarCaixa, removerCaixa, ignorarNasCaixas } from '../recorte.js'

// A caixa branca onde os corações desviam (abre para o ataque e fecha no
// fim). Pode mudar de forma no meio do turno (mudarPara), sempre
// com uma pré-visualização antes, e volta ao padrão quando fecha.
//
// Cada Pista (pvp/Pista.js) tem a sua. Opções:
//   x, y              centro padrão
//   largura, altura   tamanho padrão
//   dinamica          limites da caixa dinâmica, mesclados em CAIXA_DINAMICA
//                     (larguraMin/Max, alturaMin/Max, deslocMax, campo)
//   cor               cor da borda
// As formas pedidas pelos ataques ({ largura, altura, x, y }) são pensadas
// para a caixa padrão CAIXA; numa caixa de outro tamanho elas são escaladas
// na mesma proporção (ver destinoDe).
export default class BattleBox {
  constructor(scene, { x, y, largura, altura, dinamica, cor }) {
    this.scene = scene
    this.base = { x, y, largura, altura } // centro e tamanho padrão
    this.dinamica = { ...CAIXA_DINAMICA, ...dinamica }
    this.escala = { x: largura / CAIXA.largura, y: altura / CAIXA.altura } // formas dos ataques -> esta caixa
    // `limites` é um objeto só, alterado no lugar: quem guardou a referência (ataques, corações, balas) sempre vê a caixa atual
    this.limites = new Phaser.Geom.Rectangle(x - largura / 2, y - altura / 2, largura, altura)
    this.retangulo = scene.add
      .rectangle(x, y, largura, altura, CORES.fundo)
      .setStrokeStyle(CAIXA.borda, cor)
      .setDepth(1)
      .setVisible(false)

    // Câmera com viewport do tamanho da caixa: o que for passado para
    // recortar() só é desenhado por ela, então some fora da caixa. Ela só
    // fica visível com a caixa aberta. Cada caixa tem a sua: quem precisa
    // dela usa caixa.camera (ou recorte.js para "todas as caixas").
    const l = this.limites
    this.camera = ajustarCamera(scene.cameras.add(), l.x, l.y, l.width, l.height).setScroll(l.x, l.y).setVisible(false)
    // objetos recortados por esta caixa: as câmeras das outras caixas não os desenham
    this.recortados = new Set()
    for (const outra of caixasDe(scene)) this.camera.ignore([...outra.recortados])
    // o retângulo das outras caixas também não aparece aqui (nem o desta nas outras)
    for (const outra of caixasDe(scene)) {
      this.camera.ignore(outra.retangulo)
      outra.camera.ignore(this.retangulo)
    }
    registrarCaixa(scene, this)

    this.mudanca = null // mudança em andamento (ver mudarPara)
    this.aoMudar = null // chamado a cada passo da transição (a cena usa para empurrar os corações)
  }

  get emTransicao() {
    return this.mudanca !== null
  }

  // Os objetos passam a ser desenhados só pela câmera desta caixa
  recortar(...objetos) {
    const lista = objetos.flat()
    this.scene.cameras.main.ignore(lista)
    for (const outra of caixasDe(this.scene)) if (outra !== this) outra.camera.ignore(lista)
    for (const o of lista) {
      if (this.recortados.has(o)) continue
      this.recortados.add(o)
      o.once?.('destroy', () => this.recortados.delete(o))
    }
  }

  // Remove a caixa da cena (a do co-op vive a cena toda e não precisa disso)
  destruir() {
    this.cancelarMudanca()
    this.scene.tweens.killTweensOf(this.retangulo)
    removerCaixa(this.scene, this)
    this.scene.cameras.remove(this.camera)
    this.retangulo.destroy()
    this.recortados.clear()
  }

  mostrar(aoAbrir) {
    this.cancelarMudanca()
    this.aplicar(this.base.x, this.base.y, this.base.largura, this.base.altura)
    this.scene.tweens.killTweensOf(this.retangulo)
    this.retangulo.setVisible(true).setScale(0.05, 0.05)
    this.scene.tweens.add({
      targets: this.retangulo,
      scaleX: 1,
      scaleY: 1,
      duration: CAIXA.tweenMs,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.camera.setVisible(true)
        aoAbrir?.()
      },
    })
  }

  esconder(aoFechar) {
    this.cancelarMudanca()
    this.camera.setVisible(false)
    this.scene.tweens.killTweensOf(this.retangulo)
    this.scene.tweens.add({
      targets: this.retangulo,
      scaleX: 0.05,
      scaleY: 0.05,
      duration: CAIXA.tweenMs,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.retangulo.setVisible(false)
        // fechada, volta ao tamanho padrão (invisível, sem pulo)
        this.aplicar(this.base.x, this.base.y, this.base.largura, this.base.altura)
        aoFechar?.()
      },
    })
  }

  // ---------- caixa dinâmica ----------

  // Retângulo de destino de uma forma { largura, altura, x?, y? } (null = padrão),
  // respeitando os limites de tamanho e o campo da tela
  // (as medidas da forma são da caixa padrão CAIXA e escalam com esta caixa)
  destinoDe(forma) {
    const d = this.dinamica
    const f = forma ?? {}
    const e = this.escala
    const largura = Phaser.Math.Clamp((f.largura ?? CAIXA.largura) * e.x, d.larguraMin, d.larguraMax)
    const altura = Phaser.Math.Clamp((f.altura ?? CAIXA.altura) * e.y, d.alturaMin, d.alturaMax)
    const cx = Phaser.Math.Clamp(this.base.x + Phaser.Math.Clamp((f.x ?? 0) * e.x, -d.deslocMax, d.deslocMax), d.campo.esquerda + largura / 2, d.campo.direita - largura / 2)
    const cy = Phaser.Math.Clamp(this.base.y + Phaser.Math.Clamp((f.y ?? 0) * e.y, -d.deslocMax, d.deslocMax), d.campo.topo + altura / 2, d.campo.base - altura / 2)
    return new Phaser.Geom.Rectangle(Math.round(cx - largura / 2), Math.round(cy - altura / 2), Math.round(largura), Math.round(altura))
  }

  // Muda a caixa para `forma` (null = padrão): primeiro a pré-visualização
  // (avisoMs), depois a transição (transicaoMs). Devolve false se já estava assim.
  // O tempo anda em atualizar(dt), o MESMO relógio do ataque (a Pista chama os dois
  // juntos): assim as balas só começam depois da caixa parar, em qualquer FPS.
  mudarPara(forma, { aviso = CAIXA_DINAMICA.avisoMs, transicao = CAIXA_DINAMICA.transicaoMs, aoTerminar } = {}) {
    this.cancelarMudanca()
    const destino = this.destinoDe(forma)
    const l = this.limites
    if (destino.x === l.x && destino.y === l.y && destino.width === l.width && destino.height === l.height) return false

    tocar(this.scene, 'aviso')
    this.mudanca = { fase: 'aviso', t: 0, aviso, transicao, destino, de: null, previa: this.criarPrevia(destino), aoTerminar }
    return true
  }

  // Avança o aviso e a transição (dt em ms, mesmo relógio do ataque)
  atualizar(dt) {
    const m = this.mudanca
    if (!m) return
    m.t += dt

    if (m.fase === 'aviso') {
      if (m.t < m.aviso) return
      this.limparPrevia(m.previa)
      m.previa = null
      m.fase = 'transicao'
      m.t -= m.aviso
      const l = this.limites
      m.de = { x: l.centerX, y: l.centerY, w: l.width, h: l.height }
    }

    const k = Phaser.Math.Clamp(m.t / m.transicao, 0, 1)
    const e = (1 - Math.cos(Math.PI * k)) / 2 // Sine.easeInOut
    const { de, destino } = m
    const lerp = (a, b) => a + (b - a) * e
    this.aplicar(lerp(de.x, destino.centerX), lerp(de.y, destino.centerY), lerp(de.w, destino.width), lerp(de.h, destino.height))
    if (k >= 1) {
      this.mudanca = null
      m.aoTerminar?.()
    }
  }

  // Cancela aviso/transição em andamento (fim do turno, ataque interrompido)
  cancelarMudanca() {
    if (!this.mudanca) return
    this.limparPrevia(this.mudanca.previa)
    this.mudanca = null
  }

  // Aplica centro e tamanho: retângulo visível, limites (no lugar) e câmera de recorte
  aplicar(cx, cy, largura, altura) {
    const w = Math.round(largura)
    const h = Math.round(altura)
    const l = this.limites
    l.setTo(Math.round(cx - w / 2), Math.round(cy - h / 2), w, h)
    this.retangulo.setPosition(l.centerX, l.centerY).setSize(w, h)
    ajustarCamera(this.camera, l.x, l.y, l.width, l.height).setScroll(l.x, l.y)
    this.aoMudar?.()
  }

  // A resolução da tela mudou (resolucao.js): refaz a câmera de recorte
  reaplicar() {
    const l = this.limites
    ajustarCamera(this.camera, l.x, l.y, l.width, l.height).setScroll(l.x, l.y)
  }

  // Pré-visualização: contorno pulsante da caixa nova e, nas partes da caixa
  // atual que vão sumir, uma faixa vermelha. São dois desenhos iguais: um
  // para a câmera principal (fora da caixa) e um para a câmera da caixa
  // (dentro dela, onde a principal fica coberta).
  criarPrevia(destino) {
    const atual = Phaser.Geom.Rectangle.Clone(this.limites)
    const perdas = areasPerdidas(atual, destino)
    const cor = perdas.length ? CORES.aviso : 0xffffff
    const desenhar = (g) => {
      g.fillStyle(CORES.aviso, 0.3)
      perdas.forEach((r) => g.fillRect(r.x, r.y, r.width, r.height))
      g.lineStyle(2, cor, 0.95)
      g.strokeRect(destino.x, destino.y, destino.width, destino.height)
    }
    const principal = this.scene.add.graphics().setDepth(8)
    desenhar(principal)
    ignorarNasCaixas(this.scene, principal) // fora da caixa: só a câmera principal
    const dentro = this.scene.add.graphics().setDepth(8)
    desenhar(dentro)
    this.recortar(dentro)
    const pulso = this.scene.tweens.add({ targets: [principal, dentro], alpha: 0.35, duration: 90, yoyo: true, repeat: -1 })
    return { objetos: [principal, dentro], pulso }
  }

  limparPrevia(previa) {
    if (!previa) return
    previa.pulso.stop()
    previa.objetos.forEach((o) => o.destroy())
  }
}

// Partes de `atual` que ficam fora de `destino` (até 4 faixas)
function areasPerdidas(atual, destino) {
  const c = Phaser.Math.Clamp
  const faixas = [
    new Phaser.Geom.Rectangle(atual.left, atual.top, c(destino.left, atual.left, atual.right) - atual.left, atual.height),
    new Phaser.Geom.Rectangle(c(destino.right, atual.left, atual.right), atual.top, atual.right - c(destino.right, atual.left, atual.right), atual.height),
  ]
  const x0 = Math.max(atual.left, destino.left)
  const x1 = Math.min(atual.right, destino.right)
  if (x1 > x0) {
    faixas.push(new Phaser.Geom.Rectangle(x0, atual.top, x1 - x0, c(destino.top, atual.top, atual.bottom) - atual.top))
    faixas.push(new Phaser.Geom.Rectangle(x0, c(destino.bottom, atual.top, atual.bottom), x1 - x0, atual.bottom - c(destino.bottom, atual.top, atual.bottom)))
  }
  return faixas.filter((r) => r.width > 1 && r.height > 1)
}
