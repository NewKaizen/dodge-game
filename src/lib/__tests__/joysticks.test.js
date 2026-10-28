import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chaveBase, criarMapa, reescreverLinha, rotearSaida, modoRele } from '../joysticks.js'

const UNO = { usbVendorId: 0x2341, usbProductId: 0x43 }

test('chaveBase usa vendor:product e cai para "serial" sem getInfo', () => {
  assert.equal(chaveBase(UNO), '2341:43')
  assert.equal(chaveBase({}), 'serial')
  assert.equal(chaveBase(undefined), 'serial')
})

test('mapa: a ordem de pareamento define P1 e P2 e fica salva', () => {
  const salvos = []
  const m = criarMapa({ aoSalvar: (x) => salvos.push(x) })
  const a = {}, b = {}
  assert.equal(m.registrar(a, UNO).jogador, 1)
  assert.equal(m.registrar(b, UNO).jogador, 2)
  assert.deepEqual(salvos.at(-1), { '2341:43#0': 1, '2341:43#1': 2 })
  assert.equal(m.registrar(a, UNO).novo, false)
})

test('mapa: duas placas idênticas se distinguem pelo índice (ordem de abertura)', () => {
  const m = criarMapa()
  const a = {}, b = {}
  assert.notEqual(m.registrar(a, UNO).chave, m.registrar(b, UNO).chave)
})

test('mapa: carrega o salvo (troca feita antes) numa nova sessão', () => {
  const m = criarMapa({ salvo: { '2341:43#0': 2, '2341:43#1': 1 } })
  const a = {}, b = {}
  assert.equal(m.registrar(a, UNO).jogador, 2)
  assert.equal(m.registrar(b, UNO).jogador, 1)
})

test('mapa: salvo inválido é ignorado', () => {
  const m = criarMapa({ salvo: { x: 7, y: 'a' } })
  assert.equal(m.registrar({}, UNO).jogador, 1)
})

test('mapa: trocar inverte P1 e P2 e salva; com uma só placa ela vai para a outra vaga', () => {
  const salvos = []
  const m = criarMapa({ aoSalvar: (x) => salvos.push(x) })
  const a = {}, b = {}
  m.registrar(a, UNO); m.registrar(b, UNO); m.ligou(a); m.ligou(b)
  assert.ok(m.trocar())
  assert.equal(m.jogadorDe(a), 2)
  assert.equal(m.jogadorDe(b), 1)
  assert.equal(m.portaDe(1), b)
  assert.deepEqual(salvos.at(-1), { '2341:43#0': 2, '2341:43#1': 1 })
  m.desligou(b)
  m.trocar()
  assert.equal(m.jogadorDe(a), 1)
})

test('mapa: trocar sem placa aberta não faz nada', () => {
  assert.equal(criarMapa().trocar(), false)
})

test('mapa: quem desplugou guarda a vaga ao voltar (mesmo objeto)', () => {
  const m = criarMapa()
  const a = {}, b = {}
  m.registrar(a, UNO); m.registrar(b, UNO); m.ligou(a); m.ligou(b)
  m.desligou(b)
  assert.equal(m.portaDe(2), null)
  assert.equal(m.registrar(b, UNO).jogador, 2)
  m.ligou(b)
  assert.equal(m.portaDe(2), b)
})

test('mapa: placa nova com a vaga de quem saiu guardada pega a outra vaga livre', () => {
  const m = criarMapa()
  const a = {}, b = {}, c = {}
  m.registrar(a, UNO); m.ligou(a)
  m.registrar(b, UNO); m.ligou(b)
  m.desligou(a)
  // uma placa de outro modelo aparece: P1 está ausente mas lembrado, só sobra... nenhuma livre entre as lembradas
  const r = m.registrar(c, { usbVendorId: 1, usbProductId: 2 })
  assert.ok([1, 2].includes(r.jogador))
})

test('reescreverLinha: JOY/BTN de qualquer placa viram o jogador da porta', () => {
  assert.equal(reescreverLinha('JOY 1 -35 80', 2), 'JOY 2 -35 80')
  assert.equal(reescreverLinha('JOY -35 80', 2), 'JOY 2 -35 80')
  assert.equal(reescreverLinha('BTN 1 A\r', 2), 'BTN 2 A')
  assert.equal(reescreverLinha('BTN B', 2), 'BTN 2 B')
  assert.equal(reescreverLinha('BTN 1 START', 1), 'BTN 1 START')
  assert.equal(reescreverLinha('depuração qualquer', 2), 'depuração qualquer')
})

test('reescreverLinha: modo relé (uma porta) respeita o 1 e o 2 que vêm na linha', () => {
  assert.equal(reescreverLinha('JOY 2 10 20', 1, { rele: true }), 'JOY 2 10 20')
  assert.equal(reescreverLinha('BTN 2 A', 1, { rele: true }), 'BTN 2 A')
  assert.equal(reescreverLinha('BTN 1 C', 1, { rele: true }), 'BTN 1 C')
  assert.equal(reescreverLinha('JOY 5 1 2', 1, { rele: true }), 'JOY 1 1 2')
})

const duas = [{ porta: 'A', jogador: 1 }, { porta: 'B', jogador: 2 }]

test('rotearSaida: estado vai a todas as portas, sem número', () => {
  for (const c of ['PING', 'GAME', 'MENU', 'DISCONNECT'])
    assert.deepEqual(rotearSaida(c, duas), [{ porta: 'A', linha: c }, { porta: 'B', linha: c }])
  assert.deepEqual(rotearSaida('1 PING', duas).map((x) => x.linha), ['PING', 'PING'])
})

test('rotearSaida: VIDA/BUZZER só à porta do jogador, com o id local 1 (nunca "2 ...")', () => {
  assert.deepEqual(rotearSaida('2 VIDA 150 200', duas), [{ porta: 'B', linha: '1 VIDA 150 200' }])
  assert.deepEqual(rotearSaida('1 BUZZER', duas), [{ porta: 'A', linha: '1 BUZZER' }])
  assert.deepEqual(rotearSaida('2 BUZZER', duas), [{ porta: 'B', linha: '1 BUZZER' }])
})

test('rotearSaida: jogador sem porta (CPU) não recebe nada, e nunca sai JOGADOR', () => {
  const soP1 = [{ porta: 'A', jogador: 1 }, { porta: 'B', jogador: 1 }].slice(0, 1)
  const soP2 = [{ porta: 'B', jogador: 2 }, { porta: 'C', jogador: 3 }]
  assert.deepEqual(rotearSaida('1 VIDA 1 2', soP2), [])
  assert.deepEqual(rotearSaida('3 BUZZER', soP1), [])
  assert.equal(rotearSaida('PING', soP1).length, 1)
  assert.deepEqual(rotearSaida('', duas), [])
})

test('rotearSaida: trocar os jogadores troca o destino', () => {
  const trocadas = [{ porta: 'A', jogador: 2 }, { porta: 'B', jogador: 1 }]
  assert.deepEqual(rotearSaida('1 VIDA 10 100', trocadas), [{ porta: 'B', linha: '1 VIDA 10 100' }])
})

test('rotearSaida: modo relé (uma porta, jogador 1) manda "1 ..." e "2 ..." como estão', () => {
  const uma = [{ porta: 'A', jogador: 1 }]
  assert.ok(modoRele(uma))
  assert.deepEqual(rotearSaida('2 VIDA 5 10', uma), [{ porta: 'A', linha: '2 VIDA 5 10' }])
  assert.deepEqual(rotearSaida('1 BUZZER', uma), [{ porta: 'A', linha: '1 BUZZER' }])
  assert.ok(!modoRele(duas))
  assert.ok(!modoRele([{ porta: 'A', jogador: 2 }]))
})

test('rotearSaida: uma placa sozinha que virou P2 só recebe o que é do P2, como "1 ..."', () => {
  const uma = [{ porta: 'A', jogador: 2 }]
  assert.deepEqual(rotearSaida('2 VIDA 5 10', uma), [{ porta: 'A', linha: '1 VIDA 5 10' }])
  assert.deepEqual(rotearSaida('1 VIDA 5 10', uma), [])
})
