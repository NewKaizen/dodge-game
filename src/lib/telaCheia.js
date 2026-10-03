// Tela cheia só do jogo (sem as barras de conexão e o painel de debug).
// Botão na barra de cima (Conectar.svelte) ou tecla F. Esc sai (padrão do navegador).
let alvo = null

export function alternarTelaCheia() {
  if (document.fullscreenElement) return document.exitFullscreen()
  return alvo?.requestFullscreen?.().catch(() => {})
}

// Chame com o elemento que envolve o canvas; devolve a função que desliga a tecla F
export function instalarTelaCheia(elemento) {
  alvo = elemento
  const aoTeclar = (e) => {
    if (e.code !== 'KeyF' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    e.preventDefault()
    alternarTelaCheia()
  }
  window.addEventListener('keydown', aoTeclar)
  return () => {
    window.removeEventListener('keydown', aoTeclar)
    if (alvo === elemento) alvo = null
  }
}
