// CAMPANHA (modo história, single-player): o SERVIDOR roda a partida (docs/campanha.md).
//
// Diferente do PVP em rede (o host decide e o servidor só compara relatos, server/partidas.js), aqui
// o servidor é a autoridade: a luta é contra um CHEFE com as regras do CO-OP (src/game/campanha/luta.js
// sobre coop/regras.js): ele guarda a mão e a energia, tira a carta do chefe, escolhe a jogada da CPU
// aliada, sorteia a semente do ataque e aplica o dano e os golpes. O navegador só manda:
//   * a carta de cada rodada (conferida com a mão e a energia que o SERVIDOR tem), e
//   * a posição do coração a CADA PASSO da esquiva (campanha/amostras.js), em pedaços.
// Com as posições o servidor confere a plausibilidade (velocidade, caixa, teleporte, tempo) e REFAZ
// o quadro inteiro (campanha/quadro.js: o ataque de verdade da carta do chefe, você e a aliada). O dano é o maior entre o que ele achou e o que o navegador
// relatou (o relato só pode piorar para quem relata). Corrida suspeita: sem recompensa, com o motivo
// no log (e no banco), e o servidor segue de pé.
//
//   cliente -> servidor  campanha {acao: 'progresso'}
//                        campanha {acao: 'comecar', mundo, fase}
//                        campanha {acao: 'carta', corrida, carta: id | null}
//                        campanha {acao: 'posicoes', corrida, rodada, seq, a: [t, x, y, ...]}
//                        campanha {acao: 'fimEsquiva', corrida, rodada, acertos}
//                        campanha {acao: 'escolha', mundo, chave, valor}
//                        campanha {acao: 'desistir', corrida}
//   servidor -> cliente  campanhaProgresso {fases, escolhas, xpHoje, teto}
//                        campanhaInicio {corrida, mundo, fase, rodada}
//                        campanhaEsquiva {corrida, rodada, jogadas, intencao, destino, efeitos, esquiva, ...}
//                        campanhaRodada {corrida, resumo, proxima}
//                        campanhaFim {corrida, resultado, motivo, estrelas, xpGanho, ..., progresso}
//                        campanhaErro {motivo, msg, corrida?}
//
// DESAFIO DIÁRIO (Fase 4A, docs/desafio-diario.md): a MESMA corrida, com a luta montada pela definição
// do dia (src/lib/desafio.js, pelo relógio DESTE servidor; vira à meia-noite de São Paulo). Convidado
// também joga (sem recompensa e sem recorde). No fim, conceder_desafio (0013) grava os pontos que o
// SERVIDOR calculou (campanha/luta.js resumoDaLuta) e dá a recompensa principal UMA vez por dia.
//   cliente -> servidor  campanha {acao: 'desafio'}                     o estado do dia
//                        campanha {acao: 'comecarDesafio', dia}         (dia: o que a tela mostra)
//                        (e as mesmas carta / posicoes / fimEsquiva / desistir)
//   servidor -> cliente  desafioEstado {dia, desafio, convidado, recorde, concluido, diasSemana, meta,
//                                       cosmetico, cosmeticoGanho, amigos, xp, restanteMs}
//                        campanhaInicio {..., desafio: id} · campanhaFim {..., desafio: {...}}
// CONQUISTAS (4B, server/conquistas.js): no fim de cada corrida com conta, um evento (`conquistas`).
//
// Queda de conexão: a corrida é ABANDONADA na hora (sem recompensa). É single-player: não há outro
// lado esperando, e retomar uma esquiva no meio exigiria confiar no relógio do navegador.
//
//   const campanha = criarCampanha({ registro, agora, agendar, enviar, log, semente })
//   campanha.receber(cliente, m) · campanha.saiu(cliente, motivo) · campanha.fechar()
import crypto from 'node:crypto'
import { agendarPadrao } from './fila.js'
import { criarLuta, comecarRodada, jogar, concluirEsquiva, estrelasDaLuta, resumoDaLuta } from '../src/game/campanha/luta.js'
import { diaDoDesafio, desafioDoDia, cosmeticoDaSemana, XP_DESAFIO, DIAS_COSMETICO_SEMANA, ID_DIA } from '../src/lib/desafio.js'
import { msgConquistas } from './conquistas.js'
import { msgBauGanho } from './baus.js'
import { ler, MAX_AMOSTRAS_QUADRO } from '../src/game/campanha/amostras.js'
import { mundoDe, faseDe, faseLiberada, TEXTOS } from '../src/game/campanha/mundos/index.js'
import { XP_CAMPANHA_DIA } from '../src/game/campanha/recompensas.js'

export const ESCOLHA_MS = 3 * 60_000 // sem carta nesse tempo: a corrida é abandonada
export const FOLGA_ESQUIVA_MS = 20_000 // além da duração do ataque, para o fim da esquiva chegar
export const FOLGA_CHEGADA_MS = 400 // uma amostra não pode ser do "futuro" do relógio do servidor
export const MAX_PEDACO = 3 * 160 // inteiros por pedaço de posições (~2,5 s a uma por passo de 16 ms)
export const MAX_CORRIDAS = 2000

const ID = /^[A-Za-z0-9_-]{8,40}$/
const CHAVE = /^[a-z_]{1,24}$/

// o que o convidado pode pedir (o desafio diário; nada da campanha)
const ACOES_CONVIDADO = new Set(['desafio', 'comecarDesafio', 'carta', 'posicoes', 'fimEsquiva', 'desistir'])
// a hora local (São Paulo) de um instante, para a conquista da madrugada
const formatoHora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' })
const horaLocal = (ms) => Number(formatoHora.format(new Date(ms))) % 24

export function criarCampanha({ registro = null, agora = Date.now, agendar = agendarPadrao, enviar = () => {}, log = () => {}, semente = () => crypto.randomBytes(9).toString('base64url'), novoId = () => crypto.randomUUID(), conquistas = null, baus = null } = {}) {
  const corridas = new Map() // id -> corrida
  const porConta = new Map() // usuario -> id da corrida

  const erro = (c, motivo, msg, extra = {}) => enviar(c, { t: 'campanhaErro', motivo, msg, ...extra })

  function cancelarTimer(k) {
    k.timer?.()
    k.timer = null
  }

  function prazo(k, ms, motivo) {
    cancelarTimer(k)
    k.timer = agendar(() => {
      k.timer = null
      if (corridas.get(k.id) === k) encerrar(k, 'abandono', motivo)
    }, ms)
  }

  const progresso = async (usuario) => (registro?.progressoCampanha ? await registro.progressoCampanha(usuario) : { fases: [], escolhas: {}, xpHoje: 0 })

  async function mandarProgresso(c) {
    try {
      const p = await progresso(c.usuario)
      enviar(c, { t: 'campanhaProgresso', fases: p.fases ?? [], escolhas: p.escolhas ?? {}, xpHoje: p.xpHoje ?? 0, teto: XP_CAMPANHA_DIA })
    } catch (e) {
      log(`[campanha] progresso: ${e.message}`)
      erro(c, 'erro', 'não deu para carregar o progresso agora: tente de novo')
    }
  }

  // fim da corrida (uma vez): grava no banco e manda o fim ao cliente
  async function encerrar(k, resultado, motivo = null) {
    if (k.encerrada) return
    k.encerrada = true
    cancelarTimer(k)
    corridas.delete(k.id)
    if (porConta.get(k.chave) === k.id) porConta.delete(k.chave)
    if (k.desafio) return encerrarDesafio(k, resultado, motivo)
    const estrelas = resultado === 'vitoria' ? estrelasDaLuta(k.c) : 0
    const duracaoS = Math.round((agora() - k.inicio) / 1000)
    if (resultado === 'suspeita') log(`[campanha] corrida ${k.id} suspeita (${motivo}): conta ${k.usuario}, fase ${k.mundo}-${k.fase}, rodada ${k.c.estado.rodada}`)
    const fim = { t: 'campanhaFim', corrida: k.id, mundo: k.mundo, fase: k.fase, resultado, motivo, estrelas, rodadas: k.c.estado.rodada, xpGanho: 0 }
    let concedido = null
    try {
      if (registro?.concederCampanha) concedido = await registro.concederCampanha({ corrida: k.id, usuario: k.usuario, mundo: k.mundo, fase: k.fase, resultado, motivo, estrelas, rodadas: k.c.estado.rodada, duracaoS })
    } catch (e) {
      log(`[campanha] concessão da corrida ${k.id}: ${e.message}`)
      fim.motivo = resultado === 'vitoria' ? 'erro' : motivo
    }
    if (concedido) {
      Object.assign(fim, {
        xpGanho: concedido.xpGanho ?? 0,
        xpTotal: concedido.xpTotal ?? null,
        nivelAntes: concedido.nivelAntes ?? null,
        nivelDepois: concedido.nivelDepois ?? null,
        itensNovos: concedido.itensNovos ?? [],
        melhorEstrelas: concedido.melhorEstrelas ?? estrelas,
        primeira: Boolean(concedido.primeira),
      })
      if (resultado === 'vitoria') fim.motivo = concedido.motivo ?? fim.motivo
    }
    const c = k.cliente
    enviar(c, fim)
    if (resultado !== 'abandono' && c?.usuario === k.usuario) mandarProgresso(c)
    // CONQUISTAS e MAESTRIA: a corrida que o servidor viu (a Kris, o personagem do mundo)
    if (concedido && (resultado === 'vitoria' || resultado === 'derrota')) {
      bausDaCorrida(k, { nivelAntes: concedido.nivelAntes, nivelDepois: concedido.nivelDepois, jogou: true })
      const r = resumoDaLuta(k.c)
      eventoDaConta(k, { tipo: 'campanha', resultado, personagem: k.c.estado.jogadores[0].personagem, acertos: r.acertos, hpFracao: r.hpFracao, mundo: k.mundo, fase: k.fase, ultimaFase: Boolean(k.c.fase.chefe), estrelas })
    }
  }

  function eventoDaConta(k, ev) {
    if (!conquistas || !k.usuario) return
    conquistas.evento(k.usuario, `${k.desafio ? 'desafio' : 'campanha'}:${k.id}`, ev).then((r) => {
      const msg = msgConquistas(r)
      if (msg && k.cliente?.usuario === k.usuario) enviar(k.cliente, msg)
      if (r?.novas?.length) bausDaCorrida(k, { conquistas: r.novas })
    })
  }

  // BAÚS (0015, server/baus.js): nível novo, o baú do dia, a 1ª vitória do desafio e as conquistas novas
  function bausDaCorrida(k, x) {
    if (!baus || !k.usuario) return
    baus
      .depoisDoXp(k.usuario, x)
      .then((novos) => {
        const msg = msgBauGanho(novos)
        if (msg && k.cliente?.usuario === k.usuario) enviar(k.cliente, msg)
      })
      .catch((e) => log(`[baus] corrida ${k.id}: ${e.message}`))
  }

  // ---------- DESAFIO DIÁRIO ----------

  // o estado do dia para a tela: a definição (pelo relógio daqui), o recorde, a semana e os amigos
  async function mandarDesafio(c) {
    const dia = diaDoDesafio(agora())
    const msg = { t: 'desafioEstado', dia: dia.id, semana: dia.semana, restanteMs: dia.restanteMs, desafio: desafioDoDia(dia.id), convidado: !c.usuario, disponivel: Boolean(registro?.concederDesafio), xp: XP_DESAFIO, meta: DIAS_COSMETICO_SEMANA, cosmetico: cosmeticoDaSemana(dia.semana), recorde: null, concluido: false, diasSemana: 0, cosmeticoGanho: false, concluidos: 0, amigos: [] }
    if (c.usuario && registro?.estadoDesafio) {
      try {
        Object.assign(msg, await registro.estadoDesafio(c.usuario, dia.id))
      } catch (e) {
        log(`[desafio] estado: ${e.message}`)
        msg.erro = 'não deu para carregar o seu recorde agora'
      }
    }
    enviar(c, msg)
  }

  function comecarDesafio(c, m) {
    const dia = diaDoDesafio(agora())
    // a tela mostrava o desafio de ontem: o dia virou (a definição muda)
    if (typeof m.dia === 'string' && ID_DIA.test(m.dia) && m.dia !== dia.id) {
      erro(c, 'virou', 'o dia virou: já tem um desafio novo')
      return mandarDesafio(c)
    }
    if (corridas.size >= MAX_CORRIDAS) return erro(c, 'lotado', 'o servidor está lotado: tente daqui a pouco')
    const def = desafioDoDia(dia.id)
    const chave = c.usuario ?? `convidado:${c.id}`
    const velha = corridas.get(porConta.get(chave))
    if (velha) encerrar(velha, 'abandono', 'outra_corrida')
    // a semente é a do DIA (o mesmo desafio para todo mundo): o que muda entre as tentativas é você
    const k = { id: novoId(), cliente: c, usuario: c.usuario ?? null, chave, desafio: def, dia: dia.id, semana: dia.semana, mundo: 0, fase: 0, inicio: agora(), c: criarLuta({ desafio: def, semente: def.semente }), esquiva: null, timer: null, encerrada: false }
    corridas.set(k.id, k)
    porConta.set(chave, k.id)
    const rodada = comecarRodada(k.c)
    prazo(k, ESCOLHA_MS, 'sem_carta')
    enviar(c, { t: 'campanhaInicio', corrida: k.id, mundo: 0, fase: 0, desafio: def.id, rodada })
  }

  async function encerrarDesafio(k, resultado, motivo) {
    const r = resumoDaLuta(k.c)
    const conta = resultado === 'vitoria' || resultado === 'derrota'
    const pontos = conta ? r.pontos : 0
    const duracaoS = Math.round((agora() - k.inicio) / 1000)
    if (resultado === 'suspeita') log(`[desafio] corrida ${k.id} suspeita (${motivo}): conta ${k.usuario ?? 'convidado'}, dia ${k.dia}, rodada ${k.c.estado.rodada}`)
    const info = { dia: k.dia, pontos, rodadas: r.rodadas, acertos: r.acertos, grazes: r.grazes, recorde: null, novoRecorde: false, concluido: false, primeiraHoje: false, diasSemana: 0, meta: DIAS_COSMETICO_SEMANA, cosmeticoNovo: null }
    const fim = { t: 'campanhaFim', corrida: k.id, mundo: 0, fase: 0, resultado, motivo, estrelas: 0, rodadas: k.c.estado.rodada, xpGanho: 0, desafio: info }
    let concedido = null
    if (!k.usuario) fim.motivo = conta ? 'convidado' : motivo
    else if (registro?.concederDesafio) {
      try {
        concedido = await registro.concederDesafio({ corrida: k.id, usuario: k.usuario, dia: k.dia, versao: k.desafio.versao, resultado, motivo, pontos, rodadas: r.rodadas, acertos: r.acertos, duracaoS, item: cosmeticoDaSemana(k.semana) })
      } catch (e) {
        log(`[desafio] concessão da corrida ${k.id}: ${e.message}`)
        if (conta) fim.motivo = 'erro'
      }
    } else if (conta) fim.motivo = 'indisponivel'
    if (concedido) {
      Object.assign(fim, { xpGanho: concedido.xpGanho, xpTotal: concedido.xpTotal, nivelAntes: concedido.nivelAntes, nivelDepois: concedido.nivelDepois, itensNovos: concedido.itensNovos })
      Object.assign(info, { recorde: concedido.recorde, novoRecorde: concedido.novoRecorde, concluido: concedido.concluido, primeiraHoje: concedido.primeiraHoje, diasSemana: concedido.diasSemana, cosmeticoNovo: concedido.cosmeticoNovo })
      if (conta) fim.motivo = concedido.motivo ?? fim.motivo
    }
    enviar(k.cliente, fim)
    if (conta && concedido) bausDaCorrida(k, { nivelAntes: concedido.nivelAntes, nivelDepois: concedido.nivelDepois, jogou: true, desafioDia: concedido.primeiraHoje ? k.dia : null })
    if (conta && concedido)
      eventoDaConta(k, { tipo: 'desafio', resultado, personagem: k.desafio.personagem, acertos: r.acertos, hpFracao: r.hpFracao, hora: horaLocal(k.inicio), cosmeticoSemana: Boolean(concedido.cosmeticoNovo) })
  }

  const deDono = (c, m) => {
    const k = corridas.get(String(m.corrida ?? ''))
    if (!k || k.cliente !== c || k.usuario !== (c.usuario ?? null)) return null
    return k
  }

  const suspeita = (k, motivo) => encerrar(k, 'suspeita', motivo)

  async function comecar(c, m) {
    const mundo = Number(m.mundo)
    const n = Number(m.fase)
    if (!mundoDe(mundo) || !faseDe(mundo, n)) return erro(c, 'fase', 'essa fase não existe')
    if (!registro?.concederCampanha) return erro(c, 'indisponivel', 'a campanha precisa do servidor online com contas')
    if (corridas.size >= MAX_CORRIDAS) return erro(c, 'lotado', 'o servidor está lotado: tente daqui a pouco')
    if (c.carregandoCampanha) return
    c.carregandoCampanha = true
    let p
    try {
      p = await progresso(c.usuario)
    } catch (e) {
      log(`[campanha] progresso: ${e.message}`)
      return erro(c, 'erro', 'não deu para carregar o progresso agora: tente de novo')
    } finally {
      c.carregandoCampanha = false
    }
    if (!c.usuario) return erro(c, 'convidado', 'entre com sua conta para jogar a campanha')
    if (!faseLiberada(p.fases, mundo, n)) return erro(c, 'bloqueada', 'vença a fase anterior primeiro')
    // uma corrida por conta (a de outra aba é abandonada)
    const velha = corridas.get(porConta.get(c.usuario))
    if (velha) encerrar(velha, 'abandono', 'outra_corrida')
    const k = { id: novoId(), cliente: c, usuario: c.usuario, chave: c.usuario, mundo, fase: n, inicio: agora(), c: criarLuta({ mundo, fase: n, semente: semente() }), esquiva: null, timer: null, encerrada: false }
    corridas.set(k.id, k)
    porConta.set(c.usuario, k.id)
    const rodada = comecarRodada(k.c)
    prazo(k, ESCOLHA_MS, 'sem_carta')
    enviar(c, { t: 'campanhaInicio', corrida: k.id, mundo, fase: n, rodada })
  }

  function carta(c, m) {
    const k = deDono(c, m)
    if (!k) return erro(c, 'corrida', 'essa partida não existe mais', { corrida: m.corrida ?? null })
    const id = m.carta === null || m.carta === undefined ? null : typeof m.carta === 'string' && m.carta.length <= 40 ? m.carta : false
    if (id === false) return erro(c, 'carta', 'carta inválida', { corrida: k.id })
    const r = jogar(k.c, id)
    // carta que não pode (fora da mão, sem energia, fora da regra): recusada, a rodada continua
    if (!r.ok) return erro(c, 'carta', { fora_da_mao: 'essa carta não está na sua mão', sem_energia: 'falta energia para essa carta', regra: 'a regra desta fase não deixa essa carta', fora_de_hora: 'agora não é hora de escolher carta' }[r.motivo] ?? 'carta inválida', { corrida: k.id, codigo: r.motivo })
    const duracao = r.rodada.esquiva?.duracao ?? 0
    k.esquiva = { rodada: k.c.estado.rodada, entregue: agora(), duracao, pedacos: 0, lista: [], ultimoT: -1 }
    prazo(k, duracao + FOLGA_ESQUIVA_MS, 'sem_esquiva')
    enviar(c, { t: 'campanhaEsquiva', corrida: k.id, ...r.rodada })
  }

  function posicoes(c, m) {
    const k = deDono(c, m)
    const e = k?.esquiva
    if (!e || m.rodada !== e.rodada) return
    if (m.seq !== e.pedacos || !Array.isArray(m.a) || m.a.length > MAX_PEDACO || m.a.length % 3 !== 0) return suspeita(k, 'pedaco')
    if (e.lista.length + m.a.length > MAX_AMOSTRAS_QUADRO * 3) return suspeita(k, 'amostras_demais')
    const decorrido = agora() - e.entregue
    for (let i = 0; i < m.a.length; i += 3) {
      const t = m.a[i]
      if (!Number.isInteger(t) || t <= e.ultimoT) return suspeita(k, 'tempo')
      // a amostra é de um instante que o relógio do servidor ainda não viu: câmera lenta/replay pronto
      if (t > decorrido + FOLGA_CHEGADA_MS) return suspeita(k, 'futuro')
      e.ultimoT = t
    }
    e.pedacos++
    e.lista.push(...m.a)
  }

  function fimEsquiva(c, m) {
    const k = deDono(c, m)
    const e = k?.esquiva
    if (!e || m.rodada !== e.rodada) return
    const amostras = ler(e.lista, MAX_AMOSTRAS_QUADRO)
    let r
    try {
      r = concluirEsquiva(k.c, { amostras, acertosCliente: m.acertos, decorridoMs: agora() - e.entregue })
    } catch (err) {
      log(`[campanha] erro na esquiva da corrida ${k.id}: ${err.message}`)
      return suspeita(k, 'erro')
    }
    k.esquiva = null
    if (r.suspeita) return suspeita(k, r.suspeita)
    if (r.vencedor) {
      enviar(c, { t: 'campanhaRodada', corrida: k.id, resumo: r, proxima: null })
      return encerrar(k, r.vencedor === 'p1' ? 'vitoria' : 'derrota', r.vencedor === 'p1' ? null : 'derrota')
    }
    const proxima = comecarRodada(k.c)
    prazo(k, ESCOLHA_MS, 'sem_carta')
    enviar(c, { t: 'campanhaRodada', corrida: k.id, resumo: r, proxima })
  }

  async function escolha(c, m) {
    const mundo = Number(m.mundo)
    const chave = String(m.chave ?? '')
    const valor = String(m.valor ?? '')
    if (!mundoDe(mundo) || !CHAVE.test(chave) || !CHAVE.test(valor)) return
    // só escolhas que existem nos textos daquele mundo
    const existe = Object.values(TEXTOS[mundo]?.fases ?? {}).some((cena) => Object.values(cena).some((falas) => Array.isArray(falas) && falas.some((f) => f.escolha?.chave === chave && f.escolha.opcoes.some((o) => o.valor === valor))))
    if (!existe || !registro?.escolherCampanha) return
    try {
      await registro.escolherCampanha({ usuario: c.usuario, mundo, chave, valor })
    } catch (e) {
      log(`[campanha] escolha: ${e.message}`)
    }
  }

  const acoes = {
    progresso: (c) => mandarProgresso(c),
    comecar,
    desafio: (c) => mandarDesafio(c),
    comecarDesafio,
    carta,
    posicoes,
    fimEsquiva,
    escolha,
    desistir(c, m) {
      const k = deDono(c, m)
      if (k) encerrar(k, 'abandono', 'desistiu')
    },
  }

  return {
    corridas,
    receber(c, m) {
      if (!c.usuario && !ACOES_CONVIDADO.has(m.acao)) return erro(c, 'convidado', 'entre com sua conta para jogar a campanha')
      const f = acoes[m.acao]
      if (!f || !Object.hasOwn(acoes, m.acao)) return
      if (m.corrida !== undefined && m.corrida !== null && !ID.test(String(m.corrida))) return
      Promise.resolve()
        .then(() => f(c, m))
        .catch((e) => log(`[campanha] ${m.acao}: ${e.message}`))
    },
    // o cliente caiu, saiu ou trocou de conta: a corrida dele é abandonada (sem recompensa)
    saiu(c, motivo = 'caiu') {
      for (const k of [...corridas.values()]) if (k.cliente === c) encerrar(k, 'abandono', motivo)
    },
    fechar() {
      for (const k of corridas.values()) cancelarTimer(k)
      corridas.clear()
      porConta.clear()
    },
  }
}
