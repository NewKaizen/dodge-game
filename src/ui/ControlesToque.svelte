<script>
  // Controles na tela do celular/tablet (lib/toque.js, conta em game/toque.js):
  //   - esquerda: joystick FLUTUANTE (nasce onde o polegar encosta; analógico na caixa, direção com
  //     repetição nos menus). Um toque rápido sem arrastar passa para a tela (escolher no menu)
  //   - direita: A e B grandes; C (pausa) pequeno no canto de cima, ao lado da tela cheia
  //   - "gire o celular" com o celular em pé
  // Multitoque: cada dedo é um pointerId (o joystick e o A/B ao mesmo tempo).
  import { toqueUI, dedos, vibrarToque } from '../lib/toque.js'
  import { alternarTelaCheia, telaCheiaSuportada } from '../lib/telaCheia.js'
  import { RAIO_PADRAO } from '../game/toque.js'

  let { canvas = () => null } = $props()

  let estado = $state(dedos.estado())
  const atualizar = () => (estado = dedos.estado())

  let raio = $derived(RAIO_PADRAO * $toqueUI.tamanho)
  let podeTelaCheia = $state(false)
  $effect(() => {
    void $toqueUI.controles
    podeTelaCheia = telaCheiaSuportada()
  })

  // o toque rápido no lado do joystick vira um clique na tela do jogo (os menus do Phaser ouvem o ponteiro)
  function repassar(x, y) {
    const alvo = canvas()
    if (!alvo) return
    const base = { clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, view: window }
    alvo.dispatchEvent(new MouseEvent('mousemove', base))
    alvo.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }))
    alvo.dispatchEvent(new MouseEvent('mouseup', base))
  }

  function apertarStick(e) {
    e.preventDefault()
    if (!dedos.apertar(e.pointerId, 'joystick', e.clientX, e.clientY, e.timeStamp)) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    atualizar()
  }
  function moverStick(e) {
    dedos.mover(e.pointerId, e.clientX, e.clientY)
    atualizar()
  }
  function soltarStick(e) {
    const { tocou } = dedos.soltar(e.pointerId, e.timeStamp)
    atualizar()
    if (tocou && e.type === 'pointerup') repassar(e.clientX, e.clientY)
  }

  function apertarBotao(e, botao) {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dedos.apertar(e.pointerId, botao, e.clientX, e.clientY, e.timeStamp)
    atualizar()
  }
  function soltarBotao(e) {
    dedos.soltar(e.pointerId, e.timeStamp)
    atualizar()
  }

  function telaCheia(e) {
    e.preventDefault()
    e.stopPropagation()
    vibrarToque('botao')
    alternarTelaCheia()
  }

  const semMenu = (e) => e.preventDefault()

  // os eventos de toque (touchstart/end) que nascem nos controles param aqui: o Phaser ouve os toques
  // da janela inteira (inputWindowEvents) e escolheria a opção do menu que está por baixo do polegar.
  // Não pode ser passivo (o Svelte põe touchstart/touchmove como passivos), daí o addEventListener
  let raiz = $state()
  $effect(() => {
    const el = raiz // o bind volta a null quando os controles somem: a limpeza usa este
    if (!el) return
    const parar = (e) => e.cancelable && e.preventDefault()
    const eventos = ['touchstart', 'touchmove', 'touchend', 'touchcancel']
    eventos.forEach((ev) => el.addEventListener(ev, parar, { passive: false }))
    return () => eventos.forEach((ev) => el.removeEventListener(ev, parar))
  })

  // o miolo do joystick não passa da borda
  let pino = $derived.by(() => {
    const j = estado.joystick
    if (!j) return null
    const dx = j.ponto.x - j.origem.x
    const dy = j.ponto.y - j.origem.y
    const d = Math.hypot(dx, dy)
    const k = d > raio ? raio / d : 1
    return { x: j.origem.x + dx * k, y: j.origem.y + dy * k }
  })
</script>

{#if $toqueUI.vertical}
  <div class="gire" role="alert">
    <div class="celular" aria-hidden="true"><span></span></div>
    <p class="titulo">GIRE O CELULAR</p>
    <p class="texto">O DODGE se joga com a tela deitada.</p>
  </div>
{:else if $toqueUI.controles}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="toque" bind:this={raiz} style:--op={$toqueUI.opacidade} style:--t={$toqueUI.tamanho} style:--r="{raio}px" oncontextmenu={semMenu}>
    <div
      class="zona"
      onpointerdown={apertarStick}
      onpointermove={moverStick}
      onpointerup={soltarStick}
      onpointercancel={soltarStick}
    >
      {#if estado.joystick}
        <div class="base ativa" style:left="{estado.joystick.origem.x}px" style:top="{estado.joystick.origem.y}px"></div>
        <div class="pino" style:left="{pino.x}px" style:top="{pino.y}px"></div>
      {:else}
        <div class="base dica" aria-hidden="true"><span>◀ ▲ ▼ ▶</span></div>
      {/if}
    </div>

    {#each [['A', 'confirmar'], ['B', 'voltar']] as [botao, nome] (botao)}
      <button
        class="botao {botao}"
        class:apertado={estado.botoes.has(botao)}
        aria-label="{botao} · {nome}"
        onpointerdown={(e) => apertarBotao(e, botao)}
        onpointerup={soltarBotao}
        onpointercancel={soltarBotao}
        onlostpointercapture={soltarBotao}
        tabindex="-1">{botao}</button
      >
    {/each}

    <div class="canto">
      {#if podeTelaCheia}
        <button class="mini" aria-label="tela cheia" onpointerdown={telaCheia} tabindex="-1">⛶</button>
      {/if}
      <button
        class="mini C"
        class:apertado={estado.botoes.has('C')}
        aria-label="pausa"
        onpointerdown={(e) => apertarBotao(e, 'C')}
        onpointerup={soltarBotao}
        onpointercancel={soltarBotao}
        tabindex="-1">❚❚</button
      >
    </div>
  </div>
{/if}

<style>
  .toque,
  .gire {
    position: fixed;
    inset: 0;
    z-index: 5;
    line-height: 1;
    font-family: 'Pixelify Sans', monospace;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: none;
  }

  .toque {
    pointer-events: none; /* só a zona do joystick e os botões pegam o dedo; o resto vai para o jogo */
    --sl: env(safe-area-inset-left, 0px);
    --sr: env(safe-area-inset-right, 0px);
    --st: env(safe-area-inset-top, 0px);
    --sb: env(safe-area-inset-bottom, 0px);
  }

  .zona {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 42%;
    pointer-events: auto;
    touch-action: none;
  }

  /* moldura em pixel: borda branca de 3px com os cantos "em degrau" (as caixas do jogo) */
  .base,
  .pino,
  .botao,
  .mini {
    position: absolute;
    box-sizing: border-box;
    border: 3px solid #fff;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    opacity: var(--op);
    border-radius: 0;
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.6), inset 0 0 0 2px rgba(0, 0, 0, 0.6); /* contorno preto: lê em fundo claro também */
  }

  .base {
    width: calc(var(--r) * 2);
    height: calc(var(--r) * 2);
    transform: translate(-50%, -50%);
    border-radius: 0;
    background:
      linear-gradient(rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.18)) center / 3px 70% no-repeat,
      linear-gradient(rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.18)) center / 70% 3px no-repeat,
      rgba(0, 0, 0, 0.45);
  }

  /* parado: só um lembrete pequeno de onde fica o joystick */
  .base.dica {
    width: calc(var(--r) * 1.3);
    height: calc(var(--r) * 1.3);
    left: calc(var(--sl) + 14px + var(--r) * 0.65);
    bottom: calc(var(--sb) + 14px);
    top: auto;
    transform: translateX(-50%);
    opacity: calc(var(--op) * 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .base.dica span {
    font-size: calc(9px * var(--t));
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.8);
  }

  .pino {
    width: calc(var(--r) * 0.95);
    height: calc(var(--r) * 0.95);
    transform: translate(-50%, -50%);
    background: #ff2030;
    border-color: #fff;
    opacity: calc(var(--op) + 0.15);
  }

  .botao {
    min-width: 0;
    min-height: 0;
    pointer-events: auto;
    touch-action: none;
    padding: 0;
    font-family: inherit;
    font-weight: 400;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .botao.A {
    width: calc(80px * var(--t));
    height: calc(80px * var(--t));
    right: calc(var(--sr) + 16px);
    bottom: calc(var(--sb) + calc(64px * var(--t)));
    font-size: calc(34px * var(--t));
    color: #ff5a68;
  }

  .botao.B {
    width: calc(66px * var(--t));
    height: calc(66px * var(--t));
    right: calc(var(--sr) + 16px + calc(88px * var(--t)));
    bottom: calc(var(--sb) + 12px);
    font-size: calc(28px * var(--t));
    color: #6fe3ff;
  }

  .botao.apertado,
  .mini.apertado {
    opacity: calc(var(--op) + 0.3);
    transform: translateY(2px);
    color: #000;
  }

  .botao.A.apertado {
    background: #ff5a68;
  }

  .botao.B.apertado {
    background: #6fe3ff;
  }

  /* em coluna no canto: no celular deitado cabe na faixa preta ao lado do jogo (16:9 numa tela mais
     larga) e não cobre o placar de cima; no tablet (4:3) fica na faixa de cima */
  .canto {
    position: absolute;
    top: calc(var(--st) + 6px);
    right: calc(var(--sr) + 6px);
    display: flex;
    flex-direction: column-reverse;
    gap: 6px;
  }

  .mini {
    min-width: 0;
    min-height: 0;
    position: relative;
    pointer-events: auto;
    touch-action: none;
    width: calc(40px * var(--t));
    height: calc(34px * var(--t));
    padding: 0;
    font-size: calc(13px * var(--t));
    font-family: inherit;
    border-width: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mini.C {
    color: #ffd23a;
  }

  .mini.C.apertado {
    background: #ffd23a;
  }

  .gire {
    z-index: 80;
    background: #05060d;
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    text-align: center;
    padding: 24px;
  }

  .gire .titulo {
    margin: 0;
    font-size: 26px;
    letter-spacing: 3px;
    color: #ffd23a;
  }

  .gire .texto {
    margin: 0;
    font-family: 'Trebuchet MS', sans-serif;
    font-size: 16px;
    color: #c9cbe0;
  }

  .celular {
    width: 54px;
    height: 92px;
    border: 4px solid #fff;
    position: relative;
    animation: girar 2.4s steps(6) infinite;
  }

  .celular span {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 14px;
    height: 12px;
    transform: translate(-50%, -50%);
    background: #ff2030;
    clip-path: polygon(0 20%, 25% 0, 50% 20%, 75% 0, 100% 20%, 100% 50%, 50% 100%, 0 50%);
  }

  @keyframes girar {
    0%,
    30% {
      transform: rotate(0deg);
    }
    60%,
    100% {
      transform: rotate(-90deg);
    }
  }
</style>
