// node --test src/game/manual/__tests__/cera.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarRng } from '../../pvp/baralho.js'
import { linhaGiz, circuloGiz } from '../giz.js'
import { PALETA, corCss, variarCor, pressaoDaCera, passadasDaCera, pintarTracos, pintarDesenho, graoDaCera, aplicarGrao, caixaDasCamadas } from '../cera.js'
import { razaoContraste } from '../../contraste.js'
import { PAPEL_BASE } from '../papel.js'

// contexto 2D falso: grava tudo o que a cera chama
function ctxFalso() {
  const chamadas = []
  const props = {}
  const ctx = new Proxy(props, {
    get: (alvo, nome) => (nome in alvo ? alvo[nome] : (...a) => chamadas.push([nome, ...a])),
    set: (alvo, nome, valor) => {
      alvo[nome] = valor
      chamadas.push(['=' + String(nome), valor])
      return true
    },
  })
  return { ctx, chamadas }
}

const METODOS = new Set(['beginPath', 'moveTo', 'lineTo', 'stroke', 'fill', 'closePath', 'save', 'restore', 'fillRect'])

test('pressão da cera fica em 0.2..1 e entra/sai mais leve que o meio', () => {
  for (let i = 0; i <= 100; i++) {
    const p = pressaoDaCera(i / 100, 0.3)
    assert.ok(p >= 0.2 && p <= 1)
  }
  assert.ok(pressaoDaCera(0, 0) < pressaoDaCera(0.5, 0))
})

test('passadas: determinísticas pela semente, 3 por traço, pedaços com largura e alpha válidos', () => {
  const t = linhaGiz(criarRng('cera:a'), 0, 0, 120, 10)[0]
  const a = passadasDaCera(t, { largura: 4, semente: 'x' })
  const b = passadasDaCera(t, { largura: 4, semente: 'x' })
  const c = passadasDaCera(t, { largura: 4, semente: 'y' })
  assert.deepEqual(a, b)
  assert.notDeepEqual(a, c)
  assert.equal(a.length, 3)
  for (const { pedacos } of a)
    for (const p of pedacos) {
      assert.ok(p.largura > 0 && p.largura <= 4 * 1.06)
      assert.ok(p.alpha > 0 && p.alpha <= 1)
      assert.ok(p.pontos.length >= 2)
    }
  // as passadas ficam perto da linha original (deslocamento < largura)
  const ys = a.flatMap(({ pedacos }) => pedacos.flatMap((p) => p.pontos.map((q) => q.y)))
  const base = t.map((q) => q.y)
  assert.ok(Math.max(...ys) <= Math.max(...base) + 4 && Math.min(...ys) >= Math.min(...base) - 4)
  assert.deepEqual(passadasDaCera([{ x: 0, y: 0 }]), [])
})

test('pintarTracos só usa a API de canvas e respeita o progresso', () => {
  const t = circuloGiz(criarRng('cera:b'), 0, 0, 20)
  const vazio = ctxFalso()
  pintarTracos(vazio.ctx, t, { progresso: 0 })
  assert.equal(vazio.chamadas.filter((c) => c[0] === 'stroke').length, 0)
  const meio = ctxFalso()
  pintarTracos(meio.ctx, t, { progresso: 0.5 })
  const cheio = ctxFalso()
  pintarTracos(cheio.ctx, t, { progresso: 1 })
  const strokes = (x) => x.chamadas.filter((c) => c[0] === 'stroke').length
  assert.ok(strokes(meio) > 0 && strokes(meio) < strokes(cheio))
  for (const [nome] of cheio.chamadas) assert.ok(nome.startsWith('=') || METODOS.has(nome), nome)
  // mesma entrada, mesmas chamadas (determinístico)
  const denovo = ctxFalso()
  pintarTracos(denovo.ctx, t, { progresso: 1 })
  assert.deepEqual(denovo.chamadas, cheio.chamadas)
})

test('pintarDesenho pinta as 3 camadas (traço, preencher, mancha)', () => {
  const poli = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }, { x: 0, y: 20 }]
  const { ctx, chamadas } = ctxFalso()
  pintarDesenho(ctx, [
    { tipo: 'preencher', poligono: poli, cor: PALETA.verde },
    { tipo: 'mancha', poligono: poli, cor: PALETA.rosa, alpha: 0.5 },
    { tipo: 'traco', tracos: [poli], cor: PALETA.tinta, largura: 2 },
  ])
  assert.ok(chamadas.filter((c) => c[0] === 'fill').length >= 2)
  assert.ok(chamadas.filter((c) => c[0] === 'stroke').length > 4)
})

test('grão: determinístico, só alpha, e apaga uma parte pequena (falhinhas, não buracos)', () => {
  const a = graoDaCera(64, 's')
  assert.deepEqual(a, graoDaCera(64, 's'))
  assert.notDeepEqual(a, graoDaCera(64, 't'))
  let soma = 0
  let algum = 0
  for (let i = 0; i < a.length; i += 4) {
    assert.equal(a[i] + a[i + 1] + a[i + 2], 0)
    soma += a[i + 3] / 255
    if (a[i + 3] > 0) algum++
  }
  const media = soma / (64 * 64)
  assert.ok(media > 0.03 && media < 0.25, `apaga em média ${media}`)
  assert.ok(algum / (64 * 64) > 0.1, 'há falhas espalhadas')
})

test('aplicarGrao usa destination-out e não faz nada com força 0', () => {
  const nada = ctxFalso()
  aplicarGrao(nada.ctx, {}, 10, 10, 0)
  assert.equal(nada.chamadas.length, 0)
  const { ctx, chamadas } = ctxFalso()
  aplicarGrao(ctx, { padrao: true }, 10, 10, 0.5)
  assert.ok(chamadas.some((c) => c[0] === '=globalCompositeOperation' && c[1] === 'destination-out'))
  assert.ok(chamadas.some((c) => c[0] === 'fillRect'))
})

test('caixaDasCamadas soma a largura do traço', () => {
  const c = caixaDasCamadas([{ tipo: 'traco', tracos: [[{ x: 0, y: 0 }, { x: 10, y: 0 }]], largura: 4 }])
  assert.ok(c.minX < 0 && c.maxX > 10 && c.minY < 0 && c.maxY > 0)
})

test('cores: corCss e variarCor', () => {
  assert.equal(corCss(0xff8000, 0.5), 'rgba(255,128,0,0.5)')
  assert.equal(variarCor(0x808080, 0), 0x808080)
  assert.notEqual(variarCor(0x808080, 1), 0x808080)
})

// O que tem de se ler no papel: o texto (WCAG AA) e as coisas do jogo (3:1, contraste de objeto gráfico)
test('contraste: texto e bolinhas legíveis no papel e no cartão', () => {
  const papel = (PAPEL_BASE[0] << 16) | (PAPEL_BASE[1] << 8) | PAPEL_BASE[2]
  const papelEscuro = 0xe8d9b8 // perto da vinheta
  const cartao = 0xfffbf1
  const balao = 0xfffdf7
  assert.ok(razaoContraste(0x2b2540, balao) >= 4.5) // TINTA no balão
  assert.ok(razaoContraste(0x4e3f63, papelEscuro) >= 4.5) // TINTA_SUAVE (dicas) no papel
  assert.ok(razaoContraste(0x4e3f63, papel) >= 4.5)
  assert.ok(razaoContraste(PALETA.bala, cartao) >= 3) // bolinha na caixa
  assert.ok(razaoContraste(PALETA.coracao, cartao) >= 3) // coração na caixa
  assert.ok(razaoContraste(0xd01a33, cartao) >= 4.5) // "você!"
})
