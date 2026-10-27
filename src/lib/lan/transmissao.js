import { writable, derived, get } from 'svelte/store'
import { lan, aoParceiro, enviarAoParceiro, definirMedidor } from './rede.js'
import { criarVigiaDireto, VIVO_MS } from './vigiaDireto.js'

// Conexão direta do modo LAN/ONLINE (docs/lan.md, docs/rede-pvp.md): WebRTC só com o
// canal de dados (RTCDataChannel) da partida em rede (game/rede.js) e o ping da
// ligação. Os sinais do WebRTC passam pelo servidor (rede.js), que troca os nomes
// .local pelo IP.
//
// ESTRELA PELO HOST (Fase 5A): o host da partida tem uma ligação com CADA convidado
// (um RTCPeerConnection por convidado, com o canal, o vigia e o ping dela); cada
// convidado tem só a ligação com o host. Convidados nunca se ligam entre si: o que um
// manda para o outro passa pelo host (game/rede.js). Quando a ligação direta com um
// convidado não abre (firewall, NAT, o Brave com escudos), as mensagens dele vão pelo
// servidor (o caminho garantido): `enviarPeloServidor(dados, para)`.
//
// (Até a 5A este arquivo também tinha a imagem do "Remote Play": vídeo do canvas e
// JPEGs pela reserva. Ninguém mostrava mais nada disso desde que a partida roda no PC
// de cada um; saiu junto com a ligação única.)
//
//   ligarJogo(game)            (compatibilidade; não faz nada)
//   ligacao                    store { ping, rota }: a ligação com o host (convidado) ou a
//                              PIOR das ligações do host com os convidados
//   ligacoes                   store { [idDoMembro]: { ping, rota, aberto, mudo } }
//   pingPartida                { ms, rota, fps } (a barra de cima e o lobby)
//   enviarRapido(dados, para?) · aoRapido(fn(dados, de))   pelo direto (ou pelo servidor)
//   enviarPeloServidor(dados, para?)  sempre pelo servidor (os reenvios do canal)
//   medidas()                  { [idDoMembro]: rtt } das ligações diretas abertas e entregando
//                              (a eleição do host, server/eleicao.js)
//
// Canal direto MUDO (lib/lan/vigiaDireto.js): aberto, mas o outro não recebe. Cada
// lado manda um '_vivo' pelo direto a cada VIVO_MS e o outro responde '_vivoOk' pelo
// servidor; sem resposta, aquela ligação manda tudo pelo servidor até ela voltar.
//
// Contagem (orçamento de performance, docs/rede-pvp.md): `contagem` soma o que saiu e
// chegou por cada caminho (mensagens e bytes do JSON); `zerarContagem()` recomeça.
export const ligacao = writable({ ping: null, rota: null, fps: null })
export const ligacoes = writable({})

// O ping que importa na partida: o da ligação direta (no host, a pior delas). Sem ela,
// a volta pelo servidor: o meu ping até ele mais o do outro. { ms, rota: 'direta' | 'turn' | 'servidor' | null }
export const pingPartida = derived([lan, ligacao], ([s, l]) => {
  const outros = s.fase === 'sala' ? (s.sala?.membros ?? []).filter((m) => m.id !== s.eu.id) : []
  if (!outros.length) return { ms: null, rota: null, fps: null }
  if (l.ping != null) return { ms: l.ping, rota: l.rota, fps: null }
  const pior = Math.max(...outros.map((o) => (o.ping == null ? Infinity : o.ping)))
  const ms = s.ping != null && Number.isFinite(pior) ? s.ping + pior : null
  return { ms, rota: ms == null ? null : 'servidor', fps: null }
})
export const ROTAS = { direta: 'direto', turn: 'por TURN', servidor: 'pelo servidor' }
// verde / amarelo / vermelho
export const corDoPing = (ms) => (ms == null ? '#9a9ab0' : ms <= 80 ? '#6dffb0' : ms <= 150 ? '#ffd23a' : '#ff6070')

const ESPERA_DIRETO_MS = { lan: 7000, online: 12000 } // depois disso o convidado pede de novo
const configRtc = () => ({ iceServers: get(lan).ice ?? [] })

export const ligarJogo = () => {}

// ---------- as ligações (uma por parceiro) ----------

// id do parceiro -> { pc, canal, vigia, papel, inicio, candidatos, stats, avisouMudo, ping, rota }
const links = new Map()
const ouvintesRapido = new Set()

export const contagem = { direto: { env: 0, rec: 0, bytesEnv: 0, bytesRec: 0 }, servidor: { env: 0, rec: 0, bytesEnv: 0, bytesRec: 0 } }
export function zerarContagem() {
  for (const c of Object.values(contagem)) Object.assign(c, { env: 0, rec: 0, bytesEnv: 0, bytesRec: 0 })
}
const contar = (rota, sentido, texto) => {
  const c = contagem[rota]
  c[sentido] += 1
  c[sentido === 'env' ? 'bytesEnv' : 'bytesRec'] += texto.length
}

function publicar() {
  const mapa = {}
  for (const [id, l] of links) mapa[id] = { ping: l.ping, rota: l.rota, aberto: l.canal?.readyState === 'open', mudo: l.vigia.mudo() }
  ligacoes.set(mapa)
  // a pior ligação direta (no convidado é a única)
  const medidas = [...links.values()].filter((l) => l.ping != null)
  if (!medidas.length || medidas.length < links.size) return ligacao.set({ ping: null, rota: null, fps: null })
  const pior = medidas.reduce((a, b) => (b.ping > a.ping ? b : a))
  ligacao.set({ ping: pior.ping, rota: pior.rota, fps: null })
}

export const enviarPeloServidor = (dados, para) => {
  const texto = JSON.stringify(dados)
  contar('servidor', 'env', texto)
  enviarAoParceiro(dados, para)
}

// pelo direto daquele parceiro, se ele está aberto e entregando
function peloDireto(l, dados) {
  if (l?.canal?.readyState !== 'open' || l.vigia.mudo()) return false
  try {
    const texto = JSON.stringify(dados)
    l.canal.send(texto)
    contar('direto', 'env', texto)
    return true
  } catch {
    return false
  }
}

// para: id do parceiro (sem: todos os parceiros; no convidado é só o host)
export function enviarRapido(dados, para) {
  if (para !== undefined) {
    if (!peloDireto(links.get(para), dados)) enviarPeloServidor(dados, souHostAgora() ? para : undefined)
    return
  }
  const alvos = parceirosAgora()
  const semDireto = alvos.filter((id) => !peloDireto(links.get(id), dados))
  if (!semDireto.length) return
  // ninguém com direto: uma mensagem só pelo servidor (ele repassa a todos)
  if (semDireto.length === alvos.length) enviarPeloServidor(dados)
  else for (const id of semDireto) enviarPeloServidor(dados, id)
}

// fn(dados, de) recebe tanto o que vem pelo canal direto quanto pelo servidor
export function aoRapido(fn) {
  ouvintesRapido.add(fn)
  const parar = aoParceiro((dados, de) => {
    if (dados && typeof dados === 'object') contar('servidor', 'rec', JSON.stringify(dados))
    fn(dados, de)
  })
  return () => {
    ouvintesRapido.delete(fn)
    parar()
  }
}

// as medidas da eleição do host: o RTT das ligações diretas abertas e entregando
export function medidas() {
  const saida = {}
  for (const [id, l] of links) if (l.canal?.readyState === 'open' && !l.vigia.mudo() && l.ping != null) saida[id] = l.ping
  return saida
}
definirMedidor(medidas)

const souHostAgora = () => get(lan).fase === 'sala' && get(lan).papel === 'host'
// com quem tenho ligação (host: os convidados; convidado: o host)
function parceirosAgora() {
  const s = get(lan)
  if (s.fase !== 'sala') return []
  const outros = (s.sala?.membros ?? []).filter((m) => m.id !== s.eu.id)
  if (s.papel === 'host') return outros.map((m) => m.id)
  const host = outros.find((m) => m.papel === 'host')
  return host ? [host.id] : []
}

function novoLink(id, papel) {
  fecharLink(id)
  const l = { pc: new RTCPeerConnection(configRtc()), canal: null, vigia: criarVigiaDireto(), papel, inicio: performance.now(), candidatos: [], stats: null, avisouMudo: false, ping: null, rota: null }
  links.set(id, l)
  l.pc.onicecandidate = (e) => e.candidate && enviarAoParceiro({ tipo: 'ice', candidato: e.candidate.toJSON() }, papel === 'host' ? id : undefined)
  comecarStats(id, l)
  return l
}

function fecharLink(id) {
  const l = links.get(id)
  if (!l) return
  links.delete(id)
  clearInterval(l.stats)
  l.vigia.fechou()
  try {
    l.pc.close()
  } catch {}
  publicar()
}

function usarCanal(id, l, c) {
  const abrir = () => {
    l.canal = c
    l.vigia.abriu()
    l.avisouMudo = false
    publicar()
  }
  c.onopen = abrir
  c.onclose = () => {
    if (l.canal !== c) return
    l.canal = null
    l.vigia.fechou()
    publicar()
  }
  c.onmessage = (e) => {
    let dados
    try {
      dados = JSON.parse(e.data)
    } catch {
      return
    }
    contar('direto', 'rec', e.data)
    // o outro quer saber se o direto entrega: responde pelo servidor
    if (dados?.tipo === '_vivo') return enviarAoParceiro({ tipo: '_vivoOk', n: dados.n }, l.papel === 'host' ? id : undefined)
    ouvintesRapido.forEach((fn) => fn(dados, id))
  }
  if (c.readyState === 'open') abrir()
}

// com o direto aberto: o '_vivo' de cada VIVO_MS em cada ligação (e o aviso quando emudece)
setInterval(() => {
  for (const [id, l] of links) {
    if (l.canal?.readyState !== 'open') continue
    const mudo = l.vigia.mudo()
    if (mudo !== l.avisouMudo) {
      console.warn(mudo ? `[lan] o canal direto com ${id} não está entregando: pelo servidor` : `[lan] o canal direto com ${id} voltou`)
      publicar()
    }
    l.avisouMudo = mudo
    try {
      l.canal.send(JSON.stringify({ tipo: '_vivo', n: l.vigia.vivo() }))
    } catch {}
  }
}, VIVO_MS)

// ping e rota de cada ligação direta
function comecarStats(id, l) {
  l.stats = setInterval(async () => {
    if (links.get(id) !== l) return
    let relatorio
    try {
      relatorio = await l.pc.getStats()
    } catch {
      return
    }
    const itens = [...relatorio.values()]
    const transporte = itens.find((r) => r.type === 'transport' && r.selectedCandidatePairId)
    const par = transporte ? relatorio.get(transporte.selectedCandidatePairId) : itens.find((r) => r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded')
    const local = par && relatorio.get(par.localCandidateId)
    const remoto = par && relatorio.get(par.remoteCandidateId)
    l.ping = par?.currentRoundTripTime != null ? Math.round(par.currentRoundTripTime * 1000) : null
    l.rota = !par ? null : local?.candidateType === 'relay' || remoto?.candidateType === 'relay' ? 'turn' : 'direta'
    publicar()
  }, 1000)
}

// ---------- host: uma oferta por convidado ----------

async function oferecer(id) {
  const l = novoLink(id, 'host')
  usarCanal(id, l, l.pc.createDataChannel('partida', { ordered: true }))
  const oferta = await l.pc.createOffer()
  if (links.get(id) !== l) return
  await l.pc.setLocalDescription(oferta)
  enviarAoParceiro({ tipo: 'oferta', sdp: l.pc.localDescription.sdp }, id)
}

// ---------- convidado: responde a oferta do host ----------

async function responder(id, sdp) {
  const l = novoLink(id, 'convidado')
  l.pc.ondatachannel = (e) => links.get(id) === l && usarCanal(id, l, e.channel)
  await l.pc.setRemoteDescription({ type: 'offer', sdp })
  for (const c of l.candidatos) await l.pc.addIceCandidate(c).catch(() => {})
  l.candidatos = []
  const resposta = await l.pc.createAnswer()
  if (links.get(id) !== l) return
  await l.pc.setLocalDescription(resposta)
  enviarAoParceiro({ tipo: 'resposta', sdp: l.pc.localDescription.sdp })
}

aoParceiro(async (dados, de) => {
  const s = get(lan)
  switch (dados?.tipo) {
    case '_vivoOk':
      links.get(de)?.vigia.ok(dados.n)
      break
    case 'oferta':
      // só a oferta do host da partida vale (o servidor só repassa a dele, mas na troca de host pode chegar uma velha)
      if (s.papel !== 'host' && s.sala?.membros.find((m) => m.id === de)?.papel === 'host') responder(de, dados.sdp).catch((e) => console.warn('[lan] oferta', e))
      break
    case 'resposta': {
      const l = links.get(de)
      if (l?.papel === 'host') await l.pc.setRemoteDescription({ type: 'answer', sdp: dados.sdp }).catch((e) => console.warn('[lan] resposta', e))
      break
    }
    case 'ice': {
      const l = links.get(de)
      if (!l) return
      if (!l.pc.remoteDescription) l.candidatos.push(dados.candidato)
      else await l.pc.addIceCandidate(dados.candidato).catch(() => {})
      break
    }
    case 'quero': {
      // o convidado pediu (entrou agora, a ligação caiu ou o host mudou): começa de novo,
      // a não ser que a ligação dele ainda esteja tentando
      if (s.papel !== 'host') return
      const l = links.get(de)
      const espera = s.online ? ESPERA_DIRETO_MS.online : ESPERA_DIRETO_MS.lan
      const tentando = l && l.canal?.readyState !== 'open' && performance.now() - l.inicio < espera + 3000
      if (l?.canal?.readyState === 'open' || tentando) return
      oferecer(de).catch((e) => console.warn('[lan] ligação', e))
      break
    }
  }
})

// Liga / desliga conforme a sala: cada convidado pede a ligação ao host da partida
// (já no lobby, para ela estar pronta quando a partida começar); o host fecha a de quem
// saiu. Trocou o host (eleição): as ligações velhas fecham e as novas se pedem.
let timerPedido = null
let assinatura = ''
lan.subscribe((s) => {
  const naSala = s.fase === 'sala'
  const meus = new Set(naSala ? parceirosAgora() : [])
  const papel = naSala ? s.papel : null
  // ligações que não valem mais (o parceiro saiu, ou eu mudei de papel)
  for (const [id, l] of [...links]) if (!meus.has(id) || l.papel !== papel) fecharLink(id)
  const nova = `${papel}|${[...meus].sort().join(',')}`
  if (nova === assinatura) return
  assinatura = nova
  clearInterval(timerPedido)
  timerPedido = null
  if (papel !== 'convidado' || !meus.size) return
  const [host] = meus
  const pedir = () => {
    const l = links.get(host)
    if (l?.canal?.readyState !== 'open') enviarAoParceiro({ tipo: 'quero' })
  }
  pedir()
  timerPedido = setInterval(pedir, 5000)
})
