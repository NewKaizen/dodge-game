import { definirAtaque } from './definir.js'

// Anel (elipse do tamanho da caixa) que fecha em direção ao centro, com uma
// abertura. O anel pisca parado antes de fechar.
//
//   mirar   quanto o centro do anel se desloca do meio da caixa em direção ao
//           coração (0 = sempre no meio, 1 = centrado no coração). Com o anel
//           sempre no meio, os cantos ficavam fora dele e dava para esperar
//           parado. O vão é sorteado dentro da caixa (alcançável) e de lado em
//           relação ao coração: nem em cima dele (aí bastaria ficar parado)
//           nem do outro lado do anel (longe demais para chegar a tempo).
export default definirAtaque({
  nome: 'anel',
  padrao: { duracao: 6000, intervalo: 2000, quantidade: 24, abertura: 1.0, tempoFechar: 1400, aviso: 600, raio: 7, forma: null, mirar: 0.35 },
  iniciar(a, cfg) {
    const l = a.caixa
    const rx = l.width / 2 - 8
    const ry = l.height / 2 - 8
    a.lacuna(cfg.abertura * Math.min(rx, ry), 'abertura do anel')

    a.aCada(cfg.intervalo, (i) => {
      // centro puxado em direção ao coração
      const alvo = a.alvo()
      const f = Math.min(1, Math.max(0, Number(cfg.mirar) || 0))
      const cx = l.centerX + (alvo.x - l.centerX) * f
      const cy = l.centerY + (alvo.y - l.centerY) * f

      // vão dentro da caixa (no começo e na metade do fechamento)
      const dentro = (ang, k) => {
        const x = cx + Math.cos(ang) * rx * k
        const y = cy + Math.sin(ang) * ry * k
        return x > l.left + 12 && x < l.right - 12 && y > l.top + 12 && y < l.bottom - 12
      }
      // ângulo do coração no anel (coordenadas da elipse); no centro exato, qualquer um
      const perto = Math.hypot((alvo.x - cx) / rx, (alvo.y - cy) / ry) < 0.15
      const angCoracao = Math.atan2((alvo.y - cy) / ry, (alvo.x - cx) / rx)
      const sortear = () =>
        perto || f === 0 ? a.aleatorio(0, Math.PI * 2) : angCoracao + (a.aleatorio(0, 1) < 0.5 ? 1 : -1) * a.aleatorio(0.9, 2.0)
      let vao = sortear()
      for (let tentativa = 0; tentativa < 16 && !(dentro(vao, 1) && dentro(vao, 0.5)); tentativa++) vao = sortear()

      const passo = (Math.PI * 2 - cfg.abertura) / (cfg.quantidade - 1)
      for (let k = 0; k < cfg.quantidade; k++) {
        const ang = vao + cfg.abertura / 2 + k * passo
        const x = cx + Math.cos(ang) * rx
        const y = cy + Math.sin(ang) * ry
        const s = cfg.tempoFechar / 1000
        a.bala({
          x,
          y,
          vx: (cx - x) / s,
          vy: (cy - y) / s,
          vida: cfg.tempoFechar * 0.88,
          raio: cfg.raio,
          forma: cfg.forma ?? a.forma(i),
          aviso: cfg.aviso,
          girar: 3,
        })
      }
    })
  },
})
