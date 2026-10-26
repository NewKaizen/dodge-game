import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import sharp from 'sharp'
import { criarContas, lerConfig, configPublica, detectarTipo, criarLimite, tokenDoCabecalho, enderecoDoPedido, MAX_BYTES_AVATAR } from '../contas.js'
import { criarMetricas } from '../metricas.js'
import { criarSupabaseFalso } from '../supabase/fake.js'

const ID_ANA = '11111111-1111-4111-8111-111111111111'
const ID_BETO = '22222222-2222-4222-8222-222222222222'
const CONFIG = { disponivel: true, url: 'https://falso.supabase.co', anonKey: 'anon-publica', serviceKey: 'service-secreta' }
const perfil = (id, tag) => ({ id, tag, nome_exibicao: tag.split('#')[0], avatar_tipo: 'padrao', avatar_id: null, avatar_url: null, titulo_equipado: null, nivel: 1, xp: 0 })

let servidor, base, sb, relogio

function ligar(contas) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      if (!contas.tratar(req, res)) res.writeHead(404).end('estatico')
    })
    s.listen(0, '127.0.0.1', () => resolve(s))
  })
}

before(async () => {
  relogio = 1_000_000
  sb = criarSupabaseFalso({
    usuarios: { 'token-ana': { id: ID_ANA }, 'token-beto': { id: ID_BETO }, 'token-estranho': { id: '../../etc/passwd' } },
    perfis: [perfil(ID_ANA, 'ana#0001'), perfil(ID_BETO, 'beto#0002')],
  })
  servidor = await ligar(criarContas({ config: CONFIG, supabase: sb, agora: () => relogio }))
  base = `http://127.0.0.1:${servidor.address().port}`
})
after(() => servidor.close())

const png = (w = 300, h = 200) => sharp({ create: { width: w, height: h, channels: 3, background: '#e05080' } }).png().toBuffer()
const jpegComExif = () =>
  sharp({ create: { width: 128, height: 128, channels: 3, background: '#3060c0' } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Copyright: 'segredo-do-gps' } } })
    .toBuffer()

const enviar = (corpo, { token = 'token-ana', tipo = 'image/png', metodo = 'POST' } = {}) =>
  fetch(`${base}/api/avatar`, {
    method: metodo,
    headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(tipo && { 'Content-Type': tipo }) },
    body: corpo,
  })

test('config: sem variáveis = indisponível; a pública nunca tem a service_role', () => {
  assert.equal(lerConfig({}).disponivel, false)
  assert.equal(lerConfig({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'a' }).disponivel, false)
  const cfg = lerConfig({ SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' })
  assert.equal(cfg.disponivel, true)
  assert.equal(cfg.url, 'https://x.supabase.co')
  assert.deepEqual(configPublica(cfg), { disponivel: true, url: 'https://x.supabase.co', anonKey: 'a' })
  assert.doesNotMatch(JSON.stringify(configPublica(cfg)), /"s"/)
})

test('config: aceita os nomes novos do Supabase (publishable/secret)', () => {
  const cfg = lerConfig({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_a', SUPABASE_SECRET_KEY: 'sb_secret_s' })
  assert.equal(cfg.disponivel, true)
  assert.equal(cfg.serviceKey, 'sb_secret_s')
  assert.deepEqual(configPublica(cfg), { disponivel: true, url: 'https://x.supabase.co', anonKey: 'sb_publishable_a' })
  assert.equal(lerConfig({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'a' }).disponivel, false)
})

test('GET /api/config', async () => {
  const r = await fetch(`${base}/api/config`)
  assert.equal(r.status, 200)
  const corpo = await r.json()
  assert.deepEqual(corpo, { disponivel: true, url: CONFIG.url, anonKey: 'anon-publica' })
  assert.doesNotMatch(JSON.stringify(corpo), /service-secreta/)
})

test('servidor sem Supabase: config indisponível, avatar 503, resto não é com a gente', async () => {
  const s = await ligar(criarContas())
  const b = `http://127.0.0.1:${s.address().port}`
  try {
    assert.deepEqual(await (await fetch(`${b}/api/config`)).json(), { disponivel: false })
    assert.equal((await fetch(`${b}/api/avatar`, { method: 'POST', body: 'x' })).status, 503)
    assert.equal(await (await fetch(`${b}/index.html`)).text(), 'estatico')
  } finally {
    s.close()
  }
})

test('bytes mágicos', async () => {
  assert.equal(detectarTipo(await png()), 'png')
  assert.equal(detectarTipo(await jpegComExif()), 'jpeg')
  assert.equal(detectarTipo(await sharp(await png()).webp().toBuffer()), 'webp')
  assert.equal(detectarTipo(Buffer.from('GIF89a..........')), null)
  assert.equal(detectarTipo(Buffer.from('<svg xmlns=...></svg>')), null)
  assert.equal(detectarTipo(Buffer.alloc(4)), null)
})

test('cabeçalho Authorization', () => {
  assert.equal(tokenDoCabecalho({ headers: { authorization: 'Bearer abc.def' } }), 'abc.def')
  assert.equal(tokenDoCabecalho({ headers: { authorization: 'Basic abc' } }), null)
  assert.equal(tokenDoCabecalho({ headers: {} }), null)
  assert.equal(tokenDoCabecalho({ headers: { authorization: `Bearer ${'x'.repeat(5000)}` } }), null)
})

test('sem login ou token inválido: 401 e nada gravado', async () => {
  const img = await png()
  assert.equal((await enviar(img, { token: null })).status, 401)
  assert.equal((await enviar(img, { token: 'token-falso' })).status, 401)
  // id esquisito que viesse do Auth não vira caminho no bucket
  assert.equal((await enviar(img, { token: 'token-estranho' })).status, 401)
  assert.equal(sb.arquivos.size, 0)
})

test('tipo errado: 415', async () => {
  const r = await enviar(Buffer.from('GIF89a' + 'x'.repeat(100)), { tipo: 'image/gif', token: 'token-beto' })
  assert.equal(r.status, 415)
  assert.match((await r.json()).erro, /PNG, JPEG ou WebP/)
})

test('bytes mágicos que não batem com o Content-Type: 415', async () => {
  relogio += 120_000
  assert.equal((await enviar(Buffer.from('<svg onload=alert(1)>' + ' '.repeat(100)), { token: 'token-beto' })).status, 415)
  assert.equal((await enviar(await jpegComExif(), { tipo: 'image/png', token: 'token-beto' })).status, 415)
})

test('PNG com cabeçalho certo e o resto lixo: 400', async () => {
  relogio += 120_000
  const lixo = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 7)])
  assert.equal((await enviar(lixo, { token: 'token-beto' })).status, 400)
})

test('grande demais: 413 (pelo Content-Length e lendo o corpo)', async () => {
  relogio += 120_000
  const grande = Buffer.alloc(MAX_BYTES_AVATAR + 1, 0)
  grande.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.equal((await enviar(grande, { token: 'token-beto' })).status, 413)

  // sem Content-Length (chunked): corta no meio da leitura
  const status = await new Promise((resolve, reject) => {
    const req = http.request(`${base}/api/avatar`, { method: 'POST', headers: { Authorization: 'Bearer token-beto', 'Content-Type': 'image/png', 'Transfer-Encoding': 'chunked' } }, (res) => resolve(res.statusCode))
    req.on('error', reject)
    for (let i = 0; i < 5; i++) req.write(Buffer.alloc(600 * 1024, 1))
    req.end()
  })
  assert.equal(status, 413)
})

test('dimensões fora do limite: 400', async () => {
  relogio += 120_000
  const r = await enviar(await png(32, 32), { token: 'token-beto' })
  assert.equal(r.status, 400)
  assert.match((await r.json()).erro, /pequena/)
  assert.equal((await enviar(await png(5000, 64), { token: 'token-beto' })).status, 400)
})

test('sucesso: WebP 256x256 sem metadados em avatares/<id>.webp e perfil atualizado', async () => {
  relogio += 120_000
  const r = await enviar(await jpegComExif(), { tipo: 'image/jpeg' })
  assert.equal(r.status, 200)
  const { perfil } = await r.json()
  assert.equal(perfil.avatar_tipo, 'enviado')
  assert.equal(perfil.avatar_id, null)
  assert.equal(perfil.avatar_url, `https://falso.supabase.co/storage/v1/object/public/avatares/${ID_ANA}.webp?v=${relogio}`)

  const guardado = sb.arquivos.get(`avatares/${ID_ANA}.webp`)
  assert.ok(guardado)
  assert.equal(guardado.opcoes.contentType, 'image/webp')
  assert.equal(guardado.opcoes.upsert, true)
  const meta = await sharp(guardado.dados).metadata()
  assert.equal(meta.format, 'webp')
  assert.equal(meta.width, 256)
  assert.equal(meta.height, 256)
  assert.equal(meta.exif, undefined)
  assert.doesNotMatch(guardado.dados.toString('latin1'), /segredo-do-gps/)
  assert.equal(sb.tabelas.perfis.find((p) => p.id === ID_ANA).avatar_tipo, 'enviado')
})

test('falha no Storage: 502 e o perfil não muda', async () => {
  relogio += 120_000
  sb.falhar.upload = true
  try {
    const antes = { ...sb.tabelas.perfis.find((p) => p.id === ID_BETO) }
    assert.equal((await enviar(await png(), { token: 'token-beto' })).status, 502)
    assert.deepEqual(sb.tabelas.perfis.find((p) => p.id === ID_BETO), antes)
  } finally {
    sb.falhar.upload = false
  }
})

test('DELETE /api/avatar apaga a foto e volta para o padrão', async () => {
  relogio += 120_000
  assert.equal((await enviar(null, { metodo: 'DELETE', token: null, tipo: null })).status, 401)
  const r = await enviar(null, { metodo: 'DELETE', tipo: null })
  assert.equal(r.status, 200)
  const { perfil } = await r.json()
  assert.equal(perfil.avatar_tipo, 'padrao')
  assert.equal(perfil.avatar_url, null)
  assert.equal(sb.arquivos.has(`avatares/${ID_ANA}.webp`), false)
  assert.deepEqual(sb.chamadas.filter((c) => c.op === 'remove').at(-1).caminhos, [`${ID_ANA}.webp`])
})

test('limite: 5 envios por minuto por usuário', async () => {
  relogio += 120_000
  const img = await png(64, 64)
  const status = []
  for (let i = 0; i < 6; i++) status.push((await enviar(img, { token: 'token-beto' })).status)
  assert.deepEqual(status, [200, 200, 200, 200, 200, 429])
  // o limite é de cada um
  assert.equal((await enviar(img)).status, 200)
  relogio += 61_000
  assert.equal((await enviar(img, { token: 'token-beto' })).status, 200)
})

test('criarLimite: janela deslizante', () => {
  let t = 0
  const l = criarLimite({ max: 2, janelaMs: 1000, agora: () => t })
  assert.equal(l.usar('a'), true)
  t = 500
  assert.equal(l.usar('a'), true)
  assert.equal(l.usar('a'), false)
  t = 1001
  assert.equal(l.usar('a'), true)
  assert.equal(l.usar('b'), true)
})

test('rota desconhecida e método errado', async () => {
  assert.equal((await fetch(`${base}/api/nada`)).status, 404)
  assert.equal((await fetch(`${base}/api/avatar`)).status, 405)
  assert.equal((await fetch(`${base}/api/config`, { method: 'POST' })).status, 405)
})

test('limite por endereço: token falso não passa de N pedidos por minuto e nem chega no Supabase Auth', async () => {
  const falso = criarSupabaseFalso({ usuarios: {}, perfis: [] })
  let t = 5_000_000
  const metricas = criarMetricas({ agora: () => t, escrever: () => {} })
  const s = await ligar(criarContas({ config: CONFIG, supabase: falso, agora: () => t, limiteIp: criarLimite({ max: 3, agora: () => t }), metricas }))
  const url = `http://127.0.0.1:${s.address().port}/api/avatar`
  const pedir = (token) => fetch(url, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} })
  try {
    assert.equal((await pedir('falso-1')).status, 401)
    assert.equal((await pedir(null)).status, 401) // sem token também conta
    assert.equal((await pedir('falso-2')).status, 401)
    const chamadasAntes = falso.chamadas.filter((c) => c.op === 'getUser').length
    const r = await pedir('falso-3')
    assert.equal(r.status, 429)
    assert.match((await r.json()).erro, /muitos pedidos deste endereço/)
    assert.equal(falso.chamadas.filter((c) => c.op === 'getUser').length, chamadasAntes, 'barrado antes do Supabase Auth')
    assert.equal(metricas.resumo().contadores.avatar_bloqueios_ip, 1)
    // passou o minuto: libera
    t += 61_000
    assert.equal((await pedir('falso-4')).status, 401)
    // GET /api/config não entra na conta
    for (let i = 0; i < 6; i++) assert.equal((await fetch(`http://127.0.0.1:${s.address().port}/api/config`)).status, 200)
  } finally {
    s.close()
  }
})

test('enderecoDoPedido: sem proxy o socket; com proxy a última entrada do X-Forwarded-For (a do nosso proxy)', () => {
  const req = (xff) => ({ headers: xff ? { 'x-forwarded-for': xff } : {}, socket: { remoteAddress: '10.0.0.9' } })
  assert.equal(enderecoDoPedido(req('1.1.1.1, 2.2.2.2')), '10.0.0.9') // header de cliente não vale sem proxy confiável
  assert.equal(enderecoDoPedido(req('6.6.6.6, 2.2.2.2'), { confiarProxy: true }), '2.2.2.2') // 6.6.6.6 pode ser forjado
  assert.equal(enderecoDoPedido(req(null), { confiarProxy: true }), '10.0.0.9')
})

test('métricas do avatar: envio ok e envio que falhou (login e limite não contam como falha)', async () => {
  const falso = criarSupabaseFalso({ usuarios: { 'token-ana': { id: ID_ANA } }, perfis: [perfil(ID_ANA, 'ana#0001')] })
  const metricas = criarMetricas({ escrever: () => {} })
  const s = await ligar(criarContas({ config: CONFIG, supabase: falso, metricas }))
  const url = `http://127.0.0.1:${s.address().port}/api/avatar`
  const enviarPng = (token) => png().then((corpo) => fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' }, body: corpo }))
  try {
    assert.equal((await enviarPng('token-ana')).status, 200)
    assert.equal((await enviarPng('token-nenhum')).status, 401)
    falso.falhar.upload = true
    assert.equal((await enviarPng('token-ana')).status, 502)
    const c = metricas.resumo().contadores
    assert.deepEqual([c.avatar_envios_ok, c.avatar_envios_falha], [1, 1])
  } finally {
    s.close()
  }
})
