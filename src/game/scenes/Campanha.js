import Phaser from 'phaser'
import { get } from 'svelte/store'
import Controles from '../controles.js'
import { tocar, musica } from '../audio.js'
import { FONTE, LARGURA, ALTURA } from '../constants.js'
import { irCarregando } from '../carregando.js'
import { menosMovimento } from '../preferencias.js'
import { PERSONAGENS } from '../data/personagens.js'
import { mundoDe, TEXTOS, faseLiberada } from '../campanha/mundos/index.js'
import { descreverRegra } from '../campanha/partida.js'
import CaixaDeDialogo from '../campanha/CaixaDeDialogo.js'
import { desenharCenario, pintarFormas } from '../campanha/desenharCenario.js'
import { porta, escada, feixe, COR } from '../campanha/cenario.js'
import { layoutDoMapa } from '../campanha/mapa.js'
import { criarEco } from '../campanha/eco.js'
import { semLigaduras } from '../campanha/texto.js'
import { conta } from '../../lib/conta.js'
import { lan } from '../../lib/lan/rede.js'
import { campanha, entrarNaCampanha, aoCampanha, podeJogarCampanha, progressoDoMundo, escolherNoDialogo } from '../../lib/campanha.js'

// CAMPANHA: o MAPA do mundo (docs/campanha.md). Mundo 1, "A Casa Silenciosa" (Kris): uma escada que
// desce para o escuro, com uma porta em cada patamar (bloqueada: apagada; aberta: uma fresta de
// luz; a escolhida: acesa por cima). A Kris, pequena, para ao lado da porta escolhida. Embaixo, o
// nome do lugar, o tema da regra e as estrelas (três luzinhas). A abre a porta: o lugar aparece por
// trás, com o eco de quem está lá, e a cena de antes (diálogo); depois a partida (CampanhaArena).
// B volta ao menu. Só com conta e online: sem isso, um aviso. O progresso vem do SERVIDOR.
//
//   ←→ (ou ↑↓) escolher a porta · A abrir · B voltar
//   scene.start('Campanha', { mundo: 1, fase: 3 })
const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
const PAINEL = { x: 36, y: 372, largura: LARGURA - 72, altura: 82 }
const ESCALA_KRIS = 2
const COR_TEXTO = { titulo: '#e8e4f4', claro: '#bdb8d0', apagado: '#6a6680', ouro: '#e0b84a', aviso: '#d0485a' }

const estadoInicial = () => ({
  mundo: null,
  indice: 0,
  caixa: null,
  saindo: false,
  controles: null,
  info: null,
  kris: null,
  portas: null,
  layout: null,
  destaque: null,
  aviso: null,
  totais: null,
  carregando: null,
  cenario: null,
  palco: null,
  abrindo: false,
  pararCampanha: null,
  pararConta: null,
})

export default class Campanha extends Phaser.Scene {
  constructor() {
    super('Campanha')
  }

  create(dados = {}) {
    Object.assign(this, estadoInicial())
    this.mundo = mundoDe(dados.mundo ?? 1)
    const textos = TEXTOS[this.mundo.id]
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => (botao === 'A' ? this.confirmar() : this.voltar()))
    this.controles.onPausa(() => this.voltar())
    this.cenario = desenharCenario(this, textos.cenarioMapa ?? 'mapa', { profundidade: -10 })
    this.add.text(40, 22, this.mundo.nome, { fontFamily: FONTE, fontSize: '26px', color: COR_TEXTO.titulo }).setDepth(30)
    this.add.text(42, 56, `MUNDO ${this.mundo.id}  ·  ${PERSONAGENS[this.mundo.personagem].nome.toUpperCase()}`, { fontFamily: FONTE, fontSize: '11px', color: COR_TEXTO.apagado }).setDepth(30)
    this.totais = this.add.text(LARGURA - 40, 24, '', { fontFamily: FONTE, fontSize: '12px', color: COR_TEXTO.ouro }).setOrigin(1, 0).setDepth(30)
    this.add.text(LARGURA - 40, 44, semLigaduras(textos.resumo), { fontFamily: FONTE, fontSize: '10px', color: COR_TEXTO.apagado, align: 'right', wordWrap: { width: 300 }, lineSpacing: 3 }).setOrigin(1, 0).setDepth(30)
    this.layout = layoutDoMapa(this.mundo.fases.length, { largura: LARGURA })
    this.desenharEscada()
    this.portas = this.layout.patamares.map((p) => ({ p, g: this.add.graphics().setDepth(10), luz: this.add.graphics().setDepth(11).setBlendMode(Phaser.BlendModes.ADD), numero: this.add.text(p.porta.x, p.porta.y - p.porta.h - 10, '', { fontFamily: FONTE, fontSize: '10px', color: COR_TEXTO.apagado }).setOrigin(0.5, 1).setDepth(12) }))
    this.destaque = this.add.graphics().setDepth(13).setBlendMode(Phaser.BlendModes.ADD)
    const k0 = this.layout.patamares[0].kris
    this.kris = this.add.image(k0.x, k0.y, this.mundo.personagem).setOrigin(0.5, 1).setScale(ESCALA_KRIS).setDepth(20)
    this.info = this.add.container(0, 0).setDepth(30)
    this.aviso = this.add.text(LARGURA / 2, PAINEL.y - 10, '', { fontFamily: FONTE, fontSize: '12px', color: COR_TEXTO.aviso, align: 'center', wordWrap: { width: 640 } }).setOrigin(0.5, 1).setDepth(31)
    this.add.text(LARGURA - 18, ALTURA - 8, '←→ ESCOLHER   A: ABRIR A PORTA   B: VOLTAR', { fontFamily: FONTE, fontSize: '10px', color: COR_TEXTO.apagado }).setOrigin(1, 1).setDepth(31)
    this.carregando = this.add.text(LARGURA / 2, ALTURA / 2, 'carregando o progresso…', { fontFamily: FONTE, fontSize: '13px', color: COR_TEXTO.claro }).setOrigin(0.5).setDepth(40).setVisible(false)

    this.pararCampanha = aoCampanha((m) => this.aoServidor(m))
    this.pararConta = conta.subscribe(() => this.atualizar())
    const pararLan = lan.subscribe(() => this.atualizar())
    this.events.once('shutdown', () => {
      this.pararCampanha?.()
      this.pararConta?.()
      pararLan()
      this.caixa?.destroy()
    })
    entrarNaCampanha()
    const p = progressoDoMundo(this.mundo.id)
    const ultima = this.mundo.fases.filter((f) => faseLiberada(get(campanha).fases, this.mundo.id, f.n)).at(-1)?.n ?? 1
    this.indice = Math.max(0, (dados.fase ?? ultima) - 1)
    if (!p[1] && !get(campanha).carregado) this.carregando.setVisible(podeJogarCampanha())
    musica('campanha', 'menu')
    this.cameras.main.fadeIn(600)
    this.atualizar()
    const alvo = this.layout.patamares[this.indice].kris
    this.kris.setPosition(alvo.x, alvo.y)
  }

  // ---------- desenho ----------

  desenharEscada() {
    const g = this.add.graphics().setDepth(5)
    const luz = this.add.graphics().setDepth(6).setBlendMode(Phaser.BlendModes.ADD)
    const formas = []
    for (const d of this.layout.degraus) formas.push(...escada({ x: d.x, y: d.y, degraus: 1, dx: d.w, dy: 0, espessura: d.h + 3, cor: 0x0c0a16, quina: 0x4a4466, alphaQuina: 0.7 }))
    for (const p of this.layout.patamares) {
      const x0 = p.x - p.largura / 2
      formas.push({ tipo: 'poligono', pontos: [x0, p.y, x0 + p.largura, p.y, x0 + p.largura, p.y + 10, x0, p.y + 10], cor: 0x0e0b1a, alpha: 1 })
      formas.push({ tipo: 'linha', x1: x0, y1: p.y, x2: x0 + p.largura, y2: p.y, cor: 0x6a6090, alpha: 0.7, largura: 1 })
      // a sombra que o patamar joga no escuro de baixo
      formas.push({ tipo: 'poligono', pontos: [x0 + 4, p.y + 10, x0 + p.largura - 4, p.y + 10, x0 + p.largura - 14, p.y + 40, x0 + 14, p.y + 40], cor: 0x000000, alpha: 0.5 })
    }
    pintarFormas(g, luz, formas)
  }

  desenharPorta(no, { liberada, vencida, estrelas, selecionada, chefe }) {
    const { p, g, luz } = no
    g.clear()
    luz.clear()
    // a do chefe, mesmo fechada, deixa escapar um fio de luz (alguém está lá)
    const nivelLuz = !liberada ? (chefe ? 0.12 : 0) : selecionada ? 1 : vencida ? 0.55 : 0.3
    const batente = !liberada ? 0x1c1a28 : selecionada ? COR.osso : chefe ? COR.dourado : 0x6a6090
    pintarFormas(g, luz, porta({ x: p.porta.x, y: p.porta.y, w: p.porta.w, h: p.porta.h, luz: nivelLuz, batente, cor: liberada ? 0x0c0a14 : 0x060509, corLuz: chefe ? COR.ouroPalido : COR.dourado }))
    // as estrelas: três luzinhas embaixo da porta
    for (let k = 0; k < 3; k++) {
      const e = p.estrelas[k]
      if (k < estrelas) {
        luz.fillStyle(COR.dourado, 0.25).fillCircle(e.x, e.y, 5)
        g.fillStyle(COR.ouroPalido, 0.95).fillCircle(e.x, e.y, 2)
      } else g.fillStyle(0x2a2838, 1).fillCircle(e.x, e.y, 2)
    }
    no.numero.setText(chefe ? '' : ROMANOS[p.i] ?? String(p.i + 1)).setColor(selecionada ? COR_TEXTO.claro : COR_TEXTO.apagado)
  }

  desenharDestaque(t = 0) {
    const no = this.portas?.[this.indice]
    if (!no) return
    const g = this.destaque
    g.clear()
    if (!podeJogarCampanha() || !faseLiberada(get(campanha).fases, this.mundo.id, no.p.i + 1)) return
    const pulso = menosMovimento() ? 1 : 0.8 + 0.2 * Math.sin(t / 900)
    const { x, y, w } = no.p.porta
    // um feixe fino caindo de cima sobre a porta escolhida
    const f = feixe(x - w / 2 - 6, 0, w + 12, y, 0, COR.ouroPalido, 0.05 * pulso)
    const pts = []
    for (let k = 0; k < f.pontos.length; k += 2) pts.push({ x: f.pontos[k], y: f.pontos[k + 1] })
    g.fillStyle(f.cor, f.alpha).fillPoints(pts, true)
  }

  // ---------- estado ----------

  atualizar() {
    if (!this.portas || this.saindo) return
    const pode = podeJogarCampanha()
    const c = get(conta)
    const prog = progressoDoMundo(this.mundo.id)
    const fases = get(campanha).fases
    let total = 0
    this.portas.forEach((no, i) => {
      const f = this.mundo.fases[i]
      const est = prog[f.n]?.estrelas ?? 0
      total += est
      this.desenharPorta(no, { liberada: pode && faseLiberada(fases, this.mundo.id, f.n), vencida: Boolean(prog[f.n]?.concluida), estrelas: est, selecionada: i === this.indice, chefe: f.chefe })
    })
    const vencidas = Object.values(prog).filter((x) => x.concluida).length
    this.totais.setText(pode ? `${total} de ${this.mundo.fases.length * 3} luzes   ·   ${vencidas}/${this.mundo.fases.length} portas` : '')
    const alvo = this.layout.patamares[this.indice].kris
    if (menosMovimento()) this.kris.setPosition(alvo.x, alvo.y)
    else {
      this.tweens.killTweensOf(this.kris)
      this.tweens.add({ targets: this.kris, x: alvo.x, y: alvo.y, duration: 420, ease: 'Sine.easeInOut' })
    }
    this.kris.setFlipX(alvo.x < this.kris.x)
    this.desenharDestaque(this.time.now)
    this.mostrarInfo(pode, c)
  }

  mostrarInfo(pode, c) {
    this.info.removeAll(true)
    const f = this.mundo.fases[this.indice]
    const g = this.add.graphics()
    g.fillStyle(0x000000, 0.92).fillRect(PAINEL.x, PAINEL.y, PAINEL.largura, PAINEL.altura)
    g.lineStyle(1, 0xffffff, 0.7).strokeRect(PAINEL.x + 2, PAINEL.y + 2, PAINEL.largura - 4, PAINEL.altura - 4)
    this.info.add(g)
    const txt = (x, y, s, tam, cor, extra = {}) => {
      const t = this.add.text(x, y, semLigaduras(s), { fontFamily: FONTE, fontSize: `${tam}px`, color: cor, ...extra })
      this.info.add(t)
      return t
    }
    if (!pode) {
      const msg = c.estado === 'indisponivel' ? 'A campanha precisa das contas: este servidor está sem elas.' : c.estado !== 'logado' ? 'Entre com sua conta para jogar a campanha.' : 'Conectando ao servidor da campanha…'
      txt(LARGURA / 2, PAINEL.y + 18, msg, 15, COR_TEXTO.titulo).setOrigin(0.5, 0)
      txt(LARGURA / 2, PAINEL.y + 48, c.estado === 'logado' ? 'o progresso, o XP e os cosméticos ficam salvos no servidor' : 'menu → PERFIL → entrar com o Google (o XP e os cosméticos ficam na conta)', 11, COR_TEXTO.apagado).setOrigin(0.5, 0)
      this.aviso.setText('')
      return
    }
    const liberada = faseLiberada(get(campanha).fases, this.mundo.id, f.n)
    const melhor = progressoDoMundo(this.mundo.id)[f.n]
    const tf = TEXTOS[this.mundo.id].fases[f.id]
    const x = PAINEL.x + 18
    txt(x, PAINEL.y + 12, `${f.chefe ? 'A ÚLTIMA PORTA' : `PORTA ${ROMANOS[f.n - 1]}`}  ·  ${f.nome}`, 15, liberada ? COR_TEXTO.titulo : COR_TEXTO.apagado)
    txt(x, PAINEL.y + 34, liberada ? tf.tema : 'A porta não abre. Ainda.', 11, liberada ? COR_TEXTO.claro : COR_TEXTO.apagado, { wordWrap: { width: 560 } })
    const estado = !liberada ? 'vença a porta anterior primeiro' : melhor?.concluida ? `atravessada  ·  ${melhor.estrelas} de 3 luzes` : 'nunca aberta'
    txt(x, PAINEL.y + 56, `eco de ${PERSONAGENS[f.oponente].nome.toUpperCase()}  ·  ${estado}`, 10, liberada ? COR_TEXTO.ouro : COR_TEXTO.apagado)
    // a regra mecânica e as três estrelas, à direita, bem pequenas
    txt(PAINEL.x + PAINEL.largura - 18, PAINEL.y + 14, `${descreverRegra(f.regra)}\n\nluzes: vencer · 60% do HP · até ${f.metaRodadas} rodadas`, 9, COR_TEXTO.apagado, { align: 'right', wordWrap: { width: 200 }, lineSpacing: 2 }).setOrigin(1, 0)
  }

  aoServidor(m) {
    if (m.t === 'campanhaProgresso') {
      this.carregando.setVisible(false)
      this.atualizar()
    } else if (m.t === 'campanhaErro' && !m.corrida) {
      this.carregando.setVisible(false)
      this.aviso.setText(m.msg ?? '')
    }
  }

  // ---------- entrada ----------

  confirmar() {
    if (this.saindo) return
    if (this.caixa) return this.caixa.confirmar()
    if (this.abrindo) return
    if (!podeJogarCampanha()) return tocar(this, 'erro')
    const f = this.mundo.fases[this.indice]
    if (!faseLiberada(get(campanha).fases, this.mundo.id, f.n)) {
      this.aviso.setText('a porta não abre: atravesse a anterior primeiro')
      return tocar(this, 'erro')
    }
    tocar(this, 'confirmar')
    this.aviso.setText('')
    this.abrirPorta(f)
  }

  // a porta abre: o lugar aparece por trás de tudo, com o eco de quem está lá, e a conversa começa
  abrirPorta(f) {
    this.abrindo = true
    const textos = TEXTOS[this.mundo.id]
    const tf = textos.fases[f.id]
    const comecar = () => {
      const palco = desenharCenario(this, tf.cenario, { profundidade: 50 })
      const kris = this.add.image(250, 316, this.mundo.personagem).setOrigin(0.5, 1).setScale(3).setDepth(52)
      const eco = criarEco(this, 590, 316, f.oponente, { escala: 3, profundidade: 52, alpha: 0.6, flipX: true })
      this.palco = { cenario: palco, kris, eco }
      this.cameras.main.fadeIn(menosMovimento() ? 200 : 500)
      this.caixa = new CaixaDeDialogo(this, tf.antes, {
        ecos: textos.ecos,
        escolhas: get(campanha).escolhas[this.mundo.id] ?? {},
        aoEscolher: (chave, valor) => escolherNoDialogo(this.mundo.id, chave, valor),
        aoAcabar: (escolhas) => {
          this.caixa = null
          this.jogar(f, escolhas)
        },
      })
    }
    this.cameras.main.fadeOut(menosMovimento() ? 150 : 380, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', comecar)
  }

  jogar(f, escolhas) {
    this.saindo = true
    this.cameras.main.fadeOut(400, 0, 0, 0)
    this.time.delayedCall(420, () => irCarregando(this, 'CampanhaArena', { mundo: this.mundo.id, fase: f.n, escolhas }))
  }

  voltar() {
    if (this.saindo) return
    if (this.caixa) return this.caixa.pular()
    if (this.abrindo) return
    this.saindo = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.time.delayedCall(320, () => this.scene.start('Menu'))
  }

  update(tempo, delta) {
    if (!this.controles) return
    this.controles.atualizar()
    this.cenario?.atualizar(delta)
    if (this.palco) {
      this.palco.cenario.atualizar(delta)
      this.palco.eco.atualizar(tempo)
    }
    if (this.caixa) {
      this.caixa.update(delta)
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const d = this.controles.toque(j)
        if (d === 'cima' || d === 'esquerda') this.caixa?.mover(-1)
        if (d === 'baixo' || d === 'direita') this.caixa?.mover(1)
      }
      return
    }
    if (this.saindo || this.abrindo) return
    if (!menosMovimento()) this.desenharDestaque(tempo)
    for (let j = 0; j < this.controles.numJogadores; j++) {
      const d = this.controles.toque(j)
      if (d === 'esquerda' || d === 'cima') this.selecionar(this.indice - 1)
      if (d === 'direita' || d === 'baixo') this.selecionar(this.indice + 1)
    }
  }

  selecionar(i) {
    const n = Math.max(0, Math.min(this.mundo.fases.length - 1, i))
    if (n === this.indice) return
    this.indice = n
    tocar(this, 'mover')
    this.aviso.setText('')
    this.atualizar()
  }
}
