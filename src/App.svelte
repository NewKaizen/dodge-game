<script>
  import './styles/arcade.css'
  import Conectar from './ui/Conectar.svelte'
  import FotoModal from './ui/FotoModal.svelte'
  import Game from './ui/Game.svelte'
  import { iniciarConta } from './lib/conta.js'
  import { iniciarAmigos } from './lib/amigos.js'

  // contas (login Google): sem config no servidor fica "indisponível" e o jogo segue igual
  iniciarConta()
  // amigos e convites: só funcionam logado (lib/amigos.js)
  iniciarAmigos()
</script>

<main class="arcade-shell">
  <header class="arcade-header">
    <div class="arcade-brand"><span aria-hidden="true">♥</span> DODGE</div>
    <div class="arcade-toolbar"><Conectar /></div>
  </header>
  <div class="arcade-stage"><Game /></div>
  <footer class="arcade-footer">
    <span><strong>DESVIE.</strong> JOGUE SUAS CARTAS. SOBREVIVA.</span>
    <span class="secondary">TECLADO / CONTROLE / JOYSTICK</span>
  </footer>
  <FotoModal />
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

  :global(body) { background: var(--color-paper); color: var(--color-ink); font-family: var(--font-body); }
  main.arcade-shell { gap: 10px; padding: 0 16px 12px; }
</style>
