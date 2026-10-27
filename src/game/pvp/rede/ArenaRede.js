import { iniciarRodada, fimDaRodada } from '../regras.js'
import { TEMPOS } from '../../constants.js'
import { tocar } from '../../audio.js'
import { particulas } from '../../effects/particulas.js'
import { diferencasDeEstado, criarEspelhoCoracao } from './sincronia.js'

// A PvpArena EM REDE (docs/rede-pvp.md, seção da arena): cada PC roda a arena
// inteira, desvia na própria caixa sem atraso, e só as decisões viajam pelo
// canal (game/rede.js). A arena cria isto quando abre com emRede() e chama nos
// pontos abaixo; sem rede, this.rede é null e nada daqui roda.
//
// Autoridade:
//   - o HOST é dono do `estado` (pvp/regras.js) e de todo sorteio de regra
//     (bônus, cartas malucas, arma do duelo, roubo...). O convidado recebe o
//     resultado e uma cópia do estado nos pontos de sincronia (inicio,
//     resolucao, fimRodada) e troca o dele por ela (avisa no console se divergiu)
//   - cada PC é dono do PRÓPRIO coração: simula a caixa onde ele está (no
//     CORAÇÃO TROCADO, a do outro), aplica dano/graze nele na hora e manda
//     `dano`/`graze`; o que chega do outro é aplicado aqui com as regras, sem
//     ser mandado de volta
//   - a outra caixa é ESPELHO (pista.espelho): roda o mesmo ataque com a mesma
//     semente, mas o coração de lá anda pelas posições que chegam (`coracao`,
//     rápida, ~30/s, interpolado com sincronia.js) e não colide aqui
//
// Mensagens (chave = rodada): inicio, jogada, cursor (rápida), resolucao,
// coracao (rápida), dano, graze, fimEsquiva, fimRodada, resultadoPronto e,
// no dev, debug (forcarMao/setHp/... valem nos dois PCs).
//
// Esperas: esperar(tipo, chave) pede ao canal em pedaços curtos e desiste
// quando a arena sai (o outro saiu: game/rede.js tira os dois da cena).
//
// Retomada (Fase 2D, game/rede.js): o HOST guarda o PONTO DE RETOMADA no
// começo de cada rodada, antes de iniciá-la (`ponto`: o estado das regras, com
// o RNG, HP, energia, mãos e baralhos como as regras guardam, e os extras da
// arena: estatísticas, último bônus...). Alguém caiu e voltou: o host abre a
// arena de novo nos dois com dadosRetomada() (os dados de sempre + `retomada`),
// e cada PC troca o estado novo pelo do ponto (aplicarRetomada) e pula a
// abertura: a rodada recomeça do zero, com a mesma mão (o RNG é o mesmo).
//
// A CoopArena (CO-OP de cartas) usa esta mesma ponte estendida
// (coop/ArenaRedeCoop.js): as esperas, a escolha, o dano/graze e o coração do
// outro são os mesmos; mudam as regras da rodada e ONDE está o coração do
// outro (pistaEspelho / coracaoEspelho / marcarEspelhos: lá os dois corações
// estão no mesmo quadro, e só o do outro é espelho).

const ENVIO_CORACAO_MS = 33 // ~30 posições por segundo
const ATRASO_ESPELHO_MS = 100 // o coração do outro anda este tanto atrás (desliza mesmo com variação na rede)
const ESPERA_PEDACO_MS = 500
const ESPERA_AVISO_MS = 30000 // esperando há muito tempo: avisa no console (de 30 em 30 s)
const ESPERA_RESULTADO_MS = 20000 // o host espera o replay do convidado acabar no máximo isto
const DEBUG_PERMITIDO = new Set(['forcarMao', 'setHp', 'setEnergia', 'forcarBonus'])

export const copiar = (estado) => structuredClone(estado)

export default class ArenaRede {
  constructor(arena, { canal, meuLado, souHost }) {
    this.arena = arena
    this.canal = canal
    this.meuLado = meuLado
    this.outroLado = 1 - meuLado
    this.souHost = souHost
    this.rodadaDaLuta = null // rodada cuja esquiva/duelo já começou aqui (dano/graze do outro valem)
    this.pendentes = [] // dano/graze do outro que chegaram antes da esquiva começar aqui
    this.fimEnviado = false // mandei fimEsquiva: o meu coração não leva mais nada nesta rodada
    this.ultimoCursor = null
    this.envioCoracao = 0
    this.espelhos = [criarEspelhoCoracao({ atrasoMs: ATRASO_ESPELHO_MS }), criarEspelhoCoracao({ atrasoMs: ATRASO_ESPELHO_MS })]
    this.rodadaEspelho = null
    this.aplicandoDebug = false
    this.debugPermitido = new Set(DEBUG_PERMITIDO) // ações de debug que valem nos dois PCs
    this.ponto = null // host: o começo da rodada atual (retomada da 2D)

    this.desligar = [
      canal.ao('cursor', (d) => this.aoCursor(d)),
      canal.ao('coracao', (d) => this.aoCoracao(d)),
      canal.ao('dano', (d) => this.aoEventoDoOutro('dano', d)),
      canal.ao('graze', (d) => this.aoEventoDoOutro('graze', d)),
    ]
    if (import.meta.env?.DEV) this.desligar.push(canal.ao('debug', (d) => this.aoDebug(d)))
  }

  destruir() {
    this.destruido = true // as esperas desta ponte param (a cena aberta de novo tem outra)
    this.desligar.forEach((fn) => fn())
    this.desligar = []
    this.pendentes = []
  }

  get rodada() {
    return this.arena.estado.rodada
  }

  // ---------- esperas e estado ----------

  // Espera a mensagem (tipo, chave) do outro PC; null se a arena saiu antes
  async esperar(tipo, chave) {
    const inicio = Date.now()
    let aviso = inicio + ESPERA_AVISO_MS
    while (!this.arena.saindo && !this.destruido) {
      const dados = await this.canal.receber(tipo, chave, { timeoutMs: ESPERA_PEDACO_MS })
      if (dados) return dados
      if (Date.now() >= aviso) {
        aviso += ESPERA_AVISO_MS
        console.warn(`[rede] esperando '${tipo}' (rodada ${chave}) há ${Math.round((Date.now() - inicio) / 1000)} s`)
      }
    }
    return null
  }

  // Convidado: o estado do host vale. Confere com o daqui antes de trocar
  trocarEstado(estado, onde, { conferir = true } = {}) {
    if (!estado) return
    if (conferir) {
      const diferencas = diferencasDeEstado(this.arena.estado, estado)
      if (diferencas.length) console.warn('[rede] estado divergiu', { onde, rodada: estado.rodada, diferencas })
    }
    this.arena.estado = estado
  }

  // ---------- retomada (2D) ----------

  // host, no começo da rodada (antes de iniciá-la): o ponto de onde a partida volta
  guardarPonto() {
    const a = this.arena
    this.ponto = { estado: copiar(a.estado), extra: copiar(a.extrasRetomada?.() ?? {}) }
  }

  // os dados para abrir a arena de novo nos dois (sem ponto ainda: a partida do começo)
  dadosRetomada() {
    const { retomada: _velha, ...base } = this.arena.sys.settings.data ?? {}
    return this.ponto ? { ...base, retomada: copiar(this.ponto) } : base
  }

  // a arena abriu com `retomada`: o estado do começo da rodada no lugar do novo
  aplicarRetomada(r) {
    if (!r?.estado) return false
    const a = this.arena
    a.estado = copiar(r.estado)
    Object.assign(a, copiar(r.extra ?? {}))
    if (this.souHost) this.ponto = copiar(r)
    return true
  }

  // ---------- começo da rodada ----------

  // Host: inicia a rodada (energia, mãos, bônus) e manda o estado. Convidado:
  // faz a mesma conta (só para conferir) e fica com a do host
  async iniciarRodada() {
    const a = this.arena
    if (this.souHost) {
      this.guardarPonto()
      a.comecarRodada()
      this.canal.enviar('inicio', a.estado.rodada, { estado: copiar(a.estado), bonusPendente: a.bonusPendente })
      return true
    }
    const rodada = a.estado.rodada + 1
    const msg = await this.esperar('inicio', rodada)
    if (!msg) return false
    iniciarRodada(a.estado)
    this.trocarEstado(msg.estado, 'inicio')
    a.bonusProximo = null
    a.bonusPendente = msg.bonusPendente ?? null
    return true
  }

  // ---------- escolha ----------

  comecarEscolha() {
    const a = this.arena
    const rodada = this.rodada
    this.ultimoCursor = null
    this.enviarCursor()
    this.esperar('jogada', rodada).then((msg) => {
      if (!msg || a.saindo || a.fase !== 'escolha' || a.estado.rodada !== rodada) return
      if (a.escolhas[this.outroLado] !== undefined) return
      this.mostrarJogadaDoOutro(msg.jogada ?? null)
    })
  }

  // a carta que o outro confirmou: o cursor dele vai até ela e ela vira (como no local)
  mostrarJogadaDoOutro(id) {
    const a = this.arena
    const o = this.outroLado
    const mao = a.maos[o]
    const i = id ? mao.cartas.findIndex((c) => c.dados.id === id) : -1
    if (i >= 0) {
      a.noPassar[o] = false
      mao.selecionar(i)
    } else if (id) console.warn('[rede] a carta jogada pelo outro não está na mão daqui', id)
    a.escolher(o, id, { remoto: true })
  }

  enviarJogada(id) {
    this.canal.enviar('jogada', this.rodada, { jogada: id ?? null })
  }

  // cursor da MINHA mão (só manda quando muda)
  enviarCursor() {
    const a = this.arena
    const m = this.meuLado
    if (a.fase !== 'escolha' || a.escolhas[m] !== undefined) return
    const indice = a.maos[m].indice
    const passar = Boolean(a.noPassar[m])
    const ultimo = this.ultimoCursor
    if (ultimo && ultimo.indice === indice && ultimo.passar === passar && ultimo.r === this.rodada) return
    this.ultimoCursor = { indice, passar, r: this.rodada }
    this.canal.enviarRapido('cursor', { tela: 'arena', indice, passar, r: this.rodada })
  }

  aoCursor(d) {
    const a = this.arena
    const o = this.outroLado
    if (!d || d.tela !== 'arena' || a.saindo || a.fase !== 'escolha' || d.r !== this.rodada || a.escolhas[o] !== undefined) return
    a.noPassar[o] = Boolean(d.passar)
    if (!d.passar) a.maos[o].selecionar(d.indice)
    a.atualizarEscolha()
  }

  // ---------- resolução ----------

  // Host: jogada que não vale aqui (estado divergiu?) vira passar, senão resolverRodada estoura
  validarJogadas(jogadas) {
    return jogadas.map((id, j) => {
      if (id == null || this.arena.podeJogarAgora(j, id).ok) return id ?? null
      console.warn('[rede] jogada inválida vira PASSAR', { lado: j, id })
      return null
    })
  }

  enviarResolucao(jogadas, decisao) {
    const { bonus, adiado, resultado } = decisao
    this.canal.enviar('resolucao', this.rodada, { jogadas, bonus, adiado, resultado, estado: copiar(this.arena.estado) })
  }

  // Convidado: o que o host resolveu (evento, malucas, resultado) e o estado depois
  async receberResolucao() {
    const a = this.arena
    const msg = await this.esperar('resolucao', this.rodada)
    if (!msg) return null
    a.bonusPendente = null
    a.bonus = msg.bonus ? a.eventoDaArena(msg.bonus) : null
    if (msg.bonus) a.bonusAnterior = msg.bonus
    // a resolução é só do host: não tem conta daqui para conferir
    this.trocarEstado(msg.estado, 'resolucao', { conferir: false })
    return { bonus: msg.bonus ?? null, adiado: Boolean(msg.adiado), resultado: msg.resultado }
  }

  // ---------- esquiva e duelo ----------

  // O meu coração pode levar dano/graze aqui? (o do outro chega pela rede)
  ehMeu(j) {
    return j === this.meuLado && !this.fimEnviado
  }

  // A esquiva (ou o duelo) desta rodada começou aqui: o que o outro mandou
  // antes disso (ele começou primeiro) vale agora
  comecarLuta() {
    this.rodadaDaLuta = this.rodada
    this.fimEnviado = false
    this.marcarEspelhos() // CORAÇÃO TROCADO acabou de trocar os corações de caixa
    const agora = this.pendentes.filter((p) => p.dados?.r === this.rodada)
    this.pendentes = this.pendentes.filter((p) => p.dados?.r > this.rodada)
    for (const { tipo, dados } of agora) this.aplicarDoOutro(tipo, dados)
  }

  enviarDano(j, dano) {
    this.canal.enviar('dano', null, { lado: j, dano, r: this.rodada })
  }

  enviarGraze(j) {
    this.canal.enviar('graze', null, { lado: j, n: 1, r: this.rodada })
  }

  aoEventoDoOutro(tipo, dados) {
    if (!dados || this.arena.saindo) return
    if (dados.lado !== this.outroLado) return console.warn(`[rede] ${tipo} do outro para o meu coração: ignorado`, dados)
    if (dados.r === this.rodadaDaLuta && dados.r === this.rodada) return this.aplicarDoOutro(tipo, dados)
    if (dados.r >= this.rodada) this.pendentes.push({ tipo, dados }) // a luta desta rodada ainda não começou aqui
  }

  // Dano/graze do coração do outro: as regras daqui (escudo, 2ª chance, K.O.)
  // e, na caixa espelho, o coração dele pisca como pisca lá
  aplicarDoOutro(tipo, { lado, dano, n = 1 }) {
    const a = this.arena
    const coracao = a.fase === 'esquiva' ? a.coracaoDoLado(lado) : null
    if (tipo === 'dano') {
      if (!a.aplicarAcerto(lado, dano)) return
      if (coracao?.ativo) {
        coracao.tomarDano(TEMPOS.invencivelMs)
        particulas(a, coracao.x, coracao.y, { cor: coracao.cor, quantidade: 10, velocidade: 110 })
        tocar(a, 'dano')
      }
    } else {
      for (let k = 0; k < n; k++) a.aplicarGraze(lado)
      if (coracao?.ativo) coracao.piscarGraze()
    }
  }

  // Terminei a MINHA caixa (a promessa da pista onde está o meu coração): aviso
  // o outro e espero o fim da dele e das duas caixas daqui. O dano/graze dele
  // chega antes do fimEsquiva dele (canal em ordem): depois daqui os dois
  // têm os mesmos acertos e K.O.s (desvio perfeito igual nos dois)
  async esperarFimEsquiva(promessas) {
    const a = this.arena
    const rodada = this.rodada
    await (promessas[a.pistaDe(this.meuLado)] ?? null)
    await this.avisarFim(rodada)
    await Promise.all(promessas.filter(Boolean))
  }

  // depois do duelo / CTRL+C CTRL+V: o mesmo encontro (todo o dano do outro já chegou)
  async esperarFimLuta() {
    await this.avisarFim(this.rodada)
  }

  async avisarFim(rodada) {
    const a = this.arena
    this.fimEnviado = true
    this.canal.enviar('fimEsquiva', rodada, { acertos: a.acertosRodada[this.meuLado], ko: Boolean(a.ko[this.meuLado]) })
    const dele = await this.esperar('fimEsquiva', rodada)
    if (dele && (dele.acertos !== a.acertosRodada[this.outroLado] || Boolean(dele.ko) !== Boolean(a.ko[this.outroLado])))
      console.warn('[rede] acertos do outro divergiram', { rodada, dele, aqui: { acertos: a.acertosRodada[this.outroLado], ko: a.ko[this.outroLado] } })
  }

  // ---------- coração (todo frame) ----------

  atualizar(delta) {
    const a = this.arena
    const agora = performance.now()
    const rodada = this.rodada
    if (this.rodadaEspelho !== rodada) {
      this.rodadaEspelho = rodada
      this.espelhos.forEach((e) => e.limpar())
    }
    this.marcarEspelhos()
    a.pistas.forEach((pista, k) => {
      const coracao = this.coracaoEspelho(k)
      if (!coracao || !pista.aberta) return
      const p = this.espelhos[k].posicao(agora)
      if (!p || !coracao.ativo) return
      coracao.x = p.x
      coracao.y = p.y
      coracao.ajustar() // dentro da caixa daqui (as duas mudam de forma quase juntas)
    })
    // o meu coração, para a caixa espelho do outro
    this.envioCoracao += delta
    const k = a.pistaDe(this.meuLado)
    const meu = a.coracaoDoLado(this.meuLado)
    if (this.envioCoracao < ENVIO_CORACAO_MS || !a.pistas[k]?.aberta || !meu?.ativo) return
    this.envioCoracao = 0
    this.canal.enviarRapido('coracao', { x: Math.round(meu.x * 10) / 10, y: Math.round(meu.y * 10) / 10, k, r: rodada })
  }

  // a pista k tem o coração do outro? (no PvP: a caixa do outro; com CORAÇÃO TROCADO, a minha)
  pistaEspelho(k) {
    return this.arena.donoDaPista(k) !== this.meuLado
  }

  // o coração do outro na pista k (null: ela não é espelho aqui)
  coracaoEspelho(k) {
    const pista = this.arena.pistas[k]
    return pista?.espelho ? pista.coracoes[0] : null
  }

  // a caixa onde está o coração do outro é espelho aqui
  marcarEspelhos() {
    this.arena.pistas.forEach((pista, k) => {
      const espelho = this.pistaEspelho(k)
      if (pista.espelho === espelho) return
      pista.espelho = espelho
      this.espelhos[k].limpar()
    })
  }

  aoCoracao(d) {
    if (!d || d.r !== this.rodada) return
    // a caixa k tem que ser espelho aqui (na virada do CORAÇÃO TROCADO os dois PCs trocam quase juntos)
    if (!this.pistaEspelho(d.k)) return
    this.espelhos[d.k]?.receber(performance.now(), d)
  }

  // ---------- fim ----------

  // Host: fimDaRodada e manda o estado. Convidado: confere e fica com o do host
  async fimDaRodada() {
    const a = this.arena
    const rodada = this.rodada
    if (this.souHost) {
      const vencedor = fimDaRodada(a.estado)
      this.canal.enviar('fimRodada', rodada, { estado: copiar(a.estado), vencedor })
      return vencedor
    }
    fimDaRodada(a.estado)
    const msg = await this.esperar('fimRodada', rodada)
    if (!msg) return null
    this.trocarEstado(msg.estado, 'fimRodada')
    return msg.vencedor ?? null
  }

  // Fim da partida, depois do replay: o convidado avisa e espera o host trocar
  // a cena nos dois (false); o host espera o replay do convidado acabar (true)
  async prontoParaResultado() {
    const rodada = this.rodada
    if (!this.souHost) {
      this.canal.enviar('resultadoPronto', rodada, {})
      return false
    }
    const fim = Date.now() + ESPERA_RESULTADO_MS
    while (!this.arena.saindo && !this.destruido && Date.now() < fim) {
      if (await this.canal.receber('resultadoPronto', rodada, { timeoutMs: ESPERA_PEDACO_MS })) break
    }
    return !this.arena.saindo && !this.destruido
  }

  // opções do Duelo/Copia (contrato com a parte C em docs/rede-pvp.md)
  opcoesDuelo() {
    return { canal: this.canal, meuLado: this.meuLado, souHost: this.souHost, rodada: this.rodada }
  }

  // ---------- dev ----------

  // forcarMao/setHp/setEnergia valem nos dois PCs (senão o estado diverge);
  // forcarBonus vale no host (quem decide o bônus)
  espalhar(acao, args) {
    if (this.aplicandoDebug || !this.debugPermitido.has(acao)) return
    this.canal.enviar('debug', null, { acao, args })
  }

  aoDebug({ acao, args } = {}) {
    if (!this.debugPermitido.has(acao) || this.arena.saindo) return
    this.aplicandoDebug = true
    try {
      this.arena[acao](...(args ?? []))
    } finally {
      this.aplicandoDebug = false
    }
  }
}
