<script>
  import { jogo } from '../lib/estado.js'
  import { alternarTelaCheia } from '../lib/telaCheia.js'
  import { lan, sairSala } from '../lib/lan/rede.js'
  import { pingPartida, ROTAS, corDoPing } from '../lib/lan/transmissao.js'

  // modo LAN/ONLINE: na sala o número de jogadores é o da sala (sempre 2)
  let naSala = $derived($lan.fase === 'sala')
  let outro = $derived($lan.sala?.membros.find((m) => m.id !== $lan.eu.id))

  // os controles se ligam sozinhos (game/entrada.js): a primeira tecla, o primeiro botão do
  // controle ou o joystick serial já autorizado. Aqui só um resumo discreto.
  const NOMES = { teclado: 'teclado', gamepad: 'controle', serial: 'joystick serial' }
  let ligados = $derived(Object.keys(NOMES).filter((f) => $jogo.fontes[f]).map((f) => NOMES[f]))
</script>

{#if naSala}
  <div class="conectar lan">
    <span>{$lan.online ? `ONLINE · sala ${$lan.sala.codigo}` : `LAN · ${$lan.sala.nome}`} · você é {$lan.papel === 'host' ? 'o HOST (P1)' : 'o CONVIDADO (P2)'}</span>
    {#if outro}
      <!-- PVP e CO-OP na sala rodam no PC de cada um (game/rede.js): não tem imagem -->
      <span class="dica">com {outro.nome} · partida em rede (cada um joga no seu PC)</span>
      <span class="ping" style:color={corDoPing($pingPartida.ms)}>ping {$pingPartida.ms ?? '…'} ms{$pingPartida.rota ? ` (${ROTAS[$pingPartida.rota]})` : ''}</span>
      <span class="dica">servidor: você {$lan.ping ?? '…'} ms · {outro.nome} {outro.ping ?? '…'} ms</span>
    {:else}
      <span class="dica">esperando alguém entrar</span>
    {/if}
    <button onclick={sairSala}>Sair da sala</button>
  </div>
{/if}

<div class="conectar">
  <span class="dica">{ligados.length ? `controles: ${ligados.join(' · ')}${$jogo.numJogadores > 1 && !naSala ? ' · 2 jogadores' : ''}` : 'aperte uma tecla ou um botão do controle para jogar'}</span>
  <button onclick={alternarTelaCheia}>⛶ Tela cheia (F)</button>
</div>

<style>
  .conectar {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .dica {
    color: #888;
    font-size: 12px;
  }

  .lan {
    color: #6dffb0;
    font-size: 13px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .ping {
    font-weight: bold;
  }
</style>
