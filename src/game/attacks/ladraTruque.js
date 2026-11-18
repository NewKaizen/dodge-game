import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// TRUQUE DAS TRÊS CARTAS da Ladra (boss semanal). Ela abre as cartas no alto da caixa, uma em cima de cada
// coluna: a DAMA ♥ (a coluna segura) e as outras com uma BOMBA desenhada. Vira tudo para baixo e embaralha
// (as cartas trocam de lugar em arcos, cada vez mais rápido). Quando param, as colunas das bombas acendem em
// vermelho e chove naipe nelas: quem seguiu a dama com os olhos já está na coluna certa; quem perdeu ainda tem
// o aviso das colunas para correr.
//
// Justiça: a coluna segura tem a largura da caixa / `cartas` (84 px com 4, 112 com 3, muito mais que
// LACUNA_MINIMA); as colunas das bombas acendem `aviso` ms (mín. 600) antes da chuva (zona area para a CPU); a
// chuva entra pela borda de cima (a entrada é o aviso). Um truque por vez.
//
//   intervalo   ms entre os truques (um só por vez) · cartas  3 ou 4 (uma é a dama)
//   trocas      quantas trocas · troca  ms de cada troca (acelera 10% a cada uma)
//   chuva       ms da chuva · gota  ms entre as gotas de cada coluna · velocidade  px/s
export default definirAtaque({
  nome: 'ladraTruque',
  padrao: { duracao: 7000, intervalo: 2000, cartas: 3, mostra: 750, trocas: 4, troca: 430, aviso: 650, chuva: 1500, gota: 170, velocidade: 210, raio: 6 },
  iniciar(a, cfg) {
    const n = Math.max(3, Math.min(4, cfg.cartas))
    const aviso = Math.max(600, cfg.aviso)
    a.lacuna(a.caixa.width / n - cfg.raio * 2, 'a coluna da dama')
    const NAIPES = ['espadas', 'copas', 'ouros', 'paus']

    const truque = () => {
      const l = a.caixa
      const coluna = l.width / n
      const xDe = (c) => l.left + (c + 0.5) * coluna
      const y0 = l.top + 20
      // onde cada carta está (pos[carta] = coluna) e qual é a dama
      const pos = Array.from({ length: n }, (_, k) => k)
      const dama = a.inteiro(0, n - 1)
      // as trocas sorteadas agora (iguais em todos os PCs)
      const trocas = []
      for (let k = 0; k < cfg.trocas; k++) {
        const i = a.inteiro(0, n - 1)
        const j = (i + a.inteiro(1, n - 1)) % n
        trocas.push([i, j])
      }
      const duracoes = trocas.map((_, k) => Math.max(160, cfg.troca * 0.9 ** k))
      const tEmbaralha = duracoes.reduce((s, d) => s + d, 0)
      const tRevela = cfg.mostra + 200 + tEmbaralha
      const tChuva = tRevela + aviso
      const g = a.decoracao(a.cena.add.graphics().setDepth(7))
      const desenho = Array.from({ length: n }, (_, k) => ({ x: xDe(k), y: y0 }))
      let t = 0
      tocar(a.cena, 'cartaVirar')
      a.aoAtualizar((dt) => {
        if (!g.scene) return
        t += dt
        g.clear()
        if (t > tChuva + cfg.chuva) return
        // onde cada carta está agora (as trocas em arco)
        let acc = cfg.mostra + 200
        const final = [...pos]
        const animando = new Set()
        for (let k = 0; k < trocas.length; k++) {
          const [ci, cj] = trocas[k]
          const ki = final.indexOf(ci)
          const kj = final.indexOf(cj)
          if (t < acc) break
          const p = Math.min(1, (t - acc) / duracoes[k])
          if (p < 1) {
            const xi = xDe(ci)
            const xj = xDe(cj)
            desenho[ki] = { x: xi + (xj - xi) * p, y: y0 - Math.sin(p * Math.PI) * 12 }
            desenho[kj] = { x: xj + (xi - xj) * p, y: y0 + Math.sin(p * Math.PI) * 12 }
            animando.add(ki).add(kj)
          }
          final[ki] = cj
          final[kj] = ci
          acc += duracoes[k]
        }
        for (let k = 0; k < n; k++) if (!animando.has(k)) desenho[k] = { x: xDe(final[k]), y: y0 }
        const aberta = t < cfg.mostra || t >= tRevela
        // as colunas das bombas acendem
        if (t >= tRevela && t < tChuva + cfg.chuva) {
          const p = Math.min(1, (t - tRevela) / aviso)
          for (let k = 0; k < n; k++) {
            if (k === dama) continue
            const cx = xDe(final[k])
            g.fillStyle(0xff4a3a, t < tChuva ? 0.08 + 0.17 * p : 0.12).fillRect(cx - coluna / 2 + 2, l.top, coluna - 4, l.height)
          }
          g.lineStyle(2, 0x7dff9a, 0.6).strokeRect(xDe(final[dama]) - coluna / 2 + 3, l.top + 1, coluna - 6, l.height - 2)
        }
        // as cartas
        for (let k = 0; k < n; k++) {
          const { x, y } = desenho[k]
          g.fillStyle(0x000000, 0.45).fillRoundedRect(x - 9, y - 12, 20, 28, 3)
          if (!aberta) {
            g.fillStyle(0x3a1608, 1).fillRoundedRect(x - 10, y - 14, 20, 28, 3)
            g.lineStyle(2, 0xff9a3d, 1).strokeRoundedRect(x - 10, y - 14, 20, 28, 3)
            g.lineStyle(1, 0xffb060, 0.7).strokeRect(x - 6, y - 10, 12, 20)
            continue
          }
          g.fillStyle(0xfbf6ea, 1).fillRoundedRect(x - 10, y - 14, 20, 28, 3)
          if (k === dama) {
            g.lineStyle(2, 0x7dff9a, 1).strokeRoundedRect(x - 10, y - 14, 20, 28, 3)
            // a dama: a coroa e o coração
            g.fillStyle(0xffc83a, 1).fillTriangle(x - 6, y - 6, x - 3, y - 11, x, y - 6).fillTriangle(x, y - 6, x + 3, y - 11, x + 6, y - 6)
            g.fillStyle(0xc8283a, 1).fillCircle(x - 3, y + 2, 3.2).fillCircle(x + 3, y + 2, 3.2).fillTriangle(x - 6, y + 3, x + 6, y + 3, x, y + 10)
          } else {
            g.lineStyle(2, 0xc8283a, 1).strokeRoundedRect(x - 10, y - 14, 20, 28, 3)
            // a bomba com o pavio aceso
            g.fillStyle(0x1a1a2e, 1).fillCircle(x, y + 2, 6)
            g.lineStyle(1.5, 0x8a6a40, 1).lineBetween(x + 3, y - 3, x + 6, y - 8)
            g.fillStyle(0xffb040, 1).fillCircle(x + 6, y - 9, 2 + Math.sin(t / 60))
          }
        }
      })
      a.depois(cfg.mostra, () => tocar(a.cena, 'cartaDeslizar'))
      let acc = cfg.mostra + 200
      for (const d of duracoes) {
        a.depois(acc, () => tocar(a.cena, 'mover'))
        acc += d
      }
      // a chuva nas colunas das bombas (as posições finais já se sabem agora)
      const final = [...pos]
      for (const [ci, cj] of trocas) {
        const ki = final.indexOf(ci)
        const kj = final.indexOf(cj)
        final[ki] = cj
        final[kj] = ci
      }
      const bombas = final.filter((_, k) => k !== dama)
      a.depois(tRevela, () => {
        tocar(a.cena, 'cartaRevelar')
        for (const c of bombas) a.zonaPerigo({ tipo: 'area', x: xDe(c) - coluna / 2, y: l.top, largura: coluna, altura: l.height }, { ms: aviso, dura: cfg.chuva + 400 })
      })
      a.depois(tChuva, () => {
        tocar(a.cena, 'explosao')
        a.tremer(120, 0.008)
        let i = 0
        a.aCada(
          cfg.gota,
          () => {
            const lc = a.caixa
            for (const c of bombas) {
              const x = lc.left + (c + a.aleatorio(0.15, 0.85)) * (lc.width / n)
              a.bala({ x, y: lc.top - 10, vy: cfg.velocidade, raio: cfg.raio, forma: NAIPES[i++ % 4], entrando: true, girar: 3 })
            }
          },
          Math.max(1, Math.round(cfg.chuva / cfg.gota)),
          0,
        )
      })
      return tChuva + cfg.chuva + 300
    }

    let livre = -Infinity
    a.aCadaEvento(
      cfg.intervalo,
      () => {
        if (a.tempo < livre) return
        livre = a.tempo + truque()
      },
      Infinity,
      150,
    )
  },
})
