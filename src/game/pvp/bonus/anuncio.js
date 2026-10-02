import { ALTURA, FONTE, LARGURA, corTexto } from '../../constants.js'
import { tocar } from '../../audio.js'
import { ignorarNasCaixas } from '../../recorte.js'
import { shake } from '../../effects/shake.js'
import { fogoArtificio } from '../../effects/festa.js'

// A revelação do bonus round (~3,3s): a tela escurece, o selo "BONUS ROUND!"
// cai com tremor e explosões, e uma roleta passa pelos nomes dos eventos,
// desacelerando até parar no sorteado (brilho na cor dele + descrição).
// Resolve quando tudo sumiu. Não deixa nada para trás; se a cena sair no
// meio (arena.saindo ou shutdown), limpa e resolve na hora.
//
//   await anunciarBonus(arena, evento, { eventos: EVENTOS, rng })

const PROF = 95 // por cima de tudo (o banner da arena é 96)
const Y_SELO = 150
const Y_ROLETA = 270
const Y_DESCRICAO = 316
const LARGURA_ROLETA = 430
const GIROS = 12 // nomes que passam na roleta (o último é o sorteado)

export async function anunciarBonus(arena, evento, { eventos = [evento], rng = Math.random } = {}) {
  const objetos = []
  const pendentes = new Set()
  let encerrado = false

  const aoSair = () => {
    encerrado = true
    for (const r of [...pendentes]) r()
  }
  arena.events.once('shutdown', aoSair)

  const vivo = () => !encerrado && !arena.saindo

  // Promise que também resolve se a cena sair
  const promessa = (iniciar) =>
    new Promise((resolver) => {
      const fim = () => {
        pendentes.delete(fim)
        resolver()
      }
      pendentes.add(fim)
      if (encerrado) return fim()
      iniciar(fim)
    })
  const esperar = (ms) => promessa((fim) => arena.time.delayedCall(ms, fim))
  const tween = (config) => promessa((fim) => arena.tweens.add({ ...config, onComplete: fim }))

  const novo = (obj) => {
    obj.setDepth(obj.depth || PROF)
    ignorarNasCaixas(arena, obj)
    objetos.push(obj)
    return obj
  }
  const texto = (x, y, conteudo, tamanho, cor, extra = {}) =>
    novo(
      arena.add
        .text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 5, align: 'center', ...extra })
        .setOrigin(0.5)
        .setDepth(PROF + 2),
    )

  const limpar = () => {
    arena.events.off('shutdown', aoSair)
    if (!encerrado) arena.tweens.killTweensOf(objetos)
    objetos.forEach((o) => o.destroy())
    objetos.length = 0
  }

  try {
    // ---------- tela escurece ----------
    const veu = novo(arena.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setAlpha(0).setDepth(PROF))
    tocar(arena, 'bonusRound')
    await tween({ targets: veu, alpha: 0.78, duration: 220 })
    if (!vivo()) return

    // ---------- selo "BONUS ROUND!" ----------
    let selo
    if (arena.textures.exists('bonus-selo')) {
      selo = novo(arena.add.image(LARGURA / 2, Y_SELO, 'bonus-selo').setDepth(PROF + 3))
      selo.setScale(Math.min(380 / Math.max(1, selo.width), 150 / Math.max(1, selo.height)))
    } else {
      selo = texto(LARGURA / 2, Y_SELO, 'BONUS ROUND!', 48, '#ffe040', { strokeThickness: 8 }).setDepth(PROF + 3)
    }
    const escalaSelo = selo.scale
    selo.setScale(escalaSelo * 3.2).setAlpha(0).setAngle(-12)
    await tween({ targets: selo, scale: escalaSelo, alpha: 1, angle: -4, duration: 260, ease: 'Back.easeIn' })
    if (!vivo()) return
    shake(arena, 280, 0.018)
    explosoes(arena, selo, novo, rng)
    arena.tweens.add({ targets: selo, angle: 4, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    await esperar(300)
    if (!vivo()) return

    // ---------- roleta ----------
    const janela = novo(
      arena.add.rectangle(LARGURA / 2, Y_ROLETA, LARGURA_ROLETA, 50, 0x000000, 0.9).setStrokeStyle(3, 0xffffff).setDepth(PROF + 1).setScale(1, 0),
    )
    await tween({ targets: janela, scaleY: 1, duration: 140, ease: 'Back.easeOut' })
    if (!vivo()) return
    const lista = eventos.length ? eventos : [evento]
    const final = Math.max(0, lista.findIndex((ev) => ev.id === evento.id))
    const nomeEm = (k) => lista[(((final - (GIROS - 1 - k)) % lista.length) + lista.length) % lista.length]
    const acima = texto(LARGURA / 2, Y_ROLETA - 34, '', 13, '#ffffff').setAlpha(0.3)
    const abaixo = texto(LARGURA / 2, Y_ROLETA + 34, '', 13, '#ffffff').setAlpha(0.3)
    const nome = texto(LARGURA / 2, Y_ROLETA, '', 24, '#ffffff')
    for (let k = 0; k < GIROS; k++) {
      const ev = k === GIROS - 1 ? evento : nomeEm(k)
      nome.setText(ev.nome).setColor(corTexto(ev.cor ?? 0xffffff)).setY(Y_ROLETA - 12).setScale(1)
      acima.setText(k < GIROS - 1 ? nomeEm(k + 1).nome : '')
      abaixo.setText(k > 0 ? nomeEm(k - 1).nome : '')
      const p = k / (GIROS - 1)
      const ms = 38 + 250 * p ** 2.2
      arena.tweens.add({ targets: nome, y: Y_ROLETA, duration: Math.min(ms, 90), ease: 'Quad.easeOut' })
      if (k < GIROS - 1) {
        tocar(arena, 'roleta')
        await esperar(ms)
        if (!vivo()) return
      }
    }

    // ---------- parou: o sorteado ----------
    tocar(arena, 'roletaFim')
    const cor = evento.cor ?? 0xffffff
    acima.setText('')
    abaixo.setText('')
    janela.setStrokeStyle(3, cor)
    const brilho = novo(arena.add.rectangle(LARGURA / 2, Y_ROLETA, LARGURA_ROLETA, 50, cor, 0.85).setDepth(PROF + 1))
    arena.tweens.add({ targets: brilho, alpha: 0, scaleX: 1.15, scaleY: 1.6, duration: 380, ease: 'Quad.easeOut' })
    nome.setScale(1.5)
    arena.tweens.add({ targets: nome, scale: 1, duration: 260, ease: 'Back.easeOut' })
    shake(arena, 160, 0.008)
    fogoArtificio(arena, LARGURA / 2 - LARGURA_ROLETA / 2 + 20, Y_ROLETA, cor, { quantidade: 20, profundidade: PROF + 2 })
    fogoArtificio(arena, LARGURA / 2 + LARGURA_ROLETA / 2 - 20, Y_ROLETA, cor, { quantidade: 20, profundidade: PROF + 2 })
    const descricao = texto(LARGURA / 2, Y_DESCRICAO, evento.descricao ?? '', 14, '#ffffff', { strokeThickness: 4, wordWrap: { width: LARGURA - 60 } }).setAlpha(0)
    arena.tweens.add({ targets: descricao, alpha: 1, y: Y_DESCRICAO - 4, duration: 260 })
    await esperar(950)
    if (!vivo()) return

    // ---------- some ----------
    arena.tweens.killTweensOf(selo)
    await tween({ targets: objetos.slice(), alpha: 0, duration: 260 })
  } finally {
    limpar()
  }
}

// Explosões em volta do selo: quadros bonus-explosao-0..7 (se existirem) e fogos
function explosoes(arena, selo, novo, rng) {
  const quadros = Array.from({ length: 8 }, (_, k) => `bonus-explosao-${k}`)
  const temQuadros = quadros.every((q) => arena.textures.exists(q))
  const meiaL = (selo.displayWidth || 300) / 2
  const meiaA = (selo.displayHeight || 60) / 2
  const pontos = [
    [-meiaL, -meiaA * 0.4],
    [meiaL, meiaA * 0.3],
    [-meiaL * 0.4, meiaA],
    [meiaL * 0.5, -meiaA],
  ]
  pontos.forEach(([dx, dy], i) => {
    const x = selo.x + dx + (rng() - 0.5) * 24
    const y = selo.y + dy + (rng() - 0.5) * 18
    arena.time.delayedCall(i * 70, () => {
      if (arena.saindo || !selo.scene) return
      if (temQuadros) {
        const img = novo(arena.add.image(x, y, quadros[0]).setDepth(PROF + 2))
        img.setScale(90 / Math.max(1, img.width))
        arena.tweens.addCounter({
          from: 0,
          to: quadros.length - 1,
          duration: 420,
          onUpdate: (tw) => img.scene && img.setTexture(quadros[Math.round(tw.getValue())]),
          onComplete: () => img.scene && img.setVisible(false),
        })
      }
      fogoArtificio(arena, x, y, [0xffe040, 0xff7a1a, 0xff4fd8, 0x6dd0ff][i % 4], { quantidade: 18, profundidade: PROF + 2 })
    })
  })
}
