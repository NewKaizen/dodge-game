import Phaser from 'phaser'
import { LARGURA } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { etiqueta, poeirinha, texturaRede, texturaReciario, chaoDeAreia } from './arteColiseu.js'

// REDE DO RECIÁRIO: um gladiador de rede e tridente fica entre as caixas e
// joga a rede, uma caixa de cada vez (alternando). O aviso: um círculo
// tracejado girando no chão, onde a rede vai cair, com a sombra dela crescendo
// (AVISO_MS); no fim a rede voa do gladiador até lá e cai. Quem estiver dentro
// do círculo fica PRESO: o coração anda bem devagar (LENTO) e para soltar é
// SACUDIR as setas (cada troca de sentido forte conta; SACUDIDAS_PARA_SOLTAR)
// ou esperar PRESO_MAX_MS. A rede não machuca: o perigo é ficar lento no meio
// das balas. Quem acabou de se soltar tem um respiro (IMUNE_MS) antes de poder
// ser pego de novo. A CPU sacode para se soltar (joy()).
// terminar() solta todo mundo e apaga o gladiador e as redes.

const AVISO_MS = 1050
const VOO_MS = 480 // a rede voa no fim do aviso
const ALTERNA_MS = { min: 1000, max: 1350 } // ms entre arremessos (alternando as caixas)
const PRIMEIRO_MS = 400
const RAIO = 30
const LENTO = 0.16 // fração do joystick enquanto preso
const SACUDIDAS_PARA_SOLTAR = 5
const PRESO_MAX_MS = 1800
const IMUNE_MS = 900
const FORTE = 45 // |joy| a partir do qual uma direção conta como sacudida
const GLADIADOR = { x: LARGURA / 2, y: 330 }
const COR_ALVO = 0xffd060

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  const vivos = new Set()
  let ativo = false
  let chao = null // areia no chão das caixas
  let t = 0
  let proximo = PRIMEIRO_MS
  let vez = Math.floor(sorte() * 2) // próxima caixa a receber a rede
  let gladiador = null
  let redes = [] // em voo/aviso: { j, pista, x, y, t0, alvo, sombra, voando: [img principal, img caixa] }
  let presos = [null, null] // { ate, sacudidas, ultimo, rede, dica, pips }
  let imuneAte = [0, 0]
  let caidas = [] // redes que erraram, no chão (somem)

  const guardar = (o) => {
    vivos.add(o)
    o.once?.('destroy', () => vivos.delete(o))
    return o
  }

  const dono = (j) => arena.donoDaPista?.(j) ?? j
  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !p.ataque.desarmado && !arena.ko?.[dono(j)] ? p : null
  }
  const escala = RAIO / 34 // a textura da rede tem raio 34

  // ---------- arremesso ----------

  const arremessar = (j) => {
    const pista = pistaViva(j)
    if (!pista) return false
    const l = pista.caixa.limites
    const c = pista.coracoes[0]
    const m = RAIO * 0.6
    // mira onde o coração está (com um errinho): dá tempo de sair andando
    const x = Phaser.Math.Clamp((c?.ativo ? c.x : l.centerX) + entre(-14, 14), l.left + m, l.right - m)
    const y = Phaser.Math.Clamp((c?.ativo ? c.y : l.centerY) + entre(-10, 10), l.top + m, l.bottom - m)
    const alvo = guardar(arena.add.graphics().setDepth(6))
    const sombra = guardar(arena.add.ellipse(x, y, RAIO * 2, RAIO * 2, 0x1a0a04, 0).setDepth(3))
    pista.caixa.recortar(alvo, sombra)
    redes.push({ j, pista, x, y, t0: t, alvo, sombra, voando: null })
    gladiador.setFlipX(j === 0).setFrame('r0')
    return true
  }

  const desenharAlvo = (r, idade) => {
    const g = r.alvo
    const k = Math.min(1, idade / (AVISO_MS / aceleracao))
    const pisca = Math.sin(idade / 60) > 0 ? 1 : 0.45
    g.clear()
    g.fillStyle(COR_ALVO, 0.08 + 0.1 * k)
    g.fillCircle(r.x, r.y, RAIO)
    g.lineStyle(2, COR_ALVO, 0.9 * pisca)
    const pedacos = 14
    for (let i = 0; i < pedacos; i++) {
      const a0 = (i / pedacos) * Math.PI * 2 + idade / 400
      g.beginPath()
      g.arc(r.x, r.y, RAIO, a0, a0 + (Math.PI * 2) / pedacos / 1.7)
      g.strokePath()
    }
    // cruz de mira encolhendo para o centro
    const d = RAIO * (1 - k) + 4
    g.lineStyle(1, COR_ALVO, 0.8)
    g.lineBetween(r.x - d - 5, r.y, r.x - d, r.y)
    g.lineBetween(r.x + d, r.y, r.x + d + 5, r.y)
    g.lineBetween(r.x, r.y - d - 5, r.x, r.y - d)
    g.lineBetween(r.x, r.y + d, r.x, r.y + d + 5)
    r.sombra.setFillStyle(0x1a0a04, 0.1 + 0.3 * k).setScale(0.3 + 0.7 * k)
  }

  // a rede voando: uma imagem para a câmera principal (fora das caixas) e uma
  // recortada na caixa (dentro dela a principal fica coberta)
  const voar = (r, p) => {
    if (!r.voando) {
      const fora = guardar(arena.add.image(GLADIADOR.x, GLADIADOR.y, texturaRede(arena)).setDepth(94).setScale(escala * 0.4))
      const dentro = guardar(arena.add.image(GLADIADOR.x, GLADIADOR.y, texturaRede(arena)).setDepth(9).setScale(escala * 0.4))
      r.pista.caixa.recortar(dentro)
      r.voando = [fora, dentro]
      gladiador.setFrame('r1')
      tocar(arena, 'rede')
    }
    const ox = GLADIADOR.x + (r.j === 0 ? -10 : 10)
    const oy = GLADIADOR.y - 16
    const x = ox + (r.x - ox) * p
    const y = oy + (r.y - oy) * p - Math.sin(p * Math.PI) * 50
    for (const img of r.voando) img.setPosition(x, y).setScale(escala * (0.4 + 0.6 * p)).setRotation(p * 4 * (r.j === 0 ? -1 : 1))
  }

  const cair = (r) => {
    r.alvo.destroy()
    r.sombra.destroy()
    const [fora, dentro] = r.voando ?? []
    fora?.destroy()
    gladiador.setFrame('r0')
    poeirinha(arena, r.pista, r.x, r.y + RAIO * 0.5, { quantidade: 6, raio: 3, espalha: RAIO * 1.4, vivos })
    const c = r.pista.coracoes[0]
    const pegou = c?.ativo && !presos[r.j] && t >= imuneAte[r.j] && !arena.ko?.[dono(r.j)] && Math.hypot(c.x - r.x, c.y - r.y) <= RAIO + c.hitbox
    if (pegou) prender(r.j, r.pista, dentro)
    else if (dentro) {
      // errou: a rede fica no chão um instante e some
      dentro.setPosition(r.x, r.y).setScale(escala).setRotation(0).setDepth(3).setAlpha(0.85)
      caidas.push(dentro)
      arena.tweens.add({ targets: dentro, alpha: 0, delay: 350, duration: 300, onComplete: () => dentro.destroy() })
      tocar(arena, 'cravar')
    }
  }

  // ---------- preso ----------

  const prender = (j, pista, rede) => {
    tocar(arena, 'redePegou')
    shake(arena, 140, 0.004)
    const c = pista.coracoes[0]
    rede = rede ?? guardar(arena.add.image(c.x, c.y, texturaRede(arena)).setDepth(11))
    rede.setDepth(11).setScale(escala * 0.62).setRotation(0)
    pista.caixa.recortar(rede)
    const l = pista.caixa.limites
    const dica = guardar(etiqueta(arena, l.centerX, l.top + 14, '← SACUDA! →', { cor: '#ffe060', tamanho: 13, pista, profundidade: 12 }))
    const pips = guardar(arena.add.graphics().setDepth(12))
    pista.caixa.recortar(pips)
    presos[j] = { pista, ate: t + PRESO_MAX_MS / aceleracao, sacudidas: 0, ultimo: null, rede, dica, pips, tremor: 0 }
    const txt = guardar(etiqueta(arena, Phaser.Math.Clamp(c.x, l.left + 36, l.right - 36), Math.max(l.top + 32, c.y - 26), 'PRESO!', { cor: '#ffd060', tamanho: 16, pista }))
    arena.tweens.add({ targets: txt, scale: { from: 1.6, to: 1 }, duration: 180, ease: 'Back.easeOut' })
    arena.tweens.add({ targets: txt, alpha: 0, y: txt.y - 8, delay: 500, duration: 250, onComplete: () => txt.destroy() })
  }

  const soltar = (j, rasgou) => {
    const p = presos[j]
    if (!p) return
    presos[j] = null
    imuneAte[j] = t + IMUNE_MS
    const c = p.pista.coracoes[0]
    if (rasgou) tocar(arena, 'redeSoltou')
    // pedaços de corda voando
    if (c) {
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2
        const pedaco = guardar(arena.add.rectangle(c.x, c.y, 6, 2, 0xe6d4a6).setDepth(11).setRotation(ang))
        p.pista.caixa.recortar(pedaco)
        arena.tweens.add({ targets: pedaco, x: c.x + Math.cos(ang) * 26, y: c.y + Math.sin(ang) * 26, alpha: 0, angle: 180, duration: 380, onComplete: () => pedaco.destroy() })
      }
    }
    for (const o of [p.rede, p.dica, p.pips]) o?.scene && o.destroy()
  }

  const atualizarPresos = (delta) => {
    presos.forEach((p, j) => {
      if (!p) return
      const c = p.pista.coracoes[0]
      if (!c?.ativo || arena.ko?.[dono(j)] || !p.pista.rodando) return soltar(j, false)
      if (t >= p.ate || p.sacudidas >= SACUDIDAS_PARA_SOLTAR) return soltar(j, true)
      p.tremor = Math.max(0, p.tremor - delta / 120)
      p.rede.setPosition(c.x + Math.sin(t / 30) * p.tremor * 3, c.y).setRotation(Math.sin(t / 40) * p.tremor * 0.3)
      p.dica.setAlpha(Math.sin(t / 90) > 0 ? 1 : 0.5)
      // bolinhas do quanto falta para soltar
      p.pips.clear()
      for (let k = 0; k < SACUDIDAS_PARA_SOLTAR; k++) {
        const x = c.x - ((SACUDIDAS_PARA_SOLTAR - 1) * 7) / 2 + k * 7
        p.pips.fillStyle(k < p.sacudidas ? 0xffe060 : 0x000000, k < p.sacudidas ? 1 : 0.6).fillCircle(x, c.y + 20, 2.5)
      }
    })
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      chao = chaoDeAreia(arena)
      t = 0
      proximo = PRIMEIRO_MS
      gladiador = guardar(arena.add.sprite(GLADIADOR.x, GLADIADOR.y, texturaReciario(arena), 'r0').setOrigin(0.5, 1).setScale(1.5).setDepth(30))
      arena.tweens.add({ targets: gladiador, y: { from: GLADIADOR.y + 30, to: GLADIADOR.y }, alpha: { from: 0, to: 1 }, duration: 300, ease: 'Back.easeOut' })
    },

    // preso: o coração anda devagar; cada troca forte de sentido é uma sacudida
    joy(j, joy) {
      const p = ativo && presos[j]
      if (!p) return joy
      let entrada = joy
      if (dono(j) === arena.cpu) entrada = { x: Math.floor(t / 110) % 2 ? 100 : -100, y: 0 } // a CPU sacode
      const forte = Math.abs(entrada.x) >= Math.abs(entrada.y) ? (Math.abs(entrada.x) > FORTE ? `x${Math.sign(entrada.x)}` : null) : Math.abs(entrada.y) > FORTE ? `y${Math.sign(entrada.y)}` : null
      if (forte && forte !== p.ultimo) {
        if (p.ultimo !== null) {
          p.sacudidas++
          p.tremor = 1
          tocar(arena, 'patins')
        }
        p.ultimo = forte
      }
      return { x: entrada.x * LENTO, y: entrada.y * LENTO }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      chao.atualizar()
      proximo -= delta
      if (proximo <= 0) {
        // tenta a caixa da vez; se ela não puder (K.O., sem ataque), tenta a outra
        if (!arremessar(vez)) arremessar(1 - vez)
        vez = 1 - vez
        proximo = entre(ALTERNA_MS.min, ALTERNA_MS.max) / aceleracao
      }
      const aviso = AVISO_MS / aceleracao
      for (const r of redes) {
        const idade = t - r.t0
        desenharAlvo(r, idade)
        const comeca = aviso - VOO_MS
        if (idade >= comeca) voar(r, Math.min(1, (idade - comeca) / VOO_MS))
        if (idade >= aviso) {
          r.feita = true
          cair(r)
        }
      }
      redes = redes.filter((r) => !r.feita)
      atualizarPresos(delta)
      // o gladiador respira e acompanha a caixa da vez
      if (gladiador && !arena.tweens.isTweening(gladiador)) gladiador.setY(GLADIADOR.y + Math.round(Math.sin(t / 300)))
    },

    estadoDebug() {
      return { redes: redes.length, presos: presos.map((p) => (p ? { sacudidas: p.sacudidas, resta: Math.round(p.ate - t) } : null)) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      chao?.destruir()
      chao = null
      presos = [null, null]
      redes = []
      caidas = []
      gladiador = null
      for (const o of [...vivos]) {
        arena.tweens?.killTweensOf(o)
        o.destroy()
      }
      vivos.clear()
    },
  }
}
