import { FONTE } from '../../../../constants.js'
import { fatores } from '../../../../acessibilidade.js'
import { ignorarNasCaixas } from '../../../../recorte.js'
import { semLigaduras } from '../../../../campanha/texto.js'

// Utilidades dos 8 bônus da CHINATOWN (a lógica pura fica em planos.js).

export const CORES = { vermelho: 0xc8201c, ouro: 0xf0c040, jade: 0x3fbf8a, bambu: 0xd9a85a, madeira: 0x8a5a24, papel: 0xf2dcae, tinta: 0x1a0a14, creme: 0xfff4d6 }

export const dono = (arena, j) => arena.donoDaPista?.(j) ?? j

// a caixa j está em jogo (ataque rodando, dono vivo)?
export function pistaViva(arena, j) {
  const p = arena.pistas?.[j]
  return p && p.atacando && !p.ataque.desarmado && !arena.ko?.[dono(arena, j)] ? p : null
}

// "reduzir animações": sem piscadas rápidas nem tremores
export const calmo = () => !fatores().piscar

// i-frames locais (o coração do dono decide o próprio dano; nada disto vai para a rede)
export function escudar(coracao, ms) {
  if (coracao) coracao.invencivelMs = Math.max(coracao.invencivelMs ?? 0, ms)
}

// guarda os objetos de tela do evento para apagar tudo no terminar()
export function criarVivos() {
  const lista = new Set()
  return {
    guardar(o) {
      lista.add(o)
      o.once?.('destroy', () => lista.delete(o))
      return o
    },
    limpar(arena) {
      for (const o of [...lista]) {
        arena.tweens?.killTweensOf(o)
        o.destroy?.()
      }
      lista.clear()
    },
    get tamanho() {
      return lista.size
    },
  }
}

// texto com contorno da fonte do jogo, sem ligaduras ("fi"/"fl" viram "A" nesta fonte)
export function texto(arena, x, y, conteudo, { cor = '#ffffff', tamanho = 12, contorno = 3, profundidade = 95, pista = null, alinhar = 0.5 } = {}) {
  const txt = arena.add
    .text(x, y, semLigaduras(conteudo), { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: contorno, align: 'center' })
    .setOrigin(alinhar, 0.5)
    .setDepth(profundidade)
  if (pista) pista.caixa.recortar(txt)
  else ignorarNasCaixas(arena, txt)
  return txt
}

// aviso curto em cima de cada caixa ("SÓ ANDA NAS HASTES!"), que some sozinho
export function instrucao(arena, vivos, conteudo, { cor = '#ffe9a0', ms = 2600, tamanho = 11 } = {}) {
  for (const pista of arena.pistas) {
    const l = pista.caixa.limites
    const t = vivos.guardar(texto(arena, l.centerX, l.top - 13, conteudo, { cor, tamanho, contorno: 4, profundidade: 96 }))
    t.setAlpha(0)
    arena.tweens.add({ targets: t, alpha: 1, scale: { from: 1.5, to: 1 }, duration: 220, ease: 'Back.easeOut' })
    arena.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 400, onComplete: () => t.destroy() })
  }
}

// bolha de escudo em volta de (x, y): anel brilhante com reflexo
export function bolha(g, x, y, r, cor, t, alpha = 1) {
  const pulso = calmo() ? 0 : Math.sin(t / 110) * 0.8
  g.fillStyle(cor, 0.16 * alpha).fillCircle(x, y, r + pulso)
  g.lineStyle(2, cor, 0.85 * alpha).strokeCircle(x, y, r + pulso)
  g.lineStyle(1.5, 0xffffff, 0.7 * alpha).beginPath().arc(x, y, r - 3, -2.5, -1.3).strokePath()
}

// polígono preenchido (lista de pontos {x, y})
export function poligono(g, pontos, cor, alpha = 1) {
  g.fillStyle(cor, alpha)
  g.fillPoints(pontos, true)
}

export const limitar = (v, min, max) => Math.max(min, Math.min(max, v))
export const mix = (a, b, k) => a + (b - a) * k
