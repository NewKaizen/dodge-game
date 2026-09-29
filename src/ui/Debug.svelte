<script>
  import { jogo } from '../lib/estado.js'
</script>

<details class="debug" open>
  <summary>painel (volume, velocidade, debug)</summary>
  <div>último evento: {$jogo.ultimoEvento ?? '-'}</div>
  {#each $jogo.jogadores as j, i}
    <div>P{i + 1} joy: {j.joy.x}, {j.joy.y}</div>
  {/each}

  <label>
    velocidade do coração: {$jogo.velocidade} px/s
    <input type="range" min="30" max="600" step="10" bind:value={$jogo.velocidade} />
  </label>

  <label class="linha">
    <input type="checkbox" bind:checked={$jogo.som} />
    som
  </label>

  <label>
    volume da música: {$jogo.volume.musica}%
    <input type="range" min="0" max="100" step="1" bind:value={$jogo.volume.musica} disabled={!$jogo.som} />
  </label>

  <label>
    volume dos efeitos: {$jogo.volume.efeitos}%
    <input type="range" min="0" max="100" step="1" bind:value={$jogo.volume.efeitos} disabled={!$jogo.som} />
  </label>

  <div class="dica">
    Teclado — P1: WASD, A = Espaço/Z/E, B = Q/X · P2: setas, A = Enter, B = Shift direito<br />
    Console (dev, na batalha): <code>testarAtaque(ataques.foice({'{'} varridas: 2 {'}'}))</code>,
    <code>listarAtaques()</code>, <code>debugJogo.estado()</code>
  </div>
</details>

<style>
  .debug {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border: 1px solid #444;
    font-size: 12px;
    min-width: 300px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 4px;
  }

  .linha {
    flex-direction: row;
    align-items: center;
  }

  summary {
    cursor: pointer;
    color: #aaa;
  }

  .dica {
    color: #888;
  }
</style>
