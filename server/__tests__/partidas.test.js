import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, PROTOCOLO } from '../lan.js'
import { criarPartidas, criarRegistro, decidir, lerRelato, RELATO_JANELA_MS, ABANDONO_GRACA_MS, GUARDAR_MS } from '../partidas.js'
import { criarSupabaseFalso } from '../supabase/fake.js'
import { XP_PARTICIPACAO, XP_VITORIA } from '../../src/lib/progresso.js'

// relógio e timers falsos: andar(ms) dispara o que venceu
function relogioFalso() {
  let t = Date.UTC(2026, 9, 25, 15, 0, 0) // meio-dia em São Paulo
  const timers = new Set()
  return {
    agora: () => t,
    agendar(fn, ms) {
      const x = { fn, quando: t + ms }
      timers.add(x)
      return () => timers.delete(x)
    },
    andar(ms) {
      t += ms
      for (const x of [...timers].sort((a, b) => a.quando - b.quando)) if (x.quando <= t && timers.delete(x)) x.fn()
    },
    ativos: () => timers.size,
  }
}

const esperar = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r))
}

const VITORIA = XP_PARTICIPACAO + XP_VITORIA

// contas: nomes com conta (o resto entra como convidado)
function montar({ contas = ['ana', 'beto'], semBanco = false } = {}) {
  const relogio = relogioFalso()
  const id = (nome) => `u-${nome}`
  const perfis = contas.map((n) => ({ id: id(n), tag: `${n}#1000`, nome_exibicao: n.toUpperCase(), avatar_tipo: 'padrao', nivel: 1, xp: 0 }))
  const sb = criarSupabaseFalso({ perfis, agora: relogio.agora })
  const autenticar = async (token) => {
    const nome = token.replace(/^token-/, '').replace(/-\d+$/, '')
    return contas.includes(nome) ? { id: id(nome), perfil: perfis.find((p) => p.id === id(nome)) } : null
  }
  const logs = []
  const lobby = criarLobby({ online: true, agora: relogio.agora, agendar: relogio.agendar, autenticar, registro: semBanco ? null : criarRegistro(sb), log: (l) => logs.push(l) })
  let n = 0
  const entrar = async (nome) => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)) }
    const c = lobby.conectar(ws, '10.0.0.2')
    const p = {
      c,
      nome,
      recebidas,
      mandar: (m) => lobby.receber(c, JSON.stringify(m)),
      tipo: (t) => recebidas.filter((m) => m.t === t),
      ultima: (t) => recebidas.filter((m) => m.t === t).at(-1),
      sair: () => {
        ws.readyState = 3
        lobby.desconectar(c)
      },
    }
    p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: nome.toUpperCase(), ...(contas.includes(nome) && { token: `token-${nome}-${++n}` }) })
    await esperar()
    return p
  }
  return { lobby, relogio, entrar, logs, sb, id }
}

// sala de amigos com host `a` e convidado `b`, partida PVP começada
async function partida(m, a = 'ana', b = 'beto') {
  const host = await m.entrar(a)
  const conv = await m.entrar(b)
  host.mandar({ t: 'criar' })
  conv.mandar({ t: 'entrar', codigo: host.ultima('sala').sala.codigo })
  host.mandar({ t: 'partida', valor: true })
  const partidaId = host.ultima('sala').sala.partidaId
  return { host, conv, partidaId }
}

const relatar = (p, partidaId, vencedorLado, extra = {}) => p.mandar({ t: 'resultado', partidaId, vencedorLado, rodadas: 4, duracao: 120, personagem: 'kris', ...extra })
const recompensa = (p) => p.ultima('recompensa')

test('protocolo 5 nos dois lados (o resultado/recompensa é novo)', async () => {
  const fs = await import('node:fs')
  const rede = fs.readFileSync(new URL('../../src/lib/lan/rede.js', import.meta.url), 'utf8')
  assert.equal(PROTOCOLO, 5)
  assert.match(rede, new RegExp(`export const PROTOCOLO = ${PROTOCOLO}\\b`))
})

test('a partida nasce quando o host começa e o id vai na sala', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  assert.match(partidaId, /^[0-9a-f-]{36}$/)
  assert.equal(conv.ultima('sala').sala.partidaId, partidaId)
  await esperar()
  const linha = m.sb.tabelas.partidas.find((p) => p.id === partidaId)
  assert.equal(linha.estado, 'iniciada')
  assert.equal(linha.sala_tipo, 'amigos')
  assert.equal(linha.versao, PROTOCOLO)
  assert.deepEqual(m.sb.tabelas.partida_participantes.map((x) => [x.lado, x.user_id]), [[0, 'u-ana'], [1, 'u-beto']])
  // "partida" repetido não cria outra
  host.mandar({ t: 'partida', valor: true })
  assert.equal(host.ultima('sala').sala.partidaId, partidaId)
  assert.equal(m.lobby.partidas.emAndamento(), 1)
})

test('os dois concordam: validada, vitória dá o bônus', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  relatar(host, partidaId, 0)
  relatar(conv, partidaId, 0, { personagem: 'susie' })
  await esperar()
  assert.deepEqual(recompensa(host), { t: 'recompensa', partidaId, xpGanho: VITORIA, xpTotal: VITORIA, nivelAntes: 1, nivelDepois: 1, itensNovos: [], motivo: 'vitoria' })
  assert.equal(recompensa(conv).xpGanho, XP_PARTICIPACAO)
  assert.equal(recompensa(conv).motivo, 'derrota')
  const linha = m.sb.tabelas.partidas.find((p) => p.id === partidaId)
  assert.equal(linha.estado, 'recompensada')
  assert.equal(linha.validacao, 'validada')
  assert.equal(linha.vencedor_lado, 0)
  assert.equal(linha.duracao_s, 120, 'a duração é a do relógio do servidor')
  const est = m.sb.tabelas.estatisticas_basicas
  assert.deepEqual(est.find((e) => e.usuario_id === 'u-ana'), { usuario_id: 'u-ana', partidas: 1, vitorias: 1, personagem_favorito: 'kris' })
  assert.equal(est.find((e) => e.usuario_id === 'u-beto').personagem_favorito, 'susie')
  assert.equal(m.lobby.partidas.timers(), 1, 'só o "esquecer" da decisão')
})

test('empate: os dois ganham só a participação', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(90_000)
  relatar(host, partidaId, null)
  relatar(conv, partidaId, null)
  await esperar()
  assert.equal(recompensa(host).xpGanho, XP_PARTICIPACAO)
  assert.equal(recompensa(conv).motivo, 'empate')
})

test('discordam: contestada, só participação para os dois e fica no log', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  relatar(host, partidaId, 0)
  relatar(conv, partidaId, 1)
  await esperar()
  for (const p of [host, conv]) {
    assert.equal(recompensa(p).xpGanho, XP_PARTICIPACAO)
    assert.equal(recompensa(p).motivo, 'contestada')
  }
  assert.equal(m.sb.tabelas.partidas[0].validacao, 'contestada')
  assert.ok(m.logs.some((l) => l.includes('contestada')))
  assert.equal(m.sb.tabelas.estatisticas_basicas.find((e) => e.usuario_id === 'u-ana').vitorias, 0)
})

test('só um relata e o outro continua lá: ninguém leva a vitória sozinho', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  relatar(host, partidaId, 0)
  m.relogio.andar(RELATO_JANELA_MS - 1)
  await esperar()
  assert.equal(recompensa(host), undefined, 'ainda dentro do prazo')
  m.relogio.andar(2)
  await esperar()
  assert.equal(recompensa(host).xpGanho, XP_PARTICIPACAO)
  assert.equal(recompensa(host).motivo, 'participacao')
  assert.equal(recompensa(conv).xpGanho, 0)
  assert.equal(recompensa(conv).motivo, 'sem_relato')
  // relato atrasado: recebe a resposta que já existe, nada muda
  relatar(conv, partidaId, 1)
  await esperar()
  assert.equal(conv.tipo('recompensa').length, 2)
  assert.equal(recompensa(conv).motivo, 'sem_relato')
  assert.equal(m.sb.tabelas.perfis.find((p) => p.id === 'u-beto').xp, 0)
})

test('abandono no meio: quem ficou leva a vitória; quem saiu, nada', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(80_000)
  conv.mandar({ t: 'sair' }) // saiu da sala (ainda conectado)
  assert.equal(recompensa(host), undefined, 'espera o relato que podia estar a caminho')
  m.relogio.andar(ABANDONO_GRACA_MS)
  await esperar()
  assert.equal(recompensa(host).xpGanho, VITORIA)
  assert.equal(recompensa(host).motivo, 'vitoria')
  assert.equal(recompensa(conv).xpGanho, 0)
  assert.equal(recompensa(conv).motivo, 'abandono')
  const linha = m.sb.tabelas.partidas[0]
  assert.equal(linha.motivo_termino, 'abandono')
  assert.equal(linha.duracao_s, 80)
  assert.equal(linha.vencedor_lado, 0)
})

test('abandono: o host desconecta, a sala fecha e o convidado leva', async () => {
  const m = montar()
  const { host, conv } = await partida(m)
  m.relogio.andar(80_000)
  host.sair()
  assert.equal(conv.ultima('fechada').motivo, 'o host perdeu a conexão: a sala foi fechada')
  // quem ficou foi tirado da sala: desconectar agora não conta como abandono dele
  m.relogio.andar(1000)
  m.relogio.andar(ABANDONO_GRACA_MS)
  await esperar()
  assert.equal(recompensa(conv).xpGanho, VITORIA)
})

test('saiu depois de o outro relatar (a partida já tinha acabado): só participação', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  relatar(host, partidaId, 0)
  m.relogio.andar(500)
  conv.mandar({ t: 'sair' })
  await esperar()
  assert.equal(recompensa(host).motivo, 'participacao')
  assert.equal(recompensa(conv).motivo, 'sem_relato')
})

test('o outro saiu antes do relato de quem ficou: vale o que quem ficou viu', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  conv.mandar({ t: 'sair' })
  m.relogio.andar(800)
  relatar(host, partidaId, 0)
  await esperar()
  assert.equal(recompensa(host).xpGanho, VITORIA)
  assert.equal(recompensa(conv).motivo, 'abandono')
})

test('relato repetido não muda nada nem concede de novo', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  relatar(host, partidaId, 0)
  relatar(host, partidaId, 1) // mudou de ideia: não vale
  relatar(conv, partidaId, 0)
  await esperar()
  relatar(host, partidaId, 0)
  relatar(conv, partidaId, 0)
  await esperar()
  assert.equal(m.sb.concederChamadas, 1)
  assert.equal(m.sb.tabelas.concessoes.length, 2)
  assert.equal(recompensa(host).xpGanho, VITORIA)
  assert.equal(host.tipo('recompensa').length, 2, 'a segunda é a mesma resposta, reenviada')
  assert.deepEqual(host.tipo('recompensa')[0], host.tipo('recompensa')[1])
  assert.equal(m.sb.tabelas.perfis.find((p) => p.id === 'u-ana').xp, VITORIA)
})

test('convidado nunca ganha XP (e fica sabendo na hora)', async () => {
  const m = montar({ contas: ['ana'] })
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  relatar(conv, partidaId, 0)
  assert.deepEqual(recompensa(conv), { t: 'recompensa', partidaId, xpGanho: 0, motivo: 'convidado' })
  relatar(host, partidaId, 0)
  await esperar()
  assert.equal(recompensa(host).xpGanho, VITORIA)
  assert.equal(conv.tipo('recompensa').length, 1)
  assert.deepEqual(m.sb.tabelas.concessoes.map((c) => c.user_id), ['u-ana'])
  assert.equal(m.sb.tabelas.partida_participantes.find((x) => x.lado === 1).user_id, null)
})

test('dois convidados: nada vai para o banco', async () => {
  const m = montar({ contas: [] })
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  relatar(host, partidaId, 0)
  relatar(conv, partidaId, 0)
  await esperar()
  assert.equal(recompensa(host).motivo, 'convidado')
  assert.equal(m.sb.tabelas.partidas.length, 0)
})

test('servidor sem banco: avisa que o progresso está indisponível', async () => {
  const m = montar({ semBanco: true })
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  relatar(host, partidaId, 0)
  relatar(conv, partidaId, 0)
  await esperar()
  assert.equal(recompensa(host).motivo, 'indisponivel')
})

test('CPU (ou partida que o servidor não conhece): não registra nada', async () => {
  const m = montar()
  const ana = await m.entrar('ana')
  ana.mandar({ t: 'resultado', partidaId: 'cpu-local', vencedorLado: 0, rodadas: 3 })
  assert.equal(recompensa(ana).motivo, 'nao_registrada')
  assert.equal(m.sb.tabelas.partidas.length, 0)
  // CO-OP não tem registro (fica para depois)
  const beto = await m.entrar('beto')
  ana.mandar({ t: 'criar' })
  beto.mandar({ t: 'entrar', codigo: ana.ultima('sala').sala.codigo })
  ana.mandar({ t: 'modo', modo: 'coop' })
  ana.mandar({ t: 'partida', valor: true })
  assert.equal(ana.ultima('sala').sala.partidaId, null)
})

test('partida curta demais: 0 XP para os dois', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(30_000)
  relatar(host, partidaId, 0, { duracao: 999 }) // a duração do cliente não vale
  relatar(conv, partidaId, 0)
  await esperar()
  for (const p of [host, conv]) {
    assert.equal(recompensa(p).xpGanho, 0)
    assert.equal(recompensa(p).motivo, 'curta')
  }
})

test('poucas rodadas também é curta', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  relatar(host, partidaId, 0, { rodadas: 1 })
  relatar(conv, partidaId, 0, { rodadas: 1 })
  await esperar()
  assert.equal(recompensa(host).motivo, 'curta')
})

test('farm com o mesmo amigo: XP cheio, depois metade, depois nada no dia', async () => {
  const m = montar()
  const host = await m.entrar('ana')
  const conv = await m.entrar('beto')
  host.mandar({ t: 'criar' })
  conv.mandar({ t: 'entrar', codigo: host.ultima('sala').sala.codigo })
  const ganhos = []
  for (let i = 0; i < 6; i++) {
    host.mandar({ t: 'partida', valor: true })
    const id = host.ultima('sala').sala.partidaId
    m.relogio.andar(120_000)
    relatar(host, id, 0)
    relatar(conv, id, 0)
    await esperar()
    host.mandar({ t: 'partida', valor: false })
    ganhos.push([recompensa(host).xpGanho, recompensa(host).motivo])
  }
  assert.deepEqual(ganhos, [
    [60, 'vitoria'],
    [60, 'vitoria'],
    [60, 'vitoria'],
    [30, 'repeticao_metade'],
    [30, 'repeticao_metade'],
    [0, 'repeticao'],
  ])
  // no dia seguinte volta
  m.relogio.andar(24 * 3600_000)
  host.mandar({ t: 'partida', valor: true })
  const id = host.ultima('sala').sala.partidaId
  m.relogio.andar(120_000)
  relatar(host, id, 0)
  relatar(conv, id, 0)
  await esperar()
  assert.equal(recompensa(host).xpGanho, 60)
})

test('subir de nível libera os itens da trilha', async () => {
  const m = montar()
  m.sb.tabelas.perfis.find((p) => p.id === 'u-ana').xp = 90
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  relatar(host, partidaId, 0)
  relatar(conv, partidaId, 0)
  await esperar()
  assert.deepEqual(recompensa(host), { t: 'recompensa', partidaId, xpGanho: 60, xpTotal: 150, nivelAntes: 1, nivelDepois: 2, itensNovos: ['titulo.esquivador'], motivo: 'vitoria' })
  assert.deepEqual(m.sb.tabelas.inventario.map((i) => [i.user_id, i.item_id]), [['u-ana', 'titulo.esquivador']])
})

test('a mesma conta dos dois lados (duas abas) não ganha nada', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m, 'ana', 'ana')
  m.relogio.andar(120_000)
  relatar(host, partidaId, 0)
  relatar(conv, partidaId, 0)
  await esperar()
  assert.equal(recompensa(host).motivo, 'mesma_conta')
  assert.equal(recompensa(conv).motivo, 'mesma_conta')
  assert.equal(m.sb.tabelas.concessoes.length, 0)
})

test('quem não é da partida não relata (o id da conta nunca vem do cliente)', async () => {
  const m = montar({ contas: ['ana', 'beto', 'caio'] })
  const { host, conv, partidaId } = await partida(m)
  const caio = await m.entrar('caio')
  m.relogio.andar(120_000)
  caio.mandar({ t: 'resultado', partidaId, vencedorLado: 1, usuario: 'u-beto', userId: 'u-beto' })
  relatar(host, partidaId, 0)
  relatar(conv, partidaId, 0)
  await esperar()
  assert.equal(recompensa(caio), undefined)
  assert.equal(recompensa(host).motivo, 'vitoria')
})

test('reconectou com a mesma conta: o relato vale e a recompensa chega no cliente novo', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  relatar(host, partidaId, 0)
  // o host cai depois de relatar e volta logo (outra conexão, mesma conta)
  host.sair()
  const volta = await m.entrar('ana')
  relatar(conv, partidaId, 0)
  await esperar()
  assert.equal(recompensa(volta).xpGanho, VITORIA)
  assert.equal(recompensa(conv).motivo, 'derrota')
})

test('revanche na sala casual é outra partida (outro id)', async () => {
  const m = montar()
  const ana = await m.entrar('ana')
  const beto = await m.entrar('beto')
  ana.mandar({ t: 'fila', acao: 'entrar' })
  beto.mandar({ t: 'fila', acao: 'entrar' })
  ana.mandar({ t: 'confirmar', id: ana.ultima('pareado').id, aceitar: true })
  beto.mandar({ t: 'confirmar', id: beto.ultima('pareado').id, aceitar: true })
  const host = ana.ultima('partidaCasual').host === ana.c.id ? ana : beto
  const conv = host === ana ? beto : ana
  host.mandar({ t: 'partida', valor: true })
  const primeira = host.ultima('sala').sala.partidaId
  m.relogio.andar(120_000)
  relatar(host, primeira, 1)
  relatar(conv, primeira, 1)
  await esperar()
  assert.equal(m.sb.tabelas.partidas[0].sala_tipo, 'casual')
  host.mandar({ t: 'revanche', aceitar: true })
  conv.mandar({ t: 'revanche', aceitar: true })
  const segunda = conv.ultima('sala').sala.partidaId
  assert.ok(segunda && segunda !== primeira)
  // o partidaId novo chega antes do "aceita"
  const i = conv.recebidas.findIndex((x) => x.t === 'sala' && x.sala.partidaId === segunda)
  const j = conv.recebidas.findIndex((x) => x.t === 'revanche' && x.estado === 'aceita')
  assert.ok(i >= 0 && i < j)
})

test('expulsar no meio da partida não vale (não vira vitória por abandono)', async () => {
  const m = montar()
  const { host, conv } = await partida(m)
  m.relogio.andar(80_000)
  host.mandar({ t: 'expulsar', id: conv.c.id })
  assert.equal(conv.c.sala, host.c.sala)
})

test('relatos simultâneos não concedem duas vezes; conceder de novo devolve o mesmo', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  relatar(host, partidaId, 0)
  relatar(conv, partidaId, 0)
  await esperar()
  const reg = criarRegistro(m.sb)
  const [a, b] = await Promise.all([reg.conceder(partidaId), reg.conceder(partidaId)])
  assert.deepEqual(a, b)
  assert.equal(m.sb.tabelas.concessoes.length, 2)
  assert.equal(m.sb.tabelas.perfis.find((p) => p.id === 'u-ana').xp, VITORIA)
  assert.equal(m.sb.tabelas.estatisticas_basicas.find((e) => e.usuario_id === 'u-ana').partidas, 1)
})

test('banco falhando: avisa erro, não trava e não concede', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.sb.falhar.conceder_recompensa = true
  m.relogio.andar(120_000)
  relatar(host, partidaId, 0)
  relatar(conv, partidaId, 0)
  await esperar()
  assert.equal(recompensa(host).motivo, 'erro')
  assert.ok(m.logs.some((l) => l.includes('não deu para conceder')))
  assert.equal(m.sb.tabelas.concessoes.length, 0)
})

test('ninguém relata: encerrada sem XP; timers somem e a decisão é esquecida', async () => {
  const m = montar()
  const { host, conv, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  host.mandar({ t: 'partida', valor: false })
  m.relogio.andar(RELATO_JANELA_MS)
  await esperar()
  assert.equal(recompensa(host).motivo, 'sem_relato')
  assert.equal(m.sb.tabelas.partidas[0].estado, 'encerrada')
  assert.equal(m.lobby.partidas.timers(), 1)
  m.relogio.andar(GUARDAR_MS)
  assert.equal(m.lobby.partidas.partida(partidaId), null)
  assert.equal(m.lobby.partidas.timers(), 0)
  assert.equal(m.relogio.ativos(), 0)
  void conv
})

test('fechar() cancela os timers das partidas', async () => {
  const m = montar()
  const { host, partidaId } = await partida(m)
  m.relogio.andar(120_000)
  relatar(host, partidaId, 0)
  assert.equal(m.lobby.partidas.timers(), 1)
  m.lobby.partidas.fechar()
  assert.equal(m.lobby.partidas.timers(), 0)
  assert.equal(m.relogio.ativos(), 0)
})

// ---------- a política sozinha ----------

const base = (extra = [{}, {}]) => ({ criadaEm: 0, participantes: extra.map((x, lado) => ({ lado, relato: null, relatadoEm: null, saiuEm: null, ...x })) })
const rel = (v, em) => ({ relato: { vencedorLado: v, rodadas: 3 }, relatadoEm: em })

test('decidir: a matriz da política', () => {
  const casos = [
    ['concordam', [rel(1, 100_000), rel(1, 101_000)], { validacao: 'validada', vencedorLado: 1, motivo: 'normal', resultados: { 0: 'derrota', 1: 'vitoria' }, duracaoS: 100 }],
    ['discordam', [rel(0, 100_000), rel(1, 100_000)], { validacao: 'contestada', vencedorLado: null, motivo: 'divergente', resultados: { 0: 'contestada', 1: 'contestada' } }],
    ['um só, outro ficou', [rel(0, 100_000), {}], { validacao: 'contestada', motivo: 'relato_unico', resultados: { 0: 'participacao', 1: 'sem_relato' } }],
    ['um só, outro saiu antes', [rel(0, 100_000), { saiuEm: 90_000 }], { validacao: 'validada', vencedorLado: 0, motivo: 'abandono', resultados: { 0: 'vitoria', 1: 'abandono' }, duracaoS: 90 }],
    ['um só, outro saiu depois', [rel(0, 100_000), { saiuEm: 110_000 }], { validacao: 'contestada', resultados: { 0: 'participacao', 1: 'sem_relato' } }],
    ['quem ficou diz que perdeu', [{ saiuEm: 90_000 }, rel(0, 100_000)], { validacao: 'validada', vencedorLado: 0, resultados: { 0: 'abandono', 1: 'derrota' } }],
    ['ninguém, um saiu', [{}, { saiuEm: 70_000 }], { validacao: 'validada', vencedorLado: 0, motivo: 'abandono', resultados: { 0: 'vitoria', 1: 'abandono' }, duracaoS: 70 }],
    ['ninguém, os dois saíram', [{ saiuEm: 1 }, { saiuEm: 2 }], { validacao: 'encerrada', resultados: { 0: 'sem_relato', 1: 'sem_relato' } }],
    ['ninguém, ninguém saiu', [{}, {}], { validacao: 'encerrada' }],
  ]
  for (const [nome, lados, esperado] of casos) {
    const d = decidir(base(lados), 500_000)
    for (const [k, v] of Object.entries(esperado)) assert.deepEqual(d[k], v, `${nome}: ${k}`)
  }
})

test('lerRelato: só aceita o formato certo', () => {
  assert.equal(lerRelato({ partidaId: 'x', vencedorLado: 2 }), null)
  assert.equal(lerRelato({ partidaId: 'x', vencedorLado: '0' }), null)
  assert.equal(lerRelato({ vencedorLado: 0 }), null)
  assert.deepEqual(lerRelato({ partidaId: 'x', vencedorLado: 0, rodadas: 3.5, duracao: '80', personagem: '<script>' }), { vencedorLado: 0, rodadas: null, duracao: 80, personagem: null })
  assert.deepEqual(lerRelato({ partidaId: 'x', vencedorLado: null, rodadas: 4, personagem: 'kris' }).personagem, 'kris')
})

test('criarPartidas sem lobby: sala de CO-OP ou incompleta não registra', () => {
  const partidas = criarPartidas()
  assert.equal(partidas.iniciar({ id: 's', modo: 'pvp' }, [{ id: 'a' }]), null)
  assert.equal(partidas.iniciar({ id: 's', modo: 'coop' }, [{ id: 'a' }, { id: 'b' }]), null)
  partidas.fechar()
})
