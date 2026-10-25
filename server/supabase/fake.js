// Supabase de mentira para os testes (sem rede): só o pedaço da API do
// supabase-js que o servidor usa.
//
//   const sb = criarSupabaseFalso({ usuarios: { 'token-ana': { id, email } }, perfis: [...] })
//   sb.auth.getUser(token)
//   sb.from('perfis').select('...').eq('id', x).maybeSingle() | .single()
//   sb.from('perfis').update({...}).eq('id', x).select('...').single()
//   sb.storage.from('avatares').upload(caminho, buf, opcoes) · remove([caminho]) · getPublicUrl(caminho)
//
// sb.tabelas.perfis, sb.arquivos ('bucket/caminho' -> { dados, opcoes }) e
// sb.chamadas ficam expostos para o teste conferir. sb.falhar = { getUser: true,
// upload: true, ... } faz a operação devolver erro.

const erro = (message) => ({ message })

function consulta(sb, tabela) {
  const filtros = []
  let mudanca = null
  let colunas = null

  const linhas = () => (sb.tabelas[tabela] ?? []).filter((l) => filtros.every(([c, v]) => l[c] === v))
  const projetar = (l) => {
    if (!colunas || colunas === '*') return { ...l }
    return Object.fromEntries(colunas.split(',').map((c) => c.trim()).filter(Boolean).map((c) => [c, l[c] ?? null]))
  }
  const executar = () => {
    if (sb.falhar[tabela]) return { data: null, error: erro(`falha simulada em ${tabela}`) }
    const achadas = linhas()
    if (mudanca) {
      sb.chamadas.push({ op: 'update', tabela, mudanca, filtros: [...filtros] })
      for (const l of achadas) Object.assign(l, mudanca, { atualizado_em: new Date().toISOString() })
    }
    return { data: achadas.map(projetar), error: null }
  }

  const q = {
    select(c = '*') {
      colunas = c
      return q
    },
    update(valores) {
      mudanca = { ...valores }
      return q
    },
    eq(coluna, valor) {
      filtros.push([coluna, valor])
      return q
    },
    async maybeSingle() {
      const r = executar()
      if (r.error) return r
      return { data: r.data[0] ?? null, error: null }
    },
    async single() {
      const r = executar()
      if (r.error) return r
      if (r.data.length !== 1) return { data: null, error: erro('esperava uma linha') }
      return { data: r.data[0], error: null }
    },
    then(ok, falha) {
      return Promise.resolve(executar()).then(ok, falha)
    },
  }
  return q
}

export function criarSupabaseFalso({ usuarios = {}, perfis = [], url = 'https://falso.supabase.co' } = {}) {
  const sb = {
    tabelas: { perfis: perfis.map((p) => ({ ...p })) },
    arquivos: new Map(),
    chamadas: [],
    falhar: {},
    auth: {
      async getUser(token) {
        sb.chamadas.push({ op: 'getUser', token })
        if (sb.falhar.getUser) throw new Error('rede caiu (simulado)')
        const u = usuarios[token]
        if (!u) return { data: { user: null }, error: erro('invalid JWT') }
        return { data: { user: { ...u } }, error: null }
      },
    },
    from: (tabela) => consulta(sb, tabela),
    storage: {
      from(bucket) {
        return {
          async upload(caminho, dados, opcoes = {}) {
            sb.chamadas.push({ op: 'upload', bucket, caminho, opcoes })
            if (sb.falhar.upload) return { data: null, error: erro('falha simulada no upload') }
            sb.arquivos.set(`${bucket}/${caminho}`, { dados, opcoes })
            return { data: { path: caminho }, error: null }
          },
          async remove(caminhos) {
            sb.chamadas.push({ op: 'remove', bucket, caminhos })
            if (sb.falhar.remove) return { data: null, error: erro('falha simulada no remove') }
            for (const c of caminhos) sb.arquivos.delete(`${bucket}/${c}`)
            return { data: caminhos.map((name) => ({ name })), error: null }
          },
          getPublicUrl(caminho) {
            return { data: { publicUrl: `${url}/storage/v1/object/public/${bucket}/${caminho}` } }
          },
        }
      },
    },
  }
  return sb
}
