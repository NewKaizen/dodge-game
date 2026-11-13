// node --test src/lib/__tests__/cosmeticos.test.js
// O catálogo dos slots novos e o sorteio do baú (src/lib/cosmeticos.js): os ids batem com o contrato do
// conteúdo (dano-*, efeito-*, lancamento-*, moldura-anim-*), as chances publicadas somam 100%, a
// distribuição de um sorteio grande fica perto das chances, a pena (épico a cada 10) e o duplicado vira XP.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import * as C from '../cosmeticos.js'
import { itemDoCatalogo, CATALOGO } from '../progresso.js'

const PREFIXOS = { som: /^dano-[a-z-]+$/, efeito: /^efeito-[a-z-]+$/, lancamento: /^lancamento-[a-z-]+$/, moldura: /^moldura-anim-[a-z-]+$/, frente: /^frente-[a-z-]+$/, verso: /^verso-[a-z-]+$/ }

test('ids: formato do banco, do registro e a ida e volta', () => {
  const vistos = new Set()
  for (const i of C.ITENS_BAU) {
    assert.match(i.id, /^(titulo|moldura|som|efeito|lancamento|frente|verso)\.[a-z0-9_]{2,24}$/, i.id)
    assert.ok(i.id.length <= 40)
    assert.ok(C.RARIDADES.includes(i.raridade), i.id)
    assert.ok(i.nome.length >= 1 && i.nome.length <= 32, i.id)
    assert.ok(!vistos.has(i.id), `repetido: ${i.id}`)
    vistos.add(i.id)
    assert.ok(!CATALOGO.some((c) => c.id === i.id), 'não colide com a trilha')
    assert.equal(itemDoCatalogo(i.id)?.nome, i.nome, 'itemDoCatalogo acha os do baú')
  }
  for (const i of C.ITENS_SLOTS) {
    assert.match(i.registro, PREFIXOS[i.slot], i.registro)
    assert.equal(C.idDoRegistro(i.registro), i.id)
    assert.equal(C.registroDoId(i.id), i.registro)
    assert.equal(C.slotDoId(i.id), i.slot)
  }
  assert.equal(C.registroDoId('moldura.ouro'), null, 'moldura parada não é animada')
  assert.deepEqual(C.SLOTS.map((s) => C.itensDoSlot(s).length > 0), [true, true, true, true, true])
  assert.ok(C.itensDoSlot('verso').length >= 10, 'os versos ilustrados do baú')
  assert.equal(C.registroDoId('frente.cervos_nara'), 'frente-cervos-nara')
  assert.equal(C.registroDoId('verso.dragao_pixel'), 'verso-dragao-pixel')
  assert.equal(C.arteDoVerso('verso.galaxia'), 'verso-galaxia')
  assert.equal(C.arteDoVerso('verso.dourado'), null, 'os versos lisos da trilha não têm desenho')
  assert.equal(C.arteDoVerso('frente.tarot'), null)
  assert.equal(C.registroDoId('lancamento.arco_iris_borboletas'), 'lancamento-arco-iris-borboletas')
  assert.equal(C.registroDoId('moldura.anim_galaxia'), 'moldura-anim-galaxia')
})

test('docs/cosmeticos-ids.md lista todos os ids do registro', () => {
  const doc = readFileSync(new URL('../../../docs/cosmeticos-ids.md', import.meta.url), 'utf8')
  for (const i of C.ITENS_SLOTS) assert.ok(doc.includes(`\`${i.registro}\``), i.registro)
  for (const p of Object.values(C.PADRAO_REGISTRO)) assert.ok(doc.includes(`\`${p}\``), p)
})

test('chances publicadas: somam 100% e batem com a escala', () => {
  assert.equal(Object.values(C.PESOS).reduce((a, b) => a + b, 0), C.ESCALA)
  assert.deepEqual(C.CHANCES.map((c) => c.pct), [60, 28, 10, 2])
  assert.match(C.TEXTO_CHANCES, /LENDÁRIO 2%/)
  assert.equal(C.raridadeDoSorteio(0), 'comum')
  assert.equal(C.raridadeDoSorteio(599_999), 'comum')
  assert.equal(C.raridadeDoSorteio(600_000), 'raro')
  assert.equal(C.raridadeDoSorteio(879_999), 'raro')
  assert.equal(C.raridadeDoSorteio(880_000), 'epico')
  assert.equal(C.raridadeDoSorteio(980_000), 'lendario')
  assert.equal(C.raridadeDoSorteio(999_999), 'lendario')
  assert.deepEqual([0, 499_999, 500_000, 849_999, 850_000, 999_999].map(C.quantidadeDoSorteio), [1, 1, 2, 2, 3, 3])
  for (const r of C.RARIDADES) assert.ok(C.POOL_BAU[r].length > 0, `há itens ${r}`)
})

const sortear = () => Array.from({ length: C.SORTEIO_TAMANHO }, () => crypto.randomInt(0, C.ESCALA))

test('distribuição: 60 mil baús ficam perto das chances (sem a pena)', () => {
  const N = 60_000
  const conta = { comum: 0, raro: 0, epico: 0, lendario: 0 }
  const qtd = { 1: 0, 2: 0, 3: 0 }
  let xpExtra = 0
  let extras = 0
  for (let i = 0; i < N; i++) {
    const r = C.rolarBau(sortear(), { desdeEpico: 0 })
    qtd[r.recompensas.length]++
    for (const [k, x] of r.recompensas.entries()) {
      conta[x.raridade]++
      if (k > 0) {
        extras++
        if (x.tipo === 'xp') xpExtra++
      }
    }
    assert.notEqual(r.recompensas[0].tipo, 'xp', 'a 1ª é sempre cosmético')
  }
  const total = Object.values(conta).reduce((a, b) => a + b, 0)
  for (const c of C.CHANCES) assert.ok(Math.abs((conta[c.raridade] / total) * 100 - c.pct) < 1, `${c.raridade}: ${((conta[c.raridade] / total) * 100).toFixed(2)}%`)
  assert.ok(Math.abs(qtd[1] / N - 0.5) < 0.015 && Math.abs(qtd[2] / N - 0.35) < 0.015 && Math.abs(qtd[3] / N - 0.15) < 0.015, JSON.stringify(qtd))
  assert.ok(Math.abs(xpExtra / extras - 0.35) < 0.02)
})

test('pena: com o pior sorteio possível, o 10º baú sempre traz épico (e zera)', () => {
  const ruim = Array(C.SORTEIO_TAMANHO).fill(0) // tudo comum, 1 recompensa
  let desde = 0
  const raridades = []
  for (let i = 0; i < 30; i++) {
    const r = C.rolarBau(ruim, { desdeEpico: desde })
    raridades.push(r.recompensas[0].raridade)
    assert.equal(r.pity, (i + 1) % 10 === 0)
    desde = r.desdeEpico
  }
  assert.deepEqual(raridades.map((r, i) => (r === 'epico' ? i + 1 : null)).filter(Boolean), [10, 20, 30])
  // aleatório: nunca passam 10 baús seguidos sem épico ou melhor
  desde = 0
  let seguidos = 0
  for (let i = 0; i < 20_000; i++) {
    const r = C.rolarBau(sortear(), { desdeEpico: desde })
    const melhor = Math.max(...r.recompensas.map((x) => C.nivelDaRaridade(x.raridade)))
    seguidos = melhor >= 2 ? 0 : seguidos + 1
    assert.ok(seguidos < C.PITY, `passou ${seguidos}`)
    desde = r.desdeEpico
    assert.equal(desde, seguidos)
  }
})

test('duplicado vira XP (já tinha, ou saiu duas vezes no mesmo baú)', () => {
  const u = [999_999, 0, 0, 0, 0, 999_999, 0, 0, 999_999, 0] // 3 recompensas comuns, o mesmo índice 0
  const primeiro = C.POOL_BAU.comum[0]
  const r = C.rolarBau(u, { desdeEpico: 0 })
  assert.deepEqual(r.recompensas.map((x) => x.tipo), ['item', 'duplicado', 'duplicado'])
  assert.equal(r.recompensas[1].id, primeiro)
  assert.equal(r.xp, 2 * C.XP_DUPLICADO.comum)
  const ja = C.rolarBau(u, { desdeEpico: 0, possui: (id) => id === primeiro })
  assert.equal(ja.recompensas[0].tipo, 'duplicado')
  assert.equal(ja.recompensas[0].xp, C.XP_DUPLICADO.comum)
  assert.match(C.textoDaRecompensa(ja.recompensas[0]), /já tinha, \+15 XP/)
  // XP extra (2ª recompensa com o número de tipo baixo)
  const xp = C.rolarBau([500_000, 0, 0, 0, 0, 0, 0, 0, 0, 0], { desdeEpico: 0 })
  assert.deepEqual(xp.recompensas[1], { tipo: 'xp', raridade: 'comum', xp: C.XP_BONUS.comum })
  assert.throws(() => C.rolarBau([1, 2, 3]), /sorteio inválido/)
  assert.throws(() => C.rolarBau(Array(10).fill(C.ESCALA)), /sorteio inválido/)
})

test('equipar só o que tem; o lobby só repassa ids conhecidos', () => {
  const inv = new Set(['som.latido'])
  assert.equal(C.podeEquipar('som', 'som.latido', inv), true)
  assert.equal(C.podeEquipar('som', 'som.laser', inv), false)
  assert.equal(C.podeEquipar('som', 'efeito.chamas', new Set(['efeito.chamas'])), false, 'tipo errado')
  assert.equal(C.podeEquipar('som', null, inv), true, 'tirar sempre pode')
  assert.equal(C.podeEquipar('verso', 'verso.dourado', inv), false)
  assert.equal(C.podeEquipar('frente', 'frente.tarot', new Set(['frente.tarot'])), true)
  assert.equal(C.podeEquipar('frente', 'frente.tarot', inv), false, 'estilo que não tem')
  assert.equal(C.podeEquipar('frente', 'som.latido', inv), false, 'tipo errado')
  assert.equal(C.podeEquipar('frente', null, inv), true, 'volta à clássica')
  const perfil = { som_equipado: 'som.latido', efeito_equipado: 'efeito.inventado', lancamento_equipado: null, moldura_equipada: 'moldura.anim_fogo' }
  assert.deepEqual(C.cosmeticosPublicos(perfil), { som: 'som.latido', efeito: null, lancamento: null, moldura: 'moldura.anim_fogo', frente: null })
  assert.equal(C.cosmeticosPublicos({ frente_equipada: 'frente.tarot' }).frente, 'frente.tarot', 'o estilo viaja pelo lobby')
  assert.equal(C.cosmeticosPublicos({ frente_equipada: 'frente.inventada' }).frente, null)
  assert.equal(C.equipadosDoPerfil({ frente_equipada: 'frente.sakura' }).frente, 'frente-sakura')
  assert.deepEqual(C.cosmeticosPublicos({ moldura_equipada: 'moldura.ouro' }).moldura, null, 'moldura parada não viaja como animada')
  assert.deepEqual(C.equipadosDoPerfil(perfil), { som: 'dano-latido', efeito: 'efeito-nenhum', lancamento: 'lancamento-padrao', moldura: 'moldura-anim-fogo', frente: 'frente-classica' })
  assert.deepEqual(C.equipadosDoPerfil(null), C.EQUIPADOS_PADRAO)
})

// o catálogo do JS é o mesmo dos inserts das migrations (0015 + 0016), sem precisar de Postgres
test('ITENS_BAU = os itens com bau das migrations 0015 e 0016 (id, tipo, nome, raridade)', () => {
  const ler = (n) => readFileSync(new URL(`../../../supabase/migrations/${n}.sql`, import.meta.url), 'utf8')
  const linhas = [ler('0015_baus_cosmeticos'), ler('0016_cartas_estilos')].join('\n')
  const doSql = [...linhas.matchAll(/^\s*\('([a-z]+\.[a-z0-9_]+)', '([a-z]+)', '([^']+)', public\.nivel_exclusivo\(\), false, false, '([a-z]+)', true\)/gm)].map((m) => `${m[1]}=${m[2]}:${m[3]}:${m[4]}`).sort()
  const doJs = C.ITENS_BAU.map((i) => `${i.id}=${i.tipo}:${i.nome}:${i.raridade}`).sort()
  assert.deepEqual(doSql, doJs)
  const m16 = ler('0016_cartas_estilos')
  assert.match(m16, /frente_equipada/)
  assert.match(m16, /'lancamento', 'frente'\)/, 'equipar_conta aceita o tipo frente')
  assert.match(m16, /revoke all on function public\.equipar_conta\(uuid, text, text\) from public, anon, authenticated/)
})

test('baú nunca se compra: nada no catálogo fala de preço ou moeda', () => {
  const fonte = readFileSync(new URL('../cosmeticos.js', import.meta.url), 'utf8')
  assert.doesNotMatch(fonte, /preco|preço|moeda_|comprar\(|pagamento/i)
  assert.deepEqual(Object.keys(C.FONTES_BAU).sort(), ['conquista', 'desafio', 'dia', 'nivel', 'semanal'])
})
