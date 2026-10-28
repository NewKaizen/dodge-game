import { corDaVaga } from '../vagas.js'

// Como cada coração é reconhecido no CO-OP de 3 e 4 (Fase 5B): a COR da vaga (game/vagas.js) é só uma
// das pistas. Cada vaga tem também uma FORMA (círculo, quadrado, triângulo, losango) e o NOME do
// jogador num rótulo pequeno em cima do coração; no HUD e na lista de "quem é o alvo" a forma vem
// junto da cor. Lógica pura (sem Phaser): o Heart e o HUD só desenham o que sai daqui.
//
//   formaDaVaga(i)            'circulo' | 'quadrado' | 'triangulo' | 'losango' (vaga 0..3)
//   pontosDaForma(forma, r)   o polígono da forma, centrado em 0,0 (raio r), para fillPoints()
//   nomeNoCoracao(nome, max)  o nome encurtado para o rótulo (maiúsculas, com reticências)
//   marcadorDaVaga(i, nome)   { forma, cor, rotulo, sigla } do coração da vaga i
export const FORMAS = ['circulo', 'quadrado', 'triangulo', 'losango']

export const formaDaVaga = (i) => FORMAS[((i % FORMAS.length) + FORMAS.length) % FORMAS.length]

export function pontosDaForma(forma, r = 5) {
  const poligono = (n, giro) => Array.from({ length: n }, (_, k) => ({ x: Math.cos(giro + (k * 2 * Math.PI) / n) * r, y: Math.sin(giro + (k * 2 * Math.PI) / n) * r }))
  if (forma === 'quadrado') return [{ x: -r * 0.85, y: -r * 0.85 }, { x: r * 0.85, y: -r * 0.85 }, { x: r * 0.85, y: r * 0.85 }, { x: -r * 0.85, y: r * 0.85 }]
  if (forma === 'triangulo') return poligono(3, -Math.PI / 2).map((p) => ({ x: p.x * 1.1, y: p.y * 1.1 + r * 0.1 }))
  if (forma === 'losango') return poligono(4, -Math.PI / 2).map((p) => ({ x: p.x * 0.85, y: p.y * 1.1 }))
  return poligono(14, 0)
}

export function nomeNoCoracao(nome, max = 8) {
  const t = String(nome ?? '').trim().toUpperCase()
  return t.length > max ? `${t.slice(0, max - 1)}.` : t
}

export function marcadorDaVaga(i, nome) {
  return { forma: formaDaVaga(i), cor: corDaVaga(i), sigla: `P${i + 1}`, rotulo: nomeNoCoracao(nome || `P${i + 1}`) }
}

// Desenha a forma num Phaser.GameObjects.Graphics (contorno preto para aparecer sobre qualquer fundo)
export function desenharForma(g, forma, x, y, r, cor, { contorno = true, alpha = 1 } = {}) {
  const pontos = pontosDaForma(forma, r).map((p) => ({ x: x + p.x, y: y + p.y }))
  if (contorno) {
    g.lineStyle(2, 0x000000, alpha)
    g.strokePoints(pontos, true)
  }
  g.fillStyle(cor, alpha)
  g.fillPoints(pontos, true)
  return g
}
