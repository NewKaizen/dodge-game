// Gera public/assets/musicas/lobby.mid: um loop calmo de lobby (piano
// elétrico, baixo, bateria leve e vibrafone), só para o lobby LAN não ficar
// mudo. Troque pelo MIDI que quiser com o mesmo nome (e o título em
// src/game/assets.js, tituloMusicaLobby).
//   node scripts/lobby/gerar_lobby_mid.mjs
import fs from 'node:fs'

const PPQ = 480
const BPM = 92
const COMPASSO = PPQ * 4

const vlq = (n) => {
  const bytes = [n & 0x7f]
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80)
  return bytes
}

// eventos: [tick, bytes]; devolve o chunk MTrk
function trilha(eventos) {
  eventos.sort((a, b) => a[0] - b[0] || (a[1][0] & 0xf0) - (b[1][0] & 0xf0)) // note off antes de note on no mesmo tick
  const dados = []
  let anterior = 0
  for (const [tick, bytes] of eventos) {
    dados.push(...vlq(tick - anterior), ...bytes)
    anterior = tick
  }
  dados.push(0, 0xff, 0x2f, 0)
  const tam = dados.length
  return [0x4d, 0x54, 0x72, 0x6b, (tam >>> 24) & 255, (tam >>> 16) & 255, (tam >>> 8) & 255, tam & 255, ...dados]
}

function nota(ev, canal, tick, dur, altura, vel) {
  ev.push([tick, [0x90 | canal, altura, vel]])
  ev.push([tick + dur, [0x80 | canal, altura, 0]])
}

// Fmaj7 · Em7 · Dm7 · Cmaj7 (duas voltas)
const ACORDES = [
  { baixo: 41, notas: [57, 60, 64, 65] },
  { baixo: 40, notas: [55, 59, 62, 64] },
  { baixo: 38, notas: [53, 57, 60, 62] },
  { baixo: 36, notas: [52, 55, 59, 60] },
]
const VOLTAS = 2
const TOTAL = ACORDES.length * VOLTAS * COMPASSO

// tempo
const tempo = [
  [0, [0xff, 0x51, 0x03, ...[16, 8, 0].map((s) => (Math.round(60_000_000 / BPM) >>> s) & 255)]],
  [0, [0xff, 0x58, 0x04, 4, 2, 24, 8]],
  [TOTAL, [0xff, 0x01, 0x00]],
]

// piano elétrico (canal 0): acordes em semínimas pontuadas, levinho
const piano = [[0, [0xc0, 4]], [0, [0xb0, 7, 80]], [0, [0xb0, 91, 70]]]
// baixo (canal 1)
const baixo = [[0, [0xc1, 33]], [0, [0xb1, 7, 100]]]
// vibrafone (canal 2): melodia
const vibra = [[0, [0xc2, 11]], [0, [0xb2, 7, 78]], [0, [0xb2, 91, 90]]]
// bateria (canal 9)
const bateria = [[0, [0xb9, 7, 70]]]

for (let v = 0; v < VOLTAS; v++) {
  ACORDES.forEach((a, i) => {
    const c = (v * ACORDES.length + i) * COMPASSO
    for (const [t, d] of [
      [0, PPQ * 1.5],
      [PPQ * 1.5, PPQ],
      [PPQ * 3, PPQ * 0.9],
    ])
      a.notas.forEach((n, k) => nota(piano, 0, c + t + k * 8, d, n, 52 + (t === 0 ? 10 : 0)))
    nota(baixo, 1, c, PPQ * 1.4, a.baixo, 92)
    nota(baixo, 1, c + PPQ * 1.5, PPQ * 0.4, a.baixo + 12, 70)
    nota(baixo, 1, c + PPQ * 2, PPQ * 1.4, a.baixo + 7, 84)
    nota(baixo, 1, c + PPQ * 3.5, PPQ * 0.4, a.baixo + 5, 72)
    for (let b = 0; b < 8; b++) nota(bateria, 9, c + (b * PPQ) / 2, PPQ / 4, 42, b % 2 ? 38 : 55) // chimbal
    nota(bateria, 9, c, PPQ / 2, 36, 88)
    nota(bateria, 9, c + PPQ * 2.5, PPQ / 2, 36, 70)
    nota(bateria, 9, c + PPQ, PPQ / 2, 37, 60) // aro
    nota(bateria, 9, c + PPQ * 3, PPQ / 2, 37, 66)
  })
}

// melodia: uma frase por acorde, a segunda volta com um final diferente
const FRASES = [
  [[0, 72, 1], [1, 76, 0.5], [1.5, 77, 1.5], [3.5, 76, 0.5]],
  [[0, 74, 1.5], [1.5, 71, 0.5], [2, 72, 1], [3, 74, 1]],
  [[0, 77, 0.5], [0.5, 76, 0.5], [1, 74, 1], [2, 72, 1], [3, 69, 1]],
  [[0, 71, 1.5], [1.5, 72, 0.5], [2, 67, 2]],
]
const FINAL = [[0, 71, 1], [1, 74, 1], [2, 76, 2]]
for (let v = 0; v < VOLTAS; v++)
  FRASES.forEach((f, i) => {
    const c = (v * ACORDES.length + i) * COMPASSO
    const frase = v === VOLTAS - 1 && i === FRASES.length - 1 ? FINAL : f
    for (const [t, n, d] of frase) nota(vibra, 2, c + t * PPQ, d * PPQ - 20, n, 70)
  })

// um chimbal fraquinho terminando exatamente no fim: o loop fecha no tempo certo
nota(bateria, 9, TOTAL - PPQ / 4, PPQ / 4, 42, 24)

const trilhas = [tempo, piano, baixo, vibra, bateria].map(trilha)
const cabecalho = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, trilhas.length, (PPQ >>> 8) & 255, PPQ & 255]
const destino = new URL('../../public/assets/musicas/lobby.mid', import.meta.url)
fs.writeFileSync(destino, Buffer.from([...cabecalho, ...trilhas.flat()]))
console.log('gerado', destino.pathname)
