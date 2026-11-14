// Pequenas ajudas dos eventos das arenas PRAIA e CAFÉ FRANCÊS (sem regra de jogo).

// O que todo evento precisa: guardar o que cria (para o terminar() apagar tudo) e saber
// se a caixa j ainda está em ataque.
export function contextoDoEvento(arena) {
  const vivos = new Set()
  const guardar = (o) => {
    vivos.add(o)
    o.once?.('destroy', () => vivos.delete(o))
    return o
  }
  const dono = (j) => arena.donoDaPista?.(j) ?? j
  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !p.ataque?.desarmado && !arena.ko?.[dono(j)] ? p : null
  }
  // Graphics recortado na caixa (só aparece dentro dela)
  const graficoDaCaixa = (pista, profundidade = 4) => {
    const g = guardar(arena.add.graphics().setDepth(profundidade))
    pista.caixa.recortar(g)
    return g
  }
  const limpar = () => {
    for (const o of [...vivos]) {
      arena.tweens?.killTweensOf(o)
      o.destroy()
    }
    vivos.clear()
  }
  return { vivos, guardar, dono, pistaViva, graficoDaCaixa, limpar }
}

// a caixa acabou o ataque (ou foi desarmada): as balas viram inofensivas
export const pistaEncerrada = (pista) => !pista.ataque || pista.ataque.desarmado
