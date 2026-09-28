import { definirAtaque } from './definir.js'

// Bolas que nascem no topo (piscando), descem inclinadas e quicam nas
// paredes da caixa `quiques` vezes antes de sair. `gravidade` faz quicar no chão.
export default definirAtaque({
  nome: 'quicantes',
  padrao: { duracao: 6000, intervalo: 1000, velocidade: 150, raio: 8, gravidade: 0, quiques: 4, forma: null },
  iniciar(a, cfg) {
    const l = a.caixa
    a.aCada(cfg.intervalo, (i) => {
      const x = l.left + 20 + ((i * 71) % (l.width - 40))
      const ang = Math.PI / 2 + (i % 2 ? 1 : -1) * a.aleatorio(0.35, 0.8)
      a.bala({
        x,
        y: l.top + cfg.raio + 2,
        vx: Math.cos(ang) * cfg.velocidade,
        vy: Math.sin(ang) * cfg.velocidade,
        ay: cfg.gravidade,
        quicar: cfg.quiques,
        raio: cfg.raio,
        forma: cfg.forma ?? a.forma(i),
        girar: 5,
      })
    })
  },
})
