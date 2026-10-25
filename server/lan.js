// Servidor do modo LAN (docs/lan.md) e do modo ONLINE (docs/online.md): lobby
// por WebSocket em /lan e, na LAN, descoberta de salas por broadcast UDP. Roda
// dentro do `npm run lan` / `npm start` (server/index.js) e do `npm run dev`
// (plugin no vite.config.js).
//
// ONLINE (servidor na internet): as salas não aparecem numa lista; cada uma
// tem um CÓDIGO (ex.: K7QX2) que o host passa para o amigo. Sem descoberta UDP
// e sem trocar o mDNS (na internet o WebRTC se acha pelo STUN/TURN, que o
// servidor manda para os navegadores nas boas-vindas).
//
// O servidor só junta as pessoas: guarda as salas, repassa o chat, os sinais
// do WebRTC (a imagem do host vai direto para o convidado) e os controles do
// convidado. Mensagens em JSON, { t: 'tipo', ... }; binário = quadro da
// transmissão reserva (JPEG), repassado ao outro membro da sala.
//
//   anexarLan(httpServer, { online, ice, autenticar, relacoes })   liga o /lan num servidor http; devolve { fechar() }
//
// CONTAS (server/contas.js): o "ola" pode trazer o token (JWT do Supabase).
// Com token, o servidor valida (autenticar) ANTES de dar as boas-vindas; token
// inválido ou sem resposta = entra como convidado, sem derrubar ninguém.
//
// AMIGOS (server/amigos.js, Fase 1B): quem está logado ganha presença
// (disponivel | em_partida | offline) visível SÓ para os amigos (amizade mútua
// e sem bloqueio) e pode convidar um amigo online para a sua sala:
//   cliente -> servidor  convidar {para: userId} · responderConvite {id, aceitar}
//                        amigosMudaram {com?: userId}   (depois de um RPC de amizade)
//   servidor -> cliente  presencas {mapa} · presenca {id, status} · convite {...}
//                        conviteEnviado · conviteResposta · conviteFim · conviteNegado
//                        amigosAtualizar
//
// JOGAR RÁPIDO (server/fila.js, Fase 1C): fila casual de PVP 1x1, FIFO, para
// conta ou convidado (convidado não ganha XP). Achou par: os dois confirmam em
// CONFIRMAR_MS; confirmaram, o servidor cria a sala (casual: true, PVP) e o
// host já começa a partida (escolha de personagem). Revanche só com o aceite
// dos dois (REVANCHE_MS). Numa sala casual, quem sai fecha a sala.
//   cliente -> servidor  fila {acao: 'entrar'|'sair'} · confirmar {id, aceitar} · revanche {aceitar}
//   servidor -> cliente  fila {estado: 'procurando'|'fora', desde?, esperaMs?, convidado?, motivo?}
//                        pareado {id, oponente, expiraEm, restanteMs} · pareadoEstado {id, eu, oponente}
//                        pareadoFim {id, voltou, motivo} · partidaCasual {salaId, host} · filaNegada {msg, estado}
//                        revanche {estado: 'pedida'|'aceita'|'recusada'|'expirada'|'indisponivel', ...}
// HOST da sala casual: quem tem o menor ping até o servidor, se os dois são
// conhecidos e a diferença passa de FOLGA_PING_MS; senão, quem confirmou primeiro.
import { WebSocketServer } from 'ws'
import dgram from 'node:dgram'
import os from 'node:os'
import crypto from 'node:crypto'
import { criarLimite } from './contas.js'
import { CONVITE_MS, CONVITES_POR_MINUTO, MAX_CONVITES_RECEBIDOS } from './amigos.js'
import { criarFila, agendarPadrao, ACOES_FILA_POR_MINUTO, REVANCHE_MS, FOLGA_PING_MS } from './fila.js'

export const PROTOCOLO = 4
export const PORTA_DESCOBERTA = 47777
export const MAX_MEMBROS = 2
const ANUNCIO_MS = 1500
const VALIDADE_ANUNCIO_MS = 5000
const BATIMENTO_MS = 5000
const MAX_NOME = 16
const MAX_CHAT = 120
const MODOS = ['pvp', 'coop']
// Limite de mensagens por cliente (balde de fichas): sobra para os controles e
// o WebRTC, mas segura quem martela o servidor
const FICHAS_POR_SEGUNDO = 120
const MAX_FICHAS = 240
const MAX_SALAS = 500
const MAX_CLIENTES = 1000
// código das salas: sem letras que se confundem (0/O, 1/I/L)
const LETRAS_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const TAMANHO_CODIGO = 5

const novoId = () => crypto.randomBytes(4).toString('hex')

// o que os outros veem da conta (nada de id do usuário nem e-mail)
const resumoPerfil = (p) =>
  p && {
    tag: String(p.tag ?? ''),
    nome: limpar(p.nome_exibicao, MAX_NOME),
    avatar: { tipo: p.avatar_tipo ?? 'padrao', id: p.avatar_id ?? null, url: p.avatar_url ?? null },
    titulo: p.titulo_equipado ?? null,
    nivel: Number(p.nivel) || 1,
    xp: Number(p.xp) || 0,
  }
const contaPublica = (c) => (c.perfil ? { tag: c.perfil.tag, avatar: c.perfil.avatar, nivel: c.perfil.nivel, titulo: c.perfil.titulo } : null)
export const normalizarCodigo = (texto) =>
  String(texto ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
const limpar = (texto, max) =>
  String(texto ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max)

// ---------- endereços ----------

const semPrefixo = (ip) => String(ip ?? '').replace(/^::ffff:/, '')
export const ehLoopback = (ip) => /^127\./.test(ip) || ip === '::1' || ip === 'localhost'

// IPv4 da máquina na rede: [{ ip, mascara }]
export function enderecosLocais() {
  const lista = []
  for (const infos of Object.values(os.networkInterfaces()))
    for (const i of infos ?? []) if (i.family === 'IPv4' && !i.internal) lista.push({ ip: i.address, mascara: i.netmask })
  return lista
}

const paraNumero = (ip) => ip.split('.').reduce((n, p) => (n << 8) + Number(p), 0) >>> 0
const paraIp = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.')

// Endereço de broadcast de cada rede (192.168.0.10/24 -> 192.168.0.255)
export function broadcasts(locais = enderecosLocais()) {
  const lista = locais.map(({ ip, mascara }) => paraIp((paraNumero(ip) & paraNumero(mascara)) | (~paraNumero(mascara) >>> 0)))
  return [...new Set([...lista, '255.255.255.255'])]
}

// O IP da máquina que o outro lado alcança: o da mesma rede que `destino`
export function ipParaAlcancar(destino, locais = enderecosLocais()) {
  if (!destino || ehLoopback(destino)) return '127.0.0.1'
  const n = paraNumero(destino)
  const mesmaRede = locais.find(({ ip, mascara }) => (paraNumero(ip) & paraNumero(mascara)) === (n & paraNumero(mascara)))
  return (mesmaRede ?? locais[0])?.ip ?? '127.0.0.1'
}

// O Chrome e o Firefox escondem o IP nos candidatos do WebRTC (um nome
// "xxxx.local", resolvido por mDNS, que muitas redes bloqueiam). O servidor
// sabe o IP de quem mandou: troca o nome por ele.
export const trocarMdns = (texto, ip) => (typeof texto === 'string' ? texto.replace(/[\w-]+\.local\b/g, ip) : texto)

// ---------- salas ----------

// salasRede(): as salas que a descoberta achou em outros servidores
// enderecos(): http://ip:porta onde este servidor serve o jogo (dica no lobby)
// online: servidor na internet (salas só por código); ice: servidores STUN/TURN
// para o WebRTC dos navegadores; agora(): relógio (os testes trocam)
// autenticar(token): { id, perfil } | null (server/contas.js; sem ele, todo
// mundo é convidado)
// relacoes(userId): { amigos, bloqueios, pedidos } | null (server/amigos.js;
// sem ele não há presença nem convites)
// agendar(fn, ms) -> cancelar: timers da fila e da revanche (os testes trocam);
// log: linhas para o console do servidor (host escolhido na fila)
export function criarLobby({ locais = enderecosLocais, salasRede = () => [], enderecos = () => [], online = false, ice = [], maxSalas = MAX_SALAS, agora = Date.now, autenticar = null, relacoes = null, agendar = agendarPadrao, log = () => {} } = {}) {
  const clientes = new Map() // id -> cliente
  const salas = new Map() // id -> sala
  const codigos = new Map() // código -> id da sala
  const presenca = new Map() // id do usuário (conta) -> cliente
  const convites = new Map() // id do convite -> { id, de, deUsuario, para, salaId, expira, timer }
  const limiteConvites = criarLimite({ max: CONVITES_POR_MINUTO, agora })
  const limiteFila = criarLimite({ max: ACOES_FILA_POR_MINUTO, agora })

  const novoCodigo = () => {
    for (;;) {
      const bytes = crypto.randomBytes(TAMANHO_CODIGO)
      const codigo = [...bytes].map((b) => LETRAS_CODIGO[b % LETRAS_CODIGO.length]).join('')
      if (!codigos.has(codigo)) return codigo
    }
  }

  const fecharSala = (sala) => {
    encerrarRevanche(sala)
    salas.delete(sala.id)
    codigos.delete(sala.codigo)
    for (const conv of [...convites.values()]) if (conv.salaId === sala.id) encerrarConvite(conv, 'cancelado', 'a sala foi fechada')
  }

  // balde de fichas: false = mensagem demais, joga fora
  const temFicha = (cliente) => {
    const t = agora()
    cliente.fichas = Math.min(MAX_FICHAS, cliente.fichas + ((t - cliente.recarga) / 1000) * FICHAS_POR_SEGUNDO)
    cliente.recarga = t
    if (cliente.fichas < 1) return false
    cliente.fichas -= 1
    return true
  }

  const enviar = (cliente, msg) => {
    if (cliente.ws.readyState === 1) cliente.ws.send(JSON.stringify(msg))
  }

  const publica = (sala) => ({
    id: sala.id,
    codigo: sala.codigo,
    nome: sala.nome,
    modo: sala.modo,
    emPartida: sala.emPartida,
    casual: Boolean(sala.casual),
    max: MAX_MEMBROS,
    membros: [...sala.membros].map((id) => {
      const c = clientes.get(id)
      return { id, nome: c.nome, papel: id === sala.host ? 'host' : 'convidado', pronto: c.pronto, ping: c.ping, conta: contaPublica(c) }
    }),
  })

  const resumo = (sala) => ({
    id: sala.id,
    nome: sala.nome,
    host: clientes.get(sala.host)?.nome ?? '?',
    jogadores: sala.membros.size,
    max: MAX_MEMBROS,
    modo: sala.modo,
    emPartida: sala.emPartida,
  })

  const avisarSala = (sala) => {
    const msg = { t: 'sala', sala: publica(sala) }
    for (const id of sala.membros) enviar(clientes.get(id), msg)
  }

  function sair(cliente, motivo = 'o host saiu') {
    const sala = salas.get(cliente.sala)
    cliente.sala = null
    cliente.pronto = false
    if (!sala) return
    sala.membros.delete(cliente.id)
    atualizarStatus(cliente)
    // sala casual (JOGAR RÁPIDO): sem o oponente não tem o que fazer nela
    if (cliente.id === sala.host || sala.casual) {
      fecharSala(sala)
      for (const id of sala.membros) {
        const outro = clientes.get(id)
        outro.sala = null
        outro.pronto = false
        enviar(outro, { t: 'fechada', motivo: sala.casual ? 'o oponente saiu da partida' : motivo, ...(sala.casual && { casual: true }) })
        atualizarStatus(outro)
      }
      return
    }
    avisarSala(sala)
  }

  // ---------- presença (só para amigos) ----------

  const statusDe = (c) => (!c.usuario ? 'offline' : salas.get(c.sala)?.emPartida ? 'em_partida' : 'disponivel')
  // amizade mútua no que o servidor sabe e nenhum bloqueio em nenhuma direção
  const ehAmigoMutuo = (a, b) => Boolean(a.usuario && b.usuario && a.usuario !== b.usuario && a.amigos.has(b.usuario) && b.amigos.has(a.usuario) && !a.bloqueios.has(b.usuario) && !b.bloqueios.has(a.usuario))
  const amigosOnline = (c) => [...c.amigos].map((id) => presenca.get(id)).filter((o) => o && o !== c && ehAmigoMutuo(c, o))

  // o que `c` vê: o status de cada amigo online (quem não aparece está offline)
  const enviarPresencas = (c) => {
    const mapa = {}
    for (const o of amigosOnline(c)) mapa[o.usuario] = statusDe(o)
    enviar(c, { t: 'presencas', mapa })
  }
  const anunciar = (c, status, usuario = c.usuario) => {
    c.statusPub = status
    for (const o of amigosOnline(c)) enviar(o, { t: 'presenca', id: usuario, status })
  }
  function atualizarStatus(c) {
    if (!c.usuario || presenca.get(c.usuario) !== c) return
    const status = statusDe(c)
    if (status !== c.statusPub) anunciar(c, status)
  }

  // entrou na conta (ou conectou já logado): carrega os amigos e se anuncia
  async function registrar(c) {
    const usuario = c.usuario
    presenca.set(usuario, c)
    c.amigos = new Set()
    c.bloqueios = new Set()
    c.pedidos = new Set()
    c.statusPub = 'offline'
    c.carregando = usuario // a fila espera os bloqueios desta conta chegarem
    const rel = relacoes ? await Promise.resolve().then(() => relacoes(usuario)).catch(() => null) : null
    if (c.carregando === usuario) c.carregando = null
    if (c.usuario !== usuario || presenca.get(usuario) !== c || !clientes.has(c.id)) return
    if (rel) Object.assign(c, { amigos: rel.amigos, bloqueios: rel.bloqueios, pedidos: rel.pedidos })
    enviarPresencas(c)
    anunciar(c, statusDe(c))
  }

  // saiu da conta, trocou de conta ou desconectou
  function desregistrar(c, usuario) {
    if (!usuario || presenca.get(usuario) !== c) return
    anunciar(c, 'offline', usuario)
    presenca.delete(usuario)
    for (const conv of [...convites.values()]) if (conv.de === c.id || conv.para === usuario) encerrarConvite(conv, 'cancelado', 'o convite foi cancelado')
  }

  // a lista de amigos/bloqueios mudou (RPC no navegador): relê e reajusta quem vê quem
  async function recarregar(c, avisar = null) {
    const usuario = c.usuario
    if (!usuario || !relacoes || presenca.get(usuario) !== c) return
    const rel = await Promise.resolve().then(() => relacoes(usuario)).catch(() => null)
    if (!rel || c.usuario !== usuario || presenca.get(usuario) !== c || !clientes.has(c.id)) return
    const envolvidos = new Set([...c.amigos, ...c.bloqueios, ...c.pedidos, ...rel.amigos, ...rel.bloqueios, ...rel.pedidos])
    Object.assign(c, { amigos: rel.amigos, bloqueios: rel.bloqueios, pedidos: rel.pedidos })
    enviarPresencas(c)
    for (const id of envolvidos) {
      const o = presenca.get(id)
      if (!o || o === c) continue
      if (ehAmigoMutuo(c, o)) enviar(o, { t: 'presenca', id: usuario, status: statusDe(c) })
      else {
        enviar(o, { t: 'presenca', id: usuario, status: 'offline' })
        for (const conv of [...convites.values()]) if ((conv.de === c.id && conv.para === o.usuario) || (conv.de === o.id && conv.para === usuario)) encerrarConvite(conv, 'cancelado', 'o convite foi cancelado')
      }
      // só avisa (e relê) quem tem relação com a conta: não dá para mandar ping a estranhos
      if (id === avisar) {
        enviar(o, { t: 'amigosAtualizar' })
        recarregar(o)
      }
    }
  }

  // ---------- convites ----------

  // para: o convite acabou (aceito, recusado, expirado ou cancelado)
  function encerrarConvite(conv, resultado, motivo = '') {
    if (!convites.delete(conv.id)) return
    clearTimeout(conv.timer)
    const alvo = presenca.get(conv.para)
    const remetente = clientes.get(conv.de)
    if (resultado === 'expirado' || resultado === 'cancelado') {
      if (alvo) enviar(alvo, { t: 'conviteFim', id: conv.id, motivo: motivo || 'o convite expirou' })
      if (remetente && resultado === 'expirado') enviar(remetente, { t: 'conviteResposta', id: conv.id, para: conv.para, resultado })
    }
  }
  function expirarConvites() {
    const t = agora()
    for (const conv of [...convites.values()]) if (conv.expira <= t) encerrarConvite(conv, 'expirado')
  }

  // ---------- JOGAR RÁPIDO (fila casual, server/fila.js) ----------

  const bloqueados = (a, b) => Boolean(a.usuario && b.usuario && (a.bloqueios.has(b.usuario) || b.bloqueios.has(a.usuario)))
  // nunca a mesma conta (duas abas) nem quem se bloqueou; os dois fora de sala
  const podeParear = (a, b) => a !== b && clientes.has(a.id) && clientes.has(b.id) && !a.sala && !b.sala && !(a.usuario && a.usuario === b.usuario) && !bloqueados(a, b)
  const oponente = (c) => ({ nome: c.nome, ...(c.perfil && { tag: c.perfil.tag, avatar: c.perfil.avatar, nivel: c.perfil.nivel }) })
  const MOTIVO_FORA = { tempo: 'você não confirmou a tempo', recusou: 'você recusou a partida' }
  const MOTIVO_VOLTA = { tempo: 'o oponente não confirmou a tempo', recusou: 'o oponente recusou a partida' }
  const fila = criarFila({
    agora,
    agendar,
    podeParear,
    avisos: {
      procurando: (c, desde) => enviar(c, { t: 'fila', estado: 'procurando', desde, esperaMs: Math.max(0, agora() - desde), convidado: !c.usuario }),
      pareado(par) {
        for (const [eu, outro] of [[par.a, par.b], [par.b, par.a]])
          enviar(eu, { t: 'pareado', id: par.id, oponente: oponente(outro), expiraEm: par.expira, restanteMs: Math.max(0, par.expira - agora()) })
      },
      respostas(par) {
        for (const [eu, outro] of [[par.a, par.b], [par.b, par.a]]) enviar(eu, { t: 'pareadoEstado', id: par.id, eu: par.confirmados.includes(eu), oponente: par.confirmados.includes(outro) })
      },
      desfeito(par, { volta, fora }) {
        const culpa = fora[0]?.motivo
        for (const c of volta) enviar(c, { t: 'pareadoFim', id: par.id, voltou: true, motivo: `${MOTIVO_VOLTA[culpa] ?? 'o oponente desistiu'}: voltando para a fila` })
        for (const { c, motivo } of fora) {
          enviar(c, { t: 'pareadoFim', id: par.id, voltou: false, motivo: MOTIVO_FORA[motivo] ?? '' })
          enviar(c, { t: 'fila', estado: 'fora', motivo: MOTIVO_FORA[motivo] ?? '' })
        }
      },
      fechado: (par, ordem) => criarCasual(ordem),
    },
  })

  // estado: onde ele ficou (o cliente acerta a tela por ele)
  const negarFila = (c, msg) => enviar(c, { t: 'filaNegada', msg, estado: fila.estado(c) })

  // tira `c` da fila (procurando ou pareado); true se estava nela
  function removerDaFila(c, motivo) {
    const estava = fila.estado(c)
    if (estava === 'fora') return false
    fila.sair(c, motivo)
    // pareado: o desfeito já avisou
    if (estava === 'procurando') enviar(c, { t: 'fila', estado: 'fora', motivo: '' })
    return true
  }

  // os dois confirmaram: a sala casual, com o host já escolhido
  function escolherHost([primeiro, segundo]) {
    const [p, q] = [primeiro.ping, segundo.ping]
    const medidos = Number.isFinite(p) && Number.isFinite(q)
    if (medidos && Math.abs(p - q) >= FOLGA_PING_MS) return p <= q ? { host: primeiro, outro: segundo, regra: 'menor ping' } : { host: segundo, outro: primeiro, regra: 'menor ping' }
    return { host: primeiro, outro: segundo, regra: 'confirmou primeiro' }
  }
  function criarCasual(ordem) {
    // alguém bloqueou o outro enquanto confirmavam: não junta
    if (bloqueados(ordem[0], ordem[1])) {
      for (const c of ordem) enviar(c, { t: 'fila', estado: 'fora', motivo: 'a partida não pôde começar: tente de novo' })
      return
    }
    const { host, outro, regra } = escolherHost(ordem)
    const sala = criarSalaDe(host, 'PARTIDA RÁPIDA')
    if (!sala) {
      enviar(outro, { t: 'erro', msg: 'o servidor está lotado: tente de novo daqui a pouco' })
      for (const c of ordem) enviar(c, { t: 'fila', estado: 'fora', motivo: 'o servidor está lotado' })
      return
    }
    sala.casual = true
    // para o registro de partidas (1D): quem jogou, com conta ou convidado
    sala.participantes = [host, outro].map((c) => ({ cliente: c.id, usuario: c.usuario, convidado: !c.usuario }))
    sala.criadaEm = agora()
    entrarNaSala(outro, sala)
    outro.pronto = true
    avisarSala(sala)
    for (const c of [host, outro]) enviar(c, { t: 'partidaCasual', salaId: sala.id, host: host.id })
    log(`[fila] partida rápida ${sala.codigo}: host ${host.nome} (${host.ping ?? '?'} ms) x ${outro.nome} (${outro.ping ?? '?'} ms), regra: ${regra}`)
  }

  // revanche na sala casual: os dois aceitam em REVANCHE_MS
  function encerrarRevanche(sala) {
    sala.revanche?.cancelar?.()
    sala.revanche = null
  }
  const avisarMembros = (sala, msg) => {
    for (const id of sala.membros) enviar(clientes.get(id), msg)
  }
  function verificarRevanche(sala) {
    if (!sala.revanche || sala.revanche.expira > agora()) return
    encerrarRevanche(sala)
    if (salas.get(sala.id) === sala) avisarMembros(sala, { t: 'revanche', estado: 'expirada' })
  }

  // IP de `de` como `para` enxerga (para os candidatos do WebRTC)
  const ipVisto = (de, para) => (ehLoopback(de.ip) ? ipParaAlcancar(para.ip, locais()) : de.ip)

  const boasVindas = (c, m, conta, tentouConta) => {
    c.usuario = conta?.id ?? null
    c.perfil = conta?.id ? resumoPerfil(conta.perfil) : null
    c.nome = (c.perfil?.nome ?? limpar(m.nome, MAX_NOME)) || 'JOGADOR'
    c.ok = true
    enviar(c, {
      t: 'bemvindo',
      id: c.id,
      ip: c.ip,
      protocolo: PROTOCOLO,
      enderecos: online ? [] : enderecos(),
      online,
      ice,
      conta: c.perfil,
      ...(tentouConta && !c.usuario && { contaInvalida: true }),
    })
    if (c.usuario) registrar(c)
  }

  // cria a sala de `c` (saindo da atual); null se o servidor está lotado
  function criarSalaDe(c, nome) {
    removerDaFila(c, 'sala')
    sair(c)
    if (salas.size >= maxSalas) {
      enviar(c, { t: 'erro', msg: 'o servidor está lotado: tente de novo daqui a pouco' })
      return null
    }
    const sala = { id: novoId(), codigo: novoCodigo(), nome: limpar(nome, 24) || `SALA DE ${c.nome}`, host: c.id, membros: new Set([c.id]), modo: 'pvp', emPartida: false }
    salas.set(sala.id, sala)
    codigos.set(sala.codigo, sala.id)
    c.sala = sala.id
    c.pronto = true
    avisarSala(sala)
    return sala
  }

  function entrarNaSala(c, sala) {
    removerDaFila(c, 'sala')
    sair(c)
    sala.membros.add(c.id)
    c.sala = sala.id
    c.pronto = false
    avisarSala(sala)
  }

  const acoes = {
    ola(c, m) {
      if (c.ok || c.validando) return
      if (m.protocolo !== PROTOCOLO) return enviar(c, { t: 'erro', msg: `versão diferente do jogo (protocolo ${m.protocolo} x ${PROTOCOLO}): atualize os dois PCs` })
      const token = typeof m.token === 'string' && m.token.length <= 4096 ? m.token : null
      if (!token || !autenticar) return boasVindas(c, m, null, Boolean(m.token && autenticar))
      // o resto das mensagens espera (c.ok só depois de validar)
      c.validando = true
      Promise.resolve()
        .then(() => autenticar(token))
        .catch(() => null)
        .then((conta) => {
          c.validando = false
          if (!clientes.has(c.id)) return // saiu enquanto validava
          boasVindas(c, m, conta, true)
        })
    },
    nome(c, m) {
      // com conta, o nome é o do perfil (muda pelo perfil e chega pelo "conta")
      if (c.perfil) return
      c.nome = limpar(m.nome, MAX_NOME) || c.nome
      const sala = salas.get(c.sala)
      if (sala) avisarSala(sala)
    },
    // entrou, saiu ou mudou o perfil sem reconectar: { token } (null = saiu da conta)
    conta(c, m) {
      // cada pedido vai ao Supabase: um por segundo basta
      if (c.validando || agora() - (c.ultimaConta ?? -Infinity) < 1000) return
      c.ultimaConta = agora()
      const token = typeof m.token === 'string' && m.token.length <= 4096 ? m.token : null
      const aplicar = (conta) => {
        const antes = c.usuario
        const depois = conta?.id ?? null
        if (antes !== depois) removerDaFila(c, 'conta') // a fila olha a conta (mesma conta, bloqueios)
        if (antes && antes !== depois) {
          desregistrar(c, antes)
          Object.assign(c, { amigos: new Set(), bloqueios: new Set(), pedidos: new Set(), statusPub: 'offline' })
        }
        c.usuario = depois
        c.perfil = conta?.id ? resumoPerfil(conta.perfil) : null
        if (c.perfil?.nome) c.nome = c.perfil.nome
        enviar(c, { t: 'conta', conta: c.perfil, ...(token && autenticar && !c.usuario && { contaInvalida: true }) })
        const sala = salas.get(c.sala)
        if (sala) avisarSala(sala)
        if (depois && depois !== antes) registrar(c)
      }
      if (!token || !autenticar) return aplicar(null)
      c.validando = true
      Promise.resolve()
        .then(() => autenticar(token))
        .catch(() => null)
        .then((conta) => {
          c.validando = false
          if (clientes.has(c.id)) aplicar(conta)
        })
    },
    listar(c) {
      // online as salas são privadas: só entra quem tem o código
      if (online) return enviar(c, { t: 'salas', salas: [], rede: [] })
      enviar(c, { t: 'salas', salas: [...salas.values()].map(resumo), rede: salasRede() })
    },
    criar(c, m) {
      criarSalaDe(c, m.nome)
    },
    // pela lista (m.sala, só na LAN) ou pelo código (m.codigo)
    entrar(c, m) {
      const codigo = normalizarCodigo(m.codigo)
      const sala = codigo ? salas.get(codigos.get(codigo)) : online ? null : salas.get(m.sala)
      if (!sala) return enviar(c, { t: 'erro', msg: codigo ? `não achei a sala ${codigo}: confira o código` : 'essa sala não existe mais' })
      if (sala.membros.has(c.id)) return avisarSala(sala)
      if (sala.membros.size >= MAX_MEMBROS) return enviar(c, { t: 'erro', msg: 'a sala está cheia' })
      if (sala.emPartida) return enviar(c, { t: 'erro', msg: 'a sala está no meio de uma partida' })
      entrarNaSala(c, sala)
    },
    sair(c) {
      sair(c, 'o host fechou a sala')
    },
    pronto(c, m) {
      const sala = salas.get(c.sala)
      if (!sala || sala.host === c.id) return
      c.pronto = Boolean(m.valor)
      avisarSala(sala)
    },
    modo(c, m) {
      const sala = salas.get(c.sala)
      if (!sala || sala.host !== c.id || !MODOS.includes(m.modo) || sala.casual) return // a casual é PVP
      sala.modo = m.modo
      for (const id of sala.membros) if (id !== sala.host) clientes.get(id).pronto = false // mudou o combinado: confirma de novo
      avisarSala(sala)
    },
    partida(c, m) {
      const sala = salas.get(c.sala)
      if (!sala || sala.host !== c.id) return
      sala.emPartida = Boolean(m.valor)
      if (!sala.emPartida) {
        for (const id of sala.membros) if (id !== sala.host) clientes.get(id).pronto = false
      } else {
        for (const conv of [...convites.values()]) if (conv.salaId === sala.id) encerrarConvite(conv, 'cancelado', 'a partida começou')
      }
      for (const id of sala.membros) atualizarStatus(clientes.get(id))
      avisarSala(sala)
    },
    expulsar(c, m) {
      const sala = salas.get(c.sala)
      const alvo = clientes.get(m.id)
      if (!sala || sala.host !== c.id || !alvo || alvo.sala !== sala.id || alvo === c || sala.casual) return
      sair(alvo)
      enviar(alvo, { t: 'fechada', motivo: 'o host tirou você da sala' })
    },
    chat(c, m) {
      const sala = salas.get(c.sala)
      const texto = limpar(m.texto, MAX_CHAT)
      if (!sala || !texto) return
      for (const id of sala.membros) enviar(clientes.get(id), { t: 'chat', de: c.id, nome: c.nome, texto })
    },
    // o navegador mexeu na lista de amigos (RPC): relê e, se `com` (id do outro) tem relação, avisa
    amigosMudaram(c, m) {
      if (!c.usuario || !relacoes || agora() - (c.ultimoAmigos ?? -Infinity) < 1000) return
      c.ultimoAmigos = agora()
      recarregar(c, typeof m.com === 'string' ? presenca.get(m.com)?.usuario : null)
    },
    convidar(c, m) {
      expirarConvites()
      const negar = (msg) => enviar(c, { t: 'conviteNegado', para: typeof m.para === 'string' ? m.para : null, msg })
      if (!c.usuario || !c.perfil || !relacoes) return negar('entre com sua conta para convidar amigos')
      const alvo = typeof m.para === 'string' ? presenca.get(m.para) : null
      // não diz se é offline, não-amigo ou bloqueado
      if (!alvo || !ehAmigoMutuo(c, alvo)) return negar('esse amigo não está disponível')
      if (statusDe(alvo) === 'em_partida') return negar(`${alvo.nome} está numa partida`)
      let sala = salas.get(c.sala)
      if (sala && sala.host !== c.id) return negar('só o host da sala pode convidar')
      if (sala?.emPartida) return negar('a sala está no meio de uma partida')
      if (sala?.membros.has(alvo.id)) return negar(`${alvo.nome} já está na sua sala`)
      if (sala && sala.membros.size >= MAX_MEMBROS) return negar('a sala está cheia')
      const doPar = [...convites.values()].filter((v) => v.para === alvo.usuario)
      if (doPar.some((v) => v.deUsuario === c.usuario)) return negar(`você já convidou ${alvo.nome}: espere a resposta`)
      if (doPar.length >= MAX_CONVITES_RECEBIDOS) return negar(`${alvo.nome} está com convites demais: tente daqui a pouco`)
      if (!limiteConvites.usar(c.usuario)) return negar(`convites demais: espere um minuto (máximo ${CONVITES_POR_MINUTO} por minuto)`)
      // sem sala, cria a do convite (o host escolhe PVP ou CO-OP depois)
      sala ??= criarSalaDe(c, '')
      if (!sala) return
      const conv = { id: crypto.randomBytes(8).toString('hex'), de: c.id, deUsuario: c.usuario, para: alvo.usuario, salaId: sala.id, expira: agora() + CONVITE_MS, timer: null }
      conv.timer = setTimeout(expirarConvites, CONVITE_MS + 50)
      conv.timer.unref?.()
      convites.set(conv.id, conv)
      enviar(alvo, { t: 'convite', id: conv.id, de: { id: c.usuario, tag: c.perfil.tag, nome: c.nome, avatar: c.perfil.avatar }, modo: sala.modo, expiraEm: conv.expira, restanteMs: CONVITE_MS })
      enviar(c, { t: 'conviteEnviado', id: conv.id, para: alvo.usuario, expiraEm: conv.expira })
    },
    responderConvite(c, m) {
      expirarConvites()
      const conv = convites.get(String(m.id))
      if (!conv || !c.usuario || conv.para !== c.usuario) return enviar(c, { t: 'conviteFim', id: String(m.id), motivo: 'o convite expirou' })
      convites.delete(conv.id)
      clearTimeout(conv.timer)
      const remetente = clientes.get(conv.de)
      if (m.aceitar !== true) return remetente && enviar(remetente, { t: 'conviteResposta', id: conv.id, para: conv.para, resultado: 'recusado' })
      const sala = salas.get(conv.salaId)
      const vale = sala && remetente && remetente.usuario === conv.deUsuario && remetente.sala === sala.id && sala.host === remetente.id && ehAmigoMutuo(remetente, c) && !sala.emPartida && statusDe(c) !== 'em_partida' && sala.membros.size < MAX_MEMBROS
      if (!vale) {
        enviar(c, { t: 'conviteFim', id: conv.id, motivo: 'a sala não está mais disponível' })
        if (remetente) enviar(remetente, { t: 'conviteResposta', id: conv.id, para: conv.para, resultado: 'falhou' })
        return
      }
      entrarNaSala(c, sala)
      enviar(remetente, { t: 'conviteResposta', id: conv.id, para: conv.para, resultado: 'aceito' })
    },
    // JOGAR RÁPIDO: entrar / sair da fila
    fila(c, m) {
      if (!limiteFila.usar(c.id)) return negarFila(c, 'calma: ações demais na fila, espere um pouco')
      if (m.acao === 'sair') {
        if (!removerDaFila(c, 'saiu')) enviar(c, { t: 'fila', estado: 'fora', motivo: '' }) // já estava fora: confirma
        return
      }
      if (m.acao !== 'entrar') return
      const negar = (msg) => negarFila(c, msg)
      const estado = fila.estado(c)
      if (estado === 'procurando') return enviar(c, { t: 'fila', estado, desde: fila.desde(c), esperaMs: agora() - fila.desde(c), convidado: !c.usuario })
      if (estado === 'pareado') return // a confirmação já está na tela dele
      if (c.validando || (c.carregando && c.carregando === c.usuario)) return negar('espere a conta carregar')
      if (c.sala) return negar('saia da sala para entrar na fila')
      if (c.usuario && [...clientes.values()].some((o) => o !== c && o.usuario === c.usuario && fila.estado(o) !== 'fora')) return negar('sua conta já está na fila em outra aba')
      fila.entrar(c)
    },
    // aceitar (ou recusar) a partida achada: { id, aceitar }
    confirmar(c, m) {
      if (!limiteFila.usar(c.id)) return negarFila(c, 'calma: ações demais na fila, espere um pouco')
      const id = String(m.id ?? '')
      if (fila.responder(c, id, m.aceitar !== false) === 'expirado') enviar(c, { t: 'pareadoFim', id, voltou: false, motivo: 'essa partida não vale mais' })
    },
    // revanche na sala casual: { aceitar }
    revanche(c, m) {
      if (!limiteFila.usar(c.id)) return negarFila(c, 'calma: ações demais, espere um pouco')
      const sala = salas.get(c.sala)
      if (!sala?.casual) return
      if (sala.membros.size < MAX_MEMBROS) return enviar(c, { t: 'revanche', estado: 'indisponivel', motivo: 'o oponente já saiu' })
      verificarRevanche(sala)
      if (m.aceitar !== true) {
        encerrarRevanche(sala)
        return avisarMembros(sala, { t: 'revanche', estado: 'recusada', de: c.id })
      }
      if (!sala.revanche) {
        const expira = agora() + REVANCHE_MS
        sala.revanche = { votos: new Set(), expira, cancelar: agendar(() => verificarRevanche(sala), REVANCHE_MS + 50) }
      }
      const r = sala.revanche
      r.votos.add(c.id)
      if ([...sala.membros].every((id) => r.votos.has(id))) {
        encerrarRevanche(sala)
        sala.revanches = (sala.revanches ?? 0) + 1
        return avisarMembros(sala, { t: 'revanche', estado: 'aceita', host: sala.host })
      }
      avisarMembros(sala, { t: 'revanche', estado: 'pedida', de: c.id, expiraEm: r.expira, restanteMs: Math.max(0, r.expira - agora()) })
    },
    ping(c, m) {
      enviar(c, { t: 'pong', n: m.n })
    },
    meuPing(c, m) {
      const ms = Math.round(Number(m.ms))
      if (!Number.isFinite(ms) || ms === c.ping) return
      c.ping = ms
      const sala = salas.get(c.sala)
      if (sala) avisarSala(sala)
    },
    // repassa para os outros da sala (sinais do WebRTC e controles)
    para(c, m) {
      const sala = salas.get(c.sala)
      if (!sala || !m.dados || typeof m.dados !== 'object') return
      for (const id of sala.membros) {
        if (id === c.id) continue
        const outro = clientes.get(id)
        let dados = m.dados
        if (online) {
          enviar(outro, { t: 'de', de: c.id, dados })
          continue
        }
        if (dados.tipo === 'ice' && dados.candidato) dados = { ...dados, candidato: { ...dados.candidato, candidate: trocarMdns(dados.candidato.candidate, ipVisto(c, outro)) } }
        if ((dados.tipo === 'oferta' || dados.tipo === 'resposta') && dados.sdp) dados = { ...dados, sdp: trocarMdns(dados.sdp, ipVisto(c, outro)) }
        enviar(outro, { t: 'de', de: c.id, dados })
      }
    },
  }

  return {
    clientes,
    salas,
    resumos: () => [...salas.values()].map(resumo),
    conectar(ws, ip) {
      const cliente = { id: novoId(), ws, ip: semPrefixo(ip), nome: 'JOGADOR', sala: null, pronto: false, ping: null, ok: false, validando: false, usuario: null, perfil: null, amigos: new Set(), bloqueios: new Set(), pedidos: new Set(), statusPub: 'offline', fichas: MAX_FICHAS, recarga: agora() }
      clientes.set(cliente.id, cliente)
      return cliente
    },
    receber(cliente, texto, binario) {
      if (!temFicha(cliente)) return
      if (binario) {
        const sala = salas.get(cliente.sala)
        if (!sala || sala.host !== cliente.id) return // só o host transmite
        for (const id of sala.membros) {
          const outro = clientes.get(id)
          // quadro velho não serve: se o outro lado está atrasado, pula
          if (id !== cliente.id && outro.ws.readyState === 1 && outro.ws.bufferedAmount < 1_500_000) outro.ws.send(texto, { binary: true })
        }
        return
      }
      let m
      try {
        m = JSON.parse(texto)
      } catch {
        return
      }
      if (!m || typeof m.t !== 'string' || !Object.hasOwn(acoes, m.t)) return
      if (!cliente.ok && m.t !== 'ola') return
      acoes[m.t](cliente, m)
    },
    // convites pendentes (os testes conferem a expiração)
    expirarConvites,
    // fila casual (os testes conferem os estados e vencem os prazos)
    fila,
    desconectar(cliente) {
      removerDaFila(cliente, 'saiu')
      desregistrar(cliente, cliente.usuario)
      sair(cliente, 'o host desconectou')
      clientes.delete(cliente.id)
    },
  }
}

// ---------- descoberta (UDP) ----------
// Cada servidor anuncia as próprias salas na rede; o lobby lista as dos outros
// com o endereço do WebSocket de lá.
function criarDescoberta(lobby, porta, log) {
  const id = novoId()
  const remotos = new Map() // id do servidor -> { ip, porta, salas, visto }
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
  let timer = null

  socket.on('error', (erro) => {
    log(`[lan] descoberta de salas desligada (${erro.code ?? erro.message}); ainda dá para entrar pelo IP`)
    clearInterval(timer)
    try {
      socket.close()
    } catch {}
  })
  socket.on('message', (buf, rinfo) => {
    let m
    try {
      m = JSON.parse(buf.toString())
    } catch {
      return
    }
    if (m?.jogo !== 'dodge-lan' || m.id === id || m.protocolo !== PROTOCOLO || !Array.isArray(m.salas)) return
    remotos.set(m.id, { ip: rinfo.address, porta: Number(m.porta), salas: m.salas.slice(0, 20), visto: Date.now() })
  })
  socket.bind(PORTA_DESCOBERTA, () => {
    socket.setBroadcast(true)
    timer = setInterval(() => {
      const salas = lobby.resumos()
      const p = porta()
      if (!salas.length || !p) return
      const msg = Buffer.from(JSON.stringify({ jogo: 'dodge-lan', protocolo: PROTOCOLO, id, porta: p, salas }))
      for (const destino of broadcasts()) socket.send(msg, PORTA_DESCOBERTA, destino, () => {})
    }, ANUNCIO_MS)
  })

  return {
    salas() {
      const agora = Date.now()
      const lista = []
      for (const [chave, r] of remotos) {
        if (agora - r.visto > VALIDADE_ANUNCIO_MS) remotos.delete(chave)
        else for (const s of r.salas) lista.push({ ...s, endereco: `ws://${r.ip}:${r.porta}/lan`, ip: r.ip })
      }
      return lista
    },
    fechar() {
      clearInterval(timer)
      try {
        socket.close()
      } catch {}
    },
  }
}

// ---------- servidor ----------

// online: servidor na internet (sem descoberta UDP, salas por código)
// ice: [{ urls, username?, credential? }] para o WebRTC dos navegadores
export function anexarLan(httpServer, { log = console.log, descoberta = true, online = false, ice = [], maxClientes = MAX_CLIENTES, autenticar = null, relacoes = null } = {}) {
  let rede = null
  const porta = () => httpServer.address()?.port
  const lobby = criarLobby({ online, ice, autenticar, relacoes, log, salasRede: () => rede?.salas() ?? [], enderecos: () => (porta() ? enderecosDoJogo(porta()) : []) })
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 * 1024 })
  if (descoberta && !online) rede = criarDescoberta(lobby, porta, log)

  const aoUpgrade = (req, socket, head) => {
    if (new URL(req.url, 'http://x').pathname !== '/lan') return // o resto (ex.: o HMR do Vite) não é com a gente
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  }
  httpServer.on('upgrade', aoUpgrade)

  wss.on('connection', (ws, req) => {
    if (wss.clients.size > maxClientes) {
      ws.close(1013, 'servidor lotado')
      return
    }
    const cliente = lobby.conectar(ws, req.socket.remoteAddress)
    ws.vivo = true
    ws.on('pong', () => (ws.vivo = true))
    ws.on('message', (dados, binario) => lobby.receber(cliente, binario ? dados : dados.toString(), binario))
    ws.on('close', () => lobby.desconectar(cliente))
    ws.on('error', () => {})
  })

  // conexão que morreu sem fechar (Wi-Fi caiu): derruba e fecha a sala
  const batimento = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.vivo) {
        ws.terminate()
        continue
      }
      ws.vivo = false
      ws.ping()
    }
  }, BATIMENTO_MS)

  return {
    lobby,
    fechar() {
      clearInterval(batimento)
      rede?.fechar()
      httpServer.off('upgrade', aoUpgrade)
      for (const ws of wss.clients) ws.terminate()
      wss.close()
    },
  }
}

// Endereços para o outro PC abrir o jogo (http://ip:porta)
export const enderecosDoJogo = (porta) => enderecosLocais().map(({ ip }) => `http://${ip}:${porta}`)
