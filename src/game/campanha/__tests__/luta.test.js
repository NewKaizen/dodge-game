// node --test src/game/campanha/__tests__/luta.test.js
// A LUTA da campanha que o SERVIDOR roda (campanha/luta.js): um chefe com as regras do CO-OP, a Kris e
// a CPU aliada, o quadro com o ataque de verdade (campanha/quadro.js), as regras de cada fase, o
// servidor refazendo a esquiva e as estrelas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLuta, comecarRodada, visaoDaRodada, jogar, concluirEsquiva, estrelasDaLuta, caixaDaRodada, maxAcertos, descreverRegra, QUADRO_MINIMO } from '../luta.js'
import { criarQuadro, simularQuadro, duracaoDoQuadro } from '../quadro.js'
import { cenaSemTela } from '../cenaSemTela.js'
import { ler, MAX_AMOSTRAS_QUADRO } from '../amostras.js'
import { MUNDO1 } from '../mundos/mundo1.js'
import { CHEFES } from '../../coop/chefes/index.js'
import { CARTAS_CHEFES } from '../../coop/cartasChefe.js'
import { QUADRO } from '../../coop/quadro.js'
import { ENERGIA } from '../../pvp/regras.js'
import { desviarNoQuadro } from './apoioQuadro.js'

const melhor = (v) => v.eu.mao.filter((x) => v.eu.jogaveis.includes(x.id) && x.naipe !== 'copas').sort((a, b) => b.custo - a.custo)[0]?.id ?? null

// uma rodada inteira: carta -> esquiva (piloto) -> fim
function rodada(l, { carta = melhor, piloto = 'bom', relato } = {}) {
  const v = l.etapa === 'inicio' ? comecarRodada(l) : visaoDaRodada(l)
  const r = jogar(l, typeof carta === 'function' ? carta(v) : carta)
  assert.ok(r.ok, r.motivo)
  const esq = r.rodada.esquiva
  const e = esq && esq.jogadores[0] ? desviarNoQuadro(esq, { piloto }) : { acertos: 0, amostras: [] }
  const fim = concluirEsquiva(l, { amostras: ler(e.amostras, MAX_AMOSTRAS_QUADRO), acertosCliente: relato ?? e.acertos, decorridoMs: 60_000 })
  return { v, r, e, fim }
}

function lutarAteOFim(l, op) {
  let x
  for (let i = 0; i < 40 && l.etapa !== 'fim'; i++) x = rodada(l, op)
  return x
}

test('cada fase luta contra um chefe da campanha (formato do CO-OP), com a aliada certa', () => {
  for (const f of MUNDO1.fases) {
    const def = CHEFES[f.inimigo]
    assert.ok(def?.campanha, `${f.id}: chefe ${f.inimigo}`)
    const l = criarLuta({ mundo: 1, fase: f.n, semente: 'a' })
    const v = comecarRodada(l)
    assert.equal(v.chefe.id, f.inimigo)
    assert.equal(v.chefe.hp, v.chefe.hpMax)
    assert.equal(v.eu.personagem, 'kris')
    assert.equal(v.eu.mao.length, 5)
    assert.equal(v.aliado?.personagem ?? null, f.aliado)
    assert.ok(v.chefe.intencao?.naipe, 'o chefe mostra a intenção (o naipe)')
  }
  // a fase 1 é sozinha; as outras têm a última pessoa libertada como aliada
  assert.equal(MUNDO1.fases[0].aliado, null)
  for (const f of MUNDO1.fases.slice(1, 5)) assert.equal(f.aliado, MUNDO1.fases[f.n - 2].oponente)
})

test('as fases da campanha não aparecem no CO-OP; todo ataque dos chefes roda no quadro (sem Phaser)', () => {
  for (const id of Object.keys(CHEFES).filter((x) => CHEFES[x].campanha)) {
    const cartas = [...CARTAS_CHEFES[id].fases.flat(), CARTAS_CHEFES[id].super]
    for (const carta of cartas) {
      const esq = { chefe: id, nivel: 'facil', carta, danos: [5, 5], hp: [90, 90], jogadores: [true, true], caixa: {}, ritmo: { velocidade: 1, densidade: 1 }, semente: `t:${carta.id}` }
      const s = simularQuadro(esq, [])
      assert.ok(Number.isInteger(s.acertos[1]), carta.id)
      assert.equal(s.duracao, duracaoDoQuadro(esq), carta.id)
    }
  }
})

test('o servidor refaz o quadro EXATAMENTE com as amostras de cada passo (você e a aliada)', () => {
  const id = 'c_susie'
  for (const carta of CARTAS_CHEFES[id].fases.flat()) {
    const esq = { chefe: id, nivel: 'facil', carta, danos: [8, 8], hp: [90, 90], jogadores: [true, true], caixa: {}, ritmo: { velocidade: 1.1, densidade: 1.2 }, semente: `x:${carta.id}` }
    const cliente = desviarNoQuadro(esq, { piloto: 'zigue' })
    const servidor = simularQuadro(esq, ler(cliente.amostras, MAX_AMOSTRAS_QUADRO))
    assert.deepEqual(servidor.acertos, cliente.q.acertos, carta.id)
    assert.deepEqual(servidor.grazes, cliente.q.grazes, carta.id)
  }
})

test('a rodada: carta conferida com a mão e a energia do servidor; a aliada joga; a esquiva vem com tudo', () => {
  const l = criarLuta({ mundo: 1, fase: 2, semente: 'r' })
  assert.deepEqual(jogar(l, null), { ok: false, motivo: 'fora_de_hora' })
  const v = comecarRodada(l)
  assert.equal(v.eu.energia, ENERGIA.inicial)
  assert.equal(jogar(l, 'kris-espadas-99').motivo, 'fora_da_mao')
  assert.equal(jogar(l, 42).motivo, 'carta_invalida')
  const cara = v.eu.mao.find((x) => x.custo > v.eu.energia)
  if (cara) assert.equal(jogar(l, cara.id).motivo, 'sem_energia')
  assert.equal(l.etapa, 'escolha')
  const r = jogar(l, melhor(v))
  assert.ok(r.ok)
  assert.equal(r.rodada.jogadas.length, 2)
  if (r.rodada.esquiva) {
    assert.match(r.rodada.esquiva.semente, /^r:r1:quadro$/)
    assert.equal(r.rodada.esquiva.jogadores.length, 2)
    assert.ok(r.rodada.esquiva.duracao > 3000)
  }
  // mesma semente, mesma luta
  const l2 = criarLuta({ mundo: 1, fase: 2, semente: 'r' })
  comecarRodada(l2)
  assert.deepEqual(jogar(l2, melhor(v)).rodada.jogadas, r.rodada.jogadas)
})

test('as regras das fases: só espadas, energia 0, o quadro que encolhe', () => {
  const f1 = criarLuta({ mundo: 1, fase: 1, semente: 'so' })
  const v1 = comecarRodada(f1)
  assert.ok(v1.eu.mao.every((x) => x.naipe === 'espadas'))
  f1.estado.jogadores[0].baralho.mao.push({ id: 'kris-copas-3', personagem: 'kris', naipe: 'copas', valor: 3, nome: 'x', custo: 1 })
  assert.equal(jogar(f1, 'kris-copas-3').motivo, 'regra')
  const f4 = criarLuta({ mundo: 1, fase: 4, semente: 'e' })
  assert.equal(comecarRodada(f4).eu.energia, 0)
  const corredor = MUNDO1.fases[1]
  const [a, b] = [caixaDaRodada(corredor, 1), caixaDaRodada(corredor, 4)]
  assert.deepEqual(a, { largura: QUADRO.largura, altura: QUADRO.altura })
  assert.ok(b.largura < a.largura && b.altura < a.altura)
  assert.deepEqual(caixaDaRodada(corredor, 99), QUADRO_MINIMO)
  for (const f of MUNDO1.fases) assert.ok(descreverRegra(f.regra), f.id)
})

test('sozinha na fase 1: a vaga da aliada fica fora do quadro e não joga', () => {
  const l = criarLuta({ mundo: 1, fase: 1, semente: 'solo' })
  const v = comecarRodada(l)
  assert.equal(v.aliado, null)
  const r = jogar(l, melhor(v))
  assert.equal(r.rodada.jogadas[1].passou, true)
  if (r.rodada.esquiva) assert.deepEqual(r.rodada.esquiva.jogadores, [true, false])
})

test('o servidor é o piso dos acertos: relato "não levei nada" parado no meio do ataque não salva', () => {
  const l = criarLuta({ mundo: 1, fase: 5, semente: 'piso' })
  let acertos = 0
  for (let i = 0; i < 4 && l.etapa !== 'fim'; i++) acertos += rodada(l, { piloto: 'parado', relato: 0 }).fim.acertos?.[0] ?? 0
  assert.ok(acertos > 0)
})

test('suspeita: posições impossíveis e relato acima do possível', () => {
  const l = criarLuta({ mundo: 1, fase: 2, semente: 'sus' })
  let x
  do {
    const v = comecarRodada(l)
    x = jogar(l, melhor(v))
    if (!x.rodada.esquiva?.jogadores[0]) concluirEsquiva(l, { amostras: [], acertosCliente: 0, decorridoMs: 60_000 })
  } while (!x.rodada.esquiva?.jogadores[0] && l.etapa !== 'fim')
  const e = desviarNoQuadro(x.rodada.esquiva, { piloto: 'bom' })
  const a = ler(e.amostras, MAX_AMOSTRAS_QUADRO)
  a[20] = { ...a[20], x: a[20].x + 80 }
  assert.equal(concluirEsquiva(l, { amostras: a, acertosCliente: 0, decorridoMs: 60_000 }).suspeita, 'teleporte')
  assert.ok(maxAcertos(6000) < 20)
})

test('uma luta inteira termina, com estrelas coerentes; derrota sem estrela', () => {
  const l = criarLuta({ mundo: 1, fase: 1, semente: 'inteira' })
  const { fim } = lutarAteOFim(l, { piloto: 'bom' })
  assert.ok(fim.vencedor)
  assert.equal(l.etapa, 'fim')
  if (l.vencedor === 'vitoria') assert.ok(estrelasDaLuta(l) >= 1)
  const d = criarLuta({ mundo: 1, fase: 6, semente: 'derrota' })
  lutarAteOFim(d, { piloto: 'parado', carta: () => null })
  assert.equal(d.vencedor, 'derrota')
  assert.equal(estrelasDaLuta(d), 0)
})

test('o TITÃ arremessa as cartas que você NÃO jogou (todas, se passou), antes do ataque dele', () => {
  const l = criarLuta({ mundo: 1, fase: 6, semente: 'tita' })
  const v = comecarRodada(l)
  const jogada = melhor(v)
  const r = jogar(l, jogada)
  const esq = r.rodada.esquiva
  assert.ok(esq, 'sempre há esquiva: no mínimo as suas cartas')
  assert.deepEqual(esq.cartas.map((c) => c.id), v.eu.mao.map((c) => c.id).filter((id) => id !== jogada))
  assert.deepEqual(r.rodada.arremessadas.map((c) => c.id), esq.cartas.map((c) => c.id))
  // as cartas viram balas de verdade no quadro, cada uma com o id da carta
  const q = criarQuadro(cenaSemTela(), esq)
  const vistas = new Set()
  while (!q.acabou) {
    q.passo({ x: 0, y: 0 })
    for (const b of q.balas.lista) if (b.cartaId) vistas.add(b.cartaId)
  }
  assert.deepEqual([...vistas].sort(), esq.cartas.map((c) => c.id).sort())
  // parado no meio das cartas, alguma acerta (o servidor confere igual)
  const e = desviarNoQuadro(esq, { piloto: 'parado' })
  const fim = concluirEsquiva(l, { amostras: ler(e.amostras, MAX_AMOSTRAS_QUADRO), acertosCliente: e.acertos, decorridoMs: 60_000 })
  assert.ok(fim.ok && fim.acertos[0] >= 1)
  // as outras fases não arremessam
  const outra = criarLuta({ mundo: 1, fase: 5, semente: 'semcartas' })
  const v5 = comecarRodada(outra)
  assert.equal(jogar(outra, melhor(v5)).rodada.esquiva?.cartas ?? null, null)
})

test('cair no meio da esquiva não vira suspeita (o coração caído segue mandando a posição)', () => {
  const l = criarLuta({ mundo: 1, fase: 6, semente: 'queda' })
  comecarRodada(l)
  const r = jogar(l, null)
  const esq = r.rodada.esquiva
  // (a aliada pode ter curado ou jogado a segunda chance: a queda é forçada depois da jogada dela)
  l.estado.jogadores[0].hp = 1
  l.estado.jogadores[0].protegido = false
  esq.hp[0] = 1
  esq.protegido[0] = false
  const e = desviarNoQuadro(esq, { piloto: 'parado' })
  assert.equal(e.q.caiu[0], true)
  const fim = concluirEsquiva(l, { amostras: ler(e.amostras, MAX_AMOSTRAS_QUADRO), acertosCliente: e.acertos, decorridoMs: 60_000 })
  assert.equal(fim.suspeita, undefined)
  assert.equal(fim.eu.caido, true)
})

test('os limites do quadro são os da BattleBox (arredondados igual), em toda rodada, até encolhendo', async () => {
  const { limitesDoQuadro } = await import('../quadro.js')
  // BattleBox.aplicar(cx, cy, w, h): setTo(round(cx - w/2), round(cy - h/2), round(w), round(h))
  const daBattleBox = (cx, cy, largura, altura) => {
    const w = Math.round(largura)
    const h = Math.round(altura)
    return { left: Math.round(cx - w / 2), top: Math.round(cy - h / 2), width: w, height: h }
  }
  for (let r = 1; r <= 30; r++) {
    const c = caixaDaRodada(MUNDO1.fases[1], r)
    const l = limitesDoQuadro(c)
    const b = daBattleBox(l.centerX, l.centerY, c.largura, c.altura)
    assert.deepEqual({ left: l.left, top: l.top, width: l.width, height: l.height }, b, `rodada ${r}`)
    for (const v of [l.left, l.top, l.right, l.bottom]) assert.ok(Number.isInteger(v))
  }
})
