import { LARGURA, ALTURA, FONTE } from '../../constants.js'
import { pistaSonora, volumeEfeitos, tocar } from '../../audio.js'
import { pref } from '../../preferencias.js'
import { fatores } from '../../acessibilidade.js'
import { flashTela } from '../../effects/flash.js'
import { ignorarNasCaixas } from '../../recorte.js'
import { pistasDasBalas, indicadoresDeBorda } from './pistas.js'

// BOSS SEMANAL · ESCURIDÃO na arena (CoopArena e CoopArenaN; docs/boss-semanal.md). Inspirado na
// luta da estátua do Gerson: a caixa fica quase preta, cada PC vê só o PRÓPRIO coração (com um
// brilho fraco) e desvia pelo SOM (coop/semanal/pistas.js: panorâmica, altura, tique, timbre).
//
//   const e = ligarEscuridao(cena, { quadro, meu, jogadores })   no create da arena
//     quadro: a Pista do quadro único · meu: o índice do MEU coração · jogadores: () => estado.jogadores
//   (desliga sozinho no shutdown da cena)
//
// - O escuro (ESCURO de alpha, ~5% das balas aparecem) fica entre as balas e o meu coração, só dentro
//   da caixa (caixa.recortar), e a faixa de aproximação desliga (nada aparece chegando por fora).
//   Os corações dos aliados ficam por baixo do escuro.
// - CLARÃO a cada CLARAO_MS (sorteado): o escuro abre por REVELA_MS e mostra as balas. Com "clarões"
//   desligados ou "reduzir animações" não há clarão branco: o escuro só clareia um pouco, num brilho roxo.
// - Um aliado levou um acerto: um bipe curto ('aliado') vindo do lado do coração dele.
// - PISTAS VISUAIS (preferência pistasVisuais, ou o volume dos efeitos no 0): setas na borda da caixa na
//   direção das balas, mais fortes quanto mais perto (indicadoresDeBorda). O som continua se puder.
// - Uma vez por navegador, antes da luta: "use fone de ouvido".
export const ESCURO = 0.95
export const REVELA_MS = 500
export const CLARAO_MS = { min: 4200, max: 6500 }
const CHAVE_DICA = 'dodge-dica-fone'
const PROFUNDIDADE = { aliado: 9.3, escuro: 9.5, brilho: 9.6, setas: 9.7 }

export function ligarEscuridao(cena, { quadro, meu, jogadores }) {
  const caixa = quadro.caixa
  const escuro = cena.add.rectangle(0, 0, LARGURA * 3, ALTURA * 3, 0x000000).setOrigin(0.5).setDepth(PROFUNDIDADE.escuro).setAlpha(ESCURO)
  const brilho = cena.add.image(0, 0, 'brilho').setTint(0x9a8cff).setDepth(PROFUNDIDADE.brilho).setAlpha(0.35).setDisplaySize(70, 70)
  const setas = cena.add.graphics().setDepth(PROFUNDIDADE.setas)
  caixa.recortar(escuro, brilho, setas)
  // os aliados ficam por baixo do escuro (as profundidades de antes voltam no fim)
  const guardadas = []
  quadro.coracoes.forEach((c, j) => {
    if (j === meu) return
    for (const o of [c.sprite, c.anel, c.forma, c.tag, c.reticula].filter(Boolean)) {
      guardadas.push([o, o.depth])
      o.setDepth(PROFUNDIDADE.aliado)
    }
  })
  const estado = { tempo: 0, proximoClarao: sortearClarao(), revelaAte: -Infinity, tiques: new WeakMap(), hp: (jogadores() ?? []).map((j) => j.hp), aviso: null }
  // pistas visuais: a preferência, ou sozinhas se os efeitos estão sem som
  const semSom = volumeEfeitos() <= 0
  const visuais = () => pref('pistasVisuais') || volumeEfeitos() <= 0

  // a dica (uma vez por navegador) e o aviso das pistas visuais automáticas
  let jaViu = false
  try {
    jaViu = globalThis.localStorage?.getItem(CHAVE_DICA) === '1'
    globalThis.localStorage?.setItem(CHAVE_DICA, '1')
  } catch {}
  const linhas = []
  if (!jaViu) linhas.push('USE FONE DE OUVIDO', 'as balas ficam no escuro: desvie pelo som', 'esquerda/direita = de que lado · agudo = em cima · o tique acelera quando chega perto')
  if (semSom && !pref('pistasVisuais')) linhas.push('', 'efeitos sem som: PISTAS VISUAIS ligadas nesta luta (setas na borda da caixa)')
  if (linhas.length) {
    const dica = cena.add.text(LARGURA / 2, ALTURA / 2 - 30, linhas.join('\n'), { fontFamily: FONTE, fontSize: '13px', color: '#d8d0ff', stroke: '#000000', strokeThickness: 4, align: 'center', backgroundColor: '#0b0918cc', padding: { x: 14, y: 10 } }).setOrigin(0.5).setDepth(120)
    ignorarNasCaixas(cena, dica)
    cena.tweens.add({ targets: dica, alpha: 0, delay: 5200, duration: 700, onComplete: () => dica.destroy() })
    estado.aviso = dica
  }

  function sortearClarao() {
    return CLARAO_MS.min + Math.random() * (CLARAO_MS.max - CLARAO_MS.min)
  }

  function clarao() {
    estado.revelaAte = estado.tempo + REVELA_MS
    if (fatores().clarao >= 1) {
      flashTela(cena, 0xffffff, 0.22, 260)
      tocar(cena, 'trovao')
    }
  }

  // o quanto do escuro fica (1 = escuro total) agora
  function nivelDoEscuro() {
    const falta = estado.revelaAte - estado.tempo
    if (falta <= 0) return ESCURO
    // clarão de verdade: abre quase tudo; com clarões reduzidos, só um brilho roxo fraco
    const aberto = fatores().clarao >= 1 ? 0.1 : 0.5
    const f = Math.min(1, falta / 120) // fecha nos últimos 120 ms
    return ESCURO - (ESCURO - aberto) * f
  }

  function tocarPistas(meuCoracao, agora) {
    const pistas = pistasDasBalas(quadro.balas.lista, meuCoracao, caixa.limites)
    for (const p of pistas) {
      const ultimo = estado.tiques.get(p.bala) ?? -Infinity
      if (agora - ultimo < p.tiqueMs) continue
      estado.tiques.set(p.bala, agora)
      pistaSonora({ pan: p.pan, freq: p.freq, timbre: p.timbre, volume: p.volume })
    }
    return pistas
  }

  function desenharSetas(pistas, meuCoracao) {
    setas.clear()
    if (!visuais() || !pistas.length) return
    const pulso = 0.75 + 0.25 * Math.sin(estado.tempo / 70)
    for (const s of indicadoresDeBorda(pistas, meuCoracao, caixa.limites)) {
      const a = (0.35 + 0.65 * s.intensidade) * pulso
      const tam = 7 + 9 * s.intensidade
      const cos = Math.cos(s.angulo)
      const sin = Math.sin(s.angulo)
      // um triângulo apontando para fora (para a bala), encostado na borda por dentro
      const bx = s.x - cos * 4
      const by = s.y - sin * 4
      setas.fillStyle(s.timbre === 'tambor' ? 0xffb060 : s.timbre === 'zumbido' ? 0xff7a8a : 0xd8d0ff, a)
      setas.fillTriangle(bx + cos * tam, by + sin * tam, bx - sin * tam * 0.6, by + cos * tam * 0.6, bx + sin * tam * 0.6, by - cos * tam * 0.6)
      setas.lineStyle(2, 0xffffff, a * 0.6).strokeCircle(s.x, s.y, 3 + 10 * s.intensidade * pulso)
    }
  }

  function aliadosAcertados() {
    const lista = jogadores() ?? []
    const eu = quadro.coracoes[meu]
    lista.forEach((jog, k) => {
      const antes = estado.hp[k]
      estado.hp[k] = jog.hp
      if (k === meu || antes == null || !(jog.hp < antes)) return
      const c = quadro.coracoes[k]
      const pan = eu?.ativo && c ? Math.max(-1, Math.min(1, (c.x - eu.x) / Math.max(1, caixa.limites.width / 2))) : 0
      pistaSonora({ pan, freq: 500, timbre: 'aliado', volume: 0.8 })
    })
  }

  function atualizar(_, delta) {
    if (!quadro || quadro.destruida) return
    estado.tempo += delta
    const aberta = quadro.aberta
    caixa.faixaLigada = !aberta
    const l = caixa.limites
    escuro.setPosition(l.centerX, l.centerY).setAlpha(nivelDoEscuro())
    const eu = quadro.coracoes[meu]
    if (eu?.ativo) brilho.setVisible(true).setPosition(eu.x, eu.y).setAlpha(0.28 + 0.08 * Math.sin(estado.tempo / 300))
    else brilho.setVisible(false)
    aliadosAcertados()
    if (!aberta) {
      setas.clear()
      return
    }
    if (estado.tempo >= estado.proximoClarao) {
      estado.proximoClarao = estado.tempo + sortearClarao()
      clarao()
    }
    const pistas = eu?.ativo ? tocarPistas(eu, estado.tempo) : []
    desenharSetas(pistas, eu)
  }

  cena.events.on('update', atualizar)
  const desligar = () => {
    cena.events.off('update', atualizar)
    caixa.faixaLigada = true
    for (const [o, d] of guardadas) if (o.active) o.setDepth(d)
    for (const o of [escuro, brilho, setas]) o.destroy()
  }
  cena.events.once('shutdown', desligar)
  return {
    desligar,
    // dev/testes
    estadoDebug: () => ({ escuro: escuro.alpha, revelando: estado.revelaAte > estado.tempo, visuais: visuais(), pistas: quadro.coracoes[meu]?.ativo ? pistasDasBalas(quadro.balas.lista, quadro.coracoes[meu], caixa.limites).map(({ bala, ...p }) => p) : [] }),
    clarao,
  }
}
