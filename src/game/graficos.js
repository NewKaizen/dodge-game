import Phaser from 'phaser'
import { pref, aoMudarPref } from './preferencias.js'
import { fatores, quantas } from './acessibilidade.js'
import { aplicarDaltonismo } from './daltonismo.js'
import { corTexto } from './constants.js'

// Liga as preferências de gráficos e de cor no jogo inteiro (uma vez, na Boot):
//
//   instalarGraficos(game)
//
//   - PARTÍCULAS: todo emissor do Phaser passa a soltar só a fração
//     fatores().particulas do que pediria (os marcados `festa`, de
//     effects/festa.js, a fração fatores().festa). Vale para explosões
//     (explode) e para emissores contínuos, em qualquer arquivo, na hora em
//     que a preferência muda. Um emissor que precise sair inteiro pode ser
//     marcado `emissor.essencial = true` (nenhum precisa hoje: partícula aqui
//     é sempre enfeite, nunca bala).
//   - MODO DALTÔNICO: aplica a paleta (daltonismo.js) já no começo e, quando a
//     preferência muda, troca na hora as cores velhas pelas novas no que já
//     está na tela (tints, formas e textos das cenas abertas, corações das pistas).
let instalado = false

export function instalarGraficos(game) {
  if (instalado) return
  instalado = true
  limitarParticulas()
  aplicarDaltonismo(pref('daltonismo'))
  aoMudarPref((chave, valor) => {
    if (chave !== 'daltonismo') return
    const { antes, depois } = aplicarDaltonismo(valor)
    recolorir(game, trocas(antes, depois))
  })
}

function limitarParticulas() {
  const proto = Phaser.GameObjects.Particles.ParticleEmitter.prototype
  const emitir = proto.emitParticle
  proto.emitParticle = function (count, x, y) {
    if (this.essencial) return emitir.call(this, count, x, y)
    const f = this.festa ? fatores().festa : fatores().particulas
    if (f >= 1) return emitir.call(this, count, x, y)
    const n = quantas(count ?? this.ops.quantity.onEmit(), f)
    if (n <= 0) return undefined
    return emitir.call(this, n, x, y)
  }
}

// ---------- troca de paleta ao vivo ----------

function trocas(antes, depois) {
  const numeros = new Map()
  const textos = new Map()
  const par = (a, b) => {
    if (a === b) return
    numeros.set(a, b)
    textos.set(corTexto(a), corTexto(b))
  }
  par(antes.aviso, depois.aviso)
  par(antes.acerto, depois.acerto)
  antes.almas.forEach((c, i) => par(c, depois.almas[i]))
  antes.textoAlmas.forEach((c, i) => c !== depois.textoAlmas[i] && textos.set(c.toLowerCase(), depois.textoAlmas[i]))
  return { numeros, textos }
}

function recolorir(game, { numeros, textos }) {
  if (!numeros.size && !textos.size) return
  const trocar = (o) => {
    if (o.list) o.list.forEach(trocar) // containers
    if (o.type === 'Text') {
      const nova = textos.get(String(o.style?.color ?? '').toLowerCase())
      if (nova) o.setColor(nova)
      return
    }
    if (o.isTinted && numeros.has(o.tintTopLeft)) o.setTint(numeros.get(o.tintTopLeft))
    if (o.isFilled && numeros.has(o.fillColor)) o.setFillStyle(numeros.get(o.fillColor), o.fillAlpha)
    if (o.isStroked && numeros.has(o.strokeColor)) o.setStrokeStyle(o.lineWidth, numeros.get(o.strokeColor), o.strokeAlpha)
  }
  for (const cena of game.scene.scenes) {
    if (!cena.sys.isActive() && !cena.sys.isPaused()) continue
    cena.children.list.forEach(trocar)
    // os corações guardam a cor (piscar no dano volta para ela)
    for (const pista of cena.pistas ?? []) {
      for (const c of pista.coracoes ?? []) if (numeros.has(c.cor)) c.cor = numeros.get(c.cor)
    }
    for (const mao of cena.maos ?? []) if (mao && numeros.has(mao.cor)) mao.cor = numeros.get(mao.cor)
  }
}
