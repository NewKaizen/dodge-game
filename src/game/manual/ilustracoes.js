import { aleatorio } from '../pvp/baralho.js'
import { circuloGiz, coracaoGiz, contornoDoCoracao, estrelaGiz, linhaGiz, poligonoGiz, preencherGiz, setaGiz, xGiz } from './giz.js'

// Os desenhos do manual (só dados: camadas de traços, sem Phaser). Cada camada é
// { tracos, cor, largura, alpha? }; a cena pinta com giz.desenharTracos. O Ralsei é um rabisco
// ORIGINAL (chapéu de feltro, orelhas caídas, cachecol): silhueta e fala próprias, sem arte copiada.

export const CORES_GIZ = {
  tinta: 0x2b2540, // texto e contornos escuros
  grafite: 0x3b4a8a, // borda da caixa
  coracao: 0xe5243b,
  coracaoMiolo: 0xf4617a,
  bala: 0x5b2fa8,
  balaMiolo: 0x8f66dc,
  marca: 0xe0a000,
  marcaX: 0x138a7a,
  adesivo: 0xffd23a,
  certo: 0x2da44e,
}

// ---------- Ralsei ----------
export function rabiscoDoRalsei(rng) {
  const camadas = []
  const camada = (tracos, cor, largura = 2.6, alpha) => camadas.push({ tracos, cor, largura, alpha })

  // cachecol (atrás do queixo)
  const cachecol = [
    { x: -34, y: 24 },
    { x: 34, y: 24 },
    { x: 40, y: 50 },
    { x: 8, y: 58 },
    { x: 12, y: 84 },
    { x: -6, y: 86 },
    { x: -8, y: 56 },
    { x: -40, y: 48 },
  ]
  camada(preencherGiz(rng, cachecol, { espaco: 3.4, angulo: 0.7 }), 0xf08a2e, 2, 0.85)
  camada(poligonoGiz(rng, cachecol, { tremor: 0.9 }), 0x9a4d10, 2.4)

  // orelhas caídas
  for (const lado of [-1, 1]) {
    const orelha = [
      { x: lado * 26, y: -14 },
      { x: lado * 56, y: -6 },
      { x: lado * 60, y: 26 },
      { x: lado * 34, y: 10 },
    ]
    camada(preencherGiz(rng, orelha, { espaco: 3.4, angulo: -0.5 }), 0x2f6f73, 2, 0.9)
    camada(poligonoGiz(rng, orelha, { tremor: 0.8 }), 0x1d3f42, 2.4)
  }

  // rosto
  const rosto = Array.from({ length: 24 }, (_, i) => ({ x: Math.cos((i / 24) * 6.2832) * 34, y: Math.sin((i / 24) * 6.2832) * 31 }))
  camada(preencherGiz(rng, rosto, { espaco: 3.6, angulo: 0.5 }), 0xfbe6d3, 2.4, 0.95)
  camada(circuloGiz(rng, 0, 0, 33, { tremor: 1.2 }), 0x2b2540, 2.8)
  // olhos, bochechas e sorriso
  for (const lado of [-1, 1]) {
    camada(circuloGiz(rng, lado * 12, -3, 3.4, { tracos: 1, tremor: 0.3 }), 0x2b2540, 4.2)
    camada(circuloGiz(rng, lado * 22, 9, 5, { tracos: 1, tremor: 0.5 }), 0xff8fa8, 3.2, 0.8)
  }
  camada(linhaGiz(rng, -8, 12, -2, 16, { tracos: 1, tremor: 0.3, excesso: 0 }), 0x2b2540, 2.4)
  camada(linhaGiz(rng, -2, 16, 6, 14, { tracos: 1, tremor: 0.3, excesso: 0 }), 0x2b2540, 2.4)
  camada(linhaGiz(rng, 6, 14, 10, 10, { tracos: 1, tremor: 0.3, excesso: 0 }), 0x2b2540, 2.4)

  // chapéu mole e a aba
  const chapeu = [
    { x: -36, y: -26 },
    { x: 36, y: -26 },
    { x: 14, y: -78 },
    { x: 36, y: -102 },
    { x: 2, y: -98 },
    { x: -20, y: -58 },
  ]
  camada(preencherGiz(rng, chapeu, { espaco: 3.2, angulo: -0.8 }), 0x37b36a, 2.2, 0.95)
  camada(poligonoGiz(rng, chapeu, { tremor: 0.9 }), 0x1b6e3d, 2.6)
  camada(linhaGiz(rng, -52, -26, 52, -26, { tracos: 2, tremor: 1.4 }), 0x1b6e3d, 4.2)
  camada(linhaGiz(rng, -30, -40, 28, -40, { tracos: 1, tremor: 0.9 }), 0xffd23a, 5)
  return camadas
}

// ---------- coração, bala, marcas, adesivos ----------

// Uma variante de giz do coração do jogador, centrada na origem (a cena move o Graphics).
// `largura` = tamanho visual; a colisão é o miolo CORACAO.hitbox, independente disto.
export function rabiscoDoCoracao(rng, largura = 22) {
  const miolo = contornoDoCoracao(0, 0, largura - 3, 28)
  return {
    preenchimento: preencherGiz(rng, miolo, { espaco: 2.6, angulo: -0.7, tremor: 0.4, folga: 0.5 }),
    contorno: coracaoGiz(rng, 0, 0, largura, { tremor: 0.55, passo: 3.2, rabo: 0.05 }),
  }
}

// Bala de giz: círculo + hachura, centrado na origem. Tremor baixo: o desenho nunca passa
// de ~1,5 px da forma exata da bala (a hitbox continua o círculo de raio `raio`).
export function rabiscoDaBala(rng, raio) {
  const poli = Array.from({ length: 16 }, (_, i) => ({ x: Math.cos((i / 16) * 6.2832) * (raio - 0.5), y: Math.sin((i / 16) * 6.2832) * (raio - 0.5) }))
  return {
    preenchimento: preencherGiz(rng, poli, { espaco: 2.4, angulo: aleatorio(rng) * 3, tremor: 0.3, folga: 0.4 }),
    contorno: circuloGiz(rng, 0, 0, raio, { tremor: 0.5, passo: 3.4, rabo: 0.06 }),
  }
}

export function rabiscoDaMarca(rng, forma, r = 13) {
  return forma === 'x' ? xGiz(rng, 0, 0, r, { tremor: 0.8 }) : estrelaGiz(rng, 0, 0, r, { tremor: 0.8 })
}

// a seta torta do "este é você" (em coordenadas absolutas)
export const rabiscoDaSeta = (rng, x0, y0, x1, y1) => setaGiz(rng, x0, y0, x1, y1, { tremor: 1.1 })

// o risco de baixo de um título
export const sublinhado = (rng, x0, y, x1) => linhaGiz(rng, x0, y, x1, y + (aleatorio(rng) * 2 - 1) * 2, { tracos: 2, tremor: 1.3, excesso: 4 })

// estrelinhas e espirais a lápis nas margens da folha (decoração, bem fraco)
export function rabiscosDaMargem(rng, largura, altura, caixaLivre) {
  const tracos = []
  const livre = (x, y) => x > caixaLivre.esquerda && x < caixaLivre.direita && y > caixaLivre.topo && y < caixaLivre.base
  const pontos = [
    [24, 40], [832, 40], [826, 440], [28, 452], [418, 24], [730, 24], [832, 238], [20, 232],
  ]
  for (const [x, y] of pontos) {
    if (livre(x, y)) continue
    const k = aleatorio(rng)
    if (k < 0.4) tracos.push(...estrelaGiz(rng, x, y, 7 + aleatorio(rng) * 3, { tremor: 0.6 }))
    else if (k < 0.7) tracos.push(...circuloGiz(rng, x, y, 6 + aleatorio(rng) * 3, { tremor: 0.7, tracos: 1 }))
    else tracos.push(...coracaoGiz(rng, x, y, 14, { tremor: 0.5, tracos: 1 }))
  }
  // ondinhas soltas nos cantos
  for (const [x, y] of [[60, 20], [790, 462], [800, 22], [48, 466]]) {
    const onda = []
    for (let i = 0; i <= 10; i++) onda.push({ x: x + i * 4, y: y + Math.sin(i * 1.3 + aleatorio(rng)) * 3 })
    tracos.push(onda)
  }
  return tracos
}
