import { get } from 'svelte/store'
import { aoBauGanho, bausConta } from '../../lib/bausConta.js'
import { criarFilaBau, podeMostrarPopup } from './filaBau.js'

// Liga o aviso do servidor (bauGanho) ao pop-up "VOCÊ GANHOU UM BAÚ!" (docs/baus.md; a cena BauPopup).
// Quem decide QUANDO é a fila (filaBau.js): nunca no meio de uma partida; assim que o jogador estiver num
// menu ou numa tela de resultado, a cena BauPopup entra por cima e a de baixo é pausada até ele escolher
// ABRIR AGORA (a roleta roda ali mesmo) ou DEPOIS (o baú fica na aba BAÚS, a contagem continua).
//
//   instalarPopupBau(game)   uma vez (Game.svelte); devolve a função que desliga
//   filaBau                  a fila (os testes e o dev leem)
//   window.debugBau          (só no dev) simular(fontes, fechados): faz de conta que o servidor avisou
export const filaBau = criarFilaBau()
const VIGIA_MS = 200

export function instalarPopupBau(game) {
  let ativo = false
  let pausadas = []
  const chaves = () => game.scene.scenes.filter((c) => c.sys.isActive() || c.sys.isPaused()).map((c) => c.sys.settings.key)
  const semPopup = () => chaves().filter((k) => k !== 'BauPopup')

  function retomar() {
    for (const k of pausadas) {
      const c = game.scene.getScene(k)
      if (c?.sys.isPaused()) game.scene.resume(k)
    }
    pausadas = []
  }

  function fechar() {
    if (!ativo) return
    ativo = false
    game.scene.stop('BauPopup')
    retomar()
  }

  function abrir(aviso) {
    ativo = true
    pausadas = game.scene.getScenes(true).map((c) => c.sys.settings.key).filter((k) => k !== 'BauPopup')
    for (const k of pausadas) game.scene.pause(k)
    game.scene.run('BauPopup', {
      fontes: aviso.fontes,
      fechados: aviso.fechados,
      aoAbrir: () => filaBau.abriu(),
      aoDepois: () => filaBau.depois(),
      aoFechar: () => {
        filaBau.contar(get(bausConta).fechados)
        fechar()
      },
    })
    game.scene.bringToTop('BauPopup')
  }

  const vigiar = () => {
    if (ativo) {
      // começou uma partida (convite aceito, o host iniciou a sala...) com o pop-up aberto: sai de cena
      if (!podeMostrarPopup(semPopup())) {
        if (filaBau.mostrando()) filaBau.interromper()
        fechar()
      }
      return
    }
    const aviso = filaBau.atualizar(performance.now(), semPopup())
    if (aviso) abrir(aviso)
  }

  const parar = [
    aoBauGanho((b) => filaBau.chegou(b)),
    bausConta.subscribe((s) => s.carregado && filaBau.contar(Math.max(s.fechados, 0))),
  ]
  const timer = setInterval(vigiar, VIGIA_MS)
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    window.debugBau = {
      // o mesmo caminho do aviso do servidor: window.debugBau.simular(['nivel'], 3)
      simular: (fontes = ['nivel'], fechados = 1) => filaBau.chegou({ fontes, fechados }),
      fila: filaBau,
    }
  }
  return () => {
    clearInterval(timer)
    parar.forEach((f) => f())
    if (ativo) fechar()
  }
}
