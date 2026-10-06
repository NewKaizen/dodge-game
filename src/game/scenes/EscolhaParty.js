import Phaser from 'phaser'
import Controles from '../controles.js'
import { PERSONAGENS } from '../data/personagens.js'
import { criarFundo } from '../backgrounds/index.js'
import { tocar, musica } from '../audio.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO, corTexto } from '../constants.js'
import { perfilPvp, rotuloCarta } from '../pvp/perfil.js'
import { SIMBOLOS } from '../pvp/cartas.js'

// Área da grade de personagens e dos painéis de detalhes (px)
const GRADE = { topo: 72, base: 282, esquerda: 20, direita: 620, espaco: 8, larguraMax: 180, alturaMax: 200 }
const DETALHE = { y: 290, altura: 150, espaco: 8, linha: 17, linhasPorColuna: 5 }
const TAMANHO_PARTY = 2 // com 1 jogador ele escolhe todos; com 2, cada um escolhe 1
const CHAVE_SALVA = 'dodge-party' // última party (também fica no registry)

// Escolha da party do CO-OP (Menu -> EscolhaParty -> Selecao).
// Lista TODOS os personagens de data/personagens.js, na ordem do arquivo.
//   1 jogador:  escolhe o 1º e o 2º personagem (sem repetir); B desfaz o último
//   2 jogadores: cada um tem seu cursor (cor da alma) e escolhe 1 ao mesmo tempo;
//                B desfaz a própria escolha
// Quando todos confirmam, grava registry 'party' (ids na ordem; party[0] é do
// jogador 1) e segue para a escolha do chefe. B sem nada para desfazer: volta ao Menu.
export default class EscolhaParty extends Phaser.Scene {
  constructor() {
    super('EscolhaParty')
  }

  create() {
    this.ids = Object.keys(PERSONAGENS)
    this.controles = new Controles(this)
    this.controles.onBotao((jogador, botao) => (botao === 'A' ? this.confirmar(jogador) : this.desfazer(jogador)))
    this.numJogadores = this.controles.numJogadores
    this.saindo = false
    this.texto = (x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) =>
      this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra }).setOrigin(0.5)

    this.fundo = criarFundo(this, 'king')
    this.fundo.escurecer()

    this.texto(LARGURA / 2, 28, 'ESCOLHA A PARTY', 28, TEXTO.normal, { strokeThickness: 4 })
    this.status = this.texto(LARGURA / 2, 56, '', 14, TEXTO.selecionado)

    this.montarGrade()

    // 1 jogador: um cursor e a lista de escolhidos; 2 jogadores: um cursor e uma escolha por jogador
    const anterior = this.ultimaParty()
    const inicio = (k) => Math.max(0, this.ids.indexOf(anterior[k]))
    this.cursores = Array.from({ length: this.numJogadores }, (_, j) => ({
      indice: this.numJogadores === 1 ? inicio(0) : Math.min(this.ids.length - 1, anterior[j] ? inicio(j) : j),
      coracao: this.add.image(0, 0, 'coracao').setTint(CORES.almas[j]).setScale(1.4).setDepth(5),
      // 2 jogadores: o realce do P2 fica por dentro, para os dois aparecerem no mesmo card
      realce: this.add.rectangle(0, 0, 10, 10).setStrokeStyle(3, this.numJogadores === 1 ? CORES.selecionado : CORES.almas[j]).setDepth(4),
    }))
    this.escolhidos = [] // ids na ordem (1 jogador)
    this.confirmados = Array(this.numJogadores).fill(null) // id de cada jogador (2 jogadores)

    this.montarDetalhes()
    this.texto(LARGURA / 2, ALTURA - 18, '← → ↑ ↓ escolher     A: confirmar     B: desfazer / voltar', 13, TEXTO.desabilitado, { strokeThickness: 0 })

    this.cursores.forEach((_, j) => this.mover(j, 0, false))
    this.atualizarTela()

    // o painel Svelte pode mudar o número de jogadores a qualquer momento
    const aoMudar = (_, valor, anterior) => valor !== anterior && this.scene.restart()
    this.registry.events.on('changedata-numJogadores', aoMudar)
    this.events.once('shutdown', () => this.registry.events.off('changedata-numJogadores', aoMudar))

    musica('selecao')
    this.cameras.main.fadeIn(250)
  }

  ultimaParty() {
    let party = this.registry.get('party')
    if (!party) {
      try {
        party = JSON.parse(localStorage.getItem(CHAVE_SALVA))
      } catch {
        party = null
      }
    }
    return Array.isArray(party) ? party.filter((id) => PERSONAGENS[id]) : []
  }

  // ---------- montagem ----------

  // Grade que se ajusta ao número de personagens (2, 7, 12...)
  montarGrade() {
    const n = this.ids.length
    const g = GRADE
    this.colunas = n <= 4 ? n : n <= 10 ? Math.ceil(n / 2) : 5
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
      // a última linha incompleta fica centralizada
      const naLinha = Math.min(this.colunas, n - linha * this.colunas)
      const x = LARGURA / 2 + (coluna - (naLinha - 1) / 2) * (largura + g.espaco)
      const y = topo + linha * (altura + g.espaco) + altura / 2
      const moldura = this.add.rectangle(x, y, largura, altura, CORES.painel, 0.88).setStrokeStyle(2, def.cor, 0.55)
      const textura = id
      const nomeGrande = def.nome.length <= 8

      let sprite
      if (altura >= 96) {
        // vertical: sprite em cima, nome e números embaixo
        sprite = this.add.image(x, y - 16, textura)
        this.encaixar(sprite, largura - 20, altura - 50)
        this.texto(x, y + altura / 2 - 30, def.nome.toUpperCase(), nomeGrande ? 16 : 13, corTexto(def.cor))
        this.texto(x, y + altura / 2 - 12, `HP ${def.hp}`, 12, TEXTO.normal, { strokeThickness: 0 })
      } else {
        // horizontal (muitos personagens): sprite à esquerda
        const esquerda = x - largura / 2
        sprite = this.add.image(esquerda + 24, y, textura)
        this.encaixar(sprite, 40, altura - 10)
        this.add.text(esquerda + 48, y - 2, def.nome.toUpperCase(), { fontFamily: FONTE, fontSize: nomeGrande ? '14px' : '12px', color: corTexto(def.cor) }).setOrigin(0, 1)
        this.add.text(esquerda + 48, y + 2, `HP ${def.hp}`, { fontFamily: FONTE, fontSize: '11px', color: TEXTO.normal }).setOrigin(0, 0)
      }

      // selo de escolhido: "1º"/"2º" (1 jogador) ou "P1"/"P2" (2 jogadores)
      // (no meio do topo; os corações dos cursores ficam nos cantos)
      const selo = this.add.rectangle(x, y - altura / 2 + 13, 30, 18, 0x000000).setStrokeStyle(2, 0xffffff).setDepth(3)
      const seloTexto = this.add
        .text(x, selo.y, '', { fontFamily: FONTE, fontSize: '12px', color: TEXTO.normal })
        .setOrigin(0.5)
        .setDepth(3)
      return { id, def, x, y, moldura, sprite, selo, seloTexto, linha, coluna }
    })
  }

  // Escala inteira (pixel art) que cabe na caixa
  encaixar(sprite, largura, altura) {
    const escala = Math.max(1, Math.floor(Math.min(largura / sprite.width, altura / sprite.height)))
    sprite.setScale(escala)
    sprite.escalaBase = escala
  }

  // Um painel de detalhes por cursor: o personagem em cima dele (nome, HP e baralho)
  montarDetalhes() {
    const d = DETALHE
    const total = this.numJogadores
    const largura = (GRADE.direita - GRADE.esquerda - d.espaco * (total - 1)) / total
    this.paineis = this.cursores.map((_, j) => {
      const x = GRADE.esquerda + j * (largura + d.espaco)
      const moldura = this.add.rectangle(x, d.y, largura, d.altura, CORES.painel, 0.9).setOrigin(0).setStrokeStyle(2, 0x505050)
      const estilo = (tamanho, cor = TEXTO.normal) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor })
      const cabeca = this.add.text(x + 10, d.y + 8, '', estilo(16))
      const numeros = this.add.text(x + largura - 10, d.y + 10, '', estilo(13)).setOrigin(1, 0)
      const rotulo = this.add.text(x + 10, d.y + 32, '', estilo(13, TEXTO.comando))
      const colunas = total === 1 ? 2 : 1
      const larguraColuna = (largura - 20) / colunas
      const linhas = []
      for (let c = 0; c < colunas; c++) {
        for (let k = 0; k < d.linhasPorColuna; k++) {
          const lx = x + 10 + c * larguraColuna
          const ly = d.y + 52 + k * d.linha
          linhas.push({
            nome: this.add.text(lx + 10, ly, '', estilo(13)),
            custo: this.add.text(lx + larguraColuna - 12, ly, '', estilo(13, TEXTO.comando)).setOrigin(1, 0),
          })
        }
      }
      // situação deste cursor (PRONTO, já escolhido...), na linha do estilo
      const rodape = this.add.text(x + largura - 10, d.y + 33, '', estilo(12)).setOrigin(1, 0)
      return { moldura, cabeca, numeros, rotulo, linhas, rodape }
    })
  }

  // ---------- regras ----------

  // id já escolhido por alguém (não pode repetir)
  ocupado(id, exceto = -1) {
    if (this.numJogadores === 1) return this.escolhidos.includes(id)
    return this.confirmados.some((c, j) => c === id && j !== exceto)
  }

  confirmar(jogador) {
    if (this.saindo) return
    const id = this.ids[this.cursores[jogador].indice]
    if (this.numJogadores === 1) {
      if (this.ocupado(id)) return tocar(this, 'erro')
      this.escolhidos.push(id)
    } else {
      if (this.confirmados[jogador]) return
      if (this.ocupado(id, jogador)) return tocar(this, 'erro')
      this.confirmados[jogador] = id
    }
    tocar(this, 'confirmar')
    const card = this.cards[this.cursores[jogador].indice]
    this.tweens.add({ targets: card.sprite, scale: card.sprite.escalaBase * 1.25, duration: 90, yoyo: true })
    this.atualizarTela()
    const party = this.numJogadores === 1 ? this.escolhidos : this.confirmados
    if (party.length >= TAMANHO_PARTY && party.every(Boolean)) this.terminar([...party])
  }

  desfazer(jogador) {
    if (this.saindo) return
    if (this.numJogadores === 1 && this.escolhidos.length) {
      this.escolhidos.pop()
    } else if (this.numJogadores > 1 && this.confirmados[jogador]) {
      this.confirmados[jogador] = null
    } else if (this.numJogadores > 1 && this.confirmados.some(Boolean)) {
      return tocar(this, 'erro') // o outro jogador já escolheu: não sai da tela
    } else {
      return this.voltar()
    }
    tocar(this, 'cancelar')
    this.atualizarTela()
  }

  terminar(party) {
    this.saindo = true
    this.registry.set('party', party)
    try {
      localStorage.setItem(CHAVE_SALVA, JSON.stringify(party))
    } catch {
      // sem armazenamento (aba anônima etc.): fica só no registry
    }
    this.status.setText('PARTY PRONTA!')
    this.cameras.main.flash(200, 255, 255, 255)
    this.time.delayedCall(420, () => this.cameras.main.fadeOut(300, 0, 0, 0))
    this.time.delayedCall(740, () => this.scene.start('Selecao'))
  }

  voltar() {
    this.saindo = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start('Menu'))
  }

  // ---------- navegação ----------

  mover(jogador, passo, comSom = true) {
    const cursor = this.cursores[jogador]
    if (this.numJogadores > 1 && this.confirmados[jogador]) return // travado até desfazer
    const n = this.ids.length
    cursor.indice = (cursor.indice + passo + n) % n
    if (comSom) tocar(this, 'mover')
    this.atualizarTela()
  }

  // ↑ ↓ andam uma linha (mesma coluna; dá a volta)
  moverLinha(jogador, sentido) {
    const n = this.ids.length
    const atual = this.cursores[jogador].indice
    const linhas = Math.ceil(n / this.colunas)
    if (linhas < 2) return
    const coluna = atual % this.colunas
    let linha = (Math.floor(atual / this.colunas) + sentido + linhas) % linhas
    let alvo = linha * this.colunas + coluna
    if (alvo >= n) alvo = sentido > 0 ? coluna : n - 1
    this.mover(jogador, alvo - atual)
  }

  // ---------- desenho ----------

  atualizarTela() {
    const solo = this.numJogadores === 1
    const { largura, altura } = this.card

    this.cards.forEach((c) => {
      const ordem = solo ? this.escolhidos.indexOf(c.id) : this.confirmados.indexOf(c.id)
      const escolhido = ordem >= 0
      const corSelo = solo ? CORES.selecionado : CORES.almas[ordem]
      c.selo.setVisible(escolhido).setStrokeStyle(2, escolhido ? corSelo : 0xffffff)
      c.seloTexto.setVisible(escolhido).setText(solo ? `${ordem + 1}º` : `P${ordem + 1}`).setColor(corTexto(corSelo ?? 0xffffff))
      c.moldura.setStrokeStyle(2, escolhido ? corSelo : c.def.cor, escolhido ? 1 : 0.55)
      const emFoco = this.cursores.some((cur) => this.ids[cur.indice] === c.id)
      c.sprite.setAlpha(emFoco || escolhido ? 1 : 0.55)
    })

    this.cursores.forEach((cur, j) => {
      const c = this.cards[cur.indice]
      const dentro = solo ? 0 : j * 5
      cur.realce.setPosition(c.x, c.y).setSize(largura + 6 - dentro * 2, altura + 6 - dentro * 2)
      cur.realce.setOrigin(0.5)
      // travado (2 jogadores): o coração fica parado e mais apagado
      cur.coracao.setAlpha(!solo && this.confirmados[j] ? 0.5 : 1)
    })

    // mensagem do topo
    if (solo) {
      const k = this.escolhidos.length
      this.status.setText(k < TAMANHO_PARTY ? `escolha o ${k + 1}º personagem` : '')
    } else {
      const faltam = this.confirmados.filter((c) => !c).length
      this.status.setText(faltam ? 'cada jogador escolhe 1 personagem' : '')
    }

    this.paineis.forEach((p, j) => this.desenharDetalhe(p, j))
  }

  desenharDetalhe(p, j) {
    const solo = this.numJogadores === 1
    const id = this.ids[this.cursores[j].indice]
    const def = PERSONAGENS[id]
    const corJogador = solo ? CORES.selecionado : CORES.almas[j]
    p.moldura.setStrokeStyle(2, corJogador, 0.8)
    p.cabeca.setText(solo ? def.nome.toUpperCase() : `P${j + 1}  ${def.nome.toUpperCase()}`).setColor(corTexto(def.cor))
    // o baralho do personagem: estilo, naipes e as cartas mais fortes (o SUPER primeiro)
    const perfil = perfilPvp(id)
    p.numeros.setText(`HP ${perfil.hp}`)
    p.rotulo.setText(perfil.estilo.rotulo).setColor(corTexto(perfil.estilo.cor))
    const { naipes } = perfil
    const lista = [
      { nome: `♠${naipes.espadas}  ♥${naipes.copas}  ♦${naipes.ouros}  ♣${naipes.paus}`, custo: '' },
      ...perfil.fortes.map((c) => ({ nome: `${rotuloCarta(c)}${SIMBOLOS[c.naipe]} ${c.nome}`, custo: String(c.custo) })),
    ]
    p.linhas.forEach((l, k) => {
      l.nome.setText(lista[k]?.nome ?? '')
      l.custo.setText(lista[k]?.custo ?? '')
    })

    // rodapé: o que falta para este jogador
    let rodape
    if (solo) {
      const k = this.escolhidos.length
      rodape = k >= TAMANHO_PARTY ? 'PRONTO!' : this.ocupado(id) ? 'já está na party' : `A: escolher como ${k + 1}º`
    } else if (this.confirmados[j]) {
      rodape = 'PRONTO!  (B desfaz)'
    } else {
      rodape = this.ocupado(id, j) ? `o P${2 - j} já pegou` : 'A: escolher'
    }
    p.rodape.setText(rodape).setColor(rodape.startsWith('PRONTO') ? TEXTO.cura : rodape.startsWith('A:') ? TEXTO.normal : TEXTO.caido)
  }

  update(time, delta) {
    this.controles.atualizar()
    if (!this.saindo) {
      for (let j = 0; j < this.numJogadores; j++) {
        const direcao = this.controles.toque(j)
        if (direcao === 'esquerda') this.mover(j, -1)
        if (direcao === 'direita') this.mover(j, 1)
        if (direcao === 'cima') this.moverLinha(j, -1)
        if (direcao === 'baixo') this.moverLinha(j, 1)
      }
    }
    this.fundo.atualizar(delta)
    // corações nos cantos de cima do card (P1 à esquerda, P2 à direita)
    this.cursores.forEach((cur, j) => {
      const c = this.cards[cur.indice]
      const travado = this.numJogadores > 1 && this.confirmados[j]
      const x = c.x + (j === 0 ? -1 : 1) * (this.card.largura / 2 - 14)
      const y = c.y - this.card.altura / 2 + 14
      cur.coracao.setPosition(x, y + (travado ? 0 : Math.sin(time / 200 + j) * 2))
    })
  }
}
