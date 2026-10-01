import Phaser from 'phaser'
import { LARGURA, ALTURA } from './constants.js'

// Resolução de desenho.
//
// O jogo continua pensado em 640x480 (LARGURA x ALTURA): posições, caixas e
// layouts usam essas coordenadas. Mas o canvas é criado do tamanho REAL em
// que ele aparece na tela (vezes o devicePixelRatio), e cada câmera dá zoom
// de `escala`. Assim texto e formas são desenhados na resolução da tela, em
// vez de desenhar pequeno e esticar (o que borrava a fonte).
//
//   RES.zoom     quantas vezes o 640x480 é ampliado na página (CSS)
//   RES.dpr      pixels do monitor por pixel CSS (telas HiDPI)
//   RES.escala   zoom x dpr: pixels reais por pixel do jogo
export const RES = { zoom: 1, dpr: 1, escala: 1 }

const MARGEM_VERTICAL = 110 // barra de conexão acima do jogo
const DPR_MAX = 2 // acima disso o canvas fica pesado sem ganho visível

function medir() {
  const zoomLivre = Math.min((window.innerWidth - 32) / LARGURA, (window.innerHeight - MARGEM_VERTICAL) / ALTURA)
  const zoom = Math.max(1, Math.floor(zoomLivre * 20) / 20) // passos de 5%, para não recriar tudo a cada pixel de resize
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX)
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
  return () => window.removeEventListener('resize', aoRedimensionar)
}
