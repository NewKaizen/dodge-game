import { test } from 'node:test'
import assert from 'node:assert/strict'
import superAsriel, { PADRAO } from '../attacks/super/asriel.js'
import { angulosDosRaios, angulosDoMeio, menorFatia } from '../attacks/super/asrielGeometria.js'
import { projetar } from '../attacks/super/previsao.js'
import { LACUNA_MINIMA } from '../attacks/validacao.js'
import { ATAQUE, CAIXA } from '../constants.js'

const TAU = Math.PI * 2
const C = PADRAO.caos
const N = PADRAO.nova
const diagonal = Math.hypot(CAIXA.largura, CAIXA.altura) / 2

// sorteio determinístico (mulberry32) em -1..1
function sorteio(semente) {
  let a = semente
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1
  }
}

test('Caos Final: raios têm fatias livres de pelo menos a lacuna mínima, para qualquer sorteio', () => {
  for (let s = 1; s <= 300; s++) {
    const r = sorteio(s)
    const angulos = angulosDosRaios(C.raios, (r() + 1) * Math.PI, C.jitter, r)
    assert.equal(angulos.length, C.raios)
    assert.ok(menorFatia(angulos) >= TAU / C.raios - 2 * C.jitter - 1e-9, `semente ${s}`)
    assert.ok(menorFatia(angulos) * C.raioLacuna >= LACUNA_MINIMA, `fatia curta na semente ${s}`)
  }
})

test('Caos Final: a 2ª onda cai no meio das fatias da 1ª (nunca em cima de um raio)', () => {
  for (let s = 1; s <= 100; s++) {
    const r = sorteio(s * 31)
    const primeira = angulosDosRaios(C.raios, (r() + 1) * Math.PI, C.jitter, r)
    const segunda = angulosDoMeio(primeira)
    assert.equal(segunda.length, primeira.length)
    // cada ângulo da 2ª onda fica a pelo menos metade da menor fatia de qualquer raio da 1ª
    const meia = menorFatia(primeira) / 2 - 1e-9
    for (const m of segunda) {
      for (const p of primeira) {
        const d = Math.abs(((m - p + Math.PI) % TAU + TAU) % TAU - Math.PI)
        assert.ok(d >= meia, `onda 2 em cima de um raio (semente ${s})`)
      }
    }
  }
})

test('SUPER do Asriel: toda abertura medida e todo aviso respeitam os mínimos do jogo', () => {
  assert.ok(N.abertura * N.raioNo >= LACUNA_MINIMA, 'brecha do anel')
  for (const [nome, ms] of Object.entries({
    espiral: PADRAO.espiral.aviso,
    anel: N.aviso,
    cadente: N.cadentes.aviso,
    jato: PADRAO.jatos.aviso,
    vazio: PADRAO.vazio.aviso,
    'raios 1ª onda': C.aviso,
    'raios 2ª onda': C.avisoSegunda,
  })) {
    assert.ok(ms >= ATAQUE.telegrafoMs, `${nome}: aviso de ${ms}ms (mínimo ${ATAQUE.telegrafoMs}ms)`)
  }
  // o jato é uma fileira de estrelas lado a lado: fica uma faixa estreita da caixa, o resto está livre
  const J = PADRAO.jatos
  assert.ok((J.largura - 1) * J.abertura + 14 <= CAIXA.altura / 3)
})

test('SUPER do Asriel: a pausa do meio da onda foi desligada e o Caos Final cabe na duração', () => {
  const at = superAsriel()
  assert.equal(at.respiro.meio, 0)
  assert.equal(at.ativa, 9800)
  // 2ª onda de raios dispara, a última coluna sai e atravessa a caixa antes do fim
  const fim = C.inicio + C.aviso + C.avisoSegunda + (C.coluna - 1) * C.espaco + ((diagonal - C.raioNo) / C.velocidade) * 1000
  assert.ok(fim <= at.ativa, `Caos Final acaba em ${Math.round(fim)} ms (duração ${at.ativa})`)
})

test('SUPER do Asriel: o último anel já saiu da caixa quando os primeiros raios disparam (rota de fuga)', () => {
  // o último anel (duplo, 170 ms depois) pisca `aviso`, anda `velocidade` px/s e some ao passar da diagonal
  const ultimoAnel = N.colapso + N.atrasoAnel + (N.aneis - 1) * N.intervalo + 170
  const saiu = ultimoAnel + N.aviso + ((diagonal - N.raioNo) / N.velocidade) * 1000
  const primeiroRaio = C.inicio + C.aviso
  assert.ok(saiu <= primeiroRaio, `anel sai em ${Math.round(saiu)} ms, raios disparam em ${primeiroRaio} ms`)
})

test('SUPER do Asriel: a 2ª onda só é riscada depois que a 1ª dispara e os atos se encadeiam sem pausa', () => {
  assert.ok(C.inicio > N.colapso)
  assert.ok(N.colapso + N.atrasoAnel < N.colapso + 1000, 'o 1º anel sai logo depois do colapso')
  assert.ok(PADRAO.vazio.tempos.every((t) => t < N.colapso), 'o vazio acaba de crescer antes do colapso')
})

test('previsão: o ponto mirado fica a no máximo maxDist do coração e dentro da caixa', () => {
  const caixa = { left: 0, right: 240, top: 0, bottom: 160 }
  const p = projetar({ x: 230, y: 150 }, { vx: 500, vy: 500 }, 800, caixa)
  assert.ok(p.x <= 230 && p.y <= 150, 'não passa da borda')
  const q = projetar({ x: 100, y: 80 }, { vx: 300, vy: 0 }, 1000, caixa, { maxDist: 56 })
  assert.ok(Math.hypot(q.x - 100, q.y - 80) <= 56 + 1e-9)
})
