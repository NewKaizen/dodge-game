import { get } from 'svelte/store'
import { lan, iniciarPartida } from '../lib/lan/rede.js'
import { enviarRapido as enviarTransporte, aoRapido } from '../lib/lan/transmissao.js'
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
//                               cai no meio, cada um volta para onde dá
//
// No dev: window.debugRede = { canal, atraso(ms, variacao), iniciar(chave, dados), emRede, meuLado }
//   debugRede.atraso(150, 50)   simula internet ruim (chame nas duas abas)
//   debugRede.iniciar('PvpArena', { p1: 'kris', p2: 'susie' })   (host, com o convidado na sala)

export const canal = criarCanal({ enviarBruto: (msg) => enviarTransporte(msg), meuId: () => get(lan).eu.id ?? '?' })
aoRapido((dados) => canal.entregar(dados))

let ativa = false
let jogoAtual = null
// cenas de menu: dali um convite aceito leva direto ao lobby da sala (Lan)
const CENAS_DE_MENU = ['Menu', 'Config', 'Grimorio', 'GuiaBonus']
const cenasAtivas = () => jogoAtual?.scene.getScenes(true).map((c) => c.scene.key) ?? []
export const podeEntrarEmSala = () => cenasAtivas().every((k) => k === 'Lan' || CENAS_DE_MENU.includes(k))

const naSalaComParceiro = (s) => s.fase === 'sala' && (s.sala?.membros.length ?? 0) > 1

export const emRede = () => ativa && naSalaComParceiro(get(lan))
export const meuLado = () => (get(lan).papel === 'host' ? 0 : 1)
export const souHostDaRede = () => get(lan).papel === 'host'

function ativar(sim) {
  ativa = sim
  canal.limpar()
}

function trocarCena(game, chave, dados) {
  for (const cena of game.scene.getScenes(true)) cena.scene.stop()
  game.scene.start(chave, dados)
}

export function irParaCena(cena, chave, dados = {}) {
  if (!souHostDaRede() || !naSalaComParceiro(get(lan))) return cena.scene.start(chave, dados)
  ativar(chave !== 'Lan')
  canal.enviar('cena', null, { chave, dados })
  cena.scene.start(chave, dados)
}

// a cena Lan chama ao abrir: no lobby não tem partida em rede
export const encerrarRede = () => ativa && ativar(false)

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
    parceiro = outro
    if (!ativa || naSalaComParceiro(s)) return
    ativar(false)
    trocarCena(game, s.fase === 'sala' ? 'Lan' : s.online ? 'Menu' : 'Lan')
  })

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
    pararCena()
    pararSala()
    jogoAtual = null
  }
}
