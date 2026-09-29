<script>
  import { onMount } from 'svelte'
  import Phaser from 'phaser'
  import { criarConfig } from '../game/config.js'
  import { prepararResolucao, instalarResolucao } from '../game/resolucao.js'
  import { ligarBridge } from '../game/bridge.js'
  import { registrarDebug } from '../game/debug.js'

  let container

  onMount(() => {
    const game = new Phaser.Game(criarConfig(container, prepararResolucao()))
    const desligar = ligarBridge(game)
    const desligarResolucao = instalarResolucao(game)
    registrarDebug(game)

    return () => {
      desligarResolucao()
      desligar()
      game.destroy(true)
    }
  })
</script>

<div bind:this={container}></div>
