import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// SINAL NO COMPASSO da Queen (dificuldade do CO-OP). Um roteador no alto do quadro solta anéis de sinal que se
// espalham devagar. Os anéis só MACHUCAM NA BATIDA: entre as batidas eles ficam apagados e dá para atravessar;
// a cada `batida` ms eles ACENDEM por `acesa` ms. O roteador pisca e faz tique antes de cada batida. Quem lê o
// ritmo atravessa os anéis apagados e fica no vão entre dois anéis quando eles acendem.
//
// Justiça: os anéis nascem no roteador (longe dos corações) e só valem acesos; o tique e o brilho do roteador
// avisam `aviso` ms antes de cada batida (mín. 300 de anel apagado antes de acender); entre dois anéis seguidos
// há pelo menos `velocidade` x `emite` px (bem mais que LACUNA_MINIMA).
//
//   emite       ms entre um anel e o próximo
//   batida      ms entre as batidas · acesa  ms de cada batida
//   velocidade  px/s com que o anel cresce
//   pontos      quantas contas formam o anel (a distância entre elas cresce com o raio)
//   roteadores  1 ou 2 (o segundo no outro canto, anéis alternados)
export default definirAtaque({
  nome: 'queenPulso',
  padrao: { duracao: 7000, emite: 1300, batida: 700, acesa: 200, aviso: 300, velocidade: 80, pontos: 30, raio: 5, roteadores: 1 },
  iniciar(a, cfg) {
    const l0 = a.caixa
    const fontes = cfg.roteadores >= 2 ? [{ x: l0.left + 40, y: l0.top + 6 }, { x: l0.right - 40, y: l0.top + 6 }] : [{ x: l0.centerX + a.aleatorio(-60, 60), y: l0.top + 6 }]
    a.lacuna(cfg.velocidade * (cfg.emite / 1000) - cfg.raio * 2, 'entre dois anéis de sinal')
    const contas = []
    const g = a.decoracao(a.cena.add.graphics().setDepth(7))
    let relogio = 0
    let ultimaBatida = -1
    const acesa = () => relogio % cfg.batida < cfg.acesa
    a.aoAtualizar((dt) => {
      relogio += dt // (a batida não acelera com o ritmo: o compasso é sempre o mesmo)
      const on = acesa()
      const n = Math.floor(relogio / cfg.batida)
      if (n !== ultimaBatida) {
        ultimaBatida = n
        tocar(a.cena, 'contador')
      }
      const falta = cfg.batida - (relogio % cfg.batida)
      for (const c of contas) {
        if (c.b.morta) continue
        c.b.inofensiva = !on
        c.b.sprite.setAlpha(on ? 1 : falta < cfg.aviso ? 0.55 : 0.22)
      }
      // o roteador: brilha antes da batida
      if (!g.scene) return
      g.clear()
      for (const f of fontes) {
        const brilho = on ? 1 : falta < cfg.aviso ? 0.8 : 0.35
        g.fillStyle(0x40f0ff, brilho).fillRect(f.x - 12, f.y - 4, 24, 8)
        g.lineStyle(2, 0x40f0ff, brilho)
        for (let k = 1; k <= 3; k++) {
          g.beginPath()
          g.arc(f.x, f.y, 6 + k * 6, 0.35, Math.PI - 0.35)
          g.strokePath()
        }
      }
      for (let i = contas.length - 1; i >= 0; i--) if (contas[i].b.morta) contas.splice(i, 1)
    })
    a.aCadaEvento(
      cfg.emite,
      (i) => {
        const f = fontes[i % fontes.length]
        const giro = a.aleatorio(0, (Math.PI * 2) / cfg.pontos)
        for (let k = 0; k < cfg.pontos; k++) {
          const ang = giro + (k / cfg.pontos) * Math.PI * 2
          const b = a.bala({ x: f.x, y: f.y, vx: Math.cos(ang) * cfg.velocidade, vy: Math.sin(ang) * cfg.velocidade, raio: cfg.raio, forma: 'hex', cor: 0x40f0ff, jaAvisada: true, pulso: 0 })
          b.inofensiva = !acesa()
          contas.push({ b })
        }
      },
      Infinity,
      100,
    )
  },
})
