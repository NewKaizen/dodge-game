import Phaser from 'phaser'
import { FONTE, LARGURA, TEMPOS } from '../../../constants.js'
import { tocar, cortarMusica } from '../../../audio.js'
import { ignorarNasCaixas } from '../../../recorte.js'
import { particulas } from '../../../effects/particulas.js'
import { flashTela } from '../../../effects/flash.js'
import { shake } from '../../../effects/shake.js'

// DANÇA DA ESTÁTUA: a música de batalha toca normal... e PARA de repente, sem
// aviso nenhum (corte seco). Esse é o sinal. Com a música parada:
//   - as balas e o ataque CONGELAM (pista.congelada), mas o coração continua
//     livre para andar (e as balas paradas continuam machucando);
//   - um HOLOFOTE de vigia (estilo stealth) varre cada caixa. Quem se MEXER com
//     a luz em cima do coração é PEGO: leva 30% do HP máximo (uma vez por
//     parada). Mexer FORA da luz pode: é só não ser visto.
// Depois a música volta (do mesmo ponto) e tudo descongela.
// Visual: notinhas dançando entre as caixas enquanto a música toca (somem no
// corte, junto com ela), o feixe e o círculo da luz (amarelo; laranja quando
// está em cima de alguém; vermelho quando pegou), "PEGO!" com flash e alarme.
// A CPU obedece quase sempre (CPU_OBEDECE); às vezes se distrai e continua andando.
// terminar() (fim da esquiva ou saída da cena) devolve a música e descongela tudo.

const MUSICA = { min: 2200, max: 4200 } // ms tocando entre uma parada e outra
const PRIMEIRA = { min: 1500, max: 2600 } // ms até a primeira parada
const PARADA = { min: 2600, max: 3600 } // ms de música parada
const ACENDE_MS = 380 // a luz acende devagar: só vigia depois de acesa (tempo de reação)
const RAIO = 38 // raio (px) da área vigiada
const VELOCIDADE = 105 // px/s da luz varrendo a caixa
const PAUSA_LUZ = { min: 120, max: 380 } // ms parada em cada ponto da ronda
const CHANCE_CACAR = 0.45 // chance do próximo ponto da ronda ser em cima do coração
const MEXEU_PX = 4 // px andados sob a luz até contar como "se mexeu" (tremidinha passa)
const DANO_HP = 0.3 // fração do HP máximo de quem é pego
const CPU_OBEDECE = 0.8 // chance da CPU ficar paradinha numa parada
const CPU_DISTRAIDA_MS = { min: 500, max: 1500 } // senão ela demora isso para perceber que parou
const AMARELO = 0xfff0a0
const LARANJA = 0xffa040
const VERMELHO = 0xff3048

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  let ativo = false
  let t = 0
  let parada = false
  let mudaEm = 0
  let paradaDesde = 0
  let cpuObedece = true
  let cpuPercebeEm = 0 // distraída: quando ela finalmente para
  let notas = null // notinhas dançando entre as caixas (Graphics)
  let textos = []
  // por pista: { pista, luz, feixe, aro, x, y, alvo, esperaAte, ultimo, mexeu, pego }
  let vigias = []

  const dono = (j) => arena.donoDaPista?.(j) ?? j

  // ---------- visual ----------

  const desenharNotas = () => {
    const g = notas
    g.clear()
    if (parada) return
    const dancar = (dx, fase, cor) => {
      const y = Math.sin(t / 150 + fase) * 5
      const inclina = Math.sin(t / 300 + fase) * 3
      g.fillStyle(cor, 1)
      g.fillEllipse(dx - 3 + inclina, y + 6, 9, 7)
      g.fillRect(dx + 1 + inclina, y - 10, 2, 16)
      g.fillTriangle(dx + 3 + inclina, y - 10, dx + 9 + inclina, y - 5, dx + 3 + inclina, y - 4)
    }
    dancar(-10, 0, 0xfff0a0)
    dancar(10, 1.7, 0x7fd8ff)
  }

  const texturaLuz = () => (arena.textures.exists('bonus-holofote') ? 'bonus-holofote' : null)

  const criarVigia = (pista) => {
    const chave = texturaLuz()
    // a luz fica por baixo das balas (5): bala na luz continua legível
    const luz = chave
      ? arena.add.image(0, 0, chave).setDisplaySize(RAIO * 2.6, RAIO * 2.6)
      : arena.add.circle(0, 0, RAIO * 1.1, 0xffffff)
    luz.setDepth(4).setBlendMode(Phaser.BlendModes.ADD).setTint?.(AMARELO)
    const feixe = arena.add.graphics().setDepth(3).setBlendMode(Phaser.BlendModes.ADD)
    // contorno da área vigiada (por cima de tudo menos o coração)
    const aro = arena.add.graphics().setDepth(9)
    pista.caixa.recortar(luz, feixe, aro)
    const vigia = { pista, luz, feixe, aro, x: 0, y: 0, alvo: null, esperaAte: 0, ultimo: null, mexeu: 0, pego: false, alpha: 0 }
    luz.setAlpha(0) // feixe e aro: o alpha vai no desenho (desenharVigia)
    return vigia
  }

  // a luz acende longe do coração (quem demorou a reagir não é pego de graça)
  const posicionarInicio = (v) => {
    const l = v.pista.caixa.limites
    const c = v.pista.coracoes[0]
    let melhor = null
    for (let k = 0; k < 8; k++) {
      const p = { x: entre(l.left + RAIO * 0.6, l.right - RAIO * 0.6), y: entre(l.top + RAIO * 0.6, l.bottom - RAIO * 0.6) }
      p.d = c?.ativo ? Math.hypot(p.x - c.x, p.y - c.y) : 0
      if (!melhor || p.d > melhor.d) melhor = p
    }
    v.x = melhor.x
    v.y = melhor.y
    v.alvo = null
    v.esperaAte = 0
  }

  const novoAlvo = (v) => {
    const l = v.pista.caixa.limites
    const c = v.pista.coracoes[0]
    const m = RAIO * 0.5
    if (c?.ativo && sorte() < CHANCE_CACAR) {
      v.alvo = { x: Phaser.Math.Clamp(c.x + entre(-24, 24), l.left + m, l.right - m), y: Phaser.Math.Clamp(c.y + entre(-24, 24), l.top + m, l.bottom - m) }
    } else {
      v.alvo = { x: entre(l.left + m, l.right - m), y: entre(l.top + m, l.bottom - m) }
    }
  }

  const moverLuz = (v, delta) => {
    if (t < v.esperaAte) return
    if (!v.alvo) novoAlvo(v)
    const dx = v.alvo.x - v.x
    const dy = v.alvo.y - v.y
    const d = Math.hypot(dx, dy)
    const passo = (VELOCIDADE * delta) / 1000
    if (d <= passo) {
      v.x = v.alvo.x
      v.y = v.alvo.y
      v.alvo = null
      v.esperaAte = t + entre(PAUSA_LUZ.min, PAUSA_LUZ.max)
    } else {
      v.x += (dx / d) * passo
      v.y += (dy / d) * passo
    }
  }

  const desenharVigia = (v, emCima) => {
    const l = v.pista.caixa.limites
    const cor = v.pego ? VERMELHO : emCima ? LARANJA : AMARELO
    const pisca = v.pego ? 0.75 + Math.sin(t / 60) * 0.25 : 1
    v.luz.setPosition(v.x, v.y).setAlpha(0.75 * v.alpha * pisca)
    v.luz.setTint?.(cor)
    // feixe vindo de cima (a "torre" fica acima da caixa)
    const ox = l.centerX + (v.x - l.centerX) * 0.35
    const oy = l.top - 60
    const ang = Math.atan2(v.y - oy, v.x - ox) + Math.PI / 2
    const ex = Math.cos(ang) * RAIO
    const ey = Math.sin(ang) * RAIO
    v.feixe.clear()
    v.feixe.fillStyle(cor, 0.16 * v.alpha)
    v.feixe.fillTriangle(ox - 4, oy, ox + 4, oy, v.x + ex, v.y + ey)
    v.feixe.fillTriangle(ox - 4, oy, v.x - ex, v.y - ey, v.x + ex, v.y + ey)
    // contorno tracejado girando: a borda exata da área vigiada
    v.aro.clear()
    v.aro.lineStyle(emCima || v.pego ? 2 : 1.5, cor, 0.85 * v.alpha)
    const pedacos = 16
    for (let k = 0; k < pedacos; k++) {
      const a0 = (k / pedacos) * Math.PI * 2 + t / 900
      v.aro.beginPath()
      v.aro.arc(v.x, v.y, RAIO, a0, a0 + (Math.PI * 2) / pedacos / 1.8)
      v.aro.strokePath()
    }
  }

  const etiqueta = (x, y, conteudo, cor, tamanho, pista) => {
    const txt = arena.add
      .text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(14)
    if (pista) pista.caixa.recortar(txt)
    else ignorarNasCaixas(arena, txt.setDepth(95))
    textos.push(txt)
    return txt
  }

  // ---------- regras ----------

  const pararMusica = () => {
    parada = true
    paradaDesde = t
    mudaEm = t + entre(PARADA.min, PARADA.max)
    cpuObedece = sorte() < CPU_OBEDECE
    cpuPercebeEm = t + entre(CPU_DISTRAIDA_MS.min, CPU_DISTRAIDA_MS.max)
    cortarMusica(true)
    for (const v of vigias) {
      v.pista.congelada = true
      v.pego = false
      v.mexeu = 0
      v.alpha = 0
      v.ultimo = null
      posicionarInicio(v)
    }
  }

  const voltarMusica = () => {
    parada = false
    mudaEm = t + entre(MUSICA.min, MUSICA.max)
    cortarMusica(false)
    for (const v of vigias) v.pista.congelada = false
  }

  const pegar = (v, j) => {
    v.pego = true
    const quem = dono(j)
    const jog = arena.estado?.jogadores?.[quem]
    const dano = Math.max(1, Math.round((jog?.hpMax ?? 100) * DANO_HP))
    if (!arena.acertou(quem, dano)) return
    tocar(arena, 'pego')
    flashTela(arena, VERMELHO, 0.32, 260)
    shake(arena, 220, 0.008)
    const c = v.pista.coracoes[0]
    if (c?.ativo) {
      c.tomarDano(TEMPOS.invencivelMs)
      particulas(arena, c.x, c.y, { cor: VERMELHO, quantidade: 22, velocidade: 170 })
      const l = v.pista.caixa.limites
      const txt = etiqueta(Phaser.Math.Clamp(c.x, l.left + 52, l.right - 52), Math.max(l.top + 16, c.y - 26), 'PEGO!', '#ff3048', 24, v.pista)
      arena.tweens.add({ targets: txt, scale: { from: 1.5, to: 1 }, duration: 200, ease: 'Back.easeOut' })
      arena.tweens.add({ targets: txt, y: txt.y - 10, alpha: 0, delay: 700, duration: 300, onComplete: () => txt.destroy() })
    }
    // aviso na tela também (quem foi pego), em cima da caixa
    const rotulo = quem === arena.cpu ? 'CPU' : `P${quem + 1}`
    const l = v.pista.caixa.limites
    const topo = etiqueta(l.centerX, l.top - 14, `${rotulo} SE MEXEU!`, '#ff5050', 16)
    arena.tweens.add({ targets: topo, scale: { from: 1.6, to: 1 }, duration: 180, ease: 'Back.easeOut' })
    arena.tweens.add({ targets: topo, alpha: 0, delay: 900, duration: 300, onComplete: () => topo.destroy() })
  }

  // quem andou com a luz em cima do coração?
  const vigiar = (v, j, delta) => {
    const c = v.pista.coracoes[0]
    if (!c?.ativo) {
      v.ultimo = null
      return false
    }
    const andou = v.ultimo ? Math.hypot(c.x - v.ultimo.x, c.y - v.ultimo.y) : 0
    v.ultimo = { x: c.x, y: c.y }
    const emCima = Math.hypot(c.x - v.x, c.y - v.y) <= RAIO + c.hitbox
    const acesa = t - paradaDesde >= ACENDE_MS
    if (!emCima || !acesa || v.pego || arena.ko?.[dono(j)]) {
      v.mexeu = 0
      return emCima && acesa
    }
    v.mexeu = Math.max(0, v.mexeu + andou - delta * 0.004)
    if (v.mexeu > MEXEU_PX) pegar(v, j)
    return true
  }

  const evento = {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      parada = false
      mudaEm = entre(PRIMEIRA.min, PRIMEIRA.max)
      vigias = arena.pistas.map(criarVigia)
      notas = arena.add.graphics().setDepth(20).setPosition(LARGURA / 2, arena.pistas[0]?.caixa.limites.centerY ?? 200)
      ignorarNasCaixas(arena, notas)
    },

    // a CPU obedece (quase sempre): parada é parada. Distraída, continua
    // dançando um pouco até perceber (se a luz chegar antes, foi pega)
    joy(j, joy) {
      if (!ativo || !parada || dono(j) !== arena.cpu) return joy
      if (cpuObedece || t >= cpuPercebeEm) return { x: 0, y: 0 }
      if (Math.hypot(joy.x, joy.y) > 20) return joy
      return { x: Math.cos(t / 400) * 70, y: Math.sin(t / 530) * 70 }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      if (t >= mudaEm) {
        if (parada) voltarMusica()
        else pararMusica()
      }
      desenharNotas()
      vigias.forEach((v, j) => {
        if (parada) {
          v.alpha = Math.min(1, (t - paradaDesde) / ACENDE_MS)
          moverLuz(v, delta)
        } else {
          v.alpha = Math.max(0, v.alpha - delta / 160)
        }
        const emCima = parada && vigiar(v, j, delta)
        desenharVigia(v, emCima)
      })
    },

    // testes/console: pvpArena.efeitoBonus.estadoDebug()
    estadoDebug() {
      return { parada, t: Math.round(t), mudaEm: Math.round(mudaEm), cpuObedece, luzes: vigias.map((v) => ({ x: Math.round(v.x), y: Math.round(v.y), pego: v.pego, alpha: v.alpha })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      parada = false
      cortarMusica(false)
      for (const v of vigias) {
        v.pista.congelada = false
        v.luz.destroy()
        v.feixe.destroy()
        v.aro.destroy()
      }
      vigias = []
      notas?.destroy()
      notas = null
      textos.forEach((x) => x.scene && x.destroy())
      textos = []
    },
  }
  return evento
}
