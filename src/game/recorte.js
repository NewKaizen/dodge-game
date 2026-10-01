// Câmeras de recorte das caixas de batalha.
//
// Cada caixa (entities/BattleBox.js) tem uma câmera com viewport do tamanho
// dela: o que a caixa recorta (balas, corações, avisos) só é desenhado por
// essa câmera e some fora da caixa. Uma cena pode ter VÁRIAS caixas (o
// co-op tem uma; a arena PvP tem uma por jogador), então elas ficam
// registradas aqui, por cena:
//
//   caixasDe(cena)                     caixas vivas da cena
//   ignorarNasCaixas(cena, ...objetos) objeto de fora das caixas (efeitos de
//                                      tela, HUD, números): nenhuma câmera de
//                                      recorte desenha ele
//
// O registro é limpo no shutdown da cena (a cena é reaproveitada no restart).

export function caixasDe(cena) {
  if (!cena.caixasDeRecorte) {
    cena.caixasDeRecorte = []
    cena.events.once('shutdown', () => (cena.caixasDeRecorte = null))
  }
  return cena.caixasDeRecorte
}

export function registrarCaixa(cena, caixa) {
  caixasDe(cena).push(caixa)
}

export function removerCaixa(cena, caixa) {
  const lista = cena.caixasDeRecorte
  if (!lista) return
  const i = lista.indexOf(caixa)
  if (i >= 0) lista.splice(i, 1)
}

export function ignorarNasCaixas(cena, ...objetos) {
  const lista = objetos.flat()
  for (const caixa of cena.caixasDeRecorte ?? []) caixa.camera.ignore(lista)
  return lista[0]
}
