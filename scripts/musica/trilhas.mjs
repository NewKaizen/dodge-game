// Gera as músicas NOVAS do jogo (composições originais, feitas para o jogo; nada copiado de outro jogo):
//
//   campanha_luta.mid       CAMPANHA, as fases: Ré menor, 138 bpm. Baixo em colcheias, cordas
//                           em staccato no contratempo, bateria, e o motivo da casa (Lá-Fá-Ré) no
//                           violino; na última parte, nos metais. O tímpano rola nas viradas.
//   campanha_chefe.mid      CAMPANHA, o chefe: Ré menor, 152 bpm. Órgão, coro com o motivo bem longo,
//                           arpejos de cordas em semicolcheias, bumbo duplo e o acorde napolitano
//                           (Mi bemol) para dar medo.
//   campanha_virada.mid     CAMPANHA, a virada do chefe (os amigos gritam o nome da Kris): o MESMO
//                           motivo das fases em Ré MAIOR, heroico, nos metais, com coro e pratos.
//   campanha_libertado.mid  CAMPANHA, um amigo libertado: Fá maior, 88 bpm, caixinha de música com o
//                           motivo em maior, harpa e cordas suaves.
//   campanha_final.mid      CAMPANHA, o fim do Mundo 1: a melodia de "Casa Silenciosa"
//                           (scripts/musica/campanha.mjs) inteira, levada para Ré MAIOR, com o eco
//                           agora forte, cordas, coro e harpa. A casa volta a falar.
//   super_kris.mid          a música da carta SUPER da Kris (faltava): Mi menor, 168 bpm, fanfarra.
//   pvpResultado.mid        a tela de resultado do PvP (faltava): Dó maior, 112 bpm, leve e alegre.
//
// Todas em loop exato (toda trilha termina no mesmo tick). Mude aqui e rode:
//   node scripts/musica/trilhas.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { novaTrilha, arquivoMidi } from './midi.mjs'
import { MELODIA as MELODIA_CASA, HARMONIA as HARMONIA_CASA, ACORDES as ACORDES_CASA, ATRASO_ECO } from './campanha.mjs'

export const PPQ = 480
const T = PPQ // semínima
const C = PPQ * 4 // compasso 4/4
const S = T / 4 // semicolcheia

// General MIDI (0 a 127)
export const GM = {
  piano: 0,
  celesta: 8,
  glock: 9,
  caixinha: 10,
  orgao: 19,
  baixo: 33,
  baixoSint: 38,
  violino: 40,
  pizzicato: 45,
  harpa: 46,
  timpano: 47,
  cordas: 48,
  cordasLentas: 49,
  coro: 52,
  trompete: 56,
  metais: 61,
  trompas: 60,
}
// bateria (canal 10 = índice 9)
const PERC = { k: 36, s: 38, p: 39, h: 42, o: 46, c: 49, r: 51, a: 50, m: 47, b: 45 }
const VEL = { X: 116, x: 88, g: 46 }

// ---------- acordes ----------
const NOTA = { C: 0, 'C#': 1, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 }
const QUALIDADE = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus: [0, 5, 7], dim: [0, 3, 6], m6: [0, 3, 7, 9] }

// 'Dm', 'A7', 'C/E', 'F#m' -> { raiz, baixo (36..47), notas (fechadas em 55..66) }
export function acorde(nome) {
  const [cifra, barra] = nome.split('/')
  const m = cifra.match(/^([A-G](?:#|b)?)(m7|maj7|m6|m|7|sus|dim)?$/)
  if (!m) throw new Error(`acorde desconhecido: ${nome}`)
  const raiz = NOTA[m[1]]
  const notas = QUALIDADE[m[2] ?? ''].map((i) => 55 + ((((raiz + i - 55) % 12) + 12) % 12)).sort((a, b) => a - b)
  const pcBaixo = barra ? NOTA[barra] : raiz
  return { raiz, baixo: 36 + ((pcBaixo - 36 + 120) % 12), notas }
}

// Ré menor -> Ré maior: Fá vira Fá#, Si bemol vira Si, Dó vira Dó# (o resto fica)
export const paraMaior = (n) => ([5, 10, 0].includes(((n % 12) + 12) % 12) ? n + 1 : n)

// ---------- o montador ----------
export function musica({ nome, bpm, compassos }) {
  const fim = compassos * C
  const tempo = novaTrilha(nome)
  tempo.tempo(bpm)
  tempo.compasso(4, 4)
  tempo.marcador('loop')
  const trilhas = [tempo]
  let livre = 0
  const vel = (v) => Math.max(1, Math.min(127, Math.round(v)))
  const m = {
    fim,
    // um instrumento num canal próprio (o 9 é da bateria)
    inst(nomeT, programa, { volume = 96, pan = 64, reverb = 80 } = {}) {
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
          const d = Math.min(Math.round(dur), fim - tick)
          if (d > 0) t.nota(c, Math.round(tick), d, altura, vel(v))
        },
        acorde(tick, dur, notas, v) {
          for (const n of notas) i.nota(tick, dur, n, v)
        },
        // uma frase: [[altura | null, tempos], ...] a partir de `tick`; devolve o tick do fim
        frase(tick, notas, v, { legato = 0.92, transpor = 0, mapa = (x) => x } = {}) {
          let t0 = tick
          notas.forEach(([a, tempos], k) => {
            const d = tempos * T
            if (a !== null) i.nota(t0, d * legato, mapa(a) + transpor, v - (k % 2 ? 6 : 0))
            t0 += d
          })
          return t0
        },
      }
      return i
    },
    bateria(volume = 100) {
      const t = novaTrilha('Bateria')
      t.controle(9, 7, volume)
      t.controle(9, 91, 40)
      trilhas.push(t)
      return {
        // padrao: { k: 'x...x...', s: '....X...', ... } (16 passos = semicolcheias; 8 = colcheias)
        compasso(inicio, padrao) {
          for (const [chave, linha] of Object.entries(padrao)) {
            const passo = C / linha.length
            ;[...linha].forEach((ch, k) => {
              if (ch === '.' || inicio + k * passo >= fim) return
              t.nota(9, inicio + k * passo, Math.min(passo, 120), PERC[chave], VEL[ch] ?? 80)
            })
          }
        },
      }
    },
    bytes: () => arquivoMidi({ ppq: PPQ, trilhas, fim }),
  }
  return m
}

// ---------- o motivo das fases (Lá-Fá-Ré, a casa), em frases de 2 compassos ----------
// prettier-ignore
const MOTIVO = {
  Dm: [[[69, 1], [65, 1], [62, 1.5], [null, 0.5]], [[64, 0.5], [65, 0.5], [67, 1], [69, 2]]],
  Bb: [[[70, 1], [69, 0.5], [65, 0.5], [62, 2]], [[null, 1], [62, 0.5], [65, 0.5], [70, 1], [69, 1]]],
  Gm: [[[67, 1.5], [70, 0.5], [74, 2]], [[72, 1], [70, 1], [67, 2]]],
  A: [[[69, 1], [73, 1], [76, 2]], [[73, 1], [69, 1], [64, 1], [null, 1]]],
  C: [[[72, 1], [67, 1], [64, 2]], [[65, 1], [67, 1], [72, 2]]],
}
// a frase de cada compasso (a primeira ou a segunda metade do par, pelo acorde)
function linhaDoMotivo(harmonia) {
  return harmonia.map((h, b) => {
    const base = h.replace(/7$/, '')
    const par = MOTIVO[base] ?? MOTIVO[{ Eb: 'Gm', D: 'Dm', Bm: 'Bb', G: 'Gm' }[base]] ?? MOTIVO.Dm
    return par[b % 2]
  })
}

// ---------- CAMPANHA: as fases ----------
// prettier-ignore
const HARM_LUTA = [
  'Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A',
  'Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'A', 'Dm', 'A',
  'Bb', 'C', 'Dm', 'Dm', 'Gm', 'Gm', 'A', 'A7',
  'Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A7',
]

export function comporLuta() {
  const m = musica({ nome: 'Vozes Roubadas (fases)', bpm: 138, compassos: HARM_LUTA.length })
  const violino = m.inst('Violino', GM.violino, { volume: 92, pan: 70, reverb: 90 })
  const metais = m.inst('Metais', GM.metais, { volume: 90, pan: 58 })
  const cordas = m.inst('Cordas (staccato)', GM.cordas, { volume: 82, pan: 50 })
  const baixo = m.inst('Baixo', GM.baixoSint, { volume: 100, reverb: 30 })
  const timpano = m.inst('Timpano', GM.timpano, { volume: 92, reverb: 70 })
  const bat = m.bateria(96)
  const melodia = linhaDoMotivo(HARM_LUTA)
  HARM_LUTA.forEach((h, b) => {
    const t0 = b * C
    const a = acorde(h)
    const parte = Math.floor(b / 8) // 0 A · 1 A' · 2 B · 3 clímax
    // baixo: colcheias raiz-raiz-oitava, puxando no fim do compasso
    ;[0, 0, 12, 0, 0, 12, 7, 12].forEach((n, k) => baixo.nota(t0 + k * (T / 2), T / 2 - 30, a.baixo + n, k % 4 === 0 ? 104 : 84))
    // cordas: o acorde no contratempo (staccato)
    for (const k of [2, 6, 10, 12]) cordas.acorde(t0 + k * S, S * 1.4, a.notas, parte === 3 ? 84 : 70)
    // a melodia: violino nas partes A, B uma oitava acima; o clímax nos metais
    if (parte === 3) metais.frase(t0, melodia[b], 104, { legato: 0.85 })
    else if (parte === 2) violino.frase(t0, melodia[b], 92, { transpor: 12 })
    else violino.frase(t0, melodia[b], 88)
    // bateria: rock na A, tambores na B, dobrado no clímax; virada a cada 8 compassos
    const virada = b % 8 === 7
    if (virada) bat.compasso(t0, { k: 'X...x...x.x.x...', s: '....x...xxxxXXXX', a: '........x.......', m: '..........x.....', b: '............x...' })
    else if (parte === 2) bat.compasso(t0, { k: 'X......x..x.....', m: '....x.......x...', b: '..x.....x....x..', h: 'x.x.x.x.x.x.x.x.' })
    else if (parte === 3) bat.compasso(t0, { k: 'X.x.x.x.X.x.x.x.', s: '....X.......X...', o: 'x.x.x.x.x.x.x.x.', c: b % 2 ? '................' : 'X...............' })
    else bat.compasso(t0, { k: b % 8 === 0 ? 'X......xx.......' : 'x......xx.......', s: '....X.......X..g', h: 'x.xgx.x.x.xgx.x.', c: b % 8 === 0 ? 'X...............' : '................' })
    // tímpano: rufa nas viradas, marca o começo de cada parte
    if (virada) for (let k = 8; k < 16; k++) timpano.nota(t0 + k * S, S, 38, 60 + k * 4)
    if (b % 8 === 0) timpano.nota(t0, T, 38, 110)
  })
  return m.bytes()
}

// ---------- CAMPANHA: o chefe ----------
// prettier-ignore
const HARM_CHEFE = [
  'Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A',
  'Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'Eb', 'A',
  'Gm', 'Gm', 'Dm', 'Dm', 'Bb', 'Bb', 'Eb', 'A7',
  'Dm', 'Bb', 'Eb', 'A', 'Dm', 'Bb', 'Eb', 'A7',
]
// o coro canta o motivo bem longo: uma nota por compasso
// prettier-ignore
const CORO_CHEFE = [69, 65, 62, 62, 67, 70, 69, 73, 69, 65, 62, 65, 67, 70, 70, 69, 70, 67, 65, 69, 70, 74, 70, 73, 74, 70, 67, 69, 74, 77, 79, 76]

export function comporChefe() {
  const m = musica({ nome: 'O Último Quarto', bpm: 152, compassos: HARM_CHEFE.length })
  const orgao = m.inst('Órgão', GM.orgao, { volume: 78, pan: 64, reverb: 110 })
  const coro = m.inst('Coro', GM.coro, { volume: 96, pan: 70, reverb: 120 })
  const cordas = m.inst('Cordas (arpejo)', GM.cordas, { volume: 84, pan: 44 })
  const metais = m.inst('Metais', GM.metais, { volume: 96, pan: 80 })
  const baixo = m.inst('Baixo', GM.baixo, { volume: 106, reverb: 30 })
  const timpano = m.inst('Timpano', GM.timpano, { volume: 100, reverb: 80 })
  const bat = m.bateria(104)
  HARM_CHEFE.forEach((h, b) => {
    const t0 = b * C
    const a = acorde(h)
    const parte = Math.floor(b / 8)
    orgao.acorde(t0, C - 20, [a.baixo + 12, ...a.notas], 70)
    coro.nota(t0, C - 30, CORO_CHEFE[b], parte === 3 ? 100 : 86)
    // arpejo de cordas em semicolcheias (sobe e desce no acorde)
    const arp = [...a.notas, a.notas[0] + 12, a.notas[1] + 12, a.notas[0] + 12, a.notas[2], a.notas[1]]
    for (let k = 0; k < 16; k++) cordas.nota(t0 + k * S, S - 10, arp[k % arp.length] + (parte >= 2 ? 12 : 0), k % 4 === 0 ? 88 : 66)
    // baixo em colcheias, com a oitava
    for (let k = 0; k < 8; k++) baixo.nota(t0 + k * (T / 2), T / 2 - 30, a.baixo + (k % 2 ? 12 : 0), k % 2 ? 80 : 108)
    // metais: golpes no tempo 1 e no "e" do 3 (na B e no clímax)
    if (parte >= 2) {
      metais.acorde(t0, T * 0.6, a.notas, 104)
      metais.acorde(t0 + T * 2.5, T * 0.4, a.notas.map((n) => n + 12), 96)
    }
    const virada = b % 8 === 7
    if (virada) bat.compasso(t0, { k: 'X.x.X.x.X.x.X.x.', s: '........XxXxXXXX', b: 'x...x...........', c: '................' })
    else if (parte === 3) bat.compasso(t0, { k: 'XxxxXxxxXxxxXxxx', s: '....X.......X...', c: b % 2 ? '........X.......' : 'X.......X.......' })
    else bat.compasso(t0, { k: 'X.x.x...X.x.x...', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.', c: b % 4 === 0 ? 'X...............' : '................' })
    timpano.nota(t0, T, a.baixo % 12 === 2 ? 38 : 33 + ((a.baixo - 33) % 12), 104)
    if (virada) for (let k = 8; k < 16; k++) timpano.nota(t0 + k * S, S, 38, 70 + k * 3)
  })
  return m.bytes()
}

// ---------- CAMPANHA: a virada (o tema em Ré maior, heroico) ----------
// prettier-ignore
const HARM_VIRADA = [
  'D', 'D', 'Bm', 'Bm', 'G', 'G', 'A', 'A',
  'D', 'D', 'Bm', 'Bm', 'G', 'A', 'D', 'D',
  'G', 'G', 'D', 'D', 'Em', 'Em', 'A', 'A7',
  'D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'A7',
]

export function comporVirada() {
  const m = musica({ nome: 'As Luzes Voltam', bpm: 152, compassos: HARM_VIRADA.length })
  const metais = m.inst('Metais', GM.metais, { volume: 104, pan: 60, reverb: 90 })
  const trompas = m.inst('Trompas', GM.trompas, { volume: 88, pan: 76, reverb: 100 })
  const coro = m.inst('Coro', GM.coro, { volume: 84, pan: 64, reverb: 120 })
  const cordas = m.inst('Cordas', GM.cordas, { volume: 84, pan: 44 })
  const baixo = m.inst('Baixo', GM.baixo, { volume: 104, reverb: 30 })
  const timpano = m.inst('Timpano', GM.timpano, { volume: 98, reverb: 80 })
  const bat = m.bateria(100)
  // o MESMO motivo das fases, levado para o maior (Lá-Fá#-Ré)
  const melodia = linhaDoMotivo(HARM_LUTA)
  HARM_VIRADA.forEach((h, b) => {
    const t0 = b * C
    const a = acorde(h)
    const parte = Math.floor(b / 8)
    metais.frase(t0, melodia[b], parte === 3 ? 112 : 100, { legato: 0.9, mapa: paraMaior })
    trompas.acorde(t0, C - 40, a.notas, 64)
    coro.acorde(t0, C - 30, a.notas.map((n) => n + 12), parte >= 2 ? 80 : 64)
    for (let k = 0; k < 16; k++) cordas.nota(t0 + k * S, S - 10, a.notas[k % 3] + 12, k % 4 === 0 ? 86 : 64)
    for (let k = 0; k < 8; k++) baixo.nota(t0 + k * (T / 2), T / 2 - 30, a.baixo + (k % 4 === 2 ? 7 : 0), k % 2 ? 84 : 108)
    if (b % 8 === 7) bat.compasso(t0, { k: 'X...X...X.x.X.x.', s: '........xxXxXXXX', c: '................' })
    else bat.compasso(t0, { k: 'X...x.x.X...x.x.', s: '....X.......X...', r: 'x.x.x.x.x.x.x.x.', c: b % 2 === 0 ? 'X...............' : '................' })
    if (b % 4 === 0) timpano.nota(t0, T, 38, 110)
    if (b % 8 === 7) for (let k = 8; k < 16; k++) timpano.nota(t0 + k * S, S, 45, 70 + k * 3)
  })
  return m.bytes()
}

// ---------- CAMPANHA: um amigo libertado ----------
const HARM_LIBERTO = ['F', 'C/E', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C']
// prettier-ignore
const MELODIA_LIBERTO = [
  [[72, 1], [69, 1], [65, 1.5], [null, 0.5]],
  [[67, 0.5], [69, 0.5], [72, 1], [76, 2]],
  [[74, 1], [72, 1], [69, 2]],
  [[70, 1], [72, 1], [74, 2]],
  [[77, 1], [76, 1], [72, 1.5], [null, 0.5]],
  [[74, 0.5], [72, 0.5], [69, 1], [67, 2]],
  [[65, 1], [69, 1], [72, 1], [70, 1]],
  [[69, 1], [67, 1], [72, 2]],
]

export function comporLiberto() {
  const m = musica({ nome: 'Volta a Cor', bpm: 88, compassos: HARM_LIBERTO.length })
  const caixinha = m.inst('Caixinha de música', GM.caixinha, { volume: 100, pan: 70, reverb: 110 })
  const harpa = m.inst('Harpa', GM.harpa, { volume: 86, pan: 50, reverb: 110 })
  const cordas = m.inst('Cordas', GM.cordasLentas, { volume: 72, pan: 64, reverb: 120 })
  HARM_LIBERTO.forEach((h, b) => {
    const t0 = b * C
    const a = acorde(h)
    caixinha.frase(t0, MELODIA_LIBERTO[b], 84, { transpor: 12 })
    const arp = [a.baixo + 12, a.notas[0], a.notas[1], a.notas[2], a.notas[0] + 12, a.notas[2], a.notas[1], a.notas[0]]
    arp.forEach((n, k) => harpa.nota(t0 + k * (T / 2), T, n, k === 0 ? 70 : 52))
    cordas.acorde(t0, C - 20, [a.baixo + 12, ...a.notas], 52)
  })
  return m.bytes()
}

// ---------- CAMPANHA: o fim do Mundo 1 (a "Casa Silenciosa" em Ré maior) ----------
export function comporFinal() {
  const COMP = MELODIA_CASA.length
  const m = musica({ nome: 'A Casa Fala de Novo', bpm: 72, compassos: COMP })
  const piano = m.inst('Piano', GM.piano, { volume: 100, pan: 56, reverb: 100 })
  const eco = m.inst('Piano (eco, agora forte)', GM.piano, { volume: 90, pan: 84, reverb: 120 })
  const cordas = m.inst('Cordas', GM.cordasLentas, { volume: 84, pan: 64, reverb: 120 })
  const coro = m.inst('Coro', GM.coro, { volume: 70, pan: 64, reverb: 127 })
  const harpa = m.inst('Harpa', GM.harpa, { volume: 76, pan: 40, reverb: 110 })
  const timpano = m.inst('Timpano', GM.timpano, { volume: 80, reverb: 90 })
  const fimEco = m.fim
  MELODIA_CASA.forEach((compasso, b) => {
    const t0 = b * C
    const ac = ACORDES_CASA[HARMONIA_CASA[b]]
    const notas = (ac.depois ?? ac.notas).map(paraMaior)
    const baixo = paraMaior(ac.baixo)
    let t = t0
    for (const [altura, tempos] of compasso) {
      const d = tempos * T
      if (altura !== null) {
        piano.nota(t, d * 0.95, paraMaior(altura), 80)
        // o eco volta, uma oitava acima — e agora alto: a casa responde
        const te = t + ATRASO_ECO
        if (te < fimEco) eco.nota(te, Math.min(d * 0.8, fimEco - te), paraMaior(altura) + 12, 62)
      }
      t += d
    }
    cordas.acorde(t0, C - 20, notas, b >= 8 ? 66 : 54)
    cordas.nota(t0, C - 20, baixo, 60)
    if (b >= 8) coro.acorde(t0, C - 30, notas.map((n) => n + 12), 54)
    ;[baixo + 12, notas[0], notas[1], notas[2], notas[0] + 12, notas[2], notas[1], notas[0]].forEach((n, k) => harpa.nota(t0 + k * (T / 2), T, n, k === 0 ? 60 : 42))
    if (b % 4 === 0) timpano.nota(t0, T * 1.5, baixo % 12 === 2 ? 38 : 33 + ((baixo - 33) % 12), 70)
  })
  return m.bytes()
}

// ---------- a SUPER da Kris (faltava) ----------
const HARM_KRIS = ['Em', 'C', 'D', 'B', 'Em', 'C', 'Am', 'B7']
// prettier-ignore
const MELODIA_KRIS = [
  [[64, 0.5], [67, 0.5], [71, 1], [76, 2]],
  [[76, 0.5], [74, 0.5], [72, 1], [67, 2]],
  [[66, 0.5], [69, 0.5], [74, 1], [78, 1.5], [null, 0.5]],
  [[75, 1], [71, 1], [66, 2]],
  [[64, 0.5], [67, 0.5], [71, 1], [76, 1], [79, 1]],
  [[79, 1], [76, 0.5], [72, 0.5], [67, 2]],
  [[69, 1], [72, 1], [76, 1], [81, 1]],
  [[78, 1.5], [75, 0.5], [71, 2]],
]

export function comporSuperKris() {
  const m = musica({ nome: 'Kris (SUPER)', bpm: 168, compassos: HARM_KRIS.length })
  const trompete = m.inst('Trompete', GM.trompete, { volume: 104, pan: 60, reverb: 80 })
  const metais = m.inst('Metais', GM.metais, { volume: 86, pan: 76 })
  const cordas = m.inst('Cordas', GM.cordas, { volume: 84, pan: 44 })
  const baixo = m.inst('Baixo', GM.baixo, { volume: 104, reverb: 20 })
  const timpano = m.inst('Timpano', GM.timpano, { volume: 96 })
  const bat = m.bateria(100)
  HARM_KRIS.forEach((h, b) => {
    const t0 = b * C
    const a = acorde(h)
    trompete.frase(t0, MELODIA_KRIS[b], 110, { legato: 0.85 })
    metais.acorde(t0, T * 0.5, a.notas, 96)
    metais.acorde(t0 + T * 1.5, T * 0.5, a.notas, 88)
    for (let k = 0; k < 16; k++) cordas.nota(t0 + k * S, S - 10, a.notas[k % 3] + 12, k % 4 === 0 ? 88 : 66)
    for (let k = 0; k < 8; k++) baixo.nota(t0 + k * (T / 2), T / 2 - 30, a.baixo + (k % 2 ? 12 : 0), k % 2 ? 84 : 110)
    bat.compasso(t0, b === 7 ? { k: 'X...X...X.X.X.X.', s: '........XxXxXXXX' } : { k: 'X.x...x.X.x...x.', s: '....X.......X...', o: 'x.x.x.x.x.x.x.x.', c: b % 4 === 0 ? 'X...............' : '................' })
    if (b % 2 === 0) timpano.nota(t0, T, 40, 108)
  })
  return m.bytes()
}

// ---------- o resultado do PvP (faltava) ----------
const HARM_RESULTADO = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G7']
// prettier-ignore
const MELODIA_RESULTADO = [
  [[72, 0.5], [76, 0.5], [79, 1], [76, 1], [72, 1]],
  [[74, 1], [72, 0.5], [69, 0.5], [72, 2]],
  [[77, 0.5], [76, 0.5], [74, 1], [72, 1], [69, 1]],
  [[71, 1], [74, 1], [79, 2]],
  [[72, 0.5], [76, 0.5], [79, 1], [84, 1], [79, 1]],
  [[81, 1], [79, 0.5], [76, 0.5], [72, 2]],
  [[74, 1], [77, 1], [81, 1], [77, 1]],
  [[79, 1.5], [77, 0.5], [74, 1], [71, 1]],
]

export function comporResultado() {
  const m = musica({ nome: 'Resultado', bpm: 112, compassos: HARM_RESULTADO.length })
  const sino = m.inst('Glockenspiel', GM.glock, { volume: 92, pan: 74, reverb: 90 })
  const piano = m.inst('Piano', GM.piano, { volume: 90, pan: 54, reverb: 70 })
  const baixo = m.inst('Baixo', GM.baixo, { volume: 98, reverb: 20 })
  const bat = m.bateria(84)
  HARM_RESULTADO.forEach((h, b) => {
    const t0 = b * C
    const a = acorde(h)
    sino.frase(t0, MELODIA_RESULTADO[b], 92, { legato: 0.8 })
    for (const k of [0, 1, 2, 3]) piano.acorde(t0 + k * T + (k % 2 ? T / 2 : 0), T / 2, a.notas, k === 0 ? 78 : 62)
    ;[0, 7, 12, 7].forEach((n, k) => baixo.nota(t0 + k * T, T - 40, a.baixo + n, k === 0 ? 100 : 80))
    bat.compasso(t0, { k: 'x.......x.x.....', p: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' })
  })
  return m.bytes()
}

// nome do arquivo -> o compositor e o tempo (o teste confere a duração do loop)
export const TRILHAS = {
  'campanha_luta.mid': comporLuta,
  'campanha_chefe.mid': comporChefe,
  'campanha_virada.mid': comporVirada,
  'campanha_libertado.mid': comporLiberto,
  'campanha_final.mid': comporFinal,
  'super_kris.mid': comporSuperKris,
  'pvpResultado.mid': comporResultado,
}

const destino = (nome) => path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public/assets/musicas', nome)

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const [nome, compor] of Object.entries(TRILHAS)) {
    const bytes = compor()
    fs.writeFileSync(destino(nome), bytes)
    console.log(`${nome}: ${bytes.length} bytes`)
  }
}
