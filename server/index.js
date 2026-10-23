// `npm run lan`: serve o jogo já compilado (dist/) para a rede e liga o lobby
// LAN (server/lan.js). Os dois PCs abrem o endereço que aparece no terminal
// (ou cada um roda o seu: as salas de um aparecem no lobby do outro).
//   PORTA=5180 (padrão)
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { anexarLan, enderecosDoJogo } from './lan.js'

const PORTA = Number(process.env.PORTA ?? process.env.PORT ?? 5180)
const PASTA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
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

const servidor = http.createServer((req, res) => {
  let caminho
  try {
    caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  } catch {
    res.writeHead(400).end()
    return
  }
  let arquivo = path.join(PASTA, caminho)
  if (!arquivo.startsWith(PASTA)) {
    res.writeHead(403).end()
    return
  }
  if (!fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) arquivo = path.join(PASTA, 'index.html')
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
  fs.createReadStream(arquivo).pipe(res)
})

anexarLan(servidor)
servidor.on('error', (erro) => {
  console.error(erro.code === 'EADDRINUSE' ? `A porta ${PORTA} já está em uso. Tente: PORTA=5181 npm run lan` : erro)
  process.exit(1)
})
servidor.listen(PORTA, '0.0.0.0', () => {
  console.log('\n  DODGE · modo LAN ligado\n')
  console.log(`  Neste PC:       http://localhost:${PORTA}`)
  for (const url of enderecosDoJogo(PORTA)) console.log(`  Na rede (LAN):  ${url}`)
  console.log('\n  O outro PC abre um desses endereços no Chrome/Edge (ou roda o próprio npm run lan).')
  console.log('  Se o Windows perguntar, libere o Node no firewall (rede privada).\n')
})
