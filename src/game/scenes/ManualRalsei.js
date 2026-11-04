import Phaser from 'phaser'
import { get } from 'svelte/store'
import Controles from '../controles.js'
import { jogo } from '../../lib/estado.js'
import { criarRng } from '../pvp/baralho.js'
import { tocar, musica } from '../audio.js'
import { LARGURA, ALTURA, CORACAO } from '../constants.js'
import { fatores } from '../acessibilidade.js'
import { menosMovimento, pref, definirPref } from '../preferencias.js'
import { normalizarTeclas } from '../teclas.js'
import { cortarTracos, circuloGiz, retanguloGiz } from '../manual/giz.js'
import { pintarDesenho, aplicarGrao, PALETA } from '../manual/cera.js'
import { dicasDeBotoes } from '../manual/botoes.js'
import { criarPagina1, SOBREVIVER_MS, RAIO_BALA } from '../manual/pagina1.js'
import { CORES_GIZ, rabiscoDoCoracao, rabiscoDaBala, rabiscoDaMarca, rabiscoDaSeta, sublinhado, rabiscosDaMargem } from '../manual/ilustracoes.js'
import { expressaoDoRalsei } from '../manual/ralsei.js'
import {
  FONTE_TEXTO,
  TINTA,
  TINTA_SUAVE,
  garantirPapel,
  PAPEL,
  assar,
  assarCamadas,
  assarEstrelaDourada,
  assarLetreiro,
  imagemDeCera,
  trocarImagem,
  desenharFita,
  Balao,
  RalseiDesenhado,
  Confete,
  brilhar,
  virarFolha,
  somDePapel,
  padraoDeGraoPara,
  assarRotulo,
  joyDeTodos,
  BalasDeGiz,
  coracaoDeGiz,
  riscosDeGolpe,
  barraDeGiz,
} from '../manual/paginaBase.js'
import { comPagina1 } from '../manual/progresso.js'
import { assarFundoDaPagina2, montarCapaDaPagina2 } from './ManualRalsei2.js'

// O MANUAL INTERATIVO DO RALSEI, página 1 (conceito e como somar páginas em docs/manual-ralsei.md).
// Menu -> GUIA -> MANUAL DO RALSEI -> PÁGINA 1 (ou CONTINUAR). A página 2 é a cena ManualRalsei2.
//
// Um caderno de espiral desenhado a giz de cera que ganha vida: o Ralsei fala num balão, o giz
// desenha a caixa e o coração, o jogador leva o coração (de verdade: o mesmo movimento e a mesma
// hitbox do jogo) até 3 marcas e depois desvia de 6 bolinhas lentas por 8 s. Acertou: incentivo e
// recomeça só a parte das bolinhas. Terminou: estrela dourada "PÁGINA 1 ✓", confete de coraçõezinhos
// e a folha vira para a página 2 (a cena ManualRalsei2 continua do mesmo papel). O progresso fica salvo
// (manual/progresso.js). Regras e estados: manual/pagina1.js (puro, testado).
// Caderno, balão, Ralsei, adesivos, virada e sons: manual/paginaBase.js (a base de toda página).
//
//   mover: o coração (teclado/controle/joystick) · A: continuar / tentar já / virar · B: volta ao índice do manual
//
// "Reduzir animações": giz parado (sem o tremidinho), Ralsei parado, texto do balão inteiro de uma vez,
// folha troca sem animação, sem confete. Nenhum clarão. A jogabilidade é a mesma em qualquer ajuste.
// No dev: window.manualRalsei.

const CAIXA = { esquerda: 440, direita: 780, topo: 148, base: 348 }
const VARIANTES = 3 // quantos "desenhos" diferentes de cada traço alternam (o tremidinho do giz)
const TROCA_MS = 170 // de quanto em quanto tempo o giz troca de variante
const BALAO = { x: 64, y: 92, largura: 334, altura: 120, cauda: { de: 112, x: 126, y: 262 } }
const RALSEI = { x: 176, y: 438, escala: 1.12 }
const SLOT_Y = CAIXA.topo - 30
const RASTRO = 3 // cópias apagadinhas atrás de cada bolinha
const DESENHO = { x: CAIXA.esquerda - 24, y: CAIXA.topo - 24, largura: CAIXA.direita - CAIXA.esquerda + 48, altura: CAIXA.base - CAIXA.topo + 48 }
// onde ficam os rabiscos de margem desta página (longe do texto, da caixa e do Ralsei)
const MARGEM_P1 = [
  { tipo: 'sol', x: 806, y: 62, r: 14 },
  { tipo: 'nuvem', x: 730, y: 66 },
  { tipo: 'coracao', x: 412, y: 50, r: 6, cor: PALETA.rosa },
  { tipo: 'estrela', x: 820, y: 190, r: 6, cor: PALETA.lavanda },
  { tipo: 'coracao', x: 818, y: 262, r: 5, cor: PALETA.azul },
  { tipo: 'estrela', x: 822, y: 330, r: 5, cor: PALETA.amarelo },
  { tipo: 'pata', x: 818, y: 444, r: 8, giro: -0.4, cor: PALETA.verde },
  { tipo: 'pata', x: 800, y: 412, r: 8, giro: -0.2, cor: PALETA.verde },
  { tipo: 'pata', x: 824, y: 386, r: 7, giro: -0.5, cor: PALETA.verde },
  { tipo: 'estrela', x: 330, y: 300, r: 6, cor: PALETA.amarelo },
  { tipo: 'coracao', x: 300, y: 378, r: 5, cor: PALETA.rosa },
  { tipo: 'estrela', x: 404, y: 404, r: 5, cor: PALETA.azul },
  { tipo: 'coracao', x: 70, y: 254, r: 5, cor: PALETA.lavanda },
]

// A instância da cena é REAPROVEITADA pelo Phaser: o que a abertura anterior deixou aqui (objetos
// destruídos, flags) volta ao inicial no começo do init(). Testado em __tests__/cenasReaproveitadas.test.js.
const estadoInicial = () => ({
  pagina: null,
  controles: null,
  folha: null,
  proxima: null,
  balao: null,
  ralsei: null,
  imgCaixa: null,
  imgCoracao: null,
  coracaoC: null,
  imgMarcas: null,
  imgSlots: null,
  imgSeta: null,
  imgDesenho: null,
  texDesenho: null,
  gizinho: null,
  gGolpe: null,
  gBarra: null,
  balas: null,
  dicas: null,
  rotuloVoce: null,
  adesivoFinal: null,
  confete: null,
  contador: null,
  infos: null,
  formas: null,
  fase: 0,
  proximaTroca: 0,
  proximoRabisco: 0,
  dicaAtual: '',
  saindo: false,
  virando: false,
  calmo: false,
  rastros: false,
  setaVisivel: false,
  ultimoEvento: null,
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
    this.rastros = !this.calmo && fatores().rastros
    this.pagina = criarPagina1({ caixa: CAIXA, velocidade: this.registry.get('velocidade') ?? CORACAO.velocidadePadrao })
    this.controles = new Controles(this)
    this.controles.onBotao((j, botao) => (botao === 'A' ? this.apertarA() : this.apertarB()))
    this.controles.onPausa(() => this.apertarB())

    const papel = garantirPapel(this)
    this.add.image(0, 0, papel.mesa).setOrigin(0).setDepth(0)
    this.add.image(0, 0, papel.espiral).setOrigin(0).setDepth(30)
    this.assarTudo()
    this.montarProxima()
    this.montarFolha()

    this.cameras.main.fadeIn(240)
    if (import.meta.env.DEV) window.manualRalsei = this
    this.events.once('shutdown', () => {
      if (window.manualRalsei === this) delete window.manualRalsei
      this.confete?.destroy()
    })
    this.balao.dizer(this.pagina.fala)
    this.atualizarDicas()
    musica('tutorial', 'menu')
  }

  // ---------- texturas (assadas UMA vez; sementes fixas: reabrir a cena reaproveita) ----------

  assarTudo() {
    const c = CAIXA
    const r = (s) => criarRng(`manual:p1:${s}`)
    const variantes = (nome, gerar) => Array.from({ length: VARIANTES }, (_, v) => gerar(r(`${nome}${v}`), v))
    this.formas = {
      caixa: variantes('caixa', (g) => retanguloDuplo(g, c)),
      coracao: variantes('coracao', (g) => rabiscoDoCoracao(g, 24)),
      bala: variantes('bala', (g) => rabiscoDaBala(g, RAIO_BALA)),
      marcas: this.pagina.marcas.map((m, i) => variantes(`marca${i}`, (g) => rabiscoDaMarca(g, m.forma))),
    }
    const caixaCamadas = (tracos) => [{ tipo: 'traco', tracos, cor: CORES_GIZ.grafite, largura: 3.4, passadas: 3 }]
    this.infos = {
      caixa: this.formas.caixa.map((t, v) => assarCamadas(this, `manual-p1-caixa-${v}`, caixaCamadas(t), { grao: 0.45 })),
      coracao: this.formas.coracao.map((f, v) => assarCamadas(this, `manual-p1-coracao-${v}`, f.camadas, { grao: 0.25 })),
      bala: this.formas.bala.map((f, v) => assarCamadas(this, `manual-p1-bala-${v}`, f.camadas, { grao: 0.2 })),
      marcas: this.formas.marcas.map((vs, i) => vs.map((f, v) => assarCamadas(this, `manual-p1-marca-${i}-${v}`, f.camadas, { grao: 0.3 }))),
      seta: assarCamadas(this, 'manual-p1-seta', [{ tipo: 'traco', tracos: rabiscoDaSeta(r('seta'), 672, 188, 628, 232), cor: PALETA.coracao, largura: 3.2 }], { grao: 0.35 }),
      slotVazio: assarCamadas(this, 'manual-p1-slot', [{ tipo: 'traco', tracos: circuloGiz(r('slot'), 0, 0, 15, { tremor: 0.9, tracos: 1 }), cor: 0x9a8fb8, largura: 2.2, passadas: 2, alpha: 0.8 }], { grao: 0.35 }),
      slotCheio: assarEstrelaDourada(this, 'manual-adesivo-estrela', 17, { giro: 0.08 }),
      final: assarEstrelaDourada(this, 'manual-adesivo-final', 96, { texto: 'PÁGINA 1', subtexto: '✓', giro: -0.14 }),
      gizinho: assarGizinho(this),
      titulo: assarLetreiro(this, 'manual-p1-titulo', 'Este é o seu coração', { tamanho: 26 }),
      rotulo: assarRotulo(this, 'manual-rotulo-p1', 'PÁGINA 1'),
    }
    // o que é só desta página e não muda: o cartão claro da caixa (com fitas), os rabiscos e o sublinhado
    assar(this, 'manual-p1-fundo', LARGURA, ALTURA, {
      camadas: [...rabiscosDaMargem(r('margem'), MARGEM_P1), { tipo: 'traco', tracos: sublinhado(r('sub'), 66, 76, 384), cor: PALETA.rosa, largura: 3.4, passadas: 3 }],
      grao: 0.4,
      fundo: (ctx) => {
        ctx.save()
        ctx.shadowColor = 'rgba(70,44,24,0.22)'
        ctx.shadowBlur = 6
        ctx.shadowOffsetY = 2
        ctx.fillStyle = '#fffbf1'
        ctx.fillRect(c.esquerda - 14, c.topo - 14, c.direita - c.esquerda + 28, c.base - c.topo + 28)
        ctx.restore()
      },
      frente: (ctx) => {
        desenharFita(ctx, c.esquerda - 8, c.topo - 10, 64, 18, -0.62, PALETA.azul)
        desenharFita(ctx, c.direita + 8, c.topo - 10, 64, 18, 0.62, PALETA.rosa)
        desenharFita(ctx, c.direita + 6, c.base + 10, 52, 16, -0.6, PALETA.amarelo)
      },
    })
    assarFundoDaPagina2(this) // o verso desta folha é a página 2 (a mesma textura que a cena dela usa)
  }

  // ---------- montagem ----------

  g() {
    return this.add.graphics()
  }

  texto(x, y, conteudo, tamanho, extra = {}) {
    return this.add.text(x, y, conteudo, { fontFamily: FONTE_TEXTO, fontSize: `${tamanho}px`, color: TINTA, ...extra })
  }

  // tudo da página 1 vai no container `folha` (a virada de página encolhe ele contra a lombada);
  // a ordem do add é a ordem de pintura
  montarFolha() {
    const folha = (this.folha = this.add.container(0, 0).setDepth(20))
    const add = (...o) => {
      folha.add(o)
      return o[0]
    }
    const i = this.infos
    add(this.add.image(0, 0, PAPEL.papel).setOrigin(0))
    add(this.add.image(0, 0, 'manual-p1-fundo').setOrigin(0))
    // etiqueta da página e o título em letras de giz
    add(imagemDeCera(this, 60, 6, i.rotulo))
    add(this.add.image(62, 30, i.titulo.chave).setOrigin(0))

    this.ralsei = new RalseiDesenhado(this, RALSEI.x, RALSEI.y, { calmo: this.calmo, escala: RALSEI.escala })
    add(this.ralsei.container)
    add(this.texto(RALSEI.x, RALSEI.y + 9, 'RALSEI', 11, { fontStyle: 'bold', color: TINTA_SUAVE }).setOrigin(0.5, 0))
    this.balao = new Balao(this, { ...BALAO, chave: 'manual-p1-balao', calmo: this.calmo })
    add(...this.balao.objetos)

    // a caixa: variantes de giz (a do "desenhando" é uma textura viva, repintada por quadro)
    this.imgCaixa = add(imagemDeCera(this, 0, 0, i.caixa[0]).setVisible(false))
    if (!this.textures.exists('manual-p1-desenho')) this.textures.createCanvas('manual-p1-desenho', DESENHO.largura, DESENHO.altura)
    this.texDesenho = this.textures.get('manual-p1-desenho')
    this.imgDesenho = add(this.add.image(DESENHO.x, DESENHO.y, 'manual-p1-desenho').setOrigin(0).setVisible(false))
    this.imgMarcas = this.pagina.marcas.map((m, k) => add(imagemDeCera(this, m.x, m.y, i.marcas[k][0]).setVisible(false)))
    this.imgSeta = add(imagemDeCera(this, 0, 0, i.seta).setVisible(false))
    this.rotuloVoce = add(this.texto(652, 158, 'você!', 17, { fontStyle: 'bold', color: '#d01a33' }).setVisible(false))
    const n = this.pagina.marcas.length
    this.imgSlots = this.pagina.marcas.map((_, k) => add(imagemDeCera(this, slotX(k, n), SLOT_Y, i.slotVazio)))
    this.gBarra = add(this.g())
    // bolinhas (e o rastro apagadinho de cada uma; sem rastro no modo calmo)
    this.balas = new BalasDeGiz(this, { caixa: CAIXA, infos: i.bala, pai: folha, n: 8, rastro: this.rastros ? RASTRO : 0 })
    // o coração: giz por fora, miolo EXATO da hitbox por cima (sem tremor, sempre nítido)
    const cor = coracaoDeGiz(this, i.coracao[0])
    this.coracaoC = add(cor.container.setPosition(this.pagina.coracao.x, this.pagina.coracao.y).setVisible(false))
    this.imgCoracao = cor.img
    this.gGolpe = add(this.g())
    this.gizinho = add(imagemDeCera(this, 0, 0, i.gizinho).setVisible(false))
    this.contador = add(this.texto((CAIXA.esquerda + CAIXA.direita) / 2, CAIXA.base + 18, '', 13, { color: TINTA_SUAVE, fontStyle: 'bold' }).setOrigin(0.5, 0))

    this.adesivoFinal = add(imagemDeCera(this, (CAIXA.esquerda + CAIXA.direita) / 2, (CAIXA.topo + CAIXA.base) / 2 + 4, i.final).setVisible(false))
    this.dicas = add(this.texto(LARGURA / 2 + 40, ALTURA - 24, '', 14, { color: TINTA_SUAVE, fontStyle: 'bold' }).setOrigin(0.5))
    this.redesenhar()
  }

  // atrás desta folha: a página 2 como ela abre (a cena ManualRalsei2 continua dali, sem emenda)
  montarProxima() {
    this.proxima = this.add.container(0, 0).setDepth(10).setVisible(false)
    montarCapaDaPagina2(this, this.proxima)
  }

  // ---------- desenho ----------

  // repinta o que muda (a cada troca de variante do giz e a cada evento)
  redesenhar() {
    const p = this.pagina
    const v = this.fase
    const desenhando = p.etapa === 'desenhando'
    const pronto = p.etapa !== 'intro' && !desenhando
    this.imgDesenho.setVisible(desenhando)
    this.imgCaixa.setVisible(pronto)
    if (pronto) trocarImagem(this.imgCaixa, this.infos.caixa[v])
    p.marcas.forEach((m, k) => {
      const img = this.imgMarcas[k].setVisible(pronto)
      trocarImagem(img, this.infos.marcas[k][v])
      img.setAlpha(m.pega ? 0.28 : 1)
    })
    this.coracaoC.setVisible(pronto)
    trocarImagem(this.imgCoracao, this.infos.coracao[v])
    this.coracaoC.setAlpha(p.etapa === 'tentarDeNovo' ? 0.45 : 1)
    this.coracaoC.setPosition(p.coracao.x, p.coracao.y)
    if (desenhando) this.pintarDesenho()
    else this.gizinho.setVisible(false)
    this.redesenharBalas(true)
  }

  // o giz riscando: caixa, coração e marcas cortados pelo progresso, numa textura viva + o gizinho na ponta
  pintarDesenho() {
    const p = this.pagina
    const d = p.desenho
    const tex = this.texDesenho
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, DESENHO.largura, DESENHO.altura)
    ctx.save()
    ctx.translate(-DESENHO.x, -DESENHO.y)
    const f = this.formas
    const cor = f.coracao[0]
    const cx = (CAIXA.esquerda + CAIXA.direita) / 2
    const cy = (CAIXA.topo + CAIXA.base) / 2
    const mover = (tracos, x, y) => tracos.map((t) => t.map((q) => ({ x: q.x + x, y: q.y + y })))
    const partes = [
      { tracos: f.caixa[0], cor: CORES_GIZ.grafite, largura: 3.4, progresso: d.caixa },
      { tracos: mover([...cor.contorno, ...cor.preenchimento], cx, cy), cor: CORES_GIZ.coracao, largura: 2.6, progresso: d.coracao },
      ...p.marcas.map((m, k) => ({ tracos: mover(f.marcas[k][0].tracos, m.x, m.y), cor: m.forma === 'x' ? CORES_GIZ.marcaX : CORES_GIZ.marcaContorno, largura: 3, progresso: d.marcas })),
    ]
    pintarDesenho(ctx, partes.map((q) => ({ tipo: 'traco', passadas: 2, ...q })), { semente: 'desenho' })
    ctx.restore()
    aplicarGrao(ctx, padraoDeGraoPara(ctx), DESENHO.largura, DESENHO.altura, 0.4)
    tex.refresh()
    // a ponta do giz: o fim do traço que está sendo riscado agora
    const ativo = partes.find((q) => q.progresso > 0 && q.progresso < 1)
    this.gizinho.setVisible(Boolean(ativo))
    if (ativo) {
      const corte = cortarTracos(ativo.tracos, ativo.progresso)
      const ult = corte[corte.length - 1]
      const ponta = ult?.[ult.length - 1]
      if (ponta) this.gizinho.setPosition(ponta.x, ponta.y)
    }
  }

  redesenharBalas(trocar = false) {
    this.balas.atualizar(this.pagina.balas, this.fase, trocar)
  }

  // ---------- dicas ----------

  atualizarDicas() {
    const f = get(jogo).fonte
    const teclas = normalizarTeclas(pref('teclas'))
    const d = dicasDeBotoes(f, teclas)
    const p = this.pagina
    const sair = `${d.B}: sair`
    let linha
    if (p.etapa === 'intro') linha = `${d.A}: continuar      ${sair}`
    else if (p.etapa === 'concluida') linha = `${d.A}: virar a página      ${sair}`
    else if (p.etapa === 'tentarDeNovo') linha = `${d.A}: tentar já      ${sair}`
    else if (p.etapa === 'desenhando' || p.etapa === 'virando' || p.etapa === 'fim') linha = sair
    else linha = `${d.mover}: mover o coração      ${sair}`
    if (linha === this.dicaAtual) return
    this.dicaAtual = linha
    this.dicas.setText(linha)
  }

  // ---------- entrada ----------

  apertarA() {
    if (this.saindo || this.virando) return
    if (this.balao.digitando) return this.balao.completar()
    if (this.pagina.avancar()) tocar(this, 'confirmar')
  }

  apertarB() {
    if (this.saindo) return
    this.saindo = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start('GuiaEntrada', { modo: 'indice' }))
  }

  // ---------- quadro a quadro ----------

  update(tempo, delta) {
    if (!this.pagina) return
    const p = this.pagina
    if (!this.virando) p.tick(delta, joyDeTodos(this.controles))
    this.balao.update(tempo, delta, ['intro', 'concluida', 'tentarDeNovo'].includes(p.etapa))

    const eventos = p.drenar()
    for (const e of eventos) this.aoEvento(e, tempo)

    // o Ralsei: cara conforme a etapa e o último evento; respira e pisca
    const u = this.ultimoEvento
    this.ralsei.setExpressao(expressaoDoRalsei(p.etapa, u && { tipo: u.tipo, ha: tempo - u.quando }))
    this.ralsei.update(tempo)

    // tremidinho do giz
    let mudou = false
    if (!this.calmo && tempo >= this.proximaTroca) {
      this.fase = (this.fase + 1) % VARIANTES
      this.proximaTroca = tempo + TROCA_MS
      mudou = true
    }
    if (p.etapa === 'desenhando') {
      this.redesenhar()
      if (tempo >= this.proximoRabisco) {
        somDePapel('rabisco')
        this.proximoRabisco = tempo + 150
      }
    } else if (mudou || eventos.length) this.redesenhar()
    else {
      this.coracaoC.setPosition(p.coracao.x, p.coracao.y)
      this.redesenharBalas()
    }
    if (this.confete && !this.confete.update(delta)) this.confete = null
    this.atualizarSeta(tempo)
    this.atualizarBarra()
    this.atualizarDicas()
  }

  aoEvento(e, tempo) {
    const p = this.pagina
    if (e.tipo === 'fala') this.balao.dizer(p.fala)
    if (e.tipo === 'etapa') {
      this.balao.dizer(p.fala)
      if (e.etapa === 'marcas') {
        this.setaVisivel = true
        this.rotuloVoce.setVisible(true)
      }
      if (e.etapa === 'desviar') this.gGolpe.clear()
      if (e.etapa === 'concluida') this.concluir()
      if (e.etapa === 'virando') this.virarPagina()
    }
    if (e.tipo === 'marca') {
      this.ultimoEvento = { tipo: 'marca', quando: tempo }
      tocar(this, 'graze')
      somDePapel('adesivo')
      this.balao.dizer(p.fala, true)
      this.setaVisivel = false
      this.rotuloVoce.setVisible(false)
      this.colarAdesivo(e.indice)
    }
    if (e.tipo === 'acerto') {
      this.ultimoEvento = { tipo: 'acerto', quando: tempo }
      tocar(this, 'dano')
      this.marcarGolpe()
    }
  }

  // o "aaai" de ter sido atingido: riscos de giz em volta do coração (parado, sem clarão)
  marcarGolpe() {
    riscosDeGolpe(this.gGolpe, this.pagina.coracao.x, this.pagina.coracao.y)
  }

  // a marca alcançada vira uma estrelinha dourada colada na fileira de cima (e brilha onde estava)
  colarAdesivo(k) {
    const n = this.pagina.marcas.length
    const m = this.pagina.marcas[k]
    const img = this.imgSlots[k]
    trocarImagem(img, this.infos.slotCheio)
    brilhar(this, m.x, m.y, { pai: this.folha, calmo: this.calmo })
    if (this.calmo) return
    brilhar(this, slotX(k, n), SLOT_Y, { pai: this.folha, n: 5, raio: 22 })
    somDePapel('brilho')
    img.setScale(1.8)
    this.tweens.add({ targets: img, scale: 1, duration: 340, ease: 'Back.easeOut' })
  }

  atualizarSeta(tempo) {
    const ver = this.setaVisivel
    this.imgSeta.setVisible(ver)
    if (!ver || this.calmo) return
    // a seta "chama" de leve na direção do coração
    const s = Math.sin(tempo / 260) * 2
    this.imgSeta.setPosition(s, -s)
  }

  atualizarBarra() {
    const p = this.pagina
    const g = this.gBarra
    const mostrar = p.etapa === 'desviar' || p.etapa === 'tentarDeNovo'
    this.contador.setText(mostrar ? `sobreviva ${Math.ceil(Math.max(0, SOBREVIVER_MS - p.decorrido) / 1000)} s` : p.etapa === 'marcas' ? `marcas: ${p.marcasPegas} de ${p.marcas.length}` : '')
    if (mostrar) barraDeGiz(g, CAIXA, p.progressoDesvio)
    else g.clear()
  }

  concluir() {
    definirPref('manual', comPagina1(pref('manual')))
    tocar(this, 'cura')
    somDePapel('adesivo')
    const a = this.adesivoFinal
    a.setVisible(true)
    if (this.calmo) return
    a.setScale(2.2).setAlpha(0)
    this.tweens.add({ targets: a, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' })
    if (pref('flashes') !== false) {
      const n = Math.max(6, Math.round(44 * fatores().festa))
      this.time.delayedCall(260, () => {
        if (this.virando || !this.folha) return
        this.confete = new Confete(this, a.x, a.y - 20, { n, pai: this.folha })
        somDePapel('brilho')
      })
    }
  }

  // a folha encolhe contra a lombada (com a beirada curvando) e mostra a página de trás
  virarPagina() {
    this.virando = true
    this.confete?.destroy()
    this.confete = null
    this.proxima.setVisible(true)
    virarFolha(this, this.folha, {
      calmo: this.calmo,
      aoTerminar: () => {
        this.folha.setVisible(false)
        this.virando = false
        this.pagina.terminouDeVirar()
        // a página 2 começa do mesmo papel (a capa dela já está na tela): troca de cena sem fade
        this.saindo = true
        this.scene.start('ManualRalsei2', { deVirada: true })
      },
    })
  }
}

const slotX = (k, n) => (CAIXA.esquerda + CAIXA.direita) / 2 + (k - (n - 1) / 2) * 46

// a borda da caixa: o retângulo de giz (cada lado com 2 passadas e cantos que se cruzam)
const retanguloDuplo = (rng, c) => retanguloGiz(rng, c.esquerda, c.topo, c.direita - c.esquerda, c.base - c.topo, { tremor: 1.4, excesso: 6, tracos: 2 })

// o gizinho rosa que aparece riscando no "desenhando" (a ponta fica no (0,0))
function assarGizinho(scene) {
  const corpo = [{ x: 4, y: -6 }, { x: 30, y: -40 }, { x: 40, y: -32 }, { x: 13, y: 2 }]
  const papel = [{ x: 16, y: -22 }, { x: 28, y: -38 }, { x: 38, y: -30 }, { x: 25, y: -15 }]
  return assarCamadas(scene, 'manual-gizinho', [
    { tipo: 'preencher', poligono: corpo, cor: PALETA.rosa, espaco: 2, mancha: 0.7 },
    { tipo: 'mancha', poligono: papel, cor: 0xfff4d6, alpha: 0.95 },
    { tipo: 'traco', tracos: [[...papel, papel[0]]], cor: PALETA.rosaEscuro, largura: 1.2, passadas: 1 },
    { tipo: 'mancha', poligono: [{ x: 0, y: 0 }, { x: 4, y: -6 }, { x: 13, y: 2 }], cor: PALETA.rosaEscuro, alpha: 1 },
    { tipo: 'traco', tracos: [[...corpo, corpo[0]]], cor: PALETA.rosaEscuro, largura: 1.6, passadas: 2 },
  ], { grao: 0.25 })
}
