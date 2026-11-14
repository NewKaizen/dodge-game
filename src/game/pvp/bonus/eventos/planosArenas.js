// Planos (lógica pura, sem Phaser) dos bônus das arenas ESTAÇÃO ESPACIAL, CHINATOWN e
// CIDADE GRANDE: METEOROS, AIRLOCK, DRAGÃO, LANTERNAS, TRÂNSITO e OBRA.
//
// Cada evento sorteia o plano inteiro da rodada a partir do `rng` da rodada (a semente
// vem de `${semente}:efeito:${rodada}`, igual nos dois PCs em rede) e usa o MESMO plano
// nas duas caixas: justo para os dois e sem nada para sincronizar. As posições saem em
// FRAÇÕES da caixa (0..1) e cada caixa converte para os próprios pixels.
//
// Garantias (conferidas em __tests__/bonusArenasNovas.test.js):
//   - determinismo: mesma semente, mesmo plano;
//   - TELEGRAFO: todo perigo avisa por pelo menos ATAQUE.telegrafoMs antes de valer;
//   - ROTA DE FUGA: o que está em cena ao mesmo tempo sempre deixa um corredor livre de
//     pelo menos LACUNA_MINIMA px (o mesmo critério de attacks/validacao.js).
//
// `sorte` é uma função () => 0..1. `ref` é { largura, altura } da caixa (px) para as contas
// de espaço livre (a caixa normal tem 220x170).

import { LACUNA_MINIMA, lacunasLivres } from '../../../attacks/validacao.js'

export const REF_CAIXA = { largura: 220, altura: 170 }

const entre = (sorte, a, b) => a + (b - a) * sorte()
const sortearDe = (sorte, lista) => lista[Math.min(lista.length - 1, Math.floor(sorte() * lista.length))]
// a maior lacuna livre em [0, total] depois de tirar as faixas ocupadas
export const maiorLacuna = (total, ocupados) => Math.max(0, ...lacunasLivres(0, total, ocupados).map(([a, b]) => b - a))

// ---------- METEOROS (Estação Espacial) ----------
// Pedras do espaço cruzam a caixa na diagonal suave, de um lado a outro. A rota de cada
// uma aparece antes como um risco vermelho (AVISO_METEORO_MS). Uma onda tem 1 a 3 pedras
// e a soma das faixas de altura que elas varrem sempre deixa um corredor livre.
export const METEOROS = { primeiraMs: 900, periodoMs: { min: 1700, max: 2300 }, avisoMs: 950, velocidade: 270, inclinacaoMax: 0.3, ondas: 14 }

export function planoMeteoros(sorte, ref = REF_CAIXA, { ondas = METEOROS.ondas } = {}) {
  const lista = []
  let em = METEOROS.primeiraMs
  for (let k = 0; k < ondas; k++) {
    const quantas = sorte() < 0.4 ? 2 : sorte() < 0.2 ? 3 : 1
    const rochas = []
    for (let tentativa = 0; tentativa < 60 && rochas.length < quantas; tentativa++) {
      const raio = Math.round(entre(sorte, 11, 17))
      const dir = sorte() < 0.5 ? 1 : -1
      const inclinacao = entre(sorte, -METEOROS.inclinacaoMax, METEOROS.inclinacaoMax) // dy/dx
      const y0 = entre(sorte, 0.08, 0.92) * ref.altura // altura na borda por onde entra
      const y1 = y0 + inclinacao * (ref.largura + 2 * raio) // altura na borda por onde sai
      const faixa = [Math.min(y0, y1) - raio - 6, Math.max(y0, y1) + raio + 6]
      const ocupados = [...rochas.map((r) => r.faixa), faixa]
      if (maiorLacuna(ref.altura, ocupados) < LACUNA_MINIMA + 16) continue
      rochas.push({ dir, raio, inclinacao, fy: y0 / ref.altura, faixa })
    }
    if (!rochas.length) continue
    lista.push({ em, rochas: rochas.map(({ faixa, ...r }) => ({ ...r, faixa })) })
    em += entre(sorte, METEOROS.periodoMs.min, METEOROS.periodoMs.max)
  }
  return lista
}

// ---------- AIRLOCK (Estação Espacial) ----------
// A comporta de um lado de cada caixa abre: luz vermelha girando e sirene (aviso), depois
// a descompressão puxa tudo (inclusive o coração) para aquele lado, e fecha. Nunca duas
// vezes seguidas o mesmo lado. Não dá dano: é só o puxão contra os ataques.
export const AIRLOCK = { primeiraMs: 800, avisoMs: 1000, sugaMs: { min: 1300, max: 1800 }, pausaMs: { min: 900, max: 1400 }, forca: 52, aberturas: 10 }
export const LADOS = ['esquerda', 'direita', 'cima', 'baixo']

export function planoAirlock(sorte, { aberturas = AIRLOCK.aberturas } = {}) {
  const lista = []
  let em = AIRLOCK.primeiraMs
  let ultimo = null
  for (let k = 0; k < aberturas; k++) {
    const lado = sortearDe(sorte, LADOS.filter((l) => l !== ultimo))
    const suga = entre(sorte, AIRLOCK.sugaMs.min, AIRLOCK.sugaMs.max)
    lista.push({ em, lado, avisoMs: AIRLOCK.avisoMs, sugaMs: suga })
    ultimo = lado
    em += AIRLOCK.avisoMs + suga + entre(sorte, AIRLOCK.pausaMs.min, AIRLOCK.pausaMs.max)
  }
  return lista
}

// ---------- DRAGÃO (Chinatown) ----------
// O dragão da festa serpenteia pela caixa de um lado ao outro, o corpo seguindo uma onda
// senoidal (o risco dourado no chão mostra o caminho antes). O corpo todo é perigoso.
// A onda cabe numa faixa de altura que sempre deixa um corredor livre acima ou abaixo.
export const DRAGAO = { primeiraMs: 1000, avisoMs: 1100, periodoMs: { min: 3600, max: 4400 }, velocidade: 165, segmentos: 9, espaco: 21, raioCorpo: 10, ondas: 8 }

export function planoDragao(sorte, ref = REF_CAIXA, { ondas = DRAGAO.ondas } = {}) {
  const lista = []
  let em = DRAGAO.primeiraMs
  for (let k = 0; k < ondas; k++) {
    let plano = null
    for (let tentativa = 0; tentativa < 40 && !plano; tentativa++) {
      const amp = entre(sorte, 22, 46)
      const centro = entre(sorte, 0.25, 0.75) * ref.altura
      const faixa = [centro - amp - DRAGAO.raioCorpo - 4, centro + amp + DRAGAO.raioCorpo + 4]
      if (maiorLacuna(ref.altura, [faixa]) < LACUNA_MINIMA + 14) continue
      plano = { dir: sorte() < 0.5 ? 1 : -1, fy: centro / ref.altura, amp, comprimento: entre(sorte, 120, 170), fase: entre(sorte, 0, Math.PI * 2), faixa }
    }
    if (!plano) continue
    lista.push({ em, ...plano })
    em += entre(sorte, DRAGAO.periodoMs.min, DRAGAO.periodoMs.max)
  }
  return lista
}

// Onda do caminho do dragão: altura (px, relativa ao topo da caixa) na coluna `x` (px, a
// partir da borda esquerda da caixa)
export const caminhoDoDragao = (p, ref, x) => p.fy * ref.altura + Math.sin((x / p.comprimento) * Math.PI * 2 + p.fase) * p.amp

// ---------- LANTERNAS (Chinatown) ----------
// Lanternas de festival SOLTAS sobem devagar balançando. Cada uma nasce acesa-fraquinha no
// chão da caixa (aviso piscando, inofensiva) e depois sobe com o brilho forte: aí machuca.
// Uma onda tem 2 a 4 lanternas e sempre sobra uma faixa livre na largura.
export const LANTERNAS = { primeiraMs: 800, avisoMs: 850, periodoMs: { min: 2300, max: 2900 }, velocidade: 82, balanco: 11, ondas: 12 }

export function planoLanternas(sorte, ref = REF_CAIXA, { ondas = LANTERNAS.ondas } = {}) {
  const lista = []
  let em = LANTERNAS.primeiraMs
  for (let k = 0; k < ondas; k++) {
    const quantas = 2 + Math.floor(sorte() * 3)
    const itens = []
    for (let tentativa = 0; tentativa < 80 && itens.length < quantas; tentativa++) {
      const raio = Math.round(entre(sorte, 11, 15))
      const folga = raio + LANTERNAS.balanco + 2
      const x = entre(sorte, folga, ref.largura - folga)
      const faixa = [x - folga, x + folga]
      if (maiorLacuna(ref.largura, [...itens.map((i) => i.faixa), faixa]) < LACUNA_MINIMA + 12) continue
      itens.push({ fx: x / ref.largura, raio, fase: entre(sorte, 0, Math.PI * 2), faixa })
    }
    lista.push({ em, lanternas: itens })
    em += entre(sorte, LANTERNAS.periodoMs.min, LANTERNAS.periodoMs.max)
  }
  return lista
}

// ---------- TRÂNSITO (Cidade Grande) ----------
// A caixa vira uma avenida de 3 faixas. O semáforo no canto vai a amarelo (aviso, a faixa
// que vem carro fica vermelha) e depois a verde: os carros disparam. Carro, ônibus (longo e
// lento) e moto (rápida). No máximo FAIXAS - 1 faixas por onda e uma onda por vez.
export const FAIXAS_TRANSITO = 3
export const VEICULOS = {
  carro: { velocidade: 380, comprimento: 54, alturaFrac: 0.62 },
  onibus: { velocidade: 250, comprimento: 104, alturaFrac: 0.7 },
  moto: { velocidade: 560, comprimento: 34, alturaFrac: 0.46 },
}
export const TRANSITO = { primeiraMs: 800, avisoMs: 950, folgaMs: 450, ondas: 12 }

// tempo (ms) que o veículo leva da entrada até sair da caixa de largura `largura`
export const travessiaDoVeiculo = (tipo, largura) => ((largura + VEICULOS[tipo].comprimento + 20) / VEICULOS[tipo].velocidade) * 1000

export function planoTransito(sorte, ref = REF_CAIXA, { ondas = TRANSITO.ondas } = {}) {
  const lista = []
  let em = TRANSITO.primeiraMs
  let ultima = -1
  for (let k = 0; k < ondas; k++) {
    const quantas = sorte() < 0.45 ? 2 : 1
    const livres = [...Array(FAIXAS_TRANSITO).keys()].filter((f) => f !== ultima)
    const faixas = []
    for (let i = 0; i < quantas && livres.length; i++) {
      const f = livres.splice(Math.min(livres.length - 1, Math.floor(sorte() * livres.length)), 1)[0]
      const tipo = sorte() < 0.2 ? 'onibus' : sorte() < 0.3 ? 'moto' : 'carro'
      faixas.push({ faixa: f, dir: f % 2 === 0 ? 1 : -1, tipo })
      ultima = f
    }
    const travessia = Math.max(...faixas.map((f) => travessiaDoVeiculo(f.tipo, ref.largura)))
    lista.push({ em, faixas })
    em += TRANSITO.avisoMs + travessia + TRANSITO.folgaMs
  }
  return lista
}

// ---------- OBRA (Cidade Grande) ----------
// O guindaste da obra balança uma viga de aço sobre a caixa; uma sombra listrada de
// amarelo e preto marca a coluna onde ela vai cair. A viga despenca e bate (a coluna toda
// machuca por um instante). Uma onda tem 1 a 3 vigas e sempre sobra um corredor livre.
export const OBRA = { primeiraMs: 900, avisoMs: 1000, periodoMs: { min: 1800, max: 2400 }, quedaMs: 170, batidaMs: 260, ondas: 14 }

export function planoObra(sorte, ref = REF_CAIXA, { ondas = OBRA.ondas } = {}) {
  const lista = []
  let em = OBRA.primeiraMs
  for (let k = 0; k < ondas; k++) {
    const quantas = sorte() < 0.35 ? 2 : sorte() < 0.2 ? 3 : 1
    const vigas = []
    for (let tentativa = 0; tentativa < 60 && vigas.length < quantas; tentativa++) {
      const largura = Math.round(entre(sorte, 30, 50))
      const x = entre(sorte, largura / 2, ref.largura - largura / 2)
      const faixa = [x - largura / 2 - 3, x + largura / 2 + 3]
      if (maiorLacuna(ref.largura, [...vigas.map((v) => v.faixa), faixa]) < LACUNA_MINIMA + 20) continue
      vigas.push({ fx: x / ref.largura, largura, faixa })
    }
    lista.push({ em, vigas })
    em += entre(sorte, OBRA.periodoMs.min, OBRA.periodoMs.max)
  }
  return lista
}
