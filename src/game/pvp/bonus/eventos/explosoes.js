import Phaser from 'phaser'
import { LARGURA, ALTURA } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { particulas } from '../../../effects/particulas.js'
import { ignorarNasCaixas } from '../../../recorte.js'

// CHUVA DE EXPLOSÕES: durante a esquiva caem bombas nas DUAS caixas. Cada
// uma é avisada: uma mira vermelha pulsa no ponto (recortada na caixa) e a
// bomba cai do alto da tela até ela (QUEDA_MS >= ATAQUE.telegrafoMs); aí
// explode (quadros bonus-explosao-0..7, tremor, faíscas) e uma bala redonda
// invisível de vida curta faz o dano na área, pelo caminho normal das balas
// (i-frames, graze). O ritmo aperta com o tempo e com a aceleração. Fora das
// caixas, explosões só de enfeite estouram pelo fundo da arena.

const QUEDA_MS = 900 // da mira aparecer até explodir (o aviso)
const RAIO = 24 // área de dano (px)
const DANO = 4
const VIDA_AREA = 250 // ms que a área machuca
const INTERVALO = { inicio: 1050, fim: 620, rampaMs: 14000 } // ms entre bombas em cada caixa
const MIRAR_CORACAO = 0.35 // chance de a bomba mirar onde o coração está
const ENFEITE_MS = { min: 650, max: 1300 } // explosões de enfeite fora das caixas
const COR = 0xff7a1a
const ANIM = 'bonus-explosao'
const QUADROS = 8

// Animação dos quadros (criada uma vez por jogo)
function animacaoExplosao(arena) {
  if (arena.anims.exists(ANIM)) return
  const chaves = Array.from({ length: QUADROS }, (_, k) => `bonus-explosao-${k}`)
  arena.anims.create({ key: ANIM, frames: chaves.map((key) => ({ key })), frameRate: 22, repeat: 0 })
}

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + (b - a) * sorte()
  const vivos = new Set() // tudo o que foi criado (para o terminar)
  let bombas = [] // { j, x, y, t, mira, bomba, sombra }
  let proxima = [0, 0] // ms até a próxima bomba de cada caixa
  let proximoEnfeite = 0
  let t = 0
  let ativo = false
  let ultimoSom = -Infinity

  const guardar = (o) => {
    vivos.add(o)
    o.once?.('destroy', () => vivos.delete(o))
    return o
  }

  const som = () => {
    if (t - ultimoSom < 160) return
    ultimoSom = t
    tocar(arena, 'explosaoGrande')
  }

  const intervalo = () => {
    const k = Math.min(1, t / INTERVALO.rampaMs)
    return (INTERVALO.inicio + (INTERVALO.fim - INTERVALO.inicio) * k) / aceleracao
  }

  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !arena.ko?.[j] ? p : null
  }

  // ---------- visual da explosão (objeto de tela: só a câmera principal) ----------

  const explosaoVisual = (x, y, tamanho, profundidade = 95) => {
    animacaoExplosao(arena)
    const s = guardar(arena.add.sprite(x, y, 'bonus-explosao-0').setDepth(profundidade))
    s.setScale(tamanho / Math.max(1, s.width)).setRotation(entre(0, Math.PI * 2))
    ignorarNasCaixas(arena, s)
    s.play(ANIM)
    s.once('animationcomplete', () => s.destroy())
    // anel de choque
    const anel = guardar(arena.add.circle(x, y, tamanho * 0.3).setStrokeStyle(3, 0xffe040, 0.9).setDepth(profundidade))
    ignorarNasCaixas(arena, anel)
    arena.tweens.add({ targets: anel, scale: 2.2, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => anel.destroy() })
    particulas(arena, x, y, { cor: COR, quantidade: 14, velocidade: 200, vida: 500, escala: 1.4 })
  }

  // ---------- bombas nas caixas ----------

  const criarMira = (pista, x, y) => {
    const mira = arena.add.image(x, y, 'bonus-alvo').setTint(0xff3030)
    mira.setScale((RAIO * 2.2) / Math.max(1, mira.width))
    mira.setDepth(6).setData('escala', mira.scale)
    // área de perigo (preenchida aos poucos até a explosão)
    const area = arena.add.circle(x, y, RAIO, 0xff3030, 0.12).setDepth(4)
    pista.caixa.recortar(mira, area)
    guardar(mira)
    guardar(area)
    return { mira, area }
  }

  const soltarBomba = (j) => {
    const pista = pistaViva(j)
    if (!pista) return
    const l = pista.caixa.limites
    const margem = 16
    let x = entre(l.left + margem, l.right - margem)
    let y = entre(l.top + margem, l.bottom - margem)
    const c = pista.coracoes[0]
    if (c?.ativo && sorte() < MIRAR_CORACAO) {
      x = Phaser.Math.Clamp(c.x, l.left + margem, l.right - margem)
      y = Phaser.Math.Clamp(c.y, l.top + margem, l.bottom - margem)
    }
    const { mira, area } = criarMira(pista, x, y)
    // a bomba cai do alto da tela (de fora das caixas: câmera principal)
    const bomba = arena.add.image(x, -30, 'bonus-bomba').setScale(1.4)
    guardar(bomba).setDepth(94)
    ignorarNasCaixas(arena, bomba)
    bombas.push({ j, x, y, t: 0, mira, area, bomba, giro: entre(-9, 9) })
  }

  const explodir = (b) => {
    for (const o of [b.mira, b.area, b.bomba]) o.destroy()
    explosaoVisual(b.x, b.y, RAIO * 3.2)
    shake(arena, 120, 0.006)
    som()
    const pista = pistaViva(b.j)
    if (!pista) return
    // a área de dano: bala redonda já avisada (a mira foi o aviso), invisível
    const bala = pista.balas.criar({ x: b.x, y: b.y, raio: RAIO, jaAvisada: true, vida: VIDA_AREA, atravessa: true, dano: DANO, cor: COR, pulso: 0, origem: 'bonus-explosoes' })
    bala.sprite.setVisible(false)
  }

  const atualizarBombas = (delta) => {
    for (const b of bombas) {
      b.t += delta
      const k = Math.min(1, b.t / QUEDA_MS)
      // queda acelerando (Quad.easeIn) do alto da tela até a mira
      b.bomba.setPosition(b.x, -30 + (b.y + 30) * k * k).setRotation(b.bomba.rotation + (b.giro * delta) / 1000)
      const pulso = 1 + 0.18 * Math.sin(b.t / 55)
      b.mira.setScale(b.mira.getData('escala') * (1.35 - 0.35 * k) * pulso).setAlpha(0.6 + 0.4 * k)
      b.area.setFillStyle(0xff3030, 0.1 + 0.3 * k)
      if (k >= 1) {
        b.feita = true
        explodir(b)
      }
    }
    bombas = bombas.filter((b) => !b.feita)
  }

  // ---------- enfeites fora das caixas ----------

  const dentroDeCaixa = (x, y) =>
    (arena.pistas ?? []).some((p) => {
      const l = p.caixa.limites
      return x > l.left - 40 && x < l.right + 40 && y > l.top - 40 && y < l.bottom + 40
    })

  const enfeite = () => {
    for (let tentativa = 0; tentativa < 8; tentativa++) {
      const x = entre(20, LARGURA - 20)
      const y = entre(20, ALTURA - 20)
      if (dentroDeCaixa(x, y)) continue
      explosaoVisual(x, y, entre(70, 120), 3) // atrás das cartas/HUD, por cima do fundo
      shake(arena, 160, 0.008)
      som()
      return
    }
  }

  return {
    comecar() {
      ativo = true
      t = 0
      // as caixas começam defasadas (não explode tudo junto)
      proxima = [entre(500, 800), entre(800, 1200)]
      proximoEnfeite = 300
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      for (let j = 0; j < 2; j++) {
        proxima[j] -= delta
        if (proxima[j] <= 0) {
          proxima[j] = intervalo() * entre(0.8, 1.2)
          soltarBomba(j)
        }
      }
      proximoEnfeite -= delta
      if (proximoEnfeite <= 0) {
        proximoEnfeite = entre(ENFEITE_MS.min, ENFEITE_MS.max) / aceleracao
        enfeite()
      }
      atualizarBombas(delta)
    },

    terminar() {
      ativo = false
      bombas = []
      for (const o of [...vivos]) {
        arena.tweens?.killTweensOf(o)
        o.destroy()
      }
      vivos.clear()
    },
  }
}
