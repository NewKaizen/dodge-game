import { LARGURA } from '../../../../constants.js'
import { tocar } from '../../../../audio.js'
import { ignorarNasCaixas } from '../../../../recorte.js'
import { GATO, planoGato, faseDoGato } from './planos.js'
import { criarVivos, instrucao, texto, calmo } from './comum.js'

// GATO DA SORTE: um maneki-neko acena entre as caixas. Pata ERGUIDA (acenando) = tudo PARA: as
// balas e o ataque congelam no lugar (pista.congelada: o coração continua livre, e as balas
// paradas ainda machucam se encostar). Pata ABAIXADA = tudo VAI: o ataque anda um pouco mais
// rápido (GATO.ritmoVai) para compensar o tempo parado, e o coração anda um pouco mais devagar
// na mesma proporção (o coração percorre o mesmo que sempre em relação às balas).
// Toda troca é AVISADA GATO.avisoMs antes: a pata do gato treme (ou começa a baixar), o sininho
// toca, a borda das caixas pisca. A fase e a duração vêm da semente (igual nas duas caixas).
// terminar() solta a pista (congelada = false) e devolve a velocidade do coração.

const POS = { x: LARGURA / 2, y: 204 }

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  const vivos = criarVivos()
  let ativo = false
  let t = 0
  let plano = []
  let base = []
  let g = null // o gato
  let bordas = null // luz das bordas das caixas
  let tags = []
  let lift = 0 // 0 pata baixa, 1 pata erguida
  let fasePassada = null
  let tiquePassado = -1

  const fase = () => faseDoGato(plano, t)

  // ---------- o gato ----------

  const desenharGato = (f) => {
    const { x, y } = POS
    g.clear()
    const para = f.tipo === 'para'
    const alvoLift = f.aviso ? (para ? 0.55 : 0.5 * (1 - f.restante / GATO.avisoMs) + 0.1) : para ? 1 : 0
    lift += (alvoLift - lift) * 0.22
    const treme = f.aviso && !calmo() ? Math.sin(t / 28) * 0.1 : 0
    const aceno = para && !f.aviso && !calmo() ? Math.sin(t / 95) * 0.32 : 0
    const bob = calmo() ? 0 : Math.sin(t / 430) * 1.2
    // sombra
    g.fillStyle(0x000000, 0.3).fillEllipse(x, y + 62, 86, 13)
    // corpo
    g.fillStyle(0xe8e0d0, 1).fillEllipse(x, y + 24 + bob, 66, 78)
    g.lineStyle(2, 0x6a5a48, 1).strokeEllipse(x, y + 24 + bob, 66, 78)
    g.fillStyle(0xffffff, 1).fillEllipse(x, y + 32 + bob, 36, 44)
    // manchas de gato da sorte
    g.fillStyle(0xe8801c, 0.95).fillEllipse(x - 22, y + 38 + bob, 18, 26)
    g.fillStyle(0x2a2a30, 0.95).fillEllipse(x + 25, y + 18 + bob, 14, 22)
    // pata de moeda (a esquerda do gato = direita da tela): segura um koban dourado
    g.fillStyle(0xe8e0d0, 1).fillCircle(x + 27, y + 38 + bob, 11)
    g.lineStyle(2, 0x6a5a48, 1).strokeCircle(x + 27, y + 38 + bob, 11)
    g.fillStyle(0xf0c040, 1).fillEllipse(x + 27, y + 34 + bob, 20, 27)
    g.lineStyle(2, 0xa87a10, 1).strokeEllipse(x + 27, y + 34 + bob, 20, 27)
    g.lineStyle(2, 0xa87a10, 1).lineBetween(x + 22, y + 28 + bob, x + 32, y + 28 + bob).lineBetween(x + 22, y + 34 + bob, x + 32, y + 34 + bob).lineBetween(x + 22, y + 40 + bob, x + 32, y + 40 + bob)
    // cabeça
    const hy = y - 22 + bob
    g.fillStyle(0xe8e0d0, 1).fillTriangle(x - 34, hy - 8, x - 20, hy - 34, x - 8, hy - 20)
    g.fillTriangle(x + 34, hy - 8, x + 20, hy - 34, x + 8, hy - 20)
    g.fillStyle(0xff8aa0, 1).fillTriangle(x - 28, hy - 12, x - 20, hy - 28, x - 13, hy - 19)
    g.fillTriangle(x + 28, hy - 12, x + 20, hy - 28, x + 13, hy - 19)
    g.lineStyle(2, 0x6a5a48, 1).strokeTriangle(x - 34, hy - 8, x - 20, hy - 34, x - 8, hy - 20).strokeTriangle(x + 34, hy - 8, x + 20, hy - 34, x + 8, hy - 20)
    g.fillStyle(0xf4eee2, 1).fillEllipse(x, hy, 80, 62)
    g.lineStyle(2, 0x6a5a48, 1).strokeEllipse(x, hy, 80, 62)
    g.fillStyle(0xe8801c, 0.9).fillEllipse(x - 22, hy - 14, 24, 18)
    g.fillStyle(0x2a2a30, 0.9).fillEllipse(x + 24, hy - 10, 20, 18)
    // rosto: olhos fechados felizes, nariz, boquinha, bigodes e bochechas
    g.lineStyle(3, 0x201810, 1)
    for (const lado of [-1, 1]) g.beginPath().arc(x + lado * 15, hy - 1, 6, Math.PI * 1.05, Math.PI * 1.95).strokePath()
    g.fillStyle(0xff7a90, 1).fillTriangle(x - 3, hy + 6, x + 3, hy + 6, x, hy + 10)
    g.lineStyle(2, 0x201810, 1).beginPath().arc(x - 4, hy + 11, 4, 0.1, Math.PI * 0.9).strokePath()
    g.beginPath().arc(x + 4, hy + 11, 4, 0.1, Math.PI * 0.9).strokePath()
    g.lineStyle(1.5, 0x201810, 0.8)
    for (const lado of [-1, 1]) for (const dy of [-2, 3]) g.lineBetween(x + lado * 22, hy + 8 + dy * 0.5, x + lado * 38, hy + 6 + dy * 2.2)
    g.fillStyle(0xff8aa0, 0.55).fillCircle(x - 27, hy + 9, 6).fillCircle(x + 27, hy + 9, 6)
    // coleira vermelha e sininho
    g.fillStyle(0xd02020, 1).fillRoundedRect(x - 26, y + 3 + bob, 52, 10, 4)
    g.lineStyle(2, 0xf0c040, 1).strokeRoundedRect(x - 26, y + 3 + bob, 52, 10, 4)
    g.fillStyle(0xf0c040, 1).fillCircle(x, y + 17 + bob, 7)
    g.lineStyle(1.5, 0xa87a10, 1).strokeCircle(x, y + 17 + bob, 7).lineBetween(x - 6, y + 17 + bob, x + 6, y + 17 + bob)
    g.fillStyle(0x201810, 1).fillCircle(x, y + 20 + bob, 1.6)
    // a pata que acena (a direita do gato = esquerda da tela): do ombro até a ponta.
    // lift 0 = pendurada ao lado do corpo; lift 1 = erguida ao lado da orelha, balançando
    const ombro = { x: x - 29, y: y + 14 + bob }
    const tx = ombro.x - 12 - 16 * lift + (aceno + treme) * 22
    const ty = ombro.y + 34 - lift * 92 + Math.abs(aceno) * 4
    const meioX = (ombro.x + tx) / 2 - 7
    const meioY = (ombro.y + ty) / 2
    g.lineStyle(17, 0x6a5a48, 1).lineBetween(ombro.x, ombro.y, meioX, meioY).lineBetween(meioX, meioY, tx, ty)
    g.lineStyle(13, 0xf4eee2, 1).lineBetween(ombro.x, ombro.y, meioX, meioY).lineBetween(meioX, meioY, tx, ty)
    g.fillStyle(0xf4eee2, 1).fillCircle(tx, ty, 12)
    g.lineStyle(2, 0x6a5a48, 1).strokeCircle(tx, ty, 12)
    g.fillStyle(0xff8aa0, 1).fillCircle(tx, ty + 1, 5).fillCircle(tx - 5, ty - 5, 2.2).fillCircle(tx, ty - 7, 2.2).fillCircle(tx + 5, ty - 5, 2.2)
    // linhas de aceno
    if (para && !f.aviso && !calmo()) {
      g.lineStyle(2, 0xffe27a, 0.8)
      const s = Math.sin(t / 95)
      g.beginPath().arc(tx, ty, 20, Math.PI * 0.95 + s * 0.2, Math.PI * 1.25 + s * 0.2).strokePath()
      g.beginPath().arc(tx, ty, 26, Math.PI * 0.95 + s * 0.2, Math.PI * 1.25 + s * 0.2).strokePath()
    }
    // aviso: pontinhos de contagem em cima da cabeça
    if (f.aviso) {
      const falta = Math.ceil((f.restante / GATO.avisoMs) * 3)
      for (let k = 0; k < 3; k++) {
        g.fillStyle(para ? 0x7aff9a : 0xff6a5a, k < falta ? 1 : 0.25).fillCircle(x - 12 + k * 12, hy - 44, 4)
      }
    }
  }

  const desenharBordas = (f) => {
    bordas.clear()
    const verde = f.tipo === 'vai'
    const pisca = f.aviso && !calmo() ? (Math.sin(t / 50) > 0 ? 1 : 0.25) : 1
    const cor = verde ? 0x5aff8a : 0xff4a3a
    arena.pistas.forEach((pista, j) => {
      const l = pista.caixa.limites
      bordas.lineStyle(8, cor, 0.16 * pisca).strokeRect(l.left - 4, l.top - 4, l.width + 8, l.height + 8)
      bordas.lineStyle(2, cor, 0.85 * pisca).strokeRect(l.left - 6, l.top - 6, l.width + 12, l.height + 12)
      const tag = tags[j]
      tag?.setPosition(l.centerX, l.top - 13)
      const proxima = f.aviso ? (verde ? 'PARA' : 'VAI') : null
      const conteudo = f.aviso ? `${proxima} JÁ...` : verde ? 'VAI!' : 'PARA!'
      if (tag && tag.text !== conteudo) tag.setText(conteudo)
      tag?.setColor(verde ? '#8aff9a' : '#ff8a7a').setAlpha(pisca)
    })
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoGato(sorte)
      base = arena.pistas.map((p) => p.fatorCoracao)
      g = vivos.guardar(arena.add.graphics().setDepth(30))
      ignorarNasCaixas(arena, g)
      bordas = vivos.guardar(arena.add.graphics().setDepth(0.6))
      ignorarNasCaixas(arena, bordas)
      tags = arena.pistas.map((p) => {
        const l = p.caixa.limites
        return vivos.guardar(texto(arena, l.centerX, l.top - 13, 'VAI!', { cor: '#8aff9a', tamanho: 10, contorno: 3, profundidade: 96 }))
      })
      instrucao(arena, vivos, 'PATA ERGUIDA: TUDO PARA!', { cor: '#ffe9a0' })
      fasePassada = null
    },

    // o relógio de cada caixa: congela (pata erguida) ou anda um pouco mais rápido (pata baixa)
    passo(j, delta) {
      if (!ativo) return delta
      const f = fase()
      const pista = arena.pistas[j]
      const vai = f.tipo === 'vai'
      pista.congelada = !vai
      pista.fatorCoracao = (base[j] ?? 1) / (vai ? GATO.ritmoVai : 1)
      return vai ? delta * GATO.ritmoVai : delta
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      const f = fase()
      if (fasePassada !== f.tipo) {
        if (fasePassada !== null) tocar(arena, f.tipo === 'para' ? 'taque' : 'tique')
        fasePassada = f.tipo
        tiquePassado = -1
      }
      if (f.aviso) {
        const k = Math.floor((GATO.avisoMs - f.restante) / (GATO.avisoMs / 3))
        if (k !== tiquePassado) {
          tiquePassado = k
          tocar(arena, k === 0 ? 'sino' : 'tique')
        }
      }
      desenharGato(f)
      desenharBordas(f)
    },

    estadoDebug() {
      const f = plano.length ? fase() : null
      return { t: Math.round(t), fase: f?.tipo, restante: f && Math.round(f.restante), aviso: f?.aviso, congeladas: arena.pistas.map((p) => p.congelada), lift: Math.round(lift * 100) / 100 }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      arena.pistas.forEach((p, j) => {
        p.congelada = false
        p.fatorCoracao = base[j] ?? 1
      })
      vivos.limpar(arena)
      g = null
      bordas = null
      tags = []
    },
  }
}
