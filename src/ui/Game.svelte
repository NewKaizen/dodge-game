<script>
  import { onMount } from 'svelte'
  import Phaser from 'phaser'
  import { criarConfig } from '../game/config.js'
  import { prepararResolucao, instalarResolucao } from '../game/resolucao.js'
  import { ligarBridge } from '../game/bridge.js'
  import { registrarDebug } from '../game/debug.js'
  import { instalarTelaCheia } from '../lib/telaCheia.js'

  let container

  onMount(() => {
    const game = new Phaser.Game(criarConfig(container, prepararResolucao()))
    const desligar = ligarBridge(game)
    const desligarResolucao = instalarResolucao(game)
    const desligarTelaCheia = instalarTelaCheia(container)
    registrarDebug(game)

    return () => {
      desligarTelaCheia()
      desligarResolucao()
      desligar()
      game.destroy(true)
    }
  })
</script>

<div class="jogo" bind:this={container}></div>

<style>
  .jogo:fullscreen {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
  }
</style>
