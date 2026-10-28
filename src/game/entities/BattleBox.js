import Phaser from 'phaser'
import { CAIXA, CAIXA_DINAMICA, CORES } from '../constants.js'
import { tocar } from '../audio.js'
import { ajustarCamera, RES } from '../resolucao.js'
import { caixasDe, registrarCaixa, removerCaixa, ignorarNasCaixas } from '../recorte.js'
import { fatores, duracaoPulso } from '../acessibilidade.js'

// Faixa de aproximação em volta da caixa (ver aproximar()):
//   px      quanto a faixa passa da caixa para cada lado (mundo 640x480)
//   alpha   transparência do que aparece nela (ainda está fora: não machuca)
export const FAIXA = { px: 52, alpha: 0.85 }

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
//   campoFaixa        região da tela onde a faixa de aproximação pode aparecer
//                     ({ esquerda, direita, topo, base }; padrão: dinamica.campo).
//                     Caixas vizinhas: campos que não se cruzam e não pegam o HUD
//
// VISTA (só apresentação; o todos contra todos usa para o "zoom" no par em foco): a caixa continua no
// mesmo lugar do MUNDO (limites, balas, corações, colisão e as posições que viajam pela rede não mudam),
// mas aparece na tela em outro lugar e tamanho. setVista(x, y, escala) diz onde o centro padrão aparece e
// com que escala: as câmeras de recorte mostram a região da caixa ali, a borda vai junto e
// naTela(x, y) leva um ponto do mundo da caixa para a tela. setOculta(true) não desenha a caixa
// (câmeras e borda), sem parar nada do que roda nela.
//
// As formas pedidas pelos ataques ({ largura, altura, x, y }) são pensadas
// para a caixa padrão CAIXA; numa caixa de outro tamanho elas são escaladas
// na mesma proporção (ver destinoDe).
export default class BattleBox {
  constructor(scene, { x, y, largura, altura, dinamica, cor, campoFaixa }) {
    this.scene = scene
    this.base = { x, y, largura, altura } // centro e tamanho padrão
    this.vista = { x, y, escala: 1 } // onde o centro padrão aparece na tela (setVista)
    this.oculta = false
    this.cameraAberta = false
    this.bordaVisivel = false
    this.dinamica = { ...CAIXA_DINAMICA, ...dinamica }
    this.escala = { x: largura / CAIXA.largura, y: altura / CAIXA.altura } // formas dos ataques -> esta caixa
    // `limites` é um objeto só, alterado no lugar: quem guardou a referência (ataques, corações, balas) sempre vê a caixa atual
    this.limites = new Phaser.Geom.Rectangle(x - largura / 2, y - altura / 2, largura, altura)
    this.retangulo = scene.add
      .rectangle(x, y, largura, altura, CORES.fundo)
      .setStrokeStyle(CAIXA.borda, cor)
      .setDepth(1)
      .setVisible(false)

    // Faixa de aproximação: uma câmera um pouco MAIOR que a caixa que só
    // desenha o que foi passado para aproximar() (as balas e o que vem
    // entrando). Ela é criada antes da câmera da caixa, então desenha POR
    // BAIXO dela: dentro da caixa a câmera da caixa cobre tudo e nada muda; em
    // volta, o jogador vê o projétil chegando (meio transparente, FAIXA.alpha).
    // Não passa de campoFaixa (não invade a outra caixa nem o HUD). Todo o
    // resto da cena é ignorado por ela (filtrarFaixa, a cada quadro).
    this.campoFaixa = campoFaixa ?? this.dinamica.campo ?? null
    this.limitesFaixa = new Phaser.Geom.Rectangle()
    this.cameraFaixa = scene.cameras.add().setAlpha(FAIXA.alpha).setVisible(false)
    this.camera = null // (criada logo abaixo; ajustarFaixa só precisa da da faixa)
    this.naFaixa = new Set() // objetos que a faixa desenha
    this.faixaLigada = true // eventos que escurecem a caixa (apagão) desligam a faixa
    this.ajustarFaixa()
    this.filtrarFaixa = this.filtrarFaixa.bind(this)
    scene.events.on('prerender', this.filtrarFaixa)
    // os eventos da cena sobrevivem ao restart: a caixa do co-op vive a cena toda
    this.aoDesligarCena = () => scene.events.off('prerender', this.filtrarFaixa)
    scene.events.once('shutdown', this.aoDesligarCena)

    // Câmera com viewport do tamanho da caixa: o que for passado para
    // recortar() só é desenhado por ela, então some fora da caixa. Ela só
    // fica visível com a caixa aberta. Cada caixa tem a sua: quem precisa
    // dela usa caixa.camera (ou recorte.js para "todas as caixas").
    const l = this.limites
    this.camera = this.ajustarRecorte(scene.cameras.add(), l.x, l.y, l.width, l.height).setVisible(false)
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

  // ---------- vista (só apresentação) ----------

  get vistaNormal() {
    const v = this.vista
    return v.escala === 1 && v.x === this.base.x && v.y === this.base.y
  }

  // ponto do mundo desta caixa -> onde ele aparece na tela
  naTela(x, y) {
    const v = this.vista
    return { x: v.x + (x - this.base.x) * v.escala, y: v.y + (y - this.base.y) * v.escala }
  }

  setVista(x, y, escala = 1) {
    this.vista = { x, y, escala }
    // fora do lugar, a câmera da caixa não desenha a borda (ela está em outro ponto da tela)
    if (!this.vistaNormal) this.retangulo.cameraFilter |= this.camera.id
    this.reaplicar()
    this.posicionarBorda()
    return this
  }

  setOculta(oculta) {
    this.oculta = Boolean(oculta)
    this.camera.setVisible(this.cameraAberta && !this.oculta)
    this.retangulo.setVisible(this.bordaVisivel && !this.oculta)
    return this
  }

  mostrarBorda(visivel) {
    this.bordaVisivel = visivel
    this.retangulo.setVisible(visivel && !this.oculta)
  }

  posicionarBorda() {
    const l = this.limites
    const p = this.naTela(l.centerX, l.centerY)
    const r = this.retangulo
    r.setPosition(p.x, p.y)
    if (!this.scene.tweens.isTweening(r)) r.setScale(this.vista.escala * (this.cameraAberta ? 1 : 0.05))
  }

  // câmera de recorte que mostra o retângulo (x0, y0, w, h) do mundo onde a vista põe ele
  ajustarRecorte(camera, x0, y0, w, h) {
    const s = this.vista.escala
    if (s === 1 && this.vistaNormal) return ajustarCamera(camera, x0, y0, w, h).setScroll(x0, y0)
    const p = this.naTela(x0, y0)
    ajustarCamera(camera, p.x, p.y, w * s, h * s).setZoom(RES.escala * s)
    return camera.setScroll(x0, y0)
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

  // Como recortar(), e o objeto também aparece na faixa de aproximação em
  // volta da caixa (meio transparente): balas e o que vem entrando de fora
  // (lanças, latas...). Véus, fundos e escuros da caixa ficam só em recortar():
  // na faixa eles vazariam para fora da caixa.
  aproximar(...objetos) {
    const lista = objetos.flat()
    this.recortar(lista)
    const id = this.cameraFaixa.id
    for (const o of lista) {
      o.cameraFilter &= ~id
      if (this.naFaixa.has(o)) continue
      this.naFaixa.add(o)
      o.once?.('destroy', () => this.naFaixa.delete(o))
    }
  }

  // Antes de desenhar (todo quadro): a faixa só aparece com a caixa aberta (e
  // some junto quando alguém esconde a câmera da caixa, como a fita do replay),
  // e ignora tudo da cena que não foi aproximado — inclusive o que foi criado
  // neste quadro (HUD, efeitos, outros recortes)
  filtrarFaixa() {
    const cam = this.cameraFaixa
    cam.setVisible(this.faixaLigada && this.camera.visible)
    if (!cam.visible) return
    const id = cam.id
    for (const o of this.scene.children.list) {
      if (!(o.cameraFilter & id) && !this.naFaixa.has(o)) o.cameraFilter |= id
    }
  }

  // Câmeras de recorte desta caixa e o retângulo (mundo) que cada uma mostra,
  // na ordem em que desenham (bonus/eventos/pontaCabeca.js gira as duas)
  get recortes() {
    return [
      { camera: this.cameraFaixa, limites: this.limitesFaixa },
      { camera: this.camera, limites: this.limites },
    ]
  }

  // Tremor só DESTA caixa (golpe no coração, explosão dentro dela): o resto da
  // tela fica parado — tremer o jogo inteiro a cada dano enjoa em partidas
  // rápidas. `px` é o deslocamento máximo (mundo 640x480). As câmeras da caixa
  // tremem pelo efeito do Phaser (sem mexer no scroll) e a borda junto, pela
  // origem de desenho (sem mexer em x/y, que as animações da caixa usam).
  // A preferência de tremor (acessibilidade.js) reduz ou desliga.
  tremer(duracao = 120, px = 2) {
    px *= fatores().tremor
    if (px <= 0.05) return
    const l = this.limites
    for (const cam of [this.camera, this.cameraFaixa]) cam.shake(duracao, px / Math.max(1, l.width), true)
    const r = this.retangulo
    this.tremorBorda?.remove()
    const voltar = () => r.scene && r.setOrigin(0.5, 0.5)
    this.tremorBorda = this.scene.time.addEvent({
      delay: 16,
      repeat: Math.max(1, Math.round(duracao / 16)),
      callback: () => {
        if (!r.scene) return
        if (this.tremorBorda.getRepeatCount() === 0) return voltar()
        r.setDisplayOrigin(r.width / 2 + Phaser.Math.FloatBetween(-px, px), r.height / 2 + Phaser.Math.FloatBetween(-px, px))
      },
    })
  }

  // Remove a caixa da cena (a do co-op vive a cena toda e não precisa disso)
  destruir() {
    this.cancelarMudanca()
    this.scene.tweens.killTweensOf(this.retangulo)
    removerCaixa(this.scene, this)
    this.aoDesligarCena()
    this.scene.events.off('shutdown', this.aoDesligarCena)
    this.scene.cameras.remove(this.camera)
    this.scene.cameras.remove(this.cameraFaixa)
    this.retangulo.destroy()
    this.recortados.clear()
    this.naFaixa.clear()
  }

  mostrar(aoAbrir) {
    this.cancelarMudanca()
    this.aplicar(this.base.x, this.base.y, this.base.largura, this.base.altura)
    this.scene.tweens.killTweensOf(this.retangulo)
    const s = this.vista.escala
    this.mostrarBorda(true)
    this.retangulo.setScale(0.05 * s, 0.05 * s)
    this.scene.tweens.add({
      targets: this.retangulo,
      scaleX: s,
      scaleY: s,
      duration: CAIXA.tweenMs,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.cameraAberta = true
        this.camera.setVisible(!this.oculta)
        aoAbrir?.()
      },
    })
  }

  esconder(aoFechar) {
    this.cancelarMudanca()
    this.cameraAberta = false
    this.camera.setVisible(false)
    this.scene.tweens.killTweensOf(this.retangulo)
    this.scene.tweens.add({
      targets: this.retangulo,
      scaleX: 0.05 * this.vista.escala,
      scaleY: 0.05 * this.vista.escala,
      duration: CAIXA.tweenMs,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.mostrarBorda(false)
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
    this.retangulo.setSize(w, h)
    const p = this.naTela(l.centerX, l.centerY)
    this.retangulo.setPosition(p.x, p.y)
    this.ajustarRecorte(this.camera, l.x, l.y, l.width, l.height)
    this.ajustarFaixa()
    this.aoMudar?.()
  }

  // A resolução da tela mudou (resolucao.js): refaz as câmeras de recorte
  reaplicar() {
    const l = this.limites
    this.ajustarRecorte(this.camera, l.x, l.y, l.width, l.height)
    this.ajustarFaixa()
  }

  // Faixa de aproximação: a caixa mais FAIXA.px para cada lado, sem passar do
  // campoFaixa (mas nunca menor que a própria caixa)
  ajustarFaixa() {
    const l = this.limites
    const c = this.campoFaixa
    const m = FAIXA.px
    const x0 = Math.min(l.left, Math.max(l.left - m, c?.esquerda ?? -Infinity))
    const x1 = Math.max(l.right, Math.min(l.right + m, c?.direita ?? Infinity))
    const y0 = Math.min(l.top, Math.max(l.top - m, c?.topo ?? -Infinity))
    const y1 = Math.max(l.bottom, Math.min(l.bottom + m, c?.base ?? Infinity))
    this.limitesFaixa.setTo(x0, y0, x1 - x0, y1 - y0)
    this.ajustarRecorte(this.cameraFaixa, x0, y0, x1 - x0, y1 - y0)
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
    // (com a vista fora do lugar, o desenho de fora da caixa vai para onde ela aparece)
    const v = this.vista
    if (!this.vistaNormal) principal.setPosition(v.x - this.base.x * v.escala, v.y - this.base.y * v.escala).setScale(v.escala)
    if (this.oculta) principal.setVisible(false)
    ignorarNasCaixas(this.scene, principal) // fora da caixa: só a câmera principal
    const dentro = this.scene.add.graphics().setDepth(8)
    desenhar(dentro)
    this.recortar(dentro)
    const pulso = this.scene.tweens.add({ targets: [principal, dentro], alpha: 0.35, duration: duracaoPulso(90), yoyo: true, repeat: -1 })
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
