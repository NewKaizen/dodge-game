// Os QUATRO CHEFÕES do CO-OP (Chaos King, Queen, Jevil e Coronel Caçamba) em pixel art de DENSIDADE 2: o dobro
// de pixels dos outros sprites, desenhados na metade da escala (texturas.js: DENSIDADE e escalaDe), então ocupam o
// mesmo espaço na tela com o dobro de detalhe. Arte original, feita com o pintor de formas (arte/pintor.js):
// rampas de 4 tons por material, contorno escuro e brilhos.
//
// Cada chefão tem QUADROS_IDLE quadros (respiração/balanço): o quadro 0 é a chave do chefe ('king') e os outros
// são '<chave>-q1', '<chave>-q2' (entities/Inimigo.js alterna entre eles).
import { pintor } from './pintor.js'

export const QUADROS_IDLE = 3
// Todos com a mesma altura de tela. O desenho fica nas linhas 2..66 e o resto é folga (o sprite é centrado em
// y 196 na arena, na escala 2): o topo para embaixo do texto do SUPER do chefe (y 124) e a base, acima do quadro
// da esquiva (y 260), como no sprite antigo
const ALTURA = 72

// ---------- rampas (sombra funda, sombra, base, luz) ----------
const OURO = ['#6e3f0c', '#b07a14', '#f2c235', '#fff2a0']
const OBSIDIANA = ['#0b0714', '#1a1130', '#2c1f4a', '#4a3a78']

// ---------- CHAOS KING: o rei do xadrez com coroa, capa e o losango do caos ----------
function king(q) {
  const p = pintor(52, ALTURA, { dy: 2 })
  const CONTORNO = '#0c0616'
  const CAPA = ['#33081a', '#62122c', '#9a2040', '#cf4458']
  const MANTO = ['#1c1032', '#36205e', '#563a94', '#8064c4']
  const ARMINHO = ['#7a7896', '#bdbcd4', '#ecebfa', '#ffffff']
  const CAOS = ['#4a0838', '#a8186a', '#ff3f9a', '#ffd0ea']
  const CABECA = ['#0b0714', '#1e1436', '#33245a', '#5c4a96']

  // a capa por trás, aberta dos ombros até o chão; a barra em zigue-zague ondula entre os quadros
  const barra = []
  for (let x = 1, i = 0; x <= 51; x += 5, i++) barra.push([x, (i + q) % 3 === 0 ? 60 : (i + q) % 3 === 1 ? 63 : 61])
  const capa = p.poli([15, 23], [6, 33], [2, 46], [1, 62], ...barra, [51, 62], [50, 46], [46, 33], [37, 23])
  p.forma(capa, CAPA)
  // dobras da capa
  for (const [x0, x1] of [[7, 4], [11, 9], [45, 48], [41, 43]]) {
    p.linha(x0, 36, x1, 58, CAPA[1])
    p.linha(x0 + 1, 36, x1 + 1, 58, CAPA[3])
  }
  p.vinco(capa, p.menos(p.ret(-5, -5, 60, 80), capa), OURO[2])

  // o pedestal da peça de xadrez (o rei flutua em cima dele)
  p.forma(p.elipse(26, 62, 16, 3), OBSIDIANA, 'bola')
  p.forma(p.ret(12, 57, 28, 5), OBSIDIANA)
  p.linha(13, 58, 38, 58, OURO[2])
  p.linha(13, 59, 38, 59, OURO[0])
  p.forma(p.elipse(26, 57, 14, 2.6), OBSIDIANA, 'bola')

  // o manto (o corpo da peça), com as dobras
  const manto = p.poli([18, 26], [34, 26], [38, 57], [14, 57])
  p.forma(manto, MANTO)
  for (const [x0, x1] of [[20, 18], [32, 34]]) {
    p.linha(x0, 43, x1, 56, MANTO[1])
    p.linha(x0 - 1, 43, x1 - 1, 56, MANTO[3])
  }
  // a faixa de arminho que desce no meio, com os losangos do tabuleiro
  p.forma(p.ret(23, 29, 6, 28), ARMINHO, 'bisel', { luz: false })
  for (let y = 31, i = 0; y < 54; y += 5, i++) p.carimbo(24, y, ['.a..', 'aaa.', '.a..'], { a: i % 2 ? '#c8323a' : '#1c1230' })
  // rachaduras do caos no manto (brilham)
  for (const pts of [
    [[16, 54], [18, 50], [17, 48], [19, 45]],
    [[36, 55], [34, 51], [36, 48], [34, 45]],
  ])
    for (let i = 1; i < pts.length; i++) p.linha(...pts[i - 1], ...pts[i], CAOS[2])
  p.px(19, 45, CAOS[3])
  p.px(34, 45, CAOS[3])
  // cinto de ouro com a joia
  p.forma(p.ret(17, 39, 18, 3), OURO)
  p.carimbo(24, 38, ['.rr.', 'rRrr', '.rr.'], { r: '#e8323a', R: '#ffb0b0' })

  // braço esquerdo (para baixo, segurando o cetro)
  p.forma(p.poli([18, 26], [12, 31], [8, 41], [15, 43], [19, 35]), MANTO)
  p.forma(p.ret(8, 40, 7, 3), ARMINHO, 'bisel', { luz: false })
  // o cetro: haste de ouro com o orbe e a cruz do rei
  p.linha(10, 14, 10, 56, OURO[2])
  p.linha(11, 14, 11, 56, OURO[0])
  p.forma(p.elipse(10.5, 12, 2.8, 2.8), OURO, 'bola')
  p.forma(p.ret(10, 3, 2, 7), OURO)
  p.forma(p.ret(8, 5, 6, 2), OURO)
  p.forma(p.elipse(11, 44, 2.6, 2.2), CABECA, 'bola') // a luva

  // braço direito erguido, com o LOSANGO DO CAOS flutuando na mão
  p.forma(p.poli([33, 26], [40, 30], [45, 24], [48, 20], [44, 16], [39, 21], [34, 23]), MANTO)
  p.forma(p.poli([42, 21], [45, 17], [49, 20], [46, 24]), ARMINHO, 'bisel', { luz: false })
  p.forma(p.elipse(47, 16, 2.4, 2.2), CABECA, 'bola') // a luva
  const sobe = [1, 0, -1][q]
  p.forma(p.poli([46, 0 + sobe], [50.5, 6.5 + sobe], [46, 13 + sobe], [41.5, 6.5 + sobe]), CAOS, 'bola')
  p.px(45, 4 + sobe, '#ffffff')
  const faiscas = [
    [[40, 1], [51, 9], [41, 12]],
    [[51, 1], [40, 6], [50, 13]],
    [[43, 0], [51, 5], [40, 10]],
  ][q]
  for (const [x, y] of faiscas) p.px(x, y, CAOS[3])

  // ombreiras de ouro e a gola de arminho (com as pintinhas pretas)
  p.forma(p.elipse(15.5, 27, 3.6, 2.6), OURO, 'bola')
  p.forma(p.elipse(36.5, 27, 3.6, 2.6), OURO, 'bola')
  p.forma(p.elipse(26, 26.5, 11, 3.2), ARMINHO)
  for (const [x, y] of [[19, 26], [23, 27], [27, 26], [31, 27]]) p.px(x, y, '#1c1230')

  // a cabeça: o topo de obsidiana da peça, com olhos e o sorriso de caos
  p.forma(p.elipse(26, 18.5, 9, 6.5), CABECA, 'bola')
  const olho = ['#ff2a3a', '#ff6a2a', '#ff2a3a'][q]
  p.carimbo(19, 16, ['oo....', 'ooOo..', '.ooo..'], { o: olho, O: '#ffe08a' })
  p.carimbo(27, 16, ['....oo', '..oOoo', '..ooo.'], { o: olho, O: '#ffe08a' })
  p.carimbo(19, 20, ['k.........kk..', 'kwkwkwkwkwkwk.', '.kwkwkwkwkwk..', '..k.......k...'], { k: '#05030a', w: '#f4f0ff' })

  // a coroa, com as joias e a cruz do rei
  p.forma(p.poli([16, 13], [16, 6], [19, 9], [21, 3], [24, 8], [26, 5], [28, 8], [31, 3], [33, 9], [36, 6], [36, 13]), OURO)
  p.forma(p.ret(16, 10, 20, 4), OURO)
  p.carimbo(18, 11, ['rr'], { r: '#e8323a' })
  p.carimbo(25, 10, ['.b.', 'bBb', '.b.'], { b: '#3a8cff', B: '#c8e4ff' })
  p.carimbo(32, 11, ['rr'], { r: '#e8323a' })
  p.forma(p.ret(25, 0, 2, 5), OURO)
  p.forma(p.ret(23, 1, 6, 2), OURO)
  p.px(...[[21, 4], [26, 6], [31, 4]][q], '#ffffff') // o brilho que corre na coroa

  p.contorno(CONTORNO)
  return p.grade
}

// ---------- QUEEN: a rainha-computador, com o rosto na tela e a tiara de wi-fi ----------
// arco de wi-fi: os pixels a `r` do centro, numa abertura de ±`abre` radianos para cima
function arco(p, cx, cy, r, cor, abre = 0.8, grossura = 0.7) {
  for (let y = Math.floor(cy - r - 1); y <= cy; y++)
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const d = Math.hypot(dx, dy)
      if (Math.abs(d - r) <= grossura && Math.abs(Math.atan2(dx, -dy)) <= abre) p.px(x, y, cor)
    }
}

function queen(q) {
  const p = pintor(48, ALTURA, { dy: 4 })
  const CONTORNO = '#0a0820'
  const PRATA = ['#4a4e70', '#868cb4', '#cdd2ee', '#ffffff']
  const ROSA = ['#4e0a38', '#9c1c6c', '#ec3aa8', '#ff9ad6']
  const SAIA = ['#120e34', '#241e62', '#3c3496', '#6a60d2']
  const CIANO = '#40f0ff'
  const CIANO_ESCURO = '#1a7a9a'
  const TELA = '#0a1230'

  // a gola em leque atrás da cabeça: as varetas e a renda branca na borda
  const LACO = ['#6a5e9e', '#a89cd8', '#e0daf8', '#ffffff']
  const corte = p.ret(-5, -5, 60, 37)
  const leque = p.e(p.elipse(24, 32, 21, 21), corte)
  p.forma(leque, ['#3a0830', '#6a1458', '#9a2480', '#c84aa8'], 'bisel', { luz: false })
  for (let a = -1.4; a <= 1.41; a += 0.35) p.linha(24, 32, 24 + Math.sin(a) * 20, 32 - Math.cos(a) * 20, '#d860b8')
  for (let a = -1.5; a <= 1.51; a += 0.188) p.forma(p.e(p.elipse(24 + Math.sin(a) * 21, 32 - Math.cos(a) * 21, 1.6, 1.6), corte), LACO, 'bola')

  // a saia de baile: a placa-mãe, com trilhas e luzinhas
  const saia = p.uniao(p.poli([17, 42], [31, 42], [44, 60], [4, 60]), p.elipse(24, 60, 20, 3))
  p.forma(saia, SAIA)
  for (const [x0, x1] of [[20, 12], [24, 24], [28, 36]]) p.linha(x0, 46, x1, 59, SAIA[1])
  const trilhas = [
    [[19, 46], [17, 49], [17, 52], [14, 55]],
    [[29, 46], [31, 49], [31, 52], [34, 55]],
    [[24, 48], [24, 51], [21, 53], [21, 56]],
    [[24, 51], [27, 53], [27, 56]],
  ]
  for (const t of trilhas) for (let i = 1; i < t.length; i++) p.linha(...t[i - 1], ...t[i], CIANO_ESCURO)
  const luzes = [[14, 55], [34, 55], [21, 56], [27, 56], [17, 49], [31, 49]]
  luzes.forEach(([x, y], i) => p.px(x, y, (i + q) % 3 === 0 ? '#ffffff' : CIANO))
  // a barra rosa
  p.forma(p.e(saia, p.ret(0, 58, 48, 8)), ROSA, 'bisel', { luz: false })
  for (let x = 6; x < 44; x += 4) p.px(x, 59, ROSA[3])

  // o corpete, com o símbolo do wi-fi no peito
  p.forma(p.poli([17, 31], [31, 31], [29, 43], [19, 43]), ROSA)
  p.carimbo(21, 34, ['.ccccc.', 'c.....c', '..ccc..', '.c...c.', '...c...'], { c: CIANO })
  // a cinta prateada
  p.forma(p.ret(18, 42, 12, 2), PRATA)

  // braço esquerdo na cintura
  p.forma(p.tubo([[16, 34], [11.5, 39.5], [17, 43.5]], 1.4), PRATA)
  p.forma(p.elipse(11.5, 39.5, 1.7, 1.7), ROSA, 'bola')
  // braço direito erguido, com a varinha-antena
  p.forma(p.tubo([[32, 34], [36.5, 29], [39.5, 22]], 1.4), PRATA)
  p.forma(p.elipse(36.5, 29, 1.7, 1.7), ROSA, 'bola')
  p.linha(40, 22, 42, 9, PRATA[1])
  p.linha(41, 22, 43, 9, PRATA[3])
  p.forma(p.elipse(39.5, 21.5, 2, 2), PRATA, 'bola') // a mão
  p.forma(p.elipse(42.5, 7.5, 2.2, 2.2), [CIANO_ESCURO, '#20b8d8', CIANO, '#e8ffff'], 'bola')
  for (let r = 1; r <= 2; r++) arco(p, 42.5, 7, 2 + r * 2.5, (q + r) % 3 === 0 ? '#ffffff' : CIANO, 0.7)

  // as ombreiras
  p.forma(p.elipse(16.5, 32.5, 3.6, 2.8), PRATA, 'bola')
  p.forma(p.elipse(31.5, 32.5, 3.6, 2.8), PRATA, 'bola')

  // o pescoço: um cabo
  p.forma(p.ret(22, 28, 4, 4), ['#141428', '#20203a', '#2e2e4e', '#46466a'])
  p.linha(22, 29, 25, 29, CIANO_ESCURO)

  // a cabeça: o monitor, com as "orelhas" de antena
  p.forma(p.ret(10, 16, 3, 7), PRATA)
  p.forma(p.ret(35, 16, 3, 7), PRATA)
  p.px(10, 15, ROSA[2])
  p.px(37, 15, ROSA[2])
  const caixa = p.menos(p.ret(12, 10, 24, 20), p.ret(12, 10, 1, 1), p.ret(35, 10, 1, 1), p.ret(12, 29, 1, 1), p.ret(35, 29, 1, 1))
  p.forma(caixa, PRATA)
  p.px(33, 27, ROSA[3]) // o LED de ligado
  const tela = p.ret(14, 12, 20, 14)
  p.preencher(tela, TELA)
  for (let y = 13; y < 26; y += 2) p.linha(14, y, 33, y, '#0f1a40')
  p.carimbo(14, 12, ['ww', 'w.'], { w: '#3a4a80' }) // o reflexo
  // o rosto: olhos de cílios longos (o brilho dança entre os quadros) e a boca de batom
  const brilhoOlho = [['cCwwCCc', 'cCCwwCc'], ['cwwCCCc', 'cCwwCCc'], ['cCCwwCc', 'cCCCwwc']][q]
  p.carimbo(16, 15, ['c..c.c.', '.ccccc.', brilhoOlho[0], '.cCCCc.', '..ccc..'], { c: CIANO, C: '#1a90b0', w: '#ffffff' })
  p.carimbo(25, 15, ['.c.c..c', '.ccccc.', brilhoOlho[1], '.cCCCc.', '..ccc..'], { c: CIANO, C: '#1a90b0', w: '#ffffff' })
  p.carimbo(21, 22, ['.mmmm.', 'mMMMMm', '.mmmm.'], { m: '#ff3fb4', M: '#ff9ad6' })

  // a tiara: banda de ouro e a joia; os arcos do wi-fi vêm depois do contorno (finos, com o vão aparecendo)
  p.forma(p.ret(14, 8, 20, 2), OURO)
  p.forma(p.elipse(24, 7, 1.8, 1.8), ['#9c1c6c', '#ec3aa8', '#ff9ad6', '#ffffff'], 'bola')
  // brilhos de glamour em volta (trocam de lugar)
  for (const [x, y] of [[[4, 22], [44, 12], [2, 44]], [[45, 30], [3, 14], [46, 46]], [[6, 34], [45, 20], [1, 28]]][q]) p.carimbo(x - 1, y - 1, ['.b.', 'bwb', '.b.'], { b: '#ff9ad6', w: '#ffffff' })

  p.contorno(CONTORNO)
  // os três arcos acendem um a um entre os quadros (o quadro 0, o dos menus, mostra o sinal cheio)
  const acesos = [3, 1, 2][q]
  const cores = [CIANO, '#ff3fb4', OURO[2]]
  for (let r = 1; r <= 3; r++) {
    arco(p, 24, 7.5, r * 2.8 + 0.6, CONTORNO, 0.84, 1.2)
    arco(p, 24, 7.5, r * 2.8 + 0.6, r <= acesos ? cores[r - 1] : '#3a3460', 0.78, 0.55)
  }
  return p.grade
}

// ---------- JEVIL: o bobo da corte do caos, chapéu de chifres com guizos, sorriso de orelha a orelha e losangos ----------
function jevil(q) {
  const p = pintor(52, ALTURA, { dy: 2 })
  const CONTORNO = '#0e0618'
  const VIOLETA = ['#22103c', '#432078', '#6a36b6', '#9c6ce8']
  const PETROLEO = ['#0a2234', '#134a64', '#1f7896', '#52b8d8']
  const MASCARA = ['#68668e', '#b6b2d6', '#e6e2f6', '#ffffff']
  const RUBI = ['#560a1c', '#a6182e', '#ea3048', '#ff9eac']
  const LUVA = ['#7a7896', '#c4c2da', '#f0eefa', '#ffffff']
  const lado = (x) => (x < 26 ? VIOLETA : OURO) // arlequim: metade violeta, metade ouro
  const xadrez = (x, y) => ((Math.floor((x + y) / 4) + Math.floor((x - y + 100) / 4)) % 2 ? VIOLETA : PETROLEO)

  // os losangos do caos girando em volta (trocam de lugar a cada quadro)
  const losango = (x, y, r = 3) => p.forma(p.poli([x, y - r - 1], [x + r, y], [x, y + r + 1], [x - r, y]), RUBI, 'bola')
  for (const [x, y, r] of [
    [[4, 44, 3], [48, 50, 2], [46, 30, 2]],
    [[6, 52, 2], [47, 42, 3], [4, 30, 2]],
    [[3, 36, 2], [48, 58, 2], [44, 36, 3]],
  ][q])
    losango(x, y, r)

  // pernas agachadas, abertas (a esquerda de ouro, a direita violeta) e os sapatos de bico enrolado
  p.forma(p.tubo([[22, 44], [12, 50], [14, 58]], 4, 3), OURO)
  p.forma(p.tubo([[30, 44], [40, 50], [38, 58]], 4, 3), VIOLETA)
  p.forma(p.tubo([[14, 60], [9, 63], [5, 63], [3, 60]], 2.8, 1.2), VIOLETA)
  p.forma(p.tubo([[38, 60], [43, 63], [47, 63], [49, 60]], 2.8, 1.2), OURO)
  p.forma(p.elipse(3, 58.5, 1.7, 1.7), OURO, 'bola')
  p.forma(p.elipse(49, 58.5, 1.7, 1.7), VIOLETA, 'bola')

  // o tronco em xadrez de arlequim, com o cinto
  p.forma(p.poli([17, 30], [35, 30], [34, 47], [18, 47]), xadrez)
  p.forma(p.ret(18, 44, 16, 3), OURO)
  p.carimbo(25, 44, ['.r.', 'rRr', '.r.'], { r: RUBI[2], R: RUBI[3] })

  // os braços abertos ("tcharã!"), as mangas em cores trocadas e as luvas de três dedos
  const braco = [
    [[19, 32], [12, 35], [7, 40]],
    [[19, 32], [12, 34], [7, 38]],
    [[19, 32], [12, 35], [7, 41]],
  ][q]
  p.forma(p.tubo(braco, 2.6, 2), VIOLETA)
  p.forma(p.tubo([[33, 32], [40, 34], [45, 30]], 2.6, 2), OURO)
  const [mx, my] = braco[2]
  p.forma(p.uniao(p.elipse(mx - 1, my + 1, 2.6, 2.4), p.tubo([[mx - 2, my + 2], [mx - 4, my + 5]], 0.9)), LUVA, 'bola')
  p.forma(p.uniao(p.elipse(46, 29, 2.6, 2.4), p.tubo([[46, 27], [47, 24]], 0.9), p.tubo([[47, 28], [50, 27]], 0.9)), LUVA, 'bola')
  // a carta de ouros que ele gira na ponta dos dedos
  const carta = [
    [[43, 14], [51, 14], [51, 25], [43, 25]],
    [[44, 13], [51, 15], [50, 26], [43, 24]],
    [[42, 15], [50, 13], [51, 24], [43, 26]],
  ][q]
  p.forma(p.poli(...carta), LUVA, 'bisel', { luz: false })
  const [cx0, cy0] = [47, 19.5]
  p.carimbo(cx0 - 2, cy0 - 3, ['..r..', '.rrr.', 'rrRrr', '.rrr.', '..r..'], { r: RUBI[2], R: RUBI[3] })

  // a gola de babados em zigue-zague (violeta e ouro)
  for (let x = 16, i = 0; x <= 36; x += 4, i++) p.forma(p.elipse(x, 29.5, 2.6, 2.6), i % 2 ? OURO : VIOLETA, 'bola')

  // o chapéu: dois chifres que se enrolam para fora, cada um com o guizo na ponta (balançam)
  const balanco = [0, 1, -1][q]
  p.forma(p.tubo([[22, 14], [17, 8], [12, 4], [7, 3], [4, 5], [3 + balanco, 9]], 4, 1.2), VIOLETA)
  p.forma(p.tubo([[30, 14], [35, 8], [40, 4], [45, 3], [48, 5], [49 - balanco, 9]], 4, 1.2), OURO)
  p.forma(p.uniao(p.elipse(26, 15, 9, 4.5)), lado)
  p.forma(p.elipse(3.5 + balanco, 11.5, 2.2, 2.2), OURO, 'bola')
  p.forma(p.elipse(48.5 - balanco, 11.5, 2.2, 2.2), VIOLETA, 'bola')
  p.forma(p.ret(19, 14, 14, 2), OURO, 'bisel')
  p.carimbo(25, 13, ['.r.', 'rRr', '.r.'], { r: RUBI[2], R: RUBI[3] })

  // a máscara: olho de losango (esquerdo) e olho redondo (direito), e o sorriso enorme
  p.forma(p.elipse(26, 21.5, 8.5, 6.5), MASCARA, 'bola')
  p.carimbo(19, 17, ['..k..', '.kyk.', 'kyYyk', '.kyk.', '..k..', '..v..'], { k: '#14081e', y: '#ffd400', Y: '#ffffff', v: '#6a36b6' })
  // o olho redondo gira (a pupila muda de lado entre os quadros)
  p.carimbo(28, 17, ['.kkk.', 'kyyyk', ['kyYyk', 'kYyyk', 'kyyYk'][q], '.kkk.'], { k: '#14081e', y: '#ffd400', Y: '#ffffff' })
  const dentes = q === 2 ? ['.kwkwkwkwkwkwkwk.', '..kwkwkwkwkwkwk..'] : ['.kkwkwkwkwkwkwkk.', '..wkwkwkwkwkwkw..']
  p.carimbo(18, 22, ['kk.............kk', '.kkkkkkkkkkkkkkk.', ...dentes, '...kkkkkkkkkkk...'], { k: '#14081e', w: '#ffffff' })
  p.px(17, 21, MASCARA[1])
  p.px(34, 21, MASCARA[1])

  p.contorno(CONTORNO)
  return p.grade
}

// ---------- CORONEL CAÇAMBA: o coronel que É o caminhão de lixo (quepe com giroflex, bigodão e caçamba com rodas) ----------
function coronel(q) {
  const p = pintor(60, ALTURA, { dy: 4 })
  const CONTORNO = '#0c0c14'
  const ACO = ['#22262f', '#3e4554', '#646e82', '#9aa4b8']
  const CROMO = ['#4a4f5a', '#8a909c', '#c8ccd8', '#ffffff']
  const LARANJA = ['#6a2c08', '#a85a14', '#e8892a', '#ffc070']
  const FARDA = ['#0e1428', '#1c2848', '#2c3e6c', '#4a62a0']
  const PELE = ['#7a3e22', '#bc7650', '#e8b48a', '#ffd8b8']
  const PNEU = ['#08080c', '#16161c', '#26262e', '#40404a']
  const LUVA = ['#7a7896', '#c4c2da', '#f0eefa', '#ffffff']
  const FUMACA = ['#3a3a44', '#5a5a66', '#8a8a96', '#b8b8c4']

  // a fumaça do escapamento (sobe entre os quadros)
  for (const [x, y, r] of [
    [[8, 5, 3.2], [12, 1, 2.2]],
    [[7, 3, 3.2], [10, 6, 2.2]],
    [[10, 1.5, 2.6], [7, 5.5, 2.6]],
  ][q])
    p.forma(p.elipse(x, y, r, r * 0.9), FUMACA, 'bola')
  // o escapamento cromado
  p.forma(p.ret(6, 8, 4, 24), CROMO)
  p.forma(p.ret(5, 7, 6, 2), CROMO)

  // a tampa da caçamba aberta para trás (o "espaldar" do coronel)
  p.forma(p.poli([12, 29], [50, 29], [53, 17], [9, 17]), ACO, 'bisel', { luz: false })
  for (let x = 14; x < 50; x += 6) p.linha(x, 19, x - 0.5, 28, ACO[0])

  // o coronel saindo da caçamba: a farda azul-marinho com a faixa refletiva, dragonas e medalhas
  p.forma(p.poli([20, 22], [40, 22], [42, 34], [18, 34]), FARDA)
  p.forma(p.poli([21, 22], [25, 22], [41, 32], [37, 34]), LARANJA, 'bisel', { luz: false })
  p.linha(23, 23, 39, 33, '#f2f2c8') // a listra refletiva
  p.carimbo(22, 27, ['rbyr', 'rbyr', '.Y..', 'YYY.', '.Y..'], { r: '#c8323a', b: '#3a7ae8', y: '#ffe14a', Y: OURO[2] })
  p.carimbo(29, 23, ['g', 'g', 'g'], { g: OURO[1] }) // os botões
  // o braço esquerdo apoiado na borda
  p.forma(p.tubo([[20, 24], [14, 28], [13, 32]], 2.6, 2.2), FARDA)
  p.forma(p.elipse(13.5, 32.5, 2.6, 2.2), LUVA, 'bola')
  // o braço direito batendo continência
  p.forma(p.tubo([[40, 24], [46, 19], [41, 12]], 2.6, 2.2), FARDA)
  p.forma(p.uniao(p.elipse(39.5, 11, 2.8, 2), p.ret(36, 10, 3, 2)), LUVA, 'bola')
  // as dragonas de ouro com franja
  for (const x of [19.5, 40.5]) {
    p.forma(p.elipse(x, 23, 3.4, 2.2), OURO, 'bola')
    for (let k = -2; k <= 2; k += 2) p.px(x + k, 25, OURO[1])
  }

  // a cabeça: orelhas, óculos escuros de aviador e o bigodão branco
  p.forma(p.elipse(22.5, 16, 1.8, 2.2), PELE, 'bola')
  p.forma(p.elipse(37.5, 16, 1.8, 2.2), PELE, 'bola')
  p.forma(p.elipse(30, 15.5, 7.2, 7), PELE, 'bola')
  p.carimbo(23, 13, ['kkkkkk.kkkkkk', 'kKKkkkkkKKkkk', '.kkkk...kkkk.'], { k: '#101018', K: '#9aa8d0' })
  p.carimbo(22, 18, ['w..............w', 'ww.wwww..wwww.ww', '.wwwwwwwwwwwwww.', '...wwwwwwwwww...'], { w: '#f4f4f4' })
  p.carimbo(22, 19, ['................', '................', '..m..........m..', '....mmm..mmm....'], { m: '#b8bcc8' })
  p.carimbo(28, 22, ['rrrr'], { r: '#8a3424' }) // a boca debaixo do bigode

  // o quepe laranja de coronel: copa larga, aba preta, distintivo dourado e o GIROFLEX em cima
  p.forma(p.uniao(p.elipse(30, 3.6, 11.5, 2.4), p.poli([18.5, 4], [41.5, 4], [38, 10], [22, 10])), LARANJA)
  p.forma(p.ret(22, 8, 16, 2), ['#2a1408', '#4a2410', '#6a3418', '#8a4a24'], 'bisel', { luz: false })
  p.forma(p.poli([20, 10], [40, 10], [38, 13], [22, 13]), ['#05050a', '#101018', '#1e1e28', '#3a3a48'])
  p.linha(23, 10, 37, 10, '#4a4a58')
  p.carimbo(28, 3, ['.y..', 'yYyy', 'yyyy', '.y..'], { y: OURO[2], Y: '#ffffff' })
  p.forma(p.ret(27, 0, 6, 2), CROMO)
  p.forma(p.elipse(30, 0.5, 2.6, 2), ['#8a3a00', '#e07a00', '#ffb020', '#fff0a0'], 'bola')
  const giro = [27.5, 30, 32.5][q]
  p.px(giro, 0, '#ffffff')
  p.px(giro, -1, '#fff0a0')

  // o lixo que sobra pela borda: casca de banana, lata amassada e um jornal
  p.forma(p.tubo([[45, 32], [47, 27], [49, 25]], 1.2), ['#8a6a10', '#c8a020', '#ffe14a', '#fff6b0'])
  p.forma(p.tubo([[47, 30], [51, 28]], 1), ['#8a6a10', '#c8a020', '#ffe14a', '#fff6b0'])
  p.forma(p.poli([10, 33], [10, 28], [15, 27], [16, 32]), ['#6a6a74', '#a8a8b4', '#dcdce4', '#ffffff'], 'bisel', { luz: false })
  p.linha(11, 29, 14, 29, '#5a5a66')
  p.linha(11, 31, 14, 30, '#5a5a66')

  // a CAÇAMBA: aço com nervuras, borda de faixa zebrada e a estrela de coronel
  const cacamba = p.poli([6, 33], [54, 33], [52, 53], [8, 53])
  p.forma(cacamba, ACO)
  for (const x of [14, 22, 38, 46]) {
    p.linha(x, 37, x, 51, ACO[1])
    p.linha(x + 1, 37, x + 1, 51, ACO[3])
  }
  const zebra = p.ret(4, 30, 52, 5)
  p.forma(zebra, LARANJA, 'bisel', { luz: false })
  for (let x = 2; x < 58; x += 6)
    for (let k = 0; k < 2; k++) p.linha(x + k, 34, x + k + 4, 30, '#1a1a22')
  p.vinco(zebra, cacamba, ACO[0])
  // rebites na borda de cima e manchas de sujeira
  for (let x = 9; x < 52; x += 5) p.px(x, 36, ACO[3])
  p.carimbo(17, 47, ['.dd..', 'ddddd', '.ddd.'], { d: '#4a4636' })
  p.carimbo(40, 39, ['dd.', 'ddd'], { d: '#4a4636' })
  // a estrela dourada no meio
  const estrela = []
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2
    const r = i % 2 ? 2.6 : 6
    estrela.push([30 + Math.cos(a) * r, 43.5 + Math.sin(a) * r])
  }
  p.forma(p.poli(...estrela), OURO, 'bola')

  // a frente de caminhão: para-choque cromado, faróis (piscam) e as rodas
  p.forma(p.ret(3, 51, 54, 4), CROMO)
  const farol = q === 2 ? ['#a08a20', '#d8c040', '#fff27a', '#ffffff'] : ['#d8a020', '#ffe14a', '#fff6b0', '#ffffff']
  p.forma(p.ret(8, 46, 5, 4), farol, 'bola')
  p.forma(p.ret(47, 46, 5, 4), farol, 'bola')
  for (const x of [15, 45]) {
    p.forma(p.elipse(x, 57, 6, 6), PNEU, 'bola')
    p.forma(p.elipse(x, 57, 2.6, 2.6), CROMO, 'bola')
    p.px(x + [1, 0, -1][q], 57 + [-1, 1, 0][q], '#1a1a22')
  }

  p.contorno(CONTORNO)
  return p.grade
}

export const CHEFOES = { king, queen, jevil, coronel }
