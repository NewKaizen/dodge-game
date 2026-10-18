// node --test src/game/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ACOES,
  JOGADORES,
  TECLAS_PADRAO,
  RESERVADAS,
  atribuirTecla,
  donoDaTecla,
  ehPadrao,
  nomeTecla,
  normalizarTeclas,
  problemasDasTeclas,
  resumoTeclas,
} from '../teclas.js'

test('o mapa padrão é válido e tem todas as ações dos dois jogadores', () => {
  assert.deepEqual(problemasDasTeclas(TECLAS_PADRAO), [])
  for (const j of JOGADORES) assert.deepEqual(Object.keys(TECLAS_PADRAO[j]).sort(), [...ACOES].sort())
  assert.ok(ehPadrao(TECLAS_PADRAO))
})

test('normalizar: null, lixo, ação vazia ou tecla repetida voltam ao padrão', () => {
  assert.deepEqual(normalizarTeclas(null), TECLAS_PADRAO)
  assert.deepEqual(normalizarTeclas('oi'), TECLAS_PADRAO)
  assert.deepEqual(normalizarTeclas({ p1: TECLAS_PADRAO.p1 }), TECLAS_PADRAO)
  const vazio = normalizarTeclas(TECLAS_PADRAO)
  vazio.p1.A = []
  assert.deepEqual(normalizarTeclas(vazio), TECLAS_PADRAO)
  const repetida = normalizarTeclas(TECLAS_PADRAO)
  repetida.p2.A = ['KeyW']
  assert.match(problemasDasTeclas(repetida)[0], /repetida/)
  assert.deepEqual(normalizarTeclas(repetida), TECLAS_PADRAO)
  const reservada = normalizarTeclas(TECLAS_PADRAO)
  reservada.p1.cima = ['KeyF']
  assert.deepEqual(normalizarTeclas(reservada), TECLAS_PADRAO)
  const estranha = normalizarTeclas(TECLAS_PADRAO)
  estranha.p1.cima = ['<script>']
  assert.deepEqual(normalizarTeclas(estranha), TECLAS_PADRAO)
})

test('normalizar devolve cópia (mexer nela não estraga o padrão)', () => {
  const m = normalizarTeclas(null)
  m.p1.cima.push('KeyI')
  assert.deepEqual(TECLAS_PADRAO.p1.cima, ['KeyW'])
  const salvo = atribuirTecla(TECLAS_PADRAO, 'p1', 'A', 'KeyK').mapa
  assert.deepEqual(normalizarTeclas(salvo), salvo) // um mapa remapeado válido é mantido
})

test('atribuir uma tecla livre troca a lista inteira da ação', () => {
  const { mapa, tirada } = atribuirTecla(TECLAS_PADRAO, 'p1', 'A', 'KeyK')
  assert.deepEqual(mapa.p1.A, ['KeyK'])
  assert.equal(tirada, null)
  assert.deepEqual(problemasDasTeclas(mapa), [])
  assert.equal(donoDaTecla(mapa, 'Space'), null) // a antiga ficou livre
  assert.ok(!ehPadrao(mapa))
})

test('conflito: a tecla sai da outra ação; se ela ficar sem nenhuma, troca', () => {
  // Q era uma de três do B do P1: só sai de lá
  const r1 = atribuirTecla(TECLAS_PADRAO, 'p1', 'A', 'KeyQ')
  assert.deepEqual(r1.mapa.p1.A, ['KeyQ'])
  assert.deepEqual(r1.mapa.p1.B, ['KeyX', 'ShiftLeft'])
  assert.deepEqual(r1.tirada, { jogador: 'p1', acao: 'B', trocou: false })
  // ↑ era a única do cima do P2: o P2 fica com o W (troca)
  const r2 = atribuirTecla(TECLAS_PADRAO, 'p1', 'cima', 'ArrowUp')
  assert.deepEqual(r2.mapa.p1.cima, ['ArrowUp'])
  assert.deepEqual(r2.mapa.p2.cima, ['KeyW'])
  assert.deepEqual(r2.tirada, { jogador: 'p2', acao: 'cima', trocou: true })
  for (const r of [r1, r2]) assert.deepEqual(problemasDasTeclas(r.mapa), [])
})

test('conflito com várias teclas antigas: a outra ação herda todas', () => {
  const { mapa, tirada } = atribuirTecla(TECLAS_PADRAO, 'p1', 'A', 'KeyP') // P era a pausa do P2, sozinha
  assert.deepEqual(mapa.p1.A, ['KeyP'])
  assert.deepEqual(mapa.p2.C, ['Space', 'KeyZ', 'KeyE'])
  assert.equal(tirada.trocou, true)
  assert.deepEqual(problemasDasTeclas(mapa), [])
})

test('uma tecla da própria ação (com outras) vira a única; repetir a mesma não muda nada', () => {
  const r = atribuirTecla(TECLAS_PADRAO, 'p1', 'A', 'KeyZ')
  assert.deepEqual(r.mapa.p1.A, ['KeyZ'])
  assert.equal(r.tirada, null)
  assert.equal(atribuirTecla(TECLAS_PADRAO, 'p1', 'cima', 'KeyW').igual, true)
})

test('teclas reservadas e códigos inválidos são recusados', () => {
  for (const code of Object.keys(RESERVADAS)) assert.ok(atribuirTecla(TECLAS_PADRAO, 'p1', 'cima', code).erro, code)
  assert.ok(atribuirTecla(TECLAS_PADRAO, 'p1', 'cima', '').erro)
  assert.ok(atribuirTecla(TECLAS_PADRAO, 'p1', 'cima', 'Key W').erro)
  assert.ok(atribuirTecla(TECLAS_PADRAO, 'p3', 'cima', 'KeyK').erro)
  assert.ok(atribuirTecla(TECLAS_PADRAO, 'p1', 'pular', 'KeyK').erro)
})

test('qualquer sequência de remapeamentos continua válida', () => {
  let mapa = normalizarTeclas(null)
  const codes = ['KeyW', 'KeyK', 'Space', 'ArrowUp', 'Enter', 'KeyP', 'ShiftRight', 'Digit1', 'KeyQ', 'Escape', 'KeyF']
  let s = 7
  const sorteio = (n) => ((s = (s * 1103515245 + 12345) % 2147483648), s % n)
  for (let i = 0; i < 500; i++) {
    const r = atribuirTecla(mapa, JOGADORES[sorteio(2)], ACOES[sorteio(ACOES.length)], codes[sorteio(codes.length)])
    if (r.erro) continue
    mapa = r.mapa
    assert.deepEqual(problemasDasTeclas(mapa), [], `passo ${i}`)
  }
})

test('nomes legíveis', () => {
  assert.equal(nomeTecla('KeyW'), 'W')
  assert.equal(nomeTecla('Digit7'), '7')
  assert.equal(nomeTecla('Space'), 'Espaço')
  assert.equal(nomeTecla('ShiftRight'), 'Shift dir.')
  assert.equal(nomeTecla('ShiftLeft'), 'Shift esq.')
  assert.equal(nomeTecla('ArrowUp'), '↑')
  assert.equal(nomeTecla('Escape'), 'Esc')
  assert.equal(nomeTecla('Numpad4'), 'Num 4')
  assert.equal(nomeTecla('F2'), 'F2')
  assert.equal(nomeTecla('Semicolon'), ';')
  assert.equal(nomeTecla('CoisaNova'), 'CoisaNova') // desconhecida: o código mesmo
  // com o layout do teclado (ABNT2: a tecla do ; é o Ç)
  const abnt = new Map([
    ['Semicolon', 'ç'],
    ['Space', ' '],
  ])
  assert.equal(nomeTecla('Semicolon', abnt), 'Ç')
  assert.equal(nomeTecla('Space', abnt), 'Espaço')
  assert.equal(nomeTecla('KeyQ', new Map([['KeyQ', 'a']])), 'A') // AZERTY
  assert.equal(resumoTeclas(TECLAS_PADRAO.p1.A), 'Espaço / Z / E')
})
