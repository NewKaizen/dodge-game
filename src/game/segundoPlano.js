import Phaser from 'phaser'
import { get } from 'svelte/store'
import { relogio, abaEscondida } from '../lib/relogioFundo.js'
import { criarMotor } from './motorFundo.js'
import { lan } from '../lib/lan/rede.js'
import { silenciarEmFundo } from './audio.js'

// ABA EM SEGUNDO PLANO (docs/rede-pvp.md "Aba em segundo plano e pausa online").
//
// Escondida, a aba não tem requestAnimationFrame: o Phaser para de dar passos. Numa partida em rede
// isso travava os OUTROS (o meu coração não terminava a esquiva, o meu relógio da escolha não
// acabava, o host não resolvia a rodada...). Aqui o jogo continua andando pelo tique do relógio de
// fundo (lib/relogioFundo.js, um Worker): game.headlessStep (atualiza as cenas, não desenha nada).
// Com a entrada solta (simulador/gamepad soltam tudo ao esconder) o meu coração fica PARADO onde
// estava: os outros veem um jogador ausente, não uma partida congelada. O som fica mudo enquanto
// a aba está escondida (audio.js silenciarEmFundo).
//
// Só quando vale a pena: numa sala (lobby ou partida em rede) e na campanha/desafio diário (o
// servidor conta o tempo). Fora disso a aba escondida dorme como sempre.
//
//   criarMotor (game/motorFundo.js): dá o passo só quando o requestAnimationFrame parou
//   instalarSegundoPlano(game)     (Game.svelte) liga tudo; devolve quem desliga

// a aba escondida continua rodando? numa sala, ou na campanha (o servidor espera a esquiva)
export function deveManterVivo(game) {
  return () => get(lan).fase === 'sala' || game.scene.isActive('CampanhaArena')
}

export function instalarSegundoPlano(game, { manter = deveManterVivo(game) } = {}) {
  const agora = () => performance.now()
  const motor = criarMotor({ passo: (t, delta) => game.headlessStep(t, delta), manter })
  const aoPasso = () => motor.marcar(agora())
  game.events.on(Phaser.Core.Events.POST_STEP, aoPasso)
  const desligarTique = relogio.aoTique((t) => motor.tique(t))
  const aoMudar = () => silenciarEmFundo(abaEscondida())
  document.addEventListener('visibilitychange', aoMudar)
  aoMudar()
  relogio.atualizar()
  if (import.meta.env?.DEV) window.debugSegundoPlano = { motor, relogio }
  return () => {
    game.events.off(Phaser.Core.Events.POST_STEP, aoPasso)
    desligarTique()
    document.removeEventListener('visibilitychange', aoMudar)
    silenciarEmFundo(false)
  }
}
