import { tocar } from '../../../../audio.js'
import { SURF, planejarSurf, cristaY, alturaDaBanda, naCrista, novoSurf, passoSurf, alertaSurf, limitar } from './planos.js'
import { contexto, instrucao, ferir, rngsPorCaixa, pisca } from './util.js'
import { etiqueta } from '../arteColiseu.js'

// SURF (PRAIA): a caixa vira mar e ROLA (a água corre para o lado). Só a CRISTA da onda (uma faixa
// clara com espuma que sobe e desce devagar) segura quem surfa: fora dela o contador de CAINDO
// enche (aviso a partir de 0,45 s: a faixa e a caixa ficam vermelhas, com a barra de queda). Em
// 1,7 s fora é o CAIDÃO (dano pequeno) e dá 1,3 s para subir de novo. A crista nunca anda mais
// que metade da velocidade do coração; o contorno tracejado mostra onde ela estará daqui a 0,6 s.
// A CPU é puxada de volta para a faixa quando chega perto da borda dela.

const PASSO_X = 6
const ANTEVISAO_MS = 600

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const ctx = contexto(arena)
  let ativo = false
  let t = 0
  // por caixa: { pista, g, plano, est, aviso, splash }
  let lados = []

  const faixa = (l, v, x, tempo) => cristaY(v.plano, l, x, tempo)

  const desenhar = (v, j) => {
    const l = v.pista.caixa.limites
    const g = v.g
    const h = alturaDaBanda(l)
    const alerta = alertaSurf(v.est)
    g.clear()
    // mar de fundo: azul fundo com listras que correm para a esquerda (a caixa "rola")
    g.fillStyle(0x0f5e9a, 0.34).fillRect(l.left, l.top, l.width, l.height)
    for (let k = 0; k < 7; k++) {
      const y = l.top + 12 + k * ((l.height - 20) / 6)
      const desloc = ((t * (0.05 + (k % 3) * 0.02) + k * 53) % (l.width + 40)) - 20
      g.lineStyle(1, 0xbfe8ff, 0.2 + 0.12 * (k % 2)).lineBetween(l.right - desloc, y, Math.max(l.left, l.right - desloc - 26 - (k % 3) * 8), y)
    }
    // a crista: faixa clara entre a borda de cima e a de baixo
    const topo = []
    const baixo = []
    for (let x = l.left; x <= l.right + 0.1; x += PASSO_X) {
      const cy = faixa(l, v, x, t)
      topo.push({ x, y: cy - h / 2 })
      baixo.push({ x, y: cy + h / 2 })
    }
    const corBanda = alerta ? 0xff7a6a : 0x6ae8ff
    g.fillStyle(corBanda, alerta ? 0.34 : 0.4).fillPoints([...topo, ...[...baixo].reverse()], true)
    // espuma na borda de cima (contas brancas que correm) e linha do meio
    g.lineStyle(3, 0xffffff, 0.85).strokePoints(topo)
    g.lineStyle(1, alerta ? 0xffc8c0 : 0xdffaff, 0.7).strokePoints(baixo)
    for (let k = 0; k < 9; k++) {
      const x = l.left + ((k * 29 + t * 0.06) % l.width)
      const cy = faixa(l, v, x, t)
      g.fillStyle(0xffffff, 0.8).fillCircle(x, cy - h / 2 + 1, 1.6 + (k % 2))
    }
    // onde ela estará daqui a pouco (tracejado)
    const prox = []
    for (let x = l.left; x <= l.right + 0.1; x += PASSO_X * 2) prox.push(faixa(l, v, x, t + ANTEVISAO_MS))
    for (let i = 0; i + 1 < prox.length; i += 2) {
      const x = l.left + i * PASSO_X * 2
      g.lineStyle(1, 0xffffff, 0.45).lineBetween(x, prox[i] - h / 2, x + PASSO_X * 2, prox[i + 1] - h / 2)
      g.lineStyle(1, 0xffffff, 0.45).lineBetween(x, prox[i] + h / 2, x + PASSO_X * 2, prox[i + 1] + h / 2)
    }
    // prancha embaixo do coração (por baixo dele)
    const c = ctx.coracao(j)
    if (c) {
      const dentro = naCrista(c.y, faixa(l, v, c.x, t), l)
      g.fillStyle(0x000000, 0.25).fillEllipse(c.x + 1, c.y + 9, 30, 8)
      g.fillStyle(dentro ? 0xffd070 : 0xb09068, 1).fillEllipse(c.x, c.y + 7, 28, 8)
      g.lineStyle(1, 0x7a4a18, 1).strokeEllipse(c.x, c.y + 7, 28, 8)
      g.fillStyle(dentro ? 0xff5a4a : 0x886a50, 1).fillRect(c.x - 9, c.y + 6, 18, 2)
    }
    // barra de queda
    if (alerta || v.est.foraMs > 0) {
      const k = limitar(v.est.foraMs / SURF.limiteMs, 0, 1)
      const bx = l.left + 8
      const by = l.bottom - 10
      g.fillStyle(0x000000, 0.6).fillRect(bx - 1, by - 1, l.width - 14, 7)
      g.fillStyle(alerta ? (pisca(t, 55) ? 0xff3a2a : 0xffb0a0) : 0xffc060, 1).fillRect(bx, by, (l.width - 16) * k, 5)
    }
    v.aviso.setVisible(alerta).setPosition((l.left + l.right) / 2, l.top + 14)
    if (alerta) v.aviso.setAlpha(pisca(t, 70) ? 1 : 0.55)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      instrucao(arena, ctx, 'FIQUE NA CRISTA DA ONDA!', '#8aecff')
      tocar(arena, 'onda')
      const rngs = rngsPorCaixa(sorte, arena.pistas.length)
      lados = arena.pistas.map((pista, j) => ({
        pista,
        g: ctx.grafico(pista, 3),
        plano: planejarSurf(rngs[j]),
        est: novoSurf(),
        aviso: ctx.guardar(etiqueta(arena, 0, 0, 'CAINDO!', { cor: '#ff8070', tamanho: 11, pista }).setVisible(false)),
      }))
    },

    // CPU: perto da borda da faixa, volta para o meio dela (olhando um pouco à frente)
    joy(j, joy) {
      if (!ativo || !ctx.ehCpu(j)) return joy
      const v = lados[j]
      const c = ctx.coracao(j)
      if (!v || !c) return joy
      const l = v.pista.caixa.limites
      const h = alturaDaBanda(l)
      const alvo = faixa(l, v, c.x, t + 250)
      const desvio = alvo - c.y
      if (Math.abs(desvio) < h / 2 - 12) return joy
      return { x: joy.x * 0.6, y: limitar(desvio * 8, -100, 100) }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((v, j) => {
        const c = ctx.coracao(j)
        const pista = ctx.pistaViva(j)
        if (c && pista) {
          const l = v.pista.caixa.limites
          const dentro = naCrista(c.y, faixa(l, v, c.x, t), l, SURF, 2)
          const antes = alertaSurf(v.est)
          if (passoSurf(v.est, dentro, delta) === 'caiu') {
            tocar(arena, 'tchibum')
            if (!ferir(arena, ctx, j, SURF.dano, { som: 'tchibum', cor: 0x9ae8ff })) v.est.imuneMs = SURF.recuperaMs
          } else if (!antes && alertaSurf(v.est)) tocar(arena, 'bolha')
        }
        desenhar(v, j)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), lados: lados.map((v) => ({ foraMs: Math.round(v.est.foraMs), imuneMs: Math.round(v.est.imuneMs) })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      lados = []
      ctx.limpar()
    },
  }
}
