import Phaser from 'phaser'
import { CORACAO } from '../../../../constants.js'
import { fatores } from '../../../../acessibilidade.js'
import { tocar } from '../../../../audio.js'
import { MINHOCA, embrulharCentro, embrulharBala, meiaExtensao } from './planos.js'
import { criarCofre, avisoDoEvento, ehBot, ehEspelho } from './util.js'

// BURACO DE MINHOCA (ESTAÇÃO ESPACIAL): as bordas da caixa são portais ligados. O coração que sai por cima
// aparece embaixo, o que sai pela esquerda entra pela direita (e vice-versa). Vale também para as BALAS (cada
// uma atravessa uma vez só, para a caixa não encher de balas): a bala que sai reaparece do lado oposto, entrando
// de fora como qualquer bala que chega (dá para vê-la na faixa de aproximação antes de valer).
// Bordas de cima/baixo brilham em ciano e as da esquerda/direita em violeta: a cor mostra quem se liga com quem.
// Quando algo atravessa, um anel de luz abre na saída e na entrada.
// O coração usa um retângulo um pouco MAIOR que a caixa como limite (coracao.caixa troca por um proxy durante o
// evento; volta no terminar()); o centro passando da borda = teletransporte. A CPU não atravessa de propósito
// (o joy() a segura dentro da caixa), mas as balas que ela vê reaparecem normalmente.

const CIANO = 0x58e6ff
const VIOLETA = 0xd878ff
const BORDA_PX = 16 // espessura do brilho das bordas

export default function criar(arena) {
  const cofre = criarCofre(arena)
  let ativo = false
  let t = 0
  // por pista: { pista, ext (retângulo expandido), proxy, g, ondas }
  let lados = []

  const meioDoCoracao = (c) => (CORACAO.tamanho * (c.tamanho ?? 1)) / 2

  const atualizarExterno = (s) => {
    const l = s.pista.caixa.limites
    const c = s.pista.coracoes[0]
    const f = meioDoCoracao(c) + MINHOCA.folga
    s.ext.setTo(l.left - f, l.top - f, l.width + f * 2, l.height + f * 2)
  }

  const onda = (s, x, y, cor) => {
    if (fatores().particulas < 0.2) return
    s.ondas.push({ x, y, cor, t0: t })
  }

  const desenhar = (s) => {
    const l = s.pista.caixa.limites
    const g = s.g
    g.clear()
    const pulso = 0.6 + 0.4 * Math.sin(t / 260)
    // brilho das bordas: degradê do portal para dentro
    const faixa = (x, y, w, h, cor, vertical, inverter) => {
      const a = 0.75 * pulso
      if (vertical) g.fillGradientStyle(cor, cor, cor, cor, inverter ? 0 : a, inverter ? 0 : a, inverter ? a : 0, inverter ? a : 0)
      else g.fillGradientStyle(cor, cor, cor, cor, inverter ? 0 : a, inverter ? a : 0, inverter ? 0 : a, inverter ? a : 0)
      g.fillRect(x, y, w, h)
    }
    faixa(l.left, l.top, l.width, BORDA_PX, CIANO, true, false)
    faixa(l.left, l.bottom - BORDA_PX, l.width, BORDA_PX, CIANO, true, true)
    faixa(l.left, l.top, BORDA_PX, l.height, VIOLETA, false, false)
    faixa(l.right - BORDA_PX, l.top, BORDA_PX, l.height, VIOLETA, false, true)
    // fio brilhante e "marcha" de traços correndo pela borda (mostra o sentido do redemoinho)
    g.lineStyle(2, CIANO, 0.9 * pulso)
    g.lineBetween(l.left, l.top + 1, l.right, l.top + 1)
    g.lineBetween(l.left, l.bottom - 1, l.right, l.bottom - 1)
    g.lineStyle(2, VIOLETA, 0.9 * pulso)
    g.lineBetween(l.left + 1, l.top, l.left + 1, l.bottom)
    g.lineBetween(l.right - 1, l.top, l.right - 1, l.bottom)
    const passo = 22
    const deslocamento = (t * 0.04) % passo
    g.fillStyle(0xffffff, 0.75)
    for (let x = l.left + deslocamento; x < l.right; x += passo) {
      g.fillRect(x, l.top + 3, 5, 1.5)
      g.fillRect(l.right - (x - l.left) - 5, l.bottom - 4.5, 5, 1.5)
    }
    for (let y = l.top + deslocamento; y < l.bottom; y += passo) {
      g.fillRect(l.left + 3, l.bottom - (y - l.top) - 5, 1.5, 5)
      g.fillRect(l.right - 4.5, y, 1.5, 5)
    }
    // anéis das travessias
    s.ondas = s.ondas.filter((o) => {
      const k = (t - o.t0) / MINHOCA.brilhoMs
      if (k >= 1) return false
      g.lineStyle(2, o.cor, 0.9 * (1 - k))
      g.strokeCircle(o.x, o.y, 4 + 20 * k)
      return true
    })
  }

  // balas: saiu inteira por um lado, entra pelo outro (uma vez só)
  const embrulharBalas = (s) => {
    const l = s.pista.caixa.limites
    for (const b of s.pista.balas.lista) {
      if (b.morta || b.inofensiva || b.segurada || b.idade < b.aviso) continue
      if (!b.viuDentro) {
        if (b.x >= l.left && b.x <= l.right && b.y >= l.top && b.y <= l.bottom) b.viuDentro = true
        continue
      }
      if ((b.saltos ?? 0) >= MINHOCA.saltosPorBala) continue
      const e = meiaExtensao(b)
      const r = embrulharBala(b.x, b.y, e.x, e.y, l)
      if (!r.saiu) continue
      onda(s, Phaser.Math.Clamp(b.x, l.left, l.right), Phaser.Math.Clamp(b.y, l.top, l.bottom), r.saiu.startsWith('direita') || r.saiu.startsWith('esquerda') ? VIOLETA : CIANO)
      b.x = r.x
      b.y = r.y
      b.saltos = (b.saltos ?? 0) + 1
      b.viuDentro = false // a volta ao jogo conta de novo quando ela entrar
      b.sprite.setPosition(b.x, b.y)
    }
  }

  const embrulharCoracao = (s) => {
    const c = s.pista.coracoes[0]
    if (!c?.ativo) return
    const l = s.pista.caixa.limites
    const r = embrulharCentro(c.x, c.y, l)
    if (!r.saltou) return
    const horizontal = r.saltou.includes('esquerda') || r.saltou.includes('direita')
    onda(s, Phaser.Math.Clamp(c.x, l.left, l.right), Phaser.Math.Clamp(c.y, l.top, l.bottom), horizontal ? VIOLETA : CIANO)
    c.x = r.x
    c.y = r.y
    c.posicionar()
    onda(s, Phaser.Math.Clamp(c.x, l.left, l.right), Phaser.Math.Clamp(c.y, l.top, l.bottom), horizontal ? VIOLETA : CIANO)
    tocar(arena, 'trocar')
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      lados = arena.pistas.map((pista) => {
        const g = cofre.guardar(arena.add.graphics().setDepth(4))
        pista.caixa.recortar(g)
        const ext = new Phaser.Geom.Rectangle(0, 0, 1, 1)
        const s = { pista, ext, proxy: { limites: ext }, g, ondas: [] }
        atualizarExterno(s)
        for (const c of pista.coracoes) c.caixa = s.proxy
        return s
      })
      avisoDoEvento(arena, cofre, 'AS BORDAS SE LIGAM!', { cor: '#c8a0ff' })
      tocar(arena, 'gravidade')
    },

    joy(j, joy) {
      const s = lados[j]
      if (!ativo || !s) return joy
      atualizarExterno(s) // o limite novo já vale neste frame
      if (!ehBot(arena, j)) return joy
      // a CPU não atravessa por acidente: encostou na borda, não empurra para fora
      const c = s.pista.coracoes[0]
      const l = s.pista.caixa.limites
      if (!c?.ativo) return joy
      const perto = 9
      let { x, y } = joy
      if (c.x - l.left < perto && x < 0) x = 0
      if (l.right - c.x < perto && x > 0) x = 0
      if (c.y - l.top < perto && y < 0) y = 0
      if (l.bottom - c.y < perto && y > 0) y = 0
      return { x, y }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      for (const s of lados) {
        if (!ehEspelho(arena, lados.indexOf(s))) embrulharCoracao(s)
        embrulharBalas(s)
        desenhar(s)
      }
    },

    estadoDebug() {
      return { ondas: lados.map((s) => s.ondas.length), saltos: lados.map((s) => s.pista.balas.lista.filter((b) => b.saltos).length) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const s of lados) {
        for (const c of s.pista.coracoes) {
          c.caixa = s.pista.caixa
          if (c.ativo) c.ajustar()
        }
      }
      cofre.limpar()
      lados = []
    },
  }
}
