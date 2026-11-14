import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { registrarZona } from '../../../attacks/zonas.js'
import { texturaVeiculo } from './arteArenasNovas.js'
import { planoTransito, travessiaDoVeiculo, VEICULOS, TRANSITO, FAIXAS_TRANSITO, REF_CAIXA } from './planosArenas.js'

// TRÂNSITO (CIDADE GRANDE): a caixa vira uma avenida de 3 faixas (asfalto, tracejado entre
// as faixas). O SEMÁFORO no canto manda: vermelho = parado; AMARELO piscando = AVISO
// (a faixa por onde vem veículo fica vermelha, os faróis acendem na borda de entrada e
// buzina); VERDE = os veículos disparam. Carro, ônibus (longo e lento) e moto (rápida);
// no máximo duas das três faixas por onda. Cada veículo é uma bala retangular normal (dano,
// graze, i-frames; a CPU enxerga a faixa pela zona avisada). O plano (planosArenas.js) é o
// mesmo nas duas caixas.

const DANO = 5
const COR_AVISO = 0xff4030

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  let plano = []
  let proxima = 0
  let veiculos = [] // { pista, j, faixa, dir, tipo, bala, sprite, em, y }
  let avisos = [] // { j, faixa, dir, em, fim } (a faixa vermelha e os faróis)
  let gs = []
  let variante = 0

  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !p.ataque.desarmado && !arena.ko?.[arena.donoDaPista?.(j) ?? j] ? p : null
  }
  const alturaFaixa = (l) => l.height / FAIXAS_TRANSITO
  const centroFaixa = (l, f) => l.top + alturaFaixa(l) * (f + 0.5)

  const largar = (onda) => {
    tocar(arena, 'ronco')
    const aviso = TRANSITO.avisoMs / aceleracao
    arena.pistas.forEach((pista, j) => {
      if (!pistaViva(j)) return
      const l = pista.caixa.limites
      for (const f of onda.faixas) {
        const v = VEICULOS[f.tipo]
        const y = centroFaixa(l, f.faixa)
        const x0 = f.dir > 0 ? l.left - v.comprimento / 2 - 8 : l.right + v.comprimento / 2 + 8
        const altura = alturaFaixa(l) * v.alturaFrac
        const bala = pista.balas.criar({
          x: x0,
          y,
          vx: f.dir * v.velocidade,
          largura: v.comprimento * 0.92,
          altura,
          aviso,
          atravessa: true,
          dano: DANO,
          origem: 'bonus-transito',
          atualizar: (b) => {
            if (!pista.atacando || pista.ataque?.desarmado) b.inofensiva = true
          },
        })
        bala.sprite.setVisible(false)
        const chave = f.tipo === 'carro' ? texturaVeiculo(arena, 'carro', variante++) : texturaVeiculo(arena, f.tipo)
        const img = arena.add.image(x0, y, chave).setDepth(7).setFlipX(f.dir < 0)
        // o sprite é um pouco maior que a hitbox (rodas, retrovisor): largura = comprimento do veículo
        img.setDisplaySize(v.comprimento * 1.06, (v.comprimento * 1.06 * img.height) / img.width)
        pista.caixa.recortar(img)
        // a CPU lê a faixa inteira
        registrarZona(pista.balas, { tipo: 'area', x: l.left, y: y - altura / 2, largura: l.width, altura }, { ms: aviso, dura: travessiaDoVeiculo(f.tipo, l.width) })
        veiculos.push({ pista, j, faixa: f.faixa, dir: f.dir, tipo: f.tipo, bala, img, em: t + aviso, y })
        avisos.push({ j, faixa: f.faixa, dir: f.dir, em: t + aviso })
      }
    })
    // semáforo: amarelo agora, verde quando os veículos dispararem
    semaforo = { amarelo: t, verde: t + aviso, fim: t + aviso + Math.max(...onda.faixas.map((f) => travessiaDoVeiculo(f.tipo, REF_CAIXA.largura))) }
  }

  let semaforo = null

  const cor = () => {
    if (!semaforo) return 'vermelho'
    if (t < semaforo.verde) return 'amarelo'
    if (t < semaforo.fim) return 'verde'
    return 'vermelho'
  }

  const desenharSemaforo = (g, l) => {
    const c = cor()
    const x = l.right - 13
    const y = l.top + 24
    g.fillStyle(0x15171c, 0.95).fillRoundedRect(x - 8, y - 20, 16, 40, 4)
    g.lineStyle(1, 0x50586a, 1).strokeRoundedRect(x - 8, y - 20, 16, 40, 4)
    const pisca = Math.sin(t / 90) > 0
    const luz = (dy, ligada, cl) => g.fillStyle(ligada ? cl : 0x2a2a30, 1).fillCircle(x, y + dy, 4.5)
    luz(-12, c === 'vermelho', 0xff3a30)
    luz(0, c === 'amarelo' && pisca, 0xffd030)
    luz(12, c === 'verde', 0x40e060)
    if (c === 'amarelo' && pisca) g.fillStyle(0xffd030, 0.18).fillCircle(x, y, 17)
    if (c === 'vermelho') g.fillStyle(0xff3a30, 0.1).fillCircle(x, y - 12, 14)
  }

  const desenhar = () => {
    gs.forEach((g, j) => {
      const pista = arena.pistas[j]
      const l = pista.caixa.limites
      const h = alturaFaixa(l)
      g.clear()
      // asfalto e tracejado entre as faixas
      g.fillStyle(0x1b1e26, 0.55).fillRect(l.left, l.top, l.width, l.height)
      for (let f = 1; f < FAIXAS_TRANSITO; f++) {
        g.fillStyle(0xf0e8c0, 0.38)
        for (let x = l.left + 4; x < l.right; x += 22) g.fillRect(x, l.top + h * f - 1, 11, 2)
      }
      for (const a of avisos) {
        if (a.j !== j) continue
        const falta = a.em - t
        const y0 = l.top + h * a.faixa
        const pulso = 0.5 + 0.5 * Math.sin(t / (falta < 350 ? 40 : 75))
        g.fillStyle(COR_AVISO, 0.1 + 0.16 * pulso).fillRect(l.left, y0, l.width, h)
        // faróis acesos na borda de entrada: dois cones apontando para dentro da caixa
        const bx = a.dir > 0 ? l.left : l.right
        const yc = y0 + h / 2
        g.fillStyle(0xfff0a0, 0.18 + 0.2 * pulso)
        for (const dy of [-5, 5]) g.fillTriangle(bx, yc + dy, bx + a.dir * 70, yc + dy - 11, bx + a.dir * 70, yc + dy + 11)
        g.fillStyle(0xfff6c0, 0.9).fillCircle(bx, yc - 5, 3).fillCircle(bx, yc + 5, 3)
      }
      desenharSemaforo(g, l)
      // faróis andando junto dos veículos
      for (const v of veiculos) {
        if (v.j !== j || t < v.em || v.bala.morta) continue
        const pontaX = v.bala.x + v.dir * VEICULOS[v.tipo].comprimento * 0.5
        g.fillStyle(0xfff0a0, 0.16).fillTriangle(pontaX, v.y, pontaX + v.dir * 38, v.y - 10, pontaX + v.dir * 38, v.y + 10)
      }
    })
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoTransito(sorte, REF_CAIXA)
      proxima = 0
      variante = Math.floor(sorte() * 4)
      semaforo = null
      gs = arena.pistas.map((pista) => {
        const g = arena.add.graphics().setDepth(2)
        pista.caixa.recortar(g)
        return g
      })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      while (proxima < plano.length && t >= plano[proxima].em / aceleracao) largar(plano[proxima++])
      for (const v of veiculos) {
        const l = v.pista.caixa.limites
        const comp = VEICULOS[v.tipo].comprimento
        if (v.bala.morta || (v.dir > 0 ? v.bala.x > l.right + comp : v.bala.x < l.left - comp)) {
          v.feito = true
          continue
        }
        // parado na entrada até o verde; depois corre (o sprite balança de leve)
        const andando = t >= v.em
        v.img.setPosition(Math.round(v.bala.x), Math.round(v.bala.y - (andando ? Math.floor(t / 60) % 2 : 0)))
        if (andando && !v.passou && Math.abs(v.bala.x - l.centerX) < 8) {
          v.passou = true
          if (v.tipo === 'onibus') shake(arena, 100, 0.003)
        }
      }
      for (const v of veiculos.filter((x) => x.feito)) v.img.destroy()
      veiculos = veiculos.filter((v) => !v.feito)
      avisos = avisos.filter((a) => t < a.em + 120)
      desenhar()
    },

    estadoDebug() {
      return { semaforo: cor(), veiculos: veiculos.map((v) => ({ j: v.j, faixa: v.faixa, tipo: v.tipo, x: Math.round(v.bala.x) })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of veiculos) {
        v.bala.morta = true
        v.img.destroy()
      }
      veiculos = []
      avisos = []
      for (const g of gs) g.destroy()
      gs = []
    },
  }
}
