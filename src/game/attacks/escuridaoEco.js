import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'
import { AVISO_NO_ESCURO } from './escuridaoMaos.js'

// ECO da Escuridão (boss semanal). Um SINO aparece num canto escuro da caixa, longe dos corações, e balança
// (o aviso: o sino brilha por cima do breu e um anel fino mostra até onde o som vai sair). Quando ele toca, um
// anel de notas se espalha devagar, com uma BRECHA virada para um lado sorteado. Depois o eco: o mesmo sino
// toca de novo do lado ESPELHADO da caixa (o ponto do outro lado do centro), com a brecha espelhada também.
// Quem decora onde o primeiro tocou já sabe onde vem o eco.
//
// Justiça: o sino nasce a pelo menos `longe` px dos corações e balança `aviso` ms (mín. 650) antes de tocar; o
// anel tem uma brecha de `brecha` rad e as notas ficam cada vez mais longe uma da outra; as notas soam como
// sino nas pistas de som (pistas.js).
//
//   intervalo   ms entre um sino e o próximo
//   notas       notas por anel · velocidade  px/s do anel · brecha  rad sem nota
//   ecos        quantas vezes ele ecoa do lado espelhado (0, 1 ou 2) · atrasoEco  ms entre o toque e o eco
export default definirAtaque({
  nome: 'escuridaoEco',
  padrao: { duracao: 6500, intervalo: 2300, aviso: 750, notas: 16, velocidade: 95, brecha: 0.9, ecos: 1, atrasoEco: 900, raio: 5, longe: 80 },
  iniciar(a, cfg) {
    const aviso = Math.max(650, cfg.aviso)
    // (o sino nasce a `longe` px dos corações: o anel chega neles com a brecha já desse tamanho)
    a.lacuna(cfg.brecha * cfg.longe - cfg.raio * 2, 'na brecha do anel, quando ele chega nos corações')

    const sino = (x, y, abertura) => {
      const g = a.decoracao(a.cena.add.graphics().setDepth(AVISO_NO_ESCURO))
      let t = 0
      a.zonaPerigo({ tipo: 'circulo', x, y, raio: 34 }, { ms: aviso, dura: 400 })
      tocar(a.cena, 'sino')
      a.aoAtualizar((dt) => {
        if (!g.scene || t > aviso + 240) return
        t += dt
        g.clear()
        if (t > aviso + 240) return
        const f = Math.min(1, t / aviso)
        const balanco = Math.sin(t / 55) * 0.5 * (1 - f * 0.4)
        // o anel fino que vai sair e a brecha marcada
        g.lineStyle(1, 0xb8b0ff, 0.25 + 0.35 * f).strokeCircle(x, y, 14 + 22 * f)
        g.lineStyle(3, 0x7dff9a, 0.5 + 0.4 * f).beginPath().arc(x, y, 14 + 22 * f, abertura - cfg.brecha / 2, abertura + cfg.brecha / 2).strokePath()
        // o sino balançando
        const cx = x + Math.sin(balanco) * 4
        g.fillStyle(0xd8d0ff, 0.9).fillTriangle(cx - 7, y + 5, cx + 7, y + 5, cx, y - 8)
        g.fillStyle(0xd8d0ff, 0.9).fillRect(cx - 8, y + 4, 16, 3)
        g.fillStyle(0xffe9a0, 1).fillCircle(cx + Math.sin(balanco) * 3, y + 8, 2)
      })
      a.depois(aviso, () => {
        tocar(a.cena, 'sino')
        const giro = abertura + cfg.brecha / 2
        const passo = (Math.PI * 2 - cfg.brecha) / Math.max(1, cfg.notas - 1)
        for (let k = 0; k < cfg.notas; k++) {
          const ang = giro + k * passo
          a.bala({ x: x + Math.cos(ang) * 8, y: y + Math.sin(ang) * 8, vx: Math.cos(ang) * cfg.velocidade, vy: Math.sin(ang) * cfg.velocidade, raio: cfg.raio, forma: 'losango', cor: 0xd8d0ff, jaAvisada: true, pulso: 0 })
        }
      })
    }

    a.aCadaEvento(
      cfg.intervalo,
      () => {
        const l = a.caixa
        const p = a.pontoLonge(cfg.longe, 22)
        const abertura = a.aleatorio(0, Math.PI * 2)
        sino(p.x, p.y, abertura)
        // o eco: o ponto espelhado pelo centro da caixa (e a brecha espelhada)
        for (let e = 1; e <= cfg.ecos; e++) {
          const ex = e % 2 ? l.centerX * 2 - p.x : p.x
          const ey = e % 2 ? l.centerY * 2 - p.y : p.y
          a.depois(cfg.atrasoEco * e, () => sino(ex, ey, e % 2 ? abertura + Math.PI : abertura))
        }
      },
      Infinity,
      350,
    )
  },
})
