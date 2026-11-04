// As DICAS da página 5 do Manual do Ralsei ("Uma partida de verdade"): um motorzinho de dicas, puro (sem
// Phaser, testado em __tests__/dicasDaPartida.test.js), que reage aos EVENTOS REAIS da arena
// (scenes/ManualRalsei5Partida.js). Nada de regra nova: a arena joga como sempre e só conta o que aconteceu.
// Dica só quando precisa: cada uma tem o seu gatilho e aparece no máximo `max` vezes; nunca trava o jogo.
//
//   const d = criarDicas()
//   d.evento({ tipo: 'negada', codigo })   o jogador tentou uma carta bloqueada (motivoBloqueio)
//   d.evento({ tipo: 'deCima' })           o ataque na caixa do jogador vem de cima (criarLeitorDeChuva)
//   d.evento({ tipo: 'dano', hp, hpMax })  o jogador levou um acerto (e, com pouca vida, "calma")
//   d.evento({ tipo: 'passou' })           o jogador passou a vez
//   d.evento({ tipo: 'rodada', rodada })   começou uma rodada (da 2ª em diante a energia encheu)
//   d.tick(dt, { fase, bloqueado })        um quadro: devolve a dica que ACABOU de aparecer (ou null)
//   d.atual                                a dica na tela: { id, texto, alvo, restante } ou null
//   d.vezes(id)                            quantas vezes ela já apareceu
//   d.drenar()                             eventos para a cena: { tipo: 'mostrar' | 'esconder', dica }
//
// Fases sem dica (FASES_SEM_DICA): a abertura, a revelação das cartas, o SUPER, a roleta, o duelo e o
// resultado (e `bloqueado`: a câmera lenta do K.O., a pausa) são os momentos em que a tela já está cheia
// de coisa acontecendo. Ali nenhuma dica aparece; a que estava na tela some, e a que chegou espera a
// sua fase (cada dica diz em que fases vale) até a validade dela acabar (aí é esquecida, sem contar).

export const DICAS = {
  semEnergia: { texto: 'Falta energia: que tal PASSAR?', max: 2, fases: ['escolha'], validadeMs: 3000, alvo: 'passar' },
  deCima: { texto: 'Esse ataque vem de cima: fique embaixo!', max: 1, fases: ['esquiva'], validadeMs: 2500, alvo: 'caixa' },
  dano: { texto: 'Você levou dano: olhe a sua vida aqui.', max: 1, fases: ['esquiva', 'arremesso', 'fim', 'inicio', 'escolha'], validadeMs: 6000, alvo: 'vida' },
  calma: { texto: 'Calma, desvie com cuidado.', max: 1, fases: ['esquiva', 'arremesso', 'fim', 'inicio', 'escolha'], validadeMs: 6000, alvo: 'coracao' },
  energia: { texto: 'A energia enche quando você passa e a cada rodada.', max: 1, fases: ['inicio', 'escolha'], validadeMs: 8000, alvo: 'energia' },
}
// quando duas esperam juntas, a mais urgente primeiro
export const PRIORIDADE = ['calma', 'deCima', 'semEnergia', 'dano', 'energia']
export const FASES_SEM_DICA = ['abertura', 'revelacao', 'bonus', 'super', 'duelo', 'resultado']
export const DICA_MS = 3800 // quanto tempo a dica fica na tela
export const INTERVALO_MS = 1200 // respiro entre uma dica e a próxima
export const VIDA_BAIXA = 0.35 // fração do HP em que vem o "calma"

export function criarDicas({ duracaoMs = DICA_MS, intervaloMs = INTERVALO_MS, dicas = DICAS } = {}) {
  const vezes = Object.fromEntries(Object.keys(dicas).map((id) => [id, 0]))
  let esperando = [] // [{ id, idade }]
  let fila = []
  let descanso = 0
  const pedir = (id) => {
    const def = dicas[id]
    if (!def || vezes[id] >= def.max) return false
    if (d.atual?.id === id || esperando.some((e) => e.id === id)) return false
    esperando.push({ id, idade: 0 })
    return true
  }
  const esconder = () => {
    if (!d.atual) return
    fila.push({ tipo: 'esconder', dica: d.atual })
    d.atual = null
    descanso = intervaloMs
  }
  const d = {
    atual: null,
    vezes: (id) => vezes[id] ?? 0,
    get esperando() {
      return esperando.map((e) => e.id)
    },
    evento(e) {
      if (e.tipo === 'negada' && e.codigo === 'sem-energia') return pedir('semEnergia')
      if (e.tipo === 'deCima') return pedir('deCima')
      if (e.tipo === 'dano') {
        const pediu = pedir('dano')
        const baixa = e.hp > 0 && e.hpMax > 0 && e.hp / e.hpMax <= VIDA_BAIXA && pedir('calma')
        return pediu || baixa
      }
      if (e.tipo === 'passou') return pedir('energia')
      if (e.tipo === 'rodada' && e.rodada >= 2) return pedir('energia')
      return false
    },
    tick(dt, { fase, bloqueado = false } = {}) {
      const quieto = bloqueado || FASES_SEM_DICA.includes(fase)
      esperando.forEach((e) => (e.idade += dt))
      esperando = esperando.filter((e) => e.idade <= dicas[e.id].validadeMs)
      if (d.atual) {
        d.atual.restante -= dt
        if (quieto || d.atual.restante <= 0) esconder()
        return null
      }
      descanso = Math.max(0, descanso - dt)
      if (quieto || descanso > 0) return null
      const pronta = PRIORIDADE.map((id) => esperando.find((e) => e.id === id)).find((e) => e && dicas[e.id].fases.includes(fase))
      if (!pronta) return null
      esperando = esperando.filter((e) => e !== pronta)
      vezes[pronta.id]++
      const def = dicas[pronta.id]
      d.atual = { id: pronta.id, texto: def.texto, alvo: def.alvo, restante: duracaoMs }
      fila.push({ tipo: 'mostrar', dica: d.atual })
      return d.atual
    },
    // a cena some com a dica antes da hora (o jogador apertou para ela sumir, a cena fechou)
    fechar: esconder,
    drenar() {
      const f = fila
      fila = []
      return f
    },
  }
  return d
}

// O ataque na caixa do jogador "vem de cima"? Olha as balas que NASCEM (os projéteis de verdade, raio >= 6:
// nada de brilho de rastro): é chuva quando pelo menos `minimo` (2) nasceram e quase todas (`fracao`) entram
// por cima da caixa e descem. O mesmo critério do teste da página 3 ("só a Estrela Gentil faz chover"),
// aplicado às balas reais da Pista.
//   const leitor = criarLeitorDeChuva()
//   leitor.ver(balas.lista, caixa.limites)   true no quadro em que a chuva foi reconhecida (uma vez por ataque):
//                                            o leitor decide já pela 1ª estrela que nasce (minimo 1), para a
//                                            dica chegar antes do primeiro acerto, e para de olhar depois das
//                                            `olharAte` primeiras balas grandes
//   leitor.reiniciar()                       ataque novo
export function ehChuva(nascidas, { minimo = 2, fracao = 0.75 } = {}) {
  const grandes = nascidas.filter((b) => (b.raio ?? 6) >= 6)
  if (grandes.length < minimo) return false
  const deCima = grandes.filter((b) => b.y < 0 && b.vy > 0 && b.x > -20 && b.x < b.largura + 20)
  return deCima.length >= grandes.length * fracao
}

export function criarLeitorDeChuva({ minimo = 1, fracao = 0.75, olharAte = 8 } = {}) {
  let vistas = new WeakSet()
  let nascidas = []
  let decidiu = false
  return {
    get nascidas() {
      return nascidas.length
    },
    reiniciar() {
      vistas = new WeakSet()
      nascidas = []
      decidiu = false
    },
    ver(lista, l) {
      if (decidiu) return false
      for (const b of lista) {
        if (vistas.has(b)) continue
        vistas.add(b)
        if ((b.raio ?? 6) < 6) continue
        nascidas.push({ x: b.x - l.left, y: b.y - l.top, vx: b.vx, vy: b.vy, raio: b.raio, largura: l.width })
      }
      // decide olhando as primeiras `olharAte` balas grandes (a abertura do ataque)
      if (nascidas.length < minimo) return false
      const primeiras = nascidas.slice(0, olharAte)
      if (ehChuva(primeiras, { minimo, fracao })) {
        decidiu = true
        return true
      }
      if (nascidas.length >= olharAte) decidiu = true // não é chuva: não fica olhando o ataque todo
      return false
    },
  }
}
