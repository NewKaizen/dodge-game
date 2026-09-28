import { definirAtaque } from './definir.js'

// Balas que nascem na borda mais longe de um coração, piscam mostrando a
// direção e então disparam nele (alternando entre os jogadores)
export default definirAtaque({
  nome: 'aimed',
  padrao: { duracao: 5000, intervalo: 800, velocidade: 140, raio: 7, aviso: 550 },
  iniciar(a, cfg) {
    const l = a.caixa
    const m = cfg.raio + 2
    a.aCada(cfg.intervalo, (i) => {
      const alvo = a.alvo()
      const lados = [
        ['top', alvo.y - l.top],
        ['bottom', l.bottom - alvo.y],
        ['left', alvo.x - l.left],
        ['right', l.right - alvo.x],
      ].sort((p, q) => q[1] - p[1])
      const lado = lados[i % 2][0]
      const t = a.aleatorio(0.15, 0.85)
      const origem = {
        top: { x: l.left + t * l.width, y: l.top + m },
        bottom: { x: l.left + t * l.width, y: l.bottom - m },
        left: { x: l.left + m, y: l.top + t * l.height },
        right: { x: l.right - m, y: l.top + t * l.height },
      }[lado]
      const dir = Math.atan2(alvo.y - origem.y, alvo.x - origem.x)

      a.aviso({
        tipo: 'linha',
        x1: origem.x,
        y1: origem.y,
        x2: origem.x + Math.cos(dir) * 50,
        y2: origem.y + Math.sin(dir) * 50,
        espessura: 2,
        ms: cfg.aviso,
      })
      a.bala({
        x: origem.x,
        y: origem.y,
        vx: Math.cos(dir) * cfg.velocidade,
        vy: Math.sin(dir) * cfg.velocidade,
        raio: cfg.raio,
        aviso: cfg.aviso,
        girar: 5,
      })
    })
  },
})
