import { distorcerEParar } from '../audio.js'
import { flashTela } from './flash.js'
import { shake } from './shake.js'

// Fim de luta: impacto na derrota do chefe (câmera lenta curta, flash, tremor
// e a música distorcendo até parar) e a espera pelo silêncio antes de sair
// para a tela de vitória.
//
//   impactoDerrota(cena)   no golpe final (o sprite se desfaz em Inimigo.sumir)
//   fimSuave(cena)         chefe poupado: a música só "desce" e some
//   depoisDoSilencio(cena, fn)   chama fn quando o efeito acabou + um respiro

const DISTORCAO_MS = 1700
const SUAVE_MS = 1400
const SILENCIO_MS = 450 // pausa em silêncio depois que a música morre (+ o fade da cena ≈ 0,8 s)
const LENTO = 0.3 // escala de tempo da câmera lenta
const LENTO_MS = 520 // duração (tempo real) da câmera lenta
const VOLTA_MS = 250 // rampa de volta à velocidade normal

// por cena: { promessa, terminouEm, esperando }
const estados = new WeakMap()

function registrar(cena, promessa) {
  const estado = { promessa: null, terminouEm: null, esperando: false }
  estado.promessa = promessa.then(() => (estado.terminouEm = performance.now()))
  estados.set(cena, estado)
  cena.events.once('shutdown', () => {
    estados.delete(cena)
    velocidade(cena, 1)
  })
}

function velocidade(cena, escala) {
  if (cena.time) cena.time.timeScale = escala
}

// Câmera lenta: LENTO_MS em LENTO e depois volta a 1 em VOLTA_MS (tempo real).
// A cena redefine tweens.timeScale no próprio update() (debug.acelerar), então
// a escala é reaplicada em POST_UPDATE, multiplicando o valor daquele quadro.
function cameraLenta(cena) {
  const inicio = performance.now()
  const aplicar = () => {
    const dt = performance.now() - inicio
    const escala = dt < LENTO_MS ? LENTO : Math.min(1, LENTO + ((1 - LENTO) * (dt - LENTO_MS)) / VOLTA_MS)
    velocidade(cena, escala)
    cena.tweens.timeScale *= escala
    if (escala >= 1) cena.events.off('postupdate', aplicar)
  }
  cena.events.on('postupdate', aplicar)
  cena.events.once('shutdown', () => cena.events.off('postupdate', aplicar))
  aplicar()
}

export function impactoDerrota(cena) {
  flashTela(cena, 0xffffff, 0.85, 420)
  shake(cena, 380, 0.022)
  cameraLenta(cena)
  registrar(cena, distorcerEParar(DISTORCAO_MS))
}

export function fimSuave(cena) {
  flashTela(cena, 0xffffff, 0.35, 600)
  registrar(cena, distorcerEParar(SUAVE_MS, { suave: true }))
}

// Espera a música terminar de morrer e mais SILENCIO_MS antes de fn.
// Chamadas repetidas (A apertado várias vezes) são ignoradas.
export function depoisDoSilencio(cena, fn) {
  const estado = estados.get(cena)
  if (!estado) return fn()
  if (estado.esperando) return
  estado.esperando = true
  estado.promessa.then(() => {
    const falta = Math.max(0, SILENCIO_MS - (performance.now() - estado.terminouEm))
    setTimeout(() => {
      if (!cena.sys.isActive()) return
      estados.delete(cena)
      fn()
    }, falta)
  })
}
