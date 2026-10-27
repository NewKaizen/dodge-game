// Verso de carta equipado nas partidas (Fase 2F). O servidor manda o id do verso
// de cada jogador no membro da sala (conta.verso); aqui o id vira a cor do
// verso da Carta (entities/Carta.js, opção corVerso). Só enfeite: não muda regra.
//
//   corDoVerso(id)                     0xRRGGBB, ou null (padrão ou id desconhecido: o verso de sempre, com a cor do personagem)
//   versosDaSala(sala)                 [id do host, id do convidado] (null onde não tem)
//   coresDosVersos(ids)                ids -> cores
//   coresDosVersosDaPartida({ sala, perfil })
//       em rede: [verso do host, verso do convidado] (cada um vê o do outro também);
//       fora da rede: o P1 usa o verso equipado de quem está logado, o P2 o padrão
import { itemDoCatalogo } from '../../lib/progresso.js'

export function corDoVerso(id) {
  const item = typeof id === 'string' ? itemDoCatalogo(id) : null
  if (!item || item.tipo !== 'verso' || item.padrao || !/^#[0-9a-f]{6}$/i.test(item.cor ?? '')) return null
  return parseInt(item.cor.slice(1), 16)
}

export const versosDaSala = (sala) => {
  const membros = sala?.membros ?? []
  return [membros.find((m) => m.papel === 'host')?.conta?.verso ?? null, membros.find((m) => m.papel === 'convidado')?.conta?.verso ?? null]
}

export const coresDosVersos = (ids) => ids.map(corDoVerso)

export function coresDosVersosDaPartida({ sala = null, perfil = null } = {}) {
  if (sala && sala.membros?.length > 1) return coresDosVersos(versosDaSala(sala))
  return [corDoVerso(perfil?.verso_equipado), null]
}
