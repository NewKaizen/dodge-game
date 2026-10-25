import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { anexarLan } from './server/lan.js'
import { iniciarContas } from './server/contas.js'

// Lobby do modo LAN (server/lan.js) também no `npm run dev` e no `vite preview`.
// Para o outro PC alcançar o dev: `npm run dev -- --host`. O jeito normal é `npm run lan`.
// ONLINE=1 npm run dev: o lobby do modo ONLINE (salas por código), para testar aqui.
// Contas (/api/config, /api/avatar): com as SUPABASE_* no ambiente (docs/supabase.md).
const online = ['1', 'true', 'sim'].includes(String(process.env.ONLINE ?? '').toLowerCase())
const ligar = async (server) => {
  const contas = await iniciarContas(process.env)
  server.middlewares.use((req, res, next) => (contas.tratar(req, res) ? undefined : next()))
  if (server.httpServer) anexarLan(server.httpServer, { online, autenticar: contas.autenticar, relacoes: contas.relacoes, registro: contas.registro })
}
const lan = () => ({
  name: 'dodge-lan',
  configureServer: ligar,
  configurePreviewServer: ligar,
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), lan()],
})
