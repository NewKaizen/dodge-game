import { FONTE } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { particulas } from '../../../effects/particulas.js'

// POP-UPS: o PC da sala pegou vírus de propaganda. Janelinhas ("VOCÊ GANHOU!",
// "BAIXE MAIS RAM"...) abrem sozinhas por cima da caixa e tapam a visão das
// balas. Para fechar uma, é passar o coração em cima do [X] dela (o botão
// pulsa em vermelho). Se ninguém fechar, ela some sozinha depois de VIDA_MS.
// Justo: as janelas ficam por cima das balas mas POR BAIXO do coração (você
// sempre se vê), nunca nascem em cima do coração, têm um limite por caixa e
// o vidro é um tiquinho transparente (dá para adivinhar as balas atrás).
// As janelas acompanham a caixa quando ela muda de tamanho (posição relativa).
// A CPU não lê propaganda: desvia normal (as janelas da caixa dela somem sozinhas).

const PRIMEIRA_MS = { min: 600, max: 1100 } // até a primeira janela de cada caixa
const INTERVALO_MS = { min: 1700, max: 2600 } // entre uma janela e outra
const VIDA_MS = 7000 // a janela fecha sozinha depois disso
const MAXIMO = { inicio: 2, depois: 3, apos: 8000 } // janelas abertas por caixa (sobe com o tempo)
const LONGE_DO_CORACAO = 22 // px entre o coração e a borda de uma janela nova
const TAMANHO = { w: 108, h: 66 } // janela (encolhe se a caixa ficar pequena)
const ALPHA = 0.94
const BOTAO_X = { w: 13, h: 11 }
const FOLGA_X = 3 // px a mais em volta do [X] que ainda contam como "passou em cima"

const ANUNCIOS = [
  { titulo: 'parabens.exe', texto: 'VOCÊ GANHOU!\num PC novo!', icone: 'presente', botao: 'RESGATAR', barra: 0x8a1a6a },
  { titulo: 'otimizador.exe', texto: 'BAIXE MAIS\nRAM AGORA!', icone: 'ram', botao: 'BAIXAR', barra: 0x0a246a },
  { titulo: 'ALERTA!!!', texto: 'SEU PC ESTÁ\nMUITO LENTO!', icone: 'aviso', botao: 'CORRIGIR', barra: 0xa81a1a },
  { titulo: 'mensageiro', texto: 'VOCÊ TEM 99\nMENSAGENS!', icone: 'carta', botao: 'LER', barra: 0x1a6a2a },
  { titulo: 'promo.exe', texto: 'VISITANTE\nNº 1.000.000!', icone: 'estrela', botao: 'CLIQUE', barra: 0x6a3aa8 },
  { titulo: 'antivirus.exe', texto: '37 VÍRUS\nENCONTRADOS', icone: 'aviso', botao: 'LIMPAR', barra: 0x0a246a },
  { titulo: 'barra.exe', texto: 'INSTALE A\nBARRA GRÁTIS', icone: 'presente', botao: 'SIM!', barra: 0x1a5a8a },
]

// ícones 8x8 em "pixels" de 2 px
const ICONES = {
  presente: ['..y..y..', '...yy...', 'rrryyrrr', 'rrryyrrr', 'rrryyrrr', 'rrryyrrr', 'rrryyrrr', 'rrryyrrr'],
  ram: ['........', 'gggggggg', 'gkkgkkgg', 'gkkgkkgg', 'gggggggg', 'y.y.y.y.', '........', '........'],
  aviso: ['...yy...', '...yy...', '..yKKy..', '..yKKy..', '.yyKKyy.', '.yyyyyy.', 'yyyKKyyy', 'yyyyyyyy'],
  carta: ['wwwwwwww', 'wKwwwwKw', 'wwKwwKww', 'wwwKKwww', 'wwwwwwww', 'wwwwwwww', 'wwwwwwww', '........'],
  estrela: ['...yy...', '...yy...', 'yyyyyyyy', '.yyyyyy.', '..yyyy..', '.yy..yy.', 'yy....yy', '........'],
}
const COR_ICONE = { y: 0xffd040, r: 0xd83030, g: 0x2a8a3a, k: 0x101010, K: 0x101010, w: 0xf0f0f0 }

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  let ativo = false
  let t = 0
  let ultimoSom = -Infinity
  let caixas = [] // por pista: { pista, janelas: [], proxima }
  let fechadas = 0
  let proximoAnuncio = 0 // os anúncios vão em roda (sem repetir o mesmo seguido)
  let camada = 0 // a janela mais nova fica por cima
  const vivas = new Set() // todas as janelas (inclusive as fechando), para o terminar

  const montarJanela = (anuncio, w, h) => {
    const c = arena.add.container(0, 0)
    const g = arena.add.graphics()
    // sombra, corpo cinza com relevo (estilo Windows antigo), barra de título
    g.fillStyle(0x000000, 0.4).fillRect(3, 3, w, h)
    g.fillStyle(0xd4d0c8, 1).fillRect(0, 0, w, h)
    g.fillStyle(0xffffff, 1).fillRect(0, 0, w, 1).fillRect(0, 0, 1, h)
    g.fillStyle(0x404040, 1).fillRect(0, h - 1, w, 1).fillRect(w - 1, 0, 1, h)
    g.fillStyle(anuncio.barra, 1).fillRect(2, 2, w - 4, 12)
    g.fillStyle(0xffffff, 0.18).fillRect(2, 2, w - 4, 3)
    // ícone
    const desenho = ICONES[anuncio.icone]
    desenho.forEach((linha, y) => [...linha].forEach((ch, x) => {
      if (ch === '.') return
      g.fillStyle(COR_ICONE[ch], 1).fillRect(6 + x * 2, 20 + y * 2, 2, 2)
    }))
    // botão falso embaixo
    g.fillStyle(0xe8e4dc, 1).fillRect(w / 2 - 26, h - 17, 52, 13)
    g.fillStyle(0x404040, 1).fillRect(w / 2 - 26, h - 5, 52, 1).fillRect(w / 2 + 25, h - 17, 1, 13)
    const titulo = arena.add.text(5, 3, anuncio.titulo, { fontFamily: FONTE, fontSize: '9px', color: '#ffffff' })
    const texto = arena.add.text(26, 19, anuncio.texto, { fontFamily: FONTE, fontSize: '10px', color: '#101010', lineSpacing: 1 })
    const botao = arena.add.text(w / 2, h - 11, anuncio.botao, { fontFamily: FONTE, fontSize: '9px', color: '#0a246a' }).setOrigin(0.5)
    // o [X]: o alvo. Contorno vermelho pulsando por cima
    const x = { x: w - BOTAO_X.w - 3, y: 3 }
    const gx = arena.add.graphics()
    gx.fillStyle(0xd4d0c8, 1).fillRect(x.x, x.y, BOTAO_X.w, BOTAO_X.h - 1)
    gx.fillStyle(0xffffff, 1).fillRect(x.x, x.y, BOTAO_X.w, 1)
    gx.fillStyle(0x404040, 1).fillRect(x.x, x.y + BOTAO_X.h - 2, BOTAO_X.w, 1)
    gx.fillStyle(0x101010, 1)
    for (let k = 0; k < 5; k++) gx.fillRect(x.x + 4 + k, x.y + 3 + k, 1, 1).fillRect(x.x + 8 - k, x.y + 3 + k, 1, 1)
    const aro = arena.add.graphics()
    aro.lineStyle(2, 0xff3040, 1).strokeRect(x.x - 2, x.y - 2, BOTAO_X.w + 4, BOTAO_X.h + 3)
    c.add([g, titulo, texto, botao, gx, aro])
    c.setSize(w, h).setAlpha(ALPHA)
    return { c, botao, aro, x }
  }

  const abrir = (cx) => {
    const { pista } = cx
    const l = pista.caixa.limites
    const coracao = pista.coracoes[0]
    const w = Math.round(Math.min(TAMANHO.w, l.width * 0.6))
    const h = Math.round(Math.min(TAMANHO.h, l.height * 0.5))
    const anuncio = ANUNCIOS[proximoAnuncio % ANUNCIOS.length]
    // posição relativa (0..1 do espaço livre); longe do coração
    for (let tentativa = 0; tentativa < 14; tentativa++) {
      const fx = sorte()
      const fy = sorte()
      const x = l.left + fx * (l.width - w)
      const y = l.top + fy * (l.height - h)
      if (coracao?.ativo) {
        const dx = Math.max(x - coracao.x, 0, coracao.x - (x + w))
        const dy = Math.max(y - coracao.y, 0, coracao.y - (y + h))
        if (Math.hypot(dx, dy) < LONGE_DO_CORACAO) continue
      }
      proximoAnuncio += 1 + Math.floor(sorte() * 2)
      const jan = montarJanela(anuncio, w, h)
      vivas.add(jan.c)
      jan.c.once('destroy', () => vivas.delete(jan.c))
      jan.fx = fx
      jan.fy = fy
      jan.w = w
      jan.h = h
      jan.nasceu = t
      jan.c.setDepth(8 + (camada++ % 100) * 0.001)
      pista.caixa.recortar(jan.c)
      posicionar(jan, l)
      arena.tweens.add({ targets: jan.c, scale: { from: 0.25, to: 1 }, duration: 150, ease: 'Back.easeOut' })
      cx.janelas.push(jan)
      if (t - ultimoSom > 140) {
        ultimoSom = t
        tocar(arena, 'popup')
      }
      return
    }
  }

  // o container fica no canto de cima da janela (ela abre crescendo dali)
  const posicionar = (jan, l) => {
    const x = l.left + jan.fx * Math.max(0, l.width - jan.w)
    const y = l.top + jan.fy * Math.max(0, l.height - jan.h)
    jan.c.setPosition(x, y)
    jan.bx = x
    jan.by = y
  }

  const fechar = (cx, jan, pelaMao) => {
    jan.fechando = true
    cx.janelas = cx.janelas.filter((o) => o !== jan)
    const meio = { x: jan.bx + jan.w / 2, y: jan.by + jan.h / 2 }
    // encolhe para o meio e some
    arena.tweens.add({
      targets: jan.c,
      scale: 0.1,
      x: meio.x - (jan.w * 0.1) / 2,
      y: meio.y - (jan.h * 0.1) / 2,
      alpha: 0,
      duration: pelaMao ? 130 : 260,
      ease: 'Quad.easeIn',
      onComplete: () => jan.c.destroy(),
    })
    if (pelaMao) {
      fechadas++
      tocar(arena, 'fecharJanela')
      particulas(arena, jan.bx + jan.x.x + BOTAO_X.w / 2, jan.by + jan.x.y + BOTAO_X.h / 2, { cor: 0xffffff, quantidade: 8, velocidade: 90, vida: 300 })
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      proximoAnuncio = Math.floor(sorte() * ANUNCIOS.length)
      caixas = arena.pistas.map((pista) => ({ pista, janelas: [], proxima: entre(PRIMEIRA_MS.min, PRIMEIRA_MS.max) }))
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      const maximo = t > MAXIMO.apos ? MAXIMO.depois : MAXIMO.inicio
      const pisca = Math.floor(t / 280) % 2
      for (const cx of caixas) {
        const { pista } = cx
        const l = pista.caixa.limites
        cx.proxima -= delta
        if (cx.proxima <= 0) {
          cx.proxima = entre(INTERVALO_MS.min, INTERVALO_MS.max)
          if (pista.atacando && cx.janelas.length < maximo) abrir(cx)
        }
        const c = pista.coracoes[0]
        for (const jan of [...cx.janelas]) {
          posicionar(jan, l)
          jan.aro.setAlpha(0.45 + 0.55 * Math.abs(Math.sin(t / 160)))
          jan.botao.setColor(pisca ? '#d81a1a' : '#0a246a')
          // coração em cima do [X] fecha; senão ela some sozinha com o tempo (ou no fim do ataque)
          const bx = jan.bx + jan.x.x
          const by = jan.by + jan.x.y
          const folga = FOLGA_X + (c?.hitbox ?? 4)
          const emCima = c?.ativo && c.x >= bx - folga && c.x <= bx + BOTAO_X.w + folga && c.y >= by - folga && c.y <= by + BOTAO_X.h + folga
          if (emCima) fechar(cx, jan, true)
          else if (t - jan.nasceu > VIDA_MS || !pista.rodando) fechar(cx, jan, false)
        }
      }
    },

    estadoDebug() {
      return { t: Math.round(t), fechadas, janelas: caixas.map((cx) => cx.janelas.map((j) => ({ x: Math.round(j.bx), y: Math.round(j.by), w: j.w, h: j.h, xBotao: { x: Math.round(j.bx + j.x.x + BOTAO_X.w / 2), y: Math.round(j.by + j.x.y + BOTAO_X.h / 2) } }))) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const c of [...vivas]) {
        arena.tweens.killTweensOf(c)
        c.destroy()
      }
      vivas.clear()
      caixas = []
    },
  }
}
