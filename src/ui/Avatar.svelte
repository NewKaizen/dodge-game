<script>
  // Avatar do perfil: foto enviada (URL do Storage), personagem do jogo
  // (pixel art de game/arte/sprites.js, cabeça e tronco) ou o coração padrão.
  //   <Avatar avatar={{ tipo, id, url }} tamanho={48} moldura="#cd7f32" />
  //   moldura: cor da borda (a moldura equipada, lib/progresso.js corDaMoldura); sem ela, a verde de sempre
  import { SPRITES, CORACAO_MAPA } from '../game/arte/sprites.js'

  let { avatar = { tipo: 'padrao' }, tamanho = 48, titulo = '', moldura = null } = $props()
  let arcoiris = $derived(moldura === '#ff5fd2')

  const LADO = 16 // pixels da arte (quadrado)
  let canvas = $state()
  let fotoFalhou = $state(false)
  let usarFoto = $derived(avatar?.tipo === 'enviado' && avatar.url && !fotoFalhou)

  $effect(() => {
    void avatar?.url
    fotoFalhou = false
  })

  $effect(() => {
    if (usarFoto || !canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, LADO, LADO)
    ctx.fillStyle = '#16182a'
    ctx.fillRect(0, 0, LADO, LADO)
    const sprite = avatar?.tipo === 'jogo' ? SPRITES[avatar.id] : null
    const mapa = sprite ? sprite.mapa.slice(0, LADO) : CORACAO_MAPA
    const paleta = sprite ? sprite.paleta : { '#': '#ff3355' }
    // centraliza o mapa (o coração é 11x10)
    const dx = Math.floor((LADO - mapa[0].length) / 2)
    const dy = sprite ? 1 : Math.floor((LADO - mapa.length) / 2)
    mapa.forEach((linha, y) => {
      ;[...linha].forEach((letra, x) => {
        const cor = paleta[letra]
        if (!cor) return
        ctx.fillStyle = cor
        ctx.fillRect(x + dx, y + dy, 1, 1)
      })
    })
  })
</script>

<span class="avatar" class:arcoiris style:width="{tamanho}px" style:height="{tamanho}px" style:border-color={moldura ?? undefined} style:border-width={moldura && tamanho >= 48 ? '4px' : undefined} title={titulo}>
  {#if usarFoto}
    <img src={avatar.url} alt="foto de perfil" width={tamanho} height={tamanho} referrerpolicy="no-referrer" onerror={() => (fotoFalhou = true)} />
  {:else}
    <canvas bind:this={canvas} width={LADO} height={LADO} style:width="{tamanho}px" style:height="{tamanho}px" aria-label="avatar"></canvas>
  {/if}
</span>

<style>
  .avatar {
    display: inline-block;
    flex: none;
    border: 2px solid #6dffb0;
    background: #16182a;
    overflow: hidden;
    line-height: 0;
  }

  .arcoiris {
    border-image: linear-gradient(135deg, #ff3355, #ffd34d, #6dffb0, #4da6ff, #c9a2ff) 1;
  }

  img {
    object-fit: cover;
  }

  canvas {
    image-rendering: pixelated;
  }
</style>
