// node --test src/game/coop/__tests__/regraChefe.test.js
// A REGRA DO CHEFE (coop/regraChefe.js): o ciclo de vida dos ganchos, os itens/zonas que só o PC dono do
// coração decide (e os outros repetem pela mensagem), o sorteio determinístico e a limpeza
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RegraDaLuta, REGRA_EXEMPLO, REGRAS, rngDaRegra, descricaoValida } from '../regraChefe.js'
import { CHEFES } from '../chefes/index.js'
import { criarPartidaCoop, iniciarRodadaCoop } from '../regras.js'
import { somarQuebra } from '../coop2.js'

// uma ponte de mentira (o que a arena dá), com o registro do que a regra pediu
function ponteFalsa({ meus = [0, 1], meuLado = 0, semente = 'teste', estado = null } = {}) {
  const e = estado ?? criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'king', semente })
  const log = { enviados: [], desenhados: [], apagados: [], banners: [], dicas: [], quebra: 0, dano: 0 }
  const coracoes = [
    { j: 0, x: 50, y: 50, ativo: true },
    { j: 1, x: 250, y: 150, ativo: true },
  ]
  const ponte = {
    semente,
    nivel: 'medio',
    n: 2,
    rodada: () => e.rodada,
    estado: () => e,
    meu: (j) => meus.includes(j),
    meuLado: () => meuLado,
    coracoes: () => coracoes,
    limites: () => ({ x: 0, y: 0, width: 300, height: 200 }),
    desenharItem: (item) => (log.desenhados.push(item.id), { id: item.id }),
    desenharZona: (zona) => (log.desenhados.push(zona.id), { id: zona.id }),
    apagar: (h) => log.apagados.push(h?.id),
    banner: (t) => log.banners.push(t),
    dica: (id, t) => log.dicas.push([id, t]),
    quebra: (p) => {
      log.quebra += p
      somarQuebra(e, p)
    },
    danoNoChefe: (d) => (log.dano += d),
    curar: () => {},
    ferir: () => {},
    empurrar: () => {},
    enviar: (acao, dados) => log.enviados.push({ acao, dados }),
  }
  return { ponte, log, coracoes, estado: e }
}

test('a regra de exemplo: nome e UMA frase curta', () => {
  assert.equal(REGRAS.exemplo, REGRA_EXEMPLO)
  assert.ok(descricaoValida(REGRA_EXEMPLO.descricao))
  assert.ok(!descricaoValida('Duas frases. Aqui tem duas.'))
  assert.ok(!descricaoValida('x'.repeat(91)))
  assert.ok(!descricaoValida(''))
  // nenhum chefe de verdade tem regra ainda (os agentes de cada chefe põem a dele); a que existir tem de ser válida
  for (const [id, def] of Object.entries(CHEFES)) if (def.regra) assert.ok(descricaoValida(def.regra.descricao), id)
})

test('ciclo de vida: criar, cada gancho na ordem, terminar limpa tudo', () => {
  const ordem = []
  const guardado = { destruido: false, destroy() { this.destruido = true } }
  const def = {
    id: 'teste',
    nome: 'TESTE',
    descricao: 'Uma frase só.',
    criar(api) {
      ordem.push('criar')
      api.guardar(guardado)
      const gancho = (nome) => (...a) => ordem.push(nome + (a.length && typeof a[0] !== 'object' ? `:${a[0]}` : ''))
      return {
        comecar: gancho('comecar'),
        inicioDaRodada: gancho('inicioDaRodada'),
        comecarEsquiva: () => {
          ordem.push('comecarEsquiva')
          api.adicionarItem({ x: 10, y: 10 })
          api.adicionarItem({ x: 10, y: 10, fica: true })
          api.adicionarZona({ x: 100, y: 100, largura: 20, altura: 20 })
        },
        atualizar: () => ordem[ordem.length - 1] !== 'atualizar' && ordem.push('atualizar'),
        terminarEsquiva: gancho('terminarEsquiva'),
        fimDaRodada: gancho('fimDaRodada'),
        faseNova: gancho('faseNova'),
        terminar: gancho('terminar'),
      }
    },
  }
  const { ponte, log } = ponteFalsa({ meus: [] })
  const regra = new RegraDaLuta(def, ponte)
  regra.comecar()
  regra.inicioDaRodada(1)
  regra.comecarEsquiva({ carta: null })
  regra.atualizar(16)
  regra.atualizar(16)
  assert.equal(regra.itensVivos.length, 2)
  regra.terminarEsquiva()
  assert.equal(regra.itensVivos.length, 1, 'o item sem `fica` some no fim da esquiva')
  assert.equal(regra.zonasVivas.length, 0)
  regra.fimDaRodada({ novaFase: null })
  regra.faseNova(1)
  regra.terminar()
  assert.deepEqual(ordem, ['criar', 'comecar', 'inicioDaRodada:1', 'comecarEsquiva', 'atualizar', 'terminarEsquiva', 'fimDaRodada', 'faseNova:1', 'terminar'])
  assert.equal(regra.itensVivos.length, 0)
  assert.equal(guardado.destruido, true)
  assert.equal(log.apagados.length, log.desenhados.length, 'tudo que foi desenhado foi apagado')
  // depois de terminar, nada roda
  regra.comecarEsquiva({})
  assert.equal(ordem.at(-1), 'terminar')
})

test('sem regra (o chefe não tem): tudo vira nada e o ataque é o padrão', () => {
  const { ponte } = ponteFalsa()
  const regra = new RegraDaLuta(null, ponte)
  assert.equal(regra.ativa, false)
  regra.comecar()
  regra.comecarEsquiva({})
  regra.atualizar(16)
  const padrao = { nome: 'padrão' }
  assert.equal(regra.ataque({}, {}, padrao), padrao)
  assert.equal(regra.alvoDoBot(1), null)
  regra.terminar()
})

test('o ataque da carta: a regra pode trocar (e devolver null mantém o padrão)', () => {
  const def = { id: 'a', nome: 'A', descricao: 'Troca o ataque.', criar: () => ({ ataque: (carta, A, padrao) => (carta.naipe === 'espadas' ? { nome: 'outro', base: padrao } : null) }) }
  const { ponte } = ponteFalsa()
  const regra = new RegraDaLuta(def, ponte)
  const padrao = { nome: 'padrão' }
  assert.equal(regra.ataque({ naipe: 'espadas' }, {}, padrao).nome, 'outro')
  assert.equal(regra.ataque({ naipe: 'ouros' }, {}, padrao), padrao)
})

test('um gancho que quebra não derruba a luta', () => {
  const def = {
    id: 'b',
    nome: 'B',
    descricao: 'Quebra.',
    criar: () => ({
      atualizar() {
        throw new Error('ops')
      },
    }),
  }
  const { ponte } = ponteFalsa()
  const regra = new RegraDaLuta(def, ponte)
  const erro = console.error
  console.error = () => {}
  try {
    regra.comecarEsquiva({})
    assert.doesNotThrow(() => regra.atualizar(16))
  } finally {
    console.error = erro
  }
})

test('determinístico: a mesma (semente, rodada, tag) sorteia igual em todos os PCs', () => {
  const a = rngDaRegra('s', 3, 'x')
  const b = rngDaRegra('s', 3, 'x')
  const sa = [a(), a(), a()]
  assert.deepEqual(sa, [b(), b(), b()])
  assert.notDeepEqual(sa, [rngDaRegra('s', 4, 'x')(), 0, 0].slice(0, 3))
  // a regra de exemplo põe a estrela no mesmo lugar nos dois PCs
  const pos = () => {
    const { ponte, estado } = ponteFalsa({ meus: [] })
    iniciarRodadaCoop(estado)
    const regra = new RegraDaLuta(REGRA_EXEMPLO, ponte)
    regra.comecarEsquiva({})
    return regra.itensVivos.map((i) => [i.id, Math.round(i.x), Math.round(i.y)])
  }
  assert.deepEqual(pos(), pos())
  assert.equal(pos().length, 1)
})

test('rede: só o PC dono do coração pega o item; ele manda e o outro PC repete o aoPegar', () => {
  // PC do jogador 0 (dono do coração 0) e PC do jogador 1, com a mesma luta
  const a = ponteFalsa({ meus: [0], meuLado: 0 })
  const b = ponteFalsa({ meus: [1], meuLado: 1 })
  iniciarRodadaCoop(a.estado)
  iniciarRodadaCoop(b.estado)
  const pegos = { a: [], b: [] }
  const def = (quem) => ({
    id: 'itens',
    nome: 'ITENS',
    descricao: 'Pegue.',
    criar: (api) => ({
      comecarEsquiva: () => api.adicionarItem({ x: 50, y: 50, aoPegar: (j) => (pegos[quem].push(j), api.adicionarQuebra(10)) }),
    }),
  })
  const ra = new RegraDaLuta(def('a'), a.ponte)
  const rb = new RegraDaLuta(def('b'), b.ponte)
  ra.comecarEsquiva({})
  rb.comecarEsquiva({})
  // nos dois PCs o coração 0 está em cima do item; só o PC a decide
  rb.atualizar(16)
  assert.deepEqual(pegos.b, [])
  ra.atualizar(16)
  assert.deepEqual(pegos.a, [0])
  assert.deepEqual(a.log.enviados, [{ acao: 'item', dados: { id: ra.itensVivos[0]?.id ?? 'item:1:0', j: 0 } }])
  // a mensagem chega no PC b
  const { acao, dados } = a.log.enviados[0]
  rb.aoMensagem(0, acao, dados)
  assert.deepEqual(pegos.b, [0])
  assert.equal(rb.itensVivos.length, 0)
  assert.equal(a.estado.chefe.quebra, b.estado.chefe.quebra)
  // repetida: nada
  rb.aoMensagem(0, acao, dados)
  assert.deepEqual(pegos.b, [0])
})

test('rede: api.enviar roda aqui e nos outros (aoMensagem com o lado de quem mandou)', () => {
  const recebidas = []
  const def = {
    id: 'm',
    nome: 'M',
    descricao: 'Mensagens.',
    criar: (api) => ({
      comecar: () => api.enviar('dado', { valor: 6 }),
      aoMensagem: (lado, acao, dados) => recebidas.push([lado, acao, dados.valor]),
    }),
  }
  const a = ponteFalsa({ meuLado: 1 })
  const regra = new RegraDaLuta(def, a.ponte)
  regra.comecar()
  assert.deepEqual(recebidas, [[1, 'dado', 6]])
  assert.deepEqual(a.log.enviados, [{ acao: 'u:dado', dados: { valor: 6 } }])
  const outra = new RegraDaLuta(def, ponteFalsa().ponte)
  recebidas.length = 0
  outra.aoMensagem(1, 'u:dado', { valor: 6 })
  assert.deepEqual(recebidas, [[1, 'dado', 6]])
})

test('zonas: entrar e sair avisam uma vez (e vão pela rede)', () => {
  const eventos = []
  const def = {
    id: 'z',
    nome: 'Z',
    descricao: 'Zona.',
    criar: (api) => ({
      comecarEsquiva: () => api.adicionarZona({ x: 50, y: 50, largura: 40, altura: 40, aoEntrar: (j) => eventos.push(`entrou:${j}`), aoSair: (j) => eventos.push(`saiu:${j}`) }),
    }),
  }
  const { ponte, coracoes, log } = ponteFalsa({ meus: [0] })
  const regra = new RegraDaLuta(def, ponte)
  regra.comecarEsquiva({})
  regra.atualizar(16)
  regra.atualizar(16)
  coracoes[0].x = 200
  regra.atualizar(16)
  assert.deepEqual(eventos, ['entrou:0', 'saiu:0'])
  assert.deepEqual(
    log.enviados.map((m) => m.acao),
    ['zona', 'zona'],
  )
})

test('a regra de exemplo: pegar a estrela enche a QUEBRA; a fase nova dobra e mostra o texto', () => {
  const { ponte, estado, coracoes, log } = ponteFalsa()
  iniciarRodadaCoop(estado)
  const regra = new RegraDaLuta(REGRA_EXEMPLO, ponte)
  regra.comecar()
  regra.comecarEsquiva({})
  const [estrela] = regra.itensVivos
  coracoes[1].x = estrela.x
  coracoes[1].y = estrela.y
  // a CPU vai buscar o item
  assert.deepEqual([regra.alvoDoBot(1).x, regra.alvoDoBot(1).y], [estrela.x, estrela.y])
  regra.atualizar(16)
  assert.equal(log.quebra, 15)
  assert.equal(estado.chefe.quebra, 15)
  assert.equal(regra.faseNova(1), REGRA_EXEMPLO.fases[1].descricao)
  regra.terminarEsquiva()
  regra.comecarEsquiva({})
  const [outra] = regra.itensVivos
  coracoes[0].x = outra.x
  coracoes[0].y = outra.y
  regra.atualizar(16)
  assert.equal(log.quebra, 45)
})
