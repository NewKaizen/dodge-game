// EXPEDIÇÃO (coop/expedicao.js) e as relíquias (coop/reliquias.js): node --test src/game/coop/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ETAPAS,
  LUTAS,
  CHEFOES,
  CURA_ENTRE,
  criarExpedicao,
  dadosDaLuta,
  terminarLuta,
  gerarOferta,
  resolverVotos,
  votoDaCpu,
  curaEntreLutas,
  escolherReliquia,
  rotaDa,
  expedicaoValida,
  relatoDaExpedicao,
} from '../expedicao.js'
import { RELIQUIAS, IDS_RELIQUIAS, MODS_PADRAO, curasDasReliquias, aplicarCurasDoContra } from '../reliquias.js'
import { CHEFES, CHEFES_DA_EXPEDICAO } from '../chefes/index.js'
import { criarPartidaCoop, iniciarRodadaCoop, calcularGolpes, resolverContraCoop, resgatarNaHora, aplicarDanoCoop, GOLPE, COOP, ETAPA_EXPEDICAO } from '../regras.js'
import { QUEBRA, finalizacaoDaDupla } from '../coop2.js'
import { CARTAS } from '../../pvp/cartas.js'

const golpe = (id) => {
  const c = CARTAS[id.split('-')[0]].find((x) => x.id === id)
  return { carta: c, tipo: c.naipe, base: GOLPE[c.naipe](c.valor) }
}

test('as lutas da expedição existem (lacaios, tenente e chefão de cada um) e ficam fora da seleção', () => {
  for (const c of CHEFOES) {
    for (const e of ETAPAS) assert.ok(CHEFES[LUTAS[c][e]], `${c}/${e}`)
    assert.ok(CHEFES_DA_EXPEDICAO.includes(LUTAS[c].lacaios) && CHEFES_DA_EXPEDICAO.includes(LUTAS[c].tenente))
  }
})

test('máquina de estados: 3 lutas, o HP passa, a cura entre as lutas, a relíquia acumula', () => {
  let exp = criarExpedicao({ chefe: 'queen', nivel: 'medio', party: ['kris', 'susie'], semente: 's1' })
  assert.deepEqual(exp.lutas, ['queenLacaios', 'queenTenente', 'queen'])
  assert.equal(exp.fase, 'luta')
  let d = dadosDaLuta(exp)
  assert.equal(d.chefe, 'queenLacaios')
  assert.equal(d.hp, null)
  assert.deepEqual(d.reliquias, [])
  assert.equal(d.nivel, 'medio')
  // 1ª luta vencida, um caído
  exp = terminarLuta(exp, { vitoria: true, hp: [40, 0], hpMax: [100, 120], tempoMs: 120000 })
  assert.equal(exp.fase, 'escolha')
  assert.equal(exp.vencidas, 1)
  assert.equal(exp.oferta.length, 3)
  const escolhida = exp.oferta[1]
  exp = escolherReliquia(exp, escolhida)
  assert.equal(exp.no, 1)
  assert.equal(exp.fase, 'luta')
  assert.deepEqual(exp.hp, [40 + Math.round(100 * CURA_ENTRE), Math.round(120 * CURA_ENTRE)], 'cura 25% do máx; quem caiu volta com isso')
  assert.deepEqual(exp.reliquias, [escolhida])
  d = dadosDaLuta(exp)
  assert.equal(d.chefe, 'queenTenente')
  assert.deepEqual(d.hp, exp.hp)
  // a luta seguinte começa com esse HP e a relíquia
  const e = criarPartidaCoop({ party: d.party, chefe: d.chefe, nivel: d.nivel, semente: d.semente, hp: d.hp, reliquias: d.reliquias })
  assert.equal(e.jogadores[0].hp, exp.hp[0])
  assert.deepEqual(e.reliquias, [escolhida])
  // 2ª luta vencida: a oferta não repete o que já tem
  exp = terminarLuta(exp, { vitoria: true, hp: [100, 100], hpMax: [100, 120] })
  assert.ok(!exp.oferta.includes(escolhida))
  exp = escolherReliquia(exp, exp.oferta[0])
  assert.equal(exp.reliquias.length, 2, 'acumula')
  assert.deepEqual(exp.hp, [100, 100 + Math.round(120 * CURA_ENTRE)].map((x, j) => Math.min([100, 120][j], x)), 'não passa do máximo')
  assert.equal(dadosDaLuta(exp).chefe, 'queen')
  // 3ª vencida: fim
  exp = terminarLuta(exp, { vitoria: true, hp: [10, 10], hpMax: [100, 120] })
  assert.equal(exp.fase, 'fim')
  assert.equal(exp.resultado, 'vitoria')
  assert.equal(exp.vencidas, 3)
  assert.deepEqual(relatoDaExpedicao(exp), { chefe: 'queen', lutas: 3, sorteada: false })
  assert.ok(JSON.parse(JSON.stringify(exp)).lutas.length === 3, 'serializável')
})

test('game over em qualquer luta acaba a expedição (até onde chegou)', () => {
  let exp = criarExpedicao({ chefe: 'coronel', party: ['kris', 'ralsei'], semente: 's2' })
  exp = terminarLuta(exp, { vitoria: true, hp: [50, 50], hpMax: [100, 100] })
  exp = escolherReliquia(exp, exp.oferta[0])
  exp = terminarLuta(exp, { vitoria: false, hp: [0, 0], hpMax: [100, 100] })
  assert.equal(exp.fase, 'fim')
  assert.equal(exp.resultado, 'derrota')
  assert.equal(exp.vencidas, 1)
  assert.equal(exp.no, 1, 'caiu no tenente')
  assert.deepEqual(relatoDaExpedicao(exp).lutas, 1)
  // escolher depois do fim não faz nada
  assert.equal(escolherReliquia(exp, 'amuleto'), exp)
})

test('oferta: pela semente (igual nos PCs), 3 diferentes, sem as que o time já tem', () => {
  assert.ok(IDS_RELIQUIAS.length >= 10 && IDS_RELIQUIAS.length <= 13)
  for (let k = 0; k < 50; k++) {
    const o = gerarOferta(`semente${k}`, k % 2)
    assert.equal(o.length, 3)
    assert.equal(new Set(o).size, 3)
    assert.deepEqual(gerarOferta(`semente${k}`, k % 2), o, 'determinística')
    const ja = o.slice(0, 2)
    const o2 = gerarOferta(`semente${k}`, 1, ja)
    assert.ok(o2.every((id) => !ja.includes(id)))
  }
  assert.notDeepEqual(gerarOferta('a', 0), gerarOferta('b', 0), 'sementes diferentes, ofertas diferentes (quase sempre)')
  assert.equal(gerarOferta('x', 0, IDS_RELIQUIAS.slice(1)).length, 1, 'acabaram as relíquias: só o que sobrou')
})

test('votos: maioria, empate pelo menor HP, relógio sem votos = sugestão', () => {
  const hp = [80, 20, 50]
  const hpMax = [100, 100, 100]
  assert.deepEqual(resolverVotos([2, 2, 0], { hp, hpMax }).escolha, 2)
  assert.equal(resolverVotos([2, 2, 0], { hp, hpMax }).motivo, 'maioria')
  // empate 1 x 1: vale o do jogador 1 (20% de HP)
  const r = resolverVotos([0, 1], { hp: [80, 20], hpMax: [100, 100] })
  assert.deepEqual([r.escolha, r.motivo, r.desempate], [1, 'empate', 1])
  // empate com HP proporcional (hpMax diferente)
  assert.equal(resolverVotos([0, 2], { hp: [30, 50], hpMax: [100, 200] }).escolha, 2)
  // só um votou (o outro deixou o relógio acabar): o voto dele é a maioria
  assert.equal(resolverVotos([null, 1], { hp, hpMax }).escolha, 1)
  // ninguém votou: a sugestão
  assert.deepEqual([resolverVotos([null, null], { sugestao: 2 }).escolha, resolverVotos([null, null], { sugestao: 2 }).motivo], [2, 'tempo'])
  // voto inválido não conta
  assert.equal(resolverVotos([7, -1, 'a'], { sugestao: 1 }).motivo, 'tempo')
  // 4 jogadores, 2 x 2: o mais machucado entre os que votaram nas empatadas
  assert.equal(resolverVotos([0, 0, 1, 1], { hp: [90, 60, 70, 10], hpMax: [100, 100, 100, 100] }).escolha, 1)
})

test('a CPU aliada vota com bom senso (defesa com o time machucado, ataque com o time inteiro)', () => {
  const oferta = ['lamina', 'casca', 'bateria']
  assert.equal(votoDaCpu(oferta, { hp: [100, 100], hpMax: [100, 100] }), 0)
  assert.equal(votoDaCpu(oferta, { hp: [20, 30], hpMax: [100, 100] }), 1)
  assert.equal(votoDaCpu(['bateria', 'amuleto', 'martelo'], { hp: [100, 100], hpMax: [100, 100] }), 0)
})

test('cura entre as lutas', () => {
  assert.deepEqual(curaEntreLutas([0, 50, 100], [100, 100, 100]), [25, 75, 100])
  assert.equal(curaEntreLutas(null, null), null)
})

test('SORTEADA: lacaios de um, tenente de outro, chefão surpresa (todos diferentes, pela semente)', () => {
  const vistos = new Set()
  for (let k = 0; k < 40; k++) {
    const r = rotaDa('sorteada', `s${k}`)
    assert.equal(new Set(r.origem).size, 3)
    assert.equal(r.chefao, r.origem[2])
    assert.deepEqual(r.lutas, [LUTAS[r.origem[0]].lacaios, LUTAS[r.origem[1]].tenente, r.origem[2]])
    assert.deepEqual(rotaDa('sorteada', `s${k}`), r)
    vistos.add(r.chefao)
  }
  assert.equal(vistos.size, 4, 'todo chefão pode ser a surpresa')
  const exp = criarExpedicao({ chefe: 'sorteada', semente: 'z' })
  assert.equal(exp.sorteada, true)
  assert.equal(exp.escolhido, 'sorteada')
  assert.ok(CHEFOES.includes(exp.chefao))
  assert.ok(expedicaoValida(exp))
  assert.ok(!expedicaoValida({ ...exp, no: 3 }))
  assert.ok(!expedicaoValida(null))
})

test('relíquias: 10 a 13, uma frase curta cada, e se acumulam', () => {
  for (const id of IDS_RELIQUIAS) {
    const r = RELIQUIAS[id]
    assert.equal(r.id, id)
    assert.ok(r.descricao.length <= 48, `${id}: frase curta (${r.descricao.length})`)
    assert.ok(['ataque', 'defesa', 'equipe'].includes(r.tipo))
    const e = criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'king', semente: 'r', reliquias: [id] })
    assert.notDeepEqual(e.mods, MODS_PADRAO(), `${id} muda alguma coisa`)
  }
  const e = criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'king', semente: 'r', reliquias: ['forca', 'lamina', 'forca'] })
  assert.deepEqual(e.reliquias, ['forca', 'lamina'], 'repetida não conta duas vezes')
  iniciarRodadaCoop(e)
  const [a] = calcularGolpes(e, [golpe('kris-espadas-9'), null], [])
  assert.equal(a.dano, Math.round(GOLPE.espadas(9) * 1.1 * 1.2), 'luva + lâmina no ♠')
  const [b] = calcularGolpes(e, [golpe('kris-ouros-8'), null], [])
  assert.equal(b.dano, Math.round(GOLPE.ouros(8) * 1.1), 'no ♦ só a luva')
})

test('relíquias: crítico, atordoado, finalização, energia, casca, fênix', () => {
  const nova = (reliquias) => {
    const e = criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'king', semente: 'r2', reliquias })
    iniciarRodadaCoop(e)
    return e
  }
  const m = nova(['mira'])
  const [c] = calcularGolpes(m, [golpe('kris-espadas-9'), null], [{ perfeito: true }])
  assert.equal(c.dano, Math.round(GOLPE.espadas(9) * Math.round(COOP.critico * 1.2 * 100) / 100))
  assert.ok(nova(['bateria']).jogadores[0].energia > nova([]).jogadores[0].energia)
  assert.ok(nova(['casca']).mods.danoQuadro < 1)
  // estrelinhas: atordoado x2
  const s = nova(['estrelinhas'])
  s.chefe.atordoado = true
  s.chefe.atordoadoEm = s.rodada
  const [g] = calcularGolpes(s, [golpe('kris-espadas-9'), null], [])
  assert.equal(g.dano, GOLPE.espadas(9) * 2)
  // martelo: finalização x2
  const f = nova(['martelo'])
  f.chefe.atordoado = true
  f.chefe.atordoadoEm = f.rodada
  assert.equal(finalizacaoDaDupla(f).dano, Math.round(f.chefe.hpMax * QUEBRA.finalizacao * 2))
  // fênix: o resgate levanta com 50%
  const x = nova(['fenix'])
  aplicarDanoCoop(x, 0, 999)
  const res = resgatarNaHora(x, 0, 1)
  assert.ok(res.ok)
  assert.equal(res.hp, Math.round(x.jogadores[0].hpMax * 0.5))
  const y = nova([])
  aplicarDanoCoop(y, 0, 999)
  assert.equal(resgatarNaHora(y, 0, 1).hp, Math.round(y.jogadores[0].hpMax * COOP.retornoHp))
})

test('relíquias de cura: grazes curam o parceiro, crítico cura quem bateu (com teto), rede igual', () => {
  const e = criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'king', semente: 'r3', hp: [50, 40], reliquias: ['laco', 'vampiro'] })
  iniciarRodadaCoop(e)
  const curas = curasDasReliquias(e, [{ grazes: 3 }, { perfeito: true }])
  assert.deepEqual(curas, [{ j: 1, hp: 7 }], 'P2 ganha 3 (grazes do P1) + 4 (o crítico dele)')
  assert.equal(e.jogadores[1].hp, 47)
  // no contra-ataque inteiro
  const e2 = criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'king', semente: 'r3', hp: [50, 40], reliquias: ['laco'] })
  iniciarRodadaCoop(e2)
  const d = resolverContraCoop(e2, [golpe('kris-espadas-9'), null], [{ grazes: 20 }, {}])
  assert.deepEqual(d.curas, [{ j: 1, hp: 6 }], 'no máximo 6 grazes contam')
  // o convidado aplica o mesmo
  const conv = criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'king', semente: 'r3', hp: [50, 40], reliquias: ['laco'] })
  aplicarCurasDoContra(conv, d.curas)
  assert.equal(conv.jogadores[1].hp, e2.jogadores[1].hp)
  // sem relíquia: nada
  const e3 = criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'king', semente: 'r3' })
  iniciarRodadaCoop(e3)
  assert.equal(resolverContraCoop(e3, [golpe('kris-espadas-9'), null], [{ grazes: 5, perfeito: true }, {}]).curas, undefined)
})

test('cada luta da Expedição aperta mais: o tenente e o chefão com mais vida, mais dano e o SUPER mais cedo', () => {
  const de = (etapa, reliquias = []) => criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'coronel', nivel: 'medio', semente: 'et', etapa, reliquias })
  const solta = de(null)
  const [lacaios, tenente, chefao] = ETAPAS.map((e) => de(e))
  assert.equal(lacaios.chefe.hpMax, solta.chefe.hpMax, 'os lacaios são a luta de sempre')
  assert.ok(tenente.chefe.hpMax > lacaios.chefe.hpMax && chefao.chefe.hpMax > tenente.chefe.hpMax)
  assert.ok(chefao.mods.danoQuadro > tenente.mods.danoQuadro && tenente.mods.danoQuadro > lacaios.mods.danoQuadro)
  assert.ok(chefao.chefe.cargaMax < COOP.cargaSuper && solta.chefe.cargaMax === COOP.cargaSuper, 'o chefão solta o SUPER mais vezes')
  // a etapa vale junto com as relíquias (a CASCA GROSSA continua tirando 15% do dano)
  assert.ok(Math.abs(de('chefao', ['casca']).mods.danoQuadro - 0.85 * ETAPA_EXPEDICAO.chefao.dano) < 1e-9)
})
