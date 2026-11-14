import { tocar } from '../../../../audio.js'
import { fatores } from '../../../../acessibilidade.js'
import { POLARIDADE, polDoIndice, aceleracaoPolar, polaridadeDaCpu } from './planos.js'
import { criarCofre, avisoDoEvento, ouvirBotao, criarCanal, ehBot, pistaViva, texto } from './util.js'

// POLARIDADE (ESTAÇÃO ESPACIAL): o coração tem polaridade: + (vermelho) ou − (azul). Cada bala também (a cor e o
// sinal desenhado nela mostram qual). POLOS IGUAIS SE REPELEM, OPOSTOS SE ATRAEM: perto do coração a bala
// curva para longe (igual) ou vem para cima dele (oposta). A INVERTE a polaridade do coração (recarga curta):
// vire a mesma da bala que está chegando e ela desvia. Todas as balas continuam machucando.
// A polaridade de cada bala sai só do índice dela (polDoIndice, planos.js): igual nos dois PCs, sem sorteio.
// Em rede cada PC manda a inversão do SEU coração (canal 'estPolaridade'), para a caixa espelho do outro
// mostrar a cor certa e curvar as balas do mesmo jeito. A CPU escolhe o polo que mais afasta as balas
// (com um tempo de reação). terminar() devolve a cor do coração e solta o canal.

const COR = { 1: 0xff4a5a, '-1': 0x4aa8ff }
const corDe = (p) => COR[p]
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  const cofre = criarCofre(arena)
  const canal = criarCanal(arena, 'estPolaridade')
  let ativo = false
  let t = 0
  let ultimoDelta = 16
  let semente = 0
  let desligarBotao = () => {}
  // por pista: { pista, g, pol, recarga, vistas, rotulo, espera }
  let lados = []

  const flipar = (k, { daRede = false, pol = null } = {}) => {
    const s = lados[k]
    if (!s) return false
    if (!daRede && s.recarga > 0) return false
    s.pol = pol ?? -s.pol
    s.recarga = POLARIDADE.recargaMs
    const c = s.pista.coracoes[0]
    if (c?.ativo && fatores().particulas > 0.2) {
      const anel = cofre.guardar(arena.add.circle(c.x, c.y, 8).setStrokeStyle(2, corDe(s.pol), 0.95).setDepth(11))
      s.pista.caixa.recortar(anel)
      arena.tweens.add({ targets: anel, scale: 3.4, alpha: 0, duration: 260, onComplete: () => anel.destroy() })
    }
    if (!daRede && !ehBot(arena, k)) tocar(arena, 'inverter')
    return true
  }

  const apertou = (lado, botao) => {
    if (botao !== 'A') return
    const k = arena.pistaDe?.(lado) ?? lado
    if (!pistaViva(arena, k)) return
    if (flipar(k)) canal.enviar({ k, pol: lados[k].pol })
  }

  const vistoAgora = (s) => {
    // atribui polaridade às balas novas (na ordem em que nasceram) e pinta
    for (const b of s.pista.balas.lista) {
      if (b.marcaPlaneta) continue
      if (b.pol === undefined) b.pol = polDoIndice(s.vistas++, semente + s.indice)
      b.sprite.setTint(corDe(b.pol))
    }
  }

  const desenhar = (s) => {
    const c = s.pista.coracoes[0]
    const g = s.g
    g.clear()
    if (!c?.ativo) return
    const cor = corDe(s.pol)
    // anel do campo (o alcance da força) e o sinal em cima do coração
    g.lineStyle(1, cor, 0.16 + 0.06 * Math.sin(t / 300))
    g.strokeCircle(c.x, c.y, POLARIDADE.alcance)
    g.lineStyle(2, cor, 0.9)
    g.strokeCircle(c.x, c.y, 13)
    const gx = c.x
    const gy = c.y - 21
    g.lineStyle(3, 0x000000, 0.9).lineBetween(gx - 5, gy, gx + 5, gy)
    g.lineStyle(2, cor, 1).lineBetween(gx - 4, gy, gx + 4, gy)
    if (s.pol > 0) {
      g.lineStyle(3, 0x000000, 0.9).lineBetween(gx, gy - 5, gx, gy + 5)
      g.lineStyle(2, cor, 1).lineBetween(gx, gy - 4, gx, gy + 4)
    }
    // balas: sinal desenhado e as linhas da força quando ela puxa/empurra
    for (const b of s.pista.balas.lista) {
      if (b.morta || b.marcaPlaneta || b.pol === undefined) continue
      const r = b.tipo === 'circulo' ? Math.max(3, b.raio * 0.6) : 4
      g.lineStyle(1.6, 0xffffff, 0.95).lineBetween(b.x - r, b.y, b.x + r, b.y)
      if (b.pol > 0) g.lineBetween(b.x, b.y - r, b.x, b.y + r)
      if (b.inofensiva || b.idade < b.aviso) continue
      const a = aceleracaoPolar(s.pol, b.pol, b.x, b.y, c.x, c.y)
      const forca = Math.hypot(a.ax, a.ay) / POLARIDADE.forca
      if (forca < 0.06) continue
      if (s.pol === b.pol) {
        // repele: faíscas do campo saindo para longe do coração
        const m = Math.hypot(a.ax, a.ay) || 1
        g.lineStyle(1.5, 0xa8f4ff, Math.min(0.8, forca * 2.2)).lineBetween(b.x, b.y, b.x + (a.ax / m) * (6 + forca * 12), b.y + (a.ay / m) * (6 + forca * 12))
      } else {
        // atrai: fio amarelo ligando a bala ao coração
        g.lineStyle(1, 0xffe27a, Math.min(0.7, forca * 1.8)).lineBetween(b.x, b.y, c.x, c.y)
      }
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      semente = Math.floor(sorte() * 2147483647)
      lados = arena.pistas.map((pista, j) => {
        const g = cofre.guardar(arena.add.graphics().setDepth(9))
        pista.caixa.recortar(g)
        const l = pista.caixa.limites
        const rotulo = cofre.guardar(texto(arena, l.centerX, l.bottom + 12, '', { tamanho: 10 }))
        return { pista, indice: j, g, pol: j === 0 ? 1 : -1, recarga: 0, vistas: 0, rotulo, espera: null }
      })
      desligarBotao = ouvirBotao(arena, apertou)
      canal.ouvir(({ k, pol }) => flipar(k, { daRede: true, pol }))
      tocar(arena, 'trocar')
      avisoDoEvento(arena, cofre, 'IGUAIS SE REPELEM: A INVERTE!', { cor: '#ffb0b8' })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      ultimoDelta = delta
      lados.forEach((s, j) => {
        s.recarga = Math.max(0, s.recarga - delta)
        const c = s.pista.coracoes[0]
        vistoAgora(s)
        if (c?.ativo) {
          c.sprite.setTint(corDe(s.pol))
          const valendo = pistaViva(arena, j)
          const teto = Math.max(360, (s.pista.balas.velocidadeMax || 0) * 1.3)
          for (const b of s.pista.balas.lista) {
            if (b.morta || b.inofensiva || b.marcaPlaneta || b.segurada || b.idade < b.aviso || b.pol === undefined) continue
            const a = aceleracaoPolar(s.pol, b.pol, b.x, b.y, c.x, c.y)
            if (!a.ax && !a.ay) continue
            b.vx += (a.ax * ultimoDelta) / 1000
            b.vy += (a.ay * ultimoDelta) / 1000
            const v = Math.hypot(b.vx, b.vy)
            if (v > teto) {
              b.vx *= teto / v
              b.vy *= teto / v
            }
          }
          // a CPU vira o polo que mais afasta as balas, depois de um tempo de reação
          if (valendo && ehBot(arena, j) && s.recarga <= 0) {
            const quer = polaridadeDaCpu(c, s.pista.balas.lista, s.pol)
            if (quer === s.pol) s.espera = null
            else if (s.espera === null) s.espera = t + POLARIDADE.cpuReacaoMs.min + sorte() * (POLARIDADE.cpuReacaoMs.max - POLARIDADE.cpuReacaoMs.min)
            else if (t >= s.espera) {
              flipar(j)
              s.espera = null
            }
          }
        }
        desenhar(s)
        const l = s.pista.caixa.limites
        s.rotulo.setPosition(l.centerX, l.bottom + 12).setText(`POLO ${s.pol > 0 ? '+' : '-'}`).setColor(hex(corDe(s.pol)))
      })
    },

    estadoDebug() {
      return { polos: lados.map((s) => s.pol), balas: lados.map((s) => s.pista.balas.lista.filter((b) => b.pol !== undefined).length) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      desligarBotao()
      canal.fechar()
      for (const s of lados) {
        const c = s.pista.coracoes[0]
        if (c?.sprite?.scene) c.sprite.setTint(c.cor)
        for (const b of s.pista.balas.lista) b.pol = undefined
      }
      cofre.limpar()
      lados = []
    },
  }
}
