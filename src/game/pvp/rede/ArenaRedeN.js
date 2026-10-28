import ArenaRedeCoopN from '../../coop/ArenaRedeCoopN.js'
import { iniciarRodadaFfa, fimDaRodadaFfa, eliminarFfa, aplicarAusente } from '../ffa.js'

// A ponte da PvpArenaN (TODOS CONTRA TODOS, 3 e 4 jogadores; docs/rede-pvp.md "Todos contra todos"). É a
// ponte do CO-OP de 3 e 4 (coop/ArenaRedeCoopN.js: estrela pelo host, jogadas ao host, PRONTO, dano/graze
// conferidos e repassados pelo host, pacote de corações, volta de um convidado na rodada seguinte, retomada
// da 2D) com as regras do pvp/ffa.js e UMA CAIXA POR JOGADOR (pistas[vaga]): a minha é de verdade, as dos
// outros são espelho (pista.espelho) e o coração de cada uma anda pelas posições que o host junta.
//
//   host -> todos   inicio {estado, eventos}       o rodízio da rodada (estado.alvos) vai junto: os alvos
//                                                  aparecem ANTES da escolha. eventos: voltou / saiu
//                   fimRodada {estado, eliminados, fim, restam, ausentes}
//                                                  ausentes = [{ j, dano }]: quem estava SEM CONEXÃO levou o
//                                                  ataque inteiro (pvp/ffa.js aplicarAusente)
//   o resto (jogada, pronto, resolucao, coracao/coracoes, dano, graze, fimEsquiva, resultadoPronto, debug)
//   como na ArenaRedeCoopN.
//
// Quem cai da rede NÃO LEVA VANTAGEM: enquanto está fora não ataca (passa sem o +1), não ganha a energia
// da rodada e o ataque que vinha para ele vale como acertos cheios (o host aplica no fim da rodada). Volta
// na rodada seguinte com o HP que tem. Não voltou em 20 s: o host o ELIMINA na hora (a colocação é a
// daquele momento: pvp/ffa.js eliminarFfa 'saiu').
const DEBUG_FFA = new Set(['forcarMao', 'setHp', 'setEnergia'])

export default class ArenaRedeN extends ArenaRedeCoopN {
  constructor(arena, opcoes) {
    super(arena, opcoes)
    this.debugPermitido = new Set(DEBUG_FFA)
  }

  // o host espera a jogada de quem está vivo
  precisaJogar(j) {
    return !this.arena.estado.jogadores[j].eliminado
  }

  // ---------- começo da rodada ----------

  async iniciarRodada() {
    const a = this.arena
    if (this.souHost) {
      this.guardarPonto()
      const { ausentes, saiu } = this.presenca()
      const eventos = []
      for (const j of saiu) if (eliminarFfa(a.estado, j, 'saiu')) eventos.push({ tipo: 'saiu', j })
      const antes = a.estado.jogadores.map((jog) => jog.ausente)
      iniciarRodadaFfa(a.estado, { ausentes })
      a.estado.jogadores.forEach((jog, j) => antes[j] && !jog.ausente && !jog.eliminado && eventos.push({ tipo: 'voltou', j }))
      this.enviar('inicio', a.estado.rodada, { estado: structuredClone(a.estado), eventos })
      return eventos
    }
    const msg = await this.esperar('inicio', a.estado.rodada + 1)
    if (!msg) return null
    this.trocarEstado(msg.estado, 'inicio', { conferir: false }) // (a presença é do host)
    return msg.eventos ?? []
  }

  // ---------- fim da rodada ----------

  // Host: quem estava sem conexão leva o ataque inteiro, quem zerou é eliminado, e manda o estado.
  // ausentes: [{ j, caixa, jaLevou }] (a arena sabe o que cada um levou nesta rodada)
  async fimDaRodada(ausentes = []) {
    const a = this.arena
    const rodada = this.rodada
    if (this.souHost) {
      const aplicados = ausentes.map(({ j, caixa, jaLevou }) => ({ j, dano: aplicarAusente(a.estado, j, caixa, jaLevou) })).filter((x) => x.dano > 0)
      const fim = fimDaRodadaFfa(a.estado)
      this.enviar('fimRodada', rodada, { estado: structuredClone(a.estado), ...fim, ausentes: aplicados })
      return { ...fim, ausentes: aplicados }
    }
    const msg = await this.esperar('fimRodada', rodada)
    if (!msg) return null
    this.trocarEstado(msg.estado, 'fimRodada', { conferir: false })
    return { eliminados: msg.eliminados ?? [], fim: msg.fim ?? null, restam: msg.restam ?? [], ausentes: msg.ausentes ?? [] }
  }

  // ---------- corações: uma caixa por jogador ----------

  marcarEspelhos() {
    this.arena.pistas?.forEach((pista, k) => {
      const espelho = k !== this.meu
      if (pista.espelho === espelho) return
      pista.espelho = espelho
      this.espelhos[k]?.limpar()
    })
  }

  atualizar(delta) {
    const a = this.arena
    // não voltou em 20 s: eliminado NA HORA (a colocação é a deste momento)
    if (this.souHost) for (const j of this.presenca().saiu) if (eliminarFfa(a.estado, j, 'saiu')) a.aoSaiu?.(j)
    const agora = this.agora()
    const rodada = this.rodada
    if (this.rodadaEspelho !== rodada) {
      this.rodadaEspelho = rodada
      this.espelhos.forEach((e) => e.limpar())
      this.ultimas = {}
    }
    if (!a.pistas) return
    this.marcarEspelhos()
    a.pistas.forEach((pista, k) => {
      const coracao = pista.coracoes[0]
      if (k === this.meu || !pista.aberta || !coracao?.ativo) return
      const p = this.espelhos[k].posicao(agora)
      if (!p) return
      coracao.x = p.x
      coracao.y = p.y
      coracao.ajustar()
    })
    this.envioCoracao += delta
    const pista = a.pistas[this.meu]
    const meu = pista?.coracoes[0]
    if (this.envioCoracao < 33 || !pista?.aberta || !meu?.ativo) return
    this.envioCoracao = 0
    const arred = (v) => Math.round(v * 10) / 10
    if (!this.souHost) return this.enviarRapido('coracao', { x: arred(meu.x), y: arred(meu.y), r: rodada })
    const c = [[this.meu, arred(meu.x), arred(meu.y)]]
    for (const [vaga, p] of Object.entries(this.ultimas)) if (p.r === rodada) c.push([Number(vaga), arred(p.x), arred(p.y)])
    this.enviarRapido('coracoes', { r: rodada, c })
  }
}
