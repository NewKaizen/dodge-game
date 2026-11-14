// Gera as músicas das arenas ESTAÇÃO ESPACIAL, CHINATOWN e CIDADE GRANDE (composições originais,
// feitas para o jogo; nada copiado de outro jogo). Rode depois de mudar:
//   node scripts/musica/arenasNovas.mjs
//
//   arena_estacao.mid     "Órbita Baixa": ambiente espacial em Lá menor, 82 bpm. Pad de sintetizador,
//                         arpejo cristalino, baixo pulsando como um sonar e uma melodia lenta e solta;
//                         a bateria só entra na segunda metade, bem suave.
//   arena_chinatown.mid   "Rua das Mil Lanternas": Ré maior PENTATÔNICA, 136 bpm. Rabeca no lugar do erhu,
//                         koto tocando o ostinato, flauta, baixo, tambores taiko e gongo.
//   arena_cidade.mid      "Hora do Rush": funk/jazz-hop em Dó maior, 94 bpm. Piano elétrico com acordes
//                         de sétima, baixo, guitarra abafada, sax tenor e batida de boom-bap.
//
// Todas em loop exato (toda trilha termina no mesmo tick).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { musica, acorde, PPQ } from './trilhas.mjs'

const T = PPQ
const C = PPQ * 4
const S = T / 4

// General MIDI (0 a 127)
const GM = {
  pianoEletrico: 4,
  celesta: 8,
  guitarraAbafada: 28,
  baixoDedo: 33,
  baixoSint: 38,
  violino: 40,
  koto: 107,
  saxTenor: 66,
  flauta: 73,
  leadQuadrado: 80,
  padCalor: 89,
  efCristal: 98,
}

// ---------- ESTAÇÃO ESPACIAL: Órbita Baixa ----------
// prettier-ignore
const HARM_ESTACAO = ['Am', 'Fmaj7', 'C', 'G', 'Am', 'Fmaj7', 'Dm', 'Em', 'Am', 'Fmaj7', 'C', 'G', 'F', 'Dm', 'Em', 'Am']
// prettier-ignore
const MELODIA_ESTACAO = [
  [[69, 2], [72, 1], [71, 1]],
  [[69, 3], [67, 1]],
  [[67, 1], [72, 1], [76, 2]],
  [[74, 2], [71, 1], [67, 1]],
  [[69, 1.5], [72, 0.5], [76, 2]],
  [[77, 2], [76, 1], [72, 1]],
  [[74, 1], [72, 1], [69, 2]],
  [[71, 2], [null, 1], [67, 1]],
  [[76, 1], [72, 1], [69, 1], [72, 1]],
  [[77, 1], [76, 1], [72, 2]],
  [[79, 2], [76, 1], [72, 1]],
  [[74, 1], [71, 1], [67, 2]],
  [[72, 1], [77, 1], [81, 2]],
  [[79, 1], [77, 1], [74, 2]],
  [[76, 2], [71, 1], [67, 1]],
  [[69, 4]],
]

export function comporEstacao() {
  const m = musica({ nome: 'Órbita Baixa', bpm: 82, compassos: HARM_ESTACAO.length })
  const pad = m.inst('Pad', GM.padCalor, { volume: 78, pan: 64, reverb: 120 })
  const lead = m.inst('Lead', GM.leadQuadrado, { volume: 66, pan: 72, reverb: 115 })
  const arpejo = m.inst('Arpejo', GM.efCristal, { volume: 70, pan: 50, reverb: 110 })
  const celesta = m.inst('Celesta', GM.celesta, { volume: 62, pan: 80, reverb: 100 })
  const baixo = m.inst('Baixo', GM.baixoSint, { volume: 86, reverb: 40 })
  const bat = m.bateria(62)
  HARM_ESTACAO.forEach((h, b) => {
    const t0 = b * C
    const a = acorde(h)
    const parte = b < 8 ? 0 : 1
    // pad: o acorde inteiro, com o grave dobrando
    pad.acorde(t0, C * 0.98, a.notas, parte ? 62 : 52)
    // baixo: pulso de sonar (raiz, uma oitava acima no contratempo)
    ;[0, 4, 8, 12].forEach((k, i) => baixo.nota(t0 + k * S, S * 3, a.baixo + (i === 2 ? 7 : 0), i === 0 ? 92 : 70))
    // arpejo cristalino em colcheias, subindo e descendo pelo acorde
    const cima = a.notas.map((n) => n + 12)
    const ordem = [0, 1, 2, cima.length > 3 ? 3 : 1, 2, 1, 0, 1]
    ordem.forEach((i, k) => arpejo.nota(t0 + k * (T / 2), T / 2 - 30, cima[i % cima.length], k % 4 === 0 ? 66 : 50))
    // uma gotinha de celesta lá em cima, uma vez por compasso na segunda parte
    if (parte) celesta.nota(t0 + 3 * T, T * 0.9, cima[2] + 12, 60)
    lead.frase(t0, MELODIA_ESTACAO[b], parte ? 80 : 70, { legato: 0.97 })
    if (b >= 4) bat.compasso(t0, { k: 'x.......x.......', h: parte ? 'g.g.g.g.g.g.g.g.' : '' })
    if (parte) bat.compasso(t0, { p: '........x.......' })
  })
  return m.bytes()
}

// ---------- CHINATOWN: Rua das Mil Lanternas ----------
// prettier-ignore
const HARM_CHINATOWN = ['D', 'D', 'G', 'A', 'Bm', 'G', 'A', 'D', 'D', 'Bm', 'G', 'A', 'G', 'A', 'Bm', 'D']
// prettier-ignore
const MELODIA_CHINATOWN = [
  [[74, 0.5], [76, 0.5], [78, 1], [81, 1], [78, 1]],
  [[76, 1], [74, 0.5], [71, 0.5], [69, 2]],
  [[71, 0.5], [74, 0.5], [76, 1], [74, 1], [71, 1]],
  [[69, 1], [71, 1], [74, 1], [76, 0.5], [78, 0.5]],
  [[78, 1], [76, 0.5], [74, 0.5], [71, 2]],
  [[74, 0.5], [76, 0.5], [78, 1], [76, 1], [74, 1]],
  [[81, 1], [78, 1], [76, 1], [74, 0.5], [71, 0.5]],
  [[74, 2], [69, 1], [null, 1]],
  [[81, 1], [83, 0.5], [81, 0.5], [78, 1], [76, 1]],
  [[78, 0.5], [81, 0.5], [83, 1], [81, 1], [78, 1]],
  [[83, 1], [81, 0.5], [78, 0.5], [76, 2]],
  [[74, 0.5], [76, 0.5], [78, 1], [81, 2]],
  [[83, 1.5], [81, 0.5], [78, 1], [76, 1]],
  [[81, 1], [78, 1], [76, 1], [74, 1]],
  [[71, 1], [74, 1], [78, 1], [76, 0.5], [74, 0.5]],
  [[74, 3], [null, 1]],
]

export function comporChinatown() {
  const m = musica({ nome: 'Rua das Mil Lanternas', bpm: 136, compassos: HARM_CHINATOWN.length })
  const rabeca = m.inst('Rabeca (erhu)', GM.violino, { volume: 98, pan: 66, reverb: 95 })
  const flauta = m.inst('Flauta', GM.flauta, { volume: 78, pan: 82, reverb: 100 })
  const koto = m.inst('Koto (pipa)', GM.koto, { volume: 88, pan: 44, reverb: 70 })
  const baixo = m.inst('Baixo', GM.baixoDedo, { volume: 92, reverb: 25 })
  const bat = m.bateria(92)
  HARM_CHINATOWN.forEach((h, b) => {
    const t0 = b * C
    const a = acorde(h)
    const parte = b < 8 ? 0 : 1
    rabeca.frase(t0, MELODIA_CHINATOWN[b], parte ? 100 : 92, { legato: 0.95 })
    // a flauta dobra a melodia uma oitava acima na segunda parte
    if (parte) flauta.frase(t0, MELODIA_CHINATOWN[b], 74, { legato: 0.85, transpor: 12 })
    // koto: ostinato em semicolcheias pelos sons do acorde, com acentos
    const alto = a.notas.map((n) => n + 12)
    const ordem = [0, 2, 1, 2, 0, 2, 1, 2, 0, 1, 2, 1, 0, 2, 1, 2]
    ordem.forEach((i, k) => {
      if (k % 4 === 3 && b % 2) return // respiro de vez em quando
      koto.nota(t0 + k * S, S * 0.9, alto[i], k % 4 === 0 ? 86 : 62)
    })
    // baixo: raiz e quinta, saltitando
    ;[0, null, 0, 7, null, 0, 7, 12].forEach((n, k) => n !== null && baixo.nota(t0 + k * (T / 2), T / 2 - 30, a.baixo + n, k % 4 === 0 ? 100 : 80))
    // tambores taiko e gongo
    if (b % 8 === 0) bat.compasso(t0, { k: 'x.......x.x.....', m: '....x.......x...', b: 'X...............', c: 'X...............' })
    else if (b % 8 === 7) bat.compasso(t0, { k: 'x.......x.x.x...', m: '....x...x.x.x.x.', a: '..............xx', b: 'X...............' })
    else if (parte) bat.compasso(t0, { k: 'x.......x.x.....', m: '....x.......x...', a: '..x.....x....x..', h: 'x.x.x.x.x.x.x.x.', o: '..............x.' })
    else bat.compasso(t0, { k: 'x.......x.......', m: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' })
  })
  return m.bytes()
}

// ---------- CIDADE GRANDE: Hora do Rush ----------
// prettier-ignore
const HARM_CIDADE = ['Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'A7', 'Fmaj7', 'Em7', 'Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7']
// prettier-ignore
const MELODIA_CIDADE = [
  [[null, 1], [69, 0.5], [72, 0.5], [74, 1], [72, 1]],
  [[71, 1], [67, 0.5], [71, 0.5], [74, 1], [null, 1]],
  [[72, 1.5], [71, 0.5], [67, 1], [64, 1]],
  [[69, 1], [null, 0.5], [72, 0.5], [69, 1], [67, 1]],
  [[null, 0.5], [74, 0.5], [77, 1], [76, 0.5], [74, 0.5], [72, 1]],
  [[71, 0.5], [74, 0.5], [79, 1], [77, 1], [74, 1]],
  [[76, 2], [72, 1], [67, 1]],
  [[73, 1], [69, 1], [76, 1], [null, 1]],
  [[77, 1], [76, 0.5], [72, 0.5], [69, 1], [72, 1]],
  [[71, 1], [67, 1], [64, 2]],
  [[74, 0.5], [77, 0.5], [81, 1], [79, 1], [77, 1]],
  [[79, 1], [77, 0.5], [74, 0.5], [71, 2]],
  [[72, 1], [75, 0.5], [76, 0.5], [79, 2]],
  [[81, 1], [79, 1], [76, 1], [72, 1]],
  [[77, 1], [74, 1], [72, 1], [69, 1]],
  [[71, 1], [74, 1], [77, 1], [null, 1]],
]

export function comporCidade() {
  const m = musica({ nome: 'Hora do Rush', bpm: 94, compassos: HARM_CIDADE.length })
  const piano = m.inst('Piano elétrico', GM.pianoEletrico, { volume: 86, pan: 50, reverb: 60 })
  const sax = m.inst('Sax tenor', GM.saxTenor, { volume: 92, pan: 74, reverb: 85 })
  const guitarra = m.inst('Guitarra abafada', GM.guitarraAbafada, { volume: 72, pan: 84, reverb: 30 })
  const baixo = m.inst('Baixo', GM.baixoDedo, { volume: 100, reverb: 20 })
  const bat = m.bateria(94)
  HARM_CIDADE.forEach((h, b) => {
    const t0 = b * C
    const a = acorde(h)
    const parte = b < 8 ? 0 : 1
    // piano: acordes sincopados (no 1, no "e" do 2 e no "e" do 3)
    ;[0, 6, 10].forEach((k, i) => piano.acorde(t0 + k * S, S * (i === 0 ? 5 : 3), a.notas, i === 0 ? 74 : 60))
    // baixo funkeado: raiz, fantasma, quinta, oitava
    ;[0, null, 0, 7, null, 12, 7, null].forEach((n, k) => n !== null && baixo.nota(t0 + k * (T / 2), T / 2 - 40, a.baixo + n, k === 0 ? 106 : k % 2 ? 72 : 90))
    // guitarra abafada: "chicotadas" curtas no contratempo (mais cheia na segunda parte)
    const passos = parte ? [2, 5, 7, 10, 13, 15] : [2, 7, 10, 15]
    for (const k of passos) guitarra.acorde(t0 + k * S, S * 0.55, a.notas.slice(1).map((n) => n + 12), 58)
    sax.frase(t0, MELODIA_CIDADE[b], parte ? 100 : 90, { legato: 0.88 })
    // boom-bap: bumbo sincopado, caixa no 2 e no 4, chimbal com notas fantasma
    const virada = b % 8 === 7
    if (virada) bat.compasso(t0, { k: 'X.....x..x......', s: '....X.......X.xx', h: 'x.xxx.xxx.xxx.x.', c: '................' })
    else bat.compasso(t0, { k: b % 2 ? 'X..x..x...x.....' : 'X.....x..x......', s: '....X.......X...', h: 'xgxgxgxgxgxgxgxg', c: b % 8 === 0 ? 'X...............' : '................' })
  })
  return m.bytes()
}

// nome do arquivo -> o compositor (o teste confere o loop, o andamento e a escala)
export const TRILHAS_ARENAS = {
  'arena_estacao.mid': comporEstacao,
  'arena_chinatown.mid': comporChinatown,
  'arena_cidade.mid': comporCidade,
}

const destino = (nome) => path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public/assets/musicas', nome)

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const [nome, compor] of Object.entries(TRILHAS_ARENAS)) {
    const bytes = compor()
    fs.writeFileSync(destino(nome), bytes)
    console.log(`${nome}: ${bytes.length} bytes`)
  }
}
