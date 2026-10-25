// Serve o jogo já compilado (dist/) e liga o lobby (server/lan.js).
//
//   `npm run lan`   modo LAN: os dois PCs abrem o endereço que aparece no
//                   terminal (ou cada um roda o seu: as salas de um aparecem
//                   no lobby do outro). docs/lan.md
//   `npm start`     modo ONLINE (--online): o servidor na internet (Render,
//                   Railway, VPS...); os amigos abrem o site e entram na sala
//                   pelo código. docs/online.md
//
//   PORTA ou PORT=5180 (padrão)
//   ONLINE=1                     o mesmo que --online
//   STUN_URLS=stun:a:3478,stun:b:3478   (online; padrão: os do Google)
//   TURN_URL, TURN_USUARIO, TURN_SENHA  (online; para quem o STUN não resolve)
//   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY
//                                (ou os nomes antigos SUPABASE_ANON_KEY e
//                                SUPABASE_SERVICE_ROLE_KEY)
//                                (contas com login Google; opcionais: sem elas
//                                o jogo roda igual, só sem contas. docs/supabase.md.
//                                A service_role fica só aqui no servidor)
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { anexarLan, enderecosDoJogo } from './lan.js'
import { iniciarContas } from './contas.js'

const PORTA = Number(process.env.PORTA ?? process.env.PORT ?? 5180)
const ONLINE = process.argv.includes('--online') || ['1', 'true', 'sim'].includes(String(process.env.ONLINE ?? '').toLowerCase())
const PASTA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const STUN_PADRAO = 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'

// Servidores do WebRTC que os navegadores usam para se achar pela internet
function servidoresIce() {
  const env = process.env
  const lista = []
  const stun = String(env.STUN_URLS ?? (ONLINE ? STUN_PADRAO : ''))
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
  if (stun.length) lista.push({ urls: stun })
  if (env.TURN_URL) {
    const turn = env.TURN_URL.split(',').map((u) => u.trim()).filter(Boolean)
    lista.push({ urls: turn, username: env.TURN_USUARIO ?? '', credential: env.TURN_SENHA ?? '' })
  }
  return lista
}
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mid': 'audio/midi',
  '.sf2': 'application/octet-stream',
  '.sf3': 'application/octet-stream',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

if (!fs.existsSync(path.join(PASTA, 'index.html'))) {
  console.error('Não achei dist/index.html. Rode "npm run lan" (ele compila antes) ou "npm run build".')
  process.exit(1)
}

const contas = await iniciarContas(process.env)

const servidor = http.createServer((req, res) => {
  // /api/config, /api/avatar (server/contas.js)
  if (contas.tratar(req, res)) return
  let caminho
  try {
    caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  } catch {
    res.writeHead(400).end()
    return
  }
  if (caminho === '/saude') {
    // para o "health check" da hospedagem
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }).end('ok')
    return
  }
  let arquivo = path.join(PASTA, caminho)
  // path.sep no fim: "/dist-outra/..." também começa com ".../dist"
  if (arquivo !== PASTA && !arquivo.startsWith(PASTA + path.sep)) {
    res.writeHead(403).end()
    return
  }
  if (!fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) arquivo = path.join(PASTA, 'index.html')
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
  fs.createReadStream(arquivo).pipe(res)
})

const ice = servidoresIce()
anexarLan(servidor, { online: ONLINE, ice, autenticar: contas.autenticar })
servidor.on('error', (erro) => {
  console.error(erro.code === 'EADDRINUSE' ? `A porta ${PORTA} já está em uso. Tente: PORTA=5181 npm run ${ONLINE ? 'start' : 'lan'}` : erro)
  process.exit(1)
})
servidor.listen(PORTA, '0.0.0.0', () => {
  if (ONLINE) {
    console.log(`\n  DODGE · modo ONLINE ligado na porta ${PORTA}\n`)
    console.log(`  Neste PC: http://localhost:${PORTA}`)
    console.log(`  WebRTC:   ${ice.length ? ice.map((s) => [s.urls].flat().join(', ')).join(' | ') : 'sem STUN/TURN'}`)
    console.log(`  Contas:   ${contas.disponivel ? 'ligadas (Supabase)' : 'desligadas (sem SUPABASE_*: docs/supabase.md)'}`)
    if (!process.env.TURN_URL) console.log('  (sem TURN: quem estiver atrás de NAT difícil cai na imagem reserva, sem som)')
    console.log('\n  Os amigos abrem o endereço público do site, um cria a sala e passa o código.\n')
    return
  }
  console.log('\n  DODGE · modo LAN ligado\n')
  console.log(`  Neste PC:       http://localhost:${PORTA}`)
  for (const url of enderecosDoJogo(PORTA)) console.log(`  Na rede (LAN):  ${url}`)
  console.log('\n  O outro PC abre um desses endereços no Chrome/Edge (ou roda o próprio npm run lan).')
  console.log('  Se o Windows perguntar, libere o Node no firewall (rede privada).\n')
})
