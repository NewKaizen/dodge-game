// As sondas que medir.mjs injeta na página (page.evaluate) depois do Menu, no `npm run dev`.
// Só contadores baratos no caminho de cada frame; o "de onde veio" (a linha que criou cada
// Graphics/Text) usa uma pilha por objeto criado e por isso só liga fora das janelas medidas.
//
//   __P.gravar(true|false)    liga/desliga o registro por frame (__P.quadros)
//   __P.marcar(true|false)    liga/desliga a etiqueta de origem nos objetos criados
//   __P.foto()                o retrato da lista de exibição (Graphics, comandos, câmeras...)
//   __P.origens(frames)       por linha de código: comandos, clears, re-render de texto, criações
;(() => {
  if (window.__P) return
  const g = window.debugJogo.jogo
  const P = (window.__P = { rec: false, quadros: [], cur: null, tag: false, clr: {}, txt: {}, criados: {}, framesOrigem: 0 })
  const somar = (k, n = 1) => {
    if (P.cur) P.cur[k] += n
  }

  // o passo do Phaser: update e render das cenas, separados
  const sm = g.scene
  const up = sm.update.bind(sm)
  const rd = sm.render.bind(sm)
  sm.update = (t, d) => {
    const a = performance.now()
    up(t, d)
    if (P.cur) P.cur.u += performance.now() - a
  }
  sm.render = (r) => {
    const a = performance.now()
    rd(r)
    if (P.cur) P.cur.r += performance.now() - a
  }
  const fase = () => window.pvpArena?.fase || window.coopArena?.fase || ''
  let a0 = 0
  let seq = 0 // número do frame (o FPS só conta intervalos entre frames seguidos)
  g.events.on('prestep', () => {
    a0 = performance.now()
    seq++
    P.cur = P.rec ? { seq, t: a0, u: 0, r: 0, s: 0, dc: 0, tex: 0, buf: 0, gclr: 0, txt: 0, des: 0, mem: 0, ph: fase() } : null
  })
  g.events.on('postrender', () => {
    if (P.tag) P.framesOrigem++
    if (!P.rec || !P.cur) return
    P.cur.s = performance.now() - a0
    P.cur.mem = performance.memory?.usedJSHeapSize || 0
    P.quadros.push(P.cur)
  })

  // WebGL: draw calls, envios de textura e bytes de buffer (no Canvas fica tudo 0)
  const gl = g.renderer.gl
  if (gl) {
    const embrulhar = (nome, chave, quanto) => {
      const orig = gl[nome]
      if (!orig) return
      gl[nome] = function (...a) {
        somar(chave, quanto ? quanto(a) : 1)
        return orig.apply(this, a)
      }
    }
    for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) embrulhar(n, 'dc')
    embrulhar('texImage2D', 'tex')
    embrulhar('texSubImage2D', 'tex')
    embrulhar('bufferData', 'buf', (a) => a[1]?.byteLength || 0)
    embrulhar('bufferSubData', 'buf', (a) => a[2]?.byteLength || 0)
  }
  // Canvas: os drawImage/fill contam como "draw calls" (ordem de grandeza, não é a mesma coisa)
  const ctx = !gl && g.renderer.gameContext
  if (ctx) {
    const proto = Object.getPrototypeOf(ctx)
    for (const n of ['drawImage', 'fill', 'stroke', 'fillRect', 'fillText', 'strokeText']) {
      const orig = proto[n]
      proto[n] = function (...a) {
        if (this === ctx) somar('dc')
        return orig.apply(this, a)
      }
    }
  }

  // de onde veio: a primeira linha de /src/ na pilha de quem criou o objeto
  const origem = () => {
    const pilha = new Error().stack.split('\n').slice(2)
    const l = pilha.find((x) => x.includes('/src/') && !x.includes('/sondas')) || pilha[0] || ''
    const m = l.match(/\/src\/(.*?)(\?[^:]*)?:(\d+):\d+/)
    return m ? `${m[1]}:${m[3]}` : l.trim().slice(0, 80)
  }
  const cena0 = g.scene.scenes[0]
  const FP = Object.getPrototypeOf(cena0.add)
  const FORA = new Set(['constructor', 'existing', 'boot', 'start', 'shutdown', 'destroy'])
  for (const k of Object.getOwnPropertyNames(FP)) {
    const f = FP[k]
    if (typeof f !== 'function' || FORA.has(k) || k.startsWith('_')) continue
    FP[k] = function (...a) {
      const o = f.apply(this, a)
      if (P.tag && o && typeof o === 'object' && 'type' in o) {
        try {
          o.__origem = origem()
          const chave = `${o.type} ${o.__origem}`
          P.criados[chave] = (P.criados[chave] || 0) + 1
        } catch {
          /* objeto congelado */
        }
      }
      return o
    }
  }
  const MP = Object.getPrototypeOf(cena0.make)
  for (const k of ['graphics', 'text']) {
    const f = MP[k]
    MP[k] = function (...a) {
      const o = f.apply(this, a)
      if (P.tag && o) o.__origem = origem()
      return o
    }
  }

  // Graphics.clear(), Text.updateText() e GameObject.destroy(): por frame (e por origem)
  const gr = cena0.make.graphics({}, false)
  const Gp = Object.getPrototypeOf(gr)
  gr.destroy()
  const tx = cena0.make.text({ text: 'x' }, false)
  const Tp = Object.getPrototypeOf(tx)
  tx.destroy()
  const oc = Gp.clear
  Gp.clear = function () {
    if (P.cur) P.cur.gclr++
    if (P.tag) {
      const k = this.__origem || '?'
      P.clr[k] = (P.clr[k] || 0) + 1
    }
    return oc.call(this)
  }
  const ou = Tp.updateText
  Tp.updateText = function () {
    if (P.cur) P.cur.txt++
    if (P.tag) {
      const k = this.__origem || '?'
      P.txt[k] = (P.txt[k] || 0) + 1
    }
    return ou.call(this)
  }
  let base = Gp
  while (base && !Object.prototype.hasOwnProperty.call(base, 'destroy')) base = Object.getPrototypeOf(base)
  let raiz = base
  while (Object.getPrototypeOf(raiz) && Object.prototype.hasOwnProperty.call(Object.getPrototypeOf(raiz), 'destroy') && Object.getPrototypeOf(raiz).constructor.name !== 'EventEmitter') raiz = Object.getPrototypeOf(raiz)
  const od = raiz.destroy
  raiz.destroy = function (...a) {
    if (P.cur) P.cur.des++
    return od.apply(this, a)
  }

  P.gravar = (sim) => {
    P.rec = sim
    if (sim) P.quadros = []
    const q = P.quadros
    if (!sim) P.quadros = []
    return sim ? null : q
  }
  P.marcar = (sim) => {
    P.tag = sim
    if (sim) {
      P.clr = {}
      P.txt = {}
      P.criados = {}
      P.framesOrigem = 0
    }
  }

  const andar = (fn) => {
    const visitar = (o) => {
      fn(o)
      if (o.visible !== false && o.list) o.list.forEach(visitar)
    }
    for (const s of g.scene.getScenes(true)) s.children.list.forEach(visitar)
  }
  P.foto = () => {
    const f = { objetos: 0, visiveis: 0, tipos: {}, gcmd: 0, graphics: 0, textos: 0, cameras: 0, filtros: 0, particulas: 0, texturas: Object.keys(g.textures.list).length, cenas: g.scene.getScenes(true).map((s) => s.scene.key) }
    andar((o) => {
      f.objetos++
      if (o.visible === false) return
      f.visiveis++
      f.tipos[o.type] = (f.tipos[o.type] || 0) + 1
      if (o.type === 'Graphics') {
        f.gcmd += o.commandBuffer?.length || 0
        f.graphics++
      }
      if (o.type === 'Text') f.textos++
      if (o.filters) f.filtros += (o.filters.internal?.list?.length || 0) + (o.filters.external?.list?.length || 0)
      if (o.type === 'ParticleEmitter') f.particulas += o.getAliveParticleCount?.() || 0
    })
    for (const s of g.scene.getScenes(true)) {
      f.cameras += s.cameras.cameras.length
      for (const c of s.cameras.cameras) f.filtros += (c.filters?.internal?.list?.length || 0) + (c.filters?.external?.list?.length || 0)
    }
    return f
  }
  P.origens = (segundos, n = 12) => {
    const frames = Math.max(1, P.framesOrigem)
    const gs = {}
    const ts = {}
    andar((o) => {
      if (o.visible === false) return
      const k = o.__origem || '?'
      if (o.type === 'Graphics') {
        const e = (gs[k] ??= { n: 0, cmd: 0 })
        e.n++
        e.cmd += o.commandBuffer?.length || 0
      }
      if (o.type === 'Text') {
        const e = (ts[k] ??= { n: 0 })
        e.n++
      }
    })
    const topo = (o, val) => Object.entries(o).sort((a, b) => val(b[1]) - val(a[1])).slice(0, n)
    const r2 = (x) => Math.round(x * 100) / 100
    return {
      frames,
      graphics: topo(gs, (v) => v.cmd).map(([k, v]) => ({ origem: k, n: v.n, cmd: v.cmd, clearsPorFrame: r2((P.clr[k] || 0) / frames) })),
      textos: topo(ts, (v) => v.n).map(([k, v]) => ({ origem: k, n: v.n, rerenderPorFrame: r2((P.txt[k] || 0) / frames) })),
      clears: topo(P.clr, (v) => v).map(([k, v]) => ({ origem: k, porFrame: r2(v / frames) })),
      rerenderTexto: topo(P.txt, (v) => v).map(([k, v]) => ({ origem: k, porFrame: r2(v / frames) })),
      criadosPorSegundo: topo(P.criados, (v) => v).map(([k, v]) => ({ origem: k, porSegundo: r2(v / segundos) })),
    }
  }
})()
