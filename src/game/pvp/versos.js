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
//   arteDoVerso(id) / artesDosVersosDaPartida({ sala, perfil })
//       os versos ILUSTRADOS do baú (0016): id do registro ('verso-<x>') para a Carta (opção arteVerso), ou null
//       (os versos lisos). A cor continua indo junto: é o verso liso se o desenho não carregar
import { itemDoCatalogo } from '../../lib/progresso.js'
import { arteDoVerso } from '../../lib/cosmeticos.js'

export { arteDoVerso }

// As cores do catálogo (progresso.js) são escuras demais para a mesa: o verso quase sumia ao lado do
// padrão. Na hora de desenhar a cor sobe de luminosidade e de saturação (o mesmo matiz, então o
// verso continua sendo o mesmo: estrelado = azul, carmesim = vermelho, dourado = ouro).
export function realcarVerso(cor) {
  const r = ((cor >> 16) & 255) / 255
  const g = ((cor >> 8) & 255) / 255
  const b = (cor & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + 360) % 360
  const l = Math.max(0.42, (max + min) / 2 + 0.14)
  const sBase = d ? d / (1 - Math.abs(2 * ((max + min) / 2) - 1)) : 0
  const s = Math.min(1, Math.max(0.68, sBase + 0.1))
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [rr, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return (Math.round((rr + m) * 255) << 16) | (Math.round((gg + m) * 255) << 8) | Math.round((bb + m) * 255)
}

export function corDoVerso(id) {
  const item = typeof id === 'string' ? itemDoCatalogo(id) : null
  if (!item || item.tipo !== 'verso' || item.padrao || !/^#[0-9a-f]{6}$/i.test(item.cor ?? '')) return null
  return realcarVerso(parseInt(item.cor.slice(1), 16))
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

export function artesDosVersosDaPartida({ sala = null, perfil = null } = {}) {
  if (sala && sala.membros?.length > 1) return versosDaSala(sala).map(arteDoVerso)
  return [arteDoVerso(perfil?.verso_equipado), null]
}
