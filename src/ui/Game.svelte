<script>
  import { onMount } from 'svelte'
  import Phaser from 'phaser'
  import { criarConfig } from '../game/config.js'
  import { prepararResolucao, instalarResolucao } from '../game/resolucao.js'
  import { ligarBridge } from '../game/bridge.js'
  import { registrarDebug } from '../game/debug.js'
  import { vigiarContextoWebgl } from '../game/contextoPerdido.js'
  import { instalarRede } from '../game/rede.js'
  import { instalarAvisos } from '../game/conta/avisos.js'
  import { instalarTelaCheia } from '../lib/telaCheia.js'
  import { lan } from '../lib/lan/rede.js'
  import { ligarJogo, pingPartida, ROTAS, corDoPing } from '../lib/lan/transmissao.js'
  import '../lib/lan/controleRemoto.js'

  let container

  // LAN/ONLINE: a partida numa sala (PVP e CO-OP) roda no PC de cada um
  // (game/rede.js); o ping fica no canto durante a partida (aparece também em tela cheia)
  let emPartidaRemota = $derived($lan.fase === 'sala' && $lan.sala?.emPartida && $lan.sala.membros.length > 1)

  onMount(() => {
    const game = new Phaser.Game(criarConfig(container, prepararResolucao()))
    const desligar = ligarBridge(game)
    const desligarResolucao = instalarResolucao(game)
    const desligarTelaCheia = instalarTelaCheia(container)
    registrarDebug(game)
    // canvas preto por perda do contexto WebGL (comum no Firefox em PCs fracos): avisa e deixa recarregar
    let desligarContexto = () => {}
    const vigiar = () => (desligarContexto = vigiarContextoWebgl(game.canvas, container))
    if (game.canvas) vigiar()
    else game.events.once('ready', vigiar)
    const desligarRede = instalarRede(game)
    const desligarAvisos = instalarAvisos()
    ligarJogo(game)

    return () => {
      desligarContexto()
      desligarRede()
      desligarAvisos()
      desligarTelaCheia()
      desligarResolucao()
      desligar()
      game.destroy(true)
    }
  })
</script>

<div class="jogo" bind:this={container}>
  {#if emPartidaRemota}
    <div class="ping" style:color={corDoPing($pingPartida.ms)} title={$pingPartida.rota ? `ligação ${ROTAS[$pingPartida.rota]}` : ''}>
      {$pingPartida.ms ?? '…'} ms{$pingPartida.rota && $pingPartida.rota !== 'direta' ? ` · ${ROTAS[$pingPartida.rota]}` : ''}
    </div>
  {/if}
</div>

<style>
  .jogo {
    position: relative;
  }

  .jogo:fullscreen {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
  }

  .ping {
    position: absolute;
    right: 6px;
    bottom: 6px;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.6);
    font-size: 12px;
    pointer-events: none;
    z-index: 2;
  }
</style>
