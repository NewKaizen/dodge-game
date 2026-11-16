import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// O CAMINHÃO DE LIXO do Coronel Caçamba (CO-OP 2.0, docs/coop-cartas.md). Nada de trânsito cheio: a caixa vira
// poucas faixas e UMA faixa por vez acende em amarelo, piscando, com as setas e a buzina do lado por onde ele vai
// entrar (`aviso` ms); só depois o caminhão cruza a faixa de ponta a ponta. Quem está na faixa tem o aviso inteiro
// para sair dela; as outras faixas continuam livres.
//
// Justiça:
//   - toda travessia é anunciada pela faixa acesa (`aviso` ms, no mínimo ATAQUE.telegrafoMs) e pela buzina;
//   - a faixa tem pelo menos 3x o coração (a caixa tem de ter altura para isso: 3 faixas de 60 px);
//   - nunca há mais caminhões (ou avisos) ao mesmo tempo que `simultaneos`, e sempre sobra uma faixa livre;
//   - o caminhão anda na velocidade da carta, e uma faixa livre fica a no máximo uma faixa de distância.
//
//   faixas        quantas faixas (altura da caixa / faixas >= LACUNA_MINIMA)
//   intervalo     ms entre um aviso e o próximo (se couber: senão espera a faixa livre)
//   simultaneos   quantas faixas ocupadas ao mesmo tempo (o CAMINHÃO DUPLO usa 2; sobra uma livre)
//   velocidade    px/s do caminhão
//   aviso         ms da faixa acesa antes de ele entrar
//   largura       comprimento do caminhão (px) · altura  espessura da colisão (px)
export default definirAtaque({
  nome: 'coronelCaminhao',
  padrao: { duracao: 6500, faixas: 3, intervalo: 1500, simultaneos: 1, velocidade: 150, aviso: 1000, largura: 76, altura: 30 },
  iniciar(a, cfg) {
    const geometria = () => {
      const l = a.caixa
      const h = l.height / cfg.faixas
      return { l, h, topo: (i) => l.top + h * i, y: (i) => l.top + h * (i + 0.5) }
    }
    a.lacuna(geometria().h, 'faixa livre do caminhão')
    const ocupadas = new Map() // faixa -> o caminhão (null enquanto só o aviso)
    let ultima = -1
    const aviso = Math.max(450, cfg.aviso)

    // as setas que correm pela faixa acesa, do lado por onde o caminhão entra
    const setas = (i, dir) => {
      const { l, h, y } = geometria()
      const g = a.decoracao(a.cena.add.graphics().setDepth(4))
      const desenhar = (t) => {
        g.clear().fillStyle(0xffd23c, 0.85)
        for (let k = 0; k < 4; k++) {
          const frac = ((t / 420 + k / 4) % 1) // 0..1 ao longo do primeiro terço da faixa
          const x = dir > 0 ? l.left + 10 + frac * l.width * 0.45 : l.right - 10 - frac * l.width * 0.45
          const m = Math.min(11, h * 0.2)
          g.fillTriangle(x + dir * m, y(i), x - dir * m * 0.6, y(i) - m, x - dir * m * 0.6, y(i) + m)
        }
      }
      let t = 0
      a.aoAtualizar((dt) => {
        t += dt
        if (t < aviso && g.scene) desenhar(t)
        else if (g.scene) g.clear()
      })
    }

    const comecar = (i) => {
      const dir = a.aleatorio(0, 1) < 0.5 ? 1 : -1
      ocupadas.set(i, null)
      ultima = i
      tocar(a.cena, 'buzina')
      const { l, h, topo } = geometria()
      setas(i, dir)
      a.aviso({ tipo: 'area', x: l.left, y: topo(i), largura: l.width, altura: h, ms: aviso, cor: 0xffd23c }, () => {
        const { l: l2, y } = geometria()
        const borda = dir > 0 ? l2.left : l2.right
        const b = a.bala({
          x: borda - dir * (cfg.largura / 2 + 4),
          y: y(i),
          vx: dir * cfg.velocidade,
          largura: cfg.largura,
          altura: cfg.altura,
          textura: 'caminhaoLixo',
          tamanho: cfg.largura * 1.12,
          pulso: 0,
          jaAvisada: true,
        })
        b.sprite.setFlipX(dir < 0)
        ocupadas.set(i, { b, dir })
        tocar(a.cena, 'motor')
      })
    }

    // a faixa fica livre quando o caminhão passou da borda de saída
    a.aoAtualizar(() => {
      const { l } = geometria()
      for (const [i, t] of ocupadas) {
        if (!t) continue
        const saiu = t.dir > 0 ? t.b.x - cfg.largura / 2 > l.right : t.b.x + cfg.largura / 2 < l.left
        if (t.b.morta || saiu) ocupadas.delete(i)
      }
    })

    a.aCada(cfg.intervalo, () => {
      if (ocupadas.size >= cfg.simultaneos) return
      const livres = Array.from({ length: cfg.faixas }, (_, i) => i).filter((i) => !ocupadas.has(i))
      if (livres.length <= 1) return // sempre sobra uma faixa livre
      // não repete a faixa de agora há pouco, e (se der) não escolhe a do coração parado duas vezes seguidas
      const opcoes = livres.filter((i) => i !== ultima)
      comecar(a.escolher(opcoes.length ? opcoes : livres))
    })
  },
})
