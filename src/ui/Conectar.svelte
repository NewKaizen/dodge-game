<script>
  import { jogo, MAX_JOGADORES } from '../lib/estado.js'
  import { conectarSerial } from '../lib/serial.js'
  import { iniciarSimulador, pararSimulador } from '../lib/simulador.js'

  let erro = $state('')

  async function conectar() {
    erro = ''
    try {
      await conectarSerial()
    } catch (e) {
      erro = e.message
    }
  }
</script>

<div class="conectar">
  <span>Jogadores:</span>
  {#each Array.from({ length: MAX_JOGADORES }, (_, i) => i + 1) as n}
    <button class:ativo={$jogo.numJogadores === n} onclick={() => ($jogo.numJogadores = n)}>{n}</button>
  {/each}
  <span class="dica">(vale a partir da próxima batalha)</span>
</div>

<div class="conectar">
  {#if $jogo.conectado}
    <span>Conectado ({$jogo.fonte})</span>
    {#if $jogo.fonte === 'simulador'}
      <button onclick={pararSimulador}>Parar simulador</button>
    {/if}
  {:else}
    <button onclick={conectar}>Conectar joystick</button>
    <button onclick={() => iniciarSimulador()}>Simulador (teclado)</button>
  {/if}
  {#if erro}<span class="erro">{erro}</span>{/if}
</div>

<style>
  .conectar {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .ativo {
    outline: 2px solid #ff0;
  }

  .dica {
    color: #888;
    font-size: 12px;
  }

  .erro {
    color: #f55;
  }
</style>
