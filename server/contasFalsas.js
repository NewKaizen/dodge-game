// SÓ PARA O DESENVOLVIMENTO (DODGE_CONTAS_FALSAS=1 npm run dev; vite.config.js): contas de teste e o
// banco falso (server/supabase/fake.js) no lugar do Supabase, para ver o XP e o troféu do BOSS SEMANAL
// chegando sem um projeto de verdade. O navegador entra com window.debugConta.fingir({ id, nome })
// (src/lib/conta.js, só no dev), que manda o token 'falsa:<uuid>:<NOME>'. Nunca ligue em produção.
import crypto from 'node:crypto'
import { criarSupabaseFalso } from './supabase/fake.js'
import { criarRegistro } from './partidas.js'

export const BAUS_TESTE = 3
const TOKEN = /^falsa:([0-9a-f-]{36}):([A-Z0-9]{1,16})$/

export function criarContasFalsas({ agora = Date.now } = {}) {
  const sb = criarSupabaseFalso({ agora })
  return {
    sb,
    registro: criarRegistro(sb),
    async autenticar(token) {
      const m = TOKEN.exec(String(token ?? ''))
      if (!m) return null
      let perfil = sb.tabelas.perfis.find((p) => p.id === m[1])
      if (!perfil) {
        sb.tabelas.perfis.push((perfil = { id: m[1], tag: `${m[2]}#0001`, nome_exibicao: m[2], avatar_tipo: 'padrao', nivel: 1, xp: 0 }))
        // BAÚS (0015): a conta de teste já nasce com BAUS_TESTE baús fechados, para ver a tela e a abertura
        for (let i = 0; i < BAUS_TESTE; i++) sb.tabelas.baus.push({ id: crypto.randomUUID(), user_id: perfil.id, fonte: 'dia', chave: `dia:teste-${i + 1}`, criado_em: agora() + i, ordem: sb.tabelas.baus.length, aberto_em: null, xp: 0, resultado: null })
      }
      return { id: perfil.id, perfil }
    },
  }
}
