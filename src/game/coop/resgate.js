// RESGATE NA HORA (CO-OP 2.0, docs/coop-cartas.md): quem cai no meio da esquiva deixa uma ALMA no quadro,
// no lugar onde caiu. Um parceiro de pé que encosta nela e FICA encostado RESGATE.tempoMs (o anel enche)
// levanta o caído na hora, com COOP.retornoHp do HP máx (coop/regras.js resgatarNaHora), e o coração dele
// volta ao quadro ali mesmo, piscando (invencível um tempinho). Saiu de perto: o anel zera.
// Lógica pura (sem Phaser), testada em coop/__tests__/resgate.test.js; a arena desenha (coop/coop2Cena.js).
//
// REDE: cada PC é dono do PRÓPRIO coração (docs/rede-pvp.md), então só o PC do salvador decide que o
// resgate aconteceu (`podeCompletar(j)`: o coração j é daqui ou da CPU daqui). Os outros PCs veem o anel
// enchendo pelo coração espelho, mas ele para antes do fim e espera a mensagem `resgate` (que o PC do
// salvador manda pelo mesmo canal do dano: chega antes do fimEsquiva dele).
//
//   const almas = criarAlmas()
//   (saiu de perto por mais de RESGATE.folgaMs: o anel zera; um desvio rápido só pausa o anel)
//   almas.adicionar(alvo, x, y)                 o coração de `alvo` quebrou ali
//   almas.atualizar(dt, coracoes, { podeCompletar })   coracoes = [{ j, x, y, ativo }] (os de pé no quadro)
//     -> [{ alvo, quem }] os resgates que ESTE PC completou agora (a arena aplica e manda)
//   almas.remover(alvo) · almas.limpar() · almas.lista (para desenhar: { alvo, x, y, progresso, quem })
//   almas.maisPerto(x, y) -> a alma mais perto (a CPU aliada vai até ela)

export const RESGATE = {
  raio: 18, // distância (px) do centro da alma ao centro do coração para contar como encostado
  tempoMs: 1000, // encostado este tempo seguido: levanta
  folgaMs: 300, // saiu de perto por menos que isto (um desvio rápido): o anel para, mas não zera
  invencivelMs: 1400, // o coração que volta pisca este tempo sem levar dano
  margem: 14, // a alma fica pelo menos isto para dentro da borda do quadro
}

// a alma fica dentro do quadro (o coração pode ter quebrado bem na borda)
export function posicaoDaAlma(x, y, limites, margem = RESGATE.margem) {
  if (!limites) return { x, y }
  const esquerda = limites.x ?? limites.left
  const topo = limites.y ?? limites.top
  return {
    x: Math.max(esquerda + margem, Math.min(esquerda + limites.width - margem, x)),
    y: Math.max(topo + margem, Math.min(topo + limites.height - margem, y)),
  }
}

export function criarAlmas({ raio = RESGATE.raio, tempoMs = RESGATE.tempoMs, folgaMs = RESGATE.folgaMs } = {}) {
  const lista = []
  return {
    lista,
    adicionar(alvo, x, y) {
      const velha = lista.findIndex((a) => a.alvo === alvo)
      if (velha >= 0) lista.splice(velha, 1)
      const alma = { alvo, x, y, progresso: 0, quem: null, idade: 0, longe: 0 }
      lista.push(alma)
      return alma
    },
    remover(alvo) {
      const i = lista.findIndex((a) => a.alvo === alvo)
      if (i >= 0) lista.splice(i, 1)
    },
    limpar() {
      lista.length = 0
    },
    tem(alvo) {
      return lista.some((a) => a.alvo === alvo)
    },
    // a alma mais perto de (x, y) (null se não tem)
    maisPerto(x, y) {
      let melhor = null
      let menor = Infinity
      for (const a of lista) {
        const d = Math.hypot(a.x - x, a.y - y)
        if (d < menor) {
          menor = d
          melhor = a
        }
      }
      return melhor
    },
    atualizar(dt, coracoes = [], { podeCompletar = () => true } = {}) {
      const feitos = []
      for (const alma of [...lista]) {
        alma.idade += dt
        // quem está encostado (o mais perto); o anel é de quem encostou primeiro enquanto ele ficar
        const perto = coracoes.filter((c) => c.ativo && c.j !== alma.alvo && Math.hypot(c.x - alma.x, c.y - alma.y) <= raio)
        const continua = perto.find((c) => c.j === alma.quem)
        const quem = continua ?? perto.sort((a, b) => Math.hypot(a.x - alma.x, a.y - alma.y) - Math.hypot(b.x - alma.x, b.y - alma.y))[0]
        if (!quem) {
          // saiu de perto: o anel para; longe mais que a folga, cancela (zera)
          alma.longe += dt
          if (alma.longe > folgaMs) {
            alma.progresso = 0
            alma.quem = null
          }
          continue
        }
        alma.longe = 0
        if (quem.j !== alma.quem) alma.progresso = 0
        alma.quem = quem.j
        const completa = podeCompletar(quem.j)
        // num PC que não decide, o anel para pouco antes do fim e espera a mensagem do dono
        alma.progresso = Math.min(completa ? tempoMs : tempoMs * 0.95, alma.progresso + dt)
        if (completa && alma.progresso >= tempoMs) {
          lista.splice(lista.indexOf(alma), 1)
          feitos.push({ alvo: alma.alvo, quem: quem.j })
        }
      }
      return feitos
    },
    // fração do anel (0..1) da alma de `alvo`
    fracao(alvo) {
      const a = lista.find((x) => x.alvo === alvo)
      return a ? Math.min(1, a.progresso / tempoMs) : 0
    },
  }
}
