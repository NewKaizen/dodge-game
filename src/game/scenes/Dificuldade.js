import Phaser from 'phaser'
import Controles from '../controles.js'
import { CHEFES } from '../data/chefes/index.js'
import { criarFundo } from '../backgrounds/index.js'
import { ESCALA } from '../arte/texturas.js'
import { tocar, musica } from '../audio.js'
import { CORES, DIFICULDADES, NIVEIS, ORDEM_NIVEIS, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'

const OPCAO = { x: 440, largura: 330, altura: 100, y: 128, passo: 112 }

// Tela do nível da luta, depois de escolher o chefe (Selecao -> Dificuldade -> Battle).
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
    const def = CHEFES[this.idChefe]
    const base = DIFICULDADES[def.dificuldade]
    const texto = (x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) =>
      this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra }).setOrigin(0.5)

    this.fundo = criarFundo(this, def.fundo)
    this.fundo.escurecer(true)

    texto(LARGURA / 2, 36, 'ESCOLHA O NÍVEL', 28, TEXTO.normal, { strokeThickness: 4 })

    // chefe escolhido, à esquerda
    const cx = 138
    this.add.rectangle(cx, 240, 200, 290, CORES.painel, 0.88).setStrokeStyle(3, 0x505050)
    this.sprite = this.add.image(cx, 200, def.sprite).setScale(ESCALA.chefe * 0.9)
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
        .text(esquerda, y - OPCAO.altura / 2 + 36, this.descrever(nivel, def).join('\n'), {
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
    musica(this, 'selecao')
    this.cameras.main.fadeIn(250)
  }

  // Linhas do que o nível muda para este chefe
  descrever(nivel, def) {
    if (!nivel.caos) return ['O chefe como ele é.', 'Nada muda: ritmo, dano e HP normais.']
    const mais = (f) => `+${Math.round((f - 1) * 100)}%`
    const caos = nivel.caos.chance >= 1 ? 'em TODO turno' : `em ${Math.round(nivel.caos.chance * 100)}% dos turnos`
    return [
      `Balas ${mais(nivel.velocidade)} rápidas, ${mais(nivel.densidade)} frequentes`,
      `Dano ${mais(nivel.dano)}   HP do chefe ${Math.round(def.hp * nivel.hp)} (${mais(nivel.hp)})`,
      `CAOS: tiros extras ${caos}`,
    ]
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
    tocar(this, 'confirmar')
    this.cameras.main.flash(200, 255, 255, 255)
    if (NIVEIS[nivel].tremor) this.cameras.main.shake(250, NIVEIS[nivel].tremor)
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.time.delayedCall(320, () => this.scene.start('Battle', { chefe: this.idChefe, nivel }))
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
    this.fundo.atualizar(delta)
    const o = this.opcoes[this.indice]
    this.cursor.setPosition(OPCAO.x - OPCAO.largura / 2 - 20 + Math.sin(time / 200) * 3, o.y)
    // quanto mais difícil, mais o chefe treme
    const tremor = this.indice * 1.2
    this.sprite.setPosition(138 + (tremor ? Math.sin(time / 37) * tremor : 0), 200 + (tremor ? Math.cos(time / 53) * tremor : 0))
  }
}
