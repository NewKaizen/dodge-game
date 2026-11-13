import Carta from './Carta.js'
import { FONTE, TEXTO } from '../constants.js'
import { semLigaduras } from '../campanha/texto.js'

// O monte de cartas de UM jogador (3 versos empilhados + quantas cartas restam) e a carta VIRADA que ele
// escolheu (a escolha às cegas), nas arenas de 3 e 4 (PvpArenaN e CoopArenaN). Cada um com o VERSO equipado
// DELE (cor + arte ilustrada: rede.js versosDasVagasDaPartida). Só desenho: nunca muda a partida.
//
//   const monte = criarMonte(cena, { x, y, personagem, verso: { cor, arte }, largura: 34, inclinacao: -0.08 })
//   monte.setQuantidade(n)       quantas cartas restam (mostra até 3 versos e o número)
//   monte.setVisivel(false)      esconde (jogador eliminado/caído)
//   monte.objetos                os objetos (para esmaecer junto com a grade)
//   monte.destruir()
//
//   const virada = criarViradaEscolhida(cena, { x, y, personagem, verso, largura: 46, inclinacao })
//   virada.mostrar() / virada.esconder()   (a carta escolhida às cegas: aparece quando o jogador confirma)
export const LARGURA_MONTE = 34
export const LARGURA_VIRADA = 46

const dadosDoVerso = (personagem) => ({ personagem, naipe: 'espadas', valor: 2 })

export function criarMonte(cena, { x, y, personagem, verso = null, largura = LARGURA_MONTE, inclinacao = -0.08, profundidade = 5 } = {}) {
  const cartas = [0, 1, 2].map((k) => new Carta(cena, x - k * 1.2, y - k * 1.8, dadosDoVerso(personagem), { virada: true, largura, corVerso: verso?.cor ?? null, arteVerso: verso?.arte ?? null }).setDepth(profundidade + k).setRotation(inclinacao))
  const texto = cena.add.text(x, y + largura * 0.72 + 6, '', { fontFamily: FONTE, fontSize: '9px', color: TEXTO.desabilitado, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(profundidade + 3)
  const monte = {
    cartas,
    texto,
    x,
    y,
    objetos: [...cartas, texto],
    visivel: true,
    quantidade: 0,
    setQuantidade(n) {
      monte.quantidade = n
      texto.setText(monte.visivel ? semLigaduras(`${n}`) : '')
      cartas.forEach((c, k) => c.setVisible(monte.visivel && n > k))
    },
    setVisivel(v) {
      monte.visivel = Boolean(v)
      monte.setQuantidade(monte.quantidade)
    },
    destruir() {
      for (const o of monte.objetos) o.scene && o.destroy()
    },
  }
  return monte
}

export function criarViradaEscolhida(cena, { x, y, personagem, verso = null, largura = LARGURA_VIRADA, inclinacao = 0.06, profundidade = 6 } = {}) {
  const carta = new Carta(cena, x, y, dadosDoVerso(personagem), { virada: true, largura, corVerso: verso?.cor ?? null, arteVerso: verso?.arte ?? null }).setDepth(profundidade).setRotation(inclinacao).setVisible(false)
  const virada = {
    carta,
    x,
    y,
    largura,
    aparecendo: null,
    mostrar() {
      if (carta.visible || !carta.scene) return
      carta.setVisible(true).setScale(0.6).setAlpha(0)
      virada.aparecendo = cena.tweens.add({ targets: carta, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' })
    },
    esconder() {
      virada.aparecendo?.stop?.()
      virada.aparecendo = null
      if (carta.scene) carta.setVisible(false).setScale(1).setAlpha(1)
    },
    destruir() {
      virada.esconder()
      carta.scene && carta.destroy()
    },
  }
  return virada
}
