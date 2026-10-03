import Phaser from 'phaser'
import { ALTURA, CORES, FONTE, LARGURA, corTexto } from '../../constants.js'
import { PERSONAGENS } from '../../data/personagens.js'
import { tocar } from '../../audio.js'
import { ignorarNasCaixas } from '../../recorte.js'
import { shake } from '../../effects/shake.js'
import { flashTela } from '../../effects/flash.js'
import { motivoDe } from './motivos.js'
import { ANUNCIOS } from './anuncios/index.js'

// O anúncio da carta SUPER (~2,8 s), na revelação, antes do arremesso:
//   1. a tela escurece e uma faixa diagonal na cor do personagem rasga a tela
//      vindo do lado de quem jogou (P1 da esquerda, P2 da direita), com linhas
//      de velocidade correndo por dentro ('superCorte')
//   2. clarão + tremor ('superAtivar'): nome do personagem, "SUPER!" enorme e
//      o nome da carta; o motivo do personagem (pvp/super/motivos.js) toma a tela
//   3. tudo some
// Resolve quando terminou e limpou tudo. Se a cena sair no meio (arena.saindo
// ou shutdown), limpa e resolve na hora.
//
//   await anunciarSuper(arena, { jogador: 0, personagem: 'kris', carta })
//
// Personagem com cinemática própria (pvp/super/anuncios/<personagem>.js,
// export default async function (arena, kit)): ela roda NO LUGAR da genérica.
// kit = { novo, texto, faiscas, depois, esperar, tween, vivo, cor, lado, cy,
//         nome, carta, jogador, personagem }
//   novo(obj)        registra o objeto: fica fora das caixas e é destruído no fim
//   texto(x, y, s, tamanho, cor, extra)   texto com contorno (profundidade 98)
//   esperar(ms) / tween(config)   Promises que resolvem também se a cena sair
//   depois(ms, fn)   timer que só dispara com a cena viva;  vivo()  false se a cena saiu
// A função resolve quando acabou; o anúncio limpa tudo que passou por novo().

const PROF = 95 // véu; faixa 96, motivo 97 (atrás do texto) e 99, texto 98
const ANGULO = -0.2 // inclinação da faixa (rad)
const ALTURA_FAIXA = 128
const DURACAO_MOTIVO = 1900

export async function anunciarSuper(arena, { jogador = 0, personagem, carta } = {}) {
  const objetos = []
  const pendentes = new Set()
  let encerrado = false
  let limpo = false // depois de limpar(), timers atrasados dos motivos não criam mais nada

  const aoSair = () => {
    encerrado = true
    for (const r of [...pendentes]) r()
  }
  arena.events.once('shutdown', aoSair)
  const vivo = () => !encerrado && !limpo && !arena.saindo

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
    if (!obj.depth) obj.setDepth(PROF)
    ignorarNasCaixas(arena, obj)
    objetos.push(obj)
    return obj
  }
  const texto = (x, y, conteudo, tamanho, cor, extra = {}) =>
    novo(
      arena.add
        .text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 6, align: 'center', ...extra })
        .setOrigin(0.5)
        .setDepth(98),
    )
  const faiscas = (x, y, cor, quantidade = 14) => {
    if (!vivo()) return
    const emissor = novo(
      arena.add.particles(x, y, 'faisca', {
        speed: { min: 60, max: 260 },
        angle: { min: 0, max: 360 },
        lifespan: 600,
        scale: { start: 1.4, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [cor, 0xffffff],
        blendMode: 'ADD',
        emitting: false,
      }),
    )
    emissor.setDepth(99)
    emissor.explode(quantidade)
  }
  const depois = (ms, fn) => arena.time.delayedCall(ms, () => vivo() && fn())

  const limpar = () => {
    limpo = true
    arena.events.off('shutdown', aoSair)
    // inclui os filhos de containers (as linhas da faixa têm tween com repeat -1)
    if (!encerrado) arena.tweens.killTweensOf([...objetos, ...objetos.flatMap((o) => o.list ?? [])])
    objetos.forEach((o) => o.destroy())
    objetos.length = 0
  }

  const info = PERSONAGENS[personagem]
  const cor = info?.cor ?? CORES.almas[jogador] ?? 0xffffff
  const lado = jogador === 0 ? -1 : 1
  const cy = ALTURA * 0.42
  const nome = (info?.nome ?? personagem ?? '').toUpperCase()

  try {
    // ---------- cinemática própria do personagem (pvp/super/anuncios/<personagem>.js) ----------
    const propria = ANUNCIOS[personagem]
    if (propria) {
      await propria(arena, { novo, texto, faiscas, depois, esperar, tween, vivo, cor, lado, cy, nome, carta, jogador, personagem })
      return
    }

    // ---------- escurece e a faixa rasga a tela ----------
    const veu = novo(arena.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setAlpha(0))
    tocar(arena, 'superCorte')
    arena.tweens.add({ targets: veu, alpha: 0.82, duration: 160 })

    const faixa = novo(arena.add.container(lado * LARGURA * 1.4 + LARGURA / 2, cy).setDepth(96).setRotation(ANGULO))
    const larg = LARGURA * 1.8
    const fundo = arena.add.rectangle(0, 0, larg, ALTURA_FAIXA, cor, 0.92)
    const sombra = arena.add.rectangle(0, 0, larg, ALTURA_FAIXA * 0.55, 0x000000, 0.28)
    const bordaA = arena.add.rectangle(0, -ALTURA_FAIXA / 2, larg, 5, 0xffffff)
    const bordaB = arena.add.rectangle(0, ALTURA_FAIXA / 2, larg, 5, 0xffffff)
    faixa.add([fundo, sombra, bordaA, bordaB])
    // linhas de velocidade correndo pela faixa, no sentido do golpe
    for (let i = 0; i < 14; i++) {
      const y = Phaser.Math.Between(-ALTURA_FAIXA / 2 + 8, ALTURA_FAIXA / 2 - 8)
      const linha = arena.add.rectangle(lado * larg * 0.5, y, Phaser.Math.Between(80, 220), Phaser.Math.Between(2, 4), 0xffffff, Phaser.Math.FloatBetween(0.3, 0.7))
      faixa.add(linha)
      arena.tweens.add({ targets: linha, x: -lado * larg * 0.5, duration: Phaser.Math.Between(260, 480), delay: i * 30, repeat: -1 })
    }
    await tween({ targets: faixa, x: LARGURA / 2, duration: 230, ease: 'Cubic.easeOut' })
    if (!vivo()) return

    // ---------- impacto: clarão, texto e o motivo do personagem ----------
    tocar(arena, 'superAtivar')
    novo(flashTela(arena, 0xffffff, 0.7, 260))
    shake(arena, 320, 0.016)
    motivoDe(personagem)(arena, { novo, cor, lado, cy, vivo, depois, faiscas })

    const quem = texto(LARGURA / 2 - lado * 40, cy - 44, nome, 20, corTexto(cor), { strokeThickness: 5 }).setAlpha(0)
    arena.tweens.add({ targets: quem, x: LARGURA / 2, alpha: 1, duration: 220, ease: 'Cubic.easeOut' })
    const grito = texto(LARGURA / 2, cy + 2, 'SUPER!', 58, '#ffe14a', { strokeThickness: 9 }).setScale(3).setAlpha(0).setRotation(ANGULO * 0.5)
    arena.tweens.add({ targets: grito, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' })
    arena.tweens.add({ targets: grito, scale: 1.08, delay: 260, duration: 180, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' })
    const cartaNome = texto(LARGURA / 2, cy + 48, carta?.nome ?? '', 22, '#ffffff', { strokeThickness: 6 }).setAlpha(0).setScale(0.6)
    arena.tweens.add({ targets: cartaNome, alpha: 1, scale: 1, delay: 180, duration: 240, ease: 'Back.easeOut' })
    faiscas(LARGURA / 2, cy, cor, 30)

    await esperar(DURACAO_MOTIVO)
    if (!vivo()) return

    // ---------- some: a faixa sai pelo outro lado ----------
    tocar(arena, 'superCorte')
    arena.tweens.add({ targets: faixa, x: -lado * LARGURA * 1.4 + LARGURA / 2, duration: 260, ease: 'Cubic.easeIn' })
    await tween({ targets: objetos.filter((o) => o !== faixa && o.scene), alpha: 0, duration: 280 })
  } finally {
    limpar()
  }
}
