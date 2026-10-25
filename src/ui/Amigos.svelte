<script>
  // Amigos: botão na barra, painel por cima do jogo (mesmo estilo do perfil,
  // Conta.svelte) e os convites que chegam (notificação com contagem).
  // Estado e chamadas em lib/amigos.js; convidado vê só "entre com sua conta".
  import { conta } from '../lib/conta.js'
  import { lan } from '../lib/lan/rede.js'
  import { amigos, daSala, pedirAmizade, responderPedido, cancelarPedido, removerAmigo, bloquearJogador, desbloquearJogador, convidarAmigo, responderConvite, limparAviso, copiarTexto, recarregar } from '../lib/amigos.js'
  import { linkDaSala } from '../lib/salaLink.js'
  import { podeEntrarEmSala } from '../game/rede.js'
  import Avatar from './Avatar.svelte'

  const STATUS = { disponivel: 'disponível', em_partida: 'em partida', offline: 'offline' }
  const MODOS = { pvp: 'PVP', coop: 'CO-OP' }

  let aberto = $state(false)
  let tag = $state('')
  let ocupado = $state(false)
  let aviso = $state('')
  let erro = $state('')
  let confirmar = $state(null) // 'bloquear:<id>' | 'remover:<id>' esperando o segundo clique
  let copiado = $state('')
  let agora = $state(Date.now())
  let aceitavel = $state(true)

  let logado = $derived($conta.estado === 'logado' && Boolean($conta.perfil))
  let sala = $derived($lan.sala)
  let conectado = $derived($lan.fase === 'navegando' || $lan.fase === 'sala')
  let souHost = $derived($lan.fase === 'sala' && $lan.papel === 'host')
  let salaCheia = $derived(Boolean(sala) && sala.membros.length >= sala.max)
  let status = (id) => $amigos.presenca[id] ?? 'offline'
  let ordenados = $derived([...$amigos.amigos].sort((a, b) => Number(status(b.id) !== 'offline') - Number(status(a.id) !== 'offline') || a.nome.localeCompare(b.nome)))
  let online = $derived($amigos.amigos.filter((a) => status(a.id) !== 'offline').length)
  let convites = $derived($amigos.convites.filter((c) => c.ate > agora))
  let adicionaveis = $derived($daSala.filter((m) => m.situacao !== 'amigo'))

  // relógio dos convites e da regra "só aceita no menu"
  $effect(() => {
    const t = setInterval(() => {
      agora = Date.now()
      aceitavel = podeEntrarEmSala()
    }, 500)
    return () => clearInterval(t)
  })

  // motivo para o botão CONVIDAR estar apagado ('' = pode)
  function motivoSemConvite(a) {
    if (!conectado) return 'sem conexão com o servidor'
    const s = status(a.id)
    if (s === 'offline') return 'offline'
    if (s === 'em_partida') return 'está numa partida'
    if ($amigos.pendentes[a.id]?.ate > agora) return 'convite enviado: espere a resposta'
    if (sala && !souHost) return 'só o host da sala convida'
    if (sala?.emPartida) return 'a sala está numa partida'
    if (salaCheia) return 'a sala está cheia'
    return ''
  }

  function abrir() {
    aberto = true
    aviso = erro = ''
    confirmar = null
    limparAviso()
    recarregar()
  }
  const fechar = () => (aberto = false)

  async function executar(acao, sucesso = '') {
    ocupado = true
    aviso = erro = ''
    confirmar = null
    const r = await acao()
    ocupado = false
    if (r.ok) aviso = typeof sucesso === 'function' ? sucesso(r) : sucesso
    else erro = r.erro
    return r.ok
  }

  async function adicionar() {
    if (!tag.trim()) return
    const ok = await executar(
      () => pedirAmizade(tag),
      (r) => (r.resultado === 'amigos' ? `agora você e ${r.nome ?? 'essa pessoa'} são amigos` : 'pedido enviado'),
    )
    if (ok) tag = ''
  }

  // dois cliques para ações que não desfazem sozinhas
  function duploClique(chave, acao, sucesso) {
    if (confirmar !== chave) return (confirmar = chave)
    executar(acao, sucesso)
  }

  async function copiar(texto, rotulo) {
    copiado = (await copiarTexto(texto)) ? `${rotulo} copiado` : 'não deu para copiar: selecione e copie à mão'
    setTimeout(() => (copiado = ''), 2500)
  }

  const segundos = (c) => Math.max(0, Math.ceil((c.ate - agora) / 1000))

  // teclas digitadas aqui não chegam ao jogo (simulador, atalhos do Phaser)
  function isolarTeclas(e) {
    e.stopPropagation()
    if (e.key === 'Escape') fechar()
  }
</script>

<div class="barra">
  {#if $conta.estado === 'deslogado'}
    <span class="dica">entre com sua conta para ter amigos</span>
  {:else if logado}
    <button onclick={abrir} title="amigos, pedidos e convites">
      AMIGOS{#if $amigos.recebidos.length} <span class="selo">{$amigos.recebidos.length}</span>{/if}
      <span class="dica">{online} online</span>
    </button>
  {/if}
  {#if sala?.codigo}
    <button onclick={() => copiar(linkDaSala(sala.codigo, location.origin), 'link')} title="o amigo abre o link e cai direto na sua sala">copiar link da sala {sala.codigo}</button>
    {#if copiado && !aberto}<span class="ok">{copiado}</span>{/if}
  {/if}
</div>

{#if convites.length}
  <div class="convites" aria-live="polite">
    {#each convites as c (c.id)}
      <div class="convite" role="alert">
        <Avatar avatar={c.de.avatar} tamanho={32} />
        <div class="texto">
          <strong>{c.de.nome}</strong> convidou você
          <div class="dica">{c.de.tag} · sala {MODOS[c.modo] ?? 'PVP'} · {segundos(c)} s</div>
          {#if !aceitavel}<div class="dica">termine a partida ou volte ao menu para aceitar</div>{/if}
        </div>
        <button onclick={() => responderConvite(c.id, true)} disabled={!aceitavel}>Aceitar</button>
        <button onclick={() => responderConvite(c.id, false)}>Recusar</button>
      </div>
    {/each}
  </div>
{/if}

{#if aberto && logado}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="fundo" role="presentation" onclick={(e) => e.target === e.currentTarget && fechar()} onkeydown={isolarTeclas} onkeyup={(e) => e.stopPropagation()}>
    <div class="painel" role="dialog" aria-modal="true" aria-label="amigos">
      <header>
        <span class="titulo">AMIGOS</span>
        <button onclick={fechar} aria-label="fechar">✕</button>
      </header>

      <h3>Adicionar pela tag</h3>
      <div class="linha">
        <input bind:value={tag} maxlength="20" placeholder="nome#1234" disabled={ocupado} onkeydown={(e) => e.key === 'Enter' && adicionar()} />
        <button onclick={adicionar} disabled={ocupado || !tag.trim()}>Enviar pedido</button>
      </div>
      <span class="dica">sua tag: {$conta.perfil.tag} · está no seu perfil</span>

      {#if erro || $amigos.erro}<p class="erro">{erro || $amigos.erro}</p>{/if}
      {#if aviso || $amigos.aviso}<p class="ok">{aviso || $amigos.aviso}</p>{/if}

      {#if sala?.codigo}
        <h3>Sua sala {sala.codigo}</h3>
        <div class="linha">
          <button onclick={() => copiar(sala.codigo, 'código')}>Copiar código</button>
          <button onclick={() => copiar(linkDaSala(sala.codigo, location.origin), 'link')}>Copiar link</button>
          {#if copiado}<span class="ok">{copiado}</span>{/if}
        </div>
      {/if}

      {#if adicionaveis.length}
        <h3>Na sua sala</h3>
        {#each adicionaveis as m (m.id)}
          <div class="item">
            <Avatar avatar={m.avatar} tamanho={32} />
            <div class="texto"><strong>{m.nome}</strong><div class="dica">{m.tag}</div></div>
            {#if m.situacao === 'enviado'}
              <span class="dica">pedido enviado</span>
            {:else if m.situacao === 'recebido'}
              <span class="dica">já te pediu: veja em Pedidos</span>
            {:else if m.situacao === 'bloqueado'}
              <span class="dica">bloqueado</span>
            {:else}
              <button onclick={() => executar(() => pedirAmizade(m.tag), (r) => (r.resultado === 'amigos' ? `agora você e ${m.nome} são amigos` : `pedido enviado para ${m.nome}`))} disabled={ocupado}>Adicionar amigo</button>
            {/if}
          </div>
        {/each}
      {/if}

      {#if $amigos.recebidos.length}
        <h3>Pedidos recebidos ({$amigos.recebidos.length})</h3>
        {#each $amigos.recebidos as p (p.id)}
          <div class="item">
            <Avatar avatar={p.avatar} tamanho={32} />
            <div class="texto"><strong>{p.nome}</strong><div class="dica">{p.tag} · nv {p.nivel}</div></div>
            <button onclick={() => executar(() => responderPedido(p.id, true), `${p.nome} agora é seu amigo`)} disabled={ocupado}>Aceitar</button>
            <button onclick={() => executar(() => responderPedido(p.id, false), 'pedido recusado')} disabled={ocupado}>Recusar</button>
            <button onclick={() => duploClique(`bloquear:${p.id}`, () => bloquearJogador(p.id), `${p.nome} foi bloqueado`)} disabled={ocupado}>{confirmar === `bloquear:${p.id}` ? 'Confirmar?' : 'Bloquear'}</button>
          </div>
        {/each}
      {/if}

      {#if $amigos.enviados.length}
        <h3>Pedidos enviados ({$amigos.enviados.length})</h3>
        {#each $amigos.enviados as p (p.id)}
          <div class="item">
            <Avatar avatar={p.avatar} tamanho={32} />
            <div class="texto"><strong>{p.nome}</strong><div class="dica">{p.tag} · esperando resposta</div></div>
            <button onclick={() => executar(() => cancelarPedido(p.id), 'pedido cancelado')} disabled={ocupado}>Cancelar</button>
          </div>
        {/each}
      {/if}

      <h3>Amigos ({$amigos.amigos.length}) · {online} online</h3>
      {#each ordenados as a (a.id)}
        {@const s = status(a.id)}
        {@const motivo = motivoSemConvite(a)}
        <div class="item">
          <Avatar avatar={a.avatar} tamanho={32} />
          <span class="ponto {s}" title={STATUS[s]}></span>
          <div class="texto"><strong>{a.nome}</strong><div class="dica">{a.tag} · {STATUS[s]}</div></div>
          <button onclick={() => convidarAmigo(a.id)} disabled={Boolean(motivo)} title={motivo || 'convida para a sua sala (cria uma se precisar)'}>
            {$amigos.pendentes[a.id]?.ate > agora ? 'Convidado' : 'Convidar'}
          </button>
          <button onclick={() => duploClique(`remover:${a.id}`, () => removerAmigo(a.id), `${a.nome} saiu dos seus amigos`)} disabled={ocupado}>{confirmar === `remover:${a.id}` ? 'Confirmar?' : 'Remover'}</button>
          <button onclick={() => duploClique(`bloquear:${a.id}`, () => bloquearJogador(a.id), `${a.nome} foi bloqueado`)} disabled={ocupado}>{confirmar === `bloquear:${a.id}` ? 'Confirmar?' : 'Bloquear'}</button>
        </div>
      {:else}
        <p class="dica">{$amigos.carregando ? 'carregando…' : 'nenhum amigo ainda: mande um pedido pela tag, ou adicione quem estiver na sua sala'}</p>
      {/each}

      {#if $amigos.bloqueados.length}
        <h3>Bloqueados ({$amigos.bloqueados.length})</h3>
        {#each $amigos.bloqueados as b (b.id)}
          <div class="item">
            <Avatar avatar={b.avatar} tamanho={32} />
            <div class="texto"><strong>{b.nome}</strong><div class="dica">{b.tag}</div></div>
            <button onclick={() => executar(() => desbloquearJogador(b.id), `${b.nome} foi desbloqueado`)} disabled={ocupado}>Desbloquear</button>
          </div>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<style>
  .barra {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
  }

  .dica {
    color: #888;
    font-size: 12px;
  }

  .erro {
    color: #f55;
    margin: 4px 0;
  }

  .ok {
    color: #6dffb0;
    margin: 4px 0;
  }

  .selo {
    background: #ff3d6e;
    color: #fff;
    border-radius: 8px;
    padding: 0 6px;
    font-size: 12px;
  }

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
    width: min(640px, 100%);
    max-height: calc(100vh - 32px);
    overflow: auto;
    background: #0d0e1a;
    border: 2px solid #3fd6c8;
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

  h3 {
    margin: 12px 0 4px;
    font-size: 13px;
    color: #ff0;
    letter-spacing: 1px;
  }

  .linha {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  input {
    font-family: monospace;
  }

  .item {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 4px 0;
    border-bottom: 1px solid #1c1e33;
    flex-wrap: wrap;
  }

  .texto {
    flex: 1;
    min-width: 120px;
  }

  .ponto {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #555;
    flex: none;
  }

  .ponto.disponivel {
    background: #6dffb0;
  }

  .ponto.em_partida {
    background: #f2c14e;
  }

  .convites {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 60;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: min(420px, calc(100vw - 24px));
  }

  .convite {
    display: flex;
    gap: 8px;
    align-items: center;
    background: #0d0e1a;
    border: 2px solid #ff0;
    padding: 8px 10px;
    flex-wrap: wrap;
  }
</style>
