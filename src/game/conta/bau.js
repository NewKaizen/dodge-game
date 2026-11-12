import { LARGURA, ALTURA } from '../constants.js'
import { tocar } from '../audio.js'
import { menosMovimento } from '../preferencias.js'
import { semLigaduras } from '../campanha/texto.js'
import { previaDe } from '../cosmeticosSlots.js'
import { itemDoCatalogo, NOME_TIPO } from '../../lib/progresso.js'
import { COR_RARIDADE, COR_RARIDADE_NUM, NOME_RARIDADE, nivelDaRaridade, registroDoId, slotDoId } from '../../lib/cosmeticos.js'
import { texto } from './ui.js'

// O BAÚ na tela (docs/baus.md): o desenho do baú, os ícones dos slots novos e a REVELAÇÃO (o baú
// treme enquanto o servidor sorteia, estoura e as recompensas viram uma a uma, na cor da raridade).
// Quem decide o que sai é o servidor; aqui é só a festa. Todo texto passa por semLigaduras.
//
//   desenharBau(g, x, y, escala, { aberto })        o baú (Graphics), centrado em (x, y)
//   iconeDoTipo(g, tipo, x, y, tam, cor)            ícone simples do slot (som, efeito, lançamento, moldura, título)
//   const r = criarRevelacao(cena)                  por cima de tudo (depth 1500)
//   r.comecar() · r.mostrar(resultado) · r.falhar(msg) · r.pronto · r.destruir()
//   resultado: lerAberto() de lib/bausConta.js ({ recompensas, xpGanho, teto, pity, itensNovos, ... })

const MADEIRA = 0x7a4a22
const MADEIRA_ESCURA = 0x4e2c12
const OURO = 0xffd23a

export function desenharBau(g, x, y, escala = 1, { aberto = false } = {}) {
  const w = 96 * escala
  const h = 58 * escala
  const t = 22 * escala // a tampa
  const x0 = x - w / 2
  const y0 = y - h / 2 + t / 2
  // corpo
  g.fillStyle(MADEIRA_ESCURA, 1).fillRect(x0 - 3 * escala, y0 - 3 * escala, w + 6 * escala, h + 6 * escala)
  g.fillStyle(MADEIRA, 1).fillRect(x0, y0, w, h)
  for (let k = 1; k < 4; k++) g.fillStyle(MADEIRA_ESCURA, 0.5).fillRect(x0, y0 + (h * k) / 4, w, 2 * escala)
  g.fillStyle(OURO, 1).fillRect(x0 + 10 * escala, y0, 8 * escala, h).fillRect(x0 + w - 18 * escala, y0, 8 * escala, h)
  // tampa (fechada: em cima do corpo; aberta: inclinada para trás)
  const ty = aberto ? y0 - t - 14 * escala : y0 - t
  g.fillStyle(MADEIRA_ESCURA, 1).fillRect(x0 - 3 * escala, ty - 3 * escala, w + 6 * escala, t + 3 * escala)
  g.fillStyle(aberto ? 0x8a5a2a : MADEIRA, 1).fillRect(x0, ty, w, t)
  g.fillStyle(OURO, 1).fillRect(x0 + 10 * escala, ty, 8 * escala, t).fillRect(x0 + w - 18 * escala, ty, 8 * escala, t)
  if (aberto) g.fillStyle(0xfff2b0, 0.85).fillRect(x0 + 6 * escala, y0 - 4 * escala, w - 12 * escala, 8 * escala)
  else {
    // fechadura
    g.fillStyle(OURO, 1).fillRect(x - 9 * escala, y0 - 7 * escala, 18 * escala, 16 * escala)
    g.fillStyle(0x2a1a08, 1).fillRect(x - 2 * escala, y0 - 2 * escala, 4 * escala, 7 * escala)
  }
}

export function iconeDoTipo(g, tipo, x, y, tam = 24, cor = 0xffffff) {
  const s = tam / 24
  g.fillStyle(cor, 1).lineStyle(2 * s, cor, 1)
  if (tipo === 'som') {
    g.fillRect(x - 10 * s, y - 4 * s, 6 * s, 8 * s).fillTriangle(x - 4 * s, y - 4 * s, x + 4 * s, y - 10 * s, x + 4 * s, y + 10 * s)
    g.fillTriangle(x - 4 * s, y + 4 * s, x + 4 * s, y + 10 * s, x - 4 * s, y - 4 * s)
    g.beginPath().arc(x + 4 * s, y, 7 * s, -0.8, 0.8).strokePath()
    g.beginPath().arc(x + 4 * s, y, 11 * s, -0.8, 0.8).strokePath()
  } else if (tipo === 'efeito') {
    g.strokeRect(x - 7 * s, y - 10 * s, 14 * s, 20 * s)
    for (const [dx, dy] of [[-11, -10], [11, -4], [-10, 9], [10, 11]]) g.fillRect(x + dx * s - 1.5 * s, y + dy * s - 1.5 * s, 3 * s, 3 * s)
  } else if (tipo === 'lancamento') {
    g.strokeRect(x - 11 * s, y - 2 * s, 9 * s, 13 * s)
    g.lineBetween(x - 2 * s, y + 2 * s, x + 10 * s, y - 10 * s)
    g.fillTriangle(x + 12 * s, y - 12 * s, x + 4 * s, y - 10 * s, x + 10 * s, y - 4 * s)
  } else if (tipo === 'moldura') {
    g.strokeRect(x - 10 * s, y - 10 * s, 20 * s, 20 * s)
    g.strokeRect(x - 6 * s, y - 6 * s, 12 * s, 12 * s)
  } else if (tipo === 'xp') {
    g.fillTriangle(x, y - 11 * s, x - 10 * s, y + 7 * s, x + 10 * s, y + 7 * s)
  } else {
    // título: uma faixa
    g.fillRect(x - 11 * s, y - 5 * s, 22 * s, 10 * s)
    g.fillTriangle(x - 11 * s, y - 5 * s, x - 15 * s, y, x - 11 * s, y + 5 * s).fillTriangle(x + 11 * s, y - 5 * s, x + 15 * s, y, x + 11 * s, y + 5 * s)
  }
}

// o que é cada recompensa na tela
function descrever(r) {
  if (r.tipo === 'xp') return { nome: `+${r.xp} XP`, tipo: 'xp', rotulo: 'BÔNUS DE XP', extra: '' }
  const item = itemDoCatalogo(r.id)
  const tipo = slotDoId(r.id) ?? item?.tipo ?? 'titulo'
  return { nome: item?.nome ?? r.id, tipo, rotulo: (NOME_TIPO[item?.tipo] ?? 'cosmético').toUpperCase(), extra: r.tipo === 'duplicado' ? `já tinha: +${r.xp} XP` : 'NOVO!' }
}

const POS_CARTAS = { 1: [0], 2: [-95, 95], 3: [-190, 0, 190] }
const CARTA = { l: 168, a: 186 }

export function criarRevelacao(cena) {
  const cx = LARGURA / 2
  const raiz = cena.add.container(0, 0).setDepth(1500)
  const veu = cena.add.rectangle(LARGURA / 2, ALTURA / 2, LARGURA, ALTURA, 0x05040a, 0.86)
  raiz.add(veu)
  const gBau = cena.add.graphics()
  const bau = cena.add.container(cx, 220, [gBau])
  raiz.add(bau)
  desenharBau(gBau, 0, 0, 1.6)
  const legenda = texto(cena, cx, 330, 'abrindo…', 16, '#ffe9a0').setOrigin(0.5)
  const rodape = texto(cena, cx, ALTURA - 34, '', 13, '#9a9ab0').setOrigin(0.5)
  raiz.add([legenda, rodape])
  const previas = []
  const timers = []
  let tremor = null
  const r = { estado: 'parado', pronto: false }
  const calmo = menosMovimento()
  const depois = (ms, fn) => timers.push(cena.time.delayedCall(ms, () => raiz.scene && fn()))

  r.comecar = () => {
    r.estado = 'esperando'
    tocar(cena, 'confirmar')
    if (!calmo) tremor = cena.tweens.add({ targets: bau, x: { from: cx - 5, to: cx + 5 }, angle: { from: -3, to: 3 }, duration: 60, yoyo: true, repeat: -1 })
    else tremor = cena.tweens.add({ targets: bau, scale: { from: 1, to: 1.04 }, duration: 400, yoyo: true, repeat: -1 })
  }

  const pararTremor = () => {
    tremor?.stop()
    tremor = null
    bau.setPosition(cx, 220).setAngle(0).setScale(1)
  }

  // o estouro: clarão, a tampa abre e voam faíscas na cor da melhor raridade
  function estourar(cor) {
    gBau.clear()
    desenharBau(gBau, 0, 0, 1.6, { aberto: true })
    const flash = cena.add.rectangle(LARGURA / 2, ALTURA / 2, LARGURA, ALTURA, 0xffffff, calmo ? 0.25 : 0.85)
    raiz.add(flash)
    cena.tweens.add({ targets: flash, alpha: 0, duration: 420, onComplete: () => flash.destroy() })
    if (!calmo) cena.cameras.main.shake(180, 0.006)
    const n = calmo ? 8 : 28
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.3
      const d = 120 + Math.random() * 160
      const p = cena.add.rectangle(cx, 205, 6, 6, i % 3 ? cor : 0xffffff)
      raiz.add(p)
      cena.tweens.add({ targets: p, x: cx + Math.cos(a) * d, y: 205 + Math.sin(a) * d, alpha: 0, angle: 180, duration: 700 + Math.random() * 300, ease: 'Cubic.easeOut', onComplete: () => p.destroy() })
    }
    tocar(cena, 'cartaDeslizar')
    cena.tweens.add({ targets: bau, y: 120, scale: 0.6, alpha: 0.35, duration: 420, ease: 'Cubic.easeOut' })
  }

  function cartaDaRecompensa(rec, x, i, atraso) {
    const d = descrever(rec)
    const cor = COR_RARIDADE_NUM[rec.raridade] ?? 0xffffff
    const y = 268
    const c = cena.add.container(x, y)
    const g = cena.add.graphics()
    g.fillStyle(0x0b0914, 0.98).fillRect(-CARTA.l / 2, -CARTA.a / 2, CARTA.l, CARTA.a)
    g.lineStyle(4, cor, 1).strokeRect(-CARTA.l / 2 + 2, -CARTA.a / 2 + 2, CARTA.l - 4, CARTA.a - 4)
    g.fillStyle(cor, 0.16).fillRect(-CARTA.l / 2 + 4, -CARTA.a / 2 + 4, CARTA.l - 8, 26)
    c.add(g)
    c.add(texto(cena, 0, -CARTA.a / 2 + 17, NOME_RARIDADE[rec.raridade] ?? '', 13, COR_RARIDADE[rec.raridade] ?? '#ffffff').setOrigin(0.5))
    const gi = cena.add.graphics()
    c.add(gi)
    const nome = texto(cena, 0, 40, semLigaduras(d.nome), 14, '#ffffff', { align: 'center', wordWrap: { width: CARTA.l - 16 } }).setOrigin(0.5)
    c.add(nome)
    c.add(texto(cena, 0, 66, semLigaduras(d.rotulo), 10, '#9a9ab0').setOrigin(0.5))
    if (d.extra) c.add(texto(cena, 0, 82, semLigaduras(d.extra), 11, rec.tipo === 'duplicado' ? '#ffb040' : '#7fe08a').setOrigin(0.5))
    raiz.add(c)
    c.setScale(0, 1)
    // a prévia do conteúdo (registro) entra quando a carta termina de virar; sem ela, o ícone do slot
    const comPrevia = rec.tipo !== 'xp' && ['som', 'efeito', 'lancamento', 'moldura'].includes(d.tipo) && registroDoId(rec.id)
    cena.tweens.add({
      targets: c,
      scaleX: 1,
      delay: atraso,
      duration: calmo ? 1 : 260,
      ease: 'Back.easeOut',
      onStart: () => tocar(cena, nivelDaRaridade(rec.raridade) >= 2 ? 'confirmar' : 'mover'),
      onComplete: () => {
        if (!raiz.scene) return
        const p = comPrevia ? previaDe(cena, d.tipo, registroDoId(rec.id), x, y - 26, 64) : null
        if (p) {
          previas.push(p)
          if (d.tipo === 'som') p.tocar?.()
        } else iconeDoTipo(gi, d.tipo, 0, -26, 40, cor)
        if (nivelDaRaridade(rec.raridade) >= 2 && !calmo) cena.tweens.add({ targets: c, scale: 1.08, duration: 140, yoyo: true })
        if (i === 0) c.setDepth(1)
      },
    })
  }

  r.mostrar = (res) => {
    if (r.estado !== 'esperando') return
    r.estado = 'revelando'
    pararTremor()
    const recs = res.recompensas ?? []
    const melhor = recs.reduce((m, x) => (nivelDaRaridade(x.raridade) > nivelDaRaridade(m) ? x.raridade : m), 'comum')
    estourar(COR_RARIDADE_NUM[melhor])
    legenda.setText('')
    const xs = POS_CARTAS[Math.min(3, Math.max(1, recs.length))] ?? [0]
    recs.forEach((rec, i) => cartaDaRecompensa(rec, cx + xs[i], i, 420 + i * (calmo ? 120 : 380)))
    const fim = 420 + recs.length * (calmo ? 120 : 380) + 300
    depois(fim, () => {
      const partes = []
      if (res.xpGanho > 0) partes.push(`+${res.xpGanho} XP no total`)
      if (res.teto) partes.push('(o XP de baús de hoje chegou no teto)')
      if (res.nivelDepois != null && res.nivelAntes != null && res.nivelDepois > res.nivelAntes) partes.push(`subiu para o nível ${res.nivelDepois}: +1 baú!`)
      if (res.pity) partes.push('épico garantido!')
      legenda.setPosition(cx, 386).setText(semLigaduras(partes.join('   ')))
      r.pronto = true
      r.estado = 'pronto'
    })
  }

  r.falhar = (msg) => {
    pararTremor()
    r.estado = 'pronto'
    r.pronto = true
    legenda.setText(semLigaduras(msg || 'não deu para abrir o baú')).setColor('#ff7a7a')
  }

  r.rodape = (txt) => rodape.setText(semLigaduras(txt))

  r.destruir = () => {
    pararTremor()
    timers.forEach((t) => t.remove(false))
    previas.forEach((p) => p.destroy())
    raiz.destroy(true)
  }
  return r
}
