// node --test src/game/pvp/__tests__/
// Duelo e CTRL+C CTRL+V em rede: as peças sem Phaser (redeMinigame.js,
// redeCopia.js, o apurar da cópia em bonus.js)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarInterpolador, ouvirRodada } from '../bonus/redeMinigame.js'
import { RedeCopia, resultadoValido } from '../bonus/redeCopia.js'
import { COPIA, caboDaCopia, apurarCopia, quantiaCopiada, copiarEnergia, resolverCopia } from '../bonus.js'
import { criarCanal } from '../../../lib/lan/canal.js'
import { criarPartida, iniciarRodada } from '../regras.js'

const esperar = (ms = 0) => new Promise((r) => setTimeout(r, ms))

// dois canais ligados um no outro (entrega no próximo tique, como a rede)
function par() {
  const canais = {}
  canais.host = criarCanal({ meuId: () => 'host', enviarBruto: (m) => setTimeout(() => canais.conv.entregar(m), 1) })
  canais.conv = criarCanal({ meuId: () => 'conv', enviarBruto: (m) => setTimeout(() => canais.host.entregar(m), 1) })
  return canais
}

// O coração do outro anda 60 px/s em x; amostras a cada 33 ms (o relógio de lá
// está 10 s adiantado: a base absorve a diferença). chegada(t) diz quando a
// amostra de t chega aqui. Devolve, quadro a quadro (16 ms), o x desenhado e
// quanto atrás do coração de verdade ele está (ms).
function simular(chegada, { ate = 4000, ...opcoes } = {}) {
  const interp = criarInterpolador(opcoes)
  const chegadas = []
  for (let t = 0; t <= ate; t += 33) chegadas.push({ chega: chegada(t), amostra: { t: t + 10000, x: t * 0.06, y: 50, vx: 60, vy: 0 } })
  chegadas.sort((a, b) => a.chega - b.chega)
  const quadros = []
  let i = 0
  for (let agora = 0; agora <= ate; agora += 16) {
    while (i < chegadas.length && chegadas[i].chega <= agora) interp.adicionar(chegadas[i++].amostra, agora)
    const p = interp.posicao(agora)
    if (p) quadros.push({ agora, x: p.x, atras: agora - p.x / 0.06 })
  }
  return quadros
}

function conferirLiso(quadros, desde) {
  let anterior = null
  for (const q of quadros) {
    if (anterior) {
      assert.ok(q.x >= anterior.x - 1e-9, `voltou para trás em ${q.agora} ms (${q.x} < ${anterior.x})`)
      // nunca mais rápido que 1,3x a velocidade de verdade (o relógio do desenho acelera no máximo 30%)
      if (q.agora > desde) assert.ok(q.x - anterior.x <= 0.06 * 16 * 1.3 + 1e-6, `pulou em ${q.agora} ms: ${(q.x - anterior.x).toFixed(2)} px`)
    }
    anterior = q
  }
}

let semente = 7
const sorte = () => ((semente = (semente * 16807) % 2147483647) / 2147483647)

test('interpolador: anda liso pelo passado com a rede variando (150 ms + até 50)', () => {
  const quadros = simular((t) => t + 150 + sorte() * 50)
  assert.equal(criarInterpolador().posicao(0), null, 'nada chegou: sem posição')
  conferirLiso(quadros, 0)
  // desenhado uns 150 da rede + a folga da variação atrás, sem exagero
  const atras = quadros.filter((q) => q.agora > 1500).map((q) => q.atras)
  assert.ok(Math.min(...atras) > 150 && Math.max(...atras) < 300, `atraso estranho: ${Math.min(...atras).toFixed(0)}..${Math.max(...atras).toFixed(0)} ms`)
})

test('interpolador: a rede entregando aos montes (de 300 em 300 ms) não faz o coração pular', () => {
  // tudo que sai num intervalo de 300 ms chega junto, 100 ms depois do fim dele
  const quadros = simular((t) => Math.ceil((t + 1) / 300) * 300 + 100, { ate: 6000 })
  // aprende a folga no primeiro monte; depois disso, liso
  conferirLiso(quadros, 1500)
  const atras = quadros.filter((q) => q.agora > 3000).map((q) => q.atras)
  assert.ok(Math.max(...atras) < 500, `atrás demais: ${Math.max(...atras).toFixed(0)} ms`)
})

test('interpolador: ignora amostra velha e para de extrapolar depois de um tempo', () => {
  const interp = criarInterpolador({ atrasoMs: 0, margemMs: 0, extrapolaMs: 100 })
  assert.equal(interp.adicionar({ t: 100, x: 0, y: 0, vx: 100, vy: 0 }, 100), true)
  assert.equal(interp.adicionar({ t: 50, x: 99, y: 99 }, 120), false, 'mais velha que a última')
  assert.equal(interp.adicionar({ t: 200, x: NaN, y: 0 }, 200), false, 'quebrada')
  assert.deepEqual(interp.posicao(150), { x: 5, y: 0, vx: 100, vy: 0 }, '50 ms adiante da última: anda com a velocidade dela')
  assert.equal(interp.posicao(5000).x, 10, 'sem nada novo, para em extrapolaMs')
})

test('ouvirRodada: só a rodada certa, guarda para quem esperar e o desligar solta as esperas', async () => {
  const { host, conv } = par()
  const vistos = []
  const r = ouvirRodada(conv, 3, { dueloAtaque: (d) => vistos.push(d.id), dueloFim: null })
  host.enviar('dueloAtaque', 2, { id: 'velho' })
  host.enviar('dueloAtaque', 3, { id: 'a' })
  host.enviar('dueloFim', 3, { motivo: 'tempo' })
  await esperar(10)
  assert.deepEqual(vistos, ['a'])
  assert.deepEqual(await r.esperar('dueloFim', 50), { motivo: 'tempo' }, 'chegou antes de pedir: fica guardada')
  assert.equal(await r.esperar('dueloAtaque2', 20), null, 'timeout: null')
  // a que chega antes de alguém ouvir fica na caixa de correio do canal
  host.enviar('dueloPronto', 3, {})
  await esperar(10)
  assert.deepEqual(await r.esperarCorreio('dueloPronto', 100), {})
  const pendente = r.esperar('nunca', 0)
  r.desligar()
  assert.equal(await pendente, null)
  host.enviar('dueloAtaque', 3, { id: 'depois' })
  await esperar(10)
  assert.deepEqual(vistos, ['a'], 'desligado não ouve mais')
})

test('ctrl+c ctrl+v: o cabo é a diferença dos apertos, presa na ponta; apurar dá quem copia e quanto', () => {
  assert.equal(caboDaCopia([5, 3]), 2)
  assert.equal(caboDaCopia([3, 5]), -2)
  assert.equal(caboDaCopia([40, 3]), COPIA.cheio)
  assert.equal(caboDaCopia([0, 40]), -COPIA.cheio)
  assert.deepEqual(apurarCopia(0), { vencedor: null, fracao: 0, quantia: 0 })
  assert.deepEqual(apurarCopia(COPIA.cheio), { vencedor: 0, fracao: 1, quantia: quantiaCopiada(1) })
  const r = apurarCopia(-5)
  assert.equal(r.vencedor, 1)
  assert.equal(r.quantia, quantiaCopiada(5 / COPIA.cheio))
})

// a parte da Copia que a RedeCopia usa, sem Phaser
function copiaFalsa(estado, lado) {
  const c = {
    cfg: COPIA,
    parado: false,
    apertos: [0, 0],
    fins: [],
    vistos: [],
    fimDoOutro: (d) => c.fins.push(d),
    apertosDoOutro: (n) => {
      c.vistos.push(n)
      c.apertos[1 - lado] = n
    },
    decidir(apertos, cabo) {
      const { vencedor, quantia } = apurarCopia(cabo)
      const energias = estado.jogadores.map((j) => j.energia)
      const { perdeu, ganhou } = vencedor === null ? { perdeu: 0, ganhou: 0 } : copiarEnergia(estado, 1 - vencedor, vencedor, quantia)
      return { apertos: [...apertos], cabo, vencedor, quantia, perdeu, ganhou, energias }
    },
  }
  return c
}

test('ctrl+c ctrl+v em rede: só o host apura e aplica; o convidado recebe o mesmo resultado', async () => {
  const { host, conv } = par()
  const estados = [0, 1].map(() => {
    const e = criarPartida({ p1: 'kris', p2: 'susie', semente: 'rede' })
    iniciarRodada(e)
    resolverCopia(e, null, null)
    e.jogadores[0].energia = 2
    e.jogadores[1].energia = 4
    return e
  })
  const copias = [copiaFalsa(estados[0], 0), copiaFalsa(estados[1], 1)]
  const curto = { prontoMs: 500, finalMs: 500, resultadoMs: 500 } // (os timers do canal seguram o node até o timeout)
  const redes = [new RedeCopia(copias[0], { canal: host, meuLado: 0, souHost: true, rodada: 6 }, curto), new RedeCopia(copias[1], { canal: conv, meuLado: 1, souHost: false, rodada: 6 }, curto)]

  // começo junto
  const prontos = Promise.all(redes.map((r) => r.sincronizarInicio()))
  assert.deepEqual(await prontos, [{}, {}])

  // apertos: cada um conta os seus e manda o total
  for (let n = 1; n <= 9; n++) redes[0].apertei(n)
  for (let n = 1; n <= 3; n++) redes[1].apertei(n)
  copias[0].apertos[0] = 9
  copias[1].apertos[1] = 3
  await esperar(10)
  assert.equal(copias[1].apertos[0], 9, 'o convidado vê os apertos do host')
  assert.equal(copias[0].apertos[1], 3, 'o host vê os do convidado')

  // o tempo acaba no host; o convidado ainda apertou mais um antes de acabar
  redes[0].acabei('tempo', 9)
  redes[0].acabei('tempo', 9) // só manda uma vez
  await esperar(10)
  assert.equal(copias[1].fins.length, 1)
  copias[1].apertos[1] = 4
  redes[1].acabei('tempo', 4)
  const [rh, rc] = await Promise.all(redes.map((r, j) => r.decidir(copias[j])))
  assert.deepEqual(rh.apertos, [9, 4], 'o host usa o total final do convidado')
  assert.equal(rh.cabo, 5)
  assert.equal(rh.vencedor, 0)
  assert.deepEqual(rc, resultadoValido(rh), 'o convidado mostra o mesmo')
  assert.deepEqual(rh.energias, [2, 4], 'energia de antes, para a animação')
  assert.equal(estados[0].jogadores[0].energia, 2 + rh.ganhou, 'host aplicou')
  assert.equal(estados[0].jogadores[1].energia, 4 - rh.perdeu)
  assert.deepEqual(
    estados[1].jogadores.map((j) => j.energia),
    [2, 4],
    'o convidado não aplica (a arena sincroniza o estado depois)',
  )
  redes.forEach((r) => r.desligar())
})

test('ctrl+c ctrl+v em rede: o outro sumiu, ninguém trava', async () => {
  const { host } = par()
  const copia = copiaFalsa(criarPartida({ p1: 'kris', p2: 'susie', semente: 'x' }), 1)
  const rede = new RedeCopia(copia, { canal: host, meuLado: 1, souHost: false, rodada: 1 }, { prontoMs: 30, finalMs: 30, resultadoMs: 30 })
  assert.equal(await rede.sincronizarInicio(), null)
  assert.equal(await rede.decidir(copia), null, 'convidado sem resultado do host: null (mostra "erro ao copiar")')
  rede.desligar()
  assert.equal(resultadoValido({ vencedor: 7 }), null)
  assert.equal(resultadoValido(null), null)
})
