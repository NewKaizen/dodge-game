// node --test src/game/campanha/__tests__/partida.test.js
// A partida da campanha que o SERVIDOR roda: rodada, carta conferida com a mão/energia do servidor,
// a CPU decide, as regras especiais de cada fase, o dano decidido pelo servidor e as estrelas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarCorrida, comecarRodada, visaoDaRodada, jogar, concluirEsquiva, estrelasDaCorrida, caixaDaRodada, CAIXA_CAMPANHA, CAIXA_MINIMA, maxAcertos, descreverRegra } from '../partida.js'
import { ler } from '../amostras.js'
import { ENERGIA } from '../../pvp/regras.js'
import { MUNDO1 } from '../mundos/mundo1.js'
import { desviar } from './apoio.js'

const melhorAtaque = (v) => v.eu.mao.filter((x) => v.eu.jogaveis.includes(x.id) && x.naipe !== 'copas').sort((a, b) => b.custo - a.custo)[0]?.id ?? null

// joga uma rodada inteira: carta -> esquiva (piloto) -> fim
function rodada(c, { carta = melhorAtaque, piloto = 'bom', mexer } = {}) {
  const v = c.etapa === 'inicio' ? comecarRodada(c) : visaoDaRodada(c)
  const r = jogar(c, typeof carta === 'function' ? carta(v) : carta)
  assert.ok(r.ok, r.motivo)
  const e = r.rodada.ataque ? desviar(r.rodada.ataque, { piloto }) : { acertos: 0, amostras: [] }
  let amostras = ler(e.amostras)
  if (mexer) amostras = mexer(amostras, r.rodada.ataque)
  return { v, r, e, fim: concluirEsquiva(c, { amostras, acertosCliente: e.acertos, decorridoMs: 60_000 }) }
}

test('a rodada: energia do servidor, mão de 5, CPU joga, ataques com semente', () => {
  const c = criarCorrida({ mundo: 1, fase: 2, semente: 'x' })
  const v = comecarRodada(c)
  assert.equal(v.rodada, 1)
  assert.equal(v.eu.energia, ENERGIA.inicial)
  assert.equal(v.eu.mao.length, 5)
  assert.equal(v.cpu.personagem, 'noelle')
  assert.equal(v.cpu.hpMax, Math.round(85 * 0.5))
  const r = jogar(c, melhorAtaque(v))
  assert.ok(r.ok)
  assert.equal(r.rodada.jogadas.length, 2)
  if (r.rodada.ataque) {
    assert.match(r.rodada.ataque.semente, /^x:r1:0$/)
    assert.equal(r.rodada.ataque.verificado, true)
  }
  if (r.rodada.ataqueCpu) assert.ok(r.rodada.cpuAmostras.length > 30)
  // de novo, mesma semente: a CPU decide igual
  const c2 = criarCorrida({ mundo: 1, fase: 2, semente: 'x' })
  const r2 = jogar((comecarRodada(c2), c2), melhorAtaque(v))
  assert.deepEqual(r2.rodada.jogadas, r.rodada.jogadas)
})

test('carta ilegal é recusada e nada muda: fora da mão, sem energia, regra da fase, fora de hora', () => {
  const c = criarCorrida({ mundo: 1, fase: 2, semente: 'ilegal' })
  assert.deepEqual(jogar(c, null), { ok: false, motivo: 'fora_de_hora' })
  const v = comecarRodada(c)
  assert.equal(jogar(c, 'kris-espadas-99').motivo, 'fora_da_mao')
  assert.equal(jogar(c, 'susie-espadas-2').motivo, 'fora_da_mao')
  assert.equal(jogar(c, 42).motivo, 'carta_invalida')
  const cara = v.eu.mao.find((x) => x.custo > v.eu.energia)
  if (cara) assert.equal(jogar(c, cara.id).motivo, 'sem_energia')
  assert.equal(c.estado.jogadores[0].energia, v.eu.energia)
  assert.equal(c.estado.jogadores[0].baralho.mao.length, 5)
  assert.equal(c.etapa, 'escolha')
  // só ♠ (fase 1): o baralho da fase só tem espadas
  const f1 = criarCorrida({ mundo: 1, fase: 1, semente: 'so' })
  const v1 = comecarRodada(f1)
  assert.ok(v1.eu.mao.every((x) => x.naipe === 'espadas'))
  f1.estado.jogadores[0].baralho.mao.push({ id: 'kris-copas-3', personagem: 'kris', naipe: 'copas', valor: 3, nome: 'x', custo: 1 })
  assert.equal(jogar(f1, 'kris-copas-3').motivo, 'regra')
})

test('energia começa em 0 no Bosque sem Tinta', () => {
  const c = criarCorrida({ mundo: 1, fase: 4, semente: 'e' })
  const v = comecarRodada(c)
  assert.equal(v.eu.energia, 0)
  assert.equal(v.cpu.energia, ENERGIA.inicial)
  assert.deepEqual(v.eu.jogaveis, [])
})

test('a caixa encolhe a cada rodada (até o mínimo) e deita quando a página vira', () => {
  const f = MUNDO1.fases[1]
  const l = (cx) => [cx.direita - cx.esquerda, cx.base - cx.topo]
  const [l1, a1] = l(caixaDaRodada(f, 1))
  const [l3, a3] = l(caixaDaRodada(f, 3))
  assert.deepEqual([l1, a1], l(CAIXA_CAMPANHA))
  assert.ok(l3 < l1 && a3 < a1)
  const [lm, am] = l(caixaDaRodada(f, 40))
  assert.ok(Math.abs(lm - CAIXA_MINIMA.largura) <= 1 && Math.abs(am - CAIXA_MINIMA.altura) <= 1)
  const [lv, av] = l(caixaDaRodada(MUNDO1.fases[5], 3, { virou: true }))
  assert.ok(lv > l1 && av < a1)
})

test('eco: o ataque que você mandou volta na rodada seguinte', () => {
  const c = criarCorrida({ mundo: 1, fase: 3, semente: 'eco' })
  const { r } = rodada(c)
  const mandei = c.ultimoAtaqueJogador
  assert.ok(mandei, 'mandei um ataque')
  for (let i = 0; i < 4 && c.etapa !== 'fim'; i++) {
    const antes = c.ultimoAtaqueJogador
    const x = rodada(c)
    if (x.r.rodada.ataque && x.r.rodada.jogadas[1].carta && !x.r.rodada.jogadas[1].anulada) {
      assert.deepEqual(x.r.rodada.ataque.modelos, antes.modelos)
      assert.equal(x.r.rodada.ataque.forca, antes.forca)
    }
  }
  assert.ok(r)
})

test('ataques só de cima na Chuva de Recortes; o chefe manda dois juntos', () => {
  const c = criarCorrida({ mundo: 1, fase: 5, semente: 'cima' })
  for (let i = 0; i < 4 && c.etapa !== 'fim'; i++) {
    const { r } = rodada(c)
    if (r.rodada.ataque) assert.equal(r.rodada.ataque.soDeCima, true)
  }
  const b = criarCorrida({ mundo: 1, fase: 6, semente: 'chefe' })
  let viu = false
  for (let i = 0; i < 4 && b.etapa !== 'fim'; i++) {
    const { r } = rodada(b)
    if (r.rodada.ataque && r.rodada.jogadas[1].carta) {
      assert.equal(r.rodada.ataque.modelos.length, 2)
      viu = true
    }
  }
  assert.ok(viu)
})

test('o chefe vira a página na metade do HP (uma vez): cura e a caixa deita', () => {
  const c = criarCorrida({ mundo: 1, fase: 6, semente: 'virada' })
  const chefe = c.estado.jogadores[1]
  comecarRodada(c)
  chefe.hp = Math.floor(chefe.hpMax / 2) - 1
  const antes = chefe.hp
  // passando a vez: a CPU não leva dano nesta rodada
  const { fim } = rodada(c, { carta: null })
  assert.equal(fim.virou, true)
  assert.ok(c.virou)
  assert.ok(chefe.hp > antes, 'curou ao virar')
  const v = comecarRodada(c)
  assert.equal(v.virou, true)
  assert.ok(v.caixa.base - v.caixa.topo < CAIXA_CAMPANHA.base - CAIXA_CAMPANHA.topo)
  chefe.hp = 3
  assert.equal(rodada(c, { carta: null }).fim.virou, false, 'só uma vez')
})

test('o dano é do servidor: relato de "nenhum acerto" não salva quem ficou parado', () => {
  const c = criarCorrida({ mundo: 1, fase: 5, semente: 'parado' })
  let danoServidor = 0
  for (let i = 0; i < 6 && c.etapa !== 'fim'; i++) {
    const v = comecarRodada(c)
    const r = jogar(c, melhorAtaque(v))
    const e = r.rodada.ataque ? desviar(r.rodada.ataque, { piloto: 'parado' }) : { amostras: [], acertos: 0 }
    const f = concluirEsquiva(c, { amostras: ler(e.amostras), acertosCliente: 0, decorridoMs: 60_000 })
    assert.ok(f.ok)
    assert.ok(f.acertos >= f.acertosServidor)
    danoServidor += f.dano
  }
  assert.ok(danoServidor > 0, 'o servidor achou os acertos mesmo com o relato zerado')
})

test('o relato do navegador só pode piorar para ele; relato impossível é suspeito', () => {
  const c = criarCorrida({ mundo: 1, fase: 2, semente: 'rel' })
  const v = comecarRodada(c)
  let r = jogar(c, melhorAtaque(v))
  while (!r.rodada.ataque) {
    concluirEsquiva(c, { amostras: [], acertosCliente: 0, decorridoMs: 60_000 })
    r = jogar(c, melhorAtaque(comecarRodada(c)))
  }
  const e = desviar(r.rodada.ataque, { piloto: 'bom' })
  const hp = c.estado.jogadores[0].hp
  const f = concluirEsquiva(c, { amostras: ler(e.amostras), acertosCliente: 2, decorridoMs: 60_000 })
  assert.equal(f.acertos, Math.max(2, f.acertosServidor))
  assert.equal(c.estado.jogadores[0].hp, Math.max(0, hp - f.acertos * r.rodada.ataque.dano))
  const c2 = criarCorrida({ mundo: 1, fase: 2, semente: 'rel2' })
  comecarRodada(c2)
  const r2 = jogar(c2, null)
  const d = r2.rodada.ataque?.duracao ?? 0
  const e2 = r2.rodada.ataque ? desviar(r2.rodada.ataque) : { amostras: [] }
  assert.equal(concluirEsquiva(c2, { amostras: ler(e2.amostras), acertosCliente: maxAcertos(d) + 1, decorridoMs: 60_000 }).suspeita, 'relato_impossivel')
})

test('posições adulteradas: teleporte, rápida demais e relógio adiantado viram suspeita', () => {
  const tentar = (mexer, decorridoMs = 60_000) => {
    for (let s = 0; s < 10; s++) {
      const c = criarCorrida({ mundo: 1, fase: 2, semente: `tp${s}` })
      const v = comecarRodada(c)
      const r = jogar(c, melhorAtaque(v))
      if (!r.rodada.ataque) continue
      const e = desviar(r.rodada.ataque)
      return concluirEsquiva(c, { amostras: mexer(ler(e.amostras), r.rodada.ataque), acertosCliente: 0, decorridoMs })
    }
    throw new Error('nenhuma rodada com ataque')
  }
  assert.equal(tentar((a, at) => a.map((s, i) => (i === 30 ? { ...s, x: s.x > (at.caixa.esquerda + at.caixa.direita) / 2 ? at.caixa.esquerda + 10 : at.caixa.direita - 10 } : s))).suspeita, 'teleporte')
  assert.equal(tentar((a) => a).ok, true)
  assert.equal(tentar((a) => a, 1000).suspeita, 'rapida_demais')
  assert.equal(tentar((a) => a.slice(0, 20)).suspeita, 'curta')
})

test('partida inteira com quem desvia bem: vence (quase sempre) e ganha estrelas', () => {
  let vitorias = 0
  for (const f of MUNDO1.fases) {
    for (const sem of ['a', 'c']) {
      const c = criarCorrida({ mundo: 1, fase: f.n, semente: `inteira${sem}${f.n}` })
      for (let i = 0; i < 40 && c.etapa !== 'fim'; i++) rodada(c)
      assert.equal(c.etapa, 'fim')
      if (c.vencedor === 'p1') {
        vitorias++
        assert.ok(estrelasDaCorrida(c) >= 1)
      }
    }
    assert.ok(descreverRegra(f.regra).length > 10)
  }
  assert.ok(vitorias >= 10, `${vitorias}/12`)
})

test('estrelas: vencer, HP >= 60% e rodadas <= meta', () => {
  const c = criarCorrida({ mundo: 1, fase: 1, semente: 'est' })
  c.vencedor = 'p2'
  assert.equal(estrelasDaCorrida(c), 0)
  c.vencedor = 'p1'
  c.estado.rodada = 3
  c.estado.jogadores[0].hp = c.estado.jogadores[0].hpMax
  assert.equal(estrelasDaCorrida(c), 3)
  c.estado.jogadores[0].hp = Math.floor(c.estado.jogadores[0].hpMax * 0.5)
  assert.equal(estrelasDaCorrida(c), 2)
  c.estado.rodada = 99
  assert.equal(estrelasDaCorrida(c), 1)
})

test('assinatura: o que a CPU manda na SUA caixa usa o golpe do oponente (rodízio por rodada)', () => {
  const vistos = new Set()
  for (let k = 0; k < 8; k++) {
    const c = criarCorrida({ mundo: 1, fase: 4, semente: `as${k}` })
    for (let n = 0; n < 4; n++) {
      const { r, fim } = rodada(c)
      const at = r.rodada.ataque
      if (at && !r.rodada.jogadas[0].anulada) {
        vistos.add(at.modelos[0])
        assert.equal(at.verificado, true)
      }
      if (fim.vencedor) break
    }
  }
  // a Susie (fase 4): faróis (feixes) e investidas (galhos)
  assert.ok(vistos.has('feixes'), [...vistos].join())
})

test('fúria do chefe: depois da virada, com 30% do HP, uma vez só; o ataque dele fica mais forte', () => {
  let achou = false
  for (let k = 0; k < 12 && !achou; k++) {
    const c = criarCorrida({ mundo: 1, fase: 6, semente: `fu${k}` })
    let furias = 0
    let viradaAntes = false
    let depois = null
    while (c.etapa !== 'fim') {
      const { r, fim } = rodada(c)
      if (c.furia && r.rodada.ataque && !r.rodada.jogadas[0].anulada && furias) depois = r.rodada.ataque
      if (fim.virou) viradaAntes = true
      if (fim.furia) {
        furias++
        assert.ok(viradaAntes, 'fúria antes da virada')
        assert.ok(fim.adversario.hp <= fim.adversario.hpMax * 0.3)
        assert.equal(visaoDaRodada(c).furia, true)
      }
    }
    assert.ok(furias <= 1)
    if (furias && depois) {
      achou = true
      assert.ok(depois.duracao >= 4000 + 500, `duração ${depois.duracao}`)
      assert.ok(depois.forca >= 0.3, `força ${depois.forca}`)
    }
  }
  assert.ok(achou, 'nenhuma luta chegou à fúria com um ataque depois')
})

test('fúria: só com a regra e só depois da virada', () => {
  const c = criarCorrida({ mundo: 1, fase: 5, semente: 'semfuria' })
  for (let n = 0; n < 12 && c.etapa !== 'fim'; n++) {
    const { fim } = rodada(c)
    assert.ok(!fim.furia)
  }
  assert.equal(c.furia, false)
})
