import { FONTE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { SIMBOLOS } from '../../entities/Carta.js'
import { corDaVaga } from '../../vagas.js'

// BOSS SEMANAL · LADRA DE CARTAS na arena (CoopArena e CoopArenaN; regras em coop/semanal/ladra.js).
// Só desenho: lê estado.chefe.roubadas a cada quadro (no host e nos convidados o estado é o mesmo) e
//   - mostra a MÃO DELA virada para cima em cima dela (valor, naipe e a cor da vaga do dono), para o
//     time planejar quem precisa recuperar o quê;
//   - carta nova na mão dela: a MÃO DA LADRA vai até o personagem do dono e volta com a carta (o roubo
//     telegrafado);
//   - carta que saiu: volta voando para o dono (recuperada pela ♣ ou pelo SUPER) ou some no meio da mesa
//     (ela jogou contra o time: a carta virada dela da rodada).
//   const l = ligarLadra(cena, { chefe: {x, y}, jogadores: () => estado.jogadores, chefeEstado: () => estado.chefe, alvoDe: (j) => {x, y} })
const CARTA = { l: 20, a: 28, passo: 24, y: -66 } // y: em relação ao chefe
const NOME_VALOR = { 11: 'J', 12: 'Q', 13: 'K' }
const COR_NAIPE = { espadas: '#1a1a2e', paus: '#1a1a2e', copas: '#c8283a', ouros: '#c8283a' }

export function ligarLadra(cena, { chefe, jogadores, chefeEstado, alvoDe }) {
  const objetos = new Map() // id da carta -> { c (container), dono }
  const rotulo = cena.add.text(chefe.x, chefe.y + CARTA.y - CARTA.a / 2 - 8, '', { fontFamily: FONTE, fontSize: '8px', color: '#ffb060', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(31)

  function criarCarta(carta, dono, x, y) {
    const fundo = cena.add.rectangle(0, 0, CARTA.l, CARTA.a, 0xfbf6ea).setStrokeStyle(2, corDaVaga(dono))
    const valor = cena.add.text(0, -6, NOME_VALOR[carta.valor] ?? String(carta.valor), { fontFamily: FONTE, fontSize: '9px', color: COR_NAIPE[carta.naipe] }).setOrigin(0.5)
    const naipe = cena.add.text(0, 6, SIMBOLOS[carta.naipe] ?? '?', { fontFamily: FONTE, fontSize: '10px', color: COR_NAIPE[carta.naipe] }).setOrigin(0.5)
    return cena.add.container(x, y, [fundo, valor, naipe]).setDepth(31)
  }

  // a "mão" da ladra: uma luva laranja que estica até o alvo e volta
  function maoDaLadra(destino, aoPegar) {
    const luva = cena.add.container(chefe.x, chefe.y, [cena.add.circle(0, 0, 9, 0xff9a3d).setStrokeStyle(2, 0x3a1608), cena.add.rectangle(0, -10, 4, 8, 0xff9a3d)]).setDepth(45)
    const rastro = cena.add.graphics().setDepth(44)
    tocar(cena, 'mover')
    cena.tweens.add({
      targets: luva,
      x: destino.x,
      y: destino.y,
      duration: 380,
      ease: 'Quad.easeOut',
      onUpdate: () => rastro.clear().lineStyle(3, 0xff9a3d, 0.6).lineBetween(chefe.x, chefe.y, luva.x, luva.y),
      onComplete: () => {
        aoPegar?.(luva)
        cena.tweens.add({ targets: luva, x: chefe.x, y: chefe.y, duration: 380, ease: 'Quad.easeIn', onUpdate: () => rastro.clear().lineStyle(3, 0xff9a3d, 0.6).lineBetween(chefe.x, chefe.y, luva.x, luva.y), onComplete: () => (luva.destroy(), rastro.destroy()) })
      },
    })
  }

  const posicao = (i, total) => ({ x: chefe.x + (i - (total - 1) / 2) * CARTA.passo, y: chefe.y + CARTA.y })

  function atualizar() {
    const c = chefeEstado()
    const roubadas = c?.roubadas ?? []
    const ids = new Set(roubadas.map((r) => r.carta.id))
    // saíram: recuperada (volta ao dono) ou jogada (a carta virada dela agora é essa)
    for (const [id, o] of objetos) {
      if (ids.has(id)) continue
      objetos.delete(id)
      const jogada = c?.intencao?.roubada?.carta.id === id
      const destino = jogada ? { x: chefe.x, y: chefe.y + 60 } : alvoDe(o.dono)
      if (!jogada) tocar(cena, 'confirmar')
      cena.tweens.add({ targets: o.c, x: destino.x, y: destino.y, scale: jogada ? 1.6 : 1.2, alpha: 0, duration: 520, ease: 'Quad.easeIn', onComplete: () => o.c.destroy() })
    }
    // novas: o roubo (a mão vai até o dono e traz a carta)
    roubadas.forEach((r, i) => {
      const alvo = posicao(i, roubadas.length)
      let o = objetos.get(r.carta.id)
      if (!o) {
        const origem = alvoDe(r.dono) ?? alvo
        o = { c: criarCarta(r.carta, r.dono, origem.x, origem.y).setAlpha(0), dono: r.dono, chegou: false }
        objetos.set(r.carta.id, o)
        maoDaLadra(origem, () => {
          o.c.setAlpha(1)
          o.chegou = true
        })
        return
      }
      if (!o.chegou) {
        // acompanha a luva na volta
        return
      }
      o.c.x += (alvo.x - o.c.x) * 0.25
      o.c.y += (alvo.y - o.c.y) * 0.25
    })
    rotulo.setText(roubadas.length ? `ROUBADAS (${roubadas.length}) · ♣ RECUPERA A ÚLTIMA` : '')
  }

  cena.events.on('update', atualizar)
  const desligar = () => {
    cena.events.off('update', atualizar)
    for (const o of objetos.values()) o.c.destroy()
    objetos.clear()
    rotulo.destroy()
  }
  cena.events.once('shutdown', desligar)
  return { desligar, cartas: () => [...objetos.keys()] }
}
