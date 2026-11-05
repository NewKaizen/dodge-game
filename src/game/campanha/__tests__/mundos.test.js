// node --test src/game/campanha/__tests__/mundos.test.js
// Os dados dos mundos (regras + textos): tudo o que o servidor e a tela leem tem de existir e bater.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MUNDOS, TEXTOS, faseDe, faseLiberada, ITENS_CAMPANHA, textosDaFase } from '../mundos/index.js'
import { falasValidas } from '../dialogo.js'
import { PERSONAGENS } from '../../data/personagens.js'
import { CARTAS } from '../../pvp/cartas.js'
import { NIVEIS_BOT } from '../../pvp/bot.js'
import { descreverRegra } from '../partida.js'

const REGRAS = ['soNaipe', 'caixaEncolhe', 'eco', 'energiaInicial', 'soDeCima', 'duplo', 'virada']
const sql = readFileSync(new URL('../../../../supabase/migrations/0011_campanha.sql', import.meta.url), 'utf8')

test('cada mundo: fases 1..n, oponentes do jogo, regras conhecidas, chefe por último', () => {
  for (const m of MUNDOS) {
    assert.ok(PERSONAGENS[m.personagem] && CARTAS[m.personagem], m.personagem)
    m.fases.forEach((f, i) => {
      assert.equal(f.n, i + 1)
      assert.match(f.id, /^[a-z]{3,16}$/)
      assert.ok(PERSONAGENS[f.oponente] && CARTAS[f.oponente], f.oponente)
      assert.ok(NIVEIS_BOT[f.nivel], f.nivel)
      assert.ok(f.fatorHpCpu > 0 && f.fatorHpCpu <= 1)
      assert.ok(Number.isInteger(f.metaRodadas) && f.metaRodadas >= 3)
      const chaves = Object.keys(f.regra ?? {})
      assert.ok(chaves.length >= 1, `fase ${f.n} sem regra especial`)
      assert.ok(chaves.every((k) => REGRAS.includes(k)), chaves.join())
      assert.ok(descreverRegra(f.regra))
      assert.equal(Boolean(f.chefe), i === m.fases.length - 1)
    })
    assert.equal(new Set(m.fases.map((f) => f.id)).size, m.fases.length)
    // o banco sabe quantas fases cada mundo tem
    assert.match(sql, new RegExp(`when ${m.id} then ${m.fases.length}`))
  }
  assert.equal(MUNDOS[0].nome, 'A Floresta de Papel')
  assert.equal(MUNDOS[0].personagem, 'kris')
  assert.equal(MUNDOS[0].fases.length, 6)
})

test('textos: antes, depois e derrota de cada fase, com quem fala existindo e escolhas coerentes', () => {
  for (const m of MUNDOS) {
    const escolhas = new Map()
    for (const f of m.fases) {
      const t = textosDaFase(m.id, f.n)
      assert.ok(t, `textos da fase ${f.id}`)
      for (const cena of ['antes', 'depois', 'derrota']) {
        assert.ok(falasValidas(t[cena]) && t[cena].length >= 1, `${f.id}.${cena}`)
        for (const fala of t[cena]) {
          if (fala.escolha) escolhas.set(fala.escolha.chave, fala.escolha.opcoes.map((o) => o.valor))
          else assert.ok(fala.quem === 'narrador' || PERSONAGENS[fala.quem], fala.quem)
          if (fala.texto) assert.ok(fala.texto.length <= 160, `fala longa demais: ${fala.texto}`)
        }
      }
    }
    // toda condição (se) aponta para uma escolha que existe, com um valor que existe
    for (const f of m.fases) for (const cena of Object.values(textosDaFase(m.id, f.n))) for (const fala of cena) for (const [k, v] of Object.entries(fala.se ?? {})) assert.ok(escolhas.get(k)?.includes(v), `${k}=${v}`)
    for (const [k, vs] of escolhas) for (const v of [k, ...vs]) assert.match(v, /^[a-z_]{1,24}$/)
    assert.ok(TEXTOS[m.id].titulo && TEXTOS[m.id].virada)
  }
})

test('o mundo 1 tem uma escolha que muda fala do chefe (sabor que atravessa o mundo)', () => {
  const chefe = textosDaFase(1, 6).antes
  assert.ok(chefe.some((f) => f.se?.lapis === 'vermelho') && chefe.some((f) => f.se?.lapis === 'verde'))
})

test('desbloqueio: a 1 sempre; as outras depois da anterior vencida', () => {
  assert.equal(faseLiberada([], 1, 1), true)
  assert.equal(faseLiberada([], 1, 2), false)
  assert.equal(faseLiberada([{ mundo: 1, fase: 1, estrelas: 1, concluida: true }], 1, 2), true)
  assert.equal(faseLiberada([{ mundo: 1, fase: 1, estrelas: 0, concluida: false }], 1, 2), false)
  assert.equal(faseLiberada([], 1, 99), false)
  assert.equal(faseDe(9, 1), null)
})

test('cosméticos da campanha: ids do catálogo, semeados no banco com o mesmo "quando"', () => {
  assert.ok(ITENS_CAMPANHA.length >= 3)
  for (const i of ITENS_CAMPANHA) {
    assert.match(i.id, /^(titulo|moldura|verso)\.[a-z0-9_]{2,24}$/)
    assert.equal(i.id.split('.')[0], i.tipo)
    assert.ok(['mundo', 'estrelas'].includes(i.quando))
    assert.match(sql, new RegExp(`\\('${i.id.replace('.', '\\.')}', '${i.tipo}', '${i.nome}', public\\.nivel_exclusivo\\(\\), false, false, '${i.campanha}', '${i.quando}'\\)`))
    if (i.tipo !== 'titulo') assert.match(i.cor, /^#[0-9a-f]{6}$/i)
  }
})
