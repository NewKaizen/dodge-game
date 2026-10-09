import { FONTE, ACELERACAO, parteDoFator } from '../../../constants.js'
import { tocar, velocidadeMusica } from '../../../audio.js'
import { ignorarNasCaixas } from '../../../recorte.js'
import { shake } from '../../../effects/shake.js'

// RELÓGIO DO TEMPO (TEMPLO): um relógio antigo pendurado entre as caixas
// manda no tempo do ATAQUE. Ele alterna entre CÂMERA LENTA (o ataque, as
// balas e a caixa andam a 50%) e ACELERADO (150%), e o CORAÇÃO continua no
// ritmo normal o tempo todo: no lento dá para costurar entre as balas, no
// rápido é segurar a onda. (Fica mais justo que acelerar tudo junto: o
// controle do jogador nunca muda.)
// Como: passo() devolve o relógio da pista vezes o fator e o coração é
// compensado com pista.fatorCoracao = base / fator (o terminar() devolve a
// base). Antes de cada virada, 1 s de aviso: o tique-taque dispara, o
// ponteiro corre e o nome do próximo modo pisca embaixo do relógio. A música
// acompanha um pouco (mais lenta / mais rápida) e volta no fim.
// Visual: o relógio com pêndulo (balança no ritmo do ataque), um brilho na
// cor do modo (azul lento, laranja rápido) e, dentro de cada caixa, um
// mostrador fantasma com o ponteiro girando no tempo daquela caixa.

const MODOS = {
  normal: { fator: 1, cor: 0xf0c050, texto: 'NORMAL', musica: 1 },
  lento: { fator: 0.5, cor: 0x5ab4ff, texto: 'LENTO', musica: 0.8 },
  rapido: { fator: 1.5, cor: 0xff7a3a, texto: 'RÁPIDO', musica: 1.2 },
}
const DURACAO = { normal: 1300, lento: 2700, rapido: 2000 } // ms (tempo real) em cada modo
const AVISO_MS = 1000
const RAMPA_MS = 200 // a troca de ritmo não é seca (sem tranco)
const TIQUE_MS = 520 // intervalo do tique-taque no ritmo normal
const RELOGIO = { x: 320, y: 176, r: 30 }
const PENDULO = { comprimento: 46, amplitude: 0.38, periodoMs: 1300 }

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  let modo = 'normal'
  let proximoModo = 'lento'
  let mudaEm = 0
  let fator = 1
  let tempoAtaque = 0 // relógio do ataque (anda no fator): ponteiros e pêndulo
  let proximoTique = 0
  let tique = false
  let avisado = false
  let base = [1, 1] // fatorCoracao de cada pista antes do evento
  let baseMusica = 1
  let g = null // o relógio (fora das caixas)
  let brilho = null
  let rotulo = null
  let mostradores = [] // Graphics dentro de cada caixa
  let anel = null

  const mudar = () => {
    modo = proximoModo
    proximoModo = modo === 'lento' ? 'rapido' : 'lento'
    mudaEm = t + DURACAO[modo]
    avisado = false
    tocar(arena, modo === 'lento' ? 'tempoLento' : 'tempoRapido')
    shake(arena, 160, 0.004)
    velocidadeMusica(baseMusica * MODOS[modo].musica)
    // anel de choque saindo do relógio
    anel?.destroy()
    const a = arena.add.circle(RELOGIO.x, RELOGIO.y, RELOGIO.r).setStrokeStyle(3, MODOS[modo].cor, 1).setDepth(14)
    anel = a
    ignorarNasCaixas(arena, a)
    arena.tweens.add({
      targets: a,
      scale: 3.2,
      alpha: 0,
      duration: 520,
      ease: 'Quad.easeOut',
      onComplete: () => {
        a.destroy()
        if (anel === a) anel = null
      },
    })
  }

  const desenharRelogio = () => {
    const { x, y, r } = RELOGIO
    const cor = MODOS[modo].cor
    g.clear()
    // corrente até a viga
    for (let cy = 106; cy < y - r - 2; cy += 6) {
      g.fillStyle(0x8a6420, 1).fillRect(x - 2, cy, 4, 3)
      g.fillStyle(0xc8962e, 1).fillRect(x - 1, cy, 2, 2)
    }
    // pêndulo (atrás do mostrador), no ritmo do ataque
    const a = Math.sin((tempoAtaque / PENDULO.periodoMs) * Math.PI * 2) * PENDULO.amplitude
    const px = x + Math.sin(a) * PENDULO.comprimento
    const py = y + r * 0.4 + Math.cos(a) * PENDULO.comprimento
    g.lineStyle(3, 0x8a6420, 1).lineBetween(x, y, px, py)
    g.fillStyle(0x3a2a18, 1).fillCircle(px, py, 8)
    g.fillStyle(0xc8962e, 1).fillCircle(px, py, 7)
    g.fillStyle(0xffe49a, 1).fillCircle(px - 2, py - 2, 2)
    // caixa do relógio: aro de ouro, aro escuro, mostrador de pergaminho
    g.fillStyle(0x2a1c10, 1).fillCircle(x, y, r + 3)
    g.fillStyle(0xc8962e, 1).fillCircle(x, y, r + 1)
    g.fillStyle(0xf0c050, 1).fillCircle(x - 1, y - 1, r - 1)
    g.fillStyle(0x3a2a18, 1).fillCircle(x, y, r - 3)
    g.fillStyle(0xeedcb0, 1).fillCircle(x, y, r - 5)
    g.fillStyle(cor, 0.22).fillCircle(x, y, r - 5)
    // enfeite em cima (sol) e marcas das horas
    g.fillStyle(0xc8962e, 1).fillTriangle(x - 7, y - r, x + 7, y - r, x, y - r - 9)
    g.fillStyle(0xffe49a, 1).fillCircle(x, y - r - 3, 2)
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2
      const grande = k % 3 === 0
      const d = r - (grande ? 10 : 9)
      g.fillStyle(0x3a2a18, 1).fillRect(Math.round(x + Math.sin(ang) * d) - (grande ? 2 : 1), Math.round(y - Math.cos(ang) * d) - (grande ? 2 : 1), grande ? 4 : 2, grande ? 4 : 2)
    }
    // ponteiros: o grande dá uma volta a cada 3 s do ataque
    const minuto = (tempoAtaque / 3000) * Math.PI * 2
    const hora = minuto / 12 + 1
    g.lineStyle(3, 0x2a1a10, 1).lineBetween(x, y, x + Math.sin(hora) * (r - 16), y - Math.cos(hora) * (r - 16))
    g.lineStyle(2, 0x2a1a10, 1).lineBetween(x, y, x + Math.sin(minuto) * (r - 9), y - Math.cos(minuto) * (r - 9))
    g.fillStyle(0xc8962e, 1).fillCircle(x, y, 3)
    // brilho na cor do modo (pulsa mais forte no aviso)
    const aviso = t >= mudaEm - AVISO_MS
    brilho.setFillStyle(aviso && Math.sin(t / 70) > 0 ? MODOS[proximoModo].cor : cor, aviso ? 0.3 : 0.16)
  }

  const desenharMostrador = (gm, pista) => {
    const l = pista.caixa.limites
    const cor = MODOS[modo].cor
    const r = Math.min(l.width, l.height) * 0.4
    const x = l.centerX
    const y = l.centerY
    gm.clear()
    gm.fillStyle(cor, modo === 'normal' ? 0.02 : 0.07).fillRect(l.left, l.top, l.width, l.height)
    gm.lineStyle(2, cor, 0.16).strokeCircle(x, y, r)
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2
      gm.fillStyle(cor, 0.22).fillRect(Math.round(x + Math.sin(ang) * (r - 8)) - 2, Math.round(y - Math.cos(ang) * (r - 8)) - 2, 4, 4)
    }
    const minuto = (tempoAtaque / 3000) * Math.PI * 2
    gm.lineStyle(3, cor, 0.18).lineBetween(x, y, x + Math.sin(minuto) * (r - 14), y - Math.cos(minuto) * (r - 14))
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      modo = 'normal'
      proximoModo = sorte() < 0.5 ? 'lento' : 'rapido'
      mudaEm = DURACAO.normal
      fator = 1
      base = arena.pistas.map((p) => p.fatorCoracao ?? 1)
      baseMusica = parteDoFator(arena.aceleracao ?? 1, ACELERACAO.musica)
      brilho = arena.add.circle(RELOGIO.x, RELOGIO.y, RELOGIO.r + 12, MODOS.normal.cor, 0.16).setDepth(14)
      g = arena.add.graphics().setDepth(15)
      rotulo = arena.add
        .text(RELOGIO.x, RELOGIO.y + RELOGIO.r + PENDULO.comprimento + 22, '', { fontFamily: FONTE, fontSize: '13px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 })
        .setOrigin(0.5)
        .setDepth(15)
      ignorarNasCaixas(arena, brilho, g, rotulo)
      mostradores = arena.pistas.map((pista) => {
        const gm = arena.add.graphics().setDepth(2)
        pista.caixa.recortar(gm)
        return gm
      })
    },

    // o ataque anda no fator; o coração é compensado para andar normal
    passo(j, delta) {
      if (!ativo) return delta
      const pista = arena.pistas[j]
      if (pista) pista.fatorCoracao = base[j] / fator
      return delta * fator
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      if (!avisado && t >= mudaEm - AVISO_MS) {
        avisado = true
        tocar(arena, proximoModo === 'lento' ? 'taque' : 'tique')
      }
      if (t >= mudaEm) mudar()
      fator += (MODOS[modo].fator - fator) * Math.min(1, delta / RAMPA_MS)
      tempoAtaque += delta * fator
      // tique-taque no ritmo do ataque (dispara no aviso)
      const aviso = t >= mudaEm - AVISO_MS
      if (t >= proximoTique) {
        proximoTique = t + (TIQUE_MS / fator) * (aviso ? 0.4 : 1)
        tique = !tique
        tocar(arena, tique ? 'tique' : 'taque')
      }
      desenharRelogio()
      arena.pistas.forEach((pista, j) => desenharMostrador(mostradores[j], pista))
      if (aviso) {
        const m = MODOS[proximoModo]
        rotulo.setText(Math.sin(t / 90) > 0 ? `${m.texto}!` : '').setColor(`#${m.cor.toString(16).padStart(6, '0')}`)
      } else {
        const m = MODOS[modo]
        rotulo.setText(modo === 'normal' ? '' : m.texto).setColor(`#${m.cor.toString(16).padStart(6, '0')}`)
      }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      arena.pistas.forEach((p, j) => (p.fatorCoracao = base[j]))
      velocidadeMusica(baseMusica)
      for (const o of [g, brilho, rotulo, anel, ...mostradores]) {
        if (!o) continue
        arena.tweens.killTweensOf(o)
        o.destroy()
      }
      g = brilho = rotulo = anel = null
      mostradores = []
    },

    estadoDebug() {
      return { modo, proximo: proximoModo, fator: +fator.toFixed(2), coracao: arena.pistas.map((p) => +p.fatorCoracao.toFixed(2)), mudaEm: Math.round(mudaEm - t) }
    },
  }
}
