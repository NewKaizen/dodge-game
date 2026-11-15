import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// BUZINAÇO do Coronel Caçamba (CO-OP 2.0). Não machuca: EMPURRA. Uma onda de som varre a caixa de um lado ao
// outro (uma faixa vertical com arcos azuis); quem está dentro dela é arrastado para o lado em que ela anda.
// Serve para tirar o coração do lugar (para longe de um item verde, para dentro do entulho que está caindo).
// O aviso é a seta grande e a buzina do lado por onde ela entra; dá para sair da onda correndo contra ela
// (a onda nunca empurra mais que o coração anda).
//
// Só o PC dono do coração o move (em rede, o outro PC vê pelas posições que chegam: `coracao.espelho`).
//
//   ondas       quantas ondas passam
//   intervalo   ms entre o começo de uma onda e a próxima
//   aviso       ms das setas do lado de entrada antes da onda andar
//   velocidade  px/s da onda
//   empurrao    px/s com que ela arrasta quem está dentro (menor que a velocidade do coração)
//   largura     largura da faixa de som (px)
export default definirAtaque({
  nome: 'coronelBuzinaco',
  padrao: { duracao: 6500, ondas: 2, intervalo: 3000, aviso: 900, velocidade: 120, empurrao: 120, largura: 54 },
  iniciar(a, cfg) {
    const aviso = Math.max(450, cfg.aviso)
    let ultimo = a.aleatorio(0, 1) < 0.5 ? 1 : -1

    const onda = () => {
      ultimo = -ultimo // alterna o lado (o primeiro é sorteado)
      const dir = ultimo
      const l0 = a.caixa
      tocar(a.cena, 'buzina')
      const g = a.decoracao(a.cena.add.graphics().setDepth(6))
      let t = 0
      let frente = dir > 0 ? l0.left - cfg.largura / 2 : l0.right + cfg.largura / 2
      const fim = () => (dir > 0 ? frente - cfg.largura / 2 > a.caixa.right : frente + cfg.largura / 2 < a.caixa.left)

      a.aoAtualizar((dt) => {
        if (!g.scene) return
        const l = a.caixa
        t += dt
        g.clear()
        if (t < aviso) {
          // aviso: três setas grandes piscando na borda por onde ela entra, a banda ainda fora
          const x0 = dir > 0 ? l.left + 6 : l.right - 6
          const pisca = 0.45 + 0.4 * Math.sin(t / 70)
          g.fillStyle(0x7fd8ff, pisca)
          for (let k = 0; k < 3; k++) {
            const x = x0 + dir * k * 16
            g.fillTriangle(x + dir * 12, l.centerY, x, l.centerY - 14, x, l.centerY + 14)
          }
          return
        }
        if (fim()) return
        frente += dir * cfg.velocidade * (dt / 1000)
        const e = frente - cfg.largura / 2
        g.fillStyle(0x7fd8ff, 0.16).fillRect(Math.max(l.left, e), l.top, Math.max(0, Math.min(l.right, e + cfg.largura) - Math.max(l.left, e)), l.height)
        g.lineStyle(3, 0xbfeaff, 0.85)
        for (let k = 0; k < 3; k++) {
          const x = frente + dir * (k * 9 - 8)
          if (x < l.left || x > l.right) continue
          g.beginPath()
          g.arc(x - dir * 26, l.centerY, 52 + k * 14, dir > 0 ? -0.55 : Math.PI - 0.55, dir > 0 ? 0.55 : Math.PI + 0.55)
          g.strokePath()
        }
        // empurra quem está dentro da faixa (só os corações deste PC)
        for (const c of a.coracoes) {
          if (!c.ativo || c.espelho) continue
          if (Math.abs(c.x - frente) > cfg.largura / 2) continue
          c.x += dir * cfg.empurrao * (dt / 1000)
          c.ajustar()
        }
      })
    }

    a.aCada(cfg.intervalo, onda, cfg.ondas, 250)
  },
})
