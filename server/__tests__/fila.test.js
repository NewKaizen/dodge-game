import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, PROTOCOLO } from '../lan.js'
import { criarFila, CONFIRMAR_MS, REVANCHE_MS, ACOES_FILA_POR_MINUTO } from '../fila.js'

// relógio e timers falsos: andar(ms) dispara o que venceu
function relogioFalso() {
  let t = 1_000_000
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
      for (const x of [...timers].sort((a, b) => a.quando - b.quando))
        if (x.quando <= t && timers.delete(x)) x.fn()
    },
    ativos: () => timers.size,
  }
}

const esperar = async () => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setImmediate(r))
}

// contas: nome -> { bloqueios: [nomes] }; quem não está aqui entra como convidado
function montar({ contas = {}, amizades = [] } = {}) {
  const relogio = relogioFalso()
  const id = (nome) => `u-${nome}`
  const autenticar = async (token) => {
    const nome = token.replace(/^token-/, '').replace(/-\d+$/, '')
    return contas[nome] ? { id: id(nome), perfil: { id: id(nome), tag: `${nome}#1000`, nome_exibicao: nome.toUpperCase(), avatar_tipo: 'padrao', nivel: 1, xp: 0 } } : null
  }
  const amigosDe = (nome) => amizades.filter((p) => p.includes(nome)).map((p) => id(p.find((x) => x !== nome)))
  const relacoes = async (uid) => {
    const nome = uid.replace(/^u-/, '')
    const bloq = new Set((contas[nome]?.bloqueios ?? []).map(id))
    for (const [outro, c] of Object.entries(contas)) if (c.bloqueios?.includes(nome)) bloq.add(id(outro))
    return { amigos: new Set(amigosDe(nome)), bloqueios: bloq, pedidos: new Set() }
  }
  const logs = []
  const lobby = criarLobby({ locais: () => [{ ip: '192.168.0.10', mascara: '255.255.255.0' }], online: true, agora: relogio.agora, agendar: relogio.agendar, autenticar, relacoes, log: (l) => logs.push(l) })
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
      limpar: () => (recebidas.length = 0),
      sair: () => {
        ws.readyState = 3
        lobby.desconectar(c)
      },
      estado: () => lobby.fila.estado(c),
    }
    p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome: nome.toUpperCase(), ...(contas[nome] && { token: `token-${nome}-${++n}` }) })
    await esperar()
    return p
  }
  return { lobby, relogio, entrar, logs }
}

const naFila = (p) => p.mandar({ t: 'fila', acao: 'entrar' })
const confirmar = (p, aceitar = true) => p.mandar({ t: 'confirmar', id: p.ultima('pareado').id, aceitar })

test('protocolo igual nos dois lados (servidor e cliente)', async () => {
  const fs = await import('node:fs')
  const rede = fs.readFileSync(new URL('../../src/lib/lan/rede.js', import.meta.url), 'utf8')
  assert.equal(PROTOCOLO, 5)
  assert.match(rede, new RegExp(`export const PROTOCOLO = ${PROTOCOLO}\\b`))
})

test('fila pura: FIFO, quem volta de um par desfeito entra na frente', () => {
  const r = relogioFalso()
  const avisos = []
  const fila = criarFila({ agora: r.agora, agendar: r.agendar, avisos: { pareado: (p) => avisos.push([p.a, p.b]) }, podeParear: (a, b) => !(a === 'A' && b === 'B') && !(a === 'B' && b === 'A') })
  fila.entrar('A')
  r.andar(1000)
  fila.entrar('B') // A x B não pode
  assert.equal(fila.tamanho(), 2)
  fila.entrar('C') // o mais antigo (A) pega o C
  assert.deepEqual(avisos, [['A', 'C']])
  assert.equal(fila.estado('B'), 'procurando')
  const desdeA = 1_000_000
  fila.sair('C') // C desiste: A volta na frente, com a espera de antes
  assert.equal(fila.estado('A'), 'procurando')
  assert.equal(fila.desde('A'), desdeA)
  assert.equal(fila.estado('C'), 'fora')
  fila.entrar('D') // A (frente) pega o D antes do B
  assert.deepEqual(avisos.at(-1), ['A', 'D'])
  assert.equal(r.ativos(), 1, 'só o timer do par A x D')
  fila.sair('B')
  fila.sair('A')
  assert.equal(r.ativos(), 0)
  assert.equal(fila.tamanho() + fila.pares(), 1, 'sobrou só o D, de volta na espera')
})

test('entrar, entrar de novo (sem duplicar) e sair', async () => {
  const { lobby, entrar, relogio } = await montar()
  const ana = await entrar('ana')
  naFila(ana)
  const primeira = ana.ultima('fila')
  assert.equal(primeira.estado, 'procurando')
  assert.equal(primeira.convidado, true, 'convidado entra (sem XP, avisado)')
  relogio.andar(3000)
  naFila(ana)
  assert.equal(lobby.fila.tamanho(), 1)
  assert.equal(ana.ultima('fila').desde, primeira.desde)
  assert.equal(ana.ultima('fila').esperaMs, 3000)
  ana.mandar({ t: 'fila', acao: 'sair' })
  assert.equal(ana.ultima('fila').estado, 'fora')
  assert.equal(ana.estado(), 'fora')
  assert.equal(lobby.fila.tamanho(), 0)
  ana.mandar({ t: 'fila', acao: 'sair' }) // sair de novo só confirma
  assert.equal(ana.ultima('fila').estado, 'fora')
})

test('não entra na fila quem está numa sala', async () => {
  const { lobby, entrar } = await montar()
  const ana = await entrar('ana')
  ana.mandar({ t: 'criar' })
  naFila(ana)
  assert.match(ana.ultima('filaNegada').msg, /saia da sala/)
  assert.equal(lobby.fila.tamanho(), 0)
})

test('pareia, os dois confirmam e a sala casual nasce com o host de quem confirmou primeiro', async () => {
  const { lobby, entrar, relogio, logs } = await montar({ contas: { beto: {} } })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  naFila(ana)
  naFila(beto)
  const pa = ana.ultima('pareado')
  const pb = beto.ultima('pareado')
  assert.equal(pa.id, pb.id)
  assert.equal(pa.oponente.nome, 'BETO')
  assert.equal(pa.oponente.tag, 'beto#1000')
  assert.equal(pb.oponente.nome, 'ANA')
  assert.equal(pb.oponente.tag, undefined, 'convidado não tem tag')
  assert.equal(pa.restanteMs, CONFIRMAR_MS)
  assert.equal(lobby.fila.tamanho(), 0)
  assert.equal(lobby.fila.pares(), 1)

  const caio = await entrar('caio')
  naFila(caio)
  assert.equal(caio.estado(), 'procurando', 'quem chega depois espera')

  confirmar(beto)
  assert.deepEqual(ana.ultima('pareadoEstado'), { t: 'pareadoEstado', id: pa.id, eu: false, oponente: true })
  confirmar(beto) // de novo: nada muda
  assert.equal(lobby.salas.size, 0)
  confirmar(ana)
  assert.equal(lobby.fila.pares(), 0)
  assert.equal(lobby.salas.size, 1)
  const sala = [...lobby.salas.values()][0]
  assert.equal(sala.casual, true)
  assert.equal(sala.modo, 'pvp')
  assert.equal(sala.host, beto.c.id, 'beto confirmou primeiro')
  assert.deepEqual(sala.participantes.map((p) => [p.usuario, p.convidado]), [['u-beto', false], [null, true]])
  for (const p of [ana, beto]) {
    assert.deepEqual(p.ultima('partidaCasual'), { t: 'partidaCasual', salaId: sala.id, host: beto.c.id })
    const s = p.ultima('sala').sala
    assert.equal(s.casual, true)
    assert.equal(s.membros.length, 2)
    assert.equal(p.estado(), 'fora')
  }
  assert.equal(ana.ultima('sala').sala.membros.find((m) => m.id === ana.c.id).pronto, true)
  assert.equal(relogio.ativos(), 0, 'o timer do par foi cancelado')
  assert.match(logs.at(-1), /regra: confirmou primeiro/)
  // a casual é PVP, sem expulsar
  beto.mandar({ t: 'modo', modo: 'coop' })
  beto.mandar({ t: 'expulsar', id: ana.c.id })
  assert.equal(sala.modo, 'pvp')
  assert.equal(sala.membros.size, 2)
  // quem está na sala casual não entra na fila
  naFila(ana)
  assert.equal(ana.estado(), 'fora')
})

test('host da casual: o de menor ping, quando a diferença conta', async () => {
  const { lobby, entrar, logs } = await montar()
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  ana.mandar({ t: 'meuPing', ms: 180 })
  beto.mandar({ t: 'meuPing', ms: 40 })
  naFila(ana)
  naFila(beto)
  confirmar(ana)
  confirmar(beto)
  assert.equal([...lobby.salas.values()][0].host, beto.c.id)
  assert.match(logs.at(-1), /menor ping/)
})

test('um recusa: ele sai da fila e o outro volta para a frente', async () => {
  const { lobby, entrar, relogio } = await montar()
  const ana = await entrar('ana')
  naFila(ana)
  const desde = ana.ultima('fila').desde
  relogio.andar(5000)
  const beto = await entrar('beto')
  naFila(beto)
  const caio = await entrar('caio')
  naFila(caio) // caio espera
  ana.limpar()
  confirmar(beto, false)
  assert.equal(beto.ultima('pareadoFim').voltou, false)
  assert.equal(beto.ultima('fila').estado, 'fora')
  assert.equal(beto.estado(), 'fora')
  const fim = ana.ultima('pareadoFim')
  assert.equal(fim.voltou, true)
  assert.match(fim.motivo, /recusou.*voltando para a fila/)
  assert.equal(ana.tipo('fila')[0].desde, desde, 'a espera continua contando')
  // ana estava na frente: pega o caio na hora
  assert.equal(ana.estado(), 'pareado')
  assert.equal(ana.ultima('pareado').oponente.nome, 'CAIO')
  assert.equal(lobby.fila.pares(), 1)
  assert.equal(relogio.ativos(), 1)
})

test('tempo esgotado: quem confirmou volta, quem não confirmou sai; ninguém confirmou, os dois saem', async () => {
  const { lobby, entrar, relogio } = await montar()
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  naFila(ana)
  naFila(beto)
  confirmar(ana)
  relogio.andar(CONFIRMAR_MS + 100)
  assert.equal(ana.estado(), 'procurando')
  assert.match(ana.ultima('pareadoFim').motivo, /não confirmou a tempo/)
  assert.equal(beto.estado(), 'fora')
  assert.match(beto.ultima('pareadoFim').motivo, /você não confirmou/)
  assert.equal(beto.ultima('fila').estado, 'fora')
  assert.equal(lobby.salas.size, 0)

  // confirmação atrasada não cria nada
  const idVelho = beto.ultima('pareado').id
  beto.mandar({ t: 'confirmar', id: idVelho })
  assert.equal(beto.ultima('pareadoFim').motivo, 'essa partida não vale mais')
  assert.equal(lobby.salas.size, 0)
  assert.equal(beto.estado(), 'fora')

  // agora ninguém confirma
  const caio = await entrar('caio')
  naFila(caio) // pareia com a ana (que voltou)
  assert.equal(caio.estado(), 'pareado')
  relogio.andar(CONFIRMAR_MS + 100)
  assert.equal(ana.estado(), 'fora')
  assert.equal(caio.estado(), 'fora')
  assert.equal(lobby.fila.tamanho() + lobby.fila.pares(), 0)
  assert.equal(relogio.ativos(), 0)
})

test('desconectar procurando ou pareado não deixa ninguém preso', async () => {
  const { lobby, entrar, relogio } = await montar()
  const ana = await entrar('ana')
  naFila(ana)
  ana.sair()
  assert.equal(lobby.fila.tamanho(), 0)

  const beto = await entrar('beto')
  const caio = await entrar('caio')
  naFila(beto)
  naFila(caio)
  confirmar(beto)
  caio.sair()
  assert.equal(beto.estado(), 'procurando')
  assert.match(beto.ultima('pareadoFim').motivo, /desistiu/)
  assert.equal(lobby.fila.pares(), 0)
  assert.equal(relogio.ativos(), 0)
  relogio.andar(CONFIRMAR_MS * 2) // nenhum timer velho dispara
  assert.equal(beto.estado(), 'procurando')
  assert.equal(lobby.salas.size, 0)
})

test('criar ou entrar numa sala tira da fila (procurando e pareado)', async () => {
  const { lobby, entrar } = await montar()
  const ana = await entrar('ana')
  naFila(ana)
  ana.mandar({ t: 'criar' })
  assert.equal(ana.estado(), 'fora')
  assert.equal(ana.ultima('fila').estado, 'fora')
  const codigo = ana.ultima('sala').sala.codigo

  const beto = await entrar('beto')
  const caio = await entrar('caio')
  naFila(beto)
  naFila(caio)
  beto.mandar({ t: 'entrar', codigo }) // pareado e entra na sala da ana
  assert.equal(beto.estado(), 'fora')
  assert.equal(beto.c.sala, lobby.salas.get(ana.c.sala).id)
  assert.equal(caio.estado(), 'procurando', 'o par do beto volta para a fila')
  assert.equal(lobby.fila.pares(), 0)
})

test('aceitar convite de amigo tira da fila', async () => {
  const { lobby, entrar } = await montar({ contas: { ana: {}, beto: {} }, amizades: [['ana', 'beto']] })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  await esperar()
  naFila(beto)
  ana.mandar({ t: 'convidar', para: 'u-beto' })
  const conv = beto.ultima('convite')
  assert.ok(conv)
  beto.mandar({ t: 'responderConvite', id: conv.id, aceitar: true })
  assert.equal(beto.estado(), 'fora')
  assert.equal(beto.ultima('fila').estado, 'fora')
  assert.equal(lobby.salas.get(ana.c.sala).membros.size, 2)
})

test('mesma conta em duas abas não entra duas vezes nem pareia consigo', async () => {
  const { lobby, entrar } = await montar({ contas: { ana: {} } })
  const aba1 = await entrar('ana')
  const aba2 = await entrar('ana')
  naFila(aba1)
  naFila(aba2)
  assert.match(aba2.ultima('filaNegada').msg, /outra aba/)
  assert.equal(lobby.fila.tamanho(), 1)
  assert.equal(lobby.fila.pares(), 0)
})

test('quem se bloqueou não pareia (FIFO pula para o próximo)', async () => {
  const { lobby, entrar } = await montar({ contas: { ana: { bloqueios: ['beto'] }, beto: {}, caio: {} } })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  naFila(ana)
  naFila(beto)
  assert.equal(lobby.fila.pares(), 0)
  assert.equal(lobby.fila.tamanho(), 2)
  const caio = await entrar('caio')
  naFila(caio)
  assert.equal(ana.ultima('pareado').oponente.nome, 'CAIO')
  assert.equal(beto.estado(), 'procurando')
})

test('bloqueou enquanto confirmavam: a sala não nasce', async () => {
  const { lobby, entrar } = await montar({ contas: { ana: {}, beto: {} } })
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  naFila(ana)
  naFila(beto)
  ana.c.bloqueios.add('u-beto') // o que o recarregar faria depois de um bloqueio
  confirmar(ana)
  confirmar(beto)
  assert.equal(lobby.salas.size, 0)
  for (const p of [ana, beto]) assert.equal(p.ultima('fila').estado, 'fora')
  assert.equal(lobby.fila.tamanho() + lobby.fila.pares(), 0)
})

test('conta ainda carregando os bloqueios espera para entrar na fila', async () => {
  const { lobby, entrar } = await montar({ contas: { ana: {} } })
  const ana = await entrar('ana')
  ana.c.carregando = ana.c.usuario
  naFila(ana)
  assert.match(ana.ultima('filaNegada').msg, /espere a conta/)
  assert.equal(lobby.fila.tamanho(), 0)
})

test('trocar de conta tira da fila', async () => {
  const { lobby, entrar } = await montar({ contas: { ana: {} } })
  const ana = await entrar('ana')
  naFila(ana)
  ana.mandar({ t: 'conta', token: null })
  await esperar()
  assert.equal(ana.estado(), 'fora')
  assert.equal(lobby.fila.tamanho(), 0)
})

test('limita as ações da fila', async () => {
  const { entrar } = await montar()
  const ana = await entrar('ana')
  for (let i = 0; i < ACOES_FILA_POR_MINUTO; i++) ana.mandar({ t: 'fila', acao: i % 2 ? 'sair' : 'entrar' })
  assert.equal(ana.tipo('filaNegada').length, 0)
  ana.mandar({ t: 'fila', acao: 'entrar' })
  assert.match(ana.ultima('filaNegada').msg, /ações demais/)
  assert.equal(ana.estado(), 'fora')
})

// partida casual pronta, para os testes da revanche
async function casual() {
  const m = await montar()
  const ana = await m.entrar('ana')
  const beto = await m.entrar('beto')
  naFila(ana)
  naFila(beto)
  confirmar(ana)
  confirmar(beto)
  const sala = [...m.lobby.salas.values()][0]
  ana.mandar({ t: 'partida', valor: true }) // host começa
  return { ...m, ana, beto, sala }
}

test('sala casual: quem sai fecha a sala para o outro', async () => {
  const { lobby, ana, beto } = await casual()
  beto.mandar({ t: 'sair' })
  assert.equal(lobby.salas.size, 0)
  assert.equal(ana.ultima('fechada').motivo, 'o oponente saiu da partida')
  assert.equal(ana.c.sala, null)
  // "jogar novamente": sair da sala e entrar na fila
  beto.mandar({ t: 'fila', acao: 'entrar' })
  assert.equal(beto.estado(), 'procurando')
})

test('revanche: os dois aceitam', async () => {
  const { lobby, ana, beto, sala, relogio } = await casual()
  beto.mandar({ t: 'revanche', aceitar: true })
  assert.equal(ana.ultima('revanche').estado, 'pedida')
  assert.equal(ana.ultima('revanche').de, beto.c.id)
  assert.equal(ana.ultima('revanche').restanteMs, REVANCHE_MS)
  beto.mandar({ t: 'revanche', aceitar: true }) // repetir não fecha sozinho
  assert.equal(beto.ultima('revanche').estado, 'pedida')
  ana.mandar({ t: 'revanche', aceitar: true })
  for (const p of [ana, beto]) assert.deepEqual(p.ultima('revanche'), { t: 'revanche', estado: 'aceita', host: ana.c.id })
  assert.equal(sala.revanche, null)
  // sobra só o prazo do relato da partida anterior (server/partidas.js)
  assert.equal(relogio.ativos(), lobby.partidas.timers())
})

test('revanche: recusada, expirada ou com o oponente saindo', async () => {
  {
    const { ana, beto, relogio } = await casual()
    ana.mandar({ t: 'revanche', aceitar: true })
    beto.mandar({ t: 'revanche', aceitar: false })
    assert.equal(ana.ultima('revanche').estado, 'recusada')
    assert.equal(relogio.ativos(), 0)
  }
  {
    const { ana, beto, relogio } = await casual()
    ana.mandar({ t: 'revanche', aceitar: true })
    relogio.andar(REVANCHE_MS + 100)
    assert.equal(beto.ultima('revanche').estado, 'expirada')
    assert.equal(relogio.ativos(), 0)
    beto.mandar({ t: 'revanche', aceitar: true }) // depois de expirar: começa outro pedido
    assert.equal(ana.ultima('revanche').estado, 'pedida')
  }
  {
    const { lobby, ana, beto, relogio } = await casual()
    ana.mandar({ t: 'revanche', aceitar: true })
    beto.sair()
    assert.equal(lobby.salas.size, 0)
    assert.equal(ana.ultima('fechada').motivo, 'o oponente saiu da partida')
    assert.equal(relogio.ativos(), lobby.partidas.timers(), 'o timer da revanche foi junto (sobra só o do registro da partida)')
    relogio.andar(REVANCHE_MS * 2)
    assert.equal(ana.tipo('revanche').at(-1).estado, 'pedida', 'nada expira depois')
  }
})

test('revanche só vale na sala casual', async () => {
  const { entrar } = await montar()
  const ana = await entrar('ana')
  const beto = await entrar('beto')
  ana.mandar({ t: 'criar' })
  beto.mandar({ t: 'entrar', codigo: ana.ultima('sala').sala.codigo })
  ana.mandar({ t: 'revanche', aceitar: true })
  assert.equal(beto.tipo('revanche').length, 0)
  // sala normal: o convidado sair não fecha a sala
  beto.mandar({ t: 'sair' })
  assert.equal(ana.tipo('fechada').length, 0)
})
