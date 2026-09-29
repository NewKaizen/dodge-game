import { FONTE, LARGURA, TEXTO } from '../constants.js'

// Etiqueta curta no alto da tela (ex.: "ATAQUE ENFRAQUECIDO"): aparece, fica
// um pouco e some. Diferente de numero(), que é um número que pula e sobe.
export function etiqueta(scene, texto, cor = TEXTO.cura, { x = LARGURA / 2, y = 56, ms = 1900 } = {}) {
  const t = scene.add
    .text(x, y, texto, { fontFamily: FONTE, fontSize: '14px', color: cor, stroke: '#000000', strokeThickness: 4, align: 'center' })
    .setOrigin(0.5)
    .setDepth(30)
    .setAlpha(0)
  scene.cameraCaixa?.ignore(t)
  scene.tweens.add({ targets: t, alpha: 1, duration: 150 })
  scene.tweens.add({ targets: t, alpha: 0, delay: Math.max(150, ms - 350), duration: 350, onComplete: () => t.destroy() })
  return t
}

// Descreve um modificador de ataque { velocidade, densidade, duracao }
// (fatores: < 1 enfraquece, > 1 reforça). Devolve null se não muda nada.
export function descreverModificador(mod) {
  if (!mod) return null
  const pct = (f) => Math.round(Math.abs(1 - f) * 100)
  const partes = []
  if (mod.velocidade && Math.abs(1 - mod.velocidade) > 0.01) partes.push(`VELOCIDADE ${mod.velocidade < 1 ? '-' : '+'}${pct(mod.velocidade)}%`)
  if (mod.densidade && Math.abs(1 - mod.densidade) > 0.01) partes.push(`BALAS ${mod.densidade < 1 ? '-' : '+'}${pct(mod.densidade)}%`)
  if (mod.duracao && mod.duracao < 0.99) partes.push('ONDA MAIS CURTA')
  if (!partes.length) return null
  const fraco = (mod.velocidade ?? 1) <= 1 && (mod.densidade ?? 1) <= 1
  return { texto: `${fraco ? 'ATAQUE ENFRAQUECIDO' : 'ATAQUE REFORÇADO'}\n${partes.join(' · ')}`, cor: fraco ? TEXTO.cura : TEXTO.caido }
}
