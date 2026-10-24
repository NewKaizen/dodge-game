import { get } from 'svelte/store'
import { jogo } from '../estado.js'
import { processarLinha } from '../protocolo.js'
import { setTecladoUnico } from '../simulador.js'
import { lan } from './rede.js'
import { enviarRapido, aoRapido } from './transmissao.js'

// Controles no modo LAN (docs/lan.md).
//   Convidado: durante a partida, tudo o que os controles daqui fazem (teclado
//              ou joystick, os dois conjuntos somados) vai para o host, pelo
//              canal direto do WebRTC (transmissao.js; sem ele, pelo servidor).
//   Host:      o que chega do convidado vira o JOGADOR 2 (as mesmas linhas do
//              protocolo serial); o teclado daqui inteiro vira o jogador 1.
let jogando = false // convidado: repassando os controles
let ultimoJoy = null
let ultimoBotao = null

const limitar = (v) => Math.max(-100, Math.min(100, v))

jogo.subscribe((s) => {
  if (!jogando) return
  const x = limitar(s.jogadores.reduce((soma, j) => soma + j.joy.x, 0))
  const y = limitar(s.jogadores.reduce((soma, j) => soma + j.joy.y, 0))
  const joy = `${x} ${y}`
  if (joy !== ultimoJoy) {
    ultimoJoy = joy
    enviarRapido({ tipo: 'joy', x, y })
  }
  if (s.botao && s.botao !== ultimoBotao) {
    ultimoBotao = s.botao
    enviarRapido({ tipo: 'btn', botao: s.botao.botao })
  }
})

// host: só vale com a partida rolando (no lobby cada um mexe na própria tela)
let hostEmPartida = false
aoRapido((dados) => {
  if (!hostEmPartida) return
  if (dados?.tipo === 'joy') processarLinha(`JOY 2 ${Math.round(Number(dados.x) || 0)} ${Math.round(Number(dados.y) || 0)}`)
  if (dados?.tipo === 'btn' && ['A', 'B', 'C'].includes(dados.botao)) processarLinha(`BTN 2 ${dados.botao}`)
})

lan.subscribe((s) => {
  const naSala = s.fase === 'sala'
  const partida = naSala && Boolean(s.sala?.emPartida)
  setTecladoUnico(naSala && s.papel === 'host')

  // sem convidado (caiu no meio da partida) o P2 solta tudo
  const agoraHost = partida && s.papel === 'host' && s.sala.membros.length > 1
  if (hostEmPartida && !agoraHost) processarLinha('JOY 2 0 0') // o convidado não fica "segurando" nada
  hostEmPartida = agoraHost

  const agoraJogando = partida && s.papel === 'convidado'
  if (agoraJogando && !jogando) {
    // começa sem herdar o último botão apertado no lobby
    ultimoBotao = get(jogo).botao
    ultimoJoy = null
  }
  if (!agoraJogando && jogando) enviarRapido({ tipo: 'joy', x: 0, y: 0 })
  jogando = agoraJogando
  if (jogando) jogo.update((x) => ({ ...x })) // manda o estado atual já
})
