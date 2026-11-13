// COSMÉTICOS: o contrato com o resto do jogo (catálogo, loot boxes, equipar, arenas).
//
//   SONS_DANO, EFEITOS_CARTA, LANCAMENTOS, MOLDURAS_ANIMADAS   [{ id, nome, raridade, arquivo? }]
//        o índice 0 de cada lista é o padrão/grátis ('dano-padrao', 'efeito-nenhum',
//        'lancamento-padrao', 'moldura-nenhuma'); raridade: 'comum' | 'raro' | 'epico' | 'lendario'
//   tocarSomDano(scene, id)                        o som do golpe (id desconhecido = padrão)
//   aplicarEfeitoCarta(scene, alvo, id) -> { destroy() }
//   animarLancamento(scene, { x, y, alvoX, alvoY, cor }, id) -> Promise<void>
//   desenharMoldura(scene, x, y, tamanho, id) -> Container
//   previa(scene, tipo, id, x, y, tamanho) -> { destroy(), tocar?() }   tipo: 'som'|'efeito'|'lancamento'|'moldura'|'frente'|'verso'
//   ESTILOS_FRENTE, VERSOS_ILUSTRADOS   (0016) o estilo da face das cartas ('frente-classica' é o padrão) e os versos
//        ilustrados do baú ('verso-<x>'; os versos lisos de sempre não estão aqui)
//   desenharFrente(scene, carta, id) -> true   chama carta.montarFrente(tema) (entities/Carta.js); erro sobe
//   desenharVerso(scene, carta, id) -> true    põe o desenho em carta.verso; erro sobe
//   miniatura(scene, tipo, id) -> chave       textura parada de uma carta de amostra ('frente' | 'verso')
//
// Para trocar um som sintetizado por um arquivo seu, ponha `arquivo: 'sons/dano/xxx.ogg'` na entrada
// (arquivo em public/sons/dano/). Ver docs/cosmeticos.md.
import { IDS_SOM, definirRegistroSons, tocarSomDano } from './sons.js'
import { EFEITOS_DEF, aplicarEfeitoCarta } from './efeitos.js'
import { IDS_LANCAMENTO, animarLancamento } from './lancamentos.js'
import { IDS_MOLDURA, desenharMoldura } from './molduras.js'
import { previa as previaSlots } from './previa.js'
import { ESTILOS_FRENTE, desenharFrente, miniaturaFrente, previaFrente, temRenderizadorFrente } from './frentes.js'
import { VERSOS_ILUSTRADOS, desenharVerso, previaVerso, temRenderizadorVerso, texturaVerso } from './versos.js'

export const RARIDADES = ['comum', 'raro', 'epico', 'lendario']

export const SONS_DANO = [
  { id: 'dano-padrao', nome: 'Padrão', raridade: 'comum' },
  { id: 'dano-latido', nome: 'Latido de cachorro', raridade: 'comum' },
  { id: 'dano-uuf', nome: 'Uuf!', raridade: 'comum', arquivo: 'sons/dano/uuf.mp3' },
  { id: 'dano-pato', nome: 'Quack do pato', raridade: 'comum' },
  { id: 'dano-moeda', nome: 'Moeda de videogame', raridade: 'comum' },
  { id: 'dano-boing', nome: 'Boing de mola', raridade: 'comum' },
  { id: 'dano-buzina', nome: 'Buzina de palhaço', raridade: 'raro' },
  { id: 'dano-miau', nome: 'Miado de gato', raridade: 'raro', arquivo: 'sons/dano/miau.mp3' },
  { id: 'dano-vidro', nome: 'Vidro quebrando', raridade: 'raro' },
  { id: 'dano-laser', nome: 'Laser 8-bit', raridade: 'raro' },
  { id: 'dano-pum', nome: 'Pum cômico', raridade: 'raro' },
  { id: 'dano-sino', nome: 'Sino de templo', raridade: 'epico' },
  { id: 'dano-cabra', nome: 'Grito de cabra', raridade: 'lendario' },
]

export const EFEITOS_CARTA = [
  { id: 'efeito-nenhum', nome: 'Nenhum', raridade: 'comum' },
  { id: 'efeito-brilho', nome: 'Brilho dourado', raridade: 'comum' },
  { id: 'efeito-bolhas', nome: 'Bolhas', raridade: 'comum' },
  { id: 'efeito-folhas', nome: 'Folhas ao vento', raridade: 'comum' },
  { id: 'efeito-sombra', nome: 'Aura sombria', raridade: 'raro' },
  { id: 'efeito-eletrico', nome: 'Arcos elétricos', raridade: 'raro' },
  { id: 'efeito-estrelas', nome: 'Estrelas em órbita', raridade: 'raro' },
  { id: 'efeito-chamas', nome: 'Chamas', raridade: 'epico' },
  { id: 'efeito-pixel-fogo', nome: 'Fogo de pixel', raridade: 'epico' },
  { id: 'efeito-arco-iris', nome: 'Contorno arco-íris', raridade: 'epico' },
  { id: 'efeito-holografico', nome: 'Holográfica', raridade: 'lendario' },
]

export const LANCAMENTOS = [
  { id: 'lancamento-padrao', nome: 'Padrão', raridade: 'comum' },
  { id: 'lancamento-explosao', nome: 'Explosão', raridade: 'comum' },
  { id: 'lancamento-confete', nome: 'Canhão de confete', raridade: 'comum' },
  { id: 'lancamento-raio', nome: 'Raio', raridade: 'raro' },
  { id: 'lancamento-sakura', nome: 'Rajada de sakura', raridade: 'raro' },
  { id: 'lancamento-tsunami', nome: 'Tsunami', raridade: 'epico' },
  { id: 'lancamento-meteoro', nome: 'Meteoro', raridade: 'epico' },
  { id: 'lancamento-arco-iris-borboletas', nome: 'Arco-íris e borboletas', raridade: 'epico' },
  { id: 'lancamento-buraco-negro', nome: 'Buraco negro', raridade: 'lendario' },
]

export const MOLDURAS_ANIMADAS = [
  { id: 'moldura-nenhuma', nome: 'Nenhuma', raridade: 'comum' },
  { id: 'moldura-anim-coracoes', nome: 'Corações de pixel', raridade: 'comum' },
  { id: 'moldura-anim-slime', nome: 'Slime pingando', raridade: 'comum' },
  { id: 'moldura-anim-glitch', nome: 'Glitch', raridade: 'raro' },
  { id: 'moldura-anim-estrelas', nome: 'Estrelas', raridade: 'raro' },
  { id: 'moldura-anim-neon', nome: 'Neon', raridade: 'raro' },
  { id: 'moldura-anim-gelo', nome: 'Cristais de gelo', raridade: 'raro' },
  { id: 'moldura-anim-fogo', nome: 'Fogo', raridade: 'epico' },
  { id: 'moldura-anim-arco-iris', nome: 'Arco-íris', raridade: 'epico' },
  { id: 'moldura-anim-gerson', nome: 'Estátua do Gerson', raridade: 'lendario' },
  { id: 'moldura-anim-galaxia', nome: 'Galáxia', raridade: 'lendario' },
]

definirRegistroSons(SONS_DANO)

export const CATALOGO_COSMETICOS = { som: SONS_DANO, efeito: EFEITOS_CARTA, lancamento: LANCAMENTOS, moldura: MOLDURAS_ANIMADAS, frente: ESTILOS_FRENTE, verso: VERSOS_ILUSTRADOS }

// o id tem quem o desenhe/toque? (os padrões "nenhum" não precisam)
export function temRenderizador(tipo, id) {
  if (tipo === 'som') return IDS_SOM.includes(id) || SONS_DANO.some((s) => s.id === id && s.arquivo)
  if (tipo === 'efeito') return id === 'efeito-nenhum' || id in EFEITOS_DEF
  if (tipo === 'lancamento') return IDS_LANCAMENTO.includes(id)
  if (tipo === 'moldura') return id === 'moldura-nenhuma' || IDS_MOLDURA.includes(id)
  if (tipo === 'frente') return temRenderizadorFrente(id)
  if (tipo === 'verso') return temRenderizadorVerso(id)
  return false
}

// a prévia de qualquer cosmético (as dos estilos de carta e dos versos moram nos módulos deles)
export function previa(scene, tipo, id, x, y, tamanho = 64) {
  try {
    if (tipo === 'frente') return previaFrente(scene, id, x, y, tamanho)
    if (tipo === 'verso') return previaVerso(scene, id, x, y, tamanho)
  } catch {
    return { destroy() {} }
  }
  return previaSlots(scene, tipo, id, x, y, tamanho)
}

export function miniatura(scene, tipo, id) {
  if (tipo === 'frente') return miniaturaFrente(scene, id)
  if (tipo === 'verso') return texturaVerso(scene, id)
  return null
}

export { tocarSomDano, aplicarEfeitoCarta, animarLancamento, desenharMoldura, desenharFrente, desenharVerso, ESTILOS_FRENTE, VERSOS_ILUSTRADOS }
