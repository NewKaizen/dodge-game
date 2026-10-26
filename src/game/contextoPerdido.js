// O navegador pode derrubar o contexto WebGL do jogo (driver reiniciou, placa de
// vídeo trocada, aba em segundo plano por muito tempo, pouca memória de vídeo;
// no Firefox costuma acontecer em PCs fracos): o canvas fica PRETO e nada mais
// responde. Aqui avisamos em português e um clique recarrega a página.
//
//   vigiarContextoWebgl(canvas, container, doc?)  devolve a função que desliga
export const MENSAGEM_CONTEXTO_PERDIDO = 'o vídeo do navegador reiniciou — clique para recarregar'

export function vigiarContextoWebgl(canvas, container, doc = globalThis.document, recarregar = () => location.reload()) {
  if (!canvas) return () => {}
  let aviso = null
  const aoPerder = (e) => {
    e.preventDefault?.() // deixa o navegador tentar restaurar sozinho (webglcontextrestored)
    if (aviso) return
    aviso = doc.createElement('div')
    aviso.textContent = MENSAGEM_CONTEXTO_PERDIDO
    aviso.setAttribute('role', 'alert')
    aviso.style.cssText =
      'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:16px;' +
      'background:rgba(0,0,0,.92);color:#fff;font:18px monospace;cursor:pointer;z-index:5'
    aviso.addEventListener('click', recarregar)
    container.appendChild(aviso)
  }
  const aoVoltar = () => {
    aviso?.remove()
    aviso = null
  }
  canvas.addEventListener('webglcontextlost', aoPerder)
  canvas.addEventListener('webglcontextrestored', aoVoltar)
  return () => {
    canvas.removeEventListener('webglcontextlost', aoPerder)
    canvas.removeEventListener('webglcontextrestored', aoVoltar)
    aoVoltar()
  }
}
