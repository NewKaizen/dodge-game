// node --test src/game/pvp/__tests__/
// As 8 rodadas bônus da arena ESTAÇÃO ESPACIAL (pvp/bonus/eventos/estacao/): SEM ATRITO, BURACO DE MINHOCA, RADAR,
// ÓRBITA, POLARIDADE, OXIGÊNIO, RAIO TRATOR e MANUTENÇÃO. Aqui ficam as regras PURAS (planos.js): repetíveis pela
// semente, avisadas (>= ATAQUE.telegrafoMs), sempre com uma saída justa, e a lista da arena (só os 10 certos).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { ARENA, BONUS_POR_ARENA, eventosDaArena } from '../arenas.js'
import { EVENTO } from '../bonus.js'
import { criarRng, aleatorio } from '../baralho.js'
import { ATAQUE, CORACAO } from '../../constants.js'
import { fichaDaArena } from '../../grimorio/arenas.js'
import {
  REF_CAIXA, SEM_ATRITO, passoSemAtrito, quicarNasBordas, frenagem,
  MINHOCA, embrulharCentro, embrulharBala, meiaExtensao,
  RADAR, anguloDoFeixe, feixeVarreu, brilhoDoPing, escuroMaximoMs,
  ORBITA, aceleracaoOrbital, puxaoDoCoracao, engolida,
  POLARIDADE, polDoIndice, aceleracaoPolar, polaridadeDaCpu,
  OXIGENIO, planoBolhas, drenarO2, recarregarO2, danoDoSufoco,
  TRATOR, podeAgarrar, escolherAlvoDoRaio, raioDoArremesso, arremesso, sentidoDoArremesso,
  MANUTENCAO, planoPaineis, emCimaDoPainel, passoReparo, barradaPeloEscudo,
} from '../bonus/eventos/estacao/planos.js'

const sorteDe = (semente) => {
  const rng = criarRng(semente)
  return () => aleatorio(rng) // como a arena faz: criarRng(`${semente}:efeito:${rodada}`) -> () => aleatorio(rng)
}
const SEMENTES = Array.from({ length: 40 }, (_, i) => `estacao:${i}`)
const IDS = ['semAtrito', 'minhoca', 'radar', 'orbita', 'polaridade', 'oxigenio', 'trator', 'manutencao']
const CAIXA = { left: 0, right: REF_CAIXA.largura, top: 0, bottom: REF_CAIXA.altura }
const lerEvento = (id) => readFileSync(new URL(`../bonus/eventos/estacao/${id}.js`, import.meta.url), 'utf8')

// ---------- a arena e os registros ----------

test('estação: a lista de bônus é exatamente duelo + malucas + os 8 eventos novos (10 no total)', () => {
  const ids = eventosDaArena('estacao').map((e) => e.id)
  assert.deepEqual(ids, ['duelo', 'malucas', ...IDS])
  assert.equal(ids.length, BONUS_POR_ARENA)
  assert.equal(ARENA.estacao.bonus.some((b) => typeof b === 'object'), false, 'nada de evento antigo renomeado')
})

test('estação: os eventos antigos (meteoros, airlock) sumiram do jogo', () => {
  for (const id of ['meteoros', 'airlock']) {
    assert.equal(EVENTO[id], undefined, id)
    assert.equal(existsSync(new URL(`../bonus/eventos/${id}.js`, import.meta.url)), false, `${id}.js ainda existe`)
  }
  const indice = readFileSync(new URL('../bonus/eventos/index.js', import.meta.url), 'utf8')
  assert.doesNotMatch(indice, /meteoros|airlock/)
})

test('estação: cada evento tem ficha (nome em caixa alta, cor, sem ligadura "fi"/"fl"), efeito registrado, dica e arquivo com comecar/terminar', () => {
  const indice = readFileSync(new URL('../bonus/eventos/index.js', import.meta.url), 'utf8')
  const ficha = fichaDaArena('estacao', { efeitos: Object.fromEntries(IDS.map((id) => [id, true])) })
  for (const id of IDS) {
    const ev = EVENTO[id]
    assert.ok(ev, id)
    assert.equal(ev.cartas, 'normal', id)
    assert.equal(ev.nome, ev.nome.toUpperCase(), `${id}: nome em caixa alta`)
    assert.equal(typeof ev.cor, 'number', id)
    assert.ok(ev.descricao && !/f[il]/.test(ev.descricao), `${id}: descrição sem "fi"/"fl" (a fonte vira "A")`)
    assert.match(indice, new RegExp(`import ${id} from './estacao/${id}.js'`), `${id} falta no index de efeitos`)
    assert.match(indice, new RegExp(`Object.assign\\(EFEITOS, \\{[^}]*\\b${id}\\b`), `${id} falta no EFEITOS`)
    const f = ficha.eventos.find((e) => e.id === id)
    assert.ok(f?.dica && f.dica.length > 60, `${id}: sem dica de "como se virar"`)
    assert.ok(f.previa, `${id}: sem prévia no Guia`)
    const fonte = lerEvento(id)
    assert.match(fonte, /comecar\(\)/, id)
    assert.match(fonte, /terminar\(\)/, id)
    assert.match(fonte, /cofre\.limpar\(\)/, `${id}: terminar() precisa destruir tudo o que criou`)
  }
})

test('estação: os textos de instrução têm no máximo 6 palavras', () => {
  const textos = IDS.flatMap((id) => [...lerEvento(id).matchAll(/avisoDoEvento\(arena, cofre, '([^']+)'/g)].map((m) => [id, m[1]]))
  assert.equal(textos.length, IDS.length, 'um aviso por evento')
  for (const [id, t] of textos) assert.ok(t.split(/\s+/).length <= 6, `${id}: "${t}"`)
})

// ---------- 1. SEM ATRITO ----------

test('SEM ATRITO: o coração continua deslizando quando o joystick solta (arrasto quase nulo)', () => {
  let v = { x: 0, y: 0 }
  for (let i = 0; i < 40; i++) v = passoSemAtrito(v, { x: 100, y: 0 }, 16) // empurra 0,64 s
  const solto = v.x
  assert.ok(solto > 40, 'ganhou velocidade')
  for (let i = 0; i < 31; i++) v = passoSemAtrito(v, { x: 0, y: 0 }, 16) // solta por 0,5 s
  assert.ok(v.x > solto * 0.9, `quase não perdeu velocidade (${v.x.toFixed(1)} de ${solto.toFixed(1)})`)
})

test('SEM ATRITO: velocidade máxima respeitada, em qualquer direção, e dá para frear empurrando ao contrário', () => {
  let v = { x: 0, y: 0 }
  for (let i = 0; i < 200; i++) v = passoSemAtrito(v, { x: 100, y: 100 }, 16)
  assert.ok(Math.hypot(v.x, v.y) <= SEM_ATRITO.vmax + 1e-9)
  assert.ok(SEM_ATRITO.vmax <= 100, 'um pouco abaixo (ou igual) à velocidade normal do coração')
  let ms = 0
  while (Math.hypot(v.x, v.y) > 2 && ms < 5000) {
    v = passoSemAtrito(v, { x: -100, y: -100 }, 16)
    ms += 16
  }
  const f = frenagem()
  assert.ok(ms <= f.ms * 1.3 + 100, `frear leva ${ms} ms (previsto ${Math.round(f.ms)})`)
  assert.ok(f.px < REF_CAIXA.altura * 0.35, `a frenagem (${Math.round(f.px)} px) cabe na caixa`)
})

test('SEM ATRITO: sem passo de tempo não muda nada, é repetível e a diagonal não é mais rápida', () => {
  const v = { x: 30, y: -20 }
  assert.deepEqual(passoSemAtrito(v, { x: 100, y: 0 }, 0), v)
  assert.deepEqual(passoSemAtrito(v, { x: 50, y: 50 }, 16), passoSemAtrito(v, { x: 50, y: 50 }, 16))
  const reto = passoSemAtrito({ x: 0, y: 0 }, { x: 100, y: 0 }, 100)
  const diag = passoSemAtrito({ x: 0, y: 0 }, { x: 100, y: 100 }, 100)
  assert.ok(Math.hypot(diag.x, diag.y) <= Math.hypot(reto.x, reto.y) + 1e-9)
})

test('SEM ATRITO: quica de leve na parede (perde energia) e não mexe no que está no meio', () => {
  const meio = CORACAO.tamanho / 2
  const colado = { x: CAIXA.left + meio, y: 80 }
  const q = quicarNasBordas({ x: -60, y: 10 }, colado, CAIXA, meio)
  assert.ok(q.x > 0 && q.x < 60 * 0.5, 'volta mais devagar')
  assert.equal(q.y, 10)
  assert.deepEqual(quicarNasBordas({ x: -60, y: 10 }, { x: 100, y: 80 }, CAIXA, meio), { x: -60, y: 10 })
  assert.equal(quicarNasBordas({ x: 5, y: 70 }, { x: 100, y: CAIXA.bottom - meio }, CAIXA, meio).y, -70 * SEM_ATRITO.quique)
})

// ---------- 2. BURACO DE MINHOCA ----------

test('MINHOCA: o centro do coração que passa da borda reaparece do outro lado, e dentro da caixa fica igual', () => {
  assert.deepEqual(embrulharCentro(100, 80, CAIXA), { x: 100, y: 80, saltou: null })
  assert.deepEqual(embrulharCentro(-3, 80, CAIXA), { x: REF_CAIXA.largura - 3, y: 80, saltou: 'esquerda' })
  assert.deepEqual(embrulharCentro(REF_CAIXA.largura + 4, 80, CAIXA), { x: 4, y: 80, saltou: 'direita' })
  assert.equal(embrulharCentro(100, -2, CAIXA).y, REF_CAIXA.altura - 2)
  assert.equal(embrulharCentro(100, REF_CAIXA.altura + 5, CAIXA).y, 5)
  const canto = embrulharCentro(-1, -1, CAIXA)
  assert.equal(canto.x, REF_CAIXA.largura - 1)
  assert.equal(canto.y, REF_CAIXA.altura - 1)
  // idempotente: depois de reaparecer, está dentro (não pula de novo)
  for (const [x, y] of [[-3, 10], [REF_CAIXA.largura + 4, 160], [50, -9], [50, REF_CAIXA.altura + 8]]) {
    const r = embrulharCentro(x, y, CAIXA)
    assert.equal(embrulharCentro(r.x, r.y, CAIXA).saltou, null)
  }
})

test('MINHOCA: a bala só atravessa quando está INTEIRA fora, e reaparece encostando do lado oposto, de fora', () => {
  const quase = embrulharBala(REF_CAIXA.largura + 5, 80, 8, 8, CAIXA) // 5 px fora, raio 8: ainda tocando a caixa
  assert.equal(quase.saiu, null)
  const r = embrulharBala(REF_CAIXA.largura + 9, 80, 8, 8, CAIXA)
  assert.equal(r.saiu, 'direita')
  assert.ok(r.x + 8 <= CAIXA.left + 1.1 && r.x + 8 > CAIXA.left, `entra de fora, encostando na borda esquerda (x=${r.x})`)
  assert.equal(r.y, 80)
  const cima = embrulharBala(100, -9, 8, 8, CAIXA)
  assert.equal(cima.saiu, 'cima')
  assert.ok(cima.y - 8 <= CAIXA.bottom && cima.y - 8 >= CAIXA.bottom - 1.1, 'sai por cima, entra por baixo')
  // depois de reaparecer ela NÃO conta como "saiu" de novo
  assert.equal(embrulharBala(r.x, r.y, 8, 8, CAIXA).saiu, null)
  assert.equal(MINHOCA.saltosPorBala, 1, 'cada bala atravessa uma vez só (a caixa não enche de balas)')
})

test('MINHOCA: o tamanho de cada tipo de bala', () => {
  assert.deepEqual(meiaExtensao({ tipo: 'circulo', raio: 7 }), { x: 7, y: 7 })
  assert.deepEqual(meiaExtensao({ tipo: 'retangulo', largura: 20, altura: 6 }), { x: 10, y: 3 })
  const seg = meiaExtensao({ tipo: 'segmento', comprimento: 40, espessura: 8, angulo: 0 })
  assert.deepEqual(seg, { x: 24, y: 4 })
})

// ---------- 3. RADAR ----------

test('RADAR: o feixe passa por qualquer ponto exatamente uma vez a cada volta (mesmo com frames grandes)', () => {
  for (const passoMs of [8, 16, 33, 120, 400]) {
    for (let alvo = -3; alvo <= 3; alvo += 0.37) {
      let toques = 0
      let anterior = anguloDoFeixe(0)
      for (let t = passoMs; t <= RADAR.voltaMs * 3 + 0.5; t += passoMs) {
        const agora = anguloDoFeixe(t)
        if (feixeVarreu(anterior, agora, alvo)) toques++
        anterior = agora
      }
      assert.ok(Math.abs(toques - 3) <= 1, `alvo ${alvo.toFixed(2)} passo ${passoMs}: ${toques} toques em 3 voltas`)
    }
  }
})

test('RADAR: o brilho do blip só cai, some depois do rastro, e a bala nunca fica no escuro por muito tempo', () => {
  let antes = 1
  for (let t = 0; t < RADAR.rastroMs; t += 20) {
    const b = brilhoDoPing(1000 + t, 1000)
    assert.ok(b <= antes + 1e-9 && b >= 0 && b <= 1)
    antes = b
  }
  assert.equal(brilhoDoPing(1000 + RADAR.rastroMs, 1000), 0)
  assert.equal(brilhoDoPing(500, null), 0)
  assert.equal(brilhoDoPing(900, 1000), 0, 'ping no futuro não vale')
  assert.ok(escuroMaximoMs() < RADAR.voltaMs * 0.65, 'no máximo ~60% da volta no escuro')
  assert.ok(RADAR.proximidade >= CORACAO.graze, 'bala dentro do graze sempre aparece')
  assert.ok(RADAR.voltaMs >= 1200 && RADAR.voltaMs <= 2400)
})

// ---------- 4. ÓRBITA ----------

test('ÓRBITA: a gravidade aponta para o planeta, cai com a distância, tem teto e some fora do alcance', () => {
  const a = aceleracaoOrbital(60, 0, 0, 0)
  assert.ok(a.ax < 0 && Math.abs(a.ay) < 1e-9, 'puxa para o centro')
  const mag = (d) => Math.hypot(...Object.values(aceleracaoOrbital(d, 0, 0, 0)))
  assert.ok(mag(40) > mag(80) && mag(80) > mag(120))
  assert.ok(mag(2) <= ORBITA.aMax + 1e-9 && mag(20) <= ORBITA.aMax + 1e-9)
  assert.deepEqual(aceleracaoOrbital(ORBITA.alcance + 1, 0, 0, 0), { ax: 0, ay: 0 })
  assert.deepEqual(aceleracaoOrbital(60, 0, 0, 0, 0), { ax: -0, ay: 0 }, 'sem força no começo (a gravidade sobe)')
})

test('ÓRBITA: o puxão no coração é sempre menor que o joystick (dá para sair) e o planeta cabe na caixa', () => {
  for (let d = 1; d < ORBITA.alcancePuxa; d += 1) {
    const p = puxaoDoCoracao(d, 0, 0, 0)
    assert.ok(Math.hypot(p.x, p.y) <= ORBITA.puxa + 1e-9 && p.x <= 0)
    assert.ok(Math.hypot(p.x, p.y) < 70, `a ${d}px o puxão (${Math.hypot(p.x, p.y).toFixed(1)}) deixa sair`)
  }
  assert.deepEqual(puxaoDoCoracao(ORBITA.alcancePuxa + 5, 0, 0, 0), { x: 0, y: 0 })
  assert.ok(ORBITA.raio * 2 < REF_CAIXA.altura * 0.2, 'o planeta é pequeno perto da caixa')
  assert.ok(ORBITA.avisoMs >= ATAQUE.telegrafoMs, 'o planeta avisa antes de machucar')
  assert.ok(ORBITA.alcancePuxa - ORBITA.raio > 2 * CORACAO.graze, 'a zona de perigo (planeta + graze) é bem menor que o puxão')
})

test('ÓRBITA: a bala que cai no planeta é engolida; a que passa longe não', () => {
  assert.equal(engolida(3, 2, 6, 0, 0), true)
  assert.equal(engolida(40, 0, 6, 0, 0), false)
  assert.equal(engolida(ORBITA.raio * 0.85 + 5, 0, 6, 0, 0), false)
})

// ---------- 5. POLARIDADE ----------

test('POLARIDADE: a polaridade das balas é repetível, equilibrada e depende da semente', () => {
  const seq = (semente) => Array.from({ length: 600 }, (_, i) => polDoIndice(i, semente))
  assert.deepEqual(seq(123), seq(123))
  assert.notDeepEqual(seq(123), seq(124))
  for (const semente of [0, 7, 999, 123456]) {
    const positivas = seq(semente).filter((p) => p > 0).length
    assert.ok(positivas > 600 * 0.4 && positivas < 600 * 0.6, `semente ${semente}: ${positivas}/600 positivas`)
    assert.ok(seq(semente).every((p) => p === 1 || p === -1))
  }
  // nada de sequências longas de uma só polaridade (sempre dá para "casar" com a seguinte)
  let corrida = 0
  let maior = 0
  let ultima = 0
  for (const p of seq(5)) {
    corrida = p === ultima ? corrida + 1 : 1
    ultima = p
    maior = Math.max(maior, corrida)
  }
  assert.ok(maior <= 14, `corrida máxima ${maior}`)
})

test('POLARIDADE: iguais repelem, opostos atraem, a força cai com a distância e some fora do alcance', () => {
  const igual = aceleracaoPolar(1, 1, 30, 0, 0, 0) // bala à direita do coração
  const oposto = aceleracaoPolar(1, -1, 30, 0, 0, 0)
  assert.ok(igual.ax > 0, 'repele (para longe do coração)')
  assert.ok(oposto.ax < 0, 'atrai (para o coração)')
  assert.ok(Math.abs(igual.ax) === Math.abs(oposto.ax))
  assert.ok(Math.abs(aceleracaoPolar(1, 1, 20, 0, 0, 0).ax) > Math.abs(aceleracaoPolar(1, 1, 60, 0, 0, 0).ax))
  assert.deepEqual(aceleracaoPolar(1, -1, POLARIDADE.alcance + 1, 0, 0, 0), { ax: 0, ay: 0 })
  // simétrica: − com − também repele
  assert.ok(aceleracaoPolar(-1, -1, 30, 0, 0, 0).ax > 0)
  assert.ok(POLARIDADE.recargaMs >= 100 && POLARIDADE.recargaMs <= 400)
})

test('POLARIDADE: dá tempo de inverter antes da atração fazer estrago (a bala chega mais devagar que a recarga + a reação)', () => {
  // bala a 150 px/s: do alcance do campo até o graze do coração passa bem mais que a recarga (e a reação da CPU é humana)
  const ate = ((POLARIDADE.alcance - CORACAO.graze) / 150) * 1000
  assert.ok(ate > POLARIDADE.recargaMs * 1.5, `${Math.round(ate)} ms para reagir`)
  assert.ok(POLARIDADE.cpuReacaoMs.min >= 200, 'a CPU não reage mais rápido que gente')
})

test('POLARIDADE: a CPU escolhe o polo que afasta as balas que vêm', () => {
  const c = { x: 100, y: 100 }
  const vindoDaDireita = (pol) => ({ x: 130, y: 100, vx: -120, vy: 0, pol })
  assert.equal(polaridadeDaCpu(c, [vindoDaDireita(1)], -1), 1, 'bala +: ficar + (repele)')
  assert.equal(polaridadeDaCpu(c, [vindoDaDireita(-1)], 1), -1)
  assert.equal(polaridadeDaCpu(c, [], 1), 1, 'sem balas por perto mantém')
  assert.equal(polaridadeDaCpu(c, [{ x: 300, y: 100, vx: -100, vy: 0, pol: -1 }], 1), 1, 'balas longe não contam')
  assert.equal(polaridadeDaCpu(c, [vindoDaDireita(-1), { ...vindoDaDireita(1), x: 160 }], 1), -1, 'a mais perto manda')
})

// ---------- 6. OXIGÊNIO ----------

test('OXIGÊNIO: o plano das bolhas é repetível, avisado, dentro da caixa e sempre tem uma bolha disponível', () => {
  assert.ok(OXIGENIO.avisoMs >= ATAQUE.telegrafoMs)
  for (const semente of SEMENTES) {
    const plano = planoBolhas(sorteDe(semente))
    assert.deepEqual(plano, planoBolhas(sorteDe(semente)), 'mesma semente, mesmo plano')
    assert.equal(plano.length, OXIGENIO.total)
    plano.forEach((b, i) => {
      assert.ok(b.fx >= OXIGENIO.margem && b.fx <= 1 - OXIGENIO.margem && b.fy >= OXIGENIO.margem && b.fy <= 1 - OXIGENIO.margem)
      if (i) {
        assert.ok(b.em > plano[i - 1].em)
        // a próxima bolha nasce antes de a anterior sumir: sempre dá para recarregar
        assert.ok(b.em - plano[i - 1].em <= OXIGENIO.avisoMs + OXIGENIO.vidaMs, 'sem buraco sem bolha')
      }
    })
    assert.ok(plano[0].em <= OXIGENIO.inicial * OXIGENIO.drenaMs, 'a 1ª bolha vem antes de o ar acabar')
  }
  assert.notDeepEqual(planoBolhas(sorteDe('a')), planoBolhas(sorteDe('b')))
})

test('OXIGÊNIO: dá tempo de chegar a qualquer bolha (a pé) e o ar se sustenta pegando uma bolha a cada poucos segundos', () => {
  const diagonal = Math.hypot(REF_CAIXA.largura, REF_CAIXA.altura)
  const viagemMs = (diagonal / CORACAO.velocidadePadrao) * 1000
  assert.ok(viagemMs < OXIGENIO.vidaMs * 0.5, `viagem máxima ${Math.round(viagemMs)} ms`)
  assert.ok(OXIGENIO.bolha * OXIGENIO.drenaMs >= 2000, 'cada bolha rende vários segundos de ar')
  // esvazia sozinho em drenaMs e nunca passa de 0/1
  let o2 = 1
  for (let t = 0; t < OXIGENIO.drenaMs + 100; t += 20) o2 = drenarO2(o2, 20)
  assert.equal(o2, 0)
  assert.equal(recarregarO2(0.8), 1)
  assert.ok(Math.abs(recarregarO2(0) - OXIGENIO.bolha) < 1e-9)
})

test('OXIGÊNIO: sem ar o dano é pequeno e raro (2% do HP máximo, no mínimo 1, a cada 1,5 s)', () => {
  assert.equal(danoDoSufoco(100), 2)
  assert.equal(danoDoSufoco(20), 1)
  assert.equal(danoDoSufoco(undefined), 2)
  const porSegundo = (danoDoSufoco(100) / OXIGENIO.tickMs) * 1000
  assert.ok(porSegundo <= 1.5, `${porSegundo.toFixed(2)} HP/s`)
  assert.ok(OXIGENIO.tickMs >= 1000)
})

// ---------- 7. RAIO TRATOR ----------

const bola = (o = {}) => ({ tipo: 'circulo', x: 100, y: 100, raio: 6, idade: 900, aviso: 400, vx: 0, vy: 0, ...o })

test('RAIO TRATOR: só agarra o que dá e o que já vale (não a bala piscando, a morta, a enorme, a segurada)', () => {
  assert.equal(podeAgarrar(bola()), true)
  assert.equal(podeAgarrar(bola({ idade: 100 })), false, 'ainda piscando')
  assert.equal(podeAgarrar(bola({ morta: true })), false)
  assert.equal(podeAgarrar(bola({ inofensiva: true })), false)
  assert.equal(podeAgarrar(bola({ segurada: true })), false)
  assert.equal(podeAgarrar(bola({ marcaPlaneta: true })), false)
  assert.equal(podeAgarrar(bola({ raio: 40 })), false)
  assert.equal(podeAgarrar({ tipo: 'retangulo', largura: 10, altura: 10, x: 0, y: 0, idade: 900, aviso: 0 }), true)
  assert.equal(podeAgarrar({ tipo: 'retangulo', largura: 200, altura: 6, x: 0, y: 0, idade: 900, aviso: 0 }), false)
  assert.equal(podeAgarrar({ tipo: 'segmento', comprimento: 30, espessura: 4, x: 0, y: 0, idade: 900, aviso: 0 }), false)
})

test('RAIO TRATOR: escolhe a bala agarrável mais perto dentro do alcance', () => {
  const lista = [bola({ x: 100 + TRATOR.alcance + 20 }), bola({ x: 140, y: 100, id: 'perto' }), bola({ x: 110, y: 100, id: 'colada' }), bola({ x: 105, y: 100, inofensiva: true })]
  assert.equal(escolherAlvoDoRaio(lista, 100, 100).id, 'colada')
  assert.equal(escolherAlvoDoRaio([bola({ x: 100 + TRATOR.alcance + 30 })], 100, 100), null)
  assert.equal(escolherAlvoDoRaio([], 100, 100), null)
})

test('RAIO TRATOR: o arremesso é avisado, entra pela borda virada para quem lançou e fica dentro da altura da caixa', () => {
  assert.ok(TRATOR.avisoMs >= ATAQUE.telegrafoMs, 'telegrafo mínimo')
  const l = { left: 300, right: 520, top: 100, bottom: 270 }
  const daEsquerda = arremesso(l, sentidoDoArremesso(0), 180, 6)
  assert.ok(daEsquerda.x < l.left && daEsquerda.vx > 0 && daEsquerda.vy === 0, 'P1 lança: entra pela esquerda do alvo, andando para a direita')
  const daDireita = arremesso(l, sentidoDoArremesso(1), 180, 6)
  assert.ok(daDireita.x > l.right && daDireita.vx < 0)
  assert.equal(daEsquerda.aviso, TRATOR.avisoMs)
  for (const y of [-500, 90, 180, 280, 900]) {
    const a = arremesso(l, 1, y, 8)
    assert.ok(a.y >= l.top + 8 && a.y <= l.bottom - 8, `y=${a.y} dentro da caixa`)
  }
  // o tempo que o oponente tem para desviar: aviso + viagem até o coração, bem acima do que o coração precisa para sair do caminho
  const saidaMs = (2 * (8 + CORACAO.hitbox + 4)) / CORACAO.velocidadePadrao * 1000
  assert.ok(TRATOR.avisoMs > saidaMs * 3, `aviso ${TRATOR.avisoMs} ms contra ${Math.round(saidaMs)} ms para sair da linha`)
  assert.ok(TRATOR.velocidade <= 240 && TRATOR.dano <= 6)
})

test('RAIO TRATOR: o raio da bala lançada fica entre o mínimo e o máximo, o jogo limita lançadas ao mesmo tempo e a recarga existe', () => {
  assert.equal(raioDoArremesso(bola({ raio: 3 })), TRATOR.raioMin)
  assert.equal(raioDoArremesso(bola({ raio: 14 })), TRATOR.raioMax)
  assert.equal(raioDoArremesso({ tipo: 'retangulo', largura: 16, altura: 10 }), 8)
  assert.ok(TRATOR.emVooMax >= 1 && TRATOR.emVooMax <= 3)
  assert.ok(TRATOR.recargaMs >= 400, 'sem metralhadora')
  assert.ok(TRATOR.segurarMaxMs >= 2000, 'dá tempo de mirar')
  assert.equal(sentidoDoArremesso(0), 1)
  assert.equal(sentidoDoArremesso(1), -1)
})

// ---------- 8. MANUTENÇÃO ----------

test('MANUTENÇÃO: o plano dos painéis é repetível, dentro da caixa, em ordem e com vão para o coração passar', () => {
  for (const semente of SEMENTES) {
    const plano = planoPaineis(sorteDe(semente))
    assert.deepEqual(plano, planoPaineis(sorteDe(semente)))
    assert.equal(plano.length, MANUTENCAO.quantos)
    const px = plano.map((p) => ({ x: p.fx * REF_CAIXA.largura, y: p.fy * REF_CAIXA.altura }))
    px.forEach((p, i) => {
      assert.ok(p.x - MANUTENCAO.w / 2 >= MANUTENCAO.margem - 1 && p.x + MANUTENCAO.w / 2 <= REF_CAIXA.largura - MANUTENCAO.margem + 1, `x=${p.x}`)
      assert.ok(p.y - MANUTENCAO.h / 2 >= MANUTENCAO.margem - 1 && p.y + MANUTENCAO.h / 2 <= REF_CAIXA.altura - MANUTENCAO.margem + 1, `y=${p.y}`)
      if (i) assert.ok(plano[i].em > plano[i - 1].em)
      for (let k = 0; k < i; k++) {
        const vaoX = Math.abs(p.x - px[k].x) - MANUTENCAO.w
        const vaoY = Math.abs(p.y - px[k].y) - MANUTENCAO.h
        assert.ok(Math.max(vaoX, vaoY) >= MANUTENCAO.vao - 1, `painéis ${k} e ${i} se encostam (vão ${Math.max(vaoX, vaoY).toFixed(1)})`)
      }
    })
  }
  assert.notDeepEqual(planoPaineis(sorteDe('a')), planoPaineis(sorteDe('b')))
})

test('MANUTENÇÃO: os painéis nunca fecham a caixa (área coberta pequena, o coração passa entre eles)', () => {
  const area = MANUTENCAO.quantos * MANUTENCAO.w * MANUTENCAO.h
  assert.ok(area < REF_CAIXA.largura * REF_CAIXA.altura * 0.15, `${Math.round((area / (REF_CAIXA.largura * REF_CAIXA.altura)) * 100)}% da caixa`)
  assert.ok(MANUTENCAO.vao > CORACAO.tamanho, 'o vão entre painéis é maior que o coração')
})

test('MANUTENÇÃO: ~1 s parado em cima conserta; sair faz regredir mais rápido; fora do painel nada sobe', () => {
  let p = 0
  let ms = 0
  while (p < 1 && ms < 3000) {
    p = passoReparo(p, true, 16)
    ms += 16
  }
  assert.ok(ms >= MANUTENCAO.repararMs - 16 && ms <= MANUTENCAO.repararMs + 32, `${ms} ms`)
  assert.equal(passoReparo(0.5, true, 10000), 1)
  assert.equal(passoReparo(0, false, 500), 0)
  const desce = 0.8 - passoReparo(0.8, false, 100)
  const sobe = passoReparo(0.2, true, 100) - 0.2
  assert.ok(desce > sobe, 'regride mais rápido do que sobe')
  assert.ok(emCimaDoPainel(100, 100, 100, 100))
  assert.ok(emCimaDoPainel(100 + MANUTENCAO.w / 2, 100, 100, 100))
  assert.ok(!emCimaDoPainel(100 + MANUTENCAO.w, 100, 100, 100))
})

test('MANUTENÇÃO: o escudo barra balas comuns e deixa passar as enormes (feixes) e as que estão longe', () => {
  const painel = { x: 100, y: 100 }
  assert.equal(barradaPeloEscudo(bola({ x: 100, y: 100 }), painel.x, painel.y), true)
  assert.equal(barradaPeloEscudo(bola({ x: 100 + MANUTENCAO.w / 2 + 4, y: 100 }), painel.x, painel.y), true, 'tocando a borda')
  assert.equal(barradaPeloEscudo(bola({ x: 100 + MANUTENCAO.w / 2 + 20, y: 100 }), painel.x, painel.y), false)
  assert.equal(barradaPeloEscudo({ tipo: 'retangulo', x: 100, y: 100, largura: 12, altura: 8 }, painel.x, painel.y), true)
  assert.equal(barradaPeloEscudo({ tipo: 'retangulo', x: 100, y: 100, largura: 220, altura: 6 }, painel.x, painel.y), false, 'feixe longo atravessa')
  assert.equal(barradaPeloEscudo({ tipo: 'segmento', x: 100, y: 100, comprimento: 200, espessura: 4, angulo: 0 }, painel.x, painel.y), false)
  assert.equal(barradaPeloEscudo({ tipo: 'segmento', x: 100, y: 100, comprimento: 30, espessura: 4, angulo: 0 }, painel.x, painel.y), true)
})

// ---------- limpeza e determinismo dos efeitos (estrutura do código) ----------

test('os efeitos só usam o rng da rodada (nada de Math.random no que muda a jogabilidade) e desligam o que ligaram', () => {
  for (const id of IDS) {
    const fonte = lerEvento(id)
    const uso = [...fonte.matchAll(/Math\.random/g)].length
    // Math.random só vale como reserva do rng (`rng ?? Math.random`)
    assert.equal([...fonte.matchAll(/rng \?\? Math\.random/g)].length, uso, `${id}: Math.random fora da reserva do rng`)
  }
  // quem toca na entrada/rede solta tudo no fim
  for (const id of ['polaridade', 'trator']) {
    const fonte = lerEvento(id)
    assert.match(fonte, /desligarBotao\(\)/, id)
    assert.match(fonte, /canal\.fechar\(\)/, id)
  }
  assert.match(lerEvento('minhoca'), /c\.caixa = s\.pista\.caixa/, 'MINHOCA devolve a caixa de verdade ao coração')
  assert.match(lerEvento('radar'), /setVisible\(true\)/, 'RADAR mostra as balas de novo')
})
