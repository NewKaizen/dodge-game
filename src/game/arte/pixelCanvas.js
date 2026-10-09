// Texturas de pixel art pintadas por código num canvas 2D, UMA vez por jogo
// (a cena seguinte reaproveita: confere scene.textures.exists). Usado pelo
// fundo do COLISEU e pelos eventos de bônus dele.
//
//   texturaCanvas(scene, chave, w, h, (ctx, px, tex) => { ... })
//     px(x, y, w, h, cor, alpha = 1)  retângulo cheio (coordenadas arredondadas)
//     tex.add(nome, 0, x, y, w, h)    quadros nomeados (folhas de sprite)
//   rgba(cor, a)       0xrrggbb -> 'rgba(...)' do canvas
//   misturar(a, b, p)  cor entre a e b (p de 0 a 1)
//   semente(n)         gerador repetível (0..1): a textura sai sempre igual

export const rgba = (c, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`

export const misturar = (a, b, p) => {
  const c = (d) => Math.round(((a >> d) & 255) + (((b >> d) & 255) - ((a >> d) & 255)) * p) << d
  return c(16) | c(8) | c(0)
}

export function semente(s) {
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function texturaCanvas(scene, chave, w, h, pintar) {
  if (scene.textures.exists(chave)) return chave
  const tex = scene.textures.createCanvas(chave, w, h)
  const ctx = tex.getContext()
  ctx.imageSmoothingEnabled = false
  const px = (x, y, lw, lh, cor, a = 1) => {
    ctx.fillStyle = rgba(cor, a)
    ctx.fillRect(Math.round(x), Math.round(y), lw, lh)
  }
  pintar(ctx, px, tex)
  tex.refresh()
  return chave
}
