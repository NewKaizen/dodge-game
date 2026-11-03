import Phaser from 'phaser'
import { get } from 'svelte/store'
import Controles from '../controles.js'
import { jogo } from '../../lib/estado.js'
import { criarRng } from '../pvp/baralho.js'
import { tocar } from '../audio.js'
import { LARGURA, ALTURA, CORACAO, TEMPOS } from '../constants.js'
import { fatores } from '../acessibilidade.js'
import { menosMovimento, pref } from '../preferencias.js'
import { normalizarTeclas } from '../teclas.js'
import { desenharTracos, cortarTracos, coracaoGiz, retanguloGiz, circuloGiz, estrelaGiz } from '../manual/giz.js'
import { gerarPapel } from '../manual/papel.js'
import { dicasDeBotoes } from '../manual/botoes.js'
import { criarPagina1, SOBREVIVER_MS, RAIO_BALA } from '../manual/pagina1.js'
import { CORES_GIZ, rabiscoDoRalsei, rabiscoDoCoracao, rabiscoDaBala, rabiscoDaMarca, rabiscoDaSeta, sublinhado, rabiscosDaMargem } from '../manual/ilustracoes.js'

// O MANUAL INTERATIVO DO RALSEI, protótipo de UMA página (Fase 3A; conceito e como somar páginas em
// docs/manual-ralsei.md). Menu -> GUIA -> "MANUAL DO RALSEI (prévia)".
//
// Uma folha de papel com desenhos de giz de cera que ganham vida: o Ralsei fala num balão, o giz
// desenha a caixa e o coração, o jogador leva o coração (de verdade: o mesmo movimento e a mesma
// hitbox do jogo) até 3 marcas e depois desvia de 6 bolinhas lentas por 8 s. Acertou: incentivo e
// recomeça só a parte das bolinhas. Terminou: adesivo "PÁGINA 1 ✓" e a folha vira para uma página
// "continua…". Regras e estados: manual/pagina1.js (puro, testado). Traço de giz: manual/giz.js.
//
//   mover: o coração (teclado/controle/joystick) · A: continuar / tentar já / virar · B: volta ao Menu
//
// "Reduzir animações": giz parado (sem o tremidinho de redesenho), texto do balão inteiro de uma vez,
// folha troca sem animação. Nenhum clarão. A jogabilidade é a mesma em qualquer ajuste.
// No dev: window.manualRalsei.

const CAIXA = { esquerda: 440, direita: 780, topo: 148, base: 348 }
const VARIANTES = 3 // quantos "desenhos" diferentes de cada traço alternam (o tremidinho do giz)
const TROCA_MS = 170 // de quanto em quanto tempo o giz troca de variante
const BALAO = { x: 34, y: 88, largura: 340, altura: 128 }
const RALSEI = { x: 150, y: 372 }
const FONTE_TEXTO = 'Verdana, "DejaVu Sans", "Segoe UI", Arial, sans-serif' // fonte clara com acentos (não decorativa)
const TINTA = '#2b2540'
const VIRADA_MS = 900

// A instância da cena é REAPROVEITADA pelo Phaser: o que a abertura anterior deixou aqui (objetos
// destruídos, flags) volta ao inicial no começo do init(). Testado em __tests__/cenasReaproveitadas.test.js.
const estadoInicial = () => ({
  pagina: null,
  controles: null,
  folha: null,
  proxima: null,
  sombraVirada: null,
  gCaixa: null,
  gCoracao: null,
  gMarcas: null,
  gSeta: null,
  gGolpe: null,
  gBarra: null,
  gSlots: null,
  balaoTexto: null,
  balaoSeta: null,
  titulo: null,
  dicas: null,
  rotuloVoce: null,
  adesivoFinal: null,
  contador: null,
  variantes: null,
  fase: 0,
  proximaTroca: 0,
  digitado: 0,
  textoAtual: '',
  dicaAtual: '',
  saindo: false,
  virando: false,
  calmo: false,
  balasG: null,
  setaVisivel: false,
  piscaSeta: 0,
  setaPintada: false,
  proxDicas: null,
})

export default class ManualRalsei extends Phaser.Scene {
  constructor() {
    super('ManualRalsei')
  }

  init() {
    Object.assign(this, estadoInicial())
  }

  create() {
    this.calmo = menosMovimento() || fatores().tremor === 0 // "reduzir animações": giz parado
    this.rng = criarRng(`manual:p1:${Date.now() % 100000}`)
    this.pagina = criarPagina1({ caixa: CAIXA, velocidade: this.registry.get('velocidade') ?? CORACAO.velocidadePadrao })
    this.controles = new Controles(this)
    this.controles.onBotao((j, botao) => (botao === 'A' ? this.apertarA() : this.apertarB()))
    this.controles.onPausa(() => this.apertarB())

    this.garantirPapel()
    this.montarProxima()
    this.montarFolha()
    this.sombraVirada = this.add.rectangle(0, 0, LARGURA, ALTURA, 0x1a1020, 0).setOrigin(0).setDepth(60)

    this.cameras.main.fadeIn(240)
    if (import.meta.env.DEV) window.manualRalsei = this
    this.events.once('shutdown', () => {
      if (window.manualRalsei === this) delete window.manualRalsei
    })
    this.dizer(this.pagina.fala)
    this.atualizarDicas()
  }

  // ---------- papel ----------

  garantirPapel() {
    if (this.textures.exists('manual-papel')) return
    const tex = this.textures.createCanvas('manual-papel', LARGURA, ALTURA)
    const ctx = tex.getContext()
    const img = ctx.createImageData(LARGURA, ALTURA)
    img.data.set(gerarPapel(LARGURA, ALTURA, 'manual'))
    ctx.putImageData(img, 0, 0)
    // pautas azuis bem fracas e a margem vermelha, como caderno
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(86,126,190,0.20)'
    for (let y = 44; y < ALTURA; y += 26) {
      ctx.beginPath()
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(LARGURA, y + 0.5)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(214,80,92,0.28)'
    ctx.beginPath()
    ctx.moveTo(28.5, 0)
    ctx.lineTo(28.5, ALTURA)
    ctx.stroke()
    // fibras do papel
    const r = criarRng('fibras')
    ctx.lineWidth = 1
    for (let i = 0; i < 520; i++) {
      const x = (r.s = (r.s * 1664525 + 1013904223) >>> 0) % LARGURA
      const y = (r.s = (r.s * 1664525 + 1013904223) >>> 0) % ALTURA
      const a = ((r.s = (r.s * 1664525 + 1013904223) >>> 0) % 628) / 100
      ctx.strokeStyle = i % 3 ? 'rgba(150,120,80,0.07)' : 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7)
      ctx.stroke()
    }
    tex.refresh()
  }

  // ---------- montagem ----------

  g(depth = 5) {
    return this.add.graphics().setDepth(depth)
  }

  texto(x, y, conteudo, tamanho, extra = {}) {
    return this.add.text(x, y, conteudo, { fontFamily: FONTE_TEXTO, fontSize: `${tamanho}px`, color: TINTA, ...extra })
  }

  // tudo da página 1 vai no container `folha` (a virada de página encolhe ele contra a lombada)
  montarFolha() {
    const folha = (this.folha = this.add.container(0, 0).setDepth(20))
    const add = (...o) => {
      folha.add(o)
      return o[0]
    }
    add(this.add.image(0, 0, 'manual-papel').setOrigin(0))
    // margens rabiscadas a lápis
    const margem = this.g(1)
    desenharTracos(margem, rabiscosDaMargem(this.rng, LARGURA, ALTURA, { esquerda: 30, direita: 800, topo: 30, base: 440 }), { cor: 0x6a6a82, largura: 1.6, alpha: 0.45, grao: 0.5 })
    add(margem)

    // título
    this.titulo = add(this.texto(52, 22, 'PÁGINA 1', 13, { fontStyle: 'bold', color: '#7a6a9a' }))
    add(this.texto(52, 38, 'Este é o seu coração', 24, { fontStyle: 'bold' }))
    const risco = this.g(2)
    desenharTracos(risco, sublinhado(this.rng, 52, 72, 292), { cor: CORES_GIZ.coracao, largura: 3, alpha: 0.8 })
    add(risco)

    this.montarRalsei(add)
    this.montarBalao(add)

    // a caixa (papel mais claro por dentro: bolinhas e coração sempre legíveis) e as variantes de giz
    const c = CAIXA
    add(this.add.rectangle(c.esquerda, c.topo, c.direita - c.esquerda, c.base - c.topo, 0xfffbf0, 0.9).setOrigin(0).setDepth(2))
    this.variantes = {
      caixa: Array.from({ length: VARIANTES }, () => retanguloGiz(this.rng, c.esquerda, c.topo, c.direita - c.esquerda, c.base - c.topo, { tremor: 1.5, excesso: 5, tracos: 2 })),
      coracao: Array.from({ length: VARIANTES }, () => rabiscoDoCoracao(this.rng, 22)),
      bala: Array.from({ length: VARIANTES }, () => rabiscoDaBala(this.rng, RAIO_BALA)),
      marcas: this.pagina.marcas.map((m) => Array.from({ length: VARIANTES }, () => rabiscoDaMarca(this.rng, m.forma))),
      seta: rabiscoDaSeta(this.rng, 672, 188, 628, 232),
    }
    this.gCaixa = add(this.g(3))
    this.gMarcas = add(this.g(4))
    this.gSeta = add(this.g(4))
    this.rotuloVoce = add(this.texto(654, 160, 'você!', 17, { fontStyle: 'bold', color: '#e5243b' }).setDepth(4).setVisible(false))
    this.gSlots = add(this.g(4))
    this.gBarra = add(this.g(4))
    this.balasG = Array.from({ length: 8 }, () => add(this.g(7).setVisible(false)))
    this.gCoracao = add(this.g(8).setVisible(false))
    this.gGolpe = add(this.g(9))
    this.contador = add(this.texto((c.esquerda + c.direita) / 2, c.base + 14, '', 13, { color: '#5a4a6a', fontStyle: 'bold' }).setOrigin(0.5, 0))

    // adesivo de página concluída (escondido até o fim)
    this.adesivoFinal = this.montarAdesivoFinal()
    add(this.adesivoFinal)

    this.dicas = add(this.texto(LARGURA / 2, ALTURA - 20, '', 14, { color: '#5a4a6a', fontStyle: 'bold' }).setOrigin(0.5).setDepth(10))
    this.desenharSlots()
    this.redesenhar(true)
  }

  montarRalsei(add) {
    const g = this.g(3)
    for (const l of rabiscoDoRalsei(criarRng('ralsei'))) desenharTracos(g, l.tracos, { cor: l.cor, largura: l.largura, alpha: l.alpha ?? 0.92, grao: 0.3 })
    g.setPosition(RALSEI.x, RALSEI.y)
    add(g)
    add(this.texto(RALSEI.x, RALSEI.y + 90, 'RALSEI', 12, { fontStyle: 'bold', color: '#7a6a9a' }).setOrigin(0.5, 0))
  }

  montarBalao(add) {
    const b = BALAO
    const g = this.g(3)
    g.fillStyle(0xffffff, 0.94)
    g.fillRoundedRect(b.x, b.y, b.largura, b.altura, 18)
    g.fillTriangle(b.x + 70, b.y + b.altura - 2, b.x + 110, b.y + b.altura - 2, b.x + 110, b.y + b.altura + 44)
    const rng = criarRng('balao')
    desenharTracos(g, retanguloGiz(rng, b.x, b.y, b.largura, b.altura, { tremor: 1.2, excesso: 5 }), { cor: CORES_GIZ.tinta, largura: 2.6, alpha: 0.85 })
    desenharTracos(
      g,
      [
        [{ x: b.x + 70, y: b.y + b.altura }, { x: b.x + 112, y: b.y + b.altura + 46 }, { x: b.x + 112, y: b.y + b.altura }],
      ],
      { cor: CORES_GIZ.tinta, largura: 2.4, alpha: 0.85 },
    )
    add(g)
    this.balaoTexto = add(
      this.texto(b.x + 18, b.y + 16, '', 17, { fontStyle: 'bold', wordWrap: { width: b.largura - 36 }, lineSpacing: 5 }).setDepth(6),
    )
    this.balaoSeta = add(this.texto(b.x + b.largura - 24, b.y + b.altura - 26, '▶', 16, { color: '#7a6a9a', fontStyle: 'bold' }).setDepth(6).setVisible(false))
  }

  montarAdesivoFinal() {
    const c = this.add.container((CAIXA.esquerda + CAIXA.direita) / 2, (CAIXA.topo + CAIXA.base) / 2).setDepth(12).setVisible(false)
    const g = this.g(1)
    g.fillStyle(0x000000, 0.12)
    g.fillCircle(4, 6, 88)
    g.fillStyle(0xfff3b0, 1)
    g.fillCircle(0, 0, 86)
    const r = criarRng('adesivo')
    desenharTracos(g, circuloGiz(r, 0, 0, 86, { tremor: 1.2 }), { cor: CORES_GIZ.marca, largura: 4, alpha: 0.95 })
    desenharTracos(g, circuloGiz(r, 0, 0, 74, { tremor: 1, tracos: 1 }), { cor: CORES_GIZ.marca, largura: 2, alpha: 0.7 })
    desenharTracos(g, estrelaGiz(r, 0, -44, 12, { tremor: 0.6 }), { cor: CORES_GIZ.marca, largura: 3 })
    const a = this.texto(0, -8, 'PÁGINA 1', 28, { fontStyle: 'bold' }).setOrigin(0.5)
    const b = this.texto(0, 30, '✓', 44, { fontStyle: 'bold', color: '#2da44e' }).setOrigin(0.5)
    c.add([g, a, b])
    c.setAngle(-9)
    return c
  }

  // a "página 2": ainda não existe, só um recado
  montarProxima() {
    const c = (this.proxima = this.add.container(0, 0).setDepth(10).setVisible(false))
    c.add(this.add.image(0, 0, 'manual-papel').setOrigin(0))
    const g = this.g(1)
    const r = criarRng('proxima')
    desenharTracos(g, rabiscosDaMargem(r, LARGURA, ALTURA, { esquerda: 30, direita: 800, topo: 30, base: 440 }), { cor: 0x6a6a82, largura: 1.6, alpha: 0.45, grao: 0.5 })
    desenharTracos(g, sublinhado(r, 250, 270, 600), { cor: CORES_GIZ.coracao, largura: 4, alpha: 0.85 })
    desenharTracos(g, sublinhado(r, 258, 280, 560), { cor: CORES_GIZ.grafite, largura: 3, alpha: 0.6 })
    desenharTracos(g, coracaoGiz(r, 640, 205, 40, { tremor: 1 }), { cor: CORES_GIZ.coracao, largura: 3.4 })
    c.add(g)
    c.add(this.texto(52, 22, 'PÁGINA 2', 13, { fontStyle: 'bold', color: '#7a6a9a' }))
    c.add(this.texto(LARGURA / 2, 215, 'continua…', 64, { fontStyle: 'bold italic', color: '#2b2540' }).setOrigin(0.5))
    c.add(this.texto(LARGURA / 2, 310, 'O Ralsei ainda está desenhando esta página.', 16, { color: '#5a4a6a' }).setOrigin(0.5))
    this.proxDicas = this.texto(LARGURA / 2, ALTURA - 20, '', 14, { color: '#5a4a6a', fontStyle: 'bold' }).setOrigin(0.5)
    c.add(this.proxDicas)
  }

  // ---------- desenho das variantes ----------

  desenharSlots() {
    const g = this.gSlots.clear()
    const n = this.pagina.marcas.length
    const cx = (CAIXA.esquerda + CAIXA.direita) / 2
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * 44
      const pega = this.pagina.marcas[i].pega
      desenharTracos(g, circuloGiz(criarRng(`slot${i}`), x, CAIXA.topo - 28, 15, { tremor: 0.9, tracos: 1 }), { cor: pega ? CORES_GIZ.marca : 0x9a94ad, largura: pega ? 3 : 2, alpha: pega ? 0.95 : 0.7 })
      if (pega) {
        g.fillStyle(0xfff3b0, 1)
        g.fillCircle(x, CAIXA.topo - 28, 13)
        desenharTracos(g, estrelaGiz(criarRng(`st${i}`), x, CAIXA.topo - 28, 9, { tremor: 0.4 }), { cor: CORES_GIZ.marca, largura: 2.6 })
      }
    }
  }

  // repinta o que muda (a cada troca de variante do giz e a cada passo do desenho inicial)
  redesenhar(forcar = false) {
    const p = this.pagina
    const v = this.fase
    const d = p.desenho
    if (p.etapa !== 'intro' || forcar) {
      this.gCaixa.clear()
      if (d.caixa > 0) desenharTracos(this.gCaixa, this.variantes.caixa[v], { cor: CORES_GIZ.grafite, largura: 3.2, progresso: d.caixa })
    }
    this.gMarcas.clear()
    if (d.marcas > 0)
      p.marcas.forEach((m, i) => {
        const g = this.gMarcas
        const tracos = this.variantes.marcas[i][v].map((t) => t.map((q) => ({ x: q.x + m.x, y: q.y + m.y })))
        if (m.pega) {
          g.fillStyle(0xfff3b0, 0.9)
          g.fillCircle(m.x, m.y, 14)
        }
        desenharTracos(g, tracos, { cor: m.forma === 'x' ? CORES_GIZ.marcaX : CORES_GIZ.marca, largura: m.pega ? 3 : 3.4, progresso: d.marcas, alpha: m.pega ? 0.5 : 0.95 })
      })
    this.redesenharCoracao()
    this.redesenharBalas()
  }

  redesenharCoracao() {
    const p = this.pagina
    const d = p.desenho.coracao
    this.gCoracao.setVisible(d > 0)
    if (d <= 0) return
    const v = this.variantes.coracao[this.fase]
    const g = this.gCoracao.clear()
    const ferido = p.etapa === 'tentarDeNovo'
    const alpha = ferido ? 0.45 : 1
    desenharTracos(g, cortarTracos([...v.contorno, ...v.preenchimento], d), { cor: CORES_GIZ.coracao, largura: 2.6, alpha: 0.95 * alpha, grao: 0.2 })
    // o miolo que leva dano (raio = CORACAO.hitbox): sempre o mesmo círculo exato, sem tremor
    if (d >= 1) {
      g.fillStyle(0xfff8f8, alpha)
      g.fillCircle(0, 0, CORACAO.hitbox)
      g.lineStyle(1.2, 0x7a0f20, alpha)
      g.strokeCircle(0, 0, CORACAO.hitbox)
    }
    g.setPosition(p.coracao.x, p.coracao.y)
  }

  redesenharBalas() {
    const lista = this.pagina.balas
    this.balasG.forEach((g, i) => {
      const b = lista[i]
      g.setVisible(Boolean(b))
      if (!b) return
      if (g.variante !== this.fase || g.dono !== b) {
        g.variante = this.fase
        g.dono = b
        g.clear()
        const v = this.variantes.bala[(this.fase + b.semente) % VARIANTES]
        desenharTracos(g, v.preenchimento, { cor: CORES_GIZ.balaMiolo, largura: 2, alpha: 0.9, grao: 0.25 })
        desenharTracos(g, v.contorno, { cor: CORES_GIZ.bala, largura: 2.6, alpha: 0.98, grao: 0.2 })
      }
      g.setPosition(b.x, b.y)
      // ainda chegando (bala inteira fora da caixa): meio apagada, como a faixa de aproximação do jogo
      const fora = b.x + b.raio < CAIXA.esquerda || b.x - b.raio > CAIXA.direita || b.y + b.raio < CAIXA.topo || b.y - b.raio > CAIXA.base
      g.setAlpha(fora ? 0.5 : 1)
    })
  }

  // ---------- texto e dicas ----------

  dizer(texto, instantaneo = false) {
    this.textoAtual = texto
    this.digitado = this.calmo || instantaneo ? texto.length : 0
    this.balaoTexto.setText(texto.slice(0, this.digitado))
  }

  get digitando() {
    return this.digitado < this.textoAtual.length
  }

  atualizarDicas() {
    const f = get(jogo).fonte
    const teclas = normalizarTeclas(pref('teclas'))
    const d = dicasDeBotoes(f, teclas)
    const p = this.pagina
    const sair = `${d.B}: sair`
    let linha
    if (p.etapa === 'intro') linha = `${d.A}: continuar      ${sair}`
    else if (p.etapa === 'concluida') linha = `${d.A}: virar a página      ${sair}`
    else if (p.etapa === 'fim') linha = `${d.A}: ver a página 1 de novo      ${sair}`
    else if (p.etapa === 'tentarDeNovo') linha = `${d.A}: tentar já      ${sair}`
    else if (p.etapa === 'desenhando') linha = sair
    else linha = `${d.mover}: mover o coração      ${sair}`
    if (linha === this.dicaAtual) return
    this.dicaAtual = linha
    this.dicas.setText(linha)
    this.proxDicas?.setText(linha)
  }

  // ---------- entrada ----------

  apertarA() {
    if (this.saindo || this.virando) return
    if (this.digitando) {
      this.digitado = this.textoAtual.length
      this.balaoTexto.setText(this.textoAtual)
      return
    }
    if (this.pagina.etapa === 'fim') {
      tocar(this, 'confirmar')
      this.saindo = true
      this.cameras.main.fadeOut(200, 0, 0, 0)
      this.time.delayedCall(220, () => this.scene.restart())
      return
    }
    if (this.pagina.avancar()) tocar(this, 'confirmar')
  }

  apertarB() {
    if (this.saindo) return
    this.saindo = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start('Menu'))
  }

  // ---------- quadro a quadro ----------

  update(tempo, delta) {
    if (!this.pagina) return
    const p = this.pagina
    if (!this.virando) {
      const joy = this.controles.joy(0)
      p.tick(delta, joy)
    }
    // digitação do balão
    if (this.digitando) {
      const antes = this.digitado
      this.digitado = Math.min(this.textoAtual.length, this.digitado + Math.max(1, Math.round(delta / TEMPOS.letraMs)))
      this.balaoTexto.setText(this.textoAtual.slice(0, this.digitado))
      if (Math.floor(antes / 4) !== Math.floor(this.digitado / 4)) tocar(this, 'texto')
    }
    this.balaoSeta.setVisible(!this.digitando && ['intro', 'concluida', 'tentarDeNovo'].includes(p.etapa) && (this.calmo || Math.floor(tempo / 450) % 2 === 0))

    const eventos = p.drenar()
    for (const e of eventos) this.aoEvento(e)

    // tremidinho do giz
    let mudou = false
    if (!this.calmo && tempo >= this.proximaTroca) {
      this.fase = (this.fase + 1) % VARIANTES
      this.proximaTroca = tempo + TROCA_MS
      mudou = true
    }
    if (p.etapa === 'desenhando' || mudou || eventos.length) this.redesenhar()
    else {
      this.gCoracao.setPosition(p.coracao.x, p.coracao.y)
      this.redesenharBalas()
    }
    this.atualizarSeta()
    this.atualizarBarra()
    this.atualizarDicas()
  }

  aoEvento(e) {
    const p = this.pagina
    if (e.tipo === 'fala') this.dizer(p.fala)
    if (e.tipo === 'etapa') {
      this.dizer(p.fala)
      if (e.etapa === 'desenhando') tocar(this, 'mover')
      if (e.etapa === 'marcas') {
        this.setaVisivel = true
        this.rotuloVoce.setVisible(true)
      }
      if (e.etapa === 'desviar') this.gGolpe.clear()
      if (e.etapa === 'concluida') this.concluir()
      if (e.etapa === 'virando') this.virarPagina()
    }
    if (e.tipo === 'marca') {
      tocar(this, 'graze')
      this.dizer(p.fala, true)
      this.setaVisivel = false
      this.rotuloVoce.setVisible(false)
      this.desenharSlots()
      this.surgirAdesivo(e.indice)
    }
    if (e.tipo === 'acerto') {
      tocar(this, 'dano')
      this.marcarGolpe()
    }
  }

  // o "aaai" de ter sido atingido: riscos de giz em volta do coração (parado, sem clarão)
  marcarGolpe() {
    const p = this.pagina
    const g = this.gGolpe.clear()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.2832 + 0.2
      const x0 = p.coracao.x + Math.cos(a) * 17
      const y0 = p.coracao.y + Math.sin(a) * 17
      desenharTracos(g, [[{ x: x0, y: y0 }, { x: p.coracao.x + Math.cos(a) * 28, y: p.coracao.y + Math.sin(a) * 28 }]], { cor: CORES_GIZ.coracao, largura: 3, alpha: 0.9 })
    }
  }

  surgirAdesivo(i) {
    const n = this.pagina.marcas.length
    const x = (CAIXA.esquerda + CAIXA.direita) / 2 + (i - (n - 1) / 2) * 44
    const brilho = this.add.text(x, CAIXA.topo - 28, '★', { fontFamily: FONTE_TEXTO, fontSize: '26px', color: '#e0a000' }).setOrigin(0.5).setDepth(11)
    this.folha.add(brilho)
    if (this.calmo) return void this.time.delayedCall(500, () => brilho.destroy())
    this.tweens.add({ targets: brilho, scale: { from: 0.2, to: 1.7 }, alpha: { from: 1, to: 0 }, duration: 520, ease: 'Cubic.easeOut', onComplete: () => brilho.destroy() })
  }

  atualizarSeta() {
    const g = this.gSeta
    if (!this.setaVisivel) {
      if (this.setaPintada) g.clear()
      this.setaPintada = false
      return
    }
    if (this.setaPintada) return
    this.setaPintada = true
    g.clear()
    desenharTracos(g, this.variantes.seta, { cor: CORES_GIZ.coracao, largura: 3, alpha: 0.9 })
  }

  atualizarBarra() {
    const p = this.pagina
    const g = this.gBarra
    const mostrar = p.etapa === 'desviar' || p.etapa === 'tentarDeNovo'
    this.contador.setText(mostrar ? `sobreviva ${Math.ceil(Math.max(0, SOBREVIVER_MS - p.decorrido) / 1000)} s` : p.etapa === 'marcas' ? `marcas: ${p.marcasPegas} de ${p.marcas.length}` : '')
    g.clear()
    if (!mostrar) return
    const x0 = CAIXA.esquerda
    const x1 = CAIXA.direita
    const y = CAIXA.base + 44
    const fundo = [[{ x: x0, y }, { x: x1, y: y + 1 }]]
    desenharTracos(g, fundo, { cor: 0x9a94ad, largura: 5, alpha: 0.5, grao: 0.2 })
    if (p.progressoDesvio > 0) desenharTracos(g, [[{ x: x0, y }, { x: x0 + (x1 - x0) * p.progressoDesvio, y: y + p.progressoDesvio }]], { cor: CORES_GIZ.certo, largura: 5.5, alpha: 0.95, grao: 0.2 })
  }

  concluir() {
    tocar(this, 'cura')
    const a = this.adesivoFinal
    a.setVisible(true)
    if (this.calmo) return
    a.setScale(2.4).setAlpha(0)
    this.tweens.add({ targets: a, scale: 1, alpha: 1, duration: 360, ease: 'Back.easeOut' })
  }

  // a folha encolhe contra a lombada (esquerda) e mostra a página de trás; sem animação, troca direto
  virarPagina() {
    this.virando = true
    this.proxima.setVisible(true).setDepth(10)
    const fim = () => {
      this.folha.setVisible(false)
      this.sombraVirada.setAlpha(0)
      this.virando = false
      this.pagina.terminouDeVirar()
      this.dizer(this.pagina.fala, true)
      this.atualizarDicas()
    }
    if (this.calmo) return fim()
    tocar(this, 'mover')
    const dobra = this.add.rectangle(0, 0, 16, ALTURA, 0xd9cdb0, 1).setOrigin(0).setDepth(25)
    const sombra = this.add.rectangle(0, 0, 60, ALTURA, 0x2a1d10, 0.28).setOrigin(0).setDepth(24)
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: VIRADA_MS,
      ease: 'Sine.easeInOut',
      onUpdate: (t) => {
        const v = t.getValue()
        this.folha.setScale(1 - v, 1 + v * 0.02)
        dobra.setX(LARGURA * (1 - v) - 2).setAlpha(v < 0.97 ? 1 : 0)
        sombra.setX(LARGURA * (1 - v)).setAlpha(0.28 * (1 - v))
        this.sombraVirada.setAlpha(0.18 * Math.sin(v * Math.PI))
      },
      onComplete: () => {
        dobra.destroy()
        sombra.destroy()
        fim()
      },
    })
  }
}
