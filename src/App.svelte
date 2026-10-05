<script>
  import Conectar from './ui/Conectar.svelte'
  import Game from './ui/Game.svelte'
</script>

<main>
  <Conectar />
  <Game />
</main>

<style>
  :global(body) {
    margin: 0;
    background: #000;
    color: #fff;
    font-family: monospace;
  }

  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px;
  }
</style>
