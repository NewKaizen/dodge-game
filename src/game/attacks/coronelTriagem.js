import { definirAtaque } from './definir.js'
import { FONTE } from '../constants.js'

// TRIAGEM do Coronel Caçamba (dificuldade do CO-OP). A caixa vira TRÊS colunas de coleta seletiva, cada uma com
// a sua cor no chão e o nome no alto: PAPEL (azul), METAL (amarelo) e PLÁSTICO (vermelho). Cai lixo das três
// cores, e cada pedaço anda de lado enquanto cai. O lixo só MACHUCA quando está numa coluna de OUTRA cor: na
// coluna da cor dele fica apagado e inofensivo (foi separado certo). Quando atravessa a linha para a coluna
// errada, acende e passa a valer. Dá para ficar embaixo do lixo "certo" e fugir do "errado".
//
// Justiça: tudo entra pelo alto (a entrada é o aviso); acender ao trocar de coluna leva `acende` ms (pisca antes
// de valer); a coluna e a cor são as mesmas nos dois PCs (semente).
//
//   intervalo   ms entre um lixo e o próximo
//   velocidade  px/s da queda
//   deriva      px/s máximos de lado
//   certo       fração dos lixos que nascem na coluna da cor deles (o resto nasce numa errada)
//   acende      ms que o lixo pisca antes de valer quando entra numa coluna errada
const CORES = [0x4aa8ff, 0xffd23c, 0xff5a5a]
const NOMES = ['PAPEL', 'METAL', 'PLÁSTICO']
const FORMAS = ['losango', 'hex', 'bola']

export default definirAtaque({
  nome: 'coronelTriagem',
  padrao: { duracao: 6500, intervalo: 420, velocidade: 95, deriva: 55, certo: 0.4, acende: 260, raio: 8 },
  iniciar(a, cfg) {
    const colunaDe = (x) => {
      const l = a.caixa
      return Math.min(2, Math.max(0, Math.floor(((x - l.left) / l.width) * 3)))
    }
    // as três colunas: o chão pintado e o nome
    const g = a.decoracao(a.cena.add.graphics().setDepth(2))
    const rotulos = NOMES.map((n, i) => a.decoracao(a.cena.add.text(0, 0, n, { fontFamily: FONTE, fontSize: '10px', color: '#' + CORES[i].toString(16).padStart(6, '0'), stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(8)))
    const lixos = []
    a.aoAtualizar((dt) => {
      const l = a.caixa
      if (g.scene) {
        g.clear()
        for (let i = 0; i < 3; i++) {
          g.fillStyle(CORES[i], 0.13).fillRect(l.left + (l.width * i) / 3, l.top, l.width / 3, l.height)
          g.fillStyle(CORES[i], 0.5).fillRect(l.left + (l.width * i) / 3, l.bottom - 6, l.width / 3, 6)
          rotulos[i].setPosition(l.left + (l.width * (i + 0.5)) / 3, l.top + 9)
        }
        g.lineStyle(2, 0xffffff, 0.35)
        for (let i = 1; i < 3; i++) g.lineBetween(l.left + (l.width * i) / 3, l.top, l.left + (l.width * i) / 3, l.bottom)
      }
      // o lixo acende (vale) só fora da coluna da cor dele
      for (const z of lixos) {
        const b = z.b
        if (b.morta || b.idade < b.aviso) continue
        const errado = colunaDe(b.x) !== z.cor
        if (errado) z.errado += dt
        else z.errado = 0
        const vale = z.errado >= cfg.acende
        b.inofensiva = !vale
        b.piscar = errado && !vale
        if (!errado) b.sprite.setAlpha(0.32)
        else if (vale) b.sprite.setAlpha(1)
      }
    })
    let certo = a.aleatorio(0, 1)
    a.aCada(
      cfg.intervalo,
      () => {
        const l = a.caixa
        const cor = a.inteiro(0, 2)
        certo += cfg.certo
        const naCerta = certo >= 1
        if (naCerta) certo -= 1
        const col = naCerta ? cor : (cor + a.inteiro(1, 2)) % 3
        const x = l.left + (l.width * (col + a.aleatorio(0.15, 0.85))) / 3
        const b = a.bala({
          x,
          y: l.top - cfg.raio - 6,
          vx: a.aleatorio(-1, 1) * cfg.deriva,
          vy: cfg.velocidade * a.aleatorio(0.85, 1.15),
          raio: cfg.raio,
          forma: FORMAS[cor],
          cor: CORES[cor],
          girar: 3,
          pulso: 0.05,
          entrando: true,
          atualizar: (bb) => {
            const lc = a.caixa
            if (bb.x - bb.raio < lc.left && bb.vx < 0) bb.vx = Math.abs(bb.vx)
            else if (bb.x + bb.raio > lc.right && bb.vx > 0) bb.vx = -Math.abs(bb.vx)
          },
        })
        // nasce na coluna certa: já começa apagado
        const z = { b, cor, errado: 0 }
        if (!naCerta) z.errado = cfg.acende
        lixos.push(z)
        for (let i = lixos.length - 1; i >= 0; i--) if (lixos[i].b.morta) lixos.splice(i, 1)
      },
      Infinity,
      250,
    )
  },
})
