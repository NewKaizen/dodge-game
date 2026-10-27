// node --test src/game/__tests__/jogadores.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contarFontes, fonteNova, decidirJogadores, reagirAoBotaoP2, dicaP2, criarDetector, CENAS_LIVRES, DICA_ENTRAR_P2, AVISO_P2_ENTRANDO } from '../jogadores.js'

const MENU = ['Menu']
const ESCOLHA = ['PvpEscolha']
const PARTIDA = ['PvpArena']

test('fontes: o teclado inteiro conta como uma só; cada controle e o serial contam à parte', () => {
  assert.equal(contarFontes({}), 0)
  assert.equal(contarFontes({ teclado: true }), 1)
  assert.equal(contarFontes({ teclado: true, pads: 1 }), 2)
  assert.equal(contarFontes({ pads: 2 }), 2)
  assert.equal(contarFontes({ serial: true, teclado: true }), 2)
  assert.equal(contarFontes({ serial: true, pads: 1 }), 2)
  assert.equal(contarFontes({ teclado: true, pads: 1, serial: true }), 3)
  assert.equal(contarFontes({ pads: -1 }), 0)
})

test('fonte nova: diz qual dispositivo entrou', () => {
  assert.equal(fonteNova({ teclado: true, pads: 0 }, { teclado: true, pads: 1 }), 'controle')
  assert.equal(fonteNova({ pads: 1 }, { pads: 2 }), 'controle')
  assert.equal(fonteNova({ pads: 1 }, { pads: 1, serial: true }), 'joystick serial')
  assert.equal(fonteNova({ pads: 1 }, { pads: 1, teclado: true }), 'teclado')
  assert.equal(fonteNova({ teclado: true }, { teclado: true }), null)
})

test('decisão: duas fontes distintas = 2 jogadores, em qualquer cena livre', () => {
  for (const cenas of [MENU, ESCOLHA, ['EscolhaParty'], ['Grimorio']]) {
    assert.deepEqual(decidirJogadores({ numero: 1, fontes: 2, cenas }), { numero: 2, p2Teclado: false, motivo: 'fontes' })
  }
  assert.equal(decidirJogadores({ numero: 1, fontes: 1, cenas: MENU }).numero, 1)
  assert.equal(decidirJogadores({ numero: 1, fontes: 0, cenas: MENU }).numero, 1)
})

test('decisão: nunca muda no meio da partida (nem em cena fora da lista, nem sem cena)', () => {
  assert.equal(decidirJogadores({ numero: 1, fontes: 2, cenas: PARTIDA }).numero, 1)
  assert.equal(decidirJogadores({ numero: 2, fontes: 0, cenas: PARTIDA }).numero, 2)
  assert.equal(decidirJogadores({ numero: 2, fontes: 0, cenas: ['Menu', 'Pausa'] }).numero, 2, 'uma cena fora da lista junto basta')
  assert.equal(decidirJogadores({ numero: 1, fontes: 2, cenas: [] }).numero, 1)
  for (const k of ['PvpArena', 'CoopArena', 'PvpVoto', 'Selecao', 'Dificuldade', 'PvpResultado', 'Lan']) assert.ok(!CENAS_LIVRES.includes(k), k)
})

test('decisão: fonte que some não derruba no meio do fluxo; só o menu principal volta a 1', () => {
  assert.equal(decidirJogadores({ numero: 2, fontes: 1, cenas: ESCOLHA }).numero, 2)
  assert.equal(decidirJogadores({ numero: 2, fontes: 1, cenas: ['EscolhaParty'] }).numero, 2)
  assert.deepEqual(decidirJogadores({ numero: 2, fontes: 1, cenas: MENU }), { numero: 1, p2Teclado: false, motivo: 'menu' })
  assert.equal(decidirJogadores({ numero: 2, fontes: 2, cenas: MENU }).numero, 2, 'com duas fontes ainda, fica em 2')
})

test('decisão: sala LAN/online não é mexida; p2Teclado solto some junto com o 2', () => {
  assert.equal(decidirJogadores({ numero: 2, fontes: 0, cenas: MENU, emSala: true }).numero, 2)
  assert.equal(decidirJogadores({ numero: 1, fontes: 2, cenas: MENU, emSala: true }).numero, 1)
  assert.equal(decidirJogadores({ numero: 1, p2Teclado: true, fontes: 1, cenas: ESCOLHA }).p2Teclado, false)
  assert.equal(decidirJogadores({ numero: 2, p2Teclado: true, fontes: 1, cenas: MENU }).p2Teclado, false, 'o menu zera quem entrou pelo teclado')
})

// ---------- JOGADOR 2 pelo teclado: entrar, sair, confirmar ----------

test('teclado: A do jogador 2 entra em 1 jogador, desde que ninguém tenha confirmado', () => {
  const base = { numero: 1, fontes: 1, botao: 'A', origem: 1 }
  assert.equal(reagirAoBotaoP2(base), 'entrar')
  assert.equal(reagirAoBotaoP2({ ...base, origem: 0 }), null, 'o A do jogador 1 só confirma')
  assert.equal(reagirAoBotaoP2({ ...base, botao: 'B' }), null, 'B do jogador 2 sem ter entrado: volta como sempre')
  assert.equal(reagirAoBotaoP2({ ...base, algoConfirmado: true }), null, 'depois de confirmar não entra')
  assert.equal(reagirAoBotaoP2({ ...base, emRede: true }), null)
  assert.equal(reagirAoBotaoP2({ ...base, numero: 2 }), null, 'já são 2')
})

test('teclado: B do jogador 2 sai (só quem entrou pelo teclado, antes de confirmar)', () => {
  const dois = { numero: 2, p2Teclado: true, fontes: 1, botao: 'B', origem: 1 }
  assert.equal(reagirAoBotaoP2(dois), 'sair')
  assert.equal(reagirAoBotaoP2({ ...dois, algoConfirmado: true }), null, 'confirmou: B desfaz a escolha, não sai')
  assert.equal(reagirAoBotaoP2({ ...dois, origem: 0 }), null, 'o B do jogador 1 volta ao menu')
  assert.equal(reagirAoBotaoP2({ ...dois, fontes: 2 }), null, 'com 2 dispositivos de verdade o jogador 2 fica')
  assert.equal(reagirAoBotaoP2({ ...dois, p2Teclado: false }), null, 'entrou por dispositivo: B não tira')
  assert.equal(reagirAoBotaoP2({ ...dois, botao: 'A' }), null)
})

test('teclado: ciclo completo entrar -> confirmar -> desfazer -> sair', () => {
  let e = { numero: 1, p2Teclado: false, algoConfirmado: false }
  const dispara = (botao, origem) => {
    const acao = reagirAoBotaoP2({ ...e, fontes: 1, botao, origem })
    if (acao === 'entrar') e = { ...e, numero: 2, p2Teclado: true }
    if (acao === 'sair') e = { ...e, numero: 1, p2Teclado: false }
    return acao
  }
  assert.equal(dispara('A', 1), 'entrar')
  assert.equal(e.numero, 2)
  e.algoConfirmado = true // alguém confirmou
  assert.equal(dispara('B', 1), null)
  e.algoConfirmado = false // desfez
  assert.equal(dispara('B', 1), 'sair')
  assert.deepEqual([e.numero, e.p2Teclado], [1, false])
  assert.equal(dispara('A', 1), 'entrar', 'pode entrar de novo')
})

test('dica do rodapé: convida em 1 jogador, avisa como sair, some depois de confirmar', () => {
  assert.equal(dicaP2({ numero: 1 }), DICA_ENTRAR_P2)
  assert.match(DICA_ENTRAR_P2, /ENTER.*2º controle/)
  assert.match(dicaP2({ numero: 2, p2Teclado: true, fontes: 1 }), /B \(Backspace\) para sair/)
  assert.match(DICA_ENTRAR_P2, /ESPAÇO: confirmar/) // sozinho no teclado, quem confirma é o Espaço
  assert.match(AVISO_P2_ENTRANDO.titulo, /JOGADOR 2 ENTRANDO/)
  assert.match(AVISO_P2_ENTRANDO.texto, /B .*cancelar/)
  assert.equal(dicaP2({ numero: 2, p2Teclado: false, fontes: 2 }), null)
  assert.equal(dicaP2({ numero: 1, algoConfirmado: true }), null)
  assert.equal(dicaP2({ numero: 1, emRede: true }), null)
})

// ---------- o detector (fontes + cena -> store + aviso) ----------

function montar() {
  const log = { aplicados: [], avisos: [] }
  const d = criarDetector({ aplicar: (x) => log.aplicados.push(x), avisar: (t) => log.avisos.push(t) })
  const est = { numero: 1, p2Teclado: false }
  const ev = (extra) => {
    const r = d.avaliar({ ...est, cenas: MENU, ...extra })
    if (log.aplicados.length) Object.assign(est, log.aplicados.at(-1))
    return r
  }
  return { log, ev, est }
}

test('detector: 2º controle liga o jogador 2 uma vez, com aviso do dispositivo', () => {
  const { log, ev, est } = montar()
  ev({ pads: 1 })
  assert.deepEqual(log.avisos, [])
  ev({ pads: 2 })
  assert.deepEqual(log.aplicados, [{ numero: 2, p2Teclado: false }])
  assert.deepEqual(log.avisos, ['JOGADOR 2 ENTROU (controle)'])
  ev({ pads: 2 })
  assert.equal(log.avisos.length, 1, 'não repete a cada avaliação')
  assert.equal(est.numero, 2)
})

test('detector: controle + teclado, serial + teclado, serial + controle', () => {
  let m = montar()
  m.ev({ pads: 1 })
  m.ev({ pads: 1, teclado: true })
  assert.deepEqual(m.log.avisos, ['JOGADOR 2 ENTROU (teclado)'])
  m = montar()
  m.ev({ teclado: true })
  m.ev({ teclado: true, serial: true })
  assert.deepEqual(m.log.avisos, ['JOGADOR 2 ENTROU (joystick serial)'])
  m = montar()
  m.ev({ serial: true })
  m.ev({ serial: true, pads: 1 })
  assert.deepEqual(m.log.avisos, ['JOGADOR 2 ENTROU (controle)'])
})

test('detector: na partida espera; ao voltar a uma cena livre entra, e o aviso fala do aparelho certo', () => {
  const { log, ev } = montar()
  ev({ pads: 1, cenas: PARTIDA })
  ev({ pads: 2, cenas: PARTIDA })
  ev({ pads: 2, cenas: PARTIDA })
  assert.deepEqual(log.aplicados, [])
  assert.deepEqual(log.avisos, [])
  ev({ pads: 2, teclado: true, cenas: ['PvpResultado'] })
  assert.deepEqual(log.aplicados, [])
  ev({ pads: 2, teclado: true, cenas: MENU })
  assert.deepEqual(log.aplicados, [{ numero: 2, p2Teclado: false }])
  assert.deepEqual(log.avisos, ['JOGADOR 2 ENTROU (controle)'])
})

test('detector: o controle sai e nada muda até o menu principal', () => {
  const { log, ev, est } = montar()
  ev({ pads: 2 })
  ev({ pads: 1, cenas: ESCOLHA })
  ev({ pads: 1, cenas: PARTIDA })
  assert.equal(est.numero, 2)
  ev({ pads: 1, cenas: MENU })
  assert.equal(est.numero, 1)
  assert.equal(log.avisos.length, 1, 'voltar a 1 não gera aviso de entrada')
  ev({ pads: 2, cenas: MENU })
  assert.equal(est.numero, 2)
  assert.equal(log.avisos.length, 2, 'e entra de novo se o controle volta')
})

test('detector: quem entrou pelo teclado volta a 1 no menu; em sala o detector não mexe', () => {
  const { log, ev, est } = montar()
  est.numero = 2
  est.p2Teclado = true
  ev({ teclado: true, cenas: ESCOLHA })
  assert.equal(est.numero, 2)
  ev({ teclado: true, cenas: MENU })
  assert.deepEqual([est.numero, est.p2Teclado], [1, false])

  const sala = montar()
  sala.est.numero = 2
  sala.ev({ teclado: true, cenas: MENU, emSala: true })
  sala.ev({ pads: 2, cenas: MENU, emSala: true })
  assert.deepEqual(sala.log.aplicados, [])
})
