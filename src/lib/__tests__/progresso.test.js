import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as P from '../progresso.js'

const sql = fs.readFileSync(new URL('../../../supabase/migrations/0003_progresso.sql', import.meta.url), 'utf8')
const sql5 = fs.readFileSync(new URL('../../../supabase/migrations/0005_pendencias.sql', import.meta.url), 'utf8')
const docs = fs.readFileSync(new URL('../../../docs/online.md', import.meta.url), 'utf8')

// a tabela documentada (docs/online.md): nível -> XP total para chegar nele
const TABELA = [
  [1, 0],
  [2, 100],
  [3, 225],
  [4, 375],
  [5, 550],
  [6, 750],
  [7, 975],
  [8, 1225],
  [9, 1500],
  [10, 1800],
  [11, 2125],
  [12, 2475],
  [13, 2850],
  [14, 3250],
  [15, 3675],
]

test('curva: o espelho em JS bate com a tabela documentada', () => {
  for (const [nivel, total] of TABELA) {
    assert.equal(P.xpTotalDoNivel(nivel), total, `nível ${nivel}`)
    assert.equal(P.nivelDoXp(total), nivel)
    if (total > 0) assert.equal(P.nivelDoXp(total - 1), nivel - 1)
  }
  assert.equal(P.xpParaProximo(1), 100)
  assert.equal(P.xpParaProximo(2), 125)
  assert.equal(P.xpParaProximo(0), 100)
  assert.deepEqual(P.progressoDoXp(260), { nivel: 3, noNivel: 35, paraProximo: 150, total: 260 })
  assert.equal(P.nivelDoXp(-5), 1)
  assert.equal(P.nivelDoXp(1e12), P.NIVEL_MAXIMO)
  assert.equal(P.progressoDoXp(1e9).noNivel, P.progressoDoXp(1e9).paraProximo, 'no máximo a barra fica cheia')
})

test('curva: a tabela do docs/online.md é a mesma', () => {
  const linhas = [...docs.matchAll(/^\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/gm)].map((m) => m.slice(1).map(Number))
  assert.ok(linhas.length >= 15, 'a tabela de níveis está no docs/online.md')
  for (const [nivel, total, proximo] of linhas) {
    assert.equal(P.xpTotalDoNivel(nivel), total, `docs: nível ${nivel}`)
    assert.equal(P.xpParaProximo(nivel), proximo, `docs: próximo do nível ${nivel}`)
  }
})

const constanteSql = (nome) => Number(new RegExp(`function public\\.${nome}\\(\\)[^$]*\\$\\$ select (\\d+) \\$\\$`).exec(sql)?.[1])

test('as constantes do SQL são as do JS', () => {
  assert.equal(constanteSql('xp_participacao'), P.XP_PARTICIPACAO)
  assert.equal(constanteSql('xp_vitoria'), P.XP_VITORIA)
  assert.equal(constanteSql('duracao_minima_s'), P.DURACAO_MINIMA_S)
  assert.equal(constanteSql('rodadas_minimas'), P.RODADAS_MINIMAS)
  assert.equal(constanteSql('repeticao_cheia'), P.REPETICAO_CHEIA)
  assert.equal(constanteSql('repeticao_limite'), P.REPETICAO_LIMITE)
  assert.equal(constanteSql('nivel_maximo'), P.NIVEL_MAXIMO)
  assert.equal(Number(/function public\.convidados_limite_dia\(\)[^$]*\$\$ select (\d+) \$\$/.exec(sql5)?.[1]), P.CONVIDADOS_LIMITE_DIA)
  assert.match(sql, /select 100 \+ 25 \* \(greatest\(coalesce\(p_nivel, 1\), 1\) - 1\)/, 'a fórmula da curva no SQL')
})

test('o catálogo do JS é o seed do SQL', () => {
  const seed = [...sql.matchAll(/^\s*\('([a-z]+\.[a-z0-9_]+)', '([a-z]+)', '([^']+)', (\d+), (true|false)\)/gm)].map((m) => ({ id: m[1], tipo: m[2], nome: m[3], nivel: Number(m[4]), padrao: m[5] === 'true' }))
  assert.deepEqual(
    seed,
    P.CATALOGO.map(({ id, tipo, nome, nivel, padrao }) => ({ id, tipo, nome, nivel, padrao: Boolean(padrao) })),
  )
  // trilha: ~10–15 itens entre os níveis 2 e 15, um por nível
  const trilha = P.CATALOGO.filter((i) => !i.padrao)
  assert.ok(trilha.length >= 10 && trilha.length <= 15)
  assert.deepEqual(trilha.map((i) => i.nivel), [...new Set(trilha.map((i) => i.nivel))].sort((a, b) => a - b))
  assert.ok(trilha.every((i) => i.nivel >= 2 && i.nivel <= 15))
  assert.ok(P.CATALOGO.every((i) => i.id.startsWith(`${i.tipo}.`) && P.TIPOS_ITEM.includes(i.tipo)))
  // os avatares da trilha estão no CHECK do perfil
  const check = sql.split('\n').find((l) => l.includes("avatar_tipo = 'jogo' and avatar_id in"))
  for (const a of P.AVATARES_TRILHA) assert.ok(check.includes(`'${a}'`), a)
})

test('xpDaPartida: o mesmo cálculo do conceder_recompensa', () => {
  const ok = { duracaoS: 120, rodadas: 4 }
  assert.deepEqual(P.xpDaPartida({ resultado: 'vitoria', ...ok }), { xp: 60, motivo: 'vitoria' })
  assert.deepEqual(P.xpDaPartida({ resultado: 'derrota', ...ok }), { xp: 40, motivo: 'derrota' })
  assert.deepEqual(P.xpDaPartida({ resultado: 'contestada', ...ok }), { xp: 40, motivo: 'contestada' })
  assert.deepEqual(P.xpDaPartida({ resultado: 'abandono', ...ok }), { xp: 0, motivo: 'abandono' })
  assert.deepEqual(P.xpDaPartida({ resultado: 'vitoria', duracaoS: 59 }), { xp: 0, motivo: 'curta' })
  assert.deepEqual(P.xpDaPartida({ resultado: 'vitoria', duracaoS: 200, rodadas: 1 }), { xp: 0, motivo: 'curta' })
  assert.deepEqual(P.xpDaPartida({ resultado: 'vitoria', ...ok, repeticoes: 3 }), { xp: 30, motivo: 'repeticao_metade' })
  assert.deepEqual(P.xpDaPartida({ resultado: 'vitoria', ...ok, repeticoes: 5 }), { xp: 0, motivo: 'repeticao' })
})

test('próxima recompensa e itens até o nível', () => {
  assert.equal(P.proximaRecompensa(1).nivel, 2)
  assert.equal(P.proximaRecompensa(4).id, 'avatar.king')
  assert.equal(P.proximaRecompensa(15), null)
  assert.deepEqual(P.itensAte(3).map((i) => i.id), ['titulo.esquivador', 'moldura.bronze'])
  assert.equal(P.corDaMoldura('moldura.ouro'), '#ffd34d')
  assert.equal(P.corDaMoldura('titulo.duelista'), null)
  assert.equal(P.nomeDoItem('titulo.veterano'), 'Veterano da Mesa')
  for (const m of ['convidado', 'curta', 'repeticao', 'abandono', 'sem_relato', 'contestada', 'participacao', 'cpu']) assert.ok(P.textoMotivo(m), m)
})
