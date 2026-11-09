import { PERSONAGENS } from '../data/personagens.js'
import { FONTE, corTexto } from '../constants.js'
import { menosMovimento } from '../preferencias.js'

export const arteElenco = (id, pose = 'base') => `elenco-${id}-${pose}`
export function carregarElenco(cena) {
  for (const id of Object.keys(PERSONAGENS)) for (const pose of ['base', 'guarda']) {
    cena.load.image(arteElenco(id, pose), `assets/sprites/elenco/${id}-${pose}.webp`)
  }
}

// Uma vaga no palco: o pé fica fixo durante a respiração; a pose muda ao confirmar.
export function vagaNoPalco(cena, x, base, altura, legenda, espelho = false) {
  const raio = altura * 0.37
  const luz = cena.add.image(x, base - altura * 0.43, 'brilho').setDisplaySize(raio * 2.6, altura).setAlpha(0.26)
  const plataforma = cena.add.ellipse(x, base - 2, raio * 1.55, 10, 0x101829).setStrokeStyle(1, 0x52889e)
  const figura = cena.add.image(x, base, arteElenco('kris')).setOrigin(0.5, 1).setFlipX(espelho)
  const texto = (y, s, size, color) => cena.add.text(x, y, s, {fontFamily:FONTE,fontSize:size+'px',color,stroke:'#0b1020',strokeThickness:3}).setOrigin(0.5)
  const nome = texto(base+9,'',16,'#fff')
  const estado = texto(base+25,legenda,10,'#b7c8dc')
  let anterior, escala = 1
  return {
    mostrar(id, pronto) {
      const chave = id ? arteElenco(id, pronto ? 'guarda' : 'base') : ''
      if (anterior === chave) return
      anterior = chave
      figura.setVisible(Boolean(id)); luz.setVisible(Boolean(id))
      nome.setText(id ? PERSONAGENS[id].nome.toUpperCase() : '—')
      estado.setText(pronto ? legenda+' · PRONTO' : legenda)
      if (!id) return
      const cor = PERSONAGENS[id].cor
      nome.setColor(corTexto(cor)); luz.setTint(cor); plataforma.setStrokeStyle(1, cor)
      figura.setTexture(chave)
      escala = altura / figura.height
      figura.setScale(escala)
      cena.tweens.killTweensOf(figura)
      figura.setX(x).setAlpha(1)
      if (!menosMovimento()) {
        figura.setX(x + (espelho ? 8 : -8)).setAlpha(0.55)
        cena.tweens.add({targets:figura,x,alpha:1,duration:145,ease:'Quad.easeOut'})
      }
    },
    atualizar(t) {
      const onda = menosMovimento() ? 0 : Math.sin(t / 370 + x)
      figura.setScale(escala * (1 - onda * 0.007), escala * (1 + onda * 0.013))
      figura.setAngle(onda * 0.65)
    },
  }
}
