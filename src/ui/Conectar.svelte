<script>
  import { jogo, MAX_JOGADORES } from '../lib/estado.js'
  import { conectarSerial, desconectarSerial } from '../lib/serial.js'
  import { despedir } from '../lib/saida.js'
  import { iniciarSimulador, pararSimulador } from '../lib/simulador.js'
  import { alternarTelaCheia } from '../lib/telaCheia.js'
  import { lan, sairSala } from '../lib/lan/rede.js'
  import { tela } from '../lib/lan/transmissao.js'

  // modo LAN: na sala o número de jogadores é o da sala (sempre 2)
  let naSala = $derived($lan.fase === 'sala')
  let outro = $derived($lan.sala?.membros.find((m) => m.id !== $lan.eu.id))
  const ESTADOS = { parada: 'sem imagem', conectando: 'ligando a imagem…', 'ao-vivo': 'imagem ao vivo', reserva: 'imagem reserva (sem som)' }

  let erro = $state('')

  async function conectar() {
    erro = ''
    try {
      await conectarSerial()
    } catch (e) {
      erro = e.message
    }
  }

  async function desconectar() {
    await despedir() // DISCONNECT antes de fechar a porta
    await desconectarSerial()
  }
</script>

<div class="conectar">
  <span>Jogadores:</span>
  {#each Array.from({ length: MAX_JOGADORES }, (_, i) => i + 1) as n}
    <button class:ativo={$jogo.numJogadores === n} disabled={naSala} onclick={() => ($jogo.numJogadores = n)}>{n}</button>
  {/each}
  <span class="dica">(vale a partir da próxima partida)</span>
</div>

{#if naSala}
  <div class="conectar lan">
    <span>LAN · {$lan.sala.nome} · você é {$lan.papel === 'host' ? 'o HOST (P1)' : 'o CONVIDADO (P2)'}</span>
    {#if outro}
      <span class="dica">com {outro.nome}{outro.ping != null ? ` · ${outro.ping} ms` : ''} · {ESTADOS[$tela.estado]}</span>
    {:else}
      <span class="dica">esperando alguém entrar</span>
    {/if}
    <button onclick={sairSala}>Sair da sala</button>
  </div>
{/if}

<div class="conectar">
  {#if $jogo.conectado}
    <span>Conectado ({$jogo.fonte})</span>
    {#if $jogo.fonte === 'simulador'}
      <button onclick={pararSimulador}>Parar simulador</button>
    {:else if $jogo.fonte === 'serial'}
      <button onclick={desconectar}>Desconectar joystick</button>
    {/if}
  {:else}
    <button onclick={conectar}>Conectar joystick</button>
    <button onclick={() => iniciarSimulador()}>Simulador (teclado)</button>
  {/if}
  <button onclick={alternarTelaCheia}>⛶ Tela cheia (F)</button>
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

  .lan {
    color: #6dffb0;
    font-size: 13px;
  }
</style>
