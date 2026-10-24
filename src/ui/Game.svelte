<script>
  import { onMount } from 'svelte'
  import Phaser from 'phaser'
  import { criarConfig } from '../game/config.js'
  import { prepararResolucao, instalarResolucao } from '../game/resolucao.js'
  import { ligarBridge } from '../game/bridge.js'
  import { registrarDebug } from '../game/debug.js'
  import { instalarOnline } from '../game/online.js'
  import { instalarTelaCheia } from '../lib/telaCheia.js'
  import { lan } from '../lib/lan/rede.js'
  import { tela, ligarJogo, ligarTela, pingPartida, ROTAS, corDoPing } from '../lib/lan/transmissao.js'
  import '../lib/lan/controleRemoto.js'
  import { jogo } from '../lib/estado.js'

  let container
  let video
  let reserva

  // Modo LAN, convidado: durante a partida a imagem do host cobre o jogo daqui
  let assistindo = $derived($lan.fase === 'sala' && $lan.papel === 'convidado' && $lan.sala?.emPartida)
  // LAN/ONLINE: o ping fica no canto durante a partida (aparece também em tela cheia)
  let emPartidaRemota = $derived($lan.fase === 'sala' && $lan.sala?.emPartida && $lan.sala.membros.length > 1)
  let volume = $derived($jogo.som ? Math.min(1, ($jogo.volume.musica + $jogo.volume.efeitos) / 200) : 0)
  $effect(() => {
    if (video) video.volume = volume
  })

  onMount(() => {
    const game = new Phaser.Game(criarConfig(container, prepararResolucao()))
    const desligar = ligarBridge(game)
    const desligarResolucao = instalarResolucao(game)
    const desligarTelaCheia = instalarTelaCheia(container)
    registrarDebug(game)
    const desligarOnline = instalarOnline(game)
    ligarJogo(game)
    ligarTela(video, reserva)

    return () => {
      desligarOnline()
      desligarTelaCheia()
      desligarResolucao()
      desligar()
      game.destroy(true)
    }
  })
</script>

<div class="jogo" bind:this={container}>
  <!-- svelte-ignore a11y_media_has_caption -->
  <video bind:this={video} class="remota" class:visivel={assistindo && $tela.modo === 'video'} autoplay playsinline></video>
  <canvas bind:this={reserva} class="remota" class:visivel={assistindo && $tela.modo === 'reserva'}></canvas>
  {#if emPartidaRemota}
    <div class="ping" style:color={corDoPing($pingPartida.ms)} title={$pingPartida.rota ? `ligação ${ROTAS[$pingPartida.rota]}` : ''}>
      {$pingPartida.ms ?? '…'} ms{$pingPartida.rota && $pingPartida.rota !== 'direta' ? ` · ${ROTAS[$pingPartida.rota]}` : ''}
    </div>
  {/if}
</div>

<style>
  .jogo {
    position: relative;
  }

  .jogo:fullscreen {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
  }

  .remota {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: transparent;
    visibility: hidden;
    pointer-events: none;
  }

  .remota.visivel {
    visibility: visible;
    background: #000;
  }

  canvas.remota {
    image-rendering: pixelated;
  }

  .ping {
    position: absolute;
    right: 6px;
    bottom: 6px;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.6);
    font-size: 12px;
    pointer-events: none;
    z-index: 2;
  }
</style>
