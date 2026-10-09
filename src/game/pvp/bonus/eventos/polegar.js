import { LARGURA } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { texturaCanvas } from '../../../arte/pixelCanvas.js'
import { etiqueta, texturaImperadorBusto, texturaPolegar, chaoDeAreia } from './arteColiseu.js'

// POLEGAR DO IMPERADOR: o imperador decide as regras da rodada. Um painel
// roxo e dourado aparece entre as caixas com o busto dele e uma roleta de
// regras girando (cada vez mais devagar) até parar numa; aí ele mostra o
// POLEGAR: para cima (regra boa, a plateia vibra) ou para baixo (regra
// ruim, a plateia vaia). A regra vale para os DOIS jogadores (justo) por
// REGRA_MS e o imperador sorteia de novo (nunca a mesma em seguida); durante
// o sorteio não vale regra nenhuma. O nome da regra fica em cima de cada caixa.
//   CONTROLES INVERTIDOS  joy() invertido (a CPU "obedece": não é invertida)
//   CORAÇÃO RÁPIDO/LENTO  pista.fatorCoracao (volta ao valor de antes)
//   CORAÇÃO MINI/GIGANTE  coracao.setTamanho (volta para 1)
//   CAIXA ESCURA          um véu escuro por cima das balas, com um círculo de
//                         luz em volta do coração
// terminar() desfaz a regra em vigor e apaga o painel.

const PRIMEIRO_MS = 150
const SORTEIO_MS = 1300
const REGRA_MS = { min: 2800, max: 3400 }
const PAINEL = { x: LARGURA / 2, y: 236 }
const RAIO_LUZ = 58
const REGRAS = [
  { id: 'invertido', texto: 'CONTROLES\nINVERTIDOS', curto: 'CONTROLES INVERTIDOS', bom: false },
  { id: 'rapido', texto: 'CORAÇÃO\nRÁPIDO', curto: 'CORAÇÃO RÁPIDO', bom: true },
  { id: 'lento', texto: 'CORAÇÃO\nLENTO', curto: 'CORAÇÃO LENTO', bom: false },
  { id: 'escuro', texto: 'CAIXA\nESCURA', curto: 'CAIXA ESCURA', bom: false },
  { id: 'mini', texto: 'CORAÇÃO\nMINI', curto: 'CORAÇÃO MINI', bom: true },
  { id: 'gigante', texto: 'CORAÇÃO\nGIGANTE', curto: 'CORAÇÃO GIGANTE', bom: false },
]
const FATOR = { rapido: 1.45, lento: 0.55 }
const TAMANHO = { mini: 0.55, gigante: 1.75 }
const VERDE = '#60ff80'
const VERMELHO = '#ff5050'

// véu da CAIXA ESCURA: preto com um furo de luz de borda suave no meio (grande o
// bastante para cobrir a maior caixa com o coração num canto)
function texturaEscuro(scene) {
  return texturaCanvas(scene, 'coliseu-escuro', 640, 540, (ctx) => {
    ctx.fillStyle = 'rgba(6,2,10,0.94)'
    ctx.fillRect(0, 0, 640, 540)
    ctx.globalCompositeOperation = 'destination-out'
    const g = ctx.createRadialGradient(320, 270, RAIO_LUZ * 0.55, 320, 270, RAIO_LUZ)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 640, 540)
    ctx.globalCompositeOperation = 'source-over'
  })
}

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  let ativo = false
  let chao = null // areia no chão das caixas
  let t = 0
  let fase = 'espera' // espera -> sorteio -> regra -> sorteio ...
  let faseAte = 0
  let regra = null // em vigor
  let sorteada = null // a que o sorteio vai mostrar
  let anterior = null
  let forcada = null // testes: pvpArena.efeitoBonus.forcarRegra('escuro')
  let giro = { proximo: 0, passo: 60, indice: 0 }
  let fatoresBase = []
  let painel = null // { fundo, busto, mao, texto, titulo }
  let rotulos = []
  let veus = []

  const dono = (j) => arena.donoDaPista?.(j) ?? j

  // ---------- painel ----------

  const criarPainel = () => {
    const { x, y } = PAINEL
    const fundo = arena.add.graphics().setDepth(90)
    fundo.fillStyle(0x000000, 0.45).fillRoundedRect(x - 47, y - 82, 94, 168, 10)
    fundo.fillStyle(0x3a1658, 0.96).fillRoundedRect(x - 45, y - 84, 90, 164, 10)
    fundo.lineStyle(3, 0xf0c050, 1).strokeRoundedRect(x - 45, y - 84, 90, 164, 10)
    fundo.lineStyle(1, 0xffe8a0, 0.6).strokeRoundedRect(x - 40, y - 79, 80, 154, 7)
    fundo.fillStyle(0x24082e, 1).fillRoundedRect(x - 39, y + 22, 78, 46, 5) // placa da regra
    const titulo = etiqueta(arena, x, y - 70, 'O IMPERADOR\nDECIDE...', { cor: '#ffe080', tamanho: 9 }).setDepth(91).setAlign('center').setLineSpacing(2)
    const busto = arena.add.image(x - 8, y - 18, texturaImperadorBusto(arena)).setScale(1.4).setDepth(91)
    const mao = arena.add.image(x + 29, y - 14, texturaPolegar(arena)).setScale(1.2).setDepth(92).setVisible(false)
    const texto = etiqueta(arena, x, y + 45, '', { cor: '#ffffff', tamanho: 11 }).setDepth(92).setAlign('center').setLineSpacing(4)
    painel = { fundo, titulo, busto, mao, texto, objetos: [fundo, titulo, busto, mao, texto] }
    for (const o of painel.objetos) o.setAlpha(0)
    arena.tweens.add({ targets: painel.objetos, alpha: 1, duration: 200 })
  }

  // ---------- regras ----------

  const aplicar = (r) => {
    regra = r
    arena.pistas.forEach((pista, j) => {
      if (r.id in FATOR) pista.fatorCoracao = fatoresBase[j] * FATOR[r.id]
      if (r.id in TAMANHO) for (const c of pista.coracoes) c.setTamanho(TAMANHO[r.id])
      if (r.id === 'escuro') {
        const v = arena.add.image(0, 0, texturaEscuro(arena)).setDepth(8).setAlpha(0)
        pista.caixa.recortar(v)
        arena.tweens.add({ targets: v, alpha: 1, duration: 300 })
        veus[j] = v
      }
      const l = pista.caixa.limites
      const rot = etiqueta(arena, l.centerX, l.top - 12, r.curto + '!', { cor: r.bom ? VERDE : VERMELHO, tamanho: 12 })
      arena.tweens.add({ targets: rot, scale: { from: 1.6, to: 1 }, duration: 200, ease: 'Back.easeOut' })
      rotulos.push(rot)
    })
  }

  const desfazer = () => {
    if (!regra) return
    arena.pistas.forEach((pista, j) => {
      if (regra.id in FATOR) pista.fatorCoracao = fatoresBase[j]
      if (regra.id in TAMANHO) for (const c of pista.coracoes) c.setTamanho(1)
    })
    for (const v of veus) if (v) arena.tweens.add({ targets: v, alpha: 0, duration: 200, onComplete: () => v.destroy() })
    veus = []
    for (const r of rotulos) arena.tweens.add({ targets: r, alpha: 0, duration: 150, onComplete: () => r.destroy() })
    rotulos = []
    regra = null
  }

  const comecarSorteio = () => {
    desfazer()
    let k
    do k = Math.floor(sorte() * REGRAS.length)
    while (REGRAS[k].id === anterior)
    sorteada = REGRAS.find((r) => r.id === forcada) ?? REGRAS[k]
    forcada = null
    anterior = sorteada.id
    giro = { proximo: 0, passo: 55, indice: Math.floor(sorte() * REGRAS.length) }
    fase = 'sorteio'
    faseAte = t + SORTEIO_MS
    if (!painel) criarPainel()
    painel.mao.setVisible(false)
    painel.titulo.setText('O IMPERADOR\nDECIDE...')
    tocar(arena, 'roletaGiro', { duracao: SORTEIO_MS / 1000 })
  }

  const girar = () => {
    if (t < giro.proximo) return
    // cada vez mais devagar; a última parada é a sorteada
    const resta = faseAte - t
    giro.indice = (giro.indice + 1) % REGRAS.length
    const r = resta < giro.passo * 1.5 ? sorteada : REGRAS[giro.indice]
    painel.texto.setText(r.texto).setColor('#c8b8e0')
    giro.passo *= 1.16
    giro.proximo = t + giro.passo
    tocar(arena, 'contador')
  }

  const decidir = () => {
    fase = 'regra'
    faseAte = t + REGRA_MS.min + sorte() * (REGRA_MS.max - REGRA_MS.min)
    const r = sorteada
    painel.texto.setText(r.texto).setColor(r.bom ? VERDE : VERMELHO)
    arena.tweens.add({ targets: painel.texto, scale: { from: 1.5, to: 1 }, duration: 220, ease: 'Back.easeOut' })
    painel.titulo.setText(r.bom ? 'POLEGAR\nPRA CIMA!' : 'POLEGAR\nPRA BAIXO!')
    painel.mao.setVisible(true).setFlipY(!r.bom).setTint(0xffffff)
    arena.tweens.killTweensOf(painel.mao)
    arena.tweens.add({ targets: painel.mao, scale: { from: 2.2, to: 1.2 }, angle: { from: r.bom ? -30 : 30, to: 0 }, duration: 260, ease: 'Back.easeOut' })
    arena.tweens.add({ targets: painel.mao, y: { from: painel.mao.y - 2, to: painel.mao.y + 2 }, duration: 260, yoyo: true, repeat: -1, delay: 260 })
    tocar(arena, 'roletaFim')
    tocar(arena, r.bom ? 'polegarCima' : 'polegarBaixo')
    aplicar(r)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      chao = chaoDeAreia(arena)
      t = 0
      fase = 'espera'
      faseAte = PRIMEIRO_MS
      fatoresBase = arena.pistas.map((p) => p.fatorCoracao)
    },

    joy(j, joy) {
      if (!ativo || regra?.id !== 'invertido' || dono(j) === arena.cpu) return joy
      return { x: -joy.x, y: -joy.y }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      chao.atualizar()
      if (fase === 'sorteio') {
        girar()
        if (t >= faseAte) decidir()
      } else if (t >= faseAte) comecarSorteio()
      // o véu da caixa escura segue o coração
      veus.forEach((v, j) => {
        const c = arena.pistas[j]?.coracoes[0]
        if (v && c) v.setPosition(c.x, c.y)
      })
      // rótulo da regra piscando de leve
      for (const r of rotulos) r.setAlpha(r.alpha > 0.2 ? 0.75 + 0.25 * Math.sin(t / 120) : r.alpha)
      if (painel) painel.busto.setY(PAINEL.y - 18 + (fase === 'sorteio' ? Math.sin(t / 50) : 0))
    },

    forcarRegra(id) {
      forcada = id
    },

    estadoDebug() {
      return { fase, regra: regra?.id ?? null, sorteada: sorteada?.id ?? null, fatores: arena.pistas.map((p) => p.fatorCoracao) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      chao?.destruir()
      chao = null
      if (regra) {
        arena.pistas.forEach((pista, j) => {
          if (regra.id in FATOR) pista.fatorCoracao = fatoresBase[j]
          if (regra.id in TAMANHO) for (const c of pista.coracoes) c.setTamanho(1)
        })
      }
      regra = null
      for (const o of [...veus, ...rotulos, ...(painel?.objetos ?? [])]) {
        if (!o?.scene) continue
        arena.tweens.killTweensOf(o)
        o.destroy()
      }
      veus = []
      rotulos = []
      painel = null
    },
  }
}
