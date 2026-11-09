import Phaser from 'phaser'
import { PERSONAGENS } from '../data/personagens.js'
import { CHEFES } from '../coop/chefes/index.js'
import { ARENA } from '../pvp/arenas.js'
import { MODOS_PARTY, ehPvp } from '../party/regras.js'
import { normalizarPlacar, lider, manchete, rotuloPontos } from '../party/placar.js'
import { vigiarParty } from '../party/cliente.js'
import { desenharCoroa } from '../party/coroa.js'
import { criarFundo } from '../backgrounds/index.js'
import { arteElenco } from '../arte/elenco.js'
import { ESCALA } from '../arte/texturas.js'
import { tocar } from '../audio.js'
import { claraoCamera } from '../effects/flash.js'
import { estilhacos } from '../effects/entrada.js'
import { fatores } from '../acessibilidade.js'
import { FONTE, LARGURA, ALTURA, TEXTO, corTexto } from '../constants.js'
import { emRede, souHostDaRede, irParaCena, participantesDaPartida } from '../rede.js'
import { corDaVaga, textoDaVaga } from '../vagas.js'
import { desenharForma, formaDaVaga, nomeNoCoracao } from '../coop/marcadores.js'

// MODO PARTY: a apresentação antes de cada partida (depois da votação do mapa, antes da arena ou do nível
// do CO-OP). O modo e o mapa (ou o chefe) no topo, os lutadores entrando um por um com a arte grande, o
// placar da party em cada um (pontos, a coroa do líder, a sequência de vitórias), o VS e a contagem
// 3, 2, 1. O HOST manda esta cena com o destino de verdade nos dados e, quando a contagem acaba, leva todos
// para lá (os outros só assistem). Com "reduzir animações": sem tremer, sem clarão.
//
//   irParaCena(this, 'PartyIntro', { modo, vencedora, lista, times, numero, placar, destino: { cena, dados } })
//     lista[vaga] = id do personagem · times[vaga] = 0 | 1 (2x2) · placar: party/placar.js
//
// No dev: window.partyIntro.

const COR_TIME = [0x4ab0ff, 0xffa040]
const TEXTO_TIME = ['#7cc8ff', '#ffb870']
const PALCO = { topo: 112, base: 392 } // onde ficam os lutadores (a arte apoia o pé na base)
const ENTRADA_MS = 520 // quando o primeiro lutador entra
const ENTRE_MS = 300 // e o intervalo até o próximo
const CONTA_MS = 620 // cada número da contagem

export default class PartyIntro extends Phaser.Scene {
  constructor() {
    super('PartyIntro')
  }

  // (a instância da cena é reaproveitada: tudo volta ao inicial a cada abertura)
  init(dados) {
    this.dados = dados ?? {}
    this.saindo = false
    this.lutadores = []
    this.chefe = null
    this.manchete = null
  }

  create() {
    const d = this.dados
    if (!emRede() || !d.destino?.cena || !Array.isArray(d.lista)) return this.scene.start('Lan')
    this.calmo = !fatores().piscar
    this.souHost = souHostDaRede()
    this.modo = d.modo
    this.pvp = ehPvp(d.modo)
    this.placar = normalizarPlacar(d.placar)
    this.participantes = participantesDaPartida().filter((p) => PERSONAGENS[d.lista[p.indice]])
    this.vagas = this.participantes.map((p) => p.indice)
    this.coroa = lider(this.placar, this.vagas)

    const chefe = !this.pvp ? CHEFES[d.vencedora] : null
    this.fundo = criarFundo(this, this.pvp ? 'queen' : 'king', 1.6)
    this.add.rectangle(0, 0, LARGURA, ALTURA, 0x05040c, 0.62).setOrigin(0).setDepth(-4)
    this.velocidade = this.add.graphics().setDepth(-3)

    this.montarTopo(chefe)
    const posicoes = this.posicoes(Boolean(chefe))
    this.participantes.forEach((p, k) => this.lutadores.push(this.montarLutador(p, posicoes[k], k)))
    if (chefe) this.montarChefe(chefe)

    // a linha do tempo: lutadores, VS, contagem e a partida
    tocar(this, 'tensao')
    this.lutadores.forEach((l, k) => this.time.delayedCall(ENTRADA_MS + k * ENTRE_MS, () => this.entrar(l)))
    const fimEntrada = ENTRADA_MS + this.lutadores.length * ENTRE_MS + (chefe ? ENTRE_MS + 120 : 0)
    if (chefe) this.time.delayedCall(ENTRADA_MS + this.lutadores.length * ENTRE_MS + 60, () => this.entrarChefe())
    this.time.delayedCall(fimEntrada + 120, () => this.carimbarVs())
    this.time.delayedCall(fimEntrada + 520, () => this.contar())

    vigiarParty(this)
    if (import.meta.env.DEV) window.partyIntro = this
    this.events.once('shutdown', () => {
      this.fundo?.destruir()
      if (window.partyIntro === this) delete window.partyIntro
    })
    this.cameras.main.fadeIn(200)
  }

  texto(x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) {
    return this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4, ...extra }).setOrigin(0.5)
  }

  // ---------- montagem ----------

  infoDoModo(chefe) {
    if (chefe?.semanal) return { titulo: 'BOSS SEMANAL', cor: MODOS_PARTY.semanal.cor, sub: `contra ${chefe.nome.toUpperCase()}` }
    if (chefe) return { titulo: 'CO-OP · CONTRA O CHEFE', cor: MODOS_PARTY.coop4.cor, sub: `contra ${chefe.nome.toUpperCase()}` }
    const arena = ARENA[this.dados.vencedora]
    const m = MODOS_PARTY[this.modo] ?? MODOS_PARTY.ffa
    const titulo = this.modo === '2x2' ? '2x2 · EQUIPES' : 'TODOS CONTRA TODOS'
    return { titulo, cor: m.cor, sub: arena ? `arena: ${arena.nome.toUpperCase()}` : '' }
  }

  montarTopo(chefe) {
    const info = this.infoDoModo(chefe)
    const numero = Number.isFinite(this.dados.numero) ? this.dados.numero : this.placar.partidas + 1
    const faixa = this.add.rectangle(0, 58, LARGURA, 74, info.cor, 0.16).setOrigin(0, 0.5).setDepth(1)
    const filete = this.add.rectangle(0, 95, LARGURA, 3, info.cor, 0.9).setOrigin(0, 0.5).setDepth(1)
    const rotulo = this.texto(LARGURA / 2, 20, `PARTY · PARTIDA ${numero}`, 13, TEXTO.selecionado, { strokeThickness: 3 }).setDepth(2)
    const titulo = this.texto(LARGURA / 2, 50, info.titulo, 34, corTexto(info.cor), { strokeThickness: 6 }).setDepth(2)
    const sub = this.texto(LARGURA / 2, 80, info.sub, 13, '#e8e8f4', { strokeThickness: 3 }).setDepth(2)
    // a rivalidade: a frase do placar, no rodapé
    const nomeDe = (v) => nomeNoCoracao(this.participantes.find((p) => p.indice === v)?.nome ?? `P${v + 1}`, 10)
    this.manchete = this.texto(LARGURA / 2, ALTURA - 26, manchete(this.placar, this.vagas, nomeDe), 13, '#ffd27a', { strokeThickness: 3 }).setDepth(2).setAlpha(0)
    if (this.calmo) return
    for (const o of [faixa, filete]) this.tweens.add({ targets: o, scaleX: { from: 0, to: 1 }, duration: 260, ease: 'Cubic.easeOut' })
    this.tweens.add({ targets: titulo, scale: { from: 2.2, to: 1 }, alpha: { from: 0, to: 1 }, duration: 300, delay: 120, ease: 'Back.easeOut' })
    for (const o of [rotulo, sub]) this.tweens.add({ targets: o, alpha: { from: 0, to: 1 }, duration: 240, delay: 260 })
  }

  // x de cada lutador (na ordem dos participantes) e a largura da coluna dele
  posicoes(comChefe) {
    const n = this.participantes.length
    if (this.modo === '2x2') {
      // TIME A à esquerda, TIME B à direita, o VS no meio
      const times = this.dados.times ?? []
      const lados = [[], []]
      this.participantes.forEach((p, k) => lados[times[p.indice] === 1 ? 1 : 0].push(k))
      // (de fora para dentro: com 2 no time, 110 e 270 da borda; sozinho, 190)
      const pos = []
      lados.forEach((ks, t) =>
        ks.forEach((k, i) => {
          const daBorda = ks.length > 1 ? 110 + i * 160 : 190
          pos[k] = { x: t === 0 ? daBorda : LARGURA - daBorda, largura: 160, time: t }
        }),
      )
      return pos
    }
    const esquerda = 40
    const direita = comChefe ? 560 : LARGURA - 40
    const largura = (direita - esquerda) / n
    return this.participantes.map((_, k) => ({ x: esquerda + largura * (k + 0.5), largura }))
  }

  montarLutador(p, pos, k) {
    const v = p.indice
    const id = this.dados.lista[v]
    const def = PERSONAGENS[id]
    const cor = pos.time != null ? COR_TIME[pos.time] : corDaVaga(v)
    const altura = Math.min(250, pos.largura * 1.55)
    const c = this.add.container(pos.x, 0).setDepth(4 + k)

    // o painel inclinado com a cor da vaga (ou do time) atrás do lutador
    const painel = this.add.graphics()
    const meia = pos.largura / 2 - 6
    const inc = 22
    painel.fillStyle(cor, 0.2).fillPoints([{ x: -meia + inc, y: PALCO.topo }, { x: meia + inc, y: PALCO.topo }, { x: meia - inc, y: PALCO.base + 46 }, { x: -meia - inc, y: PALCO.base + 46 }], true)
    painel.lineStyle(2, cor, 0.85).lineBetween(-meia + inc, PALCO.topo, meia + inc, PALCO.topo)
    const luz = this.add.image(0, PALCO.base - altura * 0.45, 'brilho').setDisplaySize(pos.largura * 1.3, altura).setTint(def.cor).setAlpha(0.3)
    const chave = this.textures.exists(arteElenco(id, 'guarda')) ? arteElenco(id, 'guarda') : id
    const arte = this.add.image(0, PALCO.base, chave).setOrigin(0.5, 1)
    arte.setScale(altura / arte.height)
    // (o 2x2 olha para o meio: o TIME B espelhado)
    if (pos.time === 1) arte.setFlipX(true)

    const nome = this.add.text(8, PALCO.base + 12, nomeNoCoracao(p.nome, 10), { fontFamily: FONTE, fontSize: '15px', color: textoDaVaga(v), stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5)
    const forma = this.add.graphics()
    desenharForma(forma, formaDaVaga(v), -nome.width / 2 - 4, PALCO.base + 12, 6, corDaVaga(v))
    const personagem = this.add.text(0, PALCO.base + 31, def.nome.toUpperCase(), { fontFamily: FONTE, fontSize: '12px', color: corTexto(def.cor), stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
    const objetos = [painel, luz, arte, forma, nome, personagem]

    // o placar: pontos, a coroa do líder e a sequência
    const pontos = this.placar.pontos[v] ?? 0
    if (this.placar.partidas) {
      const pts = this.add.text(meia - 4, PALCO.topo + 14, rotuloPontos(pontos), { fontFamily: FONTE, fontSize: '13px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(1, 0.5)
      objetos.push(pts)
    }
    if (this.coroa === v) {
      const topoArte = PALCO.base - altura * 0.92
      const g = this.add.graphics()
      desenharCoroa(g, 0, topoArte - 6, 18)
      objetos.push(g)
      if (!this.calmo) this.tweens.add({ targets: g, y: '-=3', duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
    const seq = this.placar.sequencia[v] ?? 0
    if (seq >= 2) {
      const fogo = this.add.text(-meia + inc + 4, PALCO.topo + 14, `${seq} SEGUIDAS`, { fontFamily: FONTE, fontSize: '11px', color: '#ff8a3a', stroke: '#000000', strokeThickness: 3 }).setOrigin(0, 0.5)
      objetos.push(fogo)
      if (!this.calmo) this.tweens.add({ targets: fogo, alpha: 0.45, duration: 260, yoyo: true, repeat: -1 })
    }
    c.add(objetos)
    c.setAlpha(0)
    return { c, x: pos.x, cor, arte, lado: pos.time ?? (k % 2) }
  }

  montarChefe(chefe) {
    const x = 712
    const c = this.add.container(x, 0).setDepth(3)
    const cor = 0xff3d6e
    const g = this.add.graphics()
    g.fillStyle(cor, 0.16).fillPoints([{ x: -110, y: PALCO.topo }, { x: 130, y: PALCO.topo }, { x: 110, y: PALCO.base + 46 }, { x: -130, y: PALCO.base + 46 }], true)
    g.lineStyle(2, cor, 0.85).lineBetween(-110, PALCO.topo, 130, PALCO.topo)
    const objetos = [g]
    if (this.textures.exists(chefe.sprite)) {
      const s = this.add.image(0, PALCO.base - 4, chefe.sprite).setOrigin(0.5, 1)
      s.setScale(Math.min(ESCALA.chefe * 1.1, 230 / s.height, 210 / s.width))
      objetos.push(s)
    }
    objetos.push(this.add.text(0, PALCO.base + 20, chefe.nome.toUpperCase(), { fontFamily: FONTE, fontSize: '20px', color: '#ff7a9a', stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5))
    if (this.placar.chefes) objetos.push(this.add.text(0, PALCO.topo + 14, `${this.placar.chefes} CHEFE${this.placar.chefes > 1 ? 'S' : ''} JÁ CAÍRAM`, { fontFamily: FONTE, fontSize: '11px', color: '#9fe8ff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5))
    c.add(objetos)
    c.setAlpha(0)
    this.chefe = { c, x }
  }

  // ---------- animação ----------

  entrar(l) {
    if (this.saindo) return
    tocar(this, 'impacto')
    if (this.calmo) return l.c.setAlpha(1)
    const de = l.lado === 1 ? 260 : -260
    l.c.setX(l.x + de)
    this.tweens.add({ targets: l.c, x: l.x, alpha: 1, duration: 260, ease: 'Back.easeOut' })
    this.tweens.add({ targets: l.arte, scaleY: { from: l.arte.scaleY * 1.08, to: l.arte.scaleY }, duration: 300, delay: 200, ease: 'Bounce.easeOut' })
    this.time.delayedCall(240, () => {
      this.cameras.main.shake(110, 0.006)
      estilhacos(this, l.x, PALCO.base - 4, { quantidade: 10, cores: [l.cor, 0xffffff], profundidade: 12, duracao: 420 })
    })
  }

  entrarChefe() {
    if (this.saindo || !this.chefe) return
    tocar(this, 'trovao')
    if (this.calmo) return this.chefe.c.setAlpha(1)
    this.chefe.c.setY(-40)
    this.tweens.add({ targets: this.chefe.c, y: 0, alpha: 1, duration: 340, ease: 'Bounce.easeOut' })
    this.time.delayedCall(320, () => this.cameras.main.shake(220, 0.012))
  }

  // o VS no meio (2x2 e CO-OP: entre os lados; todos contra todos: entre cada dupla de vizinhos)
  carimbarVs() {
    if (this.saindo) return
    tocar(this, 'carimbo')
    const xs =
      this.modo === '2x2' ? [LARGURA / 2] : this.chefe ? [(this.lutadores.at(-1).x + this.chefe.x) / 2 + 10] : this.lutadores.slice(1).map((l, k) => (l.x + this.lutadores[k].x) / 2)
    const grande = xs.length === 1
    for (const x of xs) {
      const vs = this.texto(x, (PALCO.topo + PALCO.base) / 2, 'VS', grande ? 64 : 34, '#ffe14a', { strokeThickness: grande ? 9 : 6 }).setDepth(20).setAngle(-8)
      if (!this.calmo) this.tweens.add({ targets: vs, scale: { from: 3, to: 1 }, alpha: { from: 0, to: 1 }, duration: 220, ease: 'Back.easeOut' })
    }
    // 2x2: o nome de cada time embaixo do VS, na cor dele
    if (this.modo === '2x2')
      ['TIME A', 'TIME B'].forEach((s, t) => {
        const r = this.texto(LARGURA / 2 + (t ? 44 : -44), (PALCO.topo + PALCO.base) / 2 + 50, s, 14, TEXTO_TIME[t], { strokeThickness: 4 }).setDepth(20)
        if (!this.calmo) this.tweens.add({ targets: r, alpha: { from: 0, to: 1 }, x: { from: r.x + (t ? 40 : -40), to: r.x }, duration: 240, delay: 120 })
      })
    if (!this.calmo) claraoCamera(this.cameras.main, 120, 255, 240, 160)
    this.tweens.add({ targets: this.manchete, alpha: 1, duration: 300 })
  }

  contar() {
    const passos = ['3', '2', '1', this.pvp ? 'LUTEM!' : 'AO CHEFE!']
    passos.forEach((s, k) =>
      this.time.delayedCall(k * CONTA_MS, () => {
        if (this.saindo) return
        const ultimo = k === passos.length - 1
        tocar(this, ultimo ? 'contadorFim' : 'contador')
        const t = this.texto(LARGURA / 2, (PALCO.topo + PALCO.base) / 2 - 6, s, ultimo ? 76 : 110, ultimo ? '#ffffff' : '#ffe14a', { strokeThickness: 10 }).setDepth(30)
        if (this.calmo) return this.time.delayedCall(CONTA_MS - 60, () => t.destroy())
        this.tweens.add({ targets: t, scale: { from: 2.4, to: 1 }, alpha: { from: 0, to: 1 }, duration: 180, ease: 'Back.easeOut' })
        this.tweens.add({ targets: t, alpha: 0, scale: 0.7, delay: CONTA_MS - 200, duration: 160, onComplete: () => t.destroy() })
        if (ultimo) {
          claraoCamera(this.cameras.main, 180, 255, 255, 255)
          this.cameras.main.shake(200, 0.01)
        }
      }),
    )
    this.time.delayedCall(passos.length * CONTA_MS - 80, () => this.seguir())
  }

  // host: a partida de verdade, em todos
  seguir() {
    if (this.saindo) return
    this.saindo = true
    this.cameras.main.fadeOut(180, 0, 0, 0)
    if (!this.souHost) return
    const { cena, dados } = this.dados.destino
    this.time.delayedCall(200, () => irParaCena(this, cena, dados ?? {}))
  }

  update(time, delta) {
    this.fundo?.atualizar(delta)
    // linhas de velocidade passando atrás de tudo
    if (this.calmo) return
    const g = this.velocidade.clear()
    for (let k = 0; k < 14; k++) {
      const y = 110 + ((k * 53) % 300)
      const x = ((time * (0.5 + (k % 4) * 0.22) + k * 137) % (LARGURA + 300)) - 150
      g.fillStyle(k % 3 ? 0xffffff : 0xffe14a, 0.05 + (k % 3) * 0.02).fillRect(LARGURA - x, y, 90 + (k % 5) * 30, 2)
    }
  }

  // testes/console
  estadoDebug() {
    return { modo: this.modo, destino: this.dados.destino?.cena, vagas: [...this.vagas], lider: this.coroa, saindo: this.saindo, host: this.souHost }
  }
}
