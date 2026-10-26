// Supabase de mentira para os testes (sem rede): só o pedaço da API do
// supabase-js que o servidor usa.
//
//   const sb = criarSupabaseFalso({ usuarios: { 'token-ana': { id, email } }, perfis: [...] })
//   sb.auth.getUser(token)
//   sb.from('perfis').select('...').eq('id', x).maybeSingle() | .single()
//   sb.from('perfis').update({...}).eq('id', x).select('...').single()
//   (também .in(coluna, lista), .order(coluna, { ascending }) e .limit(n); tabela denuncias para a moderação)
//   sb.storage.from('avatares').upload(caminho, buf, opcoes) · remove([caminho]) · getPublicUrl(caminho)
//
//   sb.rpc('registrar_partida' | 'encerrar_partida' | 'conceder_recompensa', args)
//     (Fase 1D) a mesma regra das funções de 0003_progresso.sql, em JS (com o
//     espelho src/lib/progresso.js); sb.diaDe(t) diz o "dia" do limite de repetição
//
// sb.tabelas.perfis, sb.arquivos ('bucket/caminho' -> { dados, opcoes }) e
// sb.chamadas ficam expostos para o teste conferir. sb.falhar = { getUser: true,
// upload: true, conceder_recompensa: true, ... } faz a operação devolver erro.

import { xpDaPartida, nivelDoXp, itensAte, RESULTADOS_JOGADOS } from '../../src/lib/progresso.js'

const erro = (message) => ({ message })

function consulta(sb, tabela) {
  const filtros = []
  const listas = []
  let ordem = null
  let maximo = Infinity
  let mudanca = null
  let colunas = null

  const linhas = () => {
    const achadas = (sb.tabelas[tabela] ?? []).filter((l) => filtros.every(([c, v]) => l[c] === v) && listas.every(([c, vs]) => vs.includes(l[c])))
    if (ordem) achadas.sort((a, b) => (a[ordem.coluna] < b[ordem.coluna] ? -1 : a[ordem.coluna] > b[ordem.coluna] ? 1 : 0) * (ordem.subindo ? 1 : -1))
    return achadas.slice(0, maximo)
  }
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
    in(coluna, valores) {
      listas.push([coluna, valores])
      return q
    },
    order(coluna, { ascending = true } = {}) {
      ordem = { coluna, subindo: ascending }
      return q
    },
    limit(n) {
      maximo = n
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

// ---------- funções do progresso (espelho de 0003_progresso.sql) ----------

function rpcs(sb) {
  const t = sb.tabelas
  const agora = () => new Date(sb.agora())
  return {
    registrar_partida({ p_id, p_modo, p_versao, p_sala_tipo, p_participantes }) {
      if (t.partidas.some((p) => p.id === p_id)) return null
      t.partidas.push({ id: p_id, modo: p_modo ?? 'pvp', versao: p_versao, casual: p_sala_tipo === 'casual', sala_tipo: p_sala_tipo, estado: 'iniciada', iniciada_em: agora().toISOString(), validacao: null, vencedor_lado: null, duracao_s: null, rodadas: null })
      for (const e of p_participantes ?? []) {
        const uid = t.perfis.some((p) => p.id === e.user_id) ? e.user_id : null
        t.partida_participantes.push({ partida_id: p_id, lado: e.lado, user_id: uid, personagem: null, resultado: null, relato: null, relatado_em: null })
      }
      return null
    },
    encerrar_partida({ p_id, p_validacao, p_vencedor_lado, p_motivo, p_duracao_s, p_rodadas, p_participantes }) {
      const p = t.partidas.find((x) => x.id === p_id)
      if (!p) throw new Error('partida não existe')
      if (p.estado !== 'iniciada') return p.estado
      if (!['validada', 'contestada', 'encerrada'].includes(p_validacao)) throw new Error('validação inválida')
      for (const e of p_participantes ?? []) {
        const pp = t.partida_participantes.find((x) => x.partida_id === p_id && x.lado === e.lado)
        if (pp) Object.assign(pp, { resultado: e.resultado, personagem: e.personagem ?? null, relato: e.relato ?? null, relatado_em: e.relatado_em ?? null })
      }
      Object.assign(p, { estado: p_validacao, validacao: p_validacao, vencedor_lado: p_vencedor_lado, motivo_termino: p_motivo, duracao_s: p_duracao_s, rodadas: p_rodadas, encerrada_em: agora().toISOString() })
      return p_validacao
    },
    conceder_recompensa({ p_partida }) {
      sb.concederChamadas++
      const p = t.partidas.find((x) => x.id === p_partida)
      if (!p) throw new Error('partida não existe')
      if (['validada', 'contestada'].includes(p.estado)) {
        const dia = sb.diaDe(sb.agora())
        const lados = t.partida_participantes.filter((x) => x.partida_id === p_partida)
        for (const pp of lados.filter((x) => x.user_id).sort((a, b) => (a.user_id < b.user_id ? -1 : 1))) {
          const perfil = t.perfis.find((x) => x.id === pp.user_id)
          if (!perfil) continue
          if (t.concessoes.some((c) => c.partida_id === p_partida && c.user_id === pp.user_id)) continue
          const oponente = lados.find((x) => x.lado !== pp.lado)?.user_id ?? null
          const repeticoes = t.concessoes.filter((c) => c.user_id === pp.user_id && c.xp > 0 && sb.diaDe(c.criada_em) === dia && c.oponente_id === oponente).length
          const { xp, motivo } = xpDaPartida({ resultado: pp.resultado, duracaoS: p.duracao_s, rodadas: p.rodadas, repeticoes })
          const total = (perfil.xp ?? 0) + xp
          const nivel = nivelDoXp(total)
          const tem = new Set(t.inventario.filter((i) => i.user_id === pp.user_id).map((i) => i.item_id))
          const novos = itensAte(nivel).filter((i) => !tem.has(i.id)).map((i) => i.id)
          for (const item_id of novos) t.inventario.push({ user_id: pp.user_id, item_id, obtido_em: agora().toISOString() })
          t.concessoes.push({ partida_id: p_partida, user_id: pp.user_id, xp, motivo, itens: novos, xp_total: total, nivel_antes: perfil.nivel ?? 1, nivel_depois: nivel, oponente_id: oponente, criada_em: sb.agora() })
          Object.assign(perfil, { xp: total, nivel })
          if (RESULTADOS_JOGADOS.includes(pp.resultado)) {
            let est = t.estatisticas_basicas.find((e) => e.usuario_id === pp.user_id)
            if (!est) t.estatisticas_basicas.push((est = { usuario_id: pp.user_id, partidas: 0, vitorias: 0, personagem_favorito: null }))
            est.partidas++
            if (pp.resultado === 'vitoria') est.vitorias++
            const usos = new Map()
            for (const x of t.partida_participantes) if (x.user_id === pp.user_id && x.personagem && RESULTADOS_JOGADOS.includes(x.resultado)) usos.set(x.personagem, (usos.get(x.personagem) ?? 0) + 1)
            const fav = [...usos].sort((a, b) => b[1] - a[1])[0]
            if (fav) est.personagem_favorito = fav[0]
          }
        }
        p.estado = 'recompensada'
      } else if (p.estado !== 'recompensada') throw new Error(`a partida ainda não terminou (estado ${p.estado})`)
      return t.concessoes
        .filter((c) => c.partida_id === p_partida)
        .sort((a, b) => (a.user_id < b.user_id ? -1 : 1))
        .map((c) => ({ usuario: c.user_id, xp_ganho: c.xp, xp_total: c.xp_total, nivel_antes: c.nivel_antes, nivel_depois: c.nivel_depois, itens_novos: c.itens, motivo: c.motivo }))
    },
  }
}

export function criarSupabaseFalso({ usuarios = {}, perfis = [], url = 'https://falso.supabase.co', agora = Date.now } = {}) {
  const sb = {
    tabelas: { perfis: perfis.map((p) => ({ ...p })), amizades: [], bloqueios: [], pedidos_amizade: [], partidas: [], partida_participantes: [], concessoes: [], inventario: [], estatisticas_basicas: [], denuncias: [] },
    agora,
    diaDe: (ms) => Math.floor((ms - 3 * 3600_000) / 86_400_000), // dia em São Paulo (UTC−3)
    concederChamadas: 0,
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
    async rpc(nome, args = {}) {
      sb.chamadas.push({ op: 'rpc', nome, args })
      await null // como na rede: a resposta chega depois
      if (sb.falhar.rpc || sb.falhar[nome]) return { data: null, error: erro(`falha simulada em ${nome}`) }
      const f = sb.funcoes[nome]
      if (!f) return { data: null, error: erro(`função ${nome} não existe`) }
      try {
        return { data: f(args), error: null }
      } catch (e) {
        return { data: null, error: erro(e.message) }
      }
    },
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
  sb.funcoes = rpcs(sb)
  return sb
}
