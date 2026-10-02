import { FONTE, LARGURA, corTexto } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { ignorarNasCaixas } from '../../../recorte.js'
import { particulas } from '../../../effects/particulas.js'
import { EsquivaBot } from '../../botEsquiva.js'

// CORAÇÃO TROCADO: cada um controla o coração do OUTRO. O joystick que iria
// para a pista j vem do jogador outro(j). Contra a CPU: o coração do humano é
// guiado por um bot "travesso" (um EsquivaBot próprio com a saída invertida,
// misturada com um passeio pela caixa: tenta ir para o perigo, mas sem perfeição) e
// o coração da CPU anda com o joystick do humano.
// No começo os corações trocam de cor (a sua cor vai para a caixa que você
// controla) e cada caixa ganha a etiqueta "CONTROLADO PELO Px".
// ♦ Q/K: a inversão continua valendo para a CAIXA invertida (é reaplicada
// aqui em cima do joystick trocado).

const COR = 0xff8aa8
// quanto o bot travesso segue a "anti-esquiva" (o resto é um passeio pela caixa)
const MALDADE = { facil: 0.35, normal: 0.5, dificil: 0.62 }

const outro = (j) => 1 - j

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  let ultimoDelta = 16
  let bot = null
  let objetos = [] // objetos de tela
  let tweens = []
  let coracoes = [] // { coracao, escala }
  const fase = sorte() * Math.PI * 2

  // a mesma regra da arena (update): ♦ Q/K vale enquanto o ataque da pista roda
  const invertida = (j) => Boolean(arena.invertido?.[j]) && arena.pistas[j].atacando && !arena.ko?.[j]

  // a CPU guiando o coração do humano (lado h): vai para onde o bot NÃO iria
  const joyTravesso = (h) => {
    const pista = arena.pistas[h]
    const coracao = pista.coracoes[0]
    if (!pista.rodando || !coracao?.ativo || arena.ko?.[h]) return { x: 0, y: 0 }
    const fuga = bot.joy(ultimoDelta, {
      coracao,
      limites: pista.caixa.limites,
      balas: pista.balas.lista,
      velocidade: pista.velocidadeCoracao,
      fatorVelocidade: pista.balas.fatorVelocidade,
      velocidadeMax: pista.balas.velocidadeMax,
    })
    // passeio: persegue um ponto que dá voltas pela caixa (não fica parado num canto)
    const l = pista.caixa.limites
    const s = t / 1000
    const alvoX = l.centerX + Math.cos(s * 1.3 + fase) * l.width * 0.36 + Math.sin(s * 3.1) * l.width * 0.08
    const alvoY = l.centerY + Math.sin(s * 0.9 + fase * 1.7) * l.height * 0.36 + Math.cos(s * 2.7) * l.height * 0.08
    const dx = alvoX - coracao.x
    const dy = alvoY - coracao.y
    const d = Math.max(1, Math.hypot(dx, dy))
    const forca = Math.min(1, d / 30) * 100
    const m = MALDADE[arena.nivelBot] ?? MALDADE.normal
    const x = (dx / d) * forca * (1 - m) - fuga.x * m
    const y = (dy / d) * forca * (1 - m) - fuga.y * m
    const n = Math.hypot(x, y)
    const k = n > 1 ? Math.min(100, n * 1.5) / n : 0 // a mistura encolhe o vetor: devolve o vigor
    return { x: x * k, y: y * k }
  }

  // quem controla a pista j: o controle do outro lado (ou a CPU)
  const joyDoOutro = (j) => {
    const k = outro(j)
    if (arena.cpu === null || arena.cpu === undefined) return arena.controles.joy(k)
    if (k === arena.cpu) return joyTravesso(j)
    return arena.controles.joy(0) // sozinho: o controle 0 é o do humano
  }

  const quemControla = (j) => {
    const k = outro(j)
    return k === arena.cpu ? 'CONTROLADO PELA CPU' : `CONTROLADO PELO P${k + 1}`
  }

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

  const evento = {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      if (arena.cpu !== null && arena.cpu !== undefined) bot = new EsquivaBot({ nivel: arena.nivelBot, sorte })
      tocar(arena, 'trocar')

      // corações: a cor de cada um vai para a caixa que ele passa a controlar
      coracoes = arena.pistas.map((pista) => ({ coracao: pista.coracoes[0], escala: pista.coracoes[0]?.sprite.scale ?? 1 }))
      coracoes.forEach(({ coracao, escala }, j) => {
        if (!coracao?.sprite?.scene) return
        const corNova = arena.pistas[outro(j)].coracoes[0]?.cor ?? coracao.cor
        animar({
          targets: coracao.sprite,
          scale: escala * 1.8,
          duration: 160,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.easeInOut',
          onYoyo: () => coracao.sprite.setTint(corNova),
          onComplete: () => coracao.sprite.setScale(escala),
        })
        if (coracao.ativo) particulas(arena, coracao.x, coracao.y, { cor: corNova, quantidade: 14, velocidade: 140 })
      })

      // "P1 ⇄ P2" no meio da tela, girando e sumindo
      const nomes = [0, 1].map((j) => arena.rotulo?.(j) ?? `P${j + 1}`)
      const meio = arena.pistas.map((p) => p.caixa.limites.centerY).reduce((a, b) => a + b, 0) / 2
      const grande = texto(LARGURA / 2, meio, `${nomes[0]} ⇄ ${nomes[1]}`, 26, corTexto(COR), 96).setScale(0.2)
      animar({ targets: grande, scale: 1.2, angle: 360, duration: 420, ease: 'Back.easeOut' })
      animar({ targets: grande, alpha: 0, scale: 1.6, delay: 1300, duration: 350 })

      // etiqueta em cima de cada caixa: quem manda nela agora (fica o evento todo)
      arena.pistas.forEach((pista, j) => {
        const l = pista.caixa.limites
        const etiqueta = texto(l.centerX, l.top - 12, quemControla(j), 11, corTexto(COR), 42).setAlpha(0).setScale(1.6)
        etiqueta.pista = pista
        animar({ targets: etiqueta, alpha: 1, scale: 1, delay: 250, duration: 260, ease: 'Back.easeOut' })
      })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      ultimoDelta = delta
      for (const o of objetos) {
        if (!o.pista) continue
        const l = o.pista.caixa.limites
        o.setPosition(l.centerX, l.top - 12)
      }
    },

    joy(j, joy) {
      if (!ativo) return joy
      const novo = joyDoOutro(j)
      return invertida(j) ? { x: -novo.x, y: -novo.y } : novo
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const tw of tweens) {
        try {
          tw.stop()
        } catch {
          // a cena já saiu: os tweens já foram destruídos
        }
      }
      tweens = []
      // corações voltam à cor e ao tamanho de antes
      for (const { coracao, escala } of coracoes) {
        if (!coracao?.sprite?.scene) continue
        coracao.sprite.setTint(coracao.cor).setScale(escala)
      }
      coracoes = []
      objetos.forEach((o) => o.destroy())
      objetos = []
      bot = null
    },
  }
  return evento
}
