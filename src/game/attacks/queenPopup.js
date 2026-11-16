import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'
import { FONTE } from '../constants.js'

// POP-UPS da Queen (dificuldade do CO-OP). Janelas de propaganda abrem pelo quadro: primeiro só a MOLDURA (a
// barra de título, o "X" vermelho no canto e "CLIQUE AQUI!" piscando), inofensiva. Quando o X se fecha a janela
// BATE (o retângulo inteiro vale por um instante) e estoura em pixels que voam para fora, do meio dela. As
// janelas abrem longe dos corações, mas abrem várias juntas: o espaço livre vai sumindo.
//
// Justiça: a moldura aparece `aviso` ms antes (mín. 700) e é exatamente a área do golpe; a janela nunca abre em
// cima de um coração (fica a pelo menos `longe` px de todos); os pixels nascem no meio da janela já fechada.
//
//   intervalo   ms entre uma janela e a próxima
//   largura, altura   tamanho da janela (px)
//   pixels      quantos pixels voam no estouro · velocidadePixel px/s
//   fecha       ms que a janela vale ao fechar
export default definirAtaque({
  nome: 'queenPopup',
  padrao: { duracao: 6500, intervalo: 950, aviso: 1000, largura: 92, altura: 58, pixels: 6, velocidadePixel: 140, fecha: 260, longe: 46 },
  iniciar(a, cfg) {
    const aviso = Math.max(700, cfg.aviso)
    const abertas = []

    const abrir = () => {
      const l = a.caixa
      const w = Math.min(cfg.largura, l.width - 8)
      const h = Math.min(cfg.altura, l.height - 8)
      // longe dos corações e das outras janelas (escolha isolada: olha onde os corações estão)
      const p = a.isolado(() => {
        let melhor = null
        for (let k = 0; k < 14; k++) {
          const x = a.aleatorio(l.left + 2, l.right - w - 2)
          const y = a.aleatorio(l.top + 2, l.bottom - h - 2)
          const folga = Math.min(
            ...a.coracoes.filter((c) => c.ativo).map((c) => Math.max(x - c.x, c.x - (x + w), y - c.y, c.y - (y + h))),
            ...abertas.map((o) => Math.max(x - (o.x + o.w), o.x - (x + w), y - (o.y + o.h), o.y - (y + h)) + 40),
            999,
          )
          if (folga >= cfg.longe) return { x, y }
          if (!melhor || folga > melhor.folga) melhor = { x, y, folga }
        }
        return melhor
      })
      const jan = { x: Math.round(p.x), y: Math.round(p.y), w, h }
      abertas.push(jan)
      tocar(a.cena, 'cartaVirar')
      const g = a.decoracao(a.cena.add.graphics().setDepth(4))
      const txt = a.decoracao(a.cena.add.text(jan.x + w / 2, jan.y + h / 2 + 5, 'CLIQUE AQUI!', { fontFamily: FONTE, fontSize: '9px', color: '#ff4fc8' }).setOrigin(0.5).setDepth(8))
      let t = 0
      a.aoAtualizar((dt) => {
        if (!g.scene || t > aviso) return
        t += dt
        g.clear()
        if (t > aviso) {
          txt.destroy()
          return
        }
        const f = t / aviso
        g.fillStyle(0x0b1830, 0.55).fillRect(jan.x, jan.y, w, h)
        g.lineStyle(2, 0x40f0ff, 0.9).strokeRect(jan.x, jan.y, w, h)
        g.fillStyle(0x40f0ff, 0.8).fillRect(jan.x, jan.y, w, 11)
        // o X do canto cresce até "clicar"
        const xs = 4 + 3 * f
        const cx = jan.x + w - 7
        const cy = jan.y + 5.5
        g.fillStyle(0xff3b5c, 1).fillRect(cx - xs, cy - xs, xs * 2, xs * 2)
        g.lineStyle(1.5, 0xffffff, 1).lineBetween(cx - xs + 2, cy - xs + 2, cx + xs - 2, cy + xs - 2).lineBetween(cx + xs - 2, cy - xs + 2, cx - xs + 2, cy + xs - 2)
        // a barra de "fechando" no rodapé da janela
        g.fillStyle(0xff3b5c, 0.8).fillRect(jan.x + 3, jan.y + h - 6, (w - 6) * f, 3)
        txt.setAlpha(Math.sin(t / 90) > 0 ? 1 : 0.4)
      })
      a.zonaPerigo({ tipo: 'area', x: jan.x, y: jan.y, largura: w, altura: h }, { ms: aviso, dura: cfg.fecha })
      a.depois(aviso, () => {
        tocar(a.cena, 'estouro')
        a.bala({ x: jan.x + w / 2, y: jan.y + h / 2, largura: w, altura: h, forma: 'barra', cor: 0xff4fc8, vida: cfg.fecha, atravessa: true, jaAvisada: true, pulso: 0 })
        abertas.splice(abertas.indexOf(jan), 1)
        a.depois(cfg.fecha, () => {
          const giro = a.aleatorio(0, Math.PI * 2)
          for (let k = 0; k < cfg.pixels; k++) {
            const ang = giro + (k / cfg.pixels) * Math.PI * 2
            a.bala({ x: jan.x + w / 2, y: jan.y + h / 2, vx: Math.cos(ang) * cfg.velocidadePixel, vy: Math.sin(ang) * cfg.velocidadePixel, raio: 5, forma: 'hex', jaAvisada: true, girar: 4 })
          }
        })
      })
    }

    a.aCadaEvento(cfg.intervalo, abrir, Infinity, 150)
  },
})
