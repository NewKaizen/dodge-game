import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// MARCHA À RÉ do Coronel Caçamba (dificuldade do CO-OP). BIP... BIP... BIP: o caminhão entra DE RÉ numa faixa,
// devagar, até um ponto marcado, despeja a caçamba (um leque de entulho que sai pela traseira, para dentro da
// caixa) e arranca para fora pelo mesmo lado. O trecho da faixa que ele vai ocupar acende antes (amarelo
// listrado, com os BIPs), e o leque sai da traseira já mostrado por um risco no chão.
//
// Justiça: a faixa e o ponto de parada acendem `aviso` ms antes (mín. 600); a ré é lenta (no máximo a
// velocidade de fuga); o leque é avisado pelo risco no chão `avisoLeque` ms antes; nunca há caminhões em
// todas as faixas (sobra uma livre).
//
//   faixas      faixas da caixa (3)
//   intervalo   ms entre um caminhão e o próximo
//   re          px/s da ré · saida  px/s da arrancada
//   profundidade fração da largura até onde ele entra (sorteada entre [min, max])
//   leque       pedaços de entulho do leque · velocidadeLeque px/s · abertura rad do leque
//   simultaneos caminhões ao mesmo tempo
export default definirAtaque({
  nome: 'coronelRe',
  padrao: { duracao: 7000, faixas: 3, intervalo: 2000, re: 110, saida: 260, profundidade: [0.35, 0.7], aviso: 900, leque: 5, velocidadeLeque: 150, abertura: 1.1, avisoLeque: 450, simultaneos: 1, largura: 76, altura: 30 },
  iniciar(a, cfg) {
    const ocupadas = new Set()
    const aviso = Math.max(600, cfg.aviso)

    const caminhao = (i) => {
      const l = a.caixa
      const h = l.height / cfg.faixas
      const y = l.top + h * (i + 0.5)
      const dir = a.aleatorio(0, 1) < 0.5 ? 1 : -1 // de que lado entra (1 = pela esquerda)
      const borda = dir > 0 ? l.left : l.right
      const ate = borda + dir * l.width * a.aleatorio(cfg.profundidade[0], cfg.profundidade[1])
      ocupadas.add(i)
      // a faixa acende do lado de entrada até a parada (listras amarelas) com os BIPs
      const ini = Math.min(borda, ate)
      const g = a.decoracao(a.cena.add.graphics().setDepth(4))
      let t = 0
      let bips = 0
      a.aoAtualizar((dt) => {
        if (!g.scene || t > aviso) return
        t += dt
        g.clear()
        if (t > aviso) return
        const pisca = 0.18 + 0.14 * Math.sin(t / 80)
        g.fillStyle(0xffd23c, pisca).fillRect(ini, y - h / 2 + 3, Math.abs(ate - borda), h - 6)
        g.lineStyle(3, 0xffd23c, 0.9).lineBetween(ate, y - h / 2 + 2, ate, y + h / 2 - 2)
        const n = Math.floor(t / 300)
        if (n > bips) {
          bips = n
          tocar(a.cena, 'contador')
        }
      })
      a.zonaPerigo({ tipo: 'area', x: ini, y: y - h / 2, largura: Math.abs(ate - borda), altura: h }, { ms: aviso, dura: 4000 })
      a.depois(aviso, () => {
        const lc = a.caixa
        const re = a.limitarPerseguidor(cfg.re)
        tocar(a.cena, 'motor')
        let estado = 're'
        let parado = 0
        // a traseira vai na frente: o caminhão entra de ré
        const b = a.bala({ x: borda - dir * (cfg.largura / 2 + 4), y, vx: dir * re, largura: cfg.largura, altura: cfg.altura, textura: 'caminhaoLixo', tamanho: cfg.largura * 1.12, pulso: 0, jaAvisada: true, atravessa: true })
        b.sprite.setFlipX(dir > 0) // de ré: a cabine fica para fora
        const traseira = () => b.x + dir * (cfg.largura / 2)
        b.atualizar = (bb, dt) => {
          if (estado === 're' && dir * (traseira() - ate) >= 0) {
            estado = 'despeja'
            bb.vx = 0
            // o risco do leque no chão, depois o entulho sai da traseira
            const x0 = traseira()
            const risco = a.decoracao(a.cena.add.graphics().setDepth(4))
            risco.lineStyle(2, 0xff8a3c, 0.8)
            for (let k = 0; k < cfg.leque; k++) {
              const ang = (dir > 0 ? 0 : Math.PI) + (cfg.leque > 1 ? (k / (cfg.leque - 1) - 0.5) * cfg.abertura * 2 : 0)
              risco.lineBetween(x0, y, x0 + Math.cos(ang) * 46, y + Math.sin(ang) * 46)
            }
            a.depois(cfg.avisoLeque, () => {
              risco.destroy()
              tocar(a.cena, 'explosao')
              a.tremer(120, 0.01)
              for (let k = 0; k < cfg.leque; k++) {
                const ang = (dir > 0 ? 0 : Math.PI) + (cfg.leque > 1 ? (k / (cfg.leque - 1) - 0.5) * cfg.abertura * 2 : 0)
                a.bala({ x: x0, y, vx: Math.cos(ang) * cfg.velocidadeLeque, vy: Math.sin(ang) * cfg.velocidadeLeque, raio: 7, forma: a.escolher(['bola', 'losango']), girar: 4, jaAvisada: true })
              }
            })
          }
          if (estado === 'despeja') {
            parado += dt
            if (parado > cfg.avisoLeque + 250) {
              estado = 'sai'
              bb.vx = -dir * cfg.saida
              tocar(a.cena, 'buzina')
            }
          }
          if (estado === 'sai') {
            const saiu = dir > 0 ? bb.x + cfg.largura / 2 < lc.left : bb.x - cfg.largura / 2 > lc.right
            if (saiu) {
              bb.morta = true
              ocupadas.delete(i)
            }
          }
        }
      })
    }

    a.aCadaEvento(
      cfg.intervalo,
      () => {
        if (ocupadas.size >= Math.min(cfg.simultaneos, cfg.faixas - 1)) return
        const livres = Array.from({ length: cfg.faixas }, (_, i) => i).filter((i) => !ocupadas.has(i))
        caminhao(a.escolher(livres))
      },
      Infinity,
      300,
    )
  },
})
