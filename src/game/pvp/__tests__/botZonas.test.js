// node --test src/game/pvp/__tests__/
// Zonas de perigo (attacks/zonas.js) e a CPU lendo os avisos (pvp/botEsquiva.js)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zonaDaForma, registrarZona, envelhecerZonas, limparZonas, folgaZona } from '../../attacks/zonas.js'
import { EsquivaBot, custoZonaPendente, zonaDaBalaPiscando, folgaBala } from '../botEsquiva.js'

const LIMITES = { left: 100, right: 320, top: 100, bottom: 270 }
const perto = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol
const semSorte = () => 0.99 // sem erro nem lapso: o bot sempre pensa
const zona = (forma, o = {}) => ({ ...zonaDaForma(forma, { ms: 400, ...o }), idade: o.idade ?? 1000 })

test('folgaZona: positiva fora, negativa dentro (o quanto falta para sair)', () => {
  const c = zonaDaForma({ tipo: 'circulo', x: 0, y: 0, raio: 10 })
  assert.equal(folgaZona(c, 15, 0), 5)
  assert.equal(folgaZona(c, 4, 0), -6)
  // área: x, y é o canto; a zona guarda o centro
  const r = zonaDaForma({ tipo: 'area', x: 0, y: 0, largura: 100, altura: 40 })
  assert.equal(folgaZona(r, 50, 10), -10) // 10px da borda de cima
  assert.equal(folgaZona(r, 50, 50), 10)
  assert.equal(folgaZona(r, 103, 44), 5) // quina: 3-4-5
  // linha com espessura (meia espessura mínima de 6)
  const l = zonaDaForma({ tipo: 'linha', x1: 0, y1: 0, x2: 100, y2: 0, espessura: 20 })
  assert.equal(folgaZona(l, 50, 4), -6)
  assert.equal(folgaZona(l, 50, 30), 20)
  assert.equal(folgaZona(l, -30, 0), 20) // depois da ponta
  assert.equal(zonaDaForma({ tipo: 'linha', x1: 0, y1: 0, x2: 10, y2: 0, espessura: 2 }).meia, 6)
  // leque de 90° apontando para a direita
  const f = zonaDaForma({ tipo: 'leque', x: 0, y: 0, raio: 50, angulo: 0, abertura: Math.PI / 4 })
  assert.ok(folgaZona(f, 30, 0) < 0)
  assert.ok(perto(folgaZona(f, 60, 0), 10))
  assert.ok(folgaZona(f, -20, 0) > 0) // atrás do vértice
  assert.ok(folgaZona(f, 10, 40) > 0) // fora da fatia, ao lado
  assert.equal(zonaDaForma({ tipo: 'nada' }), null)
})

test('registrarZona / envelhecerZonas: relógio, respiro, vencimento e fim do timer', () => {
  const balas = {}
  const z = registrarZona(balas, { tipo: 'circulo', x: 0, y: 0, raio: 10 }, { ms: 300, dura: 100 })
  assert.equal(balas.zonas.length, 1)
  envelhecerZonas(balas, 100)
  assert.equal(z.falta, 200)
  assert.equal(z.idade, 100)
  envelhecerZonas(balas, 100, { parada: () => true }) // respiro: o relógio dela para
  assert.equal(z.falta, 200)
  envelhecerZonas(balas, 300) // valendo
  assert.equal(balas.zonas.length, 1)
  envelhecerZonas(balas, 200) // passou da duração (+ margem): some
  assert.equal(balas.zonas.length, 0)
  // o contexto que criou a zona acabou antes dela valer: some (o golpe não vem mais)
  const w = registrarZona(balas, { tipo: 'circulo', x: 0, y: 0, raio: 10 }, { ms: 500 })
  w.fim = 1000
  envelhecerZonas(balas, 16, { tempo: 900 })
  assert.equal(balas.zonas.length, 1)
  envelhecerZonas(balas, 16, { tempo: 1001 })
  assert.equal(balas.zonas.length, 0)
  registrarZona(balas, { tipo: 'circulo', x: 0, y: 0, raio: 10 }, { ms: 500 })
  limparZonas(balas)
  assert.equal(balas.zonas.length, 0)
})

test('custo de zona pendente: mais fundo e menos tempo para sair custa mais; fora não custa', () => {
  const z = zona({ tipo: 'area', x: 100, y: 185, largura: 220, altura: 85 })
  const opcoes = { ms: 300, seguro: 10, velocidade: 180 }
  assert.equal(custoZonaPendente(z, 210, 150, opcoes), 0)
  const raso = custoZonaPendente(z, 210, 190, opcoes)
  const fundo = custoZonaPendente(z, 210, 230, opcoes)
  assert.ok(fundo > raso && raso > 0)
  const depois = custoZonaPendente({ ...z, falta: 1500 }, 210, 230, opcoes)
  assert.ok(depois < fundo / 5, `${depois} x ${fundo}`)
  assert.equal(custoZonaPendente({ ...z, falta: 200 }, 210, 230, opcoes), 0) // já vale no fim do caminho
})

// faixa de cima da caixa até um pouco abaixo do centro (onde o coração está):
// sem avisos o bot ficaria parado no centro; a saída é para baixo
const FAIXA = { tipo: 'area', x: 100, y: 100, largura: 220, altura: 100 }
const NO_CENTRO = { x: 210, y: 185, hitbox: 5 }

// Move o coração com o joystick do bot até a zona valer; devolve onde ele está
function ateValer(nivel, coracao, z) {
  const bot = new EsquivaBot({ nivel, sorte: semSorte })
  const c = { ...coracao }
  while (z.falta > 0) {
    const joy = bot.joy(16, { coracao: c, limites: LIMITES, balas: [], zonas: [z], velocidade: 180 })
    const d = Math.hypot(joy.x, joy.y) || 1
    const n = Math.min(1, d / 100)
    c.x = Math.max(108, Math.min(312, c.x + (joy.x / d) * n * 180 * 0.016))
    c.y = Math.max(108, Math.min(262, c.y + (joy.y / d) * n * 180 * 0.016))
    z.falta -= 16
    z.idade += 16
  }
  return c
}

test('a CPU sai de uma área vermelha antes de ela valer', () => {
  for (const nivel of ['facil', 'normal', 'dificil']) {
    const parado = new EsquivaBot({ nivel, sorte: semSorte }).joy(16, { coracao: NO_CENTRO, limites: LIMITES, balas: [], zonas: [], velocidade: 180 })
    assert.deepEqual(parado, { x: 0, y: 0 })
    for (const forma of [FAIXA, { tipo: 'linha', x1: 210, y1: 100, x2: 210, y2: 270, espessura: 30 }, { tipo: 'circulo', x: 205, y: 190, raio: 40 }]) {
      const z = zona(forma, { ms: 600 })
      const c = ateValer(nivel, NO_CENTRO, z)
      assert.ok(folgaZona(z, c.x, c.y) > NO_CENTRO.hitbox, `${nivel} ${forma.tipo}: ficou em ${Math.round(c.x)},${Math.round(c.y)}`)
    }
  }
  // a faixa de cima só tem saída por baixo
  const joy = new EsquivaBot({ nivel: 'normal', sorte: semSorte }).joy(16, { coracao: NO_CENTRO, limites: LIMITES, balas: [], zonas: [zona(FAIXA, { ms: 450 })], velocidade: 180 })
  assert.ok(joy.y > 30, JSON.stringify(joy))
  // zona que já passou (valeu e acabou): não assusta
  const velha = new EsquivaBot({ nivel: 'dificil', sorte: semSorte }).joy(16, { coracao: NO_CENTRO, limites: LIMITES, balas: [], zonas: [zona(FAIXA, { ms: -400, dura: 200 })], velocidade: 180 })
  assert.deepEqual(velha, { x: 0, y: 0 })
})

test('reação humana: o imbatível vê o aviso cedo, o fácil só depois; avisos distantes não assustam', () => {
  const foge = (nivel, o) => {
    const joy = new EsquivaBot({ nivel, sorte: semSorte }).joy(16, { coracao: NO_CENTRO, limites: LIMITES, balas: [], zonas: [zona(FAIXA, o)], velocidade: 180 })
    return Math.hypot(joy.x, joy.y) > 50
  }
  // acabou de aparecer (150 ms na tela)
  assert.ok(foge('imbativel', { ms: 450, idade: 150 }))
  assert.ok(!foge('facil', { ms: 450, idade: 150 }))
  // vale só daqui a 1,1 s: o imbatível já sai, o fácil ainda não liga
  assert.ok(foge('imbativel', { ms: 1100 }))
  assert.ok(!foge('facil', { ms: 1100 }))
  // a CPU do DIFÍCIL nota um aviso já assentado (300 ms na tela) que vale logo
  assert.ok(foge('dificil', { ms: 450, idade: 300 }))
  // daqui a 3 s: ninguém liga
  for (const nivel of ['facil', 'normal', 'dificil', 'imbativel']) assert.ok(!foge(nivel, { ms: 3000 }), nivel)
})

test('tudo vermelho: a CPU não trava (escolhe o caminho menos ruim)', () => {
  const bot = new EsquivaBot({ nivel: 'dificil', sorte: semSorte })
  const zonas = [zona({ tipo: 'area', x: 90, y: 90, largura: 240, altura: 190 }, { ms: 200 }), zona({ tipo: 'circulo', x: 210, y: 185, raio: 300 }, { ms: -50 })]
  const joy = bot.joy(16, { coracao: { x: 210, y: 185, hitbox: 5 }, limites: LIMITES, balas: [], zonas, velocidade: 180 })
  assert.ok(Number.isFinite(joy.x) && Number.isFinite(joy.y), JSON.stringify(joy))
  assert.ok(Math.abs(joy.x) <= 100 && Math.abs(joy.y) <= 100)
})

test('bala piscando: o bot enxerga o caminho dela e sai da frente antes de ela partir', () => {
  const b = { tipo: 'circulo', raio: 6, x: 210, y: 105, vx: 0, vy: 260, ax: 0, ay: 0, idade: 100, aviso: 800 }
  const z = zonaDaBalaPiscando(b)
  assert.equal(z.falta, 700)
  assert.ok(folgaZona(z, 210, 160) < 0 && folgaZona(z, 240, 160) > 0)
  assert.equal(zonaDaBalaPiscando({ ...b, idade: 900 }), null) // já partiu: é bala comum
  // lâmina parada: a própria lâmina
  const lam = zonaDaBalaPiscando({ tipo: 'segmento', x: 0, y: 0, comprimento: 40, espessura: 8, angulo: 0, vx: 0, vy: 0, idade: 0, aviso: 600 })
  assert.ok(perto(folgaZona(lam, 10, 0), -4) && perto(folgaZona(lam, 30, 0), 6))
  const bot = new EsquivaBot({ nivel: 'imbativel', sorte: semSorte })
  const joy = bot.joy(16, { coracao: { x: 210, y: 160, hitbox: 5 }, limites: LIMITES, balas: [b], velocidade: 180 })
  assert.ok(Math.abs(joy.x) > 30, JSON.stringify(joy))
})

test('com os avisos, a CPU difícil leva bem menos golpes de área', () => {
  // "pisões": uma faixa (horizontal ou vertical) da caixa avisa 600 ms e
  // machuca por 250 ms. Sem enxergar as zonas o bot só vê o golpe quando ele já vale.
  const rodar = (veAvisos) => {
    const rng = rngDe('pisoes')
    const bot = new EsquivaBot({ nivel: 'dificil', sorte: rngDe('bot') })
    const coracao = { x: 210, y: 240, hitbox: 5 }
    let zonas = []
    let golpes = []
    let acertos = 0
    let invencivel = 0
    for (let t = 0; t < 20000; t += 16) {
      if (t % 1100 === 0) {
        const vertical = rng() < 0.5
        const f = vertical
          ? { tipo: 'area', x: coracao.x - 40 + rng() * 30, y: 100, largura: 60, altura: 170 }
          : { tipo: 'area', x: 100, y: coracao.y - 35 + rng() * 25, largura: 220, altura: 55 }
        zonas.push(zonaDaForma(f, { ms: 600, dura: 250 }))
      }
      // golpe valendo = bala retangular parada no lugar da zona
      golpes = zonas.filter((z) => z.falta <= 0).map((z) => ({ tipo: 'retangulo', x: z.x, y: z.y, largura: z.largura, altura: z.altura, vx: 0, vy: 0, idade: 1, aviso: 0 }))
      const joy = bot.joy(16, { coracao, limites: LIMITES, balas: golpes, zonas: veAvisos ? zonas : [], velocidade: 180 })
      const d = Math.hypot(joy.x, joy.y) || 1
      const n = Math.min(1, d / 100)
      coracao.x = Math.max(108, Math.min(312, coracao.x + (joy.x / d) * n * 180 * 0.016))
      coracao.y = Math.max(108, Math.min(262, coracao.y + (joy.y / d) * n * 180 * 0.016))
      invencivel -= 16
      if (invencivel <= 0 && golpes.some((g) => folgaBala(g, coracao.x, coracao.y) <= coracao.hitbox)) {
        acertos++
        invencivel = 400
      }
      for (const z of zonas) {
        z.falta -= 16
        z.idade += 16
      }
      zonas = zonas.filter((z) => z.falta > -z.dura)
    }
    return acertos
  }
  const cego = rodar(false)
  const lendo = rodar(true)
  assert.ok(lendo < cego / 2, `cego ${cego}, lendo os avisos ${lendo}`)
})

function rngDe(semente) {
  let s = 0
  for (const ch of semente) s = (s * 31 + ch.charCodeAt(0)) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
