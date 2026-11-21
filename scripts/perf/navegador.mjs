// O Chromium do Playwright para as ferramentas de desempenho. Usa o `playwright` das
// devDependencies; se não houver, o instalado globalmente (o do ambiente do Claude).
// Os navegadores vêm do PLAYWRIGHT_BROWSERS_PATH (ou de `npx playwright install chromium`).
import fs from 'node:fs'

async function carregarPlaywright() {
  try {
    return await import('playwright')
  } catch {
    const global = '/opt/node22/lib/node_modules/playwright/index.mjs'
    if (fs.existsSync(global)) return await import(global)
    throw new Error('playwright não encontrado: rode `npm install` (e `npx playwright install chromium` se faltar o navegador)')
  }
}

export const ARGS_CHROMIUM = [
  '--autoplay-policy=no-user-gesture-required',
  '--enable-precise-memory-info',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
]

export async function abrirNavegador({ args = [] } = {}) {
  const { chromium } = await carregarPlaywright()
  return chromium.launch({ args: [...ARGS_CHROMIUM, ...args] })
}

// Abre o jogo e espera o Menu (o debugJogo só existe no dev)
export async function abrirJogo(navegador, url, { largura, altura, query = '', antes, timeoutMs = 90_000 } = {}) {
  const pagina = await navegador.newPage({ viewport: { width: largura, height: altura } })
  const erros = []
  pagina.on('pageerror', (e) => erros.push(String(e.stack || e).slice(0, 600)))
  if (antes) await antes(pagina)
  await pagina.goto(url + (query ? `?${query}` : ''))
  await pagina.waitForFunction(() => window.debugJogo?.cena?.().includes('Menu'), null, { timeout: timeoutMs })
  return { pagina, erros }
}
