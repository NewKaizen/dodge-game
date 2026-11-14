import { tocar } from '../../../../audio.js'
import { fatores } from '../../../../acessibilidade.js'
import { registrarZona } from '../../../../attacks/zonas.js'
import { ignorarNasCaixas } from '../../../../recorte.js'
import { TRATOR, escolherAlvoDoRaio, raioDoArremesso, arremesso, sentidoDoArremesso } from './planos.js'
import { criarCofre, avisoDoEvento, ouvirBotao, criarCanal, ehBot, ehEspelho, pistaViva, texto, dono } from './util.js'

// RAIO TRATOR (ESTAÇÃO ESPACIAL): A perto de uma bala (até TRATOR.alcance) liga o raio trator: a bala é AGARRADA,
// fica inofensiva e passa a girar em volta do seu coração. A de novo LANÇA a bala na caixa do OPONENTE: ela
// aparece avisando (pisca e um "!" na borda virada para você, pelo menos TRATOR.avisoMs) na altura em que ele está
// e atravessa a caixa em linha reta: dá para desviar. Não pegou nada ao apertar A? O raio só falha (sem castigo).
// Segurar demais (TRATOR.segurarMaxMs) lança sozinho. Recarga curta depois de cada lançamento.
// (O jogo só recebe o APERTO do botão, não o "segurar e soltar": por isso A pega e A de novo lança.)
// ONLINE: quem lança cria a bala na caixa espelho do outro e manda uma mensagem (canal 'estTrator') com a altura,
// o tamanho e o sentido; o outro PC cria a MESMA bala na caixa dele, onde ela machuca de verdade (só o dono do
// coração decide o dano). A CPU também agarra e lança (depois de um tempo, com a bala mais perto).
// terminar() solta tudo (as balas seguradas somem) e desliga o canal.

const CIANO = 0x7fe8ff
const BRANCO = 0xe8fbff

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  const cofre = criarCofre(arena)
  const canal = criarCanal(arena, 'estTrator')
  let ativo = false
  let t = 0
  let desligarBotao = () => {}
  let telaG = null // por cima de tudo (fora das caixas): o cometa do lançamento
  let cometas = [] // { x1, y1, x2, y2, t0, dura }
  // por pista: { pista, g, seg, segDesde, recarga, rotulo, cpuProx, cpuEspera, trajetos }
  let lados = []

  const pistaAlvoDe = (k) => arena.pistaDe?.(1 - dono(arena, k)) ?? 1 - k

  // ---------- o arremesso (nos dois PCs) ----------

  // cria a bala lançada na caixa kd (msg = o que o lançador mandou)
  const criarArremessada = (kd, msg) => {
    const s = lados[kd]
    if (!s || !ativo) return null
    const pista = s.pista
    if (!pista.atacando || pista.ataque?.desarmado) return null
    if (pista.balas.lista.filter((b) => b.marcaTrator && !b.morta).length >= TRATOR.emVooMax) return null
    const l = pista.caixa.limites
    const a = arremesso(l, msg.sentido, l.top + msg.fy * l.height, msg.raio)
    const bala = pista.balas.criar({ x: a.x, y: a.y, vx: a.vx, vy: a.vy, raio: a.raio, aviso: a.aviso, dano: a.dano, cor: CIANO, pulso: 0.12, origem: 'bonus-trator' })
    bala.marcaTrator = true
    const x2 = msg.sentido > 0 ? l.right + 20 : l.left - 20
    registrarZona(pista.balas, { tipo: 'linha', x1: a.x, y1: a.y, x2, y2: a.y, espessura: a.raio * 2 }, { ms: a.aviso, dura: (Math.abs(x2 - a.x) / TRATOR.velocidade) * 1000 })
    s.trajetos.push({ bala, x1: a.x, y1: a.y, x2, y2: a.y, t0: t })
    return a
  }

  const lancar = (k) => {
    const s = lados[k]
    const b = s?.seg
    if (!b) return
    const c = s.pista.coracoes[0]
    const raio = raioDoArremesso(b)
    s.seg = null
    s.recarga = TRATOR.recargaMs
    b.morta = true
    b.segurada = false
    const kd = pistaAlvoDe(k)
    const alvo = lados[kd]
    const lAlvo = alvo?.pista.caixa.limites
    const ca = alvo?.pista.coracoes[0]
    const fy = lAlvo ? ((ca?.ativo ? ca.y : lAlvo.centerY) - lAlvo.top) / lAlvo.height : 0.5
    const msg = { kd, fy: Math.min(1, Math.max(0, fy)), raio, sentido: sentidoDoArremesso(k) }
    const a = criarArremessada(kd, msg)
    if (a && c) cometas.push({ x1: b.x, y1: b.y, x2: a.x, y2: a.y, t0: t, dura: TRATOR.avisoMs * 0.7 })
    tocar(arena, 'laser')
    canal.enviar(msg)
  }

  const agarrar = (k, b) => {
    const s = lados[k]
    b.segurada = true
    b.inofensiva = true // não machuca enquanto está no raio
    b.atualizar = undefined
    b.arranque = null
    b.vx = b.vy = b.ax = b.ay = 0
    b.vida = Infinity
    b.quicar = 0
    b.fase0 = Math.atan2(b.y - s.pista.coracoes[0].y, b.x - s.pista.coracoes[0].x)
    s.seg = b
    s.segDesde = t
    if (!ehBot(arena, k)) tocar(arena, 'confirmar')
    s.cpuEspera = TRATOR.cpuEsperaMs.min + sorte() * (TRATOR.cpuEsperaMs.max - TRATOR.cpuEsperaMs.min)
  }

  const apertou = (lado, botao) => {
    if (botao !== 'A') return
    const k = arena.pistaDe?.(lado) ?? lado
    const s = lados[k]
    if (!s || !pistaViva(arena, k)) return
    const c = s.pista.coracoes[0]
    if (!c?.ativo) return
    if (s.seg) return lancar(k)
    if (s.recarga > 0) return
    const b = escolherAlvoDoRaio(s.pista.balas.lista, c.x, c.y)
    if (b) agarrar(k, b)
    else {
      s.recarga = 260
      s.falhou = t
      tocar(arena, 'erro')
    }
  }

  // ---------- visual ----------

  const desenhar = (s, k) => {
    const c = s.pista.coracoes[0]
    const g = s.g
    g.clear()
    if (!c?.ativo) return
    const l = s.pista.caixa.limites
    if (s.seg) {
      const b = s.seg
      const resta = TRATOR.segurarMaxMs - (t - s.segDesde)
      const pisca = resta < 900 && Math.sin(t / 55) > 0
      const cor = pisca ? 0xffffff : CIANO
      // o raio: linha que pulsa ligando o coração à bala, com pontinhos correndo
      g.lineStyle(5, cor, 0.16).lineBetween(c.x, c.y, b.x, b.y)
      g.lineStyle(1.6, cor, 0.8).lineBetween(c.x, c.y, b.x, b.y)
      for (let n = 0; n < 4; n++) {
        const f = ((t / 380 + n / 4) % 1)
        g.fillStyle(BRANCO, 0.9 * (1 - f)).fillCircle(c.x + (b.x - c.x) * f, c.y + (b.y - c.y) * f, 1.8)
      }
      g.lineStyle(2, cor, 0.95).strokeCircle(b.x, b.y, (b.raio ?? 6) + 4 + Math.sin(t / 90))
      // mira do lançamento: até onde ela vai (altura em que o oponente está)
      const kd = pistaAlvoDe(k)
      const alvo = lados[kd]
      const ca = alvo?.pista.coracoes[0]
      if (alvo) {
        const sentido = sentidoDoArremesso(k)
        const xs = sentido > 0 ? l.right : l.left
        const la = alvo.pista.caixa.limites
        const ys = ca?.ativo ? ca.y : la.centerY
        g.lineStyle(1.4, cor, 0.5)
        const x0 = b.x
        const y0 = b.y
        const x1 = xs
        const y1 = ys + (l.top - la.top) // a mesma altura, vista da minha caixa
        for (let n = 0; n < 8; n++) {
          const f0 = n / 8
          const f1 = f0 + 0.045
          g.lineBetween(x0 + (x1 - x0) * f0, y0 + (y1 - y0) * f0, x0 + (x1 - x0) * f1, y0 + (y1 - y0) * f1)
        }
      }
    } else {
      // sem nada na mão: marca a bala mais perto ao alcance (e o círculo do raio, bem fraco)
      const pronto = s.recarga <= 0
      g.lineStyle(1, CIANO, pronto ? 0.18 : 0.06).strokeCircle(c.x, c.y, TRATOR.alcance)
      const alvo = pronto ? escolherAlvoDoRaio(s.pista.balas.lista, c.x, c.y) : null
      if (alvo) {
        const r = (alvo.tipo === 'circulo' ? alvo.raio : Math.max(alvo.largura, alvo.altura) / 2) + 5
        const e = Math.sin(t / 110) * 1.5
        g.lineStyle(2, BRANCO, 0.95)
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const px = alvo.x + sx * (r + e)
          const py = alvo.y + sy * (r + e)
          g.lineBetween(px, py, px - sx * 4, py)
          g.lineBetween(px, py, px, py - sy * 4)
        }
        g.lineStyle(1, CIANO, 0.5).lineBetween(c.x, c.y, alvo.x, alvo.y)
      }
      if (s.falhou && t - s.falhou < 260) {
        g.lineStyle(2, 0xff7a7a, 0.7 * (1 - (t - s.falhou) / 260)).strokeCircle(c.x, c.y, TRATOR.alcance * (0.5 + (t - s.falhou) / 520))
      }
    }
    // o trajeto das bolas lançadas na minha caixa enquanto avisam
    for (const tr of s.trajetos) {
      if (tr.bala.morta || t - tr.t0 > TRATOR.avisoMs + 80) continue
      const pulso = 0.5 + 0.5 * Math.sin(t / 60)
      g.lineStyle(tr.bala.raio * 2, CIANO, 0.05 + 0.1 * pulso).lineBetween(tr.x1, tr.y1, tr.x2, tr.y2)
      g.lineStyle(2, CIANO, 0.5 + 0.4 * pulso)
      for (let x = Math.min(tr.x1, tr.x2) + ((t * 0.12) % 16); x < Math.max(tr.x1, tr.x2); x += 16) g.lineBetween(x, tr.y1, x + 7, tr.y1)
    }
    s.rotulo.setText(s.seg ? 'A: LANÇAR!' : s.recarga > 0 ? 'RECARREGANDO' : 'A: AGARRAR').setColor(s.seg ? '#ffffff' : '#9eeaff')
    s.rotulo.setPosition(l.centerX, l.bottom + 12)
  }

  const desenharCometas = () => {
    if (!telaG) return
    telaG.clear()
    cometas = cometas.filter((m) => t - m.t0 < m.dura + 200)
    for (const m of cometas) {
      const f = Math.min(1, (t - m.t0) / m.dura)
      const e = 1 - (1 - f) ** 2
      const x = m.x1 + (m.x2 - m.x1) * e
      const y = m.y1 + (m.y2 - m.y1) * e
      const n = fatores().rastros ? 7 : 2
      for (let i = n; i >= 1; i--) {
        const ee = Math.max(0, e - i * 0.05)
        telaG.fillStyle(CIANO, 0.5 * (1 - i / (n + 1))).fillCircle(m.x1 + (m.x2 - m.x1) * ee, m.y1 + (m.y2 - m.y1) * ee, 4 - i * 0.3)
      }
      if (f < 1) telaG.fillStyle(0xffffff, 1).fillCircle(x, y, 5)
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      lados = arena.pistas.map((pista) => {
        const g = cofre.guardar(arena.add.graphics().setDepth(8.5))
        pista.caixa.recortar(g)
        const l = pista.caixa.limites
        const rotulo = cofre.guardar(texto(arena, l.centerX, l.bottom + 12, 'A: AGARRAR', { tamanho: 10, cor: '#9eeaff' }))
        return { pista, g, seg: null, segDesde: 0, recarga: 0, rotulo, cpuProx: 600 + sorte() * 700, cpuEspera: 800, trajetos: [], falhou: 0 }
      })
      telaG = cofre.guardar(arena.add.graphics().setDepth(90))
      ignorarNasCaixas(arena, telaG)
      desligarBotao = ouvirBotao(arena, apertou)
      canal.ouvir((msg) => criarArremessada(msg.kd, msg))
      tocar(arena, 'ampulheta')
      avisoDoEvento(arena, cofre, 'A AGARRA E LANÇA NO OPONENTE!', { cor: '#9eeaff' })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((s, k) => {
        s.recarga = Math.max(0, s.recarga - delta)
        s.trajetos = s.trajetos.filter((tr) => !tr.bala.morta && t - tr.t0 < TRATOR.avisoMs + 100)
        const c = s.pista.coracoes[0]
        const valendo = pistaViva(arena, k)
        // a bala segurada gira em volta do coração (e é solta se a caixa acabar, o coração cair ou o tempo passar)
        if (s.seg) {
          const b = s.seg
          if (b.morta || !valendo || !c?.ativo) {
            b.morta = true
            s.seg = null
          } else {
            const a = b.fase0 + (t - s.segDesde) / 230
            const k2 = Math.min(1, delta / 80)
            b.x += (c.x + Math.cos(a) * TRATOR.orbita - b.x) * k2
            b.y += (c.y + Math.sin(a) * TRATOR.orbita - b.y) * k2
            b.sprite.setPosition(b.x, b.y).setAlpha(0.95)
            if (t - s.segDesde >= TRATOR.segurarMaxMs) lancar(k)
          }
        }
        // a CPU: agarra a bala mais perto de vez em quando e lança depois de um tempo
        if (valendo && c?.ativo && ehBot(arena, k) && !ehEspelho(arena, k)) {
          if (s.seg) {
            if (t - s.segDesde >= s.cpuEspera) lancar(k)
          } else if (t >= s.cpuProx && s.recarga <= 0) {
            s.cpuProx = t + 700 + sorte() * 900
            const b = escolherAlvoDoRaio(s.pista.balas.lista, c.x, c.y)
            if (b) agarrar(k, b)
          }
        }
        desenhar(s, k)
      })
      desenharCometas()
    },

    estadoDebug() {
      return { segurando: lados.map((s) => Boolean(s.seg)), recarga: lados.map((s) => Math.round(s.recarga)), arremessadas: lados.map((s) => s.pista.balas.lista.filter((b) => b.marcaTrator && !b.morta).length) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      desligarBotao()
      canal.fechar()
      for (const s of lados) {
        if (s.seg) s.seg.morta = true
        for (const b of s.pista.balas.lista) b.segurada = false
      }
      cofre.limpar()
      telaG = null
      cometas = []
      lados = []
    },
  }
}
