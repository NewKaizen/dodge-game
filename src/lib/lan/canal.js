// Canal de mensagens da partida em rede (docs/rede-pvp.md): lógica pura, sem
// navegador, testável em Node. Quem liga no transporte de verdade é
// lib/lan/partidaRede.js.
//
// Duas espécies de mensagem:
//   enviar(tipo, chave, dados)      CONFIÁVEL E EM ORDEM: numerada (seq). Quem
//                                   recebe entrega na ordem em que foram mandadas,
//                                   mesmo que umas venham pelo WebRTC e outras
//                                   pelo servidor. Para tudo que muda o jogo
//                                   (jogada, dano, resultado, troca de cena).
//   enviarRapido(tipo, dados)       SEM ORDEM, a última vale: posição do coração,
//                                   cursor. Chega na hora para quem escuta (ao);
//                                   uma mais velha que a última entregue é descartada.
//
// Recebendo:
//   receber(tipo, chave, { timeoutMs })  Promise com os dados da mensagem
//                                   (tipo, chave). Se ela chegou ANTES de alguém
//                                   pedir, fica guardada na caixa de correio até
//                                   ser pedida. Timeout: resolve com null.
//                                   ex.: await canal.receber('jogada', rodada)
//   ao(tipo, fn)                    fn(dados, chave) a cada mensagem do tipo
//                                   (confiável ou rápida); com alguém escutando,
//                                   o tipo não vai para a caixa de correio.
//                                   Devolve o desligar.
//   limpar()                        esvazia a caixa de correio e solta as esperas (partida nova)
//
// Confiáveis de verdade: cada uma vai com a SESSÃO de quem manda (e) e o
// número dela na sessão (s, de 0). Quem recebe responde com o recibo
// ('_ok', a = próximo número que espera); o que fica sem recibo é mandado de
// novo a cada REENVIO_MS (uma que se perdeu no WebRTC fechando, ou no
// servidor com a conexão caindo, não trava a partida). Parceiro novo (ou o
// mesmo que saiu e voltou): reiniciar() começa outra sessão, do 0; quem
// recebe vê a sessão nova e começa a contar dela (as mensagens de uma sessão
// velha que ainda chegarem são jogadas fora).
//   reiniciar()                     sessão nova (game/rede.js chama quando o parceiro muda)
//   descartar(de)                   a sessão ATUAL de `de` não vale mais: o que ainda chegar
//                                   dela é jogado fora; só uma sessão nova dele vale (retomada
//                                   da 2D: o host volta a rodada e as mensagens da rodada velha
//                                   que estavam no caminho não podem cair na rodada nova)
//
// Teste: testar({ atrasoMs, variacaoMs }) atrasa a ENTREGA do que chega
// (simula internet ruim; as confiáveis continuam em ordem).
//
//   const canal = criarCanal({ enviarBruto: (msg) => ..., meuId: () => 'abc' })
//   transporte.aoChegar((msg) => canal.entregar(msg))
export const TIPO_FIO = 'rede' // msg.tipo no fio (os outros tipos são do resto do LAN)
export const REENVIO_MS = 1000 // confiável sem recibo há tanto tempo: manda de novo
const RECIBO = '_ok'
const MAX_SEM_RECIBO = 2000 // guardadas para reenviar (passou disso, a mais velha sai)

const novaSessao = () => Math.random().toString(36).slice(2, 10)

export function criarCanal({ enviarBruto, enviarReserva = enviarBruto, meuId = () => 'eu', agora = () => Date.now(), agendar = (fn, ms) => setTimeout(fn, ms), sessao = novaSessao } = {}) {
  let seq = 0
  let minhaSessao = sessao()
  const semRecibo = new Map() // seq -> { msg, em } (as minhas confiáveis que o outro ainda não confirmou)
  let vigiando = false
  // quem recebe conta por `${de}|${sessão}`; de cada parceiro só a sessão mais nova vale
  const esperado = new Map() // `${de}|${e}` -> próximo seq esperado
  const foraDeOrdem = new Map() // `${de}|${e}` -> Map(seq -> msg)
  const sessaoDe = new Map() // de -> sessão atual dele
  const velhas = new Set() // `${de}|${e}` de sessões que já passaram
  const ultimoRapido = new Map() // `${de}:${tipo}` -> t da última rápida entregue
  const ouvintes = new Map() // tipo -> Set(fn)
  const correio = new Map() // `${tipo}|${chave}` -> [dados]
  const pedidos = new Map() // `${tipo}|${chave}` -> [resolve]
  let atraso = { atrasoMs: 0, variacaoMs: 0 }

  const caixa = (tipo, chave) => `${tipo}|${chave ?? ''}`

  function despachar(tipo, chave, dados) {
    const lista = ouvintes.get(tipo)
    if (lista?.size) {
      for (const fn of [...lista]) fn(dados, chave)
      return
    }
    const k = caixa(tipo, chave)
    const esperando = pedidos.get(k)
    if (esperando?.length) {
      esperando.shift()(dados)
      if (!esperando.length) pedidos.delete(k)
      return
    }
    if (!correio.has(k)) correio.set(k, [])
    correio.get(k).push(dados)
  }

  function processar(msg) {
    if (!msg || msg.tipo !== TIPO_FIO || typeof msg.k !== 'string') return
    const de = msg.de ?? '?'
    if (msg.k === RECIBO) return aoRecibo(msg)
    if (msg.s == null) {
      // rápida: só a mais nova vale
      const chave = `${de}:${msg.k}`
      if ((ultimoRapido.get(chave) ?? -Infinity) > msg.t) return
      ultimoRapido.set(chave, msg.t)
      despachar(msg.k, msg.c, msg.d)
      return
    }
    const id = `${de}|${msg.e ?? ''}`
    if (velhas.has(id)) return // de uma sessão que já passou
    const atual = sessaoDe.get(de)
    if (atual !== undefined && atual !== (msg.e ?? '')) {
      // o outro começou uma sessão nova (parceiro novo, ou saiu e voltou)
      const antiga = `${de}|${atual}`
      velhas.add(antiga)
      esperado.delete(antiga)
      foraDeOrdem.delete(antiga)
    }
    sessaoDe.set(de, msg.e ?? '')
    if (!esperado.has(id)) esperado.set(id, 0)
    const repetida = msg.s < esperado.get(id) || Boolean(foraDeOrdem.get(id)?.has(msg.s))
    if (msg.s >= esperado.get(id)) {
      if (!foraDeOrdem.has(id)) foraDeOrdem.set(id, new Map())
      const fila = foraDeOrdem.get(id)
      fila.set(msg.s, msg)
      // entrega tudo o que já está na sequência
      while (fila.has(esperado.get(id))) {
        const m = fila.get(esperado.get(id))
        fila.delete(m.s)
        esperado.set(id, m.s + 1)
        despachar(m.k, m.c, m.d)
      }
    }
    // recibo (também da repetida: o recibo de antes pode ter se perdido, então
    // o dela vai pelo caminho garantido)
    const recibo = { tipo: TIPO_FIO, de: meuId(), k: RECIBO, e: msg.e ?? '', a: esperado.get(id) }
    if (repetida) enviarReserva(recibo)
    else enviarBruto(recibo)
  }

  function aoRecibo(msg) {
    if (msg.e !== minhaSessao) return
    for (const s of [...semRecibo.keys()]) if (s < msg.a) semRecibo.delete(s)
  }

  // reenvia o que ficou sem recibo (enquanto houver)
  function vigiar() {
    if (vigiando || !semRecibo.size) return
    vigiando = true
    const h = agendar(() => {
      vigiando = false
      const t = agora()
      for (const p of semRecibo.values()) {
        if (t - p.em < REENVIO_MS) continue
        p.em = t
        enviarReserva(p.msg) // pelo caminho garantido (o direto pode estar mudo)
      }
      vigiar()
    }, REENVIO_MS)
    h?.unref?.() // Node (testes): não segura o processo
  }

  return {
    enviar(tipo, chave, dados) {
      const msg = { tipo: TIPO_FIO, de: meuId(), e: minhaSessao, s: seq++, t: agora(), k: tipo, c: chave ?? null, d: dados ?? null }
      semRecibo.set(msg.s, { msg, em: agora() })
      if (semRecibo.size > MAX_SEM_RECIBO) semRecibo.delete(semRecibo.keys().next().value)
      enviarBruto(msg)
      vigiar()
    },
    enviarRapido(tipo, dados) {
      enviarBruto({ tipo: TIPO_FIO, de: meuId(), s: null, t: agora(), k: tipo, c: null, d: dados ?? null })
    },
    // o que chegou do outro lado (pelo WebRTC ou pelo servidor)
    entregar(msg) {
      if (!msg || msg.tipo !== TIPO_FIO) return false
      const { atrasoMs, variacaoMs } = atraso
      if (atrasoMs > 0 || variacaoMs > 0) agendar(() => processar(msg), atrasoMs + Math.random() * variacaoMs)
      else processar(msg)
      return true
    },
    receber(tipo, chave, { timeoutMs = 0 } = {}) {
      const k = caixa(tipo, chave)
      const guardadas = correio.get(k)
      if (guardadas?.length) {
        const dados = guardadas.shift()
        if (!guardadas.length) correio.delete(k)
        return Promise.resolve(dados)
      }
      return new Promise((resolve) => {
        let feito = false
        const pronto = (dados) => {
          if (feito) return
          feito = true
          resolve(dados)
        }
        if (!pedidos.has(k)) pedidos.set(k, [])
        pedidos.get(k).push(pronto)
        if (timeoutMs > 0)
          agendar(() => {
            if (feito) return
            const lista = pedidos.get(k)
            const i = lista?.indexOf(pronto) ?? -1
            if (i >= 0) lista.splice(i, 1)
            if (lista && !lista.length) pedidos.delete(k)
            pronto(null)
          }, timeoutMs)
      })
    },
    ao(tipo, fn) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set())
      ouvintes.get(tipo).add(fn)
      return () => ouvintes.get(tipo)?.delete(fn)
    },
    // partida nova (troca de cena em rede): esvazia o correio e solta quem
    // ainda esperava (com null). Sem isso, uma espera da cena velha ainda
    // pendurada pegava a mensagem da cena nova (retomada da 2D: o `inicio`)
    limpar() {
      correio.clear()
      const esperando = [...pedidos.values()].flat()
      pedidos.clear()
      for (const pronto of esperando) pronto(null)
    },
    // parceiro novo (ou o mesmo que saiu e voltou): as minhas confiáveis começam
    // outra sessão, do 0, e as da sessão velha não são mais reenviadas
    reiniciar() {
      minhaSessao = sessao()
      seq = 0
      semRecibo.clear()
    },
    descartar(de) {
      const atual = sessaoDe.get(de)
      if (atual === undefined) return
      const id = `${de}|${atual}`
      velhas.add(id)
      esperado.delete(id)
      foraDeOrdem.delete(id)
    },
    // outro parceiro (ou o mesmo reconectado): as rápidas dele começam de novo
    // (as confiáveis se acertam sozinhas pela sessão)
    esquecer(de) {
      for (const chave of [...ultimoRapido.keys()]) if (chave.startsWith(`${de}:`)) ultimoRapido.delete(chave)
    },
    testar(opcoes = {}) {
      atraso = { atrasoMs: Math.max(0, Number(opcoes.atrasoMs) || 0), variacaoMs: Math.max(0, Number(opcoes.variacaoMs) || 0) }
      return atraso
    },
    estadoDebug: () => ({ seq, semRecibo: semRecibo.size, esperado: Object.fromEntries(esperado), correio: [...correio.keys()], pedidos: [...pedidos.keys()], atraso }),
  }
}
