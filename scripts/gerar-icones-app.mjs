// Ícones do app (PWA, "adicionar à tela inicial"): o coração do jogo (CORACAO_MAPA, a alma que
// desvia na caixa) em pixel art, vermelho com borda branca, no fundo escuro do jogo.
// Gera public/icones/ (manifest.webmanifest e apple-touch-icon do index.html).
// npm: node scripts/gerar-icones-app.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { CORACAO_MAPA } from '../src/game/arte/sprites.js'

const FUNDO = [11, 13, 25] // #0b0d19 (theme-color)
const VERMELHO = [255, 32, 48] // CORES.almas[0]
const BRANCO = [255, 255, 255]
const SAIDA = new URL('../public/icones/', import.meta.url)
mkdirSync(SAIDA, { recursive: true })

// grade do coração com 1 pixel de borda branca em volta
const h = CORACAO_MAPA.length
const w = CORACAO_MAPA[0].length
const cheio = (x, y) => CORACAO_MAPA[y]?.[x] === '#'
const grade = []
for (let y = -1; y <= h; y++) {
  const linha = []
  for (let x = -1; x <= w; x++) {
    if (cheio(x, y)) linha.push(VERMELHO)
    else if ([-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => cheio(x + dx, y + dy)))) linha.push(BRANCO)
    else linha.push(null)
  }
  grade.push(linha)
}

// lado: tamanho do ícone; ocupa: fração do lado que o coração ocupa (o "maskable" precisa de folga)
async function icone(nome, lado, ocupa) {
  const gw = grade[0].length
  const gh = grade.length
  const px = Math.floor((lado * ocupa) / gw)
  const ox = Math.floor((lado - px * gw) / 2)
  const oy = Math.floor((lado - px * gh) / 2)
  const dados = Buffer.alloc(lado * lado * 3)
  for (let i = 0; i < lado * lado; i++) dados.set(FUNDO, i * 3)
  grade.forEach((linha, gy) =>
    linha.forEach((cor, gx) => {
      if (!cor) return
      for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) dados.set(cor, ((oy + gy * px + y) * lado + ox + gx * px + x) * 3)
    }),
  )
  await sharp(dados, { raw: { width: lado, height: lado, channels: 3 } }).png().toFile(new URL(nome, SAIDA).pathname)
}

await icone('icone-192.png', 192, 0.7)
await icone('icone-512.png', 512, 0.7)
await icone('icone-maskable-512.png', 512, 0.5)
await icone('apple-touch-icon.png', 180, 0.62)
console.log('ícones em public/icones/')
