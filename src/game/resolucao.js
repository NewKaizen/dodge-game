import Phaser from 'phaser'
import { LARGURA, ALTURA } from './constants.js'
import { telaCheiaAtual } from '../lib/telaCheia.js'
import { pref, aoMudarPref } from './preferencias.js'

// Resolução de desenho.
//
// O mundo do jogo é fixo em 854x480 (LARGURA x ALTURA, 16:9): posições, caixas
// e layouts usam essas coordenadas, e a página encaixa o mundo inteiro em
// qualquer janela (sobra faixa preta em telas mais altas ou mais largas). Mas o canvas é criado do tamanho REAL em
// que ele aparece na tela (vezes o devicePixelRatio), e cada câmera dá zoom
// de `escala`. Assim texto e formas são desenhados na resolução da tela, em
// vez de desenhar pequeno e esticar (o que borrava a fonte).
//
//   RES.zoom     quantas vezes o 854x480 é ampliado (ou reduzido) na página (CSS)
//   RES.dpr      pixels do monitor por pixel CSS (telas HiDPI)
//   RES.escala   zoom x dpr: pixels reais por pixel do jogo
import { RES } from './resEscala.js'
export { RES }

const MARGEM_VERTICAL = 110 // barra de conexão acima do jogo
const DPR_MAX = 2 // acima disso o canvas fica pesado sem ganho visível
// celular/tablet (modo toque): no máximo 1,5 pixel do aparelho por pixel CSS (celular tem dpr 2,6 a 3:
// desenhar em 2x ou 3x quase dobra os pixels do canvas e o FPS cai, sem ganho visível na arte em
// pixel; o texto ainda fica mais nítido que em 1x). Com GRÁFICOS no MÍNIMO, 1x.
// Medido com o Playwright (Pixel 7 deitado): ver docs/controles.md "Celular / toque"
const DPR_MAX_TOQUE = 1.5
const ZOOM_MIN = 0.25 // nunca menor que isso (abaixo, nem dá para ler)

// MODO TOQUE (lib/toque.js põe a classe 'modo-toque' no <html>): a página vira "app", só o jogo,
// ocupando a tela inteira menos as margens seguras (notch, barra do iPhone) que o CSS põe como
// padding da .arcade-stage
const modoToque = () => document.documentElement.classList.contains('modo-toque')
function areaDoPalco() {
  const palco = document.querySelector('.arcade-stage')
  if (!palco) return { largura: window.innerWidth, altura: window.innerHeight }
  const css = getComputedStyle(palco)
  const px = (v) => parseFloat(v) || 0
  return {
    largura: window.innerWidth - px(css.paddingLeft) - px(css.paddingRight),
    altura: window.innerHeight - px(css.paddingTop) - px(css.paddingBottom),
  }
}

function medir() {
  // em tela cheia (lib/telaCheia.js) só o jogo aparece: sem margens, ocupa tudo
  const cheia = Boolean(telaCheiaAtual())
  const toque = modoToque()
  const area = toque && !cheia ? areaDoPalco() : null
  const zoomLivre = cheia
    ? Math.min(window.innerWidth / LARGURA, window.innerHeight / ALTURA)
    : toque
      ? Math.min(area.largura / LARGURA, area.altura / ALTURA)
      : Math.min((window.innerWidth - 36) / LARGURA, (window.innerHeight - (window.innerWidth <= 700 ? 180 : MARGEM_VERTICAL)) / ALTURA)
  // fora da tela cheia: passos de 5%, para não recriar tudo a cada pixel de resize.
  // Janela estreita (menos que os 854 do mundo): encolhe em vez de vazar para o lado
  const zoom = cheia || toque ? Math.max(ZOOM_MIN, zoomLivre) : Math.max(ZOOM_MIN, Math.floor(zoomLivre * 20) / 20)
  let dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX)
  if (toque) dpr = pref('graficos') === 'minimo' ? 1 : Math.min(dpr, DPR_MAX_TOQUE)
  return { zoom, dpr, escala: zoom * dpr }
}

// Chame antes de criar o jogo: devolve o tamanho do canvas e o zoom CSS
export function prepararResolucao() {
  Object.assign(RES, medir())
  return {
    largura: Math.round(LARGURA * RES.escala),
    altura: Math.round(ALTURA * RES.escala),
    zoomCss: 1 / RES.dpr,
  }
}

// Câmera que mostra o mundo 640x480 a partir de (x, y) do mundo, desenhada em
// (x, y) da tela já na escala certa
export function ajustarCamera(camera, x = 0, y = 0, largura = LARGURA, altura = ALTURA) {
  const e = RES.escala
  camera.setOrigin(0, 0).setZoom(e)
  camera.setViewport(Math.round(x * e), Math.round(y * e), Math.round(largura * e), Math.round(altura * e))
  return camera
}

function ajustarCena(cena) {
  if (!cena.sys.isActive() && !cena.sys.isVisible()) return
  ajustarCamera(cena.cameras.main)
  for (const caixa of cena.caixasDeRecorte ?? []) caixa.reaplicar() // câmeras de recorte das caixas (recorte.js)
  const textos = (lista) =>
    lista.forEach((o) => {
      if (o instanceof Phaser.GameObjects.Text) o.setResolution(RES.escala)
      if (o.list) textos(o.list)
    })
  textos(cena.children.list)
}

// Todo texto criado com this.add.text já nasce na resolução da tela
const criarTexto = Phaser.GameObjects.GameObjectFactory.prototype.text
Phaser.GameObjects.GameObjectFactory.prototype.text = function (...args) {
  return criarTexto.apply(this, args).setResolution(RES.escala)
}

// Liga as cenas à resolução e acompanha o redimensionamento da janela.
// Devolve a função que desliga o listener.
export function instalarResolucao(game) {
  const ligar = () => {
    for (const cena of game.scene.scenes) {
      cena.sys.events.on(Phaser.Scenes.Events.CREATE, () => ajustarCena(cena))
      ajustarCena(cena)
    }
  }
  // as cenas só existem depois do READY (o isBooted vem antes, com elas ainda na fila)
  if (game.scene.scenes.length) ligar()
  else game.events.once(Phaser.Core.Events.READY, ligar)

  let timer = null
  const aoRedimensionar = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const novo = medir()
      if (novo.escala === RES.escala && novo.dpr === RES.dpr) return
      const { largura, altura, zoomCss } = prepararResolucao()
      game.scale.resize(largura, altura)
      game.scale.setZoom(zoomCss)
      game.scene.scenes.forEach(ajustarCena)
    }, 150)
  }
  window.addEventListener('resize', aoRedimensionar)
  const pararPref = aoMudarPref((chave) => chave === 'graficos' && aoRedimensionar())
  document.addEventListener('fullscreenchange', aoRedimensionar)
  document.addEventListener('webkitfullscreenchange', aoRedimensionar)
  // celular: girar a tela (o resize às vezes chega antes das medidas novas) e a barra do navegador
  // que some/aparece (visualViewport)
  window.addEventListener('orientationchange', aoRedimensionar)
  window.visualViewport?.addEventListener('resize', aoRedimensionar)
  return () => {
    pararPref()
    window.removeEventListener('resize', aoRedimensionar)
    document.removeEventListener('fullscreenchange', aoRedimensionar)
    document.removeEventListener('webkitfullscreenchange', aoRedimensionar)
    window.removeEventListener('orientationchange', aoRedimensionar)
    window.visualViewport?.removeEventListener('resize', aoRedimensionar)
  }
}
