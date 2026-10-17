import { definirAtaque } from './definir.js'

// Espiral que vira. Identidade: os braços nascem lentos e aceleram para fora
// (ficam densos perto do centro e abrem em leque), e a rotação INVERTE de
// sentido a cada `inverte` ms, com uma pausa curta na virada, desenhando um
// "S" em vez de um redemoinho eterno. Um núcleo brilhante marca o centro
// (é o aviso: acende `nucleo` ms antes do primeiro disparo, sem área piscando)
// e continua aceso enquanto a espiral dispara. O ângulo inicial, o sentido do
// primeiro giro e o tempo de cada giro até virar são sorteados (com semente).
//
//   partida    fração da velocidade final com que a bala sai do centro
//   inverte    ms (médios) entre inversões do giro (cada giro sorteia de 80% a 120%)
//   virada     ms sem disparar na inversão (a virada é o momento de respirar)
//   caixa      a espiral ganha uma arena maior para abrir (aviso antes de mudar)
//   deriva     px/s com que o núcleo desliza em direção ao coração depois de
//              acender (0 = parado no centro). Sem isso, os cantos da caixa
//              ficavam entre os braços e dava para esperar parado.
//   distancia  o núcleo para de se aproximar a essa distância (px) do coração
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
    deriva: 24,
    distancia: 64,
    caixa: { largura: 270, altura: 190 },
  },
  iniciar(a, cfg) {
    // posição do núcleo (muda com a deriva; as balas saem de onde ele estiver)
    let { centerX: x, centerY: y } = a.caixa
    const brilho = a.decoracao(a.cena.add.image(x, y, 'brilho').setTint(a.cor(a.forma(0))).setScale(0.6).setDepth(4))
    a.cena.tweens.add({ targets: brilho, scale: 0.85, duration: 220, yoyo: true, repeat: -1 })

    // v² = v0² + 2·g·d: chega a `velocidade` na borda mais próxima do centro
    const alcance = Math.min(a.caixa.width, a.caixa.height) / 2
    const v0 = cfg.velocidade * cfg.partida
    const aceleracao = (cfg.velocidade ** 2 - v0 ** 2) / (2 * alcance)

    // o núcleo acendendo é o aviso (desenhado à mão): a CPU lê como zona
    a.zonaPerigo({ tipo: 'circulo', x, y, raio: 20 }, { ms: Math.max(400, cfg.nucleo), dura: cfg.nucleo })
    a.depois(Math.max(400, cfg.nucleo), () => {
      // conta em disparos (não em relógio), porque o relógio inclui os respiros da onda
      const passo = cfg.intervalo / a.ritmo.densidade
      const porGiro = () => Math.max(1, Math.round((cfg.inverte * a.aleatorio(0.8, 1.2)) / passo))
      const disparosNaVirada = Math.ceil(cfg.virada / passo)
      let angulo = a.aleatorio(0, Math.PI * 2)
      let sentido = a.aleatorio(0, 1) < 0.5 ? 1 : -1
      let parados = 0
      let proximaVirada = porGiro()

      // deriva: o núcleo (visível, brilhando) persegue devagar o coração, sem
      // chegar mais perto que `distancia`. O alvo é relido a cada 400 ms
      if (cfg.deriva > 0) {
        let alvo = a.alvo()
        a.aCada(400, () => (alvo = a.alvo()))
        a.aoAtualizar((dt) => {
          const dx = alvo.x - x
          const dy = alvo.y - y
          const d = Math.hypot(dx, dy)
          if (d <= cfg.distancia) return
          const passo = Math.min(d - cfg.distancia, (cfg.deriva * dt) / 1000)
          const l = a.caixa
          const m = 24
          x = Math.min(Math.max(x + (dx / d) * passo, l.left + m), l.right - m)
          y = Math.min(Math.max(y + (dy / d) * passo, l.top + m), l.bottom - m)
          brilho.setPosition(x, y)
        })
      }

      a.aCada(cfg.intervalo, (i) => {
        if (i > 0 && i >= proximaVirada) {
          sentido = -sentido
          parados = disparosNaVirada
          proximaVirada = i + porGiro()
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
