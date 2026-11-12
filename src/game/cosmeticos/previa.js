// PRÉVIA: uma miniatura em loop de qualquer cosmético (Coleção, revelação da loot box, galeria).
//
//   previa(scene, tipo, id, x, y, tamanho) -> { destroy(), tocar?(), repetir?() }
//   tipo 'som'        ícone de alto-falante; tocar() toca o som (e as ondinhas pulsam)
//   tipo 'efeito'     uma carta de mentira (verso) com o efeito, balançando de leve para mostrar que ele segue
//   tipo 'lancamento' a animação repetida de um ponto a outro, com uma pausa entre as voltas
//   tipo 'moldura'    um avatar de mentira com a moldura
import { animarLancamento } from './lancamentos.js'
import { aplicarEfeitoCarta } from './efeitos.js'
import { desenharMoldura } from './molduras.js'
import { tocarSomDano } from './sons.js'
import { ligarAtualizacao, garantirTexturas, reduzido } from './util.js'

const VAZIO = { destroy() {} }

// verso de carta desenhado por código (só para a prévia)
export function cartaDeMentira(scene, x, y, largura) {
  const altura = Math.round((largura * 10) / 7)
  const c = scene.add.container(x, y)
  const g = scene.add.graphics()
  const hw = largura / 2
  const hh = altura / 2
  const u = largura / 70
  g.fillStyle(0xf2ead8, 1).fillRoundedRect(-hw, -hh, largura, altura, 6 * u)
  g.fillStyle(0x2a1f55, 1).fillRoundedRect(-hw + 4 * u, -hh + 4 * u, largura - 8 * u, altura - 8 * u, 3.5 * u)
  g.lineStyle(1 * u, 0x6a5ac0, 0.8)
  // treliça de losangos recortada na área do verso
  const x0 = -hw + 4 * u
  const x1 = hw - 4 * u
  const y0 = -hh + 4 * u
  const y1 = hh - 4 * u
  const passo = 12 * u
  for (let d = -hh * 2; d <= hh * 2; d += passo) {
    for (const s of [1, -1]) {
      // reta y = s * x + d, recortada em [x0,x1] x [y0,y1]
      const ax = Math.max(x0, s > 0 ? y0 - d : d - y1)
      const bx = Math.min(x1, s > 0 ? y1 - d : d - y0)
      if (ax < bx) g.lineBetween(ax, s * ax + d, bx, s * bx + d)
    }
  }
  g.fillStyle(0x2a1f55, 1).fillCircle(0, 0, 14 * u)
  g.lineStyle(1.4 * u, 0xd9a93c, 1).strokeCircle(0, 0, 14 * u)
  g.fillStyle(0xd9a93c, 1).fillCircle(0, 0, 4 * u)
  c.add(g)
  c.largura = largura
  c.altura = altura
  return c
}

function iconeSom(scene, x, y, tamanho) {
  const c = scene.add.container(x, y)
  const g = scene.add.graphics()
  const s = tamanho / 64
  c.add(g)
  let pulso = 0
  const lig = ligarAtualizacao(scene, (t, dt) => {
    pulso = Math.max(0, pulso - dt / 450)
    g.clear()
    g.fillStyle(0xe8e4f4, 1)
    g.fillRect(-18 * s, -7 * s, 9 * s, 14 * s)
    g.fillPoints([{ x: -9 * s, y: -7 * s }, { x: 3 * s, y: -17 * s }, { x: 3 * s, y: 17 * s }, { x: -9 * s, y: 7 * s }], true)
    for (let i = 0; i < 3; i++) {
      const forca = Math.max(0, pulso * 1.6 - i * 0.25)
      g.lineStyle(3 * s, 0xffd34d, 0.25 + Math.min(0.75, forca))
      g.beginPath()
      g.arc(3 * s, 0, (10 + i * 8 + forca * 4) * s, -0.9, 0.9)
      g.strokePath()
    }
  }, () => c.destroy())
  return {
    destroy: () => lig.destroy(),
    pulsar: () => {
      pulso = 1
    },
  }
}

export function previa(scene, tipo, id, x, y, tamanho = 64) {
  try {
    garantirTexturas(scene)
    if (tipo === 'som') {
      const icone = iconeSom(scene, x, y, tamanho)
      return {
        destroy: icone.destroy,
        tocar: () => {
          icone.pulsar()
          return tocarSomDano(scene, id)
        },
      }
    }

    if (tipo === 'efeito') {
      const carta = cartaDeMentira(scene, x, y, Math.round(tamanho * 0.7))
      const efeito = aplicarEfeitoCarta(scene, carta, id)
      const lig = ligarAtualizacao(scene, (t) => {
        if (!carta.active) return false
        if (!reduzido()) carta.setPosition(x + Math.sin(t / 700) * tamanho * 0.12, y + Math.cos(t / 900) * tamanho * 0.05)
      }, () => {
        efeito.destroy()
        if (carta.active) carta.destroy()
      })
      return { destroy: () => lig.destroy() }
    }

    if (tipo === 'lancamento') {
      const alc = tamanho * 0.95
      const base = scene.add.container(x, y)
      const g = scene.add.graphics()
      g.lineStyle(2, 0x6a6680, 0.8).strokeCircle(-alc, 0, 7)
      g.lineStyle(2, 0xd0485a, 0.9).strokeCircle(alc, 0, 11)
      g.lineBetween(alc - 16, 0, alc + 16, 0)
      g.lineBetween(alc, -16, alc, 16)
      base.add(g)
      let espera = 200
      let rodando = false
      let vivo = true
      const lanca = () => {
        rodando = true
        animarLancamento(scene, { x: x - alc, y, alvoX: x + alc, alvoY: y, cor: 0xffd34d, escala: Math.min(1, tamanho / 240) }, id).then(() => {
          rodando = false
          espera = 650
        })
      }
      const lig = ligarAtualizacao(scene, (t, dt) => {
        if (!vivo) return false
        if (!rodando) {
          espera -= dt
          if (espera <= 0) lanca()
        }
      }, () => {
        vivo = false
        if (base.active) base.destroy()
      })
      return { destroy: () => lig.destroy(), repetir: () => { if (!rodando) espera = 0 } }
    }

    if (tipo === 'moldura') {
      const lado = Math.round(tamanho * 0.62)
      const avatar = scene.add.container(x, y)
      const g = scene.add.graphics()
      g.fillStyle(0x3a3358, 1).fillRect(-lado / 2, -lado / 2, lado, lado)
      g.fillStyle(0xbdb8d0, 1).fillCircle(0, -lado * 0.1, lado * 0.2)
      g.fillStyle(0xbdb8d0, 1).fillRoundedRect(-lado * 0.32, lado * 0.14, lado * 0.64, lado * 0.4, 6)
      avatar.add(g)
      const moldura = desenharMoldura(scene, x, y, lado, id)
      moldura.setDepth((avatar.depth ?? 0) + 1)
      return {
        destroy: () => {
          if (avatar.active) avatar.destroy()
          if (moldura.active) moldura.destroy()
        },
      }
    }
  } catch {
    // prévia que falha some quieta
  }
  return VAZIO
}
