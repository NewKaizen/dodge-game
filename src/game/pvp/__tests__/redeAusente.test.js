// node --test src/game/pvp/__tests__/redeAusente.test.js
// O outro AUSENTE na partida de 2 (docs/rede-pvp.md "Aba em segundo plano e pausa online"): o jogo dele
// continua sozinho com a aba escondida (game/segundoPlano.js); se mesmo assim o PC dele parar de
// responder, o host não espera para sempre: passa a vez dele depois do relógio + folga, e dispensa o fim
// da esquiva dele. Sem a marca de ausente (só um PC lento), espera como sempre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ArenaRede from '../rede/ArenaRede.js'
import { criarCanal } from '../../../lib/lan/canal.js'
import { criarPartida, iniciarRodada } from '../regras.js'

const dorme = (ms) => new Promise((r) => setTimeout(r, ms))

// uma arena de mentira na escolha: só o que a ponte usa
function arenaNaEscolha({ tempoEscolha = 20 } = {}) {
  const estado = criarPartida({ p1: 'kris', p2: 'susie', semente: 'ausente' })
  iniciarRodada(estado)
  return {
    estado,
    saindo: false,
    fase: 'escolha',
    tempoEscolha,
    escolhas: [undefined, undefined],
    noPassar: [false, false],
    acertosRodada: [0, 0],
    ko: [false, false],
    maos: [0, 1].map(() => ({ indice: 0, cartas: [], selecionar() {} })),
    remotas: [],
    escolher(j, id, op) {
      this.escolhas[j] = id
      this.remotas.push({ j, id, op })
    },
  }
}

const canalMudo = () => criarCanal({ enviarBruto: () => {}, meuId: () => 'H' })

test('host: o convidado AUSENTE não jogou até o relógio + folga: passa a vez dele (remoto)', async () => {
  const a = arenaNaEscolha()
  const r = new ArenaRede(a, { canal: canalMudo(), meuLado: 0, souHost: true, ausente: () => true, folgaJogadaMs: 30 })
  r.comecarEscolha()
  await dorme(1200)
  assert.deepEqual(a.remotas, [{ j: 1, id: null, op: { remoto: true } }])
  r.destruir()
})

test('host: o convidado só está lento (não ausente): continua esperando a jogada dele', async () => {
  const a = arenaNaEscolha()
  const r = new ArenaRede(a, { canal: canalMudo(), meuLado: 0, souHost: true, ausente: () => false, folgaJogadaMs: 30 })
  r.comecarEscolha()
  await dorme(1200)
  assert.deepEqual(a.remotas, [])
  r.destruir()
})

test('convidado: nunca passa a vez do host (quem decide a rodada é o host)', async () => {
  const a = arenaNaEscolha()
  const r = new ArenaRede(a, { canal: canalMudo(), meuLado: 1, souHost: false, ausente: () => true, folgaJogadaMs: 30 })
  r.comecarEscolha()
  await dorme(1200)
  assert.deepEqual(a.remotas, [])
  r.destruir()
})

test('sem relógio na escolha (tempo 0): ninguém passa a vez de ninguém', async () => {
  const a = arenaNaEscolha({ tempoEscolha: 0 })
  const r = new ArenaRede(a, { canal: canalMudo(), meuLado: 0, souHost: true, ausente: () => true, folgaJogadaMs: 30 })
  r.comecarEscolha()
  await dorme(700)
  assert.deepEqual(a.remotas, [])
  r.destruir()
})

test('fim da esquiva: o outro AUSENTE não segura a rodada; presente (só lento), a espera continua', async () => {
  for (const ausente of [true, false]) {
    const a = arenaNaEscolha()
    a.fase = 'esquiva'
    const r = new ArenaRede(a, { canal: canalMudo(), meuLado: 0, souHost: true, ausente: () => ausente, esperaAusenteMs: 10 })
    let seguiu = false
    const aviso = console.warn
    console.warn = () => {}
    r.avisarFim(a.estado.rodada).then(() => (seguiu = true))
    await dorme(1200)
    console.warn = aviso
    assert.equal(seguiu, ausente, ausente ? 'ausente: segue sem ele' : 'lento: espera')
    a.saindo = true // solta a espera que sobrou
    r.destruir()
  }
})

test('a jogada do convidado que chega a tempo vale (a vigia não passa a vez de quem jogou)', async () => {
  const fio = []
  const host = criarCanal({ enviarBruto: (m) => fio.push(m), meuId: () => 'H' })
  const conv = criarCanal({ enviarBruto: (m) => host.entregar(m), meuId: () => 'C' })
  const a = arenaNaEscolha()
  const r = new ArenaRede(a, { canal: host, meuLado: 0, souHost: true, ausente: () => true, folgaJogadaMs: 30 })
  r.comecarEscolha()
  conv.enviar('jogada', a.estado.rodada, { jogada: null })
  await dorme(1200)
  assert.equal(a.remotas.length, 1, 'uma vez só')
  r.destruir()
})
