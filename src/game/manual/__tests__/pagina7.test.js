// node --test src/game/manual/__tests__/pagina7.test.js
// Página 7 (extra), "Graze: raspando": dois desafios (raspar em 3 tiros; 5 grazes = +1 de energia) pelas regras reais.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CORACAO } from '../../constants.js'
import { ENERGIA } from '../../pvp/regras.js'
import { criarPagina7, PASSOS7, META_RASPAR, META_ENERGIA, ENERGIA_INICIAL_P7, FALAS_INTRO7, TEXTOS7 } from '../pagina7.js'
import { CAIXA, rodar, ate, raspando, parado } from './apoio/pilotos.mjs'

const nova = (op = {}) => criarPagina7({ caixa: CAIXA, ...op })
const comecar = (p) => {
  ate(p, 'explicar')
  p.drenar()
}

test('as metas vêm das regras reais: 3 para raspar, 5 grazes por gema (ENERGIA.grazesPorPonto)', () => {
  assert.equal(META_RASPAR, 3)
  assert.equal(META_ENERGIA, ENERGIA.grazesPorPonto)
  assert.equal(PASSOS7.length, 2)
  assert.deepEqual(PASSOS7.map((x) => x.id), ['raspar', 'energia'])
})

test('intro (2 falas), depois o desafio já mostra o coração parado com o anel de graze', () => {
  const p = nova()
  assert.equal(p.etapa, 'intro')
  assert.equal(p.fala, FALAS_INTRO7[0])
  p.avancar()
  assert.equal(p.fala, FALAS_INTRO7[1])
  p.avancar()
  assert.equal(p.etapa, 'explicar')
  assert.equal(p.alvos.length, 1)
  assert.equal(p.alvos[0].hitbox, CORACAO.hitbox)
  assert.equal(p.alvos[0].graze, CORACAO.graze)
  assert.equal(p.hud.anel, true)
  assert.equal(p.hud.contador, 'graze: 0 de 3')
})

test('raspando em 3 tiros: graze não machuca e o passo vira adesivo', () => {
  const p = nova()
  comecar(p)
  p.avancar() // explicar -> preparar
  assert.equal(p.etapa, 'preparar')
  const ev = rodar(p, 60000, raspando, (q) => q.etapa === 'acertou')
  assert.equal(p.etapa, 'acertou', 'chegou aos 3 grazes sem levar acerto')
  assert.equal(ev.filter((e) => e.tipo === 'graze').length, META_RASPAR)
  assert.equal(ev.filter((e) => e.tipo === 'acerto').length, 0)
  assert.deepEqual(ev.find((e) => e.tipo === 'passo'), { tipo: 'passo', indice: 0, resultado: 'feita' })
  assert.equal(p.resultados[0], 'feita')
})

test('ficar parado leva acerto (o tiro é mirado): errou, depois de 3 erros a ajuda; pular conta como pulada', () => {
  const p = nova()
  comecar(p)
  p.avancar()
  for (let k = 1; k <= 2; k++) {
    const ev = rodar(p, 30000, parado, (q) => q.etapa === 'errou')
    assert.equal(p.etapa, 'errou')
    assert.ok(ev.some((e) => e.tipo === 'acerto'))
    assert.equal(p.falhas[0], k)
    assert.ok(p.fala.length > 10)
    p.avancar() // errou -> preparar (tentar já)
    assert.equal(p.etapa, 'preparar')
  }
  rodar(p, 30000, parado, (q) => q.etapa === 'ajuda')
  assert.equal(p.etapa, 'ajuda')
  assert.equal(p.mover('baixo'), true)
  assert.equal(p.mover('baixo'), false)
  assert.equal(p.mover('esquerda'), false)
  p.avancar() // pular esta parte
  assert.equal(p.resultados[0], 'pulada')
  assert.equal(p.passo, 1, 'segue para o próximo passo')
  assert.equal(p.etapa, 'explicar')
})

test('raspar não passa de 3 no contador e cada bala dá no máximo 1 graze', () => {
  const p = nova()
  comecar(p)
  p.avancar()
  const ev = rodar(p, 60000, raspando, (q) => q.etapa === 'acertou')
  const por = new Map()
  for (const e of ev.filter((x) => x.tipo === 'graze')) por.set(e.indice, (por.get(e.indice) ?? 0) + 1)
  assert.equal(p.hud.grazes, META_RASPAR)
  assert.ok([...por.values()].every((n) => n >= 1))
})

test('5 grazes = +1 de energia (registrarGrazes de verdade): 4 -> 5, e o evento "energia" avisa', () => {
  const p = nova({ passos: ['feita', null] })
  assert.equal(p.passo, 1, 'retomando: o primeiro passo já estava feito')
  ate(p, 'explicar')
  p.drenar()
  assert.equal(p.energiaNaTela, ENERGIA_INICIAL_P7)
  p.avancar()
  const ev = rodar(p, 90000, raspando, (q) => q.etapa === 'acertou')
  assert.equal(p.etapa, 'acertou')
  assert.equal(ev.filter((e) => e.tipo === 'graze').length, META_ENERGIA)
  const ganho = ev.filter((e) => e.tipo === 'energia')
  assert.equal(ganho.length, 1, 'só o 5º graze acende a gema')
  assert.equal(ganho[0].ganho, 1)
  assert.equal(p.energiaNaTela, ENERGIA_INICIAL_P7 + 1)
  // o passo 1 continua como estava salvo
  assert.equal(p.resultados[0], 'feita')
})

test('completando os dois passos a página fecha: concluída, vira, fim (e os textos são os da página)', () => {
  const p = nova()
  comecar(p)
  for (let passo = 0; passo < 2; passo++) {
    p.avancar() // explicar -> preparar
    rodar(p, 90000, raspando, (q) => q.etapa === 'acertou')
    assert.equal(p.etapa, 'acertou')
    p.avancar() // próximo passo (ou concluída)
    p.drenar()
  }
  assert.equal(p.etapa, 'concluida')
  assert.equal(p.completa, true)
  assert.equal(p.adesivos, 2)
  assert.equal(p.fala, TEXTOS7.concluida)
  p.avancar()
  assert.equal(p.etapa, 'virando')
  assert.equal(p.terminouDeVirar(), undefined)
  assert.equal(p.etapa, 'fim')
  assert.equal(p.fala, TEXTOS7.fim)
})

test('retomar: o salvo pela metade recomeça no passo que falta, com a fala de boas-vindas', () => {
  const p = nova({ passos: [null, 'feita'] })
  assert.equal(p.passo, 0)
  assert.ok(p.fala.startsWith('Que bom que você voltou'))
  p.avancar()
  assert.equal(p.etapa, 'explicar')
  assert.equal(p.passoAtual.id, 'raspar')
})
