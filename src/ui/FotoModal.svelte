<script>
  // Foto do perfil: escolher o arquivo, recortar (RecorteFoto.svelte) e enviar.
  // Aberto pela cena Perfil (lib/fotoModal.js); o resto do perfil é Phaser.
  // O teclado fica aqui dentro: as teclas não chegam ao jogo (simulador, atalhos).
  import { fotoModal, concluirFoto } from '../lib/fotoModal.js'
  import { enviarFoto } from '../lib/conta.js'
  import RecorteFoto from './RecorteFoto.svelte'

  const TIPOS_FOTO = ['image/png', 'image/jpeg', 'image/webp']
  const MAX_ARQUIVO = 15 * 1024 * 1024 // a foto original (o recorte que sobe é bem menor)

  let arquivo = $state(null)
  let ocupado = $state(false)
  let erro = $state('')
  let entrada = $state()
  let botaoEscolher = $state()
  let painel = $state()
  let aberto = $derived(Boolean($fotoModal))

  // abriu: zera e tenta abrir o seletor logo (o navegador só deixa se o clique veio de um gesto; senão é o botão)
  $effect(() => {
    if (!aberto) return
    arquivo = null
    erro = ''
    ocupado = false
    queueMicrotask(() => {
      botaoEscolher?.focus()
      try {
        entrada?.click()
      } catch {
        /* sem gesto: fica o botão ESCOLHER FOTO */
      }
    })
  })

  function escolhido(e) {
    const f = e.currentTarget.files?.[0]
    e.currentTarget.value = ''
    erro = ''
    if (!f) return
    if (!TIPOS_FOTO.includes(f.type)) return (erro = 'só PNG, JPEG ou WebP')
    if (f.size > MAX_ARQUIVO) return (erro = 'arquivo grande demais (máximo 15 MB)')
    arquivo = f
  }

  // o foco não pode escapar do modal (senão o Esc e as teclas iriam para o jogo)
  const manterFoco = (e) => !e.relatedTarget && aberto && queueMicrotask(() => painel?.focus())

  async function subir(blob) {
    ocupado = true
    erro = ''
    const r = await enviarFoto(blob)
    ocupado = false
    if (r.ok) concluirFoto({ ok: true, aviso: 'foto atualizada' })
    else erro = r.erro
  }

  const cancelar = () => !ocupado && concluirFoto({ ok: false, cancelado: true })

  function isolarTeclas(e) {
    e.stopPropagation()
    if (e.key === 'Escape') cancelar()
  }
</script>

{#if aberto}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="fundo" role="presentation" onclick={(e) => e.target === e.currentTarget && cancelar()} onkeydown={isolarTeclas} onkeyup={(e) => e.stopPropagation()}>
    <div class="painel" role="dialog" aria-modal="true" aria-label="foto do perfil" tabindex="-1" bind:this={painel} onfocusout={manterFoco}>
      <header>
        <span class="titulo">FOTO DO PERFIL</span>
        <button onclick={cancelar} disabled={ocupado} aria-label="fechar">✕</button>
      </header>
      {#if arquivo}
        <RecorteFoto {arquivo} {ocupado} aoConfirmar={subir} aoCancelar={() => (arquivo = null)} />
      {:else}
        <p class="dica">PNG, JPEG ou WebP · vira um quadrado de 256 px</p>
        <div class="linha">
          <button bind:this={botaoEscolher} onclick={() => entrada.click()}>Escolher foto…</button>
          <button onclick={cancelar}>Cancelar</button>
        </div>
      {/if}
      <input bind:this={entrada} type="file" accept={TIPOS_FOTO.join(',')} hidden onchange={escolhido} />
      {#if erro}<p class="erro" role="alert">{erro}</p>{/if}
    </div>
  </div>
{/if}

<style>
  .fundo {
    position: fixed;
    inset: 0;
    z-index: 70;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .painel {
    outline: none;
    width: min(460px, 100%);
    max-height: calc(100vh - 32px);
    overflow: auto;
    background: #0d0e1a;
    border: 2px solid #6dffb0;
    padding: 12px 16px;
    box-sizing: border-box;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .titulo {
    color: #ff0;
    font-weight: bold;
    letter-spacing: 2px;
  }

  .linha {
    display: flex;
    gap: 8px;
  }

  .dica {
    color: #888;
    font-size: 12px;
  }

  .erro {
    color: #f55;
    margin: 8px 0 0;
  }
</style>
