// Arenas do PvP: depois de escolher os lutadores, os jogadores VOTAM na arena
// (cena PvpVoto). Cada arena tem fundo animado próprio (backgrounds/arenas/),
// música própria e a SUA lista de rodadas bônus (ids de EVENTOS, pvp/bonus.js).
// Lógica pura (sem Phaser), testável em Node.
//
//   ARENAS / ARENA[id]      as arenas, na ordem dos cartões da votação
//   ALEATORIA               id do cartão "?" (vale como voto numa arena sorteada)
//   apurarVotos(votos, rng) quem ganhou (a mais votada; empate = sorteio entre as empatadas)
//   eventosDaArena(id)      eventos de bônus da arena (com nome/descrição próprios, se tiver)
//
// Formato de uma arena:
//   id, nome, descricao     cartão da votação e página do Grimório
//   curto                   nome no cartão pequeno da votação
//   musica, tituloMusica    public/assets/musicas/<musica>.mid (sem o arquivo: toca o
//                           pvp.mid) e o nome da música na votação (null: não mostra)
//   cor                     cor da arena (cartão, nome no anúncio)
//   moldura                 { cor, alpha }: borda do tabuleiro e o véu escuro por cima do
//                           fundo (o fundo fica atrás das caixas e das cartas: precisa
//                           continuar legível)
//   bonus                   ids de EVENTOS ou { id, nome?, descricao? } para renomear o
//                           evento só nesta arena. Duelo e Cartas Malucas entram em todas.
//
// Regra das listas: no mínimo BONUS_POR_ARENA eventos (teste em __tests__/arenas.test.js).

import { EVENTO } from './bonus.js'
import { inteiro } from './baralho.js'

export const ALEATORIA = 'aleatoria'
export const BONUS_POR_ARENA = 10
const GERAIS = ['duelo', 'malucas'] // bônus de carta: combinam com qualquer cenário

export const ARENAS = [
  {
    id: 'castelo',
    curto: 'CASTELO',
    nome: 'CASTELO',
    descricao: 'O salão de cartas de sempre: os bônus clássicos',
    musica: 'pvp',
    tituloMusica: 'Rude Buster',
    cor: 0x8a6cff,
    moldura: { cor: 0x3a2d5a, alpha: 0 },
    bonus: [...GERAIS, 'explosoes', 'apagao', 'gravidade', 'pontaCabeca', 'trocado', 'aquario', 'gelo', 'terremoto'],
  },
  {
    id: 'jardim',
    curto: 'JARDIM',
    nome: 'JARDIM',
    descricao: 'Sete sóis sobre um jardim florido: chuva, vento, bichos e plantas',
    musica: 'arena_jardim',
    tituloMusica: 'Seven Suns',
    cor: 0x5fe08a,
    moldura: { cor: 0x2f6a3e, alpha: 0.35 },
    bonus: [...GERAIS, 'cogumelo', { id: 'aquario', nome: 'LAGO', descricao: 'o jardim alaga: o coração boia (segure ↓ para afundar)' }, 'chuva', 'ventania', 'abelhas', 'vagalumes', 'polen', 'trepadeira'],
  },
  {
    id: 'informatica',
    curto: 'INFORMÁTICA',
    nome: 'SALA DE INFORMÁTICA',
    descricao: 'PCs velhos, internet lenta e janelas que não param de abrir',
    musica: 'arena_informatica',
    tituloMusica: null,
    cor: 0x4fc8ff,
    moldura: { cor: 0x1d4a66, alpha: 0.35 },
    bonus: [...GERAIS, 'pcEscola', { id: 'apagao', nome: 'QUEDA DE ENERGIA', descricao: 'caiu a energia da sala: só dá pra ver em volta do coração!' }, 'popups', 'lag', 'teclado', 'clone', 'telaAzul', 'cursor'],
  },
  {
    id: 'palco',
    curto: 'PALCO',
    nome: 'PALCO',
    descricao: 'Holofotes, plateia e pirotecnia: o show não pode parar',
    musica: 'arena_palco',
    tituloMusica: null,
    cor: 0xff4fa8,
    moldura: { cor: 0x6a1d4a, alpha: 0.35 },
    bonus: [...GERAIS, 'festa', 'estatua', { id: 'explosoes', nome: 'PIROTECNIA', descricao: 'os fogos do show caem nas duas caixas!' }, 'plateia', 'geloSeco', 'ritmo', 'karaoke', 'mosh'],
  },
  {
    id: 'templo',
    curto: 'TEMPLO',
    nome: 'TEMPLO',
    descricao: 'Ruínas antigas cheias de armadilhas, tochas e mistério',
    musica: 'arena_templo',
    tituloMusica: null,
    cor: 0xf0c050,
    moldura: { cor: 0x6a5020, alpha: 0.35 },
    bonus: [...GERAIS, 'terremoto', 'gravidade', 'pontaCabeca', { id: 'apagao', nome: 'TOCHAS', descricao: 'as tochas apagaram: só dá pra ver em volta do coração!' }],
  },
  {
    id: 'coliseu',
    curto: 'COLISEU',
    nome: 'COLISEU',
    descricao: 'A arena dos gladiadores: a plateia quer sangue (de mentirinha)',
    musica: 'arena_coliseu',
    tituloMusica: null,
    cor: 0xff6a3a,
    moldura: { cor: 0x6a2a1a, alpha: 0.35 },
    bonus: [...GERAIS, 'trocado', 'encolhendo', 'leoes', 'lancas', 'bigas', 'brasas', 'polegar', 'rede'],
  },
]

export const ARENA = Object.fromEntries(ARENAS.map((a) => [a.id, a]))
export const ARENA_PADRAO = 'castelo'

const entrada = (b) => (typeof b === 'string' ? { id: b } : b)

// Eventos de bônus da arena, prontos para a roleta e para a rodada: o evento
// de EVENTOS com o nome/descrição próprios da arena por cima (se tiver).
// Ids que ainda não existem em EVENTOS ficam de fora.
export function eventosDaArena(id) {
  const arena = ARENA[id] ?? ARENA[ARENA_PADRAO]
  return arena.bonus.map(entrada).filter((b) => EVENTO[b.id]).map((b) => ({ ...EVENTO[b.id], ...b }))
}

// Apuração da votação.
//   votos  um por jogador: id de arena, ALEATORIA ou null (não votou)
// Cada "?" vira uma arena sorteada; ganha a mais votada; empate = sorteio entre
// as empatadas; ninguém votou = sorteio entre todas. Devolve:
//   { arena, contagem: { id: votos }, empatadas: [ids], sorteios: [arena de cada voto, null se não votou] }
export function apurarVotos(votos, rng) {
  const ids = ARENAS.map((a) => a.id)
  const sorteios = votos.map((v) => (v === ALEATORIA ? ids[inteiro(rng, 0, ids.length - 1)] : ARENA[v] ? v : null))
  const contagem = {}
  for (const v of sorteios) if (v) contagem[v] = (contagem[v] ?? 0) + 1
  const maximo = Math.max(0, ...Object.values(contagem))
  const empatadas = maximo ? ids.filter((id) => contagem[id] === maximo) : ids
  const arena = empatadas.length === 1 ? empatadas[0] : empatadas[inteiro(rng, 0, empatadas.length - 1)]
  return { arena, contagem, empatadas, sorteios }
}
