import Phaser from 'phaser'
import { LARGURA, ALTURA, CORES, FONTE } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { CORES_FESTA, chuvaConfete, canhoesConfete } from '../../../effects/festa.js'
import { particulas } from '../../../effects/particulas.js'
import { ignorarNasCaixas } from '../../../recorte.js'
import { transformarTela, restaurarTela } from './pontaCabeca.js'

// MODO FESTA: a arena vira uma balada. Uma bola de discoteca desce no alto,
// girando e soltando raios; holofotes coloridos varrem a tela; chove confete
// (com canhões de vez em quando); a tela pulsa no ritmo (zoom em volta do
// centro, ~a cada BATIDA_MS, câmeras das caixas juntas: transformarTela) e as
// bordas das caixas trocam de cor como arco-íris. Balões sobem pelas caixas:
// são balas lentas (dano baixo) que estouram quando encostam no coração.

const BATIDA_MS = 450
const PULSO_ZOOM = 0.022 // quanto a tela "pula" em cada batida
const SOM_MS = 2700 // tocar 'festa' a cada
const CANHAO_MS = 5200 // canhões de confete a cada
const BALAO = { intervalo: 1150, velocidade: { min: 42, max: 62 }, raio: 9, dano: 2, balanco: 22 }
const HOLOFOTES = 4
const BOLA_Y = 46 // onde a bola de discoteca para

// cor do arco-íris para a fase k (0..1)
const arcoIris = (k) => Phaser.Display.Color.HSVToRGB(((k % 1) + 1) % 1, 0.75, 1).color

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + (b - a) * sorte()
  const escolher = (lista) => lista[Math.floor(sorte() * lista.length)]
  const vivos = new Set()
  let ativo = false
  let ligado = false
  let t = 0
  let batida = 0 // ms desde a última batida
  let proximoSom = 0
  let proximoCanhao = CANHAO_MS
  let proximoBalao = [0, 0]
  let baloes = [] // { j, bala }
  let bola = null
  let fio = null
  let raios = null
  let holofotes = []
  let confete = null

  const guardar = (o) => {
    vivos.add(o)
    o.once?.('destroy', () => vivos.delete(o))
    ignorarNasCaixas(arena, o) // tudo daqui é de tela (os balões são balas, ficam fora disto)
    return o
  }

  // ---------- montagem ----------

  const criarBola = () => {
    fio = guardar(arena.add.rectangle(LARGURA / 2, 0, 2, 1, 0xcccccc).setOrigin(0.5, 0).setDepth(64))
    if (arena.textures.exists('bonus-bola-disco')) {
      bola = arena.add.image(LARGURA / 2, -40, 'bonus-bola-disco')
      bola.setScale(44 / Math.max(1, bola.width))
    } else {
      bola = arena.add.circle(LARGURA / 2, -40, 20, 0xd8d8e8).setStrokeStyle(2, 0xffffff)
    }
    guardar(bola).setDepth(65)
    arena.tweens.add({ targets: bola, y: BOLA_Y, duration: 1100, ease: 'Bounce.easeOut' })
    // raios saindo da bola (girando)
    if (arena.textures.exists('raio')) {
      const lista = []
      for (let i = 0; i < 10; i++) {
        lista.push(
          arena.add
            .image(0, 0, 'raio')
            .setOrigin(0.5, 1)
            .setScale(0.8, 2.4)
            .setRotation((i / 10) * Math.PI * 2)
            .setTint(CORES_FESTA[i % CORES_FESTA.length])
            .setBlendMode(Phaser.BlendModes.ADD),
        )
      }
      raios = guardar(arena.add.container(LARGURA / 2, -40, lista).setDepth(2).setAlpha(0.13))
    }
  }

  const criarHolofotes = () => {
    const tem = arena.textures.exists('bonus-holofote')
    for (let i = 0; i < HOLOFOTES; i++) {
      const cor = CORES_FESTA[(i * 2) % (CORES_FESTA.length - 1)] // sem o branco
      const h = tem ? arena.add.image(0, 0, 'bonus-holofote').setTint(cor) : arena.add.circle(0, 0, 32, cor)
      h.setScale((tem ? 150 / Math.max(1, h.width) : 2.3) * entre(0.85, 1.15)).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
      h.setData('fase', entre(0, Math.PI * 2)).setData('vel', entre(0.6, 1.1) * (i % 2 ? 1 : -1))
      guardar(h).setDepth(93)
      arena.tweens.add({ targets: h, alpha: 0.32, duration: 500 })
      holofotes.push(h)
    }
  }

  // ---------- balões (balas lentas que sobem) ----------

  const soltarBalao = (j) => {
    const pista = arena.pistas?.[j]
    if (!pista?.atacando || arena.ko?.[j]) return
    const l = pista.caixa.limites
    const x0 = entre(l.left + 18, l.right - 18)
    const fase = entre(0, Math.PI * 2)
    const cor = escolher(CORES_FESTA.slice(0, -1))
    const bala = pista.balas.criar({
      x: x0,
      y: l.bottom + 16,
      vy: -entre(BALAO.velocidade.min, BALAO.velocidade.max),
      raio: BALAO.raio,
      dano: BALAO.dano,
      cor,
      pulso: 0.04,
      vida: 6000,
      origem: 'bonus-festa-balao',
      // balança de um lado para o outro enquanto sobe
      atualizar: (b) => {
        const s = Math.sin(b.idade / 420 + fase)
        b.x = x0 + s * BALAO.balanco
        b.sprite.rotation = -s * 0.25
      },
    })
    // a bala nasce com a textura bala-bola: troca pelo balão (o tamanho da colisão não muda)
    if (arena.textures.exists('bonus-balao')) {
      const s = bala.sprite.setTexture('bonus-balao').setOrigin(0.5, 0.4)
      s.setScale((BALAO.raio * 2.6) / Math.max(1, s.width))
      bala.escalaX = s.scaleX
      bala.escalaY = s.scaleY
    }
    baloes.push({ j, bala, cor })
  }

  // balão que morreu dentro da caixa antes de acabar a vida: estourou no coração
  const conferirBaloes = () => {
    baloes = baloes.filter(({ j, bala, cor }) => {
      if (!bala.morta) return arena.pistas?.[j]?.balas.lista.includes(bala)
      const l = arena.pistas?.[j]?.caixa.limites
      if (l && bala.vida > 0 && Phaser.Geom.Rectangle.Contains(l, bala.x, bala.y)) {
        particulas(arena, bala.x, bala.y, { cor, quantidade: 12, velocidade: 140, vida: 380 })
        estouro(bala.x, bala.y)
      }
      return false
    })
  }

  const estouro = (x, y) => {
    const txt = arena.add.text(x, y - 6, 'POP!', { fontFamily: FONTE, fontSize: '11px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 })
    guardar(txt.setOrigin(0.5).setDepth(95))
    arena.tweens.add({ targets: txt, y: y - 26, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => txt.destroy() })
  }

  // ---------- frame ----------

  // pulso da tela no postupdate (depois das caixas refazerem as câmeras delas)
  function aoPosUpdate() {
    const k = Math.exp(-batida / 110)
    transformarTela(arena, 0, 1 + PULSO_ZOOM * k)
  }

  const desligar = () => {
    if (!ligado) return
    ligado = false
    arena.events.off('postupdate', aoPosUpdate)
    arena.events.off('shutdown', encerrar)
    restaurarTela(arena)
  }

  // bordas das caixas de volta à cor do dono
  const restaurarBordas = () => {
    ;(arena.pistas ?? []).forEach((p, j) => p.caixa.retangulo?.scene && p.caixa.retangulo.setStrokeStyle(4, CORES.almas[j]))
  }

  function encerrar() {
    ativo = false
    desligar()
    for (const o of [...vivos]) {
      arena.tweens?.killTweensOf(o)
      o.destroy()
    }
    vivos.clear()
    holofotes = []
    baloes = []
    bola = fio = raios = confete = null
    restaurarBordas()
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      batida = 0
      proximoBalao = [entre(300, 700), entre(600, 1000)]
      tocar(arena, 'festa')
      proximoSom = SOM_MS
      criarBola()
      criarHolofotes()
      confete = guardar(chuvaConfete(arena, 92))
      canhoesConfete(arena, 50, 92) // se destroem sozinhos (~3s)
      arena.events.on('postupdate', aoPosUpdate)
      arena.events.once('shutdown', encerrar)
      ligado = true
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      batida += delta
      if (batida >= BATIDA_MS) batida %= BATIDA_MS

      // bola girando (balança + brilho) e raios
      if (bola) {
        bola.rotation = Math.sin(t / 300) * 0.25
        fio.setSize(2, Math.max(1, bola.y - 18))
        if (raios) raios.setPosition(bola.x, bola.y).setRotation(t / 1400)
        if (sorte() < delta / 160) particulas(arena, bola.x + entre(-18, 18), bola.y + entre(-18, 18), { cor: escolher(CORES_FESTA), quantidade: 3, velocidade: 60, vida: 300 })
      }

      // holofotes varrendo a tela
      holofotes.forEach((h, i) => {
        const f = h.getData('fase') + (t / 1000) * h.getData('vel')
        h.setPosition(LARGURA / 2 + Math.cos(f) * LARGURA * 0.42, ALTURA / 2 + Math.sin(f * 1.7 + i) * ALTURA * 0.36)
        if (batida < delta) h.setTint(escolher(CORES_FESTA.slice(0, -1))) // troca de cor na batida
      })

      // bordas arco-íris (o vermelho do dano da arena tem prioridade)
      ;(arena.pistas ?? []).forEach((p, j) => {
        const r = p.caixa.retangulo
        if (!r?.scene || r.strokeColor === 0xff3048) return
        r.setStrokeStyle(4, arcoIris(t / 1600 + j * 0.5))
      })

      // balões
      for (let j = 0; j < 2; j++) {
        proximoBalao[j] -= delta
        if (proximoBalao[j] <= 0) {
          proximoBalao[j] = (BALAO.intervalo / aceleracao) * entre(0.75, 1.25)
          soltarBalao(j)
        }
      }
      conferirBaloes()

      proximoSom -= delta
      if (proximoSom <= 0) {
        proximoSom = SOM_MS
        tocar(arena, 'festa')
      }
      proximoCanhao -= delta
      if (proximoCanhao <= 0) {
        proximoCanhao = CANHAO_MS
        canhoesConfete(arena, 40, 92)
      }
    },

    terminar() {
      encerrar()
    },
  }
}
