import { registrarZona } from '../../../../attacks/zonas.js'
import { shake } from '../../../../effects/shake.js'
import { particulas } from '../../../../effects/particulas.js'
import { planoTetris, aplicarEvento, inserirPeca, removerLinhas, TETRIS, fatorDoPlano, empurrarParaFora, coracaoBate, NOMES_PECAS } from './planos.js'
import { avisoNasCaixas, coracaoDe, ehCpu, ehEspelho, pistaViva, tocar } from './util.js'

// TETRIS DE PRÉDIOS (CIDADE GRANDE): peças de 4 blocos (prédios!) caem na caixa e EMPILHAM, encolhendo o espaço
// livre. Cada peça avisa pela SOMBRA da coluna e pelo contorno de onde vai pousar (TETRIS.avisoMs antes);
// caindo ela machuca (uma bala retangular por bloco); pousada, vira bloco SÓLIDO: o coração não atravessa
// (anda em volta e é empurrado para fora se uma peça pousa nele). Linha cheia pisca e some (as de cima
// descem). O plano (planos.js) garante em toda peça: o espaço livre é UM pedaço só (ninguém fica preso),
// tem no mínimo metade da grade, e a pilha passa de 5 linhas nunca; sem jogada possível, o prédio é DEMOLIDO.
// O plano é o mesmo nas duas caixas (semente da rodada). A CPU desliza pelas paredes dos blocos.

const DANO = 6
const MEIO_CORACAO = 6.5 // meia largura usada para bater nos blocos (o coração desenhado tem ~8)
const PALETA = [0x8d97ab, 0xb9645a, 0x4f9aa8, 0xc9a45a, 0x6d7fa8, 0xa8a08c, 0x8a68a8] // concreto, tijolo, vidro, ocre, ardósia, areia, roxo
const COR_PECA = Object.fromEntries(NOMES_PECAS.map((n, i) => [n, PALETA[i % PALETA.length]]))
const claro = (cor, k) => {
  const r = Math.min(255, ((cor >> 16) & 255) + k)
  const g = Math.min(255, ((cor >> 8) & 255) + k)
  const b = Math.min(255, (cor & 255) + k)
  return (r << 16) | (g << 8) | b
}
const escuro = (cor, k) => claro(cor, -k)
const luzDaJanela = (c, r, sal) => ((c * 73856093) ^ (r * 19349663) ^ (sal * 83492791)) % 5 < 3

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const fator = fatorDoPlano(aceleracao)
  let ativo = false
  let t = 0
  let plano = null
  let grade = null // a grade lógica (a mesma nas duas caixas)
  let marcas = null // por célula: índice da cor (a peça que a trouxe)
  let proximo = 0 // próximo evento do plano a começar
  let vivos = [] // eventos em andamento: { ev, fase, balas: [] , t... }
  let limpando = null // { rs, ate }
  let descida = null // { em, mapa } animação das linhas que descem
  let visuais = [] // por pista: { pista, fixo, din, sujo }
  let avisos = []
  let sal = 0

  // ---------- grade <-> pixels ----------
  const celula = (l) => ({ cw: l.width / TETRIS.colunas, ch: l.height / TETRIS.linhas })

  // ---------- eventos do plano ----------
  const comecarEvento = (ev) => {
    const vivo = { ev, fase: 'aviso', balas: [], criadas: false }
    vivos.push(vivo)
    tocar(arena, 'aviso')
    if (ev.tipo === 'peca') {
      arena.pistas.forEach((pista, j) => {
        if (!pistaViva(arena, j)) return
        const l = pista.caixa.limites
        const { cw, ch } = celula(l)
        // a CPU enxerga a coluna inteira por onde a peça passa (do alto até o fundo da peça no pouso)
        const colunas = new Map()
        for (const [dx, dy] of ev.celulas) colunas.set(ev.col + dx, Math.max(colunas.get(ev.col + dx) ?? -1, ev.linha + dy))
        for (const [c, r] of colunas) registrarZona(pista.balas, { tipo: 'area', x: l.left + c * cw, y: l.top, largura: cw, altura: (r + 1) * ch }, { ms: ev.avisoMs, dura: ev.quedaMs + 80 })
      })
    }
  }

  const soltarPeca = (vivo) => {
    vivo.criadas = true
    const ev = vivo.ev
    arena.pistas.forEach((pista, j) => {
      if (!pistaViva(arena, j)) return
      const l = pista.caixa.limites
      const { cw, ch } = celula(l)
      const alt = Math.max(...ev.celulas.map(([, dy]) => dy)) + 1
      const velocidade = TETRIS.linhasPorS * ch
      for (const [dx, dy] of ev.celulas) {
        // posição (centro) do bloco no pouso e no começo (a peça inteira acima da caixa)
        const alvoY = l.top + (ev.linha + dy + 0.5) * ch
        const iniY = alvoY - (ev.linha + alt) * ch
        const x = l.left + (ev.col + dx + 0.5) * cw
        const bala = pista.balas.criar({
          x,
          y: iniY,
          vy: velocidade,
          largura: cw * 0.86,
          altura: ch * 0.86,
          jaAvisada: true,
          atravessa: true,
          dano: DANO,
          origem: 'cid-tetris',
          atualizar: (b) => {
            if (!pista.atacando || pista.ataque?.desarmado) b.inofensiva = true
            // a posição vem do relógio do evento (a peça cai certinha até o pouso, mesmo com a velocidade da pista mexida)
            const k = Math.min(1, Math.max(0, (t - (ev.em + ev.avisoMs)) / ev.quedaMs))
            b.y = iniY + (alvoY - iniY) * k
          },
        })
        bala.sprite.setVisible(false)
        vivo.balas.push({ bala, pista, dx, dy })
      }
    })
  }

  const pousar = (vivo) => {
    const ev = vivo.ev
    for (const b of vivo.balas) b.bala.morta = true
    vivo.balas = []
    grade = inserirPeca(grade, ev.celulas, ev.col, ev.linha)
    for (const [dx, dy] of ev.celulas) marcas[ev.linha + dy][ev.col + dx] = COR_PECA[ev.forma]
    tocar(arena, 'cravar')
    shake(arena, 90, 0.0025)
    arena.pistas.forEach((pista, j) => {
      if (!pistaViva(arena, j)) return
      const l = pista.caixa.limites
      const { cw, ch } = celula(l)
      for (const [dx, dy] of ev.celulas) if (dy === Math.max(...ev.celulas.filter(([x]) => x === dx).map(([, y]) => y))) particulas(arena, l.left + (ev.col + dx + 0.5) * cw, l.top + (ev.linha + dy + 1) * ch, { cor: 0xc8c8d8, quantidade: 3, velocidade: 70, vida: 320 })
    })
    if (ev.cheias.length) {
      limpando = { rs: ev.cheias, ate: t + TETRIS.limpaMs }
      tocar(arena, 'tpMax')
    }
    for (const v of visuais) v.sujo = true
    vivo.fase = ev.cheias.length ? 'limpando' : 'fim'
  }

  const terminarLimpeza = () => {
    const rs = limpando.rs
    // quem (linha antiga) vira quem (linha nova), para animar as de cima descendo
    const mantidas = grade.map((_, r) => r).filter((r) => !rs.includes(r))
    const mapa = {} // linha nova -> quantas linhas ela desceu
    mantidas.forEach((antiga, k) => (mapa[k + rs.length] = k + rs.length - antiga))
    grade = removerLinhas(grade, rs)
    marcas = removerLinhas(marcas, rs)
    descida = { em: t, mapa }
    limpando = null
    for (const v of visuais) v.sujo = true
  }

  const demolirAgora = (vivo) => {
    grade = aplicarEvento(grade, vivo.ev)
    marcas = removerLinhas(marcas, Array.from({ length: vivo.ev.linhas }, (_, k) => TETRIS.linhas - 1 - k))
    tocar(arena, 'estouro')
    shake(arena, 160, 0.004)
    descida = { em: t, mapa: Object.fromEntries(Array.from({ length: TETRIS.linhas }, (_, r) => [r, vivo.ev.linhas])) }
    for (const v of visuais) v.sujo = true
    vivo.fase = 'fim'
  }

  // ---------- desenho ----------
  const bloco = (g, x, y, w, h, cor, c, r) => {
    g.fillStyle(escuro(cor, 60), 1).fillRect(x, y, w, h)
    g.fillStyle(cor, 1).fillRect(x + 1, y + 1, w - 2, h - 2)
    g.fillStyle(claro(cor, 38), 1).fillRect(x + 1, y + 1, w - 2, 3) // telhado
    // janelas: 2 x 2, umas acesas
    const jw = Math.max(2, (w - 6) / 2 - 1)
    const jh = Math.max(2, (h - 9) / 2 - 1)
    for (let a = 0; a < 2; a++) {
      for (let b = 0; b < 2; b++) {
        g.fillStyle(luzDaJanela(c * 2 + a, r * 2 + b, sal) ? 0xffe9a0 : escuro(cor, 80), 1).fillRect(x + 3 + a * (jw + 2), y + 6 + b * (jh + 1), jw, jh)
      }
    }
  }

  const desenharFixo = (v) => {
    const l = v.pista.caixa.limites
    const { cw, ch } = celula(l)
    const g = v.fixo
    g.clear()
    const anim = descida ? Math.min(1, (t - descida.em) / 180) : 1
    for (let r = 0; r < TETRIS.linhas; r++) {
      const desce = descida && anim < 1 ? (descida.mapa[r] ?? 0) * (1 - anim) : 0
      for (let c = 0; c < TETRIS.colunas; c++) {
        if (!grade[r][c]) continue
        bloco(g, l.left + c * cw + 1, l.top + (r - desce) * ch + 1, cw - 2, ch - 2, marcas[r][c] ?? PALETA[0], c, r)
      }
    }
    if (anim >= 1) descida = null
    v.sujo = Boolean(descida)
  }

  const desenharDin = (v) => {
    const l = v.pista.caixa.limites
    const { cw, ch } = celula(l)
    const g = v.din
    g.clear()
    const pisca = 0.55 + 0.45 * Math.sin(t / 55)
    for (const vivo of vivos) {
      const ev = vivo.ev
      if (ev.tipo === 'peca') {
        if (vivo.fase === 'aviso' || vivo.fase === 'queda') {
          const falta = ev.em + ev.avisoMs - t
          // sombra da(s) coluna(s) por onde a peça passa e contorno de onde ela vai pousar
          const colunas = new Map()
          for (const [dx, dy] of ev.celulas) colunas.set(ev.col + dx, Math.max(colunas.get(ev.col + dx) ?? -1, ev.linha + dy))
          for (const [c, r] of colunas) {
            g.fillStyle(0x000000, 0.2 + 0.12 * pisca).fillRect(l.left + c * cw, l.top, cw, (r + 1) * ch)
            if (falta > 0) {
              g.fillStyle(0xff4030, 0.35 * pisca)
              for (let y = l.top + ((t / 40) % 10); y < l.top + (r + 1) * ch - 8; y += 14) g.fillTriangle(l.left + c * cw + cw / 2, y + 8, l.left + c * cw + cw / 2 - 5, y, l.left + c * cw + cw / 2 + 5, y)
            }
          }
          g.lineStyle(2, 0xff5a3a, 0.5 + 0.5 * pisca)
          for (const [dx, dy] of ev.celulas) g.strokeRect(l.left + (ev.col + dx) * cw + 1.5, l.top + (ev.linha + dy) * ch + 1.5, cw - 3, ch - 3)
        }
        if (vivo.fase === 'queda' && vivo.criadas) {
          const alt = Math.max(...ev.celulas.map(([, dy]) => dy)) + 1
          const k = Math.min(1, Math.max(0, (t - (ev.em + ev.avisoMs)) / ev.quedaMs))
          const deslocamento = (1 - k) * (ev.linha + alt)
          for (const [dx, dy] of ev.celulas) {
            const y = l.top + (ev.linha + dy - deslocamento) * ch
            if (y + ch < l.top) continue
            const topo = Math.max(y, l.top)
            if (topo >= l.bottom) continue
            bloco(g, l.left + (ev.col + dx) * cw + 1, y + 1, cw - 2, ch - 2, COR_PECA[ev.forma], ev.col + dx, ev.linha + dy)
          }
        }
      } else if (ev.tipo === 'demolir') {
        const falta = ev.em + ev.avisoMs - t
        if (falta > 0) {
          const y0 = l.top + (TETRIS.linhas - ev.linhas) * ch
          g.fillStyle(0xff3020, 0.18 + 0.2 * pisca).fillRect(l.left, y0, l.width, l.bottom - y0)
          for (let x = l.left - 20 + ((t / 30) % 20); x < l.right; x += 20) g.fillStyle(0xffd030, 0.28).fillTriangle(x, l.bottom, x + 10, y0, x + 20, l.bottom)
        }
      }
    }
    if (limpando) {
      const k = Math.sin(((limpando.ate - t) / TETRIS.limpaMs) * Math.PI * 4) > 0
      for (const r of limpando.rs) g.fillStyle(0xffffff, k ? 0.85 : 0.35).fillRect(l.left, l.top + r * ch, l.width, ch)
    }
  }

  const montarVisual = (pista) => {
    const fixo = arena.add.graphics().setDepth(3)
    const din = arena.add.graphics().setDepth(4)
    pista.caixa.recortar(fixo, din)
    return { pista, fixo, din, sujo: true }
  }

  // ---------- coração ----------
  const guiarCpu = (l, c, joy) => {
    if (!joy || (!joy.x && !joy.y)) return joy
    const passo = 7
    const dx = Math.sign(joy.x)
    const dy = Math.sign(joy.y)
    const livre = (x, y) => !coracaoBate(l, grade, x, y, MEIO_CORACAO + 1)
    if (livre(c.x + dx * passo, c.y + dy * passo)) return joy
    if (dx && livre(c.x + dx * passo, c.y)) return { x: joy.x, y: 0 } // desliza na horizontal
    if (dy && livre(c.x, c.y + dy * passo)) return { x: 0, y: joy.y } // desliza na vertical
    // encurralada: sobe (a parte de cima da caixa fica sempre livre)
    return { x: livre(c.x + 7, c.y) ? 60 : -60, y: -100 }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      sal = Math.floor(sorte() * 1000)
      plano = planoTetris(sorte)
      grade = plano.inicial.map((l) => [...l])
      marcas = grade.map((l) => l.map((v) => (v ? PALETA[Math.floor(sorte() * PALETA.length)] : 0)))
      proximo = 0
      vivos = []
      limpando = null
      descida = null
      visuais = arena.pistas.map(montarVisual)
      avisos = avisoNasCaixas(arena, 'PRÉDIOS CAINDO!', { cor: '#ffc83a', ms: 1200, atraso: 100 })
    },

    joy(j, joy) {
      if (!ativo || !joy || !ehCpu(arena, j)) return joy
      const c = coracaoDe(arena, j)
      if (!c?.ativo) return joy
      return guiarCpu(arena.pistas[j].caixa.limites, c, joy)
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta * fator
      // começa os eventos que chegaram na hora
      while (proximo < plano.eventos.length && t >= plano.eventos[proximo].em) comecarEvento(plano.eventos[proximo++])
      for (const vivo of vivos) {
        const ev = vivo.ev
        if (ev.tipo === 'peca') {
          if (vivo.fase === 'aviso' && t >= ev.em + ev.avisoMs) {
            vivo.fase = 'queda'
            soltarPeca(vivo)
          }
          if (vivo.fase === 'queda' && t >= ev.pousoEm) pousar(vivo)
        } else if (vivo.fase === 'aviso' && t >= ev.em + ev.avisoMs) demolirAgora(vivo)
      }
      if (limpando && t >= limpando.ate) terminarLimpeza()
      vivos = vivos.filter((v) => v.fase !== 'fim' && !(v.fase === 'limpando' && !limpando))
      // o coração não atravessa os blocos (e sai de baixo de uma peça que pousou nele)
      arena.pistas.forEach((pista, j) => {
        const c = coracaoDe(arena, j)
        if (!c?.ativo || ehEspelho(arena, j)) return
        const r = empurrarParaFora(pista.caixa.limites, grade, c.x, c.y, MEIO_CORACAO)
        if (Math.abs(r.x - c.x) > 0.01 || Math.abs(r.y - c.y) > 0.01) {
          c.x = r.x
          c.y = r.y
          c.posicionar()
        }
      })
      for (const v of visuais) {
        if (v.pista.destruida) continue
        if (v.sujo || descida) desenharFixo(v)
        desenharDin(v)
      }
    },

    estadoDebug() {
      return { t: Math.round(t), proximo, grade: grade?.map((l) => l.join('')), vivos: vivos.map((v) => `${v.ev.tipo}:${v.ev.forma ?? ''}:${v.fase}`), limpando: Boolean(limpando) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const vivo of vivos) for (const b of vivo.balas) b.bala.morta = true
      vivos = []
      for (const v of visuais) {
        v.fixo.destroy()
        v.din.destroy()
      }
      visuais = []
      avisos.forEach((a) => a.scene && a.destroy())
      avisos = []
    },
  }
}
