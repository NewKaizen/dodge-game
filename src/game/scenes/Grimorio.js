import Phaser from 'phaser'
import Controles from '../controles.js'
import Carta from '../entities/Carta.js'
import Pista from '../pvp/Pista.js'
import { EsquivaBot } from '../pvp/botEsquiva.js'
import { COR_NAIPE } from '../pvp/perfil.js'
import { ataques } from '../attacks/index.js'
import { PAGINAS, cartasDaPagina, gruposDaPagina, tituloDaPagina, fichaDaCarta, previaDaCarta } from '../grimorio/fichas.js'
import { PERSONAGENS } from '../data/personagens.js'
import { CHEFES } from '../coop/chefes/index.js'
import { criarFundo } from '../backgrounds/index.js'
import { tocar } from '../audio.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO, corTexto } from '../constants.js'

// Grimório: todas as cartas do jogo para estudar estratégia (Menu -> Grimorio).
// Páginas: os 7 personagens do PvP (o mesmo baralho vale no CO-OP) e os 4
// chefes do CO-OP. A fileira de baixo tem as cartas da página (por naipe, ou
// por fase no chefe); a carta em foco aparece grande, com os números, o texto
// do PvP e o do CO-OP (no chefe: o que faz e como responder), e a caixa da
// direita roda o ataque dela em loop, com a CPU (EsquivaBot) desviando.
// Textos e prévias vêm de grimorio/fichas.js (lógica pura, testada em Node).
//
//   ←/→ carta (segure para correr) · ↑/↓ página · A: você desvia / devolve
//   para a CPU · B: volta ao Menu (desviando: devolve para a CPU)
//
// Guarda a página e a carta de cada página no registry 'grimorio'.

const ABAS = { y: 32, tamanho: 34, passo: 41, x: 170, folga: 12 } // abas das páginas (personagens, depois chefes)
const INFO = { x: 8, y: 58, largura: 318, altura: 292 } // painel da carta em foco (esquerda)
const PREVIA = { x: 332, y: 58, largura: 300, altura: 292 } // painel da prévia (direita)
const CAIXA = { largura: 220, altura: 170 } // a mesma caixa da arena PvP
const CAMPO = { esquerda: PREVIA.x + 2, direita: PREVIA.x + PREVIA.largura - 2, topo: PREVIA.y + 20, base: PREVIA.y + PREVIA.altura - 20 }
const CARTA_GRANDE = { x: INFO.x + 54, y: INFO.y + 74, escala: 1.3 }
const FILEIRA = { y: 404, largura: 44, passoMax: 34, esquerda: 14, direita: LARGURA - 14, folgaGrupo: 8 }
const REPETIR = { espera: 320, intervalo: 85 } // segurar ←/→
const PAUSA_ENTRE_VOLTAS = 650 // ms entre uma volta da prévia e a próxima
const ESPERA_PREVIA = 260 // ms parado numa carta até a prévia começar (passar rápido não liga caixas à toa)

const COR_TITULO = { pvp: '#ff3d6e', coop: '#6dd0ff' }

export default class Grimorio extends Phaser.Scene {
  constructor() {
    super('Grimorio')
  }

  create() {
    this.controles = new Controles(this)
    this.controles.onBotao((j, botao) => (botao === 'A' ? this.apertarA(j) : this.apertarB()))
    this.controles.onPausa(() => this.apertarB())
    this.saindo = false
    this.segurando = null
    this.controlador = null // jogador que está desviando na prévia (null = CPU)
    this.geracaoPrevia = 0
    this.previa = null
    this.esquiva = new EsquivaBot({ nivel: 'dificil' })
    this.placar = { acertos: 0, dano: 0, grazes: 0 }

    const salvo = this.registry.get('grimorio') ?? {}
    this.indicePagina = Phaser.Math.Clamp(salvo.pagina ?? 0, 0, PAGINAS.length - 1)
    this.indices = { ...(salvo.indices ?? {}) } // carta em foco de cada página

    this.fundo = criarFundo(this, 'jevil')
    this.fundo.escurecer()

    this.montarTopo()
    this.montarPaineis()
    this.montarPista()
    this.ajuda = this.texto(LARGURA / 2, ALTURA - 11, '', 11, TEXTO.desabilitado, { strokeThickness: 0 }).setOrigin(0.5)

    this.cartas = []
    this.rotulosGrupo = []
    this.abrirPagina(this.indicePagina, { animar: false })

    // objetos de fora da caixa não aparecem na câmera de recorte dela (como na PvpArena)
    this.events.on('postupdate', this.filtrarCaixas, this)
    const aoMudar = (_, valor, anterior) => valor !== anterior && !this.saindo && this.scene.restart()
    this.registry.events.on('changedata-numJogadores', aoMudar)
    this.events.once('shutdown', () => {
      this.saindo = true
      this.geracaoPrevia++ // a volta da prévia em andamento para de se repetir
      this.events.off('postupdate', this.filtrarCaixas, this)
      this.registry.events.off('changedata-numJogadores', aoMudar)
      this.pista?.destruir()
      this.pista = null
      if (window.grimorio === this) delete window.grimorio
    })
    if (import.meta.env.DEV) window.grimorio = this

    this.cameras.main.fadeIn(220)
  }

  texto(x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) {
    return this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra })
  }

  get pagina() {
    return PAGINAS[this.indicePagina]
  }

  get cartaAtual() {
    return this.cartas[this.indice]?.dados ?? null
  }

  // cor do personagem / do chefe da página
  corDaPagina(pagina = this.pagina) {
    return pagina.tipo === 'chefe' ? CHEFES[pagina.id].tema.cor : PERSONAGENS[pagina.id]?.cor ?? 0xffffff
  }

  // ---------- montagem ----------

  montarTopo() {
    this.texto(14, 5, 'GRIMÓRIO', 24, TEXTO.selecionado, { strokeThickness: 4 })
    this.nomePagina = this.texto(15, 34, '', 13, TEXTO.normal)

    // abas: personagens do PvP, um respiro e os chefes do CO-OP
    const t = ABAS.tamanho
    let x = ABAS.x
    this.abas = PAGINAS.map((pagina, i) => {
      if (i > 0 && pagina.tipo !== PAGINAS[i - 1].tipo) x += ABAS.folga
      const cx = x + t / 2
      x += ABAS.passo
      const cor = this.corDaPagina(pagina)
      const moldura = this.add.rectangle(cx, ABAS.y, t, t, CORES.painel, 0.9).setStrokeStyle(2, cor, 0.5)
      const sprite = this.add.image(cx, ABAS.y, pagina.tipo === 'chefe' ? CHEFES[pagina.id].sprite : pagina.id)
      sprite.escalaBase = Math.min((t - 6) / sprite.width, (t - 6) / sprite.height)
      sprite.setScale(sprite.escalaBase)
      return { pagina, cx, moldura, sprite, cor }
    })
    // rótulo de cada grupo de abas, por cima delas
    const grupos = [
      { tipo: 'personagem', rotulo: 'PERSONAGENS' },
      { tipo: 'chefe', rotulo: 'CHEFES DO CO-OP' },
    ]
    for (const g of grupos) {
      const doGrupo = this.abas.filter((a) => a.pagina.tipo === g.tipo)
      if (!doGrupo.length) continue
      const meio = (doGrupo[0].cx + doGrupo[doGrupo.length - 1].cx) / 2
      this.texto(meio, ABAS.y - t / 2 - 2, g.rotulo, 9, '#9a9ab0', { strokeThickness: 2 }).setOrigin(0.5, 1)
    }
    this.cursorAba = this.add.image(0, ABAS.y + t / 2 + 4, 'coracao').setTint(CORES.almas[0]).setScale(0.9).setAngle(180).setDepth(5)
  }

  montarPaineis() {
    const painel = (p, cor) => this.add.rectangle(p.x, p.y, p.largura, p.altura, CORES.painel, 0.9).setOrigin(0).setStrokeStyle(2, cor, 0.6)
    this.molduraInfo = painel(INFO, 0xffffff)
    this.molduraPrevia = painel(PREVIA, 0xffffff)

    // à direita da carta grande: nome, tipo e os números
    const x = INFO.x + 110
    const largura = INFO.x + INFO.largura - 8 - x
    this.nomeCarta = this.texto(x, INFO.y + 8, '', 16, TEXTO.normal, { wordWrap: { width: largura, useAdvancedWrap: true }, lineSpacing: -2 })
    this.tipoCarta = this.texto(x, 0, '', 12, TEXTO.normal)
    this.numeros = [0, 1, 2, 3].map(() => ({
      rotulo: this.texto(x, 0, '', 10, '#9a9ab0', { strokeThickness: 2 }),
      valor: this.texto(x + 50, 0, '', 11, TEXTO.normal, { strokeThickness: 2, wordWrap: { width: largura - 50, useAdvancedWrap: true } }),
    }))
    this.larguraNumeros = largura

    // embaixo: os dois textos (PvP e CO-OP; no chefe, o que faz e como responder)
    const larguraTexto = INFO.largura - 20
    this.blocos = [0, 1].map(() => ({
      titulo: this.texto(INFO.x + 10, 0, '', 10, TEXTO.normal, { strokeThickness: 2 }),
      corpo: this.texto(INFO.x + 10, 0, '', 11, TEXTO.normal, { strokeThickness: 0, wordWrap: { width: larguraTexto, useAdvancedWrap: true }, lineSpacing: 2 }),
    }))
    this.separador = this.add.graphics()

    // prévia: o que está rodando (em cima) e o placar da esquiva (embaixo)
    this.rotuloPrevia = this.texto(PREVIA.x + PREVIA.largura / 2, PREVIA.y + 10, '', 10, '#c8c8d8', { strokeThickness: 2 }).setOrigin(0.5)
    this.statusPrevia = this.texto(PREVIA.x + 10, PREVIA.y + PREVIA.altura - 10, '', 10, TEXTO.normal, { strokeThickness: 2 }).setOrigin(0, 0.5)
    this.placarPrevia = this.texto(PREVIA.x + PREVIA.largura - 10, PREVIA.y + PREVIA.altura - 10, '', 10, '#c8c8d8', { strokeThickness: 2 }).setOrigin(1, 0.5)
    this.semAtaque = this.texto(PREVIA.x + PREVIA.largura / 2, PREVIA.y + PREVIA.altura / 2, '', 13, '#c8c8d8', {
      align: 'center',
      wordWrap: { width: PREVIA.largura - 60, useAdvancedWrap: true },
      lineSpacing: 4,
    }).setOrigin(0.5)
  }

  montarPista() {
    this.pista = new Pista(this, {
      x: (CAMPO.esquerda + CAMPO.direita) / 2,
      y: (CAMPO.topo + CAMPO.base) / 2,
      largura: CAIXA.largura,
      altura: CAIXA.altura,
      jogador: 0, // coração vermelho, caixa branca (sem cor de dono)
      velocidadeMax: 300,
      dinamica: { campo: CAMPO },
    })
    this.pista.aoAcertar = (dano) => {
      this.placar.acertos++
      this.placar.dano += dano
    }
    this.pista.aoGraze = () => this.placar.grazes++
  }

  // ---------- páginas e cartas ----------

  abrirPagina(indice, { animar = true, sentido = 1 } = {}) {
    this.indicePagina = (indice + PAGINAS.length) % PAGINAS.length
    const pagina = this.pagina
    const cor = this.corDaPagina()
    const titulo = tituloDaPagina(pagina)
    this.nomePagina.setText(titulo.nome.toUpperCase()).setColor(corTexto(cor))
    this.molduraInfo.setStrokeStyle(2, cor, 0.6)

    this.abas.forEach((a, i) => {
      const sel = i === this.indicePagina
      a.moldura.setStrokeStyle(sel ? 3 : 2, a.cor, sel ? 1 : 0.4).setFillStyle(sel ? 0x1c1830 : CORES.painel, 0.92)
      a.sprite.setAlpha(sel ? 1 : 0.45)
      this.tweens.killTweensOf([a.moldura, a.sprite])
      this.tweens.add({ targets: a.sprite, scale: a.sprite.escalaBase * (sel ? 1.12 : 1), duration: 140, ease: 'Back.easeOut' })
    })
    this.cursorAba.setX(this.abas[this.indicePagina].cx)

    // fileira nova (a velha some descendo)
    for (const c of this.cartas) {
      this.tweens.killTweensOf(c)
      if (!animar) c.destroy()
      else this.tweens.add({ targets: c, y: c.y + 30, alpha: 0, duration: 140, onComplete: () => c.destroy() })
    }
    this.rotulosGrupo.forEach((r) => r.destroy())
    const lista = cartasDaPagina(pagina)
    const grupos = gruposDaPagina(pagina)
    const posicoes = this.posicoesDaFileira(lista.length, grupos)
    const corCarta = pagina.tipo === 'chefe' ? cor : undefined
    this.cartas = lista.map((dados, i) => {
      const c = new Carta(this, posicoes[i], FILEIRA.y, dados, { largura: FILEIRA.largura, cor: corCarta, corFoco: CORES.selecionado }).setDepth(20 + i)
      if (animar) {
        c.setAlpha(0).setY(FILEIRA.y + 26 * sentido)
        this.tweens.add({ targets: c, y: FILEIRA.y, alpha: 1, duration: 200, delay: i * 12, ease: 'Cubic.easeOut' })
      }
      return c
    })
    this.rotulosGrupo = grupos.map((g) => {
      const meio = (posicoes[g.inicio] + posicoes[g.fim]) / 2
      const naipe = lista[g.inicio].naipe
      const cor = g.rotulo === '★' ? '#ffe14a' : pagina.tipo === 'chefe' ? '#c8c8d8' : corTexto(COR_NAIPE[naipe])
      return this.texto(meio, FILEIRA.y + FILEIRA.largura * 0.71 + 10, g.rotulo, 9, cor, { strokeThickness: 2 }).setOrigin(0.5, 0)
    })

    const guardado = this.indices[pagina.id] ?? 0
    this.indice = -1
    this.focarCarta(Phaser.Math.Clamp(guardado, 0, this.cartas.length - 1), { som: false })
  }

  // x de cada carta: um leque que cabe na tela, com um respiro entre os grupos
  posicoesDaFileira(n, grupos) {
    const larguraUtil = FILEIRA.direita - FILEIRA.esquerda - FILEIRA.largura - FILEIRA.folgaGrupo * (grupos.length - 1)
    const passo = Math.min(FILEIRA.passoMax, larguraUtil / Math.max(1, n - 1))
    const total = passo * (n - 1) + FILEIRA.folgaGrupo * (grupos.length - 1)
    let x = LARGURA / 2 - total / 2
    const xs = []
    grupos.forEach((g, k) => {
      if (k > 0) x += FILEIRA.folgaGrupo
      for (let i = g.inicio; i <= g.fim; i++) {
        xs[i] = x
        if (i < n - 1) x += passo
      }
    })
    return xs
  }

  focarCarta(indice, { som = true } = {}) {
    const n = this.cartas.length
    const novo = (indice + n) % n
    if (novo === this.indice) return
    const anterior = this.cartas[this.indice]
    if (anterior) anterior.focar(false).setDepth(20 + this.indice)
    this.indice = novo
    this.indices[this.pagina.id] = novo
    this.registry.set('grimorio', { pagina: this.indicePagina, indices: { ...this.indices } })
    const carta = this.cartas[novo]
    carta.focar(true).setDepth(60)
    if (som) tocar(this, 'mover')
    this.mostrarFicha(carta.dados)
    this.prepararPrevia(carta.dados)
  }

  // ---------- ficha da carta em foco ----------

  mostrarFicha(dados) {
    const pagina = this.pagina
    const cor = this.corDaPagina()
    this.cartaGrande?.destroy()
    this.cartaGrande = new Carta(this, CARTA_GRANDE.x, CARTA_GRANDE.y, dados, { largura: 70, cor: pagina.tipo === 'chefe' ? cor : undefined }).setDepth(10)
    this.cartaGrande.setScale(CARTA_GRANDE.escala * 0.85)
    this.tweens.add({ targets: this.cartaGrande, scale: CARTA_GRANDE.escala, duration: 180, ease: 'Back.easeOut' })

    const ficha = fichaDaCarta(dados)
    const corTipo = dados.valor === 14 ? '#ffe14a' : corTexto(COR_NAIPE[dados.naipe])
    this.caber(this.nomeCarta, dados.nome.toUpperCase(), 16, 2)
    this.nomeCarta.setColor(corTexto(cor))
    let y = this.nomeCarta.y + this.nomeCarta.height + 4
    this.tipoCarta.setText(ficha.tipo).setColor(corTipo).setY(y)
    y += this.tipoCarta.height + 8
    this.numeros.forEach((linha, i) => {
      const n = ficha.numeros[i]
      linha.rotulo.setText(n?.rotulo ?? '').setY(y + 1)
      linha.valor.setText(n?.valor ?? '').setY(y)
      if (n) y += linha.valor.height + 3
    })

    // textos: começam embaixo da carta grande (ou dos números, se passarem dela)
    const topo = Math.max(CARTA_GRANDE.y + 50 * CARTA_GRANDE.escala + 10, y + 4)
    this.separador.clear().lineStyle(1, 0xffffff, 0.15).lineBetween(INFO.x + 10, topo - 5, INFO.x + INFO.largura - 10, topo - 5)
    const base = INFO.y + INFO.altura - 6
    // a maior fonte que deixa os dois textos dentro do painel
    for (let tam = 12; tam >= 8; tam--) {
      let yy = topo
      ficha.textos.forEach((t, k) => {
        const b = this.blocos[k]
        const corTitulo = t.modo === 'chefe' ? corTexto(cor) : COR_TITULO[t.modo] ?? TEXTO.normal
        b.titulo.setText(t.titulo).setColor(corTitulo).setFontSize(Math.max(9, tam - 1)).setY(yy)
        yy += b.titulo.height + 1
        b.corpo.setText(t.texto).setFontSize(tam).setY(yy)
        yy += b.corpo.height + 6
      })
      if (yy - 6 <= base) break
    }
  }

  // Põe o texto em no máximo `linhas` linhas, diminuindo a fonte (até 4 px a menos)
  caber(texto, conteudo, tamanho, linhas) {
    texto.setText(conteudo)
    for (let t = tamanho; t >= tamanho - 4; t--) {
      texto.setFontSize(t)
      const alturaLinha = t * 1.25
      if (texto.height <= alturaLinha * linhas + 2) return
    }
  }

  // ---------- prévia do ataque ----------

  prepararPrevia(dados) {
    const geracao = ++this.geracaoPrevia
    this.pista.parar()
    this.previa = previaDaCarta(dados, ataques)
    this.placar = { acertos: 0, dano: 0, grazes: 0 }
    if (this.previa.semAtaque) {
      this.pista.esconder()
      this.rotuloPrevia.setText('PRÉVIA DO ATAQUE')
      this.semAtaque.setText(this.previa.semAtaque).setVisible(true)
      return
    }
    this.semAtaque.setVisible(false)
    this.rotuloPrevia.setText(`PRÉVIA · ${this.previa.rotulo}`)
    this.time.delayedCall(ESPERA_PREVIA, () => this.rodarPrevia(geracao))
  }

  // Roda o ataque da carta em loop enquanto ela continuar em foco
  async rodarPrevia(geracao) {
    const previa = this.previa
    let volta = 0
    while (!this.saindo && geracao === this.geracaoPrevia) {
      this.pista.tema = previa.tema
      this.pista.velocidadeMaxBase = previa.velocidadeMax
      this.placar = { acertos: 0, dano: 0, grazes: 0 }
      this.esquiva.reiniciar()
      await this.pista.rodar(previa.criar(), { dano: previa.dano, ritmo: previa.ritmo, semente: `grimorio:${this.cartaAtual?.id}:${volta++}` })
      if (this.saindo || geracao !== this.geracaoPrevia) return
      await new Promise((resolver) => this.time.delayedCall(PAUSA_ENTRE_VOLTAS, resolver))
    }
  }

  // ---------- entrada ----------

  apertarA(jogador) {
    if (this.saindo) return
    if (this.controlador !== null) return this.devolverParaCpu()
    if (this.previa?.semAtaque) return tocar(this, 'erro')
    this.controlador = jogador
    this.segurando = null
    tocar(this, 'confirmar')
  }

  apertarB() {
    if (this.saindo) return
    if (this.controlador !== null) return this.devolverParaCpu()
    this.saindo = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start('Menu'))
  }

  devolverParaCpu() {
    this.controlador = null
    this.esquiva.reiniciar()
    tocar(this, 'cancelar')
  }

  navegar(direcao, j, time) {
    if (direcao === 'esquerda' || direcao === 'direita') {
      const passo = direcao === 'direita' ? 1 : -1
      this.focarCarta(this.indice + passo)
      this.segurando = { j, passo, proximo: time + REPETIR.espera }
    } else if (direcao === 'cima' || direcao === 'baixo') {
      const passo = direcao === 'baixo' ? 1 : -1
      tocar(this, 'mover')
      this.abrirPagina(this.indicePagina + passo, { sentido: passo })
    }
  }

  // joystick do coração da prévia: o do jogador que pegou o controle ou o da CPU
  joyDaPrevia(delta, invertido) {
    if (this.controlador !== null) return this.controles.joy(this.controlador)
    const pista = this.pista
    const coracao = pista.coracoes[0]
    if (!pista.rodando || !coracao?.ativo) return { x: 0, y: 0 }
    return this.esquiva.joy(delta, {
      coracao,
      limites: pista.caixa.limites,
      balas: pista.balas.lista,
      velocidade: pista.velocidadeCoracao,
      fatorVelocidade: pista.balas.fatorVelocidade,
      velocidadeMax: pista.balas.velocidadeMax,
      invertido,
    })
  }

  // As câmeras de recorte das caixas desenham tudo o que não foi ignorado:
  // o que é de fora da caixa (fundo, painéis, cartas) fica só na principal
  filtrarCaixas() {
    const caixas = this.caixasDeRecorte
    if (!caixas?.length) return
    const principal = this.cameras.main.id
    let mascara = 0
    for (const caixa of caixas) mascara |= caixa.camera.id
    for (const o of this.children.list) {
      if (o.cameraFilter & principal) continue
      if ((o.cameraFilter & mascara) !== mascara) o.cameraFilter |= mascara
    }
  }

  update(time, delta) {
    this.controles.atualizar()
    this.fundo.atualizar(delta)
    if (this.saindo || !this.pista) return

    if (this.controlador === null) {
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const d = this.controles.toque(j)
        if (d) this.navegar(d, j, time)
      }
      // segurando ←/→: corre pelas cartas
      const s = this.segurando
      if (s) {
        const x = this.controles.joy(s.j).x
        if (Math.sign(x) !== s.passo || Math.abs(x) < 50) this.segurando = null
        else if (time >= s.proximo) {
          this.focarCarta(this.indice + s.passo)
          s.proximo = time + REPETIR.intervalo
        }
      }
    }

    // ♦ Q/K e cartas do chefe que invertem: valem enquanto o ataque roda (para a CPU também)
    const invertendo = Boolean(this.previa?.inverter) && this.pista.atacando
    let joy = this.joyDaPrevia(delta, invertendo)
    if (invertendo) joy = { x: -joy.x, y: -joy.y }
    this.pista.atualizar(delta, joy)

    this.atualizarTextosPrevia(time, invertendo)
    this.cursorAba.setY(ABAS.y + ABAS.tamanho / 2 + 5 + Math.sin(time / 180) * 1.5)
  }

  atualizarTextosPrevia(time, invertendo) {
    const voce = this.controlador !== null
    const quem = this.controles.numJogadores > 1 ? ` (P${this.controlador + 1})` : ''
    if (this.previa?.semAtaque) {
      this.statusPrevia.setText('')
      this.placarPrevia.setText('')
    } else if (invertendo && Math.floor(time / 180) % 2) {
      this.statusPrevia.setText('CONTROLES INVERTIDOS!').setColor('#ff9a3a')
    } else {
      this.statusPrevia.setText(voce ? `VOCÊ DESVIA${quem}` : 'CPU DESVIANDO').setColor(voce ? TEXTO.selecionado : TEXTO.guarda)
    }
    if (!this.previa?.semAtaque) {
      const { acertos, dano, grazes } = this.placar
      this.placarPrevia.setText(`${acertos} acerto${acertos === 1 ? '' : 's'}${dano ? ` (-${dano} HP)` : ''} · ${grazes} graze${grazes === 1 ? '' : 's'}`)
    }
    const ajuda = voce ? 'direcional: mover o coração      A ou B: devolver para a CPU' : '←→ carta      ↑↓ página      A: você desvia      B: voltar'
    if (this.ajuda.text !== ajuda) this.ajuda.setText(ajuda)
  }
}
