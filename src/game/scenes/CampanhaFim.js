import Phaser from 'phaser'
import { get } from 'svelte/store'
import Controles from '../controles.js'
import { tocar, musica } from '../audio.js'
import { FONTE, LARGURA, ALTURA } from '../constants.js'
import { menosMovimento } from '../preferencias.js'
import { desenharCenario } from '../campanha/desenharCenario.js'
import { criarEco } from '../campanha/eco.js'
import { semLigaduras } from '../campanha/texto.js'
import { PERSONAGENS } from '../data/personagens.js'
import { mundoDe, faseDe, TEXTOS, libertosAte } from '../campanha/mundos/index.js'
import { textoMotivoCampanha } from '../campanha/recompensas.js'
import CaixaDeDialogo from '../campanha/CaixaDeDialogo.js'
import { progressoDoXp, nomeDoItem, itemDoCatalogo, NOME_TIPO } from '../../lib/progresso.js'
import { campanha, escolherNoDialogo } from '../../lib/campanha.js'

// CAMPANHA: o FIM de uma fase (docs/campanha.md). Primeiro a cena de depois (vitória) ou a de derrota
// (diálogo), depois a tela de recompensa com o que o SERVIDOR concedeu: estrelas, XP (barra do nível),
// itens novos e, ao vencer o chefe pela primeira vez, o cosmético exclusivo do mundo. Corrida suspeita
// ou abandonada: o motivo, sem recompensa. O fundo é o lugar da fase, já sem ninguém; as estrelas
// são três luzinhas.
//
//   A: voltar ao mapa · B: jogar a fase de novo
//   scene.start('CampanhaFim', { mundo, fase, fim: campanhaFim, escolhas })
const TINTA = '#e8e4f4'
const COR_TEXTO = { ouro: '#e0b84a', aviso: '#d0485a', claro: '#bdb8d0', apagado: '#6a6680', eco: '#8fb8c0' }

// uma estrela de cinco pontas (as luzes da fase)
function estrela(g, x, y, r, cor, alpha) {
  const pts = []
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (Math.PI * k) / 5
    const rr = k % 2 ? r * 0.45 : r
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr })
  }
  g.fillStyle(cor, alpha).fillPoints(pts, true)
}

const MOTIVOS_SUSPEITA = {
  teleporte: 'o coração pulou de um lugar para outro',
  velocidade: 'o coração andou mais rápido do que pode',
  futuro: 'as posições chegaram antes do tempo',
  rapida_demais: 'a esquiva acabou antes do tempo',
  fora_da_caixa: 'o coração saiu da caixa',
  intervalo: 'faltaram posições do coração',
  relato_impossivel: 'o relato de acertos não fecha',
}

const estadoInicial = () => ({
  mundo: null,
  fase: null,
  fim: null,
  caixa: null,
  controles: null,
  etapa: 'dialogo',
  cenario: null,
  painel: null,
  saindo: false,
  eco: null,
  kris: null,
  livre: null,
})

export default class CampanhaFim extends Phaser.Scene {
  constructor() {
    super('CampanhaFim')
  }

  create(dados = {}) {
    Object.assign(this, estadoInicial())
    this.mundo = mundoDe(dados.mundo ?? 1)
    this.fase = faseDe(this.mundo.id, dados.fase ?? 1)
    this.fim = dados.fim ?? { resultado: 'abandono' }
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => this.botao(botao))
    const textos = TEXTOS[this.mundo.id].fases[this.fase.id]
    this.cenario = desenharCenario(this, textos.cenario ?? 'mapa', { profundidade: -10, brilho: 0.7, partida: true })
    this.painel = this.add.container(0, 0).setDepth(20)
    this.events.once('shutdown', () => this.caixa?.destroy())
    this.cameras.main.fadeIn(500)
    const venceu = this.fim.resultado === 'vitoria'
    musica('campanha', 'menu')
    const falas = venceu ? textos.depois : this.fim.resultado === 'derrota' ? textos.derrota : []
    if (!falas.length) return this.mostrarRecompensa()
    this.kris = this.add.image(250, 312, this.mundo.personagem).setOrigin(0.5, 1).setScale(3).setDepth(5)
    if (venceu) this.libertar()
    else this.eco = criarEco(this, 600, 312, this.fase.oponente, { escala: 3, profundidade: 5, alpha: 0.65, flipX: true })
    this.caixa = new CaixaDeDialogo(this, falas, {
      ecos: TEXTOS[this.mundo.id].ecos,
      livres: libertosAte(this.mundo.id, this.fase.n, { comEsta: venceu }),
      escolhas: { ...(dados.escolhas ?? {}), ...(get(campanha).escolhas[this.mundo.id] ?? {}) },
      aoEscolher: (chave, valor) => escolherNoDialogo(this.mundo.id, chave, valor),
      aoAcabar: () => {
        this.caixa = null
        // o eco se apaga devagar; a Kris fica
        const eco = this.eco
        this.eco = null
        if (eco && !menosMovimento()) this.tweens.add({ targets: eco.objetos, alpha: 0, duration: 900, onComplete: () => eco.destruir() })
        else eco?.destruir()
        this.mostrarRecompensa()
      },
    })
  }

  // venceu: o eco se desfaz num clarão suave e quem estava preso volta com cor (libertado)
  libertar() {
    const x = 600
    const y = 312
    const livre = this.add.image(x, y, this.fase.oponente).setOrigin(0.5, 1).setScale(3).setFlipX(true).setDepth(5)
    this.livre = livre
    tocar(this, 'brilhoRank')
    if (menosMovimento()) return
    const eco = criarEco(this, x, y, this.fase.oponente, { escala: 3, profundidade: 6, alpha: 0.7, flipX: true })
    livre.setAlpha(0)
    const luz = this.add.circle(x, y - 40, 14, 0xf2e2b0, 0.9).setDepth(7).setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({ targets: luz, scale: 7, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => luz.destroy() })
    this.tweens.add({ targets: eco.objetos, alpha: 0, duration: 700, onComplete: () => eco.destruir() })
    this.tweens.add({ targets: livre, alpha: 1, duration: 900, delay: 200 })
    this.tweens.add({ targets: livre, y: y - 6, duration: 260, yoyo: true, delay: 1100, ease: 'Quad.easeOut' })
  }

  mostrarRecompensa() {
    this.etapa = 'recompensa'
    const f = this.fim
    const venceu = f.resultado === 'vitoria'
    const texto = (x, y, s, est) => this.add.text(x, y, semLigaduras(s), est)
    const estilo = (t, cor = TINTA) => ({ fontFamily: FONTE, fontSize: `${t}px`, color: cor, align: 'center' })
    const add = (o) => (this.painel.add(o), o)
    const cx = LARGURA / 2
    // a Kris fica num canto (com quem acabou de voltar); um véu deixa o painel legível
    this.kris?.setX(110)
    this.livre?.setX(170)
    // um véu sobre o lugar vazio: o painel fica legível
    const veu = add(this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000, 0.78).setOrigin(0))
    if (!menosMovimento()) {
      veu.setAlpha(0)
      this.tweens.add({ targets: veu, alpha: 1, duration: 700 })
    }
    const titulo = venceu ? (this.fase.chefe ? 'AS LUZES VOLTARAM' : `${(PERSONAGENS[this.fase.oponente]?.nome ?? 'O ECO').toUpperCase()} ESTÁ LIVRE!`) : f.resultado === 'derrota' ? 'O SILÊNCIO VENCEU…' : f.resultado === 'suspeita' ? 'PARTIDA NÃO CONFIRMADA' : 'PARTIDA ABANDONADA'
    add(texto(cx, 38, titulo, estilo(24, venceu ? COR_TEXTO.ouro : COR_TEXTO.aviso)).setOrigin(0.5, 0))
    const sub = venceu && this.fase.chefe ? `${this.mundo.nome}  ·  a luz ficou acesa  ·  fim do mundo 1` : venceu ? `luz ${this.fase.n} de ${this.mundo.fases.length} acesa  ·  ${this.fase.nome}` : `${this.fase.chefe ? 'a última porta' : `porta ${this.fase.n}`}  ·  ${this.fase.nome}`
    add(texto(cx, 72, `${sub}${f.rodadas ? `  ·  ${f.rodadas} rodada${f.rodadas > 1 ? 's' : ''}` : ''}`, estilo(12, COR_TEXTO.claro)).setOrigin(0.5, 0))
    // as estrelas (do servidor): três luzinhas que acendem uma a uma
    const g = add(this.add.graphics())
    const brilho = add(this.add.graphics().setBlendMode(Phaser.BlendModes.ADD))
    for (let k = 0; k < 3; k++) {
      const ganhou = k < (f.estrelas ?? 0)
      const x = cx - 60 + k * 60
      const desenhar = () => {
        if (ganhou) for (let j = 0; j < 3; j++) brilho.fillStyle(0xe0b84a, 0.08).fillCircle(x, 132, 14 + j * 7)
        estrela(g, x, 132, ganhou ? 15 : 11, ganhou ? 0xf2e2b0 : 0x2a2838, ganhou ? 1 : 0.9)
      }
      if (menosMovimento() || !ganhou) desenhar()
      else
        this.time.delayedCall(500 + k * 520, () => {
          desenhar()
          tocar(this, 'brilhoRank')
        })
    }
    const lista = ['vencer', 'terminar com 60% do HP', `em até ${this.fase.metaRodadas} rodadas`]
    add(texto(cx, 160, lista.join('   ·   '), estilo(10, COR_TEXTO.apagado)).setOrigin(0.5, 0))
    // o XP e o motivo
    let y = 210
    if (venceu || f.xpGanho) {
      add(texto(cx, y, `+${f.xpGanho ?? 0} XP`, estilo(20, COR_TEXTO.ouro)).setOrigin(0.5, 0))
      y += 34
      if (f.xpTotal != null) {
        const p = progressoDoXp(f.xpTotal)
        const bg = add(this.add.graphics())
        bg.fillStyle(0x14121e, 1).fillRect(cx - 150, y, 300, 8)
        bg.lineStyle(1, 0xffffff, 0.5).strokeRect(cx - 150, y, 300, 8)
        const alvo = 300 * (p.noNivel / p.paraProximo)
        const barra = add(this.add.rectangle(cx - 150, y, menosMovimento() ? alvo : 0, 8, 0x8fb8c0).setOrigin(0))
        if (!menosMovimento()) this.tweens.add({ targets: barra, width: alvo, duration: 700, delay: 500 })
        add(texto(cx, y + 16, `nível ${p.nivel}${f.nivelDepois > f.nivelAntes ? '  ·  SUBIU DE NÍVEL!' : ''}  ·  ${p.noNivel}/${p.paraProximo}`, estilo(12)).setOrigin(0.5, 0))
        y += 38
      }
    }
    const motivo = f.resultado === 'suspeita' ? `${textoMotivoCampanha('suspeita')}${MOTIVOS_SUSPEITA[f.motivo] ? `: ${MOTIVOS_SUSPEITA[f.motivo]}` : ''}` : textoMotivoCampanha(f.motivo ?? f.resultado)
    if (motivo) add(texto(cx, y, motivo, estilo(12, f.resultado === 'suspeita' ? COR_TEXTO.aviso : COR_TEXTO.claro)).setOrigin(0.5, 0))
    y += 26
    // itens novos (o cosmético do mundo ganha destaque)
    const itens = (f.itensNovos ?? []).map((id) => itemDoCatalogo(id)).filter(Boolean)
    const doMundo = itens.filter((i) => i.campanha)
    if (doMundo.length) {
      tocar(this, 'brilhoRank')
      add(texto(cx, y, 'O QUE FICOU COM VOCÊ', estilo(13, COR_TEXTO.eco)).setOrigin(0.5, 0))
      y += 24
      doMundo.forEach((item, i) => {
        const x = cx + (i - (doMundo.length - 1) / 2) * 230
        const gg = add(this.add.graphics())
        if (item.tipo === 'moldura') gg.lineStyle(5, parseInt(item.cor.slice(1), 16), 1).strokeCircle(x - 70, y + 22, 16)
        if (item.tipo === 'verso') {
          gg.fillStyle(parseInt(item.cor.slice(1), 16), 1).fillRoundedRect(x - 82, y + 6, 24, 34, 4)
          gg.lineStyle(1, 0xe0b84a, 0.8).strokeRoundedRect(x - 82, y + 6, 24, 34, 4)
          gg.fillStyle(0xf2e2b0, 0.9).fillRect(x - 71, y + 12, 2, 22)
        }
        add(this.add.text(x - 44, y + 12, `${NOME_TIPO[item.tipo].toUpperCase()}\n${item.nome}`, { ...estilo(12), align: 'left' }))
      })
      y += 56
    }
    const outros = itens.filter((i) => !i.campanha).map((i) => nomeDoItem(i.id))
    if (outros.length) add(texto(cx, y, `item novo na trilha: ${outros.join(', ')}`, estilo(12, COR_TEXTO.ouro)).setOrigin(0.5, 0))
    add(texto(cx, ALTURA - 26, venceu && !this.fase.chefe ? 'A: voltar à escada (outra porta se abriu)   ·   B: de novo' : 'A: voltar à escada   ·   B: de novo', estilo(11, COR_TEXTO.claro)).setOrigin(0.5, 0))
  }

  botao(botao) {
    if (this.saindo) return
    if (this.caixa) return botao === 'A' ? this.caixa.confirmar() : this.caixa.pular()
    if (this.etapa !== 'recompensa') return
    this.saindo = true
    tocar(this, botao === 'A' ? 'confirmar' : 'cancelar')
    this.cameras.main.fadeOut(220, 0, 0, 0)
    const proxima = this.fim.resultado === 'vitoria' && !this.fase.chefe ? this.fase.n + 1 : this.fase.n
    this.time.delayedCall(240, () => (botao === 'A' ? this.scene.start('Campanha', { mundo: this.mundo.id, fase: proxima }) : this.scene.start('CampanhaArena', { mundo: this.mundo.id, fase: this.fase.n })))
  }

  update(_, delta) {
    if (!this.controles) return
    this.controles.atualizar()
    this.cenario?.atualizar(delta)
    this.eco?.atualizar(this.time.now)
    if (this.caixa) {
      this.caixa.update(delta)
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const d = this.controles.toque(j)
        if (d === 'cima' || d === 'esquerda') this.caixa?.mover(-1)
        if (d === 'baixo' || d === 'direita') this.caixa?.mover(1)
      }
    }
  }
}
