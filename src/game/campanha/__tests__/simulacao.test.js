// node --test src/game/campanha/__tests__/simulacao.test.js
// A esquiva da campanha: (1) as balas andam pelas MESMAS regras do jogo (manual/onda.js, que o
// manual/__tests__/paridade.test.js já confere contra as classes Balas e Heart reais); (2) o servidor,
// só com as amostras, refaz os acertos do navegador (paridade); (3) os modelos seguem as regras de
// justiça (nascem fora ou avisam, parede com vão, velocidade com teto, "de cima" é de cima).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarSimulacao, simularComAmostras, simularCpu, inicioDaCaixa } from '../simulacao.js'
import { criarRoteiro, ATACAVEL_NO_SERVIDOR, atacavelNoServidor, limitesDaCaixa, VELOCIDADE_MAX, BURACO, RAIO, ataqueDaCartaNaCampanha, LACUNA_MINIMA, comAssinatura, comFuria, AVISO_FEIXE, AVISO_ESTILHACO, DISTANCIA_FEIXES, LARGURA_FEIXE } from '../ataques.js'
import { ler, PASSO_MS } from '../amostras.js'
import { CAIXA_CAMPANHA, caixaDaRodada } from '../partida.js'
import { criarOnda } from '../../manual/onda.js'
import { ATAQUE } from '../../constants.js'
import { faseDe } from '../mundos/index.js'
import { cartasDoPersonagem } from '../../pvp/cartas.js'
import { desviar } from './apoio.js'

const caixa = CAIXA_CAMPANHA
const at = (modelos, extra = {}) => ({ modelos, forca: 0.7, duracao: 6000, caixa, semente: 'paridade', ...extra })

test('o registro: todo modelo da campanha é simulável no servidor', () => {
  assert.deepEqual([...ATACAVEL_NO_SERVIDOR].sort(), ['chuva', 'estilhacos', 'feixes', 'galhos', 'redemoinho', 'sementes'])
  assert.equal(atacavelNoServidor('rain'), false) // os ataques do PvP (Phaser) não são
  for (const carta of cartasDoPersonagem('asriel')) {
    const a = ataqueDaCartaNaCampanha(carta, { duplo: true })
    if (a) assert.ok(a.modelos.every(atacavelNoServidor), carta.id)
  }
})

test('as balas andam igual às do jogo (manual/onda.js = Balas reais)', () => {
  for (const id of ATACAVEL_NO_SERVIDOR) {
    const s = criarSimulacao(at([id]))
    const onda = criarOnda(caixa)
    const r = criarRoteiro(at([id]))
    const alvo = inicioDaCaixa(caixa)
    let t = 0
    while (t < 6000) {
      t += PASSO_MS
      for (const o of r.gerar(t, alvo)) onda.bala(o)
      s.passo(null, alvo)
      onda.passo(PASSO_MS, null)
      assert.equal(s.lista.length, onda.lista.length, `${id} t=${t}`)
      s.lista.forEach((b, i) => {
        assert.ok(Math.abs(b.x - onda.lista[i].x) < 1e-9 && Math.abs(b.y - onda.lista[i].y) < 1e-9, `${id} t=${t} bala ${i}`)
      })
    }
  }
})

test('paridade: o servidor refaz os acertos do navegador só com as amostras', () => {
  let rodadas = 0
  let iguais = 0
  let acertosCliente = 0
  for (const id of ATACAVEL_NO_SERVIDOR) {
    for (const piloto of ['bom', 'zigue', 'parado', 'reto']) {
      for (let k = 0; k < 4; k++) {
        const a = at([id], { semente: `p:${id}:${piloto}:${k}`, forca: 0.3 + k * 0.2 })
        const cliente = desviar(a, { piloto })
        const servidor = simularComAmostras(a, ler(cliente.amostras))
        rodadas++
        acertosCliente += cliente.acertos
        if (servidor.acertos === cliente.acertos) iguais++
        // o servidor é o piso generoso: nunca acha MAIS acertos do que o navegador sentiu (com folga de 1)
        assert.ok(servidor.acertos <= cliente.acertos + 1, `${id}/${piloto}/${k}: servidor ${servidor.acertos} > cliente ${cliente.acertos}`)
      }
    }
  }
  assert.ok(acertosCliente > 30, `os pilotos precisam levar acertos para o teste valer (${acertosCliente})`)
  assert.ok(iguais / rodadas >= 0.8, `iguais em ${iguais}/${rodadas}`)
})

test('paridade exata quando o coração anda em linha reta (as amostras pegam tudo)', () => {
  for (const id of ATACAVEL_NO_SERVIDOR) {
    for (const piloto of ['parado', 'reto']) {
      const a = at([id], { semente: `reto:${id}` })
      const cliente = desviar(a, { piloto })
      const servidor = simularComAmostras(a, ler(cliente.amostras), { hitbox: 4.2 })
      assert.equal(servidor.acertos, cliente.acertos, `${id}/${piloto}`)
    }
  }
})

test('mesma semente, mesmas balas; semente diferente, balas diferentes', () => {
  const lista = (semente) => {
    const r = criarRoteiro(at(['chuva', 'sementes'], { semente }))
    const out = []
    for (let t = 0; t < 6000; t += 16) out.push(...r.gerar(t, { x: 300, y: 300 }).map((o) => `${o.x.toFixed(3)},${o.y.toFixed(3)}`))
    return out.join(' ')
  }
  assert.equal(lista('a'), lista('a'))
  assert.notEqual(lista('a'), lista('b'))
})

test('regras de justiça: fora ou com aviso, vão >= LACUNA_MINIMA, teto de velocidade, "de cima"', () => {
  assert.ok(BURACO >= LACUNA_MINIMA)
  const caixas = [CAIXA_CAMPANHA, caixaDaRodada(faseDe(1, 2), 8), caixaDaRodada(faseDe(1, 6), 3, { virou: true })]
  for (const cx of caixas) {
    const l = limitesDaCaixa(cx)
    for (const id of ATACAVEL_NO_SERVIDOR) {
      for (const soDeCima of [false, true]) {
        for (const forca of [0.3, 1]) {
          const r = criarRoteiro({ modelos: [id], forca, duracao: 7000, caixa: cx, semente: `j:${id}`, soDeCima })
          const alvo = { x: l.left + 30, y: l.bottom - 20 }
          for (let t = 0; t <= 7000; t += 16) {
            const nascidas = r.gerar(t, alvo)
            for (const o of nascidas) {
              const dentro = o.x > l.left && o.x < l.right && o.y > l.top && o.y < l.bottom
              assert.ok(!dentro || (o.aviso ?? 0) >= ATAQUE.telegrafoMs, `${id}: nasce dentro sem aviso`)
              assert.ok(Math.hypot(o.vx ?? 0, o.vy ?? 0) <= VELOCIDADE_MAX + 1e-9, `${id}: rápida demais`)
              if (soDeCima) assert.ok(o.y < l.top && (o.vy ?? 0) > 0 && Math.abs(o.vx ?? 0) <= Math.abs(o.vy) * 3, `${id}: soDeCima nasceu em (${o.x}, ${o.y})`)
            }
            // uma parede (galhos): o maior vão entre as bolinhas tem pelo menos BURACO
            if (nascidas.length > 3 && nascidas.every((o) => o.extra?.tipo === 'galho')) {
              const eixo = nascidas[0].vy ? 'x' : 'y'
              const [de, ate] = eixo === 'x' ? [l.left, l.right] : [l.top, l.bottom]
              const ps = nascidas.map((o) => o[eixo]).sort((a, b) => a - b)
              const vaos = [ps[0] - RAIO - de, ...ps.slice(1).map((p, i) => p - ps[i] - 2 * RAIO), ate - (ps.at(-1) + RAIO)]
              assert.ok(Math.max(...vaos) >= BURACO - 1e-6, `${id}: vão ${Math.max(...vaos)}`)
            }
          }
        }
      }
    }
  }
})

test('a CPU desvia de forma determinística (mesma semente, mesmo resultado) e às vezes leva acerto', () => {
  const a = at(['redemoinho'], { forca: 1 })
  const x = simularCpu(a, { nivel: 'facil', semente: 's' })
  const y = simularCpu(a, { nivel: 'facil', semente: 's' })
  assert.deepEqual(x, y)
  let total = 0
  for (let k = 0; k < 6; k++) total += simularCpu(at(['redemoinho'], { forca: 1, semente: `c${k}` }), { nivel: 'facil', semente: `c${k}` }).acertos
  assert.ok(total > 0)
  // as amostras da CPU também passam na conferência de plausibilidade
  assert.ok(ler(x.amostras).length > 50)
})

test('feixes: avisam (parados) antes de acender, cruzam a caixa, e dois da mesma leva deixam passagem', () => {
  for (const cx of [CAIXA_CAMPANHA, caixaDaRodada(faseDe(1, 2), 8)]) {
    const l = limitesDaCaixa(cx)
    const r = criarRoteiro({ modelos: ['feixes'], forca: 1, duracao: 7000, caixa: cx, semente: 'fx' })
    let levas = 0
    for (let t = 0; t <= 7000; t += 16) {
      const nascidas = r.gerar(t, { x: l.left + 40, y: l.bottom - 30 })
      if (!nascidas.length) continue
      levas++
      for (const o of nascidas) {
        assert.ok(o.aviso >= AVISO_FEIXE && AVISO_FEIXE >= ATAQUE.telegrafoMs)
        assert.ok(!o.vx && !o.vy && Number.isFinite(o.vida))
        assert.ok(o.x - o.largura / 2 >= l.left - 3 && o.x + o.largura / 2 <= l.right + 3 && o.y - o.altura / 2 >= l.top - 3 && o.y + o.altura / 2 <= l.bottom + 3)
      }
      const eixo = nascidas[0].extra.vertical ? 'x' : 'y'
      const ps = nascidas.map((o) => o[eixo]).sort((a, b) => a - b)
      for (let i = 1; i < ps.length; i++) assert.ok(ps[i] - ps[i - 1] >= DISTANCIA_FEIXES && ps[i] - ps[i - 1] - LARGURA_FEIXE >= LACUNA_MINIMA - 12)
    }
    assert.ok(levas >= 3, `levas ${levas}`)
  }
})

test('estilhaços: o cristal nasce longe do coração (quando cabe) e avisa antes de estourar', () => {
  const l = limitesDaCaixa(CAIXA_CAMPANHA)
  const r = criarRoteiro({ modelos: ['estilhacos'], forca: 0.8, duracao: 7000, caixa: CAIXA_CAMPANHA, semente: 'es' })
  const alvo = { x: (l.left + l.right) / 2, y: l.bottom - 30 }
  let levas = 0
  for (let t = 0; t <= 7000; t += 16) {
    const nascidas = r.gerar(t, alvo)
    if (!nascidas.length) continue
    levas++
    assert.ok(nascidas.length >= 7)
    for (const o of nascidas) {
      assert.ok(o.aviso >= AVISO_ESTILHACO && AVISO_ESTILHACO >= ATAQUE.telegrafoMs)
      assert.ok(Math.hypot(o.x - alvo.x, o.y - alvo.y) >= 80, 'cristal em cima do coração')
    }
  }
  assert.ok(levas >= 3)
})

test('assinatura: o golpe do oponente troca o modelo do naipe (em rodízio), mas não o SUPER; a fúria fortalece', () => {
  const base = { modelos: ['galhos'], forca: 0.5, duracao: 5500, dano: 4 }
  assert.deepEqual(comAssinatura(base, ['feixes', 'estilhacos'], 1).modelos, ['feixes'])
  assert.deepEqual(comAssinatura(base, ['feixes', 'estilhacos'], 2).modelos, ['estilhacos'])
  assert.deepEqual(comAssinatura({ ...base, modelos: ['galhos', 'chuva'] }, ['chuva'], 1).modelos, ['chuva', 'sementes'])
  const sup = { modelos: ['galhos', 'sementes'], forca: 1, duracao: 8000, dano: 9, super: true }
  assert.equal(comAssinatura(sup, ['feixes'], 1), sup)
  assert.equal(comAssinatura(base, null, 1), base)
  const f = comFuria(base)
  assert.ok(f.forca > base.forca && f.duracao > base.duracao && f.forca <= 1)
})
