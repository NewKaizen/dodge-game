// Planos e regras PURAS (sem Phaser) dos 8 bônus da arena CHINATOWN:
// BISCOITO DA SORTE, HASHI, SOMBRAS CHINESAS, ÁBACO, MAHJONG, DANÇA DO LEÃO, GATO DA SORTE
// e CESTINHA DE VAPOR. Os eventos (um arquivo por evento, nesta pasta) só desenham e ligam
// isto ao coração e às balas; as contas ficam aqui para serem testadas em Node
// (pvp/__tests__/eventosChinatown.test.js).
//
// Todo plano sai do `rng` da rodada (`${semente}:efeito:${rodada}`: igual nos dois PCs em
// rede) e vale para as DUAS caixas. O que depende do coração (onde o hashi mira, que casa do
// mahjong foi pisada) é local de cada PC: só o coração do dono decide o próprio dano.
//
// Garantias conferidas nos testes:
//   - determinismo (mesma semente, mesmo plano);
//   - TELEGRAFO: todo perigo avisa por pelo menos ATAQUE.telegrafoMs antes de valer;
//   - FUGA: sempre dá tempo de sair do que vai machucar.

import { CORACAO } from '../../../../constants.js'

export const REF_CAIXA = { largura: 220, altura: 170 }
// o coração normal anda ~180 px/s; as contas de fuga usam 70% disso (de olho no diagonal e nos reflexos)
export const VELOCIDADE_FUGA = CORACAO.velocidadePadrao * 0.7

const entre = (sorte, a, b) => a + (b - a) * sorte()
const sortearDe = (sorte, lista) => lista[Math.min(lista.length - 1, Math.floor(sorte() * lista.length))]
const limitar = (v, min, max) => Math.max(min, Math.min(max, v))

// ---------- 1. BISCOITO DA SORTE ----------
// O biscoito racha e solta um papelzinho com uma regra maluca para a rodada. A regra vale
// para os dois jogadores (justo). Todas deixam o coração livre para desviar: só mudam COMO.
export const BISCOITO = { primeiroMs: 500, rachaMs: 1100, papelMs: 1500 }
export const REGRAS_BISCOITO = [
  { id: 'diagonal', texto: 'SÓ ANDA NA DIAGONAL', dica: 'anda só na diagonal (andar reto vira zigue-zague)' },
  { id: 'dourado', texto: 'BALA DOURADA DÁ ESCUDO', dica: 'a bala dourada é inofensiva: pegue para ganhar escudo' },
  { id: 'parado', texto: 'PARADO NÃO LEVA DANO', dica: 'parado, nada te machuca; em movimento, tudo' },
  { id: 'espelho', texto: 'SETAS ESPELHADAS', dica: 'esquerda e direita trocadas' },
  { id: 'turbo', texto: 'VELOCIDADE DOBRADA', dica: 'o coração anda o dobro' },
  { id: 'giro', texto: 'SETAS GIRADAS', dica: 'as setas giram um quarto de volta' },
  { id: 'portais', texto: 'AS PAREDES SÃO PORTAIS', dica: 'sair por um lado leva ao lado oposto' },
]
export const REGRA_BISCOITO = Object.fromEntries(REGRAS_BISCOITO.map((r) => [r.id, r]))

export function planoBiscoito(sorte) {
  const regra = sortearDe(sorte, REGRAS_BISCOITO)
  return { em: BISCOITO.primeiroMs, regra: regra.id, texto: regra.texto }
}

// DIAGONAL: o joystick vira uma das 4 diagonais. Pedir só "direita" vira zigue-zague
// (alterna ↗ ↘ a cada ZIGUE_MS), então o caminho todo continua indo para a direita.
export const ZIGUE_MS = 230
export function joyDiagonal(joy, t = 0) {
  const ax = Math.abs(joy.x)
  const ay = Math.abs(joy.y)
  const maior = Math.max(ax, ay)
  if (maior < 20) return { x: 0, y: 0 }
  const sx = ax >= maior * 0.4 ? Math.sign(joy.x) : 0
  const sy = ay >= maior * 0.4 ? Math.sign(joy.y) : 0
  const alterna = Math.floor(t / ZIGUE_MS) % 2 ? 1 : -1
  return { x: (sx || alterna) * 100, y: (sy || alterna) * 100 }
}

export const joyEspelho = (joy) => ({ x: -joy.x, y: joy.y })
// um quarto de volta: "cima" vai para a direita, "direita" para baixo...
export const joyGiro = (joy) => ({ x: -joy.y, y: joy.x })

// bala dourada: 1 em cada DOURADA_A_CADA, por um sorteio fixo da posição na ordem de criação
export const DOURADA_A_CADA = 6
export const ESCUDO_DOURADO_MS = 2200
export function ehDourada(indice, sal = 0) {
  let h = (Math.imul(indice + 1, 0x9e3779b1) ^ Math.imul(sal + 7, 0x85ebca6b)) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d) >>> 0
  h ^= h >>> 12
  return h % DOURADA_A_CADA === 0
}

// PARADO NÃO LEVA DANO: parado (joystick solto) por PARADO_MS já vale o escudo
export const PARADO_MS = 90
export const PARADO_LIMIAR = 12

// PORTAIS: o coração que empurra a parede de um lado sai pelo outro (se o lado de lá estiver livre)
export function portal(c, l, meio, joy, livre = () => true) {
  const margem = 1.2
  let { x, y } = c
  if (c.x <= l.left + meio + margem && joy.x < -25) x = l.right - meio - 3
  else if (c.x >= l.right - meio - margem && joy.x > 25) x = l.left + meio + 3
  if (c.y <= l.top + meio + margem && joy.y < -25) y = l.bottom - meio - 3
  else if (c.y >= l.bottom - meio - margem && joy.y > 25) y = l.top + meio + 3
  if ((x !== c.x || y !== c.y) && livre(x, y)) return { x, y, saltou: true }
  return { x: c.x, y: c.y, saltou: false }
}

// ---------- 2. HASHI ----------
// Dois hashis gigantes (pauzinhos) vêm de um lado da caixa e miram o coração para BELISCAR como
// um bolinho. Fases: MIRA (seguem o coração, inofensivos) -> AVISO (travam: a faixa do beliscão
// pisca com a linha onde vão fechar; ainda inofensivos, dá para sair para qualquer lado) ->
// FECHA (as pontas se juntam, machucam) -> SEGURA -> SOLTA (voltam, inofensivos).
export const HASHI = { primeiraMs: 1000, miraMs: 800, avisoMs: 750, fechaMs: 170, seguraMs: 240, soltaMs: 380, periodoMs: { min: 3000, max: 3600 }, abertura: 24, espessura: 6, ondas: 9 }
export const LADOS_HASHI = ['esquerda', 'direita', 'cima', 'baixo']
export const cicloHashi = () => HASHI.miraMs + HASHI.avisoMs + HASHI.fechaMs + HASHI.seguraMs + HASHI.soltaMs

export function planoHashi(sorte, { ondas = HASHI.ondas } = {}) {
  const lista = []
  let em = HASHI.primeiraMs
  let anterior = null
  for (let k = 0; k < ondas; k++) {
    const lados = LADOS_HASHI.filter((l) => l !== anterior)
    const lado = sortearDe(sorte, lados)
    anterior = lado
    lista.push({ em: Math.round(em), lado, alcance: Math.round(entre(sorte, 0.55, 0.72) * 100) / 100 })
    em += Math.max(cicloHashi() + 350, entre(sorte, HASHI.periodoMs.min, HASHI.periodoMs.max))
  }
  return lista
}

// A faixa do beliscão e as duas varetas para uma abertura `gap` (distância do eixo até cada vareta).
//   l: { left, right, top, bottom }   mira: posição do coração (x, y) no instante da trava
// `eixo` do beliscão = onde as pontas se encontram. Devolve:
//   faixa   { x, y, largura, altura }  (canto de cima à esquerda) o que machuca quando fecha
//   varetas [{ x1, y1, x2, y2 }, { ... }]  (do cabo, FORA da caixa, até a ponta)
export function geometriaHashi(lado, l, mira, alcance, gap, { espessura = HASHI.espessura, cabo = 46, aberto = HASHI.abertura } = {}) {
  const horizontal = lado === 'esquerda' || lado === 'direita'
  const largura = l.right - l.left
  const altura = l.bottom - l.top
  const dim = horizontal ? largura : altura // dimensão ao longo da vareta
  const trans = horizontal ? altura : largura // dimensão perpendicular
  const meio = aberto + espessura
  // o eixo (perpendicular) fica sobre o coração, mas a faixa inteira cabe na caixa
  const eixo = limitar(horizontal ? mira.y : mira.x, (horizontal ? l.top : l.left) + meio, (horizontal ? l.bottom : l.right) - meio)
  const ponta = dim * alcance // quanto a vareta entra
  const sinal = lado === 'esquerda' || lado === 'cima' ? 1 : -1
  const origem = horizontal ? (sinal > 0 ? l.left : l.right) : sinal > 0 ? l.top : l.bottom
  const pontaU = origem + sinal * ponta
  const caboU = origem - sinal * cabo
  const varetas = [-1, 1].map((i) => {
    const vt = eixo + i * gap
    const vc = eixo + i * (gap + 16) // o cabo é mais aberto, como a mão segurando
    return horizontal ? { x1: caboU, y1: vc, x2: pontaU, y2: vt } : { x1: vc, y1: caboU, x2: vt, y2: pontaU }
  })
  const u0 = Math.min(origem, pontaU)
  const u1 = Math.max(origem, pontaU)
  const faixa = horizontal ? { x: u0, y: eixo - meio, largura: u1 - u0, altura: 2 * meio } : { x: eixo - meio, y: u0, largura: 2 * meio, altura: u1 - u0 }
  return { faixa, varetas, eixo, trans }
}

// A abertura (distância do eixo) em cada fase do ciclo, `idade` ms depois do começo do AVISO.
//   -> { gap, letal }  letal só de FECHA até o começo do SOLTA
export function aberturaHashi(idade) {
  const { avisoMs, fechaMs, seguraMs, soltaMs, abertura, espessura } = HASHI
  const fechado = espessura / 2 + 1
  if (idade < avisoMs) return { gap: abertura, letal: false }
  const f = idade - avisoMs
  if (f < fechaMs) return { gap: abertura + (fechado - abertura) * (f / fechaMs) ** 2, letal: true }
  if (f < fechaMs + seguraMs) return { gap: fechado, letal: true }
  const s = limitar((f - fechaMs - seguraMs) / soltaMs, 0, 1)
  return { gap: fechado + (abertura * 1.6 - fechado) * s, letal: false }
}

// quanto o coração precisa andar para sair da faixa do beliscão de qualquer ponto dela
// (pior caso: coração colado na parede com o eixo preso ao lado dele: sai atravessando a faixa toda)
export const distanciaParaSairDoHashi = () => 2 * (HASHI.abertura + HASHI.espessura) - 8 + CORACAO.hitbox

// ---------- 3. SOMBRAS CHINESAS ----------
// Teatro de sombras: as balas só aparecem como silhuetas num papel, maiores e ATRASADAS
// (a sombra mostra onde a bala ESTAVA há SOMBRAS.atrasoMs). A bala de verdade (hitbox) segue
// no lugar certo e aparece como uma dica fraquinha.
export const SOMBRAS = { atrasoMs: 130, escala: 1.7, historicoMs: 400, dicaAlpha: 0.28 }

// guarda as posições recentes de UMA bala e devolve onde ela estava `atraso` ms atrás
export function posicaoAtrasada(historico, agora, atraso = SOMBRAS.atrasoMs) {
  if (!historico.length) return null
  const alvo = agora - atraso
  let anterior = historico[0]
  if (alvo <= anterior.t) return { x: anterior.x, y: anterior.y }
  for (let i = 1; i < historico.length; i++) {
    const p = historico[i]
    if (p.t >= alvo) {
      const k = p.t === anterior.t ? 1 : (alvo - anterior.t) / (p.t - anterior.t)
      return { x: anterior.x + (p.x - anterior.x) * k, y: anterior.y + (p.y - anterior.y) * k }
    }
    anterior = p
  }
  return { x: anterior.x, y: anterior.y }
}

export function registrarPosicao(historico, t, x, y, janela = SOMBRAS.historicoMs) {
  historico.push({ t, x, y })
  while (historico.length > 2 && historico[1].t < t - janela) historico.shift()
}

// ---------- 4. ÁBACO ----------
// O coração só anda em HASTES horizontais (como as contas de um ábaco). Trocar de haste só
// nos PORTÕES (postes marcados): ali, ↑/↓ leva o coração à haste vizinha num pulinho.
export const ABACO = { hastes: 5, portoes: 5, meiaLargura: 15, pulinhoMs: 130, descansoMs: 70, margem: 14, velocidade: 1.2 }

export const hastesDoAbaco = (topo, base, n = ABACO.hastes, margem = ABACO.margem) => Array.from({ length: n }, (_, k) => topo + margem + ((base - topo - 2 * margem) * k) / (n - 1))
export const portoesDoAbaco = (esquerda, direita, n = ABACO.portoes, margem = ABACO.margem) => Array.from({ length: n }, (_, k) => esquerda + margem + ((direita - esquerda - 2 * margem) * k) / (n - 1))
export const hasteMaisPerto = (hastes, y) => hastes.reduce((melhor, h, i) => (Math.abs(h - y) < Math.abs(hastes[melhor] - y) ? i : melhor), 0)
export const noPortao = (portoes, x, meia = ABACO.meiaLargura) => portoes.some((p) => Math.abs(p - x) <= meia)

// Estado: { haste, pulo: null | { de, para, t }, descanso }
export const novoAbaco = (haste = 0) => ({ haste, pulo: null, descanso: 0 })

// um frame: joyY (-100..100, + = para baixo), noPortao (bool), livre (CPU: troca em qualquer lugar).
// Devolve a posição vertical relativa: `y` (px) na haste/pulo e `pulou` quando começou um pulinho.
export function passoAbaco(est, { joyY, noPortao: portao, livre = false, dt, hastes }) {
  let pulou = false
  if (est.pulo) {
    est.pulo.t += dt
    if (est.pulo.t >= ABACO.pulinhoMs) {
      est.haste = est.pulo.para
      est.pulo = null
      est.descanso = ABACO.descansoMs
    }
  } else {
    est.descanso = Math.max(0, est.descanso - dt)
    if (est.descanso <= 0 && Math.abs(joyY) >= 45 && (portao || livre)) {
      const para = limitar(est.haste + Math.sign(joyY), 0, hastes.length - 1)
      if (para !== est.haste) {
        est.pulo = { de: est.haste, para, t: 0 }
        pulou = true
      }
    }
  }
  let y = hastes[est.haste]
  if (est.pulo) {
    const k = limitar(est.pulo.t / ABACO.pulinhoMs, 0, 1)
    const suave = k * k * (3 - 2 * k)
    y = hastes[est.pulo.de] + (hastes[est.pulo.para] - hastes[est.pulo.de]) * suave
  }
  return { y, pulou, haste: est.haste, pulando: Boolean(est.pulo) }
}

// ---------- 5. MAHJONG ----------
// O chão vira peças de mahjong viradas para baixo. Pisar numa peça a vira; pisar numa SEGUNDA peça
// igual à anterior (em seguida) forma um PAR: as duas somem, a fileira de cada uma é varrida de
// balas e o coração ganha um escudo curto. Peça diferente: a anterior desvira (é um jogo da memória).
export const MAHJONG = { colunas: 5, linhas: 4, simbolos: 5, escudoMs: 1500, reporMs: 2200, desviraMs: 450 }
export const SIMBOLOS_MAHJONG = ['pontos', 'bambu', 'caractere', 'vento', 'dragao']

// tabuleiro com cada símbolo em quantidade PAR (sempre existe par); o resto sobra em duplas
export function gerarTabuleiro(sorte, { colunas = MAHJONG.colunas, linhas = MAHJONG.linhas, simbolos = MAHJONG.simbolos } = {}) {
  const total = colunas * linhas
  const pecas = []
  for (let k = 0; k < Math.floor(total / 2); k++) {
    const s = k < simbolos ? k : Math.min(simbolos - 1, Math.floor(sorte() * simbolos))
    pecas.push(s, s)
  }
  while (pecas.length < total) pecas.push(Math.floor(sorte() * simbolos))
  for (let i = pecas.length - 1; i > 0; i--) {
    const j = Math.floor(sorte() * (i + 1))
    ;[pecas[i], pecas[j]] = [pecas[j], pecas[i]]
  }
  return pecas
}

export const novoMahjong = (pecas) => ({ pecas: [...pecas], viradas: new Set(), sumidas: new Set(), ultima: null })

// peça (coluna, linha) onde o ponto (x, y) está dentro da caixa l; -1 fora
export function pecaEm(l, x, y, { colunas = MAHJONG.colunas, linhas = MAHJONG.linhas } = {}) {
  const w = (l.right - l.left) / colunas
  const h = (l.bottom - l.top) / linhas
  const c = Math.floor((x - l.left) / w)
  const r = Math.floor((y - l.top) / h)
  if (c < 0 || r < 0 || c >= colunas || r >= linhas) return -1
  return r * colunas + c
}

// O coração pisou na peça `i`. -> { tipo: 'nada' | 'virou' | 'par', par: [a, b], desvirar: indice | null }
export function pisarNaPeca(est, i) {
  if (i < 0 || est.sumidas.has(i) || i === est.ultima) return { tipo: 'nada', par: null, desvirar: null }
  if (est.ultima !== null && est.pecas[est.ultima] === est.pecas[i]) {
    const par = [est.ultima, i]
    for (const p of par) {
      est.sumidas.add(p)
      est.viradas.delete(p)
    }
    est.ultima = null
    return { tipo: 'par', par, desvirar: null }
  }
  const desvirar = est.ultima
  if (desvirar !== null) est.viradas.delete(desvirar)
  est.viradas.add(i)
  est.ultima = i
  return { tipo: 'virou', par: null, desvirar }
}

// nova peça no lugar da que sumiu (volta virada para baixo): mantém sempre um par possível
export function reporPeca(est, i, sorte, simbolos = MAHJONG.simbolos) {
  est.sumidas.delete(i)
  est.viradas.delete(i)
  est.pecas[i] = Math.floor(sorte() * simbolos)
  return est.pecas[i]
}

// balas dentro da fileira `linha` (faixa horizontal da caixa)
export function balasNaFileira(balas, l, linha, linhas = MAHJONG.linhas) {
  const h = (l.bottom - l.top) / linhas
  const y0 = l.top + linha * h
  return balas.filter((b) => !b.morta && b.y >= y0 - 2 && b.y <= y0 + h + 2)
}

// ---------- 6. DANÇA DO LEÃO ----------
// O leão dança uma sequência de setas (como o Genius/Simon); reproduza mexendo o coração
// naquelas direções, na ordem. Acertou tudo: escudo. Direção errada: recomeça a sequência
// (sem dano). Enquanto isso os ataques continuam: dá para esperar uma folga.
export const LEAO = { primeiroMs: 900, demoPorSetaMs: 380, limiteMs: 7000, pausaMs: 1300, escudoMs: 2600, forca: 60, segurarMs: 70, solto: 28, tamanhos: [3, 3, 4, 3, 4, 4, 3, 4] }
export const DIRECOES_LEAO = ['cima', 'direita', 'baixo', 'esquerda']
export const SETA_VETOR = { cima: { x: 0, y: -1 }, direita: { x: 1, y: 0 }, baixo: { x: 0, y: 1 }, esquerda: { x: -1, y: 0 } }

// as sequências da rodada: sem repetir a mesma seta em seguida (repetir exigiria soltar entre elas)
export function planoLeao(sorte, { tamanhos = LEAO.tamanhos } = {}) {
  return tamanhos.map((n) => {
    const seq = []
    for (let k = 0; k < n; k++) {
      const opcoes = DIRECOES_LEAO.filter((d) => d !== seq[k - 1])
      seq.push(sortearDe(sorte, opcoes))
    }
    return seq
  })
}

// lê o joystick como "toques de seta": a direção forte mantida por `segurarMs` conta uma vez, e só
// de novo depois de soltar (ou de trocar de direção). -> direção ('cima'...) ou null
export function lerSeta(est, joy, dt) {
  const ax = Math.abs(joy.x)
  const ay = Math.abs(joy.y)
  const maior = Math.max(ax, ay)
  const dir = maior < LEAO.forca ? null : ax >= ay ? (joy.x > 0 ? 'direita' : 'esquerda') : joy.y > 0 ? 'baixo' : 'cima'
  if (maior < LEAO.solto) {
    est.atual = null
    est.tempo = 0
    est.contou = false
    return null
  }
  if (dir === null) return null // meio-termo: não muda nada
  if (dir !== est.atual) {
    est.atual = dir
    est.tempo = 0
    est.contou = false
  }
  est.tempo += dt
  if (!est.contou && est.tempo >= LEAO.segurarMs) {
    est.contou = true
    return dir
  }
  return null
}
export const novoLeitor = () => ({ atual: null, tempo: 0, contou: false })

// Anda a sequência: -> { tipo: 'certo' | 'completou' | 'errou' }
export function avancarSequencia(est, seq, dir) {
  if (dir === seq[est.indice]) {
    est.indice++
    if (est.indice >= seq.length) return { tipo: 'completou' }
    return { tipo: 'certo' }
  }
  // a primeira seta errada logo no começo não pune: o jogador estava desviando
  est.indice = dir === seq[0] ? 1 : 0
  return { tipo: 'errou' }
}

// ---------- 7. GATO DA SORTE ----------
// O maneki-neko acena. Pata ERGUIDA = tudo PARA (balas e ataque congelam; o coração anda);
// pata ABAIXADA = tudo VAI (as balas andam). Cada troca é avisada (a pata treme, o sininho toca).
export const GATO = { vaiMs: { min: 1000, max: 1500 }, paraMs: { min: 850, max: 1250 }, avisoMs: 520, primeiroMs: 700, ritmoVai: 1.25, fases: 24 }

export function planoGato(sorte, { fases = GATO.fases } = {}) {
  const lista = []
  let tipo = 'vai'
  for (let k = 0; k < fases; k++) {
    const faixa = tipo === 'vai' ? GATO.vaiMs : GATO.paraMs
    lista.push({ tipo, dur: Math.round(k === 0 ? Math.max(GATO.primeiroMs, entre(sorte, faixa.min, faixa.max)) : entre(sorte, faixa.min, faixa.max)) })
    tipo = tipo === 'vai' ? 'para' : 'vai'
  }
  return lista
}

// a fase no instante t: { indice, tipo, restante, aviso (a troca está a GATO.avisoMs ou menos), proxima }
export function faseDoGato(plano, t) {
  let ini = 0
  for (let i = 0; i < plano.length; i++) {
    const fim = ini + plano[i].dur
    if (t < fim) {
      const restante = fim - t
      return { indice: i, tipo: plano[i].tipo, restante, aviso: restante <= GATO.avisoMs, proxima: plano[i + 1]?.tipo ?? (plano[i].tipo === 'vai' ? 'para' : 'vai') }
    }
    ini = fim
  }
  const ultima = plano[plano.length - 1]
  return { indice: plano.length, tipo: ultima.tipo === 'vai' ? 'para' : 'vai', restante: Infinity, aviso: false, proxima: ultima.tipo }
}

// ---------- 8. CESTINHA DE VAPOR ----------
// Cestos de bambu são abrigos: dentro de um você não leva dano. A tampa vai esquentando (vapor,
// chacoalhando) e ESTOURA depois de um tempo avisado, empurrando o coração para fora.
export const CESTA = { raio: 27, vidaMs: 3300, brotaMs: 550, avisoPopMs: 900, empurraoMs: 190, gracaMs: 450, pausaMs: 1500, primeiroMs: 900, cestas: 12, margem: 8 }

// Dois "cestos" por caixa em turnos (cada fileira reaparece depois da pausa). Posições em FRAÇÃO da caixa.
export function planoCestas(sorte, ref = REF_CAIXA, { cestas = CESTA.cestas } = {}) {
  const lista = []
  const proximo = [CESTA.primeiroMs, CESTA.primeiroMs + 1500] // quando cada turno nasce de novo
  const r = CESTA.raio
  const ocupados = [null, null]
  for (let k = 0; k < cestas; k++) {
    const turno = proximo[0] <= proximo[1] ? 0 : 1
    const em = Math.round(proximo[turno])
    const fim = em + CESTA.brotaMs + CESTA.vidaMs
    let pos = null
    for (let tentativa = 0; tentativa < 40 && !pos; tentativa++) {
      const x = entre(sorte, r + CESTA.margem, ref.largura - r - CESTA.margem)
      const y = entre(sorte, r + CESTA.margem, ref.altura - r - CESTA.margem)
      const outro = ocupados[1 - turno]
      // não nasce em cima do outro cesto enquanto ele existe
      if (outro && outro.fim > em && Math.hypot(outro.x - x, outro.y - y) < 2 * r + 12) continue
      pos = { x, y }
    }
    pos ??= { x: ref.largura / 2, y: ref.altura / 2 }
    ocupados[turno] = { x: pos.x, y: pos.y, fim }
    lista.push({ turno, em, fx: Math.round((pos.x / ref.largura) * 1000) / 1000, fy: Math.round((pos.y / ref.altura) * 1000) / 1000, dir: sorte() * Math.PI * 2 })
    proximo[turno] = fim + CESTA.pausaMs + entre(sorte, 0, 500)
  }
  return lista.sort((a, b) => a.em - b.em)
}

export const dentroDaCesta = (c, cesta, folga = 0) => Math.hypot(c.x - cesta.x, c.y - cesta.y) <= CESTA.raio - folga

// direção do empurrão da tampa (unitária): para longe do centro do cesto (`dir` se estiver no meio)
export function empurraoDaTampa(c, cesta, dir = 0) {
  const dx = c.x - cesta.x
  const dy = c.y - cesta.y
  const d = Math.hypot(dx, dy)
  if (d < 1.5) return { x: Math.cos(dir), y: Math.sin(dir) }
  return { x: dx / d, y: dy / d }
}

// o estado do cesto no instante `idade` (ms desde que brotou): 'brota' | 'abrigo' | 'aviso' | 'estoura'
export function faseDaCesta(idade) {
  if (idade < CESTA.brotaMs) return 'brota'
  const vida = idade - CESTA.brotaMs
  if (vida < CESTA.vidaMs - CESTA.avisoPopMs) return 'abrigo'
  if (vida < CESTA.vidaMs) return 'aviso'
  return 'estoura'
}

// fração do tempo em que há ao menos um cesto de abrigo na caixa (para o teste de equilíbrio)
export function coberturaDasCestas(plano, ate) {
  let coberto = 0
  const janelas = plano.map((c) => [c.em + CESTA.brotaMs, c.em + CESTA.brotaMs + CESTA.vidaMs]).sort((a, b) => a[0] - b[0])
  let fim = 0
  for (const [a, b] of janelas) {
    const ini = Math.max(a, fim)
    if (b > ini) coberto += Math.min(b, ate) - Math.min(ini, ate)
    fim = Math.max(fim, b)
  }
  return coberto / ate
}
