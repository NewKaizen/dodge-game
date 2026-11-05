import Phaser from 'phaser'
import { FONTE, LARGURA, AUDIO } from '../constants.js'
import { contextoAudio, volumeEfeitos } from '../audio.js'
import { menosMovimento } from '../preferencias.js'
import { PERSONAGENS } from '../data/personagens.js'
import { criarDialogo, LETRAS_POR_BLIP } from './dialogo.js'
import { semLigaduras } from './texto.js'

// A CAIXA DE DIÁLOGO da campanha (o desenho; o motor é campanha/dialogo.js), no estilo clássico:
// caixa preta com uma borda branca fina embaixo da tela, o retrato à esquerda e o texto datilografado
// devagar, com um "blip" baixo e macio (sintetizado no AudioContext do jogo, respeitando o volume dos
// efeitos). Os ECOS (ecos: true no texto do mundo; todo mundo que não é a Kris) aparecem apagados:
// retrato sem cor, um brilho frio em volta e o nome em azul-acinzentado. O narrador não tem retrato
// e fala num cinza claro. As escolhas de duas opções usam o coração.
// "Reduzir animações": o texto aparece inteiro e o retrato não pulsa.
//
//   const caixa = new CaixaDeDialogo(scene, falas, { escolhas, ecos, aoEscolher(chave, valor), aoAcabar() })
//   no update: caixa.update(delta) · A: caixa.confirmar() · ↑↓: caixa.mover(±1) · B: caixa.pular()
const CAIXA = { x: 36, y: 324, largura: LARGURA - 72, altura: 138 }
const RETRATO = { x: CAIXA.x + 16, y: CAIXA.y + 16, lado: 106 }
const LETRA_MS = 42 // mais devagar que o resto do jogo: a campanha respira
// o tom do blip (Hz): baixo, para não cortar o silêncio
const TOM = { kris: 196, ralsei: 262, noelle: 294, berdly: 220, susie: 175, dess: 233, asriel: 247, narrador: 147 }
const COR_NOME = { eco: '#8fb8c0', kris: '#ffffff' }
const COR_TEXTO = { narrador: '#bdb8d0', fala: '#ffffff' }

// um "blip" baixinho por algumas letras: seno com um ataque macio (o tom muda com quem fala)
export function blip(quem) {
  const vol = volumeEfeitos()
  const c = vol > 0 ? contextoAudio() : null
  if (!c) return false
  if (c.state === 'suspended') c.resume()
  const t = c.currentTime
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = quem === 'narrador' ? 'sine' : 'triangle'
  o.frequency.setValueAtTime((TOM[quem] ?? 220) * (0.98 + Math.random() * 0.04), t)
  const pico = (quem === 'narrador' ? 0.025 : 0.04) * AUDIO.volume * vol
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(pico, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + 0.1)
  return true
}

export default class CaixaDeDialogo {
  constructor(scene, falas, { escolhas = {}, ecos = false, aoEscolher = () => {}, aoAcabar = () => {}, profundidade = 80 } = {}) {
    this.scene = scene
    this.aoEscolher = aoEscolher
    this.aoAcabar = aoAcabar
    this.ecos = ecos
    this.d = criarDialogo(falas, { escolhas, instantaneo: menosMovimento(), letraMs: LETRA_MS })
    this.acabou = false
    this.letras = 0
    this.tempo = 0
    const c = scene.add.container(0, 0).setDepth(profundidade)
    this.raiz = c
    const g = scene.add.graphics()
    g.fillStyle(0x000000, 1).fillRect(CAIXA.x, CAIXA.y, CAIXA.largura, CAIXA.altura)
    g.lineStyle(2, 0xffffff, 1).strokeRect(CAIXA.x + 3, CAIXA.y + 3, CAIXA.largura - 6, CAIXA.altura - 6)
    this.moldura = scene.add.graphics()
    // o brilho frio atrás do retrato dos ecos
    this.brilho = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD)
    this.retrato = scene.add.image(RETRATO.x + RETRATO.lado / 2, RETRATO.y + RETRATO.lado / 2, '__DEFAULT').setVisible(false)
    this.filtroCor = null
    try {
      this.retrato.enableFilters()
      this.filtroCor = this.retrato.filters?.internal?.addColorMatrix() ?? null
    } catch {
      this.filtroCor = null // sem filtros (contexto sem WebGL): o eco fica só com o tom frio
    }
    this.nome = scene.add.text(CAIXA.x + 12, CAIXA.y - 6, '', { fontFamily: FONTE, fontSize: '13px', color: '#ffffff', backgroundColor: '#000000', padding: { x: 8, y: 3 } }).setOrigin(0, 1)
    this.texto = scene.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '18px', color: '#ffffff', lineSpacing: 8 })
    this.opcoes = [0, 1].map(() => scene.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '17px', color: '#ffffff' }))
    this.cursor = scene.add.image(0, 0, 'coracao').setTint(0xff2a3a).setScale(1.1).setVisible(false)
    this.seta = scene.add.text(CAIXA.x + CAIXA.largura - 24, CAIXA.y + CAIXA.altura - 40, '▼', { fontFamily: FONTE, fontSize: '12px', color: '#ffffff' })
    this.dica = scene.add.text(CAIXA.x + CAIXA.largura - 12, CAIXA.y + CAIXA.altura + 6, 'A: continuar   B: pular', { fontFamily: FONTE, fontSize: '10px', color: '#6a6680' }).setOrigin(1, 0)
    c.add([g, this.moldura, this.brilho, this.retrato, this.nome, this.texto, ...this.opcoes, this.cursor, this.seta, this.dica])
    this.mostrar()
    if (this.d.acabou) this.terminar()
  }

  get falando() {
    return this.d.atual?.quem ?? null
  }

  // quem fala é um eco? (todo mundo menos a Kris e o narrador, quando o mundo diz ecos: true)
  eco(quem) {
    return Boolean(this.ecos) && quem !== 'kris' && quem !== 'narrador'
  }

  mostrar() {
    const a = this.d.atual
    if (!a) return
    const escolha = Boolean(a.escolha)
    const quem = escolha ? 'kris' : a.quem
    const comRetrato = quem !== 'narrador' && this.scene.textures.exists(quem)
    const eco = this.eco(quem)
    this.moldura.clear()
    this.brilho.clear()
    this.retrato.setVisible(comRetrato)
    if (comRetrato) {
      this.moldura.lineStyle(1, eco ? 0x8fb8c0 : 0xffffff, eco ? 0.5 : 0.8).strokeRect(RETRATO.x, RETRATO.y, RETRATO.lado, RETRATO.lado)
      // o rosto: a parte de cima do sprite (16×24), bem grande e sem borrar
      this.retrato.setTexture(quem).setCrop(0, 0, 16, 14).setScale(6).setOrigin(0.5, 0.36)
      this.retrato.setPosition(RETRATO.x + RETRATO.lado / 2, RETRATO.y + RETRATO.lado / 2)
      if (this.filtroCor) {
        this.filtroCor.colorMatrix.reset()
        if (eco) this.filtroCor.colorMatrix.saturate(-0.75).brightness(0.85, true)
      }
      this.retrato.setTint(eco ? 0xb8d4dc : 0xffffff).setAlpha(eco ? 0.8 : 1)
      if (eco) for (let k = 0; k < 4; k++) this.brilho.fillStyle(0x3fb3a8, 0.05).fillCircle(RETRATO.x + RETRATO.lado / 2, RETRATO.y + RETRATO.lado / 2, 30 + k * 9)
    }
    const x = comRetrato ? RETRATO.x + RETRATO.lado + 22 : CAIXA.x + 30
    const largura = CAIXA.x + CAIXA.largura - 34 - x
    const nome = escolha ? 'KRIS' : quem === 'narrador' ? '' : (PERSONAGENS[quem]?.nome ?? quem).toUpperCase()
    this.nome.setText(nome).setVisible(Boolean(nome)).setColor(eco ? COR_NOME.eco : COR_NOME.kris)
    this.texto.setPosition(x, CAIXA.y + 24).setWordWrapWidth(largura)
    this.texto.setColor(quem === 'narrador' ? COR_TEXTO.narrador : COR_TEXTO.fala)
    this.texto.setText(escolha ? '' : semLigaduras(a.visivel))
    this.opcoes.forEach((o, i) => {
      o.setVisible(escolha)
      if (!escolha) return
      o.setPosition(x + 30, CAIXA.y + 34 + i * 40).setText(semLigaduras(a.escolha.opcoes[i].texto)).setColor(i === a.indice ? '#f2e2b0' : '#8a86a0')
    })
    this.cursor.setVisible(escolha)
    if (escolha) this.cursor.setPosition(x + 12, CAIXA.y + 44 + a.indice * 40)
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
    if (this.seta.visible && !menosMovimento()) this.seta.setAlpha(0.45 + 0.55 * Math.abs(Math.sin(this.tempo / 520)))
    if (this.retrato.visible && this.eco(this.falando) && !menosMovimento()) this.retrato.setAlpha(0.72 + 0.12 * Math.sin(this.tempo / 700))
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
