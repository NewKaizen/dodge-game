// Contas (Supabase): config pública para o navegador, validação do JWT e a
// foto de perfil. Guia de configuração: docs/supabase.md.
//
// Sem as variáveis SUPABASE_* o servidor funciona igual (LAN, casual): o
// /api/config responde { disponivel: false } e o jogo mostra "contas
// indisponíveis". A chave service_role fica SÓ aqui; o navegador recebe só a
// URL e a chave anon.
//
//   GET    /api/config   { disponivel, url?, anonKey? }
//   POST   /api/avatar   corpo = a imagem (PNG/JPEG/WebP, até 2 MB), Authorization: Bearer <JWT>
//                       -> recodifica em WebP 256x256 (sem metadados) e grava avatares/<id>.webp
//   DELETE /api/avatar   apaga a foto e volta para o avatar padrão
//
//   const contas = await iniciarContas(process.env)
//   contas.tratar(req, res)   true se a rota é daqui (já respondeu ou vai responder)
//   contas.autenticar(token)  { id, perfil } | null  (o lobby usa no "ola")
//   contas.relacoes(userId)   { amigos, bloqueios, pedidos } | null  (server/amigos.js; o lobby filtra presença e convites)
//   contas.registro           o banco das partidas e do XP (server/partidas.js) | null

import { criarRelacoes } from './amigos.js'
import { criarRegistro } from './partidas.js'

export const BUCKET_AVATARES = 'avatares'
export const MAX_BYTES_AVATAR = 2 * 1024 * 1024
export const LADO_AVATAR = 256
export const MIN_LADO_ENTRADA = 64
export const MAX_LADO_ENTRADA = 4096
export const ENVIOS_POR_MINUTO = 5
const MAX_TOKEN = 4096
const TIPOS_ACEITOS = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const COLUNAS_PERFIL = 'id, tag, nome_exibicao, avatar_tipo, avatar_id, avatar_url, titulo_equipado, nivel, xp'

// ---------- config ----------

export function lerConfig(env = process.env) {
  const url = String(env.SUPABASE_URL ?? '').trim()
  // nomes novos do Supabase (publishable/secret) ou os antigos (anon/service_role)
  const anonKey = String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim()
  const serviceKey = String(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const urlValida = /^https?:\/\/[^\s/]+/.test(url)
  return { url: url.replace(/\/+$/, ''), anonKey, serviceKey, disponivel: Boolean(urlValida && anonKey && serviceKey) }
}

// o que o navegador pode saber (nunca a service_role)
export const configPublica = (config) => (config.disponivel ? { disponivel: true, url: config.url, anonKey: config.anonKey } : { disponivel: false })

// ---------- JWT ----------

export function tokenDoCabecalho(req) {
  const valor = String(req.headers?.authorization ?? '')
  const m = /^Bearer\s+(\S+)$/i.exec(valor)
  return m && m[1].length <= MAX_TOKEN ? m[1] : null
}

// token -> { id, perfil } | null. Nunca lança: erro de rede = convidado.
export function criarAutenticador(supabase, { tempoMs = 2500 } = {}) {
  return async function autenticar(token) {
    if (!supabase || typeof token !== 'string' || !token || token.length > MAX_TOKEN) return null
    let timer
    const limite = new Promise((resolve) => (timer = setTimeout(() => resolve(null), tempoMs)))
    const validar = (async () => {
      const { data, error } = await supabase.auth.getUser(token)
      const id = data?.user?.id
      if (error || !id || !UUID.test(id)) return null
      const r = await supabase.from('perfis').select(COLUNAS_PERFIL).eq('id', id).maybeSingle()
      return { id, perfil: r.error ? null : r.data ?? null }
    })().catch(() => null)
    try {
      return await Promise.race([validar, limite])
    } finally {
      clearTimeout(timer)
    }
  }
}

// ---------- imagem ----------

// tipo pelos primeiros bytes (não confia na extensão nem no Content-Type)
export function detectarTipo(buf) {
  if (!buf || buf.length < 12) return null
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return 'png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp'
  return null
}

class ErroHttp extends Error {
  constructor(status, msg) {
    super(msg)
    this.status = status
  }
}

let sharpCarregado = null
const carregarSharp = async () => (sharpCarregado ??= (await import('sharp')).default)

// buf (já conferido pelos bytes mágicos) -> WebP 256x256 sem metadados
export async function processarAvatar(buf, tipo) {
  const sharp = await carregarSharp()
  const opcoes = { limitInputPixels: MAX_LADO_ENTRADA * MAX_LADO_ENTRADA, failOn: 'error' }
  let meta
  try {
    meta = await sharp(buf, opcoes).metadata()
  } catch {
    throw new ErroHttp(400, 'imagem corrompida ou grande demais')
  }
  if (meta.format !== tipo) throw new ErroHttp(400, 'o conteúdo não bate com o tipo da imagem')
  const { width: w = 0, height: h = 0 } = meta
  if (w < MIN_LADO_ENTRADA || h < MIN_LADO_ENTRADA) throw new ErroHttp(400, `imagem pequena demais (mínimo ${MIN_LADO_ENTRADA}x${MIN_LADO_ENTRADA})`)
  if (w > MAX_LADO_ENTRADA || h > MAX_LADO_ENTRADA) throw new ErroHttp(400, `imagem grande demais (máximo ${MAX_LADO_ENTRADA}x${MAX_LADO_ENTRADA})`)
  try {
    // sem .withMetadata(): o sharp joga fora EXIF, GPS, ICC etc.
    return await sharp(buf, { ...opcoes, animated: false })
      .rotate()
      .resize(LADO_AVATAR, LADO_AVATAR, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82 })
      .toBuffer()
  } catch {
    throw new ErroHttp(400, 'não deu para ler a imagem')
  }
}

// ---------- limite de envios ----------

export function criarLimite({ max = ENVIOS_POR_MINUTO, janelaMs = 60_000, agora = Date.now } = {}) {
  const vezes = new Map() // id -> [instantes]
  return {
    // true = pode; false = passou do limite
    usar(id) {
      const t = agora()
      const lista = (vezes.get(id) ?? []).filter((x) => t - x < janelaMs)
      if (lista.length >= max) {
        vezes.set(id, lista)
        return false
      }
      lista.push(t)
      vezes.set(id, lista)
      if (vezes.size > 10_000) for (const [k, v] of vezes) if (!v.some((x) => t - x < janelaMs)) vezes.delete(k)
      return true
    },
  }
}

// ---------- HTTP ----------

function responder(res, status, corpo) {
  if (res.headersSent) return
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify(corpo))
}

function lerCorpo(req, max) {
  return new Promise((resolve, reject) => {
    const tamanho = Number(req.headers['content-length'])
    if (Number.isFinite(tamanho) && tamanho > max) return reject(new ErroHttp(413, 'imagem grande demais (máximo 2 MB)'))
    const partes = []
    let total = 0
    let acabou = false
    req.on('data', (parte) => {
      if (acabou) return
      total += parte.length
      if (total > max) {
        acabou = true
        partes.length = 0
        reject(new ErroHttp(413, 'imagem grande demais (máximo 2 MB)'))
        return
      }
      partes.push(parte)
    })
    req.on('end', () => !acabou && ((acabou = true), resolve(Buffer.concat(partes))))
    req.on('error', (e) => !acabou && ((acabou = true), reject(e)))
  })
}

// supabase: cliente com a service_role (ou o falso dos testes)
// autenticar: token -> { id, perfil } | null (padrão: o do supabase)
// processarImagem: (buf, tipo) -> WebP (padrão: sharp)
export function criarContas({ config = { disponivel: false }, supabase = null, autenticar, processarImagem = processarAvatar, agora = Date.now, limite } = {}) {
  const ativo = Boolean(config.disponivel && supabase)
  const auth = autenticar ?? (ativo ? criarAutenticador(supabase) : async () => null)
  const limiteEnvios = limite ?? criarLimite({ agora })
  const caminhoDe = (id) => {
    if (!UUID.test(id)) throw new ErroHttp(401, 'sessão inválida')
    return `${id.toLowerCase()}.webp`
  }

  async function quem(req) {
    const token = tokenDoCabecalho(req)
    if (!token) throw new ErroHttp(401, 'precisa estar logado')
    const conta = await auth(token)
    if (!conta?.id || !UUID.test(conta.id)) throw new ErroHttp(401, 'sessão inválida: entre de novo')
    return conta
  }

  async function enviarAvatar(req) {
    const conta = await quem(req)
    if (!limiteEnvios.usar(conta.id)) throw new ErroHttp(429, `muitos envios: espere um minuto (máximo ${ENVIOS_POR_MINUTO} por minuto)`)
    const declarado = TIPOS_ACEITOS[String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()]
    if (!declarado) throw new ErroHttp(415, 'só PNG, JPEG ou WebP')
    const buf = await lerCorpo(req, MAX_BYTES_AVATAR)
    if (!buf.length) throw new ErroHttp(400, 'imagem vazia')
    const tipo = detectarTipo(buf)
    if (!tipo || tipo !== declarado) throw new ErroHttp(415, 'o arquivo não é um PNG, JPEG ou WebP de verdade')
    const webp = await processarImagem(buf, tipo)
    const caminho = caminhoDe(conta.id)
    const envio = await supabase.storage.from(BUCKET_AVATARES).upload(caminho, webp, { contentType: 'image/webp', upsert: true, cacheControl: '3600' })
    if (envio.error) throw new ErroHttp(502, 'não deu para guardar a foto: tente de novo')
    const publica = supabase.storage.from(BUCKET_AVATARES).getPublicUrl(caminho).data.publicUrl
    // ?v= troca a URL a cada envio (o navegador e a CDN não mostram a velha)
    const avatar_url = `${publica}?v=${agora()}`
    const r = await supabase.from('perfis').update({ avatar_tipo: 'enviado', avatar_id: null, avatar_url }).eq('id', conta.id).select(COLUNAS_PERFIL).single()
    if (r.error) throw new ErroHttp(502, 'a foto subiu, mas não deu para atualizar o perfil')
    return { perfil: r.data }
  }

  async function apagarAvatar(req) {
    const conta = await quem(req)
    if (!limiteEnvios.usar(conta.id)) throw new ErroHttp(429, 'muitas mudanças: espere um minuto')
    const caminho = caminhoDe(conta.id)
    const atual = await supabase.from('perfis').select(COLUNAS_PERFIL).eq('id', conta.id).maybeSingle()
    if (atual.error || !atual.data) throw new ErroHttp(404, 'perfil não encontrado')
    const remocao = await supabase.storage.from(BUCKET_AVATARES).remove([caminho])
    if (remocao.error) throw new ErroHttp(502, 'não deu para apagar a foto: tente de novo')
    const mudanca = atual.data.avatar_tipo === 'enviado' ? { avatar_tipo: 'padrao', avatar_id: null, avatar_url: null } : { avatar_url: null }
    const r = await supabase.from('perfis').update(mudanca).eq('id', conta.id).select(COLUNAS_PERFIL).single()
    if (r.error) throw new ErroHttp(502, 'não deu para atualizar o perfil')
    return { perfil: r.data }
  }

  const rotas = {
    'GET /api/config': async () => configPublica(ativo ? config : { disponivel: false }),
    'POST /api/avatar': enviarAvatar,
    'DELETE /api/avatar': apagarAvatar,
  }

  return {
    disponivel: ativo,
    autenticar: ativo || autenticar ? auth : null,
    relacoes: ativo ? criarRelacoes(supabase) : null,
    registro: ativo ? criarRegistro(supabase) : null,
    // devolve true se a rota é daqui; a resposta sai depois (promise em .pronto)
    tratar(req, res) {
      const caminho = new URL(req.url, 'http://x').pathname
      if (!caminho.startsWith('/api/')) return false
      const rota = rotas[`${req.method} ${caminho}`]
      if (!rota) {
        responder(res, caminho === '/api/config' || caminho === '/api/avatar' ? 405 : 404, { erro: 'rota não existe' })
        return true
      }
      if (caminho !== '/api/config' && !ativo) {
        responder(res, 503, { erro: 'contas indisponíveis neste servidor' })
        return true
      }
      res.pronto = rota(req)
        .then((corpo) => responder(res, 200, corpo))
        .catch((e) => {
          if (!(e instanceof ErroHttp)) console.error('[contas]', e)
          responder(res, e instanceof ErroHttp ? e.status : 500, { erro: e instanceof ErroHttp ? e.message : 'erro no servidor' })
          // corpo grande demais: não fica lendo o resto
          if (e?.status === 413) res.on('finish', () => req.destroy())
        })
      return true
    },
  }
}

// Liga com as variáveis de ambiente. Sem elas (ou sem o pacote), contas
// desligadas e o jogo segue normal.
export async function iniciarContas(env = process.env, { log = console.log } = {}) {
  const config = lerConfig(env)
  if (!config.disponivel) {
    if (Object.keys(env).some((k) => k.startsWith('SUPABASE_') && env[k])) log('[contas] faltam variáveis SUPABASE_*: contas desligadas (docs/supabase.md)')
    return criarContas()
  }
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(config.url, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    return criarContas({ config, supabase })
  } catch (e) {
    log(`[contas] não deu para ligar o Supabase (${e.message}): contas desligadas`)
    return criarContas()
  }
}
