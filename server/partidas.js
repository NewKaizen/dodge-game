// Registro de partidas e recompensas (Fase 1D; docs/online.md, docs/supabase.md).
// PVP (Fase 1D) e CO-OP de 2 jogadores (Fase 2F) usam o mesmo caminho.
//
// O PVP em rede roda no PC de cada um (o host decide): o servidor NÃO vê a
// partida. Por isso o resultado vem dos dois clientes ("resultado") e o
// servidor decide o que vale comparando os relatos com o que ele mesmo sabe
// (quando a partida começou, quem saiu da sala e quando). Só depois disso o
// banco concede o XP (conceder_recompensa, idempotente por partida).
//
//   const partidas = criarPartidas({ registro, agora, agendar, entregar, log, versao })
//   partidas.iniciar(sala, [host, convidado])   o host começou uma partida PVP ou CO-OP (ou revanche)
//   partidas.relatar(cliente, m)                 PVP: { partidaId, vencedorLado, rodadas, duracao, personagem }
//                                                CO-OP: { partidaId, vitoria: true|false, rodadas, duracao, personagem }
//   partidas.saiu(cliente, sala, quando?)        saiu da sala (ou desconectou) por conta própria
//                                                (quando: a vaga guardada que expirou saiu quando caiu)
//   partidas.hostCaiu(sala)                      o host caiu e não voltou a tempo (Fase 2D)
//   partidas.encerrou(sala)                      o host voltou ao lobby (partida false)
//   partidas.fechar()                            cancela os timers (servidor desligando)
//
// POLÍTICA (decidir): o "fim" para o servidor é o primeiro relato que chega.
//   * os dois relatam e concordam no vencedor        -> validada (vitória/derrota ou empate)
//   * os dois relatam e discordam                    -> contestada: só participação para os dois
//   * só um relatou e o outro SAIU antes desse relato -> validada pelo relato de quem ficou;
//                                                       quem saiu não ganha nada (abandono)
//   * só um relatou e o outro continua na sala, ou saiu depois do relato (já tinha acabado)
//                                                     -> contestada: quem relatou ganha só a
//                                                        participação; o outro, nada
//   * ninguém relatou e um saiu (no meio da partida)  -> validada: vitória de quem ficou
//   * ninguém relatou e o HOST caiu sem voltar a tempo -> encerrada ('host_caiu'): sem XP
//                                                       e sem derrota para ninguém (Fase 2D)
//   * ninguém relatou e os dois saíram / acabou o prazo -> encerrada, sem XP
// CO-OP (2 jogadores, Fase 2F): a mesma política, só que o "vencedor" é o time:
// os dois relatam `vitoria` (true = derrotaram o chefe) e, concordando, os dois
// ganham `vitoria` ou os dois `derrota`; discordando, contestada (só participação).
// Diferenças: ninguém relatou e um saiu = encerrada sem XP (quem ficou não
// "venceu" ninguém: a luta não acabou); o parceiro faz o papel do "oponente" no
// limite diário (docs/online.md). Vitória do time = participação + bônus.
// O prazo para o segundo relato é RELATO_JANELA_MS; quando alguém sai sem ter
// relatado, ABANDONO_GRACA_MS (para o relato do outro que estava a caminho).
// Relato repetido não muda nada; relato depois da decisão recebe a resposta
// que já existe (ou "atrasado"). Convidado e a mesma conta dos dois lados
// nunca ganham XP. O resto dos limites (duração mínima, repetição contra o
// mesmo oponente no dia, valores de XP) mora no banco (0003_progresso.sql e
// 0005_pendencias.sql). Convidado do outro lado: a chave de repetição (`ref`)
// é por conexão do convidado, a não ser que ele venha do MESMO endereço da
// conta (aba anônima da própria conta): aí todos contam como um só ('convidado').
//
// registro: o banco (criarRegistro(supabase)) ou null (sem contas: ninguém ganha XP)
// entregar(participante, msg): manda para o cliente dele (o lobby acha o cliente,
// mesmo que tenha reconectado com a mesma conta). participante.conta = a conta
// do cliente quando a partida começou (para entregar); participante.usuario =
// quem ganha o XP (null: convidado ou a mesma conta dos dois lados)
import crypto from 'node:crypto'
import { agendarPadrao } from './fila.js'
import { METRICAS_NULA } from './metricas.js'

export const RELATO_JANELA_MS = 20_000
export const ABANDONO_GRACA_MS = 3_000
export const GUARDAR_MS = 10 * 60_000 // a decisão fica na memória (relato repetido/atrasado)
export const MAX_PARTIDAS = 5000 // em andamento + guardadas
// registros por host (conta, ou conexão do convidado) por minuto: ligar e desligar a
// partida sem parar não vira uma chuva de linhas no banco (a partida em si segue, sem XP)
export const PARTIDAS_POR_MINUTO = 10
const PERSONAGEM = /^[a-z0-9_]{1,16}$/

// ---------- banco ----------

export function criarRegistro(supabase) {
  if (!supabase) return null
  const chamar = async (nome, args) => {
    const r = await supabase.rpc(nome, args)
    if (r.error) throw new Error(`${nome}: ${r.error.message}`)
    return r.data
  }
  return {
    registrar: (p) =>
      chamar('registrar_partida', {
        p_id: p.id,
        p_modo: p.modo,
        p_versao: p.versao,
        p_sala_tipo: p.salaTipo,
        p_participantes: p.participantes.map((x) => ({ lado: x.lado, user_id: x.usuario, ref: x.ref ?? null })),
      }),
    encerrar: (p, d) =>
      chamar('encerrar_partida', {
        p_id: p.id,
        p_validacao: d.validacao,
        p_vencedor_lado: d.vencedorLado,
        p_motivo: d.motivo,
        p_duracao_s: d.duracaoS,
        p_rodadas: d.rodadas,
        p_participantes: p.participantes.map((x) => ({
          lado: x.lado,
          resultado: d.resultados[x.lado],
          personagem: x.relato?.personagem ?? null,
          relato: x.relato ?? null,
          relatado_em: x.relatadoEm != null ? new Date(x.relatadoEm).toISOString() : null,
        })),
      }),
    conceder: async (id) => (await chamar('conceder_recompensa', { p_partida: id })) ?? [],
  }
}

// ---------- convidado como oponente (limite diário) ----------

// A chave com que o banco conta "partidas de hoje contra o mesmo oponente" quando
// o oponente é um convidado (conta nenhuma para identificar). Cada conexão de
// convidado é um oponente diferente, a não ser que venha do MESMO endereço da
// conta (a aba anônima da própria conta, ou alguém na mesma casa/escola): aí todos
// os convidados daquele endereço contam como um só, como antes da Fase 2F.
export const REF_CONVIDADO_JUNTO = 'convidado'
export function refConvidado(convidado, conta) {
  if (convidado.ip && conta.ip && convidado.ip === conta.ip) return REF_CONVIDADO_JUNTO
  return `convidado:${convidado.cliente}`
}

// ---------- política ----------

const resultadoDe = (lado, vencedor) => (vencedor == null ? 'empate' : vencedor === lado ? 'vitoria' : 'derrota')
const menor = (a, b) => (a == null ? b : b == null ? a : Math.min(a, b))

// p: { criadaEm, participantes: [{ lado, relato, relatadoEm, saiuEm }] }, agora
// -> { validacao, vencedorLado, motivo, resultados: { lado: resultado }, rodadas, duracaoS }
export function decidir(p, agora) {
  if (p.modo === 'coop') return decidirCoop(p, agora)
  const [a, b] = p.participantes
  const relataram = p.participantes.filter((x) => x.relato)
  const marcos = p.participantes.flatMap((x) => [x.relatadoEm, x.saiuEm]).filter((t) => t != null)
  const fim = marcos.length ? Math.min(...marcos) : agora
  const duracaoS = Math.max(0, Math.round((fim - p.criadaEm) / 1000))
  const d = (validacao, vencedorLado, motivo, ra, rb, rodadas = null) => ({ validacao, vencedorLado, motivo, resultados: { [a.lado]: ra, [b.lado]: rb }, rodadas, duracaoS })

  if (relataram.length === 2) {
    const rodadas = menor(a.relato.rodadas, b.relato.rodadas)
    if (a.relato.vencedorLado === b.relato.vencedorLado) {
      const v = a.relato.vencedorLado
      return d('validada', v, 'normal', resultadoDe(a.lado, v), resultadoDe(b.lado, v), rodadas)
    }
    return d('contestada', null, 'divergente', 'contestada', 'contestada', rodadas)
  }

  if (relataram.length === 1) {
    const r = relataram[0]
    const o = r === a ? b : a
    const res = (rr, ro) => (r === a ? [rr, ro] : [ro, rr])
    // o outro saiu antes do fim (o relato): vale o que quem ficou viu
    if (o.saiuEm != null && o.saiuEm <= r.relatadoEm) {
      const v = r.relato.vencedorLado
      return d('validada', v, 'abandono', ...res(resultadoDe(r.lado, v), 'abandono'), r.relato.rodadas)
    }
    // o outro está lá e não confirmou (ou saiu depois do fim): ninguém leva a vitória sozinho
    return d('contestada', null, 'relato_unico', ...res('participacao', 'sem_relato'), r.relato.rodadas)
  }

  // o host caiu e não voltou: a sala morreu com ele, ninguém ganha nem perde
  if (p.hostCaiu) return d('encerrada', null, 'host_caiu', 'sem_relato', 'sem_relato')
  const sairam = p.participantes.filter((x) => x.saiuEm != null)
  if (sairam.length === 1) {
    const ficou = sairam[0] === a ? b : a
    return d('validada', ficou.lado, 'abandono', ...(ficou === a ? ['vitoria', 'abandono'] : ['abandono', 'vitoria']))
  }
  return d('encerrada', null, 'sem_relato', 'sem_relato', 'sem_relato')
}

// CO-OP: o time inteiro vence ou perde (relato.vitoria). Mesmas regras de
// quem relatou / saiu do PVP, mas sem "vencedor do lado": o resultado é igual
// para os dois.
function decidirCoop(p, agora) {
  const [a, b] = p.participantes
  const relataram = p.participantes.filter((x) => x.relato)
  const marcos = p.participantes.flatMap((x) => [x.relatadoEm, x.saiuEm]).filter((t) => t != null)
  const fim = marcos.length ? Math.min(...marcos) : agora
  const duracaoS = Math.max(0, Math.round((fim - p.criadaEm) / 1000))
  const time = (venceu) => (venceu ? 'vitoria' : 'derrota')
  const d = (validacao, motivo, ra, rb, rodadas = null) => ({ validacao, vencedorLado: null, motivo, resultados: { [a.lado]: ra, [b.lado]: rb }, rodadas, duracaoS })

  if (relataram.length === 2) {
    const rodadas = menor(a.relato.rodadas, b.relato.rodadas)
    if (a.relato.vitoria === b.relato.vitoria) return d('validada', 'normal', time(a.relato.vitoria), time(a.relato.vitoria), rodadas)
    return d('contestada', 'divergente', 'contestada', 'contestada', rodadas)
  }

  if (relataram.length === 1) {
    const r = relataram[0]
    const o = r === a ? b : a
    const res = (rr, ro) => (r === a ? [rr, ro] : [ro, rr])
    // o parceiro saiu antes do fim (o relato): vale o que quem ficou viu
    if (o.saiuEm != null && o.saiuEm <= r.relatadoEm) return d('validada', 'abandono', ...res(time(r.relato.vitoria), 'abandono'), r.relato.rodadas)
    // o parceiro está lá e não confirmou (ou saiu depois do fim): ninguém leva o time sozinho
    return d('contestada', 'relato_unico', ...res('participacao', 'sem_relato'), r.relato.rodadas)
  }

  // ninguém relatou: a luta não acabou para ninguém (host caiu, parceiro saiu, prazo)
  if (p.hostCaiu) return d('encerrada', 'host_caiu', 'sem_relato', 'sem_relato')
  return d('encerrada', p.participantes.some((x) => x.saiuEm != null) ? 'abandono' : 'sem_relato', 'sem_relato', 'sem_relato')
}

// o que o cliente mandou, limpo (null = não serve)
export function lerRelato(m, modo = 'pvp') {
  if (!m || typeof m.partidaId !== 'string' || m.partidaId.length > 64) return null
  const inteiro = (x, max) => (Number.isInteger(x) && x >= 0 && x <= max ? x : null)
  const base = {
    rodadas: inteiro(m.rodadas, 999),
    duracao: inteiro(Math.round(Number(m.duracao)), 86_400),
    personagem: typeof m.personagem === 'string' && PERSONAGEM.test(m.personagem) ? m.personagem : null,
  }
  if (modo === 'coop') return typeof m.vitoria === 'boolean' ? { vitoria: m.vitoria, ...base } : null
  const v = m.vencedorLado
  if (!(v === 0 || v === 1 || v === null)) return null
  return { vencedorLado: v, ...base }
}

// ---------- o registro no lobby ----------

export function criarPartidas({ registro = null, agora = Date.now, agendar = agendarPadrao, entregar = () => {}, log = () => {}, versao = 1, metricas = METRICAS_NULA } = {}) {
  const partidas = new Map() // id -> partida (em andamento e as guardadas)
  const doCliente = new Map() // id do cliente -> Set de partidas em andamento
  // os timers daqui (prazo dos relatos, esquecer a decisão): fechar() cancela todos
  const timers = new Set()
  const programar = (fn, ms) => {
    const t = { cancelar: null }
    const cancelar = agendar(() => {
      timers.delete(t)
      fn()
    }, ms)
    t.cancelar = () => {
      timers.delete(t)
      cancelar()
    }
    timers.add(t)
    return t.cancelar
  }

  const inicios = new Map() // host -> [instantes] (PARTIDAS_POR_MINUTO)
  function podeIniciar(host) {
    const t = agora()
    const chave = host.usuario ?? `cliente:${host.id}`
    const lista = (inicios.get(chave) ?? []).filter((x) => t - x < 60_000)
    if (inicios.size > 10_000) for (const [k, v] of inicios) if (!v.some((x) => t - x < 60_000)) inicios.delete(k)
    if (lista.length >= PARTIDAS_POR_MINUTO) {
      inicios.set(chave, lista)
      return false
    }
    lista.push(t)
    inicios.set(chave, lista)
    return true
  }

  const msgSemXp = (p, motivo) => ({ t: 'recompensa', partidaId: p.id, xpGanho: 0, motivo })

  const avisar = (p, x, msg) => {
    x.resposta = msg
    entregar(x, msg)
  }

  function limparVelhas() {
    if (partidas.size < MAX_PARTIDAS) return
    // as guardadas mais velhas saem primeiro (as em andamento ficam)
    for (const [id, p] of partidas) {
      if (partidas.size < MAX_PARTIDAS) break
      if (p.decisao) {
        p.esquecer?.()
        partidas.delete(id)
      }
    }
  }

  function desligar(p) {
    for (const x of p.participantes) {
      const lista = doCliente.get(x.cliente)
      lista?.delete(p)
      if (lista && !lista.size) doCliente.delete(x.cliente)
    }
  }

  function iniciar(sala, membros) {
    encerrou(sala)
    if (membros.length !== 2 || !['pvp', 'coop'].includes(sala.modo)) return null
    if (!podeIniciar(membros[0])) {
      log(`[partidas] sala ${sala.id}: partidas demais em um minuto, esta não é registrada`)
      return null
    }
    limparVelhas()
    const p = {
      id: crypto.randomUUID(),
      salaId: sala.id,
      salaTipo: sala.casual ? 'casual' : 'amigos',
      modo: sala.modo,
      versao,
      criadaEm: agora(),
      participantes: membros.map((c, lado) => ({ lado, cliente: c.id, ip: c.ip ?? null, conta: c.usuario ?? null, usuario: c.usuario ?? null, nome: c.nome, semConta: c.usuario ? null : 'convidado', ref: null, relato: null, relatadoEm: null, saiuEm: null, resposta: null })),
      prazo: null,
      cancelar: null,
      decisao: null,
      gravada: null,
    }
    // a mesma conta dos dois lados (duas abas): ninguém ganha nada
    const [a, b] = p.participantes
    // convidado do outro lado de uma conta: a chave do limite diário (refConvidado)
    if (!a.conta && b.conta) a.ref = refConvidado(a, b)
    if (!b.conta && a.conta) b.ref = refConvidado(b, a)
    if (a.usuario && a.usuario === b.usuario) for (const x of p.participantes) Object.assign(x, { usuario: null, semConta: 'mesma_conta' })
    partidas.set(p.id, p)
    for (const x of p.participantes) {
      if (!doCliente.has(x.cliente)) doCliente.set(x.cliente, new Set())
      doCliente.get(x.cliente).add(p)
    }
    sala.partidaId = p.id
    metricas.contar('partidas_iniciadas')
    // só vale gravar se alguém tem conta
    p.gravada = registro && p.participantes.some((x) => x.usuario) ? Promise.resolve().then(() => registro.registrar(p)) : null
    p.gravada?.catch((e) => log(`[partidas] não deu para registrar ${p.id}: ${e.message}`))
    return p
  }

  // agenda a decisão para daqui a `ms` (se for antes do prazo que já tem)
  function prazo(p, ms) {
    const quando = agora() + ms
    if (p.prazo != null && p.prazo <= quando) return
    p.cancelar?.()
    p.prazo = quando
    p.cancelar = programar(() => decidirAgora(p), ms)
  }

  // todo mundo já relatou ou saiu: não tem mais o que esperar
  const completa = (p) => p.participantes.every((x) => x.relato || x.saiuEm != null)

  function relatar(c, m) {
    const p = typeof m?.partidaId === 'string' && m.partidaId.length <= 64 ? partidas.get(m.partidaId) : null
    const relato = p && lerRelato(m, p.modo)
    if (!p || !relato) {
      if (typeof m?.partidaId === 'string' && m.partidaId.length <= 64) entregar({ cliente: c.id, conta: c.usuario ?? null }, { t: 'recompensa', partidaId: m.partidaId, xpGanho: 0, motivo: 'nao_registrada' })
      return
    }
    // o participante pelo cliente; reconectou com a mesma conta também vale (o id vem do JWT, nunca do cliente)
    const x = p.participantes.find((y) => y.cliente === c.id) ?? (c.usuario ? p.participantes.find((y) => y.conta && y.conta === c.usuario) : null)
    if (!x) return
    if (p.decisao) {
      // já decidido: devolve a resposta que existe (a que ainda está a caminho chega sozinha)
      if (x.resposta) entregar(x, x.resposta)
      else if (!x.relato && !p.pendente) entregar(x, msgSemXp(p, 'atrasado'))
      return
    }
    if (x.relato) return // repetido: o primeiro é o que vale
    // saiu da sala antes de relatar = abandono: um relato depois (pela mesma
    // conexão ou por outra aba da conta) não tira a vitória de quem ficou
    if (x.saiuEm != null) return
    x.relato = relato
    x.relatadoEm = agora()
    if (!x.usuario) avisar(p, x, msgSemXp(p, x.semConta))
    if (completa(p)) return decidirAgora(p)
    prazo(p, RELATO_JANELA_MS)
  }

  // só quem SAIU da sala da partida (quem ficou e foi tirado porque a sala
  // fechou não conta como abandono, nem se desconectar depois)
  function saiu(c, sala, quando = agora()) {
    const lista = doCliente.get(c.id)
    if (!lista || !sala) return
    for (const p of [...lista]) {
      if (p.decisao || p.salaId !== sala.id) continue
      const x = p.participantes.find((y) => y.cliente === c.id)
      if (!x || x.relato || x.saiuEm != null) continue
      x.saiuEm = quando
      if (completa(p)) decidirAgora(p)
      else prazo(p, ABANDONO_GRACA_MS)
    }
  }

  // o host caiu no meio e não voltou a tempo (a sala vai fechar logo depois)
  function hostCaiu(sala) {
    const p = sala.partidaId ? partidas.get(sala.partidaId) : null
    if (p && !p.decisao) p.hostCaiu = true
  }

  // o host voltou ao lobby (ou começou outra): os relatos ainda podem chegar
  function encerrou(sala) {
    const p = sala.partidaId ? partidas.get(sala.partidaId) : null
    sala.partidaId = null
    if (p && !p.decisao) prazo(p, RELATO_JANELA_MS)
  }

  function decidirAgora(p) {
    if (p.decisao) return
    p.cancelar?.()
    p.cancelar = null
    const d = (p.decisao = decidir(p, agora()))
    metricas.contar(d.motivo === 'abandono' ? 'partidas_abandonadas' : 'partidas_finalizadas')
    if (d.validacao === 'contestada') metricas.contar('partidas_contestadas')
    desligar(p)
    p.esquecer = programar(() => partidas.get(p.id) === p && partidas.delete(p.id), GUARDAR_MS)
    const nomes = p.participantes.map((x) => x.nome).join(' x ')
    if (d.validacao === 'contestada') log(`[partidas] ${p.id} contestada (${d.motivo}): ${nomes}, relatos ${p.participantes.map((x) => JSON.stringify(x.relato ? (p.modo === 'coop' ? x.relato.vitoria : x.relato.vencedorLado) : '-')).join(' x ')}`)
    else log(`[partidas] ${p.id} ${d.validacao} (${d.motivo}): ${nomes}, ${d.duracaoS}s`)
    p.pendente = true
    recompensar(p, d)
      .catch((e) => {
        log(`[partidas] não deu para conceder ${p.id}: ${e.message}`)
        for (const x of p.participantes) if (x.usuario && !x.resposta) avisar(p, x, msgSemXp(p, 'erro'))
      })
      .finally(() => (p.pendente = false))
  }

  async function recompensar(p, d) {
    const comConta = p.participantes.filter((x) => x.usuario)
    // convidado que não relatou também fica sabendo (relatou: já recebeu)
    for (const x of p.participantes) if (!x.usuario && !x.resposta) avisar(p, x, msgSemXp(p, x.semConta))
    if (!comConta.length) return
    if (!registro || !p.gravada) {
      for (const x of comConta) avisar(p, x, msgSemXp(p, 'indisponivel'))
      return
    }
    await p.gravada
    await registro.encerrar(p, d)
    if (d.validacao === 'encerrada') {
      for (const x of comConta) avisar(p, x, msgSemXp(p, d.motivo === 'host_caiu' ? 'host_caiu' : 'sem_relato'))
      return
    }
    // idempotente: se a primeira chamada falhou no meio do caminho, a segunda não soma de novo
    let linhas
    try {
      linhas = await registro.conceder(p.id)
    } catch {
      linhas = await registro.conceder(p.id)
    }
    for (const x of comConta) {
      const l = linhas.find((y) => y.usuario === x.usuario)
      if (!l) {
        avisar(p, x, msgSemXp(p, 'erro'))
        continue
      }
      avisar(p, x, {
        t: 'recompensa',
        partidaId: p.id,
        xpGanho: l.xp_ganho,
        xpTotal: l.xp_total,
        nivelAntes: l.nivel_antes,
        nivelDepois: l.nivel_depois,
        itensNovos: Array.isArray(l.itens_novos) ? l.itens_novos : [],
        motivo: l.motivo,
      })
    }
  }

  return {
    iniciar,
    relatar,
    saiu,
    hostCaiu,
    encerrou,
    // para os testes
    partida: (id) => partidas.get(id) ?? null,
    emAndamento: () => [...partidas.values()].filter((p) => !p.decisao).length,
    guardadas: () => partidas.size,
    timers: () => timers.size,
    fechar() {
      for (const t of [...timers]) t.cancelar()
      partidas.clear()
      doCliente.clear()
    },
  }
}
