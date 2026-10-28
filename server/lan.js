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
//   anexarLan(httpServer, { online, ice, autenticar, relacoes, registro, metricas })   liga o /lan num servidor http; devolve { fechar() }
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
// O host não começou em CASUAL_INICIO_MS (aba escondida, PC travado): a sala
// fecha ('fechada' casual com o motivo) e os dois voltam para a fila, sem
// contar abandono, e não pareiam um com o outro por EVITAR_PAR_MS.
//
// PARTIDAS E XP (server/partidas.js, Fase 1D): cada partida PVP de uma sala
// (casual ou de amigos) ganha um registro quando o host começa (ou na
// revanche); o id vai no `sala.partidaId`. No fim, CADA cliente manda o
// resultado uma vez; o servidor compara os relatos e quem saiu da sala, e o
// banco concede o XP (registro = criarRegistro(supabase); sem ele, sem XP).
//   cliente -> servidor  resultado {partidaId, vencedorLado: 0|1|null, rodadas, duracao, personagem}
//   servidor -> cliente  recompensa {partidaId, xpGanho, xpTotal?, nivelAntes?, nivelDepois?, itensNovos?, motivo}
//
// RECUPERAÇÃO DE CONEXÃO (Fase 2D, docs/rede-pvp.md): o `bemvindo` traz uma
// chave de retomada (`retomada`, aleatória, uma por conexão, trocada a cada
// retomada). Quem cai NO MEIO DE UMA PARTIDA (sala.emPartida) não sai da sala
// na hora: a vaga (sala, papel, partida, casual) fica guardada RETOMADA_MS e a
// sala mostra o membro com `caiu` (ms que faltam). Uma conexão nova com
// `ola {retomar: chave}` (com a MESMA conta, ou convidado nos dois) ocupa a vaga:
// o cliente é o mesmo (mesmo id, mesmo lado no relato do resultado). Passou o
// prazo: sai como antes; o host que não voltou fecha a sala e a partida acaba
// sem XP e sem derrota (motivo 'host_caiu', server/partidas.js). Fora da
// partida (lobby, fila) cair continua tirando na hora.
//   cliente -> servidor  ola {..., retomar?: chave}
//   servidor -> cliente  bemvindo {..., retomada: chave nova, retomado?: true, retomadaNegada?: motivo}
//                        sala {... membros: [{..., caiu: ms | null}]}
//
// SALAS DE N (Fase 5A, docs/rede-pvp.md "Salas de N"): o tamanho da sala vem do
// modo (MODOS_SALA: PVP 1x1 e CO-OP de 2 = 2; 'coop4' 3–4 (CO-OP de 3 e 4, Fase 5B),
// 'ffa' 3–4 (todos contra todos, Fase 5D) e '2x2' = 4, este ainda "em breve": a sala existe, a partida ainda não). Cada membro
// tem uma VAGA (0..N-1, o host é a 0): a menor livre quando entra, a mesma na
// retomada e durante a partida; fora da partida as vagas são recompactadas quando
// alguém sai (0..n-1 sem buracos: num modo de 2 o convidado é sempre a vaga 1).
// O repasse ("para") é em ESTRELA pelo host: o que um convidado manda só chega ao
// host; o host manda para todos ou para um (`a`: id do membro). Um convidado
// nunca fala direto com outro.
//   cliente -> servidor  para {dados, a?: id}   (a: só o host usa; o convidado vai sempre ao host)
//   servidor -> cliente  sala {..., max, membros: [{..., vaga}]} (membros em ordem de vaga)
//
// DONO x HOST DA PARTIDA (5A, server/eleicao.js): o DONO é quem criou a sala (vaga 0):
// tira gente, escolhe o modo, convida e começa. O HOST DA PARTIDA (sala.host, o
// `papel: 'host'` dos membros) é a autoridade e o centro da estrela. No COMEÇAR do
// dono (`partida {valor: true, eleicao: true}`) o servidor pede as medidas a todos
// (`eleicao {id, ms}`), espera até ELEICAO_MS (ou todos responderem `medicao`), elege
// pelo placar de eleicao.js, marca a partida e manda `comecar` para o eleito, que
// leva todos à primeira tela. O host não muda no meio da partida (nem na revanche:
// `partida` sem `eleicao`, do host, começa na hora como sempre). Saiu do lobby o host
// que não é o dono: volta a ser o dono. A casual não elege (regra do ping da fila).
//   cliente -> servidor  partida {valor, eleicao?} · medicao {id, diretos: {idDoMembro: rtt}}
//   servidor -> cliente  eleicao {id, ms} · comecar {salaId}
//                        sala {..., dono, eleicao: bool, eleito: {id, nome, motivo} | null,
//                              membros: [{..., papel: 'host' | 'convidado', dono: bool}]}
import { WebSocketServer } from 'ws'
import dgram from 'node:dgram'
import os from 'node:os'
import crypto from 'node:crypto'
import { criarLimite } from './contas.js'
import { CONVITE_MS, CONVITES_POR_MINUTO, MAX_CONVITES_RECEBIDOS } from './amigos.js'
import { criarFila, agendarPadrao, ACOES_FILA_POR_MINUTO, REVANCHE_MS, FOLGA_PING_MS, CASUAL_INICIO_MS, EVITAR_PAR_MS } from './fila.js'
import { criarPartidas } from './partidas.js'
import { elegerHost, lerDiretos, ELEICAO_MS } from './eleicao.js'
import { METRICAS_NULA } from './metricas.js'
import { nomeOfensivo, censurarTexto } from '../src/lib/palavrasBloqueadas.js'
import { nomeSeguro } from '../src/lib/contaRegras.js'

export const PROTOCOLO = 10
export const PORTA_DESCOBERTA = 47777
// Fase 5A: o tamanho de cada modo (min para começar, max da sala). emBreve: a sala
// aceita o modo, mas a partida dele ainda não existe (o lobby mostra "em breve")
export const MODOS_SALA = {
  pvp: { min: 2, max: 2 },
  coop: { min: 2, max: 2 },
  coop4: { min: 3, max: 4 }, // 5B: o CO-OP de 3 e 4 existe (coop/ArenaRedeCoopN.js)
  ffa: { min: 3, max: 4 }, // 5D: o todos contra todos existe (scenes/PvpArenaN.js)
  '2x2': { min: 4, max: 4, emBreve: true },
}
export const MAX_MEMBROS = 4 // a maior sala de todas (o de cada sala: maxDoModo)
export const maxDoModo = (modo) => (MODOS_SALA[modo] ?? MODOS_SALA.pvp).max
const ANUNCIO_MS = 1500
const VALIDADE_ANUNCIO_MS = 5000
const BATIMENTO_MS = 5000
export const RETOMADA_MS = 20_000 // caiu no meio da partida: a vaga espera isto pela volta
export const RETOMADAS_POR_MINUTO = 20 // tentativas de retomada por endereço
const RECONEXAO_MS = 120_000 // voltar em até 2 min depois de cair conta como reconexão (métricas)
const MAX_NOME = 16
const MAX_CHAT = 120
const MODOS = Object.keys(MODOS_SALA)
// a aba do jogo em segundo plano há tanto tempo: os outros da sala são avisados (Fase 2F)
export const SEGUNDO_PLANO_MS = 4000
const VERSO = /^verso\.[a-z0-9_]{2,24}$/
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
    // o filtro de nomes também vale aqui: perfil antigo, ou banco sem a 0005 (nome do Google)
    nome: nomeSeguro(limpar(p.nome_exibicao, MAX_NOME)),
    avatar: { tipo: p.avatar_tipo ?? 'padrao', id: p.avatar_id ?? null, url: p.avatar_url ?? null },
    titulo: p.titulo_equipado ?? null,
    // verso de carta equipado (Fase 2F): só o id; o cliente desenha (id desconhecido = o padrão)
    verso: VERSO.test(p.verso_equipado ?? '') ? p.verso_equipado : null,
    nivel: Number(p.nivel) || 1,
    xp: Number(p.xp) || 0,
  }
const contaPublica = (c) => (c.perfil ? { tag: c.perfil.tag, avatar: c.perfil.avatar, nivel: c.perfil.nivel, titulo: c.perfil.titulo, verso: c.perfil.verso } : null)
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
// nome de convidado (quem tem conta usa o do perfil, que o banco já filtrou):
// a mesma lista de palavras do perfil; '' = não serve
const nomeConvidado = (texto) => {
  const nome = limpar(texto, MAX_NOME)
  return nome && !nomeOfensivo(nome) ? nome : ''
}

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
// registro: o banco das partidas e do XP (server/partidas.js, criarRegistro;
// sem ele as partidas não dão XP)
// eleicaoMs: a janela de medição da eleição do host (anexarLan usa ELEICAO_MS; sem
// ela, 0: decide na hora só com os pings que o servidor já tem)
export function criarLobby({ eleicaoMs = 0, locais = enderecosLocais, salasRede = () => [], enderecos = () => [], online = false, ice = [], maxSalas = MAX_SALAS, agora = Date.now, autenticar = null, relacoes = null, registro = null, agendar = agendarPadrao, log = () => {}, metricas = METRICAS_NULA } = {}) {
  const clientes = new Map() // id -> cliente
  const salas = new Map() // id -> sala
  const codigos = new Map() // código -> id da sala
  const presenca = new Map() // id do usuário (conta) -> cliente
  const convites = new Map() // id do convite -> { id, de, deUsuario, para, salaId, expira, timer }
  const limiteConvites = criarLimite({ max: CONVITES_POR_MINUTO, agora })
  const limiteFila = criarLimite({ max: ACOES_FILA_POR_MINUTO, agora })
  // a recompensa vai para o cliente da partida ou, se ele reconectou, para o
  // cliente atual da MESMA conta (nunca para outra conta)
  const entregar = (x, msg) => {
    const c = clientes.get(x.cliente)
    if (c && !c.caido && (c.usuario ?? null) === (x.conta ?? null)) return enviar(c, msg)
    const outro = x.conta ? presenca.get(x.conta) : null
    if (outro) enviar(outro, msg)
  }
  const partidas = criarPartidas({ registro, agora, agendar, entregar, log, versao: PROTOCOLO, metricas })
  const saiuDaConta = new Map() // conta -> quando caiu (só para contar reconexões; nada por jogador sai daqui)
  const retomadas = new Map() // chave de retomada -> cliente
  const limiteRetomada = criarLimite({ max: RETOMADAS_POR_MINUTO, agora })
  // o cliente que vale hoje (a conexão nova que retomou aponta para a vaga velha)
  const atual = (c) => {
    while (c.retomou) c = c.retomou
    return c
  }
  const darChave = (c) => {
    if (c.retomada) retomadas.delete(c.retomada)
    c.retomada = crypto.randomBytes(24).toString('base64url')
    retomadas.set(c.retomada, c)
    return c.retomada
  }

  const novoCodigo = () => {
    for (;;) {
      const bytes = crypto.randomBytes(TAMANHO_CODIGO)
      const codigo = [...bytes].map((b) => LETRAS_CODIGO[b % LETRAS_CODIGO.length]).join('')
      if (!codigos.has(codigo)) return codigo
    }
  }

  const fecharSala = (sala) => {
    encerrarRevanche(sala)
    sala.esperaInicio?.()
    sala.esperaInicio = null
    sala.eleicao?.cancelar?.()
    sala.eleicao = null
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
    partidaId: sala.partidaId ?? null,
    max: maxDoModo(sala.modo),
    dono: sala.dono,
    eleicao: Boolean(sala.eleicao),
    eleito: sala.eleito ?? null,
    membros: membrosDaSala(sala).map((c) => ({ id: c.id, vaga: c.vaga, nome: c.nome, papel: c.id === sala.host ? 'host' : 'convidado', dono: c.id === sala.dono, pronto: c.pronto, ping: c.ping, conta: contaPublica(c), segundoPlano: Boolean(c.segundoPlano), caiu: c.caido ? Math.max(0, c.caido.desde + RETOMADA_MS - agora()) : null })),
  })

  const resumo = (sala) => ({
    id: sala.id,
    nome: sala.nome,
    host: clientes.get(sala.host)?.nome ?? '?',
    jogadores: sala.membros.size,
    max: maxDoModo(sala.modo),
    modo: sala.modo,
    emPartida: sala.emPartida,
  })

  // em ordem de vaga (o dono é a 0) (5A)
  const membrosDaSala = (sala) =>
    [...sala.membros]
      .map((id) => clientes.get(id))
      .filter(Boolean)
      .sort((a, b) => (a.id === sala.dono ? -1 : b.id === sala.dono ? 1 : (a.vaga ?? 99) - (b.vaga ?? 99)))
  // os lados do registro: nos modos de 2 o host da partida primeiro (lado 0 = P1, como o
  // jogo conta); nos de N, a vaga (o host fica no lado dele: partidas.js hostLado)
  const membrosDaPartida = (sala) => {
    const ms = membrosDaSala(sala)
    if (maxDoModo(sala.modo) > 2) return ms
    return [...ms.filter((c) => c.id === sala.host), ...ms.filter((c) => c.id !== sala.host)]
  }
  const cheia = (sala) => sala.membros.size >= maxDoModo(sala.modo)
  // a menor vaga livre (o host é sempre a 0)
  const vagaLivre = (sala) => {
    const usadas = new Set(membrosDaSala(sala).map((c) => c.vaga))
    for (let v = 1; v < MAX_MEMBROS; v++) if (!usadas.has(v)) return v
    return MAX_MEMBROS
  }
  // fora da partida: vagas 0..n-1 sem buracos (na partida, cada um fica com a sua)
  const compactar = (sala) => {
    if (sala.emPartida) return
    membrosDaSala(sala).forEach((c, v) => (c.vaga = v))
  }

  const avisarSala = (sala) => {
    const msg = { t: 'sala', sala: publica(sala) }
    for (const id of sala.membros) enviar(clientes.get(id), msg)
  }

  // tirado: o host expulsou (não foi ele que saiu: não conta como abandono)
  // saiuEm: quando saiu de verdade (a vaga guardada que expirou saiu quando caiu)
  function sair(cliente, motivo = 'o host saiu: a sala foi fechada', { tirado = false, saiuEm } = {}) {
    const sala = salas.get(cliente.sala)
    cliente.sala = null
    cliente.pronto = false
    if (!sala) return
    if (!tirado) partidas.saiu(cliente, sala, saiuEm) // no meio da partida = abandono (server/partidas.js)
    sala.membros.delete(cliente.id)
    atualizarStatus(cliente)
    // sala casual (JOGAR RÁPIDO): sem o oponente não tem o que fazer nela. O dono saindo
    // fecha a sala; o host da partida saindo no meio dela também (a partida morre com ele)
    if (cliente.id === sala.dono || sala.casual || (cliente.id === sala.host && sala.emPartida)) {
      fecharSala(sala)
      for (const id of sala.membros) {
        const outro = clientes.get(id)
        outro.sala = null
        outro.pronto = false
        enviar(outro, { t: 'fechada', motivo: sala.casual ? 'o oponente saiu da partida: escolha jogar de novo ou volte ao menu' : motivo, ...(sala.casual && { casual: true }) })
        atualizarStatus(outro)
        // estava caído esperando voltar: sem sala não tem para onde voltar
        if (outro.caido) soltar(outro)
      }
      return
    }
    // o host eleito saiu no lobby: o centro volta a ser o dono
    if (cliente.id === sala.host) {
      sala.host = sala.dono
      sala.eleito = null
    }
    compactar(sala)
    avisarSala(sala)
    // saiu no meio da eleição: talvez todo mundo que ficou já tenha mandado as medidas
    if (sala.eleicao) conferirEleicao(sala)
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
    metricas.contar('logins')
    const caiu = saiuDaConta.get(usuario)
    saiuDaConta.delete(usuario)
    if (caiu != null && agora() - caiu < RECONEXAO_MS) metricas.contar('reconexoes')
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
    // bloqueou (ou foi bloqueado por) alguém da sala em que está
    removerBloqueados(salas.get(c.sala))
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

  // Bloquear alguém que está na MESMA sala (Fase 2F, docs/online.md): na sala (fora de
  // partida) quem não é o host sai, não importa quem bloqueou quem: se o host bloqueou o
  // convidado, ele é tirado; se o convidado bloqueou o host, é ele quem sai. O motivo é o
  // mesmo para os dois (não diz quem bloqueou). No meio da partida nada muda: vale quando
  // o host volta ao lobby (ação "partida" false). Entrar numa sala com bloqueio é barrado.
  const MSG_BLOQUEIO = 'você não pode ficar nesta sala: há um bloqueio entre os jogadores'
  // Sala de N (5A): cada convidado, em ordem de vaga, é comparado com quem fica antes dele
  // (o host e os convidados que ficaram): com bloqueio, ele sai. Nunca o host.
  function removerBloqueados(sala) {
    if (!sala || salas.get(sala.id) !== sala || sala.emPartida) return false
    const ficam = []
    const saem = []
    for (const c of membrosDaSala(sala)) (c.id !== sala.dono && ficam.some((o) => bloqueados(c, o)) ? saem : ficam).push(c)
    for (const saindo of saem) {
      if (salas.get(sala.id) !== sala) break // casual: o primeiro que sai fecha a sala
      sair(saindo, MSG_BLOQUEIO, { tirado: true }) // a partida (se houve) já acabou: não é abandono
      enviar(saindo, { t: 'fechada', motivo: MSG_BLOQUEIO, ...(sala.casual && { casual: true }) })
    }
    return saem.length > 0
  }
  // nunca a mesma conta (duas abas) nem quem se bloqueou; os dois fora de sala
  // pares que acabaram de falhar (a casual não começou): não juntam de novo logo
  const evitar = new Map() // `${id}|${id}` -> até quando
  const chavePar = (a, b) => [a.id, b.id].sort().join('|')
  const evitando = (a, b) => (evitar.get(chavePar(a, b)) ?? 0) > agora()
  const podeParear = (a, b) => a !== b && clientes.has(a.id) && clientes.has(b.id) && !a.sala && !b.sala && !(a.usuario && a.usuario === b.usuario) && !bloqueados(a, b) && !evitando(a, b)
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
        metricas.contar('fila_pares')
        metricas.amostra('fila_espera_ms', agora() - par.desde.a)
        metricas.amostra('fila_espera_ms', agora() - par.desde.b)
        for (const [eu, outro] of [[par.a, par.b], [par.b, par.a]])
          enviar(eu, { t: 'pareado', id: par.id, oponente: oponente(outro), expiraEm: par.expira, restanteMs: Math.max(0, par.expira - agora()) })
      },
      respostas(par) {
        for (const [eu, outro] of [[par.a, par.b], [par.b, par.a]]) enviar(eu, { t: 'pareadoEstado', id: par.id, eu: par.confirmados.includes(eu), oponente: par.confirmados.includes(outro) })
      },
      desfeito(par, { volta, fora }) {
        metricas.contar('fila_pares_desfeitos')
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
    sala.esperaInicio = agendar(() => casualNaoComecou(sala), CASUAL_INICIO_MS)
  }

  // o host da casual não começou a tempo: ninguém fica parado na sala sem
  // saber o que houve. Fecha, avisa e os dois voltam para a fila (sem abandono:
  // a partida nem começou)
  function casualNaoComecou(sala) {
    sala.esperaInicio = null
    if (salas.get(sala.id) !== sala || sala.emPartida) return
    const membros = membrosDaSala(sala)
    fecharSala(sala)
    log(`[fila] partida rápida ${sala.codigo}: o host não começou em ${CASUAL_INICIO_MS / 1000} s, os dois voltam para a fila`)
    if (membros.length === 2) {
      evitar.set(chavePar(membros[0], membros[1]), agora() + EVITAR_PAR_MS)
      agendar(() => {
        for (const [k, ate] of evitar) if (ate <= agora()) evitar.delete(k)
        fila.parear()
      }, EVITAR_PAR_MS + 50)
    }
    for (const c of membros) {
      c.sala = null
      c.pronto = false
      enviar(c, { t: 'fechada', casual: true, motivo: 'a partida não começou (o host não respondeu): procurando outra' })
      atualizarStatus(c)
    }
    // o convidado primeiro (ele não teve culpa)
    for (const c of [...membros].reverse()) if (clientes.has(c.id) && fila.entrar(c)) metricas.contar('fila_entradas')
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
    // voltando para a partida (caiu no meio): ocupa a vaga guardada
    const chave = typeof m.retomar === 'string' && m.retomar.length <= 64 ? m.retomar : null
    let negada = null
    if (chave) {
      const r = retomar(c, chave, conta)
      if (typeof r !== 'string') return
      negada = r
    }
    c.usuario = conta?.id ?? null
    c.perfil = conta?.id ? resumoPerfil(conta.perfil) : null
    c.nome = (c.perfil?.nome ?? nomeConvidado(m.nome)) || 'JOGADOR'
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
      retomada: darChave(c),
      ...(negada && { retomadaNegada: negada }),
      ...(tentouConta && !c.usuario && { contaInvalida: true }),
    })
    if (c.usuario) registrar(c)
  }

  // ---------- recuperação de conexão (Fase 2D) ----------

  // caiu no meio da partida: a vaga fica guardada RETOMADA_MS
  function segurar(c, sala) {
    metricas.contar('partidas_quedas')
    c.quedas = (c.quedas ?? 0) + 1 // estabilidade na eleição do host (5A)
    c.caido = { desde: agora(), cancelar: agendar(() => expirar(c), RETOMADA_MS) }
    removerDaFila(c, 'saiu')
    log(`[lan] ${c.nome} caiu no meio da partida (sala ${sala.codigo}): esperando ${RETOMADA_MS / 1000} s`)
    avisarSala(sala)
  }

  // não voltou a tempo: sai como sairia na hora (saiuEm = quando caiu)
  function expirar(c) {
    if (!c.caido || !clientes.has(c.id)) return
    const desde = c.caido.desde
    c.caido = null
    const sala = salas.get(c.sala)
    const host = sala?.host === c.id
    // o host que não volta: sem XP e sem derrota para ninguém (server/partidas.js)
    if (host && sala.emPartida) partidas.hostCaiu(sala)
    log(`[lan] ${c.nome} não voltou em ${RETOMADA_MS / 1000} s${sala ? ` (sala ${sala.codigo})` : ''}`)
    soltar(c, { saiuEm: desde, motivo: 'o host não voltou a tempo: a partida acabou sem XP e sem derrota para ninguém' })
  }

  // tira o cliente do servidor de vez (desconectou fora da partida ou o prazo acabou)
  function soltar(c, { saiuEm, motivo = 'o host perdeu a conexão: a sala foi fechada' } = {}) {
    c.caido?.cancelar?.()
    c.caido = null
    if (retomadas.get(c.retomada) === c) retomadas.delete(c.retomada)
    c.cancelarConta?.()
    c.cancelarConta = null
    c.cancelarSegundoPlano?.()
    c.cancelarSegundoPlano = null
    if (c.usuario) {
      const t = agora()
      for (const [id, quando] of saiuDaConta) if (t - quando >= RECONEXAO_MS) saiuDaConta.delete(id)
      saiuDaConta.set(c.usuario, saiuEm ?? t)
    }
    removerDaFila(c, 'saiu')
    desregistrar(c, c.usuario)
    sair(c, motivo, { saiuEm })
    clientes.delete(c.id)
  }

  // `novo` (conexão nova) quer a vaga da chave: devolve a vaga ou o motivo (texto) da recusa
  function retomar(novo, chave, conta) {
    if (!limiteRetomada.usar(novo.ip)) return 'tentativas demais de voltar: espere um pouco'
    const velho = retomadas.get(chave)
    const sala = velho && salas.get(velho.sala)
    if (!velho || velho === novo || !clientes.has(velho.id) || !sala || !(velho.caido || sala.emPartida)) return 'a partida não está mais esperando você'
    // a vaga é da conta (ou do convidado) que caiu: a chave sozinha não basta
    if ((velho.usuario ?? null) !== (conta?.id ?? null)) return 'essa partida é de outra conta'
    // nunca dois sockets na mesma vaga: o velho (que o servidor ainda não viu cair) sai
    const wsVelho = velho.ws
    if (!velho.caido && wsVelho !== novo.ws) {
      try {
        wsVelho.terminate?.() ?? wsVelho.close?.()
      } catch {}
    }
    velho.caido?.cancelar?.()
    velho.caido = null
    retomadas.delete(chave)
    velho.ws = novo.ws
    velho.ip = novo.ip
    velho.ok = true
    novo.retomou = velho
    clientes.delete(novo.id)
    metricas.contar('partidas_retomadas')
    log(`[lan] ${velho.nome} voltou para a partida (sala ${sala.codigo})`)
    enviar(velho, {
      t: 'bemvindo',
      id: velho.id,
      ip: velho.ip,
      protocolo: PROTOCOLO,
      enderecos: online ? [] : enderecos(),
      online,
      ice,
      conta: velho.perfil,
      retomada: darChave(velho),
      retomado: true,
    })
    avisarSala(sala)
    // voltou no meio de uma eleição: ainda dá para mandar as medidas
    if (sala.eleicao) enviar(velho, { t: 'eleicao', id: sala.eleicao.id, ms: Math.max(0, sala.eleicao.ate - agora()) })
    return velho
  }

  // ---------- eleição do host da partida (5A, server/eleicao.js) ----------

  function comecarEleicao(sala) {
    const id = novoId()
    const ate = agora() + eleicaoMs
    sala.eleicao = { id, ate, medidas: new Map(), cancelar: null }
    if (eleicaoMs > 0) {
      sala.eleicao.cancelar = agendar(() => fecharEleicao(sala, id), eleicaoMs)
      avisarMembros(sala, { t: 'eleicao', id, ms: eleicaoMs })
      avisarSala(sala)
      return
    }
    fecharEleicao(sala, id)
  }

  // todo mundo (de pé) já mandou as medidas: não precisa esperar o prazo
  function conferirEleicao(sala) {
    const e = sala.eleicao
    if (e && membrosDaSala(sala).every((c) => c.caido || e.medidas.has(c.id))) fecharEleicao(sala, e.id)
  }

  function fecharEleicao(sala, id) {
    const e = sala.eleicao
    if (!e || e.id !== id || salas.get(sala.id) !== sala) return
    e.cancelar?.()
    sala.eleicao = null
    const dono = clientes.get(sala.dono)
    const membros = membrosDaSala(sala).filter((c) => !c.caido)
    if (membros.length < 2 || sala.emPartida) {
      avisarSala(sala)
      if (dono && !sala.emPartida) enviar(dono, { t: 'erro', msg: 'a partida não começou: falta gente na sala' })
      return
    }
    const r = elegerHost({ membros: membros.map((c) => ({ id: c.id, vaga: c.vaga, ping: c.ping, quedas: c.quedas ?? 0 })), diretos: Object.fromEntries(e.medidas), dono: sala.dono })
    sala.host = r.host
    const host = clientes.get(r.host)
    sala.eleito = { id: r.host, nome: host?.nome ?? '?', motivo: r.motivo }
    log(`[lan] sala ${sala.codigo}: host da partida ${sala.eleito.nome} (${r.motivo}; pontos ${JSON.stringify(Object.fromEntries(membros.map((c) => [c.nome, r.pontos[c.id]])))})`)
    marcarPartida(sala, true)
    if (host) enviar(host, { t: 'comecar', salaId: sala.id })
  }

  // a partida começa / volta ao lobby (o registro do XP nasce quando começa)
  function marcarPartida(sala, valor) {
    const antes = sala.emPartida
    sala.emPartida = Boolean(valor)
    if (sala.emPartida) {
      sala.esperaInicio?.() // a casual começou: o prazo para começar acabou
      sala.esperaInicio = null
    }
    if (sala.emPartida && !antes) partidas.iniciar(sala, membrosDaPartida(sala))
    else if (!sala.emPartida && antes) partidas.encerrou(sala)
    if (!sala.emPartida) {
      for (const id of sala.membros) if (id !== sala.dono) clientes.get(id).pronto = false
      compactar(sala) // alguém saiu no meio: as vagas voltam a ser 0..n-1
    } else {
      for (const conv of [...convites.values()]) if (conv.salaId === sala.id) encerrarConvite(conv, 'cancelado', 'a partida começou')
    }
    for (const id of sala.membros) atualizarStatus(clientes.get(id))
    avisarSala(sala)
    if (!sala.emPartida && antes) removerBloqueados(sala) // bloqueou no meio da partida: vale agora
  }

  // cria a sala de `c` (saindo da atual); null se o servidor está lotado
  function criarSalaDe(c, nome) {
    removerDaFila(c, 'sala')
    sair(c)
    if (salas.size >= maxSalas) {
      enviar(c, { t: 'erro', msg: 'o servidor está lotado: tente de novo daqui a pouco' })
      return null
    }
    const sala = { id: novoId(), codigo: novoCodigo(), nome: limpar(nome, 24) || `SALA DE ${c.nome}`, dono: c.id, host: c.id, eleito: null, eleicao: null, membros: new Set([c.id]), modo: 'pvp', emPartida: false }
    salas.set(sala.id, sala)
    codigos.set(sala.codigo, sala.id)
    c.sala = sala.id
    c.vaga = 0
    c.quedas = 0
    c.pronto = true
    avisarSala(sala)
    return sala
  }

  // "conta": o resultado da validação de `token` (conta = { id, perfil } | null)
  function aplicarConta(c, conta, token) {
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

  function processarConta(c) {
    const pedido = c.contaPendente
    if (!pedido) return
    c.vezConta = c.vezConta ?? 0
    // sair da conta: na hora (sem Supabase), e a validação em andamento não vale mais
    if (!pedido.token || !autenticar) {
      c.contaPendente = null
      c.vezConta++
      return aplicarConta(c, null, pedido.token)
    }
    if (c.validando) return // volta aqui quando a validação acabar
    // cada pedido vai ao Supabase: um por segundo basta (o mais novo espera)
    const espera = (c.ultimaConta ?? -Infinity) + 1000 - agora()
    if (espera > 0) {
      c.cancelarConta ??= agendar(() => {
        c.cancelarConta = null
        if (clientes.has(c.id)) processarConta(c)
      }, espera)
      return
    }
    c.contaPendente = null
    c.ultimaConta = agora()
    c.validando = true
    const vez = ++c.vezConta
    Promise.resolve()
      .then(() => autenticar(pedido.token))
      .catch(() => null)
      .then((conta) => {
        c.validando = false
        if (!clientes.has(c.id)) return
        // chegou um pedido mais novo (ou saiu da conta) no meio: este não vale
        if (vez === c.vezConta && !c.contaPendente) aplicarConta(c, conta, pedido.token)
        processarConta(c)
      })
  }

  function entrarNaSala(c, sala) {
    removerDaFila(c, 'sala')
    sair(c)
    c.vaga = vagaLivre(sala)
    c.quedas = 0
    sala.membros.add(c.id)
    c.sala = sala.id
    c.pronto = false
    avisarSala(sala)
  }

  const acoes = {
    ola(c, m) {
      if (c.ok || c.validando) return
      if (m.protocolo !== PROTOCOLO) return enviar(c, { t: 'erro', msg: `o jogo foi atualizado (versão ${m.protocolo} aqui, ${PROTOCOLO} no servidor): recarregue a página com Ctrl+F5 e, na LAN, atualize os dois PCs` })
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
      const nome = nomeConvidado(m.nome)
      if (!nome && limpar(m.nome, MAX_NOME)) return enviar(c, { t: 'erro', msg: 'esse nome não é permitido: escolha outro' })
      c.nome = nome || c.nome
      const sala = salas.get(c.sala)
      if (sala) avisarSala(sala)
    },
    // entrou, saiu ou mudou o perfil sem reconectar: { token } (null = saiu da conta)
    // (o último pedido sempre vale: sair da conta é na hora; um token que chega
    // dentro do mesmo segundo ou durante uma validação fica para depois)
    conta(c, m) {
      c.contaPendente = { token: typeof m.token === 'string' && m.token.length <= 4096 ? m.token : null }
      processarConta(c)
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
      if (cheia(sala)) return enviar(c, { t: 'erro', msg: 'a sala está cheia: peça outro código ao seu amigo' })
      if (sala.emPartida) return enviar(c, { t: 'erro', msg: 'a sala está no meio de uma partida: espere acabar e tente de novo' })
      if ([...sala.membros].some((id) => bloqueados(c, clientes.get(id)))) return enviar(c, { t: 'erro', msg: 'não deu para entrar nessa sala' })
      entrarNaSala(c, sala)
    },
    sair(c) {
      sair(c, 'o host fechou a sala')
    },
    pronto(c, m) {
      const sala = salas.get(c.sala)
      if (!sala || sala.dono === c.id) return
      c.pronto = Boolean(m.valor)
      avisarSala(sala)
    },
    modo(c, m) {
      const sala = salas.get(c.sala)
      if (!sala || sala.dono !== c.id || !MODOS.includes(m.modo) || sala.casual || sala.emPartida || sala.eleicao) return // a casual é PVP
      // a sala tem mais gente do que o modo comporta: tire alguém antes (5A)
      if (sala.membros.size > maxDoModo(m.modo)) return enviar(c, { t: 'erro', msg: `esse modo é para até ${maxDoModo(m.modo)} jogadores: a sala tem ${sala.membros.size}` })
      sala.modo = m.modo
      for (const id of sala.membros) if (id !== sala.dono) clientes.get(id).pronto = false // mudou o combinado: confirma de novo
      avisarSala(sala)
    },
    // { valor, eleicao? }: o COMEÇAR do dono pede a eleição do host (sala de amigos);
    // sem `eleicao` é o host da partida marcando/desmarcando na hora (casual, revanche)
    partida(c, m) {
      const sala = salas.get(c.sala)
      if (!sala) return
      if (m.valor && m.eleicao === true) {
        if (sala.dono !== c.id || sala.casual || sala.emPartida || sala.eleicao) return
        return comecarEleicao(sala)
      }
      if (sala.host !== c.id || sala.eleicao) return
      marcarPartida(sala, m.valor)
    },
    // as medidas para a eleição: { id, diretos: { idDoMembro: rtt em ms } }
    medicao(c, m) {
      const sala = salas.get(c.sala)
      const e = sala?.eleicao
      if (!e || m.id !== e.id || e.medidas.has(c.id)) return
      e.medidas.set(c.id, lerDiretos(m.diretos, [...sala.membros].filter((id) => id !== c.id)))
      conferirEleicao(sala)
    },
    expulsar(c, m) {
      const sala = salas.get(c.sala)
      const alvo = clientes.get(m.id)
      // no meio da partida não: tirar o oponente não pode virar "vitória por abandono"
      if (!sala || sala.dono !== c.id || !alvo || alvo.sala !== sala.id || alvo === c || sala.casual || sala.emPartida) return
      sair(alvo, undefined, { tirado: true }) // o relato dele da partida que acabou ainda vale
      enviar(alvo, { t: 'fechada', motivo: 'o host tirou você da sala' })
    },
    chat(c, m) {
      const sala = salas.get(c.sala)
      const texto = censurarTexto(limpar(m.texto, MAX_CHAT))
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
      if (sala && sala.dono !== c.id) return negar('só o dono da sala pode convidar')
      if (sala?.emPartida) return negar('a sala está no meio de uma partida')
      if (sala?.membros.has(alvo.id)) return negar(`${alvo.nome} já está na sua sala`)
      if (sala && cheia(sala)) return negar('a sala está cheia')
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
      const vale = sala && remetente && remetente.usuario === conv.deUsuario && remetente.sala === sala.id && sala.dono === remetente.id && ehAmigoMutuo(remetente, c) && !sala.emPartida && statusDe(c) !== 'em_partida' && !cheia(sala)
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
      if (fila.entrar(c)) metricas.contar('fila_entradas')
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
      if (!cheia(sala)) return enviar(c, { t: 'revanche', estado: 'indisponivel', motivo: 'o oponente já saiu: escolha fila ou menu' })
      // bloqueou o oponente depois da partida: sem revanche, a sala casual fecha
      const ms = membrosDaSala(sala)
      if (ms.length === 2 && bloqueados(ms[0], ms[1])) {
        const saindo = ms.find((x) => x.id !== sala.host) ?? ms[1]
        sair(saindo, MSG_BLOQUEIO, { tirado: true })
        return enviar(saindo, { t: 'fechada', motivo: MSG_BLOQUEIO, casual: true })
      }
      verificarRevanche(sala)
      if (m.aceitar !== true) {
        encerrarRevanche(sala)
        return avisarMembros(sala, { t: 'revanche', estado: 'recusada', de: c.id })
      }
      if (!sala.revanche) {
        metricas.contar('revanches_pedidas')
        const expira = agora() + REVANCHE_MS
        sala.revanche = { votos: new Set(), expira, cancelar: agendar(() => verificarRevanche(sala), REVANCHE_MS + 50) }
      }
      const r = sala.revanche
      r.votos.add(c.id)
      if ([...sala.membros].every((id) => r.votos.has(id))) {
        encerrarRevanche(sala)
        metricas.contar('revanches_aceitas')
        sala.revanches = (sala.revanches ?? 0) + 1
        // a revanche é outra partida: registro novo (o partidaId chega antes do "aceita")
        if (sala.emPartida) {
          partidas.iniciar(sala, membrosDaPartida(sala))
          avisarSala(sala)
        }
        return avisarMembros(sala, { t: 'revanche', estado: 'aceita', host: sala.host })
      }
      avisarMembros(sala, { t: 'revanche', estado: 'pedida', de: c.id, expiraEm: r.expira, restanteMs: Math.max(0, r.expira - agora()) })
    },
    // fim da partida: o que este cliente viu (uma vez por partida; server/partidas.js decide)
    resultado(c, m) {
      partidas.relatar(c, m)
    },
    // a aba do jogo foi para segundo plano / voltou (Fase 2F): depois de SEGUNDO_PLANO_MS
    // escondida, a sala vê `segundoPlano: true` no membro (o convidado mostra "o host está
    // com o jogo em segundo plano"). Voltar limpa na hora.
    visivel(c, m) {
      if (m.valor !== false) {
        c.cancelarSegundoPlano?.()
        c.cancelarSegundoPlano = null
        if (c.segundoPlano) {
          c.segundoPlano = false
          const sala = salas.get(c.sala)
          if (sala) avisarSala(sala)
        }
        return
      }
      if (c.segundoPlano || c.cancelarSegundoPlano) return
      c.cancelarSegundoPlano = agendar(() => {
        c.cancelarSegundoPlano = null
        if (!clientes.has(c.id)) return
        c.segundoPlano = true
        const sala = salas.get(c.sala)
        if (sala) avisarSala(sala)
      }, SEGUNDO_PLANO_MS)
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
    // repassa na sala (sinais do WebRTC e o canal da partida), em ESTRELA pelo host (5A):
    // do convidado, só para o host; do host, para todos ou só para `a`
    para(c, m) {
      const sala = salas.get(c.sala)
      if (!sala || !m.dados || typeof m.dados !== 'object') return
      const alvos = c.id !== sala.host ? [sala.host] : typeof m.a === 'string' ? (sala.membros.has(m.a) ? [m.a] : []) : [...sala.membros]
      for (const id of alvos) {
        if (id === c.id) continue
        const outro = clientes.get(id)
        if (!outro) continue
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
      metricas.contar('conexoes')
      return cliente
    },
    // ws: de qual conexão veio (a velha de uma vaga retomada não manda mais nada)
    receber(c, texto, binario, ws = c.ws) {
      const cliente = atual(c)
      if (ws !== cliente.ws) return
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
    // registro das partidas (os testes conferem a política)
    partidas,
    // ws: a conexão que fechou (a velha de uma vaga já retomada não derruba a nova)
    desconectar(c, ws = c.ws) {
      const cliente = atual(c)
      if (ws !== cliente.ws || cliente.caido || !clientes.has(cliente.id)) return
      const sala = salas.get(cliente.sala)
      // no meio da partida: a vaga espera a volta (RETOMADA_MS)
      if (cliente.ok && sala?.emPartida) return segurar(cliente, sala)
      soltar(cliente)
    },
    // vagas guardadas (os testes conferem)
    retomadas: () => retomadas.size,
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
export function anexarLan(httpServer, { log = console.log, descoberta = true, online = false, ice = [], maxClientes = MAX_CLIENTES, autenticar = null, relacoes = null, registro = null, metricas = METRICAS_NULA } = {}) {
  let rede = null
  const porta = () => httpServer.address()?.port
  const lobby = criarLobby({ eleicaoMs: ELEICAO_MS, online, ice, autenticar, relacoes, registro, metricas, log, salasRede: () => rede?.salas() ?? [], enderecos: () => (porta() ? enderecosDoJogo(porta()) : []) })
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
    ws.on('message', (dados, binario) => lobby.receber(cliente, binario ? dados : dados.toString(), binario, ws))
    ws.on('close', () => lobby.desconectar(cliente, ws))
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
      lobby.partidas.fechar()
      rede?.fechar()
      httpServer.off('upgrade', aoUpgrade)
      for (const ws of wss.clients) ws.terminate()
      wss.close()
    },
  }
}

// Endereços para o outro PC abrir o jogo (http://ip:porta)
export const enderecosDoJogo = (porta) => enderecosLocais().map(({ ip }) => `http://${ip}:${porta}`)
