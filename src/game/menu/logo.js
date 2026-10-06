import { FONTE } from '../constants.js'

// O título do menu, no canto de cima à esquerda: logo neon com um disco
// girando atrás e o subtítulo.
//
//   const logo = criarLogo(cena, area, { titulo, subtitulo })   area = LOGO de layout.js
//   await logo.entrar({ rapido })    aparece (rapido: sem a animação, ao voltar de outra tela)
//   logo.batida(n)                   pulso da música
//   logo.sair()                      JOGAR: some
//   logo.atualizar(delta)
//
// Profundidades 20-29. PROVISÓRIO: só o texto (o agente do logo substitui).
export function criarLogo(cena, area, { titulo, subtitulo }) {
  const t = cena.add.text(area.x, area.y + 40, titulo, { fontFamily: FONTE, fontSize: '64px', color: '#ff3d8b', stroke: '#000000', strokeThickness: 8 }).setDepth(20)
  const s = cena.add.text(area.x + 4, area.y + 116, subtitulo, { fontFamily: FONTE, fontSize: '14px', color: '#3fd6c8' }).setDepth(20)
  return { entrar: async () => {}, batida() {}, sair: () => cena.tweens.add({ targets: [t, s], alpha: 0, duration: 200 }), atualizar() {} }
}
