// HUD DE DESEMPENHO (ferramenta de dev; docs/desempenho.md): um quadrinho no canto com
// FPS, passo do Phaser em ms (update/render, média e p95), draw calls e comandos de Graphics
// por frame. Serve para olhar no celular de verdade (o dev na rede: `npm run dev -- --host`).
//
//   ?perf=1 na URL        liga ao abrir
//   F9                    liga/desliga
//   debugJogo.hudPerf()   liga/desliga pelo console (true/false força)
//
// É HTML por cima do canvas, não objeto do Phaser: não entra na lista de exibição nem
// nos draw calls que mede. Game.svelte só importa este arquivo no dev (ou num build com
// VITE_FERRAMENTAS_PERF=1): no build normal ele nem vai para o pacote.

const INTERVALO_MS = 500 // atualização do texto (e da contagem de comandos de Graphics)

export function instalarHudPerf(game) {
  let ligado = false
  let el = null
  let timer = null
  let instalado = false
  const passos = [] // [passo, update, render] dos frames desde o último texto
  let drawCalls = 0
  let frames = 0
  let t0 = 0
  let a0 = 0
  let u = 0
  let r = 0

  // os ganchos só entram na primeira vez que o HUD liga (desligado, o jogo fica como era)
  const instalar = () => {
    if (instalado) return
    instalado = true
    const sm = game.scene
    const up = sm.update.bind(sm)
    const rd = sm.render.bind(sm)
    sm.update = (time, delta) => {
      const a = performance.now()
      up(time, delta)
      u += performance.now() - a
    }
    sm.render = (renderer) => {
      const a = performance.now()
      rd(renderer)
      r += performance.now() - a
    }
    game.events.on('prestep', () => {
      a0 = performance.now()
      u = 0
      r = 0
    })
    game.events.on('postrender', () => {
      if (!ligado) return
      frames++
      passos.push([performance.now() - a0, u, r])
    })
    const gl = game.renderer?.gl
    if (gl) {
      for (const nome of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const orig = gl[nome]
        if (!orig) continue
        gl[nome] = function (...args) {
          if (ligado) drawCalls++
          return orig.apply(this, args)
        }
      }
    }
  }

  const comandosDeGraphics = () => {
    let cmd = 0
    let n = 0
    const visitar = (o) => {
      if (o.visible === false) return
      if (o.type === 'Graphics') {
        cmd += o.commandBuffer?.length ?? 0
        n++
      }
      if (o.list) o.list.forEach(visitar)
    }
    for (const s of game.scene.getScenes(true)) s.children.list.forEach(visitar)
    return { cmd, n }
  }

  const escrever = () => {
    const agora = performance.now()
    const seg = (agora - t0) / 1000 || 1
    const fps = frames / seg
    const ord = passos.map((p) => p[0]).sort((a, b) => a - b)
    const med = (k) => (passos.length ? passos.reduce((s, p) => s + p[k], 0) / passos.length : 0)
    const p95 = ord.length ? ord[Math.min(ord.length - 1, Math.floor(ord.length * 0.95))] : 0
    const dc = frames ? drawCalls / frames : 0
    const g = comandosDeGraphics()
    const tipo = game.renderer?.gl ? 'WebGL' : 'Canvas'
    const canvas = game.canvas ? `${game.canvas.width}x${game.canvas.height}` : ''
    el.textContent =
      `${fps.toFixed(0)} fps  ${tipo} ${canvas}\n` +
      `passo ${med(0).toFixed(1)} ms (p95 ${p95.toFixed(1)})\n` +
      `upd ${med(1).toFixed(1)} · rnd ${med(2).toFixed(1)}\n` +
      `dc ${gl() ? dc.toFixed(0) : '-'} · gfx ${g.n} / ${g.cmd} cmd`
    passos.length = 0
    frames = 0
    drawCalls = 0
    t0 = agora
  }
  const gl = () => Boolean(game.renderer?.gl)

  const alternar = (forcar) => {
    const quer = typeof forcar === 'boolean' ? forcar : !ligado
    if (quer === ligado) return ligado
    ligado = quer
    if (ligado) {
      instalar()
      el = document.createElement('div')
      el.className = 'hud-perf'
      Object.assign(el.style, {
        position: 'absolute',
        left: '4px',
        top: '4px',
        zIndex: '5',
        padding: '3px 6px',
        background: 'rgba(0, 0, 0, 0.72)',
        color: '#7dffa0',
        font: '11px/1.3 ui-monospace, Menlo, Consolas, monospace',
        whiteSpace: 'pre',
        pointerEvents: 'none',
        borderRadius: '3px',
      })
      el.textContent = '…'
      const pai = game.canvas?.parentElement ?? document.body
      pai.appendChild(el)
      passos.length = 0
      frames = 0
      drawCalls = 0
      t0 = performance.now()
      timer = setInterval(escrever, INTERVALO_MS)
    } else {
      clearInterval(timer)
      el?.remove()
      el = null
    }
    return ligado
  }

  const aoTeclar = (e) => {
    if (e.code !== 'F9' || e.repeat) return
    e.preventDefault()
    alternar()
  }
  window.addEventListener('keydown', aoTeclar)
  if (window.debugJogo) window.debugJogo.hudPerf = alternar

  const pedido = new URLSearchParams(location.search).get('perf')
  if (pedido === '1' || pedido === 'true') {
    if (game.isBooted) alternar(true)
    else game.events.once('ready', () => alternar(true))
  }

  return () => {
    window.removeEventListener('keydown', aoTeclar)
    alternar(false)
  }
}
