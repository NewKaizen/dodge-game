// node --test src/game/__tests__/cenasReaproveitadas.test.js
//
// O Phaser reaproveita a instância de cada cena. Qualquer `this.X` que sobra da abertura
// anterior (objetos já destruídos, flags, contadores) pode quebrar o create() da seguinte:
// foi assim que a PvpResultado travou na 2ª partida rápida. Este teste varre TODAS as
// cenas de config.js e exige que cada campo atribuído seja refeito pela abertura.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { varrerCena, ouvintesSemRemocao } from './auditoriaCenas.js'

const ler = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

// cenas da lista `scene: [...]` de config.js -> arquivo (Carregando/Religando ficam fora de scenes/)
const config = ler('config.js')
const arquivos = [...config.matchAll(/^import (\w+) from '\.\/((?:scenes\/)?\w+)\.js'/gm)]
  .filter((m) => new RegExp(`scene: \\[[^\\]]*\\b${m[1]}\\b`).test(config))
  .map((m) => ({ nome: m[1], arquivo: `${m[2]}.js` }))

// Estado vindo de OUTRO arquivo (lógica pura da PvpResultado, ver pvp/telaResultado.js)
const ESTADO_EXTERNO = { PvpResultado: 'pvp/telaResultado.js' }

// Campos que o create() recria na hora (a PvpResultado os define logo depois do reset)
const REFEITOS_NO_CREATE = {
  PvpResultado: ['p1', 'p2', 'arena', 'vencedor', 'empate', 'rodadas', 'contraCpu', 'stats', 'corTitulo', 'corNumero', 'etapas', 'controles', 'rede', 'naSala', 'casual', 'xp', 'fundo', 'veu', 'raios', 'halo'],
}

// Campos que PRECISAM sobreviver entre aberturas (documentado, um por um)
const PERSISTENTES = {
  // contador que só cresce: invalida timers/promessas de uma partida anterior (`vez !== this.vezPartida`)
  PvpArena: ['vezPartida'],
  CoopArena: ['vezPartida'],
  CoopArenaN: ['vezPartida'],
  // idem para a prévia do Grimório (geracaoPrevia = (geracaoPrevia ?? 0) + 1, no create)
  // CenaConta.iniciarBase() (conta/Base.js) refaz sujo/saindo/digitando/cursor... a cada abertura
  Amigos: ['sujo'],
  Colecao: ['sujo'],
  Perfil: ['sujo'],
}

// Vitoria e GameOver são da sub-fase 2F (XP no CO-OP): ainda sem estadoInicial. Pendência
// registrada em docs/plano-agentes.md; o teste só avisa, para a 2F fechar e remover daqui.
const PENDENTE_2F = new Set()

test('config.js: a varredura achou as cenas', () => {
  assert.ok(arquivos.length >= 20, `achou só ${arquivos.length}`)
  for (const n of ['PvpResultado', 'PvpArena', 'CoopArena', 'Lan', 'Menu', 'Grimorio', 'Amigos']) assert.ok(arquivos.some((a) => a.nome === n), n)
})

for (const { nome, arquivo } of arquivos) {
  test(`cena ${nome}: todo campo é refeito a cada abertura`, (t) => {
    const fonte = ler(arquivo)
    const { campos, reset } = varrerCena(fonte)
    if (ESTADO_EXTERNO[nome]) for (const c of varrerCena(ler(ESTADO_EXTERNO[nome])).reset) reset.add(c)
    const ok = new Set([...reset, ...(PERSISTENTES[nome] ?? []), ...(REFEITOS_NO_CREATE[nome] ?? [])])
    const faltando = [...campos].filter(([c, o]) => !o.topo && !ok.has(c)).map(([c]) => c)
    if (PENDENTE_2F.has(nome)) return t.diagnostic(`pendente 2F: ${faltando.join(', ') || 'nada'}`)
    assert.deepEqual(faltando, [], `${nome}: campos que sobram da abertura anterior (ponha no estadoInicial)`)
  })

  test(`cena ${nome}: ouvintes de eventos são removidos no shutdown`, () => {
    assert.deepEqual(ouvintesSemRemocao(ler(arquivo)), [])
  })
}

test('cenas com estadoInicial aplicam o reset no começo do init/create', () => {
  for (const { nome, arquivo } of arquivos) {
    const fonte = ler(arquivo)
    if (!/const estadoInicial\w*\s*=/.test(fonte)) continue
    const { aplicaNoComeco } = varrerCena(fonte)
    assert.ok(aplicaNoComeco, `${nome}: falta Object.assign(this, estadoInicial()) no começo`)
  }
})

test('a varredura pega um campo que sobra (guarda do próprio teste)', () => {
  const ruim = `class X {\n  create() {\n    this.a = 1\n  }\n  montar() {\n    this.texto = this.add.text()\n  }\n}`
  const { campos, reset } = varrerCena(ruim)
  assert.equal(campos.get('a').topo, true)
  assert.equal(campos.get('texto').topo, false)
  assert.equal(reset.has('texto'), false)
  assert.deepEqual(ouvintesSemRemocao(`this.events.on('resume', f)`), ['resume'])
  assert.deepEqual(ouvintesSemRemocao(`this.events.on('resume', f); this.events.off('resume', f)`), [])
})
