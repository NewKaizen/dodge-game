// Sobe um `vite` (dev) próprio numa porta livre para as ferramentas de desempenho
// (medir.mjs, paridade.mjs) e derruba no fim. Nada de porta fixa: dá para rodar
// com o `npm run dev` do dia a dia aberto ao lado.
//
//   const srv = await subirVite({ raiz })   // { url, parar }
//   ...
//   await srv.parar()
import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export function portaLivre() {
  return new Promise((ok, falha) => {
    const s = net.createServer()
    s.unref()
    s.on('error', falha)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => ok(port))
    })
  })
}

// raiz: a pasta do projeto a servir (outra árvore, ex.: a cópia de um ref do git na paridade)
export async function subirVite({ raiz = RAIZ, log = false, timeoutMs = 60_000 } = {}) {
  const porta = await portaLivre()
  const bin = path.join(raiz, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!fs.existsSync(bin)) throw new Error(`vite não encontrado em ${bin} (rode npm install)`)
  // detached: o vite vira líder de um grupo de processos, e o kill(-pid) derruba os filhos junto
  const filho = spawn(process.execPath, [bin, '--port', String(porta), '--strictPort', '--host', '127.0.0.1', '--clearScreen', 'false'], {
    cwd: raiz,
    env: { ...process.env, BROWSER: 'none', ONLINE: '', DODGE_CONTAS_FALSAS: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  let saida = ''
  const juntar = (b) => {
    saida += b
    if (log) process.stderr.write(b)
  }
  filho.stdout.on('data', juntar)
  filho.stderr.on('data', juntar)
  let parado = false
  const parar = async () => {
    if (parado) return
    parado = true
    try {
      process.kill(-filho.pid, 'SIGTERM')
    } catch {
      /* já saiu */
    }
    await new Promise((ok) => {
      const t = setTimeout(() => {
        try {
          process.kill(-filho.pid, 'SIGKILL')
        } catch {
          /* já saiu */
        }
        ok()
      }, 3000)
      filho.once('exit', () => {
        clearTimeout(t)
        ok()
      })
    })
  }
  // Ctrl+C / erro no meio: o vite não fica pendurado
  const aoSair = () => {
    try {
      process.kill(-filho.pid, 'SIGKILL')
    } catch {
      /* já saiu */
    }
  }
  process.once('exit', aoSair)
  for (const sinal of ['SIGINT', 'SIGTERM']) process.once(sinal, () => (aoSair(), process.exit(130)))

  const url = `http://127.0.0.1:${porta}/`
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    if (filho.exitCode !== null) throw new Error(`o vite saiu (código ${filho.exitCode}):\n${saida}`)
    try {
      const r = await fetch(url)
      if (r.ok) return { url, porta, parar, saida: () => saida }
    } catch {
      /* ainda subindo */
    }
    await new Promise((ok) => setTimeout(ok, 250))
  }
  await parar()
  throw new Error(`o vite não respondeu em ${timeoutMs} ms:\n${saida}`)
}
