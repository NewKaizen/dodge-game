// Preferências de acessibilidade, gráficos e controles (tela Config). Ficam
// salvas no navegador, separadas dos volumes/velocidade (lib/estado.js).
//
//   pref('graficos')                     lê ('minimo' | 'medio' | 'maximo')
//   definirPref('daltonismo', 'tritanopia')   muda, salva e avisa os ouvintes
//   const parar = aoMudarPref((chave, valor) => ...)   parar() desliga
//   nivelGrafico()                       0 (mínimo), 1 (médio) ou 2 (máximo)
//   menosMovimento()                     true com "reduzir animações" ligado
//
// Chaves:
//   graficos          'minimo' | 'medio' | 'maximo'  (como nos jogos em flash: menos partículas,
//                     fundos parados, sem filtros pesados no mínimo)
//   reduzirMovimento  true/false  tremores, zooms, clarões e câmeras lentas mais suaves (ou nenhum)
//   tremor            'normal' | 'reduzido' | 'desligado'  intensidade dos tremores de tela/caixa
//   flashes           true/false  clarões de tela (false = nenhum clarão branco/colorido)
//   daltonismo        'nenhum' | 'protanopia' | 'deuteranopia' | 'tritanopia'  paleta das cores
//                     que importam no jogo (avisos, corações, balas do tema)
//   menu              'mesa' | 'sala'  o menu inicial: a MESA DE CARTAS (padrão) ou a SALA DE TV
//   teclas            null (padrão) ou { p1: { cima: [...], baixo, esquerda, direita, A, B, C },
//                     p2: {...} } com códigos de KeyboardEvent.code (ver lib/simulador.js)
//   botoesPad         null (padrão) ou { A: [...], B: [...], C: [...] } com índices de botão do controle
//                     físico (Gamepad API, ver game/gamepad.js)
//   joysticksSerial   null ou { '<vid>:<pid>#<índice>': jogador } quem é P1/P2 em cada porta serial (lib/joysticks.js)
//   zonaMorta         0.1 a 0.8: quanto o analógico do controle precisa inclinar para contar (padrão 0.35)
import { problemasDosBotoes, zonaMortaValida, ZONA_MORTA_PADRAO } from './gamepad.js'

const CHAVE = 'dodge-preferencias'

export const PREFERENCIAS_PADRAO = {
  graficos: 'maximo',
  reduzirMovimento: false,
  tremor: 'normal',
  flashes: true,
  daltonismo: 'nenhum',
  menu: 'mesa',
  teclas: null,
  botoesPad: null,
  zonaMorta: ZONA_MORTA_PADRAO,
  joysticksSerial: null,
}

export const OPCOES = {
  graficos: ['minimo', 'medio', 'maximo'],
  tremor: ['normal', 'reduzido', 'desligado'],
  daltonismo: ['nenhum', 'protanopia', 'deuteranopia', 'tritanopia'],
  menu: ['mesa', 'sala'],
}

function valido(chave, valor) {
  if (!(chave in PREFERENCIAS_PADRAO)) return false
  if (OPCOES[chave]) return OPCOES[chave].includes(valor)
  if (chave === 'teclas') return valor === null || typeof valor === 'object'
  if (chave === 'botoesPad') return valor === null || problemasDosBotoes(valor).length === 0
  if (chave === 'joysticksSerial') return valor === null || (typeof valor === 'object' && !Array.isArray(valor))
  if (chave === 'zonaMorta') return zonaMortaValida(valor)
  return typeof valor === typeof PREFERENCIAS_PADRAO[chave]
}

function ler() {
  const p = { ...PREFERENCIAS_PADRAO }
  try {
    const salvo = JSON.parse(globalThis.localStorage?.getItem(CHAVE) ?? 'null')
    if (salvo && typeof salvo === 'object') for (const [k, v] of Object.entries(salvo)) if (valido(k, v)) p[k] = v
  } catch {}
  return p
}

const atual = ler()
const ouvintes = new Set()

export function pref(chave) {
  return atual[chave]
}

export function definirPref(chave, valor) {
  if (!valido(chave, valor) || atual[chave] === valor) return
  atual[chave] = valor
  try {
    globalThis.localStorage?.setItem(CHAVE, JSON.stringify(atual))
  } catch {}
  for (const fn of ouvintes) fn(chave, valor)
}

export function aoMudarPref(fn) {
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

export const nivelGrafico = () => OPCOES.graficos.indexOf(atual.graficos)
export const menosMovimento = () => atual.reduzirMovimento
