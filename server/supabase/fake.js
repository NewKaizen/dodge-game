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

import { xpDaPartida, nivelDoXp, itensAte, RESULTADOS_JOGADOS, CONVIDADOS_LIMITE_DIA, REPETICAO_LIMITE, DURACAO_MINIMA_S, RODADAS_MINIMAS } from '../../src/lib/progresso.js'
import { xpDaCorrida } from '../../src/game/campanha/recompensas.js'
import { mundoDe, ITENS_CAMPANHA } from '../../src/game/campanha/mundos/index.js'

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
        const ref = !uid && typeof e.ref === 'string' && /^convidado(:[a-z0-9]{1,32})?$/.test(e.ref) ? e.ref : null
        t.partida_participantes.push({ partida_id: p_id, lado: e.lado, time: e.time === 0 || e.time === 1 ? e.time : null, user_id: uid, ref, personagem: null, resultado: null, relato: null, relatado_em: null })
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
        if (pp) Object.assign(pp, { resultado: e.resultado, personagem: e.personagem ?? null, relato: e.relato ?? null, relatado_em: e.relatado_em ?? null, colocacao: [1, 2, 3, 4].includes(e.colocacao) ? e.colocacao : null })
      }
      Object.assign(p, { estado: p_validacao, validacao: p_validacao, vencedor_lado: p_vencedor_lado, motivo_termino: p_motivo, duracao_s: p_duracao_s, rodadas: p_rodadas, encerrada_em: agora().toISOString() })
      return p_validacao
    },
    // BOSS SEMANAL (0010): o espelho de conceder_trofeu_semanal
    conceder_trofeu_semanal({ p_partida, p_semana, p_item, p_tipo, p_nome }) {
      if (!/^[0-9]{4}-S[0-9]{2}$/.test(p_semana ?? '')) throw new Error('semana inválida')
      if (!['titulo', 'moldura', 'verso'].includes(p_tipo) || p_item !== `${p_tipo}.semanal_${p_semana.replace('-S', '_')}`) throw new Error('troféu inválido')
      const p = t.partidas.find((x) => x.id === p_partida)
      if (!p) throw new Error('partida não existe')
      if (!['coop', 'coop4'].includes(p.modo) || p.validacao !== 'validada' || !['validada', 'recompensada'].includes(p.estado) || (p.duracao_s ?? 0) < DURACAO_MINIMA_S || (p.rodadas != null && p.rodadas < RODADAS_MINIMAS)) return []
      if (p.semana == null) p.semana = p_semana
      else if (p.semana !== p_semana) return []
      if (!t.catalogo_itens.some((c) => c.id === p_item)) t.catalogo_itens.push({ id: p_item, tipo: p_tipo, nome: String(p_nome || p_item).slice(0, 32), nivel_requerido: 1000, padrao: false, exclusivo: true, semana: p_semana })
      const linhas = []
      for (const pp of t.partida_participantes.filter((x) => x.partida_id === p_partida && x.user_id && x.resultado === 'vitoria' && x.relato?.semana === p_semana).sort((a, b) => (a.user_id < b.user_id ? -1 : 1))) {
        const novo = !t.trofeus_semanais.some((x) => x.user_id === pp.user_id && x.semana === p_semana)
        if (novo) t.trofeus_semanais.push({ user_id: pp.user_id, semana: p_semana, item_id: p_item, partida_id: p_partida })
        if (!t.inventario.some((i) => i.user_id === pp.user_id && i.item_id === p_item)) t.inventario.push({ user_id: pp.user_id, item_id: p_item, obtido_em: agora().toISOString() })
        linhas.push({ usuario: pp.user_id, item_id: p_item, novo })
      }
      return linhas
    },
    // CAMPANHA (0011): os espelhos de progresso_campanha, campanha_escolher e conceder_campanha
    progresso_campanha({ p_user }) {
      const dia = sb.diaDe(sb.agora())
      const escolhas = {}
      for (const e of t.campanha_escolhas.filter((x) => x.user_id === p_user)) escolhas[String(e.mundo)] = { ...e.escolhas }
      return {
        fases: t.campanha_progresso.filter((p) => p.user_id === p_user).sort((a, b) => a.mundo - b.mundo || a.fase - b.fase).map((p) => ({ mundo: p.mundo, fase: p.fase, estrelas: p.estrelas, concluida: p.concluida })),
        escolhas,
        xp_hoje: t.campanha_corridas.filter((c) => c.user_id === p_user && sb.diaDe(c.criada_em) === dia).reduce((s, c) => s + c.xp, 0),
      }
    },
    campanha_escolher({ p_user, p_mundo, p_chave, p_valor }) {
      if (!/^[a-z_]{1,24}$/.test(p_chave ?? '') || !/^[a-z_]{1,24}$/.test(p_valor ?? '') || !mundoDe(p_mundo)) throw new Error('escolha inválida')
      if (!t.perfis.some((p) => p.id === p_user)) return null
      let e = t.campanha_escolhas.find((x) => x.user_id === p_user && x.mundo === p_mundo)
      if (!e) t.campanha_escolhas.push((e = { user_id: p_user, mundo: p_mundo, escolhas: {} }))
      if (p_chave in e.escolhas || Object.keys(e.escolhas).length < 32) e.escolhas[p_chave] = p_valor
      return null
    },
    conceder_campanha({ p_corrida, p_user, p_mundo, p_fase, p_resultado, p_motivo, p_estrelas, p_rodadas, p_duracao_s }) {
      if (!['vitoria', 'derrota', 'suspeita', 'abandono'].includes(p_resultado)) throw new Error('resultado inválido')
      const fases = mundoDe(p_mundo)?.fases.length ?? 0
      if (!fases || !(p_fase >= 1 && p_fase <= fases)) throw new Error('fase inválida')
      const ja = t.campanha_corridas.find((c) => c.id === p_corrida)
      if (ja) return { xp_ganho: ja.xp, xp_total: ja.xp_total, nivel_antes: ja.nivel_antes, nivel_depois: ja.nivel_depois, itens_novos: ja.itens, motivo: ja.xp_motivo ?? ja.resultado, estrelas: ja.estrelas, melhor_estrelas: ja.melhor_estrelas, primeira: ja.primeira, resultado: ja.resultado, repetida: true }
      const perfil = t.perfis.find((p) => p.id === p_user)
      if (!perfil) throw new Error('perfil não encontrado')
      perfil.xp ??= 0
      perfil.nivel ??= 1
      let resultado = p_resultado
      let motivo = p_motivo ? String(p_motivo).slice(0, 32) : null
      const prog = (f) => t.campanha_progresso.find((p) => p.user_id === p_user && p.mundo === p_mundo && p.fase === f)
      if (resultado === 'vitoria' && p_fase > 1 && !prog(p_fase - 1)?.concluida) {
        resultado = 'suspeita'
        motivo = 'bloqueada'
      }
      const base = { id: p_corrida, user_id: p_user, mundo: p_mundo, fase: p_fase, resultado, motivo, rodadas: p_rodadas, duracao_s: p_duracao_s, criada_em: sb.agora() }
      if (resultado !== 'vitoria') {
        t.campanha_corridas.push({ ...base, estrelas: 0, xp: 0, xp_motivo: resultado, itens: [], xp_total: perfil.xp, nivel_antes: perfil.nivel, nivel_depois: perfil.nivel, primeira: false, melhor_estrelas: null })
        return { xp_ganho: 0, xp_total: perfil.xp, nivel_antes: perfil.nivel, nivel_depois: perfil.nivel, itens_novos: [], motivo: resultado, estrelas: 0, melhor_estrelas: null, primeira: false, resultado }
      }
      const estrelas = Math.min(3, Math.max(0, Number(p_estrelas) || 0))
      let p = prog(p_fase)
      const primeira = !p?.concluida
      const antes = p?.estrelas ?? 0
      const dia = sb.diaDe(sb.agora())
      const xpHoje = t.campanha_corridas.filter((c) => c.user_id === p_user && sb.diaDe(c.criada_em) === dia).reduce((s, c) => s + c.xp, 0)
      const { xp, motivo: xpMotivo } = xpDaCorrida({ primeira, chefe: p_fase === fases, estrelasAntes: antes, estrelas, xpHoje })
      if (!p) t.campanha_progresso.push((p = { user_id: p_user, mundo: p_mundo, fase: p_fase, estrelas: 0, concluida: false, vitorias: 0, melhor_rodadas: null }))
      Object.assign(p, { estrelas: Math.max(p.estrelas, estrelas), concluida: true, vitorias: p.vitorias + 1, melhor_rodadas: p.melhor_rodadas == null ? p_rodadas : Math.min(p.melhor_rodadas, p_rodadas) })
      const nivelAntes = perfil.nivel
      const total = perfil.xp + xp
      const nivel = nivelDoXp(total)
      Object.assign(perfil, { xp: total, nivel })
      const tem = new Set(t.inventario.filter((i) => i.user_id === p_user).map((i) => i.item_id))
      const trilha = itensAte(nivel).filter((i) => !tem.has(i.id)).map((i) => i.id).sort()
      const tresEstrelas = t.campanha_progresso.filter((x) => x.user_id === p_user && x.mundo === p_mundo && x.estrelas === 3).length >= fases
      const doMundo = ITENS_CAMPANHA.filter((i) => i.mundo === p_mundo && !tem.has(i.id) && ((i.quando === 'mundo' && p_fase === fases) || (i.quando === 'estrelas' && tresEstrelas))).map((i) => i.id).sort()
      const itens = [...trilha, ...doMundo]
      for (const item_id of itens) t.inventario.push({ user_id: p_user, item_id, obtido_em: new Date(sb.agora()).toISOString() })
      t.campanha_corridas.push({ ...base, estrelas, xp, xp_motivo: xpMotivo, itens, xp_total: total, nivel_antes: nivelAntes, nivel_depois: nivel, primeira, melhor_estrelas: Math.max(antes, estrelas) })
      return { xp_ganho: xp, xp_total: total, nivel_antes: nivelAntes, nivel_depois: nivel, itens_novos: itens, motivo: xpMotivo, estrelas, melhor_estrelas: Math.max(antes, estrelas), primeira, resultado: 'vitoria' }
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
          // como a 0006: o "oponente" do limite diário é o 1º outro lado COM conta (senão o 1º outro lado);
          // com 2 lados só existe um. Nas partidas de 3 e 4 isso conta por par de contas
          // 2x2 (0009): os "outros" são só os do OUTRO time (o parceiro não conta)
          const dupla = p.modo === '2x2' && pp.time != null
          const outros = lados.filter((x) => x.lado !== pp.lado && (!dupla || x.time !== pp.time))
          const outro = outros.sort((x, y) => Number(!x.user_id) - Number(!y.user_id) || x.lado - y.lado)[0]
          const oponente = outro?.user_id ?? null
          const oponenteRef = outro?.ref ?? null
          // só conta partidas do mesmo modo, hoje, contra o mesmo oponente (a conta ou a chave do convidado)
          const hoje = t.concessoes.filter((c) => c.user_id === pp.user_id && c.xp > 0 && sb.diaDe(c.criada_em) === dia && t.partidas.find((x) => x.id === c.partida_id)?.modo === p.modo)
          let repeticoes = hoje.filter((c) => c.oponente_id === oponente && (c.oponente_ref ?? null) === oponenteRef).length
          // 2x2 (0009): o limite conta contra CADA adversário com conta (vale o par mais repetido hoje): as
          // partidas de hoje em que eu e ele estávamos em times opostos
          if (dupla) {
            const contra = (u) =>
              hoje.filter((c) => {
                const eu = t.partida_participantes.find((x) => x.partida_id === c.partida_id && x.user_id === pp.user_id)
                return t.partida_participantes.some((x) => x.partida_id === c.partida_id && x.user_id === u && eu && x.time != null && x.time !== eu.time)
              }).length
            const contas = outros.filter((x) => x.user_id).map((x) => x.user_id)
            if (contas.length) repeticoes = Math.max(...contas.map(contra))
          }
          // contra convidados também há um teto por dia, somando todos
          if (!oponente && oponenteRef && hoje.filter((c) => !c.oponente_id && c.oponente_ref).length >= CONVIDADOS_LIMITE_DIA) repeticoes = REPETICAO_LIMITE
          const { xp, motivo } = xpDaPartida({ resultado: pp.resultado, duracaoS: p.duracao_s, rodadas: p.rodadas, repeticoes, modo: p.modo, colocacao: pp.colocacao ?? null })
          const total = (perfil.xp ?? 0) + xp
          const nivel = nivelDoXp(total)
          const tem = new Set(t.inventario.filter((i) => i.user_id === pp.user_id).map((i) => i.item_id))
          const novos = itensAte(nivel).filter((i) => !tem.has(i.id)).map((i) => i.id)
          for (const item_id of novos) t.inventario.push({ user_id: pp.user_id, item_id, obtido_em: agora().toISOString() })
          t.concessoes.push({ partida_id: p_partida, user_id: pp.user_id, xp, motivo, itens: novos, xp_total: total, nivel_antes: perfil.nivel ?? 1, nivel_depois: nivel, oponente_id: oponente, oponente_ref: oponenteRef, criada_em: sb.agora() })
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
    tabelas: { perfis: perfis.map((p) => ({ ...p })), amizades: [], bloqueios: [], pedidos_amizade: [], partidas: [], partida_participantes: [], concessoes: [], inventario: [], estatisticas_basicas: [], denuncias: [], catalogo_itens: [], trofeus_semanais: [], campanha_progresso: [], campanha_escolhas: [], campanha_corridas: [] },
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
