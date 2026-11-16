// node --test src/game/coop/__tests__/queenWifi.test.js
// A regra SINAL DE WI-FI da Queen (coop/queenWifi.js, coop/queenRegra.js), seus ataques (coop/chefes/queenAtaques.js),
// o baralho por fase e os lacaios/tenente da Expedição
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WIFI, raioDaFase, danoDoTique, sinalDeCada, arestas, barras, todosLigados, MonitorDeSinal, empurrao, janelasDeEmpurrao, janelaAgora, destinosDoReboot } from '../queenWifi.js'
import { colunaDoMuro, posicaoDaBarra } from '../chefes/queenAtaques.js'
import { rngDaRegra } from '../regraChefe.js'

const c = (j, x, y = 100, ativo = true) => ({ j, x, y, ativo })

test('raio por fase encolhe e escala com o quadro do grupo', () => {
  assert.deepEqual([0, 1, 2].map((f) => raioDaFase(f)), WIFI.raios)
  assert.ok(WIFI.raios[0] > WIFI.raios[1] && WIFI.raios[1] > WIFI.raios[2])
  assert.ok(raioDaFase(0, 436) > raioDaFase(0, 336))
  assert.equal(raioDaFase(9), WIFI.raios[2])
})

test('sinal: cada coração precisa de UM parceiro no raio (corrente); sozinho não há sinal a perder', () => {
  assert.deepEqual(sinalDeCada([c(0, 10), c(1, 500, 100, false)], 100), [])
  const s = sinalDeCada([c(0, 0), c(1, 80)], 100)
  assert.ok(s.every((x) => x.ligado))
  const longe = sinalDeCada([c(0, 0), c(1, 250)], 100)
  assert.ok(longe.every((x) => !x.ligado))
  // 3 em fila: o do meio liga os dois lados
  const fila = sinalDeCada([c(0, 0), c(1, 90), c(2, 180)], 100)
  assert.ok(fila.every((x) => x.ligado))
  assert.ok(todosLigados([c(0, 0), c(1, 90), c(2, 180)], 100))
  assert.ok(!todosLigados([c(0, 0), c(1, 90), c(2, 400)], 100))
  assert.equal(arestas([c(0, 0), c(1, 90), c(2, 180)]).length, 2)
  assert.equal(arestas([c(0, 0), c(1, 90)]).length, 1)
})

test('barras do sinal pela distância', () => {
  assert.deepEqual([40, 70, 95, 130].map((d) => barras(d, 100)), [3, 2, 1, 0])
})

test('o monitor: carência, depois um tique por intervalo, e volta ao reconectar', () => {
  const m = new MonitorDeSinal({ graca: 1000, intervalo: 500 })
  let tiques = 0
  for (let t = 0; t < 900; t += 100) tiques += m.atualizar(0, false, 100).tiques
  assert.equal(tiques, 0)
  assert.ok(m.carencia(0) > 0.8 && m.carencia(0) < 1)
  tiques += m.atualizar(0, false, 200).tiques // passou da carência
  assert.equal(tiques, 1)
  for (let t = 0; t < 1000; t += 100) tiques += m.atualizar(0, false, 100).tiques
  assert.equal(tiques, 3)
  assert.ok(m.caido(0))
  const r = m.atualizar(0, true, 16)
  assert.equal(r.voltou, true)
  assert.equal(m.carencia(0), 0)
  assert.equal(m.atualizar(0, true, 16).voltou, false)
})

test('o tique é pequeno', () => {
  assert.ok(danoDoTique(11, 1.25) <= 4)
  assert.ok(danoDoTique(1, 1) >= 1)
})

test('empurrão: cada coração para longe dos outros; colado, o lado vem do sorteio', () => {
  const cs = [c(0, 100), c(1, 200)]
  assert.ok(empurrao(cs, 0, 60, 1000).dx < 0)
  assert.ok(empurrao(cs, 1, 60, 1000).dx > 0)
  const colados = [c(0, 100), c(1, 101)]
  const a = empurrao(colados, 0, 60, 1000, 0).dx
  const b = empurrao(colados, 1, 60, 1000, 0).dx
  assert.ok(a * b < 0, 'colados vão para lados opostos')
  assert.deepEqual(empurrao([c(0, 5)], 0, 60, 1000), { dx: 0, dy: 0 })
})

test('janelas de empurrão: dentro do ataque, sem se sobrepor, iguais para a mesma semente', () => {
  for (let i = 0; i < 40; i++) {
    const rng = rngDaRegra(`s${i}`, 3, 'empurrar')
    const j = janelasDeEmpurrao(rng, 6200, { quantidade: 3, duracaoJanela: 1100 })
    assert.ok(j.length >= 1)
    j.forEach((w, k) => {
      assert.ok(w.aviso >= 0 && w.fim <= 6200)
      if (k) assert.ok(w.aviso >= j[k - 1].fim, 'o aviso da próxima só depois da anterior')
    })
    const outra = janelasDeEmpurrao(rngDaRegra(`s${i}`, 3, 'empurrar'), 6200, { quantidade: 3, duracaoJanela: 1100 })
    assert.deepEqual(j, outra)
    assert.equal(janelaAgora(j, j[0].ini + 10).tipo, 'empurra')
    assert.equal(janelaAgora(j, j[0].aviso + 10)?.tipo, j[0].aviso < j[0].ini ? 'aviso' : 'empurra')
    assert.equal(janelaAgora(j, 0), null)
  }
})

test('REBOOT: destinos determinísticos, dentro do quadro e a dupla fica além do raio', () => {
  const l = { x: 100, y: 200, width: 336, height: 180 }
  for (let i = 0; i < 40; i++) {
    for (const n of [2, 3, 4]) {
      const d = destinosDoReboot(n, l, rngDaRegra(`r${i}`, 1, 'reboot'))
      assert.equal(d.length, n)
      assert.deepEqual(d, destinosDoReboot(n, l, rngDaRegra(`r${i}`, 1, 'reboot')))
      for (const p of d) assert.ok(p.x > l.x && p.x < l.x + l.width && p.y > l.y && p.y < l.y + l.height)
    }
    const [a, b] = destinosDoReboot(2, l, rngDaRegra(`r${i}`, 1, 'reboot'))
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > WIFI.raios[0], 'separados além do raio da fase 1')
  }
})

test('muro: a coluna nunca nasce em cima de um coração e sempre cabe dentro do quadro', () => {
  const l = { left: 100, right: 436, top: 200, bottom: 380, centerX: 268, width: 336 }
  for (let i = 0; i < 300; i++) {
    const xs = [100 + 20 + ((i * 37) % 296), 100 + 20 + ((i * 91) % 296)]
    const x = colunaDoMuro(l, xs, i % 3 === 0 ? l.centerX : null)
    assert.ok(x >= l.left + 36 - 8 && x <= l.right - 36 + 8)
    for (const cx of xs) assert.ok(Math.abs(cx - x) >= 30, `muro em ${x} sobre o coração ${cx}`)
  }
  // dois corações com vão grande: o muro cai no meio
  assert.equal(colunaDoMuro(l, [140, 400]), 272)
})

test('barra do muro entra, fica e recua (fora no começo e no fim)', () => {
  const t = { entra: 700, fica: 2000, sai: 500 }
  const p = { yFora: 150, yFinal: 220 }
  assert.equal(posicaoDaBarra(p, 0, t), 150)
  assert.equal(posicaoDaBarra(p, 900, t), 220)
  assert.ok(posicaoDaBarra(p, 2900, t) < 220)
  assert.equal(posicaoDaBarra(p, 3300, t), null)
})
