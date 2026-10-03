import { FONTE, LARGURA, corTexto } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { ignorarNasCaixas } from '../../../recorte.js'
import { particulas } from '../../../effects/particulas.js'

// CORAÇÃO TROCADO: os corações trocam de caixa. Cada um continua guiando o
// PRÓPRIO coração, só que agora ele está na caixa do outro: você desvia do
// ataque que VOCÊ jogou (e o outro, do dele). Acerto na caixa j tira HP de
// quem está nela. Contra a CPU: ela desvia normalmente na sua caixa (o bot de
// sempre) e você desvia na dela.
//
// Quem faz a troca de verdade é a arena: arena.coracoesTrocados = true liga
// donoDaPista/pistaDe (joystick, dano, graze, K.O. e ♦ Q/K seguem o coração).
// Aqui fica só o visual: cada coração "voa" em arco até a outra caixa (uns
// 450ms, invencível no caminho) e chega com a cor do dono; cada caixa ganha a
// etiqueta "↓ CORAÇÃO DO Px ↓".

const COR = 0xff8aa8
const VOO = 450 // ms do voo de uma caixa para a outra
const outro = (j) => 1 - j

export default function criar(arena) {
  let ativo = false
  let objetos = [] // objetos de tela (textos, fantasmas)
  let tweens = []
  let coracoes = [] // por pista: { coracao, cor, escala } (como estavam antes)

  const texto = (x, y, conteudo, tamanho, cor, profundidade) => {
    const obj = arena.add
      .text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5)
      .setDepth(profundidade)
    ignorarNasCaixas(arena, obj)
    objetos.push(obj)
    return obj
  }

  const animar = (config) => {
    const tw = arena.tweens.add(config)
    tweens.push(tw)
    return tw
  }

  const nomeDoCoracao = (p) => {
    const nome = arena.rotulo?.(p) ?? `P${p + 1}`
    return nome === 'CPU' ? '↓ CORAÇÃO DA CPU ↓' : `↓ CORAÇÃO DO ${nome} ↓`
  }

  // Um coração "fantasma" (fora das caixas) voa do coração da pista `de` até
  // o coração da pista `para` (que se mexe: o alvo é seguido a cada frame)
  const voar = (de, para, cor, escala, aoChegar) => {
    const origem = arena.pistas[de].coracoes[0]
    const destino = arena.pistas[para].coracoes[0]
    const x0 = origem.x
    const y0 = origem.y
    const fantasma = arena.add.image(x0, y0, 'coracao').setTint(cor).setScale(escala).setDepth(96)
    ignorarNasCaixas(arena, fantasma)
    objetos.push(fantasma)
    const altura = 90 + Math.abs(destino.x - x0) * 0.15 // arco por cima do meio da tela
    animar({
      targets: { p: 0 },
      p: 1,
      duration: VOO,
      ease: 'Sine.easeInOut',
      onUpdate: (tw, alvo) => {
        if (!fantasma.scene) return
        const p = alvo.p
        const x = x0 + (destino.x - x0) * p
        const y = y0 + (destino.y - y0) * p - Math.sin(p * Math.PI) * altura
        fantasma.setPosition(x, y).setAngle((para > de ? 1 : -1) * 360 * p).setScale(escala * (1 + Math.sin(p * Math.PI) * 0.7))
      },
      onComplete: () => {
        fantasma.setVisible(false)
        aoChegar()
      },
    })
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      arena.coracoesTrocados = true
      tocar(arena, 'trocar')

      coracoes = arena.pistas.map((pista) => {
        const coracao = pista.coracoes[0]
        return { coracao, cor: coracao?.cor, escala: coracao?.sprite?.scale ?? 1 }
      })

      coracoes.forEach(({ coracao, cor, escala }, j) => {
        if (!coracao?.sprite?.scene) return
        const k = outro(j)
        coracao.invencivelMs = Math.max(coracao.invencivelMs, VOO + 250)
        coracao.sprite.setAlpha(0)
        if (coracao.ativo) particulas(arena, coracao.x, coracao.y, { cor, quantidade: 10, velocidade: 120 })
        // o coração que sai da pista j (cor dele) pousa na pista k
        voar(j, k, cor, escala, () => {
          const chegou = arena.pistas[k].coracoes[0]
          if (!chegou?.sprite?.scene) return
          chegou.cor = coracoes[j].cor // partículas de dano/K.O. na cor do dono
          chegou.sprite.setTint(coracoes[j].cor).setAlpha(1).setScale(escala * 1.8)
          animar({ targets: chegou.sprite, scale: escala, duration: 220, ease: 'Back.easeOut' })
          if (chegou.ativo) particulas(arena, chegou.x, chegou.y, { cor: coracoes[j].cor, quantidade: 14, velocidade: 140 })
        })
      })

      // "P1 ⇄ P2" no meio da tela, girando e sumindo
      const nomes = [0, 1].map((j) => arena.rotulo?.(j) ?? `P${j + 1}`)
      const meio = arena.pistas.map((p) => p.caixa.limites.centerY).reduce((a, b) => a + b, 0) / 2
      const grande = texto(LARGURA / 2, meio, `${nomes[0]} ⇄ ${nomes[1]}`, 26, corTexto(COR), 96).setScale(0.2)
      const sub = texto(LARGURA / 2, meio + 26, 'desvie do SEU ataque!', 13, '#ffffff', 96).setAlpha(0)
      animar({ targets: grande, scale: 1.2, angle: 360, duration: 420, ease: 'Back.easeOut' })
      animar({ targets: sub, alpha: 1, delay: 300, duration: 200 })
      animar({ targets: [grande, sub], alpha: 0, delay: 1400, duration: 350 })

      // etiqueta em cima de cada caixa: de quem é o coração que está nela
      arena.pistas.forEach((pista, j) => {
        const k = outro(j)
        const l = pista.caixa.limites
        const etiqueta = texto(l.centerX, l.top - 12, nomeDoCoracao(k), 11, corTexto(coracoes[k].cor ?? COR), 42).setAlpha(0).setScale(1.6)
        etiqueta.pista = pista
        animar({ targets: etiqueta, alpha: 1, scale: 1, delay: VOO, duration: 260, ease: 'Back.easeOut' })
      })
    },

    atualizar() {
      if (!ativo) return
      for (const o of objetos) {
        if (!o.pista) continue
        const l = o.pista.caixa.limites
        o.setPosition(l.centerX, l.top - 12)
      }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      arena.coracoesTrocados = false
      for (const tw of tweens) {
        try {
          tw.stop()
        } catch {
          // a cena já saiu: os tweens já foram destruídos
        }
      }
      tweens = []
      // corações voltam à cor, ao tamanho e à opacidade de antes
      for (const { coracao, cor, escala } of coracoes) {
        if (!coracao?.sprite?.scene) continue
        if (cor !== undefined) coracao.cor = cor
        coracao.sprite.setTint(coracao.cor).setScale(escala).setAlpha(1)
      }
      coracoes = []
      objetos.forEach((o) => o.destroy())
      objetos = []
    },
  }
}
