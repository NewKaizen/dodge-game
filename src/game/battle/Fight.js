import { FIGHT, LAYOUT, TEMPOS, TEXTO } from '../constants.js'
import { ESCALA } from '../arte/texturas.js'
import { tocar } from '../audio.js'
import { numero } from '../effects/numero.js'

// Minigame do FIGHT em COMBO: cada lutador tem FIGHT.golpes barras que vêm em
// fila até o alvo, e o dono aperta A uma vez para cada. Cada acerto é um golpe
// separado (dano = fatorGolpe do golpe cheio; quanto mais perto, mais dano), e
// acertar TODAS as barras de um lutador dá bônus de combo no último golpe.
//
// O ritmo é sorteado, mas sempre justo: as chegadas de cada jogador são
// agendadas em sequência (com 1 jogador as linhas de Kris e Susie se
// intercalam) e duas barras do mesmo jogador nunca ficam dentro da janela de
// acerto ao mesmo tempo. Config em FIGHT e em personagem.fight.
export default class Fight {
  // lutadores: [{ membro, alvo }]
  // aoAcertar(membro, alvo, dano, critico, combo) — dano 0 = MISS
  constructor(scene, lutadores, aoAcertar, aoTerminar) {
    this.scene = scene
    this.aoAcertar = aoAcertar
    this.aoTerminar = aoTerminar
    this.objetos = []
    this.pausa = null
    this.terminou = false

    const { x, y, largura } = LAYOUT.textbox
    this.alvoX = x + 96
    this.limiteX = x + largura - 20 // depois disso a barra fica escondida (ainda fora da caixa)

    this.linhas = lutadores.map(({ membro, alvo }, i) => {
      const cfg = { ...FIGHT, ...membro.def.fight }
      const linhaY = y + 26 + i * 30
      // cada linha anda num ritmo um pouco diferente a cada FIGHT (mesma
      // velocidade dentro da linha, então as barras dela nunca se ultrapassam)
      const velocidade = cfg.velocidade * (1 + (Math.random() * 2 - 1) * cfg.variacaoVelocidade)
      this.objetos.push(
        scene.add.image(x + 30, linhaY, `icone-${membro.id}`).setScale(ESCALA.icone).setDepth(2),
        scene.add.rectangle(x + 56, linhaY, largura - 72, 24, 0x000000).setOrigin(0, 0.5).setStrokeStyle(2, membro.cor).setDepth(2),
      )
      const alvoRet = scene.add
        .rectangle(this.alvoX, linhaY, cfg.perfeito * 2 + 8, 24, membro.cor, 0.35)
        .setStrokeStyle(2, 0xffffff)
        .setDepth(2)
      this.objetos.push(alvoRet)
      return { membro, alvo, cfg, linhaY, velocidade, alvoRet, acertos: 0, resolvidas: 0 }
    })

    this.barras = []
    this.agendar()
  }

  // Sorteia a ordem e o momento de chegada de cada barra, jogador por jogador
  agendar() {
    const jogadores = [...new Set(this.linhas.map((l) => l.membro.jogador))]
    for (const jogador of jogadores) {
      const linhas = this.linhas.filter((l) => l.membro.jogador === jogador)
      const restantes = new Map(linhas.map((l) => [l, l.cfg.golpes]))
      let anterior = null
      let chegada = 0
      while ([...restantes.values()].some((n) => n > 0)) {
        // intercala as linhas: evita repetir a mesma linha quando dá
        const candidatas = linhas.filter((l) => restantes.get(l) > 0)
        const outras = candidatas.filter((l) => l !== anterior?.linha)
        const pool = outras.length && Math.random() < 0.8 ? outras : candidatas
        const linha = pool[Math.floor(Math.random() * pool.length)]
        const meiaJanela = (linha.cfg.janela / linha.velocidade) * 1000

        if (!anterior) {
          chegada = linha.cfg.chegadaMs + Math.random() * linha.cfg.variacaoMs
        } else {
          // janela da anterior e desta não podem se encostar
          const minimo = Math.max(linha.cfg.intervaloMinMs, anterior.meiaJanela + meiaJanela + linha.cfg.folgaMs)
          chegada += minimo + Math.random() * linha.cfg.variacaoMs
        }

        const indice = linha.cfg.golpes - restantes.get(linha)
        restantes.set(linha, restantes.get(linha) - 1)
        const inicio = this.alvoX + (linha.velocidade * chegada) / 1000
        const cursor = this.scene.add
          .rectangle(inicio, linha.linhaY, indice === linha.cfg.golpes - 1 ? 8 : 6, 22, 0xffffff)
          .setDepth(3)
          .setVisible(inicio <= this.limiteX)
        this.objetos.push(cursor)
        const barra = { linha, membro: linha.membro, cfg: linha.cfg, indice, chegada, meiaJanela, cursor, x: inicio, resolvida: false }
        this.barras.push(barra)
        anterior = barra
      }
    }
  }

  atualizar(dt) {
    for (const b of this.barras) {
      if (b.resolvida) continue
      b.x -= (b.linha.velocidade * dt) / 1000
      b.cursor.setX(b.x).setVisible(b.x <= this.limiteX)
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

  // Resolve a barra deste jogador que chega (ou chegou) primeiro ao alvo.
  // Compara pelo tempo até o alvo, não pela distância: as linhas andam em
  // velocidades diferentes.
  apertar(jogador) {
    const tempo = (b) => (b.x - this.alvoX) / b.linha.velocidade
    const b = this.barras.filter((b) => !b.resolvida && b.membro.jogador === jogador).sort((p, q) => tempo(p) - tempo(q))[0]
    if (!b) return
    const distancia = Math.abs(b.x - this.alvoX)
    if (distancia > b.cfg.janela) return this.resolver(b, 0, false)
    const critico = distancia <= b.cfg.perfeito
    const precisao = 1 - distancia / b.cfg.janela
    const dano = Math.round(b.cfg.dano * b.cfg.fatorGolpe * (critico ? b.cfg.critico : 0.5 + 0.5 * precisao))
    this.resolver(b, Math.max(1, dano), critico)
  }

  resolver(b, dano, critico) {
    const linha = b.linha
    b.resolvida = true
    linha.resolvidas++
    if (dano > 0) linha.acertos++
    // a última barra fecha o combo se todas as da linha acertaram
    const combo = dano > 0 && linha.resolvidas === b.cfg.golpes && linha.acertos === b.cfg.golpes
    if (combo) dano = Math.round(dano * b.cfg.bonusCombo)

    b.cursor.setVisible(true).setFillStyle(critico ? 0xffe040 : dano > 0 ? b.membro.cor : 0x606060)
    this.scene.tweens.add({ targets: b.cursor, scaleX: 3, scaleY: 1.6, alpha: 0, duration: 320 })
    tocar(this.scene, critico ? 'critico' : dano > 0 ? 'golpe' : 'erro')
    if (dano <= 0) linha.alvoRet.setFillStyle(0x606060, 0.35)
    if (combo) this.comemorar(linha)
    this.aoAcertar(b.membro, linha.alvo, dano, critico, combo)
  }

  comemorar(linha) {
    tocar(this.scene, 'combo')
    numero(this.scene, this.alvoX + 64, linha.linhaY - 6, 'COMBO!', TEXTO.selecionado, { tamanho: 18, pop: 1.7 })
    linha.alvoRet.setFillStyle(0xffe040, 0.8)
    this.scene.tweens.add({ targets: linha.alvoRet, scaleX: 2.2, scaleY: 1.3, alpha: 0, duration: 380, ease: 'Cubic.easeOut' })
  }

  // Para os testes: barras ainda andando (chegada = ms planejado até o alvo)
  estado() {
    return this.barras.map((b) => ({
      jogador: b.membro.jogador,
      membro: b.membro.id,
      golpe: b.indice,
      chegada: Math.round(b.chegada),
      x: b.x,
      alvoX: this.alvoX,
      resolvida: b.resolvida,
    }))
  }
}
