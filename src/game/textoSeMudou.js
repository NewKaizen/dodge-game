// Muda um Text do Phaser só no que mudou de verdade.
//
// Cada mudança de um Text (setText com outro conteúdo, setColor, setStroke, setFontSize...)
// re-rasteriza o canvas dele e reenvia a textura para a GPU. O setText do Phaser já ignora o mesmo
// texto, mas o setColor (e o resto do estilo) refaz tudo SEMPRE, mesmo com a mesma cor: chamado a cada
// quadro (piscas, contadores, HUD) é um re-render + upload de textura por quadro à toa
// (docs/desempenho.md, fase 1). Use no update e em tudo que roda a cada quadro:
//
//   textoSeMudou(t, 'CONTROLES INVERTIDOS!', '#ff9a3a')   texto e cor
//   textoSeMudou(t, `${n}`)                               só o texto
//   textoSeMudou(t, undefined, cor)                       só a cor
//
// Devolve o próprio Text (dá para encadear). Para piscar, use setVisible/setAlpha (não custam nada)
// em vez de trocar o texto por '' e de volta.
export function textoSeMudou(t, texto, cor) {
  if (!t) return t
  if (texto !== undefined && t.text !== texto) t.setText(texto)
  if (cor !== undefined && String(t.style?.color ?? '').toLowerCase() !== String(cor).toLowerCase()) t.setColor(cor)
  return t
}
