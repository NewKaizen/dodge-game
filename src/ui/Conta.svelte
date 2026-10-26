<script>
  // Conta do jogador: barra com o login Google (ou o avatar e o nome) e o
  // painel do perfil por cima do jogo. Estado em lib/conta.js; sem contas no
  // servidor mostra "contas indisponíveis" e o jogo segue como convidado.
  import { conta, entrarComGoogle, sairDaConta, mudarNomeExibicao, escolherAvatar, enviarFoto, removerFoto } from '../lib/conta.js'
  import { AVATARES_JOGO, avatarDoPerfil, NOME_MAX } from '../lib/contaRegras.js'
  import { progressoDoXp, nomeDoItem, corDaMoldura } from '../lib/progresso.js'
  import Avatar from './Avatar.svelte'
  import Colecao from './Colecao.svelte'
  import RecorteFoto from './RecorteFoto.svelte'

  const TIPOS_FOTO = ['image/png', 'image/jpeg', 'image/webp']
  const MAX_ARQUIVO = 15 * 1024 * 1024 // a foto original (o recorte que sobe é bem menor)
  const NOMES = { kris: 'Kris', susie: 'Susie', ralsei: 'Ralsei', noelle: 'Noelle', berdly: 'Berdly', dess: 'Dess', asriel: 'Asriel' }

  let aberto = $state(false)
  let nome = $state('')
  let editandoNome = $state(false)
  let arquivo = $state(null)
  let ocupado = $state(false)
  let aviso = $state('')
  let erro = $state('')
  let entradaArquivo = $state()

  let perfil = $derived($conta.perfil)
  let avatar = $derived(avatarDoPerfil(perfil))
  // perfil.xp é o total acumulado; a barra é a do nível atual (lib/progresso.js)
  let prog = $derived(progressoDoXp(perfil?.xp))
  let moldura = $derived(corDaMoldura(perfil?.moldura_equipada))
  let colecao = $state(false)
  let est = $derived($conta.estatisticas ?? { partidas: 0, vitorias: 0, personagem_favorito: null })

  function abrir() {
    aberto = true
    erro = aviso = ''
    editandoNome = false
    arquivo = null
  }
  const fechar = () => !ocupado && (aberto = false)

  async function executar(acao, sucesso) {
    ocupado = true
    erro = aviso = ''
    const r = await acao()
    ocupado = false
    if (r.ok) aviso = sucesso
    else erro = r.erro
    return r.ok
  }

  async function salvarNome() {
    if (await executar(() => mudarNomeExibicao(nome), 'nome salvo')) editandoNome = false
  }

  function escolherArquivo(e) {
    const f = e.currentTarget.files?.[0]
    e.currentTarget.value = ''
    erro = aviso = ''
    if (!f) return
    if (!TIPOS_FOTO.includes(f.type)) return (erro = 'só PNG, JPEG ou WebP')
    if (f.size > MAX_ARQUIVO) return (erro = 'arquivo grande demais (máximo 15 MB)')
    arquivo = f
  }

  async function subirFoto(blob) {
    if (await executar(() => enviarFoto(blob), 'foto atualizada')) arquivo = null
  }

  // teclas digitadas aqui não chegam ao jogo (simulador, atalhos do Phaser)
  function isolarTeclas(e) {
    e.stopPropagation()
    if (e.key === 'Escape') fechar()
  }
</script>

<div class="barra">
  {#if $conta.estado === 'indisponivel'}
    <span class="dica">contas indisponíveis neste servidor · jogando como convidado</span>
  {:else if $conta.estado === 'carregando'}
    <span class="dica">conta: carregando…</span>
  {:else if $conta.estado === 'deslogado'}
    <button onclick={entrarComGoogle}>Entrar com Google</button>
    <span class="dica">convidado: crie conta para salvar progresso</span>
  {:else}
    <span class="eu" title="você">
      <Avatar {avatar} tamanho={22} {moldura} />
      <span>{perfil?.nome_exibicao ?? 'perfil'}</span>
      {#if perfil}<span class="dica">#{perfil.tag.split('#')[1]} · nv {perfil.nivel}</span>{/if}
    </span>
    <!-- o PERFIL, a COLEÇÃO e os AMIGOS (Amigos.svelte) ficam juntos aqui; JOGAR fica na tela ONLINE do jogo -->
    <button onclick={abrir} disabled={!perfil} title="seu perfil: nome, foto e estatísticas">PERFIL</button>
    <button onclick={() => (colecao = true)} disabled={!perfil} title="títulos, molduras, versos e avatares que você ganhou">COLEÇÃO</button>
  {/if}
  {#if $conta.erro && !aberto}<span class="erro">{$conta.erro}</span>{/if}
</div>

{#if colecao && perfil}
  <Colecao aoFechar={() => (colecao = false)} />
{:else if aberto && perfil}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="fundo" role="presentation" onclick={(e) => e.target === e.currentTarget && fechar()} onkeydown={isolarTeclas} onkeyup={(e) => e.stopPropagation()}>
    <div class="painel" role="dialog" aria-modal="true" aria-label="perfil">
      <header>
        <span class="titulo">PERFIL</span>
        <button onclick={fechar} disabled={ocupado} aria-label="fechar">✕</button>
      </header>

      <div class="colunas">
        <section class="cartao">
          <Avatar {avatar} tamanho={96} {moldura} />
          <div class="nome">{perfil.nome_exibicao}</div>
          <div class="dica" title="seu identificador (os amigos acham você por ele)">{perfil.tag}</div>
          <div class="titulo-eq">{nomeDoItem(perfil.titulo_equipado) ?? 'sem título'}</div>
          <div class="nivel">NÍVEL {perfil.nivel}</div>
          <div class="xp" title="{prog.noNivel} / {prog.paraProximo} XP ({perfil.xp} no total)">
            <div class="xp-cheio" style:width="{Math.min(100, (prog.noNivel / prog.paraProximo) * 100)}%"></div>
          </div>
          <div class="dica">{prog.noNivel} / {prog.paraProximo} XP</div>
          <button onclick={() => (colecao = true)} disabled={ocupado}>Coleção…</button>
          <dl class="stats">
            <dt>partidas</dt><dd>{est.partidas}</dd>
            <dt>vitórias</dt><dd>{est.vitorias}</dd>
            <dt>favorito</dt><dd>{NOMES[est.personagem_favorito] ?? '—'}</dd>
          </dl>
        </section>

        <section class="edicao">
          <h3>Nome</h3>
          {#if editandoNome}
            <div class="linha">
              <input bind:value={nome} maxlength={NOME_MAX} placeholder="3 a 16 letras" disabled={ocupado} onkeydown={(e) => e.key === 'Enter' && salvarNome()} />
              <button onclick={salvarNome} disabled={ocupado}>Salvar</button>
              <button onclick={() => (editandoNome = false)} disabled={ocupado}>Cancelar</button>
            </div>
          {:else}
            <button onclick={() => ((nome = perfil.nome_exibicao), (editandoNome = true))} disabled={ocupado}>Mudar nome</button>
          {/if}

          <h3>Avatar</h3>
          {#if arquivo}
            <RecorteFoto {arquivo} {ocupado} aoConfirmar={subirFoto} aoCancelar={() => (arquivo = null)} />
          {:else}
            <div class="grade">
              <button class="opcao" class:ativo={avatar.tipo === 'padrao'} disabled={ocupado} title="padrão" onclick={() => executar(() => escolherAvatar('padrao'), 'avatar trocado')}>
                <Avatar avatar={{ tipo: 'padrao' }} tamanho={36} />
              </button>
              {#each AVATARES_JOGO as id}
                <button class="opcao" class:ativo={avatar.tipo === 'jogo' && avatar.id === id} disabled={ocupado} title={NOMES[id]} onclick={() => executar(() => escolherAvatar('jogo', id), 'avatar trocado')}>
                  <Avatar avatar={{ tipo: 'jogo', id }} tamanho={36} />
                </button>
              {/each}
              {#if perfil.avatar_url}
                <button class="opcao" class:ativo={avatar.tipo === 'enviado'} disabled={ocupado} title="sua foto" onclick={() => executar(() => escolherAvatar('enviado'), 'avatar trocado')}>
                  <Avatar avatar={{ tipo: 'enviado', url: perfil.avatar_url }} tamanho={36} />
                </button>
              {/if}
            </div>
            <div class="linha">
              <button onclick={() => entradaArquivo.click()} disabled={ocupado}>Enviar foto…</button>
              {#if perfil.avatar_url}
                <button onclick={() => executar(removerFoto, 'foto removida')} disabled={ocupado}>Remover foto</button>
              {/if}
              <input bind:this={entradaArquivo} type="file" accept={TIPOS_FOTO.join(',')} hidden onchange={escolherArquivo} />
            </div>
            <span class="dica">PNG, JPEG ou WebP · vira um quadrado de 256 px</span>
          {/if}

          {#if erro}<p class="erro">{erro}</p>{/if}
          {#if aviso}<p class="ok">{aviso}</p>{/if}

          <div class="rodape">
            <button onclick={() => ((aberto = false), sairDaConta())} disabled={ocupado}>Sair da conta</button>
          </div>
        </section>
      </div>
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

  .eu {
    display: flex;
    gap: 6px;
    align-items: center;
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
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .titulo {
    color: #ff0;
    font-weight: bold;
    letter-spacing: 2px;
  }

  .colunas {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }

  .cartao {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 200px;
  }

  .nome {
    font-size: 18px;
    font-weight: bold;
    margin-top: 6px;
  }

  .titulo-eq {
    color: #c9a2ff;
    font-size: 12px;
  }

  .nivel {
    color: #ff0;
    margin-top: 6px;
  }

  .xp {
    width: 180px;
    height: 8px;
    border: 1px solid #6dffb0;
    background: #16182a;
  }

  .xp-cheio {
    height: 100%;
    background: #6dffb0;
  }

  .stats {
    display: grid;
    grid-template-columns: auto auto;
    gap: 2px 12px;
    margin: 8px 0 0;
    font-size: 13px;
  }

  .stats dt {
    color: #888;
  }

  .stats dd {
    margin: 0;
    text-align: right;
  }

  .edicao {
    flex: 1;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }

  h3 {
    margin: 6px 0 0;
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

  .grade {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .opcao {
    padding: 2px;
    line-height: 0;
  }

  .opcao.ativo {
    outline: 2px solid #ff0;
  }

  .rodape {
    margin-top: auto;
    padding-top: 10px;
  }
</style>
