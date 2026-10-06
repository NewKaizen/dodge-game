import Phaser from 'phaser'
import Controles from '../controles.js'
import { CHEFES } from '../coop/chefes/index.js'
import { criarFundo } from '../backgrounds/index.js'
import { ESCALA } from '../arte/texturas.js'
import { tocar, musica, pararMusica } from '../audio.js'
import { rachadura, estilhacos, faixasDiagonais, corNumero } from '../effects/entrada.js'
import { CORES, DIFICULDADES, NIVEIS, ORDEM_NIVEIS, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'

const OPCAO = { x: 440, largura: 330, altura: 100, y: 128, passo: 112 }
const CHEFE = { x: 138, y: 200 }

// Transição de entrada na batalha (ms desde o A). Cada nível soma `porNivel`
// ao clímax: DIFÍCIL segura a tensão um pouco mais e explode mais forte.
const ENTRADA = { climax: 900, porNivel: 100, depois: 360 }

// Tela do nível da luta, depois de escolher o chefe (Selecao -> Dificuldade -> CoopArena).
// FÁCIL é o chefe como ele é; MÉDIO e DIFÍCIL só apertam (números em NIVEIS).
// A: lutar · B: voltar para a escolha do chefe
export default class Dificuldade extends Phaser.Scene {
  constructor() {
    super('Dificuldade')
  }

  init(dados) {
    this.idChefe = dados?.chefe ?? this.registry.get('chefe') ?? 'king'
  }

  create() {
    this.registry.set('chefe', this.idChefe)
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => (botao === 'A' ? this.confirmar() : this.voltar()))
    this.saindo = false
    this.entrada = null // transição para a batalha em andamento
    this.congelado = false
    const def = CHEFES[this.idChefe]
    const base = DIFICULDADES[def.dificuldade]
    const texto = (x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) =>
      this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra }).setOrigin(0.5)

    this.fundo = criarFundo(this, def.fundo)
    this.fundo.escurecer()

    texto(LARGURA / 2, 36, 'ESCOLHA O NÍVEL', 28, TEXTO.normal, { strokeThickness: 4 })

    // chefe escolhido, à esquerda
    const cx = CHEFE.x
    this.add.rectangle(cx, 240, 200, 290, CORES.painel, 0.88).setStrokeStyle(3, 0x505050)
    this.sprite = this.add.image(cx, CHEFE.y, def.sprite).setScale(ESCALA.chefe * 0.9)
    texto(cx, 310, def.nome.toUpperCase(), def.nome.length > 11 ? 16 : 20)
    texto(cx, 336, `base: ${base.rotulo}`, 14, base.cor)
    const maxEstrelas = Math.max(...Object.values(DIFICULDADES).map((d) => d.estrelas))
    for (let k = 0; k < maxEstrelas; k++) {
      this.add.image(cx + (k - (maxEstrelas - 1) / 2) * 20, 360, 'coracao').setTint(k < base.estrelas ? parseInt(base.cor.slice(1), 16) : 0x303030)
    }

    // opções, à direita
    this.opcoes = ORDEM_NIVEIS.map((id, i) => {
      const nivel = NIVEIS[id]
      const y = OPCAO.y + i * OPCAO.passo
      const esquerda = OPCAO.x - OPCAO.largura / 2 + 14
      const moldura = this.add.rectangle(OPCAO.x, y, OPCAO.largura, OPCAO.altura, CORES.painel, 0.88).setStrokeStyle(3, 0x505050)
      const rotulo = this.add
        .text(esquerda, y - OPCAO.altura / 2 + 8, nivel.rotulo, { fontFamily: FONTE, fontSize: '22px', color: nivel.cor, stroke: '#000000', strokeThickness: 3 })
        .setOrigin(0, 0)
      const detalhes = this.add
        .text(esquerda, y - OPCAO.altura / 2 + 36, this.descrever(nivel).join('\n'), {
          fontFamily: FONTE,
          fontSize: '14px',
          color: TEXTO.normal,
          lineSpacing: 2,
        })
        .setOrigin(0, 0)
      return { moldura, rotulo, detalhes, y }
    })

    this.cursor = this.add.image(0, 0, 'coracao').setTint(CORES.almas[0]).setScale(1.8)
    texto(LARGURA / 2, ALTURA - 30, '↑ ↓ escolher     A: lutar     B: voltar', 14, TEXTO.desabilitado, { strokeThickness: 0 })

    const ultimo = ORDEM_NIVEIS.indexOf(this.registry.get('nivel'))
    this.selecionar(Math.max(0, ultimo), false)
    musica('selecao')
    this.cameras.main.fadeIn(250)
  }

  // Linhas do que o nível muda para este chefe (HP do modo cartas)
  descrever(nivel) {
    const hp = Math.round(CHEFES[this.idChefe].hp * nivel.hp)
    if (nivel.dano === 1) return ['O chefe como ele é.', `Ritmo e dano normais. HP do chefe ${hp}.`]
    const mais = (f) => `+${Math.round((f - 1) * 100)}%`
    return [`Balas ${mais(nivel.velocidade)} rápidas, ${mais(nivel.densidade)} frequentes`, `Dano ${mais(nivel.dano)}   HP do chefe ${hp} (${mais(nivel.hp)})`]
  }

  selecionar(indice, comSom = true) {
    const total = ORDEM_NIVEIS.length
    this.indice = (indice + total) % total
    if (comSom) tocar(this, 'mover')
    const nivel = NIVEIS[ORDEM_NIVEIS[this.indice]]
    this.opcoes.forEach((o, k) => {
      const selecionada = k === this.indice
      o.moldura.setStrokeStyle(3, selecionada ? CORES.selecionado : 0x505050)
      o.rotulo.setAlpha(selecionada ? 1 : 0.5)
      o.detalhes.setAlpha(selecionada ? 1 : 0.45)
    })
    // prévia: o fundo fica mais agitado e o chefe mais inquieto
    this.fundo.estado.agito = nivel.fundo
    this.tweens.add({ targets: this.sprite, scale: ESCALA.chefe * (0.9 + this.indice * 0.06), duration: 150 })
  }

  confirmar() {
    if (this.saindo) return
    this.saindo = true
    const nivel = ORDEM_NIVEIS[this.indice]
    this.registry.set('nivel', nivel)
    this.entrar(nivel)
  }

  // "Agora é pra valer": a música corta, a tela congela, o chefe avança
  // tremendo, o vidro trinca, faixas da cor do nível correm, e tudo estoura.
  // A CoopArena começa por baixo da cena Entrada, que abre a tela ao meio.
  entrar(nivel) {
    const k = this.indice // 0 FÁCIL, 1 MÉDIO, 2 DIFÍCIL
    const cor = corNumero(NIVEIS[nivel].cor)
    const climax = ENTRADA.climax + k * ENTRADA.porNivel
    const camera = this.cameras.main
    const topo = 50 // profundidade acima de toda a interface

    // corte seco: música para, flash branco e o fundo congela
    pararMusica()
    tocar(this, 'confirmar')
    tocar(this, 'tensao')
    this.fundo.estado.agito = 0
    this.congelado = true
    camera.flash(90, 255, 255, 255)
    this.cursor.setVisible(false)

    // escurece a interface; o chefe e o nível escolhido ficam por cima
    const veu = this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000, 1).setOrigin(0).setDepth(topo).setAlpha(0)
    this.tweens.add({ targets: veu, alpha: 0.86, duration: 260, ease: 'Quad.easeOut' })
    const faixas = faixasDiagonais(this, cor, topo + 1)
    this.sprite.setDepth(topo + 3)

    // o chefe avança para o centro, cresce e treme cada vez mais
    this.entrada = { inicio: this.time.now, climax, k, faixas, x: CHEFE.x, y: CHEFE.y, tremor: 1 }
    this.tweens.add({
      targets: this.entrada,
      x: LARGURA / 2,
      y: ALTURA / 2 + 10,
      tremor: 3 + k * 3,
      duration: climax,
      ease: 'Quad.easeIn',
    })
    this.tweens.add({ targets: this.sprite, scale: ESCALA.chefe * (2 + k * 0.35), duration: climax, ease: 'Cubic.easeIn' })

    // carimbo com o nome do nível, batendo no meio da tensão
    const rotulo = this.add
      .text(LARGURA / 2, 70, NIVEIS[nivel].rotulo, {
        fontFamily: FONTE,
        fontSize: '52px',
        color: NIVEIS[nivel].cor,
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(topo + 4)
      .setAlpha(0)
      .setScale(3)
      .setAngle(-6)
    this.time.delayedCall(climax * 0.35, () => {
      this.tweens.add({ targets: rotulo, alpha: 1, scale: 1, duration: 110, ease: 'Back.easeOut' })
      camera.shake(120, 0.004 + k * 0.002)
    })

    // o vidro da tela trinca em batidas: mais trincas no nível mais alto
    const trincas = 2 + k * 2
    for (let i = 0; i < trincas; i++) {
      const quando = climax * (0.25 + (0.65 * i) / trincas)
      this.time.delayedCall(quando, () => {
        const x = Phaser.Math.Between(60, LARGURA - 60)
        const y = Phaser.Math.Between(60, ALTURA - 60)
        rachadura(this, x, y, { tamanho: 120 + i * 30 + k * 30, galhos: 1 + k, profundidade: topo + 3.5 })
        tocar(this, 'rachar')
        camera.shake(90, 0.003 + k * 0.002)
        const lampejo = this.add.rectangle(0, 0, LARGURA, ALTURA, cor, 0.25).setOrigin(0).setDepth(topo + 2)
        this.tweens.add({ targets: lampejo, alpha: 0, duration: 120, onComplete: () => lampejo.destroy() })
      })
    }

    // clímax: estouro, tela estilhaça e apaga
    this.time.delayedCall(climax, () => {
      tocar(this, 'impacto')
      camera.flash(160 + k * 60, 255, 255, 255)
      camera.shake(300 + k * 80, 0.012 + k * 0.008)
      // com folga nas bordas: o tremor da câmera não mostra o que está por trás
      const negro = this.add.rectangle(LARGURA / 2, ALTURA / 2, LARGURA + 200, ALTURA + 200, 0x000000, 1).setDepth(topo + 5)
      const onda = this.add.circle(LARGURA / 2, ALTURA / 2, 20).setStrokeStyle(10, cor).setDepth(topo + 7)
      this.tweens.add({ targets: onda, scale: 18, alpha: 0, duration: 340, ease: 'Cubic.easeOut' })
      estilhacos(this, LARGURA / 2, ALTURA / 2, { quantidade: 26 + k * 16, cores: [cor, 0xffffff, cor, 0x303030], profundidade: topo + 6, duracao: ENTRADA.depois + 60 })
      this.sprite.setDepth(topo + 6)
      this.tweens.add({ targets: this.sprite, scale: this.sprite.scale * 1.6, alpha: 0, duration: 220, ease: 'Quad.easeOut' })
      rotulo.setDepth(topo + 6)
      this.tweens.add({ targets: rotulo, scale: 1.5, alpha: 0, duration: 260 })
      faixas.objeto.setVisible(false)
    })

    this.time.delayedCall(climax + ENTRADA.depois, () => {
      this.scene.start('CoopArena', { chefe: this.idChefe, nivel })
      this.scene.launch('Entrada', { nivel })
    })
  }

  voltar() {
    if (this.saindo) return
    this.saindo = true
    tocar(this, 'mover')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start('Selecao'))
  }

  update(time, delta) {
    this.controles.atualizar()
    if (!this.saindo) {
      const n = this.controles.numJogadores
      for (let j = 0; j < n; j++) {
        const direcao = this.controles.toque(j)
        if (direcao === 'esquerda' || direcao === 'cima') this.selecionar(this.indice - 1)
        if (direcao === 'direita' || direcao === 'baixo') this.selecionar(this.indice + 1)
      }
    }
    if (!this.congelado) this.fundo.atualizar(delta)
    if (this.entrada) return this.atualizarEntrada(time)
    const o = this.opcoes[this.indice]
    this.cursor.setPosition(OPCAO.x - OPCAO.largura / 2 - 20 + Math.sin(time / 200) * 3, o.y)
    // quanto mais difícil, mais o chefe treme
    const tremor = this.indice * 1.2
    this.sprite.setPosition(CHEFE.x + (tremor ? Math.sin(time / 37) * tremor : 0), CHEFE.y + (tremor ? Math.cos(time / 53) * tremor : 0))
  }

  // durante a transição: chefe tremendo no caminho e faixas acelerando
  atualizarEntrada(time) {
    const e = this.entrada
    const ms = time - e.inicio
    const t = Math.min(1, ms / e.climax)
    e.faixas.desenhar(ms, Math.max(0, (t - 0.12) / 0.88) * (0.6 + e.k * 0.2))
    const r = e.tremor
    this.sprite.setPosition(e.x + Phaser.Math.FloatBetween(-r, r), e.y + Phaser.Math.FloatBetween(-r, r))
  }
}
