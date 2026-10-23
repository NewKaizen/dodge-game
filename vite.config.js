import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { anexarLan } from './server/lan.js'

// Lobby do modo LAN (server/lan.js) também no `npm run dev` e no `vite preview`.
// Para o outro PC alcançar o dev: `npm run dev -- --host`. O jeito normal é `npm run lan`.
const lan = () => ({
  name: 'dodge-lan',
  configureServer(server) {
    if (server.httpServer) anexarLan(server.httpServer)
  },
  configurePreviewServer(server) {
    if (server.httpServer) anexarLan(server.httpServer)
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), lan()],
})
