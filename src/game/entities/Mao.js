import Phaser from 'phaser'
import { CORES, FONTE, corTexto } from '../constants.js'
import { tocar } from '../audio.js'
import Carta from './Carta.js'

// Mão de cartas em leque, com cursor do jogador.
//
//   const mao = new Mao(scene, { jogador: 0, x: 160, y: 430 })
//   await mao.comprarVarias([dados1, dados2, ...])   cartas saem do monte em sequência
//   mao.mover(1) / mao.mover(-1)    cursor para a direita/esquerda (na tela)
//   mao.selecionada                 Carta sob o cursor (ou null)
//   mao.setEnergia(3)               cartas com custo > 3 ficam indisponíveis
//   mao.setAtiva(false)             esconde o cursor   mao.setTravada(true)  mantém a escolhida levantada
//   mao.retirar(carta)              tira da mão sem destruir (ex.: antes de arremessar)
//   mao.setPosicao({ x, y, angulo, espelhar })   muda o lugar do leque (anima)
//
// Opções:
//   jogador      0 ou 1: cor do cursor e do brilho (CORES.almas[jogador])
//   x, y         centro da base do leque (onde fica a carta do meio)
//   angulo       rotação do leque inteiro (rad). 0 = embaixo abrindo para cima;
//                Math.PI = em cima (cartas de cabeça para baixo, viradas para quem senta do outro lado)
//   espelhar     inverte a ordem dos índices (o índice 0 fica à direita da tela)
//   espacamento  distância entre cartas vizinhas (px)
//   abertura     inclinação de cada carta em relação à vizinha (rad)
//   curva        quanto as pontas do leque descem (px por índice²)
//   larguraMax   o leque não passa dessa largura (aperta o espaçamento)
//   largura      largura de cada carta (Carta)
//   monte        { x, y } de onde as cartas compradas saem (padrão: ao lado do leque)
//   profundidade depth base das cartas (a carta com cursor fica por cima)
//   rotulo       texto do cursor (padrão 'P1' / 'P2'); '' esconde
export default class Mao {
  constructor(scene, opcoes = {}) {
    this.scene = scene
    this.jogador = opcoes.jogador ?? 0
    this.cor = CORES.almas[this.jogador] ?? 0xffffff
    this.x = opcoes.x ?? 320
    this.y = opcoes.y ?? 430
    this.angulo = opcoes.angulo ?? 0
    this.espelhar = opcoes.espelhar ?? false
    this.espacamento = opcoes.espacamento ?? 44
    this.abertura = opcoes.abertura ?? 0.075
    this.curva = opcoes.curva ?? 2.2
    this.larguraMax = opcoes.larguraMax ?? 260
    this.larguraCarta = opcoes.largura ?? 70
    this.monte = opcoes.monte ?? null
    this.profundidade = opcoes.profundidade ?? 20
    this.cartas = []
    this.indice = 0
    this.ativa = true
    this.travada = false

    // cursor: coração da cor do jogador apontando para a carta, com etiqueta
    this.cursor = scene.add.container(this.x, this.y).setDepth(this.profundidade + 60)
    const coracao = scene.add.image(0, 0, 'coracao').setTint(this.cor).setScale(1.3).setAngle(180)
    const rotulo = opcoes.rotulo ?? `P${this.jogador + 1}`
    const etiqueta = scene.add
      .text(0, -14, rotulo, { fontFamily: FONTE, fontSize: '11px', color: corTexto(this.cor), stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5)
    this.cursor.add([coracao, etiqueta])
    this.etiqueta = etiqueta
    this.cursor.setVisible(false)
    this._bob = 0

    scene.events.on('update', this.atualizar, this)
    scene.events.once('shutdown', () => this.destroy())
  }

  get selecionada() {
    return this.cartas[this.indice] ?? null
  }

  // posição de mesa da carta i de n: { x, y, rotacao }
  posicao(i, n = this.cartas.length) {
    const ordem = this.espelhar ? n - 1 - i : i
    const t = ordem - (n - 1) / 2
    const passo = n > 1 ? Math.min(this.espacamento, this.larguraMax / (n - 1)) : 0
    const lx = t * passo
    const ly = this.curva * t * t
    const cos = Math.cos(this.angulo)
    const sen = Math.sin(this.angulo)
    return {
      x: this.x + lx * cos - ly * sen,
      y: this.y + lx * sen + ly * cos,
      rotacao: this.angulo + t * this.abertura,
    }
  }

  // de onde saem as cartas compradas
  posicaoMonte() {
    if (this.monte) return this.monte
    const lado = this.larguraMax / 2 + this.larguraCarta
    const cos = Math.cos(this.angulo)
    const sen = Math.sin(this.angulo)
    const lx = this.espelhar ? -lado : lado
    return { x: this.x + lx * cos + 10 * sen, y: this.y + lx * sen - 10 * cos }
  }

  // reorganiza o leque (anima por padrão)
  layout(animado = true) {
    const n = this.cartas.length
    this.cartas.forEach((carta, i) => {
      const p = this.posicao(i, n)
      carta.setDepth(this.profundidade + i + (i === this.indice && carta.foco ? 30 : 0))
      this.scene.tweens.killTweensOf(carta)
      if (!animado) {
        carta.setPosition(p.x, p.y).setRotation(p.rotacao).setScale(1)
        return
      }
      this.scene.tweens.add({ targets: carta, x: p.x, y: p.y, rotation: p.rotacao, scaleX: 1, scaleY: 1, duration: 240, ease: 'Cubic.easeOut' })
    })
  }

  // muda o lugar do leque: { x, y, angulo, espelhar, monte }
  setPosicao(opcoes = {}) {
    Object.assign(this, Object.fromEntries(Object.entries(opcoes).filter(([, v]) => v !== undefined)))
    this.layout(true)
    return this
  }

  // cria a Carta e compra do monte. Devolve Promise<Carta> (quando ela já virou para cima)
  //   total: tamanho final da mão quando várias chegam em sequência (comprarVarias),
  //   para cada carta já voar para o lugar definitivo
  adicionar(dados, { atraso = 0, revelar = true, total = 0 } = {}) {
    const monte = this.posicaoMonte()
    const carta = new Carta(this.scene, monte.x, monte.y, dados, { largura: this.larguraCarta, corFoco: this.cor })
    carta.mao = this
    this.cartas.push(carta)
    const n = Math.max(total, this.cartas.length)
    const p = this.posicao(this.cartas.length - 1, n)
    // as outras abrem espaço; a nova vem do monte
    this.cartas.slice(0, -1).forEach((c, i) => {
      const q = this.posicao(i, n)
      this.scene.tweens.add({ targets: c, x: q.x, y: q.y, rotation: q.rotacao, duration: 240, ease: 'Cubic.easeOut' })
    })
    carta.setDepth(this.profundidade + this.cartas.length)
    const promessa = carta.comprar({ de: monte, para: p, atraso, revelar })
    if (this.energia !== undefined) carta.setIndisponivel((dados.custo ?? 0) > this.energia)
    promessa.then(() => this.atualizarFoco())
    return promessa
  }

  // compra várias em sequência (intervalo em ms). Devolve Promise<Carta[]>
  comprarVarias(lista, { intervalo = 110, revelar = true } = {}) {
    const total = this.cartas.length + lista.length
    return Promise.all(lista.map((dados, i) => this.adicionar(dados, { atraso: i * intervalo, revelar, total })))
  }

  // tira a carta da mão (sem destruir) e fecha o leque
  retirar(carta) {
    const i = this.cartas.indexOf(carta)
    if (i < 0) return carta
    this.cartas.splice(i, 1)
    carta.mao = null
    if (this.indice >= this.cartas.length) this.indice = Math.max(0, this.cartas.length - 1)
    this.atualizarFoco()
    this.layout(true)
    return carta
  }

  // remove e destroi todas
  limpar() {
    this.cartas.forEach((c) => c.destroy())
    this.cartas = []
    this.indice = 0
  }

  // passo: -1 esquerda, 1 direita (na tela, já considerando espelhar/ângulo)
  mover(passo) {
    const n = this.cartas.length
    if (!n) return
    let p = this.espelhar ? -passo : passo
    if (Math.cos(this.angulo) < 0) p = -p // leque de cabeça para baixo: direita da tela = índice menor
    const novo = Phaser.Math.Clamp(this.indice + p, 0, n - 1)
    if (novo === this.indice) return
    this.indice = novo
    tocar(this.scene, 'cartaSelecionar')
    this.atualizarFoco()
  }

  selecionar(indice) {
    this.indice = Phaser.Math.Clamp(indice, 0, Math.max(0, this.cartas.length - 1))
    this.atualizarFoco()
    return this
  }

  // liga/desliga o cursor (a carta escolhida continua levantada)
  setAtiva(ativa) {
    this.ativa = ativa
    this.atualizarFoco()
    return this
  }

  // travada: a escolhida continua levantada mesmo sem cursor (ex.: depois de confirmar)
  setTravada(travada) {
    this.travada = travada
    this.atualizarFoco()
    return this
  }

  // marca indisponíveis as cartas que custam mais que a energia
  setEnergia(energia) {
    this.energia = energia
    this.cartas.forEach((c) => c.setIndisponivel((c.dados.custo ?? 0) > energia))
    return this
  }

  atualizarFoco() {
    const n = this.cartas.length
    this.cartas.forEach((carta, i) => {
      const focada = i === this.indice && (this.ativa || this.travada)
      const t = i - (n - 1) / 2
      carta.focar(focada, { sinal: t === 0 ? 1 : Math.sign(t) })
      carta.setDepth(this.profundidade + i + (focada ? 30 : 0))
    })
  }

  // segue a carta focada (chamado todo frame)
  atualizar(_, delta) {
    const carta = this.selecionada
    const visivel = this.ativa && !!carta
    this.cursor.setVisible(visivel)
    if (!visivel) return
    this._bob += delta / 1000
    const distancia = (carta.altura / 2) * carta.scaleY + carta.focoCfg.subida + 14 + Math.sin(this._bob * 6) * 2.5
    const x = carta.x + Math.sin(carta.rotation) * distancia
    const y = carta.y - Math.cos(carta.rotation) * distancia
    const k = Math.min(1, delta / 60)
    this.cursor.x += (x - this.cursor.x) * k
    this.cursor.y += (y - this.cursor.y) * k
    this.cursor.rotation = carta.rotation
    this.etiqueta.setRotation(Math.cos(carta.rotation) < 0 ? Math.PI : 0)
  }

  destroy() {
    if (!this.scene) return
    this.scene.events.off('update', this.atualizar, this)
    this.cursor.destroy()
    this.scene = null
  }
}
