// BOSS SEMANAL · ESCURIDÃO: as pistas de som (e a troca por pistas visuais) a partir das balas.
// Lógica pura, sem Phaser e sem WebAudio (testada em coop/__tests__/pistas.test.js); quem toca e
// desenha é coop/semanal/escuridao.js. Tudo é RELATIVO AO MEU CORAÇÃO (cada PC ouve o dele):
//
//   panorâmica  -1 (esquerda) .. 1 (direita): onde a bala está em x em relação ao meu coração
//               (meia caixa de distância já é o lado todo)
//   altura      grave embaixo, agudo em cima: a bala acima do coração soa mais aguda (FREQ, 2 oitavas)
//   tique       o intervalo entre os bipes ENCURTA quando a bala chega perto (TIQUE.maxMs -> minMs)
//   timbre      um por tipo de ataque (TIMBRES): chuva = chiado, laser = zumbido, bomba = tambor, o resto = sino
//   urgência    0..1: o maior entre a proximidade (ALCANCE) e o tempo até chegar (HORIZONTE_MS). Uma bala
//               ainda avisando (telegrafo) entra como "chega quando o aviso acabar": dá ~0,6 s de som antes
//   vozes       no máximo VOZES ao mesmo tempo, as mais urgentes (a mistura não embola)
//
//   pistasDasBalas(balas, coracao, caixa)   [{ bala, timbre, pan, freq, tiqueMs, volume, urgencia, x, y }]
//   indicadoresDeBorda(pistas, coracao, caixa)   [{ x, y, angulo, intensidade, timbre }] (PISTAS VISUAIS:
//               uma seta na borda da caixa na direção de cada bala, mais forte quanto mais perto)
export const VOZES = 4
export const ALCANCE = 150 // px: a partir daqui a bala começa a soar pela proximidade
export const HORIZONTE_MS = 1600 // ms: a bala que chega em menos que isto já soa
export const AVISO_SOM_MS = 600 // ms: o mínimo de som antes de uma bala chegar (o telegrafo de ouvido)
export const TIQUE = { maxMs: 520, minMs: 70 }
export const FREQ = { base: 330, oitavas: 2 } // do grave (embaixo) ao agudo (em cima)
export const TIMBRES = { rain: 'chiado', lasers: 'zumbido', bombas: 'tambor' }

const limitar = (v, a, b) => Math.min(b, Math.max(a, v))

// o timbre pelo nome do ataque que criou a bala (juntos/sequência: "rain + lasers")
export function timbreDe(origem = '') {
  for (const [ataque, timbre] of Object.entries(TIMBRES)) if (String(origem).includes(ataque)) return timbre
  return 'sino'
}

// o ponto da bala mais perto do coração (retângulo: o ponto da borda dele; o resto: o centro)
function pontoMaisPerto(b, c) {
  if (b.tipo === 'retangulo' && b.largura && b.altura) {
    return { x: limitar(c.x, b.x - b.largura / 2, b.x + b.largura / 2), y: limitar(c.y, b.y - b.altura / 2, b.y + b.altura / 2) }
  }
  return { x: b.x, y: b.y }
}

// caixa: { left, right, top, bottom, width, height } (o Phaser.Geom.Rectangle dos limites serve)
export function pistaDaBala(b, coracao, caixa) {
  const p = pontoMaisPerto(b, coracao)
  const dx = p.x - coracao.x
  const dy = p.y - coracao.y
  const d = Math.max(0, Math.hypot(dx, dy) - (b.raio ?? 6))
  // ainda avisando: parada e inofensiva; "chega" quando o aviso acabar
  const avisando = (b.aviso ?? 0) > (b.idade ?? 0)
  let chegaMs = Infinity
  if (avisando) chegaMs = b.aviso - (b.idade ?? 0) + (d > 30 ? AVISO_SOM_MS : 0)
  else {
    const aproxima = -(dx * (b.vx ?? 0) + dy * (b.vy ?? 0)) / (Math.hypot(dx, dy) || 1) // px/s em direção ao coração
    if (aproxima > 1) chegaMs = (d / aproxima) * 1000
  }
  const perto = 1 - d / ALCANCE
  const tempo = 1 - chegaMs / HORIZONTE_MS
  const urgencia = limitar(Math.max(perto, tempo), 0, 1)
  const metade = Math.max(1, caixa.width / 2)
  const pan = limitar(dx / metade, -1, 1)
  // acima do coração = agudo: dy negativo (a tela cresce para baixo)
  const alto = limitar(0.5 - dy / Math.max(1, caixa.height), 0, 1)
  const freq = Math.round(FREQ.base * 2 ** (FREQ.oitavas * (alto - 0.5)))
  const tiqueMs = Math.round(TIQUE.maxMs - (TIQUE.maxMs - TIQUE.minMs) * urgencia)
  return { bala: b, timbre: timbreDe(b.origem), pan, freq, tiqueMs, volume: Math.round((0.25 + 0.75 * urgencia) * 100) / 100, urgencia, x: p.x, y: p.y, distancia: d, chegaMs }
}

export function pistasDasBalas(balas, coracao, caixa, vozes = VOZES) {
  if (!coracao) return []
  const lista = []
  for (const b of balas) {
    if (b.morta) continue
    const p = pistaDaBala(b, coracao, caixa)
    if (p.urgencia > 0) lista.push(p)
  }
  // as mais urgentes primeiro; empate: a mais perto
  lista.sort((a, b) => b.urgencia - a.urgencia || a.distancia - b.distancia)
  return lista.slice(0, vozes)
}

// PISTAS VISUAIS: onde a linha do coração até a bala cruza a borda da caixa
export function indicadoresDeBorda(pistas, coracao, caixa) {
  return pistas.map((p) => {
    const dx = p.x - coracao.x
    const dy = p.y - coracao.y
    const angulo = Math.atan2(dy, dx)
    const cos = Math.cos(angulo)
    const sin = Math.sin(angulo)
    // até a borda: o menor t > 0 em que x ou y sai da caixa
    const tx = cos > 1e-6 ? (caixa.right - coracao.x) / cos : cos < -1e-6 ? (caixa.left - coracao.x) / cos : Infinity
    const ty = sin > 1e-6 ? (caixa.bottom - coracao.y) / sin : sin < -1e-6 ? (caixa.top - coracao.y) / sin : Infinity
    const t = Math.max(0, Math.min(tx, ty))
    return { x: limitar(coracao.x + cos * t, caixa.left, caixa.right), y: limitar(coracao.y + sin * t, caixa.top, caixa.bottom), angulo, intensidade: p.urgencia, timbre: p.timbre }
  })
}
