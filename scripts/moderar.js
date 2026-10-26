#!/usr/bin/env node
// Moderação por linha de comando (Fase 1E; fluxo completo em docs/moderacao.md).
// Roda NA SUA MÁQUINA (ou num shell do Render), com a chave secreta do
// Supabase: ela nunca vai para o navegador, e nada aqui é chamado pelo jogo.
//
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/moderar.js <comando>
//   (ou npm run moderar -- <comando>; também vale SUPABASE_SERVICE_ROLE_KEY)
//
//   listar [--json]                 as denúncias abertas, da mais antiga para a mais nova
//   aceitar <id> [--revisor nome]   foto: apaga o arquivo e volta ao avatar padrão
//                                   nome: troca por JOGADOR (a tag continua)
//                                   e fecha as outras denúncias abertas do mesmo caso
//   rejeitar <id> [--revisor nome]  fecha sem mexer no perfil
//
// O id pode ser o inteiro ou só o começo (8 letras bastam, se não houver outro igual).
import { pathToFileURL } from 'node:url'
import { lerConfig, BUCKET_AVATARES } from '../server/contas.js'

export const NOME_NEUTRO = 'JOGADOR'
export const MAX_LISTA = 200
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PREFIXO = /^[0-9a-f]{4,36}(-[0-9a-f-]*)?$/i

export const AJUDA = `moderar.js: revisão das denúncias de nome e foto

  node scripts/moderar.js listar [--json]
  node scripts/moderar.js aceitar <id> [--revisor nome]
  node scripts/moderar.js rejeitar <id> [--revisor nome]

precisa de SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente (docs/moderacao.md)`

// argv (sem node e o script) -> { comando, id?, revisor?, json? } | { erro }
export function interpretar(argv) {
  const args = [...argv]
  const opcoes = { json: false, revisor: null }
  const posicionais = []
  while (args.length) {
    const a = args.shift()
    if (a === '--json') opcoes.json = true
    else if (a === '--revisor') {
      const v = args.shift()
      if (!v || v.startsWith('--')) return { erro: '--revisor precisa de um nome' }
      opcoes.revisor = v.trim().slice(0, 64) || null
    } else if (a === '-h' || a === '--help' || a === 'ajuda') return { comando: 'ajuda' }
    else if (a.startsWith('--')) return { erro: `opção desconhecida: ${a}` }
    else posicionais.push(a)
  }
  const [comando, id, ...resto] = posicionais
  if (!comando) return { comando: 'ajuda' }
  if (resto.length) return { erro: 'argumentos demais' }
  if (comando === 'listar') return id ? { erro: 'listar não recebe id' } : { comando, json: opcoes.json }
  if (comando === 'aceitar' || comando === 'rejeitar') {
    if (!id) return { erro: `${comando} precisa do id da denúncia (veja o "listar")` }
    if (!PREFIXO.test(id)) return { erro: `id inválido: ${id}` }
    return { comando, id: id.toLowerCase(), revisor: opcoes.revisor }
  }
  return { erro: `comando desconhecido: ${comando}` }
}

const falhou = (msg) => Object.assign(new Error(msg), { moderacao: true })
const conferir = (r, o) => {
  if (r.error) throw falhou(`${o}: ${r.error.message}`)
  return r.data
}

// supabase: cliente com a chave secreta (ou o falso dos testes)
export function criarModerador(supabase, { agora = () => new Date() } = {}) {
  async function achar(prefixo) {
    const abertas = conferir(await supabase.from('denuncias').select('*').eq('estado', 'aberta'), 'ler denúncias')
    const candidatas = abertas.filter((d) => (UUID.test(prefixo) ? d.id === prefixo : d.id.startsWith(prefixo)))
    if (candidatas.length === 0) {
      // aberta não achou: diz se é uma que já foi revisada
      const ja = UUID.test(prefixo) ? conferir(await supabase.from('denuncias').select('id, estado').eq('id', prefixo).maybeSingle(), 'ler denúncia') : null
      throw falhou(ja ? `a denúncia ${prefixo} já foi ${ja.estado}` : `não achei denúncia aberta com o id ${prefixo}`)
    }
    if (candidatas.length > 1) throw falhou(`o começo ${prefixo} serve para mais de uma denúncia: use mais letras`)
    return candidatas[0]
  }

  async function perfis(ids) {
    const linhas = ids.length ? conferir(await supabase.from('perfis').select('id, tag, nome_exibicao, avatar_tipo, avatar_url').in('id', ids), 'ler perfis') : []
    return new Map(linhas.map((p) => [p.id, p]))
  }

  async function fechar(d, estado, revisor) {
    const mudanca = { estado, revisada_em: agora().toISOString(), revisor }
    const r = conferir(await supabase.from('denuncias').update(mudanca).eq('id', d.id).eq('estado', 'aberta').select('id'), 'fechar denúncia')
    return r.length
  }

  return {
    // as abertas, da mais antiga para a mais nova, já com o nome/foto atuais de quem foi denunciado
    async listar() {
      const abertas = conferir(await supabase.from('denuncias').select('*').eq('estado', 'aberta').order('criada_em', { ascending: true }).limit(MAX_LISTA), 'ler denúncias')
      const mapa = await perfis([...new Set(abertas.flatMap((d) => [d.denunciante, d.denunciado]))])
      return abertas.map((d) => ({
        id: d.id,
        criada_em: d.criada_em,
        tipo: d.tipo,
        motivo: d.motivo,
        denunciante: mapa.get(d.denunciante)?.tag ?? d.denunciante,
        denunciado: mapa.get(d.denunciado)?.tag ?? d.denunciado,
        nome_atual: mapa.get(d.denunciado)?.nome_exibicao ?? null,
        foto_atual: mapa.get(d.denunciado)?.avatar_url ?? null,
      }))
    },

    async aceitar(prefixo, revisor = null) {
      const d = await achar(prefixo)
      const quem = revisor || 'cli'
      if (d.tipo === 'foto') {
        // apaga o arquivo e volta ao padrão (se o servidor já tinha apagado, tudo bem)
        const rem = await supabase.storage.from(BUCKET_AVATARES).remove([`${d.denunciado}.webp`])
        if (rem.error) throw falhou(`apagar a foto: ${rem.error.message}`)
        const r = await supabase.from('perfis').update({ avatar_tipo: 'padrao', avatar_id: null, avatar_url: null }).eq('id', d.denunciado).select('id')
        if (conferir(r, 'zerar o avatar').length === 0) throw falhou('o perfil denunciado não existe mais')
      } else {
        const r = await supabase.from('perfis').update({ nome_exibicao: NOME_NEUTRO }).eq('id', d.denunciado).select('id')
        if (conferir(r, 'zerar o nome').length === 0) throw falhou('o perfil denunciado não existe mais')
      }
      await fechar(d, 'aceita', quem)
      // as outras abertas sobre o mesmo caso ficam resolvidas junto
      const outras = conferir(
        await supabase.from('denuncias').update({ estado: 'aceita', revisada_em: agora().toISOString(), revisor: quem }).eq('denunciado', d.denunciado).eq('tipo', d.tipo).eq('estado', 'aberta').select('id'),
        'fechar as outras denúncias',
      )
      return { id: d.id, tipo: d.tipo, denunciado: d.denunciado, tambemFechadas: outras.length }
    },

    async rejeitar(prefixo, revisor = null) {
      const d = await achar(prefixo)
      await fechar(d, 'rejeitada', revisor || 'cli')
      return { id: d.id, tipo: d.tipo, denunciado: d.denunciado }
    },
  }
}

export function formatarLista(itens) {
  if (!itens.length) return 'nenhuma denúncia aberta'
  return itens
    .map((i) => {
      const alvo = i.tipo === 'foto' ? `foto: ${i.foto_atual ?? '(sem foto agora)'}` : `nome atual: ${i.nome_atual ?? '?'}`
      return `${i.id}  ${String(i.criada_em).slice(0, 16).replace('T', ' ')}  ${i.tipo.toUpperCase()}\n  denunciado: ${i.denunciado}  (${alvo})\n  por: ${i.denunciante}\n  motivo: ${i.motivo}`
    })
    .join('\n\n')
}

// executa um comando; devolve o código de saída. cliente/saida injetáveis para teste
export async function executar(argv, env = process.env, { criarCliente, saida = console.log, erro = console.error } = {}) {
  const p = interpretar(argv)
  if (p.erro) return erro(`erro: ${p.erro}\n\n${AJUDA}`), 2
  if (p.comando === 'ajuda') return saida(AJUDA), 0
  const config = lerConfig(env)
  if (!config.url || !config.serviceKey) return erro('erro: faltam SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente (docs/moderacao.md)'), 2
  try {
    const supabase = await (criarCliente ?? (async (c) => (await import('@supabase/supabase-js')).createClient(c.url, c.serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })))(config)
    const mod = criarModerador(supabase)
    if (p.comando === 'listar') {
      const itens = await mod.listar()
      saida(p.json ? JSON.stringify(itens, null, 2) : formatarLista(itens))
    } else if (p.comando === 'aceitar') {
      const r = await mod.aceitar(p.id, p.revisor)
      saida(`aceita: ${r.tipo === 'foto' ? 'foto apagada e avatar padrão' : `nome trocado por ${NOME_NEUTRO}`} (${r.denunciado})${r.tambemFechadas ? `; mais ${r.tambemFechadas} denúncia(s) do mesmo caso fechada(s)` : ''}`)
    } else {
      const r = await mod.rejeitar(p.id, p.revisor)
      saida(`rejeitada: ${r.id}`)
    }
    return 0
  } catch (e) {
    erro(`erro: ${e.moderacao ? e.message : `falha inesperada (${e.message})`}`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await executar(process.argv.slice(2))
