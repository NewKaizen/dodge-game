import { RES } from '../resolucao.js'

// "ASSAR" um desenho de Graphics numa textura, uma vez só, e mostrar uma Image no lugar.
//
// O Phaser refaz a geometria de um Graphics A CADA QUADRO (cada fillPoints passa pelo earcut). Um
// desenho parado com milhares de comandos (o verso da carta tem ~150 losangos: ~3 mil comandos, e a
// mesa tem dezenas de cartas) pesa muito no celular. Medido com o Playwright (Pixel 7, CPU 4x mais
// lenta): era a maior fatia do quadro da esquiva no PVP. Ver docs/controles.md "Celular / toque".
//
//   const img = assar(scene, chave, largura, altura, (g) => { ...desenha em volta de (0, 0)... })
//
// O desenho é centrado em (0, 0), como dentro de um container (a Image tem origem no meio). A textura
// é desenhada na resolução da tela (RES.escala, game/resolucao.js) e mostrada no tamanho do mundo:
// fica tão nítida quanto o Graphics. A chave inclui a escala; a mesma chave é reaproveitada por todas
// as cartas iguais (as texturas ficam no jogo, não na cena).
export function assar(scene, chave, largura, altura, desenhar) {
  const nome = nomeAssado(chave, largura, altura)
  if (!scene.textures.exists(nome)) {
    const g = scene.make.graphics({}, false)
    desenhar(g)
    const ok = pintar(scene, nome, largura, altura, g)
    g.destroy()
    if (!ok) return null
  }
  return imagem(scene, nome, largura, altura)
}

// O mesmo, a partir de um Graphics já desenhado (em volta de (0, 0)): devolve a Image ou null.
// Quem chama troca o Graphics pela Image (e o destrói)
export function assarGraphics(scene, chave, largura, altura, g) {
  const nome = nomeAssado(chave, largura, altura)
  if (!scene.textures.exists(nome) && !pintar(scene, nome, largura, altura, g)) return null
  return imagem(scene, nome, largura, altura)
}

const FOLGA = 2 // contorno que passa um pouco da borda
const nomeAssado = (chave, largura, altura) => `assado:${chave}:${largura}x${altura}@${RES.escala}`

function pintar(scene, nome, largura, altura, g) {
  const escala = RES.escala
  const w = Math.max(1, Math.ceil((largura + FOLGA * 2) * escala))
  const h = Math.max(1, Math.ceil((altura + FOLGA * 2) * escala))
  const dt = scene.textures.addDynamicTexture(nome, w, h)
  if (!dt) return false
  const { x, y, scaleX, scaleY, rotation, alpha, visible } = g
  g.setPosition(0, 0).setScale(1).setRotation(0).setAlpha(1).setVisible(true)
  dt.camera.setOrigin(0, 0).setZoom(escala).setScroll(-(largura / 2 + FOLGA), -(altura / 2 + FOLGA))
  dt.draw(g)
  dt.render?.()
  g.setPosition(x, y).setScale(scaleX, scaleY).setRotation(rotation).setAlpha(alpha).setVisible(visible)
  return true
}

const imagem = (scene, nome, largura, altura) => scene.add.image(0, 0, nome).setDisplaySize(largura + FOLGA * 2, altura + FOLGA * 2)
