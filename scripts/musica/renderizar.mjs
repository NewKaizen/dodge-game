// Pré-renderiza as músicas: cada .mid de assets-fonte/musicas/ vira áudio comprimido em
// public/assets/musicas/render/ (Opus em .webm e AAC em .m4a, a reserva do Safari), com o
// MESMO sintetizador (spessasynth_core) e o MESMO soundfont (assets-fonte/soundfont/soundfont.sf3)
// que o jogo usava ao vivo. O jogo (src/game/musica.js) só toca os arquivos: nenhum
// sintetizador roda no navegador.
//
//   node scripts/musica/renderizar.mjs                 renderiza o que mudou (o resto fica)
//   node scripts/musica/renderizar.mjs --tudo          renderiza tudo de novo
//   node scripts/musica/renderizar.mjs menu pvp        só essas (se o alvo de volume não mudou)
//   node scripts/musica/renderizar.mjs --verificar     confere os arquivos prontos: decodifica cada
//                                                      um e mede o pico e a emenda do loop
//   node scripts/musica/renderizar.mjs --verificar --wav=<pasta>
//                                                      ...e grava a emenda de cada uma em WAV
//
// Precisa de ffmpeg com libopus (FFMPEG=/caminho/do/ffmpeg, o do PATH ou o pacote ffmpeg-static,
// se alguém instalar). O deploy NÃO precisa: os arquivos renderizados ficam no repositório.
//
// O arquivo de cada música (o loop sem emenda):
//   O sequenciador toca o .mid em loop (como o jogo fazia) até o começo da 3ª volta. A 1ª volta
//   começa "limpa"; a 2ª já traz a cauda (reverb, notas soltando) do fim da anterior, que é o que
//   se ouve em loop: ela é o corpo. Os primeiros FUNDE_S do corpo se fundem, a partir da
//   continuação de verdade do fim (o começo da 3ª volta), no próprio corpo: o salto do loopEnd
//   para o loopStart não tem degrau (as voltas não são iguais na amostra: o LFO do chorus não
//   fecha com o período). O arquivo fica
//     [PRE_S = cópia do fim do corpo] [corpo] [POS_S = cópia do começo do corpo]
//   loopStart = PRE_S e loopEnd = PRE_S + período (múltiplo exato de uma amostra). É periódico na
//   amostra: um AudioBufferSourceNode faz o loop exato; o <audio> (que não tem loopStart) troca
//   para uma segunda cópia alinhada dentro das margens (src/game/musica.js).
//   Nenhuma música do jogo tem introdução (o loop começa na primeira nota). Se um .mid tiver
//   notas ANTES do ponto de loop, o script para com erro: a introdução precisaria de outro
//   esquema de arquivo.
//
// Volume: todas na mesma sonoridade (LUFS integrado, ITU-R BS.1770), a mediana das músicas de
// arena (as mesmas referências de normalizarMidis.mjs, que já soavam iguais no jogo), e um
// limitador de pico em LIMITE_DB (o king.mid batia em 0 dBFS e estourava).
//
// Idempotente: musicas.json guarda a chave de cada faixa (hash do .mid, do soundfont, dos
// parâmetros e do alvo de volume). Os arquivos levam o hash do conteúdo no
// nome (cache eterno no navegador); os antigos são apagados.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import os from 'node:os'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const FONTE = path.join(RAIZ, 'assets-fonte/musicas')
const SOUNDFONT = path.join(RAIZ, 'assets-fonte/soundfont/soundfont.sf3')
const SAIDA = path.join(RAIZ, 'public/assets/musicas/render')
const MANIFESTO = path.join(SAIDA, 'musicas.json')

const VERSAO = 1 // mude para forçar tudo de novo quando o esquema do arquivo mudar
const TAXA = 48000
const BLOCO = 128 // o sequenciador anda em blocos de 128 amostras (como no AudioWorklet)
const PRE_S = 1.5 // margem antes do loopStart (cópia do fim do loop)
const POS_S = 2.5 // margem depois do loopEnd (cópia do começo do loop)
const LIMITE_DB = -2 // teto de pico (amostra) depois do volume: o AAC passa até ~1,6 dB disso ao codificar
const LOOKAHEAD_S = 0.003
const SOLTURA_S = 0.08
const FUNDE_S = 0.5 // fusão do começo do corpo com a continuação do fim (ver sintetizar)
const OPUS = '64k'
const AAC = '96k'
// as músicas de arena que já soavam iguais no jogo (normalizarMidis.mjs): a mediana delas é o alvo
const REFERENCIAS = ['pvp', 'arena_jardim', 'arena_informatica', 'arena_palco', 'arena_templo', 'arena_coliseu']
// ajuste fino por música, em dB, depois da normalização (ex.: { tutorial: -6 } deixa a caixinha de
// música 6 dB abaixo das outras). Vazio: todas na mesma sonoridade.
const AJUSTE_DB = {}
const PARAMETROS = { AJUSTE_DB, VERSAO, TAXA, BLOCO, PRE_S, POS_S, LIMITE_DB, LOOKAHEAD_S, SOLTURA_S, FUNDE_S, OPUS, AAC }

const sha = (dados) => crypto.createHash('sha256').update(dados).digest('hex')
const arredonda = (x, casas = 6) => Math.round(x * 10 ** casas) / 10 ** casas

// ---------------------------------------------------------------- trabalhador: sintetiza
if (!isMainThread) {
  const { BasicMIDI, SoundBankLoader, SpessaSynthProcessor, SpessaSynthSequencer } = await import('spessasynth_core')
  const banco = SoundBankLoader.fromArrayBuffer(new Uint8Array(fs.readFileSync(workerData.soundfont)).buffer)
  parentPort.on('message', async ({ nome, arquivo }) => {
    try {
      parentPort.postMessage(await sintetizar(nome, arquivo), [])
    } catch (erro) {
      parentPort.postMessage({ nome, erro: String(erro?.stack ?? erro) })
    }
  })

  async function sintetizar(nome, arquivo) {
    const midi = BasicMIDI.fromArrayBuffer(new Uint8Array(fs.readFileSync(arquivo)).buffer)
    // introdução de verdade (notas antes do ponto de loop) não cabe neste esquema
    if (midi.loop.start > midi.firstNoteOn) throw new Error(`${nome}: tem introdução (notas antes do loop, tick ${midi.firstNoteOn} < ${midi.loop.start})`)
    // o mesmo sintetizador do jogo, com o padrão de vozes do AudioWorklet (350, sem alocar mais)
    const synth = new SpessaSynthProcessor(TAXA, { eventsEnabled: false })
    synth.soundBankManager.addSoundBank(banco, 'main')
    await synth.processorInitialized
    const seq = new SpessaSynthSequencer(synth)
    seq.loadNewSongList([midi])
    seq.loopCount = Infinity
    seq.play()
    const margem = Math.ceil(POS_S * TAXA)
    const maximo = Math.ceil((midi.duration * 2 + POS_S + 30) * TAXA)
    const L = new Float32Array(maximo + BLOCO)
    const R = new Float32Array(maximo + BLOCO)
    const voltas = [] // amostra onde cada volta (a partir da 2ª) começa
    let anterior = 0
    let fim = maximo
    for (let feito = 0; feito < fim; feito += BLOCO) {
      seq.processTick()
      const t = seq.currentTime
      if (t < anterior - 0.5) {
        voltas.push(feito)
        if (voltas.length === 2) fim = Math.min(maximo, feito + margem)
      }
      anterior = t
      synth.process(L, R, feito, BLOCO)
    }
    if (voltas.length < 2) throw new Error(`${nome}: o sequenciador não deu duas voltas`)
    const [v1, v2] = voltas
    const periodo = v2 - v1
    const pre = Math.ceil(PRE_S * TAXA)
    const fade = Math.min(Math.round(FUNDE_S * TAXA), margem, periodo >> 2)
    // o corpo do loop é a 2ª volta; o começo dela vira, aos poucos, a continuação de verdade do
    // fim (o começo da 3ª), para o salto do loopEnd ao loopStart não ter degrau. As voltas não
    // são idênticas na amostra (o LFO do chorus não fecha com o período), então sem isso a
    // emenda teria um estalo.
    let erro = 0
    let pico = 0
    for (let i = 0; i < margem; i++) {
      erro = Math.max(erro, Math.abs(L[v2 + i] - L[v1 + i]), Math.abs(R[v2 + i] - R[v1 + i]))
      pico = Math.max(pico, Math.abs(L[v1 + i]), Math.abs(R[v1 + i]))
    }
    const n = pre + periodo + margem
    const l = new Float32Array(n)
    const r = new Float32Array(n)
    l.set(L.subarray(v1, v2), pre)
    r.set(R.subarray(v1, v2), pre)
    for (let i = 0; i < fade; i++) {
      const w = i / fade
      l[pre + i] = (1 - w) * L[v2 + i] + w * L[v1 + i]
      r[pre + i] = (1 - w) * R[v2 + i] + w * R[v1 + i]
    }
    periodizar(l, r, pre, periodo, margem)
    return {
      nome,
      periodo,
      pre,
      margem,
      l,
      r,
      // diferença entre o começo de duas voltas seguidas (o que a fusão esconde), em dB do pico
      variacaoDb: 20 * Math.log10((erro + 1e-12) / (pico + 1e-12)),
    }
  }
} else {
  await principal()
}

// As margens são cópias exatas do corpo: antes do loopStart, o fim dele; depois do loopEnd, o
// começo. Assim o arquivo é periódico na amostra e qualquer ponto da margem serve para emendar.
function periodizar(l, r, pre, periodo, margem) {
  l.copyWithin(0, periodo, pre + periodo)
  r.copyWithin(0, periodo, pre + periodo)
  l.copyWithin(pre + periodo, pre, pre + margem)
  r.copyWithin(pre + periodo, pre, pre + margem)
}

// ---------------------------------------------------------------- áudio: volume e limitador
// Sonoridade integrada (ITU-R BS.1770-4, filtro K a 48 kHz, blocos de 400 ms, portas -70 / -10)
function lufs(l, r, ini = 0, fim = l.length) {
  // pré-filtro (prateleira) + RLB (passa-altas), dois biquads em forma direta I
  const biquad = (x, [b0, b1, b2], [a1, a2]) => {
    const y = new Float32Array(x.length)
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0
    for (let i = 0; i < x.length; i++) {
      const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1
      x1 = x[i]
      y2 = y1
      y1 = v
      y[i] = v
    }
    return y
  }
  const k = (x) => biquad(biquad(x.subarray(ini, fim), [1.53512485958697, -2.69169618940638, 1.19839281085285], [-1.69065929318241, 0.73248077421585]), [1, -2, 1], [-1.99004745483398, 0.99007225036621])
  const kl = k(l)
  const kr = k(r)
  const bloco = Math.round(0.4 * TAXA)
  const passo = Math.round(0.1 * TAXA)
  const blocos = []
  for (let i = 0; i + bloco <= kl.length; i += passo) {
    let s = 0
    for (let j = i; j < i + bloco; j++) s += kl[j] * kl[j] + kr[j] * kr[j]
    blocos.push(s / bloco)
  }
  const sonor = (z) => -0.691 + 10 * Math.log10(z + 1e-15)
  const acima = blocos.filter((z) => sonor(z) > -70)
  if (!acima.length) return -70
  const media = (v) => v.reduce((a, b) => a + b, 0) / v.length
  const relativo = sonor(media(acima)) - 10
  const finais = acima.filter((z) => sonor(z) > relativo)
  return sonor(media(finais.length ? finais : acima))
}

// Ganho fixo + limitador de pico com antecipação (o ganho nunca deixa uma amostra passar do teto)
function aplicarVolume(l, r, ganhoDb) {
  const g = 10 ** (ganhoDb / 20)
  const teto = 10 ** (LIMITE_DB / 20)
  const n = l.length
  const alvo = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(l[i]), Math.abs(r[i])) * g
    alvo[i] = p > teto ? teto / p : 1
  }
  // mínimo da janela [i, i + A] (fila monotônica) e média móvel de A amostras: a média de
  // mínimos que cobrem i nunca passa de alvo[i]
  const A = Math.max(1, Math.round(LOOKAHEAD_S * TAXA))
  const minimo = new Float32Array(n)
  const fila = new Int32Array(n)
  let cabeca = 0
  let cauda = 0
  for (let i = n - 1; i >= 0; i--) {
    while (cauda > cabeca && alvo[fila[cauda - 1]] >= alvo[i]) cauda--
    fila[cauda++] = i
    while (fila[cabeca] > i + A) cabeca++
    minimo[i] = alvo[fila[cabeca]]
  }
  const alfa = 1 - Math.exp(-1 / (SOLTURA_S * TAXA))
  let soma = A // as A amostras "antes do começo" valem 1
  let atual = 1
  let picoFinal = 0
  let menor = 1
  for (let i = 0; i < n; i++) {
    soma += minimo[i] - (i >= A ? minimo[i - A] : 1)
    const media = Math.min(1, soma / A)
    atual = Math.min(media, atual + (1 - atual) * alfa)
    menor = Math.min(menor, atual)
    const ganho = g * atual
    l[i] *= ganho
    r[i] *= ganho
    picoFinal = Math.max(picoFinal, Math.abs(l[i]), Math.abs(r[i]))
  }
  return { picoDb: 20 * Math.log10(picoFinal + 1e-12), reducaoDb: 20 * Math.log10(menor + 1e-12) }
}

// ---------------------------------------------------------------- ffmpeg
function acharFfmpeg() {
  const candidatos = [process.env.FFMPEG, 'ffmpeg']
  try {
    candidatos.push(createRequire(import.meta.url)('ffmpeg-static')) // opcional: não está no package.json
  } catch {
    /* sem o pacote */
  }
  for (const c of candidatos.filter(Boolean)) {
    const r = spawnSync(c, ['-hide_banner', '-encoders'], { encoding: 'utf8' })
    if (r.status === 0 && r.stdout.includes('libopus')) return { bin: c, versao: spawnSync(c, ['-version'], { encoding: 'utf8' }).stdout.split('\n')[0] }
  }
  throw new Error('preciso de um ffmpeg com libopus: instale (apt install ffmpeg / brew install ffmpeg), passe FFMPEG=/caminho ou `npm i -D ffmpeg-static`')
}

function intercalar(l, r) {
  const s = new Float32Array(l.length * 2)
  for (let i = 0; i < l.length; i++) {
    s[2 * i] = l[i]
    s[2 * i + 1] = r[i]
  }
  return Buffer.from(s.buffer)
}

function codificar(ffmpeg, pcm, destino, formato) {
  const codec = formato === 'webm' ? ['-c:a', 'libopus', '-b:a', OPUS, '-vbr', 'on', '-application', 'audio', '-f', 'webm'] : ['-c:a', 'aac', '-b:a', AAC, '-movflags', '+faststart', '-f', 'mp4']
  const args = ['-hide_banner', '-v', 'error', '-y', '-f', 'f32le', '-ar', String(TAXA), '-ac', '2', '-i', 'pipe:0', ...codec, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', destino]
  return new Promise((ok, falha) => {
    const p = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'] })
    let erro = ''
    p.stderr.on('data', (d) => (erro += d))
    p.on('close', (c) => (c === 0 ? ok() : falha(new Error(`ffmpeg ${formato}: ${erro}`))))
    p.stdin.on('error', () => {})
    p.stdin.end(pcm)
  })
}

function decodificar(ffmpeg, arquivo) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-v', 'error', '-i', arquivo, '-f', 'f32le', '-ar', String(TAXA), '-ac', '2', 'pipe:1'], { maxBuffer: 1 << 30 })
  if (r.status !== 0) throw new Error(`ffmpeg decodificando ${arquivo}: ${r.stderr}`)
  const s = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength / 4)
  const n = s.length / 2
  const l = new Float32Array(n)
  const rr = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    l[i] = s[2 * i]
    rr[i] = s[2 * i + 1]
  }
  return { l, r: rr }
}

function wav(l, r) {
  const n = l.length
  const b = Buffer.alloc(44 + n * 4)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 4, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(2, 22)
  b.writeUInt32LE(TAXA, 24)
  b.writeUInt32LE(TAXA * 4, 28)
  b.writeUInt16LE(4, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(l[i] * 32767))), 44 + 4 * i)
    b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(r[i] * 32767))), 46 + 4 * i)
  }
  return b
}

// ---------------------------------------------------------------- verificação
// Decodifica cada arquivo e mede: pico, duração e a emenda do loop (fim do loop colado no
// começo, contra a continuação de verdade que está depois do loopEnd). "salto" é o degrau extra
// que a emenda cria entre as duas amostras do salto, dividido pelo maior degrau normal da música
// em ±100 ms: abaixo de 1 = sem estalo (a emenda mexe menos que a própria música). O pico do AAC passa do teto do
// limitador (o codificador "estoura" até ~2,5 dB): não corta no jogo, que é ponto flutuante até o
// compressor da música, mas o teste aceita até +1 dBFS no .m4a.
// o degrau no salto do loop (fim -> loopStart) menos o da continuação de verdade, contra o maior
// degrau normal da música em ±100 ms
function saltoDaEmenda(l, r, ini, fim) {
  let normal = 0
  for (let i = fim - 4800; i < fim + 4800; i++) normal = Math.max(normal, Math.abs(l[i] - l[i - 1]), Math.abs(r[i] - r[i - 1]))
  const extra = Math.max(Math.abs(l[ini] - l[fim - 1] - (l[fim] - l[fim - 1])), Math.abs(r[ini] - r[fim - 1] - (r[fim] - r[fim - 1])))
  return extra / (normal + 1e-9)
}

function verificar(ffmpeg, manifesto, pastaWav) {
  const linhas = []
  for (const [nome, f] of Object.entries(manifesto.faixas)) {
    for (const formato of Object.keys(f.formatos)) {
      const { l, r } = decodificar(ffmpeg, path.join(SAIDA, f.formatos[formato]))
      const ini = Math.round(f.loopStart * TAXA)
      const fim = Math.round(f.loopEnd * TAXA)
      const cru = saltoDaEmenda(l, r, ini, fim)
      // o que o jogo toca: o AudioBuffer passa por costurarBuffer (src/game/musica.js), que funde
      // os primeiros 10 ms do loop a partir da continuação decodificada
      const nCost = Math.round(0.01 * TAXA)
      for (const d of [l, r]) for (let i = 0; i < nCost; i++) d[ini + i] = (1 - i / nCost) * d[fim + i] + (i / nCost) * d[ini + i]
      const w = Math.round(0.25 * TAXA)
      let pico = 0
      for (let i = 0; i < l.length; i++) pico = Math.max(pico, Math.abs(l[i]), Math.abs(r[i]))
      const emendaL = new Float32Array(2 * w)
      const emendaR = new Float32Array(2 * w)
      let erro = 0
      let ref = 0
      for (let i = 0; i < 2 * w; i++) {
        const j = i < w ? fim - w + i : ini + (i - w)
        emendaL[i] = l[j]
        emendaR[i] = r[j]
        erro = Math.max(erro, Math.abs(l[j] - l[fim - w + i]), Math.abs(r[j] - r[fim - w + i]))
        ref = Math.max(ref, Math.abs(l[fim - w + i]), Math.abs(r[fim - w + i]))
      }
      const salto = saltoDaEmenda(l, r, ini, fim)
      if (pastaWav) fs.writeFileSync(path.join(pastaWav, `${nome}.${formato}.emenda.wav`), wav(emendaL, emendaR))
      linhas.push({ nome, formato, duracao: arredonda(l.length / TAXA, 3), esperado: f.duracao, picoDb: arredonda(20 * Math.log10(pico), 2), emendaDb: arredonda(20 * Math.log10((erro + 1e-12) / (ref + 1e-12)), 1), saltoCru: arredonda(cru, 2), salto: arredonda(salto, 2) })
    }
  }
  console.table(linhas)
  const ruins = linhas.filter((x) => x.salto > 1 || x.picoDb > (x.formato === 'm4a' ? 1 : -0.3))
  if (ruins.length) {
    console.error('emenda ou pico fora do esperado:', ruins.map((x) => `${x.nome}.${x.formato}`).join(', '))
    process.exitCode = 1
  }
}

// ---------------------------------------------------------------- principal
async function principal() {
  const args = process.argv.slice(2)
  const ffmpeg = acharFfmpeg()
  fs.mkdirSync(SAIDA, { recursive: true })
  const anterior = fs.existsSync(MANIFESTO) ? JSON.parse(fs.readFileSync(MANIFESTO, 'utf8')) : { faixas: {} }
  if (args.includes('--verificar')) {
    const wavArg = args.find((a) => a.startsWith('--wav='))?.slice(6)
    if (wavArg) fs.mkdirSync(wavArg, { recursive: true })
    verificar(ffmpeg.bin, anterior, wavArg)
    return
  }
  const tudo = args.includes('--tudo')
  const escolhidas = args.filter((a) => !a.startsWith('--'))

  const nomes = fs
    .readdirSync(FONTE)
    .filter((f) => f.endsWith('.mid'))
    .map((f) => f.slice(0, -4))
    .sort()
  const hashFonte = sha(fs.readFileSync(SOUNDFONT))
  const base = Object.fromEntries(nomes.map((n) => [n, sha(JSON.stringify({ midi: sha(fs.readFileSync(path.join(FONTE, `${n}.mid`))), soundfont: hashFonte, PARAMETROS }))]))
  const valida = (n) => {
    const f = anterior.faixas?.[n]
    return !tudo && f && f.base === base[n] && Object.values(f.formatos).every((a) => fs.existsSync(path.join(SAIDA, a)))
  }

  // pool de trabalhadores (um sintetizador por núcleo)
  const fila = []
  const livres = []
  const espera = new Map()
  const nTrab = Math.max(1, Math.min(os.cpus().length, 4))
  const trabalhadores = Array.from({ length: nTrab }, () => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { soundfont: SOUNDFONT } })
    w.on('message', (m) => {
      const fim = espera.get(m.nome)
      espera.delete(m.nome)
      livres.push(w)
      despachar()
      if (m.erro) fim.falha(new Error(m.erro))
      else fim.ok(m)
    })
    livres.push(w)
    return w
  })
  function despachar() {
    while (livres.length && fila.length) {
      const { nome, ok, falha } = fila.shift()
      espera.set(nome, { ok, falha })
      livres.shift().postMessage({ nome, arquivo: path.join(FONTE, `${nome}.mid`) })
    }
  }
  const sintetizar = (nome) =>
    new Promise((ok, falha) => {
      fila.push({ nome, ok, falha })
      despachar()
    })

  // 1) as referências definem o alvo de volume (renderiza só se mudaram)
  const brutos = new Map()
  const medidas = {}
  await Promise.all(
    REFERENCIAS.filter((n) => nomes.includes(n)).map(async (n) => {
      if (valida(n)) medidas[n] = anterior.faixas[n].lufs
      else {
        const s = await sintetizar(n)
        brutos.set(n, s)
        medidas[n] = lufs(s.l, s.r, s.pre, s.pre + s.periodo)
      }
    }),
  )
  const refs = Object.values(medidas).sort((a, b) => a - b)
  const alvo = arredonda(refs[Math.floor(refs.length / 2)], 2)
  console.log(`alvo (mediana das arenas): ${alvo} LUFS  [${refs.map((x) => x.toFixed(1)).join(', ')}]`)

  const precisa = nomes.filter((n) => !(valida(n) && anterior.faixas[n].alvo === alvo) && (!escolhidas.length || escolhidas.includes(n) || anterior.alvo !== alvo || !anterior.faixas?.[n]))
  const faixas = {}
  for (const n of nomes) if (!precisa.includes(n) && anterior.faixas?.[n]) faixas[n] = anterior.faixas[n]
  console.log(`${precisa.length} de ${nomes.length} para renderizar`)

  const inicio = Date.now()
  await Promise.all(
    precisa.map(async (n) => {
      const s = brutos.get(n) ?? (await sintetizar(n))
      brutos.delete(n)
      const medida = medidas[n] ?? lufs(s.l, s.r, s.pre, s.pre + s.periodo)
      const ganhoDb = alvo - medida + (AJUSTE_DB[n] ?? 0)
      const { picoDb, reducaoDb } = aplicarVolume(s.l, s.r, ganhoDb)
      periodizar(s.l, s.r, s.pre, s.periodo, s.margem) // o limitador mexe um tiquinho nas margens
      const pcm = intercalar(s.l, s.r)
      const temp = {}
      for (const formato of ['webm', 'm4a']) {
        temp[formato] = path.join(SAIDA, `.${n}.tmp.${formato}`)
        await codificar(ffmpeg.bin, pcm, temp[formato], formato)
      }
      const formatos = {}
      const hashes = []
      for (const formato of ['webm', 'm4a']) {
        const h = sha(fs.readFileSync(temp[formato])).slice(0, 12)
        hashes.push(h)
        formatos[formato] = `${n}.${h}.${formato}`
        fs.renameSync(temp[formato], path.join(SAIDA, formatos[formato]))
      }
      faixas[n] = {
        loopStart: arredonda(s.pre / TAXA),
        loopEnd: arredonda((s.pre + s.periodo) / TAXA),
        duracao: arredonda(s.l.length / TAXA),
        formatos,
        hash: sha(hashes.join('')).slice(0, 12),
        base: base[n],
        alvo,
        lufs: arredonda(medida, 2),
        ganhoDb: arredonda(ganhoDb, 2),
        picoDb: arredonda(picoDb, 2),
        limitadorDb: arredonda(reducaoDb, 2),
        variacaoDb: arredonda(s.variacaoDb, 1),
      }
      console.log(`${n.padEnd(20)} loop ${(s.periodo / TAXA).toFixed(2)} s  ${medida.toFixed(1)} LUFS ${ganhoDb >= 0 ? '+' : ''}${ganhoDb.toFixed(1)} dB  pico ${picoDb.toFixed(1)} dBFS  limitador ${reducaoDb.toFixed(1)} dB`)
    }),
  )
  for (const w of trabalhadores) w.terminate()

  // manifesto estável (ordem alfabética) e limpeza dos arquivos que ninguém usa mais
  const ordenado = Object.fromEntries(Object.keys(faixas).sort().map((n) => [n, faixas[n]]))
  const manifesto = { versao: VERSAO, taxa: TAXA, alvo, ffmpeg: anterior.ffmpeg && !precisa.length ? anterior.ffmpeg : ffmpeg.versao, faixas: ordenado }
  fs.writeFileSync(MANIFESTO, JSON.stringify(manifesto, null, 2) + '\n')
  const usados = new Set(Object.values(ordenado).flatMap((f) => Object.values(f.formatos)))
  for (const a of fs.readdirSync(SAIDA)) if (a !== 'musicas.json' && !usados.has(a)) fs.rmSync(path.join(SAIDA, a))

  const tamanho = { webm: 0, m4a: 0 }
  for (const f of Object.values(ordenado)) for (const [formato, a] of Object.entries(f.formatos)) tamanho[formato] += fs.statSync(path.join(SAIDA, a)).size
  const mb = (b) => (b / 1048576).toFixed(1)
  console.log(`pronto em ${((Date.now() - inicio) / 1000).toFixed(0)} s. Total: webm ${mb(tamanho.webm)} MB, m4a ${mb(tamanho.m4a)} MB, juntos ${mb(tamanho.webm + tamanho.m4a)} MB`)
}
