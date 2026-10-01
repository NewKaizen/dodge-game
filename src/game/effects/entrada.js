import Phaser from 'phaser'
import { LARGURA, ALTURA } from '../constants.js'

// Peças da transição de entrada na batalha (Dificuldade -> Battle):
// rachaduras de vidro, estilhaços voando e faixas diagonais correndo.
// Tudo desenhado no mundo 640x480 da cena que chamar.

// '#ff5a6a' -> 0xff5a6a
export const corNumero = (cor) => parseInt(cor.slice(1), 16)

// Rachadura de vidro saindo de (x, y): um tronco em zigue-zague e galhos.
// `tamanho` é o comprimento aproximado do tronco em px.
export function rachadura(scene, x, y, { tamanho = 160, galhos = 2, profundidade = 60, cor = 0xffffff } = {}) {
  const g = scene.add.graphics().setDepth(profundidade)
  const angulo = Phaser.Math.FloatBetween(0, Math.PI * 2)
  const linhas = [ziguezague(x, y, angulo, tamanho, 5)]
  for (let k = 0; k < galhos; k++) {
    const tronco = linhas[0]
    const [bx, by] = tronco[Phaser.Math.Between(1, tronco.length - 2)]
    const desvio = Phaser.Math.FloatBetween(0.5, 1.1) * (k % 2 ? 1 : -1)
    linhas.push(ziguezague(bx, by, angulo + desvio, tamanho * Phaser.Math.FloatBetween(0.35, 0.6), 3))
  }
  // estrela de lascas curtas no ponto do impacto, para o outro lado do tronco
  for (let k = 1; k < 4; k++) linhas.push(ziguezague(x, y, angulo + (k / 4) * Math.PI * 2, tamanho * 0.22, 2))

  // sombra escura por baixo e o fio claro por cima: lê em fundo claro ou escuro
  for (const [espessura, tom, alpha] of [
    [7, 0x000000, 0.7],
    [3, cor, 1],
  ]) {
    g.lineStyle(espessura, tom, alpha)
    for (const pontos of linhas) {
      g.beginPath()
      g.moveTo(pontos[0][0], pontos[0][1])
      for (let i = 1; i < pontos.length; i++) g.lineTo(pontos[i][0], pontos[i][1])
      g.strokePath()
    }
  }
  return g
}

function ziguezague(x, y, angulo, comprimento, segmentos) {
  const pontos = [[x, y]]
  const passo = comprimento / segmentos
  let a = angulo
  for (let i = 0; i < segmentos; i++) {
    a += Phaser.Math.FloatBetween(-0.45, 0.45)
    x += Math.cos(a) * passo * Phaser.Math.FloatBetween(0.7, 1.3)
    y += Math.sin(a) * passo * Phaser.Math.FloatBetween(0.7, 1.3)
    pontos.push([x, y])
  }
  return pontos
}

// Estilhaços triangulares explodindo de (x, y) para fora da tela
export function estilhacos(scene, x, y, { quantidade = 24, cores = [0xffffff], profundidade = 80, duracao = 520 } = {}) {
  for (let i = 0; i < quantidade; i++) {
    const r = Phaser.Math.FloatBetween(10, 34)
    const pontas = [0, 1, 2].map((k) => {
      const a = (k / 3) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.6, 0.6)
      const d = r * Phaser.Math.FloatBetween(0.5, 1.2)
      return [Math.cos(a) * d, Math.sin(a) * d]
    })
    const cor = cores[i % cores.length]
    // cada caco nasce num ponto do "vidro" em volta do impacto e voa para fora
    const a = Phaser.Math.FloatBetween(0, Math.PI * 2)
    const inicio = Phaser.Math.FloatBetween(0, 90)
    const cx = x + Math.cos(a) * inicio
    const cy = y + Math.sin(a) * inicio
    const caco = scene.add
      .triangle(cx, cy, ...pontas.flat(), cor)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x000000, 0.8)
      .setDepth(profundidade)
    const d = Phaser.Math.FloatBetween(180, 440)
    const tempo = duracao * Phaser.Math.FloatBetween(0.75, 1.15)
    scene.tweens.add({
      targets: caco,
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d + 50,
      angle: Phaser.Math.Between(-540, 540),
      scale: Phaser.Math.FloatBetween(0.5, 1.5),
      duration: tempo,
      ease: 'Cubic.easeOut',
    })
    // some só no fim do voo
    scene.tweens.add({
      targets: caco,
      alpha: 0,
      delay: tempo * 0.6,
      duration: tempo * 0.4,
      onComplete: () => caco.destroy(),
    })
  }
}

// Faixas diagonais correndo pela tela. Chame desenhar(ms, forca) a cada frame
// (forca 0..1 controla quantas faixas, largura e opacidade).
export function faixasDiagonais(scene, cor, profundidade = 55) {
  const g = scene.add.graphics().setDepth(profundidade)
  const inclinacao = 0.55 // quanto a faixa anda na horizontal por px de altura
  const vao = 120
  return {
    objeto: g,
    desenhar(ms, forca) {
      g.clear()
      if (forca <= 0) return
      const deslocamento = (ms * (0.25 + forca * 0.9)) % vao
      const largura = 8 + forca * 40
      for (let x = -ALTURA * inclinacao - vao; x < LARGURA + vao; x += vao) {
        const x0 = x + deslocamento
        // faixa grossa da cor do nível com um filete branco na borda
        g.fillStyle(cor, 0.1 + forca * 0.3)
        g.fillPoints([
          { x: x0, y: ALTURA },
          { x: x0 + largura, y: ALTURA },
          { x: x0 + largura + ALTURA * inclinacao, y: 0 },
          { x: x0 + ALTURA * inclinacao, y: 0 },
        ], true)
        g.fillStyle(0xffffff, 0.08 + forca * 0.3)
        g.fillPoints([
          { x: x0 + largura, y: ALTURA },
          { x: x0 + largura + 3, y: ALTURA },
          { x: x0 + largura + 3 + ALTURA * inclinacao, y: 0 },
          { x: x0 + largura + ALTURA * inclinacao, y: 0 },
        ], true)
      }
    },
  }
}
