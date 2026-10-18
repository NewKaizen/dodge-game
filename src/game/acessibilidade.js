import { pref, aoMudarPref, OPCOES, PREFERENCIAS_PADRAO } from './preferencias.js'

// O quanto de cada efeito visual entra na tela, tirado das preferências
// (preferencias.js). Lógica pura, sem Phaser (testada em __tests__): quem
// desenha (effects/*, backgrounds, telão, replay) só multiplica pelo fator.
// A JOGABILIDADE nunca passa por aqui: balas, avisos, faixa de aproximação e
// hitbox são iguais em todos os níveis.
//
//   fatores()          os fatores agora (recalcula quando uma preferência muda)
//   fatoresDe(prefs)   os mesmos, de um objeto de preferências qualquer
//
//   tremor       multiplica a intensidade dos tremores (tela, caixa, HUD); 0 = nenhum
//   clarao       multiplica o alpha dos clarões de tela; 0 = nenhum
//   particulas   fração das partículas que nascem (faíscas, cacos, rastros de faísca)
//   festa        fração do confete e dos fogos (comemoração pura)
//   fundo        'animado' | 'parado' (fundos das arenas/menu congelam no 1º quadro)
//   velocidadeFundo  multiplica o tempo dos fundos animados (piscadas mais lentas)
//   filtros      filtros de câmera que são só enfeite (ColorMatrix do K.O. etc.)
//   rastros      rastros decorativos (a carta voando, cópias que somem)
//   zoom         multiplica a amplitude dos zooms/trancos de câmera decorativos
//   lenta        multiplica a duração das câmeras lentas decorativas (K.O.)
//   piscar       piscadas rápidas decorativas (chiado do telão, placar piscando)
//   balasTelao   quantas balas a mini-luta do telão do menu pode ter vivas
const TREMOR = { normal: 1, reduzido: 0.4, desligado: 0 }
//                     mínimo médio máximo
const PARTICULAS = [0.15, 0.5, 1]
const FESTA = [0.05, 0.4, 1]
const BALAS_TELAO = [24, 50, 80]

export function fatoresDe(prefs = {}) {
  const p = { ...PREFERENCIAS_PADRAO, ...prefs }
  let nivel = OPCOES.graficos.indexOf(p.graficos)
  if (nivel < 0) nivel = OPCOES.graficos.length - 1
  const calmo = Boolean(p.reduzirMovimento)
  let tremor = TREMOR[p.tremor] ?? 1
  // "reduzir animações" também amansa o tremor (mas não liga o que foi desligado)
  if (calmo) tremor = Math.min(tremor, 0.3)
  let clarao = p.flashes === false ? 0 : 1
  if (calmo) clarao = Math.min(clarao, 0.25)
  return {
    nivel,
    tremor,
    clarao,
    particulas: PARTICULAS[nivel],
    festa: FESTA[nivel],
    fundo: nivel === 0 ? 'parado' : 'animado',
    velocidadeFundo: calmo ? 0.5 : 1,
    filtros: nivel === 2,
    rastros: nivel > 0,
    zoom: calmo ? 0.3 : 1,
    lenta: calmo ? 0.5 : 1,
    piscar: !calmo,
    balasTelao: BALAS_TELAO[nivel],
  }
}

// cache: os efeitos perguntam isto a cada partícula/tremor
const CHAVES = ['graficos', 'reduzirMovimento', 'tremor', 'flashes']
let atual = null
export function fatores() {
  if (!atual) atual = fatoresDe(Object.fromEntries(CHAVES.map((k) => [k, pref(k)])))
  return atual
}
aoMudarPref((chave) => {
  if (CHAVES.includes(chave)) atual = null
})

// quantas partículas de `n` (sorteio no arredondamento: 10 x 0.15 dá 1 ou 2)
export function quantas(n, fracao, sorte = Math.random) {
  if (fracao >= 1) return n
  return Math.floor(n * fracao + sorte())
}
