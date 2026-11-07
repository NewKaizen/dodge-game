// Apoio dos testes da luta: um "jogador" que desvia no QUADRO como o navegador (campanha/quadro.js, um
// passo de cada vez) e devolve as posições que iriam ao servidor.
//   pilotos: 'bom' (EsquivaBot difícil) · 'medio' (EsquivaBot normal) · 'parado' (nunca se mexe)
//            · 'zigue' (anda em zigue-zague sem olhar)
import { criarQuadro } from '../quadro.js'
import { cenaSemTela } from '../cenaSemTela.js'
import { EsquivaBot } from '../../pvp/botEsquiva.js'
import { criarRng, aleatorio } from '../../pvp/baralho.js'
import { PASSO_MS } from '../amostras.js'

const NIVEL = { bom: 'dificil', medio: 'normal', fraco: 'facil' }

export function desviarNoQuadro(esq, { piloto = 'bom', aoPedaco = null, pedacoMs = 250, semente = 'piloto' } = {}) {
  const q = criarQuadro(cenaSemTela(), esq)
  const rng = criarRng(`${semente}:${esq.semente}`)
  const bot = NIVEL[piloto] ? new EsquivaBot({ nivel: NIVEL[piloto], sorte: () => aleatorio(rng) }) : null
  let k = 0
  let ultimo = 0
  while (!q.acabou) {
    k++
    const c = q.coracoes[0]
    let joy = { x: 0, y: 0 }
    if (bot) joy = bot.joy(PASSO_MS, { coracao: c, limites: q.limites, balas: q.balas.lista, zonas: q.balas.zonas ?? [], velocidade: 180, fatorVelocidade: q.balas.fatorVelocidade, velocidadeMax: q.balas.velocidadeMax, invertido: false })
    else if (piloto === 'zigue') joy = { x: Math.round(100 * Math.sin(k / 26)), y: Math.round(100 * Math.cos(k / 45)) }
    q.passo(joy)
    if (aoPedaco && q.t - ultimo >= pedacoMs) {
      ultimo = q.t
      aoPedaco(q.tirarAmostras(), q.t)
    }
  }
  if (aoPedaco) aoPedaco(q.tirarAmostras(), q.t)
  return { acertos: q.acertos[0], amostras: q.amostras, tempo: q.t, q }
}
