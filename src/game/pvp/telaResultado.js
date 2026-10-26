// Estado de cada abertura da PvpResultado (lógica pura, testável em Node).
//
// O Phaser REAPROVEITA a instância da cena: o `this` da segunda partida é o
// mesmo da primeira. O que a tela guardou da vez anterior (os textos da
// partida rápida, a dica de pular, a entrada do vencedor...) continua lá,
// já destruído. Foi isso que travou a tela depois da 2ª partida rápida: o
// create chamava atualizarCasual() com os textos velhos, o setColor deles
// estourava (Frame sem canvas) e a cena morria no meio, nos dois PCs.
// create() começa com Object.assign(this, estadoInicialDaTela()).
//
// Rede de segurança: se as opções não aparecerem em LIMITE_MS (uma etapa que
// estourou, a recompensa que nunca chega...), a tela libera os botões com um
// aviso curto (destravar).
export const LIMITE_MS = 20000

export const estadoInicialDaTela = () => ({
  saindo: false,
  liberado: false,
  liberou: false,
  pulando: false,
  pulandoXp: false,
  relogio: 0,
  contadores: [],
  ultimoTic: 0,
  // XP
  painelXp: null,
  xpAnimacao: null,
  xpEsperaAte: null,
  xpNivelVisto: null,
  barraXp: null,
  xpTitulo: null,
  xpMotivo: null,
  xpNivel: null,
  xpCheio: null,
  xpNumeros: null,
  xpSubiu: null,
  xpItens: null,
  xpProxima: null,
  // entrada do vencedor e título
  entrada: null,
  ladoEntrada: 0,
  faixaEntrada: null,
  spriteEntrada: null,
  nomeEntrada: null,
  legendaEntrada: null,
  titulo: null,
  dicaPular: null,
  // partida rápida
  opcao: 0,
  revanche: null,
  linhasCasual: null,
  cursorCasual: null,
  avisoCasual: null,
})

// a tela ficou sem as opções tempo demais: libera assim mesmo
export const deveDestravar = ({ relogio, liberou, saindo }, limiteMs = LIMITE_MS) => !liberou && !saindo && relogio >= limiteMs
