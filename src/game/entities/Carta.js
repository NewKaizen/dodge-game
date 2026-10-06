import Phaser from 'phaser'
import { FONTE } from '../constants.js'
import { RES } from '../resolucao.js'
import { PERSONAGENS } from '../data/personagens.js'
import { tocar } from '../audio.js'
import { particulas } from '../effects/particulas.js'
import { shake } from '../effects/shake.js'

// Carta de baralho desenhada por código (frente, verso e animações).
// Só o VISUAL: as regras (baralho, naipes, valores, efeitos) ficam em outro módulo.
//
// Dados que a carta recebe (objeto "carta"):
//   {
//     id,          identificador único da carta no baralho
//     personagem,  id em data/personagens.js (cor da faixa e do verso)
//     naipe,       'espadas' | 'copas' | 'ouros' | 'paus'
//     valor,       1..13 (1 = Ás, 11 = J, 12 = Q, 13 = K) ou 14 (SUPER ★)
//     nome,        nome da habilidade (aparece na faixa de baixo)
//     descricao,   texto do efeito (aparece na legenda da carta ampliada)
//     custo,       energia (gema no canto superior direito)
//   }
//   Rótulos: A, 2..10, J, Q, K, ★ (SUPER: moldura arco-íris, estrela e a
//   palavra SUPER no miolo, brilhos coloridos). Naipe = tipo da carta:
//     ♠ espadas ataque   ♦ ouros controle   ♣ paus armadilha   ♥ copas suporte
//   Copas e ouros são vermelhos; espadas e paus, escuros.
//
// Uso:
//   const c = new Carta(scene, x, y, dados, { largura: 70, virada: false })
//   c.focar(true)            cursor em cima: sobe, brilha, inclina
//   c.setIndisponivel(true)  custo maior que a energia: escurece
//   await c.confirmar()      escolhida: vira para baixo
//   await c.revelar()        flip de volta para cima, com brilho
//   await c.arremessar({ x, y }, { aoImpacto })   voa girando e estilhaça no alvo
//   await c.comprar({ de: { x, y }, para: { x, y, rotacao } })
//   await c.descartar()
//   await c.ampliar(2.4)     mostra grande, com a legenda (descrição)
//
// Opções do construtor:
//   largura      largura em px do mundo (altura padrão = largura * 10/7)
//   altura
//   virada       começa com o verso para cima
//   corFoco      cor do brilho do cursor (Mao usa CORES.almas[jogador])
//   cor          cor da faixa/verso (padrão: cor do personagem)
//   ampliada     número: já nasce ampliada nesse fator, com a legenda visível
//   foco         { subida, escala } do estado com o cursor em cima (em px da carta base)

const ROTULOS = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K', 14: '★' }
export const rotuloValor = (valor) => ROTULOS[valor] ?? String(valor)
export const TIPOS = { espadas: 'ATAQUE', ouros: 'CONTROLE', paus: 'ARMADILHA', copas: 'SUPORTE' }
export const SIMBOLOS = { espadas: '♠', copas: '♥', ouros: '♦', paus: '♣' }
export const CORES_CARTA = {
  papel: 0xfbf6ea,
  papelSombra: 0xe6dcc4,
  borda: 0x2a2238,
  vermelho: 0xd42340,
  escuro: 0x1f1b2e,
  ouro: 0xe0ac3c,
  ouroEscuro: 0x8a5a14,
  ouroClaro: 0xfff0a8,
  gema: 0x3cc8ff,
  gemaEscura: 0x0b4a72,
  gemaClara: 0xc8f4ff,
  gemaSem: 0x8a2a3a,
  verso: 0x161226,
}
const corDoNaipe = (naipe) => (naipe === 'copas' || naipe === 'ouros' ? CORES_CARTA.vermelho : CORES_CARTA.escuro)
// versão clara (rastro e faíscas em fundo escuro)
const corBrilhoNaipe = (naipe) => (naipe === 'copas' || naipe === 'ouros' ? 0xff5a70 : 0xb8a8ff)

// Profundidades usadas pela carta fora da mão
const PROF = { voo: 90, impacto: 95 }
const TAU = Math.PI * 2
const VALOR_SUPER = 14
// faixas da moldura arco-íris da carta SUPER (de fora para dentro) e cores dos brilhos
const ARCO_IRIS = [0xff4a5a, 0xffa23a, 0xffe14a, 0x5ae06a, 0x4ab8ff, 0xa66bff]
const BASE = 70 // largura de referência: todas as medidas abaixo são em "u" (largura / 70)

// ---------- formas de naipe (vetoriais: nítidas em qualquer escala) ----------
// Mesmas curvas das balas bala-<naipe> (arte/texturas.js), raio 1.

const v = (x, y) => new Phaser.Math.Vector2(x, y)
const cubica = (a, b, c, d) => new Phaser.Curves.CubicBezier(v(...a), v(...b), v(...c), v(...d)).getPoints(10).slice(0, -1)
const quadratica = (a, b, c) => new Phaser.Curves.QuadraticBezier(v(...a), v(...b), v(...c)).getPoints(6).slice(0, -1)

let FORMAS = null // calculadas na primeira carta (Phaser já carregado)
function formas() {
  if (FORMAS) return FORMAS
  const poli = (pontos) => ({ tipo: 'poli', pontos })
  const circulo = (x, y, r) => ({ tipo: 'circulo', x, y, r })
  FORMAS = {
    espadas: [
      poli([
        ...cubica([0, -1], [0.4, -0.5], [1.1, -0.1], [0.9, 0.35]),
        ...cubica([0.9, 0.35], [0.7, 0.75], [0.2, 0.7], [0, 0.35]),
        ...cubica([0, 0.35], [-0.2, 0.7], [-0.7, 0.75], [-0.9, 0.35]),
        ...cubica([-0.9, 0.35], [-1.1, -0.1], [-0.4, -0.5], [0, -1]),
      ]),
      poli([v(0, 0.2), v(0.4, 1), v(-0.4, 1)]),
    ],
    copas: [
      poli([...cubica([0, 0.95], [-1.25, 0], [-0.95, -1.05], [0, -0.4]), ...cubica([0, -0.4], [0.95, -1.05], [1.25, 0], [0, 0.95])]),
    ],
    ouros: [
      poli([
        ...quadratica([0, -1], [0.25, -0.25], [0.8, 0]),
        ...quadratica([0.8, 0], [0.25, 0.25], [0, 1]),
        ...quadratica([0, 1], [-0.25, 0.25], [-0.8, 0]),
        ...quadratica([-0.8, 0], [-0.25, -0.25], [0, -1]),
      ]),
    ],
    paus: [
      circulo(0, -0.45, 0.4),
      circulo(-0.45, 0.12, 0.4),
      circulo(0.45, 0.12, 0.4),
      circulo(0, 0, 0.25),
      poli([v(0, 0), v(0.35, 1), v(-0.35, 1)]),
    ],
  }
  return FORMAS
}

// Desenha um naipe em (x, y) com "raio" r; invertido = de cabeça para baixo
export function desenharNaipe(g, naipe, x, y, r, cor, alpha = 1, invertido = false) {
  const s = invertido ? -1 : 1
  g.fillStyle(cor, alpha)
  for (const f of formas()[naipe] ?? []) {
    if (f.tipo === 'circulo') g.fillCircle(x + f.x * r * s, y + f.y * r * s, f.r * r)
    else g.fillPoints(f.pontos.map((p) => ({ x: x + p.x * r * s, y: y + p.y * r * s })), true)
  }
}

// Posições dos naipes no miolo das cartas numéricas (x, y em -1..1)
const PIPS = {
  2: [[0, -1], [0, 1]],
  3: [[0, -1], [0, 0], [0, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  7: [[-1, -1], [1, -1], [0, -0.5], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  8: [[-1, -1], [1, -1], [0, -0.5], [-1, 0], [1, 0], [0, 0.5], [-1, 1], [1, 1]],
  9: [[-1, -1], [1, -1], [-1, -0.33], [1, -0.33], [0, 0], [-1, 0.33], [1, 0.33], [-1, 1], [1, 1]],
  10: [[-1, -1], [1, -1], [0, -0.66], [-1, -0.33], [1, -0.33], [-1, 0.33], [1, 0.33], [0, 0.66], [-1, 1], [1, 1]],
}

// Estrela de 4 pontas (brilhos)
function pontosEstrela(r) {
  return Array.from({ length: 8 }, (_, i) => {
    const raio = i % 2 ? r * 0.28 : r
    const a = -Math.PI / 2 + (i * Math.PI) / 4
    return { x: Math.cos(a) * raio, y: Math.sin(a) * raio }
  })
}

// Estrela de 5 pontas com ponta para cima (carta SUPER)
function pontosEstrela5(r) {
  return Array.from({ length: 10 }, (_, i) => {
    const raio = i % 2 ? r * 0.45 : r
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    return { x: Math.cos(a) * raio, y: Math.sin(a) * raio }
  })
}

// mistura duas cores 0xRRGGBB (t = 0 -> a, 1 -> b)
function misturar(a, b, t) {
  const ca = Phaser.Display.Color.IntegerToColor(a)
  const cb = Phaser.Display.Color.IntegerToColor(b)
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, Math.round(t * 100))
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b)
}

export default class Carta extends Phaser.GameObjects.Container {
  constructor(scene, x, y, dados, opcoes = {}) {
    super(scene, x, y)
    scene.add.existing(this)
    this.dados = dados
    this.largura = opcoes.largura ?? BASE
    this.altura = opcoes.altura ?? Math.round((this.largura * 10) / 7)
    this.u = this.largura / BASE
    this.corPersonagem = opcoes.cor ?? PERSONAGENS[dados.personagem]?.cor ?? 0x8a7aff
    this.corFoco = opcoes.corFoco ?? 0xffffff
    this.focoCfg = { subida: 14, escala: 1.1, ...opcoes.foco }
    this.virada = false
    this.foco = false
    this.indisponivel = false
    this.ampliada = false
    this.mao = null // Mao dona da carta (preenchido por Mao)
    this._escala = 1 // escala do corpo (o flip mexe só no scaleX)
    this._virando = false
    this.super = dados.valor === VALOR_SUPER
    this.especial = dados.valor === 1 || dados.valor >= 11

    scene.textures.get('carta-brilho')?.setFilter(Phaser.Textures.FilterMode.LINEAR)

    // corpo: tudo que sobe/inclina/vira; o container de fora é a posição na mesa
    this.corpo = scene.add.container(0, 0)
    this.add(this.corpo)

    this.sombra = scene.add.graphics()
    this.brilho = scene.add.image(0, 0, 'carta-brilho').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
    this.brilho.setDisplaySize((this.largura * 128) / 70, (this.altura * 160) / 100)
    this.frente = scene.add.container(0, 0)
    this.verso = scene.add.container(0, 0)
    this.veu = scene.add.graphics().setAlpha(0) // escurece (indisponível)
    this.clarao = scene.add.graphics().setAlpha(0).setBlendMode(Phaser.BlendModes.ADD) // flash da revelação
    this.corpo.add([this.brilho, this.sombra, this.frente, this.verso, this.veu, this.clarao])

    this.desenharSombra()
    this.desenharFrente()
    this.desenharVerso()
    const { largura: w, altura: h, u } = this
    for (const [g, cor] of [[this.veu, 0x000000], [this.clarao, 0xffffff]]) {
      g.fillStyle(cor, 1)
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 6 * u)
    }
    this.legenda = this.criarLegenda()

    this.setVirada(opcoes.virada ?? false)
    if (this.especial) this.iniciarBrilhos()
    this.atualizarBrilho()
    if (opcoes.ampliada) this.setAmpliada(opcoes.ampliada)
  }

  // ---------- desenho ----------

  texto(x, y, conteudo, tamanho, cor, extra = {}) {
    const t = this.scene.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, ...extra })
    t.setResolution(RES.escala * 3) // nítido também na carta ampliada
    return t
  }

  desenharSombra() {
    const { largura: w, altura: h, u } = this
    this.sombra.clear()
    this.sombra.fillStyle(0x000000, 0.35)
    this.sombra.fillRoundedRect(-w / 2 + 2.5 * u, -h / 2 + 3.5 * u, w, h, 6 * u)
  }

  desenharFrente() {
    const { largura: w, altura: h, u, dados } = this
    const hw = w / 2
    const hh = h / 2
    const cor = corDoNaipe(dados.naipe)
    const corHex = '#' + cor.toString(16).padStart(6, '0')
    const g = this.scene.add.graphics()
    this.frente.add(g)

    // papel com borda
    g.fillStyle(CORES_CARTA.borda, 1)
    g.fillRoundedRect(-hw, -hh, w, h, 6 * u)
    g.fillStyle(CORES_CARTA.papel, 1)
    g.fillRoundedRect(-hw + 1.2 * u, -hh + 1.2 * u, w - 2.4 * u, h - 2.4 * u, 5 * u)
    // fio interno (SUPER: moldura arco-íris)
    if (this.super) {
      ARCO_IRIS.forEach((c, i) => {
        g.lineStyle(0.75 * u, c, 1)
        const d = (1.6 + i * 0.7) * u
        g.strokeRoundedRect(-hw + d, -hh + d, w - d * 2, h - d * 2, Math.max(1, 5 * u - i * 0.4 * u))
      })
    } else {
      g.lineStyle(0.8 * u, CORES_CARTA.papelSombra, 1)
      g.strokeRoundedRect(-hw + 3.2 * u, -hh + 3.2 * u, w - 6.4 * u, h - 6.4 * u, 3.5 * u)
    }

    // miolo: SUPER, figura, Ás ou naipes
    const cy = -7 * u
    if (this.super) this.desenharSuper(g, cy)
    else if (dados.valor === 1) this.desenharAs(g, cy)
    else if (dados.valor >= 11) this.desenharFigura(g, cy)
    else this.desenharPips(g, cy)

    // faixa do nome (cor do personagem, bem suave)
    const fy = 21 * u
    const fh = 16 * u
    g.fillStyle(this.corPersonagem, 0.2)
    g.fillRoundedRect(-21 * u, fy, 42 * u, fh, 3 * u)
    g.lineStyle(0.8 * u, this.corPersonagem, 0.75)
    g.strokeRoundedRect(-21 * u, fy, 42 * u, fh, 3 * u)
    g.fillStyle(this.corPersonagem, 0.9)
    g.fillRect(-15 * u, fy + fh - 1.6 * u, 30 * u, 1.2 * u)
    const nome = this.texto(0, fy + fh / 2 - 0.4 * u, dados.nome ?? '', 7 * u, '#2a2238', {
      align: 'center',
      wordWrap: { width: 40 * u, useAdvancedWrap: true },
      lineSpacing: -1.5 * u,
    }).setOrigin(0.5)
    // encolhe até caber na faixa
    for (let tam = 7; tam > 4.5 && (nome.height > fh + 1 * u || nome.width > 41 * u); tam -= 0.5) nome.setFontSize(tam * u)
    this.frente.add(nome)

    // cantos: valor + naipe (o de baixo, de cabeça para baixo)
    const rotulo = rotuloValor(dados.valor)
    const tamRotulo = (rotulo.length > 1 ? 10.5 : 12.5) * u
    const cx = hw - 8 * u
    for (const lado of [-1, 1]) {
      if (this.super) {
        // SUPER: estrela dourada no lugar do valor e do naipe
        const sx = cx * lado
        const sy = (hh - 12 * u) * lado
        g.fillStyle(CORES_CARTA.ouroEscuro, 1)
        g.fillPoints(pontosEstrela5(6.4 * u).map((p) => ({ x: sx + p.x, y: sy + p.y * lado })), true)
        g.fillStyle(CORES_CARTA.ouro, 1)
        g.fillPoints(pontosEstrela5(5.2 * u).map((p) => ({ x: sx + p.x, y: sy + p.y * lado })), true)
        continue
      }
      const t = this.texto(cx * lado, (hh - 3 * u) * lado, rotulo, tamRotulo, corHex, { stroke: corHex, strokeThickness: 0.6 * u })
      t.setOrigin(0.5, 0).setRotation(lado === 1 ? Math.PI : 0)
      this.frente.add(t)
      desenharNaipe(g, dados.naipe, cx * lado, (hh - 20 * u) * lado, 4 * u, cor, 1, lado === 1)
    }

    // gema de energia (canto superior direito)
    this.gema = this.scene.add.graphics()
    this.gemaTexto = this.texto(hw - 9.5 * u, -hh + 9.5 * u, String(dados.custo ?? 0), 8.5 * u, '#ffffff', {
      stroke: '#06283e',
      strokeThickness: 2 * u,
    }).setOrigin(0.5, 0.52)
    this.frente.add([this.gema, this.gemaTexto])
    this.desenharGema(false)

    // brilhos (figuras e Ás) ficam por cima da arte
    this.camadaBrilhos = this.scene.add.container(0, 0)
    this.frente.add(this.camadaBrilhos)
  }

  desenharGema(semEnergia) {
    const { u } = this
    const g = this.gema
    const x = this.largura / 2 - 9.5 * u
    const y = -this.altura / 2 + 9.5 * u
    const r = 7.5 * u
    const losango = (raio) => [
      { x, y: y - raio },
      { x: x + raio * 0.86, y },
      { x, y: y + raio },
      { x: x - raio * 0.86, y },
    ]
    const corpo = semEnergia ? CORES_CARTA.gemaSem : CORES_CARTA.gema
    const escura = semEnergia ? 0x3a0a14 : CORES_CARTA.gemaEscura
    g.clear()
    g.fillStyle(escura, 1)
    g.fillPoints(losango(r + 1.3 * u), true)
    g.fillStyle(corpo, 1)
    g.fillPoints(losango(r), true)
    // faceta clara em cima
    g.fillStyle(semEnergia ? 0xd8707e : CORES_CARTA.gemaClara, 0.75)
    g.fillPoints([{ x, y: y - r }, { x: x + r * 0.86, y }, { x, y: y - r * 0.25 }, { x: x - r * 0.86, y }], true)
    this.gemaTexto?.setStroke(semEnergia ? '#3a0a14' : '#06283e', 2 * u)
  }

  desenharPips(g, cy) {
    const { u, dados } = this
    const cor = corDoNaipe(dados.naipe)
    const posicoes = PIPS[dados.valor] ?? [[0, 0]]
    const r = (dados.valor >= 9 ? 5 : 5.6) * u
    for (const [px, py] of posicoes) desenharNaipe(g, dados.naipe, px * 12.5 * u, cy + py * 19 * u, r, cor, 1, py > 0.01)
  }

  desenharAs(g, cy) {
    const { u, dados } = this
    const cor = corDoNaipe(dados.naipe)
    // rosácea dourada atrás do naipe
    g.fillStyle(CORES_CARTA.ouroClaro, 0.55)
    g.fillCircle(0, cy, 20 * u)
    for (let i = 0; i < 16; i++) {
      const a = (i * TAU) / 16
      const r1 = 15 * u
      const r2 = (i % 2 ? 19 : 22.5) * u
      const largura = 0.11
      g.fillStyle(CORES_CARTA.ouro, i % 2 ? 0.45 : 0.8)
      g.fillTriangle(
        Math.cos(a - largura) * r1,
        cy + Math.sin(a - largura) * r1,
        Math.cos(a + largura) * r1,
        cy + Math.sin(a + largura) * r1,
        Math.cos(a) * r2,
        cy + Math.sin(a) * r2,
      )
    }
    g.lineStyle(1 * u, CORES_CARTA.ouroEscuro, 0.9)
    g.strokeCircle(0, cy, 16 * u)
    g.lineStyle(0.6 * u, CORES_CARTA.ouro, 1)
    g.strokeCircle(0, cy, 14.2 * u)
    // naipe grande com contorno dourado
    desenharNaipe(g, dados.naipe, 0, cy, 13.6 * u, CORES_CARTA.ouroEscuro)
    desenharNaipe(g, dados.naipe, 0, cy, 12.4 * u, cor)
    // reflexo
    g.fillStyle(0xffffff, 0.35)
    g.fillEllipse(-4 * u, cy - 5 * u, 4 * u, 7 * u)
  }

  desenharFigura(g, cy) {
    const { u, dados } = this
    const cor = corDoNaipe(dados.naipe)
    const x0 = -22 * u
    const y0 = cy - 25 * u
    const fw = 44 * u
    const fh = 47 * u
    // fundo da moldura levemente na cor do naipe
    g.fillStyle(misturar(CORES_CARTA.papel, cor, 0.1), 1)
    g.fillRect(x0, y0, fw, fh)
    // diagonais finas (textura de "gravura")
    g.lineStyle(0.5 * u, cor, 0.12)
    for (let d = -fh; d < fw; d += 4 * u) {
      const ax = Math.max(0, d)
      const ay = Math.max(0, -d)
      const len = Math.min(fw - ax, fh - ay)
      g.lineBetween(x0 + ax, y0 + ay, x0 + ax + len, y0 + ay + len)
    }
    // moldura dupla dourada
    g.lineStyle(1.4 * u, CORES_CARTA.ouro, 1)
    g.strokeRect(x0, y0, fw, fh)
    g.lineStyle(0.6 * u, CORES_CARTA.ouroEscuro, 1)
    g.strokeRect(x0 + 2 * u, y0 + 2 * u, fw - 4 * u, fh - 4 * u)
    // ornamentos nos cantos da moldura
    for (const [ox, oy] of [[x0, y0], [x0 + fw, y0], [x0, y0 + fh], [x0 + fw, y0 + fh]]) {
      const r = 2.6 * u
      g.fillStyle(CORES_CARTA.ouroEscuro, 1)
      g.fillPoints([{ x: ox, y: oy - r - 0.6 * u }, { x: ox + r + 0.6 * u, y: oy }, { x: ox, y: oy + r + 0.6 * u }, { x: ox - r - 0.6 * u, y: oy }], true)
      g.fillStyle(CORES_CARTA.ouro, 1)
      g.fillPoints([{ x: ox, y: oy - r }, { x: ox + r, y: oy }, { x: ox, y: oy + r }, { x: ox - r, y: oy }], true)
    }
    // emblema (coroa do K, tiara da Q, chapéu de pena do J)
    this.desenharEmblema(g, 0, cy - 12 * u, cor)
    // naipe médio embaixo do emblema
    desenharNaipe(g, dados.naipe, 0, cy + 8 * u, 10.6 * u, CORES_CARTA.ouroEscuro)
    desenharNaipe(g, dados.naipe, 0, cy + 8 * u, 9.6 * u, cor)
    g.fillStyle(0xffffff, 0.3)
    g.fillEllipse(-3 * u, cy + 4 * u, 3 * u, 5 * u)
  }

  // SUPER: janela "cósmica" com raios arco-íris, estrela grande dourada na cor
  // do personagem e a palavra SUPER embaixo
  desenharSuper(g, cy) {
    const { u } = this
    const x0 = -22 * u
    const y0 = cy - 25 * u
    const fw = 44 * u
    const fh = 47 * u
    const cx = 0
    const sy = cy - 5 * u
    g.fillStyle(0x140c26, 1)
    g.fillRect(x0, y0, fw, fh)
    // arte própria do personagem (pvp/super/sprites/<personagem>.js, chave super-<personagem>-carta):
    // ocupa a janela inteira (proporção 44x47) e ganha só a moldura e a palavra SUPER por cima
    const arte = `super-${this.dados.personagem}-carta`
    if (this.scene.textures.exists(arte)) {
      const img = this.scene.add.image(cx, y0 + fh / 2, arte)
      img.setScale(Math.min(fw / img.width, fh / img.height))
      const moldura = this.scene.add.graphics()
      moldura.lineStyle(1.4 * u, CORES_CARTA.ouro, 1)
      moldura.strokeRect(x0, y0, fw, fh)
      moldura.lineStyle(0.6 * u, CORES_CARTA.ouroEscuro, 1)
      moldura.strokeRect(x0 + 2 * u, y0 + 2 * u, fw - 4 * u, fh - 4 * u)
      const palavra = this.texto(cx, y0 + fh - 7.5 * u, 'SUPER', 9.5 * u, '#ffe14a', { stroke: '#5a2a00', strokeThickness: 2.2 * u }).setOrigin(0.5)
      this.frente.add([img, moldura, palavra])
      return
    }
    // raios arco-íris saindo da estrela (recortados na janela pelo comprimento)
    const raios = 18
    for (let i = 0; i < raios; i++) {
      const a = (i * TAU) / raios
      const l = 30 * u
      const larg = 0.09
      const pts = [
        { x: cx, y: sy },
        { x: cx + Math.cos(a - larg) * l, y: sy + Math.sin(a - larg) * l },
        { x: cx + Math.cos(a + larg) * l, y: sy + Math.sin(a + larg) * l },
      ].map((p) => ({ x: Phaser.Math.Clamp(p.x, x0, x0 + fw), y: Phaser.Math.Clamp(p.y, y0, y0 + fh) }))
      g.fillStyle(ARCO_IRIS[i % ARCO_IRIS.length], 0.35)
      g.fillPoints(pts, true)
    }
    // estrelinhas do fundo
    for (const [px, py, r] of [[-17, -21, 1], [15, -19, 1.3], [-14, 12, 1.1], [17, 9, 0.9], [-6, -23, 0.7], [8, 15, 0.8]]) {
      g.fillStyle(0xffffff, 0.85)
      g.fillPoints(pontosEstrela(r * 2.2 * u).map((p) => ({ x: p.x + px * u, y: p.y + cy + py * u })), true)
    }
    // halo na cor do personagem
    g.fillStyle(this.corPersonagem, 0.35)
    g.fillCircle(cx, sy, 15 * u)
    g.fillStyle(this.corPersonagem, 0.25)
    g.fillCircle(cx, sy, 19 * u)
    // estrela grande: contorno escuro, ouro e reflexo
    g.fillStyle(CORES_CARTA.ouroEscuro, 1)
    g.fillPoints(pontosEstrela5(15 * u).map((p) => ({ x: cx + p.x, y: sy + p.y })), true)
    g.fillStyle(CORES_CARTA.ouro, 1)
    g.fillPoints(pontosEstrela5(13.2 * u).map((p) => ({ x: cx + p.x, y: sy + p.y })), true)
    g.fillStyle(CORES_CARTA.ouroClaro, 1)
    g.fillPoints(pontosEstrela5(7 * u).map((p) => ({ x: cx + p.x, y: sy + p.y })), true)
    g.fillStyle(this.corPersonagem, 1)
    g.fillCircle(cx, sy + 0.5 * u, 2.4 * u)
    // moldura dupla dourada
    g.lineStyle(1.4 * u, CORES_CARTA.ouro, 1)
    g.strokeRect(x0, y0, fw, fh)
    g.lineStyle(0.6 * u, CORES_CARTA.ouroEscuro, 1)
    g.strokeRect(x0 + 2 * u, y0 + 2 * u, fw - 4 * u, fh - 4 * u)
    // SUPER
    const palavra = this.texto(cx, y0 + fh - 7.5 * u, 'SUPER', 9.5 * u, '#ffe14a', { stroke: '#5a2a00', strokeThickness: 2.2 * u }).setOrigin(0.5)
    this.frente.add(palavra)
  }

  desenharEmblema(g, x, y, cor) {
    const { u, dados } = this
    const P = (px, py) => ({ x: x + px * u, y: y + py * u })
    const contorno = (pontos) => {
      g.fillStyle(CORES_CARTA.ouro, 1)
      g.fillPoints(pontos, true)
      g.lineStyle(0.8 * u, CORES_CARTA.ouroEscuro, 1)
      g.strokePoints(pontos, true)
    }
    if (dados.valor === 13) {
      // coroa de 3 pontas com bolinhas
      contorno([P(-11, 6), P(-11, -4), P(-5.5, 1), P(0, -8), P(5.5, 1), P(11, -4), P(11, 6)])
      g.fillStyle(CORES_CARTA.ouroEscuro, 1)
      g.fillRect(x - 11 * u, y + 3 * u, 22 * u, 1 * u)
      for (const [px, py] of [[-11, -4], [0, -8], [11, -4]]) {
        g.fillStyle(CORES_CARTA.ouroEscuro, 1)
        g.fillCircle(x + px * u, y + py * u, 2 * u)
        g.fillStyle(CORES_CARTA.ouroClaro, 1)
        g.fillCircle(x + px * u, y + py * u, 1.3 * u)
      }
      for (const px of [-6, 0, 6]) {
        g.fillStyle(px === 0 ? cor : CORES_CARTA.ouroEscuro, 1)
        g.fillCircle(x + px * u, y + 1.2 * u, 1.3 * u)
      }
    } else if (dados.valor === 12) {
      // tiara arredondada com gema no centro
      const arco = []
      for (let i = 0; i <= 12; i++) {
        const t = i / 12
        const px = -10 + 20 * t
        const ondas = Math.abs(Math.cos(t * Math.PI * 3))
        arco.push(P(px, -2 - 5 * ondas - 3 * Math.sin(t * Math.PI)))
      }
      contorno([P(-10, 5), ...arco, P(10, 5)])
      g.fillStyle(CORES_CARTA.ouroEscuro, 1)
      g.fillCircle(x, y - 1 * u, 3 * u)
      g.fillStyle(cor, 1)
      g.fillCircle(x, y - 1 * u, 2.2 * u)
      g.fillStyle(0xffffff, 0.6)
      g.fillCircle(x - 0.7 * u, y - 1.7 * u, 0.7 * u)
      for (const px of [-6, 6]) {
        g.fillStyle(CORES_CARTA.ouroClaro, 1)
        g.fillCircle(x + px * u, y + 2 * u, 1.1 * u)
      }
    } else {
      // chapéu do valete com pena
      const pena = [P(3, -2), P(8, -9), P(14, -12), P(11, -6), P(7, -1)]
      g.fillStyle(cor, 1)
      g.fillPoints(pena, true)
      g.lineStyle(0.6 * u, CORES_CARTA.ouroEscuro, 1)
      g.strokePoints(pena, true)
      g.lineBetween(x + 4 * u, y - 2 * u, x + 12 * u, y - 10 * u)
      contorno([P(-11, 6), P(-9, -1), P(-4, -5), P(4, -5), P(9, -1), P(11, 6)])
      g.fillStyle(cor, 0.85)
      g.fillRect(x - 10 * u, y + 2 * u, 20 * u, 2 * u)
      g.fillStyle(CORES_CARTA.ouroClaro, 1)
      g.fillCircle(x - 4 * u, y - 1 * u, 1.1 * u)
    }
  }

  desenharVerso() {
    const { largura: w, altura: h, u } = this
    const hw = w / 2
    const hh = h / 2
    const cor = this.corPersonagem
    const fundo = misturar(CORES_CARTA.verso, cor, 0.18)
    const g = this.scene.add.graphics()
    this.verso.add(g)

    // borda de papel (como baralho de verdade) e campo escuro
    g.fillStyle(CORES_CARTA.borda, 1)
    g.fillRoundedRect(-hw, -hh, w, h, 6 * u)
    g.fillStyle(CORES_CARTA.papel, 1)
    g.fillRoundedRect(-hw + 1.2 * u, -hh + 1.2 * u, w - 2.4 * u, h - 2.4 * u, 5 * u)
    const m = 4 * u
    g.fillStyle(fundo, 1)
    g.fillRoundedRect(-hw + m, -hh + m, w - 2 * m, h - 2 * m, 3.5 * u)

    // treliça de losangos (só os que cabem inteiros)
    const passo = 7 * u
    const r = 3 * u
    const limX = hw - m - 2.5 * u
    const limY = hh - m - 2.5 * u
    for (let linha = -10; linha <= 10; linha++) {
      for (let coluna = -10; coluna <= 10; coluna++) {
        const x = coluna * passo + (linha % 2 ? passo / 2 : 0)
        const y = linha * passo * 0.75
        if (Math.abs(x) + r * 0.8 > limX || Math.abs(y) + r > limY) continue
        const par = (linha + coluna) % 2 === 0
        g.fillStyle(par ? cor : misturar(cor, 0xffffff, 0.35), par ? 0.45 : 0.22)
        g.fillPoints([{ x, y: y - r }, { x: x + r * 0.8, y }, { x, y: y + r }, { x: x - r * 0.8, y }], true)
      }
    }
    // filetes
    g.lineStyle(1 * u, cor, 0.9)
    g.strokeRoundedRect(-hw + m + 2 * u, -hh + m + 2 * u, w - 2 * m - 4 * u, h - 2 * m - 4 * u, 2.5 * u)
    g.lineStyle(0.5 * u, CORES_CARTA.ouroClaro, 0.5)
    g.strokeRoundedRect(-hw + m + 3.6 * u, -hh + m + 3.6 * u, w - 2 * m - 7.2 * u, h - 2 * m - 7.2 * u, 2 * u)
    // cantoneiras
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const cx = sx * (hw - m - 2 * u)
        const cy = sy * (hh - m - 2 * u)
        g.fillStyle(CORES_CARTA.ouro, 1)
        g.fillTriangle(cx, cy, cx - sx * 7 * u, cy, cx, cy - sy * 7 * u)
      }
    }
    // medalhão central com os quatro naipes
    g.fillStyle(fundo, 1)
    g.fillCircle(0, 0, 15 * u)
    g.lineStyle(1.4 * u, CORES_CARTA.ouro, 1)
    g.strokeCircle(0, 0, 15 * u)
    g.lineStyle(0.7 * u, cor, 1)
    g.strokeCircle(0, 0, 12 * u)
    const naipes = ['espadas', 'copas', 'paus', 'ouros']
    naipes.forEach((n, i) => {
      const a = -Math.PI / 2 + (i * TAU) / 4
      desenharNaipe(g, n, Math.cos(a) * 8 * u, Math.sin(a) * 8 * u, 2.8 * u, CORES_CARTA.papel, 0.95)
    })
    g.fillStyle(CORES_CARTA.ouro, 1)
    g.fillPoints(pontosEstrela(4.5 * u).map((p) => ({ x: p.x, y: p.y })), true)
    g.fillStyle(CORES_CARTA.ouroClaro, 1)
    g.fillCircle(0, 0, 1.2 * u)
  }

  criarLegenda() {
    const { u, dados } = this
    const largura = this.largura * 1.5
    const c = this.scene.add.container(0, this.altura / 2 + 5 * u).setAlpha(0).setVisible(false)
    const cor = corDoNaipe(dados.naipe)
    const corClara = '#' + corBrilhoNaipe(dados.naipe).toString(16).padStart(6, '0')
    const rotuloTipo = this.super ? '★ SUPER · imparável' : `${SIMBOLOS[dados.naipe] ?? ''} ${TIPOS[dados.naipe] ?? ''} · ${rotuloValor(dados.valor)}`
    const tipo = this.texto(0, 3 * u, rotuloTipo, 5 * u, this.super ? '#ffe14a' : corClara).setOrigin(0.5, 0)
    const desc = this.texto(0, 10 * u, dados.descricao ?? '', 4.6 * u, '#ffffff', {
      align: 'center',
      wordWrap: { width: largura - 8 * u, useAdvancedWrap: true },
      lineSpacing: 0.5 * u,
    }).setOrigin(0.5, 0)
    const altura = 13 * u + desc.height
    const g = this.scene.add.graphics()
    g.fillStyle(0x0b0914, 0.94)
    g.fillRoundedRect(-largura / 2, 0, largura, altura, 3 * u)
    g.lineStyle(0.8 * u, this.super ? CORES_CARTA.ouro : cor === CORES_CARTA.vermelho ? 0xff5a70 : 0x9a8ad8, 1)
    g.strokeRoundedRect(-largura / 2, 0, largura, altura, 3 * u)
    c.add([g, tipo, desc])
    this.corpo.add(c)
    return c
  }

  // ---------- brilho (cursor e cartas especiais) ----------

  iniciarBrilhos() {
    const { u } = this
    const ouro = this.dados.valor === 1 ? 0xffffff : CORES_CARTA.ouroClaro
    let k = 0
    this.timerBrilhos = this.scene.time.addEvent({
      delay: this.super ? 170 : this.dados.valor === 1 ? 260 : 420,
      loop: true,
      callback: () => {
        if (!this.visible || this.virada || !this.scene) return
        const g = this.scene.add.graphics()
        g.fillStyle(this.super ? ARCO_IRIS[k++ % ARCO_IRIS.length] : ouro, 1)
        g.fillPoints(pontosEstrela(3.2 * u), true)
        g.setPosition(Phaser.Math.FloatBetween(-24, 24) * u, Phaser.Math.FloatBetween(-34, 18) * u)
        g.setScale(0).setBlendMode(Phaser.BlendModes.ADD)
        this.camadaBrilhos.add(g)
        this.scene.tweens.add({
          targets: g,
          scale: Phaser.Math.FloatBetween(0.6, 1.1),
          angle: 90,
          duration: 260,
          yoyo: true,
          ease: 'Sine.easeInOut',
          onComplete: () => g.destroy(),
        })
      },
    })
  }

  atualizarBrilho() {
    if (!this.scene) return
    this.pulso?.stop()
    this.pulso = null
    this.scene.tweens.killTweensOf(this.brilho)
    if (this.foco) {
      this.brilho.setTint(this.corFoco)
      this.scene.tweens.add({ targets: this.brilho, alpha: this.indisponivel ? 0.35 : 0.95, duration: 120 })
      this.pulso = this.scene.tweens.add({ targets: this.brilho, scale: this.brilho.scale * 1.05, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    } else if (this.especial && !this.virada && !this.indisponivel) {
      const as = this.dados.valor === 1
      if (this.super) {
        // SUPER: brilho forte que passeia pelas cores do arco-íris
        this.brilho.setTint(ARCO_IRIS[0]).setAlpha(0.5)
        let i = 0
        this.pulso = this.scene.tweens.add({
          targets: this.brilho,
          alpha: 0.95,
          duration: 380,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          onYoyo: () => this.brilho.setTint(ARCO_IRIS[++i % ARCO_IRIS.length]),
        })
        return
      }
      this.brilho.setTint(as ? 0xfff2c0 : CORES_CARTA.ouro)
      this.brilho.setAlpha(as ? 0.35 : 0.15)
      this.pulso = this.scene.tweens.add({ targets: this.brilho, alpha: as ? 0.75 : 0.4, duration: as ? 520 : 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    } else {
      this.scene.tweens.add({ targets: this.brilho, alpha: 0, duration: 120 })
    }
  }

  setCorFoco(cor) {
    this.corFoco = cor
    if (this.foco) this.atualizarBrilho()
    return this
  }

  // ---------- estados ----------

  // troca a face na hora (sem animação)
  setVirada(virada) {
    this.virada = virada
    this.frente.setVisible(!virada)
    this.verso.setVisible(virada)
    this.atualizarBrilho()
    return this
  }

  // cursor em cima: sobe, cresce um pouco, brilha e inclina (sinal: -1 esquerda, 1 direita)
  focar(ligado, { sinal = 1 } = {}) {
    if (this.foco === ligado) return this
    this.foco = ligado
    const { subida, escala } = this.focoCfg
    this._escala = ligado ? escala : 1
    const alvo = { y: ligado ? -subida * this.u : 0, scaleY: this._escala, rotation: ligado ? 0.05 * sinal : 0 }
    if (!this._virando) alvo.scaleX = this._escala
    // um estado novo cancela o anterior (senão um tween atrasado deixa a carta torta/grande)
    this.pararTweensCorpo()
    this._tFoco = this.scene.tweens.add({ targets: this.corpo, ...alvo, duration: 160, ease: 'Back.easeOut' })
    if (ligado) {
      // "tremidinha" ao chegar: passa da inclinação e volta
      this._tTremida = this.scene.tweens.add({ targets: this.corpo, rotation: 0.11 * sinal, duration: 80, yoyo: true, ease: 'Sine.easeOut' })
    }
    this.atualizarBrilho()
    return this
  }

  pararTweensCorpo() {
    for (const t of [this._tFoco, this._tTremida, this._tSoco]) t?.stop()
    this._tFoco = this._tTremida = this._tSoco = null
  }

  setIndisponivel(valor) {
    if (this.indisponivel === valor) return this
    this.indisponivel = valor
    this.scene.tweens.add({ targets: this.veu, alpha: valor ? 0.55 : 0, duration: 160 })
    this.desenharGema(valor)
    this.atualizarBrilho()
    return this
  }

  // tentou escolher sem poder (indisponível): treme e pisca vermelho
  negar() {
    tocar(this.scene, 'erro')
    const x = this.corpo.x
    this.scene.tweens.add({
      targets: this.corpo,
      x: { from: x - 4 * this.u, to: x },
      duration: 50,
      repeat: 3,
      yoyo: true,
      onComplete: () => this.corpo.setX(0),
    })
    this.brilho.setTint(0xff3048).setAlpha(1)
    this.scene.time.delayedCall(220, () => this.atualizarBrilho())
    return this
  }

  // flip 3D simulado: scaleX vai a 0, troca a face e volta. Devolve Promise.
  virar(frente = true, { duracao = 240, som = true } = {}) {
    return new Promise((resolver) => {
      if (!this.scene) return resolver(this)
      this._virando = true
      if (som) tocar(this.scene, 'cartaVirar')
      const metade = duracao / 2
      // sobe um pouco no meio do giro (a carta "sai" da mesa)
      this.scene.tweens.add({ targets: this.sombra, x: 3 * this.u, y: 4 * this.u, duration: metade, yoyo: true })
      this.scene.tweens.add({
        targets: this.corpo,
        scaleX: 0,
        duration: metade,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.setVirada(!frente)
          this.scene.tweens.add({
            targets: this.corpo,
            scaleX: () => this._escala, // lido agora: o foco pode ter mudado no meio do giro
            duration: metade * 1.2,
            ease: 'Back.easeOut',
            onComplete: () => {
              this._virando = false
              this.corpo.scaleX = this._escala
              resolver(this)
            },
          })
        },
      })
    })
  }

  // escolhida: sobe, "bate" na mesa e vira para baixo
  confirmar() {
    tocar(this.scene, 'confirmar')
    this._tSoco = this.scene.tweens.add({
      targets: this.corpo,
      scaleY: this._escala * 1.12,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => (this.corpo.scaleY = this._escala),
    })
    return this.virar(false, { duracao: 220 })
  }

  // revelação: vira para cima com clarão e um "soco" de escala
  revelar({ duracao = 320 } = {}) {
    tocar(this.scene, 'cartaRevelar')
    const p = this.virar(true, { duracao, som: false })
    this.scene.time.delayedCall(duracao / 2, () => {
      if (!this.scene) return
      this.clarao.setAlpha(0.9)
      this.scene.tweens.add({ targets: this.clarao, alpha: 0, duration: 320, ease: 'Quad.easeOut' })
      const escala = this.scaleX
      this.scene.tweens.add({ targets: this, scaleX: escala * 1.15, scaleY: escala * 1.15, duration: 110, yoyo: true, ease: 'Quad.easeOut' })
      particulas(this.scene, this.x, this.y, { cor: this.especial ? CORES_CARTA.ouroClaro : corBrilhoNaipe(this.dados.naipe), quantidade: this.especial ? 18 : 10, velocidade: 110 })
    })
    return p
  }

  // sai do monte (de) virada e desliza até a mão (para: { x, y, rotacao, escala }); vira para cima ao chegar
  comprar({ de, para, atraso = 0, duracao = 340, revelar = true } = {}) {
    this.setPosition(de.x, de.y).setRotation((para.rotacao ?? 0) - 0.6).setScale((para.escala ?? 1) * 0.8)
    this.setVirada(true)
    this.scene.time.delayedCall(atraso, () => this.scene && tocar(this.scene, 'cartaComprar'))
    this.scene.tweens.add({
      targets: this,
      x: para.x,
      y: para.y,
      rotation: para.rotacao ?? 0,
      scaleX: para.escala ?? 1,
      scaleY: para.escala ?? 1,
      delay: atraso,
      duration: duracao,
      ease: 'Cubic.easeOut',
    })
    return new Promise((resolver) => {
      // o flip não depende do tween de posição (a Mao pode refazer o leque no meio do caminho)
      this.scene.time.delayedCall(atraso + duracao * 0.8, () => {
        if (!this.scene) return resolver(this)
        if (revelar) this.virar(true, { duracao: 200 }).then(resolver)
        else resolver(this)
      })
    })
  }

  // voa girando até alvo { x, y } com rastro, estilhaça e some. Devolve Promise
  // que resolve no impacto (hora de começar o ataque).
  //   duracao  ms do voo     giros  voltas no ar     arco  curvatura (px)
  //   destruir some no impacto (false: fica parada no alvo)
  //   aoImpacto(x, y) callback no impacto (além da Promise)
  arremessar(alvo, { duracao = 460, giros = 1.75, arco = 60, destruir = true, aoImpacto, escalaFinal } = {}) {
    this.mao?.retirar(this)
    this.mao = null
    this.focar(false)
    const cena = this.scene
    this.setDepth(PROF.voo)
    const naipe = this.dados.naipe
    const corRastro = corBrilhoNaipe(naipe)
    const x0 = this.x
    const y0 = this.y
    const dx = alvo.x - x0
    const dy = alvo.y - y0
    const dist = Math.hypot(dx, dy) || 1
    const sinal = dx >= 0 ? 1 : -1
    const s0 = this.scaleX
    const sFinal = escalaFinal ?? s0 * 0.75

    return new Promise((resolver) => {
      // preparação: puxa para trás e cresce (antecipação)
      cena.tweens.add({
        targets: this,
        x: x0 - (dx / dist) * 12,
        y: y0 - (dy / dist) * 12,
        rotation: this.rotation - 0.3 * sinal,
        scaleX: s0 * 1.12,
        scaleY: s0 * 1.12,
        duration: 130,
        ease: 'Quad.easeOut',
        onComplete: () => voar(),
      })

      const voar = () => {
        tocar(cena, 'cartaArremessar')
        const sx = this.x
        const sy = this.y
        const r0 = this.rotation
        const s1 = this.scaleX
        // ponto de controle: meio do caminho, deslocado para "cima" da trajetória
        let px = -dy / dist
        let py = dx / dist
        if (py > 0) {
          px = -px
          py = -py
        }
        const cx = (sx + alvo.x) / 2 + px * arco
        const cy = (sy + alvo.y) / 2 + py * arco
        const faiscas = cena.add.particles(0, 0, 'faisca', {
          follow: this,
          speed: { min: 10, max: 50 },
          lifespan: 320,
          scale: { start: 1.2, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [corRastro, 0xffffff],
          blendMode: 'ADD',
          frequency: 14,
        })
        faiscas.setDepth(PROF.voo - 1)
        let ultimoRastro = 0
        cena.tweens.addCounter({
          from: 0,
          to: 1,
          duration: duracao,
          ease: 'Sine.easeIn',
          onUpdate: (tw) => {
            const t = tw.getValue()
            const a = 1 - t
            this.x = a * a * sx + 2 * a * t * cx + t * t * alvo.x
            this.y = a * a * sy + 2 * a * t * cy + t * t * alvo.y
            this.rotation = r0 + giros * TAU * t * sinal
            this.setScale(s1 + (sFinal - s1) * t)
            if (cena.time.now - ultimoRastro > 22) {
              ultimoRastro = cena.time.now
              this.deixarRastro(corRastro)
            }
          },
          onComplete: () => {
            faiscas.stop()
            cena.time.delayedCall(400, () => faiscas.destroy())
            impactoCarta(cena, alvo.x, alvo.y, { naipe, largura: this.largura * this.scaleX, especial: this.especial })
            aoImpacto?.(alvo.x, alvo.y)
            if (destruir) this.destroy()
            resolver(this)
          },
        })
      }
    })
  }

  // fantasma da carta que fica para trás no voo
  deixarRastro(cor) {
    const { largura: w, altura: h, u } = this
    const g = this.scene.add.graphics()
    g.fillStyle(cor, 0.4)
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 6 * u)
    g.lineStyle(1.5 * u, 0xffffff, 0.5)
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 6 * u)
    g.setPosition(this.x, this.y).setRotation(this.rotation).setScale(this.scaleX).setDepth(PROF.voo - 2)
    g.setBlendMode(Phaser.BlendModes.ADD)
    this.scene.tweens.add({ targets: g, alpha: 0, scale: this.scaleX * 0.8, duration: 200, onComplete: () => g.destroy() })
  }

  // some da mesa (encolhe, cai um pouco e apaga). Devolve Promise.
  descartar({ duracao = 240 } = {}) {
    this.mao?.retirar(this)
    this.mao = null
    tocar(this.scene, 'cartaDescartar')
    return new Promise((resolver) => {
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        y: this.y + 24,
        rotation: this.rotation + 0.5,
        scaleX: this.scaleX * 0.5,
        scaleY: this.scaleY * 0.5,
        duration: duracao,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.destroy()
          resolver()
        },
      })
    })
  }

  // modo "ampliada": cresce (fator) e mostra a legenda com a descrição
  ampliar(fator = 2.4, { x = this.x, y = this.y, duracao = 260 } = {}) {
    this.ampliada = true
    this.legenda.setVisible(true)
    this.scene.tweens.add({ targets: this.legenda, alpha: 1, duration: duracao, delay: duracao * 0.5 })
    return new Promise((resolver) => {
      this.scene.tweens.add({ targets: this, x, y, rotation: 0, scaleX: fator, scaleY: fator, duration: duracao, ease: 'Back.easeOut', onComplete: () => resolver(this) })
    })
  }

  // volta ao tamanho normal (sem legenda)
  reduzir({ duracao = 200 } = {}) {
    this.ampliada = false
    this.scene.tweens.add({ targets: this.legenda, alpha: 0, duration: duracao / 2, onComplete: () => this.legenda.setVisible(false) })
    return new Promise((resolver) => {
      this.scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: duracao, ease: 'Quad.easeOut', onComplete: () => resolver(this) })
    })
  }

  // ampliada na hora (sem animação)
  setAmpliada(fator = 2.4) {
    this.ampliada = true
    this.setScale(fator)
    this.legenda.setVisible(true).setAlpha(1)
    return this
  }

  preDestroy() {
    this.timerBrilhos?.remove()
    this.pulso?.stop()
    if (this.scene) {
      this.scene.tweens.killTweensOf(this)
      this.scene.tweens.killTweensOf(this.corpo)
      this.scene.tweens.killTweensOf(this.brilho)
    }
    super.preDestroy?.()
  }
}

// Estilhaço da carta no alvo: clarão, anel, naipe fantasma, cacos e faíscas
function impactoCarta(scene, x, y, { naipe = 'espadas', largura = 70, especial = false } = {}) {
  const u = largura / BASE
  const cor = corBrilhoNaipe(naipe)
  tocar(scene, 'cartaImpacto')
  shake(scene, 140, especial ? 0.012 : 0.008)

  const clarao = scene.add.graphics().setPosition(x, y).setDepth(PROF.impacto).setBlendMode(Phaser.BlendModes.ADD)
  clarao.fillStyle(0xffffff, 1)
  clarao.fillCircle(0, 0, 12 * u)
  scene.tweens.add({ targets: clarao, scale: 4, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => clarao.destroy() })

  const anel = scene.add.graphics().setPosition(x, y).setDepth(PROF.impacto)
  anel.lineStyle(3, cor, 1)
  anel.strokeCircle(0, 0, 10 * u)
  scene.tweens.add({ targets: anel, scale: 6, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => anel.destroy() })

  const fantasma = scene.add.graphics().setPosition(x, y).setDepth(PROF.impacto).setBlendMode(Phaser.BlendModes.ADD)
  desenharNaipe(fantasma, naipe, 0, 0, 16 * u, cor, 0.9)
  scene.tweens.add({ targets: fantasma, scale: 2.8, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => fantasma.destroy() })

  // cacos de papel e de cor voando e caindo
  const cores = [CORES_CARTA.papel, CORES_CARTA.papel, corDoNaipe(naipe), cor]
  for (let i = 0; i < 14; i++) {
    const caco = scene.add.graphics().setPosition(x, y).setDepth(PROF.impacto)
    const t = Phaser.Math.FloatBetween(3, 7) * u
    caco.fillStyle(cores[i % cores.length], 1)
    caco.fillTriangle(-t, -t * 0.6, t, -t * 0.2, -t * 0.2, t)
    const a = Phaser.Math.FloatBetween(0, TAU)
    const d = Phaser.Math.FloatBetween(28, 78) * u
    const vida = Phaser.Math.Between(420, 680)
    caco.setRotation(Phaser.Math.FloatBetween(0, TAU))
    scene.tweens.add({ targets: caco, x: x + Math.cos(a) * d, duration: vida, ease: 'Cubic.easeOut' })
    scene.tweens.add({ targets: caco, y: y + Math.sin(a) * d * 0.8 + 26 * u, duration: vida, ease: 'Quad.easeIn' })
    scene.tweens.add({
      targets: caco,
      rotation: caco.rotation + Phaser.Math.FloatBetween(-8, 8),
      alpha: 0,
      duration: vida,
      ease: 'Quad.easeIn',
      onComplete: () => caco.destroy(),
    })
  }
  particulas(scene, x, y, { cor, quantidade: especial ? 26 : 16, velocidade: 210, vida: 520 })
}
