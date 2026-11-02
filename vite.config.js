import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { anexarLan } from './server/lan.js'
import { iniciarContas } from './server/contas.js'
import { criarContasFalsas } from './server/contasFalsas.js'

// Lobby do modo LAN (server/lan.js) também no `npm run dev` e no `vite preview`.
// Para o outro PC alcançar o dev: `npm run dev -- --host`. O jeito normal é `npm run lan`.
// ONLINE=1 npm run dev: o lobby do modo ONLINE (salas por código), para testar aqui.
// Contas (/api/config, /api/avatar): com as SUPABASE_* no ambiente (docs/supabase.md).
const online = ['1', 'true', 'sim'].includes(String(process.env.ONLINE ?? '').toLowerCase())
// DODGE_CONTAS_FALSAS=1 (só no dev): contas de teste e o banco falso (server/contasFalsas.js);
// com DODGE_SEMANA=n o boss semanal é o de n semanas para a frente (para testar a agenda)
const falsas = process.env.DODGE_CONTAS_FALSAS === '1'
const ligar = async (server) => {
  const contas = await iniciarContas(process.env)
  server.middlewares.use((req, res, next) => (contas.tratar(req, res) ? undefined : next()))
  const teste = falsas ? criarContasFalsas() : null
  if (server.httpServer) anexarLan(server.httpServer, { online, autenticar: teste?.autenticar ?? contas.autenticar, relacoes: contas.relacoes, registro: teste?.registro ?? contas.registro, deslocarSemana: falsas ? 7 * 86_400_000 * (Number(process.env.DODGE_SEMANA) || 0) : 0 })
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
