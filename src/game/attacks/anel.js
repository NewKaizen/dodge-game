import { definirAtaque } from './definir.js'

// Anel (elipse do tamanho da caixa) que fecha em direção ao centro, com uma
// abertura. O anel nasce FORA da caixa (uma elipse maior, que contém a caixa
// inteira) e vem fechando: as balas entram pelas bordas, e essa entrada é o
// aviso (nada pisca parado). Ao passar pelo tamanho da caixa ele já anda na
// velocidade de antes; o tempo extra de fora substitui o pisca-pisca.
//
//   mirar   quanto o centro do anel se desloca do meio da caixa em direção ao
//           coração (0 = sempre no meio, 1 = centrado no coração). Com o anel
//           sempre no meio, os cantos ficavam fora dele e dava para esperar
//           parado. O vão é sorteado dentro da caixa (alcançável) e de lado em
//           relação ao coração: nem em cima dele (aí bastaria ficar parado)
//           nem do outro lado do anel (longe demais para chegar a tempo).
//   aviso   ms mínimos entre o anel nascer e chegar ao tamanho da caixa
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

      // k0: escala em que a elipse contém a caixa inteira (todas as balas nascem
      // fora); limitada para nenhuma nascer longe demais (balas a 160 px somem)
      const cantos = [
        [l.left, l.top],
        [l.right, l.top],
        [l.left, l.bottom],
        [l.right, l.bottom],
      ]
      const k0 = Math.min(1.75, Math.max(1.08, 1.04 * Math.max(...cantos.map(([x, y]) => Math.hypot((x - cx) / rx, (y - cy) / ry)))))
      // tempo total: mais rápido que antes por dentro da caixa, mas com o
      // trecho de fora no lugar do pisca-pisca (e pelo menos `aviso` até a caixa)
      const total = Math.max(cfg.tempoFechar * (1 + 0.6 * (k0 - 1)), (cfg.aviso * k0) / (k0 - 1))
      const s = total / 1000

      const passo = (Math.PI * 2 - cfg.abertura) / (cfg.quantidade - 1)
      for (let k = 0; k < cfg.quantidade; k++) {
        const ang = vao + cfg.abertura / 2 + k * passo
        const x = cx + Math.cos(ang) * rx * k0
        const y = cy + Math.sin(ang) * ry * k0
        // se o limite de k0 deixou alguma bala dentro da caixa (centro muito
        // puxado para um canto), ela fica de fora: só abre mais espaço, longe do coração
        if (x > l.left && x < l.right && y > l.top && y < l.bottom) continue
        a.bala({
          x,
          y,
          vx: (cx - x) / s,
          vy: (cy - y) / s,
          // some quando o anel chega a 12% do tamanho da caixa (como antes)
          vida: total * ((k0 - 0.12) / k0),
          raio: cfg.raio,
          forma: cfg.forma ?? a.forma(i),
          girar: 3,
          entrando: true,
        })
      }
    })
  },
})
