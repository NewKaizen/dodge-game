import { definirAtaque } from './definir.js'

// Chuva: as balas piscam no topo da caixa (aviso) e caem. As posições saem
// de colunas fixas (sorteadas com semente) para o padrão ficar legível.
export default definirAtaque({
  nome: 'rain',
  padrao: { duracao: 5000, intervalo: 220, velocidade: 140, raio: 6, girar: 3, forma: null },
  iniciar(a, cfg) {
    const largura = 30
    const colunas = Math.floor(a.caixa.width / largura)
    a.aCada(cfg.intervalo, (i) => {
      a.bala({
        x: a.caixa.left + largura / 2 + a.inteiro(0, colunas - 1) * largura,
        y: a.caixa.top + cfg.raio + 2,
        vy: cfg.velocidade,
        raio: cfg.raio,
        girar: cfg.girar,
        forma: cfg.forma ?? a.forma(i),
      })
    })
  },
})
