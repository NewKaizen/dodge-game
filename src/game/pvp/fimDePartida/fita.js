import Phaser from 'phaser'
import { LARGURA, ALTURA, FONTE } from '../../constants.js'
import { tocar, cortarMusica, velocidadeMusica, fitaMusica } from '../../audio.js'
import { caixasDe } from '../../recorte.js'
import { GRAVACAO } from './gravador.js'

// O REPLAY do golpe final, como uma fita VHS passando numa TV velha.
// Toca as fotos do Gravador (nada é re-simulado) por cima da tela toda:
//   estática -> "◀◀ REW" (a fita volta rápido, de trás para frente, toda
//   tremida) -> "▶ PLAY" (os últimos segundos no ritmo normal) -> "▶ SLOW"
//   (o fim em câmera lenta, até o golpe) -> "❚❚ PAUSE" no quadro do golpe,
//   com o K.O. marcado no coração -> estática e acabou.
//
// Filtro de fita no jogo: cada foto é cortada em faixas horizontais que
// tremem e escorregam (tracking; muito mais no REW), desenhada três vezes
// (vermelho, verde, azul somando) com os canais desalinhados (aberração
// cromática), chiado de ruído, scanlines, a faixa de tracking rolando,
// vinheta e a curvatura da TV (filtro Barrel da câmera principal), e o OSD
// do videocassete (modo, contador da fita, data). Na música (audio.js,
// fitaMusica): passa-baixa, wow/flutter e chiado; mudo no REW e no PAUSE,
// mais lenta no SLOW. encerrar() desfaz TUDO (música, filtros, câmeras).
//
//   const fita = new Fita(cena, { quadros, pistas: [k...], campos, titulo, andamento })
//   await fita.tocar()      resolve no fim (ou quando encerrar() for chamado)
//   fita.atualizar(dtReal)  todo frame
//   fita.encerrar()         pula / sai da cena
export const FITA = {
  profundidade: 300, // acima de tudo da arena (banner 96, anúncios ~99)
  estaticaMs: 200,
  rebobinarMs: 650,
  pausaMs: 850,
  pararMs: 280,
  lento: { quadros: 14, fator: 0.34 }, // os últimos quadros (~0,45 s) em câmera lenta
}
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const CANAIS = [0xff0000, 0x00ff00, 0x0000ff]
const COR_OSD = '#f4f4f4'

// texturas do filtro (uma vez por jogo): ruído e scanlines
function prepararTexturas(cena) {
  const tex = cena.textures
  if (tex.exists('fim-ruido')) return
  const n = 128
  const c = document.createElement('canvas')
  c.width = n
  c.height = n
  const g = c.getContext('2d')
  const img = g.createImageData(n, n)
  for (let i = 0; i < n * n; i++) {
    const v = Math.random() * 255
    img.data.set([v, v, v, 255], i * 4)
  }
  g.putImageData(img, 0, 0)
  tex.addCanvas('fim-ruido', c)
  const l = document.createElement('canvas')
  l.width = 2
  l.height = 3
  const gl = l.getContext('2d')
  gl.fillStyle = 'rgba(0,0,0,0.55)'
  gl.fillRect(0, 2, 2, 1)
  tex.addCanvas('fim-linhas', l)
}

export default class Fita {
  constructor(cena, { quadros, pistas, campos, titulo = 'REPLAY', andamento = 1 }) {
    this.cena = cena
    this.quadros = quadros
    this.ks = pistas
    this.campos = campos
    this.titulo = titulo
    this.andamento = andamento
    this.objetos = []
    this.fase = null
    this.faseMs = 0
    this.tempo = 0 // ms reais desde o começo
    this.pos = quadros.length - 1 // quadro atual (fracionário)
    this.cortada = false
    this.acabou = false
    this.fim = new Promise((r) => (this.resolver = r))
    prepararTexturas(cena)
    this.montar()
    this.mudarFase('estatica')
  }

  tocar() {
    return this.fim
  }

  novo(o) {
    this.objetos.push(o)
    return o
  }

  // ---------- montagem ----------

  montar() {
    const cena = this.cena
    const P = FITA.profundidade
    // a TV tapa a arena toda; as câmeras das caixas (que desenham por cima da principal) somem
    this.camerasEscondidas = caixasDe(cena)
      .map((c) => c.camera)
      .filter((cam) => cam.visible)
    this.camerasEscondidas.forEach((cam) => cam.setVisible(false))
    this.novo(cena.add.rectangle(0, 0, LARGURA, ALTURA, 0x050507).setOrigin(0).setDepth(P))

    // uma pista: grande no meio; duas (empate): lado a lado
    const D = this.ks.length > 1 ? 1 : 1.5
    const S = D / GRAVACAO.escala
    const campo0 = this.campos[0]
    const cw = (campo0.direita - campo0.esquerda) * D
    const ch = (campo0.base - campo0.topo) * D
    const centros = this.ks.length > 1 ? [LARGURA / 4 + 4, (LARGURA * 3) / 4 - 4] : [LARGURA / 2]
    const altura0 = this.quadros.find((q) => q.pistas[this.ks[0]])
    const H = altura0 ? cena.textures.get(altura0.pistas[this.ks[0]].chave).get('__BASE').height : 156
    const hFaixa = H / GRAVACAO.faixas
    this.telas = this.ks.map((k, i) => {
      const ox = centros[i] - cw / 2
      const oy = 250 - ch / 2
      const caixa = this.novo(cena.add.container(ox, oy).setDepth(P + 1))
      const faixas = []
      for (let f = 0; f < GRAVACAO.faixas; f++) {
        const y = Math.round(f * hFaixa) * S
        const canais = CANAIS.map((cor) => cena.add.image(0, y, '__DEFAULT').setOrigin(0).setScale(S).setTint(cor).setBlendMode(Phaser.BlendModes.ADD))
        caixa.add(canais)
        faixas.push({ canais, y, indice: f, centro: (f + 0.5) / GRAVACAO.faixas })
      }
      const borda = cena.add.graphics()
      const marca = cena.add.graphics()
      const ko = cena.add
        .text(0, 0, 'K.O.!', { fontFamily: FONTE, fontSize: `${Math.round(22 * D)}px`, color: '#ff4058', stroke: '#000000', strokeThickness: 5 })
        .setOrigin(0.5)
        .setVisible(false)
      caixa.add([borda, marca, ko])
      return { k, caixa, faixas, borda, marca, ko, ox, oy, D, S, campo: this.campos[k], ultimo: null }
    })

    // ruído, faixa de tracking, scanlines e vinheta (tela inteira)
    this.ruido = this.novo(cena.add.tileSprite(0, 0, LARGURA, ALTURA, 'fim-ruido').setOrigin(0).setDepth(P + 2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.1))
    this.faixa = this.novo(cena.add.tileSprite(0, 0, LARGURA, 12, 'fim-ruido').setOrigin(0, 0.5).setDepth(P + 2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3))
    this.novo(cena.add.tileSprite(0, 0, LARGURA, ALTURA, 'fim-linhas').setOrigin(0).setDepth(P + 3))
    this.novo(
      cena.add
        .image(LARGURA / 2, ALTURA / 2, 'vinheta')
        .setTint(0x000000)
        .setDisplaySize(LARGURA * 1.15, ALTURA * 1.2)
        .setDepth(P + 3),
    )

    // OSD do videocassete
    const osd = (x, y, texto, tamanho, origem = 0) =>
      this.novo(
        cena.add
          .text(x, y, texto, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: COR_OSD })
          .setOrigin(origem, 0.5)
          .setDepth(P + 4)
          .setShadow(2, 0, 'rgba(0,200,255,0.55)', 0, false, true),
      )
    this.icone = this.novo(cena.add.graphics().setDepth(P + 4))
    this.modo = osd(58, 26, '', 20)
    this.rotulo = osd(LARGURA - 24, 26, this.titulo, 20, 1)
    this.contador = osd(24, ALTURA - 24, '0:00:00', 18)
    osd(152, ALTURA - 24, 'SP', 14)
    const d = new Date()
    const dois = (v) => String(v).padStart(2, '0')
    osd(LARGURA - 24, ALTURA - 24, `${dois(d.getDate())} ${MESES[d.getMonth()]} ${d.getFullYear()}  ${dois(d.getHours())}:${dois(d.getMinutes())}`, 14, 1)

    // a TV: curvatura e cor de fita (menos saturada) na câmera principal
    const filtros = cena.cameras.main.filters?.internal
    this.filtros = []
    if (filtros) {
      try {
        this.filtros.push(filtros.addBarrel(1.06))
        const cor = filtros.addColorMatrix()
        cor.colorMatrix.saturate(-0.25)
        this.filtros.push(cor)
      } catch (erro) {
        console.warn('[replay] filtros da câmera indisponíveis:', erro)
      }
    }
  }

  // ---------- linha do tempo ----------

  mudarFase(fase) {
    this.fase = fase
    this.faseMs = 0
    const n = this.quadros.length
    if (fase === 'estatica') {
      tocar(this.cena, 'estatica')
      fitaMusica({ corte: 2000, wow: 1.4, chiado: 1 }, 150)
      this.cortar(true)
    } else if (fase === 'rebobinar') {
      tocar(this.cena, 'fitaRebobinar')
      this.pos = n - 1
    } else if (fase === 'play') {
      tocar(this.cena, 'fitaPlay')
      this.pos = 0
      this.cortar(false)
    } else if (fase === 'lento') {
      velocidadeMusica(this.andamento * 0.6)
      fitaMusica({ corte: 1200, wow: 2.4, chiado: 1 }, 300)
      tocar(this.cena, 'batidaLenta')
    } else if (fase === 'pausa') {
      this.pos = n - 1
      tocar(this.cena, 'fitaPlay')
      tocar(this.cena, 'trincar')
      this.cortar(true)
      for (const t of this.telas) this.marcarKo(t)
    } else if (fase === 'parar') {
      tocar(this.cena, 'fitaParar')
      tocar(this.cena, 'estatica')
    }
    this.desenharIcone()
  }

  cortar(cortar) {
    if (this.cortada === cortar) return
    this.cortada = cortar
    cortarMusica(cortar)
  }

  atualizar(dt) {
    if (this.acabou) return
    this.tempo += dt
    this.faseMs += dt
    const n = this.quadros.length
    const passo = dt / GRAVACAO.quadroMs
    switch (this.fase) {
      case 'estatica':
        if (this.faseMs >= FITA.estaticaMs) this.mudarFase('rebobinar')
        break
      case 'rebobinar':
        this.pos = (n - 1) * (1 - Math.min(1, this.faseMs / FITA.rebobinarMs))
        if (this.faseMs >= FITA.rebobinarMs) this.mudarFase('play')
        break
      case 'play':
        this.pos += passo
        if (this.pos >= n - 1 - FITA.lento.quadros) this.mudarFase('lento')
        break
      case 'lento':
        this.pos += passo * FITA.lento.fator
        if (this.pos >= n - 1) this.mudarFase('pausa')
        break
      case 'pausa':
        if (this.faseMs >= FITA.pausaMs) this.mudarFase('parar')
        break
      case 'parar':
        if (this.faseMs >= FITA.pararMs) return this.encerrar()
        break
    }
    this.desenhar()
  }

  // ---------- desenho ----------

  desenhar() {
    const fase = this.fase
    const i = Phaser.Math.Clamp(Math.floor(this.pos), 0, this.quadros.length - 1)
    const quadro = this.quadros[i]
    const tela = fase === 'estatica' || fase === 'parar'
    const rew = fase === 'rebobinar'
    const pausa = fase === 'pausa'
    const t = this.tempo
    // faixa de tracking rolando para baixo (no REW, rápida)
    const banda = (((t * (rew ? 0.0016 : 0.00022)) % 1.3) - 0.15)
    const aberracao = rew ? 3.5 : pausa ? 2.4 : 1.4
    // pausado: a imagem treme para cima e para baixo (cabeça parada na fita)
    const pulo = pausa ? (Math.floor(t / 70) % 2 ? 1.5 : -1) : 0

    for (const tl of this.telas) {
      const q = quadro?.pistas[tl.k] ?? null
      tl.caixa.setVisible(!tela && Boolean(q))
      if (!q) continue
      tl.caixa.y = tl.oy + pulo
      for (const f of tl.faixas) {
        let dx = (Math.random() - 0.5) * 0.9 + Math.sin(f.centro * 13 + t * 0.004) * 0.7
        const perto = Math.abs(f.centro - banda)
        if (perto < 0.09) dx += (0.09 - perto) * 90 * (Math.random() < 0.5 ? -1 : 1)
        if (rew && Math.random() < 0.45) dx += (Math.random() - 0.5) * 26
        if (pausa && perto < 0.12) dx += (Math.random() - 0.5) * 10
        f.canais.forEach((img, c) => {
          img.setTexture(q.chave, `f${f.indice}`)
          img.x = dx + (c - 1) * aberracao
        })
      }
      if (tl.ultimo !== q) {
        tl.ultimo = q
        this.desenharBorda(tl, q)
      }
    }

    // ruído e faixa
    this.ruido.tilePositionX = Math.random() * 128
    this.ruido.tilePositionY = Math.random() * 128
    this.ruido.setAlpha(tela ? 0.85 : rew ? 0.3 : pausa ? 0.16 : 0.09)
    this.faixa.y = banda * ALTURA
    this.faixa.tilePositionX = Math.random() * 128
    this.faixa.setAlpha(rew ? 0.55 : 0.28).setVisible(!tela)

    // contador da fita (tempo de jogo do quadro desde o começo da gravação)
    if (quadro) {
      const ms = Math.max(0, quadro.tempo - this.quadros[0].tempo)
      const dois = (v) => String(v).padStart(2, '0')
      this.contador.setText(`${Math.floor(ms / 60000)}:${dois(Math.floor(ms / 1000) % 60)}:${dois(Math.floor((ms % 1000) / GRAVACAO.quadroMs))}`)
    }
    // o "REPLAY" pisca; o modo pisca na pausa
    this.rotulo.setAlpha(Math.floor(t / 500) % 2 ? 0.55 : 1)
    const piscaModo = pausa && Math.floor(t / 400) % 2
    this.modo.setAlpha(piscaModo ? 0.3 : 1)
    this.icone.setAlpha(piscaModo ? 0.3 : 1)
    if (pausa) for (const tl of this.telas) tl.marca.setAlpha(0.6 + 0.4 * Math.sin(t * 0.012))
  }

  // moldura da caixa daquele quadro (com a cor da borda dele: pisca vermelho no acerto)
  desenharBorda(tl, q) {
    const { D, campo } = tl
    const g = tl.borda
    g.clear()
    g.lineStyle(Math.max(2, 4 * D), q.borda ?? 0xffffff, 1)
    g.strokeRect((q.caixa.x - campo.esquerda) * D, (q.caixa.y - campo.topo) * D, q.caixa.largura * D, q.caixa.altura * D)
  }

  // pausa no golpe: círculo em volta do coração e o "K.O.!"
  marcarKo(tl) {
    const q = this.quadros[this.quadros.length - 1]?.pistas[tl.k]
    if (!q?.coracao) return
    const { D, campo } = tl
    const x = (q.coracao.x - campo.esquerda) * D
    const y = (q.coracao.y - campo.topo) * D
    tl.marca.clear()
    tl.marca.lineStyle(3, 0xff4058, 1)
    tl.marca.strokeCircle(x, y, 18 * D)
    tl.marca.lineStyle(1.5, 0xffffff, 0.8)
    tl.marca.strokeCircle(x, y, 23 * D)
    const acima = y - 34 * D > 14
    tl.ko
      .setPosition(x, acima ? y - 34 * D : y + 34 * D)
      .setVisible(true)
      .setScale(2.2)
    this.cena.tweens.add({ targets: tl.ko, scale: 1, duration: 160, ease: 'Back.easeOut' })
  }

  // ícone do modo (a fonte do jogo não tem ▶ ◀ ❚): triângulos e barras desenhados
  desenharIcone() {
    const g = this.icone
    g.clear()
    if (this.fase === 'estatica' || this.fase === 'parar') {
      this.modo.setText(this.fase === 'parar' ? 'STOP' : '')
      if (this.fase === 'parar') g.fillStyle(0xf4f4f4, 1).fillRect(28, 18, 16, 16)
      return
    }
    g.fillStyle(0xf4f4f4, 1)
    const tri = (x, dir) => g.fillTriangle(x, 18, x, 34, x + dir * 14, 26)
    if (this.fase === 'rebobinar') {
      g.fillTriangle(38, 18, 38, 34, 24, 26)
      g.fillTriangle(52, 18, 52, 34, 38, 26)
      this.modo.setText('REW').setX(60)
    } else if (this.fase === 'pausa') {
      g.fillRect(28, 18, 5, 16)
      g.fillRect(38, 18, 5, 16)
      this.modo.setText('PAUSE').setX(52)
    } else {
      tri(28, 1)
      if (this.fase === 'lento') g.fillRect(44, 18, 3, 16)
      this.modo.setText(this.fase === 'lento' ? 'SLOW' : 'PLAY').setX(this.fase === 'lento' ? 54 : 50)
    }
  }

  // Fim (ou pulo): desfaz música, filtros e câmeras; resolve tocar()
  encerrar() {
    if (this.acabou) return
    this.acabou = true
    this.cortar(false)
    fitaMusica(undefined, 250)
    velocidadeMusica(this.andamento)
    const filtros = this.cena.cameras?.main?.filters?.internal
    if (filtros) for (const f of this.filtros) filtros.remove(f)
    this.filtros = []
    this.camerasEscondidas.forEach((cam) => cam.scene && cam.setVisible(true))
    for (const tl of this.telas) this.cena.tweens?.killTweensOf(tl.ko)
    this.objetos.forEach((o) => o.scene && o.destroy())
    this.objetos = []
    this.resolver()
  }
}
