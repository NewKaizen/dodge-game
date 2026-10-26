<script>
  // "Denunciar" no cartão de outro jogador (lista de amigos, pedidos, sala):
  // escolhe nome ou foto e o motivo. Quem revisa vê no scripts/moderar.js
  // (docs/moderacao.md). Não aparece para si mesmo.
  import { MOTIVOS, denunciar } from '../lib/moderacao.js'

  let { tag, nome, temFoto = false } = $props()

  let aberto = $state(false)
  let tipo = $state('nome')
  let motivo = $state('')
  let ocupado = $state(false)
  let erro = $state('')
  let feito = $state(false)

  function abrir() {
    aberto = true
    erro = ''
    motivo = ''
    tipo = 'nome'
  }

  async function enviar() {
    ocupado = true
    erro = ''
    const r = await denunciar(tag, tipo, motivo)
    ocupado = false
    if (r.ok) {
      feito = true
      aberto = false
    } else erro = r.erro
  }
</script>

{#if feito}
  <span class="ok" role="status">denúncia enviada: obrigado</span>
{:else}
  <button class="fraco" onclick={() => (aberto ? (aberto = false) : abrir())} disabled={ocupado} title="denunciar o nome ou a foto de {nome}">Denunciar…</button>
{/if}

{#if aberto}
  <div class="form">
    <div class="linha">
      <span class="dica">denunciar de {nome}:</span>
      <label><input type="radio" bind:group={tipo} value="nome" disabled={ocupado} /> o nome</label>
      {#if temFoto}<label><input type="radio" bind:group={tipo} value="foto" disabled={ocupado} /> a foto</label>{/if}
    </div>
    <div class="linha">
      <select bind:value={motivo} disabled={ocupado} aria-label="motivo da denúncia">
        <option value="">escolha o motivo…</option>
        {#each MOTIVOS as m (m.id)}<option value={m.id}>{m.rotulo}</option>{/each}
      </select>
      <button onclick={enviar} disabled={ocupado || !motivo}>Enviar denúncia</button>
      <button onclick={() => (aberto = false)} disabled={ocupado}>Cancelar</button>
    </div>
    <span class="dica">a equipe analisa; denúncia falsa repetida pode limitar a sua conta</span>
    {#if erro}<span class="erro" role="alert">{erro}</span>{/if}
  </div>
{/if}

<style>
  .form {
    flex-basis: 100%;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
    background: #14162a;
    border-left: 2px solid #ff3d6e;
  }

  .linha {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .dica {
    color: #888;
    font-size: 12px;
  }

  .erro {
    color: #f55;
    font-size: 12px;
  }

  .ok {
    color: #6dffb0;
    font-size: 12px;
  }

  select {
    font-family: monospace;
  }

  label {
    font-size: 13px;
  }
</style>
