import Phaser from 'phaser'
import Controles from '../controles.js'
import { PERSONAGENS } from '../data/personagens.js'
import { PERSONAGENS_PVP } from '../pvp/cartas.js'
import { NIVEIS_BOT, NIVEL_BOT_PADRAO } from '../pvp/bot.js'
import { perfilPvp, rotuloCarta, COR_NAIPE, TIPO_NAIPE, TEXTO_JOGADOR } from '../pvp/perfil.js'
import { desenharNaipe } from '../entities/Carta.js'
import { criarFundo } from '../backgrounds/index.js'
import { tocar, musica, pararMusica } from '../audio.js'
import { estilhacos, faixasDiagonais } from '../effects/entrada.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO, corTexto } from '../constants.js'

// Área da grade de personagens e dos painéis de cada jogador (px)
const GRADE = { topo: 62, base: 190, esquerda: 20, direita: 620, espaco: 8, larguraMax: 96, alturaMax: 128 }
const PAINEL = { y: 198, altura: 250, espaco: 8 }
const CHAVE_SALVA = 'dodge-pvp' // última escolha (também fica no registry 'pvp')
const CHAVE_NIVEL = 'dodge-pvp-cpu' // nível da CPU (também fica no registry 'pvpNivelBot')
const NOMES_NIVEL = { facil: 'FÁCIL', normal: 'NORMAL', dificil: 'DIFÍCIL' }

// Transição "P1 VS P2" (ms desde a confirmação do segundo jogador)
const VS = { entrada: 120, batida: 560, espelho: 760, saida: 1500, fim: 1760 }

// Põe `conteudo` no texto sem passar de `largura`: diminui a fonte (até
// 3 px a menos) e, se ainda não couber, corta com reticências
function caber(texto, conteudo, largura, tamanho) {
  for (let t = tamanho; t >= tamanho - 3; t--) {
    texto.setFontSize(t).setText(conteudo)
    if (texto.width <= largura) return
  }
  let corte = conteudo.length
  while (corte > 1 && texto.width > largura) texto.setText(`${conteudo.slice(0, --corte).trimEnd()}…`)
}

// Escolha de personagem do PvP (Menu -> PvpEscolha -> PvpArena).
//   2 jogadores: cada um tem seu cursor (cor da alma) e confirma o seu ao
//                mesmo tempo; os dois PODEM pegar o mesmo personagem (espelho).
//                B desfaz a própria escolha; sem nada para desfazer, volta ao Menu.
//   1 jogador:   contra a CPU: o controle escolhe o próprio lutador (P1) e
//                depois o da CPU (P2); ↑/↓ trocam o nível da CPU (fácil,
//                normal, difícil). B desfaz o último; sem nada escolhido, volta ao Menu.
// O painel de cada jogador mostra o personagem em foco: HP no PvP, a
// composição do baralho por naipe, as 3 cartas mais fortes e o estilo.
// Quando os dois confirmam: "P1 VS P2", grava registry 'pvp' = { p1, p2 }
// e vai para a votação da arena (PvpVoto), que começa a PvpArena.
export default class PvpEscolha extends Phaser.Scene {
  constructor() {
    super('PvpEscolha')
  }

  create() {
    this.ids = PERSONAGENS_PVP.filter((id) => PERSONAGENS[id])
    this.perfis = Object.fromEntries(this.ids.map((id) => [id, perfilPvp(id)]))
    this.controles = new Controles(this)
    this.controles.onBotao((jogador, botao) => (botao === 'A' ? this.confirmar(jogador) : this.desfazer(jogador)))
    this.solo = this.controles.numJogadores === 1
    this.etapa = 0 // contra a CPU: qual jogador o controle está escolhendo
    this.nivelBot = this.lerNivelBot()
    this.confirmados = [null, null]
    this.saindo = false
    this.vs = null
    this.texto = (x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) =>
      this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra }).setOrigin(0.5)

    this.fundo = criarFundo(this, 'queen')
    this.fundo.escurecer()

    this.texto(LARGURA / 2, 22, 'PVP  ·  ESCOLHA O LUTADOR', 24, TEXTO.normal, { strokeThickness: 4 })
    this.status = this.texto(LARGURA / 2, 46, '', 13, TEXTO.selecionado)

    this.montarGrade()

    const anterior = this.ultimaEscolha()
    const inicio = (j) => (this.ids.includes(anterior[j]) ? this.ids.indexOf(anterior[j]) : Math.min(j, this.ids.length - 1))
    this.cursores = [0, 1].map((j) => ({
      indice: inicio(j),
      coracao: this.add.image(0, 0, 'coracao').setTint(CORES.almas[j]).setScale(1.3).setDepth(5),
      // o realce do P2 fica por dentro, para os dois aparecerem no mesmo card
      realce: this.add.rectangle(0, 0, 10, 10).setStrokeStyle(3, CORES.almas[j]).setDepth(4),
    }))

    this.montarPaineis()
    this.texto(LARGURA / 2, ALTURA - 14, '← → escolher     A: confirmar     B: desfazer / voltar', 13, TEXTO.desabilitado, { strokeThickness: 0 })

    this.atualizarTela()

    // o painel Svelte pode mudar o número de jogadores a qualquer momento
    const aoMudar = (_, valor, anterior) => valor !== anterior && !this.vs && this.scene.restart()
    this.registry.events.on('changedata-numJogadores', aoMudar)
    this.events.once('shutdown', () => this.registry.events.off('changedata-numJogadores', aoMudar))

    musica('pvpEscolha')
    this.cameras.main.fadeIn(250)
  }

  // nome curto de cada lado (contra a CPU, o P2 é "CPU")
  rotulo(j) {
    return this.solo && j === 1 ? 'CPU' : `P${j + 1}`
  }

  lerNivelBot() {
    let nivel = this.registry.get('pvpNivelBot')
    if (!nivel) {
      try {
        nivel = localStorage.getItem(CHAVE_NIVEL)
      } catch {
        nivel = null
      }
    }
    return NIVEIS_BOT[nivel] ? nivel : NIVEL_BOT_PADRAO
  }

  // ↑/↓ contra a CPU: troca o nível (fica salvo para as próximas partidas)
  mudarNivelBot(passo) {
    const niveis = Object.keys(NIVEIS_BOT)
    const i = niveis.indexOf(this.nivelBot)
    this.nivelBot = niveis[(i + passo + niveis.length) % niveis.length]
    this.registry.set('pvpNivelBot', this.nivelBot)
    try {
      localStorage.setItem(CHAVE_NIVEL, this.nivelBot)
    } catch {
      // sem armazenamento: fica só no registry
    }
    tocar(this, 'mover')
    this.atualizarTela()
    this.tweens.add({ targets: this.status, scale: { from: 1.15, to: 1 }, duration: 140 })
  }

  ultimaEscolha() {
    let pvp = this.registry.get('pvp')
    if (!pvp) {
      try {
        pvp = JSON.parse(localStorage.getItem(CHAVE_SALVA))
      } catch {
        pvp = null
      }
    }
    return [pvp?.p1, pvp?.p2].map((id) => (PERSONAGENS[id] ? id : null))
  }

  // ---------- montagem ----------

  // Grade que se ajusta ao número de personagens (uma linha até 8)
  montarGrade() {
    const n = this.ids.length
    const g = GRADE
    this.colunas = n <= 8 ? n : Math.ceil(n / 2)
    const linhas = Math.ceil(n / this.colunas)
    const largura = Math.min(g.larguraMax, (g.direita - g.esquerda - g.espaco * (this.colunas - 1)) / this.colunas)
    const altura = Math.min(g.alturaMax, (g.base - g.topo - g.espaco * (linhas - 1)) / linhas)
    const alturaTotal = linhas * altura + (linhas - 1) * g.espaco
    const topo = g.topo + (g.base - g.topo - alturaTotal) / 2
    this.card = { largura, altura }

    this.cards = this.ids.map((id, i) => {
      const def = PERSONAGENS[id]
      const linha = Math.floor(i / this.colunas)
      const coluna = i % this.colunas
      const naLinha = Math.min(this.colunas, n - linha * this.colunas)
      const x = LARGURA / 2 + (coluna - (naLinha - 1) / 2) * (largura + g.espaco)
      const y = topo + linha * (altura + g.espaco) + altura / 2
      const moldura = this.add.rectangle(x, y, largura, altura, CORES.painel, 0.88).setStrokeStyle(2, def.cor, 0.55)
      const sprite = this.add.image(x, y - 8, id)
      sprite.escalaBase = Math.max(1, Math.floor(Math.min((largura - 16) / sprite.width, (altura - 44) / sprite.height)))
      sprite.setScale(sprite.escalaBase)
      this.texto(x, y + altura / 2 - 13, def.nome.toUpperCase(), def.nome.length <= 6 ? 14 : 12, corTexto(def.cor))
      // selos "P1"/"P2" de quem confirmou, no canto do jogador (no lugar do coração)
      const selos = [0, 1].map((j) => {
        const sx = x + (j === 0 ? -1 : 1) * (largura / 2 - 17)
        const fundo = this.add.rectangle(sx, y - altura / 2 + 12, 28, 16, CORES.almas[j]).setStrokeStyle(2, 0x000000).setDepth(6).setVisible(false)
        const rotulo = this.add.text(sx, fundo.y, this.rotulo(j), { fontFamily: FONTE, fontSize: '12px', color: '#000000' }).setOrigin(0.5).setDepth(6).setVisible(false)
        return { fundo, rotulo }
      })
      return { id, def, x, y, moldura, sprite, selos }
    })
  }

  // Um painel por jogador: o personagem em foco no cursor dele
  montarPaineis() {
    const p = PAINEL
    const largura = (GRADE.direita - GRADE.esquerda - p.espaco) / 2
    const estilo = (tamanho, cor = TEXTO.normal) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor })
    this.paineis = [0, 1].map((j) => {
      const x = GRADE.esquerda + j * (largura + p.espaco)
      const y = p.y
      const moldura = this.add.rectangle(x, y, largura, p.altura, CORES.painel, 0.92).setOrigin(0).setStrokeStyle(2, CORES.almas[j], 0.85)
      this.add.rectangle(x + 8, y + 8, 30, 20, CORES.almas[j]).setOrigin(0)
      this.add.text(x + 23, y + 18, this.rotulo(j), estilo(14, '#000000')).setOrigin(0.5)
      const nome = this.add.text(x + 46, y + 7, '', estilo(19))
      const hp = this.add.text(x + largura - 10, y + 9, '', estilo(16)).setOrigin(1, 0)
      const coracaoHp = this.add.image(0, y + 18, 'coracao').setTint(0xff4050).setScale(0.8)
      const estiloRotulo = this.add.text(x + 10, y + 35, '', estilo(14))
      const estiloFrase = this.add.text(0, y + 37, '', estilo(12, '#b8b8c8'))
      const linhas = this.add.graphics()
      linhas.lineStyle(1, 0xffffff, 0.15)
      linhas.lineBetween(x + 8, y + 56, x + largura - 8, y + 56)
      linhas.lineBetween(x + 8, y + 158, x + largura - 8, y + 158)

      // personagem à esquerda, de pé numa sombra
      const sombra = this.add.ellipse(x + 48, y + 150, 46, 10, 0x000000, 0.5)
      const sprite = this.add.image(x + 48, y + 150, 'coracao').setOrigin(0.5, 1)

      // composição do baralho: uma linha por naipe (ícone, tipo, barra, quantidade)
      const total = this.add.text(x + largura - 10, y + 62, '', estilo(12, '#9a9aae')).setOrigin(1, 0)
      this.add.text(x + 98, y + 62, 'BARALHO', estilo(12, '#9a9aae'))
      const icones = this.add.graphics()
      const barras = this.add.graphics()
      const naipes = ['espadas', 'copas', 'ouros', 'paus'].map((naipe, k) => {
        const ly = y + 86 + k * 18
        desenharNaipe(icones, naipe, x + 106, ly, 6.5, COR_NAIPE[naipe])
        this.add.text(x + 118, ly, TIPO_NAIPE[naipe], estilo(12, corTexto(COR_NAIPE[naipe]))).setOrigin(0, 0.5)
        const qtd = this.add.text(x + largura - 10, ly, '', estilo(15)).setOrigin(1, 0.5)
        return { naipe, ly, qtd }
      })
      const barra = { x: x + 196, largura: largura - 196 - 32 }

      // as 3 cartas mais fortes
      this.add.text(x + 10, y + 163, 'MAIS FORTES', estilo(12, '#9a9aae'))
      const naipesFortes = this.add.graphics()
      const fortes = [0, 1, 2].map((k) => {
        const ly = y + 186 + k * 17
        return {
          ly,
          valor: this.add.text(x + 24, ly, '', estilo(16)).setOrigin(0.5),
          nome: this.add.text(x + 50, ly, '', estilo(14)).setOrigin(0, 0.5),
          tipo: this.add.text(x + largura - 10, ly, '', estilo(11)).setOrigin(1, 0.5),
        }
      })
      const rodape = this.add.text(x + largura / 2, y + p.altura - 10, '', estilo(13)).setOrigin(0.5)
      return { x, y, largura, moldura, nome, hp, coracaoHp, estiloRotulo, estiloFrase, sombra, sprite, total, naipes, barras, barra, naipesFortes, fortes, rodape, focado: null }
    })
  }

  // ---------- regras ----------

  // Qual jogador este botão comanda (no treino, o controle único escolhe um de cada vez)
  alvo(jogador) {
    return this.solo ? this.etapa : jogador
  }

  confirmar(jogador) {
    if (this.saindo) return
    const j = this.alvo(jogador)
    if (this.confirmados[j]) return
    const cursor = this.cursores[j]
    const id = this.ids[cursor.indice]
    this.confirmados[j] = id
    tocar(this, 'confirmar')
    const card = this.cards[cursor.indice]
    this.tweens.add({ targets: card.sprite, scale: card.sprite.escalaBase * 1.3, duration: 90, yoyo: true })
    const painel = this.paineis[j]
    this.tweens.add({ targets: painel.sprite, y: painel.y + 138, duration: 90, yoyo: true, ease: 'Quad.easeOut' })
    if (this.solo && j === 0) this.etapa = 1
    this.atualizarTela()
    if (this.confirmados.every(Boolean)) this.terminar()
  }

  desfazer(jogador) {
    if (this.saindo) return
    if (this.solo) {
      if (this.etapa === 1) {
        this.etapa = 0
        this.confirmados[0] = null
      } else {
        return this.voltar()
      }
    } else if (this.confirmados[jogador]) {
      this.confirmados[jogador] = null
    } else if (this.confirmados.some(Boolean)) {
      return tocar(this, 'erro') // o outro jogador já escolheu: não sai da tela
    } else {
      return this.voltar()
    }
    tocar(this, 'cancelar')
    this.atualizarTela()
  }

  terminar() {
    this.saindo = true
    const [p1, p2] = this.confirmados
    this.registry.set('pvp', { ...this.registry.get('pvp'), p1, p2 })
    this.registry.set('pvpNivelBot', this.nivelBot)
    try {
      localStorage.setItem(CHAVE_SALVA, JSON.stringify({ p1, p2 }))
    } catch {
      // sem armazenamento (aba anônima etc.): fica só no registry
    }
    this.status.setText('PRONTOS!')
    this.time.delayedCall(260, () => this.encarar(p1, p2))
  }

  voltar() {
    this.saindo = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start('Menu'))
  }

  // ---------- navegação ----------

  mover(jogador, passo, comSom = true) {
    const j = this.alvo(jogador)
    if (this.confirmados[j]) return // travado até desfazer
    const cursor = this.cursores[j]
    const n = this.ids.length
    cursor.indice = (cursor.indice + passo + n) % n
    if (comSom) tocar(this, 'mover')
    this.atualizarTela()
  }

  // ↑ ↓ andam uma linha (só com mais de uma linha de personagens)
  moverLinha(jogador, sentido) {
    const n = this.ids.length
    const linhas = Math.ceil(n / this.colunas)
    if (linhas < 2) return
    const atual = this.cursores[this.alvo(jogador)].indice
    const coluna = atual % this.colunas
    const linha = (Math.floor(atual / this.colunas) + sentido + linhas) % linhas
    let destino = linha * this.colunas + coluna
    if (destino >= n) destino = sentido > 0 ? coluna : n - 1
    this.mover(jogador, destino - atual)
  }

  // ---------- desenho ----------

  // o cursor deste jogador aparece? (no treino, o do P2 só depois do P1 escolher)
  cursorVisivel(j) {
    return !this.solo || j <= this.etapa
  }

  atualizarTela() {
    const { largura, altura } = this.card
    this.cards.forEach((c) => {
      const donos = [0, 1].filter((j) => this.confirmados[j] === c.id)
      c.selos.forEach((s, j) => {
        const visivel = donos.includes(j)
        s.fundo.setVisible(visivel)
        s.rotulo.setVisible(visivel)
      })
      const corBorda = donos.length ? CORES.almas[donos[0]] : c.def.cor
      c.moldura.setStrokeStyle(2, corBorda, donos.length ? 1 : 0.55)
      const emFoco = this.cursores.some((cur, j) => this.cursorVisivel(j) && this.ids[cur.indice] === c.id)
      c.sprite.setAlpha(emFoco || donos.length ? 1 : 0.5)
    })

    this.cursores.forEach((cur, j) => {
      const c = this.cards[cur.indice]
      const visivel = this.cursorVisivel(j)
      cur.realce.setPosition(c.x, c.y).setSize(largura + 6 - j * 10, altura + 6 - j * 10).setOrigin(0.5).setVisible(visivel)
      cur.realce.setStrokeStyle(3, CORES.almas[j], this.confirmados[j] ? 1 : 0.8)
      // confirmado: o selo toma o lugar do coração
      cur.coracao.setVisible(visivel && !this.confirmados[j])
    })

    if (this.solo) {
      this.status.setText(`VOCÊ x CPU  ·  nível da CPU: ${NOMES_NIVEL[this.nivelBot]}  (↑/↓ muda)`).setColor(TEXTO.selecionado)
    } else {
      const faltam = this.confirmados.filter((c) => !c).length
      this.status.setText(faltam ? 'cada jogador escolhe 1 lutador  ·  pode repetir!' : '').setColor(TEXTO.normal)
    }

    this.paineis.forEach((p, j) => this.desenharPainel(p, j))
  }

  desenharPainel(p, j) {
    const id = this.ids[this.cursores[j].indice]
    const def = PERSONAGENS[id]
    const perfil = this.perfis[id]

    // rodapé: o que falta para este jogador
    let rodape
    let cor = TEXTO.normal
    if (this.confirmados[j]) {
      rodape = this.solo ? 'PRONTO!' : 'PRONTO!  (B desfaz)'
      cor = TEXTO.cura
    } else if (this.solo && j > this.etapa) {
      rodape = 'depois: o lutador da CPU'
      cor = TEXTO.desabilitado
    } else {
      rodape = !this.solo ? 'A: escolher' : j === 1 ? 'A: escolher a CPU' : 'A: escolher o seu'
      if (this.confirmados[1 - j] === id) {
        rodape += '  ·  ESPELHO!'
        cor = TEXTO.selecionado
      }
    }
    p.rodape.setText(rodape).setColor(cor)
    p.moldura.setStrokeStyle(this.confirmados[j] ? 3 : 2, CORES.almas[j], this.confirmados[j] ? 1 : 0.85)

    // o resto só muda quando o personagem em foco muda
    if (p.focado === id) return
    p.focado = id

    p.nome.setText(def.nome.toUpperCase()).setColor(corTexto(def.cor))
    p.hp.setText(`HP ${perfil.hp}`)
    p.coracaoHp.setX(p.hp.x - p.hp.width - 11)
    p.estiloRotulo.setText(perfil.estilo.rotulo).setColor(corTexto(perfil.estilo.cor))
    p.estiloFrase.setX(p.estiloRotulo.x + p.estiloRotulo.width + 8)
    caber(p.estiloFrase, perfil.estilo.frase, p.x + p.largura - 10 - p.estiloFrase.x, 12)

    p.sprite.setTexture(id).setScale(3).clearTint()
    this.tweens.killTweensOf(p.sprite)
    p.sprite.setY(p.y + 150).setAlpha(0).setX(p.x + 36)
    this.tweens.add({ targets: p.sprite, x: p.x + 48, alpha: 1, duration: 140, ease: 'Quad.easeOut' })

    p.total.setText(`${perfil.total} cartas`)
    const maximo = Math.max(...Object.values(perfil.naipes), 1)
    p.barras.clear()
    p.naipes.forEach(({ naipe, ly, qtd }) => {
      const n = perfil.naipes[naipe]
      qtd.setText(String(n))
      p.barras.fillStyle(0xffffff, 0.08).fillRect(p.barra.x, ly - 4, p.barra.largura, 8)
      p.barras.fillStyle(COR_NAIPE[naipe], 0.9).fillRect(p.barra.x, ly - 4, Math.round((p.barra.largura * n) / maximo), 8)
    })

    p.naipesFortes.clear()
    p.fortes.forEach((linha, k) => {
      const carta = perfil.fortes[k]
      if (!carta) {
        linha.valor.setText('')
        linha.nome.setText('')
        linha.tipo.setText('')
        return
      }
      const corNaipe = COR_NAIPE[carta.naipe]
      linha.valor.setText(rotuloCarta(carta)).setColor(corTexto(corNaipe))
      desenharNaipe(p.naipesFortes, carta.naipe, p.x + 38, linha.ly, 6, corNaipe)
      linha.tipo.setText(`custo ${carta.custo}`).setColor('#8a8aa0')
      caber(linha.nome, carta.nome, linha.tipo.x - linha.tipo.width - 8 - linha.nome.x, 14)
    })
  }

  // ---------- transição P1 VS P2 ----------

  // Os dois se encaram: a tela racha na diagonal nas cores dos jogadores, os
  // lutadores entram correndo e o VS bate no meio, com tremor e estilhaços.
  encarar(p1, p2) {
    const topo = 50
    const camera = this.cameras.main
    pararMusica()
    tocar(this, 'tensao')
    camera.flash(80, 255, 255, 255)
    this.cursores.forEach((c) => c.coracao.setVisible(false))

    const veu = this.add.rectangle(LARGURA / 2, ALTURA / 2, LARGURA + 200, ALTURA + 200, 0x000000, 1).setDepth(topo).setAlpha(0)
    this.tweens.add({ targets: veu, alpha: 1, duration: 160 })

    // metade de cada jogador, cortada na diagonal, entrando pelos lados
    const meio = { cima: 372, baixo: 268 }
    const metade = (j) => {
      const g = this.add.graphics().setDepth(topo + 1)
      const pontos =
        j === 0
          ? [{ x: -40, y: -40 }, { x: meio.cima + 7, y: -40 }, { x: meio.baixo - 7, y: ALTURA + 40 }, { x: -40, y: ALTURA + 40 }]
          : [{ x: meio.cima + 7, y: -40 }, { x: LARGURA + 40, y: -40 }, { x: LARGURA + 40, y: ALTURA + 40 }, { x: meio.baixo - 7, y: ALTURA + 40 }]
      g.fillStyle(CORES.almas[j], 0.38).fillPoints(pontos, true)
      g.setX(j === 0 ? -LARGURA : LARGURA)
      this.tweens.add({ targets: g, x: 0, duration: 240, ease: 'Cubic.easeOut' })
      return g
    }
    const metades = [metade(0), metade(1)]
    const faixas = faixasDiagonais(this, 0xffffff, topo + 2)
    // costura branca entre as duas metades (acende na batida)
    const costura = this.add.graphics().setDepth(topo + 3).setAlpha(0)
    costura.lineStyle(6, 0xffffff, 1).lineBetween(meio.cima, -10, meio.baixo, ALTURA + 10)

    const chao = 316
    const lutadores = [p1, p2].map((id, j) => {
      const def = PERSONAGENS[id]
      const lado = j === 0 ? -1 : 1
      const x = LARGURA / 2 + lado * 170
      const sombra = this.add.ellipse(x, chao + 3, 80, 16, 0x000000, 0.6).setDepth(topo + 4)
      const sprite = this.add.image(x, chao, id).setOrigin(0.5, 1).setScale(5).setDepth(topo + 5).setFlipX(j === 1)
      const etiqueta = this.add
        .text(x, chao + 26, this.rotulo(j), { fontFamily: FONTE, fontSize: '18px', color: TEXTO_JOGADOR[j], stroke: '#000000', strokeThickness: 4 })
        .setOrigin(0.5)
        .setDepth(topo + 5)
      const nome = this.add
        .text(x, chao + 54, def.nome.toUpperCase(), { fontFamily: FONTE, fontSize: '30px', color: corTexto(def.cor), stroke: '#000000', strokeThickness: 6 })
        .setOrigin(0.5)
        .setDepth(topo + 5)
      const grupo = [sombra, sprite, etiqueta, nome]
      grupo.forEach((o) => o.setX(o.x + lado * 420))
      this.time.delayedCall(VS.entrada + j * 60, () => {
        tocar(this, 'voo')
        this.tweens.add({ targets: grupo, x: `-=${lado * 420}`, duration: 300, ease: 'Back.easeOut' })
      })
      return { sprite, lado, x }
    })

    const vs = this.add
      .text(LARGURA / 2, 190, 'VS', { fontFamily: FONTE, fontSize: '112px', color: '#ffffff', stroke: '#000000', strokeThickness: 12 })
      .setOrigin(0.5)
      .setDepth(topo + 8)
      .setTint(0xffffff, 0xffffff, 0xffc040, 0xff8a1a)
      .setShadow(0, 6, '#5a1a00', 0, true, false)
      .setAlpha(0)
    const brilho = this.add.image(LARGURA / 2, 190, 'brilho').setTint(0xffe040).setBlendMode(Phaser.BlendModes.ADD).setDepth(topo + 7).setScale(0)

    this.vs = { inicio: this.time.now, faixas, lutadores }

    this.time.delayedCall(VS.batida - 150, () => {
      vs.setScale(4).setAlpha(0).setAngle(-12)
      this.tweens.add({
        targets: vs,
        scale: 1,
        alpha: 1,
        angle: -4,
        duration: 150,
        ease: 'Quad.easeIn',
        onComplete: () => {
          tocar(this, 'impacto')
          camera.flash(140, 255, 255, 255)
          camera.shake(280, 0.018)
          costura.setAlpha(1)
          this.tweens.add({ targets: costura, alpha: 0.5, duration: 400 })
          brilho.setScale(4).setAlpha(1)
          this.tweens.add({ targets: brilho, scale: 2.4, alpha: 0.5, duration: 500, ease: 'Quad.easeOut' })
          const onda = this.add.circle(LARGURA / 2, 190, 30).setStrokeStyle(8, 0xffffff).setDepth(topo + 6)
          this.tweens.add({ targets: onda, scale: 12, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => onda.destroy() })
          estilhacos(this, LARGURA / 2, 190, { quantidade: 30, cores: [CORES.almas[0], CORES.almas[1], 0xffffff], profundidade: topo + 6, duracao: 700 })
          this.tweens.add({ targets: vs, scale: 1.08, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
          // os dois dão um passo à frente, encarando
          lutadores.forEach(({ sprite, lado }) =>
            this.tweens.add({ targets: sprite, x: sprite.x - lado * 18, scaleY: 5.4, duration: 110, yoyo: true, ease: 'Quad.easeOut' }),
          )
        },
      })
    })

    if (p1 === p2) {
      this.time.delayedCall(VS.espelho, () => {
        const espelho = this.add
          .text(LARGURA / 2, 268, 'ESPELHO!', { fontFamily: FONTE, fontSize: '24px', color: TEXTO.selecionado, stroke: '#000000', strokeThickness: 5 })
          .setOrigin(0.5)
          .setDepth(topo + 8)
          .setScale(2)
          .setAlpha(0)
        this.tweens.add({ targets: espelho, scale: 1, alpha: 1, duration: 140, ease: 'Back.easeOut' })
        tocar(this, 'estalo')
      })
    }

    this.time.delayedCall(VS.saida, () => {
      metades.forEach((g, j) => this.tweens.add({ targets: g, alpha: 0.6, duration: 200 }))
      camera.fadeOut(240, 0, 0, 0)
    })
    this.time.delayedCall(VS.fim, () => this.scene.start('PvpVoto', { p1, p2 }))
  }

  update(time, delta) {
    this.controles.atualizar()
    if (!this.saindo) {
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const direcao = this.controles.toque(j)
        if (direcao === 'esquerda') this.mover(j, -1)
        if (direcao === 'direita') this.mover(j, 1)
        // contra a CPU, ↑/↓ trocam o nível dela (com uma linha só de lutadores, ↑/↓ não fariam nada)
        if (direcao === 'cima') this.solo ? this.mudarNivelBot(1) : this.moverLinha(j, -1)
        if (direcao === 'baixo') this.solo ? this.mudarNivelBot(-1) : this.moverLinha(j, 1)
      }
    }
    this.fundo.atualizar(delta)

    if (this.vs) {
      const ms = time - this.vs.inicio
      this.vs.faixas.desenhar(ms, Math.min(0.55, ms / 900))
      return
    }

    // corações nos cantos de cima do card (P1 à esquerda, P2 à direita)
    this.cursores.forEach((cur, j) => {
      const c = this.cards[cur.indice]
      const x = c.x + (j === 0 ? -1 : 1) * (this.card.largura / 2 - 14)
      const y = c.y - this.card.altura / 2 + 13
      cur.coracao.setPosition(x, y + Math.sin(time / 200 + j) * 2)
    })
    // o lutador em foco respira no painel
    this.paineis.forEach((p) => {
      if (!this.tweens.isTweening(p.sprite)) p.sprite.setScale(3, 3 + Math.sin(time / 260) * 0.06)
    })
  }
}
