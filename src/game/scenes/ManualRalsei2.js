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
import { retanguloGiz, circuloGiz } from '../manual/giz.js'
import { PALETA, corCss } from '../manual/cera.js'
import { dicasDeBotoes } from '../manual/botoes.js'
import { criarPagina2, expressaoDaPagina2, OPCOES_ESCOLHA } from '../manual/pagina2.js'
import { LICOES, RAIO_GOTA } from '../manual/padroes.js'
import { normalizarProgresso, comLicao, comPagina2 } from '../manual/progresso.js'
import { CORES_GIZ, rabiscoDoCoracao, rabiscoDaBala, sublinhado, rabiscosDaMargem, iconeDaLicao, pontosDaMira } from '../manual/ilustracoes.js'
import { elipse } from '../manual/ralsei.js'
import {
  FONTE_TEXTO,
  TINTA,
  TINTA_SUAVE,
  garantirPapel,
  PAPEL,
  assar,
  assarCamadas,
  assarAdesivo,
  assarEstrelaDourada,
  assarLetreiro,
  assarRotulo,
  imagemDeCera,
  trocarImagem,
  desenharFita,
  Balao,
  RalseiDesenhado,
  Confete,
  brilhar,
  virarFolha,
  somDePapel,
  BalasDeGiz,
  coracaoDeGiz,
  riscosDeGolpe,
  barraDeGiz,
  joyDeTodos,
} from '../manual/paginaBase.js'
import { montarCapaDasCartas } from './ManualRalsei3.js'

// O MANUAL DO RALSEI, página 2: "Vamos desviar?" (docs/manual-ralsei.md). Ensina a LER os padrões,
// uma ideia de cada vez: chuva de cima, linha de lado, mira em você e uma mistura curta. Em cada
// mini-lição o Ralsei explica, o coração de giz VERDE dele mostra o movimento uma vez (A pula) e
// então é a vez do jogador: sobreviver a onda curta. Acertou: incentivo e de novo só aquela parte;
// 3 erros: ↑/↓ escolhe "tentar de novo" ou "pular esta parte". Cada mini-lição vale um adesivo;
// no fim, estrela dourada "PÁGINA 2 ✓" e a folha vira para a página 3 (cena ManualRalsei3).
//
// As balas e o coração são os do jogo (manual/onda.js + entities/fisica.js, testados contra Balas e
// Heart reais); o giz é só desenho. Regras e estados: manual/pagina2.js (puro, testado).
// O progresso (adesivos e página completa) fica salvo: manual/progresso.js, preferência 'manual'.
//
//   mover: o coração · ↑/↓: escolher (depois de 3 erros) · A: continuar / pular a demonstração /
//   tentar já / virar · B: volta ao índice do manual
//
// "Reduzir animações": giz parado, Ralsei parado, balão inteiro, sem rastro, sem confete, virada em
// corte. A linha pontilhada do tiro FICA (é informação, não enfeite). Nenhum clarão. No dev: window.manualRalsei2.

const CAIXA = { esquerda: 440, direita: 780, topo: 148, base: 348 }
const VARIANTES = 3
const TROCA_MS = 170
const BALAO = { x: 64, y: 92, largura: 334, altura: 128, cauda: { de: 112, x: 126, y: 262 }, tamanho: 16 }
const RALSEI = { x: 176, y: 438, escala: 1.12 }
const SLOT_Y = CAIXA.topo - 30
const RASTRO = 3
const MAX_BALAS = 26
const CX = (CAIXA.esquerda + CAIXA.direita) / 2
const CY = (CAIXA.topo + CAIXA.base) / 2
const COR_MIRA = 0xd01a33

const MARGEM_P2 = [
  { tipo: 'nuvem', x: 742, y: 64 },
  { tipo: 'nuvem', x: 812, y: 86 },
  { tipo: 'coracao', x: 412, y: 52, r: 6, cor: PALETA.lavanda },
  { tipo: 'estrela', x: 820, y: 196, r: 6, cor: PALETA.amarelo },
  { tipo: 'coracao', x: 818, y: 270, r: 5, cor: PALETA.rosa },
  { tipo: 'estrela', x: 822, y: 336, r: 5, cor: PALETA.azul },
  { tipo: 'pata', x: 806, y: 440, r: 8, giro: -0.4, cor: PALETA.verde },
  { tipo: 'pata', x: 824, y: 410, r: 7, giro: -0.6, cor: PALETA.verde },
  { tipo: 'estrela', x: 336, y: 304, r: 6, cor: PALETA.lavanda },
  { tipo: 'coracao', x: 306, y: 380, r: 5, cor: PALETA.azul },
  { tipo: 'estrela', x: 406, y: 410, r: 5, cor: PALETA.rosa },
  { tipo: 'coracao', x: 70, y: 262, r: 5, cor: PALETA.amarelo },
]
// as gotinhas de chuva dos rabiscos (o tema da página), embaixo das nuvens
const GOTINHAS = [[728, 90], [748, 100], [800, 112], [822, 108], [760, 82]]

// ---------- o que a página 1 também usa (a capa desta página aparece atrás da folha que vira) ----------

// o fundo que não muda: cartão da caixa com fitas, rabiscos e o sublinhado do título
export function assarFundoDaPagina2(scene) {
  const c = CAIXA
  const r = (s) => criarRng(`manual:p2:${s}`)
  const gotas = GOTINHAS.map(([x, y]) => {
    const g = contornoDaGotinha(x, y, 4)
    return { tipo: 'preencher', poligono: g, cor: PALETA.azul, espaco: 1.6, mancha: 0.7, alpha: 0.75 }
  })
  assar(scene, 'manual-p2-fundo', LARGURA, ALTURA, {
    camadas: [...rabiscosDaMargem(r('margem'), MARGEM_P2), ...gotas, { tipo: 'traco', tracos: sublinhado(r('sub'), 66, 76, 300), cor: PALETA.azul, largura: 3.4, passadas: 3 }],
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
      desenharFita(ctx, c.esquerda - 8, c.topo - 10, 64, 18, -0.62, PALETA.lavanda)
      desenharFita(ctx, c.direita + 8, c.topo - 10, 64, 18, 0.62, PALETA.amarelo)
      desenharFita(ctx, c.esquerda - 6, c.base + 10, 52, 16, 0.6, PALETA.verde)
    },
  })
  return {
    rotulo: assarRotulo(scene, 'manual-rotulo-p2', 'PÁGINA 2'),
    titulo: assarLetreiro(scene, 'manual-p2-titulo', 'Vamos desviar?', { tamanho: 26 }),
  }
}

const contornoDaGotinha = (x, y, r) => {
  const pts = []
  for (let i = 0; i <= 10; i++) {
    const a = -0.45 + (i / 10) * (Math.PI + 0.9)
    pts.push({ x: x + Math.cos(a) * r * 0.62, y: y + r * 0.22 + Math.sin(a) * r * 0.62 })
  }
  pts.push({ x, y: y - r })
  return pts
}

// a página como ela abre: papel, fundo, etiqueta, título e o Ralsei (parado)
export function montarCapaDaPagina2(scene, c) {
  const i = assarFundoDaPagina2(scene)
  c.add(scene.add.image(0, 0, PAPEL.papel).setOrigin(0))
  c.add(scene.add.image(0, 0, 'manual-p2-fundo').setOrigin(0))
  c.add(imagemDeCera(scene, 60, 6, i.rotulo))
  c.add(scene.add.image(62, 30, i.titulo.chave).setOrigin(0))
  const r = new RalseiDesenhado(scene, RALSEI.x, RALSEI.y, { calmo: true, escala: RALSEI.escala })
  r.setExpressao('animado')
  c.add(r.container)
  c.add(scene.add.text(RALSEI.x, RALSEI.y + 9, 'RALSEI', { fontFamily: FONTE_TEXTO, fontSize: '11px', fontStyle: 'bold', color: TINTA_SUAVE }).setOrigin(0.5, 0))
}

// A instância da cena é REAPROVEITADA pelo Phaser: tudo volta ao inicial no começo do init().
const estadoInicial = () => ({
  pagina: null,
  controles: null,
  folha: null,
  proxima: null,
  balao: null,
  ralsei: null,
  imgCaixa: null,
  coracao: null,
  demo: null,
  balas: null,
  gMira: null,
  gGolpe: null,
  gBarra: null,
  imgSlots: null,
  contador: null,
  rotuloDemo: null,
  linhasEscolha: null,
  cursor: null,
  adesivoFinal: null,
  confete: null,
  dicas: null,
  infos: null,
  fase: 0,
  proximaTroca: 0,
  dicaAtual: '',
  saindo: false,
  virando: false,
  calmo: false,
  rastros: false,
  ultimoEvento: null,
  dados: null,
})

export default class ManualRalsei2 extends Phaser.Scene {
  constructor() {
    super('ManualRalsei2')
  }

  // dados: { deVirada } (veio da página 1 virando a folha: sem fade) · { recomecar } (ignora o progresso)
  init(dados) {
    Object.assign(this, estadoInicial())
    this.dados = dados ?? {}
  }

  create() {
    this.calmo = menosMovimento() || fatores().tremor === 0
    this.rastros = !this.calmo && fatores().rastros
    // retoma de onde parou (a página já completa recomeça do zero, para jogar de novo)
    const prog = normalizarProgresso(pref('manual'))
    const licoes = this.dados.recomecar || prog.p2.completa ? null : prog.p2.licoes
    this.pagina = criarPagina2({ caixa: CAIXA, velocidade: this.registry.get('velocidade') ?? CORACAO.velocidadePadrao, licoes })
    this.controles = new Controles(this)
    this.controles.onBotao((j, botao) => (botao === 'A' ? this.apertarA() : this.apertarB()))
    this.controles.onPausa(() => this.apertarB())

    const papel = garantirPapel(this)
    this.add.image(0, 0, papel.mesa).setOrigin(0).setDepth(0)
    this.add.image(0, 0, papel.espiral).setOrigin(0).setDepth(30)
    this.assarTudo()
    this.montarProxima()
    this.montarFolha()

    if (!this.dados.deVirada) this.cameras.main.fadeIn(240)
    if (import.meta.env.DEV) window.manualRalsei2 = this
    this.events.once('shutdown', () => {
      if (window.manualRalsei2 === this) delete window.manualRalsei2
      this.confete?.destroy()
    })
    this.balao.dizer(this.pagina.fala)
    this.atualizarDicas()
    musica('tutorial2', 'tutorial')
  }

  // ---------- texturas (assadas uma vez; sementes fixas) ----------

  assarTudo() {
    const r = (s) => criarRng(`manual:p2:${s}`)
    const variantes = (nome, gerar) => Array.from({ length: VARIANTES }, (_, v) => gerar(r(`${nome}${v}`), v))
    const caixa = variantes('caixa', (g) => retanguloGiz(g, CAIXA.esquerda, CAIXA.topo, CAIXA.direita - CAIXA.esquerda, CAIXA.base - CAIXA.topo, { tremor: 1.4, excesso: 6, tracos: 2 }))
    const coracao = variantes('coracao', (g) => rabiscoDoCoracao(g, 24))
    const verde = variantes('coracaoVerde', (g) => rabiscoDoCoracao(g, 24, { cor: PALETA.verde, escura: PALETA.verdeEscuro }))
    const bala = variantes('bala', (g) => rabiscoDaBala(g, RAIO_GOTA))
    const fundo = assarFundoDaPagina2(this)
    this.infos = {
      ...fundo,
      caixa: caixa.map((t, v) => assarCamadas(this, `manual-p2-caixa-${v}`, [{ tipo: 'traco', tracos: t, cor: CORES_GIZ.grafite, largura: 3.4, passadas: 3 }], { grao: 0.45 })),
      coracao: coracao.map((f, v) => assarCamadas(this, `manual-p2-coracao-${v}`, f.camadas, { grao: 0.25 })),
      verde: verde.map((f, v) => assarCamadas(this, `manual-p2-coracao-verde-${v}`, f.camadas, { grao: 0.25 })),
      bala: bala.map((f, v) => assarCamadas(this, `manual-p2-bala-${v}`, f.camadas, { grao: 0.2 })),
      slotVazio: assarCamadas(this, 'manual-p2-slot', [{ tipo: 'traco', tracos: circuloGiz(r('slot'), 0, 0, 16, { tremor: 0.9, tracos: 1 }), cor: 0x9a8fb8, largura: 2.2, passadas: 2, alpha: 0.8 }], { grao: 0.35 }),
      adesivos: LICOES.map((l) => (l.id === 'mistura' ? assarEstrelaDourada(this, 'manual-adesivo-estrela-p2', 18, { giro: -0.06 }) : assarAdesivoDaLicao(this, l.id))),
      final: assarEstrelaDourada(this, 'manual-adesivo-final-p2', 96, { texto: 'PÁGINA 2', subtexto: '✓', giro: 0.12 }),
    }
  }

  // ---------- montagem ----------

  texto(x, y, conteudo, tamanho, extra = {}) {
    return this.add.text(x, y, conteudo, { fontFamily: FONTE_TEXTO, fontSize: `${tamanho}px`, color: TINTA, ...extra })
  }

  montarFolha() {
    const folha = (this.folha = this.add.container(0, 0).setDepth(20))
    const add = (...o) => {
      folha.add(o)
      return o[0]
    }
    const i = this.infos
    add(this.add.image(0, 0, PAPEL.papel).setOrigin(0))
    add(this.add.image(0, 0, 'manual-p2-fundo').setOrigin(0))
    add(imagemDeCera(this, 60, 6, i.rotulo))
    add(this.add.image(62, 30, i.titulo.chave).setOrigin(0))

    this.ralsei = new RalseiDesenhado(this, RALSEI.x, RALSEI.y, { calmo: this.calmo, escala: RALSEI.escala })
    add(this.ralsei.container)
    add(this.texto(RALSEI.x, RALSEI.y + 9, 'RALSEI', 11, { fontStyle: 'bold', color: TINTA_SUAVE }).setOrigin(0.5, 0))
    this.balao = new Balao(this, { ...BALAO, chave: 'manual-p2-balao', calmo: this.calmo })
    add(...this.balao.objetos)

    this.imgCaixa = add(imagemDeCera(this, 0, 0, i.caixa[0]))
    this.imgSlots = LICOES.map((_, k) => add(imagemDeCera(this, slotX(k), SLOT_Y, i.slotVazio)))
    this.pagina.licoes.forEach((r, k) => r === 'feita' && trocarImagem(this.imgSlots[k], i.adesivos[k]))
    this.gMira = add(this.add.graphics())
    this.balas = new BalasDeGiz(this, { caixa: CAIXA, infos: i.bala, pai: folha, n: MAX_BALAS, rastro: this.rastros ? RASTRO : 0 })
    this.demo = coracaoDeGiz(this, i.verde[0], { borda: PALETA.verdeEscuro })
    add(this.demo.container.setVisible(false))
    this.coracao = coracaoDeGiz(this, i.coracao[0])
    add(this.coracao.container.setPosition(this.pagina.coracao.x, this.pagina.coracao.y).setVisible(false))
    this.gGolpe = add(this.add.graphics())
    this.rotuloDemo = add(this.texto(CAIXA.esquerda + 8, CAIXA.topo + 6, 'o coração do Ralsei mostra:', 13, { fontStyle: 'bold', color: corCss(PALETA.verdeEscuro) }).setVisible(false))
    this.gBarra = add(this.add.graphics())
    this.contador = add(this.texto(CX, CAIXA.base + 18, '', 13, { color: TINTA_SUAVE, fontStyle: 'bold' }).setOrigin(0.5, 0))
    // a escolha depois de 3 erros (um coraçãozinho de giz marca a opção)
    this.linhasEscolha = OPCOES_ESCOLHA.map((o, k) => add(this.texto(CX, CAIXA.base + 24 + k * 26, o, 16, { fontStyle: 'bold' }).setOrigin(0.5, 0).setVisible(false)))
    this.cursor = add(imagemDeCera(this, 0, 0, i.coracao[0]).setScale(0.7).setVisible(false))
    this.adesivoFinal = add(imagemDeCera(this, CX, CY + 4, i.final).setVisible(false))
    this.dicas = add(this.texto(LARGURA / 2 + 40, ALTURA - 24, '', 14, { color: TINTA_SUAVE, fontStyle: 'bold' }).setOrigin(0.5))
    this.redesenhar(true)
  }

  // atrás da folha: a página 3 como ela abre (a cena ManualRalsei3 continua dali, sem emenda)
  montarProxima() {
    this.proxima = this.add.container(0, 0).setDepth(10).setVisible(false)
    montarCapaDasCartas(this, this.proxima, 3)
  }

  // ---------- desenho ----------

  redesenhar(trocar = false) {
    const p = this.pagina
    const v = this.fase
    if (trocar) {
      trocarImagem(this.imgCaixa, this.infos.caixa[v])
      trocarImagem(this.coracao.img, this.infos.coracao[v])
      trocarImagem(this.demo.img, this.infos.verde[v])
    }
    const jogando = ['preparar', 'tentar', 'errou', 'escolha'].includes(p.etapa)
    this.coracao.container.setVisible(jogando).setPosition(p.coracao.x, p.coracao.y).setAlpha(p.etapa === 'errou' || p.etapa === 'escolha' ? 0.45 : 1)
    const d = p.demoCoracao
    this.demo.container.setVisible(p.etapa === 'demo' && Boolean(d))
    if (d) this.demo.container.setPosition(d.x, d.y)
    this.rotuloDemo.setVisible(p.etapa === 'demo')
    // na demonstração as bolinhas ficam um pouco mais claras (é de mentirinha)
    this.balas.atualizar(p.balas, v, trocar, { alpha: p.etapa === 'demo' ? 0.75 : 1 })
    this.desenharMira()
  }

  // a linha pontilhada de cada tiro que ainda está avisando (parado): o caminho exato que ele vai fazer
  desenharMira() {
    const g = this.gMira.clear()
    for (const b of this.pagina.balas) {
      const linha = b.extra?.linha
      if (!linha || b.idade >= b.aviso) continue
      const alpha = this.pagina.etapa === 'demo' ? 0.6 : 0.9
      for (const q of pontosDaMira(linha, CAIXA)) {
        g.fillStyle(COR_MIRA, alpha)
        g.fillCircle(q.x, q.y, 2.3)
      }
      // um anel em volta da bala parada: "é desta que sai o tiro"
      g.lineStyle(2, COR_MIRA, alpha)
      g.strokeCircle(b.x, b.y, b.raio + 4)
    }
  }

  // ---------- dicas ----------

  atualizarDicas() {
    const d = dicasDeBotoes(get(jogo).fonte, normalizarTeclas(pref('teclas')))
    const p = this.pagina
    const sair = `${d.B}: sair`
    const linha =
      {
        intro: `${d.A}: continuar      ${sair}`,
        explicar: `${d.A}: ${p.licaoAtual?.demo ? 'ver o Ralsei fazer' : 'começar'}      ${sair}`,
        demo: `${d.A}: pular a demonstração      ${sair}`,
        errou: `${d.A}: tentar já      ${sair}`,
        escolha: `${d.mover.length > 4 ? '↑ ↓' : `${d.mover[0]} ${d.mover[2]}`}: escolher      ${d.A}: confirmar      ${sair}`,
        acertou: `${d.A}: continuar      ${sair}`,
        concluida: `${d.A}: virar a página      ${sair}`,
        fim: `${d.A}: voltar ao índice      ${sair}`,
      }[p.etapa] ?? (p.etapa === 'virando' ? sair : `${d.mover}: mover o coração      ${sair}`)
    if (linha === this.dicaAtual) return
    this.dicaAtual = linha
    this.dicas.setText(linha)
  }

  // ---------- entrada ----------

  apertarA() {
    if (this.saindo || this.virando) return
    if (this.balao.digitando) return this.balao.completar()
    if (this.pagina.etapa === 'fim') return this.sair(true)
    if (this.pagina.avancar()) tocar(this, 'confirmar')
  }

  apertarB() {
    if (this.saindo) return
    this.sair(false)
  }

  sair(confirmou) {
    this.saindo = true
    tocar(this, confirmou ? 'confirmar' : 'cancelar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start('GuiaEntrada', { modo: 'indice' }))
  }

  // ---------- quadro a quadro ----------

  update(tempo, delta) {
    if (!this.pagina) return
    const p = this.pagina
    this.controles.atualizar()
    if (!this.virando && !this.saindo) {
      // ↑/↓ na escolha (qualquer jogador local)
      for (let j = 0; j < this.controles.numJogadores; j++) if (p.mover(this.controles.toque(j))) tocar(this, 'mover')
      p.tick(delta, joyDeTodos(this.controles))
    }
    this.balao.update(tempo, delta, ['intro', 'explicar', 'acertou', 'errou', 'concluida'].includes(p.etapa))
    const eventos = p.drenar()
    for (const e of eventos) this.aoEvento(e, tempo)

    const u = this.ultimoEvento
    this.ralsei.setExpressao(expressaoDaPagina2(p.etapa, u && { tipo: u.tipo, ha: tempo - u.quando }))
    this.ralsei.update(tempo)

    let trocar = false
    if (!this.calmo && tempo >= this.proximaTroca) {
      this.fase = (this.fase + 1) % VARIANTES
      this.proximaTroca = tempo + TROCA_MS
      trocar = true
    }
    this.redesenhar(trocar || eventos.length > 0)
    if (this.confete && !this.confete.update(delta)) this.confete = null
    this.atualizarContador()
    this.atualizarEscolha()
    this.atualizarDicas()
  }

  aoEvento(e, tempo) {
    const p = this.pagina
    if (e.tipo === 'fala') this.balao.dizer(p.fala)
    if (e.tipo === 'etapa') {
      // a fala da tentativa já estava no balão desde o "preparar": não redigita
      if (e.etapa !== 'tentar') this.balao.dizer(p.fala)
      if (e.etapa === 'preparar' || e.etapa === 'demo') this.gGolpe.clear()
      if (e.etapa === 'concluida') this.concluir()
      if (e.etapa === 'virando') this.virarPagina()
    }
    if (e.tipo === 'acerto') {
      this.ultimoEvento = { tipo: 'acerto', quando: tempo }
      tocar(this, 'dano')
      riscosDeGolpe(this.gGolpe, p.coracao.x, p.coracao.y)
    }
    if (e.tipo === 'opcao') this.atualizarEscolha()
    if (e.tipo === 'licao') {
      definirPref('manual', comLicao(pref('manual'), e.indice, e.resultado))
      if (e.resultado === 'feita') this.colarAdesivo(e.indice, tempo)
      else somDePapel('folha')
    }
  }

  colarAdesivo(k, tempo) {
    this.ultimoEvento = { tipo: 'marca', quando: tempo }
    tocar(this, 'graze')
    somDePapel('adesivo')
    const img = this.imgSlots[k]
    trocarImagem(img, this.infos.adesivos[k])
    brilhar(this, slotX(k), SLOT_Y, { pai: this.folha, calmo: this.calmo, n: 5, raio: 22 })
    if (this.calmo) return
    somDePapel('brilho')
    img.setScale(1.8)
    this.tweens.add({ targets: img, scale: 1, duration: 340, ease: 'Back.easeOut' })
  }

  atualizarContador() {
    const p = this.pagina
    const l = p.licaoAtual
    const n = `${p.licao + 1} de ${LICOES.length} · ${l.titulo}`
    let texto = ''
    if (p.etapa === 'explicar' || p.etapa === 'demo') texto = n
    else if (p.etapa === 'preparar' || p.etapa === 'tentar' || p.etapa === 'errou') texto = `${n} · sobreviva ${Math.ceil(Math.max(0, l.duracao - p.decorrido) / 1000)} s`
    else if (p.etapa === 'acertou') texto = `${n} · adesivo!`
    else if (p.etapa === 'concluida') texto = `adesivos: ${p.adesivos} de ${LICOES.length}`
    this.contador.setText(texto).setVisible(p.etapa !== 'escolha')
    const barra = ['preparar', 'tentar', 'errou', 'acertou'].includes(p.etapa)
    if (barra) barraDeGiz(this.gBarra, CAIXA, p.progressoOnda)
    else this.gBarra.clear()
  }

  atualizarEscolha() {
    const p = this.pagina
    const ver = p.etapa === 'escolha'
    this.linhasEscolha.forEach((t, k) => t.setVisible(ver).setColor(k === p.opcao ? TINTA : TINTA_SUAVE).setAlpha(k === p.opcao ? 1 : 0.7))
    this.cursor.setVisible(ver)
    if (ver) {
      const t = this.linhasEscolha[p.opcao]
      this.cursor.setPosition(t.x - t.width / 2 - 16, t.y + t.height / 2)
    }
  }

  concluir() {
    definirPref('manual', comPagina2(pref('manual')))
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
        // a página 3 começa do mesmo papel (a capa dela já está na tela): troca de cena sem fade
        this.saindo = true
        this.scene.start('ManualRalsei3', { deVirada: true })
      },
    })
  }
}

const slotX = (k) => CX + (k - (LICOES.length - 1) / 2) * 46

// adesivo redondo de cada mini-lição: papel colorido recortado com o desenho de giz dela
const CORES_ADESIVO = { chuva: '#d8ecff', linha: '#ece4fb', mira: '#ffe1ea' }
function assarAdesivoDaLicao(scene, id) {
  const R = 16
  const silhueta = elipse(0, 0, R, R, 28)
  return assarAdesivo(scene, `manual-adesivo-${id}`, {
    silhueta,
    borda: 3,
    base: (ctx) => {
      ctx.fillStyle = CORES_ADESIVO[id]
      ctx.beginPath()
      silhueta.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)))
      ctx.closePath()
      ctx.fill()
    },
    camadas: iconeDaLicao(criarRng(`adesivo:${id}`), id, 11),
    grao: 0.25,
  })
}
