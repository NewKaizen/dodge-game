// Peças comuns do DUELO e do CTRL+C CTRL+V em rede (redeDuelo.js, redeCopia.js;
// regras em docs/rede-pvp.md, "Duelo e CTRL+C CTRL+V"). Lógica pura (sem
// Phaser), testada em __tests__/redeMinigame.test.js.
//
//   criarInterpolador({ atrasoMs })   o coração do OUTRO PC andando pelas posições
//                                     que chegam (enviarRapido), sem tremer
//   ouvirRodada(canal, rodada, tipos) as mensagens confiáveis do minigame desta
//                                     rodada: tratador na hora e/ou esperar(tipo)
//   agoraMs()                         relógio de verdade (ms) para carimbar as posições

export const agoraMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

// Interpolação com atraso: o coração do outro é desenhado onde ele estava um
// pouco atrás, no meio de duas amostras recebidas (a rede entrega aos trancos;
// desenhando no passado quase sempre há uma amostra depois do ponto pedido).
// Os relógios dos dois PCs não batem: cada amostra leva o `t` do relógio de
// LÁ, e a diferença (chegada aqui − t de lá) mais baixa já vista é a "base" (o
// caminho mais rápido da rede; sobe devagar se a rede piorar de vez). Quanto
// além da base as amostras costumam chegar é a "folga" (a variação da rede:
// sobe na hora com um tranco e desce devagar). O atraso do desenho é
// base + folga + margem (no mínimo `atrasoMs`), e ele muda AOS POUCOS (o relógio
// do desenho anda entre 1 − ritmo e 1 + ritmo da velocidade normal): o coração
// fica mais lento ou mais rápido por um instante, mas nunca pula nem volta.
// Sem amostra nova (pacote muito atrasado), anda um pouco com a última
// velocidade (`extrapolaMs`) e para.
//
//   const interp = criarInterpolador({ atrasoMs: 60 })
//   interp.adicionar({ t, x, y, vx, vy }, agora)   (vx, vy em px/s, opcionais)
//   interp.posicao(agora) -> { x, y, vx, vy } | null (nada chegou ainda)
export function criarInterpolador({ atrasoMs = 60, margemMs = 30, maxAtrasoMs = 600, ritmo = 0.3, extrapolaMs = 120, guardar = 60, subida = 0.002, descida = 0.01 } = {}) {
  const amostras = []
  let base = null
  let folga = 0
  let atraso = null // o atraso do desenho agora (anda aos poucos até o alvo)
  let ultimoAgora = null

  return {
    adicionar(amostra, agora) {
      if (!amostra || !Number.isFinite(amostra.t) || !Number.isFinite(amostra.x) || !Number.isFinite(amostra.y)) return false
      const ultima = amostras.at(-1)
      if (ultima && amostra.t <= ultima.t) return false // velha (chegou fora de ordem)
      const d = agora - amostra.t
      base = base === null || d < base ? d : base + (d - base) * subida
      const j = d - base
      folga = j > folga ? j : folga + (j - folga) * descida
      amostras.push({ t: amostra.t, x: amostra.x, y: amostra.y, vx: amostra.vx ?? 0, vy: amostra.vy ?? 0 })
      if (amostras.length > guardar) amostras.splice(0, amostras.length - guardar)
      return true
    },
    posicao(agora) {
      if (!amostras.length) return null
      const alvoAtraso = base + Math.min(maxAtrasoMs, Math.max(atrasoMs, folga + margemMs))
      if (atraso === null) atraso = alvoAtraso
      else {
        const passo = Math.max(0, agora - ultimoAgora) * ritmo
        atraso += Math.max(-passo, Math.min(passo, alvoAtraso - atraso))
      }
      ultimoAgora = agora
      const alvo = agora - atraso // no relógio de lá
      const primeira = amostras[0]
      if (alvo <= primeira.t) return { x: primeira.x, y: primeira.y, vx: primeira.vx, vy: primeira.vy }
      for (let i = amostras.length - 1; i > 0; i--) {
        const a = amostras[i - 1]
        const b = amostras[i]
        if (alvo < a.t || alvo > b.t) continue
        const u = b.t > a.t ? (alvo - a.t) / (b.t - a.t) : 1
        return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, vx: b.vx, vy: b.vy }
      }
      const ultima = amostras.at(-1)
      const s = Math.min(alvo - ultima.t, extrapolaMs) / 1000
      return { x: ultima.x + ultima.vx * s, y: ultima.y + ultima.vy * s, vx: ultima.vx, vy: ultima.vy }
    },
    get base() {
      return base
    },
    // quanto atrás da base o desenho está (ms)
    get atraso() {
      return atraso === null ? null : atraso - base
    },
    get quantas() {
      return amostras.length
    },
  }
}

// As mensagens CONFIÁVEIS do minigame (chave = rodada), enquanto ele está
// aberto. canal.ao pega o tipo de qualquer rodada: as de outra rodada (atrasadas
// de um minigame que já acabou) são ignoradas. Cada uma vai para o tratador
// (se tiver) e fica guardada (a última de cada tipo) para quem esperar por ela.
//
//   const r = ouvirRodada(canal, rodada, { dueloAtaque: (d) => ..., dueloFim: null })
//   await r.esperar('dueloFim', 5000)        dados ou null (timeout / desligado)
//   await r.esperarCorreio('dueloPronto', 10000)
//                       para a que pode ter chegado ANTES de ouvirRodada (fica na
//                       caixa de correio do canal): canal.receber, mas desligar() solta
//   r.desligar()        para de ouvir e solta todas as esperas (com null)
export function ouvirRodada(canal, rodada, tipos = {}, { agendar = (fn, ms) => setTimeout(fn, ms) } = {}) {
  const recebidas = new Map()
  const esperas = new Set() // { tipo, pronto }
  let desligado = false

  const soltar = (filtro, dados) => {
    for (const e of [...esperas]) if (filtro(e)) e.pronto(dados)
  }

  const desligadores = Object.entries(tipos).map(([tipo, tratador]) =>
    canal.ao(tipo, (dados, chave) => {
      if (desligado || chave !== rodada) return
      recebidas.set(tipo, dados ?? {})
      tratador?.(dados ?? {})
      soltar((e) => e.tipo === tipo, dados ?? {})
    }),
  )

  function esperarPor(tipo, timeoutMs, extra = null) {
    if (recebidas.has(tipo)) return Promise.resolve(recebidas.get(tipo))
    if (desligado) return Promise.resolve(null)
    return new Promise((resolve) => {
      const e = {
        tipo,
        pronto: (dados) => {
          if (!esperas.has(e)) return
          esperas.delete(e)
          resolve(dados)
        },
      }
      esperas.add(e)
      if (timeoutMs > 0) agendar(() => e.pronto(null), timeoutMs)
      extra?.(e)
    })
  }

  return {
    recebida: (tipo) => recebidas.get(tipo) ?? null,
    esperar: (tipo, timeoutMs = 0) => esperarPor(tipo, timeoutMs),
    esperarCorreio(tipo, timeoutMs = 0) {
      if (desligado) return Promise.resolve(null)
      return esperarPor(`correio:${tipo}`, 0, (e) => {
        canal.receber(tipo, rodada, { timeoutMs }).then((dados) => e.pronto(dados ?? null))
      })
    },
    desligar() {
      if (desligado) return
      desligado = true
      desligadores.forEach((fn) => fn())
      soltar(() => true, null)
    },
  }
}
