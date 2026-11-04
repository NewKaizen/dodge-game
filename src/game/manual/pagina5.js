// Página 5 do Manual do Ralsei, "Uma partida de verdade": a máquina de estados do CADERNO, sem Phaser
// (testada em __tests__/pagina5.test.js). A partida em si é uma PvpArena de verdade contra a CPU
// (scenes/ManualRalsei5Partida.js, com manual/partidaDoManual.js e as dicas de manual/dicasDaPartida.js);
// a cena do caderno (scenes/ManualRalsei5.js) desenha em cima disto e repassa ↑/↓ e os botões.
//
//   intro -> enchendo -> descolando -> partida        (antes da partida)
//   voltando -> parabens -> virando -> eAgora -> saindo   (a partida acabou: a cena reabre com o resultado)
//
//   intro       Ralsei fala (FALAS_INTRO5); A passa
//   enchendo    os desenhos de giz da arena "ganham cor" (ENCHER_MS); a arena de verdade já carrega por baixo
//   descolando  a folha descola e mostra a arena de verdade, no mesmo lugar do desenho (DESCOLAR_MS)
//   partida     a arena joga; esta página espera (a cena do caderno sai)
//   voltando    a folha volta por cima da arena (VOLTAR_MS)
//   parabens    ganhando ou perdendo, o Ralsei comemora; o adesivo "MANUAL ESSENCIAL ✓" (evento 'essencial')
//   virando     a cena anima a virada e chama p.terminouDeVirar()
//   eAgora      a página "e agora?": ↑/↓ escolhe, A vai (evento { tipo: 'ir', destino })
//
// "Reduzir animações" (calmo): sem encher, descolar e voltar (corte direto). B sai a qualquer hora (a cena
// confirma só no meio da partida, que é a arena).
// Eventos (drenar): { tipo: 'etapa', etapa } · { tipo: 'fala' } · { tipo: 'lancarArena' } (a arena começa a
// carregar por baixo) · { tipo: 'abrirArena' } (a partida começa) · { tipo: 'essencial' } (salvar) ·
// { tipo: 'ir', destino }.

export const ETAPAS5 = ['intro', 'enchendo', 'descolando', 'partida', 'voltando', 'parabens', 'virando', 'eAgora', 'saindo']

export const FALAS_INTRO5 = [
  'Página 5! Agora é uma partida de verdade, contra mim.',
  'Use tudo o que você aprendeu: desviar, escolher a carta e cuidar da energia.',
  'Eu jogo bem devagarinho. E se precisar, eu dou uma dica ali no cantinho!',
]

export const FALAS_FIM = {
  venceu: ['Você venceu! Que partida bonita!', 'Você aprendeu o básico! Este adesivo é seu.'],
  perdeu: ['Essa foi por pouco! Ganhar ou perder faz parte.', 'O importante: você aprendeu o básico! Este adesivo é seu.'],
  empate: ['Empate! Ninguém caiu sozinho.', 'E você aprendeu o básico! Este adesivo é seu.'],
}
export const FALA_E_AGORA = 'Você terminou o manual essencial! Escolha a sua próxima aventura:'

export const OPCOES_E_AGORA = [
  { id: 'cpu', rotulo: 'JOGAR CONTRA A CPU', dica: 'uma partida normal, com o nível que você quiser' },
  { id: 'online', rotulo: 'ONLINE', dica: 'jogar com amigos (internet ou rede local)' },
  { id: 'cartas', rotulo: 'CARTAS E ARENAS', dica: 'o guia de todas as cartas e das rodadas bônus' },
  { id: 'indice', rotulo: 'VOLTAR AO ÍNDICE', dica: 'as páginas do manual, para jogar de novo' },
]

export const ENCHER_MS = 1500
export const DESCOLAR_MS = 900
export const VOLTAR_MS = 900

// resultado: null (antes da partida) ou { vencedor: 1 | 2 | 0 } (1 = você, 2 = a CPU, 0 = empate)
export function criarPagina5({ resultado = null, calmo = false } = {}) {
  const fim = resultado ? (resultado.vencedor === 1 ? 'venceu' : resultado.vencedor === 0 ? 'empate' : 'perdeu') : null
  const p = {
    etapa: resultado ? 'voltando' : 'intro',
    resultado: fim,
    falas: resultado ? FALAS_FIM[fim] : FALAS_INTRO5,
    falaIdx: 0,
    fala: '',
    tempoEtapa: 0,
    opcao: 0,
    eventos: [],
    get opcoes() {
      return OPCOES_E_AGORA
    },
    get emPartida() {
      return ['enchendo', 'descolando', 'partida'].includes(p.etapa)
    },
  }
  const emitir = (e) => p.eventos.push(e)
  const ir = (etapa) => {
    p.etapa = etapa
    p.tempoEtapa = 0
    if (etapa === 'parabens') {
      p.falas = FALAS_FIM[p.resultado]
      p.falaIdx = 0
      p.fala = p.falas[0]
      emitir({ tipo: 'essencial' })
    }
    if (etapa === 'eAgora') p.fala = FALA_E_AGORA
    emitir({ tipo: 'etapa', etapa })
  }
  p.fala = resultado ? p.falas[0] : FALAS_INTRO5[0]

  const comecarPartida = () => {
    emitir({ tipo: 'lancarArena' })
    if (calmo) {
      // corte: a arena aparece na hora
      ir('partida')
      emitir({ tipo: 'abrirArena' })
    } else ir('enchendo')
  }

  if (resultado && calmo) ir('parabens')

  // A: passa a fala / confirma. Devolve true se fez algo.
  p.avancar = () => {
    if (p.etapa === 'intro') {
      if (p.falaIdx < p.falas.length - 1) {
        p.fala = p.falas[++p.falaIdx]
        emitir({ tipo: 'fala' })
      } else comecarPartida()
      return true
    }
    if (p.etapa === 'parabens') {
      if (p.falaIdx < p.falas.length - 1) {
        p.fala = p.falas[++p.falaIdx]
        emitir({ tipo: 'fala' })
      } else ir('virando')
      return true
    }
    if (p.etapa === 'eAgora') {
      emitir({ tipo: 'ir', destino: OPCOES_E_AGORA[p.opcao].id })
      ir('saindo')
      return true
    }
    return false
  }

  // ↑/↓ na página "e agora?"
  p.mover = (direcao) => {
    if (p.etapa !== 'eAgora' || (direcao !== 'cima' && direcao !== 'baixo')) return false
    const n = OPCOES_E_AGORA.length
    p.opcao = (p.opcao + (direcao === 'baixo' ? 1 : n - 1)) % n
    return true
  }

  p.tick = (dt) => {
    p.tempoEtapa += dt
    if (p.etapa === 'enchendo' && p.tempoEtapa >= ENCHER_MS) ir('descolando')
    else if (p.etapa === 'descolando' && p.tempoEtapa >= DESCOLAR_MS) {
      ir('partida')
      emitir({ tipo: 'abrirArena' })
    } else if (p.etapa === 'voltando' && p.tempoEtapa >= VOLTAR_MS) ir('parabens')
  }

  // a cena terminou de animar a virada para a página "e agora?"
  p.terminouDeVirar = () => {
    if (p.etapa === 'virando') ir('eAgora')
  }

  // fração do "encher de cor" (0..1) e do "descolar" (0..1) para a cena desenhar
  Object.defineProperty(p, 'cor', { get: () => (p.etapa === 'enchendo' ? Math.min(1, p.tempoEtapa / ENCHER_MS) : ['descolando', 'partida'].includes(p.etapa) ? 1 : 0) })
  Object.defineProperty(p, 'descolar', { get: () => (p.etapa === 'descolando' ? Math.min(1, p.tempoEtapa / DESCOLAR_MS) : p.etapa === 'partida' ? 1 : 0) })
  Object.defineProperty(p, 'volta', { get: () => (p.etapa === 'voltando' ? Math.min(1, p.tempoEtapa / VOLTAR_MS) : 1) })

  p.drenar = () => {
    const e = p.eventos
    p.eventos = []
    return e
  }
  return p
}

// a cara do Ralsei no caderno
export function expressaoDaPagina5(p) {
  if (p.etapa === 'parabens' || p.etapa === 'virando') return p.resultado === 'perdeu' && p.falaIdx === 0 ? 'incentivo' : 'animado'
  if (p.etapa === 'enchendo' || p.etapa === 'descolando') return 'concentrado'
  return 'feliz'
}
