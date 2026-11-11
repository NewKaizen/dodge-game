// node --test src/lib/__tests__/desafio.test.js
// O DESAFIO DIÁRIO puro (src/lib/desafio.js): a virada do dia em São Paulo, a definição de cada dia
// (determinística, igual para todos), os pontos, o cosmético da semana e a luta com os modificadores.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diaDoDesafio, desafioDoDia, numeroDoDia, semanaDoDia, faseDoDesafio, lerDesafio, pontosDoDesafio, cosmeticoDaSemana, cosmeticoDoId, ehCosmeticoDiario, descreverDesafio, PERSONAGENS_DESAFIO, CHEFES_DESAFIO, MODIFICADORES, VERSAO_DESAFIO } from '../desafio.js'
import { criarLuta, comecarRodada, jogar } from '../../game/campanha/luta.js'
import { CHEFES } from '../../game/coop/chefes/index.js'
import { semLigaduras } from '../../game/campanha/texto.js'

test('o dia vira à meia-noite de São Paulo (não à do UTC)', () => {
  assert.equal(diaDoDesafio(Date.UTC(2026, 10, 11, 0, 30)).id, '2026-11-10') // 21:30 em SP
  assert.equal(diaDoDesafio(Date.UTC(2026, 10, 11, 2, 59, 59, 999)).id, '2026-11-10')
  assert.equal(diaDoDesafio(Date.UTC(2026, 10, 11, 3, 0, 0)).id, '2026-11-11')
  const d = diaDoDesafio(Date.UTC(2026, 10, 11, 15, 0))
  assert.equal(d.fim - d.inicio, 86_400_000)
  assert.equal(d.inicio, Date.UTC(2026, 10, 11, 3, 0))
  assert.equal(d.restanteMs, Date.UTC(2026, 10, 12, 3, 0) - Date.UTC(2026, 10, 11, 15, 0))
  assert.equal(d.semana, '2026-S46')
  // domingo ainda é a semana de segunda passada; a segunda abre outra
  assert.equal(semanaDoDia('2026-11-15'), '2026-S46')
  assert.equal(semanaDoDia('2026-11-16'), '2026-S47')
  assert.equal(semanaDoDia('2027-01-01'), '2026-S53')
})

test('ids de dia: só datas que existem', () => {
  assert.equal(numeroDoDia('2026-02-29'), null)
  assert.equal(numeroDoDia('2026-13-01'), null)
  assert.equal(numeroDoDia('ontem'), null)
  assert.equal(numeroDoDia('2026-11-11'), Date.UTC(2026, 10, 11) / 86_400_000)
  assert.equal(desafioDoDia('2026-02-30'), null)
})

test('a definição do dia é determinística, varia entre os dias e só usa o que o servidor refaz', () => {
  const vistos = new Set()
  for (let k = 0; k < 120; k++) {
    const id = new Date(Date.UTC(2026, 10, 1) + k * 86_400_000).toISOString().slice(0, 10)
    const a = desafioDoDia(id)
    assert.deepEqual(a, desafioDoDia(id), id)
    assert.equal(a.versao, VERSAO_DESAFIO)
    assert.ok(a.semente.includes(id))
    assert.ok(PERSONAGENS_DESAFIO.includes(a.personagem))
    assert.ok(CHEFES_DESAFIO.includes(a.chefe) && CHEFES[a.chefe], a.chefe)
    assert.ok(a.aliado === null || (PERSONAGENS_DESAFIO.includes(a.aliado) && a.aliado !== a.personagem))
    assert.ok(MODIFICADORES[a.modificador])
    // sozinho(a): nunca no médio nem com metade do HP
    if (!a.aliado) assert.ok(a.nivel === 'facil' && a.modificador !== 'por_um_fio', id)
    assert.ok(['facil', 'medio'].includes(a.nivel))
    vistos.add(`${a.personagem}:${a.chefe}:${a.modificador}`)
    assert.deepEqual(lerDesafio({ ...a }), a)
  }
  assert.ok(vistos.size > 40, `pouca variedade: ${vistos.size}`)
  assert.equal(lerDesafio({ ...desafioDoDia('2026-11-11'), versao: 0 }), null)
  assert.equal(lerDesafio(null), null)
})

test('os textos do dia passam sem ligadura e descrevem regra e modificador', () => {
  const d = { ...desafioDoDia('2026-11-11'), regra: 'eco', modificador: 'veloz' }
  const linhas = descreverDesafio(d)
  assert.equal(linhas.length, 2)
  assert.match(linhas[1], /^VELOZ:/)
  // (a tela passa tudo por semLigaduras: "fi"/"fl" viram "f‌i"/"f‌l")
  for (const l of Object.values(MODIFICADORES).map((m) => m.texto)) assert.ok(!/f[il]/.test(semLigaduras(l)), l)
})

test('a luta do desafio aplica o modificador (o servidor e o navegador usam a mesma fase)', () => {
  const base = { ...desafioDoDia('2026-11-11'), aliado: 'noelle', regra: 'nenhuma' }
  const metade = criarLuta({ desafio: { ...base, modificador: 'por_um_fio' }, semente: 's' })
  const normal = criarLuta({ desafio: { ...base, modificador: 'escuridao' }, semente: 's' })
  assert.equal(metade.estado.jogadores[0].hpMax, Math.round(normal.estado.jogadores[0].hpMax / 2))
  assert.equal(metade.estado.jogadores[0].hp, metade.estado.jogadores[0].hpMax)
  assert.equal(faseDoDesafio({ ...base, modificador: 'escuridao' }).modificador.escuro, true)
  // o ritmo do quadro: VELOZ deixa os ataques 20% mais rápidos que o mesmo dia sem ele
  // (a 1ª rodada nem sempre tem ataque no quadro: a semente que tiver, a mesma para os dois)
  const ritmo = (modificador, semente) => {
    const l = criarLuta({ desafio: { ...base, modificador }, semente })
    comecarRodada(l)
    return jogar(l, null).rodada.esquiva?.ritmo.velocidade ?? null
  }
  const semente = Array.from({ length: 40 }, (_, k) => `r${k}`).find((s) => ritmo('veloz', s))
  const [rapido, comum] = [ritmo('veloz', semente), ritmo('escuridao', semente)]
  assert.ok(rapido && comum)
  assert.ok(Math.abs(rapido / comum - 1.2) < 1e-9, `${rapido} / ${comum}`)
})

test('pontos: vitória vale mais que qualquer derrota; menos acertos e mais HP, mais pontos', () => {
  const derrotaPerfeita = pontosDoDesafio({ vitoria: false, chefeFracao: 0.99, perfeitos: 3, grazes: 50 })
  const vitoriaSofrida = pontosDoDesafio({ vitoria: true, rodadas: 20, acertos: 20, hpFracao: 0.05, chefeFracao: 1 })
  assert.ok(vitoriaSofrida > derrotaPerfeita)
  assert.ok(pontosDoDesafio({ vitoria: true, rodadas: 8, acertos: 1, hpFracao: 0.9, chefeFracao: 1 }) > pontosDoDesafio({ vitoria: true, rodadas: 8, acertos: 5, hpFracao: 0.6, chefeFracao: 1 }))
  assert.equal(pontosDoDesafio({ acertos: 999 }), 0)
  assert.equal(pontosDoDesafio(), 0)
  assert.ok(Number.isInteger(pontosDoDesafio({ vitoria: true, hpFracao: 0.333, chefeFracao: 1, rodadas: 7 })))
})

test('o cosmético da semana: único por semana, com a semana no id; ida e volta pelo id', () => {
  const a = cosmeticoDaSemana('2026-S46')
  const b = cosmeticoDaSemana('2026-S47')
  assert.notEqual(a.id, b.id)
  assert.match(a.id, /^(titulo|moldura|verso)\.diario_2026_46$/)
  assert.ok(a.nome.length <= 32)
  assert.deepEqual(cosmeticoDoId(a.id), a)
  assert.equal(cosmeticoDoId('verso.diario_2026_99'), null)
  assert.equal(cosmeticoDoId(a.id.replace(a.tipo, a.tipo === 'verso' ? 'titulo' : 'verso')), null)
  assert.ok(ehCosmeticoDiario(a.id) && !ehCosmeticoDiario('titulo.semanal_2026_46'))
  for (let s = 1; s <= 52; s++) {
    const c = cosmeticoDaSemana(`2027-S${String(s).padStart(2, '0')}`)
    assert.ok(c.nome.length <= 32 && /^[a-z]+\.[a-z0-9_]{2,24}$/.test(c.id), c.id)
    if (c.tipo !== 'titulo') assert.match(c.cor, /^#[0-9a-f]{6}$/)
  }
})
