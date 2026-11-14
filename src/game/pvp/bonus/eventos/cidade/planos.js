// Planos e regras (lógica pura, sem Phaser) dos 8 bônus da arena CIDADE GRANDE:
// GPS, CÂMERA DE SEGURANÇA, ELEVADOR, TETRIS DE PRÉDIOS, FAIXA DE PEDESTRE, SELFIE,
// ENTREGA e ESCADA ROLANTE. O visual fica em gps.js, camera.js, elevador.js... (esta pasta).
//
// Cada evento muda UMA REGRA de como se joga a rodada (não é "algo cruza a caixa"):
//   GPS        o direcional gira 90° de tempos em tempos (aviso "VIRE À DIREITA")
//   CÂMERA     a caixa é vista numa câmera de segurança: 7 quadros por segundo, e às vezes a imagem espelha
//   ELEVADOR   o coração só anda de lado no andar; só muda de andar dentro do poço
//   TETRIS     blocos de prédio caem, empilham e somem em linhas cheias (nunca fecham o coração)
//   FAIXA      o chão é uma faixa de pedestres: o semáforo manda em qual cor se pode pisar
//   SELFIE     contagem 3-2-1 e FLASH: o coração congela no lugar
//   ENTREGA    pegue o pacote e leve ao ponto marcado para ganhar energia
//   ESCADA     o chão são esteiras de sentidos opostos que carregam o coração
//
// Os planos saem da semente da rodada (`sorte` = () => 0..1; a arena usa
// criarRng(`${semente}:efeito:${rodada}`)): iguais nos dois PCs em rede e nas duas caixas.
// O que depende do coração (onde ele está, se pegou o pacote) é do dono do coração e fica
// no visual. Garantias conferidas em __tests__/eventosCidade.test.js: determinismo,
// TELEGRAFO (todo perigo/mudança avisa >= ATAQUE.telegrafoMs) e ROTA DE FUGA.

import { ATAQUE } from '../../../../constants.js'

export const REF_CAIXA = { largura: 220, altura: 170 }

const entre = (sorte, a, b) => a + (b - a) * sorte()
const sortearDe = (sorte, lista) => lista[Math.min(lista.length - 1, Math.floor(sorte() * lista.length))]
// quanto do tempo do plano passa por segundo na morte súbita (o aviso nunca cai abaixo do mínimo)
export const fatorDoPlano = (aceleracao = 1) => Math.max(1, Math.min(aceleracao, 1.5))

// ---------- GPS ----------
// O direcional gira 90° (horário ou anti-horário) a cada `periodoMs`. GIRO_DIREITA: o que era
// "cima" passa a andar para a DIREITA. O GPS avisa `avisoMs` antes ("VIRE À DIREITA").
export const GPS = { primeiraMs: 2000, periodoMs: { min: 2700, max: 3500 }, avisoMs: 850, trocas: 10 }
export const GIROS = {
  direita: { passos: 1, frase: 'VIRE À DIREITA' },
  esquerda: { passos: -1, frase: 'VIRE À ESQUERDA' },
}

export function planoGps(sorte, { trocas = GPS.trocas } = {}) {
  const lista = []
  let em = GPS.primeiraMs
  let orientacao = 0 // 0..3: quantos giros horários o direcional já deu
  let seguidas = 0
  let ultimo = null
  for (let k = 0; k < trocas; k++) {
    let giro = sorte() < 0.5 ? 'direita' : 'esquerda'
    if (giro === ultimo && seguidas >= 2) giro = giro === 'direita' ? 'esquerda' : 'direita' // nunca 3 iguais (seria virar quase de costas)
    seguidas = giro === ultimo ? seguidas + 1 : 1
    ultimo = giro
    orientacao = (orientacao + GIROS[giro].passos + 4) % 4
    lista.push({ em, giro, avisoEm: em - GPS.avisoMs, orientacao })
    em += entre(sorte, GPS.periodoMs.min, GPS.periodoMs.max)
  }
  return lista
}

// Joystick depois de `orientacao` giros horários: (x, y) -> (-y, x) a cada giro (y cresce para baixo)
export function girarJoy(joy, orientacao) {
  let { x, y } = joy
  for (let k = 0; k < ((orientacao % 4) + 4) % 4; k++) [x, y] = [-y, x]
  return { x: x + 0, y: y + 0 }
}

// orientação do direcional no instante t (ms): a do último giro que já valeu
export function orientacaoEm(plano, t) {
  let o = 0
  for (const p of plano) if (t >= p.em) o = p.orientacao
  return o
}

// ---------- CÂMERA DE SEGURANÇA ----------
// A imagem da caixa atualiza a FPS quadros por segundo (constante: 7, "câmera velha"); a simulação
// segue lisa. De tempos em tempos a câmera troca de ângulo: CAM 2 espelha esquerda/direita, CAM 3
// espelha cima/baixo (CAM 1 é a imagem normal). A troca é avisada `avisoMs` antes.
export const CAMERA = { fps: 7, primeiraMs: 2300, periodoMs: { min: 2600, max: 3400 }, avisoMs: 850, trocas: 10 }
export const ANGULOS = { 1: { espelhoX: false, espelhoY: false }, 2: { espelhoX: true, espelhoY: false }, 3: { espelhoX: false, espelhoY: true } }

export function planoCamera(sorte, { trocas = CAMERA.trocas } = {}) {
  const lista = []
  let em = CAMERA.primeiraMs
  let atual = 1
  for (let k = 0; k < trocas; k++) {
    // volta à CAM 1 depois de cada ângulo diferente (a imagem normal é o descanso) e nunca repete
    const opcoes = atual === 1 ? [2, 2, 3] : [1]
    atual = sortearDe(sorte, opcoes)
    lista.push({ em, avisoEm: em - CAMERA.avisoMs, cam: atual })
    em += entre(sorte, CAMERA.periodoMs.min, CAMERA.periodoMs.max)
  }
  return lista
}

// ângulo da câmera no instante t
export function camEm(plano, t) {
  let c = 1
  for (const p of plano) if (t >= p.em) c = p.cam
  return c
}

// Qual quadro do feed a imagem mostra no instante t (ms): a imagem só muda quando o número sobe
export const quadroDoFeed = (t, fps = CAMERA.fps) => Math.floor((Math.max(0, t) * fps) / 1000)

// ponto da simulação (x, y) como aparece na tela com o ângulo `cam`, espelhando em volta do centro (cx, cy)
export function espelhar(cam, x, y, cx, cy) {
  const a = ANGULOS[cam] ?? ANGULOS[1]
  return { x: a.espelhoX ? 2 * cx - x : x, y: a.espelhoY ? 2 * cy - y : y }
}

// ---------- ELEVADOR ----------
// A caixa vira um prédio de 3 ou 4 andares. Em cada andar há um CORREDOR (faixa fina): o coração
// só anda de lado nele. O POÇO do elevador é uma coluna onde ele pode subir e descer; só dá para sair
// do poço de lado quando o coração está dentro de um corredor.
export const ELEVADOR = { andares: [3, 4], pocos: [0.18, 0.5, 0.82], corredorMeio: 10, pocoMeio: 17, margemCoracao: 8 }

export function planoElevador(sorte) {
  return { andares: sortearDe(sorte, ELEVADOR.andares), poco: sortearDe(sorte, ELEVADOR.pocos) }
}

// Geometria numa caixa { left, top, width, height }: y de cada corredor, e a faixa x do poço
export function geometriaElevador(l, { andares, poco }) {
  const alt = l.height / andares
  const linhas = Array.from({ length: andares }, (_, k) => l.top + alt * (k + 0.5))
  const meioPoco = Math.min(ELEVADOR.pocoMeio, l.width / 4)
  const cx = Math.max(l.left + meioPoco + ELEVADOR.margemCoracao, Math.min(l.left + l.width - meioPoco - ELEVADOR.margemCoracao, l.left + l.width * poco))
  return { linhas, alt, corredorMeio: Math.min(ELEVADOR.corredorMeio, alt / 2 - 3), poco: { x0: cx - meioPoco, x1: cx + meioPoco, cx } }
}

// corredor mais perto de y (índice) e o quanto o centro está longe da linha dele
export function corredorMaisPerto(g, y) {
  let melhor = 0
  for (let k = 1; k < g.linhas.length; k++) if (Math.abs(g.linhas[k] - y) < Math.abs(g.linhas[melhor] - y)) melhor = k
  return { indice: melhor, distancia: Math.abs(g.linhas[melhor] - y) }
}

// Regra do coração em (x, y): devolve a posição corrigida e se está no poço.
// Fora do poço o y fica preso ao corredor mais perto; no meio do caminho entre andares (fora de
// qualquer corredor) o x fica preso ao poço (não dá para sair de lado no meio do ar).
export function prenderNoAndar(g, x, y) {
  const noPoco = x >= g.poco.x0 && x <= g.poco.x1
  if (noPoco) return { x, y, noPoco: true }
  const c = corredorMaisPerto(g, y)
  if (c.distancia > g.corredorMeio) {
    // vazou do poço fora de um corredor: volta para a borda do poço mais perto
    return { x: Math.max(g.poco.x0, Math.min(g.poco.x1, x)), y, noPoco: true }
  }
  const linha = g.linhas[c.indice]
  return { x, y: Math.max(linha - g.corredorMeio, Math.min(linha + g.corredorMeio, y)), noPoco: false }
}

// Quanto do joystick vale no ponto (x, y): fora do poço não sobe/desce; no meio do ar não sai de lado.
export function joyDoElevador(g, x, y, joy) {
  const c = corredorMaisPerto(g, y)
  const noPoco = x >= g.poco.x0 && x <= g.poco.x1
  const noCorredor = c.distancia <= g.corredorMeio
  let { x: jx, y: jy } = joy
  if (!noPoco) {
    const linha = g.linhas[c.indice]
    // no corredor: um pouquinho de folga vertical, nunca sai dele
    if ((y >= linha + g.corredorMeio && jy > 0) || (y <= linha - g.corredorMeio && jy < 0)) jy = 0
  } else if (!noCorredor) {
    // no meio do ar: não sai de lado do poço
    if ((x <= g.poco.x0 + 1 && jx < 0) || (x >= g.poco.x1 - 1 && jx > 0)) jx = 0
  }
  return { x: jx, y: jy }
}

// ---------- TETRIS DE PRÉDIOS ----------
// Uma grade de COLUNAS x LINHAS cobre a caixa. Peças de 4 blocos (tetraminós) caem de cima: a
// sombra do lugar onde vão pousar aparece `avisoMs` antes; elas empilham e viram blocos sólidos;
// linha cheia some (as de cima descem). O plano GARANTE, a cada peça: o espaço livre é UM pedaço
// só (ninguém fica preso), tem pelo menos `livreMin` da grade e a pilha tem no máximo `alturaMax`
// linhas. Se nenhuma posição serve, o prédio é DEMOLIDO (as linhas de baixo somem).
export const TETRIS = { colunas: 11, linhas: 8, alturaMax: 5, livreMin: 0.5, primeiraMs: 450, avisoMs: 700, linhasPorS: 18, folgaMs: { min: 250, max: 450 }, limpaMs: 220, pecas: 9, demolirLinhas: 2, ajudaChance: 0.85 }

const FORMAS_BASE = {
  I: [[0, 0], [1, 0], [2, 0], [3, 0]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[0, 0], [1, 0], [2, 0], [1, 1]],
  L: [[0, 0], [0, 1], [0, 2], [1, 2]],
  J: [[1, 0], [1, 1], [1, 2], [0, 2]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
}
export const NOMES_PECAS = Object.keys(FORMAS_BASE)

const normalizar = (celulas) => {
  const mx = Math.min(...celulas.map(([x]) => x))
  const my = Math.min(...celulas.map(([, y]) => y))
  return celulas.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0])
}
// rotações distintas de uma peça (até 4)
export function rotacoes(nome) {
  const vistas = new Set()
  const lista = []
  let atual = normalizar(FORMAS_BASE[nome])
  for (let k = 0; k < 4; k++) {
    const chave = JSON.stringify(atual)
    if (!vistas.has(chave)) {
      vistas.add(chave)
      lista.push(atual)
    }
    atual = normalizar(atual.map(([x, y]) => [-y, x]))
  }
  return lista
}
export const larguraDaPeca = (cel) => Math.max(...cel.map(([x]) => x)) + 1
export const alturaDaPeca = (cel) => Math.max(...cel.map(([, y]) => y)) + 1

export const gradeVazia = (colunas = TETRIS.colunas, linhas = TETRIS.linhas) => Array.from({ length: linhas }, () => Array(colunas).fill(0))
export const copiarGrade = (g) => g.map((l) => [...l])

// linha onde a peça (celulas normalizadas, canto de cima à esquerda na coluna `col`) pousa caindo
// do alto; null se nem a linha 0 está livre
export function pousoDaPeca(grade, celulas, col) {
  const linhas = grade.length
  const colunas = grade[0].length
  const cabe = (r) => celulas.every(([dx, dy]) => col + dx >= 0 && col + dx < colunas && r + dy >= 0 && r + dy < linhas && !grade[r + dy][col + dx])
  if (!cabe(0)) return null
  let r = 0
  while (cabe(r + 1)) r++
  return r
}

export function inserirPeca(grade, celulas, col, linha, marca = 1) {
  const g = copiarGrade(grade)
  for (const [dx, dy] of celulas) g[linha + dy][col + dx] = marca
  return g
}

export const linhasCheias = (grade) => grade.flatMap((l, r) => (l.every(Boolean) ? [r] : []))

// tira as linhas `rs` e desce o que estava em cima
export function removerLinhas(grade, rs) {
  if (!rs.length) return grade
  const colunas = grade[0].length
  const sobra = grade.filter((_, r) => !rs.includes(r))
  return [...Array.from({ length: rs.length }, () => Array(colunas).fill(0)), ...sobra]
}

// DEMOLIÇÃO: as `n` linhas de baixo somem
export function demolir(grade, n = TETRIS.demolirLinhas) {
  const linhas = grade.length
  return removerLinhas(grade, Array.from({ length: n }, (_, k) => linhas - 1 - k))
}

export const alturaDaPilha = (grade) => {
  const topo = grade.findIndex((l) => l.some(Boolean))
  return topo < 0 ? 0 : grade.length - topo
}

// células livres alcançáveis (4 vizinhos) a partir de (c0, r0)
export function regiaoLivre(grade, c0, r0) {
  const linhas = grade.length
  const colunas = grade[0].length
  if (grade[r0]?.[c0] !== 0) return new Set()
  const visto = new Set([r0 * colunas + c0])
  const fila = [[c0, r0]]
  while (fila.length) {
    const [c, r] = fila.pop()
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nr < 0 || nc >= colunas || nr >= linhas || grade[nr][nc] || visto.has(nr * colunas + nc)) continue
      visto.add(nr * colunas + nc)
      fila.push([nc, nr])
    }
  }
  return visto
}

export const celulasLivres = (grade) => grade.reduce((n, l) => n + l.filter((v) => !v).length, 0)

// a grade é "boa": o espaço livre é um pedaço só, tem o mínimo e a pilha não passa da altura máxima
export function gradeValida(grade, { livreMin = TETRIS.livreMin, alturaMax = TETRIS.alturaMax } = {}) {
  const livres = celulasLivres(grade)
  if (livres < grade.length * grade[0].length * livreMin) return false
  if (alturaDaPilha(grade) > alturaMax) return false
  const primeira = grade.flatMap((l, r) => l.flatMap((v, c) => (v ? [] : [[c, r]])))[0]
  if (!primeira) return false
  return regiaoLivre(grade, primeira[0], primeira[1]).size === livres
}

// prédio já começado: a fileira de baixo com DUAS falhas largas (2 e 3 blocos: dá para fechar com
// uma peça) e uns blocos em cima dela
export function gradeInicial(sorte, { colunas = TETRIS.colunas, linhas = TETRIS.linhas } = {}) {
  for (let tentativa = 0; tentativa < 80; tentativa++) {
    const g = gradeVazia(colunas, linhas)
    const largA = 2 + Math.floor(sorte() * 2)
    const largB = 2 + Math.floor(sorte() * 2)
    const iniA = Math.floor(sorte() * (colunas / 2 - largA - 1)) + 1
    const iniB = Math.floor(colunas / 2) + 1 + Math.floor(sorte() * (colunas / 2 - largB - 2))
    const falhas = new Set()
    for (let k = 0; k < largA; k++) falhas.add(iniA + k)
    for (let k = 0; k < largB; k++) falhas.add(iniB + k)
    for (let c = 0; c < colunas; c++) if (!falhas.has(c)) g[linhas - 1][c] = 1
    for (let c = 0; c < colunas; c++) if (g[linhas - 1][c] && sorte() < 0.22) g[linhas - 2][c] = 1
    g[linhas - 2][Math.floor(colunas / 2)] = 0 // o coração nasce no meio, perto do chão: o lugar dele fica livre
    if (gradeValida(g)) return g
  }
  return gradeVazia(colunas, linhas)
}

// Pontuação de uma jogada (maior = melhor): linhas feitas, pilha baixa, poucos "buracos" embaixo
function notaDaGrade(depois, feitas) {
  let buracos = 0
  for (let c = 0; c < depois[0].length; c++) {
    let coberto = false
    for (let r = 0; r < depois.length; r++) {
      if (depois[r][c]) coberto = true
      else if (coberto) buracos++
    }
  }
  // linhas quase cheias valem mais (o prédio se completa e some em vez de crescer)
  let densidade = 0
  for (const l of depois) {
    const n = l.filter(Boolean).length
    densidade += (n / l.length) ** 2 * 14
  }
  return feitas * 100 + densidade - alturaDaPilha(depois) * 7 - buracos * 5
}

// todas as jogadas válidas de uma peça na grade (com nota)
function candidatosDe(grade, nome, sorte) {
  const lista = []
  for (const [rot, celulas] of rotacoes(nome).entries()) {
    for (let col = 0; col + larguraDaPeca(celulas) <= grade[0].length; col++) {
      const linha = pousoDaPeca(grade, celulas, col)
      if (linha === null) continue
      const cheia = inserirPeca(grade, celulas, col, linha)
      const cheias = linhasCheias(cheia)
      const depois = removerLinhas(cheia, cheias)
      if (!gradeValida(depois)) continue
      lista.push({ rot, celulas, col, linha, cheias, depois, nota: notaDaGrade(depois, cheias.length) + sorte() * 6 })
    }
  }
  return lista
}

// O plano: uma lista de eventos em ordem: { tipo: 'peca', em, forma, rot, col, linha, celulas, cheias, ... } e
// { tipo: 'demolir', em, linhas }. `inicial` é a grade do começo. Aplicar um evento: aplicarEvento(grade, ev).
export function planoTetris(sorte, { pecas = TETRIS.pecas } = {}) {
  const inicial = gradeInicial(sorte)
  let grade = copiarGrade(inicial)
  let em = TETRIS.primeiraMs
  const eventos = []
  for (let k = 0; k < pecas; k++) {
    // a peça da vez: metade das vezes a que melhor encaixa (o prédio se completa e some), senão sorteada
    const doNome = (n) => candidatosDe(grade, n, sorte)
    let nome = sortearDe(sorte, NOMES_PECAS)
    let candidatos = doNome(nome)
    if (sorte() < TETRIS.ajudaChance) {
      for (const n of NOMES_PECAS) {
        const outros = doNome(n)
        if (outros.length && (!candidatos.length || Math.max(...outros.map((o) => o.nota)) > Math.max(...candidatos.map((o) => o.nota)) + 1)) {
          nome = n
          candidatos = outros
        }
      }
    }
    if (!candidatos.length) {
      eventos.push({ tipo: 'demolir', em, linhas: TETRIS.demolirLinhas, avisoMs: TETRIS.avisoMs })
      grade = demolir(grade)
      em += TETRIS.avisoMs + 500
      k-- // a mesma peça tenta de novo depois da demolição (a grade menor sempre aceita)
      if (eventos.length > pecas * 3) break
      continue
    }
    candidatos.sort((a, b) => b.nota - a.nota)
    const c = candidatos[Math.min(candidatos.length - 1, Math.floor(sorte() * Math.min(3, candidatos.length)))]
    const alt = alturaDaPeca(c.celulas)
    const quedaMs = ((c.linha + alt) / TETRIS.linhasPorS) * 1000
    const pousoEm = em + TETRIS.avisoMs + quedaMs
    eventos.push({
      tipo: 'peca',
      em,
      forma: nome,
      rot: c.rot,
      col: c.col,
      linha: c.linha,
      celulas: c.celulas,
      cheias: c.cheias,
      avisoMs: TETRIS.avisoMs,
      quedaMs,
      pousoEm,
    })
    grade = c.depois
    em = pousoEm + (c.cheias.length ? TETRIS.limpaMs : 0) + entre(sorte, TETRIS.folgaMs.min, TETRIS.folgaMs.max)
  }
  return { inicial, eventos }
}

// Aplica um evento do plano na grade (a regra única, usada pelo plano e pelo visual)
export function aplicarEvento(grade, ev) {
  if (ev.tipo === 'demolir') return demolir(grade, ev.linhas)
  const cheia = inserirPeca(grade, ev.celulas, ev.col, ev.linha)
  return removerLinhas(cheia, linhasCheias(cheia))
}

// Posição (px) das células da grade dentro de uma caixa { left, top, width, height }
export function retanguloDaCelula(l, grade, c, r) {
  const cw = l.width / grade[0].length
  const ch = l.height / grade.length
  return { x: l.left + c * cw, y: l.top + r * ch, w: cw, h: ch }
}

// O quadrado do coração (centro x, y; meio = meia largura) encosta numa célula cheia?
export function coracaoBate(l, grade, x, y, meio) {
  const cw = l.width / grade[0].length
  const ch = l.height / grade.length
  const dentro = (px, py) => {
    const c = Math.floor((px - l.left) / cw)
    const r = Math.floor((py - l.top) / ch)
    return c >= 0 && c < grade[0].length && r >= 0 && r < grade.length && Boolean(grade[r][c])
  }
  return dentro(x - meio, y - meio) || dentro(x + meio, y - meio) || dentro(x - meio, y + meio) || dentro(x + meio, y + meio)
}

// Empurra o coração (centro x, y; meio = meia largura) para fora das células cheias. Devolve { x, y, preso }.
export function empurrarParaFora(l, grade, x, y, meio) {
  const cw = l.width / grade[0].length
  const ch = l.height / grade.length
  const colunas = grade[0].length
  const linhas = grade.length
  const dentro = (px, py) => {
    const c = Math.floor((px - l.left) / cw)
    const r = Math.floor((py - l.top) / ch)
    return c >= 0 && c < colunas && r >= 0 && r < linhas && grade[r][c]
  }
  const bate = (px, py) => dentro(px - meio, py - meio) || dentro(px + meio, py - meio) || dentro(px - meio, py + meio) || dentro(px + meio, py + meio)
  let px = x
  let py = y
  for (let volta = 0; volta < 6 && bate(px, py); volta++) {
    const c0 = Math.floor((px - l.left) / cw)
    const r0 = Math.floor((py - l.top) / ch)
    let melhor = null
    // varre as células vizinhas cheias que o quadrado do coração encosta e escolhe a saída mais curta
    for (let r = Math.max(0, r0 - 1); r <= Math.min(linhas - 1, r0 + 1); r++) {
      for (let c = Math.max(0, c0 - 1); c <= Math.min(colunas - 1, c0 + 1); c++) {
        if (!grade[r][c]) continue
        const x0 = l.left + c * cw
        const x1 = x0 + cw
        const y0 = l.top + r * ch
        const y1 = y0 + ch
        if (px + meio <= x0 || px - meio >= x1 || py + meio <= y0 || py - meio >= y1) continue
        const saidas = [
          { dx: x0 - meio - px, dy: 0 },
          { dx: x1 + meio - px, dy: 0 },
          { dx: 0, dy: y0 - meio - py },
          { dx: 0, dy: y1 + meio - py },
        ]
        for (const s of saidas) {
          const dist = Math.abs(s.dx) + Math.abs(s.dy)
          if (!melhor || dist < melhor.dist) melhor = { ...s, dist }
        }
      }
    }
    if (!melhor) break
    px += melhor.dx
    py += melhor.dy
    px = Math.max(l.left + meio, Math.min((l.right ?? l.left + l.width) - meio, px))
    py = Math.max(l.top + meio, Math.min((l.bottom ?? l.top + l.height) - meio, py))
  }
  if (bate(px, py)) {
    // ainda preso (peça pousou em cima): vai para o centro da célula livre mais perto
    let melhor = null
    for (let r = 0; r < linhas; r++) {
      for (let c = 0; c < colunas; c++) {
        if (grade[r][c]) continue
        const cx = l.left + (c + 0.5) * cw
        const cy = l.top + (r + 0.5) * ch
        const d = Math.hypot(cx - x, cy - y)
        if (!melhor || d < melhor.d) melhor = { cx, cy, d }
      }
    }
    if (melhor) return { x: melhor.cx, y: melhor.cy, preso: true }
  }
  return { x: px, y: py, preso: false }
}

// ---------- FAIXA DE PEDESTRE ----------
// O chão é uma faixa de pedestres: LISTRAS horizontais, uma branca, uma preta... Semáforo VERMELHO: só as
// listras BRANCAS são seguras (as pretas machucam); VERDE: só as PRETAS. Troca com contagem 3-2-1 (as
// listras que vão machucar piscam em vermelho). Logo depois da troca há uma folga curta (`gracaMs`).
export const FAIXA = { listras: 8, quentaFrac: 0.8, primeiraFaseMs: 2500, faseMs: { min: 2800, max: 3600 }, contagemMs: 2100, gracaMs: 450, fases: 8 }
export const LUZES = ['vermelho', 'verde']

// listra k (0 = de cima) é branca se k é par
export const listraBranca = (k) => k % 2 === 0
// numa luz, a listra k é segura?
export const listraSegura = (luz, k) => (luz === 'vermelho' ? listraBranca(k) : !listraBranca(k))

export function planoFaixa(sorte, { fases = FAIXA.fases } = {}) {
  let luz = sorte() < 0.5 ? 'vermelho' : 'verde'
  const inicial = luz
  let em = 0
  const lista = []
  for (let k = 0; k < fases; k++) {
    const dura = k === 0 ? FAIXA.primeiraFaseMs : entre(sorte, FAIXA.faseMs.min, FAIXA.faseMs.max)
    lista.push({ em, fim: em + dura, luz })
    em += dura
    luz = luz === 'vermelho' ? 'verde' : 'vermelho'
  }
  return { inicial, fases: lista }
}

// Estado da faixa no instante t: { luz, falta (ms até trocar), contagem (3,2,1 ou 0), perigosa(k) }
export function estadoDaFaixa(plano, t) {
  const fase = plano.fases.find((f) => t >= f.em && t < f.fim) ?? plano.fases[plano.fases.length - 1]
  const falta = Math.max(0, fase.fim - t)
  const contagem = falta <= FAIXA.contagemMs ? Math.min(3, Math.ceil(falta / (FAIXA.contagemMs / 3))) : 0
  const desde = t - fase.em
  return { luz: fase.luz, falta, contagem, desde, graca: fase.em > 0 && desde < FAIXA.gracaMs, proxima: fase.luz === 'vermelho' ? 'verde' : 'vermelho' }
}

// A listra machuca agora? (a luz atual a proíbe e a folga da troca já passou)
export function listraMachuca(plano, t, k) {
  const e = estadoDaFaixa(plano, t)
  if (t < FAIXA.primeiraFaseMs * 0.4) return false // começo da esquiva: tempo para ler a regra
  return !listraSegura(e.luz, k) && !e.graca
}

// ---------- SELFIE ----------
// Contagem 3-2-1 (`numeroMs` cada) e o FLASH: o coração congela `congelaMs`. A contagem toda é o aviso.
export const SELFIE = { primeiraMs: 500, numeroMs: 600, congelaMs: 800, folgaMs: { min: 1100, max: 1600 }, fotos: 6 }

export function planoSelfie(sorte, { fotos = SELFIE.fotos } = {}) {
  const lista = []
  let em = SELFIE.primeiraMs
  for (let k = 0; k < fotos; k++) {
    const flashEm = em + SELFIE.numeroMs * 3
    lista.push({ em, flashEm, fimEm: flashEm + SELFIE.congelaMs })
    em = flashEm + SELFIE.congelaMs + entre(sorte, SELFIE.folgaMs.min, SELFIE.folgaMs.max)
  }
  return lista
}

// estado no instante t: 'livre' | 'contagem' (numero 3,2,1) | 'congelado'
export function estadoDoSelfie(plano, t) {
  for (const f of plano) {
    if (t >= f.flashEm && t < f.fimEm) return { fase: 'congelado', restante: f.fimEm - t, foto: f }
    if (t >= f.em && t < f.flashEm) return { fase: 'contagem', numero: Math.min(3, Math.ceil((f.flashEm - t) / SELFIE.numeroMs)), foto: f }
  }
  return { fase: 'livre' }
}

// ---------- ENTREGA ----------
// Um pacote por vez: a marca de RETIRADA aparece (anel fechando `avisoMs`), depois vale pegar; pegou,
// o destino (ENTREGAR AQUI) acende. Quem não pega/entrega até o fim da vaga perde o pacote (sem castigo).
// A cada `expressaCada` pacotes vem um EXPRESSO (dourado, vale mais energia).
export const ENTREGA = { primeiraMs: 300, vagaMs: 3700, avisoMs: 600, energia: 1, energiaExpresso: 2, expressaCada: 3, pacotes: 8, distanciaMinFrac: 0.45, margem: 0.14 }

export function planoEntrega(sorte, { pacotes = ENTREGA.pacotes } = {}) {
  const lista = []
  let em = ENTREGA.primeiraMs
  const m = ENTREGA.margem
  for (let k = 0; k < pacotes; k++) {
    let origem
    let destino
    for (let tentativa = 0; tentativa < 40; tentativa++) {
      origem = { fx: entre(sorte, m, 1 - m), fy: entre(sorte, m + 0.04, 1 - m - 0.04) }
      destino = { fx: entre(sorte, m, 1 - m), fy: entre(sorte, m + 0.04, 1 - m - 0.04) }
      if (Math.hypot((origem.fx - destino.fx) * REF_CAIXA.largura, (origem.fy - destino.fy) * REF_CAIXA.altura) >= ENTREGA.distanciaMinFrac * REF_CAIXA.largura) break
    }
    const expresso = (k + 1) % ENTREGA.expressaCada === 0
    lista.push({ em, valeEm: em + ENTREGA.avisoMs, fimEm: em + ENTREGA.vagaMs, origem, destino, expresso, energia: expresso ? ENTREGA.energiaExpresso : ENTREGA.energia })
    em += ENTREGA.vagaMs + 250
  }
  return lista
}

// qual pacote do plano está na vaga no instante t (ou null)
export const pacoteEm = (plano, t) => plano.find((p) => t >= p.em && t < p.fimEm) ?? null

// ---------- ESCADA ROLANTE ----------
// O chão são FAIXAS horizontais de esteira de sentidos opostos; elas carregam o coração (somam à
// velocidade dele, sempre bem abaixo dela: dá para andar contra). De tempos em tempos TODAS invertem de
// sentido (aviso `avisoMs` antes).
export const ESCADA = { faixas: 4, velocidade: { min: 52, max: 84 }, primeiraInversaoMs: 2300, periodoMs: { min: 2700, max: 3500 }, avisoMs: 850, inversoes: 10 }

export function planoEscada(sorte, { inversoes = ESCADA.inversoes } = {}) {
  const sentidoInicial = sorte() < 0.5 ? 1 : -1
  const faixas = Array.from({ length: ESCADA.faixas }, (_, k) => ({ sentido: k % 2 === 0 ? sentidoInicial : -sentidoInicial, velocidade: Math.round(entre(sorte, ESCADA.velocidade.min, ESCADA.velocidade.max)) }))
  const lista = []
  let em = ESCADA.primeiraInversaoMs
  for (let k = 0; k < inversoes; k++) {
    lista.push({ em, avisoEm: em - ESCADA.avisoMs })
    em += entre(sorte, ESCADA.periodoMs.min, ESCADA.periodoMs.max)
  }
  return { faixas, inversoes: lista }
}

// velocidade (px/s, + = direita) da faixa k no instante t (cada inversão passada troca o sentido de todas)
export function velocidadeDaFaixa(plano, k, t) {
  const f = plano.faixas[k]
  const trocas = plano.inversoes.filter((i) => t >= i.em).length
  return f.sentido * (trocas % 2 ? -1 : 1) * f.velocidade
}

// em que faixa (0 = de cima) está a altura y numa caixa { top, height }
export const faixaDaEsteira = (l, y, n = ESCADA.faixas) => Math.max(0, Math.min(n - 1, Math.floor(((y - l.top) / l.height) * n)))

// o aviso de cada plano nunca é menor que o telégrafo mínimo (conferido nos testes)
export const AVISOS = { gps: GPS.avisoMs, camera: CAMERA.avisoMs, tetris: TETRIS.avisoMs, faixa: FAIXA.contagemMs / 3, selfie: SELFIE.numeroMs * 3, entrega: ENTREGA.avisoMs, escada: ESCADA.avisoMs, minimo: ATAQUE.telegrafoMs }
