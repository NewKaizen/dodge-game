import Phaser from 'phaser'
import { get } from 'svelte/store'
import Controles from '../controles.js'
import { tocar, musica } from '../audio.js'
import { FONTE, LARGURA, ALTURA } from '../constants.js'
import { irCarregando } from '../carregando.js'
import { menosMovimento } from '../preferencias.js'
import { criarRng } from '../pvp/baralho.js'
import { PERSONAGENS } from '../data/personagens.js'
import { ESCALA } from '../arte/texturas.js'
import { garantirPapel, PAPEL, assarLetreiro, imagemDeCera, TINTA } from '../manual/paginaBase.js'
import { linhaGiz, circuloGiz, desenharTracos, estrelaGiz, poligonoGiz, preencherGiz, xGiz } from '../manual/giz.js'
import { PALETA } from '../manual/cera.js'
import { mundoDe, TEXTOS, faseLiberada } from '../campanha/mundos/index.js'
import { descreverRegra } from '../campanha/partida.js'
import CaixaDeDialogo from '../campanha/CaixaDeDialogo.js'
import { conta } from '../../lib/conta.js'
import { lan } from '../../lib/lan/rede.js'
import { campanha, entrarNaCampanha, aoCampanha, podeJogarCampanha, progressoDoMundo, escolherNoDialogo } from '../../lib/campanha.js'

// CAMPANHA: o MAPA do mundo (docs/campanha.md). Mundo 1, "A Floresta de Papel" (Kris): as 6 fases
// numa trilha de giz pelo caderno (bloqueada, liberada, estrelas), o retrato da Kris parado na fase
// escolhida, a regra especial e o melhor resultado. A abre a cena de antes (diálogo) e a partida
// (CampanhaArena); B volta ao menu. Só com conta e online: sem isso, um aviso amigável.
// O progresso vem do SERVIDOR (lib/campanha.js -> server/campanha.js -> banco).
//
//   ←→ (ou ↑↓) escolher a fase · A jogar · B voltar
//   scene.start('Campanha', { mundo: 1, fase: 3 })
const NOS = [
  { x: 92, y: 300 },
  { x: 222, y: 214 },
  { x: 352, y: 296 },
  { x: 486, y: 206 },
  { x: 618, y: 288 },
  { x: 756, y: 186 },
]
const ARVORES = [[150, 140], [60, 200], [300, 150], [420, 320], [560, 140], [700, 320], [810, 280], [250, 340], [520, 360], [380, 110], [660, 110]]
const COR_TITULO = '#2f6b3a'

const estadoInicial = () => ({
  mundo: null,
  indice: 0,
  caixa: null,
  saindo: false,
  controles: null,
  info: null,
  kris: null,
  nos: null,
  aviso: null,
  totais: null,
  carregando: null,
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
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => (botao === 'A' ? this.confirmar() : this.voltar()))
    this.controles.onPausa(() => this.voltar())
    garantirPapel(this)
    this.add.image(0, 0, PAPEL.mesa).setOrigin(0)
    this.add.image(0, 0, PAPEL.papel).setOrigin(0)
    this.desenharFloresta()
    const titulo = assarLetreiro(this, 'campanha-titulo-1', this.mundo.nome, { tamanho: 28, cor: COR_TITULO })
    imagemDeCera(this, 54, 20, { ...titulo, minX: 0, minY: 0, w: titulo.largura, h: titulo.altura })
    this.add.text(58, 64, `MUNDO ${this.mundo.id} · ${PERSONAGENS[this.mundo.personagem].nome.toUpperCase()}`, { fontFamily: FONTE, fontSize: '12px', color: '#4e3f63' })
    this.totais = this.add.text(LARGURA - 40, 30, '', { fontFamily: FONTE, fontSize: '14px', color: '#4e3f63' }).setOrigin(1, 0)
    this.montarNos()
    this.kris = this.add.image(NOS[0].x, NOS[0].y - 18, this.mundo.personagem).setOrigin(0.5, 1).setScale(ESCALA.personagem).setDepth(20)
    this.info = this.add.container(0, 0).setDepth(30)
    this.aviso = this.add.text(LARGURA / 2, 392, '', { fontFamily: FONTE, fontSize: '13px', color: '#b3162d', align: 'center', wordWrap: { width: 640 } }).setOrigin(0.5, 0).setDepth(31)
    this.add.text(LARGURA - 18, ALTURA - 14, '←→ ESCOLHER   A: JOGAR   B: VOLTAR', { fontFamily: FONTE, fontSize: '11px', color: '#4e3f63' }).setOrigin(1, 1).setDepth(31)
    this.carregando = this.add.text(LARGURA / 2, ALTURA / 2, 'carregando o progresso…', { fontFamily: FONTE, fontSize: '14px', color: TINTA }).setOrigin(0.5).setDepth(40).setVisible(false)

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
    musica('tutorial2', 'tutorial')
    this.cameras.main.fadeIn(260)
    this.atualizar()
  }

  // ---------- desenho ----------

  desenharFloresta() {
    const g = this.add.graphics().setDepth(2)
    const rng = criarRng('campanha:floresta')
    // árvores de papel dobrado: triângulos de giz verde com hachura e um tronquinho
    for (const [x, y] of ARVORES) {
      const a = 30 + (x % 3) * 6
      const pts = [{ x, y: y - a * 1.4 }, { x: x + a * 0.6, y }, { x: x - a * 0.6, y }]
      desenharTracos(g, preencherGiz(rng, pts, { espaco: 5 }), { cor: PALETA.verde, largura: 2.2, alpha: 0.45 })
      desenharTracos(g, poligonoGiz(rng, pts), { cor: PALETA.verdeEscuro, largura: 2.4, alpha: 0.8 })
      desenharTracos(g, linhaGiz(rng, x, y, x, y + 12), { cor: 0x8a5a3a, largura: 3, alpha: 0.8 })
      // a dobra do papel no meio
      desenharTracos(g, linhaGiz(rng, x, y - a * 1.4, x, y, { tracos: 1 }), { cor: 0xffffff, largura: 1.2, alpha: 0.5 })
    }
    // a trilha
    for (let i = 0; i < NOS.length - 1; i++) {
      const a = NOS[i]
      const b = NOS[i + 1]
      const n = 7
      for (let k = 0; k < n; k++) {
        const t0 = (k + 0.2) / n
        const t1 = (k + 0.7) / n
        desenharTracos(g, linhaGiz(rng, a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0, a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1, { tracos: 1 }), { cor: 0x9a7a5a, largura: 3, alpha: 0.7 })
      }
    }
  }

  montarNos() {
    this.nos = NOS.map((p, i) => {
      const f = this.mundo.fases[i]
      const g = this.add.graphics().setDepth(10)
      const numero = this.add.text(p.x, p.y, f.chefe ? '★' : String(f.n), { fontFamily: FONTE, fontSize: f.chefe ? '20px' : '16px', color: '#ffffff', stroke: '#2b2540', strokeThickness: 4 }).setOrigin(0.5).setDepth(12)
      const estrelas = this.add.graphics().setDepth(12)
      return { p, f, g, numero, estrelas }
    })
  }

  desenharNo(no, { liberada, estrelas, selecionada }) {
    const { p, f, g } = no
    const rng = criarRng(`campanha:no:${f.n}`)
    const r = f.chefe ? 24 : 19
    g.clear()
    g.fillStyle(liberada ? (f.chefe ? 0xb94a78 : 0x4cb878) : 0x9a94a8, 1).fillCircle(p.x, p.y, r)
    desenharTracos(g, circuloGiz(rng, p.x, p.y, r + 1), { cor: selecionada ? 0xffd34d : PALETA.tinta, largura: selecionada ? 4 : 2.6, alpha: 0.95 })
    if (!liberada) desenharTracos(g, xGiz(rng, p.x, p.y, 9), { cor: 0xffffff, largura: 2.4, alpha: 0.7 })
    no.numero.setVisible(liberada)
    no.estrelas.clear()
    for (let k = 0; k < 3; k++) {
      const cor = k < estrelas ? 0xf2c14e : 0xc8c0b0
      desenharTracos(no.estrelas, estrelaGiz(rng, p.x - 18 + k * 18, p.y + r + 14, 7), { cor, largura: 2.4, alpha: k < estrelas ? 1 : 0.6 })
    }
  }

  // ---------- estado ----------

  atualizar() {
    if (!this.nos || this.saindo) return
    const pode = podeJogarCampanha()
    const c = get(conta)
    const prog = progressoDoMundo(this.mundo.id)
    const fases = get(campanha).fases
    let total = 0
    this.nos.forEach((no, i) => {
      const est = prog[no.f.n]?.estrelas ?? 0
      total += est
      this.desenharNo(no, { liberada: pode && faseLiberada(fases, this.mundo.id, no.f.n), estrelas: est, selecionada: i === this.indice })
    })
    const vencidas = Object.values(prog).filter((x) => x.concluida).length
    this.totais.setText(pode ? `★ ${total}/${this.mundo.fases.length * 3}   ·   fases ${vencidas}/${this.mundo.fases.length}` : '')
    const alvo = NOS[this.indice]
    if (menosMovimento()) this.kris.setPosition(alvo.x, alvo.y - 18)
    else {
      this.tweens.killTweensOf(this.kris)
      this.tweens.add({ targets: this.kris, x: alvo.x, y: alvo.y - 18, duration: 220, ease: 'Sine.easeOut' })
    }
    this.kris.setFlipX(alvo.x < this.kris.x)
    this.mostrarInfo(pode, c)
  }

  mostrarInfo(pode, c) {
    this.info.removeAll(true)
    const f = this.mundo.fases[this.indice]
    const g = this.add.graphics()
    g.fillStyle(0xfffbf1, 0.92).fillRoundedRect(28, 368, LARGURA - 56, 84, 8)
    g.lineStyle(2, 0x2b2540, 0.8).strokeRoundedRect(28, 368, LARGURA - 56, 84, 8)
    this.info.add(g)
    if (!pode) {
      const msg =
        c.estado === 'indisponivel' ? 'A campanha precisa das contas: este servidor está sem elas.' : c.estado !== 'logado' ? 'Entre com sua conta para jogar a campanha!' : 'Conectando ao servidor da campanha…'
      this.info.add(this.add.text(LARGURA / 2, 386, msg, { fontFamily: FONTE, fontSize: '17px', color: TINTA }).setOrigin(0.5, 0))
      this.info.add(this.add.text(LARGURA / 2, 418, c.estado === 'logado' ? 'o progresso, o XP e os cosméticos ficam salvos no servidor' : 'menu → PERFIL → entrar com o Google (o XP e os cosméticos ficam na conta)', { fontFamily: FONTE, fontSize: '12px', color: '#4e3f63' }).setOrigin(0.5, 0))
      this.aviso.setText('')
      return
    }
    const liberada = faseLiberada(get(campanha).fases, this.mundo.id, f.n)
    const melhor = progressoDoMundo(this.mundo.id)[f.n]
    this.info.add(this.add.text(44, 376, `${f.chefe ? 'CHEFE · ' : `FASE ${f.n} · `}${f.nome}`, { fontFamily: FONTE, fontSize: '18px', color: TINTA }))
    this.info.add(this.add.text(44, 402, `contra ${PERSONAGENS[f.oponente].nome.toUpperCase()}  ·  ${descreverRegra(f.regra)}`, { fontFamily: FONTE, fontSize: '12px', color: '#4e3f63', wordWrap: { width: 600 } }))
    const estado = !liberada ? 'BLOQUEADA: vença a fase anterior' : melhor?.concluida ? `vencida · melhor: ${'★'.repeat(melhor.estrelas)}${'☆'.repeat(3 - melhor.estrelas)}` : 'nova!'
    this.info.add(this.add.text(44, 428, `${estado}   ·   ★ vencer  ★ ${Math.round(0.6 * 100)}% do HP  ★ em até ${f.metaRodadas} rodadas`, { fontFamily: FONTE, fontSize: '11px', color: liberada ? '#2f6b3a' : '#b3162d' }))
    this.info.add(this.add.text(LARGURA - 44, 376, TEXTOS[this.mundo.id].resumo, { fontFamily: FONTE, fontSize: '10px', color: '#6a5a80', wordWrap: { width: 190 }, align: 'right' }).setOrigin(1, 0))
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
    if (!podeJogarCampanha()) return tocar(this, 'erro')
    const f = this.mundo.fases[this.indice]
    if (!faseLiberada(get(campanha).fases, this.mundo.id, f.n)) {
      this.aviso.setText('essa fase ainda está bloqueada: vença a anterior primeiro')
      return tocar(this, 'erro')
    }
    tocar(this, 'confirmar')
    this.aviso.setText('')
    const textos = TEXTOS[this.mundo.id].fases[f.id]
    this.caixa = new CaixaDeDialogo(this, textos.antes, {
      escolhas: get(campanha).escolhas[this.mundo.id] ?? {},
      aoEscolher: (chave, valor) => escolherNoDialogo(this.mundo.id, chave, valor),
      aoAcabar: (escolhas) => {
        this.caixa = null
        this.jogar(f, escolhas)
      },
    })
  }

  jogar(f, escolhas) {
    this.saindo = true
    this.cameras.main.fadeOut(240, 0, 0, 0)
    this.time.delayedCall(260, () => irCarregando(this, 'CampanhaArena', { mundo: this.mundo.id, fase: f.n, escolhas }))
  }

  voltar() {
    if (this.saindo) return
    if (this.caixa) return this.caixa.pular()
    this.saindo = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(220, 0, 0, 0)
    this.time.delayedCall(240, () => this.scene.start('Menu'))
  }

  update(_, delta) {
    if (!this.controles) return
    this.controles.atualizar()
    if (this.caixa) {
      this.caixa.update(delta)
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const d = this.controles.toque(j)
        if (d === 'cima' || d === 'esquerda') this.caixa?.mover(-1)
        if (d === 'baixo' || d === 'direita') this.caixa?.mover(1)
      }
      return
    }
    if (this.saindo) return
    for (let j = 0; j < this.controles.numJogadores; j++) {
      const d = this.controles.toque(j)
      if (d === 'esquerda' || d === 'cima') this.selecionar(this.indice - 1)
      if (d === 'direita' || d === 'baixo') this.selecionar(this.indice + 1)
    }
    if (!menosMovimento() && this.kris) this.kris.setScale(ESCALA.personagem, ESCALA.personagem * (1 + Math.sin(this.time.now / 260) * 0.02))
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
