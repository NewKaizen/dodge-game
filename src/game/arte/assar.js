import { RES } from '../resEscala.js'

// "ASSAR" um desenho de Graphics numa textura, uma vez só, e mostrar uma Image no lugar.
//
// O Phaser refaz a geometria de um Graphics A CADA QUADRO (cada fillPoints passa pelo earcut). Um
// desenho parado com milhares de comandos (o verso da carta tem ~150 losangos: ~3 mil comandos, e a
// mesa tem dezenas de cartas) pesa muito no celular. Medido com o Playwright (Pixel 7, CPU 4x mais
// lenta): era a maior fatia do quadro da esquiva no PVP. Ver docs/controles.md "Celular / toque" e
// docs/desempenho.md (fase 1 do plano de otimização).
//
//   const img = assar(scene, chave, largura, altura, (g) => { ...desenha em volta de (0, 0)... })
//   const img = assarRegiao(scene, chave, { x, y, largura, altura }, (g) => { ...desenha no mundo... })
//   const nome = texturaAssada(scene, chave, largura, altura, desenhar)   só a textura (para setTexture)
//   trocarAssada(img, scene, chave, largura, altura, desenhar)            troca a textura de uma Image assada
//
// O desenho é centrado em (0, 0), como dentro de um container (a Image tem origem no ponto (0, 0) do
// desenho). A textura é desenhada na resolução da tela (RES.escala, game/resolucao.js) e mostrada no
// tamanho do mundo: fica tão nítida quanto o Graphics, e os texels caem em cima dos pixels (o tamanho
// mostrado é o da textura dividido pela escala, sem esticar). A chave inclui a escala; a mesma chave é
// reaproveitada por todas as cartas iguais (as texturas ficam no jogo, não na cena).
//
// MEMÓRIA: cada textura sabe quais cenas a usam. No fim de uma cena (shutdown) as que ficaram sem cena
// viram "ociosas" e entram num LRU: as mais antigas são apagadas quando passam de LRU.maxOciosas ou de
// LRU.maxBytes. A próxima partida reaproveita as que sobraram (o baralho é quase sempre o mesmo).
// Sem textura (contexto WebGL perdido, GPU sem memória) as funções devolvem null: quem chama fica com
// o Graphics de sempre.
export const LRU = { maxOciosas: 160, maxBytes: 48 * 1024 * 1024 }

const FOLGA = 2 // contorno que passa um pouco da borda
const nomeAssado = (chave, largura, altura) => `assado:${chave}:${largura}x${altura}@${RES.escala}`

// nome -> { cenas: Set<Scene>, uso, bytes, ox, oy, w, h (região do mundo, já com a folga) }
const REGISTRO = new Map()
let relogio = 0
const vigiadas = new WeakSet()

export function assar(scene, chave, largura, altura, desenhar, { folga = FOLGA } = {}) {
  const nome = texturaAssada(scene, chave, largura, altura, desenhar, { folga })
  return nome ? imagemAssada(scene, nome) : null
}

// O mesmo, a partir de um Graphics já desenhado (em volta de (0, 0)): devolve a Image ou null.
// Quem chama troca o Graphics pela Image (e o destrói)
// `por cima`: outros objetos (textos da carta...) desenhados na mesma textura depois do Graphics, cada um na
// posição, rotação e escala dele (coordenadas em volta de (0, 0), como o Graphics)
export function assarGraphics(scene, chave, largura, altura, g, { folga = FOLGA, porCima = [] } = {}) {
  if (!podeAssar(scene)) return null
  const nome = nomeAssado(chave, largura, altura)
  if (!existe(scene, nome) && !pintar(scene, nome, -largura / 2 - folga, -altura / 2 - folga, largura + folga * 2, altura + folga * 2, g, porCima)) return null
  return imagemAssada(scene, nome)
}

// já existe a textura deste desenho (assar / assarGraphics)? Para pular o trabalho de montar o desenho
export const jaAssada = (scene, chave, largura, altura) => podeAssar(scene) && existe(scene, nomeAssado(chave, largura, altura))

// Só a textura (desenhada em volta de (0, 0)); devolve o nome ou null
export function texturaAssada(scene, chave, largura, altura, desenhar, { folga = FOLGA } = {}) {
  if (!podeAssar(scene)) return null
  const nome = nomeAssado(chave, largura, altura)
  if (existe(scene, nome)) return nome
  const g = scene.make.graphics({}, false)
  desenhar(g)
  const ok = pintar(scene, nome, -largura / 2 - folga, -altura / 2 - folga, largura + folga * 2, altura + folga * 2, g)
  g.destroy()
  return ok ? nome : null
}

// Uma região do MUNDO (x, y: canto de cima à esquerda): o desenho usa as coordenadas de sempre e a
// Image fica exatamente no lugar dele (para placas do HUD, molduras, camadas de cenário)
export function assarRegiao(scene, chave, { x, y, largura, altura, folga = FOLGA }, desenhar) {
  if (!podeAssar(scene)) return null
  const nome = nomeAssado(`${chave}@${x},${y}`, largura, altura)
  if (!existe(scene, nome)) {
    const g = scene.make.graphics({}, false)
    desenhar(g)
    const ok = pintar(scene, nome, x - folga, y - folga, largura + folga * 2, altura + folga * 2, g)
    g.destroy()
    if (!ok) return null
  }
  return imagemAssada(scene, nome)
}

// O mesmo, a partir de um Graphics já desenhado (a região nas coordenadas LOCAIS dele): a Image tem
// origem no (0, 0) local do Graphics; quem chama copia a posição, a rotação e a escala dele
export function assarGraphicsRegiao(scene, chave, { x, y, largura, altura, folga = FOLGA }, g) {
  if (!podeAssar(scene)) return null
  const nome = nomeAssado(`${chave}@${x},${y}`, largura, altura)
  if (!existe(scene, nome) && !pintar(scene, nome, x - folga, y - folga, largura + folga * 2, altura + folga * 2, g)) return null
  return imagemAssada(scene, nome)
}

// Só a textura de uma região (para deixar pronto um estado que ainda não aparece); devolve o nome ou null
export function texturaAssadaRegiao(scene, chave, { x, y, largura, altura, folga = FOLGA }, desenhar, porCima = []) {
  if (!podeAssar(scene)) return null
  const nome = nomeAssado(`${chave}@${x},${y}`, largura, altura)
  if (existe(scene, nome)) return usar(scene, nome), nome
  const g = scene.make.graphics({}, false)
  desenhar(g)
  const ok = pintar(scene, nome, x - folga, y - folga, largura + folga * 2, altura + folga * 2, g, porCima)
  g.destroy()
  if (!ok) return null
  usar(scene, nome)
  return nome
}

// já existe a textura desta região? (para pular o desenho quando a cena volta)
// (texturaAssadaRegiao aceita `porCima` como assarGraphics; imagemAssada mostra o nome que ela devolve)
export const regiaoAssada = (scene, chave, { x, y, largura, altura }) => existe(scene, nomeAssado(`${chave}@${x},${y}`, largura, altura))

// A Image de uma textura assada, no lugar do desenho (origem no (0, 0) do desenho)
export function imagemAssada(scene, nome) {
  const img = scene.add.image(0, 0, nome)
  ajustar(img, scene, nome)
  return img
}

// Troca a textura de uma Image assada (estado novo: gema apagada, marca bloqueada...); false se não deu
export function trocarAssada(img, scene, chave, largura, altura, desenhar, opcoes) {
  const nome = texturaAssada(scene, chave, largura, altura, desenhar, opcoes)
  if (!nome) return false
  if (img.texture?.key !== nome) img.setTexture(nome)
  ajustar(img, scene, nome)
  return true
}

function ajustar(img, scene, nome) {
  const r = REGISTRO.get(nome)
  usar(scene, nome)
  if (!r) return img.setOrigin(0.5)
  // tamanho mostrado = textura / escala (sem esticar); a origem é o ponto (0, 0) do desenho
  img.setDisplaySize(r.tw / r.escala, r.th / r.escala)
  img.setOrigin(-r.ox / (r.tw / r.escala), -r.oy / (r.th / r.escala))
  return img
}

// a cena consegue assar? (sem textura dinâmica, contexto perdido ou uma cena de teste: fica o Graphics)
const podeAssar = (scene) => typeof scene?.textures?.addDynamicTexture === 'function' && typeof scene?.make?.graphics === 'function'

const existe = (scene, nome) => REGISTRO.has(nome) && scene.textures.exists(nome)

function pintar(scene, nome, ox, oy, w, h, g, porCima = []) {
  const escala = RES.escala
  const tw = Math.max(1, Math.ceil(w * escala))
  const th = Math.max(1, Math.ceil(h * escala))
  if (scene.textures.exists(nome)) scene.textures.remove(nome) // sobra de outro registro (não devia acontecer)
  const dt = scene.textures.addDynamicTexture(nome, tw, th)
  if (!dt) return false
  const { x, y, scaleX, scaleY, rotation, alpha, visible } = g
  g.setPosition(0, 0).setScale(1).setRotation(0).setAlpha(1).setVisible(true)
  dt.camera.setOrigin(0, 0).setZoom(escala).setScroll(ox, oy)
  dt.draw(g)
  for (const o of porCima) dt.draw(o)
  dt.render?.()
  g.setPosition(x, y).setScale(scaleX, scaleY).setRotation(rotation).setAlpha(alpha).setVisible(visible)
  REGISTRO.set(nome, { cenas: new Set(), uso: ++relogio, bytes: tw * th * 4, ox, oy, tw, th, escala })
  return true
}

// ---------- o LRU ----------

function usar(scene, nome) {
  const r = REGISTRO.get(nome)
  if (!r) return
  r.uso = ++relogio
  if (r.cenas.has(scene)) return
  r.cenas.add(scene)
  if (vigiadas.has(scene) || !scene.events) return
  vigiadas.add(scene)
  const soltar = () => {
    vigiadas.delete(scene)
    scene.events.off('shutdown', soltar)
    scene.events.off('destroy', soltar)
    for (const reg of REGISTRO.values()) reg.cenas.delete(scene)
    podar(scene.textures)
  }
  scene.events.once('shutdown', soltar)
  scene.events.once('destroy', soltar)
}

// Apaga as ociosas mais antigas até caber no LRU
export function podar(textures) {
  const ociosas = [...REGISTRO].filter(([, r]) => r.cenas.size === 0).sort((a, b) => a[1].uso - b[1].uso)
  let bytes = ociosas.reduce((s, [, r]) => s + r.bytes, 0)
  while (ociosas.length && (ociosas.length > LRU.maxOciosas || bytes > LRU.maxBytes)) {
    const [nome, r] = ociosas.shift()
    bytes -= r.bytes
    REGISTRO.delete(nome)
    if (textures?.exists(nome)) textures.remove(nome)
  }
}

// Para o medidor e os testes: quantas texturas assadas existem (e quantas estão ociosas)
export function estadoAssadas() {
  let ociosas = 0
  let bytes = 0
  for (const r of REGISTRO.values()) {
    if (!r.cenas.size) ociosas++
    bytes += r.bytes
  }
  return { total: REGISTRO.size, ociosas, bytes }
}

// trocarAssada para uma região do mundo (assarRegiao): troca a textura de uma Image assada
export function trocarAssadaRegiao(scene, img, chave, regiao, desenhar, porCima = []) {
  if (!podeAssar(scene)) return false
  const { x, y, largura, altura, folga = FOLGA } = regiao
  const nome = nomeAssado(`${chave}@${x},${y}`, largura, altura)
  if (!existe(scene, nome)) {
    const g = scene.make.graphics({}, false)
    desenhar(g)
    const ok = pintar(scene, nome, x - folga, y - folga, largura + folga * 2, altura + folga * 2, g, porCima)
    g.destroy()
    if (!ok) return false
  }
  if (img.texture?.key !== nome) img.setTexture(nome)
  ajustar(img, scene, nome)
  return true
}
