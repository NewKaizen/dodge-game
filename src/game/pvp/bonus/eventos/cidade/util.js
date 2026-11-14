import { FONTE } from '../../../../constants.js'
import { ignorarNasCaixas } from '../../../../recorte.js'
import { semLigaduras } from '../../../../campanha/texto.js'
import { numero } from '../../../../effects/numero.js'
import { tocar } from '../../../../audio.js'

// Pedaços comuns dos eventos da CIDADE GRANDE (esta pasta).

export const COR = { ouro: 0xffc83a, semaforo: 0xff4030, verde: 0x40e060, ceu: 0x7fb8ff }

// o lado j está de pé e atacando (o aviso/efeito só vale enquanto o ataque dele roda)
export function pistaViva(arena, j) {
  const p = arena.pistas?.[j]
  return p && p.atacando && !p.ataque?.desarmado && !arena.ko?.[arena.donoDaPista?.(j) ?? j] ? p : null
}

export const donoDe = (arena, j) => arena.donoDaPista?.(j) ?? j
// o coração da pista j é da CPU? (a CPU também precisa de ajuda nos eventos que mexem no controle)
export const ehCpu = (arena, j) => arena.cpu !== null && arena.cpu !== undefined && donoDe(arena, j) === arena.cpu
export const coracaoDe = (arena, j) => arena.pistas?.[j]?.coracoes?.[0] ?? null
// em rede a caixa espelho tem o coração do OUTRO PC: ele decide a posição (e o que o evento faz com ela)
export const ehEspelho = (arena, j) => Boolean(arena.pistas?.[j]?.espelho || coracaoDe(arena, j)?.espelho)

// texto de tela (ligaduras fi/fl da fonte viram "A": semLigaduras); com `pista`, só aparece dentro da caixa
export function texto(arena, x, y, conteudo, { cor = '#ffffff', tamanho = 12, pista = null, profundidade = 14, borda = 4 } = {}) {
  const t = arena.add
    .text(x, y, semLigaduras(conteudo), { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: borda, align: 'center' })
    .setOrigin(0.5)
    .setDepth(profundidade)
  if (pista) pista.caixa.recortar(t)
  else ignorarNasCaixas(arena, t)
  return t
}

// aviso curto no alto de cada caixa (a regra nova, em até 6 palavras): aparece, pulsa e some sozinho
export function avisoNasCaixas(arena, conteudo, { cor = '#ffd23a', ms = 1500, atraso = 0 } = {}) {
  const textos = arena.pistas.map((pista) => {
    const l = pista.caixa.limites
    const t = texto(arena, l.centerX, l.top + 16, conteudo, { cor, tamanho: 12, pista, profundidade: 40 })
    t.setAlpha(0)
    arena.tweens.add({ targets: t, alpha: 1, scale: { from: 1.5, to: 1 }, delay: atraso, duration: 180, ease: 'Back.easeOut' })
    arena.tweens.add({ targets: t, alpha: 0, delay: atraso + ms, duration: 300, onComplete: () => t.scene && t.destroy() })
    return t
  })
  return textos
}

// energia da ENTREGA: em partida de verdade vira "graze" (5 grazes = 1 energia, o caminho que já vai para o outro
// PC em rede). No Guia (sem regras) só mostra o número. Devolve true se o lado j é daqui e a energia foi dada.
export function darEnergia(arena, j, n) {
  const dono = donoDe(arena, j)
  if (typeof arena.aplicarGraze !== 'function') return false
  if (arena.rede && !arena.rede.ehMeu?.(dono)) return false // o outro PC dá a dele
  const grazes = 5 * n
  for (let k = 0; k < grazes; k++) arena.aplicarGraze(dono)
  if (arena.rede?.enviar) arena.rede.enviar('graze', null, { lado: dono, n: grazes, r: arena.rede.rodada })
  // estas "grazes" são só a moeda da energia: não contam como graze de verdade nas estatísticas
  if (arena.estatisticas?.[dono]) arena.estatisticas[dono].grazes = Math.max(0, arena.estatisticas[dono].grazes - grazes)
  if (arena.grazesRodada?.[dono] !== undefined) arena.grazesRodada[dono] = Math.max(0, arena.grazesRodada[dono] - grazes)
  return true
}

export { numero, tocar }
