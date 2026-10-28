import { jogo, MAX_JOGADORES } from './estado.js'
import { enviarSerial, aoMudarJoysticks } from './serial.js'
import { linhaVida } from './conversao.js'
import { vibrarJogador, pararVibracao } from './vibracao.js'

// Comandos do jogo para os joysticks (docs/protocolo-serial.md): uma placa por porta USB.
// PING/GAME/MENU/DISCONNECT vão a todas as portas; "<n> VIDA/BUZZER" só à do jogador n
// (lib/joysticks.js decide; com uma porta só e uma placa secundária atrás, o "2 ..." segue
// pela mesma porta e a principal repassa).
// As cenas só avisam o que aconteceu; aqui decide o que mandar e evita repetir
// linha (a serial é 9600 baud). Sem joystick conectado, nada sai.
//
//   entrarNoJogo()            começou uma luta: GAME
//   voltarAoMenu()            saiu da luta: MENU
//   informarVida(j, hp, max)  pode chamar todo frame: só manda VIDA quando o HP muda
//   levouGolpe(j)             BUZZER do jogador (e vibração do controle físico, lib/vibracao.js)
//
// O mesmo aviso por jogador também faz o controle físico vibrar (lib/vibracao.js): golpe
// (junto do BUZZER), K.O./caído (o HP chegou a 0 em informarVida) e para tudo ao entrar/sair da luta.
//
// O LED RGB fica por conta do firmware (vermelho sem conexão,
// verde no menu, azul piscando na luta): ele sobrescreveria um "1 LED ..." daqui.

const INTERVALO_PING = 1000 // ms: os Arduinos mostram SEM CONEXAO depois de 3 s calados
const INTERVALO_BUZZER = 250 // ms: vários tiros juntos tocam uma vez só
const ESPERA_ESTADO = 100 // ms: "recomeçar a luta" (MENU e GAME seguidos) não pisca nada

let fonte = null
let estado = 'MENU' // 'MENU' | 'GAME'
let estadoEnviado = null
let timerEstado = null
let timerPing = null
let vidasEnviadas = []
const hpVisto = [] // último HP de cada jogador (detecta o K.O. para a vibração)
const ultimoBuzzer = []

function enviar(linha) {
  if (fonte !== 'serial') return Promise.resolve()
  if (import.meta.env?.DEV && !linha.endsWith('PING')) console.debug('[joystick] <-', linha)
  return enviarSerial(linha)
}

function mandarEstado() {
  timerEstado = null
  if (estado === estadoEnviado) return
  estadoEnviado = estado
  enviar(estado)
}

function mudarEstado(novo) {
  estado = novo
  vidasEnviadas = [] // a próxima luta manda a vida cheia de novo
  hpVisto.length = 0
  pararVibracao() // entrou na luta ou voltou ao menu: nenhum motor fica ligado
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
  if (j < 0 || j >= MAX_JOGADORES) return
  // K.O.: o HP passou de positivo para 0. Quem já começa caído (CO-OP) não vibra
  if (estado === 'GAME') {
    if (hpVisto[j] > 0 && hp <= 0) vibrarJogador(j, 'ko')
    hpVisto[j] = hp
  }
  if (estadoEnviado !== 'GAME') return // VIDA só depois do GAME
  const linha = linhaVida(j, hp, hpMax)
  if (!linha || vidasEnviadas[j] === linha) return
  vidasEnviadas[j] = linha
  enviar(linha)
}

function buzzer(j) {
  const agora = performance.now()
  if (agora - (ultimoBuzzer[j] ?? -Infinity) < INTERVALO_BUZZER) return
  ultimoBuzzer[j] = agora
  enviar(`${j + 1} BUZZER`)
}

export function levouGolpe(j) {
  if (j < 0 || j >= MAX_JOGADORES) return
  vibrarJogador(j, 'golpe') // tem o seu próprio limite de 250 ms
  buzzer(j)
}

// Um joystick abriu, fechou ou trocou de jogador: a placa nova precisa do estado e da vida de novo
aoMudarJoysticks(() => {
  if (fonte !== 'serial') return
  estadoEnviado = null
  vidasEnviadas = []
  enviar('PING')
  mandarEstado()
})

// Ao conectar: PING, o estado atual (a vida vai no próximo frame da luta) e um
// PING por segundo enquanto a porta estiver aberta, mesmo sem nada mudar (as placas
// só sabem que o jogo está vivo assim)
jogo.subscribe((s) => {
  if (s.fonte === fonte) return
  fonte = s.fonte
  clearInterval(timerPing)
  timerPing = null
  if (fonte !== 'serial') return
  estadoEnviado = null
  vidasEnviadas = []
  enviar('PING')
  mandarEstado()
  timerPing = setInterval(() => enviar('PING'), INTERVALO_PING)
})

// Avisa o Arduino que o jogo vai embora (botão Desconectar ou fechar a aba).
// Devolve a promessa da escrita
export function despedir() {
  clearInterval(timerPing)
  timerPing = null
  clearTimeout(timerEstado)
  return enviar('DISCONNECT')
}
// fechando a aba a escrita pode não dar tempo de sair, mas não custa tentar
if (typeof window !== 'undefined') window.addEventListener('pagehide', despedir)
