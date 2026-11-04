import { aleatorio } from '../pvp/baralho.js'
import { circuloGiz, coracaoGiz, contornoDoCoracao, estrelaGiz, linhaGiz, poligonoGiz, preencherGiz, setaGiz, xGiz } from './giz.js'
import { PALETA } from './cera.js'
import { elipse } from './ralsei.js'

// Os desenhos do manual (só DADOS, sem Phaser): traços (giz.js) e camadas para cera.pintarDesenho
// ({ tipo: 'traco' | 'preencher' | 'mancha', ... }). O Ralsei fica em ralsei.js.

export const CORES_GIZ = {
  tinta: PALETA.tinta,
  grafite: PALETA.azulEscuro, // borda da caixa
  coracao: PALETA.coracao,
  coracaoEscuro: 0xa50e26,
  bala: PALETA.bala,
  balaMiolo: PALETA.balaMiolo,
  marca: PALETA.amarelo,
  marcaContorno: 0xc27c00,
  marcaX: PALETA.marcaX,
  certo: PALETA.certo,
}

const traco = (tracos, cor, largura = 2.6, extra = {}) => ({ tipo: 'traco', tracos, cor, largura, ...extra })
const preencher = (poligono, cor, extra = {}) => ({ tipo: 'preencher', poligono, cor, ...extra })

// ---------- coração, bala, marcas ----------

// Uma variante de giz do coração do jogador, centrada na origem. `largura` = tamanho visual; a colisão é
// o miolo CORACAO.hitbox (pintado à parte, exato), independente disto.
//   contorno/preenchimento: traços (o "desenhando" corta pelo progresso); camadas: a versão assada
// op: { cor, escura } (o coração de giz do Ralsei, na demonstração da página 2, é verde)
export function rabiscoDoCoracao(rng, largura = 22, { cor = CORES_GIZ.coracao, escura = CORES_GIZ.coracaoEscuro } = {}) {
  const miolo = contornoDoCoracao(0, 0, largura - 3, 28)
  const contorno = coracaoGiz(rng, 0, 0, largura, { tremor: 0.55, passo: 3.2, rabo: 0.05 })
  const preenchimento = preencherGiz(rng, miolo, { espaco: 2.6, angulo: -0.7, tremor: 0.4, folga: 0.5 })
  return {
    contorno,
    preenchimento,
    camadas: [preencher(miolo, cor, { espaco: 2.2, angulo: -0.7, mancha: 0.55 }), traco(contorno, escura, 2.4, { passadas: 2 })],
  }
}

// Bala de giz: bolinha cheia + contorno, centrada na origem. Tremor baixo: o desenho nunca passa
// de ~1,5 px da forma exata da bala (a hitbox continua o círculo de raio `raio`).
export function rabiscoDaBala(rng, raio) {
  const poli = elipse(0, 0, raio - 0.5, raio - 0.5, 16)
  const contorno = circuloGiz(rng, 0, 0, raio, { tremor: 0.5, passo: 3.4, rabo: 0.06 })
  return {
    contorno,
    preenchimento: preencherGiz(rng, poli, { espaco: 2.4, angulo: aleatorio(rng) * 3, tremor: 0.3, folga: 0.4 }),
    camadas: [preencher(poli, CORES_GIZ.balaMiolo, { espaco: 2, angulo: aleatorio(rng) * 3, mancha: 0.6 }), traco(contorno, CORES_GIZ.bala, 2.6, { passadas: 2 })],
  }
}

// estrela "gorda" (polígono de 2n pontos), a de adesivo e a de marca
export function estrelaGorda(cx, cy, rExt, rInt = rExt * 0.5, n = 5, giro = 0) {
  return Array.from({ length: n * 2 }, (_, i) => {
    const a = -Math.PI / 2 + giro + (i * Math.PI) / n
    const r = i % 2 ? rInt : rExt
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
  })
}

// marca: estrela amarela cheia (contorno cor de mel) ou X verde-água; `tracos` é o que o giz risca no "desenhando"
export function rabiscoDaMarca(rng, forma, r = 13) {
  if (forma === 'x') {
    const t = xGiz(rng, 0, 0, r, { tremor: 0.8 })
    return { tracos: t, camadas: [traco(t, CORES_GIZ.marcaX, 4, { passadas: 3 })] }
  }
  const poli = estrelaGorda(0, 0, r, r * 0.48, 5, (aleatorio(rng) - 0.5) * 0.3)
  const t = poligonoGiz(rng, poli, { tremor: 0.6, excesso: 1 })
  return { tracos: t, camadas: [preencher(poli, CORES_GIZ.marca, { espaco: 2, mancha: 0.6 }), traco(t, CORES_GIZ.marcaContorno, 2.4, { passadas: 2 })] }
}

// a seta torta do "este é você" (em coordenadas absolutas)
export const rabiscoDaSeta = (rng, x0, y0, x1, y1) => setaGiz(rng, x0, y0, x1, y1, { tremor: 1.1 })

// o risco de baixo de um título
export const sublinhado = (rng, x0, y, x1) => linhaGiz(rng, x0, y, x1, y + (aleatorio(rng) * 2 - 1) * 2, { tracos: 2, tremor: 1.3, excesso: 4 })

// ---------- balão de fala ----------

// Contorno de um balão: retângulo de cantos bem redondos, bordas que ondulam de leve e um rabinho
// saindo da borda de baixo até `cauda` ({ x, y } = a ponta; { de } = x onde o rabinho começa).
export function contornoDoBalao(rng, x, y, largura, altura, cauda, { raio = 22, onda = 1.6 } = {}) {
  const pts = []
  const canto = (cx, cy, a0) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2)
      pts.push({ x: cx + Math.cos(a) * raio, y: cy + Math.sin(a) * raio })
    }
  }
  const lado = (x0, y0, x1, y1, n) => {
    for (let i = 1; i < n; i++) pts.push({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n })
  }
  const r = raio
  canto(x + r, y + r, Math.PI) // cima-esquerda
  lado(x + r, y, x + largura - r, y, 8)
  canto(x + largura - r, y + r, -Math.PI / 2)
  lado(x + largura, y + r, x + largura, y + altura - r, 4)
  canto(x + largura - r, y + altura - r, 0)
  // embaixo, da direita para a esquerda, com o rabinho
  const de = cauda?.de ?? x + largura * 0.3
  const base = y + altura
  const boca = cauda?.largura ?? 26 // a largura do rabinho onde ele sai do balão
  lado(x + largura - r, base, de + boca, base, 6)
  if (cauda) {
    pts.push({ x: de + boca, y: base })
    pts.push({ x: (de + boca + cauda.x) / 2 + 3, y: (base + cauda.y) / 2 })
    pts.push({ x: cauda.x, y: cauda.y })
    pts.push({ x: (de + cauda.x) / 2 - 2, y: (base + cauda.y) / 2 - 4 })
    pts.push({ x: de, y: base })
  }
  lado(de, base, x + r, base, 4)
  canto(x + r, y + altura - r, Math.PI / 2)
  lado(x, y + altura - r, x, y + r, 4)
  // ondinha suave (as bordas de quem desenha à mão), perpendicular ao centro
  const cx = x + largura / 2
  const cy = y + altura / 2
  const fase = aleatorio(rng) * 6.28
  return pts.map((p, i) => {
    const dx = p.x - cx
    const dy = p.y - cy
    const m = Math.hypot(dx, dy) || 1
    const d = onda * Math.sin(i * 0.45 + fase) + (aleatorio(rng) - 0.5) * 0.6
    return { x: p.x + (dx / m) * d, y: p.y + (dy / m) * d }
  })
}

// a borda dupla do balão: o contorno fechado duas vezes, começando em pontos diferentes (o giz que volta)
export function bordaDoBalao(rng, poligono) {
  const fechado = (inicio, j) => {
    const n = poligono.length
    const t = []
    for (let i = 0; i <= n + 2; i++) {
      const p = poligono[(inicio + i) % n]
      t.push({ x: p.x + (aleatorio(rng) - 0.5) * j, y: p.y + (aleatorio(rng) - 0.5) * j })
    }
    return t
  }
  return [fechado(0, 0.6), fechado(Math.floor(poligono.length / 3), 1.6)]
}

// ---------- letras de título ----------

// Cada letra um tiquinho torta (subida, giro e tamanho), como letra desenhada com cuidado. O texto em si
// continua a fonte clara; só o título usa isto.
export function letrasTortas(rng, texto) {
  return [...texto].map((ch, i) => ({
    ch,
    dy: Math.sin(i * 1.7 + aleatorio(rng) * 2) * 1.6,
    giro: (aleatorio(rng) - 0.5) * 0.12,
    escala: 0.97 + aleatorio(rng) * 0.08,
  }))
}

// ---------- rabiscos de margem ----------

const COR_MARGEM = [PALETA.rosa, PALETA.azul, PALETA.lavanda, PALETA.amarelo]

// Doodles coloridos nas sobras da folha: um sol sorrindo, uma nuvem, coraçõezinhos, estrelinhas e
// uma trilha de patinhas. `pontos` = onde (o layout da página decide); cada um { tipo, x, y, r?, cor? }.
export function rabiscosDaMargem(rng, pontos) {
  const c = []
  for (const [i, p] of pontos.entries()) {
    const cor = p.cor ?? COR_MARGEM[i % COR_MARGEM.length]
    const r = p.r ?? 7
    if (p.tipo === 'sol') {
      const disco = elipse(p.x, p.y, r, r, 20)
      c.push(preencher(disco, PALETA.amarelo, { espaco: 2.6, mancha: 0.5, alpha: 0.9 }))
      c.push(traco(circuloGiz(rng, p.x, p.y, r, { tremor: 0.6 }), PALETA.ouro, 2.2, { passadas: 2 }))
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + 0.2
        c.push(traco(linhaGiz(rng, p.x + Math.cos(a) * (r + 4), p.y + Math.sin(a) * (r + 4), p.x + Math.cos(a) * (r + 10), p.y + Math.sin(a) * (r + 10), { tracos: 1, excesso: 0.5, tremor: 0.4 }), PALETA.amarelo, 2.6, { passadas: 2 }))
      }
      for (const l of [-1, 1]) c.push({ tipo: 'mancha', poligono: elipse(p.x + l * r * 0.35, p.y - r * 0.15, 1.5, 1.9, 8), cor: PALETA.tinta, alpha: 0.85 })
      c.push(traco([[{ x: p.x - r * 0.4, y: p.y + r * 0.2 }, { x: p.x, y: p.y + r * 0.48 }, { x: p.x + r * 0.4, y: p.y + r * 0.2 }]], PALETA.tinta, 1.6, { passadas: 2 }))
    } else if (p.tipo === 'nuvem') {
      const nuvem = []
      for (const [dx, dy, rr] of [[-14, 2, 9], [-4, -5, 11], [9, -2, 10], [17, 4, 7]]) nuvem.push(...circuloGiz(rng, p.x + dx, p.y + dy, rr, { tracos: 1, tremor: 0.4, rabo: 0.02 }))
      c.push(traco(nuvem, PALETA.azul, 2, { alpha: 0.75, passadas: 2 }))
    } else if (p.tipo === 'coracao') {
      const poli = contornoDoCoracao(p.x, p.y, r * 2, 22)
      c.push(preencher(poli, cor, { espaco: 2, alpha: 0.7 }))
      c.push(traco(coracaoGiz(rng, p.x, p.y, r * 2, { tracos: 1, tremor: 0.4 }), cor, 1.8, { passadas: 2 }))
    } else if (p.tipo === 'estrela') {
      c.push(traco(estrelaGiz(rng, p.x, p.y, r, { tremor: 0.4 }), cor, 2, { passadas: 2, alpha: 0.85 }))
    } else if (p.tipo === 'pata') {
      const giro = p.giro ?? 0
      const rot = (dx, dy) => ({ x: p.x + dx * Math.cos(giro) - dy * Math.sin(giro), y: p.y + dx * Math.sin(giro) + dy * Math.cos(giro) })
      const almofada = elipse(0, 0, r * 0.62, r * 0.5, 14).map((q) => rot(q.x, q.y + r * 0.2))
      c.push({ tipo: 'mancha', poligono: almofada, cor, alpha: 0.55 })
      for (const [dx, dy] of [[-0.62, -0.42], [-0.22, -0.78], [0.22, -0.78], [0.62, -0.42]]) {
        c.push({ tipo: 'mancha', poligono: elipse(0, 0, r * 0.2, r * 0.24, 10).map((q) => rot(q.x + dx * r, q.y + dy * r)), cor, alpha: 0.55 })
      }
    }
  }
  return c
}

// ---------- adesivos das mini-lições (página 2) ----------

// a gota (polígono): a parte de baixo redonda e a ponta para cima
export function contornoDaGota(cx, cy, r) {
  const R = r * 0.62
  const yc = cy + r * 0.22
  const pts = []
  for (let i = 0; i <= 18; i++) {
    const a = -0.45 + (i / 18) * (Math.PI + 0.9)
    pts.push({ x: cx + Math.cos(a) * R, y: yc + Math.sin(a) * R })
  }
  pts.push({ x: cx, y: cy - r })
  return pts
}

// O desenho de giz do adesivo de cada mini-lição, centrado na origem (cabe num círculo de raio ~r):
//   chuva: uma gota azul · linha: a fileira com o buraco · mira: o alvo com a linha pontilhada
export function iconeDaLicao(rng, id, r = 11) {
  if (id === 'chuva') {
    const g = contornoDaGota(0, 0, r)
    return [preencher(g, PALETA.azul, { espaco: 1.8, mancha: 0.7 }), traco([[...g, g[0]]], PALETA.azulEscuro, 1.8, { passadas: 2 }), traco([[{ x: -r * 0.28, y: r * 0.05 }, { x: -r * 0.18, y: r * 0.35 }]], 0xffffff, 1.6, { alpha: 0.8, passadas: 1 })]
  }
  if (id === 'linha') {
    const c = []
    for (const y of [-r * 0.85, -r * 0.35, r * 0.75]) {
      const bola = elipse(0, y, r * 0.24, r * 0.24, 12)
      c.push(preencher(bola, PALETA.lavanda, { espaco: 1.4, mancha: 0.8 }), traco([[...bola, bola[0]]], PALETA.bala, 1.4, { passadas: 1 }))
    }
    // a setinha passando pelo buraco
    c.push(traco(linhaGiz(rng, -r * 0.9, r * 0.2, r * 0.9, r * 0.2, { tracos: 1, tremor: 0.3, excesso: 0 }), PALETA.coracao, 1.8, { passadas: 2 }))
    c.push(traco([[{ x: r * 0.55, y: r * 0.02 }, { x: r * 0.9, y: r * 0.2 }, { x: r * 0.55, y: r * 0.38 }]], PALETA.coracao, 1.8, { passadas: 2 }))
    return c
  }
  if (id === 'mira') {
    const c = []
    for (const [rr, cor] of [[r * 0.85, PALETA.rosa], [r * 0.5, PALETA.rosaEscuro]]) c.push(traco(circuloGiz(rng, 0, 0, rr, { tremor: 0.3, tracos: 1 }), cor, 1.8, { passadas: 2 }))
    c.push({ tipo: 'mancha', poligono: elipse(0, 0, r * 0.18, r * 0.18, 10), cor: PALETA.coracao, alpha: 1 })
    return c
  }
  return []
}

// a linha pontilhada de giz do aviso de um tiro: de onde a bala está até sair do outro lado da caixa
// (só os pontos; o desenho é só informação, nunca entra na colisão)
export function pontosDaMira(linha, caixa, { espaco = 11, alem = 6 } = {}) {
  const { x, y, dx, dy } = linha
  // até onde a reta vai dentro (e um tiquinho além) da caixa
  let tSai = Infinity
  if (dx > 0) tSai = Math.min(tSai, (caixa.direita - x) / dx)
  if (dx < 0) tSai = Math.min(tSai, (caixa.esquerda - x) / dx)
  if (dy > 0) tSai = Math.min(tSai, (caixa.base - y) / dy)
  if (dy < 0) tSai = Math.min(tSai, (caixa.topo - y) / dy)
  if (!Number.isFinite(tSai)) return []
  const pts = []
  for (let t = espaco; t <= tSai + alem; t += espaco) pts.push({ x: x + dx * t, y: y + dy * t })
  return pts
}

// ---------- páginas de cartas (3 e 4) ----------

// retângulo de cantos redondos (polígono), o formato das cartas e da pílula
export function retanguloRedondo(x, y, largura, altura, raio = 8, n = 5) {
  const r = Math.min(raio, largura / 2, altura / 2)
  const pts = []
  const canto = (cx, cy, a0) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2)
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
    }
  }
  canto(x + largura - r, y + r, -Math.PI / 2)
  canto(x + largura - r, y + altura - r, 0)
  canto(x + r, y + altura - r, Math.PI / 2)
  canto(x + r, y + r, Math.PI)
  return pts
}

const fechar = (poli) => [[...poli, poli[0], poli[1]]]
const estrelinha = (rng, x, y, r, cor, contorno) => {
  const poli = estrelaGorda(x, y, r, r * 0.5, 5, (aleatorio(rng) - 0.5) * 0.4)
  return [preencher(poli, cor, { espaco: 1.6, mancha: 0.7 }), traco(fechar(poli), contorno, 1.6, { passadas: 2 })]
}

// O desenho do miolo de cada carta (centrado na origem, cabe em ~r de raio), pelo ataque dela:
//   estrela (Estrela Gentil): estrela cadente com rastro · ninar: duas notas na pauta · bolinho: cupcake
//   coro: três estrelinhas cantando em arco · super: estrelona arco-íris · passar: seta que volta + gema
export function desenhoDaCarta(rng, id, r = 20) {
  if (id === 'estrela') {
    const c = []
    for (const k of [0, 1, 2]) c.push(traco(linhaGiz(rng, -r * 0.95 + k * 5, -r * 0.9 - k * 2, -r * 0.2 + k * 4, -r * 0.15 - k * 3, { tracos: 1, tremor: 0.3, excesso: 0 }), PALETA.amarelo, 2, { passadas: 1, alpha: 0.75 }))
    c.push(...estrelinha(rng, r * 0.25, r * 0.25, r * 0.62, PALETA.amarelo, PALETA.ouro))
    return c
  }
  if (id === 'ninar') {
    const c = []
    for (let k = 0; k < 3; k++) c.push(traco(linhaGiz(rng, -r, -r * 0.45 + k * r * 0.45, r, -r * 0.45 + k * r * 0.45, { tracos: 1, tremor: 0.3, excesso: 0 }), PALETA.lavanda, 1.3, { passadas: 1, alpha: 0.8 }))
    for (const [x, y] of [[-r * 0.45, r * 0.2], [r * 0.4, -r * 0.2]]) {
      c.push({ tipo: 'mancha', poligono: elipse(x, y, r * 0.24, r * 0.18, 12), cor: PALETA.azulEscuro, alpha: 1 })
      c.push(traco([[{ x: x + r * 0.22, y }, { x: x + r * 0.22, y: y - r * 0.8 }, { x: x + r * 0.5, y: y - r * 0.55 }]], PALETA.azulEscuro, 2, { passadas: 2 }))
    }
    return c
  }
  if (id === 'bolinho') {
    const forma = [{ x: -r * 0.55, y: 0 }, { x: r * 0.55, y: 0 }, { x: r * 0.4, y: r * 0.75 }, { x: -r * 0.4, y: r * 0.75 }]
    const cobertura = elipse(0, -r * 0.05, r * 0.66, r * 0.42, 18).filter((q) => q.y <= r * 0.05)
    return [
      preencher(forma, PALETA.azul, { espaco: 1.6, mancha: 0.7 }),
      traco(fechar(forma), PALETA.azulEscuro, 1.6, { passadas: 2 }),
      preencher(cobertura, PALETA.rosa, { espaco: 1.5, mancha: 0.8 }),
      traco([cobertura], PALETA.rosaEscuro, 1.6, { passadas: 2 }),
      { tipo: 'mancha', poligono: elipse(0, -r * 0.55, r * 0.16, r * 0.16, 10), cor: PALETA.coracao, alpha: 1 },
      traco([[{ x: r * 0.05, y: -r * 0.68 }, { x: r * 0.25, y: -r * 0.95 }]], PALETA.verdeEscuro, 1.4, { passadas: 1 }),
      // as faíscas do estouro
      ...[[-0.95, -0.6], [0.95, -0.55], [-0.85, 0.5], [0.9, 0.45]].map(([dx, dy]) => traco(xGiz(rng, dx * r, dy * r, r * 0.13, { tremor: 0.2 }), PALETA.amarelo, 1.6, { passadas: 1 })),
    ]
  }
  if (id === 'coro') {
    const c = [traco([[{ x: -r, y: r * 0.1 }, { x: -r * 0.5, y: -r * 0.5 }, { x: 0, y: -r * 0.7 }, { x: r * 0.5, y: -r * 0.5 }, { x: r, y: r * 0.1 }]], PALETA.lavanda, 1.4, { passadas: 1, alpha: 0.7 })]
    for (const [x, y] of [[-r * 0.6, -r * 0.2], [0, -r * 0.5], [r * 0.6, -r * 0.2]]) c.push(...estrelinha(rng, x, y, r * 0.32, PALETA.amarelo, PALETA.ouro))
    for (const x of [-r * 0.4, 0, r * 0.4]) c.push(traco(linhaGiz(rng, x, r * 0.15, x + r * 0.08, r * 0.75, { tracos: 1, tremor: 0.2, excesso: 0 }), PALETA.rosa, 1.6, { passadas: 1 }))
    return c
  }
  if (id === 'super') {
    const c = []
    for (const [k, cor] of [PALETA.coracao, PALETA.amarelo, PALETA.verde, PALETA.azul].entries()) c.push(traco(circuloGiz(rng, 0, r * 0.15, r * (0.95 - k * 0.14), { tremor: 0.3, tracos: 1 }).map((t) => t.filter((q) => q.y <= r * 0.15)), cor, 1.8, { passadas: 1 }))
    c.push(...estrelinha(rng, 0, -r * 0.05, r * 0.55, PALETA.amarelo, PALETA.ouro))
    return c
  }
  if (id === 'passar') {
    // a setinha que dá a volta (a vez passa) e uma gema embaixo
    const arco = []
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * 1.05 - (i / 14) * Math.PI * 1.25
      arco.push({ x: Math.cos(a) * r * 0.7, y: -r * 0.2 - Math.sin(a) * r * 0.5 })
    }
    const fim = arco[arco.length - 1]
    return [
      traco([arco], PALETA.verdeEscuro, 2.4, { passadas: 2 }),
      traco([[{ x: fim.x - r * 0.3, y: fim.y - r * 0.12 }, fim, { x: fim.x - r * 0.05, y: fim.y - r * 0.4 }]], PALETA.verdeEscuro, 2.4, { passadas: 2 }),
      ...rabiscoDaGema(rng, r * 0.4, { x: 0, y: r * 0.55 }).camadas,
    ]
  }
  return []
}

export const CORES_GEMA = { cheia: 0x3cc8ff, escura: 0x0b4a72, clara: 0xc8f4ff, vazia: 0x8f9bb8, bloqueada: 0x8a2a3a, bloqueadaEscura: 0x3a0a14 }

// a gema de energia (o losango do HUD real, em giz): cheia (azul), vazia (só o contorno) ou bloqueada (vermelha)
export function losango(x, y, r) {
  return [{ x, y: y - r }, { x: x + r * 0.86, y }, { x, y: y + r }, { x: x - r * 0.86, y }]
}
export function rabiscoDaGema(rng, r = 8, { x = 0, y = 0, estado = 'cheia' } = {}) {
  const poli = losango(x, y, r)
  const contorno = poligonoGiz(rng, poli, { tremor: 0.35, excesso: 0.6 })
  if (estado === 'vazia') return { camadas: [traco(contorno, CORES_GEMA.vazia, 1.8, { passadas: 2, alpha: 0.9 })] }
  const [cor, escura] = estado === 'bloqueada' ? [CORES_GEMA.bloqueada, CORES_GEMA.bloqueadaEscura] : [CORES_GEMA.cheia, CORES_GEMA.escura]
  const brilho = [{ x, y: y - r * 0.72 }, { x: x + r * 0.28, y: y - r * 0.15 }, { x, y }, { x: x - r * 0.28, y: y - r * 0.15 }]
  return { camadas: [preencher(poli, cor, { espaco: 1.5, mancha: 0.85 }), traco(contorno, escura, 1.8, { passadas: 2 }), { tipo: 'mancha', poligono: brilho, cor: 0xffffff, alpha: 0.65 }] }
}

// O boneco de treino do Ralsei (um espantalho fofinho), em pé sobre o ponto (0, 0) = o meio do peito
// (é para lá que os ataques miram). ~70 px de altura.
export function rabiscoDoBoneco(rng) {
  const c = []
  const madeira = 0x9a6a3c
  const madeiraEscura = 0x5e3d1e
  // a estaca e o pau dos braços
  const estaca = [{ x: -3, y: -6 }, { x: 3, y: -6 }, { x: 3.5, y: 40 }, { x: -3.5, y: 40 }]
  c.push(preencher(estaca, madeira, { espaco: 1.6, mancha: 0.8 }), traco(fechar(estaca), madeiraEscura, 1.6, { passadas: 2 }))
  c.push(traco(linhaGiz(rng, -30, -4, 30, -6, { tracos: 2, tremor: 0.4, excesso: 1 }), madeiraEscura, 3.6, { passadas: 2 }))
  // a camisa remendada
  const camisa = [{ x: -15, y: -10 }, { x: 15, y: -10 }, { x: 18, y: 18 }, { x: -18, y: 18 }]
  c.push(preencher(camisa, PALETA.rosa, { espaco: 1.8, mancha: 0.75 }), traco(fechar(camisa), PALETA.rosaEscuro, 2, { passadas: 2 }))
  const remendo = retanguloRedondo(3, 2, 9, 8, 2)
  c.push(preencher(remendo, PALETA.amarelo, { espaco: 1.4, mancha: 0.9 }), traco(fechar(remendo), PALETA.ouro, 1.2, { passadas: 1 }))
  for (const [x0, y0] of [[4.5, 3.5], [9, 8]]) c.push(traco([[{ x: x0, y: y0 }, { x: x0 + 2, y: y0 + 2 }]], PALETA.tinta, 1, { passadas: 1 }))
  // palhinhas saindo das mangas e da barra
  for (const [x, y, dx, dy] of [[-30, -4, -6, -3], [-30, -4, -6, 3], [30, -6, 6, -4], [30, -6, 6, 2], [-10, 18, -2, 6], [0, 18, 0, 7], [10, 18, 2, 6]]) c.push(traco([[{ x, y }, { x: x + dx, y: y + dy }]], PALETA.amarelo, 2, { passadas: 2 }))
  // a cabeça de saco, com olhos de botão e sorriso costurado
  const cabeca = elipse(0, -24, 13, 12, 22)
  c.push(preencher(cabeca, 0xe8cf9a, { espaco: 1.8, mancha: 0.8 }), traco(fechar(cabeca), 0x9a7a44, 2, { passadas: 2 }))
  for (const lx of [-5, 5]) c.push({ tipo: 'mancha', poligono: elipse(lx, -26, 2.4, 2.4, 10), cor: PALETA.tinta, alpha: 1 })
  c.push(traco([[{ x: -6, y: -19 }, { x: -3, y: -17 }, { x: 0, y: -16.5 }, { x: 3, y: -17 }, { x: 6, y: -19 }]], PALETA.tinta, 1.4, { passadas: 2 }))
  for (const x of [-4, 0, 4]) c.push(traco([[{ x, y: -18.5 }, { x, y: -15.5 }]], PALETA.tinta, 1, { passadas: 1 }))
  for (const lx of [-8, 8]) c.push({ tipo: 'mancha', poligono: elipse(lx, -21, 2.6, 1.6, 10), cor: PALETA.rosa, alpha: 0.6 })
  // o chapéu de palha
  const aba = elipse(0, -33, 19, 4, 20)
  const copa = [{ x: -9, y: -33 }, { x: -7, y: -44 }, { x: 7, y: -44 }, { x: 9, y: -33 }]
  c.push(preencher(copa, PALETA.amarelo, { espaco: 1.6, mancha: 0.8 }), traco(fechar(copa), PALETA.ouro, 1.8, { passadas: 2 }))
  c.push(preencher(aba, PALETA.amarelo, { espaco: 1.6, mancha: 0.8 }), traco(fechar(aba), PALETA.ouro, 1.8, { passadas: 2 }))
  c.push(traco([[{ x: -8.5, y: -36 }, { x: 8.5, y: -36 }]], PALETA.verde, 2.4, { passadas: 2 }))
  return { camadas: c }
}

// O desenho de giz do adesivo de cada passo das páginas de cartas (centrado na origem, raio ~r):
//   conhecer: uma cartinha com estrela · chuva: estrelinhas caindo · caro: gema vermelha com ×
//   passar: a seta que volta · jogar: carta com brilhos
export function iconeDoPasso(rng, id, r = 11) {
  const carta = (cor) => {
    const poli = retanguloRedondo(-r * 0.6, -r * 0.82, r * 1.2, r * 1.64, r * 0.22)
    return [preencher(poli, 0xfffbf1, { espaco: 1.2, mancha: 1 }), traco(fechar(poli), cor, 1.6, { passadas: 2 })]
  }
  if (id === 'conhecer') return [...carta(PALETA.tinta), ...estrelinha(rng, 0, 0, r * 0.42, PALETA.amarelo, PALETA.ouro)]
  if (id === 'chuva') {
    const c = []
    for (const [x, y] of [[-r * 0.5, -r * 0.45], [r * 0.45, -r * 0.1], [-r * 0.1, r * 0.5]]) {
      c.push(traco([[{ x: x - r * 0.3, y: y - r * 0.42 }, { x, y }]], PALETA.amarelo, 1.4, { passadas: 1, alpha: 0.8 }))
      c.push(...estrelinha(rng, x, y, r * 0.3, PALETA.amarelo, PALETA.ouro))
    }
    return c
  }
  if (id === 'caro') {
    const g = rabiscoDaGema(rng, r * 0.85, { estado: 'bloqueada' }).camadas
    return [...g, traco(xGiz(rng, r * 0.55, -r * 0.55, r * 0.28, { tremor: 0.2 }), 0xffffff, 2.2, { passadas: 2 })]
  }
  if (id === 'passar') return desenhoDaCarta(rng, 'passar', r * 1.05)
  if (id === 'jogar') {
    const c = carta(PALETA.verdeEscuro)
    c.push(...estrelinha(rng, 0, 0, r * 0.36, PALETA.verde, PALETA.verdeEscuro))
    for (const [x, y] of [[r * 0.85, -r * 0.75], [-r * 0.9, -r * 0.2], [r * 0.85, r * 0.55]]) c.push(traco(xGiz(rng, x, y, r * 0.18, { tremor: 0.2 }), PALETA.amarelo, 1.6, { passadas: 1 }))
    return c
  }
  return []
}
