import { definirAtaque } from './definir.js'

// Forcado. Identidade: três dentes paralelos que entram pela lateral numa
// estocada, param lá dentro por um instante e voltam. O dente do meio mira a
// fileira do coração, então o jeito é se enfiar NO VÃO entre os dentes (ou
// fugir para cima/baixo). As três linhas piscam antes.
//
//   dentes       quantidade de dentes
//   vao          distância entre dentes (px); o vão livre é vao - espessura
//   alcance      até onde a ponta entra (fração da largura da caixa)
//   parada       ms parado lá dentro antes de voltar
export default definirAtaque({
  nome: 'forcado',
  padrao: { duracao: 5500, intervalo: 1500, velocidade: 360, comprimento: 170, espessura: 9, dentes: 3, vao: 64, alcance: 0.8, parada: 260, aviso: 600, forma: 'barra' },
  iniciar(a, cfg) {
    a.aCada(
      cfg.intervalo,
      (i) => {
        const l = a.caixa
        const daEsquerda = i % 2 === 0
        const dir = daEsquerda ? 1 : -1
        const meio = (cfg.dentes - 1) / 2
        const margem = cfg.espessura
        // se os dentes não cabem na caixa, aperta o vão (o validador avisa se ficar estreito demais)
        const vao = cfg.dentes > 1 ? Math.min(cfg.vao, (l.height - 2 * margem) / (cfg.dentes - 1)) : 0
        // centraliza no coração, mas mantém todos os dentes dentro da caixa
        const extensao = meio * vao
        const yc = Math.min(Math.max(a.alvo().y, l.top + margem + extensao), l.bottom - margem - extensao)
        const ys = Array.from({ length: cfg.dentes }, (_, k) => yc + (k - meio) * vao)
        a.parede({ eixo: 'y', ocupados: ys.map((y) => [y - cfg.espessura / 2, y + cfg.espessura / 2]) })

        const inicioX = daEsquerda ? l.left - cfg.comprimento / 2 : l.right + cfg.comprimento / 2
        const pontaAlvo = daEsquerda ? l.left + l.width * cfg.alcance : l.right - l.width * cfg.alcance
        const paradaX = pontaAlvo - (dir * cfg.comprimento) / 2

        for (const y of ys) {
          a.aviso({ tipo: 'linha', x1: l.left, y1: y, x2: l.right, y2: y, espessura: cfg.espessura, ms: cfg.aviso }, () => {
            let estado = 'entrando'
            let parado = 0
            a.bala({
              x: inicioX,
              y,
              vx: dir * cfg.velocidade,
              largura: cfg.comprimento,
              altura: cfg.espessura,
              forma: cfg.forma,
              jaAvisada: true,
              atualizar: (b, dt) => {
                if (estado === 'entrando' && (b.x - paradaX) * dir >= 0) {
                  b.x = paradaX
                  b.vx = 0
                  estado = 'parado'
                } else if (estado === 'parado' && (parado += dt) >= cfg.parada) {
                  b.vx = -dir * cfg.velocidade * 0.6
                  estado = 'voltando'
                }
              },
            })
          })
        }
      },
      Infinity,
      300,
    )
  },
})
