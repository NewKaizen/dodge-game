import { definirAtaque } from './definir.js'

// Espiral saindo do centro da caixa. Um núcleo brilhante marca o centro
// (aviso) e continua aceso enquanto a espiral dispara.
export default definirAtaque({
  nome: 'spiral',
  padrao: { duracao: 6000, bracos: 3, intervalo: 150, velocidade: 100, giro: 0.32, raio: 5, nucleo: 600 },
  iniciar(a, cfg) {
    const { centerX: x, centerY: y } = a.caixa
    const brilho = a.decoracao(a.cena.add.image(x, y, 'brilho').setTint(a.cor(a.forma(0))).setScale(0.6).setDepth(4))
    a.cena.tweens.add({ targets: brilho, scale: 0.85, duration: 220, yoyo: true, repeat: -1 })

    a.aviso({ tipo: 'circulo', x, y, raio: 20, ms: cfg.nucleo }, () => {
      let angulo = 0
      a.aCada(cfg.intervalo, () => {
        for (let k = 0; k < cfg.bracos; k++) {
          const ang = angulo + (k * Math.PI * 2) / cfg.bracos
          a.bala({
            x,
            y,
            vx: Math.cos(ang) * cfg.velocidade,
            vy: Math.sin(ang) * cfg.velocidade,
            raio: cfg.raio,
            forma: a.forma(k),
            girar: 4,
            jaAvisada: true,
          })
        }
        angulo += cfg.giro
      })
    })
  },
})
