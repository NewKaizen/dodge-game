import { jogo } from './estado.js'
import { processarLinha } from './protocolo.js'

// Teclas de cada jogador (e.code, independe do layout do teclado).
// Em modo 1 jogador, os dois conjuntos controlam o jogador 1.
const TECLADO = [
  {
    cima: ['KeyW'],
    baixo: ['KeyS'],
    esquerda: ['KeyA'],
    direita: ['KeyD'],
    A: ['Space', 'KeyZ', 'KeyE'],
    B: ['KeyQ', 'KeyX', 'ShiftLeft'],
  },
  {
    cima: ['ArrowUp'],
    baixo: ['ArrowDown'],
    esquerda: ['ArrowLeft'],
    direita: ['ArrowRight'],
    A: ['Enter', 'NumpadEnter'],
    B: ['ShiftRight', 'Backspace'],
  },
]

const DIRECOES = ['cima', 'baixo', 'esquerda', 'direita']
const pressionadas = new Set()
const ultimoJoy = []

function mapear(code) {
  for (let jogador = 0; jogador < TECLADO.length; jogador++) {
    const teclas = TECLADO[jogador]
    if (teclas.A.includes(code)) return { jogador, botao: 'A' }
    if (teclas.B.includes(code)) return { jogador, botao: 'B' }
    if (DIRECOES.some((d) => teclas[d].includes(code))) return { jogador }
  }
  return null
}

function enviarJoy(jogador) {
  const teclas = TECLADO[jogador]
  const algum = (codes) => codes.some((c) => pressionadas.has(c))
  const x = (algum(teclas.direita) ? 100 : 0) - (algum(teclas.esquerda) ? 100 : 0)
  const y = (algum(teclas.baixo) ? 100 : 0) - (algum(teclas.cima) ? 100 : 0)
  const linha = `JOY ${jogador + 1} ${x} ${y}`
  if (linha === ultimoJoy[jogador]) return
  ultimoJoy[jogador] = linha
  processarLinha(linha)
}

function aoPressionar(e) {
  const tecla = mapear(e.code)
  if (!tecla) return
  e.preventDefault()
  if (tecla.botao) {
    if (!e.repeat) processarLinha(`BTN ${tecla.jogador + 1} ${tecla.botao}`)
    return
  }
  pressionadas.add(e.code)
  enviarJoy(tecla.jogador)
}

function aoSoltar(e) {
  const tecla = mapear(e.code)
  if (!tecla) return
  e.preventDefault()
  if (pressionadas.delete(e.code)) enviarJoy(tecla.jogador)
}

function soltarTudo() {
  pressionadas.clear()
  TECLADO.forEach((_, jogador) => enviarJoy(jogador))
}

// Emite linhas do protocolo a partir do teclado, para jogar sem o hardware
export function iniciarSimulador() {
  pararSimulador()
  jogo.update((s) => ({ ...s, conectado: true, fonte: 'simulador' }))

  window.addEventListener('keydown', aoPressionar)
  window.addEventListener('keyup', aoSoltar)
  window.addEventListener('blur', soltarTudo)
}

export function pararSimulador() {
  window.removeEventListener('keydown', aoPressionar)
  window.removeEventListener('keyup', aoSoltar)
  window.removeEventListener('blur', soltarTudo)
  soltarTudo()
  ultimoJoy.length = 0
  jogo.update((s) => ({ ...s, conectado: false, fonte: null }))
}
