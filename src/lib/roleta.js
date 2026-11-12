// A FITA da roleta do baú (docs/baus.md). Puro: sem Phaser, testado em __tests__/roleta.test.js.
//
// O servidor decide o que sai (abrir_bau); a roleta é só a festa. A fita é uma fila de cartas que passa
// por baixo de um marcador e para na recompensa de verdade. As outras cartas (as "iscas") são itens do
// catálogo sorteados com as MESMAS chances publicadas (PESOS: 60% comum, 28% raro, 10% épico, 2% lendário),
// para a roleta não prometer mais raridade do que o baú dá.
//
//   itemDaRecompensa(rec)                      a carta de uma recompensa de lerAberto() (item/duplicado/xp)
//   sortearIsca(rng, { pool })                 uma carta de isca, pelas chances publicadas
//   construirFita({ real, tamanho, parada, rng, pool })   -> cartas; a real fica em fita[parada]
//   rng: () => número em [0, 1) (Math.random no jogo; os testes injetam um determinístico)
import { ESCALA, POOL_BAU, itemDoBau, raridadeDoSorteio } from './cosmeticos.js'

export function itemDaRecompensa(rec) {
  if (rec?.tipo === 'xp') return { tipo: 'xp', raridade: rec.raridade, xp: rec.xp ?? 0 }
  return { tipo: 'item', id: rec.id, raridade: rec.raridade, ...(rec.tipo === 'duplicado' && { duplicado: true, xp: rec.xp ?? 0 }) }
}

export function sortearIsca(rng = Math.random, { pool = POOL_BAU } = {}) {
  const raridade = raridadeDoSorteio(Math.min(ESCALA - 1, Math.floor(rng() * ESCALA)))
  const lista = pool[raridade]?.length ? pool[raridade] : pool.comum
  const id = lista[Math.min(lista.length - 1, Math.floor(rng() * lista.length))]
  return { tipo: 'item', id, raridade: itemDoBau(id)?.raridade ?? raridade }
}

const mesmo = (a, b) => Boolean(a && b && a.tipo === b.tipo && a.id === b.id)

export function construirFita({ real, tamanho, parada, rng = Math.random, pool = POOL_BAU }) {
  if (!Number.isInteger(tamanho) || tamanho < 1) throw new Error('tamanho inválido')
  if (!Number.isInteger(parada) || parada < 0 || parada >= tamanho) throw new Error('parada fora da fita')
  const fita = []
  for (let i = 0; i < tamanho; i++) {
    if (i === parada) {
      fita.push(real)
      continue
    }
    // sem a mesma carta ao lado da outra, e a carta de verdade não se repete em volta dela
    let carta = sortearIsca(rng, { pool })
    for (let t = 0; t < 6 && (mesmo(carta, fita[i - 1]) || mesmo(carta, real)); t++) carta = sortearIsca(rng, { pool })
    fita.push(carta)
  }
  return fita
}
