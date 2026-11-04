// node --test src/game/manual/__tests__/dicasDaPartida.test.js
// As dicas da página 5 (a partida de verdade): cada uma no seu gatilho, no máximo N vezes, nunca nas
// fases cheias (abertura, revelação, SUPER, resultado...) e o "vem de cima" lido das balas REAIS.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { criarDicas, criarLeitorDeChuva, ehChuva, DICAS, DICA_MS, INTERVALO_MS, FASES_SEM_DICA, VIDA_BAIXA } from '../dicasDaPartida.js'
import { criarMesa, planoDaVitrine, MAO_P3, CHUVA_P3 } from '../cartasDoManual.js'
import { CARTAS } from '../../pvp/cartas.js'
import { PARTIDA_DO_MANUAL } from '../partidaDoManual.js'
import { cenaDeMentira } from './apoio/cenaDeMentira.mjs'

register('./apoio/ganchos.mjs', import.meta.url) // `phaser` -> Phaser de mentira (só lógica)
globalThis.window ??= {}
const { ataques } = await import('../../attacks/index.js')
const { criarMotorDaVitrine } = await import('../vitrine.js')

// roda a dica por `ms` na fase dada; devolve as que apareceram
function rodar(d, ms, fase, extra = {}) {
  const vistas = []
  for (let t = 0; t < ms; t += 16) {
    const nova = d.tick(16, { fase, ...extra })
    if (nova) vistas.push(nova.id)
  }
  return vistas
}

test('cada dica aparece no seu gatilho real (e só nele)', () => {
  const casos = [
    [{ tipo: 'negada', codigo: 'sem-energia' }, 'escolha', 'semEnergia'],
    [{ tipo: 'deCima' }, 'esquiva', 'deCima'],
    [{ tipo: 'dano', hp: 40, hpMax: 45 }, 'esquiva', 'dano'],
    [{ tipo: 'passou' }, 'escolha', 'energia'],
    [{ tipo: 'rodada', rodada: 2 }, 'inicio', 'energia'],
  ]
  for (const [e, fase, id] of casos) {
    const d = criarDicas()
    assert.equal(d.evento(e), true, JSON.stringify(e))
    assert.deepEqual(rodar(d, 100, fase), [id])
    assert.equal(d.atual.texto, DICAS[id].texto)
    assert.equal(d.drenar()[0].tipo, 'mostrar')
  }
  // não são gatilhos: carta fora da mão, a 1ª rodada, um evento qualquer
  const d = criarDicas()
  assert.equal(d.evento({ tipo: 'negada', codigo: 'fora-da-mao' }), false)
  assert.equal(d.evento({ tipo: 'rodada', rodada: 1 }), false)
  assert.equal(d.evento({ tipo: 'graze' }), false)
  assert.deepEqual(rodar(d, 2000, 'escolha'), [])
})

test('vida baixa: o acerto que deixa a vida pequena traz o "calma" (uma vez)', () => {
  const d = criarDicas()
  d.evento({ tipo: 'dano', hp: 30, hpMax: 45 })
  assert.deepEqual(rodar(d, 100, 'esquiva'), ['dano'])
  rodar(d, DICA_MS + INTERVALO_MS + 50, 'esquiva')
  const baixo = Math.floor(45 * VIDA_BAIXA)
  assert.equal(d.evento({ tipo: 'dano', hp: baixo, hpMax: 45 }), true)
  assert.deepEqual(rodar(d, 100, 'esquiva'), ['calma'])
  rodar(d, DICA_MS + INTERVALO_MS + 50, 'esquiva')
  assert.equal(d.evento({ tipo: 'dano', hp: 3, hpMax: 45 }), false, 'nada mais: as duas já vieram')
  assert.equal(d.evento({ tipo: 'dano', hp: 0, hpMax: 45 }), false, 'caiu: sem "calma"')
})

test('no máximo N vezes cada (falta energia: 2; as outras: 1)', () => {
  const d = criarDicas()
  const vistas = []
  for (let k = 0; k < 5; k++) {
    d.evento({ tipo: 'negada', codigo: 'sem-energia' })
    d.evento({ tipo: 'passou' })
    vistas.push(...rodar(d, 2 * (DICA_MS + INTERVALO_MS + 50), 'escolha'))
    d.evento({ tipo: 'deCima' })
    vistas.push(...rodar(d, DICA_MS + INTERVALO_MS + 50, 'esquiva'))
  }
  assert.equal(vistas.filter((x) => x === 'semEnergia').length, DICAS.semEnergia.max)
  assert.equal(DICAS.semEnergia.max, 2)
  for (const id of ['energia', 'deCima']) assert.equal(vistas.filter((x) => x === id).length, 1, id)
  for (const def of Object.values(DICAS)) assert.ok(def.max >= 1 && def.max <= 2)
})

test('nunca nas fases cheias: espera a fase certa (ou é esquecida) e some se a fase muda', () => {
  for (const fase of FASES_SEM_DICA) {
    const d = criarDicas()
    d.evento({ tipo: 'dano', hp: 40, hpMax: 45 })
    assert.deepEqual(rodar(d, 2000, fase), [], fase)
    assert.deepEqual(rodar(d, 100, 'esquiva'), ['dano'], `${fase}: aparece quando a fase acalma`)
  }
  // bloqueado (câmera lenta do K.O., pausa): nada aparece
  const b = criarDicas()
  b.evento({ tipo: 'deCima' })
  assert.deepEqual(rodar(b, 600, 'esquiva', { bloqueado: true }), [])
  // validade: o "vem de cima" vale só no ataque; passou a validade, é esquecido (e não conta)
  assert.deepEqual(rodar(b, DICAS.deCima.validadeMs, 'revelacao'), [])
  assert.deepEqual(rodar(b, 1000, 'esquiva'), [])
  assert.equal(b.vezes('deCima'), 0)
  assert.equal(b.evento({ tipo: 'deCima' }), true, 'pode vir no próximo ataque de cima')
  // a dica de uma fase não aparece em outra: o "falta energia" é da escolha
  const e = criarDicas()
  e.evento({ tipo: 'negada', codigo: 'sem-energia' })
  assert.deepEqual(rodar(e, 1000, 'esquiva'), [])
  // a dica na tela some quando a fase enche
  const s = criarDicas()
  s.evento({ tipo: 'negada', codigo: 'sem-energia' })
  rodar(s, 100, 'escolha')
  s.drenar()
  assert.ok(s.atual)
  s.tick(16, { fase: 'revelacao' })
  assert.equal(s.atual, null)
  assert.deepEqual(s.drenar().map((x) => x.tipo), ['esconder'])
})

test('nunca trava: some sozinha, uma de cada vez, com respiro, a mais urgente primeiro', () => {
  const d = criarDicas()
  d.evento({ tipo: 'passou' })
  d.evento({ tipo: 'negada', codigo: 'sem-energia' })
  assert.deepEqual(rodar(d, 100, 'escolha'), ['semEnergia'], 'a urgente primeiro')
  assert.deepEqual(rodar(d, DICA_MS - 200, 'escolha'), [], 'uma de cada vez')
  rodar(d, 116, 'escolha')
  assert.equal(d.atual, null, `some sozinha em ${DICA_MS} ms`)
  assert.deepEqual(rodar(d, INTERVALO_MS - 100, 'escolha'), [], 'respiro entre duas')
  assert.deepEqual(rodar(d, 200, 'escolha'), ['energia'])
  d.fechar()
  assert.equal(d.atual, null)
})

// o "vem de cima" com as balas de verdade: os ataques reais das cartas (ContextoAtaque + Balas)
function chuvaDoAtaque(id) {
  const plano = planoDaVitrine(criarMesa({ mao: [id] }).jogar(id).caixa, ataques)
  const m = criarMotorDaVitrine(cenaDeMentira())
  m.rodar(plano)
  const leitor = criarLeitorDeChuva()
  let quando = null
  let t = 0
  while (m.rodando) {
    m.passo(16)
    t += 16
    if (leitor.ver(m.balas.lista, m.caixa.limites)) quando = quando ?? t - plano.inicio
  }
  return quando
}

test('"esse ataque vem de cima": reconhece a Estrela Gentil (cedo) e não as de lado ou de estourar', () => {
  const t = chuvaDoAtaque(CHUVA_P3)
  assert.ok(t !== null && t < 1500, `a chuva é vista logo no começo do ataque (${t} ms)`)
  for (const id of MAO_P3.filter((x) => x !== CHUVA_P3)) assert.equal(chuvaDoAtaque(id), null, id)
  // no baralho todo da CPU da página 5 (o Ralsei), só a Estrela Gentil chove: a dica nunca mente
  const ataquesDaCpu = CARTAS[PARTIDA_DO_MANUAL.p2].filter((c) => c.naipe !== 'copas' && c.valor !== 1)
  assert.ok(ataquesDaCpu.length >= 8)
  assert.deepEqual(ataquesDaCpu.filter((c) => chuvaDoAtaque(c.id) !== null).map((c) => c.id), [CHUVA_P3])
  assert.equal(ehChuva([{ x: 10, y: -5, vy: 80, raio: 8, largura: 220 }]), false, 'uma bala só não é chuva')
  assert.equal(ehChuva([{ x: 10, y: -5, vy: 80, raio: 8, largura: 220 }, { x: 90, y: -8, vy: 70, raio: 8, largura: 220 }]), true)
  assert.equal(ehChuva([{ x: 10, y: -5, vy: 80, raio: 3, largura: 220 }, { x: 90, y: -8, vy: 70, raio: 3, largura: 220 }]), false, 'brilhinho não conta')
})
