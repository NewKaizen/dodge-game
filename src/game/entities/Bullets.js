import Phaser from 'phaser'
import { ATAQUE, CORES } from '../constants.js'
import { RAIO_BALA } from '../arte/texturas.js'
import { avisar } from '../attacks/validacao.js'

const MARGEM = 160 // distância fora da caixa em que a bala é removida
const ESCALA_BARRA = 32 / 24 // textura bala-barra: miolo de 24px numa tela de 32px

// Balas do turno inimigo: aviso (telegrafo), movimento, colisão e graze.
//
// Opções de a.bala({...}):
//   x, y               posição inicial
//   vx, vy, ax, ay     velocidade (px/s) e aceleração (px/s²)
//   forma              textura bala-<forma> (bola, losango, coroa, hex, barra, espadas, copas, ouros, paus, foice)
//   raio               bala redonda (padrão 6)
//   largura, altura    bala retangular (não gira)
//   comprimento, espessura, angulo   segmento (lâminas, pode girar)
//   girar              rad/s (visual; em segmentos também gira a colisão)
//   pulso              amplitude do pulso de tamanho (padrão 0.08)
//   cor, dano
//   aviso              ms parada, piscando e inofensiva antes de valer (padrão ATAQUE.telegrafoMs)
//   jaAvisada          o ataque já telegrafou com a.aviso(): começa valendo
//   vida               ms até sumir depois de ativa
//   quicar             quantas vezes rebate nas paredes da caixa
//   atravessa          não some ao acertar um coração
//   atualizar(bala, dt)  lógica extra por frame (pode mudar x, vx, angulo, morta, piscar...)
//   textura            chave de uma textura qualquer (ex.: sprites dos SUPERs) no lugar de bala-<forma>;
//                      com textura própria a bala só é pintada se vier `cor`
//   quadro             quadro da spritesheet (com `textura`)
//   tamanho            px do lado maior do sprite (com `textura`; padrão: o tamanho da colisão)
export default class Balas {
  constructor(scene, caixa) {
    this.scene = scene
    this.caixa = caixa
    this.limites = caixa.limites
    this.lista = []
    this.velocidadeMax = Infinity
    this.fatorVelocidade = 1
    this.criadas = 0 // total de balas criadas (diagnóstico: debugJogo.estado())
  }

  criar(o) {
    const tipo = o.comprimento !== undefined ? 'segmento' : o.largura !== undefined ? 'retangulo' : 'circulo'
    const forma = o.forma ?? (tipo === 'circulo' ? 'bola' : 'barra')
    const propria = o.textura && this.scene.textures.exists(o.textura)
    const textura = propria ? o.textura : this.scene.textures.exists(`bala-${forma}`) ? `bala-${forma}` : 'bala-bola'
    const sprite = this.scene.add.image(o.x, o.y, textura, propria ? o.quadro : undefined).setDepth(5)
    if (!propria) sprite.setTint(o.cor ?? CORES.bala)
    else if (o.cor !== undefined) sprite.setTint(o.cor)
    const aviso = o.jaAvisada ? 0 : (o.aviso ?? ATAQUE.telegrafoMs)

    if (!o.jaAvisada && aviso < ATAQUE.telegrafoMs) {
      avisar(`telegrafo:${o.origem}`, `[telegrafo] ${o.origem}: bala com aviso de ${aviso}ms (mínimo ${ATAQUE.telegrafoMs}ms)`)
    }

    const b = {
      sprite,
      tipo,
      x: o.x,
      y: o.y,
      vx: o.vx ?? 0,
      vy: o.vy ?? 0,
      ax: o.ax ?? 0,
      ay: o.ay ?? 0,
      raio: o.raio ?? 6,
      largura: o.largura,
      altura: o.altura ?? o.largura,
      comprimento: o.comprimento,
      espessura: o.espessura ?? 8,
      angulo: o.angulo ?? 0,
      girar: o.girar ?? 0,
      pulso: o.pulso ?? 0.08,
      fase: Math.random() * Math.PI * 2, // só visual
      dano: o.dano ?? 5,
      vida: o.vida ?? Infinity,
      atravessa: !!o.atravessa,
      quicar: o.quicar ?? 0,
      atualizar: o.atualizar,
      aviso,
      idade: 0,
      grazeados: new Set(),
      morta: false,
      inofensiva: false,
      piscar: false,
      marcador: null,
      escalaX: 1,
      escalaY: 1,
    }

    if (propria) {
      // textura própria: o lado maior do sprite vira `tamanho` (padrão: o tamanho da colisão)
      const lado = o.tamanho ?? (tipo === 'circulo' ? b.raio * 2.4 : tipo === 'retangulo' ? Math.max(b.largura, b.altura) * 1.15 : b.comprimento * 1.05)
      sprite.setScale(lado / Math.max(1, sprite.width, sprite.height))
      if (tipo === 'segmento') sprite.setRotation(b.angulo)
    } else if (tipo === 'circulo') sprite.setScale(b.raio / RAIO_BALA)
    else if (tipo === 'retangulo') sprite.setDisplaySize(b.largura * ESCALA_BARRA, b.altura * ESCALA_BARRA)
    else sprite.setDisplaySize(b.comprimento * (forma === 'foice' ? 1.05 : ESCALA_BARRA), b.espessura * 2.2).setRotation(b.angulo)
    b.escalaX = sprite.scaleX
    b.escalaY = sprite.scaleY

    if (aviso > 0) {
      sprite.setAlpha(0.4)
      b.marcador = this.criarMarcador(b)
    }
    this.caixa.recortar(sprite)
    this.lista.push(b)
    this.criadas++
    return b
  }

  // Se a bala nasce fora da caixa, um "!" pisca na borda por onde ela vai entrar
  criarMarcador(b) {
    const l = this.limites
    if (Phaser.Geom.Rectangle.Contains(l, b.x, b.y)) return null
    const ponto = entrada(l, b.x, b.y, b.vx, b.vy)
    const m = this.scene.add
      .image(Phaser.Math.Clamp(ponto.x, l.left + 8, l.right - 8), Phaser.Math.Clamp(ponto.y, l.top + 8, l.bottom - 8), 'aviso')
      .setTint(CORES.aviso)
      .setDepth(6)
    this.caixa.recortar(m)
    return m
  }

  perigosa(b) {
    return !b.morta && !b.inofensiva && b.idade >= b.aviso
  }

  // aoAcertar(coracao, bala) deve devolver true se o acerto contou
  atualizar(dt, coracoes, aoAcertar, aoGrazear) {
    const s = dt / 1000
    const l = this.limites

    for (const b of this.lista) {
      b.idade += dt
      this.animar(b, dt)
      if (b.idade < b.aviso) continue // telegrafando: parada e inofensiva

      if (b.marcador || b.sprite.alpha < 1) {
        b.marcador?.destroy()
        b.marcador = null
        if (!b.inofensiva && !b.piscar) b.sprite.setAlpha(1) // piscando: animar() cuida do alpha
      }

      b.vx += b.ax * s
      b.vy += b.ay * s
      let vx = b.vx * this.fatorVelocidade
      let vy = b.vy * this.fatorVelocidade
      const v = Math.hypot(vx, vy)
      if (v > this.velocidadeMax) {
        vx *= this.velocidadeMax / v
        vy *= this.velocidadeMax / v
      }
      b.x += vx * s
      b.y += vy * s
      if (b.tipo === 'segmento') b.angulo += b.girar * s
      if (b.quicar > 0) this.quicar(b, l)
      b.vida -= dt
      b.atualizar?.(b, dt)
      b.sprite.setPosition(b.x, b.y)
      if (b.tipo === 'segmento') b.sprite.setRotation(b.angulo)

      const alcance = MARGEM + (b.comprimento ?? 0) / 2
      const fora = b.x < l.left - alcance || b.x > l.right + alcance || b.y < l.top - alcance || b.y > l.bottom + alcance
      if (b.morta || fora || b.vida <= 0) {
        b.morta = true
        continue
      }
      if (b.inofensiva) continue

      for (const c of coracoes) {
        if (!c.ativo) continue
        const folga = this.folga(b, c.x, c.y)
        if (folga <= c.hitbox) {
          if (aoAcertar(c, b) && !b.atravessa) b.morta = true
        } else if (folga <= c.graze && !b.grazeados.has(c)) {
          b.grazeados.add(c)
          aoGrazear(c, b)
        }
      }
    }

    for (const b of this.lista) {
      if (!b.morta) continue
      b.sprite.destroy()
      b.marcador?.destroy()
    }
    this.lista = this.lista.filter((b) => !b.morta)
  }

  animar(b, dt) {
    const t = b.idade / 1000
    if (b.tipo === 'circulo') {
      b.sprite.rotation += b.girar * (dt / 1000)
      const p = 1 + b.pulso * Math.sin(t * 9 + b.fase)
      b.sprite.setScale(b.escalaX * p, b.escalaY * p)
    }
    if (b.idade < b.aviso) {
      b.sprite.setAlpha(Math.sin(b.idade / 45) > 0 ? 0.75 : 0.25)
      b.marcador?.setAlpha(Math.sin(b.idade / 45) > 0 ? 1 : 0.3)
    } else if (b.piscar && !b.inofensiva) {
      b.sprite.setAlpha(Math.sin(b.idade / 35) > 0 ? 1 : 0.35)
    }
  }

  quicar(b, l) {
    const r = b.tipo === 'circulo' ? b.raio : 0
    if (b.x - r < l.left && b.vx < 0) this.rebater(b, 'vx', l.left + r, 'x')
    else if (b.x + r > l.right && b.vx > 0) this.rebater(b, 'vx', l.right - r, 'x')
    if (b.quicar <= 0) return
    if (b.y - r < l.top && b.vy < 0) this.rebater(b, 'vy', l.top + r, 'y')
    else if (b.y + r > l.bottom && b.vy > 0) this.rebater(b, 'vy', l.bottom - r, 'y')
  }

  rebater(b, eixoV, limite, eixo) {
    b[eixoV] = -b[eixoV]
    b[eixo] = limite
    b.quicar--
  }

  // Distância entre um ponto e a borda da bala (negativa = dentro)
  folga(b, px, py) {
    if (b.tipo === 'circulo') return Math.hypot(px - b.x, py - b.y) - b.raio
    if (b.tipo === 'retangulo') {
      const dx = Math.max(Math.abs(px - b.x) - b.largura / 2, 0)
      const dy = Math.max(Math.abs(py - b.y) - b.altura / 2, 0)
      return Math.hypot(dx, dy)
    }
    const cos = Math.cos(b.angulo)
    const sin = Math.sin(b.angulo)
    const rx = px - b.x
    const ry = py - b.y
    const t = Phaser.Math.Clamp(rx * cos + ry * sin, -b.comprimento / 2, b.comprimento / 2)
    return Math.hypot(rx - t * cos, ry - t * sin) - b.espessura / 2
  }

  // Fim do ataque: nada mais causa dano e tudo some em `ms`
  desarmar(ms) {
    for (const b of this.lista) {
      b.inofensiva = true
      b.marcador?.destroy()
      b.marcador = null
      this.scene.tweens.add({ targets: b.sprite, alpha: 0, duration: ms })
    }
  }

  limpar() {
    for (const b of this.lista) {
      this.scene.tweens.killTweensOf(b.sprite)
      b.sprite.destroy()
      b.marcador?.destroy()
    }
    this.lista = []
  }
}

// Ponto em que a reta (x, y) + t·(vx, vy) entra no retângulo
function entrada(l, x, y, vx, vy) {
  let tMin = 0
  let tMax = Infinity
  for (const [p, v, min, max] of [
    [x, vx, l.left, l.right],
    [y, vy, l.top, l.bottom],
  ]) {
    if (Math.abs(v) < 1e-6) {
      if (p < min || p > max) return { x, y }
      continue
    }
    let t1 = (min - p) / v
    let t2 = (max - p) / v
    if (t1 > t2) [t1, t2] = [t2, t1]
    tMin = Math.max(tMin, t1)
    tMax = Math.min(tMax, t2)
  }
  if (tMin > tMax) return { x, y }
  return { x: x + vx * tMin, y: y + vy * tMin }
}
