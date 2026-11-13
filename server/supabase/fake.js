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
//     (0015) também conceder_bau, abrir_bau, baus_estado e equipar_conta (o espelho em src/lib/cosmeticos.js)
//     (Fase 1D) a mesma regra das funções de 0003_progresso.sql, em JS (com o
//     espelho src/lib/progresso.js); sb.diaDe(t) diz o "dia" do limite de repetição
//
// sb.tabelas.perfis, sb.arquivos ('bucket/caminho' -> { dados, opcoes }) e
// sb.chamadas ficam expostos para o teste conferir. sb.falhar = { getUser: true,
// upload: true, conceder_recompensa: true, ... } faz a operação devolver erro.

import crypto from 'node:crypto'
import { xpDaPartida, nivelDoXp, itensAte, CATALOGO, RESULTADOS_JOGADOS, CONVIDADOS_LIMITE_DIA, REPETICAO_LIMITE, DURACAO_MINIMA_S, RODADAS_MINIMAS } from '../../src/lib/progresso.js'
import { xpDaCorrida } from '../../src/game/campanha/recompensas.js'
import { mundoDe, ITENS_CAMPANHA } from '../../src/game/campanha/mundos/index.js'
import { XP_DESAFIO, DIAS_COSMETICO_SEMANA, MAX_AMIGOS_RECORDE, numeroDoDia, semanaDoDia, VERSAO_DESAFIO, diaDoDesafio } from '../../src/lib/desafio.js'
import { ITENS_BAU, FONTES_BAU, CONQUISTAS_COM_BAU, BAU_XP_TETO_DIA, rolarBau, sorteioValido } from '../../src/lib/cosmeticos.js'
import { pontosDeMaestria, nivelDaMaestria, MAESTRIA_TETO_DIA, PERSONAGENS_MAESTRIA, IDS_CONQUISTAS, ITENS_MAESTRIA } from '../../src/lib/conquistas.js'

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
    // DESAFIO DIÁRIO (0013): os espelhos de desafio_estado e conceder_desafio
    desafio_estado({ p_user, p_dia }) {
      const semana = semanaDoDia(p_dia)
      if (!semana) throw new Error('dia inválido')
      const rec = t.desafio_recordes.find((r) => r.user_id === p_user && r.dia === p_dia)
      const amigos = t.amizades
        .filter((a) => a.a === p_user || a.b === p_user)
        .map((a) => (a.a === p_user ? a.b : a.a))
        .filter((o) => !t.bloqueios.some((b) => (b.quem === p_user && b.bloqueado === o) || (b.quem === o && b.bloqueado === p_user)))
        .map((o) => ({ o, r: t.desafio_recordes.find((r) => r.user_id === o && r.dia === p_dia), perfil: t.perfis.find((x) => x.id === o) }))
        .filter((x) => x.r && x.perfil)
        .sort((x, y) => y.r.pontos - x.r.pontos || (x.o < y.o ? -1 : 1))
        .slice(0, MAX_AMIGOS_RECORDE)
        .map((x) => ({ id: x.o, nome: x.perfil.nome_exibicao, tag: x.perfil.tag, pontos: x.r.pontos }))
      return {
        recorde: rec ? { pontos: rec.pontos, rodadas: rec.rodadas, acertos: rec.acertos } : null,
        concluido: t.desafio_concluidos.some((c) => c.user_id === p_user && c.dia === p_dia),
        dias_semana: t.desafio_concluidos.filter((c) => c.user_id === p_user && c.semana === semana).length,
        cosmetico_ganho: t.desafio_semanas.some((c) => c.user_id === p_user && c.semana === semana),
        concluidos: t.desafio_concluidos.filter((c) => c.user_id === p_user).length,
        amigos,
      }
    },
    conceder_desafio({ p_corrida, p_user, p_dia, p_versao, p_resultado, p_motivo, p_pontos, p_rodadas, p_acertos, p_duracao_s, p_item, p_tipo, p_nome }) {
      if (!['vitoria', 'derrota', 'suspeita', 'abandono'].includes(p_resultado)) throw new Error('resultado inválido')
      const numero = numeroDoDia(p_dia)
      const hoje = sb.diaDe(sb.agora())
      if (numero == null || numero > hoje || numero < hoje - 1) throw new Error('dia inválido')
      if (p_versao !== VERSAO_DESAFIO) throw new Error('versão inválida')
      const semana = semanaDoDia(p_dia)
      const ja = t.desafio_corridas.find((c) => c.id === p_corrida)
      const estado = () => ({
        concluido: t.desafio_concluidos.some((c) => c.user_id === p_user && c.dia === p_dia),
        dias_semana: t.desafio_concluidos.filter((c) => c.user_id === p_user && c.semana === semana).length,
        concluidos: t.desafio_concluidos.filter((c) => c.user_id === p_user).length,
        recorde: t.desafio_recordes.find((r) => r.user_id === p_user && r.dia === p_dia)?.pontos ?? null,
      })
      if (ja) return { xp_ganho: ja.xp, xp_total: ja.xp_total, nivel_antes: ja.nivel_antes, nivel_depois: ja.nivel_depois, itens_novos: ja.itens, motivo: ja.xp_motivo, resultado: ja.resultado, pontos: ja.pontos, novo_recorde: ja.novo_recorde, primeira_hoje: ja.primeira_hoje, cosmetico_novo: ja.cosmetico_novo, repetida: true, ...estado() }
      const perfil = t.perfis.find((x) => x.id === p_user)
      if (!perfil) throw new Error('perfil não encontrado')
      perfil.xp ??= 0
      perfil.nivel ??= 1
      const conta = p_resultado === 'vitoria' || p_resultado === 'derrota'
      const pontos = conta ? Math.max(0, Math.min(100000, Number(p_pontos) || 0)) : 0
      const base = { id: p_corrida, user_id: p_user, dia: p_dia, resultado: p_resultado, motivo: p_motivo ? String(p_motivo).slice(0, 32) : null, pontos, rodadas: p_rodadas, acertos: p_acertos, duracao_s: p_duracao_s, criada_em: sb.agora() }
      let novoRecorde = false
      if (conta) {
        const r = t.desafio_recordes.find((x) => x.user_id === p_user && x.dia === p_dia)
        novoRecorde = !r || pontos > r.pontos
        if (!r) t.desafio_recordes.push({ user_id: p_user, dia: p_dia, pontos, rodadas: p_rodadas, acertos: p_acertos, corrida_id: p_corrida })
        else if (novoRecorde) Object.assign(r, { pontos, rodadas: p_rodadas, acertos: p_acertos, corrida_id: p_corrida })
      }
      let xp = 0
      let motivo = p_resultado
      let itens = []
      let primeiraHoje = false
      let cosmetico = null
      const nivelAntes = perfil.nivel
      if (p_resultado === 'vitoria') {
        motivo = 'repeticao'
        if (!t.desafio_concluidos.some((c) => c.user_id === p_user && c.dia === p_dia)) {
          primeiraHoje = true
          xp = XP_DESAFIO
          motivo = 'desafio'
          t.desafio_concluidos.push({ user_id: p_user, dia: p_dia, semana, xp, corrida_id: p_corrida })
          const total = perfil.xp + xp
          const nivel = nivelDoXp(total)
          const tem = new Set(t.inventario.filter((i) => i.user_id === p_user).map((i) => i.item_id))
          itens = itensAte(nivel).filter((i) => !tem.has(i.id)).map((i) => i.id).sort()
          Object.assign(perfil, { xp: total, nivel })
          // o cosmético da semana: DIAS_COSMETICO_SEMANA dias vencidos na semana, uma vez por semana
          const dias = t.desafio_concluidos.filter((c) => c.user_id === p_user && c.semana === semana).length
          const idEsperado = p_tipo && `${p_tipo}.diario_${semana.replace('-S', '_')}`
          if (dias >= DIAS_COSMETICO_SEMANA && !t.desafio_semanas.some((c) => c.user_id === p_user && c.semana === semana) && ['titulo', 'moldura', 'verso'].includes(p_tipo) && p_item === idEsperado) {
            if (!t.catalogo_itens.some((c) => c.id === p_item)) t.catalogo_itens.push({ id: p_item, tipo: p_tipo, nome: String(p_nome || p_item).slice(0, 32), nivel_requerido: 1000, padrao: false, exclusivo: true, semana })
            t.desafio_semanas.push({ user_id: p_user, semana, item_id: p_item })
            if (!tem.has(p_item)) itens.push(p_item)
            cosmetico = p_item
          }
          for (const item_id of itens) t.inventario.push({ user_id: p_user, item_id, obtido_em: new Date(sb.agora()).toISOString() })
        }
      }
      t.desafio_corridas.push({ ...base, xp, xp_motivo: motivo, itens, xp_total: perfil.xp, nivel_antes: nivelAntes, nivel_depois: perfil.nivel, novo_recorde: novoRecorde, primeira_hoje: primeiraHoje, cosmetico_novo: cosmetico })
      return { xp_ganho: xp, xp_total: perfil.xp, nivel_antes: nivelAntes, nivel_depois: perfil.nivel, itens_novos: itens, motivo, resultado: p_resultado, pontos, novo_recorde: novoRecorde, primeira_hoje: primeiraHoje, cosmetico_novo: cosmetico, ...estado() }
    },
    // CONQUISTAS e MAESTRIA (0014): os espelhos de registrar_evento_conta, desbloquear_conquistas e conquistas_da_conta
    registrar_evento_conta({ p_user, p_ref, p_tipo, p_modo, p_personagem, p_resultado }) {
      if (!/^[A-Za-z0-9:_-]{8,80}$/.test(p_ref ?? '') || !['partida', 'campanha', 'desafio'].includes(p_tipo)) throw new Error('evento inválido')
      if (!t.perfis.some((x) => x.id === p_user)) throw new Error('perfil não encontrado')
      const personagem = PERSONAGENS_MAESTRIA.includes(p_personagem) ? p_personagem : null
      const resumo = () => {
        const ev = t.conta_eventos.filter((e) => e.user_id === p_user)
        const maestria = {}
        for (const m of t.maestria.filter((x) => x.user_id === p_user)) maestria[m.personagem] = m.pontos
        return { partidas: ev.filter((e) => pontosDeMaestria(e.resultado) > 0).length, vitorias: ev.filter((e) => e.resultado === 'vitoria').length, desafios: t.desafio_concluidos.filter((c) => c.user_id === p_user).length, maestria }
      }
      if (t.conta_eventos.some((e) => e.user_id === p_user && e.ref === p_ref)) return { novo: false, resumo: resumo(), itens_novos: [], maestria: null }
      const dia = sb.diaDe(sb.agora())
      let pontos = personagem ? pontosDeMaestria(p_resultado) : 0
      if (pontos) {
        const hoje = t.conta_eventos.filter((e) => e.user_id === p_user && e.personagem === personagem && sb.diaDe(e.criado_em) === dia).reduce((s, e) => s + e.pontos, 0)
        pontos = Math.max(0, Math.min(pontos, MAESTRIA_TETO_DIA - hoje))
      }
      t.conta_eventos.push({ user_id: p_user, ref: p_ref, tipo: p_tipo, modo: p_modo ?? null, personagem, resultado: p_resultado ?? null, pontos, criado_em: sb.agora() })
      let maestria = null
      const itens = []
      if (personagem && pontosDeMaestria(p_resultado) > 0) {
        let m = t.maestria.find((x) => x.user_id === p_user && x.personagem === personagem)
        if (!m) t.maestria.push((m = { user_id: p_user, personagem, pontos: 0, partidas: 0, vitorias: 0 }))
        const antes = nivelDaMaestria(m.pontos)
        m.pontos += pontos
        m.partidas++
        if (p_resultado === 'vitoria') m.vitorias++
        const depois = nivelDaMaestria(m.pontos)
        maestria = { personagem, pontos: m.pontos, nivel_antes: antes, nivel_depois: depois }
        for (const i of ITENS_MAESTRIA.filter((x) => x.personagem === personagem && x.maestria <= depois).sort((a, b) => (a.id < b.id ? -1 : 1)))
          if (!t.inventario.some((x) => x.user_id === p_user && x.item_id === i.id)) {
            t.inventario.push({ user_id: p_user, item_id: i.id, obtido_em: new Date(sb.agora()).toISOString() })
            itens.push(i.id)
          }
      }
      return { novo: true, resumo: resumo(), itens_novos: itens, maestria }
    },
    desbloquear_conquistas({ p_user, p_ids }) {
      if (!t.perfis.some((x) => x.id === p_user)) return []
      const novas = []
      for (const id of [...new Set(p_ids ?? [])].sort()) {
        if (!IDS_CONQUISTAS.includes(id) || t.conquistas.some((c) => c.user_id === p_user && c.conquista === id)) continue
        t.conquistas.push({ user_id: p_user, conquista: id, obtida_em: new Date(sb.agora()).toISOString() })
        novas.push(id)
      }
      return novas
    },
    conquistas_da_conta({ p_user }) {
      return {
        conquistas: t.conquistas.filter((c) => c.user_id === p_user).sort((a, b) => (a.conquista < b.conquista ? -1 : 1)).map((c) => ({ id: c.conquista, em: c.obtida_em })),
        maestria: t.maestria.filter((m) => m.user_id === p_user).sort((a, b) => (a.personagem < b.personagem ? -1 : 1)).map((m) => ({ personagem: m.personagem, pontos: m.pontos, partidas: m.partidas, vitorias: m.vitorias })),
      }
    },
    // BAÚS e SLOTS NOVOS (0015): os espelhos de equipar_conta, conceder_bau, abrir_bau e baus_estado
    // (0016: o tipo 'frente', o estilo da face das cartas, em perfis.frente_equipada)
    equipar_conta({ p_uid, p_tipo, p_item = null }) {
      if (!p_uid) throw new Error('precisa estar logado')
      if (!['avatar', 'titulo', 'moldura', 'verso', 'som', 'efeito', 'lancamento', 'frente'].includes(p_tipo)) throw new Error('tipo de item inválido')
      const perfil = t.perfis.find((x) => x.id === p_uid)
      if (!perfil) throw new Error('perfil não encontrado')
      if (p_item == null) {
        if (p_tipo === 'avatar') throw new Error('escolha outro avatar no perfil')
      } else {
        const item = [...CATALOGO, ...ITENS_BAU, ...t.catalogo_itens].find((i) => i.id === p_item && i.tipo === p_tipo)
        if (!item) throw new Error('item inválido')
        if (!item.padrao && !t.inventario.some((i) => i.user_id === p_uid && i.item_id === p_item)) throw new Error('você ainda não tem esse item')
      }
      const coluna = { titulo: 'titulo_equipado', moldura: 'moldura_equipada', verso: 'verso_equipado', som: 'som_equipado', efeito: 'efeito_equipado', lancamento: 'lancamento_equipado', frente: 'frente_equipada' }[p_tipo]
      if (coluna) perfil[coluna] = p_item
      else Object.assign(perfil, { avatar_tipo: 'jogo', avatar_id: p_item.split('.')[1] })
      return { ...perfil }
    },
    conceder_bau({ p_user, p_fonte, p_ref }) {
      if (!FONTES_BAU[p_fonte]) throw new Error('fonte inválida')
      const perfil = t.perfis.find((x) => x.id === p_user)
      if (!perfil) throw new Error('perfil não encontrado')
      let ref = String(p_ref ?? '')
      if (p_fonte === 'nivel') {
        if (!/^[0-9]{1,3}$/.test(ref)) throw new Error('nível inválido')
        ref = String(Number(ref))
        if (Number(ref) < 2 || Number(ref) > (perfil.nivel ?? 1)) throw new Error('a conta ainda não chegou nesse nível')
      } else if (p_fonte === 'dia') ref = diaDoDesafio(sb.agora()).id
      else if (p_fonte === 'desafio') {
        if (!t.desafio_concluidos.some((d) => d.user_id === p_user && d.dia === ref)) throw new Error('desafio não vencido')
      } else if (p_fonte === 'semanal') {
        if (!t.trofeus_semanais.some((x) => x.user_id === p_user && x.semana === ref)) throw new Error('boss semanal não vencido')
      } else if (!CONQUISTAS_COM_BAU.includes(ref) || !t.conquistas.some((c) => c.user_id === p_user && c.conquista === ref)) throw new Error('conquista sem baú')
      const chave = FONTES_BAU[p_fonte].chave(ref)
      const novo = !t.baus.some((b) => b.user_id === p_user && b.chave === chave)
      if (novo) t.baus.push({ id: crypto.randomUUID(), user_id: p_user, fonte: p_fonte, chave, criado_em: sb.agora(), ordem: t.baus.length, aberto_em: null, xp: 0, resultado: null })
      return { novo, fonte: p_fonte, chave, fechados: t.baus.filter((b) => b.user_id === p_user && b.aberto_em == null).length }
    },
    abrir_bau({ p_user, p_bau = null, p_sorteio }) {
      if (!sorteioValido(p_sorteio)) throw new Error('sorteio inválido')
      const perfil = t.perfis.find((x) => x.id === p_user)
      if (!perfil) throw new Error('perfil não encontrado')
      perfil.xp ??= 0
      perfil.nivel ??= 1
      const fechados = () => t.baus.filter((b) => b.user_id === p_user && b.aberto_em == null).length
      let b
      if (p_bau == null) {
        b = t.baus.filter((x) => x.user_id === p_user && x.aberto_em == null).sort((x, y) => x.criado_em - y.criado_em || x.ordem - y.ordem)[0]
        if (!b) return { aberto: false, motivo: 'sem_bau', fechados: 0 }
      } else {
        b = t.baus.find((x) => x.id === p_bau && x.user_id === p_user)
        if (!b) throw new Error('baú não existe')
        if (b.aberto_em != null) return { ...b.resultado, repetido: true, fechados: fechados() }
      }
      let c = t.baus_contas.find((x) => x.user_id === p_user)
      if (!c) t.baus_contas.push((c = { user_id: p_user, desde_epico: 0, abertos: 0 }))
      const tem = new Set(t.inventario.filter((i) => i.user_id === p_user).map((i) => i.item_id))
      const rolado = rolarBau(p_sorteio, { desdeEpico: c.desde_epico, possui: (id) => tem.has(id) })
      for (const r of rolado.recompensas) if (r.tipo === 'item') t.inventario.push({ user_id: p_user, item_id: r.id, obtido_em: new Date(sb.agora()).toISOString() })
      const dia = sb.diaDe(sb.agora())
      const hoje = t.baus.filter((x) => x.user_id === p_user && x.aberto_em != null && sb.diaDe(x.aberto_em) === dia).reduce((s, x) => s + x.xp, 0)
      const xp = Math.min(rolado.xp, Math.max(0, BAU_XP_TETO_DIA - hoje))
      const nivelAntes = perfil.nivel
      const total = perfil.xp + xp
      const nivel = nivelDoXp(total)
      let itens = []
      if (xp > 0) {
        Object.assign(perfil, { xp: total, nivel })
        const agoraTem = new Set(t.inventario.filter((i) => i.user_id === p_user).map((i) => i.item_id))
        itens = itensAte(nivel).filter((i) => !agoraTem.has(i.id)).map((i) => i.id).sort()
        for (const item_id of itens) t.inventario.push({ user_id: p_user, item_id, obtido_em: new Date(sb.agora()).toISOString() })
        for (let n = nivelAntes + 1; n <= nivel; n++) {
          const chave = `nivel:${n}`
          if (!t.baus.some((x) => x.user_id === p_user && x.chave === chave)) t.baus.push({ id: crypto.randomUUID(), user_id: p_user, fonte: 'nivel', chave, criado_em: sb.agora(), ordem: t.baus.length, aberto_em: null, xp: 0, resultado: null })
        }
      }
      Object.assign(c, { desde_epico: rolado.desdeEpico, abertos: c.abertos + 1 })
      const res = { aberto: true, bau_id: b.id, fonte: b.fonte, recompensas: rolado.recompensas, xp_sorteado: rolado.xp, xp_ganho: xp, teto: xp < rolado.xp, xp_total: perfil.xp, nivel_antes: nivelAntes, nivel_depois: perfil.nivel, itens_novos: itens, pity: rolado.pity, desde_epico: c.desde_epico }
      Object.assign(b, { aberto_em: sb.agora(), xp, resultado: res })
      return { ...res, repetido: false, fechados: fechados() }
    },
    baus_estado({ p_user }) {
      const c = t.baus_contas.find((x) => x.user_id === p_user)
      const lista = t.baus.filter((b) => b.user_id === p_user && b.aberto_em == null).sort((x, y) => x.criado_em - y.criado_em || x.ordem - y.ordem)
      return { fechados: lista.length, abertos: c?.abertos ?? 0, desde_epico: c?.desde_epico ?? 0, lista: lista.slice(0, 20).map((b) => ({ id: b.id, fonte: b.fonte, chave: b.chave, em: new Date(b.criado_em).toISOString() })) }
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
    tabelas: { perfis: perfis.map((p) => ({ ...p })), amizades: [], bloqueios: [], pedidos_amizade: [], partidas: [], partida_participantes: [], concessoes: [], inventario: [], estatisticas_basicas: [], denuncias: [], catalogo_itens: [], trofeus_semanais: [], campanha_progresso: [], campanha_escolhas: [], campanha_corridas: [], desafio_corridas: [], desafio_recordes: [], desafio_concluidos: [], desafio_semanas: [], conta_eventos: [], maestria: [], conquistas: [], baus: [], baus_contas: [] },
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
