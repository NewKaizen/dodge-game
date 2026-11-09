// A coroa do líder da party (PartyIntro e PartyFim): desenhada num Graphics, sem textura
// a base em y, o centro em x, a largura l
export function desenharCoroa(g, x, y, l) {
  const m = l / 2
  g.fillStyle(0xffd23a, 1)
  g.fillPoints([{ x: x - m, y }, { x: x - m, y: y - l * 0.6 }, { x: x - m / 2, y: y - l * 0.3 }, { x, y: y - l * 0.75 }, { x: x + m / 2, y: y - l * 0.3 }, { x: x + m, y: y - l * 0.6 }, { x: x + m, y }], true)
  g.fillStyle(0xff3d6e, 1).fillRect(x - 1.5, y - l * 0.25, 3, 3)
  g.lineStyle(1.5, 0x000000, 0.8).strokePoints([{ x: x - m, y }, { x: x - m, y: y - l * 0.6 }, { x: x - m / 2, y: y - l * 0.3 }, { x, y: y - l * 0.75 }, { x: x + m / 2, y: y - l * 0.3 }, { x: x + m, y: y - l * 0.6 }, { x: x + m, y }], true)
}
