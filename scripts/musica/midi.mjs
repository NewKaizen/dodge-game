// Um escritor (e leitor) mínimo de arquivos MIDI (SMF formato 1), sem dependência nenhuma.
// Usado por scripts/musica/tutorial.mjs; o leitor existe para os testes conferirem o arquivo.
//
//   const t = novaTrilha('Celesta')            uma trilha (eventos com tick absoluto)
//   t.programa(canal, instrumento)             troca de instrumento (General MIDI, 0 a 127)
//   t.controle(canal, cc, valor)               controle (7 volume, 10 pan, 91 reverb...)
//   t.nota(canal, tick, duracao, altura, vel)  note on + note off
//   t.tempo(bpm) · t.compasso(n, d)            (na trilha de tempo)
//   arquivoMidi({ ppq, trilhas, fim })         Uint8Array do .mid; toda trilha termina no tick `fim`
//                                              (o ponto de loop fica exato)
//   lerMidi(bytes)                             { formato, ppq, trilhas: [{ eventos: [{ tick, tipo, ... }], fim }] }

export const vlq = (n) => {
  if (!Number.isInteger(n) || n < 0 || n > 0x0fffffff) throw new Error(`delta inválido: ${n}`)
  const bytes = [n & 0x7f]
  while ((n >>>= 7)) bytes.unshift((n & 0x7f) | 0x80)
  return bytes
}

const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const u16 = (n) => [(n >>> 8) & 255, n & 255]
const texto = (s) => [...new TextEncoder().encode(s)]
const byte = (n, nome) => {
  if (!Number.isInteger(n) || n < 0 || n > 127) throw new Error(`${nome} fora de 0..127: ${n}`)
  return n
}

export function novaTrilha(nome) {
  const eventos = [] // [tick, ordem, bytes]
  let seq = 0
  const add = (tick, bytes, prioridade = 1) => eventos.push([Math.round(tick), prioridade, seq++, bytes])
  const t = {
    eventos,
    nome,
    programa: (canal, p, tick = 0) => add(tick, [0xc0 | canal, byte(p, 'programa')], 0),
    controle: (canal, cc, v, tick = 0) => add(tick, [0xb0 | canal, byte(cc, 'cc'), byte(v, 'valor')], 0),
    tempo: (bpm, tick = 0) => add(tick, [0xff, 0x51, 0x03, ...u32(Math.round(60_000_000 / bpm)).slice(1)], 0),
    compasso: (n, d, tick = 0) => add(tick, [0xff, 0x58, 0x04, n, Math.log2(d), 24, 8], 0),
    marcador: (s, tick = 0) => add(tick, [0xff, 0x06, ...vlq(texto(s).length), ...texto(s)], 0),
    nota(canal, tick, duracao, altura, vel) {
      if (duracao <= 0) throw new Error('nota sem duração')
      // note off (prioridade 0) antes de note on (2) no mesmo tick: a nota repetida não é cortada
      add(tick, [0x90 | canal, byte(altura, 'altura'), Math.max(1, byte(vel, 'velocidade'))], 2)
      add(tick + duracao, [0x80 | canal, altura, 0], 0)
    },
  }
  if (nome) add(0, [0xff, 0x03, ...vlq(texto(nome).length), ...texto(nome)], -1)
  return t
}

function chunkDaTrilha(t, fim) {
  const ev = [...t.eventos].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
  const ultimo = ev.length ? ev[ev.length - 1][0] : 0
  if (ultimo > fim) throw new Error(`trilha "${t.nome}" passa do fim (${ultimo} > ${fim})`)
  const dados = []
  let anterior = 0
  for (const [tick, , , bytes] of ev) {
    dados.push(...vlq(tick - anterior), ...bytes)
    anterior = tick
  }
  dados.push(...vlq(fim - anterior), 0xff, 0x2f, 0x00) // fim da trilha exatamente no ponto de loop
  return [...texto('MTrk'), ...u32(dados.length), ...dados]
}

export function arquivoMidi({ ppq = 480, trilhas, fim }) {
  const cab = [...texto('MThd'), ...u32(6), ...u16(1), ...u16(trilhas.length), ...u16(ppq)]
  return Uint8Array.from([...cab, ...trilhas.flatMap((t) => chunkDaTrilha(t, fim))])
}

// ---------- leitura (para os testes) ----------

export function lerMidi(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let i = 0
  const ler32 = () => ((b[i++] << 24) | (b[i++] << 16) | (b[i++] << 8) | b[i++]) >>> 0
  const ler16 = () => (b[i++] << 8) | b[i++]
  const tag = () => String.fromCharCode(b[i++], b[i++], b[i++], b[i++])
  const lerVlq = () => {
    let n = 0
    for (let k = 0; k < 4; k++) {
      const c = b[i++]
      n = (n << 7) | (c & 0x7f)
      if (!(c & 0x80)) return n
    }
    throw new Error('VLQ longo demais')
  }
  if (tag() !== 'MThd' || ler32() !== 6) throw new Error('cabeçalho MThd inválido')
  const formato = ler16()
  const n = ler16()
  const ppq = ler16()
  const trilhas = []
  for (let k = 0; k < n; k++) {
    if (tag() !== 'MTrk') throw new Error(`trilha ${k}: esperava MTrk`)
    const tam = ler32()
    const fimDoChunk = i + tam
    if (fimDoChunk > b.length) throw new Error(`trilha ${k}: tamanho ${tam} passa do arquivo`)
    const eventos = []
    let tick = 0
    let status = 0
    let acabou = false
    while (i < fimDoChunk) {
      tick += lerVlq()
      let s = b[i]
      if (s & 0x80) i++
      else s = status // running status
      if (s === 0xff) {
        const meta = b[i++]
        const len = lerVlq()
        const dados = b.slice(i, i + len)
        i += len
        eventos.push({ tick, tipo: 'meta', meta, dados })
        if (meta === 0x2f) {
          acabou = true
          break
        }
        continue
      }
      status = s
      const alto = s & 0xf0
      const canal = s & 0x0f
      if (alto === 0xc0 || alto === 0xd0) eventos.push({ tick, tipo: alto === 0xc0 ? 'programa' : 'pressao', canal, valor: b[i++] })
      else {
        const d1 = b[i++]
        const d2 = b[i++]
        const tipo = alto === 0x90 ? (d2 ? 'on' : 'off') : alto === 0x80 ? 'off' : alto === 0xb0 ? 'controle' : 'outro'
        eventos.push({ tick, tipo, canal, d1, d2 })
      }
    }
    if (!acabou || i !== fimDoChunk) throw new Error(`trilha ${k}: sem fim (FF 2F 00) no lugar certo`)
    trilhas.push({ eventos, fim: tick })
  }
  if (i !== b.length) throw new Error('sobrou byte depois das trilhas')
  return { formato, ppq, trilhas }
}
