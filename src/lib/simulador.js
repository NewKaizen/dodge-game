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
// Modo LAN (lib/lan/): as duas mãos do teclado comandam o jogador 1, porque o
// jogador 2 está no outro PC
let unico = false
export function setTecladoUnico(valor) {
  if (unico === Boolean(valor)) return
  if (ativo) soltarTudo()
  unico = Boolean(valor)
}
const dono = (jogador) => (unico ? 0 : jogador)

const DIRECOES = ['cima', 'baixo', 'esquerda', 'direita']
const pressionadas = new Set()
const ultimoJoy = []

function mapear(code) {
  for (let jogador = 0; jogador < TECLADO.length; jogador++) {
    const teclas = TECLADO[jogador]
    if (teclas.A.includes(code)) return { jogador: dono(jogador), botao: 'A' }
    if (teclas.B.includes(code)) return { jogador: dono(jogador), botao: 'B' }
    if (teclas.C.includes(code)) return { jogador: dono(jogador), botao: 'C' }
    if (DIRECOES.some((d) => teclas[d].includes(code))) return { jogador: dono(jogador) }
  }
  return null
}

function enviarJoy(jogador) {
  // as teclas de todos os conjuntos que comandam este jogador
  const conjuntos = TECLADO.filter((_, j) => dono(j) === jogador)
  const algum = (d) => conjuntos.some((teclas) => teclas[d].some((c) => pressionadas.has(c)))
  const x = (algum('direita') ? 100 : 0) - (algum('esquerda') ? 100 : 0)
  const y = (algum('baixo') ? 100 : 0) - (algum('cima') ? 100 : 0)
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
  // só os jogadores deste teclado (no LAN, o jogador 2 vem do outro PC)
  new Set(TECLADO.map((_, j) => dono(j))).forEach(enviarJoy)
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

// Digitar um texto (lobby LAN: nome, IP, chat). Enquanto digita, nenhuma tecla
// chega ao jogo (mesma captura da espera de tecla acima). opcoes:
//   inicial, max, permitido (regex de UM caractere)
//   aoMudar(texto)  a cada tecla       aoConfirmar(texto)  Enter
//   aoCancelar()    Esc
// Devolve a função que cancela.
export function capturarTexto({ inicial = '', max = 24, permitido = /^[\p{L}\p{N} .,:!?'"@#()+\-_/*=<>%&]$/u, aoMudar, aoConfirmar, aoCancelar } = {}) {
  pararCaptura()
  if (ativo) soltarTudo()
  let texto = String(inicial).slice(0, max)
  const fim = () => window.removeEventListener('keydown', aoTeclar, true)
  function aoTeclar(e) {
    e.preventDefault()
    e.stopImmediatePropagation()
    if (e.key === 'Enter' || e.key === 'NumpadEnter') {
      if (e.repeat) return
      fim()
      return aoConfirmar?.(texto)
    }
    if (e.key === 'Escape') {
      fim()
      return aoCancelar?.()
    }
    if (e.key === 'Backspace') texto = texto.slice(0, -1)
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && permitido.test(e.key) && texto.length < max) texto += e.key
    else return
    aoMudar?.(texto)
  }
  window.addEventListener('keydown', aoTeclar, true)
  return fim
}
