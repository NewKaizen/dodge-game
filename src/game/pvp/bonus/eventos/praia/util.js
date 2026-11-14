import { TEMPOS } from '../../../../constants.js'
import { tocar } from '../../../../audio.js'
import { particulas } from '../../../../effects/particulas.js'
import { fatores } from '../../../../acessibilidade.js'
import { semLigaduras } from '../../../../campanha/texto.js'
import { criarRng, aleatorio } from '../../../baralho.js'
import { curar, ENERGIA } from '../../../regras.js'
import { etiqueta } from '../arteColiseu.js'
import { limitar } from './planos.js'

// Ajudas dos 8 eventos da arena PRAIA (sem regra de jogo: as regras ficam em planos.js).

// Um rng por caixa, tirado do rng do evento UMA vez no começo: assim o que cada caixa sorteia não depende
// do relógio (em rede os dois PCs andam em frames diferentes, mas sorteiam as mesmas coisas).
export function rngsPorCaixa(sorte, n) {
  const base = Math.floor(sorte() * 1e9)
  return Array.from({ length: n }, (_, j) => {
    const r = criarRng(`praia:${base}:${j}`)
    return () => aleatorio(r)
  })
}

// Animação calma (reduzir movimento): sem piscar rápido
export const calmo = () => !fatores().piscar
// pisca (alterna) a cada `ms`, ou fica aceso se o jogador pediu menos movimento
export const pisca = (t, ms) => calmo() || Math.sin(t / ms) > 0

function ignorarTodas(arena, obj) {
  for (const caixa of arena.caixasDeRecorte ?? []) caixa.camera.ignore([obj])
}

// O que todo evento precisa: guardar o que cria (para o terminar() apagar tudo) e saber se a caixa j
// ainda está em ataque.
export function contexto(arena) {
  const vivos = new Set()
  const guardar = (o) => {
    vivos.add(o)
    o.once?.('destroy', () => vivos.delete(o))
    return o
  }
  const dono = (j) => arena.donoDaPista?.(j) ?? j
  const ehCpu = (j) => dono(j) === arena.cpu
  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !p.ataque?.desarmado && !arena.ko?.[dono(j)] ? p : null
  }
  const coracao = (j) => {
    const c = arena.pistas?.[j]?.coracoes?.[0]
    return c?.ativo ? c : null
  }
  // Graphics recortado na caixa (só aparece dentro dela)
  const grafico = (pista, profundidade = 4) => {
    const g = guardar(arena.add.graphics().setDepth(profundidade))
    pista.caixa.recortar(g)
    return g
  }
  // Graphics de tela (fora das caixas)
  const graficoDeTela = (profundidade = 92) => {
    const g = guardar(arena.add.graphics().setDepth(profundidade))
    ignorarTodas(arena, g)
    return g
  }
  const limpar = () => {
    for (const o of [...vivos]) {
      arena.tweens?.killTweensOf(o)
      o.destroy()
    }
    vivos.clear()
  }
  return { vivos, guardar, dono, ehCpu, pistaViva, coracao, grafico, graficoDeTela, limpar }
}

// Texto curto da regra nova (<= 6 palavras), em cima de cada caixa, que some sozinho
export function instrucao(arena, ctx, texto, cor = '#ffffff', { ms = 2600 } = {}) {
  arena.pistas.forEach((pista) => {
    const l = pista.caixa.limites
    const txt = ctx.guardar(etiqueta(arena, (l.left + l.right) / 2, l.top - 12, semLigaduras(texto), { cor, tamanho: 11 }))
    txt.setDepth(95)
    arena.tweens.add({ targets: txt, scale: { from: 1.5, to: 1 }, duration: 220, ease: 'Back.easeOut' })
    arena.tweens.add({ targets: txt, alpha: 0, delay: ms, duration: 400, onComplete: () => txt.destroy() })
  })
}

// Dano direto no coração da caixa j (fração do HP máximo, mínimo 2). Respeita os i-frames. true = acertou
export function ferir(arena, ctx, j, fracao, { som = 'queimou', cor = 0xffffff } = {}) {
  const c = ctx.coracao(j)
  if (!c || c.invencivel) return false
  const quem = ctx.dono(j)
  const hpMax = arena.estado?.jogadores?.[quem]?.hpMax ?? 100
  const dano = Math.max(2, Math.round(hpMax * fracao))
  if (!arena.acertou(quem, dano)) return false
  c.tomarDano(TEMPOS.invencivelMs)
  tocar(arena, som)
  particulas(arena, c.x, c.y, { cor, quantidade: 10, velocidade: 110 })
  return true
}

// joystick (-100..100) que leva o coração c até o ponto; `forca` 0..100
export function irPara(c, alvo, forca = 100) {
  const dx = alvo.x - c.x
  const dy = alvo.y - c.y
  const d = Math.hypot(dx, dy)
  if (d < 2) return { x: 0, y: 0 }
  return { x: (dx / d) * forca, y: (dy / d) * forca }
}

export function mistura(a, b, k) {
  const m = (s) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * limitar(k, 0, 1))
  return (m(16) << 16) | (m(8) << 8) | m(0)
}

// ---------- HP e energia fora do dano (cura do tesouro, roubo da gaivota) ----------
// O dono do coração decide e MANDA o ajuste para o outro PC (mensagem 'praiaAjuste' no mesmo canal da
// rede do PvP; o outro soma os mesmos números). Sem rede, só aplica. Na prévia do Guia (sem HUD) só mexe
// no estado de enfeite.
export function criarAjustes(arena) {
  const rede = arena.rede ?? null
  const aplicar = (lado, { hp = 0, energia = 0 }) => {
    const jog = arena.estado?.jogadores?.[lado]
    if (!jog) return { hp: 0, energia: 0 }
    const feito = { hp: 0, energia: 0 }
    if (hp > 0) feito.hp = curar(arena.estado, lado, hp)
    if (energia) {
      const antes = jog.energia ?? 0
      jog.energia = limitar(antes + energia, 0, ENERGIA.maxima)
      feito.energia = jog.energia - antes
    }
    if (feito.hp) arena.huds?.[lado]?.setHp?.(jog.hp)
    if (feito.energia) {
      arena.huds?.[lado]?.setEnergia?.(jog.energia)
      arena.maos?.[lado]?.setEnergia?.(jog.energia)
    }
    return feito
  }
  let desligar = null
  if (rede?.canal?.ao) {
    desligar = rede.canal.ao('praiaAjuste', (d) => {
      if (!d || d.lado !== rede.outroLado || d.r !== arena.estado?.rodada) return
      aplicar(d.lado, d)
    })
  }
  return {
    // hp > 0 cura; energia > 0 ganha, < 0 perde. Devolve o que mudou de verdade ({ hp, energia })
    ajustar(lado, pedido) {
      if (rede && lado !== rede.meuLado) return { hp: 0, energia: 0 }
      const feito = aplicar(lado, pedido)
      if (rede && (feito.hp || feito.energia)) rede.enviar('praiaAjuste', null, { lado, hp: feito.hp, energia: feito.energia, r: arena.estado?.rodada })
      return feito
    },
    desligar() {
      desligar?.()
      desligar = null
    },
  }
}
