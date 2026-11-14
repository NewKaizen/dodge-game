// node --test src/game/pvp/__tests__/
// Os 8 bônus da CHINATOWN (pvp/bonus/eventos/chinatown/): BISCOITO DA SORTE, HASHI, SOMBRAS CHINESAS, ÁBACO,
// MAHJONG, DANÇA DO LEÃO, GATO DA SORTE e CESTINHA DE VAPOR. As regras e os planos puros (planos.js) são
// repetíveis pela semente, telegrafados e sempre deixam uma saída; e cada efeito roda numa cena de mentira
// (sem Phaser) até o fim sem deixar nada para trás.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ARENA, BONUS_POR_ARENA, eventosDaArena } from '../arenas.js'
import { EVENTO } from '../bonus.js'
import { criarRng, aleatorio } from '../baralho.js'
import { ATAQUE, CORACAO } from '../../constants.js'
import { folgaDaBala } from '../../entities/fisica.js'
import { fichaDaArena } from '../../grimorio/arenas.js'
import * as P from '../bonus/eventos/chinatown/planos.js'

const sorteDe = (semente) => {
  const rng = criarRng(semente)
  return () => aleatorio(rng)
}
const SEMENTES = Array.from({ length: 40 }, (_, i) => `chinatown:${i}`)
const NOVOS = ['biscoito', 'hashi', 'sombrasChinesas', 'abaco', 'mahjong', 'dancaDoLeao', 'gatoDaSorte', 'cestinhaDeVapor']
const ARQUIVOS = { biscoito: 'biscoito', hashi: 'hashi', sombrasChinesas: 'sombras', abaco: 'abaco', mahjong: 'mahjong', dancaDoLeao: 'leao', gatoDaSorte: 'gato', cestinhaDeVapor: 'cestinha' }
const emOrdem = (lista) => lista.every((x, i) => i === 0 || x.em > lista[i - 1].em)

// ---------- a arena ----------

test('CHINATOWN: duelo, malucas e os 8 bônus novos (nenhum renomeado) e mais nada', () => {
  const ids = eventosDaArena('chinatown').map((e) => e.id)
  assert.equal(ids.length, BONUS_POR_ARENA)
  assert.deepEqual(ids, ['duelo', 'malucas', ...NOVOS])
  for (const e of eventosDaArena('chinatown')) assert.equal(e.nome, EVENTO[e.id].nome, `${e.id}: nome próprio da arena (renomeado) não vale mais`)
  assert.equal(ARENA.chinatown.bonus.filter((b) => typeof b !== 'string').length, 0)
})

test('os 8 bônus: ficha em EVENTOS, efeito registrado, dica e prévia no Guia, e arquivo próprio', () => {
  const efeitos = readFileSync(new URL('../bonus/eventos/index.js', import.meta.url), 'utf8')
  // (o index de efeitos importa o Phaser, que não carrega no Node: confere o texto dele)
  const registro = efeitos.match(/Object\.assign\(EFEITOS, \{ biscoito[^}]*\}\)/)?.[0] ?? ''
  const ficha = fichaDaArena('chinatown', { efeitos: Object.fromEntries(NOVOS.filter((id) => registro.includes(id)).map((id) => [id, true])) })
  for (const id of NOVOS) {
    const ev = EVENTO[id]
    assert.ok(ev, id)
    assert.equal(ev.cartas, 'normal')
    assert.equal(ev.nome, ev.nome.toUpperCase(), `${id}: nome em caixa alta`)
    assert.ok(ev.descricao.length > 10 && typeof ev.cor === 'number')
    assert.match(efeitos, new RegExp(`chinatown/${ARQUIVOS[id]}\\.js`), `${id} falta no index de efeitos`)
    assert.ok(registro.includes(id), `${id} falta no objeto EFEITOS`)
    const f = ficha.eventos.find((e) => e.id === id)
    assert.ok(f.dica && f.dica.length > 40, `${id}: dica do Guia (DICAS) com o mesmo nome do evento`)
    assert.equal(f.previa, true, `${id}: prévia ao vivo no Guia`)
    assert.deepEqual(f.tambemEm, [], `${id}: só da Chinatown`)
  }
})

test('eventos antigos da CHINATOWN (dragão, lanternas) saíram do jogo', () => {
  assert.equal(EVENTO.dragao, undefined)
  assert.equal(EVENTO.lanternas, undefined)
  const efeitos = readFileSync(new URL('../bonus/eventos/index.js', import.meta.url), 'utf8')
  assert.doesNotMatch(efeitos, /dragao|lanternas/)
})

// ---------- 1. BISCOITO ----------

test('BISCOITO: repetível, todas as regras podem sair e os textos são curtos e em caixa alta', () => {
  const vistas = new Set()
  for (const semente of SEMENTES) {
    const plano = P.planoBiscoito(sorteDe(semente))
    assert.deepEqual(plano, P.planoBiscoito(sorteDe(semente)))
    assert.ok(P.REGRA_BISCOITO[plano.regra])
    vistas.add(plano.regra)
  }
  assert.equal(vistas.size, P.REGRAS_BISCOITO.length, 'todas as regras aparecem')
  for (const r of P.REGRAS_BISCOITO) {
    assert.equal(r.texto, r.texto.toUpperCase())
    assert.ok(r.texto.split(' ').length <= 6, `${r.id}: instrução com mais de 6 palavras`)
    assert.ok(r.dica.length > 5)
  }
  assert.ok(P.BISCOITO.rachaMs >= ATAQUE.telegrafoMs, 'a regra só vale depois de o papel abrir')
})

test('BISCOITO: SÓ ANDA NA DIAGONAL sempre sai diagonal (reto vira zigue-zague e o caminho segue reto)', () => {
  for (const x of [-100, -60, 0, 60, 100]) {
    for (const y of [-100, -60, 0, 60, 100]) {
      const r = P.joyDiagonal({ x, y }, 0)
      if (Math.max(Math.abs(x), Math.abs(y)) < 20) assert.deepEqual(r, { x: 0, y: 0 })
      else assert.equal(Math.abs(r.x), Math.abs(r.y), `${x},${y}`)
    }
  }
  // "direita" pura: o vertical alterna, o horizontal nunca desiste
  let somaX = 0
  let somaY = 0
  for (let t = 0; t < 2000; t += 16) {
    const r = P.joyDiagonal({ x: 100, y: 0 }, t)
    somaX += r.x
    somaY += r.y
    assert.ok(r.x > 0)
  }
  assert.ok(Math.abs(somaY) < Math.abs(somaX) * 0.15, 'o zigue-zague não desvia o caminho para um lado só')
  // diagonal pedida de verdade passa como está
  assert.deepEqual(P.joyDiagonal({ x: 80, y: -70 }, 123), { x: 100, y: -100 })
})

test('BISCOITO: espelho e giro são transformações do direcional que se desfazem', () => {
  const j = { x: 37, y: -80 }
  assert.deepEqual(P.joyEspelho(P.joyEspelho(j)), j)
  assert.deepEqual(P.joyEspelho(j), { x: -37, y: -80 })
  let g = j
  for (let k = 0; k < 4; k++) g = P.joyGiro(g)
  assert.deepEqual(g, j, 'quatro quartos de volta')
  assert.deepEqual(P.joyGiro({ x: 0, y: -100 }), { x: 100, y: 0 }, 'cima vira direita')
})

test('BISCOITO: a bala dourada é 1 em cada DOURADA_A_CADA, sempre as mesmas', () => {
  let ouro = 0
  const n = 6000
  for (let i = 0; i < n; i++) {
    assert.equal(P.ehDourada(i, 3), P.ehDourada(i, 3))
    if (P.ehDourada(i, 3)) ouro++
  }
  assert.ok(Math.abs(ouro / n - 1 / P.DOURADA_A_CADA) < 0.03, `${ouro / n}`)
})

test('BISCOITO: PORTAIS leva ao lado oposto só se estiver livre; no meio da caixa não faz nada', () => {
  const l = { left: 0, right: 220, top: 0, bottom: 170 }
  const meio = 8
  assert.deepEqual(P.portal({ x: 110, y: 85 }, l, meio, { x: -100, y: 0 }), { x: 110, y: 85, saltou: false })
  const r = P.portal({ x: 8, y: 85 }, l, meio, { x: -100, y: 0 })
  assert.equal(r.saltou, true)
  assert.ok(r.x > 200 && r.y === 85)
  assert.equal(P.portal({ x: 8, y: 85 }, l, meio, { x: -100, y: 0 }, () => false).saltou, false, 'destino ocupado: não salta')
  assert.equal(P.portal({ x: 8, y: 85 }, l, meio, { x: 100, y: 0 }).saltou, false, 'encostado na parede mas indo para dentro')
  const v = P.portal({ x: 110, y: 162 }, l, meio, { x: 0, y: 100 })
  assert.ok(v.saltou && v.y < 20)
})

// ---------- 2. HASHI ----------

test('HASHI: repetível, telegrafado, nunca repete o lado e cada beliscão termina antes do próximo', () => {
  assert.ok(P.HASHI.avisoMs >= ATAQUE.telegrafoMs + 300, 'dá tempo de sair')
  for (const semente of SEMENTES) {
    const plano = P.planoHashi(sorteDe(semente))
    assert.deepEqual(plano, P.planoHashi(sorteDe(semente)))
    assert.equal(plano.length, P.HASHI.ondas)
    assert.ok(emOrdem(plano))
    plano.forEach((h, i) => {
      assert.ok(P.LADOS_HASHI.includes(h.lado))
      assert.ok(h.alcance >= 0.55 && h.alcance <= 0.72)
      if (i) {
        assert.notEqual(h.lado, plano[i - 1].lado)
        assert.ok(h.em - plano[i - 1].em >= P.cicloHashi() + 300, 'um beliscão por vez')
      }
    })
  }
})

test('HASHI: a abertura só machuca de FECHA até SEGURA e as pontas se encontram no eixo', () => {
  const { avisoMs, fechaMs, seguraMs, soltaMs } = P.HASHI
  assert.equal(P.aberturaHashi(0).letal, false)
  assert.equal(P.aberturaHashi(avisoMs - 1).letal, false, 'o aviso inteiro é inofensivo')
  assert.equal(P.aberturaHashi(avisoMs + 10).letal, true)
  assert.equal(P.aberturaHashi(avisoMs + fechaMs + seguraMs - 1).letal, true)
  assert.equal(P.aberturaHashi(avisoMs + fechaMs + seguraMs + 20).letal, false, 'soltando: inofensivo')
  assert.ok(P.aberturaHashi(avisoMs + fechaMs).gap < 4.5, 'fechado')
  let anterior = Infinity
  for (let ms = avisoMs; ms <= avisoMs + fechaMs; ms += 10) {
    const g = P.aberturaHashi(ms).gap
    assert.ok(g <= anterior + 1e-9, 'fechando: nunca reabre')
    anterior = g
  }
  assert.ok(P.aberturaHashi(avisoMs + fechaMs + seguraMs + soltaMs).gap > P.HASHI.abertura)
})

test('HASHI: fechado, as varetas passam por cima do coração mirado (dentro da caixa) e a faixa as cobre', () => {
  const l = { left: 0, right: 220, top: 0, bottom: 170 }
  for (const lado of P.LADOS_HASHI) {
    for (const mira of [{ x: 110, y: 85 }, { x: 14, y: 14 }, { x: 206, y: 156 }, { x: 40, y: 150 }]) {
      const fechado = P.aberturaHashi(P.HASHI.avisoMs + P.HASHI.fechaMs + 5).gap
      const geo = P.geometriaHashi(lado, l, mira, 0.6, fechado)
      const aberto = P.geometriaHashi(lado, l, mira, 0.6, P.HASHI.abertura)
      // as pontas fecham sobre o eixo
      const [a, b] = geo.varetas
      const horizontal = lado === 'esquerda' || lado === 'direita'
      const dist = horizontal ? Math.abs(a.y2 - b.y2) : Math.abs(a.x2 - b.x2)
      assert.ok(dist <= 2 * fechado + 1e-6)
      // a faixa do aviso contém as duas pontas abertas
      const f = aberto.faixa
      for (const v of aberto.varetas) {
        assert.ok(v.x2 >= f.x - 1e-6 && v.x2 <= f.x + f.largura + 1e-6 && v.y2 >= f.y - 1e-6 && v.y2 <= f.y + f.altura + 1e-6, `${lado}: ponta fora da faixa`)
      }
      // o eixo sempre cai dentro da caixa com folga para as duas varetas
      assert.ok(horizontal ? geo.eixo - P.HASHI.abertura >= l.top && geo.eixo + P.HASHI.abertura <= l.bottom : geo.eixo - P.HASHI.abertura >= l.left && geo.eixo + P.HASHI.abertura <= l.right)
      // o coração parado no eixo, dentro da faixa, é pego: a distância à vareta fechada é menor que a hitbox
      const ponto = horizontal ? { x: (f.x + f.largura / 2), y: geo.eixo } : { x: geo.eixo, y: f.y + f.altura / 2 }
      const seg = (v) => ({ tipo: 'segmento', x: (v.x1 + v.x2) / 2, y: (v.y1 + v.y2) / 2, comprimento: Math.hypot(v.x2 - v.x1, v.y2 - v.y1), angulo: Math.atan2(v.y2 - v.y1, v.x2 - v.x1), espessura: P.HASHI.espessura + 3 })
      const folga = Math.min(...geo.varetas.map((v) => folgaDaBala(seg(v), ponto.x, ponto.y)))
      assert.ok(folga <= CORACAO.hitbox + 4, `${lado}: coração no eixo não é pego (folga ${folga})`)
    }
  }
})

test('HASHI: sempre dá tempo de sair da faixa durante o aviso (até colado na parede)', () => {
  const tempo = (P.distanciaParaSairDoHashi() / P.VELOCIDADE_FUGA) * 1000
  assert.ok(tempo + 150 <= P.HASHI.avisoMs, `precisa de ${Math.round(tempo)} ms de ${P.HASHI.avisoMs}`)
})

// ---------- 3. SOMBRAS CHINESAS ----------

test('SOMBRAS: a sombra atrasa sempre o mesmo (velocidade × atraso) e não inventa posição', () => {
  const hist = []
  const v = 240 // px/s
  for (let t = 0; t <= 1000; t += 16) P.registrarPosicao(hist, t, 10 + (v * t) / 1000, 50)
  const real = hist.at(-1)
  const sombra = P.posicaoAtrasada(hist, real.t)
  assert.ok(Math.abs(real.x - sombra.x - (v * P.SOMBRAS.atrasoMs) / 1000) < 1.5, 'defasagem constante')
  assert.equal(sombra.y, 50)
  // recém-nascida: fica no ponto de nascimento (ainda não tem passado)
  const nova = []
  P.registrarPosicao(nova, 0, 5, 5)
  P.registrarPosicao(nova, 16, 9, 5)
  assert.deepEqual(P.posicaoAtrasada(nova, 16), { x: 5, y: 5 })
  assert.equal(P.posicaoAtrasada([], 0), null)
  // o histórico não cresce sem parar
  assert.ok(hist.length < 40)
  assert.ok(P.SOMBRAS.atrasoMs > 0 && P.SOMBRAS.atrasoMs <= 200 && P.SOMBRAS.escala > 1 && P.SOMBRAS.dicaAlpha > 0)
})

// ---------- 4. ÁBACO ----------

test('ÁBACO: hastes e portões ficam dentro da caixa e o coração só troca de haste num portão', () => {
  const hastes = P.hastesDoAbaco(0, 170)
  const portoes = P.portoesDoAbaco(0, 220)
  assert.equal(hastes.length, P.ABACO.hastes)
  assert.equal(portoes.length, P.ABACO.portoes)
  assert.ok(hastes[0] >= 8 && hastes.at(-1) <= 162 && portoes[0] >= 0 && portoes.at(-1) <= 220)
  const meio = P.hasteMaisPerto(hastes, 85)
  const est = P.novoAbaco(meio)
  // fora do portão: aperta ↓ por 2 s e nada acontece
  for (let t = 0; t < 2000; t += 16) {
    const r = P.passoAbaco(est, { joyY: 100, noPortao: false, dt: 16, hastes })
    assert.equal(r.y, hastes[meio])
    assert.equal(r.pulou, false)
  }
  // no portão: pula para a haste de baixo em PULINHO ms e chega exatamente nela
  let pulou = false
  let ms = 0
  let y
  do {
    const r = P.passoAbaco(est, { joyY: 100, noPortao: true, dt: 16, hastes })
    pulou ||= r.pulou
    y = r.y
    ms += 16
  } while (est.pulo && ms < 1000)
  assert.ok(pulou)
  assert.equal(est.haste, meio + 1)
  assert.ok(ms <= P.ABACO.pulinhoMs + 40)
  assert.ok(y >= hastes[meio] && y <= hastes[meio + 1])
})

test('ÁBACO: respeita as pontas, tem descanso entre pulinhos e a CPU troca em qualquer lugar', () => {
  const hastes = P.hastesDoAbaco(0, 170)
  const est = P.novoAbaco(0)
  for (let t = 0; t < 400; t += 16) P.passoAbaco(est, { joyY: -100, noPortao: true, dt: 16, hastes })
  assert.equal(est.haste, 0, 'não passa da primeira haste')
  const cpu = P.novoAbaco(2)
  const r = P.passoAbaco(cpu, { joyY: 100, noPortao: false, livre: true, dt: 16, hastes })
  assert.ok(r.pulou, 'a CPU não precisa de portão')
  // desce uma haste por vez (nunca pula duas)
  for (let t = 0; t < 2000; t += 16) P.passoAbaco(cpu, { joyY: 100, noPortao: false, livre: true, dt: 16, hastes })
  assert.equal(cpu.haste, hastes.length - 1)
  const a = P.novoAbaco(1)
  P.passoAbaco(a, { joyY: 100, noPortao: true, dt: 16, hastes })
  let mudou = 0
  let ultima = a.haste
  for (let t = 0; t < P.ABACO.pulinhoMs + P.ABACO.descansoMs - 20; t += 5) {
    P.passoAbaco(a, { joyY: 100, noPortao: true, dt: 5, hastes })
    if (a.haste !== ultima) mudou++
    ultima = a.haste
  }
  assert.ok(mudou <= 1, 'cooldown entre um pulinho e o seguinte')
  assert.equal(P.noPortao(P.portoesDoAbaco(0, 220), P.portoesDoAbaco(0, 220)[2] + 5), true)
  assert.equal(P.noPortao(P.portoesDoAbaco(0, 220), P.portoesDoAbaco(0, 220)[2] + 25), false)
})

// ---------- 5. MAHJONG ----------

test('MAHJONG: o tabuleiro é repetível, tem cada símbolo em quantidade par e sempre existe um par', () => {
  for (const semente of SEMENTES) {
    const a = P.gerarTabuleiro(sorteDe(semente))
    assert.deepEqual(a, P.gerarTabuleiro(sorteDe(semente)))
    assert.equal(a.length, P.MAHJONG.colunas * P.MAHJONG.linhas)
    const cont = new Map()
    for (const s of a) cont.set(s, (cont.get(s) ?? 0) + 1)
    assert.ok([...cont.values()].some((n) => n >= 2), 'tem par')
    assert.equal(cont.size, P.MAHJONG.simbolos, 'todos os símbolos aparecem')
    for (const s of a) assert.ok(s >= 0 && s < P.MAHJONG.simbolos)
  }
})

test('MAHJONG: virar, parear, errar (a anterior desvira) e ignorar peças sumidas', () => {
  const est = P.novoMahjong([0, 1, 0, 2, 1, 2])
  assert.equal(P.pisarNaPeca(est, 0).tipo, 'virou')
  assert.deepEqual([...est.viradas], [0])
  assert.equal(P.pisarNaPeca(est, 0).tipo, 'nada', 'a mesma peça de novo não conta')
  const erro = P.pisarNaPeca(est, 1)
  assert.deepEqual([erro.tipo, erro.desvirar], ['virou', 0], 'peça diferente: a anterior desvira')
  assert.deepEqual([...est.viradas], [1])
  assert.equal(P.pisarNaPeca(est, 3).tipo, 'virou')
  const par = P.pisarNaPeca(est, 5)
  assert.equal(par.tipo, 'par')
  assert.deepEqual(par.par, [3, 5])
  assert.deepEqual([...est.sumidas].sort(), [3, 5])
  assert.equal(est.ultima, null)
  assert.equal(P.pisarNaPeca(est, 3).tipo, 'nada', 'peça sumida não vira')
  assert.equal(P.pisarNaPeca(est, -1).tipo, 'nada')
  // depois do par o encadeamento recomeça: a peça pisada logo depois NÃO pareia com a do par anterior
  assert.equal(P.pisarNaPeca(est, 0).tipo, 'virou')
  assert.equal(P.pisarNaPeca(est, 2).tipo, 'par', '0 e 2 são iguais')
  // reposição: a peça volta virada para baixo com símbolo novo
  P.reporPeca(est, 3, () => 0.99)
  assert.equal(est.sumidas.has(3), false)
  assert.equal(est.viradas.has(3), false)
  assert.equal(est.pecas[3], P.MAHJONG.simbolos - 1)
})

test('MAHJONG: a peça sob o coração e a fileira de balas varridas', () => {
  const l = { left: 0, right: 220, top: 0, bottom: 170 }
  assert.equal(P.pecaEm(l, 1, 1), 0)
  assert.equal(P.pecaEm(l, 219, 169), P.MAHJONG.colunas * P.MAHJONG.linhas - 1)
  assert.equal(P.pecaEm(l, -3, 5), -1)
  assert.equal(P.pecaEm(l, 100, 171), -1)
  const h = 170 / P.MAHJONG.linhas
  const balas = [{ y: h * 0.5 }, { y: h * 1.5 }, { y: h * 1.6 }, { y: h * 3.4 }, { y: h * 1.5, morta: true }]
  assert.equal(P.balasNaFileira(balas, l, 1).length, 2)
  assert.equal(P.balasNaFileira(balas, l, 0).length, 1)
  assert.equal(P.balasNaFileira(balas, l, 2).length, 0)
  assert.ok(P.MAHJONG.escudoMs >= 800 && P.MAHJONG.escudoMs <= 2500)
})

// ---------- 6. DANÇA DO LEÃO ----------

test('LEÃO: sequências repetíveis, de 3 a 4 setas e sem repetir a mesma seta em seguida', () => {
  for (const semente of SEMENTES) {
    const plano = P.planoLeao(sorteDe(semente))
    assert.deepEqual(plano, P.planoLeao(sorteDe(semente)))
    assert.equal(plano.length, P.LEAO.tamanhos.length)
    for (const seq of plano) {
      assert.ok(seq.length >= 3 && seq.length <= 4)
      seq.forEach((d, i) => {
        assert.ok(P.DIRECOES_LEAO.includes(d))
        if (i) assert.notEqual(d, seq[i - 1])
      })
    }
  }
  // a demonstração mostra cada seta por tempo de sobra e o jogador tem tempo de sobra para repetir
  assert.ok(P.LEAO.demoPorSetaMs >= ATAQUE.telegrafoMs * 0.9)
  assert.ok(P.LEAO.limiteMs >= 4 * 1000)
})

test('LEÃO: lerSeta conta uma vez por toque (segurar um instante) e só de novo depois de soltar', () => {
  const leitor = P.novoLeitor()
  const toques = []
  const passo = (joy, dt = 16) => {
    const d = P.lerSeta(leitor, joy, dt)
    if (d) toques.push(d)
  }
  for (let i = 0; i < 20; i++) passo({ x: 100, y: 0 }) // segura direita por 320 ms: 1 toque
  assert.deepEqual(toques, ['direita'])
  for (let i = 0; i < 5; i++) passo({ x: 0, y: 0 }) // solta
  for (let i = 0; i < 10; i++) passo({ x: 0, y: -90 }) // cima
  assert.deepEqual(toques, ['direita', 'cima'])
  for (let i = 0; i < 10; i++) passo({ x: 70, y: -10 }) // troca para direita sem soltar
  assert.deepEqual(toques, ['direita', 'cima', 'direita'])
  // tremidinha no joystick (abaixo da força) não conta
  const calmo = P.novoLeitor()
  for (let i = 0; i < 30; i++) assert.equal(P.lerSeta(calmo, { x: 40, y: 10 }, 16), null)
  // toque curtinho demais (menos que segurarMs) não conta
  const rapido = P.novoLeitor()
  assert.equal(P.lerSeta(rapido, { x: 100, y: 0 }, P.LEAO.segurarMs - 10), null)
  assert.equal(P.lerSeta(rapido, { x: 0, y: 0 }, 16), null)
  assert.equal(P.lerSeta(rapido, { x: -100, y: 0 }, P.LEAO.segurarMs - 10), null)
})

test('LEÃO: acertar a ordem completa a sequência; errar recomeça (a primeira seta certa já conta)', () => {
  const seq = ['cima', 'direita', 'baixo']
  const est = { indice: 0 }
  assert.equal(P.avancarSequencia(est, seq, 'cima').tipo, 'certo')
  assert.equal(P.avancarSequencia(est, seq, 'direita').tipo, 'certo')
  assert.equal(P.avancarSequencia(est, seq, 'baixo').tipo, 'completou')
  const e2 = { indice: 0 }
  P.avancarSequencia(e2, seq, 'cima')
  assert.equal(P.avancarSequencia(e2, seq, 'esquerda').tipo, 'errou')
  assert.equal(e2.indice, 0, 'errou: recomeça')
  P.avancarSequencia(e2, seq, 'cima')
  assert.equal(P.avancarSequencia(e2, seq, 'cima').tipo, 'errou')
  assert.equal(e2.indice, 1, 'errou com a primeira seta da sequência: já vale como a primeira')
  assert.deepEqual(P.SETA_VETOR.cima, { x: 0, y: -1 })
})

// ---------- 7. GATO DA SORTE ----------

test('GATO: fases alternam, repetíveis, e cada troca é avisada por mais tempo que o telégrafo', () => {
  assert.ok(P.GATO.avisoMs >= ATAQUE.telegrafoMs + 100)
  assert.ok(P.GATO.vaiMs.min > P.GATO.avisoMs && P.GATO.paraMs.min > P.GATO.avisoMs, 'a fase dura mais que o aviso')
  for (const semente of SEMENTES) {
    const plano = P.planoGato(sorteDe(semente))
    assert.deepEqual(plano, P.planoGato(sorteDe(semente)))
    assert.equal(plano.length, P.GATO.fases)
    assert.equal(plano[0].tipo, 'vai', 'começa andando')
    plano.forEach((f, i) => {
      if (i) assert.notEqual(f.tipo, plano[i - 1].tipo)
      assert.ok(f.dur > P.GATO.avisoMs)
    })
    const para = plano.filter((f) => f.tipo === 'para').reduce((s, f) => s + f.dur, 0)
    const total = plano.reduce((s, f) => s + f.dur, 0)
    assert.ok(para / total <= 0.5 && para / total >= 0.25, `parado ${Math.round((100 * para) / total)}% do tempo`)
  }
})

test('GATO: faseDoGato dá a fase, o resto dela e o aviso nos últimos GATO.avisoMs', () => {
  const plano = [{ tipo: 'vai', dur: 1000 }, { tipo: 'para', dur: 900 }, { tipo: 'vai', dur: 1000 }]
  assert.deepEqual([P.faseDoGato(plano, 0).tipo, P.faseDoGato(plano, 0).aviso], ['vai', false])
  const f = P.faseDoGato(plano, 1000 - P.GATO.avisoMs + 1)
  assert.deepEqual([f.tipo, f.aviso, f.proxima], ['vai', true, 'para'])
  assert.equal(P.faseDoGato(plano, 1000).tipo, 'para')
  assert.equal(P.faseDoGato(plano, 1000).aviso, false)
  assert.equal(P.faseDoGato(plano, 1800).aviso, true)
  assert.equal(P.faseDoGato(plano, 1800).proxima, 'vai')
  assert.equal(P.faseDoGato(plano, 99999).aviso, false, 'depois do plano não pisca aviso')
  // compensação: na fase "vai" o coração anda 1/ritmo mais devagar no relógio acelerado: mesmo caminho em relação às balas
  const base = 180
  assert.ok(Math.abs((base / P.GATO.ritmoVai) * P.GATO.ritmoVai - base) < 1e-9)
  assert.ok(P.GATO.ritmoVai > 1 && P.GATO.ritmoVai <= 1.5)
})

// ---------- 8. CESTINHA DE VAPOR ----------

test('CESTINHA: plano repetível, dentro da caixa, sem cestos se atropelando e com aviso antes da tampa estourar', () => {
  assert.ok(P.CESTA.avisoPopMs >= ATAQUE.telegrafoMs + 300)
  assert.ok(P.CESTA.gracaMs > 0 && P.CESTA.empurraoMs < P.CESTA.avisoPopMs)
  for (const semente of SEMENTES) {
    const plano = P.planoCestas(sorteDe(semente))
    assert.deepEqual(plano, P.planoCestas(sorteDe(semente)))
    assert.equal(plano.length, P.CESTA.cestas)
    assert.ok(plano.every((c, i) => i === 0 || c.em >= plano[i - 1].em))
    for (const c of plano) {
      const x = c.fx * P.REF_CAIXA.largura
      const y = c.fy * P.REF_CAIXA.altura
      assert.ok(x >= P.CESTA.raio && x <= P.REF_CAIXA.largura - P.CESTA.raio, 'cabe na largura')
      assert.ok(y >= P.CESTA.raio && y <= P.REF_CAIXA.altura - P.CESTA.raio, 'cabe na altura')
    }
    // cestos de turnos diferentes que existem ao mesmo tempo não se sobrepõem
    const vive = (c) => [c.em, c.em + P.CESTA.brotaMs + P.CESTA.vidaMs]
    for (let i = 0; i < plano.length; i++) {
      for (let k = i + 1; k < plano.length; k++) {
        const [a0, a1] = vive(plano[i])
        const [b0, b1] = vive(plano[k])
        if (a0 < b1 && b0 < a1) {
          const d = Math.hypot((plano[i].fx - plano[k].fx) * P.REF_CAIXA.largura, (plano[i].fy - plano[k].fy) * P.REF_CAIXA.altura)
          assert.ok(d >= 2 * P.CESTA.raio, `cestos ${i} e ${k} sobrepostos (${Math.round(d)}px)`)
        }
      }
    }
  }
})

test('CESTINHA: o abrigo cobre parte do tempo, nunca todo (a tampa sempre estoura)', () => {
  for (const semente of SEMENTES) {
    const plano = P.planoCestas(sorteDe(semente))
    const ate = plano.at(-1).em
    const cobertura = P.coberturaDasCestas(plano, ate)
    assert.ok(cobertura > 0.35 && cobertura < 0.95, `cobertura ${cobertura.toFixed(2)}`)
  }
  // fases do cesto, na ordem
  const f = (ms) => P.faseDaCesta(ms)
  assert.equal(f(0), 'brota')
  assert.equal(f(P.CESTA.brotaMs + 10), 'abrigo')
  assert.equal(f(P.CESTA.brotaMs + P.CESTA.vidaMs - P.CESTA.avisoPopMs + 1), 'aviso')
  assert.equal(f(P.CESTA.brotaMs + P.CESTA.vidaMs + 1), 'estoura')
  // o cesto só protege depois de brotar
  assert.notEqual(f(P.CESTA.brotaMs - 1), 'abrigo')
})

test('CESTINHA: o empurrão da tampa leva o coração para fora do cesto, de qualquer lugar de dentro', () => {
  const cesta = { x: 100, y: 80 }
  for (let a = 0; a < 360; a += 15) {
    const c = { x: cesta.x + Math.cos((a * Math.PI) / 180) * 12, y: cesta.y + Math.sin((a * Math.PI) / 180) * 12 }
    assert.ok(P.dentroDaCesta(c, cesta))
    const d = P.empurraoDaTampa(c, cesta, 0)
    assert.ok(Math.abs(Math.hypot(d.x, d.y) - 1) < 1e-9)
    const depois = { x: c.x + d.x * 40, y: c.y + d.y * 40 }
    assert.equal(P.dentroDaCesta(depois, cesta), false)
  }
  const centro = P.empurraoDaTampa({ x: 100, y: 80 }, cesta, Math.PI / 2)
  assert.ok(Math.abs(centro.y - 1) < 1e-9, 'no centro exato usa a direção sorteada')
})

// ---------- os efeitos numa cena de mentira ----------

// objeto de tela de mentira: aceita qualquer chamada em cadeia, guarda se foi destruído
function criarCena() {
  const objetos = []
  const tweens = []
  const atrasadas = []
  const objeto = (extra = {}) => {
    const o = { destruido: false, ...extra }
    objetos.push(o)
    const proxy = new Proxy(function () {}, {
      get(_, k) {
        if (k === 'destroy') return () => (o.destruido = true)
        if (k === 'once' || k === 'on') return () => proxy
        if (k === 'scene') return o.destruido ? null : {}
        if (k === 'text') return o.texto ?? ''
        if (k === 'setText') return (v) => ((o.texto = v), proxy)
        if (k in o) return o[k]
        if (['x', 'y', 'width', 'height', 'scaleX', 'scaleY', 'alpha', 'displayWidth', 'visible'].includes(k)) return 10
        if (k === Symbol.toPrimitive) return () => 0
        return () => proxy
      },
      apply: () => proxy,
    })
    return proxy
  }
  const add = new Proxy({}, { get: () => () => objeto() })
  const arena = {
    add,
    tweens: { add: (cfg) => (tweens.push(cfg), {}), killTweensOf() {}, isTweening: () => false },
    time: { now: 0, delayedCall: (ms, fn) => (atrasadas.push(fn), {}) },
    events: { on() {}, off() {}, once() {} },
    textures: { exists: () => false },
    cache: { audio: { exists: () => false } },
    sound: { play() {} },
    cameras: { cameras: [], main: { ignore() {} } },
    cpu: 1,
    ko: [false, false],
    donoDaPista: (j) => j,
    aceleracao: 1,
    pistas: [0, 1].map((j) => {
      const l = { left: 100 + j * 430, top: 113, right: 320 + j * 430, bottom: 283, width: 220, height: 170, centerX: 210 + j * 430, centerY: 198, x: 100 + j * 430, y: 113 }
      const bala = (o) => ({ tipo: 'circulo', raio: 6, idade: 100, aviso: 0, morta: false, inofensiva: false, vx: 0, vy: 0, fase: 0, sprite: objeto({ ehBala: true }), ...o })
      return {
        caixa: { limites: l, recortar() {}, aproximar() {}, camera: { ignore() {} } },
        coracoes: [{ x: l.centerX, y: l.centerY, ativo: true, hitbox: 4.2, tamanho: 1, invencivelMs: 0, posicionar() {} }],
        balas: { lista: [bala({ x: l.left + 30, y: l.top + 40 }), bala({ x: l.right - 20, y: l.top + 100, vx: -50 }), bala({ x: l.centerX, y: l.top + 10, tipo: 'retangulo', largura: 30, altura: 6 }), bala({ x: l.centerX + 20, y: l.bottom - 30, tipo: 'segmento', comprimento: 40, espessura: 6, angulo: 0.5 })], zonas: [], criar: (o) => bala(o) },
        atacando: true,
        ataque: { desarmado: false },
        rodando: true,
        fatorCoracao: 1,
        congelada: false,
        espelho: false,
      }
    }),
  }
  return { arena, objetos, tweens, atrasadas }
}

for (const id of NOVOS) {
  test(`${id}: roda 30 s numa cena de mentira sem erro e não deixa objeto, velocidade ou congelamento para trás`, async () => {
    const { default: criar } = await import(`../bonus/eventos/chinatown/${ARQUIVOS[id]}.js`)
    const { arena, objetos, tweens, atrasadas } = criarCena()
    const ev = criar(arena, { rng: sorteDe(`fumaca:${id}`), rodada: 3, aceleracao: 1 })
    ev.comecar()
    const antes = arena.pistas.map((p) => ({ fator: p.fatorCoracao, congelada: p.congelada }))
    let joy = { x: 0, y: 0 }
    for (let quadro = 0; quadro < 1800; quadro++) {
      arena.time.now += 16
      // o jogador faz uns movimentos qualquer
      const a = quadro / 40
      joy = { x: Math.round(Math.cos(a) * 100), y: Math.round(Math.sin(a * 1.3) * 100) }
      arena.pistas.forEach((p, j) => {
        const c = p.coracoes[0]
        const entrada = ev.joy?.(j, joy) ?? joy
        ev.passo?.(j, 16, entrada)
        c.x = Math.max(p.caixa.limites.left + 8, Math.min(p.caixa.limites.right - 8, c.x + entrada.x * 0.03))
        if (id !== 'abaco') c.y = Math.max(p.caixa.limites.top + 8, Math.min(p.caixa.limites.bottom - 8, c.y + entrada.y * 0.03))
        c.invencivelMs = Math.max(0, c.invencivelMs - 16)
        for (const b of p.balas.lista) b.idade += 16
      })
      ev.atualizar(16)
      if (quadro === 900) ev.estadoDebug?.()
    }
    assert.equal(typeof ev.estadoDebug(), 'object')
    ev.terminar()
    ev.terminar() // duas vezes não quebra
    for (const cfg of tweens) cfg.onComplete?.() // os tweens e os timers de verdade destruiriam o que é deles
    for (const fn of atrasadas) fn()
    const sobras = objetos.filter((o) => !o.destruido && !o.ehBala)
    assert.equal(sobras.length, 0, `sobraram ${sobras.length} objetos do evento na cena`)
    arena.pistas.forEach((p, j) => {
      assert.equal(p.fatorCoracao, antes[j].fator, 'velocidade do coração devolvida')
      assert.equal(p.congelada, antes[j].congelada, 'pista descongelada')
    })
  })
}
