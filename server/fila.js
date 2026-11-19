// JOGAR RÁPIDO (Fase 1C; docs/online.md): a fila casual de PVP 1x1.
//
// Só a máquina de estados, sem WebSocket: o lobby (server/lan.js) diz quem
// entra e sai e recebe os avisos; os testes trocam o relógio e os timers.
//
//   FORA ──entrar──► PROCURANDO ──(achou par)──► PAREADO ──(os dois confirmam)──► sala casual
//                       ▲    │                     │
//                       │    └──sair──► FORA       ├─ recusou / saiu / não confirmou a tempo ──► FORA
//                       └──── (o outro do par) ◄───┘   (quem não falhou volta para a FRENTE da fila)
//
// Pareamento: FIFO simples (sem rating). Anda a fila do mais antigo para o mais
// novo e junta cada um com o primeiro, depois dele, que `podeParear` aceita
// (mesma conta em duas abas e bloqueio não pareiam). Quem volta de um par
// desfeito entra na frente e mantém o "desde" (a espera continua contando).
//
//   const fila = criarFila({ agora, agendar, podeParear, avisos })
//   fila.entrar(c)                 false se já está na fila (procurando ou pareado)
//   fila.sair(c, motivo)           sai de onde estiver (procurando ou pareado)
//   fila.responder(c, id, aceitar) confirma / recusa o par; 'expirado' se o id não vale mais
//   fila.estado(c)                 'fora' | 'procurando' | 'pareado'
//   fila.desde(c)                  quando entrou na espera (null fora dela)
//   fila.verificar()               desfaz os pares vencidos (o timer chama; os testes também)
//   fila.tamanho() · fila.pares()  para os testes (e o log)
//
// avisos (o lobby manda as mensagens):
//   procurando(c, desde)                  entrou / voltou para a fila
//   pareado(par)                          achou: par = { id, a, b, expira }
//   respostas(par)                        alguém confirmou (par.confirmados: [c, ...], na ordem)
//   desfeito(par, { volta: [c], fora: [{ c, motivo }] })
//   fechado(par, [primeiro, segundo])     os dois confirmaram (na ordem da confirmação)
//
// agendar(fn, ms) devolve uma função que cancela.
//
// BOTS (docs/online.md "Bots do Jogar Rápido", server/bots/): com `bots` ligado, quem está PROCURANDO há
// mais que o próprio limiar (sorteado a cada entrada, bots.limiarMs(): 8 a 20 s) sem achar gente ganha
// um bot de oponente. O par é o de sempre (pareado -> confirmar -> sala casual): o bot confirma como
// gente. Gente sempre pareia primeiro (o bot só entra quando ninguém serviu); o bot nunca fica na
// espera (num par desfeito, ele sai em vez de voltar para a fila).
//   bots = { limiarMs() -> ms, oferecer(c) -> cliente do bot | null, ehBot(c) -> bool }
import crypto from 'node:crypto'

export const CONFIRMAR_MS = 10_000 // para os dois aceitarem a partida achada
export const REVANCHE_MS = 15_000 // para os dois aceitarem a revanche
export const CPU_APOS_MS = 30_000 // o cliente oferece a CPU depois disso procurando
export const ACOES_FILA_POR_MINUTO = 30 // fila, confirmar e revanche, por conexão
export const FOLGA_PING_MS = 30 // diferença de ping que decide o host (veja lan.js)
export const CASUAL_INICIO_MS = 15_000 // a sala casual nasceu e o host não começou: os dois voltam para a fila
export const EVITAR_PAR_MS = 60_000 // ...e não pareiam um com o outro de novo por esse tempo

export const agendarPadrao = (fn, ms) => {
  const t = setTimeout(fn, ms)
  t.unref?.()
  return () => clearTimeout(t)
}

export function criarFila({ agora = Date.now, agendar = agendarPadrao, podeParear = () => true, avisos = {}, confirmarMs = CONFIRMAR_MS, bots = null } = {}) {
  const espera = [] // [{ c, desde }] na ordem da fila
  const pares = new Map() // id do par -> par
  const parDe = new Map() // cliente -> par
  const avisar = (nome, ...args) => avisos[nome]?.(...args)

  const naEspera = (c) => espera.findIndex((e) => e.c === c)
  const estado = (c) => (parDe.has(c) ? 'pareado' : naEspera(c) >= 0 ? 'procurando' : 'fora')

  const ehBot = (c) => Boolean(bots?.ehBot?.(c))

  function colocar(c, desde, frente) {
    const item = { c, desde, limiar: null, cancelarBot: null }
    if (frente) espera.unshift(item)
    else espera.push(item)
    avisar('procurando', c, desde)
    vigiarBot(item, frente)
  }

  // o limiar deste jogador (quem volta de um par desfeito espera de novo, mais curto)
  function vigiarBot(item, voltou = false) {
    if (!bots?.oferecer) return
    const ms = Math.max(0, Math.round((bots.limiarMs?.() ?? 15_000) * (voltou ? 0.5 : 1)))
    item.limiar = agora() + ms
    item.cancelarBot?.()
    item.cancelarBot = agendar(() => {
      item.cancelarBot = null
      oferecerBots()
    }, ms + 20)
  }

  // quem passou do limiar sem gente: um bot (se tiver um livre); senão tenta de novo daqui a pouco
  function oferecerBots() {
    const t = agora()
    for (const item of [...espera]) {
      if (item.limiar == null || item.limiar > t || espera.indexOf(item) < 0) continue
      const bot = bots.oferecer(item.c)
      if (!bot) {
        item.limiar = t + 4000
        item.cancelarBot?.()
        item.cancelarBot = agendar(() => {
          item.cancelarBot = null
          oferecerBots()
        }, 4020)
        continue
      }
      espera.splice(espera.indexOf(item), 1)
      item.cancelarBot?.()
      formarPar(item, { c: bot, desde: t })
    }
  }

  const tirar = (i) => {
    const [item] = espera.splice(i, 1)
    item?.cancelarBot?.()
    return item
  }

  function formarPar(a, b) {
    const par = { id: crypto.randomBytes(8).toString('hex'), a: a.c, b: b.c, desde: { a: a.desde, b: b.desde }, expira: agora() + confirmarMs, confirmados: [], cancelar: null }
    par.cancelar = agendar(verificar, confirmarMs + 50)
    pares.set(par.id, par)
    parDe.set(par.a, par)
    parDe.set(par.b, par)
    avisar('pareado', par)
  }

  // junta o que der: cada um com o primeiro compatível depois dele
  function parear() {
    for (let i = 0; i < espera.length; i++) {
      const a = espera[i]
      const j = espera.findIndex((b, k) => k > i && podeParear(a.c, b.c))
      if (j < 0) continue
      const b = espera[j]
      tirar(j)
      tirar(i)
      i--
      formarPar(a, b)
    }
  }

  // tira o par do mapa (e o timer) antes de avisar: os avisos podem mexer na fila
  function desmontar(par) {
    if (!pares.delete(par.id)) return false
    par.cancelar?.()
    par.cancelar = null
    parDe.delete(par.a)
    parDe.delete(par.b)
    return true
  }

  // falhou: [{ c, motivo }]; o resto do par volta para a frente da fila
  function desfazer(par, falhou) {
    if (!desmontar(par)) return
    const culpados = new Set(falhou.map((f) => f.c))
    const volta = [par.a, par.b].filter((c) => !culpados.has(c))
    avisar('desfeito', par, { volta, fora: falhou })
    // o bot não volta para a espera (ele sai; o lobby desliga o cliente dele)
    // de trás para frente: quem esperava há mais tempo fica na frente
    for (const c of [...volta].sort((x, y) => desdeDe(par, y) - desdeDe(par, x))) if (estado(c) === 'fora' && !ehBot(c)) colocar(c, desdeDe(par, c), true)
    parear()
  }
  const desdeDe = (par, c) => (c === par.a ? par.desde.a : par.desde.b)

  function verificar() {
    const t = agora()
    for (const par of [...pares.values()]) {
      if (par.expira > t) continue
      const falhou = [par.a, par.b].filter((c) => !par.confirmados.includes(c)).map((c) => ({ c, motivo: 'tempo' }))
      desfazer(par, falhou)
    }
  }

  return {
    estado,
    entrar(c) {
      verificar()
      if (estado(c) !== 'fora') return false
      colocar(c, agora(), false)
      parear()
      return true
    },
    sair(c, motivo = 'saiu') {
      const i = naEspera(c)
      if (i >= 0) {
        tirar(i)
        return true
      }
      const par = parDe.get(c)
      if (!par) return false
      desfazer(par, [{ c, motivo }])
      return true
    },
    responder(c, id, aceitar) {
      verificar()
      const par = parDe.get(c)
      if (!par || par.id !== id) return 'expirado'
      if (!aceitar) {
        desfazer(par, [{ c, motivo: 'recusou' }])
        return 'recusado'
      }
      if (!par.confirmados.includes(c)) par.confirmados.push(c)
      if (par.confirmados.length < 2) {
        avisar('respostas', par)
        return 'esperando'
      }
      desmontar(par)
      avisar('fechado', par, [...par.confirmados])
      return 'fechado'
    },
    // desde quando está procurando (null fora da espera)
    desde: (c) => espera[naEspera(c)]?.desde ?? null,
    verificar,
    // reavalia quem pode parear com quem (ex.: mudou um bloqueio)
    parear,
    // bots: quem já passou do limiar ganha um bot agora (os testes chamam; o timer também)
    oferecerBots: () => bots?.oferecer && oferecerBots(),
    tamanho: () => espera.length,
    pares: () => pares.size,
  }
}
