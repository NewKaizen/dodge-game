import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// ALARME do cofre da Ladra (boss semanal). Ela disparou o alarme do museu: FEIXES DE SEGURANÇA atravessam a
// caixa devagar, de uma borda até a outra, cada um com um VÃO (por onde a ladra passaria). Antes de cada feixe
// a borda de onde ele sai pisca em vermelho e o vão aparece em verde. Com `deriva` o vão escorrega de lado
// enquanto o feixe anda; com `cruzado` um feixe vertical e um horizontal vêm juntos.
//
// Justiça: a borda pisca `aviso` ms (mín. 600) antes do feixe entrar (ele nasce fora da caixa); o vão tem `vao`
// px (bem mais que LACUNA_MINIMA) e fica dentro da caixa a viagem inteira; o feixe anda bem mais devagar que o
// coração. A CPU vê os pedaços do feixe pelas zonas (área do caminho logo à frente).
//
//   intervalo   ms entre os feixes · velocidade  px/s do feixe · vao  px do vão
//   deriva      px/s do vão de lado (0 = parado) · cruzado  true: um de cada eixo juntos
export default definirAtaque({
  nome: 'ladraAlarme',
  padrao: { duracao: 7000, intervalo: 1900, aviso: 750, velocidade: 62, vao: 66, deriva: 0, cruzado: false, espessura: 7 },
  iniciar(a, cfg) {
    const aviso = Math.max(600, cfg.aviso)
    a.lacuna(cfg.vao - cfg.espessura, 'o vão do feixe')
    let ultimo = a.aleatorio(0, 1) < 0.5 ? 'top' : 'left'

    const feixe = (lado) => {
      const l = a.caixa
      const horizontal = lado === 'top' || lado === 'bottom' // a linha é horizontal e anda na vertical
      const dir = lado === 'top' || lado === 'left' ? 1 : -1
      const comprimento = horizontal ? l.width : l.height
      const m = cfg.vao / 2 + 14
      let centro = a.aleatorio(m, comprimento - m) // onde está o meio do vão (ao longo da linha)
      let deriva = cfg.deriva * (a.aleatorio(0, 1) < 0.5 ? 1 : -1)
      const g = a.decoracao(a.cena.add.graphics().setDepth(4))
      const ponto = (ao, eixo) => (horizontal ? { x: l.left + ao, y: eixo } : { x: eixo, y: l.top + ao })
      const borda = lado === 'top' ? l.top : lado === 'bottom' ? l.bottom : lado === 'left' ? l.left : l.right
      let t = 0
      tocar(a.cena, 'aviso')
      a.aoAtualizar((dt) => {
        if (!g.scene || t > aviso) return
        t += dt
        g.clear()
        if (t > aviso) return
        const pisca = Math.sin(t / 60) > 0 ? 1 : 0.45
        const a1 = ponto(0, borda)
        const a2 = ponto(centro - cfg.vao / 2, borda)
        const b1 = ponto(centro + cfg.vao / 2, borda)
        const b2 = ponto(comprimento, borda)
        g.lineStyle(4, 0xff3a3a, 0.9 * pisca).lineBetween(a1.x, a1.y, a2.x, a2.y).lineBetween(b1.x, b1.y, b2.x, b2.y)
        g.lineStyle(3, 0x7dff9a, 0.9).lineBetween(a2.x, a2.y, b1.x, b1.y)
        // os emissores nas pontas do vão
        g.fillStyle(0xffe14a, 1).fillCircle(a2.x, a2.y, 3).fillCircle(b1.x, b1.y, 3)
      })
      a.depois(aviso, () => {
        tocar(a.cena, 'laser')
        const lc = a.caixa
        const e = cfg.espessura
        const eixo0 = borda - dir * (e + 4)
        const v = cfg.velocidade
        const pedaco = (ini, fim) => {
          const meio = (ini + fim) / 2
          const len = Math.max(2, fim - ini)
          const p = ponto(meio, eixo0)
          return a.bala({ x: p.x, y: p.y, largura: horizontal ? len : e, altura: horizontal ? e : len, vx: horizontal ? 0 : dir * v, vy: horizontal ? dir * v : 0, forma: 'barra', cor: 0xff3a3a, entrando: true, atravessa: true, pulso: 0 })
        }
        const pecas = [pedaco(-20, centro - cfg.vao / 2), pedaco(centro + cfg.vao / 2, comprimento + 20)]
        // a dica para a CPU aliada (alvoDoAlarme): onde está o vão deste feixe
        const vaos = (a.cena.vaosDoAlarme ??= new Set())
        const dica = { horizontal, dir, pos: eixo0, vao: (horizontal ? lc.left : lc.top) + centro, pecas }
        vaos.add(dica)
        let zonaEm = 0
        a.aoAtualizar((dt) => {
          if (pecas.every((p) => p.morta)) return vaos.delete(dica)
          dica.pos = horizontal ? pecas[0].y : pecas[0].x
          dica.vao = (horizontal ? lc.left : lc.top) + centro
          const f = a.balas.fatorVelocidade || 1
          if (deriva) {
            centro += deriva * (dt / 1000) * f
            if (centro < m || centro > comprimento - m) {
              deriva = -deriva
              centro = Math.min(comprimento - m, Math.max(m, centro))
            }
            const [p1, p2] = pecas
            const ini1 = -20
            const fim1 = centro - cfg.vao / 2
            const ini2 = centro + cfg.vao / 2
            const fim2 = comprimento + 20
            if (horizontal) {
              p1.x = lc.left + (ini1 + fim1) / 2
              p1.largura = fim1 - ini1
              p2.x = lc.left + (ini2 + fim2) / 2
              p2.largura = fim2 - ini2
            } else {
              p1.y = lc.top + (ini1 + fim1) / 2
              p1.altura = fim1 - ini1
              p2.y = lc.top + (ini2 + fim2) / 2
              p2.altura = fim2 - ini2
            }
            // (o sprite da barra acompanha o tamanho novo: textura de 24 px de miolo numa tela de 32)
            for (const p of pecas) p.sprite?.setDisplaySize(p.largura * (32 / 24), p.altura * (32 / 24))
          }
          // passou do outro lado: some
          for (const p of pecas) {
            const pos = horizontal ? p.y : p.x
            if ((dir > 0 && pos > (horizontal ? lc.bottom : lc.right) + e + 4) || (dir < 0 && pos < (horizontal ? lc.top : lc.left) - e - 4)) p.morta = true
          }
          // a CPU vê o caminho logo à frente de cada pedaço
          zonaEm -= dt
          if (zonaEm <= 0) {
            zonaEm = 120
            for (const p of pecas) {
              if (p.morta) continue
              const frente = dir * v * f * 0.3
              if (horizontal) a.zonaPerigo({ tipo: 'area', x: p.x - p.largura / 2, y: Math.min(p.y, p.y + frente) - e, largura: p.largura, altura: Math.abs(frente) + e * 2 }, { ms: 0, dura: 160 })
              else a.zonaPerigo({ tipo: 'area', x: Math.min(p.x, p.x + frente) - e, y: p.y - p.altura / 2, largura: Math.abs(frente) + e * 2, altura: p.altura }, { ms: 0, dura: 160 })
            }
          }
        })
      })
    }

    a.aCadaEvento(
      cfg.intervalo,
      () => {
        // alterna o eixo e o lado; com `cruzado`, os dois eixos juntos
        const horizontal = ultimo === 'left' || ultimo === 'right'
        const lado = horizontal ? a.escolher(['top', 'bottom']) : a.escolher(['left', 'right'])
        ultimo = lado
        feixe(lado)
        if (cfg.cruzado) feixe(horizontal ? a.escolher(['left', 'right']) : a.escolher(['top', 'bottom']))
      },
      Infinity,
      200,
    )
  },
})

// A CPU aliada (coop/semanal/ladraRegra.js alvoDoBot; scripts/balanceamento/medirChefes.mjs): o feixe que está
// chegando no coração (na frente dele, a menos de 150 px) e o ponto logo DEPOIS do vão dele, para ela atravessar
// pelo vão em vez de fugir até a parede. null = nenhum feixe chegando
export function alvoDoAlarme(cena, coracao) {
  const vaos = cena?.vaosDoAlarme
  if (!vaos?.size || !coracao) return null
  let melhor = null
  let perto = Infinity
  for (const v of [...vaos]) {
    if (!v.pecas.some((p) => !p.morta && p.sprite?.active !== false)) {
      vaos.delete(v)
      continue
    }
    const frente = ((v.horizontal ? coracao.y : coracao.x) - v.pos) * v.dir // > 0: o coração está na frente do feixe
    if (frente < -4 || frente > 150 || frente >= perto) continue
    perto = frente
    const atras = v.pos - v.dir * 18
    melhor = v.horizontal ? { x: v.vao, y: atras, raio: 10 } : { x: atras, y: v.vao, raio: 10 }
  }
  return melhor
}
