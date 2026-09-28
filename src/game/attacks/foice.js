import { definirAtaque } from './definir.js'

// Foice de duas lâminas girando e atravessando a caixa. Cada varrida cobre
// só a faixa de cima ou a de baixo (a faixa pisca antes); a outra faixa,
// de pelo menos 3x o coração, fica segura.
export default definirAtaque({
  nome: 'foice',
  padrao: { duracao: 6000, varridas: 3, alcance: 100, espessura: 8, giro: 3, aviso: 700, travessia: 1800 },
  iniciar(a, cfg) {
    const l = a.caixa
    const alcance = Math.min(cfg.alcance, l.height - a.lacunaMinima - cfg.espessura)
    // a ponta da lâmina também respeita a velocidade máxima da dificuldade
    const giro = Math.min(cfg.giro, a.balas.velocidadeMax / alcance)
    const distancia = l.width + 2 * alcance
    const velocidade = distancia / (cfg.travessia / 1000)
    const efetiva = Math.min(velocidade * a.balas.fatorVelocidade, a.balas.velocidadeMax)
    const tempoVarrida = cfg.aviso + (distancia / efetiva) * 1000

    for (let k = 0; k < cfg.varridas; k++) {
      a.depois(k * tempoVarrida, () => {
        const emCima = k % 2 === 0
        const daEsquerda = Math.floor(k / 2) % 2 === 0
        const y = emCima ? l.top : l.bottom
        const faixa = emCima ? [l.top, l.top + alcance + cfg.espessura / 2] : [l.bottom - alcance - cfg.espessura / 2, l.bottom]
        a.parede({ eixo: 'y', ocupados: [faixa] })

        a.aviso({ tipo: 'area', x: l.left, y: faixa[0], largura: l.width, altura: faixa[1] - faixa[0], ms: cfg.aviso }, () => {
          a.bala({
            x: daEsquerda ? l.left - alcance : l.right + alcance,
            y,
            vx: (daEsquerda ? 1 : -1) * velocidade,
            comprimento: alcance * 2,
            espessura: cfg.espessura,
            girar: emCima ? giro : -giro,
            forma: 'foice',
            atravessa: true,
            jaAvisada: true,
            pulso: 0,
          })
        })
      })
    }
  },
})
