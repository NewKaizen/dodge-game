<script>
  import { onMount } from 'svelte'
  import Phaser from 'phaser'
  import { criarConfig, zoomInteiro } from '../game/config.js'
  import { ligarBridge } from '../game/bridge.js'
  import { registrarDebug } from '../game/debug.js'

  let container

  onMount(() => {
    const game = new Phaser.Game(criarConfig(container, zoomInteiro()))
    const desligar = ligarBridge(game)
    registrarDebug(game)

    const aoRedimensionar = () => game.scale.setZoom(zoomInteiro())
    window.addEventListener('resize', aoRedimensionar)

    return () => {
      window.removeEventListener('resize', aoRedimensionar)
      desligar()
      game.destroy(true)
    }
  })
</script>

<div bind:this={container}></div>
