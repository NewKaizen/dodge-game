import Phaser from 'phaser'
import Controles from '../controles.js'
import { criarFundo } from '../backgrounds/index.js'
import { tocar, musica } from '../audio.js'
import { shake } from '../effects/shake.js'
import { flashTela } from '../effects/flash.js'
import { particulas } from '../effects/particulas.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'
import { PERSONAGENS_PVP } from '../pvp/cartas.js'

// Tela inicial. Na primeira vez: as letras do título despencam uma a uma e,
// na última, o caos começa: chuva e anéis de balas de todos os naipes, os
// dois corações desviando sozinhos, os sete lutadores pulando no ritmo e o
// título tremendo com glitch. Depois: JOGAR (-> Modo) e CONFIGURAÇÕES (-> Config).
// Sem joystick conectado, as opções ficam apagadas e um aviso pede para conectar.
//
//   cima/baixo escolher · A confirmar
export const TITULO = 'DODGE'
const SUBTITULO = '★ DESVIE OU CAIA ★'
const OPCOES = [
  { id: 'jogar', rotulo: 'JOGAR' },
  { id: 'config', rotulo: 'CONFIGURAÇÕES' },
]
const BATIDA = 468 // ms (~128 bpm): o pulso de tudo
const ARCO = [0xff4a5a, 0xffa23a, 0xffe14a, 0x5ae06a, 0x4ab8ff, 0xa66bff, 0xff5ad8]
const FORMAS = ['bala-espadas', 'bala-copas', 'bala-ouros', 'bala-paus', 'bala-losango', 'bala-hex', 'bala-coroa', 'bala-bola']
const MAX_BALAS = 160
const Y_TITULO = 132
const Y_OPCOES = 290

export default class Menu extends Phaser.Scene {
  constructor() {
    super('Menu')
  }

  create() {
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => botao === 'A' && this.confirmar())
    this.saindo = false
    this.pronto = false
    this.indice = this.registry.get('menuIndice') ?? 0 // volta na opção de onde saiu
    this.balas = []
    this.rastros = []
    this.batidas = 0
    const primeiraVez = !this.registry.get('menuVisto')
    this.registry.set('menuVisto', true)

    this.fundo = criarFundo(this, 'jevil', 1.4)
    this.fundo.escurecer(true)
    this.montarTitulo()
    this.montarLutadores()
    this.montarCoracoes()
    this.montarOpcoes()

    musica(this, 'jevil', 'selecao')
    if (primeiraVez) this.abertura()
    else {
      this.cameras.main.fadeIn(260)
      this.letras.forEach((l) => l.setY(Y_TITULO))
      this.comecarCaos()
    }

    const aoConectar = () => this.atualizarOpcoes()
    this.registry.events.on('changedata-conectado', aoConectar)
    // o painel de cima pode mudar o número de jogadores: os controles mudam junto
    const aoMudar = (_, valor, anterior) => valor !== anterior && this.scene.restart()
    this.registry.events.on('changedata-numJogadores', aoMudar)
    this.events.once('shutdown', () => {
      this.registry.events.off('changedata-conectado', aoConectar)
      this.registry.events.off('changedata-numJogadores', aoMudar)
    })
  }

  // ---------- título ----------

  montarTitulo() {
    const estilo = (cor) => ({ fontFamily: FONTE, fontSize: '96px', color: cor, stroke: '#000000', strokeThickness: 12 })
    const passo = 74
    const x0 = LARGURA / 2 - ((TITULO.length - 1) * passo) / 2
    // sombras do glitch (vermelha e ciano) atrás de cada letra
    this.glitch = ['#ff2a55', '#2affe8'].map((cor) =>
      [...TITULO].map((ch, i) => this.add.text(x0 + i * passo, Y_TITULO, ch, estilo(cor)).setOrigin(0.5).setDepth(9).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD)),
    )
    this.letras = [...TITULO].map((ch, i) => this.add.text(x0 + i * passo, -120, ch, estilo('#ffffff')).setOrigin(0.5).setDepth(10))
    this.letras.forEach((l, i) => (l.baseX = x0 + i * passo))
    this.sub = this.add
      .text(LARGURA / 2, Y_TITULO + 70, '', { fontFamily: FONTE, fontSize: '18px', color: TEXTO.selecionado, stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(10)
  }

  async abertura() {
    this.cameras.main.fadeIn(120)
    for (let i = 0; i < this.letras.length; i++) {
      const l = this.letras[i]
      tocar(this, 'voo')
      await this.tween({ targets: l, y: Y_TITULO, duration: 260, ease: 'Cubic.easeIn' })
      if (!this.scene.isActive()) return
      tocar(this, 'letraPesada')
      shake(this, 120, 0.012 + i * 0.002)
      particulas(this, l.x, l.y + 40, { cor: ARCO[i % ARCO.length], quantidade: 14, velocidade: 180, vida: 380 })
      this.tweens.add({ targets: l, scaleY: 0.7, scaleX: 1.25, duration: 70, yoyo: true })
      await this.esperar(70)
    }
    tocar(this, 'explosaoGrande')
    flashTela(this, 0xffffff, 0.85, 380)
    shake(this, 420, 0.03)
    this.comecarCaos()
  }

  // ---------- o caos ----------

  comecarCaos() {
    this.pronto = true
    this.digitar(SUBTITULO)
    this.time.addEvent({ delay: BATIDA, loop: true, callback: () => this.batida() })
    this.time.addEvent({ delay: 70, loop: true, callback: () => this.chuva() })
    this.atualizarOpcoes()
    this.tweens.add({ targets: this.painel, alpha: 1, y: 0, duration: 300, ease: 'Back.easeOut' })
  }

  batida() {
    if (this.saindo) return
    const b = ++this.batidas
    this.letras.forEach((l, i) => this.tweens.add({ targets: l, scale: 1.12, duration: 70, yoyo: true, delay: i * 18 }))
    this.lutadores.forEach((f, i) => {
      if ((i + b) % 2) this.tweens.add({ targets: f, y: f.baseY - 16, duration: BATIDA * 0.35, yoyo: true, ease: 'Quad.easeOut' })
    })
    // a cada batida um anel de balas nasce de um ponto sorteado; a cada 4, um lutador dá um mortal
    this.anel(Phaser.Math.Between(60, LARGURA - 60), Phaser.Math.Between(60, ALTURA - 120), b)
    if (b % 4 === 0) {
      const f = Phaser.Utils.Array.GetRandom(this.lutadores)
      this.tweens.add({ targets: f, angle: f.angle + 360, y: f.baseY - 46, duration: BATIDA * 0.9, yoyo: false, ease: 'Sine.easeInOut', onComplete: () => f.setY(f.baseY) })
      particulas(this, f.x, f.baseY - 20, { cor: f.cor, quantidade: 10, velocidade: 140, vida: 360 })
    }
    if (b % 8 === 0) {
      shake(this, 160, 0.008)
      this.glitchar(220)
    }
  }

  anel(x, y, b) {
    const n = 12
    const cor = ARCO[b % ARCO.length]
    const forma = FORMAS[b % FORMAS.length]
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2 + b * 0.3
      this.bala(x, y, Math.cos(ang) * 120, Math.sin(ang) * 120, forma, cor)
    }
  }

  chuva() {
    if (this.saindo) return
    const lado = Phaser.Math.Between(0, 3)
    const v = Phaser.Math.Between(90, 200)
    const forma = Phaser.Utils.Array.GetRandom(FORMAS)
    const cor = Phaser.Utils.Array.GetRandom(ARCO)
    if (lado === 0) this.bala(Phaser.Math.Between(0, LARGURA), -10, Phaser.Math.Between(-30, 30), v, forma, cor)
    else if (lado === 1) this.bala(LARGURA + 10, Phaser.Math.Between(0, ALTURA), -v, Phaser.Math.Between(-30, 30), forma, cor)
    else if (lado === 2) this.bala(-10, Phaser.Math.Between(0, ALTURA), v, Phaser.Math.Between(-30, 30), forma, cor)
    else this.bala(Phaser.Math.Between(0, LARGURA), ALTURA + 10, Phaser.Math.Between(-30, 30), -v, forma, cor)
  }

  bala(x, y, vx, vy, forma, cor) {
    if (this.balas.length >= MAX_BALAS) return
    const img = this.add.image(x, y, forma).setTint(cor).setDepth(1).setAlpha(0.7).setScale(Phaser.Math.FloatBetween(0.9, 1.6))
    this.balas.push({ img, vx, vy, giro: Phaser.Math.FloatBetween(-4, 4) })
  }

  glitchar(ms) {
    this.glitchAte = this.time.now + ms
  }

  digitar(texto) {
    let i = 0
    this.time.addEvent({
      delay: 40,
      repeat: texto.length - 1,
      callback: () => {
        this.sub.setText(texto.slice(0, ++i))
        if (texto[i - 1] !== ' ') tocar(this, 'texto')
      },
    })
  }

  // ---------- lutadores e corações ----------

  montarLutadores() {
    const y = ALTURA - 34
    const passo = (LARGURA - 80) / (PERSONAGENS_PVP.length - 1)
    this.lutadores = PERSONAGENS_PVP.map((id, i) => {
      const x = 40 + i * passo
      const textura = this.textures.exists(id) ? id : 'coracao'
      const f = this.add.image(x, y, textura).setOrigin(0.5, 1).setScale(2.2).setDepth(5)
      this.add.ellipse(x, y, 40, 8, 0x000000, 0.5).setDepth(4)
      f.baseY = y
      f.cor = ARCO[i % ARCO.length]
      return f
    })
  }

  // os dois corações desviam sozinhos pelo meio do caos, deixando rastro
  montarCoracoes() {
    this.coracoes = [0, 1].map((j) => {
      const c = this.add.image(LARGURA * (0.3 + j * 0.4), ALTURA * 0.55, 'coracao').setTint(CORES.almas[j]).setScale(1.6).setDepth(6)
      c.vx = (j ? -1 : 1) * 150
      c.vy = (j ? 1 : -1) * 110
      return c
    })
    this.time.addEvent({
      delay: 45,
      loop: true,
      callback: () => {
        for (const c of this.coracoes) {
          const r = this.add.image(c.x, c.y, 'coracao').setTint(c.tintTopLeft).setScale(1.4).setAlpha(0.45).setDepth(5)
          this.tweens.add({ targets: r, alpha: 0, scale: 0.6, duration: 380, onComplete: () => r.destroy() })
        }
      },
    })
  }

  // ---------- opções ----------

  montarOpcoes() {
    this.painel = this.add.container(0, 20).setDepth(12).setAlpha(0)
    const texto = (y, conteudo, tamanho, cor = TEXTO.normal) =>
      this.add.text(LARGURA / 2, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5)
    this.linhas = OPCOES.map((o, i) => texto(Y_OPCOES + i * 40, o.rotulo, 26))
    this.cursor = this.add.image(0, 0, 'coracao').setTint(CORES.almas[0]).setScale(1.5)
    this.aviso = texto(Y_OPCOES + 86, '', 13, TEXTO.desabilitado)
    this.painel.add([...this.linhas, this.cursor, this.aviso])
  }

  get conectado() {
    return Boolean(this.registry.get('conectado'))
  }

  atualizarOpcoes() {
    const ativo = this.conectado
    this.linhas.forEach((l, i) => {
      l.setColor(i === this.indice && ativo ? TEXTO.selecionado : TEXTO.normal).setAlpha(ativo ? (i === this.indice ? 1 : 0.7) : 0.3)
    })
    this.cursor.setVisible(ativo)
    this.aviso.setText(ativo ? 'cima/baixo: escolher     A: confirmar' : '↑ conecte o joystick ou use o SIMULADOR (TECLADO) aí em cima ↑')
  }

  selecionar(indice) {
    this.indice = (indice + OPCOES.length) % OPCOES.length
    tocar(this, 'mover')
    this.atualizarOpcoes()
    const l = this.linhas[this.indice]
    this.tweens.add({ targets: l, scale: 1.15, duration: 80, yoyo: true })
  }

  confirmar() {
    if (this.saindo || !this.pronto || !this.conectado) return
    this.saindo = true
    const opcao = OPCOES[this.indice].id
    this.registry.set('menuIndice', this.indice)
    if (opcao === 'config') {
      tocar(this, 'confirmar')
      this.cameras.main.fadeOut(220, 0, 0, 0)
      this.time.delayedCall(240, () => this.scene.start('Config', { voltar: 'Menu' }))
      return
    }
    // JOGAR: tudo explode para fora e a tela estoura em branco
    tocar(this, 'superAtivar')
    tocar(this, 'explosaoGrande')
    shake(this, 500, 0.035)
    for (const b of this.balas) {
      const ang = Math.atan2(b.img.y - ALTURA / 2, b.img.x - LARGURA / 2)
      b.vx = Math.cos(ang) * 700
      b.vy = Math.sin(ang) * 700
    }
    this.glitch.flat().forEach((g) => g.setAlpha(0))
    this.tweens.add({ targets: [this.sub, this.painel], alpha: 0, scale: 1.3, duration: 220 })
    this.letras.forEach((l, i) => {
      const lado = i - (this.letras.length - 1) / 2
      this.tweens.add({ targets: l, x: l.x + lado * 260, y: l.y - 120 + Math.abs(lado) * 40, angle: lado * 70, alpha: 0, duration: 480, ease: 'Cubic.easeOut' })
    })
    this.tweens.add({ targets: this.lutadores, y: ALTURA + 120, duration: 420, ease: 'Back.easeIn', delay: this.tweens.stagger(40) })
    particulas(this, LARGURA / 2, Y_TITULO, { cor: 0xffffff, quantidade: 40, velocidade: 320, vida: 600 })
    this.time.delayedCall(340, () => flashTela(this, 0xffffff, 1, 500))
    this.time.delayedCall(520, () => this.cameras.main.fadeOut(220, 255, 255, 255))
    this.time.delayedCall(760, () => this.scene.start('Modo'))
  }

  // ---------- quadro a quadro ----------

  update(time, delta) {
    this.controles.atualizar()
    if (this.pronto && !this.saindo && this.conectado) {
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const d = this.controles.toque(j)
        if (d === 'cima' || d === 'esquerda') this.selecionar(this.indice - 1)
        if (d === 'baixo' || d === 'direita') this.selecionar(this.indice + 1)
      }
    }
    this.fundo.atualizar(delta)
    const s = delta / 1000

    // balas do caos
    this.balas = this.balas.filter((b) => {
      b.img.x += b.vx * s
      b.img.y += b.vy * s
      b.img.rotation += b.giro * s
      const fora = b.img.x < -40 || b.img.x > LARGURA + 40 || b.img.y < -40 || b.img.y > ALTURA + 40
      if (fora) b.img.destroy()
      return !fora
    })

    // corações quicando nas bordas (como protetor de tela), desviando um pouco das balas perto
    for (const c of this.coracoes) {
      for (const b of this.balas) {
        const dx = c.x - b.img.x
        const dy = c.y - b.img.y
        const d2 = dx * dx + dy * dy
        if (d2 < 900 && d2 > 1) {
          c.vx += (dx / Math.sqrt(d2)) * 40
          c.vy += (dy / Math.sqrt(d2)) * 40
        }
      }
      const v = Math.hypot(c.vx, c.vy)
      if (v > 230) {
        c.vx *= 230 / v
        c.vy *= 230 / v
      }
      c.x += c.vx * s
      c.y += c.vy * s
      if (c.x < 20 || c.x > LARGURA - 20) c.vx *= -1
      if (c.y < 20 || c.y > ALTURA - 90) c.vy *= -1
      c.x = Phaser.Math.Clamp(c.x, 20, LARGURA - 20)
      c.y = Phaser.Math.Clamp(c.y, 20, ALTURA - 90)
    }

    // título: balanço, cor girando no arco-íris e glitch de vez em quando
    const glitchando = this.time.now < (this.glitchAte ?? 0) || (this.pronto && Math.random() < 0.004)
    if (glitchando && !this.glitchAte) this.glitchar(120)
    this.letras.forEach((l, i) => {
      if (this.saindo) return
      if (this.pronto) {
        l.x = l.baseX + (glitchando ? Phaser.Math.Between(-6, 6) : 0)
        l.setAngle(Math.sin(time / 300 + i) * 4)
        const cor = Phaser.Display.Color.HSVToRGB(((time / 2400 + i * 0.12) % 1 + 1) % 1, 0.55, 1)
        l.setStroke(Phaser.Display.Color.RGBToString(cor.r * 0.35, cor.g * 0.35, cor.b * 0.35), 12)
        l.setTint(Phaser.Display.Color.GetColor(cor.r, cor.g, cor.b), 0xffffff, Phaser.Display.Color.GetColor(cor.r, cor.g, cor.b), 0xffffff)
      }
      this.glitch.forEach((copias, k) => {
        const g = copias[i]
        g.setPosition(l.x + (k ? 1 : -1) * (glitchando ? Phaser.Math.Between(4, 10) : 2), l.y + (glitchando ? Phaser.Math.Between(-3, 3) : 0))
        g.setAngle(l.angle).setScale(l.scaleX, l.scaleY).setAlpha(this.saindo ? 0 : glitchando ? 0.9 : this.pronto ? 0.35 : 0)
      })
    })
    if (this.time.now >= (this.glitchAte ?? 0)) this.glitchAte = 0

    const l = this.linhas[this.indice]
    this.cursor.setPosition(l.x - l.width / 2 - 24, l.y + Math.sin(time / 180) * 2)
  }

  tween(config) {
    return new Promise((resolver) => this.tweens.add({ ...config, onComplete: resolver }))
  }

  esperar(ms) {
    return new Promise((resolver) => this.time.delayedCall(ms, resolver))
  }
}
