import PvpArena, { LAYOUT_PVP } from './PvpArena.js'
import { tocar, pausarMusica } from '../audio.js'
import { fatores } from '../acessibilidade.js'
import { menosMovimento } from '../preferencias.js'
import { PARTIDA_DO_MANUAL, ajustarPartida, dadosDaPartida } from '../manual/partidaDoManual.js'
import { criarDicas, criarLeitorDeChuva } from '../manual/dicasDaPartida.js'
import { Treinador } from '../manual/treinador.js'

// O MANUAL DO RALSEI, página 5: a PARTIDA DE VERDADE (docs/manual-ralsei.md). É a PvpArena de sempre
// (regras, cartas, Pistas, CPU, K.O. e replay), com a configuração mansa de manual/partidaDoManual.js
// (a CPU mais fácil é o Ralsei, vidas menores, sem relógio, sem rodada bônus e sem morte súbita) e
// com o TREINADOR: o Ralsei de giz no canto, dando dicas (manual/dicasDaPartida.js) só quando elas se
// aplicam, a partir dos eventos reais da arena:
//   carta negada por falta de energia (apertarA) · o ataque na sua caixa vem de cima (as balas reais da
//   Pista, criarLeitorDeChuva) · você levou dano e a vida ficou baixa (aplicarAcerto) · você passou
//   (escolher) · rodada nova (inicioDaRodada)
// Nada de regra nova: estes ganchos só olham e contam.
//
// Vem do caderno (scenes/ManualRalsei5.js) com { cortina: true }: a arena abre por baixo da folha e só
// começa (a abertura "VOCÊ vs CPU") quando o caderno chama abrir(), depois de a folha descolar. No fim,
// em vez da PvpResultado, o caderno volta por cima com o resultado (irParaResultado).
//   B: sair para o índice do manual (pede confirmação: a Pausa já abre no "TEM CERTEZA?")
//   C: pausa (SAIR vai para o índice do manual; RECOMEÇAR começa esta partida de novo, sem a cortina)
// No dev: window.manualRalsei5Partida (e window.pvpArena: setHp, setEnergia, forcarMao, estadoDebug).

export const CHAVE_PARTIDA = 'ManualRalsei5Partida'
const { PISTA, CENTROS, PASSAR } = LAYOUT_PVP

// para onde as setas do treinador apontam (de -> para), nas posições da arena
const ALVOS = {
  vida: { de: { x: 236, y: 98 }, para: { x: 150, y: 46 } }, // a barra de vida do P1 (HudPvp)
  energia: { de: { x: 150, y: 112 }, para: { x: 92, y: 64 } }, // as gemas do P1
  passar: { de: { x: 470, y: 340 }, para: { x: PASSAR[0].x + 12, y: PASSAR[0].y - 40 } }, // o PASSAR do P1
  caixa: { de: { x: CENTROS[0] + 150, y: PISTA.y - PISTA.altura / 2 - 34 }, para: { x: CENTROS[0] + 40, y: PISTA.y - PISTA.altura / 2 + 6 } }, // o alto da sua caixa
}

// A instância da cena é REAPROVEITADA pelo Phaser: tudo volta ao inicial no começo do init().
const estadoInicial = () => ({
  dicas: null,
  leitorChuva: null,
  treinador: null,
  cortina: null,
  abrirCortina: null,
  cortinaAberta: false,
  calmo: false,
  // da PvpArena, mexidos aqui também (o create da PvpArena os refaz)
  saindo: false,
  pausado: false,
  bonusProximo: null,
  bonusPendente: null,
})

export default class ManualRalsei5Partida extends PvpArena {
  constructor() {
    super(CHAVE_PARTIDA)
  }

  // dados: os de dadosDaPartida() e { cortina } (vem do caderno: espera abrir())
  init(dados) {
    super.init(dadosDaPartida(dados ?? {}))
    Object.assign(this, estadoInicial())
    this.cortina = dados?.cortina ? new Promise((r) => (this.abrirCortina = r)) : null
    this.cortinaAberta = !this.cortina
  }

  create() {
    this.calmo = menosMovimento() || fatores().tremor === 0
    this.dicas = criarDicas()
    this.leitorChuva = criarLeitorDeChuva()
    super.create()
    this.textoTreino.setText('MANUAL DO RALSEI · CPU fácil')
    this.treinador = new Treinador(this, { calmo: this.calmo, alvos: ALVOS })
    if (import.meta.env.DEV) window.manualRalsei5Partida = this
    this.events.once('shutdown', () => {
      if (window.manualRalsei5Partida === this) delete window.manualRalsei5Partida
    })
  }

  // a folha do caderno descolou: a partida começa
  abrir() {
    this.cortinaAberta = true
    this.abrirCortina?.()
  }

  async partida() {
    if (this.cortina) await this.cortina
    if (this.saindo) return
    return super.partida()
  }

  // ---------- a configuração mansa (manual/partidaDoManual.js) ----------

  ladoDaCpu() {
    return 1 // mesmo com dois controles: o Ralsei é a CPU
  }

  nivelDaCpu() {
    return PARTIDA_DO_MANUAL.nivel
  }

  criarEstado() {
    return ajustarPartida(super.criarEstado())
  }

  // sem rodada bônus nem morte súbita (ficam para a partida normal)
  prepararBonus() {
    this.bonusProximo = null
    this.bonusPendente = null
  }

  atualizarAceleracao() {
    this.indicadorVelocidade.set(1, false)
    return false
  }

  // ---------- os eventos reais que viram dicas ----------

  apertarA(j) {
    const m = this.ladoDoControle(j)
    const livre = this.fase === 'escolha' && this.escolhas[m] === undefined && !this.noPassar[m] && m !== this.cpu
    const carta = livre ? this.maos[m].selecionada : null
    const bloqueio = carta ? this.podeJogarAgora(m, carta.dados.id).bloqueio : null
    super.apertarA(j)
    if (bloqueio) this.dicas.evento({ tipo: 'negada', codigo: bloqueio.codigo })
  }

  // B: sair para o índice (com confirmação); no meio da partida, nunca "desfazer"
  apertarB() {
    this.pausar(undefined, { confirmar: true })
  }

  escolher(m, id, opcoes) {
    super.escolher(m, id, opcoes)
    if (m !== this.cpu && id === null) this.dicas.evento({ tipo: 'passou' })
  }

  async escolha() {
    const fim = super.escolha()
    this.dica.setText('←/→ escolher   A: confirmar   B: sair   C: pausa')
    return fim
  }

  async inicioDaRodada() {
    await super.inicioDaRodada()
    if (!this.saindo) this.dicas.evento({ tipo: 'rodada', rodada: this.estado.rodada })
  }

  async esquiva(r) {
    this.leitorChuva.reiniciar()
    return super.esquiva(r)
  }

  aplicarAcerto(j, dano) {
    const ok = super.aplicarAcerto(j, dano)
    if (ok && j !== this.cpu) {
      const jog = this.estado.jogadores[j]
      this.dicas.evento({ tipo: 'dano', hp: jog.hp, hpMax: jog.hpMax })
    }
    return ok
  }

  update(tempo, deltaReal) {
    super.update(tempo, deltaReal)
    if (!this.dicas) return
    // o ataque na SUA caixa (a do seu coração) vem de cima? (as balas de verdade que nascem nela)
    if (this.fase === 'esquiva') {
      const pista = this.pistas[this.pistaDe(0)]
      if (pista?.rodando && this.leitorChuva.ver(pista.balas.lista, pista.caixa.limites)) this.dicas.evento({ tipo: 'deCima' })
    }
    const lento = this.fimDePartida && this.fimDePartida.estado !== 'jogo'
    this.dicas.tick(deltaReal, { fase: this.fase, bloqueado: this.pausado || this.saindo || !this.cortinaAberta || lento })
    for (const e of this.dicas.drenar()) {
      if (e.tipo === 'mostrar') {
        this.treinador.mostrar(e.dica)
        tocar(this, 'texto')
      } else this.treinador.esconder()
    }
    this.treinador.update(tempo, deltaReal)
  }

  // ---------- pausa e saída: o índice do manual ----------

  podePausar() {
    return this.fase !== 'resultado' && !this.saindo && !this.pausado && this.cortinaAberta
  }

  pausar(motivo, { confirmar = false } = {}) {
    if (!this.podePausar() || this.time.now - this.retomadoEm < 200) return
    this.pausado = true
    pausarMusica()
    this.scene.pause()
    this.scene.launch('Pausa', {
      cena: CHAVE_PARTIDA,
      recomecar: dadosDaPartida(),
      sair: 'GuiaEntrada',
      dadosSair: { modo: 'indice' },
      subtitulo: confirmar ? 'sair para o índice do manual?' : 'Manual do Ralsei · página 5',
      motivo,
      confirmarSaida: confirmar,
    })
    this.scene.bringToTop('Pausa')
  }

  // fim da partida: o caderno volta por cima, com o resultado (1 = você, 2 = a CPU, 0 = empate)
  async irParaResultado(v) {
    if (this.saindo) return
    this.saindo = true
    this.dicas.fechar()
    this.treinador.esconder()
    this.scene.launch('ManualRalsei5', { resultado: { vencedor: v }, deArena: true })
    this.scene.bringToTop('ManualRalsei5')
  }
}
