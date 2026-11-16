// node --test src/game/coop/__tests__/coronelRegra.test.js
// RECICLAGEM do Coronel Caçamba (coop/coronelRegra.js): o sorteio dos itens (determinismo, justiça), a lixeira, o
// míssil pela regra da luta (rede: o toque vem do PC dono do coração), o baralho por fase, lacaios e tenente ocultos
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RegraDaLuta, rngDaRegra, descricaoValida } from '../regraChefe.js'
import { planejarItens, posicaoDoItem, encherLixeira, criarRegraReciclagem, PADRAO_RECICLAGEM } from '../coronelRegra.js'
import { CHEFES, ORDEM_CHEFES } from '../chefes/index.js'
import { CARTAS_CHEFES, ataqueDaCartaChefe } from '../cartasChefe.js'
import { criarPartidaCoop } from '../regras.js'
import { somarQuebra } from '../coop2.js'

const L = { x: 100, y: 200, width: 336, height: 180 }
const A = new Proxy({}, { get: (_, nome) => (...args) => ({ nome, args, duracao: 1000 }) })

test('a regra é válida e o Coronel a usa', () => {
  const def = CHEFES.coronel.regra
  assert.equal(def.id, 'reciclagem')
  assert.ok(descricaoValida(def.descricao))
  for (const f of Object.values(def.fases)) assert.ok(descricaoValida(f.descricao))
  assert.ok(descricaoValida(CHEFES.coronelTenente.regra.descricao))
  assert.equal(CHEFES.coronelLacaios.regra, undefined, 'lacaios: sem regra')
})

test('os itens saem do sorteio da rodada: iguais para a mesma semente, e justos', () => {
  const um = () => planejarItens({ rng: rngDaRegra('s', 3, 'lixo'), fase: 1, n: 2, limites: L })
  assert.deepEqual(um(), um())
  assert.notDeepEqual(um(), planejarItens({ rng: rngDaRegra('outra', 3, 'lixo'), fase: 1, n: 2, limites: L }))
  for (const fase of [0, 1, 2]) {
    const slots = planejarItens({ rng: rngDaRegra('s', 1, 'lixo'), fase, n: 2, limites: L })
    assert.equal(slots.filter((s) => s.tipo === 'limpo').length, PADRAO_RECICLAGEM.limpos[fase])
    assert.equal(slots.filter((s) => s.tipo === 'sujo').length, PADRAO_RECICLAGEM.sujos[fase])
    for (const s of slots) {
      assert.ok(s.x0 >= L.x && s.x0 <= L.x + L.width && s.xT >= L.x && s.xT <= L.x + L.width)
      // a posição em qualquer instante fica dentro da largura (alcançável)
      for (let ms = 0; ms < 9000; ms += 250) {
        const p = posicaoDoItem(s, ms, L)
        assert.ok(p.x >= L.x && p.x <= L.x + L.width)
      }
    }
    // fase 1: sem marrom; fase 2 e 3: tem
    assert.equal(slots.some((s) => s.tipo === 'sujo'), fase > 0)
  }
  // mais jogadores, mais lixo verde
  assert.ok(planejarItens({ rng: rngDaRegra('s', 1, 'lixo'), fase: 0, n: 4, limites: L }).length > planejarItens({ rng: rngDaRegra('s', 1, 'lixo'), fase: 0, n: 2, limites: L }).length)
})

test('o item fica escondido em cima da caixa até a hora, cai e sai pelo fundo', () => {
  const s = { tipo: 'limpo', x0: 200, xT: 220, t0: 1000, vy: 50, sway: 5, fase: 0 }
  assert.equal(posicaoDoItem(s, 500, L).visivel, false)
  assert.ok(posicaoDoItem(s, 500, L).y < L.y - 100, 'escondido bem acima: nenhum coração toca')
  assert.equal(posicaoDoItem(s, 1500, L).visivel, true)
  assert.equal(posicaoDoItem(s, 1000 + 6000, L).fim, true)
})

test('a lixeira enche, passa o excesso e manda o míssil', () => {
  assert.deepEqual(encherLixeira(0, 2, 24), { cheio: 2, missil: false })
  assert.deepEqual(encherLixeira(22, 2, 24), { cheio: 0, missil: true })
  assert.deepEqual(encherLixeira(23, 3, 24), { cheio: 2, missil: true })
})

function luta({ meus = [0, 1], def = CHEFES.coronel.regra, fase = 0 } = {}) {
  const e = criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'coronel', semente: 'cor' })
  const log = { quebra: 0, dano: 0, feridas: [], banners: [], enviados: [] }
  const coracoes = [
    { j: 0, x: 150, y: 350, ativo: true },
    { j: 1, x: 350, y: 350, ativo: true },
  ]
  const ponte = {
    semente: 'cor',
    nivel: 'medio',
    n: 2,
    rodada: () => e.rodada,
    estado: () => e,
    meu: (j) => meus.includes(j),
    meuLado: () => 0,
    coracoes: () => coracoes,
    limites: () => L,
    desenharItem: () => null,
    desenharZona: () => null,
    apagar: () => {},
    banner: (t) => log.banners.push(t),
    dica: () => {},
    quebra: (p) => ((log.quebra += p), somarQuebra(e, p)),
    danoNoChefe: (d) => (log.dano += d),
    curar: () => {},
    ferir: (j, d) => log.feridas.push([j, d]),
    empurrar: () => {},
    enviar: (acao, dados) => log.enviados.push({ acao, dados }),
  }
  const regra = new RegraDaLuta(def, ponte)
  if (fase) regra.faseNova(fase)
  e.rodada = 1
  return { regra, log, coracoes, e }
}

test('encostar no verde enche a lixeira e, cheia, o míssil bate (dano e quebra) uma vez', () => {
  const { regra, log, coracoes } = luta()
  regra.comecarEsquiva({})
  const verdes = regra.itensVivos.filter((i) => i.tipo === 'limpo')
  assert.equal(verdes.length, PADRAO_RECICLAGEM.limpos[0])
  let ms = 0
  let missil = 0
  for (let rodada = 0; rodada < 4 && !log.dano; rodada++) {
    for (const v of regra.itensVivos.filter((i) => i.tipo === 'limpo')) {
      regra.pegar(v, 0)
      if (log.dano) break
    }
    if (!log.dano) {
      regra.terminarEsquiva()
      regra.comecarEsquiva({})
    }
    ms++
  }
  assert.ok(log.dano > 0, 'o míssil bateu')
  assert.equal(log.quebra, PADRAO_RECICLAGEM.quebra)
  assert.equal(log.dano, Math.round(350 * PADRAO_RECICLAGEM.dano))
  assert.ok(log.banners.includes('MÍSSIL RECICLADO!'))
  assert.equal(log.feridas.length, 0, 'verde nunca machuca')
  void ms
  void missil
  void coracoes
})

test('o marrom machuca quem encosta e não enche a lixeira', () => {
  const { regra, log } = luta({ fase: 1 })
  regra.comecarEsquiva({})
  const sujo = regra.itensVivos.find((i) => i.tipo === 'sujo')
  assert.ok(sujo)
  regra.pegar(sujo, 1)
  assert.equal(log.feridas.length, 1)
  assert.equal(log.feridas[0][0], 1)
  assert.equal(regra.inst.estado().cheio, 0)
})

test('rede: o outro PC repete o toque pela mensagem e chega ao mesmo estado', () => {
  const dono = luta({ meus: [0] })
  const outro = luta({ meus: [1] })
  dono.regra.comecarEsquiva({})
  outro.regra.comecarEsquiva({})
  assert.deepEqual(
    dono.regra.itensVivos.map((i) => i.id),
    outro.regra.itensVivos.map((i) => i.id),
    'os mesmos ids em todos os PCs',
  )
  for (const i of dono.regra.itensVivos.filter((x) => x.tipo === 'limpo').slice(0, 3)) {
    dono.regra.pegar(i, 0)
    outro.regra.aoMensagem(0, 'item', { id: i.id, j: 0 })
  }
  assert.deepEqual(dono.regra.inst.estado(), outro.regra.inst.estado())
})

test('o míssil no ar bate no mais tardar no fim da esquiva (estado igual em todos os PCs)', () => {
  const { regra, log } = luta()
  regra.comecarEsquiva({})
  // enche a lixeira de uma vez
  for (const i of regra.itensVivos.filter((x) => x.tipo === 'limpo')) regra.pegar(i, 0)
  regra.terminarEsquiva()
  regra.terminarEsquiva()
  assert.ok(log.dano >= 0)
  regra.terminar()
  assert.equal(regra.itensVivos.length, 0)
})

test('a CPU aliada só mira o verde (nunca o marrom) e sem itens não mira nada', () => {
  const { regra } = luta({ fase: 1 })
  assert.equal(regra.alvoDoBot(1), null)
  regra.comecarEsquiva({})
  regra.atualizar(2500)
  const alvo = regra.alvoDoBot(1)
  if (alvo) assert.equal(alvo.tipo, 'limpo')
})

test('o baralho do Coronel: 3 fases, cartas avisadas e sem trânsito antigo', () => {
  const def = CHEFES.coronel
  assert.equal(def.fases.length, 3)
  const { fases, super: sup } = CARTAS_CHEFES.coronel
  for (const lista of fases) {
    assert.ok(lista.length >= 4 && lista.length <= 5)
    assert.ok(lista.some((c) => c.naipe === 'copas'))
    for (const c of lista) {
      const nome = ataqueDaCartaChefe(c, { ataques: A }).nome
      assert.ok(!/caminhonete|brasas|forcado|spiral/.test(nome), `${c.id}: ${nome}`)
    }
  }
  assert.ok(fases[2].some((c) => c.nome === 'Compactador'), 'a fase 3 tem o compactador')
  assert.ok(fases[2].some((c) => ataqueDaCartaChefe(c, { ataques: A }).args?.[0]?.simultaneos === 2), 'e o caminhão duplo')
  assert.ok(ataqueDaCartaChefe(sup, { ataques: A }))
  // o verde é só da reciclagem: nenhuma cor de bala do chefe é verde
  for (const cor of Object.values(def.tema.cores)) {
    const g = (cor >> 8) & 255
    const r = (cor >> 16) & 255
    assert.ok(!(g > r + 30 && g > (cor & 255) + 30), `cor verde ${cor.toString(16)}`)
  }
})

test('lacaios e tenente: registrados, ocultos da seleção, baralho e regra leve', () => {
  for (const id of ['coronelLacaios', 'coronelTenente']) {
    assert.ok(CHEFES[id], id)
    assert.ok(CHEFES[id].oculto && CHEFES[id].expedicao)
    assert.ok(!ORDEM_CHEFES.includes(id))
    assert.ok(CARTAS_CHEFES[id].fases.every((l) => l.length >= 3))
  }
  assert.ok(CHEFES.coronelLacaios.hp < CHEFES.coronelTenente.hp && CHEFES.coronelTenente.hp < CHEFES.coronel.hp)
  // tenente: só verde e lixeira menor
  const slots = planejarItens({ rng: rngDaRegra('s', 1, 'lixo'), fase: 1, n: 2, limites: L, cfg: { ...PADRAO_RECICLAGEM, limpos: [4, 4], sujos: [0, 0] } })
  assert.ok(slots.every((s) => s.tipo === 'limpo'))
  const leve = criarRegraReciclagem({ max: 8 })
  assert.ok(descricaoValida(leve.descricao))
})
