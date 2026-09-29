import { definirAtaque } from './definir.js'

// Rajada rastreadora. Identidade: em vez de um tiro solto, vêm `rajada` tiros
// em sequência rápida (tá-tá-tá) e depois uma calmaria. Cada tiro mira onde o
// coração está NAQUELE instante (então ficar parado é punido, e andar em
// linha reta é seguro) e sai da borda mais distante dele, alternando os
// lados. Uma linha pisca mostrando a direção antes de a bala valer.
//
//   rajada     tiros por rajada
//   cadencia   ms entre os tiros da rajada
//   caixa      a rajada acontece numa arena quadrada, com espaço para a mira (aviso antes de mudar)
//
// `intervalo` continua sendo o tempo médio entre tiros: a rajada inteira
// dura `rajada × intervalo`, então a quantidade de balas por segundo não muda.
export default definirAtaque({
  nome: 'aimed',
  padrao: { duracao: 5000, intervalo: 800, velocidade: 140, raio: 7, aviso: 550, rajada: 3, cadencia: 260, caixa: { largura: 190, altura: 190 } },
  iniciar(a, cfg) {
    const l = a.caixa
    const m = cfg.raio + 2

    const atirar = (i) => {
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
    }

    let disparos = 0
    a.aCada(
      cfg.intervalo * cfg.rajada,
      () => {
        for (let k = 0; k < cfg.rajada; k++) {
          const n = disparos++
          if (k === 0) atirar(n)
          else a.depois(k * cfg.cadencia, () => atirar(n))
        }
      },
      Infinity,
      300,
    )
  },
})
