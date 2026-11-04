import Phaser from 'phaser'
import { get } from 'svelte/store'
import Controles from '../controles.js'
import { jogo } from '../../lib/estado.js'
import { criarRng } from '../pvp/baralho.js'
import { SIMBOLOS, nomeDoValor } from '../pvp/cartas.js'
import { ataques } from '../attacks/index.js'
import { tocar, musica } from '../audio.js'
import { LARGURA, ALTURA } from '../constants.js'
import { fatores } from '../acessibilidade.js'
import { menosMovimento, pref, definirPref } from '../preferencias.js'
import { normalizarTeclas } from '../teclas.js'
import { retanguloGiz, circuloGiz } from '../manual/giz.js'
import { PALETA, corCss } from '../manual/cera.js'
import { dicasDeBotoes, teclasDoEixo } from '../manual/botoes.js'
import { criarPagina3, PASSOS3 } from '../manual/pagina3.js'
import { criarPagina4, PASSOS4 } from '../manual/pagina4.js'
import { PASSAR, OPCOES_AJUDA, VIVA_MS, PULAR_VITRINE_MS, ENCHE_RODADA_MS, expressaoDasCartas } from '../manual/licaoDeCartas.js'
import { planoDaVitrine, DESENHO_DA_CARTA, ENERGIA } from '../manual/cartasDoManual.js'
import { normalizarProgresso, comPasso, comPagina } from '../manual/progresso.js'
import { VitrineDeAtaque } from '../manual/vitrineNaTela.js'
import { montarCapaDaPagina5 } from './ManualRalsei5.js'
import { CAIXA_VITRINE } from '../manual/vitrine.js'
import { sublinhado, rabiscosDaMargem, retanguloRedondo, desenhoDaCarta, rabiscoDaGema, rabiscoDoBoneco, iconeDoPasso, rabiscoDoCoracao } from '../manual/ilustracoes.js'
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
  assarPilula,
  imagemDeCera,
  trocarImagem,
  desenharFita,
  Balao,
  RalseiDesenhado,
  Confete,
  brilhar,
  virarFolha,
  somDePapel,
} from '../manual/paginaBase.js'

// O MANUAL DO RALSEI, páginas de CARTAS (docs/manual-ralsei.md). Esta cena serve as duas; a página 4 é
// a cena ManualRalsei4 (o mesmo código com `numero` 4):
//   página 3 "Sua primeira carta"           uma carta = um ataque (manual/pagina3.js)
//   página 4 "Nem toda rodada pede ataque"  energia, custo e PASSAR (manual/pagina4.js)
//
// A mão é de cartas de giz, mas as cartas são as do baralho do Ralsei, e jogar/pagar/bloquear/passar são
// as regras reais (manual/cartasDoManual.js). A carta jogada "ganha vida" e o ATAQUE DE VERDADE dela roda
// na lousa do boneco de treino (manual/vitrine.js: ContextoAtaque + Balas reais, numa câmera só delas).
//
//   ←/→: escolher (cartas e, na página 4, PASSAR) · A: confirmar / continuar / virar · ↑/↓: ajuda
//   (depois de 3 erros) · B: volta ao índice do manual
//
// "Reduzir animações": a carta não voa (fica levantada), o boneco não balança, balão inteiro, sem
// confete, virada em corte. Nenhum clarão. No dev: window.manualRalsei3 / window.manualRalsei4.

// a lousa do boneco (na tela) tem a proporção da caixa do PvP (CAIXA_VITRINE)
const LOUSA = { x: 500, y: 56, largura: 264 }
LOUSA.altura = Math.round((LOUSA.largura * CAIXA_VITRINE.altura) / CAIXA_VITRINE.largura)
const LX = LOUSA.x + LOUSA.largura / 2
const MOLDURA = 9
const BALAO = { x: 64, y: 92, largura: 334, altura: 128, cauda: { de: 112, x: 126, y: 262 }, tamanho: 16 }
const RALSEI = { x: 176, y: 438, escala: 1.12 }
const CARTA = { largura: 74, altura: 98 }
const MAO_Y = 378
const LEVANTA = 13
const GEMAS = { y: LOUSA.y + LOUSA.altura + 22, passo: 19, raio: 7.2 }
const SLOT_Y = 30
const PILULA_Y = MAO_Y - CARTA.altura / 2 - LEVANTA - 12

// o que muda de uma página para a outra
const PAGINAS_CARTAS = {
  3: {
    chave: 'ManualRalsei3',
    titulo: 'Sua primeira carta',
    criar: (passos) => criarPagina3({ passos }),
    passos: PASSOS3,
    espaco: 88,
    gemas: false,
    proxima: 4,
    margem: [
      { tipo: 'estrela', x: 420, y: 52, r: 6, cor: PALETA.amarelo },
      { tipo: 'coracao', x: 818, y: 120, r: 5, cor: PALETA.rosa },
      { tipo: 'estrela', x: 822, y: 214, r: 5, cor: PALETA.azul },
      { tipo: 'pata', x: 812, y: 440, r: 8, giro: -0.4, cor: PALETA.verde },
      { tipo: 'pata', x: 828, y: 410, r: 7, giro: -0.6, cor: PALETA.verde },
      { tipo: 'estrela', x: 336, y: 304, r: 6, cor: PALETA.lavanda },
      { tipo: 'coracao', x: 316, y: 372, r: 5, cor: PALETA.azul },
      { tipo: 'estrela', x: 420, y: 440, r: 5, cor: PALETA.rosa },
      { tipo: 'coracao', x: 70, y: 262, r: 5, cor: PALETA.amarelo },
    ],
  },
  4: {
    chave: 'ManualRalsei4',
    titulo: 'Nem toda rodada pede ataque',
    tamanhoTitulo: 22, // o título comprido não pode chegar na fita da lousa
    criar: (passos) => criarPagina4({ passos }),
    passos: PASSOS4,
    espaco: 84,
    gemas: true,
    proxima: 5,
    margem: [
      { tipo: 'coracao', x: 818, y: 120, r: 5, cor: PALETA.rosa },
      { tipo: 'estrela', x: 822, y: 214, r: 5, cor: PALETA.azul },
      { tipo: 'pata', x: 812, y: 452, r: 7, giro: -0.4, cor: PALETA.verde },
      { tipo: 'estrela', x: 336, y: 304, r: 6, cor: PALETA.lavanda },
      { tipo: 'coracao', x: 316, y: 372, r: 5, cor: PALETA.azul },
      { tipo: 'estrela', x: 404, y: 446, r: 5, cor: PALETA.rosa },
      { tipo: 'coracao', x: 70, y: 262, r: 5, cor: PALETA.amarelo },
    ],
  },
}
const CORES_ADESIVO = { conhecer: '#fff2c8', chuva: '#d8ecff', caro: '#ffe1ea', passar: '#dff4e6', jogar: '#ece4fb' }

// ---------- o fundo de cada página (a capa aparece atrás da folha que vira na página anterior) ----------

function assarFundoDasCartas(scene, n) {
  const cfg = PAGINAS_CARTAS[n]
  const r = (s) => criarRng(`manual:p${n}:${s}`)
  const l = LOUSA
  const largura = assarLetreiro(scene, `manual-p${n}-titulo`, cfg.titulo, { tamanho: cfg.tamanhoTitulo ?? 26 }).largura
  assar(scene, `manual-p${n}-fundo`, LARGURA, ALTURA, {
    camadas: [...rabiscosDaMargem(r('margem'), cfg.margem), { tipo: 'traco', tracos: sublinhado(r('sub'), 66, 76, 66 + Math.min(largura, 420)), cor: n === 3 ? PALETA.amarelo : PALETA.azul, largura: 3.4, passadas: 3 }],
    grao: 0.4,
    fundo: (ctx) => {
      // a lousa: um quadro-negro com moldura de madeira, pendurado no caderno com fita
      ctx.save()
      ctx.shadowColor = 'rgba(70,44,24,0.28)'
      ctx.shadowBlur = 7
      ctx.shadowOffsetY = 3
      ctx.fillStyle = '#a0703f'
      ctx.fillRect(l.x - MOLDURA, l.y - MOLDURA, l.largura + MOLDURA * 2, l.altura + MOLDURA * 2)
      ctx.restore()
      const g = ctx.createLinearGradient(0, l.y, 0, l.y + l.altura)
      g.addColorStop(0, '#26303d')
      g.addColorStop(1, '#1b222c')
      ctx.fillStyle = g
      ctx.fillRect(l.x, l.y, l.largura, l.altura)
      // pó de giz apagado
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      for (let k = 0; k < 7; k++) ctx.fillRect(l.x + 14 + k * 36, l.y + 18 + ((k * 37) % 120), 26, 5)
    },
    frente: (ctx) => {
      desenharFita(ctx, l.x - 10, l.y - 12, 58, 17, -0.62, n === 3 ? PALETA.rosa : PALETA.lavanda)
      desenharFita(ctx, l.x + l.largura + 10, l.y - 12, 58, 17, 0.62, n === 3 ? PALETA.azul : PALETA.amarelo)
    },
  })
  return { rotulo: assarRotulo(scene, `manual-rotulo-p${n}`, `PÁGINA ${n}`), titulo: `manual-p${n}-titulo` }
}

// a moldura de giz da lousa (por cima do fundo assado)
function assarMolduraDaLousa(scene) {
  const l = LOUSA
  const t = retanguloGiz(criarRng('manual:lousa'), l.x - MOLDURA / 2, l.y - MOLDURA / 2, l.largura + MOLDURA, l.altura + MOLDURA, { tremor: 0.9, excesso: 3, tracos: 2 })
  return assarCamadas(scene, 'manual-lousa-moldura', [{ tipo: 'traco', tracos: t, cor: 0x5e3d1e, largura: 3, passadas: 2 }], { grao: 0.4 })
}

// a página como ela abre: papel, fundo, etiqueta, título, o Ralsei (parado) e o boneco
export function montarCapaDasCartas(scene, c, n) {
  const i = assarFundoDasCartas(scene, n)
  c.add(scene.add.image(0, 0, PAPEL.papel).setOrigin(0))
  c.add(scene.add.image(0, 0, `manual-p${n}-fundo`).setOrigin(0))
  c.add(imagemDeCera(scene, 0, 0, assarMolduraDaLousa(scene)))
  c.add(imagemDeCera(scene, 60, 6, i.rotulo))
  c.add(scene.add.image(62, 30, i.titulo).setOrigin(0))
  c.add(imagemDeCera(scene, LX, bonecoY(), assarBoneco(scene)))
  const r = new RalseiDesenhado(scene, RALSEI.x, RALSEI.y, { calmo: true, escala: RALSEI.escala })
  r.setExpressao('animado')
  c.add(r.container)
  c.add(scene.add.text(RALSEI.x, RALSEI.y + 9, 'RALSEI', { fontFamily: FONTE_TEXTO, fontSize: '11px', fontStyle: 'bold', color: TINTA_SUAVE }).setOrigin(0.5, 0))
}

// o boneco fica onde a vitrine mira (ALVO_VITRINE); o desenho tem o peito na origem
const bonecoY = () => LOUSA.y + LOUSA.altura * 0.6
const assarBoneco = (scene) => assarCamadas(scene, 'manual-boneco', rabiscoDoBoneco(criarRng('manual:boneco')).camadas, { grao: 0.3 })

// A instância da cena é REAPROVEITADA pelo Phaser: tudo volta ao inicial no começo do init().
const estadoInicial = () => ({
  numero: 3,
  pagina: null,
  cfg: null,
  controles: null,
  folha: null,
  proxima: null,
  balao: null,
  ralsei: null,
  vitrine: null,
  boneco: null,
  cartas: null,
  pilula: null,
  demo: null,
  gemas: null,
  textoEnergia: null,
  imgSlots: null,
  linhasAjuda: null,
  cursorAjuda: null,
  adesivoFinal: null,
  confete: null,
  dicas: null,
  infos: null,
  energiaVista: null,
  vitrineLigada: false,
  golpeAte: 0,
  dicaAtual: '',
  saindo: false,
  virando: false,
  calmo: false,
  ultimoEvento: null,
  dados: null,
})

export default class ManualRalsei3 extends Phaser.Scene {
  constructor(chave = 'ManualRalsei3') {
    super(chave)
  }

  // dados: { deVirada } (veio da página anterior virando a folha: sem fade) · { recomecar } (ignora o progresso)
  init(dados) {
    Object.assign(this, estadoInicial())
    this.dados = dados ?? {}
    this.numero = this.sys.settings.key === PAGINAS_CARTAS[4].chave ? 4 : 3
    this.cfg = PAGINAS_CARTAS[this.numero]
  }

  create() {
    this.calmo = menosMovimento() || fatores().tremor === 0
    const prog = normalizarProgresso(pref('manual'))[`p${this.numero}`]
    const passos = this.dados.recomecar || prog.completa ? null : prog.passos
    this.pagina = this.cfg.criar(passos)
    this.controles = new Controles(this)
    this.controles.onBotao((j, botao) => (botao === 'A' ? this.apertarA() : this.apertarB()))
    this.controles.onPausa(() => this.apertarB())

    const papel = garantirPapel(this)
    this.add.image(0, 0, papel.mesa).setOrigin(0).setDepth(0)
    this.add.image(0, 0, papel.espiral).setOrigin(0).setDepth(30)
    this.assarTudo()
    this.montarProxima()
    this.montarFolha()
    this.vitrine = new VitrineDeAtaque(this, { tela: LOUSA })

    if (!this.dados.deVirada) this.cameras.main.fadeIn(240)
    const global = `manualRalsei${this.numero}`
    if (import.meta.env.DEV) window[global] = this
    this.events.once('shutdown', () => {
      if (window[global] === this) delete window[global]
      this.confete?.destroy()
      this.vitrine?.destruir()
    })
    this.balao.dizer(this.pagina.fala)
    this.atualizarDicas()
    musica('tutorial2', 'tutorial')
  }

  // ---------- texturas (assadas uma vez; sementes fixas) ----------

  assarTudo() {
    const n = this.numero
    const r = (s) => criarRng(`manual:p${n}:${s}`)
    const fundo = assarFundoDasCartas(this, n)
    const cartas = {}
    for (const carta of this.pagina.mesa.cartas) {
      cartas[carta.id] = { normal: assarCartaDeGiz(this, carta, false), bloqueada: assarCartaDeGiz(this, carta, true) }
    }
    if (this.pagina.slots.includes(PASSAR)) cartas[PASSAR] = { normal: assarCartaPassar(this), bloqueada: assarCartaPassar(this) }
    const verde = rabiscoDoCoracao(r('demo'), 22, { cor: PALETA.verde, escura: PALETA.verdeEscuro })
    this.infos = {
      ...fundo,
      moldura: assarMolduraDaLousa(this),
      boneco: assarBoneco(this),
      cartas,
      brilhoCarta: assarBrilhoDaCarta(this),
      demo: assarCamadas(this, 'manual-cartas-demo', verde.camadas, { grao: 0.25 }),
      cursor: assarCamadas(this, 'manual-cartas-cursor', rabiscoDoCoracao(r('cursor'), 18).camadas, { grao: 0.25 }),
      gemaCheia: assarCamadas(this, 'manual-gema-cheia', rabiscoDaGema(r('gema'), GEMAS.raio).camadas, { grao: 0.2 }),
      gemaVazia: assarCamadas(this, 'manual-gema-vazia', rabiscoDaGema(r('gema-v'), GEMAS.raio, { estado: 'vazia' }).camadas, { grao: 0.2 }),
      slotVazio: assarCamadas(this, 'manual-p3-slot', [{ tipo: 'traco', tracos: circuloGiz(r('slot'), 0, 0, 16, { tremor: 0.9, tracos: 1 }), cor: 0x9a8fb8, largura: 2.2, passadas: 2, alpha: 0.8 }], { grao: 0.35 }),
      adesivos: this.cfg.passos.map((ps) => assarAdesivoDoPasso(this, ps.id)),
      final: assarEstrelaDourada(this, `manual-adesivo-final-p${n}`, 92, { texto: `PÁGINA ${n}`, subtexto: '✓', giro: 0.12 }),
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
    add(imagemDeCera(this, 0, 0, i.moldura))
    add(imagemDeCera(this, 60, 6, i.rotulo))
    add(this.add.image(62, 30, i.titulo).setOrigin(0))

    this.ralsei = new RalseiDesenhado(this, RALSEI.x, RALSEI.y, { calmo: this.calmo, escala: RALSEI.escala })
    add(this.ralsei.container)
    add(this.texto(RALSEI.x, RALSEI.y + 9, 'RALSEI', 11, { fontStyle: 'bold', color: TINTA_SUAVE }).setOrigin(0.5, 0))
    this.balao = new Balao(this, { ...BALAO, chave: 'manual-cartas-balao', calmo: this.calmo })
    add(...this.balao.objetos)

    this.boneco = add(imagemDeCera(this, LX, bonecoY(), i.boneco))
    this.imgSlots = this.cfg.passos.map((_, k) => add(imagemDeCera(this, slotX(this.cfg.passos.length, k), SLOT_Y, i.slotVazio)))
    p.resultados.forEach((res, k) => res === 'feita' && trocarImagem(this.imgSlots[k], i.adesivos[k]))

    if (this.cfg.gemas) {
      const x0 = LX - ((ENERGIA.maxima - 1) * GEMAS.passo) / 2
      this.gemas = Array.from({ length: ENERGIA.maxima }, (_, k) => add(imagemDeCera(this, x0 + k * GEMAS.passo, GEMAS.y, i.gemaVazia)))
      add(this.texto(x0 - 16, GEMAS.y, 'energia', 12, { fontStyle: 'bold', color: TINTA_SUAVE }).setOrigin(1, 0.5))
      this.textoEnergia = add(this.texto(x0 + (ENERGIA.maxima - 1) * GEMAS.passo + 16, GEMAS.y, '', 16, { fontStyle: 'bold', color: corCss(0x0b6a9e) }).setOrigin(0, 0.5))
    }

    // a mão: cada slot é um container (brilho de seleção + carta) para levantar/voar junto
    this.cartas = p.slots.map((id, k) => {
      const c = add(this.add.container(this.xDoSlot(k), MAO_Y))
      const brilho = this.add.image(0, 0, i.brilhoCarta).setVisible(false)
      const img = this.add.image(0, 0, i.cartas[id].normal)
      c.add([brilho, img])
      return { id, c, brilho, img, bloqueada: null }
    })
    this.demo = add(imagemDeCera(this, 0, 0, i.demo).setVisible(false))
    this.pilula = add(this.add.image(0, PILULA_Y, '__DEFAULT').setVisible(false))
    // a ajuda depois de 3 erros (um coraçãozinho de giz marca a opção)
    this.linhasAjuda = OPCOES_AJUDA.map((o, k) => add(this.texto(LX, MAO_Y - 40 + k * 30, o, 17, { fontStyle: 'bold' }).setOrigin(0.5, 0).setVisible(false)))
    this.cursorAjuda = add(imagemDeCera(this, 0, 0, i.cursor).setVisible(false))
    this.adesivoFinal = add(imagemDeCera(this, LX, LOUSA.y + LOUSA.altura / 2 + 4, i.final).setVisible(false))
    this.dicas = add(this.texto(LARGURA / 2 + 40, ALTURA - 24, '', 14, { color: TINTA_SUAVE, fontStyle: 'bold' }).setOrigin(0.5))
    this.atualizarMao(0)
    this.atualizarEnergia(false)
  }

  xDoSlot(k) {
    const n = this.pagina.slots.length
    return LX + (k - (n - 1) / 2) * this.cfg.espaco
  }

  // atrás da folha: a próxima página como ela abre (a 4, ou a 5: a partida de verdade)
  montarProxima() {
    const c = (this.proxima = this.add.container(0, 0).setDepth(10).setVisible(false))
    if (this.cfg.proxima === 4) montarCapaDasCartas(this, c, 4)
    else montarCapaDaPagina5(this, c)
  }

  // ---------- desenho ----------

  // a mão: seleção, cartas bloqueadas (a regra real), a carta que ganha vida, a pílula e a demonstração
  atualizarMao(tempo) {
    const p = this.pagina
    const i = this.infos
    const ajuda = p.etapa === 'ajuda'
    const escolhendo = p.etapa === 'escolher'
    const jogada = p.etapa === 'atacando' ? p.jogada : null
    const fimDaPagina = ['concluida', 'virando', 'fim'].includes(p.etapa)
    this.cartas.forEach((s, k) => {
      const bloqueio = p.bloqueioDe(k)
      const chave = i.cartas[s.id][bloqueio ? 'bloqueada' : 'normal']
      if (s.img.texture.key !== chave) s.img.setTexture(chave)
      const sel = k === p.cursor && !fimDaPagina
      const x = this.xDoSlot(k)
      let y = MAO_Y - (sel ? LEVANTA : 0)
      let escala = sel ? 1.06 : 1
      let alpha = ajuda ? 0 : fimDaPagina ? 0.18 : 1 // na ajuda as opções ficam no lugar da mão
      if (jogada && jogada.slot === k) {
        // a carta "ganha vida": sobe até a lousa, cresce e mergulha nela quando o ataque começa
        const f = p.vivaFase
        if (this.calmo) {
          alpha = p.tempoEtapa < VIVA_MS ? 1 : 0.35
        } else {
          const subida = Math.min(1, f / 0.6)
          const e = 1 - (1 - subida) ** 3
          const alvoY = LOUSA.y + 40
          y = y + (alvoY - y) * e + Math.sin(tempo / 90) * 3 * e * (f < 1 ? 1 : 0)
          escala = escala + 0.22 * e
          if (f >= 0.6) escala *= 1 - Math.min(1, (f - 0.6) / 0.4) * 0.55
          if (p.tempoEtapa >= VIVA_MS) alpha = Math.max(0, 1 - (p.tempoEtapa - VIVA_MS) / 220)
          s.c.setPosition(x + (LX - x) * e, y)
          s.c.setScale(escala).setAlpha(alpha)
          s.brilho.setVisible(true)
          return
        }
      }
      s.c.setPosition(x, y).setScale(escala).setAlpha(alpha)
      s.brilho.setVisible(sel && (escolhendo || p.etapa === 'errou' || p.etapa === 'acertou'))
    })
    // a pílula do bloqueio: a da carta negada agora, ou a da carta sob o cursor (como na arena)
    let b = null
    if (p.bloqueio && (p.etapa === 'errou' || p.etapa === 'acertou')) b = p.bloqueio
    else if (escolhendo) {
      const bl = p.bloqueioDe(p.cursor)
      if (bl) b = { slot: p.cursor, ...bl }
    }
    this.pilula.setVisible(Boolean(b))
    if (b) {
      const info = assarPilula(this, `× ${b.curto}`)
      if (this.pilula.texture.key !== info.chave) this.pilula.setTexture(info.chave).setOrigin(-info.minX / info.w, -info.minY / info.h)
      this.pilula.setPosition(this.xDoSlot(b.slot), PILULA_Y)
    }
    // o coraçãozinho verde do Ralsei mostrando a escolha certa
    const d = p.demoCursor
    this.demo.setVisible(p.etapa === 'demo' && d !== null)
    if (d !== null) {
      const pulo = this.calmo ? 0 : Math.abs(Math.sin(tempo / 160)) * 6
      this.demo.setPosition(LX + (d - (p.slots.length - 1) / 2) * this.cfg.espaco, MAO_Y - CARTA.altura / 2 - LEVANTA - 10 - pulo)
    }
  }

  // as gemas: a energia de verdade (as novas brilham)
  atualizarEnergia(animar = true) {
    if (!this.gemas) return
    const e = this.pagina.energiaNaTela
    if (e === this.energiaVista) return
    const antes = this.energiaVista ?? e
    this.energiaVista = e
    this.gemas.forEach((g, k) => trocarImagem(g, k < e ? this.infos.gemaCheia : this.infos.gemaVazia))
    this.textoEnergia.setText(String(e))
    if (!animar || e === antes) return
    if (e > antes) {
      tocar(this, 'graze')
      for (let k = antes; k < e; k++) brilhar(this, this.gemas[k].x, this.gemas[k].y, { pai: this.folha, calmo: this.calmo, n: 4, raio: 14 })
    } else tocar(this, 'cartaJogar')
  }

  // ---------- dicas ----------

  atualizarDicas() {
    const d = dicasDeBotoes(get(jogo).fonte, normalizarTeclas(pref('teclas')))
    const p = this.pagina
    const sair = `${d.B}: sair`
    const linha =
      {
        intro: `${d.A}: continuar      ${sair}`,
        escolher: `${teclasDoEixo(d)}: escolher      ${d.A}: confirmar      ${sair}`,
        atacando: p.tempoEtapa >= PULAR_VITRINE_MS ? `${d.A}: continuar      ${sair}` : sair,
        enchendo: p.tempoEtapa >= ENCHE_RODADA_MS ? `${d.A}: continuar      ${sair}` : sair,
        errou: `${d.A}: tentar já      ${sair}`,
        ajuda: `${teclasDoEixo(d, 'vertical')}: escolher      ${d.A}: confirmar      ${sair}`,
        demo: `${d.A}: pular a demonstração      ${sair}`,
        acertou: `${d.A}: continuar      ${sair}`,
        concluida: `${d.A}: virar a página      ${sair}`,
        fim: `${d.A}: voltar ao índice      ${sair}`,
      }[p.etapa] ?? sair
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
    this.vitrine.parar()
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
      p.tick(delta)
    }
    this.balao.update(tempo, delta, ['intro', 'errou', 'acertou', 'concluida'].includes(p.etapa))
    for (const e of p.drenar()) this.aoEvento(e, tempo)

    // a vitrine: o ataque real começa quando a carta mergulha na lousa e para quando a etapa acaba
    if (p.etapa === 'atacando' && p.tempoEtapa >= VIVA_MS && !this.vitrineLigada && p.jogada) {
      this.vitrineLigada = true
      this.vitrine.rodar(planoDaVitrine(p.jogada.caixa, ataques))
      somDePapel('brilho')
    } else if (p.etapa !== 'atacando' && this.vitrineLigada) {
      this.vitrineLigada = false
      this.vitrine.parar()
    }
    this.vitrine.atualizar(this.virando ? 0 : delta)
    // o boneco balança quando uma bala passa por ele (é de mentirinha: ninguém toma dano)
    if (this.vitrineLigada && this.vitrine.motor.tocando()) this.golpeAte = tempo + 240
    const balanca = !this.calmo && tempo < this.golpeAte
    this.boneco.setPosition(LX + (balanca ? Math.sin(tempo / 28) * 2.5 : 0), bonecoY() + (balanca ? 1 : 0))

    const u = this.ultimoEvento
    this.ralsei.setExpressao(expressaoDasCartas(p.etapa, u && { tipo: u.tipo, ha: tempo - u.quando }))
    this.ralsei.update(tempo)
    this.atualizarMao(tempo)
    this.atualizarEnergia()
    if (this.confete && !this.confete.update(delta)) this.confete = null
    this.atualizarAjuda()
    this.atualizarDicas()
  }

  aoEvento(e, tempo) {
    const p = this.pagina
    if (e.tipo === 'fala') this.balao.dizer(p.fala)
    if (e.tipo === 'etapa') {
      this.balao.dizer(p.fala)
      if (e.etapa === 'concluida') this.concluir()
      if (e.etapa === 'virando') this.virarPagina()
    }
    if (e.tipo === 'jogou') {
      this.folha.bringToTop(this.cartas[e.slot].c) // a carta que voa passa por cima das outras
      tocar(this, 'cartaJogar')
      somDePapel('rabisco')
      if (!this.calmo) brilhar(this, this.xDoSlot(e.slot), MAO_Y - 20, { pai: this.folha, n: 6, raio: 30 })
    }
    if (e.tipo === 'passou') tocar(this, 'passar')
    if (e.tipo === 'negada') {
      tocar(this, 'erro')
      const s = this.cartas[e.slot]
      if (!this.calmo) {
        const x = s.c.x
        this.tweens.add({ targets: s.c, x: { from: x - 4, to: x }, duration: 50, repeat: 3, yoyo: true })
      }
    }
    if (e.tipo === 'erro') somDePapel('folha')
    if (e.tipo === 'passo') {
      definirPref('manual', comPasso(pref('manual'), this.numero, e.indice, e.resultado))
      if (e.resultado === 'feita') this.colarAdesivo(e.indice, tempo)
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
    this.linhasAjuda.forEach((t, k) => t.setVisible(ver).setColor(k === p.opcao ? TINTA : TINTA_SUAVE).setAlpha(k === p.opcao ? 1 : 0.75))
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
    this.virando = true
    this.vitrine.parar()
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
        this.scene.start(this.cfg.proxima === 4 ? 'ManualRalsei4' : 'ManualRalsei5', { deVirada: true })
      },
    })
  }
}

// os adesivos dos passos ficam em cima da lousa, entre as duas fitas
const slotX = (n, k) => LX + (k - (n - 1) / 2) * 42

// ---------- texturas das cartas de giz ----------

// A carta de giz: o papel da carta, o valor e o naipe no canto (como a carta do jogo), o desenho do
// ataque no meio, o nome embaixo e a gema do custo no canto de baixo (vermelha com × quando bloqueada).
function assarCartaDeGiz(scene, carta, bloqueada) {
  const chave = `manual-carta:${carta.id}:${bloqueada ? 'b' : 'n'}`
  if (scene.textures.exists(chave)) return chave
  const { largura: w, altura: h } = CARTA
  const rng = criarRng(`manual:carta:${carta.id}`)
  const corpo = retanguloRedondo(-w / 2, -h / 2, w, h, 8)
  const vermelho = carta.naipe === 'copas' || carta.naipe === 'ouros'
  const tinta = vermelho ? 0xc81e3c : PALETA.tinta
  const gema = { x: -w / 2 + 12, y: h / 2 - 11 }
  const camadas = [
    { tipo: 'traco', tracos: [[...corpo, corpo[0], corpo[1]]], cor: carta.valor === 14 ? PALETA.ouro : PALETA.tinta, largura: 2.4, passadas: 2 },
    ...desenhoDaCarta(rng, DESENHO_DA_CARTA[carta.id], 19).map((c) => deslocar(c, 4, -10)),
    ...rabiscoDaGema(rng, 9, { ...gema, estado: bloqueada ? 'bloqueada' : 'cheia' }).camadas,
  ]
  const pad = 6
  assar(scene, chave, w + pad * 2, h + pad * 2, {
    camadas,
    ox: w / 2 + pad,
    oy: h / 2 + pad,
    grao: 0.3,
    fundo: (ctx) => {
      ctx.save()
      ctx.translate(w / 2 + pad, h / 2 + pad)
      ctx.shadowColor = 'rgba(60,36,20,0.28)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetY = 2
      ctx.fillStyle = carta.valor === 14 ? '#fff6d8' : '#fffcf4'
      caminho(ctx, corpo)
      ctx.fill()
      ctx.restore()
    },
    frente: (ctx) => {
      ctx.save()
      ctx.translate(w / 2 + pad, h / 2 + pad)
      ctx.fillStyle = corCss(tinta)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `bold 13px ${FONTE_TEXTO}`
      ctx.fillText(nomeDoValor(carta.valor), -w / 2 + 11, -h / 2 + 12)
      ctx.font = `bold 12px ${FONTE_TEXTO}`
      ctx.fillText(SIMBOLOS[carta.naipe], -w / 2 + 11, -h / 2 + 26)
      // o nome, em até 2 linhas
      ctx.fillStyle = TINTA
      ctx.font = `bold 9.5px ${FONTE_TEXTO}`
      const linhas = quebrar(ctx, carta.nome, w - 12)
      linhas.forEach((l, k) => ctx.fillText(l, 3, h / 2 - 37 + k * 11 + (linhas.length === 1 ? 5 : 0)))
      // o custo na gema
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = bloqueada ? '#3a0a14' : '#06283e'
      ctx.lineWidth = 2.5
      ctx.font = `bold 11px ${FONTE_TEXTO}`
      ctx.strokeText(String(carta.custo), gema.x, gema.y + 0.5)
      ctx.fillText(String(carta.custo), gema.x, gema.y + 0.5)
      if (bloqueada) {
        // o véu de carta indisponível e o selo "×" na gema (como Carta.desenharMarcaCusto)
        ctx.fillStyle = 'rgba(70,60,80,0.38)'
        caminho(ctx, corpo)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(gema.x + 7, gema.y - 7, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#c81e3c'
        ctx.beginPath()
        ctx.arc(gema.x + 7, gema.y - 7, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(gema.x + 5.2, gema.y - 8.8)
        ctx.lineTo(gema.x + 8.8, gema.y - 5.2)
        ctx.moveTo(gema.x + 5.2, gema.y - 5.2)
        ctx.lineTo(gema.x + 8.8, gema.y - 8.8)
        ctx.stroke()
      }
      ctx.restore()
    },
  })
  return chave
}

// o "slot" PASSAR no fim da mão (o botão da arena: PASSAR e +1 com a gema)
function assarCartaPassar(scene) {
  const chave = 'manual-carta:passar'
  if (scene.textures.exists(chave)) return chave
  const { largura: w, altura: h } = CARTA
  const rng = criarRng('manual:carta:passar')
  const corpo = retanguloRedondo(-w / 2, -h / 2, w, h, 8)
  const pad = 6
  assar(scene, chave, w + pad * 2, h + pad * 2, {
    camadas: [{ tipo: 'traco', tracos: [[...corpo, corpo[0], corpo[1]]], cor: PALETA.verdeEscuro, largura: 2.4, passadas: 2 }, ...desenhoDaCarta(rng, 'passar', 20).map((c) => deslocar(c, 0, 2))],
    ox: w / 2 + pad,
    oy: h / 2 + pad,
    grao: 0.3,
    fundo: (ctx) => {
      ctx.save()
      ctx.translate(w / 2 + pad, h / 2 + pad)
      ctx.shadowColor = 'rgba(60,36,20,0.28)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetY = 2
      ctx.fillStyle = '#eef8ef'
      caminho(ctx, corpo)
      ctx.fill()
      ctx.restore()
    },
    frente: (ctx) => {
      ctx.save()
      ctx.translate(w / 2 + pad, h / 2 + pad)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = corCss(PALETA.verdeEscuro)
      ctx.font = `bold 13px ${FONTE_TEXTO}`
      ctx.fillText('PASSAR', 0, -h / 2 + 16)
      ctx.fillStyle = '#0b6a9e'
      ctx.font = `bold 13px ${FONTE_TEXTO}`
      ctx.fillText(`+${ENERGIA.passar}`, 14, h / 2 - 14)
      ctx.restore()
    },
  })
  return chave
}

// o brilho amarelo de giz em volta da carta selecionada
function assarBrilhoDaCarta(scene) {
  const chave = 'manual-carta-brilho'
  if (scene.textures.exists(chave)) return chave
  const { largura: w, altura: h } = CARTA
  const pad = 12
  const contorno = retanguloRedondo(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 11)
  assar(scene, chave, w + pad * 2, h + pad * 2, {
    camadas: [{ tipo: 'traco', tracos: [[...contorno, contorno[0], contorno[1]]], cor: PALETA.amarelo, largura: 5, passadas: 3 }],
    ox: w / 2 + pad,
    oy: h / 2 + pad,
    grao: 0.35,
  })
  return chave
}

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

function caminho(ctx, poli) {
  ctx.beginPath()
  poli.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)))
  ctx.closePath()
}

// uma camada de cera movida de (dx, dy)
function deslocar(camada, dx, dy) {
  const m = (q) => ({ x: q.x + dx, y: q.y + dy })
  const c = { ...camada }
  if (c.tracos) c.tracos = c.tracos.map((t) => t.map(m))
  if (c.poligono) c.poligono = c.poligono.map(m)
  return c
}

// quebra o texto em linhas que cabem em `largura` (no máximo 2)
function quebrar(ctx, texto, largura) {
  const palavras = texto.split(' ')
  const linhas = ['']
  for (const p of palavras) {
    const tentativa = linhas[linhas.length - 1] ? `${linhas[linhas.length - 1]} ${p}` : p
    if (ctx.measureText(tentativa).width <= largura || !linhas[linhas.length - 1]) linhas[linhas.length - 1] = tentativa
    else linhas.push(p)
  }
  return linhas.slice(0, 2)
}

