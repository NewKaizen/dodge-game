// node --test src/game/pvp/__tests__/
// Cartas SUPER, desvio perfeito e o balanceamento do Asriel
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { definirAtaque, juntos, sequencia, comCaixa } from '../../attacks/definir.js'
import { CARTAS, PERSONAGENS_PVP, CUSTOS, SUPER, ehSuper, superDoPersonagem, nomeDoValor, custoDoValor, ataqueDaCarta, danoDaCarta, inverterDaCarta, ritmoDaCarta, TEMAS, DIFICULDADE_PVP } from '../cartas.js'
import { ENERGIA, PVP, criarPartida, iniciarRodada, resolverRodada, energiaPerfeito, registrarPerfeito, hpInicial } from '../regras.js'
import { escolherJogada, notaDaCarta } from '../bot.js'
import { criarRng } from '../baralho.js'
import { PERSONAGENS } from '../../data/personagens.js'

// Biblioteca falsa (mesma ideia de cartas.test.js)
// qualquer nome vale; os SUPERs de verdade (attacks/super/) duram ~9 s ativos
const falso = (nome) => definirAtaque({ nome, padrao: nome.startsWith('super') ? { duracao: 9000 } : {}, iniciar() {} })
const A = new Proxy({ juntos, sequencia, comCaixa }, { get: (alvo, nome) => (nome in alvo || typeof nome !== 'string' ? alvo[nome] : (alvo[nome] = falso(nome))) })

function naMao(estado, j, id) {
  const b = estado.jogadores[j].baralho
  for (const pilha of ['monte', 'descarte', 'mao']) {
    const i = b[pilha].findIndex((c) => c.id === id)
    if (i >= 0) {
      const [c] = b[pilha].splice(i, 1)
      b.mao.push(c)
      return c
    }
  }
  throw new Error(`carta ${id} não existe`)
}

function partida(p1 = 'kris', p2 = 'susie', energia = 10) {
  const e = criarPartida({ p1, p2, semente: 'super' })
  iniciarRodada(e)
  e.jogadores.forEach((j) => (j.energia = energia))
  return e
}

test('SUPER: contrato (valor 14, custo 10, ★)', () => {
  assert.deepEqual(SUPER, { valor: 14, custo: 10 })
  assert.equal(CUSTOS[14], 10)
  assert.equal(custoDoValor(14), 10)
  assert.equal(nomeDoValor(14), '★')
  assert.equal(ehSuper({ valor: 14 }), true)
  assert.equal(ehSuper({ valor: 13 }), false)
  assert.equal(ehSuper(null), false)
  assert.equal(SUPER.custo, ENERGIA.maxima)
})

test('SUPER: um em todo baralho, com o formato das outras cartas', () => {
  const nomes = new Set()
  for (const p of PERSONAGENS_PVP) {
    const supers = CARTAS[p].filter(ehSuper)
    assert.equal(supers.length, 1, p)
    const c = supers[0]
    assert.equal(c.id, `${p}-espadas-14`)
    assert.equal(c.naipe, 'espadas')
    assert.equal(c.custo, 10)
    assert.ok(c.descricao.startsWith('SUPER: '), c.id)
    assert.deepEqual(Object.keys(c).sort(), ['custo', 'descricao', 'id', 'naipe', 'nome', 'personagem', 'valor'])
    nomes.add(c.nome)
    const info = superDoPersonagem(p)
    assert.equal(info.nome, c.nome)
    assert.equal(info.descricao, c.descricao)
    assert.equal(info.cor, TEMAS[p].cor)
  }
  assert.equal(nomes.size, PERSONAGENS_PVP.length) // nome próprio para cada um
})

test('SUPER: ataque exclusivo (~9 s), dano 13, ritmo padrão, sem inverter', () => {
  const formatos = new Set()
  for (const p of PERSONAGENS_PVP) {
    const c = CARTAS[p].find(ehSuper)
    const ataque = ataqueDaCarta(c, { ataques: A })
    assert.ok(ataque, c.id)
    const ativa = ataque.filhos ? ataque.filhos.reduce((s, f) => s + f.ativa, 0) : ataque.ativa
    assert.ok(ativa >= 8500 && ativa <= 10500, `${c.id}: ativa ${ativa}`)
    assert.equal(danoDaCarta(c), 13)
    assert.deepEqual(ritmoDaCarta(c), { velocidade: DIFICULDADE_PVP.velocidade, densidade: DIFICULDADE_PVP.densidade })
    assert.equal(inverterDaCarta(c), 0)
    formatos.add(ataque.nome)
  }
  assert.equal(formatos.size, PERSONAGENS_PVP.length) // cada SUPER é diferente
})

test('SUPER é imune ao ♦ Anular (o Anular ainda manda o ataque leve)', () => {
  const e = partida('kris', 'susie')
  naMao(e, 0, 'kris-espadas-14')
  naMao(e, 1, 'susie-ouros-1')
  const r = resolverRodada(e, 'kris-espadas-14', 'susie-ouros-1')
  assert.equal(r.jogadas[0].anulada, false)
  assert.equal(r.jogadas[0].super, true)
  assert.equal(r.caixas[1].carta.id, 'kris-espadas-14')
  assert.equal(r.caixas[1].dano, 13)
  assert.equal(r.caixas[0].carta.id, 'susie-ouros-1')
  assert.equal(e.jogadores[0].energia, 0)
})

test('SUPER não é refletido pelo ♠ Espelho: o espelho manda o eco e o SUPER vai normal', () => {
  for (const ordem of [0, 1]) {
    const e = partida('kris', 'susie')
    const sup = ordem === 0 ? 'kris-espadas-14' : 'susie-espadas-14'
    const esp = ordem === 0 ? 'susie-espadas-1' : 'kris-espadas-1'
    const quemSuper = ordem
    naMao(e, quemSuper, sup)
    naMao(e, 1 - quemSuper, esp)
    const jog = quemSuper === 0 ? [sup, esp] : [esp, sup]
    const r = resolverRodada(e, ...jog)
    assert.equal(r.caixas[1 - quemSuper].carta.id, sup)
    assert.equal(r.caixas[1 - quemSuper].refletida, false)
    assert.equal(r.caixas[quemSuper].carta.id, esp) // eco
    assert.equal(r.caixas[quemSuper].refletida, false)
  }
})

test('dois SUPER: cada um vai para a caixa do adversário', () => {
  const e = partida('dess', 'asriel')
  naMao(e, 0, 'dess-espadas-14')
  naMao(e, 1, 'asriel-espadas-14')
  const r = resolverRodada(e, 'dess-espadas-14', 'asriel-espadas-14')
  assert.equal(r.caixas[0].carta.id, 'asriel-espadas-14')
  assert.equal(r.caixas[1].carta.id, 'dess-espadas-14')
})

test('SUPER custa 10: com 9 de energia não dá para jogar', () => {
  const e = partida('kris', 'susie', 9)
  naMao(e, 0, 'kris-espadas-14')
  assert.throws(() => resolverRodada(e, 'kris-espadas-14', null), /energia insuficiente/)
})

test('desvio perfeito: energia pela carta do ataque', () => {
  const carta = (naipe, valor) => ({ id: `kris-${naipe}-${valor}`, personagem: 'kris', naipe, valor })
  assert.equal(energiaPerfeito(null), 0)
  assert.equal(energiaPerfeito(carta('copas', 10)), 0)
  assert.equal(energiaPerfeito(carta('copas', 1)), 0) // segunda chance não manda ataque
  for (const v of [2, 5, 8]) assert.equal(energiaPerfeito(carta('espadas', v)), 1)
  for (const v of [9, 10, 11, 12]) assert.equal(energiaPerfeito(carta('paus', v)), 2)
  assert.equal(energiaPerfeito(carta('ouros', 13)), 3)
  assert.equal(energiaPerfeito(carta('espadas', 14)), 3)
  for (const n of ['espadas', 'ouros', 'paus']) assert.equal(energiaPerfeito(carta(n, 1)), 1)
})

test('registrarPerfeito respeita o teto de energia', () => {
  const e = partida('kris', 'susie', 5)
  assert.equal(registrarPerfeito(e, 0, CARTAS.susie.find((c) => c.valor === 13)), 3)
  assert.equal(e.jogadores[0].energia, 8)
  assert.equal(registrarPerfeito(e, 0, CARTAS.susie.find(ehSuper)), 2)
  assert.equal(e.jogadores[0].energia, ENERGIA.maxima)
  assert.equal(registrarPerfeito(e, 0, CARTAS.susie.find(ehSuper)), 0)
  assert.equal(registrarPerfeito(e, 1, null), 0)
  assert.equal(e.jogadores[1].energia, 5)
})

test('Asriel balanceado: 6 figuras, 5 por naipe, Sonho sem energia, HP menor no PvP', () => {
  const normais = CARTAS.asriel.filter((c) => !ehSuper(c))
  assert.equal(normais.filter((c) => c.valor >= 11).length, 6)
  for (const n of ['espadas', 'copas', 'ouros', 'paus']) assert.equal(normais.filter((c) => c.naipe === n).length, 5)
  const sonho = normais.find((c) => c.nome === 'Sonho')
  assert.ok(!sonho.descricao.includes('energia'))
  assert.ok(hpInicial('asriel') < (PERSONAGENS.asriel?.hp ?? 100))
  assert.equal(hpInicial('asriel'), Math.round((PERSONAGENS.asriel?.hp ?? 95) * PVP.fatorHp * PVP.ajusteHp.asriel))
})

test('bot: SUPER tem a maior nota e é jogado quando dá', () => {
  const e = partida('kris', 'susie', 10)
  const sup = naMao(e, 1, 'susie-espadas-14')
  const k = naMao(e, 1, 'susie-espadas-13')
  assert.ok(notaDaCarta(e, 1, sup) > notaDaCarta(e, 1, k) * 1.5)
  const rng = criarRng('bot-super')
  let jogou = 0
  for (let i = 0; i < 20; i++) if (escolherJogada(e, 1, { nivel: 'dificil', rng }) === 'susie-espadas-14') jogou++
  assert.ok(jogou >= 18, `jogou ${jogou}`)
})

test('bot: com o SUPER na mão e energia perto de 10, guarda energia em vez de jogar carta fraca', () => {
  const e = partida('kris', 'susie', 7)
  const b = e.jogadores[1].baralho
  b.monte.push(...b.mao.splice(0))
  naMao(e, 1, 'susie-espadas-14')
  naMao(e, 1, 'susie-espadas-2')
  naMao(e, 1, 'susie-ouros-3')
  const rng = criarRng('bot-guarda')
  assert.equal(escolherJogada(e, 1, { nivel: 'dificil', rng }), null)
})
