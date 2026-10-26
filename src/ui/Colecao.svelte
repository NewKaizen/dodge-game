<script>
  // Coleção (Fase 1D): a trilha de cosméticos, o que a conta tem e o que falta
  // (com o nível), e equipar título, moldura, verso e avatar. Overlay mínimo no
  // estilo do perfil; a versão dentro do jogo vem na consolidação. O banco
  // confere se a conta tem o item (equipar, 0003_progresso.sql); cosmético
  // nunca muda nada na partida.
  //   <Colecao aoFechar={fn} />
  import { onMount } from 'svelte'
  import { conta, carregarInventario, equipar } from '../lib/conta.js'
  import { CATALOGO, TIPOS_ITEM, NOME_TIPO, corDaMoldura, progressoDoXp } from '../lib/progresso.js'
  import { avatarDoPerfil } from '../lib/contaRegras.js'
  import Avatar from './Avatar.svelte'

  let { aoFechar = () => {} } = $props()

  let ocupado = $state(false)
  let erro = $state('')
  let aviso = $state('')

  let perfil = $derived($conta.perfil)
  let tem = $derived($conta.inventario ?? new Set())
  let nivel = $derived(progressoDoXp(perfil?.xp).nivel)

  onMount(() => {
    carregarInventario()
  })

  const possui = (item) => item.padrao || tem.has(item.id)
  // o que está equipado de cada tipo (sem título/moldura/verso = o padrão)
  function equipado(item) {
    if (!perfil) return false
    if (item.tipo === 'titulo') return perfil.titulo_equipado === item.id
    if (item.tipo === 'moldura') return (perfil.moldura_equipada ?? 'moldura.simples') === item.id
    if (item.tipo === 'verso') return (perfil.verso_equipado ?? 'verso.classico') === item.id
    return perfil.avatar_tipo === 'jogo' && perfil.avatar_id === item.id.split('.')[1]
  }

  async function usar(item) {
    if (ocupado || !possui(item)) return
    ocupado = true
    erro = aviso = ''
    // clicar no título já equipado tira o título
    const tirar = item.tipo === 'titulo' && equipado(item)
    const r = await equipar(item.tipo, tirar ? null : item.id)
    ocupado = false
    if (r.ok) aviso = tirar ? 'título removido' : `${item.nome} equipado`
    else erro = r.erro
  }

  function isolarTeclas(e) {
    e.stopPropagation()
    if (e.key === 'Escape' && !ocupado) aoFechar()
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="fundo" role="presentation" onclick={(e) => e.target === e.currentTarget && !ocupado && aoFechar()} onkeydown={isolarTeclas} onkeyup={(e) => e.stopPropagation()}>
  <div class="painel" role="dialog" aria-modal="true" aria-label="coleção">
    <header>
      <span class="titulo">COLEÇÃO</span>
      <span class="dica">nível {nivel} · {CATALOGO.filter(possui).length}/{CATALOGO.length} itens</span>
      <button onclick={aoFechar} disabled={ocupado} aria-label="fechar">✕</button>
    </header>

    {#if $conta.inventario === null}<p class="dica">carregando o inventário…</p>{/if}

    {#each TIPOS_ITEM as tipo}
      <h3>{NOME_TIPO[tipo].toUpperCase()}</h3>
      <div class="grade">
        {#each CATALOGO.filter((i) => i.tipo === tipo) as item (item.id)}
          <button class="item" class:ativo={equipado(item)} class:bloqueado={!possui(item)} disabled={ocupado || !possui(item)} title={possui(item) ? (equipado(item) ? 'equipado' : 'equipar') : `libera no nível ${item.nivel}`} onclick={() => usar(item)}>
            {#if tipo === 'avatar'}
              <Avatar avatar={{ tipo: 'jogo', id: item.id.split('.')[1] }} tamanho={36} moldura={corDaMoldura(perfil?.moldura_equipada)} />
            {:else if tipo === 'moldura'}
              <Avatar avatar={avatarDoPerfil(perfil)} tamanho={36} moldura={item.cor} />
            {:else if tipo === 'verso'}
              <span class="verso" style:background={item.cor}><span class="naipe">♠</span></span>
            {:else}
              <span class="nome-titulo">{item.nome}</span>
            {/if}
            <span class="rotulo">{tipo === 'titulo' ? '' : item.nome}</span>
            <span class="dica">{possui(item) ? (equipado(item) ? 'equipado' : item.padrao ? 'padrão' : 'seu') : `nível ${item.nivel}`}</span>
          </button>
        {/each}
      </div>
    {/each}

    <p class="dica">O verso das cartas aparece aqui por enquanto; nas cartas da partida ele entra numa próxima versão. Cosméticos não mudam nada no jogo.</p>
    {#if erro}<p class="erro">{erro}</p>{/if}
    {#if aviso}<p class="ok">{aviso}</p>{/if}
  </div>
</div>

<style>
  .fundo {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .painel {
    width: min(854px, 100%);
    max-height: calc(100vh - 32px);
    overflow: auto;
    background: #0d0e1a;
    border: 2px solid #6dffb0;
    padding: 12px 16px;
    box-sizing: border-box;
  }

  header {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 4px;
  }

  header button {
    margin-left: auto;
  }

  .titulo {
    color: #ff0;
    font-weight: bold;
    letter-spacing: 2px;
  }

  h3 {
    margin: 10px 0 4px;
    font-size: 13px;
    color: #ff0;
    letter-spacing: 1px;
  }

  .grade {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 84px;
    padding: 4px 6px;
  }

  .item.ativo {
    outline: 2px solid #ff0;
  }

  .item.bloqueado {
    opacity: 0.45;
  }

  .nome-titulo {
    color: #c9a2ff;
    font-size: 13px;
    min-height: 36px;
    display: flex;
    align-items: center;
  }

  .verso {
    width: 26px;
    height: 36px;
    border: 2px solid #fff;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .naipe {
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
  }

  .rotulo {
    font-size: 12px;
  }

  .dica {
    color: #888;
    font-size: 11px;
  }

  .erro {
    color: #f55;
    margin: 4px 0;
  }

  .ok {
    color: #6dffb0;
    margin: 4px 0;
  }
</style>
