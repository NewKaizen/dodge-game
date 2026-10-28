// As quatro vagas do CO-OP 3–4 nos quatro modos de daltonismo (Fase 5B): node --test src/game/__tests__/
// A cor sozinha não identifica ninguém (cada vaga tem forma e nome, coop/marcadores.js), mas as cores
// também precisam se distinguir entre si, das balas brancas e do aviso, e aparecer no fundo escuro.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { aplicarDaltonismo, distancia, claridade, MODOS } from '../daltonismo.js'
import { corDaVaga } from '../vagas.js'
import { CORES } from '../constants.js'
import { razaoContraste } from '../contraste.js'
import { FORMAS, formaDaVaga, pontosDaForma, nomeNoCoracao, marcadorDaVaga } from '../coop/marcadores.js'

after(() => aplicarDaltonismo('nenhum'))

const FUNDO = 0x0b0914 // o painel escuro das arenas
const DISTINTAS = 40 // ΔE (CIELAB) mínimo entre duas vagas como o modo as vê
const BALA = CORES.bala

test('P1–P4 se distinguem em todos os modos (ΔE >= 40 entre qualquer par)', () => {
  for (const modo of MODOS) {
    aplicarDaltonismo(modo)
    const cores = [0, 1, 2, 3].map(corDaVaga)
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++) {
        const d = distancia(cores[i], cores[j], modo)
        assert.ok(d >= DISTINTAS, `${modo}: P${i + 1} x P${j + 1} só ${d.toFixed(1)}`)
      }
  }
})

test('nenhuma vaga se confunde com as balas brancas nem com o aviso, e todas aparecem no fundo escuro', () => {
  for (const modo of MODOS) {
    aplicarDaltonismo(modo)
    for (let i = 0; i < 4; i++) {
      const cor = corDaVaga(i)
      assert.ok(distancia(cor, BALA, modo) >= 30, `${modo}: P${i + 1} parece as balas (${distancia(cor, BALA, modo).toFixed(1)})`)
      // (P1 e P2 são as almas de sempre, conferidas em daltonismo.test.js; o P1 vermelho já era
      // quase o vermelho do aviso: o coração se reconhece pela forma e pelo nome)
      if (i >= 2) assert.ok(distancia(cor, CORES.aviso, modo) >= 25, `${modo}: P${i + 1} parece o aviso (${distancia(cor, CORES.aviso, modo).toFixed(1)})`)
      assert.ok(claridade(cor, modo) >= 45, `${modo}: P${i + 1} escuro demais (L*=${claridade(cor, modo).toFixed(0)})`)
      assert.ok(razaoContraste(cor, FUNDO) >= 3, `${modo}: P${i + 1} contra o fundo ${razaoContraste(cor, FUNDO).toFixed(2)}:1 (objeto gráfico pede 3:1)`)
    }
  }
})

test('a cor nunca é a única pista: 4 formas diferentes e o nome no coração', () => {
  assert.equal(new Set(FORMAS).size, 4)
  assert.deepEqual([0, 1, 2, 3].map(formaDaVaga), FORMAS)
  // cada forma é um polígono diferente (nº de pontos ou posição dos pontos)
  const assinatura = (f) => pontosDaForma(f, 5).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  assert.equal(new Set(FORMAS.map(assinatura)).size, 4)
  assert.deepEqual(FORMAS.map((f) => pontosDaForma(f).length), [14, 4, 3, 4])
  // o quadrado e o losango têm pontos em lugares diferentes (a ponta do losango está no eixo)
  assert.ok(pontosDaForma('losango').some((p) => Math.abs(p.x) < 1e-9))
  assert.ok(!pontosDaForma('quadrado').some((p) => Math.abs(p.x) < 1e-9))
  // o rótulo é o nome do jogador (curto, em maiúsculas), ou a sigla da vaga sem nome
  assert.equal(nomeNoCoracao('ana'), 'ANA')
  assert.equal(nomeNoCoracao('MARIA FERNANDA', 8), 'MARIA F.')
  assert.equal(marcadorDaVaga(2, 'caio').sigla, 'P3')
  assert.equal(marcadorDaVaga(2, 'caio').rotulo, 'CAIO')
  assert.equal(marcadorDaVaga(3, '').rotulo, 'P4')
})

test('as vagas P3 e P4 deixam de ser quase iguais ao P1 para quem tem protanopia/deuteranopia (era ΔE 9)', () => {
  for (const modo of ['protanopia', 'deuteranopia']) {
    aplicarDaltonismo(modo)
    assert.ok(distancia(corDaVaga(0), corDaVaga(3), modo) > 40)
  }
})
