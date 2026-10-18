// Teclas do teclado (simulador, lib/simulador.js) de cada jogador e o
// remapeamento da tela Config (aba CONTROLES). Lógica pura, testada em Node
// (__tests__/teclas.test.js). Os códigos são os de KeyboardEvent.code: a
// posição física da tecla, que não muda com o layout do teclado.
//
//   normalizarTeclas(pref('teclas'))   mapa completo e válido (o padrão se vier quebrado)
//   atribuirTecla(mapa, 'p1', 'A', 'KeyK')   { mapa, tirada } ou { erro } (ver abaixo)
//   nomeTecla('ShiftRight')            'Shift dir.' (com layout: o que está impresso na tecla)
//   resumoTeclas(['Space', 'KeyZ'])    'Espaço / Z'
//
// Mapa: { p1: { cima: [...], baixo, esquerda, direita, A, B, C }, p2: {...} },
// C = pausa. Cada ação tem pelo menos uma tecla e nenhuma tecla vale para duas
// ações (nem entre os jogadores). O joystick serial não passa por aqui.

export const JOGADORES = ['p1', 'p2']
export const ACOES = ['cima', 'baixo', 'esquerda', 'direita', 'A', 'B', 'C']
export const ROTULO_ACAO = {
  cima: 'CIMA',
  baixo: 'BAIXO',
  esquerda: 'ESQUERDA',
  direita: 'DIREITA',
  A: 'A · CONFIRMAR',
  B: 'B · VOLTAR',
  C: 'PAUSA',
}

// Em modo 1 jogador, os dois conjuntos controlam o jogador 1.
export const TECLAS_PADRAO = {
  p1: {
    cima: ['KeyW'],
    baixo: ['KeyS'],
    esquerda: ['KeyA'],
    direita: ['KeyD'],
    A: ['Space', 'KeyZ', 'KeyE'],
    B: ['KeyQ', 'KeyX', 'ShiftLeft'],
    C: ['KeyC', 'Escape'],
  },
  p2: {
    cima: ['ArrowUp'],
    baixo: ['ArrowDown'],
    esquerda: ['ArrowLeft'],
    direita: ['ArrowRight'],
    A: ['Enter', 'NumpadEnter'],
    B: ['ShiftRight', 'Backspace'],
    C: ['KeyP'],
  },
}

// Teclas que não dá para usar no jogo: atalhos da página e do navegador.
// (Esc também cancela a espera por uma tecla; F alterna a tela cheia, lib/telaCheia.js)
export const RESERVADAS = {
  KeyF: 'F é a tecla da tela cheia',
  Escape: 'Esc cancela a escolha',
  F5: 'F5 recarrega a página',
  F11: 'F11 é a tela cheia do navegador',
  F12: 'F12 abre as ferramentas do navegador',
  Tab: 'Tab muda o foco da página',
  MetaLeft: 'a tecla do sistema não serve',
  MetaRight: 'a tecla do sistema não serve',
  ContextMenu: 'a tecla de menu não serve',
}
// Esc já vem de fábrica como pausa do P1: pode continuar lá, só não dá para escolher de novo
const RESERVADAS_FORA_DO_PADRAO = (code) => code in RESERVADAS && code !== 'Escape'

const CODIGO_VALIDO = /^[A-Za-z][A-Za-z0-9]{0,23}$/

export const copiarTeclas = (mapa) =>
  Object.fromEntries(JOGADORES.map((j) => [j, Object.fromEntries(ACOES.map((a) => [a, [...mapa[j][a]]]))]))

// Problemas de um mapa (lista vazia = válido): forma, ação sem tecla, código
// estranho, tecla reservada, tecla repetida
export function problemasDasTeclas(mapa) {
  if (!mapa || typeof mapa !== 'object') return ['não é um mapa']
  const problemas = []
  const dono = new Map()
  for (const j of JOGADORES) {
    const teclas = mapa[j]
    if (!teclas || typeof teclas !== 'object') {
      problemas.push(`${j}: faltando`)
      continue
    }
    for (const a of ACOES) {
      const lista = teclas[a]
      if (!Array.isArray(lista) || lista.length === 0) {
        problemas.push(`${j}.${a}: sem tecla`)
        continue
      }
      for (const code of lista) {
        if (typeof code !== 'string' || !CODIGO_VALIDO.test(code)) problemas.push(`${j}.${a}: código inválido ${code}`)
        else if (RESERVADAS_FORA_DO_PADRAO(code)) problemas.push(`${j}.${a}: ${code} é reservada`)
        else if (dono.has(code)) problemas.push(`${j}.${a}: ${code} repetida (já em ${dono.get(code)})`)
        else dono.set(code, `${j}.${a}`)
      }
    }
  }
  return problemas
}

// O mapa salvo (ou null) -> mapa completo e válido. Qualquer problema volta ao padrão.
export function normalizarTeclas(salvo) {
  if (salvo && problemasDasTeclas(salvo).length === 0) return copiarTeclas(salvo)
  return copiarTeclas(TECLAS_PADRAO)
}

export const ehPadrao = (mapa) => JSON.stringify(copiarTeclas(mapa)) === JSON.stringify(TECLAS_PADRAO)

// Quem usa a tecla: { jogador, acao } ou null
export function donoDaTecla(mapa, code) {
  for (const jogador of JOGADORES) for (const acao of ACOES) if (mapa[jogador][acao].includes(code)) return { jogador, acao }
  return null
}

// Põe `code` como a (única) tecla de jogador/acao. Se a tecla já era de outra
// ação, sai de lá; se aquela ação ficar sem nenhuma, ela fica com as teclas
// antigas desta (troca). Devolve
//   { mapa, tirada: null }                         sem conflito
//   { mapa, tirada: { jogador, acao, trocou } }    a tecla saiu de outra ação
//                                                  (trocou: a outra ficou com as antigas)
//   { mapa, igual: true }                          já era exatamente isso
//   { erro: 'texto' }                              tecla reservada / inválida
export function atribuirTecla(mapa, jogador, acao, code) {
  if (!JOGADORES.includes(jogador) || !ACOES.includes(acao)) return { erro: 'ação desconhecida' }
  if (typeof code !== 'string' || !CODIGO_VALIDO.test(code)) return { erro: 'tecla desconhecida' }
  if (code in RESERVADAS) return { erro: RESERVADAS[code] }
  const novo = copiarTeclas(mapa)
  const antigas = novo[jogador][acao]
  if (antigas.length === 1 && antigas[0] === code) return { mapa: novo, igual: true }
  const dono = donoDaTecla(novo, code)
  let tirada = null
  if (dono && !(dono.jogador === jogador && dono.acao === acao)) {
    const lista = novo[dono.jogador][dono.acao].filter((c) => c !== code)
    const trocou = lista.length === 0
    novo[dono.jogador][dono.acao] = trocou ? antigas.filter((c) => c !== code) : lista
    tirada = { ...dono, trocou }
  }
  novo[jogador][acao] = [code]
  return { mapa: novo, tirada }
}

// ---------- nomes legíveis ----------

const NOMES = {
  Space: 'Espaço',
  Enter: 'Enter',
  NumpadEnter: 'Enter num.',
  Backspace: 'Backspace',
  Escape: 'Esc',
  Tab: 'Tab',
  CapsLock: 'Caps Lock',
  ShiftLeft: 'Shift esq.',
  ShiftRight: 'Shift dir.',
  ControlLeft: 'Ctrl esq.',
  ControlRight: 'Ctrl dir.',
  AltLeft: 'Alt',
  AltRight: 'Alt Gr',
  MetaLeft: 'Sistema',
  MetaRight: 'Sistema',
  ContextMenu: 'Menu',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Insert: 'Insert',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
  NumpadDecimal: 'Num ,',
  NumpadComma: 'Num ,',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  IntlBackslash: '\\',
  IntlRo: '/',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
}

// Nome curto da tecla. `layout` (opcional) é o mapa code -> caractere do
// teclado de quem joga (navigator.keyboard.getLayoutMap(), só no Chrome): com
// ele, a tecla do Ç aparece como "Ç" em vez de ";".
export function nomeTecla(code, layout = null) {
  if (typeof code !== 'string' || !code) return '?'
  if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`
  if (/^F\d{1,2}$/.test(code)) return code
  const impresso = layout?.get?.(code)
  if (typeof impresso === 'string' && impresso.length === 1 && impresso.trim()) return impresso.toUpperCase()
  if (code.startsWith('Key') && code.length === 4) return code.slice(3)
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5)
  return NOMES[code] ?? code
}

export const resumoTeclas = (lista, layout = null) => lista.map((c) => nomeTecla(c, layout)).join(' / ')

export const ehSeta = (code) => code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight'
