import Phaser from 'phaser'
import Controles from '../controles.js'
import { ARENAS, ARENA, ALEATORIA, apurarVotos, eventosDaArena } from '../pvp/arenas.js'
import { criarRng } from '../pvp/baralho.js'
import { criarFundo } from '../backgrounds/index.js'
import { tocar, musica } from '../audio.js'
import { estilhacos } from '../effects/entrada.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO, corTexto } from '../constants.js'

// Votação da arena do PvP (PvpEscolha -> PvpVoto -> PvpArena).
//   Um cartão por arena (pvp/arenas.js) e o "?" (ALEATÓRIA: vale como voto numa
//   arena sorteada na apuração). Cada jogador move o próprio coração (←/→) e
//   vota (A); B desfaz o voto. Contra a CPU só o P1 vota (a CPU segue o voto).
//   O fundo da tela é o fundo animado da arena em foco; o painel de baixo
//   mostra a descrição, a música e as rodadas bônus dela.
//   Quando todos votam (ou o tempo acaba: quem não votou fica de fora):
//   apuração (apurarVotos): o "?" embaralha e revela a arena dele; empate =
//   roleta entre as empatadas; a vencedora cresce no meio da tela e a partida
//   começa (registry 'pvp'.arena guarda a escolha para a revanche).
//
// No dev: debugJogo.jogo.scene.start('PvpVoto', { p1: 'kris', p2: 'dess' })
// e window.pvpVoto (votar(j, id), estadoDebug()).

const TEMPO_MS = 12000
const CARTAO = { y: 142, largura: 80, altura: 112, espaco: 6 }
const PAINEL = { x: 22, y: 232, largura: LARGURA - 44, altura: 196 }
const VEU = 0.42 // véu escuro por cima do fundo da arena (o texto precisa ler)

export default class PvpVoto extends Phaser.Scene {
  constructor() {
    super('PvpVoto')
  }

  init(dados) {
    const salvo = this.registry.get('pvp') ?? {}
    this.p1 = dados?.p1 ?? salvo.p1 ?? 'kris'
    this.p2 = dados?.p2 ?? salvo.p2 ?? 'susie'
  }

  create() {
    this.controles = new Controles(this)
    this.controles.onBotao((j, botao) => (botao === 'A' ? this.votar(j) : this.desfazer(j)))
    this.solo = this.controles.numJogadores === 1
    this.eleitores = this.solo ? [0] : [0, 1]
    this.opcoes = [...ARENAS.map((a) => a.id), ALEATORIA]
    this.votos = [null, null]
    this.restante = TEMPO_MS
    this.apurando = false
    this.fundo = null
    this.fundoId = null
    this.focoDe = 0 // jogador que mexeu por último (o painel mostra o foco dele)

    this.veu = this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000, VEU).setOrigin(0).setDepth(-4)
    this.texto = (x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) =>
      this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra }).setOrigin(0.5)

    this.titulo = this.texto(LARGURA / 2, 20, 'PVP  ·  VOTE NA ARENA', 24, TEXTO.normal, { strokeThickness: 4 })
    this.status = this.texto(LARGURA / 2, 44, this.solo ? 'contra a CPU: você escolhe a arena' : 'cada um vota na sua: a mais votada ganha (empate = roleta)', 12, TEXTO.selecionado)
    this.barra = this.add.graphics().setDepth(2)

    this.montarCartoes()
    this.montarPainel()
    this.cursores = this.eleitores.map((j) => ({
      j,
      indice: j === 0 ? 0 : 1,
      coracao: this.add.image(0, 0, 'coracao').setTint(CORES.almas[j]).setScale(1.3).setDepth(6),
    }))
    const salvo = this.registry.get('pvp')?.arena
    if (ARENA[salvo]) this.cursores[0].indice = this.opcoes.indexOf(salvo)
    this.dica = this.texto(LARGURA / 2, ALTURA - 14, '← → escolher     A: votar     B: desfazer', 13, TEXTO.desabilitado, { strokeThickness: 0 })

    this.trocarFundo(this.opcoes[this.cursores[0].indice])
    this.atualizarTela()

    if (import.meta.env.DEV) window.pvpVoto = this
    this.events.once('shutdown', () => {
      this.fundo?.destruir()
      if (window.pvpVoto === this) delete window.pvpVoto
    })
    musica('pvpEscolha')
    this.cameras.main.fadeIn(250)
  }

  // ---------- montagem ----------

  montarCartoes() {
    const n = this.opcoes.length
    const total = n * CARTAO.largura + (n - 1) * CARTAO.espaco
    this.cartoes = this.opcoes.map((id, i) => {
      const arena = ARENA[id]
      const cor = arena?.cor ?? 0xffffff
      const x = (LARGURA - total) / 2 + CARTAO.largura / 2 + i * (CARTAO.largura + CARTAO.espaco)
      const c = this.add.container(x, CARTAO.y).setDepth(3)
      const brilho = this.add.rectangle(0, 0, CARTAO.largura + 10, CARTAO.altura + 10, cor, 0).setStrokeStyle(3, cor, 0)
      const moldura = this.add.rectangle(0, 0, CARTAO.largura, CARTAO.altura, CORES.painel, 0.9).setStrokeStyle(2, cor, 0.6)
      const faixa = this.add.rectangle(0, CARTAO.altura / 2 - 15, CARTAO.largura - 6, 24, cor, 0.18)
      const icone = this.add.graphics()
      desenharIcone(icone, id, 0, -12, cor)
      const nome = this.add.text(0, CARTAO.altura / 2 - 15, arena?.curto ?? 'ALEATÓRIA', { fontFamily: FONTE, fontSize: '11px', color: corTexto(cor), stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
      if (nome.width > CARTAO.largura - 8) nome.setFontSize(9)
      c.add([brilho, moldura, faixa, icone, nome])
      // selos de voto ("P1"/"P2"), nos cantos de cima
      const selos = [0, 1].map((j) => {
        const sx = (j === 0 ? -1 : 1) * (CARTAO.largura / 2 - 14)
        const fundo = this.add.rectangle(sx, -CARTAO.altura / 2 + 11, 24, 14, CORES.almas[j]).setStrokeStyle(2, 0x000000).setVisible(false)
        const rotulo = this.add.text(sx, fundo.y, `P${j + 1}`, { fontFamily: FONTE, fontSize: '10px', color: '#000000' }).setOrigin(0.5).setVisible(false)
        c.add([fundo, rotulo])
        return { fundo, rotulo }
      })
      return { id, x, c, brilho, moldura, icone, nome, selos, cor }
    })
  }

  montarPainel() {
    const p = PAINEL
    const fundoPainel = this.add.rectangle(p.x, p.y, p.largura, p.altura, CORES.painel, 0.86).setOrigin(0).setStrokeStyle(2, 0xffffff, 0.15).setDepth(2)
    const estilo = (tamanho, cor = TEXTO.normal) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 2 })
    this.painel = {
      nome: this.add.text(p.x + 14, p.y + 10, '', estilo(22)).setDepth(3),
      musica: this.add.text(p.x + p.largura - 14, p.y + 16, '', estilo(12, '#b8b8c8')).setOrigin(1, 0).setDepth(3),
      descricao: this.add.text(p.x + 14, p.y + 40, '', { ...estilo(12, '#d8d8e8'), wordWrap: { width: p.largura - 28 } }).setDepth(3),
      rotuloBonus: this.add.text(p.x + 14, p.y + 64, 'RODADAS BÔNUS', estilo(11, '#9a9aae')).setDepth(3),
      bonus: Array.from({ length: 14 }, (_, k) =>
        this.add.text(p.x + 14 + (k % 2) * (p.largura / 2), p.y + 82 + Math.floor(k / 2) * 15, '', estilo(12)).setDepth(3),
      ),
    }
    const { nome, musica: m, descricao, rotuloBonus, bonus } = this.painel
    this.painel.todos = [fundoPainel, nome, m, descricao, rotuloBonus, ...bonus]
  }

  // ---------- regras ----------

  votar(j, id = null) {
    if (this.apurando || !this.eleitores.includes(j)) return
    const cursor = this.cursores[this.eleitores.indexOf(j)]
    if (id) cursor.indice = this.opcoes.indexOf(id)
    if (this.votos[j]) return
    this.votos[j] = this.opcoes[cursor.indice]
    tocar(this, 'confirmar')
    const cartao = this.cartoes[cursor.indice]
    this.tweens.add({ targets: cartao.c, scale: 1.14, duration: 90, yoyo: true })
    this.atualizarTela()
    if (this.eleitores.every((e) => this.votos[e])) this.time.delayedCall(350, () => this.apurar())
  }

  desfazer(j) {
    if (this.apurando || !this.votos[j]) return
    this.votos[j] = null
    tocar(this, 'cancelar')
    this.atualizarTela()
  }

  mover(j, passo) {
    const cursor = this.cursores[this.eleitores.indexOf(j)]
    if (!cursor || this.votos[j]) return
    cursor.indice = (cursor.indice + passo + this.opcoes.length) % this.opcoes.length
    this.focoDe = j
    tocar(this, 'mover')
    this.trocarFundo(this.opcoes[cursor.indice])
    this.atualizarTela()
  }

  // o fundo animado acompanha o cartão em foco (o "?" mostra o castelo, escurecido)
  trocarFundo(id) {
    const fundoId = ARENA[id] ? id : 'castelo'
    const veu = ARENA[id] ? VEU : 0.75
    this.tweens.killTweensOf(this.veu)
    if (fundoId !== this.fundoId) {
      this.fundoId = fundoId
      this.fundo?.destruir()
      this.fundo = criarFundo(this, `arena-${fundoId}`)
      this.veu.setAlpha(1)
    }
    this.tweens.add({ targets: this.veu, alpha: veu, duration: 260 })
  }

  // ---------- apuração ----------

  async apurar() {
    if (this.apurando) return
    this.apurando = true
    this.cursores.forEach((c) => c.coracao.setVisible(false))
    this.dica.setText('')
    this.status.setText('APURAÇÃO!')
    this.tweens.add({ targets: this.status, scale: { from: 1.4, to: 1 }, duration: 200, ease: 'Back.easeOut' })
    const r = apurarVotos(this.votos, criarRng(`voto:${Date.now()}`))
    const esperar = (ms) => new Promise((ok) => this.time.delayedCall(ms, ok))
    await esperar(400)

    // 1. cada "?" embaralha e revela a arena dele (o selo pula para lá)
    for (const j of [0, 1]) {
      if (this.votos[j] !== ALEATORIA) continue
      await this.embaralharInterrogacao(r.sorteios[j], esperar)
      this.votos[j] = r.sorteios[j]
      this.atualizarTela()
      await esperar(300)
    }

    // 2. empate: roleta entre as empatadas
    if (r.empatadas.length > 1) {
      this.status.setText(Object.keys(r.contagem).length ? 'EMPATE! ROLETA!' : 'NINGUÉM VOTOU: ROLETA!')
      await this.roleta(r.empatadas, r.arena, esperar)
    }

    // 3. a vencedora
    await this.revelar(r.arena, esperar)
  }

  async embaralharInterrogacao(destino, esperar) {
    const q = this.cartoes[this.opcoes.indexOf(ALEATORIA)]
    tocar(this, 'roletaGiro', { duracao: 1 })
    const ids = ARENAS.map((a) => a.id)
    let atraso = 50
    for (let k = 0; k < 14; k++) {
      const id = k === 13 ? destino : ids[k % ids.length]
      q.icone.clear()
      desenharIcone(q.icone, id, 0, -12, ARENA[id].cor)
      q.nome.setText(ARENA[id].curto).setColor(corTexto(ARENA[id].cor)).setFontSize(ARENA[id].curto.length > 8 ? 9 : 11)
      tocar(this, 'roleta')
      await esperar(atraso)
      atraso *= 1.18
    }
    tocar(this, 'roletaFim')
    this.tweens.add({ targets: q.c, scale: 1.2, duration: 120, yoyo: true })
    await esperar(450)
    // o "?" volta a ser "?"
    q.icone.clear()
    desenharIcone(q.icone, ALEATORIA, 0, -12, 0xffffff)
    q.nome.setText('ALEATÓRIA').setColor('#ffffff').setFontSize(9)
  }

  async roleta(empatadas, vencedora, esperar) {
    const cartoes = empatadas.map((id) => this.cartoes[this.opcoes.indexOf(id)])
    tocar(this, 'roletaGiro', { duracao: 2.2 })
    const voltas = 3 * cartoes.length + cartoes.indexOf(this.cartoes[this.opcoes.indexOf(vencedora)])
    let atraso = 70
    for (let k = 0; k <= voltas; k++) {
      const atual = cartoes[k % cartoes.length]
      this.realcar(atual)
      tocar(this, 'roleta')
      await esperar(atraso)
      atraso = Math.min(420, atraso * 1.12)
    }
    tocar(this, 'roletaFim')
  }

  realcar(cartao) {
    for (const c of this.cartoes) {
      const sim = c === cartao
      c.brilho.setStrokeStyle(3, c.cor, sim ? 1 : 0).setFillStyle(c.cor, sim ? 0.25 : 0)
      c.c.setScale(sim ? 1.12 : 1).setY(CARTAO.y - (sim ? 8 : 0))
    }
  }

  async revelar(id, esperar) {
    const arena = ARENA[id]
    const cartao = this.cartoes[this.opcoes.indexOf(id)]
    this.trocarFundo(id)
    this.realcar(cartao)
    // o painel e o título saem: a tela é da arena vencedora
    this.tweens.add({ targets: [...this.painel.todos, this.titulo, this.barra], alpha: 0, duration: 250 })
    // os outros cartões caem; o vencedor vai para o meio e cresce
    this.cartoes.forEach((c, i) => {
      if (c !== cartao) this.tweens.add({ targets: c.c, y: ALTURA + 100, angle: (i % 2 ? 1 : -1) * 25, alpha: 0, duration: 420, delay: i * 30, ease: 'Back.easeIn' })
    })
    tocar(this, 'voo')
    cartao.c.setDepth(10)
    this.tweens.add({ targets: cartao.c, x: LARGURA / 2, y: 190, scale: 1.7, duration: 480, ease: 'Cubic.easeOut' })
    await esperar(500)
    tocar(this, 'impacto')
    this.cameras.main.flash(160, 255, 255, 255)
    this.cameras.main.shake(260, 0.014)
    estilhacos(this, LARGURA / 2, 190, { quantidade: 30, cores: [arena.cor, 0xffffff, CORES.almas[0], CORES.almas[1]], profundidade: 11, duracao: 700 })
    const nome = this.texto(LARGURA / 2, 345, arena.nome, arena.nome.length > 12 ? 30 : 44, corTexto(arena.cor), { strokeThickness: 7 }).setDepth(12).setScale(3).setAlpha(0)
    const sub = this.texto(LARGURA / 2, 382, arena.tituloMusica ? `♪ ${arena.tituloMusica}` : arena.descricao, 13, '#d8d8e8').setDepth(12).setAlpha(0)
    this.tweens.add({ targets: sub, alpha: 1, delay: 250, duration: 300 })
    this.tweens.add({ targets: nome, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' })
    this.status.setText('A ARENA É...').setY(60)
    tocar(this, 'fanfarra')
    this.tweens.add({ targets: cartao.c, scale: 1.8, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    const pvp = this.registry.get('pvp') ?? {}
    this.registry.set('pvp', { ...pvp, p1: this.p1, p2: this.p2, arena: id })
    await esperar(1500)
    this.cameras.main.fadeOut(300, 0, 0, 0)
    await esperar(320)
    this.scene.start('PvpArena', { p1: this.p1, p2: this.p2, arena: id })
  }

  // ---------- tela ----------

  mostrarPainel(id) {
    const arena = ARENA[id]
    const p = this.painel
    if (!arena) {
      p.nome.setText('ALEATÓRIA').setColor('#ffffff')
      p.musica.setText('')
      p.descricao.setText('Vale como voto numa arena sorteada na hora da apuração. Coragem!')
      p.rotuloBonus.setText('ARENAS POSSÍVEIS')
      p.bonus.forEach((t, k) => {
        const a = ARENAS[k]
        t.setText(a ? `· ${a.nome}` : '').setColor(a ? corTexto(a.cor) : '#ffffff')
      })
      return
    }
    p.nome.setText(arena.nome).setColor(corTexto(arena.cor))
    p.musica.setText(arena.tituloMusica ? `♪ ${arena.tituloMusica}` : '')
    p.descricao.setText(arena.descricao)
    const eventos = eventosDaArena(id)
    p.rotuloBonus.setText(`RODADAS BÔNUS (${eventos.length})`)
    p.bonus.forEach((t, k) => {
      const ev = eventos[k]
      t.setText(ev ? `★ ${ev.nome}` : '').setColor(ev ? corTexto(ev.cor) : '#ffffff')
    })
  }

  atualizarTela() {
    if (this.apurando) {
      this.cartoes.forEach((c) => c.selos.forEach((s, j) => [s.fundo, s.rotulo].forEach((o) => o.setVisible(this.votos[j] === c.id))))
      return
    }
    const focos = new Set(this.cursores.map((c) => c.indice))
    this.cartoes.forEach((c, i) => {
      const foco = focos.has(i)
      c.brilho.setStrokeStyle(3, c.cor, foco ? 0.9 : 0).setFillStyle(c.cor, foco ? 0.18 : 0)
      c.moldura.setStrokeStyle(2, c.cor, foco ? 1 : 0.6)
      c.c.setScale(foco ? 1.08 : 1).setY(CARTAO.y - (foco ? 6 : 0))
      c.selos.forEach((s, j) => [s.fundo, s.rotulo].forEach((o) => o.setVisible(this.votos[j] === c.id)))
    })
    const foco = this.cursores.find((c) => c.j === this.focoDe) ?? this.cursores[0]
    this.mostrarPainel(this.opcoes[foco.indice])
    const faltam = this.eleitores.filter((j) => !this.votos[j])
    if (!this.solo && faltam.length === 1) this.status.setText(`esperando o voto do P${faltam[0] + 1}...`)
  }

  update(time, delta) {
    this.controles.atualizar()
    this.fundo?.atualizar(delta)
    if (this.apurando) return
    for (const j of this.eleitores) {
      const direcao = this.controles.toque(j)
      if (direcao === 'esquerda') this.mover(j, -1)
      if (direcao === 'direita') this.mover(j, 1)
    }
    // corações nos cantos de cima do cartão (P1 à esquerda, P2 à direita)
    for (const cur of this.cursores) {
      const c = this.cartoes[cur.indice]
      const x = c.x + (cur.j === 0 ? -1 : 1) * (CARTAO.largura / 2 - 12)
      const y = c.c.y - CARTAO.altura / 2 - 12
      cur.coracao.setPosition(x, y + Math.sin(time / 200 + cur.j) * 2).setVisible(!this.votos[cur.j])
    }
    // tempo: quem não votou fica de fora
    this.restante -= delta
    const p = Math.max(0, this.restante / TEMPO_MS)
    this.barra.clear().fillStyle(0xffffff, 0.15).fillRect(LARGURA / 2 - 150, 56, 300, 4)
    this.barra.fillStyle(p < 0.3 ? 0xff5050 : 0xffe040, 1).fillRect(LARGURA / 2 - 150, 56, 300 * p, 4)
    if (this.restante <= 0) this.apurar()
  }

  // testes/console
  estadoDebug() {
    return { votos: [...this.votos], apurando: this.apurando, cursores: this.cursores.map((c) => this.opcoes[c.indice]), restante: Math.round(this.restante) }
  }
}

// Ícone de cada arena (vetorial, ~44 px), centrado em (x, y)
function desenharIcone(g, id, x, y, cor) {
  const escuro = 0x000000
  if (id === 'castelo') {
    g.fillStyle(cor, 1)
    g.fillRect(x - 16, y - 4, 32, 22)
    for (const dx of [-18, 8]) {
      g.fillRect(x + dx, y - 16, 10, 34)
      for (const k of [0, 1]) g.fillRect(x + dx + k * 6, y - 20, 4, 4)
    }
    g.fillRect(x - 6, y - 12, 12, 10)
    g.fillStyle(0xff5f8a, 1).fillTriangle(x - 1, y - 24, x - 1, y - 14, x + 8, y - 19)
    g.fillStyle(escuro, 0.7).fillRoundedRect(x - 5, y + 6, 10, 12, { tl: 5, tr: 5, bl: 0, br: 0 })
  } else if (id === 'jardim') {
    g.fillStyle(0x3aa860, 1).fillRect(x - 1, y, 3, 20)
    g.fillEllipse(x - 7, y + 12, 12, 6).fillEllipse(x + 8, y + 8, 12, 6)
    g.fillStyle(cor, 1)
    for (let k = 0; k < 6; k++) g.fillCircle(x + Math.cos((k * Math.PI) / 3) * 8, y - 6 + Math.sin((k * Math.PI) / 3) * 8, 6)
    g.fillStyle(0xffe040, 1).fillCircle(x, y - 6, 5)
    g.fillStyle(0xffe040, 0.9).fillCircle(x + 15, y - 18, 3)
  } else if (id === 'informatica') {
    g.fillStyle(0xb8b8c8, 1).fillRoundedRect(x - 18, y - 18, 36, 28, 4)
    g.fillStyle(0x0a2a3a, 1).fillRect(x - 14, y - 14, 28, 20)
    g.fillStyle(cor, 1)
    for (let k = 0; k < 4; k++) g.fillRect(x - 11, y - 11 + k * 4, 6 + ((k * 7) % 14), 2)
    g.fillStyle(0xb8b8c8, 1).fillRect(x - 4, y + 10, 8, 5).fillRect(x - 12, y + 15, 24, 4)
  } else if (id === 'palco') {
    g.fillStyle(0xc02040, 1)
    g.fillTriangle(x - 20, y - 18, x - 4, y - 18, x - 20, y + 18)
    g.fillTriangle(x + 20, y - 18, x + 4, y - 18, x + 20, y + 18)
    g.fillStyle(0xf0c050, 1).fillRect(x - 21, y - 21, 42, 4)
    g.fillStyle(cor, 1)
    const pontas = []
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 4 : 9
      const a = -Math.PI / 2 + (k * Math.PI) / 5
      pontas.push({ x: x + Math.cos(a) * r, y: y + 2 + Math.sin(a) * r })
    }
    g.fillPoints(pontas, true)
    g.fillStyle(0x6a3a20, 1).fillRect(x - 20, y + 16, 40, 4)
  } else if (id === 'templo') {
    g.fillStyle(cor, 1)
    g.fillTriangle(x - 20, y - 10, x + 20, y - 10, x, y - 22)
    g.fillRect(x - 20, y - 10, 40, 4)
    for (let k = 0; k < 4; k++) g.fillRect(x - 17 + k * 10, y - 4, 5, 18)
    g.fillRect(x - 22, y + 14, 44, 5)
    g.fillStyle(escuro, 0.5).fillCircle(x, y - 14, 2)
  } else if (id === 'coliseu') {
    g.fillStyle(cor, 1).fillRoundedRect(x - 21, y - 16, 42, 34, 6)
    g.fillStyle(escuro, 0.6)
    for (const fila of [0, 1]) {
      for (let k = 0; k < 4; k++) g.fillRoundedRect(x - 17 + k * 9.5, y - 11 + fila * 15, 6, 10, { tl: 3, tr: 3, bl: 0, br: 0 })
    }
    g.fillStyle(0xffe040, 1).fillTriangle(x - 1, y - 26, x - 1, y - 17, x + 8, y - 21)
    g.fillStyle(0xd8d8e0, 1).fillRect(x - 1, y - 26, 2, 10)
  } else {
    // "?": um dado de interrogação girando no lugar
    g.lineStyle(3, cor, 1).strokeRoundedRect(x - 17, y - 19, 34, 38, 6)
    g.fillStyle(cor, 1)
    g.fillRect(x - 8, y - 12, 16, 4).fillRect(x + 6, y - 12, 4, 10).fillRect(x - 2, y - 4, 10, 4).fillRect(x - 2, y, 4, 6).fillRect(x - 2, y + 9, 4, 4)
  }
}
