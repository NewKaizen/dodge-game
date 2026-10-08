// Mede a dificuldade das cartas dos CHEFES do CO-OP em cada nível (FÁCIL,
// MÉDIO, DIFÍCIL): cada carta roda numa Pista do tamanho da da arena, com o
// ritmo, o teto de velocidade e o dano de verdade daquele nível, e o
// EsquivaBot desvia em dois níveis: 'dificil' (o "jogador perfeito") e
// 'normal' (o "jogador médio"). Guarda os acertos de cada rodada (amostras)
// para a simulação de partidas (simularCoop.mjs).
//
//   npm run dev -- --port 5175 --strictPort
//   node scripts/balanceamento/medirChefes.mjs saida.json [sementes] [chefes] [niveis]
//     chefes: "king,jevil" (padrão: todos); niveis: "facil,medio,dificil"
//     URL_JOGO (padrão http://localhost:5175/) e CHROMIUM (executável) no ambiente
//
// A visão do bot é a mesma do medir.mjs (avisos de área, balas que andam
// sozinhas, lâminas girando).
import { chromium } from 'playwright'
import fs from 'node:fs'

const [saida = 'chefes.json', nSementes = '6', filtroChefes = '', filtroNiveis = 'facil,medio,dificil'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } })
const avisos = []
page.on('console', (m) => {
  if (m.type() === 'warning' || m.type() === 'error') avisos.push(m.text())
})
page.on('pageerror', (e) => avisos.push('PAGEERROR ' + e.message))
await page.goto(process.env.URL_JOGO || 'http://localhost:5175/')
await page.waitForFunction(() => window.debugJogo && window.debugJogo.cena().length > 0 && !window.debugJogo.cena().includes('Boot'), null, { timeout: 60000 })
await page.waitForTimeout(1500)

const resultado = await page.evaluate(
  async ({ nSementes, filtroChefes, filtroNiveis }) => {
    const { default: Pista } = await import('/src/game/pvp/Pista.js')
    const { EsquivaBot } = await import('/src/game/pvp/botEsquiva.js')
    const { ehSuper } = await import('/src/game/pvp/cartas.js')
    const { CHEFES, nivelDoChefe } = await import('/src/game/coop/chefes/index.js')
    const { CARTAS_CHEFES, ataqueDaCartaChefe, danoDaCartaChefe, ritmoDaCartaChefe, inverteControles } = await import('/src/game/coop/cartasChefe.js')
    const { DESAFIO, DIFICULDADES } = await import('/src/game/constants.js')
    const { ataques } = await import('/src/game/attacks/index.js')
    const { default: Ctx } = await import('/src/game/attacks/contexto.js')
    // o bot enxerga os avisos de área (a.aviso) como balas que ainda vão valer
    const fantasmas = []
    const VE_AVISOS = true
    const VE_MOVIMENTO = true
    const anteriores = new WeakMap()
    const avisoOriginal = Ctx.prototype.aviso
    Ctx.prototype.aviso = function (forma, depois) {
      const ms = forma.ms ?? 400
      let f = null
      if (forma.tipo === 'area') f = { tipo: 'retangulo', x: forma.x + forma.largura / 2, y: forma.y + forma.altura / 2, largura: forma.largura, altura: forma.altura }
      else if (forma.tipo === 'circulo') f = { tipo: 'circulo', x: forma.x, y: forma.y, raio: forma.raio }
      else if (forma.tipo === 'linha') {
        const dx = forma.x2 - forma.x1
        const dy = forma.y2 - forma.y1
        f = { tipo: 'segmento', x: (forma.x1 + forma.x2) / 2, y: (forma.y1 + forma.y2) / 2, comprimento: Math.hypot(dx, dy), espessura: Math.max(4, forma.espessura ?? 2), angulo: Math.atan2(dy, dx) }
      }
      if (f && VE_AVISOS) {
        Object.assign(f, { vx: 0, vy: 0, aviso: ms, idade: 0, fantasma: true })
        fantasmas.push(f)
      }
      return avisoOriginal.call(this, forma, () => {
        if (f) f.morta = true
        depois?.()
      })
    }
    const jogo = window.debugJogo.jogo
    const cena = jogo.scene.getScenes(true)[0]
    const pista = new Pista(cena, {
      x: 160,
      y: 198,
      largura: 220,
      altura: 170,
      jogador: 0,
      tema: {},
      velocidadeMax: 300,
      velocidade: 180,
      dinamica: { campo: { esquerda: 8, direita: 312, topo: 74, base: 334 } },
    })
    await pista.mostrar()
    jogo.loop.sleep()

    const mulberry = (a) => () => {
      a |= 0
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const tique = () => new Promise((r) => setTimeout(r, 0))
    const DT = 1000 / 60

    // avisos do validador por carta
    const avisosPorCarta = {}
    const brutos = {}
    let semAtual = ''
    let atual = ''
    const warnOriginal = console.warn
    console.warn = (...args) => {
      const t = args.join(' ')
      ;(avisosPorCarta[atual] ??= new Set()).add(t.replace(/t=\d+ms/, 't=?'))
      ;(brutos[atual] ??= []).push(t + ' @' + semAtual)
      warnOriginal.apply(console, args)
    }

    let porTextura = {}
    // nivelJogo: FÁCIL/MÉDIO/DIFÍCIL (NIVEIS); nivel: o bot ('dificil' | 'normal')
    async function rodarUma(carta, nivel, semente, nivelJogo) {
      semAtual = `${nivelJogo}:${nivel}:${semente}`
      const def = CHEFES[carta.chefe]
      const niv = nivelDoChefe(carta.chefe, nivelJogo)
      const ataque = ataqueDaCartaChefe(carta, { ataques })
      const dano = danoDaCartaChefe(carta, niv.dano)
      const extra = ritmoDaCartaChefe(carta)
      const d = def.desafio ?? {}
      const ritmo = {
        velocidade: DESAFIO.velocidade * niv.velocidade * (d.velocidade ?? 1) * extra.velocidade,
        densidade: DESAFIO.densidade * niv.densidade * (d.densidade ?? 1) * extra.densidade,
      }
      pista.velocidadeMaxBase = DIFICULDADES[def.dificuldade].velocidadeMaxBala * DESAFIO.velocidadeMax * niv.velocidadeMax
      const inverterMs = inverteControles(carta) ? 1 : 0
      pista.tema = def.tema
      const bot = new EsquivaBot({ nivel, sorte: mulberry(semente * 7919 + 13) })
      let acertos = 0
      let primeiro = null
      let tempoAtivo = 0
      pista.aoAcertar = (d, bala) => {
        const chave = `${Math.floor((pista.ataque?.ctx.tempo ?? 0) / 1000)}s:${bala.sprite?.texture?.key}`
        porTextura[chave] = (porTextura[chave] ?? 0) + 1
        acertos++
        return true
      }
      const l = pista.caixa.limites
      const c = pista.coracoes[0]
      c.x = l.centerX
      c.y = l.bottom - 30
      c.invencivelMs = 0
      fantasmas.length = 0
      let pronto = false
      pista.rodar(ataque, { dano, ritmo, semente: `medida:${semente}` }).then(() => (pronto = true))
      for (let i = 0; i < 5; i++) await Promise.resolve()
      await tique()
      let frames = 0
      while (pista.rodando && frames < 60 * 40) {
        const inv = inverterMs > 0 && pista.atacando
        for (let i = fantasmas.length - 1; i >= 0; i--) {
          const f = fantasmas[i]
          if (f.morta || !pista.rodando) fantasmas.splice(i, 1)
          else f.idade = Math.min(f.aviso - 1, f.idade + DT)
        }
        // balas com movimento próprio (atualizar mexe em x/y/angulo): o bot usa
        // a velocidade observada no último frame, como um jogador que vê a bala andar
        const fator = pista.balas.fatorVelocidade || 1
        const discos = []
        const vistas = pista.balas.lista.map((b) => {
          const ant = anteriores.get(b)
          anteriores.set(b, { x: b.x, y: b.y, angulo: b.angulo })
          if (!ant || VE_MOVIMENTO === false || (b.idade ?? 0) < (b.aviso ?? 0) + DT) return b
          const s = DT / 1000
          const ox = b.x - ant.x
          const oy = b.y - ant.y
          const oa = (b.angulo ?? 0) - (ant.angulo ?? 0)
          const mexeuSozinha = Math.hypot(ox - b.vx * fator * s, oy - b.vy * fator * s) > 0.6
          const girouSozinha = b.tipo === 'segmento' && Math.abs(oa - (b.girar ?? 0) * fator * s) > 0.004
          if (!mexeuSozinha && !girouSozinha) return b
          const w = oa / s
          // lâmina girando rápido em volta de uma ponta (pivô): quem joga evita o
          // disco inteiro que ela varre, não só a lâmina (a previsão linear erra feio)
          if (b.tipo === 'segmento' && Math.abs(w) >= 2.5 && !b.inofensiva) {
            const L = b.comprimento / 2
            const c0 = { x: Math.cos(b.angulo) * L, y: Math.sin(b.angulo) * L }
            const vc = { x: ox / s, y: oy / s }
            const vPonta = (sg) => Math.hypot(vc.x - sg * w * c0.y, vc.y + sg * w * c0.x)
            const v1 = vPonta(1)
            const v2 = vPonta(-1)
            if (Math.min(v1, v2) < 0.35 * Math.max(v1, v2)) {
              const sg = v1 < v2 ? 1 : -1
              discos.push({ tipo: 'circulo', x: b.x + sg * c0.x, y: b.y + sg * c0.y, raio: b.comprimento + b.espessura / 2, vx: 0, vy: 0, aviso: 0, idade: 0, fantasma: true })
            }
          }
          return { ...b, vx: ox / s / fator, vy: oy / s / fator, ax: 0, ay: 0, girar: b.tipo === 'segmento' ? oa / s / fator : b.girar }
        })
        let joy = bot.joy(DT, {
          coracao: c,
          limites: pista.caixa.limites,
          balas: fantasmas.length || discos.length ? [...vistas, ...fantasmas, ...discos] : vistas,
          velocidade: pista.velocidadeCoracao,
          fatorVelocidade: pista.balas.fatorVelocidade,
          velocidadeMax: pista.balas.velocidadeMax,
          invertido: inv,
        })
        if (inv) joy = { x: -joy.x, y: -joy.y }
        pista.atualizar(DT, joy)
        if (pista.atacando) tempoAtivo += DT
        frames++
      }
      let guarda = 0
      while (!pronto && guarda++ < 400) {
        await tique()
        for (let k = 0; k < 10 && !pronto; k++) pista.atualizar(DT, { x: 0, y: 0 })
      }
      return { acertos, dano: acertos * dano, danoBala: dano, ms: Math.round(tempoAtivo) }
    }

    const chefes = Object.keys(CHEFES).filter((c) => !filtroChefes || filtroChefes.split(',').includes(c))
    const niveisJogo = filtroNiveis.split(',')
    const saida = []
    for (const chefe of chefes) {
      const cartas = [...CARTAS_CHEFES[chefe].fases.flat(), CARTAS_CHEFES[chefe].super]
      for (const carta of cartas) {
        atual = carta.id
        const linha = { id: carta.id, chefe, nome: carta.nome, naipe: carta.naipe, valor: carta.valor, fase: carta.fase, super: ehSuper(carta) }
        for (const nivelJogo of niveisJogo) {
          linha[nivelJogo] = {}
          for (const nivel of ['dificil', 'normal']) {
            const runs = []
            for (let s = 1; s <= nSementes; s++) runs.push(await rodarUma(carta, nivel, s, nivelJogo))
            linha[nivelJogo][nivel] = {
              acertos: runs.map((r) => r.acertos),
              media: +(runs.reduce((a, r) => a + r.acertos, 0) / runs.length).toFixed(2),
              danoBala: runs[0].danoBala,
            }
          }
        }
        linha.avisos = [...(avisosPorCarta[carta.id] ?? [])]
        saida.push(linha)
      }
    }
    return saida
  },
  { nSementes: Number(nSementes), filtroChefes, filtroNiveis },
)
fs.writeFileSync(saida, JSON.stringify({ resultado, avisos: avisos.filter((a) => !/\[(telegrafo|rota de fuga)\]/.test(a)).slice(0, 30) }, null, 1))
console.log('ok', resultado.length)
await browser.close()
