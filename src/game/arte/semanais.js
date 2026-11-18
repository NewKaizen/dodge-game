// Os BOSSES SEMANAIS (docs/boss-semanal.md) em pixel art de DENSIDADE 2, como os chefões do CO-OP (arte/chefoes.js):
// o dobro de pixels, desenhados na metade da escala (texturas.js: DENSIDADE e escalaDe). Arte original, feita com
// o pintor de formas (arte/pintor.js): rampas de 4 tons, contorno escuro e brilhos. Cada um tem QUADROS_IDLE quadros
// de animação parada (o quadro 0 é a chave do chefe, os outros '<chave>-q1', '<chave>-q2').
//
//   ESCURIDÃO  a escuridão viva: um vulto de fumaça com um OLHO enorme, a boca de dentes, olhinhos espalhados pelo
//              corpo (piscam entre os quadros), braços de sombra com garras e fiapos que sobem e pingam
//   LADRA      a ladra de cartas: capuz, máscara de dominó, cachecol laranja ao vento, o leque de cartas erguido
//              numa mão e o saco do roubo (com uma moeda brilhando) na outra
import { pintor } from './pintor.js'

const ALTURA = 72

// ---------- ESCURIDÃO ----------
function escuridao(q) {
  const p = pintor(56, ALTURA, { dy: 2 })
  const CONTORNO = '#020108'
  const SOMBRA = ['#05030c', '#120c26', '#231a44', '#3c2f6e']
  const NEVOA = ['#0b0818', '#1c1538', '#2e2558', '#4a3c8a']
  const VIOLETA = ['#3a2a8a', '#6a58d0', '#8a7cff', '#d8d0ff']
  const BRANCO = ['#7a70a0', '#b8b0d8', '#e8e0ff', '#ffffff']
  const VERMELHO = '#d02a4a'
  const BRILHO = '#ff6a8a'

  // os fiapos de fumaça que sobem da cabeça (balançam entre os quadros)
  const sopro = [0, 1, -1][q]
  for (const [x0, h, lado] of [[20, 9, -1], [28, 12, 1], [35, 7, 1]]) {
    p.forma(p.tubo([[x0, 12], [x0 + lado * 2 + sopro, 12 - h * 0.5], [x0 + lado * (1 - sopro), 12 - h]], 2.4, 0.6), NEVOA)
  }

  // o corpo: o vulto que alarga até o chão e escorre em pingos (o comprimento dos pingos muda)
  const pingos = [
    [60, 64, 61, 63, 60, 64, 62],
    [62, 61, 64, 60, 63, 61, 64],
    [61, 63, 60, 64, 61, 62, 60],
  ][q]
  const base = []
  for (let i = 0; i < 7; i++) {
    const x = 7 + i * 7
    base.push([x, pingos[i]], [x + 3.5, 58])
  }
  const corpo = p.poli([28, 4], [36, 9], [40, 18], [42, 30], [46, 42], [50, 52], [52, 58], ...base.reverse(), [4, 58], [6, 52], [10, 42], [14, 30], [16, 18], [20, 9])
  p.forma(corpo, SOMBRA)
  // as dobras da fumaça (riscos claros que descem)
  for (const [x0, x1, y0] of [[18, 12, 34], [38, 44, 34], [24, 20, 44], [33, 37, 44]]) {
    p.linha(x0, y0, x1, y0 + 16, SOMBRA[2])
    p.linha(x0 + 1, y0, x1 + 1, y0 + 16, SOMBRA[0])
  }
  // o brilho roxo na borda de cima à esquerda (a luz da própria sombra)
  p.vinco(corpo, p.menos(p.ret(-5, -5, 70, 80), corpo), VIOLETA[0])

  // a cara: o oco escuro, o OLHO enorme e a boca de dentes
  p.forma(p.elipse(28, 22, 10, 11), NEVOA, 'bola')
  p.preencher(p.elipse(28, 22, 8.5, 9.5), '#030208')
  p.forma(p.elipse(28, 20, 7, 4.2), BRANCO, 'bola')
  const olhar = [0, -1, 1][q]
  p.forma(p.elipse(28 + olhar, 20, 3, 3), ['#6a0a1c', '#a01834', VERMELHO, BRILHO], 'bola')
  p.linha(28 + olhar, 18, 28 + olhar, 22, '#05030c')
  p.px(26 + olhar, 18, '#ffffff')
  // a boca: um sorriso de dentes no oco
  p.carimbo(21, 27, ['k............k', 'kwkwkwkwkwkwkk', '.kwkwkwkwkwkk.', '..kk......kk..'], { k: '#030208', w: '#e8e0ff' })

  // os braços de sombra com garras (o direito ergue um pouco a cada quadro)
  const ergue = [0, -2, -1][q]
  p.forma(p.tubo([[16, 28], [9, 34], [5, 44], [6, 51]], 3.6, 1.6), SOMBRA)
  p.forma(p.tubo([[40, 28], [47, 32 + ergue], [51, 40 + ergue], [50, 47 + ergue]], 3.6, 1.6), SOMBRA)
  for (const [x, y, dx] of [[6, 51, -1], [50, 47 + ergue, 1]]) {
    p.linha(x, y, x + dx * 3, y + 4, VIOLETA[2])
    p.linha(x, y, x, y + 5, VIOLETA[2])
    p.linha(x, y, x - dx * 2, y + 4, VIOLETA[2])
  }

  // os olhinhos espalhados pelo corpo: cada quadro pisca uns diferentes
  const olhinhos = [[16, 40], [40, 40], [22, 50], [35, 52], [11, 52], [45, 54], [28, 44]]
  olhinhos.forEach(([x, y], i) => {
    const fechado = (i + q) % 3 === 0
    if (fechado) {
      p.linha(x - 1, y, x + 1, y, VIOLETA[1])
      return
    }
    p.carimbo(x - 1, y - 1, ['.w.', 'wrw', '.w.'], { w: VIOLETA[3], r: VERMELHO })
  })

  // faíscas roxas que sobem (o breu respira)
  const faiscas = [
    [[12, 20], [44, 14], [8, 30]],
    [[46, 22], [10, 12], [42, 8]],
    [[14, 8], [48, 28], [6, 22]],
  ][q]
  for (const [x, y] of faiscas) p.px(x, y, VIOLETA[3])

  p.contorno(CONTORNO)
  return p.grade
}

// ---------- LADRA ----------
function ladra(q) {
  const p = pintor(50, ALTURA, { dy: 2 })
  const CONTORNO = '#0c0610'
  const CAPA = ['#1a0a1e', '#3a163a', '#5c2656', '#8a3e7e']
  const ROUPA = ['#120c1a', '#261e36', '#3e3256', '#62527e']
  const PELE = ['#8a5434', '#c4845a', '#eec09a', '#ffe2c4']
  const LARANJA = ['#6a2a08', '#b8501a', '#ff9a3d', '#ffd08a']
  const OURO = ['#6e3f0c', '#b07a14', '#f2c235', '#fff2a0']
  const SACO = ['#3a2614', '#664624', '#946c3e', '#c49c66']
  const CARTA = ['#8a8478', '#c8c0b0', '#fbf6ea', '#ffffff']
  const BOTA = ['#120a0a', '#2a1a16', '#46302a', '#6a4a40']

  // a capa por trás (a barra balança entre os quadros)
  const barra = [
    [[6, 62], [12, 64], [18, 62], [24, 64], [30, 62], [36, 64], [42, 61]],
    [[5, 63], [11, 61], [17, 64], [23, 62], [29, 64], [35, 62], [41, 63]],
    [[6, 61], [12, 63], [18, 64], [24, 62], [30, 63], [36, 61], [42, 63]],
  ][q]
  const capa = p.poli([16, 22], [9, 32], [6, 46], ...barra, [40, 46], [35, 32], [30, 22])
  p.forma(capa, CAPA)
  for (const [x0, x1] of [[11, 8], [36, 39]]) {
    p.linha(x0, 34, x1, 58, CAPA[1])
    p.linha(x0 + 1, 34, x1 + 1, 58, CAPA[3])
  }

  // as pernas e as botas
  p.forma(p.ret(16, 44, 6, 15), ROUPA)
  p.forma(p.ret(25, 44, 6, 15), ROUPA)
  p.forma(p.poli([14, 57], [22, 57], [23, 64], [13, 64]), BOTA)
  p.forma(p.poli([24, 57], [32, 57], [34, 64], [24, 64]), BOTA)
  p.linha(14, 58, 22, 58, BOTA[3])
  p.linha(24, 58, 32, 58, BOTA[3])

  // o corpo: a jaqueta justa, o cinto com a fivela e as bolsinhas
  p.forma(p.poli([16, 25], [31, 25], [32, 44], [15, 44]), ROUPA)
  p.linha(23, 27, 23, 41, ROUPA[0])
  p.forma(p.ret(14, 40, 19, 3), SACO)
  p.forma(p.ret(22, 39.5, 4, 4), OURO)
  p.forma(p.ret(28, 41, 4, 4), SACO)

  // o braço esquerdo, para baixo, segurando o SACO do roubo (com uma moeda espiando)
  p.forma(p.tubo([[16, 27], [11, 35], [10, 41]], 2.6, 2.2), ROUPA)
  p.forma(p.elipse(8, 51, 6.5, 7.5), SACO, 'bola')
  p.forma(p.poli([5, 44], [11, 44], [10, 41], [6, 41]), SACO)
  p.linha(5, 44, 11, 44, LARANJA[1])
  p.forma(p.elipse(10, 42, 2.4, 2.2), PELE, 'bola')
  p.forma(p.elipse(8, 46, 2.4, 2.4), OURO, 'bola')
  p.px(...[[7, 45], [9, 46], [8, 47]][q], '#ffffff')
  p.carimbo(6, 51, ['.oo.', 'o..o', '.oo.'], { o: SACO[3] })

  // o braço direito ERGUIDO com o leque de cartas
  p.forma(p.tubo([[30, 27], [36, 23], [40, 17]], 2.6, 2.2), ROUPA)
  // as cartas do leque, abertas a partir da mão (giram um pouquinho a cada quadro), cada uma com borda e naipe
  const giro = [0, 0.07, -0.06][q]
  const PIPS = {
    e: [['.k.', 'kkk', 'k.k'], '#1a1a2e'],
    c: [['r.r', 'rrr', '.r.'], '#c8283a'],
    p: [['.k.', 'k.k', '.k.'], '#1a1a2e'],
    o: [['.r.', 'r.r', '.r.'], '#c8283a'],
  }
  ;['e', 'c', 'p', 'o'].forEach((naipe, k) => {
    const ang = -0.75 + k * 0.5 + giro // 0 = para cima
    const ux = Math.sin(ang)
    const uy = -Math.cos(ang)
    const cx = 40 + ux * 8
    const cy = 17 + uy * 8
    const w = 3.6
    const h = 5.6
    // os cantos da carta (o eixo comprido aponta para fora da mão)
    const canto = (sx, sy) => [cx - uy * w * sx + ux * h * sy, cy + ux * w * sx + uy * h * sy]
    const m = p.poli(canto(-1, -1), canto(1, -1), canto(1, 1), canto(-1, 1))
    p.forma(m, CARTA, 'bisel', { luz: false })
    // a borda (separa uma carta da outra)
    const cs = [canto(-1, -1), canto(1, -1), canto(1, 1), canto(-1, 1)]
    for (let i = 0; i < 4; i++) p.linha(...cs[i], ...cs[(i + 1) % 4], '#5a4a46')
    const [mapa, cor] = PIPS[naipe]
    const fx = cx + ux * 1.5
    const fy = cy + uy * 1.5
    p.carimbo(Math.round(fx) - 1, Math.round(fy) - 1, mapa, { k: cor, r: cor })
  })
  p.forma(p.elipse(40, 18.5, 2.8, 2.6), PELE, 'bola')

  // o cachecol laranja, com a ponta voando para trás
  const vento = [0, 1, -1][q]
  p.forma(p.tubo([[17, 25], [10, 27 + vento], [4, 24 + vento * 2]], 2.6, 1.2), LARANJA)
  p.forma(p.poli([15, 22], [31, 22], [30, 27], [16, 27]), LARANJA)
  p.linha(17, 25, 29, 25, LARANJA[1])

  // a cabeça: o capuz, o rosto, a MÁSCARA DE DOMINÓ e o sorrisinho
  p.forma(p.poli([23, 2], [31, 6], [34, 14], [31, 22], [15, 22], [12, 14], [15, 6]), CAPA)
  p.forma(p.elipse(23, 15, 6.8, 6.4), PELE, 'bola')
  p.preencher(p.poli([13, 11], [33, 11], [32, 15], [25, 16], [23, 14], [21, 16], [14, 15]), '#16101e')
  const pisca = q === 2
  p.carimbo(17, 12, pisca ? ['.....', 'wwww.'] : ['.ww..', 'wkkw.'], { w: '#f4f4ff', k: '#3a2a50' })
  p.carimbo(25, 12, pisca ? ['.....', '.wwww'] : ['..ww.', '.wkkw'], { w: '#f4f4ff', k: '#3a2a50' })
  p.carimbo(20, 18, ['r....r', '.rrrr.'], { r: '#a02a3a' })
  // a beirada do capuz (sombra no rosto)
  p.linha(16, 9, 30, 9, CAPA[1])
  p.linha(15, 10, 31, 10, CAPA[2])

  p.contorno(CONTORNO)
  return p.grade
}

export const SEMANAIS_ARTE = { escuridao, ladra }

// ---------- EXPEDIÇÃO SEMANAL: os lacaios e os tenentes (arte/expedicao.js EXPEDICAO junta estes) ----------
// Mesmas regras dos da Expedição: 72 linhas, o chão na linha ~66; o grupo de lacaios cabe em 96 de largura e fica
// mais baixo que o tenente (até 60 de largura), que fica mais baixo que o chefão.

// uma sombrinha: a gota de breu com olhos brilhando, que balança (dy) e pisca
function sombrinha(p, x, dy, pisca, olho) {
  const SOMBRA = ['#05030c', '#140e2a', '#261c4a', '#40347a']
  const corpo = p.uniao(p.elipse(x, 54 + dy, 9, 9), p.poli([x - 9, 54 + dy], [x - 10, 64], [x - 6, 61], [x - 3, 65], [x, 61], [x + 3, 65], [x + 6, 61], [x + 10, 64], [x + 9, 54 + dy]))
  p.forma(corpo, SOMBRA, 'bola')
  // o topete de fumaça
  p.forma(p.tubo([[x, 46 + dy], [x + 2, 41 + dy], [x - 1, 37 + dy]], 2.4, 0.8), SOMBRA)
  if (pisca) {
    p.linha(x - 5, 52 + dy, x - 2, 52 + dy, olho)
    p.linha(x + 2, 52 + dy, x + 5, 52 + dy, olho)
  } else {
    p.carimbo(x - 5, 51 + dy, ['.ww.', 'wrrw', '.ww.'], { w: olho, r: '#ff4a6a' })
    p.carimbo(x + 2, 51 + dy, ['.ww.', 'wrrw', '.ww.'], { w: olho, r: '#ff4a6a' })
  }
  p.carimbo(x - 3, 57 + dy, ['k.k.k.k', '.k.k.k.'], { k: '#d8d0ff' })
}

// SOMBRINHAS (lacaios da Escuridão): três sombrinhas de olhos acesos soprando a vela do meio
function escuridaoLacaios(q) {
  const p = pintor(96, ALTURA, { dx: 2 })
  // a vela no meio (a chama treme e encolhe: elas estão soprando)
  const CERA = ['#8a8070', '#c8c0b0', '#f0e8d8', '#ffffff']
  p.forma(p.ret(43, 48, 7, 16), CERA)
  p.forma(p.elipse(46.5, 64, 7, 1.6), ['#3a2a8a', '#6a58d0', '#8a7cff', '#d8d0ff'], 'bola')
  p.linha(46, 44, 46, 48, '#2a2030')
  const chama = [[47, 39, 2.4, 4], [46, 40, 2, 3.4], [48, 40, 2.2, 3.6]][q]
  p.forma(p.elipse(chama[0], chama[1], chama[2], chama[3]), ['#b85a10', '#ff9a30', '#ffd27a', '#fff6c8'], 'bola')
  sombrinha(p, 13, [0, -1, 0][q], q === 1, '#d8d0ff')
  sombrinha(p, 74, [0, 0, -1][q], q === 2, '#d8d0ff')
  sombrinha(p, 32, [-1, 0, 0][q] - 6, q === 0, '#b8b0ff')
  p.contorno('#020108')
  // o fiapo de fumaça da vela (solto)
  for (const [fx, fy] of [[[47, 34], [49, 30]], [[45, 34], [47, 29]], [[48, 33], [46, 29]]][q]) p.px(fx, fy, '#8a8098')
  return p.grade
}

// O APAGA-VELAS (tenente da Escuridão): uma sombra alta e magra de cartola, com um OLHO só, segurando o apagador de
// velas (o cone na ponta da vara) e uma vela recém-apagada soltando fumaça na outra mão
function escuridaoApagaVelas(q) {
  const p = pintor(58, ALTURA, { dx: 2, dy: 1 })
  const SOMBRA = ['#05030c', '#120c26', '#231a44', '#3c2f6e']
  const LATAO = ['#5a3a10', '#9a6a20', '#d8a840', '#fff0a0']
  const VIOLETA = ['#3a2a8a', '#6a58d0', '#8a7cff', '#d8d0ff']
  const balanca = [0, 1, -1][q]
  // o manto que escorre até o chão (a barra ondula)
  const barra = [[10, 64], [15, 61], [20, 64], [25, 61], [30, 64], [35, 61], [40, 64], [45, 61]].map(([x, y], i) => [x, y + (i % 2 ? [0, 1, -1][q] : 0)])
  const manto = p.poli([22, 20], [32, 20], [38, 34], [44, 50], [46, 62], ...barra.reverse(), [8, 62], [12, 48], [16, 34])
  p.forma(manto, SOMBRA)
  p.vinco(manto, p.menos(p.ret(-5, -5, 70, 80), manto), VIOLETA[0])
  for (const [x0, x1] of [[20, 14], [34, 40]]) {
    p.linha(x0, 30, x1, 58, SOMBRA[2])
    p.linha(x0 + 1, 30, x1 + 1, 58, SOMBRA[0])
  }
  // a cabeça e a cartola
  p.forma(p.elipse(27, 15, 7, 7.5), SOMBRA, 'bola')
  p.forma(p.ret(19, 7, 16, 2.5), SOMBRA)
  p.forma(p.ret(21.5, 1, 11, 7), SOMBRA)
  p.linha(22, 5, 32, 5, VIOLETA[1])
  // o olho só
  p.forma(p.elipse(27, 15, 3.6, 2.6), ['#7a70a0', '#b8b0d8', '#e8e0ff', '#ffffff'], 'bola')
  p.forma(p.elipse(27 + balanca * 0.6, 15, 1.6, 1.8), ['#6a0a1c', '#a01834', '#d02a4a', '#ff6a8a'], 'bola')
  p.carimbo(23, 19, ['kwkwkwk'], { k: '#030208', w: '#e8e0ff' })
  // o braço direito com a vara do apagador (balança) e o cone de latão na ponta
  const topo = [48 + balanca, 6]
  p.forma(p.tubo([[34, 24], [41, 30], [44, 34]], 2.6, 2), SOMBRA)
  p.linha(44, 36, topo[0], topo[1] + 6, LATAO[1])
  p.linha(45, 36, topo[0] + 1, topo[1] + 6, LATAO[3])
  p.forma(p.poli([topo[0] - 4, topo[1] + 7], [topo[0] + 5, topo[1] + 7], [topo[0] + 0.5, topo[1] - 1]), LATAO)
  p.forma(p.elipse(44, 35, 2.4, 2.2), SOMBRA, 'bola')
  // o braço esquerdo com a vela apagada
  p.forma(p.tubo([[20, 24], [13, 32], [10, 38]], 2.6, 2), SOMBRA)
  p.forma(p.ret(7, 34, 5, 9), ['#8a8070', '#c8c0b0', '#f0e8d8', '#ffffff'])
  p.forma(p.elipse(9.5, 41, 2.6, 2.2), SOMBRA, 'bola')
  p.contorno('#020108')
  // a fumaça da vela apagada (sobe enrolando) e faíscas roxas
  for (const [fx, fy] of [[[9, 30], [10, 27], [9, 24]], [[10, 30], [9, 27], [10, 23]], [[9, 31], [11, 28], [10, 25]]][q]) p.px(fx, fy, '#8a8098')
  for (const [fx, fy] of [[[4, 18], [52, 44]], [[54, 22], [3, 48]], [[6, 10], [53, 52]]][q]) p.px(fx, fy, VIOLETA[3])
  return p.grade
}

// um pivete: capuz, mascarinha, cachecol laranja e o saquinho (ou uma carta) na mão
function pivete(p, x, dy, lado, q, pisca, cor) {
  const CAPUZ = [['#1a0a1e', '#3a163a', '#5c2656', '#8a3e7e'], ['#0e1a2a', '#1a3450', '#2a5078', '#4a7aa8'], ['#1e140a', '#3e2a14', '#5e4426', '#8a6a40']][cor]
  const PELE = ['#8a5434', '#c4845a', '#eec09a', '#ffe2c4']
  const LARANJA = ['#6a2a08', '#b8501a', '#ff9a3d', '#ffd08a']
  const TENIS = ['#3a3a40', '#6a6a74', '#c8c8d0', '#ffffff']
  // as pernas e os tênis
  p.forma(p.ret(x - 5, 56 + dy, 4, 8 - dy), CAPUZ)
  p.forma(p.ret(x + 1, 56 + dy, 4, 8 - dy), CAPUZ)
  p.forma(p.ret(x - 6, 62, 5, 3), TENIS)
  p.forma(p.ret(x + 1, 62, 5, 3), TENIS)
  // o moletom
  p.forma(p.poli([x - 7, 44 + dy], [x + 7, 44 + dy], [x + 8, 57 + dy], [x - 8, 57 + dy]), CAPUZ)
  // o braço com o saquinho (ou a carta roubada)
  p.forma(p.tubo([[x + lado * 6, 46 + dy], [x + lado * 10, 50 + dy], [x + lado * 11, 54 + dy]], 1.8, 1.6), CAPUZ)
  if (q === 1) p.forma(p.ret(x + lado * 11 - 2.5, 50 + dy, 5, 7), ['#8a8478', '#c8c0b0', '#fbf6ea', '#ffffff'], 'bisel', { luz: false })
  else p.forma(p.elipse(x + lado * 11, 56 + dy, 3.4, 3.6), ['#3a2614', '#664624', '#946c3e', '#c49c66'], 'bola')
  // o cachecol
  p.forma(p.ret(x - 6, 42 + dy, 12, 3), LARANJA)
  // a cabeça com o capuz e a máscara
  p.forma(p.elipse(x, 37 + dy, 7, 7), CAPUZ, 'bola')
  p.forma(p.elipse(x, 38.5 + dy, 4.6, 4.4), PELE, 'bola')
  p.preencher(p.ret(x - 5, 36 + dy, 10, 2.5), '#16101e')
  if (!pisca) p.carimbo(x - 3, 36 + dy, ['w...w'], { w: '#f4f4ff' })
  p.carimbo(x - 1, 41 + dy, ['rr'], { r: '#a02a3a' })
}

// PIVETES (lacaios da Ladra): três pivetes de capuz, um com a carta que acabou de pegar, e moedas pelo chão
function ladraLacaios(q) {
  const p = pintor(96, ALTURA, { dx: 2 })
  const OURO = ['#6e3f0c', '#b07a14', '#f2c235', '#fff2a0']
  for (const [mx, my] of [[42, 63], [52, 64], [60, 62]]) p.forma(p.elipse(mx, my, 2.4, 1.4), OURO, 'bola')
  pivete(p, 47, [-1, 0, 0][q] - 4, 1, (q + 2) % 3, q === 1, 2)
  pivete(p, 18, [0, -1, 0][q], 1, q, q === 2, 0)
  pivete(p, 76, [0, 0, -1][q], -1, (q + 1) % 3, q === 0, 1)
  p.contorno('#0c0610')
  // os brilhos das moedas (soltos)
  for (const [bx, by] of [[[42, 61], [60, 60]], [[52, 62], [42, 61]], [[60, 60], [52, 62]]][q]) p.px(bx, by, '#ffffff')
  return p.grade
}

// O RECEPTADOR (tenente da Ladra): o comprador de muamba, de cartola e sobretudo ABERTO, mostrando as cartas e os
// relógios roubados pendurados por dentro; bigode, monóculo e uma moeda pulando na mão
function ladraReceptador(q) {
  const p = pintor(58, ALTURA, { dx: 2, dy: 1 })
  const CASACO = ['#14100a', '#2e2414', '#4a3a20', '#6e5a34']
  const FORRO = ['#3a0a14', '#6a1424', '#9a2438', '#c84a5e']
  const TERNO = ['#120c1a', '#261e36', '#3e3256', '#62527e']
  const PELE = ['#8a5434', '#c4845a', '#eec09a', '#ffe2c4']
  const OURO = ['#6e3f0c', '#b07a14', '#f2c235', '#fff2a0']
  const CARTA = ['#8a8478', '#c8c0b0', '#fbf6ea', '#ffffff']
  const SAPATO = ['#08080c', '#16161c', '#26262e', '#50505a']
  // as pernas e os sapatos
  p.forma(p.ret(19, 50, 7, 13), TERNO)
  p.forma(p.ret(29, 50, 7, 13), TERNO)
  p.forma(p.poli([17, 61], [26, 61], [27, 65], [16, 65]), SAPATO)
  p.forma(p.poli([29, 61], [38, 61], [39, 65], [28, 65]), SAPATO)
  // o sobretudo aberto: as abas de fora e o forro vermelho de dentro
  const aba = [0, 1, -1][q]
  p.forma(p.poli([16, 22], [8 + aba, 34], [5 + aba, 58], [16, 56], [20, 30]), CASACO)
  p.forma(p.poli([40, 22], [48 - aba, 34], [51 - aba, 58], [40, 56], [36, 30]), CASACO)
  p.forma(p.poli([16, 26], [11 + aba, 36], [9 + aba, 54], [17, 52]), FORRO)
  p.forma(p.poli([40, 26], [45 - aba, 36], [47 - aba, 54], [39, 52]), FORRO)
  // a mercadoria pendurada no forro: cartas e relógios
  for (const [cx, cy] of [[12, 38], [13, 46], [43, 40]]) {
    p.forma(p.ret(cx - 2 + aba * 0.5, cy, 4, 6), CARTA, 'bisel', { luz: false })
    p.px(cx + aba * 0.5, cy + 2, cy % 4 ? '#c8283a' : '#1a1a2e')
  }
  for (const [rx, ry] of [[44, 48], [11, 31]]) {
    p.forma(p.elipse(rx - aba * 0.5, ry, 2.2, 2.2), OURO, 'bola')
    p.px(rx - aba * 0.5, ry, '#1a1a2e')
  }
  // o corpo (colete e gravata)
  p.forma(p.poli([20, 24], [36, 24], [37, 52], [19, 52]), TERNO)
  p.forma(p.poli([27, 25], [29, 25], [30, 36], [28, 39], [26, 36]), FORRO)
  for (const y of [32, 38, 44]) p.px(31, y, OURO[2])
  p.forma(p.ret(19, 48, 18, 3), CASACO)
  // a mão direita com a moeda pulando
  p.forma(p.tubo([[37, 28], [43, 34], [47, 30]], 2.4, 2), CASACO)
  p.forma(p.elipse(48, 29, 2.4, 2.2), PELE, 'bola')
  p.forma(p.elipse(49, [22, 19, 24][q], 2, [2, 1, 2][q]), OURO, 'bola')
  // a cabeça: bigode, monóculo e a cartola
  p.forma(p.elipse(28, 16, 7, 7.5), PELE, 'bola')
  p.carimbo(22, 18, ['.kkk...kkk.', 'kkkkk.kkkkk'], { k: '#2a1a10' })
  p.carimbo(24, 14, ['k'], { k: '#16101e' })
  p.carimbo(30, 13, ['.oo.', 'o.wo', '.oo.'], { o: OURO[2], w: '#e8f4ff' })
  p.linha(33, 15, 35, 22, OURO[1])
  p.forma(p.ret(19, 8, 18, 2.5), CASACO)
  p.forma(p.ret(21.5, 1, 13, 8), CASACO)
  p.linha(22, 6, 34, 6, FORRO[2])
  p.contorno('#0c0610')
  return p.grade
}

export const SEMANAIS_EXPEDICAO = {
  'escuridao-lacaios': escuridaoLacaios,
  'escuridao-apagavelas': escuridaoApagaVelas,
  'ladra-lacaios': ladraLacaios,
  'ladra-receptador': ladraReceptador,
}
