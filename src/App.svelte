<script>
  import Conectar from './ui/Conectar.svelte'
  import Game from './ui/Game.svelte'
  import Debug from './ui/Debug.svelte'
</script>

<main>
  <Conectar />
  <Game />
  <Debug />
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
