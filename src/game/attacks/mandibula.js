import { definirAtaque } from './definir.js'

// MANDÍBULA (campanha, a boca do Silêncio; vale em qualquer modo). A caixa inteira fica vermelha em
// cima e embaixo (o aviso de área) e só sobra uma faixa livre, a GARGANTA; quando o aviso acaba, uma
// fileira de dentes entra por cima e outra por baixo, fecha até a beira da garganta, fica fechada um
// instante (`mordida`) e some. Os dentes ficam colados (não dá para passar entre eles): é ir para a
// garganta antes de fechar.
//
//   garganta   altura da faixa livre (px; no mínimo a lacuna mínima do jogo)
//   aviso      ms da área vermelha antes de fechar (>= ATAQUE.telegrafoMs)
//   mordida    ms com a boca fechada
//   espaco     px entre os centros dos dentes
export default definirAtaque({
  nome: 'mandibula',
  padrao: { duracao: 5000, intervalo: 2200, velocidade: 190, raio: 7, garganta: 52, aviso: 850, mordida: 380, espaco: 20, forma: null, caixa: null },
  iniciar(a, cfg) {
    a.aCada(
      cfg.intervalo,
      () => {
        const l = a.caixa
        const g = Math.max(a.lacunaMinima, Math.min(cfg.garganta, l.height - 40))
        const topoG = l.top + 10 + a.aleatorio(0, Math.max(0, l.height - g - 20))
        const baseG = topoG + g
        a.lacuna(g, 'garganta da mandíbula')
        const fechar = (de) => {
          const l2 = a.caixa
          // a velocidade de verdade (o ritmo e o teto mexem nela): os dentes param na beira da garganta
          const v = Math.min(cfg.velocidade * (a.balas.fatorVelocidade ?? 1), a.balas.velocidadeMax ?? Infinity)
          const y0 = de === 'cima' ? l2.top - cfg.raio - 2 : l2.bottom + cfg.raio + 2
          const alvoY = de === 'cima' ? topoG - cfg.raio : baseG + cfg.raio
          const t = (Math.abs(alvoY - y0) / v) * 1000
          const vy = (de === 'cima' ? 1 : -1) * cfg.velocidade
          for (let x = l2.left + cfg.raio; x <= l2.right - cfg.raio + 0.01; x += cfg.espaco)
            a.bala({ x, y: y0, vy, raio: cfg.raio, entrando: true, arranque: { ms: t, vx: 0, vy: 0 }, vida: t + cfg.mordida, girar: 0, ...(cfg.forma ? { forma: cfg.forma } : {}) })
        }
        a.aviso({ tipo: 'area', x: l.left, y: l.top, largura: l.width, altura: Math.max(1, topoG - l.top), ms: cfg.aviso }, () => fechar('cima'))
        a.aviso({ tipo: 'area', x: l.left, y: baseG, largura: l.width, altura: Math.max(1, l.bottom - baseG), ms: cfg.aviso }, () => fechar('baixo'))
      },
      Infinity,
      300,
    )
  },
})
