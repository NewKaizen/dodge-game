// Tela cheia só do jogo (sem as barras de conexão e o painel de debug).
// Botão na barra de cima (Conectar.svelte), tecla F, CONFIGURAÇÕES → JOGO ou, no celular, o botão
// do canto dos controles na tela (ui/ControlesToque.svelte) e o primeiro toque (lib/toque.js).
// Esc sai (padrão do navegador).
//
// Celular: junto com a tela cheia o jogo pede para travar a tela deitada (screen.orientation.lock,
// só funciona em tela cheia, no Chrome do Android). O Safari do iPhone não tem tela cheia de
// elemento nem trava: lá fica a tela "gire o celular" e as margens seguras (env(safe-area-inset-*)).
let alvo = null

export const telaCheiaAtual = () => (typeof document === 'undefined' ? null : document.fullscreenElement ?? document.webkitFullscreenElement ?? null)

export const telaCheiaSuportada = () => {
  if (typeof document === 'undefined') return false
  const el = alvo ?? document.documentElement
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen)
}

function travarDeitado() {
  try {
    screen.orientation?.lock?.('landscape')?.catch?.(() => {})
  } catch {}
}

export function pedirTelaCheia() {
  if (!alvo || telaCheiaAtual()) return Promise.resolve()
  const pedir = alvo.requestFullscreen?.bind(alvo) ?? alvo.webkitRequestFullscreen?.bind(alvo)
  if (!pedir) return Promise.resolve()
  try {
    // navigationUI 'hide': no Android some a barra de navegação do sistema
    return Promise.resolve(pedir({ navigationUI: 'hide' }))
      .then(travarDeitado)
      .catch(() => {})
  } catch {
    return Promise.resolve()
  }
}

export function sairDaTelaCheia() {
  try {
    screen.orientation?.unlock?.()
  } catch {}
  const sair = document.exitFullscreen?.bind(document) ?? document.webkitExitFullscreen?.bind(document)
  return Promise.resolve(sair?.()).catch(() => {})
}

export function alternarTelaCheia() {
  return telaCheiaAtual() ? sairDaTelaCheia() : pedirTelaCheia()
}

const emCampoDeTexto = (e) => {
  const t = e.target
  return Boolean(t?.isContentEditable || (t?.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))
}

// Chame com o elemento que envolve o canvas; devolve a função que desliga a tecla F
export function instalarTelaCheia(elemento) {
  alvo = elemento
  const aoTeclar = (e) => {
    if (e.code !== 'KeyF' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || emCampoDeTexto(e)) return
    e.preventDefault()
    alternarTelaCheia()
  }
  window.addEventListener('keydown', aoTeclar)
  return () => {
    window.removeEventListener('keydown', aoTeclar)
    if (alvo === elemento) alvo = null
  }
}
