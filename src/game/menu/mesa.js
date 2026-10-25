import Phaser from 'phaser'
import { LARGURA, ALTURA } from '../constants.js'
import { RES } from '../resolucao.js'
import { fatores } from '../acessibilidade.js'
import { tremerCamera } from '../effects/shake.js'
import { BATIDA } from './layout.js'
import { jeitos } from './sala.js'
import { criarTelao } from './telao.js'
import { DADOS_MESA as D } from './sprites/mesa.js'

// A MESA DE CARTAS: o menu inicial alternativo (Config > Gráficos > MENU
// INICIAL). A turma jogando cartas na sala, com o telão ao fundo passando a
// mesma luta do outro menu. Mesmo papel da sala.js (e o telão vem junto):
//
//   const mesa = criarMesa(cena)
//   mesa.telao             o telão (ligar, batida, cor, atualizar; explodir é o da mesa)
//   mesa.iluminar(cor)     cor do telão: o brilho dele na sala segue ela
//   mesa.batida(n)         pulso da música: as cabeças balançam, o "!!" e o 💢 pulsam
//   mesa.atualizar(delta)
//
// A arte (scripts/menu/mesa.py) é a ilustração já na grade de pixel art do
// jogo: o fundo sem as cabeças e cada cabeça numa camada por cima, no lugar.
// A cabeça só DESCE no balanço (para cima ou para o lado apareceria o que foi
// preenchido atrás dela), em degraus de 1 pixel da arte.
//
// O telão: a luta roda fora da tela (à direita do mundo, onde a câmera não
// olha) num tamanho com a proporção da tela da ilustração, e a cada quadro é
// fotografada numa textura dinâmica (na resolução real da tela) que aparece
// no lugar da tela, por baixo das cabeças (o cabelo da Susie fica na frente).
//
// Profundidades 0-9: 0 a sala · 1 a tela do telão · 2 luzes e brilho do telão
// · 3 as cabeças (olhos, 💢, "!!" e ✦ logo acima) · 6 vinheta.
//
// Preferências (acessibilidade.js): no gráfico mínimo ninguém balança e as luzes
// param; com "reduzir animações" as luzes quase não tremulam.

const P = 2 // 1 pixel da arte, em px de jogo
const JEITOS = jeitos(P)
const FORA = { x: LARGURA + 400, y: 40 } // onde a luta do telão roda (fora da tela)
const ALTURA_TELAO = 190 // altura da luta (a largura sai da proporção da tela da ilustração)
const PISCAR = { min: 2200, max: 5600, dura: 130 }
const COR_LUZ = 0xffb45a

let geracao = 0 // chave única da textura da tela (a cena é recriada a cada volta ao menu)

const sorte = Phaser.Math.FloatBetween

export function criarMesa(cena) {
  const T = D.tela

  cena.add.image(0, 0, 'menu-mesa-fundo').setOrigin(0).setDepth(0)

  // ---------- o telão (fora da tela) e a foto dele no lugar da tela ----------
  const nativa = { x: FORA.x, y: FORA.y, altura: ALTURA_TELAO, largura: Math.round((ALTURA_TELAO * T.largura) / T.altura) }
  const antes = new Set(cena.children.list)
  const telao = criarTelao(cena, nativa)
  const pecas = cena.children.list.filter((o) => !antes.has(o))
  const chave = `menu-mesa-tela-${++geracao}`
  let foto = null
  let escalaFoto = 0
  const tela = cena.add.image(T.x, T.y, '__DEFAULT').setOrigin(0).setDepth(1)
  const novaFoto = () => {
    if (foto) cena.textures.remove(chave)
    escalaFoto = RES.escala
    foto = cena.textures.addDynamicTexture(chave, Math.max(1, Math.round(T.largura * escalaFoto)), Math.max(1, Math.round(T.altura * escalaFoto)))
    foto?.camera.setOrigin(0, 0).setZoom((T.largura * escalaFoto) / nativa.largura).setScroll(nativa.x, nativa.y)
    tela.setTexture(foto ? chave : '__DEFAULT').setDisplaySize(T.largura, T.altura)
  }
  const fotografar = () => {
    if (escalaFoto !== RES.escala) novaFoto()
    if (!foto) return
    foto.clear()
    foto.fill(0x04050b, 1)
    foto.draw(pecas.filter((o) => o.active && o.willRender?.(foto.camera)).sort((a, b) => a.depth - b.depth)) // só o que está visível
    foto.render()
  }
  cena.events.once('shutdown', () => foto && cena.textures.remove(chave))

  // o brilho do telão na sala (na cor dele)
  const brilhoTela = cena.add
    .image(T.x + T.largura / 2, T.y + T.altura / 2, 'menu-telao-brilho')
    .setDepth(2)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDisplaySize(T.largura + 170, T.altura + 150)
    .setAlpha(0.2)

  // ---------- luzes: lâmpadas, velas, a carta SUPER ----------
  const luzes = D.luzes.map((l) => ({
    img: cena.add
      .image(l.x, l.y, 'brilho')
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(COR_LUZ)
      .setDisplaySize(10 + 5 * l.tamanho, 10 + 5 * l.tamanho),
    fase: sorte(0, 20),
    ritmo: sorte(0.6, 1.4),
  }))
  const carta = cena.add.image(D.cartaSuper.x, D.cartaSuper.y, 'brilho').setDepth(2).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd24a).setDisplaySize(84, 60)

  // ---------- a turma ----------
  const cabecas = D.cabecas.map((c) => {
    const cab = { def: c, img: cena.add.image(c.x, c.y, c.chave).setOrigin(0).setDepth(3), jeito: JEITOS[c.jeito] ?? JEITOS.cabeca, desce: 0 }
    if (c.olhos) {
      cab.olhos = cena.add.image(c.x + c.olhos.dx, c.y + c.olhos.dy, c.olhos.chave).setOrigin(0).setDepth(3.1).setVisible(false)
      cab.piscaEm = sorte(PISCAR.min, PISCAR.max)
    }
    if (c.raiva) {
      const r = c.raiva
      cab.raiva = cena.add.image(c.x + r.dx + r.largura / 2, c.y + r.dy + r.altura / 2, r.chave).setDepth(3.2)
    }
    return cab
  })
  const E = D.exclamacao
  const exclamacao = cena.add.image(E.x + E.largura / 2, E.y + E.altura, E.chave).setOrigin(0.5, 1).setDepth(3.3)
  const brilhos = D.brilhos.map((b, i) => ({
    img: cena.add.image(b.x, b.y, 'estrela').setDepth(3.4).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff1b0).setScale(0.4),
    fase: i * 1.9,
  }))

  cena.add.image(0, 0, 'menu-sala-vinheta').setOrigin(0).setDepth(6)

  // ---------- estado ----------
  let cor = 0xffffff
  let pulso = 0
  let n = 0
  let desde = Infinity // ms desde a última batida (antes da música: parados)
  let relogio = 0

  function iluminar(c) {
    cor = c
  }

  function batida(num) {
    n = num
    desde = 0
    pulso = num % 4 === 1 ? 1 : 0.6
  }

  function atualizar(delta) {
    const dt = Math.min(delta, 100)
    relogio += dt
    desde += dt
    pulso *= Math.exp(-dt / 170)
    const { nivel, piscar } = fatores()
    const vivo = nivel > 0

    fotografar()
    brilhoTela.setTint(cor).setAlpha(0.16 + 0.14 * pulso)

    for (const l of luzes) {
      const tremula = vivo ? (piscar ? 0.18 : 0.06) * Math.sin((relogio / 260) * l.ritmo + l.fase) + (piscar ? 0.06 * Math.sin(relogio / 71 + l.fase * 3) : 0) : 0
      l.img.setAlpha(0.42 + tremula + 0.08 * pulso)
    }
    carta.setAlpha(0.22 + 0.1 * Math.sin(relogio / 400) + 0.25 * pulso)

    // cabeças: balançam no compasso (só para baixo)
    const t = vivo ? desde / BATIDA : Infinity
    for (const cab of cabecas) {
      const pose = t <= 1 ? cab.jeito(t, n) : {}
      const desce = pose.cabeca || (pose.y ? P : 0)
      const { x, y } = cab.def
      cab.img.setY(y + desce)
      if (cab.raiva) cab.raiva.setY(y + cab.def.raiva.dy + cab.def.raiva.altura / 2 + desce).setScale(1 + 0.35 * pulso)
      if (cab.olhos) {
        cab.piscaEm -= dt
        if (cab.piscaEm <= -PISCAR.dura) cab.piscaEm = sorte(PISCAR.min, PISCAR.max)
        cab.olhos.setPosition(x + cab.def.olhos.dx, y + cab.def.olhos.dy + desce).setVisible(cab.piscaEm <= 0)
      }
    }
    exclamacao.setScale(1 + 0.25 * pulso).setAlpha(0.75 + 0.25 * pulso)
    for (const b of brilhos) {
      const s = vivo ? Math.max(0, Math.sin(relogio / 380 + b.fase)) : 0.5
      b.img.setAlpha(s).setScale(0.25 + 0.2 * s)
    }
  }

  // JOGAR: a tela estoura de branco e a luz engole a sala (sem clarões: só escurece)
  const explodir = () =>
    new Promise((resolver) => {
      if (fatores().clarao <= 0) {
        cena.cameras.main.fadeOut(420, 0, 0, 0)
        cena.time.delayedCall(700, resolver)
        return
      }
      const cx = T.x + T.largura / 2
      const cy = T.y + T.altura / 2
      const branco = cena.add.rectangle(T.x, T.y, T.largura, T.altura, 0xffffff).setOrigin(0).setDepth(40).setAlpha(0)
      const luz = cena.add.image(cx, cy, 'menu-telao-brilho').setDepth(41).setBlendMode(Phaser.BlendModes.ADD).setTint(cor)
      luz.setDisplaySize(T.largura * 1.2, T.altura * 1.4).setAlpha(0.9)
      const s = Math.max(LARGURA / T.largura, ALTURA / T.altura) * 2.5
      cena.tweens.add({ targets: branco, alpha: 1, duration: 130, ease: 'Quad.easeOut' })
      cena.tweens.add({ targets: luz, scaleX: luz.scaleX * s, scaleY: luz.scaleY * s, alpha: 1, duration: 560, ease: 'Cubic.easeIn' })
      tremerCamera(cena.cameras.main, 260, 0.004)
      cena.time.delayedCall(480, () => cena.cameras.main.fadeOut(200, 255, 255, 255))
      cena.time.delayedCall(700, resolver)
    })

  return { telao: { ...telao, explodir }, iluminar, batida, atualizar }
}
