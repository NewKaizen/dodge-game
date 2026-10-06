// O telão na parede do menu: é ONDE o caos mora. Dentro dele roda uma luta de
// balas (os dois corações desviando), e a cor dele ilumina a sala.
//
//   const telao = criarTelao(cena, tela)   tela = TELA de layout.js (área de dentro)
//   await telao.ligar({ rapido })    liga a TV (rapido: sem a animação, ao voltar de outra tela)
//   telao.batida(n)                  pulso da música
//   telao.cor()                      cor dominante agora (a sala usa para iluminar)
//   await telao.explodir()           JOGAR: a luz da tela engole a tela inteira
//   telao.atualizar(delta)
//
// Profundidades 10-19. PROVISÓRIO: um retângulo apagado (o agente do telão substitui).
export function criarTelao(cena, tela) {
  cena.add.rectangle(tela.x, tela.y, tela.largura, tela.altura, 0x050510).setOrigin(0).setDepth(10).setStrokeStyle(6, 0x05060c)
  return {
    ligar: async () => {},
    batida() {},
    cor: () => 0x3fd6c8,
    explodir: () => new Promise((r) => cena.time.delayedCall(300, r)),
    atualizar() {},
  }
}
