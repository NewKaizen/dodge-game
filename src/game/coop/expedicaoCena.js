// O MAPA da Expedição (coop/expedicao.js), igual na tela entre as lutas (Expedicao) e na do fim (ExpedicaoFim):
// uma faixa com os 3 nós (LACAIOS -> TENENTE -> CHEFÃO): feito (verde, com "visto"), agora (laranja, pulsando),
// depois (cinza). Na SORTEADA o chefão fica "???" até o time chegar nele.
//   desenharMapaExpedicao(cena, exp, { y, atual, perdeu })   atual: o nó de agora (0..2; 3 = todos feitos)
import { CHEFES } from './chefes/index.js'
import { ETAPAS, NOME_ETAPA } from './expedicao.js'
import { RELIQUIAS } from './reliquias.js'
import { FONTE, LARGURA, TEXTO } from '../constants.js'
import { semLigaduras } from '../campanha/texto.js'

export const NOS_X = [LARGURA / 2 - 180, LARGURA / 2, LARGURA / 2 + 180]

const escrever = (cena, x, y, conteudo, tamanho, cor) =>
  cena.add.text(x, y, semLigaduras(conteudo), { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, align: 'center' }).setOrigin(0.5)

export function desenharMapaExpedicao(cena, exp, { y = 56, atual = 0, perdeu = false, reliquias = true } = {}) {
  cena.add.rectangle(LARGURA / 2, y, 520, 78, 0x0c0a18, 0.85).setStrokeStyle(2, 0x5a4a30)
  const g = cena.add.graphics()
  const yn = y - 10
  g.lineStyle(4, 0x5a4a30, 1).lineBetween(NOS_X[0], yn, NOS_X[2], yn)
  g.lineStyle(4, 0xffa040, 1).lineBetween(NOS_X[0], yn, NOS_X[Math.min(2, atual)], yn)
  ETAPAS.forEach((etapa, k) => {
    const x = NOS_X[k]
    const raio = k === 2 ? 15 : 11
    const feito = k < atual
    const agora = k === atual
    const caiu = agora && perdeu
    g.fillStyle(feito ? 0x3cbf5a : caiu ? 0xc03040 : agora ? 0xffa040 : 0x2a2a3a, 1).fillCircle(x, yn, raio)
    g.lineStyle(2, agora ? 0xffffff : 0x000000, 1).strokeCircle(x, yn, raio)
    // o "visto" e o "x" desenhados (a fonte não tem os caracteres)
    if (feito) g.lineStyle(3, 0xffffff, 1).beginPath().moveTo(x - 6, yn).lineTo(x - 2, yn + 5).lineTo(x + 7, yn - 5).strokePath()
    if (caiu) g.lineStyle(3, 0xffffff, 1).lineBetween(x - 5, yn - 5, x + 5, yn + 5).lineBetween(x - 5, yn + 5, x + 5, yn - 5)
    if (agora && !perdeu) {
      const anel = cena.add.circle(x, yn, raio + 4).setStrokeStyle(2, 0xffa040)
      cena.tweens.add({ targets: anel, scale: 1.5, alpha: 0, duration: 900, repeat: -1 })
    }
    const id = exp.lutas[k]
    const escondido = exp.sorteada && k === 2 && !feito && !agora
    escrever(cena, x, yn + 24, NOME_ETAPA[etapa], 11, caiu ? '#ff8080' : agora ? '#ffc070' : feito ? '#7dd88a' : TEXTO.desabilitado)
    escrever(cena, x, yn + 38, escondido ? '???' : CHEFES[id]?.nome ?? id, 10, TEXTO.normal)
  })
  escrever(cena, LARGURA / 2 - 252, y - 30, 'EXPEDIÇÃO', 11, '#ffc070').setOrigin(0, 0.5)
  if (reliquias && exp.reliquias.length) {
    const nomes = exp.reliquias.map((id) => RELIQUIAS[id]?.nome ?? id).join(' · ')
    escrever(cena, LARGURA / 2, y + 44, `melhorias: ${nomes}`, 10, '#ffe9a0')
  }
}
