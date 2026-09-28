import { definirAtaque } from './definir.js'
import { FONTE } from '../constants.js'
import { tocar } from '../audio.js'
import { particulas } from '../effects/particulas.js'

// Bombas com contagem regressiva (3, 2, 1) que explodem num círculo de balas.
// Nascem longe dos corações; a área em volta pisca durante a contagem.
export default definirAtaque({
  nome: 'bombas',
  padrao: { duracao: 6000, intervalo: 1500, contagem: 1200, fragmentos: 8, velocidade: 130, raio: 6, distancia: 70 },
  iniciar(a, cfg) {
    a.aCada(cfg.intervalo, (i) => {
      const p = a.pontoLonge(cfg.distancia, 20)
      const bomba = a.decoracao(a.cena.add.image(p.x, p.y, 'bomba').setDepth(6).setScale(1.2))
      const texto = a.decoracao(
        a.cena.add
          .text(p.x, p.y - 22, '', { fontFamily: FONTE, fontSize: '16px', color: '#ffe040', stroke: '#000000', strokeThickness: 3 })
          .setOrigin(0.5)
          .setDepth(7),
      )
      a.cena.tweens.add({ targets: bomba, scale: 1.4, duration: 150, yoyo: true, repeat: -1 })

      const passos = 3
      for (let k = 0; k < passos; k++) {
        a.depois((cfg.contagem / passos) * k, () => {
          texto.setText(String(passos - k))
          tocar(a.cena, 'aviso')
        })
      }

      a.aviso({ tipo: 'circulo', x: p.x, y: p.y, raio: 26, ms: cfg.contagem }, () => {
        bomba.setVisible(false)
        texto.setVisible(false)
        tocar(a.cena, 'explosao')
        particulas(a.cena, p.x, p.y, { cor: 0xffc040, quantidade: 16, velocidade: 160 })
        for (let k = 0; k < cfg.fragmentos; k++) {
          const ang = (k * Math.PI * 2) / cfg.fragmentos + i * 0.3
          a.bala({
            x: p.x,
            y: p.y,
            vx: Math.cos(ang) * cfg.velocidade,
            vy: Math.sin(ang) * cfg.velocidade,
            raio: cfg.raio,
            forma: a.forma(k),
            girar: 6,
            jaAvisada: true,
          })
        }
      })
    })
  },
})
