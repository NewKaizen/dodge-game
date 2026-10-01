// node --test src/game/pvp/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ENERGIA,
  PVP,
  criarPartida,
  iniciarRodada,
  podeJogar,
  cartasJogaveis,
  resolverRodada,
  aplicarDano,
  curar,
  registrarGrazes,
  checarVencedor,
  fimDaRodada,
  hpInicial,
} from '../regras.js'
import { danoDaCarta, efeitosDaCarta } from '../cartas.js'
import { PERSONAGENS } from '../../data/personagens.js'

// Põe uma carta específica na mão do jogador (tirando de onde estiver)
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
  const e = criarPartida({ p1, p2, semente: 'teste' })
  iniciarRodada(e)
  e.jogadores.forEach((j) => (j.energia = energia))
  return e
}

test('HP inicial vem de PERSONAGENS (com fator) ou da reserva', () => {
  assert.equal(hpInicial('kris'), Math.round(PERSONAGENS.kris.hp * PVP.fatorHp))
  assert.ok(hpInicial('dess') > 0)
  const e = criarPartida({ p1: 'kris', p2: 'asriel' })
  assert.equal(e.jogadores[0].hp, e.jogadores[0].hpMax)
})

test('estado é serializável e a partida é determinística', () => {
  const a = criarPartida({ p1: 'ralsei', p2: 'berdly', semente: 'x' })
  const b = criarPartida({ p1: 'ralsei', p2: 'berdly', semente: 'x' })
  iniciarRodada(a)
  iniciarRodada(b)
  assert.deepEqual(a, b)
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a)
})

test('energia: inicial, ganho por rodada, teto e grazes', () => {
  const e = criarPartida({ p1: 'kris', p2: 'susie' })
  iniciarRodada(e)
  assert.equal(e.jogadores[0].energia, ENERGIA.inicial)
  assert.equal(e.jogadores[0].baralho.mao.length, 5)
  resolverRodada(e, null, null) // os dois passam
  assert.equal(e.jogadores[0].energia, ENERGIA.inicial + ENERGIA.passar)
  fimDaRodada(e)
  iniciarRodada(e)
  assert.equal(e.jogadores[0].energia, ENERGIA.inicial + ENERGIA.passar + ENERGIA.porRodada)
  for (let k = 0; k < 10; k++) {
    resolverRodada(e, null, null)
    fimDaRodada(e)
    iniciarRodada(e)
  }
  assert.equal(e.jogadores[0].energia, ENERGIA.maxima)
  e.jogadores[1].energia = 0
  assert.equal(registrarGrazes(e, 1, ENERGIA.grazesPorPonto - 1), 0)
  assert.equal(registrarGrazes(e, 1, 1), 1)
  assert.equal(registrarGrazes(e, 1, ENERGIA.grazesPorPonto * 2 + 1), 2)
  assert.equal(e.jogadores[1].energia, 3)
  assert.equal(e.jogadores[1].grazes, 1)
})

test('validação: custo <= energia e carta na mão; jogada inválida não muda nada', () => {
  const e = partida('kris', 'susie', 2)
  const k = naMao(e, 0, 'kris-espadas-13') // custo 5
  const barata = naMao(e, 0, 'kris-espadas-3') // custo 1
  assert.equal(podeJogar(e, 0, k.id).ok, false)
  assert.match(podeJogar(e, 0, k.id).motivo, /energia/)
  assert.equal(podeJogar(e, 0, barata.id).ok, true)
  assert.equal(podeJogar(e, 0, 'kris-paus-99').ok, false)
  assert.equal(podeJogar(e, 0, null).ok, true)
  assert.ok(cartasJogaveis(e, 0).every((c) => c.custo <= 2))
  const antes = JSON.stringify(e)
  assert.throws(() => resolverRodada(e, k.id, null), /energia/)
  assert.equal(JSON.stringify(e), antes)
})

test('rodada normal: carta do P1 vai para a caixa do P2 e vice-versa; paga energia e descarta', () => {
  const e = partida()
  const c1 = naMao(e, 0, 'kris-espadas-9')
  const c2 = naMao(e, 1, 'susie-paus-5')
  const r = resolverRodada(e, c1.id, { carta: c2.id })
  assert.equal(r.caixas[1].carta.id, c1.id)
  assert.equal(r.caixas[1].de, 0)
  assert.equal(r.caixas[1].dano, danoDaCarta(c1))
  assert.equal(r.caixas[0].carta.id, c2.id)
  assert.equal(e.jogadores[0].energia, 10 - c1.custo)
  assert.ok(e.jogadores[0].baralho.descarte.some((c) => c.id === c1.id))
  assert.ok(!e.jogadores[0].baralho.mao.some((c) => c.id === c1.id))
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r) // resultado serializável
})

test('copas aplica em quem jogou: cura, escudo, energia, compra extra', () => {
  const e = partida('ralsei', 'susie')
  e.jogadores[0].hp = 30
  const cura = naMao(e, 0, 'ralsei-copas-13') // cura + escudo
  const atk = naMao(e, 1, 'susie-espadas-10')
  const r = resolverRodada(e, cura.id, atk.id)
  const ef = efeitosDaCarta(cura)
  assert.equal(e.jogadores[0].hp, 30 + ef.cura)
  assert.equal(r.efeitos[0].cura, ef.cura)
  assert.equal(e.jogadores[1].hp, e.jogadores[1].hpMax) // não cura o adversário
  // o escudo vale já para o ataque desta rodada e é gasto
  assert.equal(r.caixas[0].dano, Math.max(1, Math.ceil(danoDaCarta(atk) * ef.escudo)))
  assert.equal(r.caixas[0].escudo, ef.escudo)
  assert.equal(e.jogadores[0].escudo, null)
  // copas manda só um ataque fraquinho
  assert.equal(r.caixas[1].dano, 2)
  fimDaRodada(e)

  // energia e compra extra
  iniciarRodada(e)
  e.jogadores[0].energia = 5
  const pac = naMao(e, 0, 'ralsei-copas-12') // energia + compra (custo 4)
  const mao = e.jogadores[0].baralho.mao.length
  const r2 = resolverRodada(e, pac.id, null)
  assert.equal(e.jogadores[0].energia, 5 - 4 + efeitosDaCarta(pac).energia)
  assert.equal(r2.efeitos[0].compradas.length, efeitosDaCarta(pac).compra)
  assert.equal(e.jogadores[0].baralho.mao.length, mao - 1 + efeitosDaCarta(pac).compra)
})

test('escudo sem ataque recebido fica guardado para a próxima rodada', () => {
  const e = partida('noelle', 'kris')
  const esc = naMao(e, 0, 'noelle-copas-8')
  const r = resolverRodada(e, esc.id, null)
  assert.equal(r.caixas[0], null)
  assert.equal(e.jogadores[0].escudo, efeitosDaCarta(esc).escudo)
  fimDaRodada(e)
  iniciarRodada(e)
  e.jogadores[1].energia = 10
  const atk = naMao(e, 1, 'kris-espadas-9')
  const r2 = resolverRodada(e, null, atk.id)
  assert.equal(r2.caixas[0].dano, Math.ceil(danoDaCarta(atk) * 0.5))
  assert.equal(e.jogadores[0].escudo, null)
})

test('Ás ♠ espelho devolve o ataque do adversário para a caixa dele', () => {
  const e = partida('kris', 'susie')
  const esp = naMao(e, 0, 'kris-espadas-1')
  const k = naMao(e, 1, 'susie-espadas-13')
  const r = resolverRodada(e, esp.id, k.id)
  assert.equal(r.caixas[0], null) // quem espelhou não desvia nada
  assert.equal(r.caixas[1].carta.id, k.id)
  assert.equal(r.caixas[1].refletida, true)
  assert.equal(r.caixas[1].de, 1)
  assert.equal(r.caixas[1].dano, danoDaCarta(k))
})

test('Ás ♠ espelho sem nada para refletir manda um eco; dois espelhos = dois ecos', () => {
  const e = partida('kris', 'susie')
  const esp = naMao(e, 0, 'kris-espadas-1')
  const r = resolverRodada(e, esp.id, null)
  assert.equal(r.caixas[1].carta.id, esp.id)
  assert.equal(r.caixas[1].refletida, false)
  assert.ok(r.caixas[1].dano > 0)
  fimDaRodada(e)
  iniciarRodada(e)
  e.jogadores.forEach((j) => (j.energia = 10))
  const e1 = naMao(e, 0, 'kris-espadas-1')
  const e2 = naMao(e, 1, 'susie-espadas-1')
  const r2 = resolverRodada(e, e1.id, e2.id)
  assert.equal(r2.caixas[1].carta.id, e1.id)
  assert.equal(r2.caixas[0].carta.id, e2.id)
})

test('Ás ♦ anular cancela a carta adversária inteira (inclusive suporte e especial)', () => {
  const e = partida('berdly', 'ralsei')
  e.jogadores[1].hp = 20
  const an = naMao(e, 0, 'berdly-ouros-1')
  const cura = naMao(e, 1, 'ralsei-copas-13')
  const r = resolverRodada(e, an.id, cura.id)
  assert.equal(r.jogadas[1].anulada, true)
  assert.equal(e.jogadores[1].hp, 20) // não curou
  assert.equal(e.jogadores[1].escudo, null)
  assert.equal(r.caixas[0], null) // o ataque fraco dela também sumiu
  assert.equal(r.caixas[1].carta.id, an.id) // anular manda um ataque leve
  assert.equal(e.jogadores[1].energia, 10 - cura.custo) // a energia foi gasta mesmo assim
  fimDaRodada(e)

  // anular cancela o espelho; dois anular se cancelam
  iniciarRodada(e)
  e.jogadores.forEach((j) => (j.energia = 10))
  const an2 = naMao(e, 0, 'berdly-ouros-1')
  const esp = naMao(e, 1, 'ralsei-espadas-1')
  const r2 = resolverRodada(e, an2.id, esp.id)
  assert.equal(r2.caixas[0], null)
  assert.equal(r2.caixas[1].carta.id, an2.id)
  fimDaRodada(e)
  iniciarRodada(e)
  e.jogadores.forEach((j) => (j.energia = 10))
  const a1 = naMao(e, 0, 'berdly-ouros-1')
  const a2 = naMao(e, 1, 'ralsei-ouros-1')
  const r3 = resolverRodada(e, a1.id, a2.id)
  assert.deepEqual(r3.caixas, [null, null])
  assert.ok(r3.jogadas.every((j) => j.anulada))
})

test('Ás ♣ roubo pega uma carta da mão do outro (e é determinístico)', () => {
  const rodar = () => {
    const e = partida('dess', 'kris')
    const rb = naMao(e, 0, 'dess-paus-1')
    const atk = naMao(e, 1, 'kris-espadas-3')
    const maoAntes = e.jogadores[1].baralho.mao.length
    const r = resolverRodada(e, rb.id, atk.id)
    return { e, r, maoAntes }
  }
  const { e, r, maoAntes } = rodar()
  const roubada = r.efeitos[0].roubou
  assert.ok(roubada)
  assert.equal(r.efeitos[1].perdeu, roubada)
  assert.equal(e.jogadores[1].baralho.mao.length, maoAntes - 2) // jogou 1 e perdeu 1
  assert.ok(e.jogadores[0].baralho.mao.some((c) => c.id === roubada))
  assert.ok(e.jogadores[0].baralho.mao.find((c) => c.id === roubada).personagem === 'kris')
  assert.equal(r.caixas[1].carta.id, 'dess-paus-1') // manda ataque leve
  assert.equal(rodar().r.efeitos[0].roubou, roubada)
})

test('roubo entre dois iguais não duplica id', () => {
  const e = partida('kris', 'kris')
  naMao(e, 0, 'kris-paus-1')
  // a mão do P2 fica só com uma carta que o P1 também tem
  const b2 = e.jogadores[1].baralho
  b2.monte.push(...b2.mao.splice(0))
  naMao(e, 1, 'kris-espadas-9')
  const r = resolverRodada(e, 'kris-paus-1', null)
  assert.equal(r.efeitos[0].roubou, 'kris-espadas-9~r1')
  const b1 = e.jogadores[0].baralho
  const ids = [...b1.monte, ...b1.mao, ...b1.descarte].map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('Ás ♥ segunda chance: cura forte e não deixa cair nesta rodada', () => {
  const e = partida('noelle', 'susie')
  const j = e.jogadores[0]
  j.hp = 10
  const sc = naMao(e, 0, 'noelle-copas-1')
  const k = naMao(e, 1, 'susie-espadas-13')
  const r = resolverRodada(e, sc.id, k.id)
  const cura = Math.round(j.hpMax * PVP.segundaChance)
  assert.equal(j.hp, 10 + cura)
  assert.equal(r.efeitos[0].segundaChance, true)
  assert.equal(r.caixas[1], null) // não manda ataque
  assert.ok(r.caixas[0]) // mas recebe o do outro
  aplicarDano(e, 0, 999)
  assert.equal(j.hp, 1)
  assert.equal(fimDaRodada(e), null)
  assert.equal(j.protegido, false)
  aplicarDano(e, 0, 5)
  assert.equal(j.hp, 0)
})

test('dano, cura e fim de jogo por HP corrido', () => {
  const e = partida()
  const [a, b] = e.jogadores
  assert.equal(aplicarDano(e, 0, 7), 7)
  assert.equal(a.hp, a.hpMax - 7)
  assert.equal(curar(e, 0, 100), 7)
  assert.equal(a.hp, a.hpMax)
  assert.equal(checarVencedor(e), null)
  aplicarDano(e, 1, b.hp + 50)
  assert.equal(b.hp, 0)
  assert.equal(fimDaRodada(e), 'p1')
  assert.equal(e.fase, 'fim')
  assert.throws(() => resolverRodada(e, null, null), /acabou/)
  const e2 = partida()
  aplicarDano(e2, 0, 999)
  aplicarDano(e2, 1, 999)
  assert.equal(fimDaRodada(e2), 'empate')
})

test('partida simulada até o fim sem erros (jogadas aleatórias válidas)', () => {
  for (const [p1, p2] of [['kris', 'susie'], ['ralsei', 'dess'], ['noelle', 'berdly'], ['asriel', 'asriel']]) {
    const e = criarPartida({ p1, p2, semente: `sim-${p1}-${p2}` })
    let rodadas = 0
    while (!e.vencedor && rodadas < 80) {
      iniciarRodada(e)
      const jog = [0, 1].map((j) => {
        const op = cartasJogaveis(e, j).sort((x, y) => y.custo - x.custo)
        return op[0]?.id ?? null
      })
      const r = resolverRodada(e, jog[0], jog[1])
      // simula 3 acertos por caixa
      r.caixas.forEach((c, j) => c && [1, 2, 3].forEach(() => aplicarDano(e, j, c.dano)))
      fimDaRodada(e)
      rodadas++
      for (const j of e.jogadores) {
        const b = j.baralho
        assert.ok(j.energia >= 0 && j.energia <= ENERGIA.maxima)
        assert.ok(b.mao.length <= 7)
      }
    }
    assert.ok(e.vencedor, `${p1} x ${p2} terminou em ${rodadas} rodadas`)
    assert.deepEqual(JSON.parse(JSON.stringify(e)), e)
  }
})
