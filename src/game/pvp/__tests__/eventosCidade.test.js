// node --test src/game/pvp/__tests__/
// Os 8 bônus da CIDADE GRANDE (pvp/bonus/eventos/cidade/): a lista da arena, e as REGRAS/PLANOS puros de cada um:
// repetíveis pela semente, telegrafados (>= ATAQUE.telegrafoMs) e sempre com rota de fuga.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { ARENA, BONUS_POR_ARENA, eventosDaArena } from '../arenas.js'
import { EVENTO } from '../bonus.js'
import { criarRng, aleatorio } from '../baralho.js'
import { ATAQUE } from '../../constants.js'
import {
  GPS, planoGps, girarJoy, orientacaoEm,
  CAMERA, ANGULOS, planoCamera, camEm, quadroDoFeed, espelhar,
  ELEVADOR, planoElevador, geometriaElevador, joyDoElevador, prenderNoAndar,
  TETRIS, planoTetris, aplicarEvento, gradeValida, alturaDaPilha, linhasCheias, celulasLivres, empurrarParaFora, coracaoBate, rotacoes, NOMES_PECAS,
  FAIXA, planoFaixa, estadoDaFaixa, listraSegura, listraMachuca,
  SELFIE, planoSelfie, estadoDoSelfie,
  ENTREGA, planoEntrega, pacoteEm,
  ESCADA, planoEscada, velocidadeDaFaixa, faixaDaEsteira,
  fatorDoPlano,
} from '../bonus/eventos/cidade/planos.js'

const sorteDe = (semente) => {
  const rng = criarRng(semente)
  return () => aleatorio(rng)
}
const SEMENTES = Array.from({ length: 40 }, (_, i) => `cidade:${i}`)
const IDS = ['cidGps', 'cidCamera', 'cidElevador', 'cidTetris', 'cidFaixa', 'cidSelfie', 'cidEntrega', 'cidEscada']
const LIMITES = { left: 100, top: 100, width: 220, height: 170, right: 320, bottom: 270 }

test('Cidade Grande: lista = duelo + malucas + os 8 eventos novos (10), todos de esquiva com efeito registrado', () => {
  const ids = eventosDaArena('cidade').map((e) => e.id)
  assert.deepEqual(ids, ['duelo', 'malucas', ...IDS])
  assert.equal(ids.length, BONUS_POR_ARENA)
  assert.equal(ARENA.cidade.bonus.length, BONUS_POR_ARENA)
  const efeitos = readFileSync(new URL('../bonus/eventos/index.js', import.meta.url), 'utf8')
  const dicas = readFileSync(new URL('../../grimorio/arenas.js', import.meta.url), 'utf8')
  for (const id of IDS) {
    const e = EVENTO[id]
    assert.equal(e.cartas, 'normal', id)
    assert.equal(e.nome, e.nome.toUpperCase(), `${id}: nome em caixa alta`)
    assert.ok(e.descricao && typeof e.cor === 'number', id)
    assert.match(efeitos, new RegExp(`\\b${id}\\b`), `${id} falta no index de efeitos`)
    assert.match(dicas, new RegExp(`\\b${id}: \\{`), `${id} sem dica no Guia`)
    const arquivo = id.replace('cid', '').toLowerCase()
    assert.ok(existsSync(new URL(`../bonus/eventos/cidade/${arquivo}.js`, import.meta.url)), `${id}: arquivo`)
  }
})

test('o plano acelera no máximo 1,5x (o aviso nunca cai abaixo do mínimo)', () => {
  assert.equal(fatorDoPlano(1), 1)
  assert.equal(fatorDoPlano(2.5), 1.5)
  for (const aviso of [GPS.avisoMs, CAMERA.avisoMs, TETRIS.avisoMs, ESCADA.avisoMs, ENTREGA.avisoMs, FAIXA.contagemMs / 3, SELFIE.numeroMs * 3]) assert.ok(aviso / 1.5 >= ATAQUE.telegrafoMs, String(aviso))
})

test('GPS: repetível, avisa antes de girar, gira 90° e nunca 3 giros iguais seguidos', () => {
  assert.ok(GPS.avisoMs >= ATAQUE.telegrafoMs)
  for (const s of SEMENTES) {
    const plano = planoGps(sorteDe(s))
    assert.deepEqual(plano, planoGps(sorteDe(s)))
    let anterior = 0
    plano.forEach((p, i) => {
      assert.equal(p.em - p.avisoEm, GPS.avisoMs)
      if (i) assert.ok(p.em > plano[i - 1].em + GPS.avisoMs, 'o aviso do giro não encosta no giro anterior')
      assert.equal(Math.abs(((p.orientacao - anterior + 6) % 4) - 2), 1, 'sempre um giro de 90°')
      anterior = p.orientacao
      if (i >= 2 && p.giro === plano[i - 1].giro) assert.notEqual(plano[i - 2].giro, p.giro)
    })
  }
})

test('GPS: girarJoy leva o CIMA para a direita no giro à direita, e 4 giros voltam ao normal', () => {
  assert.deepEqual(girarJoy({ x: 0, y: -100 }, 1), { x: 100, y: 0 })
  assert.deepEqual(girarJoy({ x: 100, y: 0 }, 1), { x: 0, y: 100 })
  assert.deepEqual(girarJoy({ x: 0, y: -100 }, 3), { x: -100, y: 0 })
  assert.deepEqual(girarJoy({ x: 30, y: -70 }, 4), { x: 30, y: -70 })
  assert.deepEqual(girarJoy({ x: 30, y: -70 }, 2), { x: -30, y: 70 })
  const plano = planoGps(sorteDe('g'))
  assert.equal(orientacaoEm(plano, 0), 0)
  assert.equal(orientacaoEm(plano, plano[0].em), plano[0].orientacao)
})

test('CÂMERA: 7 fps constantes, ângulos 1/2/3 sem repetir, avisados, espelho correto', () => {
  assert.equal(CAMERA.fps, 7)
  assert.ok(CAMERA.avisoMs >= ATAQUE.telegrafoMs)
  assert.equal(quadroDoFeed(0), 0)
  assert.equal(quadroDoFeed(1000), 7)
  assert.equal(quadroDoFeed(142), 0)
  assert.equal(quadroDoFeed(143), 1)
  for (const s of SEMENTES) {
    const plano = planoCamera(sorteDe(s))
    assert.deepEqual(plano, planoCamera(sorteDe(s)))
    let cam = 1
    for (const p of plano) {
      assert.ok(ANGULOS[p.cam] && p.cam !== cam, 'nunca repete o ângulo')
      assert.equal(p.em - p.avisoEm, CAMERA.avisoMs)
      cam = p.cam
    }
    assert.equal(camEm(plano, 0), 1)
  }
  assert.deepEqual(espelhar(2, 110, 120, 200, 185), { x: 290, y: 120 })
  assert.deepEqual(espelhar(3, 110, 120, 200, 185), { x: 110, y: 250 })
  assert.deepEqual(espelhar(1, 110, 120, 200, 185), { x: 110, y: 120 })
})

test('ELEVADOR: 3 ou 4 andares; só muda de andar no poço; sempre dá para chegar ao poço', () => {
  const vistos = new Set()
  for (const s of SEMENTES) {
    const plano = planoElevador(sorteDe(s))
    assert.deepEqual(plano, planoElevador(sorteDe(s)))
    assert.ok(ELEVADOR.andares.includes(plano.andares) && ELEVADOR.pocos.includes(plano.poco))
    vistos.add(plano.andares)
    const g = geometriaElevador(LIMITES, plano)
    assert.equal(g.linhas.length, plano.andares)
    assert.ok(g.poco.x0 >= LIMITES.left && g.poco.x1 <= LIMITES.right)
    assert.ok(g.corredorMeio >= 8, 'o corredor é largo o bastante para o coração')
    // fora do poço, no corredor: não sobe nem desce além da folga do corredor
    const foraX = g.poco.x1 + 20 < LIMITES.right ? g.poco.x1 + 20 : g.poco.x0 - 20
    const y = g.linhas[1]
    assert.equal(joyDoElevador(g, foraX, y + g.corredorMeio, { x: 0, y: 100 }).y, 0)
    assert.equal(joyDoElevador(g, foraX, y - g.corredorMeio, { x: 0, y: -100 }).y, 0)
    assert.equal(joyDoElevador(g, foraX, y, { x: 0, y: 100 }).y, 100, 'dentro do corredor ainda mexe um pouco')
    // no poço, no meio do ar: sobe e desce livre, mas não sai de lado
    const meio = (g.linhas[0] + g.linhas[1]) / 2
    assert.equal(joyDoElevador(g, g.poco.cx, meio, { x: 0, y: -100 }).y, -100)
    assert.equal(joyDoElevador(g, g.poco.x0 + 0.5, meio, { x: -100, y: 0 }).x, 0)
    // a correção de posição: fora do poço o y fica no corredor mais perto
    const preso = prenderNoAndar(g, foraX, meio)
    assert.equal(preso.noPoco, true, 'no meio do ar fora do poço volta para o poço')
    assert.ok(preso.x >= g.poco.x0 && preso.x <= g.poco.x1)
    const noCorredor = prenderNoAndar(g, foraX, y + 30 > g.linhas[2] ? y : y + g.corredorMeio + 1)
    assert.ok(Math.abs(noCorredor.y - y) <= g.corredorMeio + 0.001 || noCorredor.noPoco)
  }
  assert.deepEqual([...vistos].sort(), [3, 4], 'as duas alturas de prédio aparecem')
})

test('TETRIS: peças existem (7), sempre há caminho: espaço livre de um pedaço só, mínimo livre e pilha baixa', () => {
  assert.equal(NOMES_PECAS.length, 7)
  for (const nome of NOMES_PECAS) for (const r of rotacoes(nome)) assert.equal(r.length, 4)
  assert.ok(TETRIS.avisoMs >= ATAQUE.telegrafoMs)
  let comLinha = 0
  for (const s of SEMENTES) {
    const plano = planoTetris(sorteDe(s))
    assert.deepEqual(plano, planoTetris(sorteDe(s)), 'mesma semente, mesmo plano')
    let grade = plano.inicial.map((l) => [...l])
    assert.ok(gradeValida(grade), 'grade inicial')
    assert.equal(grade[TETRIS.linhas - 2][Math.floor(TETRIS.colunas / 2)], 0, 'o lugar onde o coração nasce está livre')
    let fim = 0
    for (const ev of plano.eventos) {
      assert.ok(ev.em >= fim, 'um evento por vez')
      assert.ok(ev.avisoMs >= ATAQUE.telegrafoMs)
      if (ev.tipo === 'peca') {
        assert.equal(ev.celulas.length, 4)
        fim = ev.pousoEm + (ev.cheias.length ? TETRIS.limpaMs : 0)
        assert.ok(ev.pousoEm > ev.em + ev.avisoMs)
        if (ev.cheias.length) comLinha++
      } else fim = ev.em + ev.avisoMs
      grade = aplicarEvento(grade, ev)
      assert.ok(gradeValida(grade), `${s}: depois de ${ev.tipo}`)
      assert.ok(alturaDaPilha(grade) <= TETRIS.alturaMax)
      assert.ok(celulasLivres(grade) >= TETRIS.colunas * TETRIS.linhas * TETRIS.livreMin)
      assert.equal(linhasCheias(grade).length, 0, 'linha cheia sempre some')
    }
  }
  assert.ok(comLinha >= SEMENTES.length / 2, `linhas cheias acontecem (${comLinha})`)
})

test('TETRIS: o coração é empurrado para fora dos blocos e nunca preso', () => {
  const grade = Array.from({ length: TETRIS.linhas }, () => Array(TETRIS.colunas).fill(0))
  grade[7][4] = 1
  grade[7][5] = 1
  const cw = LIMITES.width / TETRIS.colunas
  const ch = LIMITES.height / TETRIS.linhas
  assert.equal(coracaoBate(LIMITES, grade, LIMITES.left + 4.5 * cw, LIMITES.top + 7.5 * ch, 6.5), true)
  assert.equal(coracaoBate(LIMITES, grade, LIMITES.left + 4.5 * cw, LIMITES.top + 5.5 * ch, 6.5), false)
  const r = empurrarParaFora(LIMITES, grade, LIMITES.left + 4.9 * cw, LIMITES.top + 7.2 * ch, 6.5)
  assert.equal(coracaoBate(LIMITES, grade, r.x, r.y, 6.4), false)
  // peça pousou em cima: sai para uma célula livre
  const cheia = grade.map((l, i) => (i >= 5 ? l.map((_, c) => (c === 5 ? 0 : 1)) : l))
  const r2 = empurrarParaFora(LIMITES, cheia, LIMITES.left + 2.5 * cw, LIMITES.top + 6.5 * ch, 6.5)
  assert.equal(coracaoBate(LIMITES, cheia, r2.x, r2.y, 6.4), false)
})

test('FAIXA: branca/preta alternam, o semáforo manda, a contagem avisa e sempre há listra segura vizinha', () => {
  assert.ok(FAIXA.contagemMs / 3 >= ATAQUE.telegrafoMs)
  assert.ok(FAIXA.gracaMs >= 250)
  for (let k = 0; k < FAIXA.listras; k++) {
    assert.equal(listraSegura('vermelho', k), k % 2 === 0, 'vermelho: só as brancas')
    assert.equal(listraSegura('verde', k), k % 2 === 1, 'verde: só as pretas')
    for (const luz of ['vermelho', 'verde']) assert.ok(listraSegura(luz, k) || listraSegura(luz, Math.min(FAIXA.listras - 1, k + 1)) || listraSegura(luz, Math.max(0, k - 1)), 'uma segura na própria listra ou ao lado')
  }
  assert.ok(FAIXA.quentaFrac < 1, 'sobra uma folga entre as listras')
  for (const s of SEMENTES) {
    const plano = planoFaixa(sorteDe(s))
    assert.deepEqual(plano, planoFaixa(sorteDe(s)))
    plano.fases.forEach((f, i) => {
      assert.equal(f.luz, i % 2 ? (plano.inicial === 'vermelho' ? 'verde' : 'vermelho') : plano.inicial)
      assert.ok(f.fim - f.em >= FAIXA.contagemMs + 300, 'a fase tem tempo além da contagem')
      if (i) assert.equal(f.em, plano.fases[i - 1].fim)
    })
    const f1 = plano.fases[0]
    const e = estadoDaFaixa(plano, f1.fim - 1000)
    assert.ok(e.contagem >= 1 && e.contagem <= 3)
    assert.equal(estadoDaFaixa(plano, f1.fim - FAIXA.contagemMs - 10).contagem, 0)
    // no começo da esquiva e logo depois da troca nada queima
    assert.equal(listraMachuca(plano, 100, 0), false)
    assert.equal(listraMachuca(plano, 100, 1), false)
    const logo = plano.fases[1].em + 50
    assert.ok([0, 1].every((k) => !listraMachuca(plano, logo, k)), 'folga depois da troca')
    const depois = plano.fases[1].em + FAIXA.gracaMs + 50
    assert.equal([0, 1].filter((k) => listraMachuca(plano, depois, k)).length, 1, 'uma das duas cores queima')
  }
})

test('SELFIE: contagem 3-2-1, flash e congelamento de 0,8 s, sem fotos sobrepostas', () => {
  assert.ok(SELFIE.numeroMs * 3 >= ATAQUE.telegrafoMs * 3)
  assert.ok(SELFIE.congelaMs >= 700 && SELFIE.congelaMs <= 900)
  for (const s of SEMENTES) {
    const plano = planoSelfie(sorteDe(s))
    assert.deepEqual(plano, planoSelfie(sorteDe(s)))
    plano.forEach((f, i) => {
      assert.equal(f.flashEm - f.em, SELFIE.numeroMs * 3)
      assert.equal(f.fimEm - f.flashEm, SELFIE.congelaMs)
      if (i) assert.ok(f.em >= plano[i - 1].fimEm + SELFIE.folgaMs.min - 1, 'tempo livre entre as fotos')
    })
    const f = plano[0]
    assert.equal(estadoDoSelfie(plano, f.em - 1).fase, 'livre')
    assert.equal(estadoDoSelfie(plano, f.em + 10).numero, 3)
    assert.equal(estadoDoSelfie(plano, f.em + SELFIE.numeroMs + 10).numero, 2)
    assert.equal(estadoDoSelfie(plano, f.em + SELFIE.numeroMs * 2 + 10).numero, 1)
    assert.equal(estadoDoSelfie(plano, f.flashEm + 1).fase, 'congelado')
    assert.equal(estadoDoSelfie(plano, f.fimEm).fase, 'livre')
  }
})

test('ENTREGA: pacotes dentro da caixa, longe do destino, avisados, um por vez, expresso a cada 3º', () => {
  assert.ok(ENTREGA.avisoMs >= ATAQUE.telegrafoMs)
  for (const s of SEMENTES) {
    const plano = planoEntrega(sorteDe(s))
    assert.deepEqual(plano, planoEntrega(sorteDe(s)))
    assert.equal(plano.length, ENTREGA.pacotes)
    plano.forEach((p, i) => {
      for (const ponto of [p.origem, p.destino]) assert.ok(ponto.fx >= ENTREGA.margem && ponto.fx <= 1 - ENTREGA.margem && ponto.fy > 0.1 && ponto.fy < 0.9)
      assert.equal(p.valeEm - p.em, ENTREGA.avisoMs)
      assert.equal(p.expresso, (i + 1) % ENTREGA.expressaCada === 0)
      assert.equal(p.energia, p.expresso ? ENTREGA.energiaExpresso : ENTREGA.energia)
      if (i) assert.ok(p.em >= plano[i - 1].fimEm, 'um pacote por vez')
      assert.ok(p.fimEm - p.valeEm >= 2500, 'dá tempo de pegar e entregar')
    })
    assert.equal(pacoteEm(plano, plano[1].em + 1), plano[1])
  }
})

test('ESCADA: esteiras alternam o sentido, são bem mais lentas que o coração e invertem avisando', () => {
  assert.ok(ESCADA.avisoMs >= ATAQUE.telegrafoMs)
  assert.ok(ESCADA.velocidade.max <= 90, 'dá para andar contra a esteira (o coração anda 180 px/s)')
  for (const s of SEMENTES) {
    const plano = planoEscada(sorteDe(s))
    assert.deepEqual(plano, planoEscada(sorteDe(s)))
    assert.equal(plano.faixas.length, ESCADA.faixas)
    plano.faixas.forEach((f, k) => {
      assert.ok(f.velocidade >= ESCADA.velocidade.min && f.velocidade <= ESCADA.velocidade.max)
      if (k) assert.equal(f.sentido, -plano.faixas[k - 1].sentido, 'sentidos opostos')
    })
    plano.inversoes.forEach((v, i) => {
      assert.equal(v.em - v.avisoEm, ESCADA.avisoMs)
      if (i) assert.ok(v.avisoEm > plano.inversoes[i - 1].em, 'o aviso vem depois da inversão anterior')
    })
    const antes = velocidadeDaFaixa(plano, 0, 0)
    assert.equal(velocidadeDaFaixa(plano, 0, plano.inversoes[0].em), -antes)
    assert.equal(velocidadeDaFaixa(plano, 0, plano.inversoes[1].em), antes)
  }
  assert.equal(faixaDaEsteira(LIMITES, LIMITES.top), 0)
  assert.equal(faixaDaEsteira(LIMITES, LIMITES.bottom), ESCADA.faixas - 1)
  assert.equal(faixaDaEsteira(LIMITES, LIMITES.top + LIMITES.height / 2 + 1), 2)
})

// ---------- limpeza (os efeitos desfazem tudo) ----------

test('os arquivos dos efeitos desfazem o que mexem: terminar() destrói os objetos e devolve câmeras/filtros', () => {
  for (const id of IDS) {
    const arquivo = id.replace('cid', '').toLowerCase()
    const fonte = readFileSync(new URL(`../bonus/eventos/cidade/${arquivo}.js`, import.meta.url), 'utf8')
    assert.match(fonte, /terminar\(\) \{[\s\S]*ativo = false/, `${id}: terminar`)
    assert.match(fonte, /export default function criar\(arena/, id)
    assert.match(fonte, /destroy\(\)/, `${id}: destrói o que criou`)
  }
  const camera = readFileSync(new URL('../bonus/eventos/cidade/camera.js', import.meta.url), 'utf8')
  assert.match(camera, /filters\?\.internal\?\.remove\?\.\(f\)/, 'CÂMERA tira o filtro')
  assert.match(camera, /reaplicar/, 'CÂMERA devolve as câmeras ao normal')
  assert.match(camera, /events\.off\('postupdate'/, 'CÂMERA solta o gancho')
})
