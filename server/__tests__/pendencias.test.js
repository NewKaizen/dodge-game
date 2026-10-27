// Fase 2F: as pendências de servidor da Fase 1 (docs/online.md):
//   * XP no CO-OP de 2 jogadores (a mesma validação do PVP, resultado do time)
//   * bloquear alguém da sala tira o bloqueado (ou o próprio, se for o host)
//   * convidados como oponente no limite diário (por conexão; mesmo endereço = um só)
//   * o verso equipado vai no membro da sala; a aba do host em segundo plano
//   * o filtro de nomes no nome vindo do Google (espelho em JS)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, PROTOCOLO, SEGUNDO_PLANO_MS, RETOMADA_MS } from '../lan.js'
import { criarRegistro, lerRelato, decidir, refConvidado, REF_CONVIDADO_JUNTO, RELATO_JANELA_MS, ABANDONO_GRACA_MS } from '../partidas.js'
import { criarRelacoes } from '../amigos.js'
import { criarSupabaseFalso } from '../supabase/fake.js'
import { XP_PARTICIPACAO, XP_VITORIA, CONVIDADOS_LIMITE_DIA } from '../../src/lib/progresso.js'
import { nomeInicialDoGoogle, nomeSeguro, NOME_NEUTRO } from '../../src/lib/contaRegras.js'

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
  }
}
const esperar = async () => {
  for (let i = 0; i < 25; i++) await new Promise((r) => setImmediate(r))
}

const VITORIA = XP_PARTICIPACAO + XP_VITORIA
const NOMES = ['ana', 'beto', 'caio']

function montar({ contas = NOMES, bloqueios = [], versos = {} } = {}) {
  const relogio = relogioFalso()
  const id = (n) => `u-${n}`
  const perfis = contas.map((n) => ({ id: id(n), tag: `${n}#1000`, nome_exibicao: n.toUpperCase(), avatar_tipo: 'padrao', nivel: 1, xp: 0, verso_equipado: versos[n] ?? null }))
  const sb = criarSupabaseFalso({ perfis, agora: relogio.agora })
  sb.tabelas.bloqueios = bloqueios.map(([x, y]) => ({ quem: id(x), bloqueado: id(y) }))
  const autenticar = async (token) => {
    const nome = token.replace(/^token-/, '').replace(/-\d+$/, '')
    return contas.includes(nome) ? { id: id(nome), perfil: perfis.find((p) => p.id === id(nome)) } : null
  }
  const logs = []
  const lobby = criarLobby({ online: true, agora: relogio.agora, agendar: relogio.agendar, autenticar, relacoes: criarRelacoes(sb), registro: criarRegistro(sb), log: (l) => logs.push(l) })
  let n = 0
  const entrar = async (nome, ip = '10.0.0.2') => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)) }
    const c = lobby.conectar(ws, ip)
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
  return { lobby, relogio, entrar, logs, sb, id, perfis }
}

// sala de amigos de `modo` com a partida começada
async function sala(m, modo, a = 'ana', b = 'beto', ips = {}) {
  const host = await m.entrar(a, ips[a])
  const conv = await m.entrar(b, ips[b])
  host.mandar({ t: 'criar' })
  conv.mandar({ t: 'entrar', codigo: host.ultima('sala').sala.codigo })
  host.mandar({ t: 'modo', modo })
  host.mandar({ t: 'partida', valor: true })
  return { host, conv, partidaId: host.ultima('sala').sala.partidaId }
}
const coop = (m, a, b, ips) => sala(m, 'coop', a, b, ips)

const vitoria = (p, partidaId, venceu, extra = {}) => p.mandar({ t: 'resultado', partidaId, vitoria: venceu, rodadas: 8, duracao: 300, personagem: 'kris', ...extra })
const recompensa = (p) => p.ultima('recompensa')

// ---------- CO-OP: validação ----------

test('CO-OP: a partida é registrada com modo coop, nos dois lados', async () => {
  const m = montar()
  const { partidaId } = await coop(m)
  await esperar()
  const linha = m.sb.tabelas.partidas.find((p) => p.id === partidaId)
  assert.equal(linha.modo, 'coop')
  assert.equal(linha.estado, 'iniciada')
  assert.deepEqual(m.sb.tabelas.partida_participantes.map((x) => x.user_id), ['u-ana', 'u-beto'])
})

test('CO-OP: os dois dizem vitória do time: participação + bônus para os dois', async () => {
  const m = montar()
  const { host, conv, partidaId } = await coop(m)
  m.relogio.andar(300_000)
  vitoria(host, partidaId, true)
  vitoria(conv, partidaId, true, { personagem: 'susie' })
  await esperar()
  for (const p of [host, conv]) {
    assert.equal(recompensa(p).xpGanho, VITORIA)
    assert.equal(recompensa(p).motivo, 'vitoria')
  }
  const linha = m.sb.tabelas.partidas[0]
  assert.equal(linha.estado, 'recompensada')
  assert.equal(linha.validacao, 'validada')
  assert.equal(linha.vencedor_lado, null, 'no CO-OP não tem lado vencedor')
  assert.equal(linha.duracao_s, 300, 'a duração é a do relógio do servidor')
  assert.deepEqual(m.sb.tabelas.estatisticas_basicas.find((e) => e.usuario_id === 'u-beto'), { usuario_id: 'u-beto', partidas: 1, vitorias: 1, personagem_favorito: 'susie' })
})

test('CO-OP: derrota do time confirmada: só a participação', async () => {
  const m = montar()
  const { host, conv, partidaId } = await coop(m)
  m.relogio.andar(200_000)
  vitoria(host, partidaId, false)
  vitoria(conv, partidaId, false)
  await esperar()
  for (const p of [host, conv]) {
    assert.equal(recompensa(p).xpGanho, XP_PARTICIPACAO)
    assert.equal(recompensa(p).motivo, 'derrota')
  }
  assert.equal(m.sb.tabelas.estatisticas_basicas[0].vitorias, 0)
})

test('CO-OP: discordam (um diz vitória, o outro derrota): contestada, só participação', async () => {
  const m = montar()
  const { host, conv, partidaId } = await coop(m)
  m.relogio.andar(200_000)
  vitoria(host, partidaId, true)
  vitoria(conv, partidaId, false)
  await esperar()
  for (const p of [host, conv]) {
    assert.equal(recompensa(p).xpGanho, XP_PARTICIPACAO)
    assert.equal(recompensa(p).motivo, 'contestada')
  }
  assert.equal(m.sb.tabelas.partidas[0].validacao, 'contestada')
  assert.ok(m.logs.some((l) => l.includes('contestada')))
})

test('CO-OP: só um relata e o parceiro continua lá: participação para quem relatou, nada para o outro', async () => {
  const m = montar()
  const { host, conv, partidaId } = await coop(m)
  m.relogio.andar(200_000)
  vitoria(host, partidaId, true)
  m.relogio.andar(RELATO_JANELA_MS + 1)
  await esperar()
  assert.equal(recompensa(host).xpGanho, XP_PARTICIPACAO, 'o time não vence só com a palavra de um')
  assert.equal(recompensa(host).motivo, 'participacao')
  assert.equal(recompensa(conv).xpGanho, 0)
  assert.equal(recompensa(conv).motivo, 'sem_relato')
})

test('CO-OP: o parceiro saiu antes do relato: vale o que quem ficou viu, quem saiu não ganha', async () => {
  const m = montar()
  const { host, conv, partidaId } = await coop(m)
  m.relogio.andar(200_000)
  conv.mandar({ t: 'sair' })
  vitoria(host, partidaId, true) // ainda dentro da graça do abandono
  await esperar()
  m.relogio.andar(ABANDONO_GRACA_MS)
  await esperar()
  assert.equal(recompensa(host).xpGanho, VITORIA)
  assert.equal(recompensa(conv).xpGanho, 0)
  assert.equal(recompensa(conv).motivo, 'abandono')
})

test('CO-OP: ninguém relatou e o parceiro saiu: a luta não acabou, sem XP para ninguém', async () => {
  const m = montar()
  const { host, conv } = await coop(m)
  m.relogio.andar(120_000)
  conv.mandar({ t: 'sair' })
  m.relogio.andar(ABANDONO_GRACA_MS)
  await esperar()
  assert.equal(recompensa(host).xpGanho, 0, 'quem ficou não ganha vitória de graça no CO-OP')
  assert.equal(m.sb.tabelas.partidas[0].validacao, 'encerrada')
  assert.equal(m.sb.tabelas.perfis.reduce((t, p) => t + p.xp, 0), 0)
})

test('CO-OP: o host cai e não volta: host_caiu, sem XP e sem derrota', async () => {
  const m = montar()
  const { host, conv } = await coop(m)
  m.relogio.andar(80_000)
  host.sair()
  m.relogio.andar(RETOMADA_MS)
  m.relogio.andar(ABANDONO_GRACA_MS)
  await esperar()
  assert.equal(recompensa(conv).motivo, 'host_caiu')
  assert.equal(recompensa(conv).xpGanho, 0)
})

test('CO-OP: luta curta demais ou com rodadas de menos não dá XP', async () => {
  const m = montar()
  const a = await coop(m)
  m.relogio.andar(30_000)
  vitoria(a.host, a.partidaId, true, { duracao: 999 })
  vitoria(a.conv, a.partidaId, true)
  await esperar()
  assert.equal(recompensa(a.host).xpGanho, 0)
  assert.equal(recompensa(a.host).motivo, 'curta')

  const m2 = montar()
  const c = await coop(m2)
  m2.relogio.andar(200_000)
  vitoria(c.host, c.partidaId, true, { rodadas: 1 })
  vitoria(c.conv, c.partidaId, true, { rodadas: 1 })
  await esperar()
  assert.equal(recompensa(c.host).motivo, 'curta')
})

test('CO-OP: parceiro convidado e a mesma conta nos dois lados não ganham XP', async () => {
  const m = montar({ contas: ['ana'] })
  const { host, conv, partidaId } = await coop(m, 'ana', 'visitante')
  m.relogio.andar(200_000)
  vitoria(host, partidaId, true)
  vitoria(conv, partidaId, true)
  await esperar()
  assert.equal(recompensa(host).xpGanho, VITORIA, 'a conta ganha com um convidado de parceiro')
  assert.equal(recompensa(conv).motivo, 'convidado')

  const m2 = montar({ contas: ['ana'] })
  const duas = await coop(m2, 'ana', 'ana')
  m2.relogio.andar(200_000)
  vitoria(duas.host, duas.partidaId, true)
  vitoria(duas.conv, duas.partidaId, true)
  await esperar()
  assert.equal(recompensa(duas.host).motivo, 'mesma_conta')
  assert.equal(m2.sb.tabelas.perfis[0].xp, 0)
})

test('CO-OP: relato mal formado não vale (vitoria precisa ser true/false); PVP segue com vencedorLado', () => {
  assert.equal(lerRelato({ partidaId: 'x', vencedorLado: 0 }, 'coop'), null)
  assert.equal(lerRelato({ partidaId: 'x', vitoria: 'sim' }, 'coop'), null)
  assert.deepEqual(lerRelato({ partidaId: 'x', vitoria: false, rodadas: 5, duracao: 99, personagem: 'kris' }, 'coop'), { vitoria: false, rodadas: 5, duracao: 99, personagem: 'kris' })
  assert.equal(lerRelato({ partidaId: 'x', vitoria: true }), null, 'no PVP o campo é vencedorLado')
  assert.equal(lerRelato({ partidaId: 'x', vencedorLado: 1 }).vencedorLado, 1)
  // decidir: o modo vem da partida
  const p = { modo: 'coop', criadaEm: 0, participantes: [{ lado: 0, relato: { vitoria: true, rodadas: 4 }, relatadoEm: 90_000, saiuEm: null }, { lado: 1, relato: { vitoria: true, rodadas: 6 }, relatadoEm: 95_000, saiuEm: null }] }
  const d = decidir(p, 100_000)
  assert.deepEqual([d.validacao, d.vencedorLado, d.resultados[0], d.resultados[1], d.rodadas, d.duracaoS], ['validada', null, 'vitoria', 'vitoria', 4, 90])
})

test('CO-OP: o limite diário conta o parceiro, separado do PVP', async () => {
  const m = montar()
  const ganhos = []
  for (let i = 0; i < 6; i++) {
    const { host, conv, partidaId } = await coop(m)
    m.relogio.andar(200_000)
    vitoria(host, partidaId, true)
    vitoria(conv, partidaId, true)
    await esperar()
    ganhos.push(recompensa(host).xpGanho)
    host.mandar({ t: 'sair' })
    conv.mandar({ t: 'sair' })
  }
  // 3 cheias, 2 pela metade, depois 0
  assert.deepEqual(ganhos, [VITORIA, VITORIA, VITORIA, VITORIA / 2, VITORIA / 2, 0])
  // o PVP com o mesmo parceiro começa do zero (o contador é por modo)
  const pvp = await sala(m, 'pvp')
  m.relogio.andar(200_000)
  pvp.host.mandar({ t: 'resultado', partidaId: pvp.partidaId, vencedorLado: 0, rodadas: 4, duracao: 200 })
  pvp.conv.mandar({ t: 'resultado', partidaId: pvp.partidaId, vencedorLado: 0, rodadas: 4, duracao: 200 })
  await esperar()
  assert.equal(recompensa(pvp.host).xpGanho, VITORIA)
})

// ---------- bloqueio ----------

const bloquear = async (m, quem, alvo) => {
  m.sb.tabelas.bloqueios.push({ quem: m.id(quem.nome), bloqueado: m.id(alvo.nome) })
  quem.mandar({ t: 'amigosMudaram', com: m.id(alvo.nome) })
  await esperar()
}
async function lobbyDe(m, a = 'ana', b = 'beto') {
  const host = await m.entrar(a)
  const conv = await m.entrar(b)
  host.mandar({ t: 'criar' })
  conv.mandar({ t: 'entrar', codigo: host.ultima('sala').sala.codigo })
  return { host, conv }
}

test('bloquear o convidado da sala: ele é tirado, o host fica', async () => {
  const m = montar()
  const { host, conv } = await lobbyDe(m)
  await bloquear(m, host, conv)
  assert.equal(conv.c.sala, null)
  assert.match(conv.ultima('fechada').motivo, /bloqueio/)
  assert.equal(host.c.sala !== null, true)
  assert.equal(host.ultima('sala').sala.membros.length, 1)
})

test('bloquear o host da sala: quem sai é você (o convidado)', async () => {
  const m = montar()
  const { host, conv } = await lobbyDe(m)
  await bloquear(m, conv, host)
  assert.equal(conv.c.sala, null)
  assert.match(conv.ultima('fechada').motivo, /bloqueio/)
  assert.equal(host.ultima('sala').sala.membros.length, 1)
  assert.equal(host.ultima('fechada'), undefined, 'o host nem fica sabendo quem bloqueou')
})

test('bloquear no meio da partida: vale só quando o host volta ao lobby', async () => {
  const m = montar()
  const { host, conv } = await lobbyDe(m)
  host.mandar({ t: 'partida', valor: true })
  await bloquear(m, host, conv)
  assert.notEqual(conv.c.sala, null, 'no meio da partida ninguém sai')
  host.mandar({ t: 'partida', valor: false })
  assert.equal(conv.c.sala, null)
  assert.equal(host.ultima('sala').sala.membros.length, 1)
})

test('bloquear quem não está na sua sala não mexe nela; e ninguém entra em sala com bloqueio', async () => {
  const m = montar({ bloqueios: [['ana', 'caio']] })
  const { host, conv } = await lobbyDe(m)
  const caio = await m.entrar('caio')
  await bloquear(m, host, caio) // caio não está na sala
  assert.notEqual(conv.c.sala, null)
  // sala só do host: o bloqueado (por ele) não entra, sem dizer por quê
  const outro = montar({ bloqueios: [['ana', 'caio']] })
  const ana = await outro.entrar('ana')
  const c2 = await outro.entrar('caio')
  ana.mandar({ t: 'criar' })
  await esperar()
  c2.mandar({ t: 'entrar', codigo: ana.ultima('sala').sala.codigo })
  assert.equal(c2.c.sala, null)
  assert.equal(c2.ultima('erro').msg, 'não deu para entrar nessa sala')
})

// ---------- convidados no limite diário ----------

test('convidado como oponente: cada conexão de outro endereço é um oponente; o mesmo endereço da conta, um só', () => {
  const conta = { ip: '1.1.1.1', cliente: 'a' }
  assert.equal(refConvidado({ ip: '1.1.1.1', cliente: 'g1' }, conta), REF_CONVIDADO_JUNTO)
  assert.equal(refConvidado({ ip: '1.1.1.1', cliente: 'g2' }, conta), REF_CONVIDADO_JUNTO)
  assert.equal(refConvidado({ ip: '2.2.2.2', cliente: 'g3' }, conta), 'convidado:g3')
  assert.equal(refConvidado({ ip: null, cliente: 'g4' }, { ip: null, cliente: 'a' }), 'convidado:g4', 'sem endereço conhecido não junta ninguém')
})

async function contraConvidado(m, ipConvidado) {
  const { host, conv, partidaId } = await sala(m, 'pvp', 'ana', 'visitante', { ana: '10.0.0.2', visitante: ipConvidado })
  m.relogio.andar(200_000)
  host.mandar({ t: 'resultado', partidaId, vencedorLado: 0, rodadas: 4, duracao: 200 })
  conv.mandar({ t: 'resultado', partidaId, vencedorLado: 0, rodadas: 4, duracao: 200 })
  await esperar()
  const xp = recompensa(host).xpGanho
  host.mandar({ t: 'sair' })
  conv.sair()
  return xp
}

test('convidados de endereços diferentes não esgotam o limite um do outro (até o teto diário)', async () => {
  const m = montar({ contas: ['ana'] })
  const ganhos = []
  for (let i = 0; i < CONVIDADOS_LIMITE_DIA + 2; i++) ganhos.push(await contraConvidado(m, `20.0.0.${i + 1}`))
  assert.deepEqual(ganhos, [...Array(CONVIDADOS_LIMITE_DIA).fill(VITORIA), 0, 0], 'cheio contra cada convidado novo, e o teto diário contra convidados')
  assert.deepEqual(
    m.sb.tabelas.partida_participantes.filter((x) => x.ref).map((x) => x.ref).slice(0, 2).map((r) => r.startsWith('convidado:')),
    [true, true],
  )
})

test('convidado do MESMO endereço da conta (aba anônima): continua contando como um só', async () => {
  const m = montar({ contas: ['ana'] })
  const ganhos = []
  for (let i = 0; i < 6; i++) ganhos.push(await contraConvidado(m, '10.0.0.2'))
  assert.deepEqual(ganhos, [VITORIA, VITORIA, VITORIA, VITORIA / 2, VITORIA / 2, 0])
  assert.ok(m.sb.tabelas.partida_participantes.filter((x) => x.ref).every((x) => x.ref === REF_CONVIDADO_JUNTO))
})

// ---------- verso equipado e aba escondida ----------

test('o verso equipado vai no membro da sala (só o id válido); sem verso, null', async () => {
  const m = montar({ versos: { ana: 'verso.carmesim', beto: '<script>' } })
  const { host, conv } = await lobbyDe(m)
  const membros = conv.ultima('sala').sala.membros
  assert.equal(membros.find((x) => x.papel === 'host').conta.verso, 'verso.carmesim')
  assert.equal(membros.find((x) => x.papel === 'convidado').conta.verso, null, 'id fora do formato não passa')
  assert.equal(host.ultima('sala').sala.membros[0].conta.verso, 'verso.carmesim')
  const v = await m.entrar('visitante')
  v.mandar({ t: 'criar' })
  assert.equal(v.ultima('sala').sala.membros[0].conta, null)
})

test('aba do host em segundo plano: só depois de uns segundos, e voltar limpa na hora', async () => {
  const m = montar()
  const { host, conv } = await lobbyDe(m)
  const doHost = () => conv.ultima('sala').sala.membros.find((x) => x.papel === 'host').segundoPlano
  assert.equal(doHost(), false)
  host.mandar({ t: 'visivel', valor: false })
  m.relogio.andar(SEGUNDO_PLANO_MS - 1)
  assert.equal(doHost(), false, 'um alt-tab rápido não avisa ninguém')
  host.mandar({ t: 'visivel', valor: true })
  m.relogio.andar(SEGUNDO_PLANO_MS)
  assert.equal(doHost(), false)
  host.mandar({ t: 'visivel', valor: false })
  host.mandar({ t: 'visivel', valor: false }) // repetido não reinicia a contagem
  m.relogio.andar(SEGUNDO_PLANO_MS)
  assert.equal(doHost(), true)
  host.mandar({ t: 'visivel', valor: true })
  assert.equal(doHost(), false)
  // saiu com a aba escondida: o timer não fica pendurado nem quebra
  conv.mandar({ t: 'visivel', valor: false })
  conv.sair()
  m.relogio.andar(SEGUNDO_PLANO_MS * 2)
})

// ---------- nome inicial do Google ----------

test('nome do Google: ofensivo ou inválido vira JOGADOR; o normal fica (espelho do criar_perfil)', () => {
  assert.equal(nomeInicialDoGoogle('Ana Clara'), 'Ana Clara')
  assert.equal(nomeInicialDoGoogle('  João   Silva '), 'João Silva')
  assert.equal(nomeInicialDoGoogle('Caralho'), NOME_NEUTRO)
  assert.equal(nomeInicialDoGoogle('Hitler 99'), NOME_NEUTRO)
  assert.equal(nomeInicialDoGoogle('F D P'), 'F D P', 'o filtro só pega o que a lista pega (igual ao banco)')
  assert.equal(nomeInicialDoGoogle('😀😀'), NOME_NEUTRO)
  assert.equal(nomeInicialDoGoogle(''), NOME_NEUTRO)
  assert.equal(nomeInicialDoGoogle(undefined), NOME_NEUTRO)
  assert.equal(nomeInicialDoGoogle('Fulano de Tal Muito Comprido'), 'Fulano de Tal Mu')
  assert.equal(nomeSeguro('Ana'), 'Ana')
  assert.equal(nomeSeguro('Puta'), NOME_NEUTRO)
})

test('o servidor repete o filtro no nome do perfil que lê (perfil antigo com nome da lista)', async () => {
  const m = montar()
  m.perfis.find((p) => p.id === 'u-caio').nome_exibicao = 'Bosta'
  const caio = await m.entrar('caio')
  assert.equal(caio.ultima('bemvindo').conta.nome, NOME_NEUTRO)
  assert.equal(caio.c.nome, NOME_NEUTRO)
})
