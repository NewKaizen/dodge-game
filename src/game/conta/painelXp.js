import { get } from 'svelte/store'
import { LARGURA } from '../constants.js'
import { lan, enviarResultado } from '../../lib/lan/rede.js'
import { progressoDoXp, textoMotivo, itemDoCatalogo, NOME_TIPO } from '../../lib/progresso.js'
import { partyDe } from '../data/batalha.js'
import { emRede, meuLado } from '../rede.js'
import { barraXp, COR, texto } from './ui.js'

// XP do CO-OP em rede (Fase 2F; server/partidas.js, docs/online.md): Vitoria e GameOver
// mandam o resultado do time UMA vez por partida e mostram uma faixa compacta com o XP
// (o painel grande do PvpResultado é parte daquela cena e não dá para reaproveitar).
//
//   const xp = prepararXpCoop(cena, { vitoria, estatisticas })   no create(): null fora de rede
//   mostrarPainelXp(cena, xp, { y })                              no fim da animação: a faixa
//
// Sem resposta do servidor em XP_ESPERA_MS a faixa diz que o XP aparece no perfil; se a
// resposta chegar depois, a faixa se atualiza sozinha.
export const XP_ESPERA_MS = 5000
const BARRA = { w: 220, h: 8 }

export function prepararXpCoop(cena, { vitoria, estatisticas }) {
  if (!emRede()) return null
  const s = get(lan)
  const partidaId = s.sala?.partidaId ?? null
  const xp = { partidaId, motivo: null, recompensa: null, aoChegar: null }
  if (!partidaId) return { ...xp, motivo: 'nao_registrada' }
  enviarResultado({
    partidaId,
    vitoria: Boolean(vitoria),
    rodadas: estatisticas?.turnos ?? null,
    duracao: Math.round((estatisticas?.tempoMs ?? 0) / 1000),
    personagem: partyDe(cena.registry)[meuLado()] ?? null,
  })
  if (!s.eu.conta) xp.motivo = 'convidado'
  const parar = lan.subscribe((estado) => {
    const r = estado.recompensa
    if (r?.partidaId !== partidaId || r === xp.recompensa) return
    xp.recompensa = r
    xp.aoChegar?.()
  })
  cena.events.once('shutdown', parar)
  return xp
}

// o texto de quanto XP veio e por quê (a vitória do time tem o bônus)
export const motivoCoop = (motivo) => (motivo === 'vitoria' ? 'vitória do time: participação + bônus' : motivo === 'derrota' ? 'participação' : textoMotivo(motivo) || 'participação')

export function mostrarPainelXp(cena, xp, { x = LARGURA / 2, y, profundidade = 10 } = {}) {
  if (!xp) return null
  const titulo = texto(cena, 0, y, '', 16, COR.ok).setOrigin(0, 0.5).setDepth(profundidade)
  const nota = texto(cena, 0, y, '', 12, COR.dica, { strokeThickness: 3 }).setOrigin(0, 0.5).setDepth(profundidade)
  const nivel = texto(cena, x - BARRA.w / 2 - 8, y + 17, '', 11, COR.descricao, { strokeThickness: 3 }).setOrigin(1, 0.5).setDepth(profundidade)
  const g = cena.add.graphics().setDepth(profundidade)
  let animacao = null

  const centrar = () => {
    const total = titulo.width + (nota.text ? 12 + nota.width : 0)
    titulo.x = x - total / 2
    nota.x = titulo.x + titulo.width + 12
  }
  const barra = (total) => {
    const p = progressoDoXp(total)
    g.clear()
    barraXp(g, x - BARRA.w / 2, y + 13, BARRA.w, BARRA.h, p)
    nivel.setText(`NÍVEL ${p.nivel}`)
  }
  const semXp = (codigo) => {
    titulo.setText(codigo === 'convidado' ? 'SEM XP' : '+0 XP').setColor(COR.apagado)
    nota.setText(textoMotivo(codigo))
    centrar()
  }
  const mostrar = () => {
    const r = xp.recompensa
    animacao?.stop()
    if (!r) {
      if (xp.motivo) return semXp(xp.motivo)
      titulo.setText('contando o XP…').setColor(COR.dica)
      nota.setText('')
      return centrar()
    }
    if (!r.xpGanho || r.xpTotal == null) {
      semXp(r.motivo || 'sem_relato')
      if (r.xpTotal != null) barra(r.xpTotal)
      return
    }
    const subiu = r.nivelAntes != null && r.nivelDepois != null && r.nivelDepois > r.nivelAntes
    const novos = (r.itensNovos ?? []).map((id) => itemDoCatalogo(id)).filter(Boolean)
    const partes = []
    if (subiu) partes.push(`SUBIU PARA O NÍVEL ${r.nivelDepois}!`)
    if (novos.length) partes.push(`NOVO: ${novos[0].nome} (${NOME_TIPO[novos[0].tipo]})${novos.length > 1 ? ` +${novos.length - 1}` : ''}`)
    titulo.setText(`+${r.xpGanho} XP`).setColor(COR.ok)
    nota.setText(partes.length ? partes.join(' · ') : motivoCoop(r.motivo)).setColor(partes.length ? COR.gold : COR.dica)
    centrar()
    const antes = Math.max(0, r.xpTotal - r.xpGanho)
    barra(antes)
    animacao = cena.tweens.addCounter({ from: antes, to: r.xpTotal, duration: 900, ease: 'Quad.easeOut', onUpdate: (tw) => barra(Math.round(tw.getValue())), onComplete: () => barra(r.xpTotal) })
  }
  xp.aoChegar = mostrar
  mostrar()
  // a resposta demora: o XP não some, só passa a ser visto no perfil
  cena.time.delayedCall(XP_ESPERA_MS, () => {
    if (xp.recompensa || xp.motivo || !titulo.active) return
    titulo.setText('XP a caminho').setColor(COR.dica)
    nota.setText(textoMotivo('espera'))
    centrar()
  })
  return { destruir: () => [titulo, nota, nivel, g].forEach((o) => o.destroy()) }
}
