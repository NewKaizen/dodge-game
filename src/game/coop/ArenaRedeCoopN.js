import { iniciarRodadaCoop, fimDaRodadaCoop, definirPresenca } from './regras.js'
import { diferencasDeEstado, criarEspelhoCoracao } from '../pvp/rede/sincronia.js'

// A ponte da CoopArenaN (CO-OP de 3 e 4 jogadores, docs/rede-pvp.md "CO-OP de 3 e 4"): a mesma
// divisão da 2D e da ArenaRedeCoop (o HOST decide toda regra; cada PC é dono do PRÓPRIO coração),
// mas na ESTRELA da 5A: um convidado só fala com o host, e o host repassa o que os outros
// precisam ver. Lógica pura (sem Phaser): a arena passa as funções que ela precisa e os testes
// ligam várias pontes por canais de verdade (src/game/coop/__tests__/redeN.test.js).
//
//   convidado -> host   jogada {jogada}          a minha carta (ou null: passei), uma vez por rodada
//                       coracao (rápida)         { x, y, r }: o meu coração no quadro
//                       dano / graze             { lado, dano|n, r }: o que ACERTOU o meu coração
//                       fimEsquiva               { acertos, ko, r }: o meu quadro acabou
//                       resultadoPronto          a animação do fim acabou aqui
//   host -> todos       inicio / resolucao / contra / fimRodada     como na ArenaRedeCoop, com N jogadores
//                       pronto {j}               o jogador j já escolheu (o PRONTO do cartão dele; ninguém vê a carta)
//                       coracoes (rápida)        { r, c: [[vaga, x, y], ...] }: UM pacote por tick com todos os corações
//                       dano / graze / fimEsquiva   o que o host recebeu de cada convidado, repassado (e o dele)
//                       debug                    (dev) forcarMao/setHp/... valem em todos os PCs
//
// Só o host aplica o que chega de um convidado (confere que `lado` é a vaga de quem mandou) e repassa
// na mesma ordem em que recebeu: o dano e os grazes de um convidado chegam a todos antes do
// fimEsquiva dele (o canal é em ordem por parceiro). O host nunca espera quem não está: quem caiu da
// rede (`caiu`, os 20 s) ou saiu não entra nas esperas (jogada = passar, fimEsquiva dispensado) e o
// estado marca `ausente`/`saiu` a cada rodada (definirPresenca): fora do quadro, sem mira.
//
// Volta de um convidado no meio da luta (5A: game/rede.js voltarVaga): o host manda a cena só para ele,
// com `dadosRetomadaPara(id)` (o estado de agora do host); ele entra na PRÓXIMA rodada (espera o
// `inicio` seguinte ao estado que recebeu; o que sobrar da rodada atual ele ignora).

const ENVIO_CORACAO_MS = 33
const ATRASO_ESPELHO_MS = 100
const ESPERA_PEDACO_MS = 500
const ESPERA_AVISO_MS = 30000
const ESPERA_FIM_MS = 15000 // a esquiva de cada um acaba junto; um PC travado não segura os outros mais que isto
const ESPERA_RESULTADO_MS = 20000
const FOLGA_JOGADAS_MS = 4000 // o host espera as jogadas até o relógio dos outros + isto
const DEBUG_PERMITIDO = new Set(['forcarMao', 'setHp', 'setEnergia', 'setHpChefe'])

export const copiar = (estado) => structuredClone(estado)
const PARADA = new Promise(() => {})
const dorme = (ms) => new Promise((r) => setTimeout(r, ms))

export default class ArenaRedeCoopN {
  // arena: { estado, saindo, fase, pistas, acertosRodada, ko, sys, aplicarAcerto(j, dano), aplicarGraze(j),
  //          extrasRetomada?() }; participantes(): [{ indice, id, nome, caiu }] (game/rede.js)
  constructor(arena, { canal, meuIndice, souHost, participantes, agora = () => performance.now(), dev = false }) {
    this.arena = arena
    this.canal = canal
    this.meu = meuIndice
    this.souHost = souHost
    this.participantes = participantes
    this.agora = agora
    this.n = arena.estado.n
    this.rodadaDaLuta = null
    this.pendentes = []
    this.fimEnviado = false
    this.jogadas = new Map() // host: rodada -> { vaga: id | null }
    this.fins = new Map() // rodada -> { vaga: { acertos, ko } }
    this.ultimas = {} // host: o último coração de cada convidado { x, y, r }
    this.envioCoracao = 0
    this.espelhos = Array.from({ length: this.n }, () => criarEspelhoCoracao({ atrasoMs: ATRASO_ESPELHO_MS }))
    this.rodadaEspelho = null
    this.aplicandoDebug = false
    this.debugPermitido = new Set(DEBUG_PERMITIDO)
    this.ponto = null // host: o começo da rodada atual (retomada da 2D)
    this.entrouNaRodada = 0 // quem voltou no meio da luta: ignora tudo até esta rodada (inclusive)
    this.prontosResultado = new Map() // host: rodada -> Set(id) dos convidados cuja animação do fim acabou
    this.destruido = false

    this.desligar = [
      canal.ao('jogada', (d, _c, de) => this.aoJogada(d, de)),
      canal.ao('pronto', (d) => this.aoPronto(d)),
      canal.ao('coracao', (d, _c, de) => this.aoCoracao(d, de)),
      canal.ao('coracoes', (d) => this.aoCoracoes(d)),
      canal.ao('dano', (d, _c, de) => this.aoEvento('dano', d, de)),
      canal.ao('graze', (d, _c, de) => this.aoEvento('graze', d, de)),
      canal.ao('fimEsquiva', (d, _c, de) => this.aoFim(d, de)),
      canal.ao('resultadoPronto', (_d, rodada, de) => this.souHost && this.prontosResultado.set(rodada, (this.prontosResultado.get(rodada) ?? new Set()).add(de))),
    ]
    if (dev) this.desligar.push(canal.ao('debug', (d) => this.aoDebug(d)))
  }

  destruir() {
    this.destruido = true
    this.desligar.forEach((fn) => fn())
    this.desligar = []
    this.pendentes = []
  }

  enviar(tipo, chave, dados) {
    if (!this.destruido) this.canal.enviar(tipo, chave, dados)
  }

  enviarRapido(tipo, dados) {
    if (!this.destruido) this.canal.enviarRapido(tipo, dados)
  }

  get rodada() {
    return this.arena.estado.rodada
  }

  // ---------- quem é quem ----------

  vagaDe(id) {
    return this.participantes().find((p) => p.id === id)?.indice ?? -1
  }

  idDe(vaga) {
    return this.participantes().find((p) => p.indice === vaga)?.id ?? null
  }

  // quem está de fora da luta agora: caiu da rede (volta em até 20 s) ou saiu de vez
  presenca() {
    const lista = this.participantes()
    const ausentes = []
    const saiu = []
    for (let j = 0; j < this.n; j++) {
      const p = lista.find((x) => x.indice === j)
      if (!p) saiu.push(j)
      else if (p.caiu != null) ausentes.push(j)
    }
    return { ausentes, saiu }
  }

  // j está fora agora (a conexão dele caiu, ou ele saiu)? Vale no meio da rodada
  fora(j) {
    const { ausentes, saiu } = this.presenca()
    return ausentes.includes(j) || saiu.includes(j)
  }

  // ---------- esperas e estado ----------

  // espera a mensagem (tipo, chave) do host; null se a arena saiu antes
  async esperar(tipo, chave) {
    const inicio = Date.now()
    let aviso = inicio + ESPERA_AVISO_MS
    while (!this.arena.saindo) {
      if (this.destruido) return PARADA
      const dados = await this.canal.receber(tipo, chave, { timeoutMs: ESPERA_PEDACO_MS })
      if (this.destruido) return PARADA
      if (dados) return dados
      if (Date.now() >= aviso) {
        aviso += ESPERA_AVISO_MS
        console.warn(`[rede] esperando '${tipo}' (rodada ${chave}) há ${Math.round((Date.now() - inicio) / 1000)} s`)
      }
    }
    return this.destruido ? PARADA : null
  }

  // espera a condição (ou o tempo): devolve true se a condição veio
  async esperarAte(condicao, ms) {
    const fim = Date.now() + ms
    while (!condicao()) {
      if (this.destruido) return PARADA
      if (this.arena.saindo || Date.now() >= fim) return false
      await dorme(25)
    }
    return true
  }

  trocarEstado(estado, onde, { conferir = true } = {}) {
    if (!estado) return
    if (conferir) {
      const diferencas = diferencasDeEstado(this.arena.estado, estado)
      if (diferencas.length) console.warn('[rede] estado divergiu', { onde, rodada: estado.rodada, diferencas })
    }
    this.arena.estado = estado
  }

  // ---------- retomada (2D: o host voltou a rodada) e volta de UM convidado (5A) ----------

  guardarPonto() {
    const a = this.arena
    this.ponto = { estado: copiar(a.estado), extra: copiar(a.extrasRetomada?.() ?? {}) }
  }

  dadosRetomada() {
    const { retomada: _velha, ...base } = this.arena.sys.settings.data ?? {}
    return this.ponto ? { ...base, retomada: copiar(this.ponto) } : base
  }

  // a cena que o host manda SÓ para o convidado `id` que caiu e voltou: o estado de agora (ele entra na
  // próxima rodada)
  dadosRetomadaPara(_id) {
    const a = this.arena
    const { retomada: _velha, ...base } = a.sys.settings.data ?? {}
    return { ...base, retomada: { estado: copiar(a.estado), extra: copiar(a.extrasRetomada?.() ?? {}), entrando: true } }
  }

  aplicarRetomada(r) {
    if (!r?.estado) return false
    const a = this.arena
    a.estado = copiar(r.estado)
    Object.assign(a, copiar(r.extra ?? {}))
    if (r.entrando) this.entrouNaRodada = a.estado.rodada
    else if (this.souHost) this.ponto = copiar(r)
    return true
  }

  // ---------- começo da rodada ----------

  // Host: marca quem está fora (rede), inicia a rodada (a carta do chefe, a mira) e manda o estado.
  // Convidado: faz a mesma conta para conferir e fica com a do host. Devolve os eventos (null: saiu)
  async iniciarRodada() {
    const a = this.arena
    if (this.souHost) {
      this.guardarPonto()
      definirPresenca(a.estado, this.presenca())
      const eventos = iniciarRodadaCoop(a.estado)
      this.enviar('inicio', a.estado.rodada, { estado: copiar(a.estado), eventos })
      return eventos
    }
    const rodada = a.estado.rodada + 1
    const msg = await this.esperar('inicio', rodada)
    if (!msg) return null
    iniciarRodadaCoop(a.estado)
    this.trocarEstado(msg.estado, 'inicio', { conferir: false }) // (a presença é do host: não dá para conferir)
    return msg.eventos ?? []
  }

  // ---------- escolha ----------

  comecarEscolha() {
    if (!this.jogadas.has(this.rodada)) this.jogadas.set(this.rodada, {}) // (a jogada de um convidado pode ter chegado antes)
    for (const r of [...this.jogadas.keys()]) if (r < this.rodada - 2) this.jogadas.delete(r)
  }

  // a MINHA jogada: o host guarda e avisa a todos (PRONTO); o convidado manda ao host
  enviarJogada(id) {
    if (this.souHost) return this.registrarJogada(this.rodada, this.meu, id ?? null)
    this.enviar('jogada', this.rodada, { jogada: id ?? null, r: this.rodada })
  }

  registrarJogada(rodada, vaga, id) {
    const mapa = this.jogadas.get(rodada) ?? {}
    if (vaga in mapa) return // a primeira vale
    mapa[vaga] = id
    this.jogadas.set(rodada, mapa)
    this.enviar('pronto', rodada, { j: vaga, r: rodada })
    this.arena.marcarPronto?.(vaga)
  }

  aoJogada(d, de) {
    if (!this.souHost || !d || this.arena.saindo) return
    const vaga = this.vagaDe(de)
    if (vaga < 0 || vaga === this.meu) return
    this.registrarJogada(d.r ?? this.rodada, vaga, typeof d.jogada === 'string' ? d.jogada : null)
  }

  aoPronto(d) {
    if (this.souHost || !d || d.r !== this.rodada || d.j === this.meu || this.arena.saindo) return
    this.arena.marcarPronto?.(d.j)
  }

  // Host: as jogadas de todos que estão (a minha entra por enviarJogada). Quem não está, ou não jogou a
  // tempo, passa. Devolve [id | null] por vaga
  async juntarJogadas(tempoMs) {
    const rodada = this.rodada
    const todas = () => this.jogadas.get(rodada) ?? {}
    const faltam = () => Array.from({ length: this.n }, (_, j) => j).filter((j) => !(j in todas()) && !this.fora(j) && !this.arena.estado.jogadores[j].caido)
    await this.esperarAte(() => faltam().length === 0, tempoMs + FOLGA_JOGADAS_MS)
    if (this.destruido) return PARADA
    const mapa = todas()
    const faltou = faltam()
    if (faltou.length) console.warn('[rede] sem jogada a tempo: passa', { rodada, vagas: faltou })
    return Array.from({ length: this.n }, (_, j) => mapa[j] ?? null)
  }

  // jogada que não vale aqui (estado divergiu? quem caiu da rede?) vira passar, senão resolverRodadaCoop estoura
  validarJogadas(jogadas, podeJogarAgora) {
    return jogadas.map((id, j) => {
      if (id == null || podeJogarAgora(j, id).ok) return id ?? null
      console.warn('[rede] jogada inválida vira PASSAR', { vaga: j, id })
      return null
    })
  }

  // ---------- resolução ----------

  enviarResolucao(jogadas, resultado) {
    this.enviar('resolucao', this.rodada, { jogadas, resultado, estado: copiar(this.arena.estado) })
  }

  async receberResolucao() {
    const msg = await this.esperar('resolucao', this.rodada)
    if (!msg) return null
    this.trocarEstado(msg.estado, 'resolucao', { conferir: false })
    return msg.resultado
  }

  // ---------- esquiva ----------

  // A esquiva desta rodada começou aqui: o que os outros mandaram antes (eles começaram primeiro) vale agora
  comecarLuta() {
    this.rodadaDaLuta = this.rodada
    this.fimEnviado = false
    this.fins.set(this.rodada, this.fins.get(this.rodada) ?? {})
    this.marcarEspelhos()
    const agora = this.pendentes.filter((p) => p.dados?.r === this.rodada)
    this.pendentes = this.pendentes.filter((p) => p.dados?.r > this.rodada)
    for (const { tipo, dados } of agora) this.aplicarDoOutro(tipo, dados)
  }

  // o meu coração pode levar dano/graze aqui? (o dos outros chega pela rede)
  ehMeu(j) {
    return j === this.meu && !this.fimEnviado
  }

  enviarDano(j, dano) {
    this.enviar('dano', null, { lado: j, dano, r: this.rodada })
  }

  enviarGraze(j) {
    this.enviar('graze', null, { lado: j, n: 1, r: this.rodada })
  }

  aoEvento(tipo, d, de) {
    if (!d || this.arena.saindo || d.r <= this.entrouNaRodada) return
    if (this.souHost) {
      // um convidado diz o que aconteceu com o coração DELE; o host confere, repassa e aplica
      const vaga = this.vagaDe(de)
      if (vaga < 0 || d.lado !== vaga || vaga === this.meu) return console.warn(`[rede] ${tipo} de quem não é dono do coração: ignorado`, { de, d })
      this.enviar(tipo, null, d) // repasse, na mesma ordem em que chegou
    } else if (d.lado === this.meu) return // o repasse do meu próprio dano: já apliquei
    if (d.lado === this.meu) return
    if (d.r === this.rodadaDaLuta && d.r === this.rodada) return this.aplicarDoOutro(tipo, d)
    if (d.r >= this.rodada) this.pendentes.push({ tipo, dados: d })
  }

  // dano/graze do coração de outro jogador: as regras daqui (escudo, 2ª chance, K.O.) e, no quadro, o
  // coração dele pisca como pisca no PC dele
  aplicarDoOutro(tipo, { lado, dano, n = 1 }) {
    const a = this.arena
    if (tipo === 'dano') return void a.aplicarAcerto(lado, dano, { doOutro: true })
    for (let k = 0; k < n; k++) a.aplicarGraze(lado, { doOutro: true })
  }

  // Terminei a MINHA parte (a promessa do quadro): aviso e espero o fim de todos que estão no quadro
  // (aí já chegou todo o dano/graze deles). `no[j]` = j estava no quadro nesta rodada
  async esperarFimEsquiva(promessa, no) {
    const rodada = this.rodada
    await promessa
    if (this.destruido) return PARADA
    await this.avisarFim(rodada, no)
    if (this.destruido) return PARADA
    const completa = () => {
      const fins = this.fins.get(rodada) ?? {}
      return no.every((dentro, j) => !dentro || j === this.meu || j in fins || this.fora(j))
    }
    const ok = await this.esperarAte(completa, ESPERA_FIM_MS)
    if (ok === false && !this.arena.saindo) console.warn('[rede] fim da esquiva: alguém não respondeu, seguindo', { rodada, fins: this.fins.get(rodada) })
  }

  async avisarFim(rodada, no) {
    if (this.destruido) return PARADA
    const a = this.arena
    this.fimEnviado = true
    if (!no[this.meu]) return
    const dados = { acertos: a.acertosRodada[this.meu], ko: Boolean(a.ko[this.meu]), lado: this.meu, r: rodada }
    this.registrarFim(rodada, this.meu, dados)
    this.enviar('fimEsquiva', rodada, dados) // o host manda a todos; o convidado, ao host (que repassa)
  }

  registrarFim(rodada, vaga, dados) {
    const fins = this.fins.get(rodada) ?? {}
    fins[vaga] = { acertos: dados.acertos, ko: dados.ko }
    this.fins.set(rodada, fins)
    for (const r of [...this.fins.keys()]) if (r < rodada - 2) this.fins.delete(r)
  }

  aoFim(d, de) {
    if (!d || this.arena.saindo || d.r <= this.entrouNaRodada) return
    if (this.souHost) {
      const vaga = this.vagaDe(de)
      if (vaga < 0 || d.lado !== vaga || vaga === this.meu) return
      this.enviar('fimEsquiva', d.r, d) // repasse
    } else if (d.lado === this.meu) return
    const a = this.arena.estado.jogadores
    if (d.lado === this.meu || !a[d.lado]) return
    this.registrarFim(d.r, d.lado, d)
  }

  // ---------- contra-ataque e fim da rodada ----------

  enviarContra(golpes, combo) {
    this.enviar('contra', this.rodada, { golpes, combo })
  }

  async receberContra() {
    const msg = await this.esperar('contra', this.rodada)
    return msg ? { golpes: msg.golpes ?? [], combo: msg.combo ?? null } : null
  }

  // Host: fimDaRodadaCoop (com a rodada limpa para o resgate) e manda o estado. Convidado: espera o do host
  async fimDaRodada(limpa) {
    const a = this.arena
    const rodada = this.rodada
    if (this.souHost) {
      const fim = fimDaRodadaCoop(a.estado, limpa)
      this.enviar('fimRodada', rodada, { estado: copiar(a.estado), ...fim })
      return fim
    }
    const msg = await this.esperar('fimRodada', rodada)
    if (!msg) return null
    this.trocarEstado(msg.estado, 'fimRodada', { conferir: false })
    return { vencedor: msg.vencedor ?? null, novaFase: msg.novaFase ?? null, resgatados: msg.resgatados ?? [] }
  }

  // Fim da partida, depois da animação: o convidado avisa e espera o host trocar a cena (false); o host
  // espera os convidados que estão (true)
  async prontoParaResultado() {
    const rodada = this.rodada
    if (!this.souHost) {
      this.enviar('resultadoPronto', rodada, {})
      return false
    }
    const faltam = () => this.participantes().filter((p) => p.indice !== this.meu && p.caiu == null && !this.prontosResultado.get(rodada)?.has(p.id))
    await this.esperarAte(() => faltam().length === 0, ESPERA_RESULTADO_MS)
    if (this.destruido) return PARADA
    return !this.arena.saindo
  }

  // ---------- corações (todo frame) ----------

  marcarEspelhos() {
    const pista = this.arena.pistas?.[0]
    if (!pista) return
    pista.coracoes.forEach((c, j) => (c.espelho = j !== this.meu))
  }

  aoCoracao(d, de) {
    if (!this.souHost || !d || d.r !== this.rodada) return
    const vaga = this.vagaDe(de)
    if (vaga < 0 || vaga === this.meu) return
    this.ultimas[vaga] = { x: d.x, y: d.y, r: d.r }
    this.espelhos[vaga]?.receber(this.agora(), d)
  }

  aoCoracoes(d) {
    if (this.souHost || !d || d.r !== this.rodada || !Array.isArray(d.c)) return
    const t = this.agora()
    for (const [vaga, x, y] of d.c) if (vaga !== this.meu) this.espelhos[vaga]?.receber(t, { x, y })
  }

  atualizar(delta) {
    const a = this.arena
    const agora = this.agora()
    const rodada = this.rodada
    if (this.rodadaEspelho !== rodada) {
      this.rodadaEspelho = rodada
      this.espelhos.forEach((e) => e.limpar())
      this.ultimas = {}
    }
    const pista = a.pistas?.[0]
    if (!pista) return
    this.marcarEspelhos()
    pista.coracoes.forEach((coracao, j) => {
      if (j === this.meu || !pista.aberta || !coracao.ativo) return
      const p = this.espelhos[j].posicao(agora)
      if (!p) return
      coracao.x = p.x
      coracao.y = p.y
      coracao.ajustar()
    })
    this.envioCoracao += delta
    const meu = pista.coracoes[this.meu]
    if (this.envioCoracao < ENVIO_CORACAO_MS || !pista.aberta || !meu?.ativo) return
    this.envioCoracao = 0
    const arred = (v) => Math.round(v * 10) / 10
    if (!this.souHost) return this.enviarRapido('coracao', { x: arred(meu.x), y: arred(meu.y), r: rodada })
    // o host junta os corações de todos num pacote só (5A: UM pacote por tick para todos)
    const c = [[this.meu, arred(meu.x), arred(meu.y)]]
    for (const [vaga, p] of Object.entries(this.ultimas)) if (p.r === rodada) c.push([Number(vaga), arred(p.x), arred(p.y)])
    this.enviarRapido('coracoes', { r: rodada, c })
  }

  // ---------- dev ----------

  espalhar(acao, args) {
    if (this.aplicandoDebug || !this.debugPermitido.has(acao)) return
    this.enviar('debug', null, { acao, args })
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
