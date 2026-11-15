// O DADO DO CAOS do Jevil (docs/coop-cartas.md "Jevil"): a lógica PURA (sem Phaser) da regra dele. No começo
// de toda rodada um dado gigante rola e a face que cair vira UMA regra daquela rodada, para todos. O resultado
// sai da semente (rngDaRegra: igual em todos os PCs), então a rodada de depois já é conhecida e aparece na prévia
// ("DADO DEPOIS"): a dupla se prepara. A regra em si (coop/jevilRegra.js) e o desenho (coop/jevilDadoCena.js) ficam
// em outros arquivos; aqui só moram as faces, os dados de cada fase, o sorteio e os números de cada efeito.
import { rngDaRegra } from './regraChefe.js'

// As faces. `titulo`: até 5 palavras (é o que aparece grande ao lado do dado); `texto`: a linha de baixo, que diz o
// que muda. `suave`: faces que o dado da 1ª fase e o do tenente podem sortear.
export const FACES = {
  sorte: { id: 'sorte', titulo: 'SORTE!', texto: 'um coração de graça no quadro', cor: 0x7dff9a, suave: true },
  gravidade: { id: 'gravidade', titulo: 'GRAVIDADE INVERTIDA', texto: 'os corações flutuam para cima', cor: 0x7fd8ff, suave: true },
  rapido: { id: 'rapido', titulo: 'RÁPIDO E LEVE', texto: 'balas mais rápidas, metade do dano', cor: 0xffd24c, suave: true },
  trocados: { id: 'trocados', titulo: 'CORAÇÕES TROCADOS', texto: 'de tempos em tempos vocês trocam de lugar', cor: 0xff7ad0 },
  espelhados: { id: 'espelhados', titulo: 'CONTROLES ESPELHADOS', texto: 'esquerda é direita, cima é baixo', cor: 0xff9a3a },
  umPorVez: { id: 'umPorVez', titulo: 'UM CORAÇÃO POR VEZ', texto: 'só um se mexe; o parado fica protegido', cor: 0xa6b4ff },
  inclinada: { id: 'inclinada', titulo: 'MESA INCLINADA', texto: 'o quadro balança e os corações escorregam', cor: 0xc89bff },
}

// Pares que não entram juntos no CHAOS CHAOS (os dois puxariam os corações ou os controles ao mesmo tempo)
export const CONFLITOS = [
  ['gravidade', 'inclinada'],
  ['espelhados', 'umPorVez'],
]

export const conflita = (a, b) => a === b || CONFLITOS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))

// Os números de cada efeito. `forca` (0..1] suaviza a versão do tenente (o dado pequeno que apresenta a regra).
export const AJUSTES = {
  sorte: { cura: 18, atrasoMs: 900 }, // o coração aparece depois que o ataque começou
  gravidade: { deriva: 0.34 }, // fração da velocidade do coração, para cima
  rapido: { velocidade: 1.45, dano: 0.5 },
  trocados: { primeiroMs: 2400, intervaloMs: 3400, avisoMs: 1000, gracaMs: 500 },
  espelhados: { velocidade: 0.92, densidade: 0.88 }, // o ataque aperta menos: os controles já pesam
  umPorVez: { trocaMs: 1500, avisoMs: 450, gracaMs: 400, densidade: 0.92 },
  inclinada: { graus: 6, periodoMs: 6500, deriva: 0.3 },
}

// ---------- os dados de cada fase ----------

// `dado`: as 6 faces do dado (repetir uma face a deixa mais provável); `dado2`: o segundo dado (CHAOS CHAOS)
export const DADOS_DO_JEVIL = [
  { dado: ['sorte', 'gravidade', 'rapido', 'sorte', 'gravidade', 'rapido'] }, // 1: só faces leves
  { dado: ['sorte', 'trocados', 'espelhados', 'umPorVez', 'inclinada', 'rapido'] }, // 2: as malucas
  { dado: ['trocados', 'espelhados', 'umPorVez', 'inclinada', 'rapido', 'sorte'], dado2: ['gravidade', 'rapido', 'sorte', 'trocados', 'inclinada', 'umPorVez'] }, // 3: CAOS CAOS, DOIS dados
  { dado: ['trocados', 'espelhados', 'umPorVez', 'inclinada', 'trocados', 'umPorVez'], dado2: ['inclinada', 'rapido', 'gravidade', 'trocados', 'sorte', 'espelhados'] }, // 4: dois dados, quase só malucas
]

// O Mestre de Picadeiro (tenente): um dado pequeno de 3 faces, todas gentis
export const DADOS_DO_TENENTE = [{ dado: ['sorte', 'gravidade', 'rapido'] }]

export const forcaDe = (fases, fase) => fases[Math.min(Math.max(0, fase), fases.length - 1)]

// ---------- o sorteio ----------

// A rolagem de uma rodada: [{ id, pips }] (1 dado, ou 2 no CHAOS CHAOS). Determinística: depende só da
// (semente, rodada, fase), então a prévia da rodada de depois (rolar com rodada + 1) sai igual à rolagem de verdade.
// Dois dados nunca repetem a face e nunca juntam um par de CONFLITOS.
export function rolarDado({ semente, rodada, fase = 0, fases = DADOS_DO_JEVIL }) {
  const f = forcaDe(fases, fase)
  const rng = rngDaRegra(semente, rodada, 'dado')
  const u1 = rng()
  const u2 = rng()
  const i1 = Math.min(f.dado.length - 1, Math.floor(u1 * f.dado.length))
  const primeiro = { id: f.dado[i1], pips: i1 + 1 }
  if (!f.dado2) return [primeiro]
  const candidatos = []
  f.dado2.forEach((id, i) => {
    if (!conflita(primeiro.id, id) && !candidatos.some((c) => c.id === id)) candidatos.push({ id, pips: i + 1 })
  })
  const segundo = candidatos[Math.min(candidatos.length - 1, Math.floor(u2 * candidatos.length))]
  return segundo ? [primeiro, segundo] : [primeiro]
}

// Quantas faces diferentes tem o dado da fase (para o cartão e os testes)
export const facesDaFase = (fases, fase) => {
  const f = forcaDe(fases, fase)
  return [...new Set([...f.dado, ...(f.dado2 ?? [])])]
}

// ---------- os efeitos (funções puras) ----------

// Quanto o ataque aperta ou alivia por causa das faces (multiplicadores sobre o ritmo e o dano da carta)
export function ajusteDoAtaque(faces, forca = 1) {
  let velocidade = 1
  let densidade = 1
  let dano = 1
  for (const id of faces) {
    if (id === 'rapido') {
      velocidade *= 1 + (AJUSTES.rapido.velocidade - 1) * forca
      dano *= 1 - (1 - AJUSTES.rapido.dano) * forca
    } else if (id === 'espelhados') {
      velocidade *= 1 - (1 - AJUSTES.espelhados.velocidade) * forca
      densidade *= 1 - (1 - AJUSTES.espelhados.densidade) * forca
    } else if (id === 'umPorVez') {
      densidade *= 1 - (1 - AJUSTES.umPorVez.densidade) * forca
    }
  }
  return { velocidade, densidade, dano }
}

// A deriva (px por frame) dos corações: gravidade (para cima) e mesa inclinada (de lado, com o ângulo).
// velocidade = px/s do coração; dt em ms; angulo = o ângulo da mesa agora, em radianos (positivo = pende para a direita)
export function derivaDosCoracoes(faces, { velocidade, dt, angulo = 0, forca = 1 }) {
  let dx = 0
  let dy = 0
  const passo = (velocidade * dt) / 1000
  if (faces.includes('gravidade')) dy -= passo * AJUSTES.gravidade.deriva * forca
  if (faces.includes('inclinada')) {
    const max = (AJUSTES.inclinada.graus * Math.PI) / 180
    dx += passo * AJUSTES.inclinada.deriva * forca * (angulo / max)
  }
  return { dx, dy }
}

// O ângulo da mesa inclinada (radianos) no tempo t (ms de ataque): vai e volta devagar; `fase` (0..1) vem da semente
export function anguloDaMesa(t, fase = 0, forca = 1) {
  const max = (AJUSTES.inclinada.graus * Math.PI) / 180 * forca
  return Math.sin((t / AJUSTES.inclinada.periodoMs + fase) * Math.PI * 2) * max
}

// Troca-troca: os instantes (ms de ataque) das trocas até `ate`
export function instantesDaTroca(ate = 20000) {
  const { primeiroMs, intervaloMs } = AJUSTES.trocados
  const lista = []
  for (let t = primeiroMs; t <= ate; t += intervaloMs) lista.push(t)
  return lista
}

// Para onde cada coração vai na troca: o de pé k vai ao lugar do k + 1 (em roda; com dois, eles se trocam).
// coracoes = [{ j, x, y }] (só os que estão no quadro); devolve [{ j, x, y }] (o destino de cada um)
export function destinosDaTroca(coracoes) {
  const lista = [...coracoes].sort((a, b) => a.j - b.j)
  if (lista.length < 2) return []
  return lista.map((c, k) => {
    const alvo = lista[(k + 1) % lista.length]
    return { j: c.j, x: alvo.x, y: alvo.y }
  })
}

// Um coração por vez: de quem é a vez no instante t (ms de ataque). `jogadores` = os j dos corações no quadro, em ordem.
// Devolve { j, restanteMs } (o que falta para a próxima troca); null se não sobrou ninguém
export function vezDoCoracao(jogadores, t) {
  if (!jogadores.length) return null
  const { trocaMs } = AJUSTES.umPorVez
  const k = Math.floor(t / trocaMs)
  return { j: jogadores[k % jogadores.length], restanteMs: trocaMs - (t - k * trocaMs) }
}

// Onde nasce o coração da SORTE: dentro do quadro, longe das bordas, num ponto sorteado pela rodada
export function pontoDaSorte(rng, limites) {
  return {
    x: limites.x + 34 + rng() * Math.max(0, limites.width - 68),
    y: limites.y + 30 + rng() * Math.max(0, limites.height * 0.62 - 30),
  }
}
