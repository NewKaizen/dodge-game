import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'
import { AVISO_NO_ESCURO } from './escuridaoMaos.js'

// O OLHAR da Escuridão (boss semanal). Um olho enorme se abre na borda de cima da caixa. Enquanto as pálpebras
// abrem (o aviso), o leque que o olhar vai varrer acende de leve e uma linha pontilhada mostra para onde ele
// olha primeiro. Depois o OLHAR (um feixe de ponta a ponta) varre o leque devagar, de um lado para o meio, e
// (com `vaivem`) volta. O outro lado do olho fica sempre fora do leque: é para lá que se corre. Com `lagrimas`
// o olho chora gotas que caem reto embaixo dele enquanto olha.
//
// Justiça: o leque inteiro acende `aviso` ms antes (mín. 800) e é exatamente o que o feixe cobre (zona `leque`
// para a CPU); o arco é menor que meia volta, então sempre sobra um lado sem olhar; a ponta do feixe anda no
// máximo a velocidade de fuga do coração (a.tetoPerseguidor), em qualquer lugar da caixa. As gotas entram pela
// borda de cima (a entrada é o aviso).
//
//   intervalo   ms entre um olho e o próximo
//   arco        rad que o olhar varre (< PI) · giro  rad/s pedidos (limitados pela fuga)
//   vaivem      true: varre e volta · lagrimas  ms entre as gotas (0 = sem gotas)
export default definirAtaque({
  nome: 'escuridaoOlhar',
  padrao: { duracao: 7000, intervalo: 3600, aviso: 950, arco: 1.4, giro: 0.9, vaivem: false, lagrimas: 0, espessura: 9 },
  iniciar(a, cfg) {
    const aviso = Math.max(800, cfg.aviso)
    const arco = Math.min(cfg.arco, Math.PI * 0.8)

    const olho = () => {
      const l = a.caixa
      const ex = l.left + l.width * a.aleatorio(0.2, 0.8)
      const ey = l.top
      // começa deitado na borda do lado mais longo e varre para o meio
      const daEsquerda = ex > l.centerX
      const inicio = daEsquerda ? Math.PI - 0.12 : 0.12
      const sentido = daEsquerda ? -1 : 1
      const fim = inicio + sentido * arco
      const meio = (inicio + fim) / 2
      const alcance = Math.max(Math.hypot(ex - l.left, l.height), Math.hypot(l.right - ex, l.height)) + 8
      const f = a.balas.fatorVelocidade || 1
      const giro = Math.min(cfg.giro, a.tetoPerseguidor() / alcance / f)
      const varre = (arco / (giro * f)) * 1000
      const total = varre * (cfg.vaivem ? 2 : 1)
      a.zonaPerigo({ tipo: 'leque', x: ex, y: ey, raio: alcance, angulo: meio, abertura: arco / 2 + 0.06 }, { ms: aviso, dura: total + 100 })

      const g = a.decoracao(a.cena.add.graphics().setDepth(AVISO_NO_ESCURO))
      let t = 0
      let ang = inicio
      let feixe = null
      let volta = false
      let gota = 0
      tocar(a.cena, 'abismo')
      a.aoAtualizar((dt) => {
        if (!g.scene) return
        t += dt
        if (t > aviso + total + 300) {
          g.clear()
          return
        }
        g.clear()
        const abre = Math.min(1, t / (aviso * 0.7))
        const fecha = t > aviso + total ? Math.max(0, 1 - (t - aviso - total) / 300) : 1
        const aberto = abre * fecha
        // o leque que ele vai olhar (só no aviso)
        if (t < aviso) {
          const p = t / aviso
          g.fillStyle(0xff4a6a, 0.06 + 0.14 * p)
          g.slice(ex, ey, alcance, Math.min(inicio, fim), Math.max(inicio, fim), false)
          g.fillPath()
          for (let d = 14; d < alcance; d += 12) g.fillStyle(0xffb0c0, 0.5 + 0.4 * p).fillCircle(ex + Math.cos(inicio) * d, ey + Math.sin(inicio) * d, 1.4)
        }
        // o olho: branco, íris vermelha e a pupila de fenda, seguindo o feixe
        g.fillStyle(0x0b0918, 1).fillEllipse(ex, ey + 2, 46, 26)
        g.fillStyle(0xe8e0ff, 1).fillEllipse(ex, ey + 2, 40, 22 * aberto + 1)
        if (aberto > 0.2) {
          const ix = ex + Math.cos(ang) * 6
          const iy = ey + 2 + Math.sin(ang) * 4 * aberto
          g.fillStyle(0xd02a4a, 1).fillCircle(ix, iy, 8 * aberto)
          g.fillStyle(0x0b0918, 1).fillEllipse(ix, iy, 3, 12 * aberto)
          g.fillStyle(0xffffff, 0.9).fillCircle(ix - 3, iy - 3, 1.5)
        }
        g.lineStyle(2, 0x8a7cff, 1).strokeEllipse(ex, ey + 2, 46, 26)
      })

      a.depois(aviso, () => {
        tocar(a.cena, 'laser')
        feixe = a.bala({ x: ex, y: ey, comprimento: alcance * 2, espessura: cfg.espessura, angulo: inicio, forma: 'barra', cor: 0xff5a7a, jaAvisada: true, atravessa: true, pulso: 0 })
        let corre = 0
        a.aoAtualizar((dt) => {
          if (!feixe || feixe.morta) return
          corre += dt
          const s = (dt / 1000) * f
          if (!volta) {
            ang += sentido * giro * s
            if ((ang - fim) * sentido >= 0) {
              ang = fim
              if (cfg.vaivem) volta = true
              else feixe.morta = true
            }
          } else {
            ang -= sentido * giro * s
            if ((ang - inicio) * sentido <= 0) feixe.morta = true
          }
          // o segmento é centrado: a metade de dentro fica fora da caixa (para cima), a de fora cobre a caixa
          feixe.x = ex
          feixe.y = ey
          feixe.angulo = ang
          if (cfg.lagrimas > 0) {
            gota += dt
            while (gota >= cfg.lagrimas) {
              gota -= cfg.lagrimas
              a.bala({ x: ex + a.aleatorio(-8, 8), y: ey - 8, vy: 110, raio: 4, forma: 'bola', cor: 0xb8b0ff, entrando: true, pulso: 0 })
            }
          }
          if (corre > total + 200) feixe.morta = true
        })
      })
      return aviso + total + 300
    }

    // um olho por vez: dois olhares ao mesmo tempo poderiam cobrir a caixa inteira
    let livre = -Infinity
    a.aCadaEvento(
      cfg.intervalo,
      () => {
        if (a.tempo < livre) return
        livre = a.tempo + olho()
      },
      Infinity,
      250,
    )
  },
})
