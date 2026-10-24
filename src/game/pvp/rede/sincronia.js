// Peças puras da PvpArena em rede (docs/rede-pvp.md): sem Phaser, testáveis em Node.
//
//   diferencasDeEstado(a, b, { max })   caminhos onde dois estados (JSON) diferem,
//                                       ex.: ['jogadores.1.hp', 'rng.s']; [] = iguais.
//                                       O convidado confere o estado dele com o do
//                                       host nos pontos de sincronia (e avisa no console)
//
//   const espelho = criarEspelhoCoracao({ atrasoMs: 100 })
//   espelho.receber(agora, { x, y })   posição do coração do outro que acabou de chegar
//   espelho.posicao(agora)             { x, y } para desenhar agora (null = nada chegou):
//                                       anda ATRASADO de atrasoMs, interpolando entre as
//                                       posições que chegaram (com variação no atraso da
//                                       rede elas chegam aos trancos; assim o coração
//                                       desliza). Sem posição nova, fica na última
//   espelho.limpar()                   rodada nova / o coração mudou de caixa

export function diferencasDeEstado(a, b, { max = 8 } = {}) {
  const lista = []
  const visitar = (x, y, caminho) => {
    if (lista.length >= max) return
    if (x === y || (Number.isNaN(x) && Number.isNaN(y))) return
    const objX = x !== null && typeof x === 'object'
    const objY = y !== null && typeof y === 'object'
    if (!objX || !objY || Array.isArray(x) !== Array.isArray(y)) {
      lista.push(caminho || '(raiz)')
      return
    }
    const chaves = new Set([...Object.keys(x), ...Object.keys(y)])
    for (const k of chaves) {
      // undefined e ausente são a mesma coisa no JSON (o estado viaja como JSON)
      if (x[k] === undefined && y[k] === undefined) continue
      visitar(x[k], y[k], caminho ? `${caminho}.${k}` : k)
    }
  }
  visitar(a, b, '')
  return lista
}

export function criarEspelhoCoracao({ atrasoMs = 100, maxAmostras = 30 } = {}) {
  let amostras = [] // [{ t, x, y }] em ordem de chegada (t = relógio daqui)

  return {
    receber(agora, { x, y } = {}) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      // duas na mesma hora (chegaram juntas): vale a mais nova
      if (amostras.length && amostras[amostras.length - 1].t >= agora) amostras[amostras.length - 1] = { t: agora, x, y }
      else amostras.push({ t: agora, x, y })
      if (amostras.length > maxAmostras) amostras = amostras.slice(-maxAmostras)
    },
    posicao(agora) {
      if (!amostras.length) return null
      const alvo = agora - atrasoMs
      // descarta as que já ficaram para trás (guarda uma antes do alvo para interpolar)
      while (amostras.length > 1 && amostras[1].t <= alvo) amostras.shift()
      const [a, b] = amostras
      if (!b || alvo <= a.t) return { x: a.x, y: a.y }
      const p = Math.min(1, (alvo - a.t) / (b.t - a.t))
      return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p }
    },
    limpar() {
      amostras = []
    },
    get tamanho() {
      return amostras.length
    },
  }
}
