// Digitar no celular: as telas de texto do jogo (nome, código da sala, chat, nome do perfil) leem o
// teclado físico (lib/simulador.js capturarTexto). Sem teclado físico, o teclado da tela só abre
// com um <input> de verdade focado: no MODO TOQUE (lib/toque.js) capturarTexto abre também este
// campo, por cima do jogo, com OK e ✕. O texto continua passando pelo mesmo filtro (`permitido`,
// `max`) e pelos mesmos aoMudar / aoConfirmar / aoCancelar; a cena não sabe a diferença.
// O foco acontece dentro do toque no botão A (o gesto que o iPhone exige para abrir o teclado);
// se o navegador não abrir, tocar no campo abre.
//
//   const fechar = abrirCampoToque({ inicial, max, permitido, aoMudar, aoConfirmar, aoCancelar })
//   ehCampoToque(alvo)   o evento veio deste campo (capturarTexto deixa o campo tratar)

let atual = null

export const ehCampoToque = (alvo) => Boolean(atual && alvo && atual.contains(alvo))

export function filtrarTexto(texto, { max, permitido }) {
  let saida = ''
  for (const c of String(texto)) {
    if (saida.length >= max) break
    if (permitido.test(c)) saida += c
  }
  return saida
}

export function abrirCampoToque({ inicial = '', max = 24, permitido, aoMudar, aoConfirmar, aoCancelar }) {
  if (typeof document === 'undefined') return () => {}
  atual?.fechar?.()
  const caixa = document.createElement('div')
  caixa.className = 'campo-toque'
  caixa.innerHTML = `<input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="texto" /><button type="button" class="ok" aria-label="confirmar">OK</button><button type="button" class="x" aria-label="cancelar">✕</button>`
  const campo = caixa.querySelector('input')
  campo.maxLength = max
  campo.value = filtrarTexto(inicial, { max, permitido })
  let fechado = false
  const fechar = () => {
    if (fechado) return
    fechado = true
    caixa.remove()
    if (atual === caixa) atual = null
  }
  caixa.fechar = fechar
  campo.addEventListener('input', () => {
    const limpo = filtrarTexto(campo.value, { max, permitido })
    if (limpo !== campo.value) campo.value = limpo
    aoMudar?.(limpo)
  })
  campo.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault()
      fechar()
      aoConfirmar?.(campo.value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      fechar()
      aoCancelar?.()
    }
  })
  campo.addEventListener('keyup', (e) => e.stopPropagation())
  const botao = (seletor, fn) =>
    caixa.querySelector(seletor).addEventListener('pointerdown', (e) => {
      e.preventDefault() // o campo não perde o foco antes da hora
      e.stopPropagation()
      fechar()
      fn()
    })
  botao('.ok', () => aoConfirmar?.(campo.value))
  botao('.x', () => aoCancelar?.())
  caixa.addEventListener('pointerdown', (e) => e.stopPropagation())

  // dentro do elemento em tela cheia, senão não aparece
  const pai = document.fullscreenElement ?? document.webkitFullscreenElement ?? document.body
  pai.appendChild(caixa)
  atual = caixa
  try {
    campo.focus({ preventScroll: true })
    campo.setSelectionRange(campo.value.length, campo.value.length)
  } catch {}
  return fechar
}
