// node --test src/game/pvp/__tests__/eventosPraia.test.js
// A arena PRAIA e os 8 eventos de regra nova dela (planos puros em pvp/bonus/eventos/praia/planos.js):
// lista de bônus, repetíveis pela semente, sempre com aviso >= telegrafoMs e com saída garantida.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARENA, eventosDaArena, BONUS_POR_ARENA } from '../arenas.js'
import { EVENTO, sortearEvento } from '../bonus.js'
import { criarRng, aleatorio } from '../baralho.js'
import { ATAQUE, CORACAO } from '../../constants.js'
import { fichaDaArena } from '../../grimorio/arenas.js'
import {
  VEL, dist,
  CASTELO, novaTrilha, deixarRastro, duro, blocoQueBloqueia, golpearBloco, podarTrilha,
  SURF, planejarSurf, alturaDaBanda, cristaY, naCrista, novoSurf, passoSurf, alertaSurf,
  SOL, planejarGuardaSois, posicaoDoGuardaSol, naSombra, sombraMaisPerto, passoCalor,
  TESOURO, planejarTesouro, intervaloDoBip, passoCava,
  PIPA, planejarPipa, ancoraDaPipa, passoPipa,
  PEGADAS, novoHistorico, gravarPasso, posicaoDoFantasma,
  CONCHA, faseDaConcha, planejarConcha, cicloDaConcha,
  GAIVOTA, planejarGaivota, faseDaGaivota, duracaoDoCiclo, gaivotaPegou,
} from '../bonus/eventos/praia/planos.js'

const CAIXA = { left: 100, right: 320, top: 80, bottom: 250, width: 220, height: 170 }
const MENOR = { left: 100, right: 210, top: 80, bottom: 180, width: 110, height: 100 } // caixa mínima
const rngDe = (semente) => {
  const r = criarRng(semente)
  return () => aleatorio(r)
}
const NOVOS = ['castelodeAreia', 'surf', 'solDoMeioDia', 'cacaTesouro', 'pipa', 'pegadas', 'concha', 'gaivotaLadra']
const VELHOS = ['ondaGigante', 'caranguejos', 'bolaDePraia', 'aquario', 'ventania', 'areia', 'brasas', 'festa', 'chuva']

test('praia: exatamente os gerais + os 8 eventos novos (10 no total), sem nenhum evento antigo', () => {
  const ids = ARENA.praia.bonus.map((b) => (typeof b === 'string' ? b : b.id))
  assert.deepEqual(ids, ['duelo', 'malucas', ...NOVOS])
  assert.equal(ids.length, BONUS_POR_ARENA)
  for (const v of VELHOS) assert.ok(!ids.includes(v), v)
  for (const n of NOVOS) {
    assert.equal(EVENTO[n].cartas, 'normal', n)
    assert.equal(EVENTO[n].nome, EVENTO[n].nome.toUpperCase(), `${n}: nome em caixa alta`)
    assert.ok(EVENTO[n].descricao && EVENTO[n].cor, n)
    // só existem na praia
    for (const a of ['castelo', 'jardim', 'informatica', 'palco', 'templo', 'coliseu', 'cafe']) assert.ok(!eventosDaArena(a).some((e) => e.id === n), `${a} tem ${n}`)
  }
  for (const v of ['ondaGigante', 'caranguejos', 'bolaDePraia']) assert.equal(EVENTO[v], undefined, `${v} ainda existe`)
})

test('praia: a roleta sorteia todos e o Guia tem a dica de cada um', () => {
  const rng = criarRng('roleta:praia')
  const disponiveis = eventosDaArena('praia').map((e) => e.id)
  const vistos = new Set()
  for (let i = 0; i < 600; i++) vistos.add(sortearEvento(rng, { disponiveis }).id)
  for (const n of NOVOS) assert.ok(vistos.has(n), n)
  const ficha = fichaDaArena('praia')
  for (const n of NOVOS) {
    const e = ficha.eventos.find((f) => f.id === n)
    assert.ok(e?.dica, `${n}: sem dica no Guia`)
    assert.equal(e.emTodas, false)
  }
})

// ---------- castelo de areia ----------

test('castelo: um bloco a cada passo andado, no máximo 12 e o mais velho cai primeiro', () => {
  const tr = novaTrilha()
  assert.ok(deixarRastro(tr, 0, 0, 0))
  assert.equal(deixarRastro(tr, 3, 0, 16), null, 'perto demais do último')
  for (let k = 1; k <= 30; k++) deixarRastro(tr, k * CASTELO.passoPx, 0, k * 60)
  assert.equal(tr.blocos.length, CASTELO.maximo)
  assert.equal(tr.blocos.at(-1).x, 30 * CASTELO.passoPx)
  assert.ok(tr.blocos[0].x > 0, 'o primeiro bloco já caiu')
})

test('castelo: o bloco só segura bala depois de endurecer, aguenta 2 batidas e vence em ~5,5 s', () => {
  const tr = novaTrilha()
  const b = deixarRastro(tr, 50, 50, 1000)
  const folga = (x, y) => dist(x, y, 55, 50) - 4 // bala redonda de raio 4 em (55, 50): encostando no bloco
  assert.equal(blocoQueBloqueia(tr, 1000 + CASTELO.endureceMs - 1, folga), null, 'ainda molhado')
  assert.equal(blocoQueBloqueia(tr, 1000 + CASTELO.endureceMs, folga), b)
  assert.equal(golpearBloco(b), false)
  assert.equal(golpearBloco(b), true, 'desmoronou na 2ª')
  assert.equal(blocoQueBloqueia(tr, 2000, folga), null)
  assert.equal(podarTrilha(tr, 2000).length, 1)
  assert.equal(tr.blocos.length, 0)
  const velho = deixarRastro(tr, 10, 10, 0)
  assert.ok(duro(velho, CASTELO.vidaMs - 1))
  assert.ok(!duro(velho, CASTELO.vidaMs))
  assert.equal(podarTrilha(tr, CASTELO.vidaMs).length, 1)
})

test('castelo: uma bala longe dos blocos passa', () => {
  const tr = novaTrilha()
  deixarRastro(tr, 50, 50, 0)
  assert.equal(blocoQueBloqueia(tr, 2000, (x, y) => dist(x, y, 150, 150) - 4), null)
})

// ---------- surf ----------

test('surf: a crista fica dentro da caixa e nunca anda mais que ~metade da velocidade do coração', () => {
  for (const caixa of [CAIXA, MENOR]) {
    for (let s = 0; s < 60; s++) {
      const plano = planejarSurf(rngDe(`surf${s}`))
      const h = alturaDaBanda(caixa)
      for (const x of [caixa.left, (caixa.left + caixa.right) / 2, caixa.right]) {
        let anterior = null
        for (let t = 0; t < 12000; t += 20) {
          const y = cristaY(plano, caixa, x, t)
          assert.ok(y - h / 2 >= caixa.top - 1 && y + h / 2 <= caixa.bottom + 1, `crista fora da caixa em t=${t}`)
          if (anterior !== null) assert.ok(Math.abs(y - anterior) / 0.02 <= 0.55 * VEL, `crista rápida demais: ${Math.abs(y - anterior) / 0.02}`)
          anterior = y
        }
      }
    }
  }
})

test('surf: de qualquer ponto dá para voltar para a faixa antes do caidão, e há aviso antes dele', () => {
  assert.ok(SURF.avisoMs >= ATAQUE.telegrafoMs)
  assert.ok(SURF.limiteMs - SURF.avisoMs >= 400, 'sobra tempo depois do alerta')
  const h = alturaDaBanda(CAIXA)
  const pior = CAIXA.height - h // a borda da faixa no outro extremo da caixa
  const relativa = VEL - 0.55 * VEL // o coração contra uma crista fugindo
  assert.ok((pior / relativa) * 1000 < SURF.limiteMs, `${Math.round((pior / relativa) * 1000)} ms`)
})

test('surf: fora da faixa cai em 1,7 s (com alerta antes), dentro o contador desce e depois do caidão há folga', () => {
  const est = novoSurf()
  // começo da rodada: folga inicial
  for (let t = 0; t < SURF.comecoMs; t += 20) assert.equal(passoSurf(est, false, 20), null)
  assert.equal(est.foraMs, 0)
  let alertaEm = null
  let caiuEm = null
  for (let t = 0; t < 3000 && caiuEm === null; t += 10) {
    if (alertaEm === null && alertaSurf(est)) alertaEm = t
    if (passoSurf(est, false, 10)) caiuEm = t
  }
  assert.ok(Math.abs(caiuEm - SURF.limiteMs) <= 20, `caiu em ${caiuEm}`)
  assert.ok(alertaEm >= SURF.avisoMs - 20 && caiuEm - alertaEm >= 400)
  // logo depois: folga (não cai de novo na hora)
  for (let t = 0; t < SURF.recuperaMs - 20; t += 20) assert.equal(passoSurf(est, false, 20), null)
  // voltou para a faixa: o contador desce
  const e2 = { foraMs: 900, imuneMs: 0 }
  passoSurf(e2, true, 100)
  assert.equal(e2.foraMs, 700)
})

test('surf: naCrista usa a altura da faixa', () => {
  assert.ok(naCrista(150, 150, CAIXA))
  assert.ok(naCrista(150 + alturaDaBanda(CAIXA) / 2, 150, CAIXA))
  assert.ok(!naCrista(150 + alturaDaBanda(CAIXA) / 2 + 1, 150, CAIXA))
})

// ---------- sol do meio-dia ----------

test('sol: os guarda-sóis são lentos, ficam na caixa e de qualquer ponto a sombra dá para alcançar antes de queimar', () => {
  for (const caixa of [CAIXA, MENOR]) {
    for (let s = 0; s < 40; s++) {
      const gs = planejarGuardaSois(rngDe(`sol${s}`), caixa, 2)
      assert.equal(gs.length, 2)
      let anterior = null
      for (let t = 0; t < 30000; t += 50) {
        const ps = gs.map((g) => posicaoDoGuardaSol(g, t))
        for (const p of ps) assert.ok(p.x > caixa.left - 10 && p.x < caixa.right + 10 && p.y > caixa.top - 10 && p.y < caixa.bottom + 10)
        if (anterior) ps.forEach((p, i) => assert.ok(dist(p.x, p.y, anterior[i].x, anterior[i].y) / 0.05 <= SOL.velocidadeMax, 'guarda-sol rápido demais'))
        anterior = ps
      }
      // pior caso: do canto mais longe até a sombra (borda), contra um guarda-sol fugindo
      const canto = { x: caixa.left, y: caixa.top }
      const perto = sombraMaisPerto(gs, 0, canto.x, canto.y)
      const livre = Math.max(0, perto.d - SOL.raio)
      assert.ok((livre / (VEL - SOL.velocidadeMax)) * 1000 < SOL.sobeMs, `${Math.round((livre / (VEL - SOL.velocidadeMax)) * 1000)} ms`)
    }
  }
})

test('sol: o calor sobe devagar fora da sombra, queima uma vez e volta para 45%, na sombra desce', () => {
  let calor = 0
  let queimou = null
  for (let t = 0; t < 4000 && queimou === null; t += 10) {
    const r = passoCalor(calor, false, 10)
    calor = r.calor
    if (r.queimou) queimou = t
  }
  assert.ok(Math.abs(queimou - SOL.sobeMs) <= 20, `queimou em ${queimou}`)
  assert.equal(calor, SOL.depois)
  // a próxima queimadura demora (1 - depois) * sobeMs
  let segunda = null
  for (let t = 0; t < 4000 && segunda === null; t += 10) {
    const r = passoCalor(calor, false, 10)
    calor = r.calor
    if (r.queimou) segunda = t
  }
  assert.ok(segunda >= 1300, `segunda queimadura em ${segunda}`)
  assert.equal(passoCalor(0.5, true, 500).calor, 0)
  assert.ok(SOL.aviso * SOL.sobeMs >= ATAQUE.telegrafoMs)
})

test('sol: naSombra confere a distância ao guarda-sol', () => {
  const gs = planejarGuardaSois(rngDe('x'), CAIXA, 2)
  const p = posicaoDoGuardaSol(gs[0], 1234)
  assert.ok(naSombra(gs, 1234, p.x, p.y))
  assert.ok(naSombra(gs, 1234, p.x + SOL.raio - 1, p.y))
  assert.ok(!naSombra([gs[0]], 1234, p.x + SOL.raio + 2, p.y))
})

// ---------- caça ao tesouro ----------

test('tesouro: sempre dentro da caixa, longe do coração e do anterior, repetível', () => {
  for (const caixa of [CAIXA, MENOR]) {
    for (let s = 0; s < 80; s++) {
      const sorte = rngDe(`tes${s}`)
      const coracao = { x: caixa.left + 20, y: caixa.bottom - 20 }
      let anterior = null
      for (let k = 0; k < 4; k++) {
        const p = planejarTesouro(sorte, caixa, coracao, anterior)
        assert.ok(p.x >= caixa.left && p.x <= caixa.right && p.y >= caixa.top && p.y <= caixa.bottom)
        if (caixa === CAIXA) {
          assert.ok(dist(p.x, p.y, coracao.x, coracao.y) >= TESOURO.distCoracao)
          if (anterior) assert.ok(dist(p.x, p.y, anterior.x, anterior.y) >= TESOURO.distAnterior)
        }
        anterior = p
      }
    }
  }
  assert.deepEqual(planejarTesouro(rngDe('z'), CAIXA, null), planejarTesouro(rngDe('z'), CAIXA, null))
})

test('tesouro: o detector apita mais rápido quanto mais perto (monótono), e cavar leva 0,6 s em cima', () => {
  let anterior = 0
  for (let d = 0; d <= 300; d += 5) {
    const i = intervaloDoBip(d)
    assert.ok(i >= anterior && i >= TESOURO.bipPertoMs && i <= TESOURO.bipLongeMs)
    anterior = i
  }
  assert.equal(intervaloDoBip(0), TESOURO.bipPertoMs)
  assert.equal(intervaloDoBip(9999), TESOURO.bipLongeMs)
  // cavar
  let prog = 0
  let achouEm = null
  for (let t = 0; t < 2000 && achouEm === null; t += 10) {
    const r = passoCava(prog, true, 10)
    prog = r.prog
    if (r.achou) achouEm = t
  }
  assert.ok(Math.abs(achouEm - TESOURO.cavaMs) <= 20)
  // saiu: o progresso desce o dobro mais rápido
  assert.equal(passoCava(300, false, 100).prog, 100)
  assert.equal(passoCava(100, false, 100).prog, 0)
  // a cura é pequena e limitada
  assert.ok(TESOURO.cura <= 0.08 && TESOURO.maxAchados <= 3)
})

// ---------- pipa ----------

test('pipa: a corda segura (o coração nunca passa dela), a velocidade tem teto e com força total qualquer ponto da corda dá para segurar', () => {
  const plano = planejarPipa(rngDe('pipa'))
  const est = { x: CAIXA.left + 110, y: CAIXA.bottom - 30, vx: 0, vy: 0 }
  const entrada = rngDe('entrada')
  for (let t = 0; t < 30000; t += 16) {
    const a = ancoraDaPipa(plano, CAIXA, t)
    // direcional aleatório e brusco
    const input = { x: entrada() * 2 - 1, y: entrada() * 2 - 1 }
    passoPipa(est, a, input, 16)
    assert.ok(dist(est.x, est.y, a.x, a.y) <= PIPA.corda + 1e-6, 'passou da corda')
    assert.ok(Math.hypot(est.vx, est.vy) <= PIPA.vMax + 1e-6)
  }
  // segurar o ponto da corda mais longe da âncora pede <= 80% do direcional
  assert.ok((PIPA.mola * PIPA.corda) / PIPA.forca <= 0.8, `${(PIPA.mola * PIPA.corda) / PIPA.forca}`)
})

test('pipa: sem direcional o coração balança em volta da pipa (pêndulo amortecido, vai e volta)', () => {
  const a = { x: 200, y: 160 }
  const est = { x: a.x + 80, y: a.y, vx: 0, vy: 0 }
  let cruzou = 0
  let lado = Math.sign(est.x - a.x)
  let maxDepois = 0
  for (let t = 0; t < 20000; t += 16) {
    passoPipa(est, a, { x: 0, y: 0 }, 16)
    const l = Math.sign(est.x - a.x)
    if (l && l !== lado) {
      cruzou++
      lado = l
    }
    if (t > 12000) maxDepois = Math.max(maxDepois, Math.abs(est.x - a.x))
  }
  assert.ok(cruzou >= 4, `cruzou a âncora ${cruzou}x`)
  assert.ok(maxDepois < 80, 'o balanço perde energia (amortece)')
})

test('pipa: a âncora passeia devagar (<= 22 px/s) e fica na caixa', () => {
  for (const caixa of [CAIXA, MENOR]) {
    for (let s = 0; s < 30; s++) {
      const plano = planejarPipa(rngDe(`ancora${s}`))
      let anterior = null
      for (let t = 0; t < 40000; t += 50) {
        const a = ancoraDaPipa(plano, caixa, t)
        assert.ok(a.x > caixa.left && a.x < caixa.right && a.y > caixa.top && a.y < caixa.bottom)
        if (anterior) assert.ok(dist(a.x, a.y, anterior.x, anterior.y) / 0.05 <= PIPA.ancoraMax, 'âncora rápida')
        anterior = a
      }
    }
  }
})

// ---------- pegadas ----------

test('pegadas: o fantasma está EXATAMENTE onde o coração estava há 2 s, e só existe depois disso', () => {
  const hist = novoHistorico()
  const caminho = (t) => ({ x: 150 + 60 * Math.sin(t / 700), y: 120 + 40 * Math.cos(t / 450) })
  const fantasmas = []
  for (let t = 0; t <= 8000; t += 16) {
    const c = caminho(t)
    gravarPasso(hist, t, c.x, c.y)
    fantasmas.push([t, posicaoDoFantasma(hist, t)])
  }
  for (const [t, f] of fantasmas) {
    if (t < PEGADAS.atrasoMs) {
      assert.equal(f, null, `fantasma cedo demais em ${t}`)
      continue
    }
    const esperado = caminho(t - PEGADAS.atrasoMs)
    assert.ok(Math.abs(f.x - esperado.x) < 0.8 && Math.abs(f.y - esperado.y) < 0.8, `em ${t}: (${f.x.toFixed(1)}, ${f.y.toFixed(1)}) vs (${esperado.x.toFixed(1)}, ${esperado.y.toFixed(1)})`)
  }
  assert.ok(hist.length < 200, `o histórico é aparado (${hist.length})`)
})

test('pegadas: a velocidade do fantasma é a do coração de 2 s atrás, e há tempo de sair do caminho no nascimento', () => {
  const hist = novoHistorico()
  for (let t = 0; t <= 3000; t += 20) gravarPasso(hist, t, t * 0.1, 100) // 100 px/s para a direita
  const f = posicaoDoFantasma(hist, 3000)
  assert.ok(Math.abs(f.vx - 100) < 1)
  assert.ok(PEGADAS.nasceMs >= ATAQUE.telegrafoMs)
  // dá para sair do raio de perigo com folga durante o nascimento
  const preciso = (PEGADAS.raio + CORACAO.hitbox + 4) / VEL
  assert.ok(preciso * 1000 < PEGADAS.nasceMs)
})

// ---------- concha ----------

test('concha: abre sem proteger, protege aberta e fechando (com aviso >= telegrafoMs), estala e fica fechada', () => {
  assert.ok(CONCHA.avisoMs >= ATAQUE.telegrafoMs)
  const vistas = []
  for (let t = 0; t < cicloDaConcha(); t += 10) {
    const f = faseDaConcha(t)
    if (vistas.at(-1) !== f.fase) vistas.push(f.fase)
    assert.equal(f.protege, f.fase === 'aberta' || f.fase === 'fechando', `${f.fase} em ${t}`)
    if (f.fase === 'fechando') assert.ok(f.falta <= CONCHA.avisoMs && f.falta > 0)
    if (f.fase === 'fechada') assert.equal(f.falta, 0)
  }
  assert.deepEqual(vistas, ['abrindo', 'aberta', 'fechando', 'fechada'])
  // o aviso dura avisoMs inteiros antes do estalo
  const estalo = CONCHA.abrindoMs + CONCHA.abertaMs
  assert.equal(faseDaConcha(estalo - CONCHA.avisoMs).fase, 'fechando')
  assert.equal(faseDaConcha(estalo - CONCHA.avisoMs - 1).fase, 'aberta')
  assert.equal(faseDaConcha(estalo).fase, 'fechada')
})

test('concha: reabre dentro da caixa, longe do lugar anterior, e de qualquer ponto dá para chegar nela', () => {
  for (const caixa of [CAIXA, MENOR]) {
    for (let s = 0; s < 80; s++) {
      const sorte = rngDe(`cc${s}`)
      let anterior = null
      for (let k = 0; k < 5; k++) {
        const p = planejarConcha(sorte, caixa, anterior)
        assert.ok(p.x - CONCHA.raio >= caixa.left && p.x + CONCHA.raio <= caixa.right && p.y - CONCHA.raio >= caixa.top && p.y + CONCHA.raio <= caixa.bottom)
        if (anterior && caixa === CAIXA) assert.ok(dist(p.x, p.y, anterior.x, anterior.y) >= CONCHA.distAnterior - 8, `${dist(p.x, p.y, anterior.x, anterior.y)}`)
        anterior = p
      }
    }
  }
  // do canto mais longe até a borda da concha, dentro do tempo que ela fica aberta (sobra tempo dentro dela)
  const diag = Math.hypot(CAIXA.width, CAIXA.height)
  assert.ok(((diag - CONCHA.raio) / VEL) * 1000 < CONCHA.abertaMs - CONCHA.avisoMs)
  assert.deepEqual(planejarConcha(rngDe('k'), CAIXA), planejarConcha(rngDe('k'), CAIXA))
})

// ---------- gaivota ladra ----------

test('gaivota: voa, mira (aviso), mergulha e foge; só pega na janela do golpe, depois da mira', () => {
  assert.ok(GAIVOTA.avisoMs >= ATAQUE.telegrafoMs)
  for (let s = 0; s < 40; s++) {
    const plano = planejarGaivota(rngDe(`g${s}`), s % 2 === 0)
    const ordem = []
    let golpeAntesDaMira = false
    for (let t = 0; t < duracaoDoCiclo(plano); t += 5) {
      const f = faseDaGaivota(t, plano)
      if (ordem.at(-1) !== f.fase) ordem.push(f.fase)
      if (f.golpe && (f.fase === 'voa' || f.fase === 'mira')) golpeAntesDaMira = true
    }
    assert.deepEqual(ordem, ['voa', 'mira', 'mergulha', 'foge'])
    assert.ok(!golpeAntesDaMira)
    assert.equal(faseDaGaivota(duracaoDoCiclo(plano), plano).fase, 'fim')
    // a mira dura o aviso inteiro
    assert.equal(faseDaGaivota(plano.voltaMs + GAIVOTA.avisoMs - 1, plano).fase, 'mira')
    assert.ok(plano.voltaMs >= (s % 2 === 0 ? GAIVOTA.primeiraMs.min : GAIVOTA.voltaMs.min))
  }
})

test('gaivota: dá para sair do anel durante o aviso, e quem saiu não é pego', () => {
  const sair = ((GAIVOTA.raioAlvo + CORACAO.hitbox + 6) / VEL) * 1000
  assert.ok(sair < GAIVOTA.avisoMs / 2, `${Math.round(sair)} ms para sair do anel`)
  const alvo = { x: 200, y: 150 }
  assert.ok(gaivotaPegou(alvo, { x: 205, y: 150, hitbox: CORACAO.hitbox }))
  assert.ok(!gaivotaPegou(alvo, { x: 200 + GAIVOTA.raioAlvo + CORACAO.hitbox + 3, y: 150, hitbox: CORACAO.hitbox }))
  assert.ok(GAIVOTA.rouba === 1 && GAIVOTA.danoSemEnergia <= 0.05)
  assert.deepEqual(planejarGaivota(rngDe('q')), planejarGaivota(rngDe('q')))
})
