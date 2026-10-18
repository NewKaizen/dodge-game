import { LARGURA, ALTURA, CORES, TEXTO } from '../../constants.js'
import { tocar, velocidadeMusica, fitaMusica, andamentoMusica, calarTransmissao } from '../../audio.js'
import { debug } from '../../debug.js'
import { caixasDe } from '../../recorte.js'
import { flashTela } from '../../effects/flash.js'
import { shake } from '../../effects/shake.js'
import { fatores } from '../../acessibilidade.js'
import { ESCALA } from '../../arte/texturas.js'
import Gravador from './gravador.js'
import Transmissao from './transmissao.js'
import { PERSONAGENS } from '../../data/personagens.js'
import { quebrarCoracao, prepararTexturasCoracao } from './coracaoPartido.js'

// Fim da partida PvP: CÂMERA LENTA no golpe final e o REPLAY como transmissão esportiva de TV.
//
//   1. K.O. (a arena chama nocaute(j, k) no lugar da quebra de sempre): o
//      jogo congela por um instante (hitstop) e anda a LENTA.fator: as balas
//      se arrastam, a que acertou continua atravessando o coração (um
//      "fantasma" dela, porque a bala de verdade some no acerto) e o coração
//      trinca e estilhaça devagar (coracaoPartido.js). Véu escuro, vinheta,
//      balas sem cor (o coração vermelho/amarelo salta), música mais lenta e
//      abafada (passa-baixa). Outro K.O. nesse meio tempo (empate) também quebra.
//      No fim: clarão, as pistas param (pista.parar) e tudo volta ao normal.
//   2. A arena segue (caixas fecham, fimDaRodada) e, no começo de
//      resultado(), espera replay(): a transmissão (transmissao.js: tarja de
//      INSTANT REPLAY, placar, câmera lenta, close no coração, o coração
//      despedaçando, torcida, flashes) com as fotos do Gravador (gravador.js:
//      os últimos ~3 s das duas pistas). Mostra a pista de quem caiu (as duas no empate).
//   3. Depois o "P1 VENCEU!" de sempre e a PvpResultado.
//
// A ou B pula (botao(); o que sobrar da câmera lenta E o replay), com uma
// carência curta para quem estava apertando A no duelo não pular sem querer.
// Duelo (rodada bônus): o K.O. dele (nocauteDuelo) só ganha a câmera lenta
// (o duelo não acontece nas pistas: não há replay).
//
// A arena (PvpArena) usa:
//   this.fimDePartida = new FimDePartida(this, { campos: CAMPOS })   no create (depois das pistas)
//   fimDePartida.fator           multiplica o delta do jogo, tweens e timers (1 fora da câmera lenta)
//   fimDePartida.nocaute(j, k)   true = cuidou do K.O. (a arena não faz a quebra padrão)
//   fimDePartida.nocauteDuelo(j)
//   await fimDePartida.replay()  no começo de resultado()
//   fimDePartida.botao(botao)    true = o botão foi usado aqui
// Tudo (música, filtros de câmera, câmeras, texturas) é desfeito no fim e no shutdown.
export const LENTA = { congelaMs: 110, fator: 0.2, duracaoMs: 2300, duracaoDueloMs: 1600, carenciaMs: 600, carenciaDueloMs: 1200 }

export default class FimDePartida {
  constructor(arena, { campos }) {
    this.arena = arena
    this.campos = campos
    this.estado = 'jogo' // 'jogo' | 'lenta' | 'pronto' | 'replay' | 'fim'
    this.fatorAtual = 1
    this.relogio = 0
    this.mortos = [] // [{ j, k }] corações quebrados (k = pista)
    this.semReplay = false
    this.pulou = false
    this.objetos = []
    this.quebras = []
    this.fantasmas = []
    this.filtros = [] // [{ camera, filtro }]
    this.emissores = new Set()
    this.tv = null
    this.andamento = 1
    this.lentaPronta = Promise.resolve()
    this.gravador = new Gravador(arena, { pistas: arena.pistas, campos })
    prepararTexturasCoracao(arena)

    // a última bala que acertou cada pista (para o fantasma dela na câmera lenta)
    this.ultimaBala = arena.pistas.map(() => null)
    arena.pistas.forEach((pista, k) => {
      const original = pista.aoAcertar
      pista.aoAcertar = (dano, bala, coracao) => {
        this.ultimaBala[k] = { bala, fator: pista.balas.fatorVelocidade, maximo: pista.balas.velocidadeMax }
        return original?.(dano, bala, coracao)
      }
    })

    arena.events.on('update', this.aoAtualizar, this)
    arena.events.on('postupdate', this.aoPosAtualizar, this)
    arena.events.once('shutdown', () => this.destruir())
  }

  get fator() {
    return this.fatorAtual
  }

  // ---------- frame ----------

  // depois do update da arena (e do filtrarCaixas): a foto do quadro
  aoPosAtualizar(_, delta) {
    if (this.estado !== 'jogo') return
    const a = this.arena
    this.gravador.atualizar(delta * debug.acelerar, a.fase === 'esquiva' && a.pistas.some((p) => p.aberta) && !a.pausado)
  }

  // delta REAL (a câmera lenta e o replay andam no relógio de verdade)
  aoAtualizar(_, delta) {
    if (this.estado === 'lenta') this.atualizarLenta(delta)
    else if (this.estado === 'replay') this.tv?.atualizar(delta)
  }

  atualizarLenta(delta) {
    this.relogio += delta
    const congelado = this.relogio < LENTA.congelaMs
    this.fatorAtual = congelado ? 0 : LENTA.fator
    // partículas têm relógio próprio: também em câmera lenta
    for (const o of this.arena.children.list) {
      if (o.type !== 'ParticleEmitter') continue
      o.timeScale = this.fatorAtual
      this.emissores.add(o)
    }
    // fantasmas das balas que acertaram seguem a trajetória delas
    const s = (delta * this.fatorAtual * debug.acelerar) / 1000
    for (const f of this.fantasmas) {
      f.idade += s * 1000
      f.img.x += f.vx * s
      f.img.y += f.vy * s
      f.img.rotation += f.giro * s
      if (f.idade > 200) f.img.alpha = Math.max(0, f.alpha * (1 - (f.idade - 200) / 260))
    }
    if (this.relogio >= this.duracaoLenta) this.terminarLenta(false)
  }

  // ---------- 1. câmera lenta ----------

  comecarLenta({ duelo = false } = {}) {
    this.estado = 'lenta'
    this.relogio = 0
    this.fatorAtual = 0
    // "reduzir animações" encurta a câmera lenta (acessibilidade.js)
    this.duracaoLenta = (duelo ? LENTA.duracaoDueloMs : LENTA.duracaoMs) * fatores().lenta
    // no duelo todo mundo está martelando A (atacar): demora mais para o A pular
    this.carencia = duelo ? LENTA.carenciaDueloMs : LENTA.carenciaMs
    this.gravador.parar()
    this.lentaPronta = new Promise((r) => (this.resolverLenta = r))
    const a = this.arena
    tocar(a, 'cameraLenta')
    a.time.delayedCall(40, () => tocar(a, 'batidaLenta')) // no relógio lento: a 2ª batida vem devagar
    // música: mais lenta e abafada
    this.andamento = andamentoMusica()
    velocidadeMusica(this.andamento * 0.5)
    fitaMusica({ corte: 650 }, 220)
    flashTela(a, 0xffffff, 0.5, 180)
    shake(a, 220, 0.012)
    // véu escuro (o coração quebrando e o K.O. ficam acima dele) e vinheta
    const veu = a.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setDepth(29).setAlpha(0)
    const vinheta = a.add.image(LARGURA / 2, ALTURA / 2, 'vinheta').setTint(0x000000).setDisplaySize(LARGURA * 1.1, ALTURA * 1.15).setDepth(29).setAlpha(0)
    this.objetos.push(veu, vinheta)
    a.tweens.add({ targets: veu, alpha: 0.5, duration: 120 })
    a.tweens.add({ targets: vinheta, alpha: 0.9, duration: 120 })
    // dentro das caixas, as balas perdem a cor (o coração salta aos olhos).
    // Filtro de câmera só de enfeite: só nos gráficos no máximo
    for (const caixa of fatores().filtros ? caixasDe(a) : []) {
      const lista = caixa.camera.filters?.internal
      if (!lista) continue
      try {
        const filtro = lista.addColorMatrix()
        filtro.colorMatrix.saturate(-0.85)
        this.filtros.push({ camera: caixa.camera, filtro })
      } catch (erro) {
        console.warn('[fim da partida] filtro de cor indisponível:', erro)
      }
    }
  }

  terminarLenta(pulando) {
    if (this.estado !== 'lenta') return
    this.estado = 'pronto'
    this.fatorAtual = 1
    if (pulando) this.pulou = true
    const a = this.arena
    for (const o of this.emissores) if (o.scene) o.timeScale = 1
    this.emissores.clear()
    this.limparFiltros()
    this.fantasmas.forEach((f) => f.img.scene && f.img.destroy())
    this.fantasmas = []
    for (const o of this.objetos) if (o.scene) a.tweens.add({ targets: o, alpha: 0, duration: 260, onComplete: () => o.destroy() })
    this.objetos = []
    // acabou a luta: as balas somem sob um clarão
    if (a.fase === 'esquiva') {
      a.pistas.forEach((p) => p.parar())
      flashTela(a, 0xffffff, 0.3, 240)
    }
    velocidadeMusica(this.andamento)
    fitaMusica(undefined, 300)
    this.resolverLenta?.()
  }

  limparFiltros() {
    for (const { camera, filtro } of this.filtros) camera.filters?.internal.remove(filtro)
    this.filtros = []
  }

  // K.O. numa pista (k) do jogador j: true = tratado aqui
  nocaute(j, k) {
    if (this.estado === 'jogo') this.comecarLenta()
    else if (this.estado !== 'lenta') return false
    const a = this.arena
    const pista = a.pistas[k]
    const coracao = pista.coracoes[0]
    const cor = CORES.almas[j]
    this.quebras.push(quebrarCoracao(a, { x: coracao.x, y: coracao.y, cor, escala: coracao.sprite?.scaleX ?? ESCALA.coracao }))
    coracao.esconder()
    this.criarFantasma(k)
    a.avisoPista[k].setText('K.O.!').setColor(TEXTO.caido).setFontSize(20).setScale(2.4)
    a.tweens.add({ targets: a.avisoPista[k], scale: 1, duration: 60, ease: 'Back.easeOut' })
    this.mortos.push({ j, k })
    return true
  }

  // A bala do golpe some no acerto: uma cópia dela continua o caminho, devagar
  criarFantasma(k) {
    const info = this.ultimaBala[k]
    this.ultimaBala[k] = null
    const b = info?.bala
    if (!b?.sprite || b.atravessa) return // a que atravessa continua lá de verdade
    const s = b.sprite
    if (!s.texture) return
    const a = this.arena
    const img = a.add
      .image(s.x, s.y, s.texture.key, s.frame?.name)
      .setScale(s.scaleX, s.scaleY)
      .setRotation(s.rotation)
      .setDepth(s.depth)
      .setAlpha(Math.max(0.6, s.alpha))
      .setBlendMode(s.blendMode)
    if (s.tintTopLeft !== undefined) img.setTint(s.tintTopLeft)
    a.pistas[k].caixa.recortar(img)
    let vx = (b.vx ?? 0) * info.fator
    let vy = (b.vy ?? 0) * info.fator
    const v = Math.hypot(vx, vy)
    if (v > info.maximo) {
      vx *= info.maximo / v
      vy *= info.maximo / v
    }
    this.fantasmas.push({ img, vx, vy, giro: b.tipo === 'segmento' ? b.girar ?? 0 : 0, idade: 0, alpha: img.alpha })
  }

  // K.O. no duelo: o próprio duelo quebra o coração; aqui só a câmera lenta
  nocauteDuelo() {
    if (this.estado !== 'jogo') return
    this.semReplay = true
    this.comecarLenta({ duelo: true })
  }

  // ---------- 2. replay ----------

  async replay() {
    if (this.estado === 'jogo' || this.estado === 'fim') return
    await this.lentaPronta
    if (this.arena.saindo || this.estado !== 'pronto') return
    const ks = [...new Set(this.mortos.map((m) => m.k))].sort()
    const quadros = this.gravador.quadrosEmOrdem().filter((q) => ks.some((k) => q.pistas[k]))
    if (this.pulou || this.semReplay || !ks.length || quadros.length < 12) {
      this.estado = 'fim'
      return
    }
    const a = this.arena
    const jogadores = [0, 1].map((j) => {
      const p = PERSONAGENS[a.ids?.[j]]
      return { rotulo: a.rotulo(j), nome: p?.nome ?? `P${j + 1}`, cor: p?.cor ?? CORES.almas[j], hp: Math.max(0, Math.round(a.estado?.jogadores[j]?.hp ?? 0)) }
    })
    this.estado = 'replay'
    this.tv = new Transmissao(a, { quadros, pistas: ks, campos: this.campos, mortos: this.mortos, jogadores, arena: a.arena, andamento: andamentoMusica() })
    await this.tv.tocar()
    this.tv = null
    this.estado = 'fim'
  }

  // ---------- pular ----------

  botao() {
    if (this.estado === 'lenta') {
      if (this.relogio > this.carencia) this.terminarLenta(true)
      return true
    }
    if (this.estado === 'replay') {
      if (this.tv && this.tv.tempo > 350) this.tv.encerrar()
      return true
    }
    // entre a câmera lenta e o replay: o botão pula o replay que vem
    if (this.estado === 'pronto') {
      this.pulou = true
      return true
    }
    return false
  }

  // ---------- saída da cena ----------

  destruir() {
    if (this.estado === 'destruido') return
    const lenta = this.estado === 'lenta'
    this.estado = 'destruido'
    this.fatorAtual = 1
    this.arena.events.off('update', this.aoAtualizar, this)
    this.arena.events.off('postupdate', this.aoPosAtualizar, this)
    this.tv?.encerrar()
    this.tv = null
    calarTransmissao(600) // a torcida que ainda estava comemorando
    this.limparFiltros()
    this.quebras.forEach((q) => q.destruir())
    this.quebras = []
    if (lenta) {
      velocidadeMusica(this.andamento)
      this.resolverLenta?.()
    }
    fitaMusica(undefined, 100)
    this.gravador.destruir()
  }
}
