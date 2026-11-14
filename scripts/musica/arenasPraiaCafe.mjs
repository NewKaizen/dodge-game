// Músicas originais das arenas PRAIA e CAFÉ FRANCÊS do PvP (composições feitas para o jogo;
// nenhuma melodia copiada de outra música):
//
//   arena_praia.mid  "Maré Mansa": bossa-reggae de praia em Dó maior, 108 bpm, 4/4. Flauta e
//                    steel drum na melodia, violão de nylon no contratempo (o "skank" do reggae),
//                    baixo no primeiro e no "e" do segundo tempo, rim-shot de bossa, maracas.
//   arena_cafe.mid   "Valsa do Croissant": valsa musette em Lá menor, 150 bpm, 3/4. Acordeão
//                    (com um segundo acordeão dobrando, o "tremolo" do musette) na melodia, baixo
//                    no 1 e acordes no 2 e no 3 (o "pum-tchá-tchá"), clarinete na segunda volta.
//
// Ambas em loop exato (toda trilha termina no mesmo tick). Mude aqui e rode:
//   node scripts/musica/arenasPraiaCafe.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { novaTrilha, arquivoMidi } from './midi.mjs'
import { acorde, PPQ } from './trilhas.mjs'

const T = PPQ // semínima

// General MIDI (0 a 127)
const GM = { epiano: 4, violaoNylon: 24, baixoDedo: 33, flauta: 73, steelDrum: 114, acordeao: 21, bandoneon: 23, clarinete: 71, contrabaixo: 32, pizzicato: 45, harpa: 46 }
// bateria (canal 10): bumbo, aro, chimbal, maracas, clave, bloco de madeira, caixa
const PERC = { k: 36, r: 37, s: 38, h: 42, o: 46, m: 70, c: 75, w: 76 }

function montar({ nome, bpm, compasso: [n, d], compassos }) {
  const barra = (T * 4 * n) / d
  const fim = compassos * barra
  const tempo = novaTrilha(nome)
  tempo.tempo(bpm)
  tempo.compasso(n, d)
  tempo.marcador('loop')
  const trilhas = [tempo]
  let livre = 0
  const vel = (v) => Math.max(1, Math.min(127, Math.round(v)))
  return {
    barra,
    fim,
    inst(nomeT, programa, { volume = 96, pan = 64, reverb = 70 } = {}) {
      if (livre === 9) livre++
      const c = livre++
      const t = novaTrilha(nomeT)
      t.programa(c, programa)
      t.controle(c, 7, volume)
      t.controle(c, 10, pan)
      t.controle(c, 91, reverb)
      trilhas.push(t)
      const i = {
        nota(tick, dur, altura, v) {
          if (tick >= fim || altura == null) return
          const d2 = Math.min(Math.round(dur), fim - Math.round(tick))
          if (d2 > 0) t.nota(c, Math.round(tick), d2, altura, vel(v))
        },
        acorde(tick, dur, notas, v) {
          for (const nota of notas) i.nota(tick, dur, nota, v)
        },
        // uma frase [[altura | null, tempos], ...] a partir de `tick`
        frase(tick, notas, v, { legato = 0.92, transpor = 0 } = {}) {
          let t0 = tick
          notas.forEach(([a, tempos], k) => {
            const dur = tempos * T
            if (a !== null) i.nota(t0, dur * legato, a + transpor, v - (k % 2 ? 6 : 0))
            t0 += dur
          })
          return t0
        },
      }
      return i
    },
    bateria(volume = 90) {
      const t = novaTrilha('Percussão')
      t.controle(9, 7, volume)
      t.controle(9, 91, 30)
      trilhas.push(t)
      return {
        // padrao: { k: 'x..x', ... } (cada letra um passo igual do compasso); x forte, g fraco
        compasso(inicio, padrao) {
          for (const [chave, linha] of Object.entries(padrao)) {
            const passo = barra / linha.length
            ;[...linha].forEach((ch, k) => {
              if (ch === '.' || inicio + k * passo >= fim) return
              t.nota(9, inicio + k * passo, Math.min(passo, 110), PERC[chave], { X: 108, x: 84, g: 48 }[ch] ?? 80)
            })
          }
        },
      }
    },
    bytes: () => arquivoMidi({ ppq: PPQ, trilhas, fim }),
  }
}

// ---------- PRAIA: "Maré Mansa" ----------
// prettier-ignore
const HARM_PRAIA = [
  'Cmaj7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7',
  'Fmaj7', 'Em7', 'Dm7', 'G7', 'Fmaj7', 'G7', 'Cmaj7', 'G7',
]
// prettier-ignore
const MELODIA_PRAIA = [
  [[76, 1], [79, 0.5], [76, 0.5], [72, 1.5], [null, 0.5]],
  [[69, 1], [72, 0.5], [76, 0.5], [81, 2]],
  [[77, 1.5], [74, 0.5], [72, 1], [69, 1]],
  [[71, 1], [74, 1], [77, 1.5], [null, 0.5]],
  [[76, 1], [79, 0.5], [76, 0.5], [72, 1.5], [null, 0.5]],
  [[72, 1], [76, 0.5], [79, 0.5], [81, 1], [79, 1]],
  [[77, 1], [76, 0.5], [74, 0.5], [72, 1], [74, 1]],
  [[71, 2], [null, 1], [67, 0.5], [71, 0.5]],
  [[77, 1.5], [76, 0.5], [72, 1], [69, 1]],
  [[71, 1], [76, 1], [79, 1.5], [null, 0.5]],
  [[77, 1], [74, 1], [72, 0.5], [74, 0.5], [77, 1]],
  [[79, 1.5], [77, 0.5], [74, 2]],
  [[72, 1], [77, 0.5], [81, 0.5], [84, 1.5], [null, 0.5]],
  [[83, 1], [79, 1], [74, 1], [71, 1]],
  [[72, 0.5], [76, 0.5], [79, 1], [84, 2]],
  [[83, 1], [81, 0.5], [79, 0.5], [77, 1], [74, 1]],
]

export function comporPraia() {
  const volta = HARM_PRAIA.length // 16 compassos; a música toca duas voltas
  const m = montar({ nome: 'Maré Mansa', bpm: 108, compasso: [4, 4], compassos: volta * 2 })
  const flauta = m.inst('Flauta', GM.flauta, { volume: 98, pan: 74, reverb: 90 })
  const steel = m.inst('Steel drum', GM.steelDrum, { volume: 92, pan: 54, reverb: 80 })
  const violao = m.inst('Violão de nylon', GM.violaoNylon, { volume: 84, pan: 46, reverb: 50 })
  const piano = m.inst('Piano elétrico', GM.epiano, { volume: 62, pan: 82, reverb: 70 })
  const baixo = m.inst('Baixo', GM.baixoDedo, { volume: 100, pan: 64, reverb: 20 })
  const bat = m.bateria(86)
  for (let b = 0; b < volta * 2; b++) {
    const t0 = b * m.barra
    const h = HARM_PRAIA[b % volta]
    const a = acorde(h)
    const segunda = b >= volta
    // melodia: 1ª volta na flauta (e o steel drum na parte B); 2ª volta nos dois, o steel uma oitava abaixo
    const fraseMelodia = MELODIA_PRAIA[b % volta]
    if (!segunda) {
      flauta.frase(t0, fraseMelodia, 92, { legato: 0.88 })
      if (b >= 8) steel.frase(t0, fraseMelodia, 70, { legato: 0.7, transpor: -12 })
    } else {
      flauta.frase(t0, fraseMelodia, 100, { legato: 0.88 })
      steel.frase(t0, fraseMelodia, 84, { legato: 0.7, transpor: -12 })
    }
    // violão: o "skank" no contratempo do 2 e do 4 (reggae) e um toque no "e" do 1
    for (const k of [1.5, 3.5]) violao.acorde(t0 + k * T, T * 0.32, a.notas, k === 1.5 ? 74 : 66)
    violao.acorde(t0 + 2.5 * T, T * 0.22, a.notas.slice(1), 44)
    // piano elétrico: colchão leve nos tempos 1 e 3
    piano.acorde(t0, T * 1.8, a.notas, 40)
    piano.acorde(t0 + 2 * T, T * 1.8, a.notas, 36)
    // baixo: raiz no 1, quinta no "e" do 2, raiz no 3, oitava no "e" do 4
    ;[[0, 1.4, 0, 100], [1.5, 0.45, 7, 78], [2, 1.4, 0, 92], [3.5, 0.45, 12, 76]].forEach(([k, d, n, v]) => baixo.nota(t0 + k * T, d * T, a.baixo + n, v))
    // percussão: aro de bossa, bumbo, chimbal e maracas
    bat.compasso(t0, { r: 'x..x..x...x..x..', k: 'x.....x.x.....x.', h: 'g.g.g.g.g.g.g.g.', m: 'gxgxgxgxgxgxgxgx' })
    if (b % 8 === 7) bat.compasso(t0, { c: '............x.x.' })
  }
  return m.bytes()
}

// ---------- CAFÉ: "Valsa do Croissant" ----------
// prettier-ignore
const HARM_CAFE = [
  'Am', 'Am', 'Dm', 'E7', 'Am', 'C', 'Dm', 'E7',
  'Am', 'F', 'Dm', 'E7', 'Am', 'Dm', 'E7', 'Am',
]
// prettier-ignore
const MELODIA_CAFE = [
  [[76, 1.5], [74, 0.5], [72, 1]],
  [[69, 1], [72, 1], [76, 1]],
  [[77, 1.5], [76, 0.5], [74, 1]],
  [[71, 1], [76, 1], [80, 1]],
  [[81, 1.5], [79, 0.5], [76, 1]],
  [[72, 1], [76, 1], [79, 1]],
  [[77, 1], [74, 1], [69, 1]],
  [[68, 1], [71, 1], [null, 1]],
  [[69, 0.5], [72, 0.5], [76, 1], [81, 1]],
  [[77, 1.5], [76, 0.5], [72, 1]],
  [[74, 1], [77, 1], [81, 1]],
  [[80, 1.5], [79, 0.5], [76, 1]],
  [[81, 1], [76, 1], [72, 1]],
  [[74, 1], [77, 0.5], [74, 0.5], [69, 1]],
  [[68, 1], [71, 1], [74, 1]],
  [[69, 2], [null, 1]],
]

export function comporCafe() {
  const volta = HARM_CAFE.length // 16 compassos de 3/4; duas voltas
  const m = montar({ nome: 'Valsa do Croissant', bpm: 150, compasso: [3, 4], compassos: volta * 2 })
  const acordeao = m.inst('Acordeão', GM.acordeao, { volume: 104, pan: 58, reverb: 70 })
  const musette = m.inst('Acordeão (musette)', GM.bandoneon, { volume: 66, pan: 72, reverb: 70 })
  const clarinete = m.inst('Clarinete', GM.clarinete, { volume: 80, pan: 84, reverb: 80 })
  const violao = m.inst('Violão', GM.violaoNylon, { volume: 80, pan: 40, reverb: 40 })
  const baixo = m.inst('Contrabaixo', GM.contrabaixo, { volume: 100, pan: 64, reverb: 20 })
  const bat = m.bateria(70)
  for (let b = 0; b < volta * 2; b++) {
    const t0 = b * m.barra
    const h = HARM_CAFE[b % volta]
    const a = acorde(h)
    const segunda = b >= volta
    const fraseMelodia = MELODIA_CAFE[b % volta]
    // melodia no acordeão; o segundo acordeão dobra uma oitava acima (o tremolo do musette)
    acordeao.frase(t0, fraseMelodia, segunda ? 104 : 96, { legato: 0.9 })
    musette.frase(t0, fraseMelodia, 60, { legato: 0.9, transpor: 12 })
    // segunda volta: o clarinete faz uma terça abaixo nas partes B
    if (segunda && b % volta >= 8) clarinete.frase(t0, fraseMelodia, 74, { legato: 0.85, transpor: -5 })
    // pum-tchá-tchá: baixo no 1 (raiz; quinta nos compassos pares) e acordes no 2 e no 3
    baixo.nota(t0, T * 0.85, a.baixo + (b % 2 ? 7 : 0), 100)
    violao.acorde(t0 + T, T * 0.55, a.notas, 70)
    violao.acorde(t0 + 2 * T, T * 0.55, a.notas, 62)
    // percussão leve: aro no 2 e no 3 e chimbal fraco
    bat.compasso(t0, { r: '.gg', h: 'g.g.g.', w: b % 4 === 3 ? '..x' : '...' })
  }
  return m.bytes()
}

// nome do arquivo -> o compositor (o teste confere o loop e o andamento)
export const TRILHAS_ARENAS = {
  'arena_praia.mid': comporPraia,
  'arena_cafe.mid': comporCafe,
}

const destino = (nome) => path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public/assets/musicas', nome)

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const [nome, compor] of Object.entries(TRILHAS_ARENAS)) {
    const bytes = compor()
    fs.writeFileSync(destino(nome), bytes)
    console.log(`${nome}: ${bytes.length} bytes`)
  }
}
