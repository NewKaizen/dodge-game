<script>
  // Recorte quadrado da foto antes de enviar: arrasta para mover, barra (ou
  // roda do mouse) para aproximar. Sai um quadrado de 512 px; o servidor ainda
  // recodifica em WebP 256x256 sem metadados (server/contas.js).
  //   <RecorteFoto arquivo={file} aoConfirmar={(blob) => ...} aoCancelar={() => ...} />
  import { onDestroy } from 'svelte'

  let { arquivo, aoConfirmar, aoCancelar, ocupado = false } = $props()

  const VISTA = 220 // px do quadro na tela
  const SAIDA = 512
  let canvas = $state()
  let previa = $state()
  let img = $state(null)
  let erro = $state('')
  let zoom = $state(1) // 1 = a foto cobre o quadro
  let cx = $state(0.5) // centro do recorte (0..1 da foto)
  let cy = $state(0.5)
  let arrasto = null
  let url = null

  $effect(() => {
    if (!arquivo) return
    erro = ''
    img = null
    if (url) URL.revokeObjectURL(url)
    url = URL.createObjectURL(arquivo)
    const nova = new Image()
    nova.onload = () => {
      if (nova.naturalWidth < 64 || nova.naturalHeight < 64) return (erro = 'foto pequena demais (mínimo 64x64)')
      zoom = 1
      cx = cy = 0.5
      img = nova
    }
    nova.onerror = () => (erro = 'não deu para abrir essa imagem')
    nova.src = url
  })
  onDestroy(() => url && URL.revokeObjectURL(url))

  // lado do recorte em pixels da foto
  const ladoFonte = () => Math.min(img.naturalWidth, img.naturalHeight) / zoom

  function limitar() {
    const l = ladoFonte()
    const mx = l / 2 / img.naturalWidth
    const my = l / 2 / img.naturalHeight
    cx = Math.min(1 - mx, Math.max(mx, cx))
    cy = Math.min(1 - my, Math.max(my, cy))
  }

  function desenhar(alvo, lado) {
    const ctx = alvo.getContext('2d')
    const l = ladoFonte()
    const sx = cx * img.naturalWidth - l / 2
    const sy = cy * img.naturalHeight - l / 2
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, lado, lado)
    ctx.drawImage(img, sx, sy, l, l, 0, 0, lado, lado)
  }

  $effect(() => {
    void zoom, cx, cy
    if (!img || !canvas) return
    limitar()
    desenhar(canvas, VISTA)
    if (previa) desenhar(previa, 64)
  })

  function aoApertar(e) {
    if (!img) return
    canvas.setPointerCapture(e.pointerId)
    arrasto = { x: e.clientX, y: e.clientY, cx, cy }
  }
  function aoMover(e) {
    if (!arrasto) return
    const l = ladoFonte()
    const porPx = l / VISTA
    cx = arrasto.cx - ((e.clientX - arrasto.x) * porPx) / img.naturalWidth
    cy = arrasto.cy - ((e.clientY - arrasto.y) * porPx) / img.naturalHeight
  }
  const aoSoltar = () => (arrasto = null)
  function aoRodar(e) {
    e.preventDefault()
    zoom = Math.min(4, Math.max(1, zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
  }

  function confirmar() {
    if (!img) return
    const saida = document.createElement('canvas')
    saida.width = saida.height = SAIDA
    desenhar(saida, SAIDA)
    // WebP quando o navegador sabe; senão ele devolve PNG (o servidor aceita os dois)
    saida.toBlob((blob) => (blob ? aoConfirmar(blob) : (erro = 'não deu para preparar a foto')), 'image/webp', 0.9)
  }
</script>

<div class="recorte">
  {#if erro}
    <p class="erro">{erro}</p>
  {/if}
  <div class="linha">
    <canvas
      bind:this={canvas}
      width={VISTA}
      height={VISTA}
      class="quadro"
      class:vazio={!img}
      onpointerdown={aoApertar}
      onpointermove={aoMover}
      onpointerup={aoSoltar}
      onpointercancel={aoSoltar}
      onwheel={aoRodar}
    ></canvas>
    <div class="lado">
      <span class="dica">prévia</span>
      <canvas bind:this={previa} width="64" height="64" class="previa"></canvas>
      <label class="dica">
        zoom
        <input type="range" min="1" max="4" step="0.01" bind:value={zoom} disabled={!img} />
      </label>
      <span class="dica">arraste a foto para enquadrar</span>
    </div>
  </div>
  <div class="botoes">
    <button onclick={confirmar} disabled={!img || ocupado}>{ocupado ? 'Enviando…' : 'Enviar foto'}</button>
    <button onclick={aoCancelar} disabled={ocupado}>Cancelar</button>
  </div>
</div>

<style>
  .recorte {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .linha {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .quadro {
    width: 220px;
    height: 220px;
    border: 2px solid #6dffb0;
    cursor: grab;
    touch-action: none;
    background: #000;
  }

  .quadro.vazio {
    cursor: default;
  }

  .previa {
    width: 64px;
    height: 64px;
    border: 2px solid #6dffb0;
    background: #000;
  }

  .lado {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .botoes {
    display: flex;
    gap: 8px;
  }

  .dica {
    color: #888;
    font-size: 12px;
  }

  .erro {
    color: #f55;
    margin: 0;
  }
</style>
