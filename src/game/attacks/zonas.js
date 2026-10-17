// Zonas de perigo: áreas que VÃO machucar daqui a pouco (o vermelho dos
// avisos). É como a CPU (pvp/botEsquiva.js) enxerga o que quem joga vê na
// tela antes da bala existir. Lógica pura (sem Phaser).
//
//   a.aviso(forma, depois)            já registra a zona dele sozinho
//   a.zonaPerigo(forma, { ms, dura }) registra sem desenhar nada (aviso desenhado à mão:
//                                     pegada piscando, lâmina erguida, sombra crescendo...)
//   registrarZona(balas, forma, { ms, dura })   o mesmo, para quem não tem `a`
//                                     (eventos do bônus: use pista.balas)
//
// forma (as mesmas do a.aviso, mais o leque):
//   { tipo: 'linha', x1, y1, x2, y2, espessura }
//   { tipo: 'area', x, y, largura, altura }        (x, y = canto de cima à esquerda)
//   { tipo: 'circulo', x, y, raio }
//   { tipo: 'leque', x, y, raio, angulo, abertura } (fatia de círculo; abertura = meio ângulo, rad)
// ms    daqui a quanto a área passa a machucar (padrão forma.ms ?? 0)
// dura  por quanto tempo ela machuca depois disso (padrão forma.dura ?? DURA_PADRAO):
//       no aviso comum é só a ponte até as balas de verdade aparecerem
//
// As zonas ficam em balas.zonas (as Balas da pista). A ContextoAtaque
// envelhece e recolhe as vencidas a cada frame, no mesmo relógio dos timers
// dela (param nos respiros e com a pista congelada), e apaga todas no fim do
// ataque. Cada zona: { tipo: 'circulo' | 'retangulo' | 'segmento' | 'leque',
// ...geometria, falta (ms até valer; negativo = já vale), idade, dura }.

export const DURA_PADRAO = 200
const MARGEM_MS = 60 // a zona some um pouco depois de deixar de valer
const LINHA_MINIMA = 6 // meia espessura mínima de uma linha (o que passa por ela tem corpo)

// Zona (geometria normalizada) a partir da forma de um aviso; null se não dá
export function zonaDaForma(forma, { ms = forma.ms ?? 0, dura = forma.dura ?? DURA_PADRAO } = {}) {
  const tempo = { falta: ms, idade: 0, dura }
  if (forma.tipo === 'circulo') return { tipo: 'circulo', x: forma.x, y: forma.y, raio: forma.raio, ...tempo }
  if (forma.tipo === 'area') return { tipo: 'retangulo', x: forma.x + forma.largura / 2, y: forma.y + forma.altura / 2, largura: forma.largura, altura: forma.altura, ...tempo }
  if (forma.tipo === 'linha') return { tipo: 'segmento', x1: forma.x1, y1: forma.y1, x2: forma.x2, y2: forma.y2, meia: Math.max(LINHA_MINIMA, (forma.espessura ?? 2) / 2), ...tempo }
  if (forma.tipo === 'leque') return { tipo: 'leque', x: forma.x, y: forma.y, raio: forma.raio, angulo: forma.angulo ?? 0, abertura: forma.abertura ?? Math.PI / 4, ...tempo }
  return null
}

// Põe a zona na lista das balas (cria a lista se preciso) e devolve a zona
export function registrarZona(balas, forma, opcoes) {
  const z = zonaDaForma(forma, opcoes)
  if (!z || !balas) return null
  ;(balas.zonas ??= []).push(z)
  return z
}

// Avança o relógio das zonas e tira as vencidas.
//   tempo    relógio do contexto (zonas com `fim` que não valeram até ele somem: o timer delas morreu)
//   parada   (zona) => true se o relógio dela está parado agora (respiro da onda que a criou)
export function envelhecerZonas(balas, dt, { tempo = 0, parada } = {}) {
  const zonas = balas?.zonas
  if (!zonas?.length) return
  for (const z of zonas) {
    if (parada?.(z)) continue
    z.falta -= dt
    z.idade += dt
  }
  balas.zonas = zonas.filter((z) => !z.cancelada && z.falta > -(z.dura + MARGEM_MS) && !(z.fim !== undefined && tempo > z.fim && z.falta > 0))
}

export function limparZonas(balas) {
  if (balas?.zonas) balas.zonas = []
}

// Distância de um ponto até a borda da zona: positiva fora, NEGATIVA dentro
// (o quanto falta para sair). É o que o bot usa para preferir a saída mais perto.
export function folgaZona(z, px, py) {
  if (z.tipo === 'circulo') return Math.hypot(px - z.x, py - z.y) - z.raio
  if (z.tipo === 'retangulo') {
    const dx = Math.abs(px - z.x) - z.largura / 2
    const dy = Math.abs(py - z.y) - z.altura / 2
    if (dx <= 0 && dy <= 0) return Math.max(dx, dy)
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  }
  if (z.tipo === 'segmento') return distanciaAoSegmento(px, py, z.x1, z.y1, z.x2, z.y2) - z.meia
  if (z.tipo === 'leque') {
    const rx = px - z.x
    const ry = py - z.y
    const r = Math.hypot(rx, ry)
    const desvio = Math.abs(normalizar(Math.atan2(ry, rx) - z.angulo))
    if (desvio <= z.abertura) {
      if (r <= z.raio) return -Math.min(z.raio - r, r * Math.sin(Math.min(Math.PI / 2, z.abertura - desvio)))
      return r - z.raio
    }
    // fora da fatia: até a borda reta mais perto
    const lado = (s) => distanciaAoSegmento(px, py, z.x, z.y, z.x + Math.cos(z.angulo + s * z.abertura) * z.raio, z.y + Math.sin(z.angulo + s * z.abertura) * z.raio)
    return Math.min(lado(1), lado(-1))
  }
  return Infinity
}

function distanciaAoSegmento(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const l2 = dx * dx + dy * dy
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2)) : 0
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function normalizar(a) {
  return Math.atan2(Math.sin(a), Math.cos(a))
}
