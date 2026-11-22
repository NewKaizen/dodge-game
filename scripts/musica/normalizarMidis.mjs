// Normaliza o volume de MIDIs enviados de fora para soarem na mesma altura das
// outras músicas do jogo. Toca cada MIDI com o MESMO sintetizador e soundfont do
// jogo (spessasynth_core + assets-fonte/soundfont/soundfont.sf3), mede o volume
// (RMS dos trechos com som, em blocos de 400 ms) e ajusta o Volume (CC7) de cada
// canal até ficar a ±0,5 dB do alvo. O alvo é a mediana das músicas das arenas
// que já estão no jogo.
//
//   node scripts/musica/normalizarMidis.mjs <entrada.mid> <saida.mid> [<entrada> <saida> ...]
//
// Só mexe em CC7 (e põe um CC7 no começo dos canais que não têm). Se nem o CC7
// no máximo bastar, escala também a velocidade das notas.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BasicMIDI, SoundBankLoader, SpessaSynthProcessor, SpessaSynthSequencer, MIDIMessage } from 'spessasynth_core'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MUSICAS = path.join(RAIZ, 'assets-fonte/musicas')
const REFERENCIAS = ['pvp.mid', 'arena_jardim.mid', 'arena_informatica.mid', 'arena_palco.mid', 'arena_templo.mid', 'arena_coliseu.mid']
const TAXA = 22050
const MAX_S = 75
const CC_VOLUME = 7
const CC_PADRAO = 100

const fonte = SoundBankLoader.fromArrayBuffer((await fs.readFile(path.join(RAIZ, 'assets-fonte/soundfont/soundfont.sf3'))).buffer)

async function volumeDb(bufferMidi) {
  const midi = BasicMIDI.fromArrayBuffer(bufferMidi)
  const synth = new SpessaSynthProcessor(TAXA, { eventsEnabled: false })
  synth.soundBankManager.addSoundBank(fonte, 'main')
  await synth.processorInitialized
  synth.setSystemParameter?.('autoAllocateVoices', true)
  const seq = new SpessaSynthSequencer(synth)
  seq.loadNewSongList([midi])
  seq.play()
  const total = Math.ceil(TAXA * Math.min(midi.duration + 1, MAX_S))
  const L = new Float32Array(total)
  const R = new Float32Array(total)
  for (let feito = 0; feito < total; ) {
    seq.processTick()
    const n = Math.min(128, total - feito)
    synth.process(L, R, feito, n)
    feito += n
  }
  const bloco = Math.floor(TAXA * 0.4)
  const energias = []
  for (let i = 0; i + bloco <= total; i += bloco) {
    let s = 0
    for (let k = i; k < i + bloco; k++) s += L[k] * L[k] + R[k] * R[k]
    energias.push(s / (2 * bloco))
  }
  const comSom = energias.filter((e) => e > 1e-6) // ignora silêncio (começo/fim)
  const media = comSom.reduce((a, b) => a + b, 0) / Math.max(1, comSom.length)
  return 10 * Math.log10(media + 1e-12)
}

// Multiplica o CC7 de todos os canais por `fator` (linear em amplitude).
function aplicarGanho(midi, fator) {
  const temCc7 = new Set()
  const canaisUsados = new Set()
  for (const trilha of midi.tracks) {
    for (const ev of trilha.events) {
      const tipo = ev.statusByte & 0xf0
      const canal = ev.statusByte & 0x0f
      if (tipo === 0x90) canaisUsados.add(canal)
      if (tipo === 0xb0 && ev.data[0] === CC_VOLUME) temCc7.add(canal)
    }
  }
  // o volume do CC7 é ~quadrático: ganho em amplitude = (cc/127)^2
  const escala = Math.sqrt(fator)
  let estourou = false
  for (const trilha of midi.tracks) {
    for (const ev of trilha.events) {
      if ((ev.statusByte & 0xf0) === 0xb0 && ev.data[0] === CC_VOLUME) {
        const novo = Math.round(ev.data[1] * escala)
        if (novo > 127) estourou = true
        ev.data[1] = Math.max(1, Math.min(127, novo))
      }
    }
  }
  const faltam = [...canaisUsados].filter((c) => !temCc7.has(c))
  if (faltam.length) {
    const v = Math.round(CC_PADRAO * escala)
    if (v > 127) estourou = true
    const eventos = faltam.map((c) => new MIDIMessage(0, 0xb0 | c, new Uint8Array([CC_VOLUME, Math.max(1, Math.min(127, v))])))
    midi.tracks[0].addEvents(0, ...eventos)
  }
  if (estourou) {
    // o CC7 não deu conta: o resto vai na velocidade das notas
    for (const trilha of midi.tracks) for (const ev of trilha.events) if ((ev.statusByte & 0xf0) === 0x90 && ev.data[1] > 0) ev.data[1] = Math.max(1, Math.min(127, Math.round(ev.data[1] * Math.sqrt(escala))))
  }
}

const refs = []
for (const r of REFERENCIAS) {
  try { refs.push(await volumeDb((await fs.readFile(path.join(MUSICAS, r))).buffer)) } catch { /* sem o arquivo */ }
}
refs.sort((a, b) => a - b)
const alvo = refs[Math.floor(refs.length / 2)]
console.log(`alvo (mediana das arenas): ${alvo.toFixed(1)} dB  [${refs.map((x) => x.toFixed(1)).join(', ')}]`)

const args = process.argv.slice(2)
for (let i = 0; i + 1 < args.length; i += 2) {
  const [entrada, saida] = [args[i], args[i + 1]]
  let bytes = (await fs.readFile(entrada)).buffer
  const antes = await volumeDb(bytes)
  let atual = antes
  for (let volta = 0; volta < 6 && Math.abs(atual - alvo) > 0.5; volta++) {
    const midi = BasicMIDI.fromArrayBuffer(bytes)
    aplicarGanho(midi, 10 ** ((alvo - atual) / 20))
    bytes = midi.writeMIDI()
    atual = await volumeDb(bytes)
  }
  await fs.writeFile(saida, new Uint8Array(bytes))
  console.log(`${path.basename(saida)}: ${antes.toFixed(1)} → ${atual.toFixed(1)} dB`)
}
