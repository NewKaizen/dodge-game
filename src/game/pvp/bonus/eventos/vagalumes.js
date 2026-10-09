import Phaser from 'phaser'
import { LARGURA, ALTURA, CORES } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { ignorarNasCaixas } from '../../../recorte.js'
import { texturasJardim } from '../../../arte/jardim.js'

// VAGA-LUMES (arena JARDIM): anoitece no jardim. As caixas ficam no escuro e
// quem ilumina são os VAGA-LUMES: cada caixa tem alguns voando, cada um com a
// sua bolha de luz, piscando devagar. Diferente do APAGÃO, a luz não segue o
// coração: ela ANDA (os vaga-lumes rondam a região do coração, mas soltos, e
// dois deles passeiam pela caixa toda). O coração tem só um brilho fraquinho
// em volta dele. Como no apagão, as balas que ainda estão avisando piscam um
// contorno por cima do escuro, e o escuro não é total (dá para ver o
// "fantasma" das balas). Grilos cantando e um "pling" de vez em quando.
//
// O escuro de cada caixa é uma RenderTexture: a cada frame ela é pintada de
// preto e as luzes são APAGADAS dela (erase com a textura de brilho), então
// várias luzes juntas somam sem problema. Recortada na caixa (pista.caixa.recortar).

const ESCURO = 0.95 // alpha do escuro dentro das caixas (as balas aparecem bem fraquinhas)
const ESCURO_TELA = 0.68 // véu do resto da tela
const ANOITECE_MS = 900 // o escuro chega devagar
const FOLGA = 50 // a RenderTexture passa da caixa (a caixa pode crescer até 40 px)
const VAGALUMES = 5 // por caixa
const LIVRES = 2 // destes, quantos passeiam pela caixa toda (o resto ronda o coração)
const LUZ = { min: 72, max: 100 } // diâmetro (px) da bolha de luz de cada vaga-lume
const BRILHO_CORACAO = 44 // diâmetro do brilho fraquinho do coração
const VERDE = 0xd8ff6a
const GRILO = { min: 1400, max: 3200 }

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  let ativo = false
  let t = 0
  let proximoGrilo = 0
  let proximoPling = 0
  let veu = null
  let caixas = [] // por pista: { pista, rt, luzes: [{ x, y, ... , borracha, chao, corpo, halo }], borrachaCoracao, avisos }
  let telaVagalumes = []

  const escuroAgora = () => Math.min(1, t / ANOITECE_MS)

  const criarCaixa = (pista) => {
    const l = pista.caixa.limites
    const rt = arena.add.renderTexture(0, 0, Math.ceil(l.width + FOLGA * 2), Math.ceil(l.height + FOLGA * 2)).setOrigin(0).setDepth(9.5)
    // borrachas: imagens fora da cena, usadas só para apagar o escuro (uma por luz:
    // os comandos da RenderTexture guardam o objeto e desenham no render())
    const borracha = () => arena.make.image({ key: 'jardim-brilho', add: false })
    const luzes = Array.from({ length: VAGALUMES }, (_, k) => {
      const livre = k < LIVRES
      // por baixo do escuro: um brilho esverdeado no chão da caixa onde a luz bate
      const chao = arena.add.image(0, 0, 'jardim-brilho').setTint(VERDE).setBlendMode(Phaser.BlendModes.ADD).setDepth(2)
      // por cima do escuro: o próprio vaga-lume (pontinho e halo)
      const halo = arena.add.image(0, 0, 'jardim-brilho').setTint(VERDE).setBlendMode(Phaser.BlendModes.ADD).setDepth(9.7)
      const corpo = arena.add.rectangle(0, 0, 2.5, 2.5, 0xf6ffb0).setDepth(9.8)
      pista.caixa.recortar(chao, halo, corpo)
      return {
        livre, borracha: borracha(), chao, halo, corpo,
        x: l.left + entre(0.2, 0.8) * l.width, y: l.top + entre(0.2, 0.8) * l.height,
        ancora: { x: l.centerX, y: l.centerY },
        raio: entre(28, 62), giro: entre(0.5, 0.9) * (sorte() < 0.5 ? -1 : 1), fase: entre(0, 6.3),
        tam: entre(LUZ.min, LUZ.max), pisca: entre(0.7, 1.3),
        ax: entre(0.25, 0.45), ay: entre(0.3, 0.5),
      }
    })
    const avisos = arena.add.graphics().setDepth(9.6)
    pista.caixa.recortar(rt, avisos)
    return { pista, rt, luzes, borrachaCoracao: borracha(), avisos }
  }

  const moverLuz = (luz, c, l, delta) => {
    const s = t / 1000
    let alvoX
    let alvoY
    if (luz.livre || !c?.ativo) {
      // passeio em curvas pela caixa toda
      alvoX = l.centerX + Math.sin(s * luz.ax + luz.fase) * l.width * 0.42
      alvoY = l.centerY + Math.sin(s * luz.ay + luz.fase * 1.7) * l.height * 0.4
    } else {
      // a âncora segue o coração com atraso; o vaga-lume dá voltas soltas em volta dela
      const k = Math.min(1, delta / 1400)
      luz.ancora.x += (c.x - luz.ancora.x) * k
      luz.ancora.y += (c.y - luz.ancora.y) * k
      const a = s * luz.giro + luz.fase
      const r = luz.raio * (0.8 + 0.3 * Math.sin(s * 0.7 + luz.fase))
      alvoX = luz.ancora.x + Math.cos(a) * r
      alvoY = luz.ancora.y + Math.sin(a * 1.3) * r * 0.8
    }
    const k = Math.min(1, delta / 500)
    luz.x += (alvoX - luz.x) * k + Math.sin(s * 5 + luz.fase) * 0.3
    luz.y += (alvoY - luz.y) * k + Math.cos(s * 4 + luz.fase) * 0.3
    luz.x = Phaser.Math.Clamp(luz.x, l.left + 4, l.right - 4)
    luz.y = Phaser.Math.Clamp(luz.y, l.top + 4, l.bottom - 4)
  }

  // contornos piscando das balas que ainda estão avisando (igual ao apagão)
  const desenharAvisos = (cx) => {
    const g = cx.avisos
    g.clear()
    const escuro = escuroAgora()
    if (escuro < 0.3) return
    for (const b of cx.pista.balas.lista) {
      if (b.morta || b.idade >= b.aviso) continue
      const a = (Math.sin(b.idade / 45) > 0 ? 0.9 : 0.3) * escuro
      g.lineStyle(2, CORES.aviso, a)
      if (b.tipo === 'circulo') g.strokeCircle(b.x, b.y, (b.raio ?? 6) + 2)
      else if (b.tipo === 'retangulo') g.strokeRect(b.x - b.largura / 2, b.y - b.altura / 2, b.largura, b.altura)
      else {
        const cos = Math.cos(b.angulo) * (b.comprimento / 2)
        const sin = Math.sin(b.angulo) * (b.comprimento / 2)
        g.lineBetween(b.x - cos, b.y - sin, b.x + cos, b.y + sin)
      }
    }
  }

  const atualizarCaixa = (cx, delta) => {
    const l = cx.pista.caixa.limites
    const c = cx.pista.coracoes[0]
    const x0 = Math.round(l.left - FOLGA)
    const y0 = Math.round(l.top - FOLGA)
    const escuro = escuroAgora()
    const s = t / 1000
    cx.rt.setPosition(x0, y0)
    cx.rt.clear()
    cx.rt.fill(0x000000, ESCURO * escuro)
    const borrachas = []
    for (const luz of cx.luzes) {
      moverLuz(luz, c, l, delta)
      // pisca: acende e apaga devagar, nunca some de vez
      const brilho = 0.55 + 0.45 * Math.sin(s * 2.2 * luz.pisca + luz.fase) ** 2
      const tam = luz.tam * (0.75 + 0.25 * brilho)
      luz.borracha.setPosition(luz.x - x0, luz.y - y0).setDisplaySize(tam, tam).setAlpha(brilho)
      borrachas.push(luz.borracha)
      luz.chao.setPosition(luz.x, luz.y).setDisplaySize(tam * 0.8, tam * 0.8).setAlpha(0.13 * brilho)
      luz.halo.setPosition(luz.x, luz.y).setDisplaySize(14 + brilho * 8, 14 + brilho * 8).setAlpha(0.35 + 0.5 * brilho)
      luz.corpo.setPosition(luz.x, luz.y).setAlpha(0.5 + 0.5 * brilho)
    }
    if (c?.ativo) {
      cx.borrachaCoracao.setPosition(c.x - x0, c.y - y0).setDisplaySize(BRILHO_CORACAO, BRILHO_CORACAO).setAlpha(0.55)
      borrachas.push(cx.borrachaCoracao)
    }
    cx.rt.erase(borrachas)
    cx.rt.render()
    desenharAvisos(cx)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      proximoGrilo = 1200
      proximoPling = 600
      texturasJardim(arena)
      tocar(arena, 'anoitecer')
      // véu da tela (fora das caixas): por baixo dos textos de aviso e do HUD
      veu = arena.add.rectangle(0, 0, LARGURA, ALTURA, 0x050a14).setOrigin(0).setDepth(15).setAlpha(0)
      ignorarNasCaixas(arena, veu)
      caixas = arena.pistas.map(criarCaixa)
      // vaga-lumes soltos pela tela também
      telaVagalumes = Array.from({ length: 14 }, () => {
        const halo = arena.add.image(0, 0, 'jardim-brilho').setTint(VERDE).setBlendMode(Phaser.BlendModes.ADD).setDepth(16)
        ignorarNasCaixas(arena, halo)
        return { halo, x: entre(20, LARGURA - 20), y: entre(80, ALTURA - 20), fase: entre(0, 20), v: entre(0.4, 0.8) }
      })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      const escuro = escuroAgora()
      veu?.setAlpha(ESCURO_TELA * escuro)
      for (const cx of caixas) atualizarCaixa(cx, delta)
      const s = t / 1000
      for (const v of telaVagalumes) {
        const a = Math.max(0, Math.sin(s * v.v * 2 + v.fase)) ** 2 * escuro
        v.halo.setPosition(v.x + Math.sin(s * 0.5 + v.fase) * 20, v.y + Math.sin(s * 0.7 + v.fase * 1.3) * 12).setDisplaySize(16, 16).setAlpha(a)
      }
      if (t >= proximoGrilo) {
        proximoGrilo = t + entre(GRILO.min, GRILO.max)
        tocar(arena, 'grilo')
      }
      if (t >= proximoPling) {
        proximoPling = t + entre(1800, 3500)
        tocar(arena, 'vagalume')
      }
    },

    estadoDebug() {
      return { escuro: Number(escuroAgora().toFixed(2)), luzes: caixas.map((cx) => cx.luzes.map((l) => ({ x: Math.round(l.x), y: Math.round(l.y) }))) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      veu?.destroy()
      veu = null
      for (const cx of caixas) {
        cx.rt.destroy()
        cx.avisos.destroy()
        cx.borrachaCoracao.destroy()
        for (const luz of cx.luzes) {
          luz.borracha.destroy()
          luz.chao.destroy()
          luz.halo.destroy()
          luz.corpo.destroy()
        }
      }
      caixas = []
      telaVagalumes.forEach((v) => v.halo.destroy())
      telaVagalumes = []
    },
  }
}
