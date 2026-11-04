// ESLint (flat config): só regras de CORREÇÃO, sem estilo. O objetivo é pegar nomes
// não declarados (um `alternarSerial` sem import vira ReferenceError só em produção),
// chaves duplicadas, código inalcançável e imports reatribuídos. Não reformata nada.
// Rodar com `npm run lint` (os testes do `npm test` não dependem disto).
import globals from 'globals'
import svelte from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'

// Globais do navegador (Phaser/Svelte rodam aqui), do Node (server/, scripts/, testes)
// e do ES2024. O `import.meta.env` do Vite é sintaxe de módulo: não precisa de global.
const GLOBAIS = { ...globals.browser, ...globals.node, ...globals.es2024 }

const REGRAS = {
  'no-undef': 'error',
  'no-dupe-keys': 'error',
  'no-unreachable': 'error',
  'no-redeclare': 'error',
  'no-import-assign': 'error',
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
}

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**', 'supabase/**', 'coverage/**'],
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: GLOBAIS,
    },
    rules: REGRAS,
  },
  ...svelte.configs['flat/base'].map((c) => ({ ...c, files: ['**/*.svelte'] })),
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { parser: null },
      globals: GLOBAIS,
    },
    rules: REGRAS,
  },
]
