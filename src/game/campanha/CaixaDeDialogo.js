import { FONTE, LARGURA, AUDIO } from '../constants.js'
import { contextoAudio, volumeEfeitos } from '../audio.js'
import { menosMovimento } from '../preferencias.js'
import { PERSONAGENS } from '../data/personagens.js'
import { criarDialogo, LETRAS_POR_BLIP } from './dialogo.js'

// A CAIXA DE DIÁLOGO da campanha (o desenho; o motor é campanha/dialogo.js): caixa escura com borda
// branca embaixo da tela, retrato e nome de quem fala, texto datilografado com "blip" (sintetizado no
// AudioContext do jogo, respeitando o volume dos efeitos) e as escolhas de duas opções com o coração.
// "Reduzir animações": o texto aparece inteiro.
//
//   const caixa = new CaixaDeDialogo(scene, falas, { escolhas, aoEscolher(chave, valor), aoAcabar() })
//   no update: caixa.update(delta) · A: caixa.confirmar() · ↑↓: caixa.mover(±1) · B: caixa.pular()
const CAIXA = { x: 28, y: 318, largura: LARGURA - 56, altura: 146 }
const RETRATO = { x: CAIXA.x + 18, y: CAIXA.y + 18, lado: 110 }
const TOM = { kris: 330, ralsei: 520, noelle: 600, berdly: 420, susie: 260, dess: 380, asriel: 470, narrador: 300 }

// um "blip" curtinho por algumas letras (o tom muda com quem fala)
export function blip(quem) {
  const vol = volumeEfeitos()
  const c = vol > 0 ? contextoAudio() : null
  if (!c) return false
  if (c.state === 'suspended') c.resume()
  const t = c.currentTime
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = quem === 'narrador' ? 'triangle' : 'square'
  o.frequency.setValueAtTime((TOM[quem] ?? 400) * (0.97 + Math.random() * 0.06), t)
  g.gain.setValueAtTime(0.05 * AUDIO.volume * vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + 0.06)
  return true
}

export default class CaixaDeDialogo {
  constructor(scene, falas, { escolhas = {}, aoEscolher = () => {}, aoAcabar = () => {}, profundidade = 80 } = {}) {
    this.scene = scene
    this.aoEscolher = aoEscolher
    this.aoAcabar = aoAcabar
    this.d = criarDialogo(falas, { escolhas, instantaneo: menosMovimento() })
    this.acabou = false
    this.letras = 0
    this.tempo = 0
    const c = scene.add.container(0, 0).setDepth(profundidade)
    this.raiz = c
    const g = scene.add.graphics()
    g.fillStyle(0x000000, 1).fillRect(CAIXA.x, CAIXA.y, CAIXA.largura, CAIXA.altura)
    g.lineStyle(4, 0xffffff, 1).strokeRect(CAIXA.x, CAIXA.y, CAIXA.largura, CAIXA.altura)
    this.moldura = scene.add.graphics()
    this.retrato = scene.add.image(RETRATO.x + RETRATO.lado / 2, RETRATO.y + RETRATO.lado / 2, '__DEFAULT').setVisible(false)
    this.nome = scene.add.text(CAIXA.x + 14, CAIXA.y - 4, '', { fontFamily: FONTE, fontSize: '15px', color: '#ffffff', backgroundColor: '#000000', padding: { x: 8, y: 3 } }).setOrigin(0, 1)
    this.texto = scene.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '18px', color: '#ffffff', lineSpacing: 6 })
    this.opcoes = [0, 1].map(() => scene.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '18px', color: '#ffffff' }))
    this.cursor = scene.add.image(0, 0, 'coracao').setTint(0xff2a3a).setScale(1.2).setVisible(false)
    this.seta = scene.add.text(CAIXA.x + CAIXA.largura - 26, CAIXA.y + CAIXA.altura - 44, '▼', { fontFamily: FONTE, fontSize: '14px', color: '#ffffff' })
    this.dica = scene.add.text(CAIXA.x + CAIXA.largura - 12, CAIXA.y + CAIXA.altura - 8, 'A: continuar   B: pular', { fontFamily: FONTE, fontSize: '10px', color: '#9a9ab0' }).setOrigin(1, 1)
    c.add([g, this.moldura, this.retrato, this.nome, this.texto, ...this.opcoes, this.cursor, this.seta, this.dica])
    this.mostrar()
    if (this.d.acabou) this.terminar()
  }

  get falando() {
    return this.d.atual?.quem ?? null
  }

  mostrar() {
    const a = this.d.atual
    if (!a) return
    const escolha = Boolean(a.escolha)
    const quem = escolha ? 'kris' : a.quem
    const comRetrato = quem !== 'narrador' && this.scene.textures.exists(quem)
    this.moldura.clear()
    this.retrato.setVisible(comRetrato)
    if (comRetrato) {
      this.moldura.lineStyle(2, 0xffffff, 0.8).strokeRect(RETRATO.x, RETRATO.y, RETRATO.lado, RETRATO.lado)
      // o rosto: a parte de cima do sprite (16×24), bem grande e sem borrar
      this.retrato.setTexture(quem).setCrop(0, 0, 16, 14).setScale(6.2).setOrigin(0.5, 0.36)
      this.retrato.setPosition(RETRATO.x + RETRATO.lado / 2, RETRATO.y + RETRATO.lado / 2)
    }
    const x = comRetrato ? RETRATO.x + RETRATO.lado + 20 : CAIXA.x + 26
    const largura = CAIXA.x + CAIXA.largura - 30 - x
    this.nome.setText(escolha ? 'KRIS' : quem === 'narrador' ? '' : (PERSONAGENS[quem]?.nome ?? quem).toUpperCase()).setVisible(!escolha ? quem !== 'narrador' : true)
    this.texto.setPosition(x, CAIXA.y + 22).setWordWrapWidth(largura)
    this.texto.setText(escolha ? '' : a.visivel)
    this.opcoes.forEach((o, i) => {
      o.setVisible(escolha)
      if (!escolha) return
      o.setPosition(x + 30, CAIXA.y + 34 + i * 40).setText(a.escolha.opcoes[i].texto).setColor(i === a.indice ? '#ffe040' : '#ffffff')
    })
    this.cursor.setVisible(escolha)
    if (escolha) this.cursor.setPosition(x + 12, CAIXA.y + 46 + a.indice * 40)
    this.seta.setVisible(!escolha && a.completo)
    this.dica.setText(escolha ? '↑↓: escolher   A: confirmar' : 'A: continuar   B: pular')
  }

  update(delta) {
    if (this.acabou) return
    this.tempo += delta
    const novas = this.d.avancar(delta)
    if (novas > 0) {
      this.letras += novas
      if (this.letras >= LETRAS_POR_BLIP) {
        this.letras = 0
        blip(this.falando)
      }
      this.mostrar()
    }
    if (this.seta.visible && !menosMovimento()) this.seta.setY(CAIXA.y + CAIXA.altura - 44 + Math.round(Math.sin(this.tempo / 160) * 2))
  }

  confirmar() {
    if (this.acabou) return
    const antes = this.d.atual
    const r = this.d.confirmar()
    if (antes?.escolha) {
      const chave = antes.escolha.chave
      this.aoEscolher(chave, this.d.escolhas[chave])
    }
    if (r === 'fim') return this.terminar()
    this.mostrar()
  }

  mover(passo) {
    if (this.acabou || !this.d.atual?.escolha) return
    this.d.mover(passo)
    this.mostrar()
  }

  pular() {
    if (this.acabou) return
    if (this.d.pular() === 'fim') return this.terminar()
    this.mostrar()
  }

  terminar() {
    if (this.acabou) return
    this.acabou = true
    this.raiz.destroy()
    this.aoAcabar(this.d.escolhas)
  }

  destroy() {
    this.acabou = true
    this.raiz?.destroy()
  }
}

export { CAIXA as CAIXA_DIALOGO }
