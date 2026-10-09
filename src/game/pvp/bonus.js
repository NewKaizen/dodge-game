// Bonus rounds do PvP: a cada BONUS.aCadaRodadas rodadas (3ª, 6ª, 9ª...) a
// rodada vira um evento caótico sorteado. Só caos, sem prêmio: ninguém ganha
// nada a mais por causa do evento (o dano continua valendo normalmente).
// Lógica pura (sem Phaser), testável em Node. O visual de cada evento fica em
// pvp/bonus/ (ver pvp/bonus/LEIA-ME.md).
//
//   ehRodadaBonus(estado.rodada)                    true na 3ª, 6ª, 9ª...
//   const ev = sortearEvento(rng, { anterior })    um de EVENTOS (não repete o anterior)
//   ev.cartas                                      como a rodada trata as cartas:
//     'normal'   escolha e resolução de sempre; o evento só bagunça a esquiva
//     'malucas'  escolha de sempre; na revelação cada carta vira outra
//                sorteada (transformarMalucas antes de resolverRodada e
//                desfazerMalucas depois: o baralho não muda de verdade)
//     'duelo'    a carta escolhida (o evento só é revelado DEPOIS da escolha)
//                vira a arma do duelo numa caixa só para os dois, sem gastar
//                energia (resolverDuelo)

import { CARTAS, PERSONAGENS_PVP, forca, ehSuper } from './cartas.js'
import { cartaNaMao, descartar, inteiro } from './baralho.js'

export const BONUS = { aCadaRodadas: 3 }

// id, nome (aviso grande), descricao (uma linha embaixo), cor (texto/brilho)
export const EVENTOS = [
  { id: 'explosoes', nome: 'CHUVA DE EXPLOSÕES', descricao: 'bombas caem do céu nas duas caixas!', cartas: 'normal', cor: 0xff7a1a },
  { id: 'festa', nome: 'MODO FESTA', descricao: 'luzes, confete e balões dançando!', cartas: 'normal', cor: 0xff4fd8 },
  { id: 'pontaCabeca', nome: 'MUNDO DE PONTA-CABEÇA', descricao: 'a tela inteira vira de cabeça pra baixo!', cartas: 'normal', cor: 0x7fd8ff },
  { id: 'malucas', nome: 'CARTAS MALUCAS', descricao: 'cada carta vira outra na hora de revelar!', cartas: 'malucas', cor: 0xc07dff },
  { id: 'duelo', nome: 'DUELO!', descricao: 'uma caixa só: a carta vira sua arma (A ataca)', cartas: 'duelo', cor: 0xff3048 },
  { id: 'apagao', nome: 'APAGÃO', descricao: 'as luzes caíram: só dá pra ver em volta do coração!', cartas: 'normal', cor: 0xffe040 },
  { id: 'gravidade', nome: 'GRAVIDADE MALUCA', descricao: 'a gravidade muda de lado o tempo todo!', cartas: 'normal', cor: 0x3cff6a },
  { id: 'trocado', nome: 'CORAÇÃO TROCADO', descricao: 'os corações trocam de caixa: desvie do SEU ataque!', cartas: 'normal', cor: 0xff8aa8 },
  { id: 'pcEscola', nome: 'PC DA ESCOLA', descricao: 'tela pixelada rodando a 10 FPS... e às vezes trava!', cartas: 'normal', cor: 0x9ab0c8 },
  { id: 'aquario', nome: 'AQUÁRIO', descricao: 'as caixas enchem de água: o coração boia (segure ↓ para afundar)', cartas: 'normal', cor: 0x2a9fff },
  { id: 'cogumelo', nome: 'COGUMELO MALUCO', descricao: 'o coração vira GIGANTE e MINI (e a música junto)!', cartas: 'normal', cor: 0xff4a4a },
  { id: 'estatua', nome: 'DANÇA DA ESTÁTUA', descricao: 'a música parou? ESTÁTUA! Quem a luz pegar se mexendo leva dano', cartas: 'normal', cor: 0x7fd8ff },
  { id: 'gelo', nome: 'PISTA DE GELO', descricao: 'o coração escorrega: difícil de frear!', cartas: 'normal', cor: 0xbfefff },
  { id: 'terremoto', nome: 'TERREMOTO', descricao: 'a terra treme, joga o coração e derruba pedras!', cartas: 'normal', cor: 0xc8a070 },
  { id: 'chuva', nome: 'CHUVA DE VERÃO', descricao: 'a chuva empurra o coração pra baixo e as poças escorregam!', cartas: 'normal', cor: 0x6ab8ff },
  { id: 'ventania', nome: 'VENTANIA', descricao: 'rajadas de vento empurram o coração (olhe as folhas!)', cartas: 'normal', cor: 0x9ae07a },
  { id: 'abelhas', nome: 'ENXAME', descricao: 'ficou parado? as abelhas vêm atrás! (se mexer despista)', cartas: 'normal', cor: 0xffd23a },
  { id: 'vagalumes', nome: 'VAGA-LUMES', descricao: 'anoiteceu: só os vaga-lumes iluminam a caixa!', cartas: 'normal', cor: 0xd8ff6a },
  { id: 'polen', nome: 'ESPIRRO DE PÓLEN', descricao: 'a... a... ATCHIM! o espirro joga o coração longe', cartas: 'normal', cor: 0xffe680 },
  { id: 'trepadeira', nome: 'TREPADEIRA', descricao: 'vinhas crescem das bordas e fecham a caixa: não encoste!', cartas: 'normal', cor: 0x3fbf5a },
]

export const EVENTO = Object.fromEntries(EVENTOS.map((ev) => [ev.id, ev]))

export function ehRodadaBonus(rodada, cfg = BONUS) {
  return rodada > 0 && rodada % cfg.aCadaRodadas === 0
}

// Alguém escolheu o SUPER (ids das escolhas, null = passou)? Então o bonus
// round fica para a próxima rodada: duelo e cartas malucas engoliriam o SUPER
export function adiarBonus(estado, ids) {
  return ids.some((id, j) => id && ehSuper(estado.jogadores[j].baralho.mao.find((c) => c.id === id)))
}

// Sorteia o evento da rodada bônus. Não repete o anterior (se houver outro).
//   disponiveis  ids permitidos (padrão: todos)
export function sortearEvento(rng, { anterior = null, disponiveis = EVENTOS.map((ev) => ev.id) } = {}) {
  const ids = disponiveis.filter((id) => EVENTO[id])
  if (!ids.length) throw new Error('sortearEvento: nenhum evento disponível')
  const opcoes = ids.length > 1 ? ids.filter((id) => id !== anterior) : ids
  return EVENTO[opcoes[inteiro(rng, 0, opcoes.length - 1)]]
}

// ---------- cartas malucas ----------

// Uma carta qualquer de qualquer personagem (Ases inclusos)
function cartaAleatoria(rng) {
  const personagem = PERSONAGENS_PVP[inteiro(rng, 0, PERSONAGENS_PVP.length - 1)]
  const lista = CARTAS[personagem]
  return lista[inteiro(rng, 0, lista.length - 1)]
}

// Troca, NA MÃO, cada carta jogada por outra sorteada (de qualquer personagem).
// A nova custa o mesmo que a original (a energia já foi conferida na escolha)
// e ganha o id '<original>~maluca'. Chame antes de resolverRodada com as
// jogadas devolvidas. Devolve { jogadas, trocas }:
//   jogadas[j]  id da carta nova (ou null: passou)
//   trocas[j]   { de, para } (cartas inteiras) ou null
export function transformarMalucas(estado, jogadas, rng) {
  const trocas = [null, null]
  const novas = jogadas.map((jogada, j) => {
    const id = jogada == null ? null : typeof jogada === 'string' ? jogada : jogada.carta ?? null
    if (id === null) return null
    const baralho = estado.jogadores[j].baralho
    const i = baralho.mao.findIndex((c) => c.id === id)
    if (i < 0) return id // carta fora da mão: resolverRodada acusa o erro
    const de = baralho.mao[i]
    if (ehSuper(de)) return id // o SUPER é imparável: não vira outra carta
    const sorteada = cartaAleatoria(rng)
    const para = { ...sorteada, id: `${de.id}~maluca`, custo: de.custo, maluca: true, original: de.id }
    baralho.mao[i] = para
    trocas[j] = { de, para }
    return para.id
  })
  return { jogadas: novas, trocas }
}

// Depois da rodada: a carta maluca volta a ser a original, onde quer que esteja
// (descarte, mão, monte). O baralho de cada um fica igual ao de antes.
export function desfazerMalucas(estado, trocas) {
  for (const troca of trocas) {
    if (!troca) continue
    for (const jog of estado.jogadores) {
      for (const pilha of [jog.baralho.descarte, jog.baralho.mao, jog.baralho.monte]) {
        const i = pilha.findIndex((c) => c.id === troca.para.id)
        if (i >= 0) pilha[i] = troca.de
      }
    }
  }
}

// ---------- duelo ----------

// Naipe -> arma do duelo
//   ♥ copas    tiro        projéteis em linha reta, recarga curta (todas com mira automática)
//   ♠ espadas  espada      golpe corpo a corpo em arco na frente do coração
//   ♦ ouros    bumerangue  vai até o outro e volta para o dono
//   ♣ paus     explosao    3 bombas em leque com pavio, explodem em área e soltam estilhaços
export const ARMAS = { copas: 'tiro', espadas: 'espada', ouros: 'bumerangue', paus: 'explosao' }
const LISTA_ARMAS = ['tiro', 'espada', 'bumerangue', 'explosao']

// Dano base por acerto de cada arma (força 0) e quanto a força da carta soma (força 1).
// Num duelo de 15 s a espada acerta muito: com mais que isto um duelo decide a partida
const DANO_ARMA = {
  tiro: { base: 2, extra: 2 },
  espada: { base: 3, extra: 3 },
  bumerangue: { base: 2, extra: 3 },
  explosao: { base: 5, extra: 4 },
}

// A arma de quem jogou `carta` (null = passou: arma sorteada, força mínima)
//   { arma, forca (0..1), dano, carta }
export function armaDaCarta(carta, rng) {
  const arma = carta ? ARMAS[carta.naipe] : LISTA_ARMAS[inteiro(rng, 0, LISTA_ARMAS.length - 1)]
  // Ás conta como a carta mais forte no duelo
  const t = carta ? forca(carta.valor === 1 ? 13 : carta.valor) : forca(2)
  const d = DANO_ARMA[arma]
  return { arma, forca: t, dano: Math.round(d.base + d.extra * t), carta: carta ?? null }
}

// Valida para o duelo: a carta só precisa estar na mão (não custa energia)
export function podeJogarDuelo(estado, j, jogada) {
  const id = jogada == null ? null : typeof jogada === 'string' ? jogada : jogada.carta ?? null
  if (id === null) return { ok: true, motivo: null }
  if (!cartaNaMao(estado.jogadores[j].baralho, id)) return { ok: false, motivo: 'carta não está na mão' }
  return { ok: true, motivo: null }
}

// Resolve a rodada de duelo (no lugar de resolverRodada): descarta as cartas
// (sem gastar energia, sem efeitos de copas/Ases) e devolve as armas.
//   { rodada, duelo: true, jogadas: [{ carta, passou }], armas: [arma0, arma1], eventos }
export function resolverDuelo(estado, jogadaP1, jogadaP2, rng) {
  if (estado.vencedor) throw new Error('a partida já acabou')
  const jogadas = [jogadaP1, jogadaP2]
  jogadas.forEach((jogada, j) => {
    const v = podeJogarDuelo(estado, j, jogada)
    if (!v.ok) throw new Error(`jogada inválida do p${j + 1}: ${v.motivo}`)
  })
  const eventos = []
  const cartas = jogadas.map((jogada, j) => {
    const id = jogada == null ? null : typeof jogada === 'string' ? jogada : jogada.carta ?? null
    if (id === null) return null
    const carta = descartar(estado.jogadores[j].baralho, id)
    eventos.push(`p${j + 1} pegou ${carta.nome} para o duelo`)
    return carta
  })
  const armas = cartas.map((c) => armaDaCarta(c, rng))
  estado.fase = 'esquiva'
  estado.historico.push({ rodada: estado.rodada, duelo: true, cartas: cartas.map((c) => c?.id ?? null), armas: armas.map((a) => a.arma) })
  return { rodada: estado.rodada, duelo: true, jogadas: cartas.map((c) => ({ carta: c, passou: !c })), armas, eventos }
}

