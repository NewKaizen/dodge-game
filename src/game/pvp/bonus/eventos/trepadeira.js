import { FONTE, CORES } from '../../../constants.js'
import { tocar } from '../../../audio.js'

// TREPADEIRA (arena JARDIM): vinhas cheias de espinhos crescem das BORDAS das
// caixas e encolhem a área útil; depois de um tempo recuam e crescem de novo
// em outro lado. Sempre com aviso: a faixa que a vinha vai ocupar pisca
// (vermelho fraquinho, tracejado na linha até onde ela vai chegar) e brotinhos
// aparecem na borda, com o rangido da planta. Só então ela cresce, devagar
// (bem mais devagar que o coração). Encostar na vinha = dano normal de bala
// (a vinha é uma bala retangular invisível, do tamanho do corpo da planta,
// com os i-frames de sempre; a CPU enxerga ela como qualquer bala).
// Uma ou duas bordas por vez (nunca a caixa inteira: sobra pelo menos ~40%
// de cada lado). Os mesmos lados nas duas caixas.

const LADOS = ['cima', 'baixo', 'esq', 'dir']
const FUNDO = { cima: 0.3, baixo: 0.3, esq: 0.27, dir: 0.27 } // quanto a vinha entra (fração da altura/largura)
const AVISO_MS = 1000
const CRESCE_MS = 950
const SEGURA = { min: 2000, max: 2600 }
const RECUA_MS = 750
const PAUSA = { min: 600, max: 1000 }
const PRIMEIRA = 700
const DANO = 4
const FOLGA_COLISAO = 3 // a colisão é um pouquinho menor que o desenho (folhas de fora não machucam)
const CPU_FUGA = 100 // a CPU recebe um empurrão para fora da faixa avisada (ela não "lê" o aviso)
const VERDE = { escuro: 0x1d4a24, corpo: 0x2f7a35, claro: 0x5fb04a, folha: 0x7ad35a, espinho: 0xf0e0b0, flor: 0xff8ad2 }

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  let ativo = false
  let t = 0
  let estado = 'pausa' // pausa | aviso | cresce | segura | recua
  let mudaEm = 0
  let lados = []
  let ultimos = []
  let caixas = [] // por pista: { pista, g, balas: { lado: bala } }
  let textos = []

  // quanto a vinha está dentro agora (0..1 do FUNDO)
  const crescimento = () => {
    const desde = mudaEm
    if (estado === 'cresce') return 1 - (desde - t) / CRESCE_MS
    if (estado === 'segura') return 1
    if (estado === 'recua') return (desde - t) / RECUA_MS
    return 0
  }

  // retângulo da faixa do lado (na profundidade px)
  const faixa = (l, lado, px) => {
    if (lado === 'cima') return { x: l.left, y: l.top, w: l.width, h: px }
    if (lado === 'baixo') return { x: l.left, y: l.bottom - px, w: l.width, h: px }
    if (lado === 'esq') return { x: l.left, y: l.top, w: px, h: l.height }
    return { x: l.right - px, y: l.top, w: px, h: l.height }
  }
  const profundidade = (l, lado) => FUNDO[lado] * (lado === 'cima' || lado === 'baixo' ? l.height : l.width)

  const sortearLados = () => {
    const quantos = sorte() < 0.45 ? 2 : 1
    const opcoes = LADOS.filter((x) => !ultimos.includes(x))
    const escolhidos = []
    while (escolhidos.length < quantos) {
      const lista = escolhidos.length ? LADOS.filter((x) => !escolhidos.includes(x)) : opcoes
      escolhidos.push(lista[Math.floor(sorte() * lista.length)])
    }
    lados = escolhidos
    ultimos = escolhidos
  }

  const avisar = () => {
    tocar(arena, 'brotar')
    for (const cx of caixas) {
      const l = cx.pista.caixa.limites
      const txt = arena.add
        .text(l.centerX, l.centerY, 'TREPADEIRA!', { fontFamily: FONTE, fontSize: '13px', color: '#9ae07a', stroke: '#000000', strokeThickness: 4 })
        .setOrigin(0.5)
        .setDepth(14)
      cx.pista.caixa.recortar(txt)
      textos.push(txt)
      arena.tweens.add({ targets: txt, scale: { from: 1.5, to: 1 }, duration: 200, ease: 'Back.easeOut' })
      arena.tweens.add({ targets: txt, alpha: 0, delay: AVISO_MS - 200, duration: 300, onComplete: () => txt.destroy() })
    }
  }

  // ---------- balas (a parte que machuca) ----------

  const atualizarBalas = (cx) => {
    const { pista } = cx
    const l = pista.caixa.limites
    const k = crescimento()
    for (const lado of LADOS) {
      const ligado = lados.includes(lado) && k > 0 && pista.rodando
      let b = cx.balas[lado]
      if (b && !pista.balas.lista.includes(b)) b = cx.balas[lado] = null
      const px = profundidade(l, lado) * k - FOLGA_COLISAO
      if (!ligado || px <= 1) {
        if (b) b.inofensiva = true
        continue
      }
      const f = faixa(l, lado, px)
      if (!b) {
        b = cx.balas[lado] = pista.balas.criar({ x: f.x + f.w / 2, y: f.y + f.h / 2, largura: f.w, altura: f.h, textura: 'jardim-vazio', dano: DANO, atravessa: true, jaAvisada: true, origem: 'bonus-trepadeira' })
      }
      b.x = f.x + f.w / 2
      b.y = f.y + f.h / 2
      b.largura = f.w
      b.altura = f.h
      b.inofensiva = Boolean(pista.ataque?.desarmado)
      b.sprite.setPosition(b.x, b.y)
    }
  }

  // ---------- desenho ----------

  // a vinha de um lado: corpo, borda ondulada, caules, folhas, espinhos virados para dentro e florzinhas
  const desenharVinha = (g, l, lado, px) => {
    if (px < 1) return
    const f = faixa(l, lado, px)
    const horizontal = lado === 'cima' || lado === 'baixo'
    const comp = horizontal ? f.w : f.h
    // ponto ao longo da borda (u em px) e profundidade (v em px a partir da borda da caixa)
    const ponto = (u, v) => {
      if (lado === 'cima') return { x: l.left + u, y: l.top + v }
      if (lado === 'baixo') return { x: l.left + u, y: l.bottom - v }
      if (lado === 'esq') return { x: l.left + v, y: l.top + u }
      return { x: l.right - v, y: l.top + u }
    }
    const s = t / 1000
    const onda = (u) => Math.sin(u * 0.12 + s * 1.5) * 2.5
    g.fillStyle(VERDE.escuro, 0.96).fillRect(f.x, f.y, f.w, f.h)
    // borda de dentro ondulada (bolinhas de folhagem)
    for (let u = 0; u <= comp; u += 9) {
      const p = ponto(u, px - 1 + onda(u))
      g.fillStyle(VERDE.corpo, 1).fillCircle(p.x, p.y, 5)
    }
    // caules sinuosos correndo ao longo da faixa
    for (const [frac, cor, esp] of [[0.35, VERDE.corpo, 3], [0.7, VERDE.claro, 2]]) {
      g.lineStyle(esp, cor, 1)
      g.beginPath()
      for (let u = 0; u <= comp; u += 6) {
        const p = ponto(u, Math.max(2, px * frac + Math.sin(u * 0.08 + frac * 5 + s) * Math.min(6, px * 0.2)))
        if (u === 0) g.moveTo(p.x, p.y)
        else g.lineTo(p.x, p.y)
      }
      g.strokePath()
    }
    // folhas
    for (let u = 6; u < comp; u += 17) {
      const v = Math.min(px - 4, px * (0.3 + ((u * 7) % 10) / 20))
      if (v < 3) continue
      const p = ponto(u + Math.sin(s * 2 + u) * 1.5, v)
      g.fillStyle(((u / 17) | 0) % 2 ? VERDE.folha : VERDE.claro, 1)
      g.fillEllipse(p.x, p.y, horizontal ? 8 : 5, horizontal ? 5 : 8)
    }
    // espinhos na borda de dentro (o perigo aparece)
    g.fillStyle(VERDE.espinho, 1)
    for (let u = 4; u < comp; u += 13) {
      const base1 = ponto(u - 2.5, px + onda(u) + 1)
      const base2 = ponto(u + 2.5, px + onda(u) + 1)
      const ponta = ponto(u, px + onda(u) + 6)
      g.fillTriangle(base1.x, base1.y, base2.x, base2.y, ponta.x, ponta.y)
    }
    // florzinhas
    if (px > 18) {
      for (let u = 20; u < comp; u += 47) {
        const p = ponto(u, px * 0.5)
        g.fillStyle(VERDE.flor, 1).fillCircle(p.x, p.y, 2.5)
        g.fillStyle(0xfff0a0, 1).fillCircle(p.x, p.y, 1)
      }
    }
  }

  const desenharAviso = (g, l, lado) => {
    const px = profundidade(l, lado)
    const f = faixa(l, lado, px)
    const pisca = Math.sin(t / 70) > 0 ? 1 : 0.4
    g.fillStyle(CORES.aviso, 0.16 * pisca).fillRect(f.x, f.y, f.w, f.h)
    // tracejado até onde a vinha vai chegar
    g.lineStyle(2, CORES.aviso, 0.8 * pisca)
    const horizontal = lado === 'cima' || lado === 'baixo'
    const comp = horizontal ? l.width : l.height
    for (let u = 0; u < comp; u += 12) {
      if (lado === 'cima') g.lineBetween(l.left + u, f.y + f.h, l.left + u + 6, f.y + f.h)
      else if (lado === 'baixo') g.lineBetween(l.left + u, f.y, l.left + u + 6, f.y)
      else if (lado === 'esq') g.lineBetween(f.x + f.w, l.top + u, f.x + f.w, l.top + u + 6)
      else g.lineBetween(f.x, l.top + u, f.x, l.top + u + 6)
    }
    // brotinhos saindo da borda
    const k = Math.min(1, (t - (mudaEm - AVISO_MS)) / AVISO_MS)
    g.fillStyle(VERDE.claro, 1)
    for (let u = 8; u < comp; u += 22) {
      const alto = 3 + k * 6
      if (lado === 'cima') g.fillTriangle(l.left + u - 3, l.top, l.left + u + 3, l.top, l.left + u, l.top + alto)
      else if (lado === 'baixo') g.fillTriangle(l.left + u - 3, l.bottom, l.left + u + 3, l.bottom, l.left + u, l.bottom - alto)
      else if (lado === 'esq') g.fillTriangle(l.left, l.top + u - 3, l.left, l.top + u + 3, l.left + alto, l.top + u)
      else g.fillTriangle(l.right, l.top + u - 3, l.right, l.top + u + 3, l.right - alto, l.top + u)
    }
  }

  const desenhar = (cx) => {
    const l = cx.pista.caixa.limites
    cx.g.clear()
    const k = crescimento()
    for (const lado of lados) {
      if (estado === 'aviso') desenharAviso(cx.g, l, lado)
      else desenharVinha(cx.g, l, lado, profundidade(l, lado) * k)
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      estado = 'pausa'
      mudaEm = PRIMEIRA
      lados = []
      ultimos = []
      caixas = arena.pistas.map((pista) => {
        const g = arena.add.graphics().setDepth(4) // por baixo das balas (5) e do coração
        pista.caixa.recortar(g)
        return { pista, g, balas: {} }
      })
    },

    // a CPU não lê o aviso: empurrão para fora da faixa que vai fechar
    joy(j, joy) {
      if (!ativo || (estado !== 'aviso' && estado !== 'cresce') || arena.ko?.[j]) return joy
      if ((arena.donoDaPista?.(j) ?? j) !== arena.cpu) return joy
      const pista = arena.pistas[j]
      const c = pista.coracoes[0]
      if (!c?.ativo) return joy
      const l = pista.caixa.limites
      let { x, y } = joy
      for (const lado of lados) {
        const px = profundidade(l, lado) + 14
        if (lado === 'cima' && c.y < l.top + px) y += CPU_FUGA
        if (lado === 'baixo' && c.y > l.bottom - px) y -= CPU_FUGA
        if (lado === 'esq' && c.x < l.left + px) x += CPU_FUGA
        if (lado === 'dir' && c.x > l.right - px) x -= CPU_FUGA
      }
      return { x: Math.max(-100, Math.min(100, x)), y: Math.max(-100, Math.min(100, y)) }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      if (t >= mudaEm) {
        if (estado === 'pausa') {
          sortearLados()
          estado = 'aviso'
          mudaEm = t + AVISO_MS
          avisar()
        } else if (estado === 'aviso') {
          estado = 'cresce'
          mudaEm = t + CRESCE_MS
        } else if (estado === 'cresce') {
          estado = 'segura'
          mudaEm = t + entre(SEGURA.min, SEGURA.max)
        } else if (estado === 'segura') {
          estado = 'recua'
          mudaEm = t + RECUA_MS
          tocar(arena, 'recuar')
        } else {
          estado = 'pausa'
          mudaEm = t + entre(PAUSA.min, PAUSA.max)
          lados = []
        }
      }
      for (const cx of caixas) {
        atualizarBalas(cx)
        desenhar(cx)
      }
    },

    estadoDebug() {
      return { estado, lados, crescimento: Number(crescimento().toFixed(2)), balas: caixas.map((cx) => Object.entries(cx.balas).filter(([, b]) => b && !b.inofensiva).map(([lado]) => lado)) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const cx of caixas) {
        cx.g.destroy()
        for (const b of Object.values(cx.balas)) if (b) b.morta = true
      }
      caixas = []
      lados = []
      textos.forEach((x) => {
        arena.tweens.killTweensOf(x)
        if (x.scene) x.destroy()
      })
      textos = []
    },
  }
}
