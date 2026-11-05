import Phaser from 'phaser'
import { get } from 'svelte/store'
import Controles from '../controles.js'
import { tocar, musica } from '../audio.js'
import { FONTE, LARGURA, ALTURA } from '../constants.js'
import { menosMovimento } from '../preferencias.js'
import { criarRng } from '../pvp/baralho.js'
import { garantirPapel, PAPEL, TINTA, Confete } from '../manual/paginaBase.js'
import { estrelaGiz, desenharTracos } from '../manual/giz.js'
import { mundoDe, faseDe, TEXTOS } from '../campanha/mundos/index.js'
import { textoMotivoCampanha } from '../campanha/recompensas.js'
import CaixaDeDialogo from '../campanha/CaixaDeDialogo.js'
import { progressoDoXp, nomeDoItem, itemDoCatalogo, NOME_TIPO } from '../../lib/progresso.js'
import { campanha, escolherNoDialogo } from '../../lib/campanha.js'

// CAMPANHA: o FIM de uma fase (docs/campanha.md). Primeiro a cena de depois (vitória) ou a de derrota
// (diálogo), depois a tela de recompensa com o que o SERVIDOR concedeu: estrelas, XP (barra do nível),
// itens novos e, ao vencer o chefe pela primeira vez, o cosmético exclusivo do mundo. Corrida suspeita
// ou abandonada: o motivo, sem recompensa.
//
//   A: voltar ao mapa · B: jogar a fase de novo
//   scene.start('CampanhaFim', { mundo, fase, fim: campanhaFim, escolhas })
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
  confete: null,
  painel: null,
  saindo: false,
  retrato: null,
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
    garantirPapel(this)
    this.add.image(0, 0, PAPEL.mesa).setOrigin(0)
    this.add.image(0, 0, PAPEL.papel).setOrigin(0)
    this.painel = this.add.container(0, 0)
    this.events.once('shutdown', () => this.caixa?.destroy())
    this.cameras.main.fadeIn(240)
    const textos = TEXTOS[this.mundo.id].fases[this.fase.id]
    const venceu = this.fim.resultado === 'vitoria'
    musica(venceu ? 'vitoria' : 'gameover', 'menu')
    const falas = venceu ? textos.depois : this.fim.resultado === 'derrota' ? textos.derrota : []
    if (!falas.length) return this.mostrarRecompensa()
    this.retrato = this.add.image(this.fase.chefe ? 600 : 620, 300, this.fase.oponente).setOrigin(0.5, 1).setScale(5).setAlpha(0.9)
    this.caixa = new CaixaDeDialogo(this, falas, {
      escolhas: { ...(dados.escolhas ?? {}), ...(get(campanha).escolhas[this.mundo.id] ?? {}) },
      aoEscolher: (chave, valor) => escolherNoDialogo(this.mundo.id, chave, valor),
      aoAcabar: () => {
        this.caixa = null
        this.retrato?.destroy()
        this.mostrarRecompensa()
      },
    })
  }

  mostrarRecompensa() {
    this.etapa = 'recompensa'
    const f = this.fim
    const venceu = f.resultado === 'vitoria'
    const estilo = (t, cor = TINTA) => ({ fontFamily: FONTE, fontSize: `${t}px`, color: cor, align: 'center' })
    const add = (o) => (this.painel.add(o), o)
    const cx = LARGURA / 2
    const titulo = venceu ? (this.fase.chefe ? `${this.mundo.nome.toUpperCase()}: COMPLETO!` : 'FASE VENCIDA!') : f.resultado === 'derrota' ? 'A FLORESTA VENCEU…' : f.resultado === 'suspeita' ? 'PARTIDA NÃO CONFIRMADA' : 'PARTIDA ABANDONADA'
    add(this.add.text(cx, 40, titulo, estilo(26, venceu ? '#2f6b3a' : '#b3162d')).setOrigin(0.5, 0))
    add(this.add.text(cx, 76, `${this.fase.chefe ? 'CHEFE' : `FASE ${this.fase.n}`} · ${this.fase.nome}${f.rodadas ? `  ·  ${f.rodadas} rodada${f.rodadas > 1 ? 's' : ''}` : ''}`, estilo(13, '#4e3f63')).setOrigin(0.5, 0))
    // as estrelas (do servidor)
    const g = add(this.add.graphics())
    const rng = criarRng('campanha:fim')
    for (let k = 0; k < 3; k++) {
      const ganhou = k < (f.estrelas ?? 0)
      const desenhar = () => desenharTracos(g, estrelaGiz(rng, cx - 70 + k * 70, 140, 26), { cor: ganhou ? 0xf2c14e : 0xc8c0b0, largura: 4, alpha: ganhou ? 1 : 0.6 })
      if (menosMovimento() || !ganhou) desenhar()
      else
        this.time.delayedCall(250 + k * 320, () => {
          desenhar()
          tocar(this, 'brilhoRank')
        })
    }
    const lista = ['★ vencer', `★ terminar com 60% do HP`, `★ em até ${this.fase.metaRodadas} rodadas`]
    add(this.add.text(cx, 178, lista.join('     '), estilo(11, '#6a5a80')).setOrigin(0.5, 0))
    // o XP e o motivo
    let y = 210
    if (venceu || f.xpGanho) {
      add(this.add.text(cx, y, `+${f.xpGanho ?? 0} XP`, estilo(24, '#2f6b3a')).setOrigin(0.5, 0))
      y += 34
      if (f.xpTotal != null) {
        const p = progressoDoXp(f.xpTotal)
        const bg = add(this.add.graphics())
        bg.fillStyle(0x2b2540, 0.85).fillRect(cx - 150, y, 300, 12)
        const alvo = 300 * (p.noNivel / p.paraProximo)
        const barra = add(this.add.rectangle(cx - 150, y, menosMovimento() ? alvo : 0, 12, 0x6dffb0).setOrigin(0))
        if (!menosMovimento()) this.tweens.add({ targets: barra, width: alvo, duration: 700, delay: 500 })
        add(this.add.text(cx, y + 16, `nível ${p.nivel}${f.nivelDepois > f.nivelAntes ? '  ·  SUBIU DE NÍVEL!' : ''}  ·  ${p.noNivel}/${p.paraProximo}`, estilo(12)).setOrigin(0.5, 0))
        y += 38
      }
    }
    const motivo = f.resultado === 'suspeita' ? `${textoMotivoCampanha('suspeita')}${MOTIVOS_SUSPEITA[f.motivo] ? `: ${MOTIVOS_SUSPEITA[f.motivo]}` : ''}` : textoMotivoCampanha(f.motivo ?? f.resultado)
    if (motivo) add(this.add.text(cx, y, motivo, estilo(12, f.resultado === 'suspeita' ? '#b3162d' : '#4e3f63')).setOrigin(0.5, 0))
    y += 26
    // itens novos (o cosmético do mundo ganha destaque)
    const itens = (f.itensNovos ?? []).map((id) => itemDoCatalogo(id)).filter(Boolean)
    const doMundo = itens.filter((i) => i.campanha)
    if (doMundo.length) {
      if (!menosMovimento()) this.confete = new Confete(this, cx, 60, { n: 60 })
      tocar(this, 'fanfarra')
      add(this.add.text(cx, y, 'RECOMPENSA EXCLUSIVA DO MUNDO', estilo(14, '#b94a78')).setOrigin(0.5, 0))
      y += 24
      doMundo.forEach((item, i) => {
        const x = cx + (i - (doMundo.length - 1) / 2) * 230
        const gg = add(this.add.graphics())
        if (item.tipo === 'moldura') gg.lineStyle(5, parseInt(item.cor.slice(1), 16), 1).strokeCircle(x - 70, y + 22, 16)
        if (item.tipo === 'verso') gg.fillStyle(parseInt(item.cor.slice(1), 16), 1).fillRoundedRect(x - 82, y + 6, 24, 34, 4)
        add(this.add.text(x - 44, y + 12, `${NOME_TIPO[item.tipo].toUpperCase()}\n${item.nome}`, { ...estilo(12), align: 'left' }))
      })
      y += 56
    }
    const outros = itens.filter((i) => !i.campanha).map((i) => nomeDoItem(i.id))
    if (outros.length) add(this.add.text(cx, y, `item novo na trilha: ${outros.join(', ')}`, estilo(12, '#2f6b3a')).setOrigin(0.5, 0))
    add(this.add.text(cx, ALTURA - 28, venceu && !this.fase.chefe ? 'A: voltar ao mapa (a próxima fase abriu!)   ·   B: jogar de novo' : 'A: voltar ao mapa   ·   B: jogar de novo', estilo(13)).setOrigin(0.5, 0))
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
    this.confete?.update(delta)
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
