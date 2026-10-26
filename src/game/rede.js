import { get } from 'svelte/store'
import { lan, iniciarPartida, sairSala } from '../lib/lan/rede.js'
import { enviarRapido as enviarTransporte, enviarPeloServidor, aoRapido } from '../lib/lan/transmissao.js'
import { criarCanal } from '../lib/lan/canal.js'

// Partida EM REDE (docs/rede-pvp.md): numa sala (LAN ou ONLINE) o PVP e o
// CO-OP rodam no PC de cada um; só as decisões viajam, pelo canal
// (lib/lan/canal.js) direto entre os PCs (WebRTC) ou pelo servidor.
//
// O HOST manda nas trocas de cena: irParaCena() abre a cena aqui e manda o
// convidado abrir a mesma, com os mesmos dados (semente, personagens...).
//
//   canal                       o canal da partida (enviar, receber, ao, enviarRapido...)
//   emRede()                    true com a partida em rede rodando (os dois na sala)
//   meuLado()                   0 (host = P1) ou 1 (convidado = P2)
//   souHostDaRede()             o host é quem decide (sorteios, resultado da rodada)
//   irParaCena(cena, chave, dados)  (host) troca de cena aqui e no convidado;
//                               'Lan' encerra a partida em rede (os dois voltam ao lobby)
//   podeEntrarEmSala()          true se o jogador está num menu (não no meio de uma
//                               partida): aceitar convite de amigo só ali
//   instalarRede(game)          (Game.svelte) o convidado segue o host; se a sala
//                               cai no meio, cada um volta para onde dá. O
//                               convidado parado na tela preta (esperando a cena
//                               do host) por PRESO_MS sai da sala com um aviso
//
// No dev: window.debugRede = { canal, atraso(ms, variacao), iniciar(chave, dados), emRede, meuLado }
//   debugRede.atraso(150, 50)   simula internet ruim (chame nas duas abas)
//   debugRede.iniciar('PvpArena', { p1: 'kris', p2: 'susie' })   (host, com o convidado na sala)

// o reenvio (sem recibo) vai pelo servidor: um canal direto mudo não trava a partida
export const canal = criarCanal({ enviarBruto: (msg) => enviarTransporte(msg), enviarReserva: (msg) => enviarPeloServidor(msg), meuId: () => get(lan).eu.id ?? '?' })
aoRapido((dados) => canal.entregar(dados))

let ativa = false
let jogoAtual = null
// cenas de menu: dali um convite aceito leva direto ao lobby da sala (Lan)
const CENAS_DE_MENU = ['Menu', 'Config', 'Grimorio', 'GuiaBonus', 'Perfil', 'Amigos', 'Colecao']
const cenasAtivas = () => jogoAtual?.scene.getScenes(true).map((c) => c.scene.key) ?? []
export const podeEntrarEmSala = () => cenasAtivas().every((k) => k === 'Lan' || CENAS_DE_MENU.includes(k))

// convidado com a tela preta (fadeOut completo) esperando a cena do host há tanto tempo: desiste
export const PRESO_MS = 20000
// o Brave com os escudos ligados já travou o canal direto (lib/lan/vigiaDireto.js): a dica vai junto
const ehBrave = () => typeof navigator !== 'undefined' && Boolean(navigator.brave)
export const DICA_BRAVE = 'no Brave, se travar: escudos desligados para este site'
export const MSG_PRESO = 'não deu para sincronizar com o host: voltando ao lobby'

const naSalaComParceiro = (s) => s.fase === 'sala' && (s.sala?.membros.length ?? 0) > 1

export const emRede = () => ativa && naSalaComParceiro(get(lan))
export const meuLado = () => (get(lan).papel === 'host' ? 0 : 1)
export const souHostDaRede = () => get(lan).papel === 'host'

function ativar(sim) {
  ativa = sim
  canal.limpar()
}

function trocarCena(game, chave, dados) {
  // a mesma cena já aberta: recomeça (o stop dela fica na fila do Phaser e
  // desligaria a cena que o start acabou de abrir: tela sem cena nenhuma)
  const abertas = game.scene.getScenes(true)
  for (const cena of abertas) if (cena.scene.key !== chave) cena.scene.stop()
  const mesma = abertas.find((c) => c.scene.key === chave)
  if (mesma) mesma.scene.restart(dados)
  else game.scene.start(chave, dados)
}

export function irParaCena(cena, chave, dados = {}) {
  if (!souHostDaRede() || !naSalaComParceiro(get(lan))) return cena.scene.start(chave, dados)
  ativar(chave !== 'Lan')
  canal.enviar('cena', null, { chave, dados })
  cena.scene.start(chave, dados)
}

// a cena Lan chama ao abrir: no lobby não tem partida em rede. PvpResultado
// chama antes de sair da sala casual (JOGAR NOVAMENTE / VOLTAR), para a troca
// de cena ser a dela
export const encerrarRede = () => ativa && ativar(false)

// todas as cenas abertas com o fadeOut completo (a tela inteira preta)
function telaPreta(game) {
  const cenas = game.scene.getScenes(true)
  return cenas.length > 0 && cenas.every((c) => c.cameras?.main?.fadeEffect?.isComplete && c.cameras.main.fadeEffect.direction)
}

export function instalarRede(game) {
  jogoAtual = game
  const pararCena = canal.ao('cena', ({ chave, dados } = {}) => {
    if (souHostDaRede() || !chave) return
    ativar(chave !== 'Lan')
    trocarCena(game, chave, dados ?? {})
  })
  // o parceiro saiu (ou a sala caiu) no meio da partida em rede
  let parceiro = null
  let faseAntes = null
  const pararSala = lan.subscribe((s) => {
    // entrou numa sala por um convite de amigo, parado num menu: vai para o lobby da sala
    const entrouNaSala = s.fase === 'sala' && faseAntes !== 'sala'
    faseAntes = s.fase
    if (entrouNaSala) {
      const cenas = cenasAtivas()
      if (cenas.length && !cenas.includes('Lan') && cenas.every((k) => CENAS_DE_MENU.includes(k))) trocarCena(game, 'Lan')
    }
    const outro = s.fase === 'sala' ? s.sala?.membros.find((m) => m.id !== s.eu.id)?.id ?? null : null
    if (parceiro && outro !== parceiro) canal.esquecer(parceiro)
    // parceiro novo (ou o mesmo que saiu e voltou): as minhas confiáveis
    // começam outra sessão, do 0 (lib/lan/canal.js). Sem isso o número de
    // antes continuava e o outro ficava esperando a mensagem 0 para sempre
    if (outro !== parceiro) canal.reiniciar()
    parceiro = outro
    if (!ativa || naSalaComParceiro(s)) return
    ativar(false)
    // partida rápida (casual): volta para a tela ONLINE, onde dá para procurar outra
    trocarCena(game, s.fase === 'sala' || s.ultimaCasual || !s.online ? 'Lan' : 'Menu')
  })

  // convidado parado na tela preta: a cena do host não chegou (ou o host
  // travou). Em vez da tela preta para sempre, sai da sala com o aviso
  let pretoDesde = null
  const vigia = setInterval(() => {
    const s = get(lan)
    const visivel = typeof document === 'undefined' || document.visibilityState === 'visible'
    if (s.papel !== 'convidado' || !naSalaComParceiro(s) || !s.sala?.emPartida || !visivel || !telaPreta(game)) return (pretoDesde = null)
    pretoDesde ??= Date.now()
    if (Date.now() - pretoDesde < PRESO_MS) return
    pretoDesde = null
    console.warn('[rede] a cena do host não chegou: saindo da sala', canal.estadoDebug())
    ativar(false)
    sairSala()
    lan.update((x) => ({ ...x, erro: ehBrave() ? `${MSG_PRESO} (${DICA_BRAVE})` : MSG_PRESO }))
    trocarCena(game, 'Lan')
  }, 1000)

  if (import.meta.env.DEV)
    window.debugRede = {
      canal,
      emRede,
      meuLado,
      atraso: (atrasoMs = 0, variacaoMs = 0) => canal.testar({ atrasoMs, variacaoMs }),
      iniciar(chave = 'PvpArena', dados = {}) {
        if (!souHostDaRede()) return 'só o host começa'
        if (!naSalaComParceiro(get(lan))) return 'falta o convidado na sala'
        if (!get(lan).sala.emPartida) iniciarPartida()
        const cena = game.scene.getScenes(true)[0]
        irParaCena(cena, chave, { semente: `rede:${Date.now()}`, ...dados })
        return chave
      },
    }

  return () => {
    clearInterval(vigia)
    pararCena()
    pararSala()
    jogoAtual = null
  }
}
