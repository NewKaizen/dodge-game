import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// MÃOS DA SOMBRA da Escuridão (boss semanal). Uma poça de breu borbulha na borda da caixa, na linha de um
// coração, e a faixa por onde a mão vai passar acende em roxo; depois a MÃO sai da poça, estica pela faixa até
// `alcance` da caixa, abre os dedos (os dedos voam devagar para os lados) e volta para a poça.
//
// No escuro (coop/semanal/escuridao.js) as balas ficam escondidas, mas o AVISO brilha por cima do breu
// (profundidade AVISO_NO_ESCURO): a poça e a faixa são a luz da própria sombra. As balas soam como tambor
// (pistas.js TIMBRES).
//
// Justiça: a faixa acende `aviso` ms antes (mín. 700) e é exatamente onde o braço passa; a mão nunca chega na
// borda do outro lado (alcance < 1) e a faixa ocupa `largura` px (a caixa sobra muito mais que LACUNA_MINIMA);
// com `maos` 2 as duas saem de bordas diferentes. Os dedos nascem na ponta, dentro da faixa avisada.
//
//   intervalo   ms entre uma mão e a próxima (alterna os corações)
//   alcance     fração da caixa que o braço cobre (0..1)
//   velocidade  px/s do braço esticando · segura  ms parado antes de voltar
//   maos        mãos por vez (1 ou 2) · dedos  quantos dedos voam da ponta (0 = nenhum)
export const AVISO_NO_ESCURO = 9.55 // acima do breu da Escuridão (9.5), abaixo do brilho do meu coração
export default definirAtaque({
  nome: 'escuridaoMaos',
  padrao: { duracao: 6500, intervalo: 1500, aviso: 800, largura: 26, alcance: 0.78, velocidade: 300, segura: 380, raio: 7, maos: 1, dedos: 3, velocidadeDedo: 85 },
  iniciar(a, cfg) {
    const aviso = Math.max(700, cfg.aviso)
    const passo = cfg.raio * 1.7
    a.lacuna(Math.min(a.caixa.width, a.caixa.height) - cfg.largura, 'ao lado da faixa da mão')

    const mao = (lado, alvo) => {
      const l = a.caixa
      const vertical = lado === 'bottom' || lado === 'top'
      const m = cfg.largura / 2 + 4
      // a linha da mão: na coluna (vertical) ou na altura (horizontal) do coração
      const linha = vertical ? Math.min(l.right - m, Math.max(l.left + m, alvo.x)) : Math.min(l.bottom - m, Math.max(l.top + m, alvo.y))
      const comprimento = (vertical ? l.height : l.width) * cfg.alcance
      const dir = lado === 'bottom' || lado === 'right' ? -1 : 1
      const base = lado === 'bottom' ? l.bottom : lado === 'top' ? l.top : lado === 'right' ? l.right : l.left
      const ponto = (d) => (vertical ? { x: linha, y: base + dir * d } : { x: base + dir * d, y: linha })
      const area = vertical
        ? { tipo: 'area', x: linha - cfg.largura / 2, y: dir > 0 ? base : base - comprimento, largura: cfg.largura, altura: comprimento }
        : { tipo: 'area', x: dir > 0 ? base : base - comprimento, y: linha - cfg.largura / 2, largura: comprimento, altura: cfg.largura }
      const estica = (comprimento / cfg.velocidade) * 1000
      a.zonaPerigo(area, { ms: aviso, dura: estica + cfg.segura + 250 })

      // o aviso: a poça na borda e a faixa acendendo (brilham por cima do escuro)
      const g = a.decoracao(a.cena.add.graphics().setDepth(AVISO_NO_ESCURO))
      let t = 0
      a.aoAtualizar((dt) => {
        if (!g.scene || t > aviso) return
        t += dt
        g.clear()
        if (t > aviso) return
        const f = Math.min(1, t / aviso)
        g.fillStyle(0x8a7cff, 0.1 + 0.18 * f).fillRect(area.x, area.y, area.largura, area.altura)
        g.lineStyle(1.5, 0xb8b0ff, 0.35 + 0.4 * f).strokeRect(area.x, area.y, area.largura, area.altura)
        // a poça borbulhando na borda
        const p = ponto(0)
        const bolha = 3 + 2 * Math.sin(t / 70)
        g.fillStyle(0x0b0918, 0.95).fillEllipse(p.x, p.y, vertical ? cfg.largura + 10 : 12, vertical ? 12 : cfg.largura + 10)
        g.fillStyle(0xb8b0ff, 0.9).fillCircle(p.x - 5, p.y, bolha * 0.7).fillCircle(p.x + 5, p.y, bolha * 0.6)
        g.fillStyle(0xff4a6a, 0.6 + 0.4 * f).fillCircle(p.x - 3, p.y, 1.6).fillCircle(p.x + 3, p.y, 1.6)
      })

      a.depois(aviso, () => {
        tocar(a.cena, 'abismo')
        a.tremer(90, 0.006)
        const n = Math.max(1, Math.floor(comprimento / passo))
        const braco = []
        for (let k = 0; k < n; k++) {
          // cada pedaço do braço aparece quando a ponta passa por ele (o braço estica)
          a.depois((k * passo * 1000) / cfg.velocidade, () => {
            const p = ponto(passo * (k + 0.5))
            braco.push(a.bala({ ...p, raio: k === n - 1 ? cfg.raio + 2 : cfg.raio, forma: 'bola', cor: k === n - 1 ? 0xd8d0ff : 0x8a7cff, jaAvisada: true, atravessa: true, pulso: 0.04 }))
          })
        }
        // a ponta abre os dedos e o braço volta (some da ponta para a base)
        a.depois(estica + cfg.segura, () => {
          const ponta = ponto(comprimento - cfg.raio)
          for (let k = 0; k < cfg.dedos; k++) {
            const abre = cfg.dedos > 1 ? k / (cfg.dedos - 1) - 0.5 : 0
            const ang = (vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI) + abre * 1.8
            a.bala({ x: ponta.x, y: ponta.y, vx: Math.cos(ang) * cfg.velocidadeDedo, vy: Math.sin(ang) * cfg.velocidadeDedo, raio: 5, forma: 'losango', cor: 0xb8b0ff, jaAvisada: true, girar: 4 })
          }
          ;[...braco].reverse().forEach((b, k) => a.depois(k * 22, () => (b.morta = true)))
        })
      })
    }

    let alterna = 0
    a.aCadaEvento(
      cfg.intervalo,
      () => {
        const lados = ['bottom', 'left', 'right']
        const lado = lados[(alterna + a.inteiro(0, 2)) % 3]
        alterna++
        mao(lado, a.alvo())
        if (cfg.maos >= 2) {
          // a segunda: de outra borda, no outro coração
          const outro = lado === 'bottom' ? a.escolher(['left', 'right']) : 'bottom'
          a.depois(260, () => mao(outro, a.alvo()))
        }
      },
      Infinity,
      300,
    )
  },
})
