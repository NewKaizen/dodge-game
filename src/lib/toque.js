import { writable, get } from 'svelte/store'
import { definirFonte } from './estado.js'
import { processarLinha } from './protocolo.js'
import { pedirTelaCheia } from './telaCheia.js'
import { pref, aoMudarPref } from '../game/preferencias.js'
import { criarToque, RAIO_PADRAO } from '../game/toque.js'

// TOQUE: os controles na tela do celular/tablet, mais uma fonte de entrada como o teclado, o
// controle e o joystick serial (docs/controles.md "Celular / toque"). Os dedos viram as mesmas
// linhas JOY/BTN do protocolo (lib/protocolo.js), então nenhuma cena precisa saber que é toque.
// A conta (joystick analógico, multitoque, histerese e repetição nos menus) é game/toque.js, testada
// em Node; o desenho e os ouvintes dos dedos são ui/ControlesToque.svelte.
//
//   toqueUI (store)   { tela, controles, vertical, tamanho, opacidade }
//        tela       é uma tela de toque (pointer: coarse ou já tocaram nela): a página vira "app"
//                   (só o jogo, tela inteira; classe 'modo-toque' no <html>)
//        controles  mostrar os controles na tela (CONFIGURAÇÕES → TOQUE: AUTOMÁTICO / SEMPRE / ESCONDIDOS)
//        vertical   celular em pé: a tela "gire o celular"
//   dedos             o criarToque (game/toque.js) que o ControlesToque alimenta
//   toqueSegurando()  o joystick da tela está inclinado (game/controles.js repete a direção nos menus)
//   vibrarToque(tipo) a vibração leve dos botões (navigator.vibrate; o iPhone não tem)
//   instalarToque(() => game)  (Game.svelte) liga tudo; devolve quem desliga
//
// Nunca aparece com mouse: AUTOMÁTICO só liga com pointer: coarse (tela de toque como entrada
// principal) ou depois de um toque de verdade (pointerType 'touch').

export const toqueUI = writable({ tela: false, controles: false, vertical: false, tamanho: 1, opacidade: 0.55 })

let tocou = false // já houve um toque de verdade nesta página
let fonteLigada = false
let telaCheiaPedida = false

const casa = (q) => typeof window !== 'undefined' && Boolean(window.matchMedia?.(q).matches)
const grosso = () => casa('(pointer: coarse)')
const emPe = () => casa('(orientation: portrait)')

export function vibrarToque(tipo) {
  if (!pref('toqueVibrar') || typeof navigator === 'undefined' || !navigator.vibrate) return
  try {
    navigator.vibrate(tipo === 'direcao' ? 6 : 12)
  } catch {}
}

function ligarFonte() {
  if (fonteLigada) return
  fonteLigada = true
  definirFonte('toque', true)
}

export const dedos = criarToque({
  enviar: (linha) => {
    ligarFonte()
    processarLinha(linha)
  },
  vibrar: vibrarToque,
  raio: () => RAIO_PADRAO * pref('toqueTamanho'),
})

export const toqueSegurando = () => dedos.segurando()

function recalcular() {
  const modo = pref('toqueControles')
  const tela = tocou || grosso()
  const controles = modo === 'sempre' || (modo === 'auto' && tela)
  const novo = { tela: tela || modo === 'sempre', controles, vertical: tela && emPe(), tamanho: pref('toqueTamanho'), opacidade: pref('toqueOpacidade') }
  const antes = get(toqueUI)
  if (JSON.stringify(antes) === JSON.stringify(novo)) return
  toqueUI.set(novo)
  if (!controles) dedos.soltarTudo()
  if (typeof document !== 'undefined' && antes.tela !== novo.tela) {
    document.documentElement.classList.toggle('modo-toque', novo.tela)
    // a resolução (game/resolucao.js) mede de novo com a página em "modo app"
    window.dispatchEvent(new Event('resize'))
  }
}

export function instalarToque(jogo = () => null) {
  if (typeof window === 'undefined') return () => {}
  const parar = []
  const ouvir = (alvo, evento, fn, opcoes) => {
    alvo?.addEventListener(evento, fn, opcoes)
    parar.push(() => alvo?.removeEventListener(evento, fn, opcoes))
  }

  ouvir(window, 'pointerdown', (e) => {
    if (e.pointerType !== 'touch') return
    if (!tocou) {
      tocou = true
      recalcular()
    }
    ligarFonte()
  }, true)
  // tela cheia (e a tela deitada travada, no Android) no primeiro toque: o pointerup/touchend é o
  // "gesto" que o navegador aceita para isso (o pointerdown de toque não é). Uma vez só: quem sai
  // da tela cheia usa o botão do canto para voltar
  ouvir(window, 'pointerup', (e) => {
    if (e.pointerType !== 'touch' || telaCheiaPedida || !get(toqueUI).controles) return
    telaCheiaPedida = true
    pedirTelaCheia()
  }, true)

  // pinça do Safari do iPhone (ele ignora user-scalable=no): o jogo não dá zoom
  const semGesto = (e) => e.preventDefault()
  ouvir(document, 'gesturestart', semGesto, { passive: false })
  ouvir(document, 'gesturechange', semGesto, { passive: false })

  // dedo nenhum fica "preso": app em segundo plano, tela bloqueada, outra janela
  const soltar = () => dedos.soltarTudo()
  ouvir(window, 'blur', soltar)
  ouvir(window, 'pagehide', soltar)
  ouvir(document, 'visibilitychange', () => document.visibilityState === 'hidden' && soltar())

  // celular em pé: a tela "gire o celular" e, numa partida local, a pausa (como perder o foco)
  const aoGirar = () => {
    const antes = get(toqueUI).vertical
    recalcular()
    const agora = get(toqueUI).vertical
    if (agora && !antes) {
      soltar()
      jogo()?.events?.emit('entrada-perdida', 'o celular ficou em pé')
    }
  }
  const mqOrientacao = window.matchMedia?.('(orientation: portrait)')
  const mqGrosso = window.matchMedia?.('(pointer: coarse)')
  ouvir(mqOrientacao, 'change', aoGirar)
  ouvir(mqGrosso, 'change', recalcular)
  ouvir(window, 'resize', aoGirar)
  parar.push(aoMudarPref((chave) => chave.startsWith('toque') && recalcular()))

  recalcular()
  return () => {
    parar.forEach((f) => f())
    dedos.soltarTudo()
  }
}
