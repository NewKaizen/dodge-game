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
import { dicasDeBotoes, teclasDoEixo } from '../manual/botoes.js'
import { criarPagina7, PASSOS7 } from '../manual/pagina7.js'
import { criarPagina8, PASSOS8 } from '../manual/pagina8.js'
import { criarPagina9, PASSOS9, MAO_P9 } from '../manual/pagina9.js'
import { OPCOES_AJUDA, expressaoDoExercicio, DISPARO_MS } from '../manual/exercicio.js'
import { ENERGIA, cartaDoManual } from '../manual/cartasDoManual.js'
import { assarCartaDeGiz, assarBrilhoDaCarta, caminho } from '../manual/cartaDeGiz.js'
import { normalizarProgresso, comPasso, comPagina } from '../manual/progresso.js'
import { CORES_GIZ, rabiscoDoCoracao, rabiscoDaBala, rabiscoDaMarca, rabiscoDaGema, sublinhado, rabiscosDaMargem, iconeDoPasso, pontosDaMira } from '../manual/ilustracoes.js'
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
  joysDosJogadores,
} from '../manual/paginaBase.js'

// O MANUAL DO RALSEI, páginas EXTRAS de exercício (docs/manual-ralsei.md): 7 "Graze: raspando", 8 "Jogando em dupla"
// e 9 "Ases, SUPER e perfeitos". Esta cena serve as três (ManualRalsei8 e ManualRalsei9 só mudam a página). A página 6
// (os quatro naipes) é das páginas de cartas (scenes/ManualRalsei3.js). As páginas 6 a 9 são EXTRAS: o índice as oferece,
// nunca obriga, e o manual essencial (1 a 5) vale sozinho.
//
// O mesmo caderno das outras páginas: o Ralsei explica num balão, depois é a vez do jogador. Os desafios usam o
// coração e as balas do jogo (manual/onda.js + entities/fisica.js: o graze e o acerto são os de Balas.tocar) e a
// mesa de verdade (energia, perfeitos, SUPER: pvp/regras.js); o giz é só desenho. Os passos e as falas ficam em
// manual/pagina7.js, pagina8.js e pagina9.js; a máquina (puro, testada) em manual/exercicio.js.
//
//   mover: o coração (de cada pessoa, na página 8) · ←/→: escolher a carta · ↑/↓: ajuda (depois de 3 erros)
//   A: continuar / confirmar / tentar já / virar · B: volta ao índice do manual
//
// Página 8: com 2 pessoas (2 controles, controle + teclado) cada uma move um coração; com 1, todos os controles movem o
// vermelho e o parceiro é o Ralsei (a CPU aliada, coração verde). As páginas 7 e 9 têm um coração só: qualquer controle move.
//
// "Reduzir animações": giz parado, Ralsei parado, balão inteiro, sem rastro, sem confete, avisos sem subir, virada em
// corte. A linha pontilhada dos tiros FICA (é informação, não enfeite). Nenhum clarão. No dev: window.manualRalsei7 a 9.

const CAIXA = { esquerda: 440, direita: 780, topo: 148, base: 348 }
const CX = (CAIXA.esquerda + CAIXA.direita) / 2
const CY = (CAIXA.topo + CAIXA.base) / 2
const VARIANTES = 3
const TROCA_MS = 170
const BALAO = { x: 64, y: 92, largura: 334, altura: 128, cauda: { de: 112, x: 126, y: 262 }, tamanho: 16 }
const RALSEI = { x: 176, y: 438, escala: 1.12 }
const SLOT_Y = CAIXA.topo - 30
const RASTRO = 3
const MAX_BALAS = 26
const COR_MIRA = 0xd01a33
const GEMAS = { y: CAIXA.base + 38, passo: 19, raio: 7.2 }
const GEMAS_MESA_Y = CAIXA.topo + 30
const ESCALA_CARTA = 0.9

// o que muda de uma página para a outra
const PAGINAS_EXTRA = {
  7: {
    titulo: 'Graze: raspando',
    criar: (op) => criarPagina7(op),
    passos: PASSOS7,
    proxima: 8,
    sublinhado: PALETA.amarelo,
    fitas: [PALETA.rosa, PALETA.verde, PALETA.azul],
    margem: [
      { tipo: 'sol', x: 806, y: 62, r: 14 },
      { tipo: 'estrela', x: 412, y: 50, r: 6, cor: PALETA.amarelo },
      { tipo: 'coracao', x: 818, y: 196, r: 5, cor: PALETA.rosa },
      { tipo: 'estrela', x: 822, y: 270, r: 5, cor: PALETA.lavanda },
      { tipo: 'pata', x: 812, y: 444, r: 8, giro: -0.4, cor: PALETA.verde },
      { tipo: 'pata', x: 826, y: 412, r: 7, giro: -0.6, cor: PALETA.verde },
      { tipo: 'estrela', x: 336, y: 304, r: 6, cor: PALETA.azul },
      { tipo: 'coracao', x: 306, y: 380, r: 5, cor: PALETA.lavanda },
      { tipo: 'estrela', x: 406, y: 410, r: 5, cor: PALETA.rosa },
      { tipo: 'coracao', x: 70, y: 262, r: 5, cor: PALETA.amarelo },
    ],
  },
  8: {
    titulo: 'Jogando em dupla',
    criar: (op) => criarPagina8(op),
    passos: PASSOS8,
    proxima: 9,
    sublinhado: PALETA.verde,
    fitas: [PALETA.lavanda, PALETA.amarelo, PALETA.rosa],
    margem: [
      { tipo: 'nuvem', x: 742, y: 64 },
      { tipo: 'coracao', x: 412, y: 52, r: 6, cor: PALETA.rosa },
      { tipo: 'coracao', x: 430, y: 66, r: 5, cor: PALETA.azul },
      { tipo: 'estrela', x: 820, y: 196, r: 6, cor: PALETA.amarelo },
      { tipo: 'coracao', x: 818, y: 270, r: 5, cor: PALETA.verde },
      { tipo: 'pata', x: 806, y: 440, r: 8, giro: -0.4, cor: PALETA.verde },
      { tipo: 'estrela', x: 336, y: 304, r: 6, cor: PALETA.lavanda },
      { tipo: 'coracao', x: 306, y: 380, r: 5, cor: PALETA.azul },
      { tipo: 'estrela', x: 406, y: 410, r: 5, cor: PALETA.rosa },
      { tipo: 'coracao', x: 70, y: 262, r: 5, cor: PALETA.rosa },
    ],
  },
  9: {
    titulo: 'Ases, SUPER e perfeitos',
    tamanhoTitulo: 24,
    criar: (op) => criarPagina9(op),
    passos: PASSOS9,
    proxima: null,
    cartas: MAO_P9,
    sublinhado: PALETA.ouro,
    fitas: [PALETA.amarelo, PALETA.coracao, PALETA.lavanda],
    margem: [
      { tipo: 'estrela', x: 806, y: 62, r: 8, cor: PALETA.amarelo },
      { tipo: 'estrela', x: 780, y: 84, r: 5, cor: PALETA.rosa },
      { tipo: 'coracao', x: 412, y: 50, r: 6, cor: PALETA.lavanda },
      { tipo: 'estrela', x: 820, y: 196, r: 6, cor: PALETA.azul },
      { tipo: 'coracao', x: 818, y: 270, r: 5, cor: PALETA.rosa },
      { tipo: 'pata', x: 812, y: 444, r: 8, giro: -0.4, cor: PALETA.verde },
      { tipo: 'estrela', x: 336, y: 304, r: 6, cor: PALETA.amarelo },
      { tipo: 'coracao', x: 306, y: 380, r: 5, cor: PALETA.azul },
      { tipo: 'estrela', x: 406, y: 410, r: 5, cor: PALETA.lavanda },
      { tipo: 'coracao', x: 70, y: 262, r: 5, cor: PALETA.amarelo },
    ],
  },
}
const CORES_ADESIVO = { raspar: '#fff2c8', energia: '#d8ecff', marcas: '#dff4e6', dupla: '#ffe1ea', carregar: '#d8ecff', super: '#fff2c8', ases: '#ece4fb' }
const COR_DO_CORACAO = { vermelho: ['coracao', null], azul: ['azul', { cor: PALETA.azul, escura: PALETA.azulEscuro }], verde: ['verde', { cor: PALETA.verde, escura: PALETA.verdeEscuro }] }

// ---------- o fundo de cada página (a capa aparece atrás da folha que vira na página anterior) ----------

function assarFundoDaPaginaExtra(scene, n) {
  const cfg = PAGINAS_EXTRA[n]
  const c = CAIXA
  const r = (s) => criarRng(`manual:p${n}:${s}`)
  const letreiro = assarLetreiro(scene, `manual-p${n}-titulo`, cfg.titulo, { tamanho: cfg.tamanhoTitulo ?? 26 })
  assar(scene, `manual-p${n}-fundo`, LARGURA, ALTURA, {
    camadas: [...rabiscosDaMargem(r('margem'), cfg.margem), { tipo: 'traco', tracos: sublinhado(r('sub'), 66, 76, 66 + Math.min(letreiro.largura, 420)), cor: cfg.sublinhado, largura: 3.4, passadas: 3 }],
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
      desenharFita(ctx, c.esquerda - 8, c.topo - 10, 64, 18, -0.62, cfg.fitas[0])
      desenharFita(ctx, c.direita + 8, c.topo - 10, 64, 18, 0.62, cfg.fitas[1])
      desenharFita(ctx, c.direita + 6, c.base + 10, 52, 16, -0.6, cfg.fitas[2])
    },
  })
  return { rotulo: assarRotulo(scene, `manual-rotulo-p${n}`, `PÁGINA ${n}`), titulo: letreiro }
}

// a página como ela abre: papel, fundo, etiqueta, título e o Ralsei (parado)
export function montarCapaDaPaginaExtra(scene, c, n) {
  const i = assarFundoDaPaginaExtra(scene, n)
  c.add(scene.add.image(0, 0, PAPEL.papel).setOrigin(0))
  c.add(scene.add.image(0, 0, `manual-p${n}-fundo`).setOrigin(0))
  c.add(imagemDeCera(scene, 60, 6, i.rotulo))
  c.add(scene.add.image(62, 30, i.titulo.chave).setOrigin(0))
  const r = new RalseiDesenhado(scene, RALSEI.x, RALSEI.y, { calmo: true, escala: RALSEI.escala })
  r.setExpressao('animado')
  c.add(r.container)
  c.add(scene.add.text(RALSEI.x, RALSEI.y + 9, 'RALSEI', { fontFamily: FONTE_TEXTO, fontSize: '11px', fontStyle: 'bold', color: TINTA_SUAVE }).setOrigin(0.5, 0))
}

// A instância da cena é REAPROVEITADA pelo Phaser: tudo volta ao inicial no começo do init().
const estadoInicial = () => ({
  numero: 7,
  cfg: null,
  pagina: null,
  humanos: 1,
  controles: null,
  folha: null,
  proxima: null,
  balao: null,
  ralsei: null,
  imgCaixa: null,
  coracoes: null,
  aneis: null,
  rotulosDosCoracoes: null,
  marcas: null,
  gMira: null,
  gGolpe: null,
  gBarra: null,
  gBurst: null,
  balas: null,
  imgSlots: null,
  contador: null,
  combo: null,
  textoSuper: null,
  gemas: null,
  textoEnergia: null,
  rotuloEnergia: null,
  cartas: null,
  linhasAjuda: null,
  cursorAjuda: null,
  adesivoFinal: null,
  confete: null,
  dicas: null,
  infos: null,
  avisos: null,
  energiaVista: null,
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

export default class ManualRalsei7 extends Phaser.Scene {
  constructor(chave = 'ManualRalsei7') {
    super(chave)
  }

  // dados: { deVirada } (veio da página anterior virando a folha: sem fade) · { recomecar } (ignora o progresso)
  init(dados) {
    Object.assign(this, estadoInicial())
    this.dados = dados ?? {}
    this.numero = Number(this.sys.settings.key.replace('ManualRalsei', '')) || 7
    this.cfg = PAGINAS_EXTRA[this.numero]
  }

  create() {
    this.calmo = menosMovimento() || fatores().tremor === 0
    this.rastros = !this.calmo && fatores().rastros
    this.avisos = []
    this.controles = new Controles(this)
    // na página 8 com 2 pessoas locais, cada uma move um coração; nas outras, qualquer controle move o único coração
    this.humanos = this.numero === 8 && this.controles.numJogadores >= 2 ? 2 : 1
    // retoma de onde parou (a página já completa recomeça do zero, para jogar de novo)
    const prog = normalizarProgresso(pref('manual'))[`p${this.numero}`]
    const passos = this.dados.recomecar || prog.completa ? null : prog.passos
    this.pagina = this.cfg.criar({ caixa: CAIXA, velocidade: this.registry.get('velocidade') ?? CORACAO.velocidadePadrao, passos, humanos: this.humanos })
    this.controles.onBotao((j, botao) => (botao === 'A' ? this.apertarA() : this.apertarB()))
    this.controles.onPausa(() => this.apertarB())

    const papel = garantirPapel(this)
    this.add.image(0, 0, papel.mesa).setOrigin(0).setDepth(0)
    this.add.image(0, 0, papel.espiral).setOrigin(0).setDepth(30)
    this.assarTudo()
    this.montarProxima()
    this.montarFolha()

    if (!this.dados.deVirada) this.cameras.main.fadeIn(240)
    const global = `manualRalsei${this.numero}`
    if (import.meta.env.DEV) window[global] = this
    this.events.once('shutdown', () => {
      if (window[global] === this) delete window[global]
      this.confete?.destroy()
    })
    this.balao.dizer(this.pagina.fala)
    this.atualizarDicas()
    musica('tutorial2', 'tutorial')
  }

  // ---------- texturas (assadas uma vez; sementes fixas) ----------

  assarTudo() {
    const n = this.numero
    const r = (s) => criarRng(`manual:p${n}:${s}`)
    const variantes = (nome, gerar) => Array.from({ length: VARIANTES }, (_, v) => gerar(r(`${nome}${v}`), v))
    const caixa = variantes('caixa', (g) => retanguloGiz(g, CAIXA.esquerda, CAIXA.topo, CAIXA.direita - CAIXA.esquerda, CAIXA.base - CAIXA.topo, { tremor: 1.4, excesso: 6, tracos: 2 }))
    const coracoes = {}
    for (const [nome, [chave, cor]] of Object.entries(COR_DO_CORACAO)) {
      coracoes[nome] = variantes(`coracao-${nome}`, (g) => rabiscoDoCoracao(g, 24, cor ?? undefined)).map((f, v) => assarCamadas(this, `manual-extra-${chave}-${v}`, f.camadas, { grao: 0.25 }))
    }
    const bala = variantes('bala', (g) => rabiscoDaBala(g, 7))
    const marca = variantes('marca', (g) => rabiscoDaMarca(g, 'estrela', 13))
    const fundo = assarFundoDaPaginaExtra(this, n)
    const passos = this.cfg.passos
    const cartas = {}
    for (const id of this.cfg.cartas ?? []) cartas[id] = assarCartaDeGiz(this, cartaDoManual(id), false)
    this.infos = {
      ...fundo,
      caixa: caixa.map((t, v) => assarCamadas(this, `manual-extra-caixa-${v}`, [{ tipo: 'traco', tracos: t, cor: CORES_GIZ.grafite, largura: 3.4, passadas: 3 }], { grao: 0.45 })),
      coracoes,
      bala: bala.map((f, v) => assarCamadas(this, `manual-extra-bala-${v}`, f.camadas, { grao: 0.2 })),
      marca: marca.map((f, v) => assarCamadas(this, `manual-extra-marca-${v}`, f.camadas, { grao: 0.3 })),
      anel: assarCamadas(this, 'manual-extra-anel', [{ tipo: 'traco', tracos: circuloGiz(r('anel'), 0, 0, CORACAO.graze, { tremor: 0.6, tracos: 1 }), cor: PALETA.ouro, largura: 2.4, passadas: 2 }], { grao: 0.3 }),
      gemaCheia: assarCamadas(this, 'manual-extra-gema-cheia', rabiscoDaGema(r('gema'), GEMAS.raio).camadas, { grao: 0.2 }),
      gemaVazia: assarCamadas(this, 'manual-extra-gema-vazia', rabiscoDaGema(r('gema-v'), GEMAS.raio, { estado: 'vazia' }).camadas, { grao: 0.2 }),
      slotVazio: assarCamadas(this, 'manual-extra-slot', [{ tipo: 'traco', tracos: circuloGiz(r('slot'), 0, 0, 16, { tremor: 0.9, tracos: 1 }), cor: 0x9a8fb8, largura: 2.2, passadas: 2, alpha: 0.8 }], { grao: 0.35 }),
      cursor: assarCamadas(this, 'manual-extra-cursor', rabiscoDoCoracao(r('cursor'), 18).camadas, { grao: 0.25 }),
      brilhoCarta: assarBrilhoDaCarta(this),
      cartas,
      adesivos: passos.map((ps) => assarAdesivoDoPasso(this, ps.id)),
      final: assarEstrelaDourada(this, `manual-adesivo-final-p${n}`, 96, { texto: `PÁGINA ${n}`, subtexto: '✓', giro: n % 2 ? 0.12 : -0.12 }),
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
    const p = this.pagina
    add(this.add.image(0, 0, PAPEL.papel).setOrigin(0))
    add(this.add.image(0, 0, `manual-p${this.numero}-fundo`).setOrigin(0))
    add(imagemDeCera(this, 60, 6, i.rotulo))
    add(this.add.image(62, 30, i.titulo.chave).setOrigin(0))

    this.ralsei = new RalseiDesenhado(this, RALSEI.x, RALSEI.y, { calmo: this.calmo, escala: RALSEI.escala })
    add(this.ralsei.container)
    add(this.texto(RALSEI.x, RALSEI.y + 9, 'RALSEI', 11, { fontStyle: 'bold', color: TINTA_SUAVE }).setOrigin(0.5, 0))
    this.balao = new Balao(this, { ...BALAO, chave: `manual-p${this.numero}-balao`, calmo: this.calmo })
    add(...this.balao.objetos)

    this.imgCaixa = add(imagemDeCera(this, 0, 0, i.caixa[0]))
    this.imgSlots = this.cfg.passos.map((_, k) => add(imagemDeCera(this, slotX(this.cfg.passos.length, k), SLOT_Y, i.slotVazio)))
    p.resultados.forEach((res, k) => res === 'feita' && trocarImagem(this.imgSlots[k], i.adesivos[k]))

    // as marcas da página 8 (a estrela de cada coração)
    this.marcas = [0, 1].map((k) => add(imagemDeCera(this, 0, 0, i.marca[0]).setVisible(false)))
    this.gMira = add(this.add.graphics())
    this.balas = new BalasDeGiz(this, { caixa: CAIXA, infos: i.bala, pai: folha, n: MAX_BALAS, rastro: this.rastros ? RASTRO : 0 })

    // os corações (até 2) com o anel de graze e o rótulo de quem é
    this.aneis = [0, 1].map(() => add(imagemDeCera(this, 0, 0, i.anel).setVisible(false)))
    this.coracoes = [0, 1].map(() => {
      const c = coracaoDeGiz(this, i.coracoes.vermelho[0])
      add(c.container.setVisible(false))
      return c
    })
    this.rotulosDosCoracoes = [0, 1].map(() => add(this.texto(0, 0, '', 11, { fontStyle: 'bold', color: TINTA }).setOrigin(0.5, 1).setVisible(false)))
    this.gGolpe = add(this.add.graphics())
    this.gBarra = add(this.add.graphics())
    this.contador = add(this.texto(CX, CAIXA.base + 18, '', 13, { color: TINTA_SUAVE, fontStyle: 'bold' }).setOrigin(0.5, 0))
    this.combo = add(this.texto(CX, CAIXA.base + 66, '', 20, { color: corCss(PALETA.rosaEscuro), fontStyle: 'bold' }).setOrigin(0.5, 0))

    // as gemas de energia (o jogo tem 10) e o número
    const x0 = CX - ((ENERGIA.maxima - 1) * GEMAS.passo) / 2
    this.gemas = Array.from({ length: ENERGIA.maxima }, (_, k) => add(imagemDeCera(this, x0 + k * GEMAS.passo, GEMAS.y, i.gemaVazia).setVisible(false)))
    this.rotuloEnergia = add(this.texto(x0 - 14, GEMAS.y, 'energia', 12, { fontStyle: 'bold', color: TINTA_SUAVE }).setOrigin(1, 0.5).setVisible(false))
    this.textoEnergia = add(this.texto(x0 + (ENERGIA.maxima - 1) * GEMAS.passo + 16, GEMAS.y, '', 16, { fontStyle: 'bold', color: corCss(0x0b6a9e) }).setOrigin(0, 0.5).setVisible(false))

    // a mão (página 9): cada carta é um container (brilho de seleção + carta)
    this.cartas = (this.cfg.cartas ?? []).map((id) => {
      const c = add(this.add.container(CX, CY + 36).setVisible(false))
      const brilho = this.add.image(0, 0, i.brilhoCarta).setVisible(false)
      const img = this.add.image(0, 0, i.cartas[id])
      c.add([brilho, img])
      c.setScale(ESCALA_CARTA)
      return { id, c, brilho, img }
    })
    this.gBurst = add(this.add.graphics())
    this.textoSuper = add(this.texto(CX, CY - 10, '★ SUPER! ★', 40, { fontStyle: 'bold', color: corCss(PALETA.ouro), stroke: '#ffffff', strokeThickness: 7 }).setOrigin(0.5).setVisible(false))

    // a ajuda depois de 3 erros (um coraçãozinho de giz marca a opção)
    this.linhasAjuda = OPCOES_AJUDA.map((o, k) => add(this.texto(CX, CAIXA.base + 24 + k * 26, o, 16, { fontStyle: 'bold' }).setOrigin(0.5, 0).setVisible(false)))
    this.cursorAjuda = add(imagemDeCera(this, 0, 0, i.cursor).setScale(0.7).setVisible(false))
    this.adesivoFinal = add(imagemDeCera(this, CX, CY + 4, i.final).setVisible(false))
    this.dicas = add(this.texto(LARGURA / 2 + 40, ALTURA - 24, '', 14, { color: TINTA_SUAVE, fontStyle: 'bold' }).setOrigin(0.5))
    this.redesenhar(true)
  }

  // atrás da folha: a próxima página como ela abre (se houver)
  montarProxima() {
    this.proxima = this.add.container(0, 0).setDepth(10).setVisible(false)
    if (this.cfg.proxima) montarCapaDaPaginaExtra(this, this.proxima, this.cfg.proxima)
  }

  // ---------- desenho ----------

  // o passo de cartas (página 9) mostra a mesa: as gemas e a mão, no lugar da caixa
  emMesa() {
    const p = this.pagina
    return p.passoAtual.tipo === 'escolha' && ['explicar', 'escolher', 'errou', 'ajuda', 'disparando', 'acertou'].includes(p.etapa)
  }

  corDoCoracao(a) {
    return a.cpu ? 'verde' : a.id === 1 ? 'azul' : 'vermelho'
  }

  redesenhar(trocar = false) {
    const p = this.pagina
    const v = this.fase
    const escolha = this.emMesa()
    const fim = ['concluida', 'virando', 'fim'].includes(p.etapa)
    if (trocar) trocarImagem(this.imgCaixa, this.infos.caixa[v])
    this.imgCaixa.setVisible(!escolha)

    // corações (só nos desafios: parados no "explicar", andando depois)
    const emJogo = !escolha && !fim && p.etapa !== 'intro'
    const alvos = emJogo ? p.alvos : []
    const apagado = p.etapa === 'errou' || p.etapa === 'ajuda'
    this.coracoes.forEach((h, k) => {
      const a = alvos[k]
      h.container.setVisible(Boolean(a))
      this.aneis[k].setVisible(Boolean(a && a.ativo && p.hud?.anel))
      this.rotulosDosCoracoes[k].setVisible(Boolean(a) && this.numero === 8)
      if (!a) return
      const cor = this.corDoCoracao(a)
      if (trocar || h.cor !== cor) {
        trocarImagem(h.img, this.infos.coracoes[cor][v])
        h.cor = cor
      }
      h.container.setPosition(a.x, a.y).setAlpha(a.caido ? 0.28 : apagado ? 0.45 : 1)
      this.aneis[k].setPosition(a.x, a.y).setAlpha(this.alvoNoAnel(a) ? 1 : 0.5)
      this.rotulosDosCoracoes[k].setPosition(a.x, a.y - 15).setText(this.rotuloDoCoracao(a))
    })
    // as marcas da página 8
    const marcas = emJogo ? p.tent?.marcas : null
    this.marcas.forEach((m, k) => {
      const dado = marcas?.[k]
      m.setVisible(Boolean(dado))
      if (!dado) return
      if (trocar) trocarImagem(m, this.infos.marca[v])
      m.setPosition(dado.x, dado.y).setAlpha(dado.pega ? 0.3 : 1)
    })
    this.balas.atualizar(escolha ? [] : p.balas, v, trocar)
    this.desenharMira()
  }

  rotuloDoCoracao(a) {
    if (a.cpu) return 'Ralsei'
    return this.humanos >= 2 ? `P${a.id + 1}` : 'você'
  }

  // alguma bala perigosa dentro do anel de graze deste coração? (o anel acende)
  alvoNoAnel(a) {
    for (const b of this.pagina.balas) {
      if (b.idade < b.aviso) continue
      const d = Math.hypot(a.x - b.x, a.y - b.y) - b.raio
      if (d <= a.graze) return true
    }
    return false
  }

  // a linha pontilhada de cada tiro que ainda está avisando (parado): o caminho exato que ele vai fazer
  desenharMira() {
    const g = this.gMira.clear()
    for (const b of this.pagina.balas) {
      const linha = b.extra?.linha
      if (!linha || b.idade >= b.aviso) continue
      for (const q of pontosDaMira(linha, CAIXA)) {
        g.fillStyle(COR_MIRA, 0.9)
        g.fillCircle(q.x, q.y, 2.3)
      }
      g.lineStyle(2, COR_MIRA, 0.9)
      g.strokeCircle(b.x, b.y, b.raio + 4)
    }
  }

  // o que fica debaixo da caixa: contador, gemas de energia, combo
  atualizarPainel() {
    const p = this.pagina
    const h = p.hud
    const escolha = this.emMesa()
    const energia = p.energiaNaTela
    const mostrarGemas = energia !== null && !['intro', 'concluida', 'virando', 'fim'].includes(p.etapa) && (escolha || Boolean(p.tent))
    const y = escolha ? GEMAS_MESA_Y : GEMAS.y
    this.gemas.forEach((g, k) => g.setVisible(mostrarGemas).setY(y))
    this.rotuloEnergia.setVisible(mostrarGemas).setY(y)
    this.textoEnergia.setVisible(mostrarGemas).setY(y)
    if (mostrarGemas) this.atualizarEnergia(energia)
    else this.energiaVista = null

    let texto = ''
    if (escolha) texto = p.etapa === 'acertou' ? 'adesivo!' : ''
    else if (['explicar', 'preparar', 'tentar', 'errou', 'acertou'].includes(p.etapa) && h?.contador) texto = h.contador
    else if (p.etapa === 'concluida') texto = `adesivos: ${p.adesivos} de ${p.passos.length}`
    this.contador.setText(texto).setVisible(p.etapa !== 'ajuda')
    this.combo.setText(!escolha && p.tent && ['preparar', 'tentar', 'acertou'].includes(p.etapa) ? (h?.combo ?? '') : '')
    // a barra de tempo (só quando há tempo certo para sobreviver)
    const barra = this.numero === 8 && p.passoAtual.id === 'dupla' && ['preparar', 'tentar', 'errou', 'acertou'].includes(p.etapa)
    if (barra) barraDeGiz(this.gBarra, CAIXA, p.etapa === 'tentar' ? Math.min(1, (p.tent?.tempo ?? 0) / (p.tent?.duracao ?? 1)) : p.etapa === 'acertou' ? 1 : 0)
    else this.gBarra.clear()
  }

  // as gemas: a energia de verdade (as novas brilham)
  atualizarEnergia(e) {
    if (e === this.energiaVista) return
    const antes = this.energiaVista ?? e
    this.energiaVista = e
    this.gemas.forEach((g, k) => trocarImagem(g, k < e ? this.infos.gemaCheia : this.infos.gemaVazia))
    this.textoEnergia.setText(String(e))
    if (e > antes) {
      tocar(this, 'graze')
      for (let k = antes; k < e; k++) brilhar(this, this.gemas[k].x, this.gemas[k].y, { pai: this.folha, calmo: this.calmo, n: 4, raio: 14 })
    } else if (e < antes) tocar(this, 'cartaJogar')
  }

  // a mão da página 9: as cartas do passo atual lado a lado, a escolhida levantada
  atualizarMao() {
    const p = this.pagina
    const escolha = this.emMesa()
    const slots = escolha ? p.slots : []
    const n = slots.length
    const espaco = n > 1 ? Math.min(100, 272 / (n - 1)) : 0
    this.cartas.forEach((s) => {
      const k = slots.indexOf(s.id)
      const ver = k >= 0
      s.c.setVisible(ver)
      if (!ver) return
      const x = CX + (k - (n - 1) / 2) * espaco
      const sel = k === p.cursor && p.etapa === 'escolher'
      let y = CY + 38 - (sel ? 11 : 0)
      let escala = ESCALA_CARTA * (sel ? 1.06 : 1)
      let alpha = p.etapa === 'ajuda' ? 0.15 : 1
      if (p.etapa === 'disparando' && p.jogada) {
        if (p.jogada.slot === k) {
          // a carta sobe, cresce e some no clarão do SUPER (parada no modo calmo)
          const f = Math.min(1, p.tempoEtapa / 900)
          y = this.calmo ? y : y + (CY - 10 - y) * f
          escala = this.calmo ? escala : escala * (1 + 0.5 * f)
          alpha = p.tempoEtapa > DISPARO_MS - 700 ? Math.max(0, (DISPARO_MS - p.tempoEtapa) / 700) : 1
        } else alpha = 0.35
      }
      s.c.setPosition(x, y).setScale(escala).setAlpha(alpha)
      s.brilho.setVisible(sel)
    })
  }

  // o estouro do SUPER: raios de giz saindo do meio, o nome grande (parado no modo calmo)
  atualizarSuper(tempo) {
    const p = this.pagina
    const g = this.gBurst.clear()
    const ligado = p.etapa === 'disparando'
    this.textoSuper.setVisible(ligado)
    if (!ligado) return
    const f = Math.min(1, p.tempoEtapa / DISPARO_MS)
    const raios = 16
    for (let k = 0; k < raios; k++) {
      const a = (k / raios) * Math.PI * 2 + (this.calmo ? 0 : tempo / 900)
      const de = 30 + (this.calmo ? 40 : f * 60)
      const ate = de + 26 + (k % 2) * 14
      g.lineStyle(4, [PALETA.amarelo, PALETA.rosa, PALETA.azul, PALETA.verde][k % 4], 0.85 * (1 - f * 0.6))
      g.lineBetween(CX + Math.cos(a) * de, CY - 10 + Math.sin(a) * de, CX + Math.cos(a) * ate, CY - 10 + Math.sin(a) * ate)
    }
    this.textoSuper.setScale(this.calmo ? 1 : 0.7 + Math.min(1, p.tempoEtapa / 400) * 0.3).setAlpha(f > 0.85 ? (1 - f) / 0.15 : 1)
  }

  // avisos que sobem e somem ("GRAZE!", "PERFEITO x2!"): parados e curtos no modo calmo
  avisar(tempo, x, y, texto, { cor = PALETA.ouro, tamanho = 15, ms = 900 } = {}) {
    const t = this.texto(x, y, texto, tamanho, { fontStyle: 'bold', color: corCss(cor), stroke: '#ffffff', strokeThickness: 4 }).setOrigin(0.5)
    this.folha.add(t)
    this.avisos.push({ t, y0: y, nascimento: tempo, ms: this.calmo ? Math.min(ms, 700) : ms })
  }

  atualizarAvisos(tempo) {
    this.avisos = this.avisos.filter((a) => {
      const k = (tempo - a.nascimento) / a.ms
      if (k >= 1) {
        a.t.destroy()
        return false
      }
      a.t.setAlpha(k > 0.6 ? (1 - k) / 0.4 : 1)
      if (!this.calmo) a.t.setY(a.y0 - k * 26)
      return true
    })
  }

  // ---------- dicas ----------

  atualizarDicas() {
    const d = dicasDeBotoes(get(jogo).fonte, normalizarTeclas(pref('teclas')))
    const p = this.pagina
    const sair = `${d.B}: sair`
    const ultima = this.cfg.proxima === null
    const linha =
      {
        intro: `${d.A}: continuar      ${sair}`,
        explicar: `${d.A}: ${p.passoAtual.tipo === 'escolha' ? 'ver as cartas' : 'começar'}      ${sair}`,
        escolher: `${teclasDoEixo(d)}: escolher      ${d.A}: confirmar      ${sair}`,
        errou: `${d.A}: tentar já      ${sair}`,
        ajuda: `${teclasDoEixo(d, 'vertical')}: escolher      ${d.A}: confirmar      ${sair}`,
        acertou: `${d.A}: continuar      ${sair}`,
        concluida: `${d.A}: ${ultima ? 'voltar ao índice' : 'virar a página'}      ${sair}`,
        fim: `${d.A}: voltar ao índice      ${sair}`,
        disparando: sair,
        virando: sair,
      }[p.etapa] ?? `${d.mover}: ${this.humanos >= 2 ? 'mover os corações (um conjunto de teclas para cada pessoa)' : 'mover o coração'}      ${sair}`
    if (linha === this.dicaAtual) return
    this.dicaAtual = linha
    this.dicas.setText(linha)
  }

  // ---------- entrada ----------

  apertarA() {
    if (this.saindo || this.virando) return
    if (this.balao.digitando && this.pagina.etapa !== 'escolher') return this.balao.completar()
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
      // ←/→ na mão e ↑/↓ na ajuda (qualquer jogador local)
      for (let j = 0; j < this.controles.numJogadores; j++) if (p.mover(this.controles.toque(j))) tocar(this, p.etapa === 'ajuda' ? 'mover' : 'cartaSelecionar')
      p.tick(delta, this.humanos >= 2 ? joysDosJogadores(this.controles) : [joyDeTodos(this.controles)])
    }
    this.balao.update(tempo, delta, ['intro', 'explicar', 'acertou', 'errou', 'concluida'].includes(p.etapa))
    const eventos = p.drenar()
    for (const e of eventos) this.aoEvento(e, tempo)

    const u = this.ultimoEvento
    this.ralsei.setExpressao(expressaoDoExercicio(p.etapa, u && { tipo: u.tipo, ha: tempo - u.quando }))
    this.ralsei.update(tempo)

    let trocar = false
    if (!this.calmo && tempo >= this.proximaTroca) {
      this.fase = (this.fase + 1) % VARIANTES
      this.proximaTroca = tempo + TROCA_MS
      trocar = true
    }
    this.redesenhar(trocar || eventos.length > 0)
    this.atualizarPainel()
    this.atualizarMao()
    this.atualizarSuper(tempo)
    this.atualizarAvisos(tempo)
    if (this.confete && !this.confete.update(delta)) this.confete = null
    this.atualizarAjuda()
    this.atualizarDicas()
  }

  aoEvento(e, tempo) {
    const p = this.pagina
    if (e.tipo === 'fala') this.balao.dizer(p.fala)
    if (e.tipo === 'etapa') {
      // a fala da tentativa já estava no balão desde o "preparar": não redigita
      if (e.etapa !== 'tentar') this.balao.dizer(p.fala)
      if (e.etapa === 'preparar' || e.etapa === 'explicar' || e.etapa === 'escolher') this.gGolpe.clear()
      if (e.etapa === 'concluida') this.concluir()
      if (e.etapa === 'virando') this.virarPagina()
    }
    const alvo = e.indice !== undefined ? p.alvos[e.indice] : null
    if (e.tipo === 'acerto') {
      this.ultimoEvento = { tipo: 'acerto', quando: tempo }
      tocar(this, 'dano')
      if (alvo) riscosDeGolpe(this.gGolpe, alvo.x, alvo.y)
    }
    if (e.tipo === 'caiu') this.avisar(tempo, alvo?.x ?? CX, (alvo?.y ?? CY) - 24, 'caiu!', { cor: PALETA.coracao })
    if (e.tipo === 'graze' && alvo) {
      this.ultimoEvento = { tipo: 'marca', quando: tempo }
      tocar(this, 'graze')
      this.avisar(tempo, alvo.x, alvo.y - 28, 'GRAZE!', { cor: PALETA.ouro })
      brilhar(this, alvo.x, alvo.y, { pai: this.folha, calmo: this.calmo, n: 4, raio: 20 })
    }
    if (e.tipo === 'marca') {
      this.ultimoEvento = { tipo: 'marca', quando: tempo }
      tocar(this, 'graze')
      const m = p.tent?.marcas?.[e.indice]
      if (m) brilhar(this, m.x, m.y, { pai: this.folha, calmo: this.calmo })
    }
    if (e.tipo === 'perfeito') {
      this.ultimoEvento = { tipo: 'marca', quando: tempo }
      tocar(this, 'cura')
      somDePapel('brilho')
      this.avisar(tempo, CX, CY - 20, `PERFEITO x${e.multiplicador}!`, { cor: PALETA.rosaEscuro, tamanho: 26 + e.multiplicador * 3, ms: 1400 })
    }
    if (e.tipo === 'quebrou') this.avisar(tempo, CX, CY - 20, 'COMBO QUEBROU', { cor: PALETA.coracao, tamanho: 22, ms: 1400 })
    if (e.tipo === 'energia') this.avisar(tempo, CX, GEMAS.y - 22, `+${e.ganho} ENERGIA`, { cor: 0x0b6a9e, tamanho: 16, ms: 1200 })
    if (e.tipo === 'jogou') {
      tocar(this, 'cartaJogar')
      somDePapel('rabisco')
      if (!this.calmo) brilhar(this, CX, CY, { pai: this.folha, n: 6, raio: 40 })
    }
    if (e.tipo === 'escolheu' && !e.certo) tocar(this, 'erro')
    if (e.tipo === 'erro') somDePapel('folha')
    if (e.tipo === 'opcao') this.atualizarAjuda()
    if (e.tipo === 'passo') {
      definirPref('manual', comPasso(pref('manual'), this.numero, e.indice, e.resultado))
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
    brilhar(this, img.x, SLOT_Y, { pai: this.folha, calmo: this.calmo, n: 5, raio: 22 })
    if (this.calmo) return
    somDePapel('brilho')
    img.setScale(1.8)
    this.tweens.add({ targets: img, scale: 1, duration: 340, ease: 'Back.easeOut' })
  }

  atualizarAjuda() {
    const p = this.pagina
    const ver = p.etapa === 'ajuda'
    this.linhasAjuda.forEach((t, k) => t.setVisible(ver).setColor(k === p.opcao ? TINTA : TINTA_SUAVE).setAlpha(k === p.opcao ? 1 : 0.72))
    this.cursorAjuda.setVisible(ver)
    if (ver) {
      const t = this.linhasAjuda[p.opcao]
      this.cursorAjuda.setPosition(t.x - t.width / 2 - 16, t.y + t.height / 2)
    }
  }

  concluir() {
    definirPref('manual', comPagina(pref('manual'), this.numero))
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
    // a última página não tem para onde virar: A volta ao índice
    if (!this.cfg.proxima) {
      this.pagina.terminouDeVirar()
      return this.sair(true)
    }
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
        // a página seguinte começa do mesmo papel (a capa dela já está na tela): troca de cena sem fade
        this.saindo = true
        this.scene.start(`ManualRalsei${this.cfg.proxima}`, { deVirada: true })
      },
    })
  }
}

const slotX = (n, k) => CX + (k - (n - 1) / 2) * 46

// adesivo redondo de cada passo: papel colorido recortado com o desenho de giz dele
function assarAdesivoDoPasso(scene, id) {
  const R = 16
  const silhueta = elipse(0, 0, R, R, 28)
  return assarAdesivo(scene, `manual-adesivo-passo-${id}`, {
    silhueta,
    borda: 3,
    base: (ctx) => {
      ctx.fillStyle = CORES_ADESIVO[id] ?? '#fff2c8'
      caminho(ctx, silhueta)
      ctx.fill()
    },
    camadas: iconeDoPasso(criarRng(`adesivo:${id}`), id, 11),
    grao: 0.25,
  })
}

