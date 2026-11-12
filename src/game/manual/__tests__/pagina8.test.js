// node --test src/game/manual/__tests__/pagina8.test.js
// Página 8 (extra), "Jogando em dupla": dois corações no mesmo quadro; com 2 pessoas cada uma move um, com 1 pessoa
// o parceiro é o Ralsei (a CPU aliada).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarPagina8, falasIntro8, TEXTOS8 } from '../pagina8.js'
import { CAIXA, rodar, ate, desviando, parado } from './apoio/pilotos.mjs'

const nova = (op = {}) => criarPagina8({ caixa: CAIXA, ...op })
// vai até o "explicar" do passo (retomando: o passo 'marcas' já feito salva o desafio 'dupla' como o que falta)
const aoPasso = (p) => {
  ate(p, 'explicar')
  p.drenar()
}
const dupla = (op) => nova({ ...op, passos: ['feita', null] })

// o joystick para um coração ir até um ponto
const indoPara = (alvo, ponto) => {
  const d = Math.hypot(ponto.x - alvo.x, ponto.y - alvo.y) || 1
  return { x: ((ponto.x - alvo.x) / d) * 100, y: ((ponto.y - alvo.y) / d) * 100 }
}

test('1 pessoa: o coração 2 é o Ralsei (CPU); 2 pessoas: cada coração é de uma pessoa', () => {
  const sozinho = nova({ humanos: 1 })
  ate(sozinho, 'explicar')
  assert.equal(sozinho.alvos.length, 2)
  assert.deepEqual(sozinho.alvos.map((a) => Boolean(a.cpu)), [false, true])
  assert.equal(sozinho.alvos[0].humano, 0)
  const dupla = nova({ humanos: 2 })
  ate(dupla, 'explicar')
  assert.deepEqual(dupla.alvos.map((a) => a.humano), [0, 1])
  assert.ok(dupla.alvos.every((a) => !a.cpu))
  assert.notEqual(falasIntro8(1)[1], falasIntro8(2)[1], 'a fala muda conforme quem joga')
  assert.ok(sozinho.fala.length > 0)
})

test('marcas, 2 pessoas: os dois movem e as duas marcas valem (cada um na sua)', () => {
  const p = nova({ humanos: 2 })
  aoPasso(p)
  p.avancar()
  const ev = rodar(p, 20000, (q) => q.alvos.map((a, i) => indoPara(a, q.tent.marcas[i])), (q) => q.etapa === 'acertou')
  assert.equal(p.etapa, 'acertou')
  assert.equal(ev.filter((e) => e.tipo === 'marca').length, 2)
  assert.equal(p.resultados[0], 'feita')
})

test('marcas, 1 pessoa: o Ralsei leva o coração dele sozinho; o jogador só precisa levar o seu', () => {
  const p = nova({ humanos: 1 })
  aoPasso(p)
  p.avancar()
  // só o joystick do jogador 1 (um joystick só); o parceiro anda pelo piloto
  let ev = rodar(p, 8000, (q) => [indoPara(q.alvos[0], q.tent.marcas[0])], (q) => q.etapa === 'acertou')
  assert.equal(p.etapa, 'acertou')
  assert.equal(ev.filter((e) => e.tipo === 'marca').length, 2)
  // o jogador parado não termina sozinho
  const q = nova({ humanos: 1 })
  aoPasso(q)
  q.avancar()
  ev = rodar(q, 8000, () => [{ x: 0, y: 0 }])
  assert.equal(q.etapa, 'tentar', 'o parceiro chegou, o jogador não')
  assert.deepEqual(q.tent.marcas.map((m) => m.pega), [false, true])
  assert.equal(ev.filter((e) => e.tipo === 'marca').length, 1)
})

test('desviar juntos, 2 pessoas desviando bem: os dois de pé no fim', () => {
  const p = dupla({ humanos: 2 })
  aoPasso(p)
  p.avancar()
  const ev = rodar(p, 15000, (q) => [desviando(0)(q), desviando(1)(q)], (q) => q.etapa === 'acertou')
  assert.equal(p.etapa, 'acertou')
  assert.equal(ev.filter((e) => e.tipo === 'caiu').length, 0)
  assert.ok(p.fala.includes('Os dois de pé'))
  assert.equal(p.resultados[1], 'feita')
})

test('desviar juntos: um cai e o outro segura (vale!); os dois caírem recomeça só este passo', () => {
  // a pessoa 2 cai (como se tivesse levado um acerto) e a 1 segura até o fim
  const um = dupla({ humanos: 2 })
  aoPasso(um)
  um.avancar()
  um.alvos[1].ativo = false
  um.alvos[1].caido = true
  const ev = rodar(um, 15000, (q) => [desviando(0)(q), { x: 0, y: 0 }], (q) => q.etapa === 'acertou' || q.etapa === 'errou')
  assert.equal(um.etapa, 'acertou', 'um de pé até o fim')
  assert.equal(ev.filter((e) => e.tipo === 'acerto').length, 0)
  assert.deepEqual(um.alvos.map((a) => a.caido), [false, true])
  assert.ok(um.fala.includes('Um caiu'))

  const dois = dupla({ humanos: 2 })
  aoPasso(dois)
  dois.avancar()
  const ev2 = rodar(dois, 20000, parado, (q) => q.etapa === 'errou')
  assert.equal(dois.etapa, 'errou')
  assert.equal(ev2.filter((e) => e.tipo === 'caiu').length, 2)
  assert.equal(dois.passoAtual.id, 'dupla')
  assert.equal(dois.resultados[1], null)
  assert.equal(dois.falhas[1], 1)
})

test('desviar juntos, 1 pessoa: a CPU aliada (Ralsei) desvia sozinha e a dupla fecha o passo', () => {
  const p = dupla({ humanos: 1 })
  aoPasso(p)
  p.avancar()
  assert.deepEqual(p.alvos.map((a) => Boolean(a.cpu)), [false, true])
  const ev = rodar(p, 15000, (q) => [desviando(0)(q)], (q) => q.etapa === 'acertou' || q.etapa === 'errou')
  assert.equal(p.etapa, 'acertou', 'o jogador desviando bem e a CPU aliada passam juntos')
  assert.equal(ev.filter((e) => e.tipo === 'caiu').length, 0)
})

test('o corpo caído não anda nem leva mais bala (a bala que acertou some)', () => {
  const p = dupla({ humanos: 2 })
  aoPasso(p)
  p.avancar()
  rodar(p, 20000, parado, (q) => q.alvos.some((a) => a.caido))
  const caido = p.alvos.find((a) => a.caido)
  const { x, y } = caido
  rodar(p, 500, () => [{ x: 100, y: 100 }, { x: 100, y: 100 }])
  assert.deepEqual([caido.x, caido.y], [x, y])
})

test('a página fecha com os dois passos e cai de volta no índice (virar -> próxima página 9)', () => {
  const p = nova({ humanos: 2 })
  aoPasso(p)
  p.avancar()
  rodar(p, 20000, (q) => q.alvos.map((a, i) => indoPara(a, q.tent.marcas[i])), (q) => q.etapa === 'acertou')
  p.avancar()
  assert.equal(p.passoAtual.id, 'dupla')
  p.avancar()
  rodar(p, 15000, (q) => [desviando(0)(q), desviando(1)(q)], (q) => q.etapa === 'acertou')
  p.avancar()
  assert.equal(p.etapa, 'concluida')
  assert.equal(p.fala, TEXTOS8.concluida)
  p.avancar()
  p.terminouDeVirar()
  assert.equal(p.fala, TEXTOS8.fim)
})
