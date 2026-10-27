import ArenaRede, { copiar } from '../pvp/rede/ArenaRede.js'
import { iniciarRodadaCoop, fimDaRodadaCoop } from './regras.js'

// A CoopArena EM REDE (docs/rede-pvp.md, seção do CO-OP): a mesma ponte da
// PvpArena (pvp/rede/ArenaRede.js: esperas, escolha, cursor, dano/graze, o
// coração do outro interpolado, fimEsquiva, debug), com as regras do CO-OP e o
// QUADRO ÚNICO:
//   - o HOST é dono do `estado` (coop/regras.js) e de toda decisão: a carta do
//     chefe (o sorteio sai do RNG que mora no estado), a resolução, o
//     contra-ataque (calcularGolpes), a fase nova do chefe e o fim da luta. O
//     convidado recebe o resultado e uma cópia do estado nos pontos de
//     sincronia (inicio, resolucao, contra, fimRodada)
//   - cada PC é dono do PRÓPRIO coração: o quadro roda nos dois PCs com a mesma
//     semente, mas aqui só o meu coração anda pelo joystick e colide; o do outro
//     é ESPELHO (coracao.espelho, na mesma pista): anda pelas posições que
//     chegam (`coracao`, k = 0) e não colide aqui. O dano dele (já com o escudo
//     dele) e os grazes chegam por `dano`/`graze`
//
// Mensagens novas (chave = rodada): inicio { estado, eventos }, resolucao
// { jogadas, resultado, estado }, contra { golpes, combo }, fimRodada { estado,
// vencedor, novaFase }. O resto (jogada, cursor, coracao, dano, graze,
// fimEsquiva, resultadoPronto, debug) é o da PvpArena; o debug ganha o
// setHpChefe.
export default class ArenaRedeCoop extends ArenaRede {
  constructor(arena, opcoes) {
    super(arena, opcoes)
    this.debugPermitido.add('setHpChefe')
    this.debugPermitido.delete('forcarBonus') // o CO-OP não tem rodada bônus
  }

  // ---------- o quadro único ----------

  // a pista 0 (o quadro) tem os dois corações: sempre tem o do outro
  pistaEspelho(k) {
    return k === 0
  }

  coracaoEspelho(k) {
    return this.arena.pistas[k]?.coracoes[this.outroLado] ?? null
  }

  // no quadro só o coração do outro é espelho (a pista em si é de verdade)
  marcarEspelhos() {
    for (const pista of this.arena.pistas) pista.coracoes.forEach((c, j) => (c.espelho = j === this.outroLado))
  }

  // ---------- começo da rodada ----------

  // Host: iniciarRodadaCoop (a carta do chefe sai do RNG do estado) e manda o
  // estado com os eventos (quem voltou, SUPER do chefe). Convidado: faz a mesma
  // conta só para conferir e fica com a do host. Devolve os eventos (null: a arena saiu)
  async iniciarRodada() {
    const a = this.arena
    if (this.souHost) {
      this.guardarPonto()
      const eventos = iniciarRodadaCoop(a.estado)
      this.canal.enviar('inicio', a.estado.rodada, { estado: copiar(a.estado), eventos })
      return eventos
    }
    const rodada = a.estado.rodada + 1
    const msg = await this.esperar('inicio', rodada)
    if (!msg) return null
    iniciarRodadaCoop(a.estado)
    this.trocarEstado(msg.estado, 'inicio')
    return msg.eventos ?? []
  }

  // ---------- resolução ----------

  enviarResolucao(jogadas, resultado) {
    this.canal.enviar('resolucao', this.rodada, { jogadas, resultado, estado: copiar(this.arena.estado) })
  }

  // Convidado: o resultado de resolverRodadaCoop que o host calculou (null: a arena saiu)
  async receberResolucao() {
    const msg = await this.esperar('resolucao', this.rodada)
    if (!msg) return null
    this.trocarEstado(msg.estado, 'resolucao', { conferir: false })
    return msg.resultado
  }

  // ---------- contra-ataque ----------

  // Host: os golpes da rodada (calcularGolpes, com o desempenho dos dois que já
  // chegou: o fimEsquiva do outro vem depois de todo dano/graze dele)
  // (combo: 'super' | 'par' | 'combo' | null, comboDosGolpes com quem está de pé no host)
  enviarContra(golpes, combo) {
    this.canal.enviar('contra', this.rodada, { golpes, combo })
  }

  // Convidado: { golpes, combo } do host (null: a arena saiu)
  async receberContra() {
    const msg = await this.esperar('contra', this.rodada)
    return msg ? { golpes: msg.golpes ?? [], combo: msg.combo ?? null } : null
  }

  // ---------- fim da rodada ----------

  // Host: fimDaRodadaCoop e manda o estado. Convidado: confere e fica com o do host.
  // Devolve { vencedor, novaFase } (null: a arena saiu)
  async fimDaRodada() {
    const a = this.arena
    const rodada = this.rodada
    if (this.souHost) {
      const fim = fimDaRodadaCoop(a.estado)
      this.canal.enviar('fimRodada', rodada, { estado: copiar(a.estado), ...fim })
      return fim
    }
    fimDaRodadaCoop(a.estado)
    const msg = await this.esperar('fimRodada', rodada)
    if (!msg) return null
    this.trocarEstado(msg.estado, 'fimRodada')
    return { vencedor: msg.vencedor ?? null, novaFase: msg.novaFase ?? null }
  }
}
