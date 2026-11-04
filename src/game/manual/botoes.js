import { nomeTecla, TECLAS_PADRAO } from '../teclas.js'

// As dicas de botões do manual, conforme o controle em uso (lógica pura, testada em Node).
// `fonte` é a principal de fontes.js ('serial' | 'gamepad' | 'teclado'); `teclas` é o mapa
// normalizado de teclas.js (normalizarTeclas(pref('teclas'))). Sem fonte conhecida vale o teclado.
//
//   dicasDeBotoes(fonte, teclas)  { mover, A, B }  os nomes que aparecem na tela
//   linhaDeDicas(dicas, partes)   "A: continuar      B: sair" (só as partes pedidas)

const curta = (lista, n = 1) => lista.slice(0, n).map((c) => nomeTecla(c).toUpperCase()).join(' / ')

export function dicasDeBotoes(fonte, teclas = TECLAS_PADRAO) {
  if (fonte === 'gamepad') return { mover: 'ANALÓGICO', A: 'A', B: 'B' }
  if (fonte === 'serial') return { mover: 'JOYSTICK', A: 'BOTÃO A', B: 'BOTÃO B' }
  const t = teclas?.p1 ?? TECLAS_PADRAO.p1
  const setas = ['cima', 'esquerda', 'baixo', 'direita'].map((a) => nomeTecla(t[a]?.[0] ?? '?').toUpperCase())
  return { mover: setas.join(setas.every((s) => s.length === 1) ? '' : ' '), A: curta(t.A), B: curta(t.B) }
}

export function linhaDeDicas(dicas, partes) {
  const rotulo = { mover: 'mover', A: null, B: 'sair' }
  return partes
    .map((p) => (typeof p === 'string' ? `${dicas[p]}: ${rotulo[p]}` : `${dicas[p.tecla]}: ${p.texto}`))
    .join('      ')
}
