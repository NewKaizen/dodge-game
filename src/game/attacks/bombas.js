import { definirAtaque } from './definir.js'
import { FONTE } from '../constants.js'
import { tocar } from '../audio.js'
import { particulas } from '../effects/particulas.js'

// Bombas com contagem regressiva (3, 2, 1) que explodem num círculo de balas.
// A área em volta pisca durante a contagem.
//
//   distancia  bomba comum: nasce pelo menos a essa distância dos corações
//   mirar      fração das bombas que são "plantadas" perto do coração (a
//              `perto` px dele, nunca em cima) com um estilhaço apontado para
//              onde ele estava. Sem isso as bombas nasciam longe e os
//              estilhaços passavam entre o coração parado.
//   perto      distância (px) da bomba plantada até o coração
export default definirAtaque({
  nome: 'bombas',
  padrao: { duracao: 6000, intervalo: 1500, contagem: 1200, fragmentos: 8, velocidade: 130, raio: 6, distancia: 70, mirar: 0.5, perto: 60 },
  iniciar(a, cfg) {
    let mira = 0.5 // acumulador: `mirar` vira um ritmo fixo de bombas plantadas (começa na metade: arredonda)

    // ponto a `perto` px do coração, dentro da caixa (com semente)
    const pontoPerto = (alvo) => {
      const l = a.caixa
      const m = 20
      let melhor = null
      for (let tentativa = 0; tentativa < 12; tentativa++) {
        const ang = a.aleatorio(0, Math.PI * 2)
        const x = alvo.x + Math.cos(ang) * cfg.perto
        const y = alvo.y + Math.sin(ang) * cfg.perto
        const p = { x: Math.min(Math.max(x, l.left + m), l.right - m), y: Math.min(Math.max(y, l.top + m), l.bottom - m) }
        // o ajuste à caixa pode aproximar demais: fica com o mais distante
        const d = Math.hypot(p.x - alvo.x, p.y - alvo.y)
        if (d >= cfg.perto * 0.8) return p
        if (!melhor || d > melhor.d) melhor = { ...p, d }
      }
      return melhor
    }

    a.aCada(cfg.intervalo, (i) => {
      mira += Number(cfg.mirar) || 0
      const plantada = mira >= 1
      if (plantada) mira -= 1
      const alvo = plantada ? a.alvo() : null
      const p = plantada ? pontoPerto(alvo) : a.pontoLonge(cfg.distancia, 20)
      // bomba plantada: o leque gira para um estilhaço sair direto no coração
      const giro = plantada ? Math.atan2(alvo.y - p.y, alvo.x - p.x) : i * 0.3
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
          const ang = (k * Math.PI * 2) / cfg.fragmentos + giro
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
