import { ignorarNasCaixas } from '../../../../recorte.js'
import { FONTE, TEMPOS } from '../../../../constants.js'
import { semLigaduras } from '../../../../campanha/texto.js'
import { semente } from '../../../../arte/pixelCanvas.js'

// Ajudas dos 8 eventos da arena CAFÉ FRANCÊS (sem regra de jogo; as regras puras estão em planos.js).

// O que todo evento precisa: guardar o que cria (o terminar() apaga tudo), saber de quem é
// o coração de cada pista e se a caixa j ainda está em ataque.
export function contextoDoCafe(arena) {
  const vivos = new Set()
  const guardar = (o) => {
    vivos.add(o)
    o.once?.('destroy', () => vivos.delete(o))
    return o
  }
  const dono = (j) => arena.donoDaPista?.(j) ?? j
  // a caixa j está em ataque (e o dono dela não foi nocauteado)
  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !p.ataque?.desarmado && !arena.ko?.[dono(j)] ? p : null
  }
  // o coração da pista j se estiver andando (na caixa espelho da partida em rede ele é do
  // outro PC: quem o move é a rede, então o evento só olha; `meu` diz se ele é daqui)
  const coracao = (j) => {
    const p = arena.pistas?.[j]
    const c = p?.coracoes?.[0]
    return c?.ativo && !arena.ko?.[dono(j)] ? c : null
  }
  const ehMeu = (j) => {
    const p = arena.pistas?.[j]
    const c = p?.coracoes?.[0]
    return Boolean(c) && !p.espelho && !c.espelho
  }
  // objeto desenhado só dentro da caixa da pista
  const naCaixa = (pista, ...objetos) => {
    for (const o of objetos) {
      guardar(o)
      pista.caixa.recortar(o)
    }
    return objetos[0]
  }
  // objeto de tela (fora das caixas)
  const naTela = (...objetos) => {
    for (const o of objetos) {
      guardar(o)
      ignorarNasCaixas(arena, o)
    }
    return objetos[0]
  }
  const texto = (x, y, conteudo, { cor = '#ffffff', tamanho = 12, profundidade = 95 } = {}) =>
    naTela(
      arena.add
        .text(x, y, semLigaduras(conteudo), { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: Math.max(3, Math.round(tamanho / 4)), align: 'center' })
        .setOrigin(0.5)
        .setDepth(profundidade),
    )
  // a frase curta que explica a regra nova, em cima de cada caixa, por um instante
  const instrucao = (conteudo, { cor = '#ffe9a0', ms = 2600 } = {}) => {
    for (const p of arena.pistas ?? []) {
      const l = p.caixa.limites
      const t = texto(l.centerX, Math.max(78, l.top - 14), conteudo, { cor, tamanho: 12 })
      arena.tweens.add({ targets: t, alpha: { from: 1, to: 0 }, delay: ms, duration: 380, onComplete: () => t.destroy() })
    }
  }
  const limpar = () => {
    for (const o of [...vivos]) {
      arena.tweens?.killTweensOf(o)
      o.destroy?.()
    }
    vivos.clear()
  }
  // dano pequeno e fixo (fração do HP máximo, mínimo 2) no coração da pista j; true se contou
  const machucar = (j, fracao, c) => {
    const quem = dono(j)
    const hpMax = arena.estado?.jogadores?.[quem]?.hpMax ?? 100
    const dano = Math.max(2, Math.round(hpMax * fracao))
    if (!c?.ativo || c.invencivel) return false
    if (!arena.acertou?.(quem, dano)) return false
    c.tomarDano(TEMPOS.invencivelMs)
    return true
  }
  // cura o dono da pista j (a arena sincroniza em rede; a prévia do Guia não tem, só mostra)
  const curar = (j, fracao) => {
    const quem = dono(j)
    const hpMax = arena.estado?.jogadores?.[quem]?.hpMax ?? 100
    const n = Math.max(2, Math.round(hpMax * fracao))
    return arena.curarCoracao ? arena.curarCoracao(quem, n) : 0
  }
  return { vivos, guardar, dono, pistaViva, coracao, ehMeu, naCaixa, naTela, texto, instrucao, limpar, machucar, curar }
}

// Um rng filho (repetível) tirado do rng da rodada: cada caixa usa o seu, para o que acontece
// numa caixa (que depende do tempo dela) não mudar o sorteio da outra
export const rngFilho = (sorte) => semente(Math.floor(sorte() * 2147483647))

// a pista acabou o ataque (ou foi desarmada)
export const pistaEncerrada = (pista) => !pista.ataque || pista.ataque.desarmado

// cor 0xrrggbb mais clara/escura (f > 1 clareia)
export function tom(cor, f) {
  const c = (d) => Math.max(0, Math.min(255, Math.round(((cor >> d) & 255) * f))) << d
  return c(16) | c(8) | c(0)
}
