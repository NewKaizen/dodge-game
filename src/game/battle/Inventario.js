import { ITENS } from '../data/itens.js'

// Inventário compartilhado da party: { idDoItem: quantidade }.
// Item que chega a zero sai da lista.
export default class Inventario {
  constructor(inicial = {}) {
    this.quantidades = Object.fromEntries(Object.entries(inicial).filter(([id, qtd]) => ITENS[id] && qtd > 0))
  }

  lista() {
    return Object.entries(this.quantidades).map(([id, qtd]) => ({ id, def: ITENS[id], qtd }))
  }

  quantidade(id) {
    return this.quantidades[id] ?? 0
  }

  consumir(id) {
    if (!this.quantidade(id)) return false
    this.quantidades[id]--
    if (!this.quantidades[id]) delete this.quantidades[id]
    return true
  }
}
