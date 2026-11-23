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
//   resolucao         'normal' | 'batata'  RESOLUÇÃO BATATA: o jogo desenha no tamanho do mundo (854x480) e a página
//                     amplia sem borrar (resolucao.js). Liga sozinha quando o FPS fica baixo (game/batata.js)
//   batataAutomatica  true/false  pode ligar a BATATA sozinha (vira false quando o jogador desfaz)
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
//   vibracao          true/false  vibração (rumble) do controle físico quando o jogador leva um golpe ou cai (game/vibracao.js)
//   vibracaoIntensidade  null (automática: 75%, ou 25% com tremor/animações reduzidos) ou 0.25 | 0.5 | 0.75 | 1
//   buzzerJoystick    true/false  BUZZER do joystick serial em HP baixo, K.O., golpe de SUPER e vitória (game/buzzer.js)
//   pistasVisuais     true/false  BOSS SEMANAL · ESCURIDÃO: setas na borda da caixa no lugar das pistas de som
//   dicaJoystickUsb   true/false  o aviso "Joystick USB? CONFIGURAÇÕES → GAMEPAD" do menu já foi visto (scenes/Menu.js)
//                     (coop/semanal/escuridao.js; sugerido sozinho quando o volume dos efeitos está no 0)
//   toqueControles    'auto' | 'sempre' | 'escondido'  CONTROLES NA TELA (celular/tablet, game/toque.js): auto = só
//                     em tela de toque (pointer: coarse ou o primeiro toque), nunca com mouse
//   toqueTamanho      0.7 a 1.5: tamanho do joystick e dos botões na tela (padrão 1)
//   toqueOpacidade    0.2 a 0.9: opacidade dos controles na tela (padrão 0.55)
//   toqueVibrar       true/false  o celular vibra de leve ao apertar A/B/C e ao mudar a direção (navigator.vibrate)
//   manual            null ou o progresso do Manual do Ralsei (páginas completas e mini-lições da página 2;
//                     formato e validação em manual/progresso.js)
import { problemasDosBotoes, zonaMortaValida, ZONA_MORTA_PADRAO } from './gamepad.js'
import { intensidadeValida } from './vibracao.js'
import { progressoValido } from './manual/progresso.js'
import { MODOS_TOQUE, TAMANHO_TOQUE, OPACIDADE_TOQUE, tamanhoToqueValido, opacidadeToqueValida } from './toque.js'

const CHAVE = 'dodge-preferencias'

export const PREFERENCIAS_PADRAO = {
  graficos: 'maximo',
  resolucao: 'normal',
  batataAutomatica: true,
  reduzirMovimento: false,
  tremor: 'normal',
  flashes: true,
  daltonismo: 'nenhum',
  menu: 'mesa',
  teclas: null,
  botoesPad: null,
  zonaMorta: ZONA_MORTA_PADRAO,
  joysticksSerial: null,
  vibracao: true,
  vibracaoIntensidade: null,
  buzzerJoystick: true,
  pistasVisuais: false,
  dicaJoystickUsb: false,
  toqueControles: 'auto',
  toqueTamanho: TAMANHO_TOQUE.padrao,
  toqueOpacidade: OPACIDADE_TOQUE.padrao,
  toqueVibrar: true,
  manual: null,
}

export const OPCOES = {
  graficos: ['minimo', 'medio', 'maximo'],
  resolucao: ['normal', 'batata'],
  tremor: ['normal', 'reduzido', 'desligado'],
  daltonismo: ['nenhum', 'protanopia', 'deuteranopia', 'tritanopia'],
  menu: ['mesa', 'sala'],
  toqueControles: MODOS_TOQUE,
}

function valido(chave, valor) {
  if (!(chave in PREFERENCIAS_PADRAO)) return false
  if (OPCOES[chave]) return OPCOES[chave].includes(valor)
  if (chave === 'teclas') return valor === null || typeof valor === 'object'
  if (chave === 'botoesPad') return valor === null || problemasDosBotoes(valor).length === 0
  if (chave === 'joysticksSerial') return valor === null || (typeof valor === 'object' && !Array.isArray(valor))
  if (chave === 'zonaMorta') return zonaMortaValida(valor)
  if (chave === 'vibracaoIntensidade') return intensidadeValida(valor)
  if (chave === 'toqueTamanho') return tamanhoToqueValido(valor)
  if (chave === 'toqueOpacidade') return opacidadeToqueValida(valor)
  if (chave === 'manual') return progressoValido(valor)
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
