import { FIGHT, LAYOUT, TEMPOS } from '../constants.js'
import { ESCALA } from '../arte/texturas.js'
import { tocar } from '../audio.js'

// Minigame do FIGHT: uma barra por lutador anda até o alvo e o dono aperta A
// quando ela passa por ele. Quanto mais perto, mais dano (config em FIGHT e
// em personagem.fight).
export default class Fight {
  // lutadores: [{ membro, alvo }]
  // aoAcertar(membro, alvo, dano, critico) — dano 0 = MISS
  constructor(scene, lutadores, aoAcertar, aoTerminar) {
    this.scene = scene
    this.aoAcertar = aoAcertar
    this.aoTerminar = aoTerminar
    this.objetos = []
    this.pausa = null
    this.terminou = false

    const { x, y, largura } = LAYOUT.textbox
    this.alvoX = x + 96

    this.barras = lutadores.map(({ membro, alvo }, i) => {
      const cfg = { ...FIGHT, ...membro.def.fight }
      const linhaY = y + 26 + i * 30
      const inicio = this.alvoX + 280 + i * 80 // barras escalonadas, como no Deltarune

      this.objetos.push(
        scene.add.image(x + 30, linhaY, `icone-${membro.id}`).setScale(ESCALA.icone).setDepth(2),
        scene.add.rectangle(x + 56, linhaY, largura - 72, 24, 0x000000).setOrigin(0, 0.5).setStrokeStyle(2, membro.cor).setDepth(2),
        scene.add.rectangle(this.alvoX, linhaY, cfg.perfeito * 2 + 8, 24, membro.cor, 0.35).setStrokeStyle(2, 0xffffff).setDepth(2),
      )
      const cursor = scene.add.rectangle(inicio, linhaY, 6, 22, 0xffffff).setDepth(3)
      this.objetos.push(cursor)
      return { membro, alvo, cfg, cursor, x: inicio, resolvida: false }
    })
  }

  atualizar(dt) {
    for (const b of this.barras) {
      if (b.resolvida) continue
      b.x -= (b.cfg.velocidade * dt) / 1000
      b.cursor.setX(b.x)
      if (b.x < this.alvoX - b.cfg.janela) this.resolver(b, 0, false)
    }

    if (this.pausa === null && this.barras.every((b) => b.resolvida)) this.pausa = TEMPOS.fimFightMs
    if (this.pausa !== null && !this.terminou) {
      this.pausa -= dt
      if (this.pausa <= 0) {
        this.terminou = true
        this.objetos.forEach((o) => {
          this.scene.tweens.killTweensOf(o)
          o.destroy()
        })
        this.aoTerminar()
      }
    }
  }

  // Resolve a barra deste jogador que está mais perto do alvo
  apertar(jogador) {
    const b = this.barras.filter((b) => !b.resolvida && b.membro.jogador === jogador).sort((p, q) => p.x - q.x)[0]
    if (!b) return
    const distancia = Math.abs(b.x - this.alvoX)
    if (distancia > b.cfg.janela) return this.resolver(b, 0, false)
    const critico = distancia <= b.cfg.perfeito
    const precisao = 1 - distancia / b.cfg.janela
    const dano = Math.round(b.cfg.dano * (critico ? b.cfg.critico : 0.5 + 0.5 * precisao))
    this.resolver(b, dano, critico)
  }

  resolver(b, dano, critico) {
    b.resolvida = true
    b.cursor.setFillStyle(critico ? 0xffe040 : dano > 0 ? b.membro.cor : 0x606060)
    this.scene.tweens.add({ targets: b.cursor, scaleX: 3, scaleY: 1.6, alpha: 0, duration: 320 })
    tocar(this.scene, critico ? 'critico' : dano > 0 ? 'golpe' : 'erro')
    this.aoAcertar(b.membro, b.alvo, dano, critico)
  }

  // Para os testes: barras ainda andando
  estado() {
    return this.barras.map((b) => ({ jogador: b.membro.jogador, x: b.x, alvoX: this.alvoX, resolvida: b.resolvida }))
  }
}
