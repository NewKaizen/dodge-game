import Phaser from 'phaser'
import Controles from '../controles.js'
import { CHEFES } from '../coop/chefes/index.js'
import { criarFundo } from '../backgrounds/index.js'
import { ESCALA } from '../arte/texturas.js'
import { tocar, musica } from '../audio.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'
import { canal, emRede, souHostDaRede, irParaCena } from '../rede.js'
import { partidaOnline, voltarAoLobbyOnline } from '../online.js'
import { destinoDoFim, dadosDoFim } from '../party/cliente.js'
import { prepararXpCoop, mostrarPainelXp } from '../conta/painelXp.js'
import { semLigaduras } from '../campanha/texto.js'
import { chuvaConfete } from '../effects/festa.js'
import { formatarTempo } from '../coop/nota.js'
import { RELIQUIAS } from '../coop/reliquias.js'
import { NOME_ETAPA, ETAPAS, criarExpedicao, expedicaoValida, relatoDaExpedicao, CHEFOES } from '../coop/expedicao.js'
import { desenharMapaExpedicao } from '../coop/expedicaoCena.js'
import { itemDaExpedicao, cosmeticoDaExpedicao } from '../../lib/cosmeticos.js'
import { previaDe } from '../cosmeticosSlots.js'
import { XP_EXPEDICAO } from '../../lib/expedicao.js'

// O FIM da EXPEDIÇÃO (docs/coop-cartas.md "Expedição"): completa (venceu o chefão) ou não (caiu numa luta).
// Mostra o mapa (até onde o time chegou), as melhorias, o tempo e as RECOMPENSAS: em rede (com conta) o resultado
// vai ao servidor uma vez (prepararXpCoop com `expedicao`) e ele soma o XP das lutas vencidas, o bônus de
// completar, a chance de baú (1 por dia por chefão) e, na 1ª vez contra cada chefão, o verso exclusivo dele.
// Fora da rede (contra a CPU aliada) não tem recompensa (como a LUTA RÁPIDA contra a CPU): a tela diz.
//   A: REVANCHE (uma expedição nova, mesmo chefão e nível) · B: MENU. Numa sala: A volta ao lobby (o host leva
//   todos; o convidado pede, como na Vitoria).
//   scene.start('ExpedicaoFim', { expedicao, estatisticas })
const estadoInicial = () => ({
  exp: null,
  stats: null,
  fundo: null,
  controles: null,
  rede: false,
  naSala: false,
  saindo: false,
  liberado: false,
  xp: null,
  linhaExp: null,
})

export default class ExpedicaoFim extends Phaser.Scene {
  constructor() {
    super('ExpedicaoFim')
  }

  init(dados) {
    Object.assign(this, estadoInicial())
    this.exp = expedicaoValida(dados?.expedicao) ? dados.expedicao : null
    this.stats = dados?.estatisticas ?? null
  }

  create() {
    if (!this.exp) return this.scene.start('Menu')
    const exp = this.exp
    const venceu = exp.resultado === 'vitoria'
    this.rede = emRede()
    this.naSala = this.rede || partidaOnline()
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => this.aoBotao(botao))
    const idFundo = exp.lutas[Math.min(2, exp.no)]
    this.fundo = criarFundo(this, CHEFES[idFundo]?.fundo ?? 'king')
    this.fundo.escurecer()
    this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000, 0.4).setOrigin(0)
    desenharMapaExpedicao(this, exp, { y: 52, atual: venceu ? 3 : exp.no, perdeu: !venceu, reliquias: false })

    const t = (x, y, s, tam, cor = TEXTO.normal, extra = {}) =>
      this.add.text(x, y, semLigaduras(s), { fontFamily: FONTE, fontSize: `${tam}px`, color: cor, stroke: '#000000', strokeThickness: 4, align: 'center', ...extra }).setOrigin(0.5)

    const titulo = t(LARGURA / 2, 124, venceu ? 'EXPEDIÇÃO COMPLETA!' : 'A EXPEDIÇÃO ACABOU', 32, venceu ? '#ffd23a' : '#ff6070')
    titulo.setScale(0.4).setAlpha(0)
    this.tweens.add({ targets: titulo, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' })
    const chegou = venceu ? `o time venceu as 3 lutas e derrotou ${CHEFES[exp.chefao]?.nome ?? exp.chefao}` : `vocês chegaram até: ${NOME_ETAPA[ETAPAS[exp.no]]} (luta ${exp.no + 1} de 3) · ${exp.vencidas} vencida${exp.vencidas === 1 ? '' : 's'}`
    t(LARGURA / 2, 156, chegou, 13, TEXTO.normal, { strokeThickness: 3 })

    // o chefão (no lado) e o resumo
    const def = CHEFES[venceu ? exp.chefao : exp.lutas[exp.no]]
    if (def?.sprite) {
      const s = this.add.image(140, 270, def.sprite).setScale(ESCALA.chefe * 0.75)
      if (venceu) s.setAlpha(0.55).setTint(0x8080a0)
    }
    const tempo = (exp.tempos ?? []).reduce((a, b) => a + b, 0) + (venceu ? 0 : this.stats?.tempoMs ?? 0)
    const linhas = [
      `lutas vencidas: ${exp.vencidas} de 3`,
      `tempo: ${formatarTempo(tempo)}`,
      `melhorias: ${exp.reliquias.length ? exp.reliquias.map((id) => RELIQUIAS[id]?.nome ?? id).join(', ') : 'nenhuma'}`,
    ]
    t(LARGURA / 2 + 60, 214, linhas.join('\n'), 13, TEXTO.normal, { lineSpacing: 6, strokeThickness: 3, wordWrap: { width: 470 } })

    // as recompensas
    const RX = LARGURA / 2 + 30 // o texto das recompensas (à direita fica a carta do verso exclusivo)
    this.add.rectangle(LARGURA / 2 + 60, 340, 520, 108, CORES.painel, 0.9).setStrokeStyle(2, 0x5a4a30)
    const item = cosmeticoDaExpedicao(exp.chefao)
    if (item) {
      previaDe(this, 'verso', item.registro, LARGURA / 2 + 280, 340, 92, 5)
      t(LARGURA / 2 + 280, 384, item.nome, 10, '#ffc070', { strokeThickness: 3 }).setDepth(6)
    }
    t(RX, 300, 'RECOMPENSAS', 13, '#ffc070', { strokeThickness: 3 })
    this.xp = prepararXpCoop(this, { vitoria: venceu, estatisticas: { turnos: exp.rodadas ?? this.stats?.turnos ?? null, tempoMs: Date.now() - (exp.inicio ?? Date.now()) }, expedicao: relatoDaExpedicao(exp) })
    if (this.xp) {
      mostrarPainelXp(this, this.xp, { x: RX, y: 324 })
      this.linhaExp = t(RX, 372, 'contando as recompensas da expedição…', 11, TEXTO.desabilitado, { strokeThickness: 3 })
      const antes = this.xp.aoChegar
      this.xp.aoChegar = () => {
        antes?.()
        this.mostrarRecompensaExp()
      }
      this.mostrarRecompensaExp()
    } else {
      t(RX, 342, ['Recompensas só na expedição ONLINE (com conta):', `+${XP_EXPEDICAO.porLuta} XP por luta vencida, +${XP_EXPEDICAO.completa} ao completar,`, `chance de baú e, na 1ª vez, o verso ${item?.nome ?? 'exclusivo'}.`].join('\n'), 11, TEXTO.normal, { lineSpacing: 4, strokeThickness: 3 })
    }

    t(LARGURA / 2, ALTURA - 22, this.naSala ? 'A: voltar ao lobby' : 'A: revanche (expedição nova)     B: menu', 13, TEXTO.desabilitado, { strokeThickness: 2 })
    if (this.rede && souHostDaRede()) {
      const parar = canal.ao('voltarLobby', () => this.voltarAoLobby())
      this.events.once('shutdown', parar)
    }
    if (venceu) {
      tocar(this, 'vitoria')
      chuvaConfete(this, 1)
      musica('vitoria')
    } else tocar(this, 'gameover')
    this.time.delayedCall(900, () => (this.liberado = true))
    if (import.meta.env.DEV) window.expedicaoFim = this
    this.events.once('shutdown', () => window.expedicaoFim === this && delete window.expedicaoFim)
    this.cameras.main.fadeIn(300)
  }

  // o que o servidor mandou da expedição (na recompensa: `expedicao { xp, bau, cosmetico, cosmeticoNovo }`)
  mostrarRecompensaExp() {
    const r = this.xp?.recompensa
    if (!this.linhaExp?.active) return
    if (!r) {
      if (this.xp?.motivo) this.linhaExp.setText(semLigaduras('sem recompensa da expedição (sem conta ou fora do registro)'))
      return
    }
    const e = r.expedicao
    if (!e) return this.linhaExp.setText(semLigaduras('a expedição não foi conferida pelo servidor: só o XP de sempre'))
    const partes = [`+${e.xp ?? 0} XP da expedição`]
    if (e.bau) partes.push('BAÚ GANHO!')
    else if (e.completa) partes.push(e.bauHoje ? 'o baú deste chefão já saiu hoje' : 'sem baú desta vez')
    if (e.cosmetico) partes.push(e.cosmeticoNovo ? `NOVO VERSO: ${itemDaExpedicao(e.cosmetico)?.nome ?? e.cosmetico}!` : 'o verso deste chefão já é seu')
    this.linhaExp.setText(semLigaduras(partes.join(' · '))).setColor(e.bau || e.cosmeticoNovo ? '#ffd23a' : TEXTO.normal)
  }

  aoBotao(botao) {
    if (this.saindo || !this.liberado) return
    if (this.naSala) return this.voltarAoLobby()
    this.saindo = true
    tocar(this, 'confirmar')
    this.cameras.main.fadeOut(250, 0, 0, 0)
    if (botao === 'A') {
      const e = this.exp
      const nova = criarExpedicao({ chefe: e.sorteada ? 'sorteada' : CHEFOES.includes(e.escolhido) ? e.escolhido : e.chefao, nivel: e.nivel, party: e.party, semente: `exp:${Date.now()}` })
      return this.time.delayedCall(260, () => this.scene.start('Expedicao', { expedicao: nova }))
    }
    this.time.delayedCall(260, () => this.scene.start('Menu'))
  }

  voltarAoLobby() {
    if (this.saindo) return
    this.saindo = true
    tocar(this, 'confirmar')
    this.cameras.main.fadeOut(250, 0, 0, 0)
    if (this.rede && !souHostDaRede()) return canal.enviar('voltarLobby', null, {})
    this.time.delayedCall(260, () => (this.rede ? irParaCena(this, destinoDoFim(), dadosDoFim(this)) : voltarAoLobbyOnline(this)))
  }

  update(_, delta) {
    this.controles?.atualizar()
    this.fundo?.atualizar(delta)
  }
}
