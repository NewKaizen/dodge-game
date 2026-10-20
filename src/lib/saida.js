import { jogo, MAX_JOGADORES } from './estado.js'
import { enviarSerial } from './serial.js'
import { porcentagemVida } from './conversao.js'

// Comandos do jogo para o joystick (docs/protocolo-serial.md): o Arduino
// principal (jogador 1) executa os "1 ..." e repassa os "2 ..." ao secundário.
// As cenas só avisam o que aconteceu; aqui decide o que mandar e evita repetir
// linha (a serial é 9600 baud). Sem joystick conectado, nada sai.
//
//   entrarNoJogo()            começou uma luta: GAME + LED azul
//   voltarAoMenu()            saiu da luta: MENU + LED verde
//   informarVida(j, hp, max)  pode chamar todo frame: só manda VIDA quando o % muda
//   levouGolpe(j)             BUZZER do jogador (e LED vermelho piscando no P1)

const PISCAR_LED = 300 // ms do vermelho do golpe antes de voltar ao azul
const INTERVALO_BUZZER = 250 // ms: vários tiros juntos tocam uma vez só
const ESPERA_ESTADO = 100 // ms: "recomeçar a luta" (MENU e GAME seguidos) não pisca nada

let fonte = null
let estado = 'MENU' // 'MENU' | 'GAME'
let estadoEnviado = null
let timerEstado = null
let timerLed = null
let vidasEnviadas = []
const ultimoBuzzer = []

function enviar(linha) {
  if (fonte !== 'serial') return Promise.resolve()
  if (import.meta.env?.DEV) console.debug('[joystick] <-', linha)
  return enviarSerial(linha)
}

function corDoEstado() {
  return estado === 'GAME' ? 'AZUL' : 'VERDE'
}

// LED antes do estado: se o firmware tiver rotina própria para o GAME (azul
// piscando), ela fica valendo
function mandarEstado() {
  timerEstado = null
  if (estado === estadoEnviado) return
  estadoEnviado = estado
  clearTimeout(timerLed)
  enviar(`1 LED ${corDoEstado()}`)
  enviar(`1 ${estado}`)
}

function mudarEstado(novo) {
  estado = novo
  vidasEnviadas = [] // a próxima luta manda a vida cheia de novo
  clearTimeout(timerEstado)
  timerEstado = setTimeout(mandarEstado, ESPERA_ESTADO)
}

export function entrarNoJogo() {
  mudarEstado('GAME')
}

export function voltarAoMenu() {
  mudarEstado('MENU')
}

export function informarVida(j, hp, hpMax) {
  if (j < 0 || j >= MAX_JOGADORES || estadoEnviado !== 'GAME') return // VIDA só depois do GAME
  const valor = porcentagemVida(hp, hpMax)
  if (vidasEnviadas[j] === valor) return
  vidasEnviadas[j] = valor
  enviar(`${j + 1} VIDA ${valor}`)
}

export function levouGolpe(j) {
  if (j < 0 || j >= MAX_JOGADORES) return
  const agora = performance.now()
  if (agora - (ultimoBuzzer[j] ?? -Infinity) < INTERVALO_BUZZER) return
  ultimoBuzzer[j] = agora
  enviar(`${j + 1} BUZZER`)
  if (j !== 0) return // o secundário não tem comando de LED
  enviar('1 LED VERMELHO')
  clearTimeout(timerLed)
  timerLed = setTimeout(() => enviar(`1 LED ${corDoEstado()}`), PISCAR_LED)
}

// Ao conectar: PING e o estado atual (a vida vai no próximo frame da luta)
jogo.subscribe((s) => {
  if (s.fonte === fonte) return
  fonte = s.fonte
  if (fonte !== 'serial') return
  estadoEnviado = null
  vidasEnviadas = []
  enviar('1 PING')
  mandarEstado()
})

// Avisa o Arduino que o jogo vai embora (botão Desconectar ou fechar a aba):
// LED apagado e DISCONNECT. Devolve a promessa da escrita
export function despedir() {
  clearTimeout(timerLed)
  clearTimeout(timerEstado)
  enviar('1 LED DESLIGADO')
  return enviar('1 DISCONNECT')
}
// fechando a aba a escrita pode não dar tempo de sair, mas não custa tentar
if (typeof window !== 'undefined') window.addEventListener('pagehide', despedir)
