// node --test src/game/pvp/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ACELERACAO, nivelAceleracao, fatorAceleracao, parteDoFator } from '../../constants.js'
import { EsquivaBot } from '../botEsquiva.js'

test('morte súbita: o nível sobe a cada 5 rodadas (começo da 5ª, 10ª, 15ª...)', () => {
  assert.equal(ACELERACAO.aCadaRodadas, 5)
  for (const r of [1, 2, 3, 4]) assert.equal(nivelAceleracao(r), 0, `rodada ${r}`)
  for (const r of [5, 6, 9]) assert.equal(nivelAceleracao(r), 1, `rodada ${r}`)
  assert.equal(nivelAceleracao(10), 2)
  assert.equal(nivelAceleracao(15), 3)
  // rodada 0 / negativa (antes da primeira) não quebra
  assert.equal(nivelAceleracao(0), 0)
  assert.equal(nivelAceleracao(-3), 0)
})

test('morte súbita: +30% por nível, x2,5 na rodada 25', () => {
  assert.equal(fatorAceleracao(1), 1)
  assert.equal(fatorAceleracao(4), 1)
  assert.equal(fatorAceleracao(5), 1.3)
  assert.equal(fatorAceleracao(10), 1.6)
  assert.equal(fatorAceleracao(15), 1.9)
  assert.equal(fatorAceleracao(20), 2.2)
  assert.equal(fatorAceleracao(24), 2.2)
  assert.equal(fatorAceleracao(25), 2.5)
  assert.equal(fatorAceleracao(30), 2.5)
  assert.equal(fatorAceleracao(500), ACELERACAO.maximo)
  // o nível para de subir junto com o fator (o aviso não repete no teto)
  assert.equal(nivelAceleracao(30), nivelAceleracao(25))
  // nunca diminui
  let antes = 1
  for (let r = 1; r <= 100; r++) {
    const f = fatorAceleracao(r)
    assert.ok(f >= antes && f <= ACELERACAO.maximo)
    antes = f
  }
})

test('morte súbita: configuração própria e fração do bônus', () => {
  const cfg = { aCadaRodadas: 3, passo: 0.25, maximo: 1.6 }
  assert.equal(fatorAceleracao(2, cfg), 1)
  assert.equal(fatorAceleracao(3, cfg), 1.25)
  assert.equal(fatorAceleracao(6, cfg), 1.5)
  assert.equal(fatorAceleracao(9, cfg), 1.6) // 1.75 cortado no teto
  assert.equal(nivelAceleracao(12, cfg), 3)
  // coração ganha metade do bônus
  assert.equal(parteDoFator(1.24, 0.5), 1.12)
  assert.equal(parteDoFator(1, 0.5), 1)
  assert.equal(parteDoFator(1.6, 1), 1.6)
})

test('controles invertidos o ataque todo: a confusão do bot cai com o tempo', () => {
  const bot = new EsquivaBot({ nivel: 'normal', sorte: () => 0.99 })
  const situacao = { coracao: { x: 100, y: 100, hitbox: 5 }, limites: { left: 0, right: 200, top: 0, bottom: 200 }, balas: [], invertido: true }
  const inicio = bot.confusaoAgora()
  for (let t = 0; t < 4000; t += 16) bot.joy(16, situacao)
  const depois = bot.confusaoAgora()
  assert.ok(depois < inicio, `${depois} < ${inicio}`)
  assert.ok(depois > 0)
  // voltou ao normal: a próxima inversão começa confusa de novo
  bot.joy(16, { ...situacao, invertido: false })
  assert.equal(bot.confusaoAgora(), inicio)
})
