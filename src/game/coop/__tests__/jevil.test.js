// node --test src/game/coop/__tests__/jevil.test.js
// O DADO DO CAOS do Jevil (coop/jevilDado.js, coop/jevilRegra.js), os lacaios e o Mestre de Picadeiro
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FACES,
  AJUSTES,
  DADOS_DO_JEVIL,
  DADOS_DO_TENENTE,
  conflita,
  rolarDado,
  facesDaFase,
  ajusteDoAtaque,
  derivaDosCoracoes,
  anguloDaMesa,
  instantesDaTroca,
  destinosDaTroca,
  vezDoCoracao,
  pontoDaSorte,
} from '../jevilDado.js'
import { RegraDaLuta, descricaoValida, rngDaRegra } from '../regraChefe.js'
import { CHEFES, ORDEM_CHEFES, CHEFES_DA_EXPEDICAO } from '../chefes/index.js'
import { CARTAS_CHEFES } from '../cartasChefe.js'
import { criarPartidaCoop } from '../regras.js'
import { ataques } from '../../attacks/index.js'

const SEMENTES = Array.from({ length: 40 }, (_, i) => `jv${i}`)

test('o sorteio é determinístico e a prévia (rodada + 1) é a rolagem de verdade', () => {
  for (const semente of SEMENTES) {
    for (let rodada = 1; rodada <= 12; rodada++) {
      for (let fase = 0; fase < DADOS_DO_JEVIL.length; fase++) {
        const a = rolarDado({ semente, rodada, fase })
        assert.deepEqual(a, rolarDado({ semente, rodada, fase }))
        const previa = rolarDado({ semente, rodada: rodada, fase })
        assert.deepEqual(previa, a)
      }
    }
  }
  // sementes diferentes dão rolagens diferentes (não é sempre a mesma face)
  const vistas = new Set(SEMENTES.map((semente) => rolarDado({ semente, rodada: 3, fase: 1 })[0].id))
  assert.ok(vistas.size >= 3)
})

test('as faces: até 5 palavras no título, cada fase com o dado dela', () => {
  for (const f of Object.values(FACES)) {
    assert.ok(f.titulo.split(/\s+/).length <= 5, f.id)
    assert.ok(f.texto.length > 5)
  }
  // fase 1: só faces leves; fase 2: tem as malucas; fases 3 e 4: dois dados
  assert.ok(facesDaFase(DADOS_DO_JEVIL, 0).every((id) => FACES[id].suave))
  assert.ok(facesDaFase(DADOS_DO_JEVIL, 1).some((id) => !FACES[id].suave))
  for (const semente of SEMENTES) {
    for (let r = 1; r <= 10; r++) {
      assert.equal(rolarDado({ semente, rodada: r, fase: 0 }).length, 1)
      assert.equal(rolarDado({ semente, rodada: r, fase: 1 }).length, 1)
      assert.equal(rolarDado({ semente, rodada: r, fase: 2 }).length, 2)
      assert.equal(rolarDado({ semente, rodada: r, fase: 3 }).length, 2)
    }
  }
})

test('CAOS CAOS: dois dados nunca repetem a face nem juntam um par que se atrapalha', () => {
  for (const semente of SEMENTES) {
    for (let r = 1; r <= 30; r++) {
      for (const fase of [2, 3]) {
        const [a, b] = rolarDado({ semente, rodada: r, fase })
        assert.notEqual(a.id, b.id)
        assert.ok(!conflita(a.id, b.id), `${a.id}+${b.id}`)
        // no máximo UMA face de controle (espelhados / um por vez)
        assert.ok([a.id, b.id].filter((id) => id === 'espelhados' || id === 'umPorVez').length <= 1)
      }
    }
  }
})

test('o dadinho do tenente: 3 faces gentis', () => {
  const faces = facesDaFase(DADOS_DO_TENENTE, 0)
  assert.equal(faces.length, 3)
  assert.ok(faces.every((id) => FACES[id].suave))
  assert.equal(rolarDado({ semente: 'x', rodada: 1, fase: 5, fases: DADOS_DO_TENENTE }).length, 1)
})

test('efeitos puros: o ataque, a deriva, a troca e a vez', () => {
  assert.deepEqual(ajusteDoAtaque([]), { velocidade: 1, densidade: 1, dano: 1 })
  const r = ajusteDoAtaque(['rapido'])
  assert.ok(r.velocidade > 1.4 && r.dano === 0.5)
  const leve = ajusteDoAtaque(['rapido'], 0.6)
  assert.ok(leve.velocidade < r.velocidade && leve.dano > r.dano)
  const e = ajusteDoAtaque(['espelhados'])
  assert.ok(e.velocidade < 1 && e.densidade < 1)
  // gravidade: só para cima; vento: de lado, no sentido do ângulo
  const g = derivaDosCoracoes(['gravidade'], { velocidade: 180, dt: 1000 })
  assert.ok(g.dy < 0 && g.dx === 0)
  assert.ok(Math.abs(g.dy) < 180 * 0.5) // sempre dá para vencer a deriva andando
  const max = (AJUSTES.vento.graus * Math.PI) / 180
  const v = derivaDosCoracoes(['vento'], { velocidade: 180, dt: 1000, angulo: max })
  assert.ok(v.dx > 0 && v.dy === 0)
  assert.ok(derivaDosCoracoes(['vento'], { velocidade: 180, dt: 1000, angulo: -max }).dx < 0)
  assert.equal(derivaDosCoracoes([], { velocidade: 180, dt: 1000 }).dx, 0)
  for (let t = 0; t < 20000; t += 250) assert.ok(Math.abs(anguloDaMesa(t, 0.3)) <= max + 1e-9)
  // troca: com dois, trocam; com três, giram; com um, nada
  assert.deepEqual(destinosDaTroca([{ j: 0, x: 10, y: 20 }, { j: 1, x: 90, y: 80 }]), [{ j: 0, x: 90, y: 80 }, { j: 1, x: 10, y: 20 }])
  const tres = destinosDaTroca([{ j: 2, x: 3, y: 3 }, { j: 0, x: 1, y: 1 }, { j: 1, x: 2, y: 2 }])
  assert.deepEqual(tres.map((d) => d.x).sort(), [1, 2, 3])
  assert.ok(tres.every((d) => d.x !== { 0: 1, 1: 2, 2: 3 }[d.j]))
  assert.deepEqual(destinosDaTroca([{ j: 0, x: 1, y: 1 }]), [])
  const ts = instantesDaTroca(12000)
  assert.ok(ts[0] >= AJUSTES.trocados.avisoMs && ts.every((t, i) => i === 0 || t - ts[i - 1] >= AJUSTES.trocados.avisoMs * 2))
  // um por vez: alterna a cada 1,5 s, em roda
  assert.equal(vezDoCoracao([0, 1], 100).j, 0)
  assert.equal(vezDoCoracao([0, 1], 1600).j, 1)
  assert.equal(vezDoCoracao([0, 1], 3100).j, 0)
  assert.equal(vezDoCoracao([0, 1, 2], 3100).j, 2)
  assert.equal(vezDoCoracao([1], 9999).j, 1)
  assert.equal(vezDoCoracao([], 0), null)
  assert.ok(vezDoCoracao([0, 1], 100).restanteMs <= AJUSTES.umPorVez.trocaMs)
  // a sorte nasce dentro do quadro, longe das bordas
  const rng = rngDaRegra('s', 1, 'sorte')
  for (let i = 0; i < 50; i++) {
    const p = pontoDaSorte(rng, { x: 100, y: 200, width: 336, height: 180 })
    assert.ok(p.x >= 134 && p.x <= 402 && p.y >= 230 && p.y <= 342)
  }
})

// uma ponte de mentira (sem cena: sem desenho), com o registro do que a regra pediu
function luta(chefe = 'jevil', { meus = [0, 1], semente = 'teste' } = {}) {
  const estado = criarPartidaCoop({ party: ['kris', 'susie'], chefe, semente })
  const log = { empurrou: [], curou: [], itens: [], dicas: [], banners: [] }
  const coracoes = [
    { j: 0, x: 120, y: 300, ativo: true },
    { j: 1, x: 300, y: 330, ativo: true },
  ]
  const ponte = {
    semente,
    nivel: 'medio',
    n: 2,
    rodada: () => estado.rodada,
    estado: () => estado,
    meu: (j) => meus.includes(j),
    meuLado: () => 0,
    coracoes: () => coracoes.map((c) => ({ ...c })),
    limites: () => ({ x: 100, y: 260, width: 336, height: 180 }),
    desenharItem: (i) => ({ id: i.id }),
    desenharZona: (z) => ({ id: z.id }),
    apagar: () => {},
    banner: (t) => log.banners.push(t),
    dica: (id) => log.dicas.push(id),
    quebra: () => {},
    danoNoChefe: () => {},
    curar: (j, hp) => log.curou.push([j, hp]),
    ferir: () => {},
    empurrar: (j, dx, dy) => {
      log.empurrou.push([j, dx, dy])
      const c = coracoes[j]
      c.x += dx
      c.y += dy
    },
    enviar: () => {},
  }
  const regra = new RegraDaLuta(CHEFES[chefe].regra, ponte)
  return { regra, log, coracoes, estado, ponte }
}

const forcar = (regra, ids) => regra.inst.forcar(ids)
const esquiva = (regra, ms, passo = 50) => {
  regra.comecarEsquiva({ carta: { id: 'x' } })
  for (let t = 0; t < ms; t += passo) regra.atualizar(passo)
}

test('a regra do Jevil: a descrição é UMA frase e a rolagem do início da rodada sai da semente', () => {
  const { regra, estado } = luta()
  assert.ok(descricaoValida(regra.def.descricao))
  for (const f of Object.values(regra.def.fases)) assert.ok(f.descricao.length > 5)
  regra.comecar()
  estado.rodada = 3
  regra.inicioDaRodada(3)
  const esperado = rolarDado({ semente: 'teste', rodada: 3, fase: 0 }).map((d) => d.id)
  assert.deepEqual(regra.inst.facesDaRodada(), esperado)
  assert.deepEqual(regra.inst.previa(), rolarDado({ semente: 'teste', rodada: 4, fase: 0 }).map((d) => d.id))
  regra.faseNova(2)
  estado.rodada = 5
  regra.inicioDaRodada(5)
  assert.equal(regra.inst.facesDaRodada().length, 2)
  regra.terminar()
})

test('dois PCs com a mesma semente sorteiam o mesmo dado', () => {
  const a = luta('jevil', { meus: [0] })
  const b = luta('jevil', { meus: [1] })
  for (let r = 1; r <= 8; r++) {
    a.estado.rodada = b.estado.rodada = r
    a.regra.inicioDaRodada(r)
    b.regra.inicioDaRodada(r)
    assert.deepEqual(a.regra.inst.facesDaRodada(), b.regra.inst.facesDaRodada())
  }
})

test('SORTE!: um coração de graça aparece depois do início do ataque e cura quem pega', () => {
  const { regra, log } = luta()
  forcar(regra, ['sorte'])
  regra.comecarEsquiva({ carta: {} })
  regra.atualizar(300)
  assert.equal(regra.itensVivos.length, 0)
  for (let t = 0; t < 1200; t += 50) regra.atualizar(50)
  assert.equal(regra.itensVivos.length, 1)
  const item = regra.itensVivos[0]
  const l = { x: 100, y: 260, width: 336, height: 180 }
  assert.ok(item.x > l.x && item.x < l.x + l.width && item.y > l.y && item.y < l.y + l.height)
  assert.equal(regra.alvoDoBot(1), item) // a CPU aliada vai buscar o coração
  regra.pegar(item, 1)
  assert.equal(log.curou.length, 1)
  assert.equal(log.curou[0][0], 1)
  regra.terminarEsquiva()
  assert.equal(regra.itensVivos.length, 0)
})

test('GRAVIDADE: empurra só os corações deste PC, para cima; sem a face, não mexe', () => {
  const um = luta('jevil', { meus: [0] })
  forcar(um.regra, ['gravidade'])
  esquiva(um.regra, 1000)
  assert.ok(um.log.empurrou.length > 0)
  assert.ok(um.log.empurrou.every(([j, dx, dy]) => j === 0 && dx === 0 && dy < 0))
  const nada = luta()
  forcar(nada.regra, ['rapido'])
  esquiva(nada.regra, 1000)
  assert.equal(nada.log.empurrou.length, 0)
})

test('TROCADOS: com aviso antes e os corações trocam de lugar', () => {
  const { regra, log, coracoes } = luta()
  forcar(regra, ['trocados'])
  const antes = coracoes.map((c) => ({ x: c.x, y: c.y }))
  esquiva(regra, AJUSTES.trocados.primeiroMs - 100)
  assert.equal(log.empurrou.length, 0) // ainda não trocou
  assert.ok(log.banners.includes('TROCA!')) // o aviso já saiu
  for (let t = 0; t < 200; t += 50) regra.atualizar(50)
  assert.deepEqual({ x: coracoes[0].x, y: coracoes[0].y }, antes[1])
  assert.deepEqual({ x: coracoes[1].x, y: coracoes[1].y }, antes[0])
})

test('UM POR VEZ: o parado volta ao lugar e só o da vez anda; alterna a cada 1,5 s', () => {
  const { regra, coracoes, log } = luta()
  forcar(regra, ['umPorVez'])
  regra.comecarEsquiva({ carta: {} })
  regra.atualizar(50) // grava as posições
  const parado = { x: coracoes[1].x, y: coracoes[1].y }
  // os dois "andam" (a arena move antes do gancho): o 1 está parado e volta
  coracoes[0].x += 5
  coracoes[1].x += 5
  regra.atualizar(50)
  assert.equal(coracoes[1].x, parado.x)
  assert.ok(coracoes[0].x > 120)
  // passou a vez: agora o 0 volta
  for (let t = 0; t < AJUSTES.umPorVez.trocaMs; t += 50) regra.atualizar(50)
  const p0 = { x: coracoes[0].x, y: coracoes[0].y }
  coracoes[0].x += 7
  regra.atualizar(50)
  assert.equal(coracoes[0].x, p0.x)
  assert.ok(log.empurrou.length > 0)
})

test('ESPELHADOS e RÁPIDO mexem no ataque; a rodada sem face de ataque devolve o padrão', () => {
  const { regra } = luta()
  const padrao = ataques.colunas({ forma: 'espadas', quantidade: 2 })
  forcar(regra, ['sorte'])
  assert.equal(regra.ataque({}, ataques, padrao), padrao)
  forcar(regra, ['rapido'])
  const novo = regra.ataque({}, ataques, padrao)
  assert.notEqual(novo, padrao)
  assert.equal(novo.duracao, padrao.duracao)
  assert.equal(novo.nome, padrao.nome)
  // o iniciar muda o dano e a velocidade e chama o ataque original
  let chamado = false
  const base = { ...padrao, iniciar: () => (chamado = true) }
  const a = { dano: 10, ritmo: { densidade: 1 }, balas: { fatorVelocidade: 1 } }
  regra.ataque({}, ataques, base).iniciar(a)
  assert.ok(chamado)
  assert.equal(a.dano, 5)
  assert.ok(a.balas.fatorVelocidade > 1.4)
})

test('limpeza: terminar apaga itens e some com tudo', () => {
  const { regra } = luta()
  forcar(regra, ['sorte', 'vento'])
  esquiva(regra, 2500)
  assert.ok(regra.itensVivos.length > 0)
  regra.terminar()
  assert.equal(regra.itensVivos.length, 0)
  assert.equal(regra.ativa, false)
})

test('o baralho do Jevil por fase: a marca dele (carrossel e foice) continua e todas as cartas viram ataque', () => {
  const fases = CARTAS_CHEFES.jevil.fases
  assert.equal(fases.length, 4)
  const nomes = fases.flat().map((c) => c.nome)
  for (const n of ['Carrossel', 'Foice Giratória', 'Carrossel Maluco', 'Lâmina Louca', 'Para Sempre']) assert.ok(nomes.includes(n), n)
  for (const f of fases) assert.ok(f.length >= 4)
  for (const f of fases.slice(0, 3)) assert.ok(f.some((c) => c.naipe === 'copas')) // as 3 primeiras fases têm uma carta de cura
  // nenhuma carta inverte os controles por conta própria (a face ESPELHADOS faz isso)
  for (const f of CHEFES.jevil.fases) for (const [, , , , extras] of f.cartas) assert.ok(!extras?.inverter)
})

test('lacaios e tenente: registrados, escondidos da seleção, com baralho e regra válidos', () => {
  assert.deepEqual([...CHEFES_DA_EXPEDICAO].sort(), ['coronelLacaios', 'coronelTenente', 'escuridaoLacaios', 'escuridaoTenente', 'jevilLacaios', 'jevilTenente', 'kingLacaios', 'kingTenente', 'ladraLacaios', 'ladraTenente', 'queenLacaios', 'queenTenente'])
  for (const id of ['jevilLacaios', 'jevilTenente']) {
    const def = CHEFES[id]
    assert.ok(def.oculto && def.expedicao)
    assert.ok(!ORDEM_CHEFES.includes(id))
    assert.ok(def.fases.length >= 2 && CARTAS_CHEFES[id].fases.every((f) => f.length >= 3))
    for (const f of def.fases) for (const [, , , ataque] of f.cartas) if (ataque) assert.ok(ataque(ataques).iniciar)
    assert.ok(def.super.criar(ataques).iniciar)
  }
  assert.equal(CHEFES.jevilLacaios.regra, undefined) // aquecimento: sem regra
  const t = CHEFES.jevilTenente.regra
  assert.ok(t && descricaoValida(t.descricao))
  const { regra } = luta('jevilTenente')
  regra.inicioDaRodada(1)
  assert.equal(regra.inst.facesDaRodada().length, 1)
  assert.ok(facesDaFase(DADOS_DO_TENENTE, 0).includes(regra.inst.facesDaRodada()[0]))
  regra.terminar()
})
