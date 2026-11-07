// Gera as músicas da CAMPANHA, Mundo 1 "A Casa Silenciosa" (composição original, feita para o jogo):
//   public/assets/musicas/campanha.mid    "Casa Silenciosa": o mapa e os diálogos. Piano esparso em
//                                          Ré menor, cada frase devolvida um tempo e meio depois, uma
//                                          oitava acima e bem mais baixo (o ECO); cordas lentas e um
//                                          pad grave sustentando o acorde. Muito espaço entre as notas.
//   public/assets/musicas/campanha2.mid   o mesmo tema, um pouco mais tenso, para as fases e o chefe:
//                                          cordas em trêmolo, um tímpano baixinho batendo como um
//                                          coração (tum-tum) e o baixo do piano em colcheias.
// 4/4, 16 compassos em loop exato (~58 s e ~53 s), Ré menor.
//
//   node scripts/musica/campanha.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { novaTrilha, arquivoMidi } from './midi.mjs'

export const PPQ = 480
export const TEMPO = PPQ // uma semínima
export const COMPASSO = PPQ * 4 // 4/4
export const COMPASSOS = 16
export const FIM = COMPASSO * COMPASSOS
export const ATRASO_ECO = TEMPO * 1.5 // o eco chega um tempo e meio depois

// General MIDI (0 a 127)
export const GM = { piano: 0, contrabaixo: 43, tremolo: 44, timpano: 47, cordas: 49, pad: 89 }

// acordes: baixo (grave) e a posição das cordas (região média, fechada)
export const ACORDES = {
  Dm: { baixo: 38, notas: [57, 62, 65] },
  Bb: { baixo: 34, notas: [58, 62, 65] },
  Gm: { baixo: 43, notas: [58, 62, 67] },
  A: { baixo: 45, notas: [57, 61, 64] },
  Asus: { baixo: 45, notas: [57, 62, 64], depois: [57, 61, 64] }, // a suspensão resolve no 3º tempo
  Bbmaj7: { baixo: 34, notas: [57, 62, 65] },
  Gm6: { baixo: 43, notas: [58, 64, 67] },
  F: { baixo: 41, notas: [57, 60, 65] },
  'C/E': { baixo: 40, notas: [55, 60, 64] },
  'Dm/F': { baixo: 41, notas: [57, 62, 65] },
  Em7b5: { baixo: 40, notas: [58, 62, 67] },
  A7: { baixo: 45, notas: [55, 61, 64] },
}

// prettier-ignore
export const HARMONIA = [
  'Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bbmaj7', 'Gm6', 'Asus', // A
  'F', 'C/E', 'Dm', 'Bb', 'Gm', 'Dm/F', 'Em7b5', 'A7', // B (o Lá com sétima leva de volta ao começo)
]

// a melodia, compasso a compasso: [altura MIDI | null (pausa), tempos]; cada compasso soma 4 tempos
// (poucas notas e muito silêncio: a música tem que deixar o lugar vazio)
// prettier-ignore
export const MELODIA = [
  [[null, 1], [69, 1.5], [65, 1.5]],
  [[62, 3], [null, 1]],
  [[null, 1], [67, 1], [70, 1], [69, 1]],
  [[64, 3], [null, 1]],
  [[null, 1], [69, 1.5], [74, 1.5]],
  [[72, 2], [69, 1], [null, 1]],
  [[67, 1.5], [64, 0.5], [65, 1], [null, 1]],
  [[61, 3], [null, 1]],
  [[null, 1], [72, 1.5], [69, 1.5]],
  [[67, 2], [64, 1], [null, 1]],
  [[null, 1], [65, 1], [69, 1], [74, 1]],
  [[74, 1.5], [72, 1.5], [null, 1]],
  [[70, 2], [67, 1], [null, 1]],
  [[69, 3], [null, 1]],
  [[67, 1], [65, 1], [64, 1], [null, 1]],
  [[61, 2], [64, 1], [null, 1]],
]

// variacao: 1 (campanha.mid: mapa e diálogos) ou 2 (campanha2.mid: fases e chefe)
export function comporCampanha(variacao = 1) {
  const v2 = variacao === 2
  const tempo = novaTrilha(v2 ? 'Casa Silenciosa (fases)' : 'Casa Silenciosa')
  tempo.tempo(v2 ? 72 : 66)
  tempo.compasso(4, 4)
  tempo.marcador('loop')

  const piano = novaTrilha('Piano')
  piano.programa(0, GM.piano)
  piano.controle(0, 7, 96)
  piano.controle(0, 10, 54)
  piano.controle(0, 91, 100)

  const eco = novaTrilha('Piano (eco)')
  eco.programa(1, GM.piano)
  eco.controle(1, 7, 70)
  eco.controle(1, 10, 86)
  eco.controle(1, 91, 127)

  const esquerda = novaTrilha('Piano (mao esquerda)')
  esquerda.programa(5, GM.piano)
  esquerda.controle(5, 7, 84)
  esquerda.controle(5, 10, 44)
  esquerda.controle(5, 91, 100)

  const cordas = novaTrilha(v2 ? 'Cordas em tremolo' : 'Cordas')
  cordas.programa(2, v2 ? GM.tremolo : GM.cordas)
  cordas.controle(2, 7, v2 ? 64 : 72)
  cordas.controle(2, 10, 64)
  cordas.controle(2, 91, 110)

  const pad = novaTrilha('Pad')
  pad.programa(3, GM.pad)
  pad.controle(3, 7, 64)
  pad.controle(3, 10, 64)
  pad.controle(3, 91, 90)

  const trilhas = [tempo, piano, eco, esquerda, cordas, pad]
  let timpano = null
  if (v2) {
    timpano = novaTrilha('Timpano')
    timpano.programa(4, GM.timpano)
    timpano.controle(4, 7, 80)
    timpano.controle(4, 10, 64)
    timpano.controle(4, 91, 70)
    trilhas.push(timpano)
  }

  MELODIA.forEach((compasso, c) => {
    const inicio = c * COMPASSO
    const acorde = ACORDES[HARMONIA[c]]
    // a melodia, e o eco dela (uma oitava acima, bem mais baixo; o que passaria do fim é cortado)
    let t = inicio
    compasso.forEach(([altura, tempos], k) => {
      const dur = tempos * TEMPO
      if (altura !== null) {
        piano.nota(0, t, Math.round(dur * 0.95), altura, (k === 0 || compasso[k - 1][0] === null ? 58 : 50) - (c % 4 === 3 ? 4 : 0))
        const te = t + ATRASO_ECO
        const de = Math.min(Math.round(dur * 0.8), FIM - te)
        if (de > 0) eco.nota(1, te, de, altura + 12, 26)
      }
      t += dur
    })
    // a mão esquerda: o baixo e a quinta, uma vez por compasso (v1) ou em colcheias baixinhas (v2)
    if (v2) {
      const ordem = [0, 7, 12, 7, 0, 7, 12, 7]
      ordem.forEach((n, k) => esquerda.nota(5, inicio + k * (TEMPO / 2), TEMPO / 2 - 20, acorde.baixo + 12 + n, k % 4 === 0 ? 34 : 24))
    } else {
      esquerda.nota(5, inicio, COMPASSO - 60, acorde.baixo + 12, 36)
      esquerda.nota(5, inicio + 40, COMPASSO - 100, acorde.baixo + 19, 28)
    }
    // cordas: o acorde inteiro, longo (com a suspensão resolvendo no meio)
    if (acorde.depois) {
      for (const n of acorde.notas) cordas.nota(2, inicio, COMPASSO / 2 - 10, n, 34)
      for (const n of acorde.depois) cordas.nota(2, inicio + COMPASSO / 2, COMPASSO / 2 - 10, n, 34)
    } else for (const n of acorde.notas) cordas.nota(2, inicio, COMPASSO - 10, n, v2 ? 38 : 32)
    // o pad: só a fundamental, bem grave
    pad.nota(3, inicio, COMPASSO - 10, acorde.baixo, 40)
    // o tímpano: um coração baixinho (tum-tum) no 1º tempo
    if (timpano) {
      timpano.nota(4, inicio, TEMPO / 2, 38, c % 4 === 3 ? 44 : 52)
      timpano.nota(4, inicio + TEMPO * 0.75, TEMPO / 2, 38, 34)
    }
  })

  return arquivoMidi({ ppq: PPQ, trilhas, fim: FIM })
}

const destino = (nome) => path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public/assets/musicas', nome)
export const ARQUIVOS = { 'campanha.mid': 1, 'campanha2.mid': 2 }

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const [nome, variacao] of Object.entries(ARQUIVOS)) {
    const bytes = comporCampanha(variacao)
    fs.writeFileSync(destino(nome), bytes)
    console.log(`${nome}: ${bytes.length} bytes`)
  }
}
