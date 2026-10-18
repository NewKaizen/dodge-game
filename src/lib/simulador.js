import { jogo } from './estado.js'
import { processarLinha } from './protocolo.js'
import { pref, aoMudarPref } from '../game/preferencias.js'
import { normalizarTeclas, JOGADORES } from '../game/teclas.js'

// Teclas de cada jogador (e.code, independe do layout do teclado): as
// remapeadas na tela Config (preferência 'teclas'), ou as de fábrica
// (TECLAS_PADRAO em game/teclas.js). Em modo 1 jogador, os dois conjuntos
// controlam o jogador 1.
const lerTeclado = () => {
  const mapa = normalizarTeclas(pref('teclas'))
  return JOGADORES.map((j) => mapa[j])
}
let TECLADO = lerTeclado()
aoMudarPref((chave) => {
  if (chave !== 'teclas') return
  if (ativo) soltarTudo() // nada fica "preso" com o mapa antigo
  TECLADO = lerTeclado()
})

let ativo = false // simulador ligado (o joystick serial não pode levar JOY 0 0 daqui)

const DIRECOES = ['cima', 'baixo', 'esquerda', 'direita']
const pressionadas = new Set()
const ultimoJoy = []

function mapear(code) {
  for (let jogador = 0; jogador < TECLADO.length; jogador++) {
    const teclas = TECLADO[jogador]
    if (teclas.A.includes(code)) return { jogador, botao: 'A' }
    if (teclas.B.includes(code)) return { jogador, botao: 'B' }
    if (teclas.C.includes(code)) return { jogador, botao: 'C' }
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
  ativo = true
  jogo.update((s) => ({ ...s, conectado: true, fonte: 'simulador' }))

  window.addEventListener('keydown', aoPressionar)
  window.addEventListener('keyup', aoSoltar)
  window.addEventListener('blur', soltarTudo)
}

export function pararSimulador() {
  window.removeEventListener('keydown', aoPressionar)
  window.removeEventListener('keyup', aoSoltar)
  window.removeEventListener('blur', soltarTudo)
  if (ativo) soltarTudo()
  ativo = false
  ultimoJoy.length = 0
  jogo.update((s) => ({ ...s, conectado: false, fonte: null }))
}

// Espera a próxima tecla (tela Config, remapear): fn(code) com o e.code dela.
// Enquanto espera, NENHUM outro atalho de teclado dispara (simulador, F da tela
// cheia, Esc/C da pausa, Phaser): o ouvinte fica na fase de captura da janela e
// engole o evento. Devolve a função que cancela a espera.
let esperando = null
function aoCapturar(e) {
  e.preventDefault()
  e.stopImmediatePropagation()
  if (e.repeat || !esperando) return
  const fn = esperando
  pararCaptura()
  fn(e.code)
}
function pararCaptura() {
  esperando = null
  window.removeEventListener('keydown', aoCapturar, true)
}
export function capturarTecla(fn) {
  pararCaptura()
  if (ativo) soltarTudo() // uma direção segurada não fica andando sozinha
  esperando = fn
  window.addEventListener('keydown', aoCapturar, true)
  return () => esperando === fn && pararCaptura()
}
