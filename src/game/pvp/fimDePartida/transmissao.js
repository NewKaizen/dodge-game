import Phaser from 'phaser'
import { LARGURA, LARGURA_BASE, ALTURA, FONTE } from '../../constants.js'
import { tocar, velocidadeMusica, fitaMusica, cortarMusica, abaixarMusica, restaurarMusica, calarTransmissao } from '../../audio.js'
import { ESCALA } from '../../arte/texturas.js'
import { GRAVACAO } from './gravador.js'
import { RES, ajustarCamera } from '../../resolucao.js'
import { quebrarCoracao, QUEBRA } from './coracaoPartido.js'
import { tremerCamera } from '../../effects/shake.js'
import { fatores, quantas } from '../../acessibilidade.js'

// O REPLAY do golpe final como TRANSMISSÃO ESPORTIVA ao vivo na TV.
// Toca as fotos do Gravador (nada é re-simulado), com o coração de verdade
// desenhado por cima (a foto não tem o coração: ele fica nítido no zoom e
// pode se despedaçar). Linha do tempo:
//   entrada  a TARJA do "INSTANT REPLAY" (faixas diagonais na cor da arena e
//            o selo girando) varre a tela; no meio dela a arena vira o replay
//            e o selo do canto troca "● AO VIVO" por "REPLAY". Torcida começa
//   play     os ~1,5 s antes do golpe em velocidade normal (câmera 1, aberta)
//   lento    câmera lenta, a câmera 1 fechando no coração de quem vai cair;
//            barras de cinema entram, "LANCE DECISIVO" na tarja de baixo
//   close    CORTE para a câmera 2: o close em alta (GRAVACAO.close), em
//            super câmera lenta (quadros misturados, sem engasgo), seguindo
//            o coração; o círculo do comentarista (telestrator) vai sendo
//            desenhado em volta dele; flashes de fotógrafos; a torcida cresce
//   golpe    no quadro do golpe: clarão, tranco no zoom, o "K.O.!" batendo,
//            e o CORAÇÃO DESPEDAÇANDO (coracaoPartido.js, esticado no tempo)
//            em cima da foto; "OHHH!" coletivo + acorde orquestral com a
//            música cortada; quando estilhaça, a torcida EXPLODE, a música
//            volta forte, flashes em rajada, confete e o apito final; a
//            câmera abre devagar para ver os cacos caindo
//   saida    a tarja varre de volta e a arena reaparece ("● AO VIVO")
// Empate: as duas pistas lado a lado (cada uma com sua câmera e seu close).
// Duelo: a mesma coisa com a caixa do duelo; cada tela destaca quem caiu e
// mostra o outro coração junto (pista.outros).
//
// Como fica na tela sem mexer na arena: o replay e as artes de TV ficam numa
// região do mundo bem longe da arena (TV.longe), vistas por câmeras próprias:
// uma por pista (viewport na tela, zoom e scroll livres: o "cinegrafista") e
// uma por cima de tudo com as artes (tarja, placar, flashes). As câmeras da
// arena ficam escondidas durante o replay. encerrar() desfaz TUDO (câmeras,
// objetos, música, sons da torcida se pulou).
//
//   const tv = new Transmissao(cena, { quadros, pistas: [k...], campos, mortos, jogadores, arena, andamento })
//     quadros    [{ tempo, pistas: [{ chave, caixa, borda, coracao, close, outros } | null] }] (k indexa pistas e campos)
//     mortos     [{ j, k }]   jogadores  [{ rotulo, nome, cor, hp }]   arena { nome, cor }
//   await tv.tocar()      resolve no fim (ou quando encerrar() for chamado)
//   tv.atualizar(dtReal)  todo frame
//   tv.encerrar()         pula / sai da cena
export const TV = {
  longe: { x: 40000, y: 40000 }, // região do mundo do replay (pista k: +k * 5000 em x; artes: -5000)
  entradaMs: 820, // a tarja passando (a troca acontece no meio)
  playQuadros: 45, // ~1,5 s em velocidade normal antes da câmera lenta
  lento: { quadros: 9, fator: 0.38 }, // câmera 1 fechando no coração
  close: { quadros: 12, fator: 0.2 }, // câmera 2: super câmera lenta até o golpe
  golpeMs: 2700, // do impacto até a tarja de saída
  estilhacaMs: 820, // quando a torcida explode (o coração estilhaça junto: vagar abaixo)
  saidaMs: 700,
  vagar: 820 / QUEBRA.estilhacaMs, // a quebra do coração esticada até estilhaçar em estilhacaMs
  corBarra: 0x0b0b12,
  ouro: 0xffd23a,
  vermelho: 0xff3048,
}

// texturas (uma vez por jogo): scanline, brilho do flash e confete
function prepararTexturas(cena) {
  const tex = cena.textures
  if (tex.exists('tv-flash')) return
  const l = document.createElement('canvas')
  l.width = 2
  l.height = 3
  const gl = l.getContext('2d')
  gl.fillStyle = 'rgba(0,0,0,0.5)'
  gl.fillRect(0, 2, 2, 1)
  tex.addCanvas('tv-linhas', l)
  // flash de câmera: miolo branco, halo e a estrela de 4 pontas
  const n = 96
  const c = document.createElement('canvas')
  c.width = n
  c.height = n
  const g = c.getContext('2d')
  const rad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
  rad.addColorStop(0, 'rgba(255,255,255,1)')
  rad.addColorStop(0.18, 'rgba(255,255,240,0.9)')
  rad.addColorStop(0.45, 'rgba(255,250,220,0.25)')
  rad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = rad
  g.fillRect(0, 0, n, n)
  g.fillStyle = 'rgba(255,255,255,0.9)'
  g.beginPath()
  g.moveTo(n / 2, 0)
  g.lineTo(n / 2 + 3, n / 2 - 3)
  g.lineTo(n, n / 2)
  g.lineTo(n / 2 + 3, n / 2 + 3)
  g.lineTo(n / 2, n)
  g.lineTo(n / 2 - 3, n / 2 + 3)
  g.lineTo(0, n / 2)
  g.lineTo(n / 2 - 3, n / 2 - 3)
  g.closePath()
  g.fill()
  tex.addCanvas('tv-flash', c)
  const k = document.createElement('canvas')
  k.width = 6
  k.height = 3
  const gk = k.getContext('2d')
  gk.fillStyle = '#ffffff'
  gk.fillRect(0, 0, 6, 3)
  tex.addCanvas('tv-confete', k)
}

const suave = (u) => Phaser.Math.Easing.Sine.InOut(Phaser.Math.Clamp(u, 0, 1))
const hex = (cor) => `#${cor.toString(16).padStart(6, '0')}`

export default class Transmissao {
  constructor(cena, { quadros, pistas, campos, mortos, jogadores, arena, andamento = 1 }) {
    this.cena = cena
    this.quadros = quadros
    this.ks = pistas
    this.campos = campos
    this.mortos = mortos
    this.jogadores = jogadores
    this.arena = arena
    this.andamento = andamento
    this.cor = arena?.cor ?? 0xff4fa8
    this.objetos = []
    this.cameras = []
    this.quebras = []
    this.agenda = [] // [{ ms, fn }] da fase atual (relógio da fase)
    this.fase = null
    this.faseMs = 0
    this.tempo = 0
    this.trocou = false // a arena já virou replay (meio da tarja de entrada)
    this.acabou = false
    this.musica = { abaixada: false, cortada: false, mexida: false }
    this.fim = new Promise((r) => (this.resolver = r))
    prepararTexturas(cena)

    // os quadros que vão ao ar
    const n = quadros.length
    this.iFim = n - 1
    this.iClose = Math.max(0, this.iFim - TV.close.quadros)
    this.iLento = Math.max(0, this.iClose - TV.lento.quadros)
    this.iPlay = Math.max(0, this.iLento - TV.playQuadros)
    this.pos = this.iPlay
    this.ateGolpeMs =
      TV.entradaMs + (this.iLento - this.iPlay) * GRAVACAO.quadroMs + ((this.iClose - this.iLento) * GRAVACAO.quadroMs) / TV.lento.fator + ((this.iFim - this.iClose) * GRAVACAO.quadroMs) / TV.close.fator

    this.montarTelas()
    this.montarArtes()
    this.mudarFase('entrada')
  }

  tocar() {
    return this.fim
  }

  novo(o) {
    this.objetos.push(o)
    return o
  }

  // posição na tela -> mundo das artes (vistas pela câmera de cima)
  get artes() {
    return { x: TV.longe.x - 5000, y: TV.longe.y }
  }

  // ---------- montagem ----------

  montarTelas() {
    const cena = this.cena
    const duas = this.ks.length > 1
    const ultimo = this.quadros[this.iFim]
    this.telas = this.ks.map((k, i) => {
      const base = { x: TV.longe.x + i * 5000, y: TV.longe.y }
      const campo = this.campos[k]
      const vw = duas ? LARGURA / 2 : LARGURA
      // viewport em pixels reais da tela (o canvas tem LARGURAxALTURA x RES.escala); o zoom também leva a escala (ver posicionar)
      const e = RES.escala
      const cam = cena.cameras.add(Math.round((duas ? i * vw : 0) * e), 0, Math.round(vw * e), Math.round(ALTURA * e)).setBackgroundColor(0x07070c).setVisible(false)
      this.cameras.push(cam)
      // as fotos: a aberta (duas camadas: o quadro e o próximo por cima, misturando na câmera lenta) e a do close
      const foto = () => this.novo(cena.add.image(base.x + campo.esquerda, base.y + campo.topo, '__DEFAULT').setOrigin(0).setScale(1 / GRAVACAO.escala).setVisible(false))
      const close = () => this.novo(cena.add.image(0, 0, '__DEFAULT').setOrigin(0).setScale(1 / GRAVACAO.close.escala).setVisible(false))
      const tela = {
        k,
        base,
        cam,
        campo,
        vw,
        abertaA: foto(),
        abertaB: foto(),
        closeA: close(),
        closeB: close(),
        borda: this.novo(cena.add.graphics()),
        circulo: this.novo(cena.add.graphics()),
        coracao: this.novo(cena.add.image(0, 0, 'coracao').setVisible(false)),
        outros: [], // os outros corações da mesma foto (duelo: quem ficou de pé), criados quando aparecem
        ultimaBorda: null,
        temClose: Boolean(ultimo?.pistas[k]?.close),
        morto: this.mortos.find((m) => m.k === k),
      }
      // zoom da câmera aberta: a maior caixa do trecho cabe com folga
      let w = 120
      let h = 100
      for (let q = this.iPlay; q <= this.iFim; q++) {
        const p = this.quadros[q]?.pistas[k]
        if (p) {
          w = Math.max(w, p.caixa.largura)
          h = Math.max(h, p.caixa.altura)
        }
      }
      tela.zoomAberto = Phaser.Math.Clamp(Math.min((vw - (duas ? 30 : 200)) / w, 290 / h), 0.9, 2.2)
      tela.zoomClose = duas ? [3.1, 3.4] : [3.8, 4.35]
      tela.centro = null
      return tela
    })
  }

  montarArtes() {
    const cena = this.cena
    const A = this.artes
    const P = 1000 // profundidade das artes (só a câmera de cima vê esta região)
    // a câmera das artes: por cima de tudo (a última adicionada desenha por último)
    this.camArtes = ajustarCamera(cena.cameras.add()).setScroll(A.x, A.y)
    this.cameras.push(this.camArtes)
    const raiz = this.novo(cena.add.container(A.x, A.y).setDepth(P))
    this.raiz = raiz
    const add = (o) => (raiz.add(o), o)
    const texto = (x, y, t, tamanho, cor = '#ffffff', extra = {}) =>
      add(cena.add.text(x, y, t, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, ...extra }).setOrigin(0.5))

    // clima de TV: scanlines bem leves e a vinheta (só depois da troca)
    this.linhas = add(cena.add.tileSprite(0, 0, LARGURA, ALTURA, 'tv-linhas').setOrigin(0).setAlpha(0))
    this.vinheta = add(cena.add.image(LARGURA / 2, ALTURA / 2, 'vinheta').setTint(0x000000).setDisplaySize(LARGURA * 1.15, ALTURA * 1.2).setAlpha(0))
    // divisória do empate
    if (this.telas.length > 1) this.divisoria = add(cena.add.rectangle(LARGURA / 2, ALTURA / 2, 6, ALTURA, this.cor).setAlpha(0))
    // barras de cinema
    this.barras = [add(cena.add.rectangle(0, -44, LARGURA, 44, 0x000000).setOrigin(0)), add(cena.add.rectangle(0, ALTURA, LARGURA, 44, 0x000000).setOrigin(0))]

    // selo do canal (cima, esquerda): o nome da arena
    const selo = add(cena.add.container(18, 22).setAlpha(0))
    const gs = cena.add.graphics()
    gs.fillStyle(TV.corBarra, 0.85).fillRoundedRect(0, -13, 136, 26, 4)
    gs.fillStyle(this.cor, 1).fillRoundedRect(0, -13, 30, 26, { tl: 4, bl: 4, tr: 0, br: 0 })
    const coracaoSelo = cena.add.image(15, 0, 'coracao').setScale(0.9).setTint(0xffffff)
    const nomeArena = cena.add.text(38, 0, this.arena?.nome ?? 'ARENA', { fontFamily: FONTE, fontSize: '13px', color: '#ffffff' }).setOrigin(0, 0.5)
    selo.add([gs, coracaoSelo, nomeArena])
    this.selo = selo

    // canto de cima, direita: "● AO VIVO" (antes da troca) / "REPLAY"
    const canto = add(cena.add.container(LARGURA - 18, 22))
    this.cantoFundo = cena.add.graphics()
    this.cantoPonto = cena.add.circle(-104, 0, 5, TV.vermelho)
    this.cantoTexto = cena.add.text(-94, 0, 'AO VIVO', { fontFamily: FONTE, fontSize: '14px', color: '#ffffff' }).setOrigin(0, 0.5)
    this.cantoSeta = cena.add.graphics({ x: -103, y: 0 }).setVisible(false)
    canto.add([this.cantoFundo, this.cantoPonto, this.cantoTexto, this.cantoSeta])
    this.canto = canto
    this.desenharCanto(false)

    // rótulo da câmera (CÂM 1 / CÂM 2 · SUPER LENTA)
    this.rotuloCam = add(cena.add.text(18, 46, '', { fontFamily: FONTE, fontSize: '11px', color: '#ffffff' }).setOrigin(0, 0.5).setAlpha(0))
    this.rotuloCam.setShadow(1, 1, '#000000', 0, false, true)

    // placar (baixo): P1 · NOME  HP   x   HP  NOME · P2
    const placar = add(cena.add.container(LARGURA / 2, ALTURA - 26).setAlpha(0))
    const gp = cena.add.graphics()
    gp.fillStyle(TV.corBarra, 0.92).fillRect(-214, -15, 428, 30)
    gp.fillStyle(this.cor, 1).fillRect(-20, -15, 40, 30)
    placar.add(gp)
    placar.add(cena.add.text(0, 0, 'X', { fontFamily: FONTE, fontSize: '14px', color: '#ffffff' }).setOrigin(0.5))
    this.hps = this.jogadores.map((jog, j) => {
      const lado = j ? 1 : -1
      gp.fillStyle(jog.cor, 1).fillRect(lado > 0 ? 208 : -214, -15, 6, 30)
      placar.add(cena.add.text(lado * 196, 0, jog.rotulo, { fontFamily: FONTE, fontSize: '13px', color: hex(jog.cor) }).setOrigin(lado > 0 ? 1 : 0, 0.5))
      placar.add(cena.add.text(lado * 150, 0, jog.nome.toUpperCase(), { fontFamily: FONTE, fontSize: '14px', color: '#ffffff' }).setOrigin(lado > 0 ? 1 : 0, 0.5))
      const hp = cena.add.text(lado * 34, 0, String(jog.hp), { fontFamily: FONTE, fontSize: '16px', color: hex(TV.ouro) }).setOrigin(lado > 0 ? 0 : 1, 0.5)
      placar.add(hp)
      return hp
    })
    this.placar = placar

    // tarja de baixo (lower third): "LANCE DECISIVO" e depois o K.O.
    const tarjaBaixo = add(cena.add.container(-420, ALTURA - 74))
    this.tarjaFundo = cena.add.graphics()
    this.tarjaTexto = cena.add.text(30, 0, '', { fontFamily: FONTE, fontSize: '18px', color: '#ffffff', fontStyle: 'italic' }).setOrigin(0, 0.5)
    tarjaBaixo.add([this.tarjaFundo, this.tarjaTexto])
    this.tarjaBaixo = tarjaBaixo

    // o "K.O.!" que bate no golpe
    this.ko = texto(LARGURA / 2, 132, this.telas.length > 1 ? 'K.O. DUPLO!' : 'K.O.!', this.telas.length > 1 ? 46 : 72, hex(TV.vermelho), { stroke: '#ffffff', strokeThickness: 8, fontStyle: 'italic' })
      .setVisible(false)
      .setRotation(-0.08)

    // camada dos flashes (por cima de tudo) e o clarão
    this.camadaFlash = add(cena.add.container(0, 0))
    this.clarao = add(cena.add.rectangle(0, 0, LARGURA, ALTURA, 0xffffff).setOrigin(0).setAlpha(0))

    // a tarja diagonal do INSTANT REPLAY (entrada e saída)
    this.tarja = add(cena.add.container(0, 0).setVisible(false))
    const gt = cena.add.graphics()
    const faixa = (dx, largura, cor, alpha = 1) => {
      const cx = LARGURA / 2 + dx
      const inc = 110 // inclinação: o topo vai mais para a direita que a base
      gt.fillStyle(cor, alpha)
      gt.fillPoints(
        [
          { x: cx - largura / 2 + inc, y: -10 },
          { x: cx + largura / 2 + inc, y: -10 },
          { x: cx + largura / 2 - inc, y: ALTURA + 10 },
          { x: cx - largura / 2 - inc, y: ALTURA + 10 },
        ],
        true,
      )
    }
    // a tarja é larga o bastante para cobrir a tela inteira mesmo inclinada; as listras de acompanhamento
    // ficam nas pontas (proporcionais à largura da tela)
    const esc = LARGURA / LARGURA_BASE
    faixa(-600 * esc, 70, 0xffffff, 0.9)
    faixa(-520 * esc, 40, TV.ouro)
    faixa(0, 960 * esc, this.cor)
    faixa(0, 960 * esc, 0x000000, 0.18) // o tom escuro da faixa: o selo salta
    faixa(-300 * esc, 18, 0xffffff, 0.35)
    faixa(300 * esc, 18, 0xffffff, 0.35)
    faixa(540 * esc, 50, TV.corBarra)
    faixa(610 * esc, 26, TV.ouro)
    this.tarja.add(gt)
    // o selo: círculo com o coração e "INSTANT REPLAY"
    const logo = add(cena.add.container(LARGURA / 2, ALTURA / 2).setVisible(false))
    const gl = cena.add.graphics()
    gl.fillStyle(0xffffff, 1).fillCircle(-118, 0, 50)
    gl.fillStyle(TV.corBarra, 1).fillCircle(-118, 0, 43)
    gl.lineStyle(3, TV.ouro, 1).strokeCircle(-118, 0, 36)
    gl.fillStyle(TV.corBarra, 0.9).fillRect(-74, -38, 260, 76)
    gl.fillStyle(TV.ouro, 1).fillRect(-74, 34, 260, 6)
    const coracaoLogo = cena.add.image(-118, 2, 'coracao').setScale(3).setTint(TV.vermelho)
    const instant = cena.add.text(-60, -18, 'INSTANT', { fontFamily: FONTE, fontSize: '18px', color: hex(TV.ouro), fontStyle: 'italic' }).setOrigin(0, 0.5)
    const replay = cena.add.text(-62, 12, 'REPLAY', { fontFamily: FONTE, fontSize: '40px', color: '#ffffff', fontStyle: 'italic' }).setOrigin(0, 0.5)
    logo.add([gl, coracaoLogo, instant, replay])
    this.logo = logo
    this.logoCoracao = coracaoLogo
  }

  desenharCanto(replay) {
    const g = this.cantoFundo
    g.clear()
    g.fillStyle(TV.corBarra, 0.85).fillRoundedRect(-116, -13, 116, 26, 4)
    g.fillStyle(replay ? this.cor : TV.vermelho, 1).fillRect(-4, -13, 4, 26)
    this.cantoPonto.setVisible(!replay)
    this.cantoSeta.setVisible(replay)
    this.cantoTexto.setText(replay ? 'REPLAY' : 'AO VIVO').setX(replay ? -88 : -94)
    if (replay) {
      // seta circular de "de novo"
      const s = this.cantoSeta
      s.clear()
      s.lineStyle(2.5, 0xffffff, 1)
      s.beginPath()
      s.arc(0, 0, 7, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(250))
      s.strokePath()
      s.fillStyle(0xffffff, 1).fillTriangle(6, -9, 10, -2, 3, -3)
    }
  }

  // ---------- linha do tempo ----------

  mudarFase(fase) {
    this.fase = fase
    this.faseMs = 0
    this.agenda = []
    const cena = this.cena
    if (fase === 'entrada') {
      tocar(cena, 'tvVinheta')
      this.passarTarja(1)
      this.agendar(TV.entradaMs / 2, () => {
        this.trocar(true)
        tocar(cena, 'tvTorcida', { duracao: (this.ateGolpeMs - TV.entradaMs / 2) / 1000 + 0.1 })
      })
      // música: abafada e mais baixa, como o som do estádio por cima
      this.musica.mexida = true
      this.musica.abaixada = true
      fitaMusica({ corte: 900 }, 400)
      abaixarMusica(0.45)
    } else if (fase === 'play') {
      this.rotuloCam.setText('● CÂM 1').setAlpha(1)
    } else if (fase === 'lento') {
      tocar(cena, 'batidaLenta')
      this.rotuloCam.setText('● CÂM 1 · CÂMERA LENTA')
      this.barrasCinema(true)
      this.mostrarTarjaBaixo('LANCE DECISIVO', this.cor)
      cena.tweens.add({ targets: this.vinheta, alpha: 0.7, duration: 700 })
      this.flashes(1, 200)
    } else if (fase === 'close') {
      tocar(cena, 'tvCorte')
      tocar(cena, 'batidaLenta')
      this.rotuloCam.setText('● CÂM 2 · SUPER LENTA')
      this.claraoRapido(0.55, 160)
      velocidadeMusica(this.andamento * 0.6)
      fitaMusica({ corte: 420 }, 500)
      // batidas e flashes até o golpe
      const total = ((this.iFim - this.iClose) * GRAVACAO.quadroMs) / TV.close.fator
      for (let t = 650; t < total - 250; t += 650) this.agendar(t, () => tocar(cena, 'batidaLenta'))
      for (let t = 300; t < total - 150; t += Phaser.Math.Between(260, 520)) this.agendar(t, () => this.flashes(1, 0))
    } else if (fase === 'golpe') {
      this.pos = this.iFim
      this.golpe()
    } else if (fase === 'saida') {
      tocar(cena, 'tvCorte')
      this.passarTarja(-1)
      this.agendar(TV.saidaMs / 2, () => this.trocar(false))
    }
  }

  agendar(ms, fn) {
    this.agenda.push({ ms, fn })
  }

  atualizar(dt) {
    if (this.acabou) return
    this.tempo += dt
    this.faseMs += dt
    const fase = this.fase
    // o que estava marcado para este momento da fase
    for (const item of this.agenda.filter((a) => a.ms <= this.faseMs)) {
      this.agenda.splice(this.agenda.indexOf(item), 1)
      item.fn()
      if (this.acabou || this.fase !== fase) return
    }
    const passo = dt / GRAVACAO.quadroMs
    switch (fase) {
      case 'entrada':
        if (this.faseMs >= TV.entradaMs) this.mudarFase('play')
        break
      case 'play':
        this.pos += passo
        if (this.pos >= this.iLento) this.mudarFase('lento')
        break
      case 'lento':
        this.pos += passo * TV.lento.fator
        if (this.pos >= this.iClose) this.mudarFase('close')
        break
      case 'close':
        this.pos += passo * TV.close.fator
        if (this.pos >= this.iFim) this.mudarFase('golpe')
        break
      case 'golpe':
        if (this.faseMs >= TV.golpeMs) this.mudarFase('saida')
        break
      case 'saida':
        if (this.faseMs >= TV.saidaMs) return this.encerrar()
        break
    }
    if (this.acabou) return
    this.desenhar()
  }

  // a tarja diagonal varrendo a tela (dir 1: da esquerda para a direita), com o selo no meio
  passarTarja(dir) {
    const cena = this.cena
    const dur = dir > 0 ? TV.entradaMs : TV.saidaMs
    // entra rápido, segura a tela coberta (a troca acontece aí) e sai rápido
    this.tarja.setVisible(true).setX(-dir * 1500)
    cena.tweens.chain({
      targets: this.tarja,
      tweens: [
        { x: -dir * 40, duration: dur * 0.38, ease: 'Cubic.easeOut' },
        { x: dir * 40, duration: dur * 0.24 },
        { x: dir * 1500, duration: dur * 0.38, ease: 'Cubic.easeIn' },
      ],
    })
    const logo = this.logo
    logo.setVisible(true).setScale(0.2).setAngle(-dir * 90).setAlpha(0)
    cena.tweens.add({ targets: logo, scale: 1, angle: 0, alpha: 1, duration: dur * 0.32, delay: dur * 0.12, ease: 'Back.easeOut' })
    cena.tweens.add({ targets: this.logoCoracao, scale: 3.6, duration: 120, delay: dur * 0.44, yoyo: true })
    cena.tweens.add({ targets: logo, scale: 1.6, alpha: 0, duration: dur * 0.22, delay: dur * 0.68, ease: 'Quad.easeIn' })
  }

  // meio da tarja: a arena vira replay (true) ou volta (false)
  trocar(paraReplay) {
    const cena = this.cena
    if (paraReplay) {
      this.trocou = true
      // as câmeras da arena (principal e das caixas) somem; as do replay aparecem
      this.camerasEscondidas = cena.cameras.cameras.filter((c) => c.visible && !this.cameras.includes(c))
      this.camerasEscondidas.forEach((c) => c.setVisible(false))
      this.telas.forEach((t) => t.cam.setVisible(true))
      this.desenharCanto(true)
      this.linhas.setAlpha(0.14)
      this.vinheta.setAlpha(0.35)
      this.divisoria?.setAlpha(1)
      this.selo.setAlpha(1)
      this.placar.setAlpha(1)
      this.desenhar()
    } else {
      this.trocou = false
      this.mostrarArena()
      this.telas.forEach((t) => t.cam.setVisible(false))
      this.desenharCanto(false)
      for (const o of [this.linhas, this.vinheta, this.divisoria, this.selo, this.placar, this.rotuloCam, this.tarjaBaixo, this.ko, this.camadaFlash, ...this.barras]) o?.setVisible(false)
      this.quebras.forEach((q) => q.destruir())
      this.quebras = []
      this.confete?.destroy()
      this.confete = null
    }
  }

  mostrarArena() {
    this.camerasEscondidas?.forEach((c) => c.scene && c.setVisible(true))
    this.camerasEscondidas = null
  }

  barrasCinema(entrar) {
    const [cima, baixo] = this.barras
    this.cena.tweens.add({ targets: cima, y: entrar ? 0 : -44, duration: 380, ease: 'Quad.easeOut' })
    this.cena.tweens.add({ targets: baixo, y: entrar ? ALTURA - 44 : ALTURA, duration: 380, ease: 'Quad.easeOut' })
  }

  mostrarTarjaBaixo(texto, cor) {
    const g = this.tarjaFundo
    this.tarjaTexto.setText(texto)
    const w = this.tarjaTexto.width + 60
    g.clear()
    g.fillStyle(TV.corBarra, 0.92).fillPoints(
      [
        { x: 0, y: -17 },
        { x: w, y: -17 },
        { x: w - 12, y: 17 },
        { x: 0, y: 17 },
      ],
      true,
    )
    g.fillStyle(cor, 1).fillRect(0, -17, 16, 34)
    g.fillStyle(TV.ouro, 1).fillRect(16, 14, w - 31, 3)
    this.cena.tweens.killTweensOf(this.tarjaBaixo)
    this.tarjaBaixo.setX(-w - 20)
    this.cena.tweens.add({ targets: this.tarjaBaixo, x: 0, duration: 320, ease: 'Cubic.easeOut' })
  }

  claraoRapido(alpha, ms) {
    this.cena.tweens.killTweensOf(this.clarao)
    this.clarao.setAlpha(alpha * fatores().clarao) // preferência de clarões (acessibilidade.js)
    this.cena.tweens.add({ targets: this.clarao, alpha: 0, duration: ms, ease: 'Quad.easeOut' })
  }

  // flashes de câmeras fotográficas (mais na parte de baixo: os fotógrafos na beira do campo)
  flashes(n, espalharMs = 500, som = true) {
    const cena = this.cena
    if (som) tocar(cena, 'tvFlash', { n: Math.min(5, n) })
    // sem clarões: só o som; com "reduzir animações": metade, bem mais fracos
    const { clarao } = fatores()
    if (clarao <= 0) return
    if (clarao < 1) n = Math.max(1, quantas(n, 0.5))
    const pico = Math.min(1, clarao * 1.6)
    for (let i = 0; i < n; i++) {
      const atraso = i ? Math.random() * espalharMs : 0
      const x = Phaser.Math.Between(20, LARGURA - 20)
      const y = Math.random() < 0.65 ? Phaser.Math.Between(ALTURA * 0.55, ALTURA - 40) : Phaser.Math.Between(50, ALTURA * 0.55)
      const f = cena.add.image(x, y, 'tv-flash').setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAlpha(0).setAngle(Phaser.Math.Between(0, 45))
      this.camadaFlash.add(f)
      cena.tweens.add({
        targets: f,
        delay: atraso,
        alpha: { from: pico, to: 0 },
        scale: { from: Phaser.Math.FloatBetween(0.5, 1.1), to: 1.4 },
        duration: Phaser.Math.Between(160, 260),
        ease: 'Quad.easeOut',
        onComplete: () => f.destroy(),
      })
    }
  }

  // ---------- o golpe ----------

  golpe() {
    const cena = this.cena
    // a música corta: só o "OHHH!" e o acorde
    this.musica.cortada = true
    cortarMusica(true)
    tocar(cena, 'tvImpacto')
    tocar(cena, 'tvOhhh')
    this.claraoRapido(0.95, 380)
    this.flashes(6, 700)
    this.rotuloCam.setText('● CÂM 2')
    this.ko.setVisible(true).setScale(3.2).setAlpha(0)
    cena.tweens.add({ targets: this.ko, scale: 1, alpha: 1, duration: 230, ease: 'Back.easeOut' })
    const perdedores = this.mortos.map((m) => this.jogadores[m.j]?.rotulo).filter(Boolean)
    this.mostrarTarjaBaixo(perdedores.length > 1 ? 'EMPATE · OS DOIS CAÍRAM!' : `${perdedores[0] ?? ''} CAIU!`, TV.vermelho)
    for (const m of this.mortos) {
      const hp = this.hps[m.j]
      hp?.setText('0').setColor(hex(TV.vermelho))
      if (hp && fatores().piscar) cena.tweens.add({ targets: hp, alpha: 0.25, duration: 160, yoyo: true, repeat: 7 })
    }
    // o coração despedaça por cima da foto do golpe
    for (const t of this.telas) {
      t.circulo.clear()
      const c = this.quadros[this.iFim]?.pistas[t.k]?.coracao
      if (!c || !t.morto) continue
      t.coracao.setVisible(false)
      t.golpe = { zoom: t.cam.zoom }
      this.quebras.push(
        quebrarCoracao(cena, {
          x: t.base.x + c.x,
          y: t.base.y + c.y,
          cor: c.cor ?? 0xff2030,
          escala: c.escala || ESCALA.coracao,
          profundidade: 10,
          vagar: TV.vagar,
          tremer: () => tremerCamera(t.cam, 260, 0.012),
        }),
      )
      tremerCamera(t.cam, 200, 0.01)
    }
    // estilhaçou: a torcida explode e a música volta com tudo
    this.agendar(TV.estilhacaMs, () => {
      tocar(cena, 'tvExplosao', { duracao: 5.5 })
      this.voltarMusica(180)
      this.claraoRapido(0.4, 260)
      this.flashes(10, 1100)
      this.soltarConfete()
    })
    this.agendar(TV.estilhacaMs + 450, () => tocar(cena, 'tvApito'))
    this.agendar(TV.estilhacaMs + 1100, () => this.flashes(5, 900, true))
  }

  soltarConfete() {
    const cena = this.cena
    const A = this.artes
    const cores = [this.cor, TV.ouro, 0xffffff, ...this.jogadores.map((j) => j.cor)]
    this.confete = cena.add.particles(A.x, A.y - 10, 'tv-confete', {
      x: { min: 0, max: LARGURA },
      speedY: { min: 60, max: 160 },
      speedX: { min: -40, max: 40 },
      gravityY: 60,
      rotate: { min: 0, max: 360 },
      scale: { min: 0.8, max: 1.5 },
      lifespan: 4000,
      tint: cores,
      quantity: 3,
      frequency: 40,
      duration: 900,
    })
    this.confete.setDepth(1001) // acima das artes (raiz 1000), na região da câmera de cima
    this.confete.festa = true // comemoração: corta mais nos gráficos menores (graficos.js)
    this.objetos.push(this.confete)
  }

  voltarMusica(ms) {
    if (this.musica.cortada) cortarMusica(false)
    this.musica.cortada = false
    if (this.musica.mexida) {
      fitaMusica(undefined, ms)
      velocidadeMusica(this.andamento)
    }
    this.musica.mexida = false
    if (this.musica.abaixada) restaurarMusica()
    this.musica.abaixada = false
  }

  // ---------- desenho ----------

  desenhar() {
    if (!this.trocou) return
    const n = this.quadros.length
    const i = Phaser.Math.Clamp(Math.floor(this.pos), 0, n - 1)
    const j = Math.min(i + 1, n - 1)
    const frac = this.fase === 'golpe' ? 0 : Phaser.Math.Clamp(this.pos - i, 0, 1)
    const modoClose = this.fase === 'close' || this.fase === 'golpe'
    for (const t of this.telas) this.desenharTela(t, this.quadros[i]?.pistas[t.k] ?? null, this.quadros[j]?.pistas[t.k] ?? null, frac, modoClose)
    // a seta do canto gira; o ponto do "AO VIVO" pisca
    this.cantoSeta.setAngle((this.tempo * 0.25) % 360)
  }

  desenharTela(t, q0, q1, frac, modoClose) {
    const { base, cam } = t
    const usarClose = modoClose && t.temClose && q0?.close
    // fotos: a do quadro e a do próximo por cima (alpha = fração): a câmera lenta fica lisa
    const camada = (img, q, chave, alpha) => {
      if (!q || !chave) return img.setVisible(false)
      img.setTexture(chave).setVisible(true).setAlpha(alpha)
    }
    camada(t.abertaA, q0, q0?.chave, 1)
    camada(t.abertaB, q1, q1 && q1 !== q0 && frac > 0.02 ? q1.chave : null, frac)
    if (usarClose) {
      camada(t.closeA, q0, q0.close.chave, 1)
      t.closeA.setPosition(base.x + q0.close.x, base.y + q0.close.y)
      const c1 = q1?.close && frac > 0.02 ? q1.close : null
      camada(t.closeB, q1, c1?.chave, frac)
      if (c1) t.closeB.setPosition(base.x + c1.x, base.y + c1.y)
    } else {
      t.closeA.setVisible(false)
      t.closeB.setVisible(false)
    }
    // moldura da caixa daquele quadro (com a cor da borda dele: pisca vermelho no acerto)
    if (q0 && t.ultimaBorda !== q0) {
      t.ultimaBorda = q0
      t.borda.clear()
      t.borda.lineStyle(3, q0.borda ?? 0xffffff, 1)
      t.borda.strokeRect(base.x + q0.caixa.x, base.y + q0.caixa.y, q0.caixa.largura, q0.caixa.altura)
    }
    // o coração de verdade, na posição interpolada
    const c0 = q0?.coracao
    const c1 = q1?.coracao ?? c0
    let hx = null
    let hy = null
    if (c0) {
      hx = base.x + Phaser.Math.Linear(c0.x, c1.x, frac)
      hy = base.y + Phaser.Math.Linear(c0.y, c1.y, frac)
      if (this.fase !== 'golpe' || !t.morto) {
        t.coracao
          .setPosition(hx, hy)
          .setTint(c0.cor ?? 0xff2030)
          .setScale(c0.escala || ESCALA.coracao)
          .setAlpha(c0.alpha ?? 1)
          .setVisible(Boolean(c0.ativo && c0.visivel))
      }
    } else t.coracao.setVisible(false)
    this.desenharOutros(t, q0?.outros ?? [], q1?.outros ?? q0?.outros ?? [], frac)

    // ---- o cinegrafista: zoom e enquadramento ----
    const caixa = q0?.caixa
    const centroCaixa = caixa ? { x: base.x + caixa.x + caixa.largura / 2, y: base.y + caixa.y + caixa.altura / 2 } : t.centro
    const foco = t.morto && hx !== null ? { x: hx, y: hy } : centroCaixa
    let zoom = t.zoomAberto
    let alvo = centroCaixa
    if (this.fase === 'lento') {
      const u = suave((this.pos - this.iLento) / Math.max(1, this.iClose - this.iLento))
      zoom = t.zoomAberto * (1 + 0.8 * u)
      if (foco && centroCaixa) alvo = { x: Phaser.Math.Linear(centroCaixa.x, foco.x, u), y: Phaser.Math.Linear(centroCaixa.y, foco.y, u) }
    } else if (modoClose) {
      const [z0, z1] = usarClose ? t.zoomClose : [t.zoomAberto * 1.8, t.zoomAberto * 2.1]
      if (this.fase === 'close') {
        const u = suave((this.pos - this.iClose) / Math.max(1, this.iFim - this.iClose))
        zoom = Phaser.Math.Linear(z0, z1, u)
        // câmera na mão: balança de leve (nada com "reduzir animações")
        const mao = fatores().zoom
        alvo = foco && { x: foco.x + Math.sin(this.tempo * 0.0021) * 2.5 * mao, y: foco.y + Math.cos(this.tempo * 0.0017) * 2 * mao }
        this.desenharCirculo(t, hx, hy, u)
      } else {
        // golpe: tranco no zoom e depois abre devagar para ver os cacos caindo
        const ms = this.faseMs
        const tranco = ms < 90 ? ms / 90 : Math.max(0, 1 - (ms - 90) / 260)
        const abre = suave((ms - 500) / 1900)
        zoom = Phaser.Math.Linear(z1, z1 * 0.72, abre) * (1 + 0.14 * tranco * fatores().zoom)
        alvo = foco
      }
    }
    // "reduzir animações": o zoom só anda uma parte do caminho (sem fechar tanto no close)
    const suavizar = fatores().zoom
    if (suavizar < 1) zoom = t.zoomAberto + (zoom - t.zoomAberto) * Math.max(0.45, suavizar)
    if (alvo) t.centro = alvo
    if (t.centro) {
      cam.setZoom(zoom * RES.escala)
      cam.centerOn(t.centro.x, t.centro.y)
    }
  }

  // Os outros corações da foto (duelo), na posição interpolada. No golpe, o
  // que também caiu (K.O. duplo) some: ele se despedaça na tela dele
  desenharOutros(t, lista0, lista1, frac) {
    lista0.forEach((c0, n) => {
      const c1 = lista1[n] ?? c0
      const img = (t.outros[n] ??= this.novo(this.cena.add.image(0, 0, 'coracao')))
      const caiu = this.fase === 'golpe' && this.mortos.some((m) => m.j === c0.j)
      img
        .setPosition(t.base.x + Phaser.Math.Linear(c0.x, c1.x, frac), t.base.y + Phaser.Math.Linear(c0.y, c1.y, frac))
        .setTint(c0.cor ?? 0xff2030)
        .setScale(c0.escala || ESCALA.coracao)
        .setAlpha(c0.alpha ?? 1)
        .setVisible(Boolean(c0.ativo && c0.visivel) && !caiu)
    })
    for (let n = lista0.length; n < t.outros.length; n++) t.outros[n].setVisible(false)
  }

  // o círculo do comentarista sendo desenhado em volta do coração (u: 0..1 do close)
  desenharCirculo(t, x, y, u) {
    const g = t.circulo
    g.clear()
    const p = Phaser.Math.Clamp((u - 0.45) / 0.4, 0, 1)
    if (!p || x === null || !t.morto) return
    const inicio = Phaser.Math.DegToRad(-120)
    g.lineStyle(2.2, TV.ouro, 0.95)
    g.beginPath()
    g.arc(x, y, 19, inicio, inicio + Math.PI * 2.15 * p)
    g.strokePath()
  }

  // ---------- fim ----------

  // Fim (ou pulo): desfaz câmeras, objetos e música; resolve tocar()
  encerrar() {
    if (this.acabou) return
    this.acabou = true
    const pulou = this.fase !== 'saida'
    if (pulou) calarTransmissao(250) // pulou: a torcida some junto
    this.voltarMusica(250)
    this.mostrarArena()
    const cena = this.cena
    this.quebras.forEach((q) => q.destruir())
    this.quebras = []
    for (const o of this.objetos) {
      cena.tweens?.killTweensOf(o)
      if (o.list) o.list.forEach((filho) => cena.tweens?.killTweensOf(filho))
    }
    this.objetos.forEach((o) => o.scene && o.destroy())
    this.objetos = []
    for (const cam of this.cameras) cena.cameras?.remove(cam)
    this.cameras = []
    this.resolver()
  }
}
