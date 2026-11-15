// node --test src/game/coop/__tests__/coop2.test.js
// CO-OP 2.0 (docs/coop-cartas.md "CO-OP 2.0"): a prévia da intenção, a barra de QUEBRA e o ATORDOADO, as
// cartas de dupla e o resgate na hora (as regras; o desenho é da arena)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarPartidaCoop, iniciarRodadaCoop, resolverRodadaCoop, aplicarDanoCoop, aplicarGolpe, fimDaRodadaCoop, resolverContraCoop, aplicarQuebraDoContra, resgatarNaHora, previaCoop, calcularGolpes, GOLPE, COOP } from '../regras.js'
import { QUEBRA, DUPLAS, ORDEM_DUPLAS, maxQuebra, somarQuebra, duplasDaResolucao, duplasDoContra, ganhosDeQuebra, finalizacaoDaDupla, atordoadoAgora } from '../coop2.js'
import { criarAlmas, posicaoDaAlma, RESGATE } from '../resgate.js'
import { CARTAS } from '../../pvp/cartas.js'
import { CARTAS_CHEFES } from '../cartasChefe.js'
import { escolherJogadaCoop } from '../bot.js'
import { criarRng } from '../../pvp/baralho.js'

const nova = (opcoes = {}) => criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'king', nivel: 'medio', semente: 'coop2', ...opcoes })
const carta = (id) => ({ ...CARTAS[id.split('-')[0]].find((c) => c.id === id) })
function naMao(estado, j, id) {
  const jog = estado.jogadores[j]
  jog.baralho.mao.push(carta(id))
  jog.energia = 10
  return id
}
const golpe = (id) => ({ carta: carta(id), tipo: carta(id).naipe, base: GOLPE[carta(id).naipe](carta(id).valor) })

// ---------- prévia da intenção (2 rodadas à frente) ----------

test('prévia: a próxima carta já está escolhida e é a que o chefe joga na rodada seguinte', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  const previa = previaCoop(e)
  assert.equal(previa.tipo, 'carta')
  assert.ok(e.chefe.intencao && e.chefe.proxima)
  assert.notEqual(e.chefe.proxima, e.chefe.intencao)
  const prometida = e.chefe.proxima.id
  resolverRodadaCoop(e, null, null)
  fimDaRodadaCoop(e)
  iniciarRodadaCoop(e)
  assert.equal(e.chefe.intencao.id, prometida)
  assert.ok(e.chefe.proxima)
})

test('prévia: determinística pela semente (a mesma fila em dois PCs)', () => {
  const fila = (semente) => {
    const e = nova({ semente })
    const ids = []
    for (let r = 0; r < 8; r++) {
      iniciarRodadaCoop(e)
      ids.push([e.chefe.intencao?.id ?? null, previaCoop(e)?.tipo, e.chefe.proxima?.id ?? null].join('/'))
      resolverRodadaCoop(e, null, null)
      fimDaRodadaCoop(e)
    }
    return ids
  }
  assert.deepEqual(fila('a'), fila('a'))
  assert.notDeepEqual(fila('a'), fila('b'))
})

test('prévia: avisa o SUPER do chefe uma rodada antes, e a carta prometida fica para depois dele', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  e.chefe.carga = e.chefe.cargaMax - 2 // a próxima rodada sobe para cargaMax - 1; a outra é o SUPER
  resolverRodadaCoop(e, null, null)
  fimDaRodadaCoop(e)
  iniciarRodadaCoop(e)
  assert.equal(previaCoop(e).tipo, 'super')
  const prometida = e.chefe.proxima.id
  resolverRodadaCoop(e, null, null)
  fimDaRodadaCoop(e)
  iniciarRodadaCoop(e)
  assert.equal(e.chefe.intencao.id, CARTAS_CHEFES.king.super.id)
  assert.equal(e.chefe.proxima.id, prometida)
})

test('prévia: a carta prometida vale mesmo depois da troca de fase (e não volta ao baralho novo)', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  const prometida = e.chefe.proxima
  assert.equal(prometida.fase, 0)
  resolverRodadaCoop(e, null, null)
  aplicarGolpe(e, Math.ceil(e.chefe.hpMax * 0.55))
  const fim = fimDaRodadaCoop(e)
  assert.equal(fim.novaFase, 1)
  iniciarRodadaCoop(e)
  assert.equal(e.chefe.intencao.id, prometida.id)
  resolverRodadaCoop(e, null, null)
  assert.ok(!e.chefe.descarte.some((c) => c.id === prometida.id), 'a carta da fase velha saiu do baralho')
  assert.ok(e.chefe.monte.every((c) => c.fase === 1))
})

// ---------- QUEBRA e ATORDOADO ----------

test('quebra: soma, para no máximo e cheia deixa o chefe atordoado', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  assert.equal(e.chefe.quebra, 0)
  assert.equal(e.chefe.quebraMax, maxQuebra(2))
  assert.deepEqual(somarQuebra(e, 30), { ganho: 30, quebrou: false })
  assert.deepEqual(somarQuebra(e, 0), { ganho: 0, quebrou: false })
  const r = somarQuebra(e, 500)
  assert.equal(r.quebrou, true)
  assert.equal(r.ganho, QUEBRA.max - 30)
  assert.equal(e.chefe.quebra, e.chefe.quebraMax)
  assert.equal(e.chefe.atordoado, true)
  // atordoado: não soma mais
  assert.deepEqual(somarQuebra(e, 10), { ganho: 0, quebrou: false })
})

test('quebra: o máximo cresce com o grupo (mais gente, mais CRÍTICOS)', () => {
  assert.equal(maxQuebra(2), QUEBRA.max)
  assert.ok(maxQuebra(3) > maxQuebra(2))
  assert.ok(maxQuebra(4) > maxQuebra(3))
  const e = criarPartidaCoop({ party: ['kris', 'susie', 'ralsei', 'noelle'], chefe: 'king', semente: 'g4' })
  assert.equal(e.chefe.quebraMax, maxQuebra(4))
})

test('quebra: os ganhos da rodada (juntos, CRÍTICOS e cartas de dupla)', () => {
  const lista = [
    { j: 0, dano: 30, falhou: false, multiplicadores: [['CRÍTICO', 1.5]] },
    { j: 1, dano: 20, falhou: false, multiplicadores: [] },
  ]
  assert.deepEqual(ganhosDeQuebra(lista), [
    { motivo: 'juntos', pontos: QUEBRA.juntos },
    { motivo: 'critico', pontos: QUEBRA.critico },
  ])
  // um só bateu (o outro caiu): sem "juntos"
  assert.deepEqual(ganhosDeQuebra([lista[0], { j: 1, dano: 0, falhou: true, multiplicadores: [] }]), [{ motivo: 'critico', pontos: QUEBRA.critico }])
  assert.deepEqual(
    ganhosDeQuebra([], [{ id: 'pinca' }, { id: 'combo' }]).map((g) => g.pontos),
    [DUPLAS.pinca.quebra, DUPLAS.combo.quebra],
  )
})

test('atordoado: a rodada seguinte não tem carta nem quadro, os golpes batem x1,5 e ela fecha com a finalização', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  resolverRodadaCoop(e, null, null)
  somarQuebra(e, 999)
  fimDaRodadaCoop(e)
  const carga = e.chefe.carga
  const proxima = e.chefe.proxima.id
  const eventos = iniciarRodadaCoop(e)
  assert.ok(eventos.some((ev) => ev.tipo === 'atordoado'))
  assert.equal(atordoadoAgora(e), true)
  assert.equal(e.chefe.intencao, null)
  assert.equal(e.chefe.carga, carga, 'a carga do SUPER não sobe na rodada atordoado')
  assert.equal(e.chefe.proxima.id, proxima, 'a próxima carta continua prometida')
  const r = resolverRodadaCoop(e, naMao(e, 0, 'kris-espadas-9'), null)
  assert.equal(r.atordoado, true)
  assert.equal(r.quadro, null)
  assert.equal(r.destino, null)
  const contra = resolverContraCoop(e, r.golpes, [])
  const g = contra.golpes[0]
  assert.equal(g.dano, Math.round(GOLPE.espadas(9) * QUEBRA.danoAtordoado))
  assert.ok(g.multiplicadores.some(([nome]) => nome === 'ATORDOADO'))
  assert.equal(contra.quebra.total, 0, 'a barra não enche na rodada atordoado')
  assert.deepEqual(contra.finalizacao, { dano: Math.round(e.chefe.hpMax * QUEBRA.finalizacao), jogadores: [0, 1] })
  fimDaRodadaCoop(e)
  assert.equal(e.chefe.atordoado, false)
  assert.equal(e.chefe.quebra, 0)
  iniciarRodadaCoop(e)
  assert.equal(e.chefe.intencao.id, proxima)
  assert.equal(previaCoop(e).tipo === 'atordoado', false)
})

test('atordoado: a prévia avisa assim que a barra enche', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  somarQuebra(e, 999)
  assert.equal(previaCoop(e).tipo, 'atordoado')
  assert.equal(finalizacaoDaDupla(e), null, 'a finalização só vem na rodada em que ele está parado')
})

test('contra-ataque: o convidado soma a mesma quebra que o host calculou', () => {
  const host = nova()
  iniciarRodadaCoop(host)
  const convidado = structuredClone(host)
  const r = resolverRodadaCoop(host, naMao(host, 0, 'kris-espadas-9'), naMao(host, 1, 'susie-paus-5'))
  const c = resolverContraCoop(host, r.golpes, [{ perfeito: true }, { perfeito: true }])
  assert.equal(c.quebra.total, QUEBRA.juntos + 2 * QUEBRA.critico + DUPLAS.pinca.quebra)
  aplicarQuebraDoContra(convidado, c.quebra)
  assert.equal(convidado.chefe.quebra, host.chefe.quebra)
  assert.equal(convidado.chefe.atordoado, host.chefe.atordoado)
})

// ---------- cartas de dupla ----------

test('cartas de dupla: a lista do Guia (3–4, curtas)', () => {
  assert.ok(ORDEM_DUPLAS.length >= 3 && ORDEM_DUPLAS.length <= 4)
  for (const id of ORDEM_DUPLAS) {
    const d = DUPLAS[id]
    assert.ok(d.nome && d.simbolos && d.curto, id)
    assert.ok(d.curto.length <= 45, `${id}: "${d.curto}" curto demais para a tela`)
  }
})

test('cartas de dupla: ATAQUE EM PINÇA (♠ + ♣) bate x1,3 nos dois golpes', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  const golpes = [golpe('kris-espadas-9'), golpe('susie-paus-5')]
  assert.deepEqual(duplasDoContra(golpes), [{ id: 'pinca', jogadores: [0, 1] }])
  const [a, b] = calcularGolpes(e, golpes, [])
  assert.equal(a.dano, Math.round(GOLPE.espadas(9) * DUPLAS.pinca.fator))
  assert.equal(b.dano, Math.round(GOLPE.paus(5) * DUPLAS.pinca.fator))
  // caído não fecha dupla; Ás e SUPER também não
  assert.deepEqual(duplasDoContra(golpes, [false, true]), [])
  assert.deepEqual(duplasDoContra([{ carta: carta('kris-espadas-1'), tipo: 'espelho' }, golpes[1]]), [])
  // mesmo naipe é COMBO e mesmo valor é PAR (como sempre)
  assert.deepEqual(duplasDoContra([golpe('kris-espadas-9'), golpe('susie-espadas-2')]), [{ id: 'combo', jogadores: [0, 1] }])
})

test('cartas de dupla: BARREIRA DUPLA (♥ + ♦) põe escudo de 50% nos dois para a esquiva', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  const r = resolverRodadaCoop(e, naMao(e, 0, 'kris-copas-3'), naMao(e, 1, 'susie-ouros-7'))
  assert.deepEqual(
    r.duplas.map((d) => d.id),
    ['barreira'],
  )
  assert.ok(r.quadro, 'o chefe atacou (a carta dele foi para o quadro)')
  for (const j of [0, 1]) assert.ok(r.quadro.escudos[j] <= DUPLAS.barreira.escudo, `escudo do ${j}`)
  assert.ok(r.quadro.danos[0] < r.quadro.dano || r.quadro.dano <= 1)
  assert.equal(e.chefe.quebra, DUPLAS.barreira.quebra)
  // ♥ + ♥ não é barreira
  assert.deepEqual(duplasDaResolucao([carta('kris-copas-3'), carta('susie-copas-5')], [true, true]), [])
  // quem está caído não fecha
  assert.deepEqual(duplasDaResolucao([carta('kris-copas-3'), carta('susie-ouros-7')], [true, false]), [])
})

test('cartas de dupla no grupo de 3–4: qualquer par entre os jogadores conta', () => {
  const golpes = [golpe('kris-espadas-9'), null, golpe('susie-paus-5'), golpe('kris-ouros-8')]
  assert.deepEqual(duplasDoContra(golpes), [{ id: 'pinca', jogadores: [0, 2] }])
  const quatro = [golpe('kris-espadas-9'), golpe('susie-espadas-2'), golpe('susie-paus-5'), golpe('kris-paus-7')]
  const ids = duplasDoContra(quatro).map((d) => `${d.id}:${d.jogadores.join('')}`)
  assert.deepEqual(ids, ['pinca:0123', 'combo:01', 'combo:23'])
  assert.deepEqual(duplasDaResolucao([null, carta('kris-copas-3'), null, carta('susie-ouros-7')], [true, true, true, true]), [{ id: 'barreira', jogadores: [1, 3] }])
})

test('CPU aliada: com a dica do parceiro (a carta em que ele está), fecha a carta de dupla', () => {
  const contar = (dica) => {
    let fechou = 0
    for (let i = 0; i < 20; i++) {
      const e = nova({ semente: `bot${i}` })
      iniciarRodadaCoop(e)
      const cpu = e.jogadores[1]
      cpu.baralho.mao = [carta('susie-paus-5'), carta('susie-ouros-7')]
      cpu.energia = 10
      if (escolherJogadaCoop(e, 1, { rng: criarRng(`b${i}`), dica }) === 'susie-paus-5') fechou++
    }
    return fechou
  }
  const com = contar({ carta: carta('kris-espadas-9') })
  assert.ok(com >= 18, `com a dica fechou a PINÇA ${com}/20`)
  assert.ok(com > contar(null))
})

// ---------- resgate na hora ----------

test('resgate: encostado RESGATE.tempoMs na alma levanta; o anel enche aos poucos', () => {
  const almas = criarAlmas()
  almas.adicionar(0, 100, 100)
  const perto = [{ j: 1, x: 105, y: 100, ativo: true }]
  assert.deepEqual(almas.atualizar(400, perto), [])
  assert.ok(Math.abs(almas.fracao(0) - 0.4) < 1e-9)
  assert.deepEqual(almas.atualizar(400, perto), [])
  assert.deepEqual(almas.atualizar(250, perto), [{ alvo: 0, quem: 1 }])
  assert.equal(almas.tem(0), false)
})

test('resgate: sair de perto cancela (um desvio rápido só pausa o anel)', () => {
  const almas = criarAlmas()
  almas.adicionar(0, 100, 100)
  const perto = [{ j: 1, x: 100, y: 110, ativo: true }]
  const longe = [{ j: 1, x: 160, y: 100, ativo: true }]
  almas.atualizar(600, perto)
  almas.atualizar(RESGATE.folgaMs - 50, longe)
  assert.ok(almas.fracao(0) > 0.5, 'pausou')
  almas.atualizar(100, longe)
  assert.equal(almas.fracao(0), 0, 'cancelou')
  // o próprio caído e corações inativos não contam
  almas.atualizar(2000, [{ j: 0, x: 100, y: 100, ativo: true }, { j: 1, x: 100, y: 100, ativo: false }])
  assert.equal(almas.fracao(0), 0)
})

test('resgate em rede: só o PC dono do salvador completa; os outros esperam a mensagem', () => {
  const almas = criarAlmas()
  almas.adicionar(0, 100, 100)
  const perto = [{ j: 1, x: 100, y: 100, ativo: true }]
  // o PC do caído (o coração 1 é espelho aqui): o anel quase fecha e para
  assert.deepEqual(almas.atualizar(5000, perto, { podeCompletar: () => false }), [])
  assert.ok(almas.fracao(0) < 1 && almas.fracao(0) >= 0.9)
  assert.ok(almas.tem(0))
})

test('resgate: levanta com 30% (como a volta sozinha), enche a quebra e repetido não faz nada', () => {
  const e = nova()
  iniciarRodadaCoop(e)
  aplicarDanoCoop(e, 0, 999)
  assert.equal(e.jogadores[0].caido, true)
  const r = resgatarNaHora(e, 0, 1)
  assert.equal(r.ok, true)
  assert.equal(e.jogadores[0].caido, false)
  assert.equal(e.jogadores[0].hp, Math.round(e.jogadores[0].hpMax * COOP.retornoHp))
  assert.equal(e.chefe.quebra, QUEBRA.resgate)
  assert.equal(resgatarNaHora(e, 0, 1).ok, false)
  // caído não salva ninguém
  aplicarDanoCoop(e, 0, 999)
  aplicarDanoCoop(e, 1, 999)
  assert.equal(resgatarNaHora(e, 0, 1).ok, false)
  // o ♥ que levanta também usa o mesmo piso (COOP.reviverMin = COOP.retornoHp)
  assert.equal(COOP.reviverMin, COOP.retornoHp)
})

test('resgate em rede: os dois PCs aplicam o mesmo resgate e ficam iguais', () => {
  const a = nova()
  iniciarRodadaCoop(a)
  aplicarDanoCoop(a, 0, 999)
  const b = structuredClone(a)
  resgatarNaHora(a, 0, 1) // o PC do salvador
  resgatarNaHora(b, 0, 1) // o outro, quando a mensagem chega
  assert.deepEqual(
    a.jogadores.map((j) => [j.hp, j.caido]),
    b.jogadores.map((j) => [j.hp, j.caido]),
  )
  assert.equal(a.chefe.quebra, b.chefe.quebra)
})

test('resgate: a alma fica dentro do quadro', () => {
  const l = { x: 100, y: 200, width: 300, height: 150 }
  assert.deepEqual(posicaoDaAlma(90, 400, l), { x: 100 + RESGATE.margem, y: 350 - RESGATE.margem })
  assert.deepEqual(posicaoDaAlma(200, 260, l), { x: 200, y: 260 })
})

test('coop2: false (a luta da campanha): sem prévia, sem QUEBRA e sem as cartas de dupla novas', () => {
  const e = nova({ coop2: false })
  iniciarRodadaCoop(e)
  assert.equal(e.chefe.proxima, null)
  const r = resolverRodadaCoop(e, naMao(e, 0, 'kris-copas-3'), naMao(e, 1, 'susie-ouros-7'))
  assert.deepEqual(r.duplas, [])
  assert.deepEqual(somarQuebra(e, 999), { ganho: 0, quebrou: false })
  const [a] = calcularGolpes(e, [golpe('kris-espadas-9'), golpe('susie-paus-5')], [])
  assert.equal(a.dano, GOLPE.espadas(9), 'sem PINÇA')
})
