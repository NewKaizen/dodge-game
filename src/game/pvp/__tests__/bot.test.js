// node --test src/game/pvp/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarPartida, iniciarRodada, podeJogar, resolverRodada, aplicarDano, fimDaRodada, cartasJogaveis } from '../regras.js'
import { escolherJogada, notaDaCarta, NIVEIS_BOT } from '../bot.js'
import { EsquivaBot, folgaBala } from '../botEsquiva.js'
import { criarRng } from '../baralho.js'

function naMao(estado, j, id) {
  const b = estado.jogadores[j].baralho
  for (const pilha of ['monte', 'descarte', 'mao']) {
    const i = b[pilha].findIndex((c) => c.id === id)
    if (i >= 0) {
      const [c] = b[pilha].splice(i, 1)
      b.mao.push(c)
      return c
    }
  }
  throw new Error(`carta ${id} não existe`)
}

function partida(p1 = 'kris', p2 = 'susie', energia = 10) {
  const e = criarPartida({ p1, p2, semente: 'bot' })
  iniciarRodada(e)
  e.jogadores.forEach((j) => (j.energia = energia))
  return e
}

test('o bot sempre devolve uma jogada válida, em todos os níveis e personagens', () => {
  for (const nivel of Object.keys(NIVEIS_BOT)) {
    for (const p of ['kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel']) {
      const e = criarPartida({ p1: 'kris', p2: p, semente: `v:${nivel}:${p}` })
      const rng = criarRng(`r:${nivel}:${p}`)
      for (let r = 0; r < 25 && !e.vencedor; r++) {
        iniciarRodada(e)
        const a = escolherJogada(e, 0, { nivel, rng })
        const b = escolherJogada(e, 1, { nivel, rng })
        assert.ok(podeJogar(e, 0, a).ok, `${nivel} ${p} P1 rodada ${r}: ${a}`)
        assert.ok(podeJogar(e, 1, b).ok, `${nivel} ${p} P2 rodada ${r}: ${b}`)
        const res = resolverRodada(e, a, b)
        res.caixas.forEach((c, j) => c && aplicarDano(e, j, c.dano * 3))
        fimDaRodada(e)
      }
    }
  }
})

test('sem energia para nada, o bot passa', () => {
  const e = partida('kris', 'susie', 0)
  assert.equal(cartasJogaveis(e, 1).length, 0)
  assert.equal(escolherJogada(e, 1), null)
})

test('HP baixo: o bot prefere curar/segunda chance a atacar fraco', () => {
  const e = partida('kris', 'susie', 10)
  e.jogadores[1].hp = 10
  const asCopas = naMao(e, 1, 'susie-copas-1')
  const fraca = e.jogadores[1].baralho.mao.find((c) => c.naipe === 'espadas' && c.valor <= 5) ?? naMao(e, 1, 'susie-espadas-2')
  assert.ok(notaDaCarta(e, 1, asCopas) > notaDaCarta(e, 1, fraca))
  assert.equal(escolherJogada(e, 1, { nivel: 'dificil', rng: criarRng('hp') }), asCopas.id)
})

test('HP cheio: segunda chance quase não vale nada', () => {
  const e = partida('kris', 'susie', 10)
  const asCopas = naMao(e, 1, 'susie-copas-1')
  assert.ok(notaDaCarta(e, 1, asCopas) < 1)
})

test('carta de ataque mais forte tem nota maior', () => {
  const e = partida('kris', 'susie', 10)
  const fraca = naMao(e, 1, 'susie-espadas-2')
  const forte = naMao(e, 1, 'susie-espadas-13')
  assert.ok(notaDaCarta(e, 1, forte) > notaDaCarta(e, 1, fraca))
})

// ---------- esquiva ----------

const LIMITES = { left: 100, right: 320, top: 100, bottom: 270 }
const bala = (o) => ({ tipo: 'circulo', raio: 6, vx: 0, vy: 0, ax: 0, ay: 0, idade: 1000, aviso: 0, ...o })

test('folgaBala bate com a distância até a borda', () => {
  assert.equal(folgaBala(bala({ x: 0, y: 0 }), 10, 0), 4)
  assert.equal(folgaBala({ tipo: 'retangulo', x: 0, y: 0, largura: 10, altura: 10 }, 8, 0), 3)
  assert.ok(Math.abs(folgaBala({ tipo: 'segmento', x: 0, y: 0, comprimento: 20, espessura: 4, angulo: 0 }, 5, 6) - 4) < 1e-9)
})

test('a esquiva sai da frente de uma bala vindo direto no coração', () => {
  const bot = new EsquivaBot({ nivel: 'dificil', sorte: () => 0.99 })
  const coracao = { x: 210, y: 185, hitbox: 5 }
  const balas = [bala({ x: 210, y: 110, vy: 220 })] // de cima, na mesma coluna
  const joy = bot.joy(16, { coracao, limites: LIMITES, balas, velocidade: 180 })
  assert.ok(Math.abs(joy.x) > 30, `deveria desviar para o lado: ${JSON.stringify(joy)}`)
})

test('sem balas, a esquiva volta para o centro', () => {
  const bot = new EsquivaBot({ nivel: 'normal', sorte: () => 0.99 })
  const joy = bot.joy(16, { coracao: { x: 112, y: 262, hitbox: 5 }, limites: LIMITES, balas: [], velocidade: 180 })
  assert.ok(joy.x > 0 && joy.y < 0, JSON.stringify(joy))
})

test('bala ainda telegrafando não assusta o bot', () => {
  const bot = new EsquivaBot({ nivel: 'dificil', sorte: () => 0.99 })
  const coracao = { x: 210, y: 185, hitbox: 5 }
  // longe do coração e só começa a andar daqui a 2 s
  const balas = [bala({ x: 210, y: 120, vy: 200, idade: 0, aviso: 2000 })]
  const joy = bot.joy(16, { coracao, limites: LIMITES, balas, velocidade: 180 })
  assert.deepEqual(joy, { x: 0, y: 0 })
})

test('controles invertidos: o bot compensa a inversão da arena', () => {
  const situacao = { coracao: { x: 112, y: 262, hitbox: 5 }, limites: LIMITES, balas: [], velocidade: 180 }
  const normal = new EsquivaBot({ nivel: 'dificil', sorte: () => 0.99 }).joy(16, situacao)
  const invertido = new EsquivaBot({ nivel: 'dificil', sorte: () => 0.99 }).joy(16, { ...situacao, invertido: true })
  assert.deepEqual(invertido, { x: -normal.x, y: -normal.y })
})

test('uma esquiva simulada leva bem menos acertos que ficar parado', () => {
  // chuva de balas caindo em colunas; conta quantas tocariam o coração
  const rodar = (mover) => {
    const bot = new EsquivaBot({ nivel: 'normal', sorte: criarRngFn('chuva') })
    const coracao = { x: 210, y: 240, hitbox: 5 }
    const balas = []
    const rng = criarRngFn('balas')
    let acertos = 0
    for (let t = 0; t < 8000; t += 16) {
      if (t % 180 === 0) balas.push(bala({ x: 110 + rng() * 200, y: 95, vy: 170 }))
      const joy = mover ? bot.joy(16, { coracao, limites: LIMITES, balas, velocidade: 180 }) : { x: 0, y: 0 }
      const n = Math.min(1, Math.hypot(joy.x, joy.y) / 100) || 1
      const d = Math.hypot(joy.x, joy.y) || 1
      coracao.x = Math.max(108, Math.min(312, coracao.x + (joy.x / d) * n * 180 * 0.016))
      coracao.y = Math.max(108, Math.min(262, coracao.y + (joy.y / d) * n * 180 * 0.016))
      for (const b of balas) {
        b.y += b.vy * 0.016
        if (!b.morta && folgaBala(b, coracao.x, coracao.y) <= 5) {
          b.morta = true
          acertos++
        }
      }
    }
    return acertos
  }
  const parado = rodar(false)
  const desviando = rodar(true)
  assert.ok(desviando < parado / 3, `parado ${parado}, desviando ${desviando}`)
})

function criarRngFn(semente) {
  let s = 0
  for (const ch of semente) s = (s * 31 + ch.charCodeAt(0)) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
