// node --test src/game/manual/__tests__/pagina5.test.js
// Página 5 ("Uma partida de verdade"): a máquina do caderno (intro, a transição para a arena, a volta,
// os parabéns com o adesivo e a página "e agora?").
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarPagina5, FALAS_INTRO5, FALAS_FIM, OPCOES_E_AGORA, ENCHER_MS, DESCOLAR_MS, VOLTAR_MS, ETAPAS5, expressaoDaPagina5 } from '../pagina5.js'

const rodar = (p, ms) => {
  for (let t = 0; t < ms; t += 16) p.tick(16)
}
const tipos = (p) => p.drenar().map((e) => (e.tipo === 'etapa' ? `etapa:${e.etapa}` : e.tipo))

test('antes da partida: falas, os desenhos ganham cor, a folha descola e a arena abre', () => {
  const p = criarPagina5()
  assert.equal(p.etapa, 'intro')
  assert.equal(p.fala, FALAS_INTRO5[0])
  for (let k = 1; k < FALAS_INTRO5.length; k++) {
    assert.equal(p.avancar(), true)
    assert.equal(p.fala, FALAS_INTRO5[k])
  }
  p.drenar()
  p.avancar()
  assert.deepEqual(tipos(p), ['lancarArena', 'etapa:enchendo'], 'a arena começa a carregar por baixo enquanto o giz ganha cor')
  assert.equal(p.emPartida, true)
  assert.equal(p.avancar(), false, 'A não pula a transição')
  rodar(p, ENCHER_MS / 2)
  assert.ok(p.cor > 0.4 && p.cor < 0.6)
  rodar(p, ENCHER_MS / 2 + 32)
  assert.equal(p.etapa, 'descolando')
  assert.equal(p.cor, 1)
  rodar(p, DESCOLAR_MS + 32)
  assert.equal(p.etapa, 'partida')
  assert.deepEqual(tipos(p), ['etapa:descolando', 'etapa:partida', 'abrirArena'])
  assert.equal(p.descolar, 1)
})

test('reduzir animações: corte direto para a arena (e de volta para os parabéns)', () => {
  const p = criarPagina5({ calmo: true })
  while (p.etapa === 'intro') p.avancar()
  assert.equal(p.etapa, 'partida')
  assert.deepEqual(tipos(p).filter((t) => t !== 'fala'), ['lancarArena', 'etapa:partida', 'abrirArena'])
  const v = criarPagina5({ resultado: { vencedor: 2 }, calmo: true })
  assert.equal(v.etapa, 'parabens')
  assert.ok(tipos(v).includes('essencial'))
})

test('depois da partida (ganhando, perdendo ou empatando): volta, parabéns, adesivo, virada e "e agora?"', () => {
  for (const [vencedor, fim] of [[1, 'venceu'], [2, 'perdeu'], [0, 'empate']]) {
    const p = criarPagina5({ resultado: { vencedor } })
    assert.equal(p.etapa, 'voltando')
    assert.equal(p.resultado, fim)
    rodar(p, VOLTAR_MS + 32)
    assert.equal(p.etapa, 'parabens')
    assert.deepEqual(tipos(p), ['essencial', 'etapa:parabens'], 'o adesivo é salvo na hora')
    assert.equal(p.fala, FALAS_FIM[fim][0])
    assert.match(FALAS_FIM[fim].join(' '), /você aprendeu o básico!/i)
    while (p.etapa === 'parabens') p.avancar()
    assert.equal(p.etapa, 'virando')
    p.terminouDeVirar()
    assert.equal(p.etapa, 'eAgora')
  }
  assert.equal(expressaoDaPagina5({ etapa: 'parabens', resultado: 'venceu', falaIdx: 0 }), 'animado')
  assert.equal(expressaoDaPagina5({ etapa: 'parabens', resultado: 'perdeu', falaIdx: 0 }), 'incentivo')
})

test('"e agora?": as 4 saídas, ↑/↓ dá a volta, A vai', () => {
  assert.deepEqual(OPCOES_E_AGORA.map((o) => o.rotulo), ['JOGAR CONTRA A CPU', 'ONLINE', 'CARTAS E ARENAS', 'VOLTAR AO ÍNDICE'])
  for (let k = 0; k < OPCOES_E_AGORA.length; k++) {
    const p = criarPagina5({ resultado: { vencedor: 1 }, calmo: true })
    while (p.etapa === 'parabens') p.avancar()
    p.terminouDeVirar()
    assert.equal(p.mover('esquerda'), false)
    for (let i = 0; i < k; i++) p.mover('baixo')
    p.drenar()
    p.avancar()
    const ir = p.drenar().find((e) => e.tipo === 'ir')
    assert.equal(ir.destino, OPCOES_E_AGORA[k].id)
    assert.equal(p.etapa, 'saindo')
    assert.equal(p.avancar(), false, 'só vai uma vez')
  }
  const p = criarPagina5({ resultado: { vencedor: 1 }, calmo: true })
  while (p.etapa === 'parabens') p.avancar()
  p.terminouDeVirar()
  p.mover('cima')
  assert.equal(p.opcao, OPCOES_E_AGORA.length - 1)
  assert.equal(p.mover('cima'), true)
  assert.ok(ETAPAS5.includes(p.etapa))
})
