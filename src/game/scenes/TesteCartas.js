import Phaser from 'phaser'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO, corTexto } from '../constants.js'
import Controles from '../controles.js'
import { tocar } from '../audio.js'
import Carta, { CORES_CARTA } from '../entities/Carta.js'
import Mao from '../entities/Mao.js'

// Cena de teste das cartas (visual e animações do PvP de cartas).
// No dev: debugJogo.jogo.scene.start('TesteCartas')
//
//   esquerda/direita  escolher carta        A  confirmar (vira para baixo)
//   B                 desfaz a confirmação; sem nada confirmado, troca o layout
//                     (P1 e P2 lado a lado  <->  P1 embaixo e P2 em cima)
// Quando os dois confirmam: as cartas vão ao centro, revelam juntas e são
// arremessadas no adversário; depois cada um compra uma carta nova.
// Com 1 jogador no painel, o P1 controla as duas mãos (primeiro a do P1, depois a do P2).

// Cartas de exemplo (nomes e efeitos só para o teste; as regras vêm de outro módulo)
const BARALHOS = [
  [
    { id: 'k-ae', personagem: 'kris', naipe: 'espadas', valor: 1, nome: 'Lâmina Lunar', descricao: 'Especial: um leque de lâminas varre a arena de ponta a ponta.', custo: 4 },
    { id: 'k-7c', personagem: 'kris', naipe: 'copas', valor: 7, nome: 'Abraço Quente', descricao: 'Cura um pouco de HP e dá um escudo curto.', custo: 2 },
    { id: 'k-jo', personagem: 'kris', naipe: 'ouros', valor: 11, nome: 'Valete Ventania', descricao: 'Empurra as balas do adversário para as bordas da caixa.', custo: 3 },
    { id: 'k-qp', personagem: 'kris', naipe: 'paus', valor: 12, nome: 'Rainha das Vinhas', descricao: 'Raízes brotam do chão e prendem quem passar por cima.', custo: 4 },
    { id: 'k-ke', personagem: 'kris', naipe: 'espadas', valor: 13, nome: 'Rei Trovão', descricao: 'Raios caem em colunas, um depois do outro, cada vez mais rápido.', custo: 6 },
    { id: 'k-2o', personagem: 'kris', naipe: 'ouros', valor: 2, nome: 'Faísca Curta', descricao: 'Duas balinhas que mudam de direção no meio do caminho.', custo: 1 },
    { id: 'k-10p', personagem: 'kris', naipe: 'paus', valor: 10, nome: 'Campo Minado', descricao: 'Minas escondidas piscam antes de explodir.', custo: 3 },
    { id: 'k-5c', personagem: 'kris', naipe: 'copas', valor: 5, nome: 'Chá de Ervas', descricao: 'Recupera HP aos poucos durante o próximo turno.', custo: 1 },
    { id: 'k-9e', personagem: 'kris', naipe: 'espadas', valor: 9, nome: 'Chuva de Facas', descricao: 'Facas caem do alto em fileiras com uma brecha.', custo: 3 },
  ],
  [
    { id: 's-kc', personagem: 'susie', naipe: 'copas', valor: 13, nome: 'Rei Coração', descricao: 'Cura todo mundo e devolve 1 de energia.', custo: 4 },
    { id: 's-10p', personagem: 'susie', naipe: 'paus', valor: 10, nome: 'Armadilha de Urso', descricao: 'Mandíbulas se fecham onde o coração parar.', custo: 3 },
    { id: 's-2o', personagem: 'susie', naipe: 'ouros', valor: 2, nome: 'Faísca', descricao: 'Uma bala pequena que persegue o coração.', custo: 1 },
    { id: 's-7e', personagem: 'susie', naipe: 'espadas', valor: 7, nome: 'Machadada', descricao: 'Três golpes em leque, do alto para baixo.', custo: 2 },
    { id: 's-ac', personagem: 'susie', naipe: 'copas', valor: 1, nome: 'Coração Valente', descricao: 'Especial: uma onda de luz cura e protege por um turno.', custo: 4 },
    { id: 's-qo', personagem: 'susie', naipe: 'ouros', valor: 12, nome: 'Rainha Espelho', descricao: 'Inverte os controles do adversário por um instante.', custo: 3 },
    { id: 's-je', personagem: 'susie', naipe: 'espadas', valor: 11, nome: 'Valete Fúria', descricao: 'Investida rápida de um lado ao outro da caixa.', custo: 3 },
    { id: 's-8p', personagem: 'susie', naipe: 'paus', valor: 8, nome: 'Areia Movediça', descricao: 'O chão puxa o coração para o centro.', custo: 2 },
    { id: 's-4c', personagem: 'susie', naipe: 'copas', valor: 4, nome: 'Lanche', descricao: 'Cura 10 de HP na hora.', custo: 1 },
  ],
]
const ENERGIA = [5, 4]

// Dois arranjos de mesa (B troca)
const LAYOUTS = {
  lateral: {
    maos: [
      { x: 142, y: 424, angulo: 0, monte: { x: 298, y: 432 } },
      { x: 498, y: 424, angulo: 0, monte: { x: 342, y: 432 } },
    ],
    larguraMax: 168,
    previas: [
      { x: 150, y: 150, escala: 1.75 },
      { x: 490, y: 150, escala: 1.75 },
    ],
    centro: [
      { x: 250, y: 190 },
      { x: 390, y: 190 },
    ],
    alvos: [
      { x: 46, y: 300 },
      { x: 594, y: 300 },
    ],
    status: { x: 320, y: 300 },
  },
  vertical: {
    maos: [
      { x: 320, y: 424, angulo: 0, monte: { x: 548, y: 430 } },
      { x: 320, y: 62, angulo: Math.PI, monte: { x: 92, y: 56 } },
    ],
    larguraMax: 200,
    previas: [
      { x: 84, y: 244, escala: 1.4 },
      { x: 556, y: 226, escala: 1.4 },
    ],
    centro: [
      { x: 255, y: 240 },
      { x: 385, y: 240 },
    ],
    alvos: [
      { x: 460, y: 330 },
      { x: 180, y: 150 },
    ],
    status: { x: 320, y: 240 },
  },
}

const AJUDA = ['TESTE DE CARTAS', '←/→ escolher', 'A confirmar', 'B cancelar / trocar layout']

const esperar = (cena, ms) => new Promise((r) => cena.time.delayedCall(ms, r))

export default class TesteCartas extends Phaser.Scene {
  constructor() {
    super('TesteCartas')
  }

  create() {
    this.controles = new Controles(this)
    this.numJogadores = this.controles.numJogadores
    this.estado = 'comprando'
    this.confirmado = [false, false]
    this.pilhas = BARALHOS.map((b) => b.map((c) => ({ ...c })))
    this.contagem = 0 // ids novos para cartas recicladas
    this.previas = [null, null]
    this.montes = [[], []]
    this.nomeLayout = 'lateral'

    this.fundo = this.add.graphics().setDepth(-10)
    this.ajuda = this.add
      .text(LARGURA / 2, 6, '', {
        fontFamily: FONTE,
        fontSize: '10px',
        color: TEXTO.desabilitado,
      })
      .setOrigin(0.5, 0)
      .setDepth(100)
    this.status = this.add
      .text(0, 0, '', { fontFamily: FONTE, fontSize: '14px', color: TEXTO.selecionado, stroke: '#000000', strokeThickness: 3, align: 'center' })
      .setOrigin(0.5)
      .setDepth(100)

    this.marcadores = [0, 1].map((j) => this.criarMarcador(j))
    this.maos = [0, 1].map((j) => new Mao(this, { jogador: j, profundidade: 20 }))
    this.aplicarLayout(false)

    this.controles.onBotao((j, botao) => (botao === 'A' ? this.apertarA(j) : this.apertarB(j)))
    this.iniciar()
  }

  async iniciar() {
    await Promise.all(this.maos.map((m, j) => m.comprarVarias(this.pilhas[j].splice(0, 5), { intervalo: 120 })))
    this.maos.forEach((m, j) => m.setEnergia(ENERGIA[j]))
    this.estado = 'escolhendo'
    this.atualizarAtivas()
  }

  // ---------- mesa ----------

  aplicarLayout(animado = true) {
    const L = LAYOUTS[this.nomeLayout]
    this.desenharFundo()
    this.maos.forEach((m, j) => {
      m.larguraMax = L.larguraMax
      m.setPosicao({ ...L.maos[j] })
      if (!animado) m.layout(false)
    })
    this.marcadores.forEach((mk, j) => mk.setPosition(L.alvos[j].x, L.alvos[j].y))
    this.status.setPosition(L.status.x, L.status.y)
    // no vertical o topo é da mão do P2: a ajuda vai para o canto de baixo
    if (this.nomeLayout === 'lateral') this.ajuda.setText(AJUDA.join('   ')).setPosition(LARGURA / 2, 6).setOrigin(0.5, 0).setAlign('center')
    else this.ajuda.setText(['TESTE DE CARTAS', `${AJUDA[1]}   ${AJUDA[2]}`, AJUDA[3]].join('\n')).setPosition(18, ALTURA - 12).setOrigin(0, 1).setAlign('left')
    this.montes.forEach((pilha, j) => {
      pilha.forEach((c) => c.destroy())
      const { monte, angulo } = L.maos[j]
      this.montes[j] = [0, 1, 2].map((k) =>
        new Carta(this, monte.x - k * 1.5, monte.y - k * 2, { personagem: j ? 'susie' : 'kris', naipe: 'espadas', valor: 2 }, { virada: true })
          .setScale(0.8)
          .setRotation(angulo)
          .setDepth(5 + k),
      )
    })
    this.previas.forEach((p, j) => this.atualizarPrevia(j, true))
  }

  desenharFundo() {
    const g = this.fundo
    g.clear()
    g.fillStyle(0x0d0a16, 1)
    g.fillRect(0, 0, LARGURA, ALTURA)
    // feltro da mesa com losangos bem apagados
    g.fillStyle(0x1a1430, 1)
    g.fillRoundedRect(10, 22, LARGURA - 20, ALTURA - 30, 18)
    g.lineStyle(2, 0x3a2d5a, 1)
    g.strokeRoundedRect(10, 22, LARGURA - 20, ALTURA - 30, 18)
    g.fillStyle(0x241c40, 1)
    for (let y = 40; y < ALTURA - 20; y += 28) {
      for (let x = 30 + ((y / 28) % 2) * 14; x < LARGURA - 20; x += 28) {
        g.fillPoints([{ x, y: y - 4 }, { x: x + 3, y }, { x, y: y + 4 }, { x: x - 3, y }], true)
      }
    }
    g.lineStyle(1, 0x3a2d5a, 0.8)
    if (this.nomeLayout === 'lateral') {
      for (let y = 40; y < 360; y += 12) g.lineBetween(LARGURA / 2, y, LARGURA / 2, y + 6)
    } else {
      for (let x = 30; x < LARGURA - 30; x += 12) g.lineBetween(x, ALTURA / 2, x + 6, ALTURA / 2)
    }
  }

  // alvo de cada jogador: coração + energia (as cartas do adversário voam até aqui)
  criarMarcador(j) {
    const cor = CORES.almas[j]
    const c = this.add.container(0, 0).setDepth(70)
    const halo = this.add.image(0, 0, 'brilho').setTint(cor).setAlpha(0.35).setScale(1.1).setBlendMode(Phaser.BlendModes.ADD)
    const coracao = this.add.image(0, 0, 'coracao').setTint(cor).setScale(2)
    const rotulo = this.add.text(0, -26, `P${j + 1}`, { fontFamily: FONTE, fontSize: '12px', color: corTexto(cor), stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
    const energia = this.add.graphics()
    for (let i = 0; i < ENERGIA[j]; i++) {
      const x = (i - (ENERGIA[j] - 1) / 2) * 9
      const y = 24
      energia.fillStyle(CORES_CARTA.gemaEscura, 1)
      energia.fillPoints([{ x, y: y - 5 }, { x: x + 4.3, y }, { x, y: y + 5 }, { x: x - 4.3, y }], true)
      energia.fillStyle(CORES_CARTA.gema, 1)
      energia.fillPoints([{ x, y: y - 3.8 }, { x: x + 3.2, y }, { x, y: y + 3.8 }, { x: x - 3.2, y }], true)
    }
    const texto = this.add.text(0, 34, 'energia', { fontFamily: FONTE, fontSize: '9px', color: TEXTO.desabilitado }).setOrigin(0.5, 0)
    c.add([halo, coracao, rotulo, energia, texto])
    c.coracao = coracao
    this.tweens.add({ targets: halo, scale: 1.3, alpha: 0.2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    return c
  }

  // marcador tomou a carta
  acertarMarcador(j) {
    const mk = this.marcadores[j]
    mk.coracao.setTint(0xffffff)
    this.time.delayedCall(120, () => mk.coracao.setTint(CORES.almas[j]))
    this.tweens.add({ targets: mk, scale: 1.35, duration: 90, yoyo: true, ease: 'Quad.easeOut' })
  }

  // ---------- prévia ampliada da carta sob o cursor ----------

  atualizarPrevia(j, forcar = false) {
    const mao = this.maos[j]
    const carta = mao.selecionada
    const mostrar = this.estado === 'escolhendo' && carta && !this.confirmado[j] && mao.ativa
    const id = mostrar ? carta.dados.id : null
    if (!forcar && this.previas[j]?.dados.id === id) return
    this.previas[j]?.destroy()
    this.previas[j] = null
    if (!mostrar) return
    const p = LAYOUTS[this.nomeLayout].previas[j]
    const previa = new Carta(this, p.x, p.y, carta.dados, { ampliada: p.escala, corFoco: CORES.almas[j] }).setDepth(60)
    if (carta.indisponivel) previa.setIndisponivel(true)
    previa.setScale(p.escala * 0.85).setAlpha(0.4)
    this.tweens.add({ targets: previa, scaleX: p.escala, scaleY: p.escala, alpha: 1, duration: 160, ease: 'Back.easeOut' })
    this.previas[j] = previa
  }

  // ---------- controle ----------

  // qual mão o jogador j comanda agora
  maoDoControle(j) {
    if (this.numJogadores > 1) return j
    return this.confirmado[0] ? 1 : 0
  }

  atualizarAtivas() {
    const escolhendo = this.estado === 'escolhendo'
    this.maos.forEach((m, j) => {
      const ativa = escolhendo && !this.confirmado[j] && (this.numJogadores > 1 || this.maoDoControle(0) === j)
      m.setAtiva(ativa)
      m.setTravada(this.confirmado[j])
      this.atualizarPrevia(j)
    })
    if (!escolhendo) return
    const falta = [0, 1].filter((j) => !this.confirmado[j]).map((j) => `P${j + 1}`)
    this.status.setText(falta.length ? `${falta.join(' e ')}: escolha uma carta` : '')
  }

  update() {
    this.controles.atualizar()
    if (this.estado !== 'escolhendo') return
    for (let j = 0; j < this.numJogadores; j++) {
      const direcao = this.controles.toque(j)
      if (direcao !== 'esquerda' && direcao !== 'direita') continue
      const m = this.maoDoControle(j)
      if (this.confirmado[m]) continue
      this.maos[m].mover(direcao === 'direita' ? 1 : -1)
      this.atualizarPrevia(m)
    }
  }

  apertarA(j) {
    if (this.estado !== 'escolhendo') return
    const m = this.maoDoControle(j)
    if (this.confirmado[m]) return
    const carta = this.maos[m].selecionada
    if (!carta) return
    if (carta.indisponivel) {
      carta.negar()
      this.previas[m]?.negar()
      return
    }
    carta.confirmar()
    this.confirmado[m] = true
    this.atualizarAtivas()
    if (this.confirmado.every(Boolean)) this.rodada()
  }

  apertarB(j) {
    if (this.estado !== 'escolhendo') return
    // 1 jogador: desfaz a última confirmação (a do P1, já que a do P2 dispara a rodada)
    const m = this.numJogadores > 1 ? j : 0
    if (this.confirmado[m]) {
      tocar(this, 'cancelar')
      this.confirmado[m] = false
      this.maos[m].selecionada?.virar(true)
      this.atualizarAtivas()
      return
    }
    if (this.confirmado.some(Boolean)) return
    tocar(this, 'mover')
    this.nomeLayout = this.nomeLayout === 'lateral' ? 'vertical' : 'lateral'
    this.aplicarLayout(true)
  }

  // ---------- revelação e arremesso ----------

  async rodada() {
    this.estado = 'revelando'
    this.atualizarAtivas()
    this.status.setText('')
    const L = LAYOUTS[this.nomeLayout]
    const cartas = this.maos.map((m) => {
      const carta = m.selecionada
      carta.focar(false)
      m.retirar(carta)
      m.setTravada(false)
      carta.setDepth(80)
      return carta
    })
    await esperar(this, 120)
    // as duas vão para o centro, ainda viradas
    await Promise.all(
      cartas.map(
        (c, j) =>
          new Promise((r) =>
            this.tweens.add({ targets: c, x: L.centro[j].x, y: L.centro[j].y, rotation: 0, scaleX: 1.5, scaleY: 1.5, duration: 320, ease: 'Cubic.easeOut', onComplete: r }),
          ),
      ),
    )
    this.status.setText('REVELAR!').setPosition(LARGURA / 2, L.centro[0].y - 100)
    this.tweens.add({ targets: this.status, scale: { from: 1.6, to: 1 }, duration: 220, ease: 'Back.easeOut' })
    await esperar(this, 260)
    await Promise.all(cartas.map((c) => c.revelar()))
    await esperar(this, 750)
    this.status.setText('')
    // cada carta voa no adversário (a do P2 sai um pouco depois)
    await Promise.all(
      cartas.map(async (c, j) => {
        await esperar(this, j * 140)
        const outro = 1 - j
        return c.arremessar(L.alvos[outro], { aoImpacto: () => this.acertarMarcador(outro) })
      }),
    )
    await esperar(this, 380)
    await Promise.all(this.maos.map((m, j) => m.adicionar(this.proximaCarta(j))))
    this.confirmado = [false, false]
    this.status.setPosition(L.status.x, L.status.y)
    this.estado = 'escolhendo'
    this.atualizarAtivas()
  }

  // tira do monte; quando acaba, recicla o baralho de exemplo
  proximaCarta(j) {
    if (!this.pilhas[j].length) this.pilhas[j] = BARALHOS[j].map((c) => ({ ...c, id: `${c.id}-${++this.contagem}` }))
    return this.pilhas[j].shift()
  }
}
