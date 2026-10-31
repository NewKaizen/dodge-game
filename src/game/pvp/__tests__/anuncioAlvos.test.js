// O anúncio desenhado dos alvos (pvp/anuncioAlvos.js): node --test src/game/pvp/__tests__/anuncioAlvos.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ANUNCIO, posicoesDoAnuncio, estadoDoNo, ICONE_DO_ESTADO, quemDestacar, modeloDoAnuncio, curvaDaSeta, pontoNaCurva, linhaDoTempo, quadroDoAnuncio } from '../anuncioAlvos.js'
import { alvosDoRodizio } from '../ffa.js'

const vivos = (n) => Array(n).fill('vivo')

test('FFA: 4 jogadores em losango (cima, direita, baixo, esquerda); 3 em triângulo; todos dentro do painel', () => {
  const q = posicoesDoAnuncio({ n: 4 })
  assert.deepEqual(q.map((p) => [Math.round(p.x), Math.round(p.y)]), [[0, -78], [150, 0], [0, 78], [-150, 0]])
  const t = posicoesDoAnuncio({ n: 3 })
  assert.equal(t.length, 3)
  assert.deepEqual([Math.round(t[0].x), Math.round(t[0].y)], [0, -78])
  assert.ok(t[1].x > 0 && t[1].y > 0 && t[2].x < 0 && t[2].y > 0)
  for (const p of [...q, ...t]) assert.ok(Math.abs(p.x) <= ANUNCIO.rx && Math.abs(p.y) <= ANUNCIO.ry)
})

test('2x2: o time A à esquerda e o B à direita, dois por lado, em qualquer arranjo de vagas', () => {
  for (const times of [[0, 1, 0, 1], [0, 0, 1, 1], [0, 1, 1, 0]]) {
    const p = posicoesDoAnuncio({ n: 4, dupla: true, times })
    times.forEach((t, j) => assert.equal(Math.sign(p[j].x), t === 0 ? -1 : 1))
    for (const t of [0, 1]) {
      const ys = p.filter((_, j) => times[j] === t).map((x) => x.y)
      assert.equal(new Set(ys).size, 2)
    }
  }
})

test('estados: o mais forte vale e cada um tem seu ícone', () => {
  assert.equal(estadoDoNo({}), 'vivo')
  assert.equal(estadoDoNo({ eliminado: true, caido: true, fora: true }), 'eliminado')
  assert.equal(estadoDoNo({ caido: true, fora: true }), 'caido')
  assert.equal(estadoDoNo({ fora: true, semAlvo: true }), 'semConexao')
  assert.equal(estadoDoNo({ semAlvo: true }), 'semAlvo')
  assert.deepEqual([ICONE_DO_ESTADO.eliminado, ICONE_DO_ESTADO.caido, ICONE_DO_ESTADO.semConexao, ICONE_DO_ESTADO.semAlvo, ICONE_DO_ESTADO.vivo], ['x', 'x', 'desconectado', 'energia', null])
})

test('quem destacar: eu de pé; senão quem sigo; senão o primeiro de pé', () => {
  assert.equal(quemDestacar({ meu: 2, inativos: [false, false, false, false], seguindo: 1 }), 2)
  assert.equal(quemDestacar({ meu: 2, inativos: [false, false, true, false], seguindo: 3 }), 3)
  assert.equal(quemDestacar({ meu: 2, inativos: [true, false, true, false], seguindo: 0 }), 1)
  assert.equal(quemDestacar({ meu: 0, inativos: [true, true], seguindo: null }), null)
})

test('FFA com 4: 4 setas, a minha por último; a que vem para mim logo antes; as outras fracas', () => {
  const alvos = alvosDoRodizio([0, 1, 2, 3], 1) // 0→1, 1→2, 2→3, 3→0
  const m = modeloDoAnuncio({ n: 4, alvos, estados: vivos(4), meu: 2 })
  assert.equal(m.setas.length, 4)
  assert.deepEqual(m.setas.map((s) => s.tipo), ['fraca', 'fraca', 'contraMim', 'minha'])
  assert.deepEqual(m.setas.at(-1), { de: 2, para: 3, tipo: 'minha', ordem: 3 })
  assert.deepEqual(m.setas.at(-2), { de: 1, para: 2, tipo: 'contraMim', ordem: 2 })
  assert.deepEqual(m.setas.map((s) => s.ordem), [0, 1, 2, 3])
  assert.deepEqual(m.nos.map((n) => n.voce), [false, false, true, false])
  assert.equal(m.elo, null)
})

test('FFA com um caído (3 de pé): só 3 setas, o eliminado sem seta e com X', () => {
  const alvos = alvosDoRodizio([0, 2, 3], 1, 4) // 0→2, 2→3, 3→0 (a vaga 1 caiu)
  const estados = ['vivo', 'eliminado', 'vivo', 'vivo']
  const m = modeloDoAnuncio({ n: 4, alvos, estados, meu: 0 })
  assert.equal(m.setas.length, 3)
  assert.ok(m.setas.every((s) => s.de !== 1 && s.para !== 1))
  assert.equal(m.nos[1].icone, 'x')
  assert.deepEqual(m.setas.map((s) => s.tipo), ['fraca', 'contraMim', 'minha'])
})

test('sem conexão não ataca (sem seta de saída) mas leva o ataque (seta de chegada)', () => {
  const alvos = alvosDoRodizio([0, 1, 2], 1) // 0→1, 1→2, 2→0
  const m = modeloDoAnuncio({ n: 3, alvos, estados: ['vivo', 'semConexao', 'vivo'], meu: 0 })
  assert.deepEqual(m.setas.map((s) => [s.de, s.para]), [[2, 0], [0, 1]])
  assert.equal(m.nos[1].icone, 'desconectado')
})

test('espectador: a seta destacada é a de quem ele segue', () => {
  const alvos = alvosDoRodizio([1, 2, 3], 1, 4) // 1→2, 2→3, 3→1
  const estados = ['eliminado', 'vivo', 'vivo', 'vivo']
  const m = modeloDoAnuncio({ n: 4, alvos, estados, meu: 0, destaque: 2 })
  assert.deepEqual(m.setas.map((s) => [s.de, s.para, s.tipo]), [[3, 1, 'fraca'], [1, 2, 'contraMim'], [2, 3, 'minha']])
  assert.equal(m.nos[0].voce, true) // (a etiqueta VOCÊ continua no meu personagem eliminado)
  assert.equal(m.nos[2].destaque, true)
})

test('2x2: os dois duelos são pares de setas; o meu duelo destacado e o parceiro ligado a mim', () => {
  const times = [0, 1, 0, 1]
  const alvos = [1, 0, 3, 2] // A1×B1 e A2×B2
  const m = modeloDoAnuncio({ n: 4, dupla: true, times, alvos, estados: vivos(4), meu: 0 })
  assert.equal(m.setas.length, 4)
  assert.deepEqual(m.setas.map((s) => s.tipo), ['fraca', 'fraca', 'contraMim', 'minha'])
  assert.deepEqual(m.elo, [0, 2])
  assert.deepEqual(m.nos.map((n) => n.time), times)
})

test('2x2 com SEM ALVO: o ícone de energia no lugar da seta; o outro duelo continua', () => {
  const times = [0, 1, 0, 1]
  const alvos = [1, 0, null, null] // o time A só com a vaga 0 de pé... vaga 2 sem alvo
  const m = modeloDoAnuncio({ n: 4, dupla: true, times, alvos, estados: ['vivo', 'vivo', 'semAlvo', 'vivo'], meu: 2, destaque: 2 })
  assert.equal(m.nos[2].icone, 'energia')
  assert.equal(m.setas.every((s) => s.de !== 2 && s.para !== 2), true)
  assert.deepEqual(m.elo, [2, 0])
})

test('a curva: sai perto de um anel e chega perto do outro; ida e volta ficam em lados opostos', () => {
  const a = { x: -100, y: 0 }
  const b = { x: 100, y: 0 }
  const ida = curvaDaSeta(a, b)
  const volta = curvaDaSeta(b, a)
  assert.ok(Math.hypot(ida.a.x - a.x, ida.a.y - a.y) >= ANUNCIO.raioNo)
  assert.ok(Math.hypot(ida.b.x - b.x, ida.b.y - b.y) >= ANUNCIO.raioNo)
  assert.ok(pontoNaCurva(ida, 0.5).y * pontoNaCurva(volta, 0.5).y < 0, 'lados opostos')
  assert.deepEqual(pontoNaCurva(ida, 0), ida.a)
})

test('tempo normal: ~1,2 s, uma seta a cada ~130 ms, todas prontas antes do fim; pulso só sem "reduzir animações"', () => {
  const l = linhaDoTempo(4)
  assert.equal(l.total, 1200)
  assert.deepEqual(l.inicios.map((x, i) => (i ? x - l.inicios[i - 1] : 0)), [0, 130, 130, 130])
  assert.ok(l.inicios.at(-1) + l.duracao < l.total)
  const q0 = quadroDoAnuncio(l, 0)
  assert.equal(q0.sprites, 0)
  assert.deepEqual(q0.setas, [0, 0, 0, 0])
  const meio = quadroDoAnuncio(l, l.inicios[1] + l.duracao / 2)
  assert.equal(meio.setas[0], 1)
  assert.ok(meio.setas[1] > 0 && meio.setas[1] < 1)
  assert.equal(meio.setas[3], 0)
  assert.ok(meio.pulso >= 0 && meio.pulso <= 1)
  const fim = quadroDoAnuncio(l, 1200)
  assert.deepEqual([fim.fim, fim.sprites, ...fim.setas], [true, 1, 1, 1, 1, 1])
})

test('A ou B (pular): vai direto ao quadro final', () => {
  const q = quadroDoAnuncio(linhaDoTempo(4), 50, { pular: true })
  assert.deepEqual([q.fim, q.sprites, ...q.setas, q.pulso], [true, 1, 1, 1, 1, 1, 0])
})

test('reduzir animações: tudo de uma vez, parado, ~0,8 s', () => {
  const l = linhaDoTempo(4, { reduzir: true })
  assert.equal(l.total, 800)
  for (const t of [0, 100, 799]) {
    const q = quadroDoAnuncio(l, t)
    assert.deepEqual([q.sprites, ...q.setas, q.pulso, q.fim], [1, 1, 1, 1, 1, 0, false])
  }
  assert.equal(quadroDoAnuncio(l, 800).fim, true)
})
