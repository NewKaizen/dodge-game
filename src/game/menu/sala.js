import { LARGURA, ALTURA } from '../constants.js'
import { CHAO } from './layout.js'

// O quarto escuro do menu: parede, chão, a luz que o telão joga no chão e as
// silhuetas dos sete lutadores assistindo a tela (contornadas pela luz dela).
//
//   const sala = criarSala(cena, { tela })   tela = TELA de layout.js
//   sala.iluminar(cor)    cor atual do telão: a luz no chão e o contorno seguem ela
//   sala.batida(n)        pulso da música (n = nº da batida): a luz pulsa, as silhuetas balançam
//   sala.atualizar(delta)
//
// Profundidades 0-9. PROVISÓRIO: só parede e chão lisos (o agente da sala substitui).
export function criarSala(cena) {
  cena.add.rectangle(0, 0, LARGURA, CHAO, 0x12142a).setOrigin(0).setDepth(0)
  cena.add.rectangle(0, CHAO, LARGURA, ALTURA - CHAO, 0x0a0b14).setOrigin(0).setDepth(0)
  return { iluminar() {}, batida() {}, atualizar() {} }
}
