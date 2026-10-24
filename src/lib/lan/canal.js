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
//   limpar()                        esvazia a caixa de correio (partida nova)
//
// Teste: testar({ atrasoMs, variacaoMs }) atrasa a ENTREGA do que chega
// (simula internet ruim; as confiáveis continuam em ordem).
//
//   const canal = criarCanal({ enviarBruto: (msg) => ..., meuId: () => 'abc' })
//   transporte.aoChegar((msg) => canal.entregar(msg))
export const TIPO_FIO = 'rede' // msg.tipo no fio (os outros tipos são do resto do LAN)

export function criarCanal({ enviarBruto, meuId = () => 'eu', agora = () => Date.now(), agendar = (fn, ms) => setTimeout(fn, ms) } = {}) {
  let seq = 0
  const esperado = new Map() // de -> próximo seq esperado
  const foraDeOrdem = new Map() // de -> Map(seq -> msg)
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
    if (msg.s == null) {
      // rápida: só a mais nova vale
      const chave = `${de}:${msg.k}`
      if ((ultimoRapido.get(chave) ?? -Infinity) > msg.t) return
      ultimoRapido.set(chave, msg.t)
      despachar(msg.k, msg.c, msg.d)
      return
    }
    if (!esperado.has(de)) esperado.set(de, 0)
    if (msg.s < esperado.get(de)) return // repetida
    if (!foraDeOrdem.has(de)) foraDeOrdem.set(de, new Map())
    const fila = foraDeOrdem.get(de)
    fila.set(msg.s, msg)
    // entrega tudo o que já está na sequência
    while (fila.has(esperado.get(de))) {
      const m = fila.get(esperado.get(de))
      fila.delete(m.s)
      esperado.set(de, m.s + 1)
      despachar(m.k, m.c, m.d)
    }
  }

  return {
    enviar(tipo, chave, dados) {
      enviarBruto({ tipo: TIPO_FIO, de: meuId(), s: seq++, t: agora(), k: tipo, c: chave ?? null, d: dados ?? null })
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
    limpar() {
      correio.clear()
    },
    // outro parceiro (ou o mesmo reconectado): a numeração dele começa de novo
    esquecer(de) {
      esperado.delete(de)
      foraDeOrdem.delete(de)
      for (const chave of [...ultimoRapido.keys()]) if (chave.startsWith(`${de}:`)) ultimoRapido.delete(chave)
    },
    testar(opcoes = {}) {
      atraso = { atrasoMs: Math.max(0, Number(opcoes.atrasoMs) || 0), variacaoMs: Math.max(0, Number(opcoes.variacaoMs) || 0) }
      return atraso
    },
    estadoDebug: () => ({ seq, esperado: Object.fromEntries(esperado), correio: [...correio.keys()], pedidos: [...pedidos.keys()], atraso }),
  }
}
