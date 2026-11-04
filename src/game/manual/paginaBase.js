import { LARGURA, ALTURA, TEMPOS, AUDIO, CORACAO } from '../constants.js'
import { tocar, contextoAudio, volumeEfeitos } from '../audio.js'
import { criarRng, aleatorio } from '../pvp/baralho.js'
import { gerarPapel, fibrasDoPapel, furosDaEspiral } from './papel.js'
import { pintarDesenho, graoDaCera, aplicarGrao, caixaDasCamadas, corCss, PALETA } from './cera.js'
import { partesDoRalsei, rostoDoRalsei, EXPRESSOES, CABECA, piscaEm, PISCADA_MS } from './ralsei.js'
import { contornoDoBalao, bordaDoBalao, estrelaGorda, letrasTortas, retanguloRedondo as poligonoRedondo, CORES_GIZ } from './ilustracoes.js'
import { gerarConfete, passoConfete, viradaDaPeca, CORES_CONFETE } from './confete.js'
import { contornoDoCoracao, desenharTracos } from './giz.js'

// A BASE das páginas do Manual do Ralsei (a parte com Phaser e canvas; o resto de manual/ é puro).
// Toda página usa isto para não repetir o caderno:
//
//   garantirPapel(scene)                  o caderno: mesa, folha (pautas, vinheta, dobrinha) e espiral (PAPEL)
//   assar(scene, chave, w, h, op)         textura de giz de cera (camadas de cera.js) + fundo/frente em canvas
//   assarCamadas(scene, chave, camadas)   idem, no tamanho certo; devolve { chave, minX, minY, w, h }
//   imagemDeCera(scene, x, y, info)       a imagem com a origem no (0,0) das camadas
//   assarAdesivo(scene, chave, op)        adesivo recortado: borda branca de "die-cut" + sombrinha
//   assarLetreiro(scene, chave, texto)    título em letras tortinhas de giz (SÓ título; texto é fonte clara)
//   desenharFita(ctx, ...)                um pedaço de fita washi
//   new Balao(scene, op)                  balão de fala tremidinho com digitação (pulável)
//   new RalseiDesenhado(scene, x, y, op)  o Ralsei em partes, com caras e respiração/piscada
//   new Confete(scene, x, y, op)          coraçõezinhos de papel
//   brilhar(scene, x, y, op)              brilhinhos de estrela
//   virarFolha(scene, folha, op)          a virada de página (encolhe contra a lombada, com dobra e sombra)
//   somDePapel(nome)                      'rabisco' | 'folha' | 'adesivo' | 'brilho' (WebAudio, volume de efeitos)
//   assarRotulo(scene, chave, texto)      a etiqueta lavanda "PÁGINA N" presa com clipe
//   assarPilula(scene, texto)             a pílula vermelha de giz "× falta energia (2/3)" (as páginas de cartas)
//   new BalasDeGiz(scene, op)             as bolinhas de giz da caixa (com rastro apagadinho), por quadro
//   coracaoDeGiz(scene, info)             o coração de giz com o miolo EXATO da hitbox por cima
//   riscosDeGolpe(g, x, y, cor)           os risquinhos parados de "levou um acerto" (sem clarão)
//   barraDeGiz(g, caixa, progresso)       a barra de tempo embaixo da caixa
//   joyDeTodos(controles)                 o joystick somado de todos os jogadores locais (um coração só)
//
// "Reduzir animações" (op.calmo): sem respiração/piscada, balão inteiro, virada em corte, sem confete.

export const FONTE_TEXTO = 'Verdana, "DejaVu Sans", "Segoe UI", Arial, sans-serif' // fonte clara com acentos
export const TINTA = '#2b2540'
export const TINTA_SUAVE = '#4e3f63' // dicas e rótulos (contraste conferido em __tests__/cera.test.js)
export const PAPEL_CARTAO = 0xfffbf1 // o cartão claro da caixa
export const FOLHA = { x: 8, y: 6, largura: LARGURA - 16, altura: ALTURA - 12, lombada: 40, raio: 8 }
const TAU = Math.PI * 2

// ---------- canvas e grão ----------

function novoCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  return c
}

let canvasDoGrao = null
export function padraoDeGraoPara(ctx) {
  if (!canvasDoGrao) {
    const lado = 128
    canvasDoGrao = novoCanvas(lado, lado)
    const g = canvasDoGrao.getContext('2d')
    const img = g.createImageData(lado, lado)
    img.data.set(graoDaCera(lado))
    g.putImageData(img, 0, 0)
  }
  return ctx.createPattern(canvasDoGrao, 'repeat')
}

function retanguloRedondo(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function caminhoDe(ctx, poligono) {
  ctx.beginPath()
  ctx.moveTo(poligono[0].x, poligono[0].y)
  for (const p of poligono.slice(1)) ctx.lineTo(p.x, p.y)
  ctx.closePath()
}

// op: camadas (cera, coordenadas já deslocadas por ox/oy), grao (0..1), fundo(ctx), frente(ctx)
export function assar(scene, chave, largura, altura, { camadas = [], ox = 0, oy = 0, grao = 0.5, fundo, frente } = {}) {
  if (scene.textures.exists(chave)) return chave
  const cv = novoCanvas(largura, altura)
  const ctx = cv.getContext('2d')
  fundo?.(ctx)
  if (camadas.length) {
    const cera = novoCanvas(largura, altura)
    const c2 = cera.getContext('2d')
    c2.translate(ox, oy)
    pintarDesenho(c2, camadas, { semente: chave })
    c2.setTransform(1, 0, 0, 1, 0, 0)
    aplicarGrao(c2, padraoDeGraoPara(c2), cera.width, cera.height, grao)
    ctx.drawImage(cera, 0, 0)
  }
  frente?.(ctx)
  scene.textures.addCanvas(chave, cv)
  return chave
}

export function assarCamadas(scene, chave, camadas, { margem = 3, grao = 0.5, fundo, frente } = {}) {
  const b = caixaDasCamadas(camadas)
  const minX = Math.floor(b.minX - margem)
  const minY = Math.floor(b.minY - margem)
  const w = Math.ceil(b.maxX + margem) - minX
  const h = Math.ceil(b.maxY + margem) - minY
  const mover = (f) => f && ((ctx) => (ctx.save(), ctx.translate(-minX, -minY), f(ctx), ctx.restore()))
  assar(scene, chave, w, h, { camadas, ox: -minX, oy: -minY, grao, fundo: mover(fundo), frente: mover(frente) })
  return { chave, minX, minY, w, h }
}

export const origemDe = (info) => [-info.minX / info.w, -info.minY / info.h]
export const imagemDeCera = (scene, x, y, info) => scene.add.image(x, y, info.chave).setOrigin(...origemDe(info))
export function trocarImagem(img, info) {
  if (img.texture.key !== info.chave) img.setTexture(info.chave).setOrigin(...origemDe(info))
}

// ---------- papel ----------

export function desenharFita(ctx, x, y, largura, altura, angulo, cor = PALETA.rosa, listra = 0xffffff) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angulo)
  const rng = criarRng(`fita:${x}:${y}`)
  // pontas rasgadas (zigue-zague)
  const borda = (lado) => {
    const pts = []
    for (let i = 0; i <= 6; i++) pts.push({ x: lado * (largura / 2 + (i % 2 ? 2.5 : 0) + aleatorio(rng) * 1.5), y: -altura / 2 + (altura * i) / 6 })
    return lado > 0 ? pts : pts.reverse()
  }
  const forma = [...borda(1), ...borda(-1)]
  ctx.shadowColor = 'rgba(60,40,20,0.18)'
  ctx.shadowBlur = 3
  ctx.shadowOffsetY = 1
  ctx.fillStyle = corCss(cor, 0.62)
  caminhoDe(ctx, forma)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.clip()
  ctx.strokeStyle = corCss(listra, 0.45)
  ctx.lineWidth = 3
  for (let i = -largura; i < largura; i += 9) {
    ctx.beginPath()
    ctx.moveTo(i, -altura)
    ctx.lineTo(i + altura, altura)
    ctx.stroke()
  }
  ctx.restore()
}

const ysDaEspiral = () => furosDaEspiral(ALTURA, { topo: FOLHA.y + 22, passo: 28, base: 18 })
const XFURO = FOLHA.x + 22

// os furos ficam NA folha (viram junto com ela)
function desenharFuros(ctx) {
  for (const y of ysDaEspiral()) {
    ctx.fillStyle = 'rgba(40,26,20,0.85)'
    ctx.beginPath()
    ctx.ellipse(XFURO, y, 3.6, 4.2, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.ellipse(XFURO + 1, y + 3, 3.4, 1.4, 0, 0, Math.PI)
    ctx.fill()
  }
}

// as argolas de arame ficam paradas por cima de tudo: saem do furo, passam por fora da folha e voltam por trás
function desenharArgolas(ctx) {
  const f = FOLHA
  for (const y of ysDaEspiral()) {
    const arame = (cor, largura, dx) => {
      ctx.strokeStyle = cor
      ctx.lineWidth = largura
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(XFURO + dx, y)
      ctx.bezierCurveTo(XFURO - 6 + dx, y - 12, f.x - 14 + dx, y - 12, f.x - 10 + dx, y - 2)
      ctx.stroke()
    }
    arame('rgba(30,24,30,0.35)', 4.6, 1.2) // sombra
    arame('#7c7f90', 3.4, 0)
    arame('rgba(255,255,255,0.75)', 1.1, -0.6) // brilho do metal
  }
}

// O caderno (o mesmo para toda página), em 3 texturas do tamanho da tela:
//   'manual-mesa'     a mesa, as folhas de baixo e a sombra (parada, atrás de tudo)
//   'manual-papel'    a folha em si (transparente fora dela): é o fundo de cada página e vira junto
//   'manual-espiral'  as argolas (paradas, por cima das páginas, inclusive durante a virada)
export const PAPEL = { mesa: 'manual-mesa', papel: 'manual-papel', espiral: 'manual-espiral' }
export function garantirPapel(scene) {
  const f = FOLHA
  if (!scene.textures.exists(PAPEL.mesa)) {
    const cv = novoCanvas(LARGURA, ALTURA)
    const ctx = cv.getContext('2d')
    // feltro escuro e quente
    const mesa = ctx.createRadialGradient(LARGURA / 2, ALTURA / 2, 60, LARGURA / 2, ALTURA / 2, LARGURA * 0.7)
    mesa.addColorStop(0, '#4a3530')
    mesa.addColorStop(1, '#241818')
    ctx.fillStyle = mesa
    ctx.fillRect(0, 0, LARGURA, ALTURA)
    // folhas de baixo (o caderno tem mais páginas) e a sombra da de cima
    for (const [dx, dy, cor] of [[4, 4, '#d8c9a8'], [2, 2, '#e6d8b8']]) {
      ctx.fillStyle = cor
      retanguloRedondo(ctx, f.x + dx, f.y + dy, f.largura, f.altura, f.raio)
      ctx.fill()
    }
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 3
    ctx.fillStyle = '#e6d8b8'
    retanguloRedondo(ctx, f.x, f.y, f.largura - 24, f.altura, f.raio)
    ctx.fill()
    ctx.restore()
    scene.textures.addCanvas(PAPEL.mesa, cv)
  }
  if (!scene.textures.exists(PAPEL.papel)) {
    const cv = novoCanvas(LARGURA, ALTURA)
    const ctx = cv.getContext('2d')
    const papel = novoCanvas(f.largura, f.altura)
    const pc = papel.getContext('2d')
    const img = pc.createImageData(f.largura, f.altura)
    img.data.set(gerarPapel(f.largura, f.altura, 'manual'))
    pc.putImageData(img, 0, 0)
    ctx.save()
    retanguloRedondo(ctx, f.x, f.y, f.largura, f.altura, f.raio)
    ctx.clip()
    ctx.drawImage(papel, f.x, f.y)
    // pautas azuis fraquinhas e a margem vermelha
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(86,126,190,0.17)'
    for (let y = f.y + 46; y < f.y + f.altura - 6; y += 26) {
      ctx.beginPath()
      ctx.moveTo(f.x + f.lombada, y + 0.5)
      ctx.lineTo(f.x + f.largura, y + 0.5)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(214,80,92,0.26)'
    ctx.beginPath()
    ctx.moveTo(f.x + 48.5, f.y)
    ctx.lineTo(f.x + 48.5, f.y + f.altura)
    ctx.stroke()
    // fibras soltas
    for (const fb of fibrasDoPapel('manual', 700, f.largura, f.altura)) {
      ctx.strokeStyle = fb.claro ? 'rgba(255,255,255,0.22)' : 'rgba(140,108,70,0.08)'
      ctx.beginPath()
      ctx.moveTo(f.x + fb.x, f.y + fb.y)
      ctx.lineTo(f.x + fb.x + Math.cos(fb.angulo) * fb.comprimento, f.y + fb.y + Math.sin(fb.angulo) * fb.comprimento)
      ctx.stroke()
    }
    // a sombra da espiral na lombada e a folha levantando de leve na beirada direita
    const lomb = ctx.createLinearGradient(f.x, 0, f.x + f.lombada + 10, 0)
    lomb.addColorStop(0, 'rgba(80,52,30,0.22)')
    lomb.addColorStop(1, 'rgba(80,52,30,0)')
    ctx.fillStyle = lomb
    ctx.fillRect(f.x, f.y, f.lombada + 10, f.altura)
    const dir = ctx.createLinearGradient(f.x + f.largura - 26, 0, f.x + f.largura, 0)
    dir.addColorStop(0, 'rgba(90,60,30,0)')
    dir.addColorStop(1, 'rgba(90,60,30,0.13)')
    ctx.fillStyle = dir
    ctx.fillRect(f.x + f.largura - 26, f.y, 26, f.altura)
    ctx.restore()
    // a dobrinha do canto de baixo à direita (a folha já foi folheada): recorta o canto e dobra o verso
    const d = 22
    const cx = f.x + f.largura
    const cy = f.y + f.altura
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.moveTo(cx - d, cy + 1)
    ctx.lineTo(cx + 1, cy + 1)
    ctx.lineTo(cx + 1, cy - d)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = 5
    ctx.shadowOffsetX = -2
    ctx.shadowOffsetY = -2
    const verso = ctx.createLinearGradient(cx - d, cy - d, cx - d / 2, cy - d / 2)
    verso.addColorStop(0, '#fff8e8')
    verso.addColorStop(1, '#d8c7a2')
    ctx.fillStyle = verso
    ctx.beginPath()
    ctx.moveTo(cx - d, cy)
    ctx.lineTo(cx, cy - d)
    ctx.lineTo(cx - d + 3, cy - d + 3)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    desenharFuros(ctx)
    scene.textures.addCanvas(PAPEL.papel, cv)
  }
  if (!scene.textures.exists(PAPEL.espiral)) {
    const cv = novoCanvas(FOLHA.x + FOLHA.lombada, ALTURA)
    desenharArgolas(cv.getContext('2d'))
    scene.textures.addCanvas(PAPEL.espiral, cv)
  }
  return PAPEL
}

// ---------- adesivos e letreiro ----------

// Adesivo recortado: a silhueta ganha borda branca (o "die-cut") e uma sombrinha; por cima vai o
// fundo próprio (op.base(ctx)), o desenho de giz (op.camadas) e a frente (op.frente(ctx): texto, brilho).
export function assarAdesivo(scene, chave, { silhueta, camadas = [], base, frente, borda = 4, grao = 0.4 }) {
  const fundo = (ctx) => {
    ctx.save()
    ctx.lineJoin = 'round'
    ctx.shadowColor = 'rgba(60,36,20,0.32)'
    ctx.shadowBlur = 4
    ctx.shadowOffsetX = 1.5
    ctx.shadowOffsetY = 2.5
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = borda * 2
    caminhoDe(ctx, silhueta)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
    base?.(ctx)
  }
  const margem = borda + 6
  return assarCamadas(scene, chave, [{ tipo: 'mancha', poligono: silhueta, cor: 0xffffff, alpha: 0 }, ...camadas], { margem, grao, fundo, frente })
}

// estrela dourada brilhante (o adesivo das marcas e o de página concluída)
export function assarEstrelaDourada(scene, chave, raio, { texto, subtexto, giro = 0 } = {}) {
  const silhueta = estrelaGorda(0, 0, raio, raio * 0.56, 5, giro)
  const contorno = silhueta.map((p) => ({ x: p.x * 0.97, y: p.y * 0.97 }))
  return assarAdesivo(scene, chave, {
    silhueta,
    borda: Math.max(3, raio * 0.07),
    base: (ctx) => {
      const g = ctx.createRadialGradient(-raio * 0.3, -raio * 0.35, raio * 0.05, 0, 0, raio)
      g.addColorStop(0, '#fff3a8')
      g.addColorStop(0.45, '#f7c531')
      g.addColorStop(1, '#d58f06')
      ctx.fillStyle = g
      caminhoDe(ctx, silhueta)
      ctx.fill()
    },
    camadas: [
      { tipo: 'traco', tracos: [[...contorno, contorno[0], contorno[1]]], cor: 0xb06f00, largura: Math.max(1.6, raio * 0.04), passadas: 2 },
      { tipo: 'traco', tracos: [[{ x: -raio * 0.42, y: -raio * 0.18 }, { x: -raio * 0.2, y: -raio * 0.42 }]], cor: 0xffffff, largura: Math.max(1.6, raio * 0.07), alpha: 0.8, passadas: 2 },
    ],
    grao: 0.3,
    frente: (ctx) => {
      // o brilho de adesivo metalizado: uma faixa clara na diagonal
      ctx.save()
      caminhoDe(ctx, silhueta)
      ctx.clip()
      const s = ctx.createLinearGradient(-raio, -raio, raio, raio)
      s.addColorStop(0.3, 'rgba(255,255,255,0)')
      s.addColorStop(0.42, 'rgba(255,255,255,0.45)')
      s.addColorStop(0.5, 'rgba(255,255,255,0)')
      ctx.fillStyle = s
      ctx.fillRect(-raio, -raio, raio * 2, raio * 2)
      ctx.restore()
      if (texto) {
        ctx.rotate(giro) // o texto inclina junto com a estrela (a imagem fica sem giro: ver RalseiDesenhado)
        ctx.fillStyle = TINTA
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `bold ${Math.round(raio * 0.24)}px ${FONTE_TEXTO}`
        ctx.fillText(texto, 0, -raio * 0.02)
        if (subtexto) {
          ctx.fillStyle = '#1f7a3a'
          ctx.font = `bold ${Math.round(raio * 0.4)}px ${FONTE_TEXTO}`
          ctx.fillText(subtexto, 0, raio * 0.34)
        }
      }
    },
  })
}

// Título em letras tortinhas (cada letra sobe/gira um tiquinho), com 2 passadas e o grão da cera
export function assarLetreiro(scene, chave, texto, { tamanho = 26, cor = TINTA, semente = chave } = {}) {
  const fonte = `bold ${tamanho}px ${FONTE_TEXTO}`
  const medir = novoCanvas(4, 4).getContext('2d')
  medir.font = fonte
  const letras = letrasTortas(criarRng(`letreiro:${semente}`), texto)
  const largura = Math.ceil(letras.reduce((s, l) => s + medir.measureText(l.ch).width * l.escala, 0) + 8)
  const altura = Math.ceil(tamanho * 1.45)
  if (!scene.textures.exists(chave)) {
    const cv = novoCanvas(largura, altura)
    const ctx = cv.getContext('2d')
    ctx.font = fonte
    ctx.textBaseline = 'alphabetic'
    for (const [k, alpha, dx, dy] of [[0, 0.5, 0.9, 0.6], [1, 0.95, 0, 0]]) {
      ctx.fillStyle = cor
      ctx.globalAlpha = alpha
      let x = 4
      for (const l of letras) {
        ctx.save()
        ctx.translate(x + dx, tamanho * 1.08 + l.dy + dy)
        ctx.rotate(l.giro * (k ? 1 : 1.3))
        ctx.scale(l.escala, l.escala)
        ctx.fillText(l.ch, 0, 0)
        ctx.restore()
        x += medir.measureText(l.ch).width * l.escala
      }
    }
    ctx.globalAlpha = 1
    aplicarGrao(ctx, padraoDeGraoPara(ctx), largura, altura, 0.32)
    scene.textures.addCanvas(chave, cv)
  }
  return { chave, largura, altura }
}

// ---------- balão de fala ----------

export class Balao {
  // op: { x, y, largura, altura, cauda: { de, x, y }, chave, calmo, tamanho }
  constructor(scene, op) {
    this.scene = scene
    this.op = op
    this.calmo = op.calmo
    this.textoAtual = ''
    this.digitado = 0
    const rng = criarRng(`balao:${op.chave}`)
    const poli = contornoDoBalao(rng, op.x, op.y, op.largura, op.altura, op.cauda)
    const info = assarCamadas(scene, op.chave, [{ tipo: 'traco', tracos: bordaDoBalao(rng, poli), cor: PALETA.tinta, largura: 2.3, passadas: 2 }], {
      margem: 8,
      grao: 0.4,
      fundo: (ctx) => {
        ctx.save()
        ctx.shadowColor = 'rgba(70,44,30,0.2)'
        ctx.shadowBlur = 6
        ctx.shadowOffsetY = 3
        ctx.fillStyle = '#fffdf7'
        caminhoDe(ctx, poli)
        ctx.fill()
        ctx.restore()
        // um tiquinho de lavanda no fundo, de giz deitado
        ctx.save()
        caminhoDe(ctx, poli)
        ctx.clip()
        const g = ctx.createLinearGradient(0, op.y, 0, op.y + op.altura)
        g.addColorStop(0, 'rgba(164,138,216,0)')
        g.addColorStop(1, 'rgba(164,138,216,0.10)')
        ctx.fillStyle = g
        ctx.fillRect(op.x - 10, op.y - 10, op.largura + 20, op.altura + 80)
        ctx.restore()
      },
    })
    this.imagem = imagemDeCera(scene, 0, 0, info)
    this.texto = scene.add.text(op.x + 20, op.y + 16, '', {
      fontFamily: FONTE_TEXTO,
      fontSize: `${op.tamanho ?? 17}px`,
      fontStyle: 'bold',
      color: TINTA,
      wordWrap: { width: op.largura - 40 },
      lineSpacing: 6,
    })
    this.seta = scene.add.text(op.x + op.largura - 26, op.y + op.altura - 26, '▶', { fontFamily: FONTE_TEXTO, fontSize: '15px', fontStyle: 'bold', color: '#7a62a8' }).setVisible(false)
  }

  get objetos() {
    return [this.imagem, this.texto, this.seta]
  }

  get digitando() {
    return this.digitado < this.textoAtual.length
  }

  dizer(texto, instantaneo = false) {
    this.textoAtual = texto
    this.digitado = this.calmo || instantaneo ? texto.length : 0
    this.texto.setText(texto.slice(0, this.digitado))
  }

  completar() {
    this.digitado = this.textoAtual.length
    this.texto.setText(this.textoAtual)
  }

  // digitação + a setinha de "continua" (balança de leve; parada no modo calmo)
  update(tempo, delta, mostrarSeta) {
    if (this.digitando) {
      const antes = this.digitado
      this.digitado = Math.min(this.textoAtual.length, this.digitado + Math.max(1, Math.round(delta / TEMPOS.letraMs)))
      this.texto.setText(this.textoAtual.slice(0, this.digitado))
      if (Math.floor(antes / 4) !== Math.floor(this.digitado / 4)) tocar(this.scene, 'texto')
    }
    const ver = mostrarSeta && !this.digitando
    this.seta.setVisible(ver)
    if (ver) this.seta.setX(this.op.x + this.op.largura - 26 + (this.calmo ? 0 : Math.sin(tempo / 180) * 2.5))
  }
}

// ---------- o Ralsei ----------

export class RalseiDesenhado {
  constructor(scene, x, y, { calmo = false, escala = 1 } = {}) {
    this.scene = scene
    this.calmo = calmo
    this.escala = escala
    this.rng = criarRng('ralsei:piscadas')
    const p = partesDoRalsei(criarRng('ralsei:partes'))
    const corpo = assarCamadas(scene, 'manual-ralsei-corpo', p.corpo, { grao: 0.42 })
    const cabeca = assarCamadas(scene, 'manual-ralsei-cabeca', p.cabeca, { grao: 0.38 })
    const chapeu = assarCamadas(scene, 'manual-ralsei-chapeu', p.chapeu, { grao: 0.42 })
    this.rostos = {}
    for (const e of EXPRESSOES) {
      this.rostos[e] = assarCamadas(scene, `manual-ralsei-rosto-${e}`, rostoDoRalsei(criarRng(`rosto:${e}`), e), { grao: 0.15 })
      this.rostos[`${e}-pisca`] = assarCamadas(scene, `manual-ralsei-rosto-${e}-pisca`, rostoDoRalsei(criarRng(`rosto:${e}`), e, { piscando: true }), { grao: 0.15 })
    }
    this.container = scene.add.container(x, y).setScale(escala)
    const sombra = scene.add.ellipse(2, 3, 96, 14, 0x5a3c28, 0.16)
    this.corpo = imagemDeCera(scene, 0, 0, corpo)
    // NADA aqui gira: imagem girada de leve perde triângulos no WebGL de software (visto no Chromium com
    // swiftshader); o balanço é só posição e escala. Inclinação, quando precisa, vai assada no canvas.
    this.cabeca = imagemDeCera(scene, 0, 0, cabeca)
    this.rosto = imagemDeCera(scene, CABECA.x, CABECA.y, this.rostos.feliz)
    // o chapéu balança em volta da aba
    const pivo = { x: CABECA.x, y: CABECA.y - 22 }
    this.pivo = pivo
    this.chapeu = scene.add.image(pivo.x, pivo.y, chapeu.chave).setOrigin((pivo.x - chapeu.minX) / chapeu.w, (pivo.y - chapeu.minY) / chapeu.h)
    this.container.add([sombra, this.corpo, this.cabeca, this.rosto, this.chapeu])
    this.expressao = 'feliz'
    this.proximaPiscada = piscaEm(this.rng, 0)
    this.piscandoAte = 0
  }

  setExpressao(e) {
    if (e === this.expressao || !this.rostos[e]) return
    this.expressao = e
    this.aplicarRosto(false)
    if (this.calmo) return
    // pulinho de quem reage
    this.scene.tweens.killTweensOf(this.container)
    const k = this.escala
    this.container.setScale(k * 1.04, k * 0.95)
    this.scene.tweens.add({ targets: this.container, scaleX: k, scaleY: k, duration: 260, ease: 'Back.easeOut' })
  }

  aplicarRosto(piscando) {
    trocarImagem(this.rosto, this.rostos[piscando ? `${this.expressao}-pisca` : this.expressao])
  }

  update(tempo) {
    if (this.calmo) return
    const r = Math.sin((tempo / 2600) * TAU)
    this.corpo.setScale(1 + r * 0.008, 1 + r * 0.02)
    const dy = -1.4 - r * 1.4
    this.cabeca.y = dy
    this.rosto.y = CABECA.y + dy
    this.chapeu.y = this.pivo.y + dy - Math.sin((tempo / 2600) * TAU - 0.6) * 1.2
    this.chapeu.scaleY = 1 + Math.sin((tempo / 3100) * TAU) * 0.025 // a ponta mole sobe e desce
    if (tempo >= this.proximaPiscada) {
      this.piscandoAte = tempo + PISCADA_MS
      this.proximaPiscada = piscaEm(this.rng, tempo)
      this.aplicarRosto(true)
    } else if (this.piscandoAte && tempo >= this.piscandoAte) {
      this.piscandoAte = 0
      this.aplicarRosto(false)
    }
  }
}

// ---------- confete, brilho ----------

function assarConfetes(scene) {
  return CORES_CONFETE.map((cor, i) => {
    const chave = `manual-confete-${i}`
    const poli = contornoDoCoracao(0, 0, 10, 18)
    return assarCamadas(scene, chave, [{ tipo: 'mancha', poligono: poli, cor, alpha: 1 }, { tipo: 'traco', tracos: [[...poli, poli[0]]], cor: 0xffffff, largura: 1, alpha: 0.5, passadas: 1 }], { margem: 2, grao: 0.15 })
  })
}

export class Confete {
  constructor(scene, x, y, { n = 40, pai = null, profundidade = 40 } = {}) {
    const infos = assarConfetes(scene)
    this.pecas = gerarConfete(criarRng(`confete:${x}:${y}`), n, x, y)
    this.imagens = this.pecas.map((p, i) => {
      const img = imagemDeCera(scene, p.x, p.y, infos[i % infos.length]).setDepth(profundidade)
      pai?.add(img)
      return img
    })
  }

  update(delta) {
    if (!this.pecas.length) return false
    const vivas = new Set(passoConfete(this.pecas, delta))
    this.pecas.forEach((p, i) => {
      const img = this.imagens[i]
      if (!img.active) return
      if (!vivas.has(p)) return img.destroy()
      img.setPosition(p.x, p.y).setScale(viradaDaPeca(p) * p.escala, p.escala * (0.8 + 0.2 * Math.sin(p.giro)))
    })
    this.pecas = this.pecas.filter((p) => vivas.has(p))
    return this.pecas.length > 0
  }

  destroy() {
    for (const i of this.imagens) if (i.active) i.destroy()
    this.pecas = []
  }
}

function assarBrilho(scene) {
  if (scene.textures.exists('manual-brilho')) return 'manual-brilho'
  const cv = novoCanvas(24, 24)
  const ctx = cv.getContext('2d')
  ctx.translate(12, 12)
  ctx.fillStyle = '#fff6c2'
  ctx.shadowColor = 'rgba(245,192,42,0.9)'
  ctx.shadowBlur = 4
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2
    const r = i % 2 ? 2.4 : 10
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.closePath()
  ctx.fill()
  scene.textures.addCanvas('manual-brilho', cv)
  return 'manual-brilho'
}

// brilhinhos saindo de (x, y); calmo: um só, parado, que some
export function brilhar(scene, x, y, { pai = null, calmo = false, n = 6, raio = 26 } = {}) {
  const chave = assarBrilho(scene)
  if (calmo) {
    const b = scene.add.image(x, y - raio * 0.6, chave)
    pai?.add(b)
    scene.time.delayedCall(500, () => b.destroy())
    return
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.3
    const b = scene.add.image(x, y, chave).setScale(0.3)
    pai?.add(b)
    scene.tweens.add({
      targets: b,
      x: x + Math.cos(a) * raio,
      y: y + Math.sin(a) * raio,
      scale: { from: 0.9, to: 0.2 },
      alpha: { from: 1, to: 0 },
      duration: 520 + (i % 3) * 80,
      ease: 'Cubic.easeOut',
      onComplete: () => b.destroy(),
    })
  }
}

// ---------- virada de página ----------

function assarVirada(scene) {
  if (!scene.textures.exists('manual-sombra-virada')) {
    const cv = novoCanvas(64, 8)
    const ctx = cv.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 64, 0)
    g.addColorStop(0, 'rgba(40,24,12,0.55)')
    g.addColorStop(1, 'rgba(40,24,12,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 8)
    scene.textures.addCanvas('manual-sombra-virada', cv)
  }
  if (!scene.textures.exists('manual-verso')) {
    const cv = novoCanvas(64, 8)
    const ctx = cv.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 64, 0)
    g.addColorStop(0, '#cdbb94')
    g.addColorStop(0.55, '#f3e6c8')
    g.addColorStop(1, '#fffaf0')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 8)
    scene.textures.addCanvas('manual-verso', cv)
  }
}

// A folha (container com a página inteira) encolhe contra a lombada; na beirada que vira aparece o
// verso do papel curvando e uma sombra caindo na página de baixo. Calmo: troca na hora.
export function virarFolha(scene, folha, { calmo = false, duracao = 900, profundidade = 25, aoTerminar }) {
  if (calmo) return aoTerminar()
  assarVirada(scene)
  somDePapel('folha')
  const L = FOLHA.x + FOLHA.lombada * 0.55
  const direita = FOLHA.x + FOLHA.largura
  const alto = FOLHA.altura
  const sombra = scene.add.image(0, FOLHA.y, 'manual-sombra-virada').setOrigin(0).setDepth(profundidade - 1).setDisplaySize(64, alto)
  const verso = scene.add.image(0, FOLHA.y, 'manual-verso').setOrigin(0).setDepth(profundidade).setDisplaySize(1, alto)
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: duracao,
    ease: 'Sine.easeInOut',
    onUpdate: (t) => {
      const v = t.getValue()
      const s = Math.max(0.001, 1 - v)
      folha.setScale(s, 1).setX(L - L * s)
      const borda = L + (direita - L) * s
      const curva = Math.sin(v * Math.PI) * 70 * (1 - v * 0.4)
      verso.setX(borda).setDisplaySize(Math.max(1, curva), alto)
      sombra.setX(borda + curva - 4).setAlpha(Math.min(1, 1.6 * (1 - v)))
    },
    onComplete: () => {
      sombra.destroy()
      verso.destroy()
      aoTerminar()
    },
  })
}

// ---------- sons de papel (sintetizados no contexto de áudio do jogo) ----------

let ruidoPapel = null
function bufferDeRuido(c) {
  if (!ruidoPapel || ruidoPapel.sampleRate !== c.sampleRate) {
    ruidoPapel = c.createBuffer(1, Math.round(c.sampleRate * 0.8), c.sampleRate)
    const d = ruidoPapel.getChannelData(0)
    let ant = 0
    for (let i = 0; i < d.length; i++) {
      ant = ant * 0.35 + (Math.random() * 2 - 1) * 0.65 // ruído um pouco "marrom": mais papel, menos chiado
      d[i] = ant
    }
  }
  return ruidoPapel
}

// volume: o slider de efeitos (e "som desligado" = 0); false quando não tocou
export function somDePapel(nome) {
  const vol = volumeEfeitos()
  if (vol <= 0) return false
  const c = contextoAudio()
  if (!c) return false
  if (c.state === 'suspended') c.resume()
  const t = c.currentTime
  const saida = c.createGain()
  saida.gain.value = AUDIO.volume * vol
  saida.connect(c.destination)
  const ruido = (inicio, dur, { freq = 2000, q = 1, pico = 0.4, tipo = 'bandpass', ate } = {}) => {
    const f = c.createBufferSource()
    f.buffer = bufferDeRuido(c)
    const filtro = c.createBiquadFilter()
    filtro.type = tipo
    filtro.frequency.setValueAtTime(freq, t + inicio)
    if (ate) filtro.frequency.exponentialRampToValueAtTime(ate, t + inicio + dur)
    filtro.Q.value = q
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t + inicio)
    g.gain.exponentialRampToValueAtTime(pico, t + inicio + Math.min(0.02, dur / 3))
    g.gain.exponentialRampToValueAtTime(0.0001, t + inicio + dur)
    f.connect(filtro).connect(g).connect(saida)
    f.start(t + inicio, Math.random() * 0.3)
    f.stop(t + inicio + dur + 0.02)
  }
  const nota = (inicio, freq, dur, pico, tipo = 'triangle', ate = freq) => {
    const o = c.createOscillator()
    o.type = tipo
    o.frequency.setValueAtTime(freq, t + inicio)
    o.frequency.exponentialRampToValueAtTime(ate, t + inicio + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(pico, t + inicio)
    g.gain.exponentialRampToValueAtTime(0.0001, t + inicio + dur)
    o.connect(g).connect(saida)
    o.start(t + inicio)
    o.stop(t + inicio + dur + 0.02)
  }
  if (nome === 'rabisco') {
    // o giz arranhando o papel: 2 riscadinhas curtas
    ruido(0, 0.06, { freq: 2600 + Math.random() * 900, q: 1.4, pico: 0.22 })
    ruido(0.07, 0.05, { freq: 3200 + Math.random() * 600, q: 1.6, pico: 0.14 })
  } else if (nome === 'folha') {
    // a folha virando: um "fshhh" que sobe e desce, com 3 batidinhas do papel
    ruido(0, 0.5, { freq: 700, ate: 2600, q: 0.7, pico: 0.32 })
    for (const [i, a] of [[0.08, 0.2], [0.22, 0.16], [0.36, 0.1]]) ruido(i, 0.08, { freq: 1400, q: 2, pico: a })
  } else if (nome === 'adesivo') {
    nota(0, 520, 0.09, 0.22, 'sine', 900)
    ruido(0, 0.03, { freq: 4000, tipo: 'highpass', pico: 0.12 })
  } else if (nome === 'brilho') {
    nota(0, 1320, 0.22, 0.09)
    nota(0.07, 1760, 0.26, 0.07)
    nota(0.14, 2350, 0.3, 0.05)
  } else return false
  return true
}

// ---------- pedaços das páginas jogáveis ----------

// etiqueta de papel lavanda presa com um clipe: "PÁGINA N"
export function assarRotulo(scene, chave, texto) {
  const silhueta = [{ x: 0, y: 8 }, { x: 96, y: 6 }, { x: 98, y: 24 }, { x: 2, y: 26 }]
  return assarAdesivo(scene, chave, {
    silhueta,
    borda: 1.5,
    base: (ctx) => {
      ctx.fillStyle = '#e4dcf6'
      ctx.beginPath()
      silhueta.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)))
      ctx.closePath()
      ctx.fill()
    },
    frente: (ctx) => {
      ctx.fillStyle = '#4b3a78'
      ctx.font = `bold 12px ${FONTE_TEXTO}`
      ctx.textBaseline = 'middle'
      ctx.fillText(texto, 26, 17)
      // o clipe
      ctx.strokeStyle = '#8a8ea0'
      ctx.lineWidth = 1.8
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(10, 24)
      ctx.lineTo(10, 4)
      ctx.arc(14, 4, 4, Math.PI, 0)
      ctx.lineTo(18, 20)
      ctx.arc(15, 20, 3, 0, Math.PI)
      ctx.lineTo(12, 7)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 0.7
      ctx.beginPath()
      ctx.moveTo(9.4, 20)
      ctx.lineTo(9.4, 5)
      ctx.stroke()
    },
    grao: 0,
  })
}

// A pílula de bloqueio das páginas de cartas, em giz: o mesmo recado da arena (PvpArena.mostrarStatus:
// "× " + motivoBloqueio(...).curto em branco sobre vermelho), recortada em papel vermelho. Uma textura
// por texto (assada na primeira vez). Devolve { chave, minX, minY, w, h } (a origem fica no centro).
export const COR_PILULA = 0xb3162d // PILULA_BLOQUEIO da arena
export function assarPilula(scene, texto) {
  const chave = `manual-pilula:${texto}`
  const fonte = `bold 12px ${FONTE_TEXTO}`
  const medir = novoCanvas(4, 4).getContext('2d')
  medir.font = fonte
  const largura = Math.ceil(medir.measureText(texto).width) + 22
  const altura = 22
  const silhueta = poligonoRedondo(-largura / 2, -altura / 2, largura, altura, 10)
  return assarAdesivo(scene, chave, {
    silhueta,
    borda: 2,
    base: (ctx) => {
      ctx.fillStyle = corCss(COR_PILULA)
      caminhoDe(ctx, silhueta)
      ctx.fill()
    },
    camadas: [{ tipo: 'traco', tracos: [[...silhueta, silhueta[0], silhueta[1]]], cor: 0x6e0a1a, largura: 1.6, passadas: 2 }],
    frente: (ctx) => {
      ctx.fillStyle = '#ffffff'
      ctx.font = fonte
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(texto, 0, 1)
    },
    grao: 0.25,
  })
}

// um coração só no tutorial: qualquer fonte local move (com 2 jogadores detectados, soma as duas)
export function joyDeTodos(controles) {
  let x = 0
  let y = 0
  for (let j = 0; j < controles.numJogadores; j++) {
    const d = controles.joy(j)
    x += d.x
    y += d.y
  }
  return { x: Math.max(-100, Math.min(100, x)), y: Math.max(-100, Math.min(100, y)) }
}

// As bolinhas de giz da caixa: um punhado de imagens reaproveitadas (uma por bala viva) e o rastro
// apagadinho de cada uma. `infos` = as variantes assadas da bala; a variante de cada bala gira com o
// tremidinho do giz (`fase`). Só desenho: a colisão é a da bala (x, y, raio), nunca o giz.
//   op: { caixa, infos, pai (container), n (quantas no máximo), rastro (quantas cópias; 0 = sem) }
export class BalasDeGiz {
  constructor(scene, { caixa, infos, pai, n = 8, rastro = 3 }) {
    this.caixa = caixa
    this.infos = infos
    this.rastro = rastro
    const add = (o) => (pai?.add(o), o)
    this.slots = Array.from({ length: n }, () => ({
      rastro: Array.from({ length: rastro }, () => add(imagemDeCera(scene, 0, 0, infos[0]).setVisible(false))),
      img: add(imagemDeCera(scene, 0, 0, infos[0]).setVisible(false)),
      trilha: [],
      dono: null,
    }))
  }

  // lista: as balas vivas ({ x, y, raio, semente? | id }); trocar: forçar a troca de variante
  atualizar(lista, fase, trocar = false, { alpha = 1 } = {}) {
    const c = this.caixa
    const n = this.infos.length
    this.slots.forEach((s, k) => {
      const b = lista[k]
      s.img.setVisible(Boolean(b))
      if (!b) {
        s.trilha = []
        s.dono = null
        for (const r of s.rastro) r.setVisible(false)
        return
      }
      if (s.dono !== b) {
        s.dono = b
        s.trilha = []
      }
      const info = this.infos[(fase + (b.semente ?? b.id ?? k)) % n]
      if (trocar || s.img.texture.key !== info.chave) trocarImagem(s.img, info)
      s.img.setPosition(b.x, b.y)
      // ainda chegando (bala inteira fora da caixa): meio apagada, como a faixa de aproximação do jogo
      const fora = b.x + b.raio < c.esquerda || b.x - b.raio > c.direita || b.y + b.raio < c.topo || b.y - b.raio > c.base
      s.img.setAlpha((fora ? 0.5 : 1) * alpha)
      if (!this.rastro) return
      const ult = s.trilha[0]
      if (!ult || Math.hypot(ult.x - b.x, ult.y - b.y) > 7) s.trilha = [{ x: b.x, y: b.y }, ...s.trilha].slice(0, this.rastro + 1)
      s.rastro.forEach((r, j) => {
        const q = s.trilha[j + 1]
        r.setVisible(Boolean(q))
        if (!q) return
        trocarImagem(r, info)
        r.setPosition(q.x, q.y).setAlpha((fora ? 0.5 : 1) * alpha * (0.22 - j * 0.06)).setScale(1 - (j + 1) * 0.12)
      })
    })
  }
}

// o coração: giz por fora, miolo EXATO da hitbox por cima (sem tremor, sempre nítido)
export function coracaoDeGiz(scene, info, { miolo = 0xfff8f8, borda = 0x7a0f20 } = {}) {
  const c = scene.add.container(0, 0)
  const img = imagemDeCera(scene, 0, 0, info)
  const g = scene.add.graphics()
  g.fillStyle(miolo, 1)
  g.fillCircle(0, 0, CORACAO.hitbox)
  g.lineStyle(1.2, borda, 1)
  g.strokeCircle(0, 0, CORACAO.hitbox)
  c.add([img, g])
  return { container: c, img }
}

// o "aaai" de ter sido atingido: riscos de giz em volta do coração (parado, sem clarão)
export function riscosDeGolpe(g, x, y, cor = CORES_GIZ.coracao) {
  g.clear()
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.2
    desenharTracos(g, [[{ x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 18 }, { x: x + Math.cos(a) * 29, y: y + Math.sin(a) * 29 }]], { cor, largura: 3, alpha: 0.9 })
  }
}

// a barra de tempo de giz embaixo da caixa (progresso 0..1)
export function barraDeGiz(g, caixa, progresso, { y = caixa.base + 46 } = {}) {
  g.clear()
  const x0 = caixa.esquerda + 10
  const x1 = caixa.direita - 10
  desenharTracos(g, [[{ x: x0, y }, { x: x1, y: y + 1 }]], { cor: 0x9a8fb8, largura: 6, alpha: 0.4, grao: 0.3 })
  if (progresso > 0) desenharTracos(g, [[{ x: x0, y }, { x: x0 + (x1 - x0) * progresso, y: y + progresso }]], { cor: CORES_GIZ.certo, largura: 6.5, alpha: 0.95, grao: 0.3 })
}
