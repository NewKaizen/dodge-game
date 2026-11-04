// Gera as músicas do Manual do Ralsei (composição original, feita para o jogo):
//   public/assets/musicas/tutorial.mid    "Caderno do Ralsei": valsa de caixinha de música, para a
//                                          entrada do GUIA e a página 1 (celesta + pizzicato + piano)
//   public/assets/musicas/tutorial2.mid   o mesmo tema com um pouco mais de energia, para a página 2
//                                          (caixinha de música, pizzicato com colcheias, piano em
//                                          arpejo e um glockenspiel respondendo)
// 3/4, 32 compassos em loop exato (~60 s e ~55 s), Fá maior: A A' B A''.
//
//   node scripts/musica/tutorial.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { novaTrilha, arquivoMidi } from './midi.mjs'

export const PPQ = 480
export const TEMPO = PPQ // uma semínima
export const COMPASSO = PPQ * 3 // 3/4
export const COMPASSOS = 32
export const FIM = COMPASSO * COMPASSOS

// General MIDI (0 a 127)
export const GM = { piano: 0, celesta: 8, glockenspiel: 9, caixinha: 10, pizzicato: 45 }

// acordes: baixo (pizzicato, grave) e a posição do piano (região média, suave)
const ACORDES = {
  F: { baixo: 41, notas: [57, 60, 65] },
  'F/C': { baixo: 48, notas: [57, 60, 65] },
  Bb: { baixo: 46, notas: [58, 62, 65] },
  Dm: { baixo: 50, notas: [57, 62, 65] },
  Gm: { baixo: 43, notas: [58, 62, 67] },
  C: { baixo: 48, notas: [55, 60, 64] },
  C7: { baixo: 48, notas: [55, 58, 64] },
  Am: { baixo: 45, notas: [57, 60, 64] },
}

// prettier-ignore
export const HARMONIA = [
  'F', 'F', 'Bb', 'F', 'Dm', 'Gm', 'C', 'C7', // A
  'F', 'F', 'Bb', 'Gm', 'F/C', 'C7', 'F', 'F', // A'
  'Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'F', 'C7', // B
  'F', 'F', 'Bb', 'Gm', 'F/C', 'C7', 'F', 'C7', // A'' (o último C7 leva de volta ao começo)
]

// a melodia, compasso a compasso: [altura MIDI | null (pausa), tempos]; cada compasso soma 3 tempos
const A = [
  [[69, 2], [72, 1]],
  [[77, 1.5], [76, 0.5], [72, 1]],
  [[74, 2], [70, 1]],
  [[72, 3]],
  [[69, 1], [74, 1], [77, 1]],
  [[76, 1.5], [74, 0.5], [70, 1]],
  [[67, 1], [69, 1], [70, 1]],
  [[72, 2], [null, 1]],
]
const A2 = [
  [[69, 2], [72, 1]],
  [[77, 1.5], [79, 0.5], [81, 1]],
  [[79, 1], [77, 1], [74, 1]],
  [[77, 2], [76, 1]],
  [[72, 1], [69, 1], [72, 1]],
  [[70, 1.5], [67, 0.5], [76, 1]],
  [[77, 3]],
  [[69, 1], [72, 1], [null, 1]],
]
const B = [
  [[74, 1], [77, 1], [74, 1]],
  [[76, 1], [79, 1], [76, 1]],
  [[72, 1], [76, 1], [81, 1]],
  [[77, 2], [74, 1]],
  [[70, 1], [74, 1], [79, 1]],
  [[77, 1], [76, 1], [74, 1]],
  [[72, 1.5], [69, 0.5], [65, 1]],
  [[67, 1], [70, 1], [76, 1]],
]
const A3 = [...A2.slice(0, 7), [[67, 1], [69, 1], [70, 1]]] // termina subindo para o Lá do começo
export const MELODIA = [...A, ...A2, ...B, ...A3]

// variacao: 1 (tutorial.mid) ou 2 (tutorial2.mid, a página 2)
export function comporTutorial(variacao = 1) {
  const v2 = variacao === 2
  const tempo = novaTrilha(v2 ? 'Caderno do Ralsei (pagina 2)' : 'Caderno do Ralsei')
  tempo.tempo(v2 ? 104 : 96)
  tempo.compasso(3, 4)
  tempo.marcador('loop')

  const mel = novaTrilha(v2 ? 'Caixinha de musica' : 'Celesta')
  mel.programa(0, v2 ? GM.caixinha : GM.celesta)
  mel.controle(0, 7, v2 ? 96 : 100)
  mel.controle(0, 10, 64)
  mel.controle(0, 91, 72)

  const pizz = novaTrilha('Pizzicato')
  pizz.programa(1, GM.pizzicato)
  pizz.controle(1, 7, v2 ? 92 : 86)
  pizz.controle(1, 10, 46)
  pizz.controle(1, 91, 60)

  const piano = novaTrilha('Piano')
  piano.programa(2, GM.piano)
  piano.controle(2, 7, 70)
  piano.controle(2, 10, 82)
  piano.controle(2, 91, 80)

  const trilhas = [tempo, mel, pizz, piano]
  let glock = null
  if (v2) {
    glock = novaTrilha('Glockenspiel')
    glock.programa(3, GM.glockenspiel)
    glock.controle(3, 7, 62)
    glock.controle(3, 10, 92)
    glock.controle(3, 91, 90)
    trilhas.push(glock)
  }

  MELODIA.forEach((compasso, c) => {
    const inicio = c * COMPASSO
    const acorde = ACORDES[HARMONIA[c]]
    // melodia: legato leve; o 1º tempo um pouco mais forte, frases respirando a cada 4 compassos
    let t = inicio
    compasso.forEach(([altura, tempos], k) => {
      const dur = tempos * TEMPO
      if (altura !== null) mel.nota(0, t, Math.round(dur * 0.92), altura, (k === 0 ? 80 : 70) - (c % 4 === 3 ? 6 : 0))
      t += dur
    })
    // pizzicato: "um-dois-três" de valsa (baixo no 1, o acorde no 2 e no 3)
    pizz.nota(1, inicio, TEMPO * 0.6, acorde.baixo, 74)
    for (const tt of [1, 2]) for (const n of acorde.notas.slice(1)) pizz.nota(1, inicio + tt * TEMPO, TEMPO * 0.45, n, 46)
    if (v2) pizz.nota(1, inicio + 2.5 * TEMPO, TEMPO * 0.35, acorde.baixo + 7, 40) // a colcheia que puxa o próximo compasso
    // piano: o acorde dedilhado devagarinho (v1) ou em arpejo de colcheias (v2), bem baixinho
    if (v2) {
      const ordem = [0, 1, 2, 1, 2, 1]
      ordem.forEach((n, k) => piano.nota(2, inicio + k * (TEMPO / 2), TEMPO / 2 - 10, acorde.notas[n], k === 0 ? 40 : 32))
    } else acorde.notas.forEach((n, k) => piano.nota(2, inicio + k * 40, COMPASSO - 120 - k * 40, n, 38 - k * 2))
    // glockenspiel: responde a 1ª nota do compasso uma oitava acima, de 2 em 2 compassos
    if (glock && c % 2 === 0 && compasso[0][0] !== null) glock.nota(3, inicio, TEMPO, compasso[0][0] + 12, 44)
  })

  return arquivoMidi({ ppq: PPQ, trilhas, fim: FIM })
}

const destino = (nome) => path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public/assets/musicas', nome)
export const ARQUIVOS = { 'tutorial.mid': 1, 'tutorial2.mid': 2 }

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const [nome, variacao] of Object.entries(ARQUIVOS)) {
    const bytes = comporTutorial(variacao)
    fs.writeFileSync(destino(nome), bytes)
    console.log(`${nome}: ${bytes.length} bytes`)
  }
}
