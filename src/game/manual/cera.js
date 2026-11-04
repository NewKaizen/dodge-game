import { criarRng, aleatorio } from '../pvp/baralho.js'
import { cortarTracos, preencherGiz } from './giz.js'

// Giz de CERA de verdade, pintado num contexto 2D de canvas (O Manual Interativo do Ralsei,
// docs/manual-ralsei.md). Lógica PURA: só chama métodos de um CanvasRenderingContext2D (ou de um
// falso, nos testes: __tests__/cera.test.js), nunca Phaser, nunca Math.random. Mesma semente, mesmas
// passadas. A cena (manual/paginaBase.js) assa o resultado numa textura UMA vez; nada disto roda por quadro
// (a não ser o "desenhando", que repinta uma textura pequena por ~2,7 s).
//
// Como o giz de cera parece giz de cera:
//   1. cada traço é riscado em 2 a 3 PASSADAS levemente deslocadas (a mão volta por cima), com cor um
//      pouquinho diferente em cada uma (cera que se sobrepõe);
//   2. a PRESSÃO muda ao longo do traço: entra leve, firma no meio, alivia no fim, com uma ondinha;
//   3. o preenchimento é uma mancha fraca + hachura larga em dois ângulos (cor que se sobrepõe);
//   4. por fim o GRÃO do papel "come" a cera: um padrão de ruído apaga pixels soltos (destination-out),
//      deixando falhinhas por onde o papel aparece.
//
//   PALETA                               as cores de giz do manual (suaves mas saturadas)
//   corCss(cor, alpha)                   0xrrggbb -> 'rgba(...)'
//   variarCor(cor, k)                    a cor da k-ésima passada (um tiquinho mais clara/escura)
//   pressaoDaCera(u, fase)               0.2..1 ao longo do traço (u em 0..1)
//   passadasDaCera(traco, op)            as passadas de um traço: [{ k, pedacos: [{ pontos, largura, alpha }] }]
//   pintarTracos(ctx, tracos, estilo)    risca traços (com progresso 0..1)
//   preencherCera(ctx, poligono, estilo) mancha + hachura dentro de um polígono
//   pintarDesenho(ctx, camadas)          uma lista de camadas { tipo: 'traco'|'preencher'|'mancha', ... }
//   graoDaCera(lado, semente)            RGBA (só o alpha importa) do padrão de grão, lado x lado, que repete
//   aplicarGrao(ctx, padrao, w, h, f)    apaga a cera onde o grão manda (destination-out)
//   caixaDasCamadas(camadas)             { minX, minY, maxX, maxY } com a largura do traço somada

const TAU = Math.PI * 2
const limitar = (v, a, b) => Math.min(b, Math.max(a, v))

export const PALETA = {
  tinta: 0x2b2540, // texto e contornos escuros
  verde: 0x4cb878, // o verde do Ralsei (chapéu e manto)
  verdeEscuro: 0x22704a,
  rosa: 0xf07aa0, // o cachecol, as bochechas
  rosaEscuro: 0xb94a78,
  azul: 0x5aa8e6, // céu
  azulEscuro: 0x2f5f9e,
  amarelo: 0xf5c02a, // girassol (estrelas, sol)
  ouro: 0xd99a06,
  lavanda: 0xa48ad8,
  pelo: 0xfaf1e4, // o pelo branquinho do Ralsei
  peloSombra: 0x9c8b7a,
  coracao: 0xe5243b,
  bala: 0x5b2fa8, // as bolinhas: escuras o bastante para ler no papel (teste de contraste)
  balaMiolo: 0x8a63d6,
  certo: 0x2da44e,
  marcaX: 0x138a7a,
}

export function corCss(cor, alpha = 1) {
  return `rgba(${(cor >> 16) & 255},${(cor >> 8) & 255},${cor & 255},${Math.round(limitar(alpha, 0, 1) * 1000) / 1000})`
}

// a k-ésima passada sai um tiquinho mais clara ou mais escura (a cera não é uniforme)
export function variarCor(cor, k) {
  const f = [1, 0.9, 1.08, 0.95][k % 4]
  const c = (s) => limitar(Math.round(((cor >> s) & 255) * f), 0, 255)
  return (c(16) << 16) | (c(8) << 8) | c(0)
}

// hash determinístico 0..1 (sem sorteio: o mesmo índice dá sempre o mesmo valor)
const hash = (a, b = 0) => (Math.imul((a + 1) ^ Math.imul(b + 7, 0x9e3779b1), 2654435761) >>> 8) / 16777216

export function pressaoDaCera(u, fase = 0) {
  const entrada = Math.min(1, u / 0.12)
  const saida = Math.min(1, (1 - u) / 0.18)
  const base = 0.55 + 0.45 * Math.min(entrada, saida)
  return limitar(base + 0.12 * Math.sin(TAU * (u * 2.3 + fase)), 0.2, 1)
}

const semente2num = (s) => {
  let h = 2166136261
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

// As passadas de UM traço. Cada passada anda pela mesma linha deslocada na normal (offset fixo + ondinha
// lenta) e é quebrada em pedaços de 3 segmentos, cada um com largura/alpha da pressão naquele trecho.
export function passadasDaCera(traco, { largura = 3, passadas = 3, semente = 0 } = {}) {
  if (!traco || traco.length < 2) return []
  const s = typeof semente === 'number' ? semente : semente2num(semente)
  const n = traco.length
  // comprimento acumulado (u = fração do caminho)
  const acum = [0]
  for (let i = 1; i < n; i++) acum.push(acum[i - 1] + Math.hypot(traco[i].x - traco[i - 1].x, traco[i].y - traco[i - 1].y))
  const total = acum[n - 1] || 1
  const normal = (i) => {
    const a = traco[Math.max(0, i - 1)]
    const b = traco[Math.min(n - 1, i + 1)]
    const m = Math.hypot(b.x - a.x, b.y - a.y) || 1
    return { x: -(b.y - a.y) / m, y: (b.x - a.x) / m }
  }
  const saida = []
  for (let k = 0; k < passadas; k++) {
    const fase = hash(s, k)
    const desloc = (k - (passadas - 1) / 2) * largura * 0.32
    const pontos = traco.map((p, i) => {
      const u = acum[i] / total
      const d = desloc + largura * 0.16 * Math.sin(TAU * (u * 1.3 + fase))
      const nn = normal(i)
      return { x: p.x + nn.x * d, y: p.y + nn.y * d, u }
    })
    // a 1ª passada é o corpo (larga, fraca); as outras, a pressão (mais finas, mais firmes)
    const largBase = k === 0 ? largura * 1.05 : largura * (0.62 - 0.08 * (k - 1))
    const alphaBase = k === 0 ? 0.5 : 0.78
    const pedacos = []
    for (let i = 0; i < n - 1; i += 3) {
      const fim = Math.min(n - 1, i + 3)
      const u = (pontos[i].u + pontos[fim].u) / 2
      const p = pressaoDaCera(u, fase)
      pedacos.push({
        pontos: pontos.slice(i, fim + 1).map(({ x, y }) => ({ x, y })),
        largura: largBase * (0.6 + 0.4 * p),
        alpha: alphaBase * (0.45 + 0.55 * p) * (0.85 + 0.15 * hash(s + i, k + 3)),
      })
    }
    saida.push({ k, pedacos })
  }
  return saida
}

// Risca traços. estilo: cor, largura, alpha (multiplica), passadas, semente, progresso (0..1)
export function pintarTracos(ctx, tracos, { cor = PALETA.tinta, largura = 3, alpha = 1, passadas = 3, semente = 0, progresso = 1 } = {}) {
  const visivel = cortarTracos(tracos, progresso)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  visivel.forEach((t, j) => {
    for (const { k, pedacos } of passadasDaCera(t, { largura, passadas, semente: semente2num(`${semente}:${j}`) })) {
      ctx.strokeStyle = corCss(variarCor(cor, k), 1)
      for (const pd of pedacos) {
        ctx.globalAlpha = limitar(pd.alpha * alpha, 0, 1)
        ctx.lineWidth = pd.largura
        ctx.beginPath()
        ctx.moveTo(pd.pontos[0].x, pd.pontos[0].y)
        for (let i = 1; i < pd.pontos.length; i++) ctx.lineTo(pd.pontos[i].x, pd.pontos[i].y)
        ctx.stroke()
      }
    }
  })
  ctx.globalAlpha = 1
}

function caminho(ctx, poligono) {
  ctx.beginPath()
  ctx.moveTo(poligono[0].x, poligono[0].y)
  for (let i = 1; i < poligono.length; i++) ctx.lineTo(poligono[i].x, poligono[i].y)
  ctx.closePath()
}

// Preenche com giz: mancha fraca (a cera espalhada) + hachura larga num ângulo + outra, mais fraca, cruzando
export function preencherCera(ctx, poligono, { cor = PALETA.tinta, alpha = 1, semente = 0, angulo = -0.6, espaco = 3.2, mancha = 0.32 } = {}) {
  if (!poligono || poligono.length < 3) return
  const rng = criarRng(`cera:${semente}`)
  ctx.fillStyle = corCss(cor, 1)
  ctx.globalAlpha = mancha * alpha
  caminho(ctx, poligono)
  ctx.fill()
  const h1 = preencherGiz(rng, poligono, { espaco, angulo, tremor: 0.5, folga: 0.6 })
  pintarTracos(ctx, h1, { cor, largura: espaco * 1.15, alpha: 0.62 * alpha, passadas: 2, semente: `${semente}:h1` })
  const h2 = preencherGiz(rng, poligono, { espaco: espaco * 1.6, angulo: angulo + 0.9 + aleatorio(rng) * 0.3, tremor: 0.6, folga: 1 })
  pintarTracos(ctx, h2, { cor: variarCor(cor, 1), largura: espaco * 0.9, alpha: 0.3 * alpha, passadas: 1, semente: `${semente}:h2` })
}

// camadas: { tipo: 'traco', tracos, cor, largura, alpha?, passadas? }
//          { tipo: 'preencher', poligono, cor, alpha?, angulo?, espaco? }
//          { tipo: 'mancha', poligono, cor, alpha? }   (cor chapada, sem hachura: brilhos, olhos)
export function pintarDesenho(ctx, camadas, { semente = 'd', progresso = 1 } = {}) {
  camadas.forEach((c, i) => {
    const s = `${semente}:${i}`
    if (c.tipo === 'preencher') preencherCera(ctx, c.poligono, { ...c, semente: s })
    else if (c.tipo === 'mancha') {
      ctx.globalAlpha = c.alpha ?? 1
      ctx.fillStyle = corCss(c.cor, 1)
      caminho(ctx, c.poligono)
      ctx.fill()
      ctx.globalAlpha = 1
    } else pintarTracos(ctx, c.tracos, { cor: c.cor, largura: c.largura, alpha: c.alpha ?? 1, passadas: c.passadas ?? 3, semente: s, progresso: c.progresso ?? progresso })
  })
}

// O grão: ruído suave (célula 3 px) + ruído fino + estrias diagonais (o "dente" do papel). Só o alpha
// importa: 0 = a cera fica, 255 = a cera some ali. ~1/4 dos pixels apaga algo.
export function graoDaCera(lado = 128, semente = 'grao') {
  const rng = criarRng(`grao:${semente}`)
  const cel = 3
  const g = Math.ceil(lado / cel)
  const grade = Array.from({ length: g * g }, () => aleatorio(rng))
  const v = (i, j) => grade[((j + g) % g) * g + ((i + g) % g)]
  const dados = new Uint8ClampedArray(lado * lado * 4)
  for (let y = 0; y < lado; y++)
    for (let x = 0; x < lado; x++) {
      const gx = x / cel
      const gy = y / cel
      const ix = Math.floor(gx)
      const iy = Math.floor(gy)
      const fx = gx - ix
      const fy = gy - iy
      const a = v(ix, iy) + (v(ix + 1, iy) - v(ix, iy)) * fx
      const b = v(ix, iy + 1) + (v(ix + 1, iy + 1) - v(ix, iy + 1)) * fx
      const suave = a + (b - a) * fy
      const estria = 0.5 + 0.5 * Math.sin(((x + y * 0.55) / lado) * TAU * 21)
      const val = 0.55 * suave + 0.3 * aleatorio(rng) + 0.15 * estria
      const alpha = limitar((val - 0.56) / 0.26, 0, 1)
      dados[(y * lado + x) * 4 + 3] = Math.round(alpha * alpha * 255)
    }
  return dados
}

export function aplicarGrao(ctx, padrao, largura, altura, forca = 0.55) {
  if (!padrao || forca <= 0) return
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.globalAlpha = limitar(forca, 0, 1)
  ctx.fillStyle = padrao
  ctx.fillRect(0, 0, largura, altura)
  ctx.restore()
}

export function caixaDasCamadas(camadas) {
  const c = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const cam of camadas) {
    const folga = cam.tipo === 'traco' ? (cam.largura ?? 3) * 1.4 + 1 : 2
    const listas = cam.tipo === 'traco' ? cam.tracos : [cam.poligono]
    for (const t of listas)
      for (const p of t) {
        c.minX = Math.min(c.minX, p.x - folga)
        c.minY = Math.min(c.minY, p.y - folga)
        c.maxX = Math.max(c.maxX, p.x + folga)
        c.maxY = Math.max(c.maxY, p.y + folga)
      }
  }
  return c
}
