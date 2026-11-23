// O MODO DETERMINÍSTICO da paridade visual (paridade.mjs): a mesma cena, no mesmo frame,
// tem que dar os mesmos pixels em duas rodadas do mesmo commit.
//   - Math.random vira um gerador com semente fixa (mulberry32), ressemeado na hora de abrir a cena;
//   - o relógio da página (Date, performance.now, setTimeout/Interval, rAF) é o falso do Playwright
//     (page.clock): corre normal no boot e PARA antes da cena; depois só anda com o passo;
//   - o laço do Phaser dorme (game.loop.sleep) e cada frame é um game.step(t, 16.667) chamado daqui,
//     depois de o relógio andar o mesmo tanto (os timers e os tweens, que leem Date.now, andam junto);
//   - som desligado (o AudioContext tem relógio próprio, real);
//   - carregamento pendente (Loader de uma cena) segura o passo até acabar: o frame em que a cena
//     nasce não depende da rede.
export const EPOCA = Date.UTC(2026, 0, 5, 12, 0, 0) // uma segunda-feira (o boss semanal sai da data)
export const CONGELA = EPOCA + 3_600_000 // o relógio para aqui (bem depois do boot)
export const DELTA = 1000 / 60

// roda antes de qualquer código da página
export const scriptInicial = (semente) => `(() => {
  let s = 0
  const semear = (x) => {
    let h = 1779033703 ^ String(x).length
    for (const c of String(x)) { h = Math.imul(h ^ c.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19) }
    s = h >>> 0
  }
  const mulberry32 = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  semear(${JSON.stringify(semente)})
  Math.random = mulberry32
  window.__semearRandom = semear
})()`

export async function prepararPagina(pagina, semente) {
  await pagina.addInitScript(scriptInicial(semente))
  await pagina.clock.install({ time: EPOCA })
}

// Depois do Menu: para o relógio, desliga o som, adormece o laço e instala o passo manual
export async function congelar(pagina, semente) {
  await pagina.evaluate(async () => (await import('/src/game/audio.js')).setSomLigado(false))
  // as cenas carregadas sob demanda (src/game/cenasPreguicosas.js) chegam antes: a cena pedida nasce no mesmo
  // quadro de uma árvore sem o carregamento sob demanda
  await pagina.evaluate(async () => window.__carregarTodasAsCenas?.())
  await pagina.clock.pauseAt(CONGELA)
  await pagina.evaluate(
    ({ semente, delta }) => {
      const g = window.debugJogo.jogo
      g.loop.sleep()
      window.__semearRandom(semente)
      const macro = () =>
        new Promise((ok) => {
          const c = new MessageChannel()
          c.port1.onmessage = () => ok()
          c.port2.postMessage(0)
        })
      // (e as cenas carregadas sob demanda, src/game/cenasPreguicosas.js: o import ainda não chegou)
      const carregando = () => (window.__cenasCarregando ?? 0) > 0 || g.scene.getScenes(false).some((s) => s.sys.settings.status < 5 && s.sys.settings.status > 0 && s.load?.isLoading?.())
      let t = 1_000_000 // o tempo do laço (fixo: não depende de quanto o boot demorou)
      window.__det = {
        // um frame: o tempo do laço anda `delta` e o Phaser dá um passo inteiro (update + render)
        // devolve null se uma cena ainda está carregando (quem chama espera de verdade e tenta de novo);
        // com foto, o PNG do canvas sai logo depois do render (antes de o navegador compor o frame)
        async passo(foto = false) {
          // as promessas da cena (await tween, await esperar) andam antes do frame seguinte
          await macro()
          if (carregando()) return null
          const L = g.loop
          t += delta
          L.time += delta
          L.delta = delta
          L.rawDelta = delta
          L.frame++
          g.step(t, delta)
          const png = foto ? g.canvas.toDataURL('image/png') : null
          await macro()
          return { frame: L.frame, png }
        },
        carregando,
      }
    },
    { semente, delta: DELTA },
  )
}
