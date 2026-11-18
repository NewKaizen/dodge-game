// Os LACAIOS e os TENENTES da EXPEDIÇÃO (lacaios -> tenente -> chefão) em pixel art de DENSIDADE 2, no mesmo estilo
// dos chefões (arte/chefoes.js): o pintor de formas (arte/pintor.js), rampas de 4 tons por material, contorno escuro
// e brilhos. Arte original, com a paleta do chefão de cada família.
//
// Todos têm a altura de tela dos chefões (72 linhas, na escala 2 centrados em y 196 na arena) e ficam apoiados na
// mesma linha do chão (a linha 66). O tamanho conta a hierarquia: os lacaios (um grupo numa imagem só) ocupam até
// ~46 linhas de altura, o tenente ~56 e o chefão ~64.
//
// Cada um tem QUADROS_IDLE quadros (o quadro 0 é a própria chave, os outros '<chave>-q1' e '<chave>-q2';
// texturas.js: quadrosDe e entities/Inimigo.js, que alterna entre eles).
import { pintor } from './pintor.js'
import { SEMANAIS_EXPEDICAO } from './semanais.js'

const ALTURA = 72

// ---------- rampas (sombra funda, sombra, base, luz) ----------
const OURO = ['#6e3f0c', '#b07a14', '#f2c235', '#fff2a0']
const OBSIDIANA = ['#0b0714', '#1a1130', '#2c1f4a', '#4a3a78']
const MANTO = ['#1c1032', '#36205e', '#563a94', '#8064c4']
const CAPA = ['#33081a', '#62122c', '#9a2040', '#cf4458']
const CAOS = ['#4a0838', '#a8186a', '#ff3f9a', '#ffd0ea']
const MARFIM = ['#6e6250', '#b9a98a', '#f2ead8', '#ffffff']
const PRATA = ['#4a4e70', '#868cb4', '#cdd2ee', '#ffffff']
const ROSA = ['#4e0a38', '#9c1c6c', '#ec3aa8', '#ff9ad6']
const CIANO = ['#1a7a9a', '#20b8d8', '#40f0ff', '#e8ffff']
const VIOLETA = ['#22103c', '#432078', '#6a36b6', '#9c6ce8']
const PETROLEO = ['#0a2234', '#134a64', '#1f7896', '#52b8d8']
const MASCARA = ['#68668e', '#b6b2d6', '#e6e2f6', '#ffffff']
const RUBI = ['#560a1c', '#a6182e', '#ea3048', '#ff9eac']
const LUVA = ['#7a7896', '#c4c2da', '#f0eefa', '#ffffff']
const ACO = ['#22262f', '#3e4554', '#646e82', '#9aa4b8']
const CROMO = ['#4a4f5a', '#8a909c', '#c8ccd8', '#ffffff']
const LARANJA = ['#6a2c08', '#a85a14', '#e8892a', '#ffc070']
const PNEU = ['#08080c', '#16161c', '#26262e', '#40404a']
const TELA = '#0a1230'

// o pedestal de peça de xadrez (obsidiana com o friso de ouro), centrado em x com o chão em y
function pedestal(p, x, y, r) {
  p.forma(p.elipse(x, y, r, 2.6), OBSIDIANA, 'bola')
  p.forma(p.ret(x - r + 1, y - 5, 2 * r - 2, 5), OBSIDIANA)
  p.linha(x - r + 2, y - 4, x + r - 3, y - 4, OURO[2])
  p.linha(x - r + 2, y - 3, x + r - 3, y - 3, OURO[0])
  p.forma(p.elipse(x, y - 5, r - 1.5, 2), OBSIDIANA, 'bola')
}

// ================= CHAOS KING =================

// O peão de marfim com olhos de caos e o escudinho; `dy` levanta a peça inteira (o pulinho)
function peao(p, x, dy, olho) {
  const y = 64 + dy
  pedestal(p, x, y, 9)
  p.forma(p.poli([x - 4, y - 17], [x + 4, y - 17], [x + 7, y - 6], [x - 7, y - 6]), MARFIM)
  p.forma(p.elipse(x, y - 17, 6, 1.9), MARFIM, 'bola')
  p.forma(p.ret(x - 2, y - 21, 4, 4), MARFIM)
  p.forma(p.elipse(x, y - 25.5, 5.6, 5.6), MARFIM, 'bola')
  // olhos bravos e a rachadura do caos
  p.carimbo(x - 4, y - 27, ['kk..kk', '.o..o.'], { k: '#1c1230', o: olho })
  p.linha(x + 2, y - 30, x + 3, y - 28, CAOS[1])
  // o escudinho com o losango do tabuleiro
  p.forma(p.poli([x - 3, y - 15], [x + 3, y - 15], [x + 3, y - 11], [x, y - 8], [x - 3, y - 11]), MANTO, 'bisel')
  p.carimbo(x - 1, y - 14, ['.r.', 'rRr', '.r.'], { r: '#c8323a', R: '#ffb0b0' })
}

// LACAIOS DO REI: a torre de obsidiana no meio e dois peões de marfim na frente
function kingLacaios(q) {
  const p = pintor(96, ALTURA, { dx: 2 })
  const x = 46
  // ----- a torre -----
  pedestal(p, x, 64, 15)
  const corpo = p.poli([x - 10, 32], [x + 10, 32], [x + 12, 59], [x - 12, 59])
  p.forma(corpo, MANTO)
  // as pedras (fiadas desencontradas)
  for (let y = 37, i = 0; y < 58; y += 5, i++) {
    p.linha(x - 11, y, x + 11, y, MANTO[1])
    for (let bx = x - 9 + (i % 2) * 4; bx < x + 10; bx += 8) p.linha(bx, y - 4, bx, y - 1, MANTO[1])
  }
  p.forma(p.e(corpo, p.ret(0, 0, 92, 34)), MANTO, 'bisel')
  // a cinta de ouro e as ameias
  p.forma(p.ret(x - 13, 28, 26, 4), OURO)
  const ameias = p.menos(p.ret(x - 14, 18, 28, 11), p.ret(x - 7, 18, 4, 4), p.ret(x + 3, 18, 4, 4))
  p.forma(ameias, MANTO)
  // a seteira com os olhos vermelhos
  p.preencher(p.ret(x - 9, 23, 18, 3), '#05030a')
  const olho = ['#ff2a3a', '#ff6a2a', '#ff2a3a'][q]
  p.carimbo(x - 7, 23, ['.oo.......oo.', 'oOoo.....oOoo', '.oo.......oo.'], { o: olho, O: '#ffe08a' })
  // o losango do caos no peito, com as rachaduras que brilham
  p.forma(p.poli([x, 38], [x + 4, 43], [x, 48], [x - 4, 43]), CAOS, 'bola')
  p.px(x - 1, 40, '#ffffff')
  for (const pts of [
    [[x - 3, 48], [x - 5, 52], [x - 4, 55]],
    [[x + 3, 48], [x + 6, 51], [x + 5, 56]],
  ])
    for (let i = 1; i < pts.length; i++) p.linha(...pts[i - 1], ...pts[i], CAOS[q === 1 ? 3 : 2])
  // ----- os peões (pulam um de cada vez) -----
  peao(p, 15, [0, -1, 0][q], olho)
  peao(p, 77, [0, 0, -1][q], olho)
  // as faíscas do caos em volta
  for (const [fx, fy] of [[[30, 22], [63, 30]], [[29, 30], [62, 21]], [[31, 26], [61, 26]]][q]) p.carimbo(fx - 1, fy - 1, ['.c.', 'cwc', '.c.'], { c: CAOS[2], w: CAOS[3] })
  p.contorno('#0c0616')
  return p.grade
}

// O CAVALEIRO (tenente): a peça do cavalo, roxa, com a crina de ouro, o testeiro e a manta vermelha do rei
function kingCavaleiro(q) {
  const p = pintor(58, ALTURA, { dx: 3 })
  pedestal(p, 28, 64, 18)
  // a crina de ouro atrás do pescoço (os tufos ondulam entre os quadros)
  const tufos = []
  for (let i = 0; i < 9; i++) {
    const t = i / 8
    const bx = 30 + t * 13 + Math.sin(t * 2.4) * 2
    const by = 12 + t * 40
    const onda = Math.sin(i * 1.3 + q * 2.1) * 1.5
    tufos.push(p.poli([bx - 3, by - 2], [bx + 6 + onda, by + 1], [bx - 1, by + 5]))
  }
  p.forma(p.tubo([[26, 12], [36, 18], [41, 30], [43, 44], [43, 57]], 2.5, 3.5), OURO)
  for (const t of tufos) p.forma(t, OURO, 'bola')
  // a cabeça e o pescoço (olhando para a esquerda)
  const cabeca = p.poli([14, 59], [16, 48], [20, 41], [18, 37], [11, 39], [6, 38], [3, 34], [4, 29], [9, 24], [15, 18], [18, 13], [20, 8], [24, 13], [29, 13], [35, 17], [39, 26], [41, 38], [42, 59])
  p.forma(cabeca, MANTO)
  p.vinco(cabeca, p.menos(p.pintado(), cabeca), OURO[0]) // a linha entre a cabeça e a crina
  // o queixo e as maçãs (volume)
  p.linha(19, 37, 22, 31, MANTO[1])
  p.linha(22, 31, 22, 27, MANTO[1])
  p.linha(23, 30, 23, 27, MANTO[3])
  // a orelha (o miolo rosado)
  p.linha(20, 11, 21, 14, CAOS[1])
  // o testeiro de ouro com a joia vermelha
  p.forma(p.poli([6, 30], [14, 20], [19, 22], [11, 32]), OURO)
  p.carimbo(11, 24, ['.r.', 'rRr', '.r.'], { r: '#e8323a', R: '#ffb0b0' })
  // o olho (brilha) e a sobrancelha brava
  const olho = ['#ff2a3a', '#ff6a2a', '#ffb02a'][q]
  p.linha(14, 25, 19, 23, '#05030a')
  p.carimbo(15, 26, ['ooo', 'oOo'], { o: olho, O: '#ffe08a' })
  // a narina, a boca e as rédeas
  p.carimbo(4, 31, ['kk', 'k.'], { k: '#05030a' })
  p.linha(4, 35, 10, 37, '#05030a')
  p.linha(10, 36, 19, 41, OURO[1])
  p.px(10, 36, OURO[3])
  // a manta vermelha do rei, com a barra de ouro e o losango do caos
  const manta = p.poli([18, 46], [41, 41], [42, 58], [16, 59])
  p.forma(manta, CAPA)
  p.vinco(manta, p.menos(p.ret(-5, -5, 70, 80), manta), OURO[2])
  for (let x = 20; x < 41; x += 5) p.px(x, 57, OURO[3])
  p.forma(p.poli([30, 46], [34, 50], [30, 54], [26, 50]), CAOS, 'bola')
  p.px(29, 48, '#ffffff')
  // o bafo do cavalo (some e volta)
  const bafo = [[], [[1, 37, 1.6]], [[0, 39, 1.4], [2, 36, 1]]][q]
  for (const [bx, by, r] of bafo) p.forma(p.elipse(bx, by, r, r), ['#3a3a54', '#6a6a8a', '#a8a8c8', '#e0e0f0'], 'bola')
  p.contorno('#0c0616')
  // as faíscas do caos (depois do contorno, soltas)
  for (const [fx, fy] of [[[48, 10], [6, 48]], [[51, 16], [5, 44]], [[47, 6], [8, 52]]][q]) p.carimbo(fx - 1, fy - 1, ['.c.', 'cwc', '.c.'], { c: CAOS[2], w: CAOS[3] })
  return p.grade
}

// ================= QUEEN =================

// o robozinho de monitor: `cor` é a rampa da luz (ciano ou rosa); `pisca` fecha os olhos
function robo(p, x, cor, dy, pisca, antena) {
  const y = dy
  // as perninhas e os pés
  for (const s of [-1, 1]) {
    p.forma(p.ret(x + s * 4 - 1, 56 + y, 3, 6), PRATA)
    p.forma(p.elipse(x + s * 4 + 0.5, 63 + y, 3, 1.8), OBSIDIANA, 'bola')
  }
  // os bracinhos (um acena)
  p.forma(p.tubo([[x - 7, 47 + y], [x - 11, 51 + y], [x - 11, 54 + y]], 1.3), PRATA)
  p.forma(p.elipse(x - 11, 55 + y, 1.8, 1.8), cor, 'bola')
  p.forma(p.tubo([[x + 7, 47 + y], [x + 11, 45 + y], [x + 12, 41 + y + antena]], 1.3), PRATA)
  p.forma(p.elipse(x + 12, 40 + y + antena, 1.8, 1.8), cor, 'bola')
  // o corpo com a luz no peito
  p.forma(p.menos(p.ret(x - 7, 45 + y, 14, 12), p.ret(x - 7, 45 + y, 1, 1), p.ret(x + 6, 45 + y, 1, 1)), PRATA)
  p.forma(p.ret(x - 3, 48 + y, 6, 5), cor, 'bisel', { funda: false })
  p.px(x - 2, 49 + y, '#ffffff')
  // a cabeça de monitor
  p.forma(p.ret(x - 2, 43 + y, 4, 2), ['#141428', '#20203a', '#2e2e4e', '#46466a'])
  const caixa = p.menos(p.ret(x - 10, 30 + y, 20, 14), p.ret(x - 10, 30 + y, 1, 1), p.ret(x + 9, 30 + y, 1, 1), p.ret(x - 10, 43 + y, 1, 1), p.ret(x + 9, 43 + y, 1, 1))
  p.forma(caixa, PRATA)
  p.preencher(p.ret(x - 8, 32 + y, 16, 9), TELA)
  for (let ly = 33; ly < 41; ly += 2) p.linha(x - 8, ly + y, x + 7, ly + y, '#0f1a40')
  p.carimbo(x - 8, 32 + y, ['ww', 'w.'], { w: '#3a4a80' })
  const olhos = pisca ? ['..........', '..........', 'ccc....ccc'] : ['.c......c.', 'cwc....cwc', 'ccc....ccc']
  p.carimbo(x - 5, 34 + y, olhos, { c: cor[2], w: '#ffffff' })
  p.carimbo(x - 2, 38 + y, ['m..m', '.mm.'], { m: cor[3] })
  // a antena com a bolinha (pisca)
  p.linha(x, 29 + y, x, 26 + y, PRATA[1])
  p.forma(p.elipse(x + 0.5, 25 + y, 1.8, 1.8), antena ? cor : ['#2a2a40', '#3a3a5a', '#5a5a80', '#8a8aa8'], 'bola')
}

// LACAIOS DA QUEEN: dois robozinhos de monitor (ciano e rosa) e o POP-UP que flutua entre eles
function queenLacaios(q) {
  const p = pintor(96, ALTURA, { dx: 2 })
  robo(p, 16, CIANO, [0, -1, 0][q], q === 2, q !== 1)
  robo(p, 76, ROSA, [0, 0, -1][q], q === 1, q !== 2)
  // o pop-up: barra de título rosa com o X, o aviso amarelo e o botão OK (flutua)
  const y = [0, -1, -2][q] + 22
  const x = 32
  const PAPEL = ['#8a88b0', '#c8c8e8', '#f4f4ff', '#ffffff']
  p.forma(p.ret(x, y, 28, 24), PAPEL, 'bisel', { luz: false })
  p.forma(p.ret(x, y, 28, 5), ROSA, 'bisel')
  p.carimbo(x + 2, y + 1, ['www.w.www'], { w: ROSA[3] })
  p.forma(p.ret(x + 22, y + 1, 5, 3), RUBI)
  p.carimbo(x + 23, y + 1, ['w.w', '.w.', 'w.w'], { w: '#ffffff' })
  // o triângulo de aviso
  p.forma(p.poli([x + 8, y + 7], [x + 13, y + 16], [x + 3, y + 16]), ['#8a5a00', '#d8a020', '#ffe14a', '#fff6b0'])
  p.carimbo(x + 8, y + 9, ['k', 'k', 'k', '.', 'k'], { k: '#1a1020' })
  p.px(x + 7, y + 10, '#1a1020')
  // as linhas de texto e o botão
  for (const [ly, w] of [[y + 9, 10], [y + 12, 8], [y + 15, 11]]) p.linha(x + 15, ly, x + 15 + w - 1, ly, '#6a6a98')
  p.forma(p.ret(x + 9, y + 18, 11, 4), CIANO)
  p.carimbo(x + 11, y + 19, ['ww.w.w', 'ww.ww.'], { w: '#0a2a3a' })
  // o cursor que vem clicar
  const [cx, cy] = [[x + 22, y + 17], [x + 20, y + 19], [x + 17, y + 20]][q]
  p.carimbo(cx, cy, ['k....', 'kwk..', 'kwwk.', 'kwwwk', 'kwkk.', 'k.kw.'], { k: '#10102a', w: '#ffffff' })
  p.contorno('#0a0820')
  // os brilhos digitais (soltos)
  for (const [bx, by] of [[[28, 18], [64, 52]], [[64, 16], [27, 54]], [[30, 50], [62, 22]]][q]) p.carimbo(bx - 1, by - 1, ['.b.', 'bwb', '.b.'], { b: ROSA[3], w: '#ffffff' })
  return p.grade
}

// O FIREWALL (tenente): o muro de tijolos em chamas, num gabinete de prata, com a cara de monitor brava
function queenFirewall(q) {
  const p = pintor(60, ALTURA, { dx: 3 })
  const FOGO = ['#8a1a08', '#e04a10', '#ff9a1c', '#ffe14a']
  const TIJOLO = ['#4a1410', '#8f2a22', '#c2382b', '#ec6a4a']
  // as chamas por trás (sobem e descem entre os quadros)
  const altas = [[12, 16, 10, 14, 9], [14, 10, 16, 9, 12], [9, 14, 12, 16, 10]][q]
  const chamas = altas.map((h, i) => {
    const cx = 9 + i * 9
    return p.poli([cx - 6, 24], [cx - 3, 24 - h * 0.55], [cx - 1 + (i % 2 ? 1 : -1), 24 - h], [cx + 2, 24 - h * 0.5], [cx + 5, 24])
  })
  p.forma(p.uniao(...chamas), FOGO, 'bola')
  for (const [i, h] of altas.entries()) {
    const cx = 9 + i * 9
    p.forma(p.poli([cx - 3, 24], [cx - 1, 24 - h * 0.45], [cx + 2, 24]), [FOGO[2], FOGO[2], FOGO[3], '#ffffff'], 'bola')
  }
  // os bracinhos de cabo, com os punhos de prata (um levanta)
  const punho = [[2, 44], [2, 42], [2, 45]][q]
  p.forma(p.tubo([[6, 36], [2, 38], punho], 1.4), ['#141428', '#20203a', '#2e2e4e', '#46466a'])
  p.forma(p.tubo([[48, 36], [52, 38], [52, 44]], 1.4), ['#141428', '#20203a', '#2e2e4e', '#46466a'])
  p.forma(p.elipse(punho[0] + 0.5, punho[1] + 1.5, 2.4, 2.4), PRATA, 'bola')
  p.forma(p.elipse(52.5, 45.5, 2.4, 2.4), PRATA, 'bola')
  // o gabinete de prata
  p.forma(p.ret(5, 20, 44, 42), PRATA)
  // o muro: argamassa e tijolos desencontrados
  p.preencher(p.ret(6, 22, 42, 38), '#3a2a30')
  for (let y = 22, i = 0; y < 60; y += 4, i++)
    for (let x = 6 - (i % 2) * 4; x < 48; x += 8) {
      const t = p.e(p.ret(x, y, 7, 3), p.ret(6, 22, 42, 38))
      p.forma(t, TIJOLO)
    }
  // a tela no meio do muro, com a cara brava
  p.forma(p.ret(13, 28, 28, 18), PRATA)
  p.preencher(p.ret(15, 30, 24, 14), TELA)
  for (let y = 31; y < 44; y += 2) p.linha(15, y, 38, y, '#0f1a40')
  p.carimbo(15, 30, ['ww', 'w.'], { w: '#3a4a80' })
  const brilho = ['cCwC', 'cwCC', 'cCCw'][q]
  p.carimbo(17, 32, ['c.......', '.cc.....', '.' + brilho + 'c..', '..cccc..'], { c: CIANO[2], C: CIANO[0], w: '#ffffff' })
  p.carimbo(29, 32, ['.......c', '.....cc.', '..c' + [...brilho].reverse().join('') + '.', '..cccc..'], { c: CIANO[2], C: CIANO[0], w: '#ffffff' })
  // a boca em zigue-zague
  p.carimbo(19, 38, ['m.m.m.m.m.m.m.m', '.m.m.m.m.m.m.m.'], { m: ROSA[2] })
  p.px(36, 42, ROSA[3]) // o LED de ligado
  // o cadeado de ouro embaixo
  p.forma(p.tubo([[24, 51], [24, 48], [30, 48], [30, 51]], 1.1), CROMO)
  p.forma(p.ret(22, 50, 11, 8), OURO)
  p.carimbo(26, 52, ['kk', 'kk', '.k'], { k: '#3a2408' })
  // as luzinhas do gabinete
  ;[[8, 24], [45, 24], [8, 57], [45, 57]].forEach(([x, y], i) => p.px(x, y, (i + q) % 3 === 0 ? '#ffffff' : CIANO[2]))
  // os pés
  for (const x of [9, 39]) p.forma(p.ret(x, 62, 6, 4), PRATA)
  p.contorno('#0a0820')
  // as fagulhas que voam (soltas)
  for (const [fx, fy] of [[[4, 9], [47, 12], [27, 7]], [[45, 8], [9, 12], [31, 10]], [[19, 7], [49, 10], [3, 13]]][q]) p.carimbo(fx, fy, ['y', 'o'], { y: FOGO[3], o: FOGO[1] })
  return p.grade
}

// ================= JEVIL =================

// a carta viva: o naipe grande, a carinha brava, braços finos e os sapatos de bico enrolado
function cartaViva(p, x, dy, naipe, aceno) {
  const y = dy
  // as pernas violeta e os sapatos de ouro
  p.forma(p.tubo([[x - 4, 55 + y], [x - 5, 61 + y]], 1.4), VIOLETA)
  p.forma(p.tubo([[x + 4, 55 + y], [x + 5, 61 + y]], 1.4), VIOLETA)
  p.forma(p.tubo([[x - 5, 63 + y], [x - 9, 63 + y], [x - 10, 61 + y]], 1.5, 0.8), OURO)
  p.forma(p.tubo([[x + 5, 63 + y], [x + 9, 63 + y], [x + 10, 61 + y]], 1.5, 0.8), OURO)
  // os braços (um acena)
  p.forma(p.tubo([[x - 9, 44 + y], [x - 13, 49 + y]], 1), VIOLETA)
  p.forma(p.elipse(x - 13.5, 50 + y, 1.9, 1.8), LUVA, 'bola')
  const mao = [[x + 14, 37], [x + 14, 40], [x + 13, 35]][aceno]
  p.forma(p.tubo([[x + 9, 44 + y], [mao[0], mao[1] + y]], 1), VIOLETA)
  p.forma(p.elipse(mao[0] + 0.5, mao[1] - 1 + y, 1.9, 1.8), LUVA, 'bola')
  // a carta
  const carta = p.menos(p.ret(x - 10, 30 + y, 20, 26), p.ret(x - 10, 30 + y, 1, 1), p.ret(x + 9, 30 + y, 1, 1), p.ret(x - 10, 55 + y, 1, 1), p.ret(x + 9, 55 + y, 1, 1))
  p.forma(carta, LUVA, 'bisel', { luz: false })
  p.preencher(p.menos(p.ret(x - 8, 32 + y, 16, 22), p.ret(x - 7, 33 + y, 14, 20)), VIOLETA[3])
  // o naipe grande
  const cor = naipe === 'copas' ? RUBI : ['#0e0a1c', '#1c1636', '#2a2347', '#5a4e86']
  const sinal =
    naipe === 'copas'
      ? p.uniao(p.elipse(x - 3, 37 + y, 3.4, 3.2), p.elipse(x + 3, 37 + y, 3.4, 3.2), p.poli([x - 6.4, 38 + y], [x + 6.4, 38 + y], [x, 45 + y]))
      : p.uniao(p.poli([x, 33 + y], [x + 6.4, 40 + y], [x - 6.4, 40 + y]), p.elipse(x - 3, 40.5 + y, 3.3, 3), p.elipse(x + 3, 40.5 + y, 3.3, 3), p.poli([x - 1, 42 + y], [x + 1, 42 + y], [x + 3, 46 + y], [x - 3, 46 + y]))
  p.forma(sinal, cor, 'bola')
  // as letras do canto
  const letra = naipe === 'copas' ? RUBI[2] : '#2a2347'
  p.carimbo(x - 8, 32 + y, ['.l.', 'l.l', 'lll'], { l: letra })
  p.carimbo(x + 5, 50 + y, ['lll', 'l.l', '.l.'], { l: letra })
  // a carinha brava
  p.carimbo(x - 4, 48 + y, ['k....k', '.kk.k.', '.kk.k.'], { k: '#14081e' })
  p.carimbo(x - 2, 51 + y, ['kkkk'], { k: '#14081e' })
}

// o palhacinho que faz malabares: chapéu de bico com pompom, nariz vermelho e roupa de arlequim
function palhaco(p, x, q) {
  const xadrez = (px, py) => ((Math.floor((px + py) / 3) + Math.floor((px - py + 100) / 3)) % 2 ? VIOLETA : PETROLEO)
  // as pernas e os sapatos enrolados
  p.forma(p.tubo([[x - 3, 54], [x - 5, 60]], 2), OURO)
  p.forma(p.tubo([[x + 3, 54], [x + 5, 60]], 2), VIOLETA)
  p.forma(p.tubo([[x - 5, 62], [x - 10, 63], [x - 11, 60]], 1.8, 0.8), VIOLETA)
  p.forma(p.tubo([[x + 5, 62], [x + 10, 63], [x + 11, 60]], 1.8, 0.8), OURO)
  // o corpo em xadrez e o cinto
  p.forma(p.poli([x - 7, 42], [x + 7, 42], [x + 8, 56], [x - 8, 56]), xadrez)
  p.forma(p.ret(x - 7, 52, 14, 2), OURO)
  // os braços para cima (malabares)
  const maos = [[[x - 11, 36], [x + 11, 38]], [[x - 11, 38], [x + 11, 36]], [[x - 12, 37], [x + 12, 37]]][q]
  p.forma(p.tubo([[x - 6, 44], [x - 10, 41], maos[0]], 1.6), VIOLETA)
  p.forma(p.tubo([[x + 6, 44], [x + 10, 41], maos[1]], 1.6), OURO)
  for (const [mx, my] of maos) p.forma(p.elipse(mx + 0.5, my, 2, 1.9), LUVA, 'bola')
  // a gola de babados
  for (let bx = x - 7, i = 0; bx <= x + 7; bx += 3.5, i++) p.forma(p.elipse(bx, 42, 2.2, 2), i % 2 ? OURO : VIOLETA, 'bola')
  // a cabeça: a máscara, os losangos nos olhos, o nariz vermelho e o sorrisão
  p.forma(p.elipse(x, 35, 7, 5.6), MASCARA, 'bola')
  p.carimbo(x - 5, 32, ['.k...k.', 'kyk.kyk', '.k...k.'], { k: '#14081e', y: '#ffd400' })
  p.carimbo(x + 1, 32, ['.k.', 'kyk', '.k.'], { k: '#14081e', y: '#ffd400' })
  p.forma(p.elipse(x - 0.5, 36, 1.6, 1.4), RUBI, 'bola')
  p.carimbo(x - 4, 37, ['k.......', '.kwkwkwk', '..kkkkk.'], { k: '#14081e', w: '#ffffff' })
  // o chapéu de bico (metade violeta, metade ouro) e o pompom que balança
  const balanca = [0, 1, -1][q]
  p.forma(p.poli([x - 7, 31], [x, 31], [x + 1 + balanca, 20]), VIOLETA)
  p.forma(p.poli([x, 31], [x + 7, 31], [x + 1 + balanca, 20]), OURO)
  p.forma(p.ret(x - 7, 29, 14, 2), RUBI)
  p.forma(p.elipse(x + 1.5 + balanca, 19, 2, 2), RUBI, 'bola')
  // as bolinhas de malabares girando em arco
  const bolas = [[[x - 9, 27], [x, 22], [x + 9, 29]], [[x - 6, 23], [x + 6, 22], [x + 11, 32]], [[x - 11, 31], [x - 3, 22], [x + 8, 24]]][q]
  const cores = [RUBI, OURO, PETROLEO]
  bolas.forEach(([bx, by], i) => p.forma(p.elipse(bx + 0.5, by + 0.5, 2, 2), cores[i], 'bola'))
}

// LACAIOS DO JEVIL: duas cartas vivas (espadas e copas) e o palhacinho malabarista no meio
function jevilLacaios(q) {
  const p = pintor(96, ALTURA, { dx: 2 })
  cartaViva(p, 17, [0, -1, 0][q], 'espadas', q)
  palhaco(p, 46, q)
  cartaViva(p, 75, [-1, 0, 0][q], 'copas', (q + 1) % 3)
  p.contorno('#0e0618')
  return p.grade
}

// O MESTRE DE PICADEIRO (tenente): cartola, monóculo, bigodão enrolado, casaca vermelha com alamares e o chicote
function jevilMestre(q) {
  const p = pintor(56, ALTURA)
  const CARTOLA = ['#08060e', '#16101e', '#2a2236', '#4a3e5e']
  const CASACA = ['#4a0c14', '#8a1a24', '#d8342c', '#ff7a6a']
  const BIGODE = ['#1a0e08', '#3a2010', '#5a3418', '#8a5a2c']
  // as abas da casaca (balançam) por trás das pernas
  const aba = [0, 1, -1][q]
  p.forma(p.poli([18, 44], [38, 44], [41 + aba, 58], [35 + aba, 56], [28, 50], [21 + aba, 56], [15 + aba, 58]), CASACA)
  // as pernas de calça listrada e as botas
  const listras = (x) => (Math.floor(x / 2) % 2 ? VIOLETA : CARTOLA)
  p.forma(p.ret(21, 48, 6, 13), listras)
  p.forma(p.ret(30, 48, 6, 13), listras)
  for (const x of [19, 29]) {
    p.forma(p.uniao(p.ret(x + 1, 59, 7, 5), p.elipse(x + 3, 64, 5, 2)), CARTOLA, 'bola')
    p.px(x + 4, 61, OURO[2])
  }
  // o tronco: a casaca com a lapela violeta, os alamares de ouro e o colete
  p.forma(p.poli([18, 32], [38, 32], [39, 49], [17, 49]), CASACA)
  p.forma(p.poli([24, 32], [32, 32], [31, 46], [25, 46]), LUVA, 'bisel', { luz: false })
  p.forma(p.poli([18, 32], [24, 32], [26, 42], [21, 40]), VIOLETA)
  p.forma(p.poli([38, 32], [32, 32], [30, 42], [35, 40]), VIOLETA)
  for (let y = 38; y <= 46; y += 3) {
    p.linha(20, y, 25, y, OURO[2])
    p.linha(31, y, 36, y, OURO[2])
    p.px(28, y, OURO[3])
  }
  // a gravata-borboleta
  p.carimbo(25, 32, ['rr.rr', 'rrRrr', 'rr.rr'], { r: RUBI[2], R: RUBI[3] })
  // as dragonas de ouro
  for (const x of [18, 38]) p.forma(p.elipse(x, 33, 3.4, 2.2), OURO, 'bola')
  // o braço direito (da tela) apresentando, com a mão aberta
  p.forma(p.tubo([[38, 34], [44, 38], [49, 36]], 2.4, 2), CASACA)
  p.forma(p.uniao(p.elipse(50.5, 35, 2.6, 2), p.tubo([[51, 34], [53, 32]], 0.9)), LUVA, 'bola')
  // o braço esquerdo erguido com o chicote
  p.forma(p.tubo([[18, 34], [12, 32], [10, 26]], 2.4, 2), CASACA)
  p.forma(p.elipse(10, 24.5, 2.4, 2.2), LUVA, 'bola')
  p.forma(p.tubo([[10, 26], [9, 18]], 1), ['#4a2a10', '#7a4a1c', '#a8742c', '#d8a860'])
  // a cabeça: o rosto pálido, o monóculo de ouro, o bigodão e o sorriso
  p.forma(p.elipse(28, 25, 8.5, 7), MASCARA, 'bola')
  p.carimbo(22, 22, ['kk.', '.kk', '.k.'], { k: '#14081e' })
  const lente = ['#ffffff', '#c8e4ff', '#ffffff'][q]
  p.carimbo(30, 21, ['.gg.', 'gkLg', 'g..g', '.gg.', '...g', '...g'], { g: OURO[2], k: '#14081e', L: lente })
  p.forma(p.uniao(p.tubo([[28, 27.5], [24.5, 28.5], [21.5, 27.5], [20.5, 25.5]], 1.3, 0.6), p.tubo([[28, 27.5], [31.5, 28.5], [34.5, 27.5], [35.5, 25.5]], 1.3, 0.6)), BIGODE, 'bola')
  p.carimbo(25, 30, ['kwwwk', '.kkk.'], { k: '#14081e', w: '#ffffff' })
  // a cartola com a fita vermelha e o losango do caos
  p.forma(p.elipse(28, 18.5, 12, 2.2), CARTOLA, 'bola')
  p.forma(p.ret(20, 4, 16, 14), CARTOLA)
  p.forma(p.elipse(28, 4.5, 8, 1.6), CARTOLA, 'bola')
  p.forma(p.ret(20, 13, 16, 3), RUBI)
  p.forma(p.poli([28, 12], [30.5, 14.5], [28, 17], [25.5, 14.5]), OURO, 'bola')
  p.contorno('#0e0618')
  // a tira do chicote estalando no ar (depois do contorno: linha fina e escura com a ponta clara)
  const tiras = [
    [[9, 18], [6, 12], [8, 6], [14, 3], [17, 6]],
    [[9, 18], [5, 13], [4, 7], [8, 2], [13, 1]],
    [[9, 18], [7, 11], [11, 6], [16, 7], [16, 11]],
  ][q]
  for (let i = 1; i < tiras.length; i++) p.linha(...tiras[i - 1], ...tiras[i], '#3a2010')
  p.px(...tiras.at(-1), '#fff2a0')
  // o estalo
  if (q === 0) p.carimbo(17, 4, ['y.y', '.w.', 'y.y'], { y: OURO[2], w: '#ffffff' })
  return p.grade
}

// ================= CORONEL CAÇAMBA =================

// o guaxinim com o colete refletivo da turma; `lado` 1 olha para a direita, -1 para a esquerda
function guaxinim(p, x, lado, q, pisca) {
  const PELO = ['#2e3038', '#5f6572', '#8f96a3', '#c4cad4']
  const CREME = ['#6a6658', '#a8a290', '#d8d0b0', '#f2ecd8']
  const MASCARA_G = ['#08080c', '#15151c', '#23232e', '#3a3a48']
  const s = -lado // o rabo fica do lado de fora
  // o rabo listrado (balança)
  const ponta = [[x + s * 13, 44], [x + s * 14, 46], [x + s * 12, 42]][q]
  const rabo = p.tubo([[x + s * 5, 60], [x + s * 11, 57], [x + s * 13, 51], ponta], 2.6, 3.4)
  p.forma(rabo, PELO)
  const aneis = p.e(rabo, p.uniao(...[45, 50, 55].map((y) => p.ret(0, y + [0, 1, -1][q], 92, 2))))
  p.forma(aneis, MASCARA_G, 'bola')
  // os pés
  for (const k of [-1, 1]) p.forma(p.elipse(x + k * 3.5, 63, 3, 1.8), MASCARA_G, 'bola')
  // o corpo, a barriga creme e o colete laranja com a faixa refletiva
  p.forma(p.elipse(x, 54, 8, 8.5), PELO, 'bola')
  p.forma(p.elipse(x, 56, 4.5, 5.5), CREME, 'bola')
  const colete = p.menos(p.e(p.elipse(x, 54, 8, 8.5), p.ret(0, 47, 92, 10)), p.ret(x - 3, 47, 6, 10))
  p.forma(colete, LARANJA)
  p.linha(x - 8, 52, x - 4, 52, '#f2f2c8')
  p.linha(x + 3, 52, x + 7, 52, '#f2f2c8')
  // as patinhas na frente (seguram uma latinha)
  p.forma(p.ret(x - 2 + lado * 2, 52, 5, 6), CROMO)
  p.linha(x - 2 + lado * 2, 54, x + 2 + lado * 2, 54, RUBI[2])
  for (const k of [-1, 1]) p.forma(p.elipse(x + lado * 2 + k * 3, 55, 1.8, 1.6), MASCARA_G, 'bola')
  // a cabeça: orelhas, a máscara preta com as sobrancelhas brancas, os olhos e o focinho
  const orelha = [0, 0, 1][q]
  for (const k of [-1, 1]) {
    p.forma(p.elipse(x + k * 6, 35 - (k === lado ? orelha : 0), 2.6, 2.6), PELO, 'bola')
    p.px(x + k * 6, 35 - (k === lado ? orelha : 0), '#e89aa0')
  }
  p.forma(p.elipse(x, 42, 9, 6.5), PELO, 'bola')
  p.forma(p.uniao(p.elipse(x - 4, 41.5, 4, 2.2), p.elipse(x + 4, 41.5, 4, 2.2)), MASCARA_G, 'bola')
  p.linha(x - 7, 38, x - 2, 39, CREME[3])
  p.linha(x + 1, 39, x + 6, 38, CREME[3])
  if (pisca) {
    p.linha(x - 5, 42, x - 3, 42, '#f2f2f2')
    p.linha(x + 2, 42, x + 4, 42, '#f2f2f2')
  } else {
    p.carimbo(x - 5, 41, ['ww', 'we'], { w: '#f2f2f2', e: '#f05a5a' })
    p.carimbo(x + 2, 41, ['ww', 'ew'], { w: '#f2f2f2', e: '#f05a5a' })
  }
  p.forma(p.elipse(x + lado * 0.5, 45.5, 3.4, 2.2), CREME, 'bola')
  p.forma(p.elipse(x + lado * 1, 44.5, 1.3, 1), MASCARA_G, 'bola')
  p.carimbo(x - 1 + lado, 47, ['k.k', '.k.'], { k: '#15151c' })
}

// o saco de lixo bravo: plástico preto brilhando, o arame amarelo, o rasgo com a espinha de peixe e as moscas
function sacoDeLixo(p, x, q) {
  const SACO = ['#0c0c12', '#1c1c26', '#30303e', '#5a5a70']
  const respira = [0, 0.6, -0.4][q]
  const corpo = p.uniao(p.elipse(x, 52, 14 + respira, 12.5 + respira * 0.5), p.poli([x - 6, 38], [x + 6, 38], [x + 12, 46], [x - 12, 46]))
  p.forma(corpo, SACO, 'bola')
  // as orelhas do nó e o arame
  p.forma(p.uniao(p.poli([x - 1, 37], [x - 7, 28], [x - 3, 30], [x - 2, 27], [x + 1, 33]), p.poli([x + 1, 37], [x + 7, 29], [x + 3, 31], [x + 3, 27], [x - 1, 33])), SACO)
  p.forma(p.ret(x - 3, 35, 6, 3), ['#8a6a10', '#c8a020', '#ffe14a', '#fff6b0'])
  // os vincos e os reflexos do plástico
  p.linha(x - 8, 44, x - 10, 54, SACO[0])
  p.linha(x + 6, 43, x + 9, 55, SACO[0])
  p.linha(x - 7, 43, x - 9, 50, '#8a8aa8')
  p.linha(x - 9, 52, x - 9, 54, '#8a8aa8')
  p.px(x + 10, 47, '#8a8aa8')
  // os olhos vermelhos bravos e a boca de rasgo com os dentes
  p.carimbo(x - 7, 45, ['kk.......kk', '.eee...eee.', '.eWe...eWe.', '..e.....e..'], { k: '#050508', e: '#f05a5a', W: '#ffe0e0' })
  p.carimbo(x - 6, 51, ['k.k.k.k.k.k.k', 'kwkwkwkwkwkwk', '.kkkkkkkkkkk.'], { k: '#050508', w: '#e9ecf2' })
  // o rasgo do lado com a espinha de peixe saindo
  p.preencher(p.elipse(x + 9, 58, 2.6, 1.8), '#050508')
  p.linha(x + 10, 58, x + 15, 56, '#e9ecf2')
  for (const k of [11, 13]) {
    p.px(x + k, 56, '#e9ecf2')
    p.px(x + k, 58, '#e9ecf2')
  }
  p.carimbo(x + 15, 55, ['.w', 'ww', '.w'], { w: '#e9ecf2' })
}

// LACAIOS DO CORONEL: dois guaxinins de colete refletivo e o saco de lixo bravo no meio
function coronelLacaios(q) {
  const p = pintor(96, ALTURA, { dx: 2 })
  sacoDeLixo(p, 46, q)
  guaxinim(p, 18, 1, q, q === 2)
  guaxinim(p, 74, -1, (q + 1) % 3, q === 1)
  p.contorno('#0c0c14')
  // as moscas do lixo (soltas, depois do contorno)
  for (const [mx, my] of [[[38, 24], [55, 30]], [[41, 21], [52, 26]], [[36, 28], [57, 23]]][q]) p.carimbo(mx, my, ['w.w', '.k.'], { w: '#c8e4ff', k: '#101018' })
  return p.grade
}

// O CAMINHÃO COMPACTADOR (tenente): de frente, os faróis de olhos bravos, a grade de dentes e o compactador atrás
function caminhaoCompactador(q) {
  const p = pintor(54, ALTURA)
  const VIDRO = ['#1a3050', '#2c5a8a', '#5aa0d8', '#c8ecff']
  const GIRO = ['#8a3a00', '#e07a00', '#ffb020', '#fff0a0']
  const APAGADO = ['#3a2008', '#5a3410', '#7a4a18', '#9a6a30']
  // o compactador atrás da cabine: aço com nervuras e os pistões (sobem e descem)
  p.forma(p.ret(8, 16, 38, 15), ACO, 'bisel', { luz: false })
  for (const x of [13, 19, 25, 31, 37]) {
    p.linha(x, 18, x, 29, ACO[1])
    p.linha(x + 1, 18, x + 1, 29, ACO[3])
  }
  const sobe = [0, 1, 0][q]
  for (const x of [5, 46]) {
    p.forma(p.ret(x, 18 + sobe, 3, 13 - sobe), CROMO)
    p.forma(p.ret(x - 1, 16 + sobe, 5, 3), ACO)
  }
  // os giroflex nos cantos (alternam)
  p.forma(p.elipse(11, 14.5, 3, 2.4), q === 1 ? APAGADO : GIRO, 'bola')
  p.forma(p.elipse(43, 14.5, 3, 2.4), q === 2 ? APAGADO : GIRO, 'bola')
  // a cabine laranja
  const cabine = p.menos(p.ret(7, 29, 40, 23), p.ret(7, 29, 1, 1), p.ret(46, 29, 1, 1))
  p.forma(cabine, LARANJA)
  // o para-brisa com a viseira brava e o reflexo
  p.forma(p.poli([10, 31], [44, 31], [42, 38], [12, 38]), VIDRO, 'bisel', { luz: false })
  p.forma(p.poli([10, 31], [44, 31], [44, 33], [27, 35], [10, 33]), ['#05050a', '#101018', '#1e1e28', '#3a3a48'])
  p.linha(14, 37, 18, 34, VIDRO[3])
  p.linha(16, 37, 19, 35, VIDRO[2])
  // os retrovisores
  for (const [a, b] of [[[7, 33], [3, 31]], [[46, 33], [50, 31]]]) {
    p.forma(p.tubo([a, b], 0.8), CROMO)
    p.forma(p.ret(b[0] - 1, 29, 3, 6), PNEU)
  }
  // os faróis: os olhos, com a pálpebra brava da lataria
  const luz = q === 1 ? ['#a08a20', '#d8c040', '#fff27a', '#ffffff'] : ['#d8a020', '#ffe14a', '#fff6b0', '#ffffff']
  for (const [cx, k] of [[14, 1], [40, -1]]) {
    p.forma(p.elipse(cx, 44.5, 4.6, 3.8), luz, 'bola')
    p.forma(p.poli([cx - 5, 40], [cx + 5, 40], [cx + 5 * k, 43.5], [cx - 5 * k, 40]), LARANJA, 'bisel', { luz: false })
    p.carimbo(cx - 1, 44, ['kk', 'kk'], { k: '#2a1408' })
  }
  // a grade: a boca de dentes de cromo
  p.preencher(p.ret(21, 40, 12, 10), '#0a0a10')
  for (let x = 21; x < 33; x += 3) {
    p.forma(p.poli([x, 40], [x + 3, 40], [x + 1.5, 44]), CROMO)
    p.forma(p.poli([x, 50], [x + 3, 50], [x + 1.5, 46]), CROMO)
  }
  // a estrela do coronel em cima da grade
  const estrela = []
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2
    const r = i % 2 ? 1.4 : 3.2
    estrela.push([27 + Math.cos(a) * r, 37.5 + Math.sin(a) * r])
  }
  p.forma(p.poli(...estrela), OURO, 'bola')
  // o para-choque com as pontas zebradas
  const choque = p.ret(4, 51, 46, 5)
  p.forma(choque, CROMO)
  for (const x0 of [4, 42]) {
    p.forma(p.e(choque, p.ret(x0, 51, 8, 5)), LARANJA, 'bisel', { luz: false })
    for (let x = x0; x < x0 + 8; x += 4) {
      p.linha(x, 55, x + 2, 51, '#1a1a22')
      p.linha(x + 1, 55, x + 3, 51, '#1a1a22')
    }
  }
  // as rodas (de frente) com a banda de rodagem (gira)
  for (const x of [7, 38]) {
    p.forma(p.uniao(p.ret(x, 55, 9, 10), p.elipse(x + 4.5, 64.5, 4.5, 1.6)), PNEU)
    for (let y = 57 + (q % 2); y < 65; y += 2) p.linha(x + 1, y, x + 7, y, PNEU[3])
  }
  p.contorno('#0c0c14')
  // a fumaça do escapamento (some e volta)
  const FUMACA = ['#3a3a44', '#5a5a66', '#8a8a96', '#b8b8c4']
  for (const [fx, fy, r] of [[[49, 9, 2.2]], [[50, 6, 2.6], [47, 11, 1.6]], [[48, 4.6, 1.8], [51, 9, 2.2]]][q]) p.forma(p.elipse(fx, fy, r, r * 0.9), FUMACA, 'bola')
  return p.grade
}

export const EXPEDICAO = {
  'king-lacaios': kingLacaios,
  'king-cavaleiro': kingCavaleiro,
  'queen-lacaios': queenLacaios,
  'queen-firewall': queenFirewall,
  'jevil-lacaios': jevilLacaios,
  'jevil-mestre': jevilMestre,
  lacaios: coronelLacaios,
  caminhaoCompactador,
  // EXPEDIÇÃO SEMANAL (arte/semanais.js): os da Escuridão e os da Ladra
  ...SEMANAIS_EXPEDICAO,
}
