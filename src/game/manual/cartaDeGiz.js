import { criarRng } from '../pvp/baralho.js'
import { SIMBOLOS, nomeDoValor } from '../pvp/cartas.js'
import { PALETA, corCss } from './cera.js'
import { desenhoDaCarta, rabiscoDaGema, retanguloRedondo } from './ilustracoes.js'
import { DESENHO_DA_CARTA, ENERGIA } from './cartasDoManual.js'
import { FONTE_TEXTO, TINTA, assar } from './paginaBase.js'

// As cartas de giz do Manual do Ralsei (a parte com canvas): usadas pelas páginas de cartas (3, 4 e 6) e pela
// mão da página 9. A carta é a do baralho de verdade (pvp/cartas.js); o desenho do miolo vem de cartasDoManual.js.
//
//   CARTA                          o tamanho da carta de giz (74 x 98)
//   assarCartaDeGiz(scene, carta, bloqueada)   a textura da carta (valor e naipe no canto, desenho, nome, gema do custo)
//   assarCartaPassar(scene)        o "slot" PASSAR no fim da mão
//   assarBrilhoDaCarta(scene)      o brilho amarelo de giz em volta da carta selecionada
//   caminho(ctx, poligono)         um polígono como caminho do canvas

export const CARTA = { largura: 74, altura: 98 }
// ---------- texturas das cartas de giz ----------

// A carta de giz: o papel da carta, o valor e o naipe no canto (como a carta do jogo), o desenho do
// ataque no meio, o nome embaixo e a gema do custo no canto de baixo (vermelha com × quando bloqueada).
export function assarCartaDeGiz(scene, carta, bloqueada) {
  const chave = `manual-carta:${carta.id}:${bloqueada ? 'b' : 'n'}`
  if (scene.textures.exists(chave)) return chave
  const { largura: w, altura: h } = CARTA
  const rng = criarRng(`manual:carta:${carta.id}`)
  const corpo = retanguloRedondo(-w / 2, -h / 2, w, h, 8)
  const vermelho = carta.naipe === 'copas' || carta.naipe === 'ouros'
  const tinta = vermelho ? 0xc81e3c : PALETA.tinta
  const gema = { x: -w / 2 + 12, y: h / 2 - 11 }
  const camadas = [
    { tipo: 'traco', tracos: [[...corpo, corpo[0], corpo[1]]], cor: carta.valor === 14 ? PALETA.ouro : PALETA.tinta, largura: 2.4, passadas: 2 },
    ...desenhoDaCarta(rng, DESENHO_DA_CARTA[carta.id], 19).map((c) => deslocar(c, 4, -10)),
    ...rabiscoDaGema(rng, 9, { ...gema, estado: bloqueada ? 'bloqueada' : 'cheia' }).camadas,
  ]
  const pad = 6
  assar(scene, chave, w + pad * 2, h + pad * 2, {
    camadas,
    ox: w / 2 + pad,
    oy: h / 2 + pad,
    grao: 0.3,
    fundo: (ctx) => {
      ctx.save()
      ctx.translate(w / 2 + pad, h / 2 + pad)
      ctx.shadowColor = 'rgba(60,36,20,0.28)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetY = 2
      ctx.fillStyle = carta.valor === 14 ? '#fff6d8' : '#fffcf4'
      caminho(ctx, corpo)
      ctx.fill()
      ctx.restore()
    },
    frente: (ctx) => {
      ctx.save()
      ctx.translate(w / 2 + pad, h / 2 + pad)
      ctx.fillStyle = corCss(tinta)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `bold 13px ${FONTE_TEXTO}`
      ctx.fillText(nomeDoValor(carta.valor), -w / 2 + 11, -h / 2 + 12)
      ctx.font = `bold 12px ${FONTE_TEXTO}`
      ctx.fillText(SIMBOLOS[carta.naipe], -w / 2 + 11, -h / 2 + 26)
      // o nome, em até 2 linhas
      ctx.fillStyle = TINTA
      ctx.font = `bold 9.5px ${FONTE_TEXTO}`
      const linhas = quebrar(ctx, carta.nome, w - 12)
      linhas.forEach((l, k) => ctx.fillText(l, 3, h / 2 - 37 + k * 11 + (linhas.length === 1 ? 5 : 0)))
      // o custo na gema
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = bloqueada ? '#3a0a14' : '#06283e'
      ctx.lineWidth = 2.5
      ctx.font = `bold 11px ${FONTE_TEXTO}`
      ctx.strokeText(String(carta.custo), gema.x, gema.y + 0.5)
      ctx.fillText(String(carta.custo), gema.x, gema.y + 0.5)
      if (bloqueada) {
        // o véu de carta indisponível e o selo "×" na gema (como Carta.desenharMarcaCusto)
        ctx.fillStyle = 'rgba(70,60,80,0.38)'
        caminho(ctx, corpo)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(gema.x + 7, gema.y - 7, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#c81e3c'
        ctx.beginPath()
        ctx.arc(gema.x + 7, gema.y - 7, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(gema.x + 5.2, gema.y - 8.8)
        ctx.lineTo(gema.x + 8.8, gema.y - 5.2)
        ctx.moveTo(gema.x + 5.2, gema.y - 5.2)
        ctx.lineTo(gema.x + 8.8, gema.y - 8.8)
        ctx.stroke()
      }
      ctx.restore()
    },
  })
  return chave
}

// o "slot" PASSAR no fim da mão (o botão da arena: PASSAR e +1 com a gema)
export function assarCartaPassar(scene) {
  const chave = 'manual-carta:passar'
  if (scene.textures.exists(chave)) return chave
  const { largura: w, altura: h } = CARTA
  const rng = criarRng('manual:carta:passar')
  const corpo = retanguloRedondo(-w / 2, -h / 2, w, h, 8)
  const pad = 6
  assar(scene, chave, w + pad * 2, h + pad * 2, {
    camadas: [{ tipo: 'traco', tracos: [[...corpo, corpo[0], corpo[1]]], cor: PALETA.verdeEscuro, largura: 2.4, passadas: 2 }, ...desenhoDaCarta(rng, 'passar', 20).map((c) => deslocar(c, 0, 2))],
    ox: w / 2 + pad,
    oy: h / 2 + pad,
    grao: 0.3,
    fundo: (ctx) => {
      ctx.save()
      ctx.translate(w / 2 + pad, h / 2 + pad)
      ctx.shadowColor = 'rgba(60,36,20,0.28)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetY = 2
      ctx.fillStyle = '#eef8ef'
      caminho(ctx, corpo)
      ctx.fill()
      ctx.restore()
    },
    frente: (ctx) => {
      ctx.save()
      ctx.translate(w / 2 + pad, h / 2 + pad)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = corCss(PALETA.verdeEscuro)
      ctx.font = `bold 13px ${FONTE_TEXTO}`
      ctx.fillText('PASSAR', 0, -h / 2 + 16)
      ctx.fillStyle = '#0b6a9e'
      ctx.font = `bold 13px ${FONTE_TEXTO}`
      ctx.fillText(`+${ENERGIA.passar}`, 14, h / 2 - 14)
      ctx.restore()
    },
  })
  return chave
}

// o brilho amarelo de giz em volta da carta selecionada
export function assarBrilhoDaCarta(scene) {
  const chave = 'manual-carta-brilho'
  if (scene.textures.exists(chave)) return chave
  const { largura: w, altura: h } = CARTA
  const pad = 12
  const contorno = retanguloRedondo(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 11)
  assar(scene, chave, w + pad * 2, h + pad * 2, {
    camadas: [{ tipo: 'traco', tracos: [[...contorno, contorno[0], contorno[1]]], cor: PALETA.amarelo, largura: 5, passadas: 3 }],
    ox: w / 2 + pad,
    oy: h / 2 + pad,
    grao: 0.35,
  })
  return chave
}

export function caminho(ctx, poli) {
  ctx.beginPath()
  poli.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)))
  ctx.closePath()
}

// uma camada de cera movida de (dx, dy)
function deslocar(camada, dx, dy) {
  const m = (q) => ({ x: q.x + dx, y: q.y + dy })
  const c = { ...camada }
  if (c.tracos) c.tracos = c.tracos.map((t) => t.map(m))
  if (c.poligono) c.poligono = c.poligono.map(m)
  return c
}

// quebra o texto em linhas que cabem em `largura` (no máximo 2)
function quebrar(ctx, texto, largura) {
  const palavras = texto.split(' ')
  const linhas = ['']
  for (const p of palavras) {
    const tentativa = linhas[linhas.length - 1] ? `${linhas[linhas.length - 1]} ${p}` : p
    if (ctx.measureText(tentativa).width <= largura || !linhas[linhas.length - 1]) linhas[linhas.length - 1] = tentativa
    else linhas.push(p)
  }
  return linhas.slice(0, 2)
}

