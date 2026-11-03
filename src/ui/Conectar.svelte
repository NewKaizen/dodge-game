<script>
  import { onDestroy } from 'svelte'
  import { jogo } from '../lib/estado.js'
  import { conectarSerial, serialSuportado } from '../lib/serial.js'
  import { alternarTelaCheia } from '../lib/telaCheia.js'
  import { lan, sairSala } from '../lib/lan/rede.js'
  import { pingPartida, ROTAS, corDoPing } from '../lib/lan/transmissao.js'

  // modo LAN/ONLINE: na sala o número de jogadores é o da sala (sempre 2)
  let naSala = $derived($lan.fase === 'sala')
  let outros = $derived(($lan.sala?.membros ?? []).filter((m) => m.id !== $lan.eu.id))
  let outro = $derived(outros[0])

  // os controles se ligam sozinhos (game/entrada.js): a primeira tecla, o primeiro botão do
  // controle ou o joystick serial já autorizado. Aqui só um resumo discreto.
  const NOMES = { teclado: 'teclado', gamepad: 'controle', serial: 'joystick serial' }
  let ligados = $derived(Object.keys(NOMES).filter((f) => $jogo.fontes[f]).map((f) => NOMES[f]))

  // botão opcional do joystick USB: só onde o navegador tem Web Serial. O clique é o gesto que o
  // navegador exige para mostrar a janela de escolha da porta (o mesmo pareamento de CONFIGURAÇÕES)
  const podeSerial = serialSuportado()
  let avisoUsb = $state('')
  let tempoAviso
  async function parearUsb() {
    clearTimeout(tempoAviso)
    try {
      await conectarSerial()
      avisoUsb = 'Joystick USB conectado.'
    } catch (e) {
      if (e?.name === 'NotFoundError' || e?.name === 'AbortError') avisoUsb = 'Nenhum joystick escolhido.'
      else if (e?.name === 'SecurityError') avisoUsb = 'Clique de novo: o navegador exige um gesto.'
      else avisoUsb = `Não abriu: ${e?.message ?? e}`
    }
    tempoAviso = setTimeout(() => (avisoUsb = ''), 4000)
  }
  onDestroy(() => clearTimeout(tempoAviso))
</script>

{#if naSala}
  <div class="conectar lan">
    <span>{$lan.online ? `ONLINE · sala ${$lan.sala.codigo}` : `LAN · ${$lan.sala.nome}`} · você é {$lan.papel === 'host' ? 'o HOST da partida' : 'CONVIDADO'}</span>
    {#if outro}
      <!-- PVP e CO-OP na sala rodam no PC de cada um (game/rede.js): não tem imagem -->
      <span class="dica">com {outros.map((m) => m.nome).join(', ')} · partida em rede (cada um joga no seu PC)</span>
      <span class="ping" style:color={corDoPing($pingPartida.ms)}>ping {$pingPartida.ms ?? '…'} ms{$pingPartida.rota ? ` (${ROTAS[$pingPartida.rota]})` : ''}</span>
      <span class="dica">servidor: você {$lan.ping ?? '…'} ms{#each outros as o} · {o.nome} {o.ping ?? '…'} ms{/each}</span>
    {:else}
      <span class="dica">esperando alguém entrar</span>
    {/if}
    <button onclick={sairSala}>Sair da sala</button>
  </div>
{/if}

<div class="conectar">
  <span class="dica">{ligados.length ? `controles: ${ligados.join(' · ')}${$jogo.numJogadores > 1 && !naSala ? ' · 2 jogadores' : ''}` : 'aperte uma tecla ou um botão do controle para jogar'}</span>
  {#if podeSerial}
    <button onclick={parearUsb} title="Pareia um joystick USB (porta serial)">🔌 Joystick USB</button>
  {/if}
  {#if avisoUsb}<span class="dica" role="status">{avisoUsb}</span>{/if}
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
