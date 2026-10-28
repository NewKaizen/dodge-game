import { get } from 'svelte/store'
import { lan, iniciarPartida, sairSala, participantes, minhaVaga } from '../lib/lan/rede.js'
import { enviarRapido as enviarTransporte, enviarPeloServidor, aoRapido, contagem, zerarContagem } from '../lib/lan/transmissao.js'
import { criarCanal } from '../lib/lan/canal.js'
import { criarSincCena } from '../lib/lan/sincCena.js'
import { corDaVaga } from './vagas.js'
import { interceptarBotao } from './controles.js'
import { conta } from '../lib/conta.js'
import { coresDosVersosDaPartida } from './pvp/versos.js'

// Partida EM REDE (docs/rede-pvp.md): numa sala (LAN ou ONLINE) o PVP e o
// CO-OP rodam no PC de cada um; só as decisões viajam, pelo canal
// (lib/lan/canal.js) direto entre os PCs (WebRTC) ou pelo servidor.
//
// O HOST manda nas trocas de cena: irParaCena() abre a cena aqui e manda o
// convidado abrir a mesma, com os mesmos dados (semente, personagens...).
//
//   canal                       o canal da partida (enviar, receber, ao, enviarRapido...)
//   emRede()                    true com a partida em rede rodando (os dois na sala)
//   meuLado()                   (modos de 2) 0 (host da partida = P1) ou 1 (convidado = P2)
//   meuIndice()                 (5A) a MINHA vaga na sala, 0..N-1 (estável: a mesma na
//                               retomada; não é o mesmo que ser host: o host é eleito)
//   participantesDaPartida()    (5A) [{ indice, id, nome, conta, cor, host, dono, caiu }] em ordem de vaga
//   souHostDaRede()             o host DA PARTIDA é quem decide (sorteios, resultado da rodada)
//   coresDosVersos()            [cor do verso de carta do lado 0, do lado 1] (null = verso padrão)
//   irParaCena(cena, chave, dados)  (host) troca de cena aqui e no convidado;
//                               'Lan' encerra a partida em rede (os dois voltam ao lobby)
//   podeEntrarEmSala()          true se o jogador está num menu (não no meio de uma
//                               partida): aceitar convite de amigo só ali
//   instalarRede(game)          (Game.svelte) o convidado segue o host; se a sala
//                               cai no meio, cada um volta para onde dá. O
//                               convidado parado na tela preta (esperando a cena
//                               do host) por PRESO_MS sai da sala com um aviso
//
// QUEDA DE CONEXÃO no meio da partida (Fase 2D; lib/lan/religar.js e
// server/lan.js): eu caí (lan.religando) ou o outro caiu (lan.outroCaiu).
// Enquanto o servidor espera a volta (20 s), as cenas daqui ficam paradas, os
// controles travados e a cena Religando (game/religando.js) diz quem caiu e
// quanto falta. Voltou: o HOST volta a partida para o COMEÇO DA RODADA (a
// cena abre de novo nos dois, com o ponto de retomada que a arena guardou:
// ArenaRede.dadosRetomada), descartando a sessão do canal do outro (o que
// ainda estava no caminho era da rodada velha); o convidado recebe a `cena`
// com `retomada: true`, abre outra sessão do canal e reconstrói a rodada (se
// ela não chegar em ESPERA_CENA_MS, sai da sala). As telas de fim (resultado,
// vitória, game over) e o lobby só continuam de onde estavam. Não voltou: o
// servidor tira quem caiu e o resto é o de sempre (volta ao lobby/menu).
//
// SALAS DE N (Fase 5A, docs/rede-pvp.md "Salas de N"): estrela pelo host da partida.
// O canal do host tem uma sessão por convidado (destinos = os convidados); o do
// convidado, só o host. irParaCena manda a `cena` numerada (n) a todos e cada
// convidado responde `cenaOk { n }` ao abrir: `sincCena` diz quem já está na cena e
// quem atrasou. Queda numa sala de 3 ou 4: se caiu um CONVIDADO, a partida dos outros
// não para (só a vaga dele espera os 20 s; o modo decide o que fazer com o coração
// dele) e, quando ele volta, o host manda a cena atual SÓ para ele (dadosRetomadaPara
// da ponte da arena, se houver; senão os dados com que a cena abriu), com a sessão do
// canal dele recomeçada. Caiu o HOST (ou sou eu que caí): todos param, como na 2D.
// Salas de 2: tudo como antes.
//
// No dev: window.debugRede = { canal, atraso(ms, variacao), iniciar(chave, dados), emRede, meuLado,
//   meuIndice, sinc(), carga({ segundos, hz }) (orçamento: docs/rede-pvp.md), contagem }
//   debugRede.atraso(150, 50)   simula internet ruim (chame nas duas abas)
//   debugRede.iniciar('PvpArena', { p1: 'kris', p2: 'susie' })   (host, com o convidado na sala)

// os parceiros do canal: no host da partida, os convidados; no convidado, só o host
const destinos = () => {
  const s = get(lan)
  if (s.fase !== 'sala') return []
  const outros = (s.sala?.membros ?? []).filter((m) => m.id !== s.eu.id)
  return s.papel === 'host' ? outros.map((m) => m.id) : outros.filter((m) => m.papel === 'host').map((m) => m.id)
}
// o reenvio (sem recibo) vai pelo servidor: um canal direto mudo não trava a partida
export const canal = criarCanal({
  enviarBruto: (msg, para) => enviarTransporte(msg, para),
  enviarReserva: (msg, para) => enviarPeloServidor(msg, get(lan).papel === 'host' ? para : undefined),
  enviarTodos: (msg) => enviarTransporte(msg),
  destinos,
  meuId: () => get(lan).eu.id ?? '?',
})
// quem mandou é quem diz que mandou (pelo direto, a ligação; pelo servidor, o id que ele carimbou)
aoRapido((dados, de) => (!de || dados?.de === de) && canal.entregar(dados))
// 5A: quem do outro lado já abriu a cena que o host mandou
export const sincCena = criarSincCena()
canal.ao('cenaOk', (d, _, de) => sincCena.ok(de, d?.n))

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
export const MSG_PRESO = 'não deu para sincronizar com o host: voltando ao lobby (comecem de novo)'
// 2D: cenas que, na volta, só continuam (não voltam a rodada) e cenas por cima das outras
const SO_CONTINUAM = ['Lan', 'PvpResultado', 'Vitoria', 'GameOver']
const POR_CIMA = ['Religando', 'Carregando', 'Pausa', 'Entrada']
export const ESPERA_CENA_MS = 10_000 // convidado: a cena da retomada tem até isto para chegar

const naSalaComParceiro = (s) => s.fase === 'sala' && (s.sala?.membros.length ?? 0) > 1

export const emRede = () => ativa && naSalaComParceiro(get(lan))
export const meuLado = () => (get(lan).papel === 'host' ? 0 : 1)
export const meuIndice = () => minhaVaga()
export const participantesDaPartida = () => participantes().map((p) => ({ ...p, cor: corDaVaga(p.indice) }))
export const souHostDaRede = () => get(lan).papel === 'host'
// verso equipado de cada lado (0 = host/P1): em rede o de cada jogador, fora dela o de quem está logado (pvp/versos.js)
export const coresDosVersos = () => coresDosVersosDaPartida({ sala: emRede() ? get(lan).sala : null, perfil: get(conta).perfil })

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

// Cartas escondidas no PVP online (pvp/categorias.js): a ponte da arena que sabe mascarar
// (mascararCenaPara) manda a CADA convidado os dados vistos por ele; sem ela, os mesmos para todos
function mandarCena(cena, msg) {
  const rede = cena?.rede
  if (!rede?.mascararCenaPara) return canal.enviar('cena', null, msg)
  for (const id of destinos()) canal.enviarPara(id, 'cena', null, { ...msg, dados: rede.mascararCenaPara(msg.dados, id) })
}

export function irParaCena(cena, chave, dados = {}) {
  if (!souHostDaRede() || !naSalaComParceiro(get(lan))) return cena.scene.start(chave, dados)
  ativar(chave !== 'Lan')
  const n = sincCena.nova(chave, destinos())
  mandarCena(cena, { chave, dados, n })
  // (a tela que vem depois da arena também esconde as cartas dos outros aqui)
  cena.scene.start(chave, cena?.rede?.mascararCenaPara?.(dados, null) ?? dados)
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

// ---------- queda de conexão (2D) ----------

let queda = null // o que a cena Religando mostra (lib/lan/religar.js textoDaQueda)
let congeladas = [] // cenas que paramos
let destravar = null // tira o bloqueio dos botões
let esperaCena = null // convidado: o timer da cena da retomada
let retomadaChegou = 0 // convidado: quando chegou a cena da retomada (ela pode chegar pelo direto antes do bemvindo)
const retomadaRecente = () => Date.now() - retomadaChegou < 3000

function congelar(game) {
  if (destravar) return
  congeladas = game.scene
    .getScenes(true)
    .map((c) => c.scene.key)
    .filter((k) => !POR_CIMA.includes(k) || k === 'Entrada')
  for (const k of congeladas) game.scene.pause(k)
  destravar = interceptarBotao(() => true) // os controles daqui não fazem nada
  game.scene.run('Religando', { queda: () => queda })
  game.scene.bringToTop('Religando')
}

function descongelar(game) {
  clearTimeout(esperaCena)
  esperaCena = null
  destravar?.()
  destravar = null
  for (const k of congeladas) if (game.scene.isPaused(k)) game.scene.resume(k)
  congeladas = []
  if (game.scene.isActive('Religando') || game.scene.isPaused('Religando')) game.scene.stop('Religando')
  queda = null
}

// a cena da partida que estava aberta (sem as que ficam por cima)
const cenaDaPartida = () => congeladas.find((k) => !POR_CIMA.includes(k)) ?? null

// host: a partida volta para o começo da rodada, nos dois PCs
function voltarRodada(game, chave, parceiroId) {
  const cena = game.scene.getScene(chave)
  const dados = cena?.rede?.dadosRetomada?.() ?? { ...(cena?.sys.settings.data ?? {}) }
  descongelar(game)
  if (parceiroId) canal.descartar(parceiroId) // o que o outro mandou antes da queda era da rodada velha
  canal.reiniciar()
  ativar(true)
  console.info('[rede] retomada: a partida volta ao começo da rodada', { chave, rodada: dados.retomada?.estado?.rodada ?? null })
  const n = sincCena.nova(chave, destinos())
  mandarCena(cena, { chave, dados, retomada: true, n })
  trocarCena(game, chave, dados)
}

// 5A, sala de N: o convidado `id` caiu e voltou. Só ele recebe a cena atual de novo
// (os outros seguem jogando); a sessão do canal dele recomeça
function voltarVaga(game, id) {
  const cena = game.scene.getScenes(true).find((c) => !POR_CIMA.includes(c.scene.key))
  if (!cena) return
  const chave = cena.scene.key
  const dados = cena.rede?.dadosRetomadaPara?.(id) ?? cena.rede?.dadosRetomada?.() ?? { ...(cena.sys.settings.data ?? {}) }
  canal.descartar(id)
  canal.reiniciar(id)
  console.info('[rede] retomada de uma vaga: a cena atual vai só para quem voltou', { id, chave })
  canal.enviarPara(id, 'cena', null, { chave, dados: cena.rede?.mascararCenaPara?.(dados, id) ?? dados, retomada: true, n: sincCena.estado().n })
}

// 5A: a queda de alguém para a partida de todos? Sala de 2: sim (2D). Sala de N: só se
// quem caiu é o host da partida
function quedaQueParaTudo(s) {
  if (!s.outroCaiu) return null
  if ((s.sala?.membros.length ?? 0) <= 2) return { eu: false, nome: s.outroCaiu.nome, ate: s.outroCaiu.ate }
  const host = (s.caidos ?? []).find((c) => c.host)
  return host ? { eu: false, nome: host.nome, ate: host.ate } : null
}

export function instalarRede(game) {
  jogoAtual = game
  const pararCena = canal.ao('cena', ({ chave, dados, retomada, n } = {}) => {
    if (souHostDaRede() || !chave) return
    if (destravar) descongelar(game)
    // a retomada do host (2D): as minhas confiáveis também começam de novo
    if (retomada) {
      canal.reiniciar()
      retomadaChegou = Date.now()
    }
    ativar(chave !== 'Lan')
    trocarCena(game, chave, dados ?? {})
    // 5A: avisa o host que abri (ele sabe quem está atrasado)
    if (n != null) canal.enviar('cenaOk', null, { n, chave })
  })
  // o parceiro saiu (ou a sala caiu) no meio da partida em rede
  let parceirosAntes = new Set()
  let hostAntes = null
  let caidosAntes = new Set()
  let faseAntes = null
  const pararSala = lan.subscribe((s) => {
    // entrou numa sala por um convite de amigo, parado num menu: vai para o lobby da sala
    const entrouNaSala = s.fase === 'sala' && faseAntes !== 'sala'
    faseAntes = s.fase
    if (entrouNaSala) {
      const cenas = cenasAtivas()
      if (cenas.length && !cenas.includes('Lan') && cenas.every((k) => CENAS_DE_MENU.includes(k))) trocarCena(game, 'Lan')
    }
    const membros = s.fase === 'sala' ? (s.sala?.membros ?? []) : []
    const outros = new Set(membros.filter((m) => m.id !== s.eu.id).map((m) => m.id))
    const outro = outros.size === 1 ? [...outros][0] : null // sala de 2: o parceiro (o de sempre)
    const host = membros.find((m) => m.papel === 'host')?.id ?? null
    // quem saiu: esquece as rápidas dele e não espera mais a cena dele
    for (const id of parceirosAntes)
      if (!outros.has(id)) {
        canal.esquecer(id)
        sincCena.saiu(id)
      }
    // parceiro novo (ou o mesmo que saiu e voltou): as minhas confiáveis com ele
    // começam outra sessão, do 0 (lib/lan/canal.js). Sem isso o número de
    // antes continuava e o outro ficava esperando a mensagem 0 para sempre.
    // Trocou o host da partida (eleição, 5A): todas recomeçam
    if (host !== hostAntes) canal.reiniciar()
    else for (const id of outros) if (!parceirosAntes.has(id)) canal.reiniciar(id)
    parceirosAntes = outros
    hostAntes = host
    // 5A, sala de N: um convidado que tinha caído voltou: o host manda a cena só para ele
    const caidosAgora = new Set((s.caidos ?? []).map((c) => c.id))
    if (ativa && souHostDaRede() && outros.size > 1 && !s.religando) for (const id of caidosAntes) if (!caidosAgora.has(id) && outros.has(id)) voltarVaga(game, id)
    caidosAntes = caidosAgora
    // 2D: alguém caiu no meio da partida em rede
    // (fora da sala com o parceiro não tem o que esperar: solta antes de trocar de cena)
    const naSala = naSalaComParceiro(s)
    const caiu = !naSala ? null : s.religando ? { eu: true, ate: s.religando.ate } : quedaQueParaTudo(s)
    if (caiu && ativa && !retomadaRecente()) {
      queda = caiu
      congelar(game)
    } else if (destravar && !caiu && (!esperaCena || !naSala)) {
      const chave = cenaDaPartida()
      if (!ativa || !naSalaComParceiro(s) || !chave || SO_CONTINUAM.includes(chave) || retomadaRecente()) descongelar(game)
      else if (souHostDaRede()) voltarRodada(game, chave, outro ?? undefined)
      else {
        // convidado: espera o host voltar a rodada
        queda = { retomando: true }
        esperaCena = setTimeout(() => {
          esperaCena = null
          console.warn('[rede] a cena da retomada não chegou: saindo da sala', canal.estadoDebug())
          descongelar(game)
          ativar(false)
          sairSala()
          lan.update((x) => ({ ...x, erro: MSG_PRESO }))
          trocarCena(game, 'Lan')
        }, ESPERA_CENA_MS)
      }
    }
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
      meuIndice,
      participantes: participantesDaPartida,
      sinc: () => sincCena.estado(),
      contagem: () => structuredClone(contagem),
      carga: (opcoes) => carga(opcoes),
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
    descongelar(game)
    clearInterval(vigia)
    pararCena()
    pararSala()
    jogoAtual = null
  }
}

// ---------- orçamento de performance (5A, só no dev: docs/rede-pvp.md "Orçamento") ----------
// Simula o tráfego de uma partida de N pela estrela: cada convidado manda o coração
// (rápida, `hz` por segundo) e um `dano` confiável a cada 2 s; o host junta os corações
// e manda UM pacote com todos a cada tick (a rápida igual para todos sai uma vez) e
// repassa os danos (confiável, para cada convidado). Chame em TODAS as abas ao mesmo tempo.
// Devolve { msgs: { env, rec }, bytes: {...}, porSegundo, segundos } contados no transporte.
async function carga({ segundos = 10, hz = 30 } = {}) {
  const host = souHostDaRede()
  const eu = get(lan).eu.id
  const coracoes = {}
  let danos = 0
  const desligar = [
    canal.ao('_cargaCoracao', (d, _, de) => (coracoes[de] = d)),
    canal.ao('_cargaDano', (d, _, de) => {
      danos += 1
      if (host) canal.enviar('_cargaDanoDe', null, { de, ...d })
    }),
    canal.ao('_cargaPacote', () => {}),
    canal.ao('_cargaDanoDe', () => (danos += 1)),
  ]
  zerarContagem()
  const t0 = performance.now()
  let tick = 0
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      tick += 1
      const pos = { x: Math.round(200 + 100 * Math.sin(tick / 9)), y: Math.round(200 + 80 * Math.cos(tick / 7)), k: 0, r: 1 }
      if (host) canal.enviarRapido('_cargaPacote', { r: 1, t: tick, c: { ...coracoes, [eu]: pos } })
      else canal.enviarRapido('_cargaCoracao', pos)
      if (!host && tick % (hz * 2) === 0) canal.enviar('_cargaDano', null, { lado: meuIndice(), dano: 3, r: 1 })
      if (performance.now() - t0 >= segundos * 1000) {
        clearInterval(timer)
        resolve()
      }
    }, 1000 / hz)
  })
  for (const f of desligar) f()
  const s = (performance.now() - t0) / 1000
  const c = structuredClone(contagem)
  const env = c.direto.env + c.servidor.env
  const rec = c.direto.rec + c.servidor.rec
  return { host, segundos: Math.round(s * 10) / 10, ticksPorSegundo: Math.round(tick / s), danos, contagem: c, porSegundo: { env: Math.round(env / s), rec: Math.round(rec / s), bytesEnvServidor: Math.round(c.servidor.bytesEnv / s), bytesRecServidor: Math.round(c.servidor.bytesRec / s), bytesEnvDireto: Math.round(c.direto.bytesEnv / s) } }
}
