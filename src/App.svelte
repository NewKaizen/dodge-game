<script>
  import Conectar from './ui/Conectar.svelte'
  import Conta from './ui/Conta.svelte'
  import Game from './ui/Game.svelte'
  import { iniciarConta } from './lib/conta.js'

  // contas (login Google): sem config no servidor fica "indisponível" e o jogo segue igual
  iniciarConta()
</script>

<main>
  <Conectar />
  <Conta />
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
