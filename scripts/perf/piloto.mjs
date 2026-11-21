// O piloto das partidas (o mesmo do plano de otimização): o jogo fica no pior caso
// estável, para os números serem comparáveis entre rodadas e entre commits.
//   - debugJogo.set({ invencivel: true }) (quem chama liga) e o HP volta a encher;
//   - toda rodada é bônus (forcarBonus());
//   - as duas mãos: 10 de energia e as 5 cartas mais altas, com SUPER nas rodadas ímpares;
//   - o P1 confirma a carta (Espaço) e mexe o coração na esquiva.
//
// decidir(modo) roda NA PÁGINA e devolve a tecla a apertar (ou null). O modo 'escolha'
// prepara as mãos mas nunca confirma (a cena fica na escolha de cartas).

// (função serializada para page.evaluate: nada de fora dela aqui dentro)
export function decidir({ modo = 'arena', aleatorio = true, passo = 0 } = {}) {
  const a = window.pvpArena || window.coopArena
  if (!a?.estado) {
    // a luta da campanha: o servidor não existe aqui, e o Espaço anda os diálogos
    const cena = window.debugJogo?.cena?.() ?? []
    return cena.includes('CampanhaArena') ? 'Space' : null
  }
  try {
    a.estado.jogadores.forEach((j, k) => {
      if (j.hp < (j.hpMax || 10) * 0.6) a.setHp?.(k, j.hpMax || 10)
    })
    // CO-OP: o chefe não morre (a luta não acaba no meio da medida)
    const c = a.estado.chefe
    // (um SUPER tira mais que o HP cheio: fica com folga de 5x, reposta só quando cai de 3x)
    if (c && a.setHpChefe && c.hp < (c.hpMax || 100) * 3) a.setHpChefe((c.hpMax || 100) * 5)
  } catch {
    /* a arena ainda montando */
  }
  if (a.fase === 'escolha') {
    if (a.__perfRodada !== a.estado.rodada) {
      a.__perfRodada = a.estado.rodada
      try {
        a.forcarBonus?.()
      } catch {
        /* coop não tem bônus */
      }
      a.estado.jogadores.forEach((j, k) => {
        try {
          const b = j.baralho
          if (!b) return
          a.setEnergia?.(k, 10)
          const todas = [...b.mao, ...b.monte, ...b.descarte].sort((x, y) => (y.valor || 0) - (x.valor || 0))
          const pesadas = (a.estado.rodada % 2 ? todas : todas.filter((c) => c.valor !== 14)).slice(0, 5).map((c) => c.id)
          a.forcarMao?.(k, pesadas)
        } catch {
          /* jogador caído */
        }
      })
    }
    return modo === 'escolha' ? null : 'Space'
  }
  // a esquiva (e o duelo do bônus): mexe o coração. No modo determinístico (paridade) a
  // direção sai do número do passo, não do Math.random (que é do jogo)
  if (a.fase === 'esquiva' || a.fase === 'duelo') {
    const teclas = ['KeyA', 'KeyD', 'KeyW', 'KeyS']
    return teclas[aleatorio ? Math.floor(Math.random() * 4) : Math.floor(passo / 7) % 4]
  }
  // CO-OP: o painel "como funciona" da abertura espera o A (ou 15 s); o jogador fecha
  if (a.comoFunciona) return 'Space'
  return null
}

// O piloto em tempo real (medir.mjs): uma decisão a cada 400 ms, como no plano
export function pilotar(pagina, modo) {
  let parar = false
  let ocupado = false
  const tique = async () => {
    if (parar || ocupado) return
    ocupado = true
    try {
      const tecla = await pagina.evaluate(decidir, { modo })
      if (tecla) await pagina.keyboard.press(tecla, { delay: tecla === 'Space' ? 30 : 250 })
    } catch {
      /* a página trocando de cena */
    }
    ocupado = false
  }
  const timer = setInterval(tique, 400)
  return () => {
    parar = true
    clearInterval(timer)
  }
}
