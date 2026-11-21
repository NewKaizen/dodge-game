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
  import { instalarPopupBau } from '../game/conta/popupBau.js'
  import { instalarEntrada } from '../game/entrada.js'
  import { instalarSegundoPlano } from '../game/segundoPlano.js'
  import { instalarTelaCheia } from '../lib/telaCheia.js'
  import { lan } from '../lib/lan/rede.js'
  import { ligarJogo, pingPartida, ROTAS, corDoPing } from '../lib/lan/transmissao.js'
  import '../lib/lan/controleRemoto.js'
  import { instalarToque } from '../lib/toque.js'
  import { instalarDestravarAudio } from '../lib/destravarAudio.js'
  import ControlesToque from './ControlesToque.svelte'

  let container
  let jogoPhaser = null

  // LAN/ONLINE: a partida numa sala (PVP e CO-OP) roda no PC de cada um
  // (game/rede.js); o ping fica no canto durante a partida (aparece também em tela cheia)
  let emPartidaRemota = $derived($lan.fase === 'sala' && $lan.sala?.emPartida && $lan.sala.membros.length > 1)

  onMount(() => {
    // celular/tablet: os controles na tela (lib/toque.js) e o som destravado no primeiro toque.
    // Antes do jogo: o "modo app" da página (tela inteira) já vale para a primeira medida da resolução
    const desligarToque = instalarToque(() => jogoPhaser)
    const desligarAudio = instalarDestravarAudio()
    const game = new Phaser.Game(criarConfig(container, prepararResolucao()))
    jogoPhaser = game
    const desligar = ligarBridge(game)
    const desligarResolucao = instalarResolucao(game)
    const desligarTelaCheia = instalarTelaCheia(container)
    registrarDebug(game)
    // HUD de desempenho (?perf=1 ou F9; docs/desempenho.md): só no dev ou num build com
    // VITE_FERRAMENTAS_PERF=1; no build normal o import some do pacote
    let desligarHudPerf = () => {}
    let montado = true
    if (import.meta.env.DEV || import.meta.env.VITE_FERRAMENTAS_PERF === '1') {
      import('../game/hudPerf.js').then((m) => {
        if (montado) desligarHudPerf = m.instalarHudPerf(game)
      })
    }
    // canvas preto por perda do contexto WebGL (comum no Firefox em PCs fracos): avisa e deixa recarregar
    let desligarContexto = () => {}
    const vigiar = () => (desligarContexto = vigiarContextoWebgl(game.canvas, container))
    if (game.canvas) vigiar()
    else game.events.once('ready', vigiar)
    const desligarRede = instalarRede(game)
    const desligarAvisos = instalarAvisos()
    const desligarPopupBau = instalarPopupBau(game)
    const desligarEntrada = instalarEntrada(game)
    // aba escondida numa sala ou na campanha: o jogo continua andando (os outros não travam)
    const desligarSegundoPlano = instalarSegundoPlano(game)
    ligarJogo(game)

    return () => {
      montado = false
      desligarHudPerf()
      desligarToque()
      desligarAudio()
      desligarContexto()
      desligarRede()
      desligarAvisos()
      desligarPopupBau()
      desligarEntrada()
      desligarSegundoPlano()
      desligarTelaCheia()
      desligarResolucao()
      desligar()
      game.destroy(true)
    }
  })
</script>

<div class="jogo" bind:this={container}>
  <ControlesToque canvas={() => jogoPhaser?.canvas ?? null} />
  {#if emPartidaRemota}
    <div class="ping" style:color={corDoPing($pingPartida.ms)} title={$pingPartida.rota ? `ligação ${ROTAS[$pingPartida.rota]}` : ''}>
      {$pingPartida.ms ?? '…'} ms{$pingPartida.rota && $pingPartida.rota !== 'direta' ? ` · ${ROTAS[$pingPartida.rota]}` : ''}
    </div>
  {/if}
</div>

<style>
  .jogo {
    position: relative;
    touch-action: none; /* no jogo o dedo é do jogo: sem rolar, sem zoom de pinça ou de toque duplo */
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
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

  .jogo { border: 1px solid var(--color-rule); box-shadow: 0 16px 60px var(--color-shadow); line-height: 0; }
  .jogo :global(canvas) { display: block; }
  .jogo:fullscreen { border: 0; box-shadow: none; }
  :global(html.modo-toque) .jogo { border: 0; box-shadow: none; }
</style>
