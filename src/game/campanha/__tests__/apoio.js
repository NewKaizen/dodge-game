// Apoio dos testes da campanha: um "jogador" que desvia como o navegador (quadros de dt variável,
// a esquiva local de campanha/simulacao.js) e devolve as amostras que iriam ao servidor.
import { criarEsquivaLocal } from '../simulacao.js'
import { pilotoDeDesvio } from '../../manual/padroes.js'

export const DTS = [16, 17, 16, 33, 16, 8, 17, 16, 21]

// pilotos: 'bom' (desvia), 'parado' (nunca se mexe), 'zigue' (anda em zigue-zague sem olhar), 'reto' (só para a esquerda)
export function joyDe(piloto, e, t, caixa) {
  if (piloto === 'parado') return { x: 0, y: 0 }
  if (piloto === 'reto') return { x: -100, y: 0 }
  if (piloto === 'zigue') return { x: Math.round(100 * Math.sin(t / 420)), y: Math.round(100 * Math.cos(t / 730)) }
  return pilotoDeDesvio(e.sim.lista, e.coracao, caixa, 180)
}

export function desviar(ataque, { piloto = 'bom', dts = DTS, aoPedaco } = {}) {
  const e = criarEsquivaLocal(ataque)
  let t = 0
  let q = 0
  let acertos = 0
  let ultimoPedaco = 0
  while (!e.acabou) {
    const dt = dts[q++ % dts.length]
    t += dt
    acertos += e.quadro(dt, joyDe(piloto, e, t, ataque.caixa)).acertos
    if (aoPedaco && t - ultimoPedaco >= 250) {
      ultimoPedaco = t
      aoPedaco(e.gravador.tirar(), t)
    }
  }
  if (aoPedaco) aoPedaco(e.gravador.tirar(), t)
  return { acertos, amostras: e.gravador.lista, tempo: t }
}
