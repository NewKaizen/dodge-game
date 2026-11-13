// node --test src/game/__tests__/cosmeticosSlots.test.js
// A ponte entre as partidas e o conteúdo dos cosméticos (src/game/cosmeticosSlots.js): um registro que
// falha (lança, rejeita, demora, devolve lixo) NUNCA joga erro na partida e cai no padrão; os cosméticos
// de cada lado saem do que o lobby repassa (conta.cosmeticos).
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import * as S from '../cosmeticosSlots.js'
import { EQUIPADOS_PADRAO } from '../../lib/cosmeticos.js'

const cena = { nome: 'cena de mentira' }
const avisos = console.warn
afterEach(() => {
  S.definirRegistro(null)
  console.warn = avisos
})
const calar = () => (console.warn = () => {})

test('sem registro: tudo no padrão, sem erro', async () => {
  S.definirRegistro(null)
  let padrao = 0
  S.tocarDano(cena, 'dano-latido', () => padrao++)
  assert.equal(padrao, 1)
  assert.deepEqual(Object.keys(S.efeitoNaCarta(cena, {}, 'efeito-chamas')), ['destroy'])
  assert.equal(await S.lancar(cena, { x: 0, y: 0, alvoX: 1, alvoY: 1 }, 'lancamento-raio'), false)
  assert.equal(S.molduraAnimada(cena, 0, 0, 10, 'moldura-anim-fogo'), null)
  assert.equal(S.previaDe(cena, 'som', 'dano-latido', 0, 0, 10), null)
})

test('registro que LANÇA em tudo: nada escapa, o som de sempre toca', async () => {
  calar()
  const explode = () => {
    throw new Error('bum')
  }
  S.definirRegistro({ tocarSomDano: explode, aplicarEfeitoCarta: explode, animarLancamento: explode, desenharMoldura: explode, previa: explode })
  let padrao = 0
  assert.doesNotThrow(() => S.tocarDano(cena, 'dano-latido', () => padrao++))
  assert.equal(padrao, 1, 'falhou: toca o padrão')
  assert.doesNotThrow(() => S.efeitoNaCarta(cena, { once() {} }, 'efeito-chamas').destroy())
  assert.equal(await S.lancar(cena, {}, 'lancamento-raio'), false)
  assert.equal(S.molduraAnimada(cena, 0, 0, 10, 'moldura-anim-fogo'), null)
  assert.equal(S.previaDe(cena, 'efeito', 'efeito-chamas', 0, 0, 10), null)
  // até o "som de sempre" falhando não derruba
  assert.doesNotThrow(() => S.tocarDano(cena, 'dano-padrao', explode))
})

test('lançamento que rejeita ou nunca termina: a promessa resolve mesmo assim', async () => {
  calar()
  S.definirRegistro({ animarLancamento: () => Promise.reject(new Error('não')) })
  assert.equal(await S.lancar(cena, {}, 'lancamento-raio'), false)
  S.definirRegistro({ animarLancamento: () => new Promise(() => {}) })
  const t0 = Date.now()
  assert.equal(await S.lancar(cena, {}, 'lancamento-raio'), false)
  assert.ok(Date.now() - t0 >= S.LANCAR_MAX_MS - 50)
  S.definirRegistro({ animarLancamento: (_c, o, id) => Promise.resolve([o, id]) })
  assert.equal(await S.lancar(cena, { x: 1 }, 'lancamento-raio'), true)
})

test('registro bom: chama com o id certo; padrão não chama; efeito some com a carta', async () => {
  const chamadas = []
  let destruidos = 0
  S.definirRegistro({
    tocarSomDano: (_c, id) => chamadas.push(['som', id]),
    aplicarEfeitoCarta: (_c, alvo, id) => (chamadas.push(['efeito', id]), { destroy: () => destruidos++ }),
    animarLancamento: (_c, o, id) => (chamadas.push(['lancar', id, o.alvoX]), Promise.resolve()),
    desenharMoldura: (_c, x, y, t, id) => ({ moldura: id }),
    previa: (_c, tipo, id) => ({ destroy() {}, tocar: () => chamadas.push(['previa', tipo, id]) }),
  })
  let padrao = 0
  S.tocarDano(cena, 'dano-padrao', () => padrao++)
  S.tocarDano(cena, null, () => padrao++)
  S.tocarDano(cena, 'dano-latido', () => padrao++)
  assert.equal(padrao, 2)
  const ouvintes = {}
  const carta = { once: (ev, fn) => (ouvintes[ev] = fn) }
  S.efeitoNaCarta(cena, carta, 'efeito-nenhum')
  S.efeitoNaCarta(cena, carta, 'efeito-chamas')
  ouvintes.destroy()
  ouvintes.destroy()
  assert.equal(destruidos, 1)
  const lados = [{ lancamento: 'lancamento-padrao' }, { lancamento: 'lancamento-raio' }]
  assert.equal(await S.lancarDoLado({ cosmeticos: lados }, 0, { x: 0, y: 0 }, { x: 5, y: 5 }), false)
  assert.equal(await S.lancarDoLado({ cosmeticos: lados }, 1, { x: 0, y: 0 }, { x: 5, y: 5 }), true)
  assert.deepEqual(S.molduraAnimada(cena, 0, 0, 10, 'moldura-anim-fogo'), { moldura: 'moldura-anim-fogo' })
  S.previaDe(cena, 'som', 'dano-latido', 0, 0, 10).tocar()
  assert.deepEqual(chamadas, [['som', 'dano-latido'], ['efeito', 'efeito-chamas'], ['lancar', 'lancamento-raio', 5], ['previa', 'som', 'dano-latido']])
  // somDoLado lê cena.cosmeticos
  S.somDoLado({ cosmeticos: [{ som: 'dano-pato' }] }, 0, () => padrao++)
  S.somDoLado({ cosmeticos: null }, 3, () => padrao++)
  assert.equal(padrao, 3)
  assert.deepEqual(chamadas.at(-1), ['som', 'dano-pato'])
})

const membro = (papel, vaga, cosmeticos) => ({ papel, vaga, conta: cosmeticos === undefined ? null : { tag: 'x', cosmeticos } })

test('os cosméticos de cada lado: em rede os do lobby, fora dela o de quem está logado', () => {
  const sala = { membros: [membro('convidado', 1, { som: 'som.latido', efeito: null, lancamento: 'lancamento.raio', moldura: 'moldura.anim_fogo' }), membro('host', 0, { som: 'som.inventado', efeito: 'efeito.chamas' })] }
  const dois = S.cosmeticosDosLados({ sala, n: 2, emRede: true })
  assert.deepEqual(dois[0], { ...EQUIPADOS_PADRAO, efeito: 'efeito-chamas' }, 'id desconhecido vira o padrão')
  assert.deepEqual(dois[1], { som: 'dano-latido', efeito: 'efeito-nenhum', lancamento: 'lancamento-raio', moldura: 'moldura-anim-fogo', frente: 'frente-classica' })
  // convidado (sem conta) do outro lado: padrão
  const comConvidado = S.cosmeticosDosLados({ sala: { membros: [membro('host', 0, { som: 'som.pato' }), membro('convidado', 1)] }, n: 2, emRede: true })
  assert.deepEqual(comConvidado[1], EQUIPADOS_PADRAO)
  // fora da rede: o lado 0 é a conta logada, o resto o padrão (CPU, 2º jogador do mesmo PC)
  const local = S.cosmeticosDosLados({ perfil: { som_equipado: 'som.sino' }, n: 2 })
  assert.equal(local[0].som, 'dano-sino')
  assert.deepEqual(local[1], EQUIPADOS_PADRAO)
  assert.deepEqual(S.cosmeticosDosLados({ n: 1 }), [EQUIPADOS_PADRAO], 'convidado: padrão')
  // salas de N: pelo índice da vaga
  const n = S.cosmeticosDosParticipantes([{ indice: 2, conta: { cosmeticos: { efeito: 'efeito.bolhas' } } }, { indice: 0, conta: null }, { indice: 9, conta: { cosmeticos: { som: 'som.pato' } } }], 3)
  assert.equal(n[2].efeito, 'efeito-bolhas')
  assert.deepEqual(n[0], EQUIPADOS_PADRAO)
  assert.equal(n.length, 3)
})

// quando o conteúdo (src/game/cosmeticos/registro.js) existe: os ids e as raridades do catálogo do baú
// (src/lib/cosmeticos.js, o banco) batem com os do conteúdo
test('o catálogo do baú bate com o registro do conteúdo', async (t) => {
  let reg
  try {
    reg = await import('../cosmeticos/registro.js')
  } catch {
    return t.skip('src/game/cosmeticos/registro.js ainda não existe')
  }
  const { ITENS_SLOTS, PADRAO_REGISTRO } = await import('../../lib/cosmeticos.js')
  const listas = { som: reg.SONS_DANO, efeito: reg.EFEITOS_CARTA, lancamento: reg.LANCAMENTOS, moldura: reg.MOLDURAS_ANIMADAS, frente: reg.ESTILOS_FRENTE }
  // os versos ilustrados não têm "padrão" na lista (o padrão é o verso liso de sempre)
  const versos = reg.VERSOS_ILUSTRADOS.map((i) => `${i.id}:${i.raridade}`).sort()
  assert.deepEqual(ITENS_SLOTS.filter((i) => i.slot === 'verso').map((i) => `${i.registro}:${i.raridade}`).sort(), versos, 'verso')
  for (const [slot, lista] of Object.entries(listas)) {
    assert.equal(lista[0].id, PADRAO_REGISTRO[slot], `padrão de ${slot}`)
    const doConteudo = lista.slice(1).map((i) => `${i.id}:${i.raridade}`).sort()
    const doBau = ITENS_SLOTS.filter((i) => i.slot === slot).map((i) => `${i.registro}:${i.raridade}`).sort()
    assert.deepEqual(doBau, doConteudo, slot)
  }
})

// ESTILOS DE CARTA e VERSOS ILUSTRADOS (0016): o estilo que falha NUNCA quebra a carta (a Carta cai na clássica)
test('frenteNaCarta / versoNaCarta: padrão e sem registro = false; erro = false (sem lançar)', () => {
  calar()
  const carta = { montarFrente() {}, verso: { add() {} } }
  S.definirRegistro(null)
  assert.equal(S.frenteNaCarta(cena, carta, 'frente-tarot'), false)
  assert.equal(S.versoNaCarta(cena, carta, 'verso-galaxia'), false)
  const chamadas = []
  S.definirRegistro({ desenharFrente: (...a) => (chamadas.push(a[2]), true), desenharVerso: () => true, miniatura: () => 'mini' })
  assert.equal(S.frenteNaCarta(cena, carta, 'frente-classica'), false, 'a clássica nem chama o conteúdo')
  assert.equal(S.frenteNaCarta(cena, carta, null), false)
  assert.equal(S.frenteNaCarta(cena, carta, 'frente-tarot'), true)
  assert.deepEqual(chamadas, ['frente-tarot'])
  assert.equal(S.versoNaCarta(cena, carta, 'verso-galaxia'), true)
  assert.equal(S.miniaturaDe({ textures: { exists: () => true } }, 'frente', 'frente-tarot'), 'mini')
  assert.equal(S.miniaturaDe({ textures: { exists: () => false } }, 'frente', 'frente-tarot'), null, 'textura que não existe')
  const explode = () => {
    throw new Error('bum')
  }
  S.definirRegistro({ desenharFrente: explode, desenharVerso: explode, miniatura: explode })
  assert.doesNotThrow(() => assert.equal(S.frenteNaCarta(cena, carta, 'frente-tarot'), false))
  assert.doesNotThrow(() => assert.equal(S.versoNaCarta(cena, carta, 'verso-galaxia'), false))
  assert.equal(S.miniaturaDe(cena, 'frente', 'frente-tarot'), null)
  S.definirRegistro({ desenharFrente: () => 'lixo' })
  assert.equal(S.frenteNaCarta(cena, carta, 'frente-tarot'), false, 'só true conta como desenhado')
})

test('o estilo da frente viaja pelo lobby (conta.cosmeticos.frente) e vira o id do registro', () => {
  const sala = {
    membros: [
      { papel: 'host', conta: { cosmeticos: { frente: 'frente.tarot' } } },
      { papel: 'convidado', conta: { cosmeticos: { frente: 'frente.inventada' } } },
    ],
  }
  const lados = S.cosmeticosDosLados({ sala, n: 2, emRede: true })
  assert.equal(lados[0].frente, 'frente-tarot')
  assert.equal(lados[1].frente, 'frente-classica', 'id desconhecido = a clássica')
  assert.equal(S.cosmeticosDosLados({ perfil: { frente_equipada: 'frente.dark' }, n: 2 })[0].frente, 'frente-dark')
})
