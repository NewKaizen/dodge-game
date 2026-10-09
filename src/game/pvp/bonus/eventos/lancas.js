import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { poeirinha, texturaLanca, chaoDeAreia } from './arteColiseu.js'

// CHUVA DE LANÇAS: a plateia (e os soldados) atiram lanças do alto, em ondas.
// Cada lança é avisada pela SOMBRA no chão: uma mancha escura que cresce e
// escurece no ponto em que ela vai cair (QUEDA_MS), com um anel fino em volta.
// No fim do aviso a lança despenca na vertical (assobio) e CRAVA na areia:
// faz dano na pontinha (um círculo pequeno, por um instante) e fica cravada,
// em pé, como OBSTÁCULO por CRAVADA_MS (encostar na haste machuca um pouco),
// depois balança e some. As lanças de uma onda caem espalhadas (DISTANCIA_MIN
// entre elas e das cravadas) e nunca passam de MAX_CRAVADAS por caixa: sempre
// sobra muito espaço.
// Balas normais (dano, i-frames, graze, a CPU enxerga): a ponta nasce já no
// começo do aviso com `aviso` = QUEDA_MS (parada e inofensiva até cair) e a
// haste nasce na queda. Sprites das balas escondidos: o desenho é deste evento.

const QUEDA_MS = 900 // aviso (sombra) até a lança cravar
const DESCIDA_MS = 220 // a lança aparece caindo no fim do aviso
const ONDA = { min: 1300, max: 1800 } // ms entre ondas
const POR_ONDA = { min: 3, max: 5 }
const PRIMEIRA_MS = 450
const DISTANCIA_MIN = 34
const MAX_CRAVADAS = 9
const CRAVADA_MS = 2600
const PONTA = { raio: 9, vidaMs: 160, dano: 4 }
const HASTE = { largura: 5, altura: 24, dano: 3 }
const MIRAR_CORACAO = 0.3 // chance de uma lança da onda cair onde o coração está

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  const vivos = new Set()
  let ativo = false
  let chao = null // areia no chão das caixas
  let t = 0
  let proxima = [PRIMEIRA_MS, PRIMEIRA_MS + 300]
  let caindo = [] // { j, pista, x, y, t0, sombra, anel, lanca, ponta }
  let cravadas = [] // { j, pista, x, y, t0, lanca, haste, buraco }

  const guardar = (o) => {
    vivos.add(o)
    o.once?.('destroy', () => vivos.delete(o))
    return o
  }

  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !p.ataque.desarmado && !arena.ko?.[arena.donoDaPista?.(j) ?? j] ? p : null
  }

  // ponto livre: longe das outras lanças (caindo ou cravadas) desta caixa
  const pontoLivre = (j, l, mirar) => {
    const ocupados = [...caindo, ...cravadas].filter((x) => x.j === j)
    const margem = 16
    for (let k = 0; k < 14; k++) {
      let x = entre(l.left + margem, l.right - margem)
      let y = entre(l.top + margem + 12, l.bottom - margem)
      if (mirar && k === 0) {
        x = Math.min(l.right - margem, Math.max(l.left + margem, mirar.x))
        y = Math.min(l.bottom - margem, Math.max(l.top + margem + 12, mirar.y))
      }
      if (ocupados.every((o) => Math.hypot(o.x - x, o.y - y) >= DISTANCIA_MIN)) return { x, y }
    }
    return null
  }

  const onda = (j) => {
    const pista = pistaViva(j)
    if (!pista) return
    const l = pista.caixa.limites
    const n = Math.round(entre(POR_ONDA.min, POR_ONDA.max))
    const c = pista.coracoes[0]
    const mirar = c?.ativo && sorte() < MIRAR_CORACAO ? { x: c.x, y: c.y } : null
    for (let k = 0; k < n; k++) {
      if (cravadas.filter((x) => x.j === j).length + caindo.filter((x) => x.j === j).length >= MAX_CRAVADAS) break
      const p = pontoLivre(j, l, k === 0 ? mirar : null)
      if (!p) break
      // cada lança da onda sai um pouquinho depois da outra (chuva, não parede)
      const atraso = k * 110
      const sombra = guardar(arena.add.ellipse(p.x, p.y, 22, 8, 0x000000, 0).setDepth(3))
      const anel = guardar(arena.add.ellipse(p.x, p.y, 32, 12).setStrokeStyle(2, 0xff5040, 0).setDepth(3))
      const lanca = guardar(arena.add.image(p.x, l.top - 50, texturaLanca(arena)).setOrigin(0.5, 1).setDepth(7).setVisible(false))
      pista.caixa.recortar(sombra, anel, lanca)
      caindo.push({ j, pista, x: p.x, y: p.y, t0: t + atraso, sombra, anel, lanca, ponta: null, assobiou: false })
    }
  }

  const cravar = (c) => {
    const { pista, x, y } = c
    tocar(arena, 'cravar')
    shake(arena, 70, 0.002)
    poeirinha(arena, pista, x, y, { quantidade: 6, raio: 3, espalha: 16, vivos })
    c.sombra.destroy()
    c.anel.destroy()
    // a ponta de ferro fica enterrada: recorta os 8 px de baixo da textura
    c.lanca.setCrop(0, 0, 9, 36).setPosition(x, y + 8).setRotation((sorte() - 0.5) * 0.2)
    const buraco = guardar(arena.add.ellipse(x, y + 1, 10, 4, 0x140a02, 0.75).setDepth(3))
    pista.caixa.recortar(buraco)
    pista.caixa.recortar(c.lanca)
    // a haste vira obstáculo (retângulo em pé acima do ponto)
    if (pista.rodando && pista.ataque && !pista.ataque.desarmado) {
      const haste = pista.balas.criar({ x, y: y - HASTE.altura / 2 + 2, largura: HASTE.largura, altura: HASTE.altura, jaAvisada: true, atravessa: true, dano: HASTE.dano, origem: 'bonus-lancas' })
      haste.sprite.setVisible(false)
      cravadas.push({ j: c.j, pista, x, y, t0: t, lanca: c.lanca, haste, buraco })
    } else {
      c.lanca.destroy()
      buraco.destroy()
    }
  }

  const atualizarCaindo = () => {
    const queda = QUEDA_MS / aceleracao
    for (const c of caindo) {
      const idade = t - c.t0
      if (idade < 0) continue
      // a ponta (dano) nasce no começo do aviso: parada e inofensiva até a queda
      if (!c.ponta && c.pista.rodando) {
        c.ponta = c.pista.balas.criar({ x: c.x, y: c.y, raio: PONTA.raio, aviso: queda, vida: PONTA.vidaMs, atravessa: true, dano: PONTA.dano, pulso: 0, origem: 'bonus-lancas' })
        c.ponta.sprite.setVisible(false)
      }
      const k = Math.min(1, idade / queda)
      // sombra crescendo e escurecendo; anel vermelho piscando
      c.sombra.setFillStyle(0x000000, 0.2 + 0.45 * k).setScale(0.4 + 0.6 * k)
      c.anel.setStrokeStyle(2, 0xff6050, (Math.sin(idade / 55) > 0 ? 0.9 : 0.35) * (0.4 + 0.6 * k))
      // a lança despenca no fim do aviso
      const desce = idade - (queda - DESCIDA_MS)
      if (desce > 0) {
        if (!c.assobiou) {
          c.assobiou = true
          tocar(arena, 'assobio')
        }
        const p = Math.min(1, desce / DESCIDA_MS)
        const l = c.pista.caixa.limites
        c.lanca.setVisible(true).setPosition(c.x, l.top - 46 + (c.y + 6 - (l.top - 46)) * p * p)
      }
      if (k >= 1) {
        c.feito = true
        cravar(c)
      }
    }
    caindo = caindo.filter((c) => !c.feito)
  }

  const atualizarCravadas = () => {
    const vida = CRAVADA_MS / aceleracao
    for (const c of cravadas) {
      const idade = t - c.t0
      const fim = !c.pista.ataque || c.pista.ataque.desarmado
      // tremidinha logo depois de cravar
      if (idade < 300) c.lanca.setRotation(c.lanca.rotation * 0.9 + Math.sin(idade / 25) * 0.05 * (1 - idade / 300))
      // perto de sumir: pisca (vai sair do caminho)
      if (idade > vida - 450) c.lanca.setAlpha(Math.sin(idade / 50) > 0 ? 1 : 0.4)
      if (idade >= vida || fim) {
        c.feito = true
        c.haste.morta = true
        arena.tweens.add({ targets: [c.lanca, c.buraco], alpha: 0, duration: 200, onComplete: () => [c.lanca, c.buraco].forEach((o) => o.scene && o.destroy()) })
      }
    }
    cravadas = cravadas.filter((c) => !c.feito)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      chao = chaoDeAreia(arena)
      t = 0
      proxima = [PRIMEIRA_MS, PRIMEIRA_MS + 300]
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      chao.atualizar()
      for (let j = 0; j < 2; j++) {
        proxima[j] -= delta
        if (proxima[j] <= 0) {
          proxima[j] = entre(ONDA.min, ONDA.max) / aceleracao
          onda(j)
        }
      }
      atualizarCaindo()
      atualizarCravadas()
    },

    estadoDebug() {
      return { caindo: caindo.length, cravadas: cravadas.map((c) => ({ j: c.j, x: Math.round(c.x), y: Math.round(c.y) })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      chao?.destruir()
      chao = null
      for (const c of cravadas) c.haste.morta = true
      for (const c of caindo) if (c.ponta) c.ponta.morta = true
      caindo = []
      cravadas = []
      for (const o of [...vivos]) {
        arena.tweens?.killTweensOf(o)
        o.destroy()
      }
      vivos.clear()
    },
  }
}
