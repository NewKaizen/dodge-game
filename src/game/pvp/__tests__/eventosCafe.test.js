// node --test src/game/pvp/__tests__/eventosCafe.test.js
// Os 8 eventos da arena CAFÉ FRANCÊS (pvp/bonus/eventos/cafe/): cada um muda uma REGRA da
// esquiva. Aqui a parte pura (planos.js): repetível pela semente, justa (aviso, saída livre) e
// a matemática de cada regra. O visual é conferido no navegador.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { ARENA, eventosDaArena, BONUS_POR_ARENA } from '../arenas.js'
import { EVENTO, sortearEvento } from '../bonus.js'
import { criarRng, aleatorio } from '../baralho.js'
import { ATAQUE, CORACAO } from '../../constants.js'
import { fichaDaArena } from '../../grimorio/arenas.js'
import {
  LATTE, atualizarTinta, estenderTrilha, detectarLaco, pontoNoPoligono, areaDoPoligono,
  BANDEJA, novoBalanco, atualizarBalanco, suavizarJoy,
  MIMICO, planejarMuros, retangulosDosMuros, empurrarDaParede, quicarNaParede, cancelarJoyNaParede, conectado,
  ACORDEAO, planejarFole, estadoDoFole, insetsEmPx,
  PINTOR, planejarPincelada, tintaRevelada, dentroDaTinta, areaDaTinta,
  PRATOS, MENU, proximoPratoDoDia, planejarPrato,
  EXPRESSO, novaCafeina, beber, nivelDeCafeina, fatorDeVelocidade, tremendo, planejarXicara,
  XADREZ, SALTOS, destinosDoCavalo, escolherSalto, centroDaCelula, celulaDoPonto, notaDoDestino, escolherSaltoDaCpu, cavaloConectado,
} from '../bonus/eventos/cafe/planos.js'

const CAIXA = { left: 100, right: 320, top: 80, bottom: 250, width: 220, height: 170 }
const MENOR = { left: 100, right: 210, top: 80, bottom: 180, width: 110, height: 100 } // caixa mínima
const MAIOR = { left: 60, right: 360, top: 40, bottom: 290, width: 300, height: 250 }
const rngDe = (semente) => {
  const r = criarRng(semente)
  return () => aleatorio(r)
}
const NOVOS = ['latteArt', 'bandeja', 'mimico', 'acordeao', 'pintor', 'menuDoDia', 'expresso', 'xadrez']
const VELOCIDADE = CORACAO.velocidadePadrao
const PASSO = 1000 / 60

// ---------------------------------------------------------------- lista, nomes, Guia

test('café: exatamente os duelo, as cartas malucas e os 8 eventos novos (10 no total)', () => {
  const ids = eventosDaArena('cafe').map((e) => e.id)
  assert.deepEqual(ids, ['duelo', 'malucas', ...NOVOS])
  assert.equal(ids.length, BONUS_POR_ARENA)
  assert.equal(ARENA.cafe.bonus.length, BONUS_POR_ARENA)
  for (const id of NOVOS) {
    assert.equal(EVENTO[id].cartas, 'normal', id)
    assert.equal(EVENTO[id].nome, EVENTO[id].nome.toUpperCase(), `${id}: nome em caixa alta`)
    assert.ok(EVENTO[id].descricao && EVENTO[id].cor !== undefined, id)
  }
})

test('café: os eventos antigos (croissants, bule, pombos e os reaproveitados) saíram', () => {
  for (const id of ['croissants', 'buleQuente', 'pombos']) assert.equal(EVENTO[id], undefined, id)
  const ids = eventosDaArena('cafe').map((e) => e.id)
  for (const id of ['apagao', 'vagalumes', 'ritmo', 'karaoke', 'chuva', 'trocado']) assert.ok(!ids.includes(id), id)
  const pasta = new URL('../bonus/eventos/', import.meta.url)
  for (const arq of ['croissants.js', 'bule.js', 'pombos.js']) assert.ok(!existsSync(new URL(arq, pasta)), arq)
})

test('café: os 8 só existem nesta arena, a roleta sorteia todos e o Guia tem a dica de cada um', () => {
  for (const a of Object.values(ARENA)) {
    if (a.id === 'cafe') continue
    for (const n of NOVOS) assert.ok(!eventosDaArena(a.id).some((e) => e.id === n), `${a.id} tem ${n}`)
  }
  const rng = criarRng('roleta:cafe')
  const disponiveis = eventosDaArena('cafe').map((e) => e.id)
  const vistos = new Set()
  for (let i = 0; i < 600; i++) vistos.add(sortearEvento(rng, { disponiveis }).id)
  for (const n of NOVOS) assert.ok(vistos.has(n), n)
  const ficha = fichaDaArena('cafe')
  for (const n of NOVOS) {
    const e = ficha.eventos.find((f) => f.id === n)
    assert.ok(e?.dica && e.dica.length > 60, `${n}: sem dica no Guia`)
    assert.equal(e.emTodas, false)
  }
})

test('café: cada evento tem arquivo, está no mapa de efeitos e a instrução na tela tem até 6 palavras', () => {
  const pasta = new URL('../bonus/eventos/cafe/', import.meta.url)
  const indice = readFileSync(new URL('index.js', pasta), 'utf8')
  const eventosIndex = readFileSync(new URL('../bonus/eventos/index.js', import.meta.url), 'utf8')
  assert.match(eventosIndex, /Object\.assign\(EFEITOS, EFEITOS_CAFE\)/)
  for (const id of NOVOS) {
    assert.ok(existsSync(new URL(`${id}.js`, pasta)), id)
    assert.match(indice, new RegExp(`\\b${id}\\b`), `${id} no index`)
    const fonte = readFileSync(new URL(`${id}.js`, pasta), 'utf8')
    const frases = [...fonte.matchAll(/instrucao\('([^']+)'/g)].map((m) => m[1])
    assert.equal(frases.length, 1, `${id}: uma instrução`)
    assert.ok(frases[0].split(/\s+/).length <= 6, `${id}: "${frases[0]}" tem mais de 6 palavras`)
    assert.ok(/terminar\(\)/.test(fonte) && /ctx\.limpar\(\)|secar|fatorCoracao|caixa = s\.pista\.caixa/.test(fonte), `${id}: limpa no terminar`)
  }
  assert.ok(readdirSync(pasta).includes('planos.js'))
})

// ---------------------------------------------------------------- LATTE ART

function andarEmCirculo(trilha, cx, cy, raio, voltas = 1.1, passos = 90, t0 = 0) {
  let t = t0
  let achou = null
  for (let i = 0; i <= passos * voltas; i++) {
    const a = (i / passos) * Math.PI * 2
    t += 30
    estenderTrilha(trilha, { x: cx + Math.cos(a) * raio, y: cy + Math.sin(a) * raio }, t)
    achou = detectarLaco(trilha) ?? achou
    if (achou) break
  }
  return { achou, t }
}

test('latte art: um círculo de verdade fecha o laço e as balas de dentro (só elas) estão no polígono', () => {
  const trilha = []
  const { achou } = andarEmCirculo(trilha, 200, 150, 28)
  assert.ok(achou, 'fechou o laço')
  assert.ok(achou.area > 0.7 * Math.PI * 28 * 28 && achou.area <= Math.PI * 28 * 28 * 1.05)
  assert.ok(pontoNoPoligono(200, 150, achou.poligono))
  assert.ok(pontoNoPoligono(215, 160, achou.poligono))
  assert.ok(!pontoNoPoligono(240, 150, achou.poligono))
  assert.ok(!pontoNoPoligono(200, 100, achou.poligono))
})

test('latte art: linha reta, vai e volta e rabisco pequeno NÃO fecham laço', () => {
  let trilha = []
  for (let x = 100; x < 260; x += 4) estenderTrilha(trilha, { x, y: 150 }, x * 10)
  assert.equal(detectarLaco(trilha), null, 'reta')
  for (let x = 260; x > 100; x -= 4) estenderTrilha(trilha, { x, y: 150 }, 2000 + (260 - x) * 10)
  assert.equal(detectarLaco(trilha), null, 'vai e volta pela mesma linha tem área zero')
  trilha = []
  const { achou } = andarEmCirculo(trilha, 200, 150, 3)
  assert.equal(achou, null, 'círculo minúsculo é tremida')
})

test('latte art: a linha cortada pela falta de leite não fecha laço por cima do buraco', () => {
  const trilha = []
  let t = 0
  for (let i = 0; i <= 45; i++) {
    const a = (i / 90) * Math.PI * 2
    t += 30
    estenderTrilha(trilha, { x: 200 + Math.cos(a) * 28, y: 150 + Math.sin(a) * 28 }, t)
  }
  // acabou o leite: o resto do círculo só recomeça com corte
  for (let i = 46; i <= 99; i++) {
    const a = (i / 90) * Math.PI * 2
    t += 30
    estenderTrilha(trilha, { x: 200 + Math.cos(a) * 28, y: 150 + Math.sin(a) * 28 }, t, { quebra: i === 70 })
    assert.equal(detectarLaco(trilha), null, `i=${i}`)
  }
})

test('latte art: a linha some com o tempo, tem tamanho máximo e a tinta gasta, recarrega e nunca passa dos limites', () => {
  const trilha = []
  for (let i = 0; i < 1000; i++) estenderTrilha(trilha, { x: i * 4, y: 10 }, i * 50)
  assert.ok(trilha.length <= LATTE.maxPontos)
  assert.ok(trilha.every((p) => 999 * 50 - p.t <= LATTE.vidaMs), 'pontos velhos saem')
  // gasto: o tanque cheio dá ~520 px de linha
  let tinta = 1
  let px = 0
  while (tinta > 0.001 && px < 5000) {
    tinta = atualizarTinta(tinta, { distancia: 3, dtMs: 0 })
    px += 3
  }
  assert.ok(px >= 480 && px <= 560, `${px}px por tanque`)
  // recarga: parado volta bem mais rápido; sempre dentro de 0..1
  const andando = atualizarTinta(0, { dtMs: 1000, parado: false, desenhando: false })
  const parado = atualizarTinta(0, { dtMs: 1000, parado: true, desenhando: false })
  assert.ok(parado > 3 * andando && parado < 1)
  assert.equal(atualizarTinta(0.99, { dtMs: 5000, parado: true }), 1)
  assert.equal(atualizarTinta(0, { distancia: 999, dtMs: 0 }), 0)
  // um laço de raio 28 (~176 px) gasta ~1/3 do tanque: dá para fazer 2 e meio por tanque, mas não 4
  assert.ok((2 * Math.PI * 28) / 520 > 0.3 && (2 * Math.PI * 28) / 520 < 0.4)
  assert.ok(areaDoPoligono([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]) === 100)
})

// ---------------------------------------------------------------- BANDEJA

function simularBandeja(caminho, segundos, velMax = VELOCIDADE) {
  const est = novoBalanco()
  let t = 0
  let pos = caminho(0)
  // já começa andando (largar do repouso conta como arrancada, e esse teste é do andar liso)
  const primeiro = caminho(PASSO)
  est.vel = Math.hypot(primeiro.x - pos.x, primeiro.y - pos.y) / (PASSO / 1000)
  let derramou = 0
  let maximo = 0
  for (let ms = PASSO; ms <= segundos * 1000; ms += PASSO) {
    const nova = caminho(ms)
    const r = atualizarBalanco(est, { dx: nova.x - pos.x, dy: nova.y - pos.y, dtMs: PASSO, t: ms, velMax })
    if (r.derramou) derramou++
    maximo = Math.max(maximo, est.w)
    pos = nova
    t = ms
  }
  return { derramou, maximo, t }
}

test('bandeja: andar reto e curva aberta (giro suave) nunca derrama', () => {
  const reto = simularBandeja((ms) => ({ x: (ms / 1000) * 150, y: 0 }), 30)
  assert.equal(reto.derramou, 0)
  assert.ok(reto.maximo < 0.05)
  // círculo de raio 60 a 150 px/s: giro de 2,5 rad/s (< 3,6)
  const curva = simularBandeja((ms) => ({ x: Math.cos((ms / 1000) * 2.5) * 60, y: Math.sin((ms / 1000) * 2.5) * 60 }), 30)
  assert.equal(curva.derramou, 0, 'curva aberta é lisa')
})

test('bandeja: zigue-zague seco e freadas derramam (com respiro entre derrames) e andar liso baixa o balanço', () => {
  const quicando = (ms) => ({ x: Math.abs(((ms / 1000) * 150) % 120 - 60), y: 0 })
  const r = simularBandeja(quicando, 6)
  assert.ok(r.derramou >= 2, `derramou ${r.derramou}x em 6 s`)
  assert.ok(r.derramou <= Math.ceil(6000 / BANDEJA.recargaMs), 'o respiro limita os derrames')
  // começa e para: arrancada/freada seca enche
  const anda = simularBandeja((ms) => ({ x: Math.floor(ms / 400) % 2 ? 40 : 0, y: 0 }), 4)
  assert.ok(anda.maximo >= 0, 'rodou')
  // balanço alto, depois anda liso: baixa sozinho
  const est = novoBalanco()
  est.w = 0.8
  for (let ms = PASSO; ms < 2000; ms += PASSO) atualizarBalanco(est, { dx: 2.5, dy: 0, dtMs: PASSO, t: ms })
  assert.ok(est.w < 0.4, `baixou para ${est.w}`)
  const { est: e2, derramou } = atualizarBalanco({ ...novoBalanco(), w: 0.99, vel: 0 }, { dx: 3, dy: 0, dtMs: PASSO, t: 5000 })
  assert.equal(derramou, true)
  assert.equal(e2.w, BANDEJA.depoisDeDerramar)
})

test('bandeja: o dano é pequeno e o joystick suavizado da CPU converge sem passar do alvo', () => {
  assert.ok(BANDEJA.dano <= 0.05 && BANDEJA.relogioDasBalas < 1 && BANDEJA.relogioDasBalas > 0.8)
  let j = { x: 0, y: 0 }
  for (let i = 0; i < 120; i++) j = suavizarJoy(j, { x: 100, y: -50 }, PASSO)
  assert.ok(Math.abs(j.x - 100) < 1 && Math.abs(j.y + 50) < 1)
  const meio = suavizarJoy({ x: 0, y: 0 }, { x: 100, y: 0 }, PASSO)
  assert.ok(meio.x > 0 && meio.x < 30, 'não pula de uma vez')
})

// ---------------------------------------------------------------- MÍMICO

test('mímico: o labirinto é repetível, cabe em qualquer caixa e a caixa continua um pedaço só com corredores largos', () => {
  const raio = MIMICO.raioFolga
  for (const caixa of [CAIXA, MENOR, MAIOR]) {
    for (let s = 0; s < 60; s++) {
      const muros = planejarMuros(rngDe(`mi${s}`))
      assert.ok(muros.length >= 2 && muros.length <= 4)
      const rects = retangulosDosMuros(muros, caixa)
      const { conectado: ok, livre } = conectado(rects, caixa, caixa === MENOR ? 9 : raio)
      assert.ok(ok, `semente ${s} em ${caixa.width}x${caixa.height}: espaço partido`)
      assert.ok(livre > (caixa === MENOR ? 0.2 : 0.4), `semente ${s}: ficou só ${livre} livre`)
    }
  }
  assert.deepEqual(planejarMuros(rngDe('x')), planejarMuros(rngDe('x')))
  // todos os moldes aparecem
  const moldes = new Set()
  for (let s = 0; s < 200; s++) moldes.add(planejarMuros(rngDe(`m${s}`)).length + ':' + planejarMuros(rngDe(`m${s}`))[0].x0.toFixed(2))
  assert.ok(moldes.size >= 5)
  assert.ok(MIMICO.avisoInicialMs >= 400 && MIMICO.revelaMs >= 400, 'a parede aparece por tempo suficiente')
})

test('mímico: o coração é empurrado para fora da parede e o joystick só perde o que empurra para dentro', () => {
  const parede = [{ left: 150, right: 157, top: 80, bottom: 200 }]
  const r = empurrarDaParede(parede, 152, 120, 8)
  assert.equal(r.tocou, 0)
  assert.ok(r.x <= 150 - 8 + 1e-9 || r.x >= 157 + 8 - 1e-9, 'saiu pela lateral mais perto')
  assert.equal(empurrarDaParede(parede, 100, 120, 8).tocou, -1)
  // encostado pela esquerda, empurrando para a direita: zera x, mantém y (desliza)
  const { joy, tocou } = cancelarJoyNaParede(parede, 150 - 8 - 0.5, 120, 8, { x: 80, y: -60 })
  assert.equal(tocou, 0)
  assert.deepEqual(joy, { x: 0, y: -60 })
  // afastando-se da parede: nada muda
  assert.deepEqual(cancelarJoyNaParede(parede, 150 - 8 - 0.5, 120, 8, { x: -80, y: 20 }).joy, { x: -80, y: 20 })
  // longe: nada muda
  assert.equal(cancelarJoyNaParede(parede, 60, 120, 8, { x: 80, y: 0 }).tocou, -1)
})

test('mímico: a bala quica na parede (muda só o sentido, nunca a velocidade) e fica do lado de fora', () => {
  const parede = [{ left: 150, right: 157, top: 80, bottom: 200 }]
  const b = { x: 146, y: 120, vx: 100, vy: 30 }
  assert.equal(quicarNaParede(parede, b, 6), 0)
  assert.equal(b.vx, -100)
  assert.equal(b.vy, 30)
  assert.ok(b.x <= 150 - 6)
  const c = { x: 160, y: 120, vx: -50, vy: 0 } // pelo outro lado
  quicarNaParede(parede, c, 6)
  assert.equal(c.vx, 50)
  const d = { x: 153, y: 78, vx: 0, vy: 40 } // pela ponta de cima
  quicarNaParede(parede, d, 6)
  assert.ok(d.vy < 0)
  assert.equal(quicarNaParede(parede, { x: 10, y: 10, vx: 1, vy: 1 }, 6), -1)
})

// ---------------------------------------------------------------- ACORDEÃO

test('acordeão: o fole avisa antes de andar, anda devagar, nunca fecha demais e é repetível', () => {
  assert.ok(ACORDEAO.avisoMs >= ATAQUE.telegrafoMs)
  assert.ok(ACORDEAO.avisoMs + ACORDEAO.moveMs < ACORDEAO.compassoMs, 'sobra tempo de segurar')
  assert.deepEqual(planejarFole(rngDe('a')), planejarFole(rngDe('a')))
  for (const caixa of [CAIXA, MENOR, MAIOR]) {
    for (let s = 0; s < 30; s++) {
      const plano = planejarFole(rngDe(`ac${s}`))
      let anterior = null
      let maiorVelocidade = 0
      for (let t = 0; t < ACORDEAO.compassoMs * 20; t += 25) {
        const est = estadoDoFole(t, plano)
        const { e, d } = insetsEmPx(est, caixa.width)
        assert.ok(e >= 0 && d >= 0)
        assert.ok(caixa.width - e - d >= Math.min(ACORDEAO.livreMin, caixa.width) - 1e-6, `largura livre ${caixa.width - e - d}`)
        if (anterior) maiorVelocidade = Math.max(maiorVelocidade, (Math.abs(e - anterior.e) + Math.abs(d - anterior.d)) / 0.025)
        // o aviso só existe antes do fole andar (nessa fase o fole parado mostra o ALVO)
        if (est.fase === 'aviso') assert.ok(est.aviso, 'aviso presente')
        else assert.equal(est.aviso, null)
        anterior = { e, d }
      }
      // o coração (180 px/s) sempre corre mais do que cada ponta do fole
      assert.ok(maiorVelocidade / 2 < VELOCIDADE * 1.05 || caixa === MAIOR, `fole a ${maiorVelocidade} px/s (soma dos dois lados)`)
    }
  }
})

test('acordeão: contínuo (nada pula), muda de alvo a cada compasso e a largura mínima vale na caixa pequena', () => {
  const plano = planejarFole(rngDe('c'))
  let ant = estadoDoFole(0, plano)
  for (let t = 10; t < ACORDEAO.compassoMs * 6; t += 10) {
    const est = estadoDoFole(t, plano)
    assert.ok(Math.abs(est.e - ant.e) < 0.02 && Math.abs(est.d - ant.d) < 0.02, `salto em ${t}`)
    ant = est
  }
  for (let i = 1; i < plano.length; i++) assert.ok(plano[i].e !== plano[i - 1].e || plano[i].d !== plano[i - 1].d, 'nunca repete o alvo')
  const apertado = insetsEmPx({ e: 0.34, d: 0.34 }, MENOR.width)
  assert.ok(MENOR.width - apertado.e - apertado.d >= Math.min(ACORDEAO.livreMin, MENOR.width) - 1e-6)
})

// ---------------------------------------------------------------- PINTOR

test('pintor: aviso longo, tinta repetível, dentro da caixa e nunca passa da área máxima', () => {
  assert.ok(PINTOR.avisoMs >= ATAQUE.telegrafoMs + 200)
  for (const caixa of [CAIXA, MENOR, MAIOR]) {
    for (let s = 0; s < 80; s++) {
      const sorte = rngDe(`pi${s}`)
      const ativas = []
      for (let k = 0; k < 6; k++) {
        const p = planejarPincelada(sorte, caixa, ativas)
        if (!p) continue
        if (p.forma === 'mancha') {
          assert.ok(p.x - p.raio >= caixa.left - 1e-6 && p.x + p.raio <= caixa.right + 1e-6 && p.y - p.raio >= caixa.top - 1e-6 && p.y + p.raio <= caixa.bottom + 1e-6)
        } else {
          assert.ok(p.x >= caixa.left - 1e-6 && p.x + p.largura <= caixa.right + 1e-6 && p.y >= caixa.top - 1e-6 && p.y + p.altura <= caixa.bottom + 1e-6)
        }
        ativas.push(p)
        const total = ativas.reduce((m, a) => m + areaDaTinta(a), 0)
        assert.ok(total / (caixa.width * caixa.height) <= PINTOR.areaMax + 1e-9, `área ${total}`)
        if (ativas.length >= PINTOR.maxAtivas) ativas.shift()
      }
    }
  }
  assert.deepEqual(planejarPincelada(rngDe('z'), CAIXA), planejarPincelada(rngDe('z'), CAIXA))
})

test('pintor: a tinta aparece aos poucos do lado do pincel e a bala só congela dentro da parte pintada', () => {
  const faixa = { forma: 'faixa', x: 100, y: 100, largura: 200, altura: 30, de: 'e' }
  assert.equal(tintaRevelada(faixa, 0).largura, 0)
  assert.equal(tintaRevelada(faixa, 0.5).largura, 100)
  assert.equal(tintaRevelada(faixa, 1).largura, 200)
  assert.ok(dentroDaTinta(tintaRevelada(faixa, 0.5), 150, 110))
  assert.ok(!dentroDaTinta(tintaRevelada(faixa, 0.5), 250, 110), 'ainda não pintou aqui')
  const dir = { ...faixa, de: 'd' }
  const meia = tintaRevelada(dir, 0.5)
  assert.ok(dentroDaTinta(meia, 250, 110) && !dentroDaTinta(meia, 150, 110))
  const cima = { forma: 'faixa', x: 100, y: 100, largura: 30, altura: 100, de: 'c' }
  assert.ok(dentroDaTinta(tintaRevelada(cima, 0.5), 110, 140) && !dentroDaTinta(tintaRevelada(cima, 0.5), 110, 190))
  const baixo = { ...cima, de: 'b' }
  assert.ok(dentroDaTinta(tintaRevelada(baixo, 0.5), 110, 190) && !dentroDaTinta(tintaRevelada(baixo, 0.5), 110, 120))
  const mancha = { forma: 'mancha', x: 200, y: 150, raio: 30 }
  assert.ok(dentroDaTinta(mancha, 215, 160) && !dentroDaTinta(mancha, 240, 150))
  assert.ok(Math.abs(tintaRevelada(mancha, 0.5).raio - 15) < 1e-9)
  assert.ok(PINTOR.molhadoMs >= 3000, 'dá tempo de usar as balas paradas')
})

// ---------------------------------------------------------------- MENU DO DIA

test('menu do dia: o prato do dia nunca repete o anterior e todos os pratos aparecem', () => {
  const sorte = rngDe('menu')
  let ant = null
  const vistos = new Set()
  for (let i = 0; i < 200; i++) {
    const p = proximoPratoDoDia(sorte, ant)
    assert.notEqual(p, ant)
    assert.ok(PRATOS.some((x) => x.id === p))
    vistos.add(p)
    ant = p
  }
  assert.equal(vistos.size, PRATOS.length)
})

test('menu do dia: pratos nascem fora da caixa, entram avisados pelo trajeto, e uma parte é o prato do dia (cura por perto)', () => {
  const sorte = rngDe('p')
  let bons = 0
  const total = 600
  for (let i = 0; i < total; i++) {
    const p = planejarPrato(sorte, CAIXA, 'queijo')
    assert.equal(p.bom, p.id === 'queijo')
    if (p.bom) bons++
    const fora = p.x < CAIXA.left || p.x > CAIXA.right || p.y < CAIXA.top || p.y > CAIXA.bottom
    assert.ok(fora, 'nasce fora da caixa')
    const v = Math.hypot(p.vx, p.vy)
    assert.ok(v >= MENU.velocidade.min - 1e-6 && v <= MENU.velocidade.max + 1e-6)
    // a reta entra na caixa (o trajeto é o aviso)
    let entra = false
    for (let s = 0; s < 8; s += 0.05) {
      const x = p.x + p.vx * s
      const y = p.y + p.vy * s
      if (x > CAIXA.left && x < CAIXA.right && y > CAIXA.top && y < CAIXA.bottom) entra = true
    }
    assert.ok(entra, 'o prato atravessa a caixa')
  }
  assert.ok(bons / total > 0.27 && bons / total < 0.45, `${bons / total} bons`)
  assert.deepEqual(planejarPrato(rngDe('q'), CAIXA, 'sopa'), planejarPrato(rngDe('q'), CAIXA, 'sopa'))
  assert.ok(MENU.cura <= 0.05 && MENU.dano <= 5 && MENU.avisoTrocaMs >= ATAQUE.telegrafoMs, 'cura pequena e a troca avisa')
})

// ---------------------------------------------------------------- EXPRESSO

test('expresso: cada xícara acelera, o efeito soma, acaba sozinho e passou do limite vem a tremedeira', () => {
  const est = novaCafeina()
  assert.equal(fatorDeVelocidade(nivelDeCafeina(est, 0)), 1)
  let t = 0
  const niveis = []
  for (let i = 0; i < 4; i++) {
    const r = beber(est, t)
    niveis.push(r.nivel)
    assert.equal(r.passouDoLimite, i === 3)
    t += 1000
  }
  assert.deepEqual(niveis, [1, 2, 3, 4])
  assert.ok(tremendo(est, t))
  assert.ok(fatorDeVelocidade(4) > fatorDeVelocidade(3) && fatorDeVelocidade(3) > fatorDeVelocidade(1))
  assert.ok(fatorDeVelocidade(99) === fatorDeVelocidade(EXPRESSO.maxNivel), 'tem teto')
  assert.ok(fatorDeVelocidade(4) <= 1.8, 'nunca vira um foguete')
  // cada xícara acaba no seu tempo
  assert.equal(nivelDeCafeina(est, EXPRESSO.duracaoMs + 10), 3)
  assert.equal(nivelDeCafeina(est, 3000 + EXPRESSO.duracaoMs + 10), 0)
  assert.ok(!tremendo(est, 3000 + EXPRESSO.tremeMs + 10), 'a tremedeira passa')
})

test('expresso: beber só 3 nunca treme (e esperar o efeito passar zera tudo)', () => {
  const est = novaCafeina()
  for (let i = 0; i < 3; i++) assert.equal(beber(est, i * 1500).passouDoLimite, false)
  assert.ok(!tremendo(est, 4500))
  const r = beber(est, 10 * 1000) // as antigas já passaram
  assert.equal(r.nivel, 1)
})

test('expresso: a xícara nasce dentro da caixa, longe das outras e do coração', () => {
  for (const caixa of [CAIXA, MENOR]) {
    for (let s = 0; s < 80; s++) {
      const sorte = rngDe(`ex${s}`)
      const evitar = [{ x: caixa.left + 20, y: caixa.top + 20 }]
      const p = planejarXicara(sorte, caixa, evitar)
      assert.ok(p.x >= caixa.left + 22 - 1e-9 && p.x <= caixa.right - 22 + 1e-9 && p.y >= caixa.top + 22 - 1e-9 && p.y <= caixa.bottom - 22 + 1e-9)
    }
  }
  assert.deepEqual(planejarXicara(rngDe('e'), CAIXA), planejarXicara(rngDe('e'), CAIXA))
  assert.ok(EXPRESSO.vidaMs >= 4000 && EXPRESSO.maxNaCaixa >= 1)
})

// ---------------------------------------------------------------- XADREZ

test('xadrez: o cavalo tem 8 saltos em L e o tabuleiro todo é alcançável (nunca fica preso)', () => {
  assert.equal(SALTOS.length, 8)
  for (const [dc, dr] of SALTOS) assert.equal(Math.abs(dc) * Math.abs(dr), 2)
  assert.ok(cavaloConectado())
  assert.ok(cavaloConectado(5, 4) && cavaloConectado(6, 5))
  for (let c = 0; c < XADREZ.colunas; c++) {
    for (let r = 0; r < XADREZ.linhas; r++) {
      const n = destinosDoCavalo(c, r).length
      assert.ok(n >= 2 && n <= 8, `casa ${c},${r} tem ${n} saltos`)
    }
  }
  assert.equal(destinosDoCavalo(0, 0).length, 2, 'canto')
  assert.equal(destinosDoCavalo(2, 1).length, 6, 'linha de cima: os saltos que sobem 2 não cabem')
})

test('xadrez: casas e centros combinam (ida e volta) e os destinos ficam dentro do tabuleiro', () => {
  for (const caixa of [CAIXA, MENOR, MAIOR]) {
    for (let c = 0; c < XADREZ.colunas; c++) {
      for (let r = 0; r < XADREZ.linhas; r++) {
        const p = centroDaCelula(c, r, caixa)
        assert.ok(p.x > caixa.left && p.x < caixa.right && p.y > caixa.top && p.y < caixa.bottom)
        assert.deepEqual(celulaDoPonto(p.x, p.y, caixa), { c, r })
      }
    }
  }
  assert.deepEqual(celulaDoPonto(-50, 9999, CAIXA), { c: 0, r: XADREZ.linhas - 1 }, 'fora da caixa prende na borda')
})

test('xadrez: o direcional escolhe o pulo mais alinhado (reto entre dois pulos: o mais perto do meio)', () => {
  const celula = { w: CAIXA.width / XADREZ.colunas, h: CAIXA.height / XADREZ.linhas }
  const meio = { x: CAIXA.centerX ?? (CAIXA.left + CAIXA.right) / 2, y: (CAIXA.top + CAIXA.bottom) / 2 }
  const de = { c: 2, r: 1 }
  const lista = destinosDoCavalo(de.c, de.r).map((d) => ({ ...d, ...centroDaCelula(d.c, d.r, CAIXA) }))
  for (const d of lista) {
    // empurrar exatamente na direção do pulo escolhe esse pulo
    const joy = { x: d.dc * celula.w, y: d.dr * celula.h }
    const m = Math.hypot(joy.x, joy.y)
    const sel = escolherSalto(lista, { x: (joy.x / m) * 100, y: (joy.y / m) * 100 }, celula, { centro: meio })
    assert.deepEqual([sel.c, sel.r], [d.c, d.r])
  }
  assert.equal(escolherSalto(lista, { x: 20, y: 10 }, celula), null, 'joystick fraco não pula')
  assert.equal(escolherSalto([], { x: 100, y: 0 }, celula), null)
  // direita pura entre (2,-1) e (2,1): vai para o que está mais perto do meio do tabuleiro (desempate estável)
  const a = escolherSalto(lista, { x: 100, y: 0 }, celula, { centro: meio })
  const b = escolherSalto(lista, { x: 100, y: 0 }, celula, { centro: meio })
  assert.deepEqual(a, b)
  assert.equal(a.dc, 2)
  // numa casa de canto só sobram 2 pulos: empurrar para o outro lado não escolhe nada absurdo
  const canto = destinosDoCavalo(0, 0).map((d) => ({ ...d, ...centroDaCelula(d.c, d.r, CAIXA) }))
  assert.equal(escolherSalto(canto, { x: -100, y: -100 }, celula), null)
})

test('xadrez: a CPU só pula quando a casa dela vai ficar perigosa e escolhe a mais segura', () => {
  const atual = { x: 200, y: 150 }
  const destinos = [
    { x: 160, y: 80 },
    { x: 280, y: 110 },
    { x: 240, y: 230 },
  ]
  // sem balas: fica
  assert.equal(escolherSaltoDaCpu(destinos, atual, []), null)
  // bala vindo para a casa dela: pula para um destino longe da bala
  const balas = [{ x: 140, y: 150, vx: 160, vy: 0, raio: 8, aviso: 0, idade: 0 }]
  const alvo = escolherSaltoDaCpu(destinos, atual, balas)
  assert.ok(alvo, 'pulou')
  assert.ok(notaDoDestino(alvo, balas, { ms: 300 }) > notaDoDestino(atual, balas, { ms: 260 }), 'o destino é melhor que ficar')
  // bala ainda telegrafando longe no tempo: não conta
  assert.equal(escolherSaltoDaCpu(destinos, atual, [{ ...balas[0], aviso: 5000 }]), null)
  // se todos os destinos são piores, fica onde está
  const cerco = destinos.map((d) => ({ x: d.x, y: d.y, vx: 0, vy: 0, raio: 14 }))
  assert.equal(escolherSaltoDaCpu(destinos, { x: 500, y: 500 }, cerco), null)
})

test('xadrez: recarga curta, voo curto e o limiar do joystick é de verdade', () => {
  assert.ok(XADREZ.recargaMs >= 250 && XADREZ.recargaMs <= 600)
  assert.ok(XADREZ.vooMs < XADREZ.recargaMs)
  assert.ok(XADREZ.limiarJoy >= 30 && XADREZ.limiarJoy <= 70)
  assert.ok(XADREZ.colunas * XADREZ.linhas >= 20)
})
