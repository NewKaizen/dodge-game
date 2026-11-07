import { contem, limitar } from '../phaserPuro.js'
import { ATAQUE, CORES } from '../constants.js'
import { RAIO_BALA } from '../arte/texturas.js'
import { avisar } from '../attacks/validacao.js'
import { MARGEM_FORA as MARGEM, avisoDaBala, balaEntrando, andarBala, quicarNaCaixa, longeDaCaixa, foraDaCaixa, folgaDaBala, entrada, distanciaFora } from './fisica.js'
const ESCALA_BARRA = 32 / 24 // textura bala-barra: miolo de 24px numa tela de 32px

// Balas de uma Pista: aviso (telegrafo), movimento, colisão e graze.
// As REGRAS (movimento, aviso, colisão) ficam em entities/fisica.js, sem Phaser: o Manual do Ralsei
// usa as mesmas (manual/__tests__/paridade.test.js roda esta classe lado a lado com o manual).
// As balas aparecem também na faixa de aproximação em volta da caixa
// (BattleBox.aproximar): dá para ver a bala chegando de fora. Enquanto está
// TODA fora da caixa ela não acerta nem dá graze (o coração nunca sai da caixa).
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
//   entrando           a bala nasce FORA da caixa e entra voando: a entrada pela
//                      borda é o aviso, então começa valendo (sem piscar e sem "!").
//                      Sem `aviso`/`jaAvisada`/`entrando`, uma bala que nasce fora da
//                      caixa com velocidade apontando para dentro já conta como
//                      entrando (entrando: false volta ao antigo: parada fora com "!")
//   arranque           { ms, vx, vy, ax?, ay? }: aos `ms` de idade a velocidade passa a ser
//                      (vx, vy) (e a aceleração (ax, ay), se vier).
//                      Para a bala que espia na borda devagar e depois dispara (lança,
//                      lâmina, forcado): os bots (pvp/botEsquiva.js) leem o arranque e
//                      desviam antes, como quem vê a ponta parada na borda
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
    const propria = Boolean(o.textura) // sprite próprio (habilidades/SUPER); senão a bala branca da forma
    const textura = o.textura ?? `bala-${forma}`
    const sprite = this.scene.add.image(o.x, o.y, textura, propria ? o.quadro : undefined).setDepth(5)
    if (!propria) sprite.setTint(o.cor ?? CORES.bala)
    else if (o.cor !== undefined) sprite.setTint(o.cor)
    const entrando = this.entrando(o)
    const aviso = avisoDaBala(o, this.limites)

    if (!o.jaAvisada && !entrando && aviso < ATAQUE.telegrafoMs) {
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
      arranque: o.arranque ?? null,
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
    this.caixa.aproximar(sprite) // visível também na faixa em volta da caixa
    this.lista.push(b)
    this.criadas++
    return b
  }

  // A bala é avisada pelo próprio trajeto? (nasce fora da caixa e entra voando)
  //   entrando: true    o ataque garante (vale mesmo com velocidade só no atualizar)
  //   entrando: false   nunca (bala de fora com `aviso` e "!" como antes)
  //   sem a opção       automático, só se o ataque não pediu `aviso` nem `jaAvisada`:
  //                     nasce fora e a reta da velocidade (ou da aceleração) entra na caixa
  entrando(o) {
    if (o.entrando === false || o.jaAvisada) return false
    const l = this.limites
    if (o.entrando) {
      const fora = !contem(l, o.x, o.y)
      if (!fora) avisar(`entrada:${o.origem}`, `[telegrafo] ${o.origem}: bala "entrando" nasceu dentro da caixa (vale na hora, sem aviso)`)
      else if (distanciaFora(l, o.x, o.y) > MARGEM) avisar(`entrada-longe:${o.origem}`, `[telegrafo] ${o.origem}: bala "entrando" nasceu a mais de ${MARGEM}px da caixa (some na hora)`)
    }
    return balaEntrando(o, l)
  }

  // Se a bala nasce fora da caixa, um "!" pisca na borda por onde ela vai entrar
  criarMarcador(b) {
    const l = this.limites
    if (contem(l, b.x, b.y)) return null
    const ponto = entrada(l, b.x, b.y, b.vx, b.vy)
    const m = this.scene.add
      .image(limitar(ponto.x, l.left + 8, l.right - 8), limitar(ponto.y, l.top + 8, l.bottom - 8), 'aviso')
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

      andarBala(b, dt, this.fatorVelocidade, this.velocidadeMax)
      if (b.quicar > 0) quicarNaCaixa(b, l)
      b.vida -= dt
      b.atualizar?.(b, dt)
      b.sprite.setPosition(b.x, b.y)
      if (b.tipo === 'segmento') b.sprite.setRotation(b.angulo)

      const fora = longeDaCaixa(b, l)
      if (b.morta || fora || b.vida <= 0) {
        b.morta = true
        continue
      }
      if (b.inofensiva) continue
      this.tocar(b, coracoes, aoAcertar, aoGrazear)
    }
    this.recolher()
  }

  // Só colisão/graze, sem andar nem envelhecer as balas: pista congelada
  // (Pista.congelada, DANÇA DA ESTÁTUA). O coração anda, as balas paradas
  // continuam machucando.
  colidir(coracoes, aoAcertar, aoGrazear) {
    for (const b of this.lista) if (this.perigosa(b)) this.tocar(b, coracoes, aoAcertar, aoGrazear)
    this.recolher()
  }

  tocar(b, coracoes, aoAcertar, aoGrazear) {
    if (this.foraDaCaixa(b)) return // ainda chegando (na faixa de fora): nem acerta nem grazeia
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

  // A bala inteira ainda está fora da caixa? (pela caixa que envolve a forma dela)
  foraDaCaixa(b) {
    return foraDaCaixa(b, this.limites)
  }

  // tira da lista (e da tela) as balas mortas
  recolher() {
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

  // Distância entre um ponto e a borda da bala (negativa = dentro)
  folga(b, px, py) {
    return folgaDaBala(b, px, py)
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
