import Phaser from 'phaser'
import { get } from 'svelte/store'
import Controles from '../controles.js'
import { jogo } from '../../lib/estado.js'
import { criarRng } from '../pvp/baralho.js'
import { tocar, musica } from '../audio.js'
import { irCarregando } from '../carregando.js'
import { LARGURA, ALTURA, CORES } from '../constants.js'
import { PERSONAGENS } from '../data/personagens.js'
import { ARENA } from '../pvp/arenas.js'
import { fatores } from '../acessibilidade.js'
import { menosMovimento, pref, definirPref } from '../preferencias.js'
import { normalizarTeclas } from '../teclas.js'
import { PALETA } from '../manual/cera.js'
import { dicasDeBotoes, teclasDoEixo } from '../manual/botoes.js'
import { criarPagina5, expressaoDaPagina5, OPCOES_E_AGORA, FALA_E_AGORA, ENCHER_MS, DESCOLAR_MS, VOLTAR_MS } from '../manual/pagina5.js'
import { comPagina5 } from '../manual/progresso.js'
import { PARTIDA_DO_MANUAL, dadosDaPartida } from '../manual/partidaDoManual.js'
import { sublinhado, rabiscosDaMargem, rabiscoDaArena, rabiscoDoCoracao } from '../manual/ilustracoes.js'
import { LAYOUT_PVP } from './PvpArena.js'
import { CHAVE_PARTIDA } from './ManualRalsei5Partida.js'
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
  assarRotulo,
  imagemDeCera,
  desenharFita,
  Balao,
  RalseiDesenhado,
  Confete,
  brilhar,
  virarFolha,
  somDePapel,
} from '../manual/paginaBase.js'

// O MANUAL DO RALSEI, página 5: "Uma partida de verdade" (docs/manual-ralsei.md). O caderno em volta da
// partida (a máquina é manual/pagina5.js; a partida é scenes/ManualRalsei5Partida.js):
//   antes   o Ralsei fala; no cartão, a arena do PvP desenhada a giz, no MESMO lugar da arena de verdade.
//           Depois o desenho cresce até o tamanho da tela e ganha cor, a arena real começa a carregar por
//           baixo, e a folha descola (vira contra a espiral) mostrando a arena de verdade onde o desenho
//           estava. Daí esta cena sai e a partida começa.
//   depois  a arena relança esta cena com { resultado }: a folha volta por cima da arena, o Ralsei
//           comemora (ganhando ou perdendo), o adesivo dourado "MANUAL ESSENCIAL ✓" (salvo na hora) e a
//           folha vira para a página "e agora?": JOGAR CONTRA A CPU · ONLINE · CARTAS E ARENAS · VOLTAR AO ÍNDICE.
//   A: continuar / ir · ↑/↓: escolher (no "e agora?") · B: volta ao índice do manual
// "Reduzir animações": sem crescer, colorir, descolar e voltar (corte), balão inteiro, sem confete.
// No dev: window.manualRalsei5.

const { PISTA, CENTROS, MAOS, PASSAR } = LAYOUT_PVP
const BALAO = { x: 64, y: 92, largura: 334, altura: 128, cauda: { de: 112, x: 126, y: 262 }, tamanho: 16 }
const RALSEI = { x: 176, y: 438, escala: 1.12 }
const CARTAO = { x: 448, y: 112, escala: 0.43 } // o desenho da arena, pequenininho, no cartão
const CARTAO_LARGURA = Math.round(LARGURA * CARTAO.escala)
const CARTAO_ALTURA = Math.round(ALTURA * CARTAO.escala)
const ADESIVO = { x: 632, y: 222, raio: 104 }
const CRESCER = 0.4 // fração do "enchendo" em que o desenho cresce (o resto é a cor entrando)
const OPCOES_Y = 172
const OPCOES_PASSO = 48
const OPCOES_AGORA_FIM = OPCOES_E_AGORA.length * OPCOES_PASSO - 4 // a dica da opção, embaixo da lista

const ease = (t) => 1 - (1 - t) ** 3
const entre = (a, b, t) => a + (b - a) * t

// ---------- texturas (assadas uma vez; sementes fixas) ----------

// a arena desenhada: as posições são as da PvpArena (LAYOUT_PVP e o HudPvp), na tela inteira
function layoutDaArena() {
  const cor = (id) => PERSONAGENS[id]?.cor ?? 0xffffff
  const gemas = (x0, s) => Array.from({ length: 10 }, (_, i) => ({ x: x0 + s * (5 + i * 12), y: 52 }))
  return {
    moldura: { x: 6, y: 66, largura: LARGURA - 12, altura: ALTURA - 72, cor: ARENA[PARTIDA_DO_MANUAL.arena]?.moldura?.cor ?? 0x2f6a3e },
    caixas: [0, 1].map((j) => ({ x: CENTROS[j] - PISTA.largura / 2, y: PISTA.y - PISTA.altura / 2, largura: PISTA.largura, altura: PISTA.altura, cor: CORES.almas[j] })),
    barras: [
      { x: 14, y: 28, largura: 176, altura: 10, cor: cor(PARTIDA_DO_MANUAL.p1) },
      { x: LARGURA - 14 - 176, y: 28, largura: 176, altura: 10, cor: cor(PARTIDA_DO_MANUAL.p2) },
    ],
    gemas: [gemas(14, 1), gemas(LARGURA - 14, -1)],
    maos: MAOS.map((m) => ({ x: m.x, y: m.y })),
    passar: PASSAR.map((p) => ({ x: p.x, y: p.y })),
    // o fundo do jardim (backgrounds/arenas/): o céu do pôr do sol, o morro e o canteiro
    paisagem: { ceu: [0x3a2458, 0x6a3468, 0xa8506a, 0xe0805a], horizonte: 330, morro: 0x2f5a34, terra: 0x5a3828, flores: [0xf07aa0, 0xf5c02a, 0xffffff, 0x8ab8ff, 0xd04040] },
  }
}

function assarArenaDeGiz(scene) {
  const { contorno, cor } = rabiscoDaArena(criarRng('manual:p5:arena'), layoutDaArena())
  const nomes = (ctx) => {
    ctx.font = `bold 15px ${FONTE_TEXTO}`
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.fillText('VOCÊ', 14, 6)
    ctx.textAlign = 'right'
    ctx.fillText('RALSEI', LARGURA - 14, 6)
  }
  assar(scene, 'manual-p5-arena-cor', LARGURA, ALTURA, { camadas: cor, grao: 0.35, frente: nomes })
  assar(scene, 'manual-p5-arena-giz', LARGURA, ALTURA, { camadas: contorno, grao: 0.3 })
  return { cor: 'manual-p5-arena-cor', giz: 'manual-p5-arena-giz' }
}

function assarFundoDaPagina5(scene) {
  const r = (s) => criarRng(`manual:p5:${s}`)
  const largura = assarLetreiro(scene, 'manual-p5-titulo', 'Uma partida de verdade', { tamanho: 26 }).largura
  assar(scene, 'manual-p5-fundo', LARGURA, ALTURA, {
    camadas: [
      ...rabiscosDaMargem(r('margem'), [
        { tipo: 'estrela', x: 420, y: 52, r: 6, cor: PALETA.amarelo },
        { tipo: 'coracao', x: 470, y: 392, r: 6, cor: PALETA.rosa },
        { tipo: 'estrela', x: 560, y: 408, r: 5, cor: PALETA.azul },
        { tipo: 'nuvem', x: 700, y: 400 },
        { tipo: 'pata', x: 812, y: 440, r: 8, giro: -0.4, cor: PALETA.verde },
        { tipo: 'pata', x: 828, y: 410, r: 7, giro: -0.6, cor: PALETA.verde },
        { tipo: 'estrela', x: 336, y: 304, r: 6, cor: PALETA.lavanda },
        { tipo: 'coracao', x: 70, y: 262, r: 5, cor: PALETA.amarelo },
      ]),
      { tipo: 'traco', tracos: sublinhado(r('sub'), 66, 76, 66 + Math.min(largura, 420)), cor: PALETA.rosa, largura: 3.4, passadas: 3 },
    ],
    grao: 0.4,
  })
  // o cartão do desenho (papel branquinho com fita), que some quando o desenho cresce
  assar(scene, 'manual-p5-cartao', LARGURA, ALTURA, {
    fundo: (ctx) => {
      ctx.save()
      ctx.shadowColor = 'rgba(70,44,24,0.25)'
      ctx.shadowBlur = 7
      ctx.shadowOffsetY = 3
      ctx.fillStyle = '#fffdf6'
      ctx.fillRect(CARTAO.x - 8, CARTAO.y - 8, CARTAO_LARGURA + 16, CARTAO_ALTURA + 16)
      ctx.restore()
    },
    frente: (ctx) => {
      desenharFita(ctx, CARTAO.x - 4, CARTAO.y - 10, 54, 16, -0.6, PALETA.verde)
      desenharFita(ctx, CARTAO.x + CARTAO_LARGURA + 4, CARTAO.y - 10, 54, 16, 0.6, PALETA.amarelo)
      ctx.font = `bold 13px ${FONTE_TEXTO}`
      ctx.fillStyle = TINTA_SUAVE
      ctx.textAlign = 'center'
      ctx.fillText('a arena de verdade é assim:', CARTAO.x + CARTAO_LARGURA / 2, CARTAO.y + CARTAO_ALTURA + 30)
    },
  })
  return { rotulo: assarRotulo(scene, 'manual-rotulo-p5', 'PÁGINA 5'), titulo: 'manual-p5-titulo' }
}

function assarEAgora(scene) {
  const r = (s) => criarRng(`manual:p5e:${s}`)
  const largura = assarLetreiro(scene, 'manual-p5-eagora', 'E agora?', { tamanho: 30 }).largura
  assar(scene, 'manual-p5-eagora-fundo', LARGURA, ALTURA, {
    camadas: [
      ...rabiscosDaMargem(r('margem'), [
        { tipo: 'sol', x: 760, y: 120, r: 22 },
        { tipo: 'nuvem', x: 670, y: 128 },
        { tipo: 'coracao', x: 320, y: 120, r: 8, cor: PALETA.rosa },
        { tipo: 'estrela', x: 800, y: 300, r: 7, cor: PALETA.lavanda },
        { tipo: 'pata', x: 790, y: 420, r: 8, giro: -0.3, cor: PALETA.verde },
        { tipo: 'pata', x: 816, y: 392, r: 8, giro: -0.4, cor: PALETA.verde },
      ]),
      { tipo: 'traco', tracos: sublinhado(r('sub'), 66, 80, 66 + largura), cor: PALETA.verde, largura: 3.4, passadas: 3 },
    ],
    grao: 0.4,
  })
  return { titulo: 'manual-p5-eagora' }
}

const assarAdesivoEssencial = (scene, raio = ADESIVO.raio) =>
  assarEstrelaDourada(scene, `manual-adesivo-essencial-${raio}`, raio, { sobretexto: 'MANUAL', texto: 'ESSENCIAL', subtexto: '✓', giro: -0.08 })

// o desenho da arena num container (o contorno de giz e a cor por cima), já no lugar do cartão
function montarDesenho(scene, c, chaves) {
  const desenho = scene.add.container(CARTAO.x, CARTAO.y).setScale(CARTAO.escala)
  const cor = scene.add.image(0, 0, chaves.cor).setOrigin(0).setAlpha(0)
  const giz = scene.add.image(0, 0, chaves.giz).setOrigin(0)
  desenho.add([cor, giz])
  c.add(desenho)
  return { desenho, cor, giz }
}

// a página como ela abre (é a capa que aparece atrás da folha que vira na página 4)
export function montarCapaDaPagina5(scene, c) {
  const i = assarFundoDaPagina5(scene)
  const arena = assarArenaDeGiz(scene)
  c.add(scene.add.image(0, 0, PAPEL.papel).setOrigin(0))
  c.add(scene.add.image(0, 0, 'manual-p5-fundo').setOrigin(0))
  c.add(scene.add.image(0, 0, 'manual-p5-cartao').setOrigin(0))
  montarDesenho(scene, c, arena)
  c.add(imagemDeCera(scene, 60, 6, i.rotulo))
  c.add(scene.add.image(62, 30, i.titulo).setOrigin(0))
  const r = new RalseiDesenhado(scene, RALSEI.x, RALSEI.y, { calmo: true, escala: RALSEI.escala })
  r.setExpressao('animado')
  c.add(r.container)
  c.add(scene.add.text(RALSEI.x, RALSEI.y + 9, 'RALSEI', { fontFamily: FONTE_TEXTO, fontSize: '11px', fontStyle: 'bold', color: TINTA_SUAVE }).setOrigin(0.5, 0))
}

// A instância da cena é REAPROVEITADA pelo Phaser: tudo volta ao inicial no começo do init().
const estadoInicial = () => ({
  pagina: null,
  controles: null,
  mesa: null,
  espiral: null,
  folha: null,
  proxima: null,
  balao: null,
  ralsei: null,
  nomeRalsei: null,
  titulo: null,
  rotulo: null,
  cartao: null,
  desenho: null,
  adesivo: null,
  confete: null,
  dicas: null,
  proxDicas: null,
  linhasE: null,
  cursorE: null,
  dicaE: null,
  ralseiE: null,
  dicaAtual: '',
  saindo: false,
  virando: false,
  descolando: false,
  calmo: false,
  dados: null,
})

export default class ManualRalsei5 extends Phaser.Scene {
  constructor() {
    super('ManualRalsei5')
  }

  // dados: { deVirada } (veio da página 4 virando a folha: sem fade) · { resultado: { vencedor } } (a
  // partida acabou: a arena está por baixo e a folha volta por cima dela)
  init(dados) {
    Object.assign(this, estadoInicial())
    this.dados = dados ?? {}
  }

  create() {
    this.calmo = menosMovimento() || fatores().tremor === 0
    const resultado = this.dados.resultado ?? null
    this.pagina = criarPagina5({ resultado, calmo: this.calmo })
    this.controles = new Controles(this)
    this.controles.onBotao((j, botao) => (botao === 'A' ? this.apertarA() : this.apertarB()))
    this.controles.onPausa(() => this.apertarB())

    const papel = garantirPapel(this)
    this.mesa = this.add.image(0, 0, papel.mesa).setOrigin(0).setDepth(0)
    this.espiral = this.add.image(0, 0, papel.espiral).setOrigin(0).setDepth(30)
    this.montarProxima()
    this.montarFolha()

    if (import.meta.env.DEV) window.manualRalsei5 = this
    this.events.once('shutdown', () => {
      if (window.manualRalsei5 === this) delete window.manualRalsei5
      this.confete?.destroy()
    })
    if (resultado && this.pagina.etapa === 'voltando') {
      // a folha volta por cima da arena (que ainda está lá embaixo, parada no "VENCEU!")
      this.mesa.setAlpha(0)
      this.espiral.setAlpha(0)
      this.folha.setScale(0.001, 1)
      virarFolha(this, this.folha, { volta: true, duracao: VOLTAR_MS, aoTerminar: () => {} })
    } else if (resultado) this.pararArena()
    else if (!this.dados.deVirada) this.cameras.main.fadeIn(240)
    this.balao.dizer(this.pagina.fala)
    this.atualizarDicas()
    if (!resultado) musica('tutorial2', 'tutorial')
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
    const i = assarFundoDaPagina5(this)
    const arena = assarArenaDeGiz(this)
    const depois = Boolean(this.pagina.resultado)
    add(this.add.image(0, 0, PAPEL.papel).setOrigin(0))
    add(this.add.image(0, 0, 'manual-p5-fundo').setOrigin(0))
    this.cartao = add(this.add.image(0, 0, 'manual-p5-cartao').setOrigin(0).setVisible(!depois))
    this.desenho = montarDesenho(this, folha, arena)
    this.desenho.desenho.setVisible(!depois)
    this.rotulo = add(imagemDeCera(this, 60, 6, i.rotulo))
    this.titulo = add(this.add.image(62, 30, i.titulo).setOrigin(0))
    this.ralsei = new RalseiDesenhado(this, RALSEI.x, RALSEI.y, { calmo: this.calmo, escala: RALSEI.escala })
    add(this.ralsei.container)
    this.nomeRalsei = add(this.texto(RALSEI.x, RALSEI.y + 9, 'RALSEI', 11, { fontStyle: 'bold', color: TINTA_SUAVE }).setOrigin(0.5, 0))
    this.balao = new Balao(this, { ...BALAO, chave: 'manual-p5-balao', calmo: this.calmo })
    add(...this.balao.objetos)
    this.adesivo = add(imagemDeCera(this, ADESIVO.x, ADESIVO.y, assarAdesivoEssencial(this)).setVisible(false))
    this.dicas = add(this.texto(LARGURA / 2 + 40, ALTURA - 24, '', 14, { color: TINTA_SUAVE, fontStyle: 'bold' }).setOrigin(0.5))
  }

  // atrás da folha: a página "e agora?" (aparece na virada depois dos parabéns)
  montarProxima() {
    const c = (this.proxima = this.add.container(0, 0).setDepth(10).setVisible(false))
    const i = assarEAgora(this)
    c.add(this.add.image(0, 0, PAPEL.papel).setOrigin(0))
    c.add(this.add.image(0, 0, 'manual-p5-eagora-fundo').setOrigin(0))
    c.add(imagemDeCera(this, 60, 6, assarRotulo(this, 'manual-rotulo-p5', 'PÁGINA 5')))
    c.add(this.add.image(62, 26, i.titulo).setOrigin(0))
    c.add(this.texto(66, 96, FALA_E_AGORA, 16, { fontStyle: 'bold' }))
    c.add(imagemDeCera(this, 160, 236, assarAdesivoEssencial(this, 62)))
    this.ralseiE = new RalseiDesenhado(this, 160, 446, { calmo: this.calmo, escala: 0.66 })
    this.ralseiE.setExpressao('animado')
    c.add(this.ralseiE.container)
    const x = 420
    this.linhasE = OPCOES_E_AGORA.map((o, k) => {
      const t = this.texto(x, OPCOES_Y + k * OPCOES_PASSO, o.rotulo, 21, { fontStyle: 'bold' }).setOrigin(0, 0.5)
      c.add(t)
      return t
    })
    this.cursorE = imagemDeCera(this, 0, 0, assarCamadas(this, 'manual-p5-cursor', rabiscoDoCoracao(criarRng('manual:p5:cursor'), 20).camadas, { grao: 0.25 }))
    c.add(this.cursorE)
    this.dicaE = this.texto(x, OPCOES_Y + OPCOES_AGORA_FIM, '', 14, { color: TINTA_SUAVE, fontStyle: 'bold', wordWrap: { width: 400 } })
    c.add(this.dicaE)
    this.proxDicas = this.texto(LARGURA / 2 + 40, ALTURA - 24, '', 14, { color: TINTA_SUAVE, fontStyle: 'bold' }).setOrigin(0.5)
    c.add(this.proxDicas)
    this.atualizarEAgora()
  }

  atualizarEAgora() {
    const p = this.pagina
    this.linhasE.forEach((t, k) => t.setColor(k === p.opcao ? TINTA : TINTA_SUAVE).setAlpha(k === p.opcao ? 1 : 0.72))
    const t = this.linhasE[p.opcao]
    this.cursorE.setPosition(t.x - 22, t.y)
    this.dicaE.setText(OPCOES_E_AGORA[p.opcao].dica)
  }

  // ---------- a transição do giz para a arena (e a volta) ----------

  desenharTransicao() {
    const p = this.pagina
    if (p.etapa === 'enchendo') {
      const f = Math.min(1, p.tempoEtapa / ENCHER_MS)
      const g = ease(Math.min(1, f / CRESCER))
      // o desenho cresce até a arena ocupar a tela (no lugar exato da arena de verdade)
      this.desenho.desenho.setPosition(entre(CARTAO.x, 0, g), entre(CARTAO.y, 0, g)).setScale(entre(CARTAO.escala, 1, g))
      // o resto da página sai da frente
      for (const o of [this.cartao, this.ralsei.container, this.nomeRalsei, this.rotulo, this.titulo, ...this.balao.objetos]) o.setAlpha(1 - g)
      // e o giz ganha cor
      this.desenho.cor.setAlpha(Math.max(0, (f - CRESCER) / (1 - CRESCER)))
    } else if (p.etapa === 'descolando') {
      // a mesa e a espiral somem junto: por baixo da folha está a arena de verdade
      const a = 1 - Math.min(1, p.tempoEtapa / DESCOLAR_MS)
      this.mesa.setAlpha(a)
      this.espiral.setAlpha(a)
    } else if (p.etapa === 'voltando') {
      const a = Math.min(1, p.tempoEtapa / VOLTAR_MS)
      this.mesa.setAlpha(a)
      this.espiral.setAlpha(a)
    }
  }

  // a arena de verdade começa a carregar por baixo do caderno; com a cortina, ela espera abrir() (no modo
  // calmo é um corte: sem cortina, ela já começa)
  lancarArena() {
    if (this.scene.isActive(CHAVE_PARTIDA)) return
    this.scene.launch(CHAVE_PARTIDA, dadosDaPartida({ cortina: !this.calmo }))
    this.scene.bringToTop() // o caderno fica por cima até a folha descolar
  }

  pararArena() {
    if (this.scene.isActive(CHAVE_PARTIDA) || this.scene.isPaused(CHAVE_PARTIDA)) this.scene.stop(CHAVE_PARTIDA)
  }

  // ---------- dicas ----------

  atualizarDicas() {
    const d = dicasDeBotoes(get(jogo).fonte, normalizarTeclas(pref('teclas')))
    const p = this.pagina
    const sair = `${d.B}: sair`
    const linha =
      {
        intro: `${d.A}: continuar      ${sair}`,
        enchendo: sair,
        descolando: sair,
        parabens: `${d.A}: continuar      ${sair}`,
        eAgora: `${teclasDoEixo(d, 'vertical')}: escolher      ${d.A}: ir      ${d.B}: índice`,
      }[p.etapa] ?? ''
    if (linha === this.dicaAtual) return
    this.dicaAtual = linha
    this.dicas.setText(linha)
    this.proxDicas.setText(linha)
  }

  // ---------- entrada ----------

  apertarA() {
    if (this.saindo || this.virando) return
    const p = this.pagina
    if (this.balao.digitando && (p.etapa === 'intro' || p.etapa === 'parabens')) return this.balao.completar()
    if (p.avancar()) tocar(this, 'confirmar')
  }

  apertarB() {
    if (this.saindo || this.pagina.etapa === 'partida') return
    this.sair()
  }

  sair() {
    this.saindo = true
    this.pararArena()
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start('GuiaEntrada', { modo: 'indice' }))
  }

  // a página "e agora?": para onde ir
  ir(destino) {
    this.saindo = true
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => {
      if (destino === 'cpu') {
        this.registry.set('modo', 'pvp')
        irCarregando(this, 'PvpEscolha')
      } else if (destino === 'online') irCarregando(this, 'Lan', { voltar: 'Menu', pilha: [{ cena: 'Menu' }] })
      else if (destino === 'cartas') {
        musica('menu', 'jevil') // o guia de cartas toca a música do menu
        irCarregando(this, 'Grimorio')
      } else this.scene.start('GuiaEntrada', { modo: 'indice' })
    })
  }

  // ---------- quadro a quadro ----------

  update(tempo, delta) {
    if (!this.pagina) return
    const p = this.pagina
    this.controles.atualizar()
    if (!this.saindo && !this.virando) {
      for (let j = 0; j < this.controles.numJogadores; j++) {
        if (!p.mover(this.controles.toque(j))) continue
        tocar(this, 'mover')
        this.atualizarEAgora()
      }
    }
    if (!this.saindo) p.tick(delta)
    this.balao.update(tempo, delta, p.etapa === 'intro' || p.etapa === 'parabens')
    for (const e of p.drenar()) this.aoEvento(e)
    this.desenharTransicao()
    this.ralsei.setExpressao(expressaoDaPagina5(p))
    this.ralsei.update(tempo)
    this.ralseiE.update(tempo)
    if (this.confete && !this.confete.update(delta)) this.confete = null
    this.atualizarDicas()
  }

  aoEvento(e) {
    const p = this.pagina
    if (e.tipo === 'fala') this.balao.dizer(p.fala)
    if (e.tipo === 'lancarArena') {
      somDePapel('rabisco')
      this.lancarArena()
    }
    if (e.tipo === 'abrirArena') {
      // a arena de verdade está na tela: ela começa e o caderno sai
      this.saindo = true
      if (!this.calmo) this.scene.get(CHAVE_PARTIDA)?.abrir?.()
      this.scene.stop()
    }
    if (e.tipo === 'essencial') this.ganharAdesivo()
    if (e.tipo === 'ir') {
      tocar(this, 'confirmar')
      this.ir(e.destino)
    }
    if (e.tipo !== 'etapa') return
    if (e.etapa === 'enchendo') tocar(this, 'graze')
    if (e.etapa === 'descolando') {
      virarFolha(this, this.folha, { duracao: DESCOLAR_MS, aoTerminar: () => this.folha.setVisible(false) })
    }
    if (e.etapa === 'parabens') {
      this.pararArena()
      this.mesa.setAlpha(1)
      this.espiral.setAlpha(1)
      musica('tutorial2', 'tutorial')
      this.balao.dizer(p.fala)
    }
    if (e.etapa === 'virando') this.virarPagina()
    if (e.etapa === 'eAgora') this.atualizarEAgora()
  }

  // o adesivo dourado MANUAL ESSENCIAL: salvo na hora (ganhando ou perdendo)
  ganharAdesivo() {
    definirPref('manual', comPagina5(pref('manual')))
    const a = this.adesivo
    a.setVisible(true)
    tocar(this, 'cura')
    somDePapel('adesivo')
    if (this.calmo) return
    a.setScale(2.2).setAlpha(0)
    this.tweens.add({ targets: a, scale: 1, alpha: 1, duration: 420, delay: 200, ease: 'Back.easeOut' })
    brilhar(this, a.x, a.y, { pai: this.folha, n: 8, raio: 70 })
    if (pref('flashes') !== false) {
      const n = Math.max(6, Math.round(44 * fatores().festa))
      this.time.delayedCall(460, () => {
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
      },
    })
  }
}

