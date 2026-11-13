// RELÓGIO DE FUNDO: timers que não dormem com a aba escondida (docs/rede-pvp.md "Aba em segundo plano
// e pausa online").
//
// Com a aba escondida (outra aba, janela minimizada, Alt+Tab para um app em tela cheia) o navegador
// para o requestAnimationFrame (o Phaser para de dar passos) e segura os setTimeout/setInterval da
// página: no Chrome, no máximo um por segundo e, depois de 5 min escondida, um por MINUTO. Na partida
// em rede isso travava os outros (cada PC simula o próprio coração e manda o fim da esquiva, a jogada,
// o recibo da cena...). Um Worker dedicado não sofre esse corte: com a aba escondida ele manda um
// TIQUE a cada TIQUE_MS e quem precisa anda por ele:
//   - o passo do jogo (game/segundoPlano.js: o Phaser continua rodando sem desenhar);
//   - os timers da rede (agendar/dormir): o reenvio do canal, as esperas de sincronia.
// Com a aba visível o worker para e tudo é setTimeout comum (o tique não custa nada).
//
// Lógica pura com as peças injetáveis (testada em src/lib/__tests__/relogioFundo.test.js):
//   const r = criarRelogio({ criarTicker, escondida, agendarNativo, cancelarNativo, agora })
//   r.agendar(fn, ms)      chama fn uma vez depois de ms: pelo setTimeout ou pelo tique (o que vier antes)
//   r.dormir(ms)           Promise que resolve depois de ms (pelo mesmo caminho)
//   r.aoTique(fn)          fn(agora) a cada tique (só com a aba escondida); devolve quem desliga
//   r.atualizar()          a visibilidade mudou: liga/desliga o ticker
//   r.ligado()             o ticker está rodando?
//   r.tique()              (testes) um tique na mão
//
// O `relogio` exportado é o do navegador (Worker de um Blob; sem Worker, cai num setInterval, que é
// o melhor que dá). No Node (testes, servidor) é só setTimeout.

export const TIQUE_MS = 33 // ~30 por segundo: o passo do jogo e o envio do coração (~30/s) seguem iguais

export function criarRelogio({ criarTicker, escondida = () => false, agendarNativo = (fn, ms) => setTimeout(fn, ms), cancelarNativo = (h) => clearTimeout(h), agora = () => Date.now() } = {}) {
  const pendentes = new Set() // { quando, fn, h }
  const ouvintes = new Set()
  let parar = null // desliga o ticker (ligado só com a aba escondida)

  function tique() {
    const t = agora()
    for (const p of [...pendentes]) {
      if (t < p.quando || !pendentes.delete(p)) continue
      cancelarNativo(p.h)
      p.fn()
    }
    for (const fn of [...ouvintes]) fn(t)
  }

  function atualizar() {
    const precisa = Boolean(escondida())
    if (precisa && !parar && criarTicker) parar = criarTicker(tique, TIQUE_MS) ?? (() => {})
    else if (!precisa && parar) {
      parar()
      parar = null
    }
  }

  function agendar(fn, ms = 0) {
    const p = { quando: agora() + Math.max(0, ms), fn, h: null }
    pendentes.add(p)
    p.h = agendarNativo(() => {
      if (pendentes.delete(p)) fn()
    }, ms)
    // o canal e as esperas não cancelam; quem quiser cancelar chama o que volta
    const cancelar = () => {
      pendentes.delete(p)
      cancelarNativo(p.h)
    }
    cancelar.unref = () => p.h?.unref?.() // (o canal pede: no Node o reenvio não segura o processo)
    return cancelar
  }

  return {
    agendar,
    dormir: (ms) => new Promise((resolve) => agendar(resolve, ms)),
    aoTique(fn) {
      ouvintes.add(fn)
      return () => ouvintes.delete(fn)
    },
    atualizar,
    ligado: () => Boolean(parar),
    tique,
  }
}

// ---------- o do navegador ----------

// o worker: recebe o intervalo (ms > 0 liga, 0 desliga) e manda um tique (0) a cada intervalo
const CODIGO_WORKER = 'let h=null;onmessage=(e)=>{clearInterval(h);h=e.data>0?setInterval(()=>postMessage(0),e.data):null}'

let worker = null
let workerFalhou = false
let aoTiqueWorker = null
let reserva = null // o setInterval da página quando o worker falhou no meio
function tickerDoNavegador(fn, ms) {
  // sem Worker (política do site, navegador antigo): o setInterval da página, mesmo segurado
  const porIntervalo = () => {
    const h = setInterval(fn, ms)
    return () => clearInterval(h)
  }
  if (workerFalhou) return porIntervalo()
  try {
    if (!worker) {
      const url = URL.createObjectURL(new Blob([CODIGO_WORKER], { type: 'text/javascript' }))
      worker = new Worker(url)
      URL.revokeObjectURL(url)
      worker.onmessage = () => aoTiqueWorker?.()
      worker.onerror = () => {
        workerFalhou = true
        worker?.terminate()
        worker = null
        if (aoTiqueWorker) reserva = setInterval(aoTiqueWorker, ms)
      }
    }
    aoTiqueWorker = fn
    worker.postMessage(ms)
    return () => {
      aoTiqueWorker = null
      worker?.postMessage(0)
      clearInterval(reserva)
      reserva = null
    }
  } catch {
    workerFalhou = true
    return porIntervalo()
  }
}

const temNavegador = typeof document !== 'undefined' && typeof window !== 'undefined'
export const abaEscondida = () => temNavegador && document.visibilityState === 'hidden'

export const relogio = criarRelogio({
  criarTicker: temNavegador && typeof Worker !== 'undefined' ? tickerDoNavegador : null,
  escondida: abaEscondida,
  agora: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
})
if (temNavegador) document.addEventListener('visibilitychange', () => relogio.atualizar())

export const agendarFundo = (fn, ms) => relogio.agendar(fn, ms)
export const dormirFundo = (ms) => relogio.dormir(ms)
