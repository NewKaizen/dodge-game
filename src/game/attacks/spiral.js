import { definirAtaque } from './definir.js'

// Espiral que vira. Identidade: os braços nascem lentos e aceleram para fora
// (ficam densos perto do centro e abrem em leque), e a rotação INVERTE de
// sentido a cada `inverte` ms, com uma pausa curta na virada, desenhando um
// "S" em vez de um redemoinho eterno. Um núcleo brilhante marca o centro
// (aviso) e continua aceso enquanto a espiral dispara.
//
//   partida    fração da velocidade final com que a bala sai do centro
//   inverte    ms entre inversões do giro
//   virada     ms sem disparar na inversão (a virada é o momento de respirar)
//   caixa      a espiral ganha uma arena maior para abrir (aviso antes de mudar)
export default definirAtaque({
  nome: 'spiral',
  padrao: {
    duracao: 6000,
    bracos: 3,
    intervalo: 150,
    velocidade: 100,
    giro: 0.32,
    raio: 5,
    nucleo: 600,
    partida: 0.55,
    inverte: 2200,
    virada: 350,
    caixa: { largura: 270, altura: 190 },
  },
  iniciar(a, cfg) {
    const { centerX: x, centerY: y } = a.caixa
    const brilho = a.decoracao(a.cena.add.image(x, y, 'brilho').setTint(a.cor(a.forma(0))).setScale(0.6).setDepth(4))
    a.cena.tweens.add({ targets: brilho, scale: 0.85, duration: 220, yoyo: true, repeat: -1 })

    // v² = v0² + 2·g·d: chega a `velocidade` na borda mais próxima do centro
    const alcance = Math.min(a.caixa.width, a.caixa.height) / 2
    const v0 = cfg.velocidade * cfg.partida
    const aceleracao = (cfg.velocidade ** 2 - v0 ** 2) / (2 * alcance)

    a.aviso({ tipo: 'circulo', x, y, raio: 20, ms: cfg.nucleo }, () => {
      // conta em disparos (não em relógio), porque o relógio inclui os respiros da onda
      const passo = cfg.intervalo / a.ritmo.densidade
      const disparosPorGiro = Math.max(1, Math.round(cfg.inverte / passo))
      const disparosNaVirada = Math.ceil(cfg.virada / passo)
      let angulo = 0
      let sentido = 1
      let parados = 0

      a.aCada(cfg.intervalo, (i) => {
        if (i > 0 && i % disparosPorGiro === 0) {
          sentido = -sentido
          parados = disparosNaVirada
        }
        if (parados > 0) {
          parados--
          return
        }

        for (let k = 0; k < cfg.bracos; k++) {
          const ang = angulo + (k * Math.PI * 2) / cfg.bracos
          const cos = Math.cos(ang)
          const sin = Math.sin(ang)
          a.bala({
            x,
            y,
            vx: cos * v0,
            vy: sin * v0,
            ax: cos * aceleracao,
            ay: sin * aceleracao,
            raio: cfg.raio,
            forma: a.forma(k),
            girar: 4,
            jaAvisada: true,
          })
        }
        angulo += cfg.giro * sentido
      })
    })
  },
})
