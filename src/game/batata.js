import { pref, definirPref } from './preferencias.js'

// A RESOLUÇÃO BATATA LIGA SOZINHA (resolucao.js; a opção fica em CONFIGURAÇÕES > GRÁFICOS > RESOLUÇÃO).
//
//   vigiarFps(game)   uma vez (Boot): se o jogo passar 3 s seguidos abaixo de 50 FPS, liga a BATATA e mostra um
//                     aviso com DESFAZER. Desfazer volta a NORMAL e nunca mais liga sozinha (batataAutomatica).
//
// Não conta: os primeiros segundos depois do boot e de cada troca de cena (o carregamento trava uns quadros), a
// aba escondida e o navegador controlado por automação (navigator.webdriver: as ferramentas de desempenho freiam a
// CPU de propósito e mediriam outra coisa com a BATATA ligada).
export const LIMITE_FPS = 50
export const JANELA_MS = 3000
const CARENCIA_MS = 4000 // depois do boot e de cada cena nova

// a regra, pura (testada em __tests__/batata.test.js): recebe o FPS medido e o tempo de cada amostra
export function criarJuiz({ limite = LIMITE_FPS, janelaMs = JANELA_MS } = {}) {
  let abaixoDesde = null
  return {
    amostra(fps, agora) {
      if (!(fps < limite)) {
        abaixoDesde = null
        return false
      }
      if (abaixoDesde === null) abaixoDesde = agora
      return agora - abaixoDesde >= janelaMs
    },
    zerar() {
      abaixoDesde = null
    },
  }
}

export function vigiarFps(game, { doc = globalThis.document, nav = globalThis.navigator } = {}) {
  if (!game?.events || nav?.webdriver) return () => {}
  const juiz = criarJuiz()
  let carenciaAte = performance.now() + CARENCIA_MS
  let ultimo = 0
  const aoCena = () => {
    carenciaAte = performance.now() + CARENCIA_MS
    juiz.zerar()
  }
  for (const s of game.scene.scenes) s.sys.events.on('start', aoCena)
  game.events.on('cenanova', (s) => s?.sys.events.on('start', aoCena)) // cenas carregadas depois (cenasPreguicosas.js)
  const aoPasso = () => {
    const agora = performance.now()
    if (agora - ultimo < 250) return // 4 amostras por segundo
    ultimo = agora
    if (pref('resolucao') !== 'normal' || !pref('batataAutomatica')) return
    if (doc?.hidden || agora < carenciaAte) return juiz.zerar()
    if (!juiz.amostra(game.loop.actualFps, agora)) return
    definirPref('resolucao', 'batata')
    mostrarAviso(doc)
  }
  game.events.on('poststep', aoPasso)
  return () => game.events.off('poststep', aoPasso)
}

// o aviso: HTML por cima do jogo (como o HUD de desempenho), some sozinho em 12 s
function mostrarAviso(doc) {
  if (!doc?.body) return
  doc.getElementById('aviso-batata')?.remove()
  const caixa = doc.createElement('div')
  caixa.id = 'aviso-batata'
  caixa.setAttribute('role', 'status')
  Object.assign(caixa.style, {
    position: 'fixed',
    left: '50%',
    bottom: '24px',
    transform: 'translateX(-50%)',
    zIndex: '1000',
    background: '#0b0914',
    color: '#ffffff',
    border: '2px solid #ffe040',
    padding: '10px 14px',
    font: '14px "Pixelify Sans", monospace',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    maxWidth: '92vw',
  })
  const texto = doc.createElement('span')
  texto.textContent = 'O jogo estava abaixo de 50 FPS: liguei a RESOLUÇÃO BATATA (mais leve). Dá para mudar em CONFIGURAÇÕES > GRÁFICOS.'
  const botao = doc.createElement('button')
  botao.textContent = 'DESFAZER'
  Object.assign(botao.style, { font: 'inherit', background: '#ffe040', color: '#000000', border: '0', padding: '6px 10px', cursor: 'pointer' })
  const fechar = () => caixa.remove()
  botao.addEventListener('click', () => {
    definirPref('batataAutomatica', false) // quem desfez não quer de novo
    definirPref('resolucao', 'normal')
    fechar()
  })
  caixa.append(texto, botao)
  doc.body.append(caixa)
  setTimeout(fechar, 12_000)
}
