// Recuperação de conexão (Fase 2D, docs/rede-pvp.md): lógica pura, sem
// navegador, testada em Node (src/lib/__tests__/religar.test.js).
//
// A conexão com o servidor caiu NO MEIO DE UMA PARTIDA: o servidor guarda a
// vaga RETOMADA_MS (server/lan.js). Daqui o cliente tenta voltar sozinho, com
// espera crescente entre as tentativas (ESPERAS_MS, a última se repete), até
// a janela acabar; cada tentativa abre uma conexão nova com `ola {retomar: chave}`.
//
//   const r = criarReligar({ agora, agendar, tentar, desistir, janelaMs })
//   r.comecar()        caiu: a primeira tentativa sai depois de ESPERAS_MS[0]
//   r.falhou()         a tentativa não conectou: agenda a próxima (ou desiste)
//   r.conseguiu()      o servidor devolveu a vaga: para tudo
//   r.parar()          saiu da sala de outro jeito: para tudo (sem desistir)
//   r.ativo() · r.ate() · r.tentativas()
//
// tentar(n) abre a conexão (n = 1, 2, ...); desistir() é chamado uma vez quando
// a janela acaba sem volta. agendar(fn, ms) devolve uma função que cancela.
//
// A chave de retomada mora no sessionStorage (uma por aba: duas abas da mesma
// conta não brigam pela mesma vaga): guardarChave / lerChave / apagarChave.
export const RETOMADA_MS = 20_000 // o mesmo prazo do servidor (server/lan.js)
export const ESPERAS_MS = [250, 750, 1500, 2500, 3000]
export const CHAVE_RETOMADA = 'dodge-lan-retomada'

export const esperaDaTentativa = (n) => ESPERAS_MS[Math.min(Math.max(0, n - 1), ESPERAS_MS.length - 1)]

const agendarPadrao = (fn, ms) => {
  const t = setTimeout(fn, ms)
  return () => clearTimeout(t)
}

export function criarReligar({ agora = Date.now, agendar = agendarPadrao, tentar, desistir = () => {}, janelaMs = RETOMADA_MS } = {}) {
  let ate = null // fim da janela (null = parado)
  let n = 0
  let cancelar = null

  const limpar = () => {
    cancelar?.()
    cancelar = null
  }

  function agendarProxima() {
    limpar()
    const espera = esperaDaTentativa(n + 1)
    // não dá para tentar de novo antes de a janela acabar: desiste no fim dela
    if (agora() + espera >= ate) {
      cancelar = agendar(acabou, Math.max(0, ate - agora()))
      return
    }
    cancelar = agendar(() => {
      cancelar = null
      if (ate == null) return
      n++
      tentar(n)
    }, espera)
  }

  function acabou() {
    cancelar = null
    if (ate == null) return
    ate = null
    desistir()
  }

  return {
    comecar() {
      if (ate != null) return
      ate = agora() + janelaMs
      n = 0
      agendarProxima()
    },
    falhou() {
      if (ate == null) return
      if (agora() >= ate) return acabou()
      agendarProxima()
    },
    conseguiu() {
      ate = null
      limpar()
    },
    parar() {
      ate = null
      limpar()
    },
    ativo: () => ate != null,
    ate: () => ate,
    tentativas: () => n,
  }
}

// ---------- a chave (sessionStorage, por aba) ----------

const armazenamentoPadrao = () => {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

export function guardarChave(chave, armazenamento = armazenamentoPadrao()) {
  if (typeof chave !== 'string' || !chave) return
  try {
    armazenamento?.setItem(CHAVE_RETOMADA, chave)
  } catch {}
}

export function lerChave(armazenamento = armazenamentoPadrao()) {
  try {
    const v = armazenamento?.getItem(CHAVE_RETOMADA)
    return typeof v === 'string' && v ? v : null
  } catch {
    return null
  }
}

export function apagarChave(armazenamento = armazenamentoPadrao()) {
  try {
    armazenamento?.removeItem(CHAVE_RETOMADA)
  } catch {}
}
