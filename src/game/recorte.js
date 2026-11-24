// Câmeras de recorte das caixas de batalha.
//
// Cada caixa (entities/BattleBox.js) tem uma câmera com viewport do tamanho
// dela: o que a caixa recorta (balas, corações, avisos) só é desenhado por
// essa câmera e some fora da caixa. As balas (e o que vem entrando de fora,
// BattleBox.aproximar) também aparecem numa segunda câmera um pouco maior,
// a faixa de aproximação (caixa.cameraFaixa), por baixo da da caixa. Uma cena pode ter VÁRIAS caixas (o
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

// O filtro das câmeras de recorte (o `filtrarCaixas` das arenas), INCREMENTAL. A regra é a de sempre:
// um objeto da lista da cena que a câmera principal desenha (não foi recortado) é de fora das caixas, e
// nenhuma câmera de caixa desenha ele. Antes ela andava por TODOS os filhos da cena a cada postupdate;
// agora só pelos objetos que entraram na lista da cena desde o último quadro (o evento 'addedtoscene'),
// e uma volta inteira só quando o conjunto de câmeras de caixa muda (caixa nova, ou a primeira).
// O resultado é o mesmo: os bits só são postos, nunca tirados, e um objeto que já passou pela regra não
// muda de resposta (quem é recortado é recortado no mesmo quadro em que nasce, antes do postupdate).
//   this.filtrarCaixas = criarFiltroCaixas(this)   // no create(); e cena.events.on('postupdate', this.filtrarCaixas)
export function criarFiltroCaixas(cena) {
  let mascaraFeita = -1 // máscara das caixas na última volta inteira
  const novos = []
  const aoEntrar = (o) => novos.push(o)
  cena.events.on('addedtoscene', aoEntrar)
  cena.events.once('shutdown', () => {
    cena.events.off('addedtoscene', aoEntrar)
    novos.length = 0
  })
  const regra = (o, principal, mascara) => {
    if (o.cameraFilter & principal) return
    if ((o.cameraFilter & mascara) !== mascara) o.cameraFilter |= mascara
  }
  return function filtrarCaixas() {
    const caixas = cena.caixasDeRecorte
    if (!caixas?.length) {
      // sem caixa nada é filtrado; a primeira caixa faz a volta inteira
      mascaraFeita = -1
      novos.length = 0
      return
    }
    const principal = cena.cameras.main.id
    let mascara = 0
    for (const caixa of caixas) mascara |= caixa.camera.id
    const lista = cena.sys.displayList
    if (mascara !== mascaraFeita) {
      mascaraFeita = mascara
      novos.length = 0
      for (const o of lista.list) regra(o, principal, mascara)
      return
    }
    for (let i = 0; i < novos.length; i++) {
      const o = novos[i]
      if (o.displayList === lista && o.scene) regra(o, principal, mascara)
    }
    novos.length = 0
  }
}
